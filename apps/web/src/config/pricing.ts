export type BillingCycle = 'monthly' | 'yearly';
export type PlanId = 'free' | 'pro' | 'business' | 'enterprise';
export type PaidPlanId = 'pro' | 'business';
export type CheckoutPlanId = `${PaidPlanId}_${BillingCycle}`;

export const PRICING_INR = {
  free: {
    monthly: 0,
    yearly: 0,
  },
  pro: {
    monthly: 999,
    yearly: 9999,
  },
  business: {
    monthly: 1999,
    yearly: 19999,
  },
} as const;

export const CHECKOUT_PLAN_IDS: Record<PaidPlanId, Record<BillingCycle, CheckoutPlanId>> = {
  pro: {
    monthly: 'pro_monthly',
    yearly: 'pro_yearly',
  },
  business: {
    monthly: 'business_monthly',
    yearly: 'business_yearly',
  },
} as const;

export const FEATURE_BUNDLES: Record<PlanId, readonly string[]> = {
  free: [
    'Up to 3 active projects',
    '2D beam & frame analysis',
    'Basic load combinations',
    'IS 456 & ACI 318 design codes',
    'Standard PDF reports',
    'Community forum support',
  ],
  pro: [
    'Unlimited projects & storage',
    'Full 3D nonlinear analysis engine',
    'All international design codes',
    'P-Delta, buckling & modal analysis',
    'AI-powered design assistant',
    'Custom branded engineering reports',
    'Priority email & chat support',
    'Cloud backup & multi-device sync',
    'Real-time collaboration (up to 3 users)',
  ],
  business: [
    'Everything in Professional, plus:',
    'Up to 10 team members included',
    'Advanced team project sharing',
    'Centralized admin dashboard',
    'Version history (1-year retention)',
    'REST API access for automation',
    'Dedicated phone & priority support',
  ],
  enterprise: [
    'Everything in Business, plus:',
    'Unlimited team members & storage',
    'SSO, SAML & advanced security',
    'On-premise or private cloud deployment',
    'Custom integrations & API limits',
    'Dedicated technical account manager',
    '24/7 priority phone support',
    '99.99% Uptime SLA guarantee',
    'Custom onboarding & team training',
  ],
} as const;

export const CHECKOUT_FEATURES: readonly string[] = [
  'Unlimited Projects',
  'Advanced Analysis (Modal, Buckling, P-Delta)',
  'Steel & Concrete Design (IS, AISC, ACI, EC)',
  'Professional PDF Reports',
  'AI Design Assistant',
  'Priority Support',
] as const;

export const PRICING_LABELS = {
  proMonthly: '₹999/mo',
  businessMonthly: '₹1,999/mo',
  proYearly: '₹9,999/year',
  businessYearly: '₹19,999/year',
} as const;

export function getCheckoutPlanId(planId: PaidPlanId, billingCycle: BillingCycle): CheckoutPlanId {
  return CHECKOUT_PLAN_IDS[planId][billingCycle];
}

export function parseCheckoutPlanId(checkoutPlanId: string): { planId: PaidPlanId; billingCycle: BillingCycle } | null {
  const lower = checkoutPlanId.toLowerCase();
  if (lower === 'pro_monthly') return { planId: 'pro', billingCycle: 'monthly' };
  if (lower === 'pro_yearly') return { planId: 'pro', billingCycle: 'yearly' };
  if (lower === 'business_monthly') return { planId: 'business', billingCycle: 'monthly' };
  if (lower === 'business_yearly') return { planId: 'business', billingCycle: 'yearly' };
  return null;
}

export function validatePricingConfigReadiness(): { valid: boolean; errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];

  const requiredPaidPlans: PaidPlanId[] = ['pro', 'business'];
  for (const planId of requiredPaidPlans) {
    const monthly = PRICING_INR[planId].monthly;
    const yearly = PRICING_INR[planId].yearly;

    if (monthly <= 0 || yearly <= 0) {
      errors.push(`Pricing for ${planId} must be > 0. Received monthly=${monthly}, yearly=${yearly}`);
    }

    if (yearly > monthly * 12) {
      warnings.push(`Yearly price for ${planId} is higher than 12x monthly. Check discount strategy.`);
    }

    if (!CHECKOUT_PLAN_IDS[planId]?.monthly || !CHECKOUT_PLAN_IDS[planId]?.yearly) {
      errors.push(`Checkout mapping missing for ${planId}.`);
    }
  }

  if (FEATURE_BUNDLES.pro.length === 0 || FEATURE_BUNDLES.business.length === 0) {
    errors.push('Feature bundles for paid plans must not be empty.');
  }

  return { valid: errors.length === 0, errors, warnings };
}

export function formatINR(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
}
