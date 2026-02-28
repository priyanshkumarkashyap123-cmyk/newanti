/**
 * Service Worker Registration
 * Industry-standard PWA setup with offline support
 * 
 * Features:
 * - Smart caching strategies
 * - Offline-first for static assets
 * - Network-first for API calls
 * - Background sync
 * - Push notifications readiness
 */

// ============================================================================
// Types
// ============================================================================

interface ServiceWorkerConfig {
  onUpdate?: (registration: ServiceWorkerRegistration) => void;
  onSuccess?: (registration: ServiceWorkerRegistration) => void;
  onError?: (error: Error) => void;
  scope?: string;
}

// ============================================================================
// Service Worker Registration
// ============================================================================

export function register(config?: ServiceWorkerConfig): void {
  if ('serviceWorker' in navigator) {
    // Only register in production
    const isLocalhost = Boolean(
      window.location.hostname === 'localhost' ||
      window.location.hostname === '[::1]' ||
      window.location.hostname.match(
        /^127(?:\.(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)){3}$/
      )
    );

    window.addEventListener('load', () => {
      const swUrl = '/sw.js';

      if (isLocalhost) {
        // Development: check if SW exists
        checkValidServiceWorker(swUrl, config);
        navigator.serviceWorker.ready.then(() => {
          console.log('[SW] Running in localhost development mode');
        });
      } else {
        // Production: register SW
        registerValidSW(swUrl, config);
      }
    });
  }
}

function registerValidSW(swUrl: string, config?: ServiceWorkerConfig): void {
  navigator.serviceWorker
    .register(swUrl, { scope: config?.scope ?? '/' })
    .then((registration) => {
      // Check for updates periodically
      setInterval(() => {
        registration.update();
      }, 60 * 60 * 1000); // Every hour

      registration.onupdatefound = () => {
        const installingWorker = registration.installing;
        if (!installingWorker) return;

        installingWorker.onstatechange = () => {
          if (installingWorker.state === 'installed') {
            if (navigator.serviceWorker.controller) {
              // New content is available
              console.log('[SW] New content available; please refresh.');
              config?.onUpdate?.(registration);
            } else {
              // Content is cached for offline use
              console.log('[SW] Content cached for offline use.');
              config?.onSuccess?.(registration);
            }
          }
        };
      };
    })
    .catch((error) => {
      console.error('[SW] Registration failed:', error);
      config?.onError?.(error);
    });
}

function checkValidServiceWorker(swUrl: string, config?: ServiceWorkerConfig): void {
  fetch(swUrl, { headers: { 'Service-Worker': 'script' } })
    .then((response) => {
      const contentType = response.headers.get('content-type');
      if (
        response.status === 404 ||
        (contentType != null && contentType.indexOf('javascript') === -1)
      ) {
        // No service worker found
        navigator.serviceWorker.ready.then((registration) => {
          registration.unregister().then(() => {
            window.location.reload();
          });
        });
      } else {
        // Service worker found, proceed with registration
        registerValidSW(swUrl, config);
      }
    })
    .catch(() => {
      console.log('[SW] No internet connection found. App is running in offline mode.');
    });
}

// ============================================================================
// Unregister Service Worker
// ============================================================================

export function unregister(): void {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.ready
      .then((registration) => {
        registration.unregister();
      })
      .catch((error) => {
        console.error('[SW] Unregistration error:', error);
      });
  }
}

// ============================================================================
// Communication with Service Worker
// ============================================================================

export function postMessage(message: unknown): void {
  if (navigator.serviceWorker.controller) {
    navigator.serviceWorker.controller.postMessage(message);
  }
}

export function onMessage(callback: (event: MessageEvent) => void): () => void {
  navigator.serviceWorker.addEventListener('message', callback);
  return () => navigator.serviceWorker.removeEventListener('message', callback);
}

// ============================================================================
// Cache Management
// ============================================================================

export async function clearAllCaches(): Promise<void> {
  if ('caches' in window) {
    const cacheNames = await caches.keys();
    await Promise.all(
      cacheNames.map((cacheName) => caches.delete(cacheName))
    );
    console.log('[SW] All caches cleared');
  }
}

export async function getCacheStats(): Promise<{ name: string; count: number }[]> {
  if (!('caches' in window)) return [];

  const cacheNames = await caches.keys();
  const stats = await Promise.all(
    cacheNames.map(async (name) => {
      const cache = await caches.open(name);
      const keys = await cache.keys();
      return { name, count: keys.length };
    })
  );

  return stats;
}

// ============================================================================
// Update Management
// ============================================================================

export function skipWaiting(): void {
  postMessage({ type: 'SKIP_WAITING' });
}

export function checkForUpdate(): void {
  if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
    navigator.serviceWorker.ready.then((registration) => {
      registration.update();
    });
  }
}

// ============================================================================
// React Hook for Service Worker
// ============================================================================

import { useEffect, useState, useCallback } from 'react';

interface UseServiceWorkerReturn {
  isSupported: boolean;
  isRegistered: boolean;
  hasUpdate: boolean;
  isOffline: boolean;
  update: () => void;
  skipWaiting: () => void;
}

export function useServiceWorker(): UseServiceWorkerReturn {
  const [isRegistered, setIsRegistered] = useState(false);
  const [hasUpdate, setHasUpdate] = useState(false);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  const isSupported = 'serviceWorker' in navigator;

  useEffect(() => {
    if (!isSupported) return;

    register({
      onSuccess: () => setIsRegistered(true),
      onUpdate: () => setHasUpdate(true),
    });

    // Check if already registered
    navigator.serviceWorker.ready.then(() => {
      setIsRegistered(true);
    });
  }, [isSupported]);

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const update = useCallback(() => {
    checkForUpdate();
  }, []);

  const handleSkipWaiting = useCallback(() => {
    skipWaiting();
    window.location.reload();
  }, []);

  return {
    isSupported,
    isRegistered,
    hasUpdate,
    isOffline,
    update,
    skipWaiting: handleSkipWaiting,
  };
}

// ============================================================================
// Offline Indicator Component
// ============================================================================

interface OfflineIndicatorProps {
  className?: string;
}

export function OfflineIndicator({ className = '' }: OfflineIndicatorProps): JSX.Element | null {
  const { isOffline } = useServiceWorker();

  if (!isOffline) return null;

  return (
    <div
      className={`fixed bottom-4 left-4 bg-yellow-600 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2 z-50 ${className}`}
      role="alert"
    >
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M18.364 5.636a9 9 0 010 12.728m-3.536-3.536a4 4 0 010-5.656M6.343 6.343a8 8 0 0110.607 0M8.464 8.464a4 4 0 015.657 0"
        />
      </svg>
      <span>You are offline</span>
    </div>
  );
}

// ============================================================================
// Update Available Banner
// ============================================================================

interface UpdateBannerProps {
  onUpdate: () => void;
  onDismiss: () => void;
  className?: string;
}

export function UpdateBanner({ onUpdate, onDismiss, className = '' }: UpdateBannerProps): JSX.Element {
  return (
    <div
      className={`fixed bottom-4 right-4 bg-blue-600 text-white p-4 rounded-lg shadow-lg z-50 max-w-sm ${className}`}
      role="alert"
    >
      <div className="flex items-start gap-3">
        <svg className="w-6 h-6 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
          />
        </svg>
        <div className="flex-1">
          <p className="font-medium">Update available</p>
          <p className="text-sm text-blue-100 mt-1">
            A new version is ready. Update now for the latest features.
          </p>
        </div>
        <button
          onClick={onDismiss}
          className="text-blue-200 hover:text-zinc-900 dark:text-white"
          aria-label="Dismiss"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      <button
        onClick={onUpdate}
        className="mt-3 w-full bg-white text-blue-600 px-4 py-2 rounded font-medium hover:bg-blue-50 transition-colors"
      >
        Update Now
      </button>
    </div>
  );
}
