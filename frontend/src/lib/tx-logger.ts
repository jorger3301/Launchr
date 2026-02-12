/**
 * Transaction Logger & Error Classifier
 *
 * Structured logging for all Launchr transactions.
 * Error classification maps Anchor error codes and common Solana
 * failure patterns into actionable buckets.
 */

import type { SimulatedTransactionResponse } from '@solana/web3.js';

// =============================================================================
// ERROR BUCKETS
// =============================================================================

export type ErrorBucket =
  | 'blockhash_expired'
  | 'rpc_rate_limit'
  | 'slippage'
  | 'missing_rent_or_ata'
  | 'compute_budget'
  | 'account_ordering'
  | 'program_state'
  | 'invalid_input'
  | 'already_done'
  | 'auth'
  | 'wallet_rejected'
  | 'network'
  | 'unknown';

export interface ClassifiedError {
  bucket: ErrorBucket;
  code?: number;
  name?: string;
  userMessage: string;
  retryable: boolean;
  raw: string;
}

// =============================================================================
// ANCHOR ERROR CODES (base 6000)
// =============================================================================

interface AnchorErrorInfo {
  name: string;
  message: string;
  bucket: ErrorBucket;
  retryable: boolean;
  userMessage: string;
}

const LAUNCHR_ERROR_CODES: Record<number, AnchorErrorInfo> = {
  6000: { name: 'TradeTooSmall', message: 'Trade amount is too small', bucket: 'invalid_input', retryable: false, userMessage: 'Trade amount is too small. Please increase the amount.' },
  6001: { name: 'InvalidReserves', message: 'Invalid reserves', bucket: 'program_state', retryable: false, userMessage: 'Pool reserves are in an invalid state. Please try again later.' },
  6002: { name: 'InsufficientOutput', message: 'Insufficient output amount', bucket: 'slippage', retryable: true, userMessage: 'Output amount too low. Try increasing slippage tolerance.' },
  6003: { name: 'InsufficientLiquidity', message: 'Insufficient liquidity', bucket: 'program_state', retryable: false, userMessage: 'Not enough liquidity in the pool for this trade size.' },
  6004: { name: 'InvalidAmount', message: 'Invalid amount', bucket: 'invalid_input', retryable: false, userMessage: 'Invalid trade amount. Please check your input.' },
  6005: { name: 'SlippageExceeded', message: 'Slippage exceeded', bucket: 'slippage', retryable: true, userMessage: 'Price moved beyond your slippage tolerance. Try again or increase slippage.' },
  6006: { name: 'LaunchNotActive', message: 'Launch not active', bucket: 'program_state', retryable: false, userMessage: 'This launch is not currently active for trading.' },
  6007: { name: 'AlreadyGraduated', message: 'Launch already graduated', bucket: 'already_done', retryable: false, userMessage: 'This launch has already graduated.' },
  6008: { name: 'ThresholdNotReached', message: 'Graduation threshold not reached', bucket: 'program_state', retryable: false, userMessage: 'Graduation threshold has not been reached yet.' },
  6009: { name: 'Unauthorized', message: 'Unauthorized', bucket: 'auth', retryable: false, userMessage: 'You are not authorized to perform this action.' },
  6010: { name: 'InvalidConfig', message: 'Invalid configuration', bucket: 'invalid_input', retryable: false, userMessage: 'Invalid configuration parameters.' },
  6011: { name: 'LaunchesPaused', message: 'Launches are paused', bucket: 'program_state', retryable: false, userMessage: 'Token launches are currently paused by the protocol.' },
  6012: { name: 'TradingPaused', message: 'Trading is paused', bucket: 'program_state', retryable: false, userMessage: 'Trading is currently paused by the protocol.' },
  6013: { name: 'MathOverflow', message: 'Math overflow', bucket: 'compute_budget', retryable: false, userMessage: 'Calculation overflow. Try a smaller amount.' },
  6014: { name: 'InvalidMintOrder', message: 'Invalid mint order for Orbit pool', bucket: 'account_ordering', retryable: false, userMessage: 'Invalid mint ordering for DEX pool creation.' },
  6015: { name: 'InvalidCreator', message: 'Invalid creator address', bucket: 'auth', retryable: false, userMessage: 'Creator address mismatch.' },
  6016: { name: 'InvalidTreasury', message: 'Invalid treasury address', bucket: 'auth', retryable: false, userMessage: 'Treasury address mismatch.' },
  6017: { name: 'InsufficientGraduationFunds', message: 'Insufficient SOL for graduation distribution', bucket: 'program_state', retryable: false, userMessage: 'Not enough SOL in the vault for graduation distribution.' },
};

// =============================================================================
// ERROR CLASSIFICATION
// =============================================================================

/**
 * Extract Anchor custom program error code from an error message.
 * Anchor errors appear as: "custom program error: 0x1770" (hex) or
 * in simulation logs as "Program ... failed: custom program error: 0x..."
 */
function extractAnchorErrorCode(message: string): number | null {
  // Match hex format: "custom program error: 0x1770"
  const hexMatch = message.match(/custom program error:\s*0x([0-9a-fA-F]+)/);
  if (hexMatch) {
    return parseInt(hexMatch[1], 16);
  }

  // Match decimal format in some RPC responses
  const decMatch = message.match(/custom program error:\s*(\d+)/);
  if (decMatch) {
    return parseInt(decMatch[1], 10);
  }

  // Match InstructionError format: {"InstructionError":[2,{"Custom":6005}]}
  const jsonMatch = message.match(/"Custom"\s*:\s*(\d+)/);
  if (jsonMatch) {
    return parseInt(jsonMatch[1], 10);
  }

  return null;
}

/**
 * Classify an error into an actionable bucket with user-friendly message.
 */
export function classifyError(err: unknown): ClassifiedError {
  const raw = err instanceof Error ? err.message : String(err);
  const lower = raw.toLowerCase();

  // 1. Check for Anchor custom program errors first
  const code = extractAnchorErrorCode(raw);
  if (code !== null && LAUNCHR_ERROR_CODES[code]) {
    const info = LAUNCHR_ERROR_CODES[code];
    return {
      bucket: info.bucket,
      code,
      name: info.name,
      userMessage: info.userMessage,
      retryable: info.retryable,
      raw,
    };
  }

  // 2. Wallet rejection
  if (lower.includes('user rejected') || lower.includes('user denied') || lower.includes('rejected the request')) {
    return { bucket: 'wallet_rejected', userMessage: 'Transaction was rejected in your wallet.', retryable: false, raw };
  }

  // 3. Blockhash expired
  if ((lower.includes('blockhash') && lower.includes('expired')) || lower.includes('block height exceeded')) {
    return { bucket: 'blockhash_expired', userMessage: 'Transaction expired. Please try again.', retryable: true, raw };
  }

  // 4. RPC rate limits
  if (lower.includes('429') || lower.includes('too many requests') || lower.includes('rate limit')) {
    return { bucket: 'rpc_rate_limit', userMessage: 'RPC rate limit hit. Please wait a moment and retry.', retryable: true, raw };
  }

  // 5. Network / fetch errors
  if (lower.includes('failed to fetch') || lower.includes('network') || lower.includes('econnrefused') || lower.includes('timeout') || lower.includes('enotfound')) {
    return { bucket: 'network', userMessage: 'Network error. Check your connection and try again.', retryable: true, raw };
  }

  // 6. Compute budget exceeded
  if (lower.includes('exceeded cu meter') || lower.includes('computational budget exceeded') || lower.includes('exceeded maximum number of instructions')) {
    return { bucket: 'compute_budget', userMessage: 'Transaction ran out of compute units. Try a simpler operation.', retryable: false, raw };
  }

  // 7. Missing rent / ATA
  if (lower.includes('accountnotfound') || lower.includes('account not found') || lower.includes('could not find account') || lower.includes('insufficient funds for rent') || lower.includes('insufficient lamports')) {
    return { bucket: 'missing_rent_or_ata', userMessage: 'An account is missing or has insufficient SOL for rent. Ensure your wallet has enough SOL.', retryable: false, raw };
  }

  // 8. Already initialized (idempotency)
  if (lower.includes('already in use') || lower.includes('already initialized')) {
    return { bucket: 'already_done', userMessage: 'This action has already been completed.', retryable: false, raw };
  }

  // 9. Wallet not connected
  if (lower.includes('not connected') || lower.includes('wallet not connected')) {
    return { bucket: 'auth', userMessage: 'Please connect your wallet first.', retryable: false, raw };
  }

  // 10. Security / unauthorized (from transaction-validator)
  if (lower.includes('security') || lower.includes('unauthorized program')) {
    return { bucket: 'auth', userMessage: 'Transaction rejected by security validator.', retryable: false, raw };
  }

  // Fallback
  return { bucket: 'unknown', userMessage: raw || 'An unexpected error occurred. Please try again.', retryable: false, raw };
}

// =============================================================================
// STRUCTURED LOGGING
// =============================================================================

export interface TxLogEntry {
  action: string;
  wallet: string;
  mint: string;
  pool: string;
  amountIn: string;
  amountOut: string;
  slippage: number;
  blockhash: string;
  signature: string;
  rpcEndpoint: string;
  error: string | null;
  errorBucket: ErrorBucket | null;
  timestamp: string;
  attempt: number;
  computeUnits: number;
  logs: string[];
}

/**
 * Emit a structured JSON log entry to the console.
 * All entries are prefixed with [LAUNCHR_TX] for easy DevTools filtering.
 */
export function txLog(entry: Partial<TxLogEntry>): void {
  const full: Partial<TxLogEntry> & { timestamp: string } = {
    ...entry,
    timestamp: entry.timestamp || new Date().toISOString(),
  };

  // Remove undefined values for cleaner output
  const clean = Object.fromEntries(
    Object.entries(full).filter(([, v]) => v !== undefined)
  );

  console.log('[LAUNCHR_TX]', JSON.stringify(clean));
}

// =============================================================================
// SIMULATION DETAILS
// =============================================================================

export interface SimDetails {
  logs: string[];
  unitsConsumed: number;
  innerInstructions: number;
  error: string | null;
}

/**
 * Extract useful details from a simulation response.
 */
export function extractSimulationDetails(sim: SimulatedTransactionResponse): SimDetails {
  return {
    logs: sim.logs || [],
    unitsConsumed: sim.unitsConsumed || 0,
    innerInstructions: sim.innerInstructions?.length || 0,
    error: sim.err ? (typeof sim.err === 'string' ? sim.err : JSON.stringify(sim.err)) : null,
  };
}
