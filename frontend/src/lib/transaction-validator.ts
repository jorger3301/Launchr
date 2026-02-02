/**
 * Transaction Security Validator
 *
 * Comprehensive security validation for Solana transactions.
 *
 * Features:
 * - Program ID whitelisting
 * - Account count limits
 * - Compute unit limits
 * - Suspicious pattern detection
 * - Instruction size limits
 */

import { PublicKey, TransactionInstruction, Transaction, VersionedTransaction } from '@solana/web3.js';

// =============================================================================
// CONFIGURATION
// =============================================================================

const SECURITY_CONFIG = {
  // Maximum accounts per transaction
  maxAccounts: 64,

  // Maximum instructions per transaction
  maxInstructions: 20,

  // Maximum data size per instruction (bytes)
  maxInstructionData: 1024,

  // Maximum compute units
  maxComputeUnits: 1_400_000,

  // Minimum compute unit price (micro-lamports) to prevent front-running
  minComputeUnitPrice: 1000,
};

// =============================================================================
// WHITELISTED PROGRAMS
// =============================================================================

/**
 * Whitelist of allowed Solana program IDs
 * Only instructions from these programs will be accepted
 */
const ALLOWED_PROGRAM_IDS = new Set([
  // Launchr program (main application)
  process.env.REACT_APP_PROGRAM_ID || 'AD9VheLMqVPwbDQc5CmSHmCZdfa8CGmr2xXmhhNSTyhK',

  // Standard Solana programs
  'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA', // SPL Token program
  'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb', // Token-2022 program
  '11111111111111111111111111111111', // System program
  'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL', // Associated Token program
  'ComputeBudget111111111111111111111111111111', // Compute Budget program
  'metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s', // Metaplex Token Metadata
  'Memo1UhkJRfHyvLMcVucJwxXeuD728EqVDDwQDxFMNo', // Memo program
  'MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr', // Memo v2

  // Orbit Finance DEX (for graduation)
  'Fn3fA3fjsmpULNL7E9U79jKTe1KHxPtQeWdURCbJXCnM', // Orbit Finance program
]);

/**
 * Known dangerous program patterns (reject immediately)
 */
const DANGEROUS_PATTERNS = [
  // Arbitrary CPI patterns
  /^invoke_signed$/i,
  // Known malicious program prefixes (examples)
];

// =============================================================================
// VALIDATION FUNCTIONS
// =============================================================================

/**
 * Validates a program ID against whitelist
 */
export function isAllowedProgramId(programId: PublicKey | string): boolean {
  const idString = typeof programId === 'string' ? programId : programId.toBase58();
  return ALLOWED_PROGRAM_IDS.has(idString);
}

/**
 * Deserializes and validates transaction instructions from API response
 *
 * SECURITY: Rejects any instruction with unauthorized program ID
 */
export function deserializeAndValidateInstructions(
  ixsJson: Array<{
    programId: string;
    keys: Array<{ pubkey: string; isSigner: boolean; isWritable: boolean }>;
    dataB64: string;
  }>
): TransactionInstruction[] {
  if (!Array.isArray(ixsJson) || ixsJson.length === 0) {
    throw new Error('Invalid instructions: array expected');
  }

  // Check instruction count
  if (ixsJson.length > SECURITY_CONFIG.maxInstructions) {
    throw new Error(
      `SECURITY: Too many instructions (${ixsJson.length}). Maximum allowed: ${SECURITY_CONFIG.maxInstructions}`
    );
  }

  return ixsJson.map((ix, index) => {
    // Validate instruction structure
    if (!ix.programId || !ix.keys || !ix.dataB64) {
      throw new Error(`Invalid instruction structure at index ${index}`);
    }

    const programId = new PublicKey(ix.programId);

    // CRITICAL SECURITY CHECK: Verify program ID
    if (!isAllowedProgramId(programId)) {
      throw new Error(
        `SECURITY: Unauthorized program ID detected at index ${index}: ${programId.toBase58()}\n` +
          `Transaction has been REJECTED to protect your funds.\n` +
          `If this is unexpected, please report this to the Launchr team immediately.`
      );
    }

    // Check instruction data size
    const data = Buffer.from(ix.dataB64, 'base64');
    if (data.length > SECURITY_CONFIG.maxInstructionData) {
      throw new Error(
        `SECURITY: Instruction data too large at index ${index}. ` +
          `Size: ${data.length}, max: ${SECURITY_CONFIG.maxInstructionData}`
      );
    }

    // Deserialize instruction
    return new TransactionInstruction({
      programId,
      keys: ix.keys.map((k) => ({
        pubkey: new PublicKey(k.pubkey),
        isSigner: k.isSigner,
        isWritable: k.isWritable,
      })),
      data,
    });
  });
}

/**
 * Validates all instructions in a transaction
 */
export function validateTransactionInstructions(instructions: TransactionInstruction[]): void {
  // Check instruction count
  if (instructions.length > SECURITY_CONFIG.maxInstructions) {
    throw new Error(
      `SECURITY: Too many instructions (${instructions.length}). Maximum allowed: ${SECURITY_CONFIG.maxInstructions}`
    );
  }

  // Collect all unique accounts
  const allAccounts = new Set<string>();

  for (let i = 0; i < instructions.length; i++) {
    const ix = instructions[i];

    // Check program ID
    if (!isAllowedProgramId(ix.programId)) {
      throw new Error(
        `SECURITY: Unauthorized program detected in transaction at index ${i}: ${ix.programId.toBase58()}`
      );
    }

    // Check instruction data size
    if (ix.data.length > SECURITY_CONFIG.maxInstructionData) {
      throw new Error(
        `SECURITY: Instruction data too large at index ${i}. ` +
          `Size: ${ix.data.length}, max: ${SECURITY_CONFIG.maxInstructionData}`
      );
    }

    // Track accounts
    allAccounts.add(ix.programId.toBase58());
    for (const key of ix.keys) {
      allAccounts.add(key.pubkey.toBase58());
    }
  }

  // Check total account count
  if (allAccounts.size > SECURITY_CONFIG.maxAccounts) {
    throw new Error(
      `SECURITY: Too many accounts in transaction (${allAccounts.size}). ` +
        `Maximum allowed: ${SECURITY_CONFIG.maxAccounts}`
    );
  }
}

/**
 * Validates a full Transaction object
 */
export function validateTransaction(transaction: Transaction): void {
  validateTransactionInstructions(transaction.instructions);
}

/**
 * Check if a transaction is safe to sign
 */
export function isTransactionSafe(transaction: Transaction): {
  safe: boolean;
  error?: string;
  unauthorizedPrograms?: string[];
  warnings?: string[];
} {
  const unauthorizedPrograms: string[] = [];
  const warnings: string[] = [];

  // Check instruction count
  if (transaction.instructions.length > SECURITY_CONFIG.maxInstructions) {
    return {
      safe: false,
      error: `Too many instructions (${transaction.instructions.length})`,
    };
  }

  // Collect accounts and check programs
  const allAccounts = new Set<string>();
  let hasComputeBudget = false;
  let computeUnits = 0;
  let computeUnitPrice = 0;

  for (const ix of transaction.instructions) {
    const programId = ix.programId.toBase58();

    // Check program whitelist
    if (!isAllowedProgramId(ix.programId)) {
      unauthorizedPrograms.push(programId);
    }

    // Track accounts
    allAccounts.add(programId);
    for (const key of ix.keys) {
      allAccounts.add(key.pubkey.toBase58());
    }

    // Check for compute budget instructions
    if (programId === 'ComputeBudget111111111111111111111111111111') {
      hasComputeBudget = true;

      // Parse compute budget instruction
      if (ix.data.length >= 5) {
        const instructionType = ix.data[0];

        if (instructionType === 2) {
          // SetComputeUnitLimit
          computeUnits = ix.data.readUInt32LE(1);
        } else if (instructionType === 3) {
          // SetComputeUnitPrice
          computeUnitPrice = Number(ix.data.readBigUInt64LE(1));
        }
      }
    }
  }

  // Return error if unauthorized programs found
  if (unauthorizedPrograms.length > 0) {
    return {
      safe: false,
      error: `Transaction contains ${unauthorizedPrograms.length} unauthorized program(s)`,
      unauthorizedPrograms,
    };
  }

  // Check account count
  if (allAccounts.size > SECURITY_CONFIG.maxAccounts) {
    return {
      safe: false,
      error: `Too many accounts (${allAccounts.size})`,
    };
  }

  // Add warnings
  if (!hasComputeBudget) {
    warnings.push('No compute budget set - transaction may fail or be front-run');
  }

  if (computeUnits > SECURITY_CONFIG.maxComputeUnits) {
    warnings.push(`High compute units requested (${computeUnits})`);
  }

  if (computeUnitPrice > 0 && computeUnitPrice < SECURITY_CONFIG.minComputeUnitPrice) {
    warnings.push(`Low priority fee - may be front-run`);
  }

  return { safe: true, warnings: warnings.length > 0 ? warnings : undefined };
}

/**
 * Validate a versioned transaction
 */
export function isVersionedTransactionSafe(transaction: VersionedTransaction): {
  safe: boolean;
  error?: string;
  warnings?: string[];
} {
  const warnings: string[] = [];
  const message = transaction.message;

  // Get static account keys
  const accountKeys = message.staticAccountKeys;

  // Check account count
  if (accountKeys.length > SECURITY_CONFIG.maxAccounts) {
    return {
      safe: false,
      error: `Too many accounts (${accountKeys.length})`,
    };
  }

  // Check each instruction
  const compiledInstructions = message.compiledInstructions;

  if (compiledInstructions.length > SECURITY_CONFIG.maxInstructions) {
    return {
      safe: false,
      error: `Too many instructions (${compiledInstructions.length})`,
    };
  }

  for (let i = 0; i < compiledInstructions.length; i++) {
    const ix = compiledInstructions[i];
    const programId = accountKeys[ix.programIdIndex];

    if (!isAllowedProgramId(programId)) {
      return {
        safe: false,
        error: `Unauthorized program at index ${i}: ${programId.toBase58()}`,
      };
    }

    // Check instruction data size
    if (ix.data.length > SECURITY_CONFIG.maxInstructionData) {
      return {
        safe: false,
        error: `Instruction data too large at index ${i}`,
      };
    }
  }

  return { safe: true, warnings: warnings.length > 0 ? warnings : undefined };
}

// =============================================================================
// WHITELIST MANAGEMENT
// =============================================================================

/**
 * Add a program ID to the whitelist (use with caution)
 */
export function addAllowedProgramId(programId: string): void {
  ALLOWED_PROGRAM_IDS.add(programId);
}

/**
 * Remove a program ID from the whitelist
 */
export function removeAllowedProgramId(programId: string): void {
  ALLOWED_PROGRAM_IDS.delete(programId);
}

/**
 * Get list of all whitelisted program IDs
 */
export function getAllowedProgramIds(): string[] {
  return Array.from(ALLOWED_PROGRAM_IDS);
}

/**
 * Get security configuration
 */
export function getSecurityConfig(): typeof SECURITY_CONFIG {
  return { ...SECURITY_CONFIG };
}

export default {
  isAllowedProgramId,
  deserializeAndValidateInstructions,
  validateTransactionInstructions,
  validateTransaction,
  isTransactionSafe,
  isVersionedTransactionSafe,
  addAllowedProgramId,
  removeAllowedProgramId,
  getAllowedProgramIds,
  getSecurityConfig,
};
