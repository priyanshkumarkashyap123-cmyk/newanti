/**
 * EnhancedAIArchitect.ts
 * 
 * The Ultimate AI Architect for Civil Engineering
 * 
 * Integrates:
 * - Comprehensive Civil Engineering Knowledge Base
 * - Advanced NLP Interpretation
 * - Intelligent Response Generation
 * - Context-Aware Conversations
 * - Structure Generation
 * - Analysis Assistance
 * - Design Verification
 * 
 * This is the main entry point for all AI interactions in BeamLab.
 */

import { 
  AdvancedNLPInterpreter, 
  InterpretationResult,
  ParsedIntent,
  ExtractedEntity,
  ConversationalContext,
  nlpInterpreter 
} from './AdvancedNLPInterpreter';

import { 
  IntelligentResponseGenerator, 
  GeneratedResponse,
  responseGenerator 
} from './IntelligentResponseGenerator';

import { 
  CIVIL_ENGINEERING_KNOWLEDGE,
  STRUCTURAL_ENGINEERING 
} from './CivilEngineeringKnowledgeBase';

// ============================================
// TYPE DEFINITIONS
// ============================================

export interface AIArchitectConfig {
  enableVerboseMode?: boolean;
  preferredUnits?: 'SI' | 'Imperial';
  preferredCode?: string;
  experienceLevel?: 'student' | 'professional' | 'expert';
  autoSuggestEnabled?: boolean;
  geminiApiKey?: string;
}

export interface AIRequest {
  message: string;
  modelContext?: ModelContext;
  attachments?: Attachment[];
  sessionId?: string;
}

export interface AIResponse {
  message: string;
  type: ResponseType;
  confidence: number;
  interpretation?: InterpretationResult;
  structureData?: StructureData;
  calculations?: CalculationResult[];
  recommendations?: string[];
  codeReferences?: string[];
  followUpSuggestions?: string[];
  warnings?: string[];
  timestamp: Date;
}

export type ResponseType = 
  | 'chat' | 'structure' | 'analysis' | 'design' | 'calculation' 
  | 'explanation' | 'recommendation' | 'error' | 'clarification';

export interface ModelContext {
  nodes: NodeData[];
  members: MemberData[];
  loads: LoadData[];
  supports: SupportData[];
  analysisResults?: AnalysisResults;
}

export interface NodeData {
  id: string;
  x: number;
  y: number;
  z: number;
  hasSupport: boolean;
}

export interface MemberData {
  id: string;
  startNodeId: string;
  endNodeId: string;
  section?: string;
  material?: string;
}

export interface LoadData {
  id: string;
  type: string;
  targetId: string;
  values: number[];
  loadCase?: string;
}

export interface SupportData {
  nodeId: string;
  type: string;
  restraints: boolean[];
}

export interface AnalysisResults {
  maxDisplacement: number;
  maxStress: number;
  maxMoment: number;
  reactions: Record<string, number[]>;
}

export interface StructureNode {
  id: string;
  x: number;
  y: number;
  z: number;
  label?: string;
}

export interface StructureMemberData {
  id: string;
  startNodeId: string;
  endNodeId: string;
  type: string;
  section: string;
  material?: string;
}

export interface StructureLoadData {
  id: string;
  type: string;
  nodeId?: string;
  memberId?: string;
  values: number[];
  loadCase: string;
}

export interface StructureSupport {
  nodeId: string;
  type: string;
  restraints: boolean[];
}

export interface StructureMaterial {
  id: string;
  name: string;
  E: number;
  fy: number;
  density: number;
}

export interface StructureSection {
  id: string;
  name: string;
  A: number;
  Ix?: number;
  type: string;
}

export interface StructureData {
  type: string;
  nodes: StructureNode[];
  members: StructureMemberData[];
  loads: StructureLoadData[];
  supports: StructureSupport[];
  materials: StructureMaterial[];
  sections: StructureSection[];
  metadata: Record<string, unknown>;
}

export interface CalculationResult {
  name: string;
  formula: string;
  inputs: Record<string, number>;
  result: number;
  unit: string;
  status: 'pass' | 'fail' | 'info';
}

export interface Attachment {
  type: 'image' | 'file' | 'code';
  content: string | ArrayBuffer;
  name?: string;
}

export interface ConversationEntry {
  id: string;
  timestamp: Date;
  role: 'user' | 'assistant' | 'system';
  message: string;
  interpretation?: InterpretationResult;
  response?: GeneratedResponse;
}

// ============================================
// STRUCTURE GENERATORS
// ============================================

class StructureGenerator {
  /**
   * Generate structure based on interpreted request
   */
  generateFromRequest(
    structureType: string,
    params: Record<string, number>,
    material: string = 'structural_steel'
  ): StructureData {
    switch (structureType.toLowerCase().replace(/[_\s-]/g, '')) {
      case 'multistorybuilding':
      case 'building':
      case 'frame':
        return this.generateBuilding(params, material);
      
      case 'warrentruss':
      case 'truss':
      case 'trussbridge':
        return this.generateWarrenTruss(params, material);
      
      case 'pratttruss':
        return this.generatePrattTruss(params, material);
      
      case 'portalframe':
        return this.generatePortalFrame(params, material);
      
      case 'industrialshed':
      case 'warehouse':
        return this.generateIndustrialShed(params, material);
      
      case 'cantilever':
      case 'cantileverbeam':
        return this.generateCantilever(params, material);
      
      case 'simplysupported':
      case 'simplysupportedbeam':
        return this.generateSimplySupported(params, material);
      
      case 'continuousbeam':
        return this.generateContinuousBeam(params, material);
      
      default:
        return this.generateBuilding(params, material);
    }
  }

  private generateBuilding(params: Record<string, number>, material: string): StructureData {
    const {
      bays = 3,
      stories = 5,
      bayWidth = 8,
      storyHeight = 3.5,
    } = params;

    const nodes: StructureNode[] = [];
    const members: StructureMemberData[] = [];
    const supports: StructureSupport[] = [];
    const loads: StructureLoadData[] = [];

    let nodeId = 1;
    const nodeGrid: number[][] = [];

    // Generate grid of nodes
    for (let s = 0; s <= stories; s++) {
      nodeGrid[s] = [];
      for (let b = 0; b <= bays; b++) {
        const id = `N${nodeId++}`;
        nodeGrid[s][b] = nodeId - 1;
        nodes.push({
          id,
          x: b * bayWidth,
          y: s * storyHeight,
          z: 0,
          label: `Floor ${s} - Bay ${b}`,
        });

        // Fixed supports at ground level
        if (s === 0) {
          supports.push({
            nodeId: id,
            type: 'fixed',
            restraints: [true, true, true, true, true, true],
          });
        }
      }
    }

    let memberId = 1;

    // Columns
    for (let s = 0; s < stories; s++) {
      for (let b = 0; b <= bays; b++) {
        members.push({
          id: `C${memberId++}`,
          startNodeId: `N${nodeGrid[s][b]}`,
          endNodeId: `N${nodeGrid[s + 1][b]}`,
          type: 'column',
          section: 'ISMB 300',
          material,
        });
      }
    }

    // Beams
    for (let s = 1; s <= stories; s++) {
      for (let b = 0; b < bays; b++) {
        members.push({
          id: `B${memberId++}`,
          startNodeId: `N${nodeGrid[s][b]}`,
          endNodeId: `N${nodeGrid[s][b + 1]}`,
          type: 'beam',
          section: 'ISMB 400',
          material,
        });
      }
    }

    // Floor loads (dead + live)
    for (let s = 1; s <= stories; s++) {
      for (let b = 0; b < bays; b++) {
        loads.push({
          id: `DL${s}-${b}`,
          type: 'member_distributed',
          memberId: `B${(s - 1) * bays + b + 1}`,
          values: [-15], // 15 kN/m
          loadCase: 'Dead+Live',
        });
      }
    }

    return {
      type: 'multi_story_building',
      nodes,
      members,
      loads,
      supports,
      materials: [{
        id: material,
        name: 'Structural Steel E250',
        E: 200e9,
        fy: 250e6,
        density: 7850,
      }],
      sections: [
        { id: 'ISMB 300', name: 'ISMB 300', A: 58.7e-4, Ix: 8603e-8, type: 'I' },
        { id: 'ISMB 400', name: 'ISMB 400', A: 78.5e-4, Ix: 20458e-8, type: 'I' },
      ],
      metadata: {
        name: `${stories}-Story Building`,
        description: `${stories}-story, ${bays}-bay steel moment frame`,
        bays,
        stories,
        bayWidth,
        storyHeight,
        totalHeight: stories * storyHeight,
        totalWidth: bays * bayWidth,
      },
    };
  }

  private generateWarrenTruss(params: Record<string, number>, material: string): StructureData {
    const {
      span = 30,
      height = 5,
      panels = 6,
    } = params;

    const panelLength = span / panels;
    const nodes: StructureNode[] = [];
    const members: StructureMemberData[] = [];
    const supports: StructureSupport[] = [];
    const loads: StructureLoadData[] = [];

    // Bottom chord nodes
    for (let i = 0; i <= panels; i++) {
      nodes.push({
        id: `B${i}`,
        x: i * panelLength,
        y: 0,
        z: 0,
        label: `Bottom ${i}`,
      });
    }

    // Top chord nodes (offset by half panel)
    for (let i = 0; i < panels; i++) {
      nodes.push({
        id: `T${i}`,
        x: (i + 0.5) * panelLength,
        y: height,
        z: 0,
        label: `Top ${i}`,
      });
    }

    // Supports
    supports.push({ nodeId: 'B0', type: 'pinned', restraints: [true, true, true, false, false, false] });
    supports.push({ nodeId: `B${panels}`, type: 'roller', restraints: [false, true, true, false, false, false] });

    // Bottom chord members
    for (let i = 0; i < panels; i++) {
      members.push({
        id: `BC${i}`,
        startNodeId: `B${i}`,
        endNodeId: `B${i + 1}`,
        type: 'truss',
        section: 'ISA 100x100x10',
        material,
      });
    }

    // Top chord members
    for (let i = 0; i < panels - 1; i++) {
      members.push({
        id: `TC${i}`,
        startNodeId: `T${i}`,
        endNodeId: `T${i + 1}`,
        type: 'truss',
        section: 'ISA 100x100x10',
        material,
      });
    }

    // Diagonals
    for (let i = 0; i < panels; i++) {
      // Rising
      members.push({
        id: `D${i}R`,
        startNodeId: `B${i}`,
        endNodeId: `T${i}`,
        type: 'truss',
        section: 'ISA 75x75x8',
        material,
      });
      // Falling
      members.push({
        id: `D${i}F`,
        startNodeId: `T${i}`,
        endNodeId: `B${i + 1}`,
        type: 'truss',
        section: 'ISA 75x75x8',
        material,
      });
    }

    // Loads at bottom chord joints
    const loadPerJoint = 50 / (panels - 1);
    for (let i = 1; i < panels; i++) {
      loads.push({
        id: `PL${i}`,
        type: 'node_force',
        nodeId: `B${i}`,
        values: [0, -loadPerJoint, 0],
        loadCase: 'Live',
      });
    }

    return {
      type: 'warren_truss',
      nodes,
      members,
      loads,
      supports,
      materials: [{
        id: material,
        name: 'Structural Steel E250',
        E: 200e9,
        fy: 250e6,
        density: 7850,
      }],
      sections: [
        { id: 'ISA 100x100x10', name: 'ISA 100x100x10', A: 19e-4, type: 'Angle' },
        { id: 'ISA 75x75x8', name: 'ISA 75x75x8', A: 11.4e-4, type: 'Angle' },
      ],
      metadata: {
        name: 'Warren Truss Bridge',
        description: `${span}m span Warren truss with ${panels} panels`,
        span,
        height,
        panels,
        panelLength,
      },
    };
  }

  private generatePrattTruss(params: Record<string, number>, material: string): StructureData {
    const { span = 24, height = 4, panels = 6 } = params;
    const panelLength = span / panels;
    const nodes: StructureNode[] = [];
    const members: StructureMemberData[] = [];
    const supports: StructureSupport[] = [];

    // Similar to Warren but with verticals
    for (let i = 0; i <= panels; i++) {
      nodes.push({ id: `B${i}`, x: i * panelLength, y: 0, z: 0 });
      nodes.push({ id: `T${i}`, x: i * panelLength, y: height, z: 0 });
    }

    supports.push({ nodeId: 'B0', type: 'pinned', restraints: [true, true, true, false, false, false] });
    supports.push({ nodeId: `B${panels}`, type: 'roller', restraints: [false, true, true, false, false, false] });

    // Chords
    for (let i = 0; i < panels; i++) {
      members.push({ id: `BC${i}`, startNodeId: `B${i}`, endNodeId: `B${i+1}`, type: 'truss', section: 'ISA 90x90x10' });
      members.push({ id: `TC${i}`, startNodeId: `T${i}`, endNodeId: `T${i+1}`, type: 'truss', section: 'ISA 90x90x10' });
    }

    // Verticals and diagonals (Pratt pattern)
    for (let i = 0; i <= panels; i++) {
      members.push({ id: `V${i}`, startNodeId: `B${i}`, endNodeId: `T${i}`, type: 'truss', section: 'ISA 65x65x6' });
      if (i < panels) {
        // Diagonals slope towards center
        if (i < panels / 2) {
          members.push({ id: `D${i}`, startNodeId: `B${i+1}`, endNodeId: `T${i}`, type: 'truss', section: 'ISA 65x65x6' });
        } else {
          members.push({ id: `D${i}`, startNodeId: `B${i}`, endNodeId: `T${i+1}`, type: 'truss', section: 'ISA 65x65x6' });
        }
      }
    }

    return {
      type: 'pratt_truss',
      nodes, members, loads: [], supports,
      materials: [{ id: material, name: 'Steel E250', E: 200e9, fy: 250e6, density: 7850 }],
      sections: [
        { id: 'ISA 90x90x10', name: 'ISA 90x90x10', A: 17e-4, type: 'Angle' },
        { id: 'ISA 65x65x6', name: 'ISA 65x65x6', A: 7.4e-4, type: 'Angle' },
      ],
      metadata: { name: 'Pratt Truss', span, height, panels },
    };
  }

  private generatePortalFrame(params: Record<string, number>, material: string): StructureData {
    const { span = 20, height = 8, roofPitch = 5 } = params;
    const ridgeHeight = height + (span / 2) * Math.tan(roofPitch * Math.PI / 180);

    const nodes = [
      { id: 'N1', x: 0, y: 0, z: 0, label: 'Base Left' },
      { id: 'N2', x: 0, y: height, z: 0, label: 'Eave Left' },
      { id: 'N3', x: span / 2, y: ridgeHeight, z: 0, label: 'Ridge' },
      { id: 'N4', x: span, y: height, z: 0, label: 'Eave Right' },
      { id: 'N5', x: span, y: 0, z: 0, label: 'Base Right' },
    ];

    const members = [
      { id: 'C1', startNodeId: 'N1', endNodeId: 'N2', type: 'column', section: 'ISMB 350' },
      { id: 'R1', startNodeId: 'N2', endNodeId: 'N3', type: 'rafter', section: 'ISMB 400' },
      { id: 'R2', startNodeId: 'N3', endNodeId: 'N4', type: 'rafter', section: 'ISMB 400' },
      { id: 'C2', startNodeId: 'N4', endNodeId: 'N5', type: 'column', section: 'ISMB 350' },
    ];

    const supports = [
      { nodeId: 'N1', type: 'fixed', restraints: [true, true, true, true, true, true] },
      { nodeId: 'N5', type: 'fixed', restraints: [true, true, true, true, true, true] },
    ];

    const loads = [
      { id: 'DL1', type: 'member_distributed', memberId: 'R1', values: [-5], loadCase: 'Dead' },
      { id: 'DL2', type: 'member_distributed', memberId: 'R2', values: [-5], loadCase: 'Dead' },
    ];

    return {
      type: 'portal_frame',
      nodes, members, loads, supports,
      materials: [{ id: material, name: 'Steel E250', E: 200e9, fy: 250e6, density: 7850 }],
      sections: [
        { id: 'ISMB 350', name: 'ISMB 350', A: 66.7e-4, Ix: 13630e-8, type: 'I' },
        { id: 'ISMB 400', name: 'ISMB 400', A: 78.5e-4, Ix: 20458e-8, type: 'I' },
      ],
      metadata: { name: 'Portal Frame', span, height, ridgeHeight, roofPitch },
    };
  }

  private generateIndustrialShed(params: Record<string, number>, material: string): StructureData {
    const { span = 20, length = 50, height = 8, baySpacing = 6 } = params;
    const numFrames = Math.floor(length / baySpacing) + 1;
    
    const nodes: StructureNode[] = [];
    const members: StructureMemberData[] = [];
    const supports: StructureSupport[] = [];

    for (let f = 0; f < numFrames; f++) {
      const z = f * baySpacing;
      nodes.push({ id: `F${f}BL`, x: 0, y: 0, z, label: `Frame ${f} Base Left` });
      nodes.push({ id: `F${f}EL`, x: 0, y: height, z, label: `Frame ${f} Eave Left` });
      nodes.push({ id: `F${f}R`, x: span/2, y: height + 2, z, label: `Frame ${f} Ridge` });
      nodes.push({ id: `F${f}ER`, x: span, y: height, z, label: `Frame ${f} Eave Right` });
      nodes.push({ id: `F${f}BR`, x: span, y: 0, z, label: `Frame ${f} Base Right` });

      supports.push({ nodeId: `F${f}BL`, type: 'fixed', restraints: [true, true, true, true, true, true] });
      supports.push({ nodeId: `F${f}BR`, type: 'fixed', restraints: [true, true, true, true, true, true] });

      members.push({ id: `C${f}L`, startNodeId: `F${f}BL`, endNodeId: `F${f}EL`, type: 'column', section: 'ISMB 350' });
      members.push({ id: `R${f}L`, startNodeId: `F${f}EL`, endNodeId: `F${f}R`, type: 'rafter', section: 'ISMB 400' });
      members.push({ id: `R${f}R`, startNodeId: `F${f}R`, endNodeId: `F${f}ER`, type: 'rafter', section: 'ISMB 400' });
      members.push({ id: `C${f}R`, startNodeId: `F${f}ER`, endNodeId: `F${f}BR`, type: 'column', section: 'ISMB 350' });

      // Purlins connecting frames
      if (f > 0) {
        members.push({ id: `P${f}L`, startNodeId: `F${f-1}EL`, endNodeId: `F${f}EL`, type: 'purlin', section: 'ISMC 150' });
        members.push({ id: `P${f}R`, startNodeId: `F${f-1}R`, endNodeId: `F${f}R`, type: 'purlin', section: 'ISMC 150' });
        members.push({ id: `P${f}E`, startNodeId: `F${f-1}ER`, endNodeId: `F${f}ER`, type: 'purlin', section: 'ISMC 150' });
      }
    }

    return {
      type: 'industrial_shed',
      nodes, members, loads: [], supports,
      materials: [{ id: material, name: 'Steel E250', E: 200e9, fy: 250e6, density: 7850 }],
      sections: [
        { id: 'ISMB 350', name: 'ISMB 350', A: 66.7e-4, Ix: 13630e-8, type: 'I' },
        { id: 'ISMB 400', name: 'ISMB 400', A: 78.5e-4, Ix: 20458e-8, type: 'I' },
        { id: 'ISMC 150', name: 'ISMC 150', A: 21e-4, Ix: 779e-8, type: 'C' },
      ],
      metadata: { name: 'Industrial Shed', span, length, height, baySpacing, numFrames },
    };
  }

  private generateCantilever(params: Record<string, number>, material: string): StructureData {
    const { length = 5, load = 10 } = params;
    
    return {
      type: 'cantilever_beam',
      nodes: [
        { id: 'N1', x: 0, y: 0, z: 0, label: 'Support' },
        { id: 'N2', x: length, y: 0, z: 0, label: 'Free End' },
      ],
      members: [
        { id: 'B1', startNodeId: 'N1', endNodeId: 'N2', type: 'beam', section: 'ISMB 300' },
      ],
      loads: [
        { id: 'PL1', type: 'node_force', nodeId: 'N2', values: [0, -load, 0], loadCase: 'Live' },
      ],
      supports: [
        { nodeId: 'N1', type: 'fixed', restraints: [true, true, true, true, true, true] },
      ],
      materials: [{ id: material, name: 'Steel E250', E: 200e9, fy: 250e6, density: 7850 }],
      sections: [{ id: 'ISMB 300', name: 'ISMB 300', A: 58.7e-4, Ix: 8603e-8, type: 'I' }],
      metadata: { name: 'Cantilever Beam', length, load },
    };
  }

  private generateSimplySupported(params: Record<string, number>, material: string): StructureData {
    const { span = 6, load = 20 } = params;
    
    return {
      type: 'simply_supported_beam',
      nodes: [
        { id: 'N1', x: 0, y: 0, z: 0, label: 'Left Support' },
        { id: 'N2', x: span, y: 0, z: 0, label: 'Right Support' },
      ],
      members: [
        { id: 'B1', startNodeId: 'N1', endNodeId: 'N2', type: 'beam', section: 'ISMB 400' },
      ],
      loads: [
        { id: 'UDL1', type: 'member_distributed', memberId: 'B1', values: [-load], loadCase: 'Live' },
      ],
      supports: [
        { nodeId: 'N1', type: 'pinned', restraints: [true, true, true, false, false, false] },
        { nodeId: 'N2', type: 'roller', restraints: [false, true, true, false, false, false] },
      ],
      materials: [{ id: material, name: 'Steel E250', E: 200e9, fy: 250e6, density: 7850 }],
      sections: [{ id: 'ISMB 400', name: 'ISMB 400', A: 78.5e-4, Ix: 20458e-8, type: 'I' }],
      metadata: { name: 'Simply Supported Beam', span, load },
    };
  }

  private generateContinuousBeam(params: Record<string, number>, material: string): StructureData {
    const { span = 6, spans = 3, load = 15 } = params;
    const totalLength = span * spans;
    
    const nodes: StructureNode[] = [];
    const members: StructureMemberData[] = [];
    const supports: StructureSupport[] = [];
    const loads: StructureLoadData[] = [];

    for (let i = 0; i <= spans; i++) {
      nodes.push({ id: `N${i}`, x: i * span, y: 0, z: 0, label: `Support ${i}` });
      
      if (i === 0) {
        supports.push({ nodeId: `N${i}`, type: 'pinned', restraints: [true, true, true, false, false, false] });
      } else if (i === spans) {
        supports.push({ nodeId: `N${i}`, type: 'roller', restraints: [false, true, true, false, false, false] });
      } else {
        supports.push({ nodeId: `N${i}`, type: 'roller', restraints: [false, true, true, false, false, false] });
      }
    }

    for (let i = 0; i < spans; i++) {
      members.push({ id: `B${i}`, startNodeId: `N${i}`, endNodeId: `N${i+1}`, type: 'beam', section: 'ISMB 350' });
      loads.push({ id: `UDL${i}`, type: 'member_distributed', memberId: `B${i}`, values: [-load], loadCase: 'Live' });
    }

    return {
      type: 'continuous_beam',
      nodes, members, loads, supports,
      materials: [{ id: material, name: 'Steel E250', E: 200e9, fy: 250e6, density: 7850 }],
      sections: [{ id: 'ISMB 350', name: 'ISMB 350', A: 66.7e-4, Ix: 13630e-8, type: 'I' }],
      metadata: { name: 'Continuous Beam', span, spans, totalLength, load },
    };
  }
}

// ============================================
// MAIN AI ARCHITECT CLASS
// ============================================

export class EnhancedAIArchitect {
  private nlp: AdvancedNLPInterpreter;
  private responseGen: IntelligentResponseGenerator;
  private structureGen: StructureGenerator;
  private config: AIArchitectConfig;
  private conversationHistory: ConversationEntry[];
  private currentModelContext: ModelContext | null;

  constructor(config: AIArchitectConfig = {}) {
    this.nlp = nlpInterpreter;
    this.responseGen = responseGenerator;
    this.structureGen = new StructureGenerator();
    this.config = {
      enableVerboseMode: false,
      preferredUnits: 'SI',
      preferredCode: 'IS800',
      experienceLevel: 'professional',
      autoSuggestEnabled: true,
      ...config,
    };
    this.conversationHistory = [];
    this.currentModelContext = null;

    // Initialize NLP preferences
    this.nlp.setPreferences({
      preferredUnits: this.config.preferredUnits,
      preferredCode: this.config.preferredCode!,
      experienceLevel: this.config.experienceLevel,
      preferredMaterial: 'structural_steel',
      verbosityLevel: this.config.enableVerboseMode ? 'comprehensive' : 'detailed',
    });
  }

  /**
   * Process a user request and generate intelligent response
   */
  async processRequest(request: AIRequest): Promise<AIResponse> {
    const startTime = Date.now();

    try {
      // Update model context if provided
      if (request.modelContext) {
        this.currentModelContext = request.modelContext;
      }

      // Interpret the user's message
      const interpretation = this.nlp.interpret(request.message);

      // Log for verbose mode
      if (this.config.enableVerboseMode) {
        console.log('[AIArchitect] Interpretation:', interpretation);
      }

      // Generate response based on interpretation
      const generatedResponse = this.responseGen.generateResponse(interpretation);

      // Handle structure generation if needed
      let structureData: StructureData | undefined;
      if (interpretation.intent.primary === 'create' && generatedResponse.type === 'structure_generation') {
        structureData = this.handleStructureGeneration(interpretation);
      }

      // Build final response
      const response: AIResponse = {
        message: generatedResponse.message,
        type: this.mapResponseType(generatedResponse.type),
        confidence: generatedResponse.confidence,
        interpretation: this.config.enableVerboseMode ? interpretation : undefined,
        structureData,
        calculations: generatedResponse.calculations?.map(c => ({
          name: c.description,
          formula: c.formula || '',
          inputs: c.inputs as Record<string, number> || {},
          result: typeof c.result === 'number' ? c.result : parseFloat(c.result as string) || 0,
          unit: c.unit || '',
          status: 'info' as const,
        })),
        recommendations: generatedResponse.recommendations?.map(r => r.recommendation),
        codeReferences: generatedResponse.codeReferences?.map(r => `${r.code} ${r.clause}: ${r.description}`),
        followUpSuggestions: this.config.autoSuggestEnabled ? generatedResponse.followUp?.map(f => f.question) : undefined,
        warnings: generatedResponse.warnings?.map(w => w.message),
        timestamp: new Date(),
      };

      // Update conversation history
      this.addToHistory('user', request.message, interpretation);
      this.addToHistory('assistant', response.message, undefined, generatedResponse);

      // Update NLP context
      this.nlp.updateContext(
        request.message,
        interpretation.intent,
        interpretation.entities,
        response.message
      );

      const processingTime = Date.now() - startTime;
      if (this.config.enableVerboseMode) {
        console.log(`[AIArchitect] Processing time: ${processingTime}ms`);
      }

      return response;

    } catch (error) {
      console.error('[AIArchitect] Error processing request:', error);
      return {
        message: "I apologize, but I encountered an error processing your request. Could you please rephrase or try again?",
        type: 'error',
        confidence: 0,
        warnings: [(error as Error).message],
        timestamp: new Date(),
      };
    }
  }

  /**
   * Handle structure generation from interpreted request
   */
  private handleStructureGeneration(interpretation: InterpretationResult): StructureData | undefined {
    const structureEntity = interpretation.entities.find(e => e.type === 'structure');
    if (!structureEntity) return undefined;

    const params: Record<string, number> = {};
    for (const entity of interpretation.entities) {
      if (entity.type === 'dimension') {
        const dimType = entity.metadata?.dimensionType;
        if (dimType === 'span') params.span = entity.value;
        if (dimType === 'height') params.height = entity.value;
        if (dimType === 'stories') params.stories = entity.value;
        if (dimType === 'bays') params.bays = entity.value;
      }
    }

    const materialEntity = interpretation.entities.find(e => e.type === 'material');
    const material = (materialEntity?.value as string) || 'structural_steel';

    return this.structureGen.generateFromRequest(
      structureEntity.value as string,
      params,
      material
    );
  }

  /**
   * Map internal response type to external type
   */
  private mapResponseType(type: string): ResponseType {
    const mapping: Record<string, ResponseType> = {
      'explanation': 'explanation',
      'calculation': 'calculation',
      'design_check': 'design',
      'recommendation': 'recommendation',
      'troubleshooting': 'error',
      'structure_generation': 'structure',
      'analysis_result': 'analysis',
      'learning': 'explanation',
      'conversation': 'chat',
      'clarification': 'clarification',
      'error': 'error',
    };
    return mapping[type] || 'chat';
  }

  /**
   * Add entry to conversation history
   */
  private addToHistory(
    role: 'user' | 'assistant' | 'system',
    message: string,
    interpretation?: InterpretationResult,
    response?: GeneratedResponse
  ): void {
    this.conversationHistory.push({
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      role,
      message,
      interpretation,
      response,
    });

    // Keep history manageable
    if (this.conversationHistory.length > 100) {
      this.conversationHistory = this.conversationHistory.slice(-50);
    }
  }

  /**
   * Get conversation history
   */
  getHistory(): ConversationEntry[] {
    return [...this.conversationHistory];
  }

  /**
   * Clear conversation history and context
   */
  clearHistory(): void {
    this.conversationHistory = [];
    this.nlp.clearContext();
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<AIArchitectConfig>): void {
    this.config = { ...this.config, ...config };
    
    this.nlp.setPreferences({
      preferredUnits: this.config.preferredUnits,
      preferredCode: this.config.preferredCode!,
      experienceLevel: this.config.experienceLevel,
      verbosityLevel: this.config.enableVerboseMode ? 'comprehensive' : 'detailed',
    });
  }

  /**
   * Set model context
   */
  setModelContext(context: ModelContext): void {
    this.currentModelContext = context;
  }

  /**
   * Get current context
   */
  getContext(): ConversationalContext {
    return this.nlp.getContext();
  }

  /**
   * Get knowledge base reference
   */
  getKnowledgeBase(): typeof CIVIL_ENGINEERING_KNOWLEDGE {
    return CIVIL_ENGINEERING_KNOWLEDGE;
  }

  /**
   * Explain interpretation for debugging
   */
  explainInterpretation(message: string): string {
    const interpretation = this.nlp.interpret(message);
    return this.nlp.explainInterpretation(interpretation);
  }
}

// Export singleton instance
export const aiArchitect = new EnhancedAIArchitect();

export default EnhancedAIArchitect;
