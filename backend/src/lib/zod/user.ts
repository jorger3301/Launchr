/**
 * User Zod Schemas
 *
 * Validators for user-related API requests and responses.
 */

import { z } from 'zod';
import {
  SolanaAddressSchema,
  PaginationSchema,
  SortOrderSchema,
  NonNegativeNumberSchema,
} from './common';

// =============================================================================
// USER PARAMS
// =============================================================================

export const UserByAddressParamsSchema = z.object({
  address: SolanaAddressSchema,
});

export type UserByAddressParams = z.infer<typeof UserByAddressParamsSchema>;

// =============================================================================
// USER POSITION
// =============================================================================

export const UserPositionSchema = z.object({
  publicKey: SolanaAddressSchema,
  launch: SolanaAddressSchema,
  user: SolanaAddressSchema,
  tokensBought: NonNegativeNumberSchema,
  tokensSold: NonNegativeNumberSchema,
  tokenBalance: NonNegativeNumberSchema,
  solSpent: NonNegativeNumberSchema,
  solReceived: NonNegativeNumberSchema,
  firstTradeAt: z.number(),
  lastTradeAt: z.number(),
  buyCount: z.number().int(),
  sellCount: z.number().int(),
  avgBuyPrice: NonNegativeNumberSchema,
  costBasis: NonNegativeNumberSchema,
  unrealizedPnl: z.number().optional(),
  realizedPnl: z.number().optional(),
  totalPnl: z.number().optional(),
  roiPercent: z.number().optional(),
});

export type UserPosition = z.infer<typeof UserPositionSchema>;

// =============================================================================
// USER POSITIONS QUERY
// =============================================================================

export const UserPositionsQuerySchema = PaginationSchema.extend({
  hideZeroBalance: z.coerce.boolean().default(false),
  sort: z.enum(['lastTradeAt', 'tokenBalance', 'pnl', 'costBasis']).default('lastTradeAt'),
  order: SortOrderSchema,
});

export type UserPositionsQuery = z.infer<typeof UserPositionsQuerySchema>;

// =============================================================================
// USER STATS RESPONSE
// =============================================================================

export const UserStatsResponseSchema = z.object({
  address: SolanaAddressSchema,
  positions: z.array(UserPositionSchema),
  totalValue: NonNegativeNumberSchema,
  totalPnl: z.number(),
  totalCostBasis: NonNegativeNumberSchema,
  launchesTraded: z.number().int(),
  totalTrades: z.number().int(),
  totalBuys: z.number().int(),
  totalSells: z.number().int(),
  totalSolSpent: NonNegativeNumberSchema,
  totalSolReceived: NonNegativeNumberSchema,
  firstTradeAt: z.number().optional(),
  lastTradeAt: z.number().optional(),
});

export type UserStatsResponse = z.infer<typeof UserStatsResponseSchema>;

// =============================================================================
// USER TRADE HISTORY QUERY
// =============================================================================

export const UserTradeHistoryQuerySchema = PaginationSchema.extend({
  launchPk: SolanaAddressSchema.optional(),
  type: z.enum(['buy', 'sell']).optional(),
  since: z.coerce.number().int().optional(),
  until: z.coerce.number().int().optional(),
});

export type UserTradeHistoryQuery = z.infer<typeof UserTradeHistoryQuerySchema>;

// =============================================================================
// LEADERBOARD
// =============================================================================

export const LeaderboardQuerySchema = z.object({
  metric: z.enum(['pnl', 'volume', 'trades', 'launches']).default('pnl'),
  timeframe: z.enum(['24h', '7d', '30d', 'all']).default('7d'),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export type LeaderboardQuery = z.infer<typeof LeaderboardQuerySchema>;

export const LeaderboardEntrySchema = z.object({
  rank: z.number().int(),
  address: SolanaAddressSchema,
  value: z.number(),
  trades: z.number().int().optional(),
  launches: z.number().int().optional(),
});

export type LeaderboardEntry = z.infer<typeof LeaderboardEntrySchema>;

export const LeaderboardResponseSchema = z.object({
  entries: z.array(LeaderboardEntrySchema),
  metric: z.string(),
  timeframe: z.string(),
  updatedAt: z.number(),
});

export type LeaderboardResponse = z.infer<typeof LeaderboardResponseSchema>;
