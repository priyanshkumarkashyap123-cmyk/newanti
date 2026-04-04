/**
 * ConnectionTypes.ts - Structural Connection Type Definitions
 * 
 * Comprehensive connection system for structural analysis:
 * - Bolted connections (simple, moment-resistant, slip-critical)
 * - Welded connections (fillet, butt, plug)
 * - Pinned/Hinged connections
 * - Rigid/Moment connections
 * - Base plate connections
 * 
 * Includes capacity calculations based on IS 800:2007 and AISC 360
 */

// ============================================
// CONNECTION TYPE ENUMS
// ============================================

export type ConnectionType =
    | 'BOLTED_SIMPLE'
    | 'BOLTED_MOMENT'
    | 'BOLTED_SLIP_CRITICAL'
    | 'WELDED_FILLET'
    | 'WELDED_FULL_PEN'
    | 'WELDED_PARTIAL_PEN'
    | 'PINNED'
    | 'RIGID'
    | 'BASE_PLATE_PINNED'
    | 'BASE_PLATE_FIXED';

export type BoltGrade = '4.6' | '4.8' | '5.6' | '5.8' | '8.8' | '10.9' | '12.9';

export type WeldType = 'fillet' | 'butt' | 'plug' | 'slot';

export type ConnectionLocation = 'beam-column' | 'beam-beam' | 'column-base' | 'brace' | 'splice';

// ============================================
// BOLT SPECIFICATIONS
// ============================================

export interface BoltSpec {
    grade: BoltGrade;
    diameter: number;          // mm
    area: number;              // mm² (tensile stress area)
    fy: number;                // MPa (yield strength)
    fu: number;                // MPa (ultimate strength)
}

export const BOLT_SPECIFICATIONS: Record<BoltGrade, { fy: number; fu: number }> = {
    '4.6': { fy: 240, fu: 400 },
    '4.8': { fy: 320, fu: 400 },
    '5.6': { fy: 300, fu: 500 },
    '5.8': { fy: 400, fu: 500 },
    '8.8': { fy: 640, fu: 800 },
    '10.9': { fy: 900, fu: 1000 },
    '12.9': { fy: 1080, fu: 1200 }
};

export const STANDARD_BOLT_DIAMETERS: number[] = [12, 16, 20, 22, 24, 27, 30, 36];

// Tensile stress areas for standard bolt diameters (mm²)
export const BOLT_TENSILE_AREAS: Record<number, number> = {
    12: 84.3,
    16: 157,
    20: 245,
    22: 303,
    24: 353,
    27: 459,
    30: 561,
    36: 817
};

// ============================================
// WELD SPECIFICATIONS
// ============================================

export interface WeldSpec {
    type: WeldType;
    size: number;              // mm (leg size for fillet, throat for butt)
    length: number;            // mm
    strength: number;          // MPa (based on electrode)
    electrode?: string;        // e.g., 'E70XX', 'E60XX'
}

export const ELECTRODE_STRENGTHS: Record<string, { fuw: number }> = {
    'E41': { fuw: 410 },     // Indian - 410 MPa
    'E51': { fuw: 510 },     // Indian - 510 MPa  
    'E60XX': { fuw: 414 },   // AISC - 60 ksi electrode
    'E70XX': { fuw: 482 },   // AISC - 70 ksi electrode
    'E80XX': { fuw: 552 }    // AISC - 80 ksi electrode
};

// ============================================
// CONNECTION DETAIL INTERFACES
// ============================================

export interface BoltedConnectionDetails {
    boltGrade: BoltGrade;
    boltDiameter: number;      // mm
    numberOfBolts: number;
    rows: number;
    columns: number;
    pitch: number;             // mm (spacing perpendicular to force)
    gauge: number;             // mm (spacing parallel to force)
    edgeDistance: number;      // mm
    endDistance: number;       // mm
    holeType: 'standard' | 'oversized' | 'slotted';
    slipCritical?: boolean;
    surfaceClass?: 'A' | 'B' | 'C';  // For slip-critical
}

export interface WeldedConnectionDetails {
    weldType: WeldType;
    weldSize: number;          // mm
    weldLength: number;        // mm
    electrode: string;
    numberOfWelds: number;
    returnLength?: number;     // mm (for wrap-around welds)
    isIntermittent?: boolean;
    intermittentSpacing?: number;  // mm
}

export interface BasePlateDetails {
    width: number;             // mm
    length: number;            // mm
    thickness: number;         // mm
    anchorBoltDiameter: number; // mm
    anchorBoltGrade: BoltGrade;
    numberOfAnchors: number;
    anchorLayout: 'rectangular' | 'circular' | 'inline';
    embedmentDepth: number;    // mm
    groutThickness: number;    // mm
}

// ============================================
// CONNECTION DEFINITION INTERFACE
// ============================================

export interface Connection {
    id: string;
    type: ConnectionType;
    location: ConnectionLocation;
    memberId?: string;         // Member this connection belongs to
    nodeId: string;            // Node where connection is located

    // Stiffness Properties (for analysis)
    momentCapacity?: number;   // kN·m
    shearCapacity?: number;    // kN
    axialCapacity?: number;    // kN
    rotationalStiffness?: number;  // kN·m/rad (for semi-rigid)

    // Connection Details
    boltDetails?: BoltedConnectionDetails;
    weldDetails?: WeldedConnectionDetails;
    basePlateDetails?: BasePlateDetails;

    // Geometric Properties
    plateThickness?: number;   // mm (end plate, gusset, etc.)
    plateWidth?: number;       // mm
    plateDepth?: number;       // mm
    stiffenerCount?: number;

    // Design Status
    utilization?: number;      // 0-1 (demand/capacity)
    designCheck?: 'OK' | 'NG' | 'MARGINAL';
    criticalCheck?: string;    // e.g., 'bolt shear', 'weld fracture'
}

// ============================================
// PRE-DEFINED CONNECTION TEMPLATES
// ============================================

export const CONNECTION_TEMPLATES: Record<string, Partial<Connection>> = {
    // Simple Shear Connections
    'SIMPLE_BOLTED_4X16': {
        type: 'BOLTED_SIMPLE',
        location: 'beam-column',
        boltDetails: {
            boltGrade: '4.6',
            boltDiameter: 16,
            numberOfBolts: 4,
            rows: 2,
            columns: 2,
            pitch: 60,
            gauge: 60,
            edgeDistance: 30,
            endDistance: 35,
            holeType: 'standard'
        },
        shearCapacity: 120,
        axialCapacity: 80
    },

    'SIMPLE_BOLTED_6X20': {
        type: 'BOLTED_SIMPLE',
        location: 'beam-column',
        boltDetails: {
            boltGrade: '8.8',
            boltDiameter: 20,
            numberOfBolts: 6,
            rows: 3,
            columns: 2,
            pitch: 70,
            gauge: 80,
            edgeDistance: 35,
            endDistance: 40,
            holeType: 'standard'
        },
        shearCapacity: 320,
        axialCapacity: 200
    },

    // Moment Resistant Connections
    'MOMENT_BOLTED_8X24': {
        type: 'BOLTED_MOMENT',
        location: 'beam-column',
        boltDetails: {
            boltGrade: '10.9',
            boltDiameter: 24,
            numberOfBolts: 8,
            rows: 4,
            columns: 2,
            pitch: 80,
            gauge: 140,
            edgeDistance: 40,
            endDistance: 50,
            holeType: 'standard'
        },
        momentCapacity: 450,
        shearCapacity: 400,
        plateThickness: 25
    },

    'MOMENT_WELDED': {
        type: 'WELDED_FULL_PEN',
        location: 'beam-column',
        weldDetails: {
            weldType: 'butt',
            weldSize: 15,
            weldLength: 200,
            electrode: 'E70XX',
            numberOfWelds: 2
        },
        momentCapacity: 600,
        shearCapacity: 350
    },

    // Welded Connections
    'FILLET_WELD_6MM': {
        type: 'WELDED_FILLET',
        location: 'brace',
        weldDetails: {
            weldType: 'fillet',
            weldSize: 6,
            weldLength: 100,
            electrode: 'E70XX',
            numberOfWelds: 4
        },
        shearCapacity: 180,
        axialCapacity: 250
    },

    // Base Plate Connections
    'BASEPLATE_PINNED_4ANCHOR': {
        type: 'BASE_PLATE_PINNED',
        location: 'column-base',
        basePlateDetails: {
            width: 300,
            length: 400,
            thickness: 20,
            anchorBoltDiameter: 24,
            anchorBoltGrade: '4.6',
            numberOfAnchors: 4,
            anchorLayout: 'rectangular',
            embedmentDepth: 300,
            groutThickness: 25
        },
        shearCapacity: 150,
        axialCapacity: 800
    },

    'BASEPLATE_FIXED_8ANCHOR': {
        type: 'BASE_PLATE_FIXED',
        location: 'column-base',
        basePlateDetails: {
            width: 450,
            length: 600,
            thickness: 32,
            anchorBoltDiameter: 30,
            anchorBoltGrade: '8.8',
            numberOfAnchors: 8,
            anchorLayout: 'rectangular',
            embedmentDepth: 450,
            groutThickness: 30
        },
        momentCapacity: 350,
        shearCapacity: 280,
        axialCapacity: 1500
    }
};

// ============================================
// CONNECTION CAPACITY CALCULATION HELPERS
// ============================================

/**
 * Calculate bolt shear capacity (IS 800:2007)
 */
export function calculateBoltShearCapacity(
    diameter: number,
    grade: BoltGrade,
    numberOfBolts: number,
    shearPlanes: number = 1,
    threadsInShearPlane: boolean = true
): number {
    const boltSpec = BOLT_SPECIFICATIONS[grade];
    const An = BOLT_TENSILE_AREAS[diameter] || (Math.PI * diameter * diameter / 4);

    // As per IS 800:2007 Clause 10.3.3
    const nn = threadsInShearPlane ? 1 : 0;
    const ns = shearPlanes - nn;
    const Anb = 0.78 * An;  // Shear area at threads
    const Asb = An;         // Shear area at shank

    // Vdsb = fu * (nn * Anb + ns * Asb) / (√3 * γmb)
    const gamma_mb = 1.25;  // Partial safety factor
    const Vdsb = boltSpec.fu * (nn * Anb + ns * Asb) / (Math.sqrt(3) * gamma_mb);

    return (Vdsb * numberOfBolts) / 1000;  // Convert to kN
}

/**
 * Calculate bolt tension capacity (IS 800:2007)
 */
export function calculateBoltTensionCapacity(
    diameter: number,
    grade: BoltGrade,
    numberOfBolts: number
): number {
    const boltSpec = BOLT_SPECIFICATIONS[grade];
    const An = BOLT_TENSILE_AREAS[diameter] || (Math.PI * diameter * diameter / 4);

    // As per IS 800:2007 Clause 10.3.5
    const gamma_mb = 1.25;
    const Tdb = 0.9 * boltSpec.fu * An / gamma_mb;

    return (Tdb * numberOfBolts) / 1000;  // Convert to kN
}

/**
 * Calculate fillet weld capacity (IS 800:2007)
 */
export function calculateFilletWeldCapacity(
    size: number,           // leg size in mm
    length: number,         // effective length in mm
    electrode: string = 'E70XX'
): number {
    const electrodeSpec = ELECTRODE_STRENGTHS[electrode] || { fuw: 410 };

    // Effective throat thickness = 0.7 * size
    const t_t = 0.7 * size;

    // As per IS 800:2007 Clause 10.5.7
    const gamma_mw = 1.25;  // Partial safety factor for shop weld

    // Design strength of weld per unit length
    // Rdw = 0.7 * size * fuw / (√3 * γmw)
    const f_wd = electrodeSpec.fuw / (Math.sqrt(3) * gamma_mw);
    const Rdw = t_t * f_wd * length;

    return Rdw / 1000;  // Convert to kN
}

/**
 * Get connection display properties for 3D rendering
 */
export function getConnectionVisualProperties(connection: Connection): {
    color: string;
    size: number;
    shape: 'sphere' | 'cylinder' | 'box';
    label: string;
} {
    const baseSize = 0.05;  // 50mm base size

    switch (connection.type) {
        case 'BOLTED_SIMPLE':
            return {
                color: '#4CAF50',  // Green
                size: baseSize,
                shape: 'cylinder',
                label: 'Simple'
            };
        case 'BOLTED_MOMENT':
        case 'BOLTED_SLIP_CRITICAL':
            return {
                color: '#2196F3',  // Blue
                size: baseSize * 1.2,
                shape: 'box',
                label: 'Moment'
            };
        case 'WELDED_FILLET':
        case 'WELDED_FULL_PEN':
        case 'WELDED_PARTIAL_PEN':
            return {
                color: '#FF9800',  // Orange
                size: baseSize * 1.1,
                shape: 'cylinder',
                label: 'Welded'
            };
        case 'PINNED':
            return {
                color: '#9C27B0',  // Purple
                size: baseSize * 0.8,
                shape: 'sphere',
                label: 'Pinned'
            };
        case 'RIGID':
            return {
                color: '#F44336',  // Red
                size: baseSize * 1.3,
                shape: 'box',
                label: 'Rigid'
            };
        case 'BASE_PLATE_PINNED':
        case 'BASE_PLATE_FIXED':
            return {
                color: '#795548',  // Brown
                size: baseSize * 1.5,
                shape: 'box',
                label: 'Base'
            };
        default:
            return {
                color: '#9E9E9E',  // Gray
                size: baseSize,
                shape: 'sphere',
                label: 'Unknown'
            };
    }
}

// Export types and utilities
export default {
    CONNECTION_TEMPLATES,
    BOLT_SPECIFICATIONS,
    ELECTRODE_STRENGTHS,
    STANDARD_BOLT_DIAMETERS,
    calculateBoltShearCapacity,
    calculateBoltTensionCapacity,
    calculateFilletWeldCapacity,
    getConnectionVisualProperties
};
