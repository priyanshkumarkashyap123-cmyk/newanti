import { create } from "zustand";
import { devtools } from "zustand/middleware";
import { temporal } from "zundo";
import type { TemporalState } from "zundo";
import { logger } from '../lib/logging/logger';

// Types re-exported from modelTypes.ts for backward compatibility
export type {
  ProjectInfo, Restraints, Node, NodeLoad, MemberLoadType, MemberLoad,
  LoadCaseType, LoadCase, LoadCombination, FloorLoad, SectionType,
  SectionDimensions, Member, Plate, MemberForceData, AnalysisResults,
  PropertyAssignmentPayload, MemberGroup,
  ModeShape, ModalResult, CivilResult, SavedProjectData,
  PropertyAssignmentScopeMode, MaterialFamily, PropertyReductionFactors,
  SectionMechanics,
  DiaphragmSpec, DiaphragmType, DiaphragmPlane,
  BuiltUpComponent, BuiltUpSectionDef,
  PartialReleaseDOF, PartialReleaseEndSpec,
} from './modelTypes';
export type { SpringStiffness } from './modelTypes';
export type { CircularRepeatRequest, CircularRepeatResult, IntersectionSplitResult } from './modelTypes';

import type {
  ProjectInfo, Restraints, Node, NodeLoad, MemberLoad, LoadCase,
  LoadCombination, FloorLoad, Member, Plate, MemberForceData,
  AnalysisResults, ModalResult, CivilResult, SavedProjectData,
  PropertyAssignmentPayload, MemberGroup,
  TranslationalRepeatRequest, TranslationalRepeatResult,
  DiaphragmSpec,
} from './modelTypes';
import type { CircularRepeatRequest, CircularRepeatResult, IntersectionSplitResult } from './modelTypes';
import { extrudeGeometry, rotateCopy, autoNodeIntersections } from '../core/geometry_engine';
import { useUIStore } from './uiStore';

// Re-export persistence functions for backward compatibility
export {
  saveProjectToStorage, loadProjectFromStorage, hydrateAnalysisResults,
  hasSavedProject, getSavedProjectInfo, clearSavedProject,
} from './persistence';

interface ModelState {
  // 2. State using Maps for O(1) lookup
  projectInfo: ProjectInfo; // NEW
  nodes: Map<string, Node>;
  members: Map<string, Member>;
  plates: Map<string, Plate>; // NEW: Shell/slab elements

  // Civil Data Store (Phase 2)
  civilData: Map<string, CivilResult>; // ID -> Result

  loads: NodeLoad[];
  memberLoads: MemberLoad[]; // NEW: Member loads (UDL, UVL, point)
  floorLoads: FloorLoad[]; // Floor/area loads (distributed to beams at analysis time)
  loadCases: LoadCase[]; // Load case definitions (DL, LL, WL, etc.)
  loadCombinations: LoadCombination[]; // Factored load combinations (IS 875, ASCE 7, EC)
  propertyAssignments: PropertyAssignmentPayload[]; // Canonical property assignment payloads
  memberGroups: MemberGroup[]; // Member groups for property precedence
  activeLoadCaseId: string | null; // Currently active load case for editing
  selectedIds: Set<string>;
  /** Element IDs flagged as problematic by analysis error diagnosis */
  errorElementIds: Set<string>;
  analysisResults: AnalysisResults | null;
  isAnalyzing: boolean;
  displacementScale: number; // Scale factor for displaced shape visualization

  // Global Model Settings
  settings: {
    selfWeight: boolean; // Auto-apply self weight (-Y)
  };

  // Sequential ID counters for user-friendly naming (M1, M2, N1, N2...)
  nextNodeNumber: number;
  nextMemberNumber: number;
  getNextNodeId: () => string;
  getNextMemberId: () => string;

  // Diagram visibility
  showSFD: boolean; // Shear Force Diagram (Vy — XY plane)
  showBMD: boolean; // Bending Moment Diagram (Mz — XY plane)
  showAFD: boolean; // Axial Force Diagram
  showBMDMy: boolean; // Weak-axis Bending Moment (My — XZ plane)
  showShearZ: boolean; // Weak-axis Shear Force (Vz — XZ plane)
  showStressOverlay: boolean; // Stress color overlay on members
  showDeflectedShape: boolean; // Deflected shape
  showNodeLabels: boolean; // Node ID labels in viewport
  showMemberLabels: boolean; // Member ID labels in viewport
  showLoadLabels: boolean; // Load magnitude labels in viewport
  diagramScale: number; // Scale factor for diagrams
  showResults: boolean; // Results Table visibility

  // Modal Analysis / Dynamics
  modalResults: ModalResult | null;
  activeModeIndex: number; // Which mode to visualize (0-based)
  modeAmplitude: number; // Amplitude scale for mode shape animation
  isAnimating: boolean; // Play/pause animation

  // Diaphragm definitions (STAAD.Pro parity)
  diaphragms: DiaphragmSpec[];
  addDiaphragm: (d: DiaphragmSpec) => void;
  removeDiaphragm: (id: string) => void;
  // Center of rigidity results (computed post-analysis)
  centerOfRigidity: Map<string, { x: number; z: number; y: number }>; // diaphragmId → CR coords

  // 3. Actions
  setProjectInfo: (info: Partial<ProjectInfo>) => void; // NEW
  addNode: (node: Node) => void;
  removeNode: (id: string) => void;
  addMember: (member: Member) => void;
  updateMember: (id: string, updates: Partial<Member>) => void;
  updateNodePosition: (
    id: string,
    position: Partial<{ x: number; y: number; z: number }>,
  ) => void;
  setNodeRestraints: (id: string, restraints: Restraints) => void;
  addLoad: (load: NodeLoad) => void;
  removeLoad: (id: string) => void;
  addMemberLoad: (load: MemberLoad) => void; // NEW
  removeMemberLoad: (id: string) => void; // NEW
  updateMemberLoadById: (id: string, updates: Partial<MemberLoad>) => void; // Performance optimization
  addFloorLoad: (load: FloorLoad) => void;
  removeFloorLoad: (id: string) => void;
  clearFloorLoads: () => void;
  // Property Assignment CRUD
  addPropertyAssignment: (pa: PropertyAssignmentPayload) => void;
  removePropertyAssignment: (id: string) => void;
  updatePropertyAssignment: (id: string, updates: Partial<PropertyAssignmentPayload>) => void;
  // Member Group CRUD
  addMemberGroup: (group: MemberGroup) => void;
  removeMemberGroup: (id: string) => void;
  updateMemberGroup: (id: string, updates: Partial<MemberGroup>) => void;
  assignPropertyToSelection: (propertyId: string) => void;
  // Load Case Management
  addLoadCase: (lc: LoadCase) => void;
  removeLoadCase: (id: string) => void;
  updateLoadCase: (id: string, updates: Partial<LoadCase>) => void;
  setActiveLoadCase: (id: string | null) => void;
  addLoadCombination: (combo: LoadCombination) => void;
  removeLoadCombination: (id: string) => void;
  updateLoadCombination: (
    id: string,
    updates: Partial<LoadCombination>,
  ) => void;
  setAnalysisResults: (results: AnalysisResults | null) => void;
  setIsAnalyzing: (analyzing: boolean) => void;
  /** Set element IDs to highlight as errors in 3D (from backend errorDetails) */
  setErrorElementIds: (ids: string[]) => void;
  /** Clear error highlighting */
  clearErrorElementIds: () => void;
  select: (id: string, multi: boolean) => void;
  selectNode: (id: string | null, multi?: boolean) => void;
  selectMember: (id: string | null, multi?: boolean) => void;
  updateNode: (id: string, updates: Partial<Node>) => void;
  clearSelection: () => void;
  selectAll: () => void; // Select all nodes and members
  invertSelection: () => void; // Invert current selection
  selectMultiple: (ids: string[]) => void; // Select multiple elements
  boxSelect: (minX: number, minZ: number, maxX: number, maxZ: number) => void; // Box selection
  selectByCoordinate: (
    axis: "x" | "y" | "z",
    min: number,
    max: number,
    add?: boolean,
  ) => void; // Range selection
  selectParallel: (axis: "x" | "y" | "z", add?: boolean) => void; // Select members parallel to axis
  selectByProperty: (
    property: "sectionId" | "E",
    value: string | number,
    add?: boolean,
  ) => void; // Select by property

  // Clipboard Operations (like STAAD)
  clipboard: { nodes: Node[]; members: Member[] } | null;
  copySelection: () => void; // Copy selected to clipboard
  pasteClipboard: (offset?: { x: number; y: number; z: number }) => void; // Paste with offset
  duplicateSelection: (offset?: { x: number; y: number; z: number }) => void; // Duplicate in place
  moveSelection: (dx: number, dy: number, dz: number) => void; // Move selected elements
  deleteSelection: () => void; // Delete all selected

  // Tools
  activeTool:
  | "select"
  | "node"
  | "member"
  | "support"
  | "load"
  | "memberLoad"
  | "select_range"
  | null;
  setTool: (
    tool:
      | "select"
      | "node"
      | "member"
      | "support"
      | "load"
      | "memberLoad"
      | "select_range"
      | null,
  ) => void;
  setDisplacementScale: (scale: number) => void;
  setShowSFD: (show: boolean) => void;
  setShowBMD: (show: boolean) => void;
  setShowAFD: (show: boolean) => void;
  setShowBMDMy: (show: boolean) => void;
  setShowShearZ: (show: boolean) => void;
  setShowStressOverlay: (show: boolean) => void;
  setShowDeflectedShape: (show: boolean) => void;
  setShowNodeLabels: (show: boolean) => void;
  setShowMemberLabels: (show: boolean) => void;
  setShowLoadLabels: (show: boolean) => void;
  setDiagramScale: (scale: number) => void;
  setShowResults: (show: boolean) => void;

  // Report Profile Actions
  applyDiagramProfile: (profile: 'FULL_REPORT' | 'OPTIMIZATION_SUMMARY' | 'SFD_BMD_ONLY') => void;

  // Modal Analysis Actions
  setModalResults: (results: ModalResult | null) => void;
  setActiveModeIndex: (index: number) => void;
  setModeAmplitude: (amplitude: number) => void;
  setIsAnimating: (animating: boolean) => void;

  // Model Management
  clearModel: () => void; // Clears entire model for fresh start
  loadStructure: (nodes: Node[], members: Member[]) => void; // Loads generated structure
  loadProject: (data: SavedProjectData) => boolean; // Load project from API/storage
  autoFixModel: () => { fixed: string[]; errors: string[] }; // Auto-fix common modeling errors

  // Geometry Operations
  removeMember: (id: string) => void;
  addNodes: (nodes: Node[]) => void; // Bulk add nodes
  addMembers: (members: Member[]) => void; // Bulk add members
  applyTranslationalRepeat: (request: TranslationalRepeatRequest) => TranslationalRepeatResult;
  updateNodes: (updates: Map<string, Partial<Node>>) => void; // Batch update nodes
  updateMembers: (updates: Map<string, Partial<Member>>) => void; // Batch update members
  splitMemberById: (memberId: string, ratio: number) => void; // Insert node in member
  mergeNodes: (nodeId1: string, nodeId2: string) => void; // Merge two nodes
  renumberNodes: () => void; // Renumber all nodes from N1
  renumberMembers: () => void; // Renumber all members from M1
  applyCircularRepeat: (request: CircularRepeatRequest) => CircularRepeatResult;
  detectAndAutoNode: (tolerance?: number) => IntersectionSplitResult;

  // Plate/Shell Operations
  nextPlateNumber: number;
  getNextPlateId: () => string;
  addPlate: (plate: Plate) => void;
  removePlate: (id: string) => void;
  updatePlate: (id: string, updates: Partial<Plate>) => void;

  // Civil Data Actions
  addCivilResult: (result: CivilResult) => void;
  removeCivilResult: (id: string) => void;
}

// Helper to convert Map to Record for DevTools display
const serializeMap = (map: Map<any, any>) => {
  return Object.fromEntries(map);
};

/**
 * Shared helper — hydrates a SavedProjectData blob into the state shape
 * expected by useModelStore.setState(). Both the store action `loadProject`
 * and the standalone `loadProjectFromStorage` delegate to this so logic
 * only lives in one place.
 */
function hydrateProjectData(data: SavedProjectData): Partial<ModelState> | null {
  // Validate essential fields
  if (
    !data.projectInfo ||
    !Array.isArray(data.nodes) ||
    !Array.isArray(data.members)
  ) {
    logger.error('Invalid project data structure');
    return null;
  }

  // Restore nodes — support both tuple [id, node] and object { nodeId, ...node } formats
  const nodesMap = new Map<string, Node>();
  data.nodes.forEach((entry: unknown) => {
    let id: string;
    let node: Record<string, unknown>;
    if (Array.isArray(entry) && entry.length >= 2) {
      [id, node] = entry;
    } else if (entry && typeof entry === "object" && 'nodeId' in entry) {
      const { nodeId, ...rest } = entry as Record<string, unknown>;
      id = nodeId as string;
      node = rest;
    } else {
      return; // skip malformed entry
    }
    if (
      id &&
      node &&
      typeof node.x === "number" &&
      typeof node.y === "number" &&
      typeof node.z === "number"
    ) {
      nodesMap.set(id, node as unknown as Node);
    }
  });

  // Restore members — support both tuple [id, member] and object { memberId, ...member } formats
  const membersMap = new Map<string, Member>();
  data.members.forEach((entry: unknown) => {
    let id: string;
    let member: Record<string, unknown>;
    if (Array.isArray(entry) && entry.length >= 2) {
      [id, member] = entry;
    } else if (entry && typeof entry === "object" && 'memberId' in entry) {
      const { memberId, ...rest } = entry as Record<string, unknown>;
      id = memberId as string;
      member = rest;
    } else {
      return; // skip malformed entry
    }
    if (id && member && member.startNodeId && member.endNodeId) {
      membersMap.set(id, member as unknown as Member);
    }
  });

  // Calculate next IDs
  let maxNodeNum = 0;
  let maxMemberNum = 0;
  nodesMap.forEach((_, id) => {
    const match = id?.match?.(/^N(\d+)$/);
    if (match?.[1]) maxNodeNum = Math.max(maxNodeNum, parseInt(match[1], 10) || 0);
  });
  membersMap.forEach((_, id) => {
    const match = id?.match?.(/^M(\d+)$/);
    if (match?.[1]) maxMemberNum = Math.max(maxMemberNum, parseInt(match[1], 10) || 0);
  });

  if (nodesMap.size === 0 && data.nodes.length > 0) {
    logger.warn('No valid nodes loaded from project data');
  }

  // Restore loads
  const loads = Array.isArray(data.loads) ? data.loads : [];
  const memberLoads = Array.isArray(data.memberLoads) ? data.memberLoads : [];
  const loadCases = Array.isArray(data.loadCases) ? data.loadCases : [];
  const loadCombinations = Array.isArray(data.loadCombinations) ? data.loadCombinations : [];
  const propertyAssignments = Array.isArray(data.propertyAssignments) ? data.propertyAssignments : [];
  const memberGroups = Array.isArray(data.memberGroups) ? data.memberGroups : [];
  const floorLoads = Array.isArray(data.floorLoads) ? data.floorLoads : [];

  // Restore plates (may be tuples [id, plate] or objects with .id)
  const platesMap = new Map<string, Plate>();
  if (Array.isArray(data.plates)) {
    data.plates.forEach((entry: unknown) => {
      if (Array.isArray(entry) && entry.length >= 2) {
        platesMap.set(entry[0], entry[1]);
      } else if (entry && typeof entry === 'object' && 'id' in entry) {
        platesMap.set((entry as Record<string, unknown>).id as string, entry as unknown as Plate);
      }
    });
  }

  const labelPrefs = getPersistedLabelPrefs();

  return {
    nodes: nodesMap,
    members: membersMap,
    loads,
    memberLoads,
    loadCases,
    loadCombinations,
    propertyAssignments,
    memberGroups,
    activeLoadCaseId: null,
    projectInfo: data.projectInfo
      ? {
        ...data.projectInfo,
        date: data.projectInfo.date ? new Date(data.projectInfo.date) : new Date(),
      }
      : undefined,
    selectedIds: new Set(),
    analysisResults: null,
    isAnalyzing: false,
    nextNodeNumber: maxNodeNum + 1,
    nextMemberNumber: maxMemberNum + 1,
    // Restore auxiliary state from saved data
    plates: platesMap,
    floorLoads,
    civilData: new Map(),
    clipboard: null,
    nextPlateNumber: 1,
    showSFD: false,
    showBMD: false,
    showAFD: false,
    showBMDMy: false,
    showShearZ: false,
    showStressOverlay: false,
    showDeflectedShape: false,
    showNodeLabels: labelPrefs.showNodeLabels,
    showMemberLabels: labelPrefs.showMemberLabels,
    showLoadLabels: labelPrefs.showLoadLabels,
    diagramScale: 0.05,
    showResults: false,
    modalResults: null,
    activeModeIndex: 0,
    modeAmplitude: 1.0,
    isAnimating: false,
  };
}

// Only enable devtools in development to avoid expensive serialization in production
const withDevtools = <T,>(fn: T): T => {
  if (import.meta.env.DEV) {

    return devtools(fn as any, { name: 'ModelStore', serialize: { options: { map: true } } }) as unknown as T;
  }
  return fn;
};

// Session persistence for analysis results (kept here to avoid circular imports)
const ANALYSIS_SESSION_KEY = "beamlab_analysis_results";
const LABEL_PREFS_KEY = "beamlab_label_display_prefs";

interface LabelDisplayPrefs {
  showNodeLabels: boolean;
  showMemberLabels: boolean;
  showLoadLabels: boolean;
}

const DEFAULT_LABEL_PREFS: LabelDisplayPrefs = {
  showNodeLabels: false,
  showMemberLabels: false,
  showLoadLabels: false,
};

function getPersistedLabelPrefs(): LabelDisplayPrefs {
  if (typeof window === "undefined") return DEFAULT_LABEL_PREFS;
  try {
    const raw = window.localStorage.getItem(LABEL_PREFS_KEY);
    if (!raw) return DEFAULT_LABEL_PREFS;
    const parsed = JSON.parse(raw) as Partial<LabelDisplayPrefs>;
    return {
      showNodeLabels: Boolean(parsed.showNodeLabels),
      showMemberLabels: Boolean(parsed.showMemberLabels),
      showLoadLabels: Boolean(parsed.showLoadLabels),
    };
  } catch {
    return DEFAULT_LABEL_PREFS;
  }
}

function persistLabelPrefs(prefs: LabelDisplayPrefs): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(LABEL_PREFS_KEY, JSON.stringify(prefs));
  } catch {
    // ignore quota/private-mode failures
  }
}

function serializeAnalysisMap<V>(map: Map<string, V> | undefined): [string, V][] | undefined {
  if (!map || map.size === 0) return undefined;
  return Array.from(map.entries());
}

function serializeMemberForcesForSession(
  map: Map<string, MemberForceData> | undefined,
): [string, Partial<MemberForceData>][] | undefined {
  if (!map || map.size === 0) return undefined;

  // Very large result sets should not serialize full diagram arrays to session storage.
  if (map.size > 2000) {
    logger.warn('Skipping member force session persistence for very large result set', { count: map.size });
    return undefined;
  }

  const stripDiagramData = map.size > 500;

  return Array.from(map.entries()).map(([id, value]) => {
    if (!stripDiagramData) return [id, value];
    const { diagramData, ...rest } = value as MemberForceData & { diagramData?: unknown };
    return [id, rest];
  });
}

/** Persist analysis results to sessionStorage — deferred to idle time
 *  so JSON.stringify doesn't block the main thread during interactions. */
let _persistTimer: ReturnType<typeof setTimeout> | null = null;
function persistAnalysisResults(results: AnalysisResults | null): void {
  // Cancel any pending persist
  if (_persistTimer) { clearTimeout(_persistTimer); _persistTimer = null; }

  if (!results) {
    sessionStorage.removeItem(ANALYSIS_SESSION_KEY);
    return;
  }

  // Defer heavy serialization to idle time (or 200ms fallback)
  const doPersist = () => {
    try {
      const serializable = {
        displacements: serializeAnalysisMap(results.displacements),
        reactions: serializeAnalysisMap(results.reactions),
        memberForces: serializeMemberForcesForSession(results.memberForces),
        plateResults: results.plateResults,
        equilibriumCheck: results.equilibriumCheck,
        conditionNumber: results.conditionNumber,
        stats: results.stats,
        completed: results.completed,
        timestamp: results.timestamp ?? Date.now(),
      };
      const json = JSON.stringify(serializable);
      if (json.length > 4.5 * 1024 * 1024) {
        logger.warn('Analysis results too large for sessionStorage, skipping persist');
        return;
      }
      sessionStorage.setItem(ANALYSIS_SESSION_KEY, json);
    } catch (e) {
      logger.warn('Could not persist analysis results', { error: e });
    }
  };

  if (typeof requestIdleCallback !== 'undefined') {
    requestIdleCallback(doPersist, { timeout: 2000 });
  } else {
    _persistTimer = setTimeout(doPersist, 200);
  }
}

export const useModelStore = create<ModelState>()(
  withDevtools(
    temporal(
      (set, get) => ({
        ...(() => getPersistedLabelPrefs())(),
        projectInfo: {
          name: "Structure 1",
          client: "",
          engineer: "",
          jobNo: "",
          rev: "0",
          date: new Date(),
          description: "",
        },
        nodes: new Map(),
        members: new Map(),
        plates: new Map(), // NEW: Plate/shell elements
        civilData: new Map(), // NEW: Phase 2 Civil Persistence
        loads: [],
        memberLoads: [], // NEW: Member distributed/point loads
        floorLoads: [], // Floor/area loads (converted to beam UDLs at analysis time)
        loadCases: [], // Load case definitions
        loadCombinations: [], // Factored load combinations
        propertyAssignments: [], // Canonical property payloads
        memberGroups: [], // Member groups
        activeLoadCaseId: null, // No active load case initially
        selectedIds: new Set(),
        errorElementIds: new Set(),
        analysisResults: null,
        isAnalyzing: false,
        displacementScale: 100, // Default scale factor

        // Global Settings
        settings: {
          selfWeight: true,
        },

        // Sequential ID counters
        nextNodeNumber: 1,
        nextMemberNumber: 1,
        getNextNodeId: () => {
          const state = get();
          const id = `N${state.nextNodeNumber}`;
          set({ nextNodeNumber: state.nextNodeNumber + 1 });
          return id;
        },
        getNextMemberId: () => {
          const state = get();
          const id = `M${state.nextMemberNumber}`;
          set({ nextMemberNumber: state.nextMemberNumber + 1 });
          return id;
        },
        nextPlateNumber: 1,
        getNextPlateId: () => {
          const state = get();
          const id = `P${state.nextPlateNumber}`;
          set({ nextPlateNumber: state.nextPlateNumber + 1 });
          return id;
        },

        showSFD: false,
        showBMD: false,
        showAFD: false,
        showBMDMy: false,
        showShearZ: false,
        showStressOverlay: false,
        showDeflectedShape: false,
        diagramScale: 0.05, // Professional diagram scale
        showResults: false,
        clipboard: null, // Clipboard for copy/paste

        // Modal Analysis state
        modalResults: null,
        activeModeIndex: 0,
        modeAmplitude: 1.0,
        isAnimating: false,

        // Diaphragm definitions (STAAD.Pro parity)
        diaphragms: [],
        centerOfRigidity: new Map(),

        addDiaphragm: (d) =>
          set((state) => ({ diaphragms: [...state.diaphragms, d] })),

        removeDiaphragm: (id) =>
          set((state) => ({ diaphragms: state.diaphragms.filter((d) => d.id !== id) })),

        setProjectInfo: (info) =>
          set((state) => ({ projectInfo: { ...state.projectInfo, ...info } })),

        addNode: (node) =>
          set((state) => {
            const newNodes = new Map(state.nodes);
            newNodes.set(node.id, node);
            return { nodes: newNodes };
          }),

        removeNode: (id) =>
          set((state) => {
            const newNodes = new Map(state.nodes);
            newNodes.delete(id);
            const newMembers = new Map(state.members);
            const deletedMemberIds = new Set<string>();
            for (const [memberId, member] of newMembers.entries()) {
              if (member.startNodeId === id || member.endNodeId === id) {
                newMembers.delete(memberId);
                deletedMemberIds.add(memberId);
              }
            }
            const newSelected = new Set(state.selectedIds);
            if (newSelected.has(id)) newSelected.delete(id);
            const newLoads = state.loads.filter((l) => l.nodeId !== id);
            // Clean up member loads for cascade-deleted members
            const newMemberLoads = state.memberLoads.filter(
              (ml) => !deletedMemberIds.has(ml.memberId),
            );
            // Clean up plates referencing deleted node
            const newPlates = new Map(state.plates);
            for (const [plateId, plate] of newPlates) {
              if (plate.nodeIds.includes(id)) newPlates.delete(plateId);
            }
            return {
              nodes: newNodes,
              members: newMembers,
              selectedIds: newSelected,
              loads: newLoads,
              memberLoads: newMemberLoads,
              plates: newPlates,
            };
          }),

        addMember: (member) =>
          set((state) => {
            const newMembers = new Map(state.members);
            // Apply default material properties if not set
            const memberWithDefaults = {
              ...member,
              sectionId: member.sectionId ?? "Default",
              E: member.E ?? 200e6, // Steel: 200 GPa = 200e6 kN/m²
              A: member.A ?? 0.01, // 100 cm² = 0.01 m²
              I: member.I ?? 1e-4, // 10000 cm⁴ = 1e-4 m⁴
            };
            newMembers.set(member.id, memberWithDefaults);
            return { members: newMembers };
          }),

        updateMember: (id, updates) =>
          set((state) => {
            const member = state.members.get(id);
            if (!member) return state;
            const newMembers = new Map(state.members);
            newMembers.set(id, { ...member, ...updates });
            return { members: newMembers };
          }),

        updateNodePosition: (id, position) =>
          set((state) => {
            const node = state.nodes.get(id);
            if (!node) return state;
            const newNodes = new Map(state.nodes);
            // Merge partial position update (allows updating individual x, y, or z)
            newNodes.set(id, {
              ...node,
              x: position.x ?? node.x,
              y: position.y ?? node.y,
              z: position.z ?? node.z,
            });
            return { nodes: newNodes };
          }),

        setNodeRestraints: (id, restraints) =>
          set((state) => {
            const node = state.nodes.get(id);
            if (!node) return state;
            const newNodes = new Map(state.nodes);
            newNodes.set(id, { ...node, restraints });
            return { nodes: newNodes };
          }),

        addLoad: (load) => set((state) => ({ loads: [...state.loads, load] })),

        removeLoad: (id) =>
          set((state) => ({ loads: state.loads.filter((l) => l.id !== id) })),

        // NEW: Member load actions
        addMemberLoad: (load) =>
          set((state) => {
            // Only create new array if load doesn't already exist
            const exists = state.memberLoads.some((l) => l.id === load.id);
            if (exists) return state;
            return { memberLoads: [...state.memberLoads, load] };
          }),

        removeMemberLoad: (id) =>
          set((state) => ({
            memberLoads: state.memberLoads.filter((l) => l.id !== id),
          })),

        // Floor/Area load actions
        addFloorLoad: (load) =>
          set((state) => {
            const exists = state.floorLoads.some((l) => l.id === load.id);
            if (exists) return state;
            return { floorLoads: [...state.floorLoads, load] };
          }),

        removeFloorLoad: (id) =>
          set((state) => ({
            floorLoads: state.floorLoads.filter((l) => l.id !== id),
          })),

        clearFloorLoads: () => set({ floorLoads: [] }),

        // Property Assignment CRUD
        addPropertyAssignment: (pa: PropertyAssignmentPayload) =>
          set((state) => {
            if (state.propertyAssignments.some((p) => p.id === pa.id)) return state;
            return { propertyAssignments: [...state.propertyAssignments, pa] };
          }),

        removePropertyAssignment: (id: string) =>
          set((state) => ({
            propertyAssignments: state.propertyAssignments.filter((p) => p.id !== id),
          })),

        updatePropertyAssignment: (id: string, updates: Partial<PropertyAssignmentPayload>) =>
          set((state) => ({
            propertyAssignments: state.propertyAssignments.map((p) =>
              p.id === id ? { ...p, ...updates } : p,
            ),
          })),

        // Member Group CRUD
        addMemberGroup: (group: MemberGroup) =>
          set((state) => {
            if (state.memberGroups.some((g) => g.id === group.id)) return state;
            return { memberGroups: [...state.memberGroups, group] };
          }),

        removeMemberGroup: (id: string) =>
          set((state) => ({
            memberGroups: state.memberGroups.filter((g) => g.id !== id),
          })),

        updateMemberGroup: (id: string, updates: Partial<MemberGroup>) =>
          set((state) => ({
            memberGroups: state.memberGroups.map((g) =>
              g.id === id ? { ...g, ...updates } : g,
            ),
          })),

        // Assign property to selected members
        assignPropertyToSelection: (propertyId: string) =>
          set((state) => {
            const newMembers = new Map(state.members);
            for (const id of state.selectedIds) {
              const m = newMembers.get(id);
              if (m) newMembers.set(id, { ...m, propertyAssignmentId: propertyId });
            }
            return { members: newMembers };
          }),

        // Load Case Management
        addLoadCase: (lc) =>
          set((state) => {
            if (state.loadCases.some((c) => c.id === lc.id)) return state;
            return { loadCases: [...state.loadCases, lc] };
          }),

        removeLoadCase: (id) =>
          set((state) => ({
            loadCases: state.loadCases.filter((c) => c.id !== id),
            activeLoadCaseId:
              state.activeLoadCaseId === id ? null : state.activeLoadCaseId,
          })),

        updateLoadCase: (id, updates) =>
          set((state) => ({
            loadCases: state.loadCases.map((c) =>
              c.id === id ? { ...c, ...updates } : c,
            ),
          })),

        setActiveLoadCase: (id) => set({ activeLoadCaseId: id }),

        addLoadCombination: (combo) =>
          set((state) => {
            if (state.loadCombinations.some((c) => c.id === combo.id))
              return state;
            return { loadCombinations: [...state.loadCombinations, combo] };
          }),

        removeLoadCombination: (id) =>
          set((state) => ({
            loadCombinations: state.loadCombinations.filter((c) => c.id !== id),
          })),

        updateLoadCombination: (id, updates) =>
          set((state) => ({
            loadCombinations: state.loadCombinations.map((c) =>
              c.id === id ? { ...c, ...updates } : c,
            ),
          })),

        // Targeted update for single member load - prevents full re-render cascade
        updateMemberLoadById: (id, updates) =>
          set((state) => {
            const idx = state.memberLoads.findIndex((l) => l.id === id);
            if (idx === -1) return state;
            const updated = [...state.memberLoads];
            updated[idx] = { ...updated[idx], ...updates };
            return { memberLoads: updated };
          }),

        // Plate/Shell actions
        addPlate: (plate) =>
          set((state) => {
            const newPlates = new Map(state.plates);
            newPlates.set(plate.id, plate);
            return { plates: newPlates };
          }),

        removePlate: (id) =>
          set((state) => {
            const newPlates = new Map(state.plates);
            newPlates.delete(id);
            return {
              plates: newPlates,
              selectedIds: new Set(
                [...state.selectedIds].filter((i) => i !== id),
              ),
            };
          }),

        updatePlate: (id, updates) =>
          set((state) => {
            const newPlates = new Map(state.plates);
            const existing = newPlates.get(id);
            if (existing) {
              newPlates.set(id, { ...existing, ...updates });
            }
            return { plates: newPlates };
          }),

        setAnalysisResults: (results) => {
          set({ analysisResults: results });
          if (results?.completed) {
            useUIStore
              .getState()
              .markAnalysisFresh(results.timestamp ?? Date.now());
          }
          // Persist to sessionStorage so Design Hub survives navigation
          persistAnalysisResults(results);
        },

        setIsAnalyzing: (analyzing) => set({ isAnalyzing: analyzing }),

        setErrorElementIds: (ids) => set({ errorElementIds: new Set(ids) }),
        clearErrorElementIds: () => set({ errorElementIds: new Set() }),

        select: (id, multi) =>
          set((state) => {
            const newSelected = multi
              ? new Set<string>(state.selectedIds)
              : new Set<string>();
            if (newSelected.has(id)) {
              newSelected.delete(id);
            } else {
              newSelected.add(id);
            }
            return { selectedIds: newSelected };
          }),

        clearSelection: () => set({ selectedIds: new Set() }),

        selectNode: (id, multi = false) =>
          set((state) => {
            if (id === null) return { selectedIds: new Set() };
            if (multi) {
              // Toggle selection with existing items
              const newSelected = new Set(state.selectedIds);
              if (newSelected.has(id)) {
                newSelected.delete(id);
              } else {
                newSelected.add(id);
              }
              return { selectedIds: newSelected };
            }
            return { selectedIds: new Set([id]) };
          }),

        selectMember: (id, multi = false) =>
          set((state) => {
            if (id === null) return { selectedIds: new Set() };
            if (multi) {
              // Toggle selection with existing items
              const newSelected = new Set(state.selectedIds);
              if (newSelected.has(id)) {
                newSelected.delete(id);
              } else {
                newSelected.add(id);
              }
              return { selectedIds: newSelected };
            }
            return { selectedIds: new Set([id]) };
          }),

        updateNode: (id, updates) =>
          set((state) => {
            const node = state.nodes.get(id);
            if (!node) return state;
            const newNodes = new Map(state.nodes);
            newNodes.set(id, { ...node, ...updates });
            return { nodes: newNodes };
          }),

        updateNodes: (updates) =>
          set((state) => {
            const newNodes = new Map(state.nodes);
            let changed = false;
            updates.forEach((update, id) => {
              const node = newNodes.get(id);
              if (node) {
                newNodes.set(id, { ...node, ...update });
                changed = true;
              }
            });
            return changed ? { nodes: newNodes } : state;
          }),

        updateMembers: (updates) =>
          set((state) => {
            const newMembers = new Map(state.members);
            let changed = false;
            updates.forEach((update, id) => {
              const member = newMembers.get(id);
              if (member) {
                newMembers.set(id, { ...member, ...update });
                changed = true;
              }
            });
            return changed ? { members: newMembers } : state;
          }),

        // ============================================
        // ADVANCED SELECTION (Like STAAD)
        // ============================================

        selectAll: () =>
          set((state) => {
            const allIds = new Set<string>();
            state.nodes.forEach((_, id) => allIds.add(id));
            state.members.forEach((_, id) => allIds.add(id));
            state.plates.forEach((_, id) => allIds.add(id));
            return { selectedIds: allIds };
          }),

        invertSelection: () =>
          set((state) => {
            const allIds = new Set<string>();
            state.nodes.forEach((_, id) => allIds.add(id));
            state.members.forEach((_, id) => allIds.add(id));
            state.plates.forEach((_, id) => allIds.add(id));
            const inverted = new Set<string>();
            allIds.forEach((id) => {
              if (!state.selectedIds.has(id)) inverted.add(id);
            });
            return { selectedIds: inverted };
          }),

        selectMultiple: (ids) =>
          set((state) => {
            const newSelected = new Set(state.selectedIds);
            ids.forEach((id) => newSelected.add(id));
            return { selectedIds: newSelected };
          }),

        boxSelect: (minX, minZ, maxX, maxZ) =>
          set((state) => {
            const newSelected = new Set(state.selectedIds);

            // Select nodes within box
            state.nodes.forEach((node, id) => {
              if (
                node.x >= minX &&
                node.x <= maxX &&
                node.z >= minZ &&
                node.z <= maxZ
              ) {
                newSelected.add(id);
              }
            });

            // Select members if both nodes are in selection
            state.members.forEach((member, id) => {
              if (
                newSelected.has(member.startNodeId) &&
                newSelected.has(member.endNodeId)
              ) {
                newSelected.add(id);
              }
            });

            return { selectedIds: newSelected };
          }),

        selectByCoordinate: (axis, min, max, add = false) =>
          set((state) => {
            const newSelected = add
              ? new Set(state.selectedIds)
              : new Set<string>();

            // Select nodes within range
            state.nodes.forEach((node, id) => {
              const val = node[axis];
              if (val >= min && val <= max) {
                newSelected.add(id);
              }
            });

            // Select members if both nodes are within range (OR if strictly fully inside?)
            // "Select at height" usually means members on that floor.
            // If both nodes are selected, member is selected.
            state.members.forEach((member, id) => {
              const start = state.nodes.get(member.startNodeId);
              const end = state.nodes.get(member.endNodeId);
              if (start && end) {
                const startVal = start[axis];
                const endVal = end[axis];

                // Check if member is essentially ON the plane/range
                // Or fully contained?
                // Let's simplify: if BOTH nodes are in range, select member.
                if (
                  startVal >= min &&
                  startVal <= max &&
                  endVal >= min &&
                  endVal <= max
                ) {
                  newSelected.add(id);
                }
              }
            });

            return { selectedIds: newSelected };
          }),

        // Select members parallel to a global axis (X, Y, or Z)
        selectParallel: (axis, add = false) =>
          set((state) => {
            const newSelected = add
              ? new Set(state.selectedIds)
              : new Set<string>();
            const tolerance = 0.1; // 10cm tolerance for "parallel"

            state.members.forEach((member, id) => {
              const start = state.nodes.get(member.startNodeId);
              const end = state.nodes.get(member.endNodeId);
              if (!start || !end) return;

              const dx = Math.abs(end.x - start.x);
              const dy = Math.abs(end.y - start.y);
              const dz = Math.abs(end.z - start.z);

              let isParallel = false;
              switch (axis) {
                case "x":
                  // Parallel to X means Y and Z differences are small, X difference is significant
                  isParallel =
                    dy <= tolerance && dz <= tolerance && dx > tolerance;
                  break;
                case "y":
                  // Parallel to Y (vertical members/columns)
                  isParallel =
                    dx <= tolerance && dz <= tolerance && dy > tolerance;
                  break;
                case "z":
                  // Parallel to Z
                  isParallel =
                    dx <= tolerance && dy <= tolerance && dz > tolerance;
                  break;
              }

              if (isParallel) {
                newSelected.add(id);
              }
            });

            return { selectedIds: newSelected };
          }),

        // Select members by property value (e.g., all members with same section)
        selectByProperty: (property, value, add = false) =>
          set((state) => {
            const newSelected = add
              ? new Set(state.selectedIds)
              : new Set<string>();

            state.members.forEach((member, id) => {
              const memberValue = member[property as keyof typeof member];
              if (memberValue === value) {
                newSelected.add(id);
              }
            });

            return { selectedIds: newSelected };
          }),

        // ============================================
        // CLIPBOARD OPERATIONS
        // ============================================

        copySelection: () =>
          set((state) => {
            const selectedNodes: Node[] = [];
            const selectedMembers: Member[] = [];

            state.selectedIds.forEach((id) => {
              const node = state.nodes.get(id);
              if (node) selectedNodes.push({ ...node });

              const member = state.members.get(id);
              if (member) selectedMembers.push({ ...member });
            });

            return {
              clipboard: { nodes: selectedNodes, members: selectedMembers },
            };
          }),

        pasteClipboard: (offset = { x: 2, y: 0, z: 0 }) =>
          set((state) => {
            if (!state.clipboard) return state;

            const newNodes = new Map(state.nodes);
            const newMembers = new Map(state.members);
            const idMap = new Map<string, string>(); // old ID -> new ID
            const newSelected = new Set<string>();

            // Clone nodes with offset
            state.clipboard.nodes.forEach((node) => {
              const newId = state.getNextNodeId();
              idMap.set(node.id, newId);
              newNodes.set(newId, {
                ...node,
                id: newId,
                x: node.x + offset.x,
                y: node.y + offset.y,
                z: node.z + offset.z,
              });
              newSelected.add(newId);
            });

            // Clone members with updated node references
            state.clipboard.members.forEach((member) => {
              const newStartId = idMap.get(member.startNodeId);
              const newEndId = idMap.get(member.endNodeId);
              if (newStartId && newEndId) {
                const newId = state.getNextMemberId();
                newMembers.set(newId, {
                  ...member,
                  id: newId,
                  startNodeId: newStartId,
                  endNodeId: newEndId,
                });
                newSelected.add(newId);
              }
            });

            return {
              nodes: newNodes,
              members: newMembers,
              selectedIds: newSelected,
            };
          }),

        duplicateSelection: (offset = { x: 2, y: 0, z: 0 }) => {
          const state = get();
          // First copy, then paste
          const selectedNodes: Node[] = [];
          const selectedMembers: Member[] = [];

          state.selectedIds.forEach((id) => {
            const node = state.nodes.get(id);
            if (node) selectedNodes.push({ ...node });

            const member = state.members.get(id);
            if (member) selectedMembers.push({ ...member });
          });

          const newNodes = new Map(state.nodes);
          const newMembers = new Map(state.members);
          const idMap = new Map<string, string>();
          const newSelected = new Set<string>();

          selectedNodes.forEach((node) => {
            const newId = state.getNextNodeId();
            idMap.set(node.id, newId);
            newNodes.set(newId, {
              ...node,
              id: newId,
              x: node.x + offset.x,
              y: node.y + offset.y,
              z: node.z + offset.z,
            });
            newSelected.add(newId);
          });

          selectedMembers.forEach((member) => {
            const newStartId = idMap.get(member.startNodeId);
            const newEndId = idMap.get(member.endNodeId);
            if (newStartId && newEndId) {
              const newId = state.getNextMemberId();
              newMembers.set(newId, {
                ...member,
                id: newId,
                startNodeId: newStartId,
                endNodeId: newEndId,
              });
              newSelected.add(newId);
            }
          });

          set({
            nodes: newNodes,
            members: newMembers,
            selectedIds: newSelected,
          });
        },

        moveSelection: (dx, dy, dz) =>
          set((state) => {
            const newNodes = new Map(state.nodes);

            // Move all selected nodes
            state.selectedIds.forEach((id) => {
              const node = state.nodes.get(id);
              if (node) {
                newNodes.set(id, {
                  ...node,
                  x: node.x + dx,
                  y: node.y + dy,
                  z: node.z + dz,
                });
              }
            });

            return { nodes: newNodes };
          }),

        deleteSelection: () =>
          set((state) => {
            const newNodes = new Map(state.nodes);
            const newMembers = new Map(state.members);
            const newPlates = new Map(state.plates);
            let newLoads = [...state.loads];
            let newMemberLoads = [...state.memberLoads];

            state.selectedIds.forEach((id) => {
              // Delete node
              if (state.nodes.has(id)) {
                newNodes.delete(id);
                // Also delete members connected to this node
                newMembers.forEach((member, memberId) => {
                  if (member.startNodeId === id || member.endNodeId === id) {
                    newMembers.delete(memberId);
                    newMemberLoads = newMemberLoads.filter(
                      (ml) => ml.memberId !== memberId,
                    );
                  }
                });
                // Delete plates referencing this node
                newPlates.forEach((plate, plateId) => {
                  if (plate.nodeIds.includes(id)) newPlates.delete(plateId);
                });
                // Delete loads on this node
                newLoads = newLoads.filter((l) => l.nodeId !== id);
              }

              // Delete member
              if (state.members.has(id)) {
                newMembers.delete(id);
                newMemberLoads = newMemberLoads.filter(
                  (ml) => ml.memberId !== id,
                );
              }

              // Delete plate
              if (state.plates.has(id)) {
                newPlates.delete(id);
              }
            });

            return {
              nodes: newNodes,
              members: newMembers,
              plates: newPlates,
              loads: newLoads,
              memberLoads: newMemberLoads,
              selectedIds: new Set(),
            };
          }),

        activeTool: "select",
        setTool: (tool) => set({ activeTool: tool }),
        setDisplacementScale: (scale) => set({ displacementScale: scale }),
        setShowSFD: (show) => set({ showSFD: show }),
        setShowBMD: (show) => set({ showBMD: show }),
        setShowAFD: (show) => set({ showAFD: show }),
        setShowBMDMy: (show) => set({ showBMDMy: show }),
        setShowShearZ: (show) => set({ showShearZ: show }),
        setShowStressOverlay: (show) => set({ showStressOverlay: show }),
        setShowDeflectedShape: (show) => set({ showDeflectedShape: show }),
        setShowNodeLabels: (show) =>
          set((state) => {
            persistLabelPrefs({
              showNodeLabels: show,
              showMemberLabels: state.showMemberLabels,
              showLoadLabels: state.showLoadLabels,
            });
            return { showNodeLabels: show };
          }),
        setShowMemberLabels: (show) =>
          set((state) => {
            persistLabelPrefs({
              showNodeLabels: state.showNodeLabels,
              showMemberLabels: show,
              showLoadLabels: state.showLoadLabels,
            });
            return { showMemberLabels: show };
          }),
        setShowLoadLabels: (show) =>
          set((state) => {
            persistLabelPrefs({
              showNodeLabels: state.showNodeLabels,
              showMemberLabels: state.showMemberLabels,
              showLoadLabels: show,
            });
            return { showLoadLabels: show };
          }),
        setDiagramScale: (scale) => set({ diagramScale: scale }),
        setShowResults: (show) => set({ showResults: show }),

        // Report Profile Actions
        applyDiagramProfile: (profile) => {
          // Apply diagram visibility based on report profile preset
          const profiles: Record<string, Record<string, boolean>> = {
            'FULL_REPORT': {
              showSFD: true,
              showBMD: true,
              showAFD: true,
              showBMDMy: true,
              showShearZ: true,
              showDeflectedShape: true,
            },
            'OPTIMIZATION_SUMMARY': {
              showSFD: true,
              showBMD: true,
              showAFD: false,
              showBMDMy: false,
              showShearZ: false,
              showDeflectedShape: true,
            },
            'SFD_BMD_ONLY': {
              showSFD: true,
              showBMD: true,
              showAFD: false,
              showBMDMy: false,
              showShearZ: false,
              showDeflectedShape: false,
            },
          };

          const profileConfig = profiles[profile] || profiles['FULL_REPORT'];
          set(profileConfig);
        },

        // Modal Analysis Actions
        setModalResults: (results) => set({ modalResults: results }),
        setActiveModeIndex: (index) => set({ activeModeIndex: index }),
        setModeAmplitude: (amplitude) => set({ modeAmplitude: amplitude }),
        setIsAnimating: (animating) => set({ isAnimating: animating }),

        // Model Management
        clearModel: () =>
          set((state) => ({
            nodes: new Map(),
            members: new Map(),
            plates: new Map(),
            loads: [],
            memberLoads: [],
            floorLoads: [],
            loadCases: [],
            loadCombinations: [],
            propertyAssignments: [],
            memberGroups: [],
            activeLoadCaseId: null,
            selectedIds: new Set(),
            analysisResults: null,
            isAnalyzing: false,
            showSFD: false,
            showBMD: false,
            showAFD: false,
            showBMDMy: false,
            showShearZ: false,
            showStressOverlay: false,
            showDeflectedShape: false,
            showNodeLabels: state.showNodeLabels,
            showMemberLabels: state.showMemberLabels,
            showLoadLabels: state.showLoadLabels,
            diagramScale: 0.05,
            showResults: false,
            modalResults: null,
            activeModeIndex: 0,
            modeAmplitude: 1.0,
            isAnimating: false,
            nextNodeNumber: 1,
            nextMemberNumber: 1,
            nextPlateNumber: 1,
            civilData: new Map(),
            clipboard: null,
          })),

        autoFixModel: () => {
          const fixed: string[] = [];
          const errors: string[] = [];

          set((state) => {
            const newNodes = new Map(state.nodes);
            const newMembers = new Map(state.members);

            // 1. Remove zero-length members
            for (const [id, member] of newMembers) {
              const startNode = newNodes.get(member.startNodeId);
              const endNode = newNodes.get(member.endNodeId);

              if (member.startNodeId === member.endNodeId) {
                newMembers.delete(id);
                fixed.push(
                  `Removed zero-length member ${id} (same start/end node)`,
                );
                continue;
              }

              if (startNode && endNode) {
                const dx = endNode.x - startNode.x;
                const dy = endNode.y - startNode.y;
                const dz = endNode.z - startNode.z;
                const length = Math.sqrt(dx * dx + dy * dy + dz * dz);

                if (length < 0.001) {
                  // Less than 1mm
                  newMembers.delete(id);
                  fixed.push(`Removed zero-length member ${id} (length < 1mm)`);
                }
              }
            }

            // 2. Remove disconnected nodes (not connected to any member)
            const connectedNodeIds = new Set<string>();
            for (const member of newMembers.values()) {
              connectedNodeIds.add(member.startNodeId);
              connectedNodeIds.add(member.endNodeId);
            }

            for (const [id] of newNodes) {
              if (!connectedNodeIds.has(id) && newMembers.size > 0) {
                newNodes.delete(id);
                fixed.push(`Removed disconnected node ${id}`);
              }
            }

            // 3. Remove members referencing non-existent nodes
            for (const [id, member] of newMembers) {
              if (
                !newNodes.has(member.startNodeId) ||
                !newNodes.has(member.endNodeId)
              ) {
                newMembers.delete(id);
                fixed.push(
                  `Removed member ${id} (references non-existent node)`,
                );
              }
            }

            // 4. Ensure at least one support exists
            let hasSupport = false;
            for (const node of newNodes.values()) {
              if (
                node.restraints &&
                (node.restraints.fx || node.restraints.fy || node.restraints.fz)
              ) {
                hasSupport = true;
                break;
              }
            }

            if (!hasSupport && newNodes.size > 0) {
              // Find the node with minimum Y (lowest point) - likely a base
              let lowestNode: Node | null = null;
              let lowestY = Infinity;
              for (const node of newNodes.values()) {
                if (node.y < lowestY) {
                  lowestY = node.y;
                  lowestNode = node;
                }
              }

              if (lowestNode) {
                newNodes.set(lowestNode.id, {
                  ...lowestNode,
                  restraints: {
                    fx: true,
                    fy: true,
                    fz: true,
                    mx: true,
                    my: true,
                    mz: true,
                  },
                });
                fixed.push(
                  `Added fixed support to node ${lowestNode.id} (lowest point)`,
                );
              }
            }

            // 5. Check for duplicate nodes (same coordinates) and merge
            const nodesByCoord = new Map<string, string>();
            const nodesToMerge: [string, string][] = [];

            for (const [id, node] of newNodes) {
              const coordKey = `${node.x.toFixed(3)},${node.y.toFixed(3)},${node.z.toFixed(3)}`;
              if (nodesByCoord.has(coordKey)) {
                nodesToMerge.push([id, nodesByCoord.get(coordKey)!]);
              } else {
                nodesByCoord.set(coordKey, id);
              }
            }

            for (const [duplicateId, keepId] of nodesToMerge) {
              // Update all members referencing the duplicate node
              for (const [memberId, member] of newMembers) {
                let updated = false;
                const updates: Partial<Member> = {};

                if (member.startNodeId === duplicateId) {
                  updates.startNodeId = keepId;
                  updated = true;
                }
                if (member.endNodeId === duplicateId) {
                  updates.endNodeId = keepId;
                  updated = true;
                }

                if (updated) {
                  newMembers.set(memberId, { ...member, ...updates });
                }
              }

              // Preserve restraints from duplicate if keep node has none
              const keepNode = newNodes.get(keepId)!;
              const dupNode = newNodes.get(duplicateId)!;
              if (!keepNode.restraints && dupNode.restraints) {
                newNodes.set(keepId, {
                  ...keepNode,
                  restraints: dupNode.restraints,
                });
              }

              newNodes.delete(duplicateId);
              fixed.push(`Merged duplicate node ${duplicateId} into ${keepId}`);
            }

            // 6. Auto-node intersecting members (interior crossings only)
            const autoNode = autoNodeIntersections(
              Array.from(newMembers.values()),
              newNodes,
              {
                tolerance: 0.01, // 10 mm default geometric tolerance
                existingNodeIds: new Set(newNodes.keys()),
                existingMemberIds: new Set(newMembers.keys()),
              }
            );

            if (autoNode.newNodes.length > 0 || autoNode.newMembers.length > 0) {
              autoNode.newNodes.forEach((node) => newNodes.set(node.id, node));
              autoNode.deletedMemberIds.forEach((id) => newMembers.delete(id));
              autoNode.newMembers.forEach((member) => {
                newMembers.set(member.id, {
                  ...member,
                  sectionId: member.sectionId,
                  E: member.E,
                  A: member.A,
                  I: member.I,
                });
              });
              fixed.push(
                `Auto-noded ${autoNode.newNodes.length} member intersections (${autoNode.deletedMemberIds.length} members split)`
              );
            }

            return { nodes: newNodes, members: newMembers };
          });

          return { fixed, errors };
        },

        loadStructure: (newNodes, newMembers) =>
          set((state) => {
            const nodesMap = new Map<string, Node>();
            const membersMap = new Map<string, Member>();

            // Track highest numbers for counter initialization
            let maxNodeNum = state.nextNodeNumber - 1;
            let maxMemberNum = state.nextMemberNumber - 1;

            for (const node of newNodes) {
              nodesMap.set(node.id, node);
              // Extract number from N1, N2, etc.
              const match = node.id.match(/^N(\d+)$/);
              if (match) {
                maxNodeNum = Math.max(maxNodeNum, parseInt(match[1]));
              }
            }

            for (const member of newMembers) {
              membersMap.set(member.id, {
                ...member,
                E: member.E,
                A: member.A,
                I: member.I,
              });
              // Extract number from M1, M2, etc.
              const match = member.id.match(/^M(\d+)$/);
              if (match) {
                maxMemberNum = Math.max(maxMemberNum, parseInt(match[1]));
              }
            }

            return {
              nodes: nodesMap,
              members: membersMap,
              loads: [],
              memberLoads: [],
              floorLoads: [],
              propertyAssignments: [],
              memberGroups: [],
              selectedIds: new Set(),
              analysisResults: null,
              isAnalyzing: false,
              showSFD: false,
              showBMD: false,
              showAFD: false,
              showBMDMy: false,
              showShearZ: false,
              showStressOverlay: false,
              showDeflectedShape: false,
              showNodeLabels: state.showNodeLabels,
              showMemberLabels: state.showMemberLabels,
              showLoadLabels: state.showLoadLabels,
              nextNodeNumber: maxNodeNum + 1,
              nextMemberNumber: maxMemberNum + 1,
              diagramScale: 0.05,
              showResults: false,
              modalResults: null,
              activeModeIndex: 0,
              modeAmplitude: 1.0,
              isAnimating: false,
            };
          }),

        loadProject: (data: SavedProjectData) => {
          try {
            const hydrated = hydrateProjectData(data);
            if (!hydrated) return false;
            set(hydrated);
            return true;
          } catch (error) {
            logger.error('Error loading project', { error });
            return false;
          }
        },

        // Geometry Operations
        removeMember: (id) =>
          set((state) => {
            const newMembers = new Map(state.members);
            newMembers.delete(id);
            // Also remove any member loads for this member
            const newMemberLoads = state.memberLoads.filter(
              (ml) => ml.memberId !== id,
            );
            return { members: newMembers, memberLoads: newMemberLoads };
          }),

        addNodes: (nodes) =>
          set((state) => {
            const newNodes = new Map(state.nodes);
            nodes.forEach((node) => newNodes.set(node.id, node));
            return { nodes: newNodes };
          }),

        addMembers: (members) =>
          set((state) => {
            const newMembers = new Map(state.members);
            members.forEach((member) => {
              newMembers.set(member.id, {
                ...member,
                E: member.E,
                A: member.A,
                I: member.I,
              });
            });
            return { members: newMembers };
          }),

        applyTranslationalRepeat: (request) => {
          const state = get();

          const nodeIds = new Set<string>(request.nodeIds ?? []);
          (request.memberIds ?? []).forEach((memberId) => {
            const member = state.members.get(memberId);
            if (member) {
              nodeIds.add(member.startNodeId);
              nodeIds.add(member.endNodeId);
            }
          });

          const selectedNodes = Array.from(nodeIds)
            .map((id) => state.nodes.get(id))
            .filter((node): node is Node => node !== undefined);

          const selectedMembers = (request.memberIds ?? [])
            .map((id) => state.members.get(id))
            .filter((member): member is Member => member !== undefined);

          const result = extrudeGeometry(
            selectedNodes,
            selectedMembers,
            request.axis,
            request.spacing_m,
            request.steps,
            request.linkSteps,
            {
              existingNodeIds: new Set(state.nodes.keys()),
              existingMemberIds: new Set(state.members.keys())
            }
          );

          if (result.nodes.length === 0 && result.members.length === 0) {
            useUIStore.getState().showNotification('info', 'No geometry created');
            return { createdNodeIds: [], createdMemberIds: [] };
          }

          set((currentState) => {
            const newNodes = new Map(currentState.nodes);
            const newMembers = new Map(currentState.members);

            result.nodes.forEach((node) => {
              newNodes.set(node.id, node);
            });

            result.members.forEach((member) => {
              newMembers.set(member.id, {
                ...member,
                sectionId: member.sectionId,
                E: member.E,
                A: member.A,
                I: member.I,
              });
            });

            return {
              nodes: newNodes,
              members: newMembers,
              analysisResults: null,
            };
          });

          const createdNodeIds = result.nodes.map((node) => node.id);
          const createdMemberIds = result.members.map((member) => member.id);

          // Highlight created elements in UI
          set(() => ({ selectedIds: new Set<string>([...createdNodeIds, ...createdMemberIds]) }));

          useUIStore.getState().showNotification(
            'success',
            `Created ${createdNodeIds.length} nodes and ${createdMemberIds.length} members`
          );

          // Clear selection after 4s so highlighting is transient
          try { setTimeout(() => set(() => ({ selectedIds: new Set<string>() })), 4000); } catch {
            // Best-effort transient highlight cleanup.
          }

          return { createdNodeIds, createdMemberIds };
        },

        applyCircularRepeat: (request) => {
          const state = get();

          const nodeIds = new Set<string>(request.nodeIds ?? []);
          (request.memberIds ?? []).forEach((memberId) => {
            const member = state.members.get(memberId);
            if (member) {
              nodeIds.add(member.startNodeId);
              nodeIds.add(member.endNodeId);
            }
          });

          const selectedNodes = Array.from(nodeIds)
            .map((id) => state.nodes.get(id))
            .filter((n): n is Node => n !== undefined);

          const selectedMembers = (request.memberIds ?? [])
            .map((id) => state.members.get(id))
            .filter((m): m is Member => m !== undefined);

          if (selectedNodes.length === 0) {
            return { createdNodeIds: [], createdMemberIds: [] };
          }

          const result = rotateCopy(
            selectedNodes,
            selectedMembers,
            request.axis,
            request.center_m,
            (request.angleDeg * Math.PI) / 180,
            request.steps,
            false,
            {
              existingNodeIds: new Set(state.nodes.keys()),
              existingMemberIds: new Set(state.members.keys()),
              linkSteps: request.linkSteps,
              closeLoop: request.closeLoop ?? false,
            }
          );

          if (result.nodes.length === 0 && result.members.length === 0) {
            useUIStore.getState().showNotification('info', 'No geometry created');
            return { createdNodeIds: [], createdMemberIds: [] };
          }

          set((currentState) => {
            const newNodes = new Map(currentState.nodes);
            const newMembers = new Map(currentState.members);

            result.nodes.forEach((node) => newNodes.set(node.id, node));
            result.members.forEach((member) => {
              newMembers.set(member.id, {
                ...member,
                sectionId: member.sectionId,
                E: member.E,
                A: member.A,
                I: member.I,
              });
            });

            return { nodes: newNodes, members: newMembers, analysisResults: null };
          });

          const createdNodeIds = result.nodes.map((n) => n.id);
          const createdMemberIds = result.members.map((m) => m.id);

          set(() => ({ selectedIds: new Set<string>([...createdNodeIds, ...createdMemberIds]) }));
          useUIStore.getState().showNotification(
            'success',
            `Created ${createdNodeIds.length} nodes and ${createdMemberIds.length} members`
          );
          try { setTimeout(() => set(() => ({ selectedIds: new Set<string>() })), 4000); } catch {
            // Best-effort transient highlight cleanup.
          }

          return { createdNodeIds, createdMemberIds };
        },

        detectAndAutoNode: (tolerance = 0.01) => {
          const state = get();

          const autoResult = autoNodeIntersections(
            Array.from(state.members.values()),
            state.nodes,
            {
              tolerance,
              existingNodeIds: new Set(state.nodes.keys()),
              existingMemberIds: new Set(state.members.keys()),
            }
          );

          if (autoResult.newNodes.length === 0 && autoResult.newMembers.length === 0) {
            useUIStore.getState().showNotification('info', 'No intersections found');
            return {
              createdNodeIds: [],
              createdMemberIds: [],
              deletedMemberIds: [],
              intersectionCount: 0,
            };
          }

          set((currentState) => {
            const newNodes = new Map(currentState.nodes);
            const newMembers = new Map(currentState.members);

            autoResult.newNodes.forEach((node) => newNodes.set(node.id, node));
            autoResult.deletedMemberIds.forEach((id) => newMembers.delete(id));
            autoResult.newMembers.forEach((member) => {
              newMembers.set(member.id, {
                ...member,
                sectionId: member.sectionId,
                E: member.E,
                A: member.A,
                I: member.I,
              });
            });

            return { nodes: newNodes, members: newMembers, analysisResults: null };
          });

          const createdNodeIds = autoResult.newNodes.map((n) => n.id);
          const createdMemberIds = autoResult.newMembers.map((m) => m.id);
          const deletedMemberIds = autoResult.deletedMemberIds;

          set(() => ({ selectedIds: new Set<string>([...createdNodeIds, ...createdMemberIds]) }));
          useUIStore.getState().showNotification(
            'success',
            `Auto-noded ${createdNodeIds.length} intersections, created ${createdMemberIds.length} members`
          );
          try { setTimeout(() => set(() => ({ selectedIds: new Set<string>() })), 4000); } catch {
            // Best-effort transient highlight cleanup.
          }

          return { createdNodeIds, createdMemberIds, deletedMemberIds, intersectionCount: createdNodeIds.length };
        },

        splitMemberById: (memberId, ratio) =>
          set((state) => {
            const member = state.members.get(memberId);
            if (!member) return state;

            const startNode = state.nodes.get(member.startNodeId);
            const endNode = state.nodes.get(member.endNodeId);
            if (!startNode || !endNode) return state;

            // Calculate new node position
            const dx = endNode.x - startNode.x;
            const dy = endNode.y - startNode.y;
            const dz = endNode.z - startNode.z;
            const clampedRatio = Math.max(0.01, Math.min(0.99, ratio));

            const newNodeId = state.getNextNodeId();
            const newNode: Node = {
              id: newNodeId,
              x: startNode.x + dx * clampedRatio,
              y: startNode.y + dy * clampedRatio,
              z: startNode.z + dz * clampedRatio,
            };

            // Create two new members
            const member1: Member = {
              id: state.getNextMemberId(),
              startNodeId: member.startNodeId,
              endNodeId: newNodeId,
              sectionId: member.sectionId,
              E: member.E,
              A: member.A,
              I: member.I,
              releases: member.releases,
            };

            const member2: Member = {
              id: state.getNextMemberId(),
              startNodeId: newNodeId,
              endNodeId: member.endNodeId,
              sectionId: member.sectionId,
              E: member.E,
              A: member.A,
              I: member.I,
              releases: member.releases,
            };

            // Update state
            const newNodes = new Map(state.nodes);
            newNodes.set(newNodeId, newNode);

            const newMembers = new Map(state.members);
            newMembers.delete(memberId);
            newMembers.set(member1.id, member1);
            newMembers.set(member2.id, member2);

            // Remove old member loads (user needs to reapply)
            const newMemberLoads = state.memberLoads.filter(
              (ml) => ml.memberId !== memberId,
            );

            const createdNodeIds = [newNodeId];
            const createdMemberIds = [member1.id, member2.id];

            // Highlight created elements and notify
            try {
              useUIStore.getState().showNotification(
                'success',
                `Inserted node ${newNodeId} and split into ${createdMemberIds.length} members`
              );
            } catch {
              // Notification failures are non-fatal for split operation.
            }

            set(() => ({ selectedIds: new Set<string>([...createdNodeIds, ...createdMemberIds]) }));
            try { setTimeout(() => set(() => ({ selectedIds: new Set<string>() })), 4000); } catch {
              // Best-effort transient highlight cleanup.
            }

            return {
              nodes: newNodes,
              members: newMembers,
              memberLoads: newMemberLoads,
              analysisResults: null, // Clear results
            };
          }),

        mergeNodes: (nodeId1, nodeId2) =>
          set((state) => {
            // Keep nodeId1, remove nodeId2
            // Update all members connected to nodeId2 to use nodeId1
            const newNodes = new Map(state.nodes);
            const newMembers = new Map(state.members);

            if (!newNodes.has(nodeId1) || !newNodes.has(nodeId2)) return state;

            const node1 = newNodes.get(nodeId1)!;
            // Move node1 to average position? Or just keep it? Let's just keep node1 for now.

            newNodes.delete(nodeId2);

            // Remap members - build single update to avoid overwrite bug
            newMembers.forEach((member, id) => {
              const updates: Partial<Member> = {};
              if (member.startNodeId === nodeId2) updates.startNodeId = nodeId1;
              if (member.endNodeId === nodeId2) updates.endNodeId = nodeId1;
              if (Object.keys(updates).length > 0) {
                newMembers.set(id, { ...member, ...updates });
              }
            });

            // Remove zero-length members (both endpoints now same node)
            for (const [id, member] of newMembers) {
              if (member.startNodeId === member.endNodeId) {
                newMembers.delete(id);
              }
            }

            // Remap node loads from nodeId2 to nodeId1
            const newLoads = state.loads.map((l) =>
              l.nodeId === nodeId2 ? { ...l, nodeId: nodeId1 } : l,
            );

            // Update selectedIds
            const newSelected = new Set(state.selectedIds);
            if (newSelected.has(nodeId2)) {
              newSelected.delete(nodeId2);
              newSelected.add(nodeId1);
            }

            // Clean up plates referencing nodeId2
            const newPlates = new Map(state.plates);
            for (const [plateId, plate] of newPlates) {
              if (plate.nodeIds.includes(nodeId2)) {
                const remapped = plate.nodeIds.map((nid) =>
                  nid === nodeId2 ? nodeId1 : nid,
                );
                // Check for degenerate plate (duplicate node ids)
                if (new Set(remapped).size < remapped.length) {
                  newPlates.delete(plateId);
                } else {
                  newPlates.set(plateId, {
                    ...plate,
                    nodeIds: remapped as [string, string, string, string],
                  });
                }
              }
            }

            return {
              nodes: newNodes,
              members: newMembers,
              loads: newLoads,
              plates: newPlates,
              selectedIds: newSelected,
              analysisResults: null,
            };
          }),

        renumberNodes: () =>
          set((state) => {
            const sortedNodes = Array.from(state.nodes.values()).sort(
              (a, b) => {
                if (Math.abs(a.y - b.y) > 0.001) return a.y - b.y; // Y (Elevation) first
                if (Math.abs(a.z - b.z) > 0.001) return a.z - b.z; // Then Z
                return a.x - b.x; // Then X
              },
            );

            const newNodes = new Map<string, Node>();
            const idMap = new Map<string, string>(); // old -> new
            const newSelected = new Set(state.selectedIds);
            let counter = 1;

            // Renumber nodes
            sortedNodes.forEach((node) => {
              const newId = `N${counter++}`;
              idMap.set(node.id, newId);
              newNodes.set(newId, { ...node, id: newId });

              // Update selection
              if (state.selectedIds.has(node.id)) {
                newSelected.delete(node.id);
                newSelected.add(newId);
              }
            });

            // Update member references
            const newMembers = new Map(state.members);
            newMembers.forEach((member, mId) => {
              const newStart = idMap.get(member.startNodeId);
              const newEnd = idMap.get(member.endNodeId);
              if (newStart && newEnd) {
                newMembers.set(mId, {
                  ...member,
                  startNodeId: newStart,
                  endNodeId: newEnd,
                });
              }
            });

            // Update nodal loads
            const newLoads = state.loads.map((load) => ({
              ...load,
              nodeId: idMap.get(load.nodeId) || load.nodeId,
            }));

            // Update plate node references
            const newPlates = new Map(state.plates);
            newPlates.forEach((plate, pid) => {
              const remapped = plate.nodeIds.map(
                (nid) => idMap.get(nid) || nid,
              ) as [string, string, string, string];
              newPlates.set(pid, { ...plate, nodeIds: remapped });
            });

            return {
              nodes: newNodes,
              members: newMembers,
              loads: newLoads,
              plates: newPlates,
              selectedIds: newSelected,
              nextNodeNumber: counter,
              analysisResults: null, // Invalidate results
            };
          }),

        renumberMembers: () =>
          set((state) => {
            // Sort by start node ID number (heuristic)
            const sortedMembers = Array.from(state.members.values()).sort(
              (a, b) => {
                // Extract number from N1, N2...
                const n1 = parseInt(a.startNodeId.substring(1)) || 0;
                const n2 = parseInt(b.startNodeId.substring(1)) || 0;
                return n1 - n2;
              },
            );

            const newMembers = new Map<string, Member>();
            const idMap = new Map<string, string>();
            const newSelected = new Set(state.selectedIds);
            let counter = 1;

            sortedMembers.forEach((member) => {
              const newId = `M${counter++}`;
              idMap.set(member.id, newId);
              newMembers.set(newId, { ...member, id: newId });

              if (state.selectedIds.has(member.id)) {
                newSelected.delete(member.id);
                newSelected.add(newId);
              }
            });

            // Update member loads
            const newMemberLoads = state.memberLoads.map((load) => ({
              ...load,
              memberId: idMap.get(load.memberId) || load.memberId,
            }));

            return {
              members: newMembers,
              memberLoads: newMemberLoads,
              selectedIds: newSelected,
              nextMemberNumber: counter,
              analysisResults: null,
            };
          }),

        // Civil Data Actions
        addCivilResult: (result: CivilResult) =>
          set((state) => {
            const newCivilData = new Map(state.civilData);
            newCivilData.set(result.id, result);
            // Cap civil results at 50 to prevent unbounded memory growth
            if (newCivilData.size > 50) {
              const oldestKey = newCivilData.keys().next().value;
              if (oldestKey !== undefined) newCivilData.delete(oldestKey);
            }
            return { civilData: newCivilData };
          }),

        removeCivilResult: (id: string) =>
          set((state) => {
            const newCivilData = new Map(state.civilData);
            newCivilData.delete(id);
            return { civilData: newCivilData };
          }),
      }),
      {
        limit: 25, // Limit undo history
        // Only track structural data in undo history — exclude volatile UI/analysis state
        partialize: (state) => ({
          nodes: state.nodes,
          members: state.members,
          plates: state.plates,
          loads: state.loads,
          memberLoads: state.memberLoads,
          floorLoads: state.floorLoads,
          loadCases: state.loadCases,
          loadCombinations: state.loadCombinations,
          propertyAssignments: state.propertyAssignments,
          memberGroups: state.memberGroups,
          projectInfo: state.projectInfo,
          settings: state.settings,
        }),
        // Prevent duplicate snapshots when structural data hasn't actually changed.
        // Uses a fast length + reference check before falling back to JSON comparison.
        equality: (pastState, currentState) => {
          const keys = Object.keys(pastState) as (keyof typeof pastState)[];
          for (const key of keys) {
            const a = pastState[key];
            const b = currentState[key];
            if (a === b) continue; // Same reference — skip
            if (Array.isArray(a) && Array.isArray(b)) {
              if (a.length !== b.length) return false; // Different count — not equal
            }
            // Deep-compare only when refs differ and lengths match
            if (JSON.stringify(a) !== JSON.stringify(b)) return false;
          }
          return true;
        },
      },
    ),
  ),
);

// Expose the store on globalThis so uiStore validation can lazy-bind without circular imports
(
  globalThis as typeof globalThis & {
    __beamlab_model_store__?: typeof useModelStore;
  }
).__beamlab_model_store__ = useModelStore;

// Automatically mark analysis as stale when structural model state changes after a completed analysis.
useModelStore.subscribe((state, prevState) => {
  if (!prevState.analysisResults?.completed) {
    return;
  }

  const structuralChanged =
    state.nodes !== prevState.nodes ||
    state.members !== prevState.members ||
    state.plates !== prevState.plates ||
    state.loads !== prevState.loads ||
    state.memberLoads !== prevState.memberLoads ||
    state.floorLoads !== prevState.floorLoads ||
    state.propertyAssignments !== prevState.propertyAssignments ||
    state.memberGroups !== prevState.memberGroups;

  if (!structuralChanged) {
    return;
  }

  useUIStore
    .getState()
    .markAnalysisStale('Model changed after analysis. Re-run analysis to refresh results.');
});

// Re-export with temporal type that is erased by the withDevtools any wrapper
export const useModelStoreTemporal = (useModelStore as unknown as {
  temporal: {
    getState: () => TemporalState<ModelState>;
    subscribe: (listener: (state: TemporalState<ModelState>) => void) => () => void;
  };
}).temporal;
