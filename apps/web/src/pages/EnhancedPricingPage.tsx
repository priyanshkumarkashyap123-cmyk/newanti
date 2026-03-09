/**
 * EnhancedPricingPage.tsx
 *
 * Comprehensive pricing page with:
 * - Feature comparison matrix
 * - FAQ section
 * - Trust signals
 * - Clear CTAs
 */

import React, { FC, memo, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { usePhonePePayment } from '../components/PhonePePayment';
import { useAuth } from '../providers/AuthProvider';
import { SEO } from '../components/SEO';
import { useSubscription } from '../hooks/useSubscription';
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
  MessageSquare,
  Globe,
  Lock,
  Server,
  ShieldCheck,
} from "lucide-react";

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
  ctaVariant: "primary" | "secondary" | "outline";
}

const INDIA_MARKET = {
  country: "India",
  currencyCode: "INR",
  usdToInr: 1, // Prices are now natively in INR
  maxPppDiscount: 0,
};

type MarketMode = "india" | "global";
const MARKET_OVERRIDE_KEY = "beamlab.pricing.market";

const PLANS: PricingPlan[] = [
  {
    id: "free",
    name: "Academic & Hobbyist",
    description: "Perfect for students and learning the fundamentals",
    monthlyPrice: 0,
    yearlyPrice: 0,
    icon: <GraduationCap className="w-6 h-6" />,
    features: [
      "Up to 3 active projects",
      "2D beam & frame analysis",
      "Basic load combinations",
      "IS 456 & ACI 318 design codes",
      "Standard PDF reports",
      "Community forum support",
    ],
    highlighted: false,
    cta: "Start Learning Free",
    ctaVariant: "outline",
  },
  {
    id: "pro",
    name: "Professional",
    description: "For independent practicing structural engineers",
    monthlyPrice: 999,
    yearlyPrice: 799,
    icon: <Zap className="w-6 h-6" />,
    features: [
      "Unlimited projects & storage",
      "Full 3D nonlinear analysis engine",
      "All international design codes",
      "P-Delta, buckling & modal analysis",
      "AI-powered design assistant",
      "Custom branded engineering reports",
      "Priority email & chat support",
      "Cloud backup & multi-device sync",
      "Real-time collaboration (up to 3 users)",
    ],
    highlighted: true,
    badge: "Most Popular",
    cta: "Start 14-Day Free Trial",
    ctaVariant: "primary",
  },
  {
    id: "team",
    name: "Business",
    description: "For growing engineering firms and consultancies",
    monthlyPrice: 1999,
    yearlyPrice: 1599,
    icon: <Users className="w-6 h-6" />,
    features: [
      "Everything in Professional, plus:",
      "Up to 10 team members included",
      "Advanced team project sharing",
      "Centralized admin dashboard",
      "Version history (1-year retention)",
      "REST API access for automation",
      "Dedicated phone & priority support",
    ],
    highlighted: false,
    cta: "Start Business Trial",
    ctaVariant: "secondary",
  },
  {
    id: "enterprise",
    name: "Enterprise",
    description: "For large-scale organizations and global firms",
    monthlyPrice: null,
    yearlyPrice: null,
    icon: <Building2 className="w-6 h-6" />,
    features: [
      "Everything in Business, plus:",
      "Unlimited team members & storage",
      "SSO, SAML & advanced security",
      "On-premise or private cloud deployment",
      "Custom integrations & API limits",
      "Dedicated technical account manager",
      "24/7 priority phone support",
      "99.99% Uptime SLA guarantee",
      "Custom onboarding & team training",
    ],
    highlighted: false,
    cta: "Contact Enterprise Sales",
    ctaVariant: "outline",
  },
];

const FEATURE_MATRIX = [
  {
    category: "Analysis",
    features: [
      {
        name: "2D Frame Analysis",
        free: true,
        pro: true,
        team: true,
        enterprise: true,
      },
      {
        name: "3D Frame Analysis",
        free: false,
        pro: true,
        team: true,
        enterprise: true,
      },
      {
        name: "Plate/Shell Analysis",
        free: false,
        pro: true,
        team: true,
        enterprise: true,
      },
      {
        name: "P-Delta Analysis",
        free: false,
        pro: true,
        team: true,
        enterprise: true,
      },
      {
        name: "Buckling Analysis",
        free: false,
        pro: true,
        team: true,
        enterprise: true,
      },
      {
        name: "Modal Analysis",
        free: false,
        pro: true,
        team: true,
        enterprise: true,
      },
      {
        name: "Time History",
        free: false,
        pro: true,
        team: true,
        enterprise: true,
      },
    ],
  },
  {
    category: "Design Codes",
    features: [
      {
        name: "IS 456, IS 800",
        free: true,
        pro: true,
        team: true,
        enterprise: true,
      },
      {
        name: "AISC 360, ACI 318",
        free: false,
        pro: true,
        team: true,
        enterprise: true,
      },
      {
        name: "Eurocode 2, 3, 8",
        free: false,
        pro: true,
        team: true,
        enterprise: true,
      },
      {
        name: "AS 4100, AS 3600",
        free: false,
        pro: true,
        team: true,
        enterprise: true,
      },
      {
        name: "Custom Code Templates",
        free: false,
        pro: false,
        team: true,
        enterprise: true,
      },
    ],
  },
  {
    category: "Collaboration",
    features: [
      {
        name: "Cloud Storage",
        free: "100 MB",
        pro: "10 GB",
        team: "100 GB",
        enterprise: "Unlimited",
      },
      {
        name: "Real-time Collaboration",
        free: false,
        pro: "3 users",
        team: "10 users",
        enterprise: "Unlimited",
      },
      {
        name: "Version History",
        free: false,
        pro: "30 days",
        team: "90 days",
        enterprise: "Unlimited",
      },
      {
        name: "Team Management",
        free: false,
        pro: false,
        team: true,
        enterprise: true,
      },
    ],
  },
  {
    category: "AI & Advanced",
    features: [
      {
        name: "AI Design Assistant",
        free: false,
        pro: true,
        team: true,
        enterprise: true,
      },
      {
        name: "Parametric Modeling",
        free: false,
        pro: true,
        team: true,
        enterprise: true,
      },
      {
        name: "AR/VR Visualization",
        free: false,
        pro: true,
        team: true,
        enterprise: true,
      },
      {
        name: "BIM/IFC Import",
        free: false,
        pro: true,
        team: true,
        enterprise: true,
      },
      {
        name: "Optimization Engine",
        free: false,
        pro: true,
        team: true,
        enterprise: true,
      },
    ],
  },
  {
    category: "Support",
    features: [
      {
        name: "Community Forum",
        free: true,
        pro: true,
        team: true,
        enterprise: true,
      },
      {
        name: "Email Support",
        free: false,
        pro: true,
        team: true,
        enterprise: true,
      },
      {
        name: "Phone Support",
        free: false,
        pro: false,
        team: true,
        enterprise: true,
      },
      {
        name: "Dedicated Manager",
        free: false,
        pro: false,
        team: false,
        enterprise: true,
      },
      {
        name: "Custom Training",
        free: false,
        pro: false,
        team: false,
        enterprise: true,
      },
    ],
  },
];

const FAQ_ITEMS = [
  {
    q: "Can I switch plans at any time?",
    a: "Yes! You can upgrade or downgrade your plan at any time. When upgrading, you'll get immediate access to new features. When downgrading, the change takes effect at your next billing cycle.",
  },
  {
    q: "Do you offer student or academic discounts?",
    a: "Absolutely! Students and educators with a valid .edu email can get 50% off Professional plans. Academic institutions can contact us for volume licensing.",
  },
  {
    q: "What payment methods do you accept?",
    a: "We accept all major credit cards, debit cards, UPI, net banking, and PayPal. Enterprise customers can pay via invoice with NET-30 terms.",
  },
  {
    q: "Is there a free trial for paid plans?",
    a: "Yes, all paid plans come with a 14-day free trial. No credit card required to start. You'll only be charged if you decide to continue after the trial.",
  },
  {
    q: "What happens to my data if I cancel?",
    a: "Your data remains accessible for 30 days after cancellation. You can export all your projects during this period. After 30 days, data is permanently deleted per our privacy policy.",
  },
  {
    q: "Can I get a refund?",
    a: "We offer a 30-day money-back guarantee on all paid plans. If you're not satisfied, contact support within 30 days of purchase for a full refund.",
  },
  {
    q: "Is my data secure?",
    a: "Security is our top priority. We use AES-256 encryption for data at rest, TLS 1.3 for data in transit, and are SOC 2 Type II certified. Enterprise plans include additional security features.",
  },
  {
    q: "Do you offer on-premise deployment?",
    a: "Yes, our Enterprise plan includes the option for on-premise or private cloud deployment. Contact our sales team to discuss your infrastructure requirements.",
  },
  {
    q: "Do you provide India-specific pricing?",
    a: "Yes. All our prices are in Indian Rupees (₹). We offer UPI-friendly checkout via PhonePe, GST-ready invoicing, and flexible billing options for freelancers, firms, and institutions.",
  },
  {
    q: "Can you provide GST-compliant invoices for Indian teams?",
    a: "Yes. We support GST-ready invoicing workflows for eligible plans and enterprise contracts. Our team can also support procurement documentation for annual purchase orders.",
  },
];

// ============================================
// ENHANCED PRICING PAGE
// ============================================

export const EnhancedPricingPage: FC = () => {
  const navigate = useNavigate();
  const [billingPeriod, setBillingPeriod] = useState<"monthly" | "yearly">(
    "yearly",
  );
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);
  const [showMatrix, setShowMatrix] = useState(false);
  const [marketMode, setMarketMode] = useState<MarketMode>("global");
  const [showPPP, setShowPPP] = useState(false);
  const [upgradeError, setUpgradeError] = useState<string | null>(null);

  // Payment integration
  const { openPayment, loading: paymentLoading } = usePhonePePayment();
  const { isSignedIn, user } = useAuth();
  const { refreshSubscription } = useSubscription();

  useEffect(() => { document.title = 'Pricing | BeamLab'; }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const params = new URLSearchParams(window.location.search);
    const marketParam = params.get("market")?.toLowerCase();
    const savedMarket = window.localStorage.getItem(
      MARKET_OVERRIDE_KEY,
    ) as MarketMode | null;
    const locale = window.navigator.language || "";
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || "";

    const inferredIndia =
      locale.toLowerCase().includes("-in") || timeZone === "Asia/Kolkata";

    let resolvedMarket: MarketMode = inferredIndia ? "india" : "global";

    if (savedMarket === "india" || savedMarket === "global") {
      resolvedMarket = savedMarket;
    }

    if (marketParam === "in" || marketParam === "india") {
      resolvedMarket = "india";
    }

    if (marketParam === "global" || marketParam === "intl") {
      resolvedMarket = "global";
    }

    setMarketMode(resolvedMarket);
    setShowPPP(resolvedMarket === "india");
  }, []);

  const applyMarketMode = (mode: MarketMode) => {
    setMarketMode(mode);
    setShowPPP(mode === "india");

    if (typeof window !== "undefined") {
      window.localStorage.setItem(MARKET_OVERRIDE_KEY, mode);
    }
  };

  const handleGetStarted = async (planId: string) => {
    setUpgradeError(null);

    if (planId === "enterprise") {
      navigate("/contact?subject=enterprise");
      return;
    }

    if (planId === "academic") {
      // Free plan — just sign up
      navigate('/sign-up?plan=academic');
      return;
    }

    // Pro / Business plans — trigger PhonePe checkout
    if (!isSignedIn || !user) {
      navigate(`/sign-up?plan=${planId}`);
      return;
    }

    try {
      const success = await openPayment(
        user.id,
        user.email || '',
        billingPeriod
      );
      if (success) {
        await refreshSubscription();
        navigate('/stream?payment=success');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Payment failed. Please try again.';
      setUpgradeError(message);
      console.error('[Pricing] Payment error:', error);
    }
  };

  const formatPrice = (plan: PricingPlan) => {
    if (plan.monthlyPrice === null) return "Custom";
    if (plan.monthlyPrice === 0) return "₹0";
    const price =
      billingPeriod === "yearly" ? plan.yearlyPrice : plan.monthlyPrice;
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(price!);
  };

  const formatInr = (inrPrice: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(inrPrice);
  };

  const getIndiaPPPPrice = (plan: PricingPlan) => {
    if (plan.monthlyPrice === null || plan.monthlyPrice === 0) {
      return null;
    }

    const baseUsdPrice =
      billingPeriod === "yearly" ? plan.yearlyPrice : plan.monthlyPrice;

    if (!baseUsdPrice) {
      return null;
    }

    const discountedUsdPrice = baseUsdPrice * (1 - INDIA_MARKET.maxPppDiscount);
    return formatInr(discountedUsdPrice);
  };

  return (
    <div className="min-h-screen bg-white dark:bg-slate-950 text-slate-900 dark:text-white">
      <SEO
        title="Pricing"
        description="BeamLab pricing plans for structural engineers. Free, Pro, and Enterprise tiers with full-featured design tools for IS 456, IS 800, ACI 318, and Eurocode."
        path="/pricing"
      />
      {/* Navigation */}
      <nav className="fixed top-0 inset-x-0 z-50 bg-white dark:bg-slate-950/90 backdrop-blur-xl border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-500 flex items-center justify-center">
              <span className="text-white font-bold">B</span>
            </div>
            <span className="font-bold text-lg">BeamLab</span>
          </Link>
          <div className="flex items-center gap-6">
            <Link
              to="/"
              className="text-sm text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
            >
              Home
            </Link>
            <Link
              to="/demo"
              className="text-sm text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
            >
              Demo
            </Link>
            <Link
              to="/sign-in"
              className="text-sm text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
            >
              Sign In
            </Link>
          </div>
        </div>
      </nav>

      {/* PPP Banner */}
      {showPPP && (
        <div className="fixed top-16 inset-x-0 z-40 bg-indigo-600/90 backdrop-blur-md border-b border-indigo-500">
          <div className="max-w-7xl mx-auto px-4 py-2.5 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-3 text-center sm:text-left">
              <Globe className="w-5 h-5 text-indigo-100 shrink-0 hidden sm:block" />
              <p className="text-sm text-indigo-50">
                <strong className="font-semibold text-slate-900 dark:text-white">
                  {marketMode === "india"
                    ? "India pricing support is live."
                    : "Regional pricing support is available."}
                </strong>{" "}
                {marketMode === "india"
                  ? "Apply for PPP-adjusted pricing, INR-friendly billing, and GST-ready invoicing."
                  : "Apply for PPP-adjusted pricing and local payment support."}
              </p>
            </div>
            <div className="flex items-center gap-4 shrink-0">
              <button type="button" className="text-sm font-bold text-slate-900 dark:text-white hover:text-indigo-200 transition-colors whitespace-nowrap underline decoration-indigo-400 underline-offset-2">
                {marketMode === "india"
                  ? "Apply for India Plan"
                  : "Apply for PPP Pricing"}
              </button>
              <button type="button"
                onClick={() => setShowPPP(false)}
                className="text-indigo-200 hover:text-white p-1 rounded-md hover:bg-indigo-500/50 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <section
        className={`pb-16 px-4 transition-all duration-300 ${showPPP ? "pt-40" : "pt-32"}`}
      >
        <div className="max-w-4xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-sm font-medium mb-6"
          >
            <Sparkles className="w-4 h-4" />
            All prices in Indian Rupees (₹). 14-day free trial included.
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-4xl md:text-6xl font-extrabold mb-6 tracking-tight"
          >
            Engineering Excellence, <br className="hidden md:block" />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-500">
              Priced for Growth.
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-xl text-slate-600 dark:text-slate-400 mb-10 max-w-2xl mx-auto"
          >
            Get the modern structural analysis platform that saves you hours on
            every project. No hidden fees, no expensive maintenance contracts.
          </motion.p>

          <div className="inline-flex items-center gap-2 rounded-full border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/70 p-1 mb-10">
            <span className="px-4 py-1.5 rounded-full text-xs font-semibold bg-blue-500 text-white">
              🇮🇳 All prices in ₹ (INR)
            </span>
          </div>

          {/* Billing Toggle */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="inline-flex items-center gap-4 p-1 rounded-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800"
          >
            <button type="button"
              onClick={() => setBillingPeriod("monthly")}
              className={`px-6 py-2 rounded-full text-sm font-medium transition-all ${
                billingPeriod === "monthly"
                  ? "bg-white text-slate-950"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              Monthly
            </button>
            <button type="button"
              onClick={() => setBillingPeriod("yearly")}
              className={`px-6 py-2 rounded-full text-sm font-medium transition-all flex items-center gap-2 ${
                billingPeriod === "yearly"
                  ? "bg-white text-slate-950"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
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
                  ? "bg-gradient-to-b from-blue-600/20 to-purple-600/20 border-2 border-blue-500/50 shadow-xl shadow-blue-500/10"
                  : "bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800"
              }`}
            >
              {plan.badge && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-gradient-to-r from-blue-600 to-purple-600 text-white text-xs font-bold">
                  {plan.badge}
                </div>
              )}

              <div
                className={`p-3 rounded-xl w-fit mb-4 ${
                  plan.highlighted
                    ? "bg-blue-500/20 text-blue-400"
                    : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                }`}
              >
                {plan.icon}
              </div>

              <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-1">{plan.name}</h3>
              <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">{plan.description}</p>

              <div className="mb-6">
                <span className="text-4xl font-bold text-slate-900 dark:text-white">
                  {formatPrice(plan)}
                </span>
                {plan.monthlyPrice !== null && plan.monthlyPrice > 0 && (
                  <span className="text-slate-600 dark:text-slate-400 ml-2">
                    /month {billingPeriod === "yearly" && "(billed yearly)"}
                  </span>
                )}
                {plan.monthlyPrice !== null &&
                  plan.monthlyPrice > 0 && (
                    <p className="text-xs text-emerald-400 mt-2">
                      GST-ready invoicing &amp; UPI checkout available
                    </p>
                  )}
              </div>

              <button type="button"
                onClick={() => handleGetStarted(plan.id)}
                disabled={paymentLoading}
                className={`w-full py-3 rounded-xl font-semibold transition-all mb-6 disabled:opacity-50 disabled:cursor-wait ${
                  plan.ctaVariant === "primary"
                    ? "bg-white text-slate-950 hover:bg-slate-100"
                    : plan.ctaVariant === "secondary"
                      ? "bg-blue-600 text-white hover:bg-blue-500"
                      : "border-2 border-slate-300 dark:border-slate-700 text-white hover:bg-slate-100 dark:bg-slate-800"
                }`}
              >
                {paymentLoading ? 'Processing...' : plan.cta}
              </button>

              {upgradeError && plan.id !== 'academic' && plan.id !== 'enterprise' && (
                <p className="text-xs text-red-400 mb-4 text-center">{upgradeError}</p>
              )}

              <ul className="space-y-3 flex-1">
                {plan.features.map((feature, j) => (
                  <li key={j} className="flex items-start gap-3 text-sm">
                    <Check
                      className={`w-4 h-4 mt-0.5 flex-shrink-0 ${
                        plan.highlighted ? "text-blue-400" : "text-slate-600 dark:text-slate-400"
                      }`}
                    />
                    <span className="text-slate-700 dark:text-slate-300">{feature}</span>
                  </li>
                ))}
              </ul>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Trust Signals */}
      <section className="py-16 px-4 border-t border-slate-200 dark:border-slate-800/50 bg-slate-50 dark:bg-slate-900/20">
        <div className="max-w-7xl mx-auto text-center">
          <p className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-8">
            Trusted by innovative engineering teams worldwide
          </p>
          <div className="flex flex-wrap justify-center items-center gap-8 md:gap-16 opacity-50 grayscale">
            {/* Mock Logos */}
            <div className="flex items-center gap-2 text-xl font-bold">
              <Building2 className="w-6 h-6" /> Arup
            </div>
            <div className="flex items-center gap-2 text-xl font-bold">
              <Building2 className="w-6 h-6" /> Thornton Tomasetti
            </div>
            <div className="flex items-center gap-2 text-xl font-bold">
              <Building2 className="w-6 h-6" /> WSP
            </div>
            <div className="flex items-center gap-2 text-xl font-bold">
              <Building2 className="w-6 h-6" /> Buro Happold
            </div>
            <div className="flex items-center gap-2 text-xl font-bold">
              <Building2 className="w-6 h-6" /> SOM
            </div>
          </div>
        </div>
      </section>

      {/* Sensitive Market Experience */}
      <section className="py-16 px-4 bg-white dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800/50">
        <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-8">
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 p-8">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-semibold mb-5">
              <Globe className="w-4 h-4" />
              {marketMode === "india"
                ? "India-first commercial experience"
                : "Built for sensitive and price-conscious markets"}
            </div>
            <h3 className="text-2xl font-bold mb-3">
              {marketMode === "india"
                ? "Commercial model tuned for Indian firms and institutes"
                : "Regional pricing and flexible procurement that scales"}
            </h3>
            <p className="text-slate-600 dark:text-slate-400 leading-relaxed mb-6">
              {marketMode === "india"
                ? "We support engineering teams across India with PPP-aligned pricing, local payment rails, and procurement-friendly billing so adoption depends on value, not budget friction."
                : "We support teams in cost-sensitive markets with PPP-aligned pricing, practical payment options, and procurement-friendly contracts to reduce adoption friction."}
            </p>
            <div className="grid sm:grid-cols-2 gap-4 text-sm">
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 bg-slate-50 dark:bg-slate-900">
                <p className="text-slate-500 mb-1">PPP Discounts</p>
                <p className="text-slate-900 dark:text-white font-semibold">Up to 60% off</p>
              </div>
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 bg-slate-50 dark:bg-slate-900">
                <p className="text-slate-500 mb-1">Billing</p>
                <p className="text-slate-900 dark:text-white font-semibold">
                  {marketMode === "india"
                    ? "Monthly / Quarterly / Annual PO"
                    : "Monthly / Quarterly / Yearly"}
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 bg-slate-50 dark:bg-slate-900">
                <p className="text-slate-500 mb-1">Payments</p>
                <p className="text-slate-900 dark:text-white font-semibold">
                  {marketMode === "india"
                    ? "UPI, IMPS/NEFT/RTGS, cards"
                    : "Cards, wire transfer, local rails"}
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 bg-slate-50 dark:bg-slate-900">
                <p className="text-slate-500 mb-1">
                  {marketMode === "india"
                    ? "Tax & Invoicing"
                    : "Implementation"}
                </p>
                <p className="text-slate-900 dark:text-white font-semibold">
                  {marketMode === "india"
                    ? "GST-ready invoicing support"
                    : "Priority onboarding assistance"}
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 p-8">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-500/10 text-blue-400 text-xs font-semibold mb-5">
              <ShieldCheck className="w-4 h-4" /> Compliance-first deployments
            </div>
            <h3 className="text-2xl font-bold mb-3">
              Security posture for regulated and sensitive sectors
            </h3>
            <p className="text-slate-600 dark:text-slate-400 leading-relaxed mb-6">
              For infrastructure, government, and enterprise clients, BeamLab
              supports hardened deployment models and governance requirements to
              align with internal risk controls.
            </p>
            <ul className="space-y-3 text-sm">
              <li className="flex items-start gap-3 text-slate-700 dark:text-slate-300">
                <Lock className="w-4 h-4 mt-0.5 text-blue-400" /> Data
                encryption at rest and in transit
              </li>
              <li className="flex items-start gap-3 text-slate-700 dark:text-slate-300">
                <Server className="w-4 h-4 mt-0.5 text-blue-400" /> On-premise /
                private cloud options
              </li>
              <li className="flex items-start gap-3 text-slate-700 dark:text-slate-300">
                <Shield className="w-4 h-4 mt-0.5 text-blue-400" /> SSO/SAML and
                role-based access controls
              </li>
              <li className="flex items-start gap-3 text-slate-700 dark:text-slate-300">
                <Check className="w-4 h-4 mt-0.5 text-blue-400" />{" "}
                Audit-oriented change tracking and logs
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* Feature Comparison Matrix Toggle */}
      <section className="py-12 px-4">
        <div className="max-w-7xl mx-auto">
          <button type="button"
            onClick={() => setShowMatrix(!showMatrix)}
            className="w-full py-4 rounded-xl bg-slate-50 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 font-medium hover:bg-slate-100 dark:bg-slate-800 transition-all flex items-center justify-center gap-2"
          >
            {showMatrix ? "Hide" : "Show"} Full Feature Comparison
            {showMatrix ? (
              <ChevronUp className="w-5 h-5" />
            ) : (
              <ChevronDown className="w-5 h-5" />
            )}
          </button>
        </div>
      </section>

      {/* Feature Comparison Matrix */}
      {showMatrix && (
        <section className="pb-20 px-4">
          <div className="max-w-7xl mx-auto overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800">
                  <th className="text-left py-4 px-4 text-slate-600 dark:text-slate-400 font-medium">
                    Features
                  </th>
                  <th className="text-center py-4 px-4 text-slate-900 dark:text-white font-medium">
                    Starter
                  </th>
                  <th className="text-center py-4 px-4 text-blue-400 font-medium">
                    Professional
                  </th>
                  <th className="text-center py-4 px-4 text-slate-900 dark:text-white font-medium">
                    Team
                  </th>
                  <th className="text-center py-4 px-4 text-slate-900 dark:text-white font-medium">
                    Enterprise
                  </th>
                </tr>
              </thead>
              <tbody>
                {FEATURE_MATRIX.map((category) => (
                  <React.Fragment key={category.category}>
                    <tr className="bg-slate-50 dark:bg-slate-900/50">
                      <td
                        colSpan={5}
                        className="py-3 px-4 text-sm font-semibold text-slate-700 dark:text-slate-300"
                      >
                        {category.category}
                      </td>
                    </tr>
                    {category.features.map((feature, i) => (
                      <tr key={i} className="border-b border-slate-200 dark:border-slate-800/50">
                        <td className="py-3 px-4 text-sm text-slate-600 dark:text-slate-400">
                          {feature.name}
                        </td>
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

      {/* Why Choose BeamLab */}
      <section className="py-24 px-4 bg-white dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Why switch to BeamLab?
            </h2>
            <p className="text-xl text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
              We built BeamLab because we were tired of clunky, expensive legacy
              software that hasn't changed in 20 years.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 mb-20">
            <div className="p-8 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              <div className="w-12 h-12 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center mb-6">
                <Zap className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold mb-3">10x Faster Workflows</h3>
              <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                Our modern, intuitive interface and AI-powered design assistant
                cut modeling and analysis time by up to 80%. Stop fighting the
                UI and start engineering.
              </p>
            </div>
            <div className="p-8 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              <div className="w-12 h-12 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center mb-6">
                <Shield className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold mb-3">No Hidden Costs</h3>
              <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                Say goodbye to expensive "maintenance contracts", paid upgrades,
                and confusing module pricing. You get the full engine, always up
                to date.
              </p>
            </div>
            <div className="p-8 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              <div className="w-12 h-12 rounded-xl bg-green-500/20 text-green-400 flex items-center justify-center mb-6">
                <Users className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold mb-3">
                Built for Collaboration
              </h3>
              <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                Work together in real-time, share projects with a link, and
                access your models from any device. Cloud-native architecture
                for modern teams.
              </p>
            </div>
          </div>

          {/* Legacy Comparison */}
          <div className="max-w-4xl mx-auto bg-slate-50 dark:bg-slate-900/50 rounded-3xl border border-slate-200 dark:border-slate-800 overflow-hidden">
            <div className="grid md:grid-cols-2">
              <div className="p-10 border-b md:border-b-0 md:border-r border-slate-200 dark:border-slate-800">
                <h4 className="text-xl font-bold text-slate-600 dark:text-slate-400 mb-6 flex items-center gap-2">
                  <X className="w-6 h-6 text-red-400" /> Legacy Software
                </h4>
                <ul className="space-y-4">
                  <li className="flex items-start gap-3 text-slate-500">
                    <span className="mt-1 text-red-400/50">✕</span>
                    ₹2,50,000+ upfront license fee
                  </li>
                  <li className="flex items-start gap-3 text-slate-500">
                    <span className="mt-1 text-red-400/50">✕</span>
                    ₹65,000/year mandatory maintenance
                  </li>
                  <li className="flex items-start gap-3 text-slate-500">
                    <span className="mt-1 text-red-400/50">✕</span>
                    Pay extra for design codes & modules
                  </li>
                  <li className="flex items-start gap-3 text-slate-500">
                    <span className="mt-1 text-red-400/50">✕</span>
                    Tied to a single Windows PC
                  </li>
                  <li className="flex items-start gap-3 text-slate-500">
                    <span className="mt-1 text-red-400/50">✕</span>
                    Clunky 1990s user interface
                  </li>
                </ul>
              </div>
              <div className="p-10 bg-blue-900/10">
                <h4 className="text-xl font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-2">
                  <Check className="w-6 h-6 text-blue-400" /> BeamLab
                </h4>
                <ul className="space-y-4">
                  <li className="flex items-start gap-3 text-slate-700 dark:text-slate-300">
                    <Check className="w-5 h-5 text-blue-400 shrink-0" />
                    Simple monthly/yearly subscription
                  </li>
                  <li className="flex items-start gap-3 text-slate-700 dark:text-slate-300">
                    <Check className="w-5 h-5 text-blue-400 shrink-0" />
                    All updates & support included
                  </li>
                  <li className="flex items-start gap-3 text-slate-700 dark:text-slate-300">
                    <Check className="w-5 h-5 text-blue-400 shrink-0" />
                    All codes & features included
                  </li>
                  <li className="flex items-start gap-3 text-slate-700 dark:text-slate-300">
                    <Check className="w-5 h-5 text-blue-400 shrink-0" />
                    Access from any device, anywhere
                  </li>
                  <li className="flex items-start gap-3 text-slate-700 dark:text-slate-300">
                    <Check className="w-5 h-5 text-blue-400 shrink-0" />
                    Modern, lightning-fast web interface
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-20 px-4 bg-slate-50 dark:bg-slate-900/30">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-4">
            Frequently Asked Questions
          </h2>
          <p className="text-center text-slate-600 dark:text-slate-400 mb-12">
            Can't find what you're looking for?{" "}
            <Link to="/contact" className="text-blue-400 hover:underline">
              Contact us
            </Link>
          </p>

          <div className="space-y-4">
            {FAQ_ITEMS.map((faq, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true }}
                className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 overflow-hidden"
              >
                <button type="button"
                  onClick={() => setExpandedFaq(expandedFaq === i ? null : i)}
                  aria-expanded={expandedFaq === i}
                  aria-controls={`faq-answer-${i}`}
                  className="w-full flex items-center justify-between p-5 text-left hover:bg-slate-100 dark:bg-slate-800/50 transition-colors"
                >
                  <span className="font-medium text-slate-900 dark:text-white">{faq.q}</span>
                  {expandedFaq === i ? (
                    <ChevronUp className="w-5 h-5 text-slate-600 dark:text-slate-400" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-slate-600 dark:text-slate-400" />
                  )}
                </button>
                {expandedFaq === i && (
                  <div
                    id={`faq-answer-${i}`}
                    role="region"
                    className="px-5 pb-5 text-slate-600 dark:text-slate-400 text-sm leading-relaxed"
                  >
                    {faq.a}
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 px-4 bg-gradient-to-b from-white dark:from-slate-950 to-blue-50/20 dark:to-blue-950/20 border-t border-slate-200 dark:border-slate-800">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl md:text-5xl font-extrabold mb-6">
            Ready to upgrade your engineering workflow?
          </h2>
          <p className="text-xl text-slate-600 dark:text-slate-400 mb-10 max-w-2xl mx-auto">
            Join thousands of engineers who have already switched to BeamLab.
            Start your 14-day free trial today. No credit card required.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <button type="button"
              onClick={() => handleGetStarted("pro")}
              className="inline-flex items-center gap-2 px-8 py-4 rounded-full bg-blue-600 text-white font-bold hover:bg-blue-500 transition-all shadow-lg shadow-blue-500/25"
            >
              Start Free Trial <ArrowRight className="w-5 h-5" />
            </button>
            <Link
              to="/contact"
              className="inline-flex items-center gap-2 px-8 py-4 rounded-full border-2 border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white font-medium hover:bg-slate-100 dark:bg-slate-800 transition-all"
            >
              <MessageSquare className="w-5 h-5" /> Talk to Sales
            </Link>
          </div>
          <p className="mt-6 text-sm text-slate-500">
            30-day money-back guarantee on all paid plans.
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-200 dark:border-slate-800 py-8 px-4">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-slate-600 dark:text-slate-400 text-sm">
            © {new Date().getFullYear()} BeamLab. All rights reserved.
          </p>
          <div className="flex gap-6">
            <Link
              to="/privacy"
              className="text-slate-600 dark:text-slate-400 text-sm hover:text-slate-900 dark:hover:text-white"
            >
              Privacy
            </Link>
            <Link
              to="/terms"
              className="text-slate-600 dark:text-slate-400 text-sm hover:text-slate-900 dark:hover:text-white"
            >
              Terms
            </Link>
            <Link
              to="/contact"
              className="text-slate-600 dark:text-slate-400 text-sm hover:text-slate-900 dark:hover:text-white"
            >
              Contact
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
};

// Helper component for feature matrix values
const FeatureValue: FC<{ value: boolean | string; highlight?: boolean }> = ({
  value,
  highlight,
}) => {
  if (typeof value === "boolean") {
    return value ? (
      <Check
        className={`w-5 h-5 mx-auto ${highlight ? "text-blue-400" : "text-green-500"}`}
      />
    ) : (
      <X className="w-5 h-5 mx-auto text-slate-700" />
    );
  }
  return (
    <span
      className={`text-sm ${highlight ? "text-blue-400" : "text-slate-700 dark:text-slate-300"}`}
    >
      {value}
    </span>
  );
};

export default memo(EnhancedPricingPage);
