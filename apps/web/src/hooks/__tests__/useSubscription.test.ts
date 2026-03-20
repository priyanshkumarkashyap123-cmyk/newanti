/**
 * Tests for SubscriptionProvider and useSubscription hook
 * Feature: user-data-management-and-platform
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import React from 'react';
import { SubscriptionProvider, useSubscription } from '../useSubscription';

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock localStorage
const localStorageMock = (() => {
    let store: Record<string, string> = {};
    return {
        getItem: (key: string) => store[key] ?? null,
        setItem: (key: string, value: string) => { store[key] = value; },
        removeItem: (key: string) => { delete store[key]; },
        clear: () => { store = {}; },
    };
})();
Object.defineProperty(global, 'localStorage', { value: localStorageMock });

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
        localStorageMock.clear();
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.restoreAllMocks();
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
        localStorageMock.setItem('beamlab_subscription_tier', 'pro');

        // Don't resolve fetch yet
        mockFetch.mockReturnValue(new Promise(() => {}));

        const { result } = renderHook(() => useSubscription(), { wrapper });

        // While loading, should serve cached tier
        expect(result.current.subscription.isLoading).toBe(true);
        expect(result.current.subscription.tier).toBe('pro');
    });

    it('refreshTier re-fetches without logout', async () => {
        mockFetch
            .mockResolvedValueOnce(makeSubResponse('free'))
            .mockResolvedValueOnce(makeSubResponse('pro'));

        const { result } = renderHook(() => useSubscription(), { wrapper });
        await waitFor(() => expect(result.current.subscription.isLoading).toBe(false));
        expect(result.current.subscription.tier).toBe('free');

        await act(async () => {
            await result.current.refreshSubscription();
        });

        expect(result.current.subscription.tier).toBe('pro');
        expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('falls back to cached tier on network error', async () => {
        localStorageMock.setItem('beamlab_subscription_tier', 'enterprise');
        mockFetch.mockRejectedValue(new Error('Network error'));

        const { result } = renderHook(() => useSubscription(), { wrapper });
        await waitFor(() => expect(result.current.subscription.isLoading).toBe(false));

        expect(result.current.subscription.tier).toBe('free');
    });
});
