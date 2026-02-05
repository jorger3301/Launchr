//! Launchr - Buy Tokens
//! 
//! Buy tokens from the bonding curve using SOL.

use anchor_lang::prelude::*;
use anchor_lang::system_program;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};
use crate::seeds::*;
use crate::state::*;
use crate::math::{bonding_curve, LaunchrError};

/// Buy tokens from the bonding curve
#[derive(Accounts)]
pub struct Buy<'info> {
    /// Buyer
    #[account(mut)]
    pub buyer: Signer<'info>,
    
    /// Global config
    #[account(
        mut,
        seeds = [CONFIG_SEED],
        bump = config.bump,
        constraint = !config.trading_paused @ LaunchrError::TradingPaused
    )]
    pub config: Account<'info, Config>,
    
    /// Launch account
    #[account(
        mut,
        seeds = [LAUNCH_SEED, launch.mint.as_ref()],
        bump = launch.bump,
        constraint = launch.is_tradeable() @ LaunchrError::LaunchNotActive
    )]
    pub launch: Box<Account<'info, Launch>>,
    
    /// Launch authority PDA
    /// CHECK: PDA checked by seeds
    #[account(
        seeds = [LAUNCH_AUTHORITY_SEED, launch.key().as_ref()],
        bump = launch.authority_bump
    )]
    pub launch_authority: UncheckedAccount<'info>,
    
    /// Token vault (source of tokens)
    #[account(
        mut,
        seeds = [TOKEN_VAULT_SEED, launch.key().as_ref()],
        bump,
        constraint = token_vault.mint == launch.mint
    )]
    pub token_vault: Account<'info, TokenAccount>,
    
    /// SOL curve vault (destination for SOL)
    /// CHECK: PDA for holding SOL
    #[account(
        mut,
        seeds = [CURVE_VAULT_SEED, launch.key().as_ref()],
        bump
    )]
    pub curve_vault: UncheckedAccount<'info>,
    
    /// Buyer's token account
    #[account(
        init_if_needed,
        payer = buyer,
        associated_token::mint = mint,
        associated_token::authority = buyer,
    )]
    pub buyer_token_account: Account<'info, TokenAccount>,
    
    /// Token mint
    #[account(
        constraint = mint.key() == launch.mint
    )]
    pub mint: Account<'info, anchor_spl::token::Mint>,
    
    /// User position (created if first trade)
    #[account(
        init_if_needed,
        payer = buyer,
        space = UserPosition::LEN,
        seeds = [USER_POSITION_SEED, launch.key().as_ref(), buyer.key().as_ref()],
        bump
    )]
    pub user_position: Account<'info, UserPosition>,
    
    /// Fee vault for protocol fees
    /// CHECK: PDA for holding protocol fees
    #[account(
        mut,
        seeds = [FEE_VAULT_SEED, config.key().as_ref()],
        bump
    )]
    pub fee_vault: UncheckedAccount<'info>,
    
    /// Creator account (receives creator fees)
    /// CHECK: Creator from launch account
    #[account(
        mut,
        constraint = creator.key() == launch.creator
    )]
    pub creator: UncheckedAccount<'info>,
    
    /// Token program
    pub token_program: Program<'info, Token>,
    
    /// Associated token program
    pub associated_token_program: Program<'info, anchor_spl::associated_token::AssociatedToken>,
    
    /// System program
    pub system_program: Program<'info, System>,
}

/// Parameters for buying tokens
#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct BuyParams {
    /// Amount of SOL to spend (in lamports)
    pub sol_amount: u64,
    /// Minimum tokens to receive (slippage protection)
    pub min_tokens_out: u64,
}

/// Buy tokens from the bonding curve
pub fn buy(ctx: Context<Buy>, params: BuyParams) -> Result<()> {
    let launch = &mut ctx.accounts.launch;
    let config = &mut ctx.accounts.config;
    let user_position = &mut ctx.accounts.user_position;
    let clock = Clock::get()?;
    
    // Calculate swap
    let swap_result = bonding_curve::calculate_buy(
        params.sol_amount,
        launch.virtual_sol_reserve,
        launch.virtual_token_reserve,
        config.protocol_fee_bps,
        launch.creator_fee_bps,
    )?;
    
    // Check slippage
    require!(
        swap_result.amount_out >= params.min_tokens_out,
        LaunchrError::SlippageExceeded
    );
    
    // Check sufficient tokens in vault
    require!(
        swap_result.amount_out <= launch.real_token_reserve,
        LaunchrError::InsufficientLiquidity
    );
    
    // Transfer SOL to curve vault (minus fees)
    let sol_to_vault = params.sol_amount
        .saturating_sub(swap_result.protocol_fee)
        .saturating_sub(swap_result.creator_fee);
    
    system_program::transfer(
        CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            system_program::Transfer {
                from: ctx.accounts.buyer.to_account_info(),
                to: ctx.accounts.curve_vault.to_account_info(),
            },
        ),
        sol_to_vault,
    )?;
    
    // Transfer protocol fee
    if swap_result.protocol_fee > 0 {
        system_program::transfer(
            CpiContext::new(
                ctx.accounts.system_program.to_account_info(),
                system_program::Transfer {
                    from: ctx.accounts.buyer.to_account_info(),
                    to: ctx.accounts.fee_vault.to_account_info(),
                },
            ),
            swap_result.protocol_fee,
        )?;
    }
    
    // Transfer creator fee
    if swap_result.creator_fee > 0 {
        system_program::transfer(
            CpiContext::new(
                ctx.accounts.system_program.to_account_info(),
                system_program::Transfer {
                    from: ctx.accounts.buyer.to_account_info(),
                    to: ctx.accounts.creator.to_account_info(),
                },
            ),
            swap_result.creator_fee,
        )?;
    }
    
    // Transfer tokens to buyer
    let launch_key = launch.key();
    let authority_seeds: &[&[u8]] = &[
        LAUNCH_AUTHORITY_SEED,
        launch_key.as_ref(),
        &[launch.authority_bump],
    ];
    let signer_seeds = &[authority_seeds];
    
    token::transfer(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.token_vault.to_account_info(),
                to: ctx.accounts.buyer_token_account.to_account_info(),
                authority: ctx.accounts.launch_authority.to_account_info(),
            },
            signer_seeds,
        ),
        swap_result.amount_out,
    )?;
    
    // Update launch state
    launch.record_buy(swap_result.amount_out, sol_to_vault);
    
    // Update user position
    if user_position.is_new() {
        user_position.init(
            launch.key(),
            ctx.accounts.buyer.key(),
            ctx.bumps.user_position,
            clock.unix_timestamp,
        );
        launch.holder_count = launch.holder_count.saturating_add(1);
    }
    user_position.record_buy(swap_result.amount_out, params.sol_amount, clock.unix_timestamp);
    
    // Update global stats
    config.record_trade(params.sol_amount, swap_result.protocol_fee);
    
    // Emit event
    emit!(TradeExecuted {
        launch: launch.key(),
        trader: ctx.accounts.buyer.key(),
        is_buy: true,
        sol_amount: params.sol_amount,
        token_amount: swap_result.amount_out,
        price: swap_result.price_after,
        protocol_fee: swap_result.protocol_fee,
        creator_fee: swap_result.creator_fee,
        timestamp: clock.unix_timestamp,
    });
    
    msg!("Buy executed: {} SOL -> {} tokens", 
        params.sol_amount as f64 / 1e9,
        swap_result.amount_out as f64 / 1e9
    );
    msg!("New price: {} lamports/token", swap_result.price_after);
    msg!("Price impact: {} bps", swap_result.price_impact_bps);
    
    // Check if graduation threshold reached
    if launch.status == LaunchStatus::PendingGraduation {
        msg!("🎓 Graduation threshold reached! Ready to graduate to Orbit.");
    }
    
    Ok(())
}

/// Event emitted when a trade is executed
#[event]
pub struct TradeExecuted {
    pub launch: Pubkey,
    pub trader: Pubkey,
    pub is_buy: bool,
    pub sol_amount: u64,
    pub token_amount: u64,
    pub price: u64,
    pub protocol_fee: u64,
    pub creator_fee: u64,
    pub timestamp: i64,
}
