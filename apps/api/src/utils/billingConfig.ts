export type BillingPlanCycle = 'monthly' | 'yearly';

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
