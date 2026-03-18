import { HttpError } from './asyncHandler.js';

export type BillingPlanCycle = 'monthly' | 'yearly';
export type BillingPlanId = 'pro' | 'business';
export type CheckoutPlanId = `${BillingPlanId}_${BillingPlanCycle}`;
export type AccessTier = 'free' | 'pro' | 'enterprise';

export interface BillingPlanConfig {
  amountPaise: number;
  label: string;
  durationDays: number;
  planId: BillingPlanId;
  billingCycle: BillingPlanCycle;
  tier: 'pro' | 'enterprise';
  displayPrice: string;
}

/**
 * BILLING_PLANS — canonical record of all valid checkout plan IDs.
 * Used by resolvePlan() to validate and resolve plan details.
 */
export const BILLING_PLANS: Record<CheckoutPlanId, BillingPlanConfig> = {
  pro_monthly: {
    amountPaise: 99900,
    label: 'Pro Monthly',
    durationDays: 30,
    planId: 'pro',
    billingCycle: 'monthly',
    tier: 'pro',
    displayPrice: '₹999/month',
  },
  pro_yearly: {
    amountPaise: 999900,
    label: 'Pro Annual',
    durationDays: 365,
    planId: 'pro',
    billingCycle: 'yearly',
    tier: 'pro',
    displayPrice: '₹9,999/year',
  },
  business_monthly: {
    amountPaise: 199900,
    label: 'Business Monthly',
    durationDays: 30,
    planId: 'business',
    billingCycle: 'monthly',
    tier: 'enterprise',
    displayPrice: '₹1,999/month',
  },
  business_yearly: {
    amountPaise: 1999900,
    label: 'Business Annual',
    durationDays: 365,
    planId: 'business',
    billingCycle: 'yearly',
    tier: 'enterprise',
    displayPrice: '₹19,999/year',
  },
};

/** Backward-compatible alias */
export const CHECKOUT_PLAN_PRICING = BILLING_PLANS;

/** PhonePe plan pricing (in paise) — backward compat */
export const PHONEPE_PLAN_PRICING: Record<BillingPlanCycle, { amountPaise: number; label: string; durationDays: number }> = {
  monthly: {
    amountPaise: BILLING_PLANS.pro_monthly.amountPaise,
    label: BILLING_PLANS.pro_monthly.label,
    durationDays: BILLING_PLANS.pro_monthly.durationDays,
  },
  yearly: {
    amountPaise: BILLING_PLANS.pro_yearly.amountPaise,
    label: BILLING_PLANS.pro_yearly.label,
    durationDays: BILLING_PLANS.pro_yearly.durationDays,
  },
};

const VALID_PLAN_IDS = Object.keys(BILLING_PLANS) as CheckoutPlanId[];

/**
 * resolvePlan — resolve a checkout plan by ID.
 * Throws HttpError(400) for unknown plan IDs.
 */
export function resolvePlan(planId: string): BillingPlanConfig {
  const plan = Object.prototype.hasOwnProperty.call(BILLING_PLANS, planId)
    ? BILLING_PLANS[planId as CheckoutPlanId]
    : undefined;
  if (!plan) {
    throw new HttpError(
      400,
      `Unknown plan ID: ${planId}. Valid plan IDs: ${VALID_PLAN_IDS.join(', ')}`,
      'UNKNOWN_PLAN_ID',
    );
  }
  return plan;
}

/** Resolve canonical checkout plan config */
export function resolveCheckoutPlanConfig(checkoutPlanId: CheckoutPlanId): BillingPlanConfig {
  return BILLING_PLANS[checkoutPlanId];
}

/** Resolve access tier granted by a paid plan */
export function resolveTierFromPlanId(planId: BillingPlanId): AccessTier {
  return planId === 'business' ? 'enterprise' : 'pro';
}

/**
 * Resolve the amount in paise for a given plan cycle.
 * Thin wrapper over resolvePlan for backward compatibility.
 */
export function resolvePlanAmount(planType: BillingPlanCycle): number {
  return PHONEPE_PLAN_PRICING[planType].amountPaise;
}

/**
 * Resolve the duration in days for a given plan cycle.
 * Thin wrapper over resolvePlan for backward compatibility.
 */
export function resolvePlanDuration(planType: BillingPlanCycle): number {
  return PHONEPE_PLAN_PRICING[planType].durationDays;
}
