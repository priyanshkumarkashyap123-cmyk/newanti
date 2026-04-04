import React from 'react';
import { Route } from 'react-router-dom';
import { Navigate } from 'react-router-dom';
import { RequireAuth } from '../../components/layout/RequireAuth';
import { buildAnalysisWorkflowTarget } from './workflowIntentRouting';

export function AnalysisRoutes() {
  return (
    <>
      <Route
        path="/analysis/modal"
        element={
          <RequireAuth>
            <Navigate to={buildAnalysisWorkflowTarget('/analysis/modal', 'modal')} replace />
          </RequireAuth>
        }
      />
      <Route
        path="/analysis/time-history"
        element={
          <RequireAuth>
            <Navigate to={buildAnalysisWorkflowTarget('/analysis/time-history', 'time-history')} replace />
          </RequireAuth>
        }
      />
      <Route
        path="/analysis/seismic"
        element={
          <RequireAuth>
            <Navigate to={buildAnalysisWorkflowTarget('/analysis/seismic', 'seismic')} replace />
          </RequireAuth>
        }
      />
      <Route
        path="/analysis/buckling"
        element={
          <RequireAuth>
            <Navigate to={buildAnalysisWorkflowTarget('/analysis/buckling', 'buckling')} replace />
          </RequireAuth>
        }
      />
      <Route
        path="/analysis/cable"
        element={
          <RequireAuth>
            <Navigate to={buildAnalysisWorkflowTarget('/analysis/cable', 'cable')} replace />
          </RequireAuth>
        }
      />
      <Route
        path="/analysis/pdelta"
        element={
          <RequireAuth>
            <Navigate to={buildAnalysisWorkflowTarget('/analysis/pdelta', 'pdelta')} replace />
          </RequireAuth>
        }
      />
      <Route
        path="/analysis/nonlinear"
        element={
          <RequireAuth>
            <Navigate to={buildAnalysisWorkflowTarget('/analysis/nonlinear', 'nonlinear')} replace />
          </RequireAuth>
        }
      />
      <Route
        path="/analysis/dynamic"
        element={
          <RequireAuth>
            <Navigate to={buildAnalysisWorkflowTarget('/analysis/dynamic', 'dynamic')} replace />
          </RequireAuth>
        }
      />
      <Route
        path="/analysis/pushover"
        element={
          <RequireAuth>
            <Navigate to={buildAnalysisWorkflowTarget('/analysis/pushover', 'pushover')} replace />
          </RequireAuth>
        }
      />
      <Route
        path="/analysis/plate-shell"
        element={
          <RequireAuth>
            <Navigate to={buildAnalysisWorkflowTarget('/analysis/plate-shell', 'plate-shell')} replace />
          </RequireAuth>
        }
      />
    </>
  );
}
