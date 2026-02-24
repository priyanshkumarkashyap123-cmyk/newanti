/**
 * ============================================================================
 * EMPTY STATES LIBRARY
 * ============================================================================
 * 
 * Industry-standard empty state components for:
 * - No data states
 * - Error states
 * - Search no results
 * - Feature promotion
 * - First-time user experience
 * - Permission denied
 * - Offline states
 * 
 * All components are accessible with proper ARIA labels.
 * 
 * @version 1.0.0
 */

import React, { ReactNode } from 'react';

// ============================================================================
// BASE EMPTY STATE
// ============================================================================

export interface EmptyStateProps {
  /** Icon or illustration */
  icon?: ReactNode;
  /** Main heading */
  title: string;
  /** Description text */
  description?: string;
  /** Primary action button */
  action?: {
    label: string;
    onClick: () => void;
    variant?: 'primary' | 'secondary';
  };
  /** Secondary action */
  secondaryAction?: {
    label: string;
    onClick: () => void;
  };
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Additional content */
  children?: ReactNode;
  /** Custom className */
  className?: string;
}

const sizeClasses = {
  sm: {
    container: 'py-8 px-4',
    iconWrapper: 'w-10 h-10',
    title: 'text-base',
    description: 'text-sm',
    button: 'px-3 py-1.5 text-sm',
  },
  md: {
    container: 'py-12 px-6',
    iconWrapper: 'w-14 h-14',
    title: 'text-lg',
    description: 'text-base',
    button: 'px-4 py-2',
  },
  lg: {
    container: 'py-16 px-8',
    iconWrapper: 'w-20 h-20',
    title: 'text-xl',
    description: 'text-lg',
    button: 'px-6 py-3',
  },
};

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  action,
  secondaryAction,
  size = 'md',
  children,
  className = '',
}) => {
  const sizes = sizeClasses[size];

  return (
    <div
      className={`flex flex-col items-center justify-center text-center ${sizes.container} ${className}`}
      role="status"
      aria-label={title}
    >
      {icon && (
        <div
          className={`
            ${sizes.iconWrapper}
            rounded-full bg-slate-700/50 
            flex items-center justify-center mb-4
          `}
          aria-hidden="true"
        >
          {icon}
        </div>
      )}

      <h3 className={`font-semibold text-slate-200 mb-2 ${sizes.title}`}>
        {title}
      </h3>

      {description && (
        <p className={`text-slate-400 mb-6 max-w-md ${sizes.description}`}>
          {description}
        </p>
      )}

      {(action || secondaryAction) && (
        <div className="flex flex-wrap items-center justify-center gap-3">
          {action && (
            <button
              onClick={action.onClick}
              className={`
                ${sizes.button}
                ${
                  action.variant === 'secondary'
                    ? 'bg-slate-700 hover:bg-slate-600 text-slate-200'
                    : 'bg-blue-600 hover:bg-blue-700 text-white'
                }
                font-medium rounded-lg transition-colors
                focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-slate-900
              `}
            >
              {action.label}
            </button>
          )}
          {secondaryAction && (
            <button
              onClick={secondaryAction.onClick}
              className={`
                ${sizes.button}
                bg-transparent hover:bg-slate-700 text-slate-300
                font-medium rounded-lg transition-colors
                focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2 focus:ring-offset-slate-900
              `}
            >
              {secondaryAction.label}
            </button>
          )}
        </div>
      )}

      {children}
    </div>
  );
};

// ============================================================================
// NO DATA STATE
// ============================================================================

export interface NoDataProps {
  title?: string;
  description?: string;
  onCreateNew?: () => void;
  createLabel?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const NoData: React.FC<NoDataProps> = ({
  title = 'No data found',
  description = "There's nothing here yet.",
  onCreateNew,
  createLabel = 'Create New',
  size = 'md',
  className = '',
}) => {
  return (
    <EmptyState
      title={title}
      description={description}
      icon={
        <svg className="w-6 h-6 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
          />
        </svg>
      }
      action={onCreateNew ? { label: createLabel, onClick: onCreateNew } : undefined}
      size={size}
      className={className}
    />
  );
};

// ============================================================================
// ERROR STATE
// ============================================================================

export interface ErrorStateProps {
  title?: string;
  description?: string;
  error?: Error | string;
  onRetry?: () => void;
  retryLabel?: string;
  onGoBack?: () => void;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  title = 'Something went wrong',
  description,
  error,
  onRetry,
  retryLabel = 'Try Again',
  onGoBack,
  size = 'md',
  className = '',
}) => {
  const errorMessage = error instanceof Error ? error.message : error;
  const displayDescription = description || errorMessage || 'An unexpected error occurred. Please try again.';

  return (
    <EmptyState
      title={title}
      description={displayDescription}
      icon={
        <svg className="w-6 h-6 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        </svg>
      }
      action={onRetry ? { label: retryLabel, onClick: onRetry } : undefined}
      secondaryAction={onGoBack ? { label: 'Go Back', onClick: onGoBack } : undefined}
      size={size}
      className={className}
    />
  );
};

// ============================================================================
// SEARCH NO RESULTS
// ============================================================================

export interface SearchNoResultsProps {
  query?: string;
  suggestions?: string[];
  onClearSearch?: () => void;
  onSuggestionClick?: (suggestion: string) => void;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const SearchNoResults: React.FC<SearchNoResultsProps> = ({
  query,
  suggestions,
  onClearSearch,
  onSuggestionClick,
  size = 'md',
  className = '',
}) => {
  return (
    <EmptyState
      title={query ? `No results for "${query}"` : 'No results found'}
      description="Try adjusting your search or filter criteria."
      icon={
        <svg className="w-6 h-6 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
      }
      action={onClearSearch ? { label: 'Clear Search', onClick: onClearSearch, variant: 'secondary' } : undefined}
      size={size}
      className={className}
    >
      {suggestions && suggestions.length > 0 && (
        <div className="mt-4">
          <p className="text-sm text-slate-400 mb-2">Try searching for:</p>
          <div className="flex flex-wrap gap-2 justify-center">
            {suggestions.map((suggestion, index) => (
              <button
                key={index}
                onClick={() => onSuggestionClick?.(suggestion)}
                className="px-3 py-1 bg-slate-700/50 hover:bg-slate-700 text-slate-300 text-sm rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {suggestion}
              </button>
            ))}
          </div>
        </div>
      )}
    </EmptyState>
  );
};

// ============================================================================
// OFFLINE STATE
// ============================================================================

export interface OfflineStateProps {
  onRetryConnection?: () => void;
  showCachedData?: boolean;
  onViewCached?: () => void;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const OfflineState: React.FC<OfflineStateProps> = ({
  onRetryConnection,
  showCachedData = false,
  onViewCached,
  size = 'md',
  className = '',
}) => {
  return (
    <EmptyState
      title="You're offline"
      description="Check your internet connection and try again."
      icon={
        <svg className="w-6 h-6 text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243 2.829a4.978 4.978 0 01-1.414-2.83m-1.414 5.658a9 9 0 01-2.167-9.238m7.824 2.167a1 1 0 111.414 1.414m-1.414-1.414L3 3m8.293 8.293l1.414 1.414"
          />
        </svg>
      }
      action={onRetryConnection ? { label: 'Retry Connection', onClick: onRetryConnection } : undefined}
      secondaryAction={showCachedData && onViewCached ? { label: 'View Cached Data', onClick: onViewCached } : undefined}
      size={size}
      className={className}
    />
  );
};

// ============================================================================
// PERMISSION DENIED STATE
// ============================================================================

export interface PermissionDeniedProps {
  title?: string;
  description?: string;
  requiredRole?: string;
  onRequestAccess?: () => void;
  onGoBack?: () => void;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const PermissionDenied: React.FC<PermissionDeniedProps> = ({
  title = 'Access Denied',
  description = "You don't have permission to view this content.",
  requiredRole,
  onRequestAccess,
  onGoBack,
  size = 'md',
  className = '',
}) => {
  return (
    <EmptyState
      title={title}
      description={requiredRole ? `${description} Required role: ${requiredRole}` : description}
      icon={
        <svg className="w-6 h-6 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
          />
        </svg>
      }
      action={onRequestAccess ? { label: 'Request Access', onClick: onRequestAccess } : undefined}
      secondaryAction={onGoBack ? { label: 'Go Back', onClick: onGoBack } : undefined}
      size={size}
      className={className}
    />
  );
};

// ============================================================================
// FIRST TIME USER / ONBOARDING STATE
// ============================================================================

export interface OnboardingStateProps {
  title: string;
  description: string;
  steps?: Array<{
    icon: ReactNode;
    title: string;
    description: string;
  }>;
  onGetStarted: () => void;
  getStartedLabel?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const OnboardingState: React.FC<OnboardingStateProps> = ({
  title,
  description,
  steps,
  onGetStarted,
  getStartedLabel = 'Get Started',
  size = 'md',
  className = '',
}) => {
  return (
    <div className={`flex flex-col items-center text-center ${className}`}>
      <EmptyState
        title={title}
        description={description}
        icon={
          <svg className="w-6 h-6 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M13 10V3L4 14h7v7l9-11h-7z"
            />
          </svg>
        }
        action={{ label: getStartedLabel, onClick: onGetStarted }}
        size={size}
      />

      {steps && steps.length > 0 && (
        <div className="mt-8 grid gap-4 md:grid-cols-3 max-w-3xl">
          {steps.map((step, index) => (
            <div
              key={index}
              className="flex flex-col items-center p-4 bg-slate-800/30 rounded-xl"
            >
              <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center mb-3">
                {step.icon}
              </div>
              <h4 className="font-medium text-slate-200 mb-1">{step.title}</h4>
              <p className="text-sm text-slate-400">{step.description}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ============================================================================
// MAINTENANCE STATE
// ============================================================================

export interface MaintenanceStateProps {
  estimatedTime?: string;
  onNotifyMe?: () => void;
  className?: string;
}

export const MaintenanceState: React.FC<MaintenanceStateProps> = ({
  estimatedTime,
  onNotifyMe,
  className = '',
}) => {
  return (
    <EmptyState
      title="We're under maintenance"
      description={
        estimatedTime
          ? `We're making some improvements. We'll be back in approximately ${estimatedTime}.`
          : "We're making some improvements. Please check back soon."
      }
      icon={
        <svg className="w-6 h-6 text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
          />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
          />
        </svg>
      }
      action={onNotifyMe ? { label: 'Notify Me When Ready', onClick: onNotifyMe } : undefined}
      className={className}
    />
  );
};

// ============================================================================
// FEATURE COMING SOON
// ============================================================================

export interface ComingSoonProps {
  feature: string;
  description?: string;
  onNotifyMe?: () => void;
  releaseDate?: string;
  className?: string;
}

export const ComingSoon: React.FC<ComingSoonProps> = ({
  feature,
  description,
  onNotifyMe,
  releaseDate,
  className = '',
}) => {
  return (
    <EmptyState
      title={`${feature} Coming Soon`}
      description={description || `We're working on something exciting. ${releaseDate ? `Expected: ${releaseDate}` : ''}`}
      icon={
        <svg className="w-6 h-6 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"
          />
        </svg>
      }
      action={onNotifyMe ? { label: 'Notify Me', onClick: onNotifyMe } : undefined}
      className={className}
    />
  );
};

// ============================================================================
// UPLOAD STATE
// ============================================================================

export interface UploadStateProps {
  title?: string;
  description?: string;
  acceptedFormats?: string[];
  maxSize?: string;
  onUpload: () => void;
  onDrop?: (files: FileList) => void;
  className?: string;
}

export const UploadState: React.FC<UploadStateProps> = ({
  title = 'Upload files',
  description = 'Drag and drop your files here, or click to browse.',
  acceptedFormats,
  maxSize,
  onUpload,
  className = '',
}) => {
  return (
    <div
      className={`
        flex flex-col items-center justify-center text-center
        p-8 border-2 border-dashed border-slate-600 rounded-xl
        hover:border-blue-500/50 hover:bg-slate-800/30 transition-colors
        cursor-pointer
        ${className}
      `}
      onClick={onUpload}
      role="button"
      tabIndex={0}
      aria-label={title}
      onKeyDown={(e) => e.key === 'Enter' && onUpload()}
    >
      <div className="w-14 h-14 rounded-full bg-blue-500/20 flex items-center justify-center mb-4">
        <svg className="w-7 h-7 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
          />
        </svg>
      </div>

      <h3 className="text-lg font-semibold text-slate-200 mb-2">{title}</h3>
      <p className="text-slate-400 mb-4">{description}</p>

      {(acceptedFormats || maxSize) && (
        <div className="text-sm text-slate-400">
          {acceptedFormats && (
            <p>Accepted: {acceptedFormats.join(', ')}</p>
          )}
          {maxSize && (
            <p>Max size: {maxSize}</p>
          )}
        </div>
      )}
    </div>
  );
};

export default {
  EmptyState,
  NoData,
  ErrorState,
  SearchNoResults,
  OfflineState,
  PermissionDenied,
  OnboardingState,
  MaintenanceState,
  ComingSoon,
  UploadState,
};
