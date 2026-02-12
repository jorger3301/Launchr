/**
 * Cache Service
 * 
 * Redis-based caching for fast API responses.
 * Falls back to in-memory cache if Redis is unavailable.
 */

import { createClient, RedisClientType } from 'redis';
import { logger } from '../utils/logger';

// =============================================================================
// IN-MEMORY CACHE FALLBACK
// =============================================================================

class InMemoryCache {
  private cache: Map<string, { value: string; expires: number }> = new Map();

  async get(key: string): Promise<string | null> {
    const item = this.cache.get(key);
    if (!item) return null;
    if (Date.now() > item.expires) {
      this.cache.delete(key);
      return null;
    }
    return item.value;
  }

  async set(key: string, value: string, ttlSeconds: number): Promise<void> {
    this.cache.set(key, {
      value,
      expires: Date.now() + ttlSeconds * 1000,
    });
  }

  async del(key: string): Promise<void> {
    this.cache.delete(key);
  }

  async keys(pattern: string): Promise<string[]> {
    const regex = new RegExp(pattern.replace('*', '.*'));
    return Array.from(this.cache.keys()).filter(k => regex.test(k));
  }

  async flushall(): Promise<void> {
    this.cache.clear();
  }
}

// =============================================================================
// CACHE SERVICE
// =============================================================================

export class CacheService {
  private redis: RedisClientType | null = null;
  private memory: InMemoryCache;
  private url: string;
  private isConnected: boolean = false;

  constructor(redisUrl: string) {
    this.url = redisUrl;
    this.memory = new InMemoryCache();
  }

  // ---------------------------------------------------------------------------
  // Connection
  // ---------------------------------------------------------------------------

  async connect(): Promise<void> {
    // Skip Redis if mock data is explicitly enabled or Redis URL is not configured
    if (process.env.USE_MOCK_DATA === 'true') {
      logger.info('Using in-memory cache (mock data mode)');
      this.redis = null;
      this.isConnected = false;
      return;
    }

    try {
      this.redis = createClient({
        url: this.url,
        socket: {
          reconnectStrategy: false, // Don't auto-reconnect
        },
      });

      this.redis.on('error', (err) => {
        logger.error('Redis error:', err);
        this.isConnected = false;
      });

      this.redis.on('connect', () => {
        logger.info('Redis connected');
        this.isConnected = true;
      });

      this.redis.on('disconnect', () => {
        logger.warn('Redis disconnected');
        this.isConnected = false;
      });

      await this.redis.connect();
      this.isConnected = true;

    } catch (error) {
      logger.warn('Redis connection failed, using in-memory cache');
      this.redis = null;
      this.isConnected = false;
    }
  }

  async disconnect(): Promise<void> {
    if (this.redis) {
      await this.redis.quit();
      this.redis = null;
    }
    this.isConnected = false;
  }

  // ---------------------------------------------------------------------------
  // Operations
  // ---------------------------------------------------------------------------

  async get(key: string): Promise<string | null> {
    try {
      if (this.redis && this.isConnected) {
        return await this.redis.get(key);
      }
      return await this.memory.get(key);
    } catch (error) {
      logger.error('Cache get error:', error);
      return await this.memory.get(key);
    }
  }

  async set(key: string, value: string, ttlSeconds: number = 60): Promise<void> {
    try {
      if (this.redis && this.isConnected) {
        await this.redis.setEx(key, ttlSeconds, value);
      }
      // Always set in memory as backup
      await this.memory.set(key, value, ttlSeconds);
    } catch (error) {
      logger.error('Cache set error:', error);
      await this.memory.set(key, value, ttlSeconds);
    }
  }

  async del(key: string): Promise<void> {
    try {
      if (this.redis && this.isConnected) {
        await this.redis.del(key);
      }
      await this.memory.del(key);
    } catch (error) {
      logger.error('Cache del error:', error);
      await this.memory.del(key);
    }
  }

  async keys(pattern: string): Promise<string[]> {
    try {
      if (this.redis && this.isConnected) {
        return await this.redis.keys(pattern);
      }
      return await this.memory.keys(pattern);
    } catch (error) {
      logger.error('Cache keys error:', error);
      return await this.memory.keys(pattern);
    }
  }

  async flush(): Promise<void> {
    try {
      if (this.redis && this.isConnected) {
        await this.redis.flushAll();
      }
      await this.memory.flushall();
    } catch (error) {
      logger.error('Cache flush error:', error);
      await this.memory.flushall();
    }
  }

  // ---------------------------------------------------------------------------
  // JSON Helpers
  // ---------------------------------------------------------------------------

  async getJSON<T>(key: string): Promise<T | null> {
    const value = await this.get(key);
    if (!value) return null;
    try {
      return JSON.parse(value);
    } catch {
      return null;
    }
  }

  async setJSON<T>(key: string, value: T, ttlSeconds: number = 60): Promise<void> {
    await this.set(key, JSON.stringify(value), ttlSeconds);
  }

  // ---------------------------------------------------------------------------
  // Status
  // ---------------------------------------------------------------------------

  isReady(): boolean {
    return this.isConnected || true; // Memory cache always available
  }

  getStatus(): { redis: boolean; memory: boolean } {
    return {
      redis: this.isConnected,
      memory: true,
    };
  }
}

export default CacheService;
