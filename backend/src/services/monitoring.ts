/**
 * Trading Monitoring Service
 *
 * Real-time anomaly detection and alerting for trading activity.
 *
 * Features:
 * - Unusual volume detection
 * - Price manipulation detection
 * - Wash trading detection
 * - Large trade alerts
 * - Velocity tracking
 * - Suspicious pattern recognition
 */

import { EventEmitter } from 'events';
import { logger } from '../utils/logger';

// =============================================================================
// CONFIGURATION
// =============================================================================

const MONITORING_CONFIG = {
  // Volume thresholds
  volumeWindow: 300000, // 5 minutes
  highVolumeMultiplier: 5, // Alert if volume > 5x average
  lowVolumeThreshold: 0.1, // Warn if volume < 10% of average

  // Trade size thresholds (in SOL)
  largeTradeThreshold: 10, // Alert on trades > 10 SOL
  whaleTradeThreshold: 50, // Alert on trades > 50 SOL

  // Velocity thresholds
  maxTradesPerMinute: 20, // Per launch
  maxTradesPerAddress: 10, // Per address per minute

  // Price movement thresholds
  rapidPriceChangePercent: 20, // Alert on > 20% price change in window
  priceChangeWindow: 60000, // 1 minute

  // Wash trading detection
  washTradingWindow: 300000, // 5 minutes
  minWashTradeCount: 5, // Minimum trades to consider
  washTradeRatioThreshold: 0.8, // If > 80% of trades are round-trips

  // Pattern detection
  patternWindow: 600000, // 10 minutes
  suspiciousPatternThreshold: 0.7, // Confidence threshold

  // Alert cooldowns (prevent alert spam)
  alertCooldown: 60000, // 1 minute between same alert types
};

// =============================================================================
// TYPES
// =============================================================================

export interface TradeEvent {
  launchPk: string;
  trader: string;
  type: 'buy' | 'sell';
  solAmount: number;
  tokenAmount: number;
  price: number;
  timestamp: number;
  signature: string;
}

export interface Alert {
  id: string;
  type: AlertType;
  severity: 'info' | 'warning' | 'critical';
  message: string;
  data: Record<string, unknown>;
  timestamp: number;
  launchPk?: string;
  trader?: string;
}

export type AlertType =
  | 'large_trade'
  | 'whale_trade'
  | 'high_volume'
  | 'rapid_price_change'
  | 'velocity_spike'
  | 'wash_trading'
  | 'suspicious_pattern'
  | 'new_whale'
  | 'repeated_trades';

interface TradeWindow {
  trades: TradeEvent[];
  volume: number;
  buyVolume: number;
  sellVolume: number;
  startPrice: number;
  endPrice: number;
}

interface AddressActivity {
  trades: TradeEvent[];
  lastAlert: Map<AlertType, number>;
}

interface LaunchMetrics {
  recentTrades: TradeEvent[];
  priceHistory: Array<{ price: number; timestamp: number }>;
  volumeHistory: Array<{ volume: number; timestamp: number }>;
  averageVolume: number;
  traderActivity: Map<string, AddressActivity>;
}

// =============================================================================
// MONITORING SERVICE
// =============================================================================

export class MonitoringService extends EventEmitter {
  private launchMetrics: Map<string, LaunchMetrics> = new Map();
  private globalAlerts: Alert[] = [];
  private alertCooldowns: Map<string, number> = new Map();
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    super();
  }

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  start(): void {
    // Clean up old data every minute
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 60000);

    logger.info('Trading monitoring service started');
  }

  stop(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    this.launchMetrics.clear();
    this.globalAlerts = [];
    this.alertCooldowns.clear();

    logger.info('Trading monitoring service stopped');
  }

  // ---------------------------------------------------------------------------
  // Trade Processing
  // ---------------------------------------------------------------------------

  /**
   * Process a new trade event
   */
  processTrade(trade: TradeEvent): Alert[] {
    const alerts: Alert[] = [];

    // Get or create launch metrics
    let metrics = this.launchMetrics.get(trade.launchPk);
    if (!metrics) {
      metrics = this.createLaunchMetrics();
      this.launchMetrics.set(trade.launchPk, metrics);
    }

    // Add trade to history
    metrics.recentTrades.push(trade);
    metrics.priceHistory.push({ price: trade.price, timestamp: trade.timestamp });

    // Get or create address activity
    let addressActivity = metrics.traderActivity.get(trade.trader);
    if (!addressActivity) {
      addressActivity = { trades: [], lastAlert: new Map() };
      metrics.traderActivity.set(trade.trader, addressActivity);
    }
    addressActivity.trades.push(trade);

    // Run detection checks
    alerts.push(...this.checkLargeTrade(trade, metrics));
    alerts.push(...this.checkVelocity(trade, metrics));
    alerts.push(...this.checkPriceMovement(trade, metrics));
    alerts.push(...this.checkWashTrading(trade, metrics));
    alerts.push(...this.checkVolumeAnomaly(trade, metrics));
    alerts.push(...this.checkRepeatedTrades(trade, addressActivity));

    // Update volume history
    this.updateVolumeHistory(metrics, trade);

    // Emit alerts
    for (const alert of alerts) {
      if (this.shouldEmitAlert(alert)) {
        this.globalAlerts.push(alert);
        this.emit('alert', alert);
        logger.warn(`Trading alert: ${alert.type} - ${alert.message}`);
      }
    }

    return alerts;
  }

  // ---------------------------------------------------------------------------
  // Detection Methods
  // ---------------------------------------------------------------------------

  private checkLargeTrade(trade: TradeEvent, _metrics: LaunchMetrics): Alert[] {
    const alerts: Alert[] = [];

    if (trade.solAmount >= MONITORING_CONFIG.whaleTradeThreshold) {
      alerts.push({
        id: `whale_${trade.signature}`,
        type: 'whale_trade',
        severity: 'critical',
        message: `Whale ${trade.type} detected: ${trade.solAmount.toFixed(2)} SOL`,
        data: {
          solAmount: trade.solAmount,
          tokenAmount: trade.tokenAmount,
          price: trade.price,
          tradeType: trade.type,
        },
        timestamp: Date.now(),
        launchPk: trade.launchPk,
        trader: trade.trader,
      });
    } else if (trade.solAmount >= MONITORING_CONFIG.largeTradeThreshold) {
      alerts.push({
        id: `large_${trade.signature}`,
        type: 'large_trade',
        severity: 'warning',
        message: `Large ${trade.type} detected: ${trade.solAmount.toFixed(2)} SOL`,
        data: {
          solAmount: trade.solAmount,
          tokenAmount: trade.tokenAmount,
          price: trade.price,
          tradeType: trade.type,
        },
        timestamp: Date.now(),
        launchPk: trade.launchPk,
        trader: trade.trader,
      });
    }

    return alerts;
  }

  private checkVelocity(trade: TradeEvent, metrics: LaunchMetrics): Alert[] {
    const alerts: Alert[] = [];
    const now = Date.now();
    const oneMinuteAgo = now - 60000;

    // Check launch-level velocity
    const recentLaunchTrades = metrics.recentTrades.filter(t => t.timestamp > oneMinuteAgo);
    if (recentLaunchTrades.length > MONITORING_CONFIG.maxTradesPerMinute) {
      alerts.push({
        id: `velocity_launch_${trade.launchPk}_${now}`,
        type: 'velocity_spike',
        severity: 'warning',
        message: `High trading velocity: ${recentLaunchTrades.length} trades/min`,
        data: {
          tradesPerMinute: recentLaunchTrades.length,
          threshold: MONITORING_CONFIG.maxTradesPerMinute,
        },
        timestamp: now,
        launchPk: trade.launchPk,
      });
    }

    // Check address-level velocity
    const addressActivity = metrics.traderActivity.get(trade.trader);
    if (addressActivity) {
      const recentAddressTrades = addressActivity.trades.filter(t => t.timestamp > oneMinuteAgo);
      if (recentAddressTrades.length > MONITORING_CONFIG.maxTradesPerAddress) {
        alerts.push({
          id: `velocity_address_${trade.trader}_${now}`,
          type: 'velocity_spike',
          severity: 'warning',
          message: `High trading velocity for address: ${recentAddressTrades.length} trades/min`,
          data: {
            tradesPerMinute: recentAddressTrades.length,
            threshold: MONITORING_CONFIG.maxTradesPerAddress,
            trader: trade.trader,
          },
          timestamp: now,
          launchPk: trade.launchPk,
          trader: trade.trader,
        });
      }
    }

    return alerts;
  }

  private checkPriceMovement(trade: TradeEvent, metrics: LaunchMetrics): Alert[] {
    const alerts: Alert[] = [];
    const now = Date.now();
    const windowStart = now - MONITORING_CONFIG.priceChangeWindow;

    // Get price at start of window
    const windowPrices = metrics.priceHistory.filter(p => p.timestamp > windowStart);
    if (windowPrices.length < 2) return alerts;

    const startPrice = windowPrices[0].price;
    const currentPrice = trade.price;
    const priceChange = Math.abs(currentPrice - startPrice) / startPrice * 100;

    if (priceChange > MONITORING_CONFIG.rapidPriceChangePercent) {
      const direction = currentPrice > startPrice ? 'increase' : 'decrease';
      alerts.push({
        id: `price_${trade.launchPk}_${now}`,
        type: 'rapid_price_change',
        severity: 'critical',
        message: `Rapid price ${direction}: ${priceChange.toFixed(1)}% in ${MONITORING_CONFIG.priceChangeWindow / 1000}s`,
        data: {
          startPrice,
          currentPrice,
          changePercent: priceChange,
          direction,
          windowMs: MONITORING_CONFIG.priceChangeWindow,
        },
        timestamp: now,
        launchPk: trade.launchPk,
      });
    }

    return alerts;
  }

  private checkWashTrading(trade: TradeEvent, metrics: LaunchMetrics): Alert[] {
    const alerts: Alert[] = [];
    const now = Date.now();
    const windowStart = now - MONITORING_CONFIG.washTradingWindow;

    const addressActivity = metrics.traderActivity.get(trade.trader);
    if (!addressActivity) return alerts;

    // Get recent trades for this address
    const recentTrades = addressActivity.trades.filter(t => t.timestamp > windowStart);
    if (recentTrades.length < MONITORING_CONFIG.minWashTradeCount) return alerts;

    // Check for buy-sell-buy or sell-buy-sell patterns (round-trips)
    let roundTrips = 0;
    for (let i = 2; i < recentTrades.length; i++) {
      const t1 = recentTrades[i - 2];
      const t2 = recentTrades[i - 1];
      const t3 = recentTrades[i];

      // Round trip: buy->sell->buy or sell->buy->sell
      if (
        (t1.type === 'buy' && t2.type === 'sell' && t3.type === 'buy') ||
        (t1.type === 'sell' && t2.type === 'buy' && t3.type === 'sell')
      ) {
        roundTrips++;
      }
    }

    const roundTripRatio = roundTrips / (recentTrades.length - 2);
    if (roundTripRatio >= MONITORING_CONFIG.washTradeRatioThreshold) {
      alerts.push({
        id: `wash_${trade.trader}_${now}`,
        type: 'wash_trading',
        severity: 'critical',
        message: `Potential wash trading detected: ${(roundTripRatio * 100).toFixed(0)}% round-trip pattern`,
        data: {
          roundTrips,
          totalTrades: recentTrades.length,
          roundTripRatio,
          windowMs: MONITORING_CONFIG.washTradingWindow,
        },
        timestamp: now,
        launchPk: trade.launchPk,
        trader: trade.trader,
      });
    }

    return alerts;
  }

  private checkVolumeAnomaly(trade: TradeEvent, metrics: LaunchMetrics): Alert[] {
    const alerts: Alert[] = [];
    const now = Date.now();
    const windowStart = now - MONITORING_CONFIG.volumeWindow;

    // Calculate current window volume
    const recentTrades = metrics.recentTrades.filter(t => t.timestamp > windowStart);
    const currentVolume = recentTrades.reduce((sum, t) => sum + t.solAmount, 0);

    // Need historical data to compare
    if (metrics.averageVolume === 0) {
      // Initialize average
      metrics.averageVolume = currentVolume;
      return alerts;
    }

    // Check for volume anomaly
    const volumeRatio = currentVolume / metrics.averageVolume;

    if (volumeRatio >= MONITORING_CONFIG.highVolumeMultiplier) {
      alerts.push({
        id: `volume_high_${trade.launchPk}_${now}`,
        type: 'high_volume',
        severity: 'warning',
        message: `Unusual volume spike: ${volumeRatio.toFixed(1)}x average`,
        data: {
          currentVolume,
          averageVolume: metrics.averageVolume,
          volumeRatio,
          tradeCount: recentTrades.length,
        },
        timestamp: now,
        launchPk: trade.launchPk,
      });
    }

    // Update moving average (exponential)
    const alpha = 0.1; // Smoothing factor
    metrics.averageVolume = alpha * currentVolume + (1 - alpha) * metrics.averageVolume;

    return alerts;
  }

  private checkRepeatedTrades(trade: TradeEvent, activity: AddressActivity): Alert[] {
    const alerts: Alert[] = [];
    const now = Date.now();
    const windowStart = now - 60000; // 1 minute

    // Check for repeated similar-sized trades
    const recentTrades = activity.trades.filter(t => t.timestamp > windowStart);
    if (recentTrades.length < 3) return alerts;

    // Group by similar amounts (within 5%)
    const similarTrades = recentTrades.filter(t => {
      const ratio = t.solAmount / trade.solAmount;
      return ratio >= 0.95 && ratio <= 1.05;
    });

    if (similarTrades.length >= 5) {
      alerts.push({
        id: `repeated_${trade.trader}_${now}`,
        type: 'repeated_trades',
        severity: 'warning',
        message: `Repeated similar trades detected: ${similarTrades.length} trades of ~${trade.solAmount.toFixed(2)} SOL`,
        data: {
          tradeCount: similarTrades.length,
          averageAmount: trade.solAmount,
          windowMs: 60000,
        },
        timestamp: now,
        launchPk: trade.launchPk,
        trader: trade.trader,
      });
    }

    return alerts;
  }

  // ---------------------------------------------------------------------------
  // Helper Methods
  // ---------------------------------------------------------------------------

  private createLaunchMetrics(): LaunchMetrics {
    return {
      recentTrades: [],
      priceHistory: [],
      volumeHistory: [],
      averageVolume: 0,
      traderActivity: new Map(),
    };
  }

  private updateVolumeHistory(metrics: LaunchMetrics, trade: TradeEvent): void {
    const now = Date.now();

    // Add volume data point every minute
    const lastEntry = metrics.volumeHistory[metrics.volumeHistory.length - 1];
    if (!lastEntry || now - lastEntry.timestamp >= 60000) {
      const windowStart = now - MONITORING_CONFIG.volumeWindow;
      const recentTrades = metrics.recentTrades.filter(t => t.timestamp > windowStart);
      const volume = recentTrades.reduce((sum, t) => sum + t.solAmount, 0);

      metrics.volumeHistory.push({ volume, timestamp: now });

      // Keep only last hour
      const oneHourAgo = now - 3600000;
      metrics.volumeHistory = metrics.volumeHistory.filter(v => v.timestamp > oneHourAgo);
    }
  }

  private shouldEmitAlert(alert: Alert): boolean {
    const cooldownKey = `${alert.type}_${alert.launchPk || 'global'}_${alert.trader || 'all'}`;
    const lastAlert = this.alertCooldowns.get(cooldownKey);

    if (lastAlert && Date.now() - lastAlert < MONITORING_CONFIG.alertCooldown) {
      return false;
    }

    this.alertCooldowns.set(cooldownKey, Date.now());
    return true;
  }

  private cleanup(): void {
    const now = Date.now();
    const maxAge = Math.max(
      MONITORING_CONFIG.volumeWindow,
      MONITORING_CONFIG.washTradingWindow,
      MONITORING_CONFIG.patternWindow
    ) * 2;

    // Clean up old trades and price data
    for (const [launchPk, metrics] of this.launchMetrics) {
      const cutoff = now - maxAge;

      metrics.recentTrades = metrics.recentTrades.filter(t => t.timestamp > cutoff);
      metrics.priceHistory = metrics.priceHistory.filter(p => p.timestamp > cutoff);

      // Clean up address activity
      for (const [trader, activity] of metrics.traderActivity) {
        activity.trades = activity.trades.filter(t => t.timestamp > cutoff);
        if (activity.trades.length === 0) {
          metrics.traderActivity.delete(trader);
        }
      }

      // Remove empty launches
      if (metrics.recentTrades.length === 0) {
        this.launchMetrics.delete(launchPk);
      }
    }

    // Clean up old alerts
    const alertCutoff = now - 3600000; // Keep 1 hour of alerts
    this.globalAlerts = this.globalAlerts.filter(a => a.timestamp > alertCutoff);

    // Clean up old cooldowns
    for (const [key, timestamp] of this.alertCooldowns) {
      if (now - timestamp > MONITORING_CONFIG.alertCooldown * 2) {
        this.alertCooldowns.delete(key);
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /**
   * Get recent alerts
   */
  getAlerts(options?: {
    launchPk?: string;
    trader?: string;
    type?: AlertType;
    severity?: 'info' | 'warning' | 'critical';
    limit?: number;
  }): Alert[] {
    let alerts = [...this.globalAlerts];

    if (options?.launchPk) {
      alerts = alerts.filter(a => a.launchPk === options.launchPk);
    }

    if (options?.trader) {
      alerts = alerts.filter(a => a.trader === options.trader);
    }

    if (options?.type) {
      alerts = alerts.filter(a => a.type === options.type);
    }

    if (options?.severity) {
      alerts = alerts.filter(a => a.severity === options.severity);
    }

    // Sort by timestamp descending
    alerts.sort((a, b) => b.timestamp - a.timestamp);

    if (options?.limit) {
      alerts = alerts.slice(0, options.limit);
    }

    return alerts;
  }

  /**
   * Get metrics for a specific launch
   */
  getLaunchMetrics(launchPk: string): {
    tradeCount: number;
    volume: number;
    uniqueTraders: number;
    priceChange: number;
    alerts: Alert[];
  } | null {
    const metrics = this.launchMetrics.get(launchPk);
    if (!metrics) return null;

    const now = Date.now();
    const windowStart = now - MONITORING_CONFIG.volumeWindow;
    const recentTrades = metrics.recentTrades.filter(t => t.timestamp > windowStart);

    const volume = recentTrades.reduce((sum, t) => sum + t.solAmount, 0);
    const uniqueTraders = new Set(recentTrades.map(t => t.trader)).size;

    let priceChange = 0;
    if (metrics.priceHistory.length >= 2) {
      const firstPrice = metrics.priceHistory[0].price;
      const lastPrice = metrics.priceHistory[metrics.priceHistory.length - 1].price;
      priceChange = (lastPrice - firstPrice) / firstPrice * 100;
    }

    return {
      tradeCount: recentTrades.length,
      volume,
      uniqueTraders,
      priceChange,
      alerts: this.getAlerts({ launchPk, limit: 10 }),
    };
  }

  /**
   * Get global monitoring stats
   */
  getStats(): {
    activeLaunches: number;
    totalAlerts: number;
    alertsBySeverity: Record<string, number>;
    alertsByType: Record<string, number>;
  } {
    const alertsBySeverity: Record<string, number> = { info: 0, warning: 0, critical: 0 };
    const alertsByType: Record<string, number> = {};

    for (const alert of this.globalAlerts) {
      alertsBySeverity[alert.severity]++;
      alertsByType[alert.type] = (alertsByType[alert.type] || 0) + 1;
    }

    return {
      activeLaunches: this.launchMetrics.size,
      totalAlerts: this.globalAlerts.length,
      alertsBySeverity,
      alertsByType,
    };
  }

  /**
   * Get configuration
   */
  getConfig(): typeof MONITORING_CONFIG {
    return { ...MONITORING_CONFIG };
  }
}

// ---------------------------------------------------------------------------
// SINGLETON INSTANCE
// ---------------------------------------------------------------------------

let monitoringService: MonitoringService | null = null;

export function initMonitoring(): MonitoringService {
  monitoringService = new MonitoringService();
  monitoringService.start();
  return monitoringService;
}

export function getMonitoring(): MonitoringService | null {
  return monitoringService;
}

export default MonitoringService;
