//! Launchr - All PDA Seeds
//! 
//! Centralized seed definitions for all program-derived addresses.
//! Launch into Orbit - Bonding curve launches that graduate to Orbit Finance DLMM.

use anchor_lang::prelude::*;

// ============================================================================
// LAUNCHR SEEDS
// ============================================================================

/// Global configuration seed
pub const CONFIG_SEED: &[u8] = b"launchr_config";

/// Launch account seed - [LAUNCH_SEED, mint]
pub const LAUNCH_SEED: &[u8] = b"launch";

/// SOL vault for bonding curve - [CURVE_VAULT_SEED, launch]
pub const CURVE_VAULT_SEED: &[u8] = b"curve_vault";

/// Token vault for bonding curve - [TOKEN_VAULT_SEED, launch]
pub const TOKEN_VAULT_SEED: &[u8] = b"token_vault";

/// User position for a specific launch - [USER_POSITION_SEED, launch, user]
pub const USER_POSITION_SEED: &[u8] = b"user_position";

/// Launch authority PDA for token operations - [LAUNCH_AUTHORITY_SEED, launch]
pub const LAUNCH_AUTHORITY_SEED: &[u8] = b"launch_authority";

/// Protocol fee vault - [FEE_VAULT_SEED, config]
pub const FEE_VAULT_SEED: &[u8] = b"fee_vault";

/// Graduation reserve vault - [GRADUATION_VAULT_SEED, launch]
pub const GRADUATION_VAULT_SEED: &[u8] = b"graduation_vault";

// ============================================================================
// ORBIT FINANCE SEEDS (for graduation CPI)
// ============================================================================

/// Orbit pool seed - [ORBIT_POOL_SEED, base_mint, quote_mint]
/// Note: base_mint < quote_mint (canonical ordering)
pub const ORBIT_POOL_SEED: &[u8] = b"pool";

/// Orbit registry seed - [ORBIT_REGISTRY_SEED, base_mint, quote_mint]
pub const ORBIT_REGISTRY_SEED: &[u8] = b"registry";

/// Orbit vault seed - [ORBIT_VAULT_SEED, pool, vault_type]
/// vault_type: "base", "quote", "creator_fee", "holders_fee", "nft_fee", "protocol_fee"
pub const ORBIT_VAULT_SEED: &[u8] = b"vault";

/// Orbit position seed - [ORBIT_POSITION_SEED, pool, owner, nonce]
pub const ORBIT_POSITION_SEED: &[u8] = b"position";

/// Orbit position bin seed - [ORBIT_POSITION_BIN_SEED, position, bin_index]
pub const ORBIT_POSITION_BIN_SEED: &[u8] = b"position_bin";

/// Orbit bin array seed - [ORBIT_BIN_ARRAY_SEED, pool, lower_bin_index]
pub const ORBIT_BIN_ARRAY_SEED: &[u8] = b"bin_array";

// ============================================================================
// LAUNCHR PDA DERIVATION HELPERS
// ============================================================================

/// Derive the global config PDA
pub fn derive_config(program_id: &Pubkey) -> (Pubkey, u8) {
    Pubkey::find_program_address(&[CONFIG_SEED], program_id)
}

/// Derive a launch PDA from the token mint
pub fn derive_launch(mint: &Pubkey, program_id: &Pubkey) -> (Pubkey, u8) {
    Pubkey::find_program_address(&[LAUNCH_SEED, mint.as_ref()], program_id)
}

/// Derive the SOL curve vault for a launch
pub fn derive_curve_vault(launch: &Pubkey, program_id: &Pubkey) -> (Pubkey, u8) {
    Pubkey::find_program_address(&[CURVE_VAULT_SEED, launch.as_ref()], program_id)
}

/// Derive the token vault for a launch
pub fn derive_token_vault(launch: &Pubkey, program_id: &Pubkey) -> (Pubkey, u8) {
    Pubkey::find_program_address(&[TOKEN_VAULT_SEED, launch.as_ref()], program_id)
}

/// Derive a user's position for a launch
pub fn derive_user_position(
    launch: &Pubkey,
    user: &Pubkey,
    program_id: &Pubkey,
) -> (Pubkey, u8) {
    Pubkey::find_program_address(
        &[USER_POSITION_SEED, launch.as_ref(), user.as_ref()],
        program_id,
    )
}

/// Derive the launch authority PDA for token operations
pub fn derive_launch_authority(launch: &Pubkey, program_id: &Pubkey) -> (Pubkey, u8) {
    Pubkey::find_program_address(&[LAUNCH_AUTHORITY_SEED, launch.as_ref()], program_id)
}

/// Derive the protocol fee vault
pub fn derive_fee_vault(config: &Pubkey, program_id: &Pubkey) -> (Pubkey, u8) {
    Pubkey::find_program_address(&[FEE_VAULT_SEED, config.as_ref()], program_id)
}

/// Derive the graduation token reserve vault
pub fn derive_graduation_vault(launch: &Pubkey, program_id: &Pubkey) -> (Pubkey, u8) {
    Pubkey::find_program_address(&[GRADUATION_VAULT_SEED, launch.as_ref()], program_id)
}

// ============================================================================
// ORBIT FINANCE PDA DERIVATION HELPERS
// ============================================================================

/// Orbit Finance Program ID
pub const ORBIT_PROGRAM_ID: &str = "Fn3fA3fjsmpULNL7E9U79jKTe1KHxPtQeWdURCbJXCnM";

/// Get the Orbit Finance program ID
pub fn orbit_program_id() -> Pubkey {
    ORBIT_PROGRAM_ID.parse().expect("Invalid Orbit program ID constant")
}

/// Derive an Orbit pool PDA
/// IMPORTANT: Mints must be in canonical order (smaller pubkey first)
pub fn derive_orbit_pool(base_mint: &Pubkey, quote_mint: &Pubkey) -> (Pubkey, u8) {
    let orbit_id = orbit_program_id();
    let (mint_a, mint_b) = canonical_pair(base_mint, quote_mint);
    Pubkey::find_program_address(
        &[ORBIT_POOL_SEED, mint_a.as_ref(), mint_b.as_ref()],
        &orbit_id,
    )
}

/// Derive an Orbit registry PDA
pub fn derive_orbit_registry(base_mint: &Pubkey, quote_mint: &Pubkey) -> (Pubkey, u8) {
    let orbit_id = orbit_program_id();
    let (mint_a, mint_b) = canonical_pair(base_mint, quote_mint);
    Pubkey::find_program_address(
        &[ORBIT_REGISTRY_SEED, mint_a.as_ref(), mint_b.as_ref()],
        &orbit_id,
    )
}

/// Orbit vault types
pub mod orbit_vault_types {
    pub const BASE: &[u8] = b"base";
    pub const QUOTE: &[u8] = b"quote";
    pub const CREATOR_FEE: &[u8] = b"creator_fee";
    pub const HOLDERS_FEE: &[u8] = b"holders_fee";
    pub const NFT_FEE: &[u8] = b"nft_fee";
    pub const PROTOCOL_FEE: &[u8] = b"protocol_fee";
}

/// Derive an Orbit vault PDA
pub fn derive_orbit_vault(pool: &Pubkey, vault_type: &[u8]) -> (Pubkey, u8) {
    let orbit_id = orbit_program_id();
    Pubkey::find_program_address(&[ORBIT_VAULT_SEED, pool.as_ref(), vault_type], &orbit_id)
}

/// Derive an Orbit position PDA
pub fn derive_orbit_position(pool: &Pubkey, owner: &Pubkey, nonce: u64) -> (Pubkey, u8) {
    let orbit_id = orbit_program_id();
    Pubkey::find_program_address(
        &[
            ORBIT_POSITION_SEED,
            pool.as_ref(),
            owner.as_ref(),
            &nonce.to_le_bytes(),
        ],
        &orbit_id,
    )
}

/// Derive an Orbit bin array PDA
pub fn derive_orbit_bin_array(pool: &Pubkey, lower_bin_index: i32) -> (Pubkey, u8) {
    let orbit_id = orbit_program_id();
    Pubkey::find_program_address(
        &[
            ORBIT_BIN_ARRAY_SEED,
            pool.as_ref(),
            &lower_bin_index.to_le_bytes(),
        ],
        &orbit_id,
    )
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/// Returns mints in canonical order (smaller pubkey first)
/// Required for Orbit Finance pool derivation
pub fn canonical_pair(mint_a: &Pubkey, mint_b: &Pubkey) -> (Pubkey, Pubkey) {
    if mint_a.to_bytes() < mint_b.to_bytes() {
        (*mint_a, *mint_b)
    } else {
        (*mint_b, *mint_a)
    }
}

/// Check if mints are in canonical order
pub fn is_canonical_order(base_mint: &Pubkey, quote_mint: &Pubkey) -> bool {
    base_mint.to_bytes() < quote_mint.to_bytes()
}

/// Get the correct base/quote assignment for Orbit pool
/// Returns (base_for_orbit, quote_for_orbit, is_inverted)
/// is_inverted: true if the original base became quote in Orbit
pub fn get_orbit_mint_assignment(
    token_mint: &Pubkey,
    sol_mint: &Pubkey,
) -> (Pubkey, Pubkey, bool) {
    let (base, quote) = canonical_pair(token_mint, sol_mint);
    let is_inverted = base != *token_mint;
    (base, quote, is_inverted)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_canonical_ordering() {
        let mint_a = Pubkey::new_unique();
        let mint_b = Pubkey::new_unique();
        
        let (first, second) = canonical_pair(&mint_a, &mint_b);
        assert!(first.to_bytes() < second.to_bytes());
        
        // Order should be consistent regardless of input order
        let (first2, second2) = canonical_pair(&mint_b, &mint_a);
        assert_eq!(first, first2);
        assert_eq!(second, second2);
    }

    #[test]
    fn test_is_canonical_order() {
        let small = Pubkey::new_from_array([0u8; 32]);
        let large = Pubkey::new_from_array([255u8; 32]);
        
        assert!(is_canonical_order(&small, &large));
        assert!(!is_canonical_order(&large, &small));
    }
}
