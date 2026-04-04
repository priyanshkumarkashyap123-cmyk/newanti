/**
 * PipeNetworkEngine.ts
 * =============================================================================
 * Comprehensive pipe network analysis engine supporting:
 *   - Hardy Cross iterative method
 *   - Linear Theory (simultaneous loop) method
 *   - Newton-Raphson method for pipe networks
 *   - Pipe sizing and economic design
 *   - Demand-driven analysis
 *   - Pressure and head calculations
 *   - Multiple friction models (Darcy-Weisbach, Hazen-Williams, Manning)
 *   - IS 783 / IS 2185 pipe material databases
 * =============================================================================
 */

// =============================================================================
// CONSTANTS
// =============================================================================

const GRAVITY = 9.81; // m/s²
const KINEMATIC_VISCOSITY = 1.004e-6; // m²/s at 20°C
const WATER_DENSITY = 998.2; // kg/m³ at 20°C

// =============================================================================
// TYPES & INTERFACES
// =============================================================================

/** Node types in a pipe network */
export type NodeType = 'junction' | 'reservoir' | 'tank';

/** Friction model for head loss calculation */
export type FrictionModel = 'hazen-williams' | 'darcy-weisbach' | 'manning';

/** Analysis methods */
export type AnalysisMethod = 'hardy-cross' | 'linear-theory' | 'newton-raphson';

/** Pipe material properties */
export interface PipeMaterial {
  name: string;
  roughness: number;         // Darcy-Weisbach roughness ε (mm)
  hazenWilliamsC: number;    // Hazen-Williams coefficient
  manningN: number;          // Manning's n
  modulusOfElasticity: number; // Pa
  maxPressure: number;       // kPa
  costPerMeterPerMm: number; // ₹/m per mm diameter (approx.)
}

/** Network node definition */
export interface NetworkNode {
  id: string;
  label: string;
  type: NodeType;
  x: number;                 // Position for visualization
  y: number;
  elevation: number;         // m above datum
  demand: number;            // m³/s (positive = extraction, negative = inflow)
  head?: number;             // Fixed head for reservoirs/tanks (m)
  minPressure?: number;      // Minimum required pressure (m of water)
  computedHead?: number;     // Computed by analysis
  computedPressure?: number; // Computed = head - elevation
}

/** Network pipe definition */
export interface NetworkPipe {
  id: string;
  label: string;
  startNodeId: string;
  endNodeId: string;
  length: number;            // m
  diameter: number;          // m
  roughness: number;         // mm (ε for D-W) or C for H-W or n for Manning
  minorLossK: number;        // Sum of minor loss coefficients
  material: string;          // Material name
  initialFlow?: number;      // Initial flow guess (m³/s), positive = start→end
  // Computed results
  computedFlow?: number;     // Final flow (m³/s)
  computedVelocity?: number; // V = Q/A
  computedHeadLoss?: number; // Total head loss (m)
  computedFrictionLoss?: number;
  computedMinorLoss?: number;
  reynoldsNumber?: number;
  frictionFactor?: number;
}

/** Loop definition for Hardy Cross / loop-based methods */
export interface NetworkLoop {
  id: string;
  label: string;
  /** Ordered pipe IDs forming the loop. Positive = clockwise direction */
  pipeIds: string[];
  /** Direction sign for each pipe: +1 if pipe direction agrees with loop, -1 otherwise */
  directions: number[];
}

/** Analysis configuration */
export interface AnalysisConfig {
  method: AnalysisMethod;
  frictionModel: FrictionModel;
  tolerance: number;         // Convergence tolerance (m³/s or m)
  maxIterations: number;
  gravitationalAccel: number;
  kinematicViscosity: number;
  waterDensity: number;
}

/** Iteration log entry */
export interface IterationLog {
  iteration: number;
  maxCorrection: number;
  loopCorrections: { loopId: string; correction: number }[];
  converged: boolean;
}

/** Complete analysis results */
export interface AnalysisResult {
  success: boolean;
  message: string;
  method: AnalysisMethod;
  frictionModel: FrictionModel;
  iterations: number;
  converged: boolean;
  maxResidual: number;
  pipes: NetworkPipe[];
  nodes: NetworkNode[];
  iterationLog: IterationLog[];
  /** Total system head loss */
  totalHeadLoss: number;
  /** System energy efficiency */
  energyGrade: { nodeId: string; hgl: number; egl: number }[];
  /** Warnings */
  warnings: string[];
}

/** Pipe sizing result */
export interface PipeSizingResult {
  pipeId: string;
  requiredDiameter: number;  // m
  selectedDiameter: number;  // m (next standard size)
  velocity: number;          // m/s
  headLoss: number;          // m
  headLossPerKm: number;     // m/km
  material: string;
  costEstimate: number;      // ₹
}

/** Network design result */
export interface NetworkDesignResult {
  analysisResult: AnalysisResult;
  sizing: PipeSizingResult[];
  totalCost: number;
  totalLength: number;
  maxVelocity: number;
  maxHeadLoss: number;
  designAdequate: boolean;
  recommendations: string[];
}

// =============================================================================
// PIPE MATERIAL DATABASE
// =============================================================================

export const PIPE_MATERIALS: Record<string, PipeMaterial> = {
  'CI': {
    name: 'Cast Iron (CI)',
    roughness: 0.26,
    hazenWilliamsC: 130,
    manningN: 0.013,
    modulusOfElasticity: 100e9,
    maxPressure: 2400,
    costPerMeterPerMm: 3.5,
  },
  'DI': {
    name: 'Ductile Iron (DI)',
    roughness: 0.12,
    hazenWilliamsC: 140,
    manningN: 0.011,
    modulusOfElasticity: 165e9,
    maxPressure: 3500,
    costPerMeterPerMm: 4.0,
  },
  'MS': {
    name: 'Mild Steel (MS)',
    roughness: 0.045,
    hazenWilliamsC: 140,
    manningN: 0.011,
    modulusOfElasticity: 200e9,
    maxPressure: 7000,
    costPerMeterPerMm: 3.2,
  },
  'GI': {
    name: 'Galvanized Iron (GI)',
    roughness: 0.15,
    hazenWilliamsC: 120,
    manningN: 0.013,
    modulusOfElasticity: 200e9,
    maxPressure: 2500,
    costPerMeterPerMm: 3.8,
  },
  'PVC': {
    name: 'PVC (uPVC)',
    roughness: 0.0015,
    hazenWilliamsC: 150,
    manningN: 0.009,
    modulusOfElasticity: 2.8e9,
    maxPressure: 1600,
    costPerMeterPerMm: 1.5,
  },
  'HDPE': {
    name: 'HDPE (PE100)',
    roughness: 0.007,
    hazenWilliamsC: 150,
    manningN: 0.009,
    modulusOfElasticity: 1.0e9,
    maxPressure: 1600,
    costPerMeterPerMm: 2.0,
  },
  'Concrete': {
    name: 'Reinforced Concrete',
    roughness: 1.0,
    hazenWilliamsC: 120,
    manningN: 0.013,
    modulusOfElasticity: 30e9,
    maxPressure: 500,
    costPerMeterPerMm: 2.5,
  },
  'AC': {
    name: 'Asbestos Cement (AC)',
    roughness: 0.03,
    hazenWilliamsC: 140,
    manningN: 0.011,
    modulusOfElasticity: 23e9,
    maxPressure: 900,
    costPerMeterPerMm: 1.2,
  },
};

/** Standard pipe diameters in mm (IS standards) */
export const STANDARD_DIAMETERS_MM = [
  15, 20, 25, 32, 40, 50, 65, 80, 100, 125, 150, 200, 250, 300,
  350, 400, 450, 500, 600, 700, 750, 800, 900, 1000, 1100, 1200,
  1400, 1500, 1600, 1800, 2000, 2200, 2400
];

// =============================================================================
// FRICTION & HEAD LOSS CALCULATIONS
// =============================================================================

export class FrictionCalculator {
  /**
   * Colebrook-White equation solver for Darcy friction factor
   * Uses Swamee-Jain explicit approximation then refines with iteration
   */
  static colebrookWhite(
    Re: number,
    roughness: number,   // mm
    diameter: number      // m
  ): number {
    if (Re < 2000) {
      return 64 / Re; // Laminar flow
    }

    const ε = roughness / 1000; // Convert to m
    const relRough = ε / diameter;

    // Swamee-Jain approximation (initial guess)
    let f = 0.25 / Math.pow(
      Math.log10(relRough / 3.7 + 5.74 / Math.pow(Re, 0.9)),
      2
    );

    // Newton-Raphson iterations on Colebrook-White
    for (let i = 0; i < 20; i++) {
      const sqrtF = Math.sqrt(f);
      const lhs = 1 / sqrtF;
      const rhs = -2 * Math.log10(relRough / 3.7 + 2.51 / (Re * sqrtF));
      const residual = lhs - rhs;
      
      if (Math.abs(residual) < 1e-10) break;

      // Derivative: d(1/√f)/df = -0.5 * f^(-3/2)
      // d(rhs)/df = -2/(ln10) * (2.51/(Re * √f)) * (-0.5/f) / (ε/(3.7D) + 2.51/(Re√f))
      const dLhs = -0.5 * Math.pow(f, -1.5);
      const term = relRough / 3.7 + 2.51 / (Re * sqrtF);
      const dRhs = -2 / Math.LN10 * (2.51 / (Re * sqrtF)) * (-0.5 / f) / term;
      
      f -= residual / (dLhs - dRhs);
      f = Math.max(f, 0.001); // Safety
    }

    return f;
  }

  /**
   * Reynolds number
   */
  static reynolds(velocity: number, diameter: number, nu: number = KINEMATIC_VISCOSITY): number {
    return velocity * diameter / nu;
  }

  /**
   * Darcy-Weisbach head loss: hf = f * L/D * V²/(2g)
   */
  static darcyWeisbachHeadLoss(
    flow: number,         // m³/s
    diameter: number,     // m
    length: number,       // m
    roughness: number,    // mm
    nu: number = KINEMATIC_VISCOSITY
  ): { headLoss: number; velocity: number; Re: number; f: number } {
    const A = Math.PI * diameter * diameter / 4;
    const V = Math.abs(flow) / A;
    const Re = this.reynolds(V, diameter, nu);
    const f = this.colebrookWhite(Re, roughness, diameter);
    const hf = f * (length / diameter) * (V * V) / (2 * GRAVITY);
    
    return { headLoss: hf, velocity: V, Re, f };
  }

  /**
   * Hazen-Williams head loss: hf = 10.67 * Q^1.852 / (C^1.852 * D^4.87) * L
   */
  static hazenWilliamsHeadLoss(
    flow: number,         // m³/s
    C: number,            // Hazen-Williams coefficient
    diameter: number,     // m
    length: number        // m
  ): { headLoss: number; velocity: number } {
    const A = Math.PI * diameter * diameter / 4;
    const V = Math.abs(flow) / A;
    const Q = Math.abs(flow);
    const hf = 10.67 * Math.pow(Q, 1.852) / (Math.pow(C, 1.852) * Math.pow(diameter, 4.87)) * length;
    
    return { headLoss: hf, velocity: V };
  }

  /**
   * Manning formula head loss: hf = (10.29 * n² * Q² / D^(16/3)) * L
   */
  static manningHeadLoss(
    flow: number,         // m³/s
    n: number,            // Manning's roughness
    diameter: number,     // m
    length: number        // m
  ): { headLoss: number; velocity: number } {
    const A = Math.PI * diameter * diameter / 4;
    const V = Math.abs(flow) / A;
    const Q = Math.abs(flow);
    const hf = 10.29 * n * n * Q * Q / Math.pow(diameter, 16 / 3) * length;
    
    return { headLoss: hf, velocity: V };
  }

  /**
   * Minor (local) losses: hm = K * V²/(2g)
   */
  static minorHeadLoss(velocity: number, K: number): number {
    return K * velocity * velocity / (2 * GRAVITY);
  }

  /**
   * Compute total head loss for a pipe using specified friction model
   */
  static computePipeHeadLoss(
    pipe: NetworkPipe,
    flow: number,
    model: FrictionModel,
    nu: number = KINEMATIC_VISCOSITY
  ): {
    totalLoss: number;
    frictionLoss: number;
    minorLoss: number;
    velocity: number;
    Re: number;
    f: number;
  } {
    const absFlow = Math.abs(flow);
    let frictionLoss: number;
    let velocity: number;
    let Re = 0;
    let f = 0;

    if (absFlow < 1e-12) {
      return { totalLoss: 0, frictionLoss: 0, minorLoss: 0, velocity: 0, Re: 0, f: 0 };
    }

    switch (model) {
      case 'darcy-weisbach': {
        const dw = this.darcyWeisbachHeadLoss(absFlow, pipe.diameter, pipe.length, pipe.roughness, nu);
        frictionLoss = dw.headLoss;
        velocity = dw.velocity;
        Re = dw.Re;
        f = dw.f;
        break;
      }
      case 'hazen-williams': {
        const hw = this.hazenWilliamsHeadLoss(absFlow, pipe.roughness, pipe.diameter, pipe.length);
        frictionLoss = hw.headLoss;
        velocity = hw.velocity;
        break;
      }
      case 'manning': {
        const mn = this.manningHeadLoss(absFlow, pipe.roughness, pipe.diameter, pipe.length);
        frictionLoss = mn.headLoss;
        velocity = mn.velocity;
        break;
      }
      default:
        throw new Error(`Unknown friction model: ${model}`);
    }

    const minorLoss = this.minorHeadLoss(velocity, pipe.minorLossK);
    const totalLoss = frictionLoss + minorLoss;

    return { totalLoss, frictionLoss, minorLoss, velocity, Re, f };
  }

  /**
   * Get the exponent 'n' for the friction model (for head loss ~ Q^n relationship)
   * H-W: n=1.852, D-W: n≈2, Manning: n=2
   */
  static getFlowExponent(model: FrictionModel): number {
    switch (model) {
      case 'hazen-williams': return 1.852;
      case 'darcy-weisbach': return 2.0;
      case 'manning': return 2.0;
      default: return 2.0;
    }
  }
}

// =============================================================================
// NETWORK TOPOLOGY UTILITIES
// =============================================================================

export class NetworkTopology {
  /**
   * Build adjacency list from pipes
   */
  static buildAdjacency(
    pipes: NetworkPipe[]
  ): Map<string, { pipeId: string; neighbor: string; direction: number }[]> {
    const adj = new Map<string, { pipeId: string; neighbor: string; direction: number }[]>();
    
    for (const pipe of pipes) {
      if (!adj.has(pipe.startNodeId)) adj.set(pipe.startNodeId, []);
      if (!adj.has(pipe.endNodeId)) adj.set(pipe.endNodeId, []);
      
      adj.get(pipe.startNodeId)!.push({
        pipeId: pipe.id,
        neighbor: pipe.endNodeId,
        direction: 1,
      });
      adj.get(pipe.endNodeId)!.push({
        pipeId: pipe.id,
        neighbor: pipe.startNodeId,
        direction: -1,
      });
    }
    
    return adj;
  }

  /**
   * Check mass balance at each junction node.
   * ΣQ_in - ΣQ_out = demand at each junction
   */
  static checkMassBalance(
    nodes: NetworkNode[],
    pipes: NetworkPipe[],
    flows: Map<string, number>
  ): { nodeId: string; imbalance: number }[] {
    const results: { nodeId: string; imbalance: number }[] = [];
    
    for (const node of nodes) {
      if (node.type === 'reservoir') continue; // Reservoirs supply whatever is needed
      
      let netFlow = 0;
      for (const pipe of pipes) {
        const Q = flows.get(pipe.id) || 0;
        if (pipe.endNodeId === node.id) netFlow += Q;   // Inflow
        if (pipe.startNodeId === node.id) netFlow -= Q;  // Outflow
      }
      
      // Net inflow should equal demand
      const imbalance = netFlow - node.demand;
      results.push({ nodeId: node.id, imbalance });
    }
    
    return results;
  }

  /**
   * Auto-detect loops in the network using DFS
   */
  static detectLoops(
    nodes: NetworkNode[],
    pipes: NetworkPipe[]
  ): NetworkLoop[] {
    const adj = this.buildAdjacency(pipes);
    const loops: NetworkLoop[] = [];
    const visited = new Set<string>();
    const parent = new Map<string, { nodeId: string; pipeId: string } | null>();
    let loopCount = 0;

    // DFS-based loop detection
    const dfs = (nodeId: string, parentNode: string | null, parentPipe: string | null) => {
      visited.add(nodeId);
      parent.set(nodeId, parentNode ? { nodeId: parentNode, pipeId: parentPipe! } : null);

      const neighbors = adj.get(nodeId) || [];
      for (const { pipeId, neighbor } of neighbors) {
        if (pipeId === parentPipe) continue; // Don't go back on same pipe
        
        if (visited.has(neighbor)) {
          // Found a loop — trace back
          loopCount++;
          const loopPipeIds: string[] = [];
          const loopDirections: number[] = [];
          
          // Trace from current node back to neighbor
          let current = nodeId;
          const path: { nodeId: string; pipeId: string }[] = [];
          
          while (current !== neighbor) {
            const p = parent.get(current);
            if (!p) break;
            path.push({ nodeId: current, pipeId: p.pipeId });
            current = p.nodeId;
          }
          
          // Add the closing pipe
          path.unshift({ nodeId: nodeId, pipeId });
          
          // Build loop pipe list with directions
          for (const segment of path) {
            const pipe = pipes.find(pp => pp.id === segment.pipeId);
            if (!pipe) continue;
            
            loopPipeIds.push(segment.pipeId);
            // Direction: +1 if traversing pipe in its defined direction
            loopDirections.push(pipe.startNodeId === segment.nodeId ? 1 : -1);
          }
          
          if (loopPipeIds.length >= 3) {
            loops.push({
              id: `loop-${loopCount}`,
              label: `Loop ${loopCount}`,
              pipeIds: loopPipeIds,
              directions: loopDirections,
            });
          }
        } else {
          dfs(neighbor, nodeId, pipeId);
        }
      }
    };

    // Start DFS from first node
    if (nodes.length > 0) {
      dfs(nodes[0].id, null, null);
    }

    return loops;
  }

  /**
   * Assign initial flows satisfying mass balance at all junctions.
   * Uses a spanning tree approach.
   */
  static assignInitialFlows(
    nodes: NetworkNode[],
    pipes: NetworkPipe[]
  ): Map<string, number> {
    const flows = new Map<string, number>();
    const adj = this.buildAdjacency(pipes);
    
    // Initialize all pipe flows
    for (const pipe of pipes) {
      flows.set(pipe.id, pipe.initialFlow ?? 0);
    }

    // If initial flows provided, return them
    const hasInitialFlows = pipes.some(p => p.initialFlow !== undefined && p.initialFlow !== 0);
    if (hasInitialFlows) return flows;

    // Build spanning tree and assign flows to satisfy continuity
    const visited = new Set<string>();
    const queue: string[] = [];

    // Start from reservoir/tank nodes
    const sourceNodes = nodes.filter(n => n.type === 'reservoir' || n.type === 'tank');
    if (sourceNodes.length === 0 && nodes.length > 0) {
      queue.push(nodes[0].id);
    } else {
      for (const sn of sourceNodes) queue.push(sn.id);
    }

    // BFS to assign flows
    for (const start of queue) {
      if (visited.has(start)) continue;
      visited.add(start);
      const bfsQueue = [start];
      
      while (bfsQueue.length > 0) {
        const nodeId = bfsQueue.shift()!;
        const neighbors = adj.get(nodeId) || [];
        
        for (const { pipeId, neighbor, direction } of neighbors) {
          if (visited.has(neighbor)) continue;
          visited.add(neighbor);
          bfsQueue.push(neighbor);
          
          // Assign a small initial flow toward the junction (satisfying demand direction)
          const targetNode = nodes.find(n => n.id === neighbor);
          const demandFlow = targetNode ? Math.max(targetNode.demand, 0.001) : 0.001;
          
          // Flow goes from source toward demand
          if (direction === 1) {
            flows.set(pipeId, demandFlow); // Forward
          } else {
            flows.set(pipeId, -demandFlow); // Reverse
          }
        }
      }
    }

    return flows;
  }
}

// =============================================================================
// ANALYSIS METHODS
// =============================================================================

export class PipeNetworkAnalysis {
  /**
   * HARDY CROSS METHOD
   * ==================
   * Iterative method for analyzing pipe networks with loops.
   * For each loop, computes flow correction:
   *   ΔQ = -Σ(hf) / Σ(n * |hf/Q|)
   * where n is the flow exponent (1.852 for H-W, 2 for D-W)
   */
  static hardyCross(
    nodes: NetworkNode[],
    pipes: NetworkPipe[],
    loops: NetworkLoop[],
    config: AnalysisConfig
  ): AnalysisResult {
    const warnings: string[] = [];
    const iterationLog: IterationLog[] = [];
    const n = FrictionCalculator.getFlowExponent(config.frictionModel);
    
    // Initialize flows
    const flows = NetworkTopology.assignInitialFlows(nodes, pipes);
    
    // Override with any user-specified initial flows
    for (const pipe of pipes) {
      if (pipe.initialFlow !== undefined && pipe.initialFlow !== 0) {
        flows.set(pipe.id, pipe.initialFlow);
      }
    }

    let converged = false;
    let iterations = 0;
    let maxResidual = Infinity;

    // Create pipe lookup
    const pipeMap = new Map(pipes.map(p => [p.id, { ...p }]));

    for (iterations = 1; iterations <= config.maxIterations; iterations++) {
      let maxCorrection = 0;
      const loopCorrections: { loopId: string; correction: number }[] = [];

      for (const loop of loops) {
        let sumHeadLoss = 0;
        let sumDerivative = 0;

        for (let i = 0; i < loop.pipeIds.length; i++) {
          const pipeId = loop.pipeIds[i];
          const dir = loop.directions[i];
          const pipe = pipeMap.get(pipeId);
          if (!pipe) continue;

          const Q = flows.get(pipeId) || 0;
          const signedQ = Q * dir; // Flow relative to loop direction

          const result = FrictionCalculator.computePipeHeadLoss(
            pipe, Math.abs(Q), config.frictionModel, config.kinematicViscosity
          );

          // Head loss with sign (positive if flow agrees with loop direction)
          const signedHf = (signedQ >= 0 ? 1 : -1) * result.totalLoss;
          sumHeadLoss += signedHf;

          // Derivative term: n * |hf| / |Q|
          if (Math.abs(Q) > 1e-12) {
            sumDerivative += n * result.totalLoss / Math.abs(Q);
          }
        }

        // Correction for this loop
        const correction = sumDerivative > 0 ? -sumHeadLoss / sumDerivative : 0;
        loopCorrections.push({ loopId: loop.id, correction });
        maxCorrection = Math.max(maxCorrection, Math.abs(correction));

        // Apply correction to all pipes in loop
        for (let i = 0; i < loop.pipeIds.length; i++) {
          const pipeId = loop.pipeIds[i];
          const dir = loop.directions[i];
          const currentQ = flows.get(pipeId) || 0;
          flows.set(pipeId, currentQ + correction * dir);
        }
      }

      maxResidual = maxCorrection;
      iterationLog.push({
        iteration: iterations,
        maxCorrection,
        loopCorrections,
        converged: maxCorrection < config.tolerance,
      });

      if (maxCorrection < config.tolerance) {
        converged = true;
        break;
      }
    }

    if (!converged) {
      warnings.push(`Hardy Cross did not converge after ${config.maxIterations} iterations. Max residual: ${maxResidual.toFixed(6)}`);
    }

    return this.buildResult(
      nodes, pipes, pipeMap, flows, config, converged, iterations, maxResidual, iterationLog, warnings, 'hardy-cross'
    );
  }

  /**
   * LINEAR THEORY METHOD (Wood & Charles, 1972)
   * =============================================
   * Simultaneously solves all loop equations by linearizing the head loss equations.
   * More efficient than Hardy Cross for large networks.
   */
  static linearTheory(
    nodes: NetworkNode[],
    pipes: NetworkPipe[],
    loops: NetworkLoop[],
    config: AnalysisConfig
  ): AnalysisResult {
    const warnings: string[] = [];
    const iterationLog: IterationLog[] = [];
    const n = FrictionCalculator.getFlowExponent(config.frictionModel);

    const flows = NetworkTopology.assignInitialFlows(nodes, pipes);
    for (const pipe of pipes) {
      if (pipe.initialFlow !== undefined && pipe.initialFlow !== 0) {
        flows.set(pipe.id, pipe.initialFlow);
      }
    }

    const pipeMap = new Map(pipes.map(p => [p.id, { ...p }]));
    let converged = false;
    let iterations = 0;
    let maxResidual = Infinity;
    const nLoops = loops.length;

    for (iterations = 1; iterations <= config.maxIterations; iterations++) {
      // Build the system of equations: [A]{ΔQ} = {b}
      // A[i][j] = coupling coefficient between loop i and j
      // b[i] = -Σhf in loop i
      const A: number[][] = Array.from({ length: nLoops }, () => new Array(nLoops).fill(0));
      const b: number[] = new Array(nLoops).fill(0);

      for (let i = 0; i < nLoops; i++) {
        const loop = loops[i];
        
        for (let p = 0; p < loop.pipeIds.length; p++) {
          const pipeId = loop.pipeIds[p];
          const dir = loop.directions[p];
          const pipe = pipeMap.get(pipeId);
          if (!pipe) continue;

          const Q = flows.get(pipeId) || 0;
          const absQ = Math.max(Math.abs(Q), 1e-12);

          const result = FrictionCalculator.computePipeHeadLoss(
            pipe, absQ, config.frictionModel, config.kinematicViscosity
          );

          const signedHf = (Q * dir >= 0 ? 1 : -1) * result.totalLoss;
          b[i] -= signedHf;

          // Diagonal: n * |hf/Q|
          const diagContrib = n * result.totalLoss / absQ;
          A[i][i] += diagContrib;

          // Off-diagonal: check if this pipe is shared with other loops
          for (let j = 0; j < nLoops; j++) {
            if (i === j) continue;
            const otherLoop = loops[j];
            const idx = otherLoop.pipeIds.indexOf(pipeId);
            if (idx >= 0) {
              // Shared pipe: add coupling term
              const otherDir = otherLoop.directions[idx];
              A[i][j] += dir * otherDir * diagContrib;
            }
          }
        }
      }

      // Solve [A]{ΔQ} = {b} using Gaussian elimination
      const corrections = this.solveLinearSystem(A, b);
      let maxCorrection = 0;
      const loopCorrections: { loopId: string; correction: number }[] = [];

      for (let i = 0; i < nLoops; i++) {
        const dQ = corrections[i];
        loopCorrections.push({ loopId: loops[i].id, correction: dQ });
        maxCorrection = Math.max(maxCorrection, Math.abs(dQ));

        for (let p = 0; p < loops[i].pipeIds.length; p++) {
          const pipeId = loops[i].pipeIds[p];
          const dir = loops[i].directions[p];
          const currentQ = flows.get(pipeId) || 0;
          flows.set(pipeId, currentQ + dQ * dir);
        }
      }

      maxResidual = maxCorrection;
      iterationLog.push({
        iteration: iterations,
        maxCorrection,
        loopCorrections,
        converged: maxCorrection < config.tolerance,
      });

      if (maxCorrection < config.tolerance) {
        converged = true;
        break;
      }
    }

    if (!converged) {
      warnings.push(`Linear Theory did not converge after ${config.maxIterations} iterations.`);
    }

    return this.buildResult(
      nodes, pipes, pipeMap, flows, config, converged, iterations, maxResidual, iterationLog, warnings, 'linear-theory'
    );
  }

  /**
   * NEWTON-RAPHSON METHOD
   * =====================
   * Global Newton-Raphson on the full system of equations:
   * - Continuity at each junction: Σ Q_in - Σ Q_out = demand
   * - Energy in each loop: Σ hf = 0
   * Solves for both flows and heads simultaneously.
   */
  static newtonRaphson(
    nodes: NetworkNode[],
    pipes: NetworkPipe[],
    loops: NetworkLoop[],
    config: AnalysisConfig
  ): AnalysisResult {
    const warnings: string[] = [];
    const iterationLog: IterationLog[] = [];
    const n = FrictionCalculator.getFlowExponent(config.frictionModel);

    const flows = NetworkTopology.assignInitialFlows(nodes, pipes);
    for (const pipe of pipes) {
      if (pipe.initialFlow !== undefined && pipe.initialFlow !== 0) {
        flows.set(pipe.id, pipe.initialFlow);
      }
    }

    const pipeMap = new Map(pipes.map(p => [p.id, { ...p }]));
    
    // Junction nodes (unknowns)
    const junctions = nodes.filter(nod => nod.type === 'junction');
    const nJunctions = junctions.length;
    const nPipes = pipes.length;
    const nLoops = loops.length;
    const nEq = nPipes; // Number of unknowns = number of pipes
    
    let converged = false;
    let iterations = 0;
    let maxResidual = Infinity;

    for (iterations = 1; iterations <= config.maxIterations; iterations++) {
      // Build Jacobian and residual vector
      // Equations:
      //   1. Continuity at each junction (nJunctions equations)
      //   2. Energy around each loop (nLoops equations)
      //   Total should match nPipes for a proper system

      const residuals: number[] = [];
      const jacobian: number[][] = [];
      
      // Continuity equations: Σ(Q_in) - Σ(Q_out) - demand = 0
      for (let j = 0; j < nJunctions; j++) {
        const node = junctions[j];
        let netFlow = -node.demand;
        const row = new Array(nPipes).fill(0);
        
        for (let p = 0; p < nPipes; p++) {
          const pipe = pipes[p];
          const Q = flows.get(pipe.id) || 0;
          
          if (pipe.endNodeId === node.id) {
            netFlow += Q;
            row[p] = 1;
          }
          if (pipe.startNodeId === node.id) {
            netFlow -= Q;
            row[p] = -1;
          }
        }
        
        residuals.push(-netFlow); // Negate for Newton-Raphson
        jacobian.push(row);
      }

      // Loop energy equations: Σ(sign * hf(Q)) = 0
      for (let l = 0; l < nLoops; l++) {
        const loop = loops[l];
        let sumHf = 0;
        const row = new Array(nPipes).fill(0);
        
        for (let i = 0; i < loop.pipeIds.length; i++) {
          const pipeId = loop.pipeIds[i];
          const dir = loop.directions[i];
          const pipeIdx = pipes.findIndex(pp => pp.id === pipeId);
          const pipe = pipeMap.get(pipeId);
          if (!pipe || pipeIdx < 0) continue;

          const Q = flows.get(pipeId) || 0;
          const absQ = Math.max(Math.abs(Q), 1e-12);

          const result = FrictionCalculator.computePipeHeadLoss(
            pipe, absQ, config.frictionModel, config.kinematicViscosity
          );

          const sign = (Q * dir >= 0 ? 1 : -1);
          sumHf += sign * result.totalLoss;

          // ∂hf/∂Q = n * |hf| / |Q| * sign * dir
          const dhdq = n * result.totalLoss / absQ;
          row[pipeIdx] = sign * dir * dhdq;
        }
        
        residuals.push(-sumHf);
        jacobian.push(row);
      }

      // If we have more equations than unknowns or vice versa, pad or truncate
      // For a well-posed problem: nJunctions + nLoops = nPipes
      const nEquations = residuals.length;
      if (nEquations < nPipes) {
        // Underdetermined — add dummy equations
        for (let i = nEquations; i < nPipes; i++) {
          residuals.push(0);
          jacobian.push(new Array(nPipes).fill(0));
        }
      }

      // Solve J * ΔQ = -F
      const nSolve = Math.min(nPipes, jacobian.length);
      const Jcrop = jacobian.slice(0, nSolve).map(r => r.slice(0, nSolve));
      const rCrop = residuals.slice(0, nSolve);

      const deltaQ = this.solveLinearSystem(Jcrop, rCrop);
      let maxCorr = 0;
      const loopCorrections: { loopId: string; correction: number }[] = [];

      for (let p = 0; p < Math.min(nPipes, deltaQ.length); p++) {
        const pipe = pipes[p];
        const currentQ = flows.get(pipe.id) || 0;
        const dq = deltaQ[p];
        flows.set(pipe.id, currentQ + dq);
        maxCorr = Math.max(maxCorr, Math.abs(dq));
      }

      // Record loop corrections for the log
      for (let l = 0; l < nLoops; l++) {
        loopCorrections.push({ loopId: loops[l].id, correction: maxCorr });
      }

      maxResidual = maxCorr;
      iterationLog.push({
        iteration: iterations,
        maxCorrection: maxCorr,
        loopCorrections,
        converged: maxCorr < config.tolerance,
      });

      if (maxCorr < config.tolerance) {
        converged = true;
        break;
      }
    }

    if (!converged) {
      warnings.push(`Newton-Raphson did not converge after ${config.maxIterations} iterations.`);
    }

    return this.buildResult(
      nodes, pipes, pipeMap, flows, config, converged, iterations, maxResidual, iterationLog, warnings, 'newton-raphson'
    );
  }

  /**
   * Gaussian elimination for Ax = b
   */
  private static solveLinearSystem(A: number[][], b: number[]): number[] {
    const n = b.length;
    // Augmented matrix
    const aug = A.map((row, i) => [...row, b[i]]);

    // Forward elimination with partial pivoting
    for (let col = 0; col < n; col++) {
      // Find pivot
      let maxVal = Math.abs(aug[col][col]);
      let maxRow = col;
      for (let row = col + 1; row < n; row++) {
        if (Math.abs(aug[row][col]) > maxVal) {
          maxVal = Math.abs(aug[row][col]);
          maxRow = row;
        }
      }

      // Swap rows
      if (maxRow !== col) {
        [aug[col], aug[maxRow]] = [aug[maxRow], aug[col]];
      }

      // Eliminate
      const pivot = aug[col][col];
      if (Math.abs(pivot) < 1e-15) continue; // Singular

      for (let row = col + 1; row < n; row++) {
        const factor = aug[row][col] / pivot;
        for (let j = col; j <= n; j++) {
          aug[row][j] -= factor * aug[col][j];
        }
      }
    }

    // Back substitution
    const x = new Array(n).fill(0);
    for (let i = n - 1; i >= 0; i--) {
      let sum = aug[i][n];
      for (let j = i + 1; j < n; j++) {
        sum -= aug[i][j] * x[j];
      }
      x[i] = Math.abs(aug[i][i]) > 1e-15 ? sum / aug[i][i] : 0;
    }

    return x;
  }

  /**
   * Build final result object with computed properties
   */
  private static buildResult(
    nodes: NetworkNode[],
    pipes: NetworkPipe[],
    pipeMap: Map<string, NetworkPipe>,
    flows: Map<string, number>,
    config: AnalysisConfig,
    converged: boolean,
    iterations: number,
    maxResidual: number,
    iterationLog: IterationLog[],
    warnings: string[],
    method: AnalysisMethod
  ): AnalysisResult {
    // Compute final pipe properties
    const resultPipes: NetworkPipe[] = pipes.map(pipe => {
      const Q = flows.get(pipe.id) || 0;
      const result = FrictionCalculator.computePipeHeadLoss(
        pipe, Math.abs(Q), config.frictionModel, config.kinematicViscosity
      );
      
      // Check velocity warnings
      if (result.velocity > 3.0) {
        warnings.push(`Pipe ${pipe.label || pipe.id}: Velocity ${result.velocity.toFixed(2)} m/s exceeds 3.0 m/s limit`);
      }
      if (result.velocity < 0.3 && Math.abs(Q) > 1e-6) {
        warnings.push(`Pipe ${pipe.label || pipe.id}: Velocity ${result.velocity.toFixed(2)} m/s below 0.3 m/s (stagnation risk)`);
      }
      
      return {
        ...pipe,
        computedFlow: Q,
        computedVelocity: result.velocity * (Q >= 0 ? 1 : -1),
        computedHeadLoss: Q >= 0 ? result.totalLoss : -result.totalLoss,
        computedFrictionLoss: result.frictionLoss,
        computedMinorLoss: result.minorLoss,
        reynoldsNumber: result.Re,
        frictionFactor: result.f,
      };
    });

    // Compute node heads (walk from reservoir/tank nodes)
    const resultNodes = this.computeNodeHeads(nodes, resultPipes, flows);

    // Check pressure warnings
    for (const node of resultNodes) {
      if (node.type === 'junction' && node.computedPressure !== undefined) {
        if (node.minPressure && node.computedPressure < node.minPressure) {
          warnings.push(`Node ${node.label || node.id}: Pressure ${node.computedPressure.toFixed(2)} m < minimum ${node.minPressure} m`);
        }
        if (node.computedPressure < 0) {
          warnings.push(`Node ${node.label || node.id}: NEGATIVE pressure! (${node.computedPressure.toFixed(2)} m)`);
        }
      }
    }

    // Total head loss
    const totalHeadLoss = resultPipes.reduce((s, p) => s + Math.abs(p.computedHeadLoss || 0), 0);

    // Energy grade line
    const energyGrade = resultNodes.map(node => ({
      nodeId: node.id,
      hgl: node.computedHead || node.elevation,
      egl: (node.computedHead || node.elevation), // Simplified — would add velocity head
    }));

    return {
      success: converged,
      message: converged
        ? `Analysis converged in ${iterations} iterations (${method})`
        : `Analysis did not converge after ${iterations} iterations`,
      method,
      frictionModel: config.frictionModel,
      iterations,
      converged,
      maxResidual,
      pipes: resultPipes,
      nodes: resultNodes,
      iterationLog,
      totalHeadLoss,
      energyGrade,
      warnings,
    };
  }

  /**
   * Compute hydraulic grade at each node by walking from known-head nodes
   */
  private static computeNodeHeads(
    nodes: NetworkNode[],
    pipes: NetworkPipe[],
    flows: Map<string, number>
  ): NetworkNode[] {
    const resultNodes = nodes.map(n => ({ ...n }));
    const nodeMap = new Map(resultNodes.map(n => [n.id, n]));
    const computed = new Set<string>();

    // Initialize reservoir/tank heads
    for (const node of resultNodes) {
      if ((node.type === 'reservoir' || node.type === 'tank') && node.head !== undefined) {
        node.computedHead = node.head;
        node.computedPressure = node.head - node.elevation;
        computed.add(node.id);
      }
    }

    // BFS from known-head nodes
    const queue = [...computed];
    let safety = 0;
    
    while (queue.length > 0 && safety < 1000) {
      safety++;
      const nodeId = queue.shift()!;
      const sourceNode = nodeMap.get(nodeId)!;

      for (const pipe of pipes) {
        let neighborId: string | null = null;
        let headLoss = pipe.computedHeadLoss || 0;

        if (pipe.startNodeId === nodeId && !computed.has(pipe.endNodeId)) {
          neighborId = pipe.endNodeId;
          // Flow from start → end: neighbor head = source head - headloss
        } else if (pipe.endNodeId === nodeId && !computed.has(pipe.startNodeId)) {
          neighborId = pipe.startNodeId;
          headLoss = -headLoss; // Reverse direction
        }

        if (neighborId) {
          const neighbor = nodeMap.get(neighborId);
          if (neighbor) {
            neighbor.computedHead = (sourceNode.computedHead || sourceNode.elevation) - headLoss;
            neighbor.computedPressure = neighbor.computedHead - neighbor.elevation;
            computed.add(neighborId);
            queue.push(neighborId);
          }
        }
      }
    }

    // For any nodes still not computed, estimate
    for (const node of resultNodes) {
      if (node.computedHead === undefined) {
        node.computedHead = node.elevation;
        node.computedPressure = 0;
      }
    }

    return resultNodes;
  }

  /**
   * Run analysis with the specified method
   */
  static analyze(
    nodes: NetworkNode[],
    pipes: NetworkPipe[],
    loops: NetworkLoop[],
    config: AnalysisConfig
  ): AnalysisResult {
    switch (config.method) {
      case 'hardy-cross':
        return this.hardyCross(nodes, pipes, loops, config);
      case 'linear-theory':
        return this.linearTheory(nodes, pipes, loops, config);
      case 'newton-raphson':
        return this.newtonRaphson(nodes, pipes, loops, config);
      default:
        throw new Error(`Unknown analysis method: ${config.method}`);
    }
  }
}

// =============================================================================
// PIPE SIZING & ECONOMIC DESIGN
// =============================================================================

export class PipeDesign {
  /**
   * Calculate required diameter for a given flow, velocity, and head loss constraint
   */
  static requiredDiameter(
    flow: number,           // m³/s
    maxVelocity: number,    // m/s (typically 0.6-3.0 m/s)
    maxHeadLossPerKm: number, // m/km (typically 5-10)
    length: number,         // m
    material: PipeMaterial,
    frictionModel: FrictionModel
  ): number {
    // From velocity constraint: D = √(4Q / (π * Vmax))
    const D_velocity = Math.sqrt(4 * flow / (Math.PI * maxVelocity));

    // From head loss constraint: iterative solution
    let D_headloss = D_velocity;
    for (let iter = 0; iter < 30; iter++) {
      let hf: number;
      
      switch (frictionModel) {
        case 'hazen-williams':
          hf = FrictionCalculator.hazenWilliamsHeadLoss(flow, material.hazenWilliamsC, D_headloss, length).headLoss;
          break;
        case 'darcy-weisbach':
          hf = FrictionCalculator.darcyWeisbachHeadLoss(flow, D_headloss, length, material.roughness).headLoss;
          break;
        case 'manning':
          hf = FrictionCalculator.manningHeadLoss(flow, material.manningN, D_headloss, length).headLoss;
          break;
        default:
          hf = 0;
      }

      const hfPerKm = hf / (length / 1000);
      if (hfPerKm <= maxHeadLossPerKm) break;
      
      // Increase diameter
      D_headloss *= 1.05;
    }

    return Math.max(D_velocity, D_headloss);
  }

  /**
   * Select nearest standard pipe diameter (round up)
   */
  static selectStandardDiameter(requiredDiameter_m: number): number {
    const requiredMm = requiredDiameter_m * 1000;
    for (const d of STANDARD_DIAMETERS_MM) {
      if (d >= requiredMm) return d / 1000;
    }
    return STANDARD_DIAMETERS_MM[STANDARD_DIAMETERS_MM.length - 1] / 1000;
  }

  /**
   * Estimate pipe cost
   */
  static estimateCost(
    diameter_m: number,
    length: number,
    material: PipeMaterial
  ): number {
    const diameterMm = diameter_m * 1000;
    return material.costPerMeterPerMm * diameterMm * length;
  }

  /**
   * Design all pipes in network
   */
  static designNetwork(
    analysisResult: AnalysisResult,
    materialKey: string,
    maxVelocity: number = 2.5,
    maxHeadLossPerKm: number = 8
  ): NetworkDesignResult {
    const material = PIPE_MATERIALS[materialKey] || PIPE_MATERIALS['PVC'];
    const sizing: PipeSizingResult[] = [];
    const recommendations: string[] = [];
    let totalCost = 0;
    let totalLength = 0;
    let maxVel = 0;
    let maxHl = 0;
    let designAdequate = true;

    for (const pipe of analysisResult.pipes) {
      const absFlow = Math.abs(pipe.computedFlow || 0);
      
      if (absFlow < 1e-10) {
        sizing.push({
          pipeId: pipe.id,
          requiredDiameter: 0,
          selectedDiameter: pipe.diameter,
          velocity: 0,
          headLoss: 0,
          headLossPerKm: 0,
          material: materialKey,
          costEstimate: 0,
        });
        continue;
      }

      const reqD = this.requiredDiameter(
        absFlow, maxVelocity, maxHeadLossPerKm, pipe.length, material,
        analysisResult.frictionModel
      );
      const selD = this.selectStandardDiameter(reqD);
      
      const A = Math.PI * selD * selD / 4;
      const V = absFlow / A;
      const hl = Math.abs(pipe.computedHeadLoss || 0);
      const hlPerKm = hl / (pipe.length / 1000);
      const cost = this.estimateCost(selD, pipe.length, material);

      if (V > maxVelocity) {
        designAdequate = false;
        recommendations.push(`Pipe ${pipe.label}: Increase diameter, velocity ${V.toFixed(2)} m/s > ${maxVelocity} m/s`);
      }
      if (hlPerKm > maxHeadLossPerKm) {
        recommendations.push(`Pipe ${pipe.label}: Head loss ${hlPerKm.toFixed(1)} m/km exceeds limit ${maxHeadLossPerKm} m/km`);
      }

      maxVel = Math.max(maxVel, V);
      maxHl = Math.max(maxHl, hlPerKm);
      totalCost += cost;
      totalLength += pipe.length;

      sizing.push({
        pipeId: pipe.id,
        requiredDiameter: reqD,
        selectedDiameter: selD,
        velocity: V,
        headLoss: hl,
        headLossPerKm: hlPerKm,
        material: materialKey,
        costEstimate: cost,
      });
    }

    if (designAdequate) {
      recommendations.push('Design meets all velocity and head loss criteria.');
    }

    return {
      analysisResult,
      sizing,
      totalCost,
      totalLength,
      maxVelocity: maxVel,
      maxHeadLoss: maxHl,
      designAdequate,
      recommendations,
    };
  }
}

// =============================================================================
// PRESET EXAMPLE NETWORKS
// =============================================================================

export const EXAMPLE_NETWORKS = {
  'two-loop': {
    name: 'Two-Loop Network (Classic Hardy Cross)',
    description: 'Classic 2-loop pipe network with 1 reservoir and 4 demand junctions. Standard textbook example.',
    nodes: [
      { id: 'N1', label: 'Reservoir', type: 'reservoir' as NodeType, x: 50, y: 50, elevation: 60, demand: 0, head: 60 },
      { id: 'N2', label: 'Junction B', type: 'junction' as NodeType, x: 250, y: 50, elevation: 50, demand: 0.040, minPressure: 10 },
      { id: 'N3', label: 'Junction C', type: 'junction' as NodeType, x: 450, y: 50, elevation: 45, demand: 0.060, minPressure: 10 },
      { id: 'N4', label: 'Junction D', type: 'junction' as NodeType, x: 250, y: 250, elevation: 50, demand: 0.040, minPressure: 10 },
      { id: 'N5', label: 'Junction E', type: 'junction' as NodeType, x: 450, y: 250, elevation: 45, demand: 0.060, minPressure: 10 },
    ],
    pipes: [
      { id: 'P1', label: 'AB', startNodeId: 'N1', endNodeId: 'N2', length: 1000, diameter: 0.300, roughness: 130, minorLossK: 0.5, material: 'CI', initialFlow: 0.100 },
      { id: 'P2', label: 'BC', startNodeId: 'N2', endNodeId: 'N3', length: 1000, diameter: 0.250, roughness: 130, minorLossK: 0.3, material: 'CI', initialFlow: 0.060 },
      { id: 'P3', label: 'BD', startNodeId: 'N2', endNodeId: 'N4', length: 1000, diameter: 0.200, roughness: 130, minorLossK: 0.3, material: 'CI', initialFlow: 0.000 },
      { id: 'P4', label: 'CE', startNodeId: 'N3', endNodeId: 'N5', length: 1000, diameter: 0.200, roughness: 130, minorLossK: 0.3, material: 'CI', initialFlow: 0.000 },
      { id: 'P5', label: 'DE', startNodeId: 'N4', endNodeId: 'N5', length: 1000, diameter: 0.250, roughness: 130, minorLossK: 0.3, material: 'CI', initialFlow: -0.040 },
      { id: 'P6', label: 'AD', startNodeId: 'N1', endNodeId: 'N4', length: 1000, diameter: 0.300, roughness: 130, minorLossK: 0.5, material: 'CI', initialFlow: 0.100 },
    ],
    loops: [
      { id: 'L1', label: 'Loop I (ABDA)', pipeIds: ['P1', 'P3', 'P6'], directions: [1, 1, -1] },
      { id: 'L2', label: 'Loop II (BCDE)', pipeIds: ['P2', 'P4', 'P5', 'P3'], directions: [1, 1, -1, -1] },
    ],
  },
  'three-loop': {
    name: 'Three-Loop Municipal Network',
    description: '3-loop water distribution network with 2 reservoirs serving 6 demand junctions.',
    nodes: [
      { id: 'R1', label: 'Reservoir 1', type: 'reservoir' as NodeType, x: 50, y: 150, elevation: 70, demand: 0, head: 70 },
      { id: 'R2', label: 'Reservoir 2', type: 'reservoir' as NodeType, x: 550, y: 150, elevation: 65, demand: 0, head: 65 },
      { id: 'J1', label: 'Junction 1', type: 'junction' as NodeType, x: 150, y: 50, elevation: 50, demand: 0.030, minPressure: 12 },
      { id: 'J2', label: 'Junction 2', type: 'junction' as NodeType, x: 300, y: 50, elevation: 48, demand: 0.050, minPressure: 12 },
      { id: 'J3', label: 'Junction 3', type: 'junction' as NodeType, x: 450, y: 50, elevation: 47, demand: 0.020, minPressure: 12 },
      { id: 'J4', label: 'Junction 4', type: 'junction' as NodeType, x: 150, y: 250, elevation: 50, demand: 0.025, minPressure: 12 },
      { id: 'J5', label: 'Junction 5', type: 'junction' as NodeType, x: 300, y: 250, elevation: 48, demand: 0.040, minPressure: 12 },
      { id: 'J6', label: 'Junction 6', type: 'junction' as NodeType, x: 450, y: 250, elevation: 46, demand: 0.035, minPressure: 12 },
    ],
    pipes: [
      { id: 'P1', label: 'R1-J1', startNodeId: 'R1', endNodeId: 'J1', length: 500, diameter: 0.350, roughness: 130, minorLossK: 0.5, material: 'DI', initialFlow: 0.100 },
      { id: 'P2', label: 'J1-J2', startNodeId: 'J1', endNodeId: 'J2', length: 800, diameter: 0.250, roughness: 130, minorLossK: 0.3, material: 'DI', initialFlow: 0.040 },
      { id: 'P3', label: 'J2-J3', startNodeId: 'J2', endNodeId: 'J3', length: 800, diameter: 0.200, roughness: 130, minorLossK: 0.3, material: 'DI', initialFlow: 0.010 },
      { id: 'P4', label: 'J3-R2', startNodeId: 'J3', endNodeId: 'R2', length: 500, diameter: 0.300, roughness: 130, minorLossK: 0.5, material: 'DI', initialFlow: -0.010 },
      { id: 'P5', label: 'R1-J4', startNodeId: 'R1', endNodeId: 'J4', length: 500, diameter: 0.350, roughness: 130, minorLossK: 0.5, material: 'DI', initialFlow: 0.100 },
      { id: 'P6', label: 'J4-J5', startNodeId: 'J4', endNodeId: 'J5', length: 800, diameter: 0.250, roughness: 130, minorLossK: 0.3, material: 'DI', initialFlow: 0.050 },
      { id: 'P7', label: 'J5-J6', startNodeId: 'J5', endNodeId: 'J6', length: 800, diameter: 0.200, roughness: 130, minorLossK: 0.3, material: 'DI', initialFlow: 0.020 },
      { id: 'P8', label: 'J6-R2', startNodeId: 'J6', endNodeId: 'R2', length: 500, diameter: 0.300, roughness: 130, minorLossK: 0.5, material: 'DI', initialFlow: -0.015 },
      { id: 'P9', label: 'J1-J4', startNodeId: 'J1', endNodeId: 'J4', length: 600, diameter: 0.200, roughness: 130, minorLossK: 0.3, material: 'DI', initialFlow: 0.030 },
      { id: 'P10', label: 'J2-J5', startNodeId: 'J2', endNodeId: 'J5', length: 600, diameter: 0.200, roughness: 130, minorLossK: 0.3, material: 'DI', initialFlow: -0.020 },
      { id: 'P11', label: 'J3-J6', startNodeId: 'J3', endNodeId: 'J6', length: 600, diameter: 0.200, roughness: 130, minorLossK: 0.3, material: 'DI', initialFlow: -0.010 },
    ],
    loops: [
      { id: 'L1', label: 'Loop I', pipeIds: ['P1', 'P2', 'P9', 'P5'], directions: [1, 1, 1, -1] },
      { id: 'L2', label: 'Loop II', pipeIds: ['P2', 'P3', 'P10', 'P6'], directions: [-1, -1, 1, 1] },
      { id: 'L3', label: 'Loop III', pipeIds: ['P3', 'P4', 'P8', 'P7', 'P11'], directions: [1, 1, -1, -1, -1] },
    ],
  },
  'single-loop': {
    name: 'Single Loop (Simple)',
    description: 'Simple single-loop network with 1 reservoir and 3 junctions. Good for learning Hardy Cross.',
    nodes: [
      { id: 'R', label: 'Reservoir', type: 'reservoir' as NodeType, x: 150, y: 50, elevation: 50, demand: 0, head: 50 },
      { id: 'A', label: 'Junction A', type: 'junction' as NodeType, x: 50, y: 200, elevation: 40, demand: 0.020, minPressure: 10 },
      { id: 'B', label: 'Junction B', type: 'junction' as NodeType, x: 250, y: 200, elevation: 38, demand: 0.030, minPressure: 10 },
      { id: 'C', label: 'Junction C', type: 'junction' as NodeType, x: 150, y: 350, elevation: 35, demand: 0.030, minPressure: 10 },
    ],
    pipes: [
      { id: 'P1', label: 'R-A', startNodeId: 'R', endNodeId: 'A', length: 600, diameter: 0.250, roughness: 130, minorLossK: 0.5, material: 'CI', initialFlow: 0.050 },
      { id: 'P2', label: 'R-B', startNodeId: 'R', endNodeId: 'B', length: 600, diameter: 0.250, roughness: 130, minorLossK: 0.5, material: 'CI', initialFlow: 0.030 },
      { id: 'P3', label: 'A-C', startNodeId: 'A', endNodeId: 'C', length: 500, diameter: 0.200, roughness: 130, minorLossK: 0.3, material: 'CI', initialFlow: 0.030 },
      { id: 'P4', label: 'B-C', startNodeId: 'B', endNodeId: 'C', length: 500, diameter: 0.200, roughness: 130, minorLossK: 0.3, material: 'CI', initialFlow: 0.000 },
    ],
    loops: [
      { id: 'L1', label: 'Loop ABCA', pipeIds: ['P1', 'P3', 'P4', 'P2'], directions: [1, 1, -1, -1] },
    ],
  },
};

// =============================================================================
// DEFAULT CONFIGURATION
// =============================================================================

export const DEFAULT_ANALYSIS_CONFIG: AnalysisConfig = {
  method: 'hardy-cross',
  frictionModel: 'hazen-williams',
  tolerance: 0.0001,
  maxIterations: 100,
  gravitationalAccel: GRAVITY,
  kinematicViscosity: KINEMATIC_VISCOSITY,
  waterDensity: WATER_DENSITY,
};
