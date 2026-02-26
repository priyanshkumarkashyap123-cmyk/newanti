/**
 * geometry_engine.ts - Advanced Geometry Manipulation Tools
 * 
 * Computational Geometry for Structural Modeler:
 * - Coordinate Systems (Cartesian, Cylindrical)
 * - Structure Generation (Extrude, Rotate, Mirror)
 * - Node Operations (Split Member, Insert Node)
 * - Matrix Operations for transformations
 */

import { Node, Member } from '../store/model';

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
    linkSteps: boolean = true
): ExtrudeResult {
    const result: ExtrudeResult = { nodes: [], members: [] };

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
            const newNodeId = `${node.id}_ext${step}`;
            const newNode: Node = {
                id: newNodeId,
                x: node.x + offset.x,
                y: node.y + offset.y,
                z: node.z + offset.z,
                restraints: undefined // Cloned nodes typically don't have restraints
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
                const newMember: Member = {
                    id: `${member.id}_ext${step}`,
                    startNodeId: startIds[step],
                    endNodeId: endIds[step],
                    sectionId: member.sectionId,
                    E: member.E,
                    A: member.A,
                    I: member.I
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
                    const linkMember: Member = {
                        id: `link_${node.id}_${step}`,
                        startNodeId: ids[step],
                        endNodeId: ids[step + 1],
                        sectionId: selectedMembers[0]?.sectionId || 'default'
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

/**
 * Clone and rotate selection around an axis
 * 
 * @param selectedNodes - Nodes to rotate
 * @param selectedMembers - Members to rotate
 * @param axis - Axis of rotation (e.g., {x:0, y:0, z:1} for Z-axis)
 * @param center - Center point for rotation
 * @param angleStep - Angle between each copy (radians)
 * @param totalSteps - Number of copies to create
 * @param includeOriginal - Whether to include the original in the result
 */
export function rotateCopy(
    selectedNodes: Node[],
    selectedMembers: Member[],
    axis: Vector3,
    center: Vector3,
    angleStep: number,
    totalSteps: number,
    includeOriginal: boolean = false
): RotateCopyResult {
    const result: RotateCopyResult = { nodes: [], members: [] };

    // Map from original node ID to array of rotated node IDs
    const nodeIdMap = new Map<string, string[]>();

    // Initialize mapping
    selectedNodes.forEach(node => {
        nodeIdMap.set(node.id, includeOriginal ? [node.id] : []);
    });

    // Start from step 1 (step 0 is original)
    const startStep = includeOriginal ? 1 : 0;
    const endStep = includeOriginal ? totalSteps : totalSteps - 1;

    for (let step = startStep; step <= endStep; step++) {
        const angle = angleStep * step;
        const rotMatrix = rotationMatrixAroundAxis(axis, angle);

        // Rotate nodes
        selectedNodes.forEach(node => {
            // Translate to origin (relative to center)
            const relative: Vector3 = {
                x: node.x - center.x,
                y: node.y - center.y,
                z: node.z - center.z
            };

            // Apply rotation
            const rotated = applyMatrix(rotMatrix, relative);

            // Translate back
            const newNodeId = `${node.id}_rot${step}`;
            const newNode: Node = {
                id: newNodeId,
                x: rotated.x + center.x,
                y: rotated.y + center.y,
                z: rotated.z + center.z
            };
            result.nodes.push(newNode);

            // Update mapping
            const ids = nodeIdMap.get(node.id) || [];
            ids.push(newNodeId);
            nodeIdMap.set(node.id, ids);
        });

        // Clone members
        selectedMembers.forEach(member => {
            const startIds = nodeIdMap.get(member.startNodeId);
            const endIds = nodeIdMap.get(member.endNodeId);

            const stepIdx = includeOriginal ? step - 1 : step;

            if (startIds && endIds && startIds[stepIdx] !== undefined && endIds[stepIdx] !== undefined) {
                const newMember: Member = {
                    id: `${member.id}_rot${step}`,
                    startNodeId: startIds[stepIdx],
                    endNodeId: endIds[stepIdx],
                    sectionId: member.sectionId,
                    E: member.E,
                    A: member.A,
                    I: member.I
                };
                result.members.push(newMember);
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
}

export default GeometryEngine;
