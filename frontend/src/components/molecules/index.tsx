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
      border: 'rgba(110, 231, 183, 0.2)',
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
    <div className={`relative ${className}`}>
      <Input
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        leftIcon={<IconSearch className="w-4 h-4" />}
        rightIcon={loading ? <Spinner size="sm" /> : undefined}
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
        <Text variant="body" className="font-mono">
          {balance.toFixed(4)} SOL
        </Text>
      )}
      <button
        onClick={handleCopy}
        className="flex items-center gap-2 px-3 py-2 bg-white/5 rounded-lg
          border border-white/10 hover:bg-white/10 transition-colors"
      >
        <Text variant="body" className="font-mono">
          {shortAddress}
        </Text>
        {copied ? (
          <IconCheck className="w-4 h-4 text-teal-400" />
        ) : (
          <IconCopy className="w-4 h-4 text-white/50" />
        )}
      </button>
      <Button variant="ghost" size="sm" onClick={onDisconnect}>
        Disconnect
      </Button>
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
          isPositive ? 'text-emerald-400' : 'text-rose-400'
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
        {icon && <span className="text-teal-400">{icon}</span>}
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
            isPositive ? 'text-emerald-400' : 'text-rose-400'
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
          <IconOrbit className="w-5 h-5 text-teal-400" />
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
          <div className="flex items-center gap-2 text-emerald-400">
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
        />
        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
          {onMaxClick && (
            <button
              onClick={onMaxClick}
              className="text-xs text-teal-400 hover:text-teal-300 font-medium"
              disabled={disabled}
            >
              MAX
            </button>
          )}
          <Text variant="caption" className="font-medium">
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
    <div className={`flex bg-white/5 rounded-lg p-1 ${className}`}>
      <button
        onClick={() => onChange('buy')}
        className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all ${
          value === 'buy'
            ? 'bg-emerald-500 text-white'
            : 'text-white/60 hover:text-white'
        }`}
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
          isBuy ? 'bg-emerald-500/20' : 'bg-rose-500/20'
        }`}>
          {isBuy ? (
            <IconArrowUp className="w-4 h-4 text-emerald-400" />
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
          className="text-xs text-teal-400 hover:text-teal-300 flex items-center gap-1 justify-end"
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
              isProfit ? 'text-emerald-400' : 'text-rose-400'
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
    <div className={`flex items-center gap-2 ${className}`}>
      {links.map(({ url, icon: Icon, label }) => (
        <a
          key={label}
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="p-2 bg-white/5 rounded-lg hover:bg-white/10 transition-colors"
          title={label}
        >
          <Icon className="w-4 h-4 text-white/60 hover:text-white" />
        </a>
      ))}
    </div>
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
                ? 'bg-teal-500 text-white'
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
              text-sm text-white placeholder-white/40 focus:outline-none focus:border-teal-500"
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-white/40">
            %
          </span>
        </div>
      </div>
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
  return (
    <div className={`flex items-center gap-1 bg-white/5 p-1 rounded-lg ${className}`}>
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium
            transition-all ${
            activeTab === tab.id
              ? 'bg-white/10 text-white'
              : 'text-white/60 hover:text-white hover:bg-white/5'
          }`}
        >
          {tab.icon}
          {tab.label}
          {tab.badge !== undefined && (
            <span className="px-1.5 py-0.5 bg-teal-500/20 text-teal-400 rounded text-xs">
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
  SlippageSelectorProps,
  TabItem,
  NavigationTabsProps,
  EmptyStateProps,
  HeaderProps,
};
