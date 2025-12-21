/**
 * ConnectionDetector - Automatic Connection Type Detection
 * Analyzes structural model and identifies connection types at nodes
 */

import { Node, Member, Restraints } from '../store/model';

// ============================================
// TYPES & INTERFACES
// ============================================

export type ConnectionType =
    | 'BEAM_COLUMN'      // Beam framing into column
    | 'BEAM_BEAM_SPLICE' // Beam splice (collinear beams)
    | 'BEAM_BEAM_CORNER' // Beam corner/angle
    | 'COLUMN_SPLICE'    // Column splice
    | 'BASE_PLATE'       // Column base at support
    | 'TRUSS_JOINT'      // Truss node (multiple angles)
    | 'CANTILEVER_END'   // Free end of cantilever
    | 'SIMPLE_SUPPORT'   // Support with single member
    | 'CONTINUOUS'       // Continuous beam over support
    | 'UNKNOWN';

export type MemberOrientation = 'VERTICAL' | 'HORIZONTAL' | 'INCLINED';
export type MemberType = 'COLUMN' | 'BEAM' | 'BRACE' | 'UNKNOWN';

export interface ConnectionInfo {
    nodeId: string;
    connectionType: ConnectionType;
    connectedMembers: Array<{
        memberId: string;
        memberType: MemberType;
        orientation: MemberOrientation;
        angle: number;  // Angle from horizontal (degrees)
    }>;
    hasSupport: boolean;
    supportType?: 'FIXED' | 'PINNED' | 'ROLLER';
}

export interface DetectionResult {
    connections: Map<string, ConnectionInfo>;
    summary: ConnectionSummary;
}

export interface ConnectionSummary {
    total: number;
    beamColumn: number;
    splices: number;
    basePlates: number;
    trussJoints: number;
    other: number;
}

// ============================================
// CONNECTION DETECTOR
// ============================================

export class ConnectionDetector {
    // Tolerance for angle comparisons (degrees)
    static readonly ANGLE_TOLERANCE = 5;
    static readonly VERTICAL_TOLERANCE = 15;  // degrees from vertical
    static readonly HORIZONTAL_TOLERANCE = 15;  // degrees from horizontal

    /**
     * Detect all connection types in the model
     */
    static detect(
        nodes: Map<string, Node>,
        members: Map<string, Member>
    ): DetectionResult {
        const connections = new Map<string, ConnectionInfo>();

        // Build node-to-members map
        const nodeMemberMap = this.buildNodeMemberMap(members);

        // Analyze each node
        for (const [nodeId, node] of nodes) {
            const connectedMemberIds = nodeMemberMap.get(nodeId) ?? [];
            const connectedMembers = this.analyzeMembersAtNode(
                nodeId,
                connectedMemberIds,
                members,
                nodes
            );

            const hasSupport = this.hasRestraint(node);
            const supportType = this.getSupportType(node);

            const connectionType = this.classifyConnection(
                connectedMembers,
                hasSupport
            );

            connections.set(nodeId, {
                nodeId,
                connectionType,
                connectedMembers,
                hasSupport,
                supportType
            });
        }

        const summary = this.calculateSummary(connections);

        return { connections, summary };
    }

    /**
     * Build map of node ID -> connected member IDs
     */
    private static buildNodeMemberMap(members: Map<string, Member>): Map<string, string[]> {
        const map = new Map<string, string[]>();

        for (const [memberId, member] of members) {
            // Start node
            const startList = map.get(member.startNodeId) ?? [];
            startList.push(memberId);
            map.set(member.startNodeId, startList);

            // End node
            const endList = map.get(member.endNodeId) ?? [];
            endList.push(memberId);
            map.set(member.endNodeId, endList);
        }

        return map;
    }

    /**
     * Analyze all members connected to a node
     */
    private static analyzeMembersAtNode(
        nodeId: string,
        memberIds: string[],
        members: Map<string, Member>,
        nodes: Map<string, Node>
    ): ConnectionInfo['connectedMembers'] {
        const result: ConnectionInfo['connectedMembers'] = [];

        for (const memberId of memberIds) {
            const member = members.get(memberId);
            if (!member) continue;

            const startNode = nodes.get(member.startNodeId);
            const endNode = nodes.get(member.endNodeId);
            if (!startNode || !endNode) continue;

            // Get the "other" node
            const otherNodeId = member.startNodeId === nodeId ? member.endNodeId : member.startNodeId;
            const thisNode = nodes.get(nodeId)!;
            const otherNode = nodes.get(otherNodeId)!;

            // Calculate direction vector
            const dx = otherNode.x - thisNode.x;
            const dy = otherNode.y - thisNode.y;
            const dz = otherNode.z - thisNode.z;

            // Calculate angle from horizontal (in XZ plane, Y is up)
            const horizontalDist = Math.sqrt(dx * dx + dz * dz);
            const angleFromHorizontal = Math.atan2(Math.abs(dy), horizontalDist) * (180 / Math.PI);

            // Determine orientation
            const orientation = this.getOrientation(angleFromHorizontal);
            const memberType = this.getMemberType(orientation, angleFromHorizontal);

            result.push({
                memberId,
                memberType,
                orientation,
                angle: angleFromHorizontal
            });
        }

        return result;
    }

    /**
     * Get member orientation from angle
     */
    private static getOrientation(angleFromHorizontal: number): MemberOrientation {
        if (angleFromHorizontal >= 90 - this.VERTICAL_TOLERANCE) {
            return 'VERTICAL';
        } else if (angleFromHorizontal <= this.HORIZONTAL_TOLERANCE) {
            return 'HORIZONTAL';
        } else {
            return 'INCLINED';
        }
    }

    /**
     * Get member type from orientation
     */
    private static getMemberType(orientation: MemberOrientation, angle: number): MemberType {
        if (orientation === 'VERTICAL') {
            return 'COLUMN';
        } else if (orientation === 'HORIZONTAL') {
            return 'BEAM';
        } else if (angle > 20 && angle < 70) {
            return 'BRACE';  // Likely a brace/diagonal
        }
        return 'UNKNOWN';
    }

    /**
     * Check if node has restraints
     */
    private static hasRestraint(node: Node): boolean {
        if (!node.restraints) return false;
        const r = node.restraints;
        return r.fx || r.fy || r.fz || r.mx || r.my || r.mz;
    }

    /**
     * Get support type from restraints
     */
    private static getSupportType(node: Node): 'FIXED' | 'PINNED' | 'ROLLER' | undefined {
        if (!node.restraints) return undefined;
        const r = node.restraints;

        const isFixed = r.fx && r.fy && r.fz && r.mx && r.my && r.mz;
        const isPinned = r.fx && r.fy && r.fz && !r.mx && !r.my && !r.mz;
        const isRoller = (!r.fx || !r.fz) && r.fy;

        if (isFixed) return 'FIXED';
        if (isPinned) return 'PINNED';
        if (isRoller) return 'ROLLER';
        return undefined;
    }

    /**
     * Classify connection type based on connected members
     */
    private static classifyConnection(
        members: ConnectionInfo['connectedMembers'],
        hasSupport: boolean
    ): ConnectionType {
        const numMembers = members.length;

        if (numMembers === 0) {
            return 'UNKNOWN';
        }

        // Count member types
        const columns = members.filter(m => m.memberType === 'COLUMN');
        const beams = members.filter(m => m.memberType === 'BEAM');
        const braces = members.filter(m => m.memberType === 'BRACE');

        // Single member with support = cantilever or simple support
        if (numMembers === 1) {
            if (hasSupport && columns.length === 1) {
                return 'BASE_PLATE';
            }
            return hasSupport ? 'SIMPLE_SUPPORT' : 'CANTILEVER_END';
        }

        // Column at support = Base Plate
        if (hasSupport && columns.length >= 1) {
            return 'BASE_PLATE';
        }

        // Beam-Column connection
        if (columns.length >= 1 && beams.length >= 1) {
            return 'BEAM_COLUMN';
        }

        // Column splice (two collinear vertical members)
        if (columns.length === 2 && beams.length === 0) {
            return 'COLUMN_SPLICE';
        }

        // Beam splice or corner
        if (beams.length === 2 && columns.length === 0) {
            // Check if collinear
            const angle1 = members[0]?.angle ?? 0;
            const angle2 = members[1]?.angle ?? 0;

            if (Math.abs(angle1 - angle2) < this.ANGLE_TOLERANCE) {
                return 'BEAM_BEAM_SPLICE';
            }
            return 'BEAM_BEAM_CORNER';
        }

        // Continuous beam over support
        if (hasSupport && beams.length >= 2) {
            return 'CONTINUOUS';
        }

        // Truss joint (multiple inclined/mixed members)
        if (braces.length >= 1 || numMembers >= 3) {
            return 'TRUSS_JOINT';
        }

        return 'UNKNOWN';
    }

    /**
     * Calculate summary statistics
     */
    private static calculateSummary(connections: Map<string, ConnectionInfo>): ConnectionSummary {
        let beamColumn = 0, splices = 0, basePlates = 0, trussJoints = 0, other = 0;

        for (const [, info] of connections) {
            switch (info.connectionType) {
                case 'BEAM_COLUMN':
                    beamColumn++;
                    break;
                case 'BEAM_BEAM_SPLICE':
                case 'COLUMN_SPLICE':
                    splices++;
                    break;
                case 'BASE_PLATE':
                    basePlates++;
                    break;
                case 'TRUSS_JOINT':
                    trussJoints++;
                    break;
                default:
                    other++;
            }
        }

        return {
            total: connections.size,
            beamColumn,
            splices,
            basePlates,
            trussJoints,
            other
        };
    }

    /**
     * Get connections of a specific type
     */
    static getByType(result: DetectionResult, type: ConnectionType): ConnectionInfo[] {
        return Array.from(result.connections.values()).filter(c => c.connectionType === type);
    }

    /**
     * Get connection info for a specific node
     */
    static getForNode(result: DetectionResult, nodeId: string): ConnectionInfo | undefined {
        return result.connections.get(nodeId);
    }

    /**
     * Format summary as string
     */
    static formatSummary(summary: ConnectionSummary): string {
        return [
            `=== Connection Detection Summary ===`,
            `Total connections: ${summary.total}`,
            ``,
            `Beam-Column:  ${summary.beamColumn}`,
            `Splices:      ${summary.splices}`,
            `Base Plates:  ${summary.basePlates}`,
            `Truss Joints: ${summary.trussJoints}`,
            `Other:        ${summary.other}`
        ].join('\n');
    }
}

export default ConnectionDetector;
