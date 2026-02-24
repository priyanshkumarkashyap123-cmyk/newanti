import * as math from 'mathjs';

// ============================================
// MATRIX UTILITIES FOR STRUCTURAL ANALYSIS
// ============================================
// Provides matrix operations for 3D frame analysis using mathjs

export interface Point3D {
    x: number;
    y: number;
    z: number;
}

export class MatrixUtils {

    /**
     * Calculate the length of a member between two nodes
     * @param nodeA Start node coordinates
     * @param nodeB End node coordinates
     * @returns Member length
     */
    static getMemberLength(nodeA: Point3D, nodeB: Point3D): number {
        const dx = nodeB.x - nodeA.x;
        const dy = nodeB.y - nodeA.y;
        const dz = nodeB.z - nodeA.z;
        return Math.sqrt(dx * dx + dy * dy + dz * dz);
    }

    /**
     * Get the 3x3 rotation matrix for transforming local to global coordinates
     * Uses the member orientation and an optional beta angle for roll
     * 
     * @param nodeA Start node coordinates
     * @param nodeB End node coordinates
     * @param betaAngle Roll angle about the member axis (radians), default 0
     * @returns 3x3 rotation matrix [λ]
     */
    static getRotationMatrix(nodeA: Point3D, nodeB: Point3D, betaAngle: number = 0): math.Matrix {
        const L = this.getMemberLength(nodeA, nodeB);

        if (L < 1e-10) {
            throw new Error('Member length is too small');
        }

        // Direction cosines
        const cx = (nodeB.x - nodeA.x) / L;  // cos(θx)
        const cy = (nodeB.y - nodeA.y) / L;  // cos(θy)
        const cz = (nodeB.z - nodeA.z) / L;  // cos(θz)

        // Handle special case: vertical member (along global Y-axis)
        const cxz = Math.sqrt(cx * cx + cz * cz);
        const tolerance = 1e-6;

        let r: number[][];

        if (cxz < tolerance) {
            // Vertical member - use simplified rotation matrix
            const sign = cy > 0 ? 1 : -1;
            r = [
                [0, sign, 0],
                [-sign * Math.cos(betaAngle), 0, Math.sin(betaAngle)],
                [sign * Math.sin(betaAngle), 0, Math.cos(betaAngle)]
            ];
        } else {
            // General case rotation matrix
            const cosBeta = Math.cos(betaAngle);
            const sinBeta = Math.sin(betaAngle);

            // Local x-axis (along member)
            const lx = [cx, cy, cz];

            // Local z-axis (cross product with global Y, then normalize)
            // z' = (member direction) × (global Y) for horizontal reference
            let lz: number[];

            if (Math.abs(cy) < 0.999) {
                // Default: reference vector is global Y (0, 1, 0)
                lz = [
                    -cz / cxz,
                    0,
                    cx / cxz
                ];
            } else {
                // Near-vertical: use global Z as reference
                lz = [1, 0, 0];
            }

            // Local y-axis = z' × x' (cross product)
            let ly = [
                lz[1] * lx[2] - lz[2] * lx[1],
                lz[2] * lx[0] - lz[0] * lx[2],
                lz[0] * lx[1] - lz[1] * lx[0]
            ];

            // Apply beta rotation about local x-axis
            if (Math.abs(betaAngle) > tolerance) {
                const lyNew = [
                    ly[0] * cosBeta + lz[0] * sinBeta,
                    ly[1] * cosBeta + lz[1] * sinBeta,
                    ly[2] * cosBeta + lz[2] * sinBeta
                ];
                const lzNew = [
                    -ly[0] * sinBeta + lz[0] * cosBeta,
                    -ly[1] * sinBeta + lz[1] * cosBeta,
                    -ly[2] * sinBeta + lz[2] * cosBeta
                ];
                ly = lyNew;
                lz = lzNew;
            }

            r = [
                [lx[0], lx[1], lx[2]],
                [ly[0], ly[1], ly[2]],
                [lz[0], lz[1], lz[2]]
            ];
        }

        return math.matrix(r);
    }

    /**
     * Build the 12x12 transformation matrix from the 3x3 rotation matrix
     * Used to transform element vectors from local to global coordinates
     * 
     * Structure: [T] = diag([λ], [λ], [λ], [λ])
     * Where [λ] is the 3x3 rotation matrix
     * 
     * @param rotationMatrix 3x3 rotation matrix
     * @returns 12x12 transformation matrix
     */
    static getTransformationMatrix(rotationMatrix: math.Matrix): math.Matrix {
        // Create 12x12 zero matrix
        const T = math.zeros(12, 12) as math.Matrix;
        const R = rotationMatrix.toArray() as number[][];

        // Place rotation matrix in 4 diagonal blocks (3x3 each)
        for (let block = 0; block < 4; block++) {
            const offset = block * 3;
            for (let i = 0; i < 3; i++) {
                for (let j = 0; j < 3; j++) {
                    T.set([offset + i, offset + j], R[i][j]);
                }
            }
        }

        return T;
    }

    /**
     * Get the 12x12 local stiffness matrix for a 3D frame element
     * 
     * DOF ordering: [u1, v1, w1, θx1, θy1, θz1, u2, v2, w2, θx2, θy2, θz2]
     * where:
     *   u = axial displacement (local x)
     *   v = transverse displacement (local y)
     *   w = transverse displacement (local z)
     *   θx = torsional rotation
     *   θy = bending rotation about y
     *   θz = bending rotation about z
     * 
     * @param E Young's modulus (kN/m² or N/mm²)
     * @param Iy Moment of inertia about local y-axis (m⁴ or mm⁴)
     * @param Iz Moment of inertia about local z-axis (m⁴ or mm⁴)
     * @param A Cross-sectional area (m² or mm²)
     * @param L Member length (m or mm)
     * @param G Shear modulus (optional, defaults to E/2.6 for steel)
     * @param J Torsional constant (optional, defaults to Iy + Iz)
     * @returns 12x12 local stiffness matrix [k]
     */
    static getLocalStiffnessMatrix(
        E: number,
        Iy: number,
        Iz: number,
        A: number,
        L: number,
        G?: number,
        J?: number
    ): math.Matrix {
        // Default shear modulus for steel (G ≈ E/2.6, ν=0.3)
        const shearModulus = G ?? E / 2.6;
        // Default torsional constant — conservative for open sections (I-beams/channels)
        // J = Iy + Iz is ONLY valid for circular sections.
        // For open sections, J ≈ Σbt³/3 which is 100–1000× smaller.
        const torsionalJ = J ?? Math.max(Math.min(Iy, Iz) / 500, (Iy + Iz) * 1e-4);

        // Precompute common terms
        const L2 = L * L;
        const L3 = L * L * L;

        // Axial stiffness
        const EA_L = (E * A) / L;

        // Bending about z-axis (in XY plane)
        const EIz_L = (E * Iz) / L;
        const EIz_L2 = (E * Iz) / L2;
        const EIz_L3 = (E * Iz) / L3;

        // Bending about y-axis (in XZ plane)
        const EIy_L = (E * Iy) / L;
        const EIy_L2 = (E * Iy) / L2;
        const EIy_L3 = (E * Iy) / L3;

        // Torsional stiffness
        const GJ_L = (shearModulus * torsionalJ) / L;

        // Initialize 12x12 zero matrix
        const k = math.zeros(12, 12) as math.Matrix;

        // ---- Axial terms (DOFs 0, 6) ----
        k.set([0, 0], EA_L);
        k.set([0, 6], -EA_L);
        k.set([6, 0], -EA_L);
        k.set([6, 6], EA_L);

        // ---- Torsional terms (DOFs 3, 9) ----
        k.set([3, 3], GJ_L);
        k.set([3, 9], -GJ_L);
        k.set([9, 3], -GJ_L);
        k.set([9, 9], GJ_L);

        // ---- Bending in XY plane (v, θz) - DOFs 1, 5, 7, 11 ----
        k.set([1, 1], 12 * EIz_L3);
        k.set([1, 5], 6 * EIz_L2);
        k.set([1, 7], -12 * EIz_L3);
        k.set([1, 11], 6 * EIz_L2);

        k.set([5, 1], 6 * EIz_L2);
        k.set([5, 5], 4 * EIz_L);
        k.set([5, 7], -6 * EIz_L2);
        k.set([5, 11], 2 * EIz_L);

        k.set([7, 1], -12 * EIz_L3);
        k.set([7, 5], -6 * EIz_L2);
        k.set([7, 7], 12 * EIz_L3);
        k.set([7, 11], -6 * EIz_L2);

        k.set([11, 1], 6 * EIz_L2);
        k.set([11, 5], 2 * EIz_L);
        k.set([11, 7], -6 * EIz_L2);
        k.set([11, 11], 4 * EIz_L);

        // ---- Bending in XZ plane (w, θy) - DOFs 2, 4, 8, 10 ----
        // Note: Sign convention follows standard structural analysis (McGuire, Gallagher, Ziemian)
        // θy positive = clockwise when viewed from +Y axis
        // This matches STAAD.Pro conventions
        k.set([2, 2], 12 * EIy_L3);
        k.set([2, 4], -6 * EIy_L2);    // Negative: +w at start causes -θy
        k.set([2, 8], -12 * EIy_L3);
        k.set([2, 10], -6 * EIy_L2);   // Negative: +w at start causes -θy at end

        k.set([4, 2], -6 * EIy_L2);    // Symmetric
        k.set([4, 4], 4 * EIy_L);
        k.set([4, 8], 6 * EIy_L2);     // Positive: +θy at start causes +w at end
        k.set([4, 10], 2 * EIy_L);

        k.set([8, 2], -12 * EIy_L3);   // Symmetric
        k.set([8, 4], 6 * EIy_L2);     // Symmetric
        k.set([8, 8], 12 * EIy_L3);
        k.set([8, 10], 6 * EIy_L2);    // Positive: +w at end causes +θy at end

        k.set([10, 2], -6 * EIy_L2);   // Symmetric
        k.set([10, 4], 2 * EIy_L);
        k.set([10, 8], 6 * EIy_L2);    // Symmetric
        k.set([10, 10], 4 * EIy_L);

        return k;
    }

    /**
     * Transform local stiffness matrix to global coordinates
     * [K_global] = [T]^T * [k_local] * [T]
     * 
     * @param localK 12x12 local stiffness matrix
     * @param T 12x12 transformation matrix
     * @returns 12x12 global stiffness matrix
     */
    static transformToGlobal(localK: math.Matrix, T: math.Matrix): math.Matrix {
        const TT = math.transpose(T);
        const temp = math.multiply(TT, localK);
        return math.multiply(temp, T) as math.Matrix;
    }

    /**
     * Assemble global stiffness matrix from member contributions
     * 
     * @param globalK Global stiffness matrix (will be modified)
     * @param memberK Member global stiffness matrix (12x12)
     * @param startNodeDOFs Array of 6 global DOF indices for start node
     * @param endNodeDOFs Array of 6 global DOF indices for end node
     */
    static assembleToGlobal(
        globalK: math.Matrix,
        memberK: math.Matrix,
        startNodeDOFs: number[],
        endNodeDOFs: number[]
    ): void {
        const dofs = [...startNodeDOFs, ...endNodeDOFs];
        const memberKArray = memberK.toArray() as number[][];

        for (let i = 0; i < 12; i++) {
            for (let j = 0; j < 12; j++) {
                const gi = dofs[i];
                const gj = dofs[j];
                const currentVal = globalK.get([gi, gj]) as number;
                globalK.set([gi, gj], currentVal + memberKArray[i][j]);
            }
        }
    }

    /**
     * Create a zero matrix of given size
     */
    static zeros(rows: number, cols: number): math.Matrix {
        return math.zeros(rows, cols) as math.Matrix;
    }

    /**
     * Create an identity matrix
     */
    static identity(size: number): math.Matrix {
        return math.identity(size) as math.Matrix;
    }

    /**
     * Solve linear system Ax = b
     */
    static solve(A: math.Matrix, b: math.Matrix): math.Matrix {
        return math.lusolve(A, b) as math.Matrix;
    }

    /**
     * Matrix multiplication
     */
    static multiply(A: math.Matrix, B: math.Matrix): math.Matrix {
        return math.multiply(A, B) as math.Matrix;
    }

    /**
     * Matrix transpose
     */
    static transpose(A: math.Matrix): math.Matrix {
        return math.transpose(A);
    }
}

export default MatrixUtils;
