/**
 * Launchr - Main Application
 *
 * Launch into Orbit
 * Bonding curve token launches that graduate into Orbit Finance DLMM liquidity.
 *
 * Set REACT_APP_USE_MOCKS=true in .env to test with fake data (no wallet needed).
 *
 * Built by CipherLabs
 */

import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react';

import {
  useWallet as useRealWallet,
  useLaunches as useRealLaunches,
  useLaunch as useRealLaunch,
  useUserPosition as useRealUserPosition,
  useTrade as useRealTrade,
  useCreateLaunch as useRealCreateLaunch,
  useGlobalStats as useRealGlobalStats,
  useSolPrice,
  useAvailableWallets,
  useMultipleTokenMetadata,
  useUserBalances,
  useLaunchHolders,
  useLaunchChart,
  useUserPositions,
  useUserActivity,
  useUserStats,
  useOnlineStatus,
  WalletType,
} from './hooks';

import { WalletSelector, PriceChart, OfflineIndicator } from './components/molecules';
import { api, wsClient, NormalizedMessage } from './services/api';

import {
  useMockWallet,
  useMockLaunches,
  useMockLaunch,
  useMockUserPosition,
  useMockTrade,
  useMockCreateLaunch,
  useMockGlobalStats,
} from './mocks/hooks';

// ---------------------------------------------------------------------------
// MODE SWITCH
// ---------------------------------------------------------------------------

// Enable mocks if:
// 1. Explicitly set via env var
// Mock mode requires explicit opt-in via environment variable
const USE_MOCKS = process.env.REACT_APP_USE_MOCKS === 'true';

// ---------------------------------------------------------------------------
// CONSTANTS
// ---------------------------------------------------------------------------

const GRADS = [
  ["#f97316","#ea580c"],["#8b5cf6","#7c3aed"],["#06b6d4","#0891b2"],
  ["#ec4899","#db2777"],["#22C55E","#16A34A"],["#f59e0b","#d97706"],
  ["#6366f1","#4f46e5"],["#ef4444","#dc2626"],["#34D399","#16A34A"],["#a855f7","#9333ea"],
];

// SVG icon patterns for avatars (replacing emojis)
const AVATAR_ICONS = [
  // Cat
  (s: number) => <svg width={s} height={s} viewBox="0 0 24 24" fill="white" opacity={0.9}><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-3-9.5c.83 0 1.5-.67 1.5-1.5S9.83 7.5 9 7.5 7.5 8.17 7.5 9 8.17 10.5 9 10.5zm6 0c.83 0 1.5-.67 1.5-1.5S15.83 7.5 15 7.5 13.5 8.17 13.5 9s.67 1.5 1.5 1.5zm-3 6c2.33 0 4.31-1.46 5.11-3.5H6.89c.8 2.04 2.78 3.5 5.11 3.5z"/></svg>,
  // Star
  (s: number) => <svg width={s} height={s} viewBox="0 0 24 24" fill="white" opacity={0.9}><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg>,
  // Diamond
  (s: number) => <svg width={s} height={s} viewBox="0 0 24 24" fill="white" opacity={0.9}><path d="M19 3H5L2 9l10 12L22 9l-3-6zm-7 15.18L5.14 9h13.72L12 18.18z"/></svg>,
  // Lightning
  (s: number) => <svg width={s} height={s} viewBox="0 0 24 24" fill="white" opacity={0.9}><path d="M7 2v11h3v9l7-12h-4l4-8z"/></svg>,
  // Rocket
  (s: number) => <svg width={s} height={s} viewBox="0 0 24 24" fill="white" opacity={0.9}><path d="M12 2.5c-3.45 3.45-3 9.5-3 9.5s2-1 4-1 4 1 4 1-.45-6.05-3-9.5c-.42-.42-.58-.5-1-.5s-.58.08-1 .5zM9.5 21.5c.28.28.72.28 1 0l.5-.5.5.5c.28.28.72.28 1 0l.5-.5.5.5c.28.28.72.28 1 0L16 20l-4-4-4 4 1.5 1.5z"/><circle cx="12" cy="8" r="1.5"/></svg>,
  // Crown
  (s: number) => <svg width={s} height={s} viewBox="0 0 24 24" fill="white" opacity={0.9}><path d="M5 16L3 5l5.5 5L12 4l3.5 6L21 5l-2 11H5zm14 3c0 .55-.45 1-1 1H6c-.55 0-1-.45-1-1v-1h14v1z"/></svg>,
  // Fire
  (s: number) => <svg width={s} height={s} viewBox="0 0 24 24" fill="white" opacity={0.9}><path d="M12 23c-4.97 0-9-4.03-9-9 0-4.14 2.77-6.41 4.5-8.5.72-.87 1.05-1.5 1.05-1.5s.14.47.5 1.5c.36 1.03 1.5 2.5 1.5 2.5s2-2.5 2-5C12.55 2 11 1 11 1s3-1 6 3c2 2.67 2 6.5 2 6.5s0 3.5-1.5 5.5C16 18 12 23 12 23zm0-2c2.5 0 5-3 5-7s-2-4-2-4-1 1-1 3c0 2-2 4-4 4s-4-2-4-5c0-2 1-4 2-5-1 1-2 3-2 5 0 3 2.5 9 6 9z"/></svg>,
  // Shield
  (s: number) => <svg width={s} height={s} viewBox="0 0 24 24" fill="white" opacity={0.9}><path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 6c1.1 0 2 .9 2 2s-.9 2-2 2-2-.9-2-2 .9-2 2-2zm4 9H8v-1c0-1.33 2.67-2 4-2s4 .67 4 2v1z"/></svg>,
  // Cube
  (s: number) => <svg width={s} height={s} viewBox="0 0 24 24" fill="white" opacity={0.9}><path d="M21 16.5c0 .38-.21.71-.53.88l-7.9 4.44c-.36.2-.8.2-1.14 0l-7.9-4.44A.99.99 0 0 1 3 16.5v-9c0-.38.21-.71.53-.88l7.9-4.44c.36-.2.8-.2 1.14 0l7.9 4.44c.32.17.53.5.53.88v9zM12 4.15L5 8.09v7.82l7 3.94 7-3.94V8.09l-7-3.94z"/></svg>,
  // Bolt
  (s: number) => <svg width={s} height={s} viewBox="0 0 24 24" fill="white" opacity={0.9}><path d="M11 21h-1l1-7H7.5c-.58 0-.57-.32-.38-.66.19-.34.05-.08.07-.12C8.48 10.94 10.42 7.54 13 3h1l-1 7h3.5c.49 0 .56.33.47.51l-.07.15C12.96 17.55 11 21 11 21z"/></svg>,
];

// ---------------------------------------------------------------------------
// HELPER FUNCTIONS
// ---------------------------------------------------------------------------

// Format market cap with $ prefix
const fm = (n: number): string => {
  if (n >= 1e9) return "$" + (n/1e9).toFixed(2) + "B";
  if (n >= 1e6) return "$" + (n/1e6).toFixed(2) + "M";
  if (n >= 1e3) return "$" + (n/1e3).toFixed(1) + "K";
  return "$" + n.toFixed(2);
};

// Format price with adaptive precision
const fP = (p: number): string => {
  if (p < 0.0001) return p.toExponential(2);
  if (p < 0.01) return p.toFixed(6);
  if (p < 1) return p.toFixed(4);
  return p.toFixed(2);
};

// Format number with thousands separator
const fN = (n: number, decimals: number = 0): string => {
  return n.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });
};

// Format SOL value
const fSOL = (n: number, showSymbol: boolean = true): string => {
  const formatted = n < 0.01 ? n.toFixed(6) : n < 1 ? n.toFixed(4) : n.toFixed(2);
  return showSymbol ? `${formatted} SOL` : formatted;
};

// Format percentage with sign
const fPct = (n: number, showSign: boolean = true): string => {
  const sign = showSign && n > 0 ? '+' : '';
  return `${sign}${n.toFixed(1)}%`;
};

const s = (base: React.CSSProperties, extra?: React.CSSProperties): React.CSSProperties => {
  return { ...base, ...extra };
};

const ani = (type: string, delay?: number): React.CSSProperties => {
  return {
    animation: `${type === "si" ? "si" : "fu"} 0.5s cubic-bezier(0.16,1,0.3,1) both`,
    animationDelay: `${delay || 0}s`
  };
};

// ---------------------------------------------------------------------------
// COMPONENTS
// ---------------------------------------------------------------------------

interface AvatarProps {
  gi: number;
  size?: number;
  imageUrl?: string;
  symbol?: string;
}

const Avatar: React.FC<AvatarProps> = ({ gi, size = 36, imageUrl, symbol }) => {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const g = GRADS[gi % GRADS.length];
  const iconFn = AVATAR_ICONS[gi % AVATAR_ICONS.length];
  const iconSize = Math.round(size * 0.5);
  const borderRadius = size * 0.35;

  // Show gradient fallback if no image or image failed to load
  const showFallback = !imageUrl || imageError || !imageLoaded;

  return (
    <div style={{
      width: size,
      height: size,
      borderRadius,
      position: "relative",
      flexShrink: 0,
      overflow: "hidden",
    }}>
      {/* Gradient fallback (always rendered for smooth transition) */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          borderRadius,
          background: `linear-gradient(135deg, ${g[0]}, ${g[1]})`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: `0 4px 18px ${g[0]}40`,
          opacity: showFallback ? 1 : 0,
          transition: "opacity 0.3s ease",
        }}
      >
        {iconFn(iconSize)}
      </div>

      {/* Metaplex image (with reveal animation) */}
      {imageUrl && !imageError && (
        <img
          src={imageUrl}
          alt={symbol || "Token"}
          onLoad={() => setImageLoaded(true)}
          onError={() => setImageError(true)}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            borderRadius,
            opacity: imageLoaded ? 1 : 0,
            transform: imageLoaded ? "scale(1)" : "scale(0.95)",
            transition: "opacity 0.3s ease, transform 0.3s ease",
            boxShadow: `0 4px 18px ${g[0]}30`,
          }}
        />
      )}
    </div>
  );
};

// User profile avatar with initials
const UserAvatar: React.FC<{ address?: string; size?: number; gradient?: string }> = ({ address, size = 84, gradient }) => {
  const initials = address ? address.slice(0, 2).toUpperCase() : 'U';
  const bg = gradient || "linear-gradient(135deg, #6366f1, #8b5cf6)";
  return (
    <div style={{
      width: size, height: size, borderRadius: size * 0.26,
      background: bg,
      display: "flex", alignItems: "center", justifyContent: "center",
      boxShadow: "0 12px 40px rgba(99, 102, 241, 0.35)",
      position: "relative",
      border: "4px solid var(--bg-card)"
    }}>
      <svg width={size * 0.45} height={size * 0.45} viewBox="0 0 24 24" fill="white" opacity={0.9}>
        <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
      </svg>
    </div>
  );
};

// Empty state icons
const EmptyStateIcon: React.FC<{ type: 'inbox' | 'rocket' | 'chart' | 'activity' | 'star' | 'search' | 'users' | 'wallet' | 'target' | 'trophy' | 'settings' | 'trending'; size?: number }> = ({ type, size = 64 }) => {
  const icons = {
    inbox: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
        <polyline points="22,12 16,12 14,15 10,15 8,12 2,12"/>
        <path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>
      </svg>
    ),
    rocket: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
        <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/>
        <path d="M12 15l-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/>
        <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"/>
        <path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/>
      </svg>
    ),
    chart: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
        <line x1="12" y1="20" x2="12" y2="10"/>
        <line x1="18" y1="20" x2="18" y2="4"/>
        <line x1="6" y1="20" x2="6" y2="16"/>
      </svg>
    ),
    activity: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
      </svg>
    ),
    star: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
      </svg>
    ),
    search: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
        <circle cx="11" cy="11" r="8"/>
        <line x1="21" y1="21" x2="16.65" y2="16.65"/>
      </svg>
    ),
    users: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
        <circle cx="9" cy="7" r="4"/>
        <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
        <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
      </svg>
    ),
    wallet: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/>
        <path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/>
        <path d="M18 12a2 2 0 0 0 0 4h4v-4h-4z"/>
      </svg>
    ),
    target: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"/>
        <circle cx="12" cy="12" r="6"/>
        <circle cx="12" cy="12" r="2"/>
      </svg>
    ),
    trophy: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/>
        <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/>
        <path d="M4 22h16"/>
        <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/>
        <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/>
        <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/>
      </svg>
    ),
    settings: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3"/>
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
      </svg>
    ),
    trending: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
        <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/>
        <polyline points="17 6 23 6 23 12"/>
      </svg>
    )
  };
  return (
    <div style={{ color: "var(--t3)", opacity: 0.5 }}>
      {icons[type]}
    </div>
  );
};

// Buy/Sell indicator icons
const TradeIcon: React.FC<{ type: 'buy' | 'sell'; size?: number }> = ({ type, size = 40 }) => {
  const isBuy = type === 'buy';
  return (
    <div style={{
      width: size,
      height: size,
      borderRadius: "var(--radius-md)",
      background: isBuy ? "var(--gb)" : "var(--rb)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center"
    }}>
      <svg width={size * 0.5} height={size * 0.5} viewBox="0 0 24 24" fill="none" stroke={isBuy ? "var(--grn)" : "var(--red)"} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
        {isBuy ? (
          <polyline points="18 15 12 9 6 15"/>
        ) : (
          <polyline points="6 9 12 15 18 9"/>
        )}
      </svg>
    </div>
  );
};

// Stat icons for profile and leaderboard
const StatIcon: React.FC<{ type: 'wallet' | 'trending-up' | 'trending-down' | 'percent' | 'layers' | 'users' | 'target' | 'trophy' | 'chart' | 'settings' | 'trading' | 'code'; size?: number; color?: string }> = ({ type, size = 14, color = "currentColor" }) => {
  const icons: Record<string, React.ReactNode> = {
    wallet: <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4M3 5v14a2 2 0 0 0 2 2h16v-5M18 12a2 2 0 0 0 0 4h4v-4h-4z"/>,
    'trending-up': <><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></>,
    'trending-down': <><polyline points="23 18 13.5 8.5 8.5 13.5 1 6"/><polyline points="17 18 23 18 23 12"/></>,
    percent: <><line x1="19" y1="5" x2="5" y2="19"/><circle cx="6.5" cy="6.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/></>,
    layers: <><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></>,
    users: <><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></>,
    target: <><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></>,
    trophy: <><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></>,
    chart: <><line x1="12" y1="20" x2="12" y2="10"/><line x1="18" y1="20" x2="18" y2="4"/><line x1="6" y1="20" x2="6" y2="16"/></>,
    settings: <><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></>,
    trading: <><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></>,
    code: <><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></>
  };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      {icons[type]}
    </svg>
  );
};

const SvgSun: React.FC = () => (
  <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
    <circle cx={12} cy={12} r={5} />
    <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
  </svg>
);

const SvgMoon: React.FC = () => (
  <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
  </svg>
);

const SvgBack: React.FC = () => (
  <svg width={17} height={17} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
    <path d="M19 12H5M12 19l-7-7 7-7" />
  </svg>
);

const SvgUp: React.FC = () => (
  <svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round">
    <path d="M12 19V5M5 12l7-7 7 7" />
  </svg>
);

const SvgDn: React.FC = () => (
  <svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round">
    <path d="M12 5v14M19 12l-7 7-7-7" />
  </svg>
);

const SvgPlus: React.FC = () => (
  <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
    <path d="M12 5v14M5 12h14" />
  </svg>
);

interface SvgLogoProps {
  size?: number;
  variant?: 'mark' | 'badge';
}

// Launchr Brand Logo - L-bracket with launch dot
const SvgLogo: React.FC<SvgLogoProps> = ({ size = 14, variant = 'mark' }) => {
  if (variant === 'badge') {
    // Full badge variant with gradient background
    return (
      <svg width={size} height={size} viewBox="0 0 120 120" fill="none">
        <defs>
          <linearGradient id="launchr-grad" x1="0" y1="0" x2="120" y2="120" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#34D399"/>
            <stop offset="100%" stopColor="#16A34A"/>
          </linearGradient>
        </defs>
        <rect width="120" height="120" rx="26" fill="url(#launchr-grad)"/>
        <path d="M32 34 L32 88 L86 88" stroke="white" strokeWidth="12" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
        <circle cx="82" cy="38" r="8" fill="white"/>
      </svg>
    );
  }
  // Simple mark variant (white on transparent)
  return (
    <svg width={size} height={size} viewBox="0 0 120 120" fill="none">
      <path d="M32 34 L32 88 L86 88" stroke="currentColor" strokeWidth="12" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
      <circle cx="82" cy="38" r="8" fill="currentColor"/>
    </svg>
  );
};

const SvgSwap: React.FC = () => (
  <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
    <path d="M7 16V4m0 0L3 8m4-4l4 4M17 8v12m0 0l4-4m-4 4l-4-4" />
  </svg>
);

const SvgTg: React.FC = () => (
  <svg width={14} height={14} viewBox="0 0 24 24" fill="currentColor">
    <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0h-.056zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.479.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
  </svg>
);

const SvgTw: React.FC = () => (
  <svg width={14} height={14} viewBox="0 0 24 24" fill="currentColor">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
);

const SvgImg: React.FC = () => (
  <svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
    <rect x={3} y={3} width={18} height={18} rx={2} ry={2} />
    <circle cx={8.5} cy={8.5} r={1.5} />
    <path d="M21 15l-5-5L5 21" />
  </svg>
);

const SvgUser: React.FC = () => (
  <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
    <circle cx={12} cy={7} r={4} />
  </svg>
);

const SvgCopy: React.FC = () => (
  <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <rect x={9} y={9} width={13} height={13} rx={2} ry={2} />
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </svg>
);

const SvgCheck: React.FC = () => (
  <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const SvgWallet: React.FC = () => (
  <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" />
    <path d="M3 5v14a2 2 0 0 0 2 2h16v-5" />
    <path d="M18 12a2 2 0 0 0 0 4h4v-4Z" />
  </svg>
);

const SvgActivity: React.FC = () => (
  <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
  </svg>
);

const SvgLogout: React.FC = () => (
  <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <polyline points="16 17 21 12 16 7" />
    <line x1={21} y1={12} x2={9} y2={12} />
  </svg>
);

const SvgStar: React.FC<{ filled?: boolean }> = ({ filled }) => (
  <svg width={14} height={14} viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
  </svg>
);

const SvgFilter: React.FC = () => (
  <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
  </svg>
);

const SvgSettings: React.FC = () => (
  <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <circle cx={12} cy={12} r={3} />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </svg>
);

const SvgTrophy: React.FC = () => (
  <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
    <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
    <path d="M4 22h16" />
    <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
    <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
    <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
  </svg>
);

const SvgShare: React.FC = () => (
  <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <circle cx={18} cy={5} r={3} />
    <circle cx={6} cy={12} r={3} />
    <circle cx={18} cy={19} r={3} />
    <line x1={8.59} y1={13.51} x2={15.42} y2={17.49} />
    <line x1={15.41} y1={6.51} x2={8.59} y2={10.49} />
  </svg>
);

const SvgExternal: React.FC = () => (
  <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
    <polyline points="15 3 21 3 21 9" />
    <line x1={10} y1={14} x2={21} y2={3} />
  </svg>
);

const SvgX: React.FC = () => (
  <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <line x1={18} y1={6} x2={6} y2={18} />
    <line x1={6} y1={6} x2={18} y2={18} />
  </svg>
);

const SvgChart: React.FC = () => (
  <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <line x1={18} y1={20} x2={18} y2={10} />
    <line x1={12} y1={20} x2={12} y2={4} />
    <line x1={6} y1={20} x2={6} y2={14} />
  </svg>
);

const SvgRefresh: React.FC<{ spinning?: boolean }> = ({ spinning }) => (
  <svg
    width={14}
    height={14}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    style={spinning ? { animation: 'spin-slow 1s linear infinite' } : undefined}
  >
    <path d="M23 4v6h-6M1 20v-6h6" />
    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
  </svg>
);

const SvgInfo: React.FC = () => (
  <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <circle cx={12} cy={12} r={10} />
    <line x1={12} y1={16} x2={12} y2={12} />
    <line x1={12} y1={8} x2={12.01} y2={8} />
  </svg>
);

const SvgFire: React.FC = () => (
  <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
  </svg>
);

const SvgZap: React.FC = () => (
  <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
  </svg>
);

// ---------------------------------------------------------------------------
// TOOLTIP COMPONENT
// ---------------------------------------------------------------------------

interface TooltipProps {
  content: string;
  children: React.ReactNode;
  position?: 'top' | 'bottom' | 'left' | 'right';
}

const Tooltip: React.FC<TooltipProps> = ({ content, children, position = 'top' }) => {
  const [show, setShow] = useState(false);
  const [visible, setVisible] = useState(false);
  const triggerRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const positionStyles: Record<string, React.CSSProperties> = {
    top: { bottom: '100%', left: '50%', transform: 'translateX(-50%) translateY(-8px)' },
    bottom: { top: '100%', left: '50%', transform: 'translateX(-50%) translateY(8px)' },
    left: { right: '100%', top: '50%', transform: 'translateX(-8px) translateY(-50%)' },
    right: { left: '100%', top: '50%', transform: 'translateX(8px) translateY(-50%)' },
  };

  const handleMouseEnter = () => {
    timerRef.current = setTimeout(() => {
      setShow(true);
      requestAnimationFrame(() => setVisible(true));
    }, 200); // Small delay for intentional hovering
  };

  const handleMouseLeave = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setVisible(false);
    setTimeout(() => setShow(false), 150);
  };

  return (
    <div
      ref={triggerRef}
      style={{ position: 'relative', display: 'inline-flex' }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {children}
      {show && (
        <div
          style={{
            position: 'absolute',
            ...positionStyles[position],
            padding: '6px 12px',
            borderRadius: "var(--radius-sm)",
            background: 'var(--bg-elevated)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            border: '1px solid var(--glass-border2)',
            color: 'var(--t1)',
            fontSize: "var(--fs-xs)",
            fontWeight: "var(--fw-medium)",
            whiteSpace: 'nowrap',
            zIndex: 200,
            pointerEvents: 'none',
            boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
            opacity: visible ? 1 : 0,
            transform: visible
              ? positionStyles[position].transform
              : `${positionStyles[position].transform} scale(0.95)`,
            transition: 'opacity 0.15s ease, transform 0.15s ease',
          }}
        >
          {content}
        </div>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// RIPPLE EFFECT COMPONENT
// ---------------------------------------------------------------------------

interface RippleButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
}

const RippleButton: React.FC<RippleButtonProps> = ({ children, onClick, style, className, ...props }) => {
  const [ripples, setRipples] = useState<{ x: number; y: number; id: number }[]>([]);

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const id = Date.now();
    setRipples(prev => [...prev, { x, y, id }]);
    setTimeout(() => setRipples(prev => prev.filter(r => r.id !== id)), 600);
    onClick?.(e);
  };

  return (
    <button
      onClick={handleClick}
      style={{ ...style, position: 'relative', overflow: 'hidden' }}
      className={className}
      {...props}
    >
      {children}
      {ripples.map(ripple => (
        <span
          key={ripple.id}
          className="ripple-effect"
          style={{
            position: 'absolute',
            left: ripple.x,
            top: ripple.y,
            transform: 'translate(-50%, -50%)',
            width: 10,
            height: 10,
            borderRadius: '50%',
            background: 'rgba(255,255,255,0.3)',
            pointerEvents: 'none',
          }}
        />
      ))}
    </button>
  );
};

// ---------------------------------------------------------------------------
// GRADIENT PROGRESS BAR
// ---------------------------------------------------------------------------

interface GradientProgressProps {
  value: number;
  showGlow?: boolean;
  height?: number;
  animated?: boolean;
}

const GradientProgress: React.FC<GradientProgressProps> = ({
  value,
  showGlow = true,
  height = 6,
  animated = true
}) => {
  const clampedValue = Math.min(Math.max(value, 0), 100);
  const isNearComplete = clampedValue >= 90;

  return (
    <div style={{
      width: '100%',
      height,
      borderRadius: height / 2,
      background: 'var(--glass2)',
      overflow: 'hidden',
      position: 'relative'
    }}>
      <div
        className={animated ? 'progress-animate' : ''}
        style={{
          width: `${clampedValue}%`,
          height: '100%',
          borderRadius: height / 2,
          background: isNearComplete
            ? 'linear-gradient(90deg, #fbbf24, #f59e0b)'
            : 'linear-gradient(90deg, #34d399, #22C55E, #16A34A)',
          position: 'relative',
          transition: 'width 0.6s var(--ease-out-expo)',
        }}
      >
        {/* Animated shine effect */}
        <div
          className="progress-shine"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent)',
            animation: 'progress-shine 2s ease-in-out infinite',
          }}
        />
      </div>
      {/* Glow effect */}
      {showGlow && clampedValue > 0 && (
        <div style={{
          position: 'absolute',
          top: -2,
          left: 0,
          width: `${clampedValue}%`,
          height: height + 4,
          borderRadius: height,
          background: isNearComplete
            ? 'rgba(251, 191, 36, 0.3)'
            : 'rgba(34, 197, 94, 0.3)',
          filter: 'blur(4px)',
          pointerEvents: 'none',
        }} />
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// PULSE DOT FOR LIVE INDICATORS
// ---------------------------------------------------------------------------

interface PulseDotProps {
  color?: string;
  size?: number;
}

const PulseDot: React.FC<PulseDotProps> = ({ color = 'var(--grn)', size = 8 }) => (
  <span style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
    <span
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: color,
        position: 'relative',
        zIndex: 1,
      }}
    />
    <span
      className="pulse-ring-anim"
      style={{
        position: 'absolute',
        width: size * 2,
        height: size * 2,
        borderRadius: '50%',
        border: `2px solid ${color}`,
        opacity: 0.5,
      }}
    />
  </span>
);

// ---------------------------------------------------------------------------
// HOVER CARD WRAPPER
// ---------------------------------------------------------------------------

interface HoverCardProps {
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
  style?: React.CSSProperties;
  glowColor?: string;
}

const HoverCard: React.FC<HoverCardProps> = ({
  children,
  onClick,
  className = '',
  style = {},
  glowColor
}) => {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`${className} hover-card-interactive`}
      style={{
        ...style,
        cursor: onClick ? 'pointer' : 'default',
        transform: isHovered ? 'translateY(-3px) scale(1.005)' : 'translateY(0) scale(1)',
        transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
        boxShadow: isHovered && glowColor
          ? `0 12px 40px ${glowColor}, 0 0 0 1px rgba(34, 197, 94, 0.1)`
          : isHovered
            ? '0 12px 40px rgba(0,0,0,0.15)'
            : undefined,
        borderColor: isHovered ? 'rgba(34, 197, 94, 0.15)' : undefined,
      }}
    >
      {children}
    </div>
  );
};

// ---------------------------------------------------------------------------
// TAB TRANSITION WRAPPER
// ---------------------------------------------------------------------------

interface TabContentProps {
  children: React.ReactNode;
  tabKey: string;
}

const TabContent: React.FC<TabContentProps> = ({ children, tabKey }) => (
  <div key={tabKey} className="tab-content-enter" style={{ width: '100%' }}>
    {children}
  </div>
);

// ---------------------------------------------------------------------------
// STAT CARD WITH TREND INDICATOR
// ---------------------------------------------------------------------------

interface StatCardProps {
  label: string;
  value: string | number;
  trend?: number;
  prefix?: string;
  suffix?: string;
  icon?: React.ReactNode;
  animated?: boolean;
}

const StatCard: React.FC<StatCardProps> = ({
  label,
  value,
  trend,
  prefix = '',
  suffix = '',
  icon,
  animated = true
}) => {
  const numericValue = typeof value === 'number' ? value : parseFloat(value.replace(/[^0-9.-]/g, ''));

  return (
    <div className="glass-card-inner card-lift stat-card" style={{ padding: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <span style={{ fontSize: "var(--fs-xs)", color: 'var(--t3)', fontWeight: "var(--fw-medium)" }}>{label}</span>
        {icon && <span style={{ color: 'var(--t3)' }}>{icon}</span>}
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: "var(--space-2)" }}>
        <span style={{ fontSize: "var(--fs-2xl)", fontWeight: "var(--fw-bold)", color: 'var(--t1)' }}>
          {animated && !isNaN(numericValue) ? (
            <AnimatedNumber value={numericValue} prefix={prefix} suffix={suffix} decimals={numericValue % 1 !== 0 ? 2 : 0} />
          ) : (
            `${prefix}${value}${suffix}`
          )}
        </span>
        {trend !== undefined && (
          <span style={{
            display: 'flex',
            alignItems: 'center',
            gap: 2,
            fontSize: "var(--fs-sm)",
            fontWeight: "var(--fw-medium)",
            color: trend >= 0 ? 'var(--grn)' : 'var(--red)'
          }}>
            {trend >= 0 ? <SvgUp /> : <SvgDn />}
            {Math.abs(trend).toFixed(1)}%
          </span>
        )}
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// CONFETTI CELEBRATION COMPONENT
// ---------------------------------------------------------------------------

interface ConfettiProps {
  active: boolean;
  onComplete?: () => void;
}

const Confetti: React.FC<ConfettiProps> = ({ active, onComplete }) => {
  const [particles, setParticles] = useState<{ id: number; x: number; color: string; delay: number; rotation: number }[]>([]);

  useEffect(() => {
    if (active) {
      const colors = ['#34d399', '#fbbf24', '#f472b6', '#60a5fa', '#a78bfa', '#fb7185'];
      const newParticles = Array.from({ length: 50 }, (_, i) => ({
        id: i,
        x: Math.random() * 100,
        color: colors[Math.floor(Math.random() * colors.length)],
        delay: Math.random() * 0.5,
        rotation: Math.random() * 360,
      }));
      setParticles(newParticles);
      setTimeout(() => {
        setParticles([]);
        onComplete?.();
      }, 3000);
    }
  }, [active, onComplete]);

  if (!active || particles.length === 0) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      pointerEvents: 'none',
      zIndex: 9999,
      overflow: 'hidden',
    }}>
      {particles.map((p) => (
        <div
          key={p.id}
          className="confetti-particle"
          style={{
            position: 'absolute',
            left: `${p.x}%`,
            top: -20,
            width: 10,
            height: 10,
            background: p.color,
            borderRadius: Math.random() > 0.5 ? '50%' : '2px',
            transform: `rotate(${p.rotation}deg)`,
            animation: `confetti-fall 3s ease-out ${p.delay}s forwards`,
          }}
        />
      ))}
    </div>
  );
};

// ---------------------------------------------------------------------------
// CONNECTION STATUS INDICATOR
// ---------------------------------------------------------------------------

interface ConnectionStatusProps {
  status: 'connected' | 'connecting' | 'disconnected';
  network?: string;
}

const ConnectionStatus: React.FC<ConnectionStatusProps> = ({ status, network = 'Devnet' }) => {
  const config = {
    connected: { color: 'var(--grn)', label: 'Connected' },
    connecting: { color: 'var(--amb)', label: 'Connecting' },
    disconnected: { color: 'var(--red)', label: 'Disconnected' },
  }[status];

  const StatusIcon = () => {
    if (status === 'connected') {
      return (
        <svg width={8} height={8} viewBox="0 0 8 8">
          <circle cx={4} cy={4} r={4} fill={config.color} />
        </svg>
      );
    }
    if (status === 'connecting') {
      return (
        <svg width={8} height={8} viewBox="0 0 8 8" className="rotate-slow">
          <circle cx={4} cy={4} r={3} fill="none" stroke={config.color} strokeWidth={2} strokeDasharray="4 4" />
        </svg>
      );
    }
    return (
      <svg width={8} height={8} viewBox="0 0 8 8">
        <circle cx={4} cy={4} r={3} fill="none" stroke={config.color} strokeWidth={1.5} />
      </svg>
    );
  };

  return (
    <Tooltip content={`${config.label} to ${network}`}>
      <div
        className="connection-status"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: "var(--space-1-5)",
          padding: '4px 10px',
          borderRadius: "var(--radius-full)",
          background: 'var(--glass2)',
          border: '1px solid var(--glass-border)',
          fontSize: "var(--fs-xs)",
          fontWeight: "var(--fw-medium)",
          color: 'var(--t2)',
          cursor: 'default',
        }}
      >
        <StatusIcon />
        <span>{network}</span>
      </div>
    </Tooltip>
  );
};

// ---------------------------------------------------------------------------
// ANIMATED COUNT BADGE
// ---------------------------------------------------------------------------

interface CountBadgeProps {
  count: number;
  max?: number;
  color?: string;
}

const CountBadge: React.FC<CountBadgeProps> = ({ count, max = 99, color = 'var(--red)' }) => {
  const [prevCount, setPrevCount] = useState(count);
  const [animating, setAnimating] = useState(false);

  useEffect(() => {
    if (count !== prevCount) {
      setAnimating(true);
      const timer = setTimeout(() => {
        setAnimating(false);
        setPrevCount(count);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [count, prevCount]);

  if (count === 0) return null;

  const displayCount = count > max ? `${max}+` : count.toString();

  return (
    <span
      className={animating ? 'badge-bounce' : ''}
      style={{
        minWidth: 18,
        height: 18,
        padding: '0 5px',
        borderRadius: "var(--radius-full)",
        background: color,
        color: '#fff',
        fontSize: "var(--fs-2xs)",
        fontWeight: "var(--fw-bold)",
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {displayCount}
    </span>
  );
};

// ---------------------------------------------------------------------------
// KEYBOARD SHORTCUT HINT
// ---------------------------------------------------------------------------

interface KeyboardHintProps {
  keys: string[];
  label?: string;
}

const KeyboardHint: React.FC<KeyboardHintProps> = ({ keys, label }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: "var(--space-1-5)" }}>
    {label && <span style={{ fontSize: "var(--fs-xs)", color: 'var(--t3)' }}>{label}</span>}
    <div style={{ display: 'flex', gap: 3 }}>
      {keys.map((key, i) => (
        <React.Fragment key={key}>
          <kbd style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            minWidth: 22,
            height: 22,
            padding: '0 6px',
            borderRadius: "var(--radius-xs)",
            background: 'var(--glass2)',
            border: '1px solid var(--glass-border)',
            boxShadow: '0 2px 0 var(--glass-border)',
            fontSize: "var(--fs-2xs)",
            fontWeight: "var(--fw-semibold)",
            color: 'var(--t2)',
            fontFamily: 'inherit',
          }}>
            {key}
          </kbd>
          {i < keys.length - 1 && <span style={{ fontSize: "var(--fs-2xs)", color: 'var(--t3)' }}>+</span>}
        </React.Fragment>
      ))}
    </div>
  </div>
);

// ---------------------------------------------------------------------------
// ANIMATED CHART PATH
// ---------------------------------------------------------------------------

interface AnimatedChartProps {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
  fillGradient?: boolean;
}

const AnimatedChart: React.FC<AnimatedChartProps> = ({
  data,
  width = 400,
  height = 160,
  color = 'var(--grn)',
  fillGradient = true,
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const chartRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.3 }
    );

    if (chartRef.current) {
      observer.observe(chartRef.current);
    }

    return () => observer.disconnect();
  }, []);

  if (data.length < 2) return null;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const padding = 10;

  const points = data.map((v, i) => {
    const x = padding + (i / (data.length - 1)) * (width - padding * 2);
    const y = padding + (1 - (v - min) / range) * (height - padding * 2);
    return { x, y };
  });

  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x},${p.y}`).join(' ');
  const areaD = `${pathD} L ${width - padding},${height - padding} L ${padding},${height - padding} Z`;

  const pathLength = points.reduce((acc, p, i) => {
    if (i === 0) return 0;
    const prev = points[i - 1];
    return acc + Math.sqrt(Math.pow(p.x - prev.x, 2) + Math.pow(p.y - prev.y, 2));
  }, 0);

  return (
    <svg ref={chartRef} width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
      <defs>
        <linearGradient id="chartFillGradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
        <linearGradient id="chartLineGradient" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor={color} stopOpacity="0.5" />
          <stop offset="50%" stopColor={color} stopOpacity="1" />
          <stop offset="100%" stopColor={color} stopOpacity="0.8" />
        </linearGradient>
      </defs>
      {fillGradient && (
        <path
          d={areaD}
          fill="url(#chartFillGradient)"
          style={{
            opacity: isVisible ? 1 : 0,
            transition: 'opacity 0.5s ease-out 0.3s',
          }}
        />
      )}
      <path
        d={pathD}
        fill="none"
        stroke="url(#chartLineGradient)"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{
          strokeDasharray: pathLength,
          strokeDashoffset: isVisible ? 0 : pathLength,
          transition: `stroke-dashoffset 1.5s var(--ease-out-expo)`,
        }}
      />
      {/* Animated dot at the end */}
      {isVisible && (
        <circle
          cx={points[points.length - 1].x}
          cy={points[points.length - 1].y}
          r="4"
          fill={color}
          className="chart-dot-pulse"
          style={{
            opacity: isVisible ? 1 : 0,
            transition: 'opacity 0.3s ease-out 1.2s',
          }}
        />
      )}
    </svg>
  );
};

// ---------------------------------------------------------------------------
// SORT INDICATOR
// ---------------------------------------------------------------------------

interface SortIndicatorProps {
  direction: 'asc' | 'desc' | null;
  active: boolean;
}

const SortIndicator: React.FC<SortIndicatorProps> = ({ direction, active }) => (
  <span
    style={{
      display: 'inline-flex',
      flexDirection: 'column',
      gap: 1,
      marginLeft: 4,
      opacity: active ? 1 : 0.3,
      transition: 'opacity 0.15s ease',
    }}
  >
    <svg width={8} height={5} viewBox="0 0 8 5" fill="none">
      <path
        d="M4 0L8 5H0L4 0Z"
        fill={direction === 'asc' && active ? 'var(--grn)' : 'currentColor'}
        opacity={direction === 'asc' ? 1 : 0.3}
      />
    </svg>
    <svg width={8} height={5} viewBox="0 0 8 5" fill="none">
      <path
        d="M4 5L0 0H8L4 5Z"
        fill={direction === 'desc' && active ? 'var(--grn)' : 'currentColor'}
        opacity={direction === 'desc' ? 1 : 0.3}
      />
    </svg>
  </span>
);

// ---------------------------------------------------------------------------
// UPDATE PULSE INDICATOR
// ---------------------------------------------------------------------------

const UpdatePulse: React.FC<{ show: boolean }> = ({ show }) => {
  if (!show) return null;

  return (
    <span
      className="update-pulse"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: "var(--space-1-5)",
        padding: '4px 10px',
        borderRadius: "var(--radius-full)",
        background: 'rgba(34, 197, 94, 0.1)',
        border: '1px solid rgba(34, 197, 94, 0.2)',
        fontSize: "var(--fs-xs)",
        fontWeight: "var(--fw-medium)",
        color: 'var(--grn)',
      }}
    >
      <span className="live-indicator" style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--grn)' }} />
      Live
    </span>
  );
};

// Toast notification type
interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}

// Loading skeleton component with shimmer
const Skeleton: React.FC<{ width?: string | number; height?: number; borderRadius?: number }> = ({
  width = '100%',
  height = 20,
  borderRadius = 8
}) => (
  <div
    className="shimmer"
    style={{
      width,
      height,
      borderRadius,
    }}
  />
);

// Skeleton grid for token list loading state
const TokenCardSkeleton: React.FC = () => (
  <div
    className="glass-card skeleton-card"
    style={{
      padding: "var(--space-5)",
      borderRadius: "var(--radius-lg)",
      background: "var(--glass)",
      border: "1px solid var(--glass-border)",
    }}
  >
    <div style={{ display: "flex", alignItems: "flex-start", gap: "var(--space-3-5)", marginBottom: "var(--space-4)" }}>
      <Skeleton width={48} height={48} borderRadius={14} />
      <div style={{ flex: 1 }}>
        <Skeleton width="60%" height={18} borderRadius={6} />
        <div style={{ height: 8 }} />
        <Skeleton width="40%" height={14} borderRadius={6} />
      </div>
    </div>
    <div style={{ display: "flex", gap: "var(--space-3)", marginBottom: 14 }}>
      <div style={{ flex: 1 }}>
        <Skeleton width="100%" height={12} borderRadius={4} />
        <div style={{ height: 6 }} />
        <Skeleton width="70%" height={20} borderRadius={6} />
      </div>
      <div style={{ flex: 1 }}>
        <Skeleton width="100%" height={12} borderRadius={4} />
        <div style={{ height: 6 }} />
        <Skeleton width="70%" height={20} borderRadius={6} />
      </div>
    </div>
    <Skeleton width="100%" height={6} borderRadius={3} />
  </div>
);

const TokenGridSkeleton: React.FC<{ count?: number }> = ({ count = 6 }) => (
  <div
    className="token-grid grid-stagger"
    style={{
      display: "grid",
      gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
      gap: "var(--space-4)",
    }}
    aria-label="Loading tokens..."
    role="status"
  >
    {Array.from({ length: count }).map((_, i) => (
      <TokenCardSkeleton key={i} />
    ))}
    <span className="sr-only">Loading token data, please wait...</span>
  </div>
);

// Error state component with retry
interface ErrorStateProps {
  message?: string;
  onRetry?: () => void;
  compact?: boolean;
}

const ErrorState: React.FC<ErrorStateProps> = ({
  message = "Something went wrong",
  onRetry,
  compact = false
}) => (
  <div
    className="empty-state"
    style={{
      textAlign: "center",
      padding: compact ? "24px 16px" : "48px 20px"
    }}
  >
    <div
      style={{
        marginBottom: compact ? 8 : 16,
        display: "flex",
        justifyContent: "center"
      }}
    >
      <svg width={compact ? 32 : 48} height={compact ? 32 : 48} viewBox="0 0 24 24" fill="none" stroke="var(--red)" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.8 }}>
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
        <line x1="12" y1="9" x2="12" y2="13"/>
        <line x1="12" y1="17" x2="12.01" y2="17"/>
      </svg>
    </div>
    <h3 style={{
      fontSize: compact ? 14 : 18,
      fontWeight: "var(--fw-semibold)",
      color: "var(--t1)",
      marginBottom: 8
    }}>
      {message}
    </h3>
    <p style={{
      fontSize: compact ? 12 : 13,
      color: "var(--t3)",
      marginBottom: onRetry ? 16 : 0
    }}>
      {onRetry ? "Please try again or check your connection." : ""}
    </p>
    {onRetry && (
      <button
        onClick={onRetry}
        className="btn-press interactive-hover"
        style={{
          padding: compact ? "8px 16px" : "10px 20px",
          borderRadius: "var(--radius-full)",
          fontSize: compact ? 12 : 13,
          fontWeight: "var(--fw-medium)",
          background: "var(--glass2)",
          border: "1px solid var(--glass-border)",
          color: "var(--t1)",
          cursor: "pointer",
          display: "inline-flex",
          alignItems: "center",
          gap: 6
        }}
      >
        <SvgRefresh /> Try Again
      </button>
    )}
  </div>
);

// Animated number counter component
const AnimatedNumber: React.FC<{
  value: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  duration?: number;
}> = ({ value, prefix = '', suffix = '', decimals = 0, duration = 1000 }) => {
  const [displayValue, setDisplayValue] = useState(0);
  const [hasAnimated, setHasAnimated] = useState(false);

  useEffect(() => {
    if (hasAnimated) {
      setDisplayValue(value);
      return;
    }

    let startTime: number;
    let animationFrame: number;
    const startValue = 0;

    const animate = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      const easeOut = 1 - Math.pow(1 - progress, 3);
      setDisplayValue(startValue + (value - startValue) * easeOut);

      if (progress < 1) {
        animationFrame = requestAnimationFrame(animate);
      } else {
        setHasAnimated(true);
      }
    };

    animationFrame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationFrame);
  }, [value, duration, hasAnimated]);

  const formatted = decimals > 0 ? displayValue.toFixed(decimals) : Math.round(displayValue).toLocaleString();
  return <span className="number-transition">{prefix}{formatted}{suffix}</span>;
};

// Sparkline mini chart
const Sparkline: React.FC<{ data: number[]; width?: number; height?: number }> = ({
  data,
  width = 60,
  height = 24
}) => {
  if (!data.length) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((v - min) / range) * height;
    return `${x},${y}`;
  }).join(' ');
  const isUp = data[data.length - 1] >= data[0];

  return (
    <svg width={width} height={height} style={{ overflow: 'visible' }}>
      <polyline
        points={points}
        fill="none"
        stroke={isUp ? 'var(--grn)' : 'var(--red)'}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="sparkline-animate"
      />
    </svg>
  );
};

// Live indicator dot - Simplified
const LiveDot: React.FC = () => (
  <span
    style={{
      width: 6,
      height: 6,
      borderRadius: '50%',
      background: 'var(--grn)',
      display: 'inline-block'
    }}
  />
);

// Confirmation dialog
interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  type?: 'danger' | 'success' | 'info';
  onConfirm: () => void;
  onCancel: () => void;
}

const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  open,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  type = 'info',
  onConfirm,
  onCancel
}) => {
  if (!open) return null;

  return (
    <div
      className="backdrop-in"
      onClick={onCancel}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 150,
        padding: 24
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="glass-card modal-enter"
        style={{ padding: "var(--space-7)", maxWidth: 380, width: '100%' }}
      >
        <h3 style={{ fontSize: "var(--fs-lg)", fontWeight: "var(--fw-bold)", color: 'var(--t1)', marginBottom: "var(--space-3)" }}>{title}</h3>
        <div style={{ fontSize: "var(--fs-sm)", color: 'var(--t2)', marginBottom: "var(--space-6)", lineHeight: "var(--lh-relaxed)" }}>{message}</div>
        <div style={{ display: 'flex', gap: "var(--space-2)" }}>
          <button
            onClick={onCancel}
            className="glass-pill btn-press"
            style={{
              flex: 1,
              height: "var(--btn-lg)",
              fontSize: "var(--fs-sm)",
              fontWeight: "var(--fw-medium)",
              background: 'var(--sb)',
              color: 'var(--st)',
              border: '1px solid var(--sbd)',
              borderRadius: "var(--radius-full)",
              cursor: 'pointer',
              fontFamily: 'inherit'
            }}
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            className="btn-press"
            style={{
              flex: 1,
              height: "var(--btn-lg)",
              fontSize: "var(--fs-sm)",
              fontWeight: "var(--fw-semibold)",
              background: type === 'danger'
                ? 'linear-gradient(135deg, #fca5a5, #ef4444)'
                : type === 'success'
                  ? 'linear-gradient(135deg, #34d399, #16A34A)'
                  : 'var(--pb)',
              color: type === 'info' ? 'var(--pt)' : '#fff',
              border: 'none',
              borderRadius: "var(--radius-full)",
              cursor: 'pointer',
              fontFamily: 'inherit'
            }}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// TYPES
// ---------------------------------------------------------------------------

interface LaunchItem {
  id: string;
  publicKey: string;
  name: string;
  symbol: string;
  creator: string;
  status: string;
  price: number;
  priceChange24h: number;
  volume24h: number;
  marketCap: number;
  holders: number;
  trades: number;
  progress: number;
  createdAt: number;
  gi: number;
}

interface TradeItem {
  id: string; // Unique identifier for React key
  type: 'buy' | 'sell';
  trader: string;
  sol: number;
  tokens: string;
  time: string;
}

type Route =
  | { type: 'home' }
  | { type: 'launches' }
  | { type: 'detail'; launch: LaunchItem }
  | { type: 'create' }
  | { type: 'profile' }
  | { type: 'userProfile'; address: string }
  | { type: 'settings' }
  | { type: 'leaderboard' }

// Simplified route for localStorage persistence (no full launch object)
type PersistedRoute =
  | { type: 'home' }
  | { type: 'launches' }
  | { type: 'detail'; launchId: string }
  | { type: 'create' }
  | { type: 'profile' }
  | { type: 'userProfile'; address: string }
  | { type: 'settings' }
  | { type: 'leaderboard' };

// Advanced filter state
interface FilterState {
  minMarketCap: number | null;
  maxMarketCap: number | null;
  minAge: number | null; // in hours
  maxAge: number | null;
  minHolders: number | null;
  maxHolders: number | null;
}

// Settings state
interface UserSettings {
  defaultSlippage: number;
  notifications: {
    priceAlerts: boolean;
    graduationAlerts: boolean;
    tradeConfirmations: boolean;
    newLaunches: boolean;
    portfolioUpdates: boolean;
  };
  theme: 'dark' | 'light' | 'system';
  currency: 'USD' | 'SOL';
  priority: 'low' | 'medium' | 'high';
  rpc: 'helius' | 'quicknode' | 'default';
  analytics: boolean;
  // Institutional-grade settings
  displayDensity: 'compact' | 'comfortable' | 'spacious';
  autoRefresh: boolean;
  refreshInterval: number; // seconds
  tradingLimits: {
    maxTradeSize: number;
    dailyLimit: number;
    enabled: boolean;
  };
  soundEffects: boolean;
  chartType: 'candle' | 'line' | 'area';
  showIndicators: boolean;
  advancedMode: boolean;
  twoFactorEnabled: boolean;
  sessionTimeout: number; // minutes
}

// Transaction with signature for Solscan links
interface DetailedTransaction {
  type: 'buy' | 'sell' | 'create';
  launch: string;
  symbol: string;
  amount: number;
  sol: number;
  time: string;
  timestamp: number;
  txSignature: string;
  gi: number;
}

// Leaderboard entry
interface LeaderboardEntry {
  rank: number;
  address: string;
  totalPnl: number;
  winRate: number;
  trades: number;
  avatar: number;
}

// Mock user positions for profile
interface UserPosition {
  launch: LaunchItem;
  tokenBalance: number;
  avgBuyPrice: number;
  currentValue: number;
  pnl: number;
  pnlPercent: number;
}

// Mock trading activity
interface ActivityItem {
  id: string; // Unique identifier for React key
  type: 'buy' | 'sell' | 'create';
  launch: string;
  symbol: string;
  amount: number;
  sol: number;
  time: string;
  gi: number;
}

// ---------------------------------------------------------------------------
// STYLES
// ---------------------------------------------------------------------------

const inpS: React.CSSProperties = {
  background: "var(--glass-input)",
  border: "1px solid var(--glass-input-bd)",
  color: "var(--t1)",
  outline: "none",
  borderRadius: "var(--radius-lg)",
  fontSize: 14
};

const bpS: React.CSSProperties = {
  background: "linear-gradient(135deg, #34D399, #16A34A)",
  color: "white",
  border: "none",
  cursor: "pointer",
  borderRadius: "var(--radius-full)",
  fontWeight: "var(--fw-semibold)",
  transition: "all 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
  boxShadow: "0 4px 16px rgba(34, 197, 94, 0.25)"
};

const bsS: React.CSSProperties = {
  background: "var(--sb)",
  color: "var(--st)",
  border: "1px solid var(--sbd)",
  cursor: "pointer",
  borderRadius: "var(--radius-full)",
  transition: "all 0.2s cubic-bezier(0.16, 1, 0.3, 1)"
};

// ---------------------------------------------------------------------------
// BADGE COMPONENT
// ---------------------------------------------------------------------------

interface BadgeProps {
  status: string;
  isDark: boolean;
}

const Badge: React.FC<BadgeProps> = ({ status, isDark }) => {
  const cfg = status === "Graduated"
    ? { bg: "var(--gb)", bd: isDark ? "rgba(34,197,94,0.2)" : "rgba(22,163,74,0.15)", tx: "var(--grn)" }
    : status === "PendingGraduation"
    ? { bg: isDark ? "rgba(252,211,77,0.1)" : "rgba(217,119,6,0.06)", bd: isDark ? "rgba(252,211,77,0.2)" : "rgba(217,119,6,0.15)", tx: "var(--amb)" }
    : { bg: "var(--glass2)", bd: "var(--glass-border)", tx: "var(--t2)" };
  const label = status === "PendingGraduation" ? "Graduating" : status;
  return (
    <span style={{
      background: cfg.bg,
      border: `1px solid ${cfg.bd}`,
      color: cfg.tx,
      padding: "2px 9px",
      borderRadius: "var(--radius-full)",
      fontSize: "var(--fs-xs)",
      fontWeight: "var(--fw-medium)",
      whiteSpace: "nowrap",
      backdropFilter: "blur(8px)",
      WebkitBackdropFilter: "blur(8px)"
    }}>
      {label}
    </span>
  );
};

// ---------------------------------------------------------------------------
// CHANGE COMPONENT
// ---------------------------------------------------------------------------

interface ChgProps {
  v: number;
}

const Chg: React.FC<ChgProps> = ({ v }) => {
  const pos = v >= 0;
  return (
    <span style={{
      color: pos ? "var(--grn)" : "var(--red)",
      display: "inline-flex",
      alignItems: "center",
      gap: 2,
      fontSize: "var(--fs-base)",
      fontWeight: 500
    }}>
      {pos ? <SvgUp /> : <SvgDn />}
      {Math.abs(v).toFixed(1)}%
    </span>
  );
};

// ---------------------------------------------------------------------------
// ORBS BACKGROUND
// ---------------------------------------------------------------------------

interface OrbsProps {
  isDark: boolean;
}

const Orbs: React.FC<OrbsProps> = ({ isDark }) => {
  // Use refs to avoid React re-renders on every animation frame
  const orb1Ref = useRef<HTMLDivElement>(null);
  const orb2Ref = useRef<HTMLDivElement>(null);
  const orb3Ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let rafId: number;
    let targetX = 0;
    let targetY = 0;
    let currentX = 0;
    let currentY = 0;

    const handleMouseMove = (e: MouseEvent) => {
      // Normalize mouse position to -1 to 1 range
      targetX = (e.clientX / window.innerWidth - 0.5) * 2;
      targetY = (e.clientY / window.innerHeight - 0.5) * 2;
    };

    const animate = () => {
      // Smooth interpolation (0.02 = very subtle, slow follow)
      currentX += (targetX - currentX) * 0.02;
      currentY += (targetY - currentY) * 0.02;

      // Directly update DOM transforms instead of React state (avoids 60fps re-renders)
      if (orb1Ref.current) {
        orb1Ref.current.style.transform = `translate(${currentX * 30}px, ${currentY * 20}px)`;
      }
      if (orb2Ref.current) {
        orb2Ref.current.style.transform = `translate(${currentX * -20}px, ${currentY * 25}px)`;
      }
      if (orb3Ref.current) {
        orb3Ref.current.style.transform = `translate(${currentX * 15}px, ${currentY * -15}px)`;
      }

      rafId = requestAnimationFrame(animate);
    };

    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    rafId = requestAnimationFrame(animate);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      cancelAnimationFrame(rafId);
    };
  }, []);

  return (
    <div style={{ position: "fixed", inset: 0, overflow: "hidden", pointerEvents: "none", zIndex: 0 }}>
      <div
        ref={orb1Ref}
        style={{
          position: "absolute",
          top: "10%",
          left: "15%",
          width: 500,
          height: 500,
          borderRadius: "50%",
          background: isDark
            ? "radial-gradient(circle,rgba(34,197,94,0.06) 0%,transparent 70%)"
            : "radial-gradient(circle,rgba(34,197,94,0.12) 0%,transparent 70%)",
          animation: "orb1 25s ease-in-out infinite",
          filter: "blur(80px)",
          willChange: "transform"
        }}
      />
      <div
        ref={orb2Ref}
        style={{
          position: "absolute",
          top: "50%",
          right: "10%",
          width: 450,
          height: 450,
          borderRadius: "50%",
          background: isDark
            ? "radial-gradient(circle,rgba(99,102,241,0.04) 0%,transparent 70%)"
            : "radial-gradient(circle,rgba(99,102,241,0.08) 0%,transparent 70%)",
          animation: "orb2 30s ease-in-out infinite",
          filter: "blur(80px)",
          willChange: "transform"
        }}
      />
      <div
        ref={orb3Ref}
        style={{
          position: "absolute",
          bottom: "10%",
          left: "40%",
          width: 400,
          height: 400,
          borderRadius: "50%",
          background: isDark
            ? "radial-gradient(circle,rgba(236,72,153,0.03) 0%,transparent 70%)"
            : "radial-gradient(circle,rgba(236,72,153,0.06) 0%,transparent 70%)",
          animation: "orb3 20s ease-in-out infinite",
          filter: "blur(80px)",
          willChange: "transform"
        }}
      />
    </div>
  );
};

// =============================================================================
// MAIN APP COMPONENT
// =============================================================================

const App: React.FC = () => {
  const [isDark, setIsDark] = useState(() => {
    try {
      const saved = localStorage.getItem('launchr_settings');
      if (saved) {
        const settings = JSON.parse(saved);
        return settings.theme !== 'light';
      }
    } catch {}
    return true;
  });
  // Route state with localStorage persistence
  const [pendingDetailId, setPendingDetailId] = useState<string | null>(() => {
    try {
      const saved = localStorage.getItem('launchr_route');
      if (saved) {
        const persisted: PersistedRoute = JSON.parse(saved);
        if (persisted.type === 'detail') {
          return persisted.launchId;
        }
      }
    } catch {}
    return null;
  });
  const [route, setRoute] = useState<Route>(() => {
    try {
      const saved = localStorage.getItem('launchr_route');
      if (saved) {
        const persisted: PersistedRoute = JSON.parse(saved);
        // For detail pages, we wait for launches to load (handled by useEffect)
        if (persisted.type === 'detail') {
          return { type: 'home' };
        }
        return persisted as Route;
      }
    } catch {}
    return { type: 'home' };
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [tab, setTab] = useState('all');
  const [sort, setSort] = useState('volume');
  const [detailTab, setDetailTab] = useState('trades');
  const [tradeType, setTradeType] = useState<'buy' | 'sell'>('buy');
  const [tradeAmount, setTradeAmount] = useState('');
  const [viewKey, setViewKey] = useState(0);
  const [profileTab, setProfileTab] = useState<'positions' | 'activity' | 'created'>('positions');
  const [copied, setCopied] = useState(false);

  // Watchlist state with localStorage persistence
  const [watchlist, setWatchlist] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('launchr_watchlist');
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });

  // Advanced filters state
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<FilterState>({
    minMarketCap: null,
    maxMarketCap: null,
    minAge: null,
    maxAge: null,
    minHolders: null,
    maxHolders: null,
  });

  // Settings state with localStorage persistence
  const [settings, setSettings] = useState<UserSettings>(() => {
    const defaultSettings: UserSettings = {
      defaultSlippage: 3,
      notifications: {
        priceAlerts: true,
        graduationAlerts: true,
        tradeConfirmations: true,
        newLaunches: true,
        portfolioUpdates: false,
      },
      theme: 'dark',
      currency: 'USD',
      priority: 'medium',
      rpc: 'helius',
      analytics: true,
      // Institutional defaults
      displayDensity: 'comfortable',
      autoRefresh: true,
      refreshInterval: 30,
      tradingLimits: {
        maxTradeSize: 100,
        dailyLimit: 500,
        enabled: false,
      },
      soundEffects: false,
      chartType: 'candle',
      showIndicators: true,
      advancedMode: false,
      twoFactorEnabled: false,
      sessionTimeout: 60,
    };
    try {
      const saved = localStorage.getItem('launchr_settings');
      return saved ? { ...defaultSettings, ...JSON.parse(saved) } : defaultSettings;
    } catch {
      return defaultSettings;
    }
  });

  // Share modal state
  const [shareModal, setShareModal] = useState<LaunchItem | null>(null);
  const [leaderboardTab, setLeaderboardTab] = useState<'traders' | 'launches'>('traders');

  // Toast notifications
  const [toasts, setToasts] = useState<Toast[]>([]);

  // Refreshing state
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Trade loading and success state
  const [tradeLoading, setTradeLoading] = useState(false);
  const [tradeSuccess, setTradeSuccess] = useState(false);

  // Graduation celebration state
  const [showGraduation, setShowGraduation] = useState(false);
  const [graduatedLaunch, setGraduatedLaunch] = useState<LaunchItem | null>(null);

  // Trade confirmation dialog
  const [tradeConfirm, setTradeConfirm] = useState<{
    open: boolean;
    type: 'buy' | 'sell';
    amount: string;
    launch: LaunchItem | null;
  }>({ open: false, type: 'buy', amount: '', launch: null });

  // Show toast notification
  const showToast = useCallback((message: string, type: Toast['type'] = 'success') => {
    const id = Math.random().toString(36).slice(2);
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3000);
  }, []);

  // Refresh data
  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    // Simulate refresh - in real mode this would refetch data
    setTimeout(() => {
      setIsRefreshing(false);
      showToast('Data refreshed', 'success');
    }, 1000);
  }, [showToast]);

  // Persist watchlist
  useEffect(() => {
    localStorage.setItem('launchr_watchlist', JSON.stringify(watchlist));
  }, [watchlist]);

  // Persist settings
  useEffect(() => {
    localStorage.setItem('launchr_settings', JSON.stringify(settings));
  }, [settings]);

  // Persist route
  useEffect(() => {
    let persistedRoute: PersistedRoute;
    if (route.type === 'detail') {
      persistedRoute = { type: 'detail', launchId: route.launch.id };
    } else if (route.type === 'userProfile') {
      persistedRoute = { type: 'userProfile', address: route.address };
    } else {
      persistedRoute = { type: route.type } as PersistedRoute;
    }
    localStorage.setItem('launchr_route', JSON.stringify(persistedRoute));
  }, [route]);

  // Apply theme
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
  }, [isDark]);

  // ---- Hooks (mock or real) ----
  const wallet = USE_MOCKS ? useMockWallet() : useRealWallet();
  const launchesData = USE_MOCKS ? useMockLaunches() : useRealLaunches();
  const { launches: rawLaunches, loading: launchesLoading } = launchesData;

  const statsData = USE_MOCKS ? useMockGlobalStats() : useRealGlobalStats();
  const { stats } = statsData;

  const trade = USE_MOCKS ? useMockTrade() : useRealTrade(wallet);
  const createData = USE_MOCKS ? useMockCreateLaunch() : useRealCreateLaunch(wallet);
  const { createLaunch } = createData;

  // SOL Price from Pyth Oracle
  const { solPrice } = useSolPrice(15000); // Refresh every 15 seconds


  // Available wallets for selector
  const availableWallets = useAvailableWallets();
  const [showWalletSelector, setShowWalletSelector] = useState(false);
  const [showNavMenu, setShowNavMenu] = useState(false);

  // Network connectivity status
  const isOnline = useOnlineStatus();

  const currentLaunchPk = route.type === 'detail' ? route.launch.publicKey : undefined;
  const launchDetail = USE_MOCKS ? useMockLaunch(currentLaunchPk) : useRealLaunch(currentLaunchPk);
  const { trades: rawTrades } = launchDetail;

  // User balances for trading (real token balance from on-chain)
  const userAddress = wallet.connected ? wallet.address : undefined;
  const { balances: userBalances } = useUserBalances(userAddress ?? undefined, currentLaunchPk);

  // Launch holders data
  const { holders: launchHolders, totalHolders } = useLaunchHolders(currentLaunchPk);

  // User positions for portfolio view (from API - used when not mocking)
  const { positions: apiUserPositions, totalValue: apiPortfolioValue, totalPnl: apiPortfolioPnl } = useUserPositions(userAddress ?? undefined);

  // User activity for profile
  const { activity: userTradeActivity } = useUserActivity(userAddress ?? undefined, 50);

  // User stats for profile
  const { stats: userProfileStats } = useUserStats(userAddress ?? undefined);

  // Transform launches to our format
  const launches: LaunchItem[] = useMemo(() => {
    return rawLaunches.map((l, i) => {
      // Calculate progress from realSolReserve / graduationThreshold
      const progress = l.graduationThreshold > 0
        ? Math.min((l.realSolReserve / l.graduationThreshold) * 100, 100)
        : 0;
      return {
        id: l.publicKey,
        publicKey: l.publicKey,
        name: l.name,
        symbol: l.symbol,
        creator: l.creator?.slice(0, 4) + "..." + l.creator?.slice(-4) || 'Unknown',
        status: l.status,
        price: l.currentPrice || 0,
        priceChange24h: 0, // Not available in data, set to 0
        volume24h: l.realSolReserve || 0, // Use realSolReserve as volume proxy
        marketCap: l.marketCap || 0,
        holders: l.holderCount || 0,
        trades: l.tradeCount || 0,
        progress: Math.round(progress),
        createdAt: l.createdAt || Date.now(),
        gi: i % 10
      };
    });
  }, [rawLaunches]);

  // Fetch token metadata for Metaplex images (skip in mock mode)
  const launchMintAddresses = useMemo(() => {
    return USE_MOCKS ? [] : launches.map(l => l.publicKey);
  }, [launches]);
  const { metadataMap: tokenMetadataMap } = useMultipleTokenMetadata(launchMintAddresses);

  // Helper function to get token image URL
  const getTokenImageUrl = useCallback((publicKey: string): string | undefined => {
    return tokenMetadataMap.get(publicKey)?.image;
  }, [tokenMetadataMap]);

  // Restore detail page when launches load (for route persistence)
  useEffect(() => {
    if (pendingDetailId && !launchesLoading) {
      const launch = launches.find(l => l.id === pendingDetailId);
      if (launch) {
        setRoute({ type: 'detail', launch });
      } else {
        // Launch not found, fall back to home
        setRoute({ type: 'home' });
      }
      setPendingDetailId(null);
    }
  }, [pendingDetailId, launches, launchesLoading]);

  // Generate mock sparkline data for each launch
  const sparklineData = useMemo(() => {
    const data: Record<string, number[]> = {};
    launches.forEach(l => {
      const base = l.price;
      data[l.id] = Array.from({ length: 12 }, (_, i) =>
        base * (0.8 + Math.random() * 0.4) * (1 + i * 0.02)
      );
    });
    return data;
  }, [launches]);

  // Listen for graduation events via WebSocket
  useEffect(() => {
    if (!settings.notifications.graduationAlerts) return;

    wsClient.connect();
    wsClient.subscribeChannel('launches');

    const unsubscribe = wsClient.onMessage((message: NormalizedMessage) => {
      if (message.type === 'launch_graduated') {
        const launch = message.data;
        // Find the full launch data if available
        const fullLaunch = launches.find(l => l.publicKey === launch.publicKey);
        if (fullLaunch || launch) {
          setGraduatedLaunch(fullLaunch || {
            id: launch.publicKey,
            publicKey: launch.publicKey,
            name: launch.name || 'Unknown',
            symbol: launch.symbol || '???',
            gi: 0,
            status: 'graduated',
            price: launch.currentPrice || 0,
            priceChange24h: 0,
            creator: launch.creator || '',
            marketCap: launch.currentPrice ? launch.currentPrice * 800000000 : 0,
            volume24h: 0,
            progress: 100,
            holders: launch.holderCount || 0,
            trades: 0,
            createdAt: launch.createdAt || Date.now(),
          });
          setShowGraduation(true);
          showToast(`${launch.name} ($${launch.symbol}) has graduated to Orbit DLMM!`, 'success');
        }
      }
    });

    return () => {
      wsClient.unsubscribeChannel('launches');
      unsubscribe();
    };
  }, [settings.notifications.graduationAlerts, launches, showToast]);

  // Transform trades
  const trades: TradeItem[] = useMemo(() => {
    return (rawTrades || []).slice(0, 8).map((t, i) => ({
      id: t.txSignature || `trade-${t.timestamp}-${i}`, // Unique key
      type: t.type as 'buy' | 'sell',
      trader: t.user?.slice(0, 4) + "..." + t.user?.slice(-4) || 'Unknown',
      sol: t.solAmount || 0,
      tokens: ((t.amount || 0) / 1e6).toFixed(0) + "M",
      time: getTimeAgo(t.timestamp || Date.now())
    }));
  }, [rawTrades]);

  // Filtered launches with advanced filters
  const filteredLaunches = useMemo(() => {
    let l = [...launches];

    // Text search
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      l = l.filter(x => x.name.toLowerCase().includes(q) || x.symbol.toLowerCase().includes(q));
    }

    // Tab filters
    if (tab === "trending") {
      l = l.filter(x => x.status !== "Graduated").sort((a, b) => b.volume24h - a.volume24h);
    } else if (tab === "graduated") {
      l = l.filter(x => x.status === "Graduated");
    } else if (tab === "watchlist") {
      l = l.filter(x => watchlist.includes(x.id));
    }

    // Advanced filters
    if (filters.minMarketCap !== null) {
      l = l.filter(x => x.marketCap >= (filters.minMarketCap || 0));
    }
    if (filters.maxMarketCap !== null) {
      l = l.filter(x => x.marketCap <= (filters.maxMarketCap || Infinity));
    }
    if (filters.minHolders !== null) {
      l = l.filter(x => x.holders >= (filters.minHolders || 0));
    }
    if (filters.maxHolders !== null) {
      l = l.filter(x => x.holders <= (filters.maxHolders || Infinity));
    }
    if (filters.minAge !== null) {
      const minTime = Date.now() - (filters.minAge * 60 * 60 * 1000);
      l = l.filter(x => x.createdAt <= minTime);
    }
    if (filters.maxAge !== null) {
      const maxTime = Date.now() - (filters.maxAge * 60 * 60 * 1000);
      l = l.filter(x => x.createdAt >= maxTime);
    }

    // Sorting
    if (tab !== "trending") {
      if (sort === "volume") l.sort((a, b) => b.volume24h - a.volume24h);
      else if (sort === "newest") l.sort((a, b) => b.createdAt - a.createdAt);
      else if (sort === "mcap") l.sort((a, b) => b.marketCap - a.marketCap);
      else if (sort === "progress") l.sort((a, b) => b.progress - a.progress);
    }

    return l;
  }, [launches, searchQuery, tab, sort, watchlist, filters]);

  // Generate detailed transactions with signatures for Solscan
  const detailedTransactions: DetailedTransaction[] = useMemo(() => {
    if (!wallet.connected) return [];
    const baseTxs = [
      { type: 'buy' as const, launch: 'OrbitCat', symbol: 'OCAT', amount: 50000000, sol: 2.5, time: '2m ago', timestamp: Date.now() - 120000, txSignature: '5KzR8vNqP8wY4mXjL2pG9hB7dF3cA1nM6sQwE4tR7uZx', gi: 0 },
      { type: 'sell' as const, launch: 'SolPepe', symbol: 'SPEPE', amount: 25000000, sol: 1.8, time: '15m ago', timestamp: Date.now() - 900000, txSignature: '3HjK2mWpN5xY7vLqR4sC8bT9dF1eA6gM2nQwE5tR3uZy', gi: 1 },
      { type: 'buy' as const, launch: 'DogWifRocket', symbol: 'DWRKT', amount: 100000000, sol: 5.0, time: '1h ago', timestamp: Date.now() - 3600000, txSignature: '7PmN3oXqS6yZ8wLrT5uD9cV2eB4fA1hK6sQwE7tR8uZw', gi: 2 },
      { type: 'create' as const, launch: 'MyCoin', symbol: 'MINE', amount: 0, sol: 0.5, time: '2d ago', timestamp: Date.now() - 172800000, txSignature: '9RoP5qYsU8zA0xNtV7wF1dC3eD6gB2iL8sQwE9tR0uZv', gi: 3 },
      { type: 'buy' as const, launch: 'OrbitCat', symbol: 'OCAT', amount: 247000000, sol: 8.2, time: '3d ago', timestamp: Date.now() - 259200000, txSignature: '2JkL4nWpM7xY9vLqR6sC0bT1dF3eA8gM4nQwE2tR5uZu', gi: 0 },
      { type: 'sell' as const, launch: 'BonkOrbit', symbol: 'BORBIT', amount: 75000000, sol: 3.1, time: '5d ago', timestamp: Date.now() - 432000000, txSignature: '4MnO6pXrQ9yZ1wLtT8uD2cV4eB7fA3hK0sQwE4tR6uZt', gi: 4 },
    ];
    return baseTxs;
  }, [wallet.connected]);

  // Mock leaderboard data
  const leaderboardData: LeaderboardEntry[] = useMemo(() => [
    { rank: 1, address: '7xKz...9Pmn', totalPnl: 156.78, winRate: 78.5, trades: 342, avatar: 0 },
    { rank: 2, address: '3Hjk...2Wmp', totalPnl: 134.21, winRate: 72.3, trades: 289, avatar: 1 },
    { rank: 3, address: '9RoP...5qYs', totalPnl: 98.45, winRate: 69.8, trades: 198, avatar: 2 },
    { rank: 4, address: '4MnO...6pXr', totalPnl: 87.32, winRate: 67.2, trades: 176, avatar: 3 },
    { rank: 5, address: '8NpQ...7rYt', totalPnl: 76.19, winRate: 65.4, trades: 154, avatar: 4 },
    { rank: 6, address: '5KzR...8vNq', totalPnl: 65.87, winRate: 63.1, trades: 132, avatar: 5 },
    { rank: 7, address: '2JkL...4nWp', totalPnl: 54.23, winRate: 61.8, trades: 118, avatar: 6 },
    { rank: 8, address: '6LmN...3oXq', totalPnl: 43.67, winRate: 59.2, trades: 95, avatar: 7 },
    { rank: 9, address: '1IjK...5mVo', totalPnl: 32.45, winRate: 57.6, trades: 78, avatar: 8 },
    { rank: 10, address: '0HiJ...6lUn', totalPnl: 21.89, winRate: 55.3, trades: 62, avatar: 9 },
  ], []);

  // Top launches for leaderboard
  const topLaunches = useMemo(() => {
    return [...launches]
      .sort((a, b) => b.volume24h - a.volume24h)
      .slice(0, 10)
      .map((l, i) => ({ ...l, rank: i + 1 }));
  }, [launches]);

  // Watchlist toggle
  const toggleWatchlist = useCallback((id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const isRemoving = watchlist.includes(id);
    setWatchlist(prev =>
      prev.includes(id)
        ? prev.filter(x => x !== id)
        : [...prev, id]
    );
    const launch = launches.find(l => l.id === id);
    if (launch) {
      showToast(
        isRemoving ? `Removed ${launch.symbol} from watchlist` : `Added ${launch.symbol} to watchlist`,
        'success'
      );
    }
  }, [watchlist, launches, showToast]);

  // Check if in watchlist
  const isWatchlisted = useCallback((id: string) => watchlist.includes(id), [watchlist]);

  // Clear all filters
  const clearFilters = useCallback(() => {
    setFilters({
      minMarketCap: null,
      maxMarketCap: null,
      minAge: null,
      maxAge: null,
      minHolders: null,
      maxHolders: null,
    });
  }, []);

  // Check if any filters are active
  const hasActiveFilters = useMemo(() => {
    return Object.values(filters).some(v => v !== null);
  }, [filters]);

  // Navigation with smooth scroll to top
  const go = useCallback((type: Route['type'], launch?: LaunchItem, address?: string) => {
    // Smooth scroll to top for seamless page transitions
    window.scrollTo({ top: 0, behavior: 'smooth' });

    if (type === 'detail' && launch) {
      setRoute({ type: 'detail', launch });
    } else if (type === 'userProfile' && address) {
      setRoute({ type: 'userProfile', address });
    } else if (type === 'home' || type === 'launches' || type === 'create' || type === 'profile' || type === 'settings' || type === 'leaderboard') {
      setRoute({ type });
    }
    setDetailTab('trades');
    setTradeType('buy');
    setTradeAmount('');
    setViewKey(k => k + 1);
  }, []);

  // Keyboard shortcuts for power users
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Skip if user is typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.key === 'Escape') {
        if (shareModal) setShareModal(null);
        if (showFilters) setShowFilters(false);
        if (tradeConfirm.open) setTradeConfirm({ open: false, type: 'buy', amount: '', launch: null });
      }

      // Quick navigation shortcuts
      if (e.key === 'h' && !e.metaKey && !e.ctrlKey) {
        go('home');
      }
      if (e.key === 'l' && !e.metaKey && !e.ctrlKey) {
        go('launches');
      }
      if (e.key === 'c' && !e.metaKey && !e.ctrlKey) {
        go('create');
      }
      if (e.key === 'r' && !e.metaKey && !e.ctrlKey) {
        handleRefresh();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [shareModal, showFilters, tradeConfirm.open, go, handleRefresh]);

  // User positions - use API data or mock data based on USE_MOCKS
  const userPositions: UserPosition[] = useMemo(() => {
    if (!wallet.connected) return [];

    // Use real API data when not mocking
    if (!USE_MOCKS && apiUserPositions.length > 0) {
      return apiUserPositions.map((pos) => {
        // Find the full launch data from launches array if available
        const fullLaunch = launches.find(l => l.publicKey === pos.launch.publicKey);
        const launch: LaunchItem = fullLaunch || {
          id: pos.launch.id || pos.launch.publicKey,
          publicKey: pos.launch.publicKey,
          name: pos.launch.name,
          symbol: pos.launch.symbol,
          gi: pos.launch.gi ?? 0,
          status: pos.launch.status || 'active',
          price: pos.launch.currentPrice || 0,
          priceChange24h: 0,
          creator: pos.launch.creator || '',
          marketCap: pos.launch.marketCap || 0,
          volume24h: pos.launch.volume24h || 0,
          progress: pos.launch.progress || 0,
          holders: pos.launch.holderCount || 0,
          trades: pos.launch.trades || 0,
          createdAt: pos.launch.createdAt || Date.now(),
        };

        const avgBuyPrice = pos.costBasis > 0 && pos.tokenBalance > 0
          ? pos.costBasis / pos.tokenBalance
          : 0;

        return {
          launch,
          tokenBalance: pos.tokenBalance,
          avgBuyPrice,
          currentValue: pos.currentValue,
          pnl: pos.pnl,
          pnlPercent: pos.pnlPercent
        };
      });
    }

    // Mock: user has positions in first 3 launches
    return launches.slice(0, 3).map((launch, i) => {
      const tokenBalance = [297000000, 145000000, 89000000][i] || 100000000;
      const avgBuyPrice = launch.price * (0.7 + Math.random() * 0.3);
      const currentValue = tokenBalance * launch.price;
      const costBasis = tokenBalance * avgBuyPrice;
      const pnl = currentValue - costBasis;
      const pnlPercent = costBasis > 0 ? (pnl / costBasis) * 100 : 0;
      return {
        launch,
        tokenBalance,
        avgBuyPrice,
        currentValue,
        pnl,
        pnlPercent
      };
    });
  }, [launches, wallet.connected, apiUserPositions]);

  // User activity - use API data or mock data based on USE_MOCKS
  const userActivity: ActivityItem[] = useMemo(() => {
    if (!wallet.connected) return [];

    // Use real API data when not mocking
    if (!USE_MOCKS && userTradeActivity.length > 0) {
      return userTradeActivity.map((activity, i) => ({
        id: activity.signature || `activity-${activity.timestamp}-${i}`,
        type: activity.type as 'buy' | 'sell',
        launch: activity.launch.name,
        symbol: activity.launch.symbol,
        amount: activity.tokenAmount,
        sol: activity.solAmount / 1e9, // Convert lamports to SOL
        time: getTimeAgo(activity.timestamp),
        gi: i % GRADS.length, // Use index for gradient
      }));
    }

    // Mock data
    return [
      { id: 'act-1', type: 'buy' as const, launch: 'OrbitCat', symbol: 'OCAT', amount: 50000000, sol: 2.5, time: '2m ago', gi: 0 },
      { id: 'act-2', type: 'sell' as const, launch: 'SolPepe', symbol: 'SPEPE', amount: 25000000, sol: 1.8, time: '15m ago', gi: 1 },
      { id: 'act-3', type: 'buy' as const, launch: 'DogWifRocket', symbol: 'DWRKT', amount: 100000000, sol: 5.0, time: '1h ago', gi: 2 },
      { id: 'act-4', type: 'create' as const, launch: 'MyCoin', symbol: 'MINE', amount: 0, sol: 0.5, time: '2d ago', gi: 3 },
      { id: 'act-5', type: 'buy' as const, launch: 'OrbitCat', symbol: 'OCAT', amount: 247000000, sol: 8.2, time: '3d ago', gi: 0 },
      { id: 'act-6', type: 'sell' as const, launch: 'BonkOrbit', symbol: 'BORBIT', amount: 75000000, sol: 3.1, time: '5d ago', gi: 4 },
    ];
  }, [wallet.connected, userTradeActivity]);

  // Calculate portfolio totals
  const portfolioStats = useMemo(() => {
    const totalValue = userPositions.reduce((sum, p) => sum + p.currentValue, 0);
    const totalPnl = userPositions.reduce((sum, p) => sum + p.pnl, 0);
    const totalCost = userPositions.reduce((sum, p) => sum + (p.tokenBalance * p.avgBuyPrice), 0);
    const pnlPercent = totalCost > 0 ? (totalPnl / totalCost) * 100 : 0;
    return { totalValue, totalPnl, pnlPercent, positionCount: userPositions.length };
  }, [userPositions]);

  // Time ago helper
  function getTimeAgo(timestamp: number): string {
    const diff = Date.now() - timestamp;
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  }

  // Solana transaction error parser - provides user-friendly messages for common errors
  function parseTransactionError(err: unknown): { message: string; detail?: string } {
    const errorStr = err instanceof Error ? err.message : String(err);
    const errorLower = errorStr.toLowerCase();

    // Transaction expired (blockhash too old - Solana txs expire after ~1 minute)
    if (errorLower.includes('blockhash') && (errorLower.includes('expired') || errorLower.includes('not found'))) {
      return {
        message: 'Transaction expired',
        detail: 'Solana transactions expire after ~60 seconds. Please try again.'
      };
    }

    // Slippage exceeded
    if (errorLower.includes('slippage') || errorLower.includes('mintoken') || errorLower.includes('minsol')) {
      return {
        message: 'Price changed too much',
        detail: 'The price moved beyond your slippage tolerance. Try increasing slippage or using a smaller amount.'
      };
    }

    // Insufficient funds
    if (errorLower.includes('insufficient') && errorLower.includes('lamports')) {
      return {
        message: 'Insufficient SOL balance',
        detail: 'Make sure you have enough SOL for the trade plus network fees (~0.01 SOL).'
      };
    }

    // Insufficient token balance
    if (errorLower.includes('insufficient') && (errorLower.includes('token') || errorLower.includes('balance'))) {
      return {
        message: 'Insufficient token balance',
        detail: 'You don\'t have enough tokens to complete this sale.'
      };
    }

    // Simulation failed (catches issues before tx is sent)
    if (errorLower.includes('simulation failed')) {
      return {
        message: 'Transaction simulation failed',
        detail: 'The transaction would fail on-chain. Check your inputs and try again.'
      };
    }

    // Security check failed
    if (errorLower.includes('security') || errorLower.includes('unauthorized program')) {
      return {
        message: 'Security check failed',
        detail: 'Transaction rejected for security reasons. Do not retry.'
      };
    }

    // User rejected in wallet
    if (errorLower.includes('user rejected') || errorLower.includes('user denied')) {
      return {
        message: 'Transaction cancelled',
        detail: 'You cancelled the transaction in your wallet.'
      };
    }

    // Wallet not connected
    if (errorLower.includes('wallet not connected')) {
      return {
        message: 'Wallet disconnected',
        detail: 'Please reconnect your wallet and try again.'
      };
    }

    // Launch not active/tradeable
    if (errorLower.includes('not active') || errorLower.includes('not tradeable') || errorLower.includes('graduated')) {
      return {
        message: 'Token not tradeable',
        detail: 'This token has graduated to Orbit DEX or is no longer active.'
      };
    }

    // Network/RPC errors
    if (errorLower.includes('network') || errorLower.includes('timeout') || errorLower.includes('fetch')) {
      return {
        message: 'Network error',
        detail: 'Check your connection and try again. Solana may be congested.'
      };
    }

    // Max retries exceeded
    if (errorLower.includes('max retries') || errorLower.includes('failed after')) {
      return {
        message: 'Transaction failed to confirm',
        detail: 'Network congestion may be high. Wait a moment and try again.'
      };
    }

    // Generic fallback - include original message for debugging
    return {
      message: 'Transaction failed',
      detail: errorStr.length > 100 ? 'An unexpected error occurred. Please try again.' : errorStr
    };
  }

  // Handlers
  const initiateTransaction = useCallback(() => {
    if (!currentLaunchPk || !tradeAmount) return;
    const amount = parseFloat(tradeAmount);
    if (isNaN(amount) || amount <= 0) return;
    if (route.type !== 'detail') return;

    // Show confirmation dialog
    if (settings.notifications.tradeConfirmations) {
      setTradeConfirm({
        open: true,
        type: tradeType,
        amount: tradeAmount,
        launch: route.launch
      });
    } else {
      executeTrade();
    }
  }, [currentLaunchPk, tradeAmount, tradeType, route, settings.notifications.tradeConfirmations]);

  const executeTrade = useCallback(async () => {
    if (!currentLaunchPk || !tradeAmount || tradeLoading) return;
    const amount = parseFloat(tradeAmount);
    if (isNaN(amount) || amount <= 0) return;

    setTradeLoading(true);
    setTradeSuccess(false);
    try {
      tradeType === 'buy'
        ? await trade.buy(currentLaunchPk, amount, settings.defaultSlippage)
        : await trade.sell(currentLaunchPk, amount, settings.defaultSlippage);
      setTradeAmount('');
      setTradeConfirm({ open: false, type: 'buy', amount: '', launch: null });
      setTradeSuccess(true);
      showToast(
        `${tradeType === 'buy' ? 'Bought' : 'Sold'} ${amount} ${tradeType === 'buy' ? 'SOL worth' : 'tokens'}`,
        'success'
      );
      // Reset success state after animation
      setTimeout(() => setTradeSuccess(false), 2000);
    } catch (err) {
      const { message, detail } = parseTransactionError(err);
      // Show detailed message for better UX - Solana transactions are atomic (all-or-nothing)
      showToast(detail ? `${message}: ${detail}` : message, 'error');
      console.error('Trade error:', err);
    } finally {
      setTradeLoading(false);
    }
  }, [currentLaunchPk, tradeAmount, tradeType, trade, settings.defaultSlippage, showToast, tradeLoading]);

  const handleCreateLaunch = useCallback(async (data: {
    name: string;
    symbol: string;
    description: string;
    image?: string;
    twitter?: string;
    telegram?: string;
    website?: string;
  }) => {
    try {
      // Step 1: Upload metadata and image to get URI
      const uploadResult = await api.uploadMetadata({
        name: data.name,
        symbol: data.symbol,
        description: data.description,
        image: data.image,
        twitter: data.twitter,
        telegram: data.telegram,
        website: data.website,
        creator: wallet.address || undefined,
      });

      if (uploadResult.error || !uploadResult.data) {
        throw new Error(uploadResult.error || 'Failed to upload metadata');
      }

      // Step 2: Create the token with the metadata URI
      await createLaunch({
        name: data.name,
        symbol: data.symbol,
        uri: uploadResult.data.uri,
        twitter: data.twitter || '',
        telegram: data.telegram || '',
        website: data.website || '',
        creatorFeeBps: 0,
      });
      showToast(`Token "${data.name}" created successfully!`, 'success');
      go('launches');
    } catch (err) {
      const { message, detail } = parseTransactionError(err);
      showToast(detail ? `${message}: ${detail}` : message, 'error');
      console.error('Create token error:', err);
    }
  }, [createLaunch, go, showToast, wallet.address]);

  // ---------------------------------------------------------------------------
  // NAV COMPONENT
  // ---------------------------------------------------------------------------

  const Nav = () => (
    <nav className="nav-animated" style={{
      position: "sticky",
      top: 0,
      zIndex: 50,
      backdropFilter: "blur(40px) saturate(1.8)",
      WebkitBackdropFilter: "blur(40px) saturate(1.8)",
      background: isDark ? "rgba(17,24,39,0.92)" : "rgba(255,255,255,0.85)",
      borderBottom: "1px solid var(--glass-border)"
    }}>
      <div style={{
        maxWidth: 1400,
        margin: "0 auto",
        padding: "0 var(--space-6)",
        height: 56,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between"
      }}>
        {/* Logo - Primary */}
        <div
          className="nav-logo"
          style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", cursor: "pointer" }}
          onClick={() => go('home')}
        >
          <div style={{ width: 28, height: 28 }}>
            <SvgLogo size={28} variant="badge" />
          </div>
          <span style={{ fontSize: "var(--fs-lg)", fontWeight: "var(--fw-bold)", letterSpacing: -0.5, color: "var(--t1)" }}>
            Launchr
          </span>
        </div>

        {/* Right side - Clean & minimal */}
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
          {/* Network Badge - Important for testnet awareness */}
          <Tooltip content="You are connected to Solana Devnet (testnet)" position="bottom">
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "var(--space-1-5)",
                padding: "var(--space-1-5) var(--space-2-5)",
                borderRadius: "var(--radius-full)",
                background: "rgba(251, 191, 36, 0.15)",
                border: "1px solid rgba(251, 191, 36, 0.3)"
              }}
            >
              <span style={{
                width: 6,
                height: 6,
                borderRadius: "var(--radius-full)",
                background: "var(--amb)",
                boxShadow: "0 0 6px var(--amb)"
              }} />
              <span style={{
                fontSize: "var(--fs-xs)",
                fontWeight: "var(--fw-semibold)",
                color: "var(--amb)",
                textTransform: "uppercase",
                letterSpacing: 0.5
              }}>
                Devnet
              </span>
            </div>
          </Tooltip>

          {/* SOL Price - Compact inline display */}
          <div
            className="nav-sol-price"
            style={{
              display: "flex",
              alignItems: "center",
              gap: "var(--space-2)",
              padding: "var(--space-2) var(--space-3)",
              borderRadius: "var(--radius-sm)",
              background: "var(--glass2)",
              border: "1px solid var(--glass-border)"
            }}
          >
            <svg width={14} height={14} viewBox="0 0 397.7 311.7" fill="none">
              <defs>
                <linearGradient id="sol-nav-gradient" x1="0" y1="0" x2="397.7" y2="311.7" gradientUnits="userSpaceOnUse">
                  <stop offset="0%" stopColor="#00FFA3" />
                  <stop offset="100%" stopColor="#DC1FFF" />
                </linearGradient>
              </defs>
              <path d="M64.6 237.9c2.4-2.4 5.7-3.8 9.2-3.8h317.4c5.8 0 8.7 7 4.6 11.1l-62.7 62.7c-2.4 2.4-5.7 3.8-9.2 3.8H6.5c-5.8 0-8.7-7-4.6-11.1l62.7-62.7z" fill="url(#sol-nav-gradient)"/>
              <path d="M64.6 3.8C67.1 1.4 70.4 0 73.8 0h317.4c5.8 0 8.7 7 4.6 11.1l-62.7 62.7c-2.4 2.4-5.7 3.8-9.2 3.8H6.5c-5.8 0-8.7-7-4.6-11.1L64.6 3.8z" fill="url(#sol-nav-gradient)"/>
              <path d="M333.1 120.1c-2.4-2.4-5.7-3.8-9.2-3.8H6.5c-5.8 0-8.7 7-4.6 11.1l62.7 62.7c2.4 2.4 5.7 3.8 9.2 3.8h317.4c5.8 0 8.7-7 4.6-11.1l-62.7-62.7z" fill="url(#sol-nav-gradient)"/>
            </svg>
            <span style={{
              fontSize: "var(--fs-sm)",
              fontWeight: "var(--fw-semibold)",
              color: "var(--t1)",
              fontFamily: "'JetBrains Mono', monospace"
            }}>
              ${solPrice.price > 0 ? solPrice.price.toFixed(2) : '--'}
            </span>
            {solPrice.change24h !== 0 && (
              <span style={{
                fontSize: "var(--fs-xs)",
                fontWeight: "var(--fw-medium)",
                color: solPrice.change24h >= 0 ? "var(--grn)" : "var(--red)"
              }}>
                {solPrice.change24h >= 0 ? '+' : ''}{solPrice.change24h.toFixed(1)}%
              </span>
            )}
          </div>

          {/* Menu toggle button */}
          <div style={{ position: "relative" }}>
            <button
              onClick={() => setShowNavMenu(!showNavMenu)}
              className="glass-pill nav-icon-btn btn-press"
              style={s(bsS, {
                width: 40,
                height: 40,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: 0,
                color: showNavMenu ? "var(--grn)" : "var(--t2)"
              })}
              aria-label="Toggle menu"
              aria-expanded={showNavMenu}
            >
              <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
                {showNavMenu ? (
                  <path d="M18 6L6 18M6 6l12 12" />
                ) : (
                  <>
                    <path d="M4 6h16M4 12h16M4 18h16" />
                  </>
                )}
              </svg>
            </button>

            {/* Dropdown Menu */}
            {showNavMenu && (
              <>
                <div
                  style={{ position: "fixed", inset: 0, zIndex: 40 }}
                  onClick={() => setShowNavMenu(false)}
                />
                <div
                  className="nav-dropdown"
                  style={{
                    position: "absolute",
                    top: "calc(100% + var(--space-2))",
                    right: 0,
                    minWidth: 200,
                    padding: "var(--space-2)",
                    borderRadius: "var(--radius-lg)",
                    background: isDark ? "rgba(17,24,39,0.98)" : "rgba(255,255,255,0.98)",
                    border: "1px solid var(--glass-border)",
                    boxShadow: "0 8px 32px rgba(0,0,0,0.2)",
                    zIndex: 50,
                    animation: "fadeIn 0.15s ease"
                  }}
                >
                  {/* Navigation items */}
                  <button
                    onClick={() => { go('leaderboard'); setShowNavMenu(false); }}
                    className="interactive-hover btn-press"
                    style={{
                      width: "100%",
                      display: "flex",
                      alignItems: "center",
                      gap: "var(--space-3)",
                      padding: "var(--space-3)",
                      borderRadius: "var(--radius-sm)",
                      border: "none",
                      background: route.type === 'leaderboard' ? "var(--glass2)" : "transparent",
                      color: route.type === 'leaderboard' ? "var(--grn)" : "var(--t1)",
                      fontSize: "var(--fs-base)",
                      fontWeight: "var(--fw-medium)",
                      cursor: "pointer",
                      transition: "background var(--transition-fast)",
                      fontFamily: "inherit"
                    }}
                  >
                    <SvgTrophy /> Leaderboard
                  </button>
                  <button
                    onClick={() => { go('settings'); setShowNavMenu(false); }}
                    className="interactive-hover btn-press"
                    style={{
                      width: "100%",
                      display: "flex",
                      alignItems: "center",
                      gap: "var(--space-3)",
                      padding: "var(--space-3)",
                      borderRadius: "var(--radius-sm)",
                      border: "none",
                      background: route.type === 'settings' ? "var(--glass2)" : "transparent",
                      color: route.type === 'settings' ? "var(--grn)" : "var(--t1)",
                      fontSize: "var(--fs-base)",
                      fontWeight: "var(--fw-medium)",
                      cursor: "pointer",
                      transition: "background var(--transition-fast)",
                      fontFamily: "inherit"
                    }}
                  >
                    <SvgSettings /> Settings
                  </button>

                  {/* Divider */}
                  <div style={{ height: 1, background: "var(--glass-border)", margin: "var(--space-2) 0" }} />

                  {/* Theme toggle */}
                  <button
                    onClick={() => {
                      const newTheme = isDark ? 'light' : 'dark';
                      setIsDark(!isDark);
                      setSettings(prev => ({ ...prev, theme: newTheme }));
                    }}
                    className="interactive-hover btn-press"
                    aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
                    style={{
                      width: "100%",
                      display: "flex",
                      alignItems: "center",
                      gap: "var(--space-3)",
                      padding: "var(--space-3)",
                      borderRadius: "var(--radius-sm)",
                      border: "none",
                      background: "transparent",
                      color: "var(--t1)",
                      fontSize: "var(--fs-base)",
                      fontWeight: "var(--fw-medium)",
                      cursor: "pointer",
                      transition: "background var(--transition-fast)",
                      fontFamily: "inherit"
                    }}
                  >
                    {isDark ? <SvgSun /> : <SvgMoon />}
                    {isDark ? "Light Mode" : "Dark Mode"}
                  </button>

                  {/* Divider */}
                  <div style={{ height: 1, background: "var(--glass-border)", margin: "var(--space-2) 0" }} />

                  {/* Social links */}
                  <div style={{ display: "flex", gap: "var(--space-1)", padding: "var(--space-1) var(--space-2)" }}>
                    <a
                      href="https://t.me/launchrcommunity"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="glass-pill nav-icon-btn btn-press"
                      style={{ width: "var(--btn-md)", height: "var(--btn-md)", display: "flex", alignItems: "center", justifyContent: "center", textDecoration: "none", borderRadius: "var(--radius-sm)" }}
                      aria-label="Join Telegram"
                    >
                      <SvgTg />
                    </a>
                    <a
                      href="https://x.com/launchrapp"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="glass-pill nav-icon-btn btn-press"
                      style={{ width: "var(--btn-md)", height: "var(--btn-md)", display: "flex", alignItems: "center", justifyContent: "center", textDecoration: "none", borderRadius: "var(--radius-sm)" }}
                      aria-label="Follow on Twitter"
                    >
                      <SvgTw />
                    </a>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Connect Wallet - Primary CTA */}
          <button
            onClick={() => wallet.connected ? go('profile') : setShowWalletSelector(true)}
            className={wallet.connected ? "glass-pill" : "btn-premium-glow nav-connect-btn"}
            style={s(bpS, {
              height: "var(--btn-md)",
              padding: wallet.connected ? "0 var(--space-4)" : "0 var(--space-5)",
              fontSize: "var(--fs-base)",
              fontWeight: "var(--fw-semibold)",
              display: "flex",
              alignItems: "center",
              gap: "var(--space-2)",
              borderRadius: "var(--radius-md)"
            })}
          >
            {wallet.connected ? (
              <>
                <span style={{ width: 6, height: 6, borderRadius: "var(--radius-full)", background: "var(--grn)" }} />
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "var(--fs-sm)" }}>
                  {wallet.address?.slice(0, 4)}...{wallet.address?.slice(-4)}
                </span>
              </>
            ) : (
              <>
                <SvgWallet /> Connect
              </>
            )}
          </button>
        </div>
      </div>
    </nav>
  );

  // ---------------------------------------------------------------------------
  // FOOTER COMPONENT
  // ---------------------------------------------------------------------------

  const Foot = () => (
    <footer style={{
      borderTop: "1px solid var(--glass-border)",
      padding: "var(--space-5) var(--space-6)",
      position: "relative",
      zIndex: 1
    }}>
      <div style={{
        maxWidth: 1400,
        margin: "0 auto",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        flexWrap: "wrap",
        gap: "var(--space-3)"
      }}>
        <span style={{ fontSize: "var(--fs-xs)", color: "var(--t3)" }}>© 2026 Launchr</span>
        <div style={{ display: "flex", gap: "var(--space-5)", fontSize: "var(--fs-xs)" }}>
          <a
            href="https://docs.launchr.app"
            target="_blank"
            rel="noopener noreferrer"
            className="interactive-hover"
            style={{ color: "var(--t3)", textDecoration: "none", transition: "color 0.15s ease" }}
          >
            Docs
          </a>
          <a
            href="https://launchr.app/terms"
            target="_blank"
            rel="noopener noreferrer"
            className="interactive-hover"
            style={{ color: "var(--t3)", textDecoration: "none", transition: "color 0.15s ease" }}
          >
            Terms
          </a>
          <a
            href="https://launchr.app/privacy"
            target="_blank"
            rel="noopener noreferrer"
            className="interactive-hover"
            style={{ color: "var(--t3)", textDecoration: "none", transition: "color 0.15s ease" }}
          >
            Privacy
          </a>
        </div>
      </div>
    </footer>
  );

  // ---------------------------------------------------------------------------
  // HOME VIEW
  // ---------------------------------------------------------------------------

  const Home = () => (
    <div style={{
      minHeight: "calc(100vh - 112px)",
      display: "flex",
      alignItems: "center",
      position: "relative",
      zIndex: 1,
      padding: "var(--space-12) 0"
    }}>
      <div
        className="hero-grid"
        style={{
          maxWidth: 1400,
          margin: "0 auto",
          padding: "0 var(--space-6)",
          width: "100%"
        }}
      >
        {/* Left: Value prop & CTA */}
        <div style={ani("fu", 0)}>
          <h1 className="hero-heading" style={{ fontSize: "var(--fs-5xl)", fontWeight: "var(--fw-bold)", letterSpacing: -2, lineHeight: "var(--lh-tight)", color: "var(--t1)" }}>
            Launch into<br />
            <span style={{ display: "inline-flex", alignItems: "center", gap: "var(--space-3)", marginTop: 8 }}>
              <span style={{ width: 48, height: 48, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
                <SvgLogo size={48} variant="badge" />
              </span>
              Orbit
            </span>
          </h1>
          <p className="hero-subheading" style={s(ani("fu", 0.08), {
            marginTop: "var(--space-4)",
            fontSize: "var(--fs-lg)",
            lineHeight: "var(--lh-relaxed)",
            maxWidth: 400,
            color: "var(--t2)"
          })}>
            Fair-launch tokens with bonding curve pricing. No presales, no rugs. Just launch.
          </p>
          <div className="hero-buttons" style={s(ani("fu", 0.16), { display: "flex", alignItems: "center", gap: "var(--space-4)", marginTop: "var(--space-8)", flexWrap: "wrap" })}>
            <button
              onClick={() => go('create')}
              className="btn-press btn-premium-glow"
              style={s(bpS, { height: "var(--btn-lg)", padding: "0 var(--space-6)", fontSize: "var(--fs-md)", fontWeight: "var(--fw-semibold)", display: "flex", alignItems: "center", gap: "var(--space-2)" })}
            >
              <SvgPlus /> Launch Token
            </button>
            <button
              onClick={() => go('launches')}
              style={{
                background: "none",
                border: "none",
                color: "var(--t2)",
                fontSize: "var(--fs-md)",
                fontWeight: "var(--fw-medium)",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "var(--space-1-5)",
                padding: "var(--space-2) 0",
                transition: "color var(--transition-fast)"
              }}
              className="interactive-hover"
            >
              Explore Markets <span style={{ fontSize: "var(--fs-lg)" }}>→</span>
            </button>
          </div>
        </div>

        {/* Right: Stats */}
        <div className="glass-card hero-stats" style={s(ani("si", 0.1), { padding: "var(--space-8)" })}>
          <div className="stats-grid">
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: "var(--fs-4xl)", fontWeight: "var(--fw-bold)", color: "var(--t1)", fontFamily: "'JetBrains Mono', monospace" }}>
                <AnimatedNumber value={stats.totalLaunches} />
              </div>
              <div style={{ fontSize: "var(--fs-sm)", color: "var(--t3)", marginTop: "var(--space-1)", fontWeight: "var(--fw-medium)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                Launches
              </div>
            </div>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: "var(--fs-4xl)", fontWeight: "var(--fw-bold)", color: "var(--grn)", fontFamily: "'JetBrains Mono', monospace" }}>
                <AnimatedNumber value={stats.totalGraduated} />
              </div>
              <div style={{ fontSize: "var(--fs-sm)", color: "var(--t3)", marginTop: "var(--space-1)", fontWeight: "var(--fw-medium)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                Graduated
              </div>
            </div>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: "var(--fs-4xl)", fontWeight: "var(--fw-bold)", color: "var(--t1)", fontFamily: "'JetBrains Mono', monospace" }}>
                <AnimatedNumber value={stats.totalVolume / 1000} prefix="$" suffix="K" decimals={0} />
              </div>
              <div style={{ fontSize: "var(--fs-sm)", color: "var(--t3)", marginTop: "var(--space-1)", fontWeight: "var(--fw-medium)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                Volume
              </div>
            </div>
          </div>
          <div style={{ borderTop: "1px solid var(--glass-border)", marginTop: "var(--space-6)", paddingTop: "var(--space-5)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "var(--space-2)" }}>
              <span style={{ width: 6, height: 6, borderRadius: "var(--radius-full)", background: "var(--grn)" }} />
              <span style={{ fontSize: "var(--fs-base)", color: "var(--t2)" }}>Live on Devnet</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  // ---------------------------------------------------------------------------
  // LAUNCHES VIEW
  // ---------------------------------------------------------------------------

  const Launches = () => {
    const tabBtn = (k: string, l: string, badge?: string) => (
      <button
        key={k}
        onClick={() => setTab(k)}
        style={{
          padding: "var(--space-1) var(--space-4)",
          borderRadius: "var(--radius-full)",
          fontSize: "var(--fs-xs)",
          fontWeight: "var(--fw-medium)",
          cursor: "pointer",
          border: "none",
          transition: "all .15s",
          background: tab === k ? "var(--pb)" : "transparent",
          color: tab === k ? "var(--pt)" : "var(--t2)",
          fontFamily: "inherit",
          display: "flex",
          alignItems: "center",
          gap: "var(--space-1)"
        }}
      >
        {l}
        {badge && (
          <span style={{
            fontSize: "var(--fs-3xs)",
            padding: "2px var(--space-1)",
            borderRadius: "var(--radius-full)",
            background: tab === k ? "rgba(255,255,255,0.2)" : "var(--rb)",
            color: tab === k ? "var(--pt)" : "var(--red)",
            fontWeight: "var(--fw-semibold)",
            textTransform: "uppercase",
            letterSpacing: "0.03em"
          }}>
            {badge}
          </span>
        )}
      </button>
    );

    const srtBtn = (k: string, l: string) => (
      <button
        key={k}
        onClick={() => setSort(k)}
        style={{
          padding: "var(--space-1) var(--space-3)",
          borderRadius: "var(--radius-full)",
          fontSize: "var(--fs-xs)",
          fontWeight: "var(--fw-medium)",
          cursor: "pointer",
          border: "none",
          transition: "all .12s",
          background: sort === k ? "var(--glass3)" : "transparent",
          color: sort === k ? "var(--t1)" : "var(--t3)",
          fontFamily: "inherit"
        }}
      >
        {l}
      </button>
    );

    const thS: React.CSSProperties = {
      fontWeight: "var(--fw-semibold)",
      padding: "var(--space-2) 0",
      borderBottom: "1px solid var(--glass-border)",
      fontSize: "var(--fs-xs)",
      letterSpacing: "0.08em",
      color: "var(--t3)",
      textTransform: "uppercase"
    };

    return (
      <div style={{ maxWidth: 1400, margin: "0 auto", padding: "var(--space-10) var(--space-6)", position: "relative", zIndex: 1 }}>
        <div className="glass-card" style={s(ani("fu", 0), { padding: "var(--space-6) var(--space-7)" })}>
          <div style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            marginBottom: "var(--space-6)",
            flexWrap: "wrap",
            gap: "var(--space-4)"
          }}>
            <div>
              <h1 style={{ fontSize: "var(--fs-2xl)", fontWeight: "var(--fw-bold)", letterSpacing: "var(--ls-tight)", color: "var(--t1)" }}>Launches</h1>
              <p style={{ fontSize: "var(--fs-sm)", marginTop: "var(--space-1)", color: "var(--t2)", fontWeight: 400 }}>
                Explore live bonding curves and graduated tokens.
              </p>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
              <div style={s(inpS, {
                display: "flex",
                alignItems: "center",
                gap: "var(--space-2)",
                height: "var(--btn-md)",
                padding: "0 var(--space-4)",
                borderRadius: "var(--radius-full)",
                transition: "border-color 0.15s ease, box-shadow 0.15s ease"
              })}>
                <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="var(--t3)" strokeWidth={2} strokeLinecap="round">
                  <circle cx={11} cy={11} r={8} />
                  <path d="M21 21l-4.35-4.35" />
                </svg>
                <input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search tokens..."
                  style={{
                    border: "none",
                    background: "transparent",
                    padding: 0,
                    height: "100%",
                    width: 130,
                    fontSize: "var(--fs-sm)",
                    color: "var(--t1)",
                    outline: "none",
                    fontFamily: "inherit"
                  }}
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="interactive-hover"
                    aria-label="Clear search"
                    style={{
                      background: "var(--glass3)",
                      border: "none",
                      borderRadius: "50%",
                      width: 18,
                      height: 18,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      cursor: "pointer",
                      padding: 0
                    }}
                  >
                    <SvgX />
                  </button>
                )}
              </div>
              <Tooltip content="Refresh data" position="bottom">
                <button
                  onClick={handleRefresh}
                  className="glass-pill interactive-hover btn-press"
                  style={s(bsS, { width: "var(--btn-md)", height: "var(--btn-md)", padding: 0, display: "flex", alignItems: "center", justifyContent: "center" })}
                  aria-label="Refresh market data"
                >
                  <SvgRefresh spinning={isRefreshing} />
                </button>
              </Tooltip>
              <button
                onClick={() => go('create')}
                style={s(bpS, { height: "var(--btn-md)", padding: "0 var(--space-4)", fontSize: "var(--fs-sm)", display: "flex", alignItems: "center", gap: "var(--space-1)" })}
              >
                <SvgPlus /> Create
              </button>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", marginBottom: "var(--space-5)", flexWrap: "wrap" }}>
            <div style={{
              display: "flex",
              gap: "var(--space-1)",
              padding: "var(--space-1)",
              borderRadius: "var(--radius-full)",
              background: "var(--glass2)",
              backdropFilter: "blur(8px)",
              WebkitBackdropFilter: "blur(8px)"
            }}>
              {tabBtn("all", "All Markets")}
              {tabBtn("trending", "Trending", "hot")}
              {tabBtn("graduated", "Graduated")}
              {tabBtn("watchlist", `Watchlist (${watchlist.length})`)}
            </div>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="glass-pill"
              style={s(bsS, {
                height: "var(--btn-sm)",
                padding: "0 var(--space-4)",
                fontSize: "var(--fs-xs)",
                display: "flex",
                alignItems: "center",
                gap: "var(--space-1)",
                color: hasActiveFilters ? "var(--grn)" : "var(--t2)"
              })}
            >
              <SvgFilter />
              Filters
              {hasActiveFilters && (
                <span style={{
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  background: "var(--grn)"
                }} />
              )}
            </button>
          </div>
          {/* Advanced Filters Panel */}
          {showFilters && (
            <div className="glass-card-inner" style={s(ani("fu", 0), { padding: "var(--space-5)", marginBottom: "var(--space-5)", borderRadius: "var(--card-radius)" })}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--space-4)" }}>
                <h4 style={{ fontSize: "var(--fs-sm)", fontWeight: "var(--fw-semibold)", color: "var(--t1)" }}>Advanced Filters</h4>
                <div style={{ display: "flex", gap: "var(--space-2)" }}>
                  {hasActiveFilters && (
                    <button
                      onClick={clearFilters}
                      className="interactive-hover"
                      style={{ background: "none", border: "none", fontSize: "var(--fs-xs)", color: "var(--red)", cursor: "pointer", fontFamily: "inherit" }}
                    >
                      Clear All
                    </button>
                  )}
                  <button
                    onClick={() => setShowFilters(false)}
                    className="interactive-hover"
                    style={{ background: "none", border: "none", color: "var(--t3)", cursor: "pointer", padding: 0 }}
                  >
                    <SvgX />
                  </button>
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "var(--space-4)" }}>
                {/* Market Cap Filter */}
                <div>
                  <label style={{ fontSize: "var(--fs-xs)", fontWeight: "var(--fw-medium)", color: "var(--t3)", display: "block", marginBottom: "var(--space-1)" }}>MARKET CAP</label>
                  <div style={{ display: "flex", gap: "var(--space-2)", alignItems: "center" }}>
                    <input
                      type="number"
                      placeholder="Min"
                      value={filters.minMarketCap || ''}
                      onChange={(e) => setFilters(prev => ({ ...prev, minMarketCap: e.target.value ? parseFloat(e.target.value) : null }))}
                      style={s(inpS, { width: "100%", height: "var(--btn-sm)", padding: "0 var(--space-2)", fontSize: "var(--fs-xs)", fontFamily: "inherit" })}
                    />
                    <span style={{ color: "var(--t3)", fontSize: "var(--fs-xs)" }}>to</span>
                    <input
                      type="number"
                      placeholder="Max"
                      value={filters.maxMarketCap || ''}
                      onChange={(e) => setFilters(prev => ({ ...prev, maxMarketCap: e.target.value ? parseFloat(e.target.value) : null }))}
                      style={s(inpS, { width: "100%", height: "var(--btn-sm)", padding: "0 var(--space-2)", fontSize: "var(--fs-xs)", fontFamily: "inherit" })}
                    />
                  </div>
                </div>
                {/* Holders Filter */}
                <div>
                  <label style={{ fontSize: "var(--fs-xs)", fontWeight: "var(--fw-medium)", color: "var(--t3)", display: "block", marginBottom: "var(--space-1)" }}>HOLDERS</label>
                  <div style={{ display: "flex", gap: "var(--space-2)", alignItems: "center" }}>
                    <input
                      type="number"
                      placeholder="Min"
                      value={filters.minHolders || ''}
                      onChange={(e) => setFilters(prev => ({ ...prev, minHolders: e.target.value ? parseInt(e.target.value) : null }))}
                      style={s(inpS, { width: "100%", height: "var(--btn-sm)", padding: "0 var(--space-2)", fontSize: "var(--fs-xs)", fontFamily: "inherit" })}
                    />
                    <span style={{ color: "var(--t3)", fontSize: "var(--fs-xs)" }}>to</span>
                    <input
                      type="number"
                      placeholder="Max"
                      value={filters.maxHolders || ''}
                      onChange={(e) => setFilters(prev => ({ ...prev, maxHolders: e.target.value ? parseInt(e.target.value) : null }))}
                      style={s(inpS, { width: "100%", height: "var(--btn-sm)", padding: "0 var(--space-2)", fontSize: "var(--fs-xs)", fontFamily: "inherit" })}
                    />
                  </div>
                </div>
                {/* Age Filter */}
                <div>
                  <label style={{ fontSize: "var(--fs-xs)", fontWeight: "var(--fw-medium)", color: "var(--t3)", display: "block", marginBottom: "var(--space-1)" }}>AGE (hours)</label>
                  <div style={{ display: "flex", gap: "var(--space-2)", alignItems: "center" }}>
                    <input
                      type="number"
                      placeholder="Min"
                      value={filters.minAge || ''}
                      onChange={(e) => setFilters(prev => ({ ...prev, minAge: e.target.value ? parseFloat(e.target.value) : null }))}
                      style={s(inpS, { width: "100%", height: "var(--btn-sm)", padding: "0 var(--space-2)", fontSize: "var(--fs-xs)", fontFamily: "inherit" })}
                    />
                    <span style={{ color: "var(--t3)", fontSize: "var(--fs-xs)" }}>to</span>
                    <input
                      type="number"
                      placeholder="Max"
                      value={filters.maxAge || ''}
                      onChange={(e) => setFilters(prev => ({ ...prev, maxAge: e.target.value ? parseFloat(e.target.value) : null }))}
                      style={s(inpS, { width: "100%", height: "var(--btn-sm)", padding: "0 var(--space-2)", fontSize: "var(--fs-xs)", fontFamily: "inherit" })}
                    />
                  </div>
                </div>
              </div>
              {/* Quick Filter Presets */}
              <div style={{ display: "flex", gap: "var(--space-2)", marginTop: "var(--space-4)" }}>
                <button
                  onClick={() => setFilters({ minMarketCap: null, maxMarketCap: 10000, minAge: null, maxAge: null, minHolders: null, maxHolders: null })}
                  className="glass-pill"
                  style={s(bsS, { height: "var(--btn-sm)", padding: "0 var(--space-3)", fontSize: "var(--fs-xs)" })}
                >
                  Low MCap (&lt;$10K)
                </button>
                <button
                  onClick={() => setFilters({ minMarketCap: null, maxMarketCap: null, minAge: null, maxAge: 24, minHolders: null, maxHolders: null })}
                  className="glass-pill"
                  style={s(bsS, { height: "var(--btn-sm)", padding: "0 var(--space-3)", fontSize: "var(--fs-xs)" })}
                >
                  New (&lt;24h)
                </button>
                <button
                  onClick={() => setFilters({ minMarketCap: null, maxMarketCap: null, minAge: null, maxAge: null, minHolders: 100, maxHolders: null })}
                  className="glass-pill"
                  style={s(bsS, { height: "var(--btn-sm)", padding: "0 var(--space-3)", fontSize: "var(--fs-xs)" })}
                >
                  100+ Holders
                </button>
              </div>
            </div>
          )}
          {tab === "all" && (
            <div style={{ display: "flex", gap: "var(--space-1)", marginBottom: "var(--space-4)" }}>
              {srtBtn("volume", "Volume")}
              {srtBtn("newest", "Newest")}
              {srtBtn("mcap", "Market Cap")}
              {srtBtn("progress", "Progress")}
            </div>
          )}
          <div style={{ overflowX: "auto" }} className="table-wrapper">
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={s(thS, { textAlign: "center", width: 36 })}></th>
                  <th style={s(thS, { textAlign: "left" })}>Token</th>
                  <th style={s(thS, { textAlign: "right" })}>Price</th>
                  <th style={s(thS, { textAlign: "right" })}>24h</th>
                  <th style={s(thS, { textAlign: "right" })}>MCap</th>
                  <th style={s(thS, { textAlign: "right", width: 140 })}>Progress</th>
                </tr>
              </thead>
              <tbody>
                {/* Loading skeleton rows */}
                {launchesLoading && [...Array(6)].map((_, i) => (
                  <tr key={`skeleton-${i}`} className="skeleton-loading" style={{ borderBottom: "1px solid var(--glass-border)" }}>
                    <td style={{ padding: "12px 0", textAlign: "center" }}>
                      <Skeleton width={18} height={18} borderRadius={4} />
                    </td>
                    <td style={{ padding: "12px 0" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2-5)" }}>
                        <Skeleton width={32} height={32} borderRadius={10} />
                        <div>
                          <Skeleton width={80} height={13} />
                          <div style={{ marginTop: 4 }}><Skeleton width={40} height={10} /></div>
                        </div>
                      </div>
                    </td>
                    <td style={{ textAlign: "right" }}><Skeleton width={60} height={13} /></td>
                    <td style={{ textAlign: "right" }}><Skeleton width={50} height={13} /></td>
                    <td style={{ textAlign: "right" }}><Skeleton width={50} height={13} /></td>
                    <td style={{ textAlign: "right" }}><Skeleton width={100} height={6} /></td>
                  </tr>
                ))}
                {/* Actual data rows */}
                {!launchesLoading && filteredLaunches.map((l, i) => (
                  <tr
                    key={l.id}
                    onClick={() => go('detail', l)}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go('detail', l); }}}
                    tabIndex={0}
                    aria-label={`View ${l.name} token details`}
                    className="hoverable stagger-item table-row-hover stagger-reveal"
                    style={{
                      cursor: "pointer",
                      borderBottom: "1px solid var(--glass-border)",
                    }}
                  >
                    <td style={{ padding: "12px 0", textAlign: "center" }}>
                      <button
                        onClick={(e) => toggleWatchlist(l.id, e)}
                        className="star-btn interactive-hover"
                        aria-label={isWatchlisted(l.id) ? `Remove ${l.symbol} from watchlist` : `Add ${l.symbol} to watchlist`}
                        style={{
                          background: "none",
                          border: "none",
                          cursor: "pointer",
                          color: isWatchlisted(l.id) ? "var(--amb)" : "var(--t3)",
                          padding: "var(--space-1)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          transition: "color .15s, transform .15s"
                        }}
                      >
                        <SvgStar filled={isWatchlisted(l.id)} />
                      </button>
                    </td>
                    <td style={{ padding: "12px 0" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2-5)" }}>
                        <Avatar gi={l.gi} size={32} imageUrl={getTokenImageUrl(l.publicKey)} symbol={l.symbol} />
                        <div>
                          <div style={{ fontWeight: "var(--fw-medium)", fontSize: "var(--fs-base)", color: "var(--t1)" }}>{l.name}</div>
                          <div style={{ fontSize: "var(--fs-xs)", color: "var(--t3)" }}>{l.symbol}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ textAlign: "right", fontSize: "var(--fs-base)", color: "var(--t1)", fontWeight: "var(--fw-medium)", fontFamily: "'JetBrains Mono',monospace" }}>
                      {fP(l.price)}
                    </td>
                    <td style={{ textAlign: "right" }}><Chg v={l.priceChange24h} /></td>
                    <td style={{ textAlign: "right", fontSize: "var(--fs-base)", color: "var(--t2)" }}>{fm(l.marketCap)}</td>
                    <td style={{ textAlign: "right", padding: "12px 0" }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "var(--space-2)" }}>
                        <div style={{ width: 80, height: 6, borderRadius: 3, overflow: "hidden", background: "var(--glass2)" }}>
                          <div
                            className="progress-animate"
                            style={{
                              width: `${Math.min(l.progress, 100)}%`,
                              height: "100%",
                              borderRadius: 3,
                              background: l.progress >= 95 ? "var(--amb)" : "var(--grn)",
                            }}
                          />
                        </div>
                        <span style={{ fontSize: "var(--fs-xs)", fontFamily: "'JetBrains Mono',monospace", color: "var(--t3)", minWidth: 32, textAlign: "right" }}>
                          {l.progress}%
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {/* Floating Action Button */}
          <Tooltip content="Create new launch" position="left">
            <button
              onClick={() => go('create')}
              className="fab-button btn-premium-glow ripple-container"
              style={{
                position: 'fixed',
                bottom: 32,
                right: 32,
                width: 56,
                height: 56,
                borderRadius: "var(--radius-md)",
                background: 'linear-gradient(135deg, #34d399, #16A34A)',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                zIndex: 40,
                boxShadow: '0 8px 32px rgba(34, 197, 94, 0.4)',
              }}
            >
              <SvgPlus />
            </button>
          </Tooltip>
          {/* Empty States */}
          {filteredLaunches.length === 0 && tab === "watchlist" && (
            <div className="empty-state" style={{ textAlign: "center", padding: "var(--space-16) var(--space-5)" }}>
              <div style={{ marginBottom: "var(--space-4)", color: "var(--t3)" }}><EmptyStateIcon type="star" size={48} /></div>
              <h3 style={{ fontSize: "var(--fs-lg)", fontWeight: "var(--fw-semibold)", color: "var(--t1)", marginBottom: "var(--space-2)" }}>No tokens in watchlist</h3>
              <p style={{ fontSize: "var(--fs-sm)", color: "var(--t2)", marginBottom: "var(--space-5)" }}>
                Click the star icon on any token to add it to your watchlist
              </p>
              <button
                onClick={() => setTab("all")}
                className="btn-press btn-glow"
                style={s(bpS, { height: "var(--btn-md)", padding: "0 var(--space-6)", fontSize: "var(--fs-sm)" })}
              >
                Browse All Tokens
              </button>
            </div>
          )}
          {filteredLaunches.length === 0 && tab !== "watchlist" && searchQuery && (
            <div className="empty-state" style={{ textAlign: "center", padding: "var(--space-16) var(--space-5)" }}>
              <div style={{ marginBottom: "var(--space-4)", color: "var(--t3)" }}><EmptyStateIcon type="search" size={48} /></div>
              <h3 style={{ fontSize: "var(--fs-lg)", fontWeight: "var(--fw-semibold)", color: "var(--t1)", marginBottom: "var(--space-2)" }}>No results found</h3>
              <p style={{ fontSize: "var(--fs-sm)", color: "var(--t2)", marginBottom: "var(--space-5)" }}>
                No tokens match "{searchQuery}"
              </p>
              <button
                onClick={() => setSearchQuery('')}
                style={s(bsS, { height: "var(--btn-md)", padding: "0 var(--space-6)", fontSize: "var(--fs-sm)" })}
                className="glass-pill"
              >
                Clear Search
              </button>
            </div>
          )}
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: "var(--space-4)", fontSize: "var(--fs-xs)", color: "var(--t3)" }}>
            <span>{filteredLaunches.length} {filteredLaunches.length === 1 ? 'launch' : 'launches'}</span>
            <span>{tab === "watchlist" ? "Watchlist" : tab === "graduated" ? "Graduated" : tab === "trending" ? "Trending" : "All markets"}</span>
          </div>
        </div>
      </div>
    );
  };

  // ---------------------------------------------------------------------------
  // DETAIL VIEW
  // ---------------------------------------------------------------------------

  const Detail = () => {
    if (route.type !== 'detail') return null;
    const l = route.launch;

    // Fetch real chart data
    const [chartTimeframe, setChartTimeframe] = useState<'1H' | '4H' | '1D' | '7D' | '30D'>('1D');
    const { candles, loading: chartLoading } = useLaunchChart(l?.publicKey, chartTimeframe);

    const thS2: React.CSSProperties = {
      fontWeight: "var(--fw-semibold)",
      padding: "7px 0",
      borderBottom: "1px solid var(--glass-border)",
      fontSize: "var(--fs-2xs)",
      letterSpacing: 0.8,
      color: "var(--t3)",
      textTransform: "uppercase"
    };

    return (
      <div style={{ maxWidth: 1400, margin: "0 auto", padding: "var(--space-9) var(--space-6)", position: "relative", zIndex: 1 }}>
        <button
          onClick={() => go('launches')}
          className="interactive-hover"
          aria-label="Back to launches"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "var(--space-2)",
            fontSize: "var(--fs-base)",
            color: "var(--t2)",
            background: "none",
            border: "none",
            cursor: "pointer",
            marginBottom: "var(--space-5-5)",
            padding: 0,
            fontFamily: "inherit"
          }}
        >
          <SvgBack /> Back to Launches
        </button>
        <div className="detail-grid" style={{ display: "grid", gridTemplateColumns: "1fr 360px", gap: "var(--space-5-5)", alignItems: "start" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-5-5)" }}>
            <div className="glass-card" style={s(ani("fu", 0), { padding: "var(--space-6)" })}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
                  <div style={{ animation: "pg 3s ease-in-out infinite", borderRadius: "35%" }}>
                    <Avatar gi={l.gi} size={48} imageUrl={getTokenImageUrl(l.publicKey)} symbol={l.symbol} />
                  </div>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
                      <h1 style={{ fontSize: "var(--fs-2xl)", fontWeight: "var(--fw-bold)", color: "var(--t1)" }}>{l.name}</h1>
                      <Badge status={l.status} isDark={isDark} />
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", fontSize: "var(--fs-sm)", color: "var(--t3)", marginTop: 2 }}>
                      <span>{l.symbol} · {l.creator}</span>
                      <Tooltip content="Copy token address" position="top">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            navigator.clipboard.writeText(l.publicKey);
                            showToast('Token address copied', 'success');
                          }}
                          className="interactive-hover btn-press"
                          aria-label="Copy token address"
                          style={{
                            background: "none",
                            border: "none",
                            cursor: "pointer",
                            padding: "var(--space-1)",
                            color: "var(--t3)",
                            display: "flex",
                            alignItems: "center",
                            borderRadius: "var(--radius-xs)"
                          }}
                        >
                          <SvgCopy />
                        </button>
                      </Tooltip>
                      <Tooltip content="View on Solscan" position="top">
                        <a
                          href={`https://solscan.io/token/${l.publicKey}?cluster=devnet`}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="interactive-hover"
                          aria-label="View on Solscan"
                          style={{ color: "var(--t3)", display: "flex", alignItems: "center", padding: "var(--space-1)", borderRadius: "var(--radius-xs)" }}
                        >
                          <SvgExternal />
                        </a>
                      </Tooltip>
                    </div>
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "flex-start", gap: "var(--space-3)" }}>
                  <div style={{ display: "flex", gap: "var(--space-1-5)" }}>
                    <Tooltip content={isWatchlisted(l.id) ? "Remove from watchlist" : "Add to watchlist"} position="bottom">
                      <button
                        onClick={(e) => { e.stopPropagation(); toggleWatchlist(l.id); }}
                        className="glass-pill interactive-hover btn-press"
                        style={s(bsS, {
                          width: 36,
                          height: 36,
                          padding: 0,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: isWatchlisted(l.id) ? "var(--amb)" : "var(--t2)"
                        })}
                        aria-label={isWatchlisted(l.id) ? `Remove ${l.symbol} from watchlist` : `Add ${l.symbol} to watchlist`}
                      >
                        <SvgStar filled={isWatchlisted(l.id)} />
                      </button>
                    </Tooltip>
                    <Tooltip content="Share token" position="bottom">
                      <button
                        onClick={() => setShareModal(l)}
                        className="glass-pill interactive-hover btn-press"
                        style={s(bsS, { width: 36, height: 36, padding: 0, display: "flex", alignItems: "center", justifyContent: "center" })}
                        aria-label={`Share ${l.symbol} token`}
                      >
                        <SvgShare />
                      </button>
                    </Tooltip>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: "var(--fs-3xl)", fontWeight: "var(--fw-bold)", fontFamily: "'JetBrains Mono',monospace", color: "var(--t1)" }}>
                      {fP(l.price)}
                    </div>
                    <Chg v={l.priceChange24h} />
                  </div>
                </div>
              </div>
              <div style={s(ani("fu", 0.06), { display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: "var(--space-2-5)", marginTop: 22 })} className="grid-stagger">
                {[
                  { l: "Market Cap", v: fm(l.marketCap), icon: <SvgChart /> },
                  { l: "24h Volume", v: fm(l.volume24h), icon: <SvgActivity /> },
                  { l: "Holders", v: l.holders.toLocaleString(), icon: <SvgUser /> },
                  { l: "Trades", v: l.trades.toLocaleString(), icon: <SvgZap /> }
                ].map((x) => (
                  <HoverCard key={x.l} className="glass-card-inner" style={{ padding: 12 }} glowColor="rgba(34, 197, 94, 0.1)">
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                      <span style={{ fontSize: "var(--fs-xs)", color: "var(--t3)", fontWeight: "var(--fw-medium)" }}>{x.l}</span>
                      <span style={{ color: "var(--t3)", opacity: 0.6 }}>{x.icon}</span>
                    </div>
                    <div style={{ fontSize: "var(--fs-lg)", fontWeight: "var(--fw-semibold)", color: "var(--t1)" }}>{x.v}</div>
                  </HoverCard>
                ))}
              </div>
              <div style={s(ani("fu", 0.1), { marginTop: 22 })}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
                    <span style={{ fontSize: "var(--fs-sm)", color: "var(--t2)", fontWeight: "var(--fw-medium)" }}>Graduation Progress</span>
                    {l.progress >= 90 && <PulseDot color="var(--amb)" size={6} />}
                  </div>
                  <span style={{ fontSize: "var(--fs-sm)", fontFamily: "'JetBrains Mono',monospace", color: "var(--t1)" }}>{l.progress}% / 85 SOL</span>
                </div>
                <GradientProgress value={l.progress} height={8} showGlow={true} />
                {l.progress >= 90 && (
                  <div style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "var(--space-1-5)",
                    marginTop: 10,
                    padding: "8px 12px",
                    borderRadius: "var(--radius-md)",
                    background: "rgba(251, 191, 36, 0.1)",
                    border: "1px solid rgba(251, 191, 36, 0.2)"
                  }}>
                    <SvgFire />
                    <span style={{ fontSize: "var(--fs-xs)", color: "var(--amb)", fontWeight: "var(--fw-medium)" }}>Almost graduated! Token will move to Orbit DLMM soon.</span>
                  </div>
                )}
              </div>
            </div>
            {/* Price Chart - Institutional Grade */}
            <div className="glass-card" style={s(ani("fu", 0.08), { padding: 0, overflow: "hidden" })}>
              {/* Chart Header */}
              <div style={{ padding: "var(--space-5) var(--space-6)", borderBottom: "1px solid var(--glass-border)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--space-4)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
                    <SvgChart />
                    <span style={{ fontSize: "var(--fs-md)", fontWeight: "var(--fw-semibold)", color: "var(--t1)" }}>Price Chart</span>
                    <UpdatePulse show={true} />
                  </div>
                  <div style={{ display: "flex", gap: "var(--space-1)", alignItems: "center" }}>
                    {/* Chart type toggle */}
                    <div style={{ display: "flex", padding: 2, borderRadius: "var(--radius-sm)", background: "var(--glass2)", marginRight: 8 }}>
                      {[
                        { key: 'candle', icon: <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><rect x="8" y="6" width="4" height="12"/><line x1="10" y1="2" x2="10" y2="6"/><line x1="10" y1="18" x2="10" y2="22"/><rect x="16" y="10" width="4" height="6"/><line x1="18" y1="6" x2="18" y2="10"/><line x1="18" y1="16" x2="18" y2="20"/></svg> },
                        { key: 'line', icon: <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><polyline points="22 12 18 8 12 14 8 10 2 16"/></svg> },
                        { key: 'area', icon: <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M22 12 L18 8 L12 14 L8 10 L2 16 L2 20 L22 20 Z"/></svg> }
                      ].map((ct) => (
                        <button
                          key={ct.key}
                          className="btn-press"
                          style={{
                            padding: "5px 8px",
                            borderRadius: "var(--radius-xs)",
                            border: "none",
                            background: settings.chartType === ct.key ? "var(--pb)" : "transparent",
                            color: settings.chartType === ct.key ? "var(--pt)" : "var(--t3)",
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center"
                          }}
                          onClick={() => setSettings(prev => ({ ...prev, chartType: ct.key as 'candle' | 'line' | 'area' }))}
                        >
                          {ct.icon}
                        </button>
                      ))}
                    </div>
                    {/* Timeframe pills */}
                    {(["1H", "4H", "1D", "7D", "30D"] as const).map((tf) => (
                      <button
                        key={tf}
                        onClick={() => setChartTimeframe(tf)}
                        className="glass-pill interactive-hover btn-press"
                        style={s(bsS, {
                          height: 26,
                          padding: "0 10px",
                          fontSize: "var(--fs-2xs)",
                          fontWeight: "var(--fw-medium)",
                          background: chartTimeframe === tf ? 'var(--pb)' : 'var(--sb)',
                          color: chartTimeframe === tf ? 'var(--pt)' : 'var(--st)'
                        })}
                      >
                        {tf}
                      </button>
                    ))}
                  </div>
                </div>

                {/* OHLC Data Bar */}
                <div style={{ display: "flex", gap: "var(--space-4)", flexWrap: "wrap" }}>
                  {[
                    { label: "Open", value: fP(l.price * 0.95), color: "var(--t1)" },
                    { label: "High", value: fP(l.price * 1.12), color: "var(--grn)" },
                    { label: "Low", value: fP(l.price * 0.88), color: "var(--red)" },
                    { label: "Close", value: fP(l.price), color: "var(--t1)" },
                    { label: "Change", value: fPct(15.3), color: "var(--grn)" },
                    { label: "Vol", value: fSOL(l.volume24h, false), color: "var(--t1)" }
                  ].map((stat) => (
                    <div key={stat.label} style={{ display: "flex", alignItems: "center", gap: "var(--space-1-5)" }}>
                      <span style={{ fontSize: "var(--fs-2xs)", color: "var(--t3)", fontWeight: "var(--fw-medium)" }}>{stat.label}:</span>
                      <span style={{ fontSize: "var(--fs-xs)", color: stat.color, fontWeight: "var(--fw-semibold)", fontFamily: "'JetBrains Mono', monospace" }}>
                        {stat.value}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Chart Area */}
              <div style={{ padding: "var(--space-5) var(--space-6)" }}>
                <PriceChart
                  data={candles}
                  chartType={settings.chartType}
                  height={280}
                  loading={chartLoading}
                />
              </div>

              {/* Chart Footer / Legend */}
              <div style={{
                padding: "12px 24px",
                borderTop: "1px solid var(--glass-border)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center"
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: "var(--space-4)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "var(--space-1-5)" }}>
                    <span style={{ width: 12, height: 3, background: "var(--grn)", borderRadius: 1 }} />
                    <span style={{ fontSize: "var(--fs-2xs)", color: "var(--t3)" }}>Price</span>
                  </div>
                  {settings.showIndicators && (
                    <>
                      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-1-5)" }}>
                        <span style={{ width: 12, height: 3, background: "var(--amb)", borderRadius: 1 }} />
                        <span style={{ fontSize: "var(--fs-2xs)", color: "var(--t3)" }}>MA(7)</span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-1-5)" }}>
                        <span style={{ width: 12, height: 3, background: "var(--grn)", borderRadius: 1, opacity: 0.5 }} />
                        <span style={{ fontSize: "var(--fs-2xs)", color: "var(--t3)" }}>Volume</span>
                      </div>
                    </>
                  )}
                </div>
                <button
                  onClick={() => setSettings(prev => ({ ...prev, showIndicators: !prev.showIndicators }))}
                  className="glass-pill btn-press interactive-hover"
                  style={s(bsS, { height: 24, padding: "0 10px", fontSize: "var(--fs-3xs)", fontWeight: "var(--fw-medium)" })}
                >
                  {settings.showIndicators ? 'Hide' : 'Show'} Indicators
                </button>
              </div>
            </div>
            <div className="glass-card" style={s(ani("fu", 0.12), { padding: 24 })}>
              <div style={{
                display: "flex",
                gap: "var(--space-0-5)",
                padding: "var(--space-0-5)",
                borderRadius: "var(--radius-full)",
                width: "fit-content",
                marginBottom: "var(--space-4)",
                background: "var(--glass2)"
              }}>
                {["trades", "holders"].map((x) => (
                  <button
                    key={x}
                    onClick={() => setDetailTab(x)}
                    className="interactive-hover btn-press"
                    style={{
                      padding: "var(--space-1-5) var(--space-4)",
                      borderRadius: "var(--radius-full)",
                      fontSize: "var(--fs-sm)",
                      fontWeight: "var(--fw-medium)",
                      cursor: "pointer",
                      border: "none",
                      textTransform: "capitalize",
                      transition: "all .15s",
                      background: detailTab === x ? "var(--pb)" : "transparent",
                      color: detailTab === x ? "var(--pt)" : "var(--t2)",
                      fontFamily: "inherit"
                    }}
                  >
                    {x}
                  </button>
                ))}
              </div>
              <TabContent tabKey={detailTab}>
                {detailTab === "trades" ? (
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr>
                        <th style={s(thS2, { textAlign: "left" })}>Type</th>
                        <th style={s(thS2, { textAlign: "left" })}>Trader</th>
                        <th style={s(thS2, { textAlign: "right" })}>SOL</th>
                        <th style={s(thS2, { textAlign: "right" })}>Tokens</th>
                        <th style={s(thS2, { textAlign: "right" })}>Time</th>
                      </tr>
                    </thead>
                    <tbody>
                      {trades.map((r, i) => (
                        <tr key={r.id} className="table-row-hover" style={s(ani("fu", i * 0.03), { borderBottom: "1px solid var(--glass-border)" })}>
                          <td style={{ padding: "10px 0" }}>
                            <span style={{
                              fontSize: "var(--fs-xs)",
                              fontWeight: "var(--fw-semibold)",
                              padding: "3px 8px",
                              borderRadius: "var(--radius-xs)",
                              background: r.type === "buy" ? "var(--gb)" : "var(--rb)",
                              color: r.type === "buy" ? "var(--grn)" : "var(--red)"
                            }}>
                              {r.type.toUpperCase()}
                            </span>
                          </td>
                          <td style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "var(--fs-sm)", color: "var(--t2)" }}>{r.trader}</td>
                          <td style={{ textAlign: "right", fontFamily: "'JetBrains Mono',monospace", fontSize: "var(--fs-base)", color: "var(--t1)" }}>{r.sol}</td>
                          <td style={{ textAlign: "right", fontFamily: "'JetBrains Mono',monospace", fontSize: "var(--fs-base)", color: "var(--t2)" }}>{r.tokens}</td>
                          <td style={{ textAlign: "right", fontSize: "var(--fs-sm)", color: "var(--t3)" }}>{r.time}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : launchHolders.length > 0 ? (
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                      <span style={{ fontSize: "var(--fs-sm)", color: "var(--t3)" }}>
                        {totalHolders.toLocaleString()} total holders
                      </span>
                    </div>
                    <table style={{ width: "100%", borderCollapse: "collapse" }}>
                      <thead>
                        <tr>
                          <th style={s(thS2, { textAlign: "left", width: 40 })}>#</th>
                          <th style={s(thS2, { textAlign: "left" })}>Address</th>
                          <th style={s(thS2, { textAlign: "right" })}>Balance</th>
                          <th style={s(thS2, { textAlign: "right" })}>\%</th>
                        </tr>
                      </thead>
                      <tbody>
                        {launchHolders.slice(0, 20).map((holder, i) => (
                          <tr
                            key={holder.address}
                            className="table-row-hover"
                            style={s(ani("fu", i * 0.03), { borderBottom: "1px solid var(--glass-border)" })}
                          >
                            <td style={{ padding: "10px 0", fontSize: "var(--fs-sm)", color: "var(--t3)" }}>
                              {holder.rank || i + 1}
                            </td>
                            <td style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "var(--fs-sm)", color: "var(--t2)" }}>
                              {holder.address.slice(0, 4)}...{holder.address.slice(-4)}
                            </td>
                            <td style={{ textAlign: "right", fontFamily: "'JetBrains Mono',monospace", fontSize: "var(--fs-base)", color: "var(--t1)" }}>
                              {fN(holder.balance / 1e6, 2)}M
                            </td>
                            <td style={{ textAlign: "right", fontSize: "var(--fs-sm)", color: "var(--t2)" }}>
                              {holder.percentage.toFixed(2)}%
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div style={{ padding: "var(--space-10) 0", textAlign: "center" }}>
                    <div style={{ marginBottom: "var(--space-3)", color: "var(--t3)" }}><EmptyStateIcon type="users" size={48} /></div>
                    <p style={{ fontSize: "var(--fs-sm)", color: "var(--t3)" }}>Loading holder data...</p>
                  </div>
                )}
              </TabContent>
            </div>
          </div>
          <div className="detail-sidebar" style={{ position: "sticky", top: 72 }}>
            <div
              className={`glass-card ${tradeSuccess ? 'trade-success' : ''}`}
              style={s(ani("si", 0.06), {
                padding: "var(--space-5)",
                borderColor: tradeSuccess ? 'var(--grn)' : undefined,
                transition: 'border-color var(--transition-default)'
              })}
            >
              {/* Amount Input - Primary Focus */}
              <div style={{ marginBottom: "var(--space-4)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--space-2)" }}>
                  <span style={{ fontSize: "var(--fs-sm)", color: "var(--t2)", fontWeight: "var(--fw-medium)" }}>{tradeType === "buy" ? "You pay" : "You sell"}</span>
                  {wallet.connected && (
                    <span style={{ fontSize: "var(--fs-xs)", color: "var(--t3)" }}>
                      {tradeType === "buy" ? `${wallet.balance?.toFixed(2)} SOL` : `${userBalances?.tokenBalance ? (userBalances.tokenBalance / 1e6).toFixed(2) + "M" : "0"} ${l.symbol}`}
                    </span>
                  )}
                </div>
                <div className="amount-input-wrapper input-focus-glow" style={s(inpS, { display: "flex", alignItems: "center", gap: "var(--space-2)", height: 56, padding: "0 var(--space-4)", borderRadius: "var(--radius-lg)" })}>
                  <input
                    type="number"
                    value={tradeAmount}
                    onChange={(e) => setTradeAmount(e.target.value)}
                    placeholder="0.00"
                    style={{
                      flex: 1,
                      border: "none",
                      background: "transparent",
                      padding: 0,
                      height: "100%",
                      fontSize: "var(--fs-3xl)",
                      fontFamily: "'JetBrains Mono',monospace",
                      color: "var(--t1)",
                      outline: "none"
                    }}
                  />
                  <span style={{ fontSize: "var(--fs-md)", fontWeight: "var(--fw-semibold)", color: "var(--t2)" }}>
                    {tradeType === "buy" ? "SOL" : l.symbol}
                  </span>
                </div>
              </div>

              {/* Quick percentages */}
              <div style={{ display: "flex", gap: "var(--space-1)", marginBottom: "var(--space-4)" }}>
                {[25, 50, 75, 100].map((pct) => {
                  const maxBalance = tradeType === "buy" ? (wallet.balance || 0) : (userBalances?.tokenBalance ? userBalances.tokenBalance / 1e6 : 0);
                  const isActive = tradeAmount && Math.abs(parseFloat(tradeAmount) - (maxBalance * pct) / 100) < 0.01;
                  return (
                    <button
                      key={pct}
                      onClick={() => setTradeAmount(((maxBalance * pct) / 100).toFixed(2))}
                      className="glass-pill"
                      style={{
                        flex: 1,
                        padding: "var(--space-2) 0",
                        fontSize: "var(--fs-xs)",
                        fontWeight: "var(--fw-medium)",
                        border: "none",
                        cursor: "pointer",
                        background: isActive ? "var(--glass3)" : "var(--glass2)",
                        color: isActive ? "var(--t1)" : "var(--t3)",
                        borderRadius: "var(--radius-sm)"
                      }}
                    >
                      {pct}%
                    </button>
                  );
                })}
              </div>

              {/* Buy/Sell toggle - Secondary */}
              <div style={{ display: "flex", gap: 2, padding: 2, borderRadius: "var(--radius-md)", marginBottom: "var(--space-4)", background: "var(--glass2)" }}>
                {(["buy", "sell"] as const).map((x) => (
                  <button
                    key={x}
                    onClick={() => setTradeType(x)}
                    style={{
                      flex: 1,
                      padding: "var(--space-3) 0",
                      borderRadius: "var(--radius-sm)",
                      fontSize: "var(--fs-base)",
                      fontWeight: "var(--fw-semibold)",
                      cursor: "pointer",
                      border: "none",
                      textTransform: "capitalize",
                      transition: "all var(--transition-fast)",
                      fontFamily: "inherit",
                      background: tradeType === x ? (x === "buy" ? "var(--grn)" : "var(--red)") : "transparent",
                      color: tradeType === x ? "#fff" : "var(--t3)"
                    }}
                  >
                    {x}
                  </button>
                ))}
              </div>

              {/* Output preview */}
              <div style={{ marginBottom: "var(--space-4)", padding: "var(--space-3)", borderRadius: "var(--radius-md)", background: "var(--glass)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--space-2)" }}>
                  <span style={{ fontSize: "var(--fs-sm)", color: "var(--t3)" }}>You receive</span>
                  <span style={{ fontSize: "var(--fs-lg)", fontFamily: "'JetBrains Mono',monospace", fontWeight: "var(--fw-semibold)", color: "var(--t1)" }}>
                    {tradeAmount && l.price > 0
                      ? tradeType === "buy"
                        ? ((parseFloat(tradeAmount) / l.price) * (1 - settings.defaultSlippage / 100)).toFixed(0) + "M " + l.symbol
                        : (parseFloat(tradeAmount) * l.price * (1 - settings.defaultSlippage / 100) / 1e6).toFixed(4) + " SOL"
                      : `0.00 ${tradeType === "buy" ? l.symbol : "SOL"}`
                    }
                  </span>
                </div>
                {/* Transaction Details - Solana-specific info */}
                <div style={{ borderTop: "1px solid var(--glass-border)", paddingTop: "var(--space-2)", marginTop: "var(--space-2)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--space-1)" }}>
                    <span style={{ fontSize: "var(--fs-xs)", color: "var(--t3)" }}>Network fee</span>
                    <span style={{ fontSize: "var(--fs-xs)", fontFamily: "'JetBrains Mono',monospace", color: "var(--t2)" }}>
                      {settings.priority === 'low' ? '~0.00005' : settings.priority === 'medium' ? '~0.0001' : '~0.0005'} SOL
                    </span>
                  </div>
                  {/* ATA creation cost for first-time holders */}
                  {tradeType === 'buy' && (!userBalances?.tokenBalance || userBalances.tokenBalance === 0) && (
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--space-1)" }}>
                      <Tooltip content="One-time cost to create your token account (rent-exempt)" position="left">
                        <span style={{ fontSize: "var(--fs-xs)", color: "var(--amb)", display: "flex", alignItems: "center", gap: "var(--space-1)" }}>
                          <svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                            <circle cx={12} cy={12} r={10}/><path d="M12 16v-4M12 8h.01"/>
                          </svg>
                          Token account
                        </span>
                      </Tooltip>
                      <span style={{ fontSize: "var(--fs-xs)", fontFamily: "'JetBrains Mono',monospace", color: "var(--amb)" }}>
                        ~0.002 SOL
                      </span>
                    </div>
                  )}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--space-1)" }}>
                    <span style={{ fontSize: "var(--fs-xs)", color: "var(--t3)" }}>Protocol fee (1%)</span>
                    <span style={{ fontSize: "var(--fs-xs)", fontFamily: "'JetBrains Mono',monospace", color: "var(--t2)" }}>
                      {tradeAmount && parseFloat(tradeAmount) > 0 ? (parseFloat(tradeAmount) * 0.01).toFixed(4) : '0.0000'} SOL
                    </span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: "var(--fs-xs)", color: "var(--t3)" }}>Confirmation</span>
                    <span style={{ fontSize: "var(--fs-xs)", color: settings.priority === 'high' ? "var(--grn)" : "var(--t2)" }}>
                      {settings.priority === 'low' ? '~10-30s' : settings.priority === 'medium' ? '~5-10s' : '~1-5s'}
                    </span>
                  </div>
                </div>
              </div>
              {(() => {
                const currentBalance = tradeType === "buy"
                  ? (wallet.balance || 0)
                  : (userBalances?.tokenBalance ? userBalances.tokenBalance / 1e6 : 0);
                const parsedAmount = parseFloat(tradeAmount) || 0;
                const isAmountValid = parsedAmount > 0 && parsedAmount <= currentBalance;
                const insufficientBalance = parsedAmount > currentBalance && parsedAmount > 0;
                const isDisabled = tradeLoading || (wallet.connected && !isAmountValid);

                const getButtonText = () => {
                  if (!wallet.connected) return "Connect Wallet";
                  if (tradeLoading) return null; // Uses loading spinner below
                  if (!tradeAmount || parsedAmount <= 0) return "Enter amount";
                  if (insufficientBalance) return "Insufficient balance";
                  return tradeType === "buy" ? "Buy" : "Sell";
                };

                return (
                  <button
                    onClick={wallet.connected ? initiateTransaction : () => wallet.connect()}
                    className={`btn-press ${tradeLoading ? 'btn-loading' : ''}`}
                    disabled={isDisabled}
                    style={{
                      width: "100%",
                      height: 48,
                      borderRadius: "var(--radius-full)",
                      fontSize: "var(--fs-md)",
                      fontWeight: "var(--fw-semibold)",
                      cursor: isDisabled ? (tradeLoading ? "wait" : "not-allowed") : "pointer",
                      border: "none",
                      transition: "all .2s var(--ease-out-quart)",
                      fontFamily: "inherit",
                      background: !wallet.connected
                        ? "var(--pb)"
                        : insufficientBalance
                          ? "linear-gradient(135deg, rgba(239,68,68,0.3), rgba(220,38,38,0.3))"
                          : (tradeType === "buy" ? "linear-gradient(135deg,#34d399,#16A34A)" : "linear-gradient(135deg,#fca5a5,#ef4444)"),
                      color: !wallet.connected ? "var(--pt)" : "#fff",
                      boxShadow: wallet.connected && isAmountValid
                        ? (tradeType === "buy" ? "0 6px 24px rgba(34,197,94,0.3)" : "0 6px 24px rgba(239,68,68,0.25)")
                        : "none",
                      position: "relative",
                      opacity: isDisabled ? 0.7 : 1
                    }}
                  >
                    {tradeLoading ? (
                      <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "var(--space-2)" }}>
                        <span className="loading-spinner loading-spinner-small" />
                        Processing...
                      </span>
                    ) : (
                      getButtonText()
                    )}
                  </button>
                );
              })()}
            </div>
          </div>
        </div>
      </div>
    );
  };

  // ---------------------------------------------------------------------------
  // CREATE VIEW
  // ---------------------------------------------------------------------------

  const Create = () => {
    // Form state
    const [nm, setNm] = useState('');
    const [sy, setSy] = useState('');
    const [ds, setDs] = useState('');
    const [tw, setTw] = useState('');
    const [tg, setTg] = useState('');
    const [ws, setWs] = useState('');
    const [img, setImg] = useState<string | null>(null);
    const [isCreating, setIsCreating] = useState(false);
    const [creationStep, setCreationStep] = useState(0);
    const [formErrors, setFormErrors] = useState<{
      name?: string;
      symbol?: string;
      image?: string;
      twitter?: string;
      telegram?: string;
      website?: string;
    }>({});
    const [focusedField, setFocusedField] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // File picker
    const openFilePicker = () => {
      fileInputRef.current?.click();
    };

    // Handle file selection
    const onFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      // Validate file type
      if (!file.type.startsWith("image/")) {
        showToast('Please upload an image file (PNG, JPG, etc.)', 'error');
        e.target.value = '';
        return;
      }

      // Validate file size (5MB max)
      if (file.size > 5 * 1024 * 1024) {
        showToast('Image must be less than 5MB', 'error');
        e.target.value = '';
        return;
      }

      // Read file as data URL
      const reader = new FileReader();
      const inputElement = e.target;
      reader.onload = () => {
        const dataUrl = reader.result as string;
        if (dataUrl) {
          setImg(dataUrl);
          setFormErrors(prev => ({ ...prev, image: undefined }));
          showToast('Image uploaded', 'success');
        }
        // Reset input after successful read to allow same file selection
        inputElement.value = '';
      };
      reader.onerror = () => {
        showToast('Failed to read image', 'error');
        // Reset input on error too
        inputElement.value = '';
      };
      reader.readAsDataURL(file);
    };

    // Minimum SOL required for token creation (accounts + rent)
    const MIN_SOL_FOR_CREATION = 0.05;

    // Input field styles with glow effect
    const getInputStyle = (fieldName: string, hasError?: boolean) => ({
      ...inpS,
      width: "100%",
      height: "var(--input-height)",
      padding: "0 var(--space-4)",
      fontFamily: "inherit",
      borderRadius: "var(--input-radius)",
      fontSize: "var(--fs-sm)",
      transition: "all 0.2s ease",
      boxShadow: focusedField === fieldName
        ? "0 0 0 2px var(--grn), 0 0 20px rgba(34,197,94,0.15)"
        : hasError
          ? "0 0 0 2px var(--red)"
          : "none",
      borderColor: hasError ? "var(--red)" : focusedField === fieldName ? "var(--grn)" : "var(--glass-border)",
    });

    const getTextareaStyle = (fieldName: string) => ({
      ...inpS,
      width: "100%",
      padding: "var(--space-3) var(--space-4)",
      resize: "none" as const,
      fontFamily: "inherit",
      borderRadius: "var(--card-radius)",
      fontSize: "var(--fs-sm)",
      transition: "all 0.2s ease",
      boxShadow: focusedField === fieldName
        ? "0 0 0 2px var(--grn), 0 0 20px rgba(34,197,94,0.15)"
        : "none",
      borderColor: focusedField === fieldName ? "var(--grn)" : "var(--glass-border)",
    });

    // Label component for consistent styling
    const renderLabel = (label: string, required?: boolean, error?: string, max?: number, currentLength?: number) => (
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: "var(--space-2)"
      }}>
        <label style={{
          fontSize: "var(--fs-sm)",
          fontWeight: "var(--fw-semibold)",
          color: error ? "var(--red)" : "var(--t1)",
          display: "flex",
          alignItems: "center",
          gap: "var(--space-1)",
          transition: "color 0.2s ease"
        }}>
          {label}
          {required && <span style={{ color: "var(--grn)", fontSize: "var(--fs-sm)" }}>*</span>}
        </label>
        {max !== undefined && (
          <span style={{
            fontSize: "var(--fs-xs)",
            color: currentLength !== undefined && currentLength >= max * 0.9
              ? currentLength >= max ? "var(--red)" : "var(--amb)"
              : "var(--t3)",
            fontFamily: "'JetBrains Mono', monospace",
            fontWeight: "var(--fw-medium)",
            transition: "color 0.2s ease"
          }}>
            {currentLength || 0}/{max}
          </span>
        )}
      </div>
    );

    const renderError = (error?: string) => error && (
      <div
        className="validation-message"
        style={{
          marginTop: "var(--space-1)",
          fontSize: "var(--fs-xs)",
          color: "var(--red)",
          display: "flex",
          alignItems: "center",
          gap: "var(--space-1)",
          animation: "shake 0.4s ease-in-out"
        }}
      >
        <svg width={12} height={12} viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
        </svg>
        {error}
      </div>
    );

    const handleSubmit = async () => {
      const errors: typeof formErrors = {};

      // Required field validation
      if (!img) errors.image = "Token image is required";

      if (!nm.trim()) errors.name = "Token name is required";
      if (nm.length > 32) errors.name = "Name must be 32 characters or less";

      if (!sy.trim()) errors.symbol = "Symbol is required";
      if (sy.length > 0 && sy.length < 2) errors.symbol = "Symbol must be at least 2 characters";
      if (sy.length > 10) errors.symbol = "Symbol must be 10 characters or less";

      // Social link validation (max 64 chars per program constraints)
      if (tw.length > 64) errors.twitter = "Twitter handle must be 64 characters or less";
      if (tg.length > 64) errors.telegram = "Telegram link must be 64 characters or less";
      if (ws.length > 64) errors.website = "Website URL must be 64 characters or less";

      // URL format validation for website
      if (ws && !ws.match(/^https?:\/\/.+/) && ws.length > 0) {
        errors.website = "Website must start with http:// or https://";
      }

      if (Object.keys(errors).length > 0) {
        setFormErrors(errors);
        return;
      }

      // Balance check
      if (wallet.connected && (wallet.balance || 0) < MIN_SOL_FOR_CREATION) {
        showToast(`Insufficient SOL. You need at least ${MIN_SOL_FOR_CREATION} SOL to create a token.`, 'error');
        return;
      }

      setIsCreating(true);

      try {
        // Step 1: Upload metadata
        setCreationStep(1);
        await new Promise(r => setTimeout(r, 300));

        // Step 2: Create token on-chain
        setCreationStep(2);

        await handleCreateLaunch({
          name: nm.trim(),
          symbol: sy.toUpperCase().trim(),
          description: ds.trim(),
          image: img || undefined,
          twitter: tw.trim() || undefined,
          telegram: tg.trim() || undefined,
          website: ws.trim() || undefined
        });

        // Step 3: Success
        setCreationStep(3);
        showToast(`${sy.toUpperCase()} token created successfully!`, 'success');

        // Reset form after success
        setTimeout(() => {
          setNm('');
          setSy('');
          setDs('');
          setTw('');
          setTg('');
          setWs('');
          setImg(null);
          setCreationStep(0);
        }, 2000);
      } catch (err) {
        // Provide specific error context without exposing raw error details to users
        const errorMessage = (err instanceof Error ? err.message : 'Unknown error').toLowerCase();
        console.error('Token creation failed:', err);

        if (errorMessage.includes('upload') || errorMessage.includes('metadata')) {
          showToast('Failed to upload token metadata. Please try again.', 'error');
        } else if (errorMessage.includes('insufficient') || errorMessage.includes('balance')) {
          showToast('Insufficient SOL balance for transaction fees.', 'error');
        } else if (errorMessage.includes('simulation') || errorMessage.includes('rejected')) {
          showToast('Transaction simulation failed. Please check your inputs.', 'error');
        } else if (errorMessage.includes('timeout') || errorMessage.includes('network')) {
          showToast('Network error. Please check your connection and try again.', 'error');
        } else {
          showToast('Failed to create token. Please try again.', 'error');
        }
        setCreationStep(0);
      } finally {
        setIsCreating(false);
      }
    };

    return (
      <div style={{ maxWidth: 520, margin: "0 auto", padding: "var(--space-10) var(--space-6)", position: "relative", zIndex: 1 }}>
        <button
          onClick={() => go('launches')}
          className="interactive-hover"
          aria-label="Back to launches"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "var(--space-2)",
            fontSize: "var(--fs-sm)",
            color: "var(--t2)",
            background: "none",
            border: "none",
            cursor: "pointer",
            marginBottom: "var(--space-6)",
            padding: 0,
            fontFamily: "inherit"
          }}
        >
          <SvgBack /> Back
        </button>
        <div className="glass-card" style={s(ani("si", 0), { padding: 0, overflow: "hidden" })}>
          {/* Creation Progress Steps */}
          {isCreating && (
            <div style={{
              padding: "var(--space-4) var(--space-8)",
              background: "linear-gradient(135deg, rgba(34, 197, 94, 0.1), rgba(34, 197, 94, 0.05))",
              borderBottom: "1px solid var(--glass-border)"
            }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "var(--space-3)" }}>
                <span style={{ fontSize: "var(--fs-xs)", fontWeight: "var(--fw-semibold)", color: "var(--t1)" }}>Creating Token...</span>
                <span style={{ fontSize: "var(--fs-xs)", color: "var(--grn)", fontWeight: "var(--fw-medium)" }}>Step {creationStep} of 3</span>
              </div>
              <div style={{ display: "flex", gap: "var(--space-2)" }}>
                {[
                  { step: 1, label: 'Preparing' },
                  { step: 2, label: 'Creating' },
                  { step: 3, label: 'Confirming' }
                ].map((s) => (
                  <div key={s.step} style={{ flex: 1 }}>
                    <div style={{
                      height: 4,
                      borderRadius: "var(--radius-xs)",
                      background: creationStep >= s.step ? "linear-gradient(90deg, var(--grn), #34d399)" : "var(--glass2)",
                      transition: "all 0.5s ease"
                    }} />
                    <span style={{
                      fontSize: "var(--fs-3xs)",
                      color: creationStep >= s.step ? "var(--grn)" : "var(--t3)",
                      marginTop: "var(--space-1)",
                      display: "block",
                      textAlign: "center"
                    }}>
                      {s.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div style={{ padding: "var(--space-10) var(--space-8)" }}>
            {/* Header */}
            <div className="create-header-animate" style={{
              display: "flex",
              alignItems: "center",
              gap: "var(--space-4)",
              marginBottom: "var(--space-8)"
            }}>
              <div
                style={{
                  width: 48,
                  height: 48,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  filter: "drop-shadow(0 6px 20px rgba(34,197,94,0.4))"
                }}
              >
                <SvgLogo size={48} variant="badge" />
              </div>
              <div>
                <h1 style={{
                  fontSize: "var(--fs-2xl)",
                  fontWeight: 800,
                  color: "var(--t1)",
                  letterSpacing: "var(--ls-tight)"
                }}>
                  Create Launch
                </h1>
                <p style={{
                  fontSize: "var(--fs-sm)",
                  color: "var(--t2)",
                  marginTop: "var(--space-1)",
                  display: "flex",
                  alignItems: "center",
                  gap: "var(--space-1)"
                }}>
                  <span style={{
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    background: "var(--grn)",
                    boxShadow: "0 0 8px var(--grn)"
                  }} />
                  Launch your token into Orbit
                </p>
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-5)" }}>
              {/* Token Image Upload */}
              <div className="form-field-animate" style={{ animationDelay: '0s' }}>
                {renderLabel("Token Image", true, formErrors.image)}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={onFileSelect}
                  style={{ display: "none" }}
                />
                <div
                  onClick={openFilePicker}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openFilePicker(); }}}
                  role="button"
                  tabIndex={0}
                  aria-label={img ? "Change token image" : "Upload token image"}
                  className="glass-card-inner image-upload-zone interactive-hover"
                  style={{
                    width: 100,
                    height: 100,
                    borderRadius: 24,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                    overflow: "hidden",
                    borderStyle: img ? "solid" : "dashed",
                    borderWidth: img ? 1 : 2,
                    borderColor: formErrors.image ? "var(--red)" : img ? "var(--grn)" : "var(--glass-border)",
                    background: img ? "transparent" : formErrors.image ? "rgba(239, 68, 68, 0.03)" : "rgba(34, 197, 94, 0.03)",
                    boxShadow: formErrors.image ? "0 0 0 2px var(--red)" : "none",
                    transition: "all 0.2s ease"
                  }}
                >
                  {img ? (
                    <img
                      src={img}
                      alt="Token"
                      className="image-uploaded"
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                        borderRadius: 22
                      }}
                    />
                  ) : (
                    <div style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: "var(--space-1-5)",
                      color: formErrors.image ? "var(--red)" : "var(--t3)"
                    }}>
                      <div style={{
                        width: 36,
                        height: 36,
                        borderRadius: "var(--radius-md)",
                        background: formErrors.image ? "rgba(239, 68, 68, 0.1)" : "var(--glass2)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center"
                      }}>
                        <SvgImg />
                      </div>
                      <span style={{ fontSize: "var(--fs-xs)", fontWeight: "var(--fw-medium)" }}>Upload</span>
                    </div>
                  )}
                </div>
                {renderError(formErrors.image)}
                <p style={{
                  fontSize: "var(--fs-xs)",
                  color: "var(--t3)",
                  marginTop: "var(--space-2)",
                  display: "flex",
                  alignItems: "center",
                  gap: 4
                }}>
                  <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <circle cx={12} cy={12} r={10}/>
                    <path d="M12 16v-4M12 8h.01"/>
                  </svg>
                  512×512px recommended, PNG or JPG, max 5MB
                </p>
              </div>
            {/* Token Name */}
            <div className="form-field-animate" style={{ animationDelay: '0.05s' }}>
              {renderLabel("Token Name", true, formErrors.name, 32, nm.length)}
              <input
                value={nm}
                onChange={(e) => {
                  setNm(e.target.value.slice(0, 32));
                  if (formErrors.name) setFormErrors(prev => ({ ...prev, name: undefined }));
                }}
                onFocus={() => setFocusedField('name')}
                onBlur={() => setFocusedField(null)}
                placeholder="Token name"
                className={`focus-ring ${formErrors.name ? 'input-error' : ''}`}
                style={getInputStyle('name', !!formErrors.name)}
              />
              {renderError(formErrors.name)}
            </div>

            {/* Symbol */}
            <div className="form-field-animate" style={{ animationDelay: '0.1s' }}>
              {renderLabel("Symbol", true, formErrors.symbol, 10, sy.length)}
              <input
                value={sy}
                onChange={(e) => {
                  setSy(e.target.value.toUpperCase().slice(0, 10));
                  if (formErrors.symbol) setFormErrors(prev => ({ ...prev, symbol: undefined }));
                }}
                onFocus={() => setFocusedField('symbol')}
                onBlur={() => setFocusedField(null)}
                placeholder="TOKEN"
                className={`focus-ring ${formErrors.symbol ? 'input-error' : ''}`}
                style={getInputStyle('symbol', !!formErrors.symbol)}
              />
              {renderError(formErrors.symbol)}
            </div>

            {/* Description */}
            <div className="form-field-animate" style={{ animationDelay: '0.15s' }}>
              {renderLabel("Description", false, undefined, 500, ds.length)}
              <textarea
                value={ds}
                onChange={(e) => setDs(e.target.value.slice(0, 500))}
                onFocus={() => setFocusedField('description')}
                onBlur={() => setFocusedField(null)}
                placeholder="Describe your token's purpose and vision..."
                rows={3}
                className="focus-ring"
                style={getTextareaStyle('description')}
              />
            </div>

            {/* Divider with animation */}
            <div className="form-field-animate" style={{ animationDelay: '0.2s' }}>
              <div style={{
                height: 1,
                background: "linear-gradient(90deg, transparent, var(--glass-border), transparent)",
                margin: "8px 0"
              }} />
              <p style={{
                fontSize: "var(--fs-base)",
                fontWeight: "var(--fw-semibold)",
                color: "var(--t2)",
                marginTop: "var(--space-3)",
                display: "flex",
                alignItems: "center",
                gap: 8
              }}>
                <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
                  <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
                </svg>
                Social Links
                <span style={{ fontSize: "var(--fs-xs)", fontWeight: "var(--fw-normal)", color: "var(--t3)" }}>(optional)</span>
              </p>
            </div>

            {/* Twitter */}
            <div className="form-field-animate" style={{ animationDelay: '0.25s' }}>
              {renderLabel("Twitter", false, formErrors.twitter, 64, tw.length)}
              <input
                value={tw}
                onChange={(e) => {
                  setTw(e.target.value.slice(0, 64));
                  if (formErrors.twitter) setFormErrors(prev => ({ ...prev, twitter: undefined }));
                }}
                onFocus={() => setFocusedField('twitter')}
                onBlur={() => setFocusedField(null)}
                placeholder="@yourtoken"
                className={`focus-ring ${formErrors.twitter ? 'input-error' : ''}`}
                style={getInputStyle('twitter', !!formErrors.twitter)}
              />
              {renderError(formErrors.twitter)}
            </div>

            {/* Telegram */}
            <div className="form-field-animate" style={{ animationDelay: '0.3s' }}>
              {renderLabel("Telegram", false, formErrors.telegram, 64, tg.length)}
              <input
                value={tg}
                onChange={(e) => {
                  setTg(e.target.value.slice(0, 64));
                  if (formErrors.telegram) setFormErrors(prev => ({ ...prev, telegram: undefined }));
                }}
                onFocus={() => setFocusedField('telegram')}
                onBlur={() => setFocusedField(null)}
                placeholder="t.me/yourtoken"
                className={`focus-ring ${formErrors.telegram ? 'input-error' : ''}`}
                style={getInputStyle('telegram', !!formErrors.telegram)}
              />
              {renderError(formErrors.telegram)}
            </div>

            {/* Website */}
            <div className="form-field-animate" style={{ animationDelay: '0.35s' }}>
              {renderLabel("Website", false, formErrors.website, 64, ws.length)}
              <input
                value={ws}
                onChange={(e) => {
                  setWs(e.target.value.slice(0, 64));
                  if (formErrors.website) setFormErrors(prev => ({ ...prev, website: undefined }));
                }}
                onFocus={() => setFocusedField('website')}
                onBlur={() => setFocusedField(null)}
                placeholder="https://yourtoken.xyz"
                className={`focus-ring ${formErrors.website ? 'input-error' : ''}`}
                style={getInputStyle('website', !!formErrors.website)}
              />
              {renderError(formErrors.website)}
            </div>
            {/* Tokenomics Card - SPL Token Details */}
            <div className="glass-card-inner tokenomics-card" style={{
              borderRadius: "var(--radius-lg)",
              padding: "var(--space-5)",
              background: "linear-gradient(135deg, rgba(34, 197, 94, 0.03), transparent)",
              border: "1px solid rgba(34, 197, 94, 0.1)"
            }}>
              <div style={{
                fontSize: "var(--fs-base)",
                fontWeight: "var(--fw-bold)",
                color: "var(--t1)",
                marginBottom: "var(--space-3-5)",
                display: "flex",
                alignItems: "center",
                gap: "var(--space-2)"
              }}>
                <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="var(--grn)" strokeWidth={2}>
                  <circle cx={12} cy={12} r={10}/>
                  <path d="M12 6v6l4 2"/>
                </svg>
                SPL Token Details
              </div>
              {[
                { label: "Total Supply", value: "1,000,000,000", icon: "M20 12V8H6a2 2 0 0 1-2-2c0-1.1.9-2 2-2h12v4", tooltip: "Fixed supply, no additional minting" },
                { label: "Decimals", value: "9", icon: "M4 4h16v16H4z M8 8h8v8H8z", tooltip: "Same precision as SOL" },
                { label: "Bonding Curve", value: "80%", icon: "M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 0 1 5.814-5.519l2.74-1.22", tooltip: "800M tokens available for trading" },
                { label: "LP Reserve", value: "20%", icon: "M4.5 12a7.5 7.5 0 0 0 15 0m-15 0a7.5 7.5 0 1 1 15 0m-15 0H3m16.5 0H21m-1.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z", tooltip: "Reserved for Orbit DEX graduation" },
                { label: "Graduation", value: "85 SOL", icon: "M4.26 10.147a60.436 60.436 0 0 0-.491 6.347A48.627 48.627 0 0 1 12 20.904a48.627 48.627 0 0 1 8.232-4.41", tooltip: "Migrates to Orbit DLMM liquidity" }
              ].map((item, i) => (
                <div
                  key={item.label}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "10px 0",
                    borderBottom: i < 3 ? "1px solid var(--glass-border)" : "none"
                  }}
                >
                  <span style={{
                    fontSize: "var(--fs-base)",
                    color: "var(--t2)",
                    display: "flex",
                    alignItems: "center",
                    gap: 8
                  }}>
                    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="var(--t3)" strokeWidth={1.5}>
                      <path d={item.icon}/>
                    </svg>
                    {item.label}
                  </span>
                  <span style={{
                    fontSize: "var(--fs-base)",
                    fontFamily: "'JetBrains Mono', monospace",
                    fontWeight: "var(--fw-semibold)",
                    color: "var(--grn)"
                  }}>
                    {item.value}
                  </span>
                </div>
              ))}
            </div>

            {/* Create Button */}
            <button
              onClick={wallet.connected ? handleSubmit : () => wallet.connect()}
              disabled={isCreating}
              className={`btn-press btn-glow create-btn-animate ${isCreating ? 'btn-loading' : ''}`}
              style={s(bpS, {
                width: "100%",
                height: 54,
                fontSize: "var(--fs-lg)",
                fontWeight: "var(--fw-bold)",
                borderRadius: "var(--radius-md)",
                boxShadow: wallet.connected
                  ? "0 8px 32px rgba(34,197,94,0.25)"
                  : "0 4px 16px rgba(0,0,0,0.1)",
                position: "relative",
                cursor: isCreating ? "wait" : "pointer",
                opacity: isCreating ? 0.85 : 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "var(--space-2-5)",
                transition: "all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)",
                transform: isCreating ? "scale(0.98)" : "scale(1)"
              })}
            >
              {isCreating ? (
                <>
                  <span className="loading-spinner loading-spinner-small" />
                  <span>Creating Token...</span>
                </>
              ) : wallet.connected ? (
                <>
                  <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                    <path d="M12 2v4m0 12v4M4.93 4.93l2.83 2.83m8.48 8.48l2.83 2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83m8.48-8.48l2.83-2.83"/>
                  </svg>
                  Launch Token
                </>
              ) : (
                <>
                  <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <path d="M21 12a2.25 2.25 0 0 0-2.25-2.25H15a3 3 0 1 1-6 0H5.25A2.25 2.25 0 0 0 3 12m18 0v6a2.25 2.25 0 0 1-2.25 2.25H5.25A2.25 2.25 0 0 1 3 18v-6"/>
                  </svg>
                  Connect Wallet
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
    );
  };

  // ---------------------------------------------------------------------------
  // PROFILE VIEW
  // ---------------------------------------------------------------------------

  const Profile = () => {
    const handleCopy = () => {
      if (wallet.address) {
        navigator.clipboard.writeText(wallet.address);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    };

    // Mock performance data for chart
    const performanceData = useMemo(() => {
      const days = 14;
      let value = portfolioStats.totalValue * 0.7;
      return Array.from({ length: days }, (_, i) => {
        const change = (Math.random() - 0.4) * value * 0.08;
        value = Math.max(0.1, value + change);
        return { day: i, value };
      });
    }, [portfolioStats.totalValue]);

    if (!wallet.connected) {
      return (
        <div style={{ maxWidth: 520, margin: "0 auto", padding: "36px 24px", position: "relative", zIndex: 1 }}>
          <div className="glass-card page-enter-smooth" style={{ padding: "var(--space-12)", textAlign: "center" }}>
            <div style={{
              width: 80,
              height: 80,
              borderRadius: "var(--radius-lg)",
              background: "linear-gradient(135deg, var(--glass2), var(--glass3))",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 24px",
              boxShadow: "0 8px 32px rgba(0,0,0,0.1)"
            }}>
              <SvgWallet />
            </div>
            <h2 style={{ fontSize: "var(--fs-3xl)", fontWeight: "var(--fw-bold)", color: "var(--t1)", marginBottom: 8 }}>Connect Your Wallet</h2>
            <p style={{ fontSize: "var(--fs-sm)", color: "var(--t2)", marginBottom: "var(--space-6)", lineHeight: "var(--lh-relaxed)" }}>
              Connect your wallet to view your portfolio, positions, and trading history.
            </p>
            <button
              onClick={() => wallet.connect()}
              className="btn-press interactive-hover"
              style={s(bpS, { height: "var(--btn-lg)", padding: "0 var(--space-8)", fontSize: "var(--fs-sm)", fontWeight: "var(--fw-semibold)" })}
            >
              Connect Wallet
            </button>
          </div>
        </div>
      );
    }

    const tabBtn = (k: 'positions' | 'activity' | 'created', l: string, count?: number) => (
      <button
        key={k}
        onClick={() => setProfileTab(k)}
        className="btn-press"
        style={{
          padding: "var(--space-2) var(--space-5)",
          borderRadius: "var(--radius-full)",
          fontSize: "var(--fs-xs)",
          fontWeight: "var(--fw-semibold)",
          cursor: "pointer",
          border: "none",
          transition: "all .2s var(--ease-out-quart)",
          background: profileTab === k ? "var(--pb)" : "transparent",
          color: profileTab === k ? "var(--pt)" : "var(--t2)",
          fontFamily: "inherit",
          display: "flex",
          alignItems: "center",
          gap: 6
        }}
      >
        {l}
        {count !== undefined && (
          <span style={{
            fontSize: "var(--fs-2xs)",
            padding: "2px 7px",
            borderRadius: "var(--radius-full)",
            background: profileTab === k ? "rgba(0,0,0,0.2)" : "var(--glass2)",
            color: profileTab === k ? "var(--pt)" : "var(--t3)",
            fontWeight: 600
          }}>
            {count}
          </span>
        )}
      </button>
    );

    const myCreatedLaunches = launches.filter(l =>
      l.creator.includes(wallet.address?.slice(0, 4) || '') || Math.random() > 0.7
    ).slice(0, 2);

    // Mini sparkline for performance
    const MiniChart = () => {
      const max = Math.max(...performanceData.map(d => d.value));
      const min = Math.min(...performanceData.map(d => d.value));
      const range = max - min || 1;
      const points = performanceData.map((d, i) => {
        const x = (i / (performanceData.length - 1)) * 100;
        const y = 100 - ((d.value - min) / range) * 100;
        return `${x},${y}`;
      }).join(' ');

      const isPositive = performanceData[performanceData.length - 1].value >= performanceData[0].value;

      return (
        <svg viewBox="0 0 100 100" style={{ width: '100%', height: 60 }} preserveAspectRatio="none">
          <defs>
            <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={isPositive ? "var(--grn)" : "var(--red)"} stopOpacity="0.3" />
              <stop offset="100%" stopColor={isPositive ? "var(--grn)" : "var(--red)"} stopOpacity="0" />
            </linearGradient>
          </defs>
          <polygon
            points={`0,100 ${points} 100,100`}
            fill="url(#chartGradient)"
          />
          <polyline
            points={points}
            fill="none"
            stroke={isPositive ? "var(--grn)" : "var(--red)"}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="sparkline-animate"
          />
        </svg>
      );
    };

    return (
      <div style={{ maxWidth: 1000, margin: "0 auto", padding: "var(--space-9) var(--space-6)", position: "relative", zIndex: 1 }}>
        <button
          onClick={() => go('home')}
          className="btn-press interactive-hover"
          aria-label="Go back"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "var(--space-2)",
            fontSize: "var(--fs-base)",
            color: "var(--t2)",
            background: "var(--glass)",
            border: "1px solid var(--glass-border)",
            borderRadius: "var(--radius-sm)",
            cursor: "pointer",
            marginBottom: "var(--space-5-5)",
            padding: "var(--space-2) var(--space-3-5)",
            fontFamily: "inherit"
          }}
        >
          <SvgBack /> Back
        </button>

        {/* Profile Header - Institutional Grade */}
        <div className="glass-card page-enter-smooth" style={{
          padding: 0,
          marginBottom: 22,
          overflow: "hidden"
        }}>
          {/* Header gradient banner */}
          <div style={{
            height: 80,
            background: "linear-gradient(135deg, rgba(99, 102, 241, 0.15), rgba(139, 92, 246, 0.1), rgba(34, 197, 94, 0.08))",
            position: "relative"
          }}>
            <div style={{
              position: "absolute",
              inset: 0,
              background: "radial-gradient(ellipse at 30% 0%, rgba(139, 92, 246, 0.2), transparent 50%)",
            }} />
          </div>

          <div style={{ padding: "0 28px 28px", marginTop: -36 }}>
            <div style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-end",
              flexWrap: "wrap",
              gap: 20
            }}>
              <div style={{ display: "flex", alignItems: "flex-end", gap: 18 }}>
                {/* Profile Avatar */}
                <div style={{ position: "relative" }}>
                  <UserAvatar address={wallet.address || undefined} size={84} />
                  <div style={{
                    position: "absolute",
                    bottom: 2,
                    right: 2,
                    width: 22,
                    height: 22,
                    borderRadius: "50%",
                    background: "var(--grn)",
                    border: "3px solid var(--bg-card)",
                    boxShadow: "0 2px 10px rgba(34, 197, 94, 0.5)"
                  }} />
                </div>

                {/* Profile Info */}
                <div style={{ paddingBottom: 4 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2-5)", marginBottom: 8 }}>
                    <h1 style={{
                      fontSize: "var(--fs-3xl)",
                      fontWeight: "var(--fw-bold)",
                      color: "var(--t1)",
                      fontFamily: "'JetBrains Mono', monospace",
                      letterSpacing: -0.5
                    }}>
                      {wallet.address?.slice(0, 6)}...{wallet.address?.slice(-4)}
                    </h1>
                    <button
                      onClick={handleCopy}
                      className="btn-press interactive-hover"
                      aria-label={copied ? "Address copied" : "Copy wallet address"}
                      style={{
                        background: copied ? "var(--gb)" : "var(--glass2)",
                        border: copied ? "1px solid var(--grn)" : "1px solid var(--glass-border)",
                        borderRadius: "var(--radius-sm)",
                        padding: "6px 12px",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: "var(--space-1-5)",
                        color: copied ? "var(--grn)" : "var(--t3)",
                        fontSize: "var(--fs-xs)",
                        fontWeight: "var(--fw-semibold)",
                        transition: "all .2s var(--ease-out-quart)"
                      }}
                    >
                      {copied ? <SvgCheck /> : <SvgCopy />}
                      {copied ? "Copied!" : "Copy"}
                    </button>
                  </div>
                  <div style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "var(--space-4)",
                    fontSize: "var(--fs-base)",
                    color: "var(--t2)"
                  }}>
                    <span style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "var(--space-1-5)",
                      padding: "4px 10px",
                      borderRadius: "var(--radius-full)",
                      background: "var(--gb)",
                      color: "var(--grn)",
                      fontSize: "var(--fs-sm)",
                      fontWeight: 600
                    }}>
                      <PulseDot color="var(--grn)" size={6} />
                      Connected
                    </span>
                    <span style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 5,
                      fontFamily: "'JetBrains Mono', monospace",
                      fontWeight: "var(--fw-semibold)",
                      color: "var(--t1)"
                    }}>
                      <span style={{ color: "var(--t3)" }}>Balance:</span>
                      {wallet.balance?.toFixed(4)} SOL
                    </span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div style={{ display: "flex", gap: "var(--space-2-5)", paddingBottom: 4 }}>
                <button
                  onClick={() => go('settings')}
                  className="glass-pill btn-press interactive-hover"
                  style={s(bsS, {
                    height: 40,
                    padding: "0 16px",
                    fontSize: "var(--fs-sm)",
                    fontWeight: "var(--fw-medium)",
                    display: "flex",
                    alignItems: "center",
                    gap: 7
                  })}
                >
                  <SvgSettings /> Settings
                </button>
                <button
                  onClick={() => wallet.disconnect()}
                  className="glass-pill btn-press interactive-hover"
                  style={s(bsS, {
                    height: 40,
                    padding: "0 16px",
                    fontSize: "var(--fs-sm)",
                    fontWeight: "var(--fw-medium)",
                    display: "flex",
                    alignItems: "center",
                    gap: 7,
                    color: "var(--red)",
                    borderColor: "rgba(252, 165, 165, 0.2)"
                  })}
                >
                  <SvgLogout /> Disconnect
                </button>
              </div>
            </div>
          </div>

          {/* Portfolio Stats Grid - Institutional Grade */}
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
            gap: "var(--space-3)",
            marginTop: 24,
            padding: "0 28px 28px"
          }}>
            {([
              { l: "Portfolio Value", v: fSOL(portfolioStats.totalValue), sub: `≈ $${fN(portfolioStats.totalValue * (Number(solPrice) || 150), 2)}`, iconType: "wallet", highlight: true },
              { l: "Total P&L", v: `${portfolioStats.totalPnl >= 0 ? '+' : ''}${fSOL(portfolioStats.totalPnl)}`, isProfit: portfolioStats.totalPnl >= 0, iconType: portfolioStats.totalPnl >= 0 ? "trending-up" : "trending-down" },
              { l: "ROI", v: fPct(portfolioStats.pnlPercent), isProfit: portfolioStats.pnlPercent >= 0, iconType: "percent" },
              { l: "Positions", v: fN(portfolioStats.positionCount), sub: "Active", iconType: "layers" }
            ] as { l: string; v: string; sub?: string; iconType: 'wallet' | 'trending-up' | 'trending-down' | 'percent' | 'layers'; highlight?: boolean; isProfit?: boolean }[]).map((stat, i) => (
              <div
                key={stat.l}
                className="glass-card-inner stat-card stagger-item"
                style={{
                  padding: "var(--space-4)",
                  position: "relative",
                  overflow: "hidden",
                  borderRadius: "var(--radius-lg)",
                  border: stat.highlight ? "1px solid rgba(34, 197, 94, 0.2)" : undefined,
                  background: stat.highlight ? "linear-gradient(135deg, var(--glass2), var(--glass3))" : undefined
                }}
              >
                <div style={{
                  fontSize: "var(--fs-2xs)",
                  color: "var(--t3)",
                  fontWeight: "var(--fw-bold)",
                  marginBottom: "var(--space-2)",
                  letterSpacing: 0.5,
                  display: "flex",
                  alignItems: "center",
                  gap: "var(--space-1-5)",
                  textTransform: "uppercase"
                }}>
                  <StatIcon type={stat.iconType} size={13} />
                  {stat.l}
                </div>
                <div style={{
                  fontSize: "var(--fs-2xl)",
                  fontWeight: "var(--fw-bold)",
                  color: stat.isProfit !== undefined ? (stat.isProfit ? "var(--grn)" : "var(--red)") : "var(--t1)",
                  fontFamily: "'JetBrains Mono', monospace",
                  lineHeight: 1.2
                }}>
                  {stat.v}
                </div>
                {stat.sub && (
                  <div style={{
                    fontSize: "var(--fs-xs)",
                    color: "var(--t3)",
                    marginTop: 6,
                    fontWeight: "var(--fw-medium)",
                    display: "flex",
                    alignItems: "center",
                    gap: 4
                  }}>
                    {stat.sub}
                  </div>
                )}
                {/* Subtle gradient overlay for depth */}
                <div style={{
                  position: "absolute",
                  top: 0,
                  right: 0,
                  width: 60,
                  height: 60,
                  background: stat.isProfit !== undefined
                    ? `radial-gradient(circle at top right, ${stat.isProfit ? "rgba(34,197,94,0.08)" : "rgba(252,165,165,0.08)"}, transparent 70%)`
                    : "radial-gradient(circle at top right, rgba(255,255,255,0.03), transparent 70%)",
                  pointerEvents: "none"
                }} />
              </div>
            ))}
          </div>

          {/* Trading Metrics - Professional Analytics */}
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: "var(--space-3)",
            padding: "0 28px 28px"
          }}>
            {/* Win Rate Card */}
            <div className="glass-card-inner" style={{ padding: "var(--space-4)", borderRadius: "var(--radius-lg)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <span style={{ fontSize: "var(--fs-xs)", color: "var(--t3)", fontWeight: "var(--fw-semibold)", textTransform: "uppercase", letterSpacing: 0.5 }}>Win Rate</span>
                <StatIcon type="trophy" size={14} color="var(--t3)" />
              </div>
              <div style={{ display: "flex", alignItems: "flex-end", gap: "var(--space-2)" }}>
                <span style={{ fontSize: "var(--fs-3xl)", fontWeight: "var(--fw-bold)", color: "var(--grn)", fontFamily: "'JetBrains Mono', monospace" }}>
                  {userPositions.length > 0 ? Math.round((userPositions.filter(p => p.pnl >= 0).length / userPositions.length) * 100) : 0}%
                </span>
                <span style={{ fontSize: "var(--fs-xs)", color: "var(--t3)", marginBottom: 4 }}>
                  {userPositions.filter(p => p.pnl >= 0).length}W / {userPositions.filter(p => p.pnl < 0).length}L
                </span>
              </div>
              {/* Win rate bar */}
              <div style={{ marginTop: "var(--space-3)", height: 6, borderRadius: 3, background: "var(--glass2)", overflow: "hidden" }}>
                <div style={{
                  width: `${userPositions.length > 0 ? (userPositions.filter(p => p.pnl >= 0).length / userPositions.length) * 100 : 0}%`,
                  height: "100%",
                  background: "linear-gradient(90deg, var(--grn), #34d399)",
                  borderRadius: 3,
                  transition: "width 0.5s ease"
                }} />
              </div>
            </div>

            {/* Average Trade Size */}
            <div className="glass-card-inner" style={{ padding: "var(--space-4)", borderRadius: "var(--radius-lg)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <span style={{ fontSize: "var(--fs-xs)", color: "var(--t3)", fontWeight: "var(--fw-semibold)", textTransform: "uppercase", letterSpacing: 0.5 }}>Avg Trade Size</span>
                <StatIcon type="chart" size={14} color="var(--t3)" />
              </div>
              <div style={{ fontSize: "var(--fs-3xl)", fontWeight: "var(--fw-bold)", color: "var(--t1)", fontFamily: "'JetBrains Mono', monospace" }}>
                {userActivity.length > 0 ? (userActivity.reduce((sum, a) => sum + a.sol, 0) / userActivity.length).toFixed(2) : "0.00"} SOL
              </div>
              <div style={{ fontSize: "var(--fs-xs)", color: "var(--t3)", marginTop: 6 }}>
                ≈ ${userActivity.length > 0 ? ((userActivity.reduce((sum, a) => sum + a.sol, 0) / userActivity.length) * (Number(solPrice) || 150)).toFixed(0) : "0"} USD
              </div>
            </div>

            {/* Best Position */}
            <div className="glass-card-inner" style={{ padding: "var(--space-4)", borderRadius: "var(--radius-lg)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <span style={{ fontSize: "var(--fs-xs)", color: "var(--t3)", fontWeight: "var(--fw-semibold)", textTransform: "uppercase", letterSpacing: 0.5 }}>Best Position</span>
                <StatIcon type="trending-up" size={14} color="var(--grn)" />
              </div>
              {userPositions.length > 0 ? (() => {
                const best = [...userPositions].sort((a, b) => b.pnlPercent - a.pnlPercent)[0];
                return (
                  <>
                    <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2-5)" }}>
                      <Avatar gi={best.launch.gi} size={32} imageUrl={getTokenImageUrl(best.launch.publicKey)} symbol={best.launch.symbol} />
                      <div>
                        <div style={{ fontSize: "var(--fs-md)", fontWeight: "var(--fw-semibold)", color: "var(--t1)" }}>{best.launch.symbol}</div>
                        <div style={{ fontSize: "var(--fs-2xl)", fontWeight: "var(--fw-bold)", color: "var(--grn)", fontFamily: "'JetBrains Mono', monospace" }}>
                          +{fPct(best.pnlPercent, false)}
                        </div>
                      </div>
                    </div>
                  </>
                );
              })() : (
                <div style={{ fontSize: "var(--fs-base)", color: "var(--t3)" }}>No positions yet</div>
              )}
            </div>
          </div>

          {/* Performance Chart - Enhanced with Timeframes */}
          <div className="glass-card-inner" style={{
            margin: "0 var(--space-7) var(--space-7)",
            padding: "var(--space-5)",
            borderRadius: "var(--radius-md)",
            background: "linear-gradient(135deg, var(--glass), var(--glass2))"
          }}>
            <div style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "var(--space-4)",
              flexWrap: "wrap",
              gap: "var(--space-3)"
            }}>
              <div>
                <span style={{
                  fontSize: "var(--fs-base)",
                  fontWeight: "var(--fw-semibold)",
                  color: "var(--t1)",
                  display: "block"
                }}>
                  Portfolio Performance
                </span>
                <span style={{ fontSize: "var(--fs-xs)", color: "var(--t3)", marginTop: 2 }}>
                  Value over time
                </span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
                {/* Timeframe pills */}
                <div style={{ display: "flex", gap: "var(--space-1)", padding: 3, borderRadius: "var(--radius-md)", background: "var(--glass2)" }}>
                  {['7D', '14D', '30D', '90D'].map((tf) => (
                    <button
                      key={tf}
                      className="btn-press"
                      style={{
                        padding: "5px 10px",
                        borderRadius: 7,
                        fontSize: "var(--fs-2xs)",
                        fontWeight: "var(--fw-semibold)",
                        cursor: "pointer",
                        border: "none",
                        background: tf === '14D' ? "var(--pb)" : "transparent",
                        color: tf === '14D' ? "var(--pt)" : "var(--t3)",
                        fontFamily: "inherit",
                        transition: "all .15s"
                      }}
                    >
                      {tf}
                    </button>
                  ))}
                </div>
                <div style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "var(--space-1-5)",
                  padding: "6px 12px",
                  borderRadius: "var(--radius-sm)",
                  background: performanceData[performanceData.length - 1].value >= performanceData[0].value
                    ? "var(--gb)"
                    : "var(--rb)"
                }}>
                  {performanceData[performanceData.length - 1].value >= performanceData[0].value ? <SvgUp /> : <SvgDn />}
                  <span style={{
                    fontSize: "var(--fs-base)",
                    fontWeight: "var(--fw-bold)",
                    color: performanceData[performanceData.length - 1].value >= performanceData[0].value ? "var(--grn)" : "var(--red)"
                  }}>
                    {performanceData[performanceData.length - 1].value >= performanceData[0].value ? '+' : ''}
                    {(((performanceData[performanceData.length - 1].value - performanceData[0].value) / performanceData[0].value) * 100).toFixed(1)}%
                  </span>
                </div>
              </div>
            </div>
            <div style={{ position: "relative" }}>
              <MiniChart />
              {/* Chart axis labels */}
              <div style={{
                display: "flex",
                justifyContent: "space-between",
                marginTop: "var(--space-2)",
                fontSize: "var(--fs-2xs)",
                color: "var(--t3)"
              }}>
                <span>14d ago</span>
                <span>7d ago</span>
                <span>Today</span>
              </div>
            </div>
          </div>

          {/* Quick Stats Row */}
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: "var(--space-2-5)",
            margin: "0 28px 28px"
          }}>
            {[
              { label: 'Total Trades', value: userActivity.length, color: 'var(--t1)' },
              { label: 'Buys', value: userActivity.filter(a => a.type === 'buy').length, color: 'var(--grn)' },
              { label: 'Sells', value: userActivity.filter(a => a.type === 'sell').length, color: 'var(--red)' },
              { label: 'Created', value: myCreatedLaunches.length, color: 'var(--amb)' },
            ].map((stat) => (
              <div key={stat.label} className="glass-card-inner" style={{ padding: "var(--space-3)", borderRadius: "var(--radius-md)", textAlign: "center" }}>
                <div style={{ fontSize: "var(--fs-2xl)", fontWeight: "var(--fw-bold)", color: stat.color, fontFamily: "'JetBrains Mono', monospace" }}>
                  {stat.value}
                </div>
                <div style={{ fontSize: "var(--fs-2xs)", color: "var(--t3)", marginTop: 4, fontWeight: "var(--fw-medium)" }}>
                  {stat.label}
                </div>
              </div>
            ))}
          </div>

        </div>

        {/* Tabs */}
        <div style={{
          display: "flex",
          gap: "var(--space-1)",
          padding: 4,
          borderRadius: "var(--radius-full)",
          width: "fit-content",
          marginBottom: 18,
          background: "var(--glass2)",
          backdropFilter: "blur(8px)",
          WebkitBackdropFilter: "blur(8px)",
          border: "1px solid var(--glass-border)"
        }}>
          {tabBtn("positions", "Positions", userPositions.length)}
          {tabBtn("activity", "Activity", userActivity.length)}
          {tabBtn("created", "Created", myCreatedLaunches.length)}
        </div>

        {/* Tab Content */}
        <div className="glass-card tab-content-enter" key={profileTab} style={{ padding: 24 }}>
          {profileTab === 'positions' && (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                <h3 style={{ fontSize: "var(--fs-lg)", fontWeight: "var(--fw-semibold)", color: "var(--t1)" }}>Your Positions</h3>
                {userPositions.length > 0 && (
                  <span style={{ fontSize: "var(--fs-xs)", color: "var(--t3)", fontWeight: "var(--fw-medium)" }}>
                    Total: {userPositions.reduce((acc, p) => acc + p.currentValue, 0).toFixed(4)} SOL
                  </span>
                )}
              </div>
              {userPositions.length === 0 ? (
                <div className="empty-state" style={{ textAlign: "center", padding: "var(--space-12) 0" }}>
                  <div style={{ marginBottom: "var(--space-4)" }}><EmptyStateIcon type="inbox" size={56} /></div>
                  <p style={{ fontSize: "var(--fs-base)", color: "var(--t2)", marginBottom: "var(--space-5)", fontWeight: "var(--fw-medium)" }}>No positions yet</p>
                  <button onClick={() => go('launches')} className="btn-press interactive-hover" style={s(bpS, { height: "var(--btn-md)", padding: "0 var(--space-6)", fontSize: "var(--fs-sm)" })}>
                    Explore Launches
                  </button>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2-5)" }}>
                  {userPositions.map((pos, i) => (
                    <div
                      key={pos.launch.id}
                      onClick={() => go('detail', pos.launch)}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go('detail', pos.launch); }}}
                      role="button"
                      tabIndex={0}
                      aria-label={`View ${pos.launch.name} position`}
                      className="glass-card-inner table-row-hover btn-press stagger-reveal hover-scale-premium"
                      style={s(ani("fu", i * 0.04), {
                        padding: "var(--space-4-5)",
                        cursor: "pointer",
                        borderRadius: "var(--radius-lg)"
                      })}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3-5)" }}>
                          <Avatar gi={pos.launch.gi} size={44} imageUrl={getTokenImageUrl(pos.launch.publicKey)} symbol={pos.launch.symbol} />
                          <div>
                            <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
                              <span style={{ fontWeight: "var(--fw-semibold)", fontSize: "var(--fs-lg)", color: "var(--t1)" }}>{pos.launch.name}</span>
                              <Badge status={pos.launch.status} isDark={isDark} />
                            </div>
                            <div style={{ fontSize: "var(--fs-sm)", color: "var(--t3)", marginTop: 3, fontFamily: "'JetBrains Mono', monospace" }}>
                              {fN(pos.tokenBalance / 1e6, 1)}M {pos.launch.symbol}
                            </div>
                          </div>
                        </div>
                        <div style={{ textAlign: "right" }}>
                          <div style={{ fontSize: "var(--fs-lg)", fontWeight: "var(--fw-semibold)", fontFamily: "'JetBrains Mono', monospace", color: "var(--t1)" }}>
                            {fSOL(pos.currentValue)}
                          </div>
                          <div style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "flex-end",
                            gap: 5,
                            fontSize: "var(--fs-sm)",
                            fontWeight: "var(--fw-semibold)",
                            color: pos.pnl >= 0 ? "var(--grn)" : "var(--red)",
                            marginTop: 3
                          }}>
                            {pos.pnl >= 0 ? <SvgUp /> : <SvgDn />}
                            {pos.pnl >= 0 ? '+' : ''}{fSOL(pos.pnl, false)} ({fPct(pos.pnlPercent, false)})
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {profileTab === 'activity' && (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                <h3 style={{ fontSize: "var(--fs-lg)", fontWeight: "var(--fw-semibold)", color: "var(--t1)" }}>Transaction History</h3>
                <span style={{ fontSize: "var(--fs-xs)", color: "var(--t3)", fontWeight: "var(--fw-medium)" }}>Click tx to view on Solscan</span>
              </div>
              {detailedTransactions.length === 0 ? (
                <div className="empty-state" style={{ textAlign: "center", padding: "var(--space-12) 0" }}>
                  <div style={{ marginBottom: "var(--space-4)" }}><EmptyStateIcon type="chart" size={48} /></div>
                  <p style={{ fontSize: "var(--fs-base)", color: "var(--t2)", fontWeight: "var(--fw-medium)" }}>No transactions yet</p>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column" }}>
                  {detailedTransactions.map((tx, i) => (
                    <div
                      key={tx.txSignature}
                      style={s(ani("fu", i * 0.03), {
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        padding: "16px 0",
                        borderBottom: i < detailedTransactions.length - 1 ? "1px solid var(--glass-border)" : "none"
                      })}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3-5)" }}>
                        <div style={{
                          width: 40,
                          height: 40,
                          borderRadius: "var(--radius-md)",
                          background: tx.type === 'buy' ? "var(--gb)" : tx.type === 'sell' ? "var(--rb)" : "var(--glass2)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center"
                        }}>
                          {tx.type === 'create' ? (
                            <SvgPlus />
                          ) : tx.type === 'buy' ? (
                            <SvgUp />
                          ) : (
                            <SvgDn />
                          )}
                        </div>
                        <div>
                          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
                            <span style={{
                              fontSize: "var(--fs-xs)",
                              fontWeight: "var(--fw-bold)",
                              color: tx.type === 'buy' ? "var(--grn)" : tx.type === 'sell' ? "var(--red)" : "var(--t1)",
                              textTransform: "uppercase",
                              letterSpacing: 0.5
                            }}>
                              {tx.type === 'create' ? 'Created' : tx.type}
                            </span>
                            <span style={{ fontSize: "var(--fs-md)", fontWeight: "var(--fw-semibold)", color: "var(--t1)" }}>{tx.launch}</span>
                          </div>
                          <div style={{ fontSize: "var(--fs-sm)", color: "var(--t3)", marginTop: 3 }}>
                            {tx.type !== 'create' && `${(tx.amount / 1e6).toFixed(0)}M ${tx.symbol} · `}
                            {tx.time}
                          </div>
                        </div>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3-5)" }}>
                        <div style={{ textAlign: "right" }}>
                          <div style={{
                            fontSize: "var(--fs-md)",
                            fontWeight: "var(--fw-semibold)",
                            fontFamily: "'JetBrains Mono', monospace",
                            color: tx.type === 'buy' ? "var(--red)" : tx.type === 'sell' ? "var(--grn)" : "var(--t1)"
                          }}>
                            {tx.type === 'buy' ? '-' : tx.type === 'sell' ? '+' : ''}{tx.sol.toFixed(2)} SOL
                          </div>
                        </div>
                        <a
                          href={`https://solscan.io/tx/${tx.txSignature}?cluster=devnet`}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="interactive-hover"
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 5,
                            padding: "7px 12px",
                            borderRadius: "var(--radius-md)",
                            background: "var(--glass2)",
                            border: "1px solid var(--glass-border)",
                            color: "var(--t2)",
                            fontSize: "var(--fs-xs)",
                            textDecoration: "none",
                            fontWeight: 500
                          }}
                          title="View on Solscan"
                        >
                          <span style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                            {tx.txSignature.slice(0, 4)}...{tx.txSignature.slice(-4)}
                          </span>
                          <SvgExternal />
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {profileTab === 'created' && (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--space-5)" }}>
                <h3 style={{ fontSize: "var(--fs-base)", fontWeight: "var(--fw-semibold)", color: "var(--t1)" }}>Your Launches</h3>
                <button onClick={() => go('create')} className="btn-press interactive-hover" style={s(bpS, { height: "var(--btn-sm)", padding: "0 var(--space-4)", fontSize: "var(--fs-xs)", display: "flex", alignItems: "center", gap: "var(--space-1)" })}>
                  <SvgPlus /> Create
                </button>
              </div>
              {myCreatedLaunches.length === 0 ? (
                <div className="empty-state" style={{ textAlign: "center", padding: "var(--space-12) 0" }}>
                  <div style={{ marginBottom: "var(--space-4)" }}><EmptyStateIcon type="rocket" size={56} /></div>
                  <p style={{ fontSize: "var(--fs-base)", color: "var(--t2)", marginBottom: "var(--space-5)", fontWeight: "var(--fw-medium)" }}>You haven't created any launches yet</p>
                  <button onClick={() => go('create')} className="btn-press interactive-hover" style={s(bpS, { height: "var(--btn-md)", padding: "0 var(--space-6)", fontSize: "var(--fs-sm)" })}>
                    Create Your First Launch
                  </button>
                </div>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-3-5)" }}>
                  {myCreatedLaunches.map((launch, i) => (
                    <div
                      key={launch.id}
                      onClick={() => go('detail', launch)}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go('detail', launch); }}}
                      role="button"
                      tabIndex={0}
                      aria-label={`View ${launch.name} token`}
                      className="glass-card-inner table-row-hover btn-press stagger-reveal hover-scale-premium"
                      style={s(ani("fu", i * 0.04), {
                        padding: "var(--space-4-5)",
                        cursor: "pointer",
                        borderRadius: "var(--radius-lg)"
                      })}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", marginBottom: 14 }}>
                        <Avatar gi={launch.gi} size={40} />
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: "var(--fw-semibold)", fontSize: "var(--fs-md)", color: "var(--t1)" }}>{launch.name}</div>
                          <div style={{ fontSize: "var(--fs-xs)", color: "var(--t3)", fontFamily: "'JetBrains Mono', monospace" }}>{launch.symbol}</div>
                        </div>
                        <Badge status={launch.status} isDark={isDark} />
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-2-5)" }}>
                        <div>
                          <div style={{ fontSize: "var(--fs-2xs)", color: "var(--t3)", marginBottom: 4, fontWeight: "var(--fw-semibold)", letterSpacing: 0.3 }}>PROGRESS</div>
                          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
                            <div style={{ flex: 1, height: 5, borderRadius: 3, background: "var(--glass2)", overflow: "hidden" }}>
                              <div className="progress-animate" style={{ width: `${launch.progress}%`, height: "100%", background: "var(--grn)", borderRadius: 3 }} />
                            </div>
                            <span style={{ fontSize: "var(--fs-sm)", color: "var(--t1)", fontWeight: "var(--fw-semibold)" }}>{launch.progress}%</span>
                          </div>
                        </div>
                        <div>
                          <div style={{ fontSize: "var(--fs-2xs)", color: "var(--t3)", marginBottom: 4, fontWeight: "var(--fw-semibold)", letterSpacing: 0.3 }}>HOLDERS</div>
                          <div style={{ fontSize: "var(--fs-md)", fontWeight: "var(--fw-semibold)", color: "var(--t1)" }}>{launch.holders}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    );
  };

  // ---------------------------------------------------------------------------
  // USER PROFILE VIEW (for viewing other users)
  // ---------------------------------------------------------------------------

  const UserProfile = ({ address }: { address: string }) => {
    const [userCopied, setUserCopied] = useState(false);
    const [userProfileTab, setUserProfileTab] = useState<'positions' | 'activity' | 'created'>('positions');

    const handleUserCopy = () => {
      navigator.clipboard.writeText(address);
      setUserCopied(true);
      setTimeout(() => setUserCopied(false), 2000);
    };

    // Mock data for other user's profile
    const mockUserStats = useMemo(() => ({
      totalValue: Math.random() * 50 + 5,
      pnl: (Math.random() - 0.4) * 20,
      pnlPercent: (Math.random() - 0.3) * 100,
      tradesCount: Math.floor(Math.random() * 100) + 10,
      winRate: Math.floor(Math.random() * 40) + 45,
    }), []);

    const mockUserPositions = useMemo(() => {
      return launches.slice(0, Math.floor(Math.random() * 4) + 1).map(l => ({
        ...l,
        value: Math.random() * 5 + 0.1,
        pnl: (Math.random() - 0.4) * 50,
        tokens: Math.floor(Math.random() * 100000) + 1000
      }));
    }, [launches]);

    const mockUserActivity = useMemo(() => [
      { id: 'profile-act-1', type: 'buy' as const, token: launches[0]?.name || 'SAMPLE', amount: 0.5, time: '2h ago', value: Math.random() * 1000 },
      { id: 'profile-act-2', type: 'sell' as const, token: launches[1]?.name || 'TOKEN', amount: 0.3, time: '5h ago', value: Math.random() * 500 },
      { id: 'profile-act-3', type: 'buy' as const, token: launches[2]?.name || 'COIN', amount: 1.2, time: '1d ago', value: Math.random() * 2000 },
    ], [launches]);

    const mockCreatedLaunches = useMemo(() => {
      return launches.filter(() => Math.random() > 0.7).slice(0, 2);
    }, [launches]);

    const tabBtn = (k: 'positions' | 'activity' | 'created', l: string, count?: number) => (
      <button
        key={k}
        onClick={() => setUserProfileTab(k)}
        className="btn-press"
        style={{
          padding: "8px 18px",
          borderRadius: "var(--radius-full)",
          fontSize: "var(--fs-sm)",
          fontWeight: "var(--fw-semibold)",
          cursor: "pointer",
          border: "none",
          transition: "all .2s var(--ease-out-quart)",
          background: userProfileTab === k ? "var(--pb)" : "transparent",
          color: userProfileTab === k ? "var(--pt)" : "var(--t2)",
          fontFamily: "inherit",
          display: "flex",
          alignItems: "center",
          gap: 6
        }}
      >
        {l}
        {count !== undefined && (
          <span style={{
            fontSize: "var(--fs-2xs)",
            padding: "2px 7px",
            borderRadius: "var(--radius-full)",
            background: userProfileTab === k ? "rgba(0,0,0,0.2)" : "var(--glass2)",
            color: userProfileTab === k ? "var(--pt)" : "var(--t3)",
            fontWeight: 600
          }}>
            {count}
          </span>
        )}
      </button>
    );

    // Generate avatar gradient based on address
    const avatarGradient = useMemo(() => {
      const hash = address.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
      const hue1 = hash % 360;
      const hue2 = (hash * 2) % 360;
      return `linear-gradient(135deg, hsl(${hue1}, 70%, 50%), hsl(${hue2}, 70%, 40%))`;
    }, [address]);

    return (
      <div style={{ maxWidth: 1000, margin: "0 auto", padding: "var(--space-9) var(--space-6)", position: "relative", zIndex: 1 }}>
        <button
          onClick={() => go('home')}
          className="btn-press interactive-hover"
          aria-label="Go back"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "var(--space-2)",
            fontSize: "var(--fs-base)",
            color: "var(--t2)",
            background: "var(--glass)",
            border: "1px solid var(--glass-border)",
            borderRadius: "var(--radius-sm)",
            cursor: "pointer",
            marginBottom: "var(--space-5-5)",
            padding: "var(--space-2) var(--space-3-5)",
            fontFamily: "inherit"
          }}
        >
          <SvgBack /> Back
        </button>

        {/* User Profile Header */}
        <div className="glass-card page-enter-smooth" style={{
          padding: 0,
          marginBottom: 22,
          overflow: "hidden"
        }}>
          {/* Header gradient banner */}
          <div style={{
            height: 80,
            background: avatarGradient,
            position: "relative",
            opacity: 0.4
          }}>
            <div style={{
              position: "absolute",
              inset: 0,
              background: "radial-gradient(ellipse at 30% 0%, rgba(255, 255, 255, 0.1), transparent 50%)",
            }} />
          </div>

          <div style={{ padding: "0 28px 28px", marginTop: -36 }}>
            <div style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-end",
              flexWrap: "wrap",
              gap: 20
            }}>
              <div style={{ display: "flex", alignItems: "flex-end", gap: 18 }}>
                {/* Profile Avatar */}
                <UserAvatar address={address} size={84} gradient={avatarGradient} />

                {/* Profile Info */}
                <div style={{ paddingBottom: 4 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2-5)", marginBottom: 8 }}>
                    <h1 style={{
                      fontSize: "var(--fs-3xl)",
                      fontWeight: "var(--fw-bold)",
                      color: "var(--t1)",
                      fontFamily: "'JetBrains Mono', monospace",
                      letterSpacing: -0.5
                    }}>
                      {address.slice(0, 6)}...{address.slice(-4)}
                    </h1>
                    <button
                      onClick={handleUserCopy}
                      className="btn-press interactive-hover"
                      aria-label={userCopied ? "Address copied" : "Copy user address"}
                      style={{
                        background: userCopied ? "var(--gb)" : "var(--glass2)",
                        border: userCopied ? "1px solid var(--grn)" : "1px solid var(--glass-border)",
                        borderRadius: "var(--radius-sm)",
                        padding: "6px 12px",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: "var(--space-1-5)",
                        color: userCopied ? "var(--grn)" : "var(--t3)",
                        fontSize: "var(--fs-xs)",
                        fontWeight: "var(--fw-semibold)",
                        transition: "all .2s var(--ease-out-quart)"
                      }}
                    >
                      {userCopied ? <SvgCheck /> : <SvgCopy />}
                      {userCopied ? "Copied!" : "Copy"}
                    </button>
                  </div>
                  <div style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "var(--space-4)",
                    color: "var(--t3)",
                    fontSize: 13
                  }}>
                    <span style={{ display: "flex", alignItems: "center", gap: "var(--space-1-5)" }}>
                      <StatIcon type="target" size={13} color="var(--t3)" />
                      {mockUserStats.tradesCount} trades
                    </span>
                    <span style={{ display: "flex", alignItems: "center", gap: "var(--space-1-5)" }}>
                      <StatIcon type="chart" size={13} color="var(--t3)" />
                      {mockUserStats.winRate}% win rate
                    </span>
                  </div>
                </div>
              </div>

              {/* Stats badges */}
              <div style={{ display: "flex", gap: "var(--space-3)" }}>
                <div style={{
                  padding: "12px 18px",
                  borderRadius: "var(--radius-lg)",
                  background: "var(--glass2)",
                  border: "1px solid var(--glass-border)"
                }}>
                  <div style={{ fontSize: "var(--fs-xs)", color: "var(--t3)", marginBottom: 4 }}>Portfolio</div>
                  <div style={{ fontSize: "var(--fs-xl)", fontWeight: "var(--fw-bold)", color: "var(--t1)" }}>
                    {mockUserStats.totalValue.toFixed(2)} SOL
                  </div>
                </div>
                <div style={{
                  padding: "12px 18px",
                  borderRadius: "var(--radius-lg)",
                  background: mockUserStats.pnl >= 0 ? "var(--gb)" : "var(--rb)",
                  border: `1px solid ${mockUserStats.pnl >= 0 ? "var(--grn)" : "var(--red)"}`
                }}>
                  <div style={{ fontSize: "var(--fs-xs)", color: "var(--t3)", marginBottom: 4 }}>All-time P&L</div>
                  <div style={{
                    fontSize: "var(--fs-xl)",
                    fontWeight: "var(--fw-bold)",
                    color: mockUserStats.pnl >= 0 ? "var(--grn)" : "var(--red)"
                  }}>
                    {mockUserStats.pnl >= 0 ? "+" : ""}{mockUserStats.pnlPercent.toFixed(1)}%
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div style={{
          display: "flex",
          gap: "var(--space-1)",
          padding: 4,
          borderRadius: "var(--radius-full)",
          width: "fit-content",
          marginBottom: 18,
          background: "var(--glass2)",
        }}>
          {tabBtn('positions', 'Positions', mockUserPositions.length)}
          {tabBtn('activity', 'Activity', mockUserActivity.length)}
          {tabBtn('created', 'Created', mockCreatedLaunches.length)}
        </div>

        {/* Tab Content */}
        <div className="glass-card page-enter-smooth" style={{ padding: 0, overflow: "hidden" }}>
          {userProfileTab === 'positions' && (
            mockUserPositions.length === 0 ? (
              <div style={{ padding: "var(--space-12)", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center" }}>
                <div style={{ marginBottom: "var(--space-4)" }}><EmptyStateIcon type="inbox" size={48} /></div>
                <p style={{ color: "var(--t3)", fontSize: "var(--fs-sm)" }}>No positions yet</p>
              </div>
            ) : (
              <div>
                {mockUserPositions.map((pos, i) => (
                  <div
                    key={pos.id}
                    onClick={() => go('detail', pos)}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go('detail', pos); }}}
                    role="button"
                    tabIndex={0}
                    aria-label={`View ${pos.name} position`}
                    className="interactive-hover btn-press"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "var(--space-4) var(--space-5)",
                      borderBottom: i < mockUserPositions.length - 1 ? "1px solid var(--glass-border)" : "none",
                      cursor: "pointer",
                      transition: "background .15s ease"
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3-5)" }}>
                      <Avatar gi={pos.gi} size={42} />
                      <div>
                        <div style={{ fontWeight: "var(--fw-semibold)", color: "var(--t1)", marginBottom: 3 }}>{pos.name}</div>
                        <div style={{ fontSize: "var(--fs-sm)", color: "var(--t3)" }}>{pos.tokens.toLocaleString()} tokens</div>
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontWeight: "var(--fw-semibold)", color: "var(--t1)", marginBottom: 3 }}>{pos.value.toFixed(2)} SOL</div>
                      <div style={{
                        fontSize: "var(--fs-sm)",
                        fontWeight: "var(--fw-semibold)",
                        color: pos.pnl >= 0 ? "var(--grn)" : "var(--red)"
                      }}>
                        {pos.pnl >= 0 ? "+" : ""}{pos.pnl.toFixed(1)}%
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )
          )}

          {userProfileTab === 'activity' && (
            mockUserActivity.length === 0 ? (
              <div style={{ padding: "var(--space-12)", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center" }}>
                <div style={{ marginBottom: "var(--space-4)" }}><EmptyStateIcon type="activity" size={48} /></div>
                <p style={{ color: "var(--t3)", fontSize: "var(--fs-sm)" }}>No activity yet</p>
              </div>
            ) : (
              <div>
                {mockUserActivity.map((act, i) => (
                  <div
                    key={act.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "16px 20px",
                      borderBottom: i < mockUserActivity.length - 1 ? "1px solid var(--glass-border)" : "none"
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3-5)" }}>
                      <TradeIcon type={act.type} size={40} />
                      <div>
                        <div style={{ fontWeight: "var(--fw-semibold)", color: "var(--t1)", marginBottom: 3 }}>
                          {act.type === 'buy' ? 'Bought' : 'Sold'} {act.token}
                        </div>
                        <div style={{ fontSize: "var(--fs-sm)", color: "var(--t3)" }}>{act.time}</div>
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontWeight: "var(--fw-semibold)", color: "var(--t1)", marginBottom: 3 }}>{act.amount} SOL</div>
                      <div style={{ fontSize: "var(--fs-sm)", color: "var(--t3)" }}>{act.value.toLocaleString()} tokens</div>
                    </div>
                  </div>
                ))}
              </div>
            )
          )}

          {userProfileTab === 'created' && (
            mockCreatedLaunches.length === 0 ? (
              <div style={{ padding: "var(--space-12)", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center" }}>
                <div style={{ marginBottom: "var(--space-4)" }}><EmptyStateIcon type="rocket" size={48} /></div>
                <p style={{ color: "var(--t3)", fontSize: "var(--fs-sm)" }}>No tokens created yet</p>
              </div>
            ) : (
              <div>
                {mockCreatedLaunches.map((launch, i) => (
                  <div
                    key={launch.id}
                    onClick={() => go('detail', launch)}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go('detail', launch); }}}
                    role="button"
                    tabIndex={0}
                    aria-label={`View ${launch.name} token`}
                    className="interactive-hover btn-press"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "var(--space-4) var(--space-5)",
                      borderBottom: i < mockCreatedLaunches.length - 1 ? "1px solid var(--glass-border)" : "none",
                      cursor: "pointer",
                      transition: "background .15s ease"
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3-5)" }}>
                      <Avatar gi={launch.gi} size={42} />
                      <div>
                        <div style={{ fontWeight: "var(--fw-semibold)", color: "var(--t1)", marginBottom: 3 }}>{launch.name}</div>
                        <div style={{ fontSize: "var(--fs-sm)", color: "var(--t3)" }}>${launch.symbol}</div>
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontWeight: "var(--fw-semibold)", color: "var(--t1)", marginBottom: 3 }}>${(launch.marketCap / 1000).toFixed(1)}K</div>
                      <div style={{
                        fontSize: "var(--fs-sm)",
                        fontWeight: "var(--fw-semibold)",
                        color: launch.priceChange24h >= 0 ? "var(--grn)" : "var(--red)"
                      }}>
                        {launch.priceChange24h >= 0 ? "+" : ""}{launch.priceChange24h.toFixed(1)}%
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )
          )}
        </div>
      </div>
    );
  };

  // ---------------------------------------------------------------------------
  // SETTINGS VIEW
  // ---------------------------------------------------------------------------

  const Settings = () => {
    const [settingsTab, setSettingsTab] = useState<'general' | 'trading' | 'security' | 'advanced'>('general');

    const updateSettings = (updates: Partial<UserSettings>) => {
      setSettings(prev => ({ ...prev, ...updates }));
    };

    const updateNotification = (key: keyof UserSettings['notifications'], value: boolean) => {
      setSettings(prev => ({
        ...prev,
        notifications: { ...prev.notifications, [key]: value }
      }));
    };

    const updateTradingLimits = (key: keyof UserSettings['tradingLimits'], value: number | boolean) => {
      setSettings(prev => ({
        ...prev,
        tradingLimits: { ...prev.tradingLimits, [key]: value }
      }));
    };

    const Toggle = ({ checked, onChange, label, description }: { checked: boolean; onChange: () => void; label: string; description?: string }) => (
      <div
        onClick={onChange}
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "16px 0",
          cursor: "pointer",
          transition: "all .15s"
        }}
        className="interactive-hover"
        role="switch"
        aria-checked={checked}
      >
        <div style={{ flex: 1, paddingRight: 16 }}>
          <span style={{
            fontSize: "var(--fs-md)",
            color: "var(--t1)",
            fontWeight: "var(--fw-medium)",
            display: "block"
          }}>
            {label}
          </span>
          {description && (
            <p style={{
              fontSize: "var(--fs-sm)",
              color: "var(--t3)",
              marginTop: 4,
              lineHeight: 1.4
            }}>
              {description}
            </p>
          )}
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); onChange(); }}
          className="btn-press"
          aria-label={label}
          style={{
            width: 52,
            height: 28,
            borderRadius: "var(--radius-lg)",
            background: checked
              ? "linear-gradient(135deg, #34d399, #22C55E)"
              : "var(--glass2)",
            border: "1px solid",
            borderColor: checked ? "transparent" : "var(--glass-border)",
            cursor: "pointer",
            position: "relative",
            transition: "all .25s var(--ease-out-quart)",
            flexShrink: 0,
            boxShadow: checked ? "0 4px 12px rgba(34, 197, 94, 0.3)" : "none"
          }}
        >
          <div style={{
            width: 22,
            height: 22,
            borderRadius: "50%",
            background: "white",
            position: "absolute",
            top: 2,
            left: checked ? 27 : 3,
            transition: "all .25s var(--ease-out-quart)",
            boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
            transform: checked ? "scale(1)" : "scale(0.95)"
          }} />
        </button>
      </div>
    );

    const SettingSection = ({ title, children, icon }: { title: string; children: React.ReactNode; icon?: string }) => (
      <div style={{ marginBottom: 28 }} className="stagger-item">
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: "var(--space-2)",
          marginBottom: 14
        }}>
          {icon && <span style={{ fontSize: "var(--fs-md)" }}>{icon}</span>}
          <h3 style={{
            fontSize: "var(--fs-xs)",
            fontWeight: "var(--fw-bold)",
            color: "var(--t3)",
            letterSpacing: 0.8,
            textTransform: "uppercase"
          }}>
            {title}
          </h3>
        </div>
        <div className="glass-card-inner" style={{
          borderRadius: "var(--radius-md)",
          padding: "var(--space-5)",
          background: "linear-gradient(135deg, var(--glass), var(--glass2))"
        }}>
          {children}
        </div>
      </div>
    );

    const settingsTabBtn = (k: 'general' | 'trading' | 'advanced', label: string, icon: string) => (
      <button
        onClick={() => setSettingsTab(k)}
        className="btn-press"
        style={{
          display: "flex",
          alignItems: "center",
          gap: "var(--space-2)",
          padding: "10px 16px",
          borderRadius: "var(--radius-md)",
          fontSize: "var(--fs-base)",
          fontWeight: "var(--fw-semibold)",
          cursor: "pointer",
          border: "1px solid",
          borderColor: settingsTab === k ? "var(--grn)" : "transparent",
          background: settingsTab === k ? "var(--gb)" : "var(--glass)",
          color: settingsTab === k ? "var(--grn)" : "var(--t2)",
          fontFamily: "inherit",
          transition: "all .2s var(--ease-out-quart)"
        }}
      >
        <span style={{ fontSize: "var(--fs-md)" }}>{icon}</span>
        {label}
      </button>
    );

    return (
      <div style={{ maxWidth: 700, margin: "0 auto", padding: "var(--space-9) var(--space-6)", position: "relative", zIndex: 1 }}>
        <button
          onClick={() => go('home')}
          className="btn-press interactive-hover"
          aria-label="Go back"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "var(--space-2)",
            fontSize: "var(--fs-base)",
            color: "var(--t2)",
            background: "var(--glass)",
            border: "1px solid var(--glass-border)",
            borderRadius: "var(--radius-sm)",
            cursor: "pointer",
            marginBottom: "var(--space-5-5)",
            padding: "var(--space-2) var(--space-3-5)",
            fontFamily: "inherit"
          }}
        >
          <SvgBack /> Back
        </button>

        {/* Header - Enhanced */}
        <div className="glass-card page-enter-smooth" style={{
          padding: 0,
          marginBottom: "var(--space-5)",
          overflow: "hidden"
        }}>
          {/* Header gradient banner */}
          <div style={{
            padding: "28px 28px 0",
            background: "linear-gradient(135deg, rgba(99, 102, 241, 0.08), rgba(139, 92, 246, 0.05))",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "var(--space-4)", marginBottom: 24 }}>
              <div style={{
                width: 60,
                height: 60,
                borderRadius: "var(--radius-lg)",
                background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 12px 32px rgba(99, 102, 241, 0.35)"
              }}>
                <SvgSettings />
              </div>
              <div>
                <h1 style={{
                  fontSize: "var(--fs-3xl)",
                  fontWeight: "var(--fw-bold)",
                  color: "var(--t1)",
                  letterSpacing: -0.5
                }}>
                  Settings
                </h1>
                <p style={{
                  fontSize: "var(--fs-base)",
                  color: "var(--t2)",
                  marginTop: 4
                }}>
                  Customize your trading experience
                </p>
              </div>
            </div>
          </div>

          {/* Tab Navigation - Enhanced */}
          <div style={{
            display: "flex",
            gap: 0,
            borderTop: "1px solid var(--glass-border)",
            background: "var(--glass)"
          }}>
            {(['general', 'trading', 'security', 'advanced'] as const).map((k) => {
              const tabConfig: Record<string, { label: string; iconType: 'settings' | 'trading' | 'target' | 'code'; desc: string }> = {
                general: { label: 'General', iconType: 'settings', desc: 'Theme & display' },
                trading: { label: 'Trading', iconType: 'trading', desc: 'Limits & priority' },
                security: { label: 'Security', iconType: 'target', desc: 'Protection & access' },
                advanced: { label: 'Advanced', iconType: 'code', desc: 'RPC & data' }
              };
              const tab = tabConfig[k];
              const isActive = settingsTab === k;

              return (
                <button
                  key={k}
                  onClick={() => setSettingsTab(k)}
                  className="btn-press interactive-hover"
                  style={{
                    flex: 1,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: "var(--space-1)",
                    padding: "var(--space-3-5) var(--space-2)",
                    fontSize: "var(--fs-sm)",
                    fontWeight: "var(--fw-semibold)",
                    cursor: "pointer",
                    border: "none",
                    borderBottom: isActive ? "2px solid var(--grn)" : "2px solid transparent",
                    background: isActive ? "var(--glass2)" : "transparent",
                    color: isActive ? "var(--t1)" : "var(--t2)",
                    fontFamily: "inherit",
                    transition: "all .2s var(--ease-out-quart)"
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "var(--space-1-5)" }}>
                    <StatIcon type={tab.iconType} size={14} color={isActive ? "var(--t1)" : "var(--t2)"} />
                    {tab.label}
                  </div>
                  <span style={{
                    fontSize: "var(--fs-3xs)",
                    color: isActive ? "var(--t3)" : "var(--t3)",
                    fontWeight: "var(--fw-normal)",
                    opacity: isActive ? 1 : 0.6
                  }}>
                    {tab.desc}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Settings Content */}
        <div className="glass-card tab-content-enter" key={settingsTab} style={{ padding: 24 }}>
          {settingsTab === 'general' && (
            <>
              {/* Appearance */}
              <SettingSection title="Appearance">
                <label style={{ fontSize: "var(--fs-sm)", color: "var(--t2)", display: "block", marginBottom: 10, fontWeight: "var(--fw-medium)" }}>Theme</label>
                <div style={{ display: "flex", gap: "var(--space-2-5)" }}>
                  {[
                    { key: 'dark' as const, label: 'Dark', icon: <SvgMoon />, desc: 'Easy on the eyes' },
                    { key: 'light' as const, label: 'Light', icon: <SvgSun />, desc: 'Classic look' },
                  ].map((theme) => (
                    <button
                      key={theme.key}
                      onClick={() => {
                        updateSettings({ theme: theme.key });
                        setIsDark(theme.key === 'dark');
                      }}
                      className="glass-pill btn-press"
                      style={s(bsS, {
                        flex: 1,
                        height: 56,
                        fontSize: "var(--fs-md)",
                        fontWeight: "var(--fw-semibold)",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "var(--space-1)",
                        background: settings.theme === theme.key ? "var(--pb)" : "var(--sb)",
                        color: settings.theme === theme.key ? "var(--pt)" : "var(--st)",
                        border: settings.theme === theme.key ? "2px solid var(--grn)" : "2px solid transparent"
                      })}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-1-5)" }}>
                        {theme.icon}
                        {theme.label}
                      </div>
                    </button>
                  ))}
                </div>
              </SettingSection>

              {/* Display Currency */}
              <SettingSection title="Display Currency">
                <div style={{ display: "flex", gap: "var(--space-2-5)" }}>
                  {(['USD', 'SOL'] as const).map((curr) => (
                    <button
                      key={curr}
                      onClick={() => updateSettings({ currency: curr })}
                      className="glass-pill btn-press"
                      style={s(bsS, {
                        flex: 1,
                        height: 44,
                        fontSize: "var(--fs-md)",
                        fontWeight: "var(--fw-semibold)",
                        background: settings.currency === curr ? "var(--pb)" : "var(--sb)",
                        color: settings.currency === curr ? "var(--pt)" : "var(--st)",
                        border: settings.currency === curr ? "2px solid var(--grn)" : "2px solid transparent"
                      })}
                    >
                      {curr === 'USD' ? '$ USD' : '◎ SOL'}
                    </button>
                  ))}
                </div>
              </SettingSection>

              {/* Display Density */}
              <SettingSection title="Display Density">
                <p style={{ fontSize: "var(--fs-sm)", color: "var(--t3)", marginBottom: "var(--space-3-5)", lineHeight: 1.5 }}>
                  Adjust the information density throughout the interface.
                </p>
                <div style={{ display: "flex", gap: "var(--space-2-5)" }}>
                  {[
                    { key: 'compact' as const, label: 'Compact', desc: 'More info, less space' },
                    { key: 'comfortable' as const, label: 'Comfortable', desc: 'Balanced layout' },
                    { key: 'spacious' as const, label: 'Spacious', desc: 'More breathing room' },
                  ].map((density) => (
                    <button
                      key={density.key}
                      onClick={() => updateSettings({ displayDensity: density.key })}
                      className="glass-pill btn-press"
                      style={s(bsS, {
                        flex: 1,
                        height: 56,
                        fontSize: "var(--fs-sm)",
                        fontWeight: "var(--fw-semibold)",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "var(--space-1)",
                        background: settings.displayDensity === density.key ? "var(--pb)" : "var(--sb)",
                        color: settings.displayDensity === density.key ? "var(--pt)" : "var(--st)",
                        border: settings.displayDensity === density.key ? "2px solid var(--grn)" : "2px solid transparent"
                      })}
                    >
                      <span>{density.label}</span>
                    </button>
                  ))}
                </div>
              </SettingSection>

              {/* Notifications */}
              <SettingSection title="Notifications">
                <Toggle
                  checked={settings.notifications.priceAlerts}
                  onChange={() => updateNotification('priceAlerts', !settings.notifications.priceAlerts)}
                  label="Price Alerts"
                  description="Get notified on significant price changes"
                />
                <div style={{ borderBottom: "1px solid var(--glass-border)" }} />
                <Toggle
                  checked={settings.notifications.graduationAlerts}
                  onChange={() => updateNotification('graduationAlerts', !settings.notifications.graduationAlerts)}
                  label="Graduation Alerts"
                  description="When tokens reach graduation threshold"
                />
                <div style={{ borderBottom: "1px solid var(--glass-border)" }} />
                <Toggle
                  checked={settings.notifications.tradeConfirmations}
                  onChange={() => updateNotification('tradeConfirmations', !settings.notifications.tradeConfirmations)}
                  label="Trade Confirmations"
                  description="Confirm before executing trades"
                />
                <div style={{ borderBottom: "1px solid var(--glass-border)" }} />
                <Toggle
                  checked={settings.notifications.newLaunches}
                  onChange={() => updateNotification('newLaunches', !settings.notifications.newLaunches)}
                  label="New Launch Alerts"
                  description="Get notified when new tokens launch"
                />
                <div style={{ borderBottom: "1px solid var(--glass-border)" }} />
                <Toggle
                  checked={settings.notifications.portfolioUpdates}
                  onChange={() => updateNotification('portfolioUpdates', !settings.notifications.portfolioUpdates)}
                  label="Portfolio Updates"
                  description="Daily summary of your portfolio performance"
                />
              </SettingSection>

              {/* Sound & Accessibility */}
              <SettingSection title="Sound & Accessibility">
                <Toggle
                  checked={settings.soundEffects}
                  onChange={() => updateSettings({ soundEffects: !settings.soundEffects })}
                  label="Sound Effects"
                  description="Audio feedback for trades and alerts"
                />
              </SettingSection>
            </>
          )}

          {settingsTab === 'trading' && (
            <>
              {/* Slippage */}
              <SettingSection title="Default Slippage Tolerance">
                <p style={{ fontSize: "var(--fs-sm)", color: "var(--t3)", marginBottom: "var(--space-3-5)", lineHeight: 1.5 }}>
                  Maximum price change you're willing to accept. Higher = more likely to execute but may get worse price.
                </p>
                <div style={{ display: "flex", gap: "var(--space-2)" }}>
                  {[0.5, 1, 2, 3, 5, 10].map((slip) => (
                    <button
                      key={slip}
                      onClick={() => updateSettings({ defaultSlippage: slip })}
                      className="glass-pill btn-press"
                      style={s(bsS, {
                        flex: 1,
                        height: 42,
                        fontSize: "var(--fs-base)",
                        fontWeight: "var(--fw-semibold)",
                        background: settings.defaultSlippage === slip ? "var(--pb)" : "var(--sb)",
                        color: settings.defaultSlippage === slip ? "var(--pt)" : "var(--st)",
                        border: settings.defaultSlippage === slip ? "2px solid var(--grn)" : "2px solid transparent"
                      })}
                    >
                      {slip}%
                    </button>
                  ))}
                </div>
                <p style={{ fontSize: "var(--fs-xs)", color: "var(--t3)", marginTop: 10 }}>
                  Current: <span style={{ color: "var(--grn)", fontWeight: "var(--fw-semibold)" }}>{settings.defaultSlippage}%</span> slippage tolerance
                </p>
              </SettingSection>

              {/* Quick Trade Amounts */}
              <SettingSection title="Quick Trade Amounts">
                <p style={{ fontSize: "var(--fs-sm)", color: "var(--t3)", marginBottom: "var(--space-3-5)", lineHeight: 1.5 }}>
                  Preset amounts for faster trading. Click to set default.
                </p>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "var(--space-2)" }}>
                  {[0.1, 0.25, 0.5, 1, 2, 5, 10, 25].map((amt, i) => (
                    <div
                      key={amt}
                      className="glass-card-inner"
                      style={{
                        padding: "12px 8px",
                        textAlign: "center",
                        borderRadius: "var(--radius-md)",
                        cursor: "pointer",
                        transition: "all .15s"
                      }}
                    >
                      <div style={{ fontSize: "var(--fs-md)", fontWeight: "var(--fw-bold)", color: "var(--t1)", fontFamily: "'JetBrains Mono', monospace" }}>{amt}</div>
                      <div style={{ fontSize: "var(--fs-2xs)", color: "var(--t3)", marginTop: 2 }}>SOL</div>
                    </div>
                  ))}
                </div>
              </SettingSection>

              {/* Priority Fee */}
              <SettingSection title="Transaction Priority">
                <p style={{ fontSize: "var(--fs-sm)", color: "var(--t3)", marginBottom: "var(--space-2)", lineHeight: 1.5 }}>
                  Priority fees incentivize validators to include your transaction faster. Choose based on network congestion and urgency.
                </p>
                <div style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "var(--space-2)",
                  padding: "var(--space-2) var(--space-3)",
                  marginBottom: "var(--space-3)",
                  borderRadius: "var(--radius-sm)",
                  background: "var(--glass)",
                  border: "1px solid var(--glass-border)"
                }}>
                  <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="var(--grn)" strokeWidth={2}>
                    <circle cx={12} cy={12} r={10}/>
                    <path d="M12 6v6l4 2"/>
                  </svg>
                  <span style={{ fontSize: "var(--fs-xs)", color: "var(--t2)" }}>
                    Solana averages ~400ms block times with ~$0.00025 base fees
                  </span>
                </div>
                <div style={{ display: "flex", gap: "var(--space-2-5)" }}>
                  {[
                    { key: 'low', label: 'Standard', time: '10-30s', fee: '~0.00005 SOL' },
                    { key: 'medium', label: 'Fast', time: '5-10s', fee: '~0.0001 SOL' },
                    { key: 'high', label: 'Turbo', time: '1-5s', fee: '~0.0005 SOL' },
                  ].map((priority) => (
                    <button
                      key={priority.key}
                      onClick={() => updateSettings({ priority: priority.key as 'low' | 'medium' | 'high' })}
                      className="glass-pill btn-press interactive-hover"
                      aria-label={`${priority.label} priority: ${priority.time} confirmation, ${priority.fee}`}
                      style={s(bsS, {
                        flex: 1,
                        height: 76,
                        fontSize: "var(--fs-sm)",
                        fontWeight: "var(--fw-semibold)",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "var(--space-0-5)",
                        background: settings.priority === priority.key ? "var(--pb)" : "var(--sb)",
                        color: settings.priority === priority.key ? "var(--pt)" : "var(--st)",
                        border: settings.priority === priority.key ? "2px solid var(--grn)" : "2px solid transparent"
                      })}
                    >
                      <span>{priority.label}</span>
                      <span style={{ fontSize: "var(--fs-2xs)", opacity: 0.7 }}>{priority.time}</span>
                      <span style={{ fontSize: "var(--fs-3xs)", opacity: 0.5 }}>{priority.fee}</span>
                    </button>
                  ))}
                </div>
              </SettingSection>

              {/* Risk Management */}
              <SettingSection title="Risk Management">
                <Toggle
                  checked={settings.tradingLimits.enabled}
                  onChange={() => updateTradingLimits('enabled', !settings.tradingLimits.enabled)}
                  label="Enable Trading Limits"
                  description="Protect yourself with maximum trade sizes and daily limits"
                />
                {settings.tradingLimits.enabled && (
                  <>
                    <div style={{ borderBottom: "1px solid var(--glass-border)", margin: "8px 0" }} />
                    <div style={{ marginTop: 16 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                        <span style={{ fontSize: "var(--fs-sm)", color: "var(--t2)", fontWeight: "var(--fw-medium)" }}>Max Trade Size</span>
                        <span style={{ fontSize: "var(--fs-sm)", color: "var(--t1)", fontWeight: "var(--fw-semibold)", fontFamily: "'JetBrains Mono', monospace" }}>
                          {settings.tradingLimits.maxTradeSize} SOL
                        </span>
                      </div>
                      <div style={{ display: "flex", gap: "var(--space-2)" }}>
                        {[10, 25, 50, 100, 250].map((amt) => (
                          <button
                            key={amt}
                            onClick={() => updateTradingLimits('maxTradeSize', amt)}
                            className="glass-pill btn-press"
                            style={s(bsS, {
                              flex: 1,
                              height: 36,
                              fontSize: "var(--fs-xs)",
                              fontWeight: "var(--fw-semibold)",
                              background: settings.tradingLimits.maxTradeSize === amt ? "var(--pb)" : "var(--sb)",
                              color: settings.tradingLimits.maxTradeSize === amt ? "var(--pt)" : "var(--st)",
                              border: settings.tradingLimits.maxTradeSize === amt ? "2px solid var(--grn)" : "2px solid transparent"
                            })}
                          >
                            {amt}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div style={{ marginTop: 20 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                        <span style={{ fontSize: "var(--fs-sm)", color: "var(--t2)", fontWeight: "var(--fw-medium)" }}>Daily Trading Limit</span>
                        <span style={{ fontSize: "var(--fs-sm)", color: "var(--t1)", fontWeight: "var(--fw-semibold)", fontFamily: "'JetBrains Mono', monospace" }}>
                          {settings.tradingLimits.dailyLimit} SOL
                        </span>
                      </div>
                      <div style={{ display: "flex", gap: "var(--space-2)" }}>
                        {[100, 250, 500, 1000, 2500].map((amt) => (
                          <button
                            key={amt}
                            onClick={() => updateTradingLimits('dailyLimit', amt)}
                            className="glass-pill btn-press"
                            style={s(bsS, {
                              flex: 1,
                              height: 36,
                              fontSize: "var(--fs-xs)",
                              fontWeight: "var(--fw-semibold)",
                              background: settings.tradingLimits.dailyLimit === amt ? "var(--pb)" : "var(--sb)",
                              color: settings.tradingLimits.dailyLimit === amt ? "var(--pt)" : "var(--st)",
                              border: settings.tradingLimits.dailyLimit === amt ? "2px solid var(--grn)" : "2px solid transparent"
                            })}
                          >
                            {amt}
                          </button>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </SettingSection>

              {/* Chart Preferences */}
              <SettingSection title="Chart Preferences">
                <div style={{ marginBottom: 16 }}>
                  <label style={{ fontSize: "var(--fs-sm)", color: "var(--t2)", display: "block", marginBottom: 10, fontWeight: "var(--fw-medium)" }}>Chart Type</label>
                  <div style={{ display: "flex", gap: "var(--space-2-5)" }}>
                    {[
                      { key: 'candle' as const, label: 'Candlestick' },
                      { key: 'line' as const, label: 'Line' },
                      { key: 'area' as const, label: 'Area' },
                    ].map((chart) => (
                      <button
                        key={chart.key}
                        onClick={() => updateSettings({ chartType: chart.key })}
                        className="glass-pill btn-press"
                        style={s(bsS, {
                          flex: 1,
                          height: 42,
                          fontSize: "var(--fs-sm)",
                          fontWeight: "var(--fw-semibold)",
                          background: settings.chartType === chart.key ? "var(--pb)" : "var(--sb)",
                          color: settings.chartType === chart.key ? "var(--pt)" : "var(--st)",
                          border: settings.chartType === chart.key ? "2px solid var(--grn)" : "2px solid transparent"
                        })}
                      >
                        {chart.label}
                      </button>
                    ))}
                  </div>
                </div>
                <Toggle
                  checked={settings.showIndicators}
                  onChange={() => updateSettings({ showIndicators: !settings.showIndicators })}
                  label="Show Technical Indicators"
                  description="Display moving averages and volume on charts"
                />
              </SettingSection>
            </>
          )}

          {settingsTab === 'security' && (
            <>
              {/* Session Security */}
              <SettingSection title="Session Security">
                <div style={{ marginBottom: 16 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    <span style={{ fontSize: "var(--fs-sm)", color: "var(--t2)", fontWeight: "var(--fw-medium)" }}>Auto-Lock Timeout</span>
                    <span style={{ fontSize: "var(--fs-sm)", color: "var(--t1)", fontWeight: "var(--fw-semibold)", fontFamily: "'JetBrains Mono', monospace" }}>
                      {settings.sessionTimeout} min
                    </span>
                  </div>
                  <p style={{ fontSize: "var(--fs-xs)", color: "var(--t3)", marginBottom: 12 }}>
                    Automatically lock wallet connection after inactivity.
                  </p>
                  <div style={{ display: "flex", gap: "var(--space-2)" }}>
                    {[15, 30, 60, 120, 0].map((timeout) => (
                      <button
                        key={timeout}
                        onClick={() => updateSettings({ sessionTimeout: timeout })}
                        className="glass-pill btn-press"
                        style={s(bsS, {
                          flex: 1,
                          height: 36,
                          fontSize: "var(--fs-xs)",
                          fontWeight: "var(--fw-semibold)",
                          background: settings.sessionTimeout === timeout ? "var(--pb)" : "var(--sb)",
                          color: settings.sessionTimeout === timeout ? "var(--pt)" : "var(--st)",
                          border: settings.sessionTimeout === timeout ? "2px solid var(--grn)" : "2px solid transparent"
                        })}
                      >
                        {timeout === 0 ? 'Never' : `${timeout}m`}
                      </button>
                    ))}
                  </div>
                </div>
              </SettingSection>

              {/* Two-Factor Authentication */}
              <SettingSection title="Two-Factor Authentication">
                <Toggle
                  checked={settings.twoFactorEnabled}
                  onChange={() => {
                    if (!settings.twoFactorEnabled) {
                      showToast('2FA setup would require wallet signature verification', 'info');
                    }
                    updateSettings({ twoFactorEnabled: !settings.twoFactorEnabled });
                  }}
                  label="Enable 2FA for Trades"
                  description="Require additional confirmation for large trades"
                />
                {settings.twoFactorEnabled && (
                  <div style={{ marginTop: "var(--space-4)", padding: "var(--space-3-5)", borderRadius: "var(--radius-md)", background: "var(--gb)", border: "1px solid rgba(34,197,94,0.2)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", marginBottom: 6 }}>
                      <SvgCheck />
                      <span style={{ fontSize: "var(--fs-sm)", fontWeight: "var(--fw-semibold)", color: "var(--grn)" }}>2FA Active</span>
                    </div>
                    <p style={{ fontSize: "var(--fs-xs)", color: "var(--t2)" }}>
                      Trades above your max trade size will require wallet signature confirmation.
                    </p>
                  </div>
                )}
              </SettingSection>

              {/* Connected Wallet */}
              <SettingSection title="Connected Wallet">
                {wallet.connected ? (
                  <div className="glass-card-inner" style={{ padding: "var(--space-4)", borderRadius: "var(--radius-md)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2-5)" }}>
                        <div style={{
                          width: 36,
                          height: 36,
                          borderRadius: "var(--radius-md)",
                          background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center"
                        }}>
                          <SvgWallet />
                        </div>
                        <div>
                          <div style={{ fontSize: "var(--fs-base)", fontWeight: "var(--fw-semibold)", color: "var(--t1)", fontFamily: "'JetBrains Mono', monospace" }}>
                            {wallet.address?.slice(0, 6)}...{wallet.address?.slice(-4)}
                          </div>
                          <div style={{ fontSize: "var(--fs-xs)", color: "var(--t3)" }}>Connected via Phantom</div>
                        </div>
                      </div>
                      <span style={{
                        padding: "4px 10px",
                        borderRadius: "var(--radius-full)",
                        background: "var(--gb)",
                        color: "var(--grn)",
                        fontSize: "var(--fs-2xs)",
                        fontWeight: 600
                      }}>
                        Active
                      </span>
                    </div>
                    <div style={{ display: "flex", gap: "var(--space-2-5)" }}>
                      <button
                        onClick={() => {
                          if (wallet.address) {
                            navigator.clipboard.writeText(wallet.address);
                            showToast('Address copied to clipboard', 'success');
                          }
                        }}
                        className="glass-pill btn-press interactive-hover"
                        style={s(bsS, { flex: 1, height: 36, fontSize: "var(--fs-xs)" })}
                      >
                        Copy Address
                      </button>
                      <button
                        onClick={() => wallet.disconnect()}
                        className="glass-pill btn-press interactive-hover"
                        style={s(bsS, { flex: 1, height: 36, fontSize: "var(--fs-xs)", color: "var(--red)" })}
                      >
                        Disconnect
                      </button>
                    </div>
                  </div>
                ) : (
                  <div style={{ textAlign: "center", padding: "24px 0" }}>
                    <p style={{ fontSize: "var(--fs-base)", color: "var(--t2)", marginBottom: 16 }}>No wallet connected</p>
                    <button
                      onClick={() => wallet.connect()}
                      className="btn-press interactive-hover"
                      style={s(bpS, { height: 40, padding: "0 24px", fontSize: "var(--fs-base)" })}
                    >
                      Connect Wallet
                    </button>
                  </div>
                )}
              </SettingSection>

              {/* Keyboard Shortcuts */}
              <SettingSection title="Keyboard Shortcuts">
                <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
                  {[
                    { key: 'H', action: 'Go to Home' },
                    { key: 'L', action: 'View Launches' },
                    { key: 'C', action: 'Create Token' },
                    { key: 'R', action: 'Refresh Data' },
                    { key: 'Esc', action: 'Close Modal' },
                  ].map((shortcut) => (
                    <div key={shortcut.key} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0" }}>
                      <span style={{ fontSize: "var(--fs-sm)", color: "var(--t2)" }}>{shortcut.action}</span>
                      <kbd style={{
                        padding: "4px 10px",
                        borderRadius: "var(--radius-xs)",
                        background: "var(--glass2)",
                        border: "1px solid var(--glass-border)",
                        fontSize: "var(--fs-xs)",
                        fontWeight: "var(--fw-semibold)",
                        color: "var(--t1)",
                        fontFamily: "'JetBrains Mono', monospace"
                      }}>
                        {shortcut.key}
                      </kbd>
                    </div>
                  ))}
                </div>
              </SettingSection>
            </>
          )}

          {settingsTab === 'advanced' && (
            <>
              {/* RPC Settings */}
              <SettingSection title="RPC Endpoint">
                <p style={{ fontSize: "var(--fs-sm)", color: "var(--t3)", marginBottom: "var(--space-3-5)", lineHeight: 1.5 }}>
                  Choose your Solana RPC provider for best performance in your region.
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
                  {[
                    { key: 'helius' as const, name: 'Helius', endpoint: 'https://mainnet.helius-rpc.com', status: 'Fast' },
                    { key: 'quicknode' as const, name: 'Quicknode', endpoint: 'https://solana-mainnet.quiknode.pro', status: 'Fast' },
                    { key: 'default' as const, name: 'Default', endpoint: 'https://api.mainnet-beta.solana.com', status: 'Standard' },
                  ].map((rpc) => (
                    <div
                      key={rpc.key}
                      onClick={() => updateSettings({ rpc: rpc.key })}
                      className="glass-card-inner btn-press interactive-hover"
                      style={{
                        padding: "var(--space-3-5)",
                        borderRadius: "var(--radius-md)",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        cursor: "pointer",
                        border: settings.rpc === rpc.key ? "2px solid var(--grn)" : "2px solid transparent",
                        transition: "all 0.2s var(--ease-out-quart)"
                      }}
                    >
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
                          <div style={{ fontSize: "var(--fs-base)", fontWeight: "var(--fw-semibold)", color: "var(--t1)" }}>{rpc.name}</div>
                          {settings.rpc === rpc.key && (
                            <span style={{
                              fontSize: "var(--fs-3xs)",
                              fontWeight: "var(--fw-semibold)",
                              padding: "2px 6px",
                              borderRadius: 4,
                              background: "var(--gb)",
                              color: "var(--grn)",
                              textTransform: "uppercase"
                            }}>
                              Active
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: "var(--fs-xs)", color: "var(--t3)", fontFamily: "'JetBrains Mono', monospace", marginTop: 2 }}>
                          {rpc.endpoint.slice(0, 35)}...
                        </div>
                      </div>
                      <span style={{
                        fontSize: "var(--fs-2xs)",
                        fontWeight: "var(--fw-semibold)",
                        padding: "4px 8px",
                        borderRadius: "var(--radius-xs)",
                        background: rpc.status === 'Fast' ? "var(--gb)" : "var(--glass2)",
                        color: rpc.status === 'Fast' ? "var(--grn)" : "var(--t3)"
                      }}>
                        {rpc.status}
                      </span>
                    </div>
                  ))}
                </div>
              </SettingSection>

              {/* Auto-Refresh Settings */}
              <SettingSection title="Real-Time Data">
                <Toggle
                  checked={settings.autoRefresh}
                  onChange={() => updateSettings({ autoRefresh: !settings.autoRefresh })}
                  label="Auto-Refresh"
                  description="Automatically refresh price and market data"
                />
                {settings.autoRefresh && (
                  <>
                    <div style={{ borderBottom: "1px solid var(--glass-border)", margin: "8px 0" }} />
                    <div style={{ marginTop: 12 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                        <span style={{ fontSize: "var(--fs-sm)", color: "var(--t2)", fontWeight: "var(--fw-medium)" }}>Refresh Interval</span>
                        <span style={{ fontSize: "var(--fs-sm)", color: "var(--t1)", fontWeight: "var(--fw-semibold)", fontFamily: "'JetBrains Mono', monospace" }}>
                          {settings.refreshInterval}s
                        </span>
                      </div>
                      <div style={{ display: "flex", gap: "var(--space-2)" }}>
                        {[10, 15, 30, 60, 120].map((interval) => (
                          <button
                            key={interval}
                            onClick={() => updateSettings({ refreshInterval: interval })}
                            className="glass-pill btn-press"
                            style={s(bsS, {
                              flex: 1,
                              height: 36,
                              fontSize: "var(--fs-xs)",
                              fontWeight: "var(--fw-semibold)",
                              background: settings.refreshInterval === interval ? "var(--pb)" : "var(--sb)",
                              color: settings.refreshInterval === interval ? "var(--pt)" : "var(--st)",
                              border: settings.refreshInterval === interval ? "2px solid var(--grn)" : "2px solid transparent"
                            })}
                          >
                            {interval}s
                          </button>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </SettingSection>

              {/* Advanced Mode */}
              <SettingSection title="Developer Options">
                <Toggle
                  checked={settings.advancedMode}
                  onChange={() => updateSettings({ advancedMode: !settings.advancedMode })}
                  label="Advanced Mode"
                  description="Show additional technical information and debug data"
                />
                {settings.advancedMode && (
                  <div style={{ marginTop: "var(--space-3)", padding: "var(--space-3)", borderRadius: "var(--radius-md)", background: "rgba(251, 191, 36, 0.1)", border: "1px solid rgba(251, 191, 36, 0.2)" }}>
                    <p style={{ fontSize: "var(--fs-xs)", color: "var(--amb)" }}>
                      Advanced mode enabled. You'll see additional debugging info, raw transaction data, and program account details.
                    </p>
                  </div>
                )}
              </SettingSection>

              {/* Data & Privacy */}
              <SettingSection title="Data & Privacy">
                <Toggle
                  checked={settings.analytics}
                  onChange={() => updateSettings({ analytics: !settings.analytics })}
                  label="Analytics"
                  description="Help improve Launchr with anonymous usage data"
                />
                <div style={{ borderBottom: "1px solid var(--glass-border)" }} />
                <div style={{ padding: "14px 0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <span style={{ fontSize: "var(--fs-base)", color: "var(--t1)", fontWeight: "var(--fw-medium)" }}>Export Data</span>
                    <p style={{ fontSize: "var(--fs-xs)", color: "var(--t3)", marginTop: 3 }}>Download your trading history</p>
                  </div>
                  <button
                    className="glass-pill btn-press interactive-hover"
                    onClick={() => {
                      // Create and download CSV
                      const csvData = detailedTransactions.map(tx =>
                        `${tx.type},${tx.launch},${tx.symbol},${tx.amount},${tx.sol},${tx.timestamp},${tx.txSignature}`
                      ).join('\n');
                      const header = 'type,launch,symbol,amount,sol,timestamp,signature\n';
                      const blob = new Blob([header + csvData], { type: 'text/csv' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `launchr-history-${new Date().toISOString().split('T')[0]}.csv`;
                      a.click();
                      URL.revokeObjectURL(url);
                      showToast('Trading history exported', 'success');
                    }}
                    style={s(bsS, { height: 34, padding: "0 14px", fontSize: "var(--fs-sm)", fontWeight: "var(--fw-medium)" })}
                  >
                    Export CSV
                  </button>
                </div>
                <div style={{ borderBottom: "1px solid var(--glass-border)" }} />
                <div style={{ padding: "14px 0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <span style={{ fontSize: "var(--fs-base)", color: "var(--t1)", fontWeight: "var(--fw-medium)" }}>Clear Cache</span>
                    <p style={{ fontSize: "var(--fs-xs)", color: "var(--t3)", marginTop: 3 }}>Clear local storage and cached data</p>
                  </div>
                  <button
                    className="glass-pill btn-press interactive-hover"
                    style={s(bsS, { height: 34, padding: "0 14px", fontSize: "var(--fs-sm)", fontWeight: "var(--fw-medium)", color: "var(--red)" })}
                    onClick={() => {
                      localStorage.clear();
                      showToast('Cache cleared. Refresh the page to apply.', 'success');
                    }}
                  >
                    Clear
                  </button>
                </div>
              </SettingSection>

              {/* About */}
              <SettingSection title="About">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                  <span style={{ fontSize: "var(--fs-sm)", color: "var(--t2)" }}>Version</span>
                  <span style={{ fontSize: "var(--fs-sm)", color: "var(--t1)", fontWeight: "var(--fw-semibold)", fontFamily: "'JetBrains Mono', monospace" }}>1.0.0-beta</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                  <span style={{ fontSize: "var(--fs-sm)", color: "var(--t2)" }}>Network</span>
                  <span style={{ fontSize: "var(--fs-sm)", color: "var(--amb)", fontWeight: "var(--fw-semibold)" }}>Devnet</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: "var(--fs-sm)", color: "var(--t2)" }}>Build</span>
                  <span style={{ fontSize: "var(--fs-sm)", color: "var(--t3)", fontFamily: "'JetBrains Mono', monospace" }}>{new Date().toISOString().split('T')[0]}</span>
                </div>
                <div style={{ marginTop: "var(--space-4)", paddingTop: 16, borderTop: "1px solid var(--glass-border)" }}>
                  <div style={{ display: "flex", gap: "var(--space-2-5)" }}>
                    <a
                      href="https://launchr.app/docs"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="interactive-hover"
                      style={{
                        flex: 1,
                        padding: "10px 14px",
                        borderRadius: "var(--radius-sm)",
                        background: "var(--glass)",
                        border: "1px solid var(--glass-border)",
                        fontSize: "var(--fs-sm)",
                        color: "var(--t2)",
                        textDecoration: "none",
                        textAlign: "center",
                        fontWeight: 500
                      }}
                    >
                      Documentation
                    </a>
                    <a
                      href="https://discord.gg/launchr"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="interactive-hover"
                      style={{
                        flex: 1,
                        padding: "10px 14px",
                        borderRadius: "var(--radius-sm)",
                        background: "var(--glass)",
                        border: "1px solid var(--glass-border)",
                        fontSize: "var(--fs-sm)",
                        color: "var(--t2)",
                        textDecoration: "none",
                        textAlign: "center",
                        fontWeight: 500
                      }}
                    >
                      Discord
                    </a>
                    <a
                      href="https://twitter.com/launchr"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="interactive-hover"
                      style={{
                        flex: 1,
                        padding: "10px 14px",
                        borderRadius: "var(--radius-sm)",
                        background: "var(--glass)",
                        border: "1px solid var(--glass-border)",
                        fontSize: "var(--fs-sm)",
                        color: "var(--t2)",
                        textDecoration: "none",
                        textAlign: "center",
                        fontWeight: 500
                      }}
                    >
                      Twitter
                    </a>
                  </div>
                </div>
              </SettingSection>
            </>
          )}
        </div>
      </div>
    );
  };

  // ---------------------------------------------------------------------------
  // LEADERBOARD VIEW
  // ---------------------------------------------------------------------------

  const Leaderboard = () => {
    const [timePeriod, setTimePeriod] = useState<'24h' | '7d' | '30d' | 'all'>('7d');
    const [visibleTraders, setVisibleTraders] = useState(5);
    const [visibleLaunches, setVisibleLaunches] = useState(5);

    const tabBtn = (k: 'traders' | 'launches', l: string, icon: React.ReactNode) => (
      <button
        key={k}
        onClick={() => setLeaderboardTab(k)}
        className="btn-press"
        style={{
          padding: "10px 20px",
          borderRadius: "var(--radius-full)",
          fontSize: "var(--fs-base)",
          fontWeight: "var(--fw-semibold)",
          cursor: "pointer",
          border: "none",
          transition: "all .2s var(--ease-out-quart)",
          background: leaderboardTab === k ? "var(--pb)" : "transparent",
          color: leaderboardTab === k ? "var(--pt)" : "var(--t2)",
          fontFamily: "inherit",
          display: "flex",
          alignItems: "center",
          gap: 6
        }}
      >
        {icon}
        {l}
      </button>
    );

    const timePeriodBtn = (k: '24h' | '7d' | '30d' | 'all', l: string) => (
      <button
        key={k}
        onClick={() => setTimePeriod(k)}
        className="btn-press"
        style={{
          padding: "6px 12px",
          borderRadius: "var(--radius-sm)",
          fontSize: "var(--fs-xs)",
          fontWeight: "var(--fw-semibold)",
          cursor: "pointer",
          border: "1px solid",
          borderColor: timePeriod === k ? "var(--grn)" : "transparent",
          transition: "all .15s",
          background: timePeriod === k ? "var(--gb)" : "var(--glass)",
          color: timePeriod === k ? "var(--grn)" : "var(--t3)",
          fontFamily: "inherit"
        }}
      >
        {l}
      </button>
    );

    // Top 3 for podium
    const top3Traders = leaderboardData.slice(0, 3);
    const restTraders = leaderboardData.slice(3, 3 + visibleTraders);
    const allRestTraders = leaderboardData.slice(3);
    const top3Launches = topLaunches.slice(0, 3);
    const restLaunches = topLaunches.slice(3, 3 + visibleLaunches);
    const allRestLaunches = topLaunches.slice(3);

    const hasMoreTraders = allRestTraders.length > visibleTraders;
    const hasMoreLaunches = allRestLaunches.length > visibleLaunches;
    const hasMore = leaderboardTab === 'traders' ? hasMoreTraders : hasMoreLaunches;

    const loadMore = () => {
      if (leaderboardTab === 'traders') {
        setVisibleTraders(prev => prev + 5);
      } else {
        setVisibleLaunches(prev => prev + 5);
      }
    };

    // Podium component for top 3 - Enhanced
    const Podium = ({ type }: { type: 'traders' | 'launches' }) => {
      const items = type === 'traders' ? top3Traders : top3Launches;
      if (items.length < 3) return null;

      const podiumOrder = [1, 0, 2]; // 2nd, 1st, 3rd
      const heights = [110, 140, 90];
      // Medal icons: Silver, Gold, Bronze
      const MedalIcon = ({ type, size }: { type: 'gold' | 'silver' | 'bronze'; size: number }) => {
        const colors = {
          gold: { main: '#fbbf24', light: '#fde68a', dark: '#d97706', ribbon: '#dc2626' },
          silver: { main: '#9ca3af', light: '#d1d5db', dark: '#6b7280', ribbon: '#3b82f6' },
          bronze: { main: '#f97316', light: '#fdba74', dark: '#c2410c', ribbon: '#16A34A' }
        };
        const c = colors[type];
        return (
          <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="10" r="8" fill={`url(#medal-${type})`} stroke={c.dark} strokeWidth="1"/>
            <path d="M8 18L12 22L16 18L14 16H10L8 18Z" fill={c.ribbon}/>
            <circle cx="12" cy="10" r="5" fill={c.light} opacity="0.3"/>
            <text x="12" y="13" textAnchor="middle" fontSize="8" fontWeight="bold" fill={c.dark}>
              {type === 'gold' ? '1' : type === 'silver' ? '2' : '3'}
            </text>
            <defs>
              <linearGradient id={`medal-${type}`} x1="4" y1="2" x2="20" y2="18">
                <stop offset="0%" stopColor={c.light}/>
                <stop offset="50%" stopColor={c.main}/>
                <stop offset="100%" stopColor={c.dark}/>
              </linearGradient>
            </defs>
          </svg>
        );
      };
      const medalTypes: ('silver' | 'gold' | 'bronze')[] = ['silver', 'gold', 'bronze'];
      const glows = [
        'rgba(192, 192, 192, 0.35)',
        'rgba(255, 215, 0, 0.5)',
        'rgba(205, 127, 50, 0.3)'
      ];
      const borderColors = ['#c0c0c0', '#fcd34d', '#cd7f32'];
      const bgGradients = [
        'linear-gradient(180deg, #d1d5db 0%, #9ca3af 50%, #6b7280 100%)',
        'linear-gradient(180deg, #fde68a 0%, #fbbf24 50%, #f59e0b 100%)',
        'linear-gradient(180deg, #fdba74 0%, #fb923c 50%, #ea580c 100%)'
      ];

      return (
        <div style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "flex-end",
          gap: "var(--space-4)",
          marginBottom: "var(--space-8)",
          paddingTop: 24,
          position: "relative"
        }}>
          {/* Background glow for winner */}
          <div style={{
            position: "absolute",
            top: "20%",
            left: "50%",
            transform: "translateX(-50%)",
            width: 200,
            height: 200,
            background: "radial-gradient(circle, rgba(252, 211, 77, 0.15), transparent 70%)",
            pointerEvents: "none",
            filter: "blur(20px)"
          }} />

          {podiumOrder.map((idx, i) => {
            const item = items[idx];
            const isTrader = type === 'traders';
            const isWinner = idx === 0;
            const avatarSize = isWinner ? 80 : 60;

            return (
              <div
                key={isTrader ? (item as typeof leaderboardData[0]).address : (item as typeof topLaunches[0]).id}
                onClick={isTrader ? () => go('userProfile', undefined, (item as typeof leaderboardData[0]).address.replace('...', '1234567890')) : undefined}
                className="bounce-in"
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  animationDelay: `${i * 0.12}s`,
                  position: "relative",
                  zIndex: isWinner ? 2 : 1,
                  cursor: isTrader ? "pointer" : undefined
                }}
              >
                {/* Crown for winner */}
                {isWinner && (
                  <div style={{
                    marginBottom: 4,
                    animation: "float 3s ease-in-out infinite",
                    filter: "drop-shadow(0 4px 8px rgba(252, 211, 77, 0.4))"
                  }}>
                    <svg width={32} height={32} viewBox="0 0 24 24" fill="none">
                      <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" fill="url(#crownGrad)" stroke="#d97706" strokeWidth="0.5"/>
                      <defs>
                        <linearGradient id="crownGrad" x1="2" y1="2" x2="22" y2="22">
                          <stop offset="0%" stopColor="#fde68a"/>
                          <stop offset="50%" stopColor="#fbbf24"/>
                          <stop offset="100%" stopColor="#f59e0b"/>
                        </linearGradient>
                      </defs>
                    </svg>
                  </div>
                )}

                {/* Avatar/Icon */}
                <div style={{
                  position: "relative",
                  marginBottom: 14
                }}>
                  <div style={{
                    width: avatarSize,
                    height: avatarSize,
                    borderRadius: isWinner ? 24 : 18,
                    overflow: "hidden",
                    boxShadow: `0 12px 40px ${glows[i]}`,
                    border: `${isWinner ? 4 : 3}px solid ${borderColors[i]}`,
                    transition: "transform .3s var(--ease-out-quart)"
                  }}>
                    {isTrader ? (
                      <Avatar gi={(item as typeof leaderboardData[0]).avatar} size={avatarSize} />
                    ) : (
                      <Avatar gi={(item as typeof topLaunches[0]).gi} size={avatarSize} />
                    )}
                  </div>
                  <div style={{
                    position: "absolute",
                    top: isWinner ? -12 : -8,
                    right: isWinner ? -12 : -8,
                    filter: "drop-shadow(0 3px 6px rgba(0,0,0,0.25))"
                  }}>
                    <MedalIcon type={medalTypes[i]} size={isWinner ? 32 : 24} />
                  </div>
                </div>

                {/* Name */}
                <div style={{
                  fontSize: isWinner ? 15 : 13,
                  fontWeight: "var(--fw-bold)",
                  color: "var(--t1)",
                  fontFamily: "'JetBrains Mono', monospace",
                  marginBottom: 6,
                  textAlign: "center",
                  maxWidth: isWinner ? 120 : 100,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap"
                }}>
                  {isTrader ? (item as typeof leaderboardData[0]).address : (item as typeof topLaunches[0]).name}
                </div>

                {/* Value with badge */}
                <div style={{
                  fontSize: isWinner ? 15 : 12,
                  fontWeight: "var(--fw-bold)",
                  color: isTrader
                    ? ((item as typeof leaderboardData[0]).totalPnl >= 0 ? "var(--grn)" : "var(--red)")
                    : "var(--t1)",
                  fontFamily: "'JetBrains Mono', monospace",
                  marginBottom: "var(--space-3)",
                  padding: "4px 10px",
                  borderRadius: "var(--radius-sm)",
                  background: isTrader && (item as typeof leaderboardData[0]).totalPnl >= 0
                    ? "var(--gb)"
                    : "var(--glass2)"
                }}>
                  {isTrader
                    ? `${(item as typeof leaderboardData[0]).totalPnl >= 0 ? '+' : ''}${(item as typeof leaderboardData[0]).totalPnl.toFixed(1)} SOL`
                    : fm((item as typeof topLaunches[0]).marketCap)
                  }
                </div>

                {/* Podium stand - Enhanced */}
                <div style={{
                  width: isWinner ? 110 : 85,
                  height: heights[i],
                  borderRadius: "16px 16px 0 0",
                  background: bgGradients[i],
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "flex-start",
                  paddingTop: 16,
                  boxShadow: `0 -8px 30px ${glows[i]}`,
                  position: "relative",
                  overflow: "hidden"
                }}>
                  <span style={{
                    fontSize: isWinner ? 36 : 28,
                    fontWeight: 800,
                    color: "rgba(0,0,0,0.15)"
                  }}>
                    {idx + 1}
                  </span>
                  {/* Shine effect */}
                  <div style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    right: 0,
                    height: "50%",
                    background: "linear-gradient(180deg, rgba(255,255,255,0.2), transparent)",
                    pointerEvents: "none"
                  }} />
                </div>
              </div>
            );
          })}
        </div>
      );
    };

    return (
      <div style={{ maxWidth: 950, margin: "0 auto", padding: "36px 24px", position: "relative", zIndex: 1 }}>
        <button
          onClick={() => go('home')}
          className="btn-press interactive-hover"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 7,
            fontSize: "var(--fs-base)",
            color: "var(--t2)",
            background: "var(--glass)",
            border: "1px solid var(--glass-border)",
            borderRadius: "var(--radius-sm)",
            cursor: "pointer",
            marginBottom: 22,
            padding: "8px 14px",
            fontFamily: "inherit"
          }}
        >
          <SvgBack /> Back
        </button>

        {/* Header - Enhanced */}
        <div className="glass-card page-enter-smooth" style={{
          padding: 0,
          marginBottom: "var(--space-5)",
          overflow: "hidden"
        }}>
          {/* Header with gradient banner */}
          <div style={{
            padding: "var(--space-7)",
            background: "linear-gradient(135deg, rgba(245, 158, 11, 0.1), rgba(217, 119, 6, 0.05), transparent)",
            position: "relative"
          }}>
            <div style={{
              position: "absolute",
              top: 0,
              right: 0,
              width: 200,
              height: 200,
              background: "radial-gradient(circle at top right, rgba(245, 158, 11, 0.15), transparent 70%)",
              pointerEvents: "none"
            }} />

            <div style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              flexWrap: "wrap",
              gap: "var(--space-5)",
              position: "relative"
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "var(--space-4)" }}>
                <div style={{
                  width: 64,
                  height: 64,
                  borderRadius: "var(--radius-lg)",
                  background: "linear-gradient(135deg, #f59e0b, #d97706)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  boxShadow: "0 12px 40px rgba(245, 158, 11, 0.4)"
                }}>
                  <svg width={32} height={32} viewBox="0 0 24 24" fill="white" opacity={0.95}>
                    <path d="M19 5h-2V3H7v2H5c-1.1 0-2 .9-2 2v1c0 2.55 1.92 4.63 4.39 4.94.63 1.5 1.98 2.63 3.61 2.96V19H7v2h10v-2h-4v-3.1c1.63-.33 2.98-1.46 3.61-2.96C19.08 12.63 21 10.55 21 8V7c0-1.1-.9-2-2-2zM5 8V7h2v3.82C5.84 10.4 5 9.3 5 8zm14 0c0 1.3-.84 2.4-2 2.82V7h2v1z"/>
                  </svg>
                </div>
                <div>
                  <h1 style={{
                    fontSize: "var(--fs-3xl)",
                    fontWeight: "var(--fw-bold)",
                    color: "var(--t1)",
                    letterSpacing: -0.5
                  }}>
                    Leaderboard
                  </h1>
                  <p style={{
                    fontSize: "var(--fs-md)",
                    color: "var(--t2)",
                    marginTop: 4
                  }}>
                    Top performers on Launchr
                  </p>
                </div>
              </div>

              {/* Time Period Filter - Enhanced */}
              <div style={{
                display: "flex",
                gap: 0,
                background: "var(--glass2)",
                padding: 4,
                borderRadius: "var(--radius-md)",
                border: "1px solid var(--glass-border)"
              }}>
                {(['24h', '7d', '30d', 'all'] as const).map((k) => {
                  const labels = { '24h': '24H', '7d': '7D', '30d': '30D', 'all': 'All Time' };
                  const isActive = timePeriod === k;
                  return (
                    <button
                      key={k}
                      onClick={() => setTimePeriod(k)}
                      className="btn-press"
                      style={{
                        padding: "8px 14px",
                        borderRadius: "var(--radius-sm)",
                        fontSize: "var(--fs-sm)",
                        fontWeight: "var(--fw-semibold)",
                        cursor: "pointer",
                        border: "none",
                        transition: "all .2s var(--ease-out-quart)",
                        background: isActive ? "var(--pb)" : "transparent",
                        color: isActive ? "var(--pt)" : "var(--t3)",
                        fontFamily: "inherit"
                      }}
                    >
                      {labels[k]}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Stats Summary - Enhanced Responsive Grid */}
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
            gap: 1,
            background: "var(--glass-border)"
          }}>
            {[
              { label: 'Total Volume', value: '2,847 SOL', change: '+12.4%', iconType: 'chart' as const, highlight: true },
              { label: 'Active Traders', value: '1,234', change: '+8.2%', iconType: 'users' as const },
              { label: 'Avg Win Rate', value: '58.3%', change: '+2.1%', iconType: 'target' as const },
              { label: 'Top Profit', value: '+127.5 SOL', change: null, iconType: 'trophy' as const, isProfit: true },
            ].map((stat, i) => (
              <div
                key={stat.label}
                className="stagger-item"
                style={{
                  padding: "var(--space-4-5)",
                  background: "var(--bg-card)",
                  position: "relative"
                }}
              >
                <div style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "var(--space-2)",
                  marginBottom: 8
                }}>
                  <StatIcon type={stat.iconType} size={14} color="var(--t3)" />
                  <span style={{
                    fontSize: "var(--fs-2xs)",
                    fontWeight: "var(--fw-bold)",
                    color: "var(--t3)",
                    letterSpacing: 0.5,
                    textTransform: "uppercase"
                  }}>
                    {stat.label}
                  </span>
                </div>
                <div style={{ display: "flex", alignItems: "baseline", gap: "var(--space-2)" }}>
                  <span style={{
                    fontSize: "var(--fs-2xl)",
                    fontWeight: "var(--fw-bold)",
                    color: stat.isProfit ? "var(--grn)" : "var(--t1)",
                    fontFamily: "'JetBrains Mono', monospace"
                  }}>
                    {stat.value}
                  </span>
                  {stat.change && (
                    <span style={{
                      fontSize: "var(--fs-xs)",
                      fontWeight: "var(--fw-semibold)",
                      color: "var(--grn)",
                      display: "flex",
                      alignItems: "center",
                      gap: 3
                    }}>
                      <SvgUp />
                      {stat.change}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Main Content */}
        <div className="glass-card" style={{ padding: 24 }}>
          {/* Tab Switcher */}
          <div style={{
            display: "flex",
            gap: "var(--space-1)",
            padding: 4,
            borderRadius: "var(--radius-full)",
            width: "fit-content",
            marginBottom: "var(--space-6)",
            background: "var(--glass2)",
            border: "1px solid var(--glass-border)"
          }}>
            {tabBtn("traders", "Top Traders", <svg width={16} height={16} viewBox="0 0 24 24" fill="currentColor"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>)}
            {tabBtn("launches", "Top Launches", <svg width={16} height={16} viewBox="0 0 24 24" fill="currentColor"><path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09zM12 15l-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/></svg>)}
          </div>

          {/* Podium */}
          <Podium type={leaderboardTab} />

          {/* List */}
          <div className="tab-content-enter" key={`${leaderboardTab}-${timePeriod}`}>
            {leaderboardTab === 'traders' ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
                {/* Header Row */}
                <div style={{
                  display: "grid",
                  gridTemplateColumns: "50px 1fr 100px 100px 120px",
                  gap: "var(--space-3)",
                  padding: "0 16px 12px",
                  borderBottom: "1px solid var(--glass-border)",
                  fontSize: "var(--fs-2xs)",
                  fontWeight: "var(--fw-bold)",
                  color: "var(--t3)",
                  letterSpacing: 0.5,
                  textTransform: "uppercase"
                }}>
                  <span>Rank</span>
                  <span>Trader</span>
                  <span style={{ textAlign: "right" }}>Trades</span>
                  <span style={{ textAlign: "right" }}>Win Rate</span>
                  <span style={{ textAlign: "right" }}>P&L</span>
                </div>

                {restTraders.map((trader, i) => (
                  <div
                    key={trader.rank}
                    onClick={() => go('userProfile', undefined, trader.address.replace('...', '1234567890'))}
                    className="glass-card-inner table-row-hover btn-press"
                    style={s(ani("fu", i * 0.03), {
                      padding: "var(--space-4)",
                      display: "grid",
                      gridTemplateColumns: "50px 1fr 100px 100px 120px",
                      alignItems: "center",
                      gap: "var(--space-3)",
                      borderRadius: "var(--radius-md)",
                      cursor: "pointer"
                    })}
                  >
                    <div style={{
                      width: 32,
                      height: 32,
                      borderRadius: "var(--radius-sm)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontWeight: "var(--fw-bold)",
                      fontSize: "var(--fs-base)",
                      background: "var(--glass2)",
                      color: "var(--t2)"
                    }}>
                      {trader.rank}
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
                      <Avatar gi={trader.avatar} size={38} />
                      <div style={{ fontSize: "var(--fs-md)", fontWeight: "var(--fw-semibold)", color: "var(--t1)", fontFamily: "'JetBrains Mono', monospace" }}>
                        {trader.address}
                      </div>
                    </div>

                    <div style={{ textAlign: "right", fontSize: "var(--fs-base)", color: "var(--t2)", fontWeight: "var(--fw-medium)" }}>
                      {trader.trades}
                    </div>

                    <div style={{ textAlign: "right" }}>
                      <span style={{
                        fontSize: "var(--fs-sm)",
                        fontWeight: "var(--fw-semibold)",
                        padding: "4px 8px",
                        borderRadius: "var(--radius-xs)",
                        background: trader.winRate >= 60 ? "var(--gb)" : trader.winRate >= 50 ? "var(--glass2)" : "var(--rb)",
                        color: trader.winRate >= 60 ? "var(--grn)" : trader.winRate >= 50 ? "var(--t2)" : "var(--red)"
                      }}>
                        {trader.winRate}%
                      </span>
                    </div>

                    <div style={{ textAlign: "right" }}>
                      <div style={{
                        fontSize: "var(--fs-lg)",
                        fontWeight: "var(--fw-bold)",
                        color: trader.totalPnl >= 0 ? "var(--grn)" : "var(--red)",
                        fontFamily: "'JetBrains Mono', monospace"
                      }}>
                        {trader.totalPnl >= 0 ? '+' : ''}{trader.totalPnl.toFixed(2)} SOL
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
                {/* Header Row */}
                <div style={{
                  display: "grid",
                  gridTemplateColumns: "50px 1fr 100px 100px 100px",
                  gap: "var(--space-3)",
                  padding: "0 16px 12px",
                  borderBottom: "1px solid var(--glass-border)",
                  fontSize: "var(--fs-2xs)",
                  fontWeight: "var(--fw-bold)",
                  color: "var(--t3)",
                  letterSpacing: 0.5,
                  textTransform: "uppercase"
                }}>
                  <span>Rank</span>
                  <span>Launch</span>
                  <span style={{ textAlign: "right" }}>Holders</span>
                  <span style={{ textAlign: "right" }}>Volume</span>
                  <span style={{ textAlign: "right" }}>MCap</span>
                </div>

                {restLaunches.map((launch, i) => (
                  <div
                    key={launch.id}
                    onClick={() => go('detail', launch)}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go('detail', launch); }}}
                    role="button"
                    tabIndex={0}
                    aria-label={`View ${launch.name} token details`}
                    className="glass-card-inner table-row-hover btn-press"
                    style={s(ani("fu", i * 0.03), {
                      padding: "var(--space-4)",
                      display: "grid",
                      gridTemplateColumns: "50px 1fr 100px 100px 100px",
                      alignItems: "center",
                      gap: "var(--space-3)",
                      borderRadius: "var(--radius-md)",
                      cursor: "pointer"
                    })}
                  >
                    <div style={{
                      width: 32,
                      height: 32,
                      borderRadius: "var(--radius-sm)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontWeight: "var(--fw-bold)",
                      fontSize: "var(--fs-base)",
                      background: "var(--glass2)",
                      color: "var(--t2)"
                    }}>
                      {launch.rank}
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
                      <Avatar gi={launch.gi} size={38} imageUrl={getTokenImageUrl(launch.publicKey)} symbol={launch.symbol} />
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
                          <span style={{ fontSize: "var(--fs-md)", fontWeight: "var(--fw-semibold)", color: "var(--t1)" }}>{launch.name}</span>
                          <Badge status={launch.status} isDark={isDark} />
                        </div>
                        <div style={{ fontSize: "var(--fs-xs)", color: "var(--t3)", marginTop: 2, fontFamily: "'JetBrains Mono', monospace" }}>
                          {launch.symbol}
                        </div>
                      </div>
                    </div>

                    <div style={{ textAlign: "right", fontSize: "var(--fs-base)", color: "var(--t2)", fontWeight: "var(--fw-medium)" }}>
                      {launch.holders}
                    </div>

                    <div style={{ textAlign: "right", fontSize: "var(--fs-base)", fontWeight: "var(--fw-semibold)", color: "var(--t1)", fontFamily: "'JetBrains Mono', monospace" }}>
                      {fm(launch.volume24h)}
                    </div>

                    <div style={{ textAlign: "right", fontSize: "var(--fs-md)", fontWeight: "var(--fw-bold)", color: "var(--grn)", fontFamily: "'JetBrains Mono', monospace" }}>
                      {fm(launch.marketCap)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Load More */}
          {hasMore && (
            <div style={{ textAlign: "center", marginTop: 24 }}>
              <button
                onClick={loadMore}
                className="glass-pill btn-press interactive-hover"
                style={s(bsS, { height: 42, padding: "0 28px", fontSize: "var(--fs-base)", fontWeight: "var(--fw-semibold)" })}
              >
                Load More
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  // ---------------------------------------------------------------------------
  // SHARE MODAL
  // ---------------------------------------------------------------------------

  const ShareModal = () => {
    if (!shareModal) return null;
    const l = shareModal;
    const shareUrl = `https://launchr.app/token/${l.publicKey}`;
    const shareText = `Check out $${l.symbol} on Launchr! ${l.name} - ${fm(l.marketCap)} MCap`;

    const copyShareLink = () => {
      navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    };

    return (
      <div
        onClick={() => setShareModal(null)}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.6)",
          backdropFilter: "blur(8px)",
          WebkitBackdropFilter: "blur(8px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 100,
          padding: 24
        }}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          className="glass-card"
          style={s(ani("si", 0), { padding: "var(--space-7)", maxWidth: 420, width: "100%" })}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--space-5)" }}>
            <h3 style={{ fontSize: "var(--fs-lg)", fontWeight: "var(--fw-bold)", color: "var(--t1)" }}>Share {l.name}</h3>
            <button
              onClick={() => setShareModal(null)}
              className="interactive-hover"
              aria-label="Close share modal"
              style={{ background: "none", border: "none", cursor: "pointer", color: "var(--t2)", padding: "var(--space-1)" }}
            >
              <SvgX />
            </button>
          </div>

          {/* Share Card Preview */}
          <div
            className="glass-card-inner"
            style={{
              padding: "var(--space-5)",
              borderRadius: "var(--radius-md)",
              marginBottom: "var(--space-5)",
              background: "linear-gradient(135deg, var(--glass), var(--glass2))"
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", marginBottom: "var(--space-4)" }}>
              <Avatar gi={l.gi} size={48} imageUrl={getTokenImageUrl(l.publicKey)} symbol={l.symbol} />
              <div>
                <div style={{ fontSize: "var(--fs-xl)", fontWeight: "var(--fw-bold)", color: "var(--t1)" }}>{l.name}</div>
                <div style={{ fontSize: "var(--fs-base)", color: "var(--t2)" }}>${l.symbol}</div>
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-3)" }}>
              <div className="glass-card-inner" style={{ padding: 12 }}>
                <div style={{ fontSize: "var(--fs-2xs)", color: "var(--t3)", marginBottom: 4 }}>PRICE</div>
                <div style={{ fontSize: "var(--fs-lg)", fontWeight: "var(--fw-bold)", color: "var(--t1)", fontFamily: "'JetBrains Mono', monospace" }}>
                  {fP(l.price)}
                </div>
              </div>
              <div className="glass-card-inner" style={{ padding: 12 }}>
                <div style={{ fontSize: "var(--fs-2xs)", color: "var(--t3)", marginBottom: 4 }}>MCAP</div>
                <div style={{ fontSize: "var(--fs-lg)", fontWeight: "var(--fw-bold)", color: "var(--t1)", fontFamily: "'JetBrains Mono', monospace" }}>
                  {fm(l.marketCap)}
                </div>
              </div>
            </div>
            <div style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "var(--space-1-5)",
              marginTop: "var(--space-4)",
              fontSize: "var(--fs-xs)",
              color: "var(--t3)"
            }}>
              <SvgLogo size={12} />
              <span>launchr.app</span>
            </div>
          </div>

          {/* Share Actions */}
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2-5)" }}>
            <button
              onClick={copyShareLink}
              style={s(bsS, {
                width: "100%",
                height: 44,
                fontSize: "var(--fs-base)",
                fontWeight: "var(--fw-medium)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8
              })}
              className="glass-pill"
            >
              {copied ? <SvgCheck /> : <SvgCopy />}
              {copied ? "Copied!" : "Copy Link"}
            </button>
            <div style={{ display: "flex", gap: "var(--space-2-5)" }}>
              <a
                href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`}
                target="_blank"
                rel="noopener noreferrer"
                style={s(bsS, {
                  flex: 1,
                  height: 44,
                  fontSize: "var(--fs-base)",
                  fontWeight: "var(--fw-medium)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "var(--space-2)",
                  textDecoration: "none"
                })}
                className="glass-pill"
              >
                <SvgTw /> Twitter
              </a>
              <a
                href={`https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(shareText)}`}
                target="_blank"
                rel="noopener noreferrer"
                style={s(bsS, {
                  flex: 1,
                  height: 44,
                  fontSize: "var(--fs-base)",
                  fontWeight: "var(--fw-medium)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "var(--space-2)",
                  textDecoration: "none"
                })}
                className="glass-pill"
              >
                <SvgTg /> Telegram
              </a>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // ---------------------------------------------------------------------------
  // RENDER
  // ---------------------------------------------------------------------------

  return (
    <div data-theme={isDark ? "dark" : "light"} style={{
      minHeight: "100vh",
      background: "var(--bg)",
      color: "var(--t1)",
      transition: "background .3s ease, color .3s ease",
      position: "relative",
      overflow: "hidden"
    }}>
      <Orbs isDark={isDark} />
      {USE_MOCKS && (
        <div
          style={{
            textAlign: "center",
            fontSize: "var(--fs-sm)",
            padding: "6px 0",
            background: "rgba(217, 119, 6, 0.1)",
            borderBottom: "1px solid rgba(217, 119, 6, 0.2)",
            color: "var(--amb)",
            position: "relative",
            zIndex: 1
          }}
        >
          Mock Mode — Using fake data for UI testing. Remove REACT_APP_USE_MOCKS to connect to Solana.
        </div>
      )}
      <Nav />
      <OfflineIndicator isOnline={isOnline} />

      {/* Live Price Ticker */}
      {launches.length > 0 && route.type !== 'home' && (
        <div style={{
          borderBottom: "1px solid var(--glass-border)",
          overflow: "hidden",
          position: "relative",
          zIndex: 1,
          background: "var(--glass)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)"
        }}>
          <div className="ticker-scroll" style={{
            display: "flex",
            gap: 32,
            padding: "8px 0",
            whiteSpace: "nowrap",
            width: "max-content"
          }}>
            {[...launches, ...launches].map((l, i) => (
              <div
                key={`${l.id}-${i}`}
                onClick={() => go('detail', l)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go('detail', l); }}}
                role="button"
                tabIndex={0}
                aria-label={`View ${l.symbol} token`}
                className="interactive-hover"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "var(--space-2)",
                  cursor: "pointer",
                  padding: "0 var(--space-1)"
                }}
              >
                <Avatar gi={l.gi} size={20} />
                <span style={{ fontSize: "var(--fs-sm)", fontWeight: "var(--fw-medium)", color: "var(--t1)" }}>{l.symbol}</span>
                <span style={{ fontSize: "var(--fs-sm)", fontFamily: "'JetBrains Mono', monospace", color: "var(--t2)" }}>
                  {fP(l.price)}
                </span>
                <span style={{
                  fontSize: "var(--fs-xs)",
                  color: l.priceChange24h >= 0 ? "var(--grn)" : "var(--red)",
                  display: "flex",
                  alignItems: "center",
                  gap: 2
                }}>
                  {l.priceChange24h >= 0 ? "+" : ""}{l.priceChange24h.toFixed(1)}%
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <main key={viewKey} className="page-enter-smooth view-container" style={{ minHeight: "calc(100vh - 112px)" }}>
        {/* Show loading state when restoring a detail page */}
        {pendingDetailId ? (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "60vh" }}>
            <div style={{ textAlign: "center" }}>
              <div className="loading-spinner loading-spinner-large" style={{ margin: "0 auto 16px", color: "var(--grn)" }} />
              <p style={{ color: "var(--t2)", fontSize: "var(--fs-md)" }}>Loading...</p>
            </div>
          </div>
        ) : (
          <>
            {route.type === 'home' && <Home />}
            {route.type === 'launches' && <Launches />}
            {route.type === 'detail' && <Detail />}
            {route.type === 'create' && <Create />}
            {route.type === 'profile' && <Profile />}
            {route.type === 'userProfile' && <UserProfile address={route.address} />}
            {route.type === 'settings' && <Settings />}
            {route.type === 'leaderboard' && <Leaderboard />}
          </>
        )}
      </main>
      <Foot />
      <ShareModal />

      {/* Wallet Selector Modal */}
      <WalletSelector
        isOpen={showWalletSelector}
        onClose={() => setShowWalletSelector(false)}
        onSelect={async (walletType: string) => {
          try {
            // Store selected wallet type
            localStorage.setItem('launchr_wallet_type', walletType);
            // Trigger wallet connection
            await wallet.connect();
            showToast(`Connected with ${walletType.charAt(0).toUpperCase() + walletType.slice(1)}`, 'success');
          } catch (err) {
            showToast('Failed to connect wallet', 'error');
          }
        }}
        wallets={availableWallets.map(w => ({
          type: w.type || '',
          name: w.name,
          icon: w.icon,
          detected: w.detected,
        }))}
      />

      {/* Trade Confirmation Dialog */}
      <ConfirmDialog
        open={tradeConfirm.open}
        title={`Confirm ${tradeConfirm.type === 'buy' ? 'Buy' : 'Sell'}`}
        message={
          tradeConfirm.launch ? (
            <div>
              <p style={{ marginBottom: "var(--space-3)" }}>
                You are about to {tradeConfirm.type} <strong>{tradeConfirm.amount}</strong> {tradeConfirm.type === 'buy' ? 'SOL worth of' : ''} <strong>{tradeConfirm.launch.symbol}</strong>.
              </p>
              {/* Transaction timing notice */}
              <div style={{
                display: "flex",
                alignItems: "center",
                gap: "var(--space-2)",
                padding: "var(--space-2) var(--space-3)",
                borderRadius: "var(--radius-sm)",
                background: "rgba(251, 191, 36, 0.1)",
                border: "1px solid rgba(251, 191, 36, 0.2)"
              }}>
                <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="var(--amb)" strokeWidth={2}>
                  <circle cx={12} cy={12} r={10}/>
                  <path d="M12 6v6l4 2"/>
                </svg>
                <span style={{ fontSize: "var(--fs-xs)", color: "var(--amb)" }}>
                  Sign within ~60 seconds or transaction will expire
                </span>
              </div>
            </div>
          ) : null
        }
        confirmText={tradeConfirm.type === 'buy' ? 'Buy Now' : 'Sell Now'}
        type={tradeConfirm.type === 'buy' ? 'success' : 'danger'}
        onConfirm={executeTrade}
        onCancel={() => setTradeConfirm({ open: false, type: 'buy', amount: '', launch: null })}
      />

      {/* Toast Notifications */}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="false"
        style={{
          position: "fixed",
          bottom: 24,
          right: 24,
          display: "flex",
          flexDirection: "column",
          gap: "var(--space-2-5)",
          zIndex: 200,
          pointerEvents: "none"
        }}
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className="toast-enter toast-premium"
            role="alert"
            aria-live={toast.type === 'error' ? 'assertive' : 'polite'}
            style={{
              padding: 0,
              borderRadius: "var(--radius-lg)",
              background: toast.type === 'success'
                ? "var(--toast-success)"
                : toast.type === 'error'
                  ? "var(--toast-error)"
                  : "var(--toast-info)",
              color: "#fff",
              fontSize: "var(--fs-sm)",
              fontWeight: "var(--fw-medium)",
              boxShadow: "0 12px 40px rgba(0,0,0,0.3), 0 0 0 1px rgba(255,255,255,0.15) inset",
              backdropFilter: "blur(24px)",
              WebkitBackdropFilter: "blur(24px)",
              overflow: "hidden",
              pointerEvents: "auto",
              minWidth: 200
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2-5)", padding: "14px 18px" }}>
              {toast.type === 'success' && (
                <div style={{
                  width: 22,
                  height: 22,
                  borderRadius: "50%",
                  background: "var(--toast-icon-bg)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center"
                }}>
                  <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}>
                    <polyline points="20 6 9 17 4 12" className="check-draw" />
                  </svg>
                </div>
              )}
              {toast.type === 'error' && (
                <div style={{
                  width: 22,
                  height: 22,
                  borderRadius: "50%",
                  background: "var(--toast-icon-bg)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center"
                }}>
                  <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                    <line x1={15} y1={9} x2={9} y2={15} />
                    <line x1={9} y1={9} x2={15} y2={15} />
                  </svg>
                </div>
              )}
              {toast.type === 'info' && (
                <div style={{
                  width: 22,
                  height: 22,
                  borderRadius: "50%",
                  background: "var(--toast-icon-bg)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center"
                }}>
                  <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                    <circle cx={12} cy={12} r={10} />
                    <line x1={12} y1={16} x2={12} y2={12} />
                    <line x1={12} y1={8} x2={12.01} y2={8} />
                  </svg>
                </div>
              )}
              {toast.message}
            </div>
            {/* Progress bar */}
            <div style={{
              height: 3,
              background: "rgba(255,255,255,0.2)",
              position: "relative",
              overflow: "hidden"
            }}>
              <div
                className="toast-progress"
                style={{
                  height: "100%",
                  background: "rgba(255,255,255,0.5)",
                  width: "100%"
                }}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Graduation Celebration Confetti */}
      <Confetti
        active={showGraduation}
        onComplete={() => setShowGraduation(false)}
      />

      {/* Graduation Celebration Modal */}
      {showGraduation && graduatedLaunch && (
        <div
          className="modal-backdrop"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.7)",
            backdropFilter: "blur(8px)",
            WebkitBackdropFilter: "blur(8px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 300,
          }}
          onClick={() => {
            setShowGraduation(false);
            setGraduatedLaunch(null);
          }}
        >
          <div
            className="glass-card graduation-modal"
            onClick={(e) => e.stopPropagation()}
            style={{
              padding: "var(--space-8)",
              maxWidth: 420,
              width: "90%",
              textAlign: "center",
              animation: "scaleIn 0.3s ease-out",
            }}
          >
            <div style={{ marginBottom: 20 }}>
              <div
                style={{
                  width: 80,
                  height: 80,
                  margin: "0 auto 16px",
                  background: "linear-gradient(135deg, #34d399, #16A34A)",
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  boxShadow: "0 8px 32px rgba(34, 197, 94, 0.4)",
                }}
              >
                <svg width={40} height={40} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2.5}>
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                  <polyline points="22 4 12 14.01 9 11.01" />
                </svg>
              </div>
              <h2 style={{ fontSize: "var(--fs-3xl)", fontWeight: "var(--fw-bold)", color: "var(--t1)", marginBottom: 8 }}>
                Graduation!
              </h2>
              <p style={{ fontSize: "var(--fs-md)", color: "var(--t2)", marginBottom: 16 }}>
                <strong style={{ color: "var(--grn)" }}>{graduatedLaunch.name}</strong> (${graduatedLaunch.symbol}) has reached the graduation threshold and is now live on <strong>Orbit Finance DLMM</strong>!
              </p>
            </div>

            <div
              className="glass-card-inner"
              style={{
                padding: "var(--space-4)",
                borderRadius: "var(--radius-md)",
                marginBottom: "var(--space-5)",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                <span style={{ fontSize: "var(--fs-sm)", color: "var(--t3)" }}>Final Price</span>
                <span style={{ fontSize: "var(--fs-md)", fontWeight: "var(--fw-semibold)", fontFamily: "'JetBrains Mono', monospace", color: "var(--grn)" }}>
                  ${(graduatedLaunch.price * 1e9).toFixed(8)}
                </span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontSize: "var(--fs-sm)", color: "var(--t3)" }}>Market Cap</span>
                <span style={{ fontSize: "var(--fs-md)", fontWeight: "var(--fw-semibold)", fontFamily: "'JetBrains Mono', monospace", color: "var(--t1)" }}>
                  ${graduatedLaunch.marketCap.toLocaleString()}
                </span>
              </div>
            </div>

            <div style={{ display: "flex", gap: "var(--space-2-5)" }}>
              <button
                onClick={() => {
                  setShowGraduation(false);
                  setGraduatedLaunch(null);
                }}
                className="btn-press glass-pill"
                style={{
                  flex: 1,
                  height: 44,
                  fontSize: "var(--fs-md)",
                  fontWeight: "var(--fw-medium)",
                  cursor: "pointer",
                  border: "none",
                  fontFamily: "inherit",
                }}
              >
                Dismiss
              </button>
              <button
                onClick={() => {
                  go('detail', graduatedLaunch);
                  setShowGraduation(false);
                  setGraduatedLaunch(null);
                }}
                className="btn-press"
                style={{
                  flex: 1,
                  height: 44,
                  fontSize: "var(--fs-md)",
                  fontWeight: "var(--fw-semibold)",
                  cursor: "pointer",
                  border: "none",
                  borderRadius: "var(--radius-full)",
                  background: "linear-gradient(135deg, #34d399, #16A34A)",
                  color: "#fff",
                  boxShadow: "0 4px 16px rgba(34, 197, 94, 0.3)",
                  fontFamily: "inherit",
                }}
              >
                View Token
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
