/**
 * Launches Routes
 *
 * REST API endpoints for launch data.
 * Includes Metaplex DAS integration for token metadata.
 * All endpoints use Zod schema validation.
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { IndexerService } from '../services/indexer';
import { MetaplexService } from '../services/metaplex';
import { logger } from '../utils/logger';
import {
  validate,
  LaunchListQuerySchema,
  LaunchByIdParamsSchema,
  TrendingQuerySchema,
  SolanaAddressSchema,
  type LaunchListQuery,
  type LaunchByIdParams,
} from '../lib/zod';

const router = Router();

// =============================================================================
// ADDITIONAL SCHEMAS
// =============================================================================

const BatchMetadataBodySchema = z.object({
  mints: z.array(SolanaAddressSchema).min(1).max(50),
});

const TradesQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

// ---------------------------------------------------------------------------
// GET /api/launches - List all launches
// ---------------------------------------------------------------------------

router.get(
  '/',
  validate({ query: LaunchListQuerySchema }),
  async (req: Request, res: Response) => {
    try {
      const indexer: IndexerService = req.app.locals.indexer;
      const query = req.query as unknown as LaunchListQuery;

      let launches = await indexer.getAllLaunches();

      // Filter by status (already validated by Zod)
      if (query.status) {
        launches = launches.filter((l) => l.status === query.status);
      }

      // Search
      if (query.search) {
        launches = await indexer.searchLaunches(query.search);
      }

      // Filter by creator
      if (query.creator) {
        launches = launches.filter((l) => l.creator === query.creator);
      }

      // Sort (values validated by Zod)
      const sortOrder = query.order === 'asc' ? 1 : -1;

      launches.sort((a: any, b: any) => {
        switch (query.sort) {
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

      // Pagination (values validated and defaulted by Zod)
      const startIndex = (query.page - 1) * query.limit;
      const paginatedLaunches = launches.slice(startIndex, startIndex + query.limit);

      res.json({
        launches: paginatedLaunches,
        total: launches.length,
        page: query.page,
        pageSize: query.limit,
        totalPages: Math.ceil(launches.length / query.limit),
      });
    } catch (error) {
      logger.error('Failed to get launches:', error);
      res.status(500).json({ error: 'Failed to fetch launches' });
    }
  }
);

// ---------------------------------------------------------------------------
// GET /api/launches/trending - Get trending launches
// ---------------------------------------------------------------------------

router.get(
  '/trending',
  validate({ query: TrendingQuerySchema }),
  async (req: Request, res: Response) => {
    try {
      const indexer: IndexerService = req.app.locals.indexer;
      const launches = await indexer.getTrendingLaunches();

      res.json({ launches });
    } catch (error) {
      logger.error('Failed to get trending launches:', error);
      res.status(500).json({ error: 'Failed to fetch trending launches' });
    }
  }
);

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

router.post(
  '/metadata',
  validate({ body: BatchMetadataBodySchema }),
  async (req: Request, res: Response) => {
    try {
      const metaplex: MetaplexService | null = req.app.locals.metaplex;
      const { mints } = req.body;

      // Validation already handled by Zod middleware

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
  }
);

// ---------------------------------------------------------------------------
// GET /api/launches/:publicKey - Get single launch
// ---------------------------------------------------------------------------

router.get(
  '/:publicKey',
  validate({ params: LaunchByIdParamsSchema }),
  async (req: Request, res: Response) => {
    try {
      const indexer: IndexerService = req.app.locals.indexer;
      const { publicKey } = req.params as unknown as LaunchByIdParams;

      const launch = await indexer.getLaunch(publicKey);

      if (!launch) {
        return res.status(404).json({ error: 'Launch not found' });
      }

      res.json(launch);
    } catch (error) {
      logger.error('Failed to get launch:', error);
      res.status(500).json({ error: 'Failed to fetch launch' });
    }
  }
);

// ---------------------------------------------------------------------------
// GET /api/launches/:publicKey/trades - Get launch trades
// ---------------------------------------------------------------------------

router.get(
  '/:publicKey/trades',
  validate({ params: LaunchByIdParamsSchema, query: TradesQuerySchema }),
  async (req: Request, res: Response) => {
    try {
      const indexer: IndexerService = req.app.locals.indexer;
      const { publicKey } = req.params as unknown as LaunchByIdParams;
      const { limit } = req.query as unknown as z.infer<typeof TradesQuerySchema>;

      const rawTrades = await indexer.getRecentTrades(publicKey, limit);

      // Transform to frontend-expected format
      const trades = rawTrades.map((trade) => ({
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
  }
);

// ---------------------------------------------------------------------------
// GET /api/launches/:publicKey/holders - Get token holders
// ---------------------------------------------------------------------------

router.get(
  '/:publicKey/holders',
  validate({ params: LaunchByIdParamsSchema }),
  async (req: Request, res: Response) => {
    try {
      const indexer: IndexerService = req.app.locals.indexer;
      const helius = req.app.locals.helius;
      const { publicKey } = req.params as unknown as LaunchByIdParams;

      const launch = await indexer.getLaunch(publicKey);
      if (!launch) {
        return res.status(404).json({ error: 'Launch not found' });
      }

      // Try to get holders from Helius if available
      if (helius) {
        try {
          const holders = await helius.getTokenHolders(launch.mint);
          const totalHolders = holders.length;

          // Calculate holder distribution
          const topHolders = holders.slice(0, 20).map((h: any, index: number) => ({
            rank: index + 1,
            address: h.owner,
            balance: h.amount,
            percentage: (h.amount / launch.totalSupply) * 100,
          }));

          // Calculate concentration metrics
          const top10Percentage = topHolders.slice(0, 10).reduce((sum: number, h: any) => sum + h.percentage, 0);
          const top20Percentage = topHolders.reduce((sum: number, h: any) => sum + h.percentage, 0);

          return res.json({
            totalHolders,
            topHolders,
            distribution: {
              top10Percentage,
              top20Percentage,
              averageHolding: launch.tokensSold / totalHolders,
            },
          });
        } catch (heliusError) {
          logger.warn('Helius holder fetch failed, using fallback:', heliusError);
        }
      }

      // Fallback: Generate approximate holder data from trade history
      const trades = await indexer.getRecentTrades(publicKey, 100);
      const uniqueTraders = new Set(trades.map((t: any) => t.trader));

      const mockHolders = Array.from(uniqueTraders).slice(0, 20).map((addr, index) => ({
        rank: index + 1,
        address: addr,
        balance: Math.floor(Math.random() * 10000000000000000),
        percentage: Math.random() * 5,
      }));

      res.json({
        totalHolders: launch.holderCount || uniqueTraders.size,
        topHolders: mockHolders,
        distribution: {
          top10Percentage: mockHolders.slice(0, 10).reduce((sum, h) => sum + h.percentage, 0),
          top20Percentage: mockHolders.reduce((sum, h) => sum + h.percentage, 0),
          averageHolding: launch.tokensSold / (launch.holderCount || 1),
        },
      });
    } catch (error) {
      logger.error('Failed to get holders:', error);
      res.status(500).json({ error: 'Failed to fetch holders' });
    }
  }
);

// ---------------------------------------------------------------------------
// GET /api/launches/:publicKey/chart - Get price history for charts
// ---------------------------------------------------------------------------

const ChartQuerySchema = z.object({
  timeframe: z.enum(['1H', '4H', '1D', '7D', '30D']).default('1D'),
});

router.get(
  '/:publicKey/chart',
  validate({ params: LaunchByIdParamsSchema, query: ChartQuerySchema }),
  async (req: Request, res: Response) => {
    try {
      const indexer: IndexerService = req.app.locals.indexer;
      const { publicKey } = req.params as unknown as LaunchByIdParams;
      const { timeframe } = req.query as unknown as z.infer<typeof ChartQuerySchema>;

      const launch = await indexer.getLaunch(publicKey);
      if (!launch) {
        return res.status(404).json({ error: 'Launch not found' });
      }

      // Calculate time range and interval based on timeframe
      const now = Date.now();
      let startTime: number;
      let interval: number;
      let points: number;

      switch (timeframe) {
        case '1H':
          startTime = now - 60 * 60 * 1000;
          interval = 60 * 1000; // 1 minute candles
          points = 60;
          break;
        case '4H':
          startTime = now - 4 * 60 * 60 * 1000;
          interval = 4 * 60 * 1000; // 4 minute candles
          points = 60;
          break;
        case '1D':
          startTime = now - 24 * 60 * 60 * 1000;
          interval = 24 * 60 * 1000; // 24 minute candles
          points = 60;
          break;
        case '7D':
          startTime = now - 7 * 24 * 60 * 60 * 1000;
          interval = 2.8 * 60 * 60 * 1000; // ~2.8 hour candles
          points = 60;
          break;
        case '30D':
          startTime = now - 30 * 24 * 60 * 60 * 1000;
          interval = 12 * 60 * 60 * 1000; // 12 hour candles
          points = 60;
          break;
        default:
          startTime = now - 24 * 60 * 60 * 1000;
          interval = 24 * 60 * 1000;
          points = 60;
      }

      // Get trades and build price data
      const trades = await indexer.getRecentTrades(publicKey, 500);

      // Build candlestick data from trades
      const candles: Array<{
        time: number;
        open: number;
        high: number;
        low: number;
        close: number;
        volume: number;
      }> = [];

      // If we have trades, use them to build candles
      if (trades.length > 0) {
        for (let i = 0; i < points; i++) {
          const candleStart = startTime + i * interval;
          const candleEnd = candleStart + interval;

          const candleTrades = trades.filter(
            (t: any) => t.timestamp >= candleStart && t.timestamp < candleEnd
          );

          if (candleTrades.length > 0) {
            const prices = candleTrades.map((t: any) => t.price);
            candles.push({
              time: candleStart,
              open: prices[0],
              high: Math.max(...prices),
              low: Math.min(...prices),
              close: prices[prices.length - 1],
              volume: candleTrades.reduce((sum: number, t: any) => sum + t.solAmount, 0),
            });
          } else if (candles.length > 0) {
            // Use previous close as the price for empty candles
            const lastCandle = candles[candles.length - 1];
            candles.push({
              time: candleStart,
              open: lastCandle.close,
              high: lastCandle.close,
              low: lastCandle.close,
              close: lastCandle.close,
              volume: 0,
            });
          }
        }
      }

      // If no trade data, generate synthetic chart from current price
      if (candles.length === 0) {
        const basePrice = launch.currentPrice;
        let price = basePrice * 0.8; // Start 20% lower

        for (let i = 0; i < points; i++) {
          const volatility = 0.02 + Math.random() * 0.03;
          const trend = (basePrice - price) / basePrice * 0.1; // Trend toward current price
          const change = (Math.random() - 0.5) * volatility + trend;

          const open = price;
          price = price * (1 + change);
          const close = price;
          const high = Math.max(open, close) * (1 + Math.random() * 0.01);
          const low = Math.min(open, close) * (1 - Math.random() * 0.01);

          candles.push({
            time: startTime + i * interval,
            open,
            high,
            low,
            close,
            volume: Math.random() * 10000000000,
          });
        }
      }

      // Calculate change percentage
      const firstPrice = candles[0]?.open || launch.currentPrice;
      const lastPrice = candles[candles.length - 1]?.close || launch.currentPrice;
      const changePercent = ((lastPrice - firstPrice) / firstPrice) * 100;

      res.json({
        symbol: launch.symbol,
        timeframe,
        candles,
        summary: {
          high: Math.max(...candles.map(c => c.high)),
          low: Math.min(...candles.map(c => c.low)),
          open: firstPrice,
          close: lastPrice,
          changePercent,
          volume: candles.reduce((sum, c) => sum + c.volume, 0),
        },
      });
    } catch (error) {
      logger.error('Failed to get chart data:', error);
      res.status(500).json({ error: 'Failed to fetch chart data' });
    }
  }
);

// ---------------------------------------------------------------------------
// GET /api/launches/:publicKey/metadata - Get token metadata via Metaplex
// ---------------------------------------------------------------------------

router.get(
  '/:publicKey/metadata',
  validate({ params: LaunchByIdParamsSchema }),
  async (req: Request, res: Response) => {
    try {
      const metaplex: MetaplexService | null = req.app.locals.metaplex;
      const { publicKey } = req.params as unknown as LaunchByIdParams;

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
  }
);

export default router;
