/**
 * TierGate component verification tests
 *
 * C1 exploration (re-run): confirms UpgradeModal shown for free tier.
 * Preservation P2: Pro/Enterprise users see children, not UpgradeModal.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import React from 'react';

// ============================================
// MOCKS
// ============================================

const mockCanAccess = vi.fn();

vi.mock('../../hooks/useSubscription', () => ({
    useSubscription: () => ({
        subscription: { tier: 'free', isLoading: false },
        canAccess: mockCanAccess,
    }),
}));

vi.mock('../UpgradeModal', () => ({
    UpgradeModal: ({ isOpen }: { isOpen: boolean }) =>
        isOpen ? <div data-testid="upgrade-modal">UpgradeModal</div> : null,
}));

// Mock react-router-dom for UpgradeModal dependency
vi.mock('react-router-dom', () => ({
    useNavigate: () => vi.fn(),
}));

import { TierGate } from '../TierGate';

// ============================================
// C1 EXPLORATION RE-RUN: free tier shows locked overlay
// ============================================

describe('C1 — TierGate: free tier blocks gated features', () => {
    beforeEach(() => {
        mockCanAccess.mockReturnValue(false);
    });

    afterEach(() => {
        cleanup();
    });

    it('renders LockedOverlay (not children) when canAccess returns false', () => {
        render(
            <TierGate feature="advancedAnalysis">
                <div data-testid="protected-content">Protected Content</div>
            </TierGate>,
        );

        expect(screen.queryByTestId('protected-content')).toBeNull();
        // LockedOverlay has aria-label
        expect(screen.getByRole('button', { name: /upgrade/i })).toBeDefined();
    });

    it('does NOT render children when access is denied', () => {
        render(
            <TierGate feature="pdfExport">
                <div data-testid="pdf-button">Export PDF</div>
            </TierGate>,
        );

        expect(screen.queryByTestId('pdf-button')).toBeNull();
    });

    it('renders custom fallback when provided and access is denied', () => {
        render(
            <TierGate feature="aiAssistant" fallback={<div data-testid="custom-fallback">Custom</div>}>
                <div data-testid="ai-content">AI Content</div>
            </TierGate>,
        );

        expect(screen.queryByTestId('ai-content')).toBeNull();
        expect(screen.getByTestId('custom-fallback')).toBeDefined();
    });
});

// ============================================
// PRESERVATION P2: Pro/Enterprise sees children
// ============================================

describe('P2 — TierGate: pro/enterprise tier renders children', () => {
    beforeEach(() => {
        mockCanAccess.mockReturnValue(true);
    });

    afterEach(() => {
        cleanup();
    });

    it('renders children when canAccess returns true', () => {
        render(
            <TierGate feature="advancedAnalysis">
                <div data-testid="protected-content">Protected Content</div>
            </TierGate>,
        );

        expect(screen.getByTestId('protected-content')).toBeDefined();
    });

    it('does NOT render LockedOverlay when access is granted', () => {
        render(
            <TierGate feature="pdfExport">
                <div data-testid="pdf-button">Export PDF</div>
            </TierGate>,
        );

        expect(screen.queryByRole('button', { name: /upgrade/i })).toBeNull();
        expect(screen.getByTestId('pdf-button')).toBeDefined();
    });

    it('does NOT render UpgradeModal when access is granted', () => {
        render(
            <TierGate feature="aiAssistant">
                <div data-testid="ai-content">AI Content</div>
            </TierGate>,
        );

        expect(screen.queryByTestId('upgrade-modal')).toBeNull();
        expect(screen.getByTestId('ai-content')).toBeDefined();
    });
});

// ============================================
// PROPERTY 10: UpgradeModal shown for all gated features (fast-check PBT)
// Feature: beamlab-improvement-roadmap, Property 10: UpgradeModal shown for all gated features
// Validates: Requirements 5.1, 5.3
// ============================================

import * as fc from 'fast-check';
import { TIER_CONFIG } from '../../config/tierConfig';
import type { SubscriptionFeatures } from '../../hooks/useSubscription';

describe('Property 10 — UpgradeModal shown for all gated features (PBT)', () => {
    afterEach(() => {
        cleanup();
    });

    it('for any feature gated on free tier, TierGate blocks children and shows locked overlay', () => {
        // Collect all feature keys that are false/0 for free tier
        const gatedFeatureKeys = (
            Object.keys(TIER_CONFIG.free) as Array<keyof typeof TIER_CONFIG.free>
        ).filter((key) => {
            const val = TIER_CONFIG.free[key];
            return typeof val === 'boolean' ? !val : val === 0;
        }) as Array<keyof SubscriptionFeatures>;

        // Only test keys that are valid SubscriptionFeatures keys
        const subscriptionFeatureKeys: Array<keyof SubscriptionFeatures> = [
            'pdfExport', 'aiAssistant', 'advancedDesignCodes', 'teamMembers',
            'prioritySupport', 'apiAccess',
        ];
        const testableKeys = gatedFeatureKeys.filter(k =>
            subscriptionFeatureKeys.includes(k as keyof SubscriptionFeatures)
        ) as Array<keyof SubscriptionFeatures>;

        expect(testableKeys.length).toBeGreaterThan(0);

        // Property: for any gated feature key, TierGate blocks children
        fc.assert(
            fc.property(
                fc.constantFrom(...testableKeys),
                (featureKey) => {
                    mockCanAccess.mockReturnValue(false);
                    const { unmount } = render(
                        <TierGate feature={featureKey}>
                            <div data-testid={`content-${featureKey}`}>Protected</div>
                        </TierGate>,
                    );
                    // Children must NOT be rendered
                    const content = screen.queryByTestId(`content-${featureKey}`);
                    // Locked overlay button must be present
                    const upgradeBtn = screen.queryByRole('button', { name: /upgrade/i });
                    unmount();
                    return content === null && upgradeBtn !== null;
                },
            ),
            { numRuns: 100 },
        );
    });

    it('for any feature accessible on pro/enterprise tier, TierGate renders children', () => {
        const proFeatureKeys: Array<keyof SubscriptionFeatures> = [
            'pdfExport', 'aiAssistant', 'advancedDesignCodes', 'prioritySupport',
        ];

        fc.assert(
            fc.property(
                fc.constantFrom(...proFeatureKeys),
                (featureKey) => {
                    mockCanAccess.mockReturnValue(true);
                    const { unmount } = render(
                        <TierGate feature={featureKey}>
                            <div data-testid={`pro-content-${featureKey}`}>Pro Content</div>
                        </TierGate>,
                    );
                    const content = screen.queryByTestId(`pro-content-${featureKey}`);
                    const upgradeBtn = screen.queryByRole('button', { name: /upgrade/i });
                    unmount();
                    return content !== null && upgradeBtn === null;
                },
            ),
            { numRuns: 100 },
        );
    });
});
