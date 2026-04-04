/**
 * AdvancedModelingEngine.ts - Professional Structural Modeling System
 * 
 * Features:
 * - Comprehensive node and element management
 * - Automatic mesh generation
 * - Load pattern management
 * - Member end releases (partial fixity)
 * - Rigid zones and offsets
 * - Mass distribution for dynamic analysis
 * - Model validation and debugging
 * 
 * Based on STAAD.Pro, SAP2000, ETABS modeling paradigms
 */

import * as THREE from 'three';

// ============================================
// TYPE DEFINITIONS
// ============================================

export interface ModelNode {
  id: string;
  x: number;
  y: number;
  z: number;
  restraints: NodeRestraint;
  mass?: NodeMass;
  masterNode?: string; // For rigid links
  slaveType?: 'rigid' | 'diaphragm' | 'equal';
  label?: string;
  group?: string;
}

export interface NodeRestraint {
  ux: boolean;  // Translation X
  uy: boolean;  // Translation Y
  uz: boolean;  // Translation Z
  rx: boolean;  // Rotation X
  ry: boolean;  // Rotation Y
  rz: boolean;  // Rotation Z
  springStiffness?: SpringStiffness;
}

export interface SpringStiffness {
  kx?: number;  // Translational spring X (kN/m)
  ky?: number;  // Translational spring Y (kN/m)
  kz?: number;  // Translational spring Z (kN/m)
  krx?: number; // Rotational spring X (kN-m/rad)
  kry?: number; // Rotational spring Y (kN-m/rad)
  krz?: number; // Rotational spring Z (kN-m/rad)
}

export interface NodeMass {
  mx: number;  // Mass in X direction (kg)
  my: number;  // Mass in Y direction (kg)
  mz: number;  // Mass in Z direction (kg)
  Ixx?: number; // Mass moment of inertia (kg-m²)
  Iyy?: number;
  Izz?: number;
}

export interface ModelElement {
  id: string;
  type: ElementType;
  nodeI: string;
  nodeJ: string;
  nodeK?: string; // For shells
  nodeL?: string; // For shells
  section: string;
  material: string;
  beta?: number;  // Roll angle (degrees)
  releases?: MemberReleases;
  rigidZones?: RigidZones;
  offsets?: MemberOffsets;
  meshing?: MeshingControl;
  label?: string;
  group?: string;
}

export type ElementType = 
  | 'frame'      // 2-node beam-column
  | 'truss'      // Axial only
  | 'cable'      // Tension only
  | 'spring'     // 6-DOF spring
  | 'shell'      // 3/4 node shell
  | 'plate'      // Bending only plate
  | 'solid'      // 3D solid element
  | 'link'       // Multi-DOF link
  | 'nlink'      // Nonlinear link
  | 'gap'        // Gap element
  | 'hook'       // Hook element
  | 'isolator';  // Base isolator

export interface MemberReleases {
  iEnd: ReleaseCondition;
  jEnd: ReleaseCondition;
}

export interface ReleaseCondition {
  axial?: boolean | number;    // true = pinned, number = partial spring
  shearY?: boolean | number;
  shearZ?: boolean | number;
  torsion?: boolean | number;
  momentY?: boolean | number;
  momentZ?: boolean | number;
}

export interface RigidZones {
  iEnd: number;  // Factor 0-1 (fraction of half-length)
  jEnd: number;
}

export interface MemberOffsets {
  iEnd: { dx: number; dy: number; dz: number };
  jEnd: { dx: number; dy: number; dz: number };
}

export interface MeshingControl {
  segments: number;
  bias?: 'uniform' | 'linear' | 'quadratic';
  biasRatio?: number;
  maxLength?: number;
  minLength?: number;
}

// ============================================
// SECTION DEFINITIONS
// ============================================

export interface SectionDefinition {
  name: string;
  type: SectionShape;
  properties: SectionProperties;
  dimensions: SectionDimensions;
  reinforcement?: ReinforcementData;
}

export type SectionShape = 
  | 'rectangular'
  | 'circular'
  | 'i-section'
  | 'channel'
  | 'angle'
  | 'tee'
  | 'pipe'
  | 'box'
  | 'double-angle'
  | 'double-channel'
  | 'general'
  | 'sd-section'  // Section Designer
  | 'built-up';

export interface SectionProperties {
  A: number;      // Area (m²)
  Iy: number;     // Major axis moment of inertia (m⁴)
  Iz: number;     // Minor axis moment of inertia (m⁴)
  J: number;      // Torsional constant (m⁴)
  Av2?: number;   // Shear area in local 2 direction
  Av3?: number;   // Shear area in local 3 direction
  Sy?: number;    // Section modulus Y (m³)
  Sz?: number;    // Section modulus Z (m³)
  Zy?: number;    // Plastic section modulus Y
  Zz?: number;    // Plastic section modulus Z
  Cw?: number;    // Warping constant (m⁶)
  ry?: number;    // Radius of gyration Y
  rz?: number;    // Radius of gyration Z
}

export interface SectionDimensions {
  d?: number;     // Depth
  bf?: number;    // Flange width
  tf?: number;    // Flange thickness
  tw?: number;    // Web thickness
  b?: number;     // Width
  t?: number;     // Thickness
  r?: number;     // Radius
  ri?: number;    // Inner radius
}

export interface ReinforcementData {
  cover: number;
  longitudinal?: {
    bars: number;
    diameter: number;
    pattern: 'corners' | 'distributed' | 'custom';
    positions?: Array<{ y: number; z: number }>;
  };
  transverse?: {
    type: 'ties' | 'spiral';
    diameter: number;
    spacing: number;
  };
}

// ============================================
// MATERIAL DEFINITIONS
// ============================================

export interface MaterialDefinition {
  name: string;
  type: MaterialType;
  properties: MaterialProperties;
}

export type MaterialType = 
  | 'steel'
  | 'concrete'
  | 'aluminum'
  | 'timber'
  | 'masonry'
  | 'rebar'
  | 'tendon'
  | 'custom';

export interface MaterialProperties {
  E: number;       // Elastic modulus (Pa)
  G?: number;      // Shear modulus (Pa)
  nu: number;      // Poisson's ratio
  density: number; // Density (kg/m³)
  fy?: number;     // Yield strength (Pa)
  fu?: number;     // Ultimate strength (Pa)
  fc?: number;     // Compressive strength (Pa) - concrete
  alpha?: number;  // Thermal expansion coefficient (1/°C)
  damping?: number; // Material damping ratio
}

// ============================================
// LOAD DEFINITIONS
// ============================================

export interface LoadPattern {
  name: string;
  type: LoadPatternType;
  selfWeightMultiplier?: number;
  loads: LoadDefinition[];
}

export type LoadPatternType = 
  | 'dead'
  | 'superDead'
  | 'live'
  | 'liveRoof'
  | 'wind'
  | 'earthquake'
  | 'snow'
  | 'rain'
  | 'temperature'
  | 'prestress'
  | 'construction'
  | 'notional'
  | 'pattern'
  | 'other';

export type LoadDefinition = 
  | NodalLoadDef
  | MemberLoadDef
  | AreaLoadDef
  | TemperatureLoadDef;

export interface NodalLoadDef {
  type: 'nodal';
  nodeId: string;
  fx?: number;
  fy?: number;
  fz?: number;
  mx?: number;
  my?: number;
  mz?: number;
  coordinateSystem?: 'global' | 'local';
}

export interface MemberLoadDef {
  type: 'member';
  memberId: string;
  loadType: 'uniform' | 'trapezoidal' | 'point' | 'moment';
  direction: 'gravity' | 'local_x' | 'local_y' | 'local_z' | 'global_x' | 'global_y' | 'global_z' | 'projected';
  w1?: number;      // Intensity at start
  w2?: number;      // Intensity at end
  d1?: number;      // Distance from start (relative or absolute)
  d2?: number;      // Distance to end
  distanceType?: 'relative' | 'absolute';
  coordinateSystem?: 'global' | 'local';
}

export interface AreaLoadDef {
  type: 'area';
  areaId?: string;
  direction: 'gravity' | 'global_x' | 'global_y' | 'global_z';
  magnitude: number;
  oneWay?: boolean;
  angle?: number;
}

export interface TemperatureLoadDef {
  type: 'temperature';
  memberId: string;
  tUniform?: number;  // Uniform temperature change
  tGradient2?: number; // Gradient in local 2 direction
  tGradient3?: number; // Gradient in local 3 direction
}

// ============================================
// LOAD COMBINATION
// ============================================

export interface LoadCombination {
  name: string;
  type: CombinationType;
  factors: Array<{
    pattern: string;
    factor: number;
  }>;
}

export type CombinationType = 
  | 'linear'
  | 'envelope'
  | 'absoluteMax'
  | 'srss'      // Square Root Sum of Squares
  | 'cqc'       // Complete Quadratic Combination
  | 'range';

// ============================================
// ADVANCED MODELING ENGINE
// ============================================

export class AdvancedModelingEngine {
  private nodes: Map<string, ModelNode> = new Map();
  private elements: Map<string, ModelElement> = new Map();
  private sections: Map<string, SectionDefinition> = new Map();
  private materials: Map<string, MaterialDefinition> = new Map();
  private loadPatterns: Map<string, LoadPattern> = new Map();
  private loadCombinations: Map<string, LoadCombination> = new Map();
  private groups: Map<string, Set<string>> = new Map();
  
  private nextNodeId: number = 1;
  private nextElementId: number = 1;
  
  // ==========================================
  // NODE OPERATIONS
  // ==========================================
  
  /**
   * Add a new node
   */
  addNode(
    x: number,
    y: number,
    z: number,
    options: Partial<ModelNode> = {}
  ): string {
    const id = options.id ?? `N${this.nextNodeId++}`;
    
    const node: ModelNode = {
      id,
      x,
      y,
      z,
      restraints: options.restraints ?? {
        ux: false, uy: false, uz: false,
        rx: false, ry: false, rz: false,
      },
      mass: options.mass,
      masterNode: options.masterNode,
      slaveType: options.slaveType,
      label: options.label,
      group: options.group,
    };
    
    this.nodes.set(id, node);
    
    if (options.group) {
      this.addToGroup(options.group, id);
    }
    
    return id;
  }
  
  /**
   * Add multiple nodes along a line
   */
  addNodesAlongLine(
    start: [number, number, number],
    end: [number, number, number],
    count: number,
    options: Partial<ModelNode> = {}
  ): string[] {
    const ids: string[] = [];
    
    for (let i = 0; i < count; i++) {
      const t = count === 1 ? 0.5 : i / (count - 1);
      const x = start[0] + t * (end[0] - start[0]);
      const y = start[1] + t * (end[1] - start[1]);
      const z = start[2] + t * (end[2] - start[2]);
      
      ids.push(this.addNode(x, y, z, options));
    }
    
    return ids;
  }
  
  /**
   * Add nodes in a grid pattern
   */
  addNodesInGrid(
    origin: [number, number, number],
    gridX: number[],  // X coordinates relative to origin
    gridY: number[],  // Y coordinates relative to origin
    gridZ: number[],  // Z coordinates relative to origin
    options: Partial<ModelNode> = {}
  ): string[][][] {
    const ids: string[][][] = [];
    
    for (const dz of gridZ) {
      const xyPlane: string[][] = [];
      for (const dy of gridY) {
        const xLine: string[] = [];
        for (const dx of gridX) {
          const id = this.addNode(
            origin[0] + dx,
            origin[1] + dy,
            origin[2] + dz,
            options
          );
          xLine.push(id);
        }
        xyPlane.push(xLine);
      }
      ids.push(xyPlane);
    }
    
    return ids;
  }
  
  /**
   * Set node restraints (supports)
   */
  setRestraint(
    nodeId: string,
    restraints: Partial<NodeRestraint>
  ): void {
    const node = this.nodes.get(nodeId);
    if (!node) throw new Error(`Node ${nodeId} not found`);
    
    node.restraints = { ...node.restraints, ...restraints };
  }
  
  /**
   * Create fixed support
   */
  setFixedSupport(nodeId: string): void {
    this.setRestraint(nodeId, {
      ux: true, uy: true, uz: true,
      rx: true, ry: true, rz: true,
    });
  }
  
  /**
   * Create pinned support
   */
  setPinnedSupport(nodeId: string): void {
    this.setRestraint(nodeId, {
      ux: true, uy: true, uz: true,
      rx: false, ry: false, rz: false,
    });
  }
  
  /**
   * Create roller support
   */
  setRollerSupport(nodeId: string, freeDirection: 'x' | 'y' | 'z' = 'x'): void {
    this.setRestraint(nodeId, {
      ux: freeDirection !== 'x',
      uy: freeDirection !== 'y',
      uz: freeDirection !== 'z',
      rx: false, ry: false, rz: false,
    });
  }
  
  /**
   * Create spring support
   */
  setSpringSupport(nodeId: string, stiffness: SpringStiffness): void {
    const node = this.nodes.get(nodeId);
    if (!node) throw new Error(`Node ${nodeId} not found`);
    
    node.restraints.springStiffness = stiffness;
  }
  
  /**
   * Create rigid link between nodes
   */
  createRigidLink(
    masterNodeId: string,
    slaveNodeIds: string[],
    type: 'rigid' | 'diaphragm' | 'equal' = 'rigid'
  ): void {
    for (const slaveId of slaveNodeIds) {
      const slave = this.nodes.get(slaveId);
      if (!slave) throw new Error(`Node ${slaveId} not found`);
      
      slave.masterNode = masterNodeId;
      slave.slaveType = type;
    }
  }
  
  // ==========================================
  // ELEMENT OPERATIONS
  // ==========================================
  
  /**
   * Add a new element
   */
  addElement(
    nodeI: string,
    nodeJ: string,
    section: string,
    material: string,
    options: Partial<ModelElement> = {}
  ): string {
    const id = options.id ?? `E${this.nextElementId++}`;
    
    const element: ModelElement = {
      id,
      type: options.type ?? 'frame',
      nodeI,
      nodeJ,
      section,
      material,
      beta: options.beta ?? 0,
      releases: options.releases,
      rigidZones: options.rigidZones,
      offsets: options.offsets,
      meshing: options.meshing,
      label: options.label,
      group: options.group,
    };
    
    this.elements.set(id, element);
    
    if (options.group) {
      this.addToGroup(options.group, id);
    }
    
    return id;
  }
  
  /**
   * Add elements connecting a chain of nodes
   */
  addElementsAlongChain(
    nodeIds: string[],
    section: string,
    material: string,
    options: Partial<ModelElement> = {}
  ): string[] {
    const elementIds: string[] = [];
    
    for (let i = 0; i < nodeIds.length - 1; i++) {
      elementIds.push(
        this.addElement(nodeIds[i], nodeIds[i + 1], section, material, options)
      );
    }
    
    return elementIds;
  }
  
  /**
   * Add frame elements in a grid (creates beams and columns)
   */
  addFrameGrid(
    nodeGrid: string[][][],
    columnSection: string,
    beamSection: string,
    material: string
  ): { columns: string[]; beams: string[] } {
    const columns: string[] = [];
    const beams: string[] = [];
    
    const nz = nodeGrid.length;
    const ny = nodeGrid[0].length;
    const nx = nodeGrid[0][0].length;
    
    // Add columns (vertical elements)
    for (let iz = 0; iz < nz - 1; iz++) {
      for (let iy = 0; iy < ny; iy++) {
        for (let ix = 0; ix < nx; ix++) {
          columns.push(
            this.addElement(
              nodeGrid[iz][iy][ix],
              nodeGrid[iz + 1][iy][ix],
              columnSection,
              material,
              { group: 'COLUMNS' }
            )
          );
        }
      }
    }
    
    // Add beams (horizontal elements)
    for (let iz = 0; iz < nz; iz++) {
      // X-direction beams
      for (let iy = 0; iy < ny; iy++) {
        for (let ix = 0; ix < nx - 1; ix++) {
          beams.push(
            this.addElement(
              nodeGrid[iz][iy][ix],
              nodeGrid[iz][iy][ix + 1],
              beamSection,
              material,
              { group: 'BEAMS_X' }
            )
          );
        }
      }
      
      // Y-direction beams
      for (let iy = 0; iy < ny - 1; iy++) {
        for (let ix = 0; ix < nx; ix++) {
          beams.push(
            this.addElement(
              nodeGrid[iz][iy][ix],
              nodeGrid[iz][iy + 1][ix],
              beamSection,
              material,
              { group: 'BEAMS_Y' }
            )
          );
        }
      }
    }
    
    return { columns, beams };
  }
  
  /**
   * Set member end releases
   */
  setMemberRelease(
    elementId: string,
    end: 'i' | 'j' | 'both',
    releases: Partial<ReleaseCondition>
  ): void {
    const element = this.elements.get(elementId);
    if (!element) throw new Error(`Element ${elementId} not found`);
    
    if (!element.releases) {
      element.releases = {
        iEnd: {},
        jEnd: {},
      };
    }
    
    if (end === 'i' || end === 'both') {
      element.releases.iEnd = { ...element.releases.iEnd, ...releases };
    }
    if (end === 'j' || end === 'both') {
      element.releases.jEnd = { ...element.releases.jEnd, ...releases };
    }
  }
  
  /**
   * Create pin connection at member end
   */
  createPin(elementId: string, end: 'i' | 'j' | 'both'): void {
    this.setMemberRelease(elementId, end, {
      momentY: true,
      momentZ: true,
    });
  }
  
  /**
   * Set rigid zones for beam-column joints
   */
  setRigidZone(elementId: string, iEnd: number, jEnd: number): void {
    const element = this.elements.get(elementId);
    if (!element) throw new Error(`Element ${elementId} not found`);
    
    element.rigidZones = { iEnd, jEnd };
  }
  
  /**
   * Set member offsets
   */
  setMemberOffset(
    elementId: string,
    iEnd: { dx: number; dy: number; dz: number },
    jEnd: { dx: number; dy: number; dz: number }
  ): void {
    const element = this.elements.get(elementId);
    if (!element) throw new Error(`Element ${elementId} not found`);
    
    element.offsets = { iEnd, jEnd };
  }
  
  // ==========================================
  // SECTION OPERATIONS
  // ==========================================
  
  /**
   * Define a new section
   */
  defineSection(definition: SectionDefinition): void {
    this.sections.set(definition.name, definition);
  }
  
  /**
   * Define rectangular section
   */
  defineRectangularSection(
    name: string,
    b: number,
    h: number,
    reinforcement?: ReinforcementData
  ): void {
    const A = b * h;
    const Iy = (b * h * h * h) / 12;
    const Iz = (h * b * b * b) / 12;
    const J = this.torsionalConstantRect(b, h);
    
    this.defineSection({
      name,
      type: 'rectangular',
      properties: {
        A,
        Iy,
        Iz,
        J,
        Av2: (5/6) * A,
        Av3: (5/6) * A,
        Sy: (b * h * h) / 6,
        Sz: (h * b * b) / 6,
        Zy: (b * h * h) / 4,
        Zz: (h * b * b) / 4,
        ry: Math.sqrt(Iy / A),
        rz: Math.sqrt(Iz / A),
      },
      dimensions: { b, d: h },
      reinforcement,
    });
  }
  
  /**
   * Define circular section
   */
  defineCircularSection(name: string, diameter: number): void {
    const r = diameter / 2;
    const A = Math.PI * r * r;
    const I = (Math.PI * r * r * r * r) / 4;
    const J = (Math.PI * r * r * r * r) / 2;
    
    this.defineSection({
      name,
      type: 'circular',
      properties: {
        A,
        Iy: I,
        Iz: I,
        J,
        Av2: 0.9 * A,
        Av3: 0.9 * A,
        Sy: (Math.PI * r * r * r) / 4,
        Sz: (Math.PI * r * r * r) / 4,
        Zy: (4/3) * r * r * r,
        Zz: (4/3) * r * r * r,
        ry: r / 2,
        rz: r / 2,
      },
      dimensions: { r },
    });
  }
  
  /**
   * Define I-section
   */
  defineISection(
    name: string,
    d: number,
    bf: number,
    tf: number,
    tw: number
  ): void {
    const hw = d - 2 * tf;
    
    const A = 2 * bf * tf + hw * tw;
    const Iy = (bf * d * d * d - (bf - tw) * hw * hw * hw) / 12;
    const Iz = (2 * tf * bf * bf * bf + hw * tw * tw * tw) / 12;
    const J = (2 * bf * tf * tf * tf + hw * tw * tw * tw) / 3;
    
    this.defineSection({
      name,
      type: 'i-section',
      properties: {
        A,
        Iy,
        Iz,
        J,
        Av2: hw * tw,
        Av3: 2 * bf * tf,
        Sy: (2 * Iy) / d,
        Sz: (2 * Iz) / bf,
        ry: Math.sqrt(Iy / A),
        rz: Math.sqrt(Iz / A),
      },
      dimensions: { d, bf, tf, tw },
    });
  }
  
  /**
   * Torsional constant for rectangular section
   */
  private torsionalConstantRect(b: number, h: number): number {
    const a = Math.max(b, h) / 2;
    const bVal = Math.min(b, h) / 2;
    const ratio = bVal / a;
    
    // Approximation from Timoshenko
    const factor = 1/3 - 0.21 * ratio * (1 - ratio * ratio * ratio * ratio / 12);
    return factor * (2 * a) * Math.pow(2 * bVal, 3);
  }
  
  // ==========================================
  // MATERIAL OPERATIONS
  // ==========================================
  
  /**
   * Define a new material
   */
  defineMaterial(definition: MaterialDefinition): void {
    this.materials.set(definition.name, definition);
  }
  
  /**
   * Define steel material
   */
  defineSteel(
    name: string,
    fy: number = 250e6,
    fu: number = 410e6,
    E: number = 200e9
  ): void {
    this.defineMaterial({
      name,
      type: 'steel',
      properties: {
        E,
        G: E / (2 * (1 + 0.3)),
        nu: 0.3,
        density: 7850,
        fy,
        fu,
        alpha: 12e-6,
        damping: 0.02,
      },
    });
  }
  
  /**
   * Define concrete material
   */
  defineConcrete(
    name: string,
    fc: number = 30e6,
    E?: number
  ): void {
    // E calculation per IS 456 or ACI 318
    const calculatedE = E ?? 5000 * Math.sqrt(fc / 1e6) * 1e6;
    
    this.defineMaterial({
      name,
      type: 'concrete',
      properties: {
        E: calculatedE,
        G: calculatedE / (2 * (1 + 0.2)),
        nu: 0.2,
        density: 2500,
        fc,
        alpha: 10e-6,
        damping: 0.05,
      },
    });
  }
  
  // ==========================================
  // LOAD OPERATIONS
  // ==========================================
  
  /**
   * Create a new load pattern
   */
  createLoadPattern(
    name: string,
    type: LoadPatternType,
    selfWeightMultiplier: number = 0
  ): void {
    this.loadPatterns.set(name, {
      name,
      type,
      selfWeightMultiplier,
      loads: [],
    });
  }
  
  /**
   * Add nodal load
   */
  addNodalLoad(
    patternName: string,
    nodeId: string,
    loads: Omit<NodalLoadDef, 'type' | 'nodeId'>
  ): void {
    const pattern = this.loadPatterns.get(patternName);
    if (!pattern) throw new Error(`Load pattern ${patternName} not found`);
    
    pattern.loads.push({
      type: 'nodal',
      nodeId,
      ...loads,
    });
  }
  
  /**
   * Add member distributed load
   */
  addMemberLoad(
    patternName: string,
    memberId: string,
    loadDef: Omit<MemberLoadDef, 'type' | 'memberId'>
  ): void {
    const pattern = this.loadPatterns.get(patternName);
    if (!pattern) throw new Error(`Load pattern ${patternName} not found`);
    
    pattern.loads.push({
      type: 'member',
      memberId,
      ...loadDef,
    });
  }
  
  /**
   * Add uniform load to member
   */
  addUniformLoad(
    patternName: string,
    memberId: string,
    w: number,
    direction: MemberLoadDef['direction'] = 'gravity'
  ): void {
    this.addMemberLoad(patternName, memberId, {
      loadType: 'uniform',
      direction,
      w1: w,
      w2: w,
    });
  }
  
  /**
   * Add trapezoidal load to member
   */
  addTrapezoidalLoad(
    patternName: string,
    memberId: string,
    wStart: number,
    wEnd: number,
    direction: MemberLoadDef['direction'] = 'gravity'
  ): void {
    this.addMemberLoad(patternName, memberId, {
      loadType: 'trapezoidal',
      direction,
      w1: wStart,
      w2: wEnd,
    });
  }
  
  /**
   * Add point load to member
   */
  addPointLoadOnMember(
    patternName: string,
    memberId: string,
    P: number,
    distance: number,
    direction: MemberLoadDef['direction'] = 'gravity',
    distanceType: 'relative' | 'absolute' = 'relative'
  ): void {
    this.addMemberLoad(patternName, memberId, {
      loadType: 'point',
      direction,
      w1: P,
      d1: distance,
      distanceType,
    });
  }
  
  /**
   * Create load combination
   */
  createLoadCombination(
    name: string,
    type: CombinationType,
    factors: LoadCombination['factors']
  ): void {
    this.loadCombinations.set(name, { name, type, factors });
  }
  
  // ==========================================
  // GROUP OPERATIONS
  // ==========================================
  
  /**
   * Add item to group
   */
  addToGroup(groupName: string, itemId: string): void {
    if (!this.groups.has(groupName)) {
      this.groups.set(groupName, new Set());
    }
    this.groups.get(groupName)!.add(itemId);
  }
  
  /**
   * Get group members
   */
  getGroup(groupName: string): Set<string> | undefined {
    return this.groups.get(groupName);
  }
  
  /**
   * Apply operation to group
   */
  applyToGroup<T>(
    groupName: string,
    operation: (id: string) => T
  ): T[] {
    const group = this.groups.get(groupName);
    if (!group) return [];
    
    return Array.from(group).map(operation);
  }
  
  // ==========================================
  // MODEL ACCESS
  // ==========================================
  
  getNode(id: string): ModelNode | undefined {
    return this.nodes.get(id);
  }
  
  getElement(id: string): ModelElement | undefined {
    return this.elements.get(id);
  }
  
  getSection(name: string): SectionDefinition | undefined {
    return this.sections.get(name);
  }
  
  getMaterial(name: string): MaterialDefinition | undefined {
    return this.materials.get(name);
  }
  
  getLoadPattern(name: string): LoadPattern | undefined {
    return this.loadPatterns.get(name);
  }
  
  getAllNodes(): Map<string, ModelNode> {
    return new Map(this.nodes);
  }
  
  getAllElements(): Map<string, ModelElement> {
    return new Map(this.elements);
  }
  
  getAllSections(): Map<string, SectionDefinition> {
    return new Map(this.sections);
  }
  
  getAllMaterials(): Map<string, MaterialDefinition> {
    return new Map(this.materials);
  }
  
  getAllLoadPatterns(): Map<string, LoadPattern> {
    return new Map(this.loadPatterns);
  }
  
  getAllLoadCombinations(): Map<string, LoadCombination> {
    return new Map(this.loadCombinations);
  }
  
  // ==========================================
  // EXPORT FOR ANALYSIS
  // ==========================================
  
  /**
   * Export model for hybrid analysis engine
   */
  exportForAnalysis(): {
    nodes: Array<{
      id: string;
      x: number;
      y: number;
      z: number;
      restraints: boolean[];
    }>;
    elements: Array<{
      id: string;
      node_i: string;
      node_j: string;
      E: number;
      G: number;
      A: number;
      Iy: number;
      Iz: number;
      J: number;
      beta: number;
    }>;
    nodalLoads: Array<{
      node_id: string;
      fx: number;
      fy: number;
      fz: number;
      mx: number;
      my: number;
      mz: number;
    }>;
    distributedLoads: Array<{
      element_id: string;
      w_start: number;
      w_end: number;
      direction: string;
    }>;
  } {
    // Convert nodes
    const nodes = Array.from(this.nodes.values()).map(n => ({
      id: n.id,
      x: n.x,
      y: n.y,
      z: n.z,
      restraints: [
        n.restraints.ux,
        n.restraints.uy,
        n.restraints.uz,
        n.restraints.rx,
        n.restraints.ry,
        n.restraints.rz,
      ],
    }));
    
    // Convert elements
    const elements = Array.from(this.elements.values()).map(e => {
      const section = this.sections.get(e.section);
      const material = this.materials.get(e.material);
      
      if (!section) throw new Error(`Section ${e.section} not found`);
      if (!material) throw new Error(`Material ${e.material} not found`);
      
      return {
        id: e.id,
        node_i: e.nodeI,
        node_j: e.nodeJ,
        E: material.properties.E,
        G: material.properties.G ?? material.properties.E / (2 * (1 + material.properties.nu)),
        A: section.properties.A,
        Iy: section.properties.Iy,
        Iz: section.properties.Iz,
        J: section.properties.J,
        beta: e.beta ?? 0,
      };
    });
    
    // Collect loads from all patterns
    const nodalLoads: Array<{
      node_id: string;
      fx: number;
      fy: number;
      fz: number;
      mx: number;
      my: number;
      mz: number;
    }> = [];
    
    const distributedLoads: Array<{
      element_id: string;
      w_start: number;
      w_end: number;
      direction: string;
    }> = [];
    
    for (const pattern of this.loadPatterns.values()) {
      for (const load of pattern.loads) {
        if (load.type === 'nodal') {
          nodalLoads.push({
            node_id: load.nodeId,
            fx: load.fx ?? 0,
            fy: load.fy ?? 0,
            fz: load.fz ?? 0,
            mx: load.mx ?? 0,
            my: load.my ?? 0,
            mz: load.mz ?? 0,
          });
        } else if (load.type === 'member') {
          if (load.loadType === 'uniform' || load.loadType === 'trapezoidal') {
            distributedLoads.push({
              element_id: load.memberId,
              w_start: load.w1 ?? 0,
              w_end: load.w2 ?? load.w1 ?? 0,
              direction: load.direction === 'gravity' ? 'global_y' : load.direction,
            });
          }
        }
      }
    }
    
    return { nodes, elements, nodalLoads, distributedLoads };
  }
  
  /**
   * Clear the model
   */
  clear(): void {
    this.nodes.clear();
    this.elements.clear();
    this.sections.clear();
    this.materials.clear();
    this.loadPatterns.clear();
    this.loadCombinations.clear();
    this.groups.clear();
    this.nextNodeId = 1;
    this.nextElementId = 1;
  }
  
  /**
   * Get model statistics
   */
  getStatistics(): ModelStatistics {
    return {
      nodeCount: this.nodes.size,
      elementCount: this.elements.size,
      sectionCount: this.sections.size,
      materialCount: this.materials.size,
      loadPatternCount: this.loadPatterns.size,
      loadCombinationCount: this.loadCombinations.size,
      groupCount: this.groups.size,
      totalDOF: this.nodes.size * 6,
      restrainedDOF: Array.from(this.nodes.values()).reduce((sum, n) => {
        return sum + 
          (n.restraints.ux ? 1 : 0) +
          (n.restraints.uy ? 1 : 0) +
          (n.restraints.uz ? 1 : 0) +
          (n.restraints.rx ? 1 : 0) +
          (n.restraints.ry ? 1 : 0) +
          (n.restraints.rz ? 1 : 0);
      }, 0),
    };
  }
}

export interface ModelStatistics {
  nodeCount: number;
  elementCount: number;
  sectionCount: number;
  materialCount: number;
  loadPatternCount: number;
  loadCombinationCount: number;
  groupCount: number;
  totalDOF: number;
  restrainedDOF: number;
}

// ============================================
// SINGLETON INSTANCE
// ============================================

export const modelingEngine = new AdvancedModelingEngine();

export default modelingEngine;
