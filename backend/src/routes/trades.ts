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

    const allTrades: TradeEvent[] = [];
    for (const launch of activeLaunches) {
      const launchTrades = await indexer.getRecentTrades(launch.publicKey, 10);
      allTrades.push(...launchTrades);
    }

    // Sort by timestamp descending
    allTrades.sort((a, b) => b.timestamp - a.timestamp);

    // Transform to frontend-expected format (TradeData)
    const trades = allTrades.slice(0, parsedLimit).map((trade) => ({
      type: trade.type,
      user: trade.trader,
      amount: trade.tokenAmount,
      solAmount: trade.solAmount,
      price: trade.price,
      timestamp: trade.timestamp,
      txSignature: trade.signature,
    }));

    res.json({
      trades,
      total: allTrades.length,
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

    // Search through cached trades for all launches
    const launches = await indexer.getAllLaunches();
    for (const launch of launches) {
      const trades = await indexer.getRecentTrades(launch.publicKey, 100);
      const found = trades.find(t => t.signature === signature);
      if (found) {
        res.json({
          type: found.type,
          user: found.trader,
          amount: found.tokenAmount,
          solAmount: found.solAmount,
          price: found.price,
          timestamp: found.timestamp,
          txSignature: found.signature,
        });
        return;
      }
    }

    res.status(404).json({ error: 'Trade not found' });

  } catch (error) {
    logger.error('Failed to get trade:', error);
    res.status(500).json({ error: 'Failed to fetch trade' });
  }
});

export default router;
