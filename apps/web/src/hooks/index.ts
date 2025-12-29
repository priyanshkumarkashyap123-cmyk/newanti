/**
 * Hooks Index - Central export for all custom hooks
 */

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
