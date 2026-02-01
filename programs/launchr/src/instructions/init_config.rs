//! Launchr - Initialize Configuration
//! 
//! One-time initialization of the global protocol configuration.

use anchor_lang::prelude::*;
use crate::seeds::*;
use crate::state::*;

/// Initialize the global Launchr configuration
/// 
/// This can only be called once by the deployer.
#[derive(Accounts)]
pub struct InitConfig<'info> {
    /// Admin authority (deployer)
    #[account(mut)]
    pub admin: Signer<'info>,
    
    /// Global config account (PDA)
    #[account(
        init,
        payer = admin,
        space = Config::LEN,
        seeds = [CONFIG_SEED],
        bump
    )]
    pub config: Account<'info, Config>,
    
    /// Quote mint for Orbit pools (WSOL)
    pub quote_mint: Account<'info, anchor_spl::token::Mint>,
    
    /// System program
    pub system_program: Program<'info, System>,
}

/// Parameters for initializing config
#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct InitConfigParams {
    /// Fee authority address
    pub fee_authority: Pubkey,
    /// Protocol fee in basis points
    pub protocol_fee_bps: u16,
    /// SOL threshold for graduation
    pub graduation_threshold: u64,
    /// Orbit Finance program ID
    pub orbit_program_id: Pubkey,
    /// Default bin step for Orbit pools
    pub default_bin_step_bps: u16,
    /// Default base fee for Orbit pools
    pub default_base_fee_bps: u16,
}

/// Initialize the global config
pub fn init_config(ctx: Context<InitConfig>, params: InitConfigParams) -> Result<()> {
    let config = &mut ctx.accounts.config;
    
    // Validate parameters
    require!(params.protocol_fee_bps <= 1000, crate::math::LaunchrError::InvalidConfig); // Max 10%
    require!(params.graduation_threshold > 0, crate::math::LaunchrError::InvalidConfig);
    require!(params.default_bin_step_bps > 0 && params.default_bin_step_bps <= 500, crate::math::LaunchrError::InvalidConfig);
    
    config.init(
        ctx.accounts.admin.key(),
        params.fee_authority,
        params.protocol_fee_bps,
        params.graduation_threshold,
        ctx.accounts.quote_mint.key(),
        params.orbit_program_id,
        params.default_bin_step_bps,
        params.default_base_fee_bps,
        ctx.bumps.config,
    )?;
    
    msg!("Launchr config initialized");
    msg!("Admin: {}", ctx.accounts.admin.key());
    msg!("Graduation threshold: {} SOL", params.graduation_threshold / 1_000_000_000);
    
    Ok(())
}

/// Update configuration parameters
#[derive(Accounts)]
pub struct UpdateConfig<'info> {
    /// Admin authority
    pub admin: Signer<'info>,
    
    /// Global config account
    #[account(
        mut,
        seeds = [CONFIG_SEED],
        bump = config.bump,
        constraint = config.admin == admin.key() @ crate::math::LaunchrError::Unauthorized
    )]
    pub config: Account<'info, Config>,
}

/// Parameters for updating config
#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct UpdateConfigParams {
    /// New fee authority (optional)
    pub new_fee_authority: Option<Pubkey>,
    /// New protocol fee (optional)
    pub new_protocol_fee_bps: Option<u16>,
    /// New graduation threshold (optional)
    pub new_graduation_threshold: Option<u64>,
    /// Pause/unpause launches
    pub launches_paused: Option<bool>,
    /// Pause/unpause trading
    pub trading_paused: Option<bool>,
}

/// Update config parameters
pub fn update_config(ctx: Context<UpdateConfig>, params: UpdateConfigParams) -> Result<()> {
    let config = &mut ctx.accounts.config;
    
    if let Some(fee_authority) = params.new_fee_authority {
        config.fee_authority = fee_authority;
        msg!("Updated fee authority: {}", fee_authority);
    }
    
    if let Some(protocol_fee_bps) = params.new_protocol_fee_bps {
        require!(protocol_fee_bps <= 1000, crate::math::LaunchrError::InvalidConfig);
        config.protocol_fee_bps = protocol_fee_bps;
        msg!("Updated protocol fee: {} bps", protocol_fee_bps);
    }
    
    if let Some(graduation_threshold) = params.new_graduation_threshold {
        require!(graduation_threshold > 0, crate::math::LaunchrError::InvalidConfig);
        config.graduation_threshold = graduation_threshold;
        msg!("Updated graduation threshold: {} lamports", graduation_threshold);
    }
    
    if let Some(paused) = params.launches_paused {
        config.launches_paused = paused;
        msg!("Launches paused: {}", paused);
    }
    
    if let Some(paused) = params.trading_paused {
        config.trading_paused = paused;
        msg!("Trading paused: {}", paused);
    }
    
    Ok(())
}

/// Transfer admin authority
#[derive(Accounts)]
pub struct TransferAdmin<'info> {
    /// Current admin
    pub admin: Signer<'info>,
    
    /// New admin
    /// CHECK: Just storing the pubkey
    pub new_admin: UncheckedAccount<'info>,
    
    /// Global config
    #[account(
        mut,
        seeds = [CONFIG_SEED],
        bump = config.bump,
        constraint = config.admin == admin.key() @ crate::math::LaunchrError::Unauthorized
    )]
    pub config: Account<'info, Config>,
}

/// Transfer admin authority to a new account
pub fn transfer_admin(ctx: Context<TransferAdmin>) -> Result<()> {
    let config = &mut ctx.accounts.config;
    let new_admin = ctx.accounts.new_admin.key();
    
    msg!("Transferring admin from {} to {}", config.admin, new_admin);
    config.admin = new_admin;
    
    Ok(())
}
