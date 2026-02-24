import * as math from 'mathjs';
import { MatrixUtils } from './MatrixUtils';

// ============================================
// MEMBER FORCES CALCULATOR
// ============================================
// Calculates internal forces along member length for SFD/BMD diagrams

export interface ForcePoint {
    x: number;      // Distance from start (0 to L)
    Mz: number;     // Bending moment about z-axis (kN·m)
    Fy: number;     // Shear force in y-direction (kN)
    My?: number;    // Bending moment about y-axis (optional, 3D)
    Fz?: number;    // Shear force in z-direction (optional, 3D)
    Fx?: number;    // Axial force (optional)
    Tx?: number;    // Torsion (optional)
}

export interface MemberEndForces {
    // Start node forces (local coordinates)
    N1: number;     // Axial force at start
    Vy1: number;    // Shear Y at start
    Vz1: number;    // Shear Z at start
    Tx1: number;    // Torsion at start
    My1: number;    // Moment Y at start
    Mz1: number;    // Moment Z at start
    // End node forces
    N2: number;
    Vy2: number;
    Vz2: number;
    Tx2: number;
    My2: number;
    Mz2: number;
}

export interface DistributedLoad {
    type: 'uniform' | 'linear';
    w1: number;     // Load intensity at start (kN/m)
    w2?: number;    // Load intensity at end (for linear, kN/m)
    direction: 'y' | 'z';
}

const NUM_SEGMENTS = 20;

export class MemberForcesCalculator {

    /**
     * Calculate end forces from stiffness matrix and displacements
     * EndForces = k * u (in local coordinates)
     * 
     * @param k Local stiffness matrix (12x12)
     * @param u Member displacements in local coordinates (12x1)
     * @returns Member end forces
     */
    static calculateEndForces(k: math.Matrix, u: number[]): MemberEndForces {
        const uMatrix = math.matrix(u.map(v => [v]));
        const fMatrix = MatrixUtils.multiply(k, uMatrix);
        const f = (fMatrix.toArray() as number[][]).map(row => row[0]);

        return {
            N1: f[0],
            Vy1: f[1],
            Vz1: f[2],
            Tx1: f[3],
            My1: f[4],
            Mz1: f[5],
            N2: f[6],
            Vy2: f[7],
            Vz2: f[8],
            Tx2: f[9],
            My2: f[10],
            Mz2: f[11]
        };
    }

    /**
     * Calculate internal forces along member length using equilibrium
     * Divides member into segments and calculates forces at each point
     * 
     * For a beam element with end forces only (no intermediate loads):
     * - Shear V(x) = V1 (constant for no distributed load)
     * - Moment M(x) = -M1 + V1 * x
     * 
     * @param L Member length
     * @param endForces End forces in local coordinates
     * @param distributedLoad Optional distributed load on member
     * @returns Array of force points along member
     */
    static calculateInternalForces(
        L: number,
        endForces: MemberEndForces,
        distributedLoad?: DistributedLoad
    ): ForcePoint[] {
        const points: ForcePoint[] = [];
        const dx = L / NUM_SEGMENTS;

        for (let i = 0; i <= NUM_SEGMENTS; i++) {
            const x = i * dx;

            let Fy: number;
            let Mz: number;
            let Fz: number;
            let My: number;

            if (distributedLoad) {
                // With distributed load
                const result = this.calculateWithDistributedLoad(
                    x, L, endForces, distributedLoad
                );
                Fy = result.Fy;
                Mz = result.Mz;
                Fz = result.Fz;
                My = result.My;
            } else {
                // End forces only - linear interpolation
                // Using sign convention: positive shear causes clockwise rotation
                // Positive moment causes compression on top fiber

                // Shear in Y direction (constant for point loads only)
                // V(x) = V1 (matches diagramUtils: V_y(x) = V1 − dVy)
                Fy = endForces.Vy1;

                // Moment about Z axis
                // M(x) = -M1 + V1·x (matches diagramUtils: M_z(x) = −M1 + V1·x − dMz)
                Mz = -endForces.Mz1 + endForces.Vy1 * x;

                // Shear in Z direction (for 3D frames)
                Fz = endForces.Vz1;

                // Moment about Y axis
                // My(x) = My1 + Vz1·x (matches diagramUtils: M_y(x) = My1 + Vz1·x − dMy)
                My = endForces.My1 + endForces.Vz1 * x;
            }

            // Axial force (constant along length for no intermediate axial loads)
            const Fx = -endForces.N1;

            // Torsion (constant along length)
            const Tx = -endForces.Tx1;

            points.push({
                x,
                Mz,
                Fy,
                My,
                Fz,
                Fx,
                Tx
            });
        }

        return points;
    }

    /**
     * Calculate forces with distributed load applied
     * Using superposition of end forces and load effects
     */
    private static calculateWithDistributedLoad(
        x: number,
        L: number,
        endForces: MemberEndForces,
        load: DistributedLoad
    ): { Fy: number; Mz: number; Fz: number; My: number } {
        let Fy = 0;
        let Mz = 0;
        let Fz = 0;
        let My = 0;

        if (load.direction === 'y') {
            if (load.type === 'uniform') {
                const w = load.w1;
                // V(x) = V1 - w*x  (matches diagramUtils: V_y = V1 − dVy)
                Fy = endForces.Vy1 - w * x;
                // M(x) = -M1 + V1*x - w*x²/2  (matches diagramUtils: Mz = −M1 + V1·x − dMz)
                Mz = -endForces.Mz1 + endForces.Vy1 * x - (w * x * x) / 2;
            } else if (load.type === 'linear') {
                // Linearly varying load: w(x) = w1 + (w2-w1)*x/L
                const w1 = load.w1;
                const w2 = load.w2 ?? load.w1;
                const slope = (w2 - w1) / L;

                // V(x) = V1 - w1*x - slope*x²/2
                Fy = endForces.Vy1 - w1 * x - (slope * x * x) / 2;
                // M(x) = -M1 + V1*x - w1*x²/2 - slope*x³/6
                Mz = -endForces.Mz1 + endForces.Vy1 * x -
                    (w1 * x * x) / 2 - (slope * x * x * x) / 6;
            }
            Fz = endForces.Vz1;
            My = endForces.My1 + endForces.Vz1 * x;
        } else if (load.direction === 'z') {
            // Load in Z direction
            Fy = endForces.Vy1;
            Mz = -endForces.Mz1 + endForces.Vy1 * x;

            if (load.type === 'uniform') {
                const w = load.w1;
                Fz = endForces.Vz1 - w * x;
                My = endForces.My1 + endForces.Vz1 * x - (w * x * x) / 2;
            } else if (load.type === 'linear') {
                const w1 = load.w1;
                const w2 = load.w2 ?? load.w1;
                const slope = (w2 - w1) / L;
                Fz = endForces.Vz1 - w1 * x - (slope * x * x) / 2;
                My = endForces.My1 + endForces.Vz1 * x -
                    (w1 * x * x) / 2 - (slope * x * x * x) / 6;
            }
        }

        return { Fy, Mz, Fz, My };
    }

    /**
     * Get maximum and minimum values for diagram scaling
     */
    static getExtremes(points: ForcePoint[]): {
        maxMz: number; minMz: number;
        maxFy: number; minFy: number;
        maxMy: number; minMy: number;
        maxFz: number; minFz: number;
    } {
        let maxMz = -Infinity, minMz = Infinity;
        let maxFy = -Infinity, minFy = Infinity;
        let maxMy = -Infinity, minMy = Infinity;
        let maxFz = -Infinity, minFz = Infinity;

        for (const p of points) {
            maxMz = Math.max(maxMz, p.Mz);
            minMz = Math.min(minMz, p.Mz);
            maxFy = Math.max(maxFy, p.Fy);
            minFy = Math.min(minFy, p.Fy);
            if (p.My !== undefined) {
                maxMy = Math.max(maxMy, p.My);
                minMy = Math.min(minMy, p.My);
            }
            if (p.Fz !== undefined) {
                maxFz = Math.max(maxFz, p.Fz);
                minFz = Math.min(minFz, p.Fz);
            }
        }

        return { maxMz, minMz, maxFy, minFy, maxMy, minMy, maxFz, minFz };
    }

    /**
     * Find location and value of maximum moment (for design)
     */
    static findMaxMoment(points: ForcePoint[]): { x: number; Mz: number } {
        let maxMz = 0;
        let xAtMax = 0;

        for (const p of points) {
            if (Math.abs(p.Mz) > Math.abs(maxMz)) {
                maxMz = p.Mz;
                xAtMax = p.x;
            }
        }

        return { x: xAtMax, Mz: maxMz };
    }

    /**
     * Find point of zero shear (where moment is maximum for simple loading)
     */
    static findZeroShear(points: ForcePoint[]): { x: number; Mz: number } | null {
        for (let i = 0; i < points.length - 1; i++) {
            const p1 = points[i];
            const p2 = points[i + 1];

            // Check for sign change
            if (p1.Fy * p2.Fy < 0) {
                // Linear interpolation to find exact location
                const x = p1.x + (0 - p1.Fy) * (p2.x - p1.x) / (p2.Fy - p1.Fy);
                const Mz = p1.Mz + (x - p1.x) * (p2.Mz - p1.Mz) / (p2.x - p1.x);
                return { x, Mz };
            }
        }
        return null;
    }
}

export default MemberForcesCalculator;
