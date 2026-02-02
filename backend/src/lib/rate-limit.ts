/**
 * Rate Limiting Library
 *
 * Token bucket rate limiter with secure IP extraction for Express.
 * Adapted from Next.js implementation.
 */

import { Request, Response, NextFunction } from 'express';

// =============================================================================
// TYPES
// =============================================================================

export type LimitConfig = {
  keyPrefix?: string;
  // tokens per window
  limit: number;
  // window in ms
  windowMs: number;
  // allow short bursts
  burst?: number;
};

export type HitResult =
  | { ok: true; remaining: number; resetMs: number }
  | { ok: false; remaining: 0; resetMs: number };

type Bucket = {
  tokens: number;
  lastRefill: number;
  resetAt: number;
};

// =============================================================================
// STORE
// =============================================================================

const STORE = new Map<string, Bucket>();

// prevent unbounded growth
const MAX_KEYS = 50_000;

function now() {
  return Date.now();
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function cleanupMaybe() {
  if (STORE.size <= MAX_KEYS) return;

  // quick+cheap cleanup: drop expired buckets
  const t = now();
  for (const [k, b] of STORE) {
    if (b.resetAt <= t) STORE.delete(k);
    if (STORE.size <= MAX_KEYS) break;
  }
}

// =============================================================================
// IP EXTRACTION (SECURITY HARDENED)
// =============================================================================

/**
 * SECURITY FIX: Validates IP address format
 * Prevents injection attacks via malformed IPs
 */
function isValidIp(ip: string): boolean {
  if (!ip || ip.length > 45) return false; // Max IPv6 length

  // IPv4 validation
  const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
  if (ipv4Regex.test(ip)) {
    const parts = ip.split('.').map(Number);
    return parts.every((part) => part >= 0 && part <= 255);
  }

  // IPv6 validation (basic)
  const ipv6Regex = /^([0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}$/;
  return ipv6Regex.test(ip);
}

/**
 * SECURITY FIX: Secure IP extraction with spoofing protection
 *
 * Reads client IP from headers with validation.
 * Priority order (most trusted first):
 * 1. CF-Connecting-IP (Cloudflare) - Cannot be spoofed
 * 2. X-Real-IP (only if behind trusted proxy)
 * 3. req.ip (Express trust proxy setting)
 * 4. Fallback to "unknown"
 *
 * NOTE: X-Forwarded-For is NOT used as it's trivially spoofable
 * Attackers can bypass rate limits by sending: X-Forwarded-For: 1.2.3.4
 */
export function getClientIp(req: Request): string {
  // TRUSTED: Cloudflare's CF-Connecting-IP cannot be spoofed
  const cf = req.headers['cf-connecting-ip'];
  if (typeof cf === 'string' && isValidIp(cf)) {
    return cf;
  }

  // SEMI-TRUSTED: X-Real-IP only if behind known proxy (nginx, etc.)
  // Only enable if you're using a TRUSTED proxy
  if (process.env.TRUSTED_PROXY_ENABLED === 'true') {
    const xrip = req.headers['x-real-ip'];
    if (typeof xrip === 'string' && isValidIp(xrip)) {
      return xrip;
    }
  }

  // Express trust proxy - req.ip uses Express's built-in handling
  if (req.ip && isValidIp(req.ip)) {
    return req.ip;
  }

  // Socket remote address as last resort
  const socketIp = req.socket?.remoteAddress;
  if (socketIp && isValidIp(socketIp)) {
    return socketIp;
  }

  // SECURITY FIX: X-Forwarded-For removed (too easy to spoof)
  // DO NOT re-add without proper proxy chain validation

  return 'unknown';
}

/**
 * Generate a rate limit key from request
 */
export function rateLimitKey(req: Request, prefix = 'rl'): string {
  const ip = getClientIp(req);
  const ua = req.headers['user-agent'] || 'ua';
  // add UA to reduce cheap IP spoofing in dev environments; keep it stable
  return `${prefix}:${ip}:${ua.slice(0, 40)}`;
}

// =============================================================================
// RATE LIMITING
// =============================================================================

/**
 * Token bucket:
 * - capacity = limit + (burst ?? 0)
 * - refill rate = limit tokens per windowMs
 */
export function hitRateLimit(key: string, cfg: LimitConfig): HitResult {
  cleanupMaybe();

  const t = now();
  const capacity = cfg.limit + (cfg.burst ?? 0);
  const refillPerMs = cfg.limit / cfg.windowMs;

  let b = STORE.get(key);
  if (!b || b.resetAt <= t) {
    b = {
      tokens: capacity,
      lastRefill: t,
      resetAt: t + cfg.windowMs,
    };
    STORE.set(key, b);
  }

  // refill
  const elapsed = t - b.lastRefill;
  if (elapsed > 0) {
    b.tokens = clamp(b.tokens + elapsed * refillPerMs, 0, capacity);
    b.lastRefill = t;
  }

  // consume 1
  if (b.tokens < 1) {
    return { ok: false, remaining: 0, resetMs: Math.max(0, b.resetAt - t) };
  }

  b.tokens -= 1;

  return {
    ok: true,
    remaining: Math.floor(b.tokens),
    resetMs: Math.max(0, b.resetAt - t),
  };
}

/**
 * Convenience wrapper to match "rateLimit({ key, limit, windowMs, burst })"
 */
export function rateLimit(opts: {
  key: string;
  limit: number;
  windowMs: number;
  burst?: number;
}): HitResult {
  return hitRateLimit(opts.key, {
    limit: opts.limit,
    windowMs: opts.windowMs,
    burst: opts.burst,
  });
}

/**
 * Add rate limit headers to response
 */
export function setRateLimitHeaders(res: Response, result: HitResult, cfg: LimitConfig): void {
  res.set('X-RateLimit-Limit', String(cfg.limit));
  res.set('X-RateLimit-Remaining', String(result.remaining));
  res.set('X-RateLimit-Reset-Ms', String(Math.max(0, result.resetMs)));
}

// =============================================================================
// EXPRESS MIDDLEWARE
// =============================================================================

export interface RateLimitOptions {
  limit: number;
  windowMs: number;
  burst?: number;
  keyPrefix?: string;
  keyGenerator?: (req: Request) => string;
  handler?: (req: Request, res: Response, result: HitResult) => void;
  skip?: (req: Request) => boolean;
}

/**
 * Express middleware for rate limiting
 */
export function rateLimitMiddleware(options: RateLimitOptions) {
  const {
    limit,
    windowMs,
    burst = 0,
    keyPrefix = 'rl',
    keyGenerator = (req) => rateLimitKey(req, keyPrefix),
    handler,
    skip,
  } = options;

  const cfg: LimitConfig = { limit, windowMs, burst, keyPrefix };

  return (req: Request, res: Response, next: NextFunction) => {
    // Check if we should skip rate limiting for this request
    if (skip && skip(req)) {
      return next();
    }

    const key = keyGenerator(req);
    const result = hitRateLimit(key, cfg);

    // Set headers
    setRateLimitHeaders(res, result, cfg);

    if (!result.ok) {
      if (handler) {
        return handler(req, res, result);
      }

      return res.status(429).json({
        error: 'Too Many Requests',
        retryAfter: Math.ceil(result.resetMs / 1000),
        message: `Rate limit exceeded. Try again in ${Math.ceil(result.resetMs / 1000)} seconds.`,
      });
    }

    next();
  };
}

// =============================================================================
// PRESET CONFIGURATIONS
// =============================================================================

/**
 * Standard API rate limit (60 requests per minute)
 */
export const standardApiLimit = rateLimitMiddleware({
  limit: 60,
  windowMs: 60 * 1000,
  burst: 10,
  keyPrefix: 'api',
});

/**
 * Strict rate limit for sensitive endpoints (10 per minute)
 */
export const strictLimit = rateLimitMiddleware({
  limit: 10,
  windowMs: 60 * 1000,
  burst: 2,
  keyPrefix: 'strict',
});

/**
 * Relaxed limit for read-only endpoints (120 per minute)
 */
export const relaxedLimit = rateLimitMiddleware({
  limit: 120,
  windowMs: 60 * 1000,
  burst: 20,
  keyPrefix: 'read',
});

/**
 * WebSocket connection limit (5 per minute per IP)
 */
export const wsConnectionLimit = rateLimitMiddleware({
  limit: 5,
  windowMs: 60 * 1000,
  burst: 2,
  keyPrefix: 'ws',
});
