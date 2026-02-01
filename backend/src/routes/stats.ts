/**
 * Stats Routes
 * 
 * REST API endpoints for protocol statistics.
 */

import { Router, Request, Response } from 'express';
import { IndexerService } from '../services/indexer';
import { WebSocketService } from '../services/websocket';
import { logger } from '../utils/logger';

const router = Router();

// ---------------------------------------------------------------------------
// GET /api/stats - Get global protocol stats
// ---------------------------------------------------------------------------

router.get('/', async (req: Request, res: Response) => {
  try {
    const indexer: IndexerService = req.app.locals.indexer;
    const rawStats = await indexer.getGlobalStats();

    // Calculate fees:
    // - 1% platform fee on all trades (goes to treasury)
    // - Plus 3 SOL per graduation (treasury fee on graduation)
    const tradingFees = Math.floor((rawStats.totalVolume || 0) * 0.01); // 1% of volume
    const graduationFees = (rawStats.graduatedLaunches || 0) * 3_000_000_000; // 3 SOL per graduation
    const totalFees = tradingFees + graduationFees;

    // Map to frontend expected format
    const stats = {
      totalLaunches: rawStats.totalLaunches || 0,
      totalGraduated: rawStats.graduatedLaunches || 0,
      totalVolume: rawStats.totalVolume || 0,
      totalFees: totalFees,
    };

    res.json({ stats });

  } catch (error) {
    logger.error('Failed to get stats:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// ---------------------------------------------------------------------------
// GET /api/stats/leaderboard - Get top launches
// ---------------------------------------------------------------------------

router.get('/leaderboard', async (req: Request, res: Response) => {
  try {
    const indexer: IndexerService = req.app.locals.indexer;
    const { by = 'volume', limit = '10' } = req.query;

    const launches = await indexer.getAllLaunches();
    
    let sorted: typeof launches;
    switch (by) {
      case 'marketcap':
        sorted = [...launches].sort((a, b) => b.marketCap - a.marketCap);
        break;
      case 'holders':
        sorted = [...launches].sort((a, b) => b.holderCount - a.holderCount);
        break;
      case 'trades':
        sorted = [...launches].sort((a, b) => b.tradeCount - a.tradeCount);
        break;
      case 'volume':
      default:
        sorted = [...launches].sort((a, b) => b.realSolReserve - a.realSolReserve);
    }

    res.json({
      leaderboard: sorted.slice(0, parseInt(limit as string)),
      metric: by,
    });

  } catch (error) {
    logger.error('Failed to get leaderboard:', error);
    res.status(500).json({ error: 'Failed to fetch leaderboard' });
  }
});

// ---------------------------------------------------------------------------
// GET /api/stats/websocket - Get WebSocket stats
// ---------------------------------------------------------------------------

router.get('/websocket', async (req: Request, res: Response) => {
  try {
    const ws: WebSocketService = req.app.locals.ws;
    const stats = ws.getStats();
    
    res.json(stats);

  } catch (error) {
    logger.error('Failed to get WebSocket stats:', error);
    res.status(500).json({ error: 'Failed to fetch WebSocket stats' });
  }
});

// ---------------------------------------------------------------------------
// GET /api/stats/indexer - Get indexer stats
// ---------------------------------------------------------------------------

router.get('/indexer', async (req: Request, res: Response) => {
  try {
    const indexer: IndexerService = req.app.locals.indexer;
    const state = indexer.getState();
    
    res.json(state);

  } catch (error) {
    logger.error('Failed to get indexer stats:', error);
    res.status(500).json({ error: 'Failed to fetch indexer stats' });
  }
});

export default router;
