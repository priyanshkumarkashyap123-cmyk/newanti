/**
 * LoadConversion - Convert Member Loads to Equivalent Nodal Loads
 * 
 * Converts distributed member loads (UDL, triangular, trapezoidal) into
 * equivalent concentrated nodal forces and moments using Fixed-End Moment theory.
 * 
 * Reference: Structural Analysis by Hibbeler, Chapter 11
 * Reference: Matrix Structural Analysis by McGuire, Gallagher & Ziemian
 * Reference: Roark's Formulas for Stress and Strain
 * 
 * IMPORTANT: All FEM calculations follow standard sign conventions:
 * - Positive moment: counterclockwise (right-hand rule)
 * - Loads applied in negative direction (e.g., gravity = -Y)
 * - For a UDL w applied downward on a fixed-fixed beam:
 *   - Reaction at each end: R = wL/2 (upward, positive)
 *   - FEM at start: M = -wL²/12 (resisting moment)
 *   - FEM at end: M = +wL²/12 (resisting moment)
 * 
 * @version 2.0.0
 * @author BeamLab Engineering
 */

// ============================================
// DEBUG CONFIGURATION
// ============================================

const DEBUG = {
    enabled: false,
    logConversions: false,
    logMoments: false,
};

export function setLoadConversionDebug(options: Partial<typeof DEBUG>) {
    Object.assign(DEBUG, options);
}

// ============================================
// NUMERICAL TOLERANCES
// ============================================

const EPSILON = 1e-10;       // Near-zero check
const LENGTH_TOL = 1e-6;     // Minimum member length (meters)
const LOAD_TOL = 1e-9;       // Minimum load value to consider

export interface MemberLoad {
    id: string;
    memberId: string;
    type: 'UDL' | 'UVL' | 'triangular' | 'trapezoidal' | 'point' | 'moment';
    w1: number;  // Load intensity at start (kN/m) - NEGATIVE for downward
    w2?: number; // Load intensity at end (for triangular/trapezoidal)
    direction: string; // 'global_y', 'global_x', 'global_z', 'local_y', etc.
    startPos?: number;  // Position along member (0-1 ratio)
    endPos?: number;    // Position along member (0-1 ratio)
    loadCase?: string;  // Optional load case identifier
}

export interface NodalLoad {
    nodeId: string;
    fx?: number;
    fy?: number;
    fz?: number;
    mx?: number;
    my?: number;
    mz?: number;
    loadCase?: string;
}

export interface Member {
    id: string;
    startNodeId: string;
    endNodeId: string;
    length?: number;
    section?: string;
    material?: string;
}

export interface Node {
    id: string;
    x: number;
    y: number;
    z: number;
}

// ============================================
// RESULT TYPES
// ============================================

export interface LoadConversionResult {
    nodalLoads: NodalLoad[];
    summary: {
        totalMemberLoads: number;
        convertedLoads: number;
        skippedLoads: number;
        totalNodalLoads: number;
        totalForceX: number;
        totalForceY: number;
        totalForceZ: number;
    };
    errors: string[];
    warnings: string[];
}

/**
 * Calculate member length from nodes with validation
 */
function calculateMemberLength(startNode: Node, endNode: Node): number {
    const dx = endNode.x - startNode.x;
    const dy = endNode.y - startNode.y;
    const dz = endNode.z - startNode.z;
    const length = Math.sqrt(dx * dx + dy * dy + dz * dz);
    
    if (!isFinite(length) || isNaN(length)) {
        console.error('[LoadConversion] Invalid member length calculated');
        return 0;
    }
    
    return length;
}

/**
 * Validate load values - check for NaN/Infinity
 */
function validateLoad(value: number, name: string): number {
    if (!isFinite(value) || isNaN(value)) {
        if (DEBUG.logConversions) {
            console.warn(`[LoadConversion] Invalid ${name}: ${value}, using 0`);
        }
        return 0;
    }
    return value;
}

/**
 * Get direction cosines for member local to global transformation
 */
function getMemberDirection(startNode: Node, endNode: Node): { lx: number; ly: number; lz: number } {
    const L = calculateMemberLength(startNode, endNode);
    if (L < LENGTH_TOL) return { lx: 1, ly: 0, lz: 0 };
    
    return {
        lx: (endNode.x - startNode.x) / L,
        ly: (endNode.y - startNode.y) / L,
        lz: (endNode.z - startNode.z) / L
    };
}

/**
 * Build full 3x3 rotation matrix for member local-to-global transformation
 * 
 * Local coordinate system:
 * - x-axis: along member from start to end
 * - y-axis: perpendicular to member in vertical plane (principal bending axis)
 * - z-axis: perpendicular to both (minor bending axis)
 * 
 * Returns transformation matrix T where:
 * {F_global} = [T] * {F_local}
 */
function getMemberRotationMatrix(startNode: Node, endNode: Node): number[][] {
    const L = calculateMemberLength(startNode, endNode);
    if (L < LENGTH_TOL) {
        // Identity matrix for zero-length members
        return [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
    }
    
    // Local x-axis (along member)
    const lx = (endNode.x - startNode.x) / L;
    const ly = (endNode.y - startNode.y) / L;
    const lz = (endNode.z - startNode.z) / L;
    
    // Determine local y-axis (perpendicular in vertical plane)
    let mx: number, my: number, mz: number;
    
    if (Math.abs(lx) < 0.001 && Math.abs(lz) < 0.001) {
        // Member is vertical (along global Y)
        // Use global Z as reference
        mx = -ly; // Cross product of (0,ly,0) with (0,0,1)
        my = 0;
        mz = 0;
        const mag = Math.abs(mx);
        if (mag > EPSILON) {
            mx /= mag;
        } else {
            mx = 1;
        }
    } else {
        // Member is not vertical
        // Cross product of member direction with global Y (0,1,0)
        // to get local z-axis, then cross again to get local y
        const zx = ly * 0 - lz * 1; // = -lz
        const zy = lz * 0 - lx * 0; // = 0
        const zz = lx * 1 - ly * 0; // = lx
        const zMag = Math.sqrt(zx * zx + zy * zy + zz * zz);
        
        if (zMag < EPSILON) {
            mx = 0; my = 1; mz = 0;
        } else {
            const nzx = zx / zMag;
            const nzy = zy / zMag;
            const nzz = zz / zMag;
            
            // Local y = local z × local x
            mx = nzy * lz - nzz * ly;
            my = nzz * lx - nzx * lz;
            mz = nzx * ly - nzy * lx;
        }
    }
    
    // Normalize local y-axis
    const mMag = Math.sqrt(mx * mx + my * my + mz * mz);
    if (mMag > EPSILON) {
        mx /= mMag;
        my /= mMag;
        mz /= mMag;
    } else {
        mx = 0; my = 1; mz = 0;
    }
    
    // Local z-axis = local x × local y
    const nx = ly * mz - lz * my;
    const ny = lz * mx - lx * mz;
    const nz = lx * my - ly * mx;
    
    // Rotation matrix [T]: each row is a local axis in global coordinates
    // Row 0: local x in global
    // Row 1: local y in global
    // Row 2: local z in global
    return [
        [lx, ly, lz],   // local x
        [mx, my, mz],   // local y
        [nx, ny, nz]    // local z
    ];
}

/**
 * Transform local load to global coordinates
 */
function transformLocalToGlobal(
    fx: number, fy: number, fz: number,
    mx: number, my: number, mz: number,
    T: number[][]
): { gfx: number; gfy: number; gfz: number; gmx: number; gmy: number; gmz: number } {
    // Forces: F_global = T^T * F_local (transpose because T is local-to-global)
    // Since each row of T is local axis in global coords:
    // gfx = T[0][0]*fx + T[1][0]*fy + T[2][0]*fz
    const gfx = T[0][0] * fx + T[1][0] * fy + T[2][0] * fz;
    const gfy = T[0][1] * fx + T[1][1] * fy + T[2][1] * fz;
    const gfz = T[0][2] * fx + T[1][2] * fy + T[2][2] * fz;
    
    // Moments transform the same way
    const gmx = T[0][0] * mx + T[1][0] * my + T[2][0] * mz;
    const gmy = T[0][1] * mx + T[1][1] * my + T[2][1] * mz;
    const gmz = T[0][2] * mx + T[1][2] * my + T[2][2] * mz;
    
    return { gfx, gfy, gfz, gmx, gmy, gmz };
}

/**
 * Get perpendicular direction for local coordinate transformation
 * Uses the global Y-up convention with Z as secondary
 */
function getPerpendicularDirection(
    startNode: Node, 
    endNode: Node
): { px: number; py: number; pz: number } {
    const dir = getMemberDirection(startNode, endNode);
    
    // If member is vertical (along Y), use Z as perpendicular
    if (Math.abs(dir.ly) > 0.99) {
        return { px: 0, py: 0, pz: 1 };
    }
    
    // Cross product with global Y to get perpendicular in XZ plane
    // Then cross again to get perpendicular in the beam plane
    const crossX = dir.lz;
    const crossZ = -dir.lx;
    const mag = Math.sqrt(crossX * crossX + crossZ * crossZ);
    
    if (mag < EPSILON) {
        return { px: 0, py: 1, pz: 0 };
    }
    
    return {
        px: crossX / mag,
        py: 0,
        pz: crossZ / mag
    };
}

/**
 * Apply nodal loads based on direction with proper 3D transformation
 * Supports both global and local coordinate systems
 */
function applyDirectionalLoads(
    nodeId: string,
    reaction: number,
    moment: number,
    direction: string,
    startNode?: Node,
    endNode?: Node
): NodalLoad {
    const dir = direction.toLowerCase();
    const isLocal = dir.includes('local');
    const isY = dir.includes('y');
    const isX = dir.includes('x');
    const isZ = dir.includes('z');
    
    const load: NodalLoad = { nodeId };
    
    if (isLocal && startNode && endNode) {
        // ========================================
        // LOCAL COORDINATE SYSTEM
        // ========================================
        // Get rotation matrix for this member
        const T = getMemberRotationMatrix(startNode, endNode);
        
        // In local coordinates:
        // - Local Y is the loading direction (perpendicular to member)
        // - Moment is about local Z axis
        let localFx = 0, localFy = 0, localFz = 0;
        let localMx = 0, localMy = 0, localMz = 0;
        
        if (isY) {
            localFy = reaction;
            localMz = moment;
        } else if (isX) {
            localFx = reaction;
            localMy = moment;
        } else if (isZ) {
            localFz = reaction;
            localMx = moment;
        } else {
            // Default to local Y
            localFy = reaction;
            localMz = moment;
        }
        
        // Transform to global coordinates
        const global = transformLocalToGlobal(
            localFx, localFy, localFz,
            localMx, localMy, localMz,
            T
        );
        
        load.fx = validateLoad(global.gfx, 'fx');
        load.fy = validateLoad(global.gfy, 'fy');
        load.fz = validateLoad(global.gfz, 'fz');
        load.mx = validateLoad(global.gmx, 'mx');
        load.my = validateLoad(global.gmy, 'my');
        load.mz = validateLoad(global.gmz, 'mz');
        
        // Clean up near-zero values
        if (Math.abs(load.fx || 0) < LOAD_TOL) delete load.fx;
        if (Math.abs(load.fy || 0) < LOAD_TOL) delete load.fy;
        if (Math.abs(load.fz || 0) < LOAD_TOL) delete load.fz;
        if (Math.abs(load.mx || 0) < LOAD_TOL) delete load.mx;
        if (Math.abs(load.my || 0) < LOAD_TOL) delete load.my;
        if (Math.abs(load.mz || 0) < LOAD_TOL) delete load.mz;
        
    } else {
        // ========================================
        // GLOBAL COORDINATE SYSTEM
        // ========================================
        // Apply force in the correct direction
        if (isX) {
            load.fx = validateLoad(reaction, 'fx');
            // Moment about Z for X-direction loads (in XY plane)
            load.mz = validateLoad(moment, 'mz');
        } else if (isZ) {
            load.fz = validateLoad(reaction, 'fz');
            // Moment about Y for Z-direction loads (bending in XZ plane)
            load.my = validateLoad(-moment, 'my');
        } else {
            // Default: Y direction (gravity)
            load.fy = validateLoad(reaction, 'fy');
            // Moment about Z for Y-direction loads (in XY plane)
            load.mz = validateLoad(moment, 'mz');
        }
    }
    
    return load;
}

/**
 * Convert a single UDL to equivalent nodal loads.
 *
 * Returns EQUIVALENT NODAL LOADS (same direction as the applied load),
 * NOT fixed-end reactions (which would be opposite).
 *
 * For a uniformly distributed load w (kN/m, sign included) over length L:
 *   F1 = wL/2,   M1 = wL²/12
 *   F2 = wL/2,   M2 = -wL²/12
 *
 * For partial UDL from position 'a' to 'b':
 *   Uses exact Hermite shape-function integration.
 *
 * Reference: Przemieniecki, "Theory of Matrix Structural Analysis", Ch. 5
 */
function convertUDL(
    memberLoad: MemberLoad,
    member: Member,
    startNode: Node,
    endNode: Node
): NodalLoad[] {
    const L = calculateMemberLength(startNode, endNode);
    if (L < LENGTH_TOL) return [];

    const w = memberLoad.w1; // kN/m — negative for gravity (downward)
    if (Math.abs(w) < LOAD_TOL) return [];

    // Load span (default full length)
    const startRatio = Math.max(0, Math.min(1, memberLoad.startPos ?? 0));
    const endRatio   = Math.max(0, Math.min(1, memberLoad.endPos ?? 1));
    const a = startRatio * L;
    const b = endRatio * L;
    const loadSpan = b - a;
    if (loadSpan <= LENGTH_TOL) return [];

    let R1: number, R2: number, M1: number, M2: number;

    if (Math.abs(a) < LENGTH_TOL && Math.abs(b - L) < LENGTH_TOL) {
        // ========================================
        // FULL SPAN UDL — Standard formulas
        // ========================================
        // Equivalent nodal loads (same direction as load):
        R1 = w * L / 2;
        R2 = w * L / 2;
        M1 = w * L * L / 12;
        M2 = -w * L * L / 12;
    } else {
        // ========================================
        // PARTIAL SPAN UDL — Hermite shape-function integration
        // ========================================
        // F1 = w·∫[a,b] N1(x) dx,  M1 = w·∫[a,b] N2(x) dx
        // F2 = w·∫[a,b] N3(x) dx,  M2 = w·∫[a,b] N4(x) dx
        //
        // N1(x) = 1 - 3ξ² + 2ξ³       (ξ = x/L)
        // N2(x) = x(1 - ξ)²
        // N3(x) = 3ξ² - 2ξ³
        // N4(x) = (x²/L)(ξ - 1)
        const L2 = L * L;
        const L3 = L2 * L;

        const da  = b - a;
        const db2 = b * b - a * a;
        const db3 = b * b * b - a * a * a;
        const db4 = b * b * b * b - a * a * a * a;

        // ∫[a,b] N1 dx = (b-a) - 3(b³-a³)/(3L²) + 2(b⁴-a⁴)/(4L³)
        //              = da - db3/L² + db4/(2L³)
        const intN1 = da - db3 / L2 + db4 / (2 * L3);

        // ∫[a,b] N2 dx = ∫ x(1 - x/L)² dx = db2/2 - 2·db3/(3L) + db4/(4L²)
        const intN2 = db2 / 2 - 2 * db3 / (3 * L) + db4 / (4 * L2);

        // ∫[a,b] N3 dx = 3·db3/(3L²) - 2·db4/(4L³) = db3/L² - db4/(2L³)
        const intN3 = db3 / L2 - db4 / (2 * L3);

        // ∫[a,b] N4 dx = ∫ (x²/L)(x/L - 1) dx = db4/(4L²) - db3/(3L)
        const intN4 = db4 / (4 * L2) - db3 / (3 * L);

        R1 = w * intN1;
        M1 = w * intN2;
        R2 = w * intN3;
        M2 = w * intN4;
    }

    if (DEBUG.logMoments) {
        console.log(`[UDL] w=${w}, L=${L}, a=${a}, b=${b}, R1=${R1}, R2=${R2}, M1=${M1}, M2=${M2}`);
    }

    R1 = validateLoad(R1, 'R1');
    R2 = validateLoad(R2, 'R2');
    M1 = validateLoad(M1, 'M1');
    M2 = validateLoad(M2, 'M2');

    return [
        applyDirectionalLoads(member.startNodeId, R1, M1, memberLoad.direction, startNode, endNode),
        applyDirectionalLoads(member.endNodeId, R2, M2, memberLoad.direction, startNode, endNode)
    ];
}

/**
 * Convert a triangular/trapezoidal load to equivalent nodal loads.
 *
 * Decomposition: w(x) = w1 (uniform) + (w2-w1)·x/L (ascending triangle).
 * Equivalent nodal loads (same direction as applied load):
 *
 * Full-span ascending triangle (0 → wT):
 *   F1 = 3·wT·L/20,  M1 = wT·L²/30
 *   F2 = 7·wT·L/20,  M2 = -wT·L²/20
 *
 * Superposition: uniform part + triangle part.
 *
 * Reference: Przemieniecki, "Theory of Matrix Structural Analysis", Ch. 5
 * Reference: Roark's Formulas, Table 8.1
 */
function convertTriangular(
    memberLoad: MemberLoad,
    member: Member,
    startNode: Node,
    endNode: Node
): NodalLoad[] {
    const L = calculateMemberLength(startNode, endNode);
    if (L < LENGTH_TOL) return [];

    const w1 = memberLoad.w1;
    const w2 = memberLoad.w2 ?? memberLoad.w1;

    if (Math.abs(w1) < LOAD_TOL && Math.abs(w2) < LOAD_TOL) return [];

    // If uniform, delegate
    if (Math.abs(w1 - w2) < LOAD_TOL) {
        return convertUDL(memberLoad, member, startNode, endNode);
    }

    let R1: number, R2: number, M1: number, M2: number;

    // Decompose: w(x) = wU (uniform) + wT·x/L (ascending triangle from 0 to wT)
    const wU = w1;
    const wT = w2 - w1;

    // ---- Uniform part: F1=wU·L/2, M1=wU·L²/12, F2=wU·L/2, M2=-wU·L²/12 ----
    let R1_u = 0, R2_u = 0, M1_u = 0, M2_u = 0;
    if (Math.abs(wU) > LOAD_TOL) {
        R1_u = wU * L / 2;
        R2_u = wU * L / 2;
        M1_u = wU * L * L / 12;
        M2_u = -wU * L * L / 12;
    }

    // ---- Triangle part: ascending from 0 to wT ----
    // F1 = 3·wT·L/20,  M1 = wT·L²/30
    // F2 = 7·wT·L/20,  M2 = -wT·L²/20
    let R1_t = 0, R2_t = 0, M1_t = 0, M2_t = 0;
    if (Math.abs(wT) > LOAD_TOL) {
        R1_t = 3 * wT * L / 20;
        R2_t = 7 * wT * L / 20;
        M1_t = wT * L * L / 30;
        M2_t = -wT * L * L / 20;
    }

    R1 = R1_u + R1_t;
    R2 = R2_u + R2_t;
    M1 = M1_u + M1_t;
    M2 = M2_u + M2_t;

    if (DEBUG.logMoments) {
        console.log(`[Triangular] w1=${w1}, w2=${w2}, R1=${R1}, R2=${R2}, M1=${M1}, M2=${M2}`);
    }

    R1 = validateLoad(R1, 'R1');
    R2 = validateLoad(R2, 'R2');
    M1 = validateLoad(M1, 'M1');
    M2 = validateLoad(M2, 'M2');

    return [
        applyDirectionalLoads(member.startNodeId, R1, M1, memberLoad.direction, startNode, endNode),
        applyDirectionalLoads(member.endNodeId, R2, M2, memberLoad.direction, startNode, endNode)
    ];
}

/**
 * Convert a point load on a member to equivalent nodal loads.
 *
 * Equivalent nodal loads for P at distance 'a' from start (b = L-a):
 *   F1 = P·b²·(3a+b) / L³,   M1 = P·a·b² / L²
 *   F2 = P·a²·(a+3b) / L³,   M2 = -P·a²·b / L²
 *
 * Reference: Przemieniecki Ch. 5, Hibbeler Table 12-1
 */
function convertPointLoad(
    memberLoad: MemberLoad,
    member: Member,
    startNode: Node,
    endNode: Node
): NodalLoad[] {
    const L = calculateMemberLength(startNode, endNode);
    if (L < LENGTH_TOL) return [];

    const P = memberLoad.w1; // kN (sign included)
    if (Math.abs(P) < LOAD_TOL) return [];

    const pos = Math.max(0, Math.min(1, memberLoad.startPos ?? 0.5));
    const a = pos * L;
    const b = L - a;
    if (a < 0 || b < 0) return [];

    const L2 = L * L;
    const L3 = L2 * L;

    // Equivalent nodal loads (same direction as P)
    let R1 = P * b * b * (3 * a + b) / L3;
    let R2 = P * a * a * (a + 3 * b) / L3;
    let M1 = P * a * b * b / L2;
    let M2 = -P * a * a * b / L2;

    R1 = validateLoad(R1, 'R1');
    R2 = validateLoad(R2, 'R2');
    M1 = validateLoad(M1, 'M1');
    M2 = validateLoad(M2, 'M2');

    if (DEBUG.logMoments) {
        console.log(`[Point] P=${P}, a=${a}, b=${b}, R1=${R1}, R2=${R2}, M1=${M1}, M2=${M2}`);
    }

    return [
        applyDirectionalLoads(member.startNodeId, R1, M1, memberLoad.direction, startNode, endNode),
        applyDirectionalLoads(member.endNodeId, R2, M2, memberLoad.direction, startNode, endNode)
    ];
}

/**
 * Convert a concentrated moment on a member to equivalent nodal loads.
 *
 * Derived from Hermite shape function derivatives at position x=a:
 *   F1 = M₀·N₁'(a) = -6·M₀·a·b / L³
 *   M1 = M₀·N₂'(a) =  M₀·b·(b-2a) / L²
 *   F2 = M₀·N₃'(a) =  6·M₀·a·b / L³
 *   M2 = M₀·N₄'(a) =  M₀·a·(a-2b) / L²
 *
 * Note: Unlike force loads (UDL, point), concentrated moments do NOT need
 * a sign flip between "reactions" and "equivalent nodal loads" — the Hermite
 * derivatives give the correct ENLs directly.
 *
 * Reference: Przemieniecki Ch. 5, Roark's Table 8.1
 */
function convertMomentLoad(
    memberLoad: MemberLoad,
    member: Member,
    startNode: Node,
    endNode: Node
): NodalLoad[] {
    const L = calculateMemberLength(startNode, endNode);
    if (L < LENGTH_TOL) return [];

    const M0 = memberLoad.w1; // kN·m (sign included)
    if (Math.abs(M0) < LOAD_TOL) return [];

    const pos = Math.max(0, Math.min(1, memberLoad.startPos ?? 0.5));
    const a = pos * L;
    const b = L - a;
    const L2 = L * L;
    const L3 = L2 * L;

    // Equivalent nodal loads (Hermite N' derivatives)
    let R1 = -6 * M0 * a * b / L3;
    let R2 = 6 * M0 * a * b / L3;
    let M1 = M0 * b * (b - 2 * a) / L2;
    let M2 = M0 * a * (a - 2 * b) / L2;

    R1 = validateLoad(R1, 'R1');
    R2 = validateLoad(R2, 'R2');
    M1 = validateLoad(M1, 'M1');
    M2 = validateLoad(M2, 'M2');

    if (DEBUG.logMoments) {
        console.log(`[Moment] M0=${M0}, a=${a}, R1=${R1}, R2=${R2}, M1=${M1}, M2=${M2}`);
    }

    return [
        applyDirectionalLoads(member.startNodeId, R1, M1, memberLoad.direction, startNode, endNode),
        applyDirectionalLoads(member.endNodeId, R2, M2, memberLoad.direction, startNode, endNode)
    ];
}

/**
 * Convert all member loads to equivalent nodal loads
 * 
 * @param memberLoads - Array of distributed member loads
 * @param members - Array of members
 * @param nodes - Array of nodes
 * @returns LoadConversionResult with nodal loads, summary, and any errors
 */
export function convertMemberLoadsToNodal(
    memberLoads: MemberLoad[],
    members: Member[],
    nodes: Node[]
): LoadConversionResult {
    const nodalLoads: NodalLoad[] = [];
    const errors: string[] = [];
    const warnings: string[] = [];

    // Create lookup maps for O(1) access
    const nodeMap = new Map<string, Node>();
    nodes.forEach(n => nodeMap.set(n.id, n));

    const memberMap = new Map<string, Member>();
    members.forEach(m => memberMap.set(m.id, m));

    let convertedCount = 0;
    let skippedCount = 0;

    // Convert each member load
    for (const memberLoad of memberLoads) {
        try {
            const member = memberMap.get(memberLoad.memberId);
            if (!member) {
                warnings.push(`Member ${memberLoad.memberId} not found for load ${memberLoad.id}`);
                skippedCount++;
                continue;
            }

            const startNode = nodeMap.get(member.startNodeId);
            const endNode = nodeMap.get(member.endNodeId);

            if (!startNode || !endNode) {
                warnings.push(`Nodes not found for member ${member.id}`);
                skippedCount++;
                continue;
            }

            let equivalentLoads: NodalLoad[] = [];
            const loadType = memberLoad.type.toUpperCase();

            switch (loadType) {
                case 'UDL':
                    equivalentLoads = convertUDL(memberLoad, member, startNode, endNode);
                    break;
                case 'UVL':
                case 'TRIANGULAR':
                case 'TRAPEZOIDAL':
                    equivalentLoads = convertTriangular(memberLoad, member, startNode, endNode);
                    break;
                case 'POINT':
                    equivalentLoads = convertPointLoad(memberLoad, member, startNode, endNode);
                    break;
                case 'MOMENT':
                    equivalentLoads = convertMomentLoad(memberLoad, member, startNode, endNode);
                    break;
                default:
                    warnings.push(`Unknown load type: ${memberLoad.type} on load ${memberLoad.id}, treating as UDL`);
                    equivalentLoads = convertUDL(memberLoad, member, startNode, endNode);
            }

            if (equivalentLoads.length > 0) {
                // Add load case if present
                if (memberLoad.loadCase) {
                    equivalentLoads.forEach(l => l.loadCase = memberLoad.loadCase);
                }
                nodalLoads.push(...equivalentLoads);
                convertedCount++;
            }
        } catch (error) {
            const msg = error instanceof Error ? error.message : String(error);
            errors.push(`Error converting load ${memberLoad.id}: ${msg}`);
            skippedCount++;
        }
    }

    // Calculate summary statistics
    let totalForceX = 0, totalForceY = 0, totalForceZ = 0;
    for (const load of nodalLoads) {
        totalForceX += load.fx || 0;
        totalForceY += load.fy || 0;
        totalForceZ += load.fz || 0;
    }

    const summary = {
        totalMemberLoads: memberLoads.length,
        convertedLoads: convertedCount,
        skippedLoads: skippedCount,
        totalNodalLoads: nodalLoads.length,
        totalForceX: Math.round(totalForceX * 1000) / 1000,
        totalForceY: Math.round(totalForceY * 1000) / 1000,
        totalForceZ: Math.round(totalForceZ * 1000) / 1000,
    };

    if (DEBUG.logConversions) {
        console.log(`[LoadConversion] Summary:`, summary);
        if (warnings.length > 0) console.warn('[LoadConversion] Warnings:', warnings);
        if (errors.length > 0) console.error('[LoadConversion] Errors:', errors);
    }

    return { nodalLoads, summary, errors, warnings };
}

/**
 * Legacy function for backward compatibility
 * @deprecated Use convertMemberLoadsToNodal which returns full result object
 */
export function convertMemberLoadsToNodalLegacy(
    memberLoads: MemberLoad[],
    members: Member[],
    nodes: Node[]
): NodalLoad[] {
    const result = convertMemberLoadsToNodal(memberLoads, members, nodes);
    return result.nodalLoads;
}

/**
 * Merge nodal loads (combine loads on the same node)
 * Rounds values to avoid floating point precision issues
 */
export function mergeNodalLoads(loads: NodalLoad[]): NodalLoad[] {
    const merged = new Map<string, NodalLoad>();

    for (const load of loads) {
        const existing = merged.get(load.nodeId);

        if (existing) {
            // Add loads with validation
            existing.fx = validateLoad((existing.fx || 0) + (load.fx || 0), 'fx');
            existing.fy = validateLoad((existing.fy || 0) + (load.fy || 0), 'fy');
            existing.fz = validateLoad((existing.fz || 0) + (load.fz || 0), 'fz');
            existing.mx = validateLoad((existing.mx || 0) + (load.mx || 0), 'mx');
            existing.my = validateLoad((existing.my || 0) + (load.my || 0), 'my');
            existing.mz = validateLoad((existing.mz || 0) + (load.mz || 0), 'mz');
        } else {
            merged.set(load.nodeId, { ...load });
        }
    }

    // Clean up near-zero values
    const result: NodalLoad[] = [];
    for (const load of merged.values()) {
        const cleaned: NodalLoad = { nodeId: load.nodeId };
        
        if (Math.abs(load.fx || 0) > LOAD_TOL) cleaned.fx = load.fx;
        if (Math.abs(load.fy || 0) > LOAD_TOL) cleaned.fy = load.fy;
        if (Math.abs(load.fz || 0) > LOAD_TOL) cleaned.fz = load.fz;
        if (Math.abs(load.mx || 0) > LOAD_TOL) cleaned.mx = load.mx;
        if (Math.abs(load.my || 0) > LOAD_TOL) cleaned.my = load.my;
        if (Math.abs(load.mz || 0) > LOAD_TOL) cleaned.mz = load.mz;
        if (load.loadCase) cleaned.loadCase = load.loadCase;
        
        result.push(cleaned);
    }

    return result;
}

/**
 * Verify equilibrium of load conversion
 * 
 * For Fixed-End Reactions, the sum of reactions must equal the applied load:
 * - ΣFy = Total Applied Load (for vertical loads)
 * - ΣMz at any point should satisfy moment equilibrium
 * 
 * This verifies that the FEM formulas are correctly implemented.
 */
export function verifyEquilibrium(
    loads: NodalLoad[],
    originalMemberLoads?: MemberLoad[],
    members?: Member[],
    nodes?: Node[]
): {
    sumFx: number;
    sumFy: number;
    sumFz: number;
    sumMx: number;
    sumMy: number;
    sumMz: number;
    expectedFy: number;
    forceError: number;
    isBalanced: boolean;
    message: string;
} {
    let sumFx = 0, sumFy = 0, sumFz = 0;
    let sumMx = 0, sumMy = 0, sumMz = 0;
    
    for (const load of loads) {
        sumFx += load.fx || 0;
        sumFy += load.fy || 0;
        sumFz += load.fz || 0;
        sumMx += load.mx || 0;
        sumMy += load.my || 0;
        sumMz += load.mz || 0;
    }
    
    // Calculate expected total load from original member loads
    let expectedFy = 0;
    
    if (originalMemberLoads && members && nodes) {
        const memberMap = new Map(members.map(m => [m.id, m]));
        const nodeMap = new Map(nodes.map(n => [n.id, n]));
        
        for (const ml of originalMemberLoads) {
            const member = memberMap.get(ml.memberId);
            if (!member) continue;
            
            const startNode = nodeMap.get(member.startNodeId);
            const endNode = nodeMap.get(member.endNodeId);
            if (!startNode || !endNode) continue;
            
            const L = calculateMemberLength(startNode, endNode);
            if (L < LENGTH_TOL) continue;
            
            const w1 = ml.w1;
            const w2 = ml.w2 ?? w1;
            
            // Calculate total load based on type
            switch (ml.type.toUpperCase()) {
                case 'UDL':
                    // Total load = w × L
                    expectedFy += w1 * L;
                    break;
                case 'TRIANGULAR':
                case 'UVL':
                    // Total load = (w1 + w2) × L / 2
                    expectedFy += (w1 + w2) * L / 2;
                    break;
                case 'TRAPEZOIDAL':
                    expectedFy += (w1 + w2) * L / 2;
                    break;
                case 'POINT':
                    expectedFy += w1;
                    break;
            }
        }
    }
    
    // The sum of reactions should equal the negative of the applied load
    // (reactions oppose the applied load)
    const forceError = Math.abs(sumFy + expectedFy);
    const forceTol = Math.abs(expectedFy) * 0.001 + 1e-6; // 0.1% tolerance
    const isBalanced = forceError < forceTol;
    
    let message: string;
    if (isBalanced) {
        message = `✓ Equilibrium verified: ΣFy = ${sumFy.toFixed(4)} kN (expected ${(-expectedFy).toFixed(4)} kN)`;
    } else {
        message = `⚠ Equilibrium error: ΣFy = ${sumFy.toFixed(4)} kN but expected ${(-expectedFy).toFixed(4)} kN (error: ${forceError.toFixed(6)} kN)`;
    }
    
    return {
        sumFx: Math.round(sumFx * 1e6) / 1e6,
        sumFy: Math.round(sumFy * 1e6) / 1e6,
        sumFz: Math.round(sumFz * 1e6) / 1e6,
        sumMx: Math.round(sumMx * 1e6) / 1e6,
        sumMy: Math.round(sumMy * 1e6) / 1e6,
        sumMz: Math.round(sumMz * 1e6) / 1e6,
        expectedFy: Math.round(expectedFy * 1e6) / 1e6,
        forceError: Math.round(forceError * 1e6) / 1e6,
        isBalanced,
        message
    };
}

/**
 * Format nodal load for display
 */
export function formatNodalLoad(load: NodalLoad): string {
    const parts: string[] = [`Node ${load.nodeId}:`];
    
    if (load.fx) parts.push(`Fx=${load.fx.toFixed(3)} kN`);
    if (load.fy) parts.push(`Fy=${load.fy.toFixed(3)} kN`);
    if (load.fz) parts.push(`Fz=${load.fz.toFixed(3)} kN`);
    if (load.mx) parts.push(`Mx=${load.mx.toFixed(3)} kN·m`);
    if (load.my) parts.push(`My=${load.my.toFixed(3)} kN·m`);
    if (load.mz) parts.push(`Mz=${load.mz.toFixed(3)} kN·m`);
    
    return parts.join(' ');
}
