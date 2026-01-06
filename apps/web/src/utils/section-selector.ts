/**
 * SECTION SELECTOR UTILITY
 * 
 * Helper functions for accessing Indian standard structural sections
 * Standards: IS 808 (I-sections, channels, angles), IS 1161 (CHS), IS 4923 (SHS/RHS)
 * 
 * Usage:
 *   const section = getSectionProperties('ISMC 150');
 *   const allAngles = filterSectionsByType('Equal Angle');
 *   const bestFit = findSectionByMinArea(5000); // mm²
 */

import sectionLibrary from '../database/indian-section-library.json';

// Types
export interface SectionDimensions {
  depth?: number;
  width?: number;
  web_thickness?: number;
  flange_thickness?: number;
  root_radius?: number;
  toe_radius?: number;
  leg_a?: number;
  leg_b?: number;
  thickness?: number;
  outer_diameter?: number;
  wall_thickness?: number;
  height?: number;
  corner_radius?: number;
}

export interface SectionProperties {
  area: number;
  Iyy?: number;
  Izz?: number;
  Iuu?: number;
  Ivv?: number;
  I?: number;
  Iw: number | null;
  J: number;
  ry?: number;
  rz?: number;
  ruu?: number;
  rvv?: number;
  r?: number;
  Zy?: number;
  Zz?: number;
  Zuu?: number;
  Zvv?: number;
  Z?: number;
}

export interface Section {
  designation: string;
  type: string;
  standard: string;
  dimensions: SectionDimensions;
  properties: SectionProperties;
  mass_per_meter: number;
  application: string;
}

export interface MaterialProperties {
  E: number;
  G: number;
  density: number;
  poisson: number;
  yield_strength: number;
  ultimate_strength: number;
}

// Cache for faster repeated access
let allSectionsCache: Section[] | null = null;

/**
 * Get all sections from the library as a flat array
 */
export function getAllSections(): Section[] {
  if (allSectionsCache) {
    return allSectionsCache;
  }

  const sections: Section[] = [];
  const library = sectionLibrary.sections;

  // Flatten all section categories
  Object.values(library).forEach((category) => {
    if (Array.isArray(category)) {
      sections.push(...(category as Section[]));
    }
  });

  allSectionsCache = sections;
  return sections;
}

/**
 * Get section properties by designation (e.g., 'ISMC 150', 'ISA 65×65×6')
 */
export function getSectionProperties(designation: string): Section | null {
  const sections = getAllSections();
  return sections.find(s => s.designation === designation) || null;
}

/**
 * Filter sections by type
 * Types: 'Channel', 'I-Beam', 'Equal Angle', 'Unequal Angle', 'Circular Hollow', 'Square Hollow', 'Rectangular Hollow'
 */
export function filterSectionsByType(type: string): Section[] {
  const sections = getAllSections();
  return sections.filter(s => s.type === type);
}

/**
 * Filter sections by standard
 * Standards: 'IS 808', 'IS 1161', 'IS 4923'
 */
export function filterSectionsByStandard(standard: string): Section[] {
  const sections = getAllSections();
  return sections.filter(s => s.standard === standard);
}

/**
 * Find section with minimum cross-sectional area >= target area (in m²)
 */
export function findSectionByMinArea(minArea: number, type?: string): Section | null {
  let sections = getAllSections();
  
  if (type) {
    sections = sections.filter(s => s.type === type);
  }

  const candidates = sections.filter(s => s.properties.area >= minArea);
  
  if (candidates.length === 0) {
    return null;
  }

  // Return section with smallest area that meets requirement
  return candidates.reduce((min, s) => 
    s.properties.area < min.properties.area ? s : min
  );
}

/**
 * Find section with minimum radius of gyration >= target r_min (in meters)
 */
export function findSectionByMinRadiusOfGyration(
  minRadius: number, 
  axis: 'yy' | 'zz' | 'uu' | 'vv' | 'min' = 'min',
  type?: string
): Section | null {
  let sections = getAllSections();
  
  if (type) {
    sections = sections.filter(s => s.type === type);
  }

  const candidates = sections.filter(s => {
    const props = s.properties;
    
    if (axis === 'min') {
      // Find minimum radius of gyration for this section
      const radii = [props.ry, props.rz, props.ruu, props.rvv, props.r].filter(r => r !== undefined) as number[];
      const rMin = Math.min(...radii);
      return rMin >= minRadius;
    }
    
    switch (axis) {
      case 'yy': return props.ry !== undefined && props.ry >= minRadius;
      case 'zz': return props.rz !== undefined && props.rz >= minRadius;
      case 'uu': return props.ruu !== undefined && props.ruu >= minRadius;
      case 'vv': return props.rvv !== undefined && props.rvv >= minRadius;
      default: return false;
    }
  });

  if (candidates.length === 0) {
    return null;
  }

  // Return lightest section that meets requirement
  return candidates.reduce((min, s) => 
    s.mass_per_meter < min.mass_per_meter ? s : min
  );
}

/**
 * Find section with minimum section modulus >= target Z (in m³)
 */
export function findSectionByMinSectionModulus(
  minZ: number,
  axis: 'yy' | 'zz' | 'uu' | 'vv' = 'yy',
  type?: string
): Section | null {
  let sections = getAllSections();
  
  if (type) {
    sections = sections.filter(s => s.type === type);
  }

  const candidates = sections.filter(s => {
    const props = s.properties;
    switch (axis) {
      case 'yy': return props.Zy !== undefined && props.Zy >= minZ;
      case 'zz': return props.Zz !== undefined && props.Zz >= minZ;
      case 'uu': return props.Zuu !== undefined && props.Zuu >= minZ;
      case 'vv': return props.Zvv !== undefined && props.Zvv >= minZ;
      default: return false;
    }
  });

  if (candidates.length === 0) {
    return null;
  }

  // Return lightest section that meets requirement
  return candidates.reduce((min, s) => 
    s.mass_per_meter < min.mass_per_meter ? s : min
  );
}

/**
 * Get default material properties for steel (IS 2062)
 */
export function getDefaultMaterialProperties(): MaterialProperties {
  return sectionLibrary.metadata.material_defaults.steel;
}

/**
 * Calculate slenderness ratio (λ = k×L / r_min)
 * @param effectiveLength - Effective buckling length (m)
 * @param section - Section designation or Section object
 * @returns Slenderness ratio (dimensionless)
 */
export function calculateSlendernessRatio(
  effectiveLength: number,
  section: string | Section
): number {
  const sectionData = typeof section === 'string' 
    ? getSectionProperties(section) 
    : section;

  if (!sectionData) {
    throw new Error(`Section not found: ${section}`);
  }

  const props = sectionData.properties;
  const radii = [props.ry, props.rz, props.ruu, props.rvv, props.r].filter(r => r !== undefined) as number[];
  
  if (radii.length === 0) {
    throw new Error(`No radius of gyration found for section: ${sectionData.designation}`);
  }

  const rMin = Math.min(...radii);
  return effectiveLength / rMin;
}

/**
 * Calculate Euler buckling load (P_cr = π² × E × I / L²)
 * @param effectiveLength - Effective buckling length (m)
 * @param section - Section designation or Section object
 * @param axis - Buckling axis ('yy' or 'zz', defaults to weaker axis)
 * @returns Critical buckling load (N)
 */
export function calculateEulerBucklingLoad(
  effectiveLength: number,
  section: string | Section,
  axis?: 'yy' | 'zz'
): number {
  const sectionData = typeof section === 'string' 
    ? getSectionProperties(section) 
    : section;

  if (!sectionData) {
    throw new Error(`Section not found: ${section}`);
  }

  const props = sectionData.properties;
  const E = getDefaultMaterialProperties().E;

  let I: number;
  if (axis) {
    I = axis === 'yy' ? (props.Iyy || 0) : (props.Izz || 0);
  } else {
    // Use minimum moment of inertia (weaker axis)
    const inertias = [props.Iyy, props.Izz, props.Iuu, props.Ivv, props.I].filter(i => i !== undefined) as number[];
    I = Math.min(...inertias);
  }

  if (I === 0) {
    throw new Error(`Moment of inertia not available for section: ${sectionData.designation}`);
  }

  return (Math.PI ** 2 * E * I) / (effectiveLength ** 2);
}

/**
 * Calculate allowable bending moment (M_allow = Z × f_y / γ_m0)
 * @param section - Section designation or Section object
 * @param axis - Bending axis ('yy' or 'zz')
 * @param yieldStrength - Yield strength (Pa), optional (defaults to IS 2062 E250)
 * @returns Allowable moment (N⋅m)
 */
export function calculateAllowableMoment(
  section: string | Section,
  axis: 'yy' | 'zz' = 'yy',
  yieldStrength?: number
): number {
  const sectionData = typeof section === 'string' 
    ? getSectionProperties(section) 
    : section;

  if (!sectionData) {
    throw new Error(`Section not found: ${section}`);
  }

  const props = sectionData.properties;
  const fy = yieldStrength || getDefaultMaterialProperties().yield_strength;
  const gamma_m0 = 1.10; // IS 800 partial safety factor

  const Z = axis === 'yy' ? (props.Zy || 0) : (props.Zz || 0);

  if (Z === 0) {
    throw new Error(`Section modulus not available for ${axis} axis: ${sectionData.designation}`);
  }

  return (Z * fy) / gamma_m0;
}

/**
 * Calculate allowable tensile force (T_allow = A × f_y / γ_m0)
 * @param section - Section designation or Section object
 * @param yieldStrength - Yield strength (Pa), optional (defaults to IS 2062 E250)
 * @returns Allowable tension (N)
 */
export function calculateAllowableTension(
  section: string | Section,
  yieldStrength?: number
): number {
  const sectionData = typeof section === 'string' 
    ? getSectionProperties(section) 
    : section;

  if (!sectionData) {
    throw new Error(`Section not found: ${section}`);
  }

  const A = sectionData.properties.area;
  const fy = yieldStrength || getDefaultMaterialProperties().yield_strength;
  const gamma_m0 = 1.10; // IS 800 partial safety factor

  return (A * fy) / gamma_m0;
}

/**
 * Get section category summary (count of sections by type)
 */
export function getSectionCategorySummary(): Record<string, number> {
  const sections = getAllSections();
  const summary: Record<string, number> = {};

  sections.forEach(s => {
    summary[s.type] = (summary[s.type] || 0) + 1;
  });

  return summary;
}

/**
 * Search sections by designation pattern (e.g., 'ISMC', 'ISA 75', 'CHS')
 */
export function searchSections(pattern: string): Section[] {
  const sections = getAllSections();
  const regex = new RegExp(pattern, 'i');
  return sections.filter(s => regex.test(s.designation));
}

/**
 * Get section weight per unit length (kg/m to N/m conversion)
 */
export function getSectionWeight(section: string | Section): number {
  const sectionData = typeof section === 'string' 
    ? getSectionProperties(section) 
    : section;

  if (!sectionData) {
    throw new Error(`Section not found: ${section}`);
  }

  return sectionData.mass_per_meter * 9.81; // kg/m → N/m
}

/**
 * Export section data to CSV format
 */
export function exportSectionsToCSV(sections?: Section[]): string {
  const data = sections || getAllSections();
  
  const headers = [
    'Designation',
    'Type',
    'Standard',
    'Area (m²)',
    'Iyy (m⁴)',
    'Izz (m⁴)',
    'J (m⁴)',
    'ry (m)',
    'rz (m)',
    'Mass (kg/m)',
    'Application'
  ];

  const rows = data.map(s => [
    s.designation,
    s.type,
    s.standard,
    s.properties.area.toExponential(3),
    (s.properties.Iyy || s.properties.I || 0).toExponential(3),
    (s.properties.Izz || s.properties.I || 0).toExponential(3),
    s.properties.J.toExponential(3),
    (s.properties.ry || s.properties.r || 0).toFixed(4),
    (s.properties.rz || s.properties.r || 0).toFixed(4),
    s.mass_per_meter.toFixed(2),
    `"${s.application}"`
  ]);

  return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
}

// Export metadata
export const SECTION_LIBRARY_VERSION = sectionLibrary.metadata.version;
export const SUPPORTED_STANDARDS = ['IS 808', 'IS 1161', 'IS 4923'];
export const SECTION_TYPES = [
  'Channel',
  'I-Beam',
  'Equal Angle',
  'Unequal Angle',
  'Circular Hollow',
  'Square Hollow',
  'Rectangular Hollow'
];
