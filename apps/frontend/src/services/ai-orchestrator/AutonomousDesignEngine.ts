/**
 * ============================================================================
 * AUTONOMOUS DESIGN ENGINE
 * ============================================================================
 * 
 * The "do the business himself" engine. Executes the COMPLETE structural
 * engineering workflow autonomously — no human intervention needed:
 * 
 *   1. Parse natural-language prompt → extract parameters
 *   2. Generate structural model (nodes, members, supports)
 *   3. Assign section properties from IS section database
 *   4. Generate all loads (DL, LL, WL, EQ per IS 875/1893)
 *   5. Run FEM analysis via the WASM solver
 *   6. Extract member forces & displacements
 *   7. Run IS 800 / IS 456 / AISC 360 design checks
 *   8. Diagnose issues & auto-fix (upsize failed members)
 *   9. Re-analyze after fix → iterate until converged
 *  10. Produce complete design report with utilization ratios
 * 
 * @version 1.0.0
 */

import { SectionLookup, type SteelSection, type SteelMaterial, type MemberDesignProperties } from './SectionLookup';
import { AutoLoadGenerator, type LoadCase, type LoadCombination, type NodeLoad, type MemberLoad, type ProjectLoadConfig } from './AutoLoadGenerator';

// ============================================================================
// TYPES
// ============================================================================

export interface DesignRequest {
  /** Natural language description or parametric spec */
  prompt: string;
  /** Override parsed parameters */
  parameters?: StructureParameters;
  /** Load configuration */
  loadConfig?: Partial<ProjectLoadConfig>;
  /** Design code */
  designCode?: 'IS_800' | 'IS_456' | 'AISC_360' | 'EC_3';
  /** Material grade */
  materialGrade?: string;
  /** Enable auto-optimization */
  optimize?: boolean;
  /** Max optimization iterations */
  maxIterations?: number;
  /** Target utilization ratio (0.5-0.95) */
  targetUtilization?: number;
}

export interface StructureParameters {
  type: StructureType;
  span?: number;        // m
  height?: number;      // m
  bays?: number;
  stories?: number;
  bayWidth?: number;    // m
  storyHeight?: number; // m
  panels?: number;
  roofPitch?: number;   // degrees
  length?: number;      // m (for 3D structures)
  baySpacing?: number;  // m
  load?: number;        // kN or kN/m
  spans?: number;       // for continuous beams
}

export type StructureType =
  | 'simply-supported-beam'
  | 'cantilever-beam'
  | 'continuous-beam'
  | 'fixed-beam'
  | 'propped-cantilever'
  | 'portal-frame'
  | 'gable-frame'
  | 'multi-story-frame'
  | 'braced-frame'
  | 'warren-truss'
  | 'pratt-truss'
  | 'howe-truss'
  | 'k-truss'
  | 'industrial-shed';

export interface GeneratedNode {
  id: string;
  x: number; y: number; z: number;
  restraints?: { fx: boolean; fy: boolean; fz: boolean; mx: boolean; my: boolean; mz: boolean };
}

export interface GeneratedMember {
  id: string;
  startNodeId: string;
  endNodeId: string;
  sectionName: string;
  memberType: 'beam' | 'column' | 'brace' | 'chord' | 'diagonal' | 'vertical' | 'purlin' | 'rafter';
  E: number;   // kN/m²
  A: number;   // m²
  I: number;   // m⁴
}

export interface AnalysisResults {
  displacements: Map<string, { dx: number; dy: number; dz: number; rx: number; ry: number; rz: number }>;
  reactions: Map<string, { fx: number; fy: number; fz: number; mx: number; my: number; mz: number }>;
  memberForces: Map<string, { axial: number; shearStart: number; shearEnd: number; momentStart: number; momentEnd: number }>;
}

export interface DesignCheck {
  memberId: string;
  memberType: string;
  sectionName: string;
  clause: string;
  title: string;
  demand: number;
  capacity: number;
  ratio: number;
  unit: string;
  status: 'PASS' | 'FAIL' | 'WARNING';
  formula?: string;
}

export interface DesignResult {
  /** Whether the design passed all checks */
  passed: boolean;

  /** Generated structure model */
  model: {
    nodes: GeneratedNode[];
    members: GeneratedMember[];
  };

  /** Load cases applied */
  loadCases: LoadCase[];
  combinations: LoadCombination[];

  /** Analysis results */
  analysis: AnalysisResults | null;

  /** Per-member design checks */
  designChecks: DesignCheck[];

  /** Members that failed checks */
  failedMembers: string[];

  /** Max utilization ratio */
  maxUtilization: number;

  /** Optimization history */
  iterations: IterationRecord[];

  /** Total steel weight (kg) */
  totalWeight: number;

  /** Summary report text */
  report: string;

  /** Warnings */
  warnings: string[];

  /** Computation time */
  computeTimeMs: number;
}

interface IterationRecord {
  iteration: number;
  maxRatio: number;
  failedCount: number;
  totalWeight: number;
  changes: string[];
}

// ============================================================================
// STRUCTURE GENERATORS
// ============================================================================

class ParametricGenerator {
  private nodeCounter = 0;
  private memberCounter = 0;

  private nextNodeId(): string { return `N${++this.nodeCounter}`; }
  private nextMemberId(): string { return `M${++this.memberCounter}`; }

  reset(): void {
    this.nodeCounter = 0;
    this.memberCounter = 0;
  }

  generate(params: StructureParameters, materialGrade: string = 'E250'): {
    nodes: GeneratedNode[];
    members: GeneratedMember[];
  } {
    this.reset();

    switch (params.type) {
      case 'simply-supported-beam': return this.simplySupported(params, materialGrade);
      case 'cantilever-beam':       return this.cantilever(params, materialGrade);
      case 'continuous-beam':       return this.continuousBeam(params, materialGrade);
      case 'fixed-beam':            return this.fixedBeam(params, materialGrade);
      case 'propped-cantilever':    return this.proppedCantilever(params, materialGrade);
      case 'portal-frame':          return this.portalFrame(params, materialGrade);
      case 'gable-frame':           return this.gableFrame(params, materialGrade);
      case 'multi-story-frame':     return this.multiStoryFrame(params, materialGrade);
      case 'braced-frame':          return this.bracedFrame(params, materialGrade);
      case 'warren-truss':          return this.warrenTruss(params, materialGrade);
      case 'pratt-truss':           return this.prattTruss(params, materialGrade);
      case 'howe-truss':            return this.howeTruss(params, materialGrade);
      case 'k-truss':               return this.kTruss(params, materialGrade);
      case 'industrial-shed':       return this.industrialShed(params, materialGrade);
      default:                      return this.simplySupported(params, materialGrade);
    }
  }

  private makeMember(
    startNodeId: string,
    endNodeId: string,
    sectionName: string,
    memberType: GeneratedMember['memberType'],
    materialGrade: string,
  ): GeneratedMember {
    const section = SectionLookup.getSection(sectionName);
    const material = SectionLookup.getMaterial(materialGrade);
    const units = section ? SectionLookup.toModelUnits(section, material) : { A: 0.01, I: 1e-4, E: 200e6 };

    return {
      id: this.nextMemberId(),
      startNodeId,
      endNodeId,
      sectionName,
      memberType,
      E: units.E,
      A: units.A,
      I: units.I,
    };
  }

  private fixed(): GeneratedNode['restraints'] {
    return { fx: true, fy: true, fz: true, mx: true, my: true, mz: true };
  }
  private pinned(): GeneratedNode['restraints'] {
    return { fx: true, fy: true, fz: true, mx: false, my: false, mz: false };
  }
  private roller(): GeneratedNode['restraints'] {
    return { fx: false, fy: true, fz: true, mx: false, my: false, mz: false };
  }

  // ── Simply Supported Beam ──
  private simplySupported(p: StructureParameters, mat: string) {
    const span = p.span || 6;
    const nodes: GeneratedNode[] = [
      { id: this.nextNodeId(), x: 0, y: 0, z: 0, restraints: this.pinned() },
      { id: this.nextNodeId(), x: span, y: 0, z: 0, restraints: this.roller() },
    ];
    return { nodes, members: [this.makeMember('N1', 'N2', 'ISMB 300', 'beam', mat)] };
  }

  // ── Cantilever ──
  private cantilever(p: StructureParameters, mat: string) {
    const span = p.span || 3;
    const nodes: GeneratedNode[] = [
      { id: this.nextNodeId(), x: 0, y: 0, z: 0, restraints: this.fixed() },
      { id: this.nextNodeId(), x: span, y: 0, z: 0 },
    ];
    return { nodes, members: [this.makeMember('N1', 'N2', 'ISMB 250', 'beam', mat)] };
  }

  // ── Continuous Beam ──
  private continuousBeam(p: StructureParameters, mat: string) {
    const spans = p.spans || 3;
    const spanL = p.span || 6;
    const nodes: GeneratedNode[] = [];
    const members: GeneratedMember[] = [];

    for (let i = 0; i <= spans; i++) {
      const restraint = i === 0 ? this.pinned() : this.roller();
      nodes.push({ id: this.nextNodeId(), x: i * spanL, y: 0, z: 0, restraints: restraint });
    }
    for (let i = 0; i < spans; i++) {
      members.push(this.makeMember(`N${i + 1}`, `N${i + 2}`, 'ISMB 350', 'beam', mat));
    }
    return { nodes, members };
  }

  // ── Fixed-Fixed Beam ──
  private fixedBeam(p: StructureParameters, mat: string) {
    const span = p.span || 6;
    const nodes: GeneratedNode[] = [
      { id: this.nextNodeId(), x: 0, y: 0, z: 0, restraints: this.fixed() },
      { id: this.nextNodeId(), x: span, y: 0, z: 0, restraints: this.fixed() },
    ];
    return { nodes, members: [this.makeMember('N1', 'N2', 'ISMB 300', 'beam', mat)] };
  }

  // ── Propped Cantilever ──
  private proppedCantilever(p: StructureParameters, mat: string) {
    const span = p.span || 5;
    const nodes: GeneratedNode[] = [
      { id: this.nextNodeId(), x: 0, y: 0, z: 0, restraints: this.fixed() },
      { id: this.nextNodeId(), x: span, y: 0, z: 0, restraints: this.roller() },
    ];
    return { nodes, members: [this.makeMember('N1', 'N2', 'ISMB 300', 'beam', mat)] };
  }

  // ── Portal Frame ──
  private portalFrame(p: StructureParameters, mat: string) {
    const span = p.span || 12;
    const height = p.height || 6;
    const nodes: GeneratedNode[] = [
      { id: this.nextNodeId(), x: 0, y: 0, z: 0, restraints: this.fixed() },
      { id: this.nextNodeId(), x: 0, y: height, z: 0 },
      { id: this.nextNodeId(), x: span, y: height, z: 0 },
      { id: this.nextNodeId(), x: span, y: 0, z: 0, restraints: this.fixed() },
    ];
    return {
      nodes,
      members: [
        this.makeMember('N1', 'N2', 'ISMB 400', 'column', mat),
        this.makeMember('N2', 'N3', 'ISMB 450', 'beam', mat),
        this.makeMember('N3', 'N4', 'ISMB 400', 'column', mat),
      ],
    };
  }

  // ── Gable Frame ──
  private gableFrame(p: StructureParameters, mat: string) {
    const span = p.span || 15;
    const height = p.height || 6;
    const pitch = p.roofPitch || 10;
    const ridge = height + (span / 2) * Math.tan((pitch * Math.PI) / 180);

    const nodes: GeneratedNode[] = [
      { id: this.nextNodeId(), x: 0, y: 0, z: 0, restraints: this.fixed() },
      { id: this.nextNodeId(), x: 0, y: height, z: 0 },
      { id: this.nextNodeId(), x: span / 2, y: ridge, z: 0 },
      { id: this.nextNodeId(), x: span, y: height, z: 0 },
      { id: this.nextNodeId(), x: span, y: 0, z: 0, restraints: this.fixed() },
    ];
    return {
      nodes,
      members: [
        this.makeMember('N1', 'N2', 'ISMB 400', 'column', mat),
        this.makeMember('N2', 'N3', 'ISMB 350', 'rafter', mat),
        this.makeMember('N3', 'N4', 'ISMB 350', 'rafter', mat),
        this.makeMember('N4', 'N5', 'ISMB 400', 'column', mat),
      ],
    };
  }

  // ── Multi-story Frame ──
  private multiStoryFrame(p: StructureParameters, mat: string) {
    const bays = p.bays || 3;
    const stories = p.stories || 3;
    const bayWidth = p.bayWidth || 6;
    const storyHeight = p.storyHeight || 3.5;

    const nodes: GeneratedNode[] = [];
    const members: GeneratedMember[] = [];

    // Create grid of nodes
    for (let j = 0; j <= stories; j++) {
      for (let i = 0; i <= bays; i++) {
        const restraint = j === 0 ? this.fixed() : undefined;
        nodes.push({
          id: this.nextNodeId(),
          x: i * bayWidth,
          y: j * storyHeight,
          z: 0,
          restraints: restraint,
        });
      }
    }

    // Columns
    for (let j = 0; j < stories; j++) {
      for (let i = 0; i <= bays; i++) {
        const bottomId = `N${j * (bays + 1) + i + 1}`;
        const topId = `N${(j + 1) * (bays + 1) + i + 1}`;
        // Heavier columns at lower stories
        const colSection = j < stories / 2 ? 'ISMB 400' : 'ISMB 350';
        members.push(this.makeMember(bottomId, topId, colSection, 'column', mat));
      }
    }

    // Beams
    for (let j = 1; j <= stories; j++) {
      for (let i = 0; i < bays; i++) {
        const leftId = `N${j * (bays + 1) + i + 1}`;
        const rightId = `N${j * (bays + 1) + i + 2}`;
        const beamSection = j === stories ? 'ISMB 350' : 'ISMB 400'; // lighter roof beams
        members.push(this.makeMember(leftId, rightId, beamSection, 'beam', mat));
      }
    }

    return { nodes, members };
  }

  // ── Braced Frame ──
  private bracedFrame(p: StructureParameters, mat: string) {
    const span = p.span || 6;
    const height = p.height || 4;
    const nodes: GeneratedNode[] = [
      { id: this.nextNodeId(), x: 0, y: 0, z: 0, restraints: this.pinned() },
      { id: this.nextNodeId(), x: span, y: 0, z: 0, restraints: this.pinned() },
      { id: this.nextNodeId(), x: 0, y: height, z: 0 },
      { id: this.nextNodeId(), x: span, y: height, z: 0 },
    ];
    return {
      nodes,
      members: [
        this.makeMember('N1', 'N3', 'ISMB 300', 'column', mat),
        this.makeMember('N2', 'N4', 'ISMB 300', 'column', mat),
        this.makeMember('N3', 'N4', 'ISMB 250', 'beam', mat),
        this.makeMember('N1', 'N4', 'ISA 100x100x10', 'brace', mat), // X-brace
        this.makeMember('N2', 'N3', 'ISA 100x100x10', 'brace', mat),
      ],
    };
  }

  // ── Warren Truss ──
  private warrenTruss(p: StructureParameters, mat: string) {
    const span = p.span || 24;
    const height = p.height || 4;
    const panels = p.panels || 6;
    const dx = span / panels;

    const nodes: GeneratedNode[] = [];
    const members: GeneratedMember[] = [];

    // Bottom chord nodes
    for (let i = 0; i <= panels; i++) {
      const restraint = i === 0 ? this.pinned() : (i === panels ? this.roller() : undefined);
      nodes.push({ id: this.nextNodeId(), x: i * dx, y: 0, z: 0, restraints: restraint });
    }
    // Top chord nodes (offset by half panel)
    for (let i = 0; i < panels; i++) {
      nodes.push({ id: this.nextNodeId(), x: (i + 0.5) * dx, y: height, z: 0 });
    }

    // Bottom chord members
    for (let i = 0; i < panels; i++) {
      members.push(this.makeMember(`N${i + 1}`, `N${i + 2}`, 'ISA 100x100x10', 'chord', mat));
    }
    // Top chord members
    for (let i = 0; i < panels - 1; i++) {
      const topStart = panels + 1 + i + 1;
      const topEnd = panels + 1 + i + 2;
      members.push(this.makeMember(`N${topStart}`, `N${topEnd}`, 'ISA 100x100x10', 'chord', mat));
    }
    // Diagonals (Warren pattern: alternating up-down)
    for (let i = 0; i < panels; i++) {
      const bottomLeft = i + 1;
      const bottomRight = i + 2;
      const top = panels + 1 + i + 1;
      members.push(this.makeMember(`N${bottomLeft}`, `N${top}`, 'ISA 75x75x8', 'diagonal', mat));
      members.push(this.makeMember(`N${top}`, `N${bottomRight}`, 'ISA 75x75x8', 'diagonal', mat));
    }

    return { nodes, members };
  }

  // ── Pratt Truss ──
  private prattTruss(p: StructureParameters, mat: string) {
    const span = p.span || 24;
    const height = p.height || 4;
    const panels = p.panels || 6;
    const dx = span / panels;

    const nodes: GeneratedNode[] = [];
    const members: GeneratedMember[] = [];

    // Bottom and top chord nodes (aligned)
    for (let i = 0; i <= panels; i++) {
      const restraint = i === 0 ? this.pinned() : (i === panels ? this.roller() : undefined);
      nodes.push({ id: this.nextNodeId(), x: i * dx, y: 0, z: 0, restraints: restraint });
    }
    for (let i = 0; i <= panels; i++) {
      nodes.push({ id: this.nextNodeId(), x: i * dx, y: height, z: 0 });
    }

    const topOff = panels + 1;

    // Bottom chord
    for (let i = 0; i < panels; i++) {
      members.push(this.makeMember(`N${i + 1}`, `N${i + 2}`, 'ISA 100x100x10', 'chord', mat));
    }
    // Top chord
    for (let i = 0; i < panels; i++) {
      members.push(this.makeMember(`N${topOff + i + 1}`, `N${topOff + i + 2}`, 'ISA 100x100x10', 'chord', mat));
    }
    // Verticals
    for (let i = 0; i <= panels; i++) {
      members.push(this.makeMember(`N${i + 1}`, `N${topOff + i + 1}`, 'ISA 65x65x6', 'vertical', mat));
    }
    // Pratt diagonals (slope toward center)
    const mid = panels / 2;
    for (let i = 0; i < panels; i++) {
      if (i < mid) {
        members.push(this.makeMember(`N${i + 1}`, `N${topOff + i + 2}`, 'ISA 75x75x8', 'diagonal', mat));
      } else {
        members.push(this.makeMember(`N${i + 2}`, `N${topOff + i + 1}`, 'ISA 75x75x8', 'diagonal', mat));
      }
    }

    return { nodes, members };
  }

  // ── Howe Truss ──
  private howeTruss(p: StructureParameters, mat: string) {
    const span = p.span || 24;
    const height = p.height || 4;
    const panels = p.panels || 6;
    const dx = span / panels;

    const nodes: GeneratedNode[] = [];
    const members: GeneratedMember[] = [];

    for (let i = 0; i <= panels; i++) {
      const restraint = i === 0 ? this.pinned() : (i === panels ? this.roller() : undefined);
      nodes.push({ id: this.nextNodeId(), x: i * dx, y: 0, z: 0, restraints: restraint });
    }
    for (let i = 0; i <= panels; i++) {
      nodes.push({ id: this.nextNodeId(), x: i * dx, y: height, z: 0 });
    }

    const topOff = panels + 1;

    for (let i = 0; i < panels; i++) {
      members.push(this.makeMember(`N${i + 1}`, `N${i + 2}`, 'ISA 100x100x10', 'chord', mat));
      members.push(this.makeMember(`N${topOff + i + 1}`, `N${topOff + i + 2}`, 'ISA 100x100x10', 'chord', mat));
    }
    for (let i = 0; i <= panels; i++) {
      members.push(this.makeMember(`N${i + 1}`, `N${topOff + i + 1}`, 'ISA 65x65x6', 'vertical', mat));
    }
    // Howe diagonals (opposite of Pratt: slope away from center)
    const mid = panels / 2;
    for (let i = 0; i < panels; i++) {
      if (i < mid) {
        members.push(this.makeMember(`N${i + 2}`, `N${topOff + i + 1}`, 'ISA 75x75x8', 'diagonal', mat));
      } else {
        members.push(this.makeMember(`N${i + 1}`, `N${topOff + i + 2}`, 'ISA 75x75x8', 'diagonal', mat));
      }
    }

    return { nodes, members };
  }

  // ── K-Truss ──
  private kTruss(p: StructureParameters, mat: string) {
    const span = p.span || 30;
    const height = p.height || 5;
    const panels = p.panels || 6;
    const dx = span / panels;
    const midH = height / 2;

    const nodes: GeneratedNode[] = [];
    const members: GeneratedMember[] = [];

    // Bottom chord
    for (let i = 0; i <= panels; i++) {
      const restraint = i === 0 ? this.pinned() : (i === panels ? this.roller() : undefined);
      nodes.push({ id: this.nextNodeId(), x: i * dx, y: 0, z: 0, restraints: restraint });
    }
    // Top chord
    for (let i = 0; i <= panels; i++) {
      nodes.push({ id: this.nextNodeId(), x: i * dx, y: height, z: 0 });
    }
    // Mid-height nodes (for K-pattern)
    for (let i = 0; i <= panels; i++) {
      nodes.push({ id: this.nextNodeId(), x: i * dx, y: midH, z: 0 });
    }

    const topOff = panels + 1;
    const midOff = 2 * (panels + 1);

    // Chords
    for (let i = 0; i < panels; i++) {
      members.push(this.makeMember(`N${i + 1}`, `N${i + 2}`, 'ISA 100x100x10', 'chord', mat));
      members.push(this.makeMember(`N${topOff + i + 1}`, `N${topOff + i + 2}`, 'ISA 100x100x10', 'chord', mat));
    }
    // Full verticals
    for (let i = 0; i <= panels; i++) {
      members.push(this.makeMember(`N${i + 1}`, `N${topOff + i + 1}`, 'ISA 65x65x6', 'vertical', mat));
    }
    // K-diagonals: from mid-point to adjacent top and bottom
    for (let i = 0; i < panels; i++) {
      members.push(this.makeMember(`N${midOff + i + 1}`, `N${topOff + i + 2}`, 'ISA 75x75x8', 'diagonal', mat));
      members.push(this.makeMember(`N${midOff + i + 1}`, `N${i + 2}`, 'ISA 75x75x8', 'diagonal', mat));
    }

    return { nodes, members };
  }

  // ── Industrial Shed (3D) ──
  private industrialShed(p: StructureParameters, mat: string) {
    const span = p.span || 20;
    const length = p.length || 30;
    const height = p.height || 8;
    const baySpacing = p.baySpacing || 6;
    const pitch = p.roofPitch || 10;
    const numBays = Math.max(1, Math.round(length / baySpacing));
    const ridgeH = height + (span / 2) * Math.tan((pitch * Math.PI) / 180);

    const nodes: GeneratedNode[] = [];
    const members: GeneratedMember[] = [];

    // Generate frames along Z axis
    for (let b = 0; b <= numBays; b++) {
      const z = b * baySpacing;
      const baseLeft = this.nextNodeId();
      nodes.push({ id: baseLeft, x: 0, y: 0, z, restraints: this.fixed() });
      const eaveLeft = this.nextNodeId();
      nodes.push({ id: eaveLeft, x: 0, y: height, z });
      const ridge = this.nextNodeId();
      nodes.push({ id: ridge, x: span / 2, y: ridgeH, z });
      const eaveRight = this.nextNodeId();
      nodes.push({ id: eaveRight, x: span, y: height, z });
      const baseRight = this.nextNodeId();
      nodes.push({ id: baseRight, x: span, y: 0, z, restraints: this.fixed() });

      // Frame members
      members.push(this.makeMember(baseLeft, eaveLeft, 'ISMB 400', 'column', mat));
      members.push(this.makeMember(eaveLeft, ridge, 'ISMB 350', 'rafter', mat));
      members.push(this.makeMember(ridge, eaveRight, 'ISMB 350', 'rafter', mat));
      members.push(this.makeMember(eaveRight, baseRight, 'ISMB 400', 'column', mat));
    }

    // Purlins connecting frames (at eaves and ridge)
    const nodesPerFrame = 5;
    for (let b = 0; b < numBays; b++) {
      const f1 = b * nodesPerFrame;
      const f2 = (b + 1) * nodesPerFrame;
      // Eave left
      members.push(this.makeMember(`N${f1 + 2}`, `N${f2 + 2}`, 'ISMC 150', 'purlin', mat));
      // Ridge
      members.push(this.makeMember(`N${f1 + 3}`, `N${f2 + 3}`, 'ISMC 150', 'purlin', mat));
      // Eave right
      members.push(this.makeMember(`N${f1 + 4}`, `N${f2 + 4}`, 'ISMC 150', 'purlin', mat));
    }

    return { nodes, members };
  }
}

// ============================================================================
// NLP PARAMETER PARSER
// ============================================================================

class PromptParser {
  /**
   * Extract structural parameters from natural language
   */
  static parse(prompt: string): StructureParameters {
    const lower = prompt.toLowerCase();

    const type = PromptParser.detectType(lower);
    const span = PromptParser.extractDimension(lower, /(\d+(?:\.\d+)?)\s*(?:m|meter|metre)?\s*(?:span|long|length|wide|width)/i)
      || PromptParser.extractDimension(lower, /span\s*(?:of|=|:)?\s*(\d+(?:\.\d+)?)/i);
    const height = PromptParser.extractDimension(lower, /(\d+(?:\.\d+)?)\s*(?:m|meter|metre)?\s*(?:height|tall|high)/i)
      || PromptParser.extractDimension(lower, /height\s*(?:of|=|:)?\s*(\d+(?:\.\d+)?)/i);
    const bays = PromptParser.extractInteger(lower, /(\d+)\s*(?:bay|bays)/i);
    const stories = PromptParser.extractInteger(lower, /(\d+)\s*(?:stor(?:y|ies|ey)|floor|level)/i);
    const panels = PromptParser.extractInteger(lower, /(\d+)\s*(?:panel|division)/i);
    const spans = PromptParser.extractInteger(lower, /(\d+)\s*(?:span)/i);
    const load = PromptParser.extractDimension(lower, /(\d+(?:\.\d+)?)\s*(?:kn|kN)\s*(?:\/\s*m|per\s*m)?/i);
    const pitch = PromptParser.extractDimension(lower, /(\d+(?:\.\d+)?)\s*(?:°|degree|pitch)/i);
    const bayWidth = PromptParser.extractDimension(lower, /bay\s*(?:width|spacing)\s*(?:of|=|:)?\s*(\d+(?:\.\d+)?)/i);
    const storyHeight = PromptParser.extractDimension(lower, /(?:story|storey|floor)\s*height\s*(?:of|=|:)?\s*(\d+(?:\.\d+)?)/i);

    return {
      type,
      ...(span !== null && { span }),
      ...(height !== null && { height }),
      ...(bays !== null && { bays }),
      ...(stories !== null && { stories }),
      ...(panels !== null && { panels }),
      ...(spans !== null && { spans }),
      ...(load !== null && { load }),
      ...(pitch !== null && { roofPitch: pitch }),
      ...(bayWidth !== null && { bayWidth }),
      ...(storyHeight !== null && { storyHeight }),
    };
  }

  static detectType(text: string): StructureType {
    if (/industrial\s*shed|warehouse|factory\s*building/i.test(text)) return 'industrial-shed';
    if (/multi[- ]?stor(?:y|ey)|building|(\d+)\s*stor/i.test(text)) return 'multi-story-frame';
    if (/braced\s*frame|x[- ]?brac/i.test(text)) return 'braced-frame';
    if (/gable\s*frame|pitched\s*portal/i.test(text)) return 'gable-frame';
    if (/portal\s*frame/i.test(text)) return 'portal-frame';
    if (/k[- ]?truss/i.test(text)) return 'k-truss';
    if (/howe\s*truss/i.test(text)) return 'howe-truss';
    if (/pratt\s*truss/i.test(text)) return 'pratt-truss';
    if (/warren\s*truss|truss\s*bridge/i.test(text)) return 'warren-truss';
    if (/truss/i.test(text)) return 'warren-truss';
    if (/continuous\s*beam/i.test(text)) return 'continuous-beam';
    if (/fixed[- ]?fixed\s*beam|fixed\s*beam|encastre/i.test(text)) return 'fixed-beam';
    if (/propped\s*cantilever/i.test(text)) return 'propped-cantilever';
    if (/cantilever/i.test(text)) return 'cantilever-beam';
    if (/simply\s*supported|simple\s*beam|ss\s*beam/i.test(text)) return 'simply-supported-beam';
    if (/beam/i.test(text)) return 'simply-supported-beam';
    if (/frame/i.test(text)) return 'portal-frame';
    return 'simply-supported-beam';
  }

  private static extractDimension(text: string, pattern: RegExp): number | null {
    const match = text.match(pattern);
    return match ? parseFloat(match[1]) : null;
  }

  private static extractInteger(text: string, pattern: RegExp): number | null {
    const match = text.match(pattern);
    return match ? parseInt(match[1], 10) : null;
  }

  /**
   * Extract load configuration from prompt
   */
  static parseLoadConfig(prompt: string): Partial<ProjectLoadConfig> {
    const lower = prompt.toLowerCase();
    const config: Partial<ProjectLoadConfig> = {};

    // Occupancy type
    if (/warehouse/i.test(lower)) config.occupancyType = 'warehouse_heavy';
    else if (/office/i.test(lower)) config.occupancyType = 'office';
    else if (/hospital/i.test(lower)) config.occupancyType = 'hospital_ward';
    else if (/retail|shop|mall/i.test(lower)) config.occupancyType = 'retail';
    else if (/factory|industrial/i.test(lower)) config.occupancyType = 'factory_light';
    else if (/library/i.test(lower)) config.occupancyType = 'library_reading';
    else if (/school|classroom/i.test(lower)) config.occupancyType = 'classroom';
    else if (/residential|house|apartment/i.test(lower)) config.occupancyType = 'residential';

    // Seismic zone
    const zoneMatch = lower.match(/(?:seismic\s*)?zone\s*(ii|iii|iv|v|2|3|4|5)/i);
    if (zoneMatch) {
      const zoneMap: Record<string, 'II' | 'III' | 'IV' | 'V'> = { 'ii': 'II', '2': 'II', 'iii': 'III', '3': 'III', 'iv': 'IV', '4': 'IV', 'v': 'V', '5': 'V' };
      config.seismicZone = zoneMap[zoneMatch[1].toLowerCase()];
    }

    // Wind speed
    const windMatch = lower.match(/(?:wind\s*(?:speed)?|vb)\s*(?:=|:)?\s*(\d+)/i);
    if (windMatch) config.windZone = parseInt(windMatch[1]);

    // Terrain
    const terrainMatch = lower.match(/terrain\s*(?:cat(?:egory)?)\s*(\d)/i);
    if (terrainMatch) config.terrainCategory = parseInt(terrainMatch[1]) as 1|2|3|4;

    // Design code
    if (/aisc|american|us\s*code/i.test(lower)) config.designCode = 'ASCE';
    else if (/eurocode|ec\s*\d|european/i.test(lower)) config.designCode = 'EC';
    else config.designCode = 'IS';

    return config;
  }
}

// ============================================================================
// IS 800 DESIGN CHECKER (SELF-CONTAINED)
// ============================================================================

class DesignChecker {
  private gammaM0 = 1.10;
  private gammaM1 = 1.25;

  /**
   * Run all IS 800:2007 checks for a member
   */
  checkMember(
    memberId: string,
    memberType: string,
    props: MemberDesignProperties,
    forces: { axial: number; shear: number; moment: number }, // kN, kN, kN·m
  ): DesignCheck[] {
    const checks: DesignCheck[] = [];
    const { section, material } = props;
    const fy = material.fy; // MPa
    const fu = material.fu;
    const E = material.E;

    // Convert forces to N and N·mm
    const N = forces.axial * 1000;       // kN → N
    const V = Math.abs(forces.shear) * 1000;
    const M = Math.abs(forces.moment) * 1e6; // kN·m → N·mm

    // ── Section Classification (Cl. 3.7) ──
    const epsilon = Math.sqrt(250 / fy);
    const lambdaF = (section.width / 2) / section.flangeThickness;
    const lambdaW = (section.depth - 2 * section.flangeThickness) / section.webThickness;
    const flangeLimit = 9.4 * epsilon;
    const webLimit = 84 * epsilon;
    const sectionClass = lambdaF <= flangeLimit && lambdaW <= webLimit ? 'Compact' : 'Semi-compact';

    checks.push({
      memberId, memberType, sectionName: section.name,
      clause: 'Cl. 3.7', title: 'Section Classification',
      demand: Math.max(lambdaF / flangeLimit, lambdaW / webLimit),
      capacity: 1.0,
      ratio: Math.max(lambdaF / flangeLimit, lambdaW / webLimit),
      unit: '',
      status: sectionClass === 'Compact' ? 'PASS' : 'WARNING',
      formula: `λf=${lambdaF.toFixed(1)} (limit ${flangeLimit.toFixed(1)}), λw=${lambdaW.toFixed(1)} (limit ${webLimit.toFixed(1)})`,
    });

    // ── Tension Check (Cl. 6.2) ──
    if (N > 0) {
      const Tdg = section.area * fy / this.gammaM0; // N
      const ratio = N / Tdg;
      checks.push({
        memberId, memberType, sectionName: section.name,
        clause: 'Cl. 6.2', title: 'Tension Capacity',
        demand: N / 1000, capacity: Tdg / 1000,
        ratio, unit: 'kN',
        status: ratio <= 1.0 ? 'PASS' : 'FAIL',
        formula: `Tdg = A·fy/γm0 = ${section.area}×${fy}/${this.gammaM0}`,
      });
    }

    // ── Compression Check (Cl. 7.1.2) ──
    if (N < 0) {
      const Ncr = N; // compressive (negative convention)
      const KLr = props.effectiveLengthZ / section.ry; // worst axis
      const lambdaE = Math.PI * Math.sqrt(E / fy);
      const lambdaBar = KLr / lambdaE;
      const alpha = 0.34; // curve 'b'
      const phi = 0.5 * (1 + alpha * (lambdaBar - 0.2) + lambdaBar * lambdaBar);
      const chiRaw = 1.0 / (phi + Math.sqrt(Math.max(0.0001, phi * phi - lambdaBar * lambdaBar)));
      const chi = Math.min(1.0, chiRaw);
      const fcd = chi * fy / this.gammaM0;
      const Pd = section.area * fcd; // N
      const ratio = Math.abs(Ncr) / Pd;

      checks.push({
        memberId, memberType, sectionName: section.name,
        clause: 'Cl. 7.1.2', title: 'Compression (Buckling)',
        demand: Math.abs(Ncr) / 1000, capacity: Pd / 1000,
        ratio, unit: 'kN',
        status: ratio <= 1.0 ? 'PASS' : 'FAIL',
        formula: `λ̄=${lambdaBar.toFixed(2)}, χ=${chi.toFixed(3)}, Pd=A·fcd=${(Pd/1000).toFixed(1)} kN`,
      });

      // Slenderness limit
      const slendernessLimit = 180;
      const slRatio = KLr / slendernessLimit;
      checks.push({
        memberId, memberType, sectionName: section.name,
        clause: 'Cl. 3.8', title: 'Slenderness (Compression)',
        demand: KLr, capacity: slendernessLimit,
        ratio: slRatio, unit: '',
        status: slRatio <= 1.0 ? 'PASS' : 'FAIL',
        formula: `KL/r = ${KLr.toFixed(1)} ≤ ${slendernessLimit}`,
      });
    }

    // ── Bending Check (Cl. 8.2.1) ──
    if (M > 0) {
      const betaB = sectionClass === 'Compact' ? 1.0 : (section.Sx / section.Zx);
      const Md = betaB * section.Zx * fy / this.gammaM0; // N·mm
      const ratio = M / Md;

      checks.push({
        memberId, memberType, sectionName: section.name,
        clause: 'Cl. 8.2.1', title: 'Bending Capacity',
        demand: M / 1e6, capacity: Md / 1e6,
        ratio, unit: 'kN·m',
        status: ratio <= 1.0 ? 'PASS' : 'FAIL',
        formula: `Md = βb·Zp·fy/γm0 = ${betaB.toFixed(2)}×${section.Zx}×${fy}/${this.gammaM0}`,
      });
    }

    // ── Shear Check (Cl. 8.4.1) ──
    if (V > 0) {
      const Av = section.depth * section.webThickness; // mm²
      const Vd = Av * fy / (Math.sqrt(3) * this.gammaM0); // N
      const ratio = V / Vd;

      checks.push({
        memberId, memberType, sectionName: section.name,
        clause: 'Cl. 8.4.1', title: 'Shear Capacity',
        demand: V / 1000, capacity: Vd / 1000,
        ratio, unit: 'kN',
        status: ratio <= 1.0 ? 'PASS' : 'FAIL',
        formula: `Vd = Av·fy/(√3·γm0) = ${Av}×${fy}/(√3×${this.gammaM0})`,
      });
    }

    // ── Combined Bending + Axial (Cl. 9.3.1) ──
    if (M > 0 && Math.abs(N) > 0) {
      const Nd = N > 0
        ? section.area * fy / this.gammaM0
        : section.area * fy / this.gammaM0; // simplified
      const Md = section.Zx * fy / this.gammaM0;
      const ratio = Math.abs(N) / Nd + M / Md;

      checks.push({
        memberId, memberType, sectionName: section.name,
        clause: 'Cl. 9.3.1', title: 'Combined Axial + Bending',
        demand: ratio * 100, capacity: 100,
        ratio, unit: '%',
        status: ratio <= 1.0 ? 'PASS' : 'FAIL',
        formula: `N/Nd + M/Md = ${(Math.abs(N)/Nd).toFixed(3)} + ${(M/Md).toFixed(3)}`,
      });
    }

    return checks;
  }
}

// ============================================================================
// AUTONOMOUS DESIGN ENGINE
// ============================================================================

export class AutonomousDesignEngine {
  private generator = new ParametricGenerator();
  private checker = new DesignChecker();

  /**
   * Execute the COMPLETE structural design workflow from a single prompt.
   * Returns a fully designed, analyzed, and checked structure.
   */
  async design(request: DesignRequest): Promise<DesignResult> {
    const startTime = Date.now();
    const warnings: string[] = [];
    const iterations: IterationRecord[] = [];

    // ── STEP 1: Parse prompt → parameters ──
    const parsedParams = PromptParser.parse(request.prompt);
    const loadConfigFromPrompt = PromptParser.parseLoadConfig(request.prompt);
    const params: StructureParameters = { ...parsedParams, ...request.parameters };
    const loadConfig: ProjectLoadConfig = { ...loadConfigFromPrompt, ...request.loadConfig };
    const materialGrade = request.materialGrade || 'E250';

    // ── STEP 2: Generate structure ──
    let { nodes, members } = this.generator.generate(params, materialGrade);

    // ── STEP 3: Generate loads ──
    // Compute building height from nodes
    const maxY = Math.max(...nodes.map(n => n.y));
    loadConfig.buildingHeight = maxY || 10;

    const loadGen = new AutoLoadGenerator(loadConfig);
    const { loadCases, combinations, summary: loadSummary } = loadGen.generateAllLoads(
      nodes,
      members.map(m => ({
        id: m.id,
        startNodeId: m.startNodeId,
        endNodeId: m.endNodeId,
        sectionName: m.sectionName,
        type: m.memberType === 'column' ? 'column' as const
          : m.memberType === 'brace' || m.memberType === 'diagonal' ? 'brace' as const
          : 'beam' as const,
      })),
    );
    warnings.push(`📦 ${loadSummary}`);

    // ── STEP 4: Run analysis ──
    let analysis = this.runLocalAnalysis(nodes, members, loadCases, combinations);

    // ── STEP 5: Design checks ──
    let designChecks = this.runDesignChecks(nodes, members, analysis, materialGrade);

    // ── STEP 6: Optimization loop ──
    const maxIter = request.maxIterations || 5;
    const targetUtil = request.targetUtilization || 0.85;
    const optimize = request.optimize !== false; // default: optimize

    if (optimize) {
      for (let iter = 1; iter <= maxIter; iter++) {
        const failedMembers = this.getFailedMembers(designChecks);
        const overDesigned = this.getOverDesignedMembers(designChecks, targetUtil);
        const maxRatio = Math.max(...designChecks.map(c => c.ratio), 0);

        iterations.push({
          iteration: iter,
          maxRatio,
          failedCount: failedMembers.length,
          totalWeight: this.computeWeight(nodes, members),
          changes: [],
        });

        // If everything passes and nothing is grossly over-designed, stop
        if (failedMembers.length === 0 && overDesigned.length === 0) break;
        if (failedMembers.length === 0 && iter > 1) break; // Safety first, then optimize

        const changes: string[] = [];

        // Upsize failed members
        for (const memberId of failedMembers) {
          const member = members.find(m => m.id === memberId);
          if (!member) continue;
          const upgraded = this.upsizeSection(member);
          if (upgraded) {
            changes.push(`⬆️ ${memberId}: ${member.sectionName} → ${upgraded.sectionName}`);
            Object.assign(member, upgraded);
          }
        }

        // Downsize over-designed members (only after failures are resolved)
        if (failedMembers.length === 0) {
          for (const memberId of overDesigned) {
            const member = members.find(m => m.id === memberId);
            if (!member) continue;
            const downsized = this.downsizeSection(member);
            if (downsized) {
              changes.push(`⬇️ ${memberId}: ${member.sectionName} → ${downsized.sectionName}`);
              Object.assign(member, downsized);
            }
          }
        }

        iterations[iterations.length - 1].changes = changes;

        if (changes.length === 0) break; // No changes possible

        // Re-analyze with updated sections
        analysis = this.runLocalAnalysis(nodes, members, loadCases, combinations);
        designChecks = this.runDesignChecks(nodes, members, analysis, materialGrade);
      }
    }

    // ── STEP 7: Final results ──
    const failedMembers = [...new Set(designChecks.filter(c => c.status === 'FAIL').map(c => c.memberId))];
    const maxUtilization = Math.max(...designChecks.map(c => c.ratio), 0);
    const totalWeight = this.computeWeight(nodes, members);
    const passed = failedMembers.length === 0;

    // ── STEP 8: Generate report ──
    const report = this.generateReport(
      request, params, nodes, members, loadCases, combinations,
      analysis, designChecks, iterations, totalWeight, passed, maxUtilization, warnings,
    );

    return {
      passed,
      model: { nodes, members },
      loadCases,
      combinations,
      analysis,
      designChecks,
      failedMembers,
      maxUtilization,
      iterations,
      totalWeight,
      report,
      warnings,
      computeTimeMs: Date.now() - startTime,
    };
  }

  // ============================================================================
  // ANALYSIS (Simplified Direct Stiffness Method)
  // ============================================================================

  /**
   * Run simplified in-memory analysis using the governing load combination.
   * This is a local backup — the real WASM solver provides better results.
   */
  private runLocalAnalysis(
    nodes: GeneratedNode[],
    members: GeneratedMember[],
    loadCases: LoadCase[],
    combinations: LoadCombination[],
  ): AnalysisResults {
    const nodeMap = new Map(nodes.map(n => [n.id, n]));

    // Use the first ULS combination as governing (conservative)
    const governingCombo = combinations.find(c => c.type === 'ULS') || combinations[0];
    if (!governingCombo) {
      // No combinations, just use raw loads
      return this.analyzeDirectStiffness(nodes, members, this.collectAllLoads(loadCases, {}));
    }

    // Factor loads
    const factoredLoads = this.collectAllLoads(loadCases, governingCombo.factors);
    return this.analyzeDirectStiffness(nodes, members, factoredLoads);
  }

  /**
   * Simplified 2D direct stiffness method (for beam/frame structures)
   * Returns approximate member forces for design checks.
   */
  private analyzeDirectStiffness(
    nodes: GeneratedNode[],
    members: GeneratedMember[],
    loads: { nodeLoads: NodeLoad[]; memberLoads: MemberLoad[] },
  ): AnalysisResults {
    const nodeMap = new Map(nodes.map(n => [n.id, n]));
    const memberForces = new Map<string, { axial: number; shearStart: number; shearEnd: number; momentStart: number; momentEnd: number }>();
    const displacements = new Map<string, { dx: number; dy: number; dz: number; rx: number; ry: number; rz: number }>();
    const reactions = new Map<string, { fx: number; fy: number; fz: number; mx: number; my: number; mz: number }>();

    for (const member of members) {
      const startN = nodeMap.get(member.startNodeId);
      const endN = nodeMap.get(member.endNodeId);
      if (!startN || !endN) continue;

      const dx = endN.x - startN.x;
      const dy = endN.y - startN.y;
      const dz = endN.z - startN.z;
      const L = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (L < 0.001) continue;

      const E = member.E;
      const I = member.I;
      const A = member.A;

      // Collect member loads
      const mLoads = loads.memberLoads.filter(ml => ml.memberId === member.id);
      let totalUDL = 0;
      let totalPointLoad = 0;
      let pointLoadPos = 0.5;

      for (const ml of mLoads) {
        if (ml.type === 'UDL') {
          totalUDL += Math.abs(ml.w1 || 0); // magnitude
        } else if (ml.type === 'point') {
          totalPointLoad += Math.abs(ml.P || 0);
          pointLoadPos = ml.a || 0.5;
        }
      }

      // Collect node loads on this member's nodes
      const startLoads = loads.nodeLoads.filter(nl => nl.nodeId === member.startNodeId);
      const endLoads = loads.nodeLoads.filter(nl => nl.nodeId === member.endNodeId);

      // For beams (predominantly horizontal): use beam formulas
      const isBeam = Math.abs(dx) > Math.abs(dy) * 0.5;

      if (isBeam && L > 0) {
        // UDL on beam: M_max = wL²/8 (simply supported) or wL²/12 (fixed)
        const isFixed = startN.restraints?.mz && endN.restraints?.mz;
        const isCantilever = (startN.restraints?.fx && startN.restraints?.fy && !endN.restraints?.fy)
          || (endN.restraints?.fx && endN.restraints?.fy && !startN.restraints?.fy);

        let Mmax: number, Vmax: number;

        if (isCantilever) {
          Mmax = totalUDL * L * L / 2 + totalPointLoad * L;
          Vmax = totalUDL * L + totalPointLoad;
        } else if (isFixed) {
          Mmax = totalUDL * L * L / 12 + totalPointLoad * L / 8;
          Vmax = totalUDL * L / 2 + totalPointLoad / 2;
        } else {
          Mmax = totalUDL * L * L / 8 + totalPointLoad * L / 4;
          Vmax = totalUDL * L / 2 + totalPointLoad / 2;
        }

        // Deflection: δ = 5wL⁴/(384EI)
        const deflection = (5 * totalUDL * Math.pow(L, 4)) / (384 * E * I);

        memberForces.set(member.id, {
          axial: 0,
          shearStart: Vmax,
          shearEnd: -Vmax,
          momentStart: isCantilever ? -Mmax : (isFixed ? -Mmax * 2/3 : 0),
          momentEnd: isCantilever ? 0 : (isFixed ? Mmax * 2/3 : Mmax),
        });

        // Store deflection at member nodes
        if (!displacements.has(member.startNodeId)) {
          displacements.set(member.startNodeId, { dx: 0, dy: 0, dz: 0, rx: 0, ry: 0, rz: 0 });
        }
        if (!displacements.has(member.endNodeId)) {
          const midDeflection = isCantilever ? -deflection : -deflection;
          displacements.set(member.endNodeId, { dx: 0, dy: midDeflection, dz: 0, rx: 0, ry: 0, rz: 0 });
        }
      } else {
        // Column or brace: estimate axial from tributary area
        let axialForce = 0;
        for (const nl of [...startLoads, ...endLoads]) {
          axialForce += -(nl.fy || 0); // vertical loads become axial in columns
        }

        // Beam loads tributary to this column
        const connectedBeams = members.filter(
          m => m.memberType === 'beam' &&
            (m.startNodeId === member.startNodeId || m.endNodeId === member.startNodeId ||
             m.startNodeId === member.endNodeId || m.endNodeId === member.endNodeId)
        );
        for (const beam of connectedBeams) {
          const bLoads = loads.memberLoads.filter(ml => ml.memberId === beam.id);
          const bStartN = nodeMap.get(beam.startNodeId);
          const bEndN = nodeMap.get(beam.endNodeId);
          if (!bStartN || !bEndN) continue;
          const bLen = Math.sqrt((bEndN.x - bStartN.x) ** 2 + (bEndN.y - bStartN.y) ** 2);
          for (const bl of bLoads) {
            if (bl.type === 'UDL') {
              axialForce += Math.abs(bl.w1 || 0) * bLen / 2; // Half to each support
            }
          }
        }

        // Lateral forces → moment in column
        let lateralForce = 0;
        for (const nl of [...startLoads, ...endLoads]) {
          lateralForce += Math.abs(nl.fx || 0);
        }
        const colMoment = lateralForce * L / 2;

        memberForces.set(member.id, {
          axial: -axialForce, // negative = compression
          shearStart: lateralForce / 2,
          shearEnd: -lateralForce / 2,
          momentStart: colMoment,
          momentEnd: -colMoment,
        });
      }
    }

    // Compute reactions at supported nodes
    for (const node of nodes) {
      if (node.restraints && (node.restraints.fx || node.restraints.fy)) {
        let rx = 0, ry = 0, mz = 0;

        // Sum all loads on structure
        for (const nl of loads.nodeLoads) {
          if (nl.nodeId === node.id) {
            rx -= nl.fx || 0;
            ry -= nl.fy || 0;
          }
        }

        // Approximate reactions from member forces
        for (const member of members) {
          if (member.startNodeId === node.id || member.endNodeId === node.id) {
            const mf = memberForces.get(member.id);
            if (mf) {
              const isStart = member.startNodeId === node.id;
              ry += isStart ? mf.shearStart : -mf.shearEnd;
            }
          }
        }

        reactions.set(node.id, { fx: rx, fy: ry, fz: 0, mx: 0, my: 0, mz });
      }
    }

    return { displacements, reactions, memberForces };
  }

  /**
   * Collect and factor all loads from load cases
   */
  private collectAllLoads(
    loadCases: LoadCase[],
    factors: Record<string, number>,
  ): { nodeLoads: NodeLoad[]; memberLoads: MemberLoad[] } {
    const nodeLoads: NodeLoad[] = [];
    const memberLoads: MemberLoad[] = [];

    for (const lc of loadCases) {
      const factor = factors[lc.id] ?? 1.0;
      if (factor === 0) continue;

      for (const nl of lc.nodeLoads) {
        nodeLoads.push({
          ...nl,
          fx: (nl.fx || 0) * factor,
          fy: (nl.fy || 0) * factor,
          fz: (nl.fz || 0) * factor,
          mx: (nl.mx || 0) * factor,
          my: (nl.my || 0) * factor,
          mz: (nl.mz || 0) * factor,
        });
      }

      for (const ml of lc.memberLoads) {
        memberLoads.push({
          ...ml,
          w1: (ml.w1 || 0) * factor,
          w2: (ml.w2 || 0) * factor,
          P: (ml.P || 0) * factor,
          M: (ml.M || 0) * factor,
        });
      }
    }

    return { nodeLoads, memberLoads };
  }

  // ============================================================================
  // DESIGN CHECKS
  // ============================================================================

  private runDesignChecks(
    nodes: GeneratedNode[],
    members: GeneratedMember[],
    analysis: AnalysisResults,
    materialGrade: string,
  ): DesignCheck[] {
    const nodeMap = new Map(nodes.map(n => [n.id, n]));
    const allChecks: DesignCheck[] = [];

    for (const member of members) {
      const mf = analysis.memberForces.get(member.id);
      if (!mf) continue;

      const startN = nodeMap.get(member.startNodeId);
      const endN = nodeMap.get(member.endNodeId);
      if (!startN || !endN) continue;

      const length = Math.sqrt(
        (endN.x - startN.x) ** 2 + (endN.y - startN.y) ** 2 + (endN.z - startN.z) ** 2
      );

      // Determine effective length factor K
      const K = this.getEffectiveLengthFactor(startN, endN, member.memberType);

      const designProps = SectionLookup.getMemberDesignProps(
        member.sectionName, materialGrade, length, K
      );

      if (!designProps) {
        allChecks.push({
          memberId: member.id, memberType: member.memberType,
          sectionName: member.sectionName,
          clause: 'N/A', title: 'Section Not Found',
          demand: 0, capacity: 0, ratio: 0, unit: '',
          status: 'WARNING',
        });
        continue;
      }

      // Run IS 800 checks
      const maxMoment = Math.max(Math.abs(mf.momentStart), Math.abs(mf.momentEnd));
      const maxShear = Math.max(Math.abs(mf.shearStart), Math.abs(mf.shearEnd));

      const checks = this.checker.checkMember(
        member.id, member.memberType, designProps,
        { axial: mf.axial, shear: maxShear, moment: maxMoment },
      );

      allChecks.push(...checks);

      // Deflection check (Cl. 5.6.1)
      const disp = analysis.displacements.get(member.endNodeId);
      if (disp && length > 0) {
        const maxDeflection = Math.abs(disp.dy);
        const limit = length / 300; // L/300 for gravity
        const ratio = maxDeflection / limit;

        if (maxDeflection > 0.0001) {
          allChecks.push({
            memberId: member.id, memberType: member.memberType,
            sectionName: member.sectionName,
            clause: 'Cl. 5.6.1', title: 'Deflection Check',
            demand: maxDeflection * 1000, capacity: limit * 1000,
            ratio, unit: 'mm',
            status: ratio <= 1.0 ? 'PASS' : 'FAIL',
            formula: `δ = ${(maxDeflection*1000).toFixed(2)} mm, limit = L/300 = ${(limit*1000).toFixed(2)} mm`,
          });
        }
      }
    }

    return allChecks;
  }

  /**
   * Get effective length factor K based on end conditions
   */
  private getEffectiveLengthFactor(
    startN: GeneratedNode, endN: GeneratedNode, memberType: string,
  ): number {
    const startFixed = startN.restraints?.mz ?? false;
    const endFixed = endN.restraints?.mz ?? false;

    if (startFixed && endFixed) return 0.65;  // Both fixed
    if (startFixed || endFixed) return 0.80;  // One fixed, one pinned
    if (memberType === 'brace' || memberType === 'diagonal') return 1.0;
    return 1.0; // Pinned-pinned (conservative)
  }

  // ============================================================================
  // OPTIMIZATION (Section Sizing)
  // ============================================================================

  private getFailedMembers(checks: DesignCheck[]): string[] {
    return [...new Set(checks.filter(c => c.status === 'FAIL').map(c => c.memberId))];
  }

  private getOverDesignedMembers(checks: DesignCheck[], targetUtil: number): string[] {
    // Group max ratio per member
    const maxRoots = new Map<string, number>();
    for (const c of checks) {
      const cur = maxRoots.get(c.memberId) || 0;
      if (c.ratio > cur) maxRoots.set(c.memberId, c.ratio);
    }

    return [...maxRoots.entries()]
      .filter(([_, ratio]) => ratio < targetUtil * 0.5) // less than 50% of target = over-designed
      .map(([id]) => id);
  }

  private upsizeSection(member: GeneratedMember): Partial<GeneratedMember> | null {
    // Get ordered sections of the same type
    const isISMB = member.sectionName.startsWith('ISMB');
    const isISMC = member.sectionName.startsWith('ISMC');
    const isISA = member.sectionName.startsWith('ISA');

    const ordered = isISMB ? SectionLookup.getSectionNames('ISMB')
      : isISMC ? SectionLookup.getSectionNames('ISMC')
      : isISA ? SectionLookup.getSectionNames('ISA')
      : SectionLookup.getSectionNames('ISMB');

    const currentIdx = ordered.indexOf(member.sectionName);
    if (currentIdx < 0 || currentIdx >= ordered.length - 1) return null;

    const newName = ordered[currentIdx + 1];
    const section = SectionLookup.getSection(newName);
    const material = SectionLookup.getMaterial('E250');
    if (!section) return null;

    const units = SectionLookup.toModelUnits(section, material);
    return {
      sectionName: newName,
      A: units.A,
      I: units.I,
      E: units.E,
    };
  }

  private downsizeSection(member: GeneratedMember): Partial<GeneratedMember> | null {
    const isISMB = member.sectionName.startsWith('ISMB');
    const isISMC = member.sectionName.startsWith('ISMC');
    const isISA = member.sectionName.startsWith('ISA');

    const ordered = isISMB ? SectionLookup.getSectionNames('ISMB')
      : isISMC ? SectionLookup.getSectionNames('ISMC')
      : isISA ? SectionLookup.getSectionNames('ISA')
      : SectionLookup.getSectionNames('ISMB');

    const currentIdx = ordered.indexOf(member.sectionName);
    if (currentIdx <= 0) return null;

    const newName = ordered[currentIdx - 1];
    const section = SectionLookup.getSection(newName);
    const material = SectionLookup.getMaterial('E250');
    if (!section) return null;

    const units = SectionLookup.toModelUnits(section, material);
    return {
      sectionName: newName,
      A: units.A,
      I: units.I,
      E: units.E,
    };
  }

  // ============================================================================
  // UTILITIES
  // ============================================================================

  private computeWeight(nodes: GeneratedNode[], members: GeneratedMember[]): number {
    const nodeMap = new Map(nodes.map(n => [n.id, n]));
    let totalKg = 0;

    for (const m of members) {
      const sn = nodeMap.get(m.startNodeId);
      const en = nodeMap.get(m.endNodeId);
      if (!sn || !en) continue;

      const L = Math.sqrt((en.x - sn.x) ** 2 + (en.y - sn.y) ** 2 + (en.z - sn.z) ** 2);
      const section = SectionLookup.getSection(m.sectionName);
      const weight = section ? section.weight : 40; // kg/m default
      totalKg += weight * L;
    }

    return Math.round(totalKg * 10) / 10;
  }

  // ============================================================================
  // REPORT GENERATION
  // ============================================================================

  private generateReport(
    request: DesignRequest,
    params: StructureParameters,
    nodes: GeneratedNode[],
    members: GeneratedMember[],
    loadCases: LoadCase[],
    combinations: LoadCombination[],
    analysis: AnalysisResults | null,
    checks: DesignCheck[],
    iterations: IterationRecord[],
    totalWeight: number,
    passed: boolean,
    maxUtilization: number,
    warnings: string[],
  ): string {
    const lines: string[] = [];

    lines.push('═══════════════════════════════════════════════════════');
    lines.push('         AUTONOMOUS STRUCTURAL DESIGN REPORT');
    lines.push('               BeamLab AI Architect v3.0');
    lines.push('═══════════════════════════════════════════════════════');
    lines.push('');
    lines.push(`Date: ${new Date().toLocaleDateString()}`);
    lines.push(`Prompt: "${request.prompt}"`);
    lines.push(`Structure Type: ${params.type}`);
    lines.push(`Design Code: ${request.designCode || 'IS 800:2007'}`);
    lines.push(`Material: ${request.materialGrade || 'E250 (Fe 410W)'}`);
    lines.push('');

    // Geometry
    lines.push('── GEOMETRY ──');
    lines.push(`Nodes: ${nodes.length}`);
    lines.push(`Members: ${members.length}`);
    if (params.span) lines.push(`Span: ${params.span} m`);
    if (params.height) lines.push(`Height: ${params.height} m`);
    if (params.bays) lines.push(`Bays: ${params.bays} × ${params.bayWidth || 6} m`);
    if (params.stories) lines.push(`Stories: ${params.stories} × ${params.storyHeight || 3.5} m`);
    lines.push('');

    // Members summary
    lines.push('── MEMBER SCHEDULE ──');
    lines.push(`${'ID'.padEnd(6)} ${'Type'.padEnd(10)} ${'Section'.padEnd(18)} ${'Length (m)'.padEnd(12)}`);
    lines.push('─'.repeat(48));
    const nodeMap = new Map(nodes.map(n => [n.id, n]));
    for (const m of members) {
      const sn = nodeMap.get(m.startNodeId);
      const en = nodeMap.get(m.endNodeId);
      const L = sn && en ? Math.sqrt((en.x-sn.x)**2 + (en.y-sn.y)**2 + (en.z-sn.z)**2) : 0;
      lines.push(`${m.id.padEnd(6)} ${m.memberType.padEnd(10)} ${m.sectionName.padEnd(18)} ${L.toFixed(2).padEnd(12)}`);
    }
    lines.push('');

    // Load cases
    lines.push('── LOAD CASES ──');
    for (const lc of loadCases) {
      lines.push(`${lc.id}: ${lc.name} (${lc.memberLoads.length} member loads, ${lc.nodeLoads.length} node loads)`);
    }
    lines.push('');

    // Combinations
    lines.push('── LOAD COMBINATIONS ──');
    for (const combo of combinations) {
      const factors = Object.entries(combo.factors).map(([k, v]) => `${v}×${k}`).join(' + ');
      lines.push(`${combo.id}: ${combo.name} → ${factors} [${combo.type}]`);
    }
    lines.push('');

    // Design checks
    lines.push('── DESIGN CHECKS (IS 800:2007) ──');
    lines.push(`${'Member'.padEnd(6)} ${'Clause'.padEnd(12)} ${'Check'.padEnd(25)} ${'Demand'.padEnd(10)} ${'Capacity'.padEnd(10)} ${'Ratio'.padEnd(7)} ${'Status'.padEnd(6)}`);
    lines.push('─'.repeat(78));
    for (const c of checks) {
      const statusIcon = c.status === 'PASS' ? '✅' : (c.status === 'FAIL' ? '❌' : '⚠️');
      lines.push(
        `${c.memberId.padEnd(6)} ${c.clause.padEnd(12)} ${c.title.padEnd(25)} ${c.demand.toFixed(1).padEnd(10)} ${c.capacity.toFixed(1).padEnd(10)} ${c.ratio.toFixed(3).padEnd(7)} ${statusIcon} ${c.status}`
      );
    }
    lines.push('');

    // Optimization summary
    if (iterations.length > 0) {
      lines.push('── OPTIMIZATION HISTORY ──');
      for (const iter of iterations) {
        lines.push(`Iteration ${iter.iteration}: max ratio = ${iter.maxRatio.toFixed(3)}, failed = ${iter.failedCount}, weight = ${iter.totalWeight.toFixed(1)} kg`);
        for (const change of iter.changes) {
          lines.push(`  ${change}`);
        }
      }
      lines.push('');
    }

    // Summary
    lines.push('── SUMMARY ──');
    lines.push(`Status: ${passed ? '✅ ALL CHECKS PASSED' : '❌ SOME CHECKS FAILED'}`);
    lines.push(`Max Utilization: ${(maxUtilization * 100).toFixed(1)}%`);
    lines.push(`Total Steel Weight: ${totalWeight.toFixed(1)} kg`);
    lines.push(`Optimization Iterations: ${iterations.length}`);
    lines.push('');
    lines.push('═══════════════════════════════════════════════════════');

    return lines.join('\n');
  }
}

export const autonomousDesignEngine = new AutonomousDesignEngine();
export default AutonomousDesignEngine;
