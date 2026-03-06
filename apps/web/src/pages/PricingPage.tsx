/**
 * PricingPage - Premium Pricing Tiers (Dark Theme)
 * Beautiful 3-tier pricing with feature comparison
 * UI/UX Polish: Matches landing page dark theme for consistency
 */

import { FC, useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { usePhonePePayment } from '../components/PhonePePayment';
import { useAuth } from '../providers/AuthProvider';
import { useSubscription } from '../hooks/useSubscription';
import { CheckCircle, X, HelpCircle, ChevronRight, Menu } from 'lucide-react';
const beamLabLogo = '/branding/beamlab_icon_colored.svg';
import { Button } from '../components/ui/button';

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
        answer: 'We accept all major credit/debit cards, UPI, net banking, and wallets through PhonePe. For Enterprise, we also support invoicing.'
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
    useEffect(() => { document.title = 'Pricing - BeamLab'; }, []);

    const navigate = useNavigate();
    const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'yearly'>('monthly');
    const [upgradeError, setUpgradeError] = useState<string | null>(null);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

    // PhonePe payment integration
    const { openPayment, loading: paymentLoading } = usePhonePePayment();
    const { isSignedIn, user } = useAuth();
    const { refreshSubscription } = useSubscription();

    const getPrice = (tier: PricingTier) => {
        if (tier.name === 'Free' || tier.name === 'Enterprise') return tier.price;
        if (billingPeriod === 'yearly') {
            return '₹599'; // 20% discount
        }
        return tier.price;
    };

    // Handle upgrade button click
    const handleUpgradeClick = async (tier: PricingTier) => {
        setUpgradeError(null);

        // Free plan - just navigate to sign up
        if (tier.name === 'Free') {
            navigate(tier.ctaLink);
            return;
        }

        // Enterprise - navigate to contact
        if (tier.name === 'Enterprise') {
            navigate(tier.ctaLink);
            return;
        }

        // Pro plan - trigger PhonePe checkout
        if (!isSignedIn || !user) {
            // User not signed in, navigate to sign up with plan param
            navigate('/sign-up?plan=pro');
            return;
        }

        try {
            const success = await openPayment(
                user.id,
                user.email || '',
                billingPeriod
            );
            if (success) {
                // Payment successful - refresh subscription state and navigate
                await refreshSubscription();
                navigate('/stream?payment=success');
            }
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Payment failed';
            setUpgradeError(message);
            console.error('Payment error:', error);
        }
    };

    return (
        <div className="min-h-screen bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-50 font-sans selection:bg-blue-500/30">
            {/* Navbar - Dark Theme Matching Landing Page */}
            <nav className="fixed top-0 inset-x-0 z-50 border-b border-slate-200 dark:border-white/5 bg-white dark:bg-slate-950/90 backdrop-blur-xl">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex items-center justify-between h-16">
                        {/* Logo */}
                        <Link to="/" className="flex items-center gap-3 group flex-shrink-0">
                            <div className="relative w-9 h-9 flex items-center justify-center">
                                <img src={beamLabLogo} alt="BeamLab" className="w-full h-full object-contain" />
                            </div>
                            <span className="text-lg font-bold bg-clip-text text-transparent bg-gradient-to-r from-slate-900 to-slate-600 dark:from-white dark:to-slate-400 whitespace-nowrap">
                                BeamLab
                            </span>
                        </Link>

                        {/* Desktop Links */}
                        <div className="hidden md:flex items-center justify-center flex-1 px-8">
                            <div className="flex items-center gap-8">
                                <Link to="/#features" className="text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors px-2 py-1">
                                    Features
                                </Link>
                                <Link to="/pricing" className="text-sm font-bold text-slate-900 dark:text-white transition-colors px-2 py-1">
                                    Pricing
                                </Link>
                                <Link to="/help" className="text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors px-2 py-1">
                                    Docs
                                </Link>
                                <Link to="/demo" className="text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors px-2 py-1">
                                    Demo
                                </Link>
                            </div>
                        </div>

                        {/* Auth - Right aligned */}
                        <div className="flex items-center gap-4">
                            {/* Mobile hamburger */}
                            <button
                                type="button"
                                className="md:hidden p-2 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                                aria-label="Toggle menu"
                            >
                                {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
                            </button>
                            <Link to="/sign-in" className="hidden md:inline text-sm font-medium text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors relative group">
                                Log in
                                <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-blue-500 transition-all group-hover:w-full" />
                            </Link>
                            <Link
                                to="/sign-up"
                                className="hidden md:flex items-center gap-2 px-6 py-2.5 rounded-full bg-white text-slate-950 text-sm font-bold hover:bg-blue-50 transition-all shadow-[0_0_15px_rgba(255,255,255,0.2)] hover:shadow-[0_0_25px_rgba(255,255,255,0.4)] hover:scale-105 active:scale-95"
                            >
                                Get Started
                            </Link>
                        </div>
                    </div>
                </div>

                {/* Mobile Menu */}
                <AnimatePresence>
                    {mobileMenuOpen && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="md:hidden border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950"
                        >
                            <div className="px-4 py-4 space-y-2">
                                <Link to="/#features" onClick={() => setMobileMenuOpen(false)} className="block px-3 py-2 rounded-lg text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800">Features</Link>
                                <Link to="/pricing" onClick={() => setMobileMenuOpen(false)} className="block px-3 py-2 rounded-lg text-sm font-bold text-slate-900 dark:text-white bg-slate-100 dark:bg-slate-800">Pricing</Link>
                                <Link to="/help" onClick={() => setMobileMenuOpen(false)} className="block px-3 py-2 rounded-lg text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800">Docs</Link>
                                <Link to="/demo" onClick={() => setMobileMenuOpen(false)} className="block px-3 py-2 rounded-lg text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800">Demo</Link>
                                <hr className="border-slate-200 dark:border-slate-800 my-2" />
                                <Link to="/sign-in" onClick={() => setMobileMenuOpen(false)} className="block px-3 py-2 rounded-lg text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800">Log in</Link>
                                <Link to="/sign-up" onClick={() => setMobileMenuOpen(false)} className="block px-3 py-2.5 rounded-lg text-sm font-bold text-center bg-blue-600 text-white hover:bg-blue-500">Get Started</Link>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </nav>

            {/* Hero Section - Dark Theme */}
            <section className="pt-28 pb-16 px-4 sm:px-6 lg:px-8 text-center relative overflow-hidden">
                {/* Background Blobs */}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full max-w-7xl pointer-events-none">
                    <div className="absolute top-20 left-10 w-[400px] h-[400px] bg-blue-500/20 rounded-full blur-[100px] opacity-40 mix-blend-screen" />
                    <div className="absolute top-40 right-10 w-[300px] h-[300px] bg-purple-500/20 rounded-full blur-[100px] opacity-40 mix-blend-screen" />
                </div>

                <div className="relative mx-auto max-w-4xl">
                    <motion.span
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="inline-block text-blue-400 text-sm font-semibold uppercase tracking-wider mb-4"
                    >
                        Pricing
                    </motion.span>
                    <motion.h1
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="text-4xl md:text-5xl font-bold tracking-tight text-slate-900 dark:text-white mb-4"
                    >
                        Engineering-grade precision,<br />
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-purple-400 to-cyan-400">
                            priced for you.
                        </span>
                    </motion.h1>
                    <motion.p
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                        className="text-lg text-slate-600 dark:text-slate-400 max-w-2xl mx-auto mb-10"
                    >
                        Choose the right plan for your structural analysis needs. From learning to enterprise scale.
                    </motion.p>

                    {/* Billing Toggle - Dark Themed */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                        className="flex justify-center mb-12"
                    >
                        <div className="flex h-12 items-center justify-center rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-1 w-full max-w-sm">
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setBillingPeriod('monthly')}
                                aria-pressed={billingPeriod === 'monthly'}
                                className={`flex-1 h-full rounded-lg px-4 text-sm font-bold transition-all ${billingPeriod === 'monthly'
                                    ? 'bg-slate-100 dark:bg-slate-800 shadow-sm text-slate-900 dark:text-white'
                                    : 'text-slate-600 hover:text-slate-700 dark:text-slate-300'
                                    }`}
                            >
                                Monthly
                            </Button>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setBillingPeriod('yearly')}
                                aria-pressed={billingPeriod === 'yearly'}
                                className={`flex-1 h-full rounded-lg px-4 text-sm font-bold transition-all flex items-center justify-center gap-2 ${billingPeriod === 'yearly'
                                    ? 'bg-slate-100 dark:bg-slate-800 shadow-sm text-slate-900 dark:text-white'
                                    : 'text-slate-600 hover:text-slate-700 dark:text-slate-300'
                                    }`}
                            >
                                Yearly
                                <span className="bg-green-500/20 text-green-400 text-[10px] px-1.5 py-0.5 rounded uppercase tracking-wider">
                                    Save 20%
                                </span>
                            </Button>
                        </div>
                    </motion.div>
                </div>
            </section>

            {/* Pricing Cards - Dark Theme */}
            <section className="pb-24 px-4 sm:px-6 lg:px-8">
                <div className="mx-auto max-w-7xl">
                    {upgradeError && (
                        <div className="mb-6 p-4 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-center">
                            {upgradeError}
                        </div>
                    )}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
                        {PRICING_TIERS.map((tier, index) => (
                            <motion.div
                                key={tier.name}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: index * 0.1 }}
                                className={`relative flex flex-col rounded-2xl sm:rounded-3xl p-6 sm:p-8 h-full ${tier.popular
                                    ? 'bg-slate-50 dark:bg-slate-900 border-2 border-blue-500/50 shadow-2xl shadow-blue-500/10 lg:scale-105 z-10'
                                    : 'bg-white dark:bg-slate-950 border border-slate-200 hover:border-slate-300 dark:border-slate-700 transition-all'
                                    }`}
                            >
                                {/* Badge */}
                                {tier.badge && (
                                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                                        <span className="bg-gradient-to-r from-blue-600 to-purple-600 text-white text-xs font-bold px-4 py-1 rounded-full shadow-lg uppercase tracking-wider whitespace-nowrap">
                                            {tier.badge}
                                        </span>
                                    </div>
                                )}

                                {/* Header */}
                                <div className="mb-6">
                                    <h3 className={`text-xl sm:text-2xl font-bold mb-2 ${tier.popular ? 'text-slate-900 dark:text-white' : 'text-slate-700 dark:text-slate-200'}`}>
                                        {tier.name}
                                    </h3>
                                    <p className="text-sm text-slate-600 dark:text-slate-400">{tier.description}</p>
                                </div>
                                <div className="mb-6 sm:mb-8">
                                    <span className="text-3xl sm:text-4xl font-bold text-slate-900 dark:text-white">{getPrice(tier)}</span>
                                    {tier.period && <span className="text-slate-600 dark:text-slate-400 ml-1">{tier.period}</span>}
                                </div>

                                {/* CTA Button */}
                                <Button
                                    onClick={() => handleUpgradeClick(tier)}
                                    disabled={paymentLoading && tier.name === 'Pro'}
                                    variant={tier.popular ? 'premium' : 'outline'}
                                    size="lg"
                                    className="w-full mb-6 sm:mb-8"
                                >
                                    {paymentLoading && tier.name === 'Pro' ? 'Processing...' : tier.cta}
                                    <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                                </Button>

                                {/* Features */}
                                <ul className="space-y-3 sm:space-y-4 flex-1">
                                    {tier.features.map((feature) => (
                                        <li key={feature} className="flex items-start gap-3 text-sm text-slate-700 dark:text-slate-300">
                                            <CheckCircle className={`w-5 h-5 flex-shrink-0 mt-0.5 ${tier.popular ? 'text-blue-400' : 'text-slate-600 dark:text-slate-400'}`} />
                                            <span>{feature}</span>
                                        </li>
                                    ))}
                                    {tier.notIncluded?.map((feature) => (
                                        <li key={feature} className="flex items-start gap-3 text-sm text-slate-600 dark:text-slate-400 line-through">
                                            <X className="w-5 h-5 flex-shrink-0 mt-0.5 text-slate-400 dark:text-slate-600" />
                                            <span>{feature}</span>
                                        </li>
                                    ))}
                                </ul>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </section>

            {/* FAQ Section - Dark Theme */}
            <section className="py-20 px-4 sm:px-6 lg:px-8 bg-slate-50 dark:bg-slate-900/50 border-t border-slate-200 dark:border-slate-800">
                <div className="mx-auto max-w-3xl">
                    <motion.div
                        initial={{ opacity: 0 }}
                        whileInView={{ opacity: 1 }}
                        viewport={{ once: true }}
                        className="text-center mb-12"
                    >
                        <span className="inline-block text-blue-400 text-sm font-semibold uppercase tracking-wider mb-4">
                            FAQ
                        </span>
                        <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-4">Frequently Asked Questions</h2>
                        <p className="text-slate-600 dark:text-slate-400">Everything you need to know about pricing and billing.</p>
                    </motion.div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-8">
                        {FAQ_ITEMS.map((item, i) => (
                            <motion.div
                                key={i}
                                initial={{ opacity: 0, y: 20 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ delay: i * 0.05 }}
                                className="flex flex-col gap-2"
                            >
                                <h3 className="font-bold text-slate-900 dark:text-white text-lg flex items-center gap-2">
                                    <HelpCircle className="w-5 h-5 text-blue-400" />
                                    {item.question}
                                </h3>
                                <p className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed pl-7">
                                    {item.answer}
                                </p>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Footer - Dark Theme */}
            <footer className="border-t border-slate-200 dark:border-slate-800 py-12 px-4 sm:px-6 lg:px-8 bg-white dark:bg-slate-950">
                <div className="mx-auto max-w-7xl flex flex-col md:flex-row justify-between items-center gap-4">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 flex items-center justify-center">
                            <img src={beamLabLogo} alt="BeamLab" className="w-full h-full object-contain" />
                        </div>
                        <span className="text-xl font-bold text-slate-900 dark:text-white">BeamLab</span>
                    </div>
                    <div className="flex gap-6 text-sm text-slate-600 dark:text-slate-400">
                        <Link to="/privacy" className="hover:text-slate-900 dark:hover:text-white transition-colors">Privacy Policy</Link>
                        <Link to="/terms" className="hover:text-slate-900 dark:hover:text-white transition-colors">Terms of Service</Link>
                        <a href="mailto:support@beamlab.app" className="hover:text-slate-900 dark:hover:text-white transition-colors">Support</a>
                    </div>
                    <p className="text-sm text-slate-600 dark:text-slate-400">© {new Date().getFullYear()} BeamLab. All rights reserved.</p>
                </div>
            </footer>
        </div>
    );
};

export default PricingPage;
