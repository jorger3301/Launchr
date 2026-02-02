/**
 * Security Middleware and Utilities
 *
 * Provides:
 * - Request signing validation (wallet-based auth)
 * - Nonce management (replay attack prevention)
 * - IP blocking and throttling
 * - Security headers
 * - Request validation
 */

import { Request, Response, NextFunction } from 'express';
import { PublicKey } from '@solana/web3.js';
import nacl from 'tweetnacl';
import bs58 from 'bs58';
import { logger } from '../utils/logger';

// =============================================================================
// CONFIGURATION
// =============================================================================

const SECURITY_CONFIG = {
  // Signature validation
  signatureMaxAge: 60000, // Signatures valid for 1 minute
  nonceExpiry: 300000, // Nonces expire after 5 minutes

  // Rate limiting for authenticated endpoints
  authRateLimit: 100, // 100 requests per minute per address
  authRateWindow: 60000, // 1 minute

  // IP blocking
  maxFailedAttempts: 10, // Block after 10 failed attempts
  blockDuration: 3600000, // Block for 1 hour

  // Request size limits
  maxBodySize: 1024 * 1024, // 1MB
};

// =============================================================================
// TYPES
// =============================================================================

export interface SignedRequest extends Request {
  walletAddress?: string;
  signatureVerified?: boolean;
}

interface NonceEntry {
  nonce: string;
  timestamp: number;
  used: boolean;
}

interface RateLimitEntry {
  count: number;
  windowStart: number;
}

interface BlockEntry {
  failedAttempts: number;
  blockedUntil: number | null;
}

// =============================================================================
// STATE
// =============================================================================

const nonceStore: Map<string, NonceEntry> = new Map();
const rateLimits: Map<string, RateLimitEntry> = new Map();
const ipBlocks: Map<string, BlockEntry> = new Map();

// Cleanup interval
let cleanupInterval: NodeJS.Timeout | null = null;

// =============================================================================
// NONCE MANAGEMENT
// =============================================================================

/**
 * Generate a new nonce for a wallet address
 */
export function generateNonce(walletAddress: string): string {
  const nonce = bs58.encode(nacl.randomBytes(32));
  const timestamp = Date.now();

  nonceStore.set(`${walletAddress}:${nonce}`, {
    nonce,
    timestamp,
    used: false,
  });

  return nonce;
}

/**
 * Validate and consume a nonce
 */
function validateNonce(walletAddress: string, nonce: string): boolean {
  const key = `${walletAddress}:${nonce}`;
  const entry = nonceStore.get(key);

  if (!entry) {
    return false;
  }

  // Check if expired
  if (Date.now() - entry.timestamp > SECURITY_CONFIG.nonceExpiry) {
    nonceStore.delete(key);
    return false;
  }

  // Check if already used
  if (entry.used) {
    return false;
  }

  // Mark as used
  entry.used = true;

  return true;
}

// =============================================================================
// SIGNATURE VALIDATION
// =============================================================================

/**
 * Verify a wallet signature
 */
export function verifyWalletSignature(
  message: string,
  signature: string,
  publicKey: string
): boolean {
  try {
    const messageBytes = new TextEncoder().encode(message);
    const signatureBytes = bs58.decode(signature);
    const publicKeyBytes = new PublicKey(publicKey).toBytes();

    return nacl.sign.detached.verify(messageBytes, signatureBytes, publicKeyBytes);
  } catch (error) {
    logger.error('Signature verification error:', error);
    return false;
  }
}

/**
 * Create a message for signing
 */
export function createSignMessage(
  action: string,
  nonce: string,
  timestamp: number,
  data?: Record<string, unknown>
): string {
  const parts = [
    `Launchr: ${action}`,
    `Nonce: ${nonce}`,
    `Timestamp: ${timestamp}`,
  ];

  if (data) {
    parts.push(`Data: ${JSON.stringify(data)}`);
  }

  return parts.join('\n');
}

// =============================================================================
// IP BLOCKING
// =============================================================================

/**
 * Check if an IP is blocked
 */
function isIpBlocked(ip: string): boolean {
  const entry = ipBlocks.get(ip);
  if (!entry) return false;

  if (entry.blockedUntil && Date.now() < entry.blockedUntil) {
    return true;
  }

  // Reset if block has expired
  if (entry.blockedUntil && Date.now() >= entry.blockedUntil) {
    ipBlocks.delete(ip);
  }

  return false;
}

/**
 * Record a failed attempt
 */
function recordFailedAttempt(ip: string): void {
  let entry = ipBlocks.get(ip);

  if (!entry) {
    entry = { failedAttempts: 0, blockedUntil: null };
    ipBlocks.set(ip, entry);
  }

  entry.failedAttempts++;

  if (entry.failedAttempts >= SECURITY_CONFIG.maxFailedAttempts) {
    entry.blockedUntil = Date.now() + SECURITY_CONFIG.blockDuration;
    logger.warn(`IP blocked due to failed attempts: ${ip}`);
  }
}

/**
 * Clear failed attempts on successful auth
 */
function clearFailedAttempts(ip: string): void {
  ipBlocks.delete(ip);
}

// =============================================================================
// RATE LIMITING
// =============================================================================

/**
 * Check rate limit for an address
 */
function checkAddressRateLimit(address: string): boolean {
  const now = Date.now();
  let entry = rateLimits.get(address);

  if (!entry || now - entry.windowStart > SECURITY_CONFIG.authRateWindow) {
    entry = { count: 1, windowStart: now };
    rateLimits.set(address, entry);
    return true;
  }

  if (entry.count >= SECURITY_CONFIG.authRateLimit) {
    return false;
  }

  entry.count++;
  return true;
}

// =============================================================================
// MIDDLEWARE
// =============================================================================

/**
 * Get client IP address
 */
function getClientIp(req: Request): string {
  const cfIp = req.headers['cf-connecting-ip'];
  if (typeof cfIp === 'string') return cfIp;

  const xff = req.headers['x-forwarded-for'];
  if (typeof xff === 'string') {
    const firstIp = xff.split(',')[0].trim();
    if (firstIp) return firstIp;
  }

  const realIp = req.headers['x-real-ip'];
  if (typeof realIp === 'string') return realIp;

  return req.socket.remoteAddress || 'unknown';
}

/**
 * Middleware to validate signed requests
 *
 * Expected headers:
 * - x-wallet-address: Solana wallet public key
 * - x-signature: Base58 encoded signature
 * - x-nonce: Request nonce
 * - x-timestamp: Unix timestamp
 */
export function requireSignedRequest() {
  return (req: SignedRequest, res: Response, next: NextFunction): void => {
    const ip = getClientIp(req);

    // Check if IP is blocked
    if (isIpBlocked(ip)) {
      res.status(403).json({
        error: 'Access denied',
        message: 'Too many failed attempts. Please try again later.',
      });
      return;
    }

    // Extract headers
    const walletAddress = req.headers['x-wallet-address'] as string;
    const signature = req.headers['x-signature'] as string;
    const nonce = req.headers['x-nonce'] as string;
    const timestamp = parseInt(req.headers['x-timestamp'] as string, 10);

    // Validate required headers
    if (!walletAddress || !signature || !nonce || !timestamp) {
      recordFailedAttempt(ip);
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Missing authentication headers',
      });
      return;
    }

    // Validate wallet address format
    try {
      new PublicKey(walletAddress);
    } catch {
      recordFailedAttempt(ip);
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid wallet address',
      });
      return;
    }

    // Check timestamp freshness
    const now = Date.now();
    if (Math.abs(now - timestamp) > SECURITY_CONFIG.signatureMaxAge) {
      recordFailedAttempt(ip);
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Signature expired',
      });
      return;
    }

    // Validate nonce
    if (!validateNonce(walletAddress, nonce)) {
      recordFailedAttempt(ip);
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid or expired nonce',
      });
      return;
    }

    // Build and verify signature
    const action = `${req.method} ${req.path}`;
    const message = createSignMessage(action, nonce, timestamp, req.body || undefined);

    if (!verifyWalletSignature(message, signature, walletAddress)) {
      recordFailedAttempt(ip);
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid signature',
      });
      return;
    }

    // Check rate limit
    if (!checkAddressRateLimit(walletAddress)) {
      res.status(429).json({
        error: 'Rate limit exceeded',
        message: 'Too many requests. Please slow down.',
      });
      return;
    }

    // Success - clear failed attempts and set request properties
    clearFailedAttempts(ip);
    req.walletAddress = walletAddress;
    req.signatureVerified = true;

    next();
  };
}

/**
 * Optional signature validation (for endpoints that work both ways)
 */
export function optionalSignedRequest() {
  return (req: SignedRequest, res: Response, next: NextFunction): void => {
    const walletAddress = req.headers['x-wallet-address'] as string;
    const signature = req.headers['x-signature'] as string;

    // If no auth headers, continue without validation
    if (!walletAddress || !signature) {
      next();
      return;
    }

    // If auth headers present, validate them
    requireSignedRequest()(req, res, next);
  };
}

/**
 * Security headers middleware
 */
export function securityHeaders() {
  return (_req: Request, res: Response, next: NextFunction): void => {
    // Prevent clickjacking
    res.setHeader('X-Frame-Options', 'DENY');

    // Prevent MIME type sniffing
    res.setHeader('X-Content-Type-Options', 'nosniff');

    // Enable XSS filter
    res.setHeader('X-XSS-Protection', '1; mode=block');

    // Referrer policy
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

    // Content Security Policy
    res.setHeader(
      'Content-Security-Policy',
      "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'"
    );

    next();
  };
}

// =============================================================================
// ROUTES
// =============================================================================

/**
 * Handler to generate a nonce for authentication
 */
export function nonceHandler(req: Request, res: Response): void {
  const walletAddress = req.query.address as string;

  if (!walletAddress) {
    res.status(400).json({
      error: 'Bad request',
      message: 'Wallet address required',
    });
    return;
  }

  try {
    new PublicKey(walletAddress);
  } catch {
    res.status(400).json({
      error: 'Bad request',
      message: 'Invalid wallet address',
    });
    return;
  }

  const nonce = generateNonce(walletAddress);

  res.json({
    nonce,
    expiresIn: SECURITY_CONFIG.nonceExpiry,
    message: `Use this nonce to sign your request within ${SECURITY_CONFIG.nonceExpiry / 1000} seconds`,
  });
}

// =============================================================================
// LIFECYCLE
// =============================================================================

/**
 * Start security service cleanup
 */
export function startSecurityService(): void {
  // Clean up expired nonces and rate limits every minute
  cleanupInterval = setInterval(() => {
    const now = Date.now();

    // Clean nonces
    for (const [key, entry] of nonceStore) {
      if (now - entry.timestamp > SECURITY_CONFIG.nonceExpiry) {
        nonceStore.delete(key);
      }
    }

    // Clean rate limits
    for (const [key, entry] of rateLimits) {
      if (now - entry.windowStart > SECURITY_CONFIG.authRateWindow * 2) {
        rateLimits.delete(key);
      }
    }

    // Clean IP blocks
    for (const [ip, entry] of ipBlocks) {
      if (entry.blockedUntil && now >= entry.blockedUntil) {
        ipBlocks.delete(ip);
      }
    }
  }, 60000);

  logger.info('Security service started');
}

/**
 * Stop security service cleanup
 */
export function stopSecurityService(): void {
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
    cleanupInterval = null;
  }

  nonceStore.clear();
  rateLimits.clear();
  ipBlocks.clear();

  logger.info('Security service stopped');
}

/**
 * Get security stats
 */
export function getSecurityStats(): {
  activeNonces: number;
  rateLimitedAddresses: number;
  blockedIps: number;
} {
  return {
    activeNonces: nonceStore.size,
    rateLimitedAddresses: rateLimits.size,
    blockedIps: Array.from(ipBlocks.values()).filter(e => e.blockedUntil !== null).length,
  };
}

export default {
  requireSignedRequest,
  optionalSignedRequest,
  securityHeaders,
  nonceHandler,
  generateNonce,
  verifyWalletSignature,
  createSignMessage,
  startSecurityService,
  stopSecurityService,
  getSecurityStats,
};
