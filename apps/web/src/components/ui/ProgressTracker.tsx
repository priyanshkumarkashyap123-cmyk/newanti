/**
 * ============================================================================
 * PROGRESS TRACKER UI COMPONENTS
 * ============================================================================
 * 
 * Visual components for displaying long-running operation progress:
 * - Step-by-step progress indicator
 * - Overall progress bar with ETA
 * - Cancellation support
 * - Modal and inline variants
 * - Background task indicator
 * 
 * @version 1.0.0
 */

import React, { ReactNode, useEffect, useState } from 'react';
import {
  ProgressState,
  ProgressStep,
  formatTimeRemaining,
} from '@/hooks/useProgressTracking';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './dialog';
import { Button } from './button';

// ============================================================================
// STEP INDICATOR
// ============================================================================

interface StepIndicatorProps {
  steps: ProgressStep[];
  currentIndex: number;
  orientation?: 'horizontal' | 'vertical';
  size?: 'sm' | 'md' | 'lg';
  showLabels?: boolean;
  className?: string;
}

export function StepIndicator({
  steps,
  currentIndex,
  orientation = 'horizontal',
  size = 'md',
  showLabels = true,
  className,
}: StepIndicatorProps) {
  const sizes = {
    sm: { circle: 'w-6 h-6 text-xs', line: 'h-0.5 w-8', gap: 'gap-1' },
    md: { circle: 'w-8 h-8 text-sm', line: 'h-0.5 w-12', gap: 'gap-2' },
    lg: { circle: 'w-10 h-10 text-base', line: 'h-1 w-16', gap: 'gap-3' },
  };

  const getStepStyles = (step: ProgressStep, index: number) => {
    switch (step.status) {
      case 'completed':
        return 'bg-green-500 text-white border-green-500';
      case 'in-progress':
        return 'bg-blue-500 text-white border-blue-500 animate-pulse';
      case 'failed':
        return 'bg-red-500 text-white border-red-500';
      case 'skipped':
        return 'bg-slate-400 text-white border-slate-400';
      default:
        return 'bg-slate-700 text-slate-400 border-slate-600';
    }
  };

  const getLineStyles = (index: number) => {
    const step = steps[index];
    if (step.status === 'completed' || step.status === 'skipped') {
      return 'bg-green-500';
    }
    if (step.status === 'in-progress') {
      return 'bg-gradient-to-r from-green-500 to-slate-600';
    }
    return 'bg-slate-700';
  };

  const getIcon = (step: ProgressStep, index: number) => {
    switch (step.status) {
      case 'completed':
        return (
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        );
      case 'failed':
        return (
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        );
      case 'skipped':
        return (
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
          </svg>
        );
      case 'in-progress':
        return (
          <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        );
      default:
        return <span>{index + 1}</span>;
    }
  };

  if (orientation === 'vertical') {
    return (
      <div className={cn('flex flex-col', sizes[size].gap, className)}>
        {steps.map((step, index) => (
          <div key={step.id} className="flex items-start gap-3">
            {/* Circle */}
            <div className="flex flex-col items-center">
              <div
                className={cn(
                  'flex items-center justify-center rounded-full border-2 transition-all',
                  sizes[size].circle,
                  getStepStyles(step, index)
                )}
                role="listitem"
                aria-current={index === currentIndex ? 'step' : undefined}
              >
                {getIcon(step, index)}
              </div>
              {index < steps.length - 1 && (
                <div className={cn('w-0.5 h-8 mt-2', getLineStyles(index))} />
              )}
            </div>
            
            {/* Label */}
            {showLabels && (
              <div className="flex-1 pt-1">
                <p className={cn(
                  'font-medium',
                  step.status === 'in-progress' && 'text-blue-400',
                  step.status === 'completed' && 'text-green-400',
                  step.status === 'failed' && 'text-red-400',
                  step.status === 'pending' && 'text-slate-400'
                )}>
                  {step.label}
                </p>
                {step.message && (
                  <p className="text-sm text-slate-400 mt-0.5">{step.message}</p>
                )}
                {step.status === 'in-progress' && step.progress !== undefined && (
                  <div className="mt-2 h-1 bg-slate-700 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-blue-500 transition-all"
                      style={{ width: `${step.progress}%` }}
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className={cn('flex items-center', className)} role="list">
      {steps.map((step, index) => (
        <React.Fragment key={step.id}>
          <div className="flex flex-col items-center">
            <div
              className={cn(
                'flex items-center justify-center rounded-full border-2 transition-all',
                sizes[size].circle,
                getStepStyles(step, index)
              )}
              role="listitem"
              aria-current={index === currentIndex ? 'step' : undefined}
            >
              {getIcon(step, index)}
            </div>
            {showLabels && (
              <p className={cn(
                'mt-2 text-center max-w-[100px] truncate',
                size === 'sm' && 'text-xs',
                size === 'md' && 'text-sm',
                step.status === 'in-progress' && 'text-blue-400 font-medium',
                step.status === 'completed' && 'text-green-400',
                step.status === 'failed' && 'text-red-400',
                step.status === 'pending' && 'text-slate-400'
              )}>
                {step.label}
              </p>
            )}
          </div>
          {index < steps.length - 1 && (
            <div className={cn(sizes[size].line, getLineStyles(index), 'mx-2')} />
          )}
        </React.Fragment>
      ))}
    </div>
  );
}

// ============================================================================
// PROGRESS CARD
// ============================================================================

interface ProgressCardProps {
  state: ProgressState;
  onCancel?: () => void;
  onPause?: () => void;
  onResume?: () => void;
  onRetry?: () => void;
  showSteps?: boolean;
  showETA?: boolean;
  className?: string;
}

export function ProgressCard({
  state,
  onCancel,
  onPause,
  onResume,
  onRetry,
  showSteps = true,
  showETA = true,
  className,
}: ProgressCardProps) {
  return (
    <div
      className={cn(
        'bg-slate-800 border border-slate-700 rounded-lg p-6',
        className
      )}
      role="progressbar"
      aria-valuenow={state.overallProgress}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={state.title}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-white">{state.title}</h3>
        <StatusBadge status={state.status} />
      </div>

      {/* Overall Progress */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-slate-400">Overall Progress</span>
          <span className="text-sm font-medium text-white">
            {state.overallProgress}%
          </span>
        </div>
        <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
          <div
            className={cn(
              'h-full transition-all duration-300',
              state.status === 'failed' ? 'bg-red-500' : 'bg-blue-500',
              state.status === 'paused' && 'animate-pulse'
            )}
            style={{ width: `${state.overallProgress}%` }}
          />
        </div>
        {showETA && state.estimatedTimeRemaining && state.status === 'running' && (
          <p className="text-sm text-slate-400 mt-2">
            Estimated time remaining: {formatTimeRemaining(state.estimatedTimeRemaining)}
          </p>
        )}
      </div>

      {/* Steps */}
      {showSteps && (
        <div className="mb-6">
          <StepIndicator
            steps={state.steps}
            currentIndex={state.currentStepIndex}
            orientation="vertical"
            size="sm"
          />
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2">
        {state.canCancel && state.status === 'running' && onCancel && (
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-red-400 hover:text-red-300 
                       border border-red-500/30 hover:border-red-400/50 rounded-lg transition-colors"
          >
            Cancel
          </button>
        )}
        
        {state.canPause && state.status === 'running' && onPause && (
          <button
            onClick={onPause}
            className="px-4 py-2 text-sm font-medium text-slate-300 hover:text-white 
                       border border-slate-600 hover:border-slate-500 rounded-lg transition-colors"
          >
            Pause
          </button>
        )}
        
        {state.status === 'paused' && onResume && (
          <button
            onClick={onResume}
            className="px-4 py-2 text-sm font-medium text-blue-400 hover:text-blue-300 
                       border border-blue-500/30 hover:border-blue-400/50 rounded-lg transition-colors"
          >
            Resume
          </button>
        )}
        
        {state.status === 'failed' && onRetry && (
          <button
            onClick={onRetry}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 
                       hover:bg-blue-500 rounded-lg transition-colors"
          >
            Retry
          </button>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// STATUS BADGE
// ============================================================================

interface StatusBadgeProps {
  status: ProgressState['status'];
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const styles = {
    idle: 'bg-slate-600 text-slate-300',
    running: 'bg-blue-600 text-blue-100 animate-pulse',
    paused: 'bg-yellow-600 text-yellow-100',
    completed: 'bg-green-600 text-green-100',
    failed: 'bg-red-600 text-red-100',
    cancelled: 'bg-slate-600 text-slate-300',
  };

  const labels = {
    idle: 'Idle',
    running: 'Running',
    paused: 'Paused',
    completed: 'Completed',
    failed: 'Failed',
    cancelled: 'Cancelled',
  };

  return (
    <span
      className={cn(
        'px-2 py-1 text-xs font-medium rounded-full',
        styles[status],
        className
      )}
    >
      {labels[status]}
    </span>
  );
}

// ============================================================================
// PROGRESS MODAL
// ============================================================================

interface ProgressModalProps {
  isOpen: boolean;
  state: ProgressState;
  onCancel?: () => void;
  onClose?: () => void;
  preventClose?: boolean;
  showCloseOnComplete?: boolean;
  children?: ReactNode;
}

export function ProgressModal({
  isOpen,
  state,
  onCancel,
  onClose,
  preventClose = true,
  showCloseOnComplete = true,
  children,
}: ProgressModalProps) {
  const canClose = !preventClose || state.status === 'completed' || state.status === 'failed' || state.status === 'cancelled';

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && canClose && onClose?.()}>
      <DialogContent className="max-w-md p-8">
        <div className="text-center mb-6">
          {/* Animated icon */}
          {state.status === 'running' && (
            <div className="w-16 h-16 mx-auto mb-4 relative">
              <div className="absolute inset-0 rounded-full border-4 border-blue-500/20" />
              <div 
                className="absolute inset-0 rounded-full border-4 border-blue-500 border-t-transparent animate-spin"
              />
            </div>
          )}
          
          {state.status === 'completed' && (
            <div className="w-16 h-16 mx-auto mb-4 flex items-center justify-center bg-green-500/20 rounded-full">
              <svg className="w-8 h-8 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
          )}
          
          {state.status === 'failed' && (
            <div className="w-16 h-16 mx-auto mb-4 flex items-center justify-center bg-red-500/20 rounded-full">
              <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
          )}

          <DialogHeader>
            <DialogTitle className="text-xl font-semibold">
              {state.title}
            </DialogTitle>
          </DialogHeader>
        </div>

        {/* Progress bar */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-zinc-500 dark:text-zinc-400">
              {state.steps[state.currentStepIndex]?.label || 'Processing...'}
            </span>
            <span className="text-sm font-medium text-zinc-900 dark:text-white">
              {state.overallProgress}%
            </span>
          </div>
          <div className="h-2 bg-zinc-200 dark:bg-zinc-700 rounded-full overflow-hidden">
            <div
              className={cn(
                'h-full transition-all duration-300',
                state.status === 'failed' ? 'bg-red-500' : 'bg-blue-500'
              )}
              style={{ width: `${state.overallProgress}%` }}
            />
          </div>
          {state.estimatedTimeRemaining && state.status === 'running' && (
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-2 text-center">
              About {formatTimeRemaining(state.estimatedTimeRemaining)} remaining
            </p>
          )}
        </div>

        {/* Current step message */}
        {state.steps[state.currentStepIndex]?.message && (
          <p className="text-sm text-zinc-500 dark:text-zinc-400 text-center mb-4">
            {state.steps[state.currentStepIndex]?.message}
          </p>
        )}

        {/* Custom children */}
        {children}

        {/* Actions */}
        <div className="flex items-center justify-center gap-3 mt-6">
          {state.canCancel && state.status === 'running' && onCancel && (
            <Button variant="outline" onClick={onCancel} className="text-red-500 border-red-500/30 hover:border-red-400/50">
              Cancel
            </Button>
          )}
          
          {canClose && showCloseOnComplete && onClose && (
            <Button onClick={onClose}>
              {state.status === 'completed' ? 'Done' : 'Close'}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// BACKGROUND TASK INDICATOR
// ============================================================================

interface BackgroundTaskIndicatorProps {
  tasks: ProgressState[];
  onClick?: (task: ProgressState) => void;
  className?: string;
}

export function BackgroundTaskIndicator({
  tasks,
  onClick,
  className,
}: BackgroundTaskIndicatorProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const runningTasks = tasks.filter((t) => t.status === 'running');

  if (runningTasks.length === 0) return null;

  return (
    <div className={cn('fixed bottom-4 right-4 z-50', className)}>
      {/* Collapsed indicator */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-2 px-4 py-2 bg-slate-800 border border-slate-700 
                   rounded-full shadow-lg hover:bg-slate-700 transition-colors"
        aria-label={`${runningTasks.length} background tasks running`}
      >
        <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
        <span className="text-sm font-medium text-white">
          {runningTasks.length} task{runningTasks.length > 1 ? 's' : ''} running
        </span>
        <svg
          className={cn('w-4 h-4 text-slate-400 transition-transform', isExpanded && 'rotate-180')}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
        </svg>
      </button>

      {/* Expanded task list */}
      {isExpanded && (
        <div className="absolute bottom-full right-0 mb-2 w-80 bg-slate-800 border border-slate-700 
                        rounded-lg shadow-xl overflow-hidden">
          <div className="p-3 border-b border-slate-700">
            <h3 className="text-sm font-medium text-white">Background Tasks</h3>
          </div>
          <div className="max-h-64 overflow-y-auto">
            {runningTasks.map((task) => (
              <button
                key={task.id}
                onClick={() => onClick?.(task)}
                className="w-full p-3 text-left hover:bg-slate-700/50 transition-colors border-b border-slate-700/50 last:border-b-0"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-white truncate">
                    {task.title}
                  </span>
                  <span className="text-xs text-slate-400">
                    {task.overallProgress}%
                  </span>
                </div>
                <div className="h-1 bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-500 transition-all"
                    style={{ width: `${task.overallProgress}%` }}
                  />
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// INLINE PROGRESS BAR
// ============================================================================

interface InlineProgressProps {
  progress: number;
  showLabel?: boolean;
  label?: string;
  size?: 'sm' | 'md' | 'lg';
  color?: 'blue' | 'green' | 'yellow' | 'red';
  animated?: boolean;
  className?: string;
}

export function InlineProgress({
  progress,
  showLabel = true,
  label,
  size = 'md',
  color = 'blue',
  animated = true,
  className,
}: InlineProgressProps) {
  const sizes = {
    sm: 'h-1',
    md: 'h-2',
    lg: 'h-3',
  };

  const colors = {
    blue: 'bg-blue-500',
    green: 'bg-green-500',
    yellow: 'bg-yellow-500',
    red: 'bg-red-500',
  };

  return (
    <div className={className}>
      {showLabel && (
        <div className="flex items-center justify-between mb-1">
          {label && <span className="text-sm text-slate-400">{label}</span>}
          <span className="text-sm font-medium text-white">{Math.round(progress)}%</span>
        </div>
      )}
      <div className={cn('bg-slate-700 rounded-full overflow-hidden', sizes[size])}>
        <div
          className={cn(
            'h-full transition-all duration-300',
            colors[color],
            animated && 'relative overflow-hidden',
            animated && 'after:absolute after:inset-0 after:bg-gradient-to-r after:from-transparent after:via-white/10 after:to-transparent after:animate-shimmer'
          )}
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}

// ============================================================================
// CIRCULAR PROGRESS
// ============================================================================

interface CircularProgressIndicatorProps {
  progress: number;
  size?: number;
  strokeWidth?: number;
  showLabel?: boolean;
  color?: string;
  bgColor?: string;
  className?: string;
}

export function CircularProgressIndicator({
  progress,
  size = 80,
  strokeWidth = 6,
  showLabel = true,
  color = '#3b82f6',
  bgColor = '#334155',
  className,
}: CircularProgressIndicatorProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (progress / 100) * circumference;

  return (
    <div className={cn('relative inline-flex', className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={bgColor}
          strokeWidth={strokeWidth}
        />
        {/* Progress circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-all duration-300"
        />
      </svg>
      {showLabel && (
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-sm font-semibold text-white">
            {Math.round(progress)}%
          </span>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  StepIndicator,
  ProgressCard,
  StatusBadge,
  ProgressModal,
  BackgroundTaskIndicator,
  InlineProgress,
  CircularProgressIndicator,
};
