/**
 * Common Zod Schemas
 *
 * Shared validators for Solana addresses, pagination, and other common types.
 */

import { z } from 'zod';

// =============================================================================
// SOLANA ADDRESS VALIDATORS
// =============================================================================

/**
 * Base58 Solana public key validator
 * Must be 32-44 characters, valid base58 charset
 */
export const SolanaAddressSchema = z
  .string()
  .min(32, 'Address too short')
  .max(44, 'Address too long')
  .regex(/^[1-9A-HJ-NP-Za-km-z]+$/, 'Invalid base58 character');

/**
 * Optional Solana address
 */
export const OptionalSolanaAddressSchema = SolanaAddressSchema.optional();

/**
 * Transaction signature validator (88 characters, base58)
 */
export const TransactionSignatureSchema = z
  .string()
  .length(88, 'Invalid signature length')
  .regex(/^[1-9A-HJ-NP-Za-km-z]+$/, 'Invalid base58 character');

// =============================================================================
// PAGINATION VALIDATORS
// =============================================================================

export const PaginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const CursorPaginationSchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

// =============================================================================
// SORTING VALIDATORS
// =============================================================================

export const SortOrderSchema = z.enum(['asc', 'desc']).default('desc');

export const LaunchSortFieldSchema = z.enum([
  'created',
  'price',
  'volume',
  'marketcap',
  'holders',
  'trades',
]).default('created');

export const TradeSortFieldSchema = z.enum([
  'timestamp',
  'amount',
  'price',
]).default('timestamp');

// =============================================================================
// NUMERIC VALIDATORS
// =============================================================================

/**
 * Positive number (greater than 0)
 */
export const PositiveNumberSchema = z.coerce.number().positive();

/**
 * Non-negative number (0 or greater)
 */
export const NonNegativeNumberSchema = z.coerce.number().min(0);

/**
 * SOL amount (with reasonable bounds)
 */
export const SolAmountSchema = z.coerce
  .number()
  .min(0.000001, 'Amount too small')
  .max(1_000_000, 'Amount too large');

/**
 * Token amount (with reasonable bounds)
 */
export const TokenAmountSchema = z.coerce
  .number()
  .min(0, 'Amount cannot be negative')
  .max(1e15, 'Amount too large');

/**
 * Basis points (0-10000)
 */
export const BasisPointsSchema = z.coerce
  .number()
  .int()
  .min(0)
  .max(10000);

/**
 * Slippage percentage (0-100)
 */
export const SlippageSchema = z.coerce
  .number()
  .min(0)
  .max(100)
  .default(1);

// =============================================================================
// STRING VALIDATORS
// =============================================================================

/**
 * Token name validator
 */
export const TokenNameSchema = z
  .string()
  .min(1, 'Name required')
  .max(32, 'Name too long')
  .trim();

/**
 * Token symbol validator
 */
export const TokenSymbolSchema = z
  .string()
  .min(1, 'Symbol required')
  .max(10, 'Symbol too long')
  .toUpperCase()
  .trim();

/**
 * URI validator (metadata URL)
 */
export const UriSchema = z
  .string()
  .url('Invalid URI format')
  .max(200, 'URI too long');

/**
 * Optional URL (for social links)
 */
export const OptionalUrlSchema = z
  .string()
  .url('Invalid URL format')
  .max(200, 'URL too long')
  .optional()
  .or(z.literal(''));

/**
 * Search query validator
 */
export const SearchQuerySchema = z
  .string()
  .min(1, 'Search query required')
  .max(100, 'Search query too long')
  .trim();

// =============================================================================
// TIMESTAMP VALIDATORS
// =============================================================================

/**
 * Unix timestamp (milliseconds)
 */
export const TimestampMsSchema = z.coerce
  .number()
  .int()
  .min(0)
  .max(Date.now() + 86400000); // Allow up to 1 day in future

/**
 * Unix timestamp (seconds)
 */
export const TimestampSecSchema = z.coerce
  .number()
  .int()
  .min(0)
  .max(Math.floor(Date.now() / 1000) + 86400);

// =============================================================================
// TYPE EXPORTS
// =============================================================================

export type SolanaAddress = z.infer<typeof SolanaAddressSchema>;
export type TransactionSignature = z.infer<typeof TransactionSignatureSchema>;
export type Pagination = z.infer<typeof PaginationSchema>;
export type CursorPagination = z.infer<typeof CursorPaginationSchema>;
export type SortOrder = z.infer<typeof SortOrderSchema>;
export type LaunchSortField = z.infer<typeof LaunchSortFieldSchema>;
export type TradeSortField = z.infer<typeof TradeSortFieldSchema>;
