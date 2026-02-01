/**
 * Launchr API Server
 * 
 * Launch into Orbit 🚀
 * REST API and WebSocket server for the Launchr protocol.
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

import launchRoutes from './routes/launches';
import tradeRoutes from './routes/trades';
import statsRoutes from './routes/stats';
import userRoutes from './routes/users';
import healthRoutes from './routes/health';

dotenv.config();

// =============================================================================
// CONFIGURATION
// =============================================================================

const PORT = process.env.PORT || 3001;
const RPC_ENDPOINT = process.env.RPC_ENDPOINT || 'https://api.devnet.solana.com';
const PROGRAM_ID = process.env.PROGRAM_ID || 'LNCHRxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx';
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:3000';
const HELIUS_API_KEY = process.env.HELIUS_API_KEY || '';
const SOLANA_CLUSTER = (process.env.SOLANA_CLUSTER || 'devnet') as 'mainnet-beta' | 'devnet';

// =============================================================================
// APP SETUP
// =============================================================================

const app = express();
const server = createServer(app);

// Middleware
app.use(helmet());
app.use(compression());
app.use(cors({
  origin: CORS_ORIGIN.split(','),
  credentials: true,
}));
app.use(express.json({ limit: '1mb' }));
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

// WebSocket server
const wss = new WebSocketServer({ server, path: '/ws' });
const wsService = new WebSocketService(wss, indexerService);

// Initialize Solana ecosystem services
const jupiterService = initJupiter();
const jitoService = initJito();
const pythService = initPyth(SOLANA_CLUSTER);
const metaplexService = initMetaplex(RPC_ENDPOINT);

// Initialize Helius if API key is provided
const heliusService = HELIUS_API_KEY ? initHelius(HELIUS_API_KEY, SOLANA_CLUSTER) : null;

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

// =============================================================================
// ROUTES
// =============================================================================

app.use('/api/launches', launchRoutes);
app.use('/api/trades', tradeRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/users', userRoutes);
app.use('/health', healthRoutes);

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
      health: '/health',
      websocket: '/ws',
    },
    services: {
      jupiter: 'enabled',
      jito: 'enabled',
      pyth: 'enabled',
      metaplex: 'enabled',
      helius: heliusService ? 'enabled' : 'disabled (no API key)',
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

    // Initialize Jito with fastest block engine (non-blocking)
    jitoService.findFastestBlockEngine().catch(err => {
      logger.warn('Failed to find fastest Jito block engine:', err);
    });

    // Start HTTP server
    server.listen(PORT, () => {
      logger.info(`🚀 Launchr API running on port ${PORT}`);
      logger.info(`   RPC: ${RPC_ENDPOINT}`);
      logger.info(`   Program: ${PROGRAM_ID}`);
      logger.info(`   Jupiter: enabled`);
      logger.info(`   Jito: enabled`);
      logger.info(`   Pyth: enabled`);
      logger.info(`   Metaplex: enabled`);
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
