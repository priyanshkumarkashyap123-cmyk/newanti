/**
 * PricingPage - Premium Pricing Tiers
 * Beautiful 3-tier pricing with feature comparison
 */

import { FC, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';

// ============================================
// PRICING DATA
// ============================================

interface PricingTier {
    name: string;
    price: string;
    period: string;
    description: string;
    features: string[];
    notIncluded?: string[];
    cta: string;
    ctaLink: string;
    popular?: boolean;
    badge?: string;
}

const PRICING_TIERS: PricingTier[] = [
    {
        name: 'Free',
        price: '₹0',
        period: 'forever',
        description: 'Perfect for students and learning.',
        features: [
            'Up to 3 projects',
            'Basic 2D & 3D analysis',
            'IS 456 design code',
            'Community support',
            'Basic PDF exports'
        ],
        notIncluded: [
            'Advanced design codes',
            'AI Assistant',
            'Priority support'
        ],
        cta: 'Get Started Free',
        ctaLink: '/sign-up'
    },
    {
        name: 'Pro',
        price: '₹749',
        period: '/month',
        description: 'For professional engineers & firms.',
        features: [
            'Unlimited projects',
            'Advanced 3D analysis engine',
            'All design codes (IS, AISC, ACI, Eurocode)',
            'Full AI Assistant access',
            'Customizable PDF reports',
            'Priority email support',
            'Cloud project backup',
            'Up to 5 team members'
        ],
        cta: 'Start Pro Trial',
        ctaLink: '/sign-up?plan=pro',
        popular: true,
        badge: 'Most Popular'
    },
    {
        name: 'Enterprise',
        price: 'Custom',
        period: '',
        description: 'Maximum power and control.',
        features: [
            'Everything in Pro',
            'API access & integrations',
            'Unlimited team members',
            'SSO & advanced security',
            'Dedicated account manager',
            'Custom training sessions',
            'On-premise deployment option',
            'SLA guarantee'
        ],
        cta: 'Contact Sales',
        ctaLink: '/contact'
    }
];

const FAQ_ITEMS = [
    {
        question: 'Can I switch plans later?',
        answer: 'Absolutely. You can upgrade or downgrade your plan at any time from your account settings. Prorated charges will be applied automatically.'
    },
    {
        question: 'Do you offer student discounts?',
        answer: 'Yes! Students with a valid .edu email or university ID can get Pro plan for 50% off. Contact support for verification.'
    },
    {
        question: 'What payment methods do you accept?',
        answer: 'We accept all major credit/debit cards, UPI, net banking, and wallets through Razorpay. For Enterprise, we also support invoicing.'
    },
    {
        question: 'Is my data secure?',
        answer: 'Security is our top priority. We use industry-standard encryption for data in transit and at rest. Your projects are backed up securely.'
    },
    {
        question: 'Can I get a refund?',
        answer: 'We offer a 7-day money-back guarantee on Pro plans. If you\'re not satisfied, contact support within 7 days of purchase.'
    }
];

// ============================================
// PRICING PAGE COMPONENT
// ============================================

export const PricingPage: FC = () => {
    const navigate = useNavigate();
    const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'yearly'>('monthly');

    const getPrice = (tier: PricingTier) => {
        if (tier.name === 'Free' || tier.name === 'Enterprise') return tier.price;
        if (billingPeriod === 'yearly') {
            return '₹599'; // 20% discount
        }
        return tier.price;
    };

    return (
        <div className="min-h-screen bg-background-light font-display">
            {/* Navbar */}
            <header className="sticky top-0 z-50 w-full border-b border-gray-100 bg-white/95 backdrop-blur">
                <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
                    <Link to="/" className="flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded bg-accent text-steel-blue">
                            <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>architecture</span>
                        </div>
                        <span className="text-xl font-bold tracking-tight text-steel-blue">BeamLab Ultimate</span>
                    </Link>
                    <nav className="hidden md:flex items-center gap-8">
                        <Link to="/#features" className="text-sm font-medium text-steel-blue/80 hover:text-steel-blue">Features</Link>
                        <Link to="/pricing" className="text-sm font-bold text-steel-blue">Pricing</Link>
                        <Link to="/capabilities" className="text-sm font-medium text-steel-blue/80 hover:text-steel-blue">Docs</Link>
                    </nav>
                    <div className="flex items-center gap-4">
                        <Link to="/sign-in" className="text-sm font-bold text-steel-blue hover:underline">Log In</Link>
                        <Link
                            to="/sign-up"
                            className="flex h-10 items-center justify-center rounded-lg bg-steel-blue px-4 text-sm font-bold text-white hover:bg-steel-blue/90"
                        >
                            Get Started
                        </Link>
                    </div>
                </div>
            </header>

            {/* Hero Section */}
            <section className="py-16 px-4 sm:px-6 lg:px-8 text-center bg-gradient-to-b from-white to-background-light">
                <div className="mx-auto max-w-4xl">
                    <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-steel-blue mb-4">
                        Engineering-grade precision,<br />priced for you.
                    </h1>
                    <p className="text-lg text-steel-blue/70 max-w-2xl mx-auto mb-8">
                        Choose the right plan for your structural analysis needs. From learning to enterprise scale.
                    </p>

                    {/* Billing Toggle */}
                    <div className="flex justify-center mb-12">
                        <div className="flex h-12 items-center justify-center rounded-xl bg-gray-100 p-1 w-full max-w-sm">
                            <button
                                onClick={() => setBillingPeriod('monthly')}
                                className={`flex-1 h-full rounded-lg px-4 text-sm font-bold transition-all ${billingPeriod === 'monthly'
                                        ? 'bg-white shadow-sm text-steel-blue'
                                        : 'text-steel-blue/60 hover:text-steel-blue'
                                    }`}
                            >
                                Monthly
                            </button>
                            <button
                                onClick={() => setBillingPeriod('yearly')}
                                className={`flex-1 h-full rounded-lg px-4 text-sm font-bold transition-all flex items-center justify-center gap-2 ${billingPeriod === 'yearly'
                                        ? 'bg-white shadow-sm text-steel-blue'
                                        : 'text-steel-blue/60 hover:text-steel-blue'
                                    }`}
                            >
                                Yearly
                                <span className="bg-green-100 text-green-700 text-[10px] px-1.5 py-0.5 rounded uppercase tracking-wider">
                                    Save 20%
                                </span>
                            </button>
                        </div>
                    </div>
                </div>
            </section>

            {/* Pricing Cards */}
            <section className="pb-20 px-4 sm:px-6 lg:px-8">
                <div className="mx-auto max-w-7xl">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-start">
                        {PRICING_TIERS.map((tier, index) => (
                            <motion.div
                                key={tier.name}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: index * 0.1 }}
                                className={`relative flex flex-col gap-6 rounded-2xl p-8 h-full ${tier.popular
                                        ? 'border-2 border-accent bg-white shadow-xl transform md:-translate-y-4 z-10'
                                        : 'border border-gray-200 bg-white hover:shadow-lg transition-shadow'
                                    }`}
                            >
                                {/* Badge */}
                                {tier.badge && (
                                    <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-accent text-steel-blue text-xs font-bold px-4 py-1.5 rounded-full shadow-sm uppercase tracking-wide">
                                        {tier.badge}
                                    </div>
                                )}

                                {/* Header */}
                                <div className="flex flex-col gap-2">
                                    <h3 className="text-xl font-bold text-steel-blue">{tier.name}</h3>
                                    <p className="text-steel-blue/60 text-sm">{tier.description}</p>
                                    <div className="mt-4 flex items-baseline gap-1 text-steel-blue">
                                        <span className="text-4xl font-bold tracking-tight">{getPrice(tier)}</span>
                                        <span className="text-base font-medium text-steel-blue/60">{tier.period}</span>
                                    </div>
                                </div>

                                {/* CTA Button */}
                                <button
                                    onClick={() => navigate(tier.ctaLink)}
                                    className={`w-full py-3 px-4 rounded-lg text-sm font-bold transition-all ${tier.popular
                                            ? 'bg-accent hover:bg-accent/90 text-steel-blue shadow-md hover:shadow-lg'
                                            : tier.name === 'Enterprise'
                                                ? 'bg-steel-blue hover:bg-steel-blue/90 text-white'
                                                : 'bg-gray-100 hover:bg-gray-200 text-steel-blue'
                                        }`}
                                >
                                    {tier.cta}
                                </button>

                                {/* Features */}
                                <div className="flex flex-col gap-3 mt-2">
                                    {tier.features.map((feature, i) => (
                                        <div key={i} className="flex items-start gap-3 text-sm text-steel-blue/80">
                                            <span className="material-symbols-outlined text-green-500 text-lg flex-shrink-0">check_circle</span>
                                            <span>{feature}</span>
                                        </div>
                                    ))}
                                    {tier.notIncluded?.map((feature, i) => (
                                        <div key={i} className="flex items-start gap-3 text-sm text-steel-blue/40 line-through">
                                            <span className="material-symbols-outlined text-lg flex-shrink-0">cancel</span>
                                            <span>{feature}</span>
                                        </div>
                                    ))}
                                </div>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </section>

            {/* FAQ Section */}
            <section className="py-20 px-4 sm:px-6 lg:px-8 bg-white border-t border-gray-100">
                <div className="mx-auto max-w-3xl">
                    <h2 className="text-3xl font-bold text-steel-blue text-center mb-4">Frequently Asked Questions</h2>
                    <p className="text-steel-blue/70 text-center mb-12">Everything you need to know about pricing and billing.</p>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-8">
                        {FAQ_ITEMS.map((item, i) => (
                            <div key={i} className="flex flex-col gap-2">
                                <h5 className="font-bold text-steel-blue text-lg flex items-center gap-2">
                                    <span className="material-symbols-outlined text-accent">help</span>
                                    {item.question}
                                </h5>
                                <p className="text-steel-blue/70 text-sm leading-relaxed pl-8">
                                    {item.answer}
                                </p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Footer */}
            <footer className="border-t border-gray-100 bg-white py-12 px-4 sm:px-6 lg:px-8">
                <div className="mx-auto max-w-7xl flex flex-col md:flex-row justify-between items-center gap-4">
                    <div className="flex items-center gap-2">
                        <div className="flex h-6 w-6 items-center justify-center rounded bg-accent text-steel-blue">
                            <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>architecture</span>
                        </div>
                        <span className="font-bold text-steel-blue">BeamLab Ultimate</span>
                    </div>
                    <div className="flex gap-6 text-sm text-steel-blue/60">
                        <Link to="/privacy" className="hover:text-accent">Privacy Policy</Link>
                        <Link to="/terms" className="hover:text-accent">Terms of Service</Link>
                        <a href="mailto:support@beamlabultimate.tech" className="hover:text-accent">Support</a>
                    </div>
                    <p className="text-sm text-steel-blue/50">© 2024 BeamLab Ultimate. All rights reserved.</p>
                </div>
            </footer>
        </div>
    );
};

export default PricingPage;
