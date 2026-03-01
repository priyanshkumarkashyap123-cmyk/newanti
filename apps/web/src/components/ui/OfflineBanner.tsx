/**
 * OfflineBanner - Global offline/reconnecting status banner
 *
 * Integrates with the real SyncManager from offlineSync.tsx
 * to show actual pending/failed counts and trigger real sync on reconnect.
 *
 * Figma spec 22.11 — Error Handling UX:
 * "Offline Mode Active" yellow banner at top of workspace
 * with "Last synced: X ago" and [Retry Connection] / [Continue Offline]
 */

import { FC, useState, useEffect, useCallback, useRef } from 'react';
import { WifiOff, RefreshCw, X, CloudOff, CheckCircle2, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { useSync } from '../../lib/offlineSync';

// ============================================
// Utility: relative time
// ============================================

function timeAgo(date: Date): string {
    const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
    if (seconds < 10) return 'just now';
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ago`;
}

// ============================================
// OfflineBanner Component
// ============================================

export const OfflineBanner: FC = () => {
    const {
        isOnline,
        isSyncing,
        pendingCount,
        failedCount,
        lastSyncResult,
        sync,
    } = useSync({ autoSync: true, syncInterval: 30_000 });

    const [dismissed, setDismissed] = useState(false);
    const [showReconnected, setShowReconnected] = useState(false);
    const [relativeTime, setRelativeTime] = useState('');
    const prefersReducedMotion = useReducedMotion();
    const intervalRef = useRef<ReturnType<typeof setInterval>>();
    const wasOfflineRef = useRef(false);

    // Track last sync timestamp for "Last synced: X ago"
    const lastSyncTime = lastSyncResult
        ? new Date(Date.now() - (lastSyncResult.duration || 0))
        : null;

    // Update relative time every 10s
    useEffect(() => {
        if (lastSyncTime) {
            setRelativeTime(timeAgo(lastSyncTime));
            intervalRef.current = setInterval(() => {
                if (lastSyncTime) setRelativeTime(timeAgo(lastSyncTime));
            }, 10_000);
        }
        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
        };
    }, [lastSyncResult]); // re-run when a new sync completes

    // Detect online→offline→online transitions
    useEffect(() => {
        if (!isOnline) {
            wasOfflineRef.current = true;
            setDismissed(false);
        } else if (wasOfflineRef.current) {
            wasOfflineRef.current = false;
            setShowReconnected(true);
            // Auto-sync is already handled by useSync({ autoSync: true })
            const timer = setTimeout(() => setShowReconnected(false), 4000);
            return () => clearTimeout(timer);
        }
    }, [isOnline]);

    const handleRetry = useCallback(async () => {
        // Try a real health check + trigger sync
        try {
            await fetch('/health', { method: 'HEAD', cache: 'no-store' });
            await sync();
        } catch {
            // Still offline
        }
    }, [sync]);

    const animationProps = prefersReducedMotion
        ? {}
        : {
              initial: { y: -48, opacity: 0 },
              animate: { y: 0, opacity: 1 },
              exit: { y: -48, opacity: 0 },
              transition: { type: 'spring' as const, stiffness: 300, damping: 30 },
          };

    const showOffline = !isOnline && !dismissed;

    return (
        <AnimatePresence>
            {/* Offline Banner */}
            {showOffline && (
                <motion.div
                    key="offline-banner"
                    role="alert"
                    aria-live="assertive"
                    className="fixed top-0 left-0 right-0 z-[9999] bg-amber-500 dark:bg-amber-600 text-amber-950 dark:text-amber-50 shadow-lg"
                    {...animationProps}
                >
                    <div className="max-w-7xl mx-auto px-4 py-2.5 flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3 min-w-0">
                            <WifiOff className="w-4 h-4 shrink-0" aria-hidden />
                            <div className="flex items-center gap-2 text-sm font-medium truncate">
                                <span className="font-semibold">Offline Mode Active</span>
                                {lastSyncTime && relativeTime && (
                                    <span className="opacity-80 hidden sm:inline">
                                        · Last synced: {relativeTime}
                                    </span>
                                )}
                            </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                            {/* Real pending/failed counts from SyncManager */}
                            {pendingCount > 0 && (
                                <span className="text-xs font-mono bg-amber-700/20 px-1.5 py-0.5 rounded hidden md:inline">
                                    {pendingCount} pending
                                </span>
                            )}
                            {failedCount > 0 && (
                                <span className="text-xs font-mono bg-red-700/30 px-1.5 py-0.5 rounded hidden md:inline flex items-center gap-1">
                                    <AlertTriangle className="w-3 h-3" aria-hidden />
                                    {failedCount} failed
                                </span>
                            )}
                            <button
                                onClick={handleRetry}
                                disabled={isSyncing}
                                className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-md bg-amber-700/20 hover:bg-amber-700/30 active:scale-[0.97] transition-all disabled:opacity-50"
                            >
                                <RefreshCw
                                    className={`w-3 h-3 ${isSyncing ? 'animate-spin' : ''}`}
                                    aria-hidden
                                />
                                {isSyncing ? 'Syncing…' : 'Retry'}
                            </button>
                            <button
                                onClick={() => setDismissed(true)}
                                className="p-1 rounded hover:bg-amber-700/20 transition-colors"
                                aria-label="Dismiss offline banner"
                            >
                                <X className="w-3.5 h-3.5" aria-hidden />
                            </button>
                        </div>
                    </div>
                </motion.div>
            )}

            {/* Reconnected Toast — shows actual sync result */}
            {showReconnected && isOnline && (
                <motion.div
                    key="reconnected-toast"
                    role="status"
                    aria-live="polite"
                    className="fixed top-4 left-1/2 z-[9999] -translate-x-1/2 bg-emerald-600 text-white rounded-lg shadow-xl px-4 py-2.5 flex items-center gap-2 text-sm font-medium"
                    initial={prefersReducedMotion ? undefined : { y: -32, opacity: 0, x: '-50%' }}
                    animate={{ y: 0, opacity: 1, x: '-50%' }}
                    exit={prefersReducedMotion ? undefined : { y: -32, opacity: 0, x: '-50%' }}
                    transition={{ type: 'spring' as const, stiffness: 300, damping: 25 }}
                >
                    <CheckCircle2 className="w-4 h-4" aria-hidden />
                    {isSyncing
                        ? 'Back online — syncing changes…'
                        : lastSyncResult
                            ? `Back online — ${lastSyncResult.synced} change${lastSyncResult.synced !== 1 ? 's' : ''} synced`
                            : 'Back online'
                    }
                    <button
                        onClick={() => setShowReconnected(false)}
                        className="ml-2 p-0.5 rounded hover:bg-emerald-500/50 transition-colors"
                        aria-label="Dismiss"
                    >
                        <X className="w-3.5 h-3.5" aria-hidden />
                    </button>
                </motion.div>
            )}
        </AnimatePresence>
    );
};

export default OfflineBanner;
