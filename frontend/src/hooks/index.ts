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
import { LaunchData, TradeData, UserPositionData } from '../components/molecules';
import { api, wsClient, NormalizedMessage } from '../services/api';

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
// WALLET HOOK
// =============================================================================

export function useWallet(): UseWalletResult {
  const [address, setAddress] = useState<string | null>(null);
  const [balance, setBalance] = useState(0);
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const connection = useConnection();

  // Check for Phantom wallet
  const getProvider = useCallback(() => {
    if (typeof window !== 'undefined' && 'solana' in window) {
      const provider = (window as any).solana;
      if (provider?.isPhantom) {
        return provider;
      }
    }
    return null;
  }, []);

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

  // Connect wallet
  const connect = useCallback(async () => {
    const provider = getProvider();
    if (!provider) {
      window.open('https://phantom.app/', '_blank');
      return;
    }

    setConnecting(true);
    try {
      const response = await provider.connect();
      const pubkey = response.publicKey.toString();
      setAddress(pubkey);
      setConnected(true);
      
      // Fetch balance
      const lamports = await connection.getBalance(response.publicKey);
      setBalance(lamports / LAMPORTS_PER_SOL);
    } catch (err) {
      console.error('Failed to connect:', err);
    } finally {
      setConnecting(false);
    }
  }, [connection, getProvider]);

  // Disconnect wallet
  const disconnect = useCallback(async () => {
    const provider = getProvider();
    if (provider) {
      await provider.disconnect();
    }
    setAddress(null);
    setBalance(0);
    setConnected(false);
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
    const provider = getProvider();
    if (provider?.isConnected) {
      connect();
    }

    // Listen for account changes
    provider?.on('accountChanged', (publicKey: PublicKey | null) => {
      if (publicKey) {
        setAddress(publicKey.toString());
        refreshBalance();
      } else {
        disconnect();
      }
    });

    return () => {
      provider?.removeAllListeners('accountChanged');
    };
  }, [connect, disconnect, getProvider, refreshBalance]);

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

export function useTrade(wallet: UseWalletResult): UseTradeResult {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const connection = useConnection();

  // Execute buy
  const buy = useCallback(async (
    launchPk: string,
    solAmount: number,
    slippage: number
  ): Promise<string> => {
    if (!wallet.connected || !wallet.address) {
      throw new Error('Wallet not connected');
    }

    setLoading(true);
    setError(null);

    try {
      const lamports = solAmount * LAMPORTS_PER_SOL;
      
      // Build buy instruction
      // In production, this would use Anchor's instruction builder
      const buyIx = {
        programId: PROGRAM_ID,
        keys: [
          // ... account metas
        ],
        data: Buffer.from([/* buy instruction data */]),
      };

      // Create transaction
      const tx = new Transaction();
      // tx.add(buyIx);

      // Get recent blockhash
      const { blockhash } = await connection.getLatestBlockhash();
      tx.recentBlockhash = blockhash;
      tx.feePayer = new PublicKey(wallet.address);

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
  }, [wallet, connection]);

  // Execute sell
  const sell = useCallback(async (
    launchPk: string,
    tokenAmount: number,
    slippage: number
  ): Promise<string> => {
    if (!wallet.connected || !wallet.address) {
      throw new Error('Wallet not connected');
    }

    setLoading(true);
    setError(null);

    try {
      // Build sell instruction (similar to buy)
      const tx = new Transaction();

      const { blockhash } = await connection.getLatestBlockhash();
      tx.recentBlockhash = blockhash;
      tx.feePayer = new PublicKey(wallet.address);

      const signedTx = await wallet.signTransaction(tx);
      const signature = await connection.sendRawTransaction(signedTx.serialize());
      
      await connection.confirmTransaction(signature, 'confirmed');
      await wallet.refreshBalance();

      return signature;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Transaction failed';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [wallet, connection]);

  return {
    buy,
    sell,
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

export function useCreateLaunch(wallet: UseWalletResult) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const connection = useConnection();

  const createLaunch = useCallback(async (params: CreateLaunchParams): Promise<string> => {
    if (!wallet.connected || !wallet.address) {
      throw new Error('Wallet not connected');
    }

    setLoading(true);
    setError(null);

    try {
      // Build create_launch instruction
      // In production, this would use Anchor's instruction builder
      const tx = new Transaction();

      const { blockhash } = await connection.getLatestBlockhash();
      tx.recentBlockhash = blockhash;
      tx.feePayer = new PublicKey(wallet.address);

      const signedTx = await wallet.signTransaction(tx);
      const signature = await connection.sendRawTransaction(signedTx.serialize());
      
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

  return {
    createLaunch,
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
