import { describe, expect, it } from 'vitest';
import {
  resolvePlanAmount,
  resolvePlanDuration,
  PHONEPE_PLAN_PRICING,
  CHECKOUT_PLAN_PRICING,
  resolveCheckoutPlanConfig,
  resolveTierFromPlanId,
} from '../src/utils/billingConfig.js';

describe('billing config resolvers', () => {
  describe('resolvePlanAmount', () => {
    it('returns correct amount for monthly plan', () => {
      expect(resolvePlanAmount('monthly')).toBe(99900);
    });

    it('returns correct amount for yearly plan', () => {
      expect(resolvePlanAmount('yearly')).toBe(999900);
    });
  });

  describe('resolvePlanDuration', () => {
    it('returns 30 days for monthly plan', () => {
      expect(resolvePlanDuration('monthly')).toBe(30);
    });

    it('returns 365 days for yearly plan', () => {
      expect(resolvePlanDuration('yearly')).toBe(365);
    });
  });

  describe('PHONEPE_PLAN_PRICING', () => {
    it('has labels for both plans', () => {
      expect(PHONEPE_PLAN_PRICING.monthly.label).toBe('Pro Monthly');
      expect(PHONEPE_PLAN_PRICING.yearly.label).toBe('Pro Annual');
    });
  });

  describe('CHECKOUT_PLAN_PRICING', () => {
    it('includes business monthly and yearly plans', () => {
      expect(CHECKOUT_PLAN_PRICING.business_monthly.amountPaise).toBe(199900);
      expect(CHECKOUT_PLAN_PRICING.business_yearly.amountPaise).toBe(1999900);
    });

    it('resolves checkout plan config for business yearly', () => {
      const plan = resolveCheckoutPlanConfig('business_yearly');
      expect(plan.planId).toBe('business');
      expect(plan.billingCycle).toBe('yearly');
      expect(plan.durationDays).toBe(365);
    });

    it('maps business plan to enterprise access tier', () => {
      expect(resolveTierFromPlanId('business')).toBe('enterprise');
      expect(resolveTierFromPlanId('pro')).toBe('pro');
    });
  });
});
