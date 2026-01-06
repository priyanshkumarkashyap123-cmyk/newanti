/**
 * uiStore.ts - Umbrella State Manager
 * 
 * Manages the workflow state with category-based transitions.
 * Implements "One-by-One" logic for safe category switching.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// ============================================
// TYPES
// ============================================

/**
 * The five main workflow categories (Umbrellas)
 */
export type Category = 'MODELING' | 'PROPERTIES' | 'LOADING' | 'ANALYSIS' | 'DESIGN';

/**
 * Sidebar display mode
 */
export type SidebarMode = 'EXPANDED' | 'COLLAPSED';

/**
 * Validation result for category switching
 */
export interface ValidationResult {
    valid: boolean;
    message?: string;
    warnings?: string[];
}

/**
 * Analysis results structure (minimal interface)
 */
export interface AnalysisResults {
    completed: boolean;
    timestamp?: number;
    displacements?: Map<string, number[]>;
    reactions?: Map<string, number[]>;
}

// ============================================
// TOOLS PER CATEGORY
// ============================================

export const CATEGORY_TOOLS: Record<Category, string[]> = {
    MODELING: [
        // Selection & View
        'SELECT', 'SELECT_RANGE', 'PAN', 'ZOOM_WINDOW',
        // Draw - Basic
        'DRAW_NODE', 'DRAW_BEAM', 'DRAW_COLUMN',
        // Draw - Advanced
        'DRAW_CABLE', 'DRAW_ARCH', 'DRAW_RIGID_LINK', 'DRAW_PLATE',
        // Edit
        'COPY', 'MIRROR', 'DELETE', 'DIVIDE_MEMBER', 'MERGE_NODES', 'ALIGN_NODES', 'SPLIT_MEMBER',
        // Array
        'ARRAY_LINEAR', 'ARRAY_POLAR', 'ARRAY_3D',
        // Transform
        'MOVE', 'ROTATE', 'SCALE', 'OFFSET_MEMBER', 'EXTRUDE',
        // Generators
        'GRID_GENERATE', 'GRID_3D', 'CIRCULAR_GRID',
        'TRUSS_GENERATOR', 'ARCH_GENERATOR', 'PIER_GENERATOR',
        'TOWER_GENERATOR', 'DECK_GENERATOR', 'CABLE_PATTERN',
        'FRAME_GENERATOR', 'STAIRCASE_GENERATOR',
        // Measure
        'MEASURE_DISTANCE', 'MEASURE_ANGLE', 'MEASURE_AREA'
    ],
    PROPERTIES: [
        'ASSIGN_SECTION', 'ASSIGN_MATERIAL', 'ASSIGN_RELEASE', 'ASSIGN_OFFSET',
        // New property tools
        'ASSIGN_CABLE_PROPS', 'ASSIGN_SPRING', 'ASSIGN_MASS', 'MEMBER_ORIENTATION',
        'ASSIGN_RIGID', 'ASSIGN_HINGE', 'ASSIGN_SUPPORT',
        // Section tools
        'SECTION_BUILDER', 'IMPORT_SECTION'
    ],
    LOADING: [
        'ADD_POINT_LOAD', 'ADD_MOMENT', 'ADD_UDL', 'ADD_TRAPEZOID',
        'ADD_WIND', 'ADD_SEISMIC', 'LOAD_COMBINATIONS',
        // New loading tools
        'ADD_PRETENSION', 'ADD_TEMPERATURE', 'ADD_MOVING_LOAD',
        'ADD_HYDROSTATIC', 'ADD_SELF_WEIGHT', 'ADD_SETTLEMENT',
        'ADD_PRESSURE', 'ADD_CENTRIFUGAL',
        // Load patterns
        'LOAD_PATTERN', 'ENVELOPE'
    ],
    ANALYSIS: [
        'RUN_ANALYSIS', 'VIEW_DEFORMED', 'VIEW_REACTIONS',
        'VIEW_SFD', 'VIEW_BMD', 'VIEW_DIAGRAMS',
        // Advanced analysis
        'MODAL_ANALYSIS', 'BUCKLING_ANALYSIS', 'P_DELTA',
        'PUSHOVER', 'TIME_HISTORY', 'RESPONSE_SPECTRUM'
    ],
    DESIGN: [
        'STEEL_CHECK', 'CONCRETE_DESIGN', 'CONNECTION_DESIGN',
        'FOUNDATION_DESIGN', 'GENERATE_REPORT',
        // Additional design tools
        'TIMBER_DESIGN', 'COMPOSITE_DESIGN', 'SEISMIC_DETAIL',
        'CROSS_SECTION_CHECK', 'DEFLECTION_CHECK'
    ]
};

// ============================================
// STATE INTERFACE
// ============================================

interface UIState {
    // Core State
    activeCategory: Category;
    sidebarMode: SidebarMode;
    activeTool: string | null;

    // Analysis state (to track if analysis has been run)
    analysisResults: AnalysisResults | null;

    // Validation state
    lastValidation: ValidationResult | null;

    // Notification state
    notification: {
        show: boolean;
        type: 'info' | 'warning' | 'error' | 'success';
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
        // ASCE 7 Load Generation
        asce7SeismicDialog: boolean;
        asce7WindDialog: boolean;
        loadCombinationsDialog: boolean;
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
    };

    // Graphics State
    useWebGpu: boolean;
    setUseWebGpu: (val: boolean) => void;
    renderMode3D: boolean;  // Toggle for solid 3D beam cross-sections
    setRenderMode3D: (val: boolean) => void;

    // Actions
    setCategory: (cat: Category) => void;
    setActiveTool: (tool: string | null) => void;
    setSidebarMode: (mode: SidebarMode) => void;
    toggleSidebar: () => void;

    // Analysis actions
    setAnalysisResults: (results: AnalysisResults | null) => void;
    clearAnalysisResults: () => void;

    // Notification actions
    showNotification: (type: 'info' | 'warning' | 'error' | 'success', message: string) => void;
    hideNotification: () => void;

    // Panel actions
    togglePropertiesPanel: () => void;
    toggleDataPanel: () => void;

    // Modal actions
    openModal: (modal: keyof UIState['modals']) => void;
    closeModal: (modal: keyof UIState['modals']) => void;
    toggleModal: (modal: keyof UIState['modals']) => void;
    setModal: (modal: keyof UIState['modals'], isOpen: boolean) => void;

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
 * Check if nodes are properly connected (basic validation)
 * This will be enhanced to use the actual model store
 */
const validateModelConnectivity = (): ValidationResult => {
    // TODO: Import and use useModelStore to validate
    // For now, return a mock validation
    return {
        valid: true,
        message: 'Model validation passed',
        warnings: []
    };
};

// ============================================
// STORE CREATION
// ============================================

export const useUIStore = create<UIState>()(
    persist(
        (set, get) => ({
            // Initial State
            activeCategory: 'MODELING',
            sidebarMode: 'EXPANDED',
            activeTool: 'SELECT',
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
                // ASCE 7 Load Generation
                asce7SeismicDialog: false,
                asce7WindDialog: false,
                loadCombinationsDialog: false,
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
            },

            // Graphics State
            useWebGpu: false,
            setUseWebGpu: (val) => set({ useWebGpu: val }),
            renderMode3D: false,  // Default to wireframe for performance
            setRenderMode3D: (val) => set({ renderMode3D: val }),

            // ========================================
            // SET CATEGORY - THE "ONE-BY-ONE" LOGIC
            // ========================================
            setCategory: (cat: Category) => {
                const currentCategory = get().activeCategory;
                const analysisResults = get().analysisResults;

                // Don't do anything if same category
                if (currentCategory === cat) return;

                // ----------------------------------------
                // Rule 1: When switching AWAY from MODELING
                // Automatically clear the active tool
                // ----------------------------------------
                if (currentCategory === 'MODELING') {
                    set({ activeTool: null });
                    console.log('[UIStore] Left MODELING mode - cleared active tool');
                }

                // ----------------------------------------
                // Rule 2: When switching TO ANALYSIS
                // Validate the model (are nodes connected?)
                // ----------------------------------------
                if (cat === 'ANALYSIS') {
                    const validation = validateModelConnectivity();
                    set({ lastValidation: validation });

                    if (!validation.valid) {
                        set({
                            notification: {
                                show: true,
                                type: 'warning',
                                message: validation.message || 'Model validation failed. Please check your model.'
                            }
                        });
                        console.warn('[UIStore] Model validation failed:', validation.message);
                        // Still allow switching, but show warning
                    } else {
                        console.log('[UIStore] Model validated successfully');
                    }
                }

                // ----------------------------------------
                // Rule 3: When switching TO DESIGN
                // Ensure analysis results exist
                // ----------------------------------------
                if (cat === 'DESIGN') {
                    if (!analysisResults || !analysisResults.completed) {
                        set({
                            notification: {
                                show: true,
                                type: 'error',
                                message: 'Please Run Analysis First before accessing Design tools.'
                            }
                        });
                        console.warn('[UIStore] Cannot switch to DESIGN - no analysis results');

                        // Block the category switch
                        return;
                    }
                }

                // ----------------------------------------
                // Apply the category switch
                // ----------------------------------------
                set({
                    activeCategory: cat,
                    // Set default tool for new category
                    activeTool: CATEGORY_TOOLS[cat][0] || null
                });

                console.log(`[UIStore] Switched to ${cat} category`);
            },

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
                    console.warn(`[UIStore] Tool "${tool}" is not valid for ${category} category`);
                    return;
                }

                set({ activeTool: tool });
            },

            // ========================================
            // SIDEBAR ACTIONS
            // ========================================
            setSidebarMode: (mode: SidebarMode) => set({ sidebarMode: mode }),

            toggleSidebar: () => set((state) => ({
                sidebarMode: state.sidebarMode === 'EXPANDED' ? 'COLLAPSED' : 'EXPANDED'
            })),

            // ========================================
            // ANALYSIS ACTIONS
            // ========================================
            setAnalysisResults: (results: AnalysisResults | null) => set({
                analysisResults: results
            }),

            clearAnalysisResults: () => set({ analysisResults: null }),

            // ========================================
            // NOTIFICATION ACTIONS
            // ========================================
            showNotification: (type, message) => set({
                notification: { show: true, type, message }
            }),

            hideNotification: () => set({ notification: null }),

            // ========================================
            // PANEL ACTIONS
            // ========================================
            togglePropertiesPanel: () => set((state) => ({
                propertiesPanelOpen: !state.propertiesPanelOpen
            })),

            toggleDataPanel: () => set((state) => ({
                dataPanelOpen: !state.dataPanelOpen
            })),

            // ========================================
            // MODAL ACTIONS
            // ========================================
            openModal: (modal) => set((state) => ({
                modals: { ...state.modals, [modal]: true }
            })),

            closeModal: (modal) => set((state) => ({
                modals: { ...state.modals, [modal]: false }
            })),

            toggleModal: (modal) => set((state) => ({
                modals: { ...state.modals, [modal]: !state.modals[modal] }
            })),

            setModal: (modal, isOpen) => set((state) => ({
                modals: { ...state.modals, [modal]: isOpen }
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
            resetToDefaults: () => set({
                activeCategory: 'MODELING',
                sidebarMode: 'EXPANDED',
                activeTool: 'SELECT',
                analysisResults: null,
                lastValidation: null,
                notification: null,
                propertiesPanelOpen: true,
                dataPanelOpen: true,
                modals: {
                    structureWizard: false,
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
                    boundaryDialog: false,
                    asce7SeismicDialog: false,
                    asce7WindDialog: false,
                    loadCombinationsDialog: false,
                    advancedAnalysis: false,
                    designCodes: false,
                    connectionDesign: false,
                    steelDesign: false,
                    concreteDesign: false,
                    pDeltaAnalysis: false,
                    modalAnalysis: false,
                    bucklingAnalysis: false,
                }
            }),
            // Grid Settings
            showGrid: true,
            snapToGrid: true,
            gridSize: 1.0,

            setGridSize: (size) => set({ gridSize: size }),
            toggleGrid: () => set((state) => ({ showGrid: !state.showGrid })),
            toggleSnap: () => set((state) => ({ snapToGrid: !state.snapToGrid })),
        }),
        {
            name: 'beamlab-ui-store',
            partialize: (state) => ({
                // Only persist user preferences
                sidebarMode: state.sidebarMode,
                propertiesPanelOpen: state.propertiesPanelOpen,
                dataPanelOpen: state.dataPanelOpen,
                showGrid: state.showGrid,
                snapToGrid: state.snapToGrid,
                gridSize: state.gridSize,
                useWebGpu: state.useWebGpu
            })
        }
    )
);

// ============================================
// SELECTOR HOOKS
// ============================================

/**
 * Check if currently in modeling mode
 */
export const useIsModelingMode = () =>
    useUIStore((state) => state.activeCategory === 'MODELING');

/**
 * Check if currently in result viewing mode
 */
export const useIsResultMode = () =>
    useUIStore((state) =>
        state.activeCategory === 'ANALYSIS' || state.activeCategory === 'DESIGN'
    );

/**
 * Check if analysis has been completed
 */
export const useHasAnalysisResults = () =>
    useUIStore((state) =>
        state.analysisResults !== null && state.analysisResults.completed
    );

/**
 * Get available tools for current category
 */
export const useAvailableTools = () =>
    useUIStore((state) => CATEGORY_TOOLS[state.activeCategory]);

/**
 * Get current workflow state
 */
export const useWorkflowState = () => useUIStore((state) => ({
    category: state.activeCategory,
    tool: state.activeTool,
    isModeling: state.activeCategory === 'MODELING',
    isResults: state.activeCategory === 'ANALYSIS' || state.activeCategory === 'DESIGN',
    hasAnalysis: state.analysisResults?.completed ?? false
}));

export default useUIStore;
