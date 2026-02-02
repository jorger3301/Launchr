/**
 * Trade Zod Schemas
 *
 * Validators for trade-related API requests and responses.
 */

import { z } from 'zod';
import {
  SolanaAddressSchema,
  TransactionSignatureSchema,
  SolAmountSchema,
  TokenAmountSchema,
  SlippageSchema,
  PaginationSchema,
  TradeSortFieldSchema,
  SortOrderSchema,
  NonNegativeNumberSchema,
} from './common';

// =============================================================================
// TRADE TYPE
// =============================================================================

export const TradeTypeSchema = z.enum(['buy', 'sell']);

export type TradeType = z.infer<typeof TradeTypeSchema>;

// =============================================================================
// BUY REQUEST
// =============================================================================

export const BuyRequestSchema = z.object({
  launchPk: SolanaAddressSchema,
  solAmount: SolAmountSchema,
  slippage: SlippageSchema,
  minTokensOut: TokenAmountSchema.optional(),
});

export type BuyRequest = z.infer<typeof BuyRequestSchema>;

// =============================================================================
// SELL REQUEST
// =============================================================================

export const SellRequestSchema = z.object({
  launchPk: SolanaAddressSchema,
  tokenAmount: TokenAmountSchema,
  slippage: SlippageSchema,
  minSolOut: SolAmountSchema.optional(),
});

export type SellRequest = z.infer<typeof SellRequestSchema>;

// =============================================================================
// TRADE ESTIMATE REQUEST
// =============================================================================

export const TradeEstimateRequestSchema = z.object({
  launchPk: SolanaAddressSchema,
  type: TradeTypeSchema,
  amount: z.coerce.number().positive(),
});

export type TradeEstimateRequest = z.infer<typeof TradeEstimateRequestSchema>;

export const TradeEstimateResponseSchema = z.object({
  inputAmount: NonNegativeNumberSchema,
  outputAmount: NonNegativeNumberSchema,
  priceImpact: z.number(),
  fee: NonNegativeNumberSchema,
  rate: NonNegativeNumberSchema,
});

export type TradeEstimateResponse = z.infer<typeof TradeEstimateResponseSchema>;

// =============================================================================
// TRADE QUERY PARAMS
// =============================================================================

export const TradeListQuerySchema = PaginationSchema.extend({
  launchPk: SolanaAddressSchema.optional(),
  trader: SolanaAddressSchema.optional(),
  type: TradeTypeSchema.optional(),
  sort: TradeSortFieldSchema,
  order: SortOrderSchema,
  minAmount: SolAmountSchema.optional(),
  maxAmount: SolAmountSchema.optional(),
  since: z.coerce.number().int().optional(),
  until: z.coerce.number().int().optional(),
});

export type TradeListQuery = z.infer<typeof TradeListQuerySchema>;

export const TradesByLaunchParamsSchema = z.object({
  publicKey: SolanaAddressSchema,
});

export type TradesByLaunchParams = z.infer<typeof TradesByLaunchParamsSchema>;

// =============================================================================
// TRADE RESPONSE SCHEMA
// =============================================================================

export const TradeEventSchema = z.object({
  signature: TransactionSignatureSchema,
  type: TradeTypeSchema,
  launch: SolanaAddressSchema,
  trader: SolanaAddressSchema,
  solAmount: NonNegativeNumberSchema,
  tokenAmount: NonNegativeNumberSchema,
  price: NonNegativeNumberSchema,
  timestamp: z.number(),
  slot: z.number().optional(),
  fee: NonNegativeNumberSchema.optional(),
});

export type TradeEvent = z.infer<typeof TradeEventSchema>;

export const TradeListResponseSchema = z.object({
  trades: z.array(TradeEventSchema),
  total: z.number(),
  page: z.number().optional(),
  pageSize: z.number().optional(),
  hasMore: z.boolean().optional(),
});

export type TradeListResponse = z.infer<typeof TradeListResponseSchema>;

// =============================================================================
// TRADE SUBMISSION RESPONSE
// =============================================================================

export const TradeSubmitResponseSchema = z.object({
  signature: TransactionSignatureSchema,
  status: z.enum(['pending', 'confirmed', 'failed']),
  solAmount: NonNegativeNumberSchema,
  tokenAmount: NonNegativeNumberSchema,
  price: NonNegativeNumberSchema,
  slot: z.number().optional(),
  confirmations: z.number().optional(),
});

export type TradeSubmitResponse = z.infer<typeof TradeSubmitResponseSchema>;
