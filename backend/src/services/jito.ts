/**
 * Jito Service
 *
 * MEV protection through bundle transactions and tip optimization.
 * https://jito-labs.gitbook.io/mev/
 */

import { logger } from '../utils/logger';

// ---------------------------------------------------------------------------
// TYPES
// ---------------------------------------------------------------------------

interface JitoConfig {
  blockEngineUrl?: string;
  tipAccount?: string;
}

interface BundleRequest {
  transactions: string[]; // Base64 encoded transactions
  tipLamports?: number;
}

interface BundleResponse {
  bundleId: string;
  status: 'pending' | 'landed' | 'failed';
  slot?: number;
  error?: string;
}

interface TipAccountInfo {
  address: string;
  balance: number;
}

interface TransactionError {
  InstructionError?: [number, string | { Custom: number }];
  InsufficientFundsForRent?: { account_index: number };
  InvalidAccountIndex?: boolean;
  InvalidAccountForFee?: boolean;
  [key: string]: unknown;
}

interface BundleStatus {
  bundleId: string;
  status: 'Invalid' | 'Pending' | 'Failed' | 'Landed';
  landedSlot?: number;
  err?: TransactionError | string | null;
}

// ---------------------------------------------------------------------------
// CONSTANTS
// ---------------------------------------------------------------------------

// Jito Block Engine endpoints
const JITO_BLOCK_ENGINES = {
  mainnet: [
    'https://mainnet.block-engine.jito.wtf',
    'https://amsterdam.mainnet.block-engine.jito.wtf',
    'https://frankfurt.mainnet.block-engine.jito.wtf',
    'https://ny.mainnet.block-engine.jito.wtf',
    'https://tokyo.mainnet.block-engine.jito.wtf',
  ],
  // Devnet doesn't have Jito, use mainnet for testing
};

// Jito tip accounts (rotate for load balancing)
const JITO_TIP_ACCOUNTS = [
  '96gYZGLnJYVFmbjzopPSU6QiEV5fGqZNyN9nmNhvrZU5',
  'HFqU5x63VTqvQss8hp11i4bVmkdzGTT4RCgLvtL1MjzU',
  'Cw8CFyM9FkoMi7K7Crf6HNQqf4uEMzpKw6QNghXLvLkY',
  'ADaUMid9yfUytqMBgopwjb2DTLSokTSzL1zt6iGPaS49',
  'DfXygSm4jCyNCybVYYK6DwvWqjKee8pbDmJGcLWNDXjh',
  'ADuUkR4vqLUMWXxW9gh6D6L8pMSawimctcNZ5pGwDcEt',
  'DttWaMuVvTiduZRnguLF7jNxTgiMBZ1hyAumKUiL2KRL',
  '3AVi9Tg9Uo68tJfuvoKvqKNWKkC5wPdSSdeBnizKZ6jT',
];

// Recommended tip amounts (in lamports)
export const JITO_TIP_AMOUNTS = {
  low: 1_000, // 0.000001 SOL
  medium: 10_000, // 0.00001 SOL
  high: 100_000, // 0.0001 SOL
  veryHigh: 1_000_000, // 0.001 SOL
  turbo: 10_000_000, // 0.01 SOL
};

// ---------------------------------------------------------------------------
// JITO SERVICE
// ---------------------------------------------------------------------------

export class JitoService {
  private blockEngineUrl: string;
  private tipAccountIndex: number = 0;

  constructor(config: JitoConfig = {}) {
    this.blockEngineUrl = config.blockEngineUrl || JITO_BLOCK_ENGINES.mainnet[0];
  }

  // ---------------------------------------------------------------------------
  // TIP ACCOUNTS
  // ---------------------------------------------------------------------------

  /**
   * Get a tip account (rotates for load balancing)
   */
  getTipAccount(): string {
    const account = JITO_TIP_ACCOUNTS[this.tipAccountIndex];
    this.tipAccountIndex = (this.tipAccountIndex + 1) % JITO_TIP_ACCOUNTS.length;
    return account;
  }

  /**
   * Get all tip accounts
   */
  getAllTipAccounts(): string[] {
    return [...JITO_TIP_ACCOUNTS];
  }

  /**
   * Get recommended tip amount based on priority
   */
  getRecommendedTip(priority: 'low' | 'medium' | 'high' | 'veryHigh' | 'turbo' = 'medium'): number {
    return JITO_TIP_AMOUNTS[priority];
  }

  // ---------------------------------------------------------------------------
  // BUNDLE SUBMISSION
  // ---------------------------------------------------------------------------

  /**
   * Send a bundle of transactions
   */
  async sendBundle(request: BundleRequest): Promise<BundleResponse> {
    try {
      const response = await fetch(`${this.blockEngineUrl}/api/v1/bundles`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'sendBundle',
          params: [request.transactions]
        })
      });

      const data = await response.json() as { error?: { message: string }; result?: string };

      if (data.error) {
        logger.error('Jito bundle error:', data.error);
        return {
          bundleId: '',
          status: 'failed',
          error: data.error.message
        };
      }

      return {
        bundleId: data.result || '',
        status: 'pending'
      };
    } catch (error) {
      logger.error('Error sending bundle:', error);
      return {
        bundleId: '',
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get bundle status
   */
  async getBundleStatus(bundleId: string): Promise<BundleStatus | null> {
    try {
      const response = await fetch(`${this.blockEngineUrl}/api/v1/bundles`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'getBundleStatuses',
          params: [[bundleId]]
        })
      });

      const data = await response.json() as {
        result?: {
          value?: {
            bundle_id: string;
            confirmation_status: 'Invalid' | 'Pending' | 'Failed' | 'Landed';
            slot?: number;
            err?: TransactionError | string | null;
          }[]
        }
      };

      if (data.result?.value?.[0]) {
        const status = data.result.value[0];
        return {
          bundleId: status.bundle_id,
          status: status.confirmation_status,
          landedSlot: status.slot,
          err: status.err
        };
      }

      return null;
    } catch (error) {
      logger.error('Error getting bundle status:', error);
      return null;
    }
  }

  /**
   * Wait for bundle to land
   */
  async waitForBundle(
    bundleId: string,
    timeoutMs: number = 30000
  ): Promise<BundleStatus | null> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeoutMs) {
      const status = await this.getBundleStatus(bundleId);

      if (status) {
        if (status.status === 'Landed') {
          logger.info(`Bundle ${bundleId} landed at slot ${status.landedSlot}`);
          return status;
        }
        if (status.status === 'Failed' || status.status === 'Invalid') {
          logger.warn(`Bundle ${bundleId} failed: ${JSON.stringify(status.err)}`);
          return status;
        }
      }

      // Wait before polling again
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    logger.warn(`Bundle ${bundleId} timed out after ${timeoutMs}ms`);
    return null;
  }

  // ---------------------------------------------------------------------------
  // TIP TRANSACTION
  // ---------------------------------------------------------------------------

  /**
   * Create tip instruction data (for including in transaction)
   * Note: This returns the account to tip and amount, actual instruction
   * should be created using @solana/web3.js
   */
  getTipInstruction(lamports: number = JITO_TIP_AMOUNTS.medium): {
    tipAccount: string;
    lamports: number;
  } {
    return {
      tipAccount: this.getTipAccount(),
      lamports
    };
  }

  // ---------------------------------------------------------------------------
  // SIMULATION
  // ---------------------------------------------------------------------------

  /**
   * Simulate bundle before sending
   */
  async simulateBundle(transactions: string[]): Promise<{
    success: boolean;
    error?: string;
    logs?: string[];
  }> {
    try {
      const response = await fetch(`${this.blockEngineUrl}/api/v1/bundles`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'simulateBundle',
          params: [{
            encodedTransactions: transactions
          }]
        })
      });

      const data = await response.json() as {
        error?: { message: string };
        result?: { value?: { err?: TransactionError | string | null; logs?: string[] }[] }
      };

      if (data.error) {
        return {
          success: false,
          error: data.error.message
        };
      }

      // Check simulation results
      const results = data.result?.value;
      if (results) {
        for (const result of results) {
          if (result.err) {
            return {
              success: false,
              error: JSON.stringify(result.err),
              logs: result.logs
            };
          }
        }
      }

      return { success: true };
    } catch (error) {
      logger.error('Error simulating bundle:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  // ---------------------------------------------------------------------------
  // REGION SELECTION
  // ---------------------------------------------------------------------------

  /**
   * Set block engine URL (for region optimization)
   */
  setBlockEngine(url: string): void {
    this.blockEngineUrl = url;
  }

  /**
   * Get available block engines
   */
  getBlockEngines(): string[] {
    return JITO_BLOCK_ENGINES.mainnet;
  }

  /**
   * Find fastest block engine
   */
  async findFastestBlockEngine(): Promise<string> {
    const results = await Promise.all(
      JITO_BLOCK_ENGINES.mainnet.map(async (url) => {
        const start = Date.now();
        try {
          await fetch(`${url}/api/v1/bundles`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              jsonrpc: '2.0',
              id: 1,
              method: 'getTipAccounts',
              params: []
            })
          });
          return { url, latency: Date.now() - start };
        } catch {
          return { url, latency: Infinity };
        }
      })
    );

    const fastest = results.reduce((min, curr) =>
      curr.latency < min.latency ? curr : min
    );

    logger.info(`Fastest Jito block engine: ${fastest.url} (${fastest.latency}ms)`);
    this.blockEngineUrl = fastest.url;
    return fastest.url;
  }
}

// ---------------------------------------------------------------------------
// SINGLETON INSTANCE
// ---------------------------------------------------------------------------

let jitoService: JitoService | null = null;

export function initJito(config?: JitoConfig): JitoService {
  jitoService = new JitoService(config);
  logger.info('Jito service initialized');
  return jitoService;
}

export function getJito(): JitoService | null {
  return jitoService;
}

export { JITO_BLOCK_ENGINES };
