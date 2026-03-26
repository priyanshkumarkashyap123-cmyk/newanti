/**
 * AppShell.tsx — Shared layout for all authenticated pages
 *
 * Provides:
 * - Collapsible sidebar with FeatureNavigation (all 46+ features)
 * - Top bar with breadcrumbs, search (⌘K), notifications, user menu
 * - Smooth page transitions via <Outlet>
 * - "Open 3D Workspace" quick action
 *
 * NOT used for:
 * - Landing page (/)
 * - Auth pages (/sign-in, /sign-up, etc.)
 * - 3D Modeler (/app, /demo) — has its own full-bleed layout
 * - Legal pages (/privacy-policy, /terms, etc.)
 */

import React, { FC, useState, useEffect, useCallback, Suspense, lazy } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import {
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  Command,
  Home,
  Box as BoxIcon,
  ArrowLeft,
  Bell,
  User,
} from 'lucide-react';
import { UserButton } from '@clerk/clerk-react';
import { Logo } from '../components/branding';
import { BreadcrumbNavigation } from '../components/navigation/BreadcrumbNavigation';
import { FeatureNavigation } from '../components/navigation/FeatureNavigation';
import { PageFooter } from '../components/layout/PageFooter';
import { useAuth } from '../providers/AuthProvider';
import { getRouteTitle } from '../config/appRouteMeta';
import { useNotificationsStore } from '../store/notificationsStore';

// Lazy-load onboarding — only needed on first visit
const OnboardingFlow = lazy(() =>
  import('../components/onboarding/OnboardingFlow').then((m) => ({
    default: m.OnboardingFlow,
  })),
);

// ============================================
// SIDEBAR LOCAL STORAGE KEY
// ============================================

const SIDEBAR_KEY = 'beamlab-sidebar-collapsed';
const ONBOARDING_KEY = 'beamlab-onboarding-completed';

// ============================================
// APP SHELL COMPONENT
// ============================================

export const AppShell: FC<{ children?: React.ReactNode }> = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { isSignedIn } = useAuth();
  const unreadCount = useNotificationsStore((state) => state.unreadCount());

  // Sidebar state (persisted)
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    try {
      return localStorage.getItem(SIDEBAR_KEY) !== 'true';
    } catch {
      return true;
    }
  });

  // Onboarding
  const [showOnboarding, setShowOnboarding] = useState(() => {
    try {
      return localStorage.getItem(ONBOARDING_KEY) !== 'true';
    } catch {
      return false;
    }
  });

  // Persist sidebar state
  const toggleSidebar = useCallback(() => {
    setSidebarOpen((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(SIDEBAR_KEY, String(!next));
      } catch { /* noop */ }
      return next;
    });
  }, []);

  // Close sidebar on mobile when navigating
  useEffect(() => {
    if (window.innerWidth < 1024) {
      const timer = window.setTimeout(() => {
        setSidebarOpen(false);
      }, 0);
      return () => window.clearTimeout(timer);
    }
  }, [location.pathname]);

  const openGlobalCommandPalette = useCallback(() => {
    window.dispatchEvent(new CustomEvent('beamlab:open-command-palette'));
  }, []);

  // Handle onboarding completion
  const handleOnboardingComplete = useCallback(() => {
    setShowOnboarding(false);
    try {
      localStorage.setItem(ONBOARDING_KEY, 'true');
    } catch { /* noop */ }
  }, []);

  // Page title from route
  const pageTitle = getRouteTitle(location.pathname);
  const isDashboardPage = location.pathname.startsWith('/stream');
  const isWorkspacePage = location.pathname.startsWith('/app');
  const isNotificationsPage = location.pathname.startsWith('/notifications');
  const isProfilePage = location.pathname.startsWith('/profile');

  // Set document title
  useEffect(() => {
    document.title = pageTitle === 'BeamLab' ? 'BeamLab Ultimate' : `${pageTitle} | BeamLab`;
  }, [pageTitle]);

  return (
    <div className="flex min-h-[100dvh] bg-canvas overflow-hidden text-token">
      {/* ===================== SIDEBAR ===================== */}
      <aside
        className={`
          fixed lg:relative inset-y-0 left-0 z-40
          flex flex-col
          bg-[var(--color-surface)]
          border-r border-[var(--color-border)]
          transition-all duration-300 ease-in-out
          ${sidebarOpen ? 'w-72 translate-x-0' : 'w-0 lg:w-16 -translate-x-full lg:translate-x-0'}
        `}
      >
        {/* Sidebar Header */}
        <div className="flex items-center justify-between h-14 px-4 border-b border-[var(--color-border)] flex-shrink-0">
          {sidebarOpen ? (
            <>
              <Link to="/stream" className="flex items-center gap-2">
                <Logo size="sm" variant="full" />
              </Link>
              <button
                type="button"
                onClick={toggleSidebar}
                className="p-1.5 rounded-md hover:bg-[color:var(--color-border)] text-[var(--color-text-dim)] hover:text-[var(--color-text)] transition-colors"
                aria-label="Collapse sidebar"
              >
                <PanelLeftClose className="w-4 h-4" />
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={toggleSidebar}
              className="mx-auto p-1.5 rounded-md hover:bg-[color:var(--color-border)] text-[var(--color-text-dim)] hover:text-[var(--color-text)] transition-colors"
              aria-label="Expand sidebar"
            >
              <PanelLeftOpen className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Quick Actions (collapsed mode) */}
        {!sidebarOpen && (
          <div className="flex flex-col items-center gap-1 py-3 px-2 border-b border-[var(--color-border)]">
            <Link
              to="/stream"
              className={`p-2 rounded-lg transition-colors ${
                isDashboardPage
                  ? 'bg-[color:var(--color-border)] text-[var(--color-text)]'
                  : 'hover:bg-[color:var(--color-border)] text-[var(--color-text-dim)] hover:text-[var(--color-text-soft)]'
              }`}
              title="Dashboard"
              aria-current={isDashboardPage ? 'page' : undefined}
              aria-label="Go to dashboard"
            >
              <Home className="w-5 h-5" />
            </Link>
            <Link
              to="/app"
              className={`p-2 rounded-lg transition-colors ${
                isWorkspacePage
                  ? 'bg-[color:var(--color-border)] text-[var(--color-text)]'
                  : 'hover:bg-[color:var(--color-border)] text-[var(--color-text-dim)] hover:text-[var(--color-text-soft)]'
              }`}
              title="3D Workspace"
              aria-current={isWorkspacePage ? 'page' : undefined}
              aria-label="Open 3D workspace"
            >
              <BoxIcon className="w-5 h-5" />
            </Link>
            <button
              type="button"
              onClick={openGlobalCommandPalette}
              className="p-2 rounded-lg hover:bg-[color:var(--color-border)] text-[var(--color-text-dim)] hover:text-[var(--color-text-soft)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/60"
              title="Search (⌘K)"
              aria-label="Open command palette"
            >
              <Search className="w-5 h-5" />
            </button>
          </div>
        )}

        {/* Feature Navigation (expanded mode) */}
        {sidebarOpen && (
          <div className="flex-1 overflow-hidden">
            <FeatureNavigation
              onNavigate={() => {
                // On mobile, close sidebar after navigation
                if (window.innerWidth < 1024) setSidebarOpen(false);
              }}
              searchable
            />
          </div>
        )}

        {/* Sidebar Footer — Open 3D Workspace CTA */}
        {sidebarOpen && (
          <div className="p-3 border-t border-[var(--color-border)] flex-shrink-0">
            <Link
              to="/app"
              className="flex items-center justify-center gap-2 w-full py-2.5 px-4 bg-[#adc6ff] hover:bg-[#4d8eff] text-[#002e6a] hover:text-white text-sm font-bold rounded shadow-[0_2px_8px_rgba(173,198,255,0.2)] transition-all font-['Manrope']"
            >
              <BoxIcon className="w-4 h-4" />
              Open 3D Workspace
            </Link>
          </div>
        )}
      </aside>

      {/* Sidebar overlay (mobile) */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-[var(--color-canvas)]/80 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ===================== MAIN CONTENT ===================== */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Bar */}
        <header className="sticky top-0 h-14 flex items-center justify-between px-4 lg:px-6 border-b border-[var(--color-border)] bg-[var(--color-surface)]/95 backdrop-blur-md supports-[backdrop-filter]:bg-[var(--color-surface)]/85 flex-shrink-0 z-20">
          {/* Left: Hamburger (mobile) + Breadcrumbs */}
          <div className="flex items-center gap-3 min-w-0">
            {/* Mobile menu toggle */}
            <button
              type="button"
              onClick={toggleSidebar}
              className="lg:hidden p-1.5 rounded hover:bg-[color:var(--color-border)] text-[var(--color-text-dim)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/60"
              aria-label="Toggle menu"
            >
              <PanelLeftOpen className="w-5 h-5" />
            </button>

            {/* Collapsed sidebar toggle (desktop) */}
            {!sidebarOpen && (
              <button
                type="button"
                onClick={toggleSidebar}
                className="hidden lg:flex p-1.5 rounded hover:bg-[color:var(--color-border)] text-[var(--color-text-dim)] hover:text-[var(--color-text)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/60"
                aria-label="Expand sidebar"
              >
                <PanelLeftOpen className="w-4 h-4" />
              </button>
            )}

            {/* Page Title + Breadcrumbs */}
            <div className="flex flex-col min-w-0">
              <h1 className="text-sm font-bold text-[var(--color-text)] truncate font-['Manrope']">
                {pageTitle}
              </h1>
              <BreadcrumbNavigation
                className="hidden sm:flex text-xs"
                showHome={false}
                maxItems={3}
              />
            </div>
          </div>

          {/* Right: Search + Notifications + User */}
          <div className="flex items-center gap-2">
            {/* Search trigger */}
            <button
              type="button"
              onClick={openGlobalCommandPalette}
              className="flex items-center gap-2 px-3 py-1.5 text-xs text-[var(--color-text-dim)] bg-[var(--color-canvas)] rounded border border-[var(--color-border)] hover:border-[#adc6ff]/50 hover:text-[var(--color-text)] transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/60"
            >
              <Search className="w-3.5 h-3.5 flex-shrink-0" />
              <span className="hidden sm:inline font-medium tracking-wide">Search</span>
              <kbd className="hidden md:flex items-center gap-0.5 px-1.5 py-0.5 text-[9px] font-bold bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text-soft)] rounded font-['Roboto_Mono']">
                <Command className="w-2.5 h-2.5" /> K
              </kbd>
            </button>

            {/* Open 3D Workspace Quick Button */}
            {location.pathname !== '/app' && location.pathname !== '/stream' && (
              <Link
                to="/app"
                className="hidden md:flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-[#002e6a] bg-[#adc6ff] rounded hover:bg-[#4d8eff] hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/60"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                3D Workspace
              </Link>
            )}

            <button
              type="button"
              onClick={() => navigate('/notifications')}
              className={`relative p-2 rounded border bg-[var(--color-canvas)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/60 ${
                isNotificationsPage
                  ? 'border-[#adc6ff]/70 text-[var(--color-text)]'
                  : 'border-[var(--color-border)] text-[var(--color-text-dim)] hover:text-[var(--color-text)] hover:border-[#adc6ff]/50'
              }`}
              aria-label={`Open notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ''}`}
              aria-current={isNotificationsPage ? 'page' : undefined}
            >
              <Bell className="w-4 h-4" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-4 h-4 px-1 rounded-full bg-[#ffb4ab] text-[#93000a] text-[10px] leading-4 text-center font-bold">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </button>

            <Link
              to="/profile"
              className={`hidden sm:flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-[var(--color-canvas)] rounded border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/60 ${
                isProfilePage
                  ? 'border-[#adc6ff]/70 text-[var(--color-text)]'
                  : 'border-[var(--color-border)] text-[var(--color-text)] hover:border-[#adc6ff]/50'
              }`}
              aria-current={isProfilePage ? 'page' : undefined}
            >
              <User className="w-3.5 h-3.5 text-[var(--color-text-soft)]" />
              Profile
            </Link>

            {/* User button */}
            {isSignedIn && <UserButton afterSignOutUrl="/" />}
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto flex flex-col" id="main-content">
          <div className="flex-1">{children}</div>
          <PageFooter />
        </main>
      </div>

      {/* ===================== ONBOARDING ===================== */}
      {showOnboarding && (
        <Suspense fallback={null}>
          <OnboardingFlow
            onComplete={(_preferences) => {
              handleOnboardingComplete();
              // Dashboard-first entry after onboarding
              navigate('/stream');
            }}
            onSkip={handleOnboardingComplete}
          />
        </Suspense>
      )}
    </div>
  );
};

export default AppShell;
