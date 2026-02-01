/**
 * WebSocket Service
 * 
 * Real-time updates for Launchr clients.
 */

import { WebSocketServer, WebSocket } from 'ws';
import { IndexerService } from './indexer';
import { logger } from '../utils/logger';

// =============================================================================
// TYPES
// =============================================================================

interface WSClient {
  ws: WebSocket;
  subscriptions: Set<string>;
  isAlive: boolean;
}

interface WSMessage {
  type: string;
  channel?: string;
  data?: any;
}

// =============================================================================
// WEBSOCKET SERVICE
// =============================================================================

export class WebSocketService {
  private wss: WebSocketServer;
  private indexer: IndexerService;
  private clients: Map<WebSocket, WSClient> = new Map();
  private pingInterval: NodeJS.Timeout | null = null;

  constructor(wss: WebSocketServer, indexer: IndexerService) {
    this.wss = wss;
    this.indexer = indexer;
  }

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  start(): void {
    // Handle new connections
    this.wss.on('connection', (ws) => {
      this.handleConnection(ws);
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
    }, 30000);

    logger.info(`WebSocket server started with ${this.wss.clients.size} clients`);
  }

  stop(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }

    // Close all connections
    this.clients.forEach((client) => {
      client.ws.close();
    });
    this.clients.clear();

    logger.info('WebSocket server stopped');
  }

  // ---------------------------------------------------------------------------
  // Connection Handling
  // ---------------------------------------------------------------------------

  private handleConnection(ws: WebSocket): void {
    const client: WSClient = {
      ws,
      subscriptions: new Set(),
      isAlive: true,
    };
    this.clients.set(ws, client);

    logger.info(`Client connected (total: ${this.clients.size})`);

    // Send welcome message
    this.send(ws, {
      type: 'connected',
      data: {
        message: 'Connected to Launchr WebSocket',
        channels: ['trades', 'launches', 'stats'],
      },
    });

    // Handle messages
    ws.on('message', (data) => {
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
      this.clients.delete(ws);
      logger.info(`Client disconnected (total: ${this.clients.size})`);
    });

    // Handle errors
    ws.on('error', (error) => {
      logger.error('WebSocket error:', error);
      this.clients.delete(ws);
    });
  }

  private handleMessage(ws: WebSocket, message: WSMessage): void {
    const client = this.clients.get(ws);
    if (!client) return;

    switch (message.type) {
      case 'subscribe':
        if (message.channel) {
          client.subscriptions.add(message.channel);
          this.send(ws, {
            type: 'subscribed',
            channel: message.channel,
          });
          logger.debug(`Client subscribed to ${message.channel}`);
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

  broadcast(channel: string, data: any): void {
    const message = JSON.stringify({
      type: 'update',
      channel,
      data,
      timestamp: Date.now(),
    });

    this.clients.forEach((client) => {
      if (
        client.ws.readyState === WebSocket.OPEN &&
        client.subscriptions.has(channel)
      ) {
        client.ws.send(message);
      }
    });
  }

  broadcastAll(data: any): void {
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
        this.clients.delete(ws);
        return;
      }

      client.isAlive = false;
      ws.ping();
    });
  }

  // ---------------------------------------------------------------------------
  // Stats
  // ---------------------------------------------------------------------------

  getStats(): { clients: number; subscriptions: Record<string, number> } {
    const subscriptions: Record<string, number> = {};

    this.clients.forEach((client) => {
      client.subscriptions.forEach((channel) => {
        subscriptions[channel] = (subscriptions[channel] || 0) + 1;
      });
    });

    return {
      clients: this.clients.size,
      subscriptions,
    };
  }
}

export default WebSocketService;
