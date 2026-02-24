import { describe, expect, it } from 'vitest';
import {
  resolveRazorpayPlanId,
  resolveStripePriceId,
} from '../src/utils/billingConfig.js';

describe('billing config resolvers', () => {
  describe('resolveStripePriceId', () => {
    it('prefers explicit price ID when provided', () => {
      const result = resolveStripePriceId('price_custom', 'monthly', {
        proMonthly: 'price_monthly',
        proYearly: 'price_yearly',
      });
      expect(result).toBe('price_custom');
    });

    it('returns monthly price for monthly plan', () => {
      const result = resolveStripePriceId(undefined, 'monthly', {
        proMonthly: 'price_monthly',
        proYearly: 'price_yearly',
      });
      expect(result).toBe('price_monthly');
    });

    it('returns yearly price for yearly plan', () => {
      const result = resolveStripePriceId(undefined, 'yearly', {
        proMonthly: 'price_monthly',
        proYearly: 'price_yearly',
      });
      expect(result).toBe('price_yearly');
    });

    it('returns null when selected plan ID is missing/blank', () => {
      expect(resolveStripePriceId(undefined, 'monthly', { proMonthly: '', proYearly: 'y' })).toBeNull();
      expect(resolveStripePriceId(undefined, 'yearly', { proMonthly: 'm', proYearly: '   ' })).toBeNull();
    });
  });

  describe('resolveRazorpayPlanId', () => {
    it('prefers explicit plan ID when provided', () => {
      const result = resolveRazorpayPlanId('plan_custom', 'monthly', {
        proMonthly: 'plan_m',
        proYearly: 'plan_y',
      });
      expect(result).toBe('plan_custom');
    });

    it('returns configured plan by cycle', () => {
      expect(
        resolveRazorpayPlanId(undefined, 'monthly', { proMonthly: 'plan_m', proYearly: 'plan_y' })
      ).toBe('plan_m');

      expect(
        resolveRazorpayPlanId(undefined, 'yearly', { proMonthly: 'plan_m', proYearly: 'plan_y' })
      ).toBe('plan_y');
    });

    it('returns null when selected plan is not configured', () => {
      expect(resolveRazorpayPlanId(undefined, 'monthly', { proMonthly: undefined, proYearly: 'plan_y' })).toBeNull();
      expect(resolveRazorpayPlanId(undefined, 'yearly', { proMonthly: 'plan_m', proYearly: '' })).toBeNull();
    });
  });
});
