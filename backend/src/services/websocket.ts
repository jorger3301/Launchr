/**
 * WebSocket Service
 *
 * Real-time updates for Launchr clients with security features:
 * - Connection rate limiting per IP
 * - Maximum connections per IP
 * - Message rate limiting
 * - Subscription limits
 * - Heartbeat monitoring
 */

import { WebSocketServer, WebSocket } from 'ws';
import { IncomingMessage } from 'http';
import { IndexerService } from './indexer';
import { logger } from '../utils/logger';

// =============================================================================
// CONFIGURATION
// =============================================================================

const WS_CONFIG = {
  // Connection limits
  maxConnectionsPerIp: 5,
  maxTotalConnections: 1000,

  // Rate limiting
  connectionRateLimit: 10, // Max new connections per IP per minute
  connectionRateWindow: 60000, // 1 minute window

  // Message rate limiting
  messageRateLimit: 30, // Max messages per client per second
  messageRateWindow: 1000, // 1 second window

  // Subscription limits
  maxSubscriptionsPerClient: 10,

  // Heartbeat
  pingInterval: 30000, // 30 seconds
  pongTimeout: 10000, // 10 seconds to respond

  // Message size
  maxMessageSize: 1024, // 1KB max message size
};

// =============================================================================
// TYPES
// =============================================================================

interface WSClient {
  ws: WebSocket;
  ip: string;
  subscriptions: Set<string>;
  isAlive: boolean;
  connectedAt: number;
  messageCount: number;
  messageWindowStart: number;
}

interface WSMessage {
  type: string;
  channel?: string;
  data?: unknown;
}

interface ConnectionRateEntry {
  count: number;
  windowStart: number;
}

// =============================================================================
// WEBSOCKET SERVICE
// =============================================================================

export class WebSocketService {
  private wss: WebSocketServer;
  private indexer: IndexerService;
  private clients: Map<WebSocket, WSClient> = new Map();
  private connectionsByIp: Map<string, Set<WebSocket>> = new Map();
  private connectionRates: Map<string, ConnectionRateEntry> = new Map();
  private pingInterval: NodeJS.Timeout | null = null;
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(wss: WebSocketServer, indexer: IndexerService) {
    this.wss = wss;
    this.indexer = indexer;
  }

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  start(): void {
    // Handle new connections
    this.wss.on('connection', (ws, req) => {
      this.handleConnection(ws, req);
    });

    // Subscribe to indexer events
    this.indexer.on('trade', (data) => {
      this.broadcast('trades', data);
    });

    this.indexer.on('launch:created', (data) => {
      this.broadcast('launches', { type: 'created', ...data });
    });

    this.indexer.on('launch:graduated', (data) => {
      this.broadcast('launches', { type: 'graduated', ...data });
    });

    // Ping clients every 30 seconds
    this.pingInterval = setInterval(() => {
      this.pingClients();
    }, WS_CONFIG.pingInterval);

    // Clean up stale rate limit entries every minute
    this.cleanupInterval = setInterval(() => {
      this.cleanupRateLimits();
    }, 60000);

    logger.info('WebSocket server started with security features enabled');
  }

  stop(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }

    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    // Close all connections
    this.clients.forEach((client) => {
      client.ws.close(1001, 'Server shutting down');
    });
    this.clients.clear();
    this.connectionsByIp.clear();
    this.connectionRates.clear();

    logger.info('WebSocket server stopped');
  }

  // ---------------------------------------------------------------------------
  // Security: Rate Limiting
  // ---------------------------------------------------------------------------

  private getClientIp(req: IncomingMessage): string {
    // Check Cloudflare header first
    const cfIp = req.headers['cf-connecting-ip'];
    if (typeof cfIp === 'string') return cfIp;

    // Check X-Forwarded-For
    const xff = req.headers['x-forwarded-for'];
    if (typeof xff === 'string') {
      const firstIp = xff.split(',')[0].trim();
      if (firstIp) return firstIp;
    }

    // Check X-Real-IP
    const realIp = req.headers['x-real-ip'];
    if (typeof realIp === 'string') return realIp;

    // Fall back to socket address
    return req.socket.remoteAddress || 'unknown';
  }

  private checkConnectionRateLimit(ip: string): boolean {
    const now = Date.now();
    const entry = this.connectionRates.get(ip);

    if (!entry || now - entry.windowStart > WS_CONFIG.connectionRateWindow) {
      // New window
      this.connectionRates.set(ip, { count: 1, windowStart: now });
      return true;
    }

    if (entry.count >= WS_CONFIG.connectionRateLimit) {
      logger.warn(`Connection rate limit exceeded for IP: ${ip}`);
      return false;
    }

    entry.count++;
    return true;
  }

  private checkConnectionLimit(ip: string): boolean {
    // Check total connections
    if (this.clients.size >= WS_CONFIG.maxTotalConnections) {
      logger.warn('Maximum total connections reached');
      return false;
    }

    // Check per-IP connections
    const ipConnections = this.connectionsByIp.get(ip);
    if (ipConnections && ipConnections.size >= WS_CONFIG.maxConnectionsPerIp) {
      logger.warn(`Maximum connections per IP reached for: ${ip}`);
      return false;
    }

    return true;
  }

  private checkMessageRateLimit(client: WSClient): boolean {
    const now = Date.now();

    if (now - client.messageWindowStart > WS_CONFIG.messageRateWindow) {
      // New window
      client.messageCount = 1;
      client.messageWindowStart = now;
      return true;
    }

    if (client.messageCount >= WS_CONFIG.messageRateLimit) {
      logger.warn(`Message rate limit exceeded for IP: ${client.ip}`);
      return false;
    }

    client.messageCount++;
    return true;
  }

  private cleanupRateLimits(): void {
    const now = Date.now();

    // Clean up old connection rate entries
    for (const [ip, entry] of this.connectionRates.entries()) {
      if (now - entry.windowStart > WS_CONFIG.connectionRateWindow * 2) {
        this.connectionRates.delete(ip);
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Connection Handling
  // ---------------------------------------------------------------------------

  private handleConnection(ws: WebSocket, req: IncomingMessage): void {
    const ip = this.getClientIp(req);

    // Check rate limits
    if (!this.checkConnectionRateLimit(ip)) {
      ws.close(1008, 'Rate limit exceeded');
      return;
    }

    // Check connection limits
    if (!this.checkConnectionLimit(ip)) {
      ws.close(1008, 'Connection limit exceeded');
      return;
    }

    const now = Date.now();
    const client: WSClient = {
      ws,
      ip,
      subscriptions: new Set(),
      isAlive: true,
      connectedAt: now,
      messageCount: 0,
      messageWindowStart: now,
    };

    // Track client
    this.clients.set(ws, client);

    // Track IP connections
    let ipConnections = this.connectionsByIp.get(ip);
    if (!ipConnections) {
      ipConnections = new Set();
      this.connectionsByIp.set(ip, ipConnections);
    }
    ipConnections.add(ws);

    logger.info(`Client connected from ${ip} (total: ${this.clients.size})`);

    // Send welcome message
    this.send(ws, {
      type: 'connected',
      data: {
        message: 'Connected to Launchr WebSocket',
        channels: ['trades', 'launches', 'stats', 'chart:<launchId>'],
        limits: {
          maxSubscriptions: WS_CONFIG.maxSubscriptionsPerClient,
          messageRateLimit: WS_CONFIG.messageRateLimit,
        },
      },
    });

    // Handle messages
    ws.on('message', (data) => {
      // Check message size
      if (data.toString().length > WS_CONFIG.maxMessageSize) {
        this.send(ws, { type: 'error', data: { message: 'Message too large' } });
        return;
      }

      // Check message rate limit
      if (!this.checkMessageRateLimit(client)) {
        this.send(ws, { type: 'error', data: { message: 'Rate limit exceeded' } });
        return;
      }

      try {
        const message = JSON.parse(data.toString()) as WSMessage;
        this.handleMessage(ws, message);
      } catch (error) {
        this.send(ws, { type: 'error', data: { message: 'Invalid JSON' } });
      }
    });

    // Handle pong
    ws.on('pong', () => {
      const client = this.clients.get(ws);
      if (client) client.isAlive = true;
    });

    // Handle close
    ws.on('close', () => {
      this.handleDisconnect(ws, ip);
    });

    // Handle errors
    ws.on('error', (error) => {
      logger.error('WebSocket error:', error);
      this.handleDisconnect(ws, ip);
    });
  }

  private handleDisconnect(ws: WebSocket, ip: string): void {
    this.clients.delete(ws);

    // Remove from IP tracking
    const ipConnections = this.connectionsByIp.get(ip);
    if (ipConnections) {
      ipConnections.delete(ws);
      if (ipConnections.size === 0) {
        this.connectionsByIp.delete(ip);
      }
    }

    logger.info(`Client disconnected from ${ip} (total: ${this.clients.size})`);
  }

  private handleMessage(ws: WebSocket, message: WSMessage): void {
    const client = this.clients.get(ws);
    if (!client) return;

    switch (message.type) {
      case 'subscribe':
        if (message.channel) {
          // Check subscription limit
          if (client.subscriptions.size >= WS_CONFIG.maxSubscriptionsPerClient) {
            this.send(ws, {
              type: 'error',
              data: { message: 'Maximum subscriptions reached' },
            });
            return;
          }

          // Validate channel name: static channels + dynamic chart:<launchId>
          const validStaticChannels = ['trades', 'launches', 'stats', 'alerts'];
          const isChartChannel = /^chart:[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(message.channel);
          if (!validStaticChannels.includes(message.channel) && !isChartChannel) {
            this.send(ws, {
              type: 'error',
              data: { message: `Invalid channel: ${message.channel}` },
            });
            return;
          }

          client.subscriptions.add(message.channel);
          this.send(ws, {
            type: 'subscribed',
            channel: message.channel,
          });
          logger.debug(`Client ${client.ip} subscribed to ${message.channel}`);
        }
        break;

      case 'unsubscribe':
        if (message.channel) {
          client.subscriptions.delete(message.channel);
          this.send(ws, {
            type: 'unsubscribed',
            channel: message.channel,
          });
        }
        break;

      case 'ping':
        this.send(ws, { type: 'pong' });
        break;

      default:
        this.send(ws, {
          type: 'error',
          data: { message: `Unknown message type: ${message.type}` },
        });
    }
  }

  // ---------------------------------------------------------------------------
  // Broadcasting
  // ---------------------------------------------------------------------------

  broadcast(channel: string, data: unknown): void {
    const message = JSON.stringify({
      type: 'update',
      channel,
      data,
      timestamp: Date.now(),
    });

    let broadcastCount = 0;
    this.clients.forEach((client) => {
      if (
        client.ws.readyState === WebSocket.OPEN &&
        client.subscriptions.has(channel)
      ) {
        client.ws.send(message);
        broadcastCount++;
      }
    });

    logger.debug(`Broadcast to ${broadcastCount} clients on channel: ${channel}`);
  }

  broadcastAll(data: unknown): void {
    const message = JSON.stringify({
      type: 'broadcast',
      data,
      timestamp: Date.now(),
    });

    this.clients.forEach((client) => {
      if (client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(message);
      }
    });
  }

  private send(ws: WebSocket, message: WSMessage): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  // ---------------------------------------------------------------------------
  // Health Checks
  // ---------------------------------------------------------------------------

  private pingClients(): void {
    this.clients.forEach((client, ws) => {
      if (!client.isAlive) {
        ws.terminate();
        this.handleDisconnect(ws, client.ip);
        return;
      }

      client.isAlive = false;
      ws.ping();
    });
  }

  // ---------------------------------------------------------------------------
  // Stats
  // ---------------------------------------------------------------------------

  getStats(): {
    clients: number;
    connectionsByIp: number;
    subscriptions: Record<string, number>;
    config: typeof WS_CONFIG;
  } {
    const subscriptions: Record<string, number> = {};

    this.clients.forEach((client) => {
      client.subscriptions.forEach((channel) => {
        subscriptions[channel] = (subscriptions[channel] || 0) + 1;
      });
    });

    return {
      clients: this.clients.size,
      connectionsByIp: this.connectionsByIp.size,
      subscriptions,
      config: WS_CONFIG,
    };
  }
}

export default WebSocketService;
