/**
 * loads.ts - Comprehensive Load Type Definitions
 * 
 * Matches backend load_engine.py structure
 * Supports: Nodal, Member (UDL/UVL/Point/Trapezoidal), Floor, Temperature, Prestress
 */
import { colors } from '@/styles/theme';

// ============================================
// ENUMERATIONS
// ============================================

export type LoadDirection = 
    | 'local_x' | 'local_y' | 'local_z'
    | 'global_x' | 'global_y' | 'global_z';

export type LoadCaseType = 
    | 'DEAD' | 'LIVE' | 'WIND' | 'SEISMIC' 
    | 'TEMPERATURE' | 'PRESTRESS' | 'IMPOSED'
    | 'SNOW' | 'RAIN' | 'CONSTRUCTION';

export type MemberLoadVariant = 
    | 'uniform' | 'trapezoidal' | 'point' | 'moment';

export type DistributionType = 
    | 'one_way' | 'two_way_triangular' | 'two_way_trapezoidal';


// ============================================
// NODAL LOAD
// ============================================

export interface NodalLoad {
    id: string;
    nodeId: string;
    fx: number;  // Force X (kN)
    fy: number;  // Force Y (kN)
    fz: number;  // Force Z (kN)
    mx: number;  // Moment X (kN·m)
    my: number;  // Moment Y (kN·m)
    mz: number;  // Moment Z (kN·m)
    loadCase: string;
}


// ============================================
// MEMBER LOADS
// ============================================

/** Uniform Distributed Load */
export interface UniformLoad {
    id: string;
    type: 'uniform';
    memberId: string;
    w: number;                      // Intensity (kN/m)
    direction: LoadDirection;
    startPos: number;               // 0-1 ratio
    endPos: number;                 // 0-1 ratio
    isProjected: boolean;           // Project for inclined members
    loadCase: string;
}

/** Trapezoidal/Triangular Load */
export interface TrapezoidalLoad {
    id: string;
    type: 'trapezoidal';
    memberId: string;
    w1: number;                     // Intensity at start (kN/m)
    w2: number;                     // Intensity at end (kN/m)
    direction: LoadDirection;
    startPos: number;               // 0-1 ratio
    endPos: number;                 // 0-1 ratio
    isProjected: boolean;
    loadCase: string;
}

/** Point Load on Member */
export interface PointLoadOnMember {
    id: string;
    type: 'point';
    memberId: string;
    P: number;                      // Load magnitude (kN)
    a: number;                      // Position ratio (0-1)
    direction: LoadDirection;
    loadCase: string;
}

/** Moment on Member */
export interface MomentOnMember {
    id: string;
    type: 'moment';
    memberId: string;
    M: number;                      // Moment magnitude (kN·m)
    a: number;                      // Position ratio (0-1)
    aboutAxis: 'y' | 'z';           // Local axis
    loadCase: string;
}

export type MemberLoad = UniformLoad | TrapezoidalLoad | PointLoadOnMember | MomentOnMember;


// ============================================
// FLOOR / AREA LOAD
// ============================================

export interface FloorLoad {
    id: string;
    pressure: number;               // Load intensity (kN/m²)
    yLevel: number;                 // Floor Y coordinate
    xMin: number;
    xMax: number;
    zMin: number;
    zMax: number;
    distributionOverride?: DistributionType;  // Force specific distribution
    loadCase: string;
}

export interface Panel {
    nodes: string[];
    xMin: number;
    xMax: number;
    zMin: number;
    zMax: number;
    Lx: number;
    Lz: number;
    aspectRatio: number;
    area: number;
    distribution: DistributionType;
}


// ============================================
// TEMPERATURE LOAD
// ============================================

export interface TemperatureLoad {
    id: string;
    memberId: string;
    deltaT: number;                 // Temperature change (°C)
    alpha: number;                  // Thermal expansion coefficient (1/°C)
    gradientT?: number;             // Temperature gradient across depth (°C)
    sectionDepth?: number;          // Section depth for gradient (m)
    loadCase: string;
}


// ============================================
// PRESTRESS LOAD
// ============================================

export interface PrestressLoad {
    id: string;
    memberId: string;
    P: number;                      // Prestress force (kN)
    eStart: number;                 // Eccentricity at start (m)
    eMid: number;                   // Eccentricity at mid-span (m)
    eEnd: number;                   // Eccentricity at end (m)
    loadCase: string;
}


// ============================================
// LOAD CASE & COMBINATION
// ============================================

export interface LoadCase {
    name: string;
    description: string;
    type: LoadCaseType;
    color?: string;                 // UI color coding
    nodalLoads: NodalLoad[];
    memberLoads: MemberLoad[];
    floorLoads: FloorLoad[];
    temperatureLoads: TemperatureLoad[];
    prestressLoads: PrestressLoad[];
}

export interface LoadCombination {
    name: string;
    description: string;
    factors: Record<string, number>;  // loadCaseName -> factor
    isEnvelope?: boolean;             // For moving load envelope
}

// Default IS 456 / IS 875 combinations
export const DEFAULT_COMBINATIONS: LoadCombination[] = [
    {
        name: '1.5(DL+LL)',
        description: 'IS 456 Cl. 36.4.1 - Strength Limit State',
        factors: { DEAD: 1.5, LIVE: 1.5 }
    },
    {
        name: '1.2(DL+LL+WL)',
        description: 'IS 456 Cl. 36.4.1(b) - Wind load combination',
        factors: { DEAD: 1.2, LIVE: 1.2, WIND: 1.2 }
    },
    {
        name: '1.2(DL+LL-EQ)',
        description: 'IS 456 Cl. 36.4.1(b) reverse - Seismic load combination',
        factors: { DEAD: 1.2, LIVE: 1.2, SEISMIC: -1.2 }
    },
    {
        name: '1.2(DL+LL+EQ)',
        description: 'IS 456 Cl. 36.4.1(b) - Seismic load combination',
        factors: { DEAD: 1.2, LIVE: 1.2, SEISMIC: 1.2 }
    },
    {
        name: '1.2(DL+LL-WL)',
        description: 'IS 456 Cl. 36.4.1(b) reverse - Wind load combination',
        factors: { DEAD: 1.2, LIVE: 1.2, WIND: -1.2 }
    },
    {
        name: '1.5(DL+EQ)',
        description: 'IS 456 Cl. 36.4.1(c) - Dead + Seismic',
        factors: { DEAD: 1.5, SEISMIC: 1.5 }
    },
    {
        name: '1.5(DL-EQ)',
        description: 'IS 456 Cl. 36.4.1(c) reverse - Dead + Seismic',
        factors: { DEAD: 1.5, SEISMIC: -1.5 }
    },
    {
        name: '1.5(DL+WL)',
        description: 'IS 456 Cl. 36.4.1(c) - Dead + Wind',
        factors: { DEAD: 1.5, WIND: 1.5 }
    },
    {
        name: '1.5(DL-WL)',
        description: 'IS 456 Cl. 36.4.1(c) reverse - Dead + Wind',
        factors: { DEAD: 1.5, WIND: -1.5 }
    },
    {
        name: '0.9DL+1.5WL',
        description: 'IS 456 Cl. 36.4.1(d) - Overturning check (wind)',
        factors: { DEAD: 0.9, WIND: 1.5 }
    },
    {
        name: '0.9DL-1.5WL',
        description: 'IS 456 Cl. 36.4.1(d) reverse - Overturning check (wind)',
        factors: { DEAD: 0.9, WIND: -1.5 }
    },
    {
        name: '0.9DL+1.5EQ',
        description: 'IS 456 Cl. 36.4.1(d) - Overturning check (seismic)',
        factors: { DEAD: 0.9, SEISMIC: 1.5 }
    },
    {
        name: '0.9DL-1.5EQ',
        description: 'IS 456 Cl. 36.4.1(d) reverse - Overturning check (seismic)',
        factors: { DEAD: 0.9, SEISMIC: -1.5 }
    },
    {
        name: 'DL+LL',
        description: 'Serviceability - Deflection Check',
        factors: { DEAD: 1.0, LIVE: 1.0 }
    }
];


// ============================================
// FIXED END ACTIONS (For Solver)
// ============================================

export interface FixedEndActions {
    Fy_start: number;
    Fy_end: number;
    Fz_start: number;
    Fz_end: number;
    Mx_start: number;
    Mx_end: number;
    My_start: number;
    My_end: number;
    Mz_start: number;
    Mz_end: number;
}

/**
 * Calculate fixed end actions for uniform load
 */
export function calcUniformLoadFEA(
    w: number, 
    L: number, 
    startPos: number = 0, 
    endPos: number = 1
): Partial<FixedEndActions> {
    const a = startPos * L;
    const b = endPos * L;
    const loadLen = b - a;
    
    if (loadLen <= 0) return {};
    
    const W = w * loadLen;
    const c = (a + b) / 2;
    
    // Reactions
    const Fy_end = W * c / L;
    const Fy_start = W - Fy_end;
    
    // Fixed end moments (approximate)
    const Mz_start = -W * c * Math.pow(L - c, 2) / (L * L);
    const Mz_end = W * c * c * (L - c) / (L * L);
    
    return { Fy_start, Fy_end, Mz_start, Mz_end };
}

/**
 * Calculate fixed end actions for trapezoidal load
 */
export function calcTrapezoidalLoadFEA(
    w1: number,
    w2: number,
    L: number,
    startPos: number = 0,
    endPos: number = 1
): Partial<FixedEndActions> {
    const a = startPos * L;
    const b = endPos * L;
    const loadLen = b - a;
    
    if (loadLen <= 0) return {};
    
    // Decompose into uniform + triangular
    const wMin = Math.min(w1, w2);
    const wDiff = Math.abs(w2 - w1);
    const triangleToEnd = w2 > w1;
    
    // Uniform component
    const W_uniform = wMin * loadLen;
    const c_uniform = (a + b) / 2;
    
    // Triangular component
    const W_triangle = 0.5 * wDiff * loadLen;
    const c_triangle = triangleToEnd 
        ? a + (2 * loadLen / 3)
        : a + (loadLen / 3);
    
    // Total
    const W_total = W_uniform + W_triangle;
    const c_total = W_total > 0 
        ? (W_uniform * c_uniform + W_triangle * c_triangle) / W_total
        : c_uniform;
    
    const Fy_end = W_total * c_total / L;
    const Fy_start = W_total - Fy_end;
    const Mz_start = -W_total * c_total * Math.pow(L - c_total, 2) / (L * L);
    const Mz_end = W_total * c_total * c_total * (L - c_total) / (L * L);
    
    return { Fy_start, Fy_end, Mz_start, Mz_end };
}

/**
 * Calculate fixed end actions for point load
 */
export function calcPointLoadFEA(
    P: number,
    L: number,
    a_ratio: number
): Partial<FixedEndActions> {
    const a = a_ratio * L;
    const b = L - a;
    
    if (L <= 0) return {};
    
    const Fy_start = P * b / L;
    const Fy_end = P * a / L;
    const Mz_start = -P * a * b * b / (L * L);
    const Mz_end = P * a * a * b / (L * L);
    
    return { Fy_start, Fy_end, Mz_start, Mz_end };
}


// ============================================
// LOAD STORE INTERFACE
// ============================================

export interface LoadStoreState {
    loadCases: Map<string, LoadCase>;
    combinations: LoadCombination[];
    activeLoadCase: string;
    
    // Actions
    addLoadCase: (lc: LoadCase) => void;
    removeLoadCase: (name: string) => void;
    setActiveLoadCase: (name: string) => void;
    
    addNodalLoad: (load: NodalLoad) => void;
    removeNodalLoad: (id: string) => void;
    
    addMemberLoad: (load: MemberLoad) => void;
    removeMemberLoad: (id: string) => void;
    
    addFloorLoad: (load: FloorLoad) => void;
    removeFloorLoad: (id: string) => void;
    
    addCombination: (combo: LoadCombination) => void;
    removeCombination: (name: string) => void;
    
    exportForSolver: (comboName: string) => SolverLoadData;
}

export interface SolverLoadData {
    combination: string;
    nodalLoads: Array<{
        nodeId: string;
        fx: number; fy: number; fz: number;
        mx: number; my: number; mz: number;
    }>;
    memberLoads: Array<{
        type: MemberLoadVariant;
        memberId: string;
        [key: string]: unknown;
    }>;
    temperatureLoads: TemperatureLoad[];
    prestressLoads: PrestressLoad[];
}


// ============================================
// HELPER FUNCTIONS
// ============================================

export function createDefaultLoadCase(type: LoadCaseType): LoadCase {
    const loadColors: Record<LoadCaseType, string> = {
        DEAD: colors.neutral[500],      // Gray
        LIVE: colors.primary[500],      // Blue
        WIND: '#06b6d4',                // Cyan (no direct theme token)
        SEISMIC: colors.error[500],     // Red
        TEMPERATURE: colors.warning[500], // Orange
        PRESTRESS: colors.accent[500],  // Purple
        IMPOSED: colors.success[500],   // Green
        SNOW: colors.primary[100],      // Light blue
        RAIN: '#0ea5e9',                // Sky (no direct theme token)
        CONSTRUCTION: colors.warning[400] // Yellow
    };
    
    return {
        name: type,
        description: `${type} Load Case`,
        type: type,
        color: loadColors[type],
        nodalLoads: [],
        memberLoads: [],
        floorLoads: [],
        temperatureLoads: [],
        prestressLoads: []
    };
}

export function generateLoadId(prefix: string = 'load'): string {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}
