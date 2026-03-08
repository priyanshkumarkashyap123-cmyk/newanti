# BeamLab Frontend Integration Utilities - Developer Guide

**Version:** 2.0.0  
**Last Updated:** March 8, 2026

This guide covers all frontend integration utilities created during the 8-phase enhancement project.

---

## Table of Contents

1. [Error Handling](#error-handling)
2. [Loading States](#loading-states)
3. [Performance Monitoring](#performance-monitoring)
4. [Offline Capabilities](#offline-capabilities)
5. [Monitoring & Observability](#monitoring--observability)
6. [Security Utilities](#security-utilities)
7. [Testing Utilities](#testing-utilities)
8. [API Documentation](#api-documentation)

---

## Error Handling

**File:** `apps/web/src/lib/api/errorMessages.ts`

### Overview
Provides user-friendly error messages for API errors, replacing cryptic error codes with actionable messages.

### Key Functions

#### `getUserFriendlyError(code, status, originalMessage)`
Maps error codes to user-friendly messages with recovery actions.

```typescript
import { getUserFriendlyError } from '@/lib/api/errorMessages';

try {
  await apiClient.post('/analyze', modelData);
} catch (error) {
  const friendlyError = getUserFriendlyError(
    error.code,        // e.g., 'NETWORK_ERROR'
    error.status,      // e.g., 500
    error.message      // Original error message
  );

  // Display to user
  toast.error(friendlyError.title, {
    description: friendlyError.message,
    action: friendlyError.action
  });
}
```

#### `isRetryableError(category)`
Check if an error should allow retry attempts.

```typescript
if (isRetryableError(error.category)) {
  showRetryButton();
}
```

#### `requiresAuth(category)`
Check if error requires re-authentication.

```typescript
if (requiresAuth(error.category)) {
  redirectToLogin();
}
```

### Error Categories

| Category | Description | Retryable | Example |
|----------|-------------|-----------|---------|
| `network` | Network issues | ✅ Yes | Connection timeout, offline |
| `authentication` | Auth failures | ❌ No | Invalid token, expired session |
| `authorization` | Permission denied | ❌ No | Insufficient permissions |
| `validation` | Invalid input | ❌ No | Missing required fields |
| `server` | Server errors | ✅ Yes | 500 errors, database issues |
| `client` | Client errors | ❌ No | 404, 400 errors |
| `timeout` | Request timeout | ✅ Yes | Slow network, heavy computation |

### All Error Codes

```typescript
NETWORK_ERROR       // Network connectivity issues
TIMEOUT_ERROR       // Request took too long
UNAUTHORIZED        // Not logged in
FORBIDDEN           // Insufficient permissions
NOT_FOUND           // Resource doesn't exist
VALIDATION_ERROR    // Input validation failed
RATE_LIMIT_EXCEEDED // Too many requests
SERVER_ERROR        // 500+ errors
UNKNOWN_ERROR       // Unhandled errors
```

---

## Loading States

**File:** `apps/web/src/hooks/useLoadingState.ts`

### Overview
Advanced loading state management with timeout detection, progress tracking, and multi-operation support.

### `useLoadingState()` Hook

Full-featured loading state with multiple operations.

```typescript
import { useLoadingState } from '@/hooks/useLoadingState';

function AnalysisPage() {
  const {
    isLoading,        // Is anything loading?
    operation,        // Current operation name
    progress,         // Progress percentage (0-100)
    timedOut,         // Did it timeout?
    error,            // Error if any
    wrap,             // Wrap async functions
    setProgress,      // Manually set progress
    reset             // Reset state
  } = useLoadingState({
    minDisplayTime: 300,   // Minimum loading spinner duration (ms)
    timeout: 30000,        // Auto-timeout after 30s
    onTimeout: () => {     // Timeout callback
      console.error('Operation timed out');
    }
  });

  const runAnalysis = () => wrap('structural-analysis', async () => {
    setProgress(10);
    const validation = await validateModel();
    setProgress(50);
    const results = await performAnalysis();
    setProgress(90);
    return results;
  });

  return (
    <div>
      {isLoading && (
        <LoadingOverlay>
          {operation === 'structural-analysis' && 'Running structural analysis...'}
          {progress > 0 && <ProgressBar value={progress} />}
        </LoadingOverlay>
      )}
      {timedOut && <Alert>Operation timed out. Please try again.</Alert>}
      <button onClick={runAnalysis}>Run Analysis</button>
    </div>
  );
}
```

### `useSimpleLoading()` Hook

Simplified loading state for single operations.

```typescript
import { useSimpleLoading } from '@/hooks/useLoadingState';

function SaveButton() {
  const [isLoading, wrapLoading] = useSimpleLoading();

  const handleSave = () => wrapLoading(async () => {
    await saveModel();
  });

  return (
    <Button onClick={handleSave} disabled={isLoading}>
      {isLoading ? 'Saving...' : 'Save'}
    </Button>
  );
}
```

### Features

- ✅ **Prevents UI flashing** — Minimum display time ensures spinners don't flash
- ✅ **Timeout detection** — Automatically detect hung operations
- ✅ **Progress tracking** — Show progress for long operations
- ✅ **Multi-operation** — Track multiple concurrent operations
- ✅ **Error handling** — Automatic error state management

---

## Performance Monitoring

**File:** `apps/web/src/lib/performance.ts`

### Overview
Track Core Web Vitals, component performance, and enforce performance budgets.

### Core Web Vitals

```typescript
import { trackWebVitals } from '@/lib/performance';

// Track all Core Web Vitals
trackWebVitals(({ name, value, rating, delta }) => {
  console.log(`${name}: ${value}ms (${rating})`);
  
  // Send to analytics
  analytics.track('web_vital', {
    metric: name,
    value,
    rating,
    delta
  });
});
```

**Metrics tracked:**
- **LCP** (Largest Contentful Paint) — Target: <2.5s
- **FID** (First Input Delay) — Target: <100ms
- **CLS** (Cumulative Layout Shift) — Target: <0.1
- **FCP** (First Contentful Paint) — Target: <1.8s
- **TTFB** (Time to First Byte) — Target: <600ms
- **INP** (Interaction to Next Paint) — Target: <200ms

### Component Render Profiling

```typescript
import { measureRenderTime } from '@/lib/performance';

function ExpensiveComponent() {
  React.useEffect(() => {
    const stop = measureRenderTime('ExpensiveComponent', (duration) => {
      if (duration > 16) { // More than 1 frame (60fps)
        console.warn(`Component took ${duration}ms to render`);
      }
    });
    
    return stop;
  }, []);

  return <div>...</div>;
}
```

### API Call Tracking

```typescript
import { trackApiCall } from '@/lib/performance';

async function fetchData() {
  const start = performance.now();
  const response = await fetch('/api/analyze');
  const duration = performance.now() - start;
  
  trackApiCall('/api/analyze', duration, response.status);
  
  return response.json();
}
```

### Performance Budgets

```typescript
import { checkPerformanceBudgets } from '@/lib/performance';

// Automatically checks:
// - JavaScript bundle size < 500KB
// - CSS bundle size < 100KB
// - Image sizes < 200KB
const issues = await checkPerformanceBudgets();

if (issues.length > 0) {
  console.warn('Performance budget exceeded:', issues);
}
```

### Lazy Loading

```typescript
import { lazyLoad } from '@/lib/performance';

const HeavyComponent = lazyLoad(() => import('./HeavyComponent'), {
  threshold: 0.1,  // Load when 10% visible
  rootMargin: '50px' // Load 50px before visible
});
```

### Network Adaptation

```typescript
import { getNetworkQuality, getAdaptiveQuality } from '@/lib/performance';

const networkQuality = getNetworkQuality(); // 'high' | 'medium' | 'low'

// Adapt features based on network
const quality = getAdaptiveQuality({
  high: { resolution: '4k', fps: 60 },
  medium: { resolution: '1080p', fps: 30 },
  low: { resolution: '720p', fps: 15 }
});
```

---

## Offline Capabilities

**File:** `apps/web/src/lib/offline.ts`

### Overview
PWA features including offline storage, network detection, and background sync.

### Network Status Monitoring

```typescript
import { createNetworkObserver } from '@/lib/offline';

const networkObserver = createNetworkObserver();

// Subscribe to network changes
const unsubscribe = networkObserver.subscribe((status) => {
  switch (status) {
    case 'online':
      showToast('You are back online');
      syncPendingChanges();
      break;
    case 'offline':
      showToast('You are offline. Changes will sync when back online.');
      break;
    case 'slow':
      showToast('Slow connection detected. Some features may be limited.');
      break;
  }
});

// Get current status
const isOnline = networkObserver.isOnline();
const isSlow = networkObserver.isSlow();

// Cleanup
unsubscribe();
```

### Offline Storage (IndexedDB)

```typescript
import { OfflineStorage } from '@/lib/offline';

const storage = new OfflineStorage('beamlab-offline', 1);

// Initialize
await storage.init();

// Save analysis result for offline access
await storage.saveAnalysisResult({
  id: 'analysis-123',
  model: modelData,
  results: analysisResults,
  timestamp: Date.now()
});

// Get offline results
const results = await storage.getAnalysisResult('analysis-123');

// List all offline analyses
const allResults = await storage.getAllAnalysisResults();

// Clear old data (older than 7 days)
await storage.clearOldData(7);

// Get storage usage
const quota = await storage.getStorageQuota();
console.log(`Using ${quota.usedMB}MB of ${quota.quotaMB}MB`);
```

### Service Worker

```typescript
import { registerServiceWorker } from '@/lib/offline';

// Register service worker
if ('serviceWorker' in navigator) {
  await registerServiceWorker('/sw.js', {
    onUpdate: (registration) => {
      showToast('New version available! Refresh to update.');
    },
    onError: (error) => {
      console.error('Service worker error:', error);
    }
  });
}
```

### Background Sync

```typescript
import { queueBackgroundSync, processBackgroundSync } from '@/lib/offline';

// Queue a task for background sync
await queueBackgroundSync({
  id: 'save-model-123',
  action: 'saveModel',
  data: modelData,
  timestamp: Date.now()
});

// Process queued tasks when online
networkObserver.subscribe(async (status) => {
  if (status === 'online') {
    await processBackgroundSync(async (task) => {
      switch (task.action) {
        case 'saveModel':
          await apiClient.post('/models', task.data);
          break;
      }
    });
  }
});
```

---

## Monitoring & Observability

**File:** `apps/web/src/lib/monitoring.ts`

### Overview
Production monitoring with Sentry integration, custom metrics, and health checks.

### Initialize Monitoring

```typescript
import { initializeMonitoring } from '@/lib/monitoring';

// Initialize on app startup
initializeMonitoring({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  environment: import.meta.env.MODE, // 'development' | 'production'
  release: import.meta.env.VITE_APP_VERSION,
  tracesSampleRate: 0.1, // 10% of transactions
  debug: import.meta.env.MODE === 'development'
});
```

### Error Tracking

```typescript
import { captureException, captureMessage, addBreadcrumb } from '@/lib/monitoring';

// Capture exceptions
try {
  await dangerousOperation();
} catch (error) {
  captureException(error, {
    tags: { component: 'AnalysisEngine' },
    extra: { modelId: model.id }
  });
}

// Capture messages
captureMessage('User attempted unauthorized action', 'warning', {
  userId: user.id,
  action: 'delete-project'
});

// Add breadcrumbs for debugging
addBreadcrumb({
  category: 'user-action',
  message: 'User clicked analyze button',
  level: 'info',
  data: { modelId: model.id }
});
```

### Custom Metrics

```typescript
import { trackMetric, trackApiCall, trackAnalysis } from '@/lib/monitoring';

// Track custom metrics
trackMetric('model_size', modelData.nodes.length + modelData.members.length);
trackMetric('user_active_time', sessionDuration);

// Track API calls
trackApiCall('/api/analyze', responseDuration, responseStatus);

// Track analysis operations
trackAnalysis({
  type: 'linear-static',
  nodeCount: model.nodes.length,
  memberCount: model.members.length,
  duration: analysisTime,
  success: true
});
```

### User Context

```typescript
import { setUserContext } from '@/lib/monitoring';

// Set user context for error tracking
setUserContext({
  id: user.id,
  email: user.email,
  subscription: user.subscription,
  role: user.role
});
```

### Health Checks

```typescript
import { runHealthChecks } from '@/lib/monitoring';

// Run comprehensive health checks
const health = await runHealthChecks();

console.log({
  api: health.api,           // Can reach API?
  indexedDB: health.indexedDB, // IndexedDB working?
  localStorage: health.localStorage, // LocalStorage available?
  memory: health.memory      // Memory usage OK?
});
```

---

## Security Utilities

**File:** `apps/web/src/lib/security.ts`

### Overview
Security hardening utilities including input sanitization, CSRF protection, and GDPR compliance.

### Input Sanitization

```typescript
import { sanitizeHTML, sanitizeInput, sanitizeFilename } from '@/lib/security';

// Sanitize HTML (prevent XSS)
const cleanHTML = sanitizeHTML(userInput);
document.getElementById('content').innerHTML = cleanHTML;

// Sanitize general input
const cleanInput = sanitizeInput(userText);
await saveToDatabase(cleanInput);

// Sanitize filenames
const safeFilename = sanitizeFilename('user file<>.txt'); // 'user-file.txt'
```

### Validation

```typescript
import { isValidEmail, isValidUrl } from '@/lib/security';

// Email validation
if (!isValidEmail(email)) {
  showError('Invalid email address');
}

// URL validation
if (!isValidUrl(website)) {
  showError('Invalid website URL');
}
```

### Secure Storage

```typescript
import { secureStorage } from '@/lib/security';

// Encrypted storage wrapper
await secureStorage.setItem('api_key', sensitiveData);
const data = await secureStorage.getItem('api_key');
await secureStorage.removeItem('api_key');
await secureStorage.clear();
```

### CSRF Protection

```typescript
import { generateCSRFToken, validateCSRFToken } from '@/lib/security';

// Generate token
const token = generateCSRFToken();

// Include in forms
<form>
  <input type="hidden" name="csrf_token" value={token} />
  ...
</form>

// Validate on submission
if (!validateCSRFToken(formData.csrf_token)) {
  throw new Error('CSRF validation failed');
}
```

### Rate Limiting

```typescript
import { RateLimiter } from '@/lib/security';

// Create rate limiter (5 requests per minute)
const limiter = new RateLimiter(5, 60000);

function handleAction() {
  if (!limiter.isAllowed(userId)) {
    showError('Rate limit exceeded. Please wait before trying again.');
    return;
  }
  
  // Perform action
  processRequest();
}

// Reset user's limit
limiter.reset(userId);
```

### Password Strength

```typescript
import { checkPasswordStrength } from '@/lib/security';

const { score, feedback } = checkPasswordStrength(password);

// Score: 0 (very weak) to 4 (very strong)
if (score < 3) {
  showError('Password too weak');
  showSuggestions(feedback); // Array of improvement suggestions
}
```

### GDPR Compliance

```typescript
import { exportUserData, requestDataDeletion } from '@/lib/security';

// Export user data
const userData = await exportUserData(userId);
downloadFile('my-data.json', userData);

// Request data deletion
await requestDataDeletion(userId);
showNotification('Your data deletion request has been submitted');
```

---

## Testing Utilities

**File:** `apps/web/src/lib/testing.ts`

### Overview
Comprehensive testing utilities for unit, integration, contract, load, and E2E tests.

### API Mocking

```typescript
import { MockApiClient } from '@/lib/testing';

// Create mock API
const mockApi = new MockApiClient({
  baseUrl: 'http://localhost:3001'
});

// Mock specific endpoints
mockApi.mock('/api/analyze', {
  success: true,
  displacements: [{ nodeId: 'N1', dx: 0, dy: 0.5, dz: 0 }],
  forces: []
});

// Mock with delay
mockApi.mock('/api/slow-endpoint', data, { delay: 1000 });

// Mock with error
mockApi.mock('/api/error', null, { error: new Error('Analysis failed') });

// Use in tests
const response = await mockApi.post('/api/analyze', modelData);
```

### Test Data Factories

```typescript
import { createTestModel, createTestUser, createTestAnalysisResult } from '@/lib/testing';

// Generate test models
const simpleModel = createTestModel({ nodeCount: 4, memberCount: 3 });
const complexModel = createTestModel({ nodeCount: 100, memberCount: 99 });

// Generate test users
const basicUser = createTestUser({ subscription: 'free' });
const proUser = createTestUser({ subscription: 'pro', credits: 1000 });

// Generate test results
const result = createTestAnalysisResult({
  nodeCount: model.nodes.length,
  success: true
});
```

### Contract Testing

```typescript
import { validateContract, validateSchema } from '@/lib/testing';

// Validate API contract
const isValid = await validateContract({
  endpoint: '/api/analyze',
  method: 'POST',
  expectedStatus: 200,
  expectedSchema: {
    type: 'object',
    properties: {
      success: { type: 'boolean' },
      displacements: { type: 'array' }
    },
    required: ['success', 'displacements']
  }
});

// Validate response schema
const schemaValid = validateSchema(response, schema);
if (!schemaValid) {
  throw new Error('Response does not match expected schema');
}
```

### Load Testing

```typescript
import { runLoadTest } from '@/lib/testing';

// Run load test
const results = await runLoadTest({
  endpoint: '/api/analyze',
  method: 'POST',
  body: modelData,
  duration: 60,      // Run for 60 seconds
  rps: 10,           // 10 requests per second
  headers: { Authorization: `Bearer ${token}` }
});

console.log('Load Test Results:', {
  totalRequests: results.totalRequests,
  successRate: results.successRate,
  errorRate: results.errorRate,
  avgLatency: results.avgLatency,
  p50: results.p50,  // 50th percentile
  p95: results.p95,  // 95th percentile
  p99: results.p99   // 99th percentile
});
```

### Snapshot Testing

```typescript
import { createSnapshot, compareSnapshot } from '@/lib/testing';

// Create snapshot
await createSnapshot('analysis-result', analysisResult);

// Compare with existing snapshot
const { matches, diff } = await compareSnapshot('analysis-result', currentResult);

if (!matches) {
  console.log('Differences:', diff);
}
```

### E2E Helpers

```typescript
import { waitForElement, waitFor, simulateInput, simulateClick } from '@/lib/testing';

// Wait for element
const button = await waitForElement('[data-testid="analyze-button"]');

// Wait for condition
await waitFor(() => analysisComplete, { timeout: 10000 });

// Simulate user input
await simulateInput(inputEl, 'Node 1');

// Simulate click
await simulateClick(buttonEl);
```

---

## API Documentation

**File:** `apps/web/src/lib/api/documentation.ts`

### Overview
Generate OpenAPI 3.0 specifications for all BeamLab APIs.

### Generate API Spec

```typescript
import { generateBeamLabAPISpec, exportOpenAPIJSON } from '@/lib/api/documentation';

// Generate full API specification
const spec = generateBeamLabAPISpec();

// Export as JSON
const json = exportOpenAPIJSON();
console.log(json);

// Save to file
import fs from 'fs';
fs.writeFileSync('openapi.json', json);
```

### View Specification

The generated specification includes:

- **OpenAPI Version:** 3.0.0
- **Servers:** Development (localhost:3001) and Production (Azure)
- **Authentication:** Bearer tokens and Clerk auth
- **Endpoints:** All BeamLab API endpoints with full documentation
- **Schemas:** Request/response models with validation rules
- **Examples:** Sample requests and responses

### Swagger UI Integration

```typescript
// Serve the API documentation
import SwaggerUI from 'swagger-ui-react';
import { generateBeamLabAPISpec } from '@/lib/api/documentation';

function APIDocumentation() {
  const spec = generateBeamLabAPISpec();
  
  return <SwaggerUI spec={spec} />;
}
```

---

## Best Practices

### 1. Error Handling
```typescript
// ❌ Bad
try {
  await apiClient.post('/analyze', data);
} catch (error) {
  alert(error.message); // Cryptic error
}

// ✅ Good
try {
  await apiClient.post('/analyze', data);
} catch (error) {
  const friendly = getUserFriendlyError(error.code, error.status, error.message);
  toast.error(friendly.title, { description: friendly.message });
  
  if (isRetryableError(friendly.category)) {
    showRetryButton();
  }
}
```

### 2. Loading States
```typescript
// ❌ Bad
const [loading, setLoading] = useState(false);

const analyze = async () => {
  setLoading(true);
  await apiClient.post('/analyze', data);
  setLoading(false); // Might flash
};

// ✅ Good
const { isLoading, wrap } = useLoadingState({ minDisplayTime: 300 });

const analyze = () => wrap('analysis', async () => {
  return await apiClient.post('/analyze', data);
});
```

### 3. Performance
```typescript
// ❌ Bad
const HeavyComponent = () => import('./HeavyComponent');

// ✅ Good
const HeavyComponent = lazyLoad(() => import('./HeavyComponent'), {
  threshold: 0.1,
  rootMargin: '50px'
});
```

### 4. Security
```typescript
// ❌ Bad
element.innerHTML = userInput;

// ✅ Good
element.innerHTML = sanitizeHTML(userInput);
```

### 5. Testing
```typescript
// ❌ Bad
test('API call', async () => {
  const result = await fetch('/api/analyze');
  expect(result.success).toBe(true);
});

// ✅ Good
test('API call', async () => {
  const mockApi = new MockApiClient({ baseUrl: 'http://localhost' });
  mockApi.mock('/api/analyze', { success: true });
  
  const result = await mockApi.post('/api/analyze', data);
  expect(result.success).toBe(true);
  expect(validateSchema(result, schema)).toBe(true);
});
```

---

## Migration Guide

### Migrating Existing Code

#### Step 1: Update Error Handling
```typescript
// Before
catch (error) {
  showError(error.message);
}

// After
import { getUserFriendlyError } from '@/lib/api/errorMessages';

catch (error) {
  const friendly = getUserFriendlyError(error.code, error.status, error.message);
  showError(friendly.title, friendly.message);
}
```

#### Step 2: Replace Loading States
```typescript
// Before
const [loading, setLoading] = useState(false);

// After
import { useSimpleLoading } from '@/hooks/useLoadingState';
const [loading, wrapLoading] = useSimpleLoading();
```

#### Step 3: Add Performance Tracking
```typescript
// Before
function MyComponent() {
  return <div>...</div>;
}

// After
import { measureRenderTime } from '@/lib/performance';

function MyComponent() {
  useEffect(() => {
    const stop = measureRenderTime('MyComponent');
    return stop;
  }, []);
  
  return <div>...</div>;
}
```

#### Step 4: Add Security
```typescript
// Before
const email = userInput;

// After
import { sanitizeInput, isValidEmail } from '@/lib/security';

const email = sanitizeInput(userInput);
if (!isValidEmail(email)) {
  throw new Error('Invalid email');
}
```

---

## Troubleshooting

### Common Issues

#### 1. "Sentry not initialized"
```typescript
// Ensure you call initializeMonitoring on app startup
import { initializeMonitoring } from '@/lib/monitoring';

initializeMonitoring({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  environment: import.meta.env.MODE
});
```

#### 2. "IndexedDB not available"
```typescript
// Check browser support
if ('indexedDB' in window) {
  const storage = new OfflineStorage();
  await storage.init();
} else {
  // Fallback to localStorage or show warning
}
```

#### 3. "Service Worker registration failed"
```typescript
// Ensure sw.js exists and HTTPS is enabled (required in production)
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  await registerServiceWorker('/sw.js');
}
```

---

## Support

For questions or issues with these utilities:

1. Check the documentation above
2. Review [INTEGRATION_AUDIT_REPORT.md](INTEGRATION_AUDIT_REPORT.md)
3. See [FRONTEND_BACKEND_INTEGRATION_COMPLETE.md](FRONTEND_BACKEND_INTEGRATION_COMPLETE.md)
4. Contact the development team

---

**Last Updated:** March 8, 2026  
**Version:** 2.0.0  
**Status:** Production Ready
