/**
 * Launchr - Molecules
 * 
 * Launch into Orbit 🚀
 * Composed components that combine atoms for reusable UI patterns.
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Button,
  Input,
  Text,
  Badge,
  Spinner,
  ProgressBar,
  Avatar,
  Skeleton,
  Card,
  IconRocket,
  IconTrending,
  IconWallet,
  IconSearch,
  IconArrowUp,
  IconArrowDown,
  IconCopy,
  IconCheck,
  IconExternalLink,
  IconOrbit,
  IconGraduate,
  IconTwitter,
  IconTelegram,
  IconGlobe,
  IconPlus,
  IconSwap,
  IconChevronUp,
  IconChevronDown,
  IconWarning,
  GradientAvatar,
  LaunchrLogo,
} from '../atoms';

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/** Format large numbers with K/M/B suffixes */
const formatCompactNumber = (value: number): string => {
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}B`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return value.toFixed(2);
};

/** Convert lamports to SOL */
const lamportsToSol = (lamports: number): number => lamports / 1_000_000_000;

/** Format SOL amount with appropriate decimals */
const formatSol = (lamports: number): string => {
  const sol = lamportsToSol(lamports);
  if (sol >= 1000) return formatCompactNumber(sol);
  if (sol >= 1) return sol.toFixed(2);
  return sol.toFixed(4);
};

// =============================================================================
// TYPES
// =============================================================================

export interface TokenInfo {
  mint: string;
  name: string;
  symbol: string;
  uri?: string;
  decimals: number;
}

export interface LaunchData {
  publicKey: string;
  mint: string;
  creator: string;
  name: string;
  symbol: string;
  uri: string;
  status: 'Active' | 'PendingGraduation' | 'Graduated' | 'Cancelled';
  totalSupply: number;
  tokensSold: number;
  realSolReserve: number;
  virtualSolReserve: number;
  virtualTokenReserve: number;
  graduationThreshold: number;
  currentPrice: number;
  marketCap: number;
  holderCount: number;
  tradeCount: number;
  createdAt: number;
  graduatedAt?: number;
  twitter?: string;
  telegram?: string;
  website?: string;
  orbitPool?: string;
  creatorFeeBps?: number;
}

export interface TradeData {
  type: 'buy' | 'sell';
  user: string;
  amount: number;
  solAmount: number;
  price: number;
  timestamp: number;
  txSignature: string;
}

export interface UserPositionData {
  tokenBalance: number;
  solSpent: number;
  solReceived: number;
  avgBuyPrice: number;
  costBasis: number;
  unrealizedPnl: number;
  realizedPnl: number;
  totalPnl: number;
  roiPercent: number;
}

// =============================================================================
// PRICE CHANGE INDICATOR
// =============================================================================

interface PriceChangeProps {
  value: number;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const PriceChange: React.FC<PriceChangeProps> = ({
  value,
  size = 'md',
  className = '',
}) => {
  const isPositive = value >= 0;
  const sizeClasses = {
    sm: 'text-xs gap-0.5',
    md: 'text-sm gap-1',
    lg: 'text-base gap-1.5',
  };

  return (
    <span
      className={`inline-flex items-center font-medium ${sizeClasses[size]} ${className}`}
      style={{ color: isPositive ? 'var(--grn)' : 'var(--red)' }}
    >
      {isPositive ? (
        <IconChevronUp className="w-2.5 h-2.5" />
      ) : (
        <IconChevronDown className="w-2.5 h-2.5" />
      )}
      {Math.abs(value).toFixed(1)}%
    </span>
  );
};

// =============================================================================
// STATUS BADGE (Glassmorphism style)
// =============================================================================

interface StatusBadgeProps {
  status: 'Active' | 'PendingGraduation' | 'Graduated' | 'Cancelled';
  className?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  className = '',
}) => {
  const config = {
    Active: {
      bg: 'var(--glass2)',
      border: 'var(--glass-border)',
      text: 'var(--t2)',
      label: 'Active',
    },
    PendingGraduation: {
      bg: 'rgba(252, 211, 77, 0.1)',
      border: 'rgba(252, 211, 77, 0.2)',
      text: 'var(--amb)',
      label: 'Graduating',
    },
    Graduated: {
      bg: 'var(--gb)',
      border: 'rgba(34, 197, 94, 0.2)',
      text: 'var(--grn)',
      label: 'Graduated',
    },
    Cancelled: {
      bg: 'var(--rb)',
      border: 'rgba(252, 165, 165, 0.2)',
      text: 'var(--red)',
      label: 'Cancelled',
    },
  }[status];

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium whitespace-nowrap backdrop-blur-sm ${className}`}
      style={{
        background: config.bg,
        border: `1px solid ${config.border}`,
        color: config.text,
      }}
    >
      {config.label}
    </span>
  );
};

// =============================================================================
// SEARCH BAR
// =============================================================================

interface SearchBarProps {
  value?: string;
  onChange?: (value: string) => void;
  onSearch?: (value: string) => void;
  placeholder?: string;
  loading?: boolean;
  className?: string;
}

export const SearchBar: React.FC<SearchBarProps> = ({
  value: externalValue,
  onChange: externalOnChange,
  onSearch,
  placeholder = 'Search tokens...',
  loading = false,
  className = '',
}) => {
  const [internalValue, setInternalValue] = useState('');
  const value = externalValue !== undefined ? externalValue : internalValue;

  const handleChange = (newValue: string) => {
    if (externalOnChange) {
      externalOnChange(newValue);
    } else {
      setInternalValue(newValue);
    }
    // Also call onSearch on each change for filtering
    if (onSearch) {
      onSearch(newValue);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && onSearch) {
      onSearch(value);
    }
  };

  return (
    <div className={`relative ${className}`} role="search">
      <Input
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        leftIcon={<IconSearch className="w-4 h-4" aria-hidden="true" />}
        rightIcon={loading ? <Spinner size="sm" /> : undefined}
        aria-label="Search tokens"
      />
    </div>
  );
};

// =============================================================================
// WALLET DISPLAY
// =============================================================================

interface WalletDisplayProps {
  address: string;
  balance?: number;
  connected?: boolean;
  onConnect?: () => void;
  onDisconnect?: () => void;
  className?: string;
}

export const WalletDisplay: React.FC<WalletDisplayProps> = ({
  address,
  balance,
  connected = false,
  onConnect,
  onDisconnect,
  className = '',
}) => {
  const [copied, setCopied] = useState(false);

  const shortAddress = useMemo(() => {
    if (!address) return '';
    return `${address.slice(0, 4)}...${address.slice(-4)}`;
  }, [address]);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!connected) {
    return (
      <Button
        variant="primary"
        leftIcon={<IconWallet className="w-4 h-4" />}
        onClick={onConnect}
        className={className}
      >
        Connect Wallet
      </Button>
    );
  }

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      {balance !== undefined && (
        <Text variant="body" className="font-mono" aria-label={`Balance: ${balance.toFixed(4)} SOL`}>
          {balance.toFixed(4)} SOL
        </Text>
      )}
      <button
        onClick={handleCopy}
        className="flex items-center gap-2 px-3 py-2 bg-white/5 rounded-lg
          border border-white/10 hover:bg-white/10 transition-colors focus:outline-none focus:ring-2 focus:ring-green-500/50"
        aria-label={copied ? 'Address copied!' : `Copy wallet address: ${shortAddress}`}
      >
        <Text variant="body" className="font-mono">
          {shortAddress}
        </Text>
        {copied ? (
          <IconCheck className="w-4 h-4 text-green-400" aria-hidden="true" />
        ) : (
          <IconCopy className="w-4 h-4 text-white/50" aria-hidden="true" />
        )}
      </button>
      <Button variant="ghost" size="sm" onClick={onDisconnect} aria-label="Disconnect wallet">
        Disconnect
      </Button>
    </div>
  );
};

// =============================================================================
// WALLET SELECTOR
// =============================================================================

interface WalletOption {
  type: string;
  name: string;
  icon: string;
  detected: boolean;
}

interface WalletSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (walletType: string) => void;
  wallets?: WalletOption[];
  className?: string;
}

// Default wallet configurations
const DEFAULT_WALLETS: WalletOption[] = [
  {
    type: 'phantom',
    name: 'Phantom',
    icon: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMjgiIGhlaWdodD0iMTI4IiB2aWV3Qm94PSIwIDAgMTI4IDEyOCIgZmlsbD0ibm9uZSI+PHJlY3Qgd2lkdGg9IjEyOCIgaGVpZ2h0PSIxMjgiIGZpbGw9IiNBQjlGRjIiLz48cGF0aCBmaWxsLXJ1bGU9ImV2ZW5vZGQiIGNsaXAtcnVsZT0iZXZlbm9kZCIgZD0iTTU1LjY0MTYgODIuMTQ3N0M1MC44NzQ0IDg5LjQ1MjUgNDIuODg2MiA5OC42OTY2IDMyLjI1NjggOTguNjk2NkMyNy4yMzIgOTguNjk2NiAyMi40MDA0IDk2LjYyOCAyMi40MDA0IDg3LjY0MjRDMjIuNDAwNCA2NC43NTg0IDUzLjY0NDUgMjkuMzMzNSA4Mi42MzM5IDI5LjMzMzVDOTkuMTI1NyAyOS4zMzM1IDEwNS42OTcgNDAuNzc1NSAxMDUuNjk3IDUzLjc2ODlDMTA1LjY5NyA3MC40NDcxIDk0Ljg3MzkgODkuNTE3MSA4NC4xMTU2IDg5LjUxNzFDODAuNzAxMyA4OS41MTcxIDc5LjAyNjQgODcuNjQyNCA3OS4wMjY0IDg0LjY2ODhDNzkuMDI2NCA4My44OTMxIDc5LjE1NTIgODMuMDUyNyA3OS40MTI5IDgyLjE0NzdDNzUuNzQwOSA4OC40MTgyIDY4LjY1NDYgOTQuMjM2MSA2Mi4wMTkyIDk0LjIzNjFDNTcuMTg3NyA5NC4yMzYxIDU0LjczOTcgOTEuMTk3OSA1NC43Mzk3IDg2LjkzMTRDNTQuNzM5NyA4NS4zNzk5IDU1LjA2MTggODMuNzYzOCA1NS42NDE2IDgyLjE0NzdaTTgwLjYxMzMgNTMuMzE4MkM4MC42MTMzIDU3LjEwNDQgNzguMzc5NSA1OC45OTc1IDc1Ljg4MDYgNTguOTk3NUM3My4zNDM4IDU4Ljk5NzUgNzEuMTQ3OSA1Ny4xMDQ0IDcxLjE0NzkgNTMuMzE4MkM3MS4xNDc5IDQ5LjUzMiA3My4zNDM4IDQ3LjYzODkgNzUuODgwNiA0Ny42Mzg5Qzc4LjM3OTUgNDcuNjM4OSA4MC42MTMzIDQ5LjUzMiA4MC42MTMzIDUzLjMxODJaTTk0LjgxMDIgNTMuMzE4NEM5NC44MTAyIDU3LjEwNDYgOTIuNTc2MyA1OC45OTc3IDkwLjA3NzUgNTguOTk3N0M4Ny41NDA3IDU4Ljk5NzcgODUuMzQ0NyA1Ny4xMDQ2IDg1LjM0NDcgNTMuMzE4NEM4NS4zNDQ3IDQ5LjUzMjMgODcuNTQwNyA0Ny42MzkyIDkwLjA3NzUgNDcuNjM5MkM5Mi41NzYzIDQ3LjYzOTIgOTQuODEwMiA0OS41MzIzIDk0LjgxMDIgNTMuMzE4NFoiIGZpbGw9IiNGRkZERjgiLz48L3N2Zz4=',
    detected: typeof window !== 'undefined' && !!(window as any).solana?.isPhantom,
  },
  {
    type: 'solflare',
    name: 'Solflare',
    icon: 'data:image/svg+xml;base64,PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0iVVRGLTgiPz48c3ZnIGlkPSJTIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA1MCA1MCI+PGRlZnM+PHN0eWxlPi5jbHMtMXtmaWxsOiMwMjA1MGE7c3Ryb2tlOiNmZmVmNDY7c3Ryb2tlLW1pdGVybGltaXQ6MTA7c3Ryb2tlLXdpZHRoOi41cHg7fS5jbHMtMntmaWxsOiNmZmVmNDY7fTwvc3R5bGU+PC9kZWZzPjxyZWN0IGNsYXNzPSJjbHMtMiIgeD0iMCIgd2lkdGg9IjUwIiBoZWlnaHQ9IjUwIiByeD0iMTIiIHJ5PSIxMiIvPjxwYXRoIGNsYXNzPSJjbHMtMSIgZD0iTTI0LjIzLDI2LjQybDIuNDYtMi4zOCw0LjU5LDEuNWMzLjAxLDEsNC41MSwyLjg0LDQuNTEsNS40MywwLDEuOTYtLjc1LDMuMjYtMi4yNSw0LjkzbC0uNDYuNS4xNy0xLjE3Yy42Ny00LjI2LS41OC02LjA5LTQuNzItNy40M2wtNC4zLTEuMzhoMFpNMTguMDUsMTEuODVsMTIuNTIsNC4xNy0yLjcxLDIuNTktNi41MS0yLjE3Yy0yLjI1LS43NS0zLjAxLTEuOTYtMy4zLTQuNTF2LS4wOGgwWk0xNy4zLDMzLjA2bDIuODQtMi43MSw1LjM0LDEuNzVjMi44LjkyLDMuNzYsMi4xMywzLjQ2LDUuMThsLTExLjY1LTQuMjJoMFpNMTMuNzEsMjAuOTVjMC0uNzkuNDItMS41NCwxLjEzLTIuMTcuNzUsMS4wOSwyLjA1LDIuMDUsNC4wOSwyLjcxbDQuNDIsMS40Ni0yLjQ2LDIuMzgtNC4zNC0xLjQyYy0yLS42Ny0yLjg0LTEuNjctMi44NC0yLjk2TTI2LjgyLDQyLjg3YzkuMTgtNi4wOSwxNC4xMS0xMC4yMywxNC4xMS0xNS4zMiwwLTMuMzgtMi01LjI2LTYuNDMtNi43MmwtMy4zNC0xLjEzLDkuMTQtOC43Ny0xLjg0LTEuOTYtMi43MSwyLjM4LTEyLjgxLTQuMjJjLTMuOTcsMS4yOS04Ljk3LDUuMDktOC45Nyw4Ljg5LDAsLjQyLjA0LjgzLjE3LDEuMjktMy4zLDEuODgtNC42MywzLjYzLTQuNjMsNS44LDAsMi4wNSwxLjA5LDQuMDksNC41NSw1LjIybDIuNzUuOTItOS41Miw5LjE0LDEuODQsMS45NiwyLjk2LTIuNzEsMTQuNzMsNS4yMmgwWiIvPjwvc3ZnPg==',
    detected: typeof window !== 'undefined' && !!(window as any).solflare?.isSolflare,
  },
  {
    type: 'backpack',
    name: 'Backpack',
    icon: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMSAxNS45OTk3OTk3MjgzOTM1NTUiPjxnIGNsaXAtcGF0aD0idXJsKCNjbGlwMF8xXzgwMykiPjxwYXRoIGZpbGwtcnVsZT0iZXZlbm9kZCIgY2xpcC1ydWxlPSJldmVub2RkIiBkPSJNNi41NDIwMSAxLjI1ODA1QzcuMTIzNTYgMS4yNTgwNSA3LjY2OTA1IDEuMzM2MDEgOC4xNzQxIDEuNDgwNTlDNy42Nzk2MyAwLjMyODE2OSA2LjY1Mjk3IDAgNS41MTAzOCAwQzQuMzY1NTUgMCAzLjMzNzEgMC4zMjk0NTkgMi44NDM3NSAxLjQ4NzM4QzMuMzQ1MSAxLjMzNzcxIDMuODg4MjQgMS4yNTgwNSA0LjQ2NzggMS4yNTgwNUg2LjU0MjAxWk00LjMzNDc4IDIuNDE1MDRDMS41NzMzNSAyLjQxNTA0IDAgNC41ODc0MyAwIDcuMjY3MlYxMC4wMkMwIDEwLjI4OCAwLjIyMzg1OCAxMC41IDAuNSAxMC41SDEwLjVDMTAuNzc2MSAxMC41IDExIDEwLjI4OCAxMSAxMC4wMlY3LjI2NzJDMTEgNC41ODc0MyA5LjE3MDQxIDIuNDE1MDQgNi40MDg5OSAyLjQxNTA0SDQuMzM0NzhaTTUuNDk2MDkgNy4yOTEwMkM2LjQ2MjU5IDcuMjkxMDIgNy4yNDYwOSA2LjUwNzUxIDcuMjQ2MDkgNS41NDEwMkM3LjI0NjA5IDQuNTc0NTIgNi40NjI1OSAzLjc5MTAyIDUuNDk2MDkgMy43OTEwMkM0LjUyOTYgMy43OTEwMiAzLjc0NjA5IDQuNTc0NTIgMy43NDYwOSA1LjU0MTAyQzMuNzQ2MDkgNi41MDc1MSA0LjUyOTYgNy4yOTEwMiA1LjQ5NjA5IDcuMjkxMDJaTTAgMTIuMTE4QzAgMTEuODUwMSAwLjIyMzg1OCAxMS42MzI4IDAuNSAxMS42MzI4SDEwLjVDMTAuNzc2MSAxMS42MzI4IDExIDExLjg1MDEgMTEgMTIuMTE4VjE1LjAyOTNDMTEgMTUuNTY1MyAxMC41NTIzIDE1Ljk5OTggMTAgMTUuOTk5OEgxQzAuNDQ3NzE1IDE1Ljk5OTggMCAxNS41NjUzIDAgMTUuMDI5M1YxMi4xMThaIiBmaWxsPSIjRTMzRTNGIj48L3BhdGg+PC9nPjwvc3ZnPgo=',
    detected: typeof window !== 'undefined' && !!(window as any).backpack?.isBackpack,
  },
  {
    type: 'jupiter',
    name: 'Jupiter',
    icon: 'data:image/svg+xml;base64,PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0idXRmLTgiPz4KPCEtLSBHZW5lcmF0b3I6IEFkb2JlIElsbHVzdHJhdG9yIDI0LjAuMCwgU1ZHIEV4cG9ydCBQbHVnLUluIC4gU1ZHIFZlcnNpb246IDYuMDAgQnVpbGQgMCkgIC0tPgo8c3ZnIHZlcnNpb249IjEuMSIgaWQ9ImthdG1hbl8xIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHhtbG5zOnhsaW5rPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5L3hsaW5rIiB4PSIwcHgiIHk9IjBweCIKCSB2aWV3Qm94PSIwIDAgODAwIDgwMCIgc3R5bGU9ImVuYWJsZS1iYWNrZ3JvdW5kOm5ldyAwIDAgODAwIDgwMDsiIHhtbDpzcGFjZT0icHJlc2VydmUiPgo8c3R5bGUgdHlwZT0idGV4dC9jc3MiPgoJLnN0MHtmaWxsOiMxNDE3MjY7fQoJLnN0MXtmaWxsOnVybCgjU1ZHSURfMV8pO30KCS5zdDJ7ZmlsbDp1cmwoI1NWR0lEXzJfKTt9Cgkuc3Qze2ZpbGw6dXJsKCNTVkdJRF8zXyk7fQoJLnN0NHtmaWxsOnVybCgjU1ZHSURfNF8pO30KCS5zdDV7ZmlsbDp1cmwoI1NWR0lEXzVfKTt9Cgkuc3Q2e2ZpbGw6dXJsKCNTVkdJRF82Xyk7fQo8L3N0eWxlPgo8Y2lyY2xlIGNsYXNzPSJzdDAiIGN4PSI0MDAiIGN5PSI0MDAiIHI9IjQwMCIvPgo8bGluZWFyR3JhZGllbnQgaWQ9IlNWR0lEXzFfIiBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSIgeDE9IjU3NC45MjU3IiB5MT0iNjY1Ljg3MjciIHgyPSIyNDguNTI1NyIgeTI9IjE0Mi4zMTI3IiBncmFkaWVudFRyYW5zZm9ybT0ibWF0cml4KDEgMCAwIC0xIDAgODAwKSI+Cgk8c3RvcCAgb2Zmc2V0PSIwLjE2IiBzdHlsZT0ic3RvcC1jb2xvcjojQzZGNDYyIi8+Cgk8c3RvcCAgb2Zmc2V0PSIwLjg5IiBzdHlsZT0ic3RvcC1jb2xvcjojMzNEOUZGIi8+CjwvbGluZWFyR3JhZGllbnQ+CjxwYXRoIGNsYXNzPSJzdDEiIGQ9Ik01MzYsNTY4LjljLTY2LjgtMTA4LjUtMTY2LjQtMTcwLTI4OS40LTE5NS42Yy00My41LTktODcuMi04LjktMTI5LjQsNy43Yy0yOC45LDExLjQtMzMuMywyMy40LTE5LjcsNTMuNwoJYzkyLjQtMjEuOSwxNzguNC0xLjUsMjU4LjksNDVjODEuMSw0Ni45LDE0MS42LDExMi4yLDE2OS4xLDIwNWMzOC42LTExLjgsNDMuNi0xOC4zLDM0LjMtNTQuMkM1NTQuMyw2MDkuNCw1NDcuNCw1ODcuNCw1MzYsNTY4LjkKCUw1MzYsNTY4Ljl6Ii8+CjxsaW5lYXJHcmFkaWVudCBpZD0iU1ZHSURfMl8iIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIiB4MT0iNTcyLjU4OTYiIHkxPSI2NjcuMzMwMyIgeDI9IjI0Ni4xOTk2IiB5Mj0iMTQzLjc3MDMiIGdyYWRpZW50VHJhbnNmb3JtPSJtYXRyaXgoMSAwIDAgLTEgMCA4MDApIj4KCTxzdG9wICBvZmZzZXQ9IjAuMTYiIHN0eWxlPSJzdG9wLWNvbG9yOiNDNkY0NjIiLz4KCTxzdG9wICBvZmZzZXQ9IjAuODkiIHN0eWxlPSJzdG9wLWNvbG9yOiMzM0Q5RkYiLz4KPC9saW5lYXJHcmFkaWVudD4KPHBhdGggY2xhc3M9InN0MiIgZD0iTTYwOS4xLDQ4MC42Yy04NS44LTEyNS0yMDcuMy0xOTQuOS0zNTUuOC0yMTguM2MtMzkuMy02LjItNzkuNC00LjUtMTE2LjIsMTQuM2MtMTcuNiw5LTMzLjIsMjAuNS0zNy40LDQ0LjkKCWMxMTUuOC0zMS45LDIxOS43LTMuNywzMTcuNSw1M2M5OC4zLDU3LDE3NS4xLDEzMy41LDIwNSwyNTEuMWMyMC44LTE4LjQsMjQuNS00MSwxOS4xLTYyQzYzMy45LDUzNC44LDYyNS41LDUwNC41LDYwOS4xLDQ4MC42CglMNjA5LjEsNDgwLjZ6Ii8+CjxsaW5lYXJHcmFkaWVudCBpZD0iU1ZHSURfM18iIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIiB4MT0iNTc3LjAxNDgiIHkxPSI2NjQuNTY3MSIgeDI9IjI1MC42MjQ3IiB5Mj0iMTQxLjAwNzEiIGdyYWRpZW50VHJhbnNmb3JtPSJtYXRyaXgoMSAwIDAgLTEgMCA4MDApIj4KCTxzdG9wICBvZmZzZXQ9IjAuMTYiIHN0eWxlPSJzdG9wLWNvbG9yOiNDNkY0NjIiLz4KCTxzdG9wICBvZmZzZXQ9IjAuODkiIHN0eWxlPSJzdG9wLWNvbG9yOiMzM0Q5RkYiLz4KPC9saW5lYXJHcmFkaWVudD4KPHBhdGggY2xhc3M9InN0MyIgZD0iTTEwNSw0ODguNmM3LjMsMTYuMiwxMi4xLDM0LjUsMjMsNDcuNmM1LjUsNi43LDIyLjIsNC4xLDMzLjgsNS43YzEuOCwwLjIsMy42LDAuNSw1LjQsMC43CgljMTAyLjksMTUuMywxODQuMSw2NS4xLDI0Mi4xLDE1MmMzLjQsNS4xLDguOSwxMi43LDEzLjQsMTIuN2MxNy40LTAuMSwzNC45LTIuOCw1Mi41LTQuNUM0NDksNTU3LjUsMjMyLjgsNDM4LjMsMTA1LDQ4OC42CglMMTA1LDQ4OC42eiIvPgo8bGluZWFyR3JhZGllbnQgaWQ9IlNWR0lEXzRfIiBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSIgeDE9IjU2OS4wMjcyIiB5MT0iNjY5LjU1MTgiIHgyPSIyNDIuNjI3MiIgeTI9IjE0NS45OTE3IiBncmFkaWVudFRyYW5zZm9ybT0ibWF0cml4KDEgMCAwIC0xIDAgODAwKSI+Cgk8c3RvcCAgb2Zmc2V0PSIwLjE2IiBzdHlsZT0ic3RvcC1jb2xvcjojQzZGNDYyIi8+Cgk8c3RvcCAgb2Zmc2V0PSIwLjg5IiBzdHlsZT0ic3RvcC1jb2xvcjojMzNEOUZGIi8+CjwvbGluZWFyR3JhZGllbnQ+CjxwYXRoIGNsYXNzPSJzdDQiIGQ9Ik02NTYuNiwzNjYuN0M1OTkuOSwyODcuNCw1MjEuNywyMzQuNiw0MzIuOSwxOTdjLTYxLjUtMjYuMS0xMjUuMi00MS44LTE5Mi44LTMzLjcKCWMtMjMuNCwyLjgtNDUuMyw5LjUtNjMuNCwyNC43YzIzMC45LDUuOCw0MDQuNiwxMDUuOCw1MjQsMzAzLjNjMC4yLTEzLjEsMi4yLTI3LjctMi42LTM5LjVDNjg2LjEsNDIyLjUsNjc0LjcsMzkyLDY1Ni42LDM2Ni43eiIvPgo8bGluZWFyR3JhZGllbnQgaWQ9IlNWR0lEXzVfIiBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSIgeDE9IjU3MS42OTczIiB5MT0iNjY3Ljg5MTciIHgyPSIyNDUuMjk3MyIgeTI9IjE0NC4zMzE3IiBncmFkaWVudFRyYW5zZm9ybT0ibWF0cml4KDEgMCAwIC0xIDAgODAwKSI+Cgk8c3RvcCAgb2Zmc2V0PSIwLjE2IiBzdHlsZT0ic3RvcC1jb2xvcjojQzZGNDYyIi8+Cgk8c3RvcCAgb2Zmc2V0PSIwLjg5IiBzdHlsZT0ic3RvcC1jb2xvcjojMzNEOUZGIi8+CjwvbGluZWFyR3JhZGllbnQ+CjxwYXRoIGNsYXNzPSJzdDUiIGQ9Ik03MDkuOCwzMjUuM2MtNDctMTc4LjktMjM4LTI2NS0zNzkuMi0yMjEuNEM0ODIuNywxMzMuOSw2MDcuNSwyMDYuNCw3MDkuOCwzMjUuM3oiLz4KPGxpbmVhckdyYWRpZW50IGlkPSJTVkdJRF82XyIgZ3JhZGllbnRVbml0cz0idXNlclNwYWNlT25Vc2UiIHgxPSI1NzkuMDM4MiIgeTE9IjY2My4zMTExIiB4Mj0iMjUyLjY0ODIiIHkyPSIxMzkuNzUxMSIgZ3JhZGllbnRUcmFuc2Zvcm09Im1hdHJpeCgxIDAgMCAtMSAwIDgwMCkiPgoJPHN0b3AgIG9mZnNldD0iMC4xNiIgc3R5bGU9InN0b3AtY29sb3I6I0M2RjQ2MiIvPgoJPHN0b3AgIG9mZnNldD0iMC44OSIgc3R5bGU9InN0b3AtY29sb3I6IzMzRDlGRiIvPgo8L2xpbmVhckdyYWRpZW50Pgo8cGF0aCBjbGFzcz0ic3Q2IiBkPSJNMTU1LjQsNTgzLjljNTQuNiw2OS4zLDEyNCwxMDkuNywyMTMsMTIyLjhDMzM0LjQsNjQzLjIsMjE0LjYsNTc0LjUsMTU1LjQsNTgzLjlMMTU1LjQsNTgzLjl6Ii8+Cjwvc3ZnPgo=',
    detected: typeof window !== 'undefined' && !!(window as any).jupiter,
  },
];

export const WalletSelector: React.FC<WalletSelectorProps> = ({
  isOpen,
  onClose,
  onSelect,
  wallets = DEFAULT_WALLETS,
  className = '',
}) => {
  const [detectedWallets, setDetectedWallets] = useState<WalletOption[]>([]);
  const [connecting, setConnecting] = useState<string | null>(null);

  // Re-detect wallets on mount
  useEffect(() => {
    const updated = wallets.map(w => ({
      ...w,
      detected: (() => {
        switch (w.type) {
          case 'phantom':
            return typeof window !== 'undefined' && !!(window as any).solana?.isPhantom;
          case 'solflare':
            return typeof window !== 'undefined' && !!(window as any).solflare?.isSolflare;
          case 'backpack':
            return typeof window !== 'undefined' && !!(window as any).backpack?.isBackpack;
          case 'jupiter':
            return typeof window !== 'undefined' && !!(window as any).jupiter;
          default:
            return false;
        }
      })(),
    }));
    setDetectedWallets(updated);
  }, [wallets, isOpen]);

  // Handle keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const handleSelect = useCallback((walletType: string) => {
    setConnecting(walletType);
    // Small delay to show connecting state
    setTimeout(() => {
      onSelect(walletType);
      setConnecting(null);
      onClose();
    }, 300);
  }, [onSelect, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="wallet-modal-title"
    >
      {/* Backdrop with premium blur animation */}
      <div
        className="absolute inset-0 modal-backdrop-premium"
        style={{ background: 'rgba(0,0,0,0.6)' }}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal with premium entrance animation */}
      <div
        className={`relative z-10 w-full max-w-sm p-6 rounded-2xl wallet-modal-premium ${className}`}
        style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--glass-border2)',
          backdropFilter: 'blur(24px)',
          boxShadow: '0 24px 48px rgba(0,0,0,0.4)',
        }}
      >
        {/* Header with icon */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div
              className="p-2 rounded-xl"
              style={{ background: 'var(--glass2)' }}
              aria-hidden="true"
            >
              <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" />
                <path d="M3 5v14a2 2 0 0 0 2 2h16v-5" />
                <path d="M18 12a2 2 0 0 0 0 4h4v-4Z" />
              </svg>
            </div>
            <span id="wallet-modal-title"><Text variant="h4" className="font-semibold">Connect Wallet</Text></span>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-lg transition-all hover:rotate-90"
            style={{ transition: 'all 0.2s ease' }}
            aria-label="Close wallet selector"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Wallet options with staggered animation */}
        <div className="space-y-3">
          {detectedWallets.map((wallet, index) => (
            <button
              key={wallet.type}
              onClick={() => handleSelect(wallet.type)}
              disabled={connecting !== null}
              className="wallet-option-item w-full flex items-center gap-4 p-4 rounded-xl transition-all hover:scale-[1.02] active:scale-[0.98]"
              style={{
                background: wallet.detected ? 'var(--glass2)' : 'var(--glass)',
                border: wallet.detected ? '1px solid rgba(34, 197, 94, 0.3)' : '1px solid var(--glass-border)',
                animationDelay: `${(index + 1) * 60}ms`,
                opacity: connecting && connecting !== wallet.type ? 0.5 : 1,
              }}
            >
              <div className="relative">
                <img
                  src={wallet.icon}
                  alt={wallet.name}
                  className="w-10 h-10 rounded-xl"
                  style={{
                    animation: connecting === wallet.type ? 'pulse-scale 1s ease-in-out infinite' : undefined,
                  }}
                />
                {wallet.detected && (
                  <div
                    className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center"
                    style={{ background: 'var(--grn)' }}
                  >
                    <svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={3}>
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </div>
                )}
              </div>
              <div className="flex-1 text-left">
                <Text variant="body" className="font-semibold">
                  {wallet.name}
                </Text>
                <Text variant="caption" color="muted">
                  {connecting === wallet.type
                    ? 'Connecting...'
                    : wallet.detected
                      ? 'Detected'
                      : 'Click to install'}
                </Text>
              </div>
              {connecting === wallet.type ? (
                <div className="spinner-premium" />
              ) : wallet.detected ? (
                <div
                  className="wallet-detected-badge px-2 py-1 rounded-md text-xs font-medium"
                  style={{ background: 'var(--gb)', color: 'var(--grn)' }}
                >
                  Ready
                </div>
              ) : (
                <IconExternalLink className="w-4 h-4 text-white/40" />
              )}
            </button>
          ))}
        </div>

        {/* Security notice */}
        <div
          className="mt-6 p-3 rounded-xl"
          style={{ background: 'var(--glass)' }}
        >
          <div className="flex items-start gap-3">
            <svg
              width={16}
              height={16}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              className="flex-shrink-0 mt-0.5"
              style={{ color: 'var(--grn)' }}
            >
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              <polyline points="9 12 12 15 16 10" />
            </svg>
            <div>
              <Text variant="caption" color="secondary" className="block">
                Secure Connection
              </Text>
              <Text variant="caption" color="muted" className="block mt-0.5">
                Only connect to apps you trust. Launchr never asks for your seed phrase.
              </Text>
            </div>
          </div>
        </div>

        {/* Help link */}
        <div className="mt-4 text-center">
          <Text variant="caption" color="muted">
            New to Solana?{' '}
            <a
              href="https://phantom.app/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-green-400 hover:text-green-300 font-medium"
            >
              Get started with Phantom
            </a>
          </Text>
        </div>
      </div>
    </div>
  );
};

// =============================================================================
// TOKEN BADGE
// =============================================================================

interface TokenBadgeProps {
  name: string;
  symbol: string;
  imageUri?: string;
  size?: 'sm' | 'md' | 'lg';
  showSymbol?: boolean;
  className?: string;
}

export const TokenBadge: React.FC<TokenBadgeProps> = ({
  name,
  symbol,
  imageUri,
  size = 'md',
  showSymbol = true,
  className = '',
}) => {
  const sizeClasses = {
    sm: 'h-6',
    md: 'h-8',
    lg: 'h-10',
  };

  const avatarSizes = {
    sm: 'sm' as const,
    md: 'sm' as const,
    lg: 'md' as const,
  };

  return (
    <div className={`flex items-center gap-2 ${sizeClasses[size]} ${className}`}>
      <Avatar
        src={imageUri}
        size={avatarSizes[size]}
        fallback={symbol.slice(0, 2).toUpperCase()}
      />
      <div className="flex flex-col justify-center">
        <Text variant="body" className="font-medium leading-tight">
          {name}
        </Text>
        {showSymbol && (
          <Text variant="caption" color="muted" className="leading-tight">
            ${symbol}
          </Text>
        )}
      </div>
    </div>
  );
};

// =============================================================================
// PRICE DISPLAY
// =============================================================================

interface PriceDisplayProps {
  price: number;
  change24h?: number;
  currency?: string;
  size?: 'sm' | 'md' | 'lg';
  showChange?: boolean;
  className?: string;
}

export const PriceDisplay: React.FC<PriceDisplayProps> = ({
  price,
  change24h,
  currency = 'SOL',
  size = 'md',
  showChange = true,
  className = '',
}) => {
  const textVariants = {
    sm: 'body' as const,
    md: 'h4' as const,
    lg: 'h2' as const,
  };

  const formatPrice = (p: number) => {
    if (p < 0.000001) return p.toExponential(2);
    if (p < 0.01) return p.toFixed(6);
    if (p < 1) return p.toFixed(4);
    return p.toFixed(2);
  };

  const isPositive = change24h !== undefined && change24h >= 0;

  return (
    <div className={`flex items-baseline gap-2 ${className}`}>
      <Text variant={textVariants[size]} className="font-mono font-semibold">
        {formatPrice(price)} {currency}
      </Text>
      {showChange && change24h !== undefined && (
        <div className={`flex items-center gap-1 ${
          isPositive ? 'text-green-400' : 'text-rose-400'
        }`}>
          {isPositive ? (
            <IconArrowUp className="w-3 h-3" />
          ) : (
            <IconArrowDown className="w-3 h-3" />
          )}
          <Text variant="caption" className="font-mono">
            {Math.abs(change24h).toFixed(2)}%
          </Text>
        </div>
      )}
    </div>
  );
};

// =============================================================================
// STAT CARD
// =============================================================================

interface StatCardProps {
  label: string;
  value: string | number;
  change?: number;
  icon?: React.ReactNode;
  loading?: boolean;
  className?: string;
}

export const StatCard: React.FC<StatCardProps> = ({
  label,
  value,
  change,
  icon,
  loading = false,
  className = '',
}) => {
  if (loading) {
    return (
      <Card className={`p-4 ${className}`}>
        <Skeleton className="h-4 w-20 mb-2" />
        <Skeleton className="h-8 w-32" />
      </Card>
    );
  }

  const isPositive = change !== undefined && change >= 0;

  return (
    <Card className={`p-4 ${className}`}>
      <div className="flex items-center gap-2 mb-2">
        {icon && <span className="text-green-400">{icon}</span>}
        <Text variant="caption" color="muted">
          {label}
        </Text>
      </div>
      <div className="flex items-baseline gap-2">
        <Text variant="h3" className="font-semibold">
          {typeof value === 'number' ? value.toLocaleString() : value}
        </Text>
        {change !== undefined && (
          <span className={`flex items-center text-sm ${
            isPositive ? 'text-green-400' : 'text-rose-400'
          }`}>
            {isPositive ? '+' : ''}{change.toFixed(1)}%
          </span>
        )}
      </div>
    </Card>
  );
};

// =============================================================================
// GRADUATION PROGRESS
// =============================================================================

interface GraduationProgressProps {
  current: number;
  threshold?: number;
  target?: number; // Alias for threshold
  status?: LaunchData['status'];
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  className?: string;
}

export const GraduationProgress: React.FC<GraduationProgressProps> = ({
  current,
  threshold,
  target,
  status = 'Active',
  size = 'md',
  showLabel = false,
  className = '',
}) => {
  // Use target as alias for threshold (values are in lamports)
  // Default to 85 SOL (85_000_000_000 lamports) if not provided
  const thresholdValue = threshold ?? target ?? 85_000_000_000;
  const progress = Math.min((current / thresholdValue) * 100, 100);
  const remaining = Math.max(thresholdValue - current, 0);

  // Convert lamports to SOL for display
  const currentSol = current / 1e9;
  const remainingSol = remaining / 1e9;

  const getStatusBadge = () => {
    switch (status) {
      case 'Active':
        return <Badge variant="info">Active</Badge>;
      case 'PendingGraduation':
        return <Badge variant="warning">Ready to Graduate</Badge>;
      case 'Graduated':
        return <Badge variant="success">Graduated</Badge>;
      case 'Cancelled':
        return <Badge variant="error">Cancelled</Badge>;
    }
  };

  return (
    <Card className={`p-4 ${className}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <IconOrbit className="w-5 h-5 text-green-400" />
          <Text variant="body" className="font-medium">
            Graduation Progress
          </Text>
        </div>
        {getStatusBadge()}
      </div>

      <ProgressBar value={progress} size="lg" showLabel className="mb-3" />

      <div className="flex justify-between text-sm">
        <Text variant="caption" color="muted">
          {currentSol.toFixed(2)} SOL raised
        </Text>
        <Text variant="caption" color="muted">
          {remainingSol.toFixed(2)} SOL to graduation
        </Text>
      </div>

      {status === 'Graduated' && (
        <div className="mt-3 pt-3 border-t border-white/10">
          <div className="flex items-center gap-2 text-green-400">
            <IconGraduate className="w-4 h-4" />
            <Text variant="caption">
              Trading on Orbit Finance DLMM
            </Text>
          </div>
        </div>
      )}
    </Card>
  );
};

// =============================================================================
// TRADE INPUT
// =============================================================================

interface TradeInputProps {
  type: 'buy' | 'sell';
  amount: string;
  onAmountChange: (amount: string) => void;
  tokenSymbol: string;
  balance?: number;
  price?: number;
  onMaxClick?: () => void;
  disabled?: boolean;
  className?: string;
}

export const TradeInput: React.FC<TradeInputProps> = ({
  type,
  amount,
  onAmountChange,
  tokenSymbol,
  balance,
  price,
  onMaxClick,
  disabled = false,
  className = '',
}) => {
  const estimatedValue = useMemo(() => {
    if (!amount || !price) return null;
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount)) return null;
    return type === 'buy' 
      ? numAmount / price  // SOL -> tokens
      : numAmount * price; // tokens -> SOL
  }, [amount, price, type]);

  return (
    <div className={`space-y-2 ${className}`}>
      <div className="flex justify-between items-center">
        <Text variant="caption" color="muted">
          {type === 'buy' ? 'You pay' : 'You sell'}
        </Text>
        {balance !== undefined && (
          <Text variant="caption" color="muted">
            Balance: {balance.toFixed(4)} {type === 'buy' ? 'SOL' : tokenSymbol}
          </Text>
        )}
      </div>
      
      <div className="relative">
        <Input
          type="number"
          value={amount}
          onChange={(e) => onAmountChange(e.target.value)}
          placeholder="0.00"
          disabled={disabled}
          className="pr-20"
          aria-label={`Amount to ${type}`}
        />
        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
          {onMaxClick && (
            <button
              onClick={onMaxClick}
              className="text-xs text-green-400 hover:text-green-300 font-medium focus:outline-none focus:ring-2 focus:ring-green-500/50 rounded"
              disabled={disabled}
              aria-label={`Use maximum ${type === 'buy' ? 'SOL' : tokenSymbol} balance`}
            >
              MAX
            </button>
          )}
          <Text variant="caption" className="font-medium" aria-hidden="true">
            {type === 'buy' ? 'SOL' : tokenSymbol}
          </Text>
        </div>
      </div>

      {estimatedValue !== null && (
        <div className="flex items-center justify-between text-sm">
          <Text variant="caption" color="muted">
            {type === 'buy' ? 'You receive' : 'You receive'}
          </Text>
          <Text variant="caption" className="font-mono">
            ~{estimatedValue.toFixed(4)} {type === 'buy' ? tokenSymbol : 'SOL'}
          </Text>
        </div>
      )}
    </div>
  );
};

// =============================================================================
// TRADE TOGGLE
// =============================================================================

interface TradeToggleProps {
  value: 'buy' | 'sell';
  onChange: (value: 'buy' | 'sell') => void;
  className?: string;
}

export const TradeToggle: React.FC<TradeToggleProps> = ({
  value,
  onChange,
  className = '',
}) => {
  return (
    <div
      className={`flex bg-white/5 rounded-lg p-1 ${className}`}
      role="group"
      aria-label="Trade type selector"
    >
      <button
        onClick={() => onChange('buy')}
        className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all ${
          value === 'buy'
            ? 'bg-green-500 text-white'
            : 'text-white/60 hover:text-white'
        }`}
        aria-pressed={value === 'buy'}
        aria-label="Buy tokens"
      >
        Buy
      </button>
      <button
        onClick={() => onChange('sell')}
        className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all ${
          value === 'sell'
            ? 'bg-rose-500 text-white'
            : 'text-white/60 hover:text-white'
        }`}
        aria-pressed={value === 'sell'}
        aria-label="Sell tokens"
      >
        Sell
      </button>
    </div>
  );
};

// =============================================================================
// TRANSACTION ROW
// =============================================================================

interface TransactionRowProps {
  trade: TradeData;
  tokenSymbol: string;
  className?: string;
}

export const TransactionRow: React.FC<TransactionRowProps> = ({
  trade,
  tokenSymbol,
  className = '',
}) => {
  const isBuy = trade.type === 'buy';
  const shortUser = `${trade.user.slice(0, 4)}...${trade.user.slice(-4)}`;
  
  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp * 1000);
    const now = new Date();
    const diff = (now.getTime() - date.getTime()) / 1000;
    
    if (diff < 60) return `${Math.floor(diff)}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  };

  return (
    <div className={`flex items-center justify-between py-3 border-b border-white/5 ${className}`}>
      <div className="flex items-center gap-3">
        <div className={`p-1.5 rounded-md ${
          isBuy ? 'bg-green-500/20' : 'bg-rose-500/20'
        }`}>
          {isBuy ? (
            <IconArrowUp className="w-4 h-4 text-green-400" />
          ) : (
            <IconArrowDown className="w-4 h-4 text-rose-400" />
          )}
        </div>
        <div>
          <Text variant="body" className="font-medium">
            {isBuy ? 'Buy' : 'Sell'} {trade.amount.toLocaleString()} {tokenSymbol}
          </Text>
          <Text variant="caption" color="muted">
            {shortUser} · {formatTime(trade.timestamp)}
          </Text>
        </div>
      </div>
      <div className="text-right">
        <Text variant="body" className="font-mono">
          {trade.solAmount.toFixed(4)} SOL
        </Text>
        <a
          href={`https://solscan.io/tx/${trade.txSignature}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-green-400 hover:text-green-300 flex items-center gap-1 justify-end"
        >
          View <IconExternalLink className="w-3 h-3" />
        </a>
      </div>
    </div>
  );
};

// =============================================================================
// POSITION SUMMARY
// =============================================================================

interface PositionSummaryProps {
  position: UserPositionData;
  tokenSymbol: string;
  currentPrice: number;
  className?: string;
}

export const PositionSummary: React.FC<PositionSummaryProps> = ({
  position,
  tokenSymbol,
  currentPrice,
  className = '',
}) => {
  const isProfit = position.totalPnl >= 0;
  const currentValue = position.tokenBalance * currentPrice;

  return (
    <Card className={`p-4 ${className}`}>
      <Text variant="h4" className="mb-4 font-semibold">
        Your Position
      </Text>

      <div className="space-y-3">
        <div className="flex justify-between">
          <Text variant="caption" color="muted">Holdings</Text>
          <Text variant="body" className="font-mono">
            {position.tokenBalance.toLocaleString()} {tokenSymbol}
          </Text>
        </div>

        <div className="flex justify-between">
          <Text variant="caption" color="muted">Current Value</Text>
          <Text variant="body" className="font-mono">
            {currentValue.toFixed(4)} SOL
          </Text>
        </div>

        <div className="flex justify-between">
          <Text variant="caption" color="muted">Avg Buy Price</Text>
          <Text variant="body" className="font-mono">
            {position.avgBuyPrice.toFixed(9)} SOL
          </Text>
        </div>

        <div className="flex justify-between">
          <Text variant="caption" color="muted">Cost Basis</Text>
          <Text variant="body" className="font-mono">
            {position.costBasis.toFixed(4)} SOL
          </Text>
        </div>

        <div className="pt-3 border-t border-white/10">
          <div className="flex justify-between items-center">
            <Text variant="body" className="font-medium">Total P&L</Text>
            <div className={`flex items-center gap-2 ${
              isProfit ? 'text-green-400' : 'text-rose-400'
            }`}>
              {isProfit ? (
                <IconArrowUp className="w-4 h-4" />
              ) : (
                <IconArrowDown className="w-4 h-4" />
              )}
              <span className="font-mono font-semibold">
                {isProfit ? '+' : ''}{position.totalPnl.toFixed(4)} SOL
              </span>
              <span className="text-sm">
                ({isProfit ? '+' : ''}{position.roiPercent.toFixed(2)}%)
              </span>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
};

// =============================================================================
// SOCIAL LINKS
// =============================================================================

interface SocialLinksProps {
  twitter?: string;
  telegram?: string;
  website?: string;
  className?: string;
}

export const SocialLinks: React.FC<SocialLinksProps> = ({
  twitter,
  telegram,
  website,
  className = '',
}) => {
  const links = [
    { url: twitter, icon: IconTwitter, label: 'Twitter' },
    { url: telegram, icon: IconTelegram, label: 'Telegram' },
    { url: website, icon: IconGlobe, label: 'Website' },
  ].filter(link => link.url);

  if (links.length === 0) return null;

  return (
    <nav className={`flex items-center gap-2 ${className}`} aria-label="Social links">
      {links.map(({ url, icon: Icon, label }) => (
        <a
          key={label}
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="p-2 bg-white/5 rounded-lg hover:bg-white/10 transition-colors focus:outline-none focus:ring-2 focus:ring-green-500/50"
          aria-label={`Visit ${label}`}
        >
          <Icon className="w-4 h-4 text-white/60 hover:text-white" aria-hidden="true" />
        </a>
      ))}
    </nav>
  );
};

// =============================================================================
// LAUNCH CARD (Compact)
// =============================================================================

interface LaunchCardCompactProps {
  launch: LaunchData;
  onClick?: () => void;
  className?: string;
}

export const LaunchCardCompact: React.FC<LaunchCardCompactProps> = ({
  launch,
  onClick,
  className = '',
}) => {
  const progress = (launch.realSolReserve / launch.graduationThreshold) * 100;

  return (
    <Card 
      hover 
      onClick={onClick}
      className={`p-4 cursor-pointer ${className}`}
    >
      <div className="flex items-start justify-between mb-3">
        <TokenBadge
          name={launch.name}
          symbol={launch.symbol}
          imageUri={launch.uri}
        />
        {launch.status === 'Graduated' ? (
          <Badge variant="success">
            <IconOrbit className="w-3 h-3 mr-1" />
            Orbit
          </Badge>
        ) : (
          <Badge variant="info">
            {progress.toFixed(0)}%
          </Badge>
        )}
      </div>

      <div className="flex items-center justify-between mb-3">
        <PriceDisplay price={launch.currentPrice} size="sm" showChange={false} />
        <Text variant="caption" color="muted">
          MC: {formatCompactNumber(launch.marketCap)} SOL
        </Text>
      </div>

      {launch.status !== 'Graduated' && (
        <ProgressBar value={progress} size="sm" />
      )}

      <div className="flex items-center justify-between mt-3 text-xs">
        <Text variant="caption" color="muted">
          {launch.holderCount} holders
        </Text>
        <Text variant="caption" color="muted">
          {launch.tradeCount} trades
        </Text>
      </div>
    </Card>
  );
};

// =============================================================================
// JUPITER SWAP WIDGET
// =============================================================================

interface JupiterQuote {
  inputMint: string;
  outputMint: string;
  inAmount: string;
  outAmount: string;
  priceImpactPct: string;
  slippageBps: number;
}

interface JupiterSwapWidgetProps {
  inputMint?: string;
  outputMint?: string;
  inputSymbol?: string;
  outputSymbol?: string;
  inputDecimals?: number;
  outputDecimals?: number;
  walletBalance?: number;
  onSwap?: (quote: JupiterQuote, inputAmount: string) => Promise<void>;
  disabled?: boolean;
  className?: string;
}

export const JupiterSwapWidget: React.FC<JupiterSwapWidgetProps> = ({
  inputMint = 'So11111111111111111111111111111111111111112', // SOL
  outputMint,
  inputSymbol = 'SOL',
  outputSymbol = 'TOKEN',
  inputDecimals = 9,
  outputDecimals = 6,
  walletBalance,
  onSwap,
  disabled = false,
  className = '',
}) => {
  const [inputAmount, setInputAmount] = useState('');
  const [outputAmount, setOutputAmount] = useState('');
  const [slippage, setSlippage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [quote, setQuote] = useState<JupiterQuote | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [swapDirection, setSwapDirection] = useState<'buy' | 'sell'>('buy');

  // Debounced quote fetching
  useEffect(() => {
    if (!inputAmount || !outputMint) {
      setQuote(null);
      setOutputAmount('');
      return;
    }

    const fetchQuote = async () => {
      setLoading(true);
      setError(null);

      try {
        const amountInSmallest = Math.floor(
          parseFloat(inputAmount) * Math.pow(10, swapDirection === 'buy' ? 9 : outputDecimals)
        );

        if (amountInSmallest <= 0 || isNaN(amountInSmallest)) {
          setQuote(null);
          setOutputAmount('');
          return;
        }

        const fromMint = swapDirection === 'buy' ? inputMint : outputMint;
        const toMint = swapDirection === 'buy' ? outputMint : inputMint;

        const response = await fetch(
          `https://quote-api.jup.ag/v6/quote?inputMint=${fromMint}&outputMint=${toMint}&amount=${amountInSmallest}&slippageBps=${slippage * 100}`
        );

        if (!response.ok) throw new Error('Failed to fetch quote');

        const data = await response.json();
        setQuote(data);

        // Calculate output amount
        const outDecimals = swapDirection === 'buy' ? outputDecimals : 9;
        const outAmount = parseInt(data.outAmount) / Math.pow(10, outDecimals);
        setOutputAmount(outAmount.toFixed(outDecimals > 6 ? 6 : outDecimals));
      } catch (err) {
        setError('Unable to fetch quote');
        setQuote(null);
        setOutputAmount('');
      } finally {
        setLoading(false);
      }
    };

    const debounce = setTimeout(fetchQuote, 500);
    return () => clearTimeout(debounce);
  }, [inputAmount, inputMint, outputMint, slippage, swapDirection, outputDecimals]);

  const handleSwap = async () => {
    if (!quote || !onSwap) return;

    setLoading(true);
    try {
      await onSwap(quote, inputAmount);
      setInputAmount('');
      setOutputAmount('');
      setQuote(null);
    } catch (err) {
      setError('Swap failed');
    } finally {
      setLoading(false);
    }
  };

  const handleFlipTokens = () => {
    setSwapDirection(prev => prev === 'buy' ? 'sell' : 'buy');
    setInputAmount('');
    setOutputAmount('');
    setQuote(null);
  };

  const handleMaxClick = () => {
    if (walletBalance !== undefined) {
      // Leave some SOL for gas if selling SOL
      const maxAmount = swapDirection === 'buy'
        ? Math.max(0, walletBalance - 0.01)
        : walletBalance;
      setInputAmount(maxAmount.toString());
    }
  };

  const priceImpact = quote ? parseFloat(quote.priceImpactPct) : 0;
  const highPriceImpact = priceImpact > 3;

  return (
    <Card className={`p-5 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <IconSwap className="w-5 h-5 text-green-400" />
          <Text variant="h4" className="font-semibold">
            Jupiter Swap
          </Text>
        </div>
        <Badge variant="success">DEX</Badge>
      </div>

      {/* Swap Direction Toggle */}
      <TradeToggle
        value={swapDirection}
        onChange={(v) => {
          setSwapDirection(v);
          setInputAmount('');
          setOutputAmount('');
          setQuote(null);
        }}
        className="mb-4"
      />

      {/* Input Token */}
      <div className="p-4 rounded-xl mb-2" style={{ background: 'var(--glass2)' }}>
        <div className="flex justify-between items-center mb-2">
          <Text variant="caption" color="muted">You pay</Text>
          {walletBalance !== undefined && (
            <Text variant="caption" color="muted">
              Balance: {walletBalance.toFixed(4)} {swapDirection === 'buy' ? 'SOL' : outputSymbol}
            </Text>
          )}
        </div>
        <div className="flex items-center gap-3">
          <input
            type="number"
            value={inputAmount}
            onChange={(e) => setInputAmount(e.target.value)}
            placeholder="0.00"
            disabled={disabled || !outputMint}
            className="flex-1 bg-transparent text-2xl font-mono font-semibold text-white
              placeholder-white/30 focus:outline-none"
          />
          <div className="flex items-center gap-2">
            {walletBalance !== undefined && (
              <button
                onClick={handleMaxClick}
                className="px-2 py-1 text-xs font-medium text-green-400 hover:text-green-300
                  bg-green-400/10 rounded-md transition-colors"
              >
                MAX
              </button>
            )}
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: 'var(--glass3)' }}>
              <div className="w-6 h-6 rounded-full bg-gradient-to-br from-purple-500 to-green-400" />
              <Text variant="body" className="font-semibold">
                {swapDirection === 'buy' ? inputSymbol : outputSymbol}
              </Text>
            </div>
          </div>
        </div>
      </div>

      {/* Swap Arrow */}
      <div className="flex justify-center -my-1 relative z-10">
        <button
          onClick={handleFlipTokens}
          className="p-2 rounded-xl border-4 transition-all hover:scale-110 active:scale-95"
          style={{
            background: 'var(--bg2)',
            borderColor: 'var(--bg1)'
          }}
        >
          <IconSwap className="w-4 h-4 text-white/60" />
        </button>
      </div>

      {/* Output Token */}
      <div className="p-4 rounded-xl mt-2" style={{ background: 'var(--glass2)' }}>
        <div className="flex justify-between items-center mb-2">
          <Text variant="caption" color="muted">You receive</Text>
          {loading && <Spinner size="sm" />}
        </div>
        <div className="flex items-center gap-3">
          <input
            type="text"
            value={loading ? '' : outputAmount}
            readOnly
            placeholder={loading ? 'Loading...' : '0.00'}
            className="flex-1 bg-transparent text-2xl font-mono font-semibold text-white
              placeholder-white/30 focus:outline-none"
          />
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: 'var(--glass3)' }}>
            <div className="w-6 h-6 rounded-full bg-gradient-to-br from-green-400 to-blue-500" />
            <Text variant="body" className="font-semibold">
              {swapDirection === 'buy' ? outputSymbol : inputSymbol}
            </Text>
          </div>
        </div>
      </div>

      {/* Quote Details */}
      {quote && (
        <div className="mt-4 p-3 rounded-lg space-y-2" style={{ background: 'var(--glass2)' }}>
          <div className="flex justify-between items-center">
            <Text variant="caption" color="muted">Price Impact</Text>
            <Text
              variant="caption"
              className={`font-mono ${highPriceImpact ? 'text-amber-400' : ''}`}
            >
              {priceImpact.toFixed(2)}%
              {highPriceImpact && ' ⚠️'}
            </Text>
          </div>
          <div className="flex justify-between items-center">
            <Text variant="caption" color="muted">Slippage</Text>
            <Text variant="caption" className="font-mono">{slippage}%</Text>
          </div>
          <div className="flex justify-between items-center">
            <Text variant="caption" color="muted">Minimum Received</Text>
            <Text variant="caption" className="font-mono">
              {(parseFloat(outputAmount) * (1 - slippage / 100)).toFixed(6)} {swapDirection === 'buy' ? outputSymbol : inputSymbol}
            </Text>
          </div>
        </div>
      )}

      {/* Slippage Settings */}
      <div className="mt-4">
        <SlippageSelector value={slippage} onChange={setSlippage} />
      </div>

      {/* Error Display */}
      {error && (
        <div className="mt-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
          <Text variant="caption" className="text-red-400">{error}</Text>
        </div>
      )}

      {/* Swap Button */}
      <Button
        variant="primary"
        size="lg"
        onClick={handleSwap}
        disabled={disabled || !quote || loading || !outputMint}
        loading={loading}
        className="w-full mt-4"
      >
        {!outputMint
          ? 'Select Token'
          : loading
            ? 'Fetching Quote...'
            : !quote
              ? 'Enter Amount'
              : `Swap ${swapDirection === 'buy' ? inputSymbol : outputSymbol} for ${swapDirection === 'buy' ? outputSymbol : inputSymbol}`
        }
      </Button>

      {/* Powered by Jupiter */}
      <div className="mt-3 flex items-center justify-center gap-2">
        <Text variant="caption" color="muted">Powered by</Text>
        <Text variant="caption" className="text-green-400 font-semibold">Jupiter</Text>
      </div>
    </Card>
  );
};

// =============================================================================
// SLIPPAGE SELECTOR
// =============================================================================

interface SlippageSelectorProps {
  value: number;
  onChange: (value: number) => void;
  className?: string;
}

export const SlippageSelector: React.FC<SlippageSelectorProps> = ({
  value,
  onChange,
  className = '',
}) => {
  const [customValue, setCustomValue] = useState('');
  const presets = [0.5, 1, 2, 5];

  const handleCustomChange = (input: string) => {
    setCustomValue(input);
    const num = parseFloat(input);
    if (!isNaN(num) && num > 0 && num <= 50) {
      onChange(num);
    }
  };

  // Determine warning level based on slippage
  const getSlippageWarning = () => {
    if (value >= 10) {
      return {
        level: 'danger',
        message: 'Very high slippage - you may lose significant value',
        color: 'text-red-400',
        bgColor: 'bg-red-500/10 border-red-500/30',
      };
    }
    if (value >= 5) {
      return {
        level: 'warning',
        message: 'High slippage may result in unfavorable execution',
        color: 'text-amber-400',
        bgColor: 'bg-amber-500/10 border-amber-500/30',
      };
    }
    if (value < 0.5) {
      return {
        level: 'info',
        message: 'Very low slippage - transaction may fail',
        color: 'text-blue-400',
        bgColor: 'bg-blue-500/10 border-blue-500/30',
      };
    }
    return null;
  };

  const warning = getSlippageWarning();

  return (
    <div className={`space-y-2 ${className}`}>
      <Text variant="caption" color="muted">
        Slippage Tolerance
      </Text>
      <div className="flex items-center gap-2">
        {presets.map((preset) => (
          <button
            key={preset}
            onClick={() => {
              onChange(preset);
              setCustomValue('');
            }}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
              value === preset && !customValue
                ? 'bg-green-500 text-white'
                : 'bg-white/5 text-white/60 hover:bg-white/10'
            }`}
          >
            {preset}%
          </button>
        ))}
        <div className="relative flex-1">
          <input
            type="number"
            value={customValue}
            onChange={(e) => handleCustomChange(e.target.value)}
            placeholder="Custom"
            className="w-full px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg
              text-sm text-white placeholder-white/40 focus:outline-none focus:border-green-500"
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-white/40">
            %
          </span>
        </div>
      </div>
      {/* Slippage Warning */}
      {warning && (
        <div className={`p-2 rounded-lg border ${warning.bgColor}`}>
          <Text variant="caption" className={warning.color}>
            {warning.message}
          </Text>
        </div>
      )}
    </div>
  );
};

// =============================================================================
// NAVIGATION TAB
// =============================================================================

interface TabItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
  badge?: string | number;
}

interface NavigationTabsProps {
  tabs: TabItem[];
  activeTab: string;
  onChange: (tabId: string) => void;
  className?: string;
}

export const NavigationTabs: React.FC<NavigationTabsProps> = ({
  tabs,
  activeTab,
  onChange,
  className = '',
}) => {
  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent, index: number) => {
    const tabCount = tabs.length;
    let newIndex = index;

    switch (e.key) {
      case 'ArrowRight':
        newIndex = (index + 1) % tabCount;
        break;
      case 'ArrowLeft':
        newIndex = (index - 1 + tabCount) % tabCount;
        break;
      case 'Home':
        newIndex = 0;
        break;
      case 'End':
        newIndex = tabCount - 1;
        break;
      default:
        return;
    }

    e.preventDefault();
    onChange(tabs[newIndex].id);
  };

  return (
    <div
      className={`flex items-center gap-1 bg-white/5 p-1 rounded-lg ${className}`}
      role="tablist"
      aria-label="Navigation tabs"
    >
      {tabs.map((tab, index) => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          onKeyDown={(e) => handleKeyDown(e, index)}
          role="tab"
          aria-selected={activeTab === tab.id}
          aria-controls={`tabpanel-${tab.id}`}
          tabIndex={activeTab === tab.id ? 0 : -1}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium
            transition-all ${
            activeTab === tab.id
              ? 'bg-white/10 text-white'
              : 'text-white/60 hover:text-white hover:bg-white/5'
          }`}
        >
          {tab.icon && <span aria-hidden="true">{tab.icon}</span>}
          {tab.label}
          {tab.badge !== undefined && (
            <span className="px-1.5 py-0.5 bg-green-500/20 text-green-400 rounded text-xs" aria-label={`${tab.badge} items`}>
              {tab.badge}
            </span>
          )}
        </button>
      ))}
    </div>
  );
};

// =============================================================================
// EMPTY STATE
// =============================================================================

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode | {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  action,
  className = '',
}) => {
  // Check if action is a React element or an object with label/onClick
  const isActionObject = action && typeof action === 'object' && 'label' in action && 'onClick' in action;

  return (
    <div className={`flex flex-col items-center justify-center py-12 ${className}`}>
      {icon && (
        <div className="mb-4 p-4 bg-white/5 rounded-full">
          {icon}
        </div>
      )}
      <Text variant="h4" className="mb-2">
        {title}
      </Text>
      {description && (
        <Text variant="body" color="muted" className="text-center max-w-md mb-4">
          {description}
        </Text>
      )}
      {action && (
        isActionObject ? (
          <Button variant="primary" onClick={(action as { label: string; onClick: () => void }).onClick}>
            {(action as { label: string; onClick: () => void }).label}
          </Button>
        ) : (
          action
        )
      )}
    </div>
  );
};

// =============================================================================
// HEADER
// =============================================================================

interface HeaderProps {
  walletAddress?: string;
  walletBalance?: number;
  connected?: boolean;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onSearch?: (query: string) => void;
  className?: string;
}

export const Header: React.FC<HeaderProps> = ({
  walletAddress = '',
  walletBalance,
  connected = false,
  onConnect,
  onDisconnect,
  onSearch,
  className = '',
}) => {
  const [searchQuery, setSearchQuery] = useState('');

  return (
    <header className={`flex items-center justify-between py-4 ${className}`}>
      <div className="flex items-center gap-8">
        <LaunchrLogo size="md" showText />
        <SearchBar
          value={searchQuery}
          onChange={setSearchQuery}
          onSearch={onSearch}
          placeholder="Search launches..."
          className="w-64"
        />
      </div>
      
      <WalletDisplay
        address={walletAddress}
        balance={walletBalance}
        connected={connected}
        onConnect={onConnect}
        onDisconnect={onDisconnect}
      />
    </header>
  );
};

// =============================================================================
// TOKEN IMAGE WITH METAPLEX METADATA
// =============================================================================

interface TokenImageProps {
  src?: string;
  alt?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  fallbackSymbol?: string;
  className?: string;
  onLoad?: () => void;
  onError?: () => void;
}

export const TokenImage: React.FC<TokenImageProps> = ({
  src,
  alt = 'Token',
  size = 'md',
  fallbackSymbol,
  className = '',
  onLoad,
  onError,
}) => {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

  const sizeMap = {
    sm: 32,
    md: 40,
    lg: 56,
    xl: 80,
  };

  const pixelSize = sizeMap[size];

  const handleLoad = () => {
    setLoaded(true);
    onLoad?.();
  };

  const handleError = () => {
    setError(true);
    onError?.();
  };

  // Get gradient based on fallback symbol
  const getGradient = () => {
    if (!fallbackSymbol) return 'linear-gradient(135deg, #6366f1, #8b5cf6)';
    const charCode = fallbackSymbol.charCodeAt(0);
    const gradients = [
      'linear-gradient(135deg, #f97316, #ea580c)',
      'linear-gradient(135deg, #8b5cf6, #7c3aed)',
      'linear-gradient(135deg, #06b6d4, #0891b2)',
      'linear-gradient(135deg, #ec4899, #db2777)',
      'linear-gradient(135deg, #22C55E, #16A34A)',
    ];
    return gradients[charCode % gradients.length];
  };

  return (
    <div
      className={`token-image-container ${className}`}
      style={{
        width: pixelSize,
        height: pixelSize,
        borderRadius: pixelSize * 0.25,
        flexShrink: 0,
      }}
    >
      {/* Placeholder */}
      {(!loaded || error || !src) && (
        <div
          className="token-image-placeholder"
          style={{
            width: '100%',
            height: '100%',
            borderRadius: 'inherit',
            background: getGradient(),
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {fallbackSymbol ? (
            <span style={{
              color: 'white',
              fontSize: pixelSize * 0.4,
              fontWeight: 700,
              opacity: 0.9,
            }}>
              {fallbackSymbol.slice(0, 2).toUpperCase()}
            </span>
          ) : (
            <svg
              width={pixelSize * 0.5}
              height={pixelSize * 0.5}
              viewBox="0 0 24 24"
              fill="white"
              opacity={0.5}
            >
              <rect x={3} y={3} width={18} height={18} rx={2} ry={2} />
              <circle cx={8.5} cy={8.5} r={1.5} />
              <path d="M21 15l-5-5L5 21" />
            </svg>
          )}
        </div>
      )}

      {/* Actual Image */}
      {src && !error && (
        <img
          src={src}
          alt={alt}
          onLoad={handleLoad}
          onError={handleError}
          className={loaded ? 'token-image-reveal' : ''}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            borderRadius: 'inherit',
            opacity: loaded ? 1 : 0,
            position: loaded ? 'relative' : 'absolute',
          }}
        />
      )}
    </div>
  );
};

// =============================================================================
// SKELETON CARD
// =============================================================================

interface SkeletonCardProps {
  variant?: 'launch' | 'trade' | 'stat';
  className?: string;
}

export const SkeletonCard: React.FC<SkeletonCardProps> = ({
  variant = 'launch',
  className = '',
}) => {
  if (variant === 'launch') {
    return (
      <div
        className={`p-4 rounded-2xl ${className}`}
        style={{ background: 'var(--glass)', border: '1px solid var(--glass-border)' }}
      >
        <div className="flex items-start gap-3 mb-4">
          <div className="skeleton-avatar" style={{ width: 40, height: 40 }} />
          <div className="flex-1">
            <div className="skeleton-premium skeleton-text mb-2" style={{ width: '60%' }} />
            <div className="skeleton-premium skeleton-text-sm" style={{ width: '40%' }} />
          </div>
          <div className="skeleton-premium" style={{ width: 50, height: 22, borderRadius: 11 }} />
        </div>
        <div className="skeleton-premium mb-3" style={{ width: '100%', height: 6, borderRadius: 3 }} />
        <div className="flex justify-between">
          <div className="skeleton-premium skeleton-text-sm" style={{ width: '30%' }} />
          <div className="skeleton-premium skeleton-text-sm" style={{ width: '25%' }} />
        </div>
      </div>
    );
  }

  if (variant === 'trade') {
    return (
      <div
        className={`p-3 rounded-xl ${className}`}
        style={{ background: 'var(--glass)', border: '1px solid var(--glass-border)' }}
      >
        <div className="flex items-center gap-3">
          <div className="skeleton-premium" style={{ width: 40, height: 40, borderRadius: 10 }} />
          <div className="flex-1">
            <div className="skeleton-premium skeleton-text mb-1" style={{ width: '50%' }} />
            <div className="skeleton-premium skeleton-text-sm" style={{ width: '70%' }} />
          </div>
          <div className="skeleton-premium skeleton-text" style={{ width: 60 }} />
        </div>
      </div>
    );
  }

  return (
    <div
      className={`p-4 rounded-xl ${className}`}
      style={{ background: 'var(--glass)', border: '1px solid var(--glass-border)' }}
    >
      <div className="skeleton-premium skeleton-text-sm mb-3" style={{ width: '40%' }} />
      <div className="skeleton-premium skeleton-text-lg" style={{ width: '60%' }} />
    </div>
  );
};

// =============================================================================
// SOL PRICE TICKER (for Nav)
// =============================================================================

interface SolPriceTickerProps {
  price: number;
  change24h?: number;
  loading?: boolean;
  className?: string;
}

export const SolPriceTicker: React.FC<SolPriceTickerProps> = ({
  price,
  change24h = 0,
  loading = false,
  className = '',
}) => {
  const [prevPrice, setPrevPrice] = useState(price);
  const [flashClass, setFlashClass] = useState('');

  useEffect(() => {
    if (price !== prevPrice && prevPrice > 0) {
      setFlashClass(price > prevPrice ? 'price-up-animate' : 'price-down-animate');
      const timer = setTimeout(() => setFlashClass(''), 500);
      setPrevPrice(price);
      return () => clearTimeout(timer);
    }
    setPrevPrice(price);
  }, [price, prevPrice]);

  if (loading) {
    return (
      <div className={`sol-price-nav ${className}`}>
        <div className="skeleton-premium" style={{ width: 60, height: 16 }} />
      </div>
    );
  }

  const isPositive = change24h >= 0;

  return (
    <div className={`sol-price-nav ${className}`}>
      <svg width={16} height={16} viewBox="0 0 128 128" fill="none">
        <defs>
          <linearGradient id="sol-gradient" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#00FFA3" />
            <stop offset="100%" stopColor="#DC1FFF" />
          </linearGradient>
        </defs>
        <circle cx="64" cy="64" r="60" fill="url(#sol-gradient)" />
        <path d="M40 80l14-14h34l-14 14H40z" fill="white" />
        <path d="M40 62l14 14h34l-14-14H40z" fill="white" />
        <path d="M40 44l14 14h34l-14-14H40z" fill="white" />
      </svg>
      <span className={`sol-price-value ${flashClass}`}>
        ${price.toFixed(2)}
      </span>
      <span className={`sol-price-change ${isPositive ? 'up' : 'down'}`}>
        {isPositive ? (
          <svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}>
            <path d="M12 19V5M5 12l7-7 7 7" />
          </svg>
        ) : (
          <svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}>
            <path d="M12 5v14M19 12l-7 7-7-7" />
          </svg>
        )}
        {Math.abs(change24h).toFixed(1)}%
      </span>
    </div>
  );
};

// =============================================================================
// LAUNCH CARD SKELETON
// =============================================================================

export const LaunchCardSkeletonGrid: React.FC<{ count?: number; className?: string }> = ({
  count = 6,
  className = '',
}) => {
  return (
    <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 ${className}`}>
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} variant="launch" />
      ))}
    </div>
  );
};

// =============================================================================
// TRADE LIST SKELETON
// =============================================================================

export const TradeListSkeleton: React.FC<{ count?: number; className?: string }> = ({
  count = 5,
  className = '',
}) => {
  return (
    <div className={`space-y-2 ${className}`}>
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} variant="trade" />
      ))}
    </div>
  );
};

// =============================================================================
// CONNECTION STATUS INDICATOR
// =============================================================================

interface ConnectionStatusProps {
  isOnline: boolean;
  isWebSocketConnected?: boolean;
  className?: string;
}

export const OfflineIndicator: React.FC<ConnectionStatusProps> = ({
  isOnline,
  isWebSocketConnected = true,
  className = '',
}) => {
  // Show nothing if everything is connected
  if (isOnline && isWebSocketConnected) return null;

  const getMessage = () => {
    if (!isOnline) {
      return "You're offline. Some features may be unavailable.";
    }
    if (!isWebSocketConnected) {
      return "Real-time updates disconnected. Reconnecting...";
    }
    return '';
  };

  const getBgColor = () => {
    if (!isOnline) return 'bg-amber-500/95';
    return 'bg-blue-500/95'; // WebSocket disconnected but online
  };

  const getTextColor = () => {
    if (!isOnline) return 'text-amber-900';
    return 'text-blue-100';
  };

  return (
    <div
      className={`fixed top-0 left-0 right-0 z-50 ${getBgColor()} backdrop-blur-sm py-2 px-4 ${className}`}
      role="alert"
      aria-live="polite"
    >
      <div className="max-w-7xl mx-auto flex items-center justify-center gap-2">
        <IconWarning className={`w-4 h-4 ${getTextColor()}`} />
        <span className={`text-sm font-medium ${getTextColor()}`}>
          {getMessage()}
        </span>
      </div>
    </div>
  );
};

export type { ConnectionStatusProps as OfflineIndicatorProps };

// =============================================================================
// TRADINGVIEW PRICE CHART
// =============================================================================

import {
  createChart,
  ColorType,
  CandlestickSeries,
  LineSeries,
  AreaSeries,
} from 'lightweight-charts';
import type { IChartApi, ISeriesApi, CandlestickData, LineData, AreaData, Time } from 'lightweight-charts';
import { useRef } from 'react';

export interface PriceChartProps {
  data: Array<{
    timestamp: number;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
  }>;
  chartType?: 'candle' | 'line' | 'area';
  height?: number;
  loading?: boolean;
  className?: string;
}

type AnySeries = ISeriesApi<'Candlestick'> | ISeriesApi<'Line'> | ISeriesApi<'Area'>;

export const PriceChart: React.FC<PriceChartProps> = ({
  data,
  chartType = 'candle',
  height = 300,
  loading = false,
  className = '',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<AnySeries | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // Create chart
    const chart = createChart(containerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: 'rgba(255, 255, 255, 0.5)',
        fontFamily: "'Inter', -apple-system, sans-serif",
        fontSize: 11,
      },
      grid: {
        vertLines: { color: 'rgba(255, 255, 255, 0.03)' },
        horzLines: { color: 'rgba(255, 255, 255, 0.03)' },
      },
      crosshair: {
        mode: 1,
        vertLine: {
          color: 'rgba(34, 197, 94, 0.3)',
          width: 1,
          style: 2,
          labelBackgroundColor: '#22c55e',
        },
        horzLine: {
          color: 'rgba(34, 197, 94, 0.3)',
          width: 1,
          style: 2,
          labelBackgroundColor: '#22c55e',
        },
      },
      rightPriceScale: {
        borderColor: 'rgba(255, 255, 255, 0.1)',
        scaleMargins: { top: 0.1, bottom: 0.1 },
      },
      timeScale: {
        borderColor: 'rgba(255, 255, 255, 0.1)',
        timeVisible: true,
        secondsVisible: false,
      },
      handleScale: { mouseWheel: true, pinch: true },
      handleScroll: { mouseWheel: true, pressedMouseMove: true, horzTouchDrag: true, vertTouchDrag: false },
    });

    chart.timeScale().fitContent();
    chartRef.current = chart;

    // Handle resize
    const handleResize = () => {
      if (containerRef.current && chartRef.current) {
        chartRef.current.applyOptions({
          width: containerRef.current.clientWidth,
        });
      }
    };

    window.addEventListener('resize', handleResize);
    handleResize();

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, []);

  // Update chart type and data
  useEffect(() => {
    if (!chartRef.current) return;

    // Remove existing series
    if (seriesRef.current) {
      chartRef.current.removeSeries(seriesRef.current);
      seriesRef.current = null;
    }

    if (data.length === 0) return;

    // Convert timestamps to seconds for TradingView (it expects Unix timestamp in seconds)
    const sortedData = [...data].sort((a, b) => a.timestamp - b.timestamp);
    const chart = chartRef.current;

    if (chartType === 'candle') {
      const candleSeries = chart.addSeries(CandlestickSeries, {
        upColor: '#22c55e',
        downColor: '#ef4444',
        borderUpColor: '#22c55e',
        borderDownColor: '#ef4444',
        wickUpColor: '#22c55e',
        wickDownColor: '#ef4444',
      });

      const candleData: CandlestickData<Time>[] = sortedData.map((d) => ({
        time: Math.floor(d.timestamp / 1000) as Time,
        open: d.open,
        high: d.high,
        low: d.low,
        close: d.close,
      }));

      candleSeries.setData(candleData);
      seriesRef.current = candleSeries as AnySeries;
    } else if (chartType === 'line') {
      const lineSeries = chart.addSeries(LineSeries, {
        color: '#22c55e',
        lineWidth: 2,
        crosshairMarkerVisible: true,
        crosshairMarkerRadius: 4,
        crosshairMarkerBorderColor: '#22c55e',
        crosshairMarkerBackgroundColor: '#0a0e17',
      });

      const lineData: LineData<Time>[] = sortedData.map((d) => ({
        time: Math.floor(d.timestamp / 1000) as Time,
        value: d.close,
      }));

      lineSeries.setData(lineData);
      seriesRef.current = lineSeries as AnySeries;
    } else if (chartType === 'area') {
      const areaSeries = chart.addSeries(AreaSeries, {
        topColor: 'rgba(34, 197, 94, 0.4)',
        bottomColor: 'rgba(34, 197, 94, 0.0)',
        lineColor: '#22c55e',
        lineWidth: 2,
        crosshairMarkerVisible: true,
        crosshairMarkerRadius: 4,
        crosshairMarkerBorderColor: '#22c55e',
        crosshairMarkerBackgroundColor: '#0a0e17',
      });

      const areaData: AreaData<Time>[] = sortedData.map((d) => ({
        time: Math.floor(d.timestamp / 1000) as Time,
        value: d.close,
      }));

      areaSeries.setData(areaData);
      seriesRef.current = areaSeries as AnySeries;
    }

    chart.timeScale().fitContent();
  }, [data, chartType]);

  if (loading) {
    return (
      <div
        className={`flex items-center justify-center ${className}`}
        style={{ height, background: 'rgba(255, 255, 255, 0.02)', borderRadius: 12 }}
      >
        <Spinner size="md" />
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div
        className={`flex flex-col items-center justify-center ${className}`}
        style={{ height, background: 'rgba(255, 255, 255, 0.02)', borderRadius: 12 }}
      >
        <svg width={32} height={32} viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth={1.5}>
          <line x1="12" y1="20" x2="12" y2="10"/>
          <line x1="18" y1="20" x2="18" y2="4"/>
          <line x1="6" y1="20" x2="6" y2="16"/>
        </svg>
        <span className="text-sm text-gray-500 mt-3">No trading data yet</span>
        <span className="text-xs text-gray-600 mt-1">Chart will appear after first trade</span>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={className}
      style={{ height, width: '100%' }}
    />
  );
};

// =============================================================================
// RE-EXPORT GRADIENT AVATAR
// =============================================================================

export { GradientAvatar } from '../atoms';

// =============================================================================
// EXPORT ALL
// =============================================================================

export type {
  PriceChangeProps,
  StatusBadgeProps,
  SearchBarProps,
  WalletDisplayProps,
  WalletSelectorProps,
  TokenBadgeProps,
  PriceDisplayProps,
  StatCardProps,
  GraduationProgressProps,
  TradeInputProps,
  TradeToggleProps,
  TransactionRowProps,
  PositionSummaryProps,
  SocialLinksProps,
  LaunchCardCompactProps,
  JupiterSwapWidgetProps,
  SlippageSelectorProps,
  TabItem,
  NavigationTabsProps,
  EmptyStateProps,
  HeaderProps,
  TokenImageProps,
  SkeletonCardProps,
  SolPriceTickerProps,
};
