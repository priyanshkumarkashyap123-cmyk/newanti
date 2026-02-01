/**
 * Environment Configuration & Validation
 * 
 * Industry Standard: Type-safe environment variable access with validation
 * 
 * Prevents runtime errors from missing or invalid environment variables
 */

import { z } from 'zod';

// ============================================================================
// Environment Schema
// ============================================================================

/**
 * Define all environment variables with their types and validation
 */
const envSchema = z.object({
  // Mode
  MODE: z.enum(['development', 'production', 'test']).default('development'),
  DEV: z.boolean().default(false),
  PROD: z.boolean().default(false),
  
  // Vite variables
  BASE_URL: z.string().default('/'),
  
  // API Configuration
  VITE_API_URL: z.string().url().optional(),
  VITE_API_TIMEOUT: z.coerce.number().positive().default(30000),
  
  // Authentication (Clerk)
  VITE_CLERK_PUBLISHABLE_KEY: z.string().startsWith('pk_').optional(),
  
  // Feature Flags
  VITE_ENABLE_AI: z.coerce.boolean().default(true),
  VITE_ENABLE_3D: z.coerce.boolean().default(true),
  VITE_ENABLE_COLLAB: z.coerce.boolean().default(false),
  
  // Analytics & Monitoring
  VITE_SENTRY_DSN: z.string().url().optional(),
  VITE_SENTRY_ENVIRONMENT: z.string().default('development'),
  VITE_GA_TRACKING_ID: z.string().optional(),
  
  // Debug
  VITE_DEBUG: z.coerce.boolean().default(false),
  VITE_LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
});

type EnvConfig = z.infer<typeof envSchema>;

// ============================================================================
// Environment Parsing
// ============================================================================

/**
 * Parse and validate environment variables
 */
function parseEnv(): EnvConfig {
  // In browser, Vite exposes env vars via import.meta.env
  const raw = {
    MODE: import.meta.env.MODE,
    DEV: import.meta.env.DEV,
    PROD: import.meta.env.PROD,
    BASE_URL: import.meta.env.BASE_URL,
    VITE_API_URL: import.meta.env.VITE_API_URL,
    VITE_API_TIMEOUT: import.meta.env.VITE_API_TIMEOUT,
    VITE_CLERK_PUBLISHABLE_KEY: import.meta.env.VITE_CLERK_PUBLISHABLE_KEY,
    VITE_ENABLE_AI: import.meta.env.VITE_ENABLE_AI,
    VITE_ENABLE_3D: import.meta.env.VITE_ENABLE_3D,
    VITE_ENABLE_COLLAB: import.meta.env.VITE_ENABLE_COLLAB,
    VITE_SENTRY_DSN: import.meta.env.VITE_SENTRY_DSN,
    VITE_SENTRY_ENVIRONMENT: import.meta.env.VITE_SENTRY_ENVIRONMENT,
    VITE_GA_TRACKING_ID: import.meta.env.VITE_GA_TRACKING_ID,
    VITE_DEBUG: import.meta.env.VITE_DEBUG,
    VITE_LOG_LEVEL: import.meta.env.VITE_LOG_LEVEL,
  };

  const result = envSchema.safeParse(raw);

  if (!result.success) {
    console.error('❌ Invalid environment configuration:');
    result.error.issues.forEach((issue) => {
      console.error(`  - ${issue.path.join('.')}: ${issue.message}`);
    });
    
    // In development, show helpful message
    if (import.meta.env.DEV) {
      console.error('\nMake sure you have a .env.local file with the required variables.');
      console.error('See .env.example for reference.\n');
    }
    
    // Return defaults for graceful degradation
    return envSchema.parse({});
  }

  return result.data;
}

// ============================================================================
// Singleton Export
// ============================================================================

/**
 * Validated environment configuration
 */
export const env = parseEnv();

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Check if we're in development mode
 */
export function isDev(): boolean {
  return env.DEV || env.MODE === 'development';
}

/**
 * Check if we're in production mode
 */
export function isProd(): boolean {
  return env.PROD || env.MODE === 'production';
}

/**
 * Check if we're in test mode
 */
export function isTest(): boolean {
  return env.MODE === 'test';
}

/**
 * Get API base URL
 */
export function getApiUrl(): string {
  return env.VITE_API_URL || (isDev() ? 'http://localhost:3001' : '/api');
}

/**
 * Check if feature is enabled
 */
export function isFeatureEnabled(feature: 'ai' | '3d' | 'collab'): boolean {
  switch (feature) {
    case 'ai':
      return env.VITE_ENABLE_AI;
    case '3d':
      return env.VITE_ENABLE_3D;
    case 'collab':
      return env.VITE_ENABLE_COLLAB;
    default:
      return false;
  }
}

/**
 * Check if debug mode is enabled
 */
export function isDebug(): boolean {
  return env.VITE_DEBUG || isDev();
}

// ============================================================================
// Environment Display (for debugging)
// ============================================================================

/**
 * Get sanitized environment info for debugging
 * (Removes sensitive values)
 */
export function getEnvInfo(): Record<string, unknown> {
  return {
    mode: env.MODE,
    isDev: isDev(),
    isProd: isProd(),
    apiUrl: getApiUrl(),
    features: {
      ai: isFeatureEnabled('ai'),
      '3d': isFeatureEnabled('3d'),
      collab: isFeatureEnabled('collab'),
    },
    hasClerk: !!env.VITE_CLERK_PUBLISHABLE_KEY,
    hasSentry: !!env.VITE_SENTRY_DSN,
    logLevel: env.VITE_LOG_LEVEL,
  };
}

/**
 * Log environment info in development
 */
export function logEnvInfo(): void {
  if (isDev()) {
    console.group('🔧 Environment Configuration');
    console.table(getEnvInfo());
    console.groupEnd();
  }
}
