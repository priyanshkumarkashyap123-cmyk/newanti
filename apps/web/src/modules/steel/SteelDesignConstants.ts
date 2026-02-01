/**
 * ============================================================================
 * STEEL DESIGN CONSTANTS & SECTION DATABASE
 * ============================================================================
 * 
 * Comprehensive steel section properties and material constants for:
 * - IS 800:2007 (India)
 * - AISC 360-22 (USA)
 * - EN 1993-1-1:2005 (Europe - Eurocode 3)
 * - AS 4100:2020 (Australia)
 * 
 * Section Types:
 * - Hot-rolled I-sections (W, UB, UC, IPE, HEA, HEB)
 * - Channels (C, MC, UPN, PFC)
 * - Angles (L, Equal & Unequal)
 * - Hollow sections (RHS, SHS, CHS)
 * - Plates and built-up sections
 * 
 * @version 1.0.0
 * @author Head of Engineering
 */

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

export type SteelDesignCode = 'IS800' | 'AISC360' | 'EN1993' | 'AS4100';

export type SteelGradeType = 
  | 'E250' | 'E275' | 'E300' | 'E350' | 'E410' | 'E450'  // IS grades
  | 'A36' | 'A572-50' | 'A572-65' | 'A992' | 'A500B' | 'A500C'  // ASTM grades
  | 'S235' | 'S275' | 'S355' | 'S420' | 'S460'  // EN grades
  | 'Grade250' | 'Grade300' | 'Grade350' | 'Grade450';  // AS grades

export type SectionType = 
  | 'I-section' | 'H-section' | 'channel' | 'angle' 
  | 'T-section' | 'RHS' | 'SHS' | 'CHS' | 'plate' | 'built-up';

export type SectionClassification = 'Class1' | 'Class2' | 'Class3' | 'Class4';

// =============================================================================
// STEEL GRADE INTERFACE
// =============================================================================

export interface SteelGrade {
  designation: SteelGradeType;
  fy: number;              // Yield strength (MPa)
  fu: number;              // Ultimate tensile strength (MPa)
  E: number;               // Modulus of elasticity (MPa) - typically 200000-210000
  G: number;               // Shear modulus (MPa)
  nu: number;              // Poisson's ratio
  alpha: number;           // Coefficient of thermal expansion (per °C)
  density: number;         // Density (kg/m³)
  fy_thick?: number;       // Reduced fy for thick plates (t > 40mm)
}

// =============================================================================
// STEEL SECTION INTERFACE
// =============================================================================

export interface SteelSection {
  designation: string;
  type: SectionType;
  
  // Dimensions (mm)
  h: number;               // Overall depth
  b: number;               // Overall width (flange width for I/H)
  tw: number;              // Web thickness
  tf: number;              // Flange thickness
  r?: number;              // Root radius / corner radius
  r1?: number;             // Toe radius
  
  // For hollow sections
  t?: number;              // Wall thickness (for RHS/SHS/CHS)
  D?: number;              // Outer diameter (for CHS)
  
  // Section properties
  A: number;               // Area (mm²)
  Ix: number;              // Moment of inertia about x-x (mm⁴) - major axis
  Iy: number;              // Moment of inertia about y-y (mm⁴) - minor axis
  Zx: number;              // Elastic section modulus x-x (mm³)
  Zy: number;              // Elastic section modulus y-y (mm³)
  Zpx: number;             // Plastic section modulus x-x (mm³)
  Zpy: number;             // Plastic section modulus y-y (mm³)
  rx: number;              // Radius of gyration x-x (mm)
  ry: number;              // Radius of gyration y-y (mm)
  J: number;               // Torsional constant (mm⁴)
  Cw?: number;             // Warping constant (mm⁶)
  
  // For asymmetric sections
  cy?: number;             // Distance to centroid from back of web
  Ixy?: number;            // Product of inertia
  
  // Weight
  mass: number;            // Mass per meter (kg/m)
  
  // Classification helpers
  bf_2tf?: number;         // b/2tf ratio for I-sections
  hw_tw?: number;          // hw/tw ratio for I-sections
}

// =============================================================================
// BOLT & WELD INTERFACES
// =============================================================================

export interface BoltGrade {
  grade: string;
  fyb: number;             // Bolt yield strength (MPa)
  fub: number;             // Bolt ultimate strength (MPa)
}

export interface BoltSize {
  diameter: number;        // Nominal diameter (mm)
  area_gross: number;      // Gross area (mm²)
  area_tensile: number;    // Tensile stress area (mm²)
  area_shank: number;      // Shank area (mm²)
}

export interface WeldStrength {
  electrode: string;
  fuw: number;             // Weld metal ultimate strength (MPa)
}

// =============================================================================
// STEEL GRADES DATABASE
// =============================================================================

export const STEEL_GRADES: Record<SteelGradeType, SteelGrade> = {
  // IS 2062 / IS 800 Grades
  E250: { designation: 'E250', fy: 250, fu: 410, E: 200000, G: 76900, nu: 0.3, alpha: 12e-6, density: 7850 },
  E275: { designation: 'E275', fy: 275, fu: 430, E: 200000, G: 76900, nu: 0.3, alpha: 12e-6, density: 7850 },
  E300: { designation: 'E300', fy: 300, fu: 440, E: 200000, G: 76900, nu: 0.3, alpha: 12e-6, density: 7850 },
  E350: { designation: 'E350', fy: 350, fu: 490, E: 200000, G: 76900, nu: 0.3, alpha: 12e-6, density: 7850 },
  E410: { designation: 'E410', fy: 410, fu: 540, E: 200000, G: 76900, nu: 0.3, alpha: 12e-6, density: 7850 },
  E450: { designation: 'E450', fy: 450, fu: 570, E: 200000, G: 76900, nu: 0.3, alpha: 12e-6, density: 7850 },
  
  // ASTM Grades
  A36: { designation: 'A36', fy: 250, fu: 400, E: 200000, G: 77200, nu: 0.3, alpha: 11.7e-6, density: 7850 },
  'A572-50': { designation: 'A572-50', fy: 345, fu: 450, E: 200000, G: 77200, nu: 0.3, alpha: 11.7e-6, density: 7850 },
  'A572-65': { designation: 'A572-65', fy: 450, fu: 550, E: 200000, G: 77200, nu: 0.3, alpha: 11.7e-6, density: 7850 },
  A992: { designation: 'A992', fy: 345, fu: 450, E: 200000, G: 77200, nu: 0.3, alpha: 11.7e-6, density: 7850 },
  A500B: { designation: 'A500B', fy: 290, fu: 400, E: 200000, G: 77200, nu: 0.3, alpha: 11.7e-6, density: 7850 },
  A500C: { designation: 'A500C', fy: 317, fu: 427, E: 200000, G: 77200, nu: 0.3, alpha: 11.7e-6, density: 7850 },
  
  // EN 10025 Grades
  S235: { designation: 'S235', fy: 235, fu: 360, E: 210000, G: 81000, nu: 0.3, alpha: 12e-6, density: 7850 },
  S275: { designation: 'S275', fy: 275, fu: 430, E: 210000, G: 81000, nu: 0.3, alpha: 12e-6, density: 7850 },
  S355: { designation: 'S355', fy: 355, fu: 490, E: 210000, G: 81000, nu: 0.3, alpha: 12e-6, density: 7850 },
  S420: { designation: 'S420', fy: 420, fu: 520, E: 210000, G: 81000, nu: 0.3, alpha: 12e-6, density: 7850 },
  S460: { designation: 'S460', fy: 460, fu: 540, E: 210000, G: 81000, nu: 0.3, alpha: 12e-6, density: 7850 },
  
  // AS/NZS Grades
  Grade250: { designation: 'Grade250', fy: 250, fu: 410, E: 200000, G: 80000, nu: 0.25, alpha: 11.7e-6, density: 7850 },
  Grade300: { designation: 'Grade300', fy: 300, fu: 440, E: 200000, G: 80000, nu: 0.25, alpha: 11.7e-6, density: 7850 },
  Grade350: { designation: 'Grade350', fy: 350, fu: 480, E: 200000, G: 80000, nu: 0.25, alpha: 11.7e-6, density: 7850 },
  Grade450: { designation: 'Grade450', fy: 450, fu: 520, E: 200000, G: 80000, nu: 0.25, alpha: 11.7e-6, density: 7850 },
};

// =============================================================================
// BOLT GRADES DATABASE
// =============================================================================

export const BOLT_GRADES: BoltGrade[] = [
  // Metric property classes
  { grade: '4.6', fyb: 240, fub: 400 },
  { grade: '4.8', fyb: 320, fub: 400 },
  { grade: '5.6', fyb: 300, fub: 500 },
  { grade: '5.8', fyb: 400, fub: 500 },
  { grade: '6.8', fyb: 480, fub: 600 },
  { grade: '8.8', fyb: 640, fub: 800 },
  { grade: '10.9', fyb: 900, fub: 1000 },
  { grade: '12.9', fyb: 1080, fub: 1200 },
  
  // ASTM bolt grades (converted to metric)
  { grade: 'A307', fyb: 248, fub: 414 },
  { grade: 'A325', fyb: 660, fub: 830 },
  { grade: 'A490', fyb: 940, fub: 1040 },
];

export const BOLT_SIZES: BoltSize[] = [
  { diameter: 12, area_gross: 113.1, area_tensile: 84.3, area_shank: 113.1 },
  { diameter: 16, area_gross: 201.1, area_tensile: 157.0, area_shank: 201.1 },
  { diameter: 20, area_gross: 314.2, area_tensile: 245.0, area_shank: 314.2 },
  { diameter: 22, area_gross: 380.1, area_tensile: 303.0, area_shank: 380.1 },
  { diameter: 24, area_gross: 452.4, area_tensile: 353.0, area_shank: 452.4 },
  { diameter: 27, area_gross: 572.6, area_tensile: 459.0, area_shank: 572.6 },
  { diameter: 30, area_gross: 706.9, area_tensile: 561.0, area_shank: 706.9 },
  { diameter: 36, area_gross: 1017.9, area_tensile: 817.0, area_shank: 1017.9 },
];

// =============================================================================
// WELD ELECTRODES
// =============================================================================

export const WELD_ELECTRODES: WeldStrength[] = [
  { electrode: 'E41', fuw: 410 },     // IS - mild steel
  { electrode: 'E51', fuw: 510 },     // IS - high strength
  { electrode: 'E60', fuw: 415 },     // AWS E60XX
  { electrode: 'E70', fuw: 485 },     // AWS E70XX
  { electrode: 'E80', fuw: 550 },     // AWS E80XX
  { electrode: 'E90', fuw: 620 },     // AWS E90XX
  { electrode: 'E35', fuw: 440 },     // EN - Filler metal grade 35
  { electrode: 'E42', fuw: 500 },     // EN - Filler metal grade 42
  { electrode: 'E46', fuw: 530 },     // EN - Filler metal grade 46
  { electrode: 'E50', fuw: 560 },     // EN - Filler metal grade 50
];

// =============================================================================
// INDIAN STANDARD SECTIONS (IS 808)
// =============================================================================

export const INDIAN_SECTIONS: Record<string, SteelSection[]> = {
  // ISMB - Indian Standard Medium Weight Beams
  ISMB: [
    { designation: 'ISMB 100', type: 'I-section', h: 100, b: 75, tw: 4.0, tf: 7.2, r: 9, A: 1140, Ix: 2570000, Iy: 250000, Zx: 51400, Zy: 6670, Zpx: 60200, Zpy: 10500, rx: 47.5, ry: 14.8, J: 10300, Cw: 1.2e9, mass: 8.9, bf_2tf: 5.21, hw_tw: 21.4 },
    { designation: 'ISMB 150', type: 'I-section', h: 150, b: 80, tw: 4.8, tf: 7.6, r: 9.5, A: 1660, Ix: 7260000, Iy: 329000, Zx: 96800, Zy: 8230, Zpx: 112000, Zpy: 13000, rx: 66.1, ry: 14.1, J: 16200, Cw: 4.2e9, mass: 13.0, bf_2tf: 5.26, hw_tw: 28.1 },
    { designation: 'ISMB 200', type: 'I-section', h: 200, b: 100, tw: 5.7, tf: 10.8, r: 11, A: 2850, Ix: 22200000, Iy: 917000, Zx: 222000, Zy: 18300, Zpx: 254000, Zpy: 28700, rx: 88.2, ry: 17.9, J: 56600, Cw: 19.6e9, mass: 22.4, bf_2tf: 4.63, hw_tw: 31.3 },
    { designation: 'ISMB 250', type: 'I-section', h: 250, b: 125, tw: 6.9, tf: 12.5, r: 13, A: 4750, Ix: 51300000, Iy: 2100000, Zx: 410000, Zy: 33600, Zpx: 470000, Zpy: 52600, rx: 104, ry: 21.0, J: 121000, Cw: 59.5e9, mass: 37.3, bf_2tf: 5.0, hw_tw: 32.6 },
    { designation: 'ISMB 300', type: 'I-section', h: 300, b: 140, tw: 7.5, tf: 12.4, r: 14, A: 5660, Ix: 86100000, Iy: 2860000, Zx: 574000, Zy: 40900, Zpx: 658000, Zpy: 64100, rx: 123, ry: 22.5, J: 146000, Cw: 129e9, mass: 44.4, bf_2tf: 5.65, hw_tw: 36.7 },
    { designation: 'ISMB 350', type: 'I-section', h: 350, b: 140, tw: 8.1, tf: 14.2, r: 14, A: 6630, Ix: 136000000, Iy: 3310000, Zx: 779000, Zy: 47300, Zpx: 896000, Zpy: 74200, rx: 143, ry: 22.3, J: 222000, Cw: 213e9, mass: 52.0, bf_2tf: 4.93, hw_tw: 39.7 },
    { designation: 'ISMB 400', type: 'I-section', h: 400, b: 140, tw: 8.9, tf: 16.0, r: 14, A: 7840, Ix: 204000000, Iy: 3730000, Zx: 1020000, Zy: 53300, Zpx: 1180000, Zpy: 83700, rx: 161, ry: 21.8, J: 323000, Cw: 339e9, mass: 61.5, bf_2tf: 4.38, hw_tw: 41.3 },
    { designation: 'ISMB 450', type: 'I-section', h: 450, b: 150, tw: 9.4, tf: 17.4, r: 15, A: 9220, Ix: 303000000, Iy: 5080000, Zx: 1350000, Zy: 67700, Zpx: 1550000, Zpy: 106000, rx: 181, ry: 23.5, J: 455000, Cw: 559e9, mass: 72.4, bf_2tf: 4.31, hw_tw: 44.2 },
    { designation: 'ISMB 500', type: 'I-section', h: 500, b: 180, tw: 10.2, tf: 17.2, r: 17, A: 11000, Ix: 452000000, Iy: 8370000, Zx: 1810000, Zy: 93000, Zpx: 2080000, Zpy: 145000, rx: 203, ry: 27.6, J: 532000, Cw: 1050e9, mass: 86.4, bf_2tf: 5.23, hw_tw: 45.6 },
    { designation: 'ISMB 550', type: 'I-section', h: 550, b: 190, tw: 11.2, tf: 19.3, r: 18, A: 13200, Ix: 649000000, Iy: 11100000, Zx: 2360000, Zy: 117000, Zpx: 2720000, Zpy: 183000, rx: 222, ry: 29.0, J: 798000, Cw: 1690e9, mass: 104, bf_2tf: 4.92, hw_tw: 45.7 },
    { designation: 'ISMB 600', type: 'I-section', h: 600, b: 210, tw: 12.0, tf: 20.8, r: 20, A: 15600, Ix: 918000000, Iy: 16100000, Zx: 3060000, Zy: 153000, Zpx: 3530000, Zpy: 239000, rx: 243, ry: 32.1, J: 1080000, Cw: 2750e9, mass: 122, bf_2tf: 5.05, hw_tw: 46.5 },
  ],
  
  // ISWB - Indian Standard Wide Flange Beams
  ISWB: [
    { designation: 'ISWB 150', type: 'I-section', h: 150, b: 100, tw: 5.4, tf: 8.0, r: 9, A: 2030, Ix: 8390000, Iy: 680000, Zx: 112000, Zy: 13600, Zpx: 128000, Zpy: 21400, rx: 64.3, ry: 18.3, J: 21900, Cw: 5.8e9, mass: 15.9, bf_2tf: 6.25, hw_tw: 24.8 },
    { designation: 'ISWB 200', type: 'I-section', h: 200, b: 140, tw: 6.1, tf: 9.0, r: 11, A: 3230, Ix: 20000000, Iy: 2070000, Zx: 200000, Zy: 29600, Zpx: 228000, Zpy: 46400, rx: 78.7, ry: 25.3, J: 43600, Cw: 22.7e9, mass: 25.4, bf_2tf: 7.78, hw_tw: 29.8 },
    { designation: 'ISWB 250', type: 'I-section', h: 250, b: 200, tw: 6.7, tf: 9.0, r: 13, A: 4780, Ix: 41000000, Iy: 6020000, Zx: 328000, Zy: 60200, Zpx: 370000, Zpy: 93700, rx: 92.6, ry: 35.5, J: 61400, Cw: 81.7e9, mass: 37.5, bf_2tf: 11.1, hw_tw: 34.6 },
    { designation: 'ISWB 300', type: 'I-section', h: 300, b: 200, tw: 7.4, tf: 10.0, r: 14, A: 5900, Ix: 69800000, Iy: 6700000, Zx: 465000, Zy: 67000, Zpx: 527000, Zpy: 104000, rx: 109, ry: 33.7, J: 97900, Cw: 137e9, mass: 46.3, bf_2tf: 10.0, hw_tw: 37.8 },
    { designation: 'ISWB 350', type: 'I-section', h: 350, b: 200, tw: 8.0, tf: 11.4, r: 14, A: 7180, Ix: 113000000, Iy: 7800000, Zx: 646000, Zy: 78000, Zpx: 736000, Zpy: 122000, rx: 125, ry: 33.0, J: 153000, Cw: 228e9, mass: 56.4, bf_2tf: 8.77, hw_tw: 40.9 },
    { designation: 'ISWB 400', type: 'I-section', h: 400, b: 200, tw: 8.6, tf: 13.0, r: 14, A: 8550, Ix: 171000000, Iy: 8910000, Zx: 857000, Zy: 89100, Zpx: 984000, Zpy: 139000, rx: 141, ry: 32.3, J: 234000, Cw: 374e9, mass: 67.1, bf_2tf: 7.69, hw_tw: 43.5 },
    { designation: 'ISWB 450', type: 'I-section', h: 450, b: 200, tw: 9.2, tf: 15.0, r: 15, A: 10200, Ix: 250000000, Iy: 10100000, Zx: 1110000, Zy: 101000, Zpx: 1280000, Zpy: 158000, rx: 157, ry: 31.5, J: 363000, Cw: 572e9, mass: 80.1, bf_2tf: 6.67, hw_tw: 45.7 },
    { designation: 'ISWB 500', type: 'I-section', h: 500, b: 200, tw: 9.9, tf: 17.0, r: 15, A: 12000, Ix: 352000000, Iy: 11400000, Zx: 1410000, Zy: 114000, Zpx: 1630000, Zpy: 179000, rx: 171, ry: 30.8, J: 535000, Cw: 850e9, mass: 94.2, bf_2tf: 5.88, hw_tw: 47.1 },
    { designation: 'ISWB 550', type: 'I-section', h: 550, b: 200, tw: 10.5, tf: 19.0, r: 15, A: 13700, Ix: 477000000, Iy: 12800000, Zx: 1740000, Zy: 128000, Zpx: 2010000, Zpy: 200000, rx: 186, ry: 30.6, J: 746000, Cw: 1200e9, mass: 108, bf_2tf: 5.26, hw_tw: 48.8 },
    { designation: 'ISWB 600', type: 'I-section', h: 600, b: 250, tw: 11.2, tf: 21.3, r: 17, A: 17900, Ix: 757000000, Iy: 27900000, Zx: 2520000, Zy: 223000, Zpx: 2900000, Zpy: 348000, rx: 206, ry: 39.5, J: 1250000, Cw: 2670e9, mass: 140, bf_2tf: 5.87, hw_tw: 49.8 },
  ],
  
  // ISMC - Indian Standard Medium Channels
  ISMC: [
    { designation: 'ISMC 75', type: 'channel', h: 75, b: 40, tw: 4.4, tf: 7.3, r: 8.5, A: 873, Ix: 762000, Iy: 122000, Zx: 20300, Zy: 4060, Zpx: 24200, Zpy: 7250, rx: 29.5, ry: 11.8, J: 7350, cy: 13.7, mass: 6.8 },
    { designation: 'ISMC 100', type: 'channel', h: 100, b: 50, tw: 5.0, tf: 7.5, r: 9, A: 1170, Ix: 1870000, Iy: 259000, Zx: 37400, Zy: 7080, Zpx: 44600, Zpy: 12700, rx: 40.0, ry: 14.9, J: 10900, cy: 16.0, mass: 9.2 },
    { designation: 'ISMC 125', type: 'channel', h: 125, b: 65, tw: 5.3, tf: 8.1, r: 9.5, A: 1640, Ix: 4160000, Iy: 584000, Zx: 66600, Zy: 12500, Zpx: 78800, Zpy: 22100, rx: 50.4, ry: 18.9, J: 17600, cy: 20.2, mass: 12.9 },
    { designation: 'ISMC 150', type: 'channel', h: 150, b: 75, tw: 5.7, tf: 9.0, r: 10, A: 2120, Ix: 7790000, Iy: 1010000, Zx: 104000, Zy: 18500, Zpx: 123000, Zpy: 32800, rx: 60.6, ry: 21.8, J: 27600, cy: 23.0, mass: 16.6 },
    { designation: 'ISMC 175', type: 'channel', h: 175, b: 75, tw: 6.2, tf: 10.2, r: 10.5, A: 2610, Ix: 12900000, Iy: 1150000, Zx: 148000, Zy: 21200, Zpx: 175000, Zpy: 37800, rx: 70.3, ry: 21.0, J: 43900, cy: 22.2, mass: 20.5 },
    { designation: 'ISMC 200', type: 'channel', h: 200, b: 75, tw: 6.2, tf: 11.4, r: 11, A: 2980, Ix: 19100000, Iy: 1280000, Zx: 191000, Zy: 23600, Zpx: 228000, Zpy: 42300, rx: 80.1, ry: 20.7, J: 62200, cy: 21.6, mass: 23.4 },
    { designation: 'ISMC 250', type: 'channel', h: 250, b: 80, tw: 7.1, tf: 14.1, r: 12, A: 4140, Ix: 38300000, Iy: 1880000, Zx: 307000, Zy: 32600, Zpx: 367000, Zpy: 58700, rx: 96.2, ry: 21.3, J: 125000, cy: 22.2, mass: 32.5 },
    { designation: 'ISMC 300', type: 'channel', h: 300, b: 90, tw: 7.8, tf: 13.6, r: 13, A: 4630, Ix: 60400000, Iy: 3100000, Zx: 403000, Zy: 47200, Zpx: 479000, Zpy: 84100, rx: 114, ry: 25.9, J: 136000, cy: 25.5, mass: 36.3 },
    { designation: 'ISMC 350', type: 'channel', h: 350, b: 100, tw: 8.1, tf: 13.5, r: 14, A: 5310, Ix: 87200000, Iy: 4350000, Zx: 498000, Zy: 60300, Zpx: 592000, Zpy: 107000, rx: 128, ry: 28.6, J: 156000, cy: 28.2, mass: 41.7 },
    { designation: 'ISMC 400', type: 'channel', h: 400, b: 100, tw: 8.6, tf: 15.3, r: 15, A: 6270, Ix: 130000000, Iy: 5030000, Zx: 649000, Zy: 69800, Zpx: 779000, Zpy: 125000, rx: 144, ry: 28.3, J: 234000, cy: 27.8, mass: 49.2 },
  ],
  
  // ISA - Indian Standard Equal Angles
  ISA_EQUAL: [
    { designation: 'ISA 25x25x3', type: 'angle', h: 25, b: 25, tw: 3, tf: 3, A: 142, Ix: 8810, Iy: 8810, Zx: 504, Zy: 504, Zpx: 900, Zpy: 900, rx: 7.88, ry: 7.88, J: 425, mass: 1.1 },
    { designation: 'ISA 30x30x3', type: 'angle', h: 30, b: 30, tw: 3, tf: 3, A: 174, Ix: 15800, Iy: 15800, Zx: 746, Zy: 746, Zpx: 1330, Zpy: 1330, rx: 9.53, ry: 9.53, J: 521, mass: 1.4 },
    { designation: 'ISA 40x40x4', type: 'angle', h: 40, b: 40, tw: 4, tf: 4, A: 308, Ix: 49600, Iy: 49600, Zx: 1760, Zy: 1760, Zpx: 3140, Zpy: 3140, rx: 12.7, ry: 12.7, J: 1640, mass: 2.4 },
    { designation: 'ISA 50x50x5', type: 'angle', h: 50, b: 50, tw: 5, tf: 5, A: 480, Ix: 120000, Iy: 120000, Zx: 3410, Zy: 3410, Zpx: 6080, Zpy: 6080, rx: 15.8, ry: 15.8, J: 4000, mass: 3.8 },
    { designation: 'ISA 60x60x6', type: 'angle', h: 60, b: 60, tw: 6, tf: 6, A: 691, Ix: 247000, Iy: 247000, Zx: 5850, Zy: 5850, Zpx: 10400, Zpy: 10400, rx: 18.9, ry: 18.9, J: 8290, mass: 5.4 },
    { designation: 'ISA 65x65x6', type: 'angle', h: 65, b: 65, tw: 6, tf: 6, A: 749, Ix: 315000, Iy: 315000, Zx: 6880, Zy: 6880, Zpx: 12300, Zpy: 12300, rx: 20.5, ry: 20.5, J: 8980, mass: 5.9 },
    { designation: 'ISA 75x75x6', type: 'angle', h: 75, b: 75, tw: 6, tf: 6, A: 866, Ix: 486000, Iy: 486000, Zx: 9170, Zy: 9170, Zpx: 16300, Zpy: 16300, rx: 23.7, ry: 23.7, J: 10400, mass: 6.8 },
    { designation: 'ISA 80x80x8', type: 'angle', h: 80, b: 80, tw: 8, tf: 8, A: 1220, Ix: 769000, Iy: 769000, Zx: 13600, Zy: 13600, Zpx: 24300, Zpy: 24300, rx: 25.1, ry: 25.1, J: 26000, mass: 9.6 },
    { designation: 'ISA 90x90x8', type: 'angle', h: 90, b: 90, tw: 8, tf: 8, A: 1380, Ix: 1110000, Iy: 1110000, Zx: 17400, Zy: 17400, Zpx: 31000, Zpy: 31000, rx: 28.4, ry: 28.4, J: 29500, mass: 10.8 },
    { designation: 'ISA 100x100x10', type: 'angle', h: 100, b: 100, tw: 10, tf: 10, A: 1900, Ix: 1880000, Iy: 1880000, Zx: 26700, Zy: 26700, Zpx: 47600, Zpy: 47600, rx: 31.4, ry: 31.4, J: 63300, mass: 14.9 },
    { designation: 'ISA 110x110x10', type: 'angle', h: 110, b: 110, tw: 10, tf: 10, A: 2100, Ix: 2510000, Iy: 2510000, Zx: 32300, Zy: 32300, Zpx: 57600, Zpy: 57600, rx: 34.6, ry: 34.6, J: 70000, mass: 16.5 },
    { designation: 'ISA 130x130x10', type: 'angle', h: 130, b: 130, tw: 10, tf: 10, A: 2500, Ix: 4210000, Iy: 4210000, Zx: 45700, Zy: 45700, Zpx: 81500, Zpy: 81500, rx: 41.0, ry: 41.0, J: 83300, mass: 19.6 },
    { designation: 'ISA 150x150x12', type: 'angle', h: 150, b: 150, tw: 12, tf: 12, A: 3460, Ix: 7750000, Iy: 7750000, Zx: 73200, Zy: 73200, Zpx: 131000, Zpy: 131000, rx: 47.3, ry: 47.3, J: 166000, mass: 27.2 },
    { designation: 'ISA 200x200x16', type: 'angle', h: 200, b: 200, tw: 16, tf: 16, A: 6180, Ix: 24600000, Iy: 24600000, Zx: 174000, Zy: 174000, Zpx: 310000, Zpy: 310000, rx: 63.1, ry: 63.1, J: 527000, mass: 48.5 },
  ],
};

// =============================================================================
// AMERICAN STANDARD SECTIONS (AISC)
// =============================================================================

export const AISC_SECTIONS: Record<string, SteelSection[]> = {
  // W-shapes (Wide Flange)
  W: [
    { designation: 'W4x13', type: 'I-section', h: 106, b: 103, tw: 7.1, tf: 8.8, r: 5, A: 1650, Ix: 4530000, Iy: 1080000, Zx: 88500, Zy: 21000, Zpx: 98200, Zpy: 32500, rx: 52.4, ry: 25.6, J: 21100, Cw: 5.66e9, mass: 13.0, bf_2tf: 5.84, hw_tw: 12.4 },
    { designation: 'W6x15', type: 'I-section', h: 152, b: 152, tw: 5.8, tf: 6.6, r: 8, A: 1900, Ix: 9460000, Iy: 2410000, Zx: 127000, Zy: 31700, Zpx: 140000, Zpy: 48900, rx: 70.6, ry: 35.6, J: 12500, Cw: 20.6e9, mass: 15.0, bf_2tf: 11.5, hw_tw: 24.0 },
    { designation: 'W8x24', type: 'I-section', h: 201, b: 165, tw: 6.2, tf: 10.2, r: 11, A: 3060, Ix: 28500000, Iy: 4580000, Zx: 289000, Zy: 55500, Zpx: 321000, Zpy: 85200, rx: 96.5, ry: 38.7, J: 49200, Cw: 66.7e9, mass: 24.0, bf_2tf: 8.09, hw_tw: 29.2 },
    { designation: 'W10x33', type: 'I-section', h: 247, b: 202, tw: 7.4, tf: 11.1, r: 13, A: 4190, Ix: 56600000, Iy: 9400000, Zx: 465000, Zy: 93000, Zpx: 515000, Zpy: 142000, rx: 116, ry: 47.4, J: 78300, Cw: 177e9, mass: 33.0, bf_2tf: 9.10, hw_tw: 30.3 },
    { designation: 'W12x40', type: 'I-section', h: 303, b: 203, tw: 7.5, tf: 13.1, r: 13, A: 5100, Ix: 103000000, Iy: 11300000, Zx: 692000, Zy: 112000, Zpx: 772000, Zpy: 171000, rx: 142, ry: 47.1, J: 137000, Cw: 335e9, mass: 40.0, bf_2tf: 7.75, hw_tw: 36.9 },
    { designation: 'W14x53', type: 'I-section', h: 353, b: 205, tw: 9.4, tf: 16.8, r: 14, A: 6750, Ix: 190000000, Iy: 14900000, Zx: 1100000, Zy: 145000, Zpx: 1230000, Zpy: 222000, rx: 168, ry: 47.0, J: 298000, Cw: 622e9, mass: 53.0, bf_2tf: 6.10, hw_tw: 34.0 },
    { designation: 'W16x67', type: 'I-section', h: 409, b: 264, tw: 9.7, tf: 14.4, r: 17, A: 8510, Ix: 299000000, Iy: 38600000, Zx: 1490000, Zy: 293000, Zpx: 1650000, Zpy: 447000, rx: 187, ry: 67.4, J: 290000, Cw: 1460e9, mass: 67.0, bf_2tf: 9.17, hw_tw: 39.2 },
    { designation: 'W18x76', type: 'I-section', h: 460, b: 280, tw: 10.9, tf: 17.0, r: 17, A: 9680, Ix: 445000000, Iy: 52900000, Zx: 1980000, Zy: 378000, Zpx: 2210000, Zpy: 577000, rx: 214, ry: 73.9, J: 482000, Cw: 2400e9, mass: 76.0, bf_2tf: 8.24, hw_tw: 39.1 },
    { designation: 'W21x101', type: 'I-section', h: 536, b: 302, tw: 12.2, tf: 19.0, r: 19, A: 12900, Ix: 757000000, Iy: 87800000, Zx: 2900000, Zy: 582000, Zpx: 3250000, Zpy: 889000, rx: 242, ry: 82.6, J: 754000, Cw: 4890e9, mass: 101, bf_2tf: 7.95, hw_tw: 40.8 },
    { designation: 'W24x131', type: 'I-section', h: 617, b: 328, tw: 14.0, tf: 21.2, r: 21, A: 16700, Ix: 1230000000, Iy: 130000000, Zx: 4080000, Zy: 793000, Zpx: 4580000, Zpy: 1210000, rx: 272, ry: 88.1, J: 1190000, Cw: 9390e9, mass: 131, bf_2tf: 7.74, hw_tw: 41.1 },
    { designation: 'W27x161', type: 'I-section', h: 686, b: 330, tw: 15.4, tf: 24.4, r: 22, A: 20500, Ix: 1900000000, Iy: 149000000, Zx: 5640000, Zy: 903000, Zpx: 6360000, Zpy: 1380000, rx: 305, ry: 85.3, J: 1910000, Cw: 13700e9, mass: 161, bf_2tf: 6.76, hw_tw: 41.4 },
    { designation: 'W30x191', type: 'I-section', h: 763, b: 356, tw: 16.0, tf: 26.0, r: 24, A: 24300, Ix: 2710000000, Iy: 199000000, Zx: 7230000, Zy: 1120000, Zpx: 8150000, Zpy: 1710000, rx: 334, ry: 90.5, J: 2590000, Cw: 21100e9, mass: 191, bf_2tf: 6.85, hw_tw: 44.4 },
    { designation: 'W36x232', type: 'I-section', h: 914, b: 381, tw: 18.0, tf: 30.0, r: 25, A: 29500, Ix: 4430000000, Iy: 275000000, Zx: 9910000, Zy: 1440000, Zpx: 11200000, Zpy: 2210000, rx: 388, ry: 96.6, J: 4240000, Cw: 40400e9, mass: 232, bf_2tf: 6.35, hw_tw: 47.4 },
  ],
  
  // HSS - Hollow Structural Sections (Rectangular)
  HSS_RECT: [
    { designation: 'HSS 4x3x1/4', type: 'RHS', h: 102, b: 76, tw: 6.35, tf: 6.35, t: 6.35, A: 1970, Ix: 3070000, Iy: 1900000, Zx: 61200, Zy: 50200, Zpx: 74500, Zpy: 59600, rx: 39.5, ry: 31.1, J: 4000000, mass: 15.5 },
    { designation: 'HSS 6x4x1/4', type: 'RHS', h: 152, b: 102, tw: 6.35, tf: 6.35, t: 6.35, A: 2810, Ix: 10700000, Iy: 5500000, Zx: 141000, Zy: 109000, Zpx: 168000, Zpy: 125000, rx: 61.7, ry: 44.2, J: 11900000, mass: 22.0 },
    { designation: 'HSS 8x4x3/8', type: 'RHS', h: 203, b: 102, tw: 9.53, tf: 9.53, t: 9.53, A: 4900, Ix: 28500000, Iy: 10200000, Zx: 286000, Zy: 200000, Zpx: 352000, Zpy: 234000, rx: 76.2, ry: 45.6, J: 27500000, mass: 38.5 },
    { designation: 'HSS 8x6x1/2', type: 'RHS', h: 203, b: 152, tw: 12.7, tf: 12.7, t: 12.7, A: 7740, Ix: 42500000, Iy: 27300000, Zx: 425000, Zy: 360000, Zpx: 520000, Zpy: 425000, rx: 74.2, ry: 59.4, J: 52500000, mass: 60.8 },
    { designation: 'HSS 10x6x3/8', type: 'RHS', h: 254, b: 152, tw: 9.53, tf: 9.53, t: 9.53, A: 6320, Ix: 56000000, Iy: 25200000, Zx: 447000, Zy: 332000, Zpx: 540000, Zpy: 388000, rx: 94.2, ry: 63.2, J: 56500000, mass: 49.6 },
    { designation: 'HSS 12x8x1/2', type: 'RHS', h: 305, b: 203, tw: 12.7, tf: 12.7, t: 12.7, A: 11200, Ix: 135000000, Iy: 73000000, Zx: 893000, Zy: 720000, Zpx: 1080000, Zpy: 848000, rx: 110, ry: 80.8, J: 147000000, mass: 88.0 },
  ],
  
  // HSS - Hollow Structural Sections (Square)
  HSS_SQUARE: [
    { designation: 'HSS 4x4x1/4', type: 'SHS', h: 102, b: 102, tw: 6.35, tf: 6.35, t: 6.35, A: 2260, Ix: 3950000, Iy: 3950000, Zx: 77500, Zy: 77500, Zpx: 93200, Zpy: 93200, rx: 41.8, ry: 41.8, J: 6240000, mass: 17.7 },
    { designation: 'HSS 5x5x3/8', type: 'SHS', h: 127, b: 127, tw: 9.53, tf: 9.53, t: 9.53, A: 4130, Ix: 10200000, Iy: 10200000, Zx: 163000, Zy: 163000, Zpx: 199000, Zpy: 199000, rx: 49.7, ry: 49.7, J: 16400000, mass: 32.4 },
    { designation: 'HSS 6x6x3/8', type: 'SHS', h: 152, b: 152, tw: 9.53, tf: 9.53, t: 9.53, A: 5030, Ix: 18500000, Iy: 18500000, Zx: 246000, Zy: 246000, Zpx: 297000, Zpy: 297000, rx: 60.7, ry: 60.7, J: 29800000, mass: 39.5 },
    { designation: 'HSS 8x8x1/2', type: 'SHS', h: 203, b: 203, tw: 12.7, tf: 12.7, t: 12.7, A: 8900, Ix: 59100000, Iy: 59100000, Zx: 589000, Zy: 589000, Zpx: 716000, Zpy: 716000, rx: 81.5, ry: 81.5, J: 97000000, mass: 69.9 },
    { designation: 'HSS 10x10x1/2', type: 'SHS', h: 254, b: 254, tw: 12.7, tf: 12.7, t: 12.7, A: 11200, Ix: 120000000, Iy: 120000000, Zx: 952000, Zy: 952000, Zpx: 1150000, Zpy: 1150000, rx: 104, ry: 104, J: 193000000, mass: 87.9 },
    { designation: 'HSS 12x12x5/8', type: 'SHS', h: 305, b: 305, tw: 15.9, tf: 15.9, t: 15.9, A: 17400, Ix: 260000000, Iy: 260000000, Zx: 1720000, Zy: 1720000, Zpx: 2080000, Zpy: 2080000, rx: 122, ry: 122, J: 416000000, mass: 137 },
  ],
  
  // Pipes (CHS)
  PIPE: [
    { designation: 'PIPE 3 STD', type: 'CHS', h: 88.9, b: 88.9, D: 88.9, tw: 5.49, tf: 5.49, t: 5.49, A: 1440, Ix: 1360000, Iy: 1360000, Zx: 30700, Zy: 30700, Zpx: 41300, Zpy: 41300, rx: 30.7, ry: 30.7, J: 2720000, mass: 11.3 },
    { designation: 'PIPE 4 STD', type: 'CHS', h: 114, b: 114, D: 114, tw: 6.02, tf: 6.02, t: 6.02, A: 2040, Ix: 3130000, Iy: 3130000, Zx: 54900, Zy: 54900, Zpx: 73500, Zpy: 73500, rx: 39.2, ry: 39.2, J: 6250000, mass: 16.0 },
    { designation: 'PIPE 6 STD', type: 'CHS', h: 168, b: 168, D: 168, tw: 7.11, tf: 7.11, t: 7.11, A: 3600, Ix: 11800000, Iy: 11800000, Zx: 141000, Zy: 141000, Zpx: 187000, Zpy: 187000, rx: 57.2, ry: 57.2, J: 23600000, mass: 28.3 },
    { designation: 'PIPE 8 STD', type: 'CHS', h: 219, b: 219, D: 219, tw: 8.18, tf: 8.18, t: 8.18, A: 5420, Ix: 29900000, Iy: 29900000, Zx: 273000, Zy: 273000, Zpx: 360000, Zpy: 360000, rx: 74.3, ry: 74.3, J: 59700000, mass: 42.5 },
    { designation: 'PIPE 10 STD', type: 'CHS', h: 273, b: 273, D: 273, tw: 9.27, tf: 9.27, t: 9.27, A: 7680, Ix: 63900000, Iy: 63900000, Zx: 468000, Zy: 468000, Zpx: 618000, Zpy: 618000, rx: 91.2, ry: 91.2, J: 128000000, mass: 60.3 },
    { designation: 'PIPE 12 STD', type: 'CHS', h: 324, b: 324, D: 324, tw: 10.3, tf: 10.3, t: 10.3, A: 10200, Ix: 119000000, Iy: 119000000, Zx: 735000, Zy: 735000, Zpx: 968000, Zpy: 968000, rx: 108, ry: 108, J: 238000000, mass: 80.1 },
  ],
};

// =============================================================================
// EUROPEAN STANDARD SECTIONS (EN)
// =============================================================================

export const EUROPEAN_SECTIONS: Record<string, SteelSection[]> = {
  // IPE - European I-Beams
  IPE: [
    { designation: 'IPE 100', type: 'I-section', h: 100, b: 55, tw: 4.1, tf: 5.7, r: 7, A: 1030, Ix: 1710000, Iy: 159000, Zx: 34200, Zy: 5790, Zpx: 39400, Zpy: 9150, rx: 40.7, ry: 12.4, J: 12100, Cw: 0.35e9, mass: 8.1, bf_2tf: 4.82, hw_tw: 21.6 },
    { designation: 'IPE 120', type: 'I-section', h: 120, b: 64, tw: 4.4, tf: 6.3, r: 7, A: 1320, Ix: 3180000, Iy: 277000, Zx: 52900, Zy: 8650, Zpx: 60700, Zpy: 13600, rx: 49.0, ry: 14.5, J: 17400, Cw: 0.89e9, mass: 10.4, bf_2tf: 5.08, hw_tw: 24.4 },
    { designation: 'IPE 140', type: 'I-section', h: 140, b: 73, tw: 4.7, tf: 6.9, r: 7, A: 1640, Ix: 5410000, Iy: 449000, Zx: 77300, Zy: 12300, Zpx: 88300, Zpy: 19300, rx: 57.4, ry: 16.5, J: 24500, Cw: 1.98e9, mass: 12.9, bf_2tf: 5.29, hw_tw: 26.9 },
    { designation: 'IPE 160', type: 'I-section', h: 160, b: 82, tw: 5.0, tf: 7.4, r: 9, A: 2010, Ix: 8690000, Iy: 683000, Zx: 109000, Zy: 16700, Zpx: 124000, Zpy: 26100, rx: 65.8, ry: 18.4, J: 36300, Cw: 3.96e9, mass: 15.8, bf_2tf: 5.54, hw_tw: 29.0 },
    { designation: 'IPE 180', type: 'I-section', h: 180, b: 91, tw: 5.3, tf: 8.0, r: 9, A: 2390, Ix: 13200000, Iy: 1010000, Zx: 146000, Zy: 22200, Zpx: 166000, Zpy: 34600, rx: 74.2, ry: 20.5, J: 47900, Cw: 7.43e9, mass: 18.8, bf_2tf: 5.69, hw_tw: 30.9 },
    { designation: 'IPE 200', type: 'I-section', h: 200, b: 100, tw: 5.6, tf: 8.5, r: 12, A: 2850, Ix: 19400000, Iy: 1420000, Zx: 194000, Zy: 28500, Zpx: 221000, Zpy: 44600, rx: 82.6, ry: 22.4, J: 69200, Cw: 13.0e9, mass: 22.4, bf_2tf: 5.88, hw_tw: 32.7 },
    { designation: 'IPE 220', type: 'I-section', h: 220, b: 110, tw: 5.9, tf: 9.2, r: 12, A: 3340, Ix: 27700000, Iy: 2050000, Zx: 252000, Zy: 37300, Zpx: 286000, Zpy: 58100, rx: 91.1, ry: 24.8, J: 90700, Cw: 22.7e9, mass: 26.2, bf_2tf: 5.98, hw_tw: 34.2 },
    { designation: 'IPE 240', type: 'I-section', h: 240, b: 120, tw: 6.2, tf: 9.8, r: 15, A: 3910, Ix: 38900000, Iy: 2840000, Zx: 324000, Zy: 47300, Zpx: 367000, Zpy: 73900, rx: 99.7, ry: 26.9, J: 129000, Cw: 37.4e9, mass: 30.7, bf_2tf: 6.12, hw_tw: 35.5 },
    { designation: 'IPE 270', type: 'I-section', h: 270, b: 135, tw: 6.6, tf: 10.2, r: 15, A: 4590, Ix: 57900000, Iy: 4200000, Zx: 429000, Zy: 62200, Zpx: 484000, Zpy: 97000, rx: 112, ry: 30.2, J: 159000, Cw: 70.6e9, mass: 36.1, bf_2tf: 6.62, hw_tw: 37.8 },
    { designation: 'IPE 300', type: 'I-section', h: 300, b: 150, tw: 7.1, tf: 10.7, r: 15, A: 5380, Ix: 83600000, Iy: 6040000, Zx: 557000, Zy: 80500, Zpx: 628000, Zpy: 125000, rx: 125, ry: 33.5, J: 201000, Cw: 126e9, mass: 42.2, bf_2tf: 7.01, hw_tw: 39.2 },
    { designation: 'IPE 330', type: 'I-section', h: 330, b: 160, tw: 7.5, tf: 11.5, r: 18, A: 6260, Ix: 118000000, Iy: 7880000, Zx: 713000, Zy: 98500, Zpx: 804000, Zpy: 154000, rx: 137, ry: 35.5, J: 282000, Cw: 199e9, mass: 49.1, bf_2tf: 6.96, hw_tw: 40.9 },
    { designation: 'IPE 360', type: 'I-section', h: 360, b: 170, tw: 8.0, tf: 12.7, r: 18, A: 7270, Ix: 163000000, Iy: 10400000, Zx: 904000, Zy: 123000, Zpx: 1020000, Zpy: 191000, rx: 150, ry: 37.9, J: 373000, Cw: 314e9, mass: 57.1, bf_2tf: 6.69, hw_tw: 41.9 },
    { designation: 'IPE 400', type: 'I-section', h: 400, b: 180, tw: 8.6, tf: 13.5, r: 21, A: 8450, Ix: 231000000, Iy: 13200000, Zx: 1160000, Zy: 146000, Zpx: 1310000, Zpy: 229000, rx: 165, ry: 39.5, J: 510000, Cw: 490e9, mass: 66.3, bf_2tf: 6.67, hw_tw: 43.4 },
    { designation: 'IPE 450', type: 'I-section', h: 450, b: 190, tw: 9.4, tf: 14.6, r: 21, A: 9880, Ix: 337000000, Iy: 16800000, Zx: 1500000, Zy: 176000, Zpx: 1700000, Zpy: 276000, rx: 185, ry: 41.2, J: 669000, Cw: 791e9, mass: 77.6, bf_2tf: 6.51, hw_tw: 44.8 },
    { designation: 'IPE 500', type: 'I-section', h: 500, b: 200, tw: 10.2, tf: 16.0, r: 21, A: 11600, Ix: 482000000, Iy: 21400000, Zx: 1930000, Zy: 214000, Zpx: 2190000, Zpy: 336000, rx: 204, ry: 43.1, J: 893000, Cw: 1250e9, mass: 90.7, bf_2tf: 6.25, hw_tw: 45.9 },
    { designation: 'IPE 550', type: 'I-section', h: 550, b: 210, tw: 11.1, tf: 17.2, r: 24, A: 13400, Ix: 671000000, Iy: 26700000, Zx: 2440000, Zy: 254000, Zpx: 2780000, Zpy: 401000, rx: 224, ry: 44.7, J: 1230000, Cw: 1880e9, mass: 105, bf_2tf: 6.10, hw_tw: 46.4 },
    { designation: 'IPE 600', type: 'I-section', h: 600, b: 220, tw: 12.0, tf: 19.0, r: 24, A: 15600, Ix: 921000000, Iy: 33900000, Zx: 3070000, Zy: 308000, Zpx: 3510000, Zpy: 486000, rx: 243, ry: 46.6, J: 1650000, Cw: 2850e9, mass: 122, bf_2tf: 5.79, hw_tw: 46.8 },
  ],
  
  // HEA - European Wide Flange Beams (Light)
  HEA: [
    { designation: 'HEA 100', type: 'H-section', h: 96, b: 100, tw: 5.0, tf: 8.0, r: 12, A: 2120, Ix: 3490000, Iy: 1340000, Zx: 72700, Zy: 26800, Zpx: 83000, Zpy: 41100, rx: 40.6, ry: 25.2, J: 52600, Cw: 4.14e9, mass: 16.7, bf_2tf: 6.25, hw_tw: 16.0 },
    { designation: 'HEA 120', type: 'H-section', h: 114, b: 120, tw: 5.0, tf: 8.0, r: 12, A: 2530, Ix: 6060000, Iy: 2310000, Zx: 106000, Zy: 38500, Zpx: 120000, Zpy: 58900, rx: 48.9, ry: 30.2, J: 63200, Cw: 10.0e9, mass: 19.9, bf_2tf: 7.50, hw_tw: 19.6 },
    { designation: 'HEA 140', type: 'H-section', h: 133, b: 140, tw: 5.5, tf: 8.5, r: 12, A: 3140, Ix: 10300000, Iy: 3890000, Zx: 155000, Zy: 55600, Zpx: 174000, Zpy: 84900, rx: 57.2, ry: 35.2, J: 84100, Cw: 22.5e9, mass: 24.7, bf_2tf: 8.24, hw_tw: 21.1 },
    { designation: 'HEA 160', type: 'H-section', h: 152, b: 160, tw: 6.0, tf: 9.0, r: 15, A: 3880, Ix: 16700000, Iy: 6160000, Zx: 220000, Zy: 77000, Zpx: 246000, Zpy: 118000, rx: 65.7, ry: 39.8, J: 122000, Cw: 47.9e9, mass: 30.4, bf_2tf: 8.89, hw_tw: 22.3 },
    { designation: 'HEA 180', type: 'H-section', h: 171, b: 180, tw: 6.0, tf: 9.5, r: 15, A: 4530, Ix: 25100000, Iy: 9250000, Zx: 294000, Zy: 103000, Zpx: 325000, Zpy: 157000, rx: 74.5, ry: 45.2, J: 155000, Cw: 93.7e9, mass: 35.5, bf_2tf: 9.47, hw_tw: 25.3 },
    { designation: 'HEA 200', type: 'H-section', h: 190, b: 200, tw: 6.5, tf: 10.0, r: 18, A: 5380, Ix: 36900000, Iy: 13400000, Zx: 389000, Zy: 134000, Zpx: 430000, Zpy: 204000, rx: 82.8, ry: 49.9, J: 209000, Cw: 166e9, mass: 42.3, bf_2tf: 10.0, hw_tw: 26.2 },
    { designation: 'HEA 220', type: 'H-section', h: 210, b: 220, tw: 7.0, tf: 11.0, r: 18, A: 6430, Ix: 54100000, Iy: 19500000, Zx: 515000, Zy: 177000, Zpx: 569000, Zpy: 271000, rx: 91.7, ry: 55.1, J: 284000, Cw: 296e9, mass: 50.5, bf_2tf: 10.0, hw_tw: 26.9 },
    { designation: 'HEA 240', type: 'H-section', h: 230, b: 240, tw: 7.5, tf: 12.0, r: 21, A: 7680, Ix: 77600000, Iy: 27700000, Zx: 675000, Zy: 231000, Zpx: 745000, Zpy: 352000, rx: 101, ry: 60.0, J: 401000, Cw: 515e9, mass: 60.3, bf_2tf: 10.0, hw_tw: 27.5 },
    { designation: 'HEA 260', type: 'H-section', h: 250, b: 260, tw: 7.5, tf: 12.5, r: 24, A: 8680, Ix: 104000000, Iy: 36700000, Zx: 836000, Zy: 282000, Zpx: 920000, Zpy: 431000, rx: 110, ry: 65.0, J: 490000, Cw: 810e9, mass: 68.2, bf_2tf: 10.4, hw_tw: 30.0 },
    { designation: 'HEA 280', type: 'H-section', h: 270, b: 280, tw: 8.0, tf: 13.0, r: 24, A: 9730, Ix: 137000000, Iy: 47600000, Zx: 1010000, Zy: 340000, Zpx: 1110000, Zpy: 519000, rx: 118, ry: 69.9, J: 622000, Cw: 1210e9, mass: 76.4, bf_2tf: 10.8, hw_tw: 30.5 },
    { designation: 'HEA 300', type: 'H-section', h: 290, b: 300, tw: 8.5, tf: 14.0, r: 27, A: 11300, Ix: 183000000, Iy: 63100000, Zx: 1260000, Zy: 421000, Zpx: 1380000, Zpy: 641000, rx: 127, ry: 74.7, J: 850000, Cw: 1850e9, mass: 88.3, bf_2tf: 10.7, hw_tw: 30.8 },
  ],
  
  // HEB - European Wide Flange Beams (Standard)
  HEB: [
    { designation: 'HEB 100', type: 'H-section', h: 100, b: 100, tw: 6.0, tf: 10.0, r: 12, A: 2600, Ix: 4500000, Iy: 1670000, Zx: 90000, Zy: 33500, Zpx: 104000, Zpy: 51400, rx: 41.6, ry: 25.3, J: 93700, Cw: 4.93e9, mass: 20.4, bf_2tf: 5.00, hw_tw: 13.3 },
    { designation: 'HEB 120', type: 'H-section', h: 120, b: 120, tw: 6.5, tf: 11.0, r: 12, A: 3400, Ix: 8640000, Iy: 3180000, Zx: 144000, Zy: 53000, Zpx: 166000, Zpy: 80900, rx: 50.4, ry: 30.6, J: 144000, Cw: 13.8e9, mass: 26.7, bf_2tf: 5.45, hw_tw: 15.1 },
    { designation: 'HEB 140', type: 'H-section', h: 140, b: 140, tw: 7.0, tf: 12.0, r: 12, A: 4300, Ix: 15100000, Iy: 5500000, Zx: 216000, Zy: 78600, Zpx: 246000, Zpy: 120000, rx: 59.3, ry: 35.8, J: 216000, Cw: 32.0e9, mass: 33.7, bf_2tf: 5.83, hw_tw: 16.6 },
    { designation: 'HEB 160', type: 'H-section', h: 160, b: 160, tw: 8.0, tf: 13.0, r: 15, A: 5430, Ix: 24900000, Iy: 8890000, Zx: 311000, Zy: 111000, Zpx: 354000, Zpy: 170000, rx: 67.8, ry: 40.5, J: 332000, Cw: 68.2e9, mass: 42.6, bf_2tf: 6.15, hw_tw: 16.8 },
    { designation: 'HEB 180', type: 'H-section', h: 180, b: 180, tw: 8.5, tf: 14.0, r: 15, A: 6530, Ix: 38300000, Iy: 13600000, Zx: 426000, Zy: 151000, Zpx: 482000, Zpy: 231000, rx: 76.6, ry: 45.6, J: 474000, Cw: 134e9, mass: 51.2, bf_2tf: 6.43, hw_tw: 17.9 },
    { designation: 'HEB 200', type: 'H-section', h: 200, b: 200, tw: 9.0, tf: 15.0, r: 18, A: 7810, Ix: 56900000, Iy: 20000000, Zx: 570000, Zy: 200000, Zpx: 642000, Zpy: 306000, rx: 85.4, ry: 50.7, J: 669000, Cw: 241e9, mass: 61.3, bf_2tf: 6.67, hw_tw: 18.9 },
    { designation: 'HEB 220', type: 'H-section', h: 220, b: 220, tw: 9.5, tf: 16.0, r: 18, A: 9100, Ix: 80900000, Iy: 28400000, Zx: 736000, Zy: 258000, Zpx: 827000, Zpy: 395000, rx: 94.3, ry: 55.9, J: 872000, Cw: 411e9, mass: 71.5, bf_2tf: 6.88, hw_tw: 19.8 },
    { designation: 'HEB 240', type: 'H-section', h: 240, b: 240, tw: 10.0, tf: 17.0, r: 21, A: 10600, Ix: 112000000, Iy: 39200000, Zx: 938000, Zy: 327000, Zpx: 1050000, Zpy: 500000, rx: 103, ry: 60.8, J: 1150000, Cw: 687e9, mass: 83.2, bf_2tf: 7.06, hw_tw: 20.6 },
    { designation: 'HEB 260', type: 'H-section', h: 260, b: 260, tw: 10.0, tf: 17.5, r: 24, A: 11800, Ix: 149000000, Iy: 51300000, Zx: 1150000, Zy: 395000, Zpx: 1280000, Zpy: 603000, rx: 112, ry: 65.8, J: 1380000, Cw: 1040e9, mass: 93.0, bf_2tf: 7.43, hw_tw: 22.5 },
    { designation: 'HEB 280', type: 'H-section', h: 280, b: 280, tw: 10.5, tf: 18.0, r: 24, A: 13100, Ix: 193000000, Iy: 65900000, Zx: 1380000, Zy: 471000, Zpx: 1530000, Zpy: 718000, rx: 121, ry: 70.9, J: 1720000, Cw: 1520e9, mass: 103, bf_2tf: 7.78, hw_tw: 23.2 },
    { designation: 'HEB 300', type: 'H-section', h: 300, b: 300, tw: 11.0, tf: 19.0, r: 27, A: 14900, Ix: 252000000, Iy: 85600000, Zx: 1680000, Zy: 571000, Zpx: 1870000, Zpy: 870000, rx: 130, ry: 75.8, J: 2240000, Cw: 2280e9, mass: 117, bf_2tf: 7.89, hw_tw: 23.8 },
  ],
};

// =============================================================================
// PARTIAL SAFETY FACTORS
// =============================================================================

export const STEEL_SAFETY_FACTORS: Record<SteelDesignCode, {
  gamma_m0: number;  // Material factor for yielding
  gamma_m1: number;  // Material factor for buckling
  gamma_mw: number;  // Material factor for welds
  gamma_mb: number;  // Material factor for bolts
  phi_t: number;     // Resistance factor - tension
  phi_c: number;     // Resistance factor - compression
  phi_b: number;     // Resistance factor - flexure
  phi_v: number;     // Resistance factor - shear
}> = {
  IS800: { gamma_m0: 1.10, gamma_m1: 1.10, gamma_mw: 1.25, gamma_mb: 1.25, phi_t: 0.91, phi_c: 0.91, phi_b: 0.91, phi_v: 0.91 },
  AISC360: { gamma_m0: 1.00, gamma_m1: 1.00, gamma_mw: 1.00, gamma_mb: 1.00, phi_t: 0.90, phi_c: 0.90, phi_b: 0.90, phi_v: 1.00 },
  EN1993: { gamma_m0: 1.00, gamma_m1: 1.00, gamma_mw: 1.25, gamma_mb: 1.25, phi_t: 1.00, phi_c: 1.00, phi_b: 1.00, phi_v: 1.00 },
  AS4100: { gamma_m0: 1.00, gamma_m1: 1.00, gamma_mw: 1.00, gamma_mb: 1.00, phi_t: 0.90, phi_c: 0.90, phi_b: 0.90, phi_v: 0.90 },
};

// =============================================================================
// BUCKLING CURVES (EN 1993)
// =============================================================================

export const BUCKLING_CURVES: Record<'a0' | 'a' | 'b' | 'c' | 'd', number> = {
  a0: 0.13,
  a: 0.21,
  b: 0.34,
  c: 0.49,
  d: 0.76,
};

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Get all sections of a specific type
 */
export function getSections(standard: 'IS' | 'AISC' | 'EN', type?: SectionType): SteelSection[] {
  let database: Record<string, SteelSection[]>;
  
  if (standard === 'IS') database = INDIAN_SECTIONS;
  else if (standard === 'AISC') database = AISC_SECTIONS;
  else database = EUROPEAN_SECTIONS;
  
  const allSections = Object.values(database).flat();
  
  if (type) {
    return allSections.filter(s => s.type === type);
  }
  return allSections;
}

/**
 * Find a section by designation
 */
export function findSection(designation: string): SteelSection | undefined {
  const allDatabases = [INDIAN_SECTIONS, AISC_SECTIONS, EUROPEAN_SECTIONS];
  
  for (const db of allDatabases) {
    for (const sections of Object.values(db)) {
      const found = sections.find(s => s.designation === designation);
      if (found) return found;
    }
  }
  return undefined;
}

/**
 * Get steel grade by designation
 */
export function getSteelGrade(designation: SteelGradeType): SteelGrade {
  return STEEL_GRADES[designation];
}

/**
 * Calculate effective length factor
 */
export function getEffectiveLengthFactor(
  endCondition: 'fixed-fixed' | 'fixed-pinned' | 'pinned-pinned' | 'fixed-free' | 'fixed-roller'
): number {
  const factors: Record<string, number> = {
    'fixed-fixed': 0.65,
    'fixed-pinned': 0.80,
    'pinned-pinned': 1.00,
    'fixed-free': 2.00,
    'fixed-roller': 1.20,
  };
  return factors[endCondition] || 1.0;
}

/**
 * Classify section per EN 1993-1-1
 */
export function classifySection(
  section: SteelSection,
  fy: number,
  axialStressRatio: number = 0  // N/A*fy, positive for compression
): SectionClassification {
  const epsilon = Math.sqrt(235 / fy);
  
  // For I/H sections in bending
  if (section.type === 'I-section' || section.type === 'H-section') {
    const cf_tf = (section.bf_2tf || (section.b / (2 * section.tf)));
    const cw_tw = (section.hw_tw || ((section.h - 2 * section.tf) / section.tw));
    
    // Flange classification (in compression)
    let flangeClass: SectionClassification;
    if (cf_tf <= 9 * epsilon) flangeClass = 'Class1';
    else if (cf_tf <= 10 * epsilon) flangeClass = 'Class2';
    else if (cf_tf <= 14 * epsilon) flangeClass = 'Class3';
    else flangeClass = 'Class4';
    
    // Web classification (in bending)
    let webClass: SectionClassification;
    if (cw_tw <= 72 * epsilon) webClass = 'Class1';
    else if (cw_tw <= 83 * epsilon) webClass = 'Class2';
    else if (cw_tw <= 124 * epsilon) webClass = 'Class3';
    else webClass = 'Class4';
    
    // Overall classification is the worst of flange and web
    const classes = ['Class1', 'Class2', 'Class3', 'Class4'];
    const flangeIdx = classes.indexOf(flangeClass);
    const webIdx = classes.indexOf(webClass);
    
    return classes[Math.max(flangeIdx, webIdx)] as SectionClassification;
  }
  
  // For hollow sections
  if (section.type === 'RHS' || section.type === 'SHS') {
    const t = section.t || section.tw;
    const b_t = (section.b - 2 * t) / t;
    const h_t = (section.h - 2 * t) / t;
    
    const max_ratio = Math.max(b_t, h_t);
    
    if (max_ratio <= 33 * epsilon) return 'Class1';
    if (max_ratio <= 38 * epsilon) return 'Class2';
    if (max_ratio <= 42 * epsilon) return 'Class3';
    return 'Class4';
  }
  
  if (section.type === 'CHS') {
    const D = section.D || section.h;
    const t = section.t || section.tw;
    const D_t = D / t;
    
    if (D_t <= 50 * epsilon * epsilon) return 'Class1';
    if (D_t <= 70 * epsilon * epsilon) return 'Class2';
    if (D_t <= 90 * epsilon * epsilon) return 'Class3';
    return 'Class4';
  }
  
  return 'Class3';  // Default for other section types
}

// =============================================================================
// EXPORTS
// =============================================================================

export const STEEL_DESIGN_VERSION = {
  version: '1.0.0',
  supportedCodes: ['IS 800:2007', 'AISC 360-22', 'EN 1993-1-1:2005', 'AS 4100:2020'],
  sectionDatabases: ['Indian (IS)', 'American (AISC)', 'European (EN)'],
};
