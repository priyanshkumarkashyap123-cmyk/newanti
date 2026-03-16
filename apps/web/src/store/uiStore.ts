/**
 * uiStore.ts - Umbrella State Manager
 *
 * Manages the workflow state with category-based transitions.
 * Implements "One-by-One" logic for safe category switching.
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";

// ============================================
// TYPES
// ============================================

/**
 * The seven main workflow categories (Umbrellas)
 * Ordered to match the STAAD Pro workflow: Modeling → Properties → Supports → Loading → Analysis → Design → Civil
 */
export type Category =
  | "MODELING"
  | "PROPERTIES"
  | "SUPPORTS"
  | "LOADING"
  | "ANALYSIS"
  | "DESIGN"
  | "CIVIL";

/** Ordered list of categories for workflow enforcement */
const CATEGORY_ORDER: Category[] = [
  "MODELING", "PROPERTIES", "SUPPORTS", "LOADING", "ANALYSIS", "DESIGN", "CIVIL"
];

/** Workflow completion state — tracks which stages have been touched/completed */
export interface WorkflowCompletion {
  MODELING: boolean;
  PROPERTIES: boolean;
  SUPPORTS: boolean;
  LOADING: boolean;
  ANALYSIS: boolean;
  DESIGN: boolean;
  CIVIL: boolean;
}

/**
 * Sidebar display modes
 */
export type SidebarMode = "EXPANDED" | "COLLAPSED" | "HIDDEN";

export type GeometryToolPreset =
  | "extrude"
  | "rotate"
  | "mirror"
  | "split"
  | "renumber";

/**
 * Analysis status interface (UI state, not full results — see modelTypes.AnalysisResults)
 */
export interface AnalysisStatus {
  completed: boolean;
  timestamp?: number;
  type?: string;
  data?: Record<string, unknown>;
}

/**
 * Validation result interface
 */
export interface ValidationResult {
  isValid: boolean;
  errors?: string[];
  warnings?: string[];
  message?: string;
}

// ... (existing code)

export const CATEGORY_TOOLS: Record<Category, string[]> = {
  MODELING: [
    // Selection & View
    "SELECT",
    "SELECT_RANGE",
    "PAN",
    "ZOOM_WINDOW",
    // Draw - Basic
    "DRAW_NODE",
    "DRAW_BEAM",
    "DRAW_COLUMN",
    // Draw - Advanced
    "DRAW_CABLE",
    "DRAW_ARCH",
    "DRAW_RIGID_LINK",
    "DRAW_PLATE",
    // Edit
    "COPY",
    "MIRROR",
    "DELETE",
    "DIVIDE_MEMBER",
    "MERGE_NODES",
    "ALIGN_NODES",
    "SPLIT_MEMBER",
    // Array
    "ARRAY_LINEAR",
    "ARRAY_POLAR",
    "ARRAY_3D",
    // Transform
    "MOVE",
    "ROTATE",
    "SCALE",
    "OFFSET_MEMBER",
    "EXTRUDE",
    // Generators
    "GRID_GENERATE",
    "GRID_3D",
    "CIRCULAR_GRID",
    "TRUSS_GENERATOR",
    "ARCH_GENERATOR",
    "PIER_GENERATOR",
    "TOWER_GENERATOR",
    "DECK_GENERATOR",
    "CABLE_PATTERN",
    "FRAME_GENERATOR",
    "STAIRCASE_GENERATOR",
    // Measure
    "MEASURE_DISTANCE",
    "MEASURE_ANGLE",
    "MEASURE_AREA",
    // Import
    "IMPORT_DXF",
    "IMPORT_IFC",
  ],
  PROPERTIES: [
    "ASSIGN_SECTION",
    "ASSIGN_MATERIAL",
    "ASSIGN_RELEASE",
    "ASSIGN_OFFSET",
    // Advanced property tools
    "ASSIGN_CABLE_PROPS",
    "ASSIGN_SPRING",
    "ASSIGN_MASS",
    "MEMBER_ORIENTATION",
    "ASSIGN_RIGID",
    "ASSIGN_HINGE",
    // Section tools
    "SECTION_BUILDER",
    "IMPORT_SECTION",
    // Plate & composite
    "PLATE_THICKNESS",
    "TAPERED_SECTION",
    "COMPOSITE_SECTION",
  ],
  SUPPORTS: [
    // Standard supports
    "ASSIGN_FIXED",
    "ASSIGN_PINNED",
    "ASSIGN_ROLLER",
    // Custom
    "ASSIGN_CUSTOM_SUPPORT",
    "ASSIGN_FIXED_WITH_RELEASES",
    "ASSIGN_INCLINED",
    // Spring supports
    "ASSIGN_SPRING_TRANS",
    "ASSIGN_SPRING_ROT",
    "ASSIGN_MULTILINEAR_SPRING",
    // Foundation
    "ASSIGN_ELASTIC_FOUNDATION",
    // Batch
    "ASSIGN_SUPPORT_BATCH",
  ],
  LOADING: [
    "ADD_POINT_LOAD",
    "ADD_MOMENT",
    "ADD_UDL",
    "ADD_TRAPEZOID",
    "ADD_WIND",
    "ADD_SEISMIC",
    "LOAD_COMBINATIONS",
    // Extended loading tools
    "ADD_PRETENSION",
    "ADD_TEMPERATURE",
    "ADD_MOVING_LOAD",
    "ADD_HYDROSTATIC",
    "ADD_SELF_WEIGHT",
    "ADD_SETTLEMENT",
    "ADD_PRESSURE",
    "ADD_CENTRIFUGAL",
    "ADD_SNOW_LOAD",
    // Load management
    "LOAD_PATTERN",
    "ENVELOPE",
    "REFERENCE_LOAD",
    "NOTIONAL_LOAD",
    "LOAD_MANAGER",
  ],
  ANALYSIS: [
    "RUN_ANALYSIS",
    "VIEW_DEFORMED",
    "VIEW_REACTIONS",
    "VIEW_SFD",
    "VIEW_BMD",
    "VIEW_DIAGRAMS",
    // Advanced analysis
    "MODAL_ANALYSIS",
    "BUCKLING_ANALYSIS",
    "P_DELTA",
    "PUSHOVER",
    "TIME_HISTORY",
    "RESPONSE_SPECTRUM",
    // Additional analysis
    "CABLE_ANALYSIS",
    "STRESS_CONTOUR",
    "STEADY_STATE",
  ],
  DESIGN: [
    "STEEL_CHECK",
    "CONCRETE_DESIGN",
    "CONNECTION_DESIGN",
    "FOUNDATION_DESIGN",
    "GENERATE_REPORT",
    // Additional design tools
    "TIMBER_DESIGN",
    "COMPOSITE_DESIGN",
    "SEISMIC_DETAIL",
    "CROSS_SECTION_CHECK",
    "DEFLECTION_CHECK",
    "ALUMINUM_DESIGN",
  ],
  CIVIL: [
    "GEOTECH_CALC",
    "FOUNDATION_ANALYSIS",
    "SLOPE_STABILITY",
    "TRANS_GEOMETRIC",
    "PAVEMENT_DESIGN",
    "TRAFFIC_ANALYSIS",
    "HYDRAULICS_CHANNEL",
    "HYDRAULICS_PIPE",
    "CULVERT_DESIGN",
    "ENV_WTP",
    "ENV_STP",
    "ENV_AQI",
    "CONST_SCHEDULE",
    "COST_ESTIMATE",
    "SURVEY_TRAVERSE",
    "SURVEY_VOLUME",
  ],
};

// ============================================
// STATE INTERFACE
// ============================================

interface UIState {
  // Core State
  activeCategory: Category;
  activeStep: string; // Fine-grained step ID (e.g. "PROPERTIES" vs "MATERIALS")
  sidebarMode: SidebarMode;
  activeTool: string | null;

  // Workflow completion tracking
  workflowCompletion: WorkflowCompletion;
  markWorkflowComplete: (stage: Category) => void;
  getWorkflowCompletion: () => WorkflowCompletion;

  // Analysis state (to track if analysis has been run)
  analysisResults: AnalysisStatus | null;

  // Validation state
  lastValidation: ValidationResult | null;

  // Notification state
  notification: {
    show: boolean;
    type: "info" | "warning" | "error" | "success";
    message: string;
  } | null;

  // Panel states
  propertiesPanelOpen: boolean;
  dataPanelOpen: boolean;

  modals: {
    structureWizard: boolean;
    structureGallery: boolean;
    geometryTools: boolean;
    interoperability: boolean;
    foundationDesign: boolean;
    is875Load: boolean;
    railwayBridge: boolean;
    meshing: boolean;
    loadDialog: boolean;
    windLoadDialog: boolean;
    seismicLoadDialog: boolean;
    movingLoadDialog: boolean;
    boundaryConditionsDialog: boolean;
    plateDialog: boolean;
    floorSlabDialog: boolean;
    // ASCE 7 Load Generation
    asce7SeismicDialog: boolean;
    asce7WindDialog: boolean;
    loadCombinationsDialog: boolean;
    // Indian Code Load Generation
    is1893SeismicDialog: boolean;
    // Section Browser
    sectionBrowserDialog: boolean;
    // Advanced Analysis & Design dialogs
    advancedAnalysis: boolean;
    designCodes: boolean;
    connectionDesign: boolean;
    steelDesign: boolean;
    concreteDesign: boolean;
    pDeltaAnalysis: boolean;
    modalAnalysis: boolean;
    bucklingAnalysis: boolean;
    selectionToolbar: boolean;
    deadLoadGenerator: boolean;
    curvedStructure: boolean;
    detailedDesign: boolean;
    civilEngineering: boolean;
    generativeDesign: boolean;
    seismicStudio: boolean;
    // Properties tab distinct modals
    sectionAssign: boolean;
    sectionBuilder: boolean;
    materialLibrary: boolean;
    materialAssign: boolean;
    materialProperties: boolean;
    betaAngle: boolean;
    memberReleases: boolean;
    memberOffsets: boolean;
    // Editing & Load dialogs
    temperatureLoad: boolean;
    divideMember: boolean;
    mergeNodes: boolean;
    // Advanced dynamic analysis
    timeHistoryAnalysis: boolean;
    // Structure generators
    trussGenerator: boolean;
    archGenerator: boolean;
    frameGenerator: boolean;
    cablePatternGenerator: boolean;
    // Enhanced Loading modals
    supportDisplacement: boolean;
    prestressLoad: boolean;
    pressureLoad: boolean;
    en1998SeismicDialog: boolean;
    is875LiveLoad: boolean;
    nonlinearAnalysis: boolean;
    // Enhanced Design modals
    steelDesignIS800: boolean;
    steelDesignAISC360: boolean;
    rcBeamDesign: boolean;
    rcColumnDesign: boolean;
    rcSlabDesign: boolean;
    rcFootingDesign: boolean;
    rcDetailing: boolean;
    steelDetailing: boolean;
    sectionOptimization: boolean;
    designHub: boolean;
    // Load type-specific dialogs
    momentLoadDialog: boolean;
    trapezoidalLoadDialog: boolean;
    pointLoadDialog: boolean;
    memberLoadDialog: boolean;
    // Civil engineering sub-domain dialogs
    geotechnicalDesign: boolean;
    hydraulicsDesign: boolean;
    transportDesign: boolean;
    constructionMgmt: boolean;
    // ── NEW: Geometry – Generators, Arrays, Measurement, Import ──
    towerGenerator: boolean;
    staircaseGenerator: boolean;
    pierGenerator: boolean;
    deckGenerator: boolean;
    linearArrayDialog: boolean;
    polarArrayDialog: boolean;
    measureDistanceDialog: boolean;
    measureAngleDialog: boolean;
    measureAreaDialog: boolean;
    importDxfDialog: boolean;
    importIfcDialog: boolean;
    // ── NEW: Properties – Missing property types ──
    plateThicknessDialog: boolean;
    taperedSectionDialog: boolean;
    compositeSectionDialog: boolean;
    importSectionTableDialog: boolean;
    cablePropsDialog: boolean;
    springConstantsDialog: boolean;
    lumpedMassDialog: boolean;
    memberHingesDialog: boolean;
    // ── NEW: Supports tab modals ──
    fixedSupportDialog: boolean;
    pinnedSupportDialog: boolean;
    rollerSupportDialog: boolean;
    customSupportDialog: boolean;
    fixedWithReleasesDialog: boolean;
    inclinedSupportDialog: boolean;
    translationalSpringDialog: boolean;
    rotationalSpringDialog: boolean;
    multilinearSpringDialog: boolean;
    elasticFoundationDialog: boolean;
    batchSupportAssignDialog: boolean;
    // ── NEW: Loading – Missing load types ──
    snowLoadDialog: boolean;
    referenceLoadsDialog: boolean;
    loadEnvelopesDialog: boolean;
    notionalLoadsDialog: boolean;
    loadCaseManagerDialog: boolean;
    // ── NEW: Analysis – Additional types ──
    cableAnalysisDialog: boolean;
    stressContourDialog: boolean;
    steadyStateDialog: boolean;
    // ── NEW: Design – Additional types ──
    timberDesignDialog: boolean;
    compositeDesignDialog: boolean;
    aluminumDesignDialog: boolean;
  };

  // Graphics State
  useWebGpu: boolean;
  setUseWebGpu: (val: boolean) => void;
  renderMode3D: boolean; // Toggle for solid 3D beam cross-sections
  setRenderMode3D: (val: boolean) => void;
  viewMode: '2D' | '3D'; // Default view mode
  setViewMode: (mode: '2D' | '3D') => void;

  // Display units & preset selectors
  unitSystem: 'kN_m' | 'kN_mm' | 'N_mm' | 'kip_ft' | 'lb_in';
  setUnitSystem: (u: UIState['unitSystem']) => void;
  designCodePreset: string | null; // e.g. 'IS800', 'AISC360' — consumed by design dialogs to pre-select tab
  setDesignCodePreset: (p: string | null) => void;
  designTabPreset: string | null;  // e.g. 'beam', 'column', 'slab' — consumed by concrete design dialog
  setDesignTabPreset: (p: string | null) => void;
  geometryToolPreset: GeometryToolPreset | null;
  setGeometryToolPreset: (p: GeometryToolPreset | null) => void;

  // Onboarding coordination — only one overlay at a time
  activeOverlay: 'none' | 'onboarding' | 'tour' | 'quickstart';
  setActiveOverlay: (overlay: UIState['activeOverlay']) => void;
  onboardingCompleted: boolean;
  markOnboardingCompleted: () => void;

  // Actions
  setCategory: (cat: Category) => void;
  setActiveStep: (step: string) => void;
  setActiveTool: (tool: string | null) => void;
  setSidebarMode: (mode: SidebarMode) => void;
  toggleSidebar: () => void;

  // Analysis actions
  setAnalysisResults: (results: AnalysisStatus | null) => void;
  clearAnalysisResults: () => void;

  // Notification actions
  showNotification: (
    type: "info" | "warning" | "error" | "success",
    message: string,
  ) => void;
  hideNotification: () => void;

  // Panel actions
  togglePropertiesPanel: () => void;
  toggleDataPanel: () => void;

  // Modal actions
  openModal: (modal: keyof UIState["modals"]) => void;
  closeModal: (modal: keyof UIState["modals"]) => void;
  toggleModal: (modal: keyof UIState["modals"]) => void;
  setModal: (modal: keyof UIState["modals"], isOpen: boolean) => void;

  // Grid Settings
  showGrid: boolean;
  snapToGrid: boolean;
  gridSize: number;
  setGridSize: (size: number) => void;
  toggleGrid: () => void;
  toggleSnap: () => void;

  // Validation
  validateModel: () => ValidationResult;

  // Reset
  resetToDefaults: () => void;
}

// ============================================
// VALIDATION HELPERS
// ============================================

/**
 * Lazy-import model store to avoid top-level circular dependency.
 * This helper defers the store reference to runtime (first call) so the module
 * graph resolves cleanly while still allowing cross-store validation.
 * Uses dynamic property access instead of require() for Vite/ESM compatibility.
 */
let _modelStoreRef: (() => { nodes: Map<string, unknown>; members: Map<string, unknown>; loads: unknown[]; memberLoads: unknown[]; floorLoads: unknown[] }) | null = null;

const getModelSnapshot = () => {
  if (!_modelStoreRef) {
    try {
      // Lazy-bind on first call — by this time model.ts is already loaded
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mod = (globalThis as any).__beamlab_model_store__;
      if (mod) {
        _modelStoreRef = () => mod.getState();
      } else {
        return null;
      }
    } catch {
      return null;
    }
  }
  return _modelStoreRef();
};

/**
 * Validate model has geometry (nodes + members) — used for Properties/Supports/Loading transitions
 */
const validateHasGeometry = (): ValidationResult => {
  const snap = getModelSnapshot();
  if (!snap) return { isValid: true, message: "Model validation passed", warnings: [] };
  const nodeCount = snap.nodes?.size ?? 0;
  const memberCount = snap.members?.size ?? 0;
  if (nodeCount === 0) {
    return { isValid: false, errors: ["No nodes defined"], message: "Please create at least one node before proceeding." };
  }
  if (memberCount === 0) {
    return { isValid: false, errors: ["No members defined"], message: "Please draw at least one beam/column member before proceeding.", warnings: [] };
  }
  return { isValid: true, message: "Geometry validated — nodes and members exist.", warnings: [] };
};

/**
 * Validate model has supports — at least one node has restraints
 */
const validateHasSupports = (): ValidationResult => {
  const snap = getModelSnapshot();
  if (!snap) return { isValid: true, message: "Supports check passed", warnings: [] };
  const nodes = snap.nodes;
  let hasSupportedNode = false;
  if (nodes && typeof nodes.forEach === 'function') {
    nodes.forEach((node: unknown) => {
      const n = node as { restraints?: { fx?: boolean; fy?: boolean; fz?: boolean } };
      if (n.restraints && (n.restraints.fx || n.restraints.fy || n.restraints.fz)) {
        hasSupportedNode = true;
      }
    });
  }
  if (!hasSupportedNode) {
    return { isValid: false, errors: ["No supports defined"], message: "Please assign at least one support (Fixed/Pinned/Roller) before applying loads.", warnings: [] };
  }
  return { isValid: true, message: "Supports validated.", warnings: [] };
};

/**
 * Validate model has loads
 */
const validateHasLoads = (): ValidationResult => {
  const snap = getModelSnapshot();
  if (!snap) return { isValid: true, message: "Load check passed", warnings: [] };
  const totalLoads = (snap.loads?.length ?? 0) + (snap.memberLoads?.length ?? 0) + (snap.floorLoads?.length ?? 0);
  if (totalLoads === 0) {
    return { isValid: false, errors: ["No loads defined"], message: "Please define at least one load case before running analysis.", warnings: [] };
  }
  return { isValid: true, message: "Loads validated.", warnings: [] };
};

/**
 * Check if nodes are properly connected (basic validation).
 */
const validateModelConnectivity = (): ValidationResult => {
  const geoResult = validateHasGeometry();
  if (!geoResult.isValid) return geoResult;
  return { isValid: true, message: "Model validation passed", warnings: [] };
};

// ============================================
// STORE CREATION
// ============================================

export const useUIStore = create<UIState>()(
  persist(
    (set, get) => ({
      // Initial State
      activeCategory: "MODELING",
      activeStep: "MODELING",
      sidebarMode: "EXPANDED",
      activeTool: "SELECT",
      workflowCompletion: {
        MODELING: false,
        PROPERTIES: false,
        SUPPORTS: false,
        LOADING: false,
        ANALYSIS: false,
        DESIGN: false,
        CIVIL: false,
      },
      markWorkflowComplete: (stage: Category) => set((state) => ({
        workflowCompletion: { ...state.workflowCompletion, [stage]: true },
      })),
      getWorkflowCompletion: () => get().workflowCompletion,
      analysisResults: null,
      lastValidation: null,
      notification: null,
      propertiesPanelOpen: true,
      dataPanelOpen: true,
      modals: {
        structureWizard: false,
        structureGallery: false,
        geometryTools: false,
        interoperability: false,
        foundationDesign: false,
        is875Load: false,
        railwayBridge: false,
        meshing: false,
        loadDialog: false,
        windLoadDialog: false,
        seismicLoadDialog: false,
        movingLoadDialog: false,
        boundaryConditionsDialog: false,
        plateDialog: false,
        floorSlabDialog: false,
        // ASCE 7 Load Generation
        asce7SeismicDialog: false,
        asce7WindDialog: false,
        loadCombinationsDialog: false,
        // Indian Code Load Generation
        is1893SeismicDialog: false,
        // Section Browser
        sectionBrowserDialog: false,
        // Advanced Analysis & Design dialogs
        advancedAnalysis: false,
        designCodes: false,
        connectionDesign: false,
        steelDesign: false,
        concreteDesign: false,
        pDeltaAnalysis: false,
        modalAnalysis: false,
        bucklingAnalysis: false,
        selectionToolbar: false,
        deadLoadGenerator: false,
        curvedStructure: false,
        detailedDesign: false,
        civilEngineering: false,
        generativeDesign: false,
        seismicStudio: false,
        // Properties tab distinct modals
        sectionAssign: false,
        sectionBuilder: false,
        materialLibrary: false,
        materialAssign: false,
        materialProperties: false,
        betaAngle: false,
        memberReleases: false,
        memberOffsets: false,
        temperatureLoad: false,
        divideMember: false,
        mergeNodes: false,
        timeHistoryAnalysis: false,
        // Structure generators
        trussGenerator: false,
        archGenerator: false,
        frameGenerator: false,
        cablePatternGenerator: false,
        // Enhanced Loading modals
        supportDisplacement: false,
        prestressLoad: false,
        pressureLoad: false,
        en1998SeismicDialog: false,
        is875LiveLoad: false,
        nonlinearAnalysis: false,
        // Enhanced Design modals
        steelDesignIS800: false,
        steelDesignAISC360: false,
        rcBeamDesign: false,
        rcColumnDesign: false,
        rcSlabDesign: false,
        rcFootingDesign: false,
        rcDetailing: false,
        steelDetailing: false,
        sectionOptimization: false,
        designHub: false,
        // Load type-specific dialogs
        momentLoadDialog: false,
        trapezoidalLoadDialog: false,
        pointLoadDialog: false,
        memberLoadDialog: false,
        // Civil engineering sub-domain dialogs
        geotechnicalDesign: false,
        hydraulicsDesign: false,
        transportDesign: false,
        constructionMgmt: false,
        // ── NEW: Geometry – Generators, Arrays, Measurement, Import ──
        towerGenerator: false,
        staircaseGenerator: false,
        pierGenerator: false,
        deckGenerator: false,
        linearArrayDialog: false,
        polarArrayDialog: false,
        measureDistanceDialog: false,
        measureAngleDialog: false,
        measureAreaDialog: false,
        importDxfDialog: false,
        importIfcDialog: false,
        // ── NEW: Properties – Missing property types ──
        plateThicknessDialog: false,
        taperedSectionDialog: false,
        compositeSectionDialog: false,
        importSectionTableDialog: false,
        cablePropsDialog: false,
        springConstantsDialog: false,
        lumpedMassDialog: false,
        memberHingesDialog: false,
        // ── NEW: Supports tab modals ──
        fixedSupportDialog: false,
        pinnedSupportDialog: false,
        rollerSupportDialog: false,
        customSupportDialog: false,
        fixedWithReleasesDialog: false,
        inclinedSupportDialog: false,
        translationalSpringDialog: false,
        rotationalSpringDialog: false,
        multilinearSpringDialog: false,
        elasticFoundationDialog: false,
        batchSupportAssignDialog: false,
        // ── NEW: Loading – Missing load types ──
        snowLoadDialog: false,
        referenceLoadsDialog: false,
        loadEnvelopesDialog: false,
        notionalLoadsDialog: false,
        loadCaseManagerDialog: false,
        // ── NEW: Analysis – Additional types ──
        cableAnalysisDialog: false,
        stressContourDialog: false,
        steadyStateDialog: false,
        // ── NEW: Design – Additional types ──
        timberDesignDialog: false,
        compositeDesignDialog: false,
        aluminumDesignDialog: false,
      },

      // Graphics State
      useWebGpu: false,
      setUseWebGpu: (val) => set({ useWebGpu: val }),
      renderMode3D: false, // Default to wireframe for performance
      setRenderMode3D: (val) => set({ renderMode3D: val }),
      viewMode: '3D' as '2D' | '3D', // Default to 3D for immediate visual feedback
      setViewMode: (mode) => set({ viewMode: mode }),

      // Display units & preset selectors
      unitSystem: 'kN_m' as UIState['unitSystem'],
      setUnitSystem: (u) => set({ unitSystem: u }),
      designCodePreset: null as string | null,
      setDesignCodePreset: (p) => set({ designCodePreset: p }),
      designTabPreset: null as string | null,
      setDesignTabPreset: (p) => set({ designTabPreset: p }),
      geometryToolPreset: null as GeometryToolPreset | null,
      setGeometryToolPreset: (p) => set({ geometryToolPreset: p }),

      // ========================================
      // SET CATEGORY - THE "ONE-BY-ONE" LOGIC
      // ========================================
      setCategory: (cat: Category) => {
        const currentCategory = get().activeCategory;
        const analysisResults = get().analysisResults;

        // Don't do anything if same category
        if (currentCategory === cat) return;

        // ────────────────────────────────────────
        // Rule 0: Mark current category as completed (user has visited it)
        // ────────────────────────────────────────
        set((state) => ({
          workflowCompletion: { ...state.workflowCompletion, [currentCategory]: true },
        }));

        // ────────────────────────────────────────
        // Rule 1: When switching AWAY from MODELING
        // Automatically clear the active tool
        // ────────────────────────────────────────
        if (currentCategory === "MODELING") {
          set({ activeTool: null });
        }

        // ────────────────────────────────────────
        // Rule 2: When switching TO PROPERTIES
        // Warn if no nodes/members exist
        // ────────────────────────────────────────
        if (cat === "PROPERTIES") {
          const geoValidation = validateHasGeometry();
          if (!geoValidation.isValid) {
            set({
              lastValidation: geoValidation,
              notification: {
                show: true,
                type: "warning",
                message: geoValidation.message || "Please create geometry (nodes & members) first.",
              },
            });
            // Allow switching but warn
          }
        }

        // ────────────────────────────────────────
        // Rule 3: When switching TO SUPPORTS
        // Warn if no members have sections assigned
        // ────────────────────────────────────────
        if (cat === "SUPPORTS") {
          const geoValidation = validateHasGeometry();
          if (!geoValidation.isValid) {
            set({
              lastValidation: geoValidation,
              notification: {
                show: true,
                type: "warning",
                message: "Please create geometry and assign properties before defining supports.",
              },
            });
            // Allow switching but warn
          }
        }

        // ────────────────────────────────────────
        // Rule 4: When switching TO LOADING
        // Warn if no supports defined
        // ────────────────────────────────────────
        if (cat === "LOADING") {
          const supValidation = validateHasSupports();
          if (!supValidation.isValid) {
            set({
              lastValidation: supValidation,
              notification: {
                show: true,
                type: "warning",
                message: supValidation.message || "Please define supports before applying loads.",
              },
            });
            // Allow switching but warn
          }
        }

        // ────────────────────────────────────────
        // Rule 5: When switching TO ANALYSIS
        // Validate geometry + supports + loads
        // ────────────────────────────────────────
        if (cat === "ANALYSIS") {
          const geoValidation = validateHasGeometry();
          const supValidation = validateHasSupports();
          const loadValidation = validateHasLoads();

          const allWarnings: string[] = [];
          if (!geoValidation.isValid) allWarnings.push(geoValidation.message || "No geometry");
          if (!supValidation.isValid) allWarnings.push(supValidation.message || "No supports");
          if (!loadValidation.isValid) allWarnings.push(loadValidation.message || "No loads");

          if (allWarnings.length > 0) {
            set({
              lastValidation: { isValid: false, errors: allWarnings, message: allWarnings.join("\n"), warnings: [] },
              notification: {
                show: true,
                type: "warning",
                message: allWarnings[0], // Show first issue
              },
            });
            // Still allow switching, but show warnings
          }
        }

        // ────────────────────────────────────────
        // Rule 6: When switching TO DESIGN
        // Ensure analysis results exist
        // ────────────────────────────────────────
        if (cat === "DESIGN") {
          if (!analysisResults || !analysisResults.completed) {
            set({
              notification: {
                show: true,
                type: "error",
                message:
                  "Please Run Analysis First before accessing Design tools.",
              },
            });
            if (import.meta.env.DEV) console.warn(
              "[UIStore] Cannot switch to DESIGN - no analysis results",
            );
            // Block the category switch
            return;
          }
        }

        // ────────────────────────────────────────
        // Apply the category switch
        // ────────────────────────────────────────
        set({
          activeCategory: cat,
          // Set default tool for new category
          activeTool: CATEGORY_TOOLS[cat][0] || null,
        });
      },

      setActiveStep: (step: string) => set({ activeStep: step }),

      // ========================================
      // SET ACTIVE TOOL
      // ========================================
      setActiveTool: (tool: string | null) => {
        const category = get().activeCategory;

        if (tool === null) {
          set({ activeTool: null });
          return;
        }

        // Validate tool belongs to current category
        const validTools = CATEGORY_TOOLS[category];
        if (!validTools.includes(tool)) {
          if (import.meta.env.DEV) console.warn(
            `[UIStore] Tool "${tool}" is not valid for ${category} category`,
          );
          return;
        }

        set({ activeTool: tool });
      },

      // ========================================
      // SIDEBAR ACTIONS
      // ========================================
      setSidebarMode: (mode: SidebarMode) => set({ sidebarMode: mode }),

      toggleSidebar: () =>
        set((state) => ({
          sidebarMode:
            state.sidebarMode === "EXPANDED" ? "COLLAPSED" : "EXPANDED",
        })),

      // ========================================
      // ANALYSIS ACTIONS
      // ========================================
      setAnalysisResults: (results: AnalysisStatus | null) =>
        set({
          analysisResults: results,
        }),

      clearAnalysisResults: () => set({ analysisResults: null }),

      // ========================================
      // NOTIFICATION ACTIONS
      // ========================================
      showNotification: (type, message) =>
        set({
          notification: { show: true, type, message },
        }),

      hideNotification: () => set({ notification: null }),

      // ========================================
      // PANEL ACTIONS
      // ========================================
      togglePropertiesPanel: () =>
        set((state) => ({
          propertiesPanelOpen: !state.propertiesPanelOpen,
        })),

      toggleDataPanel: () =>
        set((state) => ({
          dataPanelOpen: !state.dataPanelOpen,
        })),

      // ========================================
      // MODAL ACTIONS
      // ========================================
      openModal: (modal) =>
        set((state) => ({
          modals: { ...state.modals, [modal]: true },
        })),

      closeModal: (modal) =>
        set((state) => ({
          modals: { ...state.modals, [modal]: false },
        })),

      toggleModal: (modal) =>
        set((state) => ({
          modals: { ...state.modals, [modal]: !state.modals[modal] },
        })),

      setModal: (modal, isOpen) =>
        set((state) => ({
          modals: { ...state.modals, [modal]: isOpen },
        })),

      // ========================================
      // VALIDATION
      // ========================================
      validateModel: () => {
        const result = validateModelConnectivity();
        set({ lastValidation: result });
        return result;
      },

      // ========================================
      // RESET
      // ========================================
      resetToDefaults: () =>
        set({
          activeCategory: "MODELING",
          activeStep: "MODELING",
          sidebarMode: "EXPANDED",
          activeTool: "SELECT",
          geometryToolPreset: null,
          workflowCompletion: { MODELING: false, PROPERTIES: false, SUPPORTS: false, LOADING: false, ANALYSIS: false, DESIGN: false, CIVIL: false },
          analysisResults: null,
          lastValidation: null,
          notification: null,
          propertiesPanelOpen: true,
          dataPanelOpen: true,
          modals: {
            structureWizard: false, structureGallery: false, geometryTools: false, interoperability: false,
            foundationDesign: false, is875Load: false, railwayBridge: false, meshing: false,
            loadDialog: false, windLoadDialog: false, seismicLoadDialog: false, movingLoadDialog: false,
            boundaryConditionsDialog: false, plateDialog: false, floorSlabDialog: false,
            asce7SeismicDialog: false, asce7WindDialog: false, loadCombinationsDialog: false,
            is1893SeismicDialog: false, sectionBrowserDialog: false,
            advancedAnalysis: false, designCodes: false, connectionDesign: false, steelDesign: false,
            concreteDesign: false, pDeltaAnalysis: false, modalAnalysis: false, bucklingAnalysis: false,
            selectionToolbar: false, deadLoadGenerator: false, curvedStructure: false, detailedDesign: false,
            civilEngineering: false, generativeDesign: false, seismicStudio: false,
            sectionAssign: false, sectionBuilder: false, materialLibrary: false,
            materialAssign: false, materialProperties: false,
            betaAngle: false, memberReleases: false, memberOffsets: false,
            temperatureLoad: false, divideMember: false, mergeNodes: false, timeHistoryAnalysis: false,
            trussGenerator: false, archGenerator: false, frameGenerator: false, cablePatternGenerator: false,
            supportDisplacement: false, prestressLoad: false, pressureLoad: false,
            en1998SeismicDialog: false, is875LiveLoad: false, nonlinearAnalysis: false,
            steelDesignIS800: false, steelDesignAISC360: false,
            rcBeamDesign: false, rcColumnDesign: false, rcSlabDesign: false, rcFootingDesign: false,
            rcDetailing: false, steelDetailing: false, sectionOptimization: false, designHub: false,
            momentLoadDialog: false, trapezoidalLoadDialog: false, pointLoadDialog: false, memberLoadDialog: false,
            geotechnicalDesign: false, hydraulicsDesign: false, transportDesign: false, constructionMgmt: false,
            // NEW modals
            towerGenerator: false, staircaseGenerator: false, pierGenerator: false, deckGenerator: false,
            linearArrayDialog: false, polarArrayDialog: false,
            measureDistanceDialog: false, measureAngleDialog: false, measureAreaDialog: false,
            importDxfDialog: false, importIfcDialog: false,
            plateThicknessDialog: false, taperedSectionDialog: false, compositeSectionDialog: false,
            importSectionTableDialog: false, cablePropsDialog: false, springConstantsDialog: false,
            lumpedMassDialog: false, memberHingesDialog: false,
            fixedSupportDialog: false, pinnedSupportDialog: false, rollerSupportDialog: false,
            customSupportDialog: false, fixedWithReleasesDialog: false, inclinedSupportDialog: false,
            translationalSpringDialog: false, rotationalSpringDialog: false, multilinearSpringDialog: false,
            elasticFoundationDialog: false, batchSupportAssignDialog: false,
            snowLoadDialog: false, referenceLoadsDialog: false, loadEnvelopesDialog: false,
            notionalLoadsDialog: false, loadCaseManagerDialog: false,
            cableAnalysisDialog: false, stressContourDialog: false, steadyStateDialog: false,
            timberDesignDialog: false, compositeDesignDialog: false, aluminumDesignDialog: false,
          },
        }),
      // Grid Settings
      showGrid: true,
      snapToGrid: true,
      gridSize: 1.0,

      setGridSize: (size) => set({ gridSize: size }),
      toggleGrid: () => set((state) => ({ showGrid: !state.showGrid })),
      toggleSnap: () => set((state) => ({ snapToGrid: !state.snapToGrid })),

      // Onboarding coordination
      activeOverlay: 'none' as UIState['activeOverlay'],
      setActiveOverlay: (overlay: UIState['activeOverlay']) => set({ activeOverlay: overlay }),
      onboardingCompleted: false,
      markOnboardingCompleted: () => set({ onboardingCompleted: true, activeOverlay: 'none' }),
    }),
    {
      name: "beamlab-ui-store",
      partialize: (state) => ({
        // Only persist user preferences
        sidebarMode: state.sidebarMode,
        propertiesPanelOpen: state.propertiesPanelOpen,
        dataPanelOpen: state.dataPanelOpen,
        showGrid: state.showGrid,
        snapToGrid: state.snapToGrid,
        gridSize: state.gridSize,
        useWebGpu: state.useWebGpu,
        onboardingCompleted: state.onboardingCompleted,
      }),
    },
  ),
);

// ============================================
// SELECTOR HOOKS
// ============================================

/**
 * Check if currently in modeling mode
 */
export const useIsModelingMode = () =>
  useUIStore((state) => state.activeCategory === "MODELING");

/**
 * Check if currently in result viewing mode
 */
export const useIsResultMode = () =>
  useUIStore(
    (state) =>
      state.activeCategory === "ANALYSIS" || state.activeCategory === "DESIGN",
  );

/**
 * Check if analysis has been completed
 */
export const useHasAnalysisResults = () =>
  useUIStore(
    (state) =>
      state.analysisResults !== null && state.analysisResults.completed,
  );

/**
 * Get available tools for current category
 */
export const useAvailableTools = () =>
  useUIStore((state) => CATEGORY_TOOLS[state.activeCategory]);

/**
 * Get current workflow state
 */
export const useWorkflowState = () =>
  useUIStore((state) => ({
    category: state.activeCategory,
    tool: state.activeTool,
    isModeling: state.activeCategory === "MODELING",
    isResults:
      state.activeCategory === "ANALYSIS" || state.activeCategory === "DESIGN",
    hasAnalysis: state.analysisResults?.completed ?? false,
  }));

export default useUIStore;
