/**
 * TradeHistory Component
 *
 * Real-time trade feed for a launch. Connects via WebSocket and
 * falls back to REST API polling.  Uses the app's CSS variable
 * design system so it integrates with the glass-card aesthetic.
 */

import React, { useEffect, useState, useRef, useCallback } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Trade {
  signature: string;
  trader: string;
  type: 'buy' | 'sell';
  solAmount: number;
  tokenAmount: number;
  price: number;
  time: number;
}

interface TradeHistoryProps {
  launchId: string;
  /** Maximum trades to show */
  limit?: number;
  className?: string;
  style?: React.CSSProperties;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

function wsUrl(): string {
  if (process.env.REACT_APP_WS_URL) return process.env.REACT_APP_WS_URL;
  // Derive WS URL from API URL
  const url = new URL(API_URL);
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  url.pathname = '/ws';
  return url.toString();
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

function shortenAddress(addr: string): string {
  if (!addr || addr.length < 8) return addr;
  return `${addr.slice(0, 4)}...${addr.slice(-4)}`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const TradeHistory: React.FC<TradeHistoryProps> = ({
  launchId,
  limit = 30,
  className = '',
  style,
}) => {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch initial trades via REST
  useEffect(() => {
    let cancelled = false;

    async function fetchTrades() {
      try {
        const res = await fetch(`${API_URL}/api/chart/${launchId}/trades?limit=${limit}`);
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled && Array.isArray(data.trades)) {
          setTrades(data.trades);
        }
      } catch {
        // Supabase chart service may not be available – that's fine
      }
    }

    fetchTrades();
    return () => { cancelled = true; };
  }, [launchId, limit]);

  // WebSocket connection for real-time updates
  const connectWs = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    try {
      const ws = new WebSocket(wsUrl());
      wsRef.current = ws;

      ws.onopen = () => {
        setConnected(true);
        ws.send(JSON.stringify({ type: 'subscribe', channel: `chart:${launchId}` }));
      };

      ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(ev.data);
          if (msg.type === 'trade' || (msg.data && msg.type === 'update' && msg.data?.type === 'trade')) {
            const d = msg.data || msg;
            const newTrade: Trade = {
              signature: d.signature || '',
              trader: d.trader || '',
              type: d.swapType || d.type || 'buy',
              solAmount: d.solAmount || 0,
              tokenAmount: d.tokenAmount || 0,
              price: d.price || 0,
              time: d.time || Date.now(),
            };
            setTrades((prev) => [newTrade, ...prev].slice(0, limit));
          }
        } catch { /* ignore parse errors */ }
      };

      ws.onclose = () => {
        setConnected(false);
        wsRef.current = null;
        // Reconnect after 3 seconds
        reconnectRef.current = setTimeout(connectWs, 3000);
      };

      ws.onerror = () => {
        ws.close();
      };
    } catch {
      setConnected(false);
    }
  }, [launchId, limit]);

  useEffect(() => {
    connectWs();
    return () => {
      if (reconnectRef.current) clearTimeout(reconnectRef.current);
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [connectWs]);

  // Styles using app CSS variables
  const headerStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  };

  const dotStyle: React.CSSProperties = {
    width: 6,
    height: 6,
    borderRadius: '50%',
    background: connected ? 'var(--grn)' : 'var(--t3)',
    animation: connected ? 'pulse-glow 2s ease-in-out infinite' : 'none',
  };

  return (
    <div className={`glass-card ${className}`} style={{ padding: 'var(--space-5)', ...style }}>
      <div style={headerStyle}>
        <span style={{
          fontSize: 'var(--fs-sm)',
          fontWeight: 'var(--fw-semibold)',
          color: 'var(--t2)',
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-2)',
        }}>
          <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
            <polyline points="16 7 22 7 22 13" />
          </svg>
          Live Trades
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1-5)' }}>
          <div style={dotStyle} />
          <span style={{ fontSize: 'var(--fs-2xs)', color: 'var(--t3)' }}>
            {connected ? 'Live' : 'Connecting'}
          </span>
        </div>
      </div>

      <div style={{ maxHeight: 340, overflowY: 'auto' }}>
        {trades.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: 'var(--space-8) 0',
            color: 'var(--t3)',
            fontSize: 'var(--fs-sm)',
          }}>
            No trades yet
          </div>
        ) : (
          trades.map((trade, i) => (
            <div
              key={`${trade.signature}-${i}`}
              onClick={trade.signature ? () => window.open(`https://solscan.io/tx/${trade.signature}?cluster=devnet`, '_blank') : undefined}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '8px 0',
                borderBottom: i < trades.length - 1 ? '1px solid var(--glass-border)' : 'none',
                animation: i === 0 ? 'fu 0.3s ease-out' : undefined,
                cursor: trade.signature ? 'pointer' : undefined,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                <span style={{
                  fontSize: 'var(--fs-2xs)',
                  fontWeight: 'var(--fw-bold)',
                  padding: '2px 6px',
                  borderRadius: 'var(--radius-xs)',
                  background: trade.type === 'buy' ? 'var(--gb)' : 'var(--rb)',
                  color: trade.type === 'buy' ? 'var(--grn)' : 'var(--red)',
                  minWidth: 32,
                  textAlign: 'center',
                }}>
                  {trade.type === 'buy' ? 'BUY' : 'SELL'}
                </span>
                {trade.trader && (
                  <a
                    href={`https://solscan.io/account/${trade.trader}?cluster=devnet`}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    style={{
                      fontSize: 'var(--fs-xs)',
                      color: 'var(--t2)',
                      fontFamily: "'JetBrains Mono', monospace",
                      textDecoration: 'none',
                    }}
                    className="interactive-hover"
                  >
                    {shortenAddress(trade.trader)}
                  </a>
                )}
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{
                  fontSize: 'var(--fs-sm)',
                  fontFamily: "'JetBrains Mono', monospace",
                  fontWeight: 'var(--fw-medium)',
                  color: 'var(--t1)',
                }}>
                  {trade.solAmount.toFixed(4)} SOL
                </div>
                <div style={{
                  fontSize: 'var(--fs-2xs)',
                  color: 'var(--t3)',
                }}>
                  {formatTime(trade.time)}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default TradeHistory;
