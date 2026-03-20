/**
 * useTierAccess verification tests
 *
 * C1 exploration (re-run): confirms TierGate enforcement works after fix.
 * Preservation P2: Pro/Enterprise users are never blocked.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import React from 'react';

// ============================================
// MOCK useSubscription
// ============================================

const mockCanAccess = vi.fn();
const mockSubscription = { tier: 'free', isLoading: false };

vi.mock('../useSubscription', () => ({
    useSubscription: () => ({
        subscription: mockSubscription,
        canAccess: mockCanAccess,
    }),
}));

import { useTierAccess } from '../useTierAccess';

// ============================================
// C1 EXPLORATION RE-RUN: Tier gate enforcement
// ============================================

describe('C1 — useTierAccess: free tier blocks gated features', () => {
    beforeEach(() => {
        mockSubscription.tier = 'free';
        mockCanAccess.mockImplementation((feature: string) => {
            // Free tier: only basic features allowed
            const freeFeatures = ['basicAnalysis', 'basicExport'];
            return freeFeatures.includes(feature);
        });
    });

    it('returns isFree=true for free tier', () => {
        const { result } = renderHook(() => useTierAccess());
        expect(result.current.isFree).toBe(true);
        expect(result.current.isPro).toBe(false);
    });

    it('canAccess returns false for advancedAnalysis on free tier', () => {
        const { result } = renderHook(() => useTierAccess());
        expect(result.current.canAccess('advancedDesignCodes')).toBe(false);
    });

    it('canAccess returns false for pdfExport on free tier', () => {
        const { result } = renderHook(() => useTierAccess());
        expect(result.current.canAccess('pdfExport')).toBe(false);
    });

    it('canAccess returns false for aiAssistant on free tier', () => {
        const { result } = renderHook(() => useTierAccess());
        expect(result.current.canAccess('aiAssistant')).toBe(false);
    });
});

// ============================================
// PRESERVATION P2: Pro/Enterprise unaffected
// ============================================

describe('P2 — useTierAccess: pro/enterprise tier allows all features', () => {
    beforeEach(() => {
        mockCanAccess.mockReturnValue(true);
    });

    it('isPro=true for pro tier', () => {
        mockSubscription.tier = 'pro';
        const { result } = renderHook(() => useTierAccess());
        expect(result.current.isPro).toBe(true);
        expect(result.current.isFree).toBe(false);
    });

    it('isEnterprise=true for enterprise tier', () => {
        mockSubscription.tier = 'enterprise';
        const { result } = renderHook(() => useTierAccess());
        expect(result.current.isEnterprise).toBe(true);
        expect(result.current.isPro).toBe(true);
    });

    it('canAccess returns true for all features on pro tier', () => {
        mockSubscription.tier = 'pro';
        const { result } = renderHook(() => useTierAccess());
        const features = ['pdfExport', 'aiAssistant', 'teamMembers', 'advancedDesignCodes'] as const;
        for (const f of features) {
            expect(result.current.canAccess(f)).toBe(true);
        }
    });

    it('canAccess returns true for all features on enterprise tier', () => {
        mockSubscription.tier = 'enterprise';
        const { result } = renderHook(() => useTierAccess());
        expect(result.current.canAccess('advancedDesignCodes')).toBe(true);
        expect(result.current.canAccess('pdfExport')).toBe(true);
    });
});
