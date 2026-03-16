import React, { lazy } from 'react';

const MobileGuard = lazy(() =>
  import('../../components/ui/MobileGuard').then((module) => ({
    default: module.MobileGuard,
  })),
);

const ModernModeler = lazy(() =>
  import('../../components/ModernModeler').then((module) => ({
    default: module.ModernModeler,
  })),
);

export function WorkspacePageWrapper() {
  return (
    <MobileGuard>
      <ModernModeler />
    </MobileGuard>
  );
}
