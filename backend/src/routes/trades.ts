/**
 * Trades Routes
 *
 * REST API endpoints for trade data.
 */

import { Router, Request, Response } from 'express';
import { IndexerService } from '../services/indexer';
import { logger } from '../utils/logger';
import { TradeEvent } from '../models/accounts';

const router = Router();

// Transform internal TradeEvent to frontend-expected format
function toTradeData(trade: TradeEvent) {
  return {
    type: trade.type,
    user: trade.trader,
    amount: trade.tokenAmount,
    solAmount: trade.solAmount,
    price: trade.price,
    timestamp: trade.timestamp,
    txSignature: trade.signature,
  };
}

// Solana signatures are base58-encoded, typically 87-88 chars
const SIGNATURE_RE = /^[1-9A-HJ-NP-Za-km-z]{64,88}$/;

// ---------------------------------------------------------------------------
// GET /api/trades/recent - Get recent trades across all launches
// ---------------------------------------------------------------------------

router.get('/recent', async (req: Request, res: Response) => {
  try {
    const indexer: IndexerService = req.app.locals.indexer;
    const { limit = '50' } = req.query;
    const parsedLimit = Math.min(parseInt(limit as string) || 50, 100);

    // Aggregate recent trades from active launches
    const launches = await indexer.getAllLaunches();
    const activeLaunches = launches
      .filter(l => l.status === 'Active' || l.status === 'PendingGraduation')
      .sort((a, b) => b.tradeCount - a.tradeCount)
      .slice(0, 20);

    // Fetch trades from all active launches in parallel
    const tradeArrays = await Promise.all(
      activeLaunches.map(launch => indexer.getRecentTrades(launch.publicKey, 10))
    );
    const allTrades = tradeArrays.flat();

    // Sort by timestamp descending
    allTrades.sort((a, b) => b.timestamp - a.timestamp);

    res.json({
      trades: allTrades.slice(0, parsedLimit).map(toTradeData),
      // Count of trades collected from sampled launches (not a global total)
      totalCollected: allTrades.length,
    });

  } catch (error) {
    logger.error('Failed to get recent trades:', error);
    res.status(500).json({ error: 'Failed to fetch trades' });
  }
});

// ---------------------------------------------------------------------------
// GET /api/trades/:signature - Get trade by signature
// ---------------------------------------------------------------------------

router.get('/:signature', async (req: Request, res: Response) => {
  try {
    const indexer: IndexerService = req.app.locals.indexer;
    const { signature } = req.params;

    if (!SIGNATURE_RE.test(signature)) {
      return res.status(400).json({ error: 'Invalid transaction signature format' });
    }

    // Search cached trades across all launches in parallel
    const launches = await indexer.getAllLaunches();
    const results = await Promise.all(
      launches.map(async (launch) => {
        const trades = await indexer.getRecentTrades(launch.publicKey, 100);
        return trades.find(t => t.signature === signature) || null;
      })
    );

    const found = results.find(Boolean);
    if (found) {
      res.json(toTradeData(found));
      return;
    }

    res.status(404).json({ error: 'Trade not found' });

  } catch (error) {
    logger.error('Failed to get trade:', error);
    res.status(500).json({ error: 'Failed to fetch trade' });
  }
});

export default router;
