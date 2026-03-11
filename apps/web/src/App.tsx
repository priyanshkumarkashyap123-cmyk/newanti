/**
 * App - Main Application Component with Routing
 * Routes between Landing, Dashboard, and Workspace
 */

import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import React, { Suspense, lazy } from 'react';
import { ScrollToTop } from './components/ScrollToTop';

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
const SignInPage = lazy(() =>
  import('./pages/SignInPage').then((m) => ({ default: m.SignInPage })),
);
const SignUpPage = lazy(() =>
  import('./pages/SignUpPage').then((m) => ({ default: m.SignUpPage })),
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

// Structural Design (Lazy Loaded)
const SteelDesignPage = lazy(() =>
  import('./pages/SteelDesignPage').then((module) => ({
    default: module.SteelDesignPage,
  })),
);
const StructuralDesignCenter = lazy(() => import('./pages/StructuralDesignCenter')); // Default export
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
const ForgotPasswordPage = lazy(() => import('./pages/ForgotPasswordPage'));
const ResetPasswordPage = lazy(() => import('./pages/ResetPasswordPage'));
const PrivacyPolicyPageNew = lazy(() => import('./pages/PrivacyPolicyPageNew'));
const TermsOfServicePage = lazy(() => import('./pages/TermsOfServicePage'));
const TermsAndConditionsPage = lazy(() => import('./pages/TermsAndConditionsPage'));
const RefundCancellationPage = lazy(() => import('./pages/RefundCancellationPage'));
const HelpPage = lazy(() => import('./pages/HelpPage'));
const AboutPage = lazy(() => import('./pages/AboutPage'));
const ContactPage = lazy(() => import('./pages/ContactPage'));
const ReportsPage = lazy(() => import('./pages/ReportsPage'));
const WorkerValidation = lazy(() => import('./components/WorkerValidation'));

// Phase 12 Design Modules
const ConnectionDesignPage = lazy(() => import('./pages/ConnectionDesignPage'));
const DetailingDesignPage = lazy(() => import('./pages/DetailingDesignPage'));
const ReinforcementDesignPage = lazy(() => import('./pages/DetailingDesignPage')); // Reusing Detailing Page

// New Complete Design Pages (CEO Gap Closure - Phase 13)
const ConcreteDesignPage = lazy(() => import('./pages/ConcreteDesignPage'));
const FoundationDesignPage = lazy(() => import('./pages/FoundationDesignPage'));
const LoadCombinationPage = lazy(() => import('./pages/LoadCombinationPage'));
const SectionDatabasePage = lazy(() => import('./pages/SectionDatabasePage'));
const PushoverAnalysisPage = lazy(() => import('./pages/PushoverAnalysisPage'));

// Composite & Timber Design Pages
const CompositeDesignPage = lazy(() => import('./pages/CompositeDesignPage'));
const TimberDesignPage = lazy(() => import('./pages/TimberDesignPage'));

// New Feature Pages (Phase 17: BBS Engine + Plate/Shell FEM)
const BarBendingSchedulePage = lazy(() => import('./pages/BarBendingSchedulePage'));
const PlateShellAnalysisPage = lazy(() => import('./pages/PlateShellAnalysisPage'));

// Enhanced Analysis Pages (CEO Industry Gap Closure - Phase 14)
const TimeHistoryAnalysisPage = lazy(() => import('./pages/TimeHistoryAnalysisPage'));
const ModalAnalysisPage = lazy(() => import('./pages/ModalAnalysisPage'));
const NonlinearAnalysisPage = lazy(() => import('./pages/NonlinearAnalysisPage'));
const DynamicAnalysisPage = lazy(() => import('./pages/DynamicAnalysisPage'));

// New core pages (Phase 1 implementation)
const BlogPage = lazy(() => import('./pages/BlogPage'));
const NotificationsPage = lazy(() => import('./pages/NotificationsPage'));
const ProfilePage = lazy(() => import('./pages/ProfilePage'));

// Phase 15: Professional Tools (Industry Parity)
const ProfessionalReportGenerator = lazy(() => import('./pages/ProfessionalReportGenerator'));
const ConnectionDesignDatabase = lazy(() => import('./pages/ConnectionDesignDatabase'));
const PerformanceMonitorDashboard = lazy(() => import('./pages/PerformanceMonitorDashboard'));

// Phase 16: Enterprise Features (Industry Parity Complete)
const BIMExportEnhanced = lazy(() => import('./pages/BIMExportEnhanced'));
const CADIntegrationHub = lazy(() => import('./pages/CADIntegrationHub'));
const CollaborationHub = lazy(() => import('./pages/CollaborationHub'));
const APIIntegrationDashboard = lazy(() => import('./pages/APIIntegrationDashboard'));
const MaterialsDatabasePage = lazy(() => import('./pages/MaterialsDatabasePage'));
const CodeComplianceChecker = lazy(() => import('./pages/CodeComplianceChecker'));

// Gap-closure UI shells (Phase 1)
const BIMIntegrationPage = lazy(() => import('./pages/BIMIntegrationPage'));
const QuantitySurveyPage = lazy(() => import('./pages/QuantitySurveyPage'));
const ReportBuilderPage = lazy(() => import('./pages/ReportBuilderPage'));
const VisualizationHubPage = lazy(() => import('./pages/VisualizationHubPage'));

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

// Post-Analysis Design Hub (STAAD.Pro-style workflow)
const PostAnalysisDesignHub = lazy(() => import('./pages/PostAnalysisDesignHub'));

// Phase 18: Missing pages (audit gap closure)
const AdvancedMeshingDashboard = lazy(() => import('./pages/AdvancedMeshingDashboard'));
const CloudStorageDashboard = lazy(() => import('./pages/CloudStorageDashboard'));
const PrintExportCenter = lazy(() => import('./pages/PrintExportCenter'));
const SensitivityOptimizationDashboard = lazy(
  () => import('./pages/SensitivityOptimizationDashboard'),
);
const OAuthCallbackPage = lazy(() => import('./pages/OAuthCallbackPage'));
const VerifyEmailPage = lazy(() => import('./pages/VerifyEmailPage'));
const AccountLockedPage = lazy(() => import('./pages/AccountLockedPage'));
const LinkExpiredPage = lazy(() => import('./pages/LinkExpiredPage'));
const Visualization3DEngine = lazy(() => import('./pages/Visualization3DEngine'));
const ResultAnimationViewer = lazy(() => import('./pages/ResultAnimationViewer'));
const DigitalTwinDashboard = lazy(() => import('./pages/DigitalTwinDashboard'));
const SpacePlanningPage = lazy(() => import('./pages/SpacePlanningPage'));
const RoomPlannerPage = lazy(() => import('./pages/room-planner'));
const LearningCenter = lazy(() => import('./pages/LearningCenter'));
const SitemapPage = lazy(() => import('./pages/SitemapPage'));

// Analysis Panels (Lazy Loaded)
const ModalAnalysisPanel = lazy(() =>
  import('./components/analysis/ModalAnalysisPanel').then((module) => ({
    default: module.ModalAnalysisPanel,
  })),
);

// Wrapper to provide navigateBack as onClose for ModalAnalysisPanel route
function ModalAnalysisRouteWrapper() {
  const navigate = useNavigate();
  return <ModalAnalysisPanel isOpen={true} onClose={() => navigate(-1)} />;
}

const TimeHistoryPanel = lazy(() =>
  import('./components/analysis/TimeHistoryPanel').then((module) => ({
    default: module.TimeHistoryPanel,
  })),
);
const SeismicAnalysisPanel = lazy(() =>
  import('./components/analysis/SeismicAnalysisPanel').then((module) => ({
    default: module.SeismicAnalysisPanel,
  })),
);
const BucklingAnalysisPanel = lazy(() =>
  import('./components/analysis/BucklingAnalysisPanel').then((module) => ({
    default: module.BucklingAnalysisPanel,
  })),
);
const CableAnalysisPanel = lazy(() =>
  import('./components/analysis/CableAnalysisPanel').then((module) => ({
    default: module.CableAnalysisPanel,
  })),
);
const PDeltaAnalysisPanel = lazy(() =>
  import('./components/analysis/PDeltaAnalysisPanel').then((module) => ({
    default: module.PDeltaAnalysisPanel,
  })),
);

// Analytics Provider — sends events to POST /api/analytics/batch
import { AnalyticsProvider } from './providers/AnalyticsProvider';

// Loading Component — route-aware with better UX
import { DashboardSkeleton } from './components/ui/DashboardSkeleton';
import { DesignPageSkeleton } from './components/ui/DesignPageSkeleton';
const PageLoader = () => (
  <div
    className="flex items-center justify-center min-h-screen bg-slate-50 dark:bg-slate-900"
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
        <p className="text-slate-600 dark:text-slate-300 text-sm font-medium">
          Loading Module
        </p>
        <p className="text-slate-400 dark:text-slate-500 text-xs mt-0.5">
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

const ROUTE_ALIASES: Array<{ from: string; to: string }> = [
  { from: '/dashboard', to: '/stream' },
  { from: '/dashboard-enhanced', to: '/stream' },
  { from: '/privacy', to: '/privacy-policy' },
  { from: '/terms', to: '/terms-and-conditions' },
  { from: '/docs', to: '/help' },
  { from: '/login', to: '/sign-in' },
  { from: '/analysis/modal-page', to: '/analysis/modal' },
  { from: '/analysis/time-history-page', to: '/analysis/time-history' },
  { from: '/analysis/nonlinear-page', to: '/analysis/nonlinear' },
  { from: '/design/welded-connections', to: '/design/connections' },
  { from: '/load-combination-page', to: '/tools/load-combinations' },
  { from: '/section-database-page', to: '/tools/section-database' },
  { from: '/tools/load-combination', to: '/tools/load-combinations' },
  { from: '/reports/generator', to: '/reports/professional' },
];

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
        <Suspense fallback={<PageLoader />}>
          <ScrollToTop />
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
              <Route path="/sign-in/*" element={<SignInPage />} />
              <Route path="/sign-up/*" element={<SignUpPage />} />
              <Route path="/account-locked" element={<AccountLockedPage />} />
              <Route path="/link-expired" element={<LinkExpiredPage />} />
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
              <Route path="/forgot-password" element={<ForgotPasswordPage />} />
              {/* Reset Password */}
              <Route path="/reset-password" element={<ResetPasswordPage />} />
              {/* Privacy Policy - New comprehensive page for Clerk */}
              <Route path="/privacy-policy" element={<PrivacyPolicyPageNew />} />
              {/* Terms of Service - New comprehensive page for Clerk */}
              <Route path="/terms-of-service" element={<TermsOfServicePage />} />
              {/* Terms and Conditions - Comprehensive legal T&C (IT Act 2000, Rewa jurisdiction) */}
              <Route path="/terms-and-conditions" element={<TermsAndConditionsPage />} />
              {/* Refund and Cancellation Policy */}
              <Route path="/refund-cancellation" element={<RefundCancellationPage />} />
              {/* Help & Tutorials */}
              <Route path="/help" element={<HelpPage />} />
              {/* About & Contact */}
              <Route path="/about" element={<AboutPage />} />
              <Route path="/contact" element={<ContactPage />} />
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
                element={
                  <MobileGuard>
                    <ModernModeler />
                  </MobileGuard>
                }
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
              {/* Advanced Analysis Panels (Rust-powered, 20-100x faster) */}
              <Route
                path="/analysis/modal"
                element={
                  <RequireAuth>
                    <MobileGuard>
                      <ModalAnalysisRouteWrapper />
                    </MobileGuard>
                  </RequireAuth>
                }
              />
              <Route
                path="/analysis/time-history"
                element={
                  <RequireAuth>
                    <MobileGuard>
                      <TimeHistoryPanel />
                    </MobileGuard>
                  </RequireAuth>
                }
              />
              <Route
                path="/analysis/seismic"
                element={
                  <RequireAuth>
                    <MobileGuard>
                      <SeismicAnalysisPanel />
                    </MobileGuard>
                  </RequireAuth>
                }
              />
              <Route
                path="/analysis/buckling"
                element={
                  <RequireAuth>
                    <MobileGuard>
                      <BucklingAnalysisPanel />
                    </MobileGuard>
                  </RequireAuth>
                }
              />
              <Route
                path="/analysis/cable"
                element={
                  <RequireAuth>
                    <MobileGuard>
                      <CableAnalysisPanel />
                    </MobileGuard>
                  </RequireAuth>
                }
              />
              <Route
                path="/analysis/pdelta"
                element={
                  <RequireAuth>
                    <MobileGuard>
                      <PDeltaAnalysisPanel />
                    </MobileGuard>
                  </RequireAuth>
                }
              />
              <Route
                path="/analysis/nonlinear"
                element={
                  <RequireAuth>
                    <MobileGuard>
                      <NonlinearAnalysisPage />
                    </MobileGuard>
                  </RequireAuth>
                }
              />
              <Route
                path="/analysis/dynamic"
                element={
                  <RequireAuth>
                    <MobileGuard>
                      <DynamicAnalysisPage />
                    </MobileGuard>
                  </RequireAuth>
                }
              />
              {/* Pushover Analysis - Nonlinear Static for Performance-Based Design */}
              <Route
                path="/analysis/pushover"
                element={
                  <RequireAuth>
                    <MobileGuard>
                      <PushoverAnalysisPage />
                    </MobileGuard>
                  </RequireAuth>
                }
              />
              {/* Design Modules (Rust-powered, 10x faster) */}
              <Route
                path="/design/steel"
                element={
                  <RequireAuth>
                    <MobileGuard>
                      <Suspense fallback={<DesignPageSkeleton />}>
                        <SteelDesignPage />
                      </Suspense>
                    </MobileGuard>
                  </RequireAuth>
                }
              />
              {/* Connection Design Module - Professional bolted/welded connection design */}
              <Route
                path="/design/connections"
                element={
                  <RequireAuth>
                    <MobileGuard>
                      <Suspense fallback={<DesignPageSkeleton />}>
                        <ConnectionDesignPage />
                      </Suspense>
                    </MobileGuard>
                  </RequireAuth>
                }
              />
              {/* Legacy route handled by ROUTE_ALIASES: /design/welded-connections -> /design/connections */}
              {/* Reinforcement Design Module - Stirrups, Development Length, Lap Splices */}
              <Route
                path="/design/reinforcement"
                element={
                  <RequireAuth>
                    <MobileGuard>
                      <Suspense fallback={<DesignPageSkeleton />}>
                        <ReinforcementDesignPage />
                      </Suspense>
                    </MobileGuard>
                  </RequireAuth>
                }
              />
              {/* RC Detailing Design Module - Foundations, Columns, Beams, Slabs, Walls */}
              <Route
                path="/design/detailing"
                element={
                  <RequireAuth>
                    <MobileGuard>
                      <Suspense fallback={<DesignPageSkeleton />}>
                        <DetailingDesignPage />
                      </Suspense>
                    </MobileGuard>
                  </RequireAuth>
                }
              />
              {/* Concrete Design Module - Complete IS 456/ACI 318 RC Beam/Column/Slab Design */}
              <Route
                path="/design/concrete"
                element={
                  <RequireAuth>
                    <MobileGuard>
                      <Suspense fallback={<DesignPageSkeleton />}>
                        <ConcreteDesignPage />
                      </Suspense>
                    </MobileGuard>
                  </RequireAuth>
                }
              />
              {/* Foundation Design Module - Isolated/Combined/Strap/Mat Footings per IS 456/ACI 318 */}
              <Route
                path="/design/foundation"
                element={
                  <RequireAuth>
                    <MobileGuard>
                      <Suspense fallback={<DesignPageSkeleton />}>
                        <FoundationDesignPage />
                      </Suspense>
                    </MobileGuard>
                  </RequireAuth>
                }
              />
              {/* Composite Steel-Concrete Beam Design - AISC 360 Ch I / EN 1994 / IS 11384 */}
              <Route
                path="/design/composite"
                element={
                  <RequireAuth>
                    <MobileGuard>
                      <Suspense fallback={<DesignPageSkeleton />}>
                        <CompositeDesignPage />
                      </Suspense>
                    </MobileGuard>
                  </RequireAuth>
                }
              />
              {/* Timber Beam Design - NDS 2018 / EN 1995 / IS 883 */}
              <Route
                path="/design/timber"
                element={
                  <RequireAuth>
                    <MobileGuard>
                      <Suspense fallback={<DesignPageSkeleton />}>
                        <TimberDesignPage />
                      </Suspense>
                    </MobileGuard>
                  </RequireAuth>
                }
              />
              {/* Load Combination Generator - Auto-generate IS 1893/ASCE 7/Eurocode combinations */}
              <Route
                path="/tools/load-combinations"
                element={
                  <RequireAuth>
                    <LoadCombinationPage />
                  </RequireAuth>
                }
              />
              {/* Section Database Browser - ISMB/AISC/IPE/UB section properties */}
              <Route
                path="/tools/section-database"
                element={
                  <RequireAuth>
                    <SectionDatabasePage />
                  </RequireAuth>
                }
              />
              {/* Bar Bending Schedule - IS 2502 compliant BBS generator */}
              <Route
                path="/tools/bar-bending"
                element={
                  <RequireAuth>
                    <BarBendingSchedulePage />
                  </RequireAuth>
                }
              />
              {/* Plate & Shell FEM Analysis - Mindlin-Reissner / Kirchhoff */}
              <Route
                path="/analysis/plate-shell"
                element={
                  <RequireAuth>
                    <MobileGuard>
                      <PlateShellAnalysisPage />
                    </MobileGuard>
                  </RequireAuth>
                }
              />
              {/* Gap closure: BIM, QS, Reports, Visualization hubs */}
              <Route
                path="/bim"
                element={
                  <RequireAuth>
                    <BIMIntegrationPage />
                  </RequireAuth>
                }
              />
              <Route
                path="/quantity"
                element={
                  <RequireAuth>
                    <QuantitySurveyPage />
                  </RequireAuth>
                }
              />
              <Route
                path="/reports/builder"
                element={
                  <RequireAuth>
                    <ReportBuilderPage />
                  </RequireAuth>
                }
              />
              <Route
                path="/visualization"
                element={
                  <RequireAuth>
                    <VisualizationHubPage />
                  </RequireAuth>
                }
              />
              {/* Structural Design Center - Complete RC/Steel/Bridge/Foundation Design */}
              <Route
                path="/design-center"
                element={
                  <RequireAuth>
                    <StructuralDesignCenter />
                  </RequireAuth>
                }
              />
              {/* Post-Analysis Design Hub (STAAD.Pro-style workflow) */}
              <Route
                path="/design-hub"
                element={
                  <RequireAuth>
                    <PostAnalysisDesignHub />
                  </RequireAuth>
                }
              />
              {/* Phase 15: Professional Tools - Industry Parity */}
              <Route
                path="/reports/professional"
                element={
                  <RequireAuth>
                    <ProfessionalReportGenerator />
                  </RequireAuth>
                }
              />
              <Route
                path="/connections/database"
                element={
                  <RequireAuth>
                    <ConnectionDesignDatabase />
                  </RequireAuth>
                }
              />
              <Route
                path="/performance/monitor"
                element={
                  <RequireAuth>
                    <PerformanceMonitorDashboard />
                  </RequireAuth>
                }
              />
              {/* Phase 16: Enterprise Features - Industry Parity Complete */}
              <Route
                path="/bim/export-enhanced"
                element={
                  <RequireAuth>
                    <BIMExportEnhanced />
                  </RequireAuth>
                }
              />
              <Route
                path="/cad/integration"
                element={
                  <RequireAuth>
                    <CADIntegrationHub />
                  </RequireAuth>
                }
              />
              <Route
                path="/collaboration"
                element={
                  <RequireAuth>
                    <CollaborationHub />
                  </RequireAuth>
                }
              />
              <Route
                path="/integrations/api-dashboard"
                element={
                  <RequireAuth>
                    <APIIntegrationDashboard />
                  </RequireAuth>
                }
              />
              <Route
                path="/materials/database"
                element={
                  <RequireAuth>
                    <MaterialsDatabasePage />
                  </RequireAuth>
                }
              />
              <Route
                path="/compliance/checker"
                element={
                  <RequireAuth>
                    <CodeComplianceChecker />
                  </RequireAuth>
                }
              />
              {/* Workspace Routes */}
              {/* Workspace Routes */}
              <Route
                path="/workspace/:moduleType"
                element={
                  <RequireAuth>
                    <WorkspacePageWrapper />
                  </RequireAuth>
                }
              />
              {/* Phase 18: Auth Flow Pages (public) */}
              <Route path="/auth/callback/:provider" element={<OAuthCallbackPage />} />
              <Route path="/verify-email" element={<VerifyEmailPage />} />
              {/* Phase 18: Advanced Tools & Visualization */}
              <Route
                path="/tools/advanced-meshing"
                element={
                  <RequireAuth>
                    <AdvancedMeshingDashboard />
                  </RequireAuth>
                }
              />
              <Route
                path="/tools/print-export"
                element={
                  <RequireAuth>
                    <PrintExportCenter />
                  </RequireAuth>
                }
              />
              <Route
                path="/cloud-storage"
                element={
                  <RequireAuth>
                    <CloudStorageDashboard />
                  </RequireAuth>
                }
              />
              <Route
                path="/analysis/sensitivity-optimization"
                element={
                  <RequireAuth>
                    <SensitivityOptimizationDashboard />
                  </RequireAuth>
                }
              />
              <Route
                path="/visualization/3d-engine"
                element={
                  <RequireAuth>
                    <SectionErrorBoundary section="3D Visualization">
                      <Visualization3DEngine />
                    </SectionErrorBoundary>
                  </RequireAuth>
                }
              />
              <Route
                path="/visualization/result-animation"
                element={
                  <RequireAuth>
                    <SectionErrorBoundary section="Result Animation">
                      <ResultAnimationViewer />
                    </SectionErrorBoundary>
                  </RequireAuth>
                }
              />
              <Route
                path="/digital-twin"
                element={
                  <RequireAuth>
                    <DigitalTwinDashboard />
                  </RequireAuth>
                }
              />
              <Route
                path="/space-planning"
                element={
                  <RequireAuth>
                    <SpacePlanningPage />
                  </RequireAuth>
                }
              />
              <Route
                path="/room-planner"
                element={
                  <RequireAuth>
                    <RoomPlannerPage />
                  </RequireAuth>
                }
              />
              <Route
                path="/learning"
                element={<LearningCenter />}
              />
              {/* Sitemap & Navigation Discovery */}
              <Route
                path="/sitemap"
                element={<SitemapPage />}
              />
              {/* Fallback - Show proper 404 page */}
              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </ConditionalLayout>
          <BackToTopButton />
          <CookieConsent />
        </Suspense>
      </AnalyticsProvider>
    </ErrorBoundary>
  );
}

// Helper to extract moduleType param - Now uses ModernModeler
function WorkspacePageWrapper() {
  // All workspace routes now use ModernModeler with all new UI improvements
  return (
    <MobileGuard>
      <ModernModeler />
    </MobileGuard>
  );
}

export default App;
