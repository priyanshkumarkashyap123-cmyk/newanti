/**
 * State Components
 * 
 * Common loading and placeholder states for consistent UX
 */

import React from 'react';
import { cn } from '../../lib/utils';

// ============================================
// LOADING COMPONENT
// ============================================

export interface LoadingProps {
  size?: 'sm' | 'md' | 'lg';
  color?: 'primary' | 'secondary' | 'white';
  className?: string;
  label?: string;
}

export const Loading: React.FC<LoadingProps> = ({
  size = 'md',
  color = 'primary',
  className,
  label,
}) => {
  const sizeClasses = {
    sm: 'h-4 w-4 border-2',
    md: 'h-8 w-8 border-3',
    lg: 'h-12 w-12 border-4',
  };

  const colorClasses = {
    primary: 'border-blue-600 border-t-transparent',
    secondary: 'border-gray-400 border-t-transparent',
    white: 'border-white border-t-transparent',
  };

  return (
    <div className={cn('flex flex-col items-center gap-2', className)}>
      <div
        className={cn(
          'animate-spin rounded-full',
          sizeClasses[size],
          colorClasses[color]
        )}
        role="status"
        aria-label={label || 'Loading'}
      />
      {label && (
        <span className="text-sm text-gray-600 dark:text-gray-400">{label}</span>
      )}
    </div>
  );
};

// ============================================
// LOADING OVERLAY
// ============================================

export interface LoadingOverlayProps {
  isLoading: boolean;
  label?: string;
  children?: React.ReactNode;
  className?: string;
  blur?: boolean;
}

export const LoadingOverlay: React.FC<LoadingOverlayProps> = ({
  isLoading,
  label = 'Loading...',
  children,
  className,
  blur = true,
}) => {
  if (!isLoading) {
    return <>{children}</>;
  }

  return (
    <div className={cn('relative', className)}>
      {children}
      <div
        className={cn(
          'absolute inset-0 flex items-center justify-center bg-white/80 dark:bg-gray-900/80',
          blur && 'backdrop-blur-sm'
        )}
      >
        <Loading size="lg" label={label} />
      </div>
    </div>
  );
};

// ============================================
// SKELETON COMPONENT
// ============================================

export interface SkeletonProps {
  className?: string;
  width?: string | number;
  height?: string | number;
  rounded?: 'none' | 'sm' | 'md' | 'lg' | 'full';
  animation?: 'pulse' | 'shimmer' | 'none';
}

export const Skeleton: React.FC<SkeletonProps> = ({
  className,
  width,
  height,
  rounded = 'md',
  animation = 'pulse',
}) => {
  const roundedClasses = {
    none: 'rounded-none',
    sm: 'rounded-sm',
    md: 'rounded-md',
    lg: 'rounded-lg',
    full: 'rounded-full',
  };

  const animationClasses = {
    pulse: 'animate-pulse',
    shimmer: 'animate-shimmer bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 dark:from-gray-700 dark:via-gray-600 dark:to-gray-700 bg-[length:400%_100%]',
    none: '',
  };

  return (
    <div
      className={cn(
        'bg-gray-200 dark:bg-gray-700',
        roundedClasses[rounded],
        animationClasses[animation],
        className
      )}
      style={{
        width: typeof width === 'number' ? `${width}px` : width,
        height: typeof height === 'number' ? `${height}px` : height,
      }}
      aria-hidden="true"
    />
  );
};

// ============================================
// SKELETON TEXT
// ============================================

export interface SkeletonTextProps {
  lines?: number;
  className?: string;
}

export const SkeletonText: React.FC<SkeletonTextProps> = ({
  lines = 3,
  className,
}) => {
  return (
    <div className={cn('space-y-2', className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          height={16}
          width={i === lines - 1 ? '75%' : '100%'}
          className="h-4"
        />
      ))}
    </div>
  );
};

// ============================================
// SKELETON CARD
// ============================================

export const SkeletonCard: React.FC<{ className?: string }> = ({ className }) => (
  <div className={cn('p-4 space-y-4 border border-gray-200 dark:border-gray-700 rounded-lg', className)}>
    <Skeleton height={120} rounded="md" />
    <SkeletonText lines={2} />
  </div>
);

export default {
  Loading,
  LoadingOverlay,
  Skeleton,
  SkeletonText,
  SkeletonCard,
};
