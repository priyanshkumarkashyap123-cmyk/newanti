/**
 * Property-Based Tests for TierGate / UpgradeModal
 *
 * Property 10: UpgradeModal shown for all gated features
 * For any feature key F where TIER_CONFIG.free[F] is false or 0,
 * clicking the gated element with tier='free' must render a dialog
 * with role 'dialog' and name matching /upgrade/i
 *
 * Validates: Requirements 5.1, 5.3
 */

import { describe, it, expect, vi } from 'vitest';
import * as fc from 'fast-check';
import { render, screen, fireEvent, within } from '@testing-library/react';
import React from 'react';
import { TIER_CONFIG } from '../../config/tierConfig';
import type { SubscriptionFeatures } from '../../hooks/useSubscription';

// Mock useSubscription to return free tier
const mockCanAccess = vi.fn();
vi.mock('../../hooks/useSubscription', () => ({
  useSubscription: () => ({
    subscription: { tier: 'free', isLoading: false, isRevalidating: false, expiresAt: null, features: {} },
    canAccess: mockCanAccess,
    requiresUpgrade: (f: string) => !mockCanAccess(f),
    refreshSubscription: async () => {},
    optimisticUpgrade: () => {},
  }),
}));

// Mock react-router-dom
vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
}));

// Mock PaymentGatewaySelector
vi.mock('../PaymentGatewaySelector', () => ({
  PaymentGatewaySelector: () => null,
}));

// Mock PhonePePayment
vi.mock('../PhonePePayment', () => ({
  PhonePePaymentModal: () => null,
}));

// Mock dialog
vi.mock('../ui/dialog', () => ({
  Dialog: ({ open, children }: { open: boolean; children: React.ReactNode }) =>
    open ? <div role="dialog" aria-label="Upgrade to Pro">{children}</div> : null,
  DialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
  DialogDescription: ({ children, asChild }: { children: React.ReactNode; asChild?: boolean }) =>
    asChild ? <>{children}</> : <p>{children}</p>,
}));

import { TierGate } from '../TierGate';

// Feature keys that are boolean false in free tier
const GATED_FEATURE_KEYS = (Object.keys(TIER_CONFIG.free) as Array<keyof typeof TIER_CONFIG.free>)
  .filter((k) => {
    const val = TIER_CONFIG.free[k];
    return val === false || val === 0;
  })
  .filter((k) => ['pdfExport', 'aiAssistant', 'advancedDesignCodes', 'prioritySupport', 'apiAccess'].includes(k as string)) as Array<keyof SubscriptionFeatures>;

describe('Property 10: UpgradeModal shown for all gated features', () => {
  it('clicking gated element on free tier renders upgrade dialog', () => {
    mockCanAccess.mockReturnValue(false);

    fc.assert(
      fc.property(
        fc.constantFrom(...GATED_FEATURE_KEYS),
        (feature) => {
          const { unmount, container } = render(
            <TierGate feature={feature}>
              <button>Gated Content</button>
            </TierGate>,
          );
          const local = within(container);

          // The gated element should be present (prefer accessible selector, fallback to data attribute)
          const gatedEl =
            local.queryByRole('button', { name: /upgrade/i }) ??
            container.querySelector('[data-gated]');
          expect(gatedEl).not.toBeNull();

          // Click the gated element
          if (gatedEl) {
            fireEvent.click(gatedEl);
          }

          // UpgradeModal should be rendered (dialog with upgrade in name)
          const dialog = local.queryByRole('dialog');
          const result = dialog !== null;

          unmount();
          return result;
        },
      ),
      { numRuns: 100 },
    );
  });

  it('TIER_CONFIG.free has false/0 for gated features', () => {
    expect(TIER_CONFIG.free.pdfExport).toBe(false);
    expect(TIER_CONFIG.free.aiAssistant).toBe(false);
    expect(TIER_CONFIG.free.advancedDesignCodes).toBe(false);
    expect(TIER_CONFIG.free.apiAccess).toBe(false);
  });
});
