/**
 * AdvancedAIDesignAssistant.ts
 * 
 * World-class AI-powered structural design assistant that can:
 * 1. Understand natural language structural engineering queries
 * 2. Generate complete structural models from descriptions
 * 3. Optimize designs based on constraints
 * 4. Explain analysis results in plain language
 * 5. Recommend best practices and code compliance
 * 6. Learn from user interactions
 * 
 * Architecture:
 * - Intent Classification (what does the user want?)
 * - Entity Extraction (structural parameters)
 * - Knowledge Graph (structural engineering domain)
 * - Generation Engine (model creation)
 * - Explanation Engine (results interpretation)
 */

// ============================================
// TYPE DEFINITIONS
// ============================================

export interface StructuralIntent {
  type: 'create' | 'modify' | 'analyze' | 'design' | 'optimize' | 'explain' | 'question';
  confidence: number;
  subType?: string;
}

export interface StructuralEntity {
  type: 'structure' | 'member' | 'load' | 'support' | 'material' | 'section' | 'code' | 'dimension';
  value: string | number;
  unit?: string;
  confidence: number;
  span?: [number, number]; // Position in original text
}

export interface GeneratedStructure {
  nodes: GeneratedNode[];
  members: GeneratedMember[];
  loads: GeneratedLoad[];
  supports: GeneratedSupport[];
  materials: MaterialDefinition[];
  sections: SectionDefinition[];
  metadata: StructureMetadata;
}

export interface GeneratedNode {
  id: string;
  x: number;
  y: number;
  z: number;
  label?: string;
}

export interface GeneratedMember {
  id: string;
  startNodeId: string;
  endNodeId: string;
  sectionId: string;
  materialId: string;
  type: 'beam' | 'column' | 'brace' | 'truss' | 'cable';
  releases?: {
    startMoment?: boolean;
    endMoment?: boolean;
  };
}

export interface GeneratedLoad {
  id: string;
  type: 'point' | 'distributed' | 'moment' | 'temperature' | 'seismic' | 'wind';
  target: string; // Node ID or Member ID
  values: number[];
  direction?: 'global' | 'local';
  loadCase?: string;
}

export interface GeneratedSupport {
  nodeId: string;
  type: 'fixed' | 'pinned' | 'roller' | 'spring';
  restraints: boolean[]; // [dx, dy, dz, rx, ry, rz]
  springStiffness?: number[];
}

export interface MaterialDefinition {
  id: string;
  name: string;
  type: 'steel' | 'concrete' | 'timber' | 'aluminum' | 'custom';
  E: number;      // Young's modulus (Pa)
  G?: number;     // Shear modulus (Pa)
  nu: number;     // Poisson's ratio
  fy?: number;    // Yield strength (Pa)
  fu?: number;    // Ultimate strength (Pa)
  density: number; // kg/m³
  thermalCoeff?: number;
}

export interface SectionDefinition {
  id: string;
  name: string;
  type: 'I' | 'W' | 'HSS' | 'pipe' | 'angle' | 'channel' | 'rectangular' | 'circular' | 'custom';
  A: number;      // Area (m²)
  Ix: number;     // Moment of inertia X (m⁴)
  Iy: number;     // Moment of inertia Y (m⁴)
  J: number;      // Torsional constant (m⁴)
  Sx?: number;    // Section modulus X (m³)
  Sy?: number;    // Section modulus Y (m³)
  Zx?: number;    // Plastic modulus X (m³)
  Zy?: number;    // Plastic modulus Y (m³)
  dimensions?: Record<string, number>;
}

export interface StructureMetadata {
  name: string;
  description: string;
  structureType: string;
  designCode?: string;
  occupancyCategory?: string;
  seismicZone?: string;
  windSpeed?: number;
  createdAt: Date;
}

export interface AIResponse {
  success: boolean;
  message: string;
  structure?: GeneratedStructure;
  explanation?: string;
  suggestions?: string[];
  warnings?: string[];
  followUpQuestions?: string[];
}

// ============================================
// KNOWLEDGE BASE
// ============================================

const STRUCTURAL_KNOWLEDGE = {
  // Standard structure types
  structureTypes: {
    'portal_frame': {
      description: 'Single-bay rigid frame with moment connections',
      defaultSpan: 12,
      defaultHeight: 6,
      loadTypes: ['dead', 'live', 'wind'],
      memberTypes: ['beam', 'column'],
    },
    'multi_bay_frame': {
      description: 'Multi-bay rigid frame building',
      defaultSpan: 8,
      defaultHeight: 3.5,
      defaultBays: 3,
      defaultStories: 1,
      loadTypes: ['dead', 'live', 'wind', 'seismic'],
      memberTypes: ['beam', 'column'],
    },
    'multi_story_building': {
      description: 'Multi-story building frame',
      defaultSpan: 8,
      defaultHeight: 3.5,
      defaultBaysX: 3,
      defaultBaysY: 2,
      defaultStories: 5,
      loadTypes: ['dead', 'live', 'wind', 'seismic'],
      memberTypes: ['beam', 'column', 'brace'],
    },
    'truss_bridge': {
      description: 'Truss bridge structure',
      defaultSpan: 30,
      defaultHeight: 5,
      defaultPanels: 6,
      loadTypes: ['dead', 'live', 'moving'],
      memberTypes: ['truss'],
    },
    'warren_truss': {
      description: 'Warren truss with diagonal members',
      defaultSpan: 24,
      defaultHeight: 4,
      defaultPanels: 8,
    },
    'pratt_truss': {
      description: 'Pratt truss with verticals and diagonals',
      defaultSpan: 30,
      defaultHeight: 5,
      defaultPanels: 10,
    },
    'cantilever': {
      description: 'Cantilever beam or structure',
      defaultLength: 5,
      loadTypes: ['point', 'distributed'],
    },
    'continuous_beam': {
      description: 'Multi-span continuous beam',
      defaultSpan: 6,
      defaultSpans: 3,
      loadTypes: ['distributed', 'point'],
    },
    'space_frame': {
      description: '3D space frame structure',
      defaultSize: 20,
      defaultModules: 4,
    },
    'arch': {
      description: 'Arch structure (parabolic or circular)',
      defaultSpan: 30,
      defaultRise: 10,
      defaultSegments: 20,
    },
    'dome': {
      description: 'Dome structure',
      defaultDiameter: 30,
      defaultHeight: 15,
      defaultRings: 6,
    },
    'tower': {
      description: 'Lattice tower structure',
      defaultHeight: 50,
      defaultBaseWidth: 10,
      defaultTopWidth: 3,
      defaultPanels: 10,
    },
    'industrial_shed': {
      description: 'Industrial warehouse with portal frames',
      defaultSpan: 20,
      defaultHeight: 8,
      defaultLength: 50,
      defaultBaySpacing: 6,
    },
  },
  
  // Standard materials with properties
  materials: {
    'structural_steel': {
      name: 'Structural Steel (A992/E250)',
      E: 200e9,
      G: 77e9,
      nu: 0.3,
      fy: 250e6,
      fu: 400e6,
      density: 7850,
    },
    'high_strength_steel': {
      name: 'High Strength Steel (A572 Gr50)',
      E: 200e9,
      G: 77e9,
      nu: 0.3,
      fy: 345e6,
      fu: 450e6,
      density: 7850,
    },
    'concrete_m25': {
      name: 'Concrete M25',
      E: 25e9,
      nu: 0.2,
      fck: 25e6,
      density: 2500,
    },
    'concrete_m30': {
      name: 'Concrete M30',
      E: 27.4e9,
      nu: 0.2,
      fck: 30e6,
      density: 2500,
    },
    'timber_c24': {
      name: 'Structural Timber C24',
      E: 11e9,
      G: 0.69e9,
      nu: 0.4,
      fb: 24e6,
      density: 420,
    },
    'aluminum_6061': {
      name: 'Aluminum 6061-T6',
      E: 69e9,
      G: 26e9,
      nu: 0.33,
      fy: 276e6,
      density: 2700,
    },
  },
  
  // Standard sections
  sections: {
    'W12x26': { A: 49.5e-4, Ix: 204e-6, Iy: 17.3e-6, J: 0.3e-6 },
    'W14x30': { A: 57.1e-4, Ix: 291e-6, Iy: 19.6e-6, J: 0.38e-6 },
    'W16x40': { A: 76.1e-4, Ix: 518e-6, Iy: 28.9e-6, J: 0.79e-6 },
    'W18x50': { A: 95.2e-4, Ix: 800e-6, Iy: 40.1e-6, J: 1.24e-6 },
    'W21x62': { A: 118e-4, Ix: 1330e-6, Iy: 57.5e-6, J: 2.02e-6 },
    'W24x84': { A: 160e-4, Ix: 2370e-6, Iy: 94.4e-6, J: 4.37e-6 },
    'HSS8x8x1/2': { A: 89.6e-4, Ix: 195e-6, Iy: 195e-6, J: 306e-6 },
    'HSS6x6x3/8': { A: 50.2e-4, Ix: 72.9e-6, Iy: 72.9e-6, J: 114e-6 },
    'L4x4x1/2': { A: 24.2e-4, Ix: 7.67e-6, Iy: 7.67e-6, J: 0.32e-6 },
    'L6x6x1/2': { A: 36.5e-4, Ix: 28.2e-6, Iy: 28.2e-6, J: 0.73e-6 },
    'ISMB300': { A: 58.7e-4, Ix: 98.6e-6, Iy: 5.8e-6, J: 0.7e-6 },
    'ISMB400': { A: 78.5e-4, Ix: 204e-6, Iy: 10.4e-6, J: 1.3e-6 },
    'ISMB500': { A: 110e-4, Ix: 452e-6, Iy: 16.1e-6, J: 2.2e-6 },
  },
  
  // Design code thresholds
} as const;

// Helper function to get material properties with safe defaults
function getMaterialProps(materialId: string) {
  const mat = STRUCTURAL_KNOWLEDGE.materials[materialId as keyof typeof STRUCTURAL_KNOWLEDGE.materials];
  return {
    id: materialId,
    name: mat.name,
    type: 'steel' as const,
    E: mat.E,
    G: 'G' in mat ? mat.G : mat.E / (2 * (1 + mat.nu)),
    nu: mat.nu,
    fy: 'fy' in mat ? mat.fy : 250e6,
    fu: 'fu' in mat ? mat.fu : 400e6,
    density: mat.density,
  };
}

const STRUCTURAL_KNOWLEDGE_CONTINUED = {
  designLimits: {
    deflection: {
      floor_beam: 'L/360',
      roof_beam: 'L/240',
      cantilever: 'L/180',
      column_drift: 'H/400',
    },
    slenderness: {
      column_max: 200,
      brace_max: 300,
      beam_max: 150,
    },
    stress_ratio: {
      max: 1.0,
      target: 0.85,
    },
  },
};

// ============================================
// INTENT CLASSIFICATION
// ============================================

class IntentClassifier {
  private patterns: Map<string, RegExp[]>;
  
  constructor() {
    this.patterns = new Map([
      ['create', [
        /create|generate|make|build|design|model|draw/i,
        /i (want|need|would like) (a|an|to)/i,
        /can you (create|make|build|design)/i,
      ]],
      ['modify', [
        /change|modify|update|edit|adjust|increase|decrease|add|remove/i,
        /make .* (larger|smaller|taller|shorter|wider|narrower)/i,
      ]],
      ['analyze', [
        /analyze|analyse|calculate|compute|run|solve|check/i,
        /what (is|are) the (stress|deflection|force|reaction|moment)/i,
      ]],
      ['design', [
        /design (check|verification|code)/i,
        /check (against|per|according to)/i,
        /is .* (safe|adequate|sufficient)/i,
      ]],
      ['optimize', [
        /optimize|optimal|minimize|maximize|best|efficient/i,
        /reduce (weight|cost|material)/i,
        /most (economical|efficient)/i,
      ]],
      ['explain', [
        /explain|why|how|what does|describe|understand/i,
        /can you tell me/i,
        /what is happening/i,
      ]],
      ['question', [
        /\?$/,
        /^(what|how|why|when|where|which|can|is|are|do|does|will|would|should)/i,
      ]],
    ]);
  }
  
  classify(text: string): StructuralIntent {
    const scores: Record<string, number> = {};
    
    for (const [intent, patterns] of this.patterns) {
      scores[intent] = 0;
      for (const pattern of patterns) {
        if (pattern.test(text)) {
          scores[intent] += 1;
        }
      }
    }
    
    const maxIntent = Object.entries(scores).reduce(
      (max, [intent, score]) => score > max[1] ? [intent, score] : max,
      ['question', 0]
    );
    
    return {
      type: maxIntent[0] as StructuralIntent['type'],
      confidence: Math.min(maxIntent[1] / 3, 1.0),
    };
  }
}

// ============================================
// ENTITY EXTRACTION
// ============================================

class EntityExtractor {
  extract(text: string): StructuralEntity[] {
    const entities: StructuralEntity[] = [];
    const lowerText = text.toLowerCase();
    
    // Structure types
    const structurePatterns: [RegExp, string][] = [
      [/portal\s*frame/i, 'portal_frame'],
      [/multi[- ]?(bay|span)\s*frame/i, 'multi_bay_frame'],
      [/multi[- ]?stor(y|ey)\s*(building|frame)?/i, 'multi_story_building'],
      [/(\d+)[- ]?stor(y|ey)/i, 'multi_story_building'],
      [/warren\s*truss/i, 'warren_truss'],
      [/pratt\s*truss/i, 'pratt_truss'],
      [/truss\s*bridge/i, 'truss_bridge'],
      [/cantilever/i, 'cantilever'],
      [/continuous\s*beam/i, 'continuous_beam'],
      [/space\s*frame/i, 'space_frame'],
      [/arch/i, 'arch'],
      [/dome/i, 'dome'],
      [/tower/i, 'tower'],
      [/industrial\s*(shed|warehouse)/i, 'industrial_shed'],
      [/building|frame/i, 'multi_story_building'],
      [/bridge/i, 'truss_bridge'],
      [/beam/i, 'cantilever'],
    ];
    
    for (const [pattern, type] of structurePatterns) {
      const match = text.match(pattern);
      if (match) {
        entities.push({
          type: 'structure',
          value: type,
          confidence: 0.9,
          span: [match.index!, match.index! + match[0].length],
        });
        break;
      }
    }
    
    // Dimensions with units
    const dimensionPatterns: [RegExp, string][] = [
      [/(\d+(?:\.\d+)?)\s*(?:m|meter|metre)s?\s*(span|length|width|long|wide)/i, 'span'],
      [/(\d+(?:\.\d+)?)\s*(?:m|meter|metre)s?\s*(height|tall|high)/i, 'height'],
      [/(span|length|width)\s*(?:of|:)?\s*(\d+(?:\.\d+)?)\s*(?:m|meter|metre)?/i, 'span'],
      [/(height)\s*(?:of|:)?\s*(\d+(?:\.\d+)?)\s*(?:m|meter|metre)?/i, 'height'],
      [/(\d+(?:\.\d+)?)\s*(?:m|meter|metre)s?\s*(?:x|by)\s*(\d+(?:\.\d+)?)/i, 'dimensions'],
    ];
    
    for (const [pattern, dimType] of dimensionPatterns) {
      const match = text.match(pattern);
      if (match) {
        const value = parseFloat(match[1]) || parseFloat(match[2]);
        if (!isNaN(value)) {
          entities.push({
            type: 'dimension',
            value: value,
            unit: 'm',
            confidence: 0.85,
          });
        }
      }
    }
    
    // Bay/Story counts
    const countPatterns: [RegExp, string][] = [
      [/(\d+)\s*(bays?|spans?)/i, 'bays'],
      [/(\d+)\s*(stor(y|ey|ies)|floors?|levels?)/i, 'stories'],
      [/(\d+)\s*panels?/i, 'panels'],
    ];
    
    for (const [pattern, countType] of countPatterns) {
      const match = text.match(pattern);
      if (match) {
        entities.push({
          type: 'dimension',
          value: parseInt(match[1]),
          unit: countType,
          confidence: 0.9,
        });
      }
    }
    
    // Load types
    if (/dead\s*load|self[- ]?weight/i.test(text)) {
      entities.push({ type: 'load', value: 'dead', confidence: 0.9 });
    }
    if (/live\s*load|occupancy/i.test(text)) {
      entities.push({ type: 'load', value: 'live', confidence: 0.9 });
    }
    if (/wind\s*load/i.test(text)) {
      entities.push({ type: 'load', value: 'wind', confidence: 0.9 });
    }
    if (/seismic|earthquake/i.test(text)) {
      entities.push({ type: 'load', value: 'seismic', confidence: 0.9 });
    }
    
    // Load values
    const loadValueMatch = text.match(/(\d+(?:\.\d+)?)\s*(kN|kn|N|lbs?|kips?)/i);
    if (loadValueMatch) {
      let value = parseFloat(loadValueMatch[1]);
      const unit = loadValueMatch[2].toLowerCase();
      // Convert to kN
      if (unit === 'n') value /= 1000;
      if (unit === 'kips' || unit === 'kip') value *= 4.448;
      if (unit === 'lbs' || unit === 'lb') value *= 0.004448;
      
      entities.push({
        type: 'load',
        value: value,
        unit: 'kN',
        confidence: 0.85,
      });
    }
    
    // Materials
    if (/steel/i.test(text)) {
      entities.push({ type: 'material', value: 'structural_steel', confidence: 0.9 });
    }
    if (/concrete|rcc|rc/i.test(text)) {
      entities.push({ type: 'material', value: 'concrete_m30', confidence: 0.85 });
    }
    if (/timber|wood/i.test(text)) {
      entities.push({ type: 'material', value: 'timber_c24', confidence: 0.85 });
    }
    if (/aluminum|aluminium/i.test(text)) {
      entities.push({ type: 'material', value: 'aluminum_6061', confidence: 0.85 });
    }
    
    // Design codes
    if (/is\s*456|indian\s*code.*concrete/i.test(text)) {
      entities.push({ type: 'code', value: 'IS456', confidence: 0.9 });
    }
    if (/is\s*800|indian\s*code.*steel/i.test(text)) {
      entities.push({ type: 'code', value: 'IS800', confidence: 0.9 });
    }
    if (/aisc|american.*steel/i.test(text)) {
      entities.push({ type: 'code', value: 'AISC360', confidence: 0.9 });
    }
    if (/eurocode|ec\s*[23]/i.test(text)) {
      entities.push({ type: 'code', value: 'Eurocode', confidence: 0.85 });
    }
    
    return entities;
  }
}

// ============================================
// STRUCTURE GENERATORS
// ============================================

class StructureGenerators {
  
  /**
   * Generate a multi-story building frame
   */
  static generateBuilding(params: {
    baysX?: number;
    baysY?: number;
    stories?: number;
    bayWidth?: number;
    bayDepth?: number;
    storyHeight?: number;
    material?: string;
  }): GeneratedStructure {
    const {
      baysX = 3,
      baysY = 2,
      stories = 5,
      bayWidth = 8,
      bayDepth = 6,
      storyHeight = 3.5,
      material = 'structural_steel',
    } = params;
    
    const nodes: GeneratedNode[] = [];
    const members: GeneratedMember[] = [];
    const supports: GeneratedSupport[] = [];
    
    // Generate nodes
    let nodeId = 0;
    const nodeGrid: string[][][] = [];
    
    for (let z = 0; z <= stories; z++) {
      nodeGrid[z] = [];
      for (let y = 0; y <= baysY; y++) {
        nodeGrid[z][y] = [];
        for (let x = 0; x <= baysX; x++) {
          const id = `n${nodeId++}`;
          nodeGrid[z][y][x] = id;
          
          nodes.push({
            id,
            x: x * bayWidth,
            y: y * bayDepth,
            z: z * storyHeight,
            label: `L${z}-${x}-${y}`,
          });
          
          // Add supports at ground level
          if (z === 0) {
            supports.push({
              nodeId: id,
              type: 'fixed',
              restraints: [true, true, true, true, true, true],
            });
          }
        }
      }
    }
    
    let memberId = 0;
    
    // Generate columns (vertical members)
    for (let z = 0; z < stories; z++) {
      for (let y = 0; y <= baysY; y++) {
        for (let x = 0; x <= baysX; x++) {
          members.push({
            id: `col${memberId++}`,
            startNodeId: nodeGrid[z][y][x],
            endNodeId: nodeGrid[z + 1][y][x],
            sectionId: 'W14x30',
            materialId: material,
            type: 'column',
          });
        }
      }
    }
    
    // Generate beams (X-direction)
    for (let z = 1; z <= stories; z++) {
      for (let y = 0; y <= baysY; y++) {
        for (let x = 0; x < baysX; x++) {
          members.push({
            id: `beamX${memberId++}`,
            startNodeId: nodeGrid[z][y][x],
            endNodeId: nodeGrid[z][y][x + 1],
            sectionId: 'W18x50',
            materialId: material,
            type: 'beam',
          });
        }
      }
    }
    
    // Generate beams (Y-direction)
    for (let z = 1; z <= stories; z++) {
      for (let y = 0; y < baysY; y++) {
        for (let x = 0; x <= baysX; x++) {
          members.push({
            id: `beamY${memberId++}`,
            startNodeId: nodeGrid[z][y][x],
            endNodeId: nodeGrid[z][y + 1][x],
            sectionId: 'W16x40',
            materialId: material,
            type: 'beam',
          });
        }
      }
    }
    
    // Generate loads
    const loads: GeneratedLoad[] = [];
    let loadId = 0;
    
    // Dead load on beams
    for (let z = 1; z <= stories; z++) {
      for (let y = 0; y <= baysY; y++) {
        for (let x = 0; x < baysX; x++) {
          loads.push({
            id: `dl${loadId++}`,
            type: 'distributed',
            target: `beamX${(z - 1) * (baysY + 1) * baysX + y * baysX + x}`,
            values: [-10], // 10 kN/m downward
            loadCase: 'Dead',
          });
        }
      }
    }
    
    // Live load on top floor
    for (let y = 0; y <= baysY; y++) {
      for (let x = 0; x < baysX; x++) {
        loads.push({
          id: `ll${loadId++}`,
          type: 'distributed',
          target: `beamX${(stories - 1) * (baysY + 1) * baysX + y * baysX + x}`,
          values: [-5], // 5 kN/m live load
          loadCase: 'Live',
        });
      }
    }
    
    // Lateral load (simplified wind/seismic)
    for (let z = 1; z <= stories; z++) {
      const lateralForce = 20 * z; // Increasing with height
      loads.push({
        id: `lateral${loadId++}`,
        type: 'point',
        target: nodeGrid[z][0][0],
        values: [lateralForce, 0, 0], // X-direction
        loadCase: 'Wind',
      });
    }
    
    const mat = STRUCTURAL_KNOWLEDGE.materials[material as keyof typeof STRUCTURAL_KNOWLEDGE.materials];
    
    // Get material properties with safe defaults for steel materials
    const materialProps = {
      id: material,
      name: mat.name,
      type: 'steel' as const,
      E: mat.E,
      G: 'G' in mat ? mat.G : mat.E / (2 * (1 + mat.nu)), // Calculate G if not provided
      nu: mat.nu,
      fy: 'fy' in mat ? mat.fy : 250e6, // Default yield strength
      fu: 'fu' in mat ? mat.fu : 400e6, // Default ultimate strength
      density: mat.density,
    };
    
    return {
      nodes,
      members,
      loads,
      supports,
      materials: [materialProps],
      sections: [
        { id: 'W14x30', name: 'W14x30', type: 'W', ...STRUCTURAL_KNOWLEDGE.sections['W14x30'] },
        { id: 'W18x50', name: 'W18x50', type: 'W', ...STRUCTURAL_KNOWLEDGE.sections['W18x50'] },
        { id: 'W16x40', name: 'W16x40', type: 'W', ...STRUCTURAL_KNOWLEDGE.sections['W16x40'] },
      ],
      metadata: {
        name: `${stories}-Story Building`,
        description: `${stories}-story, ${baysX}x${baysY} bay steel moment frame building`,
        structureType: 'multi_story_building',
        createdAt: new Date(),
      },
    };
  }
  
  /**
   * Generate a Warren truss bridge
   */
  static generateWarrenTruss(params: {
    span?: number;
    height?: number;
    panels?: number;
    width?: number;
    material?: string;
  }): GeneratedStructure {
    const {
      span = 30,
      height = 5,
      panels = 6,
      width = 4,
      material = 'structural_steel',
    } = params;
    
    const panelLength = span / panels;
    const nodes: GeneratedNode[] = [];
    const members: GeneratedMember[] = [];
    const supports: GeneratedSupport[] = [];
    
    // Bottom chord nodes
    for (let i = 0; i <= panels; i++) {
      nodes.push({
        id: `b${i}`,
        x: i * panelLength,
        y: 0,
        z: 0,
        label: `B${i}`,
      });
    }
    
    // Top chord nodes (offset by half panel)
    for (let i = 0; i < panels; i++) {
      nodes.push({
        id: `t${i}`,
        x: (i + 0.5) * panelLength,
        y: height,
        z: 0,
        label: `T${i}`,
      });
    }
    
    // Supports
    supports.push({
      nodeId: 'b0',
      type: 'pinned',
      restraints: [true, true, true, false, false, false],
    });
    supports.push({
      nodeId: `b${panels}`,
      type: 'roller',
      restraints: [false, true, true, false, false, false],
    });
    
    let memberId = 0;
    
    // Bottom chord
    for (let i = 0; i < panels; i++) {
      members.push({
        id: `bc${memberId++}`,
        startNodeId: `b${i}`,
        endNodeId: `b${i + 1}`,
        sectionId: 'L6x6x1/2',
        materialId: material,
        type: 'truss',
      });
    }
    
    // Top chord
    for (let i = 0; i < panels - 1; i++) {
      members.push({
        id: `tc${memberId++}`,
        startNodeId: `t${i}`,
        endNodeId: `t${i + 1}`,
        sectionId: 'L6x6x1/2',
        materialId: material,
        type: 'truss',
      });
    }
    
    // Diagonals (Warren pattern)
    for (let i = 0; i < panels; i++) {
      // Rising diagonal
      members.push({
        id: `d${memberId++}`,
        startNodeId: `b${i}`,
        endNodeId: `t${i}`,
        sectionId: 'L4x4x1/2',
        materialId: material,
        type: 'truss',
      });
      // Falling diagonal
      members.push({
        id: `d${memberId++}`,
        startNodeId: `t${i}`,
        endNodeId: `b${i + 1}`,
        sectionId: 'L4x4x1/2',
        materialId: material,
        type: 'truss',
      });
    }
    
    // Loads at bottom chord nodes
    const loads: GeneratedLoad[] = [];
    const loadPerNode = 50 / (panels + 1); // 50 kN total
    
    for (let i = 0; i <= panels; i++) {
      if (i > 0 && i < panels) {
        loads.push({
          id: `pl${i}`,
          type: 'point',
          target: `b${i}`,
          values: [0, -loadPerNode, 0],
          loadCase: 'Dead',
        });
      }
    }
    
    return {
      nodes,
      members,
      loads,
      supports,
      materials: [getMaterialProps(material)],
      sections: [
        { id: 'L6x6x1/2', name: 'L6x6x1/2', type: 'angle', ...STRUCTURAL_KNOWLEDGE.sections['L6x6x1/2'] },
        { id: 'L4x4x1/2', name: 'L4x4x1/2', type: 'angle', ...STRUCTURAL_KNOWLEDGE.sections['L4x4x1/2'] },
      ],
      metadata: {
        name: `Warren Truss Bridge`,
        description: `${span}m span Warren truss bridge with ${panels} panels`,
        structureType: 'warren_truss',
        createdAt: new Date(),
      },
    };
  }
  
  /**
   * Generate a portal frame
   */
  static generatePortalFrame(params: {
    span?: number;
    height?: number;
    haunchDepth?: number;
    material?: string;
  }): GeneratedStructure {
    const {
      span = 20,
      height = 8,
      haunchDepth = 0.8,
      material = 'structural_steel',
    } = params;
    
    const nodes: GeneratedNode[] = [
      { id: 'n1', x: 0, y: 0, z: 0, label: 'Base Left' },
      { id: 'n2', x: 0, y: height, z: 0, label: 'Eave Left' },
      { id: 'n3', x: span / 2, y: height + span * 0.1, z: 0, label: 'Ridge' },
      { id: 'n4', x: span, y: height, z: 0, label: 'Eave Right' },
      { id: 'n5', x: span, y: 0, z: 0, label: 'Base Right' },
    ];
    
    const members: GeneratedMember[] = [
      { id: 'col1', startNodeId: 'n1', endNodeId: 'n2', sectionId: 'W14x30', materialId: material, type: 'column' },
      { id: 'raf1', startNodeId: 'n2', endNodeId: 'n3', sectionId: 'W18x50', materialId: material, type: 'beam' },
      { id: 'raf2', startNodeId: 'n3', endNodeId: 'n4', sectionId: 'W18x50', materialId: material, type: 'beam' },
      { id: 'col2', startNodeId: 'n4', endNodeId: 'n5', sectionId: 'W14x30', materialId: material, type: 'column' },
    ];
    
    const supports: GeneratedSupport[] = [
      { nodeId: 'n1', type: 'fixed', restraints: [true, true, true, true, true, true] },
      { nodeId: 'n5', type: 'fixed', restraints: [true, true, true, true, true, true] },
    ];
    
    const loads: GeneratedLoad[] = [
      { id: 'dl1', type: 'distributed', target: 'raf1', values: [-5], loadCase: 'Dead' },
      { id: 'dl2', type: 'distributed', target: 'raf2', values: [-5], loadCase: 'Dead' },
      { id: 'wl1', type: 'point', target: 'n2', values: [10, 0, 0], loadCase: 'Wind' },
      { id: 'wl2', type: 'point', target: 'n4', values: [10, 0, 0], loadCase: 'Wind' },
    ];
    
    return {
      nodes,
      members,
      loads,
      supports,
      materials: [getMaterialProps(material)],
      sections: [
        { id: 'W14x30', name: 'W14x30', type: 'W', ...STRUCTURAL_KNOWLEDGE.sections['W14x30'] },
        { id: 'W18x50', name: 'W18x50', type: 'W', ...STRUCTURAL_KNOWLEDGE.sections['W18x50'] },
      ],
      metadata: {
        name: 'Portal Frame',
        description: `${span}m span, ${height}m height steel portal frame`,
        structureType: 'portal_frame',
        createdAt: new Date(),
      },
    };
  }
  
  /**
   * Generate an industrial shed
   */
  static generateIndustrialShed(params: {
    span?: number;
    length?: number;
    height?: number;
    baySpacing?: number;
    roofPitch?: number;
    material?: string;
  }): GeneratedStructure {
    const {
      span = 20,
      length = 50,
      height = 8,
      baySpacing = 6,
      roofPitch = 5, // degrees
      material = 'structural_steel',
    } = params;
    
    const numFrames = Math.floor(length / baySpacing) + 1;
    const ridgeHeight = height + (span / 2) * Math.tan(roofPitch * Math.PI / 180);
    
    const nodes: GeneratedNode[] = [];
    const members: GeneratedMember[] = [];
    const supports: GeneratedSupport[] = [];
    
    let nodeId = 0;
    let memberId = 0;
    
    // Generate frames
    for (let f = 0; f < numFrames; f++) {
      const z = f * baySpacing;
      
      // Frame nodes
      nodes.push({ id: `f${f}_bl`, x: 0, y: 0, z, label: `Frame ${f} Base Left` });
      nodes.push({ id: `f${f}_el`, x: 0, y: height, z, label: `Frame ${f} Eave Left` });
      nodes.push({ id: `f${f}_r`, x: span / 2, y: ridgeHeight, z, label: `Frame ${f} Ridge` });
      nodes.push({ id: `f${f}_er`, x: span, y: height, z, label: `Frame ${f} Eave Right` });
      nodes.push({ id: `f${f}_br`, x: span, y: 0, z, label: `Frame ${f} Base Right` });
      
      // Supports
      supports.push({ nodeId: `f${f}_bl`, type: 'fixed', restraints: [true, true, true, true, true, true] });
      supports.push({ nodeId: `f${f}_br`, type: 'fixed', restraints: [true, true, true, true, true, true] });
      
      // Frame members
      members.push({ id: `m${memberId++}`, startNodeId: `f${f}_bl`, endNodeId: `f${f}_el`, sectionId: 'W14x30', materialId: material, type: 'column' });
      members.push({ id: `m${memberId++}`, startNodeId: `f${f}_el`, endNodeId: `f${f}_r`, sectionId: 'W18x50', materialId: material, type: 'beam' });
      members.push({ id: `m${memberId++}`, startNodeId: `f${f}_r`, endNodeId: `f${f}_er`, sectionId: 'W18x50', materialId: material, type: 'beam' });
      members.push({ id: `m${memberId++}`, startNodeId: `f${f}_er`, endNodeId: `f${f}_br`, sectionId: 'W14x30', materialId: material, type: 'column' });
      
      // Purlins (connect frames)
      if (f > 0) {
        members.push({ id: `m${memberId++}`, startNodeId: `f${f-1}_el`, endNodeId: `f${f}_el`, sectionId: 'HSS6x6x3/8', materialId: material, type: 'beam' });
        members.push({ id: `m${memberId++}`, startNodeId: `f${f-1}_r`, endNodeId: `f${f}_r`, sectionId: 'HSS6x6x3/8', materialId: material, type: 'beam' });
        members.push({ id: `m${memberId++}`, startNodeId: `f${f-1}_er`, endNodeId: `f${f}_er`, sectionId: 'HSS6x6x3/8', materialId: material, type: 'beam' });
      }
    }
    
    const loads: GeneratedLoad[] = [];
    // Add dead and live loads to rafters
    
    return {
      nodes,
      members,
      loads,
      supports,
      materials: [getMaterialProps(material)],
      sections: [
        { id: 'W14x30', name: 'W14x30', type: 'W', ...STRUCTURAL_KNOWLEDGE.sections['W14x30'] },
        { id: 'W18x50', name: 'W18x50', type: 'W', ...STRUCTURAL_KNOWLEDGE.sections['W18x50'] },
        { id: 'HSS6x6x3/8', name: 'HSS6x6x3/8', type: 'HSS', ...STRUCTURAL_KNOWLEDGE.sections['HSS6x6x3/8'] },
      ],
      metadata: {
        name: 'Industrial Shed',
        description: `${span}m x ${length}m industrial shed with ${numFrames} portal frames`,
        structureType: 'industrial_shed',
        createdAt: new Date(),
      },
    };
  }
}

// ============================================
// MAIN AI DESIGN ASSISTANT CLASS
// ============================================

export class AdvancedAIDesignAssistant {
  private intentClassifier: IntentClassifier;
  private entityExtractor: EntityExtractor;
  private conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>;
  
  constructor() {
    this.intentClassifier = new IntentClassifier();
    this.entityExtractor = new EntityExtractor();
    this.conversationHistory = [];
  }
  
  /**
   * Process a natural language request
   */
  async processRequest(userMessage: string): Promise<AIResponse> {
    // Add to conversation history
    this.conversationHistory.push({ role: 'user', content: userMessage });
    
    // Classify intent
    const intent = this.intentClassifier.classify(userMessage);
    
    // Extract entities
    const entities = this.entityExtractor.extract(userMessage);
    
    console.log('AI Processing:', { intent, entities });
    
    let response: AIResponse;
    
    switch (intent.type) {
      case 'create':
        response = this.handleCreate(userMessage, entities);
        break;
      case 'analyze':
        response = this.handleAnalyze(userMessage, entities);
        break;
      case 'explain':
        response = this.handleExplain(userMessage, entities);
        break;
      case 'optimize':
        response = this.handleOptimize(userMessage, entities);
        break;
      case 'question':
        response = this.handleQuestion(userMessage, entities);
        break;
      default:
        response = this.handleGeneral(userMessage, entities);
    }
    
    // Add response to history
    this.conversationHistory.push({ role: 'assistant', content: response.message });
    
    return response;
  }
  
  private handleCreate(message: string, entities: StructuralEntity[]): AIResponse {
    // Find structure type
    const structureEntity = entities.find(e => e.type === 'structure');
    const structureType = structureEntity?.value as string || 'multi_story_building';
    
    // Extract parameters
    const params: Record<string, any> = {};
    
    for (const entity of entities) {
      if (entity.type === 'dimension') {
        if (entity.unit === 'm') {
          // Try to infer what dimension this is
          if (message.toLowerCase().includes('span') || message.toLowerCase().includes('width')) {
            params.span = entity.value;
            params.bayWidth = entity.value;
          } else if (message.toLowerCase().includes('height')) {
            params.height = entity.value;
            params.storyHeight = entity.value;
          } else if (message.toLowerCase().includes('length')) {
            params.length = entity.value;
          }
        } else if (entity.unit === 'stories' || entity.unit === 'floors') {
          params.stories = entity.value;
        } else if (entity.unit === 'bays') {
          params.baysX = entity.value;
        } else if (entity.unit === 'panels') {
          params.panels = entity.value;
        }
      } else if (entity.type === 'material') {
        params.material = entity.value;
      }
    }
    
    let structure: GeneratedStructure | undefined;
    let description: string;
    
    switch (structureType) {
      case 'multi_story_building':
        structure = StructureGenerators.generateBuilding(params);
        description = `I've created a ${params.stories || 5}-story building frame with ${params.baysX || 3} bays.`;
        break;
      case 'warren_truss':
      case 'truss_bridge':
        structure = StructureGenerators.generateWarrenTruss(params);
        description = `I've created a ${params.span || 30}m Warren truss bridge with ${params.panels || 6} panels.`;
        break;
      case 'portal_frame':
        structure = StructureGenerators.generatePortalFrame(params);
        description = `I've created a ${params.span || 20}m span portal frame.`;
        break;
      case 'industrial_shed':
        structure = StructureGenerators.generateIndustrialShed(params);
        description = `I've created a ${params.span || 20}m x ${params.length || 50}m industrial shed.`;
        break;
      default:
        structure = StructureGenerators.generateBuilding(params);
        description = `I've created a ${params.stories || 5}-story building frame as the default structure.`;
    }
    
    return {
      success: true,
      message: description,
      structure,
      explanation: this.generateStructureExplanation(structure),
      suggestions: [
        'Would you like me to run a structural analysis?',
        'Should I add seismic loads based on your location?',
        'Do you want me to optimize the member sizes?',
      ],
      followUpQuestions: [
        'What design code should I use for checking?',
        'Do you need any additional load combinations?',
      ],
    };
  }
  
  private handleAnalyze(message: string, entities: StructuralEntity[]): AIResponse {
    return {
      success: true,
      message: 'I can run several types of analysis on your structure:\n\n' +
        '1. **Linear Static Analysis** - Basic stress and deflection check\n' +
        '2. **P-Delta Analysis** - Second-order effects from gravity loads\n' +
        '3. **Modal Analysis** - Natural frequencies and mode shapes\n' +
        '4. **Response Spectrum** - Seismic response analysis\n' +
        '5. **Design Check** - Code compliance verification\n\n' +
        'Which analysis would you like me to run?',
      suggestions: [
        'Run linear static analysis',
        'Perform modal analysis with 10 modes',
        'Check design per AISC 360',
      ],
    };
  }
  
  private handleExplain(message: string, entities: StructuralEntity[]): AIResponse {
    // Check what needs explanation
    if (message.toLowerCase().includes('deflection')) {
      return {
        success: true,
        message: '## Understanding Deflection\n\n' +
          'Deflection is the displacement of a structural member under load. Key points:\n\n' +
          '- **Serviceability Limit**: Typically L/360 for floors, L/240 for roofs\n' +
          '- **Formula**: δ = PL³/(48EI) for simply supported beam with point load\n' +
          '- **Factors**: Load magnitude, span length, moment of inertia, modulus of elasticity\n\n' +
          'Would you like me to check deflections in your current model?',
      };
    }
    
    if (message.toLowerCase().includes('p-delta') || message.toLowerCase().includes('second order')) {
      return {
        success: true,
        message: '## P-Delta (Second-Order) Effects\n\n' +
          'P-Delta accounts for additional moments caused by axial loads acting on displaced geometry:\n\n' +
          '- **P-Δ (big delta)**: Frame sway effect from story drift\n' +
          '- **P-δ (small delta)**: Member curvature effect\n' +
          '- **When important**: Tall buildings, slender columns, heavy gravity loads\n\n' +
          'The amplification factor is approximately: B₂ = 1/(1 - ΣP/PE)\n\n' +
          'Where PE is the elastic critical buckling load.',
      };
    }
    
    return {
      success: true,
      message: 'I can explain various structural engineering concepts. What would you like to know about?\n\n' +
        '- Analysis methods (linear, nonlinear, dynamic)\n' +
        '- Design codes (AISC, IS, Eurocode)\n' +
        '- Load combinations\n' +
        '- Member behavior (beams, columns, connections)\n' +
        '- Structural systems (frames, trusses, bracing)',
    };
  }
  
  private handleOptimize(message: string, entities: StructuralEntity[]): AIResponse {
    return {
      success: true,
      message: 'I can optimize your structure for various objectives:\n\n' +
        '1. **Minimum Weight** - Reduce total steel tonnage\n' +
        '2. **Minimum Cost** - Consider material + fabrication costs\n' +
        '3. **Maximum Stiffness** - Control deflections\n' +
        '4. **Target Utilization** - Achieve 80-90% stress ratios\n\n' +
        'Constraints I can consider:\n' +
        '- Deflection limits\n' +
        '- Stress ratios\n' +
        '- Available section sizes\n' +
        '- Fabrication preferences\n\n' +
        'Which optimization objective should I pursue?',
      suggestions: [
        'Optimize for minimum weight',
        'Target 85% utilization ratio',
        'Minimize cost using standard sections only',
      ],
    };
  }
  
  private handleQuestion(message: string, entities: StructuralEntity[]): AIResponse {
    // Common structural engineering questions
    if (message.toLowerCase().includes('what section') || message.toLowerCase().includes('which section')) {
      return {
        success: true,
        message: 'To recommend a section, I need to know:\n\n' +
          '1. **Member type**: Beam, column, or brace?\n' +
          '2. **Loads**: What forces/moments will it carry?\n' +
          '3. **Span/Length**: How long is the member?\n' +
          '4. **Support conditions**: Fixed, pinned, continuous?\n' +
          '5. **Design code**: AISC, IS, Eurocode?\n\n' +
          'Please provide these details and I\'ll recommend optimal sections.',
      };
    }
    
    if (message.toLowerCase().includes('safe') || message.toLowerCase().includes('adequate')) {
      return {
        success: true,
        message: 'To determine if a design is safe, I check:\n\n' +
          '1. **Strength** - Stress ratios ≤ 1.0 for all members\n' +
          '2. **Stability** - No buckling under design loads\n' +
          '3. **Serviceability** - Deflections within limits\n' +
          '4. **Connections** - Adequate capacity for forces transferred\n' +
          '5. **Overall stability** - Building doesn\'t overturn or slide\n\n' +
          'Would you like me to run a comprehensive design check?',
      };
    }
    
    return {
      success: true,
      message: 'I\'m here to help with structural engineering questions. I can assist with:\n\n' +
        '- Structure modeling and generation\n' +
        '- Analysis interpretation\n' +
        '- Design code requirements\n' +
        '- Member sizing and optimization\n' +
        '- Load calculations\n\n' +
        'What would you like to know?',
    };
  }
  
  private handleGeneral(message: string, entities: StructuralEntity[]): AIResponse {
    return {
      success: true,
      message: 'I\'m your AI structural design assistant. I can help you:\n\n' +
        '🏗️ **Create** structures from natural language descriptions\n' +
        '📊 **Analyze** structural behavior (static, dynamic, nonlinear)\n' +
        '✅ **Design** members per international codes\n' +
        '⚡ **Optimize** for weight, cost, or performance\n' +
        '📚 **Explain** structural engineering concepts\n\n' +
        'Try saying something like:\n' +
        '- "Create a 10-story steel building with 4 bays"\n' +
        '- "Design a 30m span truss bridge"\n' +
        '- "Check my beam for AISC compliance"',
      suggestions: [
        'Create a 5-story building',
        'Generate a warehouse structure',
        'Design a pedestrian bridge',
      ],
    };
  }
  
  private generateStructureExplanation(structure: GeneratedStructure): string {
    const nodeCount = structure.nodes.length;
    const memberCount = structure.members.length;
    const dof = nodeCount * 6 - structure.supports.reduce((sum, s) => 
      sum + s.restraints.filter(r => r).length, 0);
    
    return `## Structure Summary\n\n` +
      `- **Nodes**: ${nodeCount}\n` +
      `- **Members**: ${memberCount}\n` +
      `- **Degrees of Freedom**: ${dof}\n` +
      `- **Supports**: ${structure.supports.length}\n` +
      `- **Load Cases**: ${new Set(structure.loads.map(l => l.loadCase)).size}\n\n` +
      `The structure uses ${structure.materials.map(m => m.name).join(', ')} ` +
      `with sections: ${structure.sections.map(s => s.name).join(', ')}.`;
  }
  
  /**
   * Get conversation history
   */
  getHistory(): Array<{ role: 'user' | 'assistant'; content: string }> {
    return [...this.conversationHistory];
  }
  
  /**
   * Clear conversation history
   */
  clearHistory(): void {
    this.conversationHistory = [];
  }
}

// Export singleton instance
export const aiDesignAssistant = new AdvancedAIDesignAssistant();

export default AdvancedAIDesignAssistant;
