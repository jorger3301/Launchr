/**
 * Helius Service
 *
 * Enhanced RPC, webhooks, and Digital Asset Standard (DAS) API integration.
 * https://docs.helius.dev/
 */

import { logger } from '../utils/logger';

// ---------------------------------------------------------------------------
// TYPES
// ---------------------------------------------------------------------------

interface HeliusConfig {
  apiKey: string;
  cluster: 'mainnet-beta' | 'devnet';
}

interface WebhookConfig {
  webhookURL: string;
  transactionTypes: string[];
  accountAddresses: string[];
  webhookType: 'enhanced' | 'raw';
}

interface TokenMetadata {
  mint: string;
  name: string;
  symbol: string;
  uri: string;
  image?: string;
  description?: string;
  attributes?: Record<string, any>[];
}

interface EnhancedTransaction {
  signature: string;
  timestamp: number;
  type: string;
  source: string;
  fee: number;
  feePayer: string;
  nativeTransfers: {
    fromUserAccount: string;
    toUserAccount: string;
    amount: number;
  }[];
  tokenTransfers: {
    fromUserAccount: string;
    toUserAccount: string;
    fromTokenAccount: string;
    toTokenAccount: string;
    tokenAmount: number;
    mint: string;
  }[];
  accountData: any[];
  events: any;
}

interface PriorityFeeEstimate {
  priorityFeeLevels: {
    min: number;
    low: number;
    medium: number;
    high: number;
    veryHigh: number;
    unsafeMax: number;
  };
}

// ---------------------------------------------------------------------------
// HELIUS SERVICE
// ---------------------------------------------------------------------------

export class HeliusService {
  private apiKey: string;
  private baseUrl: string;
  private rpcUrl: string;
  private webhooks: Map<string, string> = new Map();

  constructor(config: HeliusConfig) {
    this.apiKey = config.apiKey;
    const cluster = config.cluster === 'mainnet-beta' ? 'mainnet' : 'devnet';
    this.baseUrl = `https://api.helius.xyz/v0`;
    this.rpcUrl = `https://${cluster}.helius-rpc.com/?api-key=${this.apiKey}`;
  }

  // ---------------------------------------------------------------------------
  // RPC ENDPOINT
  // ---------------------------------------------------------------------------

  getRpcUrl(): string {
    return this.rpcUrl;
  }

  // ---------------------------------------------------------------------------
  // DIGITAL ASSET STANDARD (DAS) API
  // ---------------------------------------------------------------------------

  /**
   * Get token metadata using DAS API
   */
  async getTokenMetadata(mintAddress: string): Promise<TokenMetadata | null> {
    try {
      const response = await fetch(this.rpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 'helius-das',
          method: 'getAsset',
          params: { id: mintAddress }
        })
      });

      const data = await response.json() as { error?: { message: string }; result?: any };

      if (data.error) {
        logger.warn(`Failed to get token metadata: ${data.error.message}`);
        return null;
      }

      const asset = data.result;
      return {
        mint: mintAddress,
        name: asset.content?.metadata?.name || 'Unknown',
        symbol: asset.content?.metadata?.symbol || 'UNKNOWN',
        uri: asset.content?.json_uri || '',
        image: asset.content?.links?.image || asset.content?.files?.[0]?.uri,
        description: asset.content?.metadata?.description,
        attributes: asset.content?.metadata?.attributes
      };
    } catch (error) {
      logger.error('Error fetching token metadata from Helius:', error);
      return null;
    }
  }

  /**
   * Get multiple token metadata in batch
   */
  async getMultipleTokenMetadata(mintAddresses: string[]): Promise<Map<string, TokenMetadata>> {
    const results = new Map<string, TokenMetadata>();

    try {
      const response = await fetch(this.rpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 'helius-das-batch',
          method: 'getAssetBatch',
          params: { ids: mintAddresses }
        })
      });

      const data = await response.json() as { result?: any[] };

      if (data.result) {
        for (const asset of data.result) {
          if (asset) {
            results.set(asset.id, {
              mint: asset.id,
              name: asset.content?.metadata?.name || 'Unknown',
              symbol: asset.content?.metadata?.symbol || 'UNKNOWN',
              uri: asset.content?.json_uri || '',
              image: asset.content?.links?.image,
              description: asset.content?.metadata?.description
            });
          }
        }
      }
    } catch (error) {
      logger.error('Error fetching batch token metadata:', error);
    }

    return results;
  }

  // ---------------------------------------------------------------------------
  // ENHANCED TRANSACTIONS API
  // ---------------------------------------------------------------------------

  /**
   * Parse transaction with enhanced details
   */
  async parseTransaction(signature: string): Promise<EnhancedTransaction | null> {
    try {
      const response = await fetch(
        `${this.baseUrl}/transactions/?api-key=${this.apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ transactions: [signature] })
        }
      );

      const data = await response.json() as EnhancedTransaction[];
      return data[0] || null;
    } catch (error) {
      logger.error('Error parsing transaction:', error);
      return null;
    }
  }

  /**
   * Get transaction history for an address
   */
  async getTransactionHistory(
    address: string,
    options: { before?: string; limit?: number; type?: string } = {}
  ): Promise<EnhancedTransaction[]> {
    try {
      const params = new URLSearchParams({
        'api-key': this.apiKey,
        ...(options.before && { before: options.before }),
        ...(options.limit && { limit: options.limit.toString() }),
        ...(options.type && { type: options.type })
      });

      const response = await fetch(
        `${this.baseUrl}/addresses/${address}/transactions?${params}`
      );

      return await response.json() as EnhancedTransaction[];
    } catch (error) {
      logger.error('Error fetching transaction history:', error);
      return [];
    }
  }

  // ---------------------------------------------------------------------------
  // WEBHOOKS
  // ---------------------------------------------------------------------------

  /**
   * Create a webhook for program events
   */
  async createWebhook(config: WebhookConfig): Promise<string | null> {
    try {
      const response = await fetch(
        `${this.baseUrl}/webhooks?api-key=${this.apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            webhookURL: config.webhookURL,
            transactionTypes: config.transactionTypes,
            accountAddresses: config.accountAddresses,
            webhookType: config.webhookType
          })
        }
      );

      const data = await response.json() as { webhookID?: string };

      if (data.webhookID) {
        this.webhooks.set(data.webhookID, config.webhookURL);
        logger.info(`Created Helius webhook: ${data.webhookID}`);
        return data.webhookID;
      }

      return null;
    } catch (error) {
      logger.error('Error creating webhook:', error);
      return null;
    }
  }

  /**
   * Delete a webhook
   */
  async deleteWebhook(webhookId: string): Promise<boolean> {
    try {
      const response = await fetch(
        `${this.baseUrl}/webhooks/${webhookId}?api-key=${this.apiKey}`,
        { method: 'DELETE' }
      );

      if (response.ok) {
        this.webhooks.delete(webhookId);
        logger.info(`Deleted Helius webhook: ${webhookId}`);
        return true;
      }

      return false;
    } catch (error) {
      logger.error('Error deleting webhook:', error);
      return false;
    }
  }

  // ---------------------------------------------------------------------------
  // PRIORITY FEES
  // ---------------------------------------------------------------------------

  /**
   * Get priority fee estimate for optimal transaction speed
   */
  async getPriorityFeeEstimate(
    accountKeys: string[] = [],
    options: { priorityLevel?: 'Min' | 'Low' | 'Medium' | 'High' | 'VeryHigh' | 'UnsafeMax' } = {}
  ): Promise<number> {
    try {
      const response = await fetch(this.rpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 'helius-priority-fee',
          method: 'getPriorityFeeEstimate',
          params: [{
            accountKeys,
            options: {
              priorityLevel: options.priorityLevel || 'Medium'
            }
          }]
        })
      });

      const data = await response.json() as { result?: { priorityFeeEstimate?: number } };
      return data.result?.priorityFeeEstimate || 0;
    } catch (error) {
      logger.error('Error getting priority fee estimate:', error);
      return 0;
    }
  }

  // ---------------------------------------------------------------------------
  // TOKEN HOLDERS
  // ---------------------------------------------------------------------------

  /**
   * Get token holders for a mint
   */
  async getTokenHolders(
    mintAddress: string,
    options: { limit?: number; cursor?: string } = {}
  ): Promise<{ owner: string; balance: number }[]> {
    try {
      const response = await fetch(this.rpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 'helius-holders',
          method: 'getTokenAccounts',
          params: {
            mint: mintAddress,
            limit: options.limit || 100,
            ...(options.cursor && { cursor: options.cursor })
          }
        })
      });

      const data = await response.json() as { result?: { token_accounts?: { owner: string; amount: number }[] } };

      if (data.result?.token_accounts) {
        return data.result.token_accounts.map((acc) => ({
          owner: acc.owner,
          balance: acc.amount
        }));
      }

      return [];
    } catch (error) {
      logger.error('Error fetching token holders:', error);
      return [];
    }
  }
}

// ---------------------------------------------------------------------------
// SINGLETON INSTANCE
// ---------------------------------------------------------------------------

let heliusService: HeliusService | null = null;

export function initHelius(apiKey: string, cluster: 'mainnet-beta' | 'devnet' = 'devnet'): HeliusService {
  heliusService = new HeliusService({ apiKey, cluster });
  logger.info('Helius service initialized');
  return heliusService;
}

export function getHelius(): HeliusService | null {
  return heliusService;
}
