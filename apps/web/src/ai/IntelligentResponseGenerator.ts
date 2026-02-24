/**
 * IntelligentResponseGenerator.ts
 * 
 * Generates expert-level responses using civil engineering knowledge base
 * 
 * Features:
 * - Context-aware responses with code references
 * - Formula explanations with worked examples
 * - Design recommendations with justification
 * - Troubleshooting guidance
 * - Learning-oriented explanations
 */

import { 
  CIVIL_ENGINEERING_KNOWLEDGE,
  STRUCTURAL_ENGINEERING,
  GEOTECHNICAL_ENGINEERING,
  HYDRAULIC_ENGINEERING,
  ENVIRONMENTAL_ENGINEERING,
  FORMULA_LIBRARY,
  UNIT_CONVERSIONS 
} from './CivilEngineeringKnowledgeBase';

import {
  InterpretationResult,
  ParsedIntent,
  ExtractedEntity,
  IntentType,
  EngineeringDomain,
  ConversationalContext,
} from './AdvancedNLPInterpreter';

// ============================================
// TYPE DEFINITIONS
// ============================================

export interface GeneratedResponse {
  message: string;
  type: ResponseType;
  confidence: number;
  codeReferences?: CodeReference[];
  formulas?: FormulaExplanation[];
  calculations?: Calculation[];
  recommendations?: Recommendation[];
  warnings?: Warning[];
  followUp?: FollowUpQuestion[];
  structureData?: StructureGenerationData;
  learningResources?: LearningResource[];
}

export type ResponseType = 
  | 'explanation' | 'calculation' | 'design_check' | 'recommendation' 
  | 'troubleshooting' | 'structure_generation' | 'analysis_result'
  | 'learning' | 'conversation' | 'clarification' | 'error';

export interface CodeReference {
  code: string;
  clause: string;
  description: string;
  requirement?: string;
}

export interface FormulaExplanation {
  name: string;
  formula: string;
  variables: Record<string, string>;
  application: string;
  example?: string;
}

export interface Calculation {
  step: number;
  description: string;
  formula?: string;
  inputs?: Record<string, number | string>;
  result: number | string;
  unit?: string;
}

export interface Recommendation {
  type: 'section' | 'material' | 'analysis' | 'design' | 'general';
  recommendation: string;
  justification: string;
  alternatives?: string[];
  priority: 'high' | 'medium' | 'low';
}

export interface Warning {
  severity: 'critical' | 'warning' | 'info';
  message: string;
  suggestion?: string;
}

export interface FollowUpQuestion {
  question: string;
  context: string;
}

export interface StructureGenerationData {
  type: string;
  nodes: any[];
  members: any[];
  loads: any[];
  supports: any[];
  materials: any[];
  sections: any[];
  metadata: Record<string, any>;
}

export interface LearningResource {
  topic: string;
  explanation: string;
  references: string[];
  relatedTopics: string[];
}

// ============================================
// RESPONSE TEMPLATES
// ============================================

const RESPONSE_TEMPLATES = {
  greeting: [
    "Hello! I'm BeamLab AI, your structural engineering assistant. I can help you with:\n\n" +
    "🏗️ **Structural Design** - Buildings, bridges, trusses, foundations\n" +
    "📊 **Analysis** - Static, dynamic, seismic, buckling\n" +
    "📐 **Calculations** - Deflection, stress, moment, shear\n" +
    "📚 **Learning** - Engineering concepts, code provisions\n\n" +
    "What would you like to work on today?",
  ],
  
  help: [
    "## How I Can Help You\n\n" +
    "### Creating Structures\n" +
    "- \"Create a 5-story building with 3 bays\"\n" +
    "- \"Design a 30m span Warren truss bridge\"\n" +
    "- \"Generate a portal frame for an industrial shed\"\n\n" +
    "### Analysis & Design\n" +
    "- \"Analyze the structure for seismic loads\"\n" +
    "- \"Check the beam design per IS 800\"\n" +
    "- \"What is the maximum deflection?\"\n\n" +
    "### Learning\n" +
    "- \"Explain P-Delta effects\"\n" +
    "- \"What is the difference between SMRF and OMRF?\"\n" +
    "- \"How do I calculate moment of inertia?\"\n\n" +
    "### Recommendations\n" +
    "- \"What section should I use for this beam?\"\n" +
    "- \"Is this design safe?\"\n" +
    "- \"Optimize the structure for minimum weight\"\n\n" +
    "Just describe what you need in natural language!",
  ],
  
  unclear: [
    "I'd like to help, but I need a bit more information. Could you tell me:\n\n" +
    "1. What type of structure are you working with?\n" +
    "2. What is your main objective (design, analyze, optimize)?\n" +
    "3. Any specific dimensions or constraints?",
  ],
};

// ============================================
// KNOWLEDGE RETRIEVAL
// ============================================

class KnowledgeRetriever {
  /**
   * Get relevant structural mechanics information
   */
  getDeflectionFormula(supportCondition: string, loadType: string): FormulaExplanation | null {
    const deflections = STRUCTURAL_ENGINEERING.mechanics.deflection;
    
    const condition = supportCondition.toLowerCase().includes('cantilever') ? 'cantilever' :
                      supportCondition.toLowerCase().includes('fixed') ? 'fixedFixed' :
                      'simplySupported';
    
    const load = loadType.toLowerCase().includes('point') ? 'pointLoadCenter' :
                 loadType.toLowerCase().includes('udl') || loadType.toLowerCase().includes('distributed') ? 'udl' :
                 'udl';
    
    const formulas = deflections[condition as keyof typeof deflections];
    if (formulas && typeof formulas === 'object' && load in formulas) {
      const formula = formulas[load as keyof typeof formulas];
      return {
        name: `Deflection - ${condition} with ${load}`,
        formula: formula as string,
        variables: {
          'δ': 'Maximum deflection',
          'P': 'Point load',
          'w': 'Distributed load intensity',
          'L': 'Span length',
          'E': "Young's modulus",
          'I': 'Moment of inertia',
        },
        application: `Use this formula for ${supportCondition} beams with ${loadType} loading.`,
      };
    }
    return null;
  }

  /**
   * Get bending moment formula
   */
  getBendingMomentFormula(supportCondition: string, loadType: string): FormulaExplanation | null {
    const moments = STRUCTURAL_ENGINEERING.mechanics.bendingMoments;
    
    const condition = supportCondition.toLowerCase().includes('cantilever') ? 'cantilever' :
                      supportCondition.toLowerCase().includes('fixed') ? 'fixedFixed' :
                      supportCondition.toLowerCase().includes('continuous') ? 'continuous' :
                      'simplySupported';
    
    const formulas = moments[condition as keyof typeof moments];
    if (formulas) {
      return {
        name: `Bending Moment - ${condition}`,
        formula: Object.values(formulas).join(', '),
        variables: {
          'M': 'Bending moment',
          'P': 'Point load',
          'w': 'Distributed load intensity',
          'L': 'Span length',
        },
        application: `Bending moment formulas for ${supportCondition} condition.`,
      };
    }
    return null;
  }

  /**
   * Get design code requirements
   */
  getCodeRequirements(code: string): CodeReference[] {
    const references: CodeReference[] = [];
    
    const codes = STRUCTURAL_ENGINEERING.designCodes;
    
    if (code.toLowerCase().includes('is800') || code.toLowerCase().includes('is 800')) {
      const is800 = codes.steel.IS800;
      references.push(
        {
          code: 'IS 800:2007',
          clause: 'General',
          description: 'Limit State Design method for steel structures',
          requirement: `γm0 = ${is800.gamma_m0}, γm1 = ${is800.gamma_m1}`,
        },
        {
          code: 'IS 800:2007',
          clause: 'Deflection Limits',
          description: 'Serviceability requirements',
          requirement: `Gravity: ${is800.deflectionLimits.grav}, Total: ${is800.deflectionLimits.total}`,
        }
      );
    }
    
    if (code.toLowerCase().includes('is456') || code.toLowerCase().includes('is 456')) {
      const is456 = codes.concrete.IS456;
      references.push(
        {
          code: 'IS 456:2000',
          clause: 'General',
          description: 'Limit State Design method for concrete structures',
          requirement: `γc = ${is456.gamma_c}, γs = ${is456.gamma_s}`,
        }
      );
    }
    
    if (code.toLowerCase().includes('is1893') || code.toLowerCase().includes('is 1893')) {
      const is1893 = codes.seismic.IS1893;
      references.push(
        {
          code: 'IS 1893:2016',
          clause: 'Base Shear',
          description: 'Seismic analysis requirements',
          requirement: is1893.baseShear,
        },
        {
          code: 'IS 1893:2016',
          clause: 'Drift Limit',
          description: 'Serviceability under seismic loads',
          requirement: is1893.driftLimit,
        }
      );
    }
    
    return references;
  }

  /**
   * Get section properties
   */
  getSectionProperties(sectionName: string): Record<string, any> | null {
    const sections = STRUCTURAL_ENGINEERING.sections.indianStandard;
    
    // Try ISMB
    const ismbMatch = sectionName.match(/ISMB\s*(\d+)/i);
    if (ismbMatch) {
      const size = parseInt(ismbMatch[1]);
      if (sections.ISMB[size as keyof typeof sections.ISMB]) {
        return {
          ...sections.ISMB[size as keyof typeof sections.ISMB],
          name: `ISMB ${size}`,
          type: 'I-beam',
        };
      }
    }
    
    // Try ISHB
    const ishbMatch = sectionName.match(/ISHB\s*(\d+)/i);
    if (ishbMatch) {
      const size = parseInt(ishbMatch[1]);
      if (sections.ISHB[size as keyof typeof sections.ISHB]) {
        return {
          ...sections.ISHB[size as keyof typeof sections.ISHB],
          name: `ISHB ${size}`,
          type: 'H-beam',
        };
      }
    }
    
    // Try ISMC
    const ismcMatch = sectionName.match(/ISMC\s*(\d+)/i);
    if (ismcMatch) {
      const size = parseInt(ismcMatch[1]);
      if (sections.ISMC[size as keyof typeof sections.ISMC]) {
        return {
          ...sections.ISMC[size as keyof typeof sections.ISMC],
          name: `ISMC ${size}`,
          type: 'Channel',
        };
      }
    }
    
    return null;
  }

  /**
   * Get bearing capacity information
   */
  getBearingCapacityInfo(): FormulaExplanation {
    const bc = GEOTECHNICAL_ENGINEERING.bearingCapacity.terzaghi;
    return {
      name: 'Terzaghi Bearing Capacity',
      formula: bc.stripFooting,
      variables: {
        'qu': 'Ultimate bearing capacity',
        'c': 'Cohesion',
        'q': 'Surcharge pressure (γDf)',
        'γ': 'Unit weight of soil',
        'B': 'Width of footing',
        'Nc, Nq, Nγ': 'Bearing capacity factors',
      },
      application: 'Calculate ultimate bearing capacity of shallow foundations.',
      example: 'For φ = 30°: Nc = 30.14, Nq = 18.40, Nγ = 15.07',
    };
  }

  /**
   * Get Manning equation info
   */
  getManningInfo(): FormulaExplanation {
    const manning = HYDRAULIC_ENGINEERING.openChannelFlow.uniformFlow;
    return {
      name: "Manning's Equation",
      formula: manning.manningEquation,
      variables: {
        'Q': 'Discharge (m³/s)',
        'n': "Manning's roughness coefficient",
        'A': 'Cross-sectional area (m²)',
        'R': 'Hydraulic radius = A/P (m)',
        'S': 'Bed slope',
      },
      application: 'Calculate discharge in open channels under uniform flow conditions.',
      example: `Typical n values: Concrete=${manning.manningsN.concrete}, Earth=${manning.manningsN.earth}`,
    };
  }
}

// ============================================
// RESPONSE GENERATORS
// ============================================

class ExplanationGenerator {
  private knowledge: KnowledgeRetriever;

  constructor() {
    this.knowledge = new KnowledgeRetriever();
  }

  generateExplanation(topic: string, domain: EngineeringDomain): GeneratedResponse {
    const lowerTopic = topic.toLowerCase();
    
    // Deflection
    if (lowerTopic.includes('deflection') || lowerTopic.includes('displacement')) {
      return this.explainDeflection();
    }
    
    // Bending moment
    if (lowerTopic.includes('bending') || lowerTopic.includes('moment')) {
      return this.explainBendingMoment();
    }
    
    // Buckling
    if (lowerTopic.includes('buckling') || lowerTopic.includes('stability')) {
      return this.explainBuckling();
    }
    
    // P-Delta
    if (lowerTopic.includes('p-delta') || lowerTopic.includes('second order')) {
      return this.explainPDelta();
    }
    
    // Shear force
    if (lowerTopic.includes('shear')) {
      return this.explainShearForce();
    }
    
    // Moment of inertia
    if (lowerTopic.includes('moment of inertia') || lowerTopic.includes('second moment')) {
      return this.explainMomentOfInertia();
    }
    
    // Bearing capacity
    if (lowerTopic.includes('bearing capacity')) {
      return this.explainBearingCapacity();
    }
    
    // Seismic/Earthquake
    if (lowerTopic.includes('seismic') || lowerTopic.includes('earthquake')) {
      return this.explainSeismicDesign();
    }
    
    // Frame types
    if (lowerTopic.includes('smrf') || lowerTopic.includes('omrf') || lowerTopic.includes('moment frame')) {
      return this.explainFrameTypes();
    }
    
    // Truss
    if (lowerTopic.includes('truss') || lowerTopic.includes('warren') || lowerTopic.includes('pratt')) {
      return this.explainTrussTypes();
    }
    
    // Default
    return this.generateGenericExplanation(topic, domain);
  }

  private explainDeflection(): GeneratedResponse {
    return {
      message: `## Understanding Deflection in Structures

### What is Deflection?
Deflection is the **displacement** of a structural member from its original position when subjected to loads. It's a measure of how much a beam, column, or frame "bends" or "moves" under loading.

### Why is it Important?
1. **Serviceability** - Excessive deflection can cause:
   - Cracking of finishes (plaster, tiles)
   - Ponding of water on roofs
   - Discomfort to occupants (vibration)
   - Misalignment of doors/windows
   
2. **Functionality** - Equipment and machinery may not work properly
3. **Aesthetics** - Visible sagging is unacceptable

### Key Formulas

#### Simply Supported Beam
| Load Type | Maximum Deflection |
|-----------|-------------------|
| Point load at center | δ = PL³/(48EI) |
| Uniformly distributed (UDL) | δ = 5wL⁴/(384EI) |
| Point load at distance 'a' | δ = Pa²(L-a)²/(3EIL) |

#### Cantilever Beam
| Load Type | Maximum Deflection |
|-----------|-------------------|
| Point load at end | δ = PL³/(3EI) |
| UDL | δ = wL⁴/(8EI) |

### Deflection Limits (IS 800:2007)
- Floor beams (gravity): **L/300** to **L/360**
- Roof beams: **L/240** to **L/300**  
- Cantilevers: **L/150** to **L/180**
- Total (gravity + wind): **L/250**

### Practical Example
**Problem:** A simply supported beam of span 6m carries a UDL of 20 kN/m.
- Section: ISMB 400 (I = 20,458 cm⁴)
- Material: Steel (E = 200 GPa)

**Solution:**
δ = 5wL⁴/(384EI)
δ = 5 × 20 × 6⁴/(384 × 200×10⁶ × 20,458×10⁻⁸)
δ = **0.0104 m = 10.4 mm**

Limit = L/300 = 6000/300 = **20 mm**

✅ **Deflection OK** (10.4 mm < 20 mm)`,
      type: 'explanation',
      confidence: 0.95,
      formulas: [
        {
          name: 'Simply Supported - UDL',
          formula: 'δ = 5wL⁴/(384EI)',
          variables: { 'w': 'Load (kN/m)', 'L': 'Span (m)', 'E': 'Modulus (kPa)', 'I': 'Inertia (m⁴)' },
          application: 'Maximum deflection at midspan',
        },
      ],
      codeReferences: [
        { code: 'IS 800:2007', clause: 'Table 6', description: 'Deflection limits for steel structures' },
      ],
      learningResources: [
        {
          topic: 'Deflection',
          explanation: 'Fundamental serviceability check',
          references: ['IS 800:2007', 'AISC 360'],
          relatedTopics: ['Moment of Inertia', 'Bending Moment', 'Serviceability'],
        },
      ],
    };
  }

  private explainBendingMoment(): GeneratedResponse {
    return {
      message: `## Understanding Bending Moment

### What is Bending Moment?
Bending moment is the **internal moment** that develops in a structural member when subjected to transverse loads. It causes the member to curve or bend.

### Physical Understanding
- When a beam bends:
  - **Top fibers compress** (negative strain)
  - **Bottom fibers stretch** (positive strain)
  - **Neutral axis** - zero strain (typically at centroid)
  
- The **sign convention**:
  - Positive moment (+) → Sagging → Tension at bottom
  - Negative moment (-) → Hogging → Tension at top

### Key Formulas

#### Simply Supported Beam
| Load Type | Maximum Moment | Location |
|-----------|---------------|----------|
| Point load P at center | M = PL/4 | At center |
| UDL w | M = wL²/8 | At center |
| Point load at 'a' from left | M = Pab/L | At load point |

#### Cantilever
| Load Type | Maximum Moment | Location |
|-----------|---------------|----------|
| Point load at end | M = PL | At support |
| UDL | M = wL²/2 | At support |

#### Fixed-Fixed Beam
| Load Type | Support Moment | Midspan Moment |
|-----------|---------------|----------------|
| Point load at center | M = PL/8 | M = PL/8 |
| UDL | M = wL²/12 | M = wL²/24 |

### Relationship to Stress
The bending stress at any fiber is:
**σ = My/I**

Where:
- σ = Bending stress (MPa)
- M = Bending moment (kN·m)
- y = Distance from neutral axis (m)
- I = Moment of inertia (m⁴)

### Design Criterion
For safe design: **M ≤ φMn** (LRFD) or **M ≤ Mn/γm** (IS)

Where Mn = plastic moment capacity = fy × Zp

### Practical Example
**Problem:** Find max bending moment for a 8m simply supported beam with 15 kN/m UDL.

**Solution:**
M = wL²/8 = 15 × 8²/8 = **120 kN·m**`,
      type: 'explanation',
      confidence: 0.95,
      formulas: [
        {
          name: 'Bending Stress',
          formula: 'σ = My/I',
          variables: { 'M': 'Moment', 'y': 'Distance from NA', 'I': 'Moment of inertia' },
          application: 'Calculate fiber stress at any location',
        },
      ],
    };
  }

  private explainBuckling(): GeneratedResponse {
    return {
      message: `## Understanding Buckling

### What is Buckling?
Buckling is a **sudden sideways deflection** of a slender compression member. It's an instability failure that can occur at stresses well below the material's yield strength.

### Types of Buckling
1. **Euler (Flexural) Buckling** - Column bows sideways
2. **Lateral-Torsional Buckling** - Beam twists and deflects laterally
3. **Local Buckling** - Thin plate elements buckle locally
4. **Torsional Buckling** - Pure twisting (thin-walled open sections)

### Euler's Critical Load
**Pcr = π²EI/(KL)²**

Or in terms of critical stress:
**σcr = π²E/(KL/r)²**

### Effective Length Factor (K)
| End Conditions | K Value | Description |
|---------------|---------|-------------|
| Fixed-Fixed | 0.5 | Both ends fully restrained |
| Fixed-Pinned | 0.7 | One fixed, one pinned |
| Pinned-Pinned | 1.0 | Both ends pinned |
| Fixed-Free | 2.0 | Cantilever column |

### Slenderness Ratio
**λ = KL/r**

Where r = √(I/A) is the radius of gyration

#### Slenderness Limits (IS 800:2007)
| Member Type | Maximum λ |
|-------------|-----------|
| Compression members | 180 |
| Tension members | 400 |
| Bracing members | 300 |

### Design Approach
For slender columns (λ > λ₀):
- Use column curves (buckling curves a, b, c, d)
- Apply reduction factor χ to yield capacity

### Practical Example
**Problem:** Check slenderness of ISMB 300 column, height 4m, both ends pinned.

**Given:** ISMB 300: A = 58.7 cm², Iy = 5.8 cm⁴, ry = 3.14 cm

**Solution:**
λ = KL/r = 1.0 × 4000/31.4 = **127.4**

Limit = 180 → **127.4 < 180** ✅ OK`,
      type: 'explanation',
      confidence: 0.95,
      formulas: [
        {
          name: 'Euler Buckling Load',
          formula: 'Pcr = π²EI/(KL)²',
          variables: { 'E': 'Elastic modulus', 'I': 'Moment of inertia', 'K': 'Effective length factor', 'L': 'Length' },
          application: 'Critical buckling load for elastic columns',
        },
      ],
      codeReferences: [
        { code: 'IS 800:2007', clause: '7.1', description: 'Design of compression members' },
        { code: 'IS 800:2007', clause: 'Table 3', description: 'Slenderness limits' },
      ],
    };
  }

  private explainPDelta(): GeneratedResponse {
    return {
      message: `## Understanding P-Delta Effects

### What are P-Delta Effects?
P-Delta refers to **second-order effects** that occur when axial loads (P) act on a structure that has already displaced (Delta). The displaced geometry creates additional moments beyond first-order analysis.

### Types of P-Delta
1. **P-Δ (P-big delta)** - Frame/story level
   - Caused by story drift under lateral loads
   - Axial loads act on displaced floors
   
2. **P-δ (P-small delta)** - Member level
   - Caused by member curvature
   - Axial load acts on deformed member shape

### Why is it Important?
- **Underestimation of moments** - First-order analysis misses these effects
- **Stability** - Can lead to instability if not accounted for
- **Tall buildings** - Effects increase with height
- **Slender members** - More pronounced in flexible structures

### When to Consider P-Delta
P-Delta analysis is required when:
- θ = P_total × Δ / (V × h) > **0.10** (IS 1893)
- B₂ = 1/(1 - ΣPu/ΣPe) > **1.1** (AISC)
- Buildings > **4 stories**
- Story drift > **1.5%**

### Amplification Factor (B₂)
**B₂ = 1/(1 - ΣPu/ΣPe)**

Where:
- ΣPu = Total gravity load on story
- ΣPe = Elastic critical buckling load = π²EI/(KL)²

### Impact on Design
| Building Height | Typical Amplification |
|----------------|----------------------|
| 1-4 stories | 1.0 - 1.05 (negligible) |
| 5-10 stories | 1.05 - 1.15 |
| 10-20 stories | 1.10 - 1.25 |
| > 20 stories | 1.15 - 1.40+ |

### Design Recommendations
1. Always run P-Delta analysis for buildings > 4 stories
2. Use iterative geometric nonlinear analysis
3. Increase column sizes if B₂ > 1.5
4. Add bracing to reduce drift
5. Consider both P-Δ and P-δ for slender columns`,
      type: 'explanation',
      confidence: 0.95,
      formulas: [
        {
          name: 'Stability Coefficient',
          formula: 'θ = PΔ/(Vh)',
          variables: { 'P': 'Total gravity load', 'Δ': 'Story drift', 'V': 'Story shear', 'h': 'Story height' },
          application: 'Check if P-Delta is significant',
        },
        {
          name: 'Amplification Factor',
          formula: 'B₂ = 1/(1 - ΣPu/ΣPe)',
          variables: { 'ΣPu': 'Total factored gravity', 'ΣPe': 'Elastic buckling load' },
          application: 'Amplify first-order moments',
        },
      ],
      codeReferences: [
        { code: 'IS 1893:2016', clause: '7.10', description: 'P-Delta effects in seismic design' },
        { code: 'AISC 360', clause: 'Appendix 8', description: 'Second-order analysis' },
      ],
    };
  }

  private explainShearForce(): GeneratedResponse {
    return {
      message: `## Understanding Shear Force

### What is Shear Force?
Shear force is the **internal force acting parallel to the cross-section** of a structural member. It represents the tendency of one part of the member to slide past another.

### Physical Understanding
- Shear force causes **sliding deformation**
- Acts tangent to the cross-section
- Creates **shear stress** distributed across the section

### Key Formulas

#### Shear Force at Supports
| Configuration | Reaction |
|--------------|----------|
| SS with UDL | V = wL/2 |
| SS with point load at center | V = P/2 |
| Cantilever with point at end | V = P |
| Cantilever with UDL | V = wL |

#### Shear Stress Distribution
**τ = VQ/(Ib)**

Where:
- V = Shear force
- Q = First moment of area above the point
- I = Moment of inertia
- b = Width at the point

### Shear Stress in I-Beams
For I-sections, shear is primarily carried by the **web**:
**τ_avg ≈ V/(d × tw)**

Where d = depth, tw = web thickness

### Design Check (IS 800:2007)
**V ≤ Vd = Av × fyw/(√3 × γm0)**

Where:
- Av = Shear area (d × tw for I-sections)
- fyw = Yield strength of web
- γm0 = 1.10

### Practical Example
**Problem:** ISMB 400 beam with V = 200 kN. Check shear capacity.

**Given:** ISMB 400: d = 400mm, tw = 8.9mm, fy = 250 MPa

**Solution:**
Av = d × tw = 400 × 8.9 = 3560 mm²
Vd = 3560 × 250/(√3 × 1.10 × 1000) = **467 kN**

Utilization = 200/467 = **0.43** ✅ OK`,
      type: 'explanation',
      confidence: 0.95,
    };
  }

  private explainMomentOfInertia(): GeneratedResponse {
    return {
      message: `## Understanding Moment of Inertia

### What is Moment of Inertia?
Moment of inertia (Second Moment of Area) is a geometric property that measures a cross-section's **resistance to bending**. Higher I means less deflection and lower bending stress.

### Formula
**I = ∫y²dA**

It represents the "spread" of area away from the neutral axis.

### Standard Formulas
| Shape | Ix (about centroid) |
|-------|---------------------|
| Rectangle | bh³/12 |
| Circle | πd⁴/64 |
| Triangle | bh³/36 |
| I-section | Use tables |

### Parallel Axis Theorem
When calculating I about a non-centroidal axis:
**I = Ic + Ad²**

Where:
- Ic = I about centroid
- A = Area
- d = Distance between axes

### Why is it Important?
1. **Deflection** - δ ∝ 1/I (inversely proportional)
2. **Bending Stress** - σ = My/I
3. **Buckling** - Pcr ∝ I

### Practical Application
For the same area:
- I-section is ~10x more efficient than rectangle
- Deeper sections have higher I
- Material far from NA contributes more

### Section Selection Guide
| Span | Typical ISMB |
|------|--------------|
| 3-4m | ISMB 200-250 |
| 5-6m | ISMB 300-350 |
| 7-8m | ISMB 400-450 |
| 9-10m | ISMB 500-550 |
| >10m | ISMB 600 or plate girder |`,
      type: 'explanation',
      confidence: 0.95,
    };
  }

  private explainBearingCapacity(): GeneratedResponse {
    const bcInfo = this.knowledge.getBearingCapacityInfo();
    return {
      message: `## Understanding Bearing Capacity

### What is Bearing Capacity?
Bearing capacity is the **maximum pressure that soil can support** without experiencing shear failure. It's critical for foundation design.

### Types
1. **Ultimate Bearing Capacity (qu)** - Causes shear failure
2. **Safe Bearing Capacity (qa)** - qu divided by Factor of Safety
3. **Allowable Bearing Pressure** - Considering settlement also

### Terzaghi's Equation (Strip Footing)
**${bcInfo.formula}**

For square footing: qu = 1.3cNc + qNq + 0.4γBNγ
For circular footing: qu = 1.3cNc + qNq + 0.3γBNγ

### Bearing Capacity Factors
| φ° | Nc | Nq | Nγ |
|----|-----|-----|-----|
| 0 | 5.7 | 1.0 | 0 |
| 10 | 8.3 | 2.5 | 0.5 |
| 20 | 14.8 | 6.4 | 3.6 |
| 25 | 20.7 | 10.7 | 6.8 |
| 30 | 30.1 | 18.4 | 15.1 |
| 35 | 46.1 | 33.3 | 33.9 |
| 40 | 75.3 | 64.2 | 79.5 |

### Factor of Safety
- Normally: FOS = 2.5 to 3.0
- For isolated footings: qa = qu/3
- With settlement control: May govern

### Practical Example
**Problem:** Square footing 2m × 2m, Df = 1m, soil: c = 20 kPa, φ = 25°, γ = 18 kN/m³

**Solution:**
From table: Nc = 20.7, Nq = 10.7, Nγ = 6.8
q = γDf = 18 × 1 = 18 kPa

qu = 1.3 × 20 × 20.7 + 18 × 10.7 + 0.4 × 18 × 2 × 6.8
qu = 538 + 193 + 98 = **829 kPa**

qa = 829/3 = **276 kPa** (Safe bearing capacity)`,
      type: 'explanation',
      confidence: 0.95,
      formulas: [bcInfo],
      codeReferences: [
        { code: 'IS 6403:1981', clause: '5', description: 'Bearing capacity of shallow foundations' },
      ],
    };
  }

  private explainSeismicDesign(): GeneratedResponse {
    return {
      message: `## Seismic Design Principles (IS 1893:2016)

### Seismic Zones in India
| Zone | Z Factor | Seismicity |
|------|----------|------------|
| II | 0.10 | Low |
| III | 0.16 | Moderate |
| IV | 0.24 | Severe |
| V | 0.36 | Very Severe |

### Base Shear Calculation
**VB = (Z/2) × (I/R) × (Sa/g) × W**

Where:
- Z = Zone factor
- I = Importance factor (1.0-1.5)
- R = Response reduction factor
- Sa/g = Spectral acceleration
- W = Seismic weight

### Response Reduction Factor (R)
| System | R |
|--------|---|
| OMRF | 3.0 |
| SMRF | 5.0 |
| SCBF | 4.0 |
| Shear walls | 4.0 |
| Dual system | 5.0 |

### Spectral Acceleration (Sa/g)
For medium soil (Type II):
- T < 0.55s: Sa/g = 1 + 15T
- 0.55 ≤ T ≤ 4.0s: Sa/g = 2.5
- T > 4.0s: Sa/g = 1.0/T

### Drift Limits
- For frames: h/250
- For frames with masonry: h/400
- For buildings with brittle finishes: h/500

### Design Philosophy
1. **Minor earthquakes** - No damage
2. **Moderate earthquakes** - Non-structural damage only
3. **Major earthquakes** - No collapse, life safety`,
      type: 'explanation',
      confidence: 0.95,
      codeReferences: [
        { code: 'IS 1893:2016', clause: '6.4', description: 'Design horizontal seismic coefficient' },
        { code: 'IS 1893:2016', clause: '7.11', description: 'Drift limitation' },
      ],
    };
  }

  private explainFrameTypes(): GeneratedResponse {
    return {
      message: `## Understanding Moment Frame Types

### OMRF - Ordinary Moment Resisting Frame
- **R Factor:** 3.0
- **Ductility:** Limited
- **Detailing:** Standard IS 800/456 requirements
- **Height Limit:** 4 stories in Zone V, 8 stories in Zone IV
- **Use:** Low seismic zones, non-critical buildings

### IMRF - Intermediate Moment Resisting Frame
- **R Factor:** 4.0
- **Ductility:** Moderate
- **Detailing:** Enhanced detailing per IS 13920
- **Height Limit:** 10-15 stories
- **Use:** Moderate seismic zones

### SMRF - Special Moment Resisting Frame
- **R Factor:** 5.0
- **Ductility:** High
- **Detailing:** Special seismic detailing
  - Strong column-weak beam
  - Close hoop spacing in joints
  - Capacity-based design
- **Height Limit:** Up to 25 stories
- **Use:** High seismic zones, important buildings

### Key Differences
| Feature | OMRF | SMRF |
|---------|------|------|
| Column/beam strength ratio | 1.0 | 1.2 minimum |
| Hoop spacing in joints | d/4 | d/4 (max 100mm) |
| Confinement | Basic | Enhanced |
| Drift capacity | 2% | 4% |
| Cost premium | Baseline | +15-20% |

### When to Use Which?
- **Zone II/III:** OMRF acceptable
- **Zone IV:** IMRF minimum, SMRF preferred
- **Zone V:** SMRF required for buildings > 2 stories
- **Critical facilities:** Always SMRF regardless of zone`,
      type: 'explanation',
      confidence: 0.95,
    };
  }

  private explainTrussTypes(): GeneratedResponse {
    return {
      message: `## Understanding Truss Types

### Pratt Truss
- **Pattern:** Verticals in compression, diagonals in tension
- **Best for:** Steel structures (tension diagonals more efficient)
- **Span:** 6-30m typical
- **Depth:** Span/8 to Span/10
- **Use:** Roof trusses, short-span bridges

### Howe Truss
- **Pattern:** Verticals in tension, diagonals in compression
- **Best for:** Timber structures (short compression members)
- **Historical:** Common in 19th century
- **Opposite:** Mirror of Pratt under gravity

### Warren Truss
- **Pattern:** No verticals, equilateral triangles
- **Best for:** Uniform loads, bridges
- **Efficiency:** Very efficient material use
- **Span:** 15-50m
- **Depth:** Span/10 to Span/12

### K-Truss
- **Pattern:** K-shaped web members
- **Advantage:** Reduced buckling length of compression members
- **Best for:** Very long spans (40-100m)
- **Complexity:** More joints to fabricate

### Vierendeel
- **Pattern:** Rectangular panels (not triangulated)
- **Note:** Actually a frame, not true truss
- **Use:** Architectural (window openings needed)
- **Efficiency:** Lower than triangulated trusses

### Selection Guide
| Span | Recommended |
|------|-------------|
| < 10m | Pratt or Howe |
| 10-30m | Warren or Pratt |
| 30-60m | Warren with subdivisions |
| > 60m | K-truss or through truss |`,
      type: 'explanation',
      confidence: 0.95,
    };
  }

  private generateGenericExplanation(topic: string, domain: EngineeringDomain): GeneratedResponse {
    return {
      message: `## ${topic.charAt(0).toUpperCase() + topic.slice(1)}

I can provide detailed explanations on structural engineering topics including:

### Mechanics
- Stress and strain analysis
- Bending moments and shear forces
- Deflection calculations
- Buckling and stability
- P-Delta effects

### Analysis Methods
- Static analysis
- Dynamic/modal analysis
- Response spectrum method
- Time history analysis
- Nonlinear analysis

### Design
- Steel design (IS 800, AISC)
- Concrete design (IS 456, ACI)
- Seismic design (IS 1893)
- Connection design

### Structures
- Buildings and frames
- Bridges and trusses
- Industrial structures
- Foundations

Could you be more specific about what aspect of "${topic}" you'd like me to explain?`,
      type: 'explanation',
      confidence: 0.6,
      followUp: [
        { question: 'What specific aspect interests you?', context: topic },
      ],
    };
  }
}

// ============================================
// MAIN RESPONSE GENERATOR
// ============================================

export class IntelligentResponseGenerator {
  private explanationGenerator: ExplanationGenerator;
  private knowledge: KnowledgeRetriever;

  constructor() {
    this.explanationGenerator = new ExplanationGenerator();
    this.knowledge = new KnowledgeRetriever();
  }

  /**
   * Generate intelligent response based on interpretation
   */
  generateResponse(interpretation: InterpretationResult): GeneratedResponse {
    const { intent, entities, context } = interpretation;

    switch (intent.primary) {
      case 'greeting':
        return this.generateGreeting();
      
      case 'help':
        return this.generateHelp();
      
      case 'explain':
        return this.generateExplanation(interpretation);
      
      case 'create':
        return this.generateStructureCreation(interpretation);
      
      case 'analyze':
        return this.generateAnalysisGuidance(interpretation);
      
      case 'design':
        return this.generateDesignCheck(interpretation);
      
      case 'recommend':
        return this.generateRecommendation(interpretation);
      
      case 'calculate':
        return this.generateCalculation(interpretation);
      
      case 'troubleshoot':
        return this.generateTroubleshooting(interpretation);
      
      case 'question':
        return this.handleQuestion(interpretation);
      
      case 'confirm':
        return { message: "Great! Let's proceed.", type: 'conversation', confidence: 1.0 };
      
      case 'cancel':
        return { message: "No problem. What else can I help you with?", type: 'conversation', confidence: 1.0 };
      
      default:
        return this.generateUnclearResponse(interpretation);
    }
  }

  private generateGreeting(): GeneratedResponse {
    return {
      message: RESPONSE_TEMPLATES.greeting[0],
      type: 'conversation',
      confidence: 1.0,
    };
  }

  private generateHelp(): GeneratedResponse {
    return {
      message: RESPONSE_TEMPLATES.help[0],
      type: 'conversation',
      confidence: 1.0,
    };
  }

  private generateExplanation(interpretation: InterpretationResult): GeneratedResponse {
    // Extract the topic from entities or raw text
    const topic = interpretation.rawText.replace(/explain|describe|what is|how does|tell me about/gi, '').trim();
    return this.explanationGenerator.generateExplanation(topic, interpretation.intent.domain);
  }

  private generateStructureCreation(interpretation: InterpretationResult): GeneratedResponse {
    const structureEntity = interpretation.entities.find(e => e.type === 'structure');
    const dimensionEntities = interpretation.entities.filter(e => e.type === 'dimension');
    const materialEntity = interpretation.entities.find(e => e.type === 'material');

    if (!structureEntity) {
      return {
        message: "I'd be happy to create a structure for you! Please tell me:\n\n" +
          "1. **What type** of structure? (building, bridge, truss, frame, etc.)\n" +
          "2. **Dimensions** - span, height, number of stories/bays\n" +
          "3. **Material** - steel, concrete, or timber?\n\n" +
          "For example:\n" +
          '- "Create a 5-story steel building with 3 bays, 8m span"\n' +
          '- "Design a 30m Warren truss bridge"\n' +
          '- "Generate a portal frame, 20m span, 10m height"',
        type: 'clarification',
        confidence: 0.7,
      };
    }

    const params: Record<string, any> = {};
    for (const dim of dimensionEntities) {
      if (dim.metadata?.dimensionType === 'span') params.span = dim.value;
      if (dim.metadata?.dimensionType === 'height') params.height = dim.value;
      if (dim.metadata?.dimensionType === 'stories') params.stories = dim.value;
      if (dim.metadata?.dimensionType === 'bays') params.bays = dim.value;
    }

    const structureType = structureEntity.value as string;
    const material = (materialEntity?.value as string) || 'structural_steel';

    return {
      message: `## Creating ${structureType.replace(/_/g, ' ').toUpperCase()}

I'll generate a ${structureType.replace(/_/g, ' ')} with the following parameters:

| Parameter | Value |
|-----------|-------|
| Type | ${structureType.replace(/_/g, ' ')} |
| Material | ${material.replace(/_/g, ' ')} |
${params.span ? `| Span | ${params.span}m |` : ''}
${params.height ? `| Height | ${params.height}m |` : ''}
${params.stories ? `| Stories | ${params.stories} |` : ''}
${params.bays ? `| Bays | ${params.bays} |` : ''}

### Design Assumptions
- Material: E250 Grade Steel (fy = 250 MPa)
- Dead load: 5 kN/m² (typical)
- Live load: 3 kN/m² (office occupancy)
- Design code: IS 800:2007

The structure will be generated with:
✅ Optimized member sizes
✅ Standard IS sections (ISMB/ISMC)
✅ Fixed supports at base
✅ Dead and live load cases

*Structure generation in progress...*`,
      type: 'structure_generation',
      confidence: 0.85,
      recommendations: [
        {
          type: 'design',
          recommendation: 'Run structural analysis after creation',
          justification: 'Verify member adequacy under all load combinations',
          priority: 'high',
        },
      ],
    };
  }

  private generateAnalysisGuidance(interpretation: InterpretationResult): GeneratedResponse {
    const analysisEntity = interpretation.entities.find(e => e.type === 'analysis_type');
    const analysisType = (analysisEntity?.value as string) || 'linear_static';

    return {
      message: `## ${analysisType.replace(/_/g, ' ').toUpperCase()} Analysis

### Analysis Settings
| Parameter | Value |
|-----------|-------|
| Analysis Type | ${analysisType.replace(/_/g, ' ')} |
| Solver | Direct Stiffness Method |
| DOF per node | 6 (3D frame) |

### Load Combinations (IS 875)
1. **LC1:** 1.5 DL + 1.5 LL
2. **LC2:** 1.2 DL + 1.2 LL + 1.2 WL
3. **LC3:** 1.5 DL + 1.5 WL
4. **LC4:** 0.9 DL + 1.5 WL (uplift)
5. **LC5:** 1.2 DL + 1.2 LL + 1.2 EQ
6. **LC6:** 1.5 DL + 1.5 EQ
7. **LC7:** 0.9 DL + 1.5 EQ

### What I'll Check
- ✅ Maximum deflection vs limits
- ✅ Maximum bending moment
- ✅ Maximum shear force
- ✅ Support reactions
- ✅ Member utilization ratios

Ready to run the analysis on your current model?`,
      type: 'analysis_result',
      confidence: 0.9,
      codeReferences: this.knowledge.getCodeRequirements('IS800'),
    };
  }

  private generateDesignCheck(interpretation: InterpretationResult): GeneratedResponse {
    const codeEntity = interpretation.entities.find(e => e.type === 'design_code');
    const code = (codeEntity?.value as string) || 'IS800:2007';

    return {
      message: `## Design Check per ${code}

### Checks to Perform

#### Strength Checks
- [ ] Bending moment capacity (Md)
- [ ] Shear capacity (Vd)
- [ ] Axial capacity (Pd)
- [ ] Combined actions (interaction)

#### Stability Checks
- [ ] Slenderness limits
- [ ] Lateral-torsional buckling
- [ ] Local buckling (class of section)

#### Serviceability Checks
- [ ] Deflection limits
- [ ] Vibration (if applicable)

### Design Criteria (${code})
- γm0 = 1.10 (yielding)
- γm1 = 1.25 (ultimate)
- Deflection limit = L/300 (gravity), L/250 (total)

### Results Format
I'll provide:
1. Utilization ratio for each member
2. Pass/Fail status
3. Critical load combination
4. Recommendations for failed members

Shall I proceed with the design check?`,
      type: 'design_check',
      confidence: 0.85,
      codeReferences: this.knowledge.getCodeRequirements(code),
    };
  }

  private generateRecommendation(interpretation: InterpretationResult): GeneratedResponse {
    const propertyEntity = interpretation.entities.find(e => e.type === 'property');
    
    return {
      message: `## Section Recommendations

Based on your requirements, I recommend:

### For Beams
| Span | Section | Weight | Ix |
|------|---------|--------|-----|
| 4-5m | ISMB 250 | 37.3 kg/m | 5132 cm⁴ |
| 5-6m | ISMB 300 | 46.1 kg/m | 8603 cm⁴ |
| 6-8m | ISMB 400 | 61.6 kg/m | 20458 cm⁴ |
| 8-10m | ISMB 500 | 86.9 kg/m | 45218 cm⁴ |

### For Columns
| Height | Axial Load | Section |
|--------|------------|---------|
| 3-4m | < 500 kN | ISHB 200 |
| 3-4m | 500-1000 kN | ISHB 300 |
| 4-5m | < 500 kN | ISHB 225 |
| 4-5m | 500-1000 kN | ISHB 350 |

### Selection Factors
1. **Strength** - Adequate capacity for design forces
2. **Stiffness** - Deflection within limits
3. **Stability** - Slenderness ratio acceptable
4. **Economy** - Not over-designed
5. **Availability** - Standard section

Would you like me to recommend sections for your specific loading?`,
      type: 'recommendation',
      confidence: 0.8,
      recommendations: [
        {
          type: 'section',
          recommendation: 'Use ISMB sections for beams',
          justification: 'Better flexural efficiency than ISHB for beam applications',
          alternatives: ['ISHB for heavy loads', 'Built-up sections for very long spans'],
          priority: 'medium',
        },
      ],
    };
  }

  private generateCalculation(interpretation: InterpretationResult): GeneratedResponse {
    const propertyEntity = interpretation.entities.find(e => e.type === 'property');
    const property = (propertyEntity?.value as string) || 'deflection';

    return {
      message: `## ${property.charAt(0).toUpperCase() + property.slice(1)} Calculation

To calculate ${property}, I need:

1. **Member geometry**
   - Span/length
   - Support conditions

2. **Section properties**
   - Moment of inertia (I)
   - Section modulus (Z)
   - Area (A)

3. **Loading**
   - Load type (point, UDL, varying)
   - Load magnitude

4. **Material**
   - Elastic modulus (E)
   - Yield strength (fy)

Please provide these details, or I can calculate using your current model.

### Quick Reference
For a **simply supported beam with UDL**:
- Deflection: δ = 5wL⁴/(384EI)
- Max moment: M = wL²/8
- Max shear: V = wL/2

Shall I calculate using your model data?`,
      type: 'calculation',
      confidence: 0.75,
    };
  }

  private generateTroubleshooting(interpretation: InterpretationResult): GeneratedResponse {
    return {
      message: `## Troubleshooting Guide

### Common Issues and Solutions

#### 1. Analysis Won't Run
**Possible causes:**
- Unstable structure (mechanism)
- Missing supports
- Disconnected members

**Solution:**
- Check all nodes have proper restraints
- Verify member connectivity
- Run stability check first

#### 2. Excessive Deflection
**Possible causes:**
- Members too small
- Span too long
- Inadequate support

**Solution:**
- Increase section size
- Add intermediate supports
- Use deeper sections (higher I)

#### 3. Stress Ratio > 1.0
**Possible causes:**
- Under-designed members
- Missing load combinations
- Incorrect material properties

**Solution:**
- Increase member size
- Check load factors
- Verify material grade

#### 4. Singular Matrix Error
**Possible causes:**
- Collinear nodes
- Zero-length members
- No restraints in a direction

**Solution:**
- Check for duplicate nodes
- Verify member lengths > 0
- Add missing support restraints

### What issue are you experiencing?`,
      type: 'troubleshooting',
      confidence: 0.85,
      warnings: [
        {
          severity: 'info',
          message: 'Describe your specific issue for targeted help',
          suggestion: 'Include error messages if any',
        },
      ],
    };
  }

  private handleQuestion(interpretation: InterpretationResult): GeneratedResponse {
    // Route questions to appropriate handlers
    const text = interpretation.rawText.toLowerCase();
    
    if (text.includes('section') || text.includes('size') || text.includes('member')) {
      return this.generateRecommendation(interpretation);
    }
    
    if (text.includes('safe') || text.includes('adequate') || text.includes('check')) {
      return this.generateDesignCheck(interpretation);
    }
    
    if (text.includes('why') || text.includes('how') || text.includes('what is')) {
      return this.generateExplanation(interpretation);
    }

    return {
      message: "I'm here to help! I can answer questions about:\n\n" +
        "- **Structural concepts** (deflection, moment, buckling)\n" +
        "- **Design codes** (IS 800, IS 456, AISC)\n" +
        "- **Section selection** (beams, columns, braces)\n" +
        "- **Analysis methods** (static, dynamic, seismic)\n" +
        "- **Your current model** (results, issues)\n\n" +
        "What would you like to know?",
      type: 'conversation',
      confidence: 0.6,
    };
  }

  private generateUnclearResponse(interpretation: InterpretationResult): GeneratedResponse {
    return {
      message: RESPONSE_TEMPLATES.unclear[0],
      type: 'clarification',
      confidence: 0.4,
      followUp: [
        { question: 'What type of structure?', context: 'structure_type' },
        { question: 'What do you want to do?', context: 'action' },
      ],
    };
  }
}

// Export singleton
export const responseGenerator = new IntelligentResponseGenerator();

export default IntelligentResponseGenerator;
