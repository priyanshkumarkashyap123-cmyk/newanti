/**
 * Unit tests for environment configuration
 * 
 * Tests the centralized env config to ensure:
 * - Default values work correctly
 * - API config structure is valid
 * - Feature flags have sensible defaults
 */

import { describe, it, expect } from 'vitest';
import { API_CONFIG, AUTH_CONFIG, MONITORING_CONFIG, FEATURES as FEATURE_FLAGS } from '../config/env';

describe('Environment Configuration', () => {
    describe('API_CONFIG', () => {
        it('should have a baseUrl defined', () => {
            expect(API_CONFIG.baseUrl).toBeDefined();
            expect(typeof API_CONFIG.baseUrl).toBe('string');
            expect(API_CONFIG.baseUrl.length).toBeGreaterThan(0);
        });

        it('should have a pythonUrl defined', () => {
            expect(API_CONFIG.pythonUrl).toBeDefined();
            expect(typeof API_CONFIG.pythonUrl).toBe('string');
        });

        it('should have a rustUrl defined', () => {
            expect(API_CONFIG.rustUrl).toBeDefined();
            expect(typeof API_CONFIG.rustUrl).toBe('string');
        });

        it('should have a positive timeout', () => {
            expect(API_CONFIG.timeout).toBeGreaterThan(0);
        });

        it('should not have trailing slashes on URLs', () => {
            expect(API_CONFIG.baseUrl).not.toMatch(/\/$/);
            expect(API_CONFIG.pythonUrl).not.toMatch(/\/$/);
            expect(API_CONFIG.rustUrl).not.toMatch(/\/$/);
        });
    });

    describe('AUTH_CONFIG', () => {
        it('should have clerkPublishableKey defined', () => {
            expect(AUTH_CONFIG.clerkPublishableKey).toBeDefined();
        });
    });

    describe('MONITORING_CONFIG', () => {
        it('should have sentryDsn defined', () => {
            expect(MONITORING_CONFIG).toBeDefined();
            expect(MONITORING_CONFIG).toHaveProperty('sentryDsn');
        });
    });

    describe('FEATURE_FLAGS', () => {
        it('should have boolean feature flags', () => {
            expect(typeof FEATURE_FLAGS.webgpu).toBe('boolean');
            expect(typeof FEATURE_FLAGS.collaboration).toBe('boolean');
            expect(typeof FEATURE_FLAGS.ai).toBe('boolean');
        });
    });
});
