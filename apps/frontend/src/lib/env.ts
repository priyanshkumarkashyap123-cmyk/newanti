/**
 * lib/env.ts — Environment utilities re-exported from config/env.
 *
 * This module provides the named helpers expected by lib/index.ts and anywhere
 * else in the app that imports from '@/lib'.  It is a thin bridge — all real
 * config lives in src/config/env.ts.
 */

import envConfig, {
  APP_ENV,
  API_CONFIG,
  FEATURES,
  MONITORING_CONFIG,
} from '../config/env';

/** The full environment config object */
export const env = envConfig;

/** True when running in development mode (Vite DEV flag) */
export const isDev: boolean = APP_ENV.isDev;

/** True when running in production mode (Vite PROD flag) */
export const isProd: boolean = APP_ENV.isProd;

/** True when running inside a test runner (Vitest sets import.meta.env.MODE = 'test') */
export const isTest: boolean = APP_ENV.mode === 'test';

/**
 * Returns the resolved API base URL, removing any trailing slash.
 * Prefer using `API_CONFIG.baseUrl` directly when you have a specific endpoint.
 */
export function getApiUrl(): string {
  return API_CONFIG.baseUrl.replace(/\/$/, '');
}

/**
 * Checks whether a named feature flag is enabled.
 * @example isFeatureEnabled('enableWebGPU')
 */
export function isFeatureEnabled(flag: keyof typeof FEATURES): boolean {
  return Boolean(FEATURES[flag]);
}

/** True when debug logging is enabled */
export const isDebug: boolean = Boolean(MONITORING_CONFIG.debug);

/**
 * Returns a human-readable summary of the current environment config.
 * Safe to log — does not include secrets.
 */
export function getEnvInfo(): Record<string, unknown> {
  return {
    mode: APP_ENV.mode,
    apiUrl: API_CONFIG.baseUrl,
    features: { ...FEATURES },
    debug: isDebug,
  };
}
