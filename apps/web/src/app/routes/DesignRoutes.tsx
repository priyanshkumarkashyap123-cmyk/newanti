import React, { Suspense, lazy } from 'react';
import { Route } from 'react-router-dom';
import { RequireAuth } from '../../components/layout/RequireAuth';
import { DesignPageSkeleton } from '../../components/ui/DesignPageSkeleton';

const MobileGuard = lazy(() =>
  import('../../components/ui/MobileGuard').then((m) => ({ default: m.MobileGuard })),
);

const SteelDesignPage = lazy(() =>
  import('../../pages/SteelDesignPage').then((module) => ({
    default: module.SteelDesignPage,
  })),
);
const ConnectionDesignPage = lazy(() => import('../../pages/ConnectionDesignPage'));
const DetailingDesignPage = lazy(() => import('../../pages/DetailingDesignPage'));
const ConcreteDesignPage = lazy(() => import('../../pages/ConcreteDesignPage'));
const FoundationDesignPage = lazy(() => import('../../pages/FoundationDesignPage'));
const GeotechnicalDesignPage = lazy(() => import('../../pages/GeotechnicalDesignPage'));
const CompositeDesignPage = lazy(() => import('../../pages/CompositeDesignPage'));
const TimberDesignPage = lazy(() => import('../../pages/TimberDesignPage'));
const StructuralDesignCenter = lazy(() => import('../../pages/StructuralDesignCenter'));
const PostAnalysisDesignHub = lazy(() => import('../../pages/PostAnalysisDesignHub'));

export function DesignRoutes() {
  return (
    <>
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
      <Route
        path="/design/reinforcement"
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
      <Route
        path="/design/geotechnical"
        element={
          <RequireAuth>
            <MobileGuard>
              <Suspense fallback={<DesignPageSkeleton />}>
                <GeotechnicalDesignPage />
              </Suspense>
            </MobileGuard>
          </RequireAuth>
        }
      />
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
      <Route
        path="/design-center"
        element={
          <RequireAuth>
            <StructuralDesignCenter />
          </RequireAuth>
        }
      />
      <Route
        path="/design-hub"
        element={
          <RequireAuth>
            <PostAnalysisDesignHub />
          </RequireAuth>
        }
      />
    </>
  );
}
