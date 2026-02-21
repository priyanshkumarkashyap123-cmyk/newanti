export type BillingPlanCycle = 'monthly' | 'yearly';

/**
 * Resolve Stripe price ID from explicit input or configured environment IDs.
 */
export function resolveStripePriceId(
  explicitPriceId: string | undefined,
  plan: BillingPlanCycle | undefined,
  env: {
    proMonthly?: string;
    proYearly?: string;
  }
): string | null {
  if (explicitPriceId) return explicitPriceId;
  const selected = plan === 'yearly' ? env.proYearly : env.proMonthly;
  return selected && selected.trim().length > 0 ? selected : null;
}

/**
 * Resolve Razorpay plan ID from explicit input or configured environment IDs.
 */
export function resolveRazorpayPlanId(
  explicitPlanId: string | undefined,
  planType: BillingPlanCycle | undefined,
  env: {
    proMonthly?: string;
    proYearly?: string;
  }
): string | null {
  if (explicitPlanId) return explicitPlanId;
  const selected = planType === 'yearly' ? env.proYearly : env.proMonthly;
  return selected && selected.trim().length > 0 ? selected : null;
}
