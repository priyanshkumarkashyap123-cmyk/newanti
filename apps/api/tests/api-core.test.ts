/**
 * Health Check & Core API Tests
 *
 * Tests the fundamental API behavior without requiring a real database.
 * Uses supertest to send HTTP requests to the Express app.
 */

import { describe, it, expect, vi, beforeAll } from 'vitest';

// ============================================
// UNIT: Response Helpers
// ============================================

describe('Response Helpers', () => {
    it('should export attachResponseHelpers middleware', async () => {
        const { attachResponseHelpers } = await import('../src/middleware/response.js');
        expect(attachResponseHelpers).toBeDefined();
        expect(typeof attachResponseHelpers).toBe('function');
    });
});

// ============================================
// UNIT: Security Middleware
// ============================================

describe('Security Middleware', () => {
    it('should export all rate limiters', async () => {
        const security = await import('../src/middleware/security.js');
        expect(security.generalRateLimit).toBeDefined();
        expect(security.analysisRateLimit).toBeDefined();
        expect(security.billingRateLimit).toBeDefined();
        expect(security.authRateLimit).toBeDefined();
        expect(security.securityHeaders).toBeDefined();
        expect(security.requestIdMiddleware).toBeDefined();
    });
});

// ============================================
// UNIT: Validation Middleware
// ============================================

describe('Validation Middleware', () => {
    it('should export validateBody factory', async () => {
        const { validateBody } = await import('../src/middleware/validation.js');
        expect(validateBody).toBeDefined();
        expect(typeof validateBody).toBe('function');
    });

    it('validateBody should return a middleware function', async () => {
        const { validateBody, analyzeRequestSchema } = await import('../src/middleware/validation.js');
        const middleware = validateBody(analyzeRequestSchema);
        expect(typeof middleware).toBe('function');
    });
});

// ============================================
// UNIT: Models & Helpers
// ============================================

describe('Model Helpers', () => {
    it('isMasterUser should identify master emails', async () => {
        const { isMasterUser } = await import('../src/models.js');
        expect(isMasterUser('rakshittiwari048@gmail.com')).toBe(true);
        expect(isMasterUser('random@example.com')).toBe(false);
        expect(isMasterUser(null)).toBe(false);
        expect(isMasterUser(undefined)).toBe(false);
        expect(isMasterUser('')).toBe(false);
    });

    it('getEffectiveTier should override for master users', async () => {
        const { getEffectiveTier } = await import('../src/models.js');
        expect(getEffectiveTier('rakshittiwari048@gmail.com', 'free')).toBe('enterprise');
        expect(getEffectiveTier('other@example.com', 'free')).toBe('free');
        expect(getEffectiveTier('other@example.com', 'pro')).toBe('pro');
    });
});
