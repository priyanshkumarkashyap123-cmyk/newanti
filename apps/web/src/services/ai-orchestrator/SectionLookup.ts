/**
 * ============================================================================
 * SECTION LOOKUP SERVICE
 * ============================================================================
 * 
 * Bridges the gap between the AI structure generators (which output section
 * names like "ISMB 300") and the design check engines (which need full
 * section properties: Zx, Zy, rx, ry, tf, tw, etc.).
 * 
 * Imports from the existing SectionDatabase and provides instant lookup
 * with the exact shapes needed by IS800Checker.MemberProperties.
 * 
 * @version 1.0.0
 */

// ============================================================================
// TYPES (matching IS800Checker expectations)
// ============================================================================

export interface SteelSection {
  name: string;
  type: 'I-BEAM' | 'CHANNEL' | 'ANGLE' | 'TUBE' | 'RECTANGLE' | 'CIRCLE';
  depth: number;          // mm
  width: number;          // mm (flange width for I/C, leg for L)
  webThickness: number;   // mm
  flangeThickness: number;// mm
  area: number;           // mm²
  Ix: number;             // mm⁴ (strong axis)
  Iy: number;             // mm⁴ (weak axis)
  Zx: number;             // mm³ (plastic modulus, strong)
  Zy: number;             // mm³ (plastic modulus, weak)
  Sx: number;             // mm³ (elastic modulus, strong)
  Sy: number;             // mm³ (elastic modulus, weak)
  rx: number;             // mm (radius of gyration, strong)
  ry: number;             // mm (radius of gyration, weak)
  J: number;              // mm⁴ (torsional constant)
  weight: number;         // kg/m
}

export interface SteelMaterial {
  grade: string;
  fy: number;   // MPa (yield strength)
  fu: number;   // MPa (ultimate tensile strength)
  E: number;    // MPa (Young's modulus)
  G: number;    // MPa (Shear modulus)
  density: number; // kg/m³
}

export interface MemberDesignProperties {
  section: SteelSection;
  material: SteelMaterial;
  length: number;             // mm
  effectiveLengthY: number;   // mm
  effectiveLengthZ: number;   // mm
  unbracedLength: number;     // mm (for lateral-torsional buckling)
}

// ============================================================================
// MATERIAL DATABASE
// ============================================================================

const MATERIALS: Record<string, SteelMaterial> = {
  E250: { grade: 'E250', fy: 250, fu: 410, E: 200000, G: 76923, density: 7850 },
  E300: { grade: 'E300', fy: 300, fu: 440, E: 200000, G: 76923, density: 7850 },
  E350: { grade: 'E350', fy: 350, fu: 490, E: 200000, G: 76923, density: 7850 },
  E410: { grade: 'E410', fy: 410, fu: 540, E: 200000, G: 76923, density: 7850 },
  E450: { grade: 'E450', fy: 450, fu: 570, E: 200000, G: 76923, density: 7850 },
  // ASTM grades
  A36:      { grade: 'A36',      fy: 250, fu: 400, E: 200000, G: 76923, density: 7850 },
  A572_50:  { grade: 'A572-50',  fy: 345, fu: 450, E: 200000, G: 76923, density: 7850 },
  A992:     { grade: 'A992',     fy: 345, fu: 450, E: 200000, G: 76923, density: 7850 },
  S275:     { grade: 'S275',     fy: 275, fu: 430, E: 210000, G: 80769, density: 7850 },
  S355:     { grade: 'S355',     fy: 355, fu: 510, E: 210000, G: 80769, density: 7850 },
};

// ============================================================================
// INDIAN STANDARD SECTION DATABASE
// ============================================================================

const ISMB_SECTIONS: Record<string, SteelSection> = {
  'ISMB 100': { name: 'ISMB 100', type: 'I-BEAM', depth: 100, width: 75, webThickness: 4.0, flangeThickness: 7.2, area: 1140, Ix: 2.57e6, Iy: 0.409e6, Sx: 51400, Sy: 10900, Zx: 58500, Zy: 17300, rx: 47.5, ry: 18.9, J: 14200, weight: 8.9 },
  'ISMB 150': { name: 'ISMB 150', type: 'I-BEAM', depth: 150, width: 80, webThickness: 4.8, flangeThickness: 7.6, area: 1840, Ix: 7.26e6, Iy: 0.529e6, Sx: 96800, Sy: 13200, Zx: 111000, Zy: 20800, rx: 62.8, ry: 17.0, J: 25200, weight: 14.9 },
  'ISMB 200': { name: 'ISMB 200', type: 'I-BEAM', depth: 200, width: 100, webThickness: 5.7, flangeThickness: 10.8, area: 2850, Ix: 22.35e6, Iy: 1.50e6, Sx: 223500, Sy: 30000, Zx: 254000, Zy: 46200, rx: 88.5, ry: 22.9, J: 75000, weight: 25.4 },
  'ISMB 250': { name: 'ISMB 250', type: 'I-BEAM', depth: 250, width: 125, webThickness: 6.9, flangeThickness: 12.5, area: 4750, Ix: 51.3e6, Iy: 3.34e6, Sx: 410400, Sy: 53400, Zx: 467000, Zy: 82800, rx: 104, ry: 26.5, J: 152000, weight: 37.3 },
  'ISMB 300': { name: 'ISMB 300', type: 'I-BEAM', depth: 300, width: 140, webThickness: 7.5, flangeThickness: 13.1, area: 5870, Ix: 86.0e6, Iy: 4.54e6, Sx: 573600, Sy: 64900, Zx: 653000, Zy: 100500, rx: 121, ry: 27.8, J: 202000, weight: 46.1 },
  'ISMB 350': { name: 'ISMB 350', type: 'I-BEAM', depth: 350, width: 140, webThickness: 8.1, flangeThickness: 14.2, area: 6670, Ix: 136.3e6, Iy: 5.38e6, Sx: 778900, Sy: 76800, Zx: 887000, Zy: 118600, rx: 143, ry: 28.4, J: 250000, weight: 52.4 },
  'ISMB 400': { name: 'ISMB 400', type: 'I-BEAM', depth: 400, width: 140, webThickness: 8.9, flangeThickness: 16.0, area: 7840, Ix: 204.6e6, Iy: 6.22e6, Sx: 1023000, Sy: 88800, Zx: 1176000, Zy: 137000, rx: 162, ry: 28.2, J: 366000, weight: 61.6 },
  'ISMB 450': { name: 'ISMB 450', type: 'I-BEAM', depth: 450, width: 150, webThickness: 9.4, flangeThickness: 17.4, area: 9220, Ix: 303.9e6, Iy: 8.09e6, Sx: 1350700, Sy: 107900, Zx: 1538000, Zy: 165000, rx: 182, ry: 29.6, J: 508000, weight: 72.4 },
  'ISMB 500': { name: 'ISMB 500', type: 'I-BEAM', depth: 500, width: 180, webThickness: 10.2, flangeThickness: 17.2, area: 11000, Ix: 452.2e6, Iy: 13.7e6, Sx: 1808700, Sy: 152200, Zx: 2060000, Zy: 232300, rx: 203, ry: 35.2, J: 618000, weight: 86.9 },
  'ISMB 550': { name: 'ISMB 550', type: 'I-BEAM', depth: 550, width: 190, webThickness: 11.2, flangeThickness: 19.3, area: 13200, Ix: 649.5e6, Iy: 18.0e6, Sx: 2362000, Sy: 189000, Zx: 2690000, Zy: 290000, rx: 222, ry: 36.9, J: 900000, weight: 103.7 },
  'ISMB 600': { name: 'ISMB 600', type: 'I-BEAM', depth: 600, width: 210, webThickness: 12.0, flangeThickness: 20.8, area: 15600, Ix: 918.1e6, Iy: 26.5e6, Sx: 3060300, Sy: 252400, Zx: 3486000, Zy: 387000, rx: 243, ry: 41.2, J: 1240000, weight: 122.6 },
};

const ISMC_SECTIONS: Record<string, SteelSection> = {
  'ISMC 75':  { name: 'ISMC 75',  type: 'CHANNEL', depth: 75,  width: 40,  webThickness: 4.4, flangeThickness: 7.3, area: 873,  Ix: 0.763e6, Iy: 0.122e6, Sx: 20300, Sy: 4990, Zx: 24200, Zy: 9100, rx: 29.6, ry: 11.8, J: 10000, weight: 6.8 },
  'ISMC 100': { name: 'ISMC 100', type: 'CHANNEL', depth: 100, width: 50,  webThickness: 5.0, flangeThickness: 7.5, area: 1170, Ix: 1.87e6, Iy: 0.261e6, Sx: 37400, Sy: 8240, Zx: 44300, Zy: 14400, rx: 40.0, ry: 14.9, J: 18000, weight: 9.2 },
  'ISMC 150': { name: 'ISMC 150', type: 'CHANNEL', depth: 150, width: 75,  webThickness: 5.7, flangeThickness: 9.0, area: 2170, Ix: 7.79e6, Iy: 1.03e6, Sx: 103900, Sy: 20600, Zx: 121500, Zy: 36200, rx: 59.9, ry: 21.8, J: 45000, weight: 17.0 },
  'ISMC 200': { name: 'ISMC 200', type: 'CHANNEL', depth: 200, width: 75,  webThickness: 6.2, flangeThickness: 11.4, area: 2830, Ix: 18.2e6, Iy: 1.41e6, Sx: 181900, Sy: 27200, Zx: 212000, Zy: 45800, rx: 80.2, ry: 22.3, J: 92000, weight: 22.1 },
  'ISMC 250': { name: 'ISMC 250', type: 'CHANNEL', depth: 250, width: 80,  webThickness: 7.1, flangeThickness: 14.1, area: 3870, Ix: 38.7e6, Iy: 2.12e6, Sx: 309700, Sy: 38100, Zx: 360000, Zy: 63600, rx: 100, ry: 23.4, J: 175000, weight: 30.4 },
  'ISMC 300': { name: 'ISMC 300', type: 'CHANNEL', depth: 300, width: 90,  webThickness: 7.8, flangeThickness: 13.6, area: 4560, Ix: 63.6e6, Iy: 3.10e6, Sx: 424000, Sy: 48800, Zx: 494000, Zy: 80200, rx: 118, ry: 26.1, J: 210000, weight: 35.8 },
};

const ISA_SECTIONS: Record<string, SteelSection> = {
  'ISA 50x50x6':    { name: 'ISA 50x50x6',    type: 'ANGLE', depth: 50,  width: 50,  webThickness: 6, flangeThickness: 6,  area: 569,  Ix: 0.115e6, Iy: 0.115e6, Sx: 3220, Sy: 3220, Zx: 5540, Zy: 5540, rx: 14.2, ry: 14.2, J: 7000, weight: 4.5 },
  'ISA 65x65x6':    { name: 'ISA 65x65x6',    type: 'ANGLE', depth: 65,  width: 65,  webThickness: 6, flangeThickness: 6,  area: 746,  Ix: 0.265e6, Iy: 0.265e6, Sx: 5720, Sy: 5720, Zx: 9840, Zy: 9840, rx: 18.8, ry: 18.8, J: 9000, weight: 5.8 },
  'ISA 75x75x8':    { name: 'ISA 75x75x8',    type: 'ANGLE', depth: 75,  width: 75,  webThickness: 8, flangeThickness: 8,  area: 1140, Ix: 0.522e6, Iy: 0.522e6, Sx: 9650, Sy: 9650, Zx: 16600, Zy: 16600, rx: 21.4, ry: 21.4, J: 24000, weight: 8.9 },
  'ISA 90x90x10':   { name: 'ISA 90x90x10',   type: 'ANGLE', depth: 90,  width: 90,  webThickness: 10, flangeThickness: 10, area: 1710, Ix: 1.13e6, Iy: 1.13e6, Sx: 17200, Sy: 17200, Zx: 29600, Zy: 29600, rx: 25.7, ry: 25.7, J: 57000, weight: 13.4 },
  'ISA 100x100x10': { name: 'ISA 100x100x10', type: 'ANGLE', depth: 100, width: 100, webThickness: 10, flangeThickness: 10, area: 1900, Ix: 1.57e6, Iy: 1.57e6, Sx: 21600, Sy: 21600, Zx: 37200, Zy: 37200, rx: 28.7, ry: 28.7, J: 63000, weight: 14.9 },
  'ISA 130x130x12': { name: 'ISA 130x130x12', type: 'ANGLE', depth: 130, width: 130, webThickness: 12, flangeThickness: 12, area: 2980, Ix: 4.13e6, Iy: 4.13e6, Sx: 43700, Sy: 43700, Zx: 75200, Zy: 75200, rx: 37.2, ry: 37.2, J: 143000, weight: 23.4 },
  'ISA 150x150x15': { name: 'ISA 150x150x15', type: 'ANGLE', depth: 150, width: 150, webThickness: 15, flangeThickness: 15, area: 4300, Ix: 7.98e6, Iy: 7.98e6, Sx: 72900, Sy: 72900, Zx: 125400, Zy: 125400, rx: 43.1, ry: 43.1, J: 322000, weight: 33.8 },
};

// ============================================================================
// UNIFIED LOOKUP
// ============================================================================

const ALL_SECTIONS: Record<string, SteelSection> = {
  ...ISMB_SECTIONS,
  ...ISMC_SECTIONS,
  ...ISA_SECTIONS,
};

// Section ordering by capacity (Zx) — for optimization
const ISMB_ORDERED: string[] = [
  'ISMB 100', 'ISMB 150', 'ISMB 200', 'ISMB 250', 'ISMB 300',
  'ISMB 350', 'ISMB 400', 'ISMB 450', 'ISMB 500', 'ISMB 550', 'ISMB 600',
];

const ISMC_ORDERED: string[] = [
  'ISMC 75', 'ISMC 100', 'ISMC 150', 'ISMC 200', 'ISMC 250', 'ISMC 300',
];

const ISA_ORDERED: string[] = [
  'ISA 50x50x6', 'ISA 65x65x6', 'ISA 75x75x8', 'ISA 90x90x10',
  'ISA 100x100x10', 'ISA 130x130x12', 'ISA 150x150x15',
];

// ============================================================================
// PUBLIC API
// ============================================================================

export class SectionLookup {
  /**
   * Look up full section properties by name.
   * Handles fuzzy matching: "ISMB300" → "ISMB 300", "ismb 300" → "ISMB 300"
   */
  static getSection(name: string): SteelSection | null {
    // Direct lookup
    if (ALL_SECTIONS[name]) return ALL_SECTIONS[name];

    // Normalize: remove extra spaces, uppercase
    const normalized = name.toUpperCase().replace(/\s+/g, ' ').trim();
    if (ALL_SECTIONS[normalized]) return ALL_SECTIONS[normalized];

    // Try adding space before digits: "ISMB300" → "ISMB 300"
    const withSpace = normalized.replace(/([A-Z])(\d)/, '$1 $2');
    if (ALL_SECTIONS[withSpace]) return ALL_SECTIONS[withSpace];

    // Fuzzy: search by partial match
    for (const [key, section] of Object.entries(ALL_SECTIONS)) {
      if (key.replace(/\s/g, '') === normalized.replace(/\s/g, '')) return section;
    }

    return null;
  }

  /**
   * Get material properties by grade name
   */
  static getMaterial(grade: string): SteelMaterial {
    const normalized = grade.toUpperCase().replace(/[-\s]/g, '_');
    return MATERIALS[normalized] || MATERIALS[grade] || MATERIALS.E250;
  }

  /**
   * Build full MemberDesignProperties from a member's section name, material, and length.
   * This bridges the gap between AI structure generators and the IS800Checker.
   * 
   * @param sectionName - e.g. "ISMB 300"
   * @param materialGrade - e.g. "E250"
   * @param length - member length in meters
   * @param effectiveK - effective length factor K (default 1.0 for pinned-pinned)
   */
  static getMemberDesignProps(
    sectionName: string,
    materialGrade: string = 'E250',
    lengthM: number = 1.0,
    effectiveK: number = 1.0,
  ): MemberDesignProperties | null {
    const section = SectionLookup.getSection(sectionName);
    if (!section) return null;

    const material = SectionLookup.getMaterial(materialGrade);
    const lengthMm = lengthM * 1000;

    return {
      section,
      material,
      length: lengthMm,
      effectiveLengthY: lengthMm * effectiveK,
      effectiveLengthZ: lengthMm * effectiveK,
      unbracedLength: lengthMm * effectiveK,
    };
  }

  /**
   * Get all ISMB sections ordered by capacity (for optimization)
   */
  static getISMBOrdered(): SteelSection[] {
    return ISMB_ORDERED.map(n => ALL_SECTIONS[n]).filter(Boolean);
  }

  /**
   * Get all ISMC sections ordered by capacity
   */
  static getISMCOrdered(): SteelSection[] {
    return ISMC_ORDERED.map(n => ALL_SECTIONS[n]).filter(Boolean);
  }

  /**
   * Get all ISA sections ordered by capacity
   */
  static getISAOrdered(): SteelSection[] {
    return ISA_ORDERED.map(n => ALL_SECTIONS[n]).filter(Boolean);
  }

  /**
   * Find the lightest section that satisfies a minimum plastic modulus Zx
   */
  static selectByMomentCapacity(
    requiredZx: number, // mm³
    type: 'ISMB' | 'ISMC' | 'ISA' = 'ISMB',
    materialGrade: string = 'E250',
  ): SteelSection | null {
    const material = SectionLookup.getMaterial(materialGrade);
    const ordered = type === 'ISMB' ? SectionLookup.getISMBOrdered()
      : type === 'ISMC' ? SectionLookup.getISMCOrdered()
      : SectionLookup.getISAOrdered();

    // requiredZx must produce enough capacity: Md = Zx * fy / γm0
    // So Zx ≥ requiredMoment * γm0 / fy → we just compare Zx directly
    for (const s of ordered) {
      if (s.Zx >= requiredZx) return s;
    }
    // Return the heaviest if nothing is sufficient
    return ordered[ordered.length - 1] || null;
  }

  /**
   * Select section by required axial capacity (compression)
   */
  static selectByAxialCapacity(
    requiredAreaTimesStress: number, // N (axial force)
    type: 'ISMB' | 'ISMC' | 'ISA' = 'ISMB',
    materialGrade: string = 'E250',
    effectiveLengthMm: number = 3000,
  ): SteelSection | null {
    const material = SectionLookup.getMaterial(materialGrade);
    const ordered = type === 'ISMB' ? SectionLookup.getISMBOrdered()
      : type === 'ISMC' ? SectionLookup.getISMCOrdered()
      : SectionLookup.getISAOrdered();

    for (const s of ordered) {
      // Simplified compression capacity: Pd ≈ χ * A * fy / γm0
      // Use simplified χ based on slenderness
      const lambda = effectiveLengthMm / s.ry; // worst case
      const lambdaE = Math.PI * Math.sqrt(material.E / material.fy);
      const lambdaBar = lambda / lambdaE;
      const alpha = 0.34; // imperfection factor for class 'b'
      const phi = 0.5 * (1 + alpha * (lambdaBar - 0.2) + lambdaBar * lambdaBar);
      const chi = Math.min(1.0, 1.0 / (phi + Math.sqrt(phi * phi - lambdaBar * lambdaBar)));
      const Pd = chi * s.area * material.fy / 1.10; // N

      if (Pd >= Math.abs(requiredAreaTimesStress)) return s;
    }

    return ordered[ordered.length - 1] || null;
  }

  /**
   * Convert section properties to model-store format
   * (area in m², I in m⁴, E in kN/m²)
   */
  static toModelUnits(section: SteelSection, material: SteelMaterial): {
    A: number; I: number; E: number;
  } {
    return {
      A: section.area * 1e-6,          // mm² → m²
      I: section.Ix * 1e-12,           // mm⁴ → m⁴
      E: material.E * 1000,            // MPa → kN/m² (200,000 MPa = 200,000,000 kN/m²)
    };
  }

  /**
   * Get all available section names for a given type
   */
  static getSectionNames(type?: 'ISMB' | 'ISMC' | 'ISA'): string[] {
    if (type === 'ISMB') return [...ISMB_ORDERED];
    if (type === 'ISMC') return [...ISMC_ORDERED];
    if (type === 'ISA') return [...ISA_ORDERED];
    return Object.keys(ALL_SECTIONS);
  }
}

export default SectionLookup;
