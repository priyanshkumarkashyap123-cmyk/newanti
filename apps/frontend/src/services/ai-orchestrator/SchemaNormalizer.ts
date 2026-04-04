/**
 * ============================================================================
 * SCHEMA NORMALIZER
 * ============================================================================
 * 
 * Unifies all structure data formats across backends into a single
 * normalized schema. Handles:
 * - Node.js backend (s/e format)
 * - Python backend (start_node/end_node format)
 * - Frontend (startNodeId/endNodeId format)
 * - Legacy formats (startNode/endNode)
 * 
 * @version 1.0.0
 */

import type {
  NormalizedNode,
  NormalizedMember,
  NormalizedLoad,
  NormalizedSupport,
  NormalizedMaterial,
  NormalizedSection,
  NormalizedStructureData,
  AIProviderType,
  MemberRelease,
} from './types';

// ============================================================================
// RAW DATA SHAPES (all known formats from different backends)
// ============================================================================

interface RawNode {
  id?: string;
  node_id?: string;
  x: number;
  y: number;
  z?: number;
  label?: string;
  hasSupport?: boolean;
  has_support?: boolean;
  restraint?: boolean[] | Record<string, boolean>;
  support?: Partial<RawSupport>;
}

interface RawMember {
  id?: string;
  member_id?: string;
  // All possible naming conventions
  startNodeId?: string;
  endNodeId?: string;
  start_node_id?: string;
  end_node_id?: string;
  startNode?: string;
  endNode?: string;
  start_node?: string;
  end_node?: string;
  s?: string;  // Shortest format from Node.js backend
  e?: string;
  start?: string;
  end?: string;
  node1?: string;
  node2?: string;
  nodeI?: string;
  nodeJ?: string;
  i_node?: string;
  j_node?: string;
  // Properties
  type?: string;
  section?: string;
  sectionId?: string;
  section_id?: string;
  material?: string;
  materialId?: string;
  material_id?: string;
  releases?: MemberRelease | boolean[] | Record<string, boolean>;
}

interface RawLoad {
  id?: string;
  load_id?: string;
  type?: string;
  targetId?: string;
  target_id?: string;
  nodeId?: string;
  node_id?: string;
  memberId?: string;
  member_id?: string;
  targetType?: string;
  target_type?: string;
  values?: number[];
  value?: number;
  fx?: number;
  fy?: number;
  fz?: number;
  mx?: number;
  my?: number;
  mz?: number;
  w?: number; // distributed load per unit length
  w1?: number;
  w2?: number;
  direction?: string;
  loadCase?: string;
  load_case?: string;
  loadCombination?: string;
  load_combination?: string;
}

interface RawSupport {
  nodeId?: string;
  node_id?: string;
  id?: string;
  type?: string;
  restraints?: boolean[] | Record<string, boolean>;
  dx?: boolean;
  dy?: boolean;
  dz?: boolean;
  rx?: boolean;
  ry?: boolean;
  rz?: boolean;
  springStiffness?: number[];
  spring_stiffness?: number[];
}

interface RawMaterial {
  id?: string;
  material_id?: string;
  name?: string;
  type?: string;
  E?: number;
  youngs_modulus?: number;
  elastic_modulus?: number;
  G?: number;
  shear_modulus?: number;
  fy?: number;
  yield_strength?: number;
  fu?: number;
  ultimate_strength?: number;
  density?: number;
  poisson?: number;
  poisson_ratio?: number;
  nu?: number;
  alpha?: number;
  thermal_expansion?: number;
}

interface RawSection {
  id?: string;
  section_id?: string;
  name?: string;
  type?: string;
  area?: number;
  A?: number;
  Ixx?: number;
  Ix?: number;
  I_xx?: number;
  Iyy?: number;
  Iy?: number;
  I_yy?: number;
  Izz?: number;
  Iz?: number;
  Sx?: number;
  Zx?: number;
  ry?: number;
  rz?: number;
  depth?: number;
  d?: number;
  width?: number;
  bf?: number;
  b?: number;
  tw?: number;
  tf?: number;
}

interface RawStructureInput {
  nodes?: RawNode[];
  members?: RawMember[];
  elements?: RawMember[];
  loads?: RawLoad[];
  supports?: RawSupport[];
  materials?: RawMaterial[];
  sections?: RawSection[];
  type?: string;
  structure_type?: string;
  description?: string;
}

// ============================================================================
// NORMALIZER CLASS
// ============================================================================

export class SchemaNormalizer {
  private nodeIdCounter = 0;
  private memberIdCounter = 0;
  private loadIdCounter = 0;

  /**
   * Normalize a complete structure from any backend format
   */
  normalizeStructure(
    raw: RawStructureInput,
    source: AIProviderType = 'mock'
  ): NormalizedStructureData {
    this.resetCounters();

    const nodes = this.normalizeNodes(raw.nodes || []);
    const members = this.normalizeMembers(raw.members || raw.elements || []);
    const loads = this.normalizeLoads(raw.loads || []);
    const supports = this.normalizeSupports(raw.supports || [], raw.nodes || []);
    const materials = this.normalizeMaterials(raw.materials || []);
    const sections = this.normalizeSections(raw.sections || []);

    // Auto-detect type from structure
    const structureType = raw.type || raw.structure_type || this.inferStructureType(nodes, members);

    const result: NormalizedStructureData = {
      type: structureType,
      nodes,
      members,
      loads,
      supports,
      materials,
      sections,
      metadata: {
        generatedBy: source,
        generatedAt: new Date(),
        confidence: 0.8,
        validationPassed: false,
        warnings: [],
        structureDescription: raw.description || raw.type || 'Unknown structure',
      },
    };

    // Validate and attach warnings
    const validation = this.validateStructure(result);
    result.metadata.validationPassed = validation.valid;
    result.metadata.warnings = validation.warnings;

    return result;
  }

  // ============================================================================
  // NODE NORMALIZATION
  // ============================================================================

  normalizeNodes(rawNodes: RawNode[]): NormalizedNode[] {
    if (!Array.isArray(rawNodes)) return [];

    return rawNodes.map((raw, idx) => ({
      id: String(raw.id || raw.node_id || `N${idx + 1}`),
      x: Number(raw.x) || 0,
      y: Number(raw.y) || 0,
      z: Number(raw.z) || 0,
      label: raw.label || undefined,
      restraint: raw.restraint ? this.normalizeRestraintObject(raw.restraint) : undefined,
    }));
  }

  // ============================================================================
  // MEMBER NORMALIZATION
  // ============================================================================

  normalizeMembers(rawMembers: RawMember[]): NormalizedMember[] {
    if (!Array.isArray(rawMembers)) return [];

    return rawMembers.map((raw, idx) => {
      const startNodeId = this.extractStartNode(raw);
      const endNodeId = this.extractEndNode(raw);

      return {
        id: String(raw.id || raw.member_id || `M${idx + 1}`),
        startNodeId,
        endNodeId,
        type: this.normalizeMemberType(raw.type),
        sectionId: raw.section || raw.sectionId || raw.section_id || undefined,
        materialId: raw.material || raw.materialId || raw.material_id || undefined,
        releases: raw.releases ? this.normalizeReleases(raw.releases) : undefined,
      };
    });
  }

  private normalizeReleases(releases: MemberRelease | boolean[] | Record<string, boolean>): MemberRelease | undefined {
    if ('startRelease' in releases || 'endRelease' in releases) {
      return releases as MemberRelease;
    }
    if (Array.isArray(releases)) {
      return {
        startRelease: {
          dx: !!releases[0], dy: !!releases[1], dz: !!releases[2],
          rx: !!releases[3], ry: !!releases[4], rz: !!releases[5],
        },
        endRelease: {
          dx: !!releases[6], dy: !!releases[7], dz: !!releases[8],
          rx: !!releases[9], ry: !!releases[10], rz: !!releases[11],
        },
      };
    }
    return undefined;
  }

  private extractStartNode(raw: RawMember): string {
    return String(
      raw.startNodeId ||
      raw.start_node_id ||
      raw.startNode ||
      raw.start_node ||
      raw.s ||
      raw.start ||
      raw.node1 ||
      raw.nodeI ||
      raw.i_node ||
      'unknown'
    );
  }

  private extractEndNode(raw: RawMember): string {
    return String(
      raw.endNodeId ||
      raw.end_node_id ||
      raw.endNode ||
      raw.end_node ||
      raw.e ||
      raw.end ||
      raw.node2 ||
      raw.nodeJ ||
      raw.j_node ||
      'unknown'
    );
  }

  private normalizeMemberType(type?: string): NormalizedMember['type'] {
    if (!type) return 'other';
    const t = type.toLowerCase().replace(/[_\s-]/g, '');
    if (t.includes('column') || t.includes('col')) return 'column';
    if (t.includes('beam') || t.includes('girder')) return 'beam';
    if (t.includes('brace') || t.includes('bracing')) return 'brace';
    if (t.includes('chord')) return 'truss-chord';
    if (t.includes('diagonal') || t.includes('diag')) return 'truss-diagonal';
    if (t.includes('vertical') || t.includes('vert')) return 'truss-vertical';
    if (t.includes('cable') || t.includes('tendon')) return 'cable';
    return 'other';
  }

  // ============================================================================
  // LOAD NORMALIZATION
  // ============================================================================

  normalizeLoads(rawLoads: RawLoad[]): NormalizedLoad[] {
    if (!Array.isArray(rawLoads)) return [];

    return rawLoads.map((raw, idx) => {
      const targetId = raw.targetId || raw.target_id || raw.nodeId || raw.node_id || raw.memberId || raw.member_id || '';
      const targetType = this.inferLoadTargetType(raw);
      const type = this.normalizeLoadType(raw.type);
      const values = this.extractLoadValues(raw);

      return {
        id: String(raw.id || raw.load_id || `L${idx + 1}`),
        type,
        targetType,
        targetId: String(targetId),
        values,
        direction: (raw.direction as NormalizedLoad['direction']) || undefined,
        loadCase: raw.loadCase || raw.load_case || 'Default',
        loadCombination: raw.loadCombination || raw.load_combination || undefined,
      };
    });
  }

  private inferLoadTargetType(raw: RawLoad): 'node' | 'member' | 'global' {
    if (raw.targetType || raw.target_type) {
      const tt = (raw.targetType || raw.target_type || '').toLowerCase();
      if (tt.includes('node')) return 'node';
      if (tt.includes('member') || tt.includes('element')) return 'member';
      if (tt.includes('global')) return 'global';
    }
    if (raw.nodeId || raw.node_id) return 'node';
    if (raw.memberId || raw.member_id) return 'member';
    return 'node'; // Default
  }

  private normalizeLoadType(type?: string): NormalizedLoad['type'] {
    if (!type) return 'point';
    const t = type.toLowerCase().replace(/[_\s-]/g, '');
    if (t.includes('distributed') || t.includes('udl') || t.includes('uniform')) return 'distributed';
    if (t.includes('moment') || t.includes('couple')) return 'moment';
    if (t.includes('temperature') || t.includes('thermal')) return 'temperature';
    if (t.includes('prestress')) return 'prestress';
    return 'point';
  }

  private extractLoadValues(raw: RawLoad): number[] {
    if (raw.values && Array.isArray(raw.values)) return raw.values;
    if (raw.value !== undefined) return [raw.value];

    const values: number[] = [];
    if (raw.fx !== undefined) values.push(raw.fx);
    if (raw.fy !== undefined) values.push(raw.fy);
    if (raw.fz !== undefined) values.push(raw.fz);
    if (values.length > 0) return values;

    if (raw.w !== undefined) return [raw.w];
    if (raw.w1 !== undefined && raw.w2 !== undefined) return [raw.w1, raw.w2];

    return [0];
  }

  // ============================================================================
  // SUPPORT NORMALIZATION
  // ============================================================================

  normalizeSupports(rawSupports: RawSupport[], rawNodes?: RawNode[]): NormalizedSupport[] {
    const supports: NormalizedSupport[] = [];

    // From explicit support array
    if (Array.isArray(rawSupports)) {
      for (const raw of rawSupports) {
        supports.push(this.normalizeSingleSupport(raw));
      }
    }

    // Also extract supports embedded in nodes (hasSupport flag)
    if (Array.isArray(rawNodes)) {
      for (const node of rawNodes) {
        if ((node.hasSupport || node.has_support) && node.support) {
          const nodeId = String(node.id || node.node_id);
          const existingIdx = supports.findIndex(s => s.nodeId === nodeId);
          if (existingIdx < 0) {
            supports.push(this.normalizeSingleSupport({ ...node.support, nodeId }));
          }
        }
      }
    }

    return supports;
  }

  private normalizeSingleSupport(raw: RawSupport): NormalizedSupport {
    const nodeId = String(raw.nodeId || raw.node_id || raw.id || 'unknown');
    const type = this.normalizeSupportType(raw.type);
    const restraints = this.extractRestraints(raw, type);

    return {
      nodeId,
      type,
      restraints,
      springStiffness: raw.springStiffness || raw.spring_stiffness || undefined,
    };
  }

  private normalizeSupportType(type?: string): NormalizedSupport['type'] {
    if (!type) return 'fixed';
    const t = type.toLowerCase().replace(/[_\s-]/g, '');
    if (t.includes('fixed') || t.includes('encastre') || t.includes('clamp')) return 'fixed';
    if (t.includes('pin') || t.includes('hinge')) return 'pinned';
    if (t.includes('roller')) return 'roller';
    if (t.includes('spring')) return 'spring';
    return 'custom';
  }

  private extractRestraints(raw: RawSupport, type: NormalizedSupport['type']): NormalizedSupport['restraints'] {
    // If explicit boolean object
    if (raw.dx !== undefined || raw.dy !== undefined) {
      return {
        dx: raw.dx ?? false,
        dy: raw.dy ?? false,
        dz: raw.dz ?? false,
        rx: raw.rx ?? false,
        ry: raw.ry ?? false,
        rz: raw.rz ?? false,
      };
    }

    // If array format [dx, dy, dz, rx, ry, rz]
    if (Array.isArray(raw.restraints)) {
      return {
        dx: !!raw.restraints[0],
        dy: !!raw.restraints[1],
        dz: !!raw.restraints[2],
        rx: !!raw.restraints[3],
        ry: !!raw.restraints[4],
        rz: !!raw.restraints[5],
      };
    }

    // If object format { dx: true, ... }
    if (raw.restraints && typeof raw.restraints === 'object') {
      const r = raw.restraints as Record<string, boolean>;
      return {
        dx: !!r.dx,
        dy: !!r.dy,
        dz: !!r.dz,
        rx: !!r.rx,
        ry: !!r.ry,
        rz: !!r.rz,
      };
    }

    // Infer from type
    return this.getDefaultRestraints(type);
  }

  private getDefaultRestraints(type: NormalizedSupport['type']): NormalizedSupport['restraints'] {
    switch (type) {
      case 'fixed':
        return { dx: true, dy: true, dz: true, rx: true, ry: true, rz: true };
      case 'pinned':
        return { dx: true, dy: true, dz: true, rx: false, ry: false, rz: false };
      case 'roller':
        return { dx: false, dy: true, dz: false, rx: false, ry: false, rz: false };
      default:
        return { dx: false, dy: false, dz: false, rx: false, ry: false, rz: false };
    }
  }

  // ============================================================================
  // MATERIAL NORMALIZATION
  // ============================================================================

  normalizeMaterials(rawMaterials: RawMaterial[]): NormalizedMaterial[] {
    if (!Array.isArray(rawMaterials)) return [];

    return rawMaterials.map((raw, idx) => ({
      id: String(raw.id || raw.material_id || `MAT${idx + 1}`),
      name: raw.name || 'Unknown Material',
      type: this.normalizeMaterialType(raw.type || raw.name),
      E: raw.E || raw.youngs_modulus || raw.elastic_modulus || 200e9,
      G: raw.G || raw.shear_modulus || undefined,
      fy: raw.fy || raw.yield_strength || undefined,
      fu: raw.fu || raw.ultimate_strength || undefined,
      density: raw.density || undefined,
      poisson: raw.poisson || raw.poisson_ratio || raw.nu || undefined,
      alpha: raw.alpha || raw.thermal_expansion || undefined,
    }));
  }

  private normalizeMaterialType(type?: string): NormalizedMaterial['type'] {
    if (!type) return 'steel';
    const t = type.toLowerCase();
    if (t.includes('steel') || t.includes('fe')) return 'steel';
    if (t.includes('concrete') || t.includes('rcc')) return 'concrete';
    if (t.includes('timber') || t.includes('wood')) return 'timber';
    if (t.includes('alum')) return 'aluminum';
    return 'custom';
  }

  // ============================================================================
  // SECTION NORMALIZATION
  // ============================================================================

  normalizeSections(rawSections: RawSection[]): NormalizedSection[] {
    if (!Array.isArray(rawSections)) return [];

    return rawSections.map((raw, idx) => ({
      id: String(raw.id || raw.section_id || `SEC${idx + 1}`),
      name: raw.name || 'Unknown Section',
      type: this.normalizeSectionType(raw.type || raw.name),
      area: raw.area || raw.A || 0,
      Ixx: raw.Ixx || raw.Ix || raw.I_xx || 0,
      Iyy: raw.Iyy || raw.Iy || raw.I_yy || 0,
      Izz: raw.Izz || raw.Iz || undefined,
      Sx: raw.Sx || undefined,
      Zx: raw.Zx || undefined,
      ry: raw.ry || undefined,
      rz: raw.rz || undefined,
      depth: raw.depth || raw.d || undefined,
      width: raw.width || raw.bf || raw.b || undefined,
      tw: raw.tw || undefined,
      tf: raw.tf || undefined,
    }));
  }

  private normalizeSectionType(type?: string): NormalizedSection['type'] {
    if (!type) return 'custom';
    const t = type.toLowerCase();
    if (t.includes('ismb') || t.includes('w ') || t.includes('ipb') || t.match(/^i\b/)) return 'I';
    if (t.includes('ishb') || t.match(/^h\b/)) return 'H';
    if (t.includes('ismc') || t.match(/^c\b/)) return 'C';
    if (t.includes('isl') || t.includes('angle')) return 'L';
    if (t.includes('tee') || t.match(/^t\b/)) return 'T';
    if (t.includes('pipe') || t.includes('hss round') || t.includes('chs')) return 'pipe';
    if (t.includes('box') || t.includes('rhs') || t.includes('shs') || t.includes('hss')) return 'box';
    if (t.includes('rect')) return 'rectangular';
    if (t.includes('circ')) return 'circular';
    return 'custom';
  }

  // ============================================================================
  // STRUCTURE INFERENCE
  // ============================================================================

  private inferStructureType(nodes: NormalizedNode[], members: NormalizedMember[]): string {
    if (members.length === 0) return 'unknown';

    const hasColumns = members.some(m => m.type === 'column');
    const hasBeams = members.some(m => m.type === 'beam');
    const hasTrussElements = members.some(m =>
      m.type === 'truss-chord' || m.type === 'truss-diagonal' || m.type === 'truss-vertical'
    );

    if (hasTrussElements) return 'truss';
    if (hasColumns && hasBeams) {
      const maxY = Math.max(...nodes.map(n => n.y));
      const minY = Math.min(...nodes.map(n => n.y));
      const levels = new Set(nodes.map(n => Math.round(n.y * 100) / 100)).size;
      if (levels > 3) return 'multi_story_building';
      if (levels === 3) return 'portal_frame';
      return 'frame';
    }
    if (hasBeams && !hasColumns) return 'beam';
    return 'frame';
  }

  // ============================================================================
  // VALIDATION
  // ============================================================================

  validateStructure(structure: NormalizedStructureData): { valid: boolean; warnings: string[]; errors: string[] } {
    const warnings: string[] = [];
    const errors: string[] = [];

    // Check for empty structure
    if (structure.nodes.length === 0) {
      errors.push('Structure has no nodes');
    }
    if (structure.members.length === 0) {
      errors.push('Structure has no members');
    }

    // Check node references in members
    const nodeIds = new Set(structure.nodes.map(n => n.id));
    for (const member of structure.members) {
      if (!nodeIds.has(member.startNodeId)) {
        errors.push(`Member ${member.id} references non-existent start node ${member.startNodeId}`);
      }
      if (!nodeIds.has(member.endNodeId)) {
        errors.push(`Member ${member.id} references non-existent end node ${member.endNodeId}`);
      }
      if (member.startNodeId === member.endNodeId) {
        errors.push(`Member ${member.id} has same start and end node ${member.startNodeId}`);
      }
    }

    // Check for duplicate node IDs
    const seenNodeIds = new Set<string>();
    for (const node of structure.nodes) {
      if (seenNodeIds.has(node.id)) {
        warnings.push(`Duplicate node ID: ${node.id}`);
      }
      seenNodeIds.add(node.id);
    }

    // Check for coincident nodes
    for (let i = 0; i < structure.nodes.length; i++) {
      for (let j = i + 1; j < structure.nodes.length; j++) {
        const dist = Math.sqrt(
          (structure.nodes[i].x - structure.nodes[j].x) ** 2 +
          (structure.nodes[i].y - structure.nodes[j].y) ** 2 +
          (structure.nodes[i].z - structure.nodes[j].z) ** 2
        );
        if (dist < 0.001) {
          warnings.push(
            `Nodes ${structure.nodes[i].id} and ${structure.nodes[j].id} are coincident (distance: ${dist.toFixed(6)}m)`
          );
        }
      }
    }

    // Check supports exist
    if (structure.supports.length === 0) {
      warnings.push('Structure has no supports - may be unstable');
    }

    // Check support node references
    for (const support of structure.supports) {
      if (!nodeIds.has(support.nodeId)) {
        errors.push(`Support references non-existent node ${support.nodeId}`);
      }
    }

    // Check load target references
    const memberIds = new Set(structure.members.map(m => m.id));
    for (const load of structure.loads) {
      if (load.targetType === 'node' && !nodeIds.has(load.targetId)) {
        warnings.push(`Load ${load.id} targets non-existent node ${load.targetId}`);
      }
      if (load.targetType === 'member' && !memberIds.has(load.targetId)) {
        warnings.push(`Load ${load.id} targets non-existent member ${load.targetId}`);
      }
    }

    // Zero-length member check
    for (const member of structure.members) {
      const startNode = structure.nodes.find(n => n.id === member.startNodeId);
      const endNode = structure.nodes.find(n => n.id === member.endNodeId);
      if (startNode && endNode) {
        const length = Math.sqrt(
          (endNode.x - startNode.x) ** 2 +
          (endNode.y - startNode.y) ** 2 +
          (endNode.z - startNode.z) ** 2
        );
        if (length < 0.01) {
          errors.push(`Member ${member.id} has near-zero length (${length.toFixed(4)}m)`);
        }
        if (length > 100) {
          warnings.push(`Member ${member.id} has unusually long span (${length.toFixed(1)}m)`);
        }
      }
    }

    return {
      valid: errors.length === 0,
      warnings,
      errors,
    };
  }

  // ============================================================================
  // HELPERS
  // ============================================================================

  private normalizeRestraintObject(restraint: boolean[] | Record<string, boolean>): NormalizedNode['restraint'] {
    if (Array.isArray(restraint)) {
      return {
        dx: !!restraint[0],
        dy: !!restraint[1],
        dz: !!restraint[2],
        rx: !!restraint[3],
        ry: !!restraint[4],
        rz: !!restraint[5],
      };
    }
    if (typeof restraint === 'object') {
      return {
        dx: !!restraint.dx,
        dy: !!restraint.dy,
        dz: !!restraint.dz,
        rx: !!restraint.rx,
        ry: !!restraint.ry,
        rz: !!restraint.rz,
      };
    }
    return undefined;
  }

  private resetCounters(): void {
    this.nodeIdCounter = 0;
    this.memberIdCounter = 0;
    this.loadIdCounter = 0;
  }

  /**
   * Convert normalized structure back to a specific backend format
   */
  denormalize(structure: NormalizedStructureData, targetFormat: 'nodejs' | 'python' | 'frontend'): Record<string, unknown> {
    switch (targetFormat) {
      case 'nodejs':
        return this.denormalizeForNodeJS(structure);
      case 'python':
        return this.denormalizeForPython(structure);
      case 'frontend':
      default:
        return this.denormalizeForFrontend(structure);
    }
  }

  private denormalizeForNodeJS(s: NormalizedStructureData): Record<string, unknown> {
    return {
      type: s.type,
      nodes: s.nodes.map(n => ({ id: n.id, x: n.x, y: n.y, z: n.z })),
      members: s.members.map(m => ({ id: m.id, s: m.startNodeId, e: m.endNodeId, section: m.sectionId })),
      loads: s.loads,
      supports: s.supports.map(sup => ({
        nodeId: sup.nodeId,
        type: sup.type,
        restraints: [sup.restraints.dx, sup.restraints.dy, sup.restraints.dz, sup.restraints.rx, sup.restraints.ry, sup.restraints.rz],
      })),
    };
  }

  private denormalizeForPython(s: NormalizedStructureData): Record<string, unknown> {
    return {
      type: s.type,
      nodes: s.nodes.map(n => ({ id: n.id, x: n.x, y: n.y, z: n.z })),
      members: s.members.map(m => ({ id: m.id, start_node: m.startNodeId, end_node: m.endNodeId, section: m.sectionId })),
      loads: s.loads,
      supports: s.supports.map(sup => ({
        node_id: sup.nodeId,
        type: sup.type,
        restraints: [sup.restraints.dx, sup.restraints.dy, sup.restraints.dz, sup.restraints.rx, sup.restraints.ry, sup.restraints.rz],
      })),
    };
  }

  private denormalizeForFrontend(s: NormalizedStructureData): Record<string, unknown> {
    return {
      type: s.type,
      nodes: s.nodes.map(n => ({ id: n.id, x: n.x, y: n.y, z: n.z, label: n.label })),
      members: s.members.map(m => ({
        id: m.id,
        startNodeId: m.startNodeId,
        endNodeId: m.endNodeId,
        type: m.type,
        section: m.sectionId,
        material: m.materialId,
      })),
      loads: s.loads.map(l => ({
        id: l.id,
        type: l.type,
        targetType: l.targetType,
        targetId: l.targetId,
        values: l.values,
        loadCase: l.loadCase,
      })),
      supports: s.supports.map(sup => ({
        nodeId: sup.nodeId,
        type: sup.type,
        restraints: sup.restraints,
      })),
      materials: s.materials,
      sections: s.sections,
    };
  }
}

// ============================================================================
// SINGLETON
// ============================================================================

export const schemaNormalizer = new SchemaNormalizer();
