/**
 * CommandParser - Parse STAAD-like text commands
 * Supports bidirectional conversion: text <-> model state
 */

import { Node, Member, NodeLoad, MemberLoad } from '../store/model';

// ============================================
// TYPES & INTERFACES
// ============================================

export type ActionType =
    | 'ADD_NODE'
    | 'ADD_MEMBER'
    | 'SET_PROPERTY'
    | 'SET_SUPPORT'
    | 'ADD_LOAD'
    | 'ADD_MEMBER_LOAD'
    | 'SET_MATERIAL'
    | 'UNKNOWN';

export interface ParsedAction {
    type: ActionType;
    data: Record<string, any>;
    line: number;
    raw: string;
}

export interface ModelState {
    nodes: Map<string, Node>;
    members: Map<string, Member>;
    loads: NodeLoad[];
    memberLoads: MemberLoad[];
}

// ============================================
// REGEX PATTERNS
// ============================================

const PATTERNS = {
    // JOINT COORDINATES
    // Format: JOINT COORDINATES 1 0 0 0; 2 5 0 0; ...
    // Or: 1 0.0 0.0 0.0
    jointCoordinates: /^(?:JOINT\s+COORDINATES?\s*)?(\d+)\s+([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s*;?$/i,

    // Alternate: NODE <id> <x> <y> <z>
    nodeAlternate: /^NODE\s+(\d+)\s+([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s*$/i,

    // MEMBER INCIDENCES
    // Format: MEMBER INCIDENCES 1 1 2; 2 2 3; ...
    // Or: 1 1 2
    memberIncidences: /^(?:MEMBER\s+INCIDENCES?\s*)?(\d+)\s+(\d+)\s+(\d+)\s*;?$/i,

    // Alternate: ELEMENT <id> <start> <end>
    elementAlternate: /^ELEMENT\s+(\d+)\s+(\d+)\s+(\d+)\s*$/i,

    // MEMBER PROPERTY AMERICAN
    // Format: MEMBER PROPERTY AMERICAN 1 TO 5 TABLE ST W14X30
    memberPropertyAmerican: /^MEMBER\s+PROPERTY\s+AMERICAN\s+([\d\s,TO]+)\s+TABLE\s+ST\s+(\S+)\s*$/i,

    // MEMBER PROPERTY (Indian)
    // Format: MEMBER PROPERTY INDIAN 1 TO 5 TABLE ST ISMB200
    memberPropertyIndian: /^MEMBER\s+PROPERTY\s+INDIAN\s+([\d\s,TO]+)\s+TABLE\s+ST\s+(\S+)\s*$/i,

    // SUPPORT
    // Format: SUPPORT 1 FIXED; 2 PINNED; 3 ROLLER
    support: /^SUPPORT(?:S)?\s+(\d+)\s+(FIXED|PINNED|ROLLER|HINGED)\s*;?$/i,

    // NODE LOAD
    // Format: JOINT LOAD 1 FY -10
    jointLoad: /^(?:JOINT|NODE)\s+LOAD\s+(\d+)\s+(FX|FY|FZ|MX|MY|MZ)\s+([-\d.]+)\s*$/i,

    // MEMBER LOAD (UDL)
    // Format: MEMBER LOAD 1 UNI GY -5
    memberLoadUni: /^MEMBER\s+LOAD\s+(\d+)\s+UNI(?:FORM)?\s+(GX|GY|GZ|LX|LY|LZ)\s+([-\d.]+)\s*$/i,

    // MEMBER LOAD (Concentrated)
    // Format: MEMBER LOAD 1 CON GY -10 0.5
    memberLoadCon: /^MEMBER\s+LOAD\s+(\d+)\s+CON(?:CENTRATED)?\s+(GX|GY|GZ|LX|LY|LZ)\s+([-\d.]+)\s+([-\d.]+)\s*$/i,

    // MATERIAL (E, G, density)
    // Format: CONSTANTS E 200000 ALL
    constantsE: /^CONSTANTS?\s+E\s+([-\d.eE+]+)(?:\s+ALL)?\s*$/i,

    // Comment
    comment: /^\s*[*;#]/,

    // Section header
    sectionHeader: /^(JOINT\s+COORDINATES|MEMBER\s+INCIDENCES|MEMBER\s+PROPERTY|SUPPORTS?|LOADING|MEMBER\s+LOAD|JOINT\s+LOAD|CONSTANTS)$/i,
};

// ============================================
// COMMAND PARSER
// ============================================

export class CommandParser {
    private currentSection: string = '';

    /**
     * Parse script text into list of actions
     */
    parse(script: string): ParsedAction[] {
        const actions: ParsedAction[] = [];
        const lines = script.split(/\r?\n/);

        for (let i = 0; i < lines.length; i++) {
            const raw = lines[i]!.trim();
            if (!raw || PATTERNS.comment.test(raw)) continue;

            // Check for section headers
            if (PATTERNS.sectionHeader.test(raw)) {
                this.currentSection = raw.toUpperCase();
                continue;
            }

            const action = this.parseLine(raw, i + 1);
            if (action) {
                actions.push(action);
            }
        }

        return actions;
    }

    /**
     * Parse single line
     */
    private parseLine(line: string, lineNum: number): ParsedAction | null {
        let match: RegExpMatchArray | null;

        // Joint Coordinates
        match = line.match(PATTERNS.jointCoordinates) || line.match(PATTERNS.nodeAlternate);
        if (match || (this.currentSection.includes('JOINT COORD') && /^\d+\s+[-\d.]+/.test(line))) {
            if (!match) {
                const parts = line.split(/\s+/);
                if (parts.length >= 4) {
                    return {
                        type: 'ADD_NODE',
                        data: {
                            id: parts[0],
                            x: parseFloat(parts[1]!),
                            y: parseFloat(parts[2]!),
                            z: parseFloat(parts[3]!)
                        },
                        line: lineNum,
                        raw: line
                    };
                }
            } else {
                return {
                    type: 'ADD_NODE',
                    data: {
                        id: match[1],
                        x: parseFloat(match[2]!),
                        y: parseFloat(match[3]!),
                        z: parseFloat(match[4]!)
                    },
                    line: lineNum,
                    raw: line
                };
            }
        }

        // Member Incidences
        match = line.match(PATTERNS.memberIncidences) || line.match(PATTERNS.elementAlternate);
        if (match || (this.currentSection.includes('MEMBER INCID') && /^\d+\s+\d+\s+\d+/.test(line))) {
            if (!match) {
                const parts = line.split(/\s+/);
                if (parts.length >= 3) {
                    return {
                        type: 'ADD_MEMBER',
                        data: {
                            id: parts[0],
                            startNodeId: parts[1],
                            endNodeId: parts[2]
                        },
                        line: lineNum,
                        raw: line
                    };
                }
            } else {
                return {
                    type: 'ADD_MEMBER',
                    data: {
                        id: match[1],
                        startNodeId: match[2],
                        endNodeId: match[3]
                    },
                    line: lineNum,
                    raw: line
                };
            }
        }

        // Member Property (American)
        match = line.match(PATTERNS.memberPropertyAmerican);
        if (match) {
            const memberIds = this.parseIdRange(match[1]!);
            return {
                type: 'SET_PROPERTY',
                data: {
                    memberIds,
                    sectionName: match[2],
                    standard: 'AMERICAN'
                },
                line: lineNum,
                raw: line
            };
        }

        // Member Property (Indian)
        match = line.match(PATTERNS.memberPropertyIndian);
        if (match) {
            const memberIds = this.parseIdRange(match[1]!);
            return {
                type: 'SET_PROPERTY',
                data: {
                    memberIds,
                    sectionName: match[2],
                    standard: 'INDIAN'
                },
                line: lineNum,
                raw: line
            };
        }

        // Support
        match = line.match(PATTERNS.support);
        if (match) {
            return {
                type: 'SET_SUPPORT',
                data: {
                    nodeId: match[1],
                    type: match[2]!.toUpperCase()
                },
                line: lineNum,
                raw: line
            };
        }

        // Joint Load
        match = line.match(PATTERNS.jointLoad);
        if (match) {
            const direction = match[2]!.toUpperCase();
            return {
                type: 'ADD_LOAD',
                data: {
                    nodeId: match[1],
                    fx: direction === 'FX' ? parseFloat(match[3]!) : 0,
                    fy: direction === 'FY' ? parseFloat(match[3]!) : 0,
                    fz: direction === 'FZ' ? parseFloat(match[3]!) : 0,
                    mx: direction === 'MX' ? parseFloat(match[3]!) : 0,
                    my: direction === 'MY' ? parseFloat(match[3]!) : 0,
                    mz: direction === 'MZ' ? parseFloat(match[3]!) : 0,
                },
                line: lineNum,
                raw: line
            };
        }

        // Member Uniform Load
        match = line.match(PATTERNS.memberLoadUni);
        if (match) {
            return {
                type: 'ADD_MEMBER_LOAD',
                data: {
                    memberId: match[1],
                    type: 'UDL',
                    direction: match[2]!.toUpperCase(),
                    w1: parseFloat(match[3]!)
                },
                line: lineNum,
                raw: line
            };
        }

        // Member Concentrated Load
        match = line.match(PATTERNS.memberLoadCon);
        if (match) {
            return {
                type: 'ADD_MEMBER_LOAD',
                data: {
                    memberId: match[1],
                    type: 'point',
                    direction: match[2]!.toUpperCase(),
                    P: parseFloat(match[3]!),
                    a: parseFloat(match[4]!)
                },
                line: lineNum,
                raw: line
            };
        }

        // Material Constants
        match = line.match(PATTERNS.constantsE);
        if (match) {
            return {
                type: 'SET_MATERIAL',
                data: {
                    E: parseFloat(match[1]!)
                },
                line: lineNum,
                raw: line
            };
        }

        return null;
    }

    /**
     * Parse ID range like "1 TO 5" or "1, 3, 5" into array
     */
    private parseIdRange(rangeStr: string): string[] {
        const ids: string[] = [];
        const parts = rangeStr.trim().split(/,/);

        for (const part of parts) {
            const trimmed = part.trim();
            if (trimmed.includes('TO')) {
                const [startStr, endStr] = trimmed.split(/\s+TO\s+/i);
                const start = parseInt(startStr!);
                const end = parseInt(endStr!);
                for (let i = start; i <= end; i++) {
                    ids.push(i.toString());
                }
            } else {
                ids.push(trimmed);
            }
        }

        return ids;
    }

    /**
     * Serialize model state back to text format
     */
    serialize(state: ModelState): string {
        const lines: string[] = [];

        // Header
        lines.push('* Generated by BeamLab Ultimate');
        lines.push(`* Date: ${new Date().toISOString()}`);
        lines.push('');

        // Joint Coordinates
        if (state.nodes.size > 0) {
            lines.push('JOINT COORDINATES');
            state.nodes.forEach((node, id) => {
                lines.push(`${id} ${node.x.toFixed(3)} ${node.y.toFixed(3)} ${node.z.toFixed(3)}`);
            });
            lines.push('');
        }

        // Member Incidences
        if (state.members.size > 0) {
            lines.push('MEMBER INCIDENCES');
            state.members.forEach((member, id) => {
                lines.push(`${id} ${member.startNodeId} ${member.endNodeId}`);
            });
            lines.push('');
        }

        // Supports
        const supportedNodes: string[] = [];
        state.nodes.forEach((node, id) => {
            if (node.restraints) {
                const r = node.restraints;
                const isFixed = r.fx && r.fy && r.fz && r.mx && r.my && r.mz;
                const isPinned = r.fx && r.fy && r.fz && !r.mx && !r.my && !r.mz;
                const isRoller = !r.fx && r.fy && !r.fz;

                if (isFixed) supportedNodes.push(`${id} FIXED`);
                else if (isPinned) supportedNodes.push(`${id} PINNED`);
                else if (isRoller) supportedNodes.push(`${id} ROLLER`);
            }
        });

        if (supportedNodes.length > 0) {
            lines.push('SUPPORTS');
            supportedNodes.forEach(s => lines.push(s));
            lines.push('');
        }

        // Joint Loads
        if (state.loads.length > 0) {
            lines.push('JOINT LOAD');
            state.loads.forEach(load => {
                if (load.fx) lines.push(`${load.nodeId} FX ${load.fx}`);
                if (load.fy) lines.push(`${load.nodeId} FY ${load.fy}`);
                if (load.fz) lines.push(`${load.nodeId} FZ ${load.fz}`);
            });
            lines.push('');
        }

        // Member Loads
        if (state.memberLoads.length > 0) {
            lines.push('MEMBER LOAD');
            state.memberLoads.forEach(load => {
                if (load.type === 'UDL') {
                    lines.push(`${load.memberId} UNI ${load.direction.toUpperCase()} ${load.w1}`);
                } else if (load.type === 'point') {
                    lines.push(`${load.memberId} CON ${load.direction.toUpperCase()} ${load.P} ${load.a}`);
                }
            });
            lines.push('');
        }

        lines.push('PERFORM ANALYSIS');
        lines.push('FINISH');

        return lines.join('\n');
    }

    /**
     * Validate script syntax
     */
    validate(script: string): { valid: boolean; errors: Array<{ line: number; message: string }> } {
        const errors: Array<{ line: number; message: string }> = [];
        const lines = script.split(/\r?\n/);

        let hasNodes = false;
        let hasMembers = false;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i]!.trim();
            if (!line || PATTERNS.comment.test(line)) continue;
            if (PATTERNS.sectionHeader.test(line)) continue;

            const action = this.parseLine(line, i + 1);
            if (!action) {
                errors.push({ line: i + 1, message: `Unrecognized command: ${line}` });
            } else {
                if (action.type === 'ADD_NODE') hasNodes = true;
                if (action.type === 'ADD_MEMBER') hasMembers = true;
            }
        }

        if (!hasNodes) {
            errors.push({ line: 0, message: 'No joint coordinates defined' });
        }
        if (!hasMembers) {
            errors.push({ line: 0, message: 'No member incidences defined' });
        }

        return { valid: errors.length === 0, errors };
    }
}

export default CommandParser;
