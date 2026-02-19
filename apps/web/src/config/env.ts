/**
 * ============================================================================
 * ENVIRONMENT CONFIGURATION
 * ============================================================================
 * 
 * Centralized environment variable management with type safety and defaults.
 * All environment access should go through this module.
 * 
 * @version 2.0.0
 */

/**
 * Validates and returns environment variable with fallback
 */
function getEnv(key: string, fallback: string = ''): string {
    const value = import.meta.env[key];
    if (value === undefined && !fallback && import.meta.env.DEV) {
        console.warn(`⚠️ Environment variable ${key} is not set. Using fallback: "${fallback}"`);
    }
    return value ?? fallback;
}

/**
 * Get boolean environment variable
 */
function getBoolEnv(key: string, fallback: boolean = false): boolean {
    const value = import.meta.env[key];
    if (value === undefined) return fallback;
    return value === 'true' || value === '1';
}

/**
 * Get numeric environment variable
 */
function getNumEnv(key: string, fallback: number): number {
    const value = import.meta.env[key];
    if (value === undefined) return fallback;
    const num = parseInt(value, 10);
    return isNaN(num) ? fallback : num;
}

// ============================================
// AUTHENTICATION
// ============================================
export const AUTH_CONFIG = {
    clerkPublishableKey: getEnv('VITE_CLERK_PUBLISHABLE_KEY'),
    isClerkEnabled: Boolean(import.meta.env.VITE_CLERK_PUBLISHABLE_KEY),
} as const;

// ============================================
// API ENDPOINTS
// ============================================
export const API_CONFIG = {
    // Main backend (Node.js/Express)
    baseUrl: getEnv('VITE_API_URL',
        import.meta.env.PROD
            ? 'https://api.beamlabultimate.tech'
            : 'http://localhost:3001'
    ),

    // Python API (FastAPI)
    pythonUrl: getEnv('VITE_PYTHON_API_URL',
        import.meta.env.PROD
            ? 'https://beamlab-backend-python.azurewebsites.net'
            : 'http://localhost:8081'
    ),

    // Rust API (High-performance analysis)
    rustUrl: getEnv('VITE_RUST_API_URL',
        import.meta.env.PROD
            ? 'https://beamlab-rust-api.azurewebsites.net'
            : 'http://localhost:3002'
    ),

    timeout: getNumEnv('VITE_API_TIMEOUT', 30000),

    // WebSocket URL (derived from Python URL for analysis progress)
    wsUrl: getEnv('VITE_WEBSOCKET_URL', (() => {
        const pythonUrl = getEnv('VITE_PYTHON_API_URL',
            import.meta.env.PROD
                ? 'https://beamlab-backend-python.azurewebsites.net'
                : 'http://localhost:8081'
        );
        return pythonUrl.replace('http://', 'ws://').replace('https://', 'wss://') + '/ws';
    })()),
} as const;

// ============================================
// MONITORING
// ============================================
export const MONITORING_CONFIG = {
    sentryDsn: getEnv('VITE_SENTRY_DSN'),
    isSentryEnabled: Boolean(import.meta.env.VITE_SENTRY_DSN),
    debug: getBoolEnv('VITE_DEBUG', false),
} as const;

// ============================================
// FEATURE FLAGS
// ============================================
export const FEATURES = {
    webgpu: getBoolEnv('VITE_ENABLE_WEBGPU', true),
    collaboration: getBoolEnv('VITE_ENABLE_COLLABORATION', false),
    ai: getBoolEnv('VITE_ENABLE_AI_FEATURES', true),
    sourceMaps: getBoolEnv('VITE_SOURCE_MAPS', import.meta.env.DEV),
} as const;

// ============================================
// PAYMENT
// ============================================
export const PAYMENT_CONFIG = {
    razorpayKeyId: getEnv('VITE_RAZORPAY_KEY_ID'),
    isPaymentEnabled: Boolean(import.meta.env.VITE_RAZORPAY_KEY_ID),
} as const;

// ============================================
// PERFORMANCE
// ============================================
export const PERFORMANCE_CONFIG = {
    maxWorkers: getNumEnv('VITE_MAX_WORKERS', navigator.hardwareConcurrency || 4),
    enablePreload: !import.meta.env.DEV, // Disable preload in dev for faster HMR
} as const;

// ============================================
// APPLICATION
// ============================================
export const APP_ENV = {
    mode: import.meta.env.MODE,
    isDev: import.meta.env.DEV,
    isProd: import.meta.env.PROD,
    baseUrl: import.meta.env.BASE_URL,
} as const;

// ============================================
// VALIDATION
// ============================================
/**
 * Validates critical environment variables on app startup
 * @throws Error if critical variables are missing in production
 */
export function validateEnvironment(): void {
    const errors: string[] = [];

    // Critical checks for production
    if (APP_ENV.isProd) {
        if (!AUTH_CONFIG.clerkPublishableKey) {
            errors.push('VITE_CLERK_PUBLISHABLE_KEY is not configured. Authentication features will not work.');
            console.warn('[Auth] ⚠️ VITE_CLERK_PUBLISHABLE_KEY is not configured. Authentication features may not work.');
        }

        if (!API_CONFIG.baseUrl.startsWith('https://')) {
            errors.push(`VITE_API_URL is not using HTTPS in production. Current value: ${API_CONFIG.baseUrl}`);
            console.error('[API] 🔴 VITE_API_URL is not using HTTPS in production. API calls may fail. Current value:', API_CONFIG.baseUrl);
        }
    }

    if (errors.length > 0) {
        throw new Error(
            `❌ Environment Configuration Error:\n${errors.map(e => `  - ${e}`).join('\n')}`
        );
    }

    // Log configuration in development
    if (APP_ENV.isDev && MONITORING_CONFIG.debug) {
        console.log('🔧 Environment Configuration:', {
            mode: APP_ENV.mode,
            api: API_CONFIG.baseUrl,
            pythonApi: API_CONFIG.pythonUrl,
            features: FEATURES,
        });
    }
}

// Export everything as default for convenient access
export default {
    auth: AUTH_CONFIG,
    api: API_CONFIG,
    monitoring: MONITORING_CONFIG,
    features: FEATURES,
    payment: PAYMENT_CONFIG,
    performance: PERFORMANCE_CONFIG,
    app: APP_ENV,
    validate: validateEnvironment,
} as const;
