/**
 * Stats Routes
 *
 * REST API endpoints for protocol statistics.
 * Includes Pyth oracle price feeds integration.
 */

import { Router, Request, Response } from 'express';
import { IndexerService } from '../services/indexer';
import { WebSocketService } from '../services/websocket';
import { PythService, PYTH_PRICE_FEEDS } from '../services/pyth';
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

// ---------------------------------------------------------------------------
// GET /api/stats/sol-price - Get SOL/USD price from Pyth Oracle
// ---------------------------------------------------------------------------

router.get('/sol-price', async (req: Request, res: Response) => {
  try {
    const pyth: PythService | null = req.app.locals.pyth;

    if (!pyth) {
      // Return fallback price if Pyth service not available
      res.json({
        price: 100.0,
        confidence: 0.5,
        symbol: 'SOL/USD',
        publishTime: Math.floor(Date.now() / 1000),
        emaPrice: 100.0,
      });
      return;
    }

    const priceData = await pyth.getSolUsdPrice();

    if (!priceData) {
      res.json({
        price: 100.0,
        confidence: 0.5,
        symbol: 'SOL/USD',
        publishTime: Math.floor(Date.now() / 1000),
        emaPrice: 100.0,
      });
      return;
    }

    // Get full price data for more details
    const fullPriceData = await pyth.getPrice(PYTH_PRICE_FEEDS['SOL/USD']);

    res.json({
      price: priceData,
      confidence: fullPriceData?.confidence || 0,
      symbol: 'SOL/USD',
      publishTime: fullPriceData?.publishTime || Math.floor(Date.now() / 1000),
      emaPrice: fullPriceData?.emaPrice || priceData,
    });

  } catch (error) {
    logger.error('Failed to get SOL price:', error);
    // Return fallback on error
    res.json({
      price: 100.0,
      confidence: 0.5,
      symbol: 'SOL/USD',
      publishTime: Math.floor(Date.now() / 1000),
      emaPrice: 100.0,
    });
  }
});

// ---------------------------------------------------------------------------
// GET /api/stats/prices - Get multiple token prices from Pyth Oracle
// ---------------------------------------------------------------------------

router.get('/prices', async (req: Request, res: Response) => {
  try {
    const pyth: PythService | null = req.app.locals.pyth;
    const { symbols } = req.query;

    if (!symbols || typeof symbols !== 'string') {
      res.status(400).json({ error: 'symbols query parameter required' });
      return;
    }

    const symbolList = symbols.split(',').map(s => s.trim());
    const prices: Record<string, any> = {};

    if (!pyth) {
      // Return fallback prices
      for (const symbol of symbolList) {
        prices[symbol] = {
          price: 0,
          confidence: 0,
          symbol,
          publishTime: Math.floor(Date.now() / 1000),
          emaPrice: 0,
        };
      }
      res.json({ prices });
      return;
    }

    for (const symbol of symbolList) {
      const priceData = await pyth.getPriceBySymbol(symbol);
      if (priceData) {
        prices[symbol] = {
          price: priceData.price,
          confidence: priceData.confidence,
          symbol,
          publishTime: priceData.publishTime,
          emaPrice: priceData.emaPrice,
        };
      }
    }

    res.json({ prices });

  } catch (error) {
    logger.error('Failed to get prices:', error);
    res.status(500).json({ error: 'Failed to fetch prices' });
  }
});

export default router;
