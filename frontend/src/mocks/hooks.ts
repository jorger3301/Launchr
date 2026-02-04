/**
 * Mock Hooks for Local Development
 * 
 * These hooks provide fake data so you can test the full UI
 * without deploying the Solana program or running a backend.
 * 
 * Enable: REACT_APP_USE_MOCKS=true in .env
 */

import { useState, useCallback, useMemo } from 'react';
import { Transaction } from '@solana/web3.js';
import { LaunchData, TradeData, UserPositionData } from '../components/molecules';
import {
  MOCK_LAUNCHES,
  MOCK_GLOBAL_STATS,
  generateMockTrades,
  generateMockHolders,
  generateMockPriceHistory,
  generateMockUserPosition,
} from './data';
import type { UseWalletResult, UseLaunchesResult, UseTradeResult, GlobalStats, CreateLaunchParams, TradeContext } from '../hooks';

// =============================================================================
// MOCK WALLET
// =============================================================================

export function useMockWallet(): UseWalletResult {
  const [connected, setConnected] = useState(false);
  const [address, setAddress] = useState<string | null>(null);

  const connect = useCallback(async () => {
    // Simulate connection delay
    await new Promise(r => setTimeout(r, 500));
    setAddress('7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsu');
    setConnected(true);
  }, []);

  const disconnect = useCallback(async () => {
    setAddress(null);
    setConnected(false);
  }, []);

  return {
    address,
    balance: connected ? 12.42069 : 0,
    connected,
    connecting: false,
    connect,
    disconnect,
    signTransaction: async (tx: Transaction) => tx,
    refreshBalance: async () => {},
  };
}

// =============================================================================
// MOCK LAUNCHES
// =============================================================================

export function useMockLaunches(): UseLaunchesResult {
  const [launches] = useState<LaunchData[]>(MOCK_LAUNCHES);

  const trendingLaunches = useMemo(() => {
    return [...launches]
      .filter(l => l.status === 'Active' || l.status === 'PendingGraduation')
      .sort((a, b) => b.realSolReserve - a.realSolReserve)
      .slice(0, 10);
  }, [launches]);

  const getLaunch = useCallback((publicKey: string) => {
    return launches.find(l => l.publicKey === publicKey);
  }, [launches]);

  return {
    launches,
    trendingLaunches,
    loading: false,
    error: null,
    refetch: async () => {},
    getLaunch,
  };
}

// =============================================================================
// MOCK SINGLE LAUNCH
// =============================================================================

export function useMockLaunch(publicKey: string | undefined) {
  const launch = useMemo(() => {
    if (!publicKey) return null;
    return MOCK_LAUNCHES.find(l => l.publicKey === publicKey) || MOCK_LAUNCHES[0];
  }, [publicKey]);

  const trades = useMemo(() => {
    if (!publicKey) return [];
    return generateMockTrades(publicKey, 25);
  }, [publicKey]);

  const holders = useMemo(() => generateMockHolders(12), []);
  const priceHistory = useMemo(() => generateMockPriceHistory(72), []);

  return {
    launch,
    trades,
    holders,
    priceHistory,
    loading: false,
    error: null,
    refetch: async () => {},
  };
}

// =============================================================================
// MOCK USER POSITION
// =============================================================================

export function useMockUserPosition(launchPk: string | undefined, userAddress: string | undefined) {
  const position = useMemo(() => {
    if (!launchPk || !userAddress) return null;
    // Deterministic "random" based on input - always returns same result for same inputs
    // This prevents unstable behavior from Math.random() in render
    const hash = (launchPk + userAddress).split('').reduce((a, c) => a + c.charCodeAt(0), 0);
    const hasPosition = (hash % 10) < 7; // 70% chance based on hash
    return hasPosition ? generateMockUserPosition() : null;
  }, [launchPk, userAddress]);

  return {
    position,
    loading: false,
    refetch: async () => {},
  };
}

// =============================================================================
// MOCK TRADE
// =============================================================================

export function useMockTrade(): UseTradeResult {
  const [loading, setLoading] = useState(false);

  const buy = useCallback(async (launchPk: string, solAmount: number, slippage: number): Promise<string> => {
    setLoading(true);
    // Simulate transaction delay
    await new Promise(r => setTimeout(r, 1500));
    setLoading(false);
    if (process.env.NODE_ENV === 'development') {
      console.log(`[MOCK] Buy: ${solAmount} SOL on ${launchPk.slice(0, 8)}... (slippage: ${slippage}%)`);
    }
    return 'mock_signature_' + Date.now();
  }, []);

  const sell = useCallback(async (launchPk: string, tokenAmount: number, slippage: number): Promise<string> => {
    setLoading(true);
    await new Promise(r => setTimeout(r, 1500));
    setLoading(false);
    if (process.env.NODE_ENV === 'development') {
      console.log(`[MOCK] Sell: ${tokenAmount} tokens on ${launchPk.slice(0, 8)}... (slippage: ${slippage}%)`);
    }
    return 'mock_signature_' + Date.now();
  }, []);

  const estimateBuy = useCallback((solAmount: number, _context: TradeContext) => {
    return { tokensOut: solAmount * 1e9 * 0.99, priceImpact: solAmount * 0.5 };
  }, []);

  const estimateSell = useCallback((tokenAmount: number, _context: TradeContext) => {
    return { solOut: tokenAmount * 0.000001 * 0.99, priceImpact: tokenAmount * 0.0001 };
  }, []);

  return { buy, sell, estimateBuy, estimateSell, loading, error: null };
}

// =============================================================================
// MOCK CREATE LAUNCH
// =============================================================================

export function useMockCreateLaunch() {
  const [loading, setLoading] = useState(false);

  const createLaunch = useCallback(async (params: CreateLaunchParams): Promise<string> => {
    setLoading(true);
    await new Promise(r => setTimeout(r, 2000));
    setLoading(false);
    if (process.env.NODE_ENV === 'development') {
      console.log('[MOCK] Created launch:', params.name, params.symbol);
    }
    return 'mock_signature_' + Date.now();
  }, []);

  return { createLaunch, loading, error: null };
}

// =============================================================================
// MOCK GLOBAL STATS
// =============================================================================

export function useMockGlobalStats() {
  return {
    stats: MOCK_GLOBAL_STATS as GlobalStats,
    loading: false,
    refetch: async () => {},
  };
}
