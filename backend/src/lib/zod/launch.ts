/**
 * Launch Zod Schemas
 *
 * Validators for launch-related API requests and responses.
 */

import { z } from 'zod';
import {
  SolanaAddressSchema,
  OptionalUrlSchema,
  TokenNameSchema,
  TokenSymbolSchema,
  UriSchema,
  BasisPointsSchema,
  PaginationSchema,
  LaunchSortFieldSchema,
  SortOrderSchema,
  SearchQuerySchema,
  NonNegativeNumberSchema,
} from './common';

// =============================================================================
// LAUNCH STATUS
// =============================================================================

export const LaunchStatusSchema = z.enum([
  'Active',
  'PendingGraduation',
  'Graduated',
  'Cancelled',
]);

export type LaunchStatus = z.infer<typeof LaunchStatusSchema>;

// =============================================================================
// CREATE LAUNCH
// =============================================================================

export const CreateLaunchRequestSchema = z.object({
  name: TokenNameSchema,
  symbol: TokenSymbolSchema,
  uri: UriSchema,
  twitter: OptionalUrlSchema,
  telegram: OptionalUrlSchema,
  website: OptionalUrlSchema,
  creatorFeeBps: BasisPointsSchema.max(500).default(0), // Max 5% creator fee
});

export type CreateLaunchRequest = z.infer<typeof CreateLaunchRequestSchema>;

// =============================================================================
// LAUNCH QUERY PARAMS
// =============================================================================

export const LaunchListQuerySchema = PaginationSchema.extend({
  status: LaunchStatusSchema.optional(),
  sort: LaunchSortFieldSchema,
  order: SortOrderSchema,
  search: SearchQuerySchema.optional(),
  creator: SolanaAddressSchema.optional(),
});

export type LaunchListQuery = z.infer<typeof LaunchListQuerySchema>;

export const LaunchByIdParamsSchema = z.object({
  publicKey: SolanaAddressSchema,
});

export type LaunchByIdParams = z.infer<typeof LaunchByIdParamsSchema>;

// =============================================================================
// LAUNCH RESPONSE SCHEMA
// =============================================================================

export const LaunchResponseSchema = z.object({
  publicKey: SolanaAddressSchema,
  mint: SolanaAddressSchema,
  creator: SolanaAddressSchema,
  status: LaunchStatusSchema,
  totalSupply: NonNegativeNumberSchema,
  tokensSold: NonNegativeNumberSchema,
  graduationTokens: NonNegativeNumberSchema,
  creatorTokens: NonNegativeNumberSchema,
  virtualSolReserve: NonNegativeNumberSchema,
  virtualTokenReserve: NonNegativeNumberSchema,
  realSolReserve: NonNegativeNumberSchema,
  realTokenReserve: NonNegativeNumberSchema,
  graduationThreshold: NonNegativeNumberSchema,
  createdAt: z.number(),
  graduatedAt: z.number().optional(),
  tradeCount: NonNegativeNumberSchema,
  holderCount: NonNegativeNumberSchema,
  orbitPool: SolanaAddressSchema.optional(),
  creatorFeeBps: BasisPointsSchema,
  name: z.string(),
  symbol: z.string(),
  uri: z.string(),
  twitter: z.string().optional(),
  telegram: z.string().optional(),
  website: z.string().optional(),
  currentPrice: NonNegativeNumberSchema,
  marketCap: NonNegativeNumberSchema,
});

export type LaunchResponse = z.infer<typeof LaunchResponseSchema>;

export const LaunchListResponseSchema = z.object({
  launches: z.array(LaunchResponseSchema),
  total: z.number(),
  page: z.number(),
  pageSize: z.number(),
  totalPages: z.number().optional(),
});

export type LaunchListResponse = z.infer<typeof LaunchListResponseSchema>;

// =============================================================================
// TRENDING LAUNCHES
// =============================================================================

export const TrendingQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(10),
  timeframe: z.enum(['1h', '6h', '24h', '7d']).default('24h'),
});

export type TrendingQuery = z.infer<typeof TrendingQuerySchema>;
