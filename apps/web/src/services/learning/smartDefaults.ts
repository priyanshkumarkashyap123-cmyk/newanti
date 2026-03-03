/**
 * Smart Defaults Service
 * 
 * Intelligently suggest defaults based on:
 * 1. User's problem type (beam, frame, truss, etc.)
 * 2. Expected span and loading
 * 3. Code selection (IS 800, IS 456, etc.)
 * 4. Building type (residential, commercial, industrial)
 * 5. Seismic zone (if applicable)
 * 
 * Returns pre-populated values for:
 * - Material grade and sectionsize
 * - Load values (dead, live, wind, seismic)
 * - Load combinations
 * - Safety factors
 * - Deflection limits
 */

export interface SmartDefaultsInput {
  problemType: "beam" | "frame" | "truss" | "slab" | "column" | "arch" | "other";
  span?: number; // meters
  height?: number; // meters
  buildingType?: "residential" | "commercial" | "industrial" | "bridge" | "tower";
  code?: "IS 800:2007" | "IS 456:2000" | "Both";
  seismicZone?: "I" | "II" | "III" | "IV" | "V";
  userLevel?: "beginner" | "intermediate" | "advanced";
}

export interface SmartDefaults {
  primaryCode: string;
  recommendedMaterial: string;
  estimatedSectionSize: {
    depth: number;
    width: number;
    unit: string;
  };
  materialGrade: string;
  loads: {
    deadLoadDensity: number;
    liveLoadDensity: number;
    windBasicSpeed: number;
    seismicZoneFactor: number;
    unit: string;
  };
  loadCombinations: Array<{
    name: string;
    deadFactor: number;
    liveFactor: number;
    windFactor: number;
    seismicFactor: number;
  }>;
  deflectionLimit: string;
  connectionType: string;
  constructionMethod: string;
  estimatedCost: {
    materialCost: number; // per unit
    laborCost: number; // per unit
    currency: string;
  };
  learningPath: string;
  recommendedTemplate: string;
  nextSteps: string[];
}

// ============================================================================
// SMART DEFAULTS DATABASE
// ============================================================================

const BEAM_DEFAULTS = {
  span: {
    shallow: { depth: 0.05, width: 0.2 }, // span <= 6m
    moderate: { depth: 0.06, width: 0.25 }, // 6m < span <= 12m
    long: { depth: 0.08, width: 0.3 }, // 12m < span <= 20m
    veryLong: { depth: 0.1, width: 0.35 }, // span > 20m
  },
  materials: {
    "IS 800:2007": {
      light: "ISMB 150 / ISA 75×75×6",
      medium: "ISMB 300 / ISA 100×100×10",
      heavy: "ISMB 500 / ISA 125×125×12",
    },
    "IS 456:2000": {
      light: "150×250mm, M20, 2 + 2 Fe 415",
      medium: "200×400mm, M30, 3 + 3 Fe 415",
      heavy: "250×500mm, M40, 4 + 4 Fe 500",
    },
  },
  loads: {
    residential: { deadFactor: 1.35, liveFactor: 1.5, windFactor: 0, seismic: 0 },
    commercial: { deadFactor: 1.35, liveFactor: 1.5, windFactor: 0, seismic: 0 },
    bridge: { deadFactor: 1.35, liveFactor: 1.5, windFactor: 1.2, seismic: 0 },
  },
};

const FRAME_DEFAULTS = {
  buildingType: {
    residential: {
      materialGrade: "Grade 250 (mild steel) / M30 concrete",
      connectionSuggestion: "Simple pin connections at beam-column",
      estimatedRatio: 0.08, // mass per unit volume
    },
    commercial: {
      materialGrade: "Grade 300 (medium steel) / M40 concrete",
      connectionSuggestion: "Rigid moment-resisting connections",
      estimatedRatio: 0.1,
    },
    industrial: {
      materialGrade: "Grade 350+ (high steel) / M40 concrete",
      connectionSuggestion: "Heavy-duty welded rigid connections",
      estimatedRatio: 0.12,
    },
  },
  seismic: {
    I: {
      factor: 0.08,
      responseReduction: 5,
      connectionDesign: "Standard, design for gravity dominant",
    },
    II: {
      factor: 0.1,
      responseReduction: 5,
      connectionDesign: "Moment-resisting, ductile detailing",
    },
    III: {
      factor: 0.16,
      responseReduction: 5,
      connectionDesign: "Special moment-resisting, high ductility",
    },
    IV: {
      factor: 0.24,
      responseReduction: 4,
      connectionDesign: "Strict ductile detailing, capacity design",
    },
    V: {
      factor: 0.36,
      responseReduction: 3,
      connectionDesign: "Very high ductility, special detailing required",
    },
  },
};

const TRUSS_DEFAULTS = {
  span: {
    short: { depth: 0.2, memberSize: "ISA 75×75×6", panels: 4 },
    medium: { depth: 0.25, memberSize: "ISA 100×100×8", panels: 6 },
    long: { depth: 0.3, memberSize: "ISA 125×125×10", panels: 8 },
    veryLong: { depth: 0.35, memberSize: "ISA 150×150×12", panels: 10 },
  },
  types: {
    triangulated: "Diagonal members in tension & compression",
    pratt: "Verticals in tension, diagonals in compression",
    howe: "Verticals in compression, diagonals in tension",
    warren: "W-pattern, alternating diagonals",
  },
};

const SLAB_DEFAULTS = {
  thickness: {
    residentialFloor: 125, // mm
    commercialFloor: 150,
    roofSlab: 100,
    waffle: 200, // depth with 50mm top
  },
  reinforcement: {
    "M20": "0.5% minimum, 0.75-1% typical",
    "M30": "0.5% minimum, 0.6-0.8% typical",
    "M40": "0.5% minimum, 0.5-0.7% typical",
  },
};

// ============================================================================
// MAIN SMART DEFAULTS FUNCTION
// ============================================================================

export function generateSmartDefaults(
  input: SmartDefaultsInput
): SmartDefaults {
  const {
    problemType,
    span = 10,
    height = 4,
    buildingType = "commercial",
    code = "IS 800:2007",
    seismicZone = "III",
    userLevel = "intermediate",
  } = input;

  // Determine primary code
  const primaryCode =
    code === "Both"
      ? buildingType.includes("bridge")
        ? "IS 800:2007"
        : "IS 456:2000"
      : code;

  let defaults: SmartDefaults;

  // Route based on problem type
  switch (problemType) {
    case "beam":
      defaults = generateBeamDefaults(span, primaryCode, buildingType);
      break;
    case "frame":
      defaults = generateFrameDefaults(
        span,
        height,
        buildingType,
        primaryCode,
        seismicZone
      );
      break;
    case "truss":
      defaults = generateTrussDefaults(span, primaryCode);
      break;
    case "slab":
      defaults = generateSlabDefaults(span, primaryCode, buildingType);
      break;
    case "column":
      defaults = generateColumnDefaults(height, primaryCode, seismicZone);
      break;
    case "arch":
      defaults = generateArchDefaults(span, primaryCode);
      break;
    case "other":
    default:
      defaults = generateGenericDefaults(primaryCode, buildingType);
  }

  // Add learning path recommendation
  if (userLevel === "beginner") {
    defaults.learningPath = "fundamentals";
    if (problemType === "beam") {
      defaults.recommendedTemplate = "simple-beam";
    } else if (problemType === "frame") {
      defaults.recommendedTemplate = "portal-frame";
    }
  } else if (userLevel === "intermediate") {
    defaults.learningPath = "intermediate";
    if (problemType === "truss") {
      defaults.recommendedTemplate = "truss-bridge";
    } else if (problemType === "frame") {
      defaults.recommendedTemplate = "multistory-frame";
    }
  }

  return defaults;
}

function generateBeamDefaults(
  span: number,
  code: string,
  buildingType: string
): SmartDefaults {
  let category: "shallow" | "moderate" | "long" | "veryLong";
  if (span <= 6) category = "shallow";
  else if (span <= 12) category = "moderate";
  else if (span <= 20) category = "long";
  else category = "veryLong";

  const { depth, width } =
    BEAM_DEFAULTS.span[category as keyof typeof BEAM_DEFAULTS.span];
  const estimatedDepth = Math.round(span * depth * 100) / 100; // rounding

  const isSteel = code === "IS 800:2007";
  const material = isSteel
    ? BEAM_DEFAULTS.materials["IS 800:2007"].medium
    : BEAM_DEFAULTS.materials["IS 456:2000"].medium;

  return {
    primaryCode: code,
    recommendedMaterial: material,
    estimatedSectionSize: {
      depth: estimatedDepth,
      width: Math.round(estimatedDepth / 2.5 * 10) / 10,
      unit: "m",
    },
    materialGrade: isSteel ? "IS 2062 Grade B (300 MPa)" : "M30",
    loads: {
      deadLoadDensity: 5, // kN/m² for self-weight
      liveLoadDensity:
        buildingType === "residential" ? 3 : buildingType === "commercial" ? 5 : 10,
      windBasicSpeed: 45,
      seismicZoneFactor: 0.16,
      unit: "kN/m²",
    },
    loadCombinations: [
      {
        name: "Dead + Live",
        deadFactor: 1.35,
        liveFactor: 1.5,
        windFactor: 0,
        seismicFactor: 0,
      },
    ],
    deflectionLimit: `L/${Math.round(240)} = ${(span * 1000 / 240).toFixed(1)} mm`,
    connectionType: "Shear connection (pin-supported)",
    constructionMethod: isSteel ? "Bolted/Welded" : "Monolithic cast",
    estimatedCost: {
      materialCost: isSteel ? 350 : 250, // per ton / cubic meter
      laborCost: isSteel ? 100 : 150,
      currency: "INR",
    },
    learningPath: "fundamentals",
    recommendedTemplate: "simple-beam",
    nextSteps: [
      "Define section properties (I, Z)",
      "Calculate reactions and BM/SF diagrams",
      "Check bending and shear stresses",
      "Verify deflection against code limit",
      "Design connections",
    ],
  };
}

function generateFrameDefaults(
  span: number,
  height: number,
  buildingType: string,
  code: string,
  seismicZone: string
): SmartDefaults {
  const isSteel = code === "IS 800:2007";
  const typeConfig =
    FRAME_DEFAULTS.buildingType[
      buildingType as keyof typeof FRAME_DEFAULTS.buildingType
    ];
  const seismicConfig =
    FRAME_DEFAULTS.seismic[seismicZone as keyof typeof FRAME_DEFAULTS.seismic];

  return {
    primaryCode: code,
    recommendedMaterial:
      typeConfig.materialGrade || "Grade 250 / M30 concrete",
    estimatedSectionSize: {
      depth: Math.round(span * 0.06 * 100) / 100,
      width: Math.round(span * 0.04 * 100) / 100,
      unit: "m",
    },
    materialGrade: typeConfig.materialGrade || "Grade 250 / M30",
    loads: {
      deadLoadDensity: 5 + height * 0.5, // increases with height
      liveLoadDensity: buildingType === "residential" ? 2 : 3,
      windBasicSpeed: 45,
      seismicZoneFactor: seismicConfig.factor,
      unit: "kN/m²",
    },
    loadCombinations: [
      {
        name: "Dead + Live",
        deadFactor: 1.35,
        liveFactor: 1.5,
        windFactor: 0,
        seismicFactor: 0,
      },
      {
        name: "Dead + Seismic",
        deadFactor: 1.35,
        liveFactor: 0.5,
        windFactor: 0,
        seismicFactor: 1.5,
      },
    ],
    deflectionLimit: `Drift limit: H/500 = ${(height * 1000 / 500).toFixed(0)} mm`,
    connectionType: typeConfig.connectionSuggestion || "Rigid connections",
    constructionMethod: isSteel ? "Welded moment connections" : "RCC monolithic",
    estimatedCost: {
      materialCost: isSteel ? 400 : 280,
      laborCost: isSteel ? 150 : 200,
      currency: "INR",
    },
    learningPath: "intermediate",
    recommendedTemplate: "portal-frame",
    nextSteps: [
      "Define floor plans and column grid",
      `Story height: ${height}m, Spans: ${span}m`,
      "Apply gravity + lateral (wind/seismic) loads",
      "Run frame analysis (indeterminate structure)",
      "Design columns for combined axial + bending",
      "Design base connections for overturning moment",
    ],
  };
}

function generateTrussDefaults(
  span: number,
  code: string
): SmartDefaults {
  let category: "short" | "medium" | "long" | "veryLong";
  if (span <= 12) category = "short";
  else if (span <= 18) category = "medium";
  else if (span <= 30) category = "long";
  else category = "veryLong";

  const { depth, memberSize, panels } =
    TRUSS_DEFAULTS.span[
      category as keyof typeof TRUSS_DEFAULTS.span
    ];
  const estimatedDepth = Math.round(span * depth * 1000) / 1000;

  return {
    primaryCode: code,
    recommendedMaterial: memberSize,
    estimatedSectionSize: {
      depth: estimatedDepth,
      width: 0,
      unit: "m",
    },
    materialGrade: "IS 2062 Grade C (350 MPa)",
    loads: {
      deadLoadDensity: 2,
      liveLoadDensity: 1.5,
      windBasicSpeed: 45,
      seismicZoneFactor: 0,
      unit: "kN/m²",
    },
    loadCombinations: [
      {
        name: "Dead + Live",
        deadFactor: 1.35,
        liveFactor: 1.5,
        windFactor: 0,
        seismicFactor: 0,
      },
    ],
    deflectionLimit: `L/${Math.round(240)} = ${(span * 1000 / 240).toFixed(0)} mm`,
    connectionType:
      "Pin-jointed (method of sections/joints), gusset plates",
    constructionMethod: "Bolted or welded lattice structure",
    estimatedCost: {
      materialCost: 320,
      laborCost: 120,
      currency: "INR",
    },
    learningPath: "intermediate",
    recommendedTemplate: "truss-bridge",
    nextSteps: [
      `Truss type: Warren/Pratt/Howe, ${panels} panels`,
      "Determine support reactions",
      "Method of joints: Find all member forces",
      "Check slenderness ratio λ ≤ 250 (compression members)",
      "Design chord and diagonal members",
      "Design connections (gusset plates & bolts)",
    ],
  };
}

function generateSlabDefaults(
  span: number,
  code: string,
  buildingType: string
): SmartDefaults {
  const thickness =
    buildingType === "residential"
      ? SLAB_DEFAULTS.thickness.residentialFloor
      : buildingType === "commercial"
      ? SLAB_DEFAULTS.thickness.commercialFloor
      : SLAB_DEFAULTS.thickness.roofSlab;

  return {
    primaryCode: code,
    recommendedMaterial: `Slab ${thickness}mm thick, M30 concrete`,
    estimatedSectionSize: {
      depth: thickness / 1000,
      width: span,
      unit: "m",
    },
    materialGrade: "M30 / Fe 415",
    loads: {
      deadLoadDensity: (thickness / 100) * 25 + 1, // self-weight + finishes
      liveLoadDensity:
        buildingType === "residential" ? 2 : buildingType === "commercial" ? 3 : 1.5,
      windBasicSpeed: 0,
      seismicZoneFactor: 0.16,
      unit: "kN/m²",
    },
    loadCombinations: [
      {
        name: "Dead + Live",
        deadFactor: 1.35,
        liveFactor: 1.5,
        windFactor: 0,
        seismicFactor: 0,
      },
    ],
    deflectionLimit: `L/250 = ${(span * 1000 / 250).toFixed(0)} mm`,
    connectionType: "Monolithic (continuous) with supporting beams",
    constructionMethod: "Reinforced concrete, cast in-situ or precast",
    estimatedCost: {
      materialCost: 35,
      laborCost: 25,
      currency: "INR per m²",
    },
    learningPath: "fundamentals",
    recommendedTemplate: "continuous-beam",
    nextSteps: [
      `One-way slab (span ${span}m) or two-way?`,
      "Use continuity (moment distribution) for design",
      "Positive steel at midspan, negative steel at supports",
      "Check punching shear if supported on columns",
      "Verify deflection per IS 456 Annex D",
    ],
  };
}

function generateColumnDefaults(
  height: number,
  code: string,
  seismicZone: string
): SmartDefaults {
  const isSteel = code === "IS 800:2007";
  const diameter = isSteel
    ? Math.round(height * 50) // mm
    : Math.round(Math.sqrt(height * 400)); // mm for concrete square

  return {
    primaryCode: code,
    recommendedMaterial: isSteel
      ? `ISMB ${300 + Math.round(height * 20)}`
      : `${Math.round(diameter / 10) * 10}×${Math.round(diameter / 10) * 10}mm RCC`,
    estimatedSectionSize: {
      depth: diameter / 1000,
      width: diameter / 1000,
      unit: "m",
    },
    materialGrade: isSteel ? "IS 2062 Grade B (300 MPa)" : "M40",
    loads: {
      deadLoadDensity: 5 * height,
      liveLoadDensity: 3 * height,
      windBasicSpeed: 45,
      seismicZoneFactor: parseFloat(
        `0.${seismicZone === "I" ? "08" : seismicZone === "II" ? "1" : seismicZone === "III" ? "16" : seismicZone === "IV" ? "24" : "36"}`
      ),
      unit: "kN",
    },
    loadCombinations: [
      {
        name: "Dead + Live",
        deadFactor: 1.35,
        liveFactor: 1.5,
        windFactor: 0,
        seismicFactor: 0,
      },
    ],
    deflectionLimit: `Slenderness ratio λ ≤ ${isSteel ? 250 : 12 * height}`,
    connectionType: "Fixed base, beam connections moment-resisting or pinned",
    constructionMethod: isSteel ? "Welded H-section or box" : "RCC with spirals",
    estimatedCost: {
      materialCost: isSteel ? 400 : 250,
      laborCost: isSteel ? 100 : 150,
      currency: "INR",
    },
    learningPath: "intermediate",
    recommendedTemplate: "multistory-frame",
    nextSteps: [
      `Check slenderness: KL/r, where L = ${height}m`,
      "Apply axial load + bending (if frames/cantilever)",
      "Combined stress check: (P/Pc) + (M/Mc) ≤ 1.0",
      "Design base connection for moment transfer",
      "Verify lateral bracing if required",
    ],
  };
}

function generateArchDefaults(
  span: number,
  code: string
): SmartDefaults {
  const rise = span / 4; // Typical arch proportion
  const thrust = 240; // kN, typical for 20kN/m load on 24m span

  return {
    primaryCode: code,
    recommendedMaterial: "M60 Concrete or Grade C (350 MPa) Steel",
    estimatedSectionSize: {
      depth: rise,
      width: span / 10, // Member width ~ depth/10 for arch
      unit: "m",
    },
    materialGrade: "M60 (compression-dominant) or IS 2062 Grade C",
    loads: {
      deadLoadDensity: 5,
      liveLoadDensity: 2,
      windBasicSpeed: 45,
      seismicZoneFactor: 0.16,
      unit: "kN/m²",
    },
    loadCombinations: [
      {
        name: "Dead + Live",
        deadFactor: 1.35,
        liveFactor: 1.5,
        windFactor: 0,
        seismicFactor: 0,
      },
    ],
    deflectionLimit: `L/${Math.round(240)} (arch deflection minimal)`,
    connectionType: "Pin or fixed base, very large horizontal reactions",
    constructionMethod: "Concrete precast or steel welded/bolted",
    estimatedCost: {
      materialCost: 300,
      laborCost: 180,
      currency: "INR",
    },
    learningPath: "advanced",
    recommendedTemplate: "arch-structure",
    nextSteps: [
      `Arch rise: ${Math.round(rise * 100) / 100}m, Span: ${span}m`,
      `Horizontal thrust H = (wL²)/(8f) = ${Math.round(thrust)} kN`,
      "Support must resist both vertical () and large horizontal reactions",
      "Bending is minimal (compression-dominated design)",
      "Check buckling of arch members",
    ],
  };
}

function generateGenericDefaults(
  code: string,
  buildingType: string
): SmartDefaults {
  return {
    primaryCode: code,
    recommendedMaterial: "Consult with structural engineer",
    estimatedSectionSize: {
      depth: 0.3,
      width: 0.2,
      unit: "m",
    },
    materialGrade: code === "IS 800:2007" ? "Grade B (300 MPa)" : "M30",
    loads: {
      deadLoadDensity: 5,
      liveLoadDensity: buildingType === "residential" ? 2 : 3,
      windBasicSpeed: 45,
      seismicZoneFactor: 0.16,
      unit: "kN/m²",
    },
    loadCombinations: [
      {
        name: "Dead + Live",
        deadFactor: 1.35,
        liveFactor: 1.5,
        windFactor: 0,
        seismicFactor: 0,
      },
    ],
    deflectionLimit: "Per code, consult standards",
    connectionType: "To be determined",
    constructionMethod: "To be determined",
    estimatedCost: {
      materialCost: 300,
      laborCost: 150,
      currency: "INR",
    },
    learningPath: "fundamentals",
    recommendedTemplate: "simple-beam",
    nextSteps: [
      "Clarify problem type (beam, frame, truss, etc.)",
      "Define geometry and loading",
      "Select applicable code",
      "Run analysis",
      "Design members per code",
    ],
  };
}

export default generateSmartDefaults;
