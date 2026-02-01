"use client";

import React, { useState } from "react";

// ============================================================================
// LAUNCHR DESIGN SYSTEM - ATOMS
// Launch into Orbit 🚀
// ============================================================================

// Design tokens - Launchr Brand Kit
export const colors = {
  // Brand colors
  primary: "#22C55E",      // Launchr Green (green-500)
  secondary: "#34D399",    // Launch Mint (green-400)
  accent: "#16A34A",       // Deep Green (green-600)

  // Background (uses CSS variables for theme support)
  bgDeep: "var(--bg)",
  bgCard: "var(--glass)",
  bgHover: "var(--glass2)",

  // Text (uses CSS variables for theme support)
  textPrimary: "var(--t1)",
  textSecondary: "var(--t2)",
  textMuted: "var(--t3)",

  // Status
  success: "var(--grn)",
  warning: "var(--amb)",
  error: "var(--red)",
  info: "#3b82f6",
};

// Gradient colors for avatars
export const AVATAR_GRADIENTS = [
  ["#f97316", "#ea580c"],
  ["#8b5cf6", "#7c3aed"],
  ["#06b6d4", "#0891b2"],
  ["#ec4899", "#db2777"],
  ["#22C55E", "#16A34A"],
  ["#f59e0b", "#d97706"],
  ["#6366f1", "#4f46e5"],
  ["#ef4444", "#dc2626"],
  ["#34D399", "#16A34A"],
  ["#a855f7", "#9333ea"],
];

// SVG icon functions for avatars (replacing emojis for institutional-grade UI)
export const AVATAR_ICONS: Array<(size: number) => React.ReactNode> = [
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
  // Shield
  (s: number) => <svg width={s} height={s} viewBox="0 0 24 24" fill="white" opacity={0.9}><path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 6c1.1 0 2 .9 2 2s-.9 2-2 2-2-.9-2-2 .9-2 2-2zm4 9H8v-1c0-1.33 2.67-2 4-2s4 .67 4 2v1z"/></svg>,
  // Cube
  (s: number) => <svg width={s} height={s} viewBox="0 0 24 24" fill="white" opacity={0.9}><path d="M21 16.5c0 .38-.21.71-.53.88l-7.9 4.44c-.36.2-.8.2-1.14 0l-7.9-4.44A.99.99 0 0 1 3 16.5v-9c0-.38.21-.71.53-.88l7.9-4.44c.36-.2.8-.2 1.14 0l7.9 4.44c.32.17.53.5.53.88v9zM12 4.15L5 8.09v7.82l7 3.94 7-3.94V8.09l-7-3.94z"/></svg>,
  // Fire
  (s: number) => <svg width={s} height={s} viewBox="0 0 24 24" fill="white" opacity={0.9}><path d="M12 23c-4.97 0-9-4.03-9-9 0-4.14 2.77-6.41 4.5-8.5.72-.87 1.05-1.5 1.05-1.5s.14.47.5 1.5c.36 1.03 1.5 2.5 1.5 2.5s2-2.5 2-5C12.55 2 11 1 11 1s3-1 6 3c2 2.67 2 6.5 2 6.5s0 3.5-1.5 5.5C16 18 12 23 12 23z"/></svg>,
  // Bolt
  (s: number) => <svg width={s} height={s} viewBox="0 0 24 24" fill="white" opacity={0.9}><path d="M11 21h-1l1-7H7.5c-.58 0-.57-.32-.38-.66.19-.34.05-.08.07-.12C8.48 10.94 10.42 7.54 13 3h1l-1 7h3.5c.49 0 .56.33.47.51l-.07.15C12.96 17.55 11 21 11 21z"/></svg>,
];

// ============================================================================
// BUTTON
// ============================================================================

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger" | "gradient";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  fullWidth?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = "primary",
  size = "md",
  loading = false,
  leftIcon,
  rightIcon,
  fullWidth = false,
  className = "",
  disabled,
  ...props
}) => {
  const baseStyles = `
    inline-flex items-center justify-center font-medium
    transition-all duration-200 rounded-xl
    focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[#111827]
    disabled:opacity-50 disabled:cursor-not-allowed
  `;

  const variants = {
    primary: `
      bg-gradient-to-r from-green-400 to-green-600 text-gray-900
      hover:from-green-300 hover:to-green-500
      focus:ring-green-400 shadow-lg shadow-green-500/25
    `,
    secondary: `
      bg-white/10 text-white border border-white/20
      hover:bg-white/20 hover:border-white/30
      focus:ring-white/50
    `,
    ghost: `
      bg-transparent text-gray-300
      hover:bg-white/10 hover:text-white
      focus:ring-white/30
    `,
    danger: `
      bg-red-500/20 text-red-400 border border-red-500/30
      hover:bg-red-500/30 hover:border-red-500/50
      focus:ring-red-400
    `,
    gradient: `
      bg-gradient-to-r from-purple-500 via-green-400 to-green-600 text-white
      hover:opacity-90 shadow-lg shadow-purple-500/25
      focus:ring-purple-400
    `,
  };

  const sizes = {
    sm: "px-3 py-1.5 text-sm gap-1.5",
    md: "px-4 py-2.5 text-sm gap-2",
    lg: "px-6 py-3 text-base gap-2.5",
  };

  return (
    <button
      className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${fullWidth ? 'w-full' : ''} ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <Spinner size="sm" />
      ) : (
        <>
          {leftIcon && <span className="flex-shrink-0">{leftIcon}</span>}
          {children}
          {rightIcon && <span className="flex-shrink-0">{rightIcon}</span>}
        </>
      )}
    </button>
  );
};

// ============================================================================
// INPUT
// ============================================================================

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Input: React.FC<InputProps> = ({
  label,
  error,
  hint,
  leftIcon,
  rightIcon,
  className = "",
  ...props
}) => {
  return (
    <div className="w-full">
      {label && (
        <label className="block text-sm font-medium text-gray-300 mb-1.5">
          {label}
        </label>
      )}
      <div className="relative">
        {leftIcon && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
            {leftIcon}
          </div>
        )}
        <input
          className={`
            w-full bg-white/5 border rounded-xl
            px-4 py-2.5 text-white placeholder-gray-500
            transition-all duration-200
            focus:outline-none focus:ring-2 focus:ring-green-400/50 focus:border-green-400
            ${leftIcon ? "pl-10" : ""}
            ${rightIcon ? "pr-10" : ""}
            ${error ? "border-red-500/50 focus:border-red-500 focus:ring-red-500/50" : "border-white/10 hover:border-white/20"}
            ${className}
          `}
          {...props}
        />
        {rightIcon && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
            {rightIcon}
          </div>
        )}
      </div>
      {error && <p className="mt-1.5 text-sm text-red-400">{error}</p>}
      {hint && !error && <p className="mt-1.5 text-sm text-gray-500">{hint}</p>}
    </div>
  );
};

// ============================================================================
// TEXT
// ============================================================================

type TextVariant = "h1" | "h2" | "h3" | "h4" | "body" | "caption" | "label";
type TextColor = "primary" | "secondary" | "muted" | "accent" | "success" | "warning" | "error";

interface TextProps {
  variant?: TextVariant;
  color?: TextColor;
  className?: string;
  children: React.ReactNode;
  as?: keyof JSX.IntrinsicElements;
}

export const Text: React.FC<TextProps> = ({
  variant = "body",
  color = "primary",
  className = "",
  children,
  as,
}) => {
  const variants: Record<TextVariant, string> = {
    h1: "text-4xl font-bold tracking-tight",
    h2: "text-2xl font-semibold tracking-tight",
    h3: "text-xl font-semibold",
    h4: "text-lg font-medium",
    body: "text-base",
    caption: "text-sm",
    label: "text-xs font-medium uppercase tracking-wider",
  };

  const textColors: Record<TextColor, string> = {
    primary: "text-white",
    secondary: "text-gray-300",
    muted: "text-gray-500",
    accent: "text-green-400",
    success: "text-green-400",
    warning: "text-amber-400",
    error: "text-red-400",
  };

  const defaultTags: Record<TextVariant, keyof JSX.IntrinsicElements> = {
    h1: "h1",
    h2: "h2",
    h3: "h3",
    h4: "h4",
    body: "p",
    caption: "span",
    label: "span",
  };

  const Tag = as || defaultTags[variant];

  return (
    <Tag className={`${variants[variant]} ${textColors[color]} ${className}`}>
      {children}
    </Tag>
  );
};

// ============================================================================
// BADGE
// ============================================================================

interface BadgeProps {
  variant?: "success" | "warning" | "error" | "info" | "accent" | "muted";
  size?: "sm" | "md";
  children: React.ReactNode;
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({
  variant = "accent",
  size = "sm",
  children,
  className = "",
}) => {
  const variants = {
    success: "bg-green-500/20 text-green-400 border-green-500/30",
    warning: "bg-amber-500/20 text-amber-400 border-amber-500/30",
    error: "bg-red-500/20 text-red-400 border-red-500/30",
    info: "bg-blue-500/20 text-blue-400 border-blue-500/30",
    accent: "bg-green-500/20 text-green-400 border-green-500/30",
    muted: "bg-gray-500/20 text-gray-400 border-gray-500/30",
  };

  const sizes = {
    sm: "px-2 py-0.5 text-xs",
    md: "px-2.5 py-1 text-sm",
  };

  return (
    <span
      className={`
        inline-flex items-center font-medium rounded-full border
        ${variants[variant]} ${sizes[size]} ${className}
      `}
    >
      {children}
    </span>
  );
};

// ============================================================================
// SPINNER
// ============================================================================

interface SpinnerProps {
  size?: "sm" | "md" | "lg";
  className?: string;
}

export const Spinner: React.FC<SpinnerProps> = ({ size = "md", className = "" }) => {
  const sizes = {
    sm: "w-4 h-4",
    md: "w-6 h-6",
    lg: "w-8 h-8",
  };

  return (
    <svg
      className={`animate-spin text-green-400 ${sizes[size]} ${className}`}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  );
};

// ============================================================================
// PROGRESS BAR
// ============================================================================

interface ProgressBarProps {
  value: number;
  max?: number;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
  className?: string;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  value,
  max = 100,
  size = "md",
  showLabel = false,
  className = "",
}) => {
  const percentage = Math.min(100, Math.max(0, (value / max) * 100));

  const sizes = {
    sm: "h-1",
    md: "h-2",
    lg: "h-3",
  };

  return (
    <div className={`w-full ${className}`}>
      {showLabel && (
        <div className="flex justify-between text-xs text-gray-400 mb-1">
          <span>{percentage.toFixed(0)}%</span>
          <span>{value.toLocaleString()} / {max.toLocaleString()}</span>
        </div>
      )}
      <div className={`w-full bg-white/10 rounded-full overflow-hidden ${sizes[size]}`}>
        <div
          className="h-full bg-gradient-to-r from-green-400 to-green-600 rounded-full transition-all duration-500"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
};

// ============================================================================
// AVATAR
// ============================================================================

interface AvatarProps {
  src?: string;
  alt?: string;
  size?: "sm" | "md" | "lg" | "xl";
  fallback?: string;
  className?: string;
}

export const Avatar: React.FC<AvatarProps> = ({
  src,
  alt = "",
  size = "md",
  fallback,
  className = "",
}) => {
  const [error, setError] = useState(false);

  const sizes = {
    sm: "w-8 h-8 text-xs",
    md: "w-10 h-10 text-sm",
    lg: "w-12 h-12 text-base",
    xl: "w-16 h-16 text-lg",
  };

  const getFallbackText = () => {
    if (fallback) return fallback.slice(0, 2).toUpperCase();
    if (alt) return alt.slice(0, 2).toUpperCase();
    return "??";
  };

  return (
    <div
      className={`
        ${sizes[size]} rounded-full overflow-hidden
        bg-gradient-to-br from-green-400 to-purple-500
        flex items-center justify-center font-bold text-white
        ${className}
      `}
    >
      {src && !error ? (
        <img
          src={src}
          alt={alt}
          className="w-full h-full object-cover"
          onError={() => setError(true)}
        />
      ) : (
        <span>{getFallbackText()}</span>
      )}
    </div>
  );
};

// ============================================================================
// SKELETON
// ============================================================================

interface SkeletonProps {
  width?: string;
  height?: string;
  rounded?: "sm" | "md" | "lg" | "full";
  className?: string;
}

export const Skeleton: React.FC<SkeletonProps> = ({
  width = "100%",
  height = "1rem",
  rounded = "md",
  className = "",
}) => {
  const roundedStyles = {
    sm: "rounded",
    md: "rounded-lg",
    lg: "rounded-xl",
    full: "rounded-full",
  };

  return (
    <div
      className={`
        animate-pulse bg-white/10 ${roundedStyles[rounded]} ${className}
      `}
      style={{ width, height }}
    />
  );
};

// ============================================================================
// CARD
// ============================================================================

interface CardProps {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
  onClick?: () => void;
}

export const Card: React.FC<CardProps> = ({
  children,
  className = "",
  hover = false,
  onClick,
}) => {
  return (
    <div
      className={`
        bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl
        ${hover ? "hover:bg-white/10 hover:border-white/20 cursor-pointer transition-all duration-200" : ""}
        ${className}
      `}
      onClick={onClick}
    >
      {children}
    </div>
  );
};

// ============================================================================
// ICONS
// ============================================================================

interface IconProps {
  className?: string;
}

export const IconRocket = ({ className = "w-5 h-5" }: IconProps) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M15.59 14.37a6 6 0 01-5.84 7.38v-4.8m5.84-2.58a14.98 14.98 0 006.16-12.12A14.98 14.98 0 009.631 8.41m5.96 5.96a14.926 14.926 0 01-5.841 2.58m-.119-8.54a6 6 0 00-7.381 5.84h4.8m2.581-5.84a14.927 14.927 0 00-2.58 5.84m2.699 2.7c-.103.021-.207.041-.311.06a15.09 15.09 0 01-2.448-2.448 14.9 14.9 0 01.06-.312m-2.24 2.39a4.493 4.493 0 00-1.757 4.306 4.493 4.493 0 004.306-1.758M16.5 9a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z" />
  </svg>
);

export const IconTrending = ({ className = "w-5 h-5" }: IconProps) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" />
  </svg>
);

export const IconWallet = ({ className = "w-5 h-5" }: IconProps) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a2.25 2.25 0 00-2.25-2.25H15a3 3 0 11-6 0H5.25A2.25 2.25 0 003 12m18 0v6a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 18v-6m18 0V9M3 12V9m18 0a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 9m18 0V6a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 6v3" />
  </svg>
);

export const IconSearch = ({ className = "w-5 h-5" }: IconProps) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
  </svg>
);

export const IconArrowUp = ({ className = "w-5 h-5" }: IconProps) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 10.5L12 3m0 0l7.5 7.5M12 3v18" />
  </svg>
);

export const IconArrowDown = ({ className = "w-5 h-5" }: IconProps) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 13.5L12 21m0 0l-7.5-7.5M12 21V3" />
  </svg>
);

export const IconCopy = ({ className = "w-5 h-5" }: IconProps) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184" />
  </svg>
);

export const IconCheck = ({ className = "w-5 h-5" }: IconProps) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
  </svg>
);

export const IconExternalLink = ({ className = "w-5 h-5" }: IconProps) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
  </svg>
);

export const IconOrbit = ({ className = "w-5 h-5" }: IconProps) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
    <circle cx="12" cy="12" r="3" strokeLinecap="round" strokeLinejoin="round" />
    <ellipse cx="12" cy="12" rx="9" ry="4" strokeLinecap="round" strokeLinejoin="round" transform="rotate(30 12 12)" />
    <ellipse cx="12" cy="12" rx="9" ry="4" strokeLinecap="round" strokeLinejoin="round" transform="rotate(-30 12 12)" />
  </svg>
);

export const IconGraduate = ({ className = "w-5 h-5" }: IconProps) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.436 60.436 0 00-.491 6.347A48.627 48.627 0 0112 20.904a48.627 48.627 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.57 50.57 0 00-2.658-.813A59.905 59.905 0 0112 3.493a59.902 59.902 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.697 50.697 0 0112 13.489a50.702 50.702 0 017.74-3.342M6.75 15a.75.75 0 100-1.5.75.75 0 000 1.5zm0 0v-3.675A55.378 55.378 0 0112 8.443m-7.007 11.55A5.981 5.981 0 006.75 15.75v-1.5" />
  </svg>
);

export const IconTwitter = ({ className = "w-5 h-5" }: IconProps) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor" stroke="none">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
);

export const IconTelegram = ({ className = "w-5 h-5" }: IconProps) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor" stroke="none">
    <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
  </svg>
);

export const IconGlobe = ({ className = "w-5 h-5" }: IconProps) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418" />
  </svg>
);

export const IconPlus = ({ className = "w-5 h-5" }: IconProps) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
  </svg>
);

export const IconSwap = ({ className = "w-5 h-5" }: IconProps) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
  </svg>
);

export const IconSettings = ({ className = "w-5 h-5" }: IconProps) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);

export const IconWarning = ({ className = "w-5 h-5" }: IconProps) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
  </svg>
);

// New icons from launchr-ui
export const IconSun = ({ className = "w-4 h-4" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
    <circle cx={12} cy={12} r={5} />
    <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
  </svg>
);

export const IconMoon = ({ className = "w-4 h-4" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
  </svg>
);

export const IconBack = ({ className = "w-4 h-4" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
    <path d="M19 12H5M12 19l-7-7 7-7" />
  </svg>
);

export const IconChevronUp = ({ className = "w-3 h-3" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round">
    <path d="M12 19V5M5 12l7-7 7 7" />
  </svg>
);

export const IconChevronDown = ({ className = "w-3 h-3" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round">
    <path d="M12 5v14M19 12l-7 7-7-7" />
  </svg>
);

export const IconImage = ({ className = "w-6 h-6" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
    <rect x={3} y={3} width={18} height={18} rx={2} ry={2} />
    <circle cx={8.5} cy={8.5} r={1.5} />
    <path d="M21 15l-5-5L5 21" />
  </svg>
);

// ============================================================================
// GRADIENT AVATAR (New from launchr-ui)
// ============================================================================

interface GradientAvatarProps {
  index: number;
  size?: number;
  className?: string;
}

export const GradientAvatar: React.FC<GradientAvatarProps> = ({
  index,
  size = 36,
  className = "",
}) => {
  const gradient = AVATAR_GRADIENTS[index % AVATAR_GRADIENTS.length];
  const iconFn = AVATAR_ICONS[index % AVATAR_ICONS.length];
  const iconSize = Math.round(size * 0.5);

  return (
    <div
      className={`flex items-center justify-center flex-shrink-0 ${className}`}
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.35,
        background: `linear-gradient(135deg, ${gradient[0]}, ${gradient[1]})`,
        boxShadow: `0 4px 18px ${gradient[0]}40`,
      }}
    >
      {iconFn(iconSize)}
    </div>
  );
};

// ============================================================================
// LAUNCHR LOGO
// ============================================================================

interface LogoProps {
  size?: "sm" | "md" | "lg";
  showText?: boolean;
  className?: string;
}

export const LaunchrLogo: React.FC<LogoProps> = ({
  size = "md",
  showText = true,
  className = "",
}) => {
  const sizes = {
    sm: { icon: 24, text: "text-lg", badge: 28 },
    md: { icon: 32, text: "text-xl", badge: 36 },
    lg: { icon: 48, text: "text-3xl", badge: 52 },
  };

  const badgeSize = sizes[size].badge;

  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      {/* L-bracket with launch dot - Brand Logo */}
      <svg
        width={badgeSize}
        height={badgeSize}
        viewBox="0 0 120 120"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="launchr-logo-grad" x1="0" y1="0" x2="120" y2="120" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#34D399"/>
            <stop offset="100%" stopColor="#16A34A"/>
          </linearGradient>
        </defs>
        {/* Gradient background with rounded corners */}
        <rect width="120" height="120" rx="26" fill="url(#launchr-logo-grad)"/>
        {/* L-bracket */}
        <path
          d="M32 34 L32 88 L86 88"
          stroke="white"
          strokeWidth="12"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
        {/* Launch dot */}
        <circle cx="82" cy="38" r="8" fill="white"/>
      </svg>
      {showText && (
        <span className={`font-bold ${sizes[size].text} bg-gradient-to-r from-green-400 to-green-600 bg-clip-text text-transparent`}>
          Launchr
        </span>
      )}
    </div>
  );
};
