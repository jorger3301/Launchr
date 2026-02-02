//! Launchr - Token Launch State
//! 
//! State management for individual token launches on the bonding curve.

use anchor_lang::prelude::*;

/// Status of a token launch
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, Debug)]
pub enum LaunchStatus {
    /// Actively trading on bonding curve
    Active,
    /// Graduation threshold reached, awaiting migration
    PendingGraduation,
    /// Successfully migrated to Orbit Finance DLMM
    Graduated,
    /// Launch was cancelled by creator
    Cancelled,
}

impl Default for LaunchStatus {
    fn default() -> Self {
        LaunchStatus::Active
    }
}

/// Token launch account - represents a single token on the bonding curve
#[account]
pub struct Launch {
    /// Token mint address
    pub mint: Pubkey,
    
    /// Creator of the launch
    pub creator: Pubkey,
    
    /// Current status
    pub status: LaunchStatus,
    
    // ========== Token Supply ==========
    
    /// Total token supply (1 billion with 9 decimals)
    pub total_supply: u64,
    
    /// Tokens sold through bonding curve
    pub tokens_sold: u64,
    
    /// Tokens reserved for graduation liquidity
    pub graduation_tokens: u64,
    
    /// Tokens allocated to creator
    pub creator_tokens: u64,
    
    // ========== Bonding Curve State ==========
    
    /// Virtual SOL reserve (for pricing)
    pub virtual_sol_reserve: u64,
    
    /// Virtual token reserve (for pricing)
    pub virtual_token_reserve: u64,
    
    /// Real SOL collected in curve vault
    pub real_sol_reserve: u64,
    
    /// Real tokens remaining in token vault
    pub real_token_reserve: u64,
    
    // ========== Thresholds ==========
    
    /// SOL amount to trigger graduation
    pub graduation_threshold: u64,
    
    // ========== Timestamps ==========
    
    /// Unix timestamp of creation
    pub created_at: i64,
    
    /// Unix timestamp of graduation (0 if not graduated)
    pub graduated_at: i64,
    
    // ========== Statistics ==========
    
    /// Total buy volume in lamports
    pub buy_volume: u128,
    
    /// Total sell volume in lamports
    pub sell_volume: u128,
    
    /// Total number of trades
    pub trade_count: u64,
    
    /// Number of unique holders (approximate)
    pub holder_count: u32,
    
    // ========== Orbit Integration ==========
    
    /// Orbit pool address after graduation
    pub orbit_pool: Pubkey,
    
    // ========== Fees ==========
    
    /// Creator's fee in basis points
    pub creator_fee_bps: u16,
    
    // ========== Metadata ==========
    
    /// Token name (max 32 chars)
    pub name: [u8; 32],
    
    /// Token symbol (max 10 chars)
    pub symbol: [u8; 10],
    
    /// Metadata URI (max 200 chars)
    pub uri: [u8; 200],
    
    /// Twitter handle (max 64 chars)
    pub twitter: [u8; 64],
    
    /// Telegram group (max 64 chars)
    pub telegram: [u8; 64],
    
    /// Website URL (max 64 chars)
    pub website: [u8; 64],
    
    // ========== PDA ==========
    
    /// Bump seed
    pub bump: u8,
    
    /// Launch authority bump
    pub authority_bump: u8,
    
    /// Reserved for future use
    pub _reserved: [u8; 32],
}

impl Launch {
    /// Account space calculation
    pub const LEN: usize = 8 +  // discriminator
        32 +    // mint
        32 +    // creator
        1 +     // status
        8 +     // total_supply
        8 +     // tokens_sold
        8 +     // graduation_tokens
        8 +     // creator_tokens
        8 +     // virtual_sol_reserve
        8 +     // virtual_token_reserve
        8 +     // real_sol_reserve
        8 +     // real_token_reserve
        8 +     // graduation_threshold
        8 +     // created_at
        8 +     // graduated_at
        16 +    // buy_volume
        16 +    // sell_volume
        8 +     // trade_count
        4 +     // holder_count
        32 +    // orbit_pool
        2 +     // creator_fee_bps
        32 +    // name
        10 +    // symbol
        200 +   // uri
        64 +    // twitter
        64 +    // telegram
        64 +    // website
        1 +     // bump
        1 +     // authority_bump
        32;     // reserved
    
    /// Check if launch is active and tradeable
    pub fn is_tradeable(&self) -> bool {
        self.status == LaunchStatus::Active
    }
    
    /// Check if launch can graduate
    pub fn can_graduate(&self) -> bool {
        self.status == LaunchStatus::Active || self.status == LaunchStatus::PendingGraduation
    }
    
    /// Check if graduation threshold is reached
    pub fn threshold_reached(&self) -> bool {
        self.real_sol_reserve >= self.graduation_threshold
    }
    
    /// Get current price in lamports per token (scaled by 1e9)
    pub fn current_price(&self) -> u64 {
        if self.virtual_token_reserve == 0 {
            return 0;
        }
        // price = sol_reserve / token_reserve * 1e9
        ((self.virtual_sol_reserve as u128 * 1_000_000_000) / self.virtual_token_reserve as u128) as u64
    }
    
    /// Get market cap in lamports
    pub fn market_cap(&self) -> u64 {
        let price = self.current_price();
        // market_cap = price * total_supply / 1e9 (to adjust for price scaling)
        ((price as u128 * self.total_supply as u128) / 1_000_000_000) as u64
    }
    
    /// Record a buy transaction
    pub fn record_buy(&mut self, tokens_out: u64, sol_in: u64) {
        self.tokens_sold = self.tokens_sold.saturating_add(tokens_out);
        self.real_sol_reserve = self.real_sol_reserve.saturating_add(sol_in);
        self.real_token_reserve = self.real_token_reserve.saturating_sub(tokens_out);
        self.buy_volume = self.buy_volume.saturating_add(sol_in as u128);
        self.trade_count = self.trade_count.saturating_add(1);
        
        // Update virtual reserves
        self.virtual_sol_reserve = self.virtual_sol_reserve.saturating_add(sol_in);
        self.virtual_token_reserve = self.virtual_token_reserve.saturating_sub(tokens_out);
        
        // Check graduation
        if self.threshold_reached() && self.status == LaunchStatus::Active {
            self.status = LaunchStatus::PendingGraduation;
        }
    }
    
    /// Record a sell transaction
    pub fn record_sell(&mut self, tokens_in: u64, sol_out: u64) {
        self.tokens_sold = self.tokens_sold.saturating_sub(tokens_in);
        self.real_sol_reserve = self.real_sol_reserve.saturating_sub(sol_out);
        self.real_token_reserve = self.real_token_reserve.saturating_add(tokens_in);
        self.sell_volume = self.sell_volume.saturating_add(sol_out as u128);
        self.trade_count = self.trade_count.saturating_add(1);
        
        // Update virtual reserves
        self.virtual_sol_reserve = self.virtual_sol_reserve.saturating_sub(sol_out);
        self.virtual_token_reserve = self.virtual_token_reserve.saturating_add(tokens_in);
    }
    
    /// Mark as graduated
    pub fn graduate(&mut self, orbit_pool: Pubkey, timestamp: i64) {
        self.status = LaunchStatus::Graduated;
        self.orbit_pool = orbit_pool;
        self.graduated_at = timestamp;
    }
    
    /// Get name as string
    pub fn name_str(&self) -> String {
        String::from_utf8_lossy(&self.name)
            .trim_end_matches('\0')
            .to_string()
    }
    
    /// Get symbol as string
    pub fn symbol_str(&self) -> String {
        String::from_utf8_lossy(&self.symbol)
            .trim_end_matches('\0')
            .to_string()
    }
}

/// Token allocation constants
pub mod allocation {
    /// Total supply: 1 billion tokens with 9 decimals
    pub const TOTAL_SUPPLY: u64 = 1_000_000_000_000_000_000;

    /// Bonding curve allocation: 80%
    pub const CURVE_BPS: u16 = 8000;

    /// LP reserve allocation: 20% (for Orbit DLMM migration)
    pub const LP_RESERVE_BPS: u16 = 2000;

    /// Calculate bonding curve tokens (80%)
    pub fn curve_tokens() -> u64 {
        (TOTAL_SUPPLY as u128 * CURVE_BPS as u128 / 10000) as u64
    }

    /// Calculate LP reserve tokens (20%)
    pub fn lp_reserve_tokens() -> u64 {
        (TOTAL_SUPPLY as u128 * LP_RESERVE_BPS as u128 / 10000) as u64
    }
}

/// Graduation SOL distribution constants
pub mod graduation {
    /// SOL sent to Orbit DLMM LP (80 SOL)
    pub const LP_SOL_LAMPORTS: u64 = 80_000_000_000;

    /// SOL reward to token creator (2 SOL)
    pub const CREATOR_REWARD_LAMPORTS: u64 = 2_000_000_000;

    /// SOL fee to Launchr treasury (3 SOL)
    pub const TREASURY_FEE_LAMPORTS: u64 = 3_000_000_000;

    /// Total graduation threshold (must equal LP + Creator + Treasury)
    pub const GRADUATION_THRESHOLD: u64 = 85_000_000_000;
}

/// Initial bonding curve parameters
pub mod curve_params {
    /// Initial virtual SOL reserve (30 SOL)
    pub const INITIAL_VIRTUAL_SOL: u64 = 30_000_000_000;
    
    /// Initial virtual token reserve (800M tokens)
    pub const INITIAL_VIRTUAL_TOKENS: u64 = 800_000_000_000_000_000;
    
    /// Initial k value (constant product)
    pub fn initial_k() -> u128 {
        INITIAL_VIRTUAL_SOL as u128 * INITIAL_VIRTUAL_TOKENS as u128
    }
}

impl Default for Launch {
    fn default() -> Self {
        Self {
            mint: Pubkey::default(),
            creator: Pubkey::default(),
            status: LaunchStatus::default(),
            total_supply: 0,
            tokens_sold: 0,
            graduation_tokens: 0,
            creator_tokens: 0,
            virtual_sol_reserve: 0,
            virtual_token_reserve: 0,
            real_sol_reserve: 0,
            real_token_reserve: 0,
            graduation_threshold: 0,
            created_at: 0,
            graduated_at: 0,
            buy_volume: 0,
            sell_volume: 0,
            trade_count: 0,
            holder_count: 0,
            orbit_pool: Pubkey::default(),
            creator_fee_bps: 0,
            name: [0u8; 32],
            symbol: [0u8; 10],
            uri: [0u8; 200],
            twitter: [0u8; 64],
            telegram: [0u8; 64],
            website: [0u8; 64],
            bump: 0,
            authority_bump: 0,
            _reserved: [0u8; 32],
        }
    }
}
