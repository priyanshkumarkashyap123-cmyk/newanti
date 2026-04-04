/**
 * Library Barrel Export
 * Central export point for all utilities and hooks
 * 
 * @module lib
 */

// ============================================================================
// API & Networking
// ============================================================================

export { WebSocketManager, useWebSocket, ConnectionStatus, type ConnectionState } from './websocket';
export { cachedFetch, deduplicateRequest, MemoryCache, LocalStorageCache, CacheInvalidator, useCachedData, cache } from './cache';
export { performHealthCheck, useHealthCheck, useConnectionMonitor, HealthIndicator } from './health-check';

// API hooks from new implementation
export { apiClient, useQuery, useMutation, useApi, useCreate, useUpdate, useDelete, queryCache } from './apiHooks';

// ============================================================================
// Data Validation
// ============================================================================

export { 
  schemas,
  getValidationErrors,
  validateField,
  createUniqueValidator,
  createDebouncedValidator,
  type Coordinate,
  type MaterialProperties,
  type SectionProperties,
  type Node,
  type Member,
  type Load,
  type LoadCase,
  type LoadCombination,
  type Project,
  type AnalysisSettings,
} from './validation';

// ============================================================================
// State Management
// ============================================================================

export { 
  createMachine,
  useMachine,
  analysisMachine,
  useAnalysisWorkflow,
} from './stateMachine';

export {
  HistoryManager,
  useUndoRedo,
  createStructuralCommands,
  HistoryPanel,
  UndoRedoToolbar,
  type StructuralModel,
} from './undoRedo';

// ============================================================================
// Offline & Sync
// ============================================================================

export {
  SyncManager,
  OfflineDatabase,
  useSync,
  SyncStatus,
  type SyncItem,
  type SyncConflict,
  type SyncResult,
  type SyncOptions,
} from './offlineSync';

// ============================================================================
// Data Persistence
// ============================================================================

export {
  usePersistedState,
  useProjectPersistence,
  useAutoSave,
  type StorageOptions,
  type UsePersistedStateReturn,
  type Project as PersistedProject,
  type ProjectListItem,
  type UseProjectPersistenceReturn,
  type UseAutoSaveOptions,
} from './persistence';

// ============================================================================
// UI Utilities
// ============================================================================

export { 
  colors,
  spacing,
  typography,
  borderRadius,
  shadows,
  animation,
  breakpoints,
  zIndex,
  generateCSSVariables,
} from './design-tokens';

export {
  useKeyboardShortcut,
  useKeyboardShortcuts,
  useShortcutsHelp,
  ShortcutsDialog,
  defaultShortcuts,
} from './keyboard-shortcuts';

// ============================================================================
// Code Splitting
// ============================================================================

export {
  lazyWithPreload,
  createLazyComponent,
  createRoutes,
  prefetchOnIdle,
  usePrefetchOnVisible,
  Skeleton,
  PageSkeleton,
  CardSkeleton,
  TableRowSkeleton,
} from './codeSplitting';

// ============================================================================
// Service Worker / PWA
// ============================================================================

export {
  register as registerServiceWorker,
  unregister as unregisterServiceWorker,
  useServiceWorker,
  OfflineIndicator,
  UpdateBanner,
  clearAllCaches,
  getCacheStats,
  checkForUpdate,
} from './serviceWorker';

// ============================================================================
// Security
// ============================================================================

export { 
  escapeHtml,
  sanitizeInput,
  sanitizeUrl,
  generateNonce,
  generateCsrfToken,
  getCsrfToken,
  ensureCsrfToken,
  validatePasswordStrength,
  SecureStorage,
  secureStorage,
  isValidEmail,
  isSecureContext,
  maskSensitiveData,
  maskEmail,
} from './security';

// ============================================================================
// Feature Flags
// ============================================================================

export { 
  FeatureFlagsProvider,
  useFeatureFlags,
} from './featureFlags';

// ============================================================================
// Internationalization
// ============================================================================

export {
  I18nProvider,
  useTranslation,
  useLocale,
} from './i18n';

// ============================================================================
// Analytics
// ============================================================================

export {
  analytics,
  trackEvent,
  trackPageView,
  setUserProperties,
  initAnalytics,
  usePageTracking,
  getConsent,
  updateConsent,
  hasConsent,
  type AnalyticsEvent,
  type PageViewData,
  type UserProperties,
  type ConsentCategory,
  type ConsentPreferences,
} from './analytics';

// ============================================================================
// Environment
// ============================================================================

export { 
  env,
  isDev,
  isProd,
  isTest,
  getApiUrl,
  isFeatureEnabled,
  isDebug,
  getEnvInfo,
} from './env';

// ============================================================================
// Error Handling
// ============================================================================

export {
  ErrorBoundary,
  ErrorFallback,
  ErrorProvider,
  useErrorContext,
  categorizeError,
  safeAsync,
  APIError,
  InlineError,
} from './errorHandling';
