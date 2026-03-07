/**
 * PageHeader - Standardized Page Header Component
 * 
 * Provides consistent navigation and branding across all pages
 * with mobile-responsive menu and proper accessibility
 */

import { FC, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { UserButton } from '@clerk/clerk-react';
import { useAuth, isUsingClerk } from '../../providers/AuthProvider';
import { Logo } from '../branding';
import { Button } from '../ui/button';
import { cn } from '../../lib/utils';

export interface NavLink {
  to: string;
  label: string;
  external?: boolean;
}

export interface PageHeaderProps {
  /** Additional CSS classes */
  className?: string;
  /** Navigation links to display */
  navLinks?: NavLink[];
  /** Whether to show auth buttons (sign in/sign up) */
  showAuth?: boolean;
  /** Whether header is transparent (becomes solid on scroll) */
  transparent?: boolean;
  /** Additional actions to render in header */
  actions?: React.ReactNode;
}

export const PageHeader: FC<PageHeaderProps> = ({
  className,
  navLinks = [],
  showAuth = true,
  transparent = false,
  actions,
}) => {
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const { isSignedIn, isLoaded, signOut } = useAuth();
  const isClerkEnabled = isUsingClerk();

  // Scroll detection for transparent header
  useEffect(() => {
    if (!transparent) return;
    
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [transparent]);

  const renderAuthButtons = () => {
    if (!showAuth || !isLoaded) return null;

    if (isSignedIn) {
      return (
        <div className="flex items-center gap-3">
          <Button
            onClick={() => navigate('/app')}
            variant="default"
            size="sm"
            className="hidden md:flex"
          >
            Dashboard
          </Button>
          {isClerkEnabled ? (
            <UserButton afterSignOutUrl="/" />
          ) : (
            <Button onClick={() => signOut()} variant="ghost" size="sm">
              Sign Out
            </Button>
          )}
        </div>
      );
    }

    return (
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="sm" className="hidden md:flex">
          <Link to="/sign-in">Log in</Link>
        </Button>
        <Button asChild variant="premium" size="sm">
          <Link to="/sign-up">Get Started</Link>
        </Button>
      </div>
    );
  };

  return (
    <nav
      className={cn(
        'sticky top-0 z-50 transition-all duration-300',
        transparent && !scrolled
          ? 'bg-transparent border-transparent'
          : 'bg-white/90 dark:bg-slate-950/90 backdrop-blur-xl border-b border-slate-200 dark:border-slate-800',
        className
      )}
      role="navigation"
      aria-label="Main navigation"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Logo size="sm" variant="full" href="/" className="flex-shrink-0" />

          {/* Desktop Navigation Links */}
          {navLinks.length > 0 && (
            <div className="hidden md:flex items-center justify-center flex-1 px-8">
              <div className="flex items-center gap-6">
                {navLinks.map((link) => {
                  // Support anchor links for same-page navigation
                  if (link.to.startsWith('#')) {
                    return (
                      <a
                        key={link.to}
                        href={link.to}
                        className="text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors px-2 py-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800"
                      >
                        {link.label}
                      </a>
                    );
                  }
                  // External or internal Router links
                  return (
                    <Link
                      key={link.to}
                      to={link.to}
                      target={link.external ? '_blank' : undefined}
                      rel={link.external ? 'noopener noreferrer' : undefined}
                      className="text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors px-2 py-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800"
                    >
                      {link.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          )}

          {/* Desktop Right Actions */}
          <div className="hidden md:flex items-center gap-3 flex-shrink-0">
            {actions}
            {renderAuthButtons()}
          </div>

          {/* Mobile Menu Button */}
          <Button
            variant="ghost"
            size="icon-sm"
            className="md:hidden"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={mobileMenuOpen}
            aria-controls="mobile-menu"
          >
            {mobileMenuOpen ? (
              <X className="w-5 h-5" aria-hidden="true" />
            ) : (
              <Menu className="w-5 h-5" aria-hidden="true" />
            )}
          </Button>
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div
          id="mobile-menu"
          className="md:hidden bg-white dark:bg-slate-900/95 backdrop-blur-xl border-b border-slate-200 dark:border-slate-800 p-6 space-y-4"
          role="navigation"
          aria-label="Mobile navigation"
        >
          {/* Mobile Navigation Links */}
          {navLinks.map((link) => {
            // Support anchor links for same-page navigation
            if (link.to.startsWith('#')) {
              return (
                <a
                  key={link.to}
                  href={link.to}
                  onClick={() => setMobileMenuOpen(false)}
                  className="block text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white text-base font-medium py-3 px-4 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                >
                  {link.label}
                </a>
              );
            }
            // External or internal Router links
            return (
              <Link
                key={link.to}
                to={link.to}
                onClick={() => setMobileMenuOpen(false)}
                target={link.external ? '_blank' : undefined}
                rel={link.external ? 'noopener noreferrer' : undefined}
                className="block text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white text-base font-medium py-3 px-4 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              >
                {link.label}
              </Link>
            );
          })}

          {/* Mobile Auth Buttons */}
          {showAuth && (
            <>
              <hr className="border-slate-200 dark:border-slate-800 my-4" aria-hidden="true" />
              <div className="space-y-3">
                {!isSignedIn ? (
                  <>
                    <Button asChild variant="ghost" size="lg" className="w-full">
                      <Link to="/sign-in" onClick={() => setMobileMenuOpen(false)}>
                        Log in
                      </Link>
                    </Button>
                    <Button asChild variant="premium" size="lg" className="w-full">
                      <Link to="/sign-up" onClick={() => setMobileMenuOpen(false)}>
                        Get Started
                      </Link>
                    </Button>
                  </>
                ) : (
                  <>
                    <Button asChild variant="default" size="lg" className="w-full">
                      <Link to="/app" onClick={() => setMobileMenuOpen(false)}>
                        Dashboard
                      </Link>
                    </Button>
                    {!isClerkEnabled && (
                      <Button
                        onClick={() => {
                          signOut();
                          setMobileMenuOpen(false);
                        }}
                        variant="ghost"
                        size="lg"
                        className="w-full"
                      >
                        Sign Out
                      </Button>
                    )}
                  </>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </nav>
  );
};
