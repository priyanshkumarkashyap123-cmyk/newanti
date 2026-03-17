/**
 * LandingPage — Orchestrator (< 150 lines)
 *
 * Eager-loads: HeroSection, TrustBar (above-the-fold, critical path)
 * Lazy-loads:  FeaturesSection, PricingSection, FAQSection (below-the-fold)
 *
 * Conditionally renders ReviewsSection only when SHOW_REVIEWS is true.
 */

import { FC, lazy, Suspense, useCallback, useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { UserButton } from '@clerk/clerk-react';
import { Menu, X, ArrowRight } from 'lucide-react';
import { useAuth, isUsingClerk } from '../providers/AuthProvider';
import { SEO } from '../components/SEO';
import { Logo } from '../components/branding';
import { Button } from '../components/ui/button';
import { HeroSection } from '../components/landing/HeroSection';
import { TrustBar } from '../components/landing/TrustBar';

// Lazy-loaded below-the-fold sections
const FeaturesSection = lazy(() => import('../components/landing/FeaturesSection'));
const PricingSection = lazy(() => import('../components/landing/PricingSection'));
const FAQSection = lazy(() => import('../components/landing/FAQSection'));

// Reviews section is conditionally rendered
const SHOW_REVIEWS = false;

const SectionSkeleton: FC = () => (
  <div className="py-24 flex items-center justify-center">
    <div className="w-8 h-8 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
  </div>
);

export const LandingPage: FC = () => {
  const navigate = useNavigate();
  const { isSignedIn, isLoaded, signOut } = useAuth();
  const isClerkEnabled = isUsingClerk();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    document.title = 'BeamLab – Professional Structural Analysis Platform';
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleGetStarted = useCallback(() => {
    navigate(isSignedIn ? '/stream' : '/sign-up');
  }, [isSignedIn, navigate]);

  const renderAuthButtons = () => {
    if (!isLoaded) return null;
    if (isSignedIn) {
      return (
        <div className="flex items-center gap-4">
          <Button onClick={() => navigate('/stream')} variant="default" size="sm" className="hidden md:flex gap-2">
            Open Dashboard <ArrowRight className="w-4 h-4" />
          </Button>
          {isClerkEnabled ? (
            <UserButton afterSignOutUrl="/" />
          ) : (
            <Button onClick={() => signOut()} variant="ghost" size="sm">Sign Out</Button>
          )}
        </div>
      );
    }
    return (
      <div className="flex items-center gap-4">
        <Link to="/sign-in" className="text-sm font-medium text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors">
          Log in
        </Link>
        <Button asChild variant="premium" size="default">
          <Link to="/sign-up">Get Started</Link>
        </Button>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-50 font-sans">
      <SEO
        title="Structural Engineering Platform"
        description="Professional structural engineering platform. Design beams, columns, slabs, foundations, and steel connections per IS 456, IS 800, ACI 318, AISC 360, and Eurocode."
        path="/"
      />
      <a href="#main-content" className="skip-link">Skip to main content</a>

      {/* Navbar */}
      <nav
        className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 ${
          scrolled
            ? 'bg-white/90 dark:bg-slate-950/80 backdrop-blur-xl border-b border-slate-200/60 dark:border-white/[0.06]'
            : 'bg-transparent border-b border-transparent'
        }`}
        role="navigation"
        aria-label="Main navigation"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Logo size="sm" />
            <div className="hidden md:flex items-center justify-center flex-1 px-8 gap-6">
              {[['#features', 'Features'], ['#pricing', 'Pricing'], ['#faq', 'FAQ']].map(([href, label]) => (
                <a key={href} href={href} className="text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors px-2 py-1">
                  {label}
                </a>
              ))}
            </div>
            <div className="hidden md:flex items-center flex-shrink-0">{renderAuthButtons()}</div>
            <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setMobileMenuOpen(!mobileMenuOpen)} aria-label="Toggle menu">
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </Button>
          </div>
        </div>
      </nav>

      <main id="main-content" role="main">
        {/* Eager-loaded above-the-fold sections */}
        <HeroSection onGetStarted={handleGetStarted} />
        <TrustBar />

        {/* Lazy-loaded below-the-fold sections */}
        <Suspense fallback={<SectionSkeleton />}>
          <FeaturesSection />
        </Suspense>
        <Suspense fallback={<SectionSkeleton />}>
          <PricingSection />
        </Suspense>
        {SHOW_REVIEWS && null /* ReviewsSection placeholder */}
        <Suspense fallback={<SectionSkeleton />}>
          <FAQSection />
        </Suspense>
      </main>
    </div>
  );
};

export default LandingPage;
