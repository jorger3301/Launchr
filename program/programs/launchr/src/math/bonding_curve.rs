//! Launchr - Bonding Curve Mathematics
//! 
//! Constant product AMM (x * y = k) calculations for the bonding curve.

use anchor_lang::prelude::*;

/// Price precision multiplier (1e9)
pub const PRICE_PRECISION: u64 = 1_000_000_000;

/// Basis points denominator
pub const BPS_DENOMINATOR: u64 = 10_000;

/// Minimum trade amount (1000 lamports = 0.000001 SOL)
pub const MIN_TRADE_AMOUNT: u64 = 1_000;

/// Result of a swap calculation
#[derive(Debug, Clone, Copy, Default)]
pub struct SwapResult {
    /// Amount of output tokens/SOL
    pub amount_out: u64,
    /// Protocol fee taken
    pub protocol_fee: u64,
    /// Creator fee taken
    pub creator_fee: u64,
    /// Total fee taken
    pub total_fee: u64,
    /// New SOL reserve after swap
    pub new_sol_reserve: u64,
    /// New token reserve after swap
    pub new_token_reserve: u64,
    /// Price after swap (lamports per token * PRICE_PRECISION)
    pub price_after: u64,
    /// Price impact in basis points
    pub price_impact_bps: u64,
}

/// Calculate tokens received for SOL input (buy)
///
/// Formula: tokens_out = token_reserve - k / (sol_reserve + sol_in_after_fee)
///
/// # Arguments
/// * `sol_in` - Amount of SOL being spent (lamports)
/// * `sol_reserve` - Current virtual SOL reserve
/// * `token_reserve` - Current virtual token reserve
/// * `protocol_fee_bps` - Total protocol fee in basis points (1% = 100 bps)
/// * `creator_fee_bps` - Creator's share of protocol fee (fixed at 0.2% = 20 bps)
///
/// # Fee Structure
/// Total fee is always `protocol_fee_bps` (1%). Creator receives 0.2%,
/// with the remaining 0.8% going to the Launchr treasury.
pub fn calculate_buy(
    sol_in: u64,
    sol_reserve: u64,
    token_reserve: u64,
    protocol_fee_bps: u16,
    creator_fee_bps: u16,
) -> Result<SwapResult> {
    require!(sol_in >= MIN_TRADE_AMOUNT, LaunchrError::TradeTooSmall);
    require!(sol_reserve > 0 && token_reserve > 0, LaunchrError::InvalidReserves);

    // Calculate fees - creator fee comes FROM protocol fee, not added to it
    // Total fee = protocol_fee_bps (1% = 100 bps)
    // Creator gets 0.2% (20 bps) - fixed
    // Treasury gets 0.8% (80 bps)
    let total_fee = (sol_in as u128 * protocol_fee_bps as u128 / BPS_DENOMINATOR as u128) as u64;
    let creator_fee = (sol_in as u128 * creator_fee_bps as u128 / BPS_DENOMINATOR as u128) as u64;
    let protocol_fee = total_fee.saturating_sub(creator_fee); // Treasury portion
    
    // SOL after fee deduction
    let sol_in_after_fee = sol_in.saturating_sub(total_fee);
    require!(sol_in_after_fee > 0, LaunchrError::TradeTooSmall);
    
    // Constant product: k = sol_reserve * token_reserve
    let k = (sol_reserve as u128) * (token_reserve as u128);
    
    // New SOL reserve
    let new_sol_reserve = sol_reserve.saturating_add(sol_in_after_fee);
    
    // New token reserve: k / new_sol_reserve
    let new_token_reserve = (k / new_sol_reserve as u128) as u64;
    
    // Tokens out
    let tokens_out = token_reserve.saturating_sub(new_token_reserve);
    require!(tokens_out > 0, LaunchrError::InsufficientOutput);
    require!(tokens_out <= token_reserve, LaunchrError::InsufficientLiquidity);
    
    // Calculate price after swap
    let price_after = calculate_price(new_sol_reserve, new_token_reserve);
    
    // Calculate price impact
    let price_before = calculate_price(sol_reserve, token_reserve);
    let price_impact_bps = if price_before > 0 {
        ((price_after as i128 - price_before as i128).unsigned_abs() * BPS_DENOMINATOR as u128 / price_before as u128) as u64
    } else {
        0
    };
    
    Ok(SwapResult {
        amount_out: tokens_out,
        protocol_fee,
        creator_fee,
        total_fee,
        new_sol_reserve,
        new_token_reserve,
        price_after,
        price_impact_bps,
    })
}

/// Calculate SOL received for token input (sell)
/// 
/// Formula: sol_out = sol_reserve - k / (token_reserve + tokens_in)
/// 
/// # Arguments
/// * `tokens_in` - Amount of tokens being sold
/// * `sol_reserve` - Current virtual SOL reserve
/// * `token_reserve` - Current virtual token reserve
/// * `protocol_fee_bps` - Protocol fee in basis points
/// * `creator_fee_bps` - Creator fee in basis points
pub fn calculate_sell(
    tokens_in: u64,
    sol_reserve: u64,
    token_reserve: u64,
    protocol_fee_bps: u16,
    creator_fee_bps: u16,
) -> Result<SwapResult> {
    require!(tokens_in > 0, LaunchrError::TradeTooSmall);
    require!(sol_reserve > 0 && token_reserve > 0, LaunchrError::InvalidReserves);
    
    // Constant product: k = sol_reserve * token_reserve
    let k = (sol_reserve as u128) * (token_reserve as u128);
    
    // New token reserve
    let new_token_reserve = token_reserve.saturating_add(tokens_in);
    
    // New SOL reserve: k / new_token_reserve
    let new_sol_reserve = (k / new_token_reserve as u128) as u64;
    
    // SOL out before fees
    let sol_out_before_fee = sol_reserve.saturating_sub(new_sol_reserve);
    require!(sol_out_before_fee > 0, LaunchrError::InsufficientOutput);
    require!(sol_out_before_fee <= sol_reserve, LaunchrError::InsufficientLiquidity);
    
    // Calculate fees - creator fee comes FROM protocol fee, not added to it
    // Total fee = protocol_fee_bps (1% = 100 bps)
    // Creator gets 0.2% (20 bps) - fixed
    // Treasury gets 0.8% (80 bps)
    let total_fee = (sol_out_before_fee as u128 * protocol_fee_bps as u128 / BPS_DENOMINATOR as u128) as u64;
    let creator_fee = (sol_out_before_fee as u128 * creator_fee_bps as u128 / BPS_DENOMINATOR as u128) as u64;
    let protocol_fee = total_fee.saturating_sub(creator_fee); // Treasury portion
    
    // SOL out after fees
    let sol_out = sol_out_before_fee.saturating_sub(total_fee);
    require!(sol_out >= MIN_TRADE_AMOUNT, LaunchrError::TradeTooSmall);
    
    // Calculate price after swap
    let price_after = calculate_price(new_sol_reserve, new_token_reserve);
    
    // Calculate price impact
    let price_before = calculate_price(sol_reserve, token_reserve);
    let price_impact_bps = if price_before > 0 {
        ((price_before as i128 - price_after as i128).unsigned_abs() * BPS_DENOMINATOR as u128 / price_before as u128) as u64
    } else {
        0
    };
    
    Ok(SwapResult {
        amount_out: sol_out,
        protocol_fee,
        creator_fee,
        total_fee,
        new_sol_reserve,
        new_token_reserve,
        price_after,
        price_impact_bps,
    })
}

/// Calculate current price (lamports per token * PRICE_PRECISION)
pub fn calculate_price(sol_reserve: u64, token_reserve: u64) -> u64 {
    if token_reserve == 0 {
        return 0;
    }
    ((sol_reserve as u128 * PRICE_PRECISION as u128) / token_reserve as u128) as u64
}

/// Calculate SOL needed for exact token output
pub fn calculate_sol_for_tokens(
    tokens_out: u64,
    sol_reserve: u64,
    token_reserve: u64,
    protocol_fee_bps: u16,
    _creator_fee_bps: u16,
) -> Result<u64> {
    require!(tokens_out > 0 && tokens_out < token_reserve, LaunchrError::InvalidAmount);
    require!(sol_reserve > 0 && token_reserve > 0, LaunchrError::InvalidReserves);
    
    // k = sol_reserve * token_reserve
    let k = (sol_reserve as u128) * (token_reserve as u128);
    
    // new_token_reserve = token_reserve - tokens_out
    let new_token_reserve = token_reserve.saturating_sub(tokens_out);
    require!(new_token_reserve > 0, LaunchrError::InsufficientLiquidity);
    
    // new_sol_reserve = k / new_token_reserve
    let new_sol_reserve = (k / new_token_reserve as u128) as u64;
    
    // sol_in_after_fee = new_sol_reserve - sol_reserve
    let sol_in_after_fee = new_sol_reserve.saturating_sub(sol_reserve);
    
    // sol_in = sol_in_after_fee / (1 - fee_rate)
    // Total fee is just protocol_fee_bps (creator fee comes from it, not added)
    let sol_in = (sol_in_after_fee as u128 * BPS_DENOMINATOR as u128 / (BPS_DENOMINATOR - protocol_fee_bps as u64) as u128) as u64;
    
    Ok(sol_in.saturating_add(1)) // Add 1 for rounding
}

/// Calculate tokens received for exact SOL input
pub fn calculate_tokens_for_sol(
    sol_in: u64,
    sol_reserve: u64,
    token_reserve: u64,
    protocol_fee_bps: u16,
    creator_fee_bps: u16,
) -> Result<u64> {
    let result = calculate_buy(sol_in, sol_reserve, token_reserve, protocol_fee_bps, creator_fee_bps)?;
    Ok(result.amount_out)
}

/// Custom error codes
#[error_code]
pub enum LaunchrError {
    #[msg("Trade amount is too small")]
    TradeTooSmall,
    #[msg("Invalid reserves")]
    InvalidReserves,
    #[msg("Insufficient output amount")]
    InsufficientOutput,
    #[msg("Insufficient liquidity")]
    InsufficientLiquidity,
    #[msg("Invalid amount")]
    InvalidAmount,
    #[msg("Slippage exceeded")]
    SlippageExceeded,
    #[msg("Launch not active")]
    LaunchNotActive,
    #[msg("Launch already graduated")]
    AlreadyGraduated,
    #[msg("Graduation threshold not reached")]
    ThresholdNotReached,
    #[msg("Unauthorized")]
    Unauthorized,
    #[msg("Invalid configuration")]
    InvalidConfig,
    #[msg("Launches are paused")]
    LaunchesPaused,
    #[msg("Trading is paused")]
    TradingPaused,
    #[msg("Math overflow")]
    MathOverflow,
    #[msg("Invalid mint order for Orbit pool")]
    InvalidMintOrder,
    #[msg("Invalid creator address")]
    InvalidCreator,
    #[msg("Invalid treasury address")]
    InvalidTreasury,
    #[msg("Insufficient SOL for graduation distribution")]
    InsufficientGraduationFunds,
}

#[cfg(test)]
mod tests {
    use super::*;
    
    const SOL_RESERVE: u64 = 30_000_000_000; // 30 SOL
    const TOKEN_RESERVE: u64 = 800_000_000_000_000_000; // 800M tokens
    const PROTOCOL_FEE: u16 = 100; // 1%
    const CREATOR_FEE: u16 = 0;
    
    #[test]
    fn test_buy_calculation() {
        let result = calculate_buy(
            1_000_000_000, // 1 SOL
            SOL_RESERVE,
            TOKEN_RESERVE,
            PROTOCOL_FEE,
            CREATOR_FEE,
        ).unwrap();
        
        // Should get roughly 25.6M tokens for 1 SOL at initial price
        assert!(result.amount_out > 25_000_000_000_000_000);
        assert!(result.amount_out < 27_000_000_000_000_000);
        
        // Fee should be 1%
        assert_eq!(result.total_fee, 10_000_000); // 0.01 SOL
        
        // Reserves should be updated
        assert!(result.new_sol_reserve > SOL_RESERVE);
        assert!(result.new_token_reserve < TOKEN_RESERVE);
    }
    
    #[test]
    fn test_sell_calculation() {
        let tokens_to_sell = 25_000_000_000_000_000u64; // 25M tokens
        
        let result = calculate_sell(
            tokens_to_sell,
            SOL_RESERVE,
            TOKEN_RESERVE,
            PROTOCOL_FEE,
            CREATOR_FEE,
        ).unwrap();
        
        // Should get roughly 0.9 SOL for 25M tokens
        assert!(result.amount_out > 800_000_000);
        assert!(result.amount_out < 1_000_000_000);
    }
    
    #[test]
    fn test_price_calculation() {
        let price = calculate_price(SOL_RESERVE, TOKEN_RESERVE);
        
        // Price should be ~0.0000000375 SOL per token
        // Scaled by 1e9: 37.5
        assert!(price > 30);
        assert!(price < 50);
    }
    
    #[test]
    fn test_k_constant() {
        let sol_in = 5_000_000_000u64; // 5 SOL
        
        let result = calculate_buy(
            sol_in,
            SOL_RESERVE,
            TOKEN_RESERVE,
            PROTOCOL_FEE,
            CREATOR_FEE,
        ).unwrap();
        
        // k should remain constant (within rounding)
        let k_before = SOL_RESERVE as u128 * TOKEN_RESERVE as u128;
        let k_after = result.new_sol_reserve as u128 * result.new_token_reserve as u128;
        
        // Allow 0.1% deviation for rounding
        let deviation = if k_after > k_before {
            k_after - k_before
        } else {
            k_before - k_after
        };
        let max_deviation = k_before / 1000;
        assert!(deviation < max_deviation);
    }
}
