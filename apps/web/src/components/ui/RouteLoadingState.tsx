import { useCallback, useEffect, useState } from 'react';
import { DashboardSkeleton } from './DashboardSkeleton';
import { DesignPageSkeleton } from './DesignPageSkeleton';
import { AnalysisPageSkeleton } from './AnalysisPageSkeleton';
import { ANALYTICS_EVENTS, useAnalytics } from '../../providers/AnalyticsProvider';

export interface RouteLoadingStateProps {
  variant?: 'generic' | 'dashboard' | 'design' | 'analysis';
  title?: string;
  subtitle?: string;
  timeoutMs?: number;
  onRetry?: () => void;
}

function GenericLoader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div
      className="flex items-center justify-center min-h-screen bg-[#0b1326]"
      role="status"
      aria-live="polite"
      aria-label={title}
    >
      <div className="flex flex-col items-center gap-4">
        <div className="relative">
          <div
            className="w-14 h-14 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin"
            aria-hidden="true"
          ></div>
          <div
            className="absolute inset-0 w-14 h-14 border-4 border-transparent border-b-indigo-400/40 rounded-full animate-spin"
            style={{ animationDirection: 'reverse', animationDuration: '1.5s' }}
            aria-hidden="true"
          ></div>
        </div>
        <div className="text-center">
          <p className="text-slate-600 dark:text-slate-300 text-sm font-medium tracking-wide">{title}</p>
          <p className="text-[#424754] text-xs mt-0.5">{subtitle}</p>
        </div>
      </div>
    </div>
  );
}

function TimeoutCard({ onRetry }: { onRetry: () => void }) {
  return (
    <div
      role="alert"
      className="fixed bottom-6 right-6 max-w-sm rounded-xl border border-amber-500/30 bg-slate-900/95 backdrop-blur px-4 py-3 shadow-xl"
    >
      <p className="text-sm font-semibold text-amber-300">Taking longer than expected</p>
      <p className="text-xs text-slate-300 mt-1">
        You can retry this action or refresh the page if loading appears stuck.
      </p>
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={onRetry}
          className="rounded-md bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium px-3 py-1.5"
        >
          Retry
        </button>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="rounded-md bg-slate-700 hover:bg-slate-600 text-slate-100 text-xs font-medium px-3 py-1.5"
        >
          Refresh page
        </button>
      </div>
    </div>
  );
}

export function RouteLoadingState({
  variant = 'generic',
  title = 'Loading module',
  subtitle = 'Preparing workspace...',
  timeoutMs = 12000,
  onRetry,
}: RouteLoadingStateProps) {
  const [timedOut, setTimedOut] = useState(false);
  const { track } = useAnalytics();

  useEffect(() => {
    setTimedOut(false);
    const timer = window.setTimeout(() => setTimedOut(true), timeoutMs);
    return () => window.clearTimeout(timer);
  }, [timeoutMs, variant]);

  useEffect(() => {
    if (!timedOut) return;
    track(ANALYTICS_EVENTS.LOADING_TIMEOUT_SHOWN, { variant, timeoutMs });
  }, [timedOut, track, variant, timeoutMs]);

  const handleRetry = useCallback(() => {
    track(ANALYTICS_EVENTS.LOADING_RETRY_CLICKED, { variant });
    if (onRetry) {
      onRetry();
      return;
    }
    window.location.reload();
  }, [onRetry, track, variant]);

  let content = <GenericLoader title={title} subtitle={subtitle} />;

  if (variant === 'dashboard') {
    content = <DashboardSkeleton />;
  } else if (variant === 'design') {
    content = <DesignPageSkeleton />;
  } else if (variant === 'analysis') {
    content = <AnalysisPageSkeleton />;
  }

  return (
    <>
      {content}
      {timedOut ? <TimeoutCard onRetry={handleRetry} /> : null}
    </>
  );
}

export default RouteLoadingState;