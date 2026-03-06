/**
 * AppShell.tsx — Shared layout for all authenticated pages
 *
 * Provides:
 * - Collapsible sidebar with FeatureNavigation (all 46+ features)
 * - Top bar with breadcrumbs, search (⌘K), notifications, user menu
 * - Smooth page transitions via <Outlet>
 * - "Back to Workspace" quick action
 *
 * NOT used for:
 * - Landing page (/)
 * - Auth pages (/sign-in, /sign-up, etc.)
 * - 3D Modeler (/app, /demo) — has its own full-bleed layout
 * - Legal pages (/privacy-policy, /terms, etc.)
 */

import React, { FC, useState, useEffect, useCallback, useRef, Suspense, lazy } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import {
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  Command,
  Home,
  Box as BoxIcon,
  ArrowLeft,
  ChevronRight,
  X,
  Bell,
} from 'lucide-react';
import { UserButton } from '@clerk/clerk-react';
import { Logo } from '../components/branding';
import { BreadcrumbNavigation } from '../components/navigation/BreadcrumbNavigation';
import { FeatureNavigation } from '../components/navigation/FeatureNavigation';
import { useAuth } from '../providers/AuthProvider';
import { Dialog, DialogContent } from '../components/ui/dialog';

// Lazy-load onboarding — only needed on first visit
const OnboardingFlow = lazy(() =>
  import('../components/onboarding/OnboardingFlow').then((m) => ({
    default: m.OnboardingFlow,
  })),
);

// ============================================
// QUICK SEARCH DATA
// ============================================

const SEARCH_ITEMS: Array<{
  type: 'page' | 'action' | 'help';
  label: string;
  path: string;
  shortcut?: string;
}> = [
  { type: 'page', label: 'Dashboard', path: '/stream' },
  { type: 'page', label: '3D Modeler', path: '/app' },
  { type: 'page', label: 'Steel Design', path: '/design/steel' },
  { type: 'page', label: 'RC Design', path: '/design/concrete' },
  { type: 'page', label: 'Foundation Design', path: '/design/foundation' },
  { type: 'page', label: 'Connection Design', path: '/design/connections' },
  { type: 'page', label: 'Design Hub', path: '/design-hub' },
  { type: 'page', label: 'Modal Analysis', path: '/analysis/modal' },
  { type: 'page', label: 'Seismic Analysis', path: '/analysis/seismic' },
  { type: 'page', label: 'Pushover Analysis', path: '/analysis/pushover' },
  { type: 'page', label: 'Time History', path: '/analysis/time-history' },
  { type: 'page', label: 'Section Database', path: '/tools/section-database' },
  { type: 'page', label: 'Load Combinations', path: '/tools/load-combinations' },
  { type: 'page', label: 'Bar Bending Schedule', path: '/tools/bar-bending' },
  { type: 'page', label: 'Reports', path: '/reports' },
  { type: 'page', label: 'Space Planning', path: '/space-planning' },
  { type: 'page', label: 'BIM Integration', path: '/bim' },
  { type: 'page', label: 'Materials Database', path: '/materials/database' },
  { type: 'page', label: 'Settings', path: '/settings' },
  { type: 'action', label: 'Open Workspace', path: '/app', shortcut: '⌘⇧W' },
  { type: 'action', label: 'Create New Project', path: '/stream', shortcut: '⌘N' },
  { type: 'help', label: 'Learning Center', path: '/learning' },
  { type: 'help', label: 'Help Center', path: '/help' },
];

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

  // Sidebar state (persisted)
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    try {
      return localStorage.getItem(SIDEBAR_KEY) !== 'true';
    } catch {
      return true;
    }
  });

  // Search modal
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);

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

  // ⌘K shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen(true);
        setTimeout(() => searchRef.current?.focus(), 100);
      }
      if (e.key === 'Escape') setSearchOpen(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // Close sidebar on mobile when navigating
  useEffect(() => {
    if (window.innerWidth < 1024) {
      setSidebarOpen(false);
    }
  }, [location.pathname]);

  // Filter search results
  const filteredSearch = searchQuery
    ? SEARCH_ITEMS.filter((s) =>
        s.label.toLowerCase().includes(searchQuery.toLowerCase()),
      )
    : SEARCH_ITEMS;

  // Handle onboarding completion
  const handleOnboardingComplete = useCallback(() => {
    setShowOnboarding(false);
    try {
      localStorage.setItem(ONBOARDING_KEY, 'true');
    } catch { /* noop */ }
  }, []);

  // Page title from route
  const getPageTitle = (): string => {
    const titles: Record<string, string> = {
      '/stream': 'Dashboard',
      '/design/steel': 'Steel Design',
      '/design/concrete': 'RC Design',
      '/design/foundation': 'Foundation Design',
      '/design/connections': 'Connection Design',
      '/design/detailing': 'RC Detailing',
      '/design-center': 'Design Center',
      '/design-hub': 'Post-Analysis Hub',
      '/analysis/modal': 'Modal Analysis',
      '/analysis/time-history': 'Time History Analysis',
      '/analysis/seismic': 'Seismic Analysis',
      '/analysis/buckling': 'Buckling Analysis',
      '/analysis/pushover': 'Pushover Analysis',
      '/analysis/pdelta': 'P-Delta Analysis',
      '/analysis/cable': 'Cable Analysis',
      '/analysis/nonlinear': 'Nonlinear Analysis',
      '/analysis/dynamic': 'Dynamic Analysis',
      '/analysis/plate-shell': 'Plate & Shell FEM',
      '/analysis/sensitivity-optimization': 'Optimization',
      '/tools/load-combinations': 'Load Combinations',
      '/tools/section-database': 'Section Database',
      '/tools/bar-bending': 'Bar Bending Schedule',
      '/tools/advanced-meshing': 'Advanced Meshing',
      '/tools/print-export': 'Print & Export',
      '/reports': 'Reports',
      '/reports/builder': 'Report Builder',
      '/reports/professional': 'Professional Reports',
      '/bim': 'BIM Integration',
      '/bim/export-enhanced': 'BIM Export',
      '/quantity': 'Quantity Survey',
      '/visualization': 'Visualization Hub',
      '/visualization/3d-engine': '3D Engine',
      '/visualization/result-animation': 'Result Animation',
      '/cad/integration': 'CAD Integration',
      '/collaboration': 'Collaboration Hub',
      '/integrations/api-dashboard': 'API Dashboard',
      '/materials/database': 'Materials Database',
      '/compliance/checker': 'Code Compliance',
      '/connections/database': 'Connection Database',
      '/performance/monitor': 'Performance Monitor',
      '/cloud-storage': 'Cloud Storage',
      '/digital-twin': 'Digital Twin',
      '/space-planning': 'Space Planning',
      '/ai-dashboard': 'AI Dashboard',
      '/ai-power': 'AI Power',
      '/settings': 'Settings',
      '/settings-enhanced': 'Enhanced Settings',
      '/settings/advanced': 'Advanced Settings',
      '/civil/hydraulics': 'Hydraulics',
      '/civil/transportation': 'Transportation',
      '/civil/construction': 'Construction',
    };
    return titles[location.pathname] || 'BeamLab';
  };

  // Set document title
  useEffect(() => {
    const title = getPageTitle();
    document.title = title === 'BeamLab' ? 'BeamLab Ultimate' : `${title} | BeamLab`;
  }, [location.pathname]);

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-950 overflow-hidden">
      {/* ===================== SIDEBAR ===================== */}
      <aside
        className={`
          fixed lg:relative inset-y-0 left-0 z-40
          flex flex-col
          bg-white dark:bg-slate-900
          border-r border-slate-200 dark:border-slate-800
          transition-all duration-300 ease-in-out
          ${sidebarOpen ? 'w-72 translate-x-0' : 'w-0 lg:w-16 -translate-x-full lg:translate-x-0'}
        `}
      >
        {/* Sidebar Header */}
        <div className="flex items-center justify-between h-14 px-4 border-b border-slate-200 dark:border-slate-800 flex-shrink-0">
          {sidebarOpen ? (
            <>
              <Link to="/stream" className="flex items-center gap-2">
                <Logo size="sm" variant="full" />
              </Link>
              <button
                type="button"
                onClick={toggleSidebar}
                className="p-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                aria-label="Collapse sidebar"
              >
                <PanelLeftClose className="w-4 h-4" />
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={toggleSidebar}
              className="mx-auto p-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
              aria-label="Expand sidebar"
            >
              <PanelLeftOpen className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Quick Actions (collapsed mode) */}
        {!sidebarOpen && (
          <div className="flex flex-col items-center gap-1 py-3 px-2 border-b border-slate-200 dark:border-slate-800">
            <Link
              to="/stream"
              className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 hover:text-blue-600 transition-colors"
              title="Dashboard"
            >
              <Home className="w-5 h-5" />
            </Link>
            <Link
              to="/app"
              className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 hover:text-blue-600 transition-colors"
              title="3D Workspace"
            >
              <BoxIcon className="w-5 h-5" />
            </Link>
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 hover:text-blue-600 transition-colors"
              title="Search (⌘K)"
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

        {/* Sidebar Footer — Open Workspace CTA */}
        {sidebarOpen && (
          <div className="p-3 border-t border-slate-200 dark:border-slate-800 flex-shrink-0">
            <Link
              to="/app"
              className="flex items-center justify-center gap-2 w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors"
            >
              <BoxIcon className="w-4 h-4" />
              Open Workspace
            </Link>
          </div>
        )}
      </aside>

      {/* Sidebar overlay (mobile) */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ===================== MAIN CONTENT ===================== */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Bar */}
        <header className="h-14 flex items-center justify-between px-4 lg:px-6 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex-shrink-0 z-20">
          {/* Left: Hamburger (mobile) + Breadcrumbs */}
          <div className="flex items-center gap-3 min-w-0">
            {/* Mobile menu toggle */}
            <button
              type="button"
              onClick={toggleSidebar}
              className="lg:hidden p-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500"
              aria-label="Toggle menu"
            >
              <PanelLeftOpen className="w-5 h-5" />
            </button>

            {/* Collapsed sidebar toggle (desktop) */}
            {!sidebarOpen && (
              <button
                type="button"
                onClick={toggleSidebar}
                className="hidden lg:flex p-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                aria-label="Expand sidebar"
              >
                <PanelLeftOpen className="w-4 h-4" />
              </button>
            )}

            {/* Page Title + Breadcrumbs */}
            <div className="flex flex-col min-w-0">
              <h1 className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                {getPageTitle()}
              </h1>
              <BreadcrumbNavigation
                className="hidden sm:flex text-xs"
                showHome={false}
              />
            </div>
          </div>

          {/* Right: Search + Notifications + User */}
          <div className="flex items-center gap-2">
            {/* Search trigger */}
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              className="flex items-center gap-2 px-3 py-1.5 text-sm text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 transition-all"
            >
              <Search className="w-4 h-4 flex-shrink-0" />
              <span className="hidden sm:inline text-xs">Search</span>
              <kbd className="hidden md:flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-medium bg-slate-200 dark:bg-slate-700 rounded">
                <Command className="w-3 h-3" /> K
              </kbd>
            </button>

            {/* Back to Workspace Quick Button */}
            {location.pathname !== '/app' && location.pathname !== '/stream' && (
              <Link
                to="/app"
                className="hidden md:flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Workspace
              </Link>
            )}

            {/* User button */}
            {isSignedIn && <UserButton afterSignOutUrl="/" />}
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto" id="main-content">
          {children}
        </main>
      </div>

      {/* ===================== SEARCH DIALOG ===================== */}
      <Dialog open={searchOpen} onOpenChange={(open) => !open && setSearchOpen(false)}>
        <DialogContent className="max-w-xl p-0 gap-0 top-[20%] translate-y-0">
          <div className="flex items-center gap-3 p-4 border-b border-slate-200 dark:border-slate-800">
            <Search className="w-5 h-5 text-slate-400 flex-shrink-0" />
            <input
              ref={searchRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search pages, features, help..."
              className="flex-1 bg-transparent text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 outline-none text-sm"
              autoFocus
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="p-1 text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto">
            {filteredSearch.length > 0 ? (
              <div className="p-2">
                {filteredSearch.map((item, i) => (
                  <button
                    type="button"
                    key={i}
                    className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-left"
                    onClick={() => {
                      setSearchOpen(false);
                      setSearchQuery('');
                      navigate(item.path);
                    }}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-2 h-2 rounded-full flex-shrink-0 ${
                          item.type === 'action'
                            ? 'bg-blue-500'
                            : item.type === 'page'
                              ? 'bg-green-500'
                              : 'bg-purple-500'
                        }`}
                      />
                      <span className="text-sm text-slate-900 dark:text-white">
                        {item.label}
                      </span>
                    </div>
                    {item.shortcut && (
                      <kbd className="px-2 py-1 text-xs text-slate-500 bg-slate-100 dark:bg-slate-800 rounded">
                        {item.shortcut}
                      </kbd>
                    )}
                    <ChevronRight className="w-4 h-4 text-slate-300 dark:text-slate-600 flex-shrink-0" />
                  </button>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center text-sm text-slate-500 dark:text-slate-400">
                No results for "{searchQuery}"
              </div>
            )}
          </div>

          <div className="p-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs text-slate-400">
            <span>
              <kbd className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 rounded">↑↓</kbd> Navigate
            </span>
            <span>
              <kbd className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 rounded">↵</kbd> Open
            </span>
            <span>
              <kbd className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 rounded">esc</kbd> Close
            </span>
          </div>
        </DialogContent>
      </Dialog>

      {/* ===================== ONBOARDING ===================== */}
      {showOnboarding && (
        <Suspense fallback={null}>
          <OnboardingFlow
            onComplete={(preferences) => {
              handleOnboardingComplete();
              // Navigate to workspace after onboarding
              navigate('/app');
            }}
            onSkip={handleOnboardingComplete}
          />
        </Suspense>
      )}
    </div>
  );
};

export default AppShell;
