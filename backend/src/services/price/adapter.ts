/**
 * Price Adapter Service
 *
 * Listens to on-chain Anchor program events (TradeExecuted) and inserts
 * swap data into Supabase.  Supabase triggers automatically create candle
 * snapshots and price ticks (see SQL schema).
 *
 * Also fetches SOL/USD price from Jupiter for USD-denominated fields.
 */

import { Connection, PublicKey } from '@solana/web3.js';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { EventEmitter } from 'events';
import { createHash } from 'crypto';
import bs58 from 'bs58';
import { logger } from '../../utils/logger';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SwapEvent {
  launchId: string;
  mint: string;
  signature: string;
  trader: string;
  swapType: 'buy' | 'sell';
  solAmount: bigint;
  tokenAmount: bigint;
  price: number;
  priceUsd?: number;
  solReserves?: number;
  tokenReserves?: number;
  marketCapSol?: number;
  slot: number;
  blockTime: number;
}

// ---------------------------------------------------------------------------
// Anchor event discriminator for TradeExecuted
// ---------------------------------------------------------------------------

const TRADE_EXECUTED_DISC = createHash('sha256')
  .update('event:TradeExecuted')
  .digest()
  .slice(0, 8);

// ---------------------------------------------------------------------------
// PriceAdapter
// ---------------------------------------------------------------------------

export class PriceAdapter extends EventEmitter {
  private connection: Connection;
  private supabase: SupabaseClient | null = null;
  private programId: PublicKey;
  private subscriptionId: number | null = null;
  private solPrice: number = 0;
  private solPriceInterval: NodeJS.Timeout | null = null;

  // Cache: launch PDA → { mint, virtualSolReserve, virtualTokenReserve }
  private launchCache: Map<string, { mint: string; virtualSolReserve: number; virtualTokenReserve: number }> = new Map();

  constructor(
    rpcEndpoint: string,
    programId: string,
    private supabaseUrl?: string,
    private supabaseServiceKey?: string
  ) {
    super();
    this.connection = new Connection(rpcEndpoint, 'confirmed');
    this.programId = new PublicKey(programId);
  }

  /** Populate the launch cache from the indexer's launch data */
  updateLaunchCache(launches: Array<{ publicKey: string; mint: string; virtualSolReserve: number; virtualTokenReserve: string | number }>): void {
    for (const l of launches) {
      this.launchCache.set(l.publicKey, {
        mint: l.mint,
        virtualSolReserve: l.virtualSolReserve,
        virtualTokenReserve: typeof l.virtualTokenReserve === 'string'
          ? parseFloat(l.virtualTokenReserve)
          : l.virtualTokenReserve,
      });
    }
  }

  async start(): Promise<void> {
    // Initialise Supabase client if credentials provided
    if (this.supabaseUrl && this.supabaseServiceKey) {
      this.supabase = createClient(this.supabaseUrl, this.supabaseServiceKey);
      logger.info('[PriceAdapter] Supabase client initialized');
    } else {
      logger.warn('[PriceAdapter] No Supabase credentials – swap events will only be emitted via WebSocket');
    }

    // Fetch initial SOL price
    await this.updateSolPrice();
    this.solPriceInterval = setInterval(() => this.updateSolPrice(), 60_000);

    // Subscribe to program logs
    this.subscriptionId = this.connection.onLogs(
      this.programId,
      async (logInfo) => {
        try {
          await this.processLogs(logInfo);
        } catch (error) {
          logger.error('[PriceAdapter] Error processing logs:', error);
        }
      },
      'confirmed',
    );

    logger.info(`[PriceAdapter] Started – listening to program ${this.programId.toBase58()}`);
  }

  async stop(): Promise<void> {
    if (this.subscriptionId !== null) {
      await this.connection.removeOnLogsListener(this.subscriptionId);
      this.subscriptionId = null;
    }
    if (this.solPriceInterval) {
      clearInterval(this.solPriceInterval);
      this.solPriceInterval = null;
    }
    logger.info('[PriceAdapter] Stopped');
  }

  getSolPrice(): number {
    return this.solPrice;
  }

  // -------------------------------------------------------------------------
  // SOL/USD price
  // -------------------------------------------------------------------------

  private async updateSolPrice(): Promise<void> {
    try {
      const res = await fetch(
        'https://price.jup.ag/v6/price?ids=So11111111111111111111111111111111111111112',
      );
      const json: any = await res.json();
      this.solPrice =
        json.data?.So11111111111111111111111111111111111111112?.price || 0;
    } catch (error) {
      logger.error('[PriceAdapter] Failed to fetch SOL price:', error);
    }
  }

  // -------------------------------------------------------------------------
  // Log processing
  // -------------------------------------------------------------------------

  private async processLogs(logInfo: { signature: string; logs: string[]; err: any; slot?: number }): Promise<void> {
    if (logInfo.err) return; // Skip failed transactions

    const { signature, logs } = logInfo;
    const slot = (logInfo as any).slot ?? 0;

    const event = this.parseTradeExecuted(logs);
    if (!event) return;

    // Get block time
    let blockTime = Math.floor(Date.now() / 1000);
    try {
      const bt = await this.connection.getBlockTime(slot);
      if (bt) blockTime = bt;
    } catch { /* fall back to Date.now() */ }

    // Look up mint from cache
    const cached = this.launchCache.get(event.launchPk);
    const mint = cached?.mint ?? '';

    // Compute price: event.price is lamports-per-token (u64)
    // Convert to SOL per token: price_lamports / 1e9
    const priceInSol = event.priceLamports / 1e9;
    const priceUsd = this.solPrice > 0 ? priceInSol * this.solPrice : undefined;

    // Market cap approximation: price × total_supply_tokens (1B tokens)
    const marketCapSol = priceInSol * 1_000_000_000;

    const swap: SwapEvent = {
      launchId: event.launchPk,
      mint,
      signature,
      trader: event.traderPk,
      swapType: event.isBuy ? 'buy' : 'sell',
      solAmount: event.solAmount,
      tokenAmount: event.tokenAmount,
      price: priceInSol,
      priceUsd,
      solReserves: cached?.virtualSolReserve,
      tokenReserves: cached?.virtualTokenReserve,
      marketCapSol,
      slot,
      blockTime,
    };

    // Insert into Supabase (triggers candle + price_tick creation)
    if (this.supabase) {
      await this.insertSwap(swap);
    }

    // Emit for WebSocket broadcast
    this.emit('swap', swap);
  }

  // -------------------------------------------------------------------------
  // Anchor event parsing
  // -------------------------------------------------------------------------

  private parseTradeExecuted(
    logs: string[],
  ): {
    launchPk: string;
    traderPk: string;
    isBuy: boolean;
    solAmount: bigint;
    tokenAmount: bigint;
    priceLamports: number;
    protocolFee: bigint;
    creatorFee: bigint;
    timestamp: number;
  } | null {
    for (const log of logs) {
      if (!log.startsWith('Program data: ')) continue;

      const base64 = log.slice('Program data: '.length).trim();
      let buf: Buffer;
      try {
        buf = Buffer.from(base64, 'base64');
      } catch {
        continue;
      }

      // Must be at least discriminator (8) + fields (113 bytes)
      if (buf.length < 8 + 113) continue;

      // Check discriminator
      if (!buf.slice(0, 8).equals(TRADE_EXECUTED_DISC)) continue;

      const data = buf.slice(8);

      // Deserialize borsh fields
      const launchPk = bs58.encode(data.slice(0, 32));
      const traderPk = bs58.encode(data.slice(32, 64));
      const isBuy = data[64] === 1;
      const solAmount = data.readBigUInt64LE(65);
      const tokenAmount = data.readBigUInt64LE(73);
      const priceLamports = Number(data.readBigUInt64LE(81));
      const protocolFee = data.readBigUInt64LE(89);
      const creatorFee = data.readBigUInt64LE(97);
      const timestamp = Number(data.readBigInt64LE(105));

      return {
        launchPk,
        traderPk,
        isBuy,
        solAmount,
        tokenAmount,
        priceLamports,
        protocolFee,
        creatorFee,
        timestamp,
      };
    }

    return null;
  }

  // -------------------------------------------------------------------------
  // Supabase insertion
  // -------------------------------------------------------------------------

  private async insertSwap(swap: SwapEvent): Promise<void> {
    if (!this.supabase) return;

    const { error } = await this.supabase.from('swaps').insert({
      launch_id: swap.launchId,
      mint: swap.mint,
      signature: swap.signature,
      trader: swap.trader,
      swap_type: swap.swapType,
      sol_amount: swap.solAmount.toString(),
      token_amount: swap.tokenAmount.toString(),
      price: swap.price,
      price_usd: swap.priceUsd ?? null,
      sol_reserves: swap.solReserves?.toString() ?? null,
      token_reserves: swap.tokenReserves?.toString() ?? null,
      market_cap_sol: swap.marketCapSol ?? null,
      slot: swap.slot,
      block_time: new Date(swap.blockTime * 1000).toISOString(),
    });

    if (error && error.code !== '23505') {
      // 23505 = unique violation (duplicate), safe to ignore
      logger.error('[PriceAdapter] Supabase insert error:', error);
    }
  }
}
