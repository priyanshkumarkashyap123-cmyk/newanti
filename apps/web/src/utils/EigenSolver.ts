/**
 * EigenSolver - Modal Analysis Solver
 * Solves the generalized eigenvalue problem: (K - ω²M)v = 0
 * Finds natural frequencies and mode shapes for structural dynamics
 */

import * as math from 'mathjs';

// ============================================
// TYPES & INTERFACES
// ============================================

export interface MassProperties {
    nodeId: string;
    mass: number;      // Translational mass (kg or kN·s²/m)
    Ix?: number;       // Rotational inertia about x-axis
    Iy?: number;       // Rotational inertia about y-axis
    Iz?: number;       // Rotational inertia about z-axis
}

export interface ModeShape {
    modeNumber: number;
    eigenvalue: number;         // ω² (rad/s)²
    frequency: number;          // Natural frequency (Hz)
    period: number;             // Natural period (seconds)
    angularFrequency: number;   // ω (rad/s)
    modeShape: Map<string, number[]>;  // nodeId -> [dx, dy, dz, rx, ry, rz]
    participationFactor: {
        x: number;
        y: number;
        z: number;
    };
    effectiveMass: {
        x: number;
        y: number;
        z: number;
    };
}

export interface EigenResult {
    numModes: number;
    modes: ModeShape[];
    totalMass: number;
    cumulativeEffectiveMass: {
        x: number[];
        y: number[];
        z: number[];
    };
}

// ============================================
// EIGEN SOLVER CLASS
// ============================================

export class EigenSolver {
    private K: number[][];      // Global stiffness matrix
    private M: number[][];      // Global mass matrix
    private dofMap: Map<string, number>;  // DOF mapping
    private nodeIds: string[];
    private nDof: number;
    private freeDofs: number[];
    private fixedDofs: number[];

    constructor() {
        this.K = [];
        this.M = [];
        this.dofMap = new Map();
        this.nodeIds = [];
        this.nDof = 0;
        this.freeDofs = [];
        this.fixedDofs = [];
    }

    /**
     * Initialize DOF mapping
     */
    initializeDofMap(nodeIds: string[]): void {
        this.nodeIds = nodeIds;
        this.nDof = nodeIds.length * 6;  // 6 DOF per node

        nodeIds.forEach((nodeId, i) => {
            const baseIdx = i * 6;
            this.dofMap.set(`${nodeId}_dx`, baseIdx);
            this.dofMap.set(`${nodeId}_dy`, baseIdx + 1);
            this.dofMap.set(`${nodeId}_dz`, baseIdx + 2);
            this.dofMap.set(`${nodeId}_rx`, baseIdx + 3);
            this.dofMap.set(`${nodeId}_ry`, baseIdx + 4);
            this.dofMap.set(`${nodeId}_rz`, baseIdx + 5);
        });

        // Initialize matrices
        this.K = this.createZeroMatrix(this.nDof);
        this.M = this.createZeroMatrix(this.nDof);
    }

    /**
     * Create zero matrix
     */
    private createZeroMatrix(n: number): number[][] {
        return Array(n).fill(null).map(() => Array(n).fill(0));
    }

    /**
     * Set the global stiffness matrix (from Solver class)
     */
    setStiffnessMatrix(K: number[][]): void {
        this.K = K;
        this.nDof = K.length;
    }

    /**
     * Assemble lumped mass matrix (diagonal)
     * Each node has mass concentrated at translational DOFs
     */
    assembleLumpedMassMatrix(massProperties: MassProperties[]): void {
        for (const mp of massProperties) {
            const baseIdx = this.dofMap.get(`${mp.nodeId}_dx`);
            if (baseIdx === undefined) continue;

            // Translational masses
            this.M[baseIdx]![baseIdx] = mp.mass;
            this.M[baseIdx + 1]![baseIdx + 1] = mp.mass;
            this.M[baseIdx + 2]![baseIdx + 2] = mp.mass;

            // Rotational inertias (if provided)
            this.M[baseIdx + 3]![baseIdx + 3] = mp.Ix ?? mp.mass * 0.01;  // Small default
            this.M[baseIdx + 4]![baseIdx + 4] = mp.Iy ?? mp.mass * 0.01;
            this.M[baseIdx + 5]![baseIdx + 5] = mp.Iz ?? mp.mass * 0.01;
        }
    }

    /**
     * Set fixed DOFs (boundary conditions)
     */
    setFixedDofs(fixedDofIndices: number[]): void {
        this.fixedDofs = fixedDofIndices;
        this.freeDofs = [];

        for (let i = 0; i < this.nDof; i++) {
            if (!fixedDofIndices.includes(i)) {
                this.freeDofs.push(i);
            }
        }
    }

    /**
     * Extract submatrix for free DOFs only
     */
    private extractSubmatrix(fullMatrix: number[][], dofs: number[]): number[][] {
        const n = dofs.length;
        const sub: number[][] = this.createZeroMatrix(n);

        for (let i = 0; i < n; i++) {
            for (let j = 0; j < n; j++) {
                sub[i]![j] = fullMatrix[dofs[i]!]![dofs[j]!]!;
            }
        }

        return sub;
    }

    /**
     * Power Iteration Method for finding dominant eigenvalue
     * Returns largest eigenvalue and corresponding eigenvector
     */
    private powerIteration(A: number[][], maxIter: number = 1000, tol: number = 1e-10): { eigenvalue: number; eigenvector: number[] } {
        const n = A.length;

        // Random initial vector
        let v = Array(n).fill(0).map(() => Math.random());

        // Normalize
        let norm = Math.sqrt(v.reduce((sum, x) => sum + x * x, 0));
        v = v.map(x => x / norm);

        let eigenvalue = 0;

        for (let iter = 0; iter < maxIter; iter++) {
            // Multiply: w = A * v
            const w: number[] = Array(n).fill(0);
            for (let i = 0; i < n; i++) {
                for (let j = 0; j < n; j++) {
                    w[i] += A[i]![j]! * v[j]!;
                }
            }

            // New eigenvalue estimate
            const newEigenvalue = w.reduce((sum, wi, i) => sum + wi * v[i]!, 0);

            // Normalize w
            norm = Math.sqrt(w.reduce((sum, x) => sum + x * x, 0));
            if (norm < 1e-15) break;

            const newV = w.map(x => x / norm);

            // Check convergence
            if (Math.abs(newEigenvalue - eigenvalue) < tol) {
                return { eigenvalue: newEigenvalue, eigenvector: newV };
            }

            eigenvalue = newEigenvalue;
            v = newV;
        }

        return { eigenvalue, eigenvector: v };
    }

    /**
     * Inverse Power Iteration for smallest eigenvalue
     */
    private inversePowerIteration(A: number[][], shift: number = 0, maxIter: number = 1000, tol: number = 1e-10): { eigenvalue: number; eigenvector: number[] } {
        const n = A.length;

        // Shifted matrix: A - shift * I
        const shiftedA: number[][] = A.map((row, i) =>
            row.map((val, j) => i === j ? val - shift : val)
        );

        // LU decomposition for solving
        const invA = this.invertMatrix(shiftedA);
        if (!invA) {
            return this.powerIteration(A);  // Fallback
        }

        // Power iteration on inverted matrix
        const result = this.powerIteration(invA, maxIter, tol);

        return {
            eigenvalue: 1 / result.eigenvalue + shift,
            eigenvector: result.eigenvector
        };
    }

    /**
     * Simple matrix inversion using Gaussian elimination
     */
    private invertMatrix(A: number[][]): number[][] | null {
        const n = A.length;
        const augmented: number[][] = A.map((row, i) =>
            [...row, ...Array(n).fill(0).map((_, j) => i === j ? 1 : 0)]
        );

        // Forward elimination
        for (let i = 0; i < n; i++) {
            // Find pivot
            let maxRow = i;
            for (let k = i + 1; k < n; k++) {
                if (Math.abs(augmented[k]![i]!) > Math.abs(augmented[maxRow]![i]!)) {
                    maxRow = k;
                }
            }
            [augmented[i], augmented[maxRow]] = [augmented[maxRow]!, augmented[i]!];

            if (Math.abs(augmented[i]![i]!) < 1e-15) return null;  // Singular

            // Scale pivot row
            const pivot = augmented[i]![i]!;
            for (let j = 0; j < 2 * n; j++) {
                augmented[i]![j] /= pivot;
            }

            // Eliminate column
            for (let k = 0; k < n; k++) {
                if (k === i) continue;
                const factor = augmented[k]![i]!;
                for (let j = 0; j < 2 * n; j++) {
                    augmented[k]![j] -= factor * augmented[i]![j]!;
                }
            }
        }

        // Extract inverse
        return augmented.map(row => row.slice(n));
    }

    /**
     * Deflation method to find multiple eigenvalues
     */
    private findMultipleEigenvalues(A: number[][], numModes: number): Array<{ eigenvalue: number; eigenvector: number[] }> {
        const results: Array<{ eigenvalue: number; eigenvector: number[] }> = [];
        const n = A.length;
        let currentA = A.map(row => [...row]);

        for (let mode = 0; mode < numModes && mode < n; mode++) {
            const result = this.powerIteration(currentA);
            results.push(result);

            // Deflate matrix: A' = A - λ * v * v^T
            const lambda = result.eigenvalue;
            const v = result.eigenvector;

            for (let i = 0; i < n; i++) {
                for (let j = 0; j < n; j++) {
                    currentA[i]![j] -= lambda * v[i]! * v[j]!;
                }
            }
        }

        return results;
    }

    /**
     * Solve eigenvalue problem using mathjs (for small models)
     * Solves: K * v = ω² * M * v
     * Transformed to standard form: M^(-1) * K * v = ω² * v
     */
    solveWithMathjs(numModes: number = 10): EigenResult {
        // Extract matrices for free DOFs
        const Kff = this.extractSubmatrix(this.K, this.freeDofs);
        const Mff = this.extractSubmatrix(this.M, this.freeDofs);

        const n = this.freeDofs.length;

        // Invert mass matrix
        const Mff_inv = this.invertMatrix(Mff);
        if (!Mff_inv) {
            throw new Error('Mass matrix is singular');
        }

        // Form standard eigenvalue problem: A = M^(-1) * K
        const A: number[][] = this.createZeroMatrix(n);
        for (let i = 0; i < n; i++) {
            for (let j = 0; j < n; j++) {
                for (let k = 0; k < n; k++) {
                    A[i]![j]! += Mff_inv[i]![k]! * Kff[k]![j]!;
                }
            }
        }

        try {
            // Use mathjs eigs function
            const result = math.eigs(A);
            const eigenvalues = result.values as math.MathCollection;
            const eigenvectors = result.eigenvectors as Array<{ value: number | math.Complex; vector: math.MathCollection }>;

            // Extract and sort eigenvalues
            const modes: ModeShape[] = [];
            const eigenPairs: Array<{ value: number; vector: number[] }> = [];

            // Convert to array and filter real positive eigenvalues
            if (Array.isArray(eigenvectors)) {
                for (const ev of eigenvectors) {
                    const val = typeof ev.value === 'number' ? ev.value : (ev.value as any).re ?? 0;
                    if (val > 1e-6) {  // Only positive eigenvalues (frequencies)
                        const flatVec = math.flatten(ev.vector);
                        // Handle both array and Matrix types
                        const vec = (flatVec as { valueOf: () => number[] }).valueOf() as number[];
                        eigenPairs.push({ value: val, vector: vec });
                    }
                }
            }

            // Sort by eigenvalue (smallest first = lowest frequency)
            eigenPairs.sort((a, b) => a.value - b.value);

            // Take requested number of modes
            const selectedModes = eigenPairs.slice(0, Math.min(numModes, eigenPairs.length));

            // Calculate total mass
            let totalMass = 0;
            for (let i = 0; i < n; i += 6) {
                totalMass += Mff[i]![i]!;  // Sum translational masses (x-direction)
            }

            // Build mode shapes
            for (let m = 0; m < selectedModes.length; m++) {
                const pair = selectedModes[m]!;
                const omega2 = pair.value;
                const omega = Math.sqrt(omega2);
                const freq = omega / (2 * Math.PI);
                const period = 1 / freq;

                // Map eigenvector back to full DOF
                const modeShape = new Map<string, number[]>();
                for (let i = 0; i < this.nodeIds.length; i++) {
                    const nodeId = this.nodeIds[i]!;
                    const shape = [0, 0, 0, 0, 0, 0];

                    for (let d = 0; d < 6; d++) {
                        const globalDof = i * 6 + d;
                        const localIdx = this.freeDofs.indexOf(globalDof);
                        if (localIdx >= 0 && localIdx < pair.vector.length) {
                            shape[d] = pair.vector[localIdx]!;
                        }
                    }
                    modeShape.set(nodeId, shape);
                }

                // Calculate participation factors
                let Lx = 0, Ly = 0, Lz = 0;
                let Mx = 0, My = 0, Mz = 0;

                for (let i = 0; i < n; i += 6) {
                    const mass = Mff[i]![i]!;
                    const phiX = pair.vector[i] ?? 0;
                    const phiY = pair.vector[i + 1] ?? 0;
                    const phiZ = pair.vector[i + 2] ?? 0;

                    Lx += mass * phiX;
                    Ly += mass * phiY;
                    Lz += mass * phiZ;

                    Mx += mass * phiX * phiX;
                    My += mass * phiY * phiY;
                    Mz += mass * phiZ * phiZ;
                }

                const gammaX = Lx / Mx;
                const gammaY = Ly / My;
                const gammaZ = Lz / Mz;

                modes.push({
                    modeNumber: m + 1,
                    eigenvalue: omega2,
                    frequency: freq,
                    period: period,
                    angularFrequency: omega,
                    modeShape: modeShape,
                    participationFactor: { x: gammaX, y: gammaY, z: gammaZ },
                    effectiveMass: {
                        x: (Lx * Lx) / Mx,
                        y: (Ly * Ly) / My,
                        z: (Lz * Lz) / Mz
                    }
                });
            }

            // Calculate cumulative effective mass
            const cumulativeEffectiveMass = {
                x: [] as number[],
                y: [] as number[],
                z: [] as number[]
            };

            let sumX = 0, sumY = 0, sumZ = 0;
            for (const mode of modes) {
                sumX += mode.effectiveMass.x;
                sumY += mode.effectiveMass.y;
                sumZ += mode.effectiveMass.z;
                cumulativeEffectiveMass.x.push((sumX / totalMass) * 100);
                cumulativeEffectiveMass.y.push((sumY / totalMass) * 100);
                cumulativeEffectiveMass.z.push((sumZ / totalMass) * 100);
            }

            return {
                numModes: modes.length,
                modes,
                totalMass,
                cumulativeEffectiveMass
            };

        } catch (error) {
            // Fallback to power iteration
            console.warn('mathjs eigs failed, using power iteration:', error);
            return this.solveWithPowerIteration(numModes);
        }
    }

    /**
     * Solve using power iteration (fallback for larger models)
     */
    solveWithPowerIteration(numModes: number = 10): EigenResult {
        const Kff = this.extractSubmatrix(this.K, this.freeDofs);
        const Mff = this.extractSubmatrix(this.M, this.freeDofs);
        const n = this.freeDofs.length;

        // Invert mass matrix
        const Mff_inv = this.invertMatrix(Mff);
        if (!Mff_inv) {
            throw new Error('Mass matrix is singular');
        }

        // A = M^(-1) * K
        const A: number[][] = this.createZeroMatrix(n);
        for (let i = 0; i < n; i++) {
            for (let j = 0; j < n; j++) {
                for (let k = 0; k < n; k++) {
                    A[i]![j]! += Mff_inv[i]![k]! * Kff[k]![j]!;
                }
            }
        }

        // Find eigenvalues using deflation
        const eigenPairs = this.findMultipleEigenvalues(A, numModes);

        // Sort by eigenvalue
        eigenPairs.sort((a, b) => a.eigenvalue - b.eigenvalue);

        // Build mode shapes
        const modes: ModeShape[] = [];
        let totalMass = 0;
        for (let i = 0; i < n; i += 6) {
            totalMass += Mff[i]![i]!;
        }

        for (let m = 0; m < eigenPairs.length; m++) {
            const pair = eigenPairs[m]!;
            if (pair.eigenvalue <= 0) continue;

            const omega2 = pair.eigenvalue;
            const omega = Math.sqrt(omega2);
            const freq = omega / (2 * Math.PI);
            const period = freq > 0 ? 1 / freq : Infinity;

            const modeShape = new Map<string, number[]>();
            for (let i = 0; i < this.nodeIds.length; i++) {
                const nodeId = this.nodeIds[i]!;
                const shape = [0, 0, 0, 0, 0, 0];

                for (let d = 0; d < 6; d++) {
                    const globalDof = i * 6 + d;
                    const localIdx = this.freeDofs.indexOf(globalDof);
                    if (localIdx >= 0 && localIdx < pair.eigenvector.length) {
                        shape[d] = pair.eigenvector[localIdx]!;
                    }
                }
                modeShape.set(nodeId, shape);
            }

            modes.push({
                modeNumber: m + 1,
                eigenvalue: omega2,
                frequency: freq,
                period: period,
                angularFrequency: omega,
                modeShape: modeShape,
                participationFactor: { x: 1, y: 1, z: 1 },  // Simplified
                effectiveMass: { x: totalMass / modes.length, y: totalMass / modes.length, z: totalMass / modes.length }
            });
        }

        return {
            numModes: modes.length,
            modes,
            totalMass,
            cumulativeEffectiveMass: { x: [], y: [], z: [] }
        };
    }

    /**
     * Main solve method - chooses appropriate solver
     */
    solve(numModes: number = 10): EigenResult {
        const n = this.freeDofs.length;

        if (n <= 100) {
            // Use mathjs for small problems
            return this.solveWithMathjs(numModes);
        } else {
            // Use power iteration for larger problems
            return this.solveWithPowerIteration(numModes);
        }
    }

    /**
     * Get natural frequencies summary
     */
    static getSummary(result: EigenResult): string {
        const lines: string[] = [
            '=== Modal Analysis Results ===',
            `Number of modes: ${result.numModes}`,
            `Total mass: ${result.totalMass.toFixed(2)}`,
            '',
            'Mode | Frequency (Hz) | Period (s) | Eff. Mass X% | Eff. Mass Y%',
            '-----+----------------+------------+-------------+-------------'
        ];

        for (const mode of result.modes) {
            const cumX = result.cumulativeEffectiveMass.x[mode.modeNumber - 1] ?? 0;
            const cumY = result.cumulativeEffectiveMass.y[mode.modeNumber - 1] ?? 0;
            lines.push(
                `${mode.modeNumber.toString().padStart(4)} | ` +
                `${mode.frequency.toFixed(4).padStart(14)} | ` +
                `${mode.period.toFixed(4).padStart(10)} | ` +
                `${cumX.toFixed(1).padStart(11)}% | ` +
                `${cumY.toFixed(1).padStart(11)}%`
            );
        }

        return lines.join('\n');
    }
}

export default EigenSolver;
