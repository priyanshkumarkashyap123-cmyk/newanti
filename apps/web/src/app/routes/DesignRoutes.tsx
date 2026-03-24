import React, { lazy, Suspense } from 'react';
import { Route } from 'react-router-dom';
import { Navigate } from 'react-router-dom';
import { RequireAuth } from '../../components/layout/RequireAuth';
import { buildDesignWorkflowTarget } from './workflowIntentRouting';

// Lazy-load new design pages
const DesignToolsFinder = lazy(() =>
  import('../../pages/DesignToolsFinder').then((m) => ({ default: m.DesignToolsFinder })),
);
const MovingLoadPage = lazy(() =>
  import('../../pages/MovingLoadPage').then((m) => ({ default: m.MovingLoadPage })),
);
const TorsionDesignPage = lazy(() =>
  import('../../pages/TorsionDesignPage').then((m) => ({ default: m.TorsionDesignPage })),
);
const RetainingWallDesignPage = lazy(() =>
  import('../../pages/RetainingWallDesignPage').then((m) => ({ default: m.RetainingWallDesignPage })),
);
const StaircaseDesignPage = lazy(() =>
  import('../../pages/StaircaseDesignPage').then((m) => ({ default: m.StaircaseDesignPage })),
);

export function DesignRoutes() {
  return (
    <>
      {/* Design Tools Finder - Unified Discovery Hub */}
      <Route
        path="/design/tools"
        element={
          <RequireAuth>
            <Suspense fallback={<div>Loading...</div>}>
              <DesignToolsFinder />
            </Suspense>
          </RequireAuth>
        }
      />
      
      <Route
        path="/design/steel"
        element={
          <RequireAuth>
            <Navigate to={buildDesignWorkflowTarget('/design/steel', 'steel')} replace />
          </RequireAuth>
        }
      />
      <Route
        path="/design/connections"
        element={
          <RequireAuth>
            <Navigate to={buildDesignWorkflowTarget('/design/connections', 'connections')} replace />
          </RequireAuth>
        }
      />
      <Route
        path="/design/reinforcement"
        element={
          <RequireAuth>
            <Navigate to={buildDesignWorkflowTarget('/design/reinforcement', 'reinforcement')} replace />
          </RequireAuth>
        }
      />
      <Route
        path="/design/detailing"
        element={
          <RequireAuth>
            <Navigate to={buildDesignWorkflowTarget('/design/detailing', 'detailing')} replace />
          </RequireAuth>
        }
      />
      <Route
        path="/design/concrete"
        element={
          <RequireAuth>
            <Navigate to={buildDesignWorkflowTarget('/design/concrete', 'concrete')} replace />
          </RequireAuth>
        }
      />
      <Route
        path="/design/foundation"
        element={
          <RequireAuth>
            <Navigate to={buildDesignWorkflowTarget('/design/foundation', 'foundation')} replace />
          </RequireAuth>
        }
      />
      <Route
        path="/design/geotechnical"
        element={
          <RequireAuth>
            <Navigate to={buildDesignWorkflowTarget('/design/geotechnical', 'geotechnical')} replace />
          </RequireAuth>
        }
      />
      <Route
        path="/design/composite"
        element={
          <RequireAuth>
            <Navigate to={buildDesignWorkflowTarget('/design/composite', 'composite')} replace />
          </RequireAuth>
        }
      />
      <Route
        path="/design/timber"
        element={
          <RequireAuth>
            <Navigate to={buildDesignWorkflowTarget('/design/timber', 'timber')} replace />
          </RequireAuth>
        }
      />
      <Route
        path="/design-center"
        element={
          <RequireAuth>
            <Navigate to={buildDesignWorkflowTarget('/design-center', 'center')} replace />
          </RequireAuth>
        }
      />
      <Route
        path="/design-hub"
        element={
          <RequireAuth>
            <Navigate to={buildDesignWorkflowTarget('/design-hub', 'design-hub')} replace />
          </RequireAuth>
        }
      />
      <Route
        path="/design/advanced-structures"
        element={
          <RequireAuth>
            <Navigate to={buildDesignWorkflowTarget('/design/advanced-structures', 'advanced-structures')} replace />
          </RequireAuth>
        }
      />
      
      {/* ===== NEW DESIGN PAGES - TIER 1 IMPLEMENTATIONS ===== */}
      
      {/* Moving Load Analysis (Bridge Design) */}
      <Route
        path="/design/moving-load"
        element={
          <RequireAuth>
            <Suspense fallback={<div>Loading...</div>}>
              <MovingLoadPage />
            </Suspense>
          </RequireAuth>
        }
      />
      
      {/* Torsion Design */}
      <Route
        path="/design/torsion"
        element={
          <RequireAuth>
            <Suspense fallback={<div>Loading...</div>}>
              <TorsionDesignPage />
            </Suspense>
          </RequireAuth>
        }
      />
      
      {/* Retaining Wall Design */}
      <Route
        path="/design/retaining-wall"
        element={
          <RequireAuth>
            <Suspense fallback={<div>Loading...</div>}>
              <RetainingWallDesignPage />
            </Suspense>
          </RequireAuth>
        }
      />
      
      {/* Staircase Design */}
      <Route
        path="/design/staircase"
        element={
          <RequireAuth>
            <Suspense fallback={<div>Loading...</div>}>
              <StaircaseDesignPage />
            </Suspense>
          </RequireAuth>
        }
      />
    </>
  );
}
