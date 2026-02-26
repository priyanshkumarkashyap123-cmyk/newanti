/**
 * TopologyOptimizerService.ts - Generative Structural Design
 * 
 * SIMP-based topology optimization for structural elements:
 * - Density-based material distribution
 * - Compliance minimization
 * - Volume constraint handling
 * - Structural boundary recognition
 */

// ============================================
// TYPES
// ============================================

export interface OptimizationDomain {
    width: number;      // mm
    height: number;     // mm
    depth?: number;     // mm (for 3D)
    resolution: number; // Elements per unit
}

export interface LoadCase {
    position: { x: number; y: number; z?: number };
    force: { fx: number; fy: number; fz?: number };
}

export interface Support {
    position: { x: number; y: number; z?: number };
    type: 'fixed' | 'pinned' | 'roller';
}

export interface OptimizationParams {
    volumeFraction: number;    // 0-1, target material usage
    penaltyFactor: number;     // SIMP penalty (typically 3)
    filterRadius: number;      // Sensitivity filter radius
    maxIterations: number;
    convergenceTol: number;
    minDensity: number;        // Prevent singularity
}

export interface OptimizationResult {
    densities: number[][];     // 2D density field
    compliance: number;        // Final compliance (lower = stiffer)
    volumeFraction: number;    // Actual volume
    iterations: number;
    converged: boolean;
    history: { iteration: number; compliance: number; volume: number }[];
}

export interface TopologyDesign {
    outline: { x: number; y: number }[];
    voids: { x: number; y: number; radius: number }[];
    structuralPaths: { start: { x: number; y: number }; end: { x: number; y: number } }[];
    efficiency: number;
}

// ============================================
// TOPOLOGY OPTIMIZER SERVICE
// ============================================

class TopologyOptimizerServiceClass {
    private readonly DEFAULT_PARAMS: OptimizationParams = {
        volumeFraction: 0.4,
        penaltyFactor: 3,
        filterRadius: 1.5,
        maxIterations: 100,
        convergenceTol: 0.01,
        minDensity: 0.001
    };

    /**
     * Run 2D topology optimization (SIMP method)
     */
    optimize2D(
        domain: OptimizationDomain,
        loads: LoadCase[],
        supports: Support[],
        params: Partial<OptimizationParams> = {}
    ): OptimizationResult {
        const config = { ...this.DEFAULT_PARAMS, ...params };
        const nx = Math.ceil(domain.width * domain.resolution);
        const ny = Math.ceil(domain.height * domain.resolution);

        // Initialize uniform density field
        let densities = this.initializeDensities(nx, ny, config.volumeFraction);

        const history: OptimizationResult['history'] = [];
        let prevCompliance = Infinity;
        let converged = false;
        let iteration = 0;

        // Main optimization loop
        while (iteration < config.maxIterations && !converged) {
            // 1. Assemble stiffness with current densities
            const K = this.assembleStiffness(densities, config.penaltyFactor, domain);

            // 2. Apply loads and supports
            const { U, F } = this.solveSystem(K, loads, supports, domain, nx, ny);

            // 3. Calculate compliance (objective function)
            const compliance = this.calculateCompliance(U, F);

            // 4. Calculate sensitivities
            const sensitivities = this.calculateSensitivities(
                densities, U, config.penaltyFactor, domain
            );

            // 5. Apply sensitivity filter
            const filteredSensitivities = this.applyFilter(
                sensitivities, config.filterRadius
            );

            // 6. Update densities (OC method)
            densities = this.updateDensities(
                densities, filteredSensitivities, config
            );

            // 7. Check convergence
            const change = Math.abs(compliance - prevCompliance) / prevCompliance;
            converged = change < config.convergenceTol;

            history.push({
                iteration,
                compliance,
                volume: this.calculateVolume(densities)
            });

            prevCompliance = compliance;
            iteration++;
        }

        return {
            densities,
            compliance: prevCompliance,
            volumeFraction: this.calculateVolume(densities),
            iterations: iteration,
            converged,
            history
        };
    }

    /**
     * Extract structural design from optimization result
     */
    extractDesign(result: OptimizationResult, threshold: number = 0.5): TopologyDesign {
        const nx = result.densities.length;
        const ny = result.densities[0]?.length || 0;

        // Find solid/void boundaries
        const outline: TopologyDesign['outline'] = [];
        const voids: TopologyDesign['voids'] = [];

        // March through grid to find boundaries
        for (let i = 0; i < nx; i++) {
            for (let j = 0; j < ny; j++) {
                const density = result.densities[i][j];

                // Check if this is a boundary cell
                if (density > threshold) {
                    const hasVoidNeighbor = this.hasNeighborBelow(
                        result.densities, i, j, threshold
                    );
                    if (hasVoidNeighbor) {
                        outline.push({ x: i, y: j });
                    }
                } else {
                    // Check if this void is significant
                    const voidSize = this.measureVoid(result.densities, i, j, threshold);
                    if (voidSize > 4) {
                        voids.push({ x: i, y: j, radius: Math.sqrt(voidSize) });
                    }
                }
            }
        }

        // Identify structural load paths
        const structuralPaths = this.identifyLoadPaths(result.densities, threshold);

        // Calculate efficiency
        const efficiency = 1 / (result.compliance * result.volumeFraction);

        return { outline, voids, structuralPaths, efficiency };
    }

    /**
     * Generate optimized truss from topology
     */
    generateTruss(
        design: TopologyDesign,
        domain: OptimizationDomain
    ): { nodes: { x: number; y: number }[]; members: { start: number; end: number }[] } {
        const nodes: { x: number; y: number }[] = [];
        const members: { start: number; end: number }[] = [];

        // Convert load paths to truss members
        design.structuralPaths.forEach(path => {
            const startIdx = nodes.findIndex(
                n => Math.abs(n.x - path.start.x) < 1 && Math.abs(n.y - path.start.y) < 1
            );
            const endIdx = nodes.findIndex(
                n => Math.abs(n.x - path.end.x) < 1 && Math.abs(n.y - path.end.y) < 1
            );

            let si = startIdx;
            let ei = endIdx;

            if (si === -1) {
                si = nodes.length;
                nodes.push({ x: path.start.x * domain.width / 100, y: path.start.y * domain.height / 100 });
            }
            if (ei === -1) {
                ei = nodes.length;
                nodes.push({ x: path.end.x * domain.width / 100, y: path.end.y * domain.height / 100 });
            }

            members.push({ start: si, end: ei });
        });

        return { nodes, members };
    }

    /**
     * Quick preset optimization for common cases
     */
    optimizeBeamWithHole(
        length: number,
        height: number,
        holePosition: { x: number; y: number },
        holeRadius: number
    ): OptimizationResult {
        const domain: OptimizationDomain = {
            width: length,
            height: height,
            resolution: 0.1
        };

        // Standard beam loading
        const loads: LoadCase[] = [
            { position: { x: length / 2, y: height }, force: { fx: 0, fy: -10000 } }
        ];

        const supports: Support[] = [
            { position: { x: 0, y: 0 }, type: 'fixed' },
            { position: { x: length, y: 0 }, type: 'roller' }
        ];

        return this.optimize2D(domain, loads, supports, { volumeFraction: 0.5 });
    }

    // ============================================
    // PRIVATE METHODS
    // ============================================

    private initializeDensities(nx: number, ny: number, vf: number): number[][] {
        return Array(nx).fill(null).map(() => Array(ny).fill(vf));
    }

    private assembleStiffness(
        densities: number[][],
        p: number,
        domain: OptimizationDomain
    ): number[][] {
        // Simplified 2D stiffness assembly
        const nx = densities.length;
        const ny = densities[0].length;
        const ndof = 2 * (nx + 1) * (ny + 1);
        const K = Array(ndof).fill(null).map(() => Array(ndof).fill(0));

        // Element stiffness contribution (simplified)
        const E0 = 200e9; // Young's modulus
        const dx = domain.width / nx;
        const dy = domain.height / ny;

        for (let i = 0; i < nx; i++) {
            for (let j = 0; j < ny; j++) {
                const Ee = E0 * Math.pow(densities[i][j], p);
                // Add element contribution to global K (simplified)
                const edof = this.getElementDOFs(i, j, ny);
                edof.forEach((di, ii) => {
                    edof.forEach((dj, jj) => {
                        K[di][dj] += Ee * dx * dy * (ii === jj ? 1 : 0.1);
                    });
                });
            }
        }

        return K;
    }

    private getElementDOFs(i: number, j: number, ny: number): number[] {
        const n1 = i * (ny + 1) + j;
        const n2 = n1 + 1;
        const n3 = n1 + ny + 2;
        const n4 = n1 + ny + 1;
        return [2 * n1, 2 * n1 + 1, 2 * n2, 2 * n2 + 1, 2 * n3, 2 * n3 + 1, 2 * n4, 2 * n4 + 1];
    }

    private solveSystem(
        K: number[][],
        loads: LoadCase[],
        supports: Support[],
        domain: OptimizationDomain,
        nx: number,
        ny: number
    ): { U: number[]; F: number[] } {
        const ndof = K.length;
        const U = Array(ndof).fill(0);
        const F = Array(ndof).fill(0);

        // Apply loads (simplified)
        loads.forEach(load => {
            const ni = Math.floor(load.position.x / domain.width * nx);
            const nj = Math.floor(load.position.y / domain.height * ny);
            const node = ni * (ny + 1) + nj;
            if (2 * node + 1 < ndof) {
                F[2 * node] = load.force.fx;
                F[2 * node + 1] = load.force.fy;
            }
        });

        // Solve (simplified - just scale F by stiffness inverse approximation)
        for (let i = 0; i < ndof; i++) {
            U[i] = K[i][i] > 1e-10 ? F[i] / K[i][i] : 0;
        }

        return { U, F };
    }

    private calculateCompliance(U: number[], F: number[]): number {
        let C = 0;
        for (let i = 0; i < U.length; i++) {
            C += U[i] * F[i];
        }
        return Math.abs(C);
    }

    private calculateSensitivities(
        densities: number[][],
        U: number[],
        p: number,
        domain: OptimizationDomain
    ): number[][] {
        const nx = densities.length;
        const ny = densities[0].length;
        const sens = Array(nx).fill(null).map(() => Array(ny).fill(0));

        // dC/dx = -p * x^(p-1) * u^T * k0 * u (simplified)
        for (let i = 0; i < nx; i++) {
            for (let j = 0; j < ny; j++) {
                const edof = this.getElementDOFs(i, j, ny);
                let ue = 0;
                edof.forEach(d => {
                    if (d < U.length) ue += U[d] * U[d];
                });
                sens[i][j] = -p * Math.pow(densities[i][j], p - 1) * ue;
            }
        }

        return sens;
    }

    private applyFilter(sens: number[][], radius: number): number[][] {
        const nx = sens.length;
        const ny = sens[0].length;
        const filtered = Array(nx).fill(null).map(() => Array(ny).fill(0));

        const r = Math.ceil(radius);
        for (let i = 0; i < nx; i++) {
            for (let j = 0; j < ny; j++) {
                let sumW = 0;
                let sumWS = 0;

                for (let di = -r; di <= r; di++) {
                    for (let dj = -r; dj <= r; dj++) {
                        const ni = i + di;
                        const nj = j + dj;
                        if (ni >= 0 && ni < nx && nj >= 0 && nj < ny) {
                            const dist = Math.sqrt(di * di + dj * dj);
                            if (dist <= radius) {
                                const w = radius - dist;
                                sumW += w;
                                sumWS += w * sens[ni][nj];
                            }
                        }
                    }
                }

                filtered[i][j] = sumW > 0 ? sumWS / sumW : sens[i][j];
            }
        }

        return filtered;
    }

    private updateDensities(
        densities: number[][],
        sens: number[][],
        config: OptimizationParams
    ): number[][] {
        const nx = densities.length;
        const ny = densities[0].length;
        const newDens = Array(nx).fill(null).map(() => Array(ny).fill(0));

        // Optimality Criteria update
        const move = 0.2;
        let l1 = 0, l2 = 1e9;

        // Bisection to find Lagrange multiplier
        while ((l2 - l1) / (l1 + l2) > 1e-3) {
            const lmid = (l1 + l2) / 2;
            let vol = 0;

            for (let i = 0; i < nx; i++) {
                for (let j = 0; j < ny; j++) {
                    const Be = -sens[i][j] / lmid;
                    let xnew = densities[i][j] * Math.sqrt(Be);
                    xnew = Math.max(config.minDensity, Math.max(
                        densities[i][j] - move,
                        Math.min(1, Math.min(densities[i][j] + move, xnew))
                    ));
                    newDens[i][j] = xnew;
                    vol += xnew;
                }
            }

            vol /= (nx * ny);
            if (vol > config.volumeFraction) {
                l1 = lmid;
            } else {
                l2 = lmid;
            }
        }

        return newDens;
    }

    private calculateVolume(densities: number[][]): number {
        let sum = 0;
        let count = 0;
        for (const row of densities) {
            for (const d of row) {
                sum += d;
                count++;
            }
        }
        return count > 0 ? sum / count : 0;
    }

    private hasNeighborBelow(
        densities: number[][],
        i: number,
        j: number,
        threshold: number
    ): boolean {
        const neighbors = [
            [i - 1, j], [i + 1, j], [i, j - 1], [i, j + 1]
        ];
        for (const [ni, nj] of neighbors) {
            if (ni >= 0 && ni < densities.length && nj >= 0 && nj < densities[0].length) {
                if (densities[ni][nj] < threshold) return true;
            }
        }
        return false;
    }

    private measureVoid(
        densities: number[][],
        i: number,
        j: number,
        threshold: number
    ): number {
        // Simplified flood fill to measure void size
        if (densities[i][j] >= threshold) return 0;
        return 1; // Simplified
    }

    private identifyLoadPaths(
        densities: number[][],
        threshold: number
    ): TopologyDesign['structuralPaths'] {
        const paths: TopologyDesign['structuralPaths'] = [];
        const nx = densities.length;
        const ny = densities[0]?.length || 0;

        // Find high-density corridors (simplified)
        for (let i = 1; i < nx - 1; i++) {
            for (let j = 1; j < ny - 1; j++) {
                if (densities[i][j] > 0.8) {
                    // Check for horizontal path
                    if (densities[i - 1][j] > 0.8 && densities[i + 1][j] > 0.8) {
                        paths.push({
                            start: { x: i - 1, y: j },
                            end: { x: i + 1, y: j }
                        });
                    }
                    // Check for vertical path
                    if (densities[i][j - 1] > 0.8 && densities[i][j + 1] > 0.8) {
                        paths.push({
                            start: { x: i, y: j - 1 },
                            end: { x: i, y: j + 1 }
                        });
                    }
                }
            }
        }

        return paths;
    }
}

// ============================================
// SINGLETON
// ============================================

export const topologyOptimizer = new TopologyOptimizerServiceClass();
export default TopologyOptimizerServiceClass;
