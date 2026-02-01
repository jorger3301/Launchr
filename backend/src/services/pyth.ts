/**
 * Pyth Network Service
 *
 * Oracle price feeds for accurate SOL/USD and token pricing.
 * https://docs.pyth.network/
 */

import { logger } from '../utils/logger';

// ---------------------------------------------------------------------------
// TYPES
// ---------------------------------------------------------------------------

interface PythConfig {
  cluster: 'mainnet-beta' | 'devnet';
}

interface PriceData {
  price: number;
  confidence: number;
  exponent: number;
  publishTime: number;
  emaPrice: number;
  emaConfidence: number;
}

interface PriceFeed {
  id: string;
  price: PriceData;
  symbol: string;
}

// ---------------------------------------------------------------------------
// CONSTANTS
// ---------------------------------------------------------------------------

// Pyth Network Hermes API endpoints
const PYTH_HERMES_API = {
  mainnet: 'https://hermes.pyth.network',
  devnet: 'https://hermes.pyth.network', // Same endpoint, different price feed IDs
};

// Common price feed IDs (Pyth uses hex IDs)
export const PYTH_PRICE_FEEDS = {
  // Crypto
  'SOL/USD': '0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d',
  'BTC/USD': '0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43',
  'ETH/USD': '0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace',
  'USDC/USD': '0xeaa020c61cc479712813461ce153894a96a6c00b21ed0cfc2798d1f9a9e9c94a',
  'USDT/USD': '0x2b89b9dc8fdf9f34709a5b106b472f0f39bb6ca9ce04b0fd7f2e971688e2e53b',
  'BONK/USD': '0x72b021217ca3fe68922a19aaf990109cb9d84e9ad004b4d2025ad6f529314419',
  'JUP/USD': '0x0a0408d619e9380abad35060f9192039ed5042fa6f82301d0e48bb52be830996',
  'RAY/USD': '0x91568baa8beb53db23eb3fb7f22c6e8bd303d103919e19733f2bb642d3e7987a',
  'ORCA/USD': '0x37505261e557e251290b8c8899453064e8d760ed5c65a779726f2490980da74c',
  // Forex (for reference)
  'EUR/USD': '0xa995d00bb36a63cef7fd2c287dc105fc8f3d93779f062f09551b0af3e81ec30b',
  'GBP/USD': '0x84c2dde9633d93d1bcad84e7dc41c9d56578b7ec52fabedc1f335d673df0a7c1',
};

// ---------------------------------------------------------------------------
// PYTH SERVICE
// ---------------------------------------------------------------------------

export class PythService {
  private baseUrl: string;
  private priceCache: Map<string, { data: PriceData; timestamp: number }> = new Map();
  private cacheDuration: number = 10000; // 10 seconds

  constructor(config: PythConfig = { cluster: 'devnet' }) {
    this.baseUrl = PYTH_HERMES_API[config.cluster === 'mainnet-beta' ? 'mainnet' : 'devnet'];
  }

  // ---------------------------------------------------------------------------
  // PRICE FEEDS
  // ---------------------------------------------------------------------------

  /**
   * Get latest price for a feed
   */
  async getPrice(feedId: string): Promise<PriceData | null> {
    // Check cache first
    const cached = this.priceCache.get(feedId);
    if (cached && Date.now() - cached.timestamp < this.cacheDuration) {
      return cached.data;
    }

    try {
      const response = await fetch(
        `${this.baseUrl}/api/latest_price_feeds?ids[]=${feedId}`
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json() as any[];

      if (data && data.length > 0) {
        const feed = data[0];
        const priceData: PriceData = {
          price: parseInt(feed.price.price) * Math.pow(10, feed.price.expo),
          confidence: parseInt(feed.price.conf) * Math.pow(10, feed.price.expo),
          exponent: feed.price.expo,
          publishTime: feed.price.publish_time,
          emaPrice: parseInt(feed.ema_price.price) * Math.pow(10, feed.ema_price.expo),
          emaConfidence: parseInt(feed.ema_price.conf) * Math.pow(10, feed.ema_price.expo),
        };

        // Cache the result
        this.priceCache.set(feedId, { data: priceData, timestamp: Date.now() });

        return priceData;
      }

      return null;
    } catch (error) {
      logger.error('Error fetching Pyth price:', error);
      return null;
    }
  }

  /**
   * Get SOL/USD price
   */
  async getSolUsdPrice(): Promise<number> {
    const priceData = await this.getPrice(PYTH_PRICE_FEEDS['SOL/USD']);
    return priceData?.price || 0;
  }

  /**
   * Get multiple prices at once
   */
  async getPrices(feedIds: string[]): Promise<Map<string, PriceData>> {
    const results = new Map<string, PriceData>();

    try {
      const idsParam = feedIds.map(id => `ids[]=${id}`).join('&');
      const response = await fetch(
        `${this.baseUrl}/api/latest_price_feeds?${idsParam}`
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json() as any[];

      for (const feed of data) {
        const priceData: PriceData = {
          price: parseInt(feed.price.price) * Math.pow(10, feed.price.expo),
          confidence: parseInt(feed.price.conf) * Math.pow(10, feed.price.expo),
          exponent: feed.price.expo,
          publishTime: feed.price.publish_time,
          emaPrice: parseInt(feed.ema_price.price) * Math.pow(10, feed.ema_price.expo),
          emaConfidence: parseInt(feed.ema_price.conf) * Math.pow(10, feed.ema_price.expo),
        };

        results.set(feed.id, priceData);
        this.priceCache.set(feed.id, { data: priceData, timestamp: Date.now() });
      }
    } catch (error) {
      logger.error('Error fetching Pyth prices:', error);
    }

    return results;
  }

  /**
   * Get price with symbol lookup
   */
  async getPriceBySymbol(symbol: string): Promise<PriceData | null> {
    const feedId = PYTH_PRICE_FEEDS[symbol as keyof typeof PYTH_PRICE_FEEDS];
    if (!feedId) {
      logger.warn(`Unknown Pyth price feed symbol: ${symbol}`);
      return null;
    }
    return this.getPrice(feedId);
  }

  /**
   * Convert token amount to USD value
   */
  async convertToUsd(
    tokenAmount: number,
    tokenSymbol: string = 'SOL/USD'
  ): Promise<number> {
    const priceData = await this.getPriceBySymbol(tokenSymbol);
    if (!priceData) return 0;
    return tokenAmount * priceData.price;
  }

  /**
   * Get price with confidence interval
   */
  async getPriceWithConfidence(feedId: string): Promise<{
    price: number;
    confidenceLow: number;
    confidenceHigh: number;
  } | null> {
    const priceData = await this.getPrice(feedId);
    if (!priceData) return null;

    return {
      price: priceData.price,
      confidenceLow: priceData.price - priceData.confidence,
      confidenceHigh: priceData.price + priceData.confidence,
    };
  }

  // ---------------------------------------------------------------------------
  // STREAMING (WebSocket)
  // ---------------------------------------------------------------------------

  /**
   * Subscribe to price updates via SSE
   */
  subscribeToPrice(
    feedId: string,
    onUpdate: (price: PriceData) => void,
    onError?: (error: Error) => void
  ): () => void {
    const eventSource = new EventSource(
      `${this.baseUrl}/api/streaming_prices?ids[]=${feedId}`
    );

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.price) {
          const priceData: PriceData = {
            price: parseInt(data.price.price) * Math.pow(10, data.price.expo),
            confidence: parseInt(data.price.conf) * Math.pow(10, data.price.expo),
            exponent: data.price.expo,
            publishTime: data.price.publish_time,
            emaPrice: parseInt(data.ema_price.price) * Math.pow(10, data.ema_price.expo),
            emaConfidence: parseInt(data.ema_price.conf) * Math.pow(10, data.ema_price.expo),
          };
          onUpdate(priceData);
        }
      } catch (err) {
        logger.error('Error parsing Pyth SSE data:', err);
      }
    };

    eventSource.onerror = () => {
      if (onError) {
        onError(new Error('Pyth SSE connection error'));
      }
    };

    // Return cleanup function
    return () => {
      eventSource.close();
    };
  }

  // ---------------------------------------------------------------------------
  // UTILITIES
  // ---------------------------------------------------------------------------

  /**
   * Get all available price feed IDs
   */
  getAvailableFeeds(): Record<string, string> {
    return { ...PYTH_PRICE_FEEDS };
  }

  /**
   * Clear price cache
   */
  clearCache(): void {
    this.priceCache.clear();
  }

  /**
   * Set cache duration
   */
  setCacheDuration(ms: number): void {
    this.cacheDuration = ms;
  }
}

// ---------------------------------------------------------------------------
// SINGLETON INSTANCE
// ---------------------------------------------------------------------------

let pythService: PythService | null = null;

export function initPyth(cluster: 'mainnet-beta' | 'devnet' = 'devnet'): PythService {
  pythService = new PythService({ cluster });
  logger.info('Pyth Network service initialized');
  return pythService;
}

export function getPyth(): PythService | null {
  return pythService;
}
