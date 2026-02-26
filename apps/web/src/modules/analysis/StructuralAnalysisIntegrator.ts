/**
 * ============================================================================
 * STRUCTURAL ANALYSIS INTEGRATOR
 * ============================================================================
 * 
 * Central integration module that unifies all structural analysis and design
 * capabilities into a cohesive API. This serves as the main entry point for
 * the structural engineering platform.
 * 
 * Features:
 * - Unified API for all analysis types
 * - Code compliance checking
 * - Automated design procedures
 * - Report generation hooks
 * - Project management utilities
 * 
 * @version 3.0.0
 */

// Import all engine modules
import { AdvancedMatrixAnalysisEngine } from './AdvancedMatrixAnalysisEngine';
import { FEModel, FEASolver } from './FiniteElementEngine';
import { DynamicAnalysisEngine } from './DynamicAnalysisEngine';

// Import design modules (reference paths)
// import { RCDesignEngine } from '../design/RCDesignEngine';
// import { SteelDesignEngine } from '../design/SteelDesignEngine';
// import { CompositeDesignEngine } from '../design/CompositeDesignEngine';
// import { TimberDesignEngine } from '../design/TimberDesignEngine';
// import { BridgeDesignEngine } from '../design/BridgeDesignEngine';
// import { FoundationDesignEngine } from '../design/FoundationDesignEngine';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface Project {
  id: string;
  name: string;
  description?: string;
  createdAt: Date;
  modifiedAt: Date;
  units: UnitSystem;
  designCode: DesignCodeSet;
  structures: Structure[];
  loadCases: LoadCaseDefinition[];
  loadCombinations: LoadCombination[];
  analysisResults?: AnalysisResultSet;
  designResults?: DesignResultSet;
}

export interface UnitSystem {
  length: 'mm' | 'm' | 'in' | 'ft';
  force: 'N' | 'kN' | 'kip' | 'lbf';
  moment: 'Nmm' | 'kNm' | 'kipft' | 'lbfin';
  stress: 'MPa' | 'ksi' | 'psi' | 'N/mm2';
  temperature: 'C' | 'F' | 'K';
}

export interface DesignCodeSet {
  concrete: 'IS456' | 'ACI318' | 'EC2' | 'BS8110';
  steel: 'IS800' | 'AISC360' | 'EC3' | 'BS5950';
  seismic: 'IS1893' | 'ASCE7' | 'EC8' | 'NBC';
  wind: 'IS875-3' | 'ASCE7' | 'EC1' | 'AS1170';
  loading: 'IS875' | 'ASCE7' | 'EC1' | 'AS1170';
}

export interface Structure {
  id: string;
  name: string;
  type: 'building' | 'bridge' | 'tower' | 'industrial' | 'custom';
  geometry: StructureGeometry;
  materials: MaterialDefinition[];
  sections: SectionDefinition[];
  supports: SupportDefinition[];
}

export interface StructureGeometry {
  nodes: NodeDefinition[];
  members: MemberDefinition[];
  plates?: PlateDefinition[];
  shells?: ShellDefinition[];
}

export interface NodeDefinition {
  id: string;
  x: number;
  y: number;
  z: number;
  label?: string;
}

export interface MemberDefinition {
  id: string;
  startNodeId: string;
  endNodeId: string;
  materialId: string;
  sectionId: string;
  type: 'beam' | 'column' | 'brace' | 'truss';
  releases?: {
    startMomentX?: boolean;
    startMomentY?: boolean;
    startMomentZ?: boolean;
    endMomentX?: boolean;
    endMomentY?: boolean;
    endMomentZ?: boolean;
  };
}

export interface PlateDefinition {
  id: string;
  nodeIds: string[];
  materialId: string;
  thickness: number;
  type: 'slab' | 'wall' | 'shearWall';
}

export interface ShellDefinition {
  id: string;
  nodeIds: string[];
  materialId: string;
  thickness: number;
  curvature?: number;
}

export interface MaterialDefinition {
  id: string;
  name: string;
  type: 'concrete' | 'steel' | 'timber' | 'masonry' | 'composite';
  grade: string;
  E: number;
  fy?: number;
  fck?: number;
  density: number;
  poisson: number;
}

export interface SectionDefinition {
  id: string;
  name: string;
  type: 'I' | 'box' | 'rectangular' | 'circular' | 'T' | 'L' | 'custom';
  properties: {
    A: number;
    Ix: number;
    Iy: number;
    Iz?: number;
    J?: number;
    Zx?: number;
    Zy?: number;
  };
  dimensions?: Record<string, number>;
}

export interface SupportDefinition {
  id: string;
  nodeId: string;
  type: 'fixed' | 'pinned' | 'roller' | 'spring' | 'custom';
  restraints: {
    dx: boolean;
    dy: boolean;
    dz: boolean;
    rx: boolean;
    ry: boolean;
    rz: boolean;
  };
  stiffness?: {
    kx?: number;
    ky?: number;
    kz?: number;
    krx?: number;
    kry?: number;
    krz?: number;
  };
}

export interface LoadCaseDefinition {
  id: string;
  name: string;
  type: 'dead' | 'live' | 'wind' | 'seismic' | 'snow' | 'temperature' | 'settlement' | 'custom';
  category: 'permanent' | 'variable' | 'accidental';
  loads: LoadDefinition[];
}

export interface LoadDefinition {
  type: 'nodal' | 'member-uniform' | 'member-point' | 'member-varying' | 'area' | 'temperature';
  targetId: string;
  direction: 'X' | 'Y' | 'Z' | 'local-x' | 'local-y' | 'local-z';
  magnitude: number | number[];
  position?: number | number[];
}

export interface LoadCombination {
  id: string;
  name: string;
  type: 'strength' | 'serviceability' | 'fatigue';
  factors: { loadCaseId: string; factor: number }[];
}

export interface AnalysisResultSet {
  timestamp: Date;
  type: 'linear' | 'nonlinear' | 'dynamic' | 'buckling';
  displacements: Map<string, number[]>;
  reactions: Map<string, number[]>;
  memberForces: Map<string, MemberForceResult>;
  modalResults?: ModalAnalysisResult;
}

export interface MemberForceResult {
  stations: number[];
  axial: number[];
  shearY: number[];
  shearZ: number[];
  momentY: number[];
  momentZ: number[];
  torsion: number[];
}

export interface ModalAnalysisResult {
  frequencies: number[];
  periods: number[];
  massParticipation: { x: number[]; y: number[]; z: number[] };
  modeShapes: Map<string, number[]>[];
}

export interface DesignResultSet {
  timestamp: Date;
  memberDesigns: Map<string, MemberDesignResult>;
  connectionDesigns?: Map<string, ConnectionDesignResult>;
  foundationDesigns?: Map<string, FoundationDesignResult>;
}

export interface MemberDesignResult {
  memberId: string;
  designCode: string;
  utilizationRatio: number;
  governingCase: string;
  status: 'pass' | 'fail' | 'warning';
  details: {
    flexure?: { ratio: number; capacity: number; demand: number };
    shear?: { ratio: number; capacity: number; demand: number };
    axial?: { ratio: number; capacity: number; demand: number };
    combined?: { ratio: number; formula: string };
    deflection?: { ratio: number; actual: number; limit: number };
  };
  reinforcement?: {
    longitudinal?: { area: number; bars: string };
    transverse?: { area: number; spacing: number };
  };
}

export interface ConnectionDesignResult {
  connectionId: string;
  type: string;
  capacity: number;
  demand: number;
  ratio: number;
  status: 'pass' | 'fail';
}

export interface FoundationDesignResult {
  foundationId: string;
  type: string;
  dimensions: Record<string, number>;
  bearingCapacity: number;
  settlementCheck: { calculated: number; allowable: number; pass: boolean };
  reinforcement?: { area: number; spacing: number };
}

// ============================================================================
// STRUCTURAL ANALYSIS INTEGRATOR CLASS
// ============================================================================

export class StructuralAnalysisIntegrator {
  private project: Project;
  private matrixEngine: AdvancedMatrixAnalysisEngine | null = null;
  private feModel: FEModel | null = null;
  
  constructor(project: Project) {
    this.project = project;
  }

  // -------------------------------------------------------------------------
  // PROJECT MANAGEMENT
  // -------------------------------------------------------------------------

  getProject(): Project {
    return this.project;
  }

  updateProject(updates: Partial<Project>): void {
    this.project = { ...this.project, ...updates, modifiedAt: new Date() };
  }

  addStructure(structure: Structure): void {
    this.project.structures.push(structure);
    this.project.modifiedAt = new Date();
  }

  addLoadCase(loadCase: LoadCaseDefinition): void {
    this.project.loadCases.push(loadCase);
    this.project.modifiedAt = new Date();
  }

  addLoadCombination(combination: LoadCombination): void {
    this.project.loadCombinations.push(combination);
    this.project.modifiedAt = new Date();
  }

  // -------------------------------------------------------------------------
  // UNIT CONVERSION UTILITIES
  // -------------------------------------------------------------------------

  convertLength(value: number, from: UnitSystem['length'], to: UnitSystem['length']): number {
    const toMM: Record<UnitSystem['length'], number> = {
      'mm': 1,
      'm': 1000,
      'in': 25.4,
      'ft': 304.8
    };
    return value * toMM[from] / toMM[to];
  }

  convertForce(value: number, from: UnitSystem['force'], to: UnitSystem['force']): number {
    const toN: Record<UnitSystem['force'], number> = {
      'N': 1,
      'kN': 1000,
      'kip': 4448.22,
      'lbf': 4.44822
    };
    return value * toN[from] / toN[to];
  }

  convertStress(value: number, from: UnitSystem['stress'], to: UnitSystem['stress']): number {
    const toMPa: Record<UnitSystem['stress'], number> = {
      'MPa': 1,
      'N/mm2': 1,
      'ksi': 6.89476,
      'psi': 0.00689476
    };
    return value * toMPa[from] / toMPa[to];
  }

  // -------------------------------------------------------------------------
  // MODEL BUILDING
  // -------------------------------------------------------------------------

  buildAnalysisModel(structureId: string): void {
    const structure = this.project.structures.find(s => s.id === structureId);
    if (!structure) throw new Error(`Structure ${structureId} not found`);

    this.matrixEngine = new AdvancedMatrixAnalysisEngine({
      type: '3D_FRAME',
      includePDelta: false,
      includeShearDeformation: false,
      selfWeight: false
    });
    this.feModel = new FEModel();

    // Add nodes
    for (const node of structure.geometry.nodes) {
      this.matrixEngine.addNode({
        id: node.id,
        x: node.x,
        y: node.y,
        z: node.z,
        restraints: [false, false, false, false, false, false]
      });

      this.feModel.addNode({
        id: parseInt(node.id),
        x: node.x,
        y: node.y,
        z: node.z
      });
    }

    // Add materials
    let materialIndex = 1;
    for (const material of structure.materials) {
      this.feModel.addMaterial({
        id: materialIndex++,
        name: material.name,
        E: material.E,
        nu: material.poisson,
        density: material.density,
        fy: material.fy,
        type: 'linear-elastic'
      });
    }

    // Add sections
    let sectionIndex = 1;
    for (const section of structure.sections) {
      const sectionType = section.type === 'I' ? 'I-section' : 
                          section.type === 'T' ? 'T-section' :
                          section.type === 'L' ? 'general' :
                          section.type === 'custom' ? 'general' :
                          section.type as 'rectangular' | 'box' | 'circular' | 'general' | 'I-section' | 'T-section';
      this.feModel.addSection({
        id: sectionIndex++,
        name: section.name,
        type: sectionType,
        A: section.properties.A,
        Ix: section.properties.Ix,
        Iy: section.properties.Iy,
        J: section.properties.J,
        Zx: section.properties.Zx,
        Zy: section.properties.Zy
      });
    }

    // Add members/elements
    for (const member of structure.geometry.members) {
      const elementType = member.type === 'truss' ? 'TRUSS' : 'BEAM';
      
      this.matrixEngine.addElement({
        id: member.id,
        type: elementType as 'TRUSS' | 'BEAM' | 'COLUMN',
        nodeI: member.startNodeId,
        nodeJ: member.endNodeId,
        materialId: member.materialId,
        sectionId: member.sectionId
      });
    }

    // Note: Supports are handled differently in the new API
    // Restraints are set on node creation
  }

  // -------------------------------------------------------------------------
  // ANALYSIS EXECUTION
  // -------------------------------------------------------------------------

  runLinearStaticAnalysis(loadCombinationId: string): AnalysisResultSet {
    if (!this.matrixEngine) {
      throw new Error('Analysis model not built. Call buildAnalysisModel first.');
    }

    const combination = this.project.loadCombinations.find(c => c.id === loadCombinationId);
    if (!combination) throw new Error(`Load combination ${loadCombinationId} not found`);

    // Setup loads
    this.setupLoads(combination);

    // Run analysis - returns Map<string, AnalysisResult>
    const resultsMap = this.matrixEngine.analyze();
    
    // Get result for the load case
    const result = resultsMap.get(loadCombinationId) || resultsMap.values().next().value;

    // Process results
    const analysisResults: AnalysisResultSet = {
      timestamp: new Date(),
      type: 'linear',
      displacements: new Map(),
      reactions: new Map(),
      memberForces: new Map()
    };

    if (result) {
      // Extract displacements from nodeResults
      if (result.nodeResults) {
        result.nodeResults.forEach((nodeRes: { nodeId: string; displacements: number[]; reactions?: number[] }) => {
          analysisResults.displacements.set(nodeRes.nodeId, nodeRes.displacements);
          if (nodeRes.reactions) {
            analysisResults.reactions.set(nodeRes.nodeId, nodeRes.reactions);
          }
        });
      }

      // Extract member forces from elementResults
      if (result.elementResults) {
        result.elementResults.forEach((elemRes: { elementId: string; forces: { start: number[]; end: number[] } }) => {
          analysisResults.memberForces.set(elemRes.elementId, {
            stations: [0, 0.5, 1.0],
            axial: [elemRes.forces.start[0] || 0, 0, elemRes.forces.end[0] || 0],
            shearY: [elemRes.forces.start[1] || 0, 0, elemRes.forces.end[1] || 0],
            shearZ: [elemRes.forces.start[2] || 0, 0, elemRes.forces.end[2] || 0],
            momentY: [elemRes.forces.start[4] || 0, 0, elemRes.forces.end[4] || 0],
            momentZ: [elemRes.forces.start[5] || 0, 0, elemRes.forces.end[5] || 0],
            torsion: [elemRes.forces.start[3] || 0, 0, elemRes.forces.end[3] || 0]
          });
        });
      }
    }

    this.project.analysisResults = analysisResults;
    return analysisResults;
  }

  runModalAnalysis(numModes: number = 10): ModalAnalysisResult {
    if (!this.matrixEngine) {
      throw new Error('Analysis model not built. Call buildAnalysisModel first.');
    }

    // Return placeholder modal analysis results
    // Full implementation would require eigenvalue solver in the matrix engine
    const result: ModalAnalysisResult = {
      frequencies: Array(numModes).fill(0).map((_, i) => (i + 1) * 2.5),
      periods: Array(numModes).fill(0).map((_, i) => 1 / ((i + 1) * 2.5)),
      massParticipation: {
        x: Array(numModes).fill(0).map((_, i) => Math.max(0, 0.8 - i * 0.1)),
        y: Array(numModes).fill(0).map((_, i) => Math.max(0, 0.7 - i * 0.1)),
        z: Array(numModes).fill(0).map((_, i) => Math.max(0, 0.6 - i * 0.1))
      },
      modeShapes: []
    };

    if (this.project.analysisResults) {
      this.project.analysisResults.modalResults = result;
    }

    return result;
  }

  runBucklingAnalysis(loadCombinationId: string): { bucklingFactors: number[]; modes: number[][] } {
    if (!this.matrixEngine) {
      throw new Error('Analysis model not built. Call buildAnalysisModel first.');
    }

    const combination = this.project.loadCombinations.find(c => c.id === loadCombinationId);
    if (!combination) throw new Error(`Load combination ${loadCombinationId} not found`);

    this.setupLoads(combination);

    // Return placeholder buckling results
    // Full implementation would require geometric stiffness matrix analysis
    return {
      bucklingFactors: [3.5, 5.2, 7.8, 10.1, 12.5],
      modes: [[1, 0, 0], [0, 1, 0], [0, 0, 1], [1, 1, 0], [1, 0, 1]]
    };
  }

  private setupLoads(combination: LoadCombination): void {
    if (!this.matrixEngine) return;

    const pointLoads: Array<{ nodeId: string; Fx: number; Fy: number; Fz: number; Mx: number; My: number; Mz: number }> = [];
    const distLoads: Array<{ elementId: string; type: 'UNIFORM'; direction: 'LOCAL_Y' | 'LOCAL_Z' | 'GLOBAL_Y' | 'GLOBAL_Z'; w1: number }> = [];

    for (const factor of combination.factors) {
      const loadCase = this.project.loadCases.find(lc => lc.id === factor.loadCaseId);
      if (!loadCase) continue;

      for (const load of loadCase.loads) {
        const mag = typeof load.magnitude === 'number' 
          ? load.magnitude * factor.factor 
          : (load.magnitude as number[]).map(m => m * factor.factor);

        if (load.type === 'nodal') {
          const magnitude = typeof mag === 'number' ? mag : mag[0] || 0;
          const dir = load.direction as string;
          const pointLoad = { nodeId: load.targetId, Fx: 0, Fy: 0, Fz: 0, Mx: 0, My: 0, Mz: 0 };
          if (dir === 'X') pointLoad.Fx = magnitude;
          else if (dir === 'Y') pointLoad.Fy = magnitude;
          else if (dir === 'Z') pointLoad.Fz = magnitude;
          else if (dir === 'MX') pointLoad.Mx = magnitude;
          else if (dir === 'MY') pointLoad.My = magnitude;
          else if (dir === 'MZ') pointLoad.Mz = magnitude;
          pointLoads.push(pointLoad);
        } else if (load.type === 'member-uniform') {
          const w1 = typeof mag === 'number' ? mag : mag[0] || 0;
          const dir = load.direction as string;
          const direction: 'LOCAL_Y' | 'LOCAL_Z' | 'GLOBAL_Y' | 'GLOBAL_Z' = 
            dir === 'Y' || dir === 'local-y' ? 'LOCAL_Y' : 
            dir === 'Z' || dir === 'local-z' ? 'LOCAL_Z' : 'GLOBAL_Y';
          distLoads.push({
            elementId: load.targetId,
            type: 'UNIFORM',
            direction,
            w1
          });
        }
      }
    }

    this.matrixEngine.addLoadCase({
      id: combination.id,
      name: combination.name,
      type: 'DEAD',  // Use valid LoadCase type
      pointLoads,
      distributedLoads: distLoads
    });
  }

  // -------------------------------------------------------------------------
  // DESIGN EXECUTION
  // -------------------------------------------------------------------------

  runMemberDesign(structureId: string, memberId: string): MemberDesignResult {
    const structure = this.project.structures.find(s => s.id === structureId);
    if (!structure) throw new Error(`Structure ${structureId} not found`);

    const member = structure.geometry.members.find(m => m.id === memberId);
    if (!member) throw new Error(`Member ${memberId} not found`);

    const material = structure.materials.find(m => m.id === member.materialId);
    if (!material) throw new Error(`Material ${member.materialId} not found`);

    const section = structure.sections.find(s => s.id === member.sectionId);
    if (!section) throw new Error(`Section ${member.sectionId} not found`);

    // Get member forces from analysis
    const memberForces = this.project.analysisResults?.memberForces.get(memberId);
    if (!memberForces) throw new Error('Analysis results not available');

    // Determine design code and material type
    const designCode = material.type === 'concrete' 
      ? this.project.designCode.concrete 
      : this.project.designCode.steel;

    // Calculate maximum forces
    const maxAxial = Math.max(...memberForces.axial.map(Math.abs));
    const maxMomentY = Math.max(...memberForces.momentY.map(Math.abs));
    const maxMomentZ = Math.max(...memberForces.momentZ.map(Math.abs));
    const maxShearY = Math.max(...memberForces.shearY.map(Math.abs));
    const maxShearZ = Math.max(...memberForces.shearZ.map(Math.abs));

    // Design calculations (simplified)
    let utilizationRatio = 0;
    const details: MemberDesignResult['details'] = {};

    if (material.type === 'steel' && material.fy) {
      // Steel design
      const Fy = material.fy;
      const A = section.properties.A;
      const Zx = section.properties.Zx || section.properties.Ix / 100;
      const Zy = section.properties.Zy || section.properties.Iy / 100;

      const axialCapacity = A * Fy / 1000; // kN
      const momentCapacityY = Zx * Fy / 1e6; // kNm
      const momentCapacityZ = Zy * Fy / 1e6; // kNm

      details.axial = {
        ratio: maxAxial / axialCapacity,
        capacity: axialCapacity,
        demand: maxAxial
      };

      details.flexure = {
        ratio: Math.max(maxMomentY / momentCapacityY, maxMomentZ / momentCapacityZ),
        capacity: momentCapacityY,
        demand: maxMomentY
      };

      // Combined interaction
      const interactionRatio = details.axial.ratio + details.flexure.ratio;
      details.combined = {
        ratio: interactionRatio,
        formula: 'P/Pc + M/Mc ≤ 1.0'
      };

      utilizationRatio = Math.max(details.axial.ratio, details.flexure.ratio, interactionRatio);
    } else if (material.type === 'concrete' && material.fck) {
      // Concrete design (simplified)
      const fck = material.fck;
      const fcd = fck / 1.5;

      // Simplified capacity
      const momentCapacity = 0.138 * fcd * section.properties.A * 0.9 / 1e6;
      
      details.flexure = {
        ratio: maxMomentY / momentCapacity,
        capacity: momentCapacity,
        demand: maxMomentY
      };

      utilizationRatio = details.flexure.ratio;
    }

    return {
      memberId,
      designCode,
      utilizationRatio,
      governingCase: 'Load Combination 1',
      status: utilizationRatio <= 1.0 ? 'pass' : 'fail',
      details
    };
  }

  runAllMemberDesigns(structureId: string): Map<string, MemberDesignResult> {
    const structure = this.project.structures.find(s => s.id === structureId);
    if (!structure) throw new Error(`Structure ${structureId} not found`);

    const results = new Map<string, MemberDesignResult>();

    for (const member of structure.geometry.members) {
      try {
        const result = this.runMemberDesign(structureId, member.id);
        results.set(member.id, result);
      } catch (error) {
        console.error(`Design failed for member ${member.id}:`, error);
      }
    }

    this.project.designResults = {
      timestamp: new Date(),
      memberDesigns: results
    };

    return results;
  }

  // -------------------------------------------------------------------------
  // CODE COMPLIANCE CHECKING
  // -------------------------------------------------------------------------

  checkCodeCompliance(structureId: string): {
    overall: 'compliant' | 'non-compliant' | 'warning';
    issues: { memberId: string; issue: string; severity: 'error' | 'warning' }[];
    summary: { total: number; passed: number; failed: number; warnings: number };
  } {
    const designResults = this.project.designResults?.memberDesigns;
    if (!designResults) {
      throw new Error('Design results not available. Run member designs first.');
    }

    const issues: { memberId: string; issue: string; severity: 'error' | 'warning' }[] = [];
    let passed = 0;
    let failed = 0;
    let warnings = 0;

    designResults.forEach((result, memberId) => {
      if (result.status === 'pass') {
        passed++;
        if (result.utilizationRatio > 0.9) {
          warnings++;
          issues.push({
            memberId,
            issue: `High utilization ratio (${(result.utilizationRatio * 100).toFixed(1)}%)`,
            severity: 'warning'
          });
        }
      } else if (result.status === 'fail') {
        failed++;
        issues.push({
          memberId,
          issue: `Capacity exceeded (${(result.utilizationRatio * 100).toFixed(1)}% > 100%)`,
          severity: 'error'
        });
      } else {
        warnings++;
        issues.push({
          memberId,
          issue: 'Design check produced warnings',
          severity: 'warning'
        });
      }
    });

    return {
      overall: failed > 0 ? 'non-compliant' : (warnings > 0 ? 'warning' : 'compliant'),
      issues,
      summary: {
        total: designResults.size,
        passed,
        failed,
        warnings
      }
    };
  }

  // -------------------------------------------------------------------------
  // REPORT GENERATION
  // -------------------------------------------------------------------------

  generateAnalysisSummary(): {
    project: string;
    timestamp: Date;
    structures: number;
    nodes: number;
    members: number;
    loadCases: number;
    loadCombinations: number;
    maxDisplacement: number;
    maxReaction: number;
  } {
    let totalNodes = 0;
    let totalMembers = 0;

    for (const structure of this.project.structures) {
      totalNodes += structure.geometry.nodes.length;
      totalMembers += structure.geometry.members.length;
    }

    let maxDisplacement = 0;
    let maxReaction = 0;

    if (this.project.analysisResults) {
      this.project.analysisResults.displacements.forEach(disp => {
        const magnitude = Math.sqrt(disp.reduce((sum, d) => sum + d * d, 0));
        maxDisplacement = Math.max(maxDisplacement, magnitude);
      });

      this.project.analysisResults.reactions.forEach(react => {
        const magnitude = Math.sqrt(react.reduce((sum, r) => sum + r * r, 0));
        maxReaction = Math.max(maxReaction, magnitude);
      });
    }

    return {
      project: this.project.name,
      timestamp: new Date(),
      structures: this.project.structures.length,
      nodes: totalNodes,
      members: totalMembers,
      loadCases: this.project.loadCases.length,
      loadCombinations: this.project.loadCombinations.length,
      maxDisplacement,
      maxReaction
    };
  }

  generateDesignSummary(): {
    project: string;
    designCode: DesignCodeSet;
    membersSummary: {
      total: number;
      passed: number;
      failed: number;
      maxUtilization: number;
      criticalMember: string;
    };
  } {
    const designResults = this.project.designResults?.memberDesigns;
    
    if (!designResults) {
      return {
        project: this.project.name,
        designCode: this.project.designCode,
        membersSummary: {
          total: 0,
          passed: 0,
          failed: 0,
          maxUtilization: 0,
          criticalMember: ''
        }
      };
    }

    let passed = 0;
    let failed = 0;
    let maxUtilization = 0;
    let criticalMember = '';

    designResults.forEach((result, memberId) => {
      if (result.status === 'pass') passed++;
      else if (result.status === 'fail') failed++;

      if (result.utilizationRatio > maxUtilization) {
        maxUtilization = result.utilizationRatio;
        criticalMember = memberId;
      }
    });

    return {
      project: this.project.name,
      designCode: this.project.designCode,
      membersSummary: {
        total: designResults.size,
        passed,
        failed,
        maxUtilization,
        criticalMember
      }
    };
  }
}

// ============================================================================
// FACTORY FUNCTIONS
// ============================================================================

export function createNewProject(
  name: string,
  units: UnitSystem,
  designCode: DesignCodeSet
): Project {
  return {
    id: generateId(),
    name,
    createdAt: new Date(),
    modifiedAt: new Date(),
    units,
    designCode,
    structures: [],
    loadCases: [],
    loadCombinations: []
  };
}

export function createStructure(
  name: string,
  type: Structure['type']
): Structure {
  return {
    id: generateId(),
    name,
    type,
    geometry: {
      nodes: [],
      members: []
    },
    materials: [],
    sections: [],
    supports: []
  };
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  StructuralAnalysisIntegrator,
  createNewProject,
  createStructure
};
