//! Launchr - Orbit Finance DLMM Mathematics
//! 
//! Calculations for graduating launches to Orbit Finance concentrated liquidity.

use anchor_lang::prelude::*;

/// Q64.64 fixed-point multiplier (2^64)
pub const Q64_64: u128 = 1 << 64;

/// Q128 fixed-point multiplier (2^128)
pub const Q128: u128 = 1 << 128;

/// Number of bins per BinArray
pub const BIN_ARRAY_SIZE: i32 = 64;

/// Maximum bins for seed liquidity distribution
pub const MAX_SEED_BINS: usize = 32;

/// Natural log of 1.0001 * 2^64 (for bin calculations)
pub const LN_1_0001_Q64: u128 = 18446743936270598144;

/// Bin deposit for liquidity seeding
#[derive(Debug, Clone, Copy, Default)]
pub struct BinDeposit {
    /// Bin index
    pub bin_index: i32,
    /// Token amount to deposit
    pub token_amount: u64,
    /// SOL amount to deposit
    pub sol_amount: u64,
}

/// Orbit fee configuration for graduated pools
#[derive(Debug, Clone, Copy)]
pub struct OrbitFeeConfig {
    /// Split to CIPHER holders (microbps, 300000 = 30%)
    pub split_holders_microbps: u32,
    /// Split to NFT holders (microbps, 200000 = 20%)
    pub split_nft_microbps: u32,
    /// Extra split to creator (microbps)
    pub split_creator_extra_microbps: u32,
    /// Base fee in basis points
    pub base_fee_bps: u16,
    /// Creator cut in basis points
    pub creator_cut_bps: u16,
    /// Dynamic fee enabled
    pub dynamic_fee_enabled: bool,
    /// Max dynamic fee in basis points
    pub max_dynamic_fee_bps: u16,
}

impl Default for OrbitFeeConfig {
    fn default() -> Self {
        Self {
            split_holders_microbps: 300_000,   // 30% to CIPHER holders
            split_nft_microbps: 200_000,       // 20% to NFT holders
            split_creator_extra_microbps: 0,
            base_fee_bps: 30,                  // 0.30% base fee
            creator_cut_bps: 0,
            dynamic_fee_enabled: true,
            max_dynamic_fee_bps: 100,          // Max 1% dynamic fee
        }
    }
}

/// Convert price (lamports per token) to Q64.64 fixed-point
/// 
/// # Arguments
/// * `price_lamports_per_token` - Price scaled by PRICE_PRECISION (1e9)
/// * `token_decimals` - Token decimal places (usually 9)
pub fn price_to_q64_64(price_lamports_per_token: u64, token_decimals: u8) -> u128 {
    // price_q64 = price * 2^64 / 10^9 (adjust for price precision)
    // Also adjust for decimal difference if needed
    let decimal_adjustment = 10u128.pow(token_decimals as u32);
    (price_lamports_per_token as u128 * Q64_64) / (1_000_000_000 * decimal_adjustment / 1_000_000_000)
}

/// Convert Q64.64 price back to lamports per token
pub fn q64_64_to_price(price_q64_64: u128, token_decimals: u8) -> u64 {
    let decimal_adjustment = 10u128.pow(token_decimals as u32);
    ((price_q64_64 * 1_000_000_000 * decimal_adjustment / 1_000_000_000) / Q64_64) as u64
}

/// Calculate bin index from Q64.64 price
/// 
/// bin_index = log(price) / log(1 + bin_step)
/// 
/// # Arguments
/// * `price_q64_64` - Price in Q64.64 format
/// * `bin_step_bps` - Bin step in basis points (e.g., 25 = 0.25%)
pub fn price_to_bin_index(price_q64_64: u128, bin_step_bps: u16) -> i32 {
    if price_q64_64 == 0 {
        return i32::MIN;
    }
    
    // bin_index = ln(price) / ln(1 + bin_step)
    // Using integer approximation
    
    let ln_price = integer_ln(price_q64_64);
    let ln_step = integer_ln_step(bin_step_bps);
    
    if ln_step == 0 {
        return 0;
    }
    
    (ln_price as i64 / ln_step as i64) as i32
}

/// Calculate Q64.64 price from bin index
/// 
/// price = (1 + bin_step)^bin_index
pub fn bin_index_to_price(bin_index: i32, bin_step_bps: u16) -> u128 {
    // (1 + step)^index where step = bin_step_bps / 10000
    // In Q64.64: (Q64 + Q64 * step / 10000)^index
    
    let one_plus_step = Q64_64 + (Q64_64 * bin_step_bps as u128 / 10000);
    
    if bin_index >= 0 {
        pow_q64(one_plus_step, bin_index as u32)
    } else {
        // For negative index: 1 / (1 + step)^|index|
        let denominator = pow_q64(one_plus_step, (-bin_index) as u32);
        if denominator == 0 {
            return 0;
        }
        (Q64_64 * Q64_64) / denominator
    }
}

/// Get the lower bin index for a BinArray (aligned to 64-bin boundary)
pub fn get_bin_array_lower_index(bin_index: i32) -> i32 {
    // Round down to nearest multiple of 64
    if bin_index >= 0 {
        (bin_index / BIN_ARRAY_SIZE) * BIN_ARRAY_SIZE
    } else {
        // For negative: -65 should give -128, -1 should give -64
        ((bin_index - BIN_ARRAY_SIZE + 1) / BIN_ARRAY_SIZE) * BIN_ARRAY_SIZE
    }
}

/// Get the offset within a BinArray for a bin index
pub fn get_bin_array_offset(bin_index: i32, lower_bin_index: i32) -> u32 {
    (bin_index - lower_bin_index) as u32
}

/// Distribution parameters for seed liquidity
#[derive(Debug, Clone)]
pub struct SeedDistributionParams {
    /// Total tokens to distribute
    pub total_tokens: u64,
    /// Total SOL to distribute
    pub total_sol: u64,
    /// Active bin index (current price)
    pub active_bin_index: i32,
    /// Number of bins to use
    pub num_bins: u8,
    /// Bin step in BPS
    pub bin_step_bps: u16,
}

/// Calculate seed liquidity distribution across bins
/// 
/// Distributes liquidity to create depth around the current price:
/// - Bins below active: More tokens (asks)
/// - Active bin: Mixed tokens + SOL
/// - Bins above active: More SOL (bids)
pub fn calculate_seed_distribution(params: SeedDistributionParams) -> Vec<BinDeposit> {
    let mut deposits = Vec::with_capacity(params.num_bins as usize);
    
    if params.num_bins == 0 {
        return deposits;
    }
    
    // Distribute across bins centered on active bin
    let half_bins = params.num_bins as i32 / 2;
    let start_bin = params.active_bin_index - half_bins;
    
    // Calculate weights for distribution (triangular around center)
    let mut total_weight: u64 = 0;
    let mut weights: Vec<u64> = Vec::new();
    
    for i in 0..params.num_bins as i32 {
        let distance = (i - half_bins).unsigned_abs() as u64;
        let weight = (params.num_bins as u64).saturating_sub(distance);
        weights.push(weight);
        total_weight = total_weight.saturating_add(weight);
    }
    
    if total_weight == 0 {
        return deposits;
    }
    
    // Distribute liquidity
    for i in 0..params.num_bins as i32 {
        let bin_index = start_bin + i;
        let weight = weights[i as usize];
        
        // Determine token/SOL split based on position relative to active bin
        let (token_amount, sol_amount) = if bin_index < params.active_bin_index {
            // Below active: mostly tokens (sell orders)
            let tokens = (params.total_tokens as u128 * weight as u128 / total_weight as u128) as u64;
            (tokens, 0u64)
        } else if bin_index > params.active_bin_index {
            // Above active: mostly SOL (buy orders)
            let sol = (params.total_sol as u128 * weight as u128 / total_weight as u128) as u64;
            (0u64, sol)
        } else {
            // Active bin: split 50/50
            let tokens = (params.total_tokens as u128 * weight as u128 / total_weight as u128 / 2) as u64;
            let sol = (params.total_sol as u128 * weight as u128 / total_weight as u128 / 2) as u64;
            (tokens, sol)
        };
        
        if token_amount > 0 || sol_amount > 0 {
            deposits.push(BinDeposit {
                bin_index,
                token_amount,
                sol_amount,
            });
        }
    }
    
    deposits
}

/// Create fee configuration for graduated pool
pub fn create_graduation_fee_config(creator_fee_bps: u16) -> OrbitFeeConfig {
    OrbitFeeConfig {
        split_holders_microbps: 300_000,   // 30% to CIPHER holders
        split_nft_microbps: 200_000,       // 20% to NFT holders
        split_creator_extra_microbps: 0,
        base_fee_bps: 30,                  // 0.30% base fee
        creator_cut_bps: creator_fee_bps,
        dynamic_fee_enabled: true,
        max_dynamic_fee_bps: 100,
    }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/// Integer natural logarithm approximation for Q64.64 values
fn integer_ln(value: u128) -> i128 {
    if value <= Q64_64 {
        // value < 1, negative ln
        let inverse = (Q64_64 * Q64_64) / value;
        return -(integer_ln_positive(inverse) as i128);
    }
    integer_ln_positive(value) as i128
}

/// Natural log for values >= Q64.64 (i.e., >= 1.0)
fn integer_ln_positive(value: u128) -> u128 {
    // Use bit manipulation for fast log approximation
    // ln(x) ≈ (leading_zeros_diff) * ln(2)
    
    let leading_zeros = value.leading_zeros();
    let bit_position = 127 - leading_zeros;
    
    // ln(2) in Q64.64 ≈ 12786308645202655660
    const LN_2_Q64: u128 = 12786308645202655660;
    
    // Approximate: ln(value) ≈ (bit_position - 64) * ln(2)
    if bit_position >= 64 {
        (bit_position as u128 - 64) * LN_2_Q64
    } else {
        0
    }
}

/// Natural log of (1 + bin_step) scaled
fn integer_ln_step(bin_step_bps: u16) -> u128 {
    // ln(1 + x) ≈ x for small x
    // For bin_step_bps, x = bin_step_bps / 10000
    // Scaled by Q64.64
    (Q64_64 * bin_step_bps as u128) / 10000
}

/// Power function for Q64.64 values
fn pow_q64(base: u128, exp: u32) -> u128 {
    if exp == 0 {
        return Q64_64;
    }
    if exp == 1 {
        return base;
    }
    
    let mut result = Q64_64;
    let mut b = base;
    let mut e = exp;
    
    while e > 0 {
        if e & 1 == 1 {
            result = (result * b) / Q64_64;
        }
        b = (b * b) / Q64_64;
        e >>= 1;
    }
    
    result
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_bin_array_lower_index() {
        assert_eq!(get_bin_array_lower_index(0), 0);
        assert_eq!(get_bin_array_lower_index(1), 0);
        assert_eq!(get_bin_array_lower_index(63), 0);
        assert_eq!(get_bin_array_lower_index(64), 64);
        assert_eq!(get_bin_array_lower_index(65), 64);
        assert_eq!(get_bin_array_lower_index(-1), -64);
        assert_eq!(get_bin_array_lower_index(-64), -64);
        assert_eq!(get_bin_array_lower_index(-65), -128);
    }
    
    #[test]
    fn test_bin_index_to_price_roundtrip() {
        let bin_step = 25u16; // 0.25%
        
        for bin in [-100, -50, 0, 50, 100].iter() {
            let price = bin_index_to_price(*bin, bin_step);
            let recovered_bin = price_to_bin_index(price, bin_step);
            
            // Should be within 1 bin due to rounding
            assert!((recovered_bin - bin).abs() <= 1);
        }
    }
    
    #[test]
    fn test_seed_distribution() {
        let params = SeedDistributionParams {
            total_tokens: 100_000_000_000, // 100 tokens
            total_sol: 10_000_000_000,     // 10 SOL
            active_bin_index: 1000,
            num_bins: 10,
            bin_step_bps: 25,
        };
        
        let deposits = calculate_seed_distribution(params);
        
        // Should have deposits
        assert!(!deposits.is_empty());
        
        // Bins below active should have tokens
        let below_active: Vec<_> = deposits.iter()
            .filter(|d| d.bin_index < 1000)
            .collect();
        assert!(below_active.iter().all(|d| d.token_amount > 0 || d.sol_amount == 0));
        
        // Bins above active should have SOL
        let above_active: Vec<_> = deposits.iter()
            .filter(|d| d.bin_index > 1000)
            .collect();
        assert!(above_active.iter().all(|d| d.sol_amount > 0 || d.token_amount == 0));
    }
}
