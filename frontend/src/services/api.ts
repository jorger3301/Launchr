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

  // ---------------------------------------------------------------------------
  // USERS
  // ---------------------------------------------------------------------------

  async getUserLaunches(address: string): Promise<ApiResponse<{ launches: LaunchData[] }>> {
    return this.request<{ launches: LaunchData[] }>(`/api/users/${address}/launches`);
  }

  async getUserPositions(address: string): Promise<ApiResponse<{ positions: any[] }>> {
    return this.request<{ positions: any[] }>(`/api/users/${address}/positions`);
  }

  async getUserTrades(address: string): Promise<ApiResponse<{ trades: TradeData[] }>> {
    return this.request<{ trades: TradeData[] }>(`/api/users/${address}/trades`);
  }

  // ---------------------------------------------------------------------------
  // STATS
  // ---------------------------------------------------------------------------

  async getGlobalStats(): Promise<ApiResponse<StatsResponse>> {
    return this.request<StatsResponse>('/api/stats');
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

class WebSocketClient {
  private ws: WebSocket | null = null;
  private url: string;
  private handlers: Set<MessageHandler> = new Set();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private subscriptions: Set<WebSocketChannel> = new Set();

  constructor(url: string = `${API_BASE_URL.replace('http', 'ws')}/ws`) {
    this.url = url;
  }

  connect(): void {
    if (this.ws?.readyState === WebSocket.OPEN) return;

    try {
      this.ws = new WebSocket(this.url);

      this.ws.onopen = () => {
        console.log('WebSocket connected');
        this.reconnectAttempts = 0;

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
        this.attemptReconnect();
      };

      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error);
      };
    } catch (error) {
      console.error('Failed to connect WebSocket:', error);
      this.attemptReconnect();
    }
  }

  private processMessage(message: WebSocketMessage): void {
    // Normalize backend messages to frontend format
    if (message.type === 'connected') {
      const normalized: NormalizedMessage = {
        type: 'connected',
        channels: message.data.channels
      };
      this.handlers.forEach(handler => handler(normalized));
      return;
    }

    if (message.type === 'update') {
      const { channel, data } = message;

      if (channel === 'trades') {
        // Transform trade data to frontend format
        const normalized: NormalizedMessage = {
          type: 'trade',
          data: {
            type: data.type,
            user: data.trader,
            amount: data.tokenAmount,
            solAmount: data.solAmount,
            price: data.price,
            timestamp: data.timestamp,
            txSignature: data.signature,
          },
          launchPk: data.launch
        };
        this.handlers.forEach(handler => handler(normalized));
      } else if (channel === 'launches') {
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
