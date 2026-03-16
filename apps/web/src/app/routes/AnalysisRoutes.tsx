import React, { Suspense, lazy } from 'react';
import { Route } from 'react-router-dom';
import { RequireAuth } from '../../components/layout/RequireAuth';

const MobileGuard = lazy(() =>
  import('../../components/ui/MobileGuard').then((m) => ({ default: m.MobileGuard })),
);

const TimeHistoryPanel = lazy(() =>
  import('../../components/analysis/TimeHistoryPanel').then((module) => ({
    default: module.TimeHistoryPanel,
  })),
);
const SeismicAnalysisPanel = lazy(() =>
  import('../../components/analysis/SeismicAnalysisPanel').then((module) => ({
    default: module.SeismicAnalysisPanel,
  })),
);
const BucklingAnalysisPanel = lazy(() =>
  import('../../components/analysis/BucklingAnalysisPanel').then((module) => ({
    default: module.BucklingAnalysisPanel,
  })),
);
const CableAnalysisPanel = lazy(() =>
  import('../../components/analysis/CableAnalysisPanel').then((module) => ({
    default: module.CableAnalysisPanel,
  })),
);
const PDeltaAnalysisPanel = lazy(() =>
  import('../../components/analysis/PDeltaAnalysisPanel').then((module) => ({
    default: module.PDeltaAnalysisPanel,
  })),
);

const NonlinearAnalysisPage = lazy(() => import('../../pages/NonlinearAnalysisPage'));
const DynamicAnalysisPage = lazy(() => import('../../pages/DynamicAnalysisPage'));
const PushoverAnalysisPage = lazy(() => import('../../pages/PushoverAnalysisPage'));
const PlateShellAnalysisPage = lazy(() => import('../../pages/PlateShellAnalysisPage'));

const ModalAnalysisRouteWrapper = lazy(() =>
  import('./ModalAnalysisRouteWrapper').then((module) => ({
    default: module.ModalAnalysisRouteWrapper,
  })),
);

export function AnalysisRoutes() {
  return (
    <>
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
    </>
  );
}
