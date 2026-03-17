/**
 * Tests for SubscriptionProvider and useSubscription hook
 * Feature: user-data-management-and-platform
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import React from 'react';
import { SubscriptionProvider, useSubscription } from '../useSubscription';

// Declare global for TypeScript
declare const global: any;

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
            data: {
                tier,
                features: {
                    maxProjectsPerDay: tier === 'free' ? 3 : null,
                    maxComputeUnitsPerDay: tier === 'free' ? 5 : null,
                    features: {
                        collaboration: tier !== 'free',
                        pdfExport: tier !== 'free',
                        aiAssistant: tier !== 'free',
                        advancedDesignCodes: tier !== 'free',
                        apiAccess: tier === 'enterprise',
                    },
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
        mockFetch
            .mockResolvedValueOnce(makeSubResponse('free'))
            .mockResolvedValueOnce(makeQuotaResponse());

        const { result } = renderHook(() => useSubscription(), { wrapper });

        await waitFor(() => expect(result.current.isLoading).toBe(false));

        expect(result.current.canAccess('collaboration')).toBe(false);
        expect(result.current.canAccess('pdfExport')).toBe(false);
        expect(result.current.canAccess('aiAssistant')).toBe(false);
    });

    it('canAccess returns true for pro-tier features', async () => {
        mockFetch
            .mockResolvedValueOnce(makeSubResponse('pro'))
            .mockResolvedValueOnce(makeQuotaResponse());

        const { result } = renderHook(() => useSubscription(), { wrapper });

        await waitFor(() => expect(result.current.isLoading).toBe(false));

        expect(result.current.canAccess('collaboration')).toBe(true);
        expect(result.current.canAccess('pdfExport')).toBe(true);
    });

    it('serves cached tier during loading state (no layout shift)', () => {
        localStorageMock.setItem('beamlab:tier-cache', 'pro');

        // Don't resolve fetch yet
        mockFetch.mockReturnValue(new Promise(() => {}));

        const { result } = renderHook(() => useSubscription(), { wrapper });

        // While loading, should serve cached tier
        expect(result.current.isLoading).toBe(true);
        expect(result.current.tier).toBe('pro');
    });

    it('refreshTier re-fetches without logout', async () => {
        mockFetch
            .mockResolvedValueOnce(makeSubResponse('free'))
            .mockResolvedValueOnce(makeQuotaResponse())
            .mockResolvedValueOnce(makeSubResponse('pro'))
            .mockResolvedValueOnce(makeQuotaResponse());

        const { result } = renderHook(() => useSubscription(), { wrapper });
        await waitFor(() => expect(result.current.isLoading).toBe(false));
        expect(result.current.tier).toBe('free');

        await act(async () => {
            await result.current.refreshTier();
        });

        expect(result.current.tier).toBe('pro');
        expect(mockFetch).toHaveBeenCalledTimes(4);
    });

    it('falls back to cached tier on network error', async () => {
        localStorageMock.setItem('beamlab:tier-cache', 'enterprise');
        mockFetch.mockRejectedValue(new Error('Network error'));

        const { result } = renderHook(() => useSubscription(), { wrapper });
        await waitFor(() => expect(result.current.isLoading).toBe(false));

        expect(result.current.tier).toBe('enterprise');
    });
});
