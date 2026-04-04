/**
 * Hooks Index - Central export for all custom hooks
 */

// ============================================================================
// CORE ENGINEERING HOOKS
// ============================================================================

// Multiplayer / Collaboration
export { useMultiplayer } from './useMultiplayer';

// Physical Modeling Workflow
export { usePhysicalModeling } from './usePhysicalModeling';

// Structural Solver
export { useStructuralSolver } from './useStructuralSolver';

// Subscription/Billing
export { useSubscription } from './useSubscription';

// Vibration Analysis
export { useVibration } from './useVibration';

// WASM Solver
export { useWasmSolver } from './useWasmSolver';

// AI Workflow
export { useAIWorkflow } from './useAIWorkflow';

// AI Orchestrator (production-grade unified AI interface)
export { useAIOrchestrator } from './useAIOrchestrator';

// Advanced Analysis (P-Delta, Modal, Buckling, Cable)
export { 
    useAdvancedAnalysis, 
    useSeismicAnalysis, 
    useStabilityAnalysis,
    IS1893_ZONE_FACTORS,
    IS1893_SOIL_TYPES,
} from './useAdvancedAnalysis';

// Design Code Compliance (Steel, Concrete, Connections, Foundations)
export {
    useDesign,
    useRCDesign,
    useFoundationDesign,
    STEEL_GRADES,
    CONCRETE_GRADES,
    REBAR_GRADES,
    BOLT_GRADES,
} from './useDesign';

// User Registration
export { useUserRegistration } from './useUserRegistration';

// Device & Session Management
export { useDeviceId, getDeviceId, getDeviceName } from './useDeviceId';
export { useDeviceSession } from './useDeviceSession';
export { useAnalysisLock } from './useAnalysisLock';
export { useUsageTracking } from './useUsageTracking';

// ============================================================================
// INDUSTRY-STANDARD UI/UX HOOKS (CTO Session 3)
// ============================================================================

// Async Operations with Loading/Error States
export {
    useAsyncOperation,
    useMutation,
    useParallelAsync,
    useDebouncedAsync,
    type AsyncState,
    type AsyncOperationOptions,
    type UseMutationOptions,
} from './useAsyncOperation';

// Form Validation with Zod
export {
    useForm,
    FormProvider,
    useFormContext,
    FormField as FormFieldComponent,
    validators,
    commonSchemas,
    type UseFormOptions,
    type UseFormReturn,
    type FieldProps,
} from './useFormValidation';

// Keyboard Navigation
export {
    useRovingTabIndex,
    useGridNavigation,
    useKeyboardShortcuts as useKeyboardShortcutsNew,
    ShortcutsProvider,
    useShortcuts,
    useFocusTrap,
    useCanvasNavigation,
    formatShortcut,
} from './useKeyboardNavigation';

// Optimistic Updates
export {
    useOptimistic,
    useOptimisticList,
    useBatchOptimistic,
    resolveConflict,
    type OptimisticState,
    type ConflictResolutionStrategy,
} from './useOptimisticUpdate';

// Progress Tracking
export {
    useProgress,
    ProgressProvider,
    useProgressContext,
    useSSEProgress,
    formatTimeRemaining,
    type ProgressState,
    type ProgressStep,
    type ProgressOptions,
} from './useProgressTracking';

// Responsive Utilities
export {
    useViewport,
    useBreakpoint,
    useBreakpointUp,
    useBreakpointDown,
    useBreakpointBetween,
    useTouchDevice,
    useOrientation,
    useSafeAreaInsets,
    useResponsiveValue,
    useContainerSize,
    useMobileMenu,
    useSwipeGesture,
    usePinchZoom,
    ResponsiveProvider,
    type Breakpoint,
    type ViewportState,
} from './useResponsive';
