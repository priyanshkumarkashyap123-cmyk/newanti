/**
 * PricingSection — Pricing cards for the landing page.
 * Sources plan data from pricing.ts.
 * Extracted from LandingPage.tsx for lazy loading.
 */

import { FC, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Check } from 'lucide-react';
import { PRICING_INR, FEATURE_BUNDLES, formatINR, type BillingCycle } from '../../config/pricing';
import { Button } from '../ui/button';

const PLANS = [
  {
    id: 'free' as const,
    name: 'Free',
    description: 'For students and hobbyists',
    features: FEATURE_BUNDLES.free,
    highlighted: false,
    cta: 'Get Started Free',
  },
  {
    id: 'pro' as const,
    name: 'Professional',
    description: 'For practicing engineers',
    features: FEATURE_BUNDLES.pro,
    highlighted: true,
    badge: 'Most Popular',
    cta: 'Subscribe Now',
  },
  {
    id: 'business' as const,
    name: 'Business',
    description: 'For engineering firms',
    features: FEATURE_BUNDLES.business,
    highlighted: false,
    cta: 'Subscribe Now',
  },
];

export const PricingSection: FC = () => {
  const navigate = useNavigate();
  const [billingCycle, setBillingCycle] = useState<BillingCycle>('monthly');

  return (
    <section id="pricing" className="py-24 sm:py-32 bg-canvas relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <motion.span
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="inline-block text-blue-400 text-xs font-semibold uppercase tracking-[0.2em] mb-5"
          >
            Pricing
          </motion.span>
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-3xl sm:text-4xl font-bold text-[#dae2fd] mb-4"
          >
            Simple, Transparent Pricing
          </motion.h2>
          <p className="text-[#869ab8] max-w-xl mx-auto mb-8">
            All prices in Indian Rupees (₹). No hidden fees.
          </p>

          {/* Billing toggle */}
          <div className="inline-flex items-center gap-2 p-1.5 rounded-full bg-[#131b2e] border border-[#1a2333] shadow-sm">
            <button
              type="button"
              onClick={() => setBillingCycle('monthly')}
              className={`px-5 py-2 rounded-full text-sm font-semibold tracking-wide transition-all ${
                billingCycle === 'monthly'
                  ? 'bg-blue-500 text-white shadow-sm'
                  : 'text-[#869ab8] hover:text-slate-700 dark:hover:text-white'
              }`}
            >
              Monthly
            </button>
            <button
              type="button"
              onClick={() => setBillingCycle('yearly')}
              className={`px-5 py-2 rounded-full text-sm font-semibold tracking-wide transition-all flex items-center gap-2 ${
                billingCycle === 'yearly'
                  ? 'bg-blue-500 text-white shadow-sm'
                  : 'text-[#869ab8] hover:text-slate-700 dark:hover:text-white'
              }`}
            >
              Yearly
              <span className="px-1.5 py-0.5 rounded-full bg-green-500/20 text-green-600 dark:text-green-400 text-[10px] font-bold">
                Save 20%
              </span>
            </button>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {PLANS.map((plan, i) => {
            const price = plan.id === 'free'
              ? 0
              : PRICING_INR[plan.id][billingCycle];

            return (
              <motion.div
                key={plan.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className={`relative rounded-2xl p-6 flex flex-col min-h-[520px] ${
                  plan.highlighted
                    ? 'bg-gradient-to-b from-blue-600/20 to-purple-600/20 border-2 border-blue-500/50 shadow-xl shadow-blue-500/10'
                    : 'ui-surface'
                }`}
              >
                {plan.badge && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-gradient-to-r from-blue-600 to-purple-600 text-white text-xs font-bold">
                    {plan.badge}
                  </div>
                )}

                <h3 className="text-xl font-bold text-[#dae2fd] mb-1">{plan.name}</h3>
                <p className="text-sm text-[#869ab8] mb-4">{plan.description}</p>

                <div className="mb-6">
                  <span className="text-4xl font-bold text-[#dae2fd]">
                    {price === 0 ? '₹0' : formatINR(price)}
                  </span>
                  {price > 0 && (
                    <span className="text-slate-500 ml-2 text-sm">
                      /{billingCycle === 'yearly' ? 'year' : 'month'}
                    </span>
                  )}
                </div>

                <Button
                  onClick={() => navigate(plan.id === 'free' ? '/sign-up' : '/pricing')}
                  className={`w-full mb-6 mt-auto ${
                    plan.highlighted
                      ? 'bg-white text-slate-950 hover:bg-slate-100'
                      : 'border-[#2a344a] hover:border-blue-400/50'
                  }`}
                  variant={plan.highlighted ? 'default' : 'outline'}
                >
                  {plan.cta}
                </Button>

                <ul className="space-y-2.5 flex-1">
                  {plan.features.slice(0, 6).map((feature, j) => (
                    <li key={j} className="flex items-start gap-2.5 text-sm">
                      <Check className={`w-4 h-4 mt-0.5 flex-shrink-0 ${plan.highlighted ? 'text-blue-400' : 'text-slate-500'}`} />
                      <span className="text-[#adc6ff]">{feature}</span>
                    </li>
                  ))}
                </ul>
              </motion.div>
            );
          })}
        </div>

        <div className="text-center mt-8">
          <Button variant="ghost" onClick={() => navigate('/pricing')} className="text-blue-500 hover:text-blue-400">
            View full pricing & feature comparison →
          </Button>
        </div>
      </div>
    </section>
  );
};

export default PricingSection;
