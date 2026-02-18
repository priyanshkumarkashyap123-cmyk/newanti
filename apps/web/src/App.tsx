/**
 * App - Main Application Component with Routing
 * Routes between Landing, Dashboard, and Workspace
 */

import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useState, Suspense, lazy } from 'react';
import { ErrorBoundary } from './components/ErrorBoundary';

// Eagerly loaded critical components (Landing, Auth)
import { LandingPage } from './pages/LandingPage';
import { SignInPage } from './pages/SignInPage';
import { SignUpPage } from './pages/SignUpPage';
import { RequireAuth } from './components/layout/RequireAuth';
import { LegalConsentModal, useCheckLegalConsent } from './components/LegalConsentModal';
// App.css removed — all styles are in index.css + Tailwind

// Lazy loaded components (Code Splitting)
const Dashboard = lazy(() => import('./pages/Dashboard').then(module => ({ default: module.Dashboard })));
const UnifiedDashboard = lazy(() => import('./pages/UnifiedDashboard').then(module => ({ default: module.UnifiedDashboard })));
const Capabilities = lazy(() => import('./pages/Capabilities').then(module => ({ default: module.Capabilities })));
const SettingsPage = lazy(() => import('./pages/SettingsPage').then(module => ({ default: module.SettingsPage })));
const SettingsPageEnhanced = lazy(() => import('./pages/SettingsPageEnhanced'));
const EnhancedPricingPage = lazy(() => import('./pages/EnhancedPricingPage').then(module => ({ default: module.EnhancedPricingPage })));
const PricingPage = lazy(() => import('./pages/PricingPage').then(module => ({ default: module.PricingPage })));

// Civil Engineering Suite (Lazy Loaded)
const CivilEngineeringBookLanding = lazy(() => import('./app/civil-engineering/library/page'));
const BookApp = lazy(() => import('./modules/civil-engine/components/BookApp').then(module => ({ default: module.BookApp })));
const RealisticBook = lazy(() => import('./modules/civil-engine/components/RealisticBook').then(module => ({ default: module.RealisticBook })));
const TransportationDesigner = lazy(() => import('./modules/civil-engine/components/TransportationDesigner').then(module => ({ default: module.TransportationDesigner })));
const ConstructionManager = lazy(() => import('./modules/civil-engine/components/ConstructionManager').then(module => ({ default: module.ConstructionManager })));
const HydraulicsDesigner = lazy(() => import('./modules/civil-engine/components/HydraulicsDesigner').then(module => ({ default: module.HydraulicsDesigner })));

// Structural Design (Lazy Loaded)
const SteelDesignPage = lazy(() => import('./pages/SteelDesignPage').then(module => ({ default: module.SteelDesignPage })));
const StructuralDesignCenter = lazy(() => import('./pages/StructuralDesignCenter')); // Default export
const ModernModeler = lazy(() => import('./components/ModernModeler').then(module => ({ default: module.ModernModeler })));
const RustWasmDemo = lazy(() => import('./pages/RustWasmDemo').then(module => ({ default: module.RustWasmDemo })));
const UIShowcase = lazy(() => import('./pages/UIShowcase').then(module => ({ default: module.UIShowcase })));

// Auth & Info Pages (Lazy Loaded) - All have default exports
const ForgotPasswordPage = lazy(() => import('./pages/ForgotPasswordPage'));
const ResetPasswordPage = lazy(() => import('./pages/ResetPasswordPage'));
const PrivacyPolicyPageNew = lazy(() => import('./pages/PrivacyPolicyPageNew'));
const TermsOfServicePage = lazy(() => import('./pages/TermsOfServicePage'));
const HelpPage = lazy(() => import('./pages/HelpPage'));
const AboutPage = lazy(() => import('./pages/AboutPage'));
const ContactPage = lazy(() => import('./pages/ContactPage'));
const ReportsPage = lazy(() => import('./pages/ReportsPage'));
const WorkerValidation = lazy(() => import('./components/WorkerValidation'));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'));

// Phase 12 Design Modules
const ConnectionDesignPage = lazy(() => import('./pages/ConnectionDesignPage'));
const DetailingDesignPage = lazy(() => import('./pages/DetailingDesignPage'));

// New Complete Design Pages (CEO Gap Closure - Phase 13)
const ConcreteDesignPage = lazy(() => import('./pages/ConcreteDesignPage'));
const FoundationDesignPage = lazy(() => import('./pages/FoundationDesignPage'));
const LoadCombinationPage = lazy(() => import('./pages/LoadCombinationPage'));
const SectionDatabasePage = lazy(() => import('./pages/SectionDatabasePage'));
const PushoverAnalysisPage = lazy(() => import('./pages/PushoverAnalysisPage'));

// Enhanced Analysis Pages (CEO Industry Gap Closure - Phase 14)
const TimeHistoryAnalysisPage = lazy(() => import('./pages/TimeHistoryAnalysisPage'));
const ModalAnalysisPage = lazy(() => import('./pages/ModalAnalysisPage'));
const NonlinearAnalysisPage = lazy(() => import('./pages/NonlinearAnalysisPage'));
const DynamicAnalysisPage = lazy(() => import('./pages/DynamicAnalysisPage'));
const AdvancedSettingsPage = lazy(() => import('./pages/AdvancedSettingsPage'));

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

// Phase 17-19: Industry Parity Final
const CloudStorageDashboard = lazy(() => import('./pages/CloudStorageDashboard'));
const AdvancedMeshingDashboard = lazy(() => import('./pages/AdvancedMeshingDashboard'));
const SensitivityOptimizationDashboard = lazy(() => import('./pages/SensitivityOptimizationDashboard'));

// Phase 20-22: Industry Parity Complete (95+)
const Visualization3DEngine = lazy(() => import('./pages/Visualization3DEngine'));
const ResultAnimationViewer = lazy(() => import('./pages/ResultAnimationViewer'));
const PrintExportCenter = lazy(() => import('./pages/PrintExportCenter'));

// Gap-closure UI shells (Phase 1)
const BIMIntegrationPage = lazy(() => import('./pages/BIMIntegrationPage'));
const QuantitySurveyPage = lazy(() => import('./pages/QuantitySurveyPage'));
const ReportBuilderPage = lazy(() => import('./pages/ReportBuilderPage'));
const VisualizationHubPage = lazy(() => import('./pages/VisualizationHubPage'));

// AI Power Dashboard (Lazy Loaded)
const AIPowerDashboard = lazy(() => import('./components/ai/AIPowerDashboard').then(module => ({ default: module.AIPowerDashboard })));
const PowerAIPanel = lazy(() => import('./components/ai/PowerAIPanel').then(module => ({ default: module.PowerAIPanel })));

// Analysis Panels (Lazy Loaded)
const ModalAnalysisPanel = lazy(() => import('./components/analysis/ModalAnalysisPanel').then(module => ({ default: module.ModalAnalysisPanel })));
const TimeHistoryPanel = lazy(() => import('./components/analysis/TimeHistoryPanel').then(module => ({ default: module.TimeHistoryPanel })));
const SeismicAnalysisPanel = lazy(() => import('./components/analysis/SeismicAnalysisPanel').then(module => ({ default: module.SeismicAnalysisPanel })));
const BucklingAnalysisPanel = lazy(() => import('./components/analysis/BucklingAnalysisPanel').then(module => ({ default: module.BucklingAnalysisPanel })));
const CableAnalysisPanel = lazy(() => import('./components/analysis/CableAnalysisPanel').then(module => ({ default: module.CableAnalysisPanel })));
const PDeltaAnalysisPanel = lazy(() => import('./components/analysis/PDeltaAnalysisPanel').then(module => ({ default: module.PDeltaAnalysisPanel })));

// Loading Component
import { DashboardSkeleton } from './components/ui/DashboardSkeleton';
const PageLoader = () => (
    <div className="flex items-center justify-center min-h-screen bg-slate-900">
        <div className="flex flex-col items-center gap-4">
            <div className="w-12 h-12 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin"></div>
            <p className="text-slate-400 text-sm font-medium animate-pulse">Loading Module...</p>
        </div>
    </div>
);





// ============================================
// MAIN APP WITH ROUTING
// ============================================

// Hooks
import { useUserRegistration } from './hooks/useUserRegistration';

function App() {
    // Ensure user is registered in MongoDB upon login/load
    useUserRegistration();

    // Legal consent state
    const { hasConsent } = useCheckLegalConsent();
    const [consentAccepted, setConsentAccepted] = useState(false);

    const location = useLocation();

    // Define public paths where consent modal should NOT appear
    // This fixes the scroll issue on landing pages as the modal locks body scroll
    const publicPaths = [
        '/',
        '/pricing',
        '/capabilities',
        '/about',
        '/contact',
        '/help',
        '/privacy',
        '/terms',
        '/sign-in',
        '/sign-up',
        '/forgot-password',
        '/reset-password',
        '/workspace-demo',
        '/rust-wasm-demo',
        '/demo',
        '/worker-test',
        '/ai-dashboard',
        '/ai-power'
    ];

    // Check if current path is public (exact match or starts with for sub-routes)
    const isPublicPath = publicPaths.some(path =>
        location.pathname === path ||
        (path !== '/' && location.pathname.startsWith(path + '/'))
    );

    // Show legal consent modal if user hasn't agreed yet (hasConsent === null means still loading)
    // AND we are NOT on a public page
    const showConsentModal = hasConsent === false && !consentAccepted && !isPublicPath;

    const handleAcceptConsent = () => {
        setConsentAccepted(true);
    };

    return (
        <ErrorBoundary>
            <Suspense fallback={<PageLoader />}>
                <Routes>
                    {/* Landing Page */}
                    <Route path="/" element={<LandingPage />} />

                    {/* Enhanced Landing Page */}


                    {/* Stream Dashboard - Main Entry Point (Now uses UnifiedDashboard) */}
                    <Route path="/stream" element={
                        <RequireAuth>
                            <Suspense fallback={<DashboardSkeleton />}>
                                <UnifiedDashboard />
                            </Suspense>
                        </RequireAuth>
                    } />

                    {/* Legacy Dashboard - redirects to unified */}
                    <Route path="/dashboard" element={<Navigate to="/stream" replace />} />

                    {/* Enhanced Dashboard - redirects to unified */}
                    <Route path="/dashboard-enhanced" element={<Navigate to="/stream" replace />} />

                    {/* Capabilities Page */}
                    <Route path="/capabilities" element={<Capabilities />} />

                    {/* Custom Auth Pages */}
                    <Route path="/sign-in/*" element={<SignInPage />} />
                    <Route path="/sign-up/*" element={<SignUpPage />} />

                    {/* Settings Page */}
                    <Route path="/settings" element={
                        <RequireAuth>
                            <SettingsPage />
                        </RequireAuth>
                    } />

                    {/* Enhanced Settings */}
                    <Route path="/settings-enhanced" element={
                        <RequireAuth>
                            <SettingsPageEnhanced />
                        </RequireAuth>
                    } />

                    {/* Advanced Settings - Comprehensive Analysis Configuration */}
                    <Route path="/settings/advanced" element={
                        <RequireAuth>
                            <AdvancedSettingsPage />
                        </RequireAuth>
                    } />

                    {/* Pricing Page */}
                    <Route path="/pricing" element={<EnhancedPricingPage />} />
                    <Route path="/pricing-old" element={<PricingPage />} />

                    {/* Forgot Password */}
                    <Route path="/forgot-password" element={<ForgotPasswordPage />} />

                    {/* Reset Password */}
                    <Route path="/reset-password" element={<ResetPasswordPage />} />

                    {/* Privacy Policy - New comprehensive page for Clerk */}
                    <Route path="/privacy-policy" element={<PrivacyPolicyPageNew />} />
                    <Route path="/privacy" element={<Navigate to="/privacy-policy" replace />} />

                    {/* Terms of Service - New comprehensive page for Clerk */}
                    <Route path="/terms-of-service" element={<TermsOfServicePage />} />
                    <Route path="/terms" element={<Navigate to="/terms-of-service" replace />} />

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
                    <Route path="/civil/hydraulics" element={
                        <RequireAuth>
                            <HydraulicsDesigner />
                        </RequireAuth>
                    } />
                    <Route path="/civil/transportation" element={
                        <RequireAuth>
                            <TransportationDesigner />
                        </RequireAuth>
                    } />
                    <Route path="/civil/construction" element={
                        <RequireAuth>
                            <ConstructionManager />
                        </RequireAuth>
                    } />

                    {/* Reports */}
                    <Route path="/reports" element={
                        <RequireAuth>
                            <ReportsPage />
                        </RequireAuth>
                    } />

                    {/* Main App - Modern Modeler */}
                    <Route path="/app" element={
                        <RequireAuth>
                            <ModernModeler />
                        </RequireAuth>
                    } />

                    {/* Demo Route - Modern Modeler */}
                    <Route path="/demo" element={<ModernModeler />} />

                    {/* UI Component Showcase - Phase 13+ Integration Demo */}
                    <Route path="/ui-showcase" element={<UIShowcase />} />

                    {/* AI Power Dashboard - NEW C-Suite Analytics */}
                    <Route path="/ai-dashboard" element={
                        <RequireAuth>
                            <AIPowerDashboard />
                        </RequireAuth>
                    } />

                    {/* AI Power Panel - Next-Gen AI Interface */}
                    <Route path="/ai-power" element={
                        <RequireAuth>
                            <PowerAIPanel />
                        </RequireAuth>
                    } />

                    {/* Rust WASM Performance Demo */}
                    <Route path="/rust-wasm-demo" element={<RustWasmDemo />} />

                    {/* Worker Validation Route */}
                    <Route path="/worker-test" element={<WorkerValidation />} />

                    {/* Advanced Analysis Panels (Rust-powered, 20-100x faster) */}
                    <Route path="/analysis/modal" element={<RequireAuth><ModalAnalysisPanel isOpen={true} onClose={() => { }} /></RequireAuth>} />
                    <Route path="/analysis/time-history" element={<RequireAuth><TimeHistoryPanel /></RequireAuth>} />
                    <Route path="/analysis/seismic" element={<RequireAuth><SeismicAnalysisPanel /></RequireAuth>} />
                    <Route path="/analysis/buckling" element={<RequireAuth><BucklingAnalysisPanel /></RequireAuth>} />
                    <Route path="/analysis/cable" element={<RequireAuth><CableAnalysisPanel /></RequireAuth>} />
                    <Route path="/analysis/pdelta" element={<RequireAuth><PDeltaAnalysisPanel /></RequireAuth>} />
                    <Route path="/analysis/nonlinear" element={<RequireAuth><NonlinearAnalysisPage /></RequireAuth>} />

                    {/* Enhanced Analysis Pages (CEO Industry Gap Closure - Phase 14) */}
                    <Route path="/analysis/modal-page" element={
                        <RequireAuth>
                            <ModalAnalysisPage />
                        </RequireAuth>
                    } />
                    <Route path="/analysis/time-history-page" element={
                        <RequireAuth>
                            <TimeHistoryAnalysisPage />
                        </RequireAuth>
                    } />
                    <Route path="/analysis/nonlinear-page" element={
                        <RequireAuth>
                            <NonlinearAnalysisPage />
                        </RequireAuth>
                    } />
                    <Route path="/analysis/dynamic" element={
                        <RequireAuth>
                            <DynamicAnalysisPage />
                        </RequireAuth>
                    } />

                    {/* Pushover Analysis - Nonlinear Static for Performance-Based Design */}
                    <Route path="/analysis/pushover" element={
                        <RequireAuth>
                            <PushoverAnalysisPage />
                        </RequireAuth>
                    } />

                    {/* Design Modules (Rust-powered, 10x faster) */}
                    <Route path="/design/steel" element={
                        <RequireAuth>
                            <SteelDesignPage />
                        </RequireAuth>
                    } />

                    {/* Connection Design Module - Professional bolted/welded connection design */}
                    <Route path="/design/connections" element={
                        <RequireAuth>
                            <ConnectionDesignPage />
                        </RequireAuth>
                    } />

                    {/* Welded Connections Module - Fillet, Groove, Base Plates */}
                    <Route path="/design/welded-connections" element={
                        <RequireAuth>
                            <ConnectionDesignPage />
                        </RequireAuth>
                    } />

                    {/* Reinforcement Design Module - Stirrups, Development Length, Lap Splices */}
                    <Route path="/design/reinforcement" element={
                        <RequireAuth>
                            <DetailingDesignPage />
                        </RequireAuth>
                    } />

                    {/* RC Detailing Design Module - Foundations, Columns, Beams, Slabs, Walls */}
                    <Route path="/design/detailing" element={
                        <RequireAuth>
                            <DetailingDesignPage />
                        </RequireAuth>
                    } />

                    {/* Concrete Design Module - Complete IS 456/ACI 318 RC Beam/Column/Slab Design */}
                    <Route path="/design/concrete" element={
                        <RequireAuth>
                            <ConcreteDesignPage />
                        </RequireAuth>
                    } />

                    {/* Foundation Design Module - Isolated/Combined/Strap/Mat Footings per IS 456/ACI 318 */}
                    <Route path="/design/foundation" element={
                        <RequireAuth>
                            <FoundationDesignPage />
                        </RequireAuth>
                    } />

                    {/* Load Combination Generator - Auto-generate IS 1893/ASCE 7/Eurocode combinations */}
                    <Route path="/tools/load-combinations" element={
                        <RequireAuth>
                            <LoadCombinationPage />
                        </RequireAuth>
                    } />

                    {/* Section Database Browser - ISMB/AISC/IPE/UB section properties */}
                    <Route path="/tools/section-database" element={
                        <RequireAuth>
                            <SectionDatabasePage />
                        </RequireAuth>
                    } />

                    {/* Gap closure: BIM, QS, Reports, Visualization hubs */}
                    <Route path="/bim" element={
                        <RequireAuth>
                            <BIMIntegrationPage />
                        </RequireAuth>
                    } />
                    <Route path="/quantity" element={
                        <RequireAuth>
                            <QuantitySurveyPage />
                        </RequireAuth>
                    } />
                    <Route path="/reports/builder" element={
                        <RequireAuth>
                            <ReportBuilderPage />
                        </RequireAuth>
                    } />
                    <Route path="/visualization" element={
                        <RequireAuth>
                            <VisualizationHubPage />
                        </RequireAuth>
                    } />

                    {/* Structural Design Center - Complete RC/Steel/Bridge/Foundation Design */}
                    <Route path="/design-center" element={
                        <RequireAuth>
                            <StructuralDesignCenter />
                        </RequireAuth>
                    } />

                    {/* Phase 15: Professional Tools - Industry Parity */}
                    <Route path="/reports/professional" element={
                        <RequireAuth>
                            <ProfessionalReportGenerator />
                        </RequireAuth>
                    } />
                    <Route path="/connections/database" element={
                        <RequireAuth>
                            <ConnectionDesignDatabase />
                        </RequireAuth>
                    } />
                    <Route path="/performance/monitor" element={
                        <RequireAuth>
                            <PerformanceMonitorDashboard />
                        </RequireAuth>
                    } />

                    {/* Phase 16: Enterprise Features - Industry Parity Complete */}
                    <Route path="/bim/export-enhanced" element={
                        <RequireAuth>
                            <BIMExportEnhanced />
                        </RequireAuth>
                    } />
                    <Route path="/cad/integration" element={
                        <RequireAuth>
                            <CADIntegrationHub />
                        </RequireAuth>
                    } />
                    <Route path="/collaboration" element={
                        <RequireAuth>
                            <CollaborationHub />
                        </RequireAuth>
                    } />
                    <Route path="/api/dashboard" element={
                        <RequireAuth>
                            <APIIntegrationDashboard />
                        </RequireAuth>
                    } />
                    <Route path="/materials/database" element={
                        <RequireAuth>
                            <MaterialsDatabasePage />
                        </RequireAuth>
                    } />
                    <Route path="/compliance/checker" element={
                        <RequireAuth>
                            <CodeComplianceChecker />
                        </RequireAuth>
                    } />

                    {/* Phase 17-19: Industry Parity Final */}
                    <Route path="/cloud/storage" element={
                        <RequireAuth>
                            <CloudStorageDashboard />
                        </RequireAuth>
                    } />
                    <Route path="/meshing/advanced" element={
                        <RequireAuth>
                            <AdvancedMeshingDashboard />
                        </RequireAuth>
                    } />
                    <Route path="/optimization" element={
                        <RequireAuth>
                            <SensitivityOptimizationDashboard />
                        </RequireAuth>
                    } />

                    {/* Phase 20-22: Industry Parity Complete */}
                    <Route path="/visualization/3d" element={
                        <RequireAuth>
                            <Visualization3DEngine />
                        </RequireAuth>
                    } />
                    <Route path="/results/animation" element={
                        <RequireAuth>
                            <ResultAnimationViewer />
                        </RequireAuth>
                    } />
                    <Route path="/print-export" element={
                        <RequireAuth>
                            <PrintExportCenter />
                        </RequireAuth>
                    } />

                    {/* Workspace Routes */}
                    <Route path="/workspace/:moduleType" element={
                        <RequireAuth>
                            <WorkspacePageWrapper />
                        </RequireAuth>
                    } />

                    {/* 404 - Not Found */}
                    <Route path="*" element={<NotFoundPage />} />
                </Routes>
            </Suspense>

            {/* Legal Consent Modal - shows on first use */}
            <LegalConsentModal
                open={showConsentModal}
                onAccept={handleAcceptConsent}
                canClose={false}
            />
        </ErrorBoundary>
    );
}

// Helper to extract moduleType param - Now uses ModernModeler
function WorkspacePageWrapper() {
    // All workspace routes now use ModernModeler with all new UI improvements
    return <ModernModeler />;
}

export default App;
