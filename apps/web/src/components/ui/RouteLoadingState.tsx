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

type LoaderVariant = NonNullable<RouteLoadingStateProps['variant']>;

interface StageTheme {
  label: string;
  background: string;
  spinnerTrack: string;
  spinnerAccent: string;
  spinnerSecondary: string;
  title: string;
  subtitle: string;
  chipBg: string;
  chipBorder: string;
  chipText: string;
  timeoutBg: string;
  timeoutBorder: string;
  timeoutTitle: string;
  timeoutText: string;
  retryBg: string;
  retryHoverBg: string;
  refreshBg: string;
  refreshHoverBg: string;
}

const STAGE_THEME: Record<LoaderVariant, StageTheme> = {
  generic: {
    label: 'System',
    background: '#0b1326',
    spinnerTrack: 'rgba(99, 145, 255, 0.24)',
    spinnerAccent: '#4d8eff',
    spinnerSecondary: 'rgba(173, 198, 255, 0.45)',
    title: '#dae2fd',
    subtitle: '#9cb0d5',
    chipBg: 'rgba(77, 142, 255, 0.12)',
    chipBorder: 'rgba(77, 142, 255, 0.45)',
    chipText: '#adc6ff',
    timeoutBg: 'rgba(11, 19, 38, 0.95)',
    timeoutBorder: 'rgba(125, 154, 255, 0.45)',
    timeoutTitle: '#c7d7ff',
    timeoutText: '#c4d3ef',
    retryBg: '#2563eb',
    retryHoverBg: '#1d4ed8',
    refreshBg: '#334155',
    refreshHoverBg: '#475569',
  },
  dashboard: {
    label: 'Dashboard',
    background: '#0b1326',
    spinnerTrack: 'rgba(16, 185, 129, 0.24)',
    spinnerAccent: '#10b981',
    spinnerSecondary: 'rgba(110, 231, 183, 0.45)',
    title: '#d2fde9',
    subtitle: '#9ad6bc',
    chipBg: 'rgba(16, 185, 129, 0.14)',
    chipBorder: 'rgba(16, 185, 129, 0.5)',
    chipText: '#6ee7b7',
    timeoutBg: 'rgba(7, 26, 22, 0.95)',
    timeoutBorder: 'rgba(16, 185, 129, 0.45)',
    timeoutTitle: '#bbf7d0',
    timeoutText: '#a7f3d0',
    retryBg: '#059669',
    retryHoverBg: '#047857',
    refreshBg: '#334155',
    refreshHoverBg: '#475569',
  },
  design: {
    label: 'Design',
    background: '#0b1326',
    spinnerTrack: 'rgba(168, 85, 247, 0.24)',
    spinnerAccent: '#a855f7',
    spinnerSecondary: 'rgba(216, 180, 254, 0.45)',
    title: '#f0defe',
    subtitle: '#d7b9f3',
    chipBg: 'rgba(168, 85, 247, 0.14)',
    chipBorder: 'rgba(168, 85, 247, 0.5)',
    chipText: '#e9d5ff',
    timeoutBg: 'rgba(24, 9, 36, 0.95)',
    timeoutBorder: 'rgba(168, 85, 247, 0.45)',
    timeoutTitle: '#f3e8ff',
    timeoutText: '#e9d5ff',
    retryBg: '#7e22ce',
    retryHoverBg: '#6b21a8',
    refreshBg: '#334155',
    refreshHoverBg: '#475569',
  },
  analysis: {
    label: 'Analysis',
    background: '#0b1326',
    spinnerTrack: 'rgba(245, 158, 11, 0.24)',
    spinnerAccent: '#f59e0b',
    spinnerSecondary: 'rgba(253, 186, 116, 0.45)',
    title: '#ffe9c7',
    subtitle: '#f5cc8b',
    chipBg: 'rgba(245, 158, 11, 0.14)',
    chipBorder: 'rgba(245, 158, 11, 0.5)',
    chipText: '#fcd34d',
    timeoutBg: 'rgba(35, 22, 7, 0.95)',
    timeoutBorder: 'rgba(245, 158, 11, 0.45)',
    timeoutTitle: '#fde68a',
    timeoutText: '#fcd34d',
    retryBg: '#d97706',
    retryHoverBg: '#b45309',
    refreshBg: '#334155',
    refreshHoverBg: '#475569',
  },
};

function GenericLoader({ title, subtitle, theme }: { title: string; subtitle: string; theme: StageTheme }) {
  return (
    <div
      className="flex items-center justify-center min-h-screen"
      style={{ backgroundColor: theme.background }}
      role="status"
      aria-live="polite"
      aria-label={title}
    >
      <div className="flex flex-col items-center gap-4">
        <div
          className="rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em]"
          style={{
            backgroundColor: theme.chipBg,
            borderColor: theme.chipBorder,
            color: theme.chipText,
          }}
        >
          {theme.label}
        </div>
        <div className="relative">
          <div
            className="w-14 h-14 border-4 rounded-full animate-spin"
            style={{
              borderColor: theme.spinnerTrack,
              borderTopColor: theme.spinnerAccent,
            }}
            aria-hidden="true"
          ></div>
          <div
            className="absolute inset-0 w-14 h-14 border-4 border-transparent rounded-full animate-spin"
            style={{
              borderBottomColor: theme.spinnerSecondary,
              animationDirection: 'reverse',
              animationDuration: '1.5s',
            }}
            aria-hidden="true"
          ></div>
        </div>
        <div className="text-center">
          <p className="text-sm font-semibold tracking-wide" style={{ color: theme.title }}>{title}</p>
          <p className="text-xs mt-0.5" style={{ color: theme.subtitle }}>{subtitle}</p>
        </div>
      </div>
    </div>
  );
}

function TimeoutCard({ onRetry, theme }: { onRetry: () => void; theme: StageTheme }) {
  return (
    <div
      role="alert"
      className="fixed bottom-6 right-6 max-w-sm rounded-xl border backdrop-blur px-4 py-3 shadow-xl"
      style={{
        backgroundColor: theme.timeoutBg,
        borderColor: theme.timeoutBorder,
      }}
    >
      <p className="text-sm font-semibold" style={{ color: theme.timeoutTitle }}>Taking longer than expected</p>
      <p className="text-xs mt-1" style={{ color: theme.timeoutText }}>
        You can retry this action or refresh the page if loading appears stuck.
      </p>
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={onRetry}
          className="rounded-md text-white text-xs font-medium px-3 py-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/60"
          style={{ backgroundColor: theme.retryBg }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = theme.retryHoverBg;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = theme.retryBg;
          }}
        >
          Retry
        </button>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="rounded-md text-slate-100 text-xs font-medium px-3 py-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/60"
          style={{ backgroundColor: theme.refreshBg }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = theme.refreshHoverBg;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = theme.refreshBg;
          }}
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
  const [timedOutForKey, setTimedOutForKey] = useState<string | null>(null);
  const { track } = useAnalytics();
  const timeoutKey = `${variant}:${timeoutMs}:${title}:${subtitle}`;

  const timedOut = timedOutForKey === timeoutKey;
  const theme = STAGE_THEME[variant];

  useEffect(() => {
    const timer = window.setTimeout(() => setTimedOutForKey(timeoutKey), timeoutMs);
    return () => window.clearTimeout(timer);
  }, [timeoutMs, timeoutKey]);

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

  let content = <GenericLoader title={title} subtitle={subtitle} theme={theme} />;

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
      {timedOut ? <TimeoutCard onRetry={handleRetry} theme={theme} /> : null}
    </>
  );
}

export default RouteLoadingState;