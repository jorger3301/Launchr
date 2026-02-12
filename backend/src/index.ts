/**
 * Launchr API Server
 *
 * Launch into Orbit 🚀
 * REST API and WebSocket server for the Launchr protocol.
 *
 * Security features:
 * - Rate limiting
 * - Request signing validation
 * - WebSocket rate limiting
 * - Trading anomaly detection
 * - Price staleness validation
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import { WebSocketServer } from 'ws';
import { createServer } from 'http';
import dotenv from 'dotenv';

import { logger } from './utils/logger';
import { SolanaService } from './services/solana';
import { IndexerService } from './services/indexer';
import { CacheService } from './services/cache';
import { WebSocketService } from './services/websocket';
import { initHelius, getHelius } from './services/helius';
import { initJupiter, getJupiter } from './services/jupiter';
import { initJito, getJito } from './services/jito';
import { initPyth, getPyth } from './services/pyth';
import { initMetaplex, getMetaplex } from './services/metaplex';
import { initMonitoring, getMonitoring, AlertType } from './services/monitoring';
import {
  securityHeaders,
  nonceHandler,
  startSecurityService,
  stopSecurityService,
  getSecurityStats,
} from './lib/security';

import { PriceAdapter, SwapEvent } from './services/price/adapter';

import path from 'path';
import launchRoutes from './routes/launches';
import tradeRoutes from './routes/trades';
import statsRoutes from './routes/stats';
import userRoutes from './routes/users';
import healthRoutes from './routes/health';
import uploadRoutes from './routes/upload';
import chartRoutes from './routes/chart';

dotenv.config();

// =============================================================================
// CONFIGURATION
// =============================================================================

const PORT = process.env.PORT || 3001;
const RPC_ENDPOINT = process.env.RPC_ENDPOINT || 'https://api.devnet.solana.com';
const PROGRAM_ID = process.env.PROGRAM_ID || '5LFTkjx2vRTkXaKvYtikEEJkvpTrx16feUspuxKgvsE8';
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:3000';
const HELIUS_API_KEY = process.env.HELIUS_API_KEY || '';
const SOLANA_CLUSTER = (process.env.SOLANA_CLUSTER || 'devnet') as 'mainnet-beta' | 'devnet';

// =============================================================================
// APP SETUP
// =============================================================================

const app = express();
const server = createServer(app);

// Trust proxy for Fly.io/Railway/Vercel (needed for rate limiting)
app.set('trust proxy', true);

// Security headers
app.use(securityHeaders());

// Middleware
app.use(helmet());
app.use(compression());
app.use(cors({
  origin: CORS_ORIGIN.split(','),
  credentials: true,
}));
app.use(express.json({ limit: '10mb' })); // Increased for base64 image uploads
app.use(express.urlencoded({ extended: true }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // 100 requests per minute
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
});
app.use('/api/', limiter);

// Request logging
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info(`${req.method} ${req.path} ${res.statusCode} ${duration}ms`);
  });
  next();
});

// =============================================================================
// SERVICES
// =============================================================================

const solanaService = new SolanaService(RPC_ENDPOINT, PROGRAM_ID);
const cacheService = new CacheService(REDIS_URL);
const indexerService = new IndexerService(solanaService, cacheService);

// WebSocket server with security features
const wss = new WebSocketServer({ server, path: '/ws' });
const wsService = new WebSocketService(wss, indexerService);

// Initialize Solana ecosystem services
const jupiterService = initJupiter();
const jitoService = initJito();
const pythService = initPyth(SOLANA_CLUSTER);
const metaplexService = initMetaplex(RPC_ENDPOINT);
const monitoringService = initMonitoring();

// Initialize Helius if API key is provided
const heliusService = HELIUS_API_KEY ? initHelius(HELIUS_API_KEY, SOLANA_CLUSTER) : null;

// Price adapter for Supabase chart data
const priceAdapter = new PriceAdapter(
  RPC_ENDPOINT,
  PROGRAM_ID,
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY,
);

// Wire up monitoring to indexer events
indexerService.on('trade', (trade) => {
  monitoringService.processTrade({
    launchPk: trade.launchPk,
    trader: trade.trader,
    type: trade.isBuy ? 'buy' : 'sell',
    solAmount: trade.solAmount / 1e9,
    tokenAmount: trade.tokenAmount / 1e9,
    price: trade.price,
    timestamp: trade.timestamp,
    signature: trade.signature,
  });
});

// Forward monitoring alerts to WebSocket
monitoringService.on('alert', (alert) => {
  wsService.broadcast('alerts', alert);
});

// Forward PriceAdapter swap events to WebSocket chart channels
priceAdapter.on('swap', (swap: SwapEvent) => {
  const channel = `chart:${swap.launchId}`;

  // Broadcast trade to chart channel
  wsService.broadcast(channel, {
    type: 'trade',
    signature: swap.signature,
    trader: swap.trader,
    swapType: swap.swapType,
    solAmount: Number(swap.solAmount) / 1e9,
    tokenAmount: Number(swap.tokenAmount),
    price: swap.price,
    time: swap.blockTime * 1000,
  });

  // Broadcast price update to chart channel
  wsService.broadcast(channel, {
    type: 'price',
    price: swap.price,
    priceUsd: swap.priceUsd,
    marketCapSol: swap.marketCapSol,
    time: swap.blockTime * 1000,
  });

  // Also broadcast to global trades feed
  wsService.broadcast('trades', {
    type: 'trade',
    launchId: swap.launchId,
    mint: swap.mint,
    swapType: swap.swapType,
    solAmount: Number(swap.solAmount) / 1e9,
    price: swap.price,
    time: swap.blockTime * 1000,
  });
});

// Make services available to routes
app.locals.solana = solanaService;
app.locals.cache = cacheService;
app.locals.indexer = indexerService;
app.locals.ws = wsService;
app.locals.jupiter = jupiterService;
app.locals.jito = jitoService;
app.locals.helius = heliusService;
app.locals.pyth = pythService;
app.locals.metaplex = metaplexService;
app.locals.monitoring = monitoringService;
app.locals.priceAdapter = priceAdapter;

// =============================================================================
// ROUTES
// =============================================================================

// Static file serving for uploads
// Override Helmet's Cross-Origin-Resource-Policy so the Vercel frontend
// can load images cross-origin via <img> tags.
app.use('/uploads', (_req, res, next) => {
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  next();
}, express.static(path.join(__dirname, '../uploads')));

app.use('/api/launches', launchRoutes);
app.use('/api/trades', tradeRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/users', userRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/chart', chartRoutes);
app.use('/health', healthRoutes);

// Nonce endpoint for wallet authentication
app.get('/api/auth/nonce', nonceHandler);

// Monitoring endpoints
app.get('/api/monitoring/alerts', (req, res) => {
  const { launchPk, trader, type, severity, limit } = req.query;

  // Valid alert types and severities
  const validAlertTypes: AlertType[] = [
    'large_trade', 'whale_trade', 'high_volume', 'rapid_price_change',
    'velocity_spike', 'wash_trading', 'suspicious_pattern', 'new_whale', 'repeated_trades'
  ];
  const validSeverities = ['info', 'warning', 'critical'] as const;

  const alerts = monitoringService.getAlerts({
    launchPk: typeof launchPk === 'string' ? launchPk : undefined,
    trader: typeof trader === 'string' ? trader : undefined,
    type: typeof type === 'string' && validAlertTypes.includes(type as AlertType) ? type as AlertType : undefined,
    severity: typeof severity === 'string' && validSeverities.includes(severity as typeof validSeverities[number]) ? severity as typeof validSeverities[number] : undefined,
    limit: typeof limit === 'string' ? parseInt(limit, 10) : undefined,
  });

  res.json({ alerts });
});

app.get('/api/monitoring/launch/:launchPk', (req, res) => {
  const metrics = monitoringService.getLaunchMetrics(req.params.launchPk);

  if (!metrics) {
    res.status(404).json({ error: 'Launch not found or no recent activity' });
    return;
  }

  res.json(metrics);
});

app.get('/api/monitoring/stats', (req, res) => {
  res.json(monitoringService.getStats());
});

// Security stats endpoint — restrict to localhost in production
app.get('/api/security/stats', (req, res) => {
  const ip = req.ip || req.socket.remoteAddress || '';
  const isLocal = ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1';
  if (process.env.NODE_ENV === 'production' && !isLocal) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  res.json(getSecurityStats());
});

// Pyth health check
app.get('/api/pyth/health', async (req, res) => {
  const health = await pythService.healthCheck();
  res.status(health.healthy ? 200 : 503).json(health);
});

// Pyth price with validation
app.get('/api/pyth/price/:symbol', async (req, res) => {
  const validated = await pythService.getValidatedPriceBySymbol(req.params.symbol);

  if (!validated) {
    res.status(404).json({ error: 'Price feed not found' });
    return;
  }

  res.json(validated);
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    name: 'Launchr API',
    version: '1.0.0',
    description: 'Launch into Orbit 🚀',
    endpoints: {
      launches: '/api/launches',
      trades: '/api/trades',
      stats: '/api/stats',
      users: '/api/users',
      upload: '/api/upload/metadata',
      health: '/health',
      websocket: '/ws',
      auth: '/api/auth/nonce',
      chart: '/api/chart/:launchId/candles',
      monitoring: '/api/monitoring/alerts',
      pyth: '/api/pyth/health',
    },
    services: {
      jupiter: 'enabled',
      jito: 'enabled',
      pyth: 'enabled',
      metaplex: 'enabled',
      monitoring: 'enabled',
      priceAdapter: process.env.SUPABASE_URL ? 'enabled' : 'disabled (no SUPABASE_URL)',
      helius: heliusService ? 'enabled' : 'disabled (no API key)',
    },
    security: {
      rateLimit: '100 req/min',
      wsRateLimit: '30 msg/sec',
      wsConnectionLimit: '5 per IP',
      signedRequests: 'optional (enabled per-route)',
      priceValidation: 'staleness + confidence checks',
      tradingMonitoring: 'anomaly detection enabled',
    },
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Error handler
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// =============================================================================
// STARTUP
// =============================================================================

async function start() {
  try {
    // Start security service
    startSecurityService();
    logger.info('Security service started');

    // Initialize cache (non-blocking, falls back to in-memory)
    try {
      await cacheService.connect();
      logger.info('Cache service connected');
    } catch (cacheError) {
      logger.warn('Cache connection failed, using in-memory cache');
    }

    // Start indexer
    await indexerService.start();
    logger.info('Indexer service started');

    // Start WebSocket service
    wsService.start();
    logger.info('WebSocket service started');

    // Start price adapter (non-blocking – gracefully continues without Supabase)
    priceAdapter.start().then(() => {
      // Populate launch cache from indexed launches
      indexerService.getAllLaunches().then(launches => {
        priceAdapter.updateLaunchCache(launches);
        logger.info(`[PriceAdapter] Launch cache populated with ${launches.length} launches`);
      }).catch(() => {});
    }).catch(err => {
      logger.warn('PriceAdapter start failed (continuing without it):', err);
    });

    // Refresh price adapter's launch cache whenever indexer re-indexes
    indexerService.on('launch:created', () => {
      indexerService.getAllLaunches().then(launches => {
        priceAdapter.updateLaunchCache(launches);
      }).catch(() => {});
    });

    // Initialize Jito with fastest block engine (non-blocking)
    jitoService.findFastestBlockEngine().catch(err => {
      logger.warn('Failed to find fastest Jito block engine:', err);
    });

    // Start HTTP server (bind to 0.0.0.0 for Docker/Fly.io)
    server.listen({ port: Number(PORT), host: '0.0.0.0' }, () => {
      logger.info(`🚀 Launchr API running on port ${PORT}`);
      logger.info(`   RPC: ${RPC_ENDPOINT}`);
      logger.info(`   Program: ${PROGRAM_ID}`);
      logger.info(`   Services: Jupiter, Jito, Pyth, Metaplex, Monitoring`);
      logger.info(`   Security: Rate limiting, WS limits, Anomaly detection`);
      logger.info(`   Helius: ${heliusService ? 'enabled' : 'disabled (set HELIUS_API_KEY)'}`);
    });

  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down...');

  indexerService.stop();
  wsService.stop();
  monitoringService.stop();
  await priceAdapter.stop();
  stopSecurityService();
  await cacheService.disconnect();

  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down...');
  process.exit(0);
});

start();

export { app, server };
