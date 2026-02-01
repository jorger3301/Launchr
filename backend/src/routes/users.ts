/**
 * Users Routes
 * 
 * REST API endpoints for user data.
 */

import { Router, Request, Response } from 'express';
import { PublicKey } from '@solana/web3.js';
import { SolanaService } from '../services/solana';
import { IndexerService } from '../services/indexer';
import { logger } from '../utils/logger';

const router = Router();

// ---------------------------------------------------------------------------
// GET /api/users/:address/positions - Get user's positions
// ---------------------------------------------------------------------------

router.get('/:address/positions', async (req: Request, res: Response) => {
  try {
    const solana: SolanaService = req.app.locals.solana;
    const indexer: IndexerService = req.app.locals.indexer;
    const { address } = req.params;

    // Validate address
    let userPubkey: PublicKey;
    try {
      userPubkey = new PublicKey(address);
    } catch {
      return res.status(400).json({ error: 'Invalid wallet address' });
    }

    // Get user positions from Solana
    const positions = await solana.getUserPositions(userPubkey);

    // Enrich with launch data
    const enrichedPositions = await Promise.all(
      positions.map(async (pos) => {
        const launch = await indexer.getLaunch(pos.launch);
        return {
          ...pos,
          launch: launch || { publicKey: pos.launch },
        };
      })
    );

    // Calculate totals
    const totalValue = enrichedPositions.reduce((sum, pos) => {
      const launch = pos.launch as any;
      if (launch.currentPrice) {
        return sum + (pos.tokenBalance * launch.currentPrice / 1e9);
      }
      return sum;
    }, 0);

    const totalPnl = enrichedPositions.reduce((sum, pos) => {
      const launch = pos.launch as any;
      if (launch.currentPrice && pos.costBasis) {
        const currentValue = pos.tokenBalance * launch.currentPrice / 1e9;
        return sum + (currentValue - pos.costBasis);
      }
      return sum;
    }, 0);

    res.json({
      positions: enrichedPositions,
      totalValue,
      totalPnl,
      positionCount: positions.length,
    });

  } catch (error) {
    logger.error('Failed to get user positions:', error);
    res.status(500).json({ error: 'Failed to fetch user positions' });
  }
});

// ---------------------------------------------------------------------------
// GET /api/users/:address/launches - Get launches created by user
// ---------------------------------------------------------------------------

router.get('/:address/launches', async (req: Request, res: Response) => {
  try {
    const indexer: IndexerService = req.app.locals.indexer;
    const { address } = req.params;

    // Validate address
    try {
      new PublicKey(address);
    } catch {
      return res.status(400).json({ error: 'Invalid wallet address' });
    }

    // Get all launches and filter by creator
    const launches = await indexer.getAllLaunches();
    const userLaunches = launches.filter(l => l.creator === address);

    res.json({
      launches: userLaunches,
      total: userLaunches.length,
    });

  } catch (error) {
    logger.error('Failed to get user launches:', error);
    res.status(500).json({ error: 'Failed to fetch user launches' });
  }
});

// ---------------------------------------------------------------------------
// GET /api/users/:address/stats - Get user statistics
// ---------------------------------------------------------------------------

router.get('/:address/stats', async (req: Request, res: Response) => {
  try {
    const solana: SolanaService = req.app.locals.solana;
    const indexer: IndexerService = req.app.locals.indexer;
    const { address } = req.params;

    // Validate address
    let userPubkey: PublicKey;
    try {
      userPubkey = new PublicKey(address);
    } catch {
      return res.status(400).json({ error: 'Invalid wallet address' });
    }

    // Get positions
    const positions = await solana.getUserPositions(userPubkey);

    // Get launches created
    const launches = await indexer.getAllLaunches();
    const userLaunches = launches.filter(l => l.creator === address);

    // Calculate stats
    const totalBuys = positions.reduce((sum, p) => sum + p.buyCount, 0);
    const totalSells = positions.reduce((sum, p) => sum + p.sellCount, 0);
    const totalSolSpent = positions.reduce((sum, p) => sum + p.solSpent, 0);
    const totalSolReceived = positions.reduce((sum, p) => sum + p.solReceived, 0);

    res.json({
      address,
      positionsCount: positions.length,
      launchesCreated: userLaunches.length,
      totalTrades: totalBuys + totalSells,
      totalBuys,
      totalSells,
      totalSolSpent,
      totalSolReceived,
      netSol: totalSolReceived - totalSolSpent,
    });

  } catch (error) {
    logger.error('Failed to get user stats:', error);
    res.status(500).json({ error: 'Failed to fetch user stats' });
  }
});

export default router;
