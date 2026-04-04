/**
 * TopologyOptimizer.ts
 *
 * Generative Design Engine using SIMP (Solid Isotropic Material with Penalization)
 *
 * Features:
 * - 2D topology optimization for panel regions
 * - Density-based optimization
 * - Compliance minimization with volume constraint
 * - Sensitivity filtering for mesh-independence
 * - Multiple design alternatives generation
 */

import { auditTrail } from "../../services/AuditTrailService";

// ============================================
// TYPES
// ============================================

export interface OptimizationDomain {
  width: number; // mm
  height: number; // mm
  nelx: number; // Number of elements in x
  nely: number; // Number of elements in y
}

export interface BoundaryCondition {
  type: "fixed" | "roller" | "pinned";
  nodeIndices: number[]; // Affected node indices
  direction?: "x" | "y" | "xy"; // Constrained direction
}

export interface LoadCondition {
  nodeIndex: number;
  fx: number; // Force in x (N)
  fy: number; // Force in y (N)
}

export interface SIMPParameters {
  volumeFraction: number; // Target volume (0-1)
  penalization: number; // Penalization power (typically 3)
  filterRadius: number; // Sensitivity filter radius (elements)
  minDensity: number; // Minimum density (0.001)
  moveLimit: number; // OC move limit (0.2)
  maxIterations: number; // Maximum iterations
  tolerance: number; // Convergence tolerance
}

export interface OptimizationResult {
  densities: number[][]; // Element densities [nely][nelx]
  compliance: number; // Final compliance
  volume: number; // Final volume fraction
  iterations: number; // Iterations to converge
  convergenceHistory: {
    iteration: number;
    compliance: number;
    change: number;
  }[];
  converged: boolean;
  computationTime: number; // ms
}

export interface DesignAlternative {
  id: string;
  name: string;
  volumeFraction: number;
  result: OptimizationResult;
  interpretation: string[];
}

// ============================================
// SIMP TOPOLOGY OPTIMIZER
// ============================================

export class TopologyOptimizer {
  private domain: OptimizationDomain;
  private params: SIMPParameters;
  private E0: number = 1.0; // Base Young's modulus (normalized)
  private Emin: number = 1e-9; // Minimum stiffness (void)
  private nu: number = 0.3; // Poisson's ratio

  constructor(domain: OptimizationDomain, params?: Partial<SIMPParameters>) {
    this.domain = domain;
    this.params = {
      volumeFraction: 0.5,
      penalization: 3,
      filterRadius: 1.5,
      minDensity: 0.001,
      moveLimit: 0.2,
      maxIterations: 100,
      tolerance: 0.01,
      ...params,
    };
  }

  /**
   * Run topology optimization (synchronous — use optimizeAsync for UI)
   */
  optimize(
    supports: BoundaryCondition[],
    loads: LoadCondition[],
  ): OptimizationResult {
    const startTime = performance.now();
    const { nelx, nely } = this.domain;
    const { volumeFraction, maxIterations, tolerance, minDensity, moveLimit } =
      this.params;

    // Initialize density field (uniform)
    let densities: number[][] = [];
    for (let j = 0; j < nely; j++) {
      densities[j] = [];
      for (let i = 0; i < nelx; i++) {
        densities[j][i] = volumeFraction;
      }
    }

    // Precompute element stiffness matrix
    const ke = this.elementStiffness();

    // Prepare filter weights
    const H = this.prepareFilter();

    // Convergence tracking
    const history: { iteration: number; compliance: number; change: number }[] =
      [];
    let converged = false;

    // Optimization loop
    for (let iter = 0; iter < maxIterations; iter++) {
      const { U, compliance } = this.solveSystem(
        densities,
        ke,
        supports,
        loads,
      );
      const dc = this.computeSensitivities(densities, ke, U);
      const dcFiltered = this.filterSensitivities(dc, densities, H);
      const { newDensities, change } = this.updateDensities(
        densities,
        dcFiltered,
        volumeFraction,
        moveLimit,
        minDensity,
      );
      densities = newDensities;
      history.push({ iteration: iter + 1, compliance, change });
      if (iter > 0 && change < tolerance) {
        converged = true;
        break;
      }
    }

    const finalCompliance = history[history.length - 1]?.compliance || 0;
    const finalVolume = this.calculateVolume(densities);

    return {
      densities,
      compliance: finalCompliance,
      volume: finalVolume,
      iterations: history.length,
      convergenceHistory: history,
      converged,
      computationTime: performance.now() - startTime,
    };
  }

  /**
   * Non-blocking async optimization — yields to main thread between iterations
   * so the UI stays responsive and progress can be shown.
   */
  async optimizeAsync(
    supports: BoundaryCondition[],
    loads: LoadCondition[],
    onProgress?: (
      iter: number,
      maxIter: number,
      compliance: number,
      densities: number[][],
    ) => void,
    signal?: AbortSignal,
  ): Promise<OptimizationResult> {
    const startTime = performance.now();
    const { nelx, nely } = this.domain;
    const { volumeFraction, maxIterations, tolerance, minDensity, moveLimit } =
      this.params;

    // Safety: cap grid size to prevent browser crash
    if (nelx * nely > 1200) {
      throw new Error(
        `Grid too large (${nelx}×${nely}=${nelx * nely} elements). Max 1200 elements to prevent browser freeze.`,
      );
    }

    let densities: number[][] = [];
    for (let j = 0; j < nely; j++) {
      densities[j] = [];
      for (let i = 0; i < nelx; i++) {
        densities[j][i] = volumeFraction;
      }
    }

    const ke = this.elementStiffness();
    const H = this.prepareFilter();
    const history: { iteration: number; compliance: number; change: number }[] =
      [];
    let converged = false;

    for (let iter = 0; iter < maxIterations; iter++) {
      // Check cancellation
      if (signal?.aborted) {
        throw new Error("Optimization cancelled");
      }

      const { U, compliance } = this.solveSystem(
        densities,
        ke,
        supports,
        loads,
      );
      const dc = this.computeSensitivities(densities, ke, U);
      const dcFiltered = this.filterSensitivities(dc, densities, H);
      const { newDensities, change } = this.updateDensities(
        densities,
        dcFiltered,
        volumeFraction,
        moveLimit,
        minDensity,
      );
      densities = newDensities;
      history.push({ iteration: iter + 1, compliance, change });

      // Report progress
      onProgress?.(iter + 1, maxIterations, compliance, densities);

      // Yield to main thread so UI stays responsive
      await new Promise((resolve) => setTimeout(resolve, 0));

      if (iter > 0 && change < tolerance) {
        converged = true;
        break;
      }
    }

    const finalCompliance = history[history.length - 1]?.compliance || 0;
    const finalVolume = this.calculateVolume(densities);

    auditTrail.log(
      "optimization",
      "topology_optimization",
      `Topology optimization completed: ${history.length} iterations, V=${(finalVolume * 100).toFixed(1)}%`,
      {
        aiGenerated: true,
        metadata: { converged, finalCompliance, finalVolume },
      },
    );

    return {
      densities,
      compliance: finalCompliance,
      volume: finalVolume,
      iterations: history.length,
      convergenceHistory: history,
      converged,
      computationTime: performance.now() - startTime,
    };
  }

  /**
   * Generate 2D element stiffness matrix for plane stress
   */
  private elementStiffness(): number[][] {
    const nu = this.nu;
    const factor = 1 / (1 - nu * nu);

    // 4-node quadrilateral element stiffness (simplified)
    // Using 8x8 matrix for 4 nodes × 2 DOF
    const k = [
      [12, 3, -6, -3, -6, -3, 0, 3],
      [3, 12, 3, 0, -3, -6, -3, -6],
      [-6, 3, 12, -3, 0, -3, -6, 3],
      [-3, 0, -3, 12, 3, -6, 3, -6],
      [-6, -3, 0, 3, 12, 3, -6, -3],
      [-3, -6, -3, -6, 3, 12, 3, 0],
      [0, -3, -6, 3, -6, 3, 12, -3],
      [3, -6, 3, -6, -3, 0, -3, 12],
    ];

    // Scale by material factor
    const ke: number[][] = [];
    for (let i = 0; i < 8; i++) {
      ke[i] = [];
      for (let j = 0; j < 8; j++) {
        ke[i][j] = (factor * k[i][j]) / 24;
      }
    }

    return ke;
  }

  /**
   * Prepare sensitivity filter weights
   */
  private prepareFilter(): Map<
    string,
    { weight: number; neighbors: { i: number; j: number }[] }
  > {
    const { nelx, nely } = this.domain;
    const rmin = this.params.filterRadius;
    const H = new Map<
      string,
      { weight: number; neighbors: { i: number; j: number }[] }
    >();

    for (let j = 0; j < nely; j++) {
      for (let i = 0; i < nelx; i++) {
        const neighbors: { i: number; j: number; w: number }[] = [];
        let weightSum = 0;

        // Find neighbors within filter radius
        const iMin = Math.max(0, Math.floor(i - rmin));
        const iMax = Math.min(nelx - 1, Math.ceil(i + rmin));
        const jMin = Math.max(0, Math.floor(j - rmin));
        const jMax = Math.min(nely - 1, Math.ceil(j + rmin));

        for (let jj = jMin; jj <= jMax; jj++) {
          for (let ii = iMin; ii <= iMax; ii++) {
            const dist = Math.sqrt((i - ii) ** 2 + (j - jj) ** 2);
            if (dist <= rmin) {
              const w = rmin - dist;
              neighbors.push({ i: ii, j: jj, w });
              weightSum += w;
            }
          }
        }

        H.set(`${i},${j}`, {
          weight: weightSum,
          neighbors: neighbors.map((n) => ({ i: n.i, j: n.j })),
        });
      }
    }

    return H;
  }

  /**
   * Solve finite element system
   */
  private solveSystem(
    densities: number[][],
    ke: number[][],
    supports: BoundaryCondition[],
    loads: LoadCondition[],
  ): { U: number[]; compliance: number } {
    const { nelx, nely } = this.domain;
    const ndof = 2 * (nelx + 1) * (nely + 1);
    const p = this.params.penalization;

    // Assemble stiffness matrix (simplified - using dense for small problems)
    const K = Array(ndof)
      .fill(0)
      .map(() => Array(ndof).fill(0));
    const F = Array(ndof).fill(0);

    // Add element contributions
    for (let j = 0; j < nely; j++) {
      for (let i = 0; i < nelx; i++) {
        const density = densities[j][i];
        const Eeff = this.Emin + Math.pow(density, p) * (this.E0 - this.Emin);

        // Element DOF indices
        const n1 = i + j * (nelx + 1);
        const n2 = n1 + 1;
        const n3 = n2 + (nelx + 1);
        const n4 = n1 + (nelx + 1);
        const edof = [
          2 * n1,
          2 * n1 + 1,
          2 * n2,
          2 * n2 + 1,
          2 * n3,
          2 * n3 + 1,
          2 * n4,
          2 * n4 + 1,
        ];

        // Add to global stiffness
        for (let ii = 0; ii < 8; ii++) {
          for (let jj = 0; jj < 8; jj++) {
            K[edof[ii]][edof[jj]] += Eeff * ke[ii][jj];
          }
        }
      }
    }

    // Apply loads
    for (const load of loads) {
      F[2 * load.nodeIndex] += load.fx;
      F[2 * load.nodeIndex + 1] += load.fy;
    }

    // Apply boundary conditions (penalty method)
    const fixedDofs = new Set<number>();
    for (const bc of supports) {
      for (const nodeIdx of bc.nodeIndices) {
        if (
          bc.direction === "x" ||
          bc.direction === "xy" ||
          bc.type === "fixed"
        ) {
          fixedDofs.add(2 * nodeIdx);
        }
        if (
          bc.direction === "y" ||
          bc.direction === "xy" ||
          bc.type === "fixed"
        ) {
          fixedDofs.add(2 * nodeIdx + 1);
        }
      }
    }

    const bigNum = 1e30;
    for (const dof of fixedDofs) {
      K[dof][dof] = bigNum;
      F[dof] = 0;
    }

    // Solve (using simple Gauss elimination for demo - would use proper solver in production)
    const U = this.solveLinearSystem(K, F);

    // Calculate compliance
    let compliance = 0;
    for (let i = 0; i < ndof; i++) {
      compliance += F[i] * U[i];
    }

    return { U, compliance };
  }

  /**
   * Simple linear system solver (Gauss elimination)
   */
  private solveLinearSystem(A: number[][], b: number[]): number[] {
    const n = b.length;
    const x = [...b];
    const M = A.map((row) => [...row]);

    // Forward elimination
    for (let k = 0; k < n - 1; k++) {
      for (let i = k + 1; i < n; i++) {
        if (Math.abs(M[k][k]) < 1e-12) continue;
        const factor = M[i][k] / M[k][k];
        for (let j = k; j < n; j++) {
          M[i][j] -= factor * M[k][j];
        }
        x[i] -= factor * x[k];
      }
    }

    // Back substitution
    for (let i = n - 1; i >= 0; i--) {
      for (let j = i + 1; j < n; j++) {
        x[i] -= M[i][j] * x[j];
      }
      if (Math.abs(M[i][i]) > 1e-12) {
        x[i] /= M[i][i];
      }
    }

    return x;
  }

  /**
   * Compute design sensitivities
   */
  private computeSensitivities(
    densities: number[][],
    ke: number[][],
    U: number[],
  ): number[][] {
    const { nelx, nely } = this.domain;
    const p = this.params.penalization;
    const dc: number[][] = [];

    for (let j = 0; j < nely; j++) {
      dc[j] = [];
      for (let i = 0; i < nelx; i++) {
        const density = densities[j][i];

        // Element DOF indices
        const n1 = i + j * (nelx + 1);
        const n2 = n1 + 1;
        const n3 = n2 + (nelx + 1);
        const n4 = n1 + (nelx + 1);
        const edof = [
          2 * n1,
          2 * n1 + 1,
          2 * n2,
          2 * n2 + 1,
          2 * n3,
          2 * n3 + 1,
          2 * n4,
          2 * n4 + 1,
        ];

        // Element displacements
        const ue = edof.map((d) => U[d]);

        // Element strain energy
        let ce = 0;
        for (let ii = 0; ii < 8; ii++) {
          for (let jj = 0; jj < 8; jj++) {
            ce += ue[ii] * ke[ii][jj] * ue[jj];
          }
        }

        // Sensitivity: dc/drho = -p * rho^(p-1) * (E0 - Emin) * ue' * ke * ue
        dc[j][i] = -p * Math.pow(density, p - 1) * (this.E0 - this.Emin) * ce;
      }
    }

    return dc;
  }

  /**
   * Apply sensitivity filter
   */
  private filterSensitivities(
    dc: number[][],
    densities: number[][],
    H: Map<string, { weight: number; neighbors: { i: number; j: number }[] }>,
  ): number[][] {
    const { nelx, nely } = this.domain;
    const dcFiltered: number[][] = [];

    for (let j = 0; j < nely; j++) {
      dcFiltered[j] = [];
      for (let i = 0; i < nelx; i++) {
        const filterData = H.get(`${i},${j}`);
        if (!filterData) {
          dcFiltered[j][i] = dc[j][i];
          continue;
        }

        let sum = 0;
        for (const n of filterData.neighbors) {
          const dist = Math.sqrt((i - n.i) ** 2 + (j - n.j) ** 2);
          const w = this.params.filterRadius - dist;
          sum += w * densities[n.j][n.i] * dc[n.j][n.i];
        }

        dcFiltered[j][i] = sum / (densities[j][i] * filterData.weight + 1e-12);
      }
    }

    return dcFiltered;
  }

  /**
   * Update densities using Optimality Criteria (OC)
   */
  private updateDensities(
    densities: number[][],
    dc: number[][],
    volfrac: number,
    move: number,
    rhoMin: number,
  ): { newDensities: number[][]; change: number } {
    const { nelx, nely } = this.domain;

    // Bisection to find Lagrange multiplier
    let l1 = 0,
      l2 = 1e9;
    let lmid = 0;
    const newDensities: number[][] = [];

    while (l2 - l1 > 1e-9) {
      lmid = (l1 + l2) / 2;

      // Update densities
      for (let j = 0; j < nely; j++) {
        newDensities[j] = [];
        for (let i = 0; i < nelx; i++) {
          const xold = densities[j][i];
          const Be = -dc[j][i] / lmid;

          let xnew = xold * Math.sqrt(Be);

          // Apply move limits
          xnew = Math.max(
            rhoMin,
            Math.max(xold - move, Math.min(1, Math.min(xold + move, xnew))),
          );

          newDensities[j][i] = xnew;
        }
      }

      // Check volume constraint
      const vol = this.calculateVolume(newDensities);
      if (vol > volfrac) {
        l1 = lmid;
      } else {
        l2 = lmid;
      }
    }

    // Calculate change
    let change = 0;
    for (let j = 0; j < nely; j++) {
      for (let i = 0; i < nelx; i++) {
        change = Math.max(
          change,
          Math.abs(newDensities[j][i] - densities[j][i]),
        );
      }
    }

    return { newDensities, change };
  }

  /**
   * Calculate volume fraction
   */
  private calculateVolume(densities: number[][]): number {
    const { nelx, nely } = this.domain;
    let sum = 0;
    for (let j = 0; j < nely; j++) {
      for (let i = 0; i < nelx; i++) {
        sum += densities[j][i];
      }
    }
    return sum / (nelx * nely);
  }

  /**
   * Generate multiple design alternatives
   */
  generateAlternatives(
    supports: BoundaryCondition[],
    loads: LoadCondition[],
    volumeFractions: number[] = [0.3, 0.4, 0.5, 0.6],
  ): DesignAlternative[] {
    const alternatives: DesignAlternative[] = [];

    for (const vf of volumeFractions) {
      this.params.volumeFraction = vf;
      const result = this.optimize(supports, loads);

      alternatives.push({
        id: `alt-${vf * 100}`,
        name: `${(vf * 100).toFixed(0)}% Volume`,
        volumeFraction: vf,
        result,
        interpretation: this.interpretResult(result, vf),
      });
    }

    return alternatives;
  }

  /**
   * Interpret optimization result for AI explanation
   */
  private interpretResult(
    result: OptimizationResult,
    targetVol: number,
  ): string[] {
    const interpretations: string[] = [];

    if (result.converged) {
      interpretations.push(
        `✅ Optimization converged in ${result.iterations} iterations`,
      );
    } else {
      interpretations.push(
        `⚠️ Did not fully converge (${result.iterations} iterations)`,
      );
    }

    interpretations.push(
      `Achieved volume: ${(result.volume * 100).toFixed(1)}% (target: ${(targetVol * 100).toFixed(0)}%)`,
    );
    interpretations.push(
      `Compliance (flexibility): ${result.compliance.toExponential(3)}`,
    );
    interpretations.push(
      `Computation time: ${result.computationTime.toFixed(0)}ms`,
    );

    // Analyze density distribution
    const { nelx, nely } = this.domain;
    let solidCount = 0,
      voidCount = 0,
      intermediateCount = 0;

    for (let j = 0; j < nely; j++) {
      for (let i = 0; i < nelx; i++) {
        const d = result.densities[j][i];
        if (d > 0.9) solidCount++;
        else if (d < 0.1) voidCount++;
        else intermediateCount++;
      }
    }

    const total = nelx * nely;
    interpretations.push(
      `Structure: ${((solidCount / total) * 100).toFixed(0)}% solid, ${((voidCount / total) * 100).toFixed(0)}% void`,
    );

    if (intermediateCount > total * 0.1) {
      interpretations.push(
        `⚠️ High intermediate density (${((intermediateCount / total) * 100).toFixed(0)}%) - consider post-processing`,
      );
    }

    return interpretations;
  }

  /**
   * Export densities as image data
   */
  exportAsImage(densities: number[][]): ImageData {
    const { nelx, nely } = this.domain;
    const scale = 4; // Upscale for visibility
    const width = nelx * scale;
    const height = nely * scale;
    const data = new Uint8ClampedArray(width * height * 4);

    for (let j = 0; j < nely; j++) {
      for (let i = 0; i < nelx; i++) {
        const density = densities[j][i];
        const color = Math.round(255 * (1 - density)); // White = void, black = solid

        // Fill scaled pixels
        for (let sj = 0; sj < scale; sj++) {
          for (let si = 0; si < scale; si++) {
            const px = i * scale + si;
            const py = j * scale + sj;
            const idx = (py * width + px) * 4;
            data[idx] = color; // R
            data[idx + 1] = color; // G
            data[idx + 2] = color; // B
            data[idx + 3] = 255; // A
          }
        }
      }
    }

    return new ImageData(data, width, height);
  }

  /**
   * Generate design report
   */
  generateReport(result: OptimizationResult): string {
    let report = `## Topology Optimization Report\n\n`;

    report += `### Configuration\n`;
    report += `- Domain: ${this.domain.nelx} × ${this.domain.nely} elements\n`;
    report += `- Size: ${this.domain.width}mm × ${this.domain.height}mm\n`;
    report += `- Volume fraction target: ${(this.params.volumeFraction * 100).toFixed(0)}%\n`;
    report += `- Penalization (p): ${this.params.penalization}\n`;
    report += `- Filter radius: ${this.params.filterRadius} elements\n\n`;

    report += `### Results\n`;
    report += `- **Converged:** ${result.converged ? "Yes" : "No"}\n`;
    report += `- **Iterations:** ${result.iterations}\n`;
    report += `- **Final volume:** ${(result.volume * 100).toFixed(1)}%\n`;
    report += `- **Compliance:** ${result.compliance.toExponential(3)}\n`;
    report += `- **Time:** ${result.computationTime.toFixed(0)}ms\n\n`;

    report += `### Convergence History\n`;
    report += `| Iter | Compliance | Change |\n`;
    report += `|------|------------|--------|\n`;
    const historyToShow = result.convergenceHistory.slice(-10);
    for (const h of historyToShow) {
      report += `| ${h.iteration} | ${h.compliance.toExponential(2)} | ${h.change.toFixed(4)} |\n`;
    }

    return report;
  }
}

// ============================================
// FACTORY FUNCTIONS
// ============================================

/**
 * Create optimizer for cantilever beam topology
 */
export function createCantileverOptimizer(
  width: number,
  height: number,
  load: number,
  volumeFraction: number = 0.5,
): {
  optimizer: TopologyOptimizer;
  supports: BoundaryCondition[];
  loads: LoadCondition[];
} {
  const nelx = Math.max(20, Math.round(width / 10));
  const nely = Math.max(10, Math.round(height / 10));

  const optimizer = new TopologyOptimizer(
    { width, height, nelx, nely },
    { volumeFraction, maxIterations: 50 },
  );

  // Fixed left edge
  const supports: BoundaryCondition[] = [
    {
      type: "fixed",
      nodeIndices: Array.from({ length: nely + 1 }, (_, j) => j * (nelx + 1)),
      direction: "xy",
    },
  ];

  // Point load at mid-right
  const midRightNode = Math.floor(nely / 2) * (nelx + 1) + nelx;
  const loads: LoadCondition[] = [
    {
      nodeIndex: midRightNode,
      fx: 0,
      fy: -load,
    },
  ];

  return { optimizer, supports, loads };
}

/**
 * Create optimizer for MBB beam topology
 */
export function createMBBBeamOptimizer(
  length: number,
  height: number,
  load: number,
  volumeFraction: number = 0.5,
): {
  optimizer: TopologyOptimizer;
  supports: BoundaryCondition[];
  loads: LoadCondition[];
} {
  const nelx = Math.max(30, Math.round(length / 10));
  const nely = Math.max(10, Math.round(height / 10));

  const optimizer = new TopologyOptimizer(
    { width: length, height, nelx, nely },
    { volumeFraction, maxIterations: 50 },
  );

  // Roller on bottom left (fix Y), roller on bottom right (fix X and Y)
  const supports: BoundaryCondition[] = [
    { type: "pinned", nodeIndices: [0], direction: "xy" },
    { type: "roller", nodeIndices: [nelx], direction: "y" },
  ];

  // Load at top left
  const loads: LoadCondition[] = [
    {
      nodeIndex: nely * (nelx + 1),
      fx: 0,
      fy: -load,
    },
  ];

  return { optimizer, supports, loads };
}

export default TopologyOptimizer;
