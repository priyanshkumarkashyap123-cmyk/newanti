/**
 * ============================================================================
 * OFFLINE CAPABILITY & PWA ENHANCEMENTS
 * ============================================================================
 * 
 * Progressive Web App utilities:
 * - Service Worker management
 * - IndexedDB caching for offline analysis results
 * - Network status monitoring
 * - Background sync
 * 
 * @version 1.0.0
 */

// ============================================================================
// NETWORK STATUS
// ============================================================================

export type NetworkStatus = 'online' | 'offline' | 'slow';

export interface NetworkStatusObserver {
  status: NetworkStatus;
  subscribe: (callback: (status: NetworkStatus) => void) => () => void;
  isOnline: () => boolean;
  isOffline: () => boolean;
  isSlow: () => boolean;
}

/**
 * Create a network status observer
 */
export function createNetworkObserver(): NetworkStatusObserver {
  if (typeof navigator === 'undefined') {
    let currentStatus: NetworkStatus = 'offline';
    return {
      get status() {
        return currentStatus;
      },
      subscribe: () => () => undefined,
      isOnline: () => false,
      isOffline: () => true,
      isSlow: () => false,
    };
  }

  let currentStatus: NetworkStatus = navigator.onLine ? 'online' : 'offline';
  const subscribers = new Set<(status: NetworkStatus) => void>();

  const updateStatus = (newStatus: NetworkStatus) => {
    if (newStatus !== currentStatus) {
      currentStatus = newStatus;
      subscribers.forEach(callback => callback(currentStatus));
    }
  };

  // Listen to online/offline events
  if (typeof window !== 'undefined') {
    window.addEventListener('online', () => updateStatus('online'));
    window.addEventListener('offline', () => updateStatus('offline'));
  }

  // Check connection quality
  if ('connection' in navigator) {
    const conn = (navigator as any).connection;
    conn.addEventListener('change', () => {
      if (navigator.onLine) {
        const effectiveType = conn.effectiveType;
        updateStatus(effectiveType === '2g' || effectiveType === 'slow-2g' ? 'slow' : 'online');
      }
    });
  }

  return {
    get status() {
      return currentStatus;
    },
    subscribe: (callback) => {
      subscribers.add(callback);
      return () => subscribers.delete(callback);
    },
    isOnline: () => currentStatus === 'online',
    isOffline: () => currentStatus === 'offline',
    isSlow: () => currentStatus === 'slow',
  };
}

// ============================================================================
// INDEXEDDB STORAGE
// ============================================================================

export interface AnalysisResult {
  id: string;
  modelId: string;
  timestamp: number;
  data: any;
}

/**
 * IndexedDB wrapper for offline storage
 */
export class OfflineStorage {
  private dbName = 'beamlab-offline';
  private version = 1;
  private db: IDBDatabase | null = null;

  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Create object stores
        if (!db.objectStoreNames.contains('analysisResults')) {
          const store = db.createObjectStore('analysisResults', { keyPath: 'id' });
          store.createIndex('modelId', 'modelId', { unique: false });
          store.createIndex('timestamp', 'timestamp', { unique: false });
        }

        if (!db.objectStoreNames.contains('projects')) {
          db.createObjectStore('projects', { keyPath: 'id' });
        }
      };
    });
  }

  async saveAnalysisResult(result: AnalysisResult): Promise<void> {
    if (!this.db) await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['analysisResults'], 'readwrite');
      const store = transaction.objectStore('analysisResults');
      const request = store.put(result);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getAnalysisResult(id: string): Promise<AnalysisResult | null> {
    if (!this.db) await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['analysisResults'], 'readonly');
      const store = transaction.objectStore('analysisResults');
      const request = store.get(id);

      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  async getAnalysisResultsByModel(modelId: string): Promise<AnalysisResult[]> {
    if (!this.db) await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['analysisResults'], 'readonly');
      const store = transaction.objectStore('analysisResults');
      const index = store.index('modelId');
      const request = index.getAll(modelId);

      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  async deleteOldResults(daysOld = 7): Promise<void> {
    if (!this.db) await this.init();
    const cutoff = Date.now() - daysOld * 24 * 60 * 60 * 1000;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['analysisResults'], 'readwrite');
      const store = transaction.objectStore('analysisResults');
      const index = store.index('timestamp');
      const range = IDBKeyRange.upperBound(cutoff);
      const request = index.openCursor(range);

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        } else {
          resolve();
        }
      };

      request.onerror = () => reject(request.error);
    });
  }
}

// ============================================================================
// SERVICE WORKER MANAGEMENT
// ============================================================================

/**
 * Register service worker for PWA
 */
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if ('serviceWorker' in navigator) {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js', {
        scope: '/',
      });
      
      if (import.meta.env.DEV) console.log('Service Worker registered:', registration.scope);
      
      // Listen for updates
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        if (newWorker) {
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              if (import.meta.env.DEV) console.log('New content available, please refresh.');
              // Notify user about update
              dispatchEvent(new CustomEvent('sw-update-available'));
            }
          });
        }
      });
      
      return registration;
    } catch (error) {
      if (import.meta.env.DEV) console.error('Service Worker registration failed:', error);
      return null;
    }
  }
  return null;
}

/**
 * Unregister service worker
 */
export async function unregisterServiceWorker(): Promise<boolean> {
  if ('serviceWorker' in navigator) {
    const registration = await navigator.serviceWorker.ready;
    return registration.unregister();
  }
  return false;
}

/**
 * Check for service worker updates
 */
export async function checkForUpdates(): Promise<void> {
  if ('serviceWorker' in navigator) {
    const registration = await navigator.serviceWorker.ready;
    await registration.update();
  }
}

// ============================================================================
// BACKGROUND SYNC
// ============================================================================

/**
 * Queue task for background sync when online
 */
export async function queueBackgroundSync(tag: string, data?: any): Promise<void> {
  if ('sync' in navigator.serviceWorker && navigator.serviceWorker.controller) {
    const registration = await navigator.serviceWorker.ready;
    
    // Store data in IndexedDB for the sync task
    if (data) {
      const storage = new OfflineStorage();
      await storage.init();
      // Store sync task data
    }
    
    await (registration as any).sync.register(tag);
  } else {
    console.warn('Background sync not supported');
  }
}

// ============================================================================
// CACHE MANAGEMENT
// ============================================================================

/**
 * Clear all caches
 */
export async function clearAllCaches(): Promise<void> {
  if ('caches' in window) {
    const cacheNames = await caches.keys();
    await Promise.all(cacheNames.map(name => caches.delete(name)));
  }
}

/**
 * Get cache storage usage
 */
export async function getCacheSize(): Promise<{ usage: number; quota: number; percentage: number } | null> {
  if ('storage' in navigator && 'estimate' in navigator.storage) {
    const estimate = await navigator.storage.estimate();
    return {
      usage: estimate.usage || 0,
      quota: estimate.quota || 0,
      percentage: ((estimate.usage || 0) / (estimate.quota || 1)) * 100,
    };
  }
  return null;
}
