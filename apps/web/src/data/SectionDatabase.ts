/**
 * SectionDatabase.ts - Comprehensive Section Properties Database
 * 
 * Contains:
 * - Standard steel sections (AISC, IS, European)
 * - Concrete sections
 * - Custom section input capabilities
 * - Section property calculations
 */

// ============================================
// MATERIAL PROPERTIES
// ============================================

export interface Material {
    id: string;
    name: string;
    type: 'steel' | 'concrete' | 'timber' | 'aluminum' | 'custom';
    E: number;           // Young's Modulus (MPa or kN/m²)
    G?: number;          // Shear Modulus (MPa)
    fy?: number;         // Yield Strength (MPa) - for steel
    fu?: number;         // Ultimate Strength (MPa) - for steel
    fck?: number;        // Characteristic Compressive Strength (MPa) - for concrete
    fcd?: number;        // Design Compressive Strength (MPa) - for concrete
    density: number;     // kg/m³
    poissonsRatio: number;
    thermalCoeff?: number; // Coefficient of thermal expansion
}

// Standard Materials Database
export const MATERIALS_DATABASE: Material[] = [
    // Steel Grades
    {
        id: 'steel-fe250',
        name: 'Steel Fe 250 (IS 2062)',
        type: 'steel',
        E: 200000,        // MPa
        G: 77000,
        fy: 250,
        fu: 410,
        density: 7850,
        poissonsRatio: 0.3,
        thermalCoeff: 12e-6
    },
    {
        id: 'steel-fe410',
        name: 'Steel Fe 410 (IS 2062)',
        type: 'steel',
        E: 200000,
        G: 77000,
        fy: 250,
        fu: 410,
        density: 7850,
        poissonsRatio: 0.3,
        thermalCoeff: 12e-6
    },
    {
        id: 'steel-a36',
        name: 'ASTM A36',
        type: 'steel',
        E: 200000,
        G: 77000,
        fy: 250,
        fu: 400,
        density: 7850,
        poissonsRatio: 0.3,
        thermalCoeff: 11.7e-6
    },
    {
        id: 'steel-a992',
        name: 'ASTM A992 (Grade 50)',
        type: 'steel',
        E: 200000,
        G: 77000,
        fy: 345,
        fu: 450,
        density: 7850,
        poissonsRatio: 0.3,
        thermalCoeff: 11.7e-6
    },
    {
        id: 'steel-s275',
        name: 'S275 (EN 10025)',
        type: 'steel',
        E: 210000,
        G: 81000,
        fy: 275,
        fu: 430,
        density: 7850,
        poissonsRatio: 0.3,
        thermalCoeff: 12e-6
    },
    {
        id: 'steel-s355',
        name: 'S355 (EN 10025)',
        type: 'steel',
        E: 210000,
        G: 81000,
        fy: 355,
        fu: 510,
        density: 7850,
        poissonsRatio: 0.3,
        thermalCoeff: 12e-6
    },
    // Concrete Grades
    {
        id: 'concrete-m20',
        name: 'Concrete M20',
        type: 'concrete',
        E: 22360,        // 5000 * sqrt(fck)
        fck: 20,
        fcd: 8.93,       // 0.446 * fck
        density: 2500,
        poissonsRatio: 0.2,
        thermalCoeff: 10e-6
    },
    {
        id: 'concrete-m25',
        name: 'Concrete M25',
        type: 'concrete',
        E: 25000,
        fck: 25,
        fcd: 11.17,
        density: 2500,
        poissonsRatio: 0.2,
        thermalCoeff: 10e-6
    },
    {
        id: 'concrete-m30',
        name: 'Concrete M30',
        type: 'concrete',
        E: 27386,
        fck: 30,
        fcd: 13.4,
        density: 2500,
        poissonsRatio: 0.2,
        thermalCoeff: 10e-6
    },
    {
        id: 'concrete-m40',
        name: 'Concrete M40',
        type: 'concrete',
        E: 31623,
        fck: 40,
        fcd: 17.87,
        density: 2500,
        poissonsRatio: 0.2,
        thermalCoeff: 10e-6
    },
    {
        id: 'concrete-4000psi',
        name: "Concrete f'c = 4000 psi",
        type: 'concrete',
        E: 25742,        // 57000 * sqrt(f'c) in psi, converted
        fck: 27.6,       // 4000 psi in MPa
        density: 2400,
        poissonsRatio: 0.2,
        thermalCoeff: 9.9e-6
    }
];

// ============================================
// SECTION TYPES
// ============================================

export type SectionType =
    | 'W' | 'S' | 'HP'           // Wide Flange (AISC)
    | 'C' | 'MC'                  // Channel
    | 'L'                         // Angle
    | 'HSS-RECT' | 'HSS-ROUND'   // Hollow Structural Sections
    | 'PIPE'                      // Pipe
    | 'ISMB' | 'ISMC' | 'ISLB' | 'ISJB' | 'ISHB'  // Indian Standard
    | 'IPE' | 'HEA' | 'HEB' | 'UPN'  // European
    | 'RECT-CONCRETE' | 'CIRC-CONCRETE' | 'T-CONCRETE'  // Concrete
    | 'CUSTOM';

export interface SectionProperties {
    id: string;
    name: string;
    type: SectionType;

    // Geometric Properties
    A: number;          // Area (mm² or m²)
    Ix: number;         // Moment of Inertia about X-X (mm⁴ or m⁴)
    Iy: number;         // Moment of Inertia about Y-Y (mm⁴ or m⁴)
    J: number;          // Torsional Constant (mm⁴ or m⁴)
    Sx: number;         // Section Modulus X-X (mm³ or m³)
    Sy: number;         // Section Modulus Y-Y (mm³ or m³)
    Zx: number;         // Plastic Section Modulus X-X (mm³ or m³)
    Zy: number;         // Plastic Section Modulus Y-Y (mm³ or m³)
    rx: number;         // Radius of Gyration X-X (mm or m)
    ry: number;         // Radius of Gyration Y-Y (mm or m)
    Cw?: number;        // Warping Constant (mm⁶)

    // Dimensions (varies by section type)
    d?: number;         // Depth
    bf?: number;        // Flange width
    tf?: number;        // Flange thickness
    tw?: number;        // Web thickness
    b?: number;         // Width (for rectangular/box)
    h?: number;         // Height
    t?: number;         // Thickness (for hollow sections)
    D?: number;         // Diameter (for circular)

    // Weight
    weight: number;     // kg/m

    // Classification (for steel design)
    classification?: 'compact' | 'noncompact' | 'slender';
}

// ============================================
// STANDARD STEEL SECTIONS DATABASE
// ============================================

export const STEEL_SECTIONS: SectionProperties[] = [
    // AISC W Shapes (Wide Flange)
    {
        id: 'W14x22',
        name: 'W14×22',
        type: 'W',
        A: 4180,        // mm²
        d: 350,
        bf: 127,
        tf: 8.5,
        tw: 5.8,
        Ix: 82.8e6,     // mm⁴
        Iy: 4.39e6,
        J: 64.9e3,
        Sx: 473e3,      // mm³
        Sy: 69.1e3,
        Zx: 536e3,
        Zy: 106e3,
        rx: 141,        // mm
        ry: 32.5,
        weight: 32.7
    },
    {
        id: 'W14x30',
        name: 'W14×30',
        type: 'W',
        A: 5680,
        d: 353,
        bf: 171,
        tf: 9.8,
        tw: 6.9,
        Ix: 123e6,
        Iy: 12.1e6,
        J: 124e3,
        Sx: 697e3,
        Sy: 142e3,
        Zx: 781e3,
        Zy: 218e3,
        rx: 147,
        ry: 46.2,
        weight: 44.5
    },
    {
        id: 'W16x40',
        name: 'W16×40',
        type: 'W',
        A: 7610,
        d: 407,
        bf: 178,
        tf: 12.8,
        tw: 7.7,
        Ix: 216e6,
        Iy: 16.5e6,
        J: 310e3,
        Sx: 1060e3,
        Sy: 185e3,
        Zx: 1200e3,
        Zy: 286e3,
        rx: 168,
        ry: 46.7,
        weight: 59.5
    },
    {
        id: 'W18x50',
        name: 'W18×50',
        type: 'W',
        A: 9480,
        d: 457,
        bf: 191,
        tf: 14.5,
        tw: 9.0,
        Ix: 345e6,
        Iy: 22.5e6,
        J: 524e3,
        Sx: 1510e3,
        Sy: 236e3,
        Zx: 1720e3,
        Zy: 364e3,
        rx: 191,
        ry: 48.8,
        weight: 74.4
    },
    {
        id: 'W21x62',
        name: 'W21×62',
        type: 'W',
        A: 11800,
        d: 533,
        bf: 209,
        tf: 15.6,
        tw: 10.2,
        Ix: 554e6,
        Iy: 30.5e6,
        J: 854e3,
        Sx: 2080e3,
        Sy: 291e3,
        Zx: 2360e3,
        Zy: 449e3,
        rx: 217,
        ry: 50.8,
        weight: 92.1
    },
    {
        id: 'W24x76',
        name: 'W24×76',
        type: 'W',
        A: 14500,
        d: 610,
        bf: 229,
        tf: 17.3,
        tw: 11.2,
        Ix: 870e6,
        Iy: 45.7e6,
        J: 1450e3,
        Sx: 2850e3,
        Sy: 399e3,
        Zx: 3230e3,
        Zy: 615e3,
        rx: 245,
        ry: 56.1,
        weight: 113
    },

    // Indian Standard Sections (ISMB)
    {
        id: 'ISMB100',
        name: 'ISMB 100',
        type: 'ISMB',
        A: 1140,
        d: 100,
        bf: 75,
        tf: 7.2,
        tw: 4.0,
        Ix: 2.57e6,
        Iy: 0.409e6,
        J: 13.1e3,
        Sx: 51.4e3,
        Sy: 10.9e3,
        Zx: 58.5e3,
        Zy: 16.7e3,
        rx: 47.5,
        ry: 18.9,
        weight: 8.9
    },
    {
        id: 'ISMB150',
        name: 'ISMB 150',
        type: 'ISMB',
        A: 1840,
        d: 150,
        bf: 80,
        tf: 7.6,
        tw: 4.8,
        Ix: 7.26e6,
        Iy: 0.529e6,
        J: 28.1e3,
        Sx: 96.8e3,
        Sy: 13.2e3,
        Zx: 111e3,
        Zy: 20.2e3,
        rx: 62.8,
        ry: 17.0,
        weight: 14.9
    },
    {
        id: 'ISMB200',
        name: 'ISMB 200',
        type: 'ISMB',
        A: 2850,
        d: 200,
        bf: 100,
        tf: 10.8,
        tw: 5.7,
        Ix: 22.35e6,
        Iy: 1.5e6,
        J: 73.6e3,
        Sx: 223.5e3,
        Sy: 30.0e3,
        Zx: 254e3,
        Zy: 46.0e3,
        rx: 88.5,
        ry: 22.9,
        weight: 25.4
    },
    {
        id: 'ISMB250',
        name: 'ISMB 250',
        type: 'ISMB',
        A: 4750,
        d: 250,
        bf: 125,
        tf: 12.5,
        tw: 6.9,
        Ix: 51.3e6,
        Iy: 3.34e6,
        J: 187e3,
        Sx: 410.4e3,
        Sy: 53.5e3,
        Zx: 467e3,
        Zy: 81.8e3,
        rx: 104,
        ry: 26.5,
        weight: 37.3
    },
    {
        id: 'ISMB300',
        name: 'ISMB 300',
        type: 'ISMB',
        A: 5870,
        d: 300,
        bf: 140,
        tf: 13.1,
        tw: 7.5,
        Ix: 86.0e6,
        Iy: 4.54e6,
        J: 316e3,
        Sx: 573.6e3,
        Sy: 64.9e3,
        Zx: 653e3,
        Zy: 99.3e3,
        rx: 121,
        ry: 27.8,
        weight: 46.1
    },
    {
        id: 'ISMB350',
        name: 'ISMB 350',
        type: 'ISMB',
        A: 6670,
        d: 350,
        bf: 140,
        tf: 14.2,
        tw: 8.1,
        Ix: 136.3e6,
        Iy: 5.38e6,
        J: 446e3,
        Sx: 778.9e3,
        Sy: 76.8e3,
        Zx: 887e3,
        Zy: 117e3,
        rx: 143,
        ry: 28.4,
        weight: 52.4
    },
    {
        id: 'ISMB400',
        name: 'ISMB 400',
        type: 'ISMB',
        A: 7840,
        d: 400,
        bf: 140,
        tf: 16.0,
        tw: 8.9,
        Ix: 204.6e6,
        Iy: 6.22e6,
        J: 665e3,
        Sx: 1023e3,
        Sy: 88.8e3,
        Zx: 1166e3,
        Zy: 136e3,
        rx: 162,
        ry: 28.2,
        weight: 61.6
    },

    // HSS Rectangular
    {
        id: 'HSS8x6x0.5',
        name: 'HSS 8×6×½',
        type: 'HSS-RECT',
        A: 5810,
        b: 152,
        h: 203,
        t: 12.7,
        Ix: 44.9e6,
        Iy: 28.5e6,
        J: 55.8e6,
        Sx: 442e3,
        Sy: 374e3,
        Zx: 524e3,
        Zy: 434e3,
        rx: 87.9,
        ry: 70.1,
        weight: 45.6
    },
    {
        id: 'HSS10x6x0.375',
        name: 'HSS 10×6×⅜',
        type: 'HSS-RECT',
        A: 4520,
        b: 152,
        h: 254,
        t: 9.53,
        Ix: 51.6e6,
        Iy: 23.5e6,
        J: 55.2e6,
        Sx: 406e3,
        Sy: 309e3,
        Zx: 479e3,
        Zy: 358e3,
        rx: 107,
        ry: 72.1,
        weight: 35.4
    },

    // European IPE Sections
    {
        id: 'IPE200',
        name: 'IPE 200',
        type: 'IPE',
        A: 2850,
        d: 200,
        bf: 100,
        tf: 8.5,
        tw: 5.6,
        Ix: 19.4e6,
        Iy: 1.42e6,
        J: 68.9e3,
        Sx: 194e3,
        Sy: 28.4e3,
        Zx: 220e3,
        Zy: 44.6e3,
        rx: 82.6,
        ry: 22.4,
        weight: 22.4
    },
    {
        id: 'IPE300',
        name: 'IPE 300',
        type: 'IPE',
        A: 5380,
        d: 300,
        bf: 150,
        tf: 10.7,
        tw: 7.1,
        Ix: 83.6e6,
        Iy: 6.04e6,
        J: 201e3,
        Sx: 557e3,
        Sy: 80.5e3,
        Zx: 628e3,
        Zy: 125e3,
        rx: 125,
        ry: 33.5,
        weight: 42.2
    },
    {
        id: 'HEA200',
        name: 'HEA 200',
        type: 'HEA',
        A: 5380,
        d: 190,
        bf: 200,
        tf: 10,
        tw: 6.5,
        Ix: 36.9e6,
        Iy: 13.4e6,
        J: 211e3,
        Sx: 389e3,
        Sy: 134e3,
        Zx: 429e3,
        Zy: 204e3,
        rx: 82.8,
        ry: 49.8,
        weight: 42.3
    }
];

// ============================================
// CONCRETE SECTION CALCULATOR
// ============================================

export interface RectangularConcreteSection {
    type: 'RECT-CONCRETE';
    b: number;          // Width (mm)
    h: number;          // Height (mm)
    cover: number;      // Clear cover (mm)
    // Reinforcement
    mainBars?: {
        diameter: number;   // mm
        count: number;
        position: 'top' | 'bottom' | 'distributed';
    }[];
    stirrups?: {
        diameter: number;
        spacing: number;
        legs: number;
    };
}

export interface CircularConcreteSection {
    type: 'CIRC-CONCRETE';
    D: number;          // Diameter (mm)
    cover: number;
    mainBars?: {
        diameter: number;
        count: number;
    };
    spirals?: {
        diameter: number;
        pitch: number;
    };
}

// Calculate section properties for rectangular concrete
export function calculateRectangularSection(b: number, h: number): SectionProperties {
    const A = b * h;
    const Ix = (b * Math.pow(h, 3)) / 12;
    const Iy = (h * Math.pow(b, 3)) / 12;
    const Sx = (b * Math.pow(h, 2)) / 6;
    const Sy = (h * Math.pow(b, 2)) / 6;
    const Zx = (b * Math.pow(h, 2)) / 4;
    const Zy = (h * Math.pow(b, 2)) / 4;
    const rx = h / Math.sqrt(12);
    const ry = b / Math.sqrt(12);

    // Torsional constant for rectangle (approximate)
    const a = Math.max(b, h) / 2;
    const _b = Math.min(b, h) / 2;
    const J = a * Math.pow(_b, 3) * (16 / 3 - 3.36 * _b / a * (1 - Math.pow(_b, 4) / (12 * Math.pow(a, 4))));

    return {
        id: `rect-${b}x${h}`,
        name: `Rectangular ${b}×${h} mm`,
        type: 'RECT-CONCRETE',
        A,
        Ix,
        Iy,
        J,
        Sx,
        Sy,
        Zx,
        Zy,
        rx,
        ry,
        b,
        h,
        weight: A * 2.5 / 1e6  // Assuming concrete density 2500 kg/m³
    };
}

// Calculate section properties for circular
export function calculateCircularSection(D: number): SectionProperties {
    const A = Math.PI * Math.pow(D, 2) / 4;
    const I = Math.PI * Math.pow(D, 4) / 64;
    const S = Math.PI * Math.pow(D, 3) / 32;
    const Z = Math.pow(D, 3) / 6;
    const r = D / 4;
    const J = Math.PI * Math.pow(D, 4) / 32;

    return {
        id: `circ-${D}`,
        name: `Circular Ø${D} mm`,
        type: 'CIRC-CONCRETE',
        A,
        Ix: I,
        Iy: I,
        J,
        Sx: S,
        Sy: S,
        Zx: Z,
        Zy: Z,
        rx: r,
        ry: r,
        D,
        weight: A * 2.5 / 1e6
    };
}

// Calculate I-section properties
export function calculateISection(d: number, bf: number, tf: number, tw: number): SectionProperties {
    // Area
    const A = 2 * bf * tf + (d - 2 * tf) * tw;

    // Moment of Inertia (parallel axis theorem)
    const Ix = (bf * Math.pow(d, 3) - (bf - tw) * Math.pow(d - 2 * tf, 3)) / 12;
    const Iy = (2 * tf * Math.pow(bf, 3) + (d - 2 * tf) * Math.pow(tw, 3)) / 12;

    // Section Modulus
    const Sx = Ix / (d / 2);
    const Sy = Iy / (bf / 2);

    // Plastic Section Modulus
    const Zx = bf * tf * (d - tf) + tw * Math.pow(d - 2 * tf, 2) / 4;
    const Zy = tf * Math.pow(bf, 2) / 2 + (d - 2 * tf) * Math.pow(tw, 2) / 4;

    // Radius of gyration
    const rx = Math.sqrt(Ix / A);
    const ry = Math.sqrt(Iy / A);

    // Torsional Constant (approximate for open section)
    const J = (2 * bf * Math.pow(tf, 3) + (d - 2 * tf) * Math.pow(tw, 3)) / 3;

    return {
        id: `I-${d}x${bf}x${tf}x${tw}`,
        name: `I-Section ${d}×${bf}×${tf}×${tw}`,
        type: 'CUSTOM',
        A,
        d,
        bf,
        tf,
        tw,
        Ix,
        Iy,
        J,
        Sx,
        Sy,
        Zx,
        Zy,
        rx,
        ry,
        weight: A * 7.85 / 1e6  // Steel density
    };
}

// ============================================
// REINFORCEMENT DATABASE
// ============================================

export interface RebarGrade {
    id: string;
    name: string;
    fy: number;     // Yield strength (MPa)
    fu: number;     // Ultimate strength (MPa)
    Es: number;     // Modulus of Elasticity (MPa)
}

export const REBAR_GRADES: RebarGrade[] = [
    { id: 'Fe415', name: 'Fe 415 (IS)', fy: 415, fu: 485, Es: 200000 },
    { id: 'Fe500', name: 'Fe 500 (IS)', fy: 500, fu: 545, Es: 200000 },
    { id: 'Fe550', name: 'Fe 550D (IS)', fy: 550, fu: 585, Es: 200000 },
    { id: 'Grade40', name: 'Grade 40 (ASTM)', fy: 280, fu: 420, Es: 200000 },
    { id: 'Grade60', name: 'Grade 60 (ASTM)', fy: 420, fu: 620, Es: 200000 },
    { id: 'Grade75', name: 'Grade 75 (ASTM)', fy: 520, fu: 690, Es: 200000 },
];

export const REBAR_SIZES: { diameter: number; area: number }[] = [
    { diameter: 6, area: 28.27 },
    { diameter: 8, area: 50.27 },
    { diameter: 10, area: 78.54 },
    { diameter: 12, area: 113.1 },
    { diameter: 16, area: 201.1 },
    { diameter: 20, area: 314.2 },
    { diameter: 25, area: 490.9 },
    { diameter: 28, area: 615.8 },
    { diameter: 32, area: 804.2 },
    { diameter: 36, area: 1017.9 },
    { diameter: 40, area: 1256.6 },
];

// ============================================
// HELPER FUNCTIONS
// ============================================

export function getMaterialById(id: string): Material | undefined {
    return MATERIALS_DATABASE.find(m => m.id === id);
}

export function getSectionById(id: string): SectionProperties | undefined {
    return STEEL_SECTIONS.find(s => s.id === id);
}

export function getSectionsByType(type: SectionType): SectionProperties[] {
    return STEEL_SECTIONS.filter(s => s.type === type);
}

export function getRebarGradeById(id: string): RebarGrade | undefined {
    return REBAR_GRADES.find(r => r.id === id);
}

export function getRebarArea(diameter: number, count: number): number {
    const rebar = REBAR_SIZES.find(r => r.diameter === diameter);
    return rebar ? rebar.area * count : Math.PI * Math.pow(diameter, 2) / 4 * count;
}

// Convert units
export function convertUnits(value: number, from: string, to: string): number {
    const conversions: Record<string, Record<string, number>> = {
        // Length
        'mm': { 'm': 0.001, 'cm': 0.1, 'in': 0.03937, 'ft': 0.003281 },
        'm': { 'mm': 1000, 'cm': 100, 'in': 39.37, 'ft': 3.281 },
        // Force
        'kN': { 'N': 1000, 'kgf': 101.97, 'lbf': 224.81, 'kip': 0.2248 },
        'N': { 'kN': 0.001, 'kgf': 0.10197, 'lbf': 0.2248 },
        // Stress
        'MPa': { 'kPa': 1000, 'psi': 145.04, 'ksi': 0.145 },
        'psi': { 'MPa': 0.006895, 'ksi': 0.001, 'kPa': 6.895 }
    };

    if (from === to) return value;
    return value * (conversions[from]?.[to] ?? 1);
}

export default {
    MATERIALS_DATABASE,
    STEEL_SECTIONS,
    REBAR_GRADES,
    REBAR_SIZES,
    getMaterialById,
    getSectionById,
    getSectionsByType,
    calculateRectangularSection,
    calculateCircularSection,
    calculateISection,
    convertUnits
};
