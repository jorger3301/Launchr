/**
 * Launches Routes
 *
 * REST API endpoints for launch data.
 * Includes Metaplex DAS integration for token metadata.
 */

import { Router, Request, Response } from 'express';
import { IndexerService } from '../services/indexer';
import { MetaplexService } from '../services/metaplex';
import { logger } from '../utils/logger';

const router = Router();

// ---------------------------------------------------------------------------
// GET /api/launches - List all launches
// ---------------------------------------------------------------------------

router.get('/', async (req: Request, res: Response) => {
  try {
    const indexer: IndexerService = req.app.locals.indexer;
    
    const { 
      status, 
      sort = 'created', 
      order = 'desc',
      page = '1',
      limit = '20',
      search,
    } = req.query;

    let launches = await indexer.getAllLaunches();

    // Filter by status
    if (status && typeof status === 'string') {
      launches = launches.filter(l => l.status === status);
    }

    // Search
    if (search && typeof search === 'string') {
      launches = await indexer.searchLaunches(search);
    }

    // Sort
    const sortField = sort as string;
    const sortOrder = order === 'asc' ? 1 : -1;
    
    launches.sort((a: any, b: any) => {
      switch (sortField) {
        case 'price':
          return (a.currentPrice - b.currentPrice) * sortOrder;
        case 'volume':
          return (a.realSolReserve - b.realSolReserve) * sortOrder;
        case 'marketcap':
          return (a.marketCap - b.marketCap) * sortOrder;
        case 'holders':
          return (a.holderCount - b.holderCount) * sortOrder;
        case 'trades':
          return (a.tradeCount - b.tradeCount) * sortOrder;
        case 'created':
        default:
          return (a.createdAt - b.createdAt) * sortOrder;
      }
    });

    // Pagination
    const pageNum = parseInt(page as string);
    const limitNum = Math.min(parseInt(limit as string), 100);
    const startIndex = (pageNum - 1) * limitNum;
    const paginatedLaunches = launches.slice(startIndex, startIndex + limitNum);

    res.json({
      launches: paginatedLaunches,
      total: launches.length,
      page: pageNum,
      pageSize: limitNum,
      totalPages: Math.ceil(launches.length / limitNum),
    });

  } catch (error) {
    logger.error('Failed to get launches:', error);
    res.status(500).json({ error: 'Failed to fetch launches' });
  }
});

// ---------------------------------------------------------------------------
// GET /api/launches/trending - Get trending launches
// ---------------------------------------------------------------------------

router.get('/trending', async (req: Request, res: Response) => {
  try {
    const indexer: IndexerService = req.app.locals.indexer;
    const launches = await indexer.getTrendingLaunches();
    
    res.json({ launches });

  } catch (error) {
    logger.error('Failed to get trending launches:', error);
    res.status(500).json({ error: 'Failed to fetch trending launches' });
  }
});

// ---------------------------------------------------------------------------
// GET /api/launches/recent - Get recently created launches
// ---------------------------------------------------------------------------

router.get('/recent', async (req: Request, res: Response) => {
  try {
    const indexer: IndexerService = req.app.locals.indexer;
    const launches = await indexer.getRecentLaunches();
    
    res.json({ launches });

  } catch (error) {
    logger.error('Failed to get recent launches:', error);
    res.status(500).json({ error: 'Failed to fetch recent launches' });
  }
});

// ---------------------------------------------------------------------------
// GET /api/launches/graduated - Get graduated launches
// ---------------------------------------------------------------------------

router.get('/graduated', async (req: Request, res: Response) => {
  try {
    const indexer: IndexerService = req.app.locals.indexer;
    const launches = await indexer.getGraduatedLaunches();
    
    res.json({ launches });

  } catch (error) {
    logger.error('Failed to get graduated launches:', error);
    res.status(500).json({ error: 'Failed to fetch graduated launches' });
  }
});

// ---------------------------------------------------------------------------
// POST /api/launches/metadata - Get multiple token metadata (batch)
// ---------------------------------------------------------------------------

router.post('/metadata', async (req: Request, res: Response) => {
  try {
    const metaplex: MetaplexService | null = req.app.locals.metaplex;
    const { mints } = req.body;

    if (!mints || !Array.isArray(mints) || mints.length === 0) {
      res.status(400).json({ error: 'mints array required in request body' });
      return;
    }

    if (mints.length > 50) {
      res.status(400).json({ error: 'Maximum 50 mints per request' });
      return;
    }

    if (!metaplex) {
      // Return empty metadata if service not available
      const emptyMetadata: Record<string, any> = {};
      for (const mint of mints) {
        emptyMetadata[mint] = null;
      }
      res.json({ metadata: emptyMetadata });
      return;
    }

    const metadataMap = await metaplex.getMultipleTokenMetadata(mints);

    const metadata: Record<string, any> = {};
    for (const mint of mints) {
      const data = metadataMap.get(mint);
      metadata[mint] = data || null;
    }

    res.json({ metadata });

  } catch (error) {
    logger.error('Failed to get batch token metadata:', error);
    res.status(500).json({ error: 'Failed to fetch token metadata' });
  }
});

// ---------------------------------------------------------------------------
// GET /api/launches/:publicKey - Get single launch
// ---------------------------------------------------------------------------

router.get('/:publicKey', async (req: Request, res: Response) => {
  try {
    const indexer: IndexerService = req.app.locals.indexer;
    const { publicKey } = req.params;

    const launch = await indexer.getLaunch(publicKey);

    if (!launch) {
      return res.status(404).json({ error: 'Launch not found' });
    }

    res.json(launch);

  } catch (error) {
    logger.error('Failed to get launch:', error);
    res.status(500).json({ error: 'Failed to fetch launch' });
  }
});

// ---------------------------------------------------------------------------
// GET /api/launches/:publicKey/trades - Get launch trades
// ---------------------------------------------------------------------------

router.get('/:publicKey/trades', async (req: Request, res: Response) => {
  try {
    const indexer: IndexerService = req.app.locals.indexer;
    const { publicKey } = req.params;
    const { limit = '50' } = req.query;

    const rawTrades = await indexer.getRecentTrades(publicKey, parseInt(limit as string));

    // Transform to frontend-expected format
    const trades = rawTrades.map(trade => ({
      type: trade.type,
      user: trade.trader,
      amount: trade.tokenAmount,
      solAmount: trade.solAmount,
      price: trade.price,
      timestamp: trade.timestamp,
      txSignature: trade.signature,
    }));

    res.json({ trades });

  } catch (error) {
    logger.error('Failed to get trades:', error);
    res.status(500).json({ error: 'Failed to fetch trades' });
  }
});

// ---------------------------------------------------------------------------
// GET /api/launches/:publicKey/metadata - Get token metadata via Metaplex
// ---------------------------------------------------------------------------

router.get('/:publicKey/metadata', async (req: Request, res: Response) => {
  try {
    const metaplex: MetaplexService | null = req.app.locals.metaplex;
    const { publicKey } = req.params;

    if (!metaplex) {
      // Return null metadata if service not available
      res.json(null);
      return;
    }

    const metadata = await metaplex.getTokenMetadata(publicKey);

    if (!metadata) {
      res.status(404).json({ error: 'Token metadata not found' });
      return;
    }

    res.json(metadata);

  } catch (error) {
    logger.error('Failed to get token metadata:', error);
    res.status(500).json({ error: 'Failed to fetch token metadata' });
  }
});

export default router;
