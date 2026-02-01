/**
 * Launchr - Organisms
 * 
 * Launch into Orbit 🚀
 * Complex feature components that combine molecules for complete UI sections.
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Button,
  Text,
  Badge,
  Spinner,
  ProgressBar,
  Card,
  Skeleton,
  Input,
  IconRocket,
  IconTrending,
  IconSearch,
  IconArrowUp,
  IconArrowDown,
  IconExternalLink,
  IconOrbit,
  IconGraduate,
  IconPlus,
  IconSwap,
  IconSettings,
  IconWarning,
  LaunchrLogo,
} from '../atoms';
import {
  SearchBar,
  TokenBadge,
  PriceDisplay,
  StatCard,
  GraduationProgress,
  TradeInput,
  TradeToggle,
  TransactionRow,
  PositionSummary,
  SocialLinks,
  LaunchCardCompact,
  SlippageSelector,
  NavigationTabs,
  EmptyState,
  LaunchData,
  TradeData,
  UserPositionData,
} from '../molecules';

// =============================================================================
// TRADE PANEL
// =============================================================================

interface TradePanelProps {
  launch: LaunchData;
  userPosition?: UserPositionData;
  walletBalance?: number;
  onTrade: (type: 'buy' | 'sell', amount: number, slippage: number) => Promise<void>;
  disabled?: boolean;
  className?: string;
}

export const TradePanel: React.FC<TradePanelProps> = ({
  launch,
  userPosition,
  walletBalance = 0,
  onTrade,
  disabled = false,
  className = '',
}) => {
  const [tradeType, setTradeType] = useState<'buy' | 'sell'>('buy');
  const [amount, setAmount] = useState('');
  const [slippage, setSlippage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [showSlippage, setShowSlippage] = useState(false);

  const maxAmount = useMemo(() => {
    if (tradeType === 'buy') {
      return walletBalance;
    }
    return userPosition?.tokenBalance || 0;
  }, [tradeType, walletBalance, userPosition]);

  const estimatedOutput = useMemo(() => {
    if (!amount || !launch.currentPrice) return null;
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount)) return null;
    
    if (tradeType === 'buy') {
      // SOL -> tokens
      return numAmount / launch.currentPrice;
    }
    // tokens -> SOL
    return numAmount * launch.currentPrice;
  }, [amount, launch.currentPrice, tradeType]);

  const handleMax = () => {
    setAmount(maxAmount.toString());
  };

  const handleTrade = async () => {
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) return;

    setLoading(true);
    try {
      await onTrade(tradeType, numAmount, slippage);
      setAmount('');
    } finally {
      setLoading(false);
    }
  };

  const isGraduated = launch.status === 'Graduated';
  const canTrade = !disabled && !isGraduated && !loading;

  return (
    <Card className={`p-5 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <Text variant="h4" className="font-semibold">
          Trade {launch.symbol}
        </Text>
        <button
          onClick={() => setShowSlippage(!showSlippage)}
          className="flex items-center gap-1.5 text-sm text-teal-400 hover:text-teal-300"
        >
          <IconSettings className="w-4 h-4" />
          {slippage}%
        </button>
      </div>

      {/* Slippage Settings (collapsible) */}
      {showSlippage && (
        <div className="mb-4 pb-4 border-b border-white/10">
          <SlippageSelector value={slippage} onChange={setSlippage} />
        </div>
      )}

      {/* Trade Type Toggle */}
      <TradeToggle 
        value={tradeType} 
        onChange={setTradeType}
        className="mb-4"
      />

      {/* Input */}
      <TradeInput
        type={tradeType}
        amount={amount}
        onAmountChange={setAmount}
        tokenSymbol={launch.symbol}
        balance={maxAmount}
        price={launch.currentPrice}
        onMaxClick={handleMax}
        disabled={!canTrade}
        className="mb-4"
      />

      {/* Price Impact Warning */}
      {estimatedOutput !== null && parseFloat(amount) > maxAmount * 0.1 && (
        <div className="mb-4 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
          <div className="flex items-center gap-2 text-amber-400">
            <IconWarning className="w-4 h-4 flex-shrink-0" />
            <Text variant="caption" className="text-amber-400">
              Large trade may have significant price impact
            </Text>
          </div>
        </div>
      )}

      {/* Trade Button */}
      <Button
        variant={tradeType === 'buy' ? 'primary' : 'danger'}
        size="lg"
        fullWidth
        onClick={handleTrade}
        disabled={!canTrade || !amount || parseFloat(amount) <= 0}
        loading={loading}
      >
        {isGraduated ? (
          <>Trade on Orbit Finance</>
        ) : loading ? (
          'Processing...'
        ) : tradeType === 'buy' ? (
          `Buy ${launch.symbol}`
        ) : (
          `Sell ${launch.symbol}`
        )}
      </Button>

      {/* Graduated Notice */}
      {isGraduated && launch.orbitPool && (
        <a
          href={`https://app.orbitfinance.io/pool/${launch.orbitPool}`}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 flex items-center justify-center gap-2 text-sm text-teal-400 hover:text-teal-300"
        >
          <IconOrbit className="w-4 h-4" />
          Continue trading on Orbit
          <IconExternalLink className="w-3 h-3" />
        </a>
      )}

      {/* Current Position */}
      {userPosition && userPosition.tokenBalance > 0 && (
        <div className="mt-4 pt-4 border-t border-white/10">
          <PositionSummary
            position={userPosition}
            tokenSymbol={launch.symbol}
            currentPrice={launch.currentPrice}
          />
        </div>
      )}
    </Card>
  );
};

// =============================================================================
// LAUNCH DETAIL HEADER
// =============================================================================

interface LaunchDetailHeaderProps {
  launch: LaunchData;
  className?: string;
}

export const LaunchDetailHeader: React.FC<LaunchDetailHeaderProps> = ({
  launch,
  className = '',
}) => {
  return (
    <div className={`space-y-4 ${className}`}>
      {/* Token Info */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <TokenBadge
            name={launch.name}
            symbol={launch.symbol}
            imageUri={launch.uri}
            size="lg"
          />
          <div>
            <div className="flex items-center gap-2 mb-1">
              {launch.status === 'Graduated' && (
                <Badge variant="success">
                  <IconOrbit className="w-3 h-3 mr-1" />
                  On Orbit
                </Badge>
              )}
              {launch.status === 'PendingGraduation' && (
                <Badge variant="warning">
                  <IconGraduate className="w-3 h-3 mr-1" />
                  Ready to Graduate
                </Badge>
              )}
            </div>
            <SocialLinks
              twitter={launch.twitter}
              telegram={launch.telegram}
              website={launch.website}
            />
          </div>
        </div>
        
        <div className="text-right">
          <PriceDisplay price={launch.currentPrice} size="lg" />
          <Text variant="caption" color="muted">
            Market Cap: {launch.marketCap.toFixed(2)} SOL
          </Text>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard
          label="Holders"
          value={launch.holderCount}
          icon={<IconTrending className="w-4 h-4" />}
        />
        <StatCard
          label="Trades"
          value={launch.tradeCount}
          icon={<IconSwap className="w-4 h-4" />}
        />
        <StatCard
          label="SOL Raised"
          value={`${(launch.realSolReserve / 1e9).toFixed(2)}`}
        />
        <StatCard
          label="Tokens Sold"
          value={`${((launch.tokensSold / launch.totalSupply) * 100).toFixed(1)}%`}
        />
      </div>

      {/* Graduation Progress */}
      {launch.status !== 'Graduated' && (
        <GraduationProgress
          current={launch.realSolReserve}
          threshold={launch.graduationThreshold}
          status={launch.status}
        />
      )}
    </div>
  );
};

// =============================================================================
// TRANSACTION HISTORY
// =============================================================================

interface TransactionHistoryProps {
  trades: TradeData[];
  tokenSymbol: string;
  loading?: boolean;
  className?: string;
}

export const TransactionHistory: React.FC<TransactionHistoryProps> = ({
  trades,
  tokenSymbol,
  loading = false,
  className = '',
}) => {
  if (loading) {
    return (
      <Card className={`p-4 ${className}`}>
        <Text variant="h4" className="mb-4 font-semibold">
          Recent Trades
        </Text>
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex items-center justify-between py-3">
              <div className="flex items-center gap-3">
                <Skeleton className="w-8 h-8 rounded-md" />
                <div>
                  <Skeleton className="h-4 w-32 mb-1" />
                  <Skeleton className="h-3 w-24" />
                </div>
              </div>
              <Skeleton className="h-4 w-20" />
            </div>
          ))}
        </div>
      </Card>
    );
  }

  if (trades.length === 0) {
    return (
      <Card className={`p-4 ${className}`}>
        <Text variant="h4" className="mb-4 font-semibold">
          Recent Trades
        </Text>
        <EmptyState
          icon={<IconSwap className="w-8 h-8 text-white/40" />}
          title="No trades yet"
          description="Be the first to trade this token!"
        />
      </Card>
    );
  }

  return (
    <Card className={`p-4 ${className}`}>
      <Text variant="h4" className="mb-4 font-semibold">
        Recent Trades
      </Text>
      <div className="max-h-96 overflow-y-auto">
        {trades.map((trade, index) => (
          <TransactionRow
            key={`${trade.txSignature}-${index}`}
            trade={trade}
            tokenSymbol={tokenSymbol}
          />
        ))}
      </div>
    </Card>
  );
};

// =============================================================================
// LAUNCH GRID
// =============================================================================

interface LaunchGridProps {
  launches: LaunchData[];
  loading?: boolean;
  onLaunchClick?: (launch: LaunchData) => void;
  emptyMessage?: string;
  className?: string;
}

export const LaunchGrid: React.FC<LaunchGridProps> = ({
  launches,
  loading = false,
  onLaunchClick,
  emptyMessage = 'No launches found',
  className = '',
}) => {
  if (loading) {
    return (
      <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 ${className}`}>
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <Card key={i} className="p-4">
            <div className="flex items-center gap-3 mb-3">
              <Skeleton className="w-10 h-10 rounded-full" />
              <div>
                <Skeleton className="h-4 w-24 mb-1" />
                <Skeleton className="h-3 w-16" />
              </div>
            </div>
            <Skeleton className="h-6 w-32 mb-3" />
            <Skeleton className="h-2 w-full mb-3" />
            <div className="flex justify-between">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-3 w-20" />
            </div>
          </Card>
        ))}
      </div>
    );
  }

  if (launches.length === 0) {
    return (
      <EmptyState
        icon={<IconRocket className="w-12 h-12 text-white/40" />}
        title={emptyMessage}
        description="Check back soon or create your own launch!"
        action={{
          label: 'Create Launch',
          onClick: () => window.location.href = '/create',
        }}
        className={className}
      />
    );
  }

  return (
    <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 ${className}`}>
      {launches.map((launch) => (
        <LaunchCardCompact
          key={launch.publicKey}
          launch={launch}
          onClick={() => onLaunchClick?.(launch)}
        />
      ))}
    </div>
  );
};

// =============================================================================
// CREATE LAUNCH FORM
// =============================================================================

interface CreateLaunchFormProps {
  onSubmit: (data: CreateLaunchData) => Promise<void>;
  loading?: boolean;
  className?: string;
  // Additional optional props for controlled mode
  step?: number;
  formData?: Partial<CreateLaunchData> & { imageUrl?: string };
  onFormChange?: (data: any) => void;
  onNext?: () => void;
  onBack?: () => void;
  error?: string | null;
  walletConnected?: boolean;
}

export interface CreateLaunchData {
  name: string;
  symbol: string;
  description: string;
  imageUri: string;
  twitter?: string;
  telegram?: string;
  website?: string;
  creatorFeeBps: number;
}

export const CreateLaunchForm: React.FC<CreateLaunchFormProps> = ({
  onSubmit,
  loading = false,
  className = '',
}) => {
  const [formData, setFormData] = useState<CreateLaunchData>({
    name: '',
    symbol: '',
    description: '',
    imageUri: '',
    twitter: '',
    telegram: '',
    website: '',
    creatorFeeBps: 100, // 1% default
  });
  const [errors, setErrors] = useState<Partial<Record<keyof CreateLaunchData, string>>>({});

  const updateField = <K extends keyof CreateLaunchData>(
    field: K,
    value: CreateLaunchData[K]
  ) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setErrors(prev => ({ ...prev, [field]: undefined }));
  };

  const validate = (): boolean => {
    const newErrors: typeof errors = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Name is required';
    } else if (formData.name.length > 32) {
      newErrors.name = 'Name must be 32 characters or less';
    }

    if (!formData.symbol.trim()) {
      newErrors.symbol = 'Symbol is required';
    } else if (formData.symbol.length > 10) {
      newErrors.symbol = 'Symbol must be 10 characters or less';
    } else if (!/^[A-Z0-9]+$/.test(formData.symbol.toUpperCase())) {
      newErrors.symbol = 'Symbol must be alphanumeric';
    }

    if (!formData.imageUri.trim()) {
      newErrors.imageUri = 'Image URI is required';
    }

    if (formData.creatorFeeBps < 0 || formData.creatorFeeBps > 500) {
      newErrors.creatorFeeBps = 'Fee must be between 0% and 5%';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    await onSubmit({
      ...formData,
      symbol: formData.symbol.toUpperCase(),
    });
  };

  return (
    <form onSubmit={handleSubmit} className={`space-y-6 ${className}`}>
      {/* Token Details */}
      <Card className="p-6">
        <Text variant="h4" className="mb-4 font-semibold">
          Token Details
        </Text>
        
        <div className="grid grid-cols-2 gap-4 mb-4">
          <Input
            label="Token Name"
            value={formData.name}
            onChange={(e) => updateField('name', e.target.value)}
            placeholder="My Token"
            error={errors.name}
            hint="Max 32 characters"
          />
          <Input
            label="Symbol"
            value={formData.symbol}
            onChange={(e) => updateField('symbol', e.target.value.toUpperCase())}
            placeholder="TOKEN"
            error={errors.symbol}
            hint="Max 10 characters"
          />
        </div>

        <Input
          label="Description"
          value={formData.description}
          onChange={(e) => updateField('description', e.target.value)}
          placeholder="Describe your token..."
          className="mb-4"
        />

        <Input
          label="Image URI"
          value={formData.imageUri}
          onChange={(e) => updateField('imageUri', e.target.value)}
          placeholder="https://..."
          error={errors.imageUri}
          hint="IPFS or HTTP URL to token image"
        />
      </Card>

      {/* Social Links */}
      <Card className="p-6">
        <Text variant="h4" className="mb-4 font-semibold">
          Social Links (Optional)
        </Text>
        
        <div className="space-y-4">
          <Input
            label="Twitter"
            value={formData.twitter}
            onChange={(e) => updateField('twitter', e.target.value)}
            placeholder="https://twitter.com/..."
          />
          <Input
            label="Telegram"
            value={formData.telegram}
            onChange={(e) => updateField('telegram', e.target.value)}
            placeholder="https://t.me/..."
          />
          <Input
            label="Website"
            value={formData.website}
            onChange={(e) => updateField('website', e.target.value)}
            placeholder="https://..."
          />
        </div>
      </Card>

      {/* Fee Settings */}
      <Card className="p-6">
        <Text variant="h4" className="mb-4 font-semibold">
          Fee Settings
        </Text>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-white/60 mb-2">
              Creator Fee (0% - 5%)
            </label>
            <div className="flex items-center gap-4">
              <input
                type="range"
                min="0"
                max="500"
                step="10"
                value={formData.creatorFeeBps}
                onChange={(e) => updateField('creatorFeeBps', parseInt(e.target.value))}
                className="flex-1 accent-teal-500"
              />
              <Text variant="body" className="w-16 text-right font-mono">
                {(formData.creatorFeeBps / 100).toFixed(1)}%
              </Text>
            </div>
            {errors.creatorFeeBps && (
              <Text variant="caption" className="text-rose-400 mt-1">
                {errors.creatorFeeBps}
              </Text>
            )}
          </div>

          <div className="p-4 bg-white/5 rounded-lg">
            <Text variant="caption" color="muted">
              Fee Breakdown:
            </Text>
            <ul className="mt-2 space-y-1 text-sm">
              <li className="flex justify-between">
                <span className="text-white/60">Protocol Fee</span>
                <span>1%</span>
              </li>
              <li className="flex justify-between">
                <span className="text-white/60">Your Creator Fee</span>
                <span>{(formData.creatorFeeBps / 100).toFixed(1)}%</span>
              </li>
              <li className="flex justify-between border-t border-white/10 pt-1 mt-1">
                <span className="text-white/60">Total Fee</span>
                <span className="font-semibold">
                  {(1 + formData.creatorFeeBps / 100).toFixed(1)}%
                </span>
              </li>
            </ul>
          </div>
        </div>
      </Card>

      {/* Token Allocation Info */}
      <Card className="p-6">
        <Text variant="h4" className="mb-4 font-semibold">
          Token Allocation
        </Text>
        
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <Text variant="body" color="muted">You receive (creator)</Text>
            <Badge variant="accent">2%</Badge>
          </div>
          <div className="flex justify-between items-center">
            <Text variant="body" color="muted">Bonding curve trading</Text>
            <Badge variant="info">80%</Badge>
          </div>
          <div className="flex justify-between items-center">
            <Text variant="body" color="muted">Graduation liquidity</Text>
            <Badge variant="success">18%</Badge>
          </div>
        </div>

        <div className="mt-4 p-4 bg-teal-500/10 border border-teal-500/30 rounded-lg">
          <div className="flex items-start gap-2">
            <IconOrbit className="w-5 h-5 text-teal-400 mt-0.5" />
            <div>
              <Text variant="body" className="font-medium text-teal-400">
                Launch into Orbit
              </Text>
              <Text variant="caption" color="muted">
                When your launch reaches 85 SOL, it automatically graduates
                to Orbit Finance DLMM for concentrated liquidity trading.
              </Text>
            </div>
          </div>
        </div>
      </Card>

      {/* Submit */}
      <Button
        type="submit"
        variant="gradient"
        size="lg"
        fullWidth
        loading={loading}
        leftIcon={<IconRocket className="w-5 h-5" />}
      >
        Create Launch
      </Button>
    </form>
  );
};

// =============================================================================
// GRADUATE BUTTON
// =============================================================================

interface GraduateButtonProps {
  launch: LaunchData;
  onGraduate: () => Promise<void>;
  className?: string;
}

export const GraduateButton: React.FC<GraduateButtonProps> = ({
  launch,
  onGraduate,
  className = '',
}) => {
  const [loading, setLoading] = useState(false);

  const canGraduate = launch.status === 'PendingGraduation';

  const handleGraduate = async () => {
    if (!canGraduate) return;
    
    setLoading(true);
    try {
      await onGraduate();
    } finally {
      setLoading(false);
    }
  };

  if (launch.status === 'Graduated') {
    return (
      <a
        href={`https://app.orbitfinance.io/pool/${launch.orbitPool}`}
        target="_blank"
        rel="noopener noreferrer"
        className={`flex items-center justify-center gap-2 px-6 py-3 
          bg-gradient-to-r from-teal-500 to-emerald-500 rounded-xl
          text-white font-semibold hover:opacity-90 transition-opacity ${className}`}
      >
        <IconOrbit className="w-5 h-5" />
        View on Orbit Finance
        <IconExternalLink className="w-4 h-4" />
      </a>
    );
  }

  return (
    <Card className={`p-4 ${className}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <IconGraduate className="w-5 h-5 text-teal-400" />
          <Text variant="body" className="font-semibold">
            Graduate to Orbit
          </Text>
        </div>
        {canGraduate && (
          <Badge variant="success">Ready!</Badge>
        )}
      </div>

      <Text variant="caption" color="muted" className="mb-4">
        {canGraduate
          ? 'This launch is ready to graduate! Click below to migrate liquidity to Orbit Finance DLMM.'
          : `Graduation requires ${(launch.graduationThreshold / 1e9).toFixed(0)} SOL. Currently at ${(launch.realSolReserve / 1e9).toFixed(2)} SOL.`
        }
      </Text>

      <Button
        variant={canGraduate ? 'gradient' : 'secondary'}
        fullWidth
        onClick={handleGraduate}
        disabled={!canGraduate}
        loading={loading}
        leftIcon={<IconOrbit className="w-4 h-4" />}
      >
        {canGraduate ? 'Graduate Now' : 'Not Yet Ready'}
      </Button>
    </Card>
  );
};

// =============================================================================
// LEADERBOARD
// =============================================================================

interface LeaderboardEntry {
  rank: number;
  address: string;
  tokenBalance: number;
  solSpent: number;
  pnl: number;
}

interface LeaderboardProps {
  entries: LeaderboardEntry[];
  tokenSymbol: string;
  loading?: boolean;
  className?: string;
}

export const Leaderboard: React.FC<LeaderboardProps> = ({
  entries,
  tokenSymbol,
  loading = false,
  className = '',
}) => {
  if (loading) {
    return (
      <Card className={`p-4 ${className}`}>
        <Text variant="h4" className="mb-4 font-semibold">
          Top Holders
        </Text>
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex items-center justify-between py-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-24" />
            </div>
          ))}
        </div>
      </Card>
    );
  }

  if (entries.length === 0) {
    return (
      <Card className={`p-4 ${className}`}>
        <Text variant="h4" className="mb-4 font-semibold">
          Top Holders
        </Text>
        <EmptyState
          title="No holders yet"
          description="Be the first to buy!"
        />
      </Card>
    );
  }

  return (
    <Card className={`p-4 ${className}`}>
      <Text variant="h4" className="mb-4 font-semibold">
        Top Holders
      </Text>
      
      <div className="space-y-2">
        {entries.map((entry) => (
          <div
            key={entry.address}
            className="flex items-center justify-between py-2 border-b border-white/5 last:border-0"
          >
            <div className="flex items-center gap-3">
              <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                entry.rank === 1 ? 'bg-amber-500' :
                entry.rank === 2 ? 'bg-gray-400' :
                entry.rank === 3 ? 'bg-amber-700' :
                'bg-white/10'
              }`}>
                {entry.rank}
              </span>
              <Text variant="body" className="font-mono">
                {entry.address.slice(0, 4)}...{entry.address.slice(-4)}
              </Text>
            </div>
            
            <div className="text-right">
              <Text variant="body" className="font-mono">
                {entry.tokenBalance.toLocaleString()} {tokenSymbol}
              </Text>
              <Text variant="caption" className={entry.pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                {entry.pnl >= 0 ? '+' : ''}{entry.pnl.toFixed(4)} SOL
              </Text>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
};

// =============================================================================
// FOOTER
// =============================================================================

interface FooterProps {
  className?: string;
}

export const Footer: React.FC<FooterProps> = ({ className = '' }) => {
  return (
    <footer className={`py-8 border-t border-white/10 ${className}`}>
      <div className="flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <LaunchrLogo size="sm" showText />
          <Text variant="caption" color="muted">
            Launch into Orbit
          </Text>
        </div>

        <div className="flex items-center gap-6">
          <a href="https://docs.launchr.app" className="text-sm text-white/60 hover:text-white">
            Docs
          </a>
          <a href="https://github.com/cipherlabs/launchr" className="text-sm text-white/60 hover:text-white">
            GitHub
          </a>
          <a href="https://twitter.com/launchr_app" className="text-sm text-white/60 hover:text-white">
            Twitter
          </a>
          <a href="https://discord.gg/launchr" className="text-sm text-white/60 hover:text-white">
            Discord
          </a>
        </div>

        <div className="flex items-center gap-2">
          <Text variant="caption" color="muted">
            Powered by
          </Text>
          <a
            href="https://orbitfinance.io"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-teal-400 hover:text-teal-300"
          >
            <IconOrbit className="w-4 h-4" />
            Orbit Finance
          </a>
        </div>
      </div>

      <div className="mt-6 pt-6 border-t border-white/5 text-center">
        <Text variant="caption" color="muted">
          © 2026 CipherLabs. All rights reserved.
        </Text>
      </div>
    </footer>
  );
};

// =============================================================================
// WRAPPER COMPONENTS FOR BACKWARD COMPATIBILITY
// =============================================================================

// LaunchHeader is an alias for LaunchDetailHeader
export { LaunchDetailHeader as LaunchHeader };

// TransactionFeed wrapper - maps 'transactions' to 'trades' and extracts tokenSymbol from launch
interface TransactionFeedProps {
  transactions: TradeData[];
  launch: LaunchData;
  loading?: boolean;
  className?: string;
}

export const TransactionFeed: React.FC<TransactionFeedProps> = ({
  transactions,
  launch,
  loading,
  className,
}) => {
  return (
    <TransactionHistory
      trades={transactions}
      tokenSymbol={launch.symbol}
      loading={loading}
      className={className}
    />
  );
};

// HoldersList wrapper - maps 'holders' to 'entries' format
interface HoldersListProps {
  holders: Array<{ address: string; balance: number; percentage: number }>;
  tokenSymbol: string;
  loading?: boolean;
  className?: string;
}

export const HoldersList: React.FC<HoldersListProps> = ({
  holders,
  tokenSymbol,
  loading,
  className,
}) => {
  // Convert holders format to LeaderboardEntry format
  const entries: LeaderboardEntry[] = holders.map((holder, index) => ({
    rank: index + 1,
    address: holder.address,
    tokenBalance: holder.balance,
    solSpent: 0, // Not available in the original format
    pnl: 0, // Not available in the original format
  }));

  return (
    <Leaderboard
      entries={entries}
      tokenSymbol={tokenSymbol}
      loading={loading}
      className={className}
    />
  );
};

// =============================================================================
// PRICE CHART PLACEHOLDER
// =============================================================================

interface PriceChartProps {
  data: Array<{ timestamp: number; price: number }>;
  height?: number;
  className?: string;
}

export const PriceChart: React.FC<PriceChartProps> = ({
  data,
  height = 200,
  className = '',
}) => {
  if (data.length === 0) {
    return (
      <Card className={`p-4 ${className}`}>
        <div
          className="flex items-center justify-center text-gray-500"
          style={{ height }}
        >
          No price data available
        </div>
      </Card>
    );
  }

  // Simple SVG line chart
  const minPrice = Math.min(...data.map(d => d.price));
  const maxPrice = Math.max(...data.map(d => d.price));
  const range = maxPrice - minPrice || 1;

  const points = data.map((d, i) => {
    const x = (i / (data.length - 1)) * 100;
    const y = 100 - ((d.price - minPrice) / range) * 100;
    return `${x},${y}`;
  }).join(' ');

  return (
    <Card className={`p-4 ${className}`}>
      <svg
        width="100%"
        height={height}
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        className="overflow-visible"
      >
        <defs>
          <linearGradient id="priceGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#5eead4" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#5eead4" stopOpacity="0" />
          </linearGradient>
        </defs>
        <polyline
          fill="none"
          stroke="#5eead4"
          strokeWidth="2"
          vectorEffect="non-scaling-stroke"
          points={points}
        />
        <polygon
          fill="url(#priceGradient)"
          points={`0,100 ${points} 100,100`}
        />
      </svg>
    </Card>
  );
};

// =============================================================================
// EXPORT ALL
// =============================================================================

export type {
  TradePanelProps,
  LaunchDetailHeaderProps,
  TransactionHistoryProps,
  LaunchGridProps,
  CreateLaunchFormProps,
  GraduateButtonProps,
  LeaderboardEntry,
  LeaderboardProps,
  FooterProps,
  PriceChartProps,
};
