export type BillingPlanCycle = 'monthly' | 'yearly';

/** PhonePe plan pricing (in paise) */
export const PHONEPE_PLAN_PRICING: Record<BillingPlanCycle, { amountPaise: number; label: string; durationDays: number }> = {
  monthly: { amountPaise: 99900, label: 'Pro Monthly', durationDays: 30 },
  yearly: { amountPaise: 999900, label: 'Pro Annual', durationDays: 365 },
};

/**
 * Resolve the amount in paise for a given plan cycle.
 */
export function resolvePlanAmount(planType: BillingPlanCycle): number {
  return PHONEPE_PLAN_PRICING[planType].amountPaise;
}

/**
 * Resolve the duration in days for a given plan cycle.
 */
export function resolvePlanDuration(planType: BillingPlanCycle): number {
  return PHONEPE_PLAN_PRICING[planType].durationDays;
}
