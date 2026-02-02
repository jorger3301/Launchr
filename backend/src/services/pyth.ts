/**
 * Pyth Network Service
 *
 * Oracle price feeds for accurate SOL/USD and token pricing.
 * https://docs.pyth.network/
 *
 * Security features:
 * - Price staleness validation
 * - Confidence interval checks
 * - Fallback price handling
 * - Price deviation alerts
 */

import { logger } from '../utils/logger';

// ---------------------------------------------------------------------------
// CONFIGURATION
// ---------------------------------------------------------------------------

const PYTH_CONFIG = {
  // Staleness thresholds (in seconds)
  maxPriceAge: 60, // Reject prices older than 60 seconds
  warnPriceAge: 30, // Warn on prices older than 30 seconds

  // Confidence thresholds (percentage of price)
  maxConfidenceRatio: 0.05, // Reject if confidence > 5% of price
  warnConfidenceRatio: 0.02, // Warn if confidence > 2% of price

  // Price deviation thresholds (percentage change)
  maxPriceDeviation: 0.10, // Alert if price moves > 10% from EMA
  warnPriceDeviation: 0.05, // Warn if price moves > 5% from EMA

  // Cache settings
  cacheDuration: 10000, // 10 seconds
};

// ---------------------------------------------------------------------------
// TYPES
// ---------------------------------------------------------------------------

interface PythConfig {
  cluster: 'mainnet-beta' | 'devnet';
}

export interface PriceData {
  price: number;
  confidence: number;
  exponent: number;
  publishTime: number;
  emaPrice: number;
  emaConfidence: number;
}

export interface ValidatedPrice {
  price: number;
  confidence: number;
  emaPrice: number;
  publishTime: number;
  age: number;
  isStale: boolean;
  isReliable: boolean;
  confidenceRatio: number;
  deviationFromEma: number;
  warnings: string[];
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
  private lastKnownPrices: Map<string, number> = new Map();
  private cacheDuration: number = PYTH_CONFIG.cacheDuration;

  constructor(config: PythConfig = { cluster: 'devnet' }) {
    this.baseUrl = PYTH_HERMES_API[config.cluster === 'mainnet-beta' ? 'mainnet' : 'devnet'];
  }

  // ---------------------------------------------------------------------------
  // PRICE VALIDATION
  // ---------------------------------------------------------------------------

  /**
   * Validate a price for staleness and reliability
   */
  validatePrice(priceData: PriceData, feedId?: string): ValidatedPrice {
    const now = Math.floor(Date.now() / 1000);
    const age = now - priceData.publishTime;
    const warnings: string[] = [];

    // Check staleness
    const isStale = age > PYTH_CONFIG.maxPriceAge;
    if (isStale) {
      warnings.push(`Price is stale (${age}s old, max ${PYTH_CONFIG.maxPriceAge}s)`);
      logger.warn(`Stale price detected for ${feedId || 'unknown'}: ${age}s old`);
    } else if (age > PYTH_CONFIG.warnPriceAge) {
      warnings.push(`Price is getting old (${age}s)`);
    }

    // Check confidence ratio
    const confidenceRatio = Math.abs(priceData.confidence / priceData.price);
    const isConfidenceTooHigh = confidenceRatio > PYTH_CONFIG.maxConfidenceRatio;
    if (isConfidenceTooHigh) {
      warnings.push(`Confidence too high (${(confidenceRatio * 100).toFixed(2)}%)`);
      logger.warn(`High confidence interval for ${feedId || 'unknown'}: ${(confidenceRatio * 100).toFixed(2)}%`);
    } else if (confidenceRatio > PYTH_CONFIG.warnConfidenceRatio) {
      warnings.push(`Confidence elevated (${(confidenceRatio * 100).toFixed(2)}%)`);
    }

    // Check deviation from EMA
    const deviationFromEma = Math.abs(priceData.price - priceData.emaPrice) / priceData.emaPrice;
    if (deviationFromEma > PYTH_CONFIG.maxPriceDeviation) {
      warnings.push(`Large deviation from EMA (${(deviationFromEma * 100).toFixed(2)}%)`);
      logger.warn(`Price deviation alert for ${feedId || 'unknown'}: ${(deviationFromEma * 100).toFixed(2)}% from EMA`);
    } else if (deviationFromEma > PYTH_CONFIG.warnPriceDeviation) {
      warnings.push(`Elevated deviation from EMA (${(deviationFromEma * 100).toFixed(2)}%)`);
    }

    // Track last known price for sudden change detection
    if (feedId) {
      const lastPrice = this.lastKnownPrices.get(feedId);
      if (lastPrice) {
        const priceChange = Math.abs(priceData.price - lastPrice) / lastPrice;
        if (priceChange > PYTH_CONFIG.maxPriceDeviation) {
          warnings.push(`Sudden price change (${(priceChange * 100).toFixed(2)}%)`);
          logger.warn(`Sudden price change for ${feedId}: ${(priceChange * 100).toFixed(2)}%`);
        }
      }
      this.lastKnownPrices.set(feedId, priceData.price);
    }

    const isReliable = !isStale && !isConfidenceTooHigh;

    return {
      price: priceData.price,
      confidence: priceData.confidence,
      emaPrice: priceData.emaPrice,
      publishTime: priceData.publishTime,
      age,
      isStale,
      isReliable,
      confidenceRatio,
      deviationFromEma,
      warnings,
    };
  }

  // ---------------------------------------------------------------------------
  // PRICE FEEDS
  // ---------------------------------------------------------------------------

  /**
   * Get latest price for a feed (raw, without validation)
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
   * Get validated price for a feed
   */
  async getValidatedPrice(feedId: string): Promise<ValidatedPrice | null> {
    const priceData = await this.getPrice(feedId);
    if (!priceData) return null;
    return this.validatePrice(priceData, feedId);
  }

  /**
   * Get SOL/USD price (validated)
   */
  async getSolUsdPrice(): Promise<number> {
    const validated = await this.getValidatedPrice(PYTH_PRICE_FEEDS['SOL/USD']);
    if (!validated) return 0;

    // Return 0 if price is unreliable (stale or high confidence)
    if (!validated.isReliable) {
      logger.warn('SOL/USD price is unreliable, returning 0');
      return 0;
    }

    return validated.price;
  }

  /**
   * Get SOL/USD price with fallback to EMA if spot is unreliable
   */
  async getSolUsdPriceWithFallback(): Promise<{ price: number; source: 'spot' | 'ema' | 'none'; warnings: string[] }> {
    const validated = await this.getValidatedPrice(PYTH_PRICE_FEEDS['SOL/USD']);

    if (!validated) {
      return { price: 0, source: 'none', warnings: ['Failed to fetch price'] };
    }

    // If spot price is reliable, use it
    if (validated.isReliable) {
      return { price: validated.price, source: 'spot', warnings: validated.warnings };
    }

    // Fall back to EMA if spot is unreliable
    logger.info('Falling back to EMA price due to unreliable spot price');
    return {
      price: validated.emaPrice,
      source: 'ema',
      warnings: [...validated.warnings, 'Using EMA price as fallback'],
    };
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
   * Get validated prices for multiple feeds
   */
  async getValidatedPrices(feedIds: string[]): Promise<Map<string, ValidatedPrice>> {
    const rawPrices = await this.getPrices(feedIds);
    const results = new Map<string, ValidatedPrice>();

    for (const [feedId, priceData] of rawPrices) {
      results.set(feedId, this.validatePrice(priceData, feedId));
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
   * Get validated price with symbol lookup
   */
  async getValidatedPriceBySymbol(symbol: string): Promise<ValidatedPrice | null> {
    const feedId = PYTH_PRICE_FEEDS[symbol as keyof typeof PYTH_PRICE_FEEDS];
    if (!feedId) {
      logger.warn(`Unknown Pyth price feed symbol: ${symbol}`);
      return null;
    }
    return this.getValidatedPrice(feedId);
  }

  /**
   * Convert token amount to USD value (with validation)
   */
  async convertToUsd(
    tokenAmount: number,
    tokenSymbol: string = 'SOL/USD'
  ): Promise<{ usdValue: number; isReliable: boolean; warnings: string[] }> {
    const validated = await this.getValidatedPriceBySymbol(tokenSymbol);
    if (!validated) {
      return { usdValue: 0, isReliable: false, warnings: ['Failed to fetch price'] };
    }

    return {
      usdValue: tokenAmount * validated.price,
      isReliable: validated.isReliable,
      warnings: validated.warnings,
    };
  }

  /**
   * Get price with confidence interval
   */
  async getPriceWithConfidence(feedId: string): Promise<{
    price: number;
    confidenceLow: number;
    confidenceHigh: number;
    isReliable: boolean;
  } | null> {
    const validated = await this.getValidatedPrice(feedId);
    if (!validated) return null;

    return {
      price: validated.price,
      confidenceLow: validated.price - validated.confidence,
      confidenceHigh: validated.price + validated.confidence,
      isReliable: validated.isReliable,
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
    onUpdate: (price: ValidatedPrice) => void,
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

          // Validate and emit
          const validated = this.validatePrice(priceData, feedId);
          onUpdate(validated);
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

  /**
   * Get current configuration
   */
  getConfig(): typeof PYTH_CONFIG {
    return { ...PYTH_CONFIG };
  }

  /**
   * Health check - verify Pyth is responding with fresh prices
   */
  async healthCheck(): Promise<{
    healthy: boolean;
    latency: number;
    priceAge: number | null;
    error?: string;
  }> {
    const start = Date.now();

    try {
      const validated = await this.getValidatedPrice(PYTH_PRICE_FEEDS['SOL/USD']);
      const latency = Date.now() - start;

      if (!validated) {
        return { healthy: false, latency, priceAge: null, error: 'Failed to fetch price' };
      }

      return {
        healthy: validated.isReliable,
        latency,
        priceAge: validated.age,
        error: validated.isReliable ? undefined : validated.warnings.join('; '),
      };
    } catch (error) {
      return {
        healthy: false,
        latency: Date.now() - start,
        priceAge: null,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}

// ---------------------------------------------------------------------------
// SINGLETON INSTANCE
// ---------------------------------------------------------------------------

let pythService: PythService | null = null;

export function initPyth(cluster: 'mainnet-beta' | 'devnet' = 'devnet'): PythService {
  pythService = new PythService({ cluster });
  logger.info('Pyth Network service initialized with validation');
  return pythService;
}

export function getPyth(): PythService | null {
  return pythService;
}
