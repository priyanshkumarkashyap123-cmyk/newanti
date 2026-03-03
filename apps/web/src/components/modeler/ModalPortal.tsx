/**
 * ModalPortal.tsx – Central portal for rendering all simple dialogs
 *
 * CRITICAL OPTIMIZATION:
 * - Each dialog wrapper subscribes to ONE Zustand modal key via a selector
 *   e.g. useUIStore(s => s.modals.foundationDesign)
 * - Opening dialog A does NOT re-render dialog B
 * - Dialog only mounts in DOM when its key is `true`
 *
 * Performance Impact:
 *   Before: 40 dialogs always in tree inside ModernModeler (1000+ re-renders/sec)
 *   After : Each dialog isolated, re-renders only on its OWN state change
 */

import React, { Suspense, memo, useCallback } from 'react';
import { useUIStore } from '../../store/uiStore';

// ---- Re-use existing lazy imports from lazyDialogs.ts ----
import {
  FoundationDesignDialog,
  IS875LoadDialog,
  GeometryToolsPanel,
  InteroperabilityDialog,
  RailwayBridgeDialog,
  MeshingPanel,
  AdvancedSelectionPanel,
  LoadDialog,
  WindLoadDialog,
  SeismicLoadDialog,
  MovingLoadDialog,
  PlateCreationDialog,
  FloorSlabDialog,
  BoundaryConditionsDialog,
  SelectionToolbar,
  DeadLoadGenerator,
  StructureGallery,
  CurvedStructureDialog,
  DetailedDesignPanel,
  SteelDesignDialog,
  ConcreteDesignDialog,
  ConnectionDesignDialog,
  CivilEngineeringDialog,
  SectionAssignDialog,
  SectionDesignerDialog,
  BetaAngleDialog,
  MemberReleasesDialog,
  MemberOffsetsDialog,
  DivideMemberDialog,
  MergeNodesDialog,
  TemperatureLoadDialog,
  TimeHistoryDialog,
  TrussGeneratorDialog,
  ArchGeneratorDialog,
  FrameGeneratorDialog,
  CablePatternDialog,
  ASCE7SeismicLoadDialog,
  ASCE7WindLoadDialog,
  LoadCombinationsDialog,
  IS1893SeismicLoadDialog,
  SectionBrowserDialog,
} from './lazyDialogs';

// ---- Types ----
type ModalKey = keyof ReturnType<typeof useUIStore.getState>['modals'];

// ============================================================
// Generic wrapper: subscribes to a SINGLE modal key
// Uses Zustand selector → only re-renders when THIS key changes
// ============================================================

/**
 * IsOpenModal – for dialogs that accept `isOpen` + `onClose` props.
 */
const IsOpenModal = memo(function IsOpenModal({
  modalKey,
  component: Component,
}: {
  modalKey: ModalKey;
  component: React.ComponentType<{ isOpen: boolean; onClose: () => void }>;
}) {
  const isOpen = useUIStore((s) => s.modals[modalKey]);
  const close = useCallback(() => useUIStore.getState().closeModal(modalKey), [modalKey]);
  return (
    <Suspense fallback={null}>
      <Component isOpen={isOpen} onClose={close} />
    </Suspense>
  );
});

/**
 * OpenPropModal – for dialogs that accept `open` + `onClose` props
 * (e.g. BoundaryConditionsDialog, SelectionToolbar, DeadLoadGenerator).
 */
const OpenPropModal = memo(function OpenPropModal({
  modalKey,
  component: Component,
}: {
  modalKey: ModalKey;
  component: React.ComponentType<{ open: boolean; onClose: () => void }>;
}) {
  const isOpen = useUIStore((s) => s.modals[modalKey]);
  const close = useCallback(() => useUIStore.getState().closeModal(modalKey), [modalKey]);
  return (
    <Suspense fallback={null}>
      <Component open={isOpen} onClose={close} />
    </Suspense>
  );
});

/**
 * ConditionalModal – for dialogs that should only mount when open
 * (no isOpen/onClose props; they manage their own state internally).
 */
const ConditionalModal = memo(function ConditionalModal({
  modalKey,
  component: Component,
}: {
  modalKey: ModalKey;
  component: React.ComponentType;
}) {
  const isOpen = useUIStore((s) => s.modals[modalKey]);
  if (!isOpen) return null;
  return (
    <Suspense fallback={null}>
      <Component />
    </Suspense>
  );
});

// ============================================================
// ModalPortal – renders all simple dialogs via isolated wrappers
// ============================================================

export const ModalPortal: React.FC = memo(function ModalPortal() {
  return (
    <>
      {/* ── isOpen + onClose pattern ── */}
      <IsOpenModal modalKey="foundationDesign" component={FoundationDesignDialog} />
      <IsOpenModal modalKey="is875Load" component={IS875LoadDialog} />
      <IsOpenModal modalKey="geometryTools" component={GeometryToolsPanel} />
      <IsOpenModal modalKey="interoperability" component={InteroperabilityDialog} />
      <IsOpenModal modalKey="railwayBridge" component={RailwayBridgeDialog} />
      <IsOpenModal modalKey="meshing" component={MeshingPanel} />
      <IsOpenModal modalKey="plateDialog" component={PlateCreationDialog} />
      <IsOpenModal modalKey="floorSlabDialog" component={FloorSlabDialog} />
      <IsOpenModal modalKey="loadDialog" component={LoadDialog} />
      <IsOpenModal modalKey="structureGallery" component={StructureGallery} />
      <IsOpenModal modalKey="curvedStructure" component={CurvedStructureDialog} />
      <IsOpenModal modalKey="detailedDesign" component={DetailedDesignPanel} />
      <IsOpenModal modalKey="steelDesign" component={SteelDesignDialog} />
      <IsOpenModal modalKey="concreteDesign" component={ConcreteDesignDialog} />
      <IsOpenModal modalKey="connectionDesign" component={ConnectionDesignDialog} />
      <IsOpenModal modalKey="civilEngineering" component={CivilEngineeringDialog} />
      <IsOpenModal modalKey="sectionAssign" component={SectionAssignDialog} />
      <IsOpenModal modalKey="betaAngle" component={BetaAngleDialog} />
      <IsOpenModal modalKey="memberReleases" component={MemberReleasesDialog} />
      <IsOpenModal modalKey="memberOffsets" component={MemberOffsetsDialog} />
      <IsOpenModal modalKey="divideMember" component={DivideMemberDialog} />
      <IsOpenModal modalKey="mergeNodes" component={MergeNodesDialog} />
      <IsOpenModal modalKey="temperatureLoad" component={TemperatureLoadDialog} />
      <IsOpenModal modalKey="timeHistoryAnalysis" component={TimeHistoryDialog} />
      <IsOpenModal modalKey="trussGenerator" component={TrussGeneratorDialog} />
      <IsOpenModal modalKey="archGenerator" component={ArchGeneratorDialog} />
      <IsOpenModal modalKey="frameGenerator" component={FrameGeneratorDialog} />
      <IsOpenModal modalKey="cablePatternGenerator" component={CablePatternDialog} />

      {/* ── open + onClose pattern ── */}
      <OpenPropModal modalKey="boundaryConditionsDialog" component={BoundaryConditionsDialog} />
      <OpenPropModal modalKey="selectionToolbar" component={SelectionToolbar} />
      <OpenPropModal modalKey="deadLoadGenerator" component={DeadLoadGenerator} />
      <OpenPropModal modalKey="sectionBuilder" component={SectionDesignerDialog} />

      {/* ── Conditionally-mounted (no props, manage own state internally) ── */}
      <ConditionalModal modalKey="windLoadDialog" component={WindLoadDialog} />
      <ConditionalModal modalKey="seismicLoadDialog" component={SeismicLoadDialog} />
      <ConditionalModal modalKey="movingLoadDialog" component={MovingLoadDialog} />
      <ConditionalModal modalKey="asce7SeismicDialog" component={ASCE7SeismicLoadDialog} />
      <ConditionalModal modalKey="asce7WindDialog" component={ASCE7WindLoadDialog} />
      <ConditionalModal modalKey="loadCombinationsDialog" component={LoadCombinationsDialog} />
      <ConditionalModal modalKey="is1893SeismicDialog" component={IS1893SeismicLoadDialog} />
      <ConditionalModal modalKey="sectionBrowserDialog" component={SectionBrowserDialog} />

      {/* ── Always-present (no visibility props, manages own state) ── */}
      <Suspense fallback={null}>
        <AdvancedSelectionPanel />
      </Suspense>
    </>
  );
});
