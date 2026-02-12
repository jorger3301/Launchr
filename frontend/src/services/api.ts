/**
 * Launchr - API Service
 *
 * Launch into Orbit 🚀
 * Client for the Launchr backend REST API.
 */

import { LaunchData, TradeData } from '../components/molecules';

// =============================================================================
// CONFIGURATION
// =============================================================================

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

// =============================================================================
// TYPES
// =============================================================================

export interface ApiResponse<T> {
  data?: T;
  error?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface LaunchesResponse {
  launches: LaunchData[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface TradesResponse {
  trades: TradeData[];
}

export interface HoldersResponse {
  holders: Array<{
    address: string;
    balance: number;
    percentage: number;
  }>;
}

export interface GlobalStats {
  totalLaunches: number;
  totalGraduated: number;
  totalVolume: number;
  totalFees: number;
}

export interface StatsResponse {
  stats: GlobalStats;
}

// Pyth Oracle Price Types
export interface PythPriceResponse {
  price: number;
  confidence: number;
  symbol: string;
  publishTime: number;
  emaPrice: number;
}

export interface PythMultiPriceResponse {
  prices: Record<string, PythPriceResponse>;
}

// Metaplex Token Metadata Types
export interface TokenMetadataResponse {
  mint: string;
  name: string;
  symbol: string;
  uri: string;
  image?: string;
  description?: string;
  attributes?: { trait_type: string; value: string | number }[];
  collection?: {
    verified: boolean;
    key: string;
    name?: string;
  };
  creators?: { address: string; share: number; verified: boolean }[];
  royalty?: number;
  isMutable: boolean;
  primarySaleHappened: boolean;
  tokenStandard?: string;
}

export interface MultiTokenMetadataResponse {
  metadata: Record<string, TokenMetadataResponse>;
}

// =============================================================================
// API CLIENT
// =============================================================================

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    try {
      const url = `${this.baseUrl}${endpoint}`;
      const response = await fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        return { error: errorData.error || `HTTP ${response.status}` };
      }

      const data = await response.json();
      return { data };
    } catch (error) {
      console.error('API request failed:', error);
      return { error: error instanceof Error ? error.message : 'Network error' };
    }
  }

  // ---------------------------------------------------------------------------
  // LAUNCHES
  // ---------------------------------------------------------------------------

  async getLaunches(params?: {
    status?: string;
    sort?: 'created' | 'price' | 'volume' | 'marketcap' | 'holders' | 'trades';
    order?: 'asc' | 'desc';
    page?: number;
    limit?: number;
    search?: string;
  }): Promise<ApiResponse<LaunchesResponse>> {
    const queryParams = new URLSearchParams();
    if (params?.status) queryParams.set('status', params.status);
    if (params?.sort) queryParams.set('sort', params.sort);
    if (params?.order) queryParams.set('order', params.order);
    if (params?.page) queryParams.set('page', params.page.toString());
    if (params?.limit) queryParams.set('limit', params.limit.toString());
    if (params?.search) queryParams.set('search', params.search);

    const query = queryParams.toString();
    return this.request<LaunchesResponse>(`/api/launches${query ? `?${query}` : ''}`);
  }

  async getTrendingLaunches(): Promise<ApiResponse<{ launches: LaunchData[] }>> {
    return this.request<{ launches: LaunchData[] }>('/api/launches/trending');
  }

  async getRecentLaunches(): Promise<ApiResponse<{ launches: LaunchData[] }>> {
    return this.request<{ launches: LaunchData[] }>('/api/launches/recent');
  }

  async getGraduatedLaunches(): Promise<ApiResponse<{ launches: LaunchData[] }>> {
    return this.request<{ launches: LaunchData[] }>('/api/launches/graduated');
  }

  async getLaunch(publicKey: string): Promise<ApiResponse<LaunchData>> {
    return this.request<LaunchData>(`/api/launches/${publicKey}`);
  }

  async getLaunchTrades(publicKey: string, limit = 50): Promise<ApiResponse<TradesResponse>> {
    return this.request<TradesResponse>(`/api/launches/${publicKey}/trades?limit=${limit}`);
  }

  async getLaunchHolders(publicKey: string): Promise<ApiResponse<{
    totalHolders: number;
    topHolders: Array<{
      rank: number;
      address: string;
      balance: number;
      percentage: number;
    }>;
    distribution: {
      top10Percentage: number;
      top20Percentage: number;
      averageHolding: number;
    };
  }>> {
    return this.request(`/api/launches/${publicKey}/holders`);
  }

  async getLaunchChart(publicKey: string, timeframe: '1H' | '4H' | '1D' | '7D' | '30D' = '1D'): Promise<ApiResponse<{
    symbol: string;
    timeframe: string;
    candles: Array<{
      time: number;
      open: number;
      high: number;
      low: number;
      close: number;
      volume: number;
    }>;
    summary: {
      high: number;
      low: number;
      open: number;
      close: number;
      changePercent: number;
      volume: number;
    };
  }>> {
    return this.request(`/api/launches/${publicKey}/chart?timeframe=${timeframe}`);
  }

  // ---------------------------------------------------------------------------
  // CHART (Supabase-backed endpoints)
  // ---------------------------------------------------------------------------

  async getChartTrades(launchId: string, limit = 50): Promise<ApiResponse<TradesResponse>> {
    try {
      const url = `${this.baseUrl}/api/chart/${launchId}/trades?limit=${limit}`;
      const response = await fetch(url, { headers: { 'Content-Type': 'application/json' } });
      if (!response.ok) return { error: `HTTP ${response.status}` };
      const data = await response.json();
      // Normalize Supabase trade format → TradeData format
      const trades = (data.trades || []).map((t: any) => ({
        type: t.type || t.swap_type || 'buy',
        user: t.trader || '',
        amount: t.tokenAmount || 0,
        solAmount: t.solAmount || 0,
        price: t.price || 0,
        timestamp: typeof t.time === 'number' ? Math.floor(t.time / 1000) : t.time || 0,
        txSignature: t.signature || '',
      }));
      return { data: { trades } };
    } catch {
      return { error: 'Chart trades unavailable' };
    }
  }

  // ---------------------------------------------------------------------------
  // USERS
  // ---------------------------------------------------------------------------

  async getUserLaunches(address: string): Promise<ApiResponse<{ launches: LaunchData[] }>> {
    return this.request<{ launches: LaunchData[] }>(`/api/users/${address}/launches`);
  }

  async getUserPositions(address: string): Promise<ApiResponse<{ positions: any[]; totalValue: number; totalPnl: number; positionCount: number }>> {
    return this.request<{ positions: any[]; totalValue: number; totalPnl: number; positionCount: number }>(`/api/users/${address}/positions`);
  }

  async getUserTrades(address: string): Promise<ApiResponse<{ trades: TradeData[] }>> {
    return this.request<{ trades: TradeData[] }>(`/api/users/${address}/trades`);
  }

  async getUserActivity(address: string, limit = 50): Promise<ApiResponse<{
    activity: Array<{
      type: 'buy' | 'sell';
      launch: {
        publicKey: string;
        name: string;
        symbol: string;
        mint: string;
      };
      solAmount: number;
      tokenAmount: number;
      price: number;
      timestamp: number;
      signature: string;
    }>;
    total: number;
  }>> {
    return this.request(`/api/users/${address}/activity?limit=${limit}`);
  }

  async getUserBalances(address: string, launchPk: string): Promise<ApiResponse<{
    solBalance: number;
    tokenBalance: number;
    tokenSymbol: string;
    position: any | null;
    tokenValue: number;
  }>> {
    return this.request(`/api/users/${address}/balances/${launchPk}`);
  }

  async getUserStats(address: string): Promise<ApiResponse<{
    address: string;
    positionsCount: number;
    launchesCreated: number;
    totalTrades: number;
    totalBuys: number;
    totalSells: number;
    totalSolSpent: number;
    totalSolReceived: number;
    netSol: number;
  }>> {
    return this.request(`/api/users/${address}/stats`);
  }

  // ---------------------------------------------------------------------------
  // STATS
  // ---------------------------------------------------------------------------

  async getGlobalStats(): Promise<ApiResponse<StatsResponse>> {
    return this.request<StatsResponse>('/api/stats');
  }

  // ---------------------------------------------------------------------------
  // PYTH ORACLE PRICES
  // ---------------------------------------------------------------------------

  async getSolPrice(): Promise<ApiResponse<PythPriceResponse>> {
    return this.request<PythPriceResponse>('/api/stats/sol-price');
  }

  async getTokenPrices(symbols: string[]): Promise<ApiResponse<PythMultiPriceResponse>> {
    const symbolsParam = symbols.join(',');
    return this.request<PythMultiPriceResponse>(`/api/stats/prices?symbols=${symbolsParam}`);
  }

  // ---------------------------------------------------------------------------
  // METAPLEX TOKEN METADATA
  // ---------------------------------------------------------------------------

  async getTokenMetadata(mintAddress: string): Promise<ApiResponse<TokenMetadataResponse>> {
    return this.request<TokenMetadataResponse>(`/api/launches/${mintAddress}/metadata`);
  }

  async getMultipleTokenMetadata(mintAddresses: string[]): Promise<ApiResponse<MultiTokenMetadataResponse>> {
    return this.request<MultiTokenMetadataResponse>('/api/launches/metadata', {
      method: 'POST',
      body: JSON.stringify({ mints: mintAddresses }),
    });
  }

  // ---------------------------------------------------------------------------
  // UPLOAD / METADATA
  // ---------------------------------------------------------------------------

  async uploadMetadata(params: {
    name: string;
    symbol: string;
    description?: string;
    image?: string;
    twitter?: string;
    telegram?: string;
    website?: string;
    creator?: string;
  }): Promise<ApiResponse<{ success: boolean; uri: string; imageUrl: string; uploadId: string }>> {
    return this.request('/api/upload/metadata', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  }

  // ---------------------------------------------------------------------------
  // HEALTH
  // ---------------------------------------------------------------------------

  async checkHealth(): Promise<ApiResponse<{ status: string; timestamp: number }>> {
    return this.request<{ status: string; timestamp: number }>('/health');
  }
}

// =============================================================================
// SINGLETON INSTANCE
// =============================================================================

export const api = new ApiClient();

// =============================================================================
// WEBSOCKET SERVICE
// =============================================================================

// Channel-based message types matching backend format
export type WebSocketChannel = 'trades' | 'launches' | 'stats';

export interface WSUpdateMessage {
  type: 'update';
  channel: WebSocketChannel;
  data: any;
  timestamp: number;
}

export interface WSConnectionMessage {
  type: 'connected';
  data: { message: string; channels: string[] };
}

export interface WSSubscriptionMessage {
  type: 'subscribed' | 'unsubscribed';
  channel: string;
}

export type WebSocketMessage = WSUpdateMessage | WSConnectionMessage | WSSubscriptionMessage;

// Normalized message for frontend handlers
export type NormalizedMessage =
  | { type: 'trade'; data: TradeData; launchPk: string }
  | { type: 'launch_created'; data: LaunchData }
  | { type: 'launch_graduated'; data: LaunchData }
  | { type: 'connected'; channels: string[] };

type MessageHandler = (message: NormalizedMessage) => void;

type ConnectionStatusHandler = (connected: boolean) => void;

class WebSocketClient {
  private ws: WebSocket | null = null;
  private url: string;
  private handlers: Set<MessageHandler> = new Set();
  private connectionHandlers: Set<ConnectionStatusHandler> = new Set();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private subscriptions: Set<WebSocketChannel> = new Set();
  private _isConnected = false;

  constructor(url: string = `${API_BASE_URL.replace('http', 'ws')}/ws`) {
    this.url = url;
  }

  connect(): void {
    if (this.ws?.readyState === WebSocket.OPEN || this.ws?.readyState === WebSocket.CONNECTING) return;

    try {
      this.ws = new WebSocket(this.url);

      this.ws.onopen = () => {
        console.log('WebSocket connected');
        this.reconnectAttempts = 0;
        this._isConnected = true;
        this.notifyConnectionChange(true);

        // Resubscribe to previous channel subscriptions
        this.subscriptions.forEach(channel => {
          this.send({ type: 'subscribe', channel });
        });
      };

      this.ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data) as WebSocketMessage;
          this.processMessage(message);
        } catch (err) {
          console.error('Failed to parse WebSocket message:', err);
        }
      };

      this.ws.onclose = () => {
        console.log('WebSocket disconnected');
        this._isConnected = false;
        this.notifyConnectionChange(false);
        this.attemptReconnect();
      };

      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        this._isConnected = false;
        this.notifyConnectionChange(false);
      };
    } catch (error) {
      console.error('Failed to connect WebSocket:', error);
      this._isConnected = false;
      this.notifyConnectionChange(false);
      this.attemptReconnect();
    }
  }

  private notifyConnectionChange(connected: boolean): void {
    this.connectionHandlers.forEach(handler => handler(connected));
  }

  onConnectionChange(handler: ConnectionStatusHandler): () => void {
    this.connectionHandlers.add(handler);
    // Immediately notify of current state
    handler(this._isConnected);
    return () => this.connectionHandlers.delete(handler);
  }

  private processMessage(message: WebSocketMessage): void {
    // Validate message structure
    if (!message || typeof message !== 'object' || !message.type) {
      console.warn('Invalid WebSocket message format:', message);
      return;
    }

    // Normalize backend messages to frontend format
    if (message.type === 'connected') {
      const channels = message.data?.channels;
      if (!Array.isArray(channels)) {
        console.warn('Invalid connected message - missing channels array');
        return;
      }
      const normalized: NormalizedMessage = {
        type: 'connected',
        channels
      };
      this.handlers.forEach(handler => handler(normalized));
      return;
    }

    if (message.type === 'update') {
      const { channel, data } = message;

      // Validate update message has required fields
      if (!channel || !data || typeof data !== 'object') {
        console.warn('Invalid update message - missing channel or data:', message);
        return;
      }

      if (channel === 'trades') {
        // Normalize field names — backend may use 'user' or 'trader', 'amount' or 'tokenAmount'
        const trader = data.trader || data.user || '';
        const launch = data.launch || data.launchPk || data.launchId || '';
        const tokenAmount = data.tokenAmount ?? data.amount ?? 0;
        const solAmount = data.solAmount ?? 0;

        // Validate trade data has minimum required fields
        if (!trader || !launch) {
          console.warn('Invalid trade data - missing trader or launch:', data);
          return;
        }

        // Normalize timestamp: backend sends 'time' (ms) or 'timestamp' (s)
        let timestamp = data.timestamp;
        if (timestamp === undefined && data.time !== undefined) {
          // Backend sends time in milliseconds, convert to seconds for frontend
          timestamp = typeof data.time === 'number' && data.time > 1e12
            ? Math.floor(data.time / 1000)
            : data.time;
        }
        if (timestamp === undefined) {
          timestamp = Math.floor(Date.now() / 1000);
        }

        // Transform trade data to frontend format
        const normalized: NormalizedMessage = {
          type: 'trade',
          data: {
            type: data.type || data.swapType || 'buy',
            user: trader,
            amount: tokenAmount,
            solAmount: solAmount,
            price: data.price ?? 0,
            timestamp,
            txSignature: data.signature || data.txSignature || '',
          },
          launchPk: launch
        };
        this.handlers.forEach(handler => handler(normalized));
      } else if (channel === 'launches') {
        // Validate launch data
        if (!data.type || (data.type !== 'created' && data.type !== 'graduated')) {
          console.warn('Invalid launch event type:', data.type);
          return;
        }

        // Handle launch events (created, graduated)
        const eventType = data.type === 'created' ? 'launch_created' : 'launch_graduated';
        const normalized: NormalizedMessage = {
          type: eventType as 'launch_created' | 'launch_graduated',
          data: data
        };
        this.handlers.forEach(handler => handler(normalized));
      }
    }
  }

  private attemptReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.log('Max reconnect attempts reached');
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);

    console.log(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);
    setTimeout(() => this.connect(), delay);
  }

  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.subscriptions.clear();
  }

  private send(data: any): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }

  // Subscribe to a channel (trades, launches, stats)
  subscribeChannel(channel: WebSocketChannel): void {
    this.subscriptions.add(channel);
    this.send({ type: 'subscribe', channel });
  }

  // Unsubscribe from a channel
  unsubscribeChannel(channel: WebSocketChannel): void {
    this.subscriptions.delete(channel);
    this.send({ type: 'unsubscribe', channel });
  }

  // Subscribe to all real-time updates
  subscribeAll(): void {
    this.subscribeChannel('trades');
    this.subscribeChannel('launches');
    this.subscribeChannel('stats');
  }

  onMessage(handler: MessageHandler): () => void {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}

export const wsClient = new WebSocketClient();
