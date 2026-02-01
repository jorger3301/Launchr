/**
 * Health Routes
 * 
 * Health check endpoints for monitoring.
 */

import { Router, Request, Response } from 'express';
import { CacheService } from '../services/cache';
import { IndexerService } from '../services/indexer';
import { SolanaService } from '../services/solana';

const router = Router();

// ---------------------------------------------------------------------------
// GET /health - Basic health check
// ---------------------------------------------------------------------------

router.get('/', async (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// ---------------------------------------------------------------------------
// GET /health/ready - Readiness check
// ---------------------------------------------------------------------------

router.get('/ready', async (req: Request, res: Response) => {
  try {
    const cache: CacheService = req.app.locals.cache;
    const indexer: IndexerService = req.app.locals.indexer;
    const solana: SolanaService = req.app.locals.solana;

    const checks = {
      cache: cache.isReady(),
      indexer: indexer.getState().isRunning,
      solana: true, // Would check RPC connection
    };

    const allReady = Object.values(checks).every(Boolean);

    res.status(allReady ? 200 : 503).json({
      ready: allReady,
      checks,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    res.status(503).json({
      ready: false,
      error: 'Health check failed',
      timestamp: new Date().toISOString(),
    });
  }
});

// ---------------------------------------------------------------------------
// GET /health/live - Liveness check
// ---------------------------------------------------------------------------

router.get('/live', async (req: Request, res: Response) => {
  res.json({
    live: true,
    timestamp: new Date().toISOString(),
  });
});

// ---------------------------------------------------------------------------
// GET /health/detailed - Detailed system status
// ---------------------------------------------------------------------------

router.get('/detailed', async (req: Request, res: Response) => {
  try {
    const cache: CacheService = req.app.locals.cache;
    const indexer: IndexerService = req.app.locals.indexer;

    const memoryUsage = process.memoryUsage();

    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: {
        heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024) + 'MB',
        heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024) + 'MB',
        rss: Math.round(memoryUsage.rss / 1024 / 1024) + 'MB',
      },
      cache: cache.getStatus(),
      indexer: indexer.getState(),
      node: {
        version: process.version,
        platform: process.platform,
        arch: process.arch,
      },
    });

  } catch (error) {
    res.status(500).json({
      status: 'error',
      error: 'Failed to get detailed status',
      timestamp: new Date().toISOString(),
    });
  }
});

export default router;
