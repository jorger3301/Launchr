/**
 * Account Models
 * 
 * TypeScript interfaces for Launchr on-chain accounts.
 */

import { PublicKey } from '@solana/web3.js';

// =============================================================================
// CONFIG ACCOUNT
// =============================================================================

export interface ConfigAccount {
  admin: PublicKey;
  feeAuthority: PublicKey;
  protocolFeeBps: number;
  graduationThreshold: bigint;
  quoteMint: PublicKey;
  orbitProgramId: PublicKey;
  defaultBinStepBps: number;
  defaultBaseFeeBps: number;
  launchesPaused: boolean;
  tradingPaused: boolean;
  totalLaunches: bigint;
  totalGraduations: bigint;
  totalVolumeLamports: bigint;
  totalFeesCollected: bigint;
  bump: number;
}

// =============================================================================
// LAUNCH ACCOUNT
// =============================================================================

export type LaunchStatus = 'Active' | 'PendingGraduation' | 'Graduated' | 'Cancelled';

export interface LaunchAccount {
  publicKey: string;
  mint: string;
  creator: string;
  status: LaunchStatus;
  totalSupply: number;
  tokensSold: number;
  graduationTokens: number;
  creatorTokens: number;
  virtualSolReserve: number;
  virtualTokenReserve: string | number;
  realSolReserve: number;
  realTokenReserve: number;
  graduationThreshold: number;
  createdAt: number;
  graduatedAt?: number;
  tradeCount: number;
  holderCount: number;
  orbitPool: string;
  creatorFeeBps: number;
  name: string;
  symbol: string;
  uri: string;
  twitter?: string;
  telegram?: string;
  website?: string;
  currentPrice: number;
  marketCap: number;
}

// =============================================================================
// USER POSITION ACCOUNT
// =============================================================================

export interface UserPositionAccount {
  publicKey: string;
  launch: string;
  user: string;
  tokensBought: number;
  tokensSold: number;
  tokenBalance: number;
  solSpent: number;
  solReceived: number;
  firstTradeAt: number;
  lastTradeAt: number;
  buyCount: number;
  sellCount: number;
  avgBuyPrice: number;
  costBasis: number;
}

// =============================================================================
// TRADE EVENT
// =============================================================================

export interface TradeEvent {
  signature: string;
  type: 'buy' | 'sell';
  launch: string;
  trader: string;
  solAmount: number;
  tokenAmount: number;
  price: number;
  timestamp: number;
}

// =============================================================================
// API RESPONSE TYPES
// =============================================================================

export interface LaunchListResponse {
  launches: LaunchAccount[];
  total: number;
  page: number;
  pageSize: number;
}

export interface GlobalStatsResponse {
  totalLaunches: number;
  activeLaunches: number;
  graduatedLaunches: number;
  totalVolume: number;
  totalTrades: number;
  totalHolders: number;
}

export interface TradeListResponse {
  trades: TradeEvent[];
  total: number;
}

export interface UserStatsResponse {
  positions: UserPositionAccount[];
  totalValue: number;
  totalPnl: number;
  launchesTraded: number;
}
