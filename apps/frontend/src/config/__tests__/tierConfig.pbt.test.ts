/**
 * Property-Based Tests for tierConfig.ts
 *
 * Property 2: canAccess consistency across hooks
 * For any tier T, deriveLimitsFromTier(T) must deep-equal TIER_CONFIG[T]
 *
 * Validates: Requirements 2.2, 2.5
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { TIER_CONFIG, deriveLimitsFromTier, type TierName } from '../tierConfig';

describe('Property 2: canAccess consistency across hooks', () => {
  it('deriveLimitsFromTier(T) deep-equals TIER_CONFIG[T] for any tier', () => {
    fc.assert(
      fc.property(
        fc.constantFrom<TierName>('free', 'pro', 'enterprise'),
        (tier) => {
          const limits = deriveLimitsFromTier(tier);
          const config = TIER_CONFIG[tier];
          // Deep equality check
          return JSON.stringify(limits) === JSON.stringify(config);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('TIER_CONFIG free tier has pdfExport=false and aiAssistant=false', () => {
    expect(TIER_CONFIG.free.pdfExport).toBe(false);
    expect(TIER_CONFIG.free.aiAssistant).toBe(false);
    expect(TIER_CONFIG.free.maxProjects).toBe(3);
    expect(TIER_CONFIG.free.maxNodes).toBe(10);
    expect(TIER_CONFIG.free.maxMembers).toBe(15);
    expect(TIER_CONFIG.free.maxAnalysisPerDay).toBe(3);
    expect(TIER_CONFIG.free.canSaveProjects).toBe(false);
    expect(TIER_CONFIG.free.canExportCleanPDF).toBe(false);
  });

  it('TIER_CONFIG pro and enterprise tiers have pdfExport=true and aiAssistant=true', () => {
    fc.assert(
      fc.property(
        fc.constantFrom<TierName>('pro', 'enterprise'),
        (tier) => {
          return TIER_CONFIG[tier].pdfExport === true && TIER_CONFIG[tier].aiAssistant === true;
        },
      ),
      { numRuns: 100 },
    );
  });
});
