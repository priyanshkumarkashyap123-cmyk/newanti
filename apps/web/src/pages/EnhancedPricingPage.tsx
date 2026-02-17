/**
 * EnhancedPricingPage.tsx
 * 
 * Comprehensive pricing page with:
 * - Feature comparison matrix
 * - FAQ section
 * - Trust signals
 * - Clear CTAs
 */

import React, { FC, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Check,
  X,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  Zap,
  Shield,
  Users,
  Building2,
  GraduationCap,
  Sparkles,
  ArrowRight,
  MessageSquare
} from 'lucide-react';

// ============================================
// PRICING DATA
// ============================================

interface PricingPlan {
  id: string;
  name: string;
  description: string;
  monthlyPrice: number | null;
  yearlyPrice: number | null;
  features: string[];
  highlighted: boolean;
  badge?: string;
  icon: React.ReactNode;
  cta: string;
  ctaVariant: 'primary' | 'secondary' | 'outline';
}

const PLANS: PricingPlan[] = [
  {
    id: 'free',
    name: 'Starter',
    description: 'Perfect for students and learning',
    monthlyPrice: 0,
    yearlyPrice: 0,
    icon: <GraduationCap className="w-6 h-6" />,
    features: [
      'Up to 3 projects',
      '2D beam & frame analysis',
      'Basic load combinations',
      'IS 456 design code',
      'Standard PDF reports',
      'Community support',
    ],
    highlighted: false,
    cta: 'Get Started Free',
    ctaVariant: 'outline'
  },
  {
    id: 'pro',
    name: 'Professional',
    description: 'For practicing engineers',
    monthlyPrice: 49,
    yearlyPrice: 39,
    icon: <Zap className="w-6 h-6" />,
    features: [
      'Unlimited projects',
      'Full 3D analysis engine',
      'All international codes',
      'P-Delta & buckling analysis',
      'AI design assistant',
      'Custom branded reports',
      'Priority email support',
      'Cloud backup & sync',
      'Real-time collaboration (3 users)',
    ],
    highlighted: true,
    badge: 'Most Popular',
    cta: 'Start 14-Day Trial',
    ctaVariant: 'primary'
  },
  {
    id: 'team',
    name: 'Team',
    description: 'For growing engineering teams',
    monthlyPrice: 99,
    yearlyPrice: 79,
    icon: <Users className="w-6 h-6" />,
    features: [
      'Everything in Professional',
      'Up to 10 team members',
      'Team project sharing',
      'Admin dashboard',
      'Version history (90 days)',
      'API access',
      'Phone support',
    ],
    highlighted: false,
    cta: 'Start Team Trial',
    ctaVariant: 'secondary'
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    description: 'For large organizations',
    monthlyPrice: null,
    yearlyPrice: null,
    icon: <Building2 className="w-6 h-6" />,
    features: [
      'Everything in Team',
      'Unlimited team members',
      'SSO & SAML',
      'On-premise deployment option',
      'Custom integrations',
      'Dedicated account manager',
      '24/7 phone support',
      'SLA guarantee',
      'Custom training',
    ],
    highlighted: false,
    cta: 'Contact Sales',
    ctaVariant: 'outline'
  }
];

const FEATURE_MATRIX = [
  { 
    category: 'Analysis',
    features: [
      { name: '2D Frame Analysis', free: true, pro: true, team: true, enterprise: true },
      { name: '3D Frame Analysis', free: false, pro: true, team: true, enterprise: true },
      { name: 'Plate/Shell Analysis', free: false, pro: true, team: true, enterprise: true },
      { name: 'P-Delta Analysis', free: false, pro: true, team: true, enterprise: true },
      { name: 'Buckling Analysis', free: false, pro: true, team: true, enterprise: true },
      { name: 'Modal Analysis', free: false, pro: true, team: true, enterprise: true },
      { name: 'Time History', free: false, pro: true, team: true, enterprise: true },
    ]
  },
  {
    category: 'Design Codes',
    features: [
      { name: 'IS 456, IS 800', free: true, pro: true, team: true, enterprise: true },
      { name: 'AISC 360, ACI 318', free: false, pro: true, team: true, enterprise: true },
      { name: 'Eurocode 2, 3, 8', free: false, pro: true, team: true, enterprise: true },
      { name: 'AS 4100, AS 3600', free: false, pro: true, team: true, enterprise: true },
      { name: 'Custom Code Templates', free: false, pro: false, team: true, enterprise: true },
    ]
  },
  {
    category: 'Collaboration',
    features: [
      { name: 'Cloud Storage', free: '100 MB', pro: '10 GB', team: '100 GB', enterprise: 'Unlimited' },
      { name: 'Real-time Collaboration', free: false, pro: '3 users', team: '10 users', enterprise: 'Unlimited' },
      { name: 'Version History', free: false, pro: '30 days', team: '90 days', enterprise: 'Unlimited' },
      { name: 'Team Management', free: false, pro: false, team: true, enterprise: true },
    ]
  },
  {
    category: 'AI & Advanced',
    features: [
      { name: 'AI Design Assistant', free: false, pro: true, team: true, enterprise: true },
      { name: 'Parametric Modeling', free: false, pro: true, team: true, enterprise: true },
      { name: 'AR/VR Visualization', free: false, pro: true, team: true, enterprise: true },
      { name: 'BIM/IFC Import', free: false, pro: true, team: true, enterprise: true },
      { name: 'Optimization Engine', free: false, pro: true, team: true, enterprise: true },
    ]
  },
  {
    category: 'Support',
    features: [
      { name: 'Community Forum', free: true, pro: true, team: true, enterprise: true },
      { name: 'Email Support', free: false, pro: true, team: true, enterprise: true },
      { name: 'Phone Support', free: false, pro: false, team: true, enterprise: true },
      { name: 'Dedicated Manager', free: false, pro: false, team: false, enterprise: true },
      { name: 'Custom Training', free: false, pro: false, team: false, enterprise: true },
    ]
  }
];

const FAQ_ITEMS = [
  {
    q: 'Can I switch plans at any time?',
    a: 'Yes! You can upgrade or downgrade your plan at any time. When upgrading, you\'ll get immediate access to new features. When downgrading, the change takes effect at your next billing cycle.'
  },
  {
    q: 'Do you offer student or academic discounts?',
    a: 'Absolutely! Students and educators with a valid .edu email can get 50% off Professional plans. Academic institutions can contact us for volume licensing.'
  },
  {
    q: 'What payment methods do you accept?',
    a: 'We accept all major credit cards, debit cards, UPI, net banking, and PayPal. Enterprise customers can pay via invoice with NET-30 terms.'
  },
  {
    q: 'Is there a free trial for paid plans?',
    a: 'Yes, all paid plans come with a 14-day free trial. No credit card required to start. You\'ll only be charged if you decide to continue after the trial.'
  },
  {
    q: 'What happens to my data if I cancel?',
    a: 'Your data remains accessible for 30 days after cancellation. You can export all your projects during this period. After 30 days, data is permanently deleted per our privacy policy.'
  },
  {
    q: 'Can I get a refund?',
    a: 'We offer a 30-day money-back guarantee on all paid plans. If you\'re not satisfied, contact support within 30 days of purchase for a full refund.'
  },
  {
    q: 'Is my data secure?',
    a: 'Security is our top priority. We use AES-256 encryption for data at rest, TLS 1.3 for data in transit, and are SOC 2 Type II certified. Enterprise plans include additional security features.'
  },
  {
    q: 'Do you offer on-premise deployment?',
    a: 'Yes, our Enterprise plan includes the option for on-premise or private cloud deployment. Contact our sales team to discuss your infrastructure requirements.'
  }
];

// ============================================
// ENHANCED PRICING PAGE
// ============================================

export const EnhancedPricingPage: FC = () => {
  const navigate = useNavigate();
  const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'yearly'>('yearly');
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);
  const [showMatrix, setShowMatrix] = useState(false);

  const handleGetStarted = (planId: string) => {
    if (planId === 'enterprise') {
      navigate('/contact?subject=enterprise');
    } else {
      navigate(`/sign-up?plan=${planId}`);
    }
  };

  const formatPrice = (plan: PricingPlan) => {
    if (plan.monthlyPrice === null) return 'Custom';
    if (plan.monthlyPrice === 0) return '$0';
    const price = billingPeriod === 'yearly' ? plan.yearlyPrice : plan.monthlyPrice;
    return `$${price}`;
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Navigation */}
      <nav className="fixed top-0 inset-x-0 z-50 bg-slate-950/90 backdrop-blur-xl border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-500 flex items-center justify-center">
              <span className="text-white font-bold">B</span>
            </div>
            <span className="font-bold text-lg">BeamLab</span>
          </Link>
          <div className="flex items-center gap-6">
            <Link to="/" className="text-sm text-slate-400 hover:text-white transition-colors">Home</Link>
            <Link to="/demo" className="text-sm text-slate-400 hover:text-white transition-colors">Demo</Link>
            <Link to="/sign-in" className="text-sm text-slate-400 hover:text-white transition-colors">Sign In</Link>
          </div>
        </div>
      </nav>

      {/* Header */}
      <section className="pt-32 pb-16 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-sm font-medium mb-6"
          >
            <Sparkles className="w-4 h-4" />
            14-day free trial on all paid plans
          </motion.div>
          
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-4xl md:text-5xl font-bold mb-4"
          >
            Simple pricing for every team
          </motion.h1>
          
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-xl text-slate-400 mb-10"
          >
            Start free, scale as you grow. No hidden fees.
          </motion.p>

          {/* Billing Toggle */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="inline-flex items-center gap-4 p-1 rounded-full bg-slate-900 border border-slate-800"
          >
            <button
              onClick={() => setBillingPeriod('monthly')}
              className={`px-6 py-2 rounded-full text-sm font-medium transition-all ${
                billingPeriod === 'monthly' 
                  ? 'bg-white text-slate-950' 
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setBillingPeriod('yearly')}
              className={`px-6 py-2 rounded-full text-sm font-medium transition-all flex items-center gap-2 ${
                billingPeriod === 'yearly' 
                  ? 'bg-white text-slate-950' 
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Yearly
              <span className="px-2 py-0.5 rounded-full bg-green-500/20 text-green-400 text-xs">
                Save 20%
              </span>
            </button>
          </motion.div>
        </div>
      </section>

      {/* Pricing Cards */}
      <section className="pb-20 px-4">
        <div className="max-w-7xl mx-auto grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {PLANS.map((plan, i) => (
            <motion.div
              key={plan.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 * i }}
              className={`relative rounded-2xl p-6 flex flex-col ${
                plan.highlighted
                  ? 'bg-gradient-to-b from-blue-600/20 to-purple-600/20 border-2 border-blue-500/50 shadow-xl shadow-blue-500/10'
                  : 'bg-slate-900 border border-slate-800'
              }`}
            >
              {plan.badge && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-gradient-to-r from-blue-600 to-purple-600 text-white text-xs font-bold">
                  {plan.badge}
                </div>
              )}

              <div className={`p-3 rounded-xl w-fit mb-4 ${
                plan.highlighted ? 'bg-blue-500/20 text-blue-400' : 'bg-slate-800 text-slate-400'
              }`}>
                {plan.icon}
              </div>

              <h3 className="text-xl font-bold text-white mb-1">{plan.name}</h3>
              <p className="text-sm text-slate-400 mb-4">{plan.description}</p>

              <div className="mb-6">
                <span className="text-4xl font-bold text-white">{formatPrice(plan)}</span>
                {plan.monthlyPrice !== null && plan.monthlyPrice > 0 && (
                  <span className="text-slate-500 ml-2">
                    /month {billingPeriod === 'yearly' && '(billed yearly)'}
                  </span>
                )}
              </div>

              <button
                onClick={() => handleGetStarted(plan.id)}
                className={`w-full py-3 rounded-xl font-semibold transition-all mb-6 ${
                  plan.ctaVariant === 'primary'
                    ? 'bg-white text-slate-950 hover:bg-slate-100'
                    : plan.ctaVariant === 'secondary'
                    ? 'bg-blue-600 text-white hover:bg-blue-500'
                    : 'border-2 border-slate-700 text-white hover:bg-slate-800'
                }`}
              >
                {plan.cta}
              </button>

              <ul className="space-y-3 flex-1">
                {plan.features.map((feature, j) => (
                  <li key={j} className="flex items-start gap-3 text-sm">
                    <Check className={`w-4 h-4 mt-0.5 flex-shrink-0 ${
                      plan.highlighted ? 'text-blue-400' : 'text-slate-600'
                    }`} />
                    <span className="text-slate-300">{feature}</span>
                  </li>
                ))}
              </ul>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Feature Comparison Matrix Toggle */}
      <section className="pb-8 px-4">
        <div className="max-w-7xl mx-auto">
          <button
            onClick={() => setShowMatrix(!showMatrix)}
            className="w-full py-4 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 font-medium hover:bg-slate-800 transition-all flex items-center justify-center gap-2"
          >
            {showMatrix ? 'Hide' : 'Show'} Full Feature Comparison
            {showMatrix ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
          </button>
        </div>
      </section>

      {/* Feature Comparison Matrix */}
      {showMatrix && (
        <section className="pb-20 px-4">
          <div className="max-w-7xl mx-auto overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-800">
                  <th className="text-left py-4 px-4 text-slate-400 font-medium">Features</th>
                  <th className="text-center py-4 px-4 text-white font-medium">Starter</th>
                  <th className="text-center py-4 px-4 text-blue-400 font-medium">Professional</th>
                  <th className="text-center py-4 px-4 text-white font-medium">Team</th>
                  <th className="text-center py-4 px-4 text-white font-medium">Enterprise</th>
                </tr>
              </thead>
              <tbody>
                {FEATURE_MATRIX.map((category) => (
                  <React.Fragment key={category.category}>
                    <tr className="bg-slate-900/50">
                      <td colSpan={5} className="py-3 px-4 text-sm font-semibold text-slate-300">
                        {category.category}
                      </td>
                    </tr>
                    {category.features.map((feature, i) => (
                      <tr key={i} className="border-b border-slate-800/50">
                        <td className="py-3 px-4 text-sm text-slate-400">{feature.name}</td>
                        <td className="py-3 px-4 text-center">
                          <FeatureValue value={feature.free} />
                        </td>
                        <td className="py-3 px-4 text-center bg-blue-500/5">
                          <FeatureValue value={feature.pro} highlight />
                        </td>
                        <td className="py-3 px-4 text-center">
                          <FeatureValue value={feature.team} />
                        </td>
                        <td className="py-3 px-4 text-center">
                          <FeatureValue value={feature.enterprise} />
                        </td>
                      </tr>
                    ))}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* FAQ Section */}
      <section className="py-20 px-4 bg-slate-900/30">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-4">Frequently Asked Questions</h2>
          <p className="text-center text-slate-400 mb-12">
            Can't find what you're looking for? <Link to="/contact" className="text-blue-400 hover:underline">Contact us</Link>
          </p>

          <div className="space-y-4">
            {FAQ_ITEMS.map((faq, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true }}
                className="rounded-xl border border-slate-800 bg-slate-900/50 overflow-hidden"
              >
                <button
                  onClick={() => setExpandedFaq(expandedFaq === i ? null : i)}
                  aria-expanded={expandedFaq === i}
                  aria-controls={`faq-answer-${i}`}
                  className="w-full flex items-center justify-between p-5 text-left hover:bg-slate-800/50 transition-colors"
                >
                  <span className="font-medium text-white">{faq.q}</span>
                  {expandedFaq === i ? (
                    <ChevronUp className="w-5 h-5 text-slate-400" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-slate-400" />
                  )}
                </button>
                {expandedFaq === i && (
                  <div id={`faq-answer-${i}`} role="region" className="px-5 pb-5 text-slate-400 text-sm leading-relaxed">
                    {faq.a}
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-bold mb-4">Still have questions?</h2>
          <p className="text-slate-400 mb-8">
            Our team is here to help you choose the right plan for your needs.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Link
              to="/contact"
              className="inline-flex items-center gap-2 px-8 py-3 rounded-full bg-white text-slate-950 font-bold hover:bg-slate-100 transition-all"
            >
              <MessageSquare className="w-5 h-5" /> Talk to Sales
            </Link>
            <Link
              to="/demo"
              className="inline-flex items-center gap-2 px-8 py-3 rounded-full border-2 border-slate-700 text-white font-medium hover:bg-slate-800 transition-all"
            >
              Try Live Demo <ArrowRight className="w-5 h-5" />
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-800 py-8 px-4">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-slate-500 text-sm">© 2026 BeamLab Ultimate. All rights reserved.</p>
          <div className="flex gap-6">
            <Link to="/privacy" className="text-slate-500 text-sm hover:text-white">Privacy</Link>
            <Link to="/terms" className="text-slate-500 text-sm hover:text-white">Terms</Link>
            <Link to="/contact" className="text-slate-500 text-sm hover:text-white">Contact</Link>
          </div>
        </div>
      </footer>
    </div>
  );
};

// Helper component for feature matrix values
const FeatureValue: FC<{ value: boolean | string; highlight?: boolean }> = ({ value, highlight }) => {
  if (typeof value === 'boolean') {
    return value ? (
      <Check className={`w-5 h-5 mx-auto ${highlight ? 'text-blue-400' : 'text-green-500'}`} />
    ) : (
      <X className="w-5 h-5 mx-auto text-slate-700" />
    );
  }
  return <span className={`text-sm ${highlight ? 'text-blue-400' : 'text-slate-300'}`}>{value}</span>;
};

export default EnhancedPricingPage;
