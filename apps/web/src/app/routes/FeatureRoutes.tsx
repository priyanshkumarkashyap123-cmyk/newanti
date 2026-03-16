import React, { lazy } from 'react';
import { Route } from 'react-router-dom';
import { RequireAuth } from '../../components/layout/RequireAuth';
import { SectionErrorBoundary } from '../../components/SectionErrorBoundary';
import { WorkspacePageWrapper } from './WorkspacePageWrapper';

const LoadCombinationPage = lazy(() => import('../../pages/LoadCombinationPage'));
const SectionDatabasePage = lazy(() => import('../../pages/SectionDatabasePage'));
const BarBendingSchedulePage = lazy(() => import('../../pages/BarBendingSchedulePage'));

const BIMIntegrationPage = lazy(() => import('../../pages/BIMIntegrationPage'));
const QuantitySurveyPage = lazy(() => import('../../pages/QuantitySurveyPage'));
const ReportBuilderPage = lazy(() => import('../../pages/ReportBuilderPage'));
const VisualizationHubPage = lazy(() => import('../../pages/VisualizationHubPage'));

const ProfessionalReportGenerator = lazy(() => import('../../pages/ProfessionalReportGenerator'));
const ConnectionDesignDatabase = lazy(() => import('../../pages/ConnectionDesignDatabase'));
const PerformanceMonitorDashboard = lazy(() => import('../../pages/PerformanceMonitorDashboard'));

const BIMExportEnhanced = lazy(() => import('../../pages/BIMExportEnhanced'));
const CADIntegrationHub = lazy(() => import('../../pages/CADIntegrationHub'));
const CollaborationHub = lazy(() => import('../../pages/CollaborationHub'));
const APIIntegrationDashboard = lazy(() => import('../../pages/APIIntegrationDashboard'));
const MaterialsDatabasePage = lazy(() => import('../../pages/MaterialsDatabasePage'));
const CodeComplianceChecker = lazy(() => import('../../pages/CodeComplianceChecker'));

const AdvancedMeshingDashboard = lazy(() => import('../../pages/AdvancedMeshingDashboard'));
const CloudStorageDashboard = lazy(() => import('../../pages/CloudStorageDashboard'));
const PrintExportCenter = lazy(() => import('../../pages/PrintExportCenter'));
const SensitivityOptimizationDashboard = lazy(
  () => import('../../pages/SensitivityOptimizationDashboard'),
);
const OAuthCallbackPage = lazy(() => import('../../pages/OAuthCallbackPage'));
const VerifyEmailPage = lazy(() => import('../../pages/VerifyEmailPage'));
const Visualization3DEngine = lazy(() => import('../../pages/Visualization3DEngine'));
const ResultAnimationViewer = lazy(() => import('../../pages/ResultAnimationViewer'));
const DigitalTwinDashboard = lazy(() => import('../../pages/DigitalTwinDashboard'));
const SpacePlanningPage = lazy(() => import('../../pages/SpacePlanningPage'));
const RoomPlannerPage = lazy(() => import('../../pages/room-planner'));
const LearningCenter = lazy(() => import('../../pages/LearningCenter'));
const SitemapPage = lazy(() => import('../../pages/SitemapPage'));

export function FeatureRoutes() {
  return (
    <>
      <Route
        path="/tools/load-combinations"
        element={
          <RequireAuth>
            <LoadCombinationPage />
          </RequireAuth>
        }
      />
      <Route
        path="/tools/section-database"
        element={
          <RequireAuth>
            <SectionDatabasePage />
          </RequireAuth>
        }
      />
      <Route
        path="/tools/bar-bending"
        element={
          <RequireAuth>
            <BarBendingSchedulePage />
          </RequireAuth>
        }
      />

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

      <Route
        path="/workspace/:moduleType"
        element={
          <RequireAuth>
            <WorkspacePageWrapper />
          </RequireAuth>
        }
      />

      <Route path="/auth/callback/:provider" element={<OAuthCallbackPage />} />
      <Route path="/verify-email" element={<VerifyEmailPage />} />

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

      <Route path="/learning" element={<LearningCenter />} />
      <Route path="/sitemap" element={<SitemapPage />} />
    </>
  );
}
