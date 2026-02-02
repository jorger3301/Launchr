//! # Launchr
//! 
//! **Launch into Orbit** 🚀
//! 
//! Bonding curve token launches that graduate into Orbit Finance DLMM liquidity.
//! 
//! ## Overview
//! 
//! Launchr is a permissionless token launchpad on Solana that uses a constant-product
//! bonding curve for initial price discovery. When sufficient liquidity accumulates,
//! launches automatically graduate to Orbit Finance's concentrated liquidity pools.
//! 
//! ## Key Features
//! 
//! - **Fair Launch**: Anyone can create a token with transparent pricing
//! - **Bonding Curve**: Constant product (x*y=k) ensures predictable pricing
//! - **Automatic Graduation**: Launches migrate to Orbit DLMM when threshold reached
//! - **Fee Distribution**: Protocol + creator fees with Orbit holder rewards
//! 
//! ## Token Allocation
//! 
//! - 2% to Creator (immediate)
//! - 80% to Bonding Curve (for trading)
//! - 18% Reserved for Graduation Liquidity
//! 
//! ## Program Flow
//! 
//! 1. Creator calls `create_launch` with token metadata
//! 2. Users buy/sell on bonding curve via `buy`/`sell`
//! 3. When threshold reached, anyone can call `graduate`
//! 4. Liquidity migrates to Orbit Finance DLMM
//! 5. Trading continues on Orbit with concentrated liquidity
//! 
//! ## Architecture
//! 
//! ```text
//! programs/launchr/src/
//! ├── lib.rs              # Program entry point
//! ├── seeds.rs            # All PDA seeds
//! ├── state/              # Account structures
//! │   ├── config.rs       # Global configuration
//! │   ├── launch.rs       # Individual launch state
//! │   └── user_position.rs # User trading positions
//! ├── math/               # Calculations
//! │   ├── bonding_curve.rs # AMM math
//! │   └── orbit_math.rs   # DLMM graduation math
//! └── instructions/       # Program instructions
//!     ├── init_config.rs  # Initialize protocol
//!     ├── create_launch.rs # Create new launch
//!     ├── buy.rs          # Buy tokens
//!     ├── sell.rs         # Sell tokens
//!     └── graduate.rs     # Graduate to Orbit
//! ```

use anchor_lang::prelude::*;

pub mod seeds;
pub mod state;
pub mod math;
pub mod instructions;

use instructions::*;

declare_id!("AD9VheLMqVPwbDQc5CmSHmCZdfa8CGmr2xXmhhNSTyhK");

/// Launchr Program - Launch into Orbit
#[program]
pub mod launchr {
    use super::*;

    /// Initialize the global Launchr configuration
    /// 
    /// This must be called once by the protocol deployer to set up
    /// the global configuration including fees, thresholds, and Orbit integration.
    /// 
    /// # Arguments
    /// * `ctx` - Initialize config context
    /// * `params` - Configuration parameters
    pub fn init_config(ctx: Context<InitConfig>, params: InitConfigParams) -> Result<()> {
        instructions::init_config::init_config(ctx, params)
    }

    /// Update configuration parameters
    /// 
    /// Allows the admin to update protocol parameters such as fees,
    /// graduation thresholds, and pause states.
    /// 
    /// # Arguments
    /// * `ctx` - Update config context  
    /// * `params` - New configuration values
    pub fn update_config(ctx: Context<UpdateConfig>, params: UpdateConfigParams) -> Result<()> {
        instructions::init_config::update_config(ctx, params)
    }

    /// Transfer admin authority to a new account
    /// 
    /// # Arguments
    /// * `ctx` - Transfer admin context
    pub fn transfer_admin(ctx: Context<TransferAdmin>) -> Result<()> {
        instructions::init_config::transfer_admin(ctx)
    }

    /// Create a new token launch on the bonding curve
    /// 
    /// Creates a new SPL token, allocates supply (2% creator, 80% curve, 18% graduation),
    /// and initializes the bonding curve for trading.
    /// 
    /// # Arguments
    /// * `ctx` - Create launch context
    /// * `params` - Launch parameters (name, symbol, uri, socials, fees)
    pub fn create_launch(ctx: Context<CreateLaunch>, params: CreateLaunchParams) -> Result<()> {
        instructions::create_launch::create_launch(ctx, params)
    }

    /// Buy tokens from the bonding curve
    /// 
    /// Executes a buy order using SOL. The bonding curve uses constant product
    /// pricing (x * y = k). Includes slippage protection via min_tokens_out.
    /// 
    /// # Arguments
    /// * `ctx` - Buy context
    /// * `params` - Buy parameters (sol_amount, min_tokens_out)
    pub fn buy(ctx: Context<Buy>, params: BuyParams) -> Result<()> {
        instructions::buy::buy(ctx, params)
    }

    /// Sell tokens back to the bonding curve
    /// 
    /// Executes a sell order returning tokens for SOL. Includes slippage
    /// protection via min_sol_out.
    /// 
    /// # Arguments
    /// * `ctx` - Sell context
    /// * `params` - Sell parameters (token_amount, min_sol_out)
    pub fn sell(ctx: Context<Sell>, params: SellParams) -> Result<()> {
        instructions::sell::sell(ctx, params)
    }

    /// Graduate a launch to Orbit Finance DLMM
    /// 
    /// Migrates a launch from the bonding curve to Orbit Finance concentrated
    /// liquidity. Can be called by anyone once the graduation threshold is reached.
    /// 
    /// The graduation process:
    /// 1. Creates Orbit pool with canonical mint ordering
    /// 2. Initializes all pool vaults (base, quote, fee vaults)
    /// 3. Creates bin array at the current price
    /// 4. Transfers all liquidity to Orbit vaults
    /// 
    /// # Arguments
    /// * `ctx` - Graduate context
    /// * `params` - Graduation parameters (bin_step, num_bins)
    pub fn graduate(ctx: Context<Graduate>, params: GraduateParams) -> Result<()> {
        instructions::graduate::graduate(ctx, params)
    }
}
