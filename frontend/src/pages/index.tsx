/**
 * Launchr - Pages
 * 
 * Launch into Orbit 🚀
 * Complete page views that combine templates with organisms.
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  MainLayout,
  LaunchDetailLayout,
  CreateLaunchLayout,
  LoadingLayout,
  ErrorLayout,
  ModalLayout,
  WalletInfo,
} from '../components/templates';
import {
  LaunchGrid,
  LaunchHeader,
  TradePanel,
  TransactionFeed,
  HoldersList,
  CreateLaunchForm,
  PriceChart,
} from '../components/organisms';
import {
  SearchBar,
  StatCard,
  GraduationProgress,
  SocialLinks,
  EmptyState,
  LaunchData,
  TradeData,
  UserPositionData,
} from '../components/molecules';
import {
  Text,
  Button,
  Card,
  Badge,
  Spinner,
  IconRocket,
  IconTrending,
  IconOrbit,
  IconGraduate,
  IconPlus,
  IconWallet,
  LaunchrLogo,
} from '../components/atoms';

// =============================================================================
// UTILITIES
// =============================================================================

/** Format volume from lamports to human-readable SOL with K/M/B suffix */
const formatVolume = (lamports: number): string => {
  const sol = lamports / 1_000_000_000;
  if (sol >= 1_000_000_000) return `${(sol / 1_000_000_000).toFixed(1)}B`;
  if (sol >= 1_000_000) return `${(sol / 1_000_000).toFixed(1)}M`;
  if (sol >= 1_000) return `${(sol / 1_000).toFixed(1)}K`;
  return sol.toFixed(1);
};

// =============================================================================
// TYPES
// =============================================================================

interface AppState {
  wallet: WalletInfo | undefined;
  launches: LaunchData[];
  trendingLaunches: LaunchData[];
  myLaunches: LaunchData[];
  loading: boolean;
  error: string | null;
}

// =============================================================================
// HERO SECTION
// =============================================================================

interface HeroSectionProps {
  onCreateLaunch: () => void;
  stats: {
    totalLaunches: number;
    totalGraduated: number;
    totalVolume: number;
  };
}

const HeroSection: React.FC<HeroSectionProps> = ({ onCreateLaunch, stats }) => {
  return (
    <div className="relative overflow-hidden">
      {/* Background Gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#22C55E]/10 via-transparent to-transparent" />
      
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
        <div className="text-center">
          {/* Logo */}
          <div className="flex justify-center mb-6">
            <LaunchrLogo size="lg" showText />
          </div>

          {/* Tagline */}
          <Text variant="h1" className="mb-4 !text-4xl sm:!text-5xl lg:!text-6xl">
            <span className="bg-gradient-to-r from-[#22C55E] to-[#a78bfa] bg-clip-text text-transparent">
              Launch into Orbit
            </span>
          </Text>
          
          <Text variant="body" color="muted" className="max-w-2xl mx-auto mb-8 !text-lg">
            Fair token launches with bonding curves that graduate into 
            <span className="text-[#22C55E] font-medium"> Orbit Finance DLMM </span>
            liquidity. No rugs. No dev dumps. Just pure, transparent launches.
          </Text>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-12">
            <Button
              variant="gradient"
              size="lg"
              onClick={onCreateLaunch}
              leftIcon={<IconRocket className="w-5 h-5" />}
            >
              Launch a Token
            </Button>
            <Button
              variant="secondary"
              size="lg"
              leftIcon={<IconOrbit className="w-5 h-5" />}
            >
              Explore Launches
            </Button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4 sm:gap-8 max-w-2xl mx-auto">
            <div className="text-center">
              <Text variant="h2" className="!text-[#22C55E] mb-1">
                {stats.totalLaunches.toLocaleString()}
              </Text>
              <Text variant="caption" color="muted">Total Launches</Text>
            </div>
            <div className="text-center">
              <Text variant="h2" className="!text-[#a78bfa] mb-1">
                {stats.totalGraduated.toLocaleString()}
              </Text>
              <Text variant="caption" color="muted">Graduated</Text>
            </div>
            <div className="text-center">
              <Text variant="h2" className="!text-white mb-1">
                {formatVolume(stats.totalVolume)}
              </Text>
              <Text variant="caption" color="muted">SOL Volume</Text>
            </div>
          </div>
        </div>
      </div>

      {/* Animated Orbit Ring */}
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 w-[200%] aspect-[2/1] pointer-events-none">
        <svg viewBox="0 0 1000 500" className="w-full h-full opacity-20">
          <ellipse
            cx="500"
            cy="500"
            rx="450"
            ry="150"
            fill="none"
            stroke="url(#orbitGradient)"
            strokeWidth="1"
            strokeDasharray="8 4"
            className="animate-spin-slow"
            style={{ transformOrigin: '500px 500px', animationDuration: '60s' }}
          />
          <defs>
            <linearGradient id="orbitGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#22C55E" />
              <stop offset="100%" stopColor="#a78bfa" />
            </linearGradient>
          </defs>
        </svg>
      </div>
    </div>
  );
};

// =============================================================================
// HOME PAGE
// =============================================================================

interface HomePageProps {
  wallet?: WalletInfo;
  isDark?: boolean;
  launches: LaunchData[];
  trendingLaunches: LaunchData[];
  loading?: boolean;
  stats: {
    totalLaunches: number;
    totalGraduated: number;
    totalVolume: number;
  };
  onConnect: () => void;
  onDisconnect: () => void;
  onToggleTheme?: () => void;
  onSearch: (query: string) => void;
  onTabChange: (tab: string) => void;
  onLaunchClick: (launch: LaunchData) => void;
  onCreateLaunch: () => void;
}

export const HomePage: React.FC<HomePageProps> = ({
  wallet,
  isDark = true,
  launches,
  trendingLaunches,
  loading = false,
  stats,
  onConnect,
  onDisconnect,
  onToggleTheme,
  onSearch,
  onTabChange,
  onLaunchClick,
  onCreateLaunch,
}) => {
  const [activeTab, setActiveTab] = useState('discover');
  const [filter, setFilter] = useState<'all' | 'active' | 'graduated'>('all');
  const [sortBy, setSortBy] = useState<'newest' | 'volume' | 'marketCap'>('newest');

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    onTabChange(tab);
  };

  const filteredLaunches = useMemo(() => {
    let result = [...launches];

    if (filter === 'active') {
      result = result.filter(l => l.status === 'Active' || l.status === 'PendingGraduation');
    } else if (filter === 'graduated') {
      result = result.filter(l => l.status === 'Graduated');
    }

    switch (sortBy) {
      case 'volume':
        result.sort((a, b) => b.realSolReserve - a.realSolReserve);
        break;
      case 'marketCap':
        result.sort((a, b) => b.marketCap - a.marketCap);
        break;
      case 'newest':
      default:
        result.sort((a, b) => b.createdAt - a.createdAt);
    }

    return result;
  }, [launches, filter, sortBy]);

  return (
    <MainLayout
      wallet={wallet}
      isDark={isDark}
      activeTab={activeTab}
      onConnect={onConnect}
      onDisconnect={onDisconnect}
      onToggleTheme={onToggleTheme}
      onTabChange={handleTabChange}
      onSearch={onSearch}
    >
      {/* Hero */}
      <HeroSection onCreateLaunch={onCreateLaunch} stats={stats} />

      {/* Trending Section */}
      {trendingLaunches.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <IconTrending className="w-6 h-6 text-[#22C55E]" />
              <Text variant="h3">Trending</Text>
            </div>
            <Button variant="ghost" size="sm" onClick={() => handleTabChange('trending')}>
              View All →
            </Button>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {trendingLaunches.slice(0, 3).map((launch) => (
              <Card
                key={launch.publicKey}
                hover
                className="cursor-pointer"
                onClick={() => onLaunchClick(launch)}
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#22C55E] to-[#a78bfa] flex items-center justify-center">
                    <Text variant="body" className="!font-bold">
                      {launch.symbol.slice(0, 2)}
                    </Text>
                  </div>
                  <div className="flex-1 min-w-0">
                    <Text variant="body" className="!font-semibold truncate">
                      {launch.name}
                    </Text>
                    <Text variant="caption" color="muted">${launch.symbol}</Text>
                  </div>
                  <Badge variant={launch.status === 'Active' ? 'success' : 'accent'}>
                    {launch.status}
                  </Badge>
                </div>
                
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <Text variant="caption" color="muted">Price</Text>
                    <Text variant="body" className="!font-medium">
                      {launch.currentPrice.toFixed(9)} SOL
                    </Text>
                  </div>
                  <div>
                    <Text variant="caption" color="muted">Market Cap</Text>
                    <Text variant="body" className="!font-medium">
                      {(launch.marketCap / 1e9).toFixed(2)} SOL
                    </Text>
                  </div>
                </div>

                <GraduationProgress
                  current={launch.realSolReserve}
                  target={launch.graduationThreshold}
                  size="sm"
                />
              </Card>
            ))}
          </div>
        </section>
      )}

      {/* All Launches */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          <Text variant="h3">All Launches</Text>
          
          <div className="flex flex-wrap items-center gap-3">
            {/* Filter */}
            <div className="flex rounded-lg bg-white/5 p-1">
              {(['all', 'active', 'graduated'] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`
                    px-3 py-1.5 rounded-md text-sm font-medium transition-colors
                    ${filter === f 
                      ? 'bg-[#22C55E] text-[#111827]' 
                      : 'text-white/60 hover:text-white'}
                  `}
                >
                  {f.charAt(0).toUpperCase() + f.slice(1)}
                </button>
              ))}
            </div>

            {/* Sort */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white
                         focus:outline-none focus:border-[#22C55E]/50"
            >
              <option value="newest">Newest</option>
              <option value="volume">Volume</option>
              <option value="marketCap">Market Cap</option>
            </select>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Spinner size="lg" />
          </div>
        ) : filteredLaunches.length > 0 ? (
          <LaunchGrid
            launches={filteredLaunches}
            onLaunchClick={onLaunchClick}
          />
        ) : (
          <EmptyState
            icon={<IconRocket className="w-12 h-12" />}
            title="No launches found"
            description="Be the first to launch a token!"
            action={
              <Button variant="primary" onClick={onCreateLaunch}>
                Create Launch
              </Button>
            }
          />
        )}
      </section>
    </MainLayout>
  );
};

// =============================================================================
// LAUNCH DETAIL PAGE
// =============================================================================

interface LaunchDetailPageProps {
  launch: LaunchData;
  userPosition?: UserPositionData;
  trades: TradeData[];
  holders: Array<{ address: string; balance: number; percentage: number }>;
  priceHistory: Array<{ timestamp: number; price: number }>;
  wallet?: WalletInfo;
  isDark?: boolean;
  loading?: boolean;
  onConnect: () => void;
  onDisconnect: () => void;
  onToggleTheme?: () => void;
  onBack: () => void;
  onTrade: (type: 'buy' | 'sell', amount: number, slippage: number) => Promise<void>;
}

export const LaunchDetailPage: React.FC<LaunchDetailPageProps> = ({
  launch,
  userPosition,
  trades,
  holders,
  priceHistory,
  wallet,
  isDark = true,
  loading = false,
  onConnect,
  onDisconnect,
  onToggleTheme,
  onBack,
  onTrade,
}) => {
  const [activeTab, setActiveTab] = useState<'chart' | 'trades' | 'holders'>('chart');

  if (loading) {
    return <LoadingLayout message="Loading launch details..." />;
  }

  return (
    <LaunchDetailLayout
      wallet={wallet}
      isDark={isDark}
      onConnect={onConnect}
      onDisconnect={onDisconnect}
      onToggleTheme={onToggleTheme}
      onBack={onBack}
      sidebar={
        <div className="space-y-6">
          {/* Trade Panel */}
          <TradePanel
            launch={launch}
            userPosition={userPosition}
            walletBalance={wallet?.balance}
            onTrade={onTrade}
            disabled={!wallet?.connected || launch.status === 'Graduated'}
          />

          {/* Position Summary */}
          {userPosition && userPosition.tokenBalance > 0 && (
            <Card>
              <Text variant="label" className="mb-4 block">Your Position</Text>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <Text variant="caption" color="muted">Balance</Text>
                  <Text variant="body">{userPosition.tokenBalance.toLocaleString()} {launch.symbol}</Text>
                </div>
                <div className="flex justify-between">
                  <Text variant="caption" color="muted">Avg. Buy Price</Text>
                  <Text variant="body">{userPosition.avgBuyPrice.toFixed(9)} SOL</Text>
                </div>
                <div className="flex justify-between">
                  <Text variant="caption" color="muted">Cost Basis</Text>
                  <Text variant="body">{userPosition.costBasis.toFixed(4)} SOL</Text>
                </div>
                <div className="border-t border-white/10 pt-3 flex justify-between">
                  <Text variant="caption" color="muted">Unrealized P&L</Text>
                  <Text 
                    variant="body" 
                    color={userPosition.unrealizedPnl >= 0 ? 'success' : 'error'}
                    className="!font-semibold"
                  >
                    {userPosition.unrealizedPnl >= 0 ? '+' : ''}{userPosition.unrealizedPnl.toFixed(4)} SOL
                    <span className="text-xs ml-1">
                      ({userPosition.roiPercent >= 0 ? '+' : ''}{userPosition.roiPercent.toFixed(1)}%)
                    </span>
                  </Text>
                </div>
              </div>
            </Card>
          )}

          {/* Social Links */}
          <Card>
            <Text variant="label" className="mb-4 block">Links</Text>
            <SocialLinks
              twitter={launch.twitter}
              telegram={launch.telegram}
              website={launch.website}
              className="flex-col"
            />
          </Card>
        </div>
      }
    >
      {/* Launch Header */}
      <LaunchHeader launch={launch} />

      {/* Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6">
        <StatCard
          label="Price"
          value={`${launch.currentPrice.toFixed(9)} SOL`}
          icon={<IconTrending className="w-4 h-4" />}
        />
        <StatCard
          label="Market Cap"
          value={`${(launch.marketCap / 1e9).toFixed(2)} SOL`}
        />
        <StatCard
          label="Holders"
          value={launch.holderCount.toLocaleString()}
        />
        <StatCard
          label="Trades"
          value={launch.tradeCount.toLocaleString()}
        />
      </div>

      {/* Graduation Progress */}
      <Card className="mt-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <IconGraduate className="w-5 h-5 text-[#22C55E]" />
            <Text variant="label">Graduation Progress</Text>
          </div>
          {launch.status === 'Graduated' && (
            <Badge variant="success">Graduated to Orbit</Badge>
          )}
        </div>
        <GraduationProgress
          current={launch.realSolReserve}
          target={launch.graduationThreshold}
          showLabel
        />
        {launch.status !== 'Graduated' && (
          <Text variant="caption" color="muted" className="mt-3 block">
            {((launch.graduationThreshold - launch.realSolReserve) / 1e9).toFixed(2)} SOL remaining 
            to graduate to Orbit Finance DLMM
          </Text>
        )}
      </Card>

      {/* Tabs */}
      <div className="mt-8">
        <div className="flex border-b border-white/10">
          {(['chart', 'trades', 'holders'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`
                px-4 py-3 text-sm font-medium transition-colors relative
                ${activeTab === tab ? 'text-[#22C55E]' : 'text-white/60 hover:text-white'}
              `}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
              {activeTab === tab && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#22C55E]" />
              )}
            </button>
          ))}
        </div>

        <div className="mt-6">
          {activeTab === 'chart' && (
            <Card>
              <PriceChart data={priceHistory} />
            </Card>
          )}
          
          {activeTab === 'trades' && (
            <TransactionFeed
              transactions={trades}
              launch={launch}
            />
          )}
          
          {activeTab === 'holders' && (
            <HoldersList
              holders={holders}
              tokenSymbol={launch.symbol}
            />
          )}
        </div>
      </div>
    </LaunchDetailLayout>
  );
};

// =============================================================================
// CREATE LAUNCH PAGE
// =============================================================================

interface CreateLaunchPageProps {
  wallet?: WalletInfo;
  isDark?: boolean;
  onConnect: () => void;
  onDisconnect: () => void;
  onToggleTheme?: () => void;
  onBack: () => void;
  onSubmit: (data: any) => Promise<void>;
}

export const CreateLaunchPage: React.FC<CreateLaunchPageProps> = ({
  wallet,
  isDark = true,
  onConnect,
  onDisconnect,
  onToggleTheme,
  onBack,
  onSubmit,
}) => {
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState({
    name: '',
    symbol: '',
    description: '',
    imageUrl: '',
    twitter: '',
    telegram: '',
    website: '',
    creatorFeeBps: 100, // 1%
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleNext = () => {
    setCurrentStep((prev) => Math.min(prev + 1, 4));
  };

  const handleBack = () => {
    if (currentStep === 1) {
      onBack();
    } else {
      setCurrentStep((prev) => prev - 1);
    }
  };

  const handleSubmit = async () => {
    if (!wallet?.connected) {
      setError('Please connect your wallet');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await onSubmit(formData);
      setCurrentStep(4);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create launch');
    } finally {
      setLoading(false);
    }
  };

  return (
    <CreateLaunchLayout
      currentStep={currentStep}
      totalSteps={4}
      wallet={wallet}
      isDark={isDark}
      onConnect={onConnect}
      onDisconnect={onDisconnect}
      onToggleTheme={onToggleTheme}
      onBack={handleBack}
    >
      <CreateLaunchForm
        step={currentStep}
        formData={formData}
        onFormChange={setFormData}
        onNext={handleNext}
        onBack={handleBack}
        onSubmit={handleSubmit}
        loading={loading}
        error={error}
        walletConnected={wallet?.connected || false}
      />
    </CreateLaunchLayout>
  );
};

// =============================================================================
// MY LAUNCHES PAGE
// =============================================================================

interface MyLaunchesPageProps {
  wallet?: WalletInfo;
  isDark?: boolean;
  myLaunches: LaunchData[];
  myPositions: Map<string, UserPositionData>;
  loading?: boolean;
  onConnect: () => void;
  onDisconnect: () => void;
  onToggleTheme?: () => void;
  onTabChange: (tab: string) => void;
  onLaunchClick: (launch: LaunchData) => void;
  onCreateLaunch: () => void;
}

export const MyLaunchesPage: React.FC<MyLaunchesPageProps> = ({
  wallet,
  isDark = true,
  myLaunches,
  myPositions,
  loading = false,
  onConnect,
  onDisconnect,
  onToggleTheme,
  onTabChange,
  onLaunchClick,
  onCreateLaunch,
}) => {
  const [view, setView] = useState<'created' | 'positions'>('created');

  const createdLaunches = useMemo(() => {
    if (!wallet?.address) return [];
    return myLaunches.filter(l => l.creator === wallet.address);
  }, [myLaunches, wallet?.address]);

  const positionLaunches = useMemo(() => {
    return myLaunches.filter(l => myPositions.has(l.publicKey));
  }, [myLaunches, myPositions]);

  return (
    <MainLayout
      wallet={wallet}
      isDark={isDark}
      activeTab="launched"
      onConnect={onConnect}
      onDisconnect={onDisconnect}
      onToggleTheme={onToggleTheme}
      onTabChange={onTabChange}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {!wallet?.connected ? (
          <EmptyState
            icon={<IconWallet className="w-12 h-12" />}
            title="Connect your wallet"
            description="Connect your wallet to view your launches and positions"
            action={
              <Button variant="primary" onClick={onConnect}>
                Connect Wallet
              </Button>
            }
          />
        ) : (
          <>
            {/* Header */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
              <Text variant="h2">My Launches</Text>
              <Button
                variant="gradient"
                onClick={onCreateLaunch}
                leftIcon={<IconPlus className="w-4 h-4" />}
              >
                Create New Launch
              </Button>
            </div>

            {/* View Toggle */}
            <div className="flex rounded-lg bg-white/5 p-1 w-fit mb-8">
              <button
                onClick={() => setView('created')}
                className={`
                  px-4 py-2 rounded-md text-sm font-medium transition-colors
                  ${view === 'created' 
                    ? 'bg-[#22C55E] text-[#111827]' 
                    : 'text-white/60 hover:text-white'}
                `}
              >
                Created ({createdLaunches.length})
              </button>
              <button
                onClick={() => setView('positions')}
                className={`
                  px-4 py-2 rounded-md text-sm font-medium transition-colors
                  ${view === 'positions' 
                    ? 'bg-[#22C55E] text-[#111827]' 
                    : 'text-white/60 hover:text-white'}
                `}
              >
                Positions ({positionLaunches.length})
              </button>
            </div>

            {loading ? (
              <div className="flex justify-center py-12">
                <Spinner size="lg" />
              </div>
            ) : view === 'created' ? (
              createdLaunches.length > 0 ? (
                <LaunchGrid
                  launches={createdLaunches}
                  onLaunchClick={onLaunchClick}
                />
              ) : (
                <EmptyState
                  icon={<IconRocket className="w-12 h-12" />}
                  title="No launches yet"
                  description="You haven't created any token launches yet"
                  action={
                    <Button variant="primary" onClick={onCreateLaunch}>
                      Create Your First Launch
                    </Button>
                  }
                />
              )
            ) : (
              positionLaunches.length > 0 ? (
                <div className="space-y-4">
                  {positionLaunches.map((launch) => {
                    const position = myPositions.get(launch.publicKey);
                    return (
                      <Card
                        key={launch.publicKey}
                        hover
                        className="cursor-pointer"
                        onClick={() => onLaunchClick(launch)}
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#22C55E] to-[#a78bfa] flex items-center justify-center">
                            <Text variant="body" className="!font-bold">
                              {launch.symbol.slice(0, 2)}
                            </Text>
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <Text variant="body" className="!font-semibold">
                                {launch.name}
                              </Text>
                              <Badge size="sm">${launch.symbol}</Badge>
                            </div>
                            {position && (
                              <Text variant="caption" color="muted">
                                {position.tokenBalance.toLocaleString()} tokens
                              </Text>
                            )}
                          </div>
                          {position && (
                            <div className="text-right">
                              <Text 
                                variant="body"
                                color={position.unrealizedPnl >= 0 ? 'success' : 'error'}
                                className="!font-semibold"
                              >
                                {position.unrealizedPnl >= 0 ? '+' : ''}
                                {position.unrealizedPnl.toFixed(4)} SOL
                              </Text>
                              <Text variant="caption" color="muted">
                                {position.roiPercent >= 0 ? '+' : ''}
                                {position.roiPercent.toFixed(1)}% P&L
                              </Text>
                            </div>
                          )}
                        </div>
                      </Card>
                    );
                  })}
                </div>
              ) : (
                <EmptyState
                  icon={<IconWallet className="w-12 h-12" />}
                  title="No positions"
                  description="You don't have any token positions yet"
                  action={
                    <Button variant="secondary" onClick={() => onTabChange('discover')}>
                      Explore Launches
                    </Button>
                  }
                />
              )
            )}
          </>
        )}
      </div>
    </MainLayout>
  );
};

// =============================================================================
// EXPORTS
// =============================================================================

export { HeroSection };
export type {
  HomePageProps,
  LaunchDetailPageProps,
  CreateLaunchPageProps,
  MyLaunchesPageProps,
};
