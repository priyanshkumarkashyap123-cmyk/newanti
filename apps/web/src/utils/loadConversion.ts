/**
 * LoadConversion - Convert Member Loads to Equivalent Nodal Loads
 * 
 * Converts distributed member loads (UDL, triangular, trapezoidal) into
 * equivalent concentrated nodal forces and moments using Fixed-End Moment theory.
 * 
 * Reference: Structural Analysis by Hibbeler, Chapter 11
 * Reference: Matrix Structural Analysis by McGuire, Gallagher & Ziemian
 * 
 * IMPORTANT: All FEM calculations follow standard sign conventions:
 * - Positive moment: counterclockwise (right-hand rule)
 * - Loads applied in negative direction (e.g., gravity = -Y)
 * - For a UDL w applied downward on a fixed-fixed beam:
 *   - Reaction at each end: R = wL/2 (upward, positive)
 *   - FEM at start: M = -wL²/12 (resisting moment)
 *   - FEM at end: M = +wL²/12 (resisting moment)
 */

export interface MemberLoad {
    id: string;
    memberId: string;
    type: 'UDL' | 'UVL' | 'triangular' | 'trapezoidal' | 'point';
    w1: number;  // Load intensity at start (kN/m) - NEGATIVE for downward
    w2?: number; // Load intensity at end (for triangular/trapezoidal)
    direction: string; // 'global_y', 'global_x', 'global_z', 'local_y', etc.
    startPos?: number;  // Position along member (0-1 ratio)
    endPos?: number;    // Position along member (0-1 ratio)
}

export interface NodalLoad {
    nodeId: string;
    fx?: number;
    fy?: number;
    fz?: number;
    mx?: number;
    my?: number;
    mz?: number;
}

export interface Member {
    id: string;
    startNodeId: string;
    endNodeId: string;
    length?: number;
}

export interface Node {
    id: string;
    x: number;
    y: number;
    z: number;
}

/**
 * Calculate member length from nodes
 */
function calculateMemberLength(startNode: Node, endNode: Node): number {
    const dx = endNode.x - startNode.x;
    const dy = endNode.y - startNode.y;
    const dz = endNode.z - startNode.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

/**
 * Get direction cosines for member local to global transformation
 */
function getMemberDirection(startNode: Node, endNode: Node): { lx: number; ly: number; lz: number } {
    const L = calculateMemberLength(startNode, endNode);
    if (L < 1e-10) return { lx: 1, ly: 0, lz: 0 };
    
    return {
        lx: (endNode.x - startNode.x) / L,
        ly: (endNode.y - startNode.y) / L,
        lz: (endNode.z - startNode.z) / L
    };
}

/**
 * Convert a single UDL to equivalent nodal loads
 * 
 * For a uniformly distributed load w (kN/m) over length L:
 * - Shear reaction at each end: R = wL/2 (opposite to load direction)
 * - Fixed-End Moment at start: M1 = wL²/12
 * - Fixed-End Moment at end: M2 = -wL²/12
 * 
 * Note: The signs follow the convention that the FEM resists the applied load.
 * For a downward UDL (w negative), the reactions are upward (positive).
 */
function convertUDL(
    memberLoad: MemberLoad,
    member: Member,
    startNode: Node,
    endNode: Node
): NodalLoad[] {
    const L = calculateMemberLength(startNode, endNode);
    if (L < 1e-10) return [];
    
    const w = memberLoad.w1; // Load intensity (kN/m) - typically negative for gravity

    // Get load span (default full length)
    const a = (memberLoad.startPos ?? 0) * L;  // Start position from node i
    const b = (memberLoad.endPos ?? 1) * L;    // End position from node i
    const loadSpan = b - a;
    
    if (loadSpan <= 0) return [];

    // For partial UDL from 'a' to 'b':
    // Total load P = w * loadSpan
    // Centroid at distance (a + b)/2 from start
    const totalLoad = w * loadSpan;
    const centroid = (a + b) / 2;
    
    // Reactions using equilibrium (load applied at centroid)
    // R1 * L = -totalLoad * (L - centroid)  =>  R1 = -totalLoad * (L - centroid) / L
    // R2 = -totalLoad - R1
    const R1 = -totalLoad * (L - centroid) / L;
    const R2 = -totalLoad - R1;
    
    // Fixed-End Moments for partial UDL
    // For full span UDL: M1 = -wL²/12, M2 = wL²/12
    // For partial span, use integration or standard formulas
    // Simplified: Use moment at ends from uniformly distributed load over partial span
    let M1 = 0;
    let M2 = 0;
    
    if (Math.abs(a) < 0.001 && Math.abs(b - L) < 0.001) {
        // Full span UDL - use standard formula
        // M1 (at start) = -wL²/12 (clockwise to resist sagging)
        // M2 (at end) = +wL²/12 (counterclockwise to resist sagging)
        M1 = -w * L * L / 12;
        M2 = w * L * L / 12;
    } else {
        // Partial span - calculate using fixed-end moment formulas
        // For UDL from 'a' to 'b' on fixed-fixed beam:
        // M1 = w * b² * (6*L² - 8*L*b + 3*b²) / (12*L²) - w * a² * (6*L² - 8*L*a + 3*a²) / (12*L²)
        // This is complex; use simplified centroid-based approximation
        const M_fixed = w * loadSpan * loadSpan / 12;
        
        // Distribute based on position
        const ratio = centroid / L;
        M1 = -M_fixed * (1 - ratio);
        M2 = M_fixed * ratio;
    }

    const loads: NodalLoad[] = [];
    
    // Determine direction
    const dir = memberLoad.direction.toLowerCase();
    const isY = dir.includes('y');
    const isX = dir.includes('x');
    const isZ = dir.includes('z');
    const isLocal = dir.includes('local');

    if (isLocal) {
        // For local coordinate loads, need to transform
        // Simplified: assume local_y is perpendicular to member
        const { lx, ly, lz } = getMemberDirection(startNode, endNode);
        
        // Local Y perpendicular - apply as global Y for now (simplified)
        loads.push({
            nodeId: member.startNodeId,
            fy: R1,
            mz: M1
        });
        loads.push({
            nodeId: member.endNodeId,
            fy: R2,
            mz: M2
        });
    } else if (isY) {
        // Global Y direction (typically gravity)
        loads.push({
            nodeId: member.startNodeId,
            fy: R1,
            mz: M1
        });
        loads.push({
            nodeId: member.endNodeId,
            fy: R2,
            mz: M2
        });
    } else if (isX) {
        // Global X direction (horizontal load)
        loads.push({
            nodeId: member.startNodeId,
            fx: R1,
            mz: M1
        });
        loads.push({
            nodeId: member.endNodeId,
            fx: R2,
            mz: M2
        });
    } else if (isZ) {
        // Global Z direction (out of plane)
        loads.push({
            nodeId: member.startNodeId,
            fz: R1,
            my: -M1  // Moment about Y for Z-loads
        });
        loads.push({
            nodeId: member.endNodeId,
            fz: R2,
            my: -M2
        });
    } else {
        // Default to Y direction
        loads.push({
            nodeId: member.startNodeId,
            fy: R1,
            mz: M1
        });
        loads.push({
            nodeId: member.endNodeId,
            fy: R2,
            mz: M2
        });
    }

    return loads;
}

/**
 * Convert a triangular/trapezoidal load to equivalent nodal loads
 * 
 * For a triangular load from w1 to w2 over length L:
 * Using Fixed-End Moment formulas for linearly varying load
 * 
 * Reference: Structural Analysis, Hibbeler - Table 12-1
 */
function convertTriangular(
    memberLoad: MemberLoad,
    member: Member,
    startNode: Node,
    endNode: Node
): NodalLoad[] {
    const L = calculateMemberLength(startNode, endNode);
    if (L < 1e-10) return [];
    
    const w1 = memberLoad.w1; // Load at start
    const w2 = memberLoad.w2 ?? memberLoad.w1; // Load at end

    // Decompose into uniform + triangular
    // w(x) = w_min + (w_max - w_min) * x/L  for increasing
    // or w(x) = w_max - (w_max - w_min) * x/L for decreasing
    
    const w_min = Math.min(Math.abs(w1), Math.abs(w2)) * Math.sign(w1 || w2);
    const w_max = Math.max(Math.abs(w1), Math.abs(w2)) * Math.sign(w1 || w2);
    const w_delta = Math.abs(w2 - w1) * Math.sign(w2 - w1);
    
    // Total load
    // Trapezoidal area = (w1 + w2) * L / 2
    const totalLoad = (w1 + w2) * L / 2;
    
    // Centroid of trapezoidal load from start
    // x_bar = L * (w1 + 2*w2) / (3 * (w1 + w2))
    let centroid: number;
    if (Math.abs(w1 + w2) < 1e-10) {
        centroid = L / 2;
    } else {
        centroid = L * (w1 + 2 * w2) / (3 * (w1 + w2));
    }
    
    // Reactions (opposite to load direction)
    const R1 = -totalLoad * (L - centroid) / L;
    const R2 = -totalLoad - R1;
    
    // Fixed-End Moments for linearly varying load
    // For uniform part: M = ±w_min * L² / 12
    // For triangular part: different formulas based on orientation
    let M1 = 0;
    let M2 = 0;
    
    if (Math.abs(w1 - w2) < 1e-10) {
        // Uniform load
        M1 = -w1 * L * L / 12;
        M2 = w1 * L * L / 12;
    } else if (Math.abs(w1) < 1e-10) {
        // Triangle: 0 to w2 (ascending)
        // M1 = -w2 * L² / 20
        // M2 = w2 * L² / 30
        M1 = -w2 * L * L / 20;
        M2 = w2 * L * L / 30;
    } else if (Math.abs(w2) < 1e-10) {
        // Triangle: w1 to 0 (descending)
        // M1 = -w1 * L² / 30
        // M2 = w1 * L² / 20
        M1 = -w1 * L * L / 30;
        M2 = w1 * L * L / 20;
    } else {
        // General trapezoidal: decompose into uniform + triangle
        const w_uniform = Math.min(Math.abs(w1), Math.abs(w2)) * Math.sign(w1);
        const w_tri = Math.abs(w2 - w1);
        
        // Uniform contribution
        const M1_uniform = -w_uniform * L * L / 12;
        const M2_uniform = w_uniform * L * L / 12;
        
        // Triangular contribution
        let M1_tri = 0;
        let M2_tri = 0;
        if (Math.abs(w2) > Math.abs(w1)) {
            // Ascending triangle
            M1_tri = -w_tri * L * L / 20 * Math.sign(w2);
            M2_tri = w_tri * L * L / 30 * Math.sign(w2);
        } else {
            // Descending triangle
            M1_tri = -w_tri * L * L / 30 * Math.sign(w1);
            M2_tri = w_tri * L * L / 20 * Math.sign(w1);
        }
        
        M1 = M1_uniform + M1_tri;
        M2 = M2_uniform + M2_tri;
    }

    const loads: NodalLoad[] = [];
    const dir = memberLoad.direction.toLowerCase();
    const isY = dir.includes('y');
    const isX = dir.includes('x');
    const isZ = dir.includes('z');

    if (isY) {
        loads.push({
            nodeId: member.startNodeId,
            fy: R1,
            mz: M1
        });
        loads.push({
            nodeId: member.endNodeId,
            fy: R2,
            mz: M2
        });
    } else if (isX) {
        loads.push({
            nodeId: member.startNodeId,
            fx: R1,
            mz: M1
        });
        loads.push({
            nodeId: member.endNodeId,
            fx: R2,
            mz: M2
        });
    } else if (isZ) {
        loads.push({
            nodeId: member.startNodeId,
            fz: R1,
            my: -M1
        });
        loads.push({
            nodeId: member.endNodeId,
            fz: R2,
            my: -M2
        });
    } else {
        // Default to Y
        loads.push({
            nodeId: member.startNodeId,
            fy: R1,
            mz: M1
        });
        loads.push({
            nodeId: member.endNodeId,
            fy: R2,
            mz: M2
        });
    }

    return loads;
}

/**
 * Convert a point load on member to equivalent nodal loads
 * 
 * For a concentrated load P at distance 'a' from start (b = L - a):
 * - R1 = P * b / L
 * - R2 = P * a / L
 * - M1 = -P * a * b² / L²
 * - M2 = P * a² * b / L²
 */
function convertPointLoad(
    memberLoad: MemberLoad,
    member: Member,
    startNode: Node,
    endNode: Node
): NodalLoad[] {
    const L = calculateMemberLength(startNode, endNode);
    if (L < 1e-10) return [];
    
    const P = memberLoad.w1; // Point load magnitude (kN)
    const pos = memberLoad.startPos ?? 0.5; // Position ratio (0-1)
    
    const a = pos * L; // Distance from start
    const b = L - a;   // Distance from end
    
    // Reactions (opposite to load)
    const R1 = -P * b / L;
    const R2 = -P * a / L;
    
    // Fixed-End Moments
    const M1 = -P * a * b * b / (L * L);
    const M2 = P * a * a * b / (L * L);
    
    const loads: NodalLoad[] = [];
    const dir = memberLoad.direction.toLowerCase();
    const isY = dir.includes('y');
    const isX = dir.includes('x');
    const isZ = dir.includes('z');

    if (isY) {
        loads.push({ nodeId: member.startNodeId, fy: R1, mz: M1 });
        loads.push({ nodeId: member.endNodeId, fy: R2, mz: M2 });
    } else if (isX) {
        loads.push({ nodeId: member.startNodeId, fx: R1, mz: M1 });
        loads.push({ nodeId: member.endNodeId, fx: R2, mz: M2 });
    } else if (isZ) {
        loads.push({ nodeId: member.startNodeId, fz: R1, my: -M1 });
        loads.push({ nodeId: member.endNodeId, fz: R2, my: -M2 });
    } else {
        loads.push({ nodeId: member.startNodeId, fy: R1, mz: M1 });
        loads.push({ nodeId: member.endNodeId, fy: R2, mz: M2 });
    }

    return loads;
}

/**
 * Convert all member loads to equivalent nodal loads
 * 
 * @param memberLoads - Array of distributed member loads
 * @param members - Array of members
 * @param nodes - Array of nodes
 * @returns Array of equivalent nodal loads
 */
export function convertMemberLoadsToNodal(
    memberLoads: MemberLoad[],
    members: Member[],
    nodes: Node[]
): NodalLoad[] {
    const nodalLoads: NodalLoad[] = [];

    // Create lookup maps
    const nodeMap = new Map<string, Node>();
    nodes.forEach(n => nodeMap.set(n.id, n));

    const memberMap = new Map<string, Member>();
    members.forEach(m => memberMap.set(m.id, m));

    let convertedCount = 0;
    let skippedCount = 0;

    // Convert each member load
    for (const memberLoad of memberLoads) {
        const member = memberMap.get(memberLoad.memberId);
        if (!member) {
            console.warn(`[LoadConversion] Member ${memberLoad.memberId} not found`);
            skippedCount++;
            continue;
        }

        const startNode = nodeMap.get(member.startNodeId);
        const endNode = nodeMap.get(member.endNodeId);

        if (!startNode || !endNode) {
            console.warn(`[LoadConversion] Nodes not found for member ${member.id}`);
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
            default:
                console.warn(`[LoadConversion] Unknown load type: ${memberLoad.type}, treating as UDL`);
                equivalentLoads = convertUDL(memberLoad, member, startNode, endNode);
        }

        if (equivalentLoads.length > 0) {
            nodalLoads.push(...equivalentLoads);
            convertedCount++;
        }
    }

    console.log(`[LoadConversion] Converted ${convertedCount}/${memberLoads.length} member loads to ${nodalLoads.length} nodal loads`);
    if (skippedCount > 0) {
        console.warn(`[LoadConversion] Skipped ${skippedCount} loads due to missing members/nodes`);
    }

    return nodalLoads;
}

/**
 * Merge nodal loads (combine loads on the same node)
 */
export function mergeNodalLoads(loads: NodalLoad[]): NodalLoad[] {
    const merged = new Map<string, NodalLoad>();

    for (const load of loads) {
        const existing = merged.get(load.nodeId);

        if (existing) {
            // Add loads
            existing.fx = (existing.fx || 0) + (load.fx || 0);
            existing.fy = (existing.fy || 0) + (load.fy || 0);
            existing.fz = (existing.fz || 0) + (load.fz || 0);
            existing.mx = (existing.mx || 0) + (load.mx || 0);
            existing.my = (existing.my || 0) + (load.my || 0);
            existing.mz = (existing.mz || 0) + (load.mz || 0);
        } else {
            merged.set(load.nodeId, { ...load });
        }
    }

    return Array.from(merged.values());
}
