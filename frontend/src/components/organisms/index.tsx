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

  // Calculate price impact using constant product formula
  const priceImpact = useMemo(() => {
    if (!amount || !launch.virtualSolReserve || !launch.virtualTokenReserve) return 0;
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) return 0;

    const solReserve = launch.virtualSolReserve;
    const tokenReserve = launch.virtualTokenReserve;

    if (tradeType === 'buy') {
      // Buy: adding SOL, receiving tokens
      // Price before: solReserve / tokenReserve
      // After: (solReserve + dx) / (tokenReserve - dy) where dy = tokenReserve * dx / (solReserve + dx)
      const dx = numAmount * 1e9; // Convert SOL to lamports for precision
      const newSolReserve = solReserve + dx;
      const tokensOut = tokenReserve * dx / newSolReserve;
      const newTokenReserve = tokenReserve - tokensOut;

      const priceBefore = solReserve / tokenReserve;
      const priceAfter = newSolReserve / newTokenReserve;
      return ((priceAfter - priceBefore) / priceBefore) * 100;
    } else {
      // Sell: adding tokens, receiving SOL
      const dy = numAmount * 1e9; // Convert tokens to smallest unit
      const newTokenReserve = tokenReserve + dy;
      const solOut = solReserve * dy / newTokenReserve;
      const newSolReserve = solReserve - solOut;

      const priceBefore = solReserve / tokenReserve;
      const priceAfter = newSolReserve / newTokenReserve;
      return ((priceBefore - priceAfter) / priceBefore) * 100;
    }
  }, [amount, launch.virtualSolReserve, launch.virtualTokenReserve, tradeType]);

  // Determine warning level for price impact
  const priceImpactWarning = useMemo(() => {
    if (priceImpact >= 10) {
      return { level: 'danger', color: 'text-red-400', label: 'Very High' };
    }
    if (priceImpact >= 5) {
      return { level: 'warning', color: 'text-amber-400', label: 'High' };
    }
    if (priceImpact >= 2) {
      return { level: 'caution', color: 'text-yellow-400', label: 'Moderate' };
    }
    return null;
  }, [priceImpact]);

  // Calculate minimum output after slippage
  const minOutput = useMemo(() => {
    if (!estimatedOutput) return null;
    return estimatedOutput * (1 - slippage / 100);
  }, [estimatedOutput, slippage]);

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
          className="flex items-center gap-1.5 text-sm text-green-400 hover:text-green-300"
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

      {/* Trade Summary */}
      {estimatedOutput !== null && parseFloat(amount) > 0 && (
        <div className="mb-4 p-3 bg-white/5 rounded-lg space-y-2">
          <div className="flex justify-between items-center">
            <Text variant="caption" color="muted">Expected Output</Text>
            <Text variant="caption" className="font-mono">
              {estimatedOutput.toFixed(6)} {tradeType === 'buy' ? launch.symbol : 'SOL'}
            </Text>
          </div>
          {minOutput !== null && (
            <div className="flex justify-between items-center">
              <Text variant="caption" color="muted">Min. Output ({slippage}% slippage)</Text>
              <Text variant="caption" className="font-mono">
                {minOutput.toFixed(6)} {tradeType === 'buy' ? launch.symbol : 'SOL'}
              </Text>
            </div>
          )}
          <div className="flex justify-between items-center">
            <Text variant="caption" color="muted">Price Impact</Text>
            <Text variant="caption" className={`font-mono ${priceImpactWarning?.color || 'text-green-400'}`}>
              {priceImpact > 0.01 ? priceImpact.toFixed(2) : '< 0.01'}%
              {priceImpactWarning && ` (${priceImpactWarning.label})`}
            </Text>
          </div>
        </div>
      )}

      {/* Price Impact Warning */}
      {priceImpactWarning && priceImpact >= 2 && (
        <div className={`mb-4 p-3 rounded-lg border ${
          priceImpactWarning.level === 'danger'
            ? 'bg-red-500/10 border-red-500/30'
            : priceImpactWarning.level === 'warning'
              ? 'bg-amber-500/10 border-amber-500/30'
              : 'bg-yellow-500/10 border-yellow-500/30'
        }`}>
          <div className={`flex items-center gap-2 ${priceImpactWarning.color}`}>
            <IconWarning className="w-4 h-4 flex-shrink-0" />
            <Text variant="caption" className={priceImpactWarning.color}>
              {priceImpactWarning.level === 'danger'
                ? 'Very high price impact! You may lose significant value.'
                : priceImpactWarning.level === 'warning'
                  ? 'High price impact - consider a smaller trade size.'
                  : 'Moderate price impact expected.'}
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
          className="mt-3 flex items-center justify-center gap-2 text-sm text-green-400 hover:text-green-300"
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
// IMAGE UPLOAD COMPONENT
// =============================================================================

interface ImageUploadProps {
  value: string;
  onChange: (uri: string) => void;
  error?: string;
  className?: string;
}

const ImageUpload: React.FC<ImageUploadProps> = ({
  value,
  onChange,
  error,
  className = '',
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string>(value);
  const [uploadError, setUploadError] = useState<string>('');
  const [inputMode, setInputMode] = useState<'upload' | 'url'>('upload');
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Update preview when value changes
  useEffect(() => {
    if (value && value.startsWith('http')) {
      setPreviewUrl(value);
    }
  }, [value]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      await handleFile(files[0]);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      await handleFile(files[0]);
    }
  };

  const handleFile = async (file: File) => {
    // Validate file type
    if (!file.type.startsWith('image/')) {
      setUploadError('Please upload an image file (PNG, JPG, GIF, or WebP)');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setUploadError('Image must be less than 5MB');
      return;
    }

    setUploadError('');
    setIsUploading(true);

    try {
      // Create local preview immediately
      const localPreview = URL.createObjectURL(file);
      setPreviewUrl(localPreview);

      // Convert to base64 for reliable backend upload
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      // Try external image hosting first
      try {
        const formData = new FormData();
        formData.append('image', file);

        const response = await fetch('https://api.imgbb.com/1/upload?key=demo', {
          method: 'POST',
          body: formData,
        });

        if (response.ok) {
          const data = await response.json();
          if (data.success && data.data?.url) {
            setPreviewUrl(data.data.url);
            onChange(data.data.url);
            return;
          }
        }
      } catch {
        // External upload failed, fall through to base64
      }

      // Fallback: use base64 data URL (backend decodes and saves to disk)
      setPreviewUrl(base64);
      onChange(base64);
    } catch (err) {
      console.error('Upload error:', err);
      setUploadError('Failed to process image. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleUrlChange = (url: string) => {
    onChange(url);
    if (url && (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('ipfs://'))) {
      // Convert IPFS URI to HTTP gateway URL for preview
      const previewUri = url.startsWith('ipfs://')
        ? url.replace('ipfs://', 'https://ipfs.io/ipfs/')
        : url;
      setPreviewUrl(previewUri);
      setUploadError('');
    }
  };

  const clearImage = () => {
    setPreviewUrl('');
    onChange('');
    setUploadError('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className={`space-y-3 ${className}`}>
      <div className="flex items-center justify-between">
        <label className="block text-sm font-medium text-gray-300">
          Token Image <span className="text-rose-400">*</span>
        </label>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setInputMode('upload')}
            className={`px-3 py-1 text-xs rounded-lg transition-all ${
              inputMode === 'upload'
                ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                : 'bg-white/5 text-white/60 border border-white/10 hover:bg-white/10'
            }`}
          >
            Upload
          </button>
          <button
            type="button"
            onClick={() => setInputMode('url')}
            className={`px-3 py-1 text-xs rounded-lg transition-all ${
              inputMode === 'url'
                ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                : 'bg-white/5 text-white/60 border border-white/10 hover:bg-white/10'
            }`}
          >
            URL
          </button>
        </div>
      </div>

      {inputMode === 'upload' ? (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`
            relative border-2 border-dashed rounded-xl p-6 text-center cursor-pointer
            transition-all duration-200
            ${isDragging
              ? 'border-green-400 bg-green-400/10'
              : error || uploadError
                ? 'border-rose-500/50 bg-rose-500/5 hover:border-rose-500/70'
                : 'border-white/20 bg-white/5 hover:border-green-400/50 hover:bg-white/10'
            }
          `}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            className="hidden"
          />

          {isUploading ? (
            <div className="py-4">
              <Spinner size="lg" className="mx-auto mb-3" />
              <Text variant="body" color="muted">Uploading image...</Text>
            </div>
          ) : previewUrl ? (
            <div className="relative inline-block">
              <img
                src={previewUrl}
                alt="Token preview"
                className="w-24 h-24 rounded-xl object-cover mx-auto border border-white/10"
                onError={() => setPreviewUrl('')}
              />
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  clearImage();
                }}
                className="absolute -top-2 -right-2 w-6 h-6 bg-rose-500 rounded-full flex items-center justify-center text-white hover:bg-rose-600 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
              <Text variant="caption" color="muted" className="mt-3 block">
                Click or drag to replace
              </Text>
            </div>
          ) : (
            <div className="py-4">
              <div className="w-16 h-16 mx-auto mb-3 rounded-xl bg-white/10 flex items-center justify-center">
                <svg className="w-8 h-8 text-white/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <Text variant="body" className="font-medium mb-1">
                {isDragging ? 'Drop image here' : 'Drag & drop or click to upload'}
              </Text>
              <Text variant="caption" color="muted">
                PNG, JPG, GIF or WebP (max 5MB)
              </Text>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <Input
            value={value}
            onChange={(e) => handleUrlChange(e.target.value)}
            placeholder="https://... or ipfs://..."
            error={error}
            hint="IPFS, Arweave, or HTTP URL"
          />
          {previewUrl && (
            <div className="flex items-center gap-3 p-3 bg-white/5 rounded-xl">
              <img
                src={previewUrl}
                alt="Token preview"
                className="w-12 h-12 rounded-lg object-cover border border-white/10"
                onError={() => setPreviewUrl('')}
              />
              <div className="flex-1 min-w-0">
                <Text variant="caption" color="muted">Preview</Text>
                <Text variant="body" className="truncate text-sm">
                  {value.length > 40 ? `${value.slice(0, 40)}...` : value}
                </Text>
              </div>
            </div>
          )}
        </div>
      )}

      {(error || uploadError) && (
        <Text variant="caption" className="text-rose-400 flex items-center gap-1">
          <IconWarning className="w-3 h-3" />
          {error || uploadError}
        </Text>
      )}
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

// Transaction progress states
type TransactionStep = 'idle' | 'signing' | 'confirming' | 'success' | 'error';

export const CreateLaunchForm: React.FC<CreateLaunchFormProps> = ({
  onSubmit,
  loading = false,
  className = '',
  error: externalError,
}) => {
  const [formData, setFormData] = useState<CreateLaunchData>({
    name: '',
    symbol: '',
    description: '',
    imageUri: '',
    twitter: '',
    telegram: '',
    website: '',
    creatorFeeBps: 20, // Fixed at 0.2% (from 1% protocol fee)
  });
  const [errors, setErrors] = useState<Partial<Record<keyof CreateLaunchData, string>>>({});
  const [touched, setTouched] = useState<Partial<Record<keyof CreateLaunchData, boolean>>>({});
  const [txStep, setTxStep] = useState<TransactionStep>('idle');
  const [showPreview, setShowPreview] = useState(false);

  const updateField = <K extends keyof CreateLaunchData>(
    field: K,
    value: CreateLaunchData[K]
  ) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  const handleBlur = (field: keyof CreateLaunchData) => {
    setTouched(prev => ({ ...prev, [field]: true }));
    validateField(field);
  };

  const validateField = (field: keyof CreateLaunchData): boolean => {
    let error: string | undefined;

    switch (field) {
      case 'name':
        if (!formData.name.trim()) {
          error = 'Token name is required';
        } else if (formData.name.length > 32) {
          error = 'Name must be 32 characters or less';
        }
        break;
      case 'symbol':
        if (!formData.symbol.trim()) {
          error = 'Symbol is required';
        } else if (formData.symbol.length > 10) {
          error = 'Symbol must be 10 characters or less';
        } else if (!/^[A-Z0-9]+$/.test(formData.symbol.toUpperCase())) {
          error = 'Symbol must be alphanumeric only';
        }
        break;
      case 'imageUri':
        if (!formData.imageUri.trim()) {
          error = 'Token image is required';
        }
        break;
      // creatorFeeBps is fixed at 0.2% - no validation needed
      case 'twitter':
        if (formData.twitter && !formData.twitter.includes('twitter.com') && !formData.twitter.includes('x.com')) {
          error = 'Enter a valid Twitter/X URL';
        }
        break;
      case 'telegram':
        if (formData.telegram && !formData.telegram.includes('t.me')) {
          error = 'Enter a valid Telegram URL';
        }
        break;
      case 'website':
        if (formData.website && !formData.website.startsWith('http')) {
          error = 'Website must start with http:// or https://';
        }
        break;
    }

    setErrors(prev => ({ ...prev, [field]: error }));
    return !error;
  };

  const validate = (): boolean => {
    const fields: (keyof CreateLaunchData)[] = ['name', 'symbol', 'imageUri'];
    let isValid = true;

    fields.forEach(field => {
      if (!validateField(field)) {
        isValid = false;
      }
    });

    // Mark all fields as touched
    setTouched({ name: true, symbol: true, imageUri: true });

    return isValid;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setTxStep('signing');

    try {
      await onSubmit({
        ...formData,
        symbol: formData.symbol.toUpperCase(),
      });
      setTxStep('success');
    } catch (err) {
      console.error('Transaction error:', err);
      setTxStep('error');
    }
  };

  // Calculate form completion percentage
  const completionPercentage = useMemo(() => {
    let filled = 0;
    let total = 3; // Required fields: name, symbol, imageUri

    if (formData.name.trim()) filled++;
    if (formData.symbol.trim()) filled++;
    if (formData.imageUri.trim()) filled++;

    return Math.round((filled / total) * 100);
  }, [formData]);

  // Success celebration effect
  useEffect(() => {
    if (txStep === 'success') {
      // Trigger confetti or celebration animation
      const timer = setTimeout(() => {
        // Could integrate with a confetti library here
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [txStep]);

  // Transaction progress modal
  if (txStep !== 'idle') {
    return (
      <Card className={`p-8 text-center ${className}`}>
        {txStep === 'signing' && (
          <>
            <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-green-500/20 flex items-center justify-center animate-pulse">
              <svg className="w-10 h-10 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
            </div>
            <Text variant="h3" className="mb-2">Waiting for Signature</Text>
            <Text variant="body" color="muted" className="mb-6">
              Please confirm the transaction in your wallet
            </Text>
            <div className="flex items-center justify-center gap-2">
              <Spinner size="sm" />
              <Text variant="caption" color="muted">Waiting...</Text>
            </div>
          </>
        )}

        {txStep === 'confirming' && (
          <>
            <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-amber-500/20 flex items-center justify-center">
              <Spinner size="lg" />
            </div>
            <Text variant="h3" className="mb-2">Confirming Transaction</Text>
            <Text variant="body" color="muted" className="mb-6">
              Your token is being created on Solana...
            </Text>
            <ProgressBar value={75} className="max-w-xs mx-auto" />
          </>
        )}

        {txStep === 'success' && (
          <>
            <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-green-500/20 flex items-center justify-center">
              <svg className="w-10 h-10 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <Text variant="h3" className="mb-2 text-green-400">Launch Created!</Text>
            <Text variant="body" color="muted" className="mb-6">
              Your token "{formData.name}" ({formData.symbol}) is now live!
            </Text>
            <div className="flex gap-3 justify-center">
              <Button variant="primary" onClick={() => window.location.href = '/explore'}>
                View All Launches
              </Button>
              <Button variant="secondary" onClick={() => {
                setTxStep('idle');
                setFormData({
                  name: '',
                  symbol: '',
                  description: '',
                  imageUri: '',
                  twitter: '',
                  telegram: '',
                  website: '',
                  creatorFeeBps: 20, // Fixed at 0.2%
                });
              }}>
                Create Another
              </Button>
            </div>
          </>
        )}

        {txStep === 'error' && (
          <>
            <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-rose-500/20 flex items-center justify-center">
              <svg className="w-10 h-10 text-rose-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <Text variant="h3" className="mb-2 text-rose-400">Transaction Failed</Text>
            <Text variant="body" color="muted" className="mb-6">
              {externalError || 'Something went wrong. Please try again.'}
            </Text>
            <Button variant="secondary" onClick={() => setTxStep('idle')}>
              Try Again
            </Button>
          </>
        )}
      </Card>
    );
  }

  return (
    <form onSubmit={handleSubmit} className={`space-y-6 ${className}`}>
      {/* Progress Indicator */}
      <div className="mb-2">
        <div className="flex items-center justify-between mb-2">
          <Text variant="caption" color="muted">Form Completion</Text>
          <Text variant="caption" className="text-green-400 font-mono">{completionPercentage}%</Text>
        </div>
        <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-green-500 to-green-400 rounded-full transition-all duration-500"
            style={{ width: `${completionPercentage}%` }}
          />
        </div>
      </div>

      {/* Token Details */}
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 rounded-lg bg-green-500/20 flex items-center justify-center">
            <span className="text-green-400 font-bold">1</span>
          </div>
          <Text variant="h4" className="font-semibold">Token Details</Text>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div>
            <Input
              label="Token Name"
              value={formData.name}
              onChange={(e) => updateField('name', e.target.value)}
              onBlur={() => handleBlur('name')}
              placeholder="My Awesome Token"
              error={touched.name ? errors.name : undefined}
              hint={`${formData.name.length}/32 characters`}
            />
          </div>
          <div>
            <Input
              label="Symbol"
              value={formData.symbol}
              onChange={(e) => updateField('symbol', e.target.value.toUpperCase())}
              onBlur={() => handleBlur('symbol')}
              placeholder="TOKEN"
              error={touched.symbol ? errors.symbol : undefined}
              hint={`${formData.symbol.length}/10 characters`}
            />
          </div>
        </div>

        <div className="mb-6">
          <Input
            label="Description"
            value={formData.description}
            onChange={(e) => updateField('description', e.target.value)}
            placeholder="A brief description of your token and its purpose..."
            hint="Optional - appears on your token's page"
          />
        </div>

        {/* Image Upload */}
        <ImageUpload
          value={formData.imageUri}
          onChange={(uri) => updateField('imageUri', uri)}
          error={touched.imageUri ? errors.imageUri : undefined}
        />
      </Card>

      {/* Social Links */}
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center">
            <span className="text-white/60 font-bold">2</span>
          </div>
          <Text variant="h4" className="font-semibold">Social Links</Text>
          <Badge variant="muted" className="ml-2">Optional</Badge>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Input
            label="Twitter / X"
            value={formData.twitter}
            onChange={(e) => updateField('twitter', e.target.value)}
            onBlur={() => handleBlur('twitter')}
            placeholder="https://x.com/..."
            error={touched.twitter ? errors.twitter : undefined}
            leftIcon={
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
              </svg>
            }
          />
          <Input
            label="Telegram"
            value={formData.telegram}
            onChange={(e) => updateField('telegram', e.target.value)}
            onBlur={() => handleBlur('telegram')}
            placeholder="https://t.me/..."
            error={touched.telegram ? errors.telegram : undefined}
            leftIcon={
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
              </svg>
            }
          />
          <Input
            label="Website"
            value={formData.website}
            onChange={(e) => updateField('website', e.target.value)}
            onBlur={() => handleBlur('website')}
            placeholder="https://..."
            error={touched.website ? errors.website : undefined}
            leftIcon={
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
              </svg>
            }
          />
        </div>
      </Card>

      {/* Fee Structure (Fixed) */}
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center">
            <span className="text-white/60 font-bold">3</span>
          </div>
          <Text variant="h4" className="font-semibold">Trading Fees</Text>
          <Badge variant="muted" className="ml-2">Fixed</Badge>
        </div>

        <div className="p-4 bg-white/5 rounded-xl border border-white/10">
          <Text variant="caption" color="muted" className="mb-3 block">Fee Structure per Trade (1% total):</Text>
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm text-white/60">Creator Earnings</span>
              <span className="text-sm font-mono text-green-400">0.2%</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-white/60">Protocol Treasury</span>
              <span className="text-sm font-mono">0.8%</span>
            </div>
            <div className="flex justify-between items-center pt-2 border-t border-white/10">
              <span className="text-sm font-medium">Total Fee</span>
              <span className="text-sm font-bold font-mono text-white">1.0%</span>
            </div>
          </div>
        </div>

        <div className="mt-4 p-3 bg-green-500/10 rounded-lg border border-green-500/20">
          <div className="flex items-start gap-2">
            <svg className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <Text variant="caption" color="muted">
              You earn 0.2% of every trade on your token. Fees are automatically
              sent to your wallet with each transaction.
            </Text>
          </div>
        </div>
      </Card>

      {/* Tokenomics Info */}
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center">
            <IconRocket className="w-4 h-4 text-white/60" />
          </div>
          <Text variant="h4" className="font-semibold">Tokenomics</Text>
        </div>

        <div className="space-y-3 mb-4">
          <div className="flex justify-between items-center p-3 bg-blue-500/10 rounded-lg border border-blue-500/20">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-blue-500" />
              <Text variant="body">Bonding curve trading</Text>
            </div>
            <Badge variant="info">80%</Badge>
          </div>
          <div className="flex justify-between items-center p-3 bg-green-500/10 rounded-lg border border-green-500/20">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-green-500" />
              <Text variant="body">Graduation liquidity (LP locked)</Text>
            </div>
            <Badge variant="success">20%</Badge>
          </div>
        </div>

        <div className="p-4 bg-gradient-to-r from-green-500/10 to-green-400/10 border border-green-500/30 rounded-xl">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-green-500/20 flex items-center justify-center flex-shrink-0">
              <IconOrbit className="w-5 h-5 text-green-400" />
            </div>
            <div>
              <Text variant="body" className="font-semibold text-green-400 mb-1">
                Launch into Orbit
              </Text>
              <Text variant="caption" color="muted">
                When your launch reaches 85 SOL, it automatically graduates
                to Orbit Finance DLMM for concentrated liquidity trading with
                deeper markets and lower slippage.
              </Text>
            </div>
          </div>
        </div>
      </Card>

      {/* Preview Toggle */}
      {formData.name && formData.symbol && formData.imageUri && (
        <Card className="p-4">
          <button
            type="button"
            onClick={() => setShowPreview(!showPreview)}
            className="w-full flex items-center justify-between text-left"
          >
            <div className="flex items-center gap-2">
              <IconSearch className="w-5 h-5 text-white/40" />
              <Text variant="body" className="font-medium">Preview Your Token</Text>
            </div>
            <svg
              className={`w-5 h-5 text-white/40 transition-transform ${showPreview ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {showPreview && (
            <div className="mt-4 pt-4 border-t border-white/10">
              <div className="flex items-center gap-4 p-4 bg-white/5 rounded-xl">
                <img
                  src={formData.imageUri.startsWith('ipfs://')
                    ? formData.imageUri.replace('ipfs://', 'https://ipfs.io/ipfs/')
                    : formData.imageUri
                  }
                  alt={formData.name}
                  className="w-16 h-16 rounded-xl object-cover border border-white/10"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect fill="%23374151" width="100" height="100"/><text x="50" y="55" text-anchor="middle" fill="%23fff" font-size="40">?</text></svg>';
                  }}
                />
                <div className="flex-1">
                  <Text variant="h4" className="font-bold">{formData.name}</Text>
                  <Text variant="body" color="muted">${formData.symbol}</Text>
                  {formData.description && (
                    <Text variant="caption" color="muted" className="mt-1 line-clamp-2">
                      {formData.description}
                    </Text>
                  )}
                </div>
              </div>
            </div>
          )}
        </Card>
      )}

      {/* Submit */}
      <Button
        type="submit"
        variant="gradient"
        size="lg"
        fullWidth
        loading={loading}
        disabled={completionPercentage < 100}
        leftIcon={<IconRocket className="w-5 h-5" />}
        className="py-4"
      >
        {completionPercentage < 100
          ? 'Complete All Required Fields'
          : 'Create Launch'
        }
      </Button>

      {/* Cost Estimate */}
      <div className="text-center">
        <Text variant="caption" color="muted">
          Estimated cost: ~0.02 SOL (network fees)
        </Text>
      </div>
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
          bg-gradient-to-r from-green-500 to-green-500 rounded-xl
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
          <IconGraduate className="w-5 h-5 text-green-400" />
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
              <Text variant="caption" className={entry.pnl >= 0 ? 'text-green-400' : 'text-rose-400'}>
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
            className="flex items-center gap-1 text-green-400 hover:text-green-300"
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
            <stop offset="0%" stopColor="#22C55E" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#22C55E" stopOpacity="0" />
          </linearGradient>
        </defs>
        <polyline
          fill="none"
          stroke="#22C55E"
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
