/**
 * Launchr - Templates
 * 
 * Launch into Orbit 🚀
 * Page layout templates that structure the overall page composition.
 */

import React, { ReactNode, useState, useCallback } from 'react';
import {
  Button,
  Text,
  Spinner,
  IconWallet,
  IconRocket,
  IconTrending,
  IconSearch,
  IconPlus,
  IconSun,
  IconMoon,
  IconTwitter,
  IconTelegram,
  LaunchrLogo,
} from '../atoms';
import { SearchBar, NavigationTabs, TabItem } from '../molecules';

// =============================================================================
// TYPES
// =============================================================================

interface WalletInfo {
  address: string;
  balance: number;
  connected: boolean;
}

// =============================================================================
// HEADER
// =============================================================================

interface HeaderProps {
  wallet?: WalletInfo;
  isDark?: boolean;
  onConnect: () => void;
  onDisconnect: () => void;
  onToggleTheme?: () => void;
  onSearch?: (query: string) => void;
  className?: string;
}

export const Header: React.FC<HeaderProps> = ({
  wallet,
  isDark = true,
  onConnect,
  onDisconnect,
  onToggleTheme,
  onSearch,
  className = '',
}) => {
  const formatAddress = (address: string) => {
    return `${address.slice(0, 4)}...${address.slice(-4)}`;
  };

  return (
    <header
      className={`sticky top-0 z-50 border-b ${className}`}
      style={{
        backdropFilter: 'blur(40px) saturate(1.8)',
        WebkitBackdropFilter: 'blur(40px) saturate(1.8)',
        background: isDark ? 'rgba(5, 5, 8, 0.6)' : 'rgba(238, 240, 244, 0.6)',
        borderColor: 'var(--glass-border)',
      }}
    >
      <div className="max-w-[1400px] mx-auto px-6 h-14 flex items-center justify-between">
        {/* Logo */}
        <div
          className="flex items-center gap-2.5 cursor-pointer"
          onClick={() => window.location.href = '/'}
        >
          <div
            className="w-8 h-8 rounded-[10px] flex items-center justify-center"
            style={{
              background: 'linear-gradient(135deg, #34d399, #059669)',
              boxShadow: '0 4px 20px rgba(52, 211, 153, 0.3)',
            }}
          >
            <LaunchrLogo size="sm" showText={false} />
          </div>
          <span
            className="text-[17px] font-semibold tracking-tight"
            style={{ color: 'var(--t1)', letterSpacing: '-0.3px' }}
          >
            Launchr
          </span>
        </div>

        {/* Right Side Actions */}
        <div className="flex items-center gap-1.5">
          {/* Social Links */}
          <button
            className="glass-pill w-[34px] h-[34px] flex items-center justify-center"
            style={{
              background: 'var(--sb)',
              border: '1px solid var(--sbd)',
              color: 'var(--st)',
            }}
          >
            <IconTelegram />
          </button>
          <button
            className="glass-pill w-[34px] h-[34px] flex items-center justify-center"
            style={{
              background: 'var(--sb)',
              border: '1px solid var(--sbd)',
              color: 'var(--st)',
            }}
          >
            <IconTwitter />
          </button>

          {/* Theme Toggle */}
          {onToggleTheme && (
            <button
              onClick={onToggleTheme}
              className="glass-pill w-[34px] h-[34px] flex items-center justify-center"
              style={{
                background: 'var(--sb)',
                border: '1px solid var(--sbd)',
                color: 'var(--st)',
              }}
            >
              {isDark ? <IconSun className="w-4 h-4" /> : <IconMoon className="w-4 h-4" />}
            </button>
          )}

          {/* Wallet Connect */}
          <button
            onClick={wallet?.connected ? onDisconnect : onConnect}
            className="h-[34px] px-[18px] text-[13px] font-medium rounded-full"
            style={{
              background: 'var(--pb)',
              color: 'var(--pt)',
            }}
          >
            {wallet?.connected ? formatAddress(wallet.address) : 'Connect'}
          </button>
        </div>
      </div>
    </header>
  );
};

// =============================================================================
// NAVIGATION
// =============================================================================

interface NavigationProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  className?: string;
}

export const Navigation: React.FC<NavigationProps> = ({
  activeTab,
  onTabChange,
  className = '',
}) => {
  const tabs: TabItem[] = [
    { id: 'discover', label: 'Discover', icon: <IconSearch className="w-4 h-4" /> },
    { id: 'trending', label: 'Trending', icon: <IconTrending className="w-4 h-4" /> },
    { id: 'launched', label: 'My Launches', icon: <IconRocket className="w-4 h-4" /> },
    { id: 'create', label: 'Create', icon: <IconPlus className="w-4 h-4" /> },
  ];

  return (
    <nav className={`
      bg-[#0a0a14]/50 backdrop-blur-sm
      border-b border-white/5
      ${className}
    `}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <NavigationTabs
          tabs={tabs}
          activeTab={activeTab}
          onChange={onTabChange}
        />
      </div>
    </nav>
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
    <footer
      className={`py-[18px] px-6 relative z-[1] ${className}`}
      style={{ borderTop: '1px solid var(--glass-border)' }}
    >
      <div className="max-w-[1400px] mx-auto flex justify-between items-center">
        <span
          className="text-xs font-medium"
          style={{ color: 'var(--t3)' }}
        >
          Launchr.app
        </span>
        <div className="flex gap-4 text-xs" style={{ color: 'var(--t3)' }}>
          <a href="#" className="hover:opacity-80 transition-opacity">Docs</a>
          <a href="#" className="hover:opacity-80 transition-opacity">Legal</a>
        </div>
      </div>
    </footer>
  );
};

// =============================================================================
// ANIMATED ORBS BACKGROUND
// =============================================================================

interface OrbsProps {
  isDark?: boolean;
}

const Orbs: React.FC<OrbsProps> = ({ isDark = true }) => {
  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
      <div
        className="absolute animate-orb1"
        style={{
          top: '10%',
          left: '15%',
          width: 500,
          height: 500,
          borderRadius: '50%',
          background: isDark
            ? 'radial-gradient(circle, rgba(52, 211, 153, 0.08) 0%, transparent 70%)'
            : 'radial-gradient(circle, rgba(52, 211, 153, 0.15) 0%, transparent 70%)',
          filter: 'blur(60px)',
        }}
      />
      <div
        className="absolute animate-orb2"
        style={{
          top: '50%',
          right: '10%',
          width: 450,
          height: 450,
          borderRadius: '50%',
          background: isDark
            ? 'radial-gradient(circle, rgba(99, 102, 241, 0.06) 0%, transparent 70%)'
            : 'radial-gradient(circle, rgba(99, 102, 241, 0.1) 0%, transparent 70%)',
          filter: 'blur(60px)',
        }}
      />
      <div
        className="absolute animate-orb3"
        style={{
          bottom: '10%',
          left: '40%',
          width: 400,
          height: 400,
          borderRadius: '50%',
          background: isDark
            ? 'radial-gradient(circle, rgba(236, 72, 153, 0.05) 0%, transparent 70%)'
            : 'radial-gradient(circle, rgba(236, 72, 153, 0.08) 0%, transparent 70%)',
          filter: 'blur(60px)',
        }}
      />
    </div>
  );
};

// =============================================================================
// MAIN LAYOUT
// =============================================================================

interface MainLayoutProps {
  children: ReactNode;
  wallet?: WalletInfo;
  isDark?: boolean;
  activeTab?: string;
  onConnect: () => void;
  onDisconnect: () => void;
  onToggleTheme?: () => void;
  onTabChange?: (tab: string) => void;
  onSearch?: (query: string) => void;
  showNavigation?: boolean;
  className?: string;
}

export const MainLayout: React.FC<MainLayoutProps> = ({
  children,
  wallet,
  isDark = true,
  activeTab = 'discover',
  onConnect,
  onDisconnect,
  onToggleTheme,
  onTabChange,
  onSearch,
  showNavigation = true,
  className = '',
}) => {
  return (
    <div
      className={`min-h-screen flex flex-col relative overflow-hidden ${className}`}
      style={{
        background: 'var(--bg)',
        color: 'var(--t1)',
        transition: 'background 0.3s ease, color 0.3s ease',
      }}
    >
      {/* Animated Orbs Background */}
      <Orbs isDark={isDark} />

      {/* Header */}
      <Header
        wallet={wallet}
        isDark={isDark}
        onConnect={onConnect}
        onDisconnect={onDisconnect}
        onToggleTheme={onToggleTheme}
        onSearch={onSearch}
      />

      {/* Navigation */}
      {showNavigation && onTabChange && (
        <Navigation
          activeTab={activeTab}
          onTabChange={onTabChange}
        />
      )}

      {/* Main Content */}
      <main className="flex-1 relative z-10">
        {children}
      </main>

      {/* Footer */}
      <Footer />
    </div>
  );
};

// =============================================================================
// LAUNCH DETAIL LAYOUT
// =============================================================================

interface LaunchDetailLayoutProps {
  children: ReactNode;
  sidebar: ReactNode;
  wallet?: WalletInfo;
  isDark?: boolean;
  onConnect: () => void;
  onDisconnect: () => void;
  onToggleTheme?: () => void;
  onBack?: () => void;
  className?: string;
}

export const LaunchDetailLayout: React.FC<LaunchDetailLayoutProps> = ({
  children,
  sidebar,
  wallet,
  isDark = true,
  onConnect,
  onDisconnect,
  onToggleTheme,
  onBack,
  className = '',
}) => {
  return (
    <div
      className={`min-h-screen flex flex-col relative overflow-hidden ${className}`}
      style={{
        background: 'var(--bg)',
        color: 'var(--t1)',
        transition: 'background 0.3s ease, color 0.3s ease',
      }}
    >
      {/* Animated Orbs Background */}
      <Orbs isDark={isDark} />

      {/* Header */}
      <Header
        wallet={wallet}
        isDark={isDark}
        onConnect={onConnect}
        onDisconnect={onDisconnect}
        onToggleTheme={onToggleTheme}
      />

      {/* Back Button */}
      {onBack && (
        <div
          className="backdrop-blur-sm"
          style={{
            background: isDark ? 'rgba(5, 5, 8, 0.5)' : 'rgba(238, 240, 244, 0.5)',
            borderBottom: '1px solid var(--glass-border)',
          }}
        >
          <div className="max-w-[1400px] mx-auto px-6 py-3">
            <button
              onClick={onBack}
              className="flex items-center gap-2 text-sm font-medium transition-colors"
              style={{ color: 'var(--t2)' }}
            >
              ← Back to Launches
            </button>
          </div>
        </div>
      )}

      {/* Main Content with Sidebar */}
      <main className="flex-1 relative z-10">
        <div className="max-w-[1400px] mx-auto px-6 py-9">
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6 items-start">
            {/* Main Content */}
            <div className="flex flex-col gap-6">
              {children}
            </div>

            {/* Sidebar */}
            <div className="lg:sticky lg:top-[72px]">
              {sidebar}
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <Footer />
    </div>
  );
};

// =============================================================================
// CREATE LAUNCH LAYOUT
// =============================================================================

interface CreateLaunchLayoutProps {
  children: ReactNode;
  currentStep: number;
  totalSteps: number;
  wallet?: WalletInfo;
  isDark?: boolean;
  onConnect: () => void;
  onDisconnect: () => void;
  onToggleTheme?: () => void;
  onBack?: () => void;
  className?: string;
}

export const CreateLaunchLayout: React.FC<CreateLaunchLayoutProps> = ({
  children,
  currentStep,
  totalSteps,
  wallet,
  isDark = true,
  onConnect,
  onDisconnect,
  onToggleTheme,
  onBack,
  className = '',
}) => {
  return (
    <div
      className={`min-h-screen flex flex-col relative overflow-hidden ${className}`}
      style={{
        background: 'var(--bg)',
        color: 'var(--t1)',
        transition: 'background 0.3s ease, color 0.3s ease',
      }}
    >
      {/* Animated Orbs Background */}
      <Orbs isDark={isDark} />

      {/* Header */}
      <Header
        wallet={wallet}
        isDark={isDark}
        onConnect={onConnect}
        onDisconnect={onDisconnect}
        onToggleTheme={onToggleTheme}
      />

      {/* Back Button */}
      {onBack && (
        <div
          className="backdrop-blur-sm"
          style={{
            background: isDark ? 'rgba(5, 5, 8, 0.5)' : 'rgba(238, 240, 244, 0.5)',
            borderBottom: '1px solid var(--glass-border)',
          }}
        >
          <div className="max-w-[520px] mx-auto px-6 py-3">
            <button
              onClick={onBack}
              className="flex items-center gap-2 text-sm font-medium transition-colors"
              style={{ color: 'var(--t2)' }}
            >
              ← Back
            </button>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 relative z-10">
        <div className="max-w-[520px] mx-auto px-6 py-9">
          {children}
        </div>
      </main>

      {/* Footer */}
      <Footer />
    </div>
  );
};

// =============================================================================
// LOADING LAYOUT
// =============================================================================

interface LoadingLayoutProps {
  message?: string;
  className?: string;
}

export const LoadingLayout: React.FC<LoadingLayoutProps> = ({
  message = 'Loading...',
  className = '',
}) => {
  return (
    <div className={`
      min-h-screen bg-[#0a0a14]
      flex flex-col items-center justify-center
      ${className}
    `}>
      {/* Background Effects */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 
                        w-[50%] h-[50%] bg-[#5eead4]/10 rounded-full blur-[150px] animate-pulse" />
      </div>

      <div className="relative z-10 flex flex-col items-center gap-6">
        <div className="animate-bounce">
          <LaunchrLogo size="lg" />
        </div>
        <Spinner size="lg" />
        <Text variant="body" color="muted">{message}</Text>
      </div>
    </div>
  );
};

// =============================================================================
// ERROR LAYOUT
// =============================================================================

interface ErrorLayoutProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  onHome?: () => void;
  className?: string;
}

export const ErrorLayout: React.FC<ErrorLayoutProps> = ({
  title = 'Something went wrong',
  message = 'An unexpected error occurred. Please try again.',
  onRetry,
  onHome,
  className = '',
}) => {
  return (
    <div className={`
      min-h-screen bg-[#0a0a14]
      flex flex-col items-center justify-center p-4
      ${className}
    `}>
      {/* Background */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 
                        w-[50%] h-[50%] bg-red-500/5 rounded-full blur-[150px]" />
      </div>

      <div className="relative z-10 flex flex-col items-center gap-6 text-center max-w-md">
        <div className="w-20 h-20 rounded-full bg-red-500/10 flex items-center justify-center">
          <Text variant="h1">😵</Text>
        </div>
        <div>
          <Text variant="h2" className="mb-2">{title}</Text>
          <Text variant="body" color="muted">{message}</Text>
        </div>
        <div className="flex gap-3">
          {onRetry && (
            <Button variant="primary" onClick={onRetry}>
              Try Again
            </Button>
          )}
          {onHome && (
            <Button variant="secondary" onClick={onHome}>
              Go Home
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

// =============================================================================
// MODAL LAYOUT
// =============================================================================

interface ModalLayoutProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

export const ModalLayout: React.FC<ModalLayoutProps> = ({
  isOpen,
  onClose,
  title,
  children,
  size = 'md',
  className = '',
}) => {
  if (!isOpen) return null;

  const sizeClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className={`
        relative z-10 w-full ${sizeClasses[size]}
        bg-[#12121f] border border-white/10 rounded-2xl
        shadow-2xl shadow-black/50
        ${className}
      `}>
        {/* Header */}
        {title && (
          <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between">
            <Text variant="h4">{title}</Text>
            <button
              onClick={onClose}
              className="text-white/40 hover:text-white transition-colors p-1"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}

        {/* Content */}
        <div className="p-6">
          {children}
        </div>
      </div>
    </div>
  );
};

// =============================================================================
// EXPORTS
// =============================================================================

export { Orbs };

export type {
  WalletInfo,
  OrbsProps,
  HeaderProps,
  NavigationProps,
  FooterProps,
  MainLayoutProps,
  LaunchDetailLayoutProps,
  CreateLaunchLayoutProps,
  LoadingLayoutProps,
  ErrorLayoutProps,
  ModalLayoutProps,
};
