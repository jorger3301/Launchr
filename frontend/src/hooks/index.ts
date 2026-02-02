/**
 * Launchr - Custom Hooks
 *
 * Launch into Orbit 🚀
 * React hooks for wallet connection, launches, trading, and real-time updates.
 *
 * Data fetching uses the backend API for indexed/cached data.
 * Wallet operations use direct Solana RPC.
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Connection, PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL } from '@solana/web3.js';
import BN from 'bn.js';
import { LaunchData, TradeData, UserPositionData } from '../components/molecules';
import { api, wsClient, NormalizedMessage } from '../services/api';
import { LaunchrClient, initLaunchrClient, getLaunchrClient } from '../program/client';
import { BuyParams, SellParams, CreateLaunchParams as ProgramCreateLaunchParams } from '../program/idl';

// =============================================================================
// TYPES
// =============================================================================

export interface WalletAdapter {
  publicKey: PublicKey | null;
  connected: boolean;
  connecting: boolean;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  signTransaction: (tx: Transaction) => Promise<Transaction>;
  signAllTransactions: (txs: Transaction[]) => Promise<Transaction[]>;
}

export interface UseWalletResult {
  address: string | null;
  balance: number;
  connected: boolean;
  connecting: boolean;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  signTransaction: (tx: Transaction) => Promise<Transaction>;
  refreshBalance: () => Promise<void>;
}

export interface UseLaunchesResult {
  launches: LaunchData[];
  trendingLaunches: LaunchData[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  getLaunch: (publicKey: string) => LaunchData | undefined;
}

export interface UseTradeResult {
  buy: (launchPk: string, solAmount: number, slippage: number) => Promise<string>;
  sell: (launchPk: string, tokenAmount: number, slippage: number) => Promise<string>;
  loading: boolean;
  error: string | null;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const RPC_ENDPOINT = process.env.REACT_APP_RPC_ENDPOINT || 'https://api.devnet.solana.com';

// Use System Program as placeholder if no valid program ID is configured
// This is safe because mock mode doesn't use PROGRAM_ID anyway
const PROGRAM_ID_STRING = process.env.REACT_APP_PROGRAM_ID || '11111111111111111111111111111111';
const PROGRAM_ID = new PublicKey(PROGRAM_ID_STRING);

// =============================================================================
// WALLET TYPES & DETECTION
// =============================================================================

export type WalletType = 'phantom' | 'solflare' | 'backpack' | 'jupiter' | null;

interface WalletInfo {
  type: WalletType;
  name: string;
  icon: string;
  url: string;
  detected: boolean;
}

// Wallet icon SVGs as data URIs (reliable, no external dependencies)
const WALLET_ICONS = {
  phantom: `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" fill="none"><rect width="128" height="128" fill="#AB9FF2" rx="26"/><path fill="#fff" d="M110.5 64c0-25.4-20.6-46-46-46-25.4 0-46 20.6-46 46 0 .8 0 1.5.1 2.3.4 3.5 3.4 6.2 6.9 6.2h7.7c3.4 0 6.4-2.5 6.9-5.9.3-2 1.3-3.8 2.8-5.1 2.5-2.1 6.1-2.8 9.3-1.8 4.9 1.6 7.7 6.8 6.2 11.7-.6 2-1.9 3.6-3.5 4.8-1.5 1.1-2.3 2.9-2.3 4.8v3.3c0 3.5 2.9 6.4 6.4 6.4h3.8c3.5 0 6.4-2.9 6.4-6.4V77c0-1.9-.8-3.7-2.3-4.8-1.6-1.2-2.9-2.8-3.5-4.8-1.5-4.9 1.3-10.1 6.2-11.7 3.2-1 6.8-.3 9.3 1.8 1.5 1.3 2.5 3.1 2.8 5.1.5 3.4 3.5 5.9 6.9 5.9h7.7c3.5 0 6.5-2.7 6.9-6.2.1-.8.1-1.5.1-2.3z"/><circle cx="51" cy="52" r="6" fill="#AB9FF2"/><circle cx="77" cy="52" r="6" fill="#AB9FF2"/></svg>`)}`,
  solflare: `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" fill="none"><rect width="128" height="128" fill="#FC6C1C" rx="26"/><path fill="#fff" d="M64 24c-6.6 0-12 5.4-12 12v4c0 2.2 1.8 4 4 4s4-1.8 4-4v-4c0-2.2 1.8-4 4-4s4 1.8 4 4v8c0 6.6-5.4 12-12 12h-8c-6.6 0-12 5.4-12 12v8c0 2.2 1.8 4 4 4s4-1.8 4-4v-8c0-2.2 1.8-4 4-4h8c11 0 20-9 20-20v-8c0-6.6-5.4-12-12-12z"/><path fill="#fff" d="M76 68c-2.2 0-4 1.8-4 4v8c0 2.2-1.8 4-4 4s-4-1.8-4-4v-4c0-2.2-1.8-4-4-4s-4 1.8-4 4v4c0 6.6 5.4 12 12 12s12-5.4 12-12v-8c0-2.2-1.8-4-4-4z"/></svg>`)}`,
  backpack: `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" fill="none"><rect width="128" height="128" fill="#E33E3F" rx="26"/><rect x="36" y="44" width="56" height="56" rx="8" fill="#fff"/><rect x="44" y="52" width="40" height="40" rx="4" fill="#E33E3F"/><rect x="48" y="28" width="32" height="20" rx="4" fill="#fff"/><circle cx="64" cy="72" r="8" fill="#fff"/></svg>`)}`,
  jupiter: `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" fill="none"><rect width="128" height="128" fill="#1FA27F" rx="26"/><circle cx="64" cy="64" r="28" fill="#fff"/><ellipse cx="64" cy="64" rx="44" ry="12" fill="none" stroke="#fff" stroke-width="6"/><circle cx="64" cy="64" r="12" fill="#1FA27F"/></svg>`)}`,
};

// Wallet provider detection
function detectWallets(): WalletInfo[] {
  const wallets: WalletInfo[] = [
    {
      type: 'phantom',
      name: 'Phantom',
      icon: WALLET_ICONS.phantom,
      url: 'https://phantom.app/',
      detected: typeof window !== 'undefined' && !!(window as any).solana?.isPhantom,
    },
    {
      type: 'solflare',
      name: 'Solflare',
      icon: WALLET_ICONS.solflare,
      url: 'https://solflare.com/',
      detected: typeof window !== 'undefined' && !!(window as any).solflare?.isSolflare,
    },
    {
      type: 'backpack',
      name: 'Backpack',
      icon: WALLET_ICONS.backpack,
      url: 'https://backpack.app/',
      detected: typeof window !== 'undefined' && !!(window as any).backpack?.isBackpack,
    },
    {
      type: 'jupiter',
      name: 'Jupiter',
      icon: WALLET_ICONS.jupiter,
      url: 'https://jup.ag/',
      detected: typeof window !== 'undefined' && !!(window as any).jupiter,
    },
  ];

  return wallets;
}

// Get wallet provider by type
function getWalletProvider(type: WalletType): any {
  if (typeof window === 'undefined') return null;

  switch (type) {
    case 'phantom':
      return (window as any).solana?.isPhantom ? (window as any).solana : null;
    case 'solflare':
      return (window as any).solflare?.isSolflare ? (window as any).solflare : null;
    case 'backpack':
      return (window as any).backpack?.isBackpack ? (window as any).backpack : null;
    case 'jupiter':
      return (window as any).jupiter || null;
    default:
      return null;
  }
}

// =============================================================================
// CONNECTION HOOK
// =============================================================================

export function useConnection(): Connection {
  const connectionRef = useRef<Connection | null>(null);

  if (!connectionRef.current) {
    connectionRef.current = new Connection(RPC_ENDPOINT, 'confirmed');
  }

  return connectionRef.current;
}

// =============================================================================
// AVAILABLE WALLETS HOOK
// =============================================================================

export function useAvailableWallets(): WalletInfo[] {
  const [wallets, setWallets] = useState<WalletInfo[]>([]);

  useEffect(() => {
    // Initial detection
    setWallets(detectWallets());

    // Re-detect after a short delay (some wallets inject late)
    const timer = setTimeout(() => {
      setWallets(detectWallets());
    }, 500);

    return () => clearTimeout(timer);
  }, []);

  return wallets;
}

// =============================================================================
// MULTI-WALLET HOOK
// =============================================================================

export interface UseMultiWalletResult extends UseWalletResult {
  walletType: WalletType;
  availableWallets: WalletInfo[];
  connectWallet: (type: WalletType) => Promise<void>;
  showWalletSelector: boolean;
  setShowWalletSelector: (show: boolean) => void;
}

export function useWallet(): UseWalletResult {
  const [address, setAddress] = useState<string | null>(null);
  const [balance, setBalance] = useState(0);
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [activeWallet, setActiveWallet] = useState<WalletType>(null);
  const connection = useConnection();

  // Get active wallet provider
  const getProvider = useCallback(() => {
    return getWalletProvider(activeWallet);
  }, [activeWallet]);

  // Refresh balance
  const refreshBalance = useCallback(async () => {
    if (!address) return;
    try {
      const pubkey = new PublicKey(address);
      const lamports = await connection.getBalance(pubkey);
      setBalance(lamports / LAMPORTS_PER_SOL);
    } catch (err) {
      console.error('Failed to fetch balance:', err);
    }
  }, [address, connection]);

  // Connect to specific wallet
  const connectToWallet = useCallback(async (type: WalletType) => {
    const provider = getWalletProvider(type);

    if (!provider) {
      // Open wallet's website if not installed
      const wallets = detectWallets();
      const wallet = wallets.find(w => w.type === type);
      if (wallet) {
        window.open(wallet.url, '_blank');
      }
      return;
    }

    setConnecting(true);
    setActiveWallet(type);

    try {
      let response;

      // Different wallets have slightly different APIs
      if (type === 'solflare') {
        await provider.connect();
        response = { publicKey: provider.publicKey };
      } else if (type === 'backpack') {
        response = await provider.connect();
      } else if (type === 'jupiter') {
        response = await provider.connect();
      } else {
        // Phantom and default
        response = await provider.connect();
      }

      const pubkey = response.publicKey.toString();
      setAddress(pubkey);
      setConnected(true);

      // Store wallet preference
      localStorage.setItem('launchr_wallet', type || '');

      // Fetch balance
      const lamports = await connection.getBalance(new PublicKey(pubkey));
      setBalance(lamports / LAMPORTS_PER_SOL);
    } catch (err) {
      console.error(`Failed to connect to ${type}:`, err);
      setActiveWallet(null);
    } finally {
      setConnecting(false);
    }
  }, [connection]);

  // Connect - tries last used wallet or shows selector
  const connect = useCallback(async () => {
    // Check for previously used wallet
    const lastWallet = localStorage.getItem('launchr_wallet') as WalletType;
    const availableWallets = detectWallets().filter(w => w.detected);

    if (lastWallet && availableWallets.some(w => w.type === lastWallet)) {
      await connectToWallet(lastWallet);
      return;
    }

    // If only one wallet is available, connect to it
    if (availableWallets.length === 1) {
      await connectToWallet(availableWallets[0].type);
      return;
    }

    // Try Phantom first (most common)
    if (availableWallets.some(w => w.type === 'phantom')) {
      await connectToWallet('phantom');
      return;
    }

    // Connect to first available
    if (availableWallets.length > 0) {
      await connectToWallet(availableWallets[0].type);
      return;
    }

    // No wallets available, open Phantom download page
    window.open('https://phantom.app/', '_blank');
  }, [connectToWallet]);

  // Disconnect wallet
  const disconnect = useCallback(async () => {
    const provider = getProvider();
    if (provider) {
      try {
        await provider.disconnect();
      } catch (err) {
        console.error('Error disconnecting:', err);
      }
    }
    setAddress(null);
    setBalance(0);
    setConnected(false);
    setActiveWallet(null);
    localStorage.removeItem('launchr_wallet');
  }, [getProvider]);

  // Sign transaction
  const signTransaction = useCallback(async (tx: Transaction): Promise<Transaction> => {
    const provider = getProvider();
    if (!provider) {
      throw new Error('Wallet not connected');
    }
    return provider.signTransaction(tx);
  }, [getProvider]);

  // Auto-connect on mount
  useEffect(() => {
    const lastWallet = localStorage.getItem('launchr_wallet') as WalletType;
    if (lastWallet) {
      const provider = getWalletProvider(lastWallet);
      if (provider?.isConnected || provider?.connected) {
        connectToWallet(lastWallet);
      }
    }
  }, [connectToWallet]);

  // Listen for account changes
  useEffect(() => {
    const provider = getProvider();
    if (!provider) return;

    const handleAccountChange = (publicKey: PublicKey | null) => {
      if (publicKey) {
        setAddress(publicKey.toString());
        refreshBalance();
      } else {
        disconnect();
      }
    };

    // Different wallets use different event names
    provider.on?.('accountChanged', handleAccountChange);
    provider.on?.('disconnect', disconnect);

    return () => {
      provider.removeListener?.('accountChanged', handleAccountChange);
      provider.removeListener?.('disconnect', disconnect);
      provider.off?.('accountChanged', handleAccountChange);
      provider.off?.('disconnect', disconnect);
    };
  }, [activeWallet, disconnect, getProvider, refreshBalance]);

  // Refresh balance periodically
  useEffect(() => {
    if (!connected) return;

    const interval = setInterval(refreshBalance, 30000);
    return () => clearInterval(interval);
  }, [connected, refreshBalance]);

  return {
    address,
    balance,
    connected,
    connecting,
    connect,
    disconnect,
    signTransaction,
    refreshBalance,
  };
}

// =============================================================================
// LAUNCHES HOOK (Uses Backend API)
// =============================================================================

export function useLaunches(): UseLaunchesResult {
  const [launches, setLaunches] = useState<LaunchData[]>([]);
  const [trendingLaunches, setTrendingLaunches] = useState<LaunchData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch all launches from backend API
  const fetchLaunches = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // Fetch launches and trending in parallel
      const [launchesRes, trendingRes] = await Promise.all([
        api.getLaunches({ limit: 100, sort: 'created', order: 'desc' }),
        api.getTrendingLaunches(),
      ]);

      if (launchesRes.error) {
        throw new Error(launchesRes.error);
      }

      setLaunches(launchesRes.data?.launches || []);
      setTrendingLaunches(trendingRes.data?.launches || []);
    } catch (err) {
      console.error('Failed to fetch launches:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch launches');
    } finally {
      setLoading(false);
    }
  }, []);

  // Get single launch from cache
  const getLaunch = useCallback((publicKey: string) => {
    return launches.find(l => l.publicKey === publicKey);
  }, [launches]);

  // Fetch on mount
  useEffect(() => {
    fetchLaunches();
  }, [fetchLaunches]);

  // Subscribe to real-time updates via WebSocket
  useEffect(() => {
    wsClient.connect();
    wsClient.subscribeChannel('launches');

    const unsubscribe = wsClient.onMessage((message: NormalizedMessage) => {
      if (message.type === 'launch_created') {
        // Add new launch to the list
        setLaunches(prev => [message.data, ...prev]);
      } else if (message.type === 'launch_graduated') {
        // Update graduated launch
        setLaunches(prev =>
          prev.map(l => (l.publicKey === message.data.publicKey ? message.data : l))
        );
        // Remove from trending
        setTrendingLaunches(prev =>
          prev.filter(l => l.publicKey !== message.data.publicKey)
        );
      }
    });

    return () => {
      wsClient.unsubscribeChannel('launches');
      unsubscribe();
    };
  }, []);

  return {
    launches,
    trendingLaunches,
    loading,
    error,
    refetch: fetchLaunches,
    getLaunch,
  };
}

// =============================================================================
// SINGLE LAUNCH HOOK (Uses Backend API)
// =============================================================================

export function useLaunch(publicKey: string | undefined) {
  const [launch, setLaunch] = useState<LaunchData | null>(null);
  const [trades, setTrades] = useState<TradeData[]>([]);
  const [holders, setHolders] = useState<Array<{ address: string; balance: number; percentage: number }>>([]);
  const [priceHistory, setPriceHistory] = useState<Array<{ timestamp: number; price: number }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch launch details from backend API
  const fetchLaunch = useCallback(async () => {
    if (!publicKey) return;

    setLoading(true);
    setError(null);

    try {
      // Fetch launch data and trades in parallel from backend
      const [launchRes, tradesRes] = await Promise.all([
        api.getLaunch(publicKey),
        api.getLaunchTrades(publicKey, 50),
      ]);

      if (launchRes.error) {
        throw new Error(launchRes.error);
      }

      if (!launchRes.data) {
        throw new Error('Launch not found');
      }

      setLaunch(launchRes.data);
      setTrades(tradesRes.data?.trades || []);

      // Build price history from trades
      const history = (tradesRes.data?.trades || [])
        .filter(t => t.price !== undefined)
        .map(t => ({
          timestamp: t.timestamp,
          price: t.price || 0,
        }))
        .reverse(); // Oldest first
      setPriceHistory(history);

      // Holders would come from a dedicated endpoint if available
      // For now, placeholder until backend provides holder data
      setHolders([]);

    } catch (err) {
      console.error('Failed to fetch launch:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch launch');
    } finally {
      setLoading(false);
    }
  }, [publicKey]);

  // Fetch on mount and when publicKey changes
  useEffect(() => {
    fetchLaunch();
  }, [fetchLaunch]);

  // Subscribe to real-time updates via WebSocket
  useEffect(() => {
    if (!publicKey) return;

    wsClient.connect();
    wsClient.subscribeChannel('trades');
    wsClient.subscribeChannel('launches');

    const unsubscribe = wsClient.onMessage((message: NormalizedMessage) => {
      if (message.type === 'trade' && message.launchPk === publicKey) {
        // Add new trade to the list
        setTrades(prev => [message.data, ...prev].slice(0, 50));
        // Update price history
        if (message.data.price !== undefined) {
          setPriceHistory(prev => [
            ...prev,
            { timestamp: message.data.timestamp, price: message.data.price || 0 },
          ]);
        }
      } else if (message.type === 'launch_graduated' && message.data.publicKey === publicKey) {
        // Update launch with graduated status
        setLaunch(message.data);
      }
    });

    return () => {
      wsClient.unsubscribeChannel('trades');
      wsClient.unsubscribeChannel('launches');
      unsubscribe();
    };
  }, [publicKey]);

  return {
    launch,
    trades,
    holders,
    priceHistory,
    loading,
    error,
    refetch: fetchLaunch,
  };
}

// =============================================================================
// USER POSITION HOOK
// =============================================================================

export function useUserPosition(launchPk: string | undefined, userAddress: string | undefined) {
  const [position, setPosition] = useState<UserPositionData | null>(null);
  const [loading, setLoading] = useState(false);
  const connection = useConnection();

  const fetchPosition = useCallback(async () => {
    if (!launchPk || !userAddress) {
      setPosition(null);
      return;
    }

    setLoading(true);

    try {
      // Derive user position PDA
      const [positionPda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from('user_position'),
          new PublicKey(launchPk).toBuffer(),
          new PublicKey(userAddress).toBuffer(),
        ],
        PROGRAM_ID
      );

      const accountInfo = await connection.getAccountInfo(positionPda);

      if (!accountInfo) {
        setPosition(null);
        return;
      }

      // Parse position data (would use Anchor deserialization)
      // Placeholder
      const parsedPosition: UserPositionData = {
        tokenBalance: 0,
        solSpent: 0,
        solReceived: 0,
        avgBuyPrice: 0,
        costBasis: 0,
        unrealizedPnl: 0,
        realizedPnl: 0,
        totalPnl: 0,
        roiPercent: 0,
      };

      setPosition(parsedPosition);
    } catch (err) {
      console.error('Failed to fetch position:', err);
      setPosition(null);
    } finally {
      setLoading(false);
    }
  }, [launchPk, userAddress, connection]);

  useEffect(() => {
    fetchPosition();
  }, [fetchPosition]);

  return {
    position,
    loading,
    refetch: fetchPosition,
  };
}

// =============================================================================
// TRADE HOOK
// =============================================================================

export interface TradeContext {
  mint: string;
  creator: string;
  virtualSolReserve?: number;
  virtualTokenReserve?: number;
  protocolFeeBps?: number;
  creatorFeeBps?: number;
}

export function useTrade(wallet: UseWalletResult): UseTradeResult & {
  buyWithContext: (launchPk: string, solAmount: number, slippage: number, context: TradeContext) => Promise<string>;
  sellWithContext: (launchPk: string, tokenAmount: number, slippage: number, context: TradeContext) => Promise<string>;
  estimateBuy: (solAmount: number, context: TradeContext) => { tokensOut: number; priceImpact: number };
  estimateSell: (tokenAmount: number, context: TradeContext) => { solOut: number; priceImpact: number };
} {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const connection = useConnection();
  const clientRef = useRef<LaunchrClient | null>(null);

  // Initialize client
  useEffect(() => {
    if (!clientRef.current) {
      clientRef.current = getLaunchrClient() || initLaunchrClient(connection);
    }
  }, [connection]);

  // Estimate buy output
  const estimateBuy = useCallback((solAmount: number, context: TradeContext) => {
    const client = clientRef.current;
    if (!client) {
      return { tokensOut: 0, priceImpact: 0 };
    }

    const solLamports = new BN(Math.floor(solAmount * LAMPORTS_PER_SOL));
    const virtualSolReserve = new BN(context.virtualSolReserve || 30 * LAMPORTS_PER_SOL);
    const virtualTokenReserve = new BN(context.virtualTokenReserve || 800_000_000 * 1e9);

    const { tokensOut, priceImpact } = client.calculateBuyOutput(
      solLamports,
      virtualSolReserve,
      virtualTokenReserve,
      context.protocolFeeBps || 100,
      context.creatorFeeBps || 0
    );

    return {
      tokensOut: tokensOut.toNumber() / 1e9,
      priceImpact,
    };
  }, []);

  // Estimate sell output
  const estimateSell = useCallback((tokenAmount: number, context: TradeContext) => {
    const client = clientRef.current;
    if (!client) {
      return { solOut: 0, priceImpact: 0 };
    }

    const tokenLamports = new BN(Math.floor(tokenAmount * 1e9));
    const virtualSolReserve = new BN(context.virtualSolReserve || 30 * LAMPORTS_PER_SOL);
    const virtualTokenReserve = new BN(context.virtualTokenReserve || 800_000_000 * 1e9);

    const { solOut, priceImpact } = client.calculateSellOutput(
      tokenLamports,
      virtualSolReserve,
      virtualTokenReserve,
      context.protocolFeeBps || 100,
      context.creatorFeeBps || 0
    );

    return {
      solOut: solOut.toNumber() / LAMPORTS_PER_SOL,
      priceImpact,
    };
  }, []);

  // Execute buy with full context
  const buyWithContext = useCallback(async (
    launchPk: string,
    solAmount: number,
    slippage: number,
    context: TradeContext
  ): Promise<string> => {
    if (!wallet.connected || !wallet.address) {
      throw new Error('Wallet not connected');
    }

    const client = clientRef.current;
    if (!client) {
      throw new Error('Program client not initialized');
    }

    setLoading(true);
    setError(null);

    try {
      const buyer = new PublicKey(wallet.address);
      const launchPubkey = new PublicKey(launchPk);
      const mint = new PublicKey(context.mint);
      const creator = new PublicKey(context.creator);

      // Calculate expected output and apply slippage
      const estimate = estimateBuy(solAmount, context);
      const minTokensOut = Math.floor(estimate.tokensOut * (1 - slippage / 100) * 1e9);

      const params: BuyParams = {
        solAmount: new BN(Math.floor(solAmount * LAMPORTS_PER_SOL)),
        minTokensOut: new BN(minTokensOut),
      };

      // Build transaction using LaunchrClient
      const tx = await client.buildBuyTx(buyer, launchPubkey, mint, creator, params);

      // Get recent blockhash
      const { blockhash } = await connection.getLatestBlockhash();
      tx.recentBlockhash = blockhash;
      tx.feePayer = buyer;

      // Sign and send
      const signedTx = await wallet.signTransaction(tx);
      const signature = await connection.sendRawTransaction(signedTx.serialize());

      // Confirm
      await connection.confirmTransaction(signature, 'confirmed');

      // Refresh balance
      await wallet.refreshBalance();

      return signature;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Transaction failed';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [wallet, connection, estimateBuy]);

  // Execute sell with full context
  const sellWithContext = useCallback(async (
    launchPk: string,
    tokenAmount: number,
    slippage: number,
    context: TradeContext
  ): Promise<string> => {
    if (!wallet.connected || !wallet.address) {
      throw new Error('Wallet not connected');
    }

    const client = clientRef.current;
    if (!client) {
      throw new Error('Program client not initialized');
    }

    setLoading(true);
    setError(null);

    try {
      const seller = new PublicKey(wallet.address);
      const launchPubkey = new PublicKey(launchPk);
      const mint = new PublicKey(context.mint);
      const creator = new PublicKey(context.creator);

      // Calculate expected output and apply slippage
      const estimate = estimateSell(tokenAmount, context);
      const minSolOut = Math.floor(estimate.solOut * (1 - slippage / 100) * LAMPORTS_PER_SOL);

      const params: SellParams = {
        tokenAmount: new BN(Math.floor(tokenAmount * 1e9)),
        minSolOut: new BN(minSolOut),
      };

      // Build transaction using LaunchrClient
      const tx = await client.buildSellTx(seller, launchPubkey, mint, creator, params);

      // Get recent blockhash
      const { blockhash } = await connection.getLatestBlockhash();
      tx.recentBlockhash = blockhash;
      tx.feePayer = seller;

      // Sign and send
      const signedTx = await wallet.signTransaction(tx);
      const signature = await connection.sendRawTransaction(signedTx.serialize());

      // Confirm
      await connection.confirmTransaction(signature, 'confirmed');

      // Refresh balance
      await wallet.refreshBalance();

      return signature;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Transaction failed';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [wallet, connection, estimateSell]);

  // Legacy buy (uses API to fetch context)
  const buy = useCallback(async (
    launchPk: string,
    solAmount: number,
    slippage: number
  ): Promise<string> => {
    // Fetch launch data to get context
    const launchRes = await api.getLaunch(launchPk);
    if (!launchRes.data) {
      throw new Error('Launch not found');
    }

    const launch = launchRes.data;
    const context: TradeContext = {
      mint: launch.mint,
      creator: launch.creator,
      virtualSolReserve: launch.virtualSolReserve,
      virtualTokenReserve: launch.virtualTokenReserve,
      protocolFeeBps: 100,
      creatorFeeBps: launch.creatorFeeBps || 0,
    };

    return buyWithContext(launchPk, solAmount, slippage, context);
  }, [buyWithContext]);

  // Legacy sell (uses API to fetch context)
  const sell = useCallback(async (
    launchPk: string,
    tokenAmount: number,
    slippage: number
  ): Promise<string> => {
    // Fetch launch data to get context
    const launchRes = await api.getLaunch(launchPk);
    if (!launchRes.data) {
      throw new Error('Launch not found');
    }

    const launch = launchRes.data;
    const context: TradeContext = {
      mint: launch.mint,
      creator: launch.creator,
      virtualSolReserve: launch.virtualSolReserve,
      virtualTokenReserve: launch.virtualTokenReserve,
      protocolFeeBps: 100,
      creatorFeeBps: launch.creatorFeeBps || 0,
    };

    return sellWithContext(launchPk, tokenAmount, slippage, context);
  }, [sellWithContext]);

  return {
    buy,
    sell,
    buyWithContext,
    sellWithContext,
    estimateBuy,
    estimateSell,
    loading,
    error,
  };
}

// =============================================================================
// CREATE LAUNCH HOOK
// =============================================================================

export interface CreateLaunchParams {
  name: string;
  symbol: string;
  uri: string;
  twitter?: string;
  telegram?: string;
  website?: string;
  creatorFeeBps: number;
}

export interface CreateLaunchResult {
  signature: string;
  mint: string;
  launchPda: string;
}

export function useCreateLaunch(wallet: UseWalletResult) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const connection = useConnection();
  const clientRef = useRef<LaunchrClient | null>(null);

  // Initialize client
  useEffect(() => {
    if (!clientRef.current) {
      clientRef.current = getLaunchrClient() || initLaunchrClient(connection);
    }
  }, [connection]);

  const createLaunch = useCallback(async (params: CreateLaunchParams): Promise<string> => {
    if (!wallet.connected || !wallet.address) {
      throw new Error('Wallet not connected');
    }

    const client = clientRef.current;
    if (!client) {
      throw new Error('Program client not initialized');
    }

    setLoading(true);
    setError(null);

    try {
      const creator = new PublicKey(wallet.address);

      // Build program params
      const programParams: ProgramCreateLaunchParams = {
        name: params.name,
        symbol: params.symbol,
        uri: params.uri,
        twitter: params.twitter || null,
        telegram: params.telegram || null,
        website: params.website || null,
        creatorFeeBps: params.creatorFeeBps,
      };

      // Build transaction using LaunchrClient
      const { transaction, mint } = await client.buildCreateLaunchTx(creator, programParams);

      // Get recent blockhash
      const { blockhash } = await connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = creator;

      // Partially sign with mint keypair (required for mint creation)
      transaction.partialSign(mint);

      // Sign with wallet
      const signedTx = await wallet.signTransaction(transaction);
      const signature = await connection.sendRawTransaction(signedTx.serialize());

      // Confirm
      await connection.confirmTransaction(signature, 'confirmed');
      await wallet.refreshBalance();

      return signature;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create launch';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [wallet, connection]);

  // Extended create that returns mint and launch addresses
  const createLaunchFull = useCallback(async (params: CreateLaunchParams): Promise<CreateLaunchResult> => {
    if (!wallet.connected || !wallet.address) {
      throw new Error('Wallet not connected');
    }

    const client = clientRef.current;
    if (!client) {
      throw new Error('Program client not initialized');
    }

    setLoading(true);
    setError(null);

    try {
      const creator = new PublicKey(wallet.address);

      // Build program params
      const programParams: ProgramCreateLaunchParams = {
        name: params.name,
        symbol: params.symbol,
        uri: params.uri,
        twitter: params.twitter || null,
        telegram: params.telegram || null,
        website: params.website || null,
        creatorFeeBps: params.creatorFeeBps,
      };

      // Build transaction using LaunchrClient
      const { transaction, mint } = await client.buildCreateLaunchTx(creator, programParams);

      // Get launch PDA
      const launchPda = client.getLaunchPda(mint.publicKey);

      // Get recent blockhash
      const { blockhash } = await connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = creator;

      // Partially sign with mint keypair
      transaction.partialSign(mint);

      // Sign with wallet
      const signedTx = await wallet.signTransaction(transaction);
      const signature = await connection.sendRawTransaction(signedTx.serialize());

      // Confirm
      await connection.confirmTransaction(signature, 'confirmed');
      await wallet.refreshBalance();

      return {
        signature,
        mint: mint.publicKey.toBase58(),
        launchPda: launchPda.toBase58(),
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create launch';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [wallet, connection]);

  return {
    createLaunch,
    createLaunchFull,
    loading,
    error,
  };
}

// =============================================================================
// GLOBAL STATS HOOK (Uses Backend API)
// =============================================================================

export interface GlobalStats {
  totalLaunches: number;
  totalGraduated: number;
  totalVolume: number;
  totalFees: number;
}

export function useGlobalStats() {
  const [stats, setStats] = useState<GlobalStats>({
    totalLaunches: 0,
    totalGraduated: 0,
    totalVolume: 0,
    totalFees: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await api.getGlobalStats();

      if (response.error) {
        throw new Error(response.error);
      }

      if (response.data?.stats) {
        setStats(response.data.stats);
      }
    } catch (err) {
      console.error('Failed to fetch global stats:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch stats');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  return {
    stats,
    loading,
    error,
    refetch: fetchStats,
  };
}

// =============================================================================
// REAL-TIME UPDATES HOOK (Uses WebSocket)
// =============================================================================

export function useRealtimeUpdates(launchPk: string | undefined) {
  const [lastTrade, setLastTrade] = useState<TradeData | null>(null);
  const [lastUpdate, setLastUpdate] = useState<LaunchData | null>(null);

  useEffect(() => {
    if (!launchPk) return;

    // Subscribe to launch updates via WebSocket
    wsClient.connect();
    wsClient.subscribeChannel('trades');
    wsClient.subscribeChannel('launches');

    const unsubscribe = wsClient.onMessage((message: NormalizedMessage) => {
      if (message.type === 'trade' && message.launchPk === launchPk) {
        setLastTrade(message.data);
      } else if (message.type === 'launch_graduated' && message.data.publicKey === launchPk) {
        setLastUpdate(message.data);
      } else if (message.type === 'launch_created' && message.data.publicKey === launchPk) {
        setLastUpdate(message.data);
      }
    });

    return () => {
      wsClient.unsubscribeChannel('trades');
      wsClient.unsubscribeChannel('launches');
      unsubscribe();
    };
  }, [launchPk]);

  return {
    lastTrade,
    lastUpdate,
  };
}

// =============================================================================
// LOCAL STORAGE HOOK
// =============================================================================

export function useLocalStorage<T>(key: string, initialValue: T) {
  const [value, setValue] = useState<T>(() => {
    if (typeof window === 'undefined') return initialValue;
    
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch {
      return initialValue;
    }
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (err) {
      console.error('Failed to save to localStorage:', err);
    }
  }, [key, value]);

  return [value, setValue] as const;
}

// =============================================================================
// DEBOUNCE HOOK
// =============================================================================

export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}

// =============================================================================
// SOL PRICE HOOK (Pyth Oracle)
// =============================================================================

export interface SolPriceData {
  price: number;
  change24h: number;
  confidence: number;
  lastUpdate: number;
}

export function useSolPrice(refreshInterval: number = 10000): {
  solPrice: SolPriceData;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
} {
  const [solPrice, setSolPrice] = useState<SolPriceData>({
    price: 0,
    change24h: 0,
    confidence: 0,
    lastUpdate: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const previousPriceRef = useRef<number>(0);

  const fetchSolPrice = useCallback(async () => {
    try {
      const response = await api.getSolPrice();

      if (response.error) {
        throw new Error(response.error);
      }

      if (response.data) {
        const prevPrice = previousPriceRef.current;
        const newPrice = response.data.price;

        // Calculate 24h change based on previous price
        // In production, this would come from the API
        const change24h = prevPrice > 0
          ? ((newPrice - prevPrice) / prevPrice) * 100
          : 0;

        previousPriceRef.current = newPrice;

        setSolPrice({
          price: newPrice,
          change24h,
          confidence: response.data.confidence,
          lastUpdate: response.data.publishTime,
        });
        setError(null);
      }
    } catch (err) {
      console.error('Failed to fetch SOL price:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch price');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSolPrice();

    const interval = setInterval(fetchSolPrice, refreshInterval);
    return () => clearInterval(interval);
  }, [fetchSolPrice, refreshInterval]);

  return { solPrice, loading, error, refetch: fetchSolPrice };
}

// =============================================================================
// TOKEN METADATA HOOK (Metaplex DAS)
// =============================================================================

export interface TokenMetadata {
  mint: string;
  name: string;
  symbol: string;
  image?: string;
  description?: string;
  uri: string;
  attributes?: { trait_type: string; value: string | number }[];
  collection?: { verified: boolean; key: string; name?: string };
  creators?: { address: string; share: number; verified: boolean }[];
  royalty?: number;
  isMutable: boolean;
}

export function useTokenMetadata(mintAddress: string | undefined): {
  metadata: TokenMetadata | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
} {
  const [metadata, setMetadata] = useState<TokenMetadata | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMetadata = useCallback(async () => {
    if (!mintAddress) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await api.getTokenMetadata(mintAddress);

      if (response.error) {
        throw new Error(response.error);
      }

      if (response.data) {
        setMetadata({
          mint: response.data.mint,
          name: response.data.name,
          symbol: response.data.symbol,
          image: response.data.image,
          description: response.data.description,
          uri: response.data.uri,
          attributes: response.data.attributes,
          collection: response.data.collection,
          creators: response.data.creators,
          royalty: response.data.royalty,
          isMutable: response.data.isMutable,
        });
      }
    } catch (err) {
      console.error('Failed to fetch token metadata:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch metadata');
    } finally {
      setLoading(false);
    }
  }, [mintAddress]);

  useEffect(() => {
    fetchMetadata();
  }, [fetchMetadata]);

  return { metadata, loading, error, refetch: fetchMetadata };
}

// =============================================================================
// MULTI-TOKEN METADATA HOOK
// =============================================================================

export function useMultipleTokenMetadata(mintAddresses: string[]): {
  metadataMap: Map<string, TokenMetadata>;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
} {
  const [metadataMap, setMetadataMap] = useState<Map<string, TokenMetadata>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAllMetadata = useCallback(async () => {
    if (mintAddresses.length === 0) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await api.getMultipleTokenMetadata(mintAddresses);

      if (response.error) {
        throw new Error(response.error);
      }

      if (response.data?.metadata) {
        const newMap = new Map<string, TokenMetadata>();
        Object.entries(response.data.metadata).forEach(([mint, data]) => {
          newMap.set(mint, {
            mint: data.mint,
            name: data.name,
            symbol: data.symbol,
            image: data.image,
            description: data.description,
            uri: data.uri,
            attributes: data.attributes,
            collection: data.collection,
            creators: data.creators,
            royalty: data.royalty,
            isMutable: data.isMutable,
          });
        });
        setMetadataMap(newMap);
      }
    } catch (err) {
      console.error('Failed to fetch token metadata:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch metadata');
    } finally {
      setLoading(false);
    }
  }, [mintAddresses]);

  useEffect(() => {
    fetchAllMetadata();
  }, [fetchAllMetadata]);

  return { metadataMap, loading, error, refetch: fetchAllMetadata };
}
