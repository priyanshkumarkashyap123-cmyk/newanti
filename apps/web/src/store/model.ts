import { create } from "zustand";
import { devtools } from "zustand/middleware";
import { temporal } from "zundo";

export interface ProjectInfo {
  name: string;
  client: string;
  engineer: string;
  jobNo: string;
  rev: string;
  date: Date;
  description: string;
  cloudId?: string; // ID from database if saved
}

export interface Restraints {
  fx: boolean;
  fy: boolean;
  fz: boolean;
  mx: boolean;
  my: boolean;
  mz: boolean;
}

export interface Node {
  id: string;
  x: number;
  y: number;
  z: number;
  restraints?: Restraints; // Optional: Support conditions
}

export interface NodeLoad {
  id: string;
  nodeId: string;
  fx?: number;
  fy?: number;
  fz?: number; // Forces (kN)
  mx?: number;
  my?: number;
  mz?: number; // Moments (kN-m)
}

// Member Loads (applied on members)
export type MemberLoadType = "UDL" | "UVL" | "point" | "moment";

export interface MemberLoad {
  id: string;
  memberId: string;
  type: MemberLoadType;
  // For distributed loads (UDL/UVL)
  w1?: number; // Intensity at start (kN/m) - for UDL, w1 = w2
  w2?: number; // Intensity at end (kN/m)
  // For point loads
  P?: number; // Point load magnitude (kN)
  M?: number; // Point moment magnitude (kN·m)
  a?: number; // Distance from start node (m or as ratio 0-1)
  // Direction: 'local_y' is perpendicular to member, 'global_y' is vertical
  direction:
    | "local_y"
    | "local_z"
    | "global_x"
    | "global_y"
    | "global_z"
    | "axial";
  // Start and end positions for partial loads (0-1 as ratio of length)
  startPos?: number; // Default 0
  endPos?: number; // Default 1
}

// Load Cases & Combinations (industry standard feature)
export type LoadCaseType =
  | "dead"
  | "live"
  | "wind"
  | "seismic"
  | "snow"
  | "temperature"
  | "self_weight"
  | "custom";

export interface LoadCase {
  id: string;
  name: string;
  type: LoadCaseType;
  loads: NodeLoad[];
  memberLoads: MemberLoad[];
  selfWeight?: boolean; // Auto-compute self-weight for this case
  factor?: number; // Scale factor (default 1.0)
}

export interface LoadCombination {
  id: string;
  name: string;
  code?: string; // Design code reference (e.g., 'IS 875', 'ASCE 7', 'ASCE 7-22')
  factors: { loadCaseId: string; factor: number }[];
}

// Floor / Area Load (distributed to beams via yield-line method at analysis time)
export interface FloorLoad {
  id: string;
  pressure: number; // Load intensity (kN/m²) — negative = downward
  yLevel: number; // Floor Y coordinate (m)
  xMin: number; // Bounding box min X (-Infinity for all)
  xMax: number;
  zMin: number;
  zMax: number;
  distributionOverride?:
    | "one_way"
    | "two_way_triangular"
    | "two_way_trapezoidal";
  loadCase?: string;
}

export type SectionType =
  | "I-BEAM"
  | "TUBE"
  | "L-ANGLE"
  | "RECTANGLE"
  | "CIRCLE"
  | "C-CHANNEL"
  | "T-SECTION"
  | "DOUBLE-ANGLE"
  | "PIPE"
  | "TAPERED"
  | "BUILT-UP";

export interface SectionDimensions {
  // I-BEAM dimensions
  height?: number;
  width?: number;
  webThickness?: number;
  flangeThickness?: number;

  // TUBE/BOX dimensions
  outerWidth?: number;
  outerHeight?: number;
  thickness?: number;

  // L-ANGLE dimensions
  legWidth?: number;
  legHeight?: number;

  // RECTANGLE/PLATE dimensions
  rectWidth?: number;
  rectHeight?: number;

  // CIRCLE/CABLE dimensions
  diameter?: number;

  // C-CHANNEL dimensions
  channelHeight?: number;
  channelWidth?: number;
  channelThickness?: number;

  // T-SECTION dimensions
  tFlangeWidth?: number;
  tFlangeThickness?: number;
  tStemHeight?: number;
  tStemThickness?: number;

  // DOUBLE-ANGLE dimensions
  daLegWidth?: number;
  daLegHeight?: number;
  daThickness?: number;
  daGap?: number; // gap between angles (mm)

  // PIPE dimensions (circular hollow)
  pipeOuterDiameter?: number;
  pipeWallThickness?: number;

  // TAPERED section (haunched beams)
  startDepth?: number;
  endDepth?: number;
  taperFlangeWidth?: number;
  taperWebThickness?: number;
  taperFlangeThickness?: number;

  // BUILT-UP composite section
  builtUpType?: "plate_girder" | "box_girder" | "compound";
  builtUpWebHeight?: number;
  builtUpWebThickness?: number;
  builtUpTopFlangeWidth?: number;
  builtUpTopFlangeThickness?: number;
  builtUpBotFlangeWidth?: number;
  builtUpBotFlangeThickness?: number;
}

export interface Member {
  id: string;
  startNodeId: string;
  endNodeId: string;
  sectionId?: string; // Made optional with default 'Default'

  // Section geometry for 3D rendering
  sectionType?: SectionType;
  dimensions?: SectionDimensions;

  // Default properties for analysis
  E?: number; // Young's Modulus (kN/m²)
  A?: number; // Cross-sectional Area (m²)
  I?: number; // Moment of Inertia (m⁴)
  Iy?: number; // Moment of inertia about local y-axis (m⁴)
  Iz?: number; // Moment of inertia about local z-axis (m⁴)
  J?: number; // Torsion constant (m⁴)
  G?: number; // Shear Modulus (kN/m²)
  rho?: number; // Material density (kg/m³), default 7850 for steel
  // Member releases (hinges) - full 3D releases for all 6 DOFs at each end
  releases?: {
    startMoment?: boolean; // Legacy: Release moment at start
    endMoment?: boolean; // Legacy: Release moment at end
    // Full 3D releases
    fxStart?: boolean;
    fyStart?: boolean;
    fzStart?: boolean;
    mxStart?: boolean;
    myStart?: boolean;
    mzStart?: boolean;
    fxEnd?: boolean;
    fyEnd?: boolean;
    fzEnd?: boolean;
    mxEnd?: boolean;
    myEnd?: boolean;
    mzEnd?: boolean;
  };
  // Rigid zone offsets (for beam-column connections)
  startOffset?: { x: number; y: number; z: number };

  endOffset?: { x: number; y: number; z: number };
  betaAngle?: number; // Rotation angle in degrees
}

// Plate/Shell element (quadrilateral)
export interface Plate {
  id: string;
  nodeIds: [string, string, string, string]; // 4 corner nodes (CCW order)
  thickness: number; // Plate thickness (m)
  E?: number; // Young's Modulus (kN/m²), default 200e6 for steel
  nu?: number; // Poisson's ratio, default 0.3
  pressure?: number; // Applied pressure (kN/m²), positive = downward
  materialType?: "steel" | "concrete" | "custom";
}

// Member Force Results with diagram data
export interface MemberForceData {
  // Primary values (typically start-end values; kept for backward compat)
  axial: number;
  shearY: number;
  shearZ: number;
  momentY: number;
  momentZ: number;
  torsion: number;
  // Start / end forces (preserves full information from solver)
  startForces?: {
    axial: number;
    shearY: number;
    shearZ?: number;
    momentY?: number;
    momentZ: number;
    torsion?: number;
  };
  endForces?: {
    axial: number;
    shearY: number;
    shearZ?: number;
    momentY?: number;
    momentZ: number;
    torsion?: number;
  };
  // Diagram data arrays for visualization (SFD, BMD, deflection)
  diagramData?: {
    x_values: number[];
    shear_y: number[];
    shear_z: number[];
    moment_y: number[];
    moment_z: number[];
    axial: number[];
    torsion: number[];
    deflection_y: number[];
    deflection_z: number[];
  };
}

// Analysis Results
export interface AnalysisResults {
  displacements: Map<
    string,
    { dx: number; dy: number; dz: number; rx: number; ry: number; rz: number }
  >;
  reactions: Map<
    string,
    { fx: number; fy: number; fz: number; mx: number; my: number; mz: number }
  >;
  memberForces: Map<string, MemberForceData>;
  // Plate/shell element results (optional)
  plateResults?: Record<
    string,
    {
      stress_xx?: number;
      stress_yy?: number;
      stress_xy?: number;
      stress_x?: number;
      stress_y?: number;
      moment_xx?: number;
      moment_yy?: number;
      moment_xy?: number;
      displacement?: number;
      von_mises?: number;
    }
  >;
  // Industry-standard equilibrium verification
  equilibriumCheck?: {
    applied_forces: number[]; // [Fx, Fy, Fz, Mx, My, Mz] in N/N·m
    reaction_forces: number[]; // [Fx, Fy, Fz, Mx, My, Mz] in N/N·m
    residual: number[]; // should be ~0
    error_percent: number; // < 0.1% is acceptable
    pass: boolean;
  };
  // Condition number estimate for numerical quality
  conditionNumber?: number;
  stats?: {
    solveTimeMs: number;
    assemblyTimeMs?: number;
    totalTimeMs?: number;
    method?: string;
    usedCloud?: boolean;
    fallbackFromLocal?: boolean;
  };
}

// Modal Analysis Results
export interface ModeShape {
  modeNumber: number;
  frequency: number; // Hz
  period: number; // seconds
  angularFrequency: number; // rad/s
  shape: Map<string, number[]>; // nodeId -> [dx, dy, dz, rx, ry, rz]
}

export interface ModalResult {
  modes: ModeShape[];
  totalMass: number;
}

// Civil Engineering Data (Results/State)
export interface CivilResult {
  id: string;
  moduleId:
    | "geotech"
    | "transport"
    | "hydraulics"
    | "enviro"
    | "const"
    | "survey";
  type: string; // e.g. 'footing', 'curve'
  timestamp: number;
  input: any;
  output: any;
  linkedElementIds?: string[]; // IDs of 3D elements generated (e.g. Plate P1)
}

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
  diagramScale: number; // Scale factor for diagrams
  showResults: boolean; // Results Table visibility

  // Modal Analysis / Dynamics
  modalResults: ModalResult | null;
  activeModeIndex: number; // Which mode to visualize (0-based)
  modeAmplitude: number; // Amplitude scale for mode shape animation
  isAnimating: boolean; // Play/pause animation

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
  setDiagramScale: (scale: number) => void;
  setShowResults: (show: boolean) => void;

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
  updateNodes: (updates: Map<string, Partial<Node>>) => void; // Batch update nodes
  updateMembers: (updates: Map<string, Partial<Member>>) => void; // Batch update members
  splitMemberById: (memberId: string, ratio: number) => void; // Insert node in member
  mergeNodes: (nodeId1: string, nodeId2: string) => void; // Merge two nodes
  renumberNodes: () => void; // Renumber all nodes from N1
  renumberMembers: () => void; // Renumber all members from M1

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
    console.error("Invalid project data structure");
    return null;
  }

  // Restore nodes — support both tuple [id, node] and object { nodeId, ...node } formats
  const nodesMap = new Map<string, Node>();
  data.nodes.forEach((entry: any) => {
    let id: string;
    let node: any;
    if (Array.isArray(entry) && entry.length >= 2) {
      [id, node] = entry;
    } else if (entry && typeof entry === "object" && entry.nodeId) {
      const { nodeId, ...rest } = entry;
      id = nodeId;
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
      nodesMap.set(id, node);
    }
  });

  // Restore members — support both tuple [id, member] and object { memberId, ...member } formats
  const membersMap = new Map<string, Member>();
  data.members.forEach((entry: any) => {
    let id: string;
    let member: any;
    if (Array.isArray(entry) && entry.length >= 2) {
      [id, member] = entry;
    } else if (entry && typeof entry === "object" && entry.memberId) {
      const { memberId, ...rest } = entry;
      id = memberId;
      member = rest;
    } else {
      return; // skip malformed entry
    }
    if (id && member && member.startNodeId && member.endNodeId) {
      membersMap.set(id, member);
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
    console.warn("No valid nodes loaded from project data");
  }

  // Restore loads
  const loads = Array.isArray(data.loads) ? data.loads : [];
  const memberLoads = Array.isArray(data.memberLoads) ? data.memberLoads : [];
  const loadCases = Array.isArray((data as any).loadCases) ? (data as any).loadCases : [];
  const loadCombinations = Array.isArray((data as any).loadCombinations) ? (data as any).loadCombinations : [];
  const floorLoads = Array.isArray((data as any).floorLoads) ? (data as any).floorLoads : [];

  // Restore plates (may be tuples [id, plate] or objects with .id)
  const platesMap = new Map<string, Plate>();
  if (Array.isArray((data as any).plates)) {
    (data as any).plates.forEach((entry: any) => {
      if (Array.isArray(entry) && entry.length >= 2) {
        platesMap.set(entry[0], entry[1]);
      } else if (entry && typeof entry === 'object' && entry.id) {
        platesMap.set(entry.id, entry);
      }
    });
  }

  return {
    nodes: nodesMap,
    members: membersMap,
    loads,
    memberLoads,
    loadCases,
    loadCombinations,
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
    diagramScale: 0.05,
    showResults: false,
    modalResults: null,
    activeModeIndex: 0,
    modeAmplitude: 1.0,
    isAnimating: false,
  };
}

export const useModelStore = create<ModelState>()(
  devtools(
    temporal(
      (set, get) => ({
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
        setDiagramScale: (scale) => set({ diagramScale: scale }),
        setShowResults: (show) => set({ showResults: show }),

        // Modal Analysis Actions
        setModalResults: (results) => set({ modalResults: results }),
        setActiveModeIndex: (index) => set({ activeModeIndex: index }),
        setModeAmplitude: (amplitude) => set({ modeAmplitude: amplitude }),
        setIsAnimating: (animating) => set({ isAnimating: animating }),

        // Model Management
        clearModel: () =>
          set({
            nodes: new Map(),
            members: new Map(),
            plates: new Map(),
            loads: [],
            memberLoads: [],
            floorLoads: [],
            loadCases: [],
            loadCombinations: [],
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
          }),

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
              // Apply default material properties
              membersMap.set(member.id, {
                ...member,
                E: member.E ?? 200e6,
                A: member.A ?? 0.01,
                I: member.I ?? 1e-4,
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
            console.error("Error loading project:", error);
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
                E: member.E ?? 200e6,
                A: member.A ?? 0.01,
                I: member.I ?? 1e-4,
              });
            });
            return { members: newMembers };
          }),

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
      { limit: 25 }, // Limit undo history — each snapshot holds full model state
    ),
    {
      name: "StructuralModel",
      // Optional: Serializer for better Map visibility in Redux DevTools
      serialize: {
        options: {
          map: true, // Modern DevTools might handle Maps, otherwise custom logic needed
        },
      },
    },
  ),
);

// ============================================
// LOCAL STORAGE PERSISTENCE
// ============================================

const STORAGE_KEY = "beamlab_project";

export interface SavedProjectData {
  projectInfo: ProjectInfo;
  nodes: [string, Node][];
  members: [string, Member][];
  loads: NodeLoad[];
  memberLoads: MemberLoad[];
  loadCases?: LoadCase[];
  loadCombinations?: LoadCombination[];
  plates?: [string, Plate][];
  floorLoads?: FloorLoad[];
  savedAt: string;
}

/**
 * Save current project to localStorage
 */
export const saveProjectToStorage = (): boolean => {
  try {
    const state = useModelStore.getState();
    const projectData: SavedProjectData = {
      projectInfo: state.projectInfo,
      nodes: Array.from(state.nodes.entries()),
      members: Array.from(state.members.entries()),
      loads: state.loads || [],
      memberLoads: state.memberLoads || [],
      loadCases: state.loadCases || [],
      loadCombinations: state.loadCombinations || [],
      plates: Array.from(state.plates.entries()),
      floorLoads: state.floorLoads || [],
      savedAt: new Date().toISOString(),
    };

    // Validate data before saving
    if (projectData.nodes.length === 0) {
      console.warn("Attempting to save empty project");
    }

    const jsonString = JSON.stringify(projectData);

    // Check approximate size (localStorage typically 5-10MB limit)
    if (jsonString.length > 5 * 1024 * 1024) {
      console.error("Project too large to save locally");
      return false;
    }

    try {
      localStorage.setItem(STORAGE_KEY, jsonString);
    } catch (quotaError) {
      if (
        quotaError instanceof DOMException &&
        (quotaError as any).code === 22
      ) {
        console.error("localStorage quota exceeded - clear some projects");
        return false;
      }
      throw quotaError;
    }

    return true;
  } catch (e) {
    console.error("Failed to save project:", e);
    return false;
  }
};

/**
 * Load project from localStorage
 */
export const loadProjectFromStorage = (): boolean => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return false;

    // Validate JSON before parsing
    let data: SavedProjectData;
    try {
      data = JSON.parse(stored);
    } catch {
      console.error("Corrupted localStorage data, clearing...");
      localStorage.removeItem(STORAGE_KEY);
      return false;
    }

    const hydrated = hydrateProjectData(data);
    if (!hydrated) return false;

    useModelStore.setState(hydrated);
    return true;
  } catch (e) {
    console.error("Failed to load project:", e);
    return false;
  }
};

// ============================================================
// Analysis Results Session Persistence
// ============================================================
const ANALYSIS_SESSION_KEY = "beamlab_analysis_results";

/** Serialize Map → array-of-entries for JSON storage */
function serializeAnalysisMap<V>(map: Map<string, V> | undefined): [string, V][] | undefined {
  if (!map || map.size === 0) return undefined;
  return Array.from(map.entries());
}

/** Save analysis results to sessionStorage (survives SPA nav + soft refresh) */
function persistAnalysisResults(results: AnalysisResults | null): void {
  try {
    if (!results) {
      sessionStorage.removeItem(ANALYSIS_SESSION_KEY);
      return;
    }
    const serializable = {
      displacements: serializeAnalysisMap(results.displacements),
      reactions: serializeAnalysisMap(results.reactions),
      memberForces: serializeAnalysisMap(results.memberForces),
      plateResults: results.plateResults,
      equilibriumCheck: results.equilibriumCheck,
      conditionNumber: results.conditionNumber,
      stats: results.stats,
      completed: (results as any).completed,
      timestamp: (results as any).timestamp ?? Date.now(),
    };
    const json = JSON.stringify(serializable);
    // sessionStorage limit is ~5 MB; skip if too big
    if (json.length > 4.5 * 1024 * 1024) {
      console.warn("[BeamLab] Analysis results too large for sessionStorage, skipping persist");
      return;
    }
    sessionStorage.setItem(ANALYSIS_SESSION_KEY, json);
  } catch (e) {
    console.warn("[BeamLab] Could not persist analysis results:", e);
  }
}

/**
 * Restore analysis results from sessionStorage.
 * Called by pages that need results (e.g. Design Hub) when the
 * in-memory store is empty (page was refreshed / hard-navigated).
 */
export function hydrateAnalysisResults(): AnalysisResults | null {
  try {
    const raw = sessionStorage.getItem(ANALYSIS_SESSION_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    const results: AnalysisResults = {
      displacements: new Map(data.displacements ?? []),
      reactions: new Map(data.reactions ?? []),
      memberForces: new Map(data.memberForces ?? []),
      plateResults: data.plateResults,
      equilibriumCheck: data.equilibriumCheck,
      conditionNumber: data.conditionNumber,
      stats: data.stats,
    };
    if ((data as any).completed !== undefined) {
      (results as any).completed = data.completed;
    }
    if ((data as any).timestamp !== undefined) {
      (results as any).timestamp = data.timestamp;
    }
    return results;
  } catch (e) {
    console.warn("[BeamLab] Could not restore analysis results:", e);
    return null;
  }
}

/**
 * Check if a saved project exists
 */
export const hasSavedProject = (): boolean => {
  return localStorage.getItem(STORAGE_KEY) !== null;
};

/**
 * Get saved project metadata without loading it
 */
export const getSavedProjectInfo = (): {
  name: string;
  savedAt: string;
} | null => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return null;

    const data: SavedProjectData = JSON.parse(stored);
    return {
      name: data.projectInfo.name,
      savedAt: data.savedAt,
    };
  } catch {
    return null;
  }
};

/**
 * Clear saved project from localStorage
 */
export const clearSavedProject = (): void => {
  localStorage.removeItem(STORAGE_KEY);
};

// ============================================
// AUTO-SAVE (debounced subscription)
// ============================================

const AUTO_SAVE_DELAY_MS = 2000; // 2 seconds after last change

let autoSaveTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Subscribe to store changes and auto-save to localStorage.
 * Only saves when structural data (nodes, members, loads) changes.
 */
useModelStore.subscribe(
  (state, prevState) => {
    // Only auto-save when structural data changes (not UI state or analysis results)
    const structuralChanged =
      state.nodes !== prevState.nodes ||
      state.members !== prevState.members ||
      state.loads !== prevState.loads ||
      state.memberLoads !== prevState.memberLoads ||
      state.projectInfo !== prevState.projectInfo;

    if (!structuralChanged) return;

    // Debounce: clear previous timer and set a new one
    if (autoSaveTimer) clearTimeout(autoSaveTimer);
    autoSaveTimer = setTimeout(() => {
      try {
        saveProjectToStorage();
      } catch {
        // Silently fail — user can still manually save
      }
    }, AUTO_SAVE_DELAY_MS);
  }
);
