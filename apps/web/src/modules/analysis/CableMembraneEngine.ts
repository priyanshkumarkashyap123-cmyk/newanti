/**
 * ============================================================================
 * CABLE AND MEMBRANE STRUCTURE ANALYSIS ENGINE
 * ============================================================================
 * 
 * Advanced analysis for tension structures including:
 * - Form-finding algorithms
 * - Cable net analysis
 * - Membrane stress analysis
 * - Wind and snow loading
 * - Patterning for fabrication
 * 
 * Methods Supported:
 * - Force Density Method (FDM)
 * - Dynamic Relaxation
 * - Updated Reference Strategy
 * - Newton-Raphson for geometrically nonlinear
 * 
 * Applications:
 * - Cable-stayed structures
 * - Suspension bridges
 * - Tensile membrane roofs
 * - Air-supported structures
 * - Mast and guy-wire systems
 * 
 * @version 1.0.0
 */

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface Node3D {
  id: string;
  x: number;
  y: number;
  z: number;
  fixed: {
    x: boolean;
    y: boolean;
    z: boolean;
  };
  load?: {
    fx: number;
    fy: number;
    fz: number;
  };
}

export interface CableElement {
  id: string;
  startNodeId: string;
  endNodeId: string;
  material: {
    E: number; // Elastic modulus (MPa)
    density: number; // kg/m³
  };
  area: number; // Cross-sectional area (mm²)
  prestress?: number; // Initial tension (kN)
  forceDensity?: number; // For form-finding (kN/m)
}

export interface MembraneElement {
  id: string;
  nodeIds: string[]; // 3 or 4 node IDs (triangle or quad)
  material: {
    warpModulus: number; // MPa
    weftModulus: number; // MPa
    shearModulus: number; // MPa
    poissonsRatio: number;
    thickness: number; // mm
    density: number; // kg/m²
  };
  prestress: {
    warp: number; // kN/m
    weft: number; // kN/m
  };
  warpDirection: { x: number; y: number; z: number }; // Unit vector
}

export interface FormFindingResult {
  converged: boolean;
  iterations: number;
  residual: number;
  nodes: Node3D[];
  elementForces: Map<string, number>; // Element ID -> force (kN)
  membraneStresses?: Map<string, { warp: number; weft: number; shear: number }>;
}

export interface LoadAnalysisResult {
  displacement: Map<string, { dx: number; dy: number; dz: number }>;
  reactions: Map<string, { rx: number; ry: number; rz: number }>;
  cableForces: Map<string, { tension: number; strain: number }>;
  membraneStresses?: Map<string, {
    warp: number;
    weft: number;
    shear: number;
    principal1: number;
    principal2: number;
    direction: number;
  }>;
  maxDeflection: number;
  status: 'stable' | 'slack-cable' | 'wrinkled' | 'failed';
}

export interface PatternResult {
  panelId: string;
  flatCoordinates: { u: number; v: number }[];
  strainCompensation: { warp: number; weft: number };
  seamAllowance: number;
  area: number;
}

// ============================================================================
// CABLE ELEMENT ANALYSIS
// ============================================================================

export class CableAnalysis {
  /**
   * Calculate cable length between two points
   */
  static chordLength(node1: Node3D, node2: Node3D): number {
    return Math.sqrt(
      Math.pow(node2.x - node1.x, 2) +
      Math.pow(node2.y - node1.y, 2) +
      Math.pow(node2.z - node1.z, 2)
    );
  }

  /**
   * Calculate catenary cable profile
   */
  static catenaryProfile(
    span: number, // Horizontal span (m)
    sag: number, // Maximum sag (m)
    cableWeight: number, // Weight per unit length (kN/m)
    numPoints: number = 21
  ): {
    x: number[];
    y: number[];
    length: number;
    horizontalTension: number;
    maxTension: number;
  } {
    // Find catenary parameter 'a'
    // sag = a * (cosh(span/(2*a)) - 1)
    let a = span * span / (8 * sag); // Initial estimate from parabola
    
    // Newton-Raphson to solve for 'a'
    for (let iter = 0; iter < 20; iter++) {
      const f = a * (Math.cosh(span / (2 * a)) - 1) - sag;
      const df = Math.cosh(span / (2 * a)) - 1 - 
                 (span / (2 * a)) * Math.sinh(span / (2 * a));
      const da = f / df;
      a -= da;
      if (Math.abs(da) < 1e-10) break;
    }

    // Calculate horizontal tension
    const H = cableWeight * a;

    // Generate profile points
    const x: number[] = [];
    const y: number[] = [];
    const dx = span / (numPoints - 1);

    for (let i = 0; i < numPoints; i++) {
      const xi = -span / 2 + i * dx;
      x.push(xi);
      y.push(a * Math.cosh(xi / a) - a);
    }

    // Calculate cable length
    const length = 2 * a * Math.sinh(span / (2 * a));

    // Maximum tension (at supports)
    const maxTension = H * Math.cosh(span / (2 * a));

    return { x, y, length, horizontalTension: H, maxTension };
  }

  /**
   * Parabolic cable approximation (for uniform load)
   */
  static parabolicProfile(
    span: number,
    load: number, // Uniform load (kN/m)
    horizontalTension: number
  ): {
    sag: number;
    length: number;
    maxSlope: number;
    maxTension: number;
  } {
    const sag = load * span * span / (8 * horizontalTension);
    
    // Approximate arc length
    const length = span * (1 + 8 * Math.pow(sag / span, 2) / 3);
    
    // Maximum slope at supports
    const maxSlope = Math.atan(4 * sag / span) * 180 / Math.PI;
    
    // Maximum tension at supports
    const maxTension = horizontalTension / Math.cos(Math.atan(4 * sag / span));

    return { sag, length, maxSlope, maxTension };
  }

  /**
   * Calculate cable prestress required for target frequency
   */
  static prestressForFrequency(
    length: number, // m
    massPerLength: number, // kg/m
    targetFrequency: number, // Hz
    mode: number = 1
  ): number {
    // f = n/(2L) * sqrt(T/m)
    // T = m * (2*L*f/n)^2
    const T = massPerLength * Math.pow(2 * length * targetFrequency / mode, 2);
    return T / 1000; // kN
  }
}

// ============================================================================
// FORCE DENSITY METHOD
// ============================================================================

export class ForceDensityMethod {
  private nodes: Map<string, Node3D> = new Map();
  private cables: Map<string, CableElement> = new Map();
  private membranes: Map<string, MembraneElement> = new Map();

  constructor(
    nodes: Node3D[],
    cables: CableElement[],
    membranes: MembraneElement[] = []
  ) {
    nodes.forEach(n => this.nodes.set(n.id, n));
    cables.forEach(c => this.cables.set(c.id, c));
    membranes.forEach(m => this.membranes.set(m.id, m));
  }

  /**
   * Perform form-finding using Force Density Method
   */
  formFind(maxIterations: number = 100, tolerance: number = 1e-6): FormFindingResult {
    const nodeList = Array.from(this.nodes.values());
    const cableList = Array.from(this.cables.values());
    
    // Identify free and fixed nodes
    const freeNodes = nodeList.filter(n => !n.fixed.x || !n.fixed.y || !n.fixed.z);
    const nFree = freeNodes.length;
    
    // Build connectivity matrix and force density matrix
    // For each cable: q = T/L (force density)
    
    // Assemble system: [D] * [x] = [p] + [Df] * [xf]
    // Where D is the force density stiffness matrix
    
    const nodeIndex = new Map<string, number>();
    freeNodes.forEach((n, i) => nodeIndex.set(n.id, i));

    // Initialize coordinate arrays
    let x = freeNodes.map(n => n.x);
    let y = freeNodes.map(n => n.y);
    let z = freeNodes.map(n => n.z);

    // External loads
    const px = freeNodes.map(n => n.load?.fx || 0);
    const py = freeNodes.map(n => n.load?.fy || 0);
    const pz = freeNodes.map(n => n.load?.fz || 0);

    let converged = false;
    let iteration = 0;
    let residual = 1e10;

    // Iterative solution (simplified direct method)
    for (iteration = 0; iteration < maxIterations; iteration++) {
      // Build stiffness matrix D
      const D = this.buildForceDensityMatrix(nodeIndex, nFree);
      
      // Build load vector from fixed nodes
      const { bx, by, bz } = this.buildFixedNodeContribution(nodeIndex, nFree);

      // Right-hand side
      const rx = px.map((p, i) => p + bx[i]);
      const ry = py.map((p, i) => p + by[i]);
      const rz = pz.map((p, i) => p + bz[i]);

      // Solve [D] * [x] = [r]
      const xNew = this.solveLinearSystem(D, rx);
      const yNew = this.solveLinearSystem(D, ry);
      const zNew = this.solveLinearSystem(D, rz);

      // Check convergence
      residual = 0;
      for (let i = 0; i < nFree; i++) {
        residual += Math.pow(xNew[i] - x[i], 2);
        residual += Math.pow(yNew[i] - y[i], 2);
        residual += Math.pow(zNew[i] - z[i], 2);
      }
      residual = Math.sqrt(residual);

      x = xNew;
      y = yNew;
      z = zNew;

      if (residual < tolerance) {
        converged = true;
        break;
      }
    }

    // Update node positions
    const resultNodes: Node3D[] = [];
    for (const node of nodeList) {
      if (nodeIndex.has(node.id)) {
        const idx = nodeIndex.get(node.id)!;
        resultNodes.push({
          ...node,
          x: x[idx],
          y: y[idx],
          z: z[idx]
        });
      } else {
        resultNodes.push({ ...node });
      }
    }

    // Calculate element forces
    const elementForces = new Map<string, number>();
    for (const cable of cableList) {
      const n1 = resultNodes.find(n => n.id === cable.startNodeId)!;
      const n2 = resultNodes.find(n => n.id === cable.endNodeId)!;
      const L = CableAnalysis.chordLength(n1, n2);
      const q = cable.forceDensity || 1;
      elementForces.set(cable.id, q * L);
    }

    return {
      converged,
      iterations: iteration,
      residual,
      nodes: resultNodes,
      elementForces
    };
  }

  private buildForceDensityMatrix(
    nodeIndex: Map<string, number>,
    nFree: number
  ): number[][] {
    const D: number[][] = Array(nFree).fill(0).map(() => Array(nFree).fill(0));

    for (const cable of this.cables.values()) {
      const q = cable.forceDensity || 1;
      const i = nodeIndex.get(cable.startNodeId);
      const j = nodeIndex.get(cable.endNodeId);

      if (i !== undefined && j !== undefined) {
        D[i][i] += q;
        D[j][j] += q;
        D[i][j] -= q;
        D[j][i] -= q;
      } else if (i !== undefined) {
        D[i][i] += q;
      } else if (j !== undefined) {
        D[j][j] += q;
      }
    }

    return D;
  }

  private buildFixedNodeContribution(
    nodeIndex: Map<string, number>,
    nFree: number
  ): { bx: number[]; by: number[]; bz: number[] } {
    const bx = Array(nFree).fill(0);
    const by = Array(nFree).fill(0);
    const bz = Array(nFree).fill(0);

    for (const cable of this.cables.values()) {
      const q = cable.forceDensity || 1;
      const i = nodeIndex.get(cable.startNodeId);
      const j = nodeIndex.get(cable.endNodeId);

      const n1 = this.nodes.get(cable.startNodeId)!;
      const n2 = this.nodes.get(cable.endNodeId)!;

      if (i !== undefined && j === undefined) {
        // End node is fixed
        bx[i] += q * n2.x;
        by[i] += q * n2.y;
        bz[i] += q * n2.z;
      } else if (j !== undefined && i === undefined) {
        // Start node is fixed
        bx[j] += q * n1.x;
        by[j] += q * n1.y;
        bz[j] += q * n1.z;
      }
    }

    return { bx, by, bz };
  }

  private solveLinearSystem(A: number[][], b: number[]): number[] {
    // Gaussian elimination with partial pivoting
    const n = b.length;
    const aug: number[][] = A.map((row, i) => [...row, b[i]]);

    // Forward elimination
    for (let k = 0; k < n; k++) {
      // Find pivot
      let maxRow = k;
      for (let i = k + 1; i < n; i++) {
        if (Math.abs(aug[i][k]) > Math.abs(aug[maxRow][k])) {
          maxRow = i;
        }
      }
      [aug[k], aug[maxRow]] = [aug[maxRow], aug[k]];

      // Eliminate
      for (let i = k + 1; i < n; i++) {
        const factor = aug[i][k] / aug[k][k];
        for (let j = k; j <= n; j++) {
          aug[i][j] -= factor * aug[k][j];
        }
      }
    }

    // Back substitution
    const x = Array(n).fill(0);
    for (let i = n - 1; i >= 0; i--) {
      x[i] = aug[i][n];
      for (let j = i + 1; j < n; j++) {
        x[i] -= aug[i][j] * x[j];
      }
      x[i] /= aug[i][i];
    }

    return x;
  }
}

// ============================================================================
// DYNAMIC RELAXATION
// ============================================================================

export class DynamicRelaxation {
  private nodes: Map<string, Node3D>;
  private cables: CableElement[];
  private membranes: MembraneElement[];

  constructor(
    nodes: Node3D[],
    cables: CableElement[],
    membranes: MembraneElement[] = []
  ) {
    this.nodes = new Map(nodes.map(n => [n.id, { ...n }]));
    this.cables = cables;
    this.membranes = membranes;
  }

  /**
   * Form-finding using kinetic dynamic relaxation
   */
  formFind(
    options: {
      maxIterations: number;
      tolerance: number;
      dampingRatio: number;
      timeStep: number;
    }
  ): FormFindingResult {
    const { maxIterations, tolerance, dampingRatio, timeStep } = options;

    // Initialize velocities
    const velocities = new Map<string, { vx: number; vy: number; vz: number }>();
    for (const node of this.nodes.values()) {
      velocities.set(node.id, { vx: 0, vy: 0, vz: 0 });
    }

    // Fictitious masses (based on connectivity)
    const masses = this.calculateFictitiousMasses();

    let converged = false;
    let iteration = 0;
    let kineticEnergy = 1e10;
    let previousKE = 0;

    for (iteration = 0; iteration < maxIterations; iteration++) {
      // Calculate internal forces
      const forces = this.calculateInternalForces();

      // Add external loads
      for (const node of this.nodes.values()) {
        if (node.load) {
          const f = forces.get(node.id)!;
          f.fx += node.load.fx;
          f.fy += node.load.fy;
          f.fz += node.load.fz;
        }
      }

      // Update velocities and positions
      kineticEnergy = 0;
      for (const [nodeId, node] of this.nodes) {
        if (node.fixed.x && node.fixed.y && node.fixed.z) continue;

        const mass = masses.get(nodeId)!;
        const force = forces.get(nodeId)!;
        const vel = velocities.get(nodeId)!;

        // Damped velocity update
        if (!node.fixed.x) {
          vel.vx = (1 - dampingRatio) * vel.vx + (force.fx / mass) * timeStep;
          node.x += vel.vx * timeStep;
          kineticEnergy += 0.5 * mass * vel.vx * vel.vx;
        }
        if (!node.fixed.y) {
          vel.vy = (1 - dampingRatio) * vel.vy + (force.fy / mass) * timeStep;
          node.y += vel.vy * timeStep;
          kineticEnergy += 0.5 * mass * vel.vy * vel.vy;
        }
        if (!node.fixed.z) {
          vel.vz = (1 - dampingRatio) * vel.vz + (force.fz / mass) * timeStep;
          node.z += vel.vz * timeStep;
          kineticEnergy += 0.5 * mass * vel.vz * vel.vz;
        }
      }

      // Check for kinetic energy peak (reset velocities)
      if (kineticEnergy < previousKE) {
        // Reset velocities to zero
        for (const vel of velocities.values()) {
          vel.vx = 0;
          vel.vy = 0;
          vel.vz = 0;
        }
      }
      previousKE = kineticEnergy;

      // Check convergence
      if (kineticEnergy < tolerance) {
        converged = true;
        break;
      }
    }

    // Calculate final element forces
    const elementForces = new Map<string, number>();
    for (const cable of this.cables) {
      const n1 = this.nodes.get(cable.startNodeId)!;
      const n2 = this.nodes.get(cable.endNodeId)!;
      const L = CableAnalysis.chordLength(n1, n2);
      const L0 = cable.prestress ? 
        L - cable.prestress * 1000 / (cable.material.E * cable.area) : L;
      const strain = (L - L0) / L0;
      const force = cable.material.E * cable.area * strain / 1000;
      elementForces.set(cable.id, Math.max(0, force));
    }

    return {
      converged,
      iterations: iteration,
      residual: kineticEnergy,
      nodes: Array.from(this.nodes.values()),
      elementForces
    };
  }

  private calculateFictitiousMasses(): Map<string, number> {
    const masses = new Map<string, number>();
    
    // Initialize with base mass
    for (const node of this.nodes.values()) {
      masses.set(node.id, 1.0);
    }

    // Add contributions from cables
    for (const cable of this.cables) {
      const n1 = this.nodes.get(cable.startNodeId)!;
      const n2 = this.nodes.get(cable.endNodeId)!;
      const L = CableAnalysis.chordLength(n1, n2);
      const stiffness = cable.material.E * cable.area / L;
      
      masses.set(cable.startNodeId, masses.get(cable.startNodeId)! + stiffness * 0.01);
      masses.set(cable.endNodeId, masses.get(cable.endNodeId)! + stiffness * 0.01);
    }

    return masses;
  }

  private calculateInternalForces(): Map<string, { fx: number; fy: number; fz: number }> {
    const forces = new Map<string, { fx: number; fy: number; fz: number }>();
    
    // Initialize
    for (const node of this.nodes.values()) {
      forces.set(node.id, { fx: 0, fy: 0, fz: 0 });
    }

    // Cable contributions
    for (const cable of this.cables) {
      const n1 = this.nodes.get(cable.startNodeId)!;
      const n2 = this.nodes.get(cable.endNodeId)!;
      
      const dx = n2.x - n1.x;
      const dy = n2.y - n1.y;
      const dz = n2.z - n1.z;
      const L = Math.sqrt(dx * dx + dy * dy + dz * dz);

      // Force magnitude (from prestress or force density)
      const T = cable.forceDensity ? cable.forceDensity * L :
                (cable.prestress || 0);

      // Unit vector
      const ux = dx / L;
      const uy = dy / L;
      const uz = dz / L;

      // Add to node forces
      const f1 = forces.get(cable.startNodeId)!;
      const f2 = forces.get(cable.endNodeId)!;

      f1.fx += T * ux;
      f1.fy += T * uy;
      f1.fz += T * uz;

      f2.fx -= T * ux;
      f2.fy -= T * uy;
      f2.fz -= T * uz;
    }

    return forces;
  }
}

// ============================================================================
// MEMBRANE STRESS ANALYSIS
// ============================================================================

export class MembraneAnalysis {
  /**
   * Calculate membrane stresses for triangular element
   */
  static triangleStresses(
    nodes: [Node3D, Node3D, Node3D],
    material: MembraneElement['material'],
    prestress: MembraneElement['prestress'],
    displacements: [
      { dx: number; dy: number; dz: number },
      { dx: number; dy: number; dz: number },
      { dx: number; dy: number; dz: number }
    ]
  ): {
    warp: number;
    weft: number;
    shear: number;
    principal1: number;
    principal2: number;
    direction: number;
  } {
    // Calculate deformed coordinates
    const x = nodes.map((n, i) => n.x + displacements[i].dx);
    const y = nodes.map((n, i) => n.y + displacements[i].dy);
    const z = nodes.map((n, i) => n.z + displacements[i].dz);

    // Calculate strains (simplified 2D membrane)
    const area = this.triangleArea(nodes);
    const deformedArea = this.triangleAreaFromCoords(x, y, z);
    const areaStrain = (deformedArea - area) / area;

    // Approximate strains
    const strainWarp = areaStrain * 0.5;
    const strainWeft = areaStrain * 0.5;
    const strainShear = 0;

    // Calculate stresses using orthotropic material
    const { warpModulus, weftModulus, shearModulus, poissonsRatio, thickness } = material;

    const stressWarp = prestress.warp + (warpModulus * strainWarp + 
                       poissonsRatio * weftModulus * strainWeft) * thickness / 1000;
    const stressWeft = prestress.weft + (weftModulus * strainWeft + 
                       poissonsRatio * warpModulus * strainWarp) * thickness / 1000;
    const stressShear = shearModulus * strainShear * thickness / 1000;

    // Principal stresses
    const avg = (stressWarp + stressWeft) / 2;
    const diff = (stressWarp - stressWeft) / 2;
    const R = Math.sqrt(diff * diff + stressShear * stressShear);

    const principal1 = avg + R;
    const principal2 = avg - R;
    const direction = Math.atan2(stressShear, diff) / 2 * 180 / Math.PI;

    return { warp: stressWarp, weft: stressWeft, shear: stressShear, 
             principal1, principal2, direction };
  }

  private static triangleArea(nodes: Node3D[]): number {
    const v1 = {
      x: nodes[1].x - nodes[0].x,
      y: nodes[1].y - nodes[0].y,
      z: nodes[1].z - nodes[0].z
    };
    const v2 = {
      x: nodes[2].x - nodes[0].x,
      y: nodes[2].y - nodes[0].y,
      z: nodes[2].z - nodes[0].z
    };

    // Cross product
    const cx = v1.y * v2.z - v1.z * v2.y;
    const cy = v1.z * v2.x - v1.x * v2.z;
    const cz = v1.x * v2.y - v1.y * v2.x;

    return 0.5 * Math.sqrt(cx * cx + cy * cy + cz * cz);
  }

  private static triangleAreaFromCoords(x: number[], y: number[], z: number[]): number {
    const v1 = { x: x[1] - x[0], y: y[1] - y[0], z: z[1] - z[0] };
    const v2 = { x: x[2] - x[0], y: y[2] - y[0], z: z[2] - z[0] };

    const cx = v1.y * v2.z - v1.z * v2.y;
    const cy = v1.z * v2.x - v1.x * v2.z;
    const cz = v1.x * v2.y - v1.y * v2.x;

    return 0.5 * Math.sqrt(cx * cx + cy * cy + cz * cz);
  }

  /**
   * Check for wrinkling in membrane
   */
  static checkWrinkling(
    principal2: number, // Minor principal stress
    tolerance: number = 0.1 // kN/m
  ): { wrinkled: boolean; severity: 'none' | 'slight' | 'moderate' | 'severe' } {
    if (principal2 >= tolerance) {
      return { wrinkled: false, severity: 'none' };
    } else if (principal2 >= 0) {
      return { wrinkled: true, severity: 'slight' };
    } else if (principal2 >= -tolerance * 2) {
      return { wrinkled: true, severity: 'moderate' };
    } else {
      return { wrinkled: true, severity: 'severe' };
    }
  }
}

// ============================================================================
// PATTERNING FOR FABRICATION
// ============================================================================

export class MembranePatterning {
  /**
   * Flatten 3D membrane panel to 2D cutting pattern
   */
  static flattenPanel(
    nodes3D: Node3D[], // Ordered boundary nodes
    compensation: { warp: number; weft: number }, // Strain compensation (%)
    seamAllowance: number // mm
  ): PatternResult {
    // Unfold using geodesic method (simplified)
    const flatCoords: { u: number; v: number }[] = [];

    // Start with first edge
    if (nodes3D.length < 3) {
      return {
        panelId: '',
        flatCoordinates: [],
        strainCompensation: compensation,
        seamAllowance,
        area: 0
      };
    }

    // First point at origin
    flatCoords.push({ u: 0, v: 0 });

    // Second point along u-axis
    const L01 = CableAnalysis.chordLength(nodes3D[0], nodes3D[1]);
    flatCoords.push({ u: L01, v: 0 });

    // Remaining points by triangulation
    for (let i = 2; i < nodes3D.length; i++) {
      const L0i = CableAnalysis.chordLength(nodes3D[0], nodes3D[i]);
      const Li1i = CableAnalysis.chordLength(nodes3D[i - 1], nodes3D[i]);

      // Find intersection of two circles
      const prev = flatCoords[i - 1];
      const first = flatCoords[0];

      // Solve for intersection
      const { u, v } = this.circleIntersection(
        first.u, first.v, L0i,
        prev.u, prev.v, Li1i
      );

      flatCoords.push({ u, v });
    }

    // Apply strain compensation
    for (const coord of flatCoords) {
      coord.u *= (1 - compensation.warp / 100);
      coord.v *= (1 - compensation.weft / 100);
    }

    // Add seam allowance (offset boundary outward)
    // Simplified: just note the allowance

    // Calculate area
    let area = 0;
    for (let i = 0; i < flatCoords.length; i++) {
      const j = (i + 1) % flatCoords.length;
      area += flatCoords[i].u * flatCoords[j].v;
      area -= flatCoords[j].u * flatCoords[i].v;
    }
    area = Math.abs(area) / 2;

    return {
      panelId: '',
      flatCoordinates: flatCoords,
      strainCompensation: compensation,
      seamAllowance,
      area
    };
  }

  private static circleIntersection(
    x1: number, y1: number, r1: number,
    x2: number, y2: number, r2: number
  ): { u: number; v: number } {
    const d = Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));

    if (d > r1 + r2 || d < Math.abs(r1 - r2)) {
      // No intersection or one inside other
      return { u: x2, v: y1 + r1 };
    }

    const a = (r1 * r1 - r2 * r2 + d * d) / (2 * d);
    const h = Math.sqrt(Math.max(0, r1 * r1 - a * a));

    const px = x1 + a * (x2 - x1) / d;
    const py = y1 + a * (y2 - y1) / d;

    // Return the intersection with positive y (above the baseline)
    const u = px - h * (y2 - y1) / d;
    const v = py + h * (x2 - x1) / d;

    return { u, v };
  }
}

// ============================================================================
// WIND LOADING ON TENSILE STRUCTURES
// ============================================================================

export class TensileWindLoading {
  /**
   * Calculate wind pressure coefficients for canopy
   */
  static canopyCoefficients(
    shape: 'flat' | 'single-curve' | 'double-curve' | 'conical',
    slopeAngle: number, // degrees
    openness: 'closed' | 'partially-open' | 'open'
  ): { cpMax: number; cpMin: number } {
    // Simplified coefficients based on common tensile shapes
    let cpMax: number, cpMin: number;

    switch (shape) {
      case 'flat':
        cpMax = 0.7;
        cpMin = -1.3;
        break;
      case 'single-curve':
        cpMax = 0.5;
        cpMin = -1.5;
        break;
      case 'double-curve':
        cpMax = 0.4;
        cpMin = -1.2;
        break;
      case 'conical':
        cpMax = 0.6;
        cpMin = -1.8;
        break;
      default:
        cpMax = 0.7;
        cpMin = -1.5;
    }

    // Adjust for slope
    if (slopeAngle > 30) {
      cpMax += 0.2;
    }

    // Adjust for openness (internal pressure)
    if (openness === 'open') {
      cpMax += 0.6;
      cpMin -= 0.5;
    } else if (openness === 'partially-open') {
      cpMax += 0.3;
      cpMin -= 0.3;
    }

    return { cpMax, cpMin };
  }

  /**
   * Calculate flutter risk for membrane
   */
  static flutterCheck(
    membraneTension: number, // kN/m (minimum)
    windSpeed: number, // m/s
    airDensity: number = 1.25, // kg/m³
    span: number // m
  ): { riskLevel: 'low' | 'moderate' | 'high'; criticalSpeed: number } {
    // Simplified flutter criterion
    // Critical wind speed ~ sqrt(T / (ρ * L))
    const criticalSpeed = Math.sqrt(membraneTension * 1000 / (airDensity * span));

    let riskLevel: 'low' | 'moderate' | 'high';
    if (windSpeed < criticalSpeed * 0.5) {
      riskLevel = 'low';
    } else if (windSpeed < criticalSpeed * 0.8) {
      riskLevel = 'moderate';
    } else {
      riskLevel = 'high';
    }

    return { riskLevel, criticalSpeed };
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  CableAnalysis,
  ForceDensityMethod,
  DynamicRelaxation,
  MembraneAnalysis,
  MembranePatterning,
  TensileWindLoading
};
