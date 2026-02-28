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
    E: number;           // Young's Modulus (MPa) — converted to kN/m² (*1e3) before storage in model
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
        id: 'ISMB450',
        name: 'ISMB 450',
        type: 'ISMB',
        A: 9220,
        d: 450,
        bf: 150,
        tf: 17.4,
        tw: 9.4,
        Ix: 303.9e6,
        Iy: 8.09e6,
        J: 844e3,
        Sx: 1350.7e3,
        Sy: 107.9e3,
        Zx: 1538e3,
        Zy: 165e3,
        rx: 182,
        ry: 29.6,
        weight: 72.4
    },
    {
        id: 'ISMB500',
        name: 'ISMB 500',
        type: 'ISMB',
        A: 11000,
        d: 500,
        bf: 180,
        tf: 17.2,
        tw: 10.2,
        Ix: 452.2e6,
        Iy: 13.7e6,
        J: 1040e3,
        Sx: 1808.7e3,
        Sy: 152.0e3,
        Zx: 2060e3,
        Zy: 232e3,
        rx: 203,
        ry: 35.2,
        weight: 86.9
    },
    {
        id: 'ISMB550',
        name: 'ISMB 550',
        type: 'ISMB',
        A: 13200,
        d: 550,
        bf: 190,
        tf: 19.3,
        tw: 11.2,
        Ix: 649.5e6,
        Iy: 18.0e6,
        J: 1560e3,
        Sx: 2362e3,
        Sy: 189.0e3,
        Zx: 2690e3,
        Zy: 289e3,
        rx: 222,
        ry: 36.9,
        weight: 103.7
    },
    {
        id: 'ISMB600',
        name: 'ISMB 600',
        type: 'ISMB',
        A: 15600,
        d: 600,
        bf: 210,
        tf: 20.8,
        tw: 12.0,
        Ix: 918.1e6,
        Iy: 26.5e6,
        J: 2150e3,
        Sx: 3060.3e3,
        Sy: 252.4e3,
        Zx: 3486e3,
        Zy: 386e3,
        rx: 243,
        ry: 41.2,
        weight: 122.6
    },

    // Indian Standard Channel Sections (ISMC)
    {
        id: 'ISMC75',
        name: 'ISMC 75',
        type: 'ISMC',
        A: 873,
        d: 75,
        bf: 40,
        tf: 7.3,
        tw: 4.4,
        Ix: 0.763e6,
        Iy: 0.128e6,
        J: 6.5e3,
        Sx: 20.3e3,
        Sy: 4.8e3,
        Zx: 23.1e3,
        Zy: 7.4e3,
        rx: 29.6,
        ry: 12.1,
        weight: 6.8
    },
    {
        id: 'ISMC100',
        name: 'ISMC 100',
        type: 'ISMC',
        A: 1170,
        d: 100,
        bf: 50,
        tf: 7.5,
        tw: 4.7,
        Ix: 1.87e6,
        Iy: 0.26e6,
        J: 11.4e3,
        Sx: 37.4e3,
        Sy: 7.7e3,
        Zx: 42.6e3,
        Zy: 11.8e3,
        rx: 40.0,
        ry: 14.9,
        weight: 9.2
    },
    {
        id: 'ISMC150',
        name: 'ISMC 150',
        type: 'ISMC',
        A: 2090,
        d: 150,
        bf: 75,
        tf: 9.0,
        tw: 5.4,
        Ix: 7.88e6,
        Iy: 1.03e6,
        J: 35.4e3,
        Sx: 105.1e3,
        Sy: 20.6e3,
        Zx: 120e3,
        Zy: 31.5e3,
        rx: 61.4,
        ry: 22.2,
        weight: 16.4
    },
    {
        id: 'ISMC200',
        name: 'ISMC 200',
        type: 'ISMC',
        A: 2820,
        d: 200,
        bf: 75,
        tf: 11.4,
        tw: 6.1,
        Ix: 18.16e6,
        Iy: 1.41e6,
        J: 76.4e3,
        Sx: 181.6e3,
        Sy: 27.6e3,
        Zx: 207e3,
        Zy: 42.2e3,
        rx: 80.3,
        ry: 22.4,
        weight: 22.1
    },
    {
        id: 'ISMC250',
        name: 'ISMC 250',
        type: 'ISMC',
        A: 3670,
        d: 250,
        bf: 80,
        tf: 14.1,
        tw: 7.1,
        Ix: 40.0e6,
        Iy: 2.0e6,
        J: 143e3,
        Sx: 320.0e3,
        Sy: 37.0e3,
        Zx: 365e3,
        Zy: 56.6e3,
        rx: 104,
        ry: 23.3,
        weight: 30.4
    },
    {
        id: 'ISMC300',
        name: 'ISMC 300',
        type: 'ISMC',
        A: 4560,
        d: 300,
        bf: 90,
        tf: 13.6,
        tw: 7.6,
        Ix: 63.6e6,
        Iy: 3.1e6,
        J: 176e3,
        Sx: 424.0e3,
        Sy: 51.0e3,
        Zx: 483e3,
        Zy: 78.0e3,
        rx: 118,
        ry: 26.1,
        weight: 35.8
    },
    {
        id: 'ISMC400',
        name: 'ISMC 400',
        type: 'ISMC',
        A: 6270,
        d: 400,
        bf: 100,
        tf: 15.3,
        tw: 8.6,
        Ix: 150.3e6,
        Iy: 5.08e6,
        J: 315e3,
        Sx: 751.0e3,
        Sy: 75.0e3,
        Zx: 856e3,
        Zy: 115e3,
        rx: 155,
        ry: 28.5,
        weight: 49.2
    },

    // Indian Standard Light Beams (ISLB)
    {
        id: 'ISLB100',
        name: 'ISLB 100',
        type: 'ISLB',
        A: 800,
        d: 100,
        bf: 50,
        tf: 5.0,
        tw: 4.0,
        Ix: 1.25e6,
        Iy: 0.1e6,
        J: 4.3e3,
        Sx: 25.0e3,
        Sy: 4.0e3,
        Zx: 28.5e3,
        Zy: 6.1e3,
        rx: 39.5,
        ry: 11.2,
        weight: 6.3
    },
    {
        id: 'ISLB150',
        name: 'ISLB 150',
        type: 'ISLB',
        A: 1260,
        d: 150,
        bf: 75,
        tf: 5.4,
        tw: 4.8,
        Ix: 4.49e6,
        Iy: 0.43e6,
        J: 16.8e3,
        Sx: 59.9e3,
        Sy: 11.5e3,
        Zx: 68.3e3,
        Zy: 17.6e3,
        rx: 59.7,
        ry: 18.5,
        weight: 9.9
    },
    {
        id: 'ISLB200',
        name: 'ISLB 200',
        type: 'ISLB',
        A: 1870,
        d: 200,
        bf: 100,
        tf: 6.1,
        tw: 5.4,
        Ix: 11.69e6,
        Iy: 1.04e6,
        J: 34.5e3,
        Sx: 116.9e3,
        Sy: 20.8e3,
        Zx: 133e3,
        Zy: 31.8e3,
        rx: 79.1,
        ry: 23.6,
        weight: 14.7
    },
    {
        id: 'ISLB225',
        name: 'ISLB 225',
        type: 'ISLB',
        A: 2340,
        d: 225,
        bf: 100,
        tf: 8.6,
        tw: 5.8,
        Ix: 18.88e6,
        Iy: 1.18e6,
        J: 60.1e3,
        Sx: 167.8e3,
        Sy: 23.5e3,
        Zx: 191e3,
        Zy: 36.0e3,
        rx: 89.8,
        ry: 22.5,
        weight: 18.3
    },
    {
        id: 'ISLB250',
        name: 'ISLB 250',
        type: 'ISLB',
        A: 2710,
        d: 250,
        bf: 125,
        tf: 6.9,
        tw: 5.5,
        Ix: 26.49e6,
        Iy: 2.06e6,
        J: 57.3e3,
        Sx: 211.9e3,
        Sy: 33.0e3,
        Zx: 241e3,
        Zy: 50.5e3,
        rx: 98.8,
        ry: 27.6,
        weight: 21.3
    },
    {
        id: 'ISLB300',
        name: 'ISLB 300',
        type: 'ISLB',
        A: 3590,
        d: 300,
        bf: 150,
        tf: 7.6,
        tw: 5.7,
        Ix: 49.05e6,
        Iy: 4.17e6,
        J: 98.1e3,
        Sx: 327.0e3,
        Sy: 55.6e3,
        Zx: 373e3,
        Zy: 85.0e3,
        rx: 117,
        ry: 34.1,
        weight: 28.2
    },
    {
        id: 'ISLB350',
        name: 'ISLB 350',
        type: 'ISLB',
        A: 4490,
        d: 350,
        bf: 165,
        tf: 8.5,
        tw: 6.0,
        Ix: 79.76e6,
        Iy: 6.31e6,
        J: 147e3,
        Sx: 455.8e3,
        Sy: 76.5e3,
        Zx: 519e3,
        Zy: 117e3,
        rx: 133,
        ry: 37.5,
        weight: 35.3
    },
    {
        id: 'ISLB400',
        name: 'ISLB 400',
        type: 'ISLB',
        A: 5480,
        d: 400,
        bf: 165,
        tf: 12.5,
        tw: 8.0,
        Ix: 121.2e6,
        Iy: 7.16e6,
        J: 296e3,
        Sx: 606.0e3,
        Sy: 86.8e3,
        Zx: 690e3,
        Zy: 133e3,
        rx: 149,
        ry: 36.2,
        weight: 43.0
    },
    {
        id: 'ISLB450',
        name: 'ISLB 450',
        type: 'ISLB',
        A: 6500,
        d: 450,
        bf: 170,
        tf: 13.4,
        tw: 8.6,
        Ix: 177.4e6,
        Iy: 8.72e6,
        J: 409e3,
        Sx: 788.4e3,
        Sy: 102.6e3,
        Zx: 898e3,
        Zy: 157e3,
        rx: 165,
        ry: 36.6,
        weight: 51.0
    },

    // Indian Standard Heavy Beams (ISHB)
    {
        id: 'ISHB150',
        name: 'ISHB 150',
        type: 'ISHB',
        A: 2920,
        d: 150,
        bf: 150,
        tf: 9.0,
        tw: 5.4,
        Ix: 14.61e6,
        Iy: 5.01e6,
        J: 86.5e3,
        Sx: 194.8e3,
        Sy: 66.8e3,
        Zx: 222e3,
        Zy: 102e3,
        rx: 70.7,
        ry: 41.4,
        weight: 27.1
    },
    {
        id: 'ISHB200',
        name: 'ISHB 200',
        type: 'ISHB',
        A: 4680,
        d: 200,
        bf: 200,
        tf: 9.0,
        tw: 6.1,
        Ix: 36.16e6,
        Iy: 12.01e6,
        J: 143e3,
        Sx: 361.6e3,
        Sy: 120.1e3,
        Zx: 412e3,
        Zy: 184e3,
        rx: 87.9,
        ry: 50.7,
        weight: 40.0
    },
    {
        id: 'ISHB225',
        name: 'ISHB 225',
        type: 'ISHB',
        A: 5490,
        d: 225,
        bf: 225,
        tf: 9.1,
        tw: 6.5,
        Ix: 52.98e6,
        Iy: 17.14e6,
        J: 182e3,
        Sx: 471.0e3,
        Sy: 152.4e3,
        Zx: 537e3,
        Zy: 233e3,
        rx: 98.2,
        ry: 55.9,
        weight: 46.8
    },
    {
        id: 'ISHB250',
        name: 'ISHB 250',
        type: 'ISHB',
        A: 6500,
        d: 250,
        bf: 250,
        tf: 9.7,
        tw: 6.9,
        Ix: 77.18e6,
        Iy: 25.5e6,
        J: 248e3,
        Sx: 617.4e3,
        Sy: 204.0e3,
        Zx: 703e3,
        Zy: 312e3,
        rx: 109,
        ry: 62.6,
        weight: 54.7
    },
    {
        id: 'ISHB300',
        name: 'ISHB 300',
        type: 'ISHB',
        A: 7480,
        d: 300,
        bf: 250,
        tf: 10.6,
        tw: 7.6,
        Ix: 125.5e6,
        Iy: 27.9e6,
        J: 352e3,
        Sx: 836.7e3,
        Sy: 223.2e3,
        Zx: 953e3,
        Zy: 341e3,
        rx: 130,
        ry: 61.1,
        weight: 63.0
    },
    {
        id: 'ISHB350',
        name: 'ISHB 350',
        type: 'ISHB',
        A: 8510,
        d: 350,
        bf: 250,
        tf: 11.6,
        tw: 8.3,
        Ix: 186.9e6,
        Iy: 30.2e6,
        J: 472e3,
        Sx: 1068e3,
        Sy: 241.6e3,
        Zx: 1217e3,
        Zy: 370e3,
        rx: 148,
        ry: 59.6,
        weight: 72.4
    },
    {
        id: 'ISHB400',
        name: 'ISHB 400',
        type: 'ISHB',
        A: 9750,
        d: 400,
        bf: 250,
        tf: 12.7,
        tw: 9.1,
        Ix: 268.0e6,
        Iy: 32.68e6,
        J: 624e3,
        Sx: 1340e3,
        Sy: 261.4e3,
        Zx: 1527e3,
        Zy: 400e3,
        rx: 166,
        ry: 57.9,
        weight: 82.2
    },
    {
        id: 'ISHB450',
        name: 'ISHB 450',
        type: 'ISHB',
        A: 11100,
        d: 450,
        bf: 250,
        tf: 13.7,
        tw: 9.8,
        Ix: 374.5e6,
        Iy: 35.17e6,
        J: 803e3,
        Sx: 1664.4e3,
        Sy: 281.4e3,
        Zx: 1896e3,
        Zy: 430e3,
        rx: 184,
        ry: 56.3,
        weight: 92.5
    },

    // Standard RCC Beam Sections
    {
        id: 'RCC-230x300',
        name: 'RCC Beam 230×300',
        type: 'RECT-CONCRETE',
        A: 69000,
        b: 230,
        h: 300,
        Ix: 517.5e6,
        Iy: 304.3e6,
        J: 619.2e6,
        Sx: 3450e3,
        Sy: 2646e3,
        Zx: 5175e3,
        Zy: 3969e3,
        rx: 86.6,
        ry: 66.4,
        weight: 172.5
    },
    {
        id: 'RCC-230x450',
        name: 'RCC Beam 230×450',
        type: 'RECT-CONCRETE',
        A: 103500,
        b: 230,
        h: 450,
        Ix: 1745.4e6,
        Iy: 456.5e6,
        J: 1662e6,
        Sx: 7757e3,
        Sy: 3969e3,
        Zx: 11636e3,
        Zy: 5954e3,
        rx: 130,
        ry: 66.4,
        weight: 258.75
    },
    {
        id: 'RCC-230x600',
        name: 'RCC Beam 230×600',
        type: 'RECT-CONCRETE',
        A: 138000,
        b: 230,
        h: 600,
        Ix: 4140e6,
        Iy: 608.6e6,
        J: 3580e6,
        Sx: 13800e3,
        Sy: 5292e3,
        Zx: 20700e3,
        Zy: 7938e3,
        rx: 173.2,
        ry: 66.4,
        weight: 345
    },
    {
        id: 'RCC-300x450',
        name: 'RCC Beam 300×450',
        type: 'RECT-CONCRETE',
        A: 135000,
        b: 300,
        h: 450,
        Ix: 2278.1e6,
        Iy: 1012.5e6,
        J: 2486e6,
        Sx: 10125e3,
        Sy: 6750e3,
        Zx: 15187e3,
        Zy: 10125e3,
        rx: 130,
        ry: 86.6,
        weight: 337.5
    },
    {
        id: 'RCC-300x600',
        name: 'RCC Beam 300×600',
        type: 'RECT-CONCRETE',
        A: 180000,
        b: 300,
        h: 600,
        Ix: 5400e6,
        Iy: 1350e6,
        J: 5063e6,
        Sx: 18000e3,
        Sy: 9000e3,
        Zx: 27000e3,
        Zy: 13500e3,
        rx: 173.2,
        ry: 86.6,
        weight: 450
    },
    {
        id: 'RCC-350x700',
        name: 'RCC Beam 350×700',
        type: 'RECT-CONCRETE',
        A: 245000,
        b: 350,
        h: 700,
        Ix: 10004.2e6,
        Iy: 2501e6,
        J: 9380e6,
        Sx: 28583e3,
        Sy: 14291e3,
        Zx: 42875e3,
        Zy: 21437e3,
        rx: 202.1,
        ry: 101.0,
        weight: 612.5
    },

    // Standard RCC Column Sections
    {
        id: 'RCC-COL-300x300',
        name: 'RCC Column 300×300',
        type: 'RECT-CONCRETE',
        A: 90000,
        b: 300,
        h: 300,
        Ix: 675e6,
        Iy: 675e6,
        J: 1012.5e6,
        Sx: 4500e3,
        Sy: 4500e3,
        Zx: 6750e3,
        Zy: 6750e3,
        rx: 86.6,
        ry: 86.6,
        weight: 225
    },
    {
        id: 'RCC-COL-350x350',
        name: 'RCC Column 350×350',
        type: 'RECT-CONCRETE',
        A: 122500,
        b: 350,
        h: 350,
        Ix: 1251e6,
        Iy: 1251e6,
        J: 1876.6e6,
        Sx: 7146e3,
        Sy: 7146e3,
        Zx: 10719e3,
        Zy: 10719e3,
        rx: 101.0,
        ry: 101.0,
        weight: 306.25
    },
    {
        id: 'RCC-COL-400x400',
        name: 'RCC Column 400×400',
        type: 'RECT-CONCRETE',
        A: 160000,
        b: 400,
        h: 400,
        Ix: 2133.3e6,
        Iy: 2133.3e6,
        J: 3200e6,
        Sx: 10667e3,
        Sy: 10667e3,
        Zx: 16000e3,
        Zy: 16000e3,
        rx: 115.5,
        ry: 115.5,
        weight: 400
    },
    {
        id: 'RCC-COL-450x450',
        name: 'RCC Column 450×450',
        type: 'RECT-CONCRETE',
        A: 202500,
        b: 450,
        h: 450,
        Ix: 3417.2e6,
        Iy: 3417.2e6,
        J: 5125.8e6,
        Sx: 15188e3,
        Sy: 15188e3,
        Zx: 22781e3,
        Zy: 22781e3,
        rx: 130,
        ry: 130,
        weight: 506.25
    },
    {
        id: 'RCC-COL-500x500',
        name: 'RCC Column 500×500',
        type: 'RECT-CONCRETE',
        A: 250000,
        b: 500,
        h: 500,
        Ix: 5208.3e6,
        Iy: 5208.3e6,
        J: 7812.5e6,
        Sx: 20833e3,
        Sy: 20833e3,
        Zx: 31250e3,
        Zy: 31250e3,
        rx: 144.3,
        ry: 144.3,
        weight: 625
    },
    {
        id: 'RCC-COL-600x600',
        name: 'RCC Column 600×600',
        type: 'RECT-CONCRETE',
        A: 360000,
        b: 600,
        h: 600,
        Ix: 10800e6,
        Iy: 10800e6,
        J: 16200e6,
        Sx: 36000e3,
        Sy: 36000e3,
        Zx: 54000e3,
        Zy: 54000e3,
        rx: 173.2,
        ry: 173.2,
        weight: 900
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
