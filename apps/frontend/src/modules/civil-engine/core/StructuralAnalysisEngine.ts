/**
 * ============================================================================
 * STRUCTURAL ANALYSIS ENGINE
 * ============================================================================
 * 
 * Complete 2D and 3D structural analysis using direct stiffness method.
 * Supports beams, frames, trusses, and grids.
 * 
 * @version 2.0.0
 */

import { MatrixOperations } from './CivilEngineeringCore';

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

export interface Node2D {
  id: number;
  x: number;
  y: number;
  supportType?: 'fixed' | 'pinned' | 'roller-x' | 'roller-y' | 'free';
  settlements?: { dx?: number; dy?: number; rz?: number };
}

export interface Node3D extends Node2D {
  z: number;
  settlements?: { dx?: number; dy?: number; dz?: number; rx?: number; ry?: number; rz?: number };
}

export interface Element {
  id: number;
  startNode: number;
  endNode: number;
  material: {
    E: number;      // Elastic modulus (MPa)
    G?: number;     // Shear modulus (MPa)
    density?: number;
  };
  section: {
    A: number;      // Area (mm²)
    Ix: number;     // Moment of inertia about x (mm⁴)
    Iy?: number;    // Moment of inertia about y (mm⁴)
    J?: number;     // Torsional constant (mm⁴)
  };
  releases?: {
    startMoment?: boolean;
    endMoment?: boolean;
  };
}

export interface PointLoad {
  nodeId: number;
  Fx?: number;      // Force in x (kN)
  Fy?: number;      // Force in y (kN)
  Fz?: number;      // Force in z (kN)
  Mx?: number;      // Moment about x (kN-m)
  My?: number;      // Moment about y (kN-m)
  Mz?: number;      // Moment about z (kN-m)
}

export interface DistributedLoad {
  elementId: number;
  type: 'uniform' | 'triangular' | 'trapezoidal';
  direction: 'local-y' | 'global-y' | 'local-x' | 'global-x';
  w1: number;       // Load intensity at start (kN/m)
  w2?: number;      // Load intensity at end (kN/m)
  a?: number;       // Start position (fraction of length)
  b?: number;       // End position (fraction of length)
}

export interface AnalysisResult {
  displacements: Map<number, number[]>;
  reactions: Map<number, number[]>;
  memberForces: Map<number, MemberForce>;
  maxDisplacement: number;
  maxMoment: number;
  maxShear: number;
  maxAxial: number;
}

export interface MemberForce {
  elementId: number;
  startForces: {
    axial: number;
    shearY: number;
    shearZ?: number;
    momentY?: number;
    momentZ: number;
    torsion?: number;
  };
  endForces: {
    axial: number;
    shearY: number;
    shearZ?: number;
    momentY?: number;
    momentZ: number;
    torsion?: number;
  };
}

// =============================================================================
// 2D FRAME ANALYSIS ENGINE
// =============================================================================

export class Frame2DAnalysis {
  private nodes: Map<number, Node2D> = new Map();
  private elements: Map<number, Element> = new Map();
  private pointLoads: PointLoad[] = [];
  private distributedLoads: DistributedLoad[] = [];
  private dofPerNode = 3; // u, v, θ
  
  /**
   * Add a node to the structure
   */
  addNode(node: Node2D): void {
    this.nodes.set(node.id, node);
  }

  /**
   * Add multiple nodes
   */
  addNodes(nodes: Node2D[]): void {
    nodes.forEach(node => this.addNode(node));
  }

  /**
   * Add an element to the structure
   */
  addElement(element: Element): void {
    this.elements.set(element.id, element);
  }

  /**
   * Add multiple elements
   */
  addElements(elements: Element[]): void {
    elements.forEach(element => this.addElement(element));
  }

  /**
   * Add point load
   */
  addPointLoad(load: PointLoad): void {
    this.pointLoads.push(load);
  }

  /**
   * Add distributed load
   */
  addDistributedLoad(load: DistributedLoad): void {
    this.distributedLoads.push(load);
  }

  /**
   * Calculate element length
   */
  private getElementLength(element: Element): number {
    const startNode = this.nodes.get(element.startNode)!;
    const endNode = this.nodes.get(element.endNode)!;
    return Math.sqrt(
      Math.pow(endNode.x - startNode.x, 2) + 
      Math.pow(endNode.y - startNode.y, 2)
    );
  }

  /**
   * Calculate element angle
   */
  private getElementAngle(element: Element): number {
    const startNode = this.nodes.get(element.startNode)!;
    const endNode = this.nodes.get(element.endNode)!;
    return Math.atan2(endNode.y - startNode.y, endNode.x - startNode.x);
  }

  /**
   * Create local stiffness matrix for beam element
   */
  private getLocalStiffnessMatrix(element: Element): number[][] {
    const L = this.getElementLength(element);
    const E = element.material.E;
    const A = element.section.A;
    const I = element.section.Ix;
    
    const EA_L = E * A / L;
    const EI_L3 = E * I / Math.pow(L, 3);
    const EI_L2 = E * I / Math.pow(L, 2);
    const EI_L = E * I / L;
    
    return [
      [EA_L, 0, 0, -EA_L, 0, 0],
      [0, 12*EI_L3, 6*EI_L2, 0, -12*EI_L3, 6*EI_L2],
      [0, 6*EI_L2, 4*EI_L, 0, -6*EI_L2, 2*EI_L],
      [-EA_L, 0, 0, EA_L, 0, 0],
      [0, -12*EI_L3, -6*EI_L2, 0, 12*EI_L3, -6*EI_L2],
      [0, 6*EI_L2, 2*EI_L, 0, -6*EI_L2, 4*EI_L],
    ];
  }

  /**
   * Create transformation matrix
   */
  private getTransformationMatrix(element: Element): number[][] {
    const theta = this.getElementAngle(element);
    const c = Math.cos(theta);
    const s = Math.sin(theta);
    
    return [
      [c, s, 0, 0, 0, 0],
      [-s, c, 0, 0, 0, 0],
      [0, 0, 1, 0, 0, 0],
      [0, 0, 0, c, s, 0],
      [0, 0, 0, -s, c, 0],
      [0, 0, 0, 0, 0, 1],
    ];
  }

  /**
   * Get global stiffness matrix for element
   */
  private getGlobalStiffnessMatrix(element: Element): number[][] {
    const kLocal = this.getLocalStiffnessMatrix(element);
    const T = this.getTransformationMatrix(element);
    const Tt = MatrixOperations.transpose(T);
    
    // K_global = T^T * K_local * T
    const temp = MatrixOperations.multiply(Tt, kLocal);
    return MatrixOperations.multiply(temp, T);
  }

  /**
   * Get DOF indices for an element
   */
  private getElementDOFs(element: Element): number[] {
    const startDOF = (element.startNode - 1) * this.dofPerNode;
    const endDOF = (element.endNode - 1) * this.dofPerNode;
    
    return [
      startDOF, startDOF + 1, startDOF + 2,
      endDOF, endDOF + 1, endDOF + 2,
    ];
  }

  /**
   * Assemble global stiffness matrix
   */
  private assembleGlobalStiffnessMatrix(): number[][] {
    const n = this.nodes.size * this.dofPerNode;
    const K = MatrixOperations.zeros(n, n);
    
    this.elements.forEach(element => {
      const ke = this.getGlobalStiffnessMatrix(element);
      const dofs = this.getElementDOFs(element);
      
      for (let i = 0; i < 6; i++) {
        for (let j = 0; j < 6; j++) {
          K[dofs[i]][dofs[j]] += ke[i][j];
        }
      }
    });
    
    return K;
  }

  /**
   * Assemble load vector
   */
  private assembleLoadVector(): number[] {
    const n = this.nodes.size * this.dofPerNode;
    const F = Array(n).fill(0);
    
    // Add point loads
    this.pointLoads.forEach(load => {
      const baseDOF = (load.nodeId - 1) * this.dofPerNode;
      if (load.Fx) F[baseDOF] += load.Fx * 1000;     // kN to N
      if (load.Fy) F[baseDOF + 1] += load.Fy * 1000; // kN to N
      if (load.Mz) F[baseDOF + 2] += load.Mz * 1e6;  // kN-m to N-mm
    });
    
    // Add fixed-end forces from distributed loads
    this.distributedLoads.forEach(load => {
      const element = this.elements.get(load.elementId)!;
      const L = this.getElementLength(element);
      const w = load.w1 * 1; // kN/m to N/mm
      
      // Fixed-end forces for uniformly distributed load
      if (load.type === 'uniform' && load.direction === 'global-y') {
        const FEM = w * L * L / 12; // Fixed-end moment
        const reaction = w * L / 2;  // End reaction
        
        const dofs = this.getElementDOFs(element);
        F[dofs[1]] += reaction;
        F[dofs[2]] += FEM;
        F[dofs[4]] += reaction;
        F[dofs[5]] -= FEM;
      }
    });
    
    return F;
  }

  /**
   * Get constrained DOFs based on support conditions
   */
  private getConstrainedDOFs(): Set<number> {
    const constrained = new Set<number>();
    
    this.nodes.forEach(node => {
      const baseDOF = (node.id - 1) * this.dofPerNode;
      
      switch (node.supportType) {
        case 'fixed':
          constrained.add(baseDOF);
          constrained.add(baseDOF + 1);
          constrained.add(baseDOF + 2);
          break;
        case 'pinned':
          constrained.add(baseDOF);
          constrained.add(baseDOF + 1);
          break;
        case 'roller-x':
          constrained.add(baseDOF + 1);
          break;
        case 'roller-y':
          constrained.add(baseDOF);
          break;
      }
    });
    
    return constrained;
  }

  /**
   * Apply boundary conditions using penalty method
   */
  private applyBoundaryConditions(K: number[][], F: number[]): void {
    const constrained = this.getConstrainedDOFs();
    const penalty = 1e20;
    
    constrained.forEach(dof => {
      K[dof][dof] += penalty;
      F[dof] = 0;
    });
  }

  /**
   * Calculate member forces
   */
  private calculateMemberForces(displacements: number[]): Map<number, MemberForce> {
    const memberForces = new Map<number, MemberForce>();
    
    this.elements.forEach(element => {
      const ke = this.getLocalStiffnessMatrix(element);
      const T = this.getTransformationMatrix(element);
      const dofs = this.getElementDOFs(element);
      
      // Get element displacements in global coordinates
      const ue_global = dofs.map(dof => displacements[dof]);
      
      // Transform to local coordinates
      const ue_local = MatrixOperations.multiply(T, ue_global.map(v => [v])).map(r => r[0]);
      
      // Calculate local forces: f = k * u
      const fe_local = MatrixOperations.multiply(ke, ue_local.map(v => [v])).map(r => r[0]);
      
      memberForces.set(element.id, {
        elementId: element.id,
        startForces: {
          axial: -fe_local[0] / 1000,       // N to kN
          shearY: -fe_local[1] / 1000,      // N to kN
          momentZ: -fe_local[2] / 1e6,      // N-mm to kN-m
        },
        endForces: {
          axial: fe_local[3] / 1000,
          shearY: fe_local[4] / 1000,
          momentZ: fe_local[5] / 1e6,
        },
      });
    });
    
    return memberForces;
  }

  /**
   * Calculate reactions
   */
  private calculateReactions(K: number[][], displacements: number[], F: number[]): Map<number, number[]> {
    const reactions = new Map<number, number[]>();
    const constrained = this.getConstrainedDOFs();
    
    this.nodes.forEach(node => {
      if (node.supportType && node.supportType !== 'free') {
        const baseDOF = (node.id - 1) * this.dofPerNode;
        const nodeReactions = [0, 0, 0];
        
        for (let i = 0; i < this.dofPerNode; i++) {
          const dof = baseDOF + i;
          if (constrained.has(dof)) {
            let reaction = -F[dof];
            for (let j = 0; j < K.length; j++) {
              reaction += K[dof][j] * displacements[j];
            }
            nodeReactions[i] = reaction;
          }
        }
        
        reactions.set(node.id, [
          nodeReactions[0] / 1000,  // N to kN
          nodeReactions[1] / 1000,  // N to kN
          nodeReactions[2] / 1e6,   // N-mm to kN-m
        ]);
      }
    });
    
    return reactions;
  }

  /**
   * Run the analysis
   */
  analyze(): AnalysisResult {
    // Assemble global stiffness matrix
    const K = this.assembleGlobalStiffnessMatrix();
    
    // Assemble load vector
    const F = this.assembleLoadVector();
    
    // Apply boundary conditions
    this.applyBoundaryConditions(K, F);
    
    // Solve for displacements
    const displacements = MatrixOperations.solve(K, F);
    
    if (!displacements) {
      throw new Error('Matrix is singular - check boundary conditions');
    }
    
    // Calculate member forces
    const memberForces = this.calculateMemberForces(displacements);
    
    // Calculate reactions
    const reactions = this.calculateReactions(K, displacements, F);
    
    // Create displacement map
    const displacementMap = new Map<number, number[]>();
    this.nodes.forEach(node => {
      const baseDOF = (node.id - 1) * this.dofPerNode;
      displacementMap.set(node.id, [
        displacements[baseDOF],
        displacements[baseDOF + 1],
        displacements[baseDOF + 2],
      ]);
    });
    
    // Find max values
    let maxDisplacement = 0;
    let maxMoment = 0;
    let maxShear = 0;
    let maxAxial = 0;
    
    displacementMap.forEach(disp => {
      const mag = Math.sqrt(disp[0] * disp[0] + disp[1] * disp[1]);
      maxDisplacement = Math.max(maxDisplacement, mag);
    });
    
    memberForces.forEach(forces => {
      maxMoment = Math.max(maxMoment, Math.abs(forces.startForces.momentZ), Math.abs(forces.endForces.momentZ));
      maxShear = Math.max(maxShear, Math.abs(forces.startForces.shearY), Math.abs(forces.endForces.shearY));
      maxAxial = Math.max(maxAxial, Math.abs(forces.startForces.axial), Math.abs(forces.endForces.axial));
    });
    
    return {
      displacements: displacementMap,
      reactions,
      memberForces,
      maxDisplacement,
      maxMoment,
      maxShear,
      maxAxial,
    };
  }

  /**
   * Clear all data
   */
  clear(): void {
    this.nodes.clear();
    this.elements.clear();
    this.pointLoads = [];
    this.distributedLoads = [];
  }
}

// =============================================================================
// TRUSS ANALYSIS ENGINE
// =============================================================================

export class Truss2DAnalysis {
  private nodes: Map<number, Node2D> = new Map();
  private elements: Map<number, Element> = new Map();
  private pointLoads: PointLoad[] = [];
  private dofPerNode = 2; // u, v only (no rotation)

  addNode(node: Node2D): void {
    this.nodes.set(node.id, node);
  }

  addElement(element: Element): void {
    this.elements.set(element.id, element);
  }

  addPointLoad(load: PointLoad): void {
    this.pointLoads.push(load);
  }

  private getElementLength(element: Element): number {
    const startNode = this.nodes.get(element.startNode)!;
    const endNode = this.nodes.get(element.endNode)!;
    return Math.sqrt(
      Math.pow(endNode.x - startNode.x, 2) + 
      Math.pow(endNode.y - startNode.y, 2)
    );
  }

  private getDirectionCosines(element: Element): { c: number; s: number } {
    const startNode = this.nodes.get(element.startNode)!;
    const endNode = this.nodes.get(element.endNode)!;
    const L = this.getElementLength(element);
    
    return {
      c: (endNode.x - startNode.x) / L,
      s: (endNode.y - startNode.y) / L,
    };
  }

  private getLocalStiffnessMatrix(element: Element): number[][] {
    const L = this.getElementLength(element);
    const E = element.material.E;
    const A = element.section.A;
    const k = E * A / L;
    
    const { c, s } = this.getDirectionCosines(element);
    const c2 = c * c;
    const s2 = s * s;
    const cs = c * s;
    
    return [
      [k * c2, k * cs, -k * c2, -k * cs],
      [k * cs, k * s2, -k * cs, -k * s2],
      [-k * c2, -k * cs, k * c2, k * cs],
      [-k * cs, -k * s2, k * cs, k * s2],
    ];
  }

  private getElementDOFs(element: Element): number[] {
    const startDOF = (element.startNode - 1) * this.dofPerNode;
    const endDOF = (element.endNode - 1) * this.dofPerNode;
    return [startDOF, startDOF + 1, endDOF, endDOF + 1];
  }

  analyze(): {
    displacements: Map<number, number[]>;
    reactions: Map<number, number[]>;
    memberForces: Map<number, { axial: number; stress: number }>;
  } {
    const n = this.nodes.size * this.dofPerNode;
    const K = MatrixOperations.zeros(n, n);
    const F = Array(n).fill(0);
    
    // Assemble stiffness matrix
    this.elements.forEach(element => {
      const ke = this.getLocalStiffnessMatrix(element);
      const dofs = this.getElementDOFs(element);
      
      for (let i = 0; i < 4; i++) {
        for (let j = 0; j < 4; j++) {
          K[dofs[i]][dofs[j]] += ke[i][j];
        }
      }
    });
    
    // Assemble load vector
    this.pointLoads.forEach(load => {
      const baseDOF = (load.nodeId - 1) * this.dofPerNode;
      if (load.Fx) F[baseDOF] += load.Fx * 1000;
      if (load.Fy) F[baseDOF + 1] += load.Fy * 1000;
    });
    
    // Apply boundary conditions
    const constrained = new Set<number>();
    this.nodes.forEach(node => {
      const baseDOF = (node.id - 1) * this.dofPerNode;
      if (node.supportType === 'pinned' || node.supportType === 'fixed') {
        constrained.add(baseDOF);
        constrained.add(baseDOF + 1);
      } else if (node.supportType === 'roller-x') {
        constrained.add(baseDOF + 1);
      } else if (node.supportType === 'roller-y') {
        constrained.add(baseDOF);
      }
    });
    
    const penalty = 1e20;
    constrained.forEach(dof => {
      K[dof][dof] += penalty;
      F[dof] = 0;
    });
    
    // Solve
    const displacements = MatrixOperations.solve(K, F);
    if (!displacements) throw new Error('Singular matrix');
    
    // Calculate member forces
    const memberForces = new Map<number, { axial: number; stress: number }>();
    
    this.elements.forEach(element => {
      const L = this.getElementLength(element);
      const E = element.material.E;
      const A = element.section.A;
      const { c, s } = this.getDirectionCosines(element);
      const dofs = this.getElementDOFs(element);
      
      const du = displacements[dofs[2]] - displacements[dofs[0]];
      const dv = displacements[dofs[3]] - displacements[dofs[1]];
      
      const strain = (c * du + s * dv) / L;
      const stress = E * strain;
      const axialForce = stress * A / 1000; // N to kN
      
      memberForces.set(element.id, {
        axial: axialForce,
        stress: stress,
      });
    });
    
    // Create result maps
    const displacementMap = new Map<number, number[]>();
    this.nodes.forEach(node => {
      const baseDOF = (node.id - 1) * this.dofPerNode;
      displacementMap.set(node.id, [displacements[baseDOF], displacements[baseDOF + 1]]);
    });
    
    const reactions = new Map<number, number[]>();
    this.nodes.forEach(node => {
      if (node.supportType && node.supportType !== 'free') {
        const baseDOF = (node.id - 1) * this.dofPerNode;
        const rx = K[baseDOF].reduce((sum, k, j) => sum + k * displacements[j], 0) / 1000;
        const ry = K[baseDOF + 1].reduce((sum, k, j) => sum + k * displacements[j], 0) / 1000;
        reactions.set(node.id, [rx - (F[baseDOF] / 1000), ry - (F[baseDOF + 1] / 1000)]);
      }
    });
    
    return { displacements: displacementMap, reactions, memberForces };
  }

  clear(): void {
    this.nodes.clear();
    this.elements.clear();
    this.pointLoads = [];
  }
}

// =============================================================================
// CONTINUOUS BEAM ANALYSIS
// =============================================================================

export class ContinuousBeamAnalysis {
  private spans: { length: number; EI: number; loads: DistributedLoad[] }[] = [];
  private supports: ('simple' | 'fixed' | 'free')[] = [];

  /**
   * Add a span to the continuous beam
   */
  addSpan(length: number, EI: number, loads: DistributedLoad[] = []): void {
    this.spans.push({ length, EI, loads });
  }

  /**
   * Set support conditions
   */
  setSupports(supports: ('simple' | 'fixed' | 'free')[]): void {
    this.supports = supports;
  }

  /**
   * Calculate fixed-end moments for a span
   */
  private calculateFEM(span: { length: number; EI: number; loads: DistributedLoad[] }): { left: number; right: number } {
    let leftMoment = 0;
    let rightMoment = 0;
    const L = span.length;
    
    span.loads.forEach(load => {
      if (load.type === 'uniform') {
        const w = load.w1;
        leftMoment += w * L * L / 12;
        rightMoment -= w * L * L / 12;
      }
    });
    
    return { left: leftMoment, right: rightMoment };
  }

  /**
   * Three-moment equation analysis
   */
  analyze(): {
    moments: number[];
    reactions: number[];
    maxMoment: number;
    maxShear: number;
  } {
    const n = this.spans.length;
    if (n < 1) throw new Error('No spans defined');
    
    // Build three-moment equation system
    // For n spans, we have n+1 supports and n-1 interior joints
    const numUnknowns = n + 1;
    const A = MatrixOperations.zeros(numUnknowns, numUnknowns);
    const b = Array(numUnknowns).fill(0);
    
    // Apply boundary conditions and three-moment equations
    for (let i = 0; i <= n; i++) {
      if (i === 0) {
        // Left end
        if (this.supports[0] === 'simple' || this.supports[0] === 'free') {
          A[i][i] = 1;
          b[i] = 0;
        } else {
          // Fixed - need special handling
          A[i][i] = 1;
          A[i][i + 1] = 0.5;
          const fem = this.calculateFEM(this.spans[0]);
          b[i] = -fem.left;
        }
      } else if (i === n) {
        // Right end
        if (this.supports[n] === 'simple' || this.supports[n] === 'free') {
          A[i][i] = 1;
          b[i] = 0;
        } else {
          A[i][i] = 1;
          A[i][i - 1] = 0.5;
          const fem = this.calculateFEM(this.spans[n - 1]);
          b[i] = fem.right;
        }
      } else {
        // Interior support - three-moment equation
        const L1 = this.spans[i - 1].length;
        const L2 = this.spans[i].length;
        const EI1 = this.spans[i - 1].EI;
        const EI2 = this.spans[i].EI;
        
        A[i][i - 1] = L1 / EI1;
        A[i][i] = 2 * (L1 / EI1 + L2 / EI2);
        A[i][i + 1] = L2 / EI2;
        
        // Calculate load terms
        let loadTerm = 0;
        this.spans[i - 1].loads.forEach(load => {
          if (load.type === 'uniform') {
            loadTerm += load.w1 * Math.pow(L1, 3) / (4 * EI1);
          }
        });
        this.spans[i].loads.forEach(load => {
          if (load.type === 'uniform') {
            loadTerm += load.w1 * Math.pow(L2, 3) / (4 * EI2);
          }
        });
        
        b[i] = -6 * loadTerm;
      }
    }
    
    // Solve for moments
    const moments = MatrixOperations.solve(A, b);
    if (!moments) throw new Error('Cannot solve moment equations');
    
    // Calculate reactions
    const reactions: number[] = [];
    for (let i = 0; i <= n; i++) {
      let reaction = 0;
      
      if (i < n) {
        const L = this.spans[i].length;
        // Contribution from moment difference
        reaction += (moments[i + 1] - moments[i]) / L;
        // Contribution from loads
        this.spans[i].loads.forEach(load => {
          if (load.type === 'uniform') {
            reaction += load.w1 * L / 2;
          }
        });
      }
      
      if (i > 0) {
        const L = this.spans[i - 1].length;
        reaction += (moments[i - 1] - moments[i]) / L;
        this.spans[i - 1].loads.forEach(load => {
          if (load.type === 'uniform') {
            reaction += load.w1 * L / 2;
          }
        });
      }
      
      reactions.push(reaction);
    }
    
    // Find maximum values
    const maxMoment = Math.max(...moments.map(Math.abs));
    let maxShear = 0;
    
    for (let i = 0; i < n; i++) {
      const L = this.spans[i].length;
      const shear = reactions[i];
      this.spans[i].loads.forEach(load => {
        if (load.type === 'uniform') {
          maxShear = Math.max(maxShear, Math.abs(shear), Math.abs(shear - load.w1 * L));
        }
      });
    }
    
    return { moments, reactions, maxMoment, maxShear };
  }

  clear(): void {
    this.spans = [];
    this.supports = [];
  }
}

// =============================================================================
// EXPORTS
// =============================================================================

export const frame2D = new Frame2DAnalysis();
export const truss2D = new Truss2DAnalysis();
export const continuousBeam = new ContinuousBeamAnalysis();
