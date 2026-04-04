/// <reference lib="webworker" />

/**
 * Service Worker - Industry-Standard Offline Support
 * 
 * Enhanced caching strategies for structural engineering PWA:
 * - Cache First: Static assets (images, fonts, CSS, JS)
 * - Network First: API calls with offline fallback
 * - Stale While Revalidate: Semi-static content
 * - WASM First: Long-term caching for WebAssembly modules
 * 
 * Additional Features:
 * - Background sync for pending operations
 * - IndexedDB for offline model storage
 * - Push notifications for analysis completion
 * - Cross-tab synchronization
 */

declare const self: ServiceWorkerGlobalScope;

const CACHE_VERSION = 'v2';
const STATIC_CACHE = `structural-static-${CACHE_VERSION}`;
const DYNAMIC_CACHE = `structural-dynamic-${CACHE_VERSION}`;
const API_CACHE = `structural-api-${CACHE_VERSION}`;
const WASM_CACHE = `structural-wasm-${CACHE_VERSION}`;

// Assets to cache immediately on install
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/offline.html',
];

// API routes that should be cached for offline use
const OFFLINE_API_ROUTES = [
  '/api/sections',
  '/api/materials',
  '/api/design-codes',
];

// Cache durations
const CACHE_DURATIONS = {
  static: 30 * 24 * 60 * 60 * 1000, // 30 days
  dynamic: 24 * 60 * 60 * 1000,     // 1 day
  api: 5 * 60 * 1000,               // 5 minutes
  wasm: 7 * 24 * 60 * 60 * 1000,    // 7 days
};

// Pending operations store
interface PendingOperation {
  id: string;
  type: 'save' | 'analyze' | 'export';
  data: unknown;
  timestamp: number;
  retries: number;
}

// ============================================================================
// Install Event
// ============================================================================

self.addEventListener('install', (event) => {
  console.log('[SW] Installing v2...');
  
  event.waitUntil(
    (async () => {
      const cache = await caches.open(STATIC_CACHE);
      console.log('[SW] Precaching static assets');
      
      // Precache core assets
      await cache.addAll(PRECACHE_ASSETS);
      
      // Precache critical API responses for offline
      const apiCache = await caches.open(API_CACHE);
      for (const route of OFFLINE_API_ROUTES) {
        try {
          const response = await fetch(route);
          if (response.ok) {
            await apiCache.put(route, response);
          }
        } catch (e) {
          console.warn(`[SW] Could not precache ${route}:`, e);
        }
      }
      
      console.log('[SW] Installation complete');
      await self.skipWaiting();
    })()
  );
});

// ============================================================================
// Activate Event
// ============================================================================

self.addEventListener('activate', (event) => {
  console.log('[SW] Activating v2...');
  
  event.waitUntil(
    (async () => {
      const cacheNames = await caches.keys();
      const validCaches = [STATIC_CACHE, DYNAMIC_CACHE, API_CACHE, WASM_CACHE];
      
      await Promise.all(
        cacheNames
          .filter((name) => {
            // Delete old caches from any version
            return !validCaches.includes(name) && (
              name.startsWith('static-') ||
              name.startsWith('dynamic-') ||
              name.startsWith('api-') ||
              name.startsWith('structural-')
            );
          })
          .map((name) => {
            console.log('[SW] Deleting old cache:', name);
            return caches.delete(name);
          })
      );
      
      // Claim all clients immediately
      await self.clients.claim();
      console.log('[SW] Activation complete');
      
      // Notify all clients that SW is ready
      const clients = await self.clients.matchAll();
      clients.forEach(client => {
        client.postMessage({ type: 'SW_READY', version: CACHE_VERSION });
      });
    })()
  );
});

// ============================================================================
// Fetch Event
// ============================================================================

self.addEventListener('fetch', (event) => {
  const { request } = event;
  // Chrome can emit requests that cannot be handled in SW cache/fetch pipeline
  // (cache=only-if-cached with mode!=same-origin). Ignore to avoid runtime TypeError.
  if (request.cache === 'only-if-cached' && request.mode !== 'same-origin') {
    return;
  }

  if (!request.url.startsWith('http://') && !request.url.startsWith('https://')) {
    return;
  }

  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Skip cross-origin requests (except CDNs we trust)
  if (url.origin !== location.origin) {
    const trustedCDNs = ['unpkg.com', 'jsdelivr.net', 'cdnjs.cloudflare.com'];
    if (!trustedCDNs.some(cdn => url.hostname.includes(cdn))) {
      return;
    }
  }

  // Route to appropriate caching strategy
  if (isWasmAsset(url)) {
    event.respondWith(wasmFirst(request));
  } else if (isApiRequest(url)) {
    event.respondWith(networkFirst(request, API_CACHE));
  } else if (isStaticAsset(url)) {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
  } else if (isDocument(request)) {
    event.respondWith(networkFirstWithOfflineFallback(request));
  } else {
    event.respondWith(staleWhileRevalidate(request, DYNAMIC_CACHE));
  }
});

// ============================================================================
// Caching Strategies
// ============================================================================

/**
 * Cache First: Try cache, fallback to network
 * Best for: Static assets that rarely change
 */
async function cacheFirst(request: Request, cacheName: string): Promise<Response> {
  const cachedResponse = await safeCacheMatch(request);
  
  if (cachedResponse) {
    return cachedResponse;
  }

  try {
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    // Return offline fallback for HTML requests
    if (request.headers.get('accept')?.includes('text/html')) {
      const fallback = await safeCacheMatch('/offline.html');
      if (fallback) return fallback;
    }
    
    return createOfflineResponse('Resource not available offline');
  }
}

/**
 * Network First: Try network, fallback to cache
 * Best for: API calls, dynamic content
 */
async function networkFirst(request: Request, cacheName: string): Promise<Response> {
  try {
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      const cache = await caches.open(cacheName);
      // Add timestamp for cache invalidation
      const clonedResponse = networkResponse.clone();
      cache.put(request, clonedResponse);
    }
    
    return networkResponse;
  } catch (error) {
    const cachedResponse = await safeCacheMatch(request);
    
    if (cachedResponse) {
      console.log('[SW] Serving from cache:', request.url);
      return cachedResponse;
    }
    
    return createOfflineResponse('API not available offline');
  }
}

/**
 * Network First with Offline Fallback: For document navigation
 */
async function networkFirstWithOfflineFallback(request: Request): Promise<Response> {
  try {
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      const cache = await caches.open(DYNAMIC_CACHE);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    const cachedResponse = await safeCacheMatch(request);
    
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // Return offline page for navigation requests
    const offlinePage = await safeCacheMatch('/offline.html');
    if (offlinePage) {
      return offlinePage;
    }
    
    // Generate minimal offline page if none cached
    return new Response(
      `<!DOCTYPE html>
      <html>
        <head><title>Offline</title></head>
        <body style="font-family: system-ui; text-align: center; padding: 50px;">
          <h1>You're Offline</h1>
          <p>Please check your internet connection and try again.</p>
          <button onclick="location.reload()">Retry</button>
        </body>
      </html>`,
      { headers: { 'Content-Type': 'text/html' } }
    );
  }
}

/**
 * Stale While Revalidate: Return cached immediately, update cache in background
 * Best for: Content that can be slightly stale
 */
async function staleWhileRevalidate(request: Request, cacheName: string): Promise<Response> {
  const cache = await caches.open(cacheName);
  const cachedResponse = await safeCacheMatch(request);

  // Start network fetch in background
  const networkFetch = fetch(request).then((networkResponse) => {
    if (networkResponse.ok) {
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  }).catch(() => null);

  // Return cached response immediately, or wait for network
  if (cachedResponse) {
    return cachedResponse;
  }
  
  const networkResponse = await networkFetch;
  if (networkResponse) {
    return networkResponse;
  }
  
  return createOfflineResponse('Resource not available offline');
}

/**
 * WASM First: Long-term caching for WebAssembly modules
 * These rarely change and are expensive to download
 */
async function wasmFirst(request: Request): Promise<Response> {
  const cache = await caches.open(WASM_CACHE);
  const cachedResponse = await cache.match(request);
  
  if (cachedResponse) {
    console.log('[SW] Serving WASM from cache:', request.url);
    return cachedResponse;
  }
  
  try {
    console.log('[SW] Fetching WASM:', request.url);
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      // Cache with proper MIME type for WASM streaming compilation
      const response = networkResponse.clone();
      cache.put(request, response);
    }
    
    return networkResponse;
  } catch (error) {
    return createOfflineResponse('WASM module not available offline');
  }
}

// ============================================================================
// Request Classification
// ============================================================================

function isApiRequest(url: URL): boolean {
  return url.pathname.startsWith('/api/');
}

function isStaticAsset(url: URL): boolean {
  const staticExtensions = [
    '.js', '.css', '.woff', '.woff2', '.ttf', '.eot',
    '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.webp',
    '.map'
  ];
  
  return staticExtensions.some((ext) => url.pathname.endsWith(ext));
}

function isWasmAsset(url: URL): boolean {
  return url.pathname.endsWith('.wasm');
}

function isDocument(request: Request): boolean {
  return request.mode === 'navigate' || 
         request.headers.get('accept')?.includes('text/html') === true;
}

function createOfflineResponse(message: string): Response {
  return new Response(JSON.stringify({
    error: 'offline',
    message,
    timestamp: Date.now(),
  }), {
    status: 503,
    statusText: 'Service Unavailable',
    headers: {
      'Content-Type': 'application/json',
      'X-Offline': 'true',
    },
  });
}

async function safeCacheMatch(request: RequestInfo): Promise<Response | undefined> {
  try {
    return await caches.match(request);
  } catch (error) {
    console.warn('[SW] cache match skipped for unsupported request', error);
    return undefined;
  }
}

// ============================================================================
// Message Handling
// ============================================================================

self.addEventListener('message', (event) => {
  const { type, data } = event.data || {};
  
  switch (type) {
    case 'SKIP_WAITING':
      self.skipWaiting();
      break;
      
    case 'CLEAR_CACHES':
      event.waitUntil(
        caches.keys().then((names) => 
          Promise.all(names.map((name) => caches.delete(name)))
        ).then(() => {
          event.ports?.[0]?.postMessage({ success: true });
        })
      );
      break;
      
    case 'GET_CACHE_STATUS':
      event.waitUntil(
        getCacheStatus().then(status => {
          event.ports?.[0]?.postMessage(status);
        })
      );
      break;
      
    case 'QUEUE_OPERATION':
      event.waitUntil(
        queuePendingOperation(data).then(() => {
          event.ports?.[0]?.postMessage({ success: true });
        })
      );
      break;
      
    case 'PRECACHE_WASM':
      event.waitUntil(
        precacheWasm(data.urls).then(() => {
          event.ports?.[0]?.postMessage({ success: true });
        })
      );
      break;
  }
});

async function getCacheStatus(): Promise<{
  staticCount: number;
  dynamicCount: number;
  apiCount: number;
  wasmCount: number;
  pendingOps: number;
}> {
  const [staticKeys, dynamicKeys, apiKeys, wasmKeys] = await Promise.all([
    caches.open(STATIC_CACHE).then(c => c.keys()),
    caches.open(DYNAMIC_CACHE).then(c => c.keys()),
    caches.open(API_CACHE).then(c => c.keys()),
    caches.open(WASM_CACHE).then(c => c.keys()),
  ]);
  
  const pendingOps = await getPendingOperationCount();
  
  return {
    staticCount: staticKeys.length,
    dynamicCount: dynamicKeys.length,
    apiCount: apiKeys.length,
    wasmCount: wasmKeys.length,
    pendingOps,
  };
}

async function precacheWasm(urls: string[]): Promise<void> {
  const cache = await caches.open(WASM_CACHE);
  
  for (const url of urls) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        await cache.put(url, response);
        console.log('[SW] Precached WASM:', url);
      }
    } catch (e) {
      console.warn('[SW] Failed to precache WASM:', url, e);
    }
  }
}

// ============================================================================
// Background Sync
// ============================================================================

self.addEventListener('sync', (event) => {
  console.log('[SW] Background sync:', event.tag);
  
  if (event.tag === 'sync-pending-analyses') {
    event.waitUntil(syncPendingAnalyses());
  } else if (event.tag === 'sync-pending-saves') {
    event.waitUntil(syncPendingSaves());
  }
});

async function syncPendingAnalyses(): Promise<void> {
  console.log('[SW] Syncing pending analyses...');
  
  const operations = await getPendingOperations('analyze');
  
  for (const op of operations) {
    try {
      const response = await fetch('/api/analysis/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(op.data),
      });
      
      if (response.ok) {
        await removePendingOperation(op.id);
        
        // Notify clients of completion
        const result = await response.json();
        const clients = await self.clients.matchAll();
        clients.forEach(client => {
          client.postMessage({
            type: 'ANALYSIS_COMPLETE',
            operationId: op.id,
            result,
          });
        });
        
        console.log('[SW] Analysis synced:', op.id);
      } else if (op.retries < 3) {
        await updateOperationRetry(op.id);
      } else {
        await removePendingOperation(op.id);
        console.error('[SW] Analysis failed after 3 retries:', op.id);
      }
    } catch (error) {
      console.error('[SW] Sync failed for:', op.id, error);
    }
  }
}

async function syncPendingSaves(): Promise<void> {
  console.log('[SW] Syncing pending saves...');
  
  const operations = await getPendingOperations('save');
  
  for (const op of operations) {
    try {
      const response = await fetch('/api/projects/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(op.data),
      });
      
      if (response.ok) {
        await removePendingOperation(op.id);
        console.log('[SW] Save synced:', op.id);
      }
    } catch (error) {
      console.error('[SW] Save sync failed:', op.id, error);
    }
  }
}

// ============================================================================
// IndexedDB for Pending Operations
// ============================================================================

const PENDING_OPS_DB = 'PendingOperations';
const PENDING_OPS_STORE = 'operations';

function openPendingOpsDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(PENDING_OPS_DB, 1);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(PENDING_OPS_STORE)) {
        const store = db.createObjectStore(PENDING_OPS_STORE, { keyPath: 'id' });
        store.createIndex('type', 'type', { unique: false });
        store.createIndex('timestamp', 'timestamp', { unique: false });
      }
    };
  });
}

async function queuePendingOperation(data: Omit<PendingOperation, 'id' | 'timestamp' | 'retries'>): Promise<void> {
  const db = await openPendingOpsDB();
  const op: PendingOperation = {
    ...data,
    id: `op_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    timestamp: Date.now(),
    retries: 0,
  };
  
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(PENDING_OPS_STORE, 'readwrite');
    const store = tx.objectStore(PENDING_OPS_STORE);
    const request = store.add(op);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
  
  // Register for background sync
  if ('sync' in self.registration) {
    await (self.registration as any).sync.register(`sync-pending-${op.type}s`);
  }
}

async function getPendingOperations(type: string): Promise<PendingOperation[]> {
  const db = await openPendingOpsDB();
  
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PENDING_OPS_STORE, 'readonly');
    const store = tx.objectStore(PENDING_OPS_STORE);
    const index = store.index('type');
    const request = index.getAll(type);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

async function getPendingOperationCount(): Promise<number> {
  const db = await openPendingOpsDB();
  
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PENDING_OPS_STORE, 'readonly');
    const store = tx.objectStore(PENDING_OPS_STORE);
    const request = store.count();
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

async function removePendingOperation(id: string): Promise<void> {
  const db = await openPendingOpsDB();
  
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PENDING_OPS_STORE, 'readwrite');
    const store = tx.objectStore(PENDING_OPS_STORE);
    const request = store.delete(id);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

async function updateOperationRetry(id: string): Promise<void> {
  const db = await openPendingOpsDB();
  
  const tx = db.transaction(PENDING_OPS_STORE, 'readwrite');
  const store = tx.objectStore(PENDING_OPS_STORE);
  
  const op = await new Promise<PendingOperation>((resolve, reject) => {
    const request = store.get(id);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
  
  if (op) {
    op.retries++;
    await new Promise<void>((resolve, reject) => {
      const request = store.put(op);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }
}

// ============================================================================
// Push Notifications (for future implementation)
// ============================================================================

self.addEventListener('push', (event) => {
  if (!event.data) return;

  const data = event.data.json();
  
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/icons/icon-192x192.png',
      badge: '/icons/badge-72x72.png',
      data: data.url,
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  if (event.notification.data) {
    event.waitUntil(
      self.clients.openWindow(event.notification.data)
    );
  }
});

export {};
