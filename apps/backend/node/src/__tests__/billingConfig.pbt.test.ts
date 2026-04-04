/**
 * Property-Based Tests for billingConfig.ts
 *
 * Property 4: All valid plan IDs resolve to a non-zero amount
 * Property 5: Invalid plan IDs return HTTP 400
 *
 * Validates: Requirements 3.1, 3.2, 3.4
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { resolvePlan, BILLING_PLANS } from '../utils/billingConfig.js';
import { HttpError } from '../utils/asyncHandler.js';

const VALID_PLAN_IDS = ['pro_monthly', 'pro_yearly', 'business_monthly', 'business_yearly'] as const;

describe('Property 4: All valid plan IDs resolve to a non-zero amount', () => {
  it('all valid plan IDs have amountPaise > 0 and durationDays > 0', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...VALID_PLAN_IDS),
        (planId) => {
          const plan = resolvePlan(planId);
          return plan.amountPaise > 0 && plan.durationDays > 0;
        },
      ),
      { numRuns: 100 },
    );
  });

  it('business plans map to enterprise tier', () => {
    expect(BILLING_PLANS.business_monthly.tier).toBe('enterprise');
    expect(BILLING_PLANS.business_yearly.tier).toBe('enterprise');
  });

  it('pro plans map to pro tier', () => {
    expect(BILLING_PLANS.pro_monthly.tier).toBe('pro');
    expect(BILLING_PLANS.pro_yearly.tier).toBe('pro');
  });
});

describe('Property 5: Invalid plan IDs return HTTP 400', () => {
  it('unknown plan IDs throw HttpError with status 400', () => {
    fc.assert(
      fc.property(
        fc.string().filter((s) => !VALID_PLAN_IDS.includes(s as typeof VALID_PLAN_IDS[number])),
        (planId) => {
          try {
            resolvePlan(planId);
            return false; // should have thrown
          } catch (err) {
            if (err instanceof HttpError) {
              return err.statusCode === 400;
            }
            return false;
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it('empty string throws HttpError 400', () => {
    expect(() => resolvePlan('')).toThrow(HttpError);
    try {
      resolvePlan('');
    } catch (err) {
      expect(err).toBeInstanceOf(HttpError);
      expect((err as HttpError).statusCode).toBe(400);
    }
  });

  it('unknown plan ID includes valid IDs in error message', () => {
    try {
      resolvePlan('invalid_plan');
    } catch (err) {
      expect(err).toBeInstanceOf(HttpError);
      expect((err as HttpError).message).toContain('pro_monthly');
    }
  });
});
