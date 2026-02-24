/**
 * LoadingSpinner - Enhanced Loading Components
 * 
 * Multiple loading state variants for different use cases:
 * - Spinner: Simple animated spinner
 * - Skeleton: Content placeholder shimmer
 * - Progress: Determinate progress bar
 * - Dots: Pulsing dots animation
 * - Engineering: Domain-specific loader
 */

import React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/utils';

// ============================================================================
// SPINNER VARIANTS
// ============================================================================

const spinnerVariants = cva(
  'animate-spin rounded-full border-2 border-current border-t-transparent',
  {
    variants: {
      size: {
        xs: 'w-3 h-3',
        sm: 'w-4 h-4',
        md: 'w-6 h-6',
        lg: 'w-8 h-8',
        xl: 'w-12 h-12',
      },
      color: {
        primary: 'text-blue-500',
        secondary: 'text-slate-400',
        success: 'text-emerald-500',
        warning: 'text-amber-500',
        danger: 'text-red-500',
        white: 'text-white',
      },
    },
    defaultVariants: {
      size: 'md',
      color: 'primary',
    },
  }
);

type SpinnerSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';
type SpinnerColor = 'primary' | 'secondary' | 'success' | 'warning' | 'danger' | 'white';

export interface SpinnerProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'color'> {
  size?: SpinnerSize;
  color?: SpinnerColor;
  label?: string;
}

export const Spinner: React.FC<SpinnerProps> = ({
  size,
  color,
  label,
  className,
  ...props
}) => (
  <div
    role="status"
    aria-label={label || 'Loading'}
    className={cn('inline-flex items-center gap-2', className)}
    {...props}
  >
    <div className={cn(spinnerVariants({ size, color }))} />
    {label && <span className="text-sm text-slate-400">{label}</span>}
    <span className="sr-only">{label || 'Loading...'}</span>
  </div>
);

// ============================================================================
// SKELETON SHIMMER
// ============================================================================

const skeletonVariants = cva(
  'animate-pulse rounded bg-slate-800',
  {
    variants: {
      variant: {
        text: 'h-4 w-full',
        title: 'h-6 w-3/4',
        avatar: 'rounded-full',
        thumbnail: 'aspect-video',
        button: 'h-9 w-24',
        card: 'h-32 w-full',
      },
    },
    defaultVariants: {
      variant: 'text',
    },
  }
);

export interface SkeletonProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof skeletonVariants> {
  width?: string | number;
  height?: string | number;
}

export const Skeleton: React.FC<SkeletonProps> = ({
  variant,
  width,
  height,
  className,
  style,
  ...props
}) => (
  <div
    className={cn(skeletonVariants({ variant }), className)}
    style={{ width, height, ...style }}
    aria-hidden="true"
    {...props}
  />
);

// ============================================================================
// SKELETON GROUPS
// ============================================================================

export const SkeletonText: React.FC<{ lines?: number; className?: string }> = ({
  lines = 3,
  className,
}) => (
  <div className={cn('space-y-2', className)}>
    {Array.from({ length: lines }).map((_, i) => (
      <Skeleton
        key={i}
        variant="text"
        className={i === lines - 1 ? 'w-2/3' : 'w-full'}
      />
    ))}
  </div>
);

export const SkeletonCard: React.FC<{ className?: string }> = ({ className }) => (
  <div className={cn('rounded-xl border border-slate-800 bg-slate-900 p-5', className)}>
    <div className="flex items-center gap-4 mb-4">
      <Skeleton variant="avatar" width={48} height={48} />
      <div className="flex-1 space-y-2">
        <Skeleton variant="title" />
        <Skeleton variant="text" className="w-1/2" />
      </div>
    </div>
    <SkeletonText lines={2} />
    <div className="flex gap-2 mt-4">
      <Skeleton variant="button" />
      <Skeleton variant="button" className="w-20" />
    </div>
  </div>
);

// ============================================================================
// PROGRESS BAR
// ============================================================================

export interface ProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  value: number; // 0-100
  max?: number;
  showLabel?: boolean;
  size?: 'sm' | 'md' | 'lg';
  color?: 'primary' | 'success' | 'warning' | 'danger';
  animated?: boolean;
}

export const Progress: React.FC<ProgressProps> = ({
  value,
  max = 100,
  showLabel = false,
  size = 'md',
  color = 'primary',
  animated = true,
  className,
  ...props
}) => {
  const percentage = Math.min(100, Math.max(0, (value / max) * 100));
  
  const heights = { sm: 'h-1', md: 'h-2', lg: 'h-3' };
  const colors = {
    primary: 'bg-blue-500',
    success: 'bg-emerald-500',
    warning: 'bg-amber-500',
    danger: 'bg-red-500',
  };
  
  return (
    <div className={cn('w-full', className)} {...props}>
      <div
        className={cn('w-full rounded-full bg-slate-800 overflow-hidden', heights[size])}
        role="progressbar"
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={max}
      >
        <div
          className={cn(
            'h-full rounded-full transition-all duration-300 ease-out',
            colors[color],
            animated && 'relative overflow-hidden'
          )}
          style={{ width: `${percentage}%` }}
        >
          {animated && (
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer" />
          )}
        </div>
      </div>
      {showLabel && (
        <div className="flex justify-between mt-1 text-xs text-slate-400">
          <span>{value}</span>
          <span>{percentage.toFixed(0)}%</span>
        </div>
      )}
    </div>
  );
};

// ============================================================================
// PULSING DOTS
// ============================================================================

export interface DotsLoaderProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: 'sm' | 'md' | 'lg';
  color?: string;
}

export const DotsLoader: React.FC<DotsLoaderProps> = ({
  size = 'md',
  color = 'bg-blue-500',
  className,
  ...props
}) => {
  const sizes = { sm: 'w-1.5 h-1.5', md: 'w-2 h-2', lg: 'w-3 h-3' };
  const gaps = { sm: 'gap-1', md: 'gap-1.5', lg: 'gap-2' };
  
  return (
    <div
      className={cn('flex items-center', gaps[size], className)}
      role="status"
      aria-label="Loading"
      {...props}
    >
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className={cn('rounded-full animate-bounce', sizes[size], color)}
          style={{ animationDelay: `${i * 150}ms` }}
        />
      ))}
      <span className="sr-only">Loading...</span>
    </div>
  );
};

// ============================================================================
// ENGINEERING LOADER (Domain-Specific)
// ============================================================================

export interface EngineeringLoaderProps {
  message?: string;
  subMessage?: string;
  progress?: number;
  className?: string;
}

export const EngineeringLoader: React.FC<EngineeringLoaderProps> = ({
  message = 'Processing...',
  subMessage,
  progress,
  className,
}) => (
  <div className={cn('flex flex-col items-center justify-center p-8', className)}>
    {/* Animated Engineering Icon */}
    <div className="relative w-16 h-16 mb-4">
      {/* Outer ring */}
      <div className="absolute inset-0 rounded-full border-4 border-slate-700" />
      {/* Spinning arc */}
      <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-blue-500 animate-spin" />
      {/* Center icon */}
      <div className="absolute inset-0 flex items-center justify-center">
        <svg
          className="w-6 h-6 text-blue-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"
          />
        </svg>
      </div>
    </div>
    
    {/* Message */}
    <p className="text-white font-medium text-center">{message}</p>
    {subMessage && (
      <p className="text-sm text-slate-400 mt-1 text-center">{subMessage}</p>
    )}
    
    {/* Optional Progress */}
    {typeof progress === 'number' && (
      <div className="w-48 mt-4">
        <Progress value={progress} showLabel size="sm" />
      </div>
    )}
  </div>
);

// ============================================================================
// FULL PAGE LOADER
// ============================================================================

export interface FullPageLoaderProps {
  message?: string;
  variant?: 'spinner' | 'engineering' | 'dots';
}

export const FullPageLoader: React.FC<FullPageLoaderProps> = ({
  message = 'Loading...',
  variant = 'engineering',
}) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/95 backdrop-blur-sm">
    {variant === 'spinner' && (
      <div className="flex flex-col items-center gap-4">
        <Spinner size="xl" />
        <p className="text-slate-300">{message}</p>
      </div>
    )}
    {variant === 'engineering' && <EngineeringLoader message={message} />}
    {variant === 'dots' && (
      <div className="flex flex-col items-center gap-4">
        <DotsLoader size="lg" />
        <p className="text-slate-300">{message}</p>
      </div>
    )}
  </div>
);

// ============================================================================
// INLINE LOADING STATE
// ============================================================================

export interface InlineLoaderProps {
  loading: boolean;
  children: React.ReactNode;
  fallback?: React.ReactNode;
  className?: string;
}

export const InlineLoader: React.FC<InlineLoaderProps> = ({
  loading,
  children,
  fallback,
  className,
}) => {
  if (loading) {
    return (
      <div className={cn('flex items-center gap-2 text-slate-400', className)}>
        <Spinner size="sm" />
        {fallback || <span className="text-sm">Loading...</span>}
      </div>
    );
  }
  return <>{children}</>;
};

export default {
  Spinner,
  Skeleton,
  SkeletonText,
  SkeletonCard,
  Progress,
  DotsLoader,
  EngineeringLoader,
  FullPageLoader,
  InlineLoader,
};
