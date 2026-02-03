/**
 * Users Routes
 *
 * REST API endpoints for user data.
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { PublicKey } from '@solana/web3.js';
import { SolanaService } from '../services/solana';
import { IndexerService } from '../services/indexer';
import { logger } from '../utils/logger';
import { LaunchAccount, TradeEvent, UserPositionAccount } from '../models/accounts';

const router = Router();

// =============================================================================
// TYPES
// =============================================================================

interface EnrichedPosition extends Omit<UserPositionAccount, 'launch'> {
  launch: LaunchAccount | { publicKey: string };
}

interface UserActivity {
  type: 'buy' | 'sell';
  launch: {
    publicKey: string;
    name: string;
    symbol: string;
    mint: string;
  };
  solAmount: number;
  tokenAmount: number;
  price: number;
  timestamp: number;
  signature: string;
}

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
      const launch = pos.launch;
      if ('currentPrice' in launch && launch.currentPrice) {
        return sum + (pos.tokenBalance * launch.currentPrice / 1e9);
      }
      return sum;
    }, 0);

    const totalPnl = enrichedPositions.reduce((sum, pos) => {
      const launch = pos.launch;
      if ('currentPrice' in launch && launch.currentPrice && pos.costBasis) {
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

// ---------------------------------------------------------------------------
// GET /api/users/:address/activity - Get user's recent activity
// ---------------------------------------------------------------------------

router.get('/:address/activity', async (req: Request, res: Response) => {
  try {
    const indexer: IndexerService = req.app.locals.indexer;
    const { address } = req.params;
    const limit = parseInt(req.query.limit as string) || 50;

    // Validate address
    try {
      new PublicKey(address);
    } catch {
      return res.status(400).json({ error: 'Invalid wallet address' });
    }

    // Get all launches and collect user's trades from each
    const launches = await indexer.getAllLaunches();
    const allActivity: UserActivity[] = [];

    // Collect trades from each launch
    await Promise.all(
      launches.slice(0, 20).map(async (launch) => {
        const trades = await indexer.getRecentTrades(launch.publicKey, 100);
        const userTrades = trades.filter((t: TradeEvent) => t.trader === address);

        for (const trade of userTrades) {
          allActivity.push({
            type: trade.type,
            launch: {
              publicKey: launch.publicKey,
              name: launch.name,
              symbol: launch.symbol,
              mint: launch.mint,
            },
            solAmount: trade.solAmount,
            tokenAmount: trade.tokenAmount,
            price: trade.price,
            timestamp: trade.timestamp,
            signature: trade.signature,
          });
        }
      })
    );

    // Sort by timestamp descending
    allActivity.sort((a, b) => b.timestamp - a.timestamp);

    res.json({
      activity: allActivity.slice(0, limit),
      total: allActivity.length,
    });
  } catch (error) {
    logger.error('Failed to get user activity:', error);
    res.status(500).json({ error: 'Failed to fetch user activity' });
  }
});

// ---------------------------------------------------------------------------
// GET /api/users/:address/balances - Get user's token balances for a launch
// ---------------------------------------------------------------------------

router.get('/:address/balances/:launchPk', async (req: Request, res: Response) => {
  try {
    const solana: SolanaService = req.app.locals.solana;
    const indexer: IndexerService = req.app.locals.indexer;
    const { address, launchPk } = req.params;

    // Validate addresses
    let userPubkey: PublicKey;
    let launchPubkey: PublicKey;
    try {
      userPubkey = new PublicKey(address);
      launchPubkey = new PublicKey(launchPk);
    } catch {
      return res.status(400).json({ error: 'Invalid address' });
    }

    // Get launch details
    const launch = await indexer.getLaunch(launchPk);
    if (!launch) {
      return res.status(404).json({ error: 'Launch not found' });
    }

    // Get user's token balance
    const tokenBalance = await solana.getTokenBalance(userPubkey, new PublicKey(launch.mint));

    // Get user's SOL balance
    const solBalance = await solana.getSolBalance(userPubkey);

    // Get user's position for this launch
    const positions = await solana.getUserPositions(userPubkey);
    const position = positions.find(p => p.launch === launchPk);

    res.json({
      solBalance,
      tokenBalance,
      tokenSymbol: launch.symbol,
      position: position || null,
      tokenValue: tokenBalance * launch.currentPrice,
    });
  } catch (error) {
    logger.error('Failed to get user balances:', error);
    res.status(500).json({ error: 'Failed to fetch user balances' });
  }
});

export default router;
