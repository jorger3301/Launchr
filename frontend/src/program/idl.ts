/**
 * Launchr Program IDL Types
 *
 * TypeScript types matching the Anchor program structure.
 * Generated manually from program source - run `anchor build` for full IDL.
 */

import { PublicKey } from '@solana/web3.js';
import BN from 'bn.js';

/** Safely convert BN to number without throwing on values > 2^53 */
function safeToNumber(bn: BN): number {
  try {
    return bn.toNumber();
  } catch {
    return parseFloat(bn.toString());
  }
}

// =============================================================================
// PROGRAM ID
// =============================================================================

// Default program ID - will be replaced with actual deployed ID
export const LAUNCHR_PROGRAM_ID = new PublicKey(
  process.env.REACT_APP_PROGRAM_ID || '11111111111111111111111111111111'
);

// =============================================================================
// SEEDS
// =============================================================================

export const SEEDS = {
  CONFIG: Buffer.from('launchr_config'),
  LAUNCH: Buffer.from('launch'),
  CURVE_VAULT: Buffer.from('curve_vault'),
  TOKEN_VAULT: Buffer.from('token_vault'),
  USER_POSITION: Buffer.from('user_position'),
  LAUNCH_AUTHORITY: Buffer.from('launch_authority'),
  FEE_VAULT: Buffer.from('fee_vault'),
  GRADUATION_VAULT: Buffer.from('graduation_vault'),
} as const;

// =============================================================================
// ENUMS
// =============================================================================

export enum LaunchStatus {
  Active = 0,
  PendingGraduation = 1,
  Graduated = 2,
  Cancelled = 3,
}

// =============================================================================
// ACCOUNT TYPES
// =============================================================================

export interface ConfigAccount {
  admin: PublicKey;
  feeAuthority: PublicKey;
  protocolFeeBps: number;
  graduationThreshold: BN;
  quoteMint: PublicKey;
  orbitProgramId: PublicKey;
  defaultBinStepBps: number;
  defaultBaseFeeBps: number;
  launchesPaused: boolean;
  tradingPaused: boolean;
  totalLaunches: BN;
  totalGraduations: BN;
  totalVolumeLamports: BN;
  totalFeesCollected: BN;
  bump: number;
}

export interface LaunchAccount {
  mint: PublicKey;
  creator: PublicKey;
  status: LaunchStatus;
  totalSupply: BN;
  tokensSold: BN;
  graduationTokens: BN;
  creatorTokens: BN;
  virtualSolReserve: BN;
  virtualTokenReserve: BN;
  realSolReserve: BN;
  realTokenReserve: BN;
  graduationThreshold: BN;
  createdAt: BN;
  graduatedAt: BN;
  buyVolume: BN;
  sellVolume: BN;
  tradeCount: BN;
  holderCount: number;
  orbitPool: PublicKey;
  creatorFeeBps: number;
  name: number[];
  symbol: number[];
  uri: number[];
  twitter: number[];
  telegram: number[];
  website: number[];
  bump: number;
  authorityBump: number;
}

export interface UserPositionAccount {
  launch: PublicKey;
  user: PublicKey;
  tokensBought: BN;
  tokensSold: BN;
  tokenBalance: BN;
  solSpent: BN;
  solReceived: BN;
  firstTradeAt: BN;
  lastTradeAt: BN;
  buyCount: number;
  sellCount: number;
  avgBuyPrice: BN;
  costBasis: BN;
  bump: number;
}

// =============================================================================
// INSTRUCTION PARAMS
// =============================================================================

export interface CreateLaunchParams {
  name: string;
  symbol: string;
  uri: string;
  twitter: string | null;
  telegram: string | null;
  website: string | null;
  creatorFeeBps: number;
}

export interface BuyParams {
  solAmount: BN;
  minTokensOut: BN;
}

export interface SellParams {
  tokenAmount: BN;
  minSolOut: BN;
}

export interface GraduateParams {
  binStepBps: number | null;
  numLiquidityBins: number | null;
}

// =============================================================================
// CONSTANTS
// =============================================================================

export const CONSTANTS = {
  // Token allocation
  TOTAL_SUPPLY: new BN('1000000000000000000'), // 1B tokens with 9 decimals
  CURVE_TOKENS: new BN('800000000000000000'),  // 80%
  LP_RESERVE_TOKENS: new BN('200000000000000000'), // 20%

  // Bonding curve initial state
  INITIAL_VIRTUAL_SOL: new BN('30000000000'), // 30 SOL
  INITIAL_VIRTUAL_TOKENS: new BN('800000000000000000'), // 800M tokens

  // Graduation
  GRADUATION_THRESHOLD: new BN('85000000000'), // 85 SOL
  LP_SOL_LAMPORTS: new BN('80000000000'), // 80 SOL to LP
  CREATOR_REWARD_LAMPORTS: new BN('2000000000'), // 2 SOL
  TREASURY_FEE_LAMPORTS: new BN('3000000000'), // 3 SOL

  // Fees
  DEFAULT_PROTOCOL_FEE_BPS: 100, // 1% total fee
  CREATOR_FEE_BPS: 20, // 0.2% - fixed creator earnings (from the 1% total)
  TREASURY_FEE_BPS: 80, // 0.8% - treasury portion (from the 1% total)
} as const;

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Parse bytes to string (trim null bytes)
 */
export function bytesToString(bytes: number[]): string {
  const nonZeroBytes = bytes.filter((b, i) => b !== 0 || bytes.slice(0, i).some(x => x !== 0));
  const lastNonZero = nonZeroBytes.findIndex(b => b === 0);
  const trimmed = lastNonZero === -1 ? nonZeroBytes : nonZeroBytes.slice(0, lastNonZero);
  return Buffer.from(trimmed).toString('utf-8');
}

/**
 * Calculate current price from reserves
 */
export function calculatePrice(virtualSolReserve: BN, virtualTokenReserve: BN): number {
  if (virtualTokenReserve.isZero()) return 0;
  // Use BN multiplication to preserve precision for large reserve values
  // price = sol / tokens, scaled by 1e9 then back to avoid precision loss
  const SCALE = new BN(1_000_000_000);
  const scaledPrice = virtualSolReserve.mul(SCALE).div(virtualTokenReserve);
  return safeToNumber(scaledPrice) / 1_000_000_000;
}

/**
 * Calculate market cap
 */
export function calculateMarketCap(price: number, totalSupply: BN): number {
  // totalSupply is in base units (9 decimals); divide by 1e9 to get whole tokens
  const supplyInTokens = safeToNumber(totalSupply.div(new BN(1_000_000_000)));
  return price * supplyInTokens;
}
