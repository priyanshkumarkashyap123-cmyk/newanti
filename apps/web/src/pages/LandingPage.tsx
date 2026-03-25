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
import { PageFooter } from '../components/layout/PageFooter';
import { HeroSection } from '../components/landing/HeroSection';
import { TrustBar } from '../components/landing/TrustBar';

// Lazy-loaded below-the-fold sections
const FeaturesSection = lazy(() => import('../components/landing/FeaturesSection'));
const PricingSection = lazy(() => import('../components/landing/PricingSection'));
const FAQSection = lazy(() => import('../components/landing/FAQSection'));

// Reviews section is conditionally rendered
const SHOW_REVIEWS = false;

const LANDING_LINKS: Array<{ href: string; label: string }> = [
  { href: '#features', label: 'Features' },
  { href: '#pricing', label: 'Pricing' },
  { href: '/capabilities', label: 'Capabilities' },
  { href: '/learning', label: 'Learning' },
  { href: '/contact', label: 'Contact' },
  { href: '/integrations', label: 'Integrations' },
];
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

  const closeMobileMenu = useCallback(() => setMobileMenuOpen(false), []);

  const renderAuthButtons = () => {
    if (!isLoaded) {
      // Show skeleton loaders while auth is loading
      return (
        <div className="flex items-center gap-3 animate-pulse">
          <div className="hidden sm:block w-20 h-8 rounded-lg bg-slate-700/40" />
          <div className="w-24 h-8 rounded-full bg-slate-700/40" />
        </div>
      );
    }
    if (isSignedIn) {
      return (
        <div className="flex items-center gap-4">
          <Button onClick={() => navigate('/stream')} variant="default" size="sm" className="hidden md:flex gap-2 shadow-sm shadow-blue-500/20">
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
        <Link to="/sign-in" className="text-sm font-medium tracking-wide text-soft hover:text-[var(--color-text)] transition-colors">
          Log in
        </Link>
        <Button asChild variant="premium" size="default">
          <Link to="/sign-up">Get Started</Link>
        </Button>
      </div>
    );
  };

  return (
    <div className="ui-shell min-h-[100dvh] bg-gradient-to-b from-white via-slate-50 to-white dark:from-slate-950 dark:via-slate-950 dark:to-slate-900 text-slate-900 dark:text-slate-50 font-sans">
      <SEO
        title="Structural Engineering Platform"
        description="Professional structural engineering platform. Design beams, columns, slabs, foundations, and steel connections per IS 456, IS 800, ACI 318, AISC 360, and Eurocode."
        path="/"
      />
      <a href="#main-content" className="skip-link">Skip to main content</a>

      {/* Navbar - Floating Glass Capsule */}
      <nav 
        className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 transition-all duration-500 w-[95%] max-w-7xl
          ${scrolled 
            ? 'py-2 px-4 bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl border border-white/20 dark:border-slate-800/30 rounded-full shadow-[0_8px_32px_rgba(0,0,0,0.12)]' 
            : 'py-4 px-2'}`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-12">
            <Link to="/" className="flex items-center gap-2 group">
              <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-lg flex items-center justify-center shadow-lg shadow-blue-500/20 group-hover:scale-110 transition-transform duration-300">
                <Logo className="w-5 h-5 text-white" />
              </div>
              <span className={`font-bold tracking-tight transition-all duration-300 ${scrolled ? 'text-lg' : 'text-xl'}`}>
                BeamLab<span className="text-blue-600">.</span>
              </span>
            </Link>
            
            {/* Desktop Navigation */}
            <div className="hidden lg:flex items-center gap-1 p-1 rounded-full ui-chip">
              {LANDING_LINKS.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  className="px-4 py-1.5 text-xs font-semibold text-dim hover:text-blue-600 dark:hover:text-blue-400 rounded-full transition-all duration-200 hover:bg-white/80 dark:hover:bg-slate-700/80 shadow-sm"
                >
                  {link.label}
                </a>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden sm:flex items-center gap-3">
              {renderAuthButtons()}
            </div>
            
            {/* Mobile Menu Toggle */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 text-token-muted hover:bg-surface rounded-full"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
        {mobileMenuOpen && (
          <div className="md:hidden border-t ui-divider bg-white/95 dark:bg-slate-950/95 backdrop-blur-xl">
            <div className="px-4 py-4 space-y-3">
              {LANDING_LINKS.map(({ href, label }) => (
                <a
                  key={href}
                  href={href}
                  onClick={closeMobileMenu}
                  className="block text-sm font-medium tracking-wide text-slate-700 dark:text-slate-200 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                >
                  {label}
                </a>
              ))}

              <div className="pt-3 mt-3 border-t ui-divider space-y-2">
                {isLoaded ? (
                  isSignedIn ? (
                    <>
                      <Button
                        onClick={() => {
                          closeMobileMenu();
                          navigate('/stream');
                        }}
                        className="w-full justify-center gap-2"
                      >
                        Open Dashboard <ArrowRight className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => {
                          closeMobileMenu();
                          navigate('/app');
                        }}
                        className="w-full justify-center"
                      >
                        Open 3D Workspace
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button asChild variant="outline" className="w-full justify-center">
                        <Link to="/sign-in" onClick={closeMobileMenu}>Log in</Link>
                      </Button>
                      <Button asChild variant="premium" className="w-full justify-center">
                        <Link to="/sign-up" onClick={closeMobileMenu}>Get Started</Link>
                      </Button>
                    </>
                  )
                ) : (
                  <>
                    <div className="w-full h-10 rounded-lg bg-slate-700/40 animate-pulse" />
                    <div className="w-full h-10 rounded-lg bg-slate-700/40 animate-pulse" />
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </nav>

      <main id="main-content" role="main">
        {!isLoaded ? (
          <section className="pt-24 pb-3 px-4 sm:px-6 lg:px-8">
            <div className="max-w-7xl mx-auto rounded-2xl border border-blue-200/70 dark:border-blue-500/20 bg-blue-50/70 dark:bg-blue-500/[0.08] px-5 py-4 h-20 animate-pulse" />
          </section>
        ) : isSignedIn ? (
          <section className="pt-24 pb-3 px-4 sm:px-6 lg:px-8">
            <div className="max-w-7xl mx-auto rounded-2xl border border-blue-200/70 dark:border-blue-500/20 bg-blue-50/70 dark:bg-blue-500/[0.08] px-5 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-wider font-semibold text-blue-700 dark:text-blue-300">
                  Welcome back
                </p>
                <p className="text-sm text-slate-700 dark:text-slate-200 mt-1">
                  Continue from your dashboard or jump directly into the 3D workspace.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button onClick={() => navigate('/stream')} size="sm" className="gap-1.5">
                  Dashboard <ArrowRight className="w-3.5 h-3.5" />
                </Button>
                <Button onClick={() => navigate('/app')} size="sm" variant="outline">
                  3D Workspace
                </Button>
              </div>
            </div>
          </section>
        ) : null}
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

      {/* Footer */}
      <PageFooter />
    </div>
  );
};

export default LandingPage;
