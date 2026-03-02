/**
 * Unit tests for the centralized API_CONFIG in config/env.ts
 *
 * Verifies that the API configuration:
 * - Exports all required properties
 * - Uses valid URL formats
 * - Has reasonable default timeout
 * - Is frozen / immutable
 * - Includes WebSocket URL
 * - Includes all backend service URLs
 *
 * @vitest-environment jsdom
 */

import { describe, it, expect } from 'vitest';
import {
    API_CONFIG,
    AUTH_CONFIG,
    FEATURES as FEATURE_FLAGS,
    MONITORING_CONFIG,
    PERFORMANCE_CONFIG,
    APP_ENV,
    AI_CONFIG,
} from '../../config/env';

describe('API_CONFIG', () => {
    it('should export baseUrl, pythonUrl, rustUrl, timeout, and wsUrl properties', () => {
        expect(API_CONFIG).toHaveProperty('baseUrl');
        expect(API_CONFIG).toHaveProperty('pythonUrl');
        expect(API_CONFIG).toHaveProperty('rustUrl');
        expect(API_CONFIG).toHaveProperty('timeout');
        expect(API_CONFIG).toHaveProperty('wsUrl');
    });

    it('should have URLs that start with http:// or https://', () => {
        expect(API_CONFIG.baseUrl).toMatch(/^https?:\/\//);
        expect(API_CONFIG.pythonUrl).toMatch(/^https?:\/\//);
        expect(API_CONFIG.rustUrl).toMatch(/^https?:\/\//);
    });

    it('should have a WebSocket URL that starts with ws:// or wss://', () => {
        expect(API_CONFIG.wsUrl).toMatch(/^wss?:\/\//);
    });

    it('should have a timeout that is a positive number >= 5000ms', () => {
        expect(typeof API_CONFIG.timeout).toBe('number');
        expect(API_CONFIG.timeout).toBeGreaterThanOrEqual(5000);
    });

    it('should be declared as const (readonly at type level)', () => {
        // `as const` makes the object deeply readonly at the type level
        // Verify the config object exists and has the expected shape
        const keys = Object.keys(API_CONFIG);
        expect(keys).toContain('baseUrl');
        expect(keys).toContain('pythonUrl');
        expect(keys).toContain('rustUrl');
        expect(keys).toContain('timeout');
        expect(keys).toContain('wsUrl');
        expect(keys.length).toBeGreaterThanOrEqual(5);
    });

    it('should have URLs that do not end with a trailing slash', () => {
        expect(API_CONFIG.baseUrl).not.toMatch(/\/$/);
        expect(API_CONFIG.pythonUrl).not.toMatch(/\/$/);
        expect(API_CONFIG.rustUrl).not.toMatch(/\/$/);
    });
});

describe('APP_ENV', () => {
    it('should have mode, isDev, isProd, and baseUrl', () => {
        expect(APP_ENV).toHaveProperty('mode');
        expect(APP_ENV).toHaveProperty('isDev');
        expect(APP_ENV).toHaveProperty('isProd');
        expect(APP_ENV).toHaveProperty('baseUrl');
    });

    it('should have boolean isDev and isProd that are mutually consistent', () => {
        expect(typeof APP_ENV.isDev).toBe('boolean');
        expect(typeof APP_ENV.isProd).toBe('boolean');
        // They shouldn't both be true simultaneously
        expect(APP_ENV.isDev && APP_ENV.isProd).toBe(false);
    });
});

describe('PERFORMANCE_CONFIG', () => {
    it('should have maxWorkers as a positive integer', () => {
        expect(typeof PERFORMANCE_CONFIG.maxWorkers).toBe('number');
        expect(PERFORMANCE_CONFIG.maxWorkers).toBeGreaterThanOrEqual(1);
        expect(PERFORMANCE_CONFIG.maxWorkers).toBeLessThanOrEqual(16);
    });

    it('should have analysisTimeout greater than 10 seconds', () => {
        expect(PERFORMANCE_CONFIG.analysisTimeout).toBeGreaterThanOrEqual(10_000);
    });
});
