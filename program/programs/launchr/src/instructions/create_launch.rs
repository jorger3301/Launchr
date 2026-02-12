//! Launchr - Create Launch
//! 
//! Create a new token launch on the bonding curve.

use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, MintTo};
use crate::seeds::*;
use crate::state::*;
use crate::math::LaunchrError;

/// Create a new token launch
#[derive(Accounts)]
#[instruction(params: CreateLaunchParams)]
pub struct CreateLaunch<'info> {
    /// Creator of the launch
    #[account(mut)]
    pub creator: Signer<'info>,
    
    /// Global config
    #[account(
        mut,
        seeds = [CONFIG_SEED],
        bump = config.bump,
        constraint = !config.launches_paused @ LaunchrError::LaunchesPaused
    )]
    pub config: Box<Account<'info, Config>>,

    /// Token mint (created by this instruction)
    #[account(
        init,
        payer = creator,
        mint::decimals = 9,
        mint::authority = launch_authority,
        mint::freeze_authority = launch_authority,
    )]
    pub mint: Box<Account<'info, Mint>>,
    
    /// Launch account (PDA)
    #[account(
        init,
        payer = creator,
        space = Launch::LEN,
        seeds = [LAUNCH_SEED, mint.key().as_ref()],
        bump
    )]
    pub launch: Box<Account<'info, Launch>>,
    
    /// Launch authority PDA
    /// CHECK: PDA checked by seeds
    #[account(
        seeds = [LAUNCH_AUTHORITY_SEED, launch.key().as_ref()],
        bump
    )]
    pub launch_authority: UncheckedAccount<'info>,
    
    /// Token vault for bonding curve tokens
    #[account(
        init,
        payer = creator,
        token::mint = mint,
        token::authority = launch_authority,
        seeds = [TOKEN_VAULT_SEED, launch.key().as_ref()],
        bump
    )]
    pub token_vault: Box<Account<'info, TokenAccount>>,

    /// LP reserve token vault (20% for Orbit DLMM migration)
    #[account(
        init,
        payer = creator,
        token::mint = mint,
        token::authority = launch_authority,
        seeds = [GRADUATION_VAULT_SEED, launch.key().as_ref()],
        bump
    )]
    pub graduation_vault: Box<Account<'info, TokenAccount>>,

    // Note: Creator receives 2 SOL reward on graduation, not token allocation
    // No creator_token_account needed

    /// Token program
    pub token_program: Program<'info, Token>,

    /// System program
    pub system_program: Program<'info, System>,
    
    /// Rent sysvar
    pub rent: Sysvar<'info, Rent>,
}

/// Parameters for creating a launch
#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct CreateLaunchParams {
    /// Token name (max 32 chars)
    pub name: String,
    /// Token symbol (max 10 chars)
    pub symbol: String,
    /// Metadata URI (max 200 chars)
    pub uri: String,
    /// Twitter handle (optional, max 64 chars)
    pub twitter: Option<String>,
    /// Telegram group (optional, max 64 chars)
    pub telegram: Option<String>,
    /// Website URL (optional, max 64 chars)
    pub website: Option<String>,
    /// Creator fee in basis points (ignored - fixed at 0.2%)
    #[deprecated(note = "Creator fee is now fixed at 0.2%. This field is ignored.")]
    pub creator_fee_bps: u16,
}

/// Creator fee: 0.2% (20 bps) - fixed, taken from the 1% protocol fee
pub const CREATOR_FEE_BPS: u16 = 20;

/// Create a new token launch
pub fn create_launch(ctx: Context<CreateLaunch>, params: CreateLaunchParams) -> Result<()> {
    // Validate parameters
    require!(params.name.len() <= 32, LaunchrError::InvalidConfig);
    require!(params.symbol.len() <= 10, LaunchrError::InvalidConfig);
    require!(params.uri.len() <= 200, LaunchrError::InvalidConfig);
    // creator_fee_bps is ignored - always fixed at 0.2%
    
    let launch = &mut ctx.accounts.launch;
    let config = &mut ctx.accounts.config;
    let clock = Clock::get()?;
    
    // Initialize launch state
    launch.mint = ctx.accounts.mint.key();
    launch.creator = ctx.accounts.creator.key();
    launch.status = LaunchStatus::Active;
    
    // Token allocation (80% bonding curve, 20% LP reserve)
    launch.total_supply = allocation::TOTAL_SUPPLY;
    launch.creator_tokens = 0; // Creator receives SOL on graduation, not tokens
    launch.graduation_tokens = allocation::lp_reserve_tokens(); // 20% for LP migration

    // Bonding curve initial state
    let curve_tokens = allocation::curve_tokens(); // 80%
    launch.tokens_sold = 0;
    launch.virtual_sol_reserve = curve_params::INITIAL_VIRTUAL_SOL;
    launch.virtual_token_reserve = curve_params::INITIAL_VIRTUAL_TOKENS;
    launch.real_sol_reserve = 0;
    launch.real_token_reserve = curve_tokens;
    
    // Thresholds
    launch.graduation_threshold = config.graduation_threshold;
    
    // Timestamps
    launch.created_at = clock.unix_timestamp;
    launch.graduated_at = 0;
    
    // Statistics
    launch.buy_volume = 0;
    launch.sell_volume = 0;
    launch.trade_count = 0;
    launch.holder_count = 1; // Creator
    
    // Fees - fixed at 0.2% (creator_fee_bps param is ignored)
    launch.creator_fee_bps = CREATOR_FEE_BPS;
    
    // Store metadata — write directly to heap-allocated launch (no stack temporaries)
    // Account is zero-initialized by `init`, so we only copy the actual bytes
    {
        let src = params.name.as_bytes();
        let len = src.len().min(32);
        launch.name[..len].copy_from_slice(&src[..len]);
    }

    {
        let src = params.symbol.as_bytes();
        let len = src.len().min(10);
        launch.symbol[..len].copy_from_slice(&src[..len]);
    }

    {
        let src = params.uri.as_bytes();
        let len = src.len().min(200);
        launch.uri[..len].copy_from_slice(&src[..len]);
    }

    // Optional social links
    if let Some(ref twitter) = params.twitter {
        let src = twitter.as_bytes();
        let len = src.len().min(64);
        launch.twitter[..len].copy_from_slice(&src[..len]);
    }

    if let Some(ref telegram) = params.telegram {
        let src = telegram.as_bytes();
        let len = src.len().min(64);
        launch.telegram[..len].copy_from_slice(&src[..len]);
    }

    if let Some(ref website) = params.website {
        let src = website.as_bytes();
        let len = src.len().min(64);
        launch.website[..len].copy_from_slice(&src[..len]);
    }
    
    // Store bumps
    launch.bump = ctx.bumps.launch;
    launch.authority_bump = ctx.bumps.launch_authority;
    
    // Mint tokens
    let launch_key = launch.key();
    let authority_seeds: &[&[u8]] = &[
        LAUNCH_AUTHORITY_SEED,
        launch_key.as_ref(),
        &[launch.authority_bump],
    ];
    let signer_seeds = &[authority_seeds];
    
    // Mint to bonding curve vault (80% - sold on curve)
    token::mint_to(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            MintTo {
                mint: ctx.accounts.mint.to_account_info(),
                to: ctx.accounts.token_vault.to_account_info(),
                authority: ctx.accounts.launch_authority.to_account_info(),
            },
            signer_seeds,
        ),
        curve_tokens,
    )?;

    // Mint to LP reserve vault (20% - reserved for Orbit DLMM migration)
    token::mint_to(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            MintTo {
                mint: ctx.accounts.mint.to_account_info(),
                to: ctx.accounts.graduation_vault.to_account_info(),
                authority: ctx.accounts.launch_authority.to_account_info(),
            },
            signer_seeds,
        ),
        launch.graduation_tokens,
    )?;

    // Note: Creator receives SOL reward (2 SOL) on graduation, not token allocation
    
    // Update global stats
    config.record_launch();
    
    // Log before emitting (since emit moves the values)
    msg!("🚀 Launch created: {} ({})", params.name, params.symbol);

    // Emit event
    emit!(LaunchCreated {
        mint: launch.mint,
        creator: launch.creator,
        name: params.name,
        symbol: params.symbol,
        total_supply: launch.total_supply,
        graduation_threshold: launch.graduation_threshold,
        timestamp: clock.unix_timestamp,
    });
    msg!("Mint: {}", launch.mint);
    msg!("Bonding curve: {} tokens (80%)", curve_tokens);
    msg!("LP reserve: {} tokens (20%)", launch.graduation_tokens);
    msg!("Creator receives: 2 SOL reward on graduation");
    
    Ok(())
}

/// Event emitted when a launch is created
#[event]
pub struct LaunchCreated {
    pub mint: Pubkey,
    pub creator: Pubkey,
    pub name: String,
    pub symbol: String,
    pub total_supply: u64,
    pub graduation_threshold: u64,
    pub timestamp: i64,
}
