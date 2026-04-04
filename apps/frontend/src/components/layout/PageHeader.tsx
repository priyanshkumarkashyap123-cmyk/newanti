/**
 * PageHeader - Standardized Page Header Component
 * 
 * Provides consistent navigation and branding across all pages
 * with mobile-responsive menu and proper accessibility
 */

import { FC, useEffect, useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
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
  const location = useLocation();
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

  // Close mobile menu on ESC key press
  useEffect(() => {
    if (!mobileMenuOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMobileMenuOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mobileMenuOpen]);

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
          : 'bg-white/90 dark:bg-[var(--color-canvas)]/90 backdrop-blur-xl border-b border-[var(--color-border)]',
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
                  const isAnchor = link.to.startsWith('#');
                  const isActive = !link.external && !isAnchor && location.pathname === link.to;

                  const sharedClass = cn(
                    'rounded-md px-2 py-1 text-sm font-medium tracking-[0.01em] transition-colors',
                    isActive
                      ? 'bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-white'
                      : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900 dark:text-[var(--color-text-soft)] dark:hover:bg-slate-800 dark:hover:text-[var(--color-text)]',
                  );

                  if (isAnchor) {
                    return (
                      <a
                        key={link.to}
                        href={link.to}
                        className={sharedClass}
                        aria-current={isActive ? 'page' : undefined}
                      >
                        {link.label}
                      </a>
                    );
                  }

                  return (
                    <Link
                      key={link.to}
                      to={link.to}
                      target={link.external ? '_blank' : undefined}
                      rel={link.external ? 'noopener noreferrer' : undefined}
                      className={sharedClass}
                      aria-current={isActive ? 'page' : undefined}
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
          className="md:hidden bg-[var(--color-canvas)] backdrop-blur-xl border-b border-[var(--color-border)] p-6 space-y-4"
          role="navigation"
          aria-label="Mobile navigation"
        >
          {/* Mobile Navigation Links */}
          {navLinks.map((link) => {
            const isAnchor = link.to.startsWith('#');
            const isActive = !link.external && !isAnchor && location.pathname === link.to;
            const linkClass = cn(
              'block rounded-lg px-4 py-3 text-base font-medium tracking-[0.01em] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500',
              isActive
                ? 'bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-white'
                : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900 dark:text-[var(--color-text-soft)] dark:hover:bg-slate-800 dark:hover:text-[var(--color-text)]',
            );

            if (isAnchor) {
              return (
                <a
                  key={link.to}
                  href={link.to}
                  onClick={() => setMobileMenuOpen(false)}
                  className={linkClass}
                  aria-current={isActive ? 'page' : undefined}
                >
                  {link.label}
                </a>
              );
            }

            return (
              <Link
                key={link.to}
                to={link.to}
                onClick={() => setMobileMenuOpen(false)}
                target={link.external ? '_blank' : undefined}
                rel={link.external ? 'noopener noreferrer' : undefined}
                className={linkClass}
                aria-current={isActive ? 'page' : undefined}
              >
                {link.label}
              </Link>
            );
          })}

          {/* Mobile Auth Buttons */}
          {showAuth && (
            <>
              <hr className="border-[var(--color-border)] my-4" aria-hidden="true" />
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
