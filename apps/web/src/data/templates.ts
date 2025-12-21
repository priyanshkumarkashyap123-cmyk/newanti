/**
 * TEMPLATE_BANK - Pre-defined Structural Model Templates
 * 
 * A comprehensive library of common structural configurations.
 * Each template includes nodes, members, and default loads.
 */

// ============================================
// TYPES
// ============================================

export interface TemplateNode {
    id: string;
    x: number;
    y: number;
    z: number;
    support?: 'FIXED' | 'PINNED' | 'ROLLER' | 'NONE';
}

export interface TemplateMember {
    id: string;
    startNode: string;
    endNode: string;
    section: string;
}

export interface TemplateLoad {
    type: 'POINT' | 'UDL' | 'UVL' | 'MOMENT';
    nodeId?: string;
    memberId?: string;
    value: number;
    direction?: 'X' | 'Y' | 'Z';
}

export interface StructureTemplate {
    name: string;
    category: string;
    description: string;
    nodes: TemplateNode[];
    members: TemplateMember[];
    loads: TemplateLoad[];
    thumbnail?: string;
}

// ============================================
// HELPER FUNCTIONS FOR GENERATING TEMPLATES
// ============================================

function generateMultiStoryFrame(
    bays: number,
    stories: number,
    bayWidth: number = 6,
    storyHeight: number = 3.5
): { nodes: TemplateNode[]; members: TemplateMember[] } {
    const nodes: TemplateNode[] = [];
    const members: TemplateMember[] = [];

    let nodeId = 1;
    let memberId = 1;

    // Generate nodes
    for (let story = 0; story <= stories; story++) {
        for (let bay = 0; bay <= bays; bay++) {
            nodes.push({
                id: `n${nodeId}`,
                x: bay * bayWidth,
                y: story * storyHeight,
                z: 0,
                support: story === 0 ? 'FIXED' : 'NONE'
            });
            nodeId++;
        }
    }

    // Generate columns
    for (let story = 0; story < stories; story++) {
        for (let bay = 0; bay <= bays; bay++) {
            const bottomNode = story * (bays + 1) + bay + 1;
            const topNode = (story + 1) * (bays + 1) + bay + 1;
            members.push({
                id: `m${memberId}`,
                startNode: `n${bottomNode}`,
                endNode: `n${topNode}`,
                section: story === 0 ? 'ISMB400' : 'ISMB350'
            });
            memberId++;
        }
    }

    // Generate beams
    for (let story = 1; story <= stories; story++) {
        for (let bay = 0; bay < bays; bay++) {
            const leftNode = story * (bays + 1) + bay + 1;
            const rightNode = story * (bays + 1) + bay + 2;
            members.push({
                id: `m${memberId}`,
                startNode: `n${leftNode}`,
                endNode: `n${rightNode}`,
                section: 'ISMB300'
            });
            memberId++;
        }
    }

    return { nodes, members };
}

function generatePrattTruss(
    span: number,
    height: number,
    panels: number
): { nodes: TemplateNode[]; members: TemplateMember[] } {
    const nodes: TemplateNode[] = [];
    const members: TemplateMember[] = [];

    const panelWidth = span / panels;
    let nodeId = 1;
    let memberId = 1;

    // Bottom chord nodes
    for (let i = 0; i <= panels; i++) {
        nodes.push({
            id: `n${nodeId}`,
            x: i * panelWidth,
            y: 0,
            z: 0,
            support: i === 0 ? 'PINNED' : (i === panels ? 'ROLLER' : 'NONE')
        });
        nodeId++;
    }

    // Top chord nodes
    for (let i = 1; i < panels; i++) {
        nodes.push({
            id: `n${nodeId}`,
            x: i * panelWidth,
            y: height,
            z: 0
        });
        nodeId++;
    }

    // Bottom chord members
    for (let i = 0; i < panels; i++) {
        members.push({
            id: `m${memberId}`,
            startNode: `n${i + 1}`,
            endNode: `n${i + 2}`,
            section: 'ISA100x100x10'
        });
        memberId++;
    }

    // Top chord members
    for (let i = 0; i < panels - 2; i++) {
        members.push({
            id: `m${memberId}`,
            startNode: `n${panels + 2 + i}`,
            endNode: `n${panels + 3 + i}`,
            section: 'ISA100x100x10'
        });
        memberId++;
    }

    // Verticals and diagonals (Pratt pattern)
    for (let i = 1; i < panels; i++) {
        const bottomNode = i + 1;
        const topNode = panels + 1 + i;

        // Vertical
        members.push({
            id: `m${memberId}`,
            startNode: `n${bottomNode}`,
            endNode: `n${topNode}`,
            section: 'ISA75x75x8'
        });
        memberId++;
    }

    // End diagonals
    members.push({
        id: `m${memberId}`,
        startNode: 'n1',
        endNode: `n${panels + 2}`,
        section: 'ISA100x100x10'
    });
    memberId++;

    members.push({
        id: `m${memberId}`,
        startNode: `n${panels + 1}`,
        endNode: `n${2 * panels - 1}`,
        section: 'ISA100x100x10'
    });

    return { nodes, members };
}

// ============================================
// TEMPLATE BANK
// ============================================

export const TEMPLATE_BANK: Record<string, StructureTemplate> = {
    // ========================================
    // INDUSTRIAL STRUCTURES
    // ========================================

    WAREHOUSE_SIMPLE: {
        name: "Standard Portal Frame Warehouse",
        category: "Industrial",
        description: "Single-bay portal frame with pitched roof",
        nodes: [
            { id: "n1", x: 0, y: 0, z: 0, support: "FIXED" },
            { id: "n2", x: 0, y: 6, z: 0 },
            { id: "n3", x: 10, y: 8, z: 0 },
            { id: "n4", x: 20, y: 6, z: 0 },
            { id: "n5", x: 20, y: 0, z: 0, support: "FIXED" }
        ],
        members: [
            { id: "m1", startNode: "n1", endNode: "n2", section: "ISMB400" },
            { id: "m2", startNode: "n2", endNode: "n3", section: "ISMB300" },
            { id: "m3", startNode: "n3", endNode: "n4", section: "ISMB300" },
            { id: "m4", startNode: "n4", endNode: "n5", section: "ISMB400" }
        ],
        loads: [
            { type: "UDL", memberId: "m2", value: -5 },
            { type: "UDL", memberId: "m3", value: -5 }
        ]
    },

    WAREHOUSE_MULTI_BAY: {
        name: "Multi-Bay Industrial Warehouse",
        category: "Industrial",
        description: "3-bay portal frame warehouse with purlins",
        nodes: [
            { id: "n1", x: 0, y: 0, z: 0, support: "FIXED" },
            { id: "n2", x: 0, y: 8, z: 0 },
            { id: "n3", x: 12, y: 10, z: 0 },
            { id: "n4", x: 24, y: 8, z: 0 },
            { id: "n5", x: 24, y: 0, z: 0, support: "FIXED" },
            { id: "n6", x: 36, y: 10, z: 0 },
            { id: "n7", x: 48, y: 8, z: 0 },
            { id: "n8", x: 48, y: 0, z: 0, support: "FIXED" }
        ],
        members: [
            { id: "m1", startNode: "n1", endNode: "n2", section: "ISMB450" },
            { id: "m2", startNode: "n2", endNode: "n3", section: "ISMB350" },
            { id: "m3", startNode: "n3", endNode: "n4", section: "ISMB350" },
            { id: "m4", startNode: "n4", endNode: "n5", section: "ISMB450" },
            { id: "m5", startNode: "n4", endNode: "n6", section: "ISMB350" },
            { id: "m6", startNode: "n6", endNode: "n7", section: "ISMB350" },
            { id: "m7", startNode: "n7", endNode: "n8", section: "ISMB450" }
        ],
        loads: [
            { type: "UDL", memberId: "m2", value: -6 },
            { type: "UDL", memberId: "m3", value: -6 },
            { type: "UDL", memberId: "m5", value: -6 },
            { type: "UDL", memberId: "m6", value: -6 }
        ]
    },

    AIRCRAFT_HANGAR: {
        name: "Aircraft Hangar (Tied Arch)",
        category: "Industrial",
        description: "Large span tied arch for aircraft storage",
        nodes: [
            { id: "n1", x: 0, y: 0, z: 0, support: "PINNED" },
            { id: "n2", x: 15, y: 12, z: 0 },
            { id: "n3", x: 30, y: 18, z: 0 },
            { id: "n4", x: 45, y: 12, z: 0 },
            { id: "n5", x: 60, y: 0, z: 0, support: "PINNED" },
            { id: "n6", x: 15, y: 0, z: 0 },
            { id: "n7", x: 30, y: 0, z: 0 },
            { id: "n8", x: 45, y: 0, z: 0 }
        ],
        members: [
            // Arch
            { id: "m1", startNode: "n1", endNode: "n2", section: "ISMB500" },
            { id: "m2", startNode: "n2", endNode: "n3", section: "ISMB500" },
            { id: "m3", startNode: "n3", endNode: "n4", section: "ISMB500" },
            { id: "m4", startNode: "n4", endNode: "n5", section: "ISMB500" },
            // Tie beam
            { id: "m5", startNode: "n1", endNode: "n6", section: "ISMB300" },
            { id: "m6", startNode: "n6", endNode: "n7", section: "ISMB300" },
            { id: "m7", startNode: "n7", endNode: "n8", section: "ISMB300" },
            { id: "m8", startNode: "n8", endNode: "n5", section: "ISMB300" },
            // Hangers
            { id: "m9", startNode: "n2", endNode: "n6", section: "ISA75x75x8" },
            { id: "m10", startNode: "n3", endNode: "n7", section: "ISA75x75x8" },
            { id: "m11", startNode: "n4", endNode: "n8", section: "ISA75x75x8" }
        ],
        loads: [
            { type: "UDL", memberId: "m1", value: -8 },
            { type: "UDL", memberId: "m2", value: -8 },
            { type: "UDL", memberId: "m3", value: -8 },
            { type: "UDL", memberId: "m4", value: -8 }
        ]
    },

    // ========================================
    // BUILDINGS - MULTI-STORY FRAMES
    // ========================================

    G_PLUS_1_FRAME: {
        name: "G+1 Building Frame",
        category: "Buildings",
        description: "2-story residential/commercial frame",
        ...generateMultiStoryFrame(2, 2, 5, 3.2),
        loads: [
            { type: "UDL", memberId: "m7", value: -15 },
            { type: "UDL", memberId: "m8", value: -15 },
            { type: "UDL", memberId: "m9", value: -10 },
            { type: "UDL", memberId: "m10", value: -10 }
        ]
    },

    G_PLUS_3_FRAME: {
        name: "G+3 Commercial Building",
        category: "Buildings",
        description: "4-story commercial building frame",
        ...generateMultiStoryFrame(3, 4, 6, 3.5),
        loads: [
            { type: "UDL", memberId: "m13", value: -20 },
            { type: "UDL", memberId: "m14", value: -20 },
            { type: "UDL", memberId: "m15", value: -20 }
        ]
    },

    G_PLUS_5_FRAME: {
        name: "G+5 Office Tower",
        category: "Buildings",
        description: "6-story office building frame",
        ...generateMultiStoryFrame(4, 6, 7, 3.6),
        loads: []
    },

    HIGH_RISE_CORE: {
        name: "High-Rise Core Structure",
        category: "Buildings",
        description: "Central core for 15-story building",
        ...generateMultiStoryFrame(2, 15, 8, 3.5),
        loads: []
    },

    // ========================================
    // TRUSSES
    // ========================================

    PRATT_TRUSS_12M: {
        name: "Pratt Truss (12m Span)",
        category: "Trusses",
        description: "Standard Pratt truss for roof/bridge",
        ...generatePrattTruss(12, 3, 6),
        loads: [
            { type: "POINT", nodeId: "n8", value: -20, direction: "Y" },
            { type: "POINT", nodeId: "n9", value: -20, direction: "Y" },
            { type: "POINT", nodeId: "n10", value: -20, direction: "Y" }
        ]
    },

    HOWE_TRUSS: {
        name: "Howe Truss (18m Span)",
        category: "Trusses",
        description: "Howe truss with compression verticals",
        nodes: [
            { id: "n1", x: 0, y: 0, z: 0, support: "PINNED" },
            { id: "n2", x: 4.5, y: 0, z: 0 },
            { id: "n3", x: 9, y: 0, z: 0 },
            { id: "n4", x: 13.5, y: 0, z: 0 },
            { id: "n5", x: 18, y: 0, z: 0, support: "ROLLER" },
            { id: "n6", x: 4.5, y: 3, z: 0 },
            { id: "n7", x: 9, y: 4.5, z: 0 },
            { id: "n8", x: 13.5, y: 3, z: 0 }
        ],
        members: [
            // Bottom chord
            { id: "m1", startNode: "n1", endNode: "n2", section: "ISA100x100x12" },
            { id: "m2", startNode: "n2", endNode: "n3", section: "ISA100x100x12" },
            { id: "m3", startNode: "n3", endNode: "n4", section: "ISA100x100x12" },
            { id: "m4", startNode: "n4", endNode: "n5", section: "ISA100x100x12" },
            // Top chord
            { id: "m5", startNode: "n1", endNode: "n6", section: "ISA100x100x12" },
            { id: "m6", startNode: "n6", endNode: "n7", section: "ISA100x100x12" },
            { id: "m7", startNode: "n7", endNode: "n8", section: "ISA100x100x12" },
            { id: "m8", startNode: "n8", endNode: "n5", section: "ISA100x100x12" },
            // Verticals
            { id: "m9", startNode: "n2", endNode: "n6", section: "ISA75x75x8" },
            { id: "m10", startNode: "n3", endNode: "n7", section: "ISA75x75x8" },
            { id: "m11", startNode: "n4", endNode: "n8", section: "ISA75x75x8" },
            // Diagonals (Howe pattern - tension)
            { id: "m12", startNode: "n1", endNode: "n2", section: "ISA75x75x8" },
            { id: "m13", startNode: "n6", endNode: "n3", section: "ISA75x75x8" },
            { id: "m14", startNode: "n7", endNode: "n4", section: "ISA75x75x8" },
            { id: "m15", startNode: "n8", endNode: "n5", section: "ISA75x75x8" }
        ],
        loads: [
            { type: "POINT", nodeId: "n6", value: -25, direction: "Y" },
            { type: "POINT", nodeId: "n7", value: -30, direction: "Y" },
            { type: "POINT", nodeId: "n8", value: -25, direction: "Y" }
        ]
    },

    WARREN_TRUSS: {
        name: "Warren Truss (15m Span)",
        category: "Trusses",
        description: "Triangulated Warren pattern - no verticals",
        nodes: [
            { id: "n1", x: 0, y: 0, z: 0, support: "PINNED" },
            { id: "n2", x: 3, y: 0, z: 0 },
            { id: "n3", x: 6, y: 0, z: 0 },
            { id: "n4", x: 9, y: 0, z: 0 },
            { id: "n5", x: 12, y: 0, z: 0 },
            { id: "n6", x: 15, y: 0, z: 0, support: "ROLLER" },
            { id: "n7", x: 1.5, y: 2.6, z: 0 },
            { id: "n8", x: 4.5, y: 2.6, z: 0 },
            { id: "n9", x: 7.5, y: 2.6, z: 0 },
            { id: "n10", x: 10.5, y: 2.6, z: 0 },
            { id: "n11", x: 13.5, y: 2.6, z: 0 }
        ],
        members: [
            // Bottom chord
            { id: "m1", startNode: "n1", endNode: "n2", section: "ISA90x90x10" },
            { id: "m2", startNode: "n2", endNode: "n3", section: "ISA90x90x10" },
            { id: "m3", startNode: "n3", endNode: "n4", section: "ISA90x90x10" },
            { id: "m4", startNode: "n4", endNode: "n5", section: "ISA90x90x10" },
            { id: "m5", startNode: "n5", endNode: "n6", section: "ISA90x90x10" },
            // Top chord
            { id: "m6", startNode: "n7", endNode: "n8", section: "ISA90x90x10" },
            { id: "m7", startNode: "n8", endNode: "n9", section: "ISA90x90x10" },
            { id: "m8", startNode: "n9", endNode: "n10", section: "ISA90x90x10" },
            { id: "m9", startNode: "n10", endNode: "n11", section: "ISA90x90x10" },
            // Diagonals
            { id: "m10", startNode: "n1", endNode: "n7", section: "ISA75x75x8" },
            { id: "m11", startNode: "n7", endNode: "n2", section: "ISA75x75x8" },
            { id: "m12", startNode: "n2", endNode: "n8", section: "ISA75x75x8" },
            { id: "m13", startNode: "n8", endNode: "n3", section: "ISA75x75x8" },
            { id: "m14", startNode: "n3", endNode: "n9", section: "ISA75x75x8" },
            { id: "m15", startNode: "n9", endNode: "n4", section: "ISA75x75x8" },
            { id: "m16", startNode: "n4", endNode: "n10", section: "ISA75x75x8" },
            { id: "m17", startNode: "n10", endNode: "n5", section: "ISA75x75x8" },
            { id: "m18", startNode: "n5", endNode: "n11", section: "ISA75x75x8" },
            { id: "m19", startNode: "n11", endNode: "n6", section: "ISA75x75x8" }
        ],
        loads: []
    },

    FINK_TRUSS: {
        name: "Fink Truss (Roof)",
        category: "Trusses",
        description: "W-pattern Fink truss for roof structures",
        nodes: [
            { id: "n1", x: 0, y: 0, z: 0, support: "PINNED" },
            { id: "n2", x: 3, y: 2, z: 0 },
            { id: "n3", x: 6, y: 4, z: 0 },
            { id: "n4", x: 9, y: 2, z: 0 },
            { id: "n5", x: 12, y: 0, z: 0, support: "ROLLER" },
            { id: "n6", x: 3, y: 0, z: 0 },
            { id: "n7", x: 6, y: 0, z: 0 },
            { id: "n8", x: 9, y: 0, z: 0 }
        ],
        members: [
            // Top chord (rafters)
            { id: "m1", startNode: "n1", endNode: "n2", section: "ISMB150" },
            { id: "m2", startNode: "n2", endNode: "n3", section: "ISMB150" },
            { id: "m3", startNode: "n3", endNode: "n4", section: "ISMB150" },
            { id: "m4", startNode: "n4", endNode: "n5", section: "ISMB150" },
            // Bottom chord (tie)
            { id: "m5", startNode: "n1", endNode: "n6", section: "ISMB125" },
            { id: "m6", startNode: "n6", endNode: "n7", section: "ISMB125" },
            { id: "m7", startNode: "n7", endNode: "n8", section: "ISMB125" },
            { id: "m8", startNode: "n8", endNode: "n5", section: "ISMB125" },
            // Web members (Fink pattern)
            { id: "m9", startNode: "n2", endNode: "n6", section: "ISA65x65x6" },
            { id: "m10", startNode: "n3", endNode: "n7", section: "ISA65x65x6" },
            { id: "m11", startNode: "n4", endNode: "n8", section: "ISA65x65x6" },
            { id: "m12", startNode: "n2", endNode: "n7", section: "ISA65x65x6" },
            { id: "m13", startNode: "n4", endNode: "n7", section: "ISA65x65x6" }
        ],
        loads: [
            { type: "UDL", memberId: "m1", value: -3 },
            { type: "UDL", memberId: "m2", value: -3 },
            { type: "UDL", memberId: "m3", value: -3 },
            { type: "UDL", memberId: "m4", value: -3 }
        ]
    },

    // ========================================
    // BRIDGES
    // ========================================

    SIMPLE_BRIDGE: {
        name: "Simple Beam Bridge",
        category: "Bridges",
        description: "Single span beam bridge with deck",
        nodes: [
            { id: "n1", x: 0, y: 0, z: 0, support: "PINNED" },
            { id: "n2", x: 5, y: 0, z: 0 },
            { id: "n3", x: 10, y: 0, z: 0 },
            { id: "n4", x: 15, y: 0, z: 0 },
            { id: "n5", x: 20, y: 0, z: 0, support: "ROLLER" }
        ],
        members: [
            { id: "m1", startNode: "n1", endNode: "n2", section: "ISMB500" },
            { id: "m2", startNode: "n2", endNode: "n3", section: "ISMB500" },
            { id: "m3", startNode: "n3", endNode: "n4", section: "ISMB500" },
            { id: "m4", startNode: "n4", endNode: "n5", section: "ISMB500" }
        ],
        loads: [
            { type: "UDL", memberId: "m1", value: -25 },
            { type: "UDL", memberId: "m2", value: -25 },
            { type: "UDL", memberId: "m3", value: -25 },
            { type: "UDL", memberId: "m4", value: -25 }
        ]
    },

    CONTINUOUS_BRIDGE: {
        name: "3-Span Continuous Bridge",
        category: "Bridges",
        description: "Continuous girder bridge over 3 spans",
        nodes: [
            { id: "n1", x: 0, y: 0, z: 0, support: "PINNED" },
            { id: "n2", x: 10, y: 0, z: 0 },
            { id: "n3", x: 20, y: 0, z: 0, support: "ROLLER" },
            { id: "n4", x: 30, y: 0, z: 0 },
            { id: "n5", x: 40, y: 0, z: 0, support: "ROLLER" },
            { id: "n6", x: 50, y: 0, z: 0 },
            { id: "n7", x: 60, y: 0, z: 0, support: "ROLLER" }
        ],
        members: [
            { id: "m1", startNode: "n1", endNode: "n2", section: "ISMB600" },
            { id: "m2", startNode: "n2", endNode: "n3", section: "ISMB600" },
            { id: "m3", startNode: "n3", endNode: "n4", section: "ISMB600" },
            { id: "m4", startNode: "n4", endNode: "n5", section: "ISMB600" },
            { id: "m5", startNode: "n5", endNode: "n6", section: "ISMB600" },
            { id: "m6", startNode: "n6", endNode: "n7", section: "ISMB600" }
        ],
        loads: [
            { type: "UDL", memberId: "m1", value: -30 },
            { type: "UDL", memberId: "m2", value: -30 },
            { type: "UDL", memberId: "m3", value: -30 },
            { type: "UDL", memberId: "m4", value: -30 },
            { type: "UDL", memberId: "m5", value: -30 },
            { type: "UDL", memberId: "m6", value: -30 }
        ]
    },

    // ========================================
    // TOWERS & MASTS
    // ========================================

    TRANSMISSION_TOWER: {
        name: "Transmission Line Tower",
        category: "Towers",
        description: "Lattice tower for power transmission",
        nodes: [
            // Base
            { id: "n1", x: -3, y: 0, z: -3, support: "FIXED" },
            { id: "n2", x: 3, y: 0, z: -3, support: "FIXED" },
            { id: "n3", x: 3, y: 0, z: 3, support: "FIXED" },
            { id: "n4", x: -3, y: 0, z: 3, support: "FIXED" },
            // Level 1
            { id: "n5", x: -2, y: 8, z: -2 },
            { id: "n6", x: 2, y: 8, z: -2 },
            { id: "n7", x: 2, y: 8, z: 2 },
            { id: "n8", x: -2, y: 8, z: 2 },
            // Level 2
            { id: "n9", x: -1.5, y: 16, z: -1.5 },
            { id: "n10", x: 1.5, y: 16, z: -1.5 },
            { id: "n11", x: 1.5, y: 16, z: 1.5 },
            { id: "n12", x: -1.5, y: 16, z: 1.5 },
            // Cross-arm level
            { id: "n13", x: -6, y: 20, z: 0 },
            { id: "n14", x: -1, y: 20, z: 0 },
            { id: "n15", x: 1, y: 20, z: 0 },
            { id: "n16", x: 6, y: 20, z: 0 },
            // Top
            { id: "n17", x: 0, y: 24, z: 0 }
        ],
        members: [
            // Main legs
            { id: "m1", startNode: "n1", endNode: "n5", section: "ISA100x100x10" },
            { id: "m2", startNode: "n2", endNode: "n6", section: "ISA100x100x10" },
            { id: "m3", startNode: "n3", endNode: "n7", section: "ISA100x100x10" },
            { id: "m4", startNode: "n4", endNode: "n8", section: "ISA100x100x10" },
            { id: "m5", startNode: "n5", endNode: "n9", section: "ISA90x90x8" },
            { id: "m6", startNode: "n6", endNode: "n10", section: "ISA90x90x8" },
            { id: "m7", startNode: "n7", endNode: "n11", section: "ISA90x90x8" },
            { id: "m8", startNode: "n8", endNode: "n12", section: "ISA90x90x8" },
            // Horizontals
            { id: "m9", startNode: "n5", endNode: "n6", section: "ISA75x75x6" },
            { id: "m10", startNode: "n6", endNode: "n7", section: "ISA75x75x6" },
            { id: "m11", startNode: "n7", endNode: "n8", section: "ISA75x75x6" },
            { id: "m12", startNode: "n8", endNode: "n5", section: "ISA75x75x6" },
            // Cross arm
            { id: "m13", startNode: "n13", endNode: "n14", section: "ISA100x100x10" },
            { id: "m14", startNode: "n14", endNode: "n15", section: "ISA100x100x10" },
            { id: "m15", startNode: "n15", endNode: "n16", section: "ISA100x100x10" },
            // Top mast
            { id: "m16", startNode: "n14", endNode: "n17", section: "ISA75x75x6" },
            { id: "m17", startNode: "n15", endNode: "n17", section: "ISA75x75x6" }
        ],
        loads: [
            { type: "POINT", nodeId: "n13", value: -5, direction: "Y" },
            { type: "POINT", nodeId: "n16", value: -5, direction: "Y" },
            { type: "POINT", nodeId: "n17", value: -3, direction: "Y" }
        ]
    },

    COMMUNICATION_TOWER: {
        name: "Telecommunication Tower",
        category: "Towers",
        description: "Self-supporting telecom tower (40m)",
        nodes: [
            { id: "n1", x: -2, y: 0, z: -2, support: "FIXED" },
            { id: "n2", x: 2, y: 0, z: -2, support: "FIXED" },
            { id: "n3", x: 2, y: 0, z: 2, support: "FIXED" },
            { id: "n4", x: -2, y: 0, z: 2, support: "FIXED" },
            { id: "n5", x: -1.5, y: 10, z: -1.5 },
            { id: "n6", x: 1.5, y: 10, z: -1.5 },
            { id: "n7", x: 1.5, y: 10, z: 1.5 },
            { id: "n8", x: -1.5, y: 10, z: 1.5 },
            { id: "n9", x: -1, y: 20, z: -1 },
            { id: "n10", x: 1, y: 20, z: -1 },
            { id: "n11", x: 1, y: 20, z: 1 },
            { id: "n12", x: -1, y: 20, z: 1 },
            { id: "n13", x: -0.5, y: 30, z: -0.5 },
            { id: "n14", x: 0.5, y: 30, z: -0.5 },
            { id: "n15", x: 0.5, y: 30, z: 0.5 },
            { id: "n16", x: -0.5, y: 30, z: 0.5 },
            { id: "n17", x: 0, y: 40, z: 0 }
        ],
        members: [
            // Legs
            { id: "m1", startNode: "n1", endNode: "n5", section: "ISA100x100x12" },
            { id: "m2", startNode: "n2", endNode: "n6", section: "ISA100x100x12" },
            { id: "m3", startNode: "n3", endNode: "n7", section: "ISA100x100x12" },
            { id: "m4", startNode: "n4", endNode: "n8", section: "ISA100x100x12" },
            { id: "m5", startNode: "n5", endNode: "n9", section: "ISA90x90x10" },
            { id: "m6", startNode: "n6", endNode: "n10", section: "ISA90x90x10" },
            { id: "m7", startNode: "n7", endNode: "n11", section: "ISA90x90x10" },
            { id: "m8", startNode: "n8", endNode: "n12", section: "ISA90x90x10" },
            { id: "m9", startNode: "n9", endNode: "n13", section: "ISA75x75x8" },
            { id: "m10", startNode: "n10", endNode: "n14", section: "ISA75x75x8" },
            { id: "m11", startNode: "n11", endNode: "n15", section: "ISA75x75x8" },
            { id: "m12", startNode: "n12", endNode: "n16", section: "ISA75x75x8" },
            // Final leg
            { id: "m13", startNode: "n13", endNode: "n17", section: "ISA65x65x6" },
            { id: "m14", startNode: "n14", endNode: "n17", section: "ISA65x65x6" },
            { id: "m15", startNode: "n15", endNode: "n17", section: "ISA65x65x6" },
            { id: "m16", startNode: "n16", endNode: "n17", section: "ISA65x65x6" }
        ],
        loads: [
            { type: "POINT", nodeId: "n17", value: -10, direction: "Y" }
        ]
    },

    // ========================================
    // BEAMS
    // ========================================

    SIMPLY_SUPPORTED_BEAM: {
        name: "Simply Supported Beam",
        category: "Beams",
        description: "Basic pin-roller supported beam",
        nodes: [
            { id: "n1", x: 0, y: 0, z: 0, support: "PINNED" },
            { id: "n2", x: 3, y: 0, z: 0 },
            { id: "n3", x: 6, y: 0, z: 0, support: "ROLLER" }
        ],
        members: [
            { id: "m1", startNode: "n1", endNode: "n2", section: "ISMB300" },
            { id: "m2", startNode: "n2", endNode: "n3", section: "ISMB300" }
        ],
        loads: [
            { type: "POINT", nodeId: "n2", value: -50, direction: "Y" }
        ]
    },

    CANTILEVER_BEAM: {
        name: "Cantilever Beam",
        category: "Beams",
        description: "Fixed-free cantilever beam",
        nodes: [
            { id: "n1", x: 0, y: 0, z: 0, support: "FIXED" },
            { id: "n2", x: 2, y: 0, z: 0 },
            { id: "n3", x: 4, y: 0, z: 0 }
        ],
        members: [
            { id: "m1", startNode: "n1", endNode: "n2", section: "ISMB350" },
            { id: "m2", startNode: "n2", endNode: "n3", section: "ISMB350" }
        ],
        loads: [
            { type: "POINT", nodeId: "n3", value: -30, direction: "Y" }
        ]
    },

    OVERHANGING_BEAM: {
        name: "Overhanging Beam",
        category: "Beams",
        description: "Beam with overhang on one end",
        nodes: [
            { id: "n1", x: 0, y: 0, z: 0 },
            { id: "n2", x: 2, y: 0, z: 0, support: "PINNED" },
            { id: "n3", x: 6, y: 0, z: 0 },
            { id: "n4", x: 8, y: 0, z: 0, support: "ROLLER" }
        ],
        members: [
            { id: "m1", startNode: "n1", endNode: "n2", section: "ISMB300" },
            { id: "m2", startNode: "n2", endNode: "n3", section: "ISMB300" },
            { id: "m3", startNode: "n3", endNode: "n4", section: "ISMB300" }
        ],
        loads: [
            { type: "POINT", nodeId: "n1", value: -20, direction: "Y" },
            { type: "POINT", nodeId: "n3", value: -40, direction: "Y" }
        ]
    },

    CONTINUOUS_BEAM: {
        name: "3-Span Continuous Beam",
        category: "Beams",
        description: "Continuous beam over 3 supports",
        nodes: [
            { id: "n1", x: 0, y: 0, z: 0, support: "PINNED" },
            { id: "n2", x: 4, y: 0, z: 0, support: "ROLLER" },
            { id: "n3", x: 8, y: 0, z: 0, support: "ROLLER" },
            { id: "n4", x: 12, y: 0, z: 0, support: "ROLLER" }
        ],
        members: [
            { id: "m1", startNode: "n1", endNode: "n2", section: "ISMB400" },
            { id: "m2", startNode: "n2", endNode: "n3", section: "ISMB400" },
            { id: "m3", startNode: "n3", endNode: "n4", section: "ISMB400" }
        ],
        loads: [
            { type: "UDL", memberId: "m1", value: -20 },
            { type: "UDL", memberId: "m2", value: -20 },
            { type: "UDL", memberId: "m3", value: -20 }
        ]
    },

    // ========================================
    // SPECIAL STRUCTURES
    // ========================================

    CIRCULAR_TANK_SUPPORT: {
        name: "Circular Tank Support",
        category: "Special",
        description: "Elevated water tank support structure",
        nodes: [
            // Base (8 columns)
            { id: "n1", x: 5, y: 0, z: 0, support: "FIXED" },
            { id: "n2", x: 3.54, y: 0, z: 3.54, support: "FIXED" },
            { id: "n3", x: 0, y: 0, z: 5, support: "FIXED" },
            { id: "n4", x: -3.54, y: 0, z: 3.54, support: "FIXED" },
            { id: "n5", x: -5, y: 0, z: 0, support: "FIXED" },
            { id: "n6", x: -3.54, y: 0, z: -3.54, support: "FIXED" },
            { id: "n7", x: 0, y: 0, z: -5, support: "FIXED" },
            { id: "n8", x: 3.54, y: 0, z: -3.54, support: "FIXED" },
            // Top ring
            { id: "n9", x: 5, y: 12, z: 0 },
            { id: "n10", x: 3.54, y: 12, z: 3.54 },
            { id: "n11", x: 0, y: 12, z: 5 },
            { id: "n12", x: -3.54, y: 12, z: 3.54 },
            { id: "n13", x: -5, y: 12, z: 0 },
            { id: "n14", x: -3.54, y: 12, z: -3.54 },
            { id: "n15", x: 0, y: 12, z: -5 },
            { id: "n16", x: 3.54, y: 12, z: -3.54 }
        ],
        members: [
            // Columns
            { id: "m1", startNode: "n1", endNode: "n9", section: "ISMB350" },
            { id: "m2", startNode: "n2", endNode: "n10", section: "ISMB350" },
            { id: "m3", startNode: "n3", endNode: "n11", section: "ISMB350" },
            { id: "m4", startNode: "n4", endNode: "n12", section: "ISMB350" },
            { id: "m5", startNode: "n5", endNode: "n13", section: "ISMB350" },
            { id: "m6", startNode: "n6", endNode: "n14", section: "ISMB350" },
            { id: "m7", startNode: "n7", endNode: "n15", section: "ISMB350" },
            { id: "m8", startNode: "n8", endNode: "n16", section: "ISMB350" },
            // Top ring beam
            { id: "m9", startNode: "n9", endNode: "n10", section: "ISMB250" },
            { id: "m10", startNode: "n10", endNode: "n11", section: "ISMB250" },
            { id: "m11", startNode: "n11", endNode: "n12", section: "ISMB250" },
            { id: "m12", startNode: "n12", endNode: "n13", section: "ISMB250" },
            { id: "m13", startNode: "n13", endNode: "n14", section: "ISMB250" },
            { id: "m14", startNode: "n14", endNode: "n15", section: "ISMB250" },
            { id: "m15", startNode: "n15", endNode: "n16", section: "ISMB250" },
            { id: "m16", startNode: "n16", endNode: "n9", section: "ISMB250" }
        ],
        loads: [
            { type: "POINT", nodeId: "n9", value: -50, direction: "Y" },
            { type: "POINT", nodeId: "n10", value: -50, direction: "Y" },
            { type: "POINT", nodeId: "n11", value: -50, direction: "Y" },
            { type: "POINT", nodeId: "n12", value: -50, direction: "Y" },
            { type: "POINT", nodeId: "n13", value: -50, direction: "Y" },
            { type: "POINT", nodeId: "n14", value: -50, direction: "Y" },
            { type: "POINT", nodeId: "n15", value: -50, direction: "Y" },
            { type: "POINT", nodeId: "n16", value: -50, direction: "Y" }
        ]
    },

    CRANE_GANTRY: {
        name: "Crane Gantry",
        category: "Special",
        description: "Overhead crane gantry structure",
        nodes: [
            { id: "n1", x: 0, y: 0, z: 0, support: "FIXED" },
            { id: "n2", x: 0, y: 8, z: 0 },
            { id: "n3", x: 0, y: 10, z: 0 },
            { id: "n4", x: 15, y: 0, z: 0, support: "FIXED" },
            { id: "n5", x: 15, y: 8, z: 0 },
            { id: "n6", x: 15, y: 10, z: 0 }
        ],
        members: [
            // Columns
            { id: "m1", startNode: "n1", endNode: "n2", section: "ISMB450" },
            { id: "m2", startNode: "n2", endNode: "n3", section: "ISMB300" },
            { id: "m3", startNode: "n4", endNode: "n5", section: "ISMB450" },
            { id: "m4", startNode: "n5", endNode: "n6", section: "ISMB300" },
            // Crane beam
            { id: "m5", startNode: "n2", endNode: "n5", section: "ISMB500" },
            // Roof beam
            { id: "m6", startNode: "n3", endNode: "n6", section: "ISMB350" }
        ],
        loads: [
            { type: "POINT", nodeId: "n2", value: -100, direction: "Y" },
            { type: "POINT", nodeId: "n5", value: -100, direction: "Y" }
        ]
    },

    STAIRCASE_FRAME: {
        name: "Staircase Frame",
        category: "Special",
        description: "Steel staircase supporting structure",
        nodes: [
            { id: "n1", x: 0, y: 0, z: 0, support: "FIXED" },
            { id: "n2", x: 1.5, y: 1.5, z: 0 },
            { id: "n3", x: 3, y: 3, z: 0 },
            { id: "n4", x: 3, y: 3, z: 1.2, support: "PINNED" },
            { id: "n5", x: 4.5, y: 4.5, z: 0 },
            { id: "n6", x: 6, y: 6, z: 0, support: "PINNED" }
        ],
        members: [
            { id: "m1", startNode: "n1", endNode: "n2", section: "ISMC200" },
            { id: "m2", startNode: "n2", endNode: "n3", section: "ISMC200" },
            { id: "m3", startNode: "n3", endNode: "n4", section: "ISMC150" },
            { id: "m4", startNode: "n3", endNode: "n5", section: "ISMC200" },
            { id: "m5", startNode: "n5", endNode: "n6", section: "ISMC200" }
        ],
        loads: [
            { type: "POINT", nodeId: "n2", value: -5, direction: "Y" },
            { type: "POINT", nodeId: "n3", value: -5, direction: "Y" },
            { type: "POINT", nodeId: "n5", value: -5, direction: "Y" }
        ]
    },

    PIPE_RACK: {
        name: "Pipe Rack (Refinery)",
        category: "Special",
        description: "Industrial pipe support structure",
        nodes: [
            { id: "n1", x: 0, y: 0, z: 0, support: "FIXED" },
            { id: "n2", x: 0, y: 6, z: 0 },
            { id: "n3", x: 0, y: 9, z: 0 },
            { id: "n4", x: 6, y: 0, z: 0, support: "FIXED" },
            { id: "n5", x: 6, y: 6, z: 0 },
            { id: "n6", x: 6, y: 9, z: 0 },
            { id: "n7", x: 12, y: 0, z: 0, support: "FIXED" },
            { id: "n8", x: 12, y: 6, z: 0 },
            { id: "n9", x: 12, y: 9, z: 0 }
        ],
        members: [
            // Columns
            { id: "m1", startNode: "n1", endNode: "n2", section: "ISMB350" },
            { id: "m2", startNode: "n2", endNode: "n3", section: "ISMB250" },
            { id: "m3", startNode: "n4", endNode: "n5", section: "ISMB350" },
            { id: "m4", startNode: "n5", endNode: "n6", section: "ISMB250" },
            { id: "m5", startNode: "n7", endNode: "n8", section: "ISMB350" },
            { id: "m6", startNode: "n8", endNode: "n9", section: "ISMB250" },
            // Beams - Level 1
            { id: "m7", startNode: "n2", endNode: "n5", section: "ISMB300" },
            { id: "m8", startNode: "n5", endNode: "n8", section: "ISMB300" },
            // Beams - Level 2
            { id: "m9", startNode: "n3", endNode: "n6", section: "ISMB250" },
            { id: "m10", startNode: "n6", endNode: "n9", section: "ISMB250" }
        ],
        loads: [
            { type: "UDL", memberId: "m7", value: -15 },
            { type: "UDL", memberId: "m8", value: -15 },
            { type: "UDL", memberId: "m9", value: -10 },
            { type: "UDL", memberId: "m10", value: -10 }
        ]
    }
};

// ============================================
// HELPER TO GET ALL TEMPLATES BY CATEGORY
// ============================================

export function getTemplatesByCategory(): Record<string, StructureTemplate[]> {
    const byCategory: Record<string, StructureTemplate[]> = {};

    for (const template of Object.values(TEMPLATE_BANK)) {
        if (!byCategory[template.category]) {
            byCategory[template.category] = [];
        }
        byCategory[template.category].push(template);
    }

    return byCategory;
}

export function getTemplateList(): Array<{ key: string; template: StructureTemplate }> {
    return Object.entries(TEMPLATE_BANK).map(([key, template]) => ({
        key,
        template
    }));
}

export default TEMPLATE_BANK;
