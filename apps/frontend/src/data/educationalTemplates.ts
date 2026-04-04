/**
 * Educational Templates Library
 * 
 * This file contains 9 carefully curated templates for structural analysis learning.
 * Each template is designed to teach specific concepts while demonstrating real-world applications.
 * 
 * Templates are organized by difficulty level:
 * - BEGINNER: Core concepts (Simple Beam, Cantilever, Portal Frame)
 * - INTERMEDIATE: Multi-member & composite structures (Continuous Beam, Truss, Multi-Story)
 * - ADVANCED: Complex & nonlinear structures (Arch, Space Frame, Cable-Stayed)
 * 
 * Each template includes:
 * - Learning objectives (what students will understand)
 * - Expected results (key values for validation)
 * - Code references (IS 800, IS 456, IS 1893, IS 875)
 * - Material defaults based on Indian standards
 * - Default load combinations per IS 1893/IS 875
 */

export interface LoadCombination {
  name: string;
  factors: {
    dead: number;
    live: number;
    wind: number;
    seismic: number;
  };
  description: string;
}

export interface MaterialDefaults {
  steelGrade: string;
  concreteGrade: string;
  reinforcement: string;
  unitWeights: {
    steel: number;
    concrete: number;
    masonry: number;
  };
}

export interface CodeReference {
  code: string;
  section: string;
  concept: string;
  reference: string;
}

export interface TemplateResult {
  parameter: string;
  expectedValue: number;
  unit: string;
  section: string;
  significance: string;
}

export interface EducationalTemplate {
  id: string;
  title: string;
  difficulty: "BEGINNER" | "INTERMEDIATE" | "ADVANCED";
  duration: number;
  category: string;
  learningObjectives: string[];
  description: string;
  solutionApproach: string;
  plotDimensions: {
    length: number;
    width: number;
    height: number;
    unit: string;
  };
  defaultLoads: {
    deadLoad: number;
    liveLoad: number;
    windLoad: number;
    seismicFactor: number;
  };
  loadCombinations: LoadCombination[];
  materials: MaterialDefaults;
  codeReferences: CodeReference[];
  applicableCodes: string[];
  expectedResults: TemplateResult[];
  validationCriteria: string[];
  visualizationType: string;
  numberOfMembers: number;
}

// ============================================================================
// BEGINNER TEMPLATES (3 total)
// ============================================================================

export const SIMPLE_BEAM_TEMPLATE: EducationalTemplate = {
  id: "simple-beam",
  title: "Simple Simply Supported Beam",
  difficulty: "BEGINNER",
  duration: 1.5,
  category: "Beam",
  
  learningObjectives: [
    "Understand simply supported boundary conditions",
    "Learn reaction force calculation using equilibrium (ΣF=0, ΣM=0)",
    "Interpret shear force diagrams (SFD)",
    "Interpret bending moment diagrams (BMD) and identify maximum moment",
    "Understand deflection concept and serviceability limits",
    "Validate results using hand calculations vs software"
  ],
  
  description: `
The simple beam is the cornerstone of structural analysis. A 10m steel beam spans between two supports,
carrying a central point load of 10 kN. This template teaches equilibrium, internal force diagrams, and
validation of results. Perfect first project for any structural engineer.
  `.trim(),
  
  solutionApproach: `
STEP 1: Boundary Conditions
- Simply supported = pin support at left, roller at right
- Load: 10 kN downward at midspan (5m from each support)

STEP 2: Equilibrium Analysis
- ΣV = 0: RA + RB = 10 kN
- ΣM about A = 0: RB × 10 = 10 × 5 → RB = 5 kN, RA = 5 kN

STEP 3: Internal Forces
- Shear: +5 kN left half, -5 kN right half (changes sign at load)
- Moment: M(x) = 5x for midspan, max = 25 kNm at x = 5m

STEP 4: Deflection Check
- δmax = (PL³)/(48EI) ≈ 1.19 mm
- IS 800 limit: L/240 = 41.7 mm ✓ (well within limit)

STEP 5: Validation
- Sum of reactions = 10 kN ✓
- Maximum moment at midspan ✓
- Shear stress = 0 at maximum moment ✓
  `.trim(),
  
  plotDimensions: {
    length: 10,
    width: 1,
    height: 1,
    unit: "m"
  },
  
  defaultLoads: {
    deadLoad: 0.5,
    liveLoad: 1.0,
    windLoad: 0,
    seismicFactor: 0
  },
  
  loadCombinations: [
    {
      name: "Dead + Live Load",
      factors: { dead: 1.35, live: 1.5, wind: 0, seismic: 0 },
      description: "Standard gravity load case per IS 456:2000"
    },
    {
      name: "Dead Load Only",
      factors: { dead: 1.35, live: 0, wind: 0, seismic: 0 },
      description: "For initial exploration"
    }
  ],
  
  materials: {
    steelGrade: "IS 2062 Grade A (250 MPa)",
    concreteGrade: "N/A",
    reinforcement: "N/A",
    unitWeights: { steel: 7850, concrete: 0, masonry: 0 }
  },
  
  codeReferences: [
    {
      code: "IS 800:2007",
      section: "§7.1",
      concept: "Member Design",
      reference: "Allowable stress = fy/1.67 = 149.7 MPa (elastic)"
    },
    {
      code: "IS 800:2007",
      section: "§13.1",
      concept: "Deflection Limits",
      reference: "δ_max = L/240 = 41.7 mm"
    }
  ],
  
  applicableCodes: ["IS 800:2007", "IS 456:2000"],
  
  expectedResults: [
    {
      parameter: "Left Support Reaction",
      expectedValue: 5.0,
      unit: "kN",
      section: "Left support",
      significance: "Verifies equilibrium"
    },
    {
      parameter: "Right Support Reaction",
      expectedValue: 5.0,
      unit: "kN",
      section: "Right support",
      significance: "Verifies equilibrium (RA + RB = 10 kN)"
    },
    {
      parameter: "Maximum Shear Force",
      expectedValue: 5.0,
      unit: "kN",
      section: "At supports",
      significance: "Governs connection design"
    },
    {
      parameter: "Maximum Bending Moment",
      expectedValue: 25.0,
      unit: "kNm",
      section: "At midspan",
      significance: "Governs member moment capacity"
    },
    {
      parameter: "Maximum Deflection",
      expectedValue: 1.19,
      unit: "mm",
      section: "At midspan",
      significance: "Serviceability check ≤ 41.7 mm per IS 800"
    }
  ],
  
  validationCriteria: [
    "Sum of reactions = Total load (5 + 5 = 10 kN)",
    "Maximum moment at midspan (x = L/2)",
    "Shear is zero at maximum moment",
    "Deflection within IS 800 limit (L/240)"
  ],
  
  visualizationType: "2D Beam",
  numberOfMembers: 1
};

export const CANTILEVER_BEAM_TEMPLATE: EducationalTemplate = {
  id: "cantilever-beam",
  title: "Cantilever Beam",
  difficulty: "BEGINNER",
  duration: 1.5,
  category: "Beam",
  
  learningObjectives: [
    "Understand cantilever boundary conditions (fixed-free)",
    "Learn how fixed support creates reaction moment",
    "Compare cantilever vs simply supported behavior",
    "Understand fiber stress reversal in cantilevers",
    "Learn practical applications (balconies, overhangs)"
  ],
  
  description: `
The cantilever beam is the second fundamental form. A 6m steel beam extends from a fixed support
with 5 kN load at the free end. Unlike simple beams, cantilevers have maximum moment at the fixed end.
Common in building balconies, elevator overhangs, and signboards.
  `.trim(),
  
  solutionApproach: `
STEP 1: Boundary Conditions
- Fixed support at left, free end at right (6m cantilever)
- Load: 5 kN downward at free end

STEP 2: Reactions at Fixed Support
- Vertical: RA = 5 kN upward
- Moment: MA = 5 × 6 = 30 kNm (clockwise to balance load)

STEP 3: Internal Forces
- Shear: Constant at -5 kN throughout
- Moment: M(x) = -5x, maximum at fixed end = -30 kNm

STEP 4: Fiber Stress
- REVERSED pattern vs simple beam: TOP fiber in tension (opposite)
- Critical for design: cantilever has completely different reinforcement layout
  `.trim(),
  
  plotDimensions: {
    length: 6,
    width: 1,
    height: 1,
    unit: "m"
  },
  
  defaultLoads: {
    deadLoad: 1.0,
    liveLoad: 5.0,
    windLoad: 0,
    seismicFactor: 0
  },
  
  loadCombinations: [
    {
      name: "Dead + Live Load",
      factors: { dead: 1.35, live: 1.5, wind: 0, seismic: 0 },
      description: "Standard for building overhangs"
    }
  ],
  
  materials: {
    steelGrade: "IS 2062 Grade A (250 MPa)",
    concreteGrade: "M30",
    reinforcement: "Fe 415, 3-4% main steel (higher than simple beam)",
    unitWeights: { steel: 7850, concrete: 25000, masonry: 0 }
  },
  
  codeReferences: [
    {
      code: "IS 800:2007",
      section: "§13.1.2",
      concept: "Cantilever Deflection",
      reference: "δ ≤ L/120 to L/180 (stricter than beams)"
    }
  ],
  
  applicableCodes: ["IS 800:2007", "IS 456:2000"],
  
  expectedResults: [
    {
      parameter: "Vertical Reaction",
      expectedValue: 5.0,
      unit: "kN",
      section: "Fixed end",
      significance: "Equals applied load"
    },
    {
      parameter: "Moment Reaction",
      expectedValue: 30.0,
      unit: "kNm",
      section: "Fixed support",
      significance: "6x larger than simple beam!"
    },
    {
      parameter: "Maximum Bending Moment",
      expectedValue: 30.0,
      unit: "kNm",
      section: "At fixed support",
      significance: "Much larger than simply supported of same load/span"
    },
    {
      parameter: "Shear Force",
      expectedValue: 5.0,
      unit: "kN",
      section: "Throughout",
      significance: "Constant along cantilever length"
    },
    {
      parameter: "Maximum Deflection",
      expectedValue: 4.86,
      unit: "mm",
      section: "At free end",
      significance: "Much larger than simple beam; check against IS limit"
    }
  ],
  
  validationCriteria: [
    "Moment at fixed end = Load × length (30 = 5 × 6)",
    "Maximum deflection occurs at FREE END",
    "Deflection much larger than simply supported (formula has 3 not 48)"
  ],
  
  visualizationType: "2D Beam",
  numberOfMembers: 1
};

export const PORTAL_FRAME_TEMPLATE: EducationalTemplate = {
  id: "portal-frame",
  title: "Simple Portal Frame",
  difficulty: "BEGINNER",
  duration: 2.0,
  category: "Frame",
  
  learningObjectives: [
    "Understand rigid frame behavior (moment transfer at joints)",
    "Learn difference between pinned and rigid connections",
    "Interpret forces in multi-member structures",
    "Understand lateral load effects on columns",
    "Apply equilibrium to indeterminate frames",
    "Design members for combined axial + bending"
  ],
  
  description: `
The portal frame is the fundamental building unit for rigid structures. This 2-story frame (6m span,
4m height) shows how wind/lateral loads create column bending and how moment transfer works at rigid joints.
Essential for understanding building frame design worldwide.
  `.trim(),
  
  solutionApproach: `
STEP 1: Applied Loads
- Vertical: 20 kN at beam midspan
- Horizontal: 5 kN at top of left column (wind, H=1m above roof)

STEP 2: Reactions
- RA_v = 5.83 kN, RB_v = 14.17 kN (asymmetric due to wind)
- RA_h = 5 kN (resists wind)

STEP 3: Key Insight
- Unlike simple beams, rigid frame has MOMENT AT COLUMN BASES
- This transfers wind moment to foundation
- Design must account for combined axial + bending
  `.trim(),
  
  plotDimensions: {
    length: 6,
    width: 1,
    height: 4,
    unit: "m"
  },
  
  defaultLoads: {
    deadLoad: 2.0,
    liveLoad: 20.0,
    windLoad: 5.0,
    seismicFactor: 0.1
  },
  
  loadCombinations: [
    {
      name: "Dead + Live",
      factors: { dead: 1.35, live: 1.5, wind: 0, seismic: 0 },
      description: "Primary gravity load case"
    },
    {
      name: "Dead + Wind",
      factors: { dead: 1.35, live: 0, wind: 1.2, seismic: 0 },
      description: "Wing lateral load"
    }
  ],
  
  materials: {
    steelGrade: "IS 2062 Grade B (300 MPa)",
    concreteGrade: "M40",
    reinforcement: "Fe 500, 3-5% main (higher due to moments)",
    unitWeights: { steel: 7850, concrete: 25000, masonry: 0 }
  },
  
  codeReferences: [
    {
      code: "IS 800:2007",
      section: "§9.3",
      concept: "Combined Stress",
      reference: "(P/Pc) + (M/Mc) ≤ 1.0"
    }
  ],
  
  applicableCodes: ["IS 800:2007", "IS 456:2000", "IS 875:1987"],
  
  expectedResults: [
    {
      parameter: "Max Beam Moment",
      expectedValue: 31.25,
      unit: "kNm",
      section: "Beam center",
      significance: "Reduced from simple beam due to end restraint"
    },
    {
      parameter: "Column Base Moment",
      expectedValue: 21.67,
      unit: "kNm",
      section: "Column base",
      significance: "From wind overturning, critical for foundation"
    }
  ],
  
  validationCriteria: [
    "Base moments balance wind moment (25 kNm total)",
    "Connection design must resist moment transfer"
  ],
  
  visualizationType: "Frame",
  numberOfMembers: 3
};

// ============================================================================
// INTERMEDIATE TEMPLATES (3 total)
// ============================================================================

export const CONTINUOUS_BEAM_TEMPLATE: EducationalTemplate = {
  id: "continuous-beam",
  title: "3-Span Continuous Beam",
  difficulty: "INTERMEDIATE",
  duration: 2.5,
  category: "Beam",
  
  learningObjectives: [
    "Understand statically indeterminate structures",
    "Learn moment distribution method",
    "Recognize continuity reduces maximum moment",
    "Understand negative moments over supports",
    "Learn reactions redistribution in continuous spans"
  ],
  
  description: `
The continuous beam is statically indeterminate — internal moments require special methods to solve.
This 3-span structure (6m + 8m + 6m) with 10 kN/m distributed load shows how moment distribution
method solves for internal moments and how continuity provides 20-40% moment reduction.
  `.trim(),
  
  solutionApproach: `
STEP 1: Load Distribution
- Simply supported moments: 45 kNm, 80 kNm, 45 kNm (per span)
- With continuity, middle moments reduced significantly

STEP 2: Moment Distribution
- Create negative moments over interior supports (-36 kNm typical)
- Reduces positive midspan moments to ~25-35 kNm
- Key: Continuity redistributes moment

STEP 3: Design Implication
- Uses less steel than 3 simply supported beams
- Requires special reinforcement at support regions
- Modern slabs always continuous to exploit efficiency
  `.trim(),
  
  plotDimensions: {
    length: 20,
    width: 1,
    height: 1,
    unit: "m"
  },
  
  defaultLoads: {
    deadLoad: 5.0,
    liveLoad: 10.0,
    windLoad: 0,
    seismicFactor: 0
  },
  
  loadCombinations: [
    {
      name: "Dead + Live Distributed",
      factors: { dead: 1.35, live: 1.5, wind: 0, seismic: 0 },
      description: "Standard gravity for slabs"
    }
  ],
  
  materials: {
    steelGrade: "IS 2062 Grade B (300 MPa)",
    concreteGrade: "M40",
    reinforcement: "Fe 500, 2-3% midspan, 4-5% at supports",
    unitWeights: { steel: 7850, concrete: 25000, masonry: 0 }
  },
  
  codeReferences: [
    {
      code: "IS 456:2000",
      section: "§23",
      concept: "Continuous Design",
      reference: "Use Annex D moment coefficients for approximate analysis"
    }
  ],
  
  applicableCodes: ["IS 456:2000"],
  
  expectedResults: [
    {
      parameter: "Max Positive Moment",
      expectedValue: 28.5,
      unit: "kNm",
      section: "Span 1 at 0.3L",
      significance: "60% of simply supported value (efficiency!)"
    },
    {
      parameter: "Max Negative Moment",
      expectedValue: -36.0,
      unit: "kNm",
      section: "Central support",
      significance: "Requires top reinforcement"
    }
  ],
  
  validationCriteria: [
    "Sum of reactions = 200 kN (total load)",
    "Negative moment exists over supports",
    "Moment distribution converges quickly"
  ],
  
  visualizationType: "2D Beam",
  numberOfMembers: 3
};

export const TRUSS_BRIDGE_TEMPLATE: EducationalTemplate = {
  id: "truss-bridge",
  title: "Warren Truss Bridge",
  difficulty: "INTERMEDIATE",
  duration: 3.0,
  category: "Truss",
  
  learningObjectives: [
    "Understand truss analysis (axial loading only, no moments)",
    "Learn pin-jointed method of joints/sections",
    "Recognize compression vs tension members",
    "Understand diagonal load transfer efficiency",
    "Design practical bridge with real geometry"
  ],
  
  description: `
The Warren truss uses diagonal members to transfer loads efficiently with minimal bending.
This 24m span bridge carries 25 kN/m distributed deck load, demonstrating how trusses require
only axial member capacity — no bending unlike solid beams. Real bridges span 300+ meters this way.
  `.trim(),
  
  solutionApproach: `
STEP 1: Geometry
- Span: 24m, depth: 3m, 12 panels of 2m each
- Total load: 600 kN

STEP 2: Analysis
- Support reactions: 300 kN each (by symmetry)
- Use method of joints to find member forces
- Bottom chord: ~150 kN tension
- Top chord: ~180 kN compression (critical for buckling)
- Diagonals: Vary from ~60 to ~212 kN

STEP 3: Efficiency
- Uses 40% less material than solid beam
- All forces are axial (direct load paths)
- Disadvantage: Complex fabrication, many joints
  `.trim(),
  
  plotDimensions: {
    length: 24,
    width: 3,
    height: 3,
    unit: "m"
  },
  
  defaultLoads: {
    deadLoad: 8.0,
    liveLoad: 25.0,
    windLoad: 0,
    seismicFactor: 0
  },
  
  loadCombinations: [
    {
      name: "Dead + Live",
      factors: { dead: 1.35, live: 1.5, wind: 0, seismic: 0 },
      description: "Primary load case"
    }
  ],
  
  materials: {
    steelGrade: "IS 2062 Grade C (350 MPa)",
    concreteGrade: "N/A",
    reinforcement: "N/A",
    unitWeights: { steel: 7850, concrete: 0, masonry: 0 }
  },
  
  codeReferences: [
    {
      code: "IS 800:2007",
      section: "§5",
      concept: "Truss Design",
      reference: "Slenderness λ ≤ 250 for compression members"
    }
  ],
  
  applicableCodes: ["IS 800:2007"],
  
  expectedResults: [
    {
      parameter: "Support Reaction",
      expectedValue: 300.0,
      unit: "kN",
      section: "Each end",
      significance: "High reaction for bearing design"
    },
    {
      parameter: "Max Chord Tension",
      expectedValue: 180.0,
      unit: "kN",
      section: "Bottom at center",
      significance: "Governs member size"
    },
    {
      parameter: "Max Chord Compression",
      expectedValue: 185.0,
      unit: "kN",
      section: "Top at center",
      significance: "Critical for buckling"
    }
  ],
  
  validationCriteria: [
    "Sum of reactions = 600 kN",
    "All members either tension or compression (no bending)",
    "Slenderness ratios reasonable (<250)"
  ],
  
  visualizationType: "Truss",
  numberOfMembers: 25
};

export const MULTISTORY_FRAME_TEMPLATE: EducationalTemplate = {
  id: "multistory-frame",
  title: "3-Story Building Frame",
  difficulty: "INTERMEDIATE",
  duration: 3.0,
  category: "Frame",
  
  learningObjectives: [
    "Understand multi-story lateral behavior",
    "Learn shear wall design for lateral loads",
    "Recognize story shear and moment distribution",
    "Design for combined gravity + lateral forces",
    "Apply IS 875 wind load calculation",
    "Check P-Delta effects (geometric nonlinearity)"
  ],
  
  description: `
A realistic 3-story office building (4m each, 6m × 12m plan) shows wind load effects, drift control,
and how story shear increases toward base. Introduces P-Delta concepts and realistic design considerations.
  `.trim(),
  
  solutionApproach: `
STEP 1: Loads
- Gravity: 270 kN total (90 per floor)
- Wind: 20, 18, 16 kN at each level (54 kN base shear)

STEP 2: Story Shear Distribution
- Increases from top: 20 → 38 → 54 kN (cumulative)
- Greatest shear at story 1 (base)

STEP 3: Overturning Moment
- Total: 448 kNm about base
- Creates compression in one column, tension in other

STEP 4: Drift Check
- Elastic drift ~15 mm
- P-Delta effect small if drift < H/500
  `.trim(),
  
  plotDimensions: {
    length: 6,
    width: 1,
    height: 12,
    unit: "m"
  },
  
  defaultLoads: {
    deadLoad: 15.0,
    liveLoad: 0,
    windLoad: 20.0,
    seismicFactor: 0.16
  },
  
  loadCombinations: [
    {
      name: "Dead + Seismic",
      factors: { dead: 1.35, live: 0.5, wind: 0, seismic: 1.5 },
      description: "Zone III critical case"
    }
  ],
  
  materials: {
    steelGrade: "IS 2062 Grade C (350 MPa)",
    concreteGrade: "M40",
    reinforcement: "3-4% longitudinal, 1.5% spiral",
    unitWeights: { steel: 7850, concrete: 25000, masonry: 0 }
  },
  
  codeReferences: [
    {
      code: "IS 1893:2002",
      section: "§5.3",
      concept: "Seismic Zone",
      reference: "Zone III: Z = 0.16"
    }
  ],
  
  applicableCodes: ["IS 1893:2002", "IS 875:1987", "IS 456:2000"],
  
  expectedResults: [
    {
      parameter: "Base Shear",
      expectedValue: 54.0,
      unit: "kN",
      section: "Story 1 base",
      significance: "Total lateral load on foundation"
    },
    {
      parameter: "Overturning Moment",
      expectedValue: 448.0,
      unit: "kNm",
      section: "Base",
      significance: "Critical for foundation design"
    }
  ],
  
  validationCriteria: [
    "Story shears cumulative from top",
    "P-Delta check passes (<10% amplification)"
  ],
  
  visualizationType: "Frame",
  numberOfMembers: 9
};

// ============================================================================
// ADVANCED TEMPLATES (3 total)
// ============================================================================

export const ARCH_STRUCTURE_TEMPLATE: EducationalTemplate = {
  id: "arch-structure",
  title: "Circular Arch",
  difficulty: "ADVANCED",
  duration: 3.5,
  category: "Arch",
  
  learningObjectives: [
    "Understand arch behavior (compression-dominant)",
    "Learn thrust line and horizontal reactions",
    "Recognize parabolic vs circular arch differences",
    "Design arch springing (base connections)",
    "Understand support requirements and large horizontal forces"
  ],
  
  description: `
Arches convert vertical loads into primarily horizontal forces (thrust), requiring strong support
connections. This 24m span circular arch with 6m rise demonstrates how shape efficiency works
and why arches minimize internal bending compared to beams.
  `.trim(),
  
  solutionApproach: `
STEP 1: Geometry
- Span: 24m, rise: 6m, distributed load: 20 kN/m (480 kN total)

STEP 2: Thrust Calculation
- H = (w × L²) / (8 × f) = (20 × 576) / 48 = 240 kN
- Compare: Simple beam moment = 1440 kNm → arch converts to 240 kN horizontal force!

STEP 3: Bending Moments
- Unlike beam M_max = 1440 kNm, arch has ~50 kNm (98% reduction!)
- Compression dominates everywhere

STEP 4: Connection Design
- Must resist 240 kN horizontal force (very large!)
- Typically pin or fixed spring supports
  `.trim(),
  
  plotDimensions: {
    length: 24,
    width: 1,
    height: 6,
    unit: "m"
  },
  
  defaultLoads: {
    deadLoad: 8.0,
    liveLoad: 20.0,
    windLoad: 0,
    seismicFactor: 0
  },
  
  loadCombinations: [
    {
      name: "Dead + Live",
      factors: { dead: 1.35, live: 1.5, wind: 0, seismic: 0 },
      description: "Primary load case"
    }
  ],
  
  materials: {
    steelGrade: "IS 2062 Grade C (350 MPa)",
    concreteGrade: "M60 (if concrete arch)",
    reinforcement: "Minimal: 0.5% (compression dominates)",
    unitWeights: { steel: 7850, concrete: 25000, masonry: 0 }
  },
  
  codeReferences: [
    {
      code: "IS 800:2007",
      section: "§6.2",
      concept: "Arch Buckling",
      reference: "Elastic buckling capacity per curved member formula"
    }
  ],
  
  applicableCodes: ["IS 800:2007", "IS 456:2000"],
  
  expectedResults: [
    {
      parameter: "Vertical Reaction",
      expectedValue: 240.0,
      unit: "kN",
      section: "Each support",
      significance: "Half total load"
    },
    {
      parameter: "Horizontal Thrust",
      expectedValue: 240.0,
      unit: "kN",
      section: "Each support",
      significance: "THE critical force in arches"
    },
    {
      parameter: "Max Bending Moment",
      expectedValue: 12.0,
      unit: "kNm",
      section: "At midspan",
      significance: "Drastically reduced (120x less than beam!)"
    }
  ],
  
  validationCriteria: [
    "H = M_beam × 8 / (span × rise)",
    "Moment at quarter-span ≈ 0 (ideal arch condition)",
    "Compression-dominated membrane state"
  ],
  
  visualizationType: "Arch",
  numberOfMembers: 24
};

export const SPACE_FRAME_TEMPLATE: EducationalTemplate = {
  id: "space-frame",
  title: "Space Frame (30×30m Grid)",
  difficulty: "ADVANCED",
  duration: 4.0,
  category: "Space",
  
  learningObjectives: [
    "Understand 3D structural behavior",
    "Learn space frame load distribution (redundancy)",
    "Recognize member force efficiency in 3D",
    "Understand double vs single-layer differences",
    "Apply 3D space frame analysis (FEM-based)"
  ],
  
  description: `
Space frames are 3D lattice structures using high-strength members for long clear spans.
This 30×30m single-layer frame on 2m grid carries 10 kN/m² roof load.
Space frames combine truss efficiency with 2D spanning like slabs — highly efficient and economical.
  `.trim(),
  
  solutionApproach: `
STEP 1: Geometry
- Plan: 30×30m (15×15 bays @ 2m), 900 m² total area
- Load: 10 kN/m² → 9000 kN total

STEP 2: Analysis
- 4 corner supports, 225 nodes, 675 DOF equations!
- Hand calculation: Impossible; FEM required

STEP 3: Member Roles
- Top layer: Compression dominates
- Bottom layer: Tension dominates
- Diagonals: Mixed forces

STEP 4: Advantages vs Slab
- Slab: Spans max 8m, heavy self-weight (625 kN/m²)
- Space frame: Spans 30m, light (50-100 kg/m²), column-free!
  `.trim(),
  
  plotDimensions: {
    length: 30,
    width: 30,
    height: 3,
    unit: "m"
  },
  
  defaultLoads: {
    deadLoad: 1.5,
    liveLoad: 10.0,
    windLoad: 1.2,
    seismicFactor: 0.16
  },
  
  loadCombinations: [
    {
      name: "Dead + Live Uniform",
      factors: { dead: 1.35, live: 1.5, wind: 0, seismic: 0 },
      description: "Primary gravity case"
    }
  ],
  
  materials: {
    steelGrade: "IS 2062 Grade C (350 MPa)",
    concreteGrade: "N/A",
    reinforcement: "N/A",
    unitWeights: { steel: 7850, concrete: 0, masonry: 0 }
  },
  
  codeReferences: [
    {
      code: "IS 800:2007",
      section: "§10.2",
      concept: "Space Frame Connections",
      reference: "Gusset plates for 4-12 members meeting at node"
    }
  ],
  
  applicableCodes: ["IS 800:2007"],
  
  expectedResults: [
    {
      parameter: "Total Load",
      expectedValue: 9000.0,
      unit: "kN",
      section: "900 m² area",
      significance: "Total load on structure"
    },
    {
      parameter: "Max Member Tension",
      expectedValue: 450.0,
      unit: "kN",
      section: "Bottom layer center",
      significance: "Governs sizing"
    },
    {
      parameter: "Max Member Compression",
      expectedValue: 480.0,
      unit: "kN",
      section: "Top layer",
      significance: "Critical for buckling"
    },
    {
      parameter: "Center Deflection",
      expectedValue: 25.0,
      unit: "mm",
      section: "At 30m span center",
      significance: "Within H/120 limit"
    }
  ],
  
  validationCriteria: [
    "FEM analysis required (hand calculation impossible at 675 DOF)",
    "Tension/compression pattern logical (top compression, bottom tension)",
    "Deflection smooth bowl shape under uniform load"
  ],
  
  visualizationType: "3D Space",
  numberOfMembers: 175
};

export const CABLE_STAYED_TEMPLATE: EducationalTemplate = {
  id: "cable-stayed",
  title: "Cable-Stayed Bridge",
  difficulty: "ADVANCED",
  duration: 4.0,
  category: "Cable",
  
  learningObjectives: [
    "Understand cable-tension systems (tension-dominant)",
    "Learn tower compression-bending interaction",
    "Recognize cable geometry efficiency",
    "Design deck and tower for combined forces",
    "Understand stress relaxation and temperature effects"
  ],
  
  description: `
Cable-stayed bridges represent madern long-span efficiency, combining simple cable suspension
with simpler towers than true suspension bridges. This 400m main span demonstrates how
cables assume tension while tower experiences large compression with lateral bending.
  `.trim(),
  
  solutionApproach: `
STEP 1: Geometry
- Main tower: 200m above deck, 100m below (300m total)
- Main span: 400m
- Side spans: 150m each (stabilization)
- 13 pairs cables (26 total)

STEP 2: Cable Tension
- Average: 2000-4000 kN per cable (height & angle dependent)
- Steeper cables: Higher tension
- Shallower cables: Lower tension

STEP 3: Tower Forces
- Vertical: Sum of cable vertical components (~300,000+ kN!)
- Horizontal: Cable horizontal components cancel (symmetric)
- Bending: From asymmetric load, wind, seismic

STEP 4: Design
- Tower: Thick hollow box (compression + bending)
- Cables: High-strength strands (1800+ MPa)
- Deck: Composite box girders, moment transfer to cables
  `.trim(),
  
  plotDimensions: {
    length: 400,
    width: 30,
    height: 200,
    unit: "m"
  },
  
  defaultLoads: {
    deadLoad: 100.0,
    liveLoad: 50.0,
    windLoad: 8.5,
    seismicFactor: 0.08
  },
  
  loadCombinations: [
    {
      name: "Dead + Live",
      factors: { dead: 1.35, live: 1.5, wind: 0, seismic: 0 },
      description: "Primary traffic case"
    }
  ],
  
  materials: {
    steelGrade: "IS 2062 Grade C (350 MPa) for tower base & legs",
    concreteGrade: "M60 (if concrete hybrid)",
    reinforcement: "N/A for cables (high-strength strand)",
    unitWeights: { steel: 7850, concrete: 25000, masonry: 0 }
  },
  
  codeReferences: [
    {
      code: "IS 800:2007",
      section: "§11",
      concept: "Cable Systems",
      reference: "Cables safety factor = 2.5-3.0 (brittle failure mode)"
    },
    {
      code: "IRC:6",
      section: "§2.2",
      concept: "Bridge Loads",
      reference: "Class 70R truck (703 kN) + Class A wheeled"
    }
  ],
  
  applicableCodes: ["IS 800:2007", "IRC:6", "IS 875:1987"],
  
  expectedResults: [
    {
      parameter: "Main Span Load",
      expectedValue: 40000.0,
      unit: "kN",
      section: "400m span @ 100 kN/m",
      significance: "Distributed to towers via cables"
    },
    {
      parameter: "Cable Tension (Steepest)",
      expectedValue: 4200.0,
      unit: "kN",
      section: "Near tower top ~30° vertical",
      significance: "Governs strand count"
    },
    {
      parameter: "Tower Compression",
      expectedValue: 340000.0,
      unit: "kN",
      section: "At foundation",
      significance: "Enormous vertical load"
    },
    {
      parameter: "Tower Base Moment",
      expectedValue: 1700000.0,
      unit: "kNm",
      section: "Wind case",
      significance: "Combined compression + bending critical"
    }
  ],
  
  validationCriteria: [
    "Cable vertical components sum to deck load",
    "Horizontal components cancel (symmetric bridge)",
    "Tower compression = Cable vertical sum",
    "Asymmetric loading creates cable tension imbalance (~±10%)"
  ],
  
  visualizationType: "Cable",
  numberOfMembers: 26
};

// ============================================================================
// EXPORT ALL TEMPLATES
// ============================================================================

export const ALL_EDUCATIONAL_TEMPLATES: EducationalTemplate[] = [
  SIMPLE_BEAM_TEMPLATE,
  CANTILEVER_BEAM_TEMPLATE,
  PORTAL_FRAME_TEMPLATE,
  CONTINUOUS_BEAM_TEMPLATE,
  TRUSS_BRIDGE_TEMPLATE,
  MULTISTORY_FRAME_TEMPLATE,
  ARCH_STRUCTURE_TEMPLATE,
  SPACE_FRAME_TEMPLATE,
  CABLE_STAYED_TEMPLATE
];

export const getTemplateById = (id: string): EducationalTemplate | undefined => {
  return ALL_EDUCATIONAL_TEMPLATES.find(t => t.id === id);
};

export const getTemplatesByDifficulty = (difficulty: string): EducationalTemplate[] => {
  return ALL_EDUCATIONAL_TEMPLATES.filter(t => t.difficulty === difficulty);
};

export const getTemplatesByCategory = (category: string): EducationalTemplate[] => {
  return ALL_EDUCATIONAL_TEMPLATES.filter(t => t.category === category);
};

export const TEMPLATE_SUMMARY = ALL_EDUCATIONAL_TEMPLATES.map(t => ({
  id: t.id,
  title: t.title,
  difficulty: t.difficulty,
  category: t.category,
  duration: t.duration,
  learningObjectives: t.learningObjectives.length,
  membersCount: t.numberOfMembers
}));
