/**
 * Analysis Types - Type definitions for structural analysis results
 * 
 * These types ensure type safety across analysis panels
 * and help with IDE autocompletion and error detection.
 */

// ============================================
// P-DELTA ANALYSIS
// ============================================

/**
 * Result of P-Delta (second-order) analysis
 */
export interface PDeltaAnalysisResult {
    /** Whether the analysis converged */
    converged: boolean;
    /** Number of iterations performed */
    iterations: number;
    /** Final convergence error */
    error?: number;
    /** Maximum displacement */
    maxDisplacement?: number;
    /** Displacement results by node */
    displacements?: Record<string, {
        DX: number;
        DY: number;
        DZ: number;
        RX: number;
        RY: number;
        RZ: number;
    }>;
    /** Reactions at support nodes */
    reactions?: Record<string, number[]>;
    /** Member force results */
    memberForces?: Record<string, MemberForceResult>;
    /** Amplification factors */
    amplificationFactors?: {
        lateral: number;
        gravity: number;
        combined: number;
    };
    /** Solver statistics */
    stats?: {
        solveTimeMs: number;
        method: string;
    };
}

// ============================================
// BUCKLING ANALYSIS
// ============================================

/**
 * Result of linear buckling analysis
 */
export interface BucklingAnalysisResult {
    /** Number of buckling modes computed */
    modes: number;
    /** Critical buckling load factors (eigenvalues) */
    buckling_loads: number[];
    /** Mode shapes (eigenvectors) */
    modeShapes?: BucklingMode[];
    /** Analysis success */
    success: boolean;
    /** Error message if failed */
    error?: string;
    /** Critical member info */
    criticalMember?: {
        id: string;
        bucklingLoad: number;
        effectiveLength: number;
        slendernessRatio: number;
    };
}

/**
 * Single buckling mode shape
 */
export interface BucklingMode {
    modeNumber: number;
    eigenvalue: number;
    criticalLoad: number;
    shape: Record<string, { DX: number; DY: number; DZ: number }>;
}

// ============================================
// MODAL ANALYSIS
// ============================================

/**
 * Result of modal (eigenvalue) analysis
 */
export interface ModalAnalysisResult {
    /** Number of modes computed */
    modes: number;
    /** Natural frequencies (Hz) */
    frequencies: number[];
    /** Natural periods (seconds) */
    periods: number[];
    /** Mode shapes */
    modeShapes: ModalMode[];
    /** Modal participation factors */
    participation?: {
        X: number[];
        Y: number[];
        Z: number[];
    };
    /** Cumulative mass participation */
    massParticipation?: {
        X: number[];
        Y: number[];
        Z: number[];
    };
    /** Solver statistics */
    stats?: {
        solveTimeMs: number;
        method: string;
    };
}

/**
 * Single vibration mode
 */
export interface ModalMode {
    modeNumber: number;
    frequency: number;  // Hz
    period: number;     // seconds
    shape: Record<string, { DX: number; DY: number; DZ: number; RX: number; RY: number; RZ: number }>;
    participationX?: number;
    participationY?: number;
    participationZ?: number;
}

// ============================================
// SEISMIC ANALYSIS
// ============================================

/**
 * Result of seismic analysis (IS 1893 / other codes)
 */
export interface SeismicAnalysisResult {
    /** Fundamental time period */
    T: number;
    /** Spectral acceleration coefficient */
    Sa_g: number;
    /** Design horizontal acceleration */
    Ah: number;
    /** Base shear (kN) */
    Vb: number;
    /** Total seismic weight (kN) */
    W: number;
    /** Floor-wise lateral forces (kN) */
    Qi: number[];
    /** Overturning moment (kN·m) */
    overturningMoment: number;
    /** Story drift values */
    storyDrifts?: number[];
    /** Code compliance status */
    codeCompliance?: {
        code: string;
        driftCheck: 'pass' | 'fail';
        stabilityCheck: 'pass' | 'fail';
    };
}

// ============================================
// TIME HISTORY ANALYSIS
// ============================================

/**
 * Result of time history analysis
 */
export interface TimeHistoryResult {
    /** Time steps (seconds) */
    time: number[];
    /** Displacement history at key nodes */
    displacements: Record<string, {
        DX: number[];
        DY: number[];
        DZ: number[];
    }>;
    /** Velocity history */
    velocities?: Record<string, {
        VX: number[];
        VY: number[];
        VZ: number[];
    }>;
    /** Acceleration history */
    accelerations?: Record<string, {
        AX: number[];
        AY: number[];
        AZ: number[];
    }>;
    /** Peak values */
    peaks: {
        maxDisplacement: number;
        maxVelocity?: number;
        maxAcceleration?: number;
        nodeId: string;
    };
    /** Base reactions over time */
    baseReactions?: {
        time: number[];
        FX: number[];
        FY: number[];
        MZ: number[];
    };
}

// ============================================
// CABLE ANALYSIS
// ============================================

/**
 * Result of cable/catenary analysis
 */
export interface CableAnalysisResult {
    /** Cable profile points */
    profile: Array<{ x: number; y: number; z: number }>;
    /** Cable tension */
    tension: {
        horizontal: number;  // kN
        max: number;         // kN
        min: number;         // kN
    };
    /** Cable geometry */
    geometry: {
        span: number;        // m
        sag: number;         // m
        length: number;      // m (actual cable length)
    };
    /** Cable stresses */
    stress?: {
        max: number;         // MPa
        allowable: number;   // MPa
        ratio: number;       // utilization ratio
    };
}

// ============================================
// MEMBER FORCES (Common)
// ============================================

/**
 * Member internal forces result
 */
export interface MemberForceResult {
    memberId: string;
    axial: number;          // kN (positive = tension)
    shearStart: number;     // kN
    shearEnd: number;       // kN
    momentStart: number;    // kN·m
    momentEnd: number;      // kN·m
    torsion?: number;       // kN·m
    /** Diagram data for plotting */
    diagramData?: {
        positions: number[];  // 0-1 ratio along member
        axial: number[];
        shear_y: number[];
        shear_z?: number[];
        moment_y: number[];
        moment_z?: number[];
        torsion?: number[];
    };
}

// ============================================
// STRESS RESULTS
// ============================================

/**
 * Stress calculation result for a member
 */
export interface StressResult {
    memberId: string;
    /** Maximum stress (MPa) */
    maxStress: number;
    /** Minimum stress (MPa) */
    minStress: number;
    /** Location of max stress */
    maxStressLocation: number;  // 0-1 ratio
    /** Stress type */
    stressType: 'axial' | 'bending' | 'combined' | 'vonMises';
    /** Utilization ratio */
    utilization?: number;
    /** Allowable stress (MPa) */
    allowable?: number;
    /** Check result */
    check?: 'pass' | 'fail' | 'warning';
}

// ============================================
// UTILITY TYPES
// ============================================

/**
 * Generic analysis result wrapper
 */
export interface AnalysisResultWrapper<T> {
    success: boolean;
    data?: T;
    error?: string;
    warnings?: string[];
    stats?: {
        solveTimeMs: number;
        method: string;
        [key: string]: any;
    };
}

/**
 * Analysis progress callback type
 */
export type AnalysisProgressCallback = (
    stage: 'validating' | 'assembling' | 'solving' | 'postprocessing' | 'complete' | 'error',
    percent: number,
    message?: string
) => void;

/**
 * Node displacement data
 */
export interface NodeDisplacement {
    nodeId: string;
    DX: number;  // mm
    DY: number;  // mm
    DZ: number;  // mm
    RX: number;  // rad
    RY: number;  // rad
    RZ: number;  // rad
}

/**
 * Support reaction data
 */
export interface SupportReaction {
    nodeId: string;
    FX: number;  // kN
    FY: number;  // kN
    FZ: number;  // kN
    MX: number;  // kN·m
    MY: number;  // kN·m
    MZ: number;  // kN·m
}
