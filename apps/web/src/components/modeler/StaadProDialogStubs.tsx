/**
 * StaadProDialogStubs.tsx
 *
 * Lazy-loaded dialog stubs for STAAD.Pro parity features.
 * Each stub renders null until the full dialog component is implemented.
 * Wired via uiStore modals keys.
 */
import React from 'react';
import { useUIStore } from '../../store/uiStore';

// Lazy imports — will be replaced with real components as they are implemented
const PartialReleaseDialog = React.lazy(() =>
  import('../dialogs/PartialReleaseDialog').then((m) => ({ default: m.PartialReleaseDialog })).catch(() => ({ default: () => null }))
);
const InactiveMemberDialog = React.lazy(() =>
  import('../dialogs/InactiveMemberDialog').then((m) => ({ default: m.InactiveMemberDialog })).catch(() => ({ default: () => null }))
);
const DiaphragmAssignmentDialog = React.lazy(() =>
  import('../dialogs/DiaphragmAssignmentDialog').then((m) => ({ default: m.DiaphragmAssignmentDialog })).catch(() => ({ default: () => null }))
);
const MasterSlaveDialog = React.lazy(() =>
  import('../dialogs/MasterSlaveDialog').then((m) => ({ default: m.MasterSlaveDialog })).catch(() => ({ default: () => null }))
);
const PropertyReductionDialog = React.lazy(() =>
  import('../dialogs/PropertyReductionDialog').then((m) => ({ default: m.PropertyReductionDialog })).catch(() => ({ default: () => null }))
);
const FloorLoadDialog = React.lazy(() =>
  import('../dialogs/FloorLoadDialog').then((m) => ({ default: m.FloorLoadDialog })).catch(() => ({ default: () => null }))
);
const AreaLoadDialog = React.lazy(() =>
  import('../dialogs/AreaLoadDialog').then((m) => ({ default: m.AreaLoadDialog })).catch(() => ({ default: () => null }))
);
const SnowLoadDialog = React.lazy(() =>
  import('../dialogs/SnowLoadDialog').then((m) => ({ default: m.SnowLoadDialog })).catch(() => ({ default: () => null }))
);
const ResponseSpectrumDialog = React.lazy(() =>
  import('../dialogs/ResponseSpectrumDialog').then((m) => ({ default: m.ResponseSpectrumDialog })).catch(() => ({ default: () => null }))
);
const PushoverAnalysisDialog = React.lazy(() =>
  import('../dialogs/PushoverAnalysisDialog').then((m) => ({ default: m.PushoverAnalysisDialog })).catch(() => ({ default: () => null }))
);
const ImperfectionAnalysisDialog = React.lazy(() =>
  import('../dialogs/ImperfectionAnalysisDialog').then((m) => ({ default: m.ImperfectionAnalysisDialog })).catch(() => ({ default: () => null }))
);
const StoryDriftPanel = React.lazy(() =>
  import('../dialogs/StoryDriftPanel').then((m) => ({ default: m.StoryDriftPanel })).catch(() => ({ default: () => null }))
);
const ForceEnvelopePanel = React.lazy(() =>
  import('../dialogs/ForceEnvelopePanel').then((m) => ({ default: m.ForceEnvelopePanel })).catch(() => ({ default: () => null }))
);
const SectionForcesPanel = React.lazy(() =>
  import('../dialogs/SectionForcesPanel').then((m) => ({ default: m.SectionForcesPanel })).catch(() => ({ default: () => null }))
);
const ModeShapeAnimationPanel = React.lazy(() =>
  import('../dialogs/ModeShapeAnimationPanel').then((m) => ({ default: m.ModeShapeAnimationPanel })).catch(() => ({ default: () => null }))
);

/**
 * Renders all STAAD.Pro parity dialogs.
 * Each dialog is only mounted when its modal key is true.
 */
export const StaadProDialogStubs: React.FC = () => {
  const modals = useUIStore((s) => s.modals);
  const closeModal = useUIStore((s) => s.closeModal);

  return (
    <React.Suspense fallback={null}>
      {modals.partialReleaseDialog && (
        <PartialReleaseDialog
          open={modals.partialReleaseDialog}
          onClose={() => closeModal('partialReleaseDialog')}
        />
      )}
      {modals.inactiveMemberDialog && (
        <InactiveMemberDialog
          open={modals.inactiveMemberDialog}
          onClose={() => closeModal('inactiveMemberDialog')}
        />
      )}
      {modals.diaphragmAssignmentDialog && (
        <DiaphragmAssignmentDialog
          open={modals.diaphragmAssignmentDialog}
          onClose={() => closeModal('diaphragmAssignmentDialog')}
        />
      )}
      {modals.masterSlaveDialog && (
        <MasterSlaveDialog
          open={modals.masterSlaveDialog}
          onClose={() => closeModal('masterSlaveDialog')}
        />
      )}
      {modals.propertyReductionDialog && (
        <PropertyReductionDialog
          open={modals.propertyReductionDialog}
          onClose={() => closeModal('propertyReductionDialog')}
        />
      )}
      {modals.floorLoadDialog && (
        <FloorLoadDialog
          open={modals.floorLoadDialog}
          onClose={() => closeModal('floorLoadDialog')}
        />
      )}
      {modals.areaLoadDialog && (
        <AreaLoadDialog
          open={modals.areaLoadDialog}
          onClose={() => closeModal('areaLoadDialog')}
        />
      )}
      {modals.snowLoadDialog && (
        <SnowLoadDialog
          open={modals.snowLoadDialog}
          onClose={() => closeModal('snowLoadDialog')}
        />
      )}
      {modals.responseSpectrumDialog && (
        <ResponseSpectrumDialog
          open={modals.responseSpectrumDialog}
          onClose={() => closeModal('responseSpectrumDialog')}
        />
      )}
      {modals.pushoverAnalysisDialog && (
        <PushoverAnalysisDialog
          open={modals.pushoverAnalysisDialog}
          onClose={() => closeModal('pushoverAnalysisDialog')}
        />
      )}
      {modals.imperfectionAnalysisDialog && (
        <ImperfectionAnalysisDialog
          open={modals.imperfectionAnalysisDialog}
          onClose={() => closeModal('imperfectionAnalysisDialog')}
        />
      )}
      {modals.storyDriftPanel && (
        <StoryDriftPanel
          open={modals.storyDriftPanel}
          onClose={() => closeModal('storyDriftPanel')}
        />
      )}
      {modals.forceEnvelopePanel && (
        <ForceEnvelopePanel
          open={modals.forceEnvelopePanel}
          onClose={() => closeModal('forceEnvelopePanel')}
        />
      )}
      {modals.sectionForcesPanel && (
        <SectionForcesPanel
          open={modals.sectionForcesPanel}
          onClose={() => closeModal('sectionForcesPanel')}
        />
      )}
      {modals.modeShapeAnimationPanel && (
        <ModeShapeAnimationPanel
          open={modals.modeShapeAnimationPanel}
          onClose={() => closeModal('modeShapeAnimationPanel')}
        />
      )}
    </React.Suspense>
  );
};
