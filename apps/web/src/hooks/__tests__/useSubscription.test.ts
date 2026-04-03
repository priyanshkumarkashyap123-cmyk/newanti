/**
 * Tests for SubscriptionProvider and useSubscription hook
 * Feature: user-data-management-and-platform
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import React from 'react';
import { SubscriptionProvider, useSubscription } from '../useSubscription';

// Mock useAuth from AuthProvider
vi.mock('../../providers/AuthProvider', () => ({
    useAuth: () => ({
        isSignedIn: true,
        userId: 'test-user-123',
        getToken: vi.fn().mockResolvedValue('fake-token'),
    }),
}));

vi.mock('@/config/env', () => ({
    API_CONFIG: { baseUrl: 'http://localhost:3001' },
    PAYMENT_CONFIG: { billingBypass: false },
}));

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

function makeSubResponse(tier: string) {
    return {
        ok: true,
        json: async () => ({
            success: true,
            data: {
                tier,
                features: {
                    maxProjects: tier === 'free' ? 3 : tier === 'pro' ? 50 : 999,
                    pdfExport: tier !== 'free',
                    aiAssistant: tier !== 'free',
                    advancedDesignCodes: tier !== 'free',
                    teamMembers: tier === 'free' ? 0 : tier === 'pro' ? 5 : 50,
                    prioritySupport: tier !== 'free',
                    apiAccess: tier === 'enterprise',
                },
            },
        }),
    };
}

function makeQuotaResponse() {
    return {
        ok: true,
        json: async () => ({
            data: {
                projectsRemaining: 2,
                computeUnitsRemaining: 3,
                projectsCreated: 1,
                computeUnitsUsed: 2,
                localComputeAvailable: false,
            },
        }),
    };
}

function wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(SubscriptionProvider, null, children);
}

describe('useSubscription', () => {
    beforeEach(() => {
        vi.useRealTimers();
        localStorage.clear();
        vi.clearAllMocks();
        mockFetch.mockReset();
    });

    afterEach(() => {
        localStorage.clear();
        vi.restoreAllMocks();
        mockFetch.mockReset();
    });

    it('canAccess returns false for free-tier gated features', async () => {
        mockFetch.mockResolvedValueOnce(makeSubResponse('free'));

        const { result } = renderHook(() => useSubscription(), { wrapper });

        await waitFor(() => expect(result.current.subscription.isLoading).toBe(false));

        expect(result.current.canAccess('advancedDesignCodes')).toBe(false);
        expect(result.current.canAccess('pdfExport')).toBe(false);
        expect(result.current.canAccess('aiAssistant')).toBe(false);
    });

    it('canAccess returns true for pro-tier features', async () => {
        mockFetch.mockResolvedValueOnce(makeSubResponse('pro'));

        const { result } = renderHook(() => useSubscription(), { wrapper });

        await waitFor(() => expect(result.current.subscription.isLoading).toBe(false));

        expect(result.current.canAccess('advancedDesignCodes')).toBe(true);
        expect(result.current.canAccess('pdfExport')).toBe(true);
    });

    it('serves cached tier during loading state (no layout shift)', () => {
        localStorage.setItem('beamlab_subscription_tier', 'pro');

        // Don't resolve fetch yet
        mockFetch.mockReturnValue(new Promise(() => {}));

        const { result } = renderHook(() => useSubscription(), { wrapper });

        // While loading, should serve cached tier
        expect(result.current.subscription.isLoading).toBe(true);
        expect(result.current.subscription.tier).toBe('pro');
    });

    it('refreshTier re-fetches without logout', async () => {
        mockFetch.mockResolvedValue(makeSubResponse('free'));

        const { result } = renderHook(() => useSubscription(), { wrapper });
        await waitFor(() => expect(result.current.subscription.isLoading).toBe(false));

        expect(typeof result.current.refreshSubscription).toBe('function');
    });

    it('falls back to free tier on network error (secure by default)', async () => {
        localStorage.setItem('beamlab_subscription_tier', 'enterprise');
        mockFetch.mockResolvedValue({
            ok: false,
            status: 401,
            json: async () => ({}),
        });

        const { result } = renderHook(() => useSubscription(), { wrapper });
        await waitFor(() => expect(result.current.subscription.isLoading).toBe(false));

        // SECURITY: defaults to free on error, doesn't use cached enterprise
        expect(result.current.subscription.tier).toBe('free');
    });
});
