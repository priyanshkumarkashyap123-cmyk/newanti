/**
 * App - Main Application Component with Routing
 * Routes between Landing, Dashboard, and Workspace
 */

import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import React, { Suspense, lazy } from 'react';
import { ScrollToTop } from './components/ScrollToTop';
import { RouteMetaTags } from './components/RouteMetaTags';

// Lazy-load components that use framer-motion to avoid loading ~45KB on every page
const BackToTopButton = lazy(() =>
  import('./components/BackToTopButton').then((m) => ({ default: m.BackToTopButton })),
);
const CookieConsent = lazy(() =>
  import('./components/CookieConsent').then((m) => ({ default: m.CookieConsent })),
);

// Auth/layout (small, needed on every route)
import { RequireAuth } from './components/layout/RequireAuth';
import { useAuth } from './providers/AuthProvider';
import { ErrorBoundary } from './components/ErrorBoundary';
import './App.css';

// Landing & Auth pages lazy-loaded (only needed on their specific routes)
const LandingPage = lazy(() =>
  import('./pages/LandingPage').then((m) => ({ default: m.LandingPage })),
);

import { SkipLink } from './components/ui/SkipLink';
import { OfflineBanner } from './components/ui/OfflineBanner';

// Lazy loaded components (Code Splitting)
const Dashboard = lazy(() =>
  import('./pages/Dashboard').then((module) => ({ default: module.Dashboard })),
);
const UnifiedDashboard = lazy(() =>
  import('./pages/UnifiedDashboard').then((module) => ({
    default: module.UnifiedDashboard,
  })),
);
const Capabilities = lazy(() =>
  import('./pages/Capabilities').then((module) => ({
    default: module.Capabilities,
  })),
);
const SettingsPage = lazy(() =>
  import('./pages/SettingsPage').then((module) => ({
    default: module.SettingsPage,
  })),
);
const EnhancedPricingPage = lazy(() =>
  import('./pages/EnhancedPricingPage').then((module) => ({
    default: module.EnhancedPricingPage,
  })),
);

// Civil Engineering Suite (Lazy Loaded)
const CivilEngineeringBookLanding = lazy(() => import('./app/civil-engineering/library/page'));
const BookApp = lazy(() =>
  import('./modules/civil-engine/components/BookApp').then((module) => ({
    default: module.BookApp,
  })),
);
const RealisticBook = lazy(() =>
  import('./modules/civil-engine/components/RealisticBook').then((module) => ({
    default: module.RealisticBook,
  })),
);
const TransportationDesigner = lazy(() =>
  import('./modules/civil-engine/components/TransportationDesigner').then((module) => ({
    default: module.TransportationDesigner,
  })),
);
const ConstructionManager = lazy(() =>
  import('./modules/civil-engine/components/ConstructionManager').then((module) => ({
    default: module.ConstructionManager,
  })),
);
const HydraulicsDesigner = lazy(() =>
  import('./modules/civil-engine/components/HydraulicsDesigner').then((module) => ({
    default: module.HydraulicsDesigner,
  })),
);

const ModernModeler = lazy(() =>
  import('./components/ModernModeler').then((module) => ({
    default: module.ModernModeler,
  })),
);
const MobileGuard = lazy(() =>
  import('./components/ui/MobileGuard').then((m) => ({ default: m.MobileGuard })),
);
const RustWasmDemo = lazy(() =>
  import('./pages/RustWasmDemo').then((module) => ({
    default: module.RustWasmDemo,
  })),
);
const NafemsBenchmarkPage = lazy(() =>
  import('./pages/NafemsBenchmarkPage').then((module) => ({
    default: module.NafemsBenchmarkPage,
  })),
);
const UIShowcase = lazy(() =>
  import('./pages/UIShowcase').then((module) => ({
    default: module.UIShowcase,
  })),
);
const ErrorReportPage = lazy(() => import('./pages/ErrorReportPage'));

// Auth & Info Pages (Lazy Loaded) - All have default exports
const ReportsPage = lazy(() => import('./pages/ReportsPage'));
const WorkerValidation = lazy(() => import('./components/WorkerValidation'));

// New Feature Pages (Phase 17: BBS Engine + Plate/Shell FEM)

// Enhanced Analysis Pages (CEO Industry Gap Closure - Phase 14)

// New core pages (Phase 1 implementation)
const BlogPage = lazy(() => import('./pages/BlogPage'));
const NotificationsPage = lazy(() => import('./pages/NotificationsPage'));
const ProfilePage = lazy(() => import('./pages/ProfilePage'));

// Phase 15/16 and gap-closure route pages moved to app/routes/FeatureRoutes.tsx

// AI Power Dashboard (Lazy Loaded)
const AIPowerDashboard = lazy(() =>
  import('./components/ai/AIPowerDashboard').then((module) => ({
    default: module.AIPowerDashboard,
  })),
);
const PowerAIPanel = lazy(() =>
  import('./components/ai/PowerAIPanel').then((module) => ({
    default: module.PowerAIPanel,
  })),
);

// 404 Page
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'));

// Shared layout shell for authenticated pages (sidebar, topbar, search, breadcrumbs)
const AppShell = lazy(() => import('./layouts/AppShell'));

// Phase 18: Missing pages (audit gap closure)

// Analytics Provider — sends events to POST /api/analytics/batch
import { AnalyticsProvider } from './providers/AnalyticsProvider';

// Loading Component — route-aware with better UX
import { DashboardSkeleton } from './components/ui/DashboardSkeleton';
import { DesignPageSkeleton } from './components/ui/DesignPageSkeleton';
const PageLoader = () => (
  <div
    className="flex items-center justify-center min-h-screen bg-[#0b1326]"
    role="status"
    aria-live="polite"
  >
    <div className="flex flex-col items-center gap-4">
      <div className="relative">
        <div
          className="w-14 h-14 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin"
          aria-hidden="true"
        ></div>
        <div
          className="absolute inset-0 w-14 h-14 border-4 border-transparent border-b-indigo-400/40 rounded-full animate-spin"
          style={{ animationDirection: 'reverse', animationDuration: '1.5s' }}
          aria-hidden="true"
        ></div>
      </div>
      <div className="text-center">
        <p className="text-slate-600 dark:text-slate-300 text-sm font-medium tracking-wide tracking-wide">
          Loading Module
        </p>
        <p className="text-[#424754] text-xs mt-0.5">
          Preparing workspace...
        </p>
      </div>
    </div>
  </div>
);

// Performance Testing Utility - already imported at top of file

// ============================================
// MAIN APP WITH ROUTING
// ============================================

// Hooks
import { useUserRegistration } from './hooks/useUserRegistration';
import { useDeviceSession } from './hooks/useDeviceSession';
import { useGlobalErrorHandler } from './hooks/useGlobalErrorHandler';
import { SectionErrorBoundary } from './components/SectionErrorBoundary';
import { useEffect } from 'react';
import { initializeIntegration } from './core/StoreIntegration';
import { isFullScreenRoute, isPublicRoute } from './config/appRouteMeta';
import { PAYMENT_CONFIG } from './config/env';
import { ROUTE_ALIASES } from './app/routes/routeAliases';
import { DesignRoutes } from './app/routes/DesignRoutes';
import { AnalysisRoutes } from './app/routes/AnalysisRoutes';
import { FeatureRoutes } from './app/routes/FeatureRoutes';
import { AuthRoutes } from './app/routes/AuthRoutes';
import { InfoRoutes } from './app/routes/InfoRoutes';
import { JourneyProvider } from './providers/JourneyProvider';

// ============================================
// CONDITIONAL LAYOUT — wraps authenticated pages in AppShell
// ============================================
function ConditionalLayout({ children }: { children: React.ReactNode }) {
  const { pathname } = useLocation();
  const { isSignedIn, isLoaded } = useAuth();

  const isPublic = isPublicRoute(pathname);
  const isFullScreen = isFullScreenRoute(pathname);

  // Public & full-screen routes render without AppShell
  if (isPublic || isFullScreen) {
    return <main id="main-content">{children}</main>;
  }

  // While auth is loading, show a spinner
  if (!isLoaded) {
    return <PageLoader />;
  }

  // Non-authenticated users see pages without AppShell (RequireAuth on individual routes handles redirect)
  if (!isSignedIn) {
    return <main id="main-content">{children}</main>;
  }

  // Authenticated users see the full shell: sidebar + topbar + breadcrumbs + search
  return (
    <Suspense fallback={<PageLoader />}>
      <AppShell>{children}</AppShell>
    </Suspense>
  );
}

function App() {
  const forcePaymentTestMode = PAYMENT_CONFIG.forcePaymentTestMode;

  // Ensure user is registered in MongoDB upon login/load
  useUserRegistration();

  // Manage device session lifecycle (register, heartbeat, cleanup)
  useDeviceSession();

  // Capture unhandled errors & promise rejections globally
  useGlobalErrorHandler();

  // Initialize StructuralBufferPool ↔ Zustand sync + CommandHistory
  // This wires up the SoA TypedArray layer for zero-copy WASM/Worker transfer
  useEffect(() => {
    initializeIntegration();
  }, []);

  return (
    <ErrorBoundary>
      <SkipLink />
      <OfflineBanner />
      <AnalyticsProvider>
        <JourneyProvider>
          <Suspense fallback={<PageLoader />}>
            <ScrollToTop />
            <RouteMetaTags />
            <ConditionalLayout>
              <Routes>
              {/* Landing Page */}
              <Route path="/" element={<LandingPage />} />
              {/* Enhanced Landing Page - NEW Advanced Template */}
              {/* Stream Dashboard - Main Entry Point (Now uses UnifiedDashboard) */}
              <Route
                path="/stream"
                element={
                  <RequireAuth>
                    <Suspense fallback={<DashboardSkeleton />}>
                      <SectionErrorBoundary section="Dashboard">
                        <UnifiedDashboard />
                      </SectionErrorBoundary>
                    </Suspense>
                  </RequireAuth>
                }
              />
              {/* Legacy aliases */}
              {ROUTE_ALIASES.map(({ from, to }) => (
                <Route key={from} path={from} element={<Navigate to={to} replace />} />
              ))}
              {/* Capabilities Page */}
              <Route path="/capabilities" element={<Capabilities />} />
              {/* Custom Auth Pages */}
              {/* Settings Page */}
              {/* Settings Page */}
              <Route
                path="/settings"
                element={
                  <RequireAuth>
                    <SettingsPage />
                  </RequireAuth>
                }
              />
              {/* Legacy settings aliases */}
              <Route path="/settings-enhanced" element={<Navigate to="/settings" replace />} />
              <Route path="/settings/advanced" element={<Navigate to="/settings" replace />} />
              {/* Pricing Page */}
              <Route path="/pricing" element={<EnhancedPricingPage />} />
              <Route path="/pricing-old" element={<Navigate to="/pricing" replace />} />
              {/* Blog */}
              <Route path="/blog" element={<BlogPage />} />
              {/* Forgot Password */}
              {/* Reset Password */}
              {/* Privacy Policy - New comprehensive page for Clerk */}
              {/* Terms of Service - New comprehensive page for Clerk */}
              {/* Terms and Conditions - Comprehensive legal T&C (IT Act 2000, Rewa jurisdiction) */}
              {/* Refund and Cancellation Policy */}
              {/* Help & Tutorials */}
              {/* About & Contact */}
              {/* Civil Engineering – Book-style Interface */}
              <Route path="/civil-engineering/library" element={<CivilEngineeringBookLanding />} />
              <Route path="/civil-engineering/book" element={<BookApp />} />
              <Route path="/civil-engineering/book/realistic" element={<RealisticBook />} />
              {/* Civil Engineering Suite - NEW Modules */}
              <Route
                path="/civil/hydraulics"
                element={
                  <RequireAuth>
                    <HydraulicsDesigner />
                  </RequireAuth>
                }
              />
              <Route
                path="/civil/transportation"
                element={
                  <RequireAuth>
                    <TransportationDesigner />
                  </RequireAuth>
                }
              />
              <Route
                path="/civil/construction"
                element={
                  <RequireAuth>
                    <ConstructionManager />
                  </RequireAuth>
                }
              />
              {/* Reports */}
              {/* Reports */}
              <Route
                path="/reports"
                element={
                  <RequireAuth>
                    <ReportsPage />
                  </RequireAuth>
                }
              />
              <Route
                path="/notifications"
                element={
                  <RequireAuth>
                    <NotificationsPage />
                  </RequireAuth>
                }
              />
              <Route
                path="/profile"
                element={
                  <RequireAuth>
                    <ProfilePage />
                  </RequireAuth>
                }
              />
              {/* Main App - Modern Modeler with integrated sidebar */}
              {/* Main App - Modern Modeler with integrated sidebar */}
              <Route
                path="/app"
                element={
                  <RequireAuth>
                    <MobileGuard>
                      <SectionErrorBoundary section="3D Editor">
                        <Suspense fallback={<DesignPageSkeleton />}>
                          <ModernModeler />
                        </Suspense>
                      </SectionErrorBoundary>
                    </MobileGuard>
                  </RequireAuth>
                }
              />
              {/* Demo Route - Modern Modeler */}
              <Route
                path="/demo"
                element={forcePaymentTestMode ? <Navigate to="/pricing" replace /> : (
                  <MobileGuard>
                    <ModernModeler />
                  </MobileGuard>
                )}
              />
              {/* UI Component Showcase - Phase 13+ Integration Demo */}
              <Route path="/ui-showcase" element={<UIShowcase />} />
              {/* Codebase Error & Health Report */}
              <Route path="/error-report" element={<ErrorReportPage />} />
              {/* AI Power Dashboard - NEW C-Suite Analytics */}
              <Route
                path="/ai-dashboard"
                element={
                  <RequireAuth>
                    <AIPowerDashboard />
                  </RequireAuth>
                }
              />
              {/* AI Power Panel - Next-Gen AI Interface */}
              <Route
                path="/ai-power"
                element={
                  <RequireAuth>
                    <PowerAIPanel />
                  </RequireAuth>
                }
              />
              {/* Rust WASM Performance Demo */}
              <Route path="/rust-wasm-demo" element={<RustWasmDemo />} />
              {/* NAFEMS Benchmark Validation */}
              <Route path="/nafems-benchmarks" element={<NafemsBenchmarkPage />} />
              {/* Worker Validation Route */}
              <Route path="/worker-test" element={<WorkerValidation />} />
              {/* Analysis domain routes */}
              {AnalysisRoutes()}
              {/* Design domain routes */}
              {DesignRoutes()}
              {/* Feature domain routes (tools, enterprise, workspace, advanced visualization) */}
              {FeatureRoutes()}
              {AuthRoutes()}
              {InfoRoutes()}
              {/* Fallback - Show proper 404 page */}
              <Route path="*" element={<NotFoundPage />} />
              </Routes>
            </ConditionalLayout>
            <BackToTopButton />
            <CookieConsent />
          </Suspense>
        </JourneyProvider>
      </AnalyticsProvider>
    </ErrorBoundary>
  );
}

export default App;
