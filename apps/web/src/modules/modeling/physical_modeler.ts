/**
 * physical_modeler.ts - Physical Member Workflow
 * 
 * Implements the distinction between Physical and Analytical members:
 * - Physical Members: What the user sees and edits
 * - Analytical Members: What the solver uses (auto-meshed at intersections)
 * 
 * Also includes Structure Wizard templates and Interoperability
 */

import { Node, Member } from '../../store/model';
import {
    Vector3,
    distanceBetweenPoints,
    closestPointOnLine,
    addVectors,
    subtractVectors,
    scaleVector,
    magnitude,
    normalize,
    degToRad
} from '../../core/geometry_engine';

// ============================================
// TYPES
// ============================================

export interface PhysicalMemberSection {
    id: string;
    name: string;
    width: number;   // m
    height: number;  // m
    area: number;    // m²
    Ix: number;      // m⁴
    Iy: number;      // m⁴
    material: string;
}

export interface PhysicalMember {
    id: string;
    name: string;
    startPoint: Vector3;
    endPoint: Vector3;
    section: PhysicalMemberSection;

    // Analysis mapping
    analyticalMemberIds: string[];  // IDs of generated analytical members
    analyticalNodeIds: string[];    // IDs of intermediate nodes

    // Properties
    releases?: {
        startMoment: boolean;
        endMoment: boolean;
    };
    startOffset?: Vector3;
    endOffset?: Vector3;

    // Metadata
    color?: string;
    layer?: string;
    locked?: boolean;
}

export interface Intersection {
    point: Vector3;
    member1Id: string;
    member2Id: string;
    t1: number;  // Parameter along member 1 (0-1)
    t2: number;  // Parameter along member 2 (0-1)
}

// ============================================
// PHYSICAL MEMBER CLASS
// ============================================

export class PhysicalMemberManager {
    private physicalMembers: Map<string, PhysicalMember> = new Map();
    private tolerance: number = 0.001; // 1mm tolerance for intersections

    constructor() { }

    /**
     * Add a physical member
     */
    addPhysicalMember(member: Omit<PhysicalMember, 'analyticalMemberIds' | 'analyticalNodeIds'>): PhysicalMember {
        const fullMember: PhysicalMember = {
            ...member,
            analyticalMemberIds: [],
            analyticalNodeIds: []
        };
        this.physicalMembers.set(member.id, fullMember);
        return fullMember;
    }

    /**
     * Get all physical members
     */
    getAllPhysicalMembers(): PhysicalMember[] {
        return Array.from(this.physicalMembers.values());
    }

    /**
     * Get physical member by ID
     */
    getPhysicalMember(id: string): PhysicalMember | undefined {
        return this.physicalMembers.get(id);
    }

    /**
     * Update physical member
     */
    updatePhysicalMember(id: string, updates: Partial<PhysicalMember>): void {
        const member = this.physicalMembers.get(id);
        if (member) {
            Object.assign(member, updates);
        }
    }

    /**
     * Delete physical member
     */
    deletePhysicalMember(id: string): void {
        this.physicalMembers.delete(id);
    }

    /**
     * Find intersections between all physical members
     */
    findAllIntersections(): Intersection[] {
        const intersections: Intersection[] = [];
        const members = this.getAllPhysicalMembers();

        for (let i = 0; i < members.length; i++) {
            for (let j = i + 1; j < members.length; j++) {
                const intersection = this.findIntersection(members[i], members[j]);
                if (intersection) {
                    intersections.push(intersection);
                }
            }
        }

        return intersections;
    }

    /**
     * Find intersection between two members (3D line-line intersection)
     */
    findIntersection(member1: PhysicalMember, member2: PhysicalMember): Intersection | null {
        const p1 = member1.startPoint;
        const p2 = member1.endPoint;
        const p3 = member2.startPoint;
        const p4 = member2.endPoint;

        // Direction vectors
        const d1 = subtractVectors(p2, p1);
        const d2 = subtractVectors(p4, p3);
        const d3 = subtractVectors(p3, p1);

        // Check if lines are parallel
        const cross = {
            x: d1.y * d2.z - d1.z * d2.y,
            y: d1.z * d2.x - d1.x * d2.z,
            z: d1.x * d2.y - d1.y * d2.x
        };
        const crossMag = magnitude(cross);

        if (crossMag < this.tolerance) {
            // Lines are parallel - no intersection
            return null;
        }

        // Calculate parameters t1 and t2 for closest points
        const denominator = d1.x * d2.y - d1.y * d2.x;
        if (Math.abs(denominator) < this.tolerance) {
            // Try other planes
            const denom2 = d1.y * d2.z - d1.z * d2.y;
            const denom3 = d1.x * d2.z - d1.z * d2.x;

            if (Math.abs(denom2) < this.tolerance && Math.abs(denom3) < this.tolerance) {
                return null; // Lines are parallel
            }
        }

        // Use the plane where the denominator is largest
        let t1: number, t2: number;

        const denom_xy = d1.x * d2.y - d1.y * d2.x;
        const denom_xz = d1.x * d2.z - d1.z * d2.x;
        const denom_yz = d1.y * d2.z - d1.z * d2.y;

        if (Math.abs(denom_xy) >= Math.abs(denom_xz) && Math.abs(denom_xy) >= Math.abs(denom_yz)) {
            t1 = (d3.x * d2.y - d3.y * d2.x) / denom_xy;
            t2 = (d3.x * d1.y - d3.y * d1.x) / denom_xy;
        } else if (Math.abs(denom_xz) >= Math.abs(denom_yz)) {
            t1 = (d3.x * d2.z - d3.z * d2.x) / denom_xz;
            t2 = (d3.x * d1.z - d3.z * d1.x) / denom_xz;
        } else {
            t1 = (d3.y * d2.z - d3.z * d2.y) / denom_yz;
            t2 = (d3.y * d1.z - d3.z * d1.y) / denom_yz;
        }

        // Check if intersection is within both segments
        if (t1 < this.tolerance || t1 > 1 - this.tolerance ||
            t2 < this.tolerance || t2 > 1 - this.tolerance) {
            return null;
        }

        // Calculate intersection points on both lines
        const point1 = addVectors(p1, scaleVector(d1, t1));
        const point2 = addVectors(p3, scaleVector(d2, t2));

        // Check if points are close enough (lines actually intersect in 3D)
        if (distanceBetweenPoints(point1, point2) > this.tolerance) {
            return null; // Lines don't actually intersect (skew lines)
        }

        return {
            point: point1,
            member1Id: member1.id,
            member2Id: member2.id,
            t1,
            t2
        };
    }

    /**
     * Auto-mesh: Convert physical members to analytical members
     * Splits at intersections and creates intermediate nodes
     */
    autoMesh(): { nodes: Node[], members: Member[] } {
        const nodes: Node[] = [];
        const members: Member[] = [];
        const nodeMap = new Map<string, string>(); // point hash -> nodeId

        // Helper to get or create a node at a point
        const getNodeId = (point: Vector3, physicalMemberId?: string): string => {
            const hash = `${point.x.toFixed(4)},${point.y.toFixed(4)},${point.z.toFixed(4)}`;

            if (nodeMap.has(hash)) {
                return nodeMap.get(hash)!;
            }

            const nodeId = `AN_${nodes.length + 1}`;
            nodes.push({
                id: nodeId,
                x: point.x,
                y: point.y,
                z: point.z
            });
            nodeMap.set(hash, nodeId);
            return nodeId;
        };

        // Find all intersections
        const intersections = this.findAllIntersections();

        // Group intersections by member
        const memberIntersections = new Map<string, { t: number; point: Vector3; nodeId?: string }[]>();

        // Initialize with endpoints for all members
        this.physicalMembers.forEach((member, id) => {
            memberIntersections.set(id, [
                { t: 0, point: member.startPoint },
                { t: 1, point: member.endPoint }
            ]);
        });

        // Add intersection points
        for (const intersection of intersections) {
            const nodeId = getNodeId(intersection.point);

            const list1 = memberIntersections.get(intersection.member1Id)!;
            list1.push({ t: intersection.t1, point: intersection.point, nodeId });

            const list2 = memberIntersections.get(intersection.member2Id)!;
            list2.push({ t: intersection.t2, point: intersection.point, nodeId });
        }

        // Create analytical members for each physical member
        this.physicalMembers.forEach((physicalMember, physicalId) => {
            const points = memberIntersections.get(physicalId)!;

            // Sort by parameter t
            points.sort((a, b) => a.t - b.t);

            // Create nodes for each point
            for (const pt of points) {
                if (!pt.nodeId) {
                    pt.nodeId = getNodeId(pt.point, physicalId);
                }
            }

            // Create analytical members between consecutive nodes
            const analyticalMemberIds: string[] = [];
            const analyticalNodeIds: string[] = [];

            for (let i = 0; i < points.length - 1; i++) {
                const startNodeId = points[i].nodeId!;
                const endNodeId = points[i + 1].nodeId!;

                const memberId = `AM_${physicalId}_${i}`;
                members.push({
                    id: memberId,
                    startNodeId,
                    endNodeId,
                    sectionId: physicalMember.section.id,
                    E: 200e6,  // Default steel
                    A: physicalMember.section.area,
                    I: physicalMember.section.Ix,
                    releases: i === 0 ? physicalMember.releases : undefined
                });

                analyticalMemberIds.push(memberId);
                if (i > 0) {
                    analyticalNodeIds.push(startNodeId);
                }
            }

            // Update physical member with analytical mapping
            physicalMember.analyticalMemberIds = analyticalMemberIds;
            physicalMember.analyticalNodeIds = analyticalNodeIds;
        });

        return { nodes, members };
    }

    /**
     * Clear all physical members
     */
    clear(): void {
        this.physicalMembers.clear();
    }
}

// ============================================
// STRUCTURE WIZARD - TEMPLATE GENERATORS
// ============================================

export interface TrussGeneratorParams {
    type: 'pratt' | 'warren' | 'howe' | 'ktruss';
    span: number;       // Total length (m)
    height: number;     // Truss height (m)
    bays: number;       // Number of panels
    bottomChordY?: number; // Y coordinate of bottom chord
}

export interface FrameGeneratorParams {
    type: 'bay' | 'grid' | 'portal';
    spanX: number;      // Bay width X (m)
    spanY: number;      // Bay width Y (m)
    height: number;     // Story height (m)
    nBaysX: number;     // Number of bays in X
    nBaysY: number;     // Number of bays in Y
    nStories: number;   // Number of stories
}

export interface ShellGeneratorParams {
    type: 'cylindrical' | 'spherical' | 'dome';
    radius: number;     // Radius (m)
    span?: number;      // For cylindrical: length
    divisions: number;  // Number of segments
    angleDegrees?: number; // Sector angle
}

export class StructureWizard {
    /**
     * Generate a truss structure
     */
    static generateTruss(params: TrussGeneratorParams): { nodes: Node[], members: Member[] } {
        const nodes: Node[] = [];
        const members: Member[] = [];
        const baseY = params.bottomChordY ?? 0;
        const panelWidth = params.span / params.bays;

        // Create bottom chord nodes
        for (let i = 0; i <= params.bays; i++) {
            nodes.push({
                id: `TB${i}`,
                x: i * panelWidth,
                y: baseY,
                z: 0,
                restraints: i === 0 ? { fx: true, fy: true, fz: true, mx: false, my: false, mz: false } :
                    i === params.bays ? { fx: false, fy: true, fz: true, mx: false, my: false, mz: false } : undefined
            });
        }

        // Create top chord nodes
        for (let i = 0; i <= params.bays; i++) {
            nodes.push({
                id: `TT${i}`,
                x: i * panelWidth,
                y: baseY + params.height,
                z: 0
            });
        }

        // Bottom chord members
        for (let i = 0; i < params.bays; i++) {
            members.push({
                id: `BC${i}`,
                startNodeId: `TB${i}`,
                endNodeId: `TB${i + 1}`,
                sectionId: 'default'
            });
        }

        // Top chord members
        for (let i = 0; i < params.bays; i++) {
            members.push({
                id: `TC${i}`,
                startNodeId: `TT${i}`,
                endNodeId: `TT${i + 1}`,
                sectionId: 'default'
            });
        }

        // Verticals
        for (let i = 0; i <= params.bays; i++) {
            members.push({
                id: `V${i}`,
                startNodeId: `TB${i}`,
                endNodeId: `TT${i}`,
                sectionId: 'default'
            });
        }

        // Diagonals based on type
        switch (params.type) {
            case 'pratt':
                // Pratt: Diagonals slope toward center
                for (let i = 0; i < params.bays; i++) {
                    if (i < params.bays / 2) {
                        members.push({
                            id: `D${i}`,
                            startNodeId: `TB${i}`,
                            endNodeId: `TT${i + 1}`,
                            sectionId: 'default'
                        });
                    } else {
                        members.push({
                            id: `D${i}`,
                            startNodeId: `TB${i + 1}`,
                            endNodeId: `TT${i}`,
                            sectionId: 'default'
                        });
                    }
                }
                break;

            case 'warren':
                // Warren: Alternating diagonals, no verticals in middle
                for (let i = 0; i < params.bays; i++) {
                    if (i % 2 === 0) {
                        members.push({
                            id: `D${i}`,
                            startNodeId: `TB${i}`,
                            endNodeId: `TT${i + 1}`,
                            sectionId: 'default'
                        });
                    } else {
                        members.push({
                            id: `D${i}`,
                            startNodeId: `TT${i}`,
                            endNodeId: `TB${i + 1}`,
                            sectionId: 'default'
                        });
                    }
                }
                break;

            case 'howe':
                // Howe: Diagonals slope away from center
                for (let i = 0; i < params.bays; i++) {
                    if (i < params.bays / 2) {
                        members.push({
                            id: `D${i}`,
                            startNodeId: `TT${i}`,
                            endNodeId: `TB${i + 1}`,
                            sectionId: 'default'
                        });
                    } else {
                        members.push({
                            id: `D${i}`,
                            startNodeId: `TB${i}`,
                            endNodeId: `TT${i + 1}`,
                            sectionId: 'default'
                        });
                    }
                }
                break;

            case 'ktruss':
                // K-Truss: Two diagonals per panel forming K shape
                for (let i = 0; i < params.bays; i++) {
                    // Add middle node
                    const midNodeId = `TM${i}`;
                    nodes.push({
                        id: midNodeId,
                        x: (i + 0.5) * panelWidth,
                        y: baseY + params.height / 2,
                        z: 0
                    });

                    members.push({
                        id: `D${i}a`,
                        startNodeId: `TB${i}`,
                        endNodeId: midNodeId,
                        sectionId: 'default'
                    });
                    members.push({
                        id: `D${i}b`,
                        startNodeId: midNodeId,
                        endNodeId: `TT${i + 1}`,
                        sectionId: 'default'
                    });
                    members.push({
                        id: `D${i}c`,
                        startNodeId: `TB${i + 1}`,
                        endNodeId: midNodeId,
                        sectionId: 'default'
                    });
                    members.push({
                        id: `D${i}d`,
                        startNodeId: midNodeId,
                        endNodeId: `TT${i}`,
                        sectionId: 'default'
                    });
                }
                break;
        }

        return { nodes, members };
    }

    /**
     * Generate a frame structure
     */
    static generateFrame(params: FrameGeneratorParams): { nodes: Node[], members: Member[] } {
        const nodes: Node[] = [];
        const members: Member[] = [];

        // Generate nodes
        for (let z = 0; z <= params.nStories; z++) {
            for (let y = 0; y <= params.nBaysY; y++) {
                for (let x = 0; x <= params.nBaysX; x++) {
                    const nodeId = `N${x}_${y}_${z}`;
                    nodes.push({
                        id: nodeId,
                        x: x * params.spanX,
                        y: z * params.height,
                        z: y * params.spanY,
                        restraints: z === 0 ? {
                            fx: true, fy: true, fz: true,
                            mx: true, my: true, mz: true
                        } : undefined
                    });
                }
            }
        }

        // Generate columns (vertical members)
        for (let z = 0; z < params.nStories; z++) {
            for (let y = 0; y <= params.nBaysY; y++) {
                for (let x = 0; x <= params.nBaysX; x++) {
                    members.push({
                        id: `COL_${x}_${y}_${z}`,
                        startNodeId: `N${x}_${y}_${z}`,
                        endNodeId: `N${x}_${y}_${z + 1}`,
                        sectionId: 'column'
                    });
                }
            }
        }

        // Generate beams in X direction
        for (let z = 1; z <= params.nStories; z++) {
            for (let y = 0; y <= params.nBaysY; y++) {
                for (let x = 0; x < params.nBaysX; x++) {
                    members.push({
                        id: `BX_${x}_${y}_${z}`,
                        startNodeId: `N${x}_${y}_${z}`,
                        endNodeId: `N${x + 1}_${y}_${z}`,
                        sectionId: 'beam'
                    });
                }
            }
        }

        // Generate beams in Y direction (if grid frame)
        if (params.type === 'grid') {
            for (let z = 1; z <= params.nStories; z++) {
                for (let y = 0; y < params.nBaysY; y++) {
                    for (let x = 0; x <= params.nBaysX; x++) {
                        members.push({
                            id: `BY_${x}_${y}_${z}`,
                            startNodeId: `N${x}_${y}_${z}`,
                            endNodeId: `N${x}_${y + 1}_${z}`,
                            sectionId: 'beam'
                        });
                    }
                }
            }
        }

        return { nodes, members };
    }

    /**
     * Generate a shell/surface structure
     */
    static generateShell(params: ShellGeneratorParams): { nodes: Node[], members: Member[] } {
        const nodes: Node[] = [];
        const members: Member[] = [];

        switch (params.type) {
            case 'cylindrical': {
                const span = params.span ?? params.radius * 2;
                const angle = degToRad(params.angleDegrees ?? 180);
                const nCirc = params.divisions;
                const nLong = Math.ceil(span / (params.radius * angle / nCirc));

                // Generate nodes on cylindrical surface
                for (let i = 0; i <= nLong; i++) {
                    for (let j = 0; j <= nCirc; j++) {
                        const theta = -angle / 2 + (angle * j / nCirc);
                        nodes.push({
                            id: `SN${i}_${j}`,
                            x: i * (span / nLong),
                            y: params.radius * Math.cos(theta),
                            z: params.radius * Math.sin(theta),
                            restraints: i === 0 || i === nLong ? {
                                fx: true, fy: true, fz: true,
                                mx: false, my: false, mz: false
                            } : undefined
                        });
                    }
                }

                // Longitudinal members
                for (let i = 0; i < nLong; i++) {
                    for (let j = 0; j <= nCirc; j++) {
                        members.push({
                            id: `SL${i}_${j}`,
                            startNodeId: `SN${i}_${j}`,
                            endNodeId: `SN${i + 1}_${j}`,
                            sectionId: 'default'
                        });
                    }
                }

                // Circumferential members
                for (let i = 0; i <= nLong; i++) {
                    for (let j = 0; j < nCirc; j++) {
                        members.push({
                            id: `SC${i}_${j}`,
                            startNodeId: `SN${i}_${j}`,
                            endNodeId: `SN${i}_${j + 1}`,
                            sectionId: 'default'
                        });
                    }
                }

                // Diagonal bracing
                for (let i = 0; i < nLong; i++) {
                    for (let j = 0; j < nCirc; j++) {
                        members.push({
                            id: `SD${i}_${j}`,
                            startNodeId: `SN${i}_${j}`,
                            endNodeId: `SN${i + 1}_${j + 1}`,
                            sectionId: 'default'
                        });
                    }
                }
                break;
            }

            case 'spherical':
            case 'dome': {
                const nMeridian = params.divisions;
                const nParallel = Math.ceil(params.divisions / 2);
                const maxAngle = degToRad(params.angleDegrees ?? 90);

                // Apex node
                nodes.push({
                    id: 'APEX',
                    x: 0,
                    y: params.radius,
                    z: 0
                });

                // Generate nodes on spherical surface
                for (let i = 1; i <= nParallel; i++) {
                    const phi = maxAngle * i / nParallel;
                    const y = params.radius * Math.cos(phi);
                    const ringRadius = params.radius * Math.sin(phi);

                    for (let j = 0; j < nMeridian; j++) {
                        const theta = (2 * Math.PI * j) / nMeridian;
                        nodes.push({
                            id: `DN${i}_${j}`,
                            x: ringRadius * Math.cos(theta),
                            y: y,
                            z: ringRadius * Math.sin(theta),
                            restraints: i === nParallel ? {
                                fx: true, fy: true, fz: true,
                                mx: false, my: false, mz: false
                            } : undefined
                        });
                    }
                }

                // Connect apex to first ring
                for (let j = 0; j < nMeridian; j++) {
                    members.push({
                        id: `DA_${j}`,
                        startNodeId: 'APEX',
                        endNodeId: `DN1_${j}`,
                        sectionId: 'default'
                    });
                }

                // Meridional members (radial)
                for (let i = 1; i < nParallel; i++) {
                    for (let j = 0; j < nMeridian; j++) {
                        members.push({
                            id: `DM${i}_${j}`,
                            startNodeId: `DN${i}_${j}`,
                            endNodeId: `DN${i + 1}_${j}`,
                            sectionId: 'default'
                        });
                    }
                }

                // Parallel members (rings)
                for (let i = 1; i <= nParallel; i++) {
                    for (let j = 0; j < nMeridian; j++) {
                        const nextJ = (j + 1) % nMeridian;
                        members.push({
                            id: `DP${i}_${j}`,
                            startNodeId: `DN${i}_${j}`,
                            endNodeId: `DN${i}_${nextJ}`,
                            sectionId: 'default'
                        });
                    }
                }
                break;
            }
        }

        return { nodes, members };
    }
}

// ============================================
// INTEROPERABILITY - DXF IMPORT
// ============================================

export interface DXFEntity {
    type: string;
    layer?: string;
    startPoint?: Vector3;
    endPoint?: Vector3;
    vertices?: Vector3[];
}

export class DXFImporter {
    /**
     * Parse DXF file content and extract LINE entities
     */
    static parse(dxfContent: string): DXFEntity[] {
        const entities: DXFEntity[] = [];
        const lines = dxfContent.split('\n').map(l => l.trim());

        let i = 0;
        let inEntities = false;
        let currentEntity: Partial<DXFEntity> | null = null;

        while (i < lines.length) {
            const code = parseInt(lines[i]);
            const value = lines[i + 1];

            // Look for ENTITIES section
            if (code === 2 && value === 'ENTITIES') {
                inEntities = true;
                i += 2;
                continue;
            }

            // End of ENTITIES section
            if (code === 0 && value === 'ENDSEC' && inEntities) {
                if (currentEntity && currentEntity.type) {
                    entities.push(currentEntity as DXFEntity);
                }
                break;
            }

            if (!inEntities) {
                i += 2;
                continue;
            }

            // New entity
            if (code === 0) {
                if (currentEntity && currentEntity.type) {
                    entities.push(currentEntity as DXFEntity);
                }
                currentEntity = { type: value };
                i += 2;
                continue;
            }

            if (currentEntity) {
                switch (code) {
                    case 8: // Layer
                        currentEntity.layer = value;
                        break;
                    case 10: // Start X
                        if (!currentEntity.startPoint) currentEntity.startPoint = { x: 0, y: 0, z: 0 };
                        currentEntity.startPoint.x = parseFloat(value);
                        break;
                    case 20: // Start Y
                        if (!currentEntity.startPoint) currentEntity.startPoint = { x: 0, y: 0, z: 0 };
                        currentEntity.startPoint.y = parseFloat(value);
                        break;
                    case 30: // Start Z
                        if (!currentEntity.startPoint) currentEntity.startPoint = { x: 0, y: 0, z: 0 };
                        currentEntity.startPoint.z = parseFloat(value);
                        break;
                    case 11: // End X
                        if (!currentEntity.endPoint) currentEntity.endPoint = { x: 0, y: 0, z: 0 };
                        currentEntity.endPoint.x = parseFloat(value);
                        break;
                    case 21: // End Y
                        if (!currentEntity.endPoint) currentEntity.endPoint = { x: 0, y: 0, z: 0 };
                        currentEntity.endPoint.y = parseFloat(value);
                        break;
                    case 31: // End Z
                        if (!currentEntity.endPoint) currentEntity.endPoint = { x: 0, y: 0, z: 0 };
                        currentEntity.endPoint.z = parseFloat(value);
                        break;
                }
            }

            i += 2;
        }

        return entities.filter(e => e.type === 'LINE');
    }

    /**
     * Convert DXF entities to structural model
     */
    static toStructuralModel(entities: DXFEntity[]): { nodes: Node[], members: Member[] } {
        const nodes: Node[] = [];
        const members: Member[] = [];
        const nodeMap = new Map<string, string>();

        const getNodeId = (point: Vector3): string => {
            const hash = `${point.x.toFixed(4)},${point.y.toFixed(4)},${point.z.toFixed(4)}`;
            if (nodeMap.has(hash)) {
                return nodeMap.get(hash)!;
            }
            const nodeId = `N${nodes.length + 1}`;
            nodes.push({ id: nodeId, x: point.x, y: point.y, z: point.z });
            nodeMap.set(hash, nodeId);
            return nodeId;
        };

        for (let i = 0; i < entities.length; i++) {
            const entity = entities[i];
            if (entity.startPoint && entity.endPoint) {
                const startNodeId = getNodeId(entity.startPoint);
                const endNodeId = getNodeId(entity.endPoint);

                members.push({
                    id: `M${i + 1}`,
                    startNodeId,
                    endNodeId,
                    sectionId: entity.layer || 'default'
                });
            }
        }

        return { nodes, members };
    }
}

// ============================================
// INTEROPERABILITY - IFC EXPORT
// ============================================

export interface IFCBeam {
    globalId: string;
    name: string;
    objectType: string;
    representation: {
        type: string;
        startPoint: [number, number, number];
        endPoint: [number, number, number];
    };
    profile: {
        type: string;
        width: number;
        height: number;
    };
    material: string;
}

export interface IFCModel {
    schema: string;
    header: {
        fileName: string;
        timestamp: string;
        author: string;
        organization: string;
        application: string;
    };
    project: {
        globalId: string;
        name: string;
        description: string;
    };
    site: {
        globalId: string;
        name: string;
    };
    building: {
        globalId: string;
        name: string;
    };
    storey: {
        globalId: string;
        name: string;
        elevation: number;
    };
    beams: IFCBeam[];
}

export class IFCExporter {
    private static generateGUID(): string {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

    /**
     * Export physical members to IFC-compatible JSON
     */
    static exportToIFC(
        physicalMembers: PhysicalMember[],
        projectName: string = 'BeamLab Project'
    ): IFCModel {
        const model: IFCModel = {
            schema: 'IFC4',
            header: {
                fileName: `${projectName}.ifc`,
                timestamp: new Date().toISOString(),
                author: 'BeamLab',
                organization: 'BeamLab',
                application: 'BeamLab v1.0'
            },
            project: {
                globalId: this.generateGUID(),
                name: projectName,
                description: 'Structural model exported from BeamLab'
            },
            site: {
                globalId: this.generateGUID(),
                name: 'Default Site'
            },
            building: {
                globalId: this.generateGUID(),
                name: 'Default Building'
            },
            storey: {
                globalId: this.generateGUID(),
                name: 'Ground Floor',
                elevation: 0
            },
            beams: []
        };

        for (const member of physicalMembers) {
            const ifcBeam: IFCBeam = {
                globalId: this.generateGUID(),
                name: member.name || member.id,
                objectType: 'IfcBeam',
                representation: {
                    type: 'SweptSolid',
                    startPoint: [member.startPoint.x, member.startPoint.y, member.startPoint.z],
                    endPoint: [member.endPoint.x, member.endPoint.y, member.endPoint.z]
                },
                profile: {
                    type: 'IfcRectangleProfileDef',
                    width: member.section.width,
                    height: member.section.height
                },
                material: member.section.material
            };
            model.beams.push(ifcBeam);
        }

        return model;
    }

    /**
     * Export to IFC JSON string
     */
    static toJSON(model: IFCModel): string {
        return JSON.stringify(model, null, 2);
    }
}

// ============================================
// EXPORT ALL
// ============================================

export default {
    PhysicalMemberManager,
    StructureWizard,
    DXFImporter,
    IFCExporter
};
