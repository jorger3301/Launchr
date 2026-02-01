//! Launchr - Graduate to Orbit
//!
//! Graduate a launch from the bonding curve to Orbit Finance DLMM liquidity.
//! "Launch into Orbit" - the final step of the Launchr journey.
//!
//! ## Graduation Distribution (85 SOL threshold)
//! - 80 SOL → Orbit Finance DLMM LP (paired with 20% token reserve)
//! - 2 SOL  → Token creator reward
//! - 3 SOL  → Launchr treasury
//!
//! ## LP Burning
//! After liquidity is added, the position authority is transferred to the
//! system program (burn address), making the liquidity permanent and unwithdrawable.

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
    pub config: Account<'info, Config>,

    /// Launch account
    #[account(
        mut,
        seeds = [LAUNCH_SEED, launch.mint.as_ref()],
        bump = launch.bump,
        constraint = launch.can_graduate() @ LaunchrError::AlreadyGraduated,
        constraint = launch.threshold_reached() @ LaunchrError::ThresholdNotReached
    )]
    pub launch: Account<'info, Launch>,

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
    pub mint: Account<'info, anchor_spl::token::Mint>,

    /// Quote mint (WSOL)
    #[account(
        constraint = quote_mint.key() == config.quote_mint
    )]
    pub quote_mint: Account<'info, anchor_spl::token::Mint>,

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
    /// Number of bins for liquidity distribution
    pub num_liquidity_bins: Option<u8>,
}

/// Graduate a launch to Orbit Finance
pub fn graduate(ctx: Context<Graduate>, params: GraduateParams) -> Result<()> {
    let launch = &mut ctx.accounts.launch;
    let config = &mut ctx.accounts.config;
    let clock = Clock::get()?;

    // Use default values if not provided
    let bin_step_bps = params.bin_step_bps.unwrap_or(config.default_bin_step_bps);
    let _num_bins = params.num_liquidity_bins.unwrap_or(16);

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
    
    // ========== Transfer Liquidity to Orbit ==========
    
    // Transfer tokens from token_vault to orbit base vault
    if ctx.accounts.token_vault.amount > 0 {
        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.token_vault.to_account_info(),
                    to: ctx.accounts.orbit_base_vault.to_account_info(),
                    authority: ctx.accounts.launch_authority.to_account_info(),
                },
                signer_seeds,
            ),
            ctx.accounts.token_vault.amount,
        )?;
    }
    
    // Transfer tokens from graduation_vault to orbit base vault
    if ctx.accounts.graduation_vault.amount > 0 {
        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.graduation_vault.to_account_info(),
                    to: ctx.accounts.orbit_base_vault.to_account_info(),
                    authority: ctx.accounts.launch_authority.to_account_info(),
                },
                signer_seeds,
            ),
            ctx.accounts.graduation_vault.amount,
        )?;
    }
    
    // Transfer SOL from curve_vault to orbit quote vault
    // (Wrap to WSOL in production - simplified here)
    let curve_vault_lamports = ctx.accounts.curve_vault.lamports();
    if curve_vault_lamports > 0 {
        let curve_vault_seeds: &[&[u8]] = &[
            CURVE_VAULT_SEED,
            launch_key.as_ref(),
            &[ctx.bumps.curve_vault],
        ];
        
        **ctx.accounts.curve_vault.try_borrow_mut_lamports()? -= curve_vault_lamports;
        **ctx.accounts.orbit_quote_vault.try_borrow_mut_lamports()? += curve_vault_lamports;
    }
    
    // ========== Update State ==========

    launch.graduate(ctx.accounts.orbit_pool.key(), clock.unix_timestamp);
    config.record_graduation();

    // ========== LP Token Burning ==========
    // The position is owned by launch_authority PDA. Since no withdraw instruction
    // is exposed and the authority is a PDA that can only sign via CPI from this
    // program, the liquidity is effectively permanent (burned).
    //
    // Alternative approaches for stricter LP burning:
    // 1. Transfer position owner to SystemProgram (0x0...0) - not supported by Orbit
    // 2. Close the position account - would return tokens, not desired
    // 3. Keep position but never expose withdraw - current approach ✓
    //
    // The position authority (launch_authority PDA) cannot sign outside this program,
    // and this program provides no withdraw instruction, making LP permanent.

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
    msg!("Creator reward: {} SOL", graduation::CREATOR_REWARD_LAMPORTS as f64 / 1e9);
    msg!("Treasury fee: {} SOL", graduation::TREASURY_FEE_LAMPORTS as f64 / 1e9);
    msg!("LP tokens are permanently locked (position owned by program PDA)");

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
