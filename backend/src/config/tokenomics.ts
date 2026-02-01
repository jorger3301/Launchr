/**
 * Launchr Tokenomics Configuration
 *
 * Official protocol parameters for the Launchr bonding curve launchpad.
 */

// =============================================================================
// TOKEN SUPPLY DISTRIBUTION
// =============================================================================

/** Total token supply per launch (1 billion with 9 decimals) */
export const TOTAL_SUPPLY = 1_000_000_000_000_000_000n;

/** Tokens sold on bonding curve (80% of total supply) */
export const BONDING_CURVE_SUPPLY = 800_000_000_000_000_000n;

/** Tokens reserved for LP migration (20% of total supply) */
export const LP_RESERVE_SUPPLY = 200_000_000_000_000_000n;

// =============================================================================
// BONDING CURVE PARAMETERS
// =============================================================================

/** SOL required to complete bonding curve and trigger graduation (85 SOL) */
export const GRADUATION_THRESHOLD_LAMPORTS = 85_000_000_000n;

/** Virtual SOL reserve for initial pricing (30 SOL) */
export const VIRTUAL_SOL_RESERVE = 30_000_000_000n;

/** Virtual token reserve equals bonding curve supply */
export const VIRTUAL_TOKEN_RESERVE = BONDING_CURVE_SUPPLY;

// =============================================================================
// PLATFORM FEES
// =============================================================================

/** Platform fee on all trades: 1% (100 basis points) */
export const PLATFORM_FEE_BPS = 100;

/** Platform fee as decimal for calculations */
export const PLATFORM_FEE_RATE = 0.01;

// =============================================================================
// GRADUATION DISTRIBUTION
// =============================================================================

/**
 * When a token graduates (bonding curve reaches 85 SOL):
 * - 80 SOL → Orbit Finance DLMM LP (paired with 20% token reserve)
 * - 2 SOL  → Token creator reward
 * - 3 SOL  → Launchr treasury
 *
 * LP TOKEN BURNING:
 * After liquidity is added to Orbit DLMM, the LP position is permanently locked.
 * The position is owned by the launch_authority PDA which can only sign via CPI
 * from the Launchr program. Since no withdraw instruction is exposed, the
 * liquidity cannot be removed, effectively "burning" the LP tokens.
 */

/** SOL sent to LP on graduation (80 SOL) */
export const LP_SOL_AMOUNT_LAMPORTS = 80_000_000_000n;

/** SOL reward to token creator on graduation (2 SOL) */
export const CREATOR_REWARD_LAMPORTS = 2_000_000_000n;

/** SOL fee to Launchr treasury on graduation (3 SOL) */
export const TREASURY_FEE_LAMPORTS = 3_000_000_000n;

// =============================================================================
// VALIDATION
// =============================================================================

// Ensure graduation distribution adds up correctly
const GRADUATION_TOTAL =
  LP_SOL_AMOUNT_LAMPORTS + CREATOR_REWARD_LAMPORTS + TREASURY_FEE_LAMPORTS;

if (GRADUATION_TOTAL !== GRADUATION_THRESHOLD_LAMPORTS) {
  throw new Error(
    `Graduation distribution (${GRADUATION_TOTAL}) must equal threshold (${GRADUATION_THRESHOLD_LAMPORTS})`
  );
}

// Ensure token distribution adds up correctly
const TOKEN_TOTAL = BONDING_CURVE_SUPPLY + LP_RESERVE_SUPPLY;

if (TOKEN_TOTAL !== TOTAL_SUPPLY) {
  throw new Error(
    `Token distribution (${TOKEN_TOTAL}) must equal total supply (${TOTAL_SUPPLY})`
  );
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/** Calculate bonding curve progress (0-100%) */
export function calculateProgress(realSolReserve: bigint): number {
  return Number((realSolReserve * 100n) / GRADUATION_THRESHOLD_LAMPORTS);
}

/** Calculate 1% platform fee for a trade amount */
export function calculatePlatformFee(tradeAmountLamports: bigint): bigint {
  return (tradeAmountLamports * BigInt(PLATFORM_FEE_BPS)) / 10000n;
}

/** Check if launch is ready for graduation */
export function isReadyForGraduation(realSolReserve: bigint): boolean {
  return realSolReserve >= GRADUATION_THRESHOLD_LAMPORTS;
}
