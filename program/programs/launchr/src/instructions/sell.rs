//! Launchr - Sell Tokens
//!
//! Sell tokens back to the bonding curve for SOL.

use anchor_lang::prelude::*;
use anchor_lang::system_program;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};
use crate::seeds::*;
use crate::state::*;
use crate::math::{bonding_curve, LaunchrError};
use crate::instructions::buy::TradeExecuted;

/// Minimum lamports to keep in curve vault for rent exemption
const CURVE_VAULT_RENT_MINIMUM: u64 = 890_880;

/// Sell tokens back to the bonding curve
#[derive(Accounts)]
pub struct Sell<'info> {
    /// Seller
    #[account(mut)]
    pub seller: Signer<'info>,

    /// Global config
    #[account(
        mut,
        seeds = [CONFIG_SEED],
        bump = config.bump,
        constraint = !config.trading_paused @ LaunchrError::TradingPaused
    )]
    pub config: Box<Account<'info, Config>>,

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

    /// Token vault (destination for tokens)
    #[account(
        mut,
        seeds = [TOKEN_VAULT_SEED, launch.key().as_ref()],
        bump,
        constraint = token_vault.mint == launch.mint @ LaunchrError::InvalidConfig
    )]
    pub token_vault: Account<'info, TokenAccount>,

    /// SOL curve vault (source of SOL)
    /// CHECK: PDA for holding SOL
    #[account(
        mut,
        seeds = [CURVE_VAULT_SEED, launch.key().as_ref()],
        bump
    )]
    pub curve_vault: UncheckedAccount<'info>,

    /// Seller's token account
    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = seller,
    )]
    pub seller_token_account: Account<'info, TokenAccount>,

    /// Token mint
    #[account(
        constraint = mint.key() == launch.mint @ LaunchrError::InvalidConfig
    )]
    pub mint: Account<'info, anchor_spl::token::Mint>,

    /// User position
    #[account(
        mut,
        seeds = [USER_POSITION_SEED, launch.key().as_ref(), seller.key().as_ref()],
        bump = user_position.bump,
        constraint = user_position.launch == launch.key() @ LaunchrError::InvalidConfig,
        constraint = user_position.user == seller.key() @ LaunchrError::Unauthorized
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
        constraint = creator.key() == launch.creator @ LaunchrError::InvalidCreator
    )]
    pub creator: UncheckedAccount<'info>,

    /// Token program
    pub token_program: Program<'info, Token>,

    /// System program
    pub system_program: Program<'info, System>,
}

/// Parameters for selling tokens
#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct SellParams {
    /// Amount of tokens to sell
    pub token_amount: u64,
    /// Minimum SOL to receive (slippage protection)
    pub min_sol_out: u64,
}

/// Sell tokens back to the bonding curve
pub fn sell(ctx: Context<Sell>, params: SellParams) -> Result<()> {
    let launch = &mut ctx.accounts.launch;
    let config = &mut ctx.accounts.config;
    let user_position = &mut ctx.accounts.user_position;
    let clock = Clock::get()?;

    // Verify seller has enough tokens
    require!(
        ctx.accounts.seller_token_account.amount >= params.token_amount,
        LaunchrError::InsufficientLiquidity
    );

    // Calculate swap
    let swap_result = bonding_curve::calculate_sell(
        params.token_amount,
        launch.virtual_sol_reserve,
        launch.virtual_token_reserve,
        config.protocol_fee_bps,
        launch.creator_fee_bps,
    )?;

    // Check slippage
    require!(
        swap_result.amount_out >= params.min_sol_out,
        LaunchrError::SlippageExceeded
    );

    // Check sufficient SOL in vault (including rent-exempt minimum)
    let total_sol_needed = swap_result.amount_out
        .checked_add(swap_result.protocol_fee)
        .and_then(|v| v.checked_add(swap_result.creator_fee))
        .ok_or(error!(LaunchrError::MathOverflow))?;

    let vault_lamports = ctx.accounts.curve_vault.lamports();
    require!(
        vault_lamports >= total_sol_needed.saturating_add(CURVE_VAULT_RENT_MINIMUM),
        LaunchrError::InsufficientLiquidity
    );

    // Transfer tokens from seller to vault
    token::transfer(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.seller_token_account.to_account_info(),
                to: ctx.accounts.token_vault.to_account_info(),
                authority: ctx.accounts.seller.to_account_info(),
            },
        ),
        params.token_amount,
    )?;

    // Transfer SOL from curve vault using system_program::transfer with PDA signer.
    // The curve_vault is owned by the System Program (SOL deposited via system_program::transfer
    // in buy), so direct lamport manipulation would fail with ExternalAccountLamportSpend.
    let launch_key = launch.key();
    let curve_vault_bump = ctx.bumps.curve_vault;
    let curve_vault_seeds: &[&[u8]] = &[
        CURVE_VAULT_SEED,
        launch_key.as_ref(),
        &[curve_vault_bump],
    ];
    let signer_seeds = &[curve_vault_seeds];

    // Transfer SOL to seller
    system_program::transfer(
        CpiContext::new_with_signer(
            ctx.accounts.system_program.to_account_info(),
            system_program::Transfer {
                from: ctx.accounts.curve_vault.to_account_info(),
                to: ctx.accounts.seller.to_account_info(),
            },
            signer_seeds,
        ),
        swap_result.amount_out,
    )?;

    // Transfer protocol fee to fee vault
    if swap_result.protocol_fee > 0 {
        system_program::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.system_program.to_account_info(),
                system_program::Transfer {
                    from: ctx.accounts.curve_vault.to_account_info(),
                    to: ctx.accounts.fee_vault.to_account_info(),
                },
                signer_seeds,
            ),
            swap_result.protocol_fee,
        )?;
    }

    // Transfer creator fee
    if swap_result.creator_fee > 0 {
        system_program::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.system_program.to_account_info(),
                system_program::Transfer {
                    from: ctx.accounts.curve_vault.to_account_info(),
                    to: ctx.accounts.creator.to_account_info(),
                },
                signer_seeds,
            ),
            swap_result.creator_fee,
        )?;
    }

    // Update launch state — pass total SOL leaving vault (payout + all fees)
    launch.record_sell(params.token_amount, swap_result.amount_out, total_sol_needed);

    // Update user position
    user_position.record_sell(params.token_amount, swap_result.amount_out, clock.unix_timestamp);

    // Update global stats
    config.record_trade(swap_result.amount_out, swap_result.protocol_fee);

    // Emit event
    emit!(TradeExecuted {
        launch: launch.key(),
        trader: ctx.accounts.seller.key(),
        is_buy: false,
        sol_amount: swap_result.amount_out,
        token_amount: params.token_amount,
        price: swap_result.price_after,
        protocol_fee: swap_result.protocol_fee,
        creator_fee: swap_result.creator_fee,
        timestamp: clock.unix_timestamp,
    });

    msg!("Sell executed: {} tokens -> {} SOL",
        params.token_amount as f64 / 1e9,
        swap_result.amount_out as f64 / 1e9
    );
    msg!("New price: {} lamports/token", swap_result.price_after);
    msg!("Price impact: {} bps", swap_result.price_impact_bps);

    Ok(())
}
