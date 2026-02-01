//! Launchr Global Configuration
//! 
//! Protocol-wide settings and statistics.

use anchor_lang::prelude::*;

/// Global configuration account for the Launchr protocol
#[account]
#[derive(Default)]
pub struct Config {
    /// Admin authority - can update config and pause launches
    pub admin: Pubkey,
    
    /// Fee authority - receives protocol fees
    pub fee_authority: Pubkey,
    
    /// Protocol fee in basis points (e.g., 100 = 1%)
    pub protocol_fee_bps: u16,
    
    /// SOL amount (in lamports) required to graduate to Orbit
    pub graduation_threshold: u64,
    
    /// Quote mint for Orbit pools (WSOL or USDC)
    pub quote_mint: Pubkey,
    
    /// Orbit Finance program ID for CPI
    pub orbit_program_id: Pubkey,
    
    /// Default bin step for graduated Orbit pools (in BPS)
    pub default_bin_step_bps: u16,
    
    /// Default base fee for Orbit pools (in BPS)
    pub default_base_fee_bps: u16,
    
    /// Whether new launches are paused
    pub launches_paused: bool,
    
    /// Whether trading is paused globally
    pub trading_paused: bool,
    
    // ========== Statistics ==========
    
    /// Total number of launches created
    pub total_launches: u64,
    
    /// Total number of successful graduations
    pub total_graduations: u64,
    
    /// Total trading volume in lamports
    pub total_volume_lamports: u128,
    
    /// Total protocol fees collected in lamports
    pub total_fees_collected: u64,
    
    /// Bump seed for PDA
    pub bump: u8,
    
    /// Reserved for future use
    pub _reserved: [u8; 64],
}

impl Config {
    /// Account space calculation
    pub const LEN: usize = 8 +  // discriminator
        32 +    // admin
        32 +    // fee_authority
        2 +     // protocol_fee_bps
        8 +     // graduation_threshold
        32 +    // quote_mint
        32 +    // orbit_program_id
        2 +     // default_bin_step_bps
        2 +     // default_base_fee_bps
        1 +     // launches_paused
        1 +     // trading_paused
        8 +     // total_launches
        8 +     // total_graduations
        16 +    // total_volume_lamports
        8 +     // total_fees_collected
        1 +     // bump
        64;     // reserved
    
    /// Initialize a new config
    pub fn init(
        &mut self,
        admin: Pubkey,
        fee_authority: Pubkey,
        protocol_fee_bps: u16,
        graduation_threshold: u64,
        quote_mint: Pubkey,
        orbit_program_id: Pubkey,
        default_bin_step_bps: u16,
        default_base_fee_bps: u16,
        bump: u8,
    ) -> Result<()> {
        self.admin = admin;
        self.fee_authority = fee_authority;
        self.protocol_fee_bps = protocol_fee_bps;
        self.graduation_threshold = graduation_threshold;
        self.quote_mint = quote_mint;
        self.orbit_program_id = orbit_program_id;
        self.default_bin_step_bps = default_bin_step_bps;
        self.default_base_fee_bps = default_base_fee_bps;
        self.launches_paused = false;
        self.trading_paused = false;
        self.total_launches = 0;
        self.total_graduations = 0;
        self.total_volume_lamports = 0;
        self.total_fees_collected = 0;
        self.bump = bump;
        Ok(())
    }
    
    /// Record a new launch
    pub fn record_launch(&mut self) {
        self.total_launches = self.total_launches.saturating_add(1);
    }
    
    /// Record a graduation
    pub fn record_graduation(&mut self) {
        self.total_graduations = self.total_graduations.saturating_add(1);
    }
    
    /// Record volume and fees
    pub fn record_trade(&mut self, volume: u64, protocol_fee: u64) {
        self.total_volume_lamports = self.total_volume_lamports.saturating_add(volume as u128);
        self.total_fees_collected = self.total_fees_collected.saturating_add(protocol_fee);
    }
}

/// Default configuration values
pub mod defaults {
    /// Default protocol fee: 1% (100 basis points)
    pub const PROTOCOL_FEE_BPS: u16 = 100;
    
    /// Default graduation threshold: 85 SOL
    pub const GRADUATION_THRESHOLD: u64 = 85_000_000_000; // 85 SOL in lamports
    
    /// Default Orbit bin step: 25 BPS (0.25%)
    pub const BIN_STEP_BPS: u16 = 25;
    
    /// Default Orbit base fee: 30 BPS (0.30%)
    pub const BASE_FEE_BPS: u16 = 30;
    
    /// WSOL mint address
    pub const WSOL_MINT: &str = "So11111111111111111111111111111111111111112";
}
