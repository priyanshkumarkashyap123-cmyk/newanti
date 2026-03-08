/**
 * Memoized selectors for model store
 * Use these instead of accessing state directly to minimize re-renders.
 *
 * Guidelines:
 *   - Primitive / boolean selectors do NOT need useShallow (Object.is is fine).
 *   - Object / array / Map selectors MUST use useShallow to avoid spurious renders.
 *   - Action selectors are stable refs and do NOT need useShallow.
 *   - Prefer these named selectors over inline useModelStore((s) => …) in components.
 *
 * @see bottleneck_report.md - Component #1 React State Cascade fix
 */

import { useModelStore } from './model';
import type { MemberLoad, AnalysisResults } from './modelTypes';
import { useShallow } from 'zustand/shallow';

const REFERENCE_LOAD = 100; // 100 kN reference for scaling

// ─── Geometry ──────────────────────────────────────────────────────

export const useNodes = () => useModelStore((s) => s.nodes);
export const useMembers = () => useModelStore((s) => s.members);
export const usePlates = () => useModelStore((s) => s.plates);
export const useNodeCount = () => useModelStore((s) => s.nodes.size);
export const useMemberCount = () => useModelStore((s) => s.members.size);
export const usePlateCount = () => useModelStore((s) => s.plates.size);

/** Geometry data bundle — for components that need both nodes & members */
export const useGeometry = () =>
  useModelStore(useShallow((s) => ({ nodes: s.nodes, members: s.members, plates: s.plates })));

// ─── Selection ─────────────────────────────────────────────────────

export const useSelectedIds = () => useModelStore((s) => s.selectedIds);
export const useSelectionCount = () => useModelStore((s) => s.selectedIds.size);
export const useHasSelection = () => useModelStore((s) => s.selectedIds.size > 0);
export const useErrorElementIds = () => useModelStore((s) => s.errorElementIds);
export const useActiveTool = () => useModelStore((s) => s.activeTool);

// ─── Loads ─────────────────────────────────────────────────────────

export const useLoads = () => useModelStore((s) => s.loads);
export const useMemberLoads = () => useModelStore((s) => s.memberLoads);
export const useFloorLoads = () => useModelStore((s) => s.floorLoads);
export const useLoadCases = () => useModelStore((s) => s.loadCases);
export const useLoadCombinations = () => useModelStore((s) => s.loadCombinations);
export const useActiveLoadCaseId = () => useModelStore((s) => s.activeLoadCaseId);

export const useMemberLoadById = (id: string): MemberLoad | undefined =>
  useModelStore(useShallow((s) => s.memberLoads.find((l) => l.id === id)));

export const useMemberLoadCount = (): number =>
  useModelStore((s) => s.memberLoads.length);

export const useMemberLoadIds = (): string[] =>
  useModelStore(useShallow((s) => s.memberLoads.map((l) => l.id)));

export const useMaxLoadMagnitude = (): number =>
  useModelStore((s) => {
    let maxMag = REFERENCE_LOAD;
    for (const ml of s.memberLoads) {
      const w1 = Math.abs(ml.w1 ?? 0);
      const w2 = Math.abs(ml.w2 ?? ml.w1 ?? 0);
      const P = Math.abs(ml.P ?? 0);
      maxMag = Math.max(maxMag, w1, w2, P);
    }
    return maxMag;
  });

// ─── Analysis ──────────────────────────────────────────────────────

export const useAnalysisResults = (): AnalysisResults | null =>
  useModelStore((s) => s.analysisResults);
export const useHasResults = () => useModelStore((s) => s.analysisResults !== null);
export const useIsAnalyzing = () => useModelStore((s) => s.isAnalyzing);

// ─── View / Diagrams ───────────────────────────────────────────────

export const useDisplacementScale = () => useModelStore((s) => s.displacementScale);
export const useDiagramScale = () => useModelStore((s) => s.diagramScale);
export const useShowResults = () => useModelStore((s) => s.showResults);

export const useDiagramVisibility = () =>
  useModelStore(
    useShallow((s) => ({
      showSFD: s.showSFD,
      showBMD: s.showBMD,
      showAFD: s.showAFD,
      showBMDMy: s.showBMDMy,
      showShearZ: s.showShearZ,
      showStressOverlay: s.showStressOverlay,
      showDeflectedShape: s.showDeflectedShape,
    })),
  );

// ─── Modal / Dynamics ──────────────────────────────────────────────

export const useModalResults = () => useModelStore((s) => s.modalResults);
export const useActiveModeIndex = () => useModelStore((s) => s.activeModeIndex);
export const useModeAmplitude = () => useModelStore((s) => s.modeAmplitude);
export const useIsAnimating = () => useModelStore((s) => s.isAnimating);

// ─── Project / Settings ────────────────────────────────────────────

export const useProjectInfo = () => useModelStore(useShallow((s) => s.projectInfo));
export const useSettings = () => useModelStore(useShallow((s) => s.settings));

// ─── Stable Action Refs (never cause re-renders) ──────────────────

export const useSetTool = () => useModelStore((s) => s.setTool);
export const useSelect = () => useModelStore((s) => s.select);
export const useClearSelection = () => useModelStore((s) => s.clearSelection);
export const useSetAnalysisResults = () => useModelStore((s) => s.setAnalysisResults);
export const useSetIsAnalyzing = () => useModelStore((s) => s.setIsAnalyzing);

// Geometry mutations
export const useAddNode = () => useModelStore((s) => s.addNode);
export const useAddNodes = () => useModelStore((s) => s.addNodes);
export const useAddMember = () => useModelStore((s) => s.addMember);
export const useAddMembers = () => useModelStore((s) => s.addMembers);
export const useAddPlate = () => useModelStore((s) => s.addPlate);
export const useUpdateNode = () => useModelStore((s) => s.updateNode);
export const useUpdateNodePosition = () => useModelStore((s) => s.updateNodePosition);
export const useSetNodeRestraints = () => useModelStore((s) => s.setNodeRestraints);
export const useUpdateMember = () => useModelStore((s) => s.updateMember);
export const useSplitMemberById = () => useModelStore((s) => s.splitMemberById);

// Load mutations
export const useAddLoad = () => useModelStore((s) => s.addLoad);
export const useAddMemberLoad = () => useModelStore((s) => s.addMemberLoad);

// Selection helpers
export const useSelectAll = () => useModelStore((s) => s.selectAll);
export const useSelectMultiple = () => useModelStore((s) => s.selectMultiple);
export const useSelectByProperty = () => useModelStore((s) => s.selectByProperty);
export const useSelectByCoordinate = () => useModelStore((s) => s.selectByCoordinate);
export const useSelectParallel = () => useModelStore((s) => s.selectParallel);

// Model structure
export const useClearModel = () => useModelStore((s) => s.clearModel);
export const useLoadStructure = () => useModelStore((s) => s.loadStructure);
export const useSetProjectInfo = () => useModelStore((s) => s.setProjectInfo);
export const useSetErrorElementIds = () => useModelStore((s) => s.setErrorElementIds);
