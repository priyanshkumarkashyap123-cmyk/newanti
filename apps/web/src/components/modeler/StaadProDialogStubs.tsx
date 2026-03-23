/**
 * StaadProDialogStubs.tsx
 *
 * Lazy-loaded dialog stubs for STAAD.Pro parity features.
 * Each stub renders null until the full dialog component is implemented.
 * Wired via uiStore modals keys.
 */
import React from 'react';
import { useUIStore } from '../../store/uiStore';
import { API_CONFIG } from '../../config/env';

type DialogProps = {
  open: boolean;
  onClose: () => void;
};

const emitDialogImportFailure = async (dialogName: string, error: unknown) => {
  const payload = {
    events: [
      {
        name: 'dialog_import_failure',
        timestamp: new Date().toISOString(),
        sessionId: `dialog-${Date.now()}`,
        properties: {
          dialogName,
          route: window.location.pathname,
          message: error instanceof Error ? error.message : String(error),
        },
      },
    ],
  };

  try {
    await fetch(`${API_CONFIG.baseUrl}/api/analytics/batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(payload),
    });
  } catch {
    // Avoid throwing from telemetry path
  }
};

const createDialogImportFallback = (dialogName: string): React.FC<DialogProps> => {
  const FallbackDialog: React.FC<DialogProps> = ({ open, onClose }) => {
    if (!open) return null;

    return (
      <div className="fixed inset-0 z-[90] bg-black/50 flex items-center justify-center p-4">
        <div className="w-full max-w-lg bg-[#0b1326] border border-[#1a2333] rounded-xl shadow-2xl overflow-hidden">
          <div className="px-5 py-3 border-b border-[#1a2333]">
            <h3 className="text-sm font-semibold text-[#dae2fd]">Dialog failed to load</h3>
          </div>
          <div className="px-5 py-4 text-sm text-[#869ab8] space-y-2">
            <p>
              <span className="text-[#dae2fd] font-medium tracking-wide">{dialogName}</span> could not be loaded in this build.
            </p>
            <p>
              Please close this dialog and retry. If the issue persists, open diagnostics and report this with the dialog name.
            </p>
          </div>
          <div className="px-5 py-3 border-t border-[#1a2333] flex justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium tracking-wide"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  };

  FallbackDialog.displayName = `${dialogName}ImportFallback`;
  return FallbackDialog;
};

const createLazyDialog = <T extends React.ComponentType<DialogProps>>(
  dialogName: string,
  loader: () => Promise<{ default: T }>,
) => React.lazy(async () => {
  try {
    return await loader();
  } catch (error) {
    await emitDialogImportFailure(dialogName, error);
    return { default: createDialogImportFallback(dialogName) as T };
  }
});

// Lazy imports — will be replaced with real components as they are implemented
const PartialReleaseDialog = createLazyDialog('PartialReleaseDialog', () =>
  import('../dialogs/PartialReleaseDialog').then((m) => ({ default: m.PartialReleaseDialog }))
);
const InactiveMemberDialog = createLazyDialog('InactiveMemberDialog', () =>
  import('../dialogs/InactiveMemberDialog').then((m) => ({ default: m.InactiveMemberDialog }))
);
const DiaphragmAssignmentDialog = createLazyDialog('DiaphragmAssignmentDialog', () =>
  import('../dialogs/DiaphragmAssignmentDialog').then((m) => ({ default: m.DiaphragmAssignmentDialog }))
);
const MasterSlaveDialog = createLazyDialog('MasterSlaveDialog', () =>
  import('../dialogs/MasterSlaveDialog').then((m) => ({ default: m.MasterSlaveDialog }))
);
const PropertyReductionDialog = createLazyDialog('PropertyReductionDialog', () =>
  import('../dialogs/PropertyReductionDialog').then((m) => ({ default: m.PropertyReductionDialog }))
);
const FloorLoadDialog = createLazyDialog('FloorLoadDialog', () =>
  import('../dialogs/FloorLoadDialog').then((m) => ({ default: m.FloorLoadDialog }))
);
const AreaLoadDialog = createLazyDialog('AreaLoadDialog', () =>
  import('../dialogs/AreaLoadDialog').then((m) => ({ default: m.AreaLoadDialog }))
);
const SnowLoadDialog = createLazyDialog('SnowLoadDialog', () =>
  import('../dialogs/SnowLoadDialog').then((m) => ({ default: m.SnowLoadDialog }))
);
const ResponseSpectrumDialog = createLazyDialog('ResponseSpectrumDialog', () =>
  import('../dialogs/ResponseSpectrumDialog').then((m) => ({ default: m.ResponseSpectrumDialog }))
);
const PushoverAnalysisDialog = createLazyDialog('PushoverAnalysisDialog', () =>
  import('../dialogs/PushoverAnalysisDialog').then((m) => ({ default: m.PushoverAnalysisDialog }))
);
const ImperfectionAnalysisDialog = createLazyDialog('ImperfectionAnalysisDialog', () =>
  import('../dialogs/ImperfectionAnalysisDialog').then((m) => ({ default: m.ImperfectionAnalysisDialog }))
);
const StoryDriftPanel = createLazyDialog('StoryDriftPanel', () =>
  import('../dialogs/StoryDriftPanel').then((m) => ({ default: m.StoryDriftPanel }))
);
const ForceEnvelopePanel = createLazyDialog('ForceEnvelopePanel', () =>
  import('../dialogs/ForceEnvelopePanel').then((m) => ({ default: m.ForceEnvelopePanel }))
);
const SectionForcesPanel = createLazyDialog('SectionForcesPanel', () =>
  import('../dialogs/SectionForcesPanel').then((m) => ({ default: m.SectionForcesPanel }))
);
const ModeShapeAnimationPanel = createLazyDialog('ModeShapeAnimationPanel', () =>
  import('../dialogs/ModeShapeAnimationPanel').then((m) => ({ default: m.ModeShapeAnimationPanel }))
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
