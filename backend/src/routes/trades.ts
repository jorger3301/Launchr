/**
 * Trades Routes
 * 
 * REST API endpoints for trade data.
 */

import { Router, Request, Response } from 'express';
import { IndexerService } from '../services/indexer';
import { logger } from '../utils/logger';

const router = Router();

// ---------------------------------------------------------------------------
// GET /api/trades/recent - Get recent trades across all launches
// ---------------------------------------------------------------------------

router.get('/recent', async (req: Request, res: Response) => {
  try {
    const indexer: IndexerService = req.app.locals.indexer;
    const { limit = '50' } = req.query;

    // Get all launches and their recent trades
    const launches = await indexer.getAllLaunches();
    
    // For now, return empty - in production, aggregate from all launches
    const trades: any[] = [];

    // Sort by timestamp descending
    trades.sort((a, b) => b.timestamp - a.timestamp);

    res.json({ 
      trades: trades.slice(0, parseInt(limit as string)),
      total: trades.length,
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
    const { signature } = req.params;

    // In production, fetch from cache or Solana
    // For now, return 404
    res.status(404).json({ error: 'Trade not found' });

  } catch (error) {
    logger.error('Failed to get trade:', error);
    res.status(500).json({ error: 'Failed to fetch trade' });
  }
});

export default router;
