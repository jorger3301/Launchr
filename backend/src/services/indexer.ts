/**
 * Indexer Service
 *
 * Indexes and caches Launchr program data for fast API responses.
 */

import { PublicKey } from '@solana/web3.js';
import { SolanaService } from './solana';
import { CacheService } from './cache';
import { logger } from '../utils/logger';
import { LaunchAccount, TradeEvent } from '../models/accounts';
import { EventEmitter } from 'events';

// =============================================================================
// MOCK DATA (for development/testing)
// =============================================================================

// Check at runtime (after dotenv.config() runs in index.ts)
// Only use mock data when explicitly opted in via USE_MOCK_DATA=true
const useMockData = () => process.env.USE_MOCK_DATA === 'true';

/**
 * LAUNCHR TOKENOMICS:
 *
 * Token Supply Distribution:
 * - 80% (800B tokens) = Sold on bonding curve
 * - 20% (200B tokens) = Reserved for LP migration
 *
 * Bonding Curve:
 * - Graduation threshold: 85 SOL
 * - Platform fee: 1% on all trades (goes to treasury)
 *
 * On Graduation (100% bonding curve complete):
 * - 80 SOL → LP migration (paired with 20% token reserve)
 * - 2 SOL  → Token creator
 * - 3 SOL  → Launchr treasury
 * - Total: 85 SOL
 */

// These exceed Number.MAX_SAFE_INTEGER but the ~128-unit precision loss
// at 1e18 is negligible for mock data display purposes.
const TOTAL_SUPPLY = 1_000_000_000_000_000_000; // 1 billion tokens (with 9 decimals)
const BONDING_CURVE_TOKENS = 800_000_000_000_000_000; // 80% for bonding curve
const LP_RESERVE_TOKENS = 200_000_000_000_000_000; // 20% for LP migration
const GRADUATION_THRESHOLD = 85_000_000_000; // 85 SOL in lamports
const LP_SOL_AMOUNT = 80_000_000_000; // 80 SOL for LP
const CREATOR_SOL_REWARD = 2_000_000_000; // 2 SOL to creator
const TREASURY_SOL_FEE = 3_000_000_000; // 3 SOL to Launchr treasury
const PLATFORM_FEE_BPS = 100; // 1% platform fee (100 basis points)

const MOCK_LAUNCHES: LaunchAccount[] = [
  {
    publicKey: 'LNCHMock111111111111111111111111111111111111',
    mint: 'MNTMock1111111111111111111111111111111111111',
    creator: 'CRTRMock111111111111111111111111111111111111',
    status: 'Active',
    name: 'OrbitCat',
    symbol: 'OCAT',
    uri: 'https://arweave.net/mock1',
    totalSupply: TOTAL_SUPPLY,
    tokensSold: 400_000_000_000_000_000, // 50% of bonding curve sold
    graduationTokens: BONDING_CURVE_TOKENS,
    creatorTokens: 0, // Creator doesn't get tokens, only SOL on graduation
    virtualSolReserve: 30_000_000_000, // Virtual reserve for pricing
    virtualTokenReserve: BONDING_CURVE_TOKENS,
    realSolReserve: 42_500_000_000, // ~42.5 SOL raised (50% progress)
    realTokenReserve: 400_000_000_000_000_000, // Remaining tokens in curve
    graduationThreshold: GRADUATION_THRESHOLD,
    createdAt: Math.floor(Date.now() / 1000) - 86400,
    tradeCount: 1247,
    holderCount: 342,
    orbitPool: '',
    creatorFeeBps: 0, // Platform fee handled separately
    currentPrice: 0.000000085,
    marketCap: 85000,
  },
  {
    publicKey: 'LNCHMock222222222222222222222222222222222222',
    mint: 'MNTMock2222222222222222222222222222222222222',
    creator: 'CRTRMock222222222222222222222222222222222222',
    status: 'PendingGraduation',
    name: 'RocketDoge',
    symbol: 'RDOGE',
    uri: 'https://arweave.net/mock2',
    totalSupply: TOTAL_SUPPLY,
    tokensSold: 780_000_000_000_000_000, // 97.5% of bonding curve sold
    graduationTokens: BONDING_CURVE_TOKENS,
    creatorTokens: 0,
    virtualSolReserve: 30_000_000_000,
    virtualTokenReserve: 20_000_000_000_000_000, // Very little left
    realSolReserve: 83_000_000_000, // ~83 SOL, close to graduation!
    realTokenReserve: 20_000_000_000_000_000,
    graduationThreshold: GRADUATION_THRESHOLD,
    createdAt: Math.floor(Date.now() / 1000) - 172800,
    tradeCount: 2891,
    holderCount: 876,
    orbitPool: '',
    creatorFeeBps: 0,
    currentPrice: 0.00000018,
    marketCap: 180000,
  },
  {
    publicKey: 'LNCHMock333333333333333333333333333333333333',
    mint: 'MNTMock3333333333333333333333333333333333333',
    creator: 'CRTRMock333333333333333333333333333333333333',
    status: 'Graduated',
    name: 'MoonPepe',
    symbol: 'MPEPE',
    uri: 'https://arweave.net/mock3',
    totalSupply: TOTAL_SUPPLY,
    tokensSold: BONDING_CURVE_TOKENS, // 100% sold = graduated
    graduationTokens: BONDING_CURVE_TOKENS,
    creatorTokens: 0,
    virtualSolReserve: 30_000_000_000,
    virtualTokenReserve: 0, // All sold
    realSolReserve: 0, // SOL distributed: 80 LP, 2 creator, 3 treasury
    realTokenReserve: 0,
    graduationThreshold: GRADUATION_THRESHOLD,
    createdAt: Math.floor(Date.now() / 1000) - 604800,
    graduatedAt: Math.floor(Date.now() / 1000) - 86400,
    tradeCount: 5432,
    holderCount: 1543,
    orbitPool: 'ORBTPool11111111111111111111111111111111111',
    creatorFeeBps: 0,
    currentPrice: 0.00000025, // Price set by Orbit LP
    marketCap: 250000,
  },
  {
    publicKey: 'LNCHMock444444444444444444444444444444444444',
    mint: 'MNTMock4444444444444444444444444444444444444',
    creator: 'CRTRMock444444444444444444444444444444444444',
    status: 'Active',
    name: 'SolanaShiba',
    symbol: 'SSHIB',
    uri: 'https://arweave.net/mock4',
    totalSupply: TOTAL_SUPPLY,
    tokensSold: 120_000_000_000_000_000, // 15% of bonding curve sold
    graduationTokens: BONDING_CURVE_TOKENS,
    creatorTokens: 0,
    virtualSolReserve: 30_000_000_000,
    virtualTokenReserve: 680_000_000_000_000_000,
    realSolReserve: 12_750_000_000, // ~12.75 SOL raised (15% progress)
    realTokenReserve: 680_000_000_000_000_000,
    graduationThreshold: GRADUATION_THRESHOLD,
    createdAt: Math.floor(Date.now() / 1000) - 3600,
    tradeCount: 89,
    holderCount: 45,
    orbitPool: '',
    creatorFeeBps: 0,
    currentPrice: 0.000000035,
    marketCap: 35000,
  },
];

function generateMockTrades(count: number): TradeEvent[] {
  const trades: TradeEvent[] = [];
  const now = Math.floor(Date.now() / 1000);

  for (let i = 0; i < count; i++) {
    const isBuy = Math.random() > 0.4;
    const solAmount = (Math.random() * 5 + 0.01) * 1e9;
    const tokenAmount = (Math.random() * 50000000 + 100000) * 1e9;

    trades.push({
      signature: `MockSig${Math.random().toString(36).substr(2, 44)}`,
      type: isBuy ? 'buy' : 'sell',
      launch: MOCK_LAUNCHES[0].publicKey,
      trader: `Trader${Math.random().toString(36).substr(2, 40)}`,
      solAmount,
      tokenAmount,
      price: solAmount / tokenAmount,
      timestamp: now - Math.floor(Math.random() * 86400),
    });
  }

  return trades.sort((a, b) => b.timestamp - a.timestamp);
}

// =============================================================================
// TYPES
// =============================================================================

interface IndexerState {
  isRunning: boolean;
  lastIndexedSlot: number;
  launchCount: number;
  tradeCount: number;
}

// =============================================================================
// INDEXER SERVICE
// =============================================================================

export class IndexerService extends EventEmitter {
  private solana: SolanaService;
  private cache: CacheService;
  private state: IndexerState;
  private subscriptionIds: number[] = [];
  private indexInterval: NodeJS.Timeout | null = null;

  // Cache TTLs (seconds)
  private readonly LAUNCHES_TTL = 30;
  private readonly LAUNCH_TTL = 10;
  private readonly STATS_TTL = 60;
  private readonly TRADES_TTL = 15;

  constructor(solana: SolanaService, cache: CacheService) {
    super();
    this.solana = solana;
    this.cache = cache;
    this.state = {
      isRunning: false,
      lastIndexedSlot: 0,
      launchCount: 0,
      tradeCount: 0,
    };
  }

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  async start(): Promise<void> {
    if (this.state.isRunning) return;

    logger.info('Starting indexer service...');
    this.state.isRunning = true;

    // Initial index
    await this.indexAll();

    // Subscribe to program changes
    this.subscribeToChanges();

    // Periodic re-indexing (every 30 seconds)
    this.indexInterval = setInterval(() => {
      this.indexAll().catch(err => logger.error('Index error:', err));
    }, 30000);

    logger.info('Indexer service started');
  }

  stop(): void {
    if (!this.state.isRunning) return;

    logger.info('Stopping indexer service...');
    this.state.isRunning = false;

    // Unsubscribe
    this.subscriptionIds.forEach(id => {
      this.solana.unsubscribe(id);
    });
    this.subscriptionIds = [];

    // Clear interval
    if (this.indexInterval) {
      clearInterval(this.indexInterval);
      this.indexInterval = null;
    }

    logger.info('Indexer service stopped');
  }

  getState(): IndexerState {
    return { ...this.state };
  }

  // ---------------------------------------------------------------------------
  // Indexing
  // ---------------------------------------------------------------------------

  private async indexAll(): Promise<void> {
    try {
      // Index all launches (use mock data in development)
      const launches = useMockData() ? MOCK_LAUNCHES : await this.solana.getAllLaunches();
      this.state.launchCount = launches.length;

      if (useMockData()) {
        logger.info('Using mock data (USE_MOCK_DATA=true)');
      } else if (launches.length === 0) {
        logger.warn('Indexer found 0 launches on-chain. Check PROGRAM_ID and RPC_ENDPOINT.');
      }

      // Cache launches list
      await this.cache.set('launches:all', JSON.stringify(launches), this.LAUNCHES_TTL);

      // Cache individual launches
      for (const launch of launches) {
        await this.cache.set(`launch:${launch.publicKey}`, JSON.stringify(launch), this.LAUNCH_TTL);
      }

      // Index trending (by volume)
      const trending = [...launches]
        .filter(l => l.status === 'Active' || l.status === 'PendingGraduation')
        .sort((a, b) => b.realSolReserve - a.realSolReserve)
        .slice(0, 20);
      await this.cache.set('launches:trending', JSON.stringify(trending), this.LAUNCHES_TTL);

      // Index recently created
      const recent = [...launches]
        .sort((a, b) => b.createdAt - a.createdAt)
        .slice(0, 20);
      await this.cache.set('launches:recent', JSON.stringify(recent), this.LAUNCHES_TTL);

      // Index graduated
      const graduated = launches.filter(l => l.status === 'Graduated');
      await this.cache.set('launches:graduated', JSON.stringify(graduated), this.LAUNCHES_TTL);

      // Calculate and cache global stats
      const stats = {
        totalLaunches: launches.length,
        activeLaunches: launches.filter(l => l.status === 'Active').length,
        graduatedLaunches: graduated.length,
        totalVolume: launches.reduce((sum, l) => sum + l.realSolReserve, 0),
        totalTrades: launches.reduce((sum, l) => sum + l.tradeCount, 0),
        totalHolders: launches.reduce((sum, l) => sum + l.holderCount, 0),
      };
      await this.cache.set('stats:global', JSON.stringify(stats), this.STATS_TTL);

      logger.debug(`Indexed ${launches.length} launches`);

    } catch (error) {
      logger.error('Failed to index all:', error);
    }
  }

  private subscribeToChanges(): void {
    // Subscribe to program logs for trade events
    const logsSubId = this.solana.subscribeToProgramLogs((logs, signature) => {
      this.handleProgramLogs(logs, signature);
    });
    this.subscriptionIds.push(logsSubId);

    logger.info('Subscribed to program changes');
  }

  private handleProgramLogs(logs: string[], signature: string): void {
    for (const log of logs) {
      // Anchor logs instruction names as "Program log: Instruction: <Name>"
      if (log.includes('Instruction: Buy') || log.includes('Instruction: Sell')) {
        this.handleTradeEvent(signature);
        break;
      }
      if (log.includes('Instruction: CreateLaunch') || log.includes('Launch created')) {
        this.handleLaunchCreated(signature);
        break;
      }
      if (log.includes('Instruction: Graduate') || log.includes('Launch graduated')) {
        this.handleLaunchGraduated(signature);
        break;
      }
    }
  }

  private async handleTradeEvent(signature: string): Promise<void> {
    this.state.tradeCount++;

    // Emit event for WebSocket broadcast
    this.emit('trade', { signature });

    // Re-index after short delay (let the transaction confirm)
    setTimeout(() => {
      this.indexAll().catch(err => logger.error('Re-index after trade failed:', err));
    }, 2000);
  }

  private async handleLaunchCreated(signature: string): Promise<void> {
    this.emit('launch:created', { signature });

    setTimeout(() => {
      this.indexAll().catch(err => logger.error('Re-index after launch created failed:', err));
    }, 2000);
  }

  private async handleLaunchGraduated(signature: string): Promise<void> {
    this.emit('launch:graduated', { signature });

    setTimeout(() => {
      this.indexAll().catch(err => logger.error('Re-index after graduation failed:', err));
    }, 2000);
  }

  // ---------------------------------------------------------------------------
  // Data Access
  // ---------------------------------------------------------------------------

  async getAllLaunches(): Promise<LaunchAccount[]> {
    const cached = await this.cache.get('launches:all');
    if (cached) {
      return JSON.parse(cached);
    }

    const launches = await this.solana.getAllLaunches();
    await this.cache.set('launches:all', JSON.stringify(launches), this.LAUNCHES_TTL);
    return launches;
  }

  async getTrendingLaunches(): Promise<LaunchAccount[]> {
    const cached = await this.cache.get('launches:trending');
    if (cached) {
      return JSON.parse(cached);
    }

    const launches = await this.getAllLaunches();
    return launches
      .filter(l => l.status === 'Active' || l.status === 'PendingGraduation')
      .sort((a, b) => b.realSolReserve - a.realSolReserve)
      .slice(0, 20);
  }

  async getRecentLaunches(): Promise<LaunchAccount[]> {
    const cached = await this.cache.get('launches:recent');
    if (cached) {
      return JSON.parse(cached);
    }

    const launches = await this.getAllLaunches();
    return launches
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 20);
  }

  async getGraduatedLaunches(): Promise<LaunchAccount[]> {
    const cached = await this.cache.get('launches:graduated');
    if (cached) {
      return JSON.parse(cached);
    }

    const launches = await this.getAllLaunches();
    return launches.filter(l => l.status === 'Graduated');
  }

  async getLaunch(publicKey: string): Promise<LaunchAccount | null> {
    const cached = await this.cache.get(`launch:${publicKey}`);
    if (cached) {
      return JSON.parse(cached);
    }

    // Use mock data in development
    if (useMockData()) {
      const launch = MOCK_LAUNCHES.find(l => l.publicKey === publicKey) || null;
      if (launch) {
        await this.cache.set(`launch:${publicKey}`, JSON.stringify(launch), this.LAUNCH_TTL);
      }
      return launch;
    }

    const launch = await this.solana.getLaunch(new PublicKey(publicKey));
    if (launch) {
      await this.cache.set(`launch:${publicKey}`, JSON.stringify(launch), this.LAUNCH_TTL);
    }
    return launch;
  }

  async getGlobalStats(): Promise<any> {
    const cached = await this.cache.get('stats:global');
    if (cached) {
      return JSON.parse(cached);
    }

    const launches = await this.getAllLaunches();
    const stats = {
      totalLaunches: launches.length,
      activeLaunches: launches.filter(l => l.status === 'Active').length,
      graduatedLaunches: launches.filter(l => l.status === 'Graduated').length,
      totalVolume: launches.reduce((sum, l) => sum + l.realSolReserve, 0),
      totalTrades: launches.reduce((sum, l) => sum + l.tradeCount, 0),
      totalHolders: launches.reduce((sum, l) => sum + l.holderCount, 0),
    };

    await this.cache.set('stats:global', JSON.stringify(stats), this.STATS_TTL);
    return stats;
  }

  async searchLaunches(query: string): Promise<LaunchAccount[]> {
    const launches = await this.getAllLaunches();
    const lowerQuery = query.toLowerCase();

    return launches.filter(l => 
      l.name.toLowerCase().includes(lowerQuery) ||
      l.symbol.toLowerCase().includes(lowerQuery) ||
      l.mint.toLowerCase().includes(lowerQuery) ||
      l.publicKey.toLowerCase().includes(lowerQuery)
    );
  }

  async getRecentTrades(launchPk: string, limit: number = 50): Promise<TradeEvent[]> {
    const cacheKey = `trades:${launchPk}`;
    const cached = await this.cache.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    // Use mock trades in development
    if (useMockData()) {
      const mockTrades = generateMockTrades(limit);
      await this.cache.set(cacheKey, JSON.stringify(mockTrades), this.TRADES_TTL);
      return mockTrades;
    }

    const trades = await this.solana.getRecentTrades(new PublicKey(launchPk), limit);
    await this.cache.set(cacheKey, JSON.stringify(trades), this.TRADES_TTL);
    return trades;
  }
}

export default IndexerService;
