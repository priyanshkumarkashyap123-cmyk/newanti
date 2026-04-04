/**
 * Code Reference Guide Service
 * 
 * Comprehensive reference for Indian structural design codes:
 * - IS 800:2007 (Steel Structures)
 * - IS 456:2000 (Concrete Structures)
 * - IS 1893:2002 (Seismic Design)
 * - IS 875:1987 (Wind & Snow Loads)
 * 
 * Used for:
 * 1. Contextual help in the app
 * 2. Smart defaults selection
 * 3. Design criteria validation
 * 4. Educational reference
 */

export interface CodeSection {
  code: string;
  section: string;
  title: string;
  description: string;
  criteria: string;
  examples: string[];
  units: string;
  relatedSections: string[];
}

export interface MaterialProperties {
  name: string;
  code: string;
  grade: string;
  yield: number; // MPa
  ultimate: number; // MPa
  density: number; // kg/m³
  youngModulus: number; // GPa
  poisson: number;
  thermalExpansion: number; // per °C
  fireResistance: string;
}

export interface StandardDefaults {
  code: string;
  material: string;
  deadLoad: number; // kN/m² for typical floors
  liveLoad: number; // kN/m²
  windVersion: string; // e.g., "Vb=45 m/s"
  seismicZones: Record<string, number>; // Zone -> Z factor
  importanceFactor: Record<string, number>;
  responseFactor: Record<string, number>;
}

// ============================================================================
// IS 800:2007 - STEEL STRUCTURES
// ============================================================================

export const IS800_STEEL_GRADES: MaterialProperties[] = [
  {
    name: "IS 2062 Grade A",
    code: "IS 800:2007",
    grade: "250 MPa",
    yield: 250,
    ultimate: 400,
    density: 7850,
    youngModulus: 200,
    poisson: 0.3,
    thermalExpansion: 1.2e-5,
    fireResistance: "600°C @ 30 min",
  },
  {
    name: "IS 2062 Grade B",
    code: "IS 800:2007",
    grade: "300 MPa",
    yield: 300,
    ultimate: 450,
    density: 7850,
    youngModulus: 200,
    poisson: 0.3,
    thermalExpansion: 1.2e-5,
    fireResistance: "600°C @ 30 min",
  },
  {
    name: "IS 2062 Grade C",
    code: "IS 800:2007",
    grade: "350 MPa",
    yield: 350,
    ultimate: 490,
    density: 7850,
    youngModulus: 200,
    poisson: 0.3,
    thermalExpansion: 1.2e-5,
    fireResistance: "600°C @ 30 min",
  },
];

export const IS800_MEMBER_DESIGN: CodeSection[] = [
  {
    code: "IS 800:2007",
    section: "§7.1",
    title: "Tensile Member Design",
    description:
      "Tensile members must be checked for gross section rupture and net section rupture",
    criteria:
      "Pt = 0.9 × fy × An / gm ≤ 0.6 × fu × An / gm (Limit State Design)",
    examples: [
      "Steel braced frame diagonal: T = 150 kN, Grade 250 steel, use 2-ISA 65×65×6",
      "Tie member in roof truss: T = 80 kN, Grade 300 steel, use 2-ISA 50×50×5",
    ],
    units: "kN (force)",
    relatedSections: ["§7.2", "§10.3.1"],
  },
  {
    code: "IS 800:2007",
    section: "§7.2",
    title: "Compression Member Design (Buckling)",
    description:
      "Compression members must be checked for flexural, torsional, and flexural-torsional buckling",
    criteria:
      "Pc = (π² E I) / (KL)² ≥ Pd (buckling capacity ≥ factored design force)",
    examples: [
      "Building column 4m height: P = 500 kN, Grade 250 steel, ISMB 400, λ = 95 (OK)",
      "Truss top chord: 6m length, P = 200 kN, ISA 100×100, check λ ≤ 250",
    ],
    units: "kN (force)",
    relatedSections: ["§6.2", "§7.1"],
  },
  {
    code: "IS 800:2007",
    section: "§7.3",
    title: "Bending Member Design",
    description:
      "Flexural members checked for bending stress, shear stress, and lateral torsional buckling",
    criteria: "Md = (Z × fy) / gm ≥ Mdesign (moment capacity ≥ factored moment)",
    examples: [
      "Floor beam 6m span: M = 150 kNm, Grade 250 steel, ISMB 300 (Zx = 1120 cm³)",
      "Roof beam with continuous bracing: M = 80 kNm, ISMB 250",
    ],
    units: "kNm (moment)",
    relatedSections: ["§7.2", "§13"],
  },
];

export const IS800_DEFLECTION: CodeSection[] = [
  {
    code: "IS 800:2007",
    section: "§13.1",
    title: "Deflection Limits for Beams",
    description:
      "Serviceability check: deflections must not exceed specified limits",
    criteria: `δ_max ≤ L/240 (general), L/180 (cantilever roof), L/120 (cantilever floor with sensitive loads)`,
    examples: [
      "Simple beam 10m span: δ_max = 10000/240 = 41.7 mm allowed",
      "Cantilever balcony 2m: δ_max = 2000/120 = 16.7 mm allowed",
    ],
    units: "mm (deflection)",
    relatedSections: ["§7.3", "Annex H"],
  },
];

export const IS800_CONNECTIONS: CodeSection[] = [
  {
    code: "IS 800:2007",
    section: "§10.2",
    title: "Bolted Connection Design",
    description:
      "Design of bolted connections using high-strength friction grip (HSFG) or bearing-type bolts",
    criteria:
      "Capacity = (No. of bolts) × (bolt shear capacity or bearing capacity)",
    examples: [
      "HSFG bolt 20mm M20 Grade 8.8: Single shear = 65 kN, Double shear = 130 kN",
      "Connection with 4 bolts: Total capacity = 260 kN double shear",
    ],
    units: "kN (force)",
    relatedSections: ["§10.3", "§10.4"],
  },
  {
    code: "IS 800:2007",
    section: "§10.4",
    title: "Welded Connection Design",
    description:
      "Design of welded connections (fillet welds and butt welds)",
    criteria:
      "Capacity = (weld length) × (weld size) × (shear strength of weld material) / gm",
    examples: [
      "6mm fillet weld on both sides: q = 1.5 mm × 2 = 3 mm, capacity ≈ 1.5 × weld length kN",
      "10mm fillet weld (both sides): capacity ≈ 2.5 × weld length kN",
    ],
    units: "kN (force)",
    relatedSections: ["§10.2", "§8"],
  },
];

// ============================================================================
// IS 456:2000 - CONCRETE STRUCTURES
// ============================================================================

export const IS456_CONCRETE_GRADES: MaterialProperties[] = [
  {
    name: "M20",
    code: "IS 456:2000",
    grade: "20 MPa",
    yield: 0, // Not applicable for concrete
    ultimate: 20,
    density: 25000,
    youngModulus: 22.4,
    poisson: 0.15,
    thermalExpansion: 1.0e-5,
    fireResistance: "1000°C @ 1 hour",
  },
  {
    name: "M30",
    code: "IS 456:2000",
    grade: "30 MPa",
    yield: 0,
    ultimate: 30,
    density: 25000,
    youngModulus: 27.5,
    poisson: 0.15,
    thermalExpansion: 1.0e-5,
    fireResistance: "1000°C @ 1 hour",
  },
  {
    name: "M40",
    code: "IS 456:2000",
    grade: "40 MPa",
    yield: 0,
    ultimate: 40,
    density: 25000,
    youngModulus: 31.6,
    poisson: 0.15,
    thermalExpansion: 1.0e-5,
    fireResistance: "1000°C @ 1 hour",
  },
];

export const IS456_REINFORCEMENT: MaterialProperties[] = [
  {
    name: "Fe 415",
    code: "IS 456:2000",
    grade: "415 MPa",
    yield: 415,
    ultimate: 500,
    density: 7850,
    youngModulus: 200,
    poisson: 0.3,
    thermalExpansion: 1.2e-5,
    fireResistance: "1000°C @ 1 hour",
  },
  {
    name: "Fe 500",
    code: "IS 456:2000",
    grade: "500 MPa",
    yield: 500,
    ultimate: 545,
    density: 7850,
    youngModulus: 200,
    poisson: 0.3,
    thermalExpansion: 1.2e-5,
    fireResistance: "1000°C @ 1 hour",
  },
];

export const IS456_BEAM_DESIGN: CodeSection[] = [
  {
    code: "IS 456:2000",
    section: "§40.1",
    title: "Reinforced Concrete Beam Design",
    description:
      "Design of RCC beams for flexure and shear using limit state method",
    criteria:
      "Mu = 0.36 × fck × b × d² × (1 - 0.42 × (pt × fy)/fck) ≥ Md,factored",
    examples: [
      "Beam 300mm × 500mm, M30 concrete, Fe 500 steel: Max moment ≈ 550 kNm with optimal reinforcement",
      "Slab beam 4m span: 200mm depth, M30, Fe 500: Capacity ≈ 120 kNm",
    ],
    units: "kNm (moment)",
    relatedSections: ["§40.2", "§40.3"],
  },
  {
    code: "IS 456:2000",
    section: "§40.2",
    title: "Shear Reinforcement in Beams",
    description:
      "Design of shear reinforcement (stirrups) to resist shear force",
    criteria:
      "Asv/sv = (Vs × b) / (0.87 × fy) (spacing of stirrups for shear)",
    examples: [
      "Beam shear V = 100 kN, use 8mm 2-legged stirrups at 150mm spacing",
      "High shear V = 200 kN, use 10mm stirrups at 100mm spacing",
    ],
    units: "kN (shear), mm (spacing)",
    relatedSections: ["§40.1", "§40.3"],
  },
];

export const IS456_COLUMNS: CodeSection[] = [
  {
    code: "IS 456:2000",
    section: "§39",
    title: "Reinforced Concrete Columns",
    description:
      "Design of RCC columns for compression and bending (uniaxial/biaxial)",
    criteria:
      "Pu = 0.4 × fck × Ac + 0.67 × fy × Asc (axial capacity in compression)",
    examples: [
      "Column 400mm × 400mm, M40 concrete, 16@3% (6 bars, 20mm), Fe 500: capacity ≈ 3500 kN",
      "Slender column (height > 4×depth): Use interaction diagrams for combined axial + bending",
    ],
    units: "kN (force)",
    relatedSections: ["§39.1", "§39.2"],
  },
];

export const IS456_DEFLECTION: CodeSection[] = [
  {
    code: "IS 456:2000",
    section: "§23.2",
    title: "Serviceability - Deflection Control",
    description:
      "Deflection limits for different types of members and loading",
    criteria:
      "δ_max ≤ L/250 (floor with brittle partitions), L/180 (general), L/150 (cantilever)",
    examples: [
      "Office slab L/250: 6m span → max deflection = 24 mm",
      "Cantilever balcony L/150: 2m overhang → max deflection = 13 mm",
    ],
    units: "mm (deflection)",
    relatedSections: ["Annex D", "Annex E"],
  },
];

// ============================================================================
// IS 1893:2002 - SEISMIC DESIGN
// ============================================================================

export const IS1893_SEISMIC_ZONES = {
  Zone_I: { factor: 0.08, description: "Low seismic risk" },
  Zone_II: { factor: 0.1, description: "Moderate seismic risk" },
  Zone_III: { factor: 0.16, description: "High seismic risk" },
  Zone_IV: { factor: 0.24, description: "Very high seismic risk" },
  Zone_V: { factor: 0.36, description: "Highest seismic risk" },
};

export const IS1893_RESPONSE_FACTORS = {
  "Moment-Resisting Frame": { R: 5 },
  "Shear-Wall-Dominated": { R: 3 },
  "Dual System": { R: 4 },
  "Special Truss": { R: 4 },
  "Braced Frame": { R: 5 },
};

export const IS1893_DESIGN: CodeSection[] = [
  {
    code: "IS 1893:2002",
    section: "§5.3",
    title: "Seismic Design Acceleration",
    description:
      "Determination of design earthquake acceleration based on zone and site conditions",
    criteria: `Sa/g = 1 + 15 × T  (for T < 0.1s)
      Sa/g = 2.5  (for 0.1s ≤ T ≤ 0.4s)
      Sa/g = (1.0 / T)  (for T > 0.4s)`,
    examples: [
      "Zone III building: Z = 0.16, R = 5 (moment frame), T = 1.0s → Response factor = 2.5/5 = 0.5",
      "5-story frame: Approximate T = 0.05 × 5 = 0.25s (within constant acceleration region)",
    ],
    units: "Acceleration (g)",
    relatedSections: ["§5.4", "§6"],
  },
  {
    code: "IS 1893:2002",
    section: "§7",
    title: "Seismic Force & Displacement Design",
    description:
      "Calculation and distribution of seismic forces to members",
    criteria:
      "Seismic Base Shear: Vb = Ah × W, distributed proportional to mass & height",
    examples: [
      "G+4 building (5 floors), Zone III: Vb ≈ 0.032 × W (including response reduction)",
      "First floor shear ≈ 0.15 × Vb, Top floor ≈ 0.05 × Vb (triangular distribution)",
    ],
    units: "kN (force)",
    relatedSections: ["§6", "§8"],
  },
];

// ============================================================================
// IS 875:1987 - WIND AND SNOW LOADS
// ============================================================================

export const IS875_WIND_SPEEDS = {
  "Strong Wind Zone (Coastal)": 55,
  "Moderate Wind (Most of India)": 45,
  "Low Wind (Plains)": 45,
  "High Altitude (Himalayan)": 50,
};

export const IS875_WIND: CodeSection[] = [
  {
    code: "IS 875:1987",
    section: "§5.3",
    title: "Wind Pressure Calculation",
    description:
      "Design wind pressure based on wind speed, exposure, and shape factor",
    criteria:
      "Pd = Vz² × Ka × Kb × Kc × (Cf) / 1600; where Vz = design wind speed",
    examples: [
      "Vb = 45 m/s (basic), Kc = 1.0 (zone factor), Ka = 1.0 (altitude), Kb varies with height",
      "Multi-story building: Lower floors Ka = 0.8-1.0, upper floors Ka = 1.1-1.3",
      "Design pressure at height: Pz = 0.6 × (Vz)² (in kN/m²)",
    ],
    units: "kN/m² (pressure)",
    relatedSections: ["§5.4", "§5.3.1"],
  },
  {
    code: "IS 875:1987",
    section: "§5.3.3",
    title: "Shape Factors for Pressure",
    description:
      "Pressure coefficients for different structural shapes and surfaces",
    criteria: `Windward face: Cp = +0.7
      Leeward face: Cp = -0.3 to -0.5
      Side faces: Cp = -0.4
      Roof (flat): Cp = -0.7 to -0.9 (suction)`,
    examples: [
      "Rectangular building front: pressure = +0.7 × dynamic pressure on windward",
      "Roof suction: pressure = -0.8 × dynamic pressure (critical for light roof structures)",
    ],
    units: "Coefficients (dimensionless)",
    relatedSections: ["§5.3", "§5.3.1"],
  },
];

// ============================================================================
// DEFAULT LOAD COMBINATIONS
// ============================================================================

export const DEFAULT_LOAD_COMBINATIONS = {
  "IS 456:2000 (Concrete)": [
    {
      name: "Dead + Live (Min)",
      deadFactor: 1.35,
      liveFactor: 1.5,
      windFactor: 0,
      seismicFactor: 0,
      description: "Primary gravity load case",
    },
    {
      name: "Dead + Live (Alternate Spans)",
      deadFactor: 1.35,
      liveFactor: 1.5,
      windFactor: 0,
      seismicFactor: 0,
      description: "Load only alternate spans (continuous structures)",
    },
    {
      name: "Dead Only",
      deadFactor: 1.35,
      liveFactor: 0,
      windFactor: 0,
      seismicFactor: 0,
      description: "Self-weight only (assessment)",
    },
  ],
  "IS 800:2007 (Steel)": [
    {
      name: "Dead + Live",
      deadFactor: 1.35,
      liveFactor: 1.5,
      windFactor: 0,
      seismicFactor: 0,
      description: "Primary gravity load case",
    },
    {
      name: "Dead + Wind",
      deadFactor: 1.35,
      liveFactor: 0,
      windFactor: 1.2,
      seismicFactor: 0,
      description: "Wind dominant or coastal regions",
    },
    {
      name: "Dead + Seismic",
      deadFactor: 1.35,
      liveFactor: 0.5,
      windFactor: 0,
      seismicFactor: 1.5,
      description: "Seismic zone III or higher",
    },
  ],
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

export function getMaterialProperties(
  material: string
): MaterialProperties | undefined {
  const allMaterials = [
    ...IS800_STEEL_GRADES,
    ...IS456_CONCRETE_GRADES,
    ...IS456_REINFORCEMENT,
  ];
  return allMaterials.find(m => m.name === material);
}

export function getCodeSection(
  code: string,
  section: string
): CodeSection | undefined {
  const allSections = [
    ...IS800_MEMBER_DESIGN,
    ...IS800_DEFLECTION,
    ...IS800_CONNECTIONS,
    ...IS456_BEAM_DESIGN,
    ...IS456_COLUMNS,
    ...IS456_DEFLECTION,
    ...IS1893_DESIGN,
    ...IS875_WIND,
  ];
  return allSections.find(s => s.code === code && s.section === section);
}

export function getDeflectionLimit(
  structure: string,
  span: number
): string {
  const limits: Record<string, number> = {
    "beam-general": 240,
    "beam-sensitive": 200,
    "cantilever-roof": 180,
    "cantilever-floor": 120,
    "slab-floor": 250,
    "slab-roof": 180,
  };

  const divisor = limits[structure] || 250;
  const limit = span / divisor;
  return `δ ≤ ${(limit / 10).toFixed(2)} mm (L/${divisor})`;
}

export function getLoadCombination(
  code: string,
  combination: string
): Record<string, number> | undefined {
  const combos = DEFAULT_LOAD_COMBINATIONS[code as keyof typeof DEFAULT_LOAD_COMBINATIONS];
  if (combos) {
    const combo = combos.find((c: any) => c.name === combination);
    if (combo) {
      return {
        deadFactor: combo.deadFactor,
        liveFactor: combo.liveFactor,
        windFactor: combo.windFactor,
        seismicFactor: combo.seismicFactor,
      };
    }
  }
  return undefined;
}

export const CODE_REFERENCE_SUMMARY = {
  "IS 800:2007": {
    subject: "Steel Structures Design & Construction",
    applicableFor: [
      "Steel buildings",
      "Steel trusses",
      "Bolted & welded connections",
    ],
    safetyFactor: "1.67 elastic, limit state 1.5",
    deflectionLimit: "L/240 general, L/180-L/120 cantilevers",
  },
  "IS 456:2000": {
    subject: "Concrete Structures - Design, Detailing & Workmanship",
    applicableFor: [
      "Concrete buildings",
      "RCC slabs & beams",
      "Concrete columns",
    ],
    safetyFactor: "1.5 on load, material factor 1.5",
    deflectionLimit: "L/250 floor, L/180-L/150 cantilevers",
  },
  "IS 1893:2002": {
    subject: "Seismic Design Code (Zone-based)",
    applicableFor: ["Buildings in seismic zones", "Lateral load resistances"],
    safetyFactor: "Response reduction factor R = 3-5",
    deflectionLimit: "Story drift < 0.004 × Height (limit state)",
  },
  "IS 875:1987": {
    subject: "Code of Practice for Design Loads",
    applicableFor: [
      "Wind load calculation",
      "Snow load (Himalayan regions)",
      "Combinations",
    ],
    safetyFactor: "1.2 on wind, 1.5 on live load",
    deflectionLimit: "Wind-induced < L/150 (relative)",
  },
};
