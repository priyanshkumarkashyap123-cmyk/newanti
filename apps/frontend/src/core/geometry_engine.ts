/**
 * geometry_engine.ts - Advanced Geometry Manipulation Tools
 * 
 * Computational Geometry for Structural Modeler:
 * - Coordinate Systems (Cartesian, Cylindrical)
 * - Structure Generation (Extrude, Rotate, Mirror)
 * - Node Operations (Split Member, Insert Node)
 * - Matrix Operations for transformations
 */

import type { Node, Member } from '../store/modelTypes';

// ============================================
// TYPES
// ============================================

export type CoordinateSystem = 'cartesian' | 'cylindrical';

export interface Vector3 {
    x: number;
    y: number;
    z: number;
}

export interface CylindricalCoord {
    r: number;      // Radial distance
    theta: number;  // Angle in radians
    z: number;      // Height
}

export interface Plane {
    point: Vector3;   // Point on the plane
    normal: Vector3;  // Normal vector
}

export interface MemberOffset {
    x: number;
    y: number;
    z: number;
}

export interface ExtendedMember extends Member {
    startOffset?: MemberOffset;
    endOffset?: MemberOffset;
}

// 3x3 Rotation Matrix
export type Matrix3x3 = [
    [number, number, number],
    [number, number, number],
    [number, number, number]
];

// ============================================
// COORDINATE SYSTEM CONVERSIONS
// ============================================

/**
 * Convert cylindrical coordinates (r, θ, z) to Cartesian (x, y, z)
 * θ is measured from positive X-axis, CCW when viewed from +Z
 */
export function cylindricalToCartesian(cyl: CylindricalCoord): Vector3 {
    return {
        x: cyl.r * Math.cos(cyl.theta),
        y: cyl.r * Math.sin(cyl.theta),
        z: cyl.z
    };
}

/**
 * Convert Cartesian coordinates to cylindrical
 */
export function cartesianToCylindrical(cart: Vector3): CylindricalCoord {
    const r = Math.sqrt(cart.x * cart.x + cart.y * cart.y);
    const theta = Math.atan2(cart.y, cart.x);
    return { r, theta, z: cart.z };
}

/**
 * Degrees to radians
 */
export function degToRad(degrees: number): number {
    return degrees * (Math.PI / 180);
}

/**
 * Radians to degrees
 */
export function radToDeg(radians: number): number {
    return radians * (180 / Math.PI);
}

// ============================================
// VECTOR OPERATIONS
// ============================================

export function addVectors(a: Vector3, b: Vector3): Vector3 {
    return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
}

export function subtractVectors(a: Vector3, b: Vector3): Vector3 {
    return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

export function scaleVector(v: Vector3, s: number): Vector3 {
    return { x: v.x * s, y: v.y * s, z: v.z * s };
}

export function magnitude(v: Vector3): number {
    return Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
}

export function normalize(v: Vector3): Vector3 {
    const mag = magnitude(v);
    if (mag === 0) return { x: 0, y: 0, z: 0 };
    return scaleVector(v, 1 / mag);
}

export function dotProduct(a: Vector3, b: Vector3): number {
    return a.x * b.x + a.y * b.y + a.z * b.z;
}

export function crossProduct(a: Vector3, b: Vector3): Vector3 {
    return {
        x: a.y * b.z - a.z * b.y,
        y: a.z * b.x - a.x * b.z,
        z: a.x * b.y - a.y * b.x
    };
}

// ============================================
// MATRIX OPERATIONS
// ============================================

/**
 * Create rotation matrix around X-axis
 */
export function rotationMatrixX(angle: number): Matrix3x3 {
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    return [
        [1, 0, 0],
        [0, c, -s],
        [0, s, c]
    ];
}

/**
 * Create rotation matrix around Y-axis
 */
export function rotationMatrixY(angle: number): Matrix3x3 {
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    return [
        [c, 0, s],
        [0, 1, 0],
        [-s, 0, c]
    ];
}

/**
 * Create rotation matrix around Z-axis
 */
export function rotationMatrixZ(angle: number): Matrix3x3 {
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    return [
        [c, -s, 0],
        [s, c, 0],
        [0, 0, 1]
    ];
}

/**
 * Create rotation matrix around arbitrary axis (Rodrigues' rotation formula)
 */
export function rotationMatrixAroundAxis(axis: Vector3, angle: number): Matrix3x3 {
    const k = normalize(axis);
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    const t = 1 - c;

    return [
        [c + k.x * k.x * t, k.x * k.y * t - k.z * s, k.x * k.z * t + k.y * s],
        [k.y * k.x * t + k.z * s, c + k.y * k.y * t, k.y * k.z * t - k.x * s],
        [k.z * k.x * t - k.y * s, k.z * k.y * t + k.x * s, c + k.z * k.z * t]
    ];
}

/**
 * Apply matrix transformation to a point
 */
export function applyMatrix(matrix: Matrix3x3, v: Vector3): Vector3 {
    return {
        x: matrix[0][0] * v.x + matrix[0][1] * v.y + matrix[0][2] * v.z,
        y: matrix[1][0] * v.x + matrix[1][1] * v.y + matrix[1][2] * v.z,
        z: matrix[2][0] * v.x + matrix[2][1] * v.y + matrix[2][2] * v.z
    };
}

// ============================================
// STRUCTURE GENERATION: TRANSLATIONAL REPEAT (EXTRUDE)
// ============================================

export interface ExtrudeResult {
    nodes: Node[];
    members: Member[];
}

export interface ExtrudeOptions {
    existingNodeIds?: Set<string>;
    existingMemberIds?: Set<string>;
    cloneNodeRestraints?: boolean;
    linkSectionId?: string;
}

function makeUniqueId(baseId: string, existingIds: Set<string>): string {
    if (!existingIds.has(baseId)) {
        existingIds.add(baseId);
        return baseId;
    }

    let suffix = 1;
    let candidate = `${baseId}_${suffix}`;
    while (existingIds.has(candidate)) {
        suffix += 1;
        candidate = `${baseId}_${suffix}`;
    }
    existingIds.add(candidate);
    return candidate;
}

/**
 * Extrude geometry along an axis
 * Creates N copies along a vector, connecting with new members
 * 
 * @param selectedNodes - Nodes to extrude
 * @param selectedMembers - Members to extrude
 * @param axis - Direction vector for extrusion
 * @param spacing - Distance between steps
 * @param steps - Number of extrusion steps
 * @param linkSteps - Whether to create members linking the steps
 */
export function extrudeGeometry(
    selectedNodes: Node[],
    selectedMembers: Member[],
    axis: Vector3,
    spacing: number,
    steps: number,
    linkSteps: boolean = true,
    options?: ExtrudeOptions
): ExtrudeResult {
    const result: ExtrudeResult = { nodes: [], members: [] };

    if (selectedNodes.length === 0 || steps < 1 || spacing <= 0) {
        return result;
    }

    const axisMagnitude = magnitude(axis);
    if (axisMagnitude <= Number.EPSILON) {
        return result;
    }

    const existingNodeIds = new Set<string>(options?.existingNodeIds ?? selectedNodes.map((node) => node.id));
    const existingMemberIds = new Set<string>(options?.existingMemberIds ?? selectedMembers.map((member) => member.id));
    const cloneNodeRestraints = options?.cloneNodeRestraints ?? false;

    // Normalize and scale the axis vector
    const direction = scaleVector(normalize(axis), spacing);

    // Map from original node ID to array of cloned node IDs [step0, step1, ...]
    const nodeIdMap = new Map<string, string[]>();

    // Initialize with original nodes
    selectedNodes.forEach(node => {
        nodeIdMap.set(node.id, [node.id]);
    });

    // Create cloned nodes for each step
    for (let step = 1; step <= steps; step++) {
        const offset = scaleVector(direction, step);

        selectedNodes.forEach(node => {
            const baseNodeId = `${node.id}_ext${step}`;
            const newNodeId = makeUniqueId(baseNodeId, existingNodeIds);
            const newNode: Node = {
                id: newNodeId,
                x: node.x + offset.x,
                y: node.y + offset.y,
                z: node.z + offset.z,
                restraints: cloneNodeRestraints ? node.restraints : undefined
            };
            result.nodes.push(newNode);

            // Add to mapping
            const ids = nodeIdMap.get(node.id) || [node.id];
            ids.push(newNodeId);
            nodeIdMap.set(node.id, ids);
        });
    }

    // Clone members at each step level
    for (let step = 1; step <= steps; step++) {
        selectedMembers.forEach(member => {
            const startIds = nodeIdMap.get(member.startNodeId);
            const endIds = nodeIdMap.get(member.endNodeId);

            if (startIds && endIds && startIds[step] && endIds[step]) {
                const baseMemberId = `${member.id}_ext${step}`;
                const newMemberId = makeUniqueId(baseMemberId, existingMemberIds);
                const newMember: Member = {
                    ...member,
                    id: newMemberId,
                    startNodeId: startIds[step],
                    endNodeId: endIds[step]
                };
                result.members.push(newMember);
            }
        });
    }

    // Create linking members between steps if requested
    if (linkSteps) {
        selectedNodes.forEach(node => {
            const ids = nodeIdMap.get(node.id);
            if (ids) {
                for (let step = 0; step < steps; step++) {
                    const baseLinkId = `link_${node.id}_${step}`;
                    const linkMemberId = makeUniqueId(baseLinkId, existingMemberIds);
                    const linkMember: Member = {
                        id: linkMemberId,
                        startNodeId: ids[step],
                        endNodeId: ids[step + 1],
                        sectionId: options?.linkSectionId || selectedMembers[0]?.sectionId || 'Default',
                        E: selectedMembers[0]?.E,
                        A: selectedMembers[0]?.A,
                        I: selectedMembers[0]?.I,
                        Iy: selectedMembers[0]?.Iy,
                        Iz: selectedMembers[0]?.Iz,
                        J: selectedMembers[0]?.J,
                        G: selectedMembers[0]?.G,
                        rho: selectedMembers[0]?.rho
                    };
                    result.members.push(linkMember);
                }
            }
        });
    }

    return result;
}

// ============================================
// STRUCTURE GENERATION: CIRCULAR REPEAT (ROTATE COPY)
// ============================================

export interface RotateCopyResult {
    nodes: Node[];
    members: Member[];
}

export interface RotateCopyOptions {
    existingNodeIds?: Set<string>;
    existingMemberIds?: Set<string>;
    /** Connect adjacent copies with members (spokes) */
    linkSteps?: boolean;
    /** Also connect last copy back to first copy, forming a closed ring */
    closeLoop?: boolean;
    /** Section ID for link/ring members */
    linkSectionId?: string;
}

/**
 * Clone and rotate selection around an axis.
 * Creates `totalSteps` copies at angles angleStep, 2*angleStep, …, totalSteps*angleStep.
 * Uses collision-safe unique IDs and clones all member properties.
 *
 * @param selectedNodes   - Nodes to rotate
 * @param selectedMembers - Members to rotate (fully cloned including all properties)
 * @param axis            - Axis of rotation (e.g., {x:0,y:1,z:0} for Y-axis)
 * @param center          - Centre point for rotation
 * @param angleStep       - Angle between each copy (radians)
 * @param totalSteps      - Number of copies to create (original NOT duplicated)
 * @param includeOriginal - Reserved for API compatibility (not used, original never duplicated)
 * @param options         - Collision safety, linkSteps, closeLoop
 */
export function rotateCopy(
    selectedNodes: Node[],
    selectedMembers: Member[],
    axis: Vector3,
    center: Vector3,
    angleStep: number,
    totalSteps: number,
    includeOriginal: boolean = false,
    options?: RotateCopyOptions
): RotateCopyResult {
    const result: RotateCopyResult = { nodes: [], members: [] };

    if (selectedNodes.length === 0 || totalSteps < 1 || Math.abs(angleStep) < 1e-12) {
        return result;
    }

    const normAxis = normalize(axis);
    if (magnitude(normAxis) < 1e-12) return result;

    const existingNodeIds = new Set<string>(
        options?.existingNodeIds ?? selectedNodes.map((n) => n.id)
    );
    const existingMemberIds = new Set<string>(
        options?.existingMemberIds ?? selectedMembers.map((m) => m.id)
    );
    const linkSteps = options?.linkSteps ?? false;
    const closeLoop = options?.closeLoop ?? false;

    // nodeIdMap: original node ID → [original_id, copy1_id, copy2_id, ..., copyN_id]
    // Index 0 is always the original (not added to result.nodes).
    const nodeIdMap = new Map<string, string[]>();
    selectedNodes.forEach((node) => {
        nodeIdMap.set(node.id, [node.id]);
    });

    // Create N copies
    for (let step = 1; step <= totalSteps; step++) {
        const angle = angleStep * step;
        const rotMatrix = rotationMatrixAroundAxis(normAxis, angle);

        selectedNodes.forEach((node) => {
            const relative: Vector3 = {
                x: node.x - center.x,
                y: node.y - center.y,
                z: node.z - center.z,
            };
            const rotated = applyMatrix(rotMatrix, relative);
            const baseId = `${node.id}_rot${step}`;
            const newNodeId = makeUniqueId(baseId, existingNodeIds);

            result.nodes.push({
                id: newNodeId,
                x: rotated.x + center.x,
                y: rotated.y + center.y,
                z: rotated.z + center.z,
            });

            nodeIdMap.get(node.id)!.push(newNodeId);
        });

        // Fully clone members at this step
        selectedMembers.forEach((member) => {
            const startIds = nodeIdMap.get(member.startNodeId);
            const endIds = nodeIdMap.get(member.endNodeId);

            if (startIds?.[step] && endIds?.[step]) {
                const baseId = `${member.id}_rot${step}`;
                const newMemberId = makeUniqueId(baseId, existingMemberIds);
                result.members.push({
                    ...member,
                    id: newMemberId,
                    startNodeId: startIds[step],
                    endNodeId: endIds[step],
                });
            }
        });
    }

    // Create inter-copy link members (spokes / ring members)
    if (linkSteps && totalSteps >= 1) {
        const refMember = selectedMembers[0];
        const linkProps = {
            sectionId: options?.linkSectionId ?? refMember?.sectionId ?? 'Default',
            E: refMember?.E,
            A: refMember?.A,
            I: refMember?.I,
            Iy: refMember?.Iy,
            Iz: refMember?.Iz,
            J: refMember?.J,
            G: refMember?.G,
            rho: refMember?.rho,
        };

        selectedNodes.forEach((node) => {
            const ids = nodeIdMap.get(node.id);
            if (!ids || ids.length < 2) return;

            // Connect copy1→copy2→…→copyN
            for (let s = 1; s < ids.length - 1; s++) {
                const linkId = makeUniqueId(`link_rot_${node.id}_${s}`, existingMemberIds);
                result.members.push({ id: linkId, startNodeId: ids[s], endNodeId: ids[s + 1], ...linkProps });
            }

            // Close the ring: copyN → copy1
            if (closeLoop && ids.length >= 3) {
                const linkId = makeUniqueId(`link_rot_close_${node.id}`, existingMemberIds);
                result.members.push({ id: linkId, startNodeId: ids[ids.length - 1], endNodeId: ids[1], ...linkProps });
            }
        });
    }

    return result;
}

// ============================================
// STRUCTURE GENERATION: MIRROR
// ============================================

export interface MirrorResult {
    nodes: Node[];
    members: Member[];
}

export type MirrorPlane = 'XY' | 'YZ' | 'XZ' | 'custom';

/**
 * Mirror selection across a plane
 * 
 * @param selectedNodes - Nodes to mirror
 * @param selectedMembers - Members to mirror
 * @param plane - Standard plane ('XY', 'YZ', 'XZ') or 'custom'
 * @param customPlane - Custom plane definition (required if plane === 'custom')
 */
export function mirror(
    selectedNodes: Node[],
    selectedMembers: Member[],
    plane: MirrorPlane,
    customPlane?: Plane
): MirrorResult {
    const result: MirrorResult = { nodes: [], members: [] };

    // Map from original node ID to mirrored node ID
    const nodeIdMap = new Map<string, string>();

    // Mirror function based on plane
    const mirrorPoint = (p: Vector3): Vector3 => {
        switch (plane) {
            case 'XY':
                // Mirror across XY plane (invert Z)
                return { x: p.x, y: p.y, z: -p.z };
            case 'YZ':
                // Mirror across YZ plane (invert X)
                return { x: -p.x, y: p.y, z: p.z };
            case 'XZ':
                // Mirror across XZ plane (invert Y)
                return { x: p.x, y: -p.y, z: p.z };
            case 'custom':
                if (!customPlane) return p;
                // Mirror across custom plane using reflection formula
                // P' = P - 2 * ((P - O) · n) * n
                const d = subtractVectors(p, customPlane.point);
                const n = normalize(customPlane.normal);
                const distance = dotProduct(d, n);
                const offset = scaleVector(n, 2 * distance);
                return subtractVectors(p, offset);
            default:
                return p;
        }
    };

    // Mirror nodes
    selectedNodes.forEach(node => {
        const mirrored = mirrorPoint({ x: node.x, y: node.y, z: node.z });
        const newNodeId = `${node.id}_mir`;

        const newNode: Node = {
            id: newNodeId,
            x: mirrored.x,
            y: mirrored.y,
            z: mirrored.z
        };
        result.nodes.push(newNode);
        nodeIdMap.set(node.id, newNodeId);
    });

    // Mirror members
    selectedMembers.forEach(member => {
        const mirStart = nodeIdMap.get(member.startNodeId);
        const mirEnd = nodeIdMap.get(member.endNodeId);

        if (mirStart && mirEnd) {
            const newMember: Member = {
                id: `${member.id}_mir`,
                startNodeId: mirStart,
                endNodeId: mirEnd,
                sectionId: member.sectionId,
                E: member.E,
                A: member.A,
                I: member.I
            };
            result.members.push(newMember);
        }
    });

    return result;
}

// ============================================
// NODE OPERATIONS: SPLIT MEMBER (INSERT NODE)
// ============================================

export interface SplitMemberResult {
    newNode: Node;
    newMembers: [Member, Member];
    deletedMemberId: string;
}

/**
 * Split a member at a specified position, creating a new node
 * 
 * @param member - The member to split
 * @param startNode - Start node of the member
 * @param endNode - End node of the member
 * @param position - Position along member (0-1 as ratio, or absolute distance if isAbsolute)
 * @param isAbsolute - If true, position is absolute distance from start
 */
export function splitMember(
    member: Member,
    startNode: Node,
    endNode: Node,
    position: number,
    isAbsolute: boolean = false
): SplitMemberResult {
    // Calculate member length
    const dx = endNode.x - startNode.x;
    const dy = endNode.y - startNode.y;
    const dz = endNode.z - startNode.z;
    const length = Math.sqrt(dx * dx + dy * dy + dz * dz);

    // Determine ratio
    let ratio = position;
    if (isAbsolute) {
        ratio = Math.max(0, Math.min(1, position / length));
    } else {
        ratio = Math.max(0, Math.min(1, position));
    }

    // Calculate new node position
    const newNode: Node = {
        id: `${member.id}_split`,
        x: startNode.x + dx * ratio,
        y: startNode.y + dy * ratio,
        z: startNode.z + dz * ratio
    };

    // Create two new members
    const member1: Member = {
        id: `${member.id}_a`,
        startNodeId: member.startNodeId,
        endNodeId: newNode.id,
        sectionId: member.sectionId,
        E: member.E,
        A: member.A,
        I: member.I,
        releases: member.releases
    };

    const member2: Member = {
        id: `${member.id}_b`,
        startNodeId: newNode.id,
        endNodeId: member.endNodeId,
        sectionId: member.sectionId,
        E: member.E,
        A: member.A,
        I: member.I,
        releases: member.releases
    };

    return {
        newNode,
        newMembers: [member1, member2],
        deletedMemberId: member.id
    };
}

// ============================================
// MEMBER WITH OFFSETS (RIGID ZONES)
// ============================================

/**
 * Calculate the effective (visible) start and end points of a member
 * considering rigid offsets
 * 
 * @param member - Member with potential offsets
 * @param startNode - Start node
 * @param endNode - End node
 */
export function getMemberVisibleEndpoints(
    member: ExtendedMember,
    startNode: Node,
    endNode: Node
): { start: Vector3; end: Vector3 } {
    // Default positions
    let start: Vector3 = { x: startNode.x, y: startNode.y, z: startNode.z };
    let end: Vector3 = { x: endNode.x, y: endNode.y, z: endNode.z };

    // Apply start offset if present
    if (member.startOffset) {
        start = {
            x: start.x + member.startOffset.x,
            y: start.y + member.startOffset.y,
            z: start.z + member.startOffset.z
        };
    }

    // Apply end offset if present
    if (member.endOffset) {
        end = {
            x: end.x - member.endOffset.x,
            y: end.y - member.endOffset.y,
            z: end.z - member.endOffset.z
        };
    }

    return { start, end };
}

/**
 * Calculate member length considering offsets
 */
export function getMemberEffectiveLength(
    member: ExtendedMember,
    startNode: Node,
    endNode: Node
): number {
    const { start, end } = getMemberVisibleEndpoints(member, startNode, endNode);
    return magnitude(subtractVectors(end, start));
}

// ============================================
// UTILITY: DISTANCE CALCULATIONS
// ============================================

/**
 * Distance between two points
 */
export function distanceBetweenPoints(a: Vector3, b: Vector3): number {
    return magnitude(subtractVectors(b, a));
}

/**
 * Point on line closest to another point
 */
export function closestPointOnLine(
    lineStart: Vector3,
    lineEnd: Vector3,
    point: Vector3
): { point: Vector3; t: number } {
    const lineDir = subtractVectors(lineEnd, lineStart);
    const pointDir = subtractVectors(point, lineStart);
    const lineLengthSq = dotProduct(lineDir, lineDir);

    if (lineLengthSq === 0) {
        return { point: lineStart, t: 0 };
    }

    let t = dotProduct(pointDir, lineDir) / lineLengthSq;
    t = Math.max(0, Math.min(1, t)); // Clamp to line segment

    return {
        point: addVectors(lineStart, scaleVector(lineDir, t)),
        t
    };
}

// ============================================
// AUTO-NODING: 3D MEMBER INTERSECTION DETECTION
// ============================================

export interface IntersectionPoint {
    /** Intersection position in 3D space */
    position: Vector3;
    memberAId: string;
    memberBId: string;
    /** Parameter along member A [0, 1] */
    tA: number;
    /** Parameter along member B [0, 1] */
    tB: number;
}

export interface AutoNodeResult {
    newNodes: Node[];
    newMembers: Member[];
    /** IDs of original members replaced by sub-segments */
    deletedMemberIds: string[];
}

/**
 * Compute the closest points between two 3D finite line segments A=(a0,a1) and B=(b0,b1).
 * Returns null when segments are parallel/degenerate.
 * Algorithm: Dan Sunday, "Distance between 3D lines & segments".
 */
function segmentSegmentClosestPoints(
    a0: Vector3, a1: Vector3,
    b0: Vector3, b1: Vector3
): { pA: Vector3; pB: Vector3; tA: number; tB: number; dist: number } | null {
    const SMALL = 1e-10;
    const u = subtractVectors(a1, a0);
    const v = subtractVectors(b1, b0);
    const w = subtractVectors(a0, b0);

    const a = dotProduct(u, u);
    const b = dotProduct(u, v);
    const c = dotProduct(v, v);
    const d = dotProduct(u, w);
    const e = dotProduct(v, w);
    const denom = a * c - b * b;

    if (denom < SMALL) return null; // Parallel

    let sN = b * e - c * d;
    let sD = denom;
    let tN = a * e - b * d;
    let tD = denom;

    // Clamp s to [0, 1]
    if (sN < 0.0) { sN = 0.0; tN = e; tD = c; }
    else if (sN > sD) { sN = sD; tN = e + b; tD = c; }

    // Clamp t to [0, 1]
    if (tN < 0.0) {
        tN = 0.0;
        sN = Math.max(0.0, Math.min(sD, -d));
    } else if (tN > tD) {
        tN = tD;
        sN = Math.max(0.0, Math.min(sD, -d + b));
    }

    const sC = Math.abs(sN) < SMALL ? 0.0 : sN / sD;
    const tC = Math.abs(tN) < SMALL ? 0.0 : tN / tD;

    const pA = addVectors(a0, scaleVector(u, sC));
    const pB = addVectors(b0, scaleVector(v, tC));
    return { pA, pB, tA: sC, tB: tC, dist: magnitude(subtractVectors(pB, pA)) };
}

/**
 * Find all interior intersection points between member segments.
 * Parallel segments and members sharing an endpoint are skipped.
 *
 * @param members   - Members to check (must be 3D segments)
 * @param nodes     - Node map for coordinate lookup
 * @param tolerance - Closest-point distance that counts as intersection (m)
 */
export function findMemberIntersections(
    members: Member[],
    nodes: Map<string, Node>,
    tolerance: number = 0.01
): IntersectionPoint[] {
    const EDGE = 1e-4; // Avoid flagging shared endpoints as intersections
    const intersections: IntersectionPoint[] = [];

    for (let i = 0; i < members.length; i++) {
        const mA = members[i];
        const nA0 = nodes.get(mA.startNodeId);
        const nA1 = nodes.get(mA.endNodeId);
        if (!nA0 || !nA1) continue;
        const va0: Vector3 = { x: nA0.x, y: nA0.y, z: nA0.z };
        const va1: Vector3 = { x: nA1.x, y: nA1.y, z: nA1.z };

        for (let j = i + 1; j < members.length; j++) {
            const mB = members[j];

            // Skip members already sharing a node (they meet at an endpoint, not an interior crossing)
            if (
                mA.startNodeId === mB.startNodeId || mA.startNodeId === mB.endNodeId ||
                mA.endNodeId === mB.startNodeId  || mA.endNodeId === mB.endNodeId
            ) continue;

            const nB0 = nodes.get(mB.startNodeId);
            const nB1 = nodes.get(mB.endNodeId);
            if (!nB0 || !nB1) continue;
            const vb0: Vector3 = { x: nB0.x, y: nB0.y, z: nB0.z };
            const vb1: Vector3 = { x: nB1.x, y: nB1.y, z: nB1.z };

            const closest = segmentSegmentClosestPoints(va0, va1, vb0, vb1);
            if (!closest) continue;

            if (
                closest.dist <= tolerance &&
                closest.tA > EDGE && closest.tA < 1.0 - EDGE &&
                closest.tB > EDGE && closest.tB < 1.0 - EDGE
            ) {
                // Midpoint as the shared intersection node position
                intersections.push({
                    position: scaleVector(addVectors(closest.pA, closest.pB), 0.5),
                    memberAId: mA.id,
                    memberBId: mB.id,
                    tA: closest.tA,
                    tB: closest.tB,
                });
            }
        }
    }
    return intersections;
}

/**
 * Auto-node intersecting members: detect interior crossings, inject a shared node,
 * split both members, and return all new/deleted entities.
 *
 * The caller must remove `deletedMemberIds` from the store and add `newNodes` + `newMembers`.
 */
export function autoNodeIntersections(
    members: Member[],
    nodes: Map<string, Node>,
    options?: {
        tolerance?: number;
        existingNodeIds?: Set<string>;
        existingMemberIds?: Set<string>;
    }
): AutoNodeResult {
    const tolerance = options?.tolerance ?? 0.01;
    const existingNodeIds = new Set<string>(options?.existingNodeIds ?? [...nodes.keys()]);
    const existingMemberIds = new Set<string>(options?.existingMemberIds ?? members.map((m) => m.id));

    const result: AutoNodeResult = { newNodes: [], newMembers: [], deletedMemberIds: [] };

    const intersections = findMemberIntersections(members, nodes, tolerance);
    if (intersections.length === 0) return result;

    // For each intersection, create (or reuse) a shared node, then record splits on each member
    type SplitPoint = { t: number; nodeId: string };
    const splitsByMember = new Map<string, SplitPoint[]>();

    for (const ix of intersections) {
        // Check if we already created a node near this position
        let sharedNodeId: string | undefined;
        for (const n of result.newNodes) {
            const p: Vector3 = { x: n.x, y: n.y, z: n.z };
            if (magnitude(subtractVectors(p, ix.position)) < tolerance) {
                sharedNodeId = n.id;
                break;
            }
        }
        if (!sharedNodeId) {
            const baseId = `IX${result.newNodes.length + 1}`;
            sharedNodeId = makeUniqueId(baseId, existingNodeIds);
            result.newNodes.push({ id: sharedNodeId, x: ix.position.x, y: ix.position.y, z: ix.position.z });
        }

        for (const [memberId, t] of [[ix.memberAId, ix.tA], [ix.memberBId, ix.tB]] as [string, number][]) {
            if (!splitsByMember.has(memberId)) splitsByMember.set(memberId, []);
            splitsByMember.get(memberId)!.push({ t, nodeId: sharedNodeId });
        }
    }

    const memberMap = new Map<string, Member>(members.map((m) => [m.id, m]));

    for (const [memberId, splits] of splitsByMember) {
        const member = memberMap.get(memberId);
        if (!member) continue;

        // Sort splits by parameter t ascending
        const sorted = [...splits].sort((a, b) => a.t - b.t);
        const chain = [member.startNodeId, ...sorted.map((s) => s.nodeId), member.endNodeId];

        for (let i = 0; i < chain.length - 1; i++) {
            const newId = makeUniqueId(`${memberId}_s${i}`, existingMemberIds);
            result.newMembers.push({ ...member, id: newId, startNodeId: chain[i], endNodeId: chain[i + 1] });
        }

        if (!result.deletedMemberIds.includes(memberId)) {
            result.deletedMemberIds.push(memberId);
        }
    }

    return result;
}

// ============================================
// GEOMETRY ENGINE CLASS
// ============================================

export class GeometryEngine {
    private coordinateSystem: CoordinateSystem = 'cartesian';

    constructor(system: CoordinateSystem = 'cartesian') {
        this.coordinateSystem = system;
    }

    setCoordinateSystem(system: CoordinateSystem): void {
        this.coordinateSystem = system;
    }

    getCoordinateSystem(): CoordinateSystem {
        return this.coordinateSystem;
    }

    /**
     * Parse input coordinates based on current system
     */
    parseInput(input: { a: number; b: number; c: number }): Vector3 {
        if (this.coordinateSystem === 'cylindrical') {
            // Input is (r, theta, z) where theta is in degrees
            return cylindricalToCartesian({
                r: input.a,
                theta: degToRad(input.b),
                z: input.c
            });
        }
        // Cartesian: (x, y, z)
        return { x: input.a, y: input.b, z: input.c };
    }

    /**
     * Format coordinates for display based on current system
     */
    formatForDisplay(point: Vector3): { a: number; b: number; c: number; labels: [string, string, string] } {
        if (this.coordinateSystem === 'cylindrical') {
            const cyl = cartesianToCylindrical(point);
            return {
                a: cyl.r,
                b: radToDeg(cyl.theta),
                c: cyl.z,
                labels: ['R', 'θ°', 'Z']
            };
        }
        return {
            a: point.x,
            b: point.y,
            c: point.z,
            labels: ['X', 'Y', 'Z']
        };
    }

    // Expose static methods
    extrude = extrudeGeometry;
    rotateCopy = rotateCopy;
    mirror = mirror;
    splitMember = splitMember;
    findIntersections = findMemberIntersections;
    autoNode = autoNodeIntersections;
}

export default GeometryEngine;
