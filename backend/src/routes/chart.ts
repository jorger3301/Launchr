/**
 * Chart API Routes
 *
 * REST endpoints for price chart data backed by Supabase.
 * Falls back gracefully when Supabase is not configured.
 */

import { Router, Request, Response } from 'express';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { logger } from '../utils/logger';

const router = Router();

// ---------------------------------------------------------------------------
// Supabase client (nullable – endpoints return 503 when unavailable)
// ---------------------------------------------------------------------------

let supabase: SupabaseClient | null = null;

if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY) {
  supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY,
  );
}

function requireSupabase(res: Response): boolean {
  if (!supabase) {
    res.status(503).json({ error: 'Chart service unavailable – Supabase not configured' });
    return false;
  }
  return true;
}

// ---------------------------------------------------------------------------
// Validation schemas
// ---------------------------------------------------------------------------

const TIMEFRAMES = ['1s', '5s', '15s', '1m', '5m', '15m', '1h', '4h', '1d', '1w'] as const;
const PUBKEY_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

const CandleQuerySchema = z.object({
  timeframe: z.enum(TIMEFRAMES).default('5m'),
  from: z.string().optional(),
  to: z.string().optional(),
  limit: z.coerce.number().min(1).max(1000).default(300),
});

// ---------------------------------------------------------------------------
// GET /api/chart/:launchId/candles – OHLCV candle data
// ---------------------------------------------------------------------------

router.get('/:launchId/candles', async (req: Request, res: Response) => {
  if (!requireSupabase(res)) return;

  try {
    const { launchId } = req.params;
    if (!PUBKEY_RE.test(launchId)) {
      return res.status(400).json({ error: 'Invalid launch ID format' });
    }

    const query = CandleQuerySchema.parse(req.query);

    let dbQuery = supabase!
      .from('latest_candles')
      .select('bucket_time, open, high, low, close, volume_sol, volume_tokens, num_trades')
      .eq('launch_id', launchId)
      .eq('timeframe', query.timeframe)
      .order('bucket_time', { ascending: true })
      .limit(query.limit);

    if (query.from) dbQuery = dbQuery.gte('bucket_time', query.from);
    if (query.to) dbQuery = dbQuery.lte('bucket_time', query.to);

    const { data, error } = await dbQuery;
    if (error) throw error;

    const candles = (data || []).map((c: any) => ({
      time: Math.floor(new Date(c.bucket_time).getTime() / 1000),
      open: parseFloat(c.open),
      high: parseFloat(c.high),
      low: parseFloat(c.low),
      close: parseFloat(c.close),
      volume: parseInt(c.volume_sol) / 1e9,
    }));

    res.json({ candles });
  } catch (error: any) {
    logger.error('[Chart API] candles error:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch candles' });
  }
});

// ---------------------------------------------------------------------------
// GET /api/chart/:launchId/trades – Recent trades from Supabase
// ---------------------------------------------------------------------------

router.get('/:launchId/trades', async (req: Request, res: Response) => {
  if (!requireSupabase(res)) return;

  try {
    const { launchId } = req.params;
    if (!PUBKEY_RE.test(launchId)) {
      return res.status(400).json({ error: 'Invalid launch ID format' });
    }

    const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);

    const { data, error } = await supabase!
      .from('swaps')
      .select('signature, trader, swap_type, sol_amount, token_amount, price, block_time')
      .eq('launch_id', launchId)
      .order('block_time', { ascending: false })
      .limit(limit);

    if (error) throw error;

    const trades = (data || []).map((t: any) => ({
      signature: t.signature,
      trader: t.trader,
      type: t.swap_type,
      solAmount: parseInt(t.sol_amount) / 1e9,
      tokenAmount: parseInt(t.token_amount),
      price: parseFloat(t.price),
      time: new Date(t.block_time).getTime(),
    }));

    res.json({ trades });
  } catch (error: any) {
    logger.error('[Chart API] trades error:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch trades' });
  }
});

// ---------------------------------------------------------------------------
// GET /api/chart/:launchId/price – Latest price + changes
// ---------------------------------------------------------------------------

router.get('/:launchId/price', async (req: Request, res: Response) => {
  if (!requireSupabase(res)) return;

  try {
    const { launchId } = req.params;
    if (!PUBKEY_RE.test(launchId)) {
      return res.status(400).json({ error: 'Invalid launch ID format' });
    }

    // Latest price from materialized view
    const { data: priceData, error: priceError } = await supabase!
      .from('latest_prices')
      .select('*')
      .eq('launch_id', launchId)
      .single();

    // Latest computed price changes
    const { data: changeData } = await supabase!
      .from('price_changes')
      .select('*')
      .eq('launch_id', launchId)
      .order('computed_at', { ascending: false })
      .limit(1)
      .single();

    if (priceError && priceError.code !== 'PGRST116') throw priceError;

    res.json({
      price: priceData ? parseFloat(priceData.price) : null,
      priceUsd: priceData?.price_usd ? parseFloat(priceData.price_usd) : null,
      marketCapSol: priceData?.market_cap_sol ? parseFloat(priceData.market_cap_sol) : null,
      lastUpdate: priceData?.recorded_at,
      changes: changeData
        ? {
            change5m: parseFloat(changeData.change_5m_pct || '0'),
            change1h: parseFloat(changeData.change_1h_pct || '0'),
            change24h: parseFloat(changeData.change_24h_pct || '0'),
            high24h: parseFloat(changeData.high_24h || '0'),
            low24h: parseFloat(changeData.low_24h || '0'),
            volume24h: parseInt(changeData.volume_24h_sol || '0') / 1e9,
          }
        : null,
    });
  } catch (error: any) {
    logger.error('[Chart API] price error:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch price' });
  }
});

// ---------------------------------------------------------------------------
// GET /api/chart/:launchId/stats – Launch statistics
// ---------------------------------------------------------------------------

router.get('/:launchId/stats', async (req: Request, res: Response) => {
  if (!requireSupabase(res)) return;

  try {
    const { launchId } = req.params;
    if (!PUBKEY_RE.test(launchId)) {
      return res.status(400).json({ error: 'Invalid launch ID format' });
    }

    const { data, error } = await supabase!
      .from('launch_stats')
      .select('*')
      .eq('launch_id', launchId)
      .order('snapshot_at', { ascending: false })
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') throw error;

    res.json({
      totalVolumeSol: data ? parseInt(data.total_volume_sol) / 1e9 : 0,
      totalTrades: data?.total_trades || 0,
      uniqueTraders: data?.unique_traders || 0,
      uniqueHolders: data?.unique_holders || 0,
      graduationProgress: data?.graduation_progress || 0,
      status: data?.status || 'active',
    });
  } catch (error: any) {
    logger.error('[Chart API] stats error:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch stats' });
  }
});

export default router;
