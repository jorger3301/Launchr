//! Launchr - Graduate to Orbit
//!
//! Graduate a launch from the bonding curve to Orbit Finance DLMM liquidity.
//! "Launch into Orbit" - the final step of the Launchr journey.
//!
//! ## Graduation Distribution (85 SOL threshold)
//! - 80 SOL → Orbit Finance DLMM LP (paired with 20% token reserve = 200M tokens)
//! - 2 SOL  → Token creator reward
//! - 3 SOL  → Launchr treasury
//!
//! ## LP Burning (PDA-Locked)
//! The LP position is created with the launch_authority PDA as owner. Since:
//! 1. Orbit positions are PDAs derived from [pool, owner, nonce] - owner is baked in
//! 2. Launchr program exposes NO withdraw instruction
//! 3. The launch_authority PDA can only sign via CPI from this program
//!
//! The liquidity is permanently locked (effectively burned). This is equivalent
//! to burning LP tokens - the pool functions normally, fees accrue but can
//! never be claimed, and liquidity can never be withdrawn.

use anchor_lang::prelude::*;
use anchor_lang::solana_program::instruction::Instruction;
use anchor_lang::solana_program::program::invoke_signed;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};
use crate::seeds::*;
use crate::state::*;
use crate::state::launch::graduation;
use crate::math::{orbit_math, LaunchrError};

/// Graduate a launch to Orbit Finance DLMM
#[derive(Accounts)]
pub struct Graduate<'info> {
    /// Anyone can trigger graduation once threshold is reached
    #[account(mut)]
    pub payer: Signer<'info>,

    /// Global config
    #[account(
        mut,
        seeds = [CONFIG_SEED],
        bump = config.bump
    )]
    pub config: Box<Account<'info, Config>>,

    /// Launch account
    #[account(
        mut,
        seeds = [LAUNCH_SEED, launch.mint.as_ref()],
        bump = launch.bump,
        constraint = launch.can_graduate() @ LaunchrError::AlreadyGraduated,
        constraint = launch.threshold_reached() @ LaunchrError::ThresholdNotReached
    )]
    pub launch: Box<Account<'info, Launch>>,

    /// Launch authority PDA
    /// CHECK: PDA checked by seeds
    #[account(
        seeds = [LAUNCH_AUTHORITY_SEED, launch.key().as_ref()],
        bump = launch.authority_bump
    )]
    pub launch_authority: UncheckedAccount<'info>,

    /// Token creator - receives 2 SOL reward
    /// CHECK: Validated against launch.creator
    #[account(
        mut,
        constraint = creator.key() == launch.creator @ LaunchrError::InvalidCreator
    )]
    pub creator: UncheckedAccount<'info>,

    /// Treasury - receives 3 SOL fee (fee_authority from config)
    /// CHECK: Validated against config.fee_authority
    #[account(
        mut,
        constraint = treasury.key() == config.fee_authority @ LaunchrError::InvalidTreasury
    )]
    pub treasury: UncheckedAccount<'info>,

    /// Token mint
    #[account(
        mut,
        constraint = mint.key() == launch.mint
    )]
    pub mint: Box<Account<'info, anchor_spl::token::Mint>>,

    /// Quote mint (WSOL)
    #[account(
        constraint = quote_mint.key() == config.quote_mint
    )]
    pub quote_mint: Box<Account<'info, anchor_spl::token::Mint>>,

    /// Token vault (bonding curve tokens)
    #[account(
        mut,
        seeds = [TOKEN_VAULT_SEED, launch.key().as_ref()],
        bump,
        constraint = token_vault.mint == launch.mint
    )]
    pub token_vault: Account<'info, TokenAccount>,

    /// LP reserve token vault (20% for DLMM migration)
    #[account(
        mut,
        seeds = [GRADUATION_VAULT_SEED, launch.key().as_ref()],
        bump,
        constraint = graduation_vault.mint == launch.mint
    )]
    pub graduation_vault: Account<'info, TokenAccount>,

    /// SOL curve vault
    /// CHECK: PDA holding SOL
    #[account(
        mut,
        seeds = [CURVE_VAULT_SEED, launch.key().as_ref()],
        bump
    )]
    pub curve_vault: UncheckedAccount<'info>,
    
    // ========== Orbit Finance Accounts ==========
    
    /// Orbit Finance program
    /// CHECK: Verified against config
    #[account(
        constraint = orbit_program.key() == config.orbit_program_id
    )]
    pub orbit_program: UncheckedAccount<'info>,
    
    /// Orbit pool (PDA to be created)
    /// CHECK: Will be created by CPI
    #[account(mut)]
    pub orbit_pool: UncheckedAccount<'info>,
    
    /// Orbit registry (PDA to be created)
    /// CHECK: Will be created by CPI
    #[account(mut)]
    pub orbit_registry: UncheckedAccount<'info>,
    
    /// Orbit base vault
    /// CHECK: Will be created by CPI
    #[account(mut)]
    pub orbit_base_vault: UncheckedAccount<'info>,
    
    /// Orbit quote vault
    /// CHECK: Will be created by CPI
    #[account(mut)]
    pub orbit_quote_vault: UncheckedAccount<'info>,
    
    /// Orbit creator fee vault
    /// CHECK: Will be created by CPI
    #[account(mut)]
    pub orbit_creator_fee_vault: UncheckedAccount<'info>,
    
    /// Orbit holders fee vault
    /// CHECK: Will be created by CPI
    #[account(mut)]
    pub orbit_holders_fee_vault: UncheckedAccount<'info>,
    
    /// Orbit NFT fee vault
    /// CHECK: Will be created by CPI
    #[account(mut)]
    pub orbit_nft_fee_vault: UncheckedAccount<'info>,
    
    /// Orbit protocol fee vault
    /// CHECK: Will be created by CPI
    #[account(mut)]
    pub orbit_protocol_fee_vault: UncheckedAccount<'info>,
    
    /// Orbit bin array (for active price)
    /// CHECK: Will be created by CPI
    #[account(mut)]
    pub orbit_bin_array: UncheckedAccount<'info>,
    
    /// Orbit position (for liquidity)
    /// CHECK: Will be created by CPI
    #[account(mut)]
    pub orbit_position: UncheckedAccount<'info>,
    
    /// Token program
    pub token_program: Program<'info, Token>,
    
    /// System program
    pub system_program: Program<'info, System>,
    
    /// Rent sysvar
    pub rent: Sysvar<'info, Rent>,
}

/// Parameters for graduation
#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct GraduateParams {
    /// Bin step for Orbit pool (BPS)
    pub bin_step_bps: Option<u16>,
    /// Number of bins for liquidity distribution (default: 10 bins each side)
    pub num_liquidity_bins: Option<u8>,
}

/// Balanced liquidity strategy constants
pub mod balanced_strategy {
    /// Default number of bins on each side of active bin
    pub const DEFAULT_BINS_PER_SIDE: u8 = 10;
    /// Target allocation: 40% to base token bins (below active price)
    pub const BASE_ALLOCATION_PCT: u8 = 40;
    /// Target allocation: 40% to quote token bins (above active price)
    pub const QUOTE_ALLOCATION_PCT: u8 = 40;
    /// Remaining 20% goes to active bin (mixed)
    pub const ACTIVE_BIN_PCT: u8 = 20;
}

/// Graduate a launch to Orbit Finance
pub fn graduate(ctx: Context<Graduate>, params: GraduateParams) -> Result<()> {
    let launch = &mut ctx.accounts.launch;
    let config = &mut ctx.accounts.config;
    let clock = Clock::get()?;

    // Use default values if not provided
    let bin_step_bps = params.bin_step_bps.unwrap_or(config.default_bin_step_bps);
    let num_bins_per_side = params.num_liquidity_bins
        .unwrap_or(balanced_strategy::DEFAULT_BINS_PER_SIDE);

    // Calculate current price from bonding curve
    let current_price = launch.current_price();
    msg!("Current bonding curve price: {} (scaled by 1e9)", current_price);

    // Convert to Q64.64 for Orbit
    let price_q64_64 = orbit_math::price_to_q64_64(current_price, 9);
    msg!("Price in Q64.64: {}", price_q64_64);

    // Calculate active bin index
    let active_bin_index = orbit_math::price_to_bin_index(price_q64_64, bin_step_bps);
    msg!("Active bin index: {}", active_bin_index);

    // Get bin array lower index (aligned to 64)
    let bin_array_lower = orbit_math::get_bin_array_lower_index(active_bin_index);
    msg!("Bin array lower index: {}", bin_array_lower);

    // Determine canonical mint ordering for Orbit
    let (base_mint, quote_mint, is_inverted) = get_orbit_mint_assignment(
        &launch.mint,
        &config.quote_mint,
    );
    msg!("Canonical ordering - Base: {}, Quote: {}", base_mint, quote_mint);
    msg!("Is inverted: {}", is_inverted);

    // Build authority signer seeds
    let launch_key = launch.key();
    let authority_seeds: &[&[u8]] = &[
        LAUNCH_AUTHORITY_SEED,
        launch_key.as_ref(),
        &[launch.authority_bump],
    ];
    let signer_seeds = &[authority_seeds];

    // ========== SOL Distribution ==========
    // Total: 85 SOL = 80 SOL (LP) + 2 SOL (Creator) + 3 SOL (Treasury)

    let curve_vault_lamports = ctx.accounts.curve_vault.lamports();
    msg!("Curve vault balance: {} lamports ({} SOL)",
        curve_vault_lamports,
        curve_vault_lamports as f64 / 1e9
    );

    // Verify we have enough SOL for distribution
    require!(
        curve_vault_lamports >= graduation::GRADUATION_THRESHOLD,
        LaunchrError::InsufficientGraduationFunds
    );

    // Transfer 2 SOL to creator
    msg!("Transferring {} SOL to creator...", graduation::CREATOR_REWARD_LAMPORTS as f64 / 1e9);
    **ctx.accounts.curve_vault.try_borrow_mut_lamports()? -= graduation::CREATOR_REWARD_LAMPORTS;
    **ctx.accounts.creator.try_borrow_mut_lamports()? += graduation::CREATOR_REWARD_LAMPORTS;

    // Transfer 3 SOL to treasury
    msg!("Transferring {} SOL to treasury...", graduation::TREASURY_FEE_LAMPORTS as f64 / 1e9);
    **ctx.accounts.curve_vault.try_borrow_mut_lamports()? -= graduation::TREASURY_FEE_LAMPORTS;
    **ctx.accounts.treasury.try_borrow_mut_lamports()? += graduation::TREASURY_FEE_LAMPORTS;

    // Remaining 80 SOL goes to LP
    let lp_sol_amount = ctx.accounts.curve_vault.lamports();
    msg!("LP SOL amount: {} lamports ({} SOL)", lp_sol_amount, lp_sol_amount as f64 / 1e9);

    // Calculate token amounts for LP
    // 20% LP reserve tokens from graduation_vault
    let token_amount = ctx.accounts.graduation_vault.amount
        .saturating_add(ctx.accounts.token_vault.amount);

    msg!("Graduation liquidity: {} SOL + {} tokens",
        lp_sol_amount as f64 / 1e9,
        token_amount as f64 / 1e9
    );
    
    // ========== CPI: Initialize Orbit Pool ==========
    
    let init_pool_ix = build_init_pool_instruction(
        &ctx.accounts.orbit_program.key(),
        &ctx.accounts.payer.key(),
        &ctx.accounts.orbit_pool.key(),
        &ctx.accounts.orbit_registry.key(),
        &base_mint,
        &quote_mint,
        price_q64_64,
        bin_step_bps,
        config.default_base_fee_bps,
        launch.creator_fee_bps,
    );
    
    msg!("Initializing Orbit pool...");
    invoke_signed(
        &init_pool_ix,
        &[
            ctx.accounts.payer.to_account_info(),
            ctx.accounts.orbit_pool.to_account_info(),
            ctx.accounts.orbit_registry.to_account_info(),
            ctx.accounts.mint.to_account_info(),
            ctx.accounts.quote_mint.to_account_info(),
            ctx.accounts.system_program.to_account_info(),
        ],
        signer_seeds,
    )?;
    
    // ========== CPI: Initialize Pool Vaults ==========
    
    let init_vaults_ix = build_init_vaults_instruction(
        &ctx.accounts.orbit_program.key(),
        &ctx.accounts.payer.key(),
        &ctx.accounts.orbit_pool.key(),
        &base_mint,
        &quote_mint,
        &ctx.accounts.orbit_base_vault.key(),
        &ctx.accounts.orbit_quote_vault.key(),
        &ctx.accounts.orbit_creator_fee_vault.key(),
        &ctx.accounts.orbit_holders_fee_vault.key(),
        &ctx.accounts.orbit_nft_fee_vault.key(),
        &ctx.accounts.orbit_protocol_fee_vault.key(),
    );
    
    msg!("Initializing Orbit vaults...");
    invoke_signed(
        &init_vaults_ix,
        &[
            ctx.accounts.payer.to_account_info(),
            ctx.accounts.orbit_pool.to_account_info(),
            ctx.accounts.orbit_base_vault.to_account_info(),
            ctx.accounts.orbit_quote_vault.to_account_info(),
            ctx.accounts.orbit_creator_fee_vault.to_account_info(),
            ctx.accounts.orbit_holders_fee_vault.to_account_info(),
            ctx.accounts.orbit_nft_fee_vault.to_account_info(),
            ctx.accounts.orbit_protocol_fee_vault.to_account_info(),
            ctx.accounts.mint.to_account_info(),
            ctx.accounts.quote_mint.to_account_info(),
            ctx.accounts.token_program.to_account_info(),
            ctx.accounts.system_program.to_account_info(),
        ],
        signer_seeds,
    )?;
    
    // ========== CPI: Create Bin Array ==========
    
    let create_bin_array_ix = build_create_bin_array_instruction(
        &ctx.accounts.orbit_program.key(),
        &ctx.accounts.payer.key(),
        &ctx.accounts.orbit_pool.key(),
        &ctx.accounts.orbit_bin_array.key(),
        bin_array_lower,
    );
    
    msg!("Creating Orbit bin array...");
    invoke_signed(
        &create_bin_array_ix,
        &[
            ctx.accounts.payer.to_account_info(),
            ctx.accounts.orbit_pool.to_account_info(),
            ctx.accounts.orbit_bin_array.to_account_info(),
            ctx.accounts.system_program.to_account_info(),
        ],
        signer_seeds,
    )?;

    // ========== CPI: Initialize Position ==========
    // Position nonce = 0 for the first (and only) position per launch
    let position_nonce: u64 = 0;

    let init_position_ix = build_init_position_instruction(
        &ctx.accounts.orbit_program.key(),
        &ctx.accounts.launch_authority.key(), // Position owned by launch authority (effectively burned)
        &ctx.accounts.orbit_pool.key(),
        &ctx.accounts.orbit_position.key(),
        position_nonce,
    );

    msg!("Initializing Orbit position (nonce={})...", position_nonce);
    invoke_signed(
        &init_position_ix,
        &[
            ctx.accounts.launch_authority.to_account_info(),
            ctx.accounts.orbit_pool.to_account_info(),
            ctx.accounts.orbit_position.to_account_info(),
            ctx.accounts.system_program.to_account_info(),
        ],
        signer_seeds,
    )?;

    // ========== Consolidate Tokens for add_liquidity_v2 ==========
    // add_liquidity_v2 transfers FROM owner accounts TO pool vaults
    // First consolidate graduation_vault tokens into token_vault
    if ctx.accounts.graduation_vault.amount > 0 {
        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.graduation_vault.to_account_info(),
                    to: ctx.accounts.token_vault.to_account_info(),
                    authority: ctx.accounts.launch_authority.to_account_info(),
                },
                signer_seeds,
            ),
            ctx.accounts.graduation_vault.amount,
        )?;
    }

    // Note: SOL in curve_vault needs to be wrapped to WSOL for add_liquidity_v2
    // The Orbit program will handle the token transfers during add_liquidity_v2

    // ========== CPI: Add Balanced Liquidity ==========
    // 40% quote bins (above active) + 40% base bins (below active) + 20% active bin

    let (bin_ids, liquidity_distribution) = calculate_balanced_distribution(
        active_bin_index,
        num_bins_per_side,
        token_amount,
        lp_sol_amount,
    );

    // Note: add_liquidity_v2 transfers FROM owner's token accounts TO pool vaults
    // owner_base = our token_vault (base tokens)
    // owner_quote = our curve_vault wrapped as WSOL (quote tokens)
    let add_liquidity_ix = build_add_liquidity_v2_instruction(
        &ctx.accounts.orbit_program.key(),
        &ctx.accounts.orbit_pool.key(),
        &ctx.accounts.launch_authority.key(),
        &ctx.accounts.token_vault.key(),      // owner's base tokens
        &ctx.accounts.curve_vault.key(),       // owner's quote (SOL/WSOL)
        &ctx.accounts.orbit_base_vault.key(),  // pool's base vault
        &ctx.accounts.orbit_quote_vault.key(), // pool's quote vault
        &ctx.accounts.orbit_position.key(),
        &[ctx.accounts.orbit_bin_array.key()], // bin arrays as remaining accounts
        &bin_ids,
        &liquidity_distribution,
    );

    msg!("Adding balanced liquidity (40/40/20 strategy)...");
    msg!("  Quote bins (above active): {}%", balanced_strategy::QUOTE_ALLOCATION_PCT);
    msg!("  Base bins (below active): {}%", balanced_strategy::BASE_ALLOCATION_PCT);
    msg!("  Active bin (mixed): {}%", balanced_strategy::ACTIVE_BIN_PCT);

    invoke_signed(
        &add_liquidity_ix,
        &[
            ctx.accounts.orbit_pool.to_account_info(),
            ctx.accounts.launch_authority.to_account_info(),
            ctx.accounts.token_vault.to_account_info(),
            ctx.accounts.curve_vault.to_account_info(),
            ctx.accounts.orbit_base_vault.to_account_info(),
            ctx.accounts.orbit_quote_vault.to_account_info(),
            ctx.accounts.orbit_position.to_account_info(),
            ctx.accounts.token_program.to_account_info(),
            ctx.accounts.orbit_bin_array.to_account_info(),
        ],
        signer_seeds,
    )?;
    
    // ========== LP Permanently Locked (Burned) ==========
    // The position is owned by launch_authority PDA. Since:
    // 1. Orbit positions are PDAs with owner baked into the address
    // 2. This program has NO withdraw instruction
    // 3. launch_authority can only sign via CPI from this program
    // The LP is effectively burned - liquidity is permanent and unwithdrawable.
    msg!("LP LOCKED - position owned by program PDA (permanently unwithdrawable)");

    // ========== Update State ==========

    launch.graduate(ctx.accounts.orbit_pool.key(), clock.unix_timestamp);
    config.record_graduation();

    // Emit event
    emit!(LaunchGraduated {
        launch: launch.key(),
        mint: launch.mint,
        orbit_pool: ctx.accounts.orbit_pool.key(),
        sol_liquidity: lp_sol_amount,
        token_liquidity: token_amount,
        final_price: current_price,
        active_bin_index,
        creator_reward: graduation::CREATOR_REWARD_LAMPORTS,
        treasury_fee: graduation::TREASURY_FEE_LAMPORTS,
        timestamp: clock.unix_timestamp,
    });

    msg!("🎓 Launch graduated to Orbit Finance!");
    msg!("Orbit pool: {}", ctx.accounts.orbit_pool.key());
    msg!("LP Liquidity: {} SOL + {} tokens",
        lp_sol_amount as f64 / 1e9,
        token_amount as f64 / 1e9
    );
    msg!("Strategy: Balanced 40/40/20 across {} bins", (num_bins_per_side * 2) + 1);
    msg!("Creator reward: {} SOL", graduation::CREATOR_REWARD_LAMPORTS as f64 / 1e9);
    msg!("Treasury fee: {} SOL", graduation::TREASURY_FEE_LAMPORTS as f64 / 1e9);
    msg!("LP LOCKED - position owned by program PDA (permanent liquidity)");

    Ok(())
}

/// Event emitted when a launch graduates
#[event]
pub struct LaunchGraduated {
    pub launch: Pubkey,
    pub mint: Pubkey,
    pub orbit_pool: Pubkey,
    /// SOL sent to LP (80 SOL)
    pub sol_liquidity: u64,
    /// Tokens sent to LP (20% of supply)
    pub token_liquidity: u64,
    pub final_price: u64,
    pub active_bin_index: i32,
    /// SOL reward sent to creator (2 SOL)
    pub creator_reward: u64,
    /// SOL fee sent to treasury (3 SOL)
    pub treasury_fee: u64,
    pub timestamp: i64,
}

// ============================================================================
// CPI Instruction Builders
// ============================================================================

/// Orbit init_pool discriminator
const INIT_POOL_DISCRIMINATOR: [u8; 8] = [116, 233, 199, 204, 115, 159, 171, 36];

/// Orbit init_pool_vaults discriminator
const INIT_POOL_VAULTS_DISCRIMINATOR: [u8; 8] = [209, 118, 61, 154, 158, 189, 162, 244];

/// Orbit create_bin_array discriminator
const CREATE_BIN_ARRAY_DISCRIMINATOR: [u8; 8] = [107, 26, 23, 62, 137, 213, 131, 235];

fn build_init_pool_instruction(
    orbit_program: &Pubkey,
    payer: &Pubkey,
    pool: &Pubkey,
    registry: &Pubkey,
    base_mint: &Pubkey,
    quote_mint: &Pubkey,
    initial_price_q64_64: u128,
    bin_step_bps: u16,
    base_fee_bps: u16,
    creator_fee_bps: u16,
) -> Instruction {
    let mut data = Vec::new();
    data.extend_from_slice(&INIT_POOL_DISCRIMINATOR);
    data.extend_from_slice(&initial_price_q64_64.to_le_bytes());
    data.extend_from_slice(&bin_step_bps.to_le_bytes());
    data.extend_from_slice(&base_fee_bps.to_le_bytes());
    data.extend_from_slice(&creator_fee_bps.to_le_bytes());
    data.push(1); // accounting_mode = 1 (position-bin shares)
    
    Instruction {
        program_id: *orbit_program,
        accounts: vec![
            AccountMeta::new(*payer, true),
            AccountMeta::new(*pool, false),
            AccountMeta::new(*registry, false),
            AccountMeta::new_readonly(*base_mint, false),
            AccountMeta::new_readonly(*quote_mint, false),
            AccountMeta::new_readonly(anchor_lang::solana_program::system_program::ID, false),
        ],
        data,
    }
}

fn build_init_vaults_instruction(
    orbit_program: &Pubkey,
    payer: &Pubkey,
    pool: &Pubkey,
    base_mint: &Pubkey,
    quote_mint: &Pubkey,
    base_vault: &Pubkey,
    quote_vault: &Pubkey,
    creator_fee_vault: &Pubkey,
    holders_fee_vault: &Pubkey,
    nft_fee_vault: &Pubkey,
    protocol_fee_vault: &Pubkey,
) -> Instruction {
    let mut data = Vec::new();
    data.extend_from_slice(&INIT_POOL_VAULTS_DISCRIMINATOR);
    
    Instruction {
        program_id: *orbit_program,
        accounts: vec![
            AccountMeta::new(*payer, true),
            AccountMeta::new(*pool, false),
            AccountMeta::new(*base_vault, false),
            AccountMeta::new(*quote_vault, false),
            AccountMeta::new(*creator_fee_vault, false),
            AccountMeta::new(*holders_fee_vault, false),
            AccountMeta::new(*nft_fee_vault, false),
            AccountMeta::new(*protocol_fee_vault, false),
            AccountMeta::new_readonly(*base_mint, false),
            AccountMeta::new_readonly(*quote_mint, false),
            AccountMeta::new_readonly(anchor_spl::token::ID, false),
            AccountMeta::new_readonly(anchor_lang::solana_program::system_program::ID, false),
        ],
        data,
    }
}

fn build_create_bin_array_instruction(
    orbit_program: &Pubkey,
    payer: &Pubkey,
    pool: &Pubkey,
    bin_array: &Pubkey,
    lower_bin_index: i32,
) -> Instruction {
    let mut data = Vec::new();
    data.extend_from_slice(&CREATE_BIN_ARRAY_DISCRIMINATOR);
    data.extend_from_slice(&lower_bin_index.to_le_bytes());

    Instruction {
        program_id: *orbit_program,
        accounts: vec![
            AccountMeta::new(*payer, true),
            AccountMeta::new(*pool, false),
            AccountMeta::new(*bin_array, false),
            AccountMeta::new_readonly(anchor_lang::solana_program::system_program::ID, false),
        ],
        data,
    }
}

/// Orbit init_position discriminator (verified from IDL)
const INIT_POSITION_DISCRIMINATOR: [u8; 8] = [197, 20, 10, 1, 97, 160, 177, 91];

/// Orbit add_liquidity_v2 discriminator (verified from IDL)
const ADD_LIQUIDITY_V2_DISCRIMINATOR: [u8; 8] = [126, 118, 210, 37, 80, 190, 19, 105];

fn build_init_position_instruction(
    orbit_program: &Pubkey,
    owner: &Pubkey,
    pool: &Pubkey,
    position: &Pubkey,
    nonce: u64,
) -> Instruction {
    let mut data = Vec::new();
    data.extend_from_slice(&INIT_POSITION_DISCRIMINATOR);
    data.extend_from_slice(&nonce.to_le_bytes());

    Instruction {
        program_id: *orbit_program,
        accounts: vec![
            AccountMeta::new(*owner, true),
            AccountMeta::new(*pool, false),
            AccountMeta::new(*position, false),
            AccountMeta::new_readonly(anchor_lang::solana_program::system_program::ID, false),
        ],
        data,
    }
}

/// Build add_liquidity_v2 instruction matching Orbit IDL
/// Account order: pool, owner, owner_base, owner_quote, base_vault, quote_vault, position, token_program
/// Bin arrays passed as remaining accounts
fn build_add_liquidity_v2_instruction(
    orbit_program: &Pubkey,
    pool: &Pubkey,
    owner: &Pubkey,
    owner_base: &Pubkey,   // Owner's base token account (source)
    owner_quote: &Pubkey,  // Owner's quote token account (source)
    base_vault: &Pubkey,   // Pool's base vault (destination)
    quote_vault: &Pubkey,  // Pool's quote vault (destination)
    position: &Pubkey,
    bin_arrays: &[Pubkey], // Remaining accounts for bin arrays
    bin_ids: &[i32],
    distribution: &[u64],
) -> Instruction {
    let mut data = Vec::new();
    data.extend_from_slice(&ADD_LIQUIDITY_V2_DISCRIMINATOR);

    // Encode bin_ids array
    data.extend_from_slice(&(bin_ids.len() as u32).to_le_bytes());
    for bin_id in bin_ids {
        data.extend_from_slice(&bin_id.to_le_bytes());
    }

    // Encode distribution array (liquidity shares per bin)
    data.extend_from_slice(&(distribution.len() as u32).to_le_bytes());
    for share in distribution {
        data.extend_from_slice(&share.to_le_bytes());
    }

    // Build accounts list matching IDL order
    let mut accounts = vec![
        AccountMeta::new(*pool, false),
        AccountMeta::new(*owner, true),
        AccountMeta::new(*owner_base, false),
        AccountMeta::new(*owner_quote, false),
        AccountMeta::new(*base_vault, false),
        AccountMeta::new(*quote_vault, false),
        AccountMeta::new(*position, false),
        AccountMeta::new_readonly(anchor_spl::token::ID, false),
    ];

    // Add bin arrays as remaining accounts
    for bin_array in bin_arrays {
        accounts.push(AccountMeta::new(*bin_array, false));
    }

    Instruction {
        program_id: *orbit_program,
        accounts,
        data,
    }
}

/// Calculate balanced liquidity distribution across bins
/// Returns (bin_ids, liquidity_shares) for 40/40/20 strategy
fn calculate_balanced_distribution(
    active_bin_index: i32,
    num_bins_per_side: u8,
    total_base_tokens: u64,
    total_quote_tokens: u64,
) -> (Vec<i32>, Vec<u64>) {
    let mut bin_ids = Vec::new();
    let mut distribution = Vec::new();

    // Total bins: bins below + active + bins above = (num_bins_per_side * 2) + 1

    // Calculate per-bin allocations based on 40/40/20 strategy
    // Base tokens go to bins below active price
    // Quote tokens go to bins above active price
    // Active bin gets mixed allocation

    let base_per_bin = if num_bins_per_side > 0 {
        (total_base_tokens as u128 * balanced_strategy::BASE_ALLOCATION_PCT as u128 / 100)
            / num_bins_per_side as u128
    } else { 0 };

    let quote_per_bin = if num_bins_per_side > 0 {
        (total_quote_tokens as u128 * balanced_strategy::QUOTE_ALLOCATION_PCT as u128 / 100)
            / num_bins_per_side as u128
    } else { 0 };

    let active_base = total_base_tokens as u128 * balanced_strategy::ACTIVE_BIN_PCT as u128 / 200;
    let active_quote = total_quote_tokens as u128 * balanced_strategy::ACTIVE_BIN_PCT as u128 / 200;

    // Bins below active price (base token only)
    for i in (1..=num_bins_per_side).rev() {
        let bin_id = active_bin_index - (i as i32);
        bin_ids.push(bin_id);
        distribution.push(base_per_bin as u64);
    }

    // Active bin (mixed base + quote)
    bin_ids.push(active_bin_index);
    distribution.push((active_base + active_quote) as u64);

    // Bins above active price (quote token only)
    for i in 1..=num_bins_per_side {
        let bin_id = active_bin_index + (i as i32);
        bin_ids.push(bin_id);
        distribution.push(quote_per_bin as u64);
    }

    (bin_ids, distribution)
}
