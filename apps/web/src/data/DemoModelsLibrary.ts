/**
 * DemoModelsLibrary.ts - Pre-configured Demo Models
 * 
 * Like STAAD.Pro demo models - users can load, analyze, learn
 */

import type { GeneratedStructure, Support, Load } from '../services/StructureFactory';
import type { Node, Member, Restraints } from '../store/model';
import { STRUCTURAL_SECTIONS } from './StructuralSections';

// Helper to convert support types to restraints
function getSupportRestraints(support: 'FIXED' | 'PIN' | 'ROLLER' | undefined): Restraints | undefined {
    switch (support) {
        case 'FIXED':
            return { fx: true, fy: true, fz: true, mx: true, my: true, mz: true };
        case 'PIN':
            return { fx: true, fy: true, fz: true, mx: false, my: false, mz: false };
        case 'ROLLER':
            return { fx: false, fy: true, fz: true, mx: false, my: false, mz: false };
        default:
            return undefined;
    }
}

// Helper to generate supports from nodes with restraints
function generateSupports(nodes: Node[]): Support[] {
    const supports: Support[] = [];
    nodes.forEach(node => {
        if (node.restraints) {
            const type = node.restraints.mx && node.restraints.my && node.restraints.mz ? 'fixed' :
                        (node.restraints.fx && node.restraints.fy && node.restraints.fz ? 'pinned' : 'roller');
            supports.push({
                nodeId: node.id,
                type,
                restraints: node.restraints
            });
        }
    });
    return supports;
}

// Helper to create complete GeneratedStructure with defaults
function createStructure(name: string, description: string, nodes: Node[], members: Member[], loads: Load[] = []): GeneratedStructure {
    // Calculate bounds
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    let minZ = Infinity, maxZ = -Infinity;
    
    nodes.forEach(n => {
        minX = Math.min(minX, n.x); maxX = Math.max(maxX, n.x);
        minY = Math.min(minY, n.y); maxY = Math.max(maxY, n.y);
        minZ = Math.min(minZ, n.z); maxZ = Math.max(maxZ, n.z);
    });
    
    return {
        name,
        description,
        nodes,
        members,
        supports: generateSupports(nodes),
        loads,
        metadata: {
            structureType: 'demo',
            totalNodes: nodes.length,
            totalMembers: members.length,
            dimensions: {
                length: maxX - minX,
                width: maxZ - minZ,
                height: maxY - minY
            },
            source: 'BeamLab Demo Library'
        }
    };
}

export interface DemoModel {
    id: string;
    name: string;
    description: string;
    category: 'buildings' | 'bridges' | 'towers' | 'trusses' | 'frames';
    difficulty: 'beginner' | 'intermediate' | 'advanced' | 'expert';
    learningObjectives: string[];
    thumbnail?: string;
    structure: GeneratedStructure;
    analysisConfig?: {
        type: 'burj-khalifa' | 'generic';
        config?: any;
    };
    metadata: {
        realWorldStructure?: string;
        location?: string;
        yearBuilt?: number;
        height?: number;
        length?: number;
        designer?: string;
    };
}

/**
 * Simple Warren Truss - Beginner Demo
 * Includes realistic self-weight loads
 */
function createWarrenTrussDemo(): GeneratedStructure {
    const span = 20000; // 20m span
    const height = 3000; // 3m height
    const segments = 8; // 8 panels
    const segmentLength = span / segments;

    const nodes: Node[] = [];
    const members: Member[] = [];
    const loads: Load[] = [];
    let nodeId = 1;
    let memberId = 1;
    let loadId = 1;

    // Top chord nodes
    for (let i = 0; i <= segments; i++) {
        const isSupport = i === 0 || i === segments;
        nodes.push({
            id: String(nodeId++),
            x: i * segmentLength,
            y: height,
            z: 0,
            restraints: getSupportRestraints(i === 0 ? 'PIN' : (i === segments ? 'ROLLER' : undefined))
        });
    }

    // Bottom chord nodes - these carry the deck loads
    for (let i = 0; i <= segments; i++) {
        nodes.push({
            id: String(nodeId++),
            x: i * segmentLength,
            y: 0,
            z: 0
        });
        
        // Add realistic loads on bottom chord (deck loads: 5kN/m² × 3m width = 15kN/m)
        // Equivalent nodal loads at segment length intervals
        if (i > 0 && i < segments) {
            loads.push({
                id: String(loadId++),
                nodeId: String(nodeId - 1),
                fy: -15 * segmentLength / 1000 // Convert to kN (load per node)
            });
        } else if (i === 0 || i === segments) {
            // End nodes get half the tributary load
            loads.push({
                id: String(loadId++),
                nodeId: String(nodeId - 1),
                fy: -15 * (segmentLength / 2) / 1000
            });
        }
    }

    // Top chord members
    for (let i = 0; i < segments; i++) {
        members.push({
            id: String(memberId++),
            startNodeId: String(i + 1),
            endNodeId: String(i + 2),
            sectionId: 'ISLB_200',
            sectionType: 'I-BEAM',
            dimensions: {
                height: 200,
                width: 100,
                webThickness: 5.4,
                flangeThickness: 9.0
            },
            E: 200000,
            A: 2900,
            I: 1670e4
        });
    }

    // Bottom chord members
    for (let i = 0; i < segments; i++) {
        members.push({
            id: String(memberId++),
            startNodeId: String((segments + 1) + i + 1),
            endNodeId: String((segments + 1) + i + 2),
            sectionId: 'ISLB_200',
            sectionType: 'I-BEAM',
            dimensions: {
                height: 200,
                width: 100,
                webThickness: 5.4,
                flangeThickness: 9.0
            },
            E: 200000,
            A: 2900,
            I: 1670e4
        });
    }

    // Diagonal members (Warren pattern)
    for (let i = 0; i < segments; i++) {
        // Diagonal up
        members.push({
            id: String(memberId++),
            startNodeId: String((segments + 1) + i + 1),
            endNodeId: String(i + 2),
            sectionId: 'ISA_100x100',
            sectionType: 'L-ANGLE',
            dimensions: {
                width: 100,
                height: 100,
                thickness: 10
            },
            E: 200000,
            A: 1903,
            I: 1800e4
        });

        // Diagonal down (alternate)
        if (i < segments - 1) {
            members.push({
                id: String(memberId++),
                startNodeId: String(i + 2),
                endNodeId: String((segments + 1) + i + 2),
                sectionId: 'ISA_100x100',
                sectionType: 'L-ANGLE',
                dimensions: {
                    width: 100,
                    height: 100,
                    thickness: 10
                },
                E: 200000,
                A: 1903,
                I: 1800e4
            });
        }
    }

    // Vertical members at supports
    members.push({
        id: String(memberId++),
        startNodeId: String(1),
        endNodeId: String(segments + 2),
        sectionId: 'ISA_90x90',
        sectionType: 'L-ANGLE',
        dimensions: {
            width: 90,
            height: 90,
            thickness: 8
        },
        E: 200000,
        A: 1360,
        I: 1080e4
    });

    members.push({
        id: String(memberId++),
        startNodeId: String(segments + 1),
        endNodeId: String((segments + 1) * 2 + 1),
        sectionId: 'ISA_90x90',
        sectionType: 'L-ANGLE',
        dimensions: {
            width: 90,
            height: 90,
            thickness: 8
        },
        E: 200000,
        A: 1360,
        I: 1080e4
    });

    return createStructure('Warren Truss', 'Simple Warren truss bridge for learning', nodes, members, loads);
}

/**
 * Simple Frame - Beginner Demo
 * Portal frame with realistic lateral and gravity loads
 */
function createSimpleFrameDemo(): GeneratedStructure {
    const width = 8000; // 8m
    const height = 4000; // 4m

    const nodes: Node[] = [
        { id: '1', x: 0, y: 0, z: 0, restraints: getSupportRestraints('FIXED') },
        { id: '2', x: width, y: 0, z: 0, restraints: getSupportRestraints('FIXED') },
        { id: '3', x: 0, y: height, z: 0 },
        { id: '4', x: width, y: height, z: 0 }
    ];

    const members: Member[] = [
        {
            id: '1',
            startNodeId: '1',
            endNodeId: '3',
            sectionId: 'ISMB_300',
            sectionType: 'I-BEAM',
            dimensions: { height: 300, width: 140, webThickness: 7.5, flangeThickness: 12.4 },
            E: 200000,
            A: 5626,
            I: 7990e4
        },
        {
            id: '2',
            startNodeId: '2',
            endNodeId: '4',
            sectionId: 'ISMB_300',
            sectionType: 'I-BEAM',
            dimensions: { height: 300, width: 140, webThickness: 7.5, flangeThickness: 12.4 },
            E: 200000,
            A: 5626,
            I: 7990e4
        },
        {
            id: '3',
            startNodeId: '3',
            endNodeId: '4',
            sectionId: 'ISMB_250',
            sectionType: 'I-BEAM',
            dimensions: { height: 250, width: 125, webThickness: 6.9, flangeThickness: 12.5 },
            E: 200000,
            A: 4621,
            I: 5131e4
        }
    ];

    // Realistic loads for an industrial frame
    // - Roof dead load: 1.5 kN/m² × 5m tributary = 7.5 kN/m → 60 kN total distributed to nodes
    // - Wind load: 1.2 kN/m² × 5m × 4m height = 24 kN lateral
    const loads: Load[] = [
        // Gravity loads on beam (roof dead load)
        { id: '1', nodeId: '3', fy: -30 }, // kN at left
        { id: '2', nodeId: '4', fy: -30 }, // kN at right
        // Wind load (lateral on column top)
        { id: '3', nodeId: '3', fx: 12 },  // kN lateral
        { id: '4', nodeId: '4', fx: 12 },  // kN lateral
    ];

    return createStructure('Simple Frame', 'Simple portal frame with gravity and wind loads', nodes, members, loads);
}

/**
 * Burj Khalifa Simplified - Expert Demo
 */
function createBurjKhalifaDemo(): GeneratedStructure {
    const nodes: Node[] = [
        // Foundation level (0m)
        { id: '1', x: 0, y: 0, z: 0, restraints: getSupportRestraints('FIXED') },
        { id: '2', x: 60000, y: 0, z: 0, restraints: getSupportRestraints('FIXED') },
        { id: '3', x: 0, y: 0, z: 60000, restraints: getSupportRestraints('FIXED') },
        { id: '4', x: 60000, y: 0, z: 60000, restraints: getSupportRestraints('FIXED') },

        // Level 1 - 100m
        { id: '5', x: 0, y: 100000, z: 0 },
        { id: '6', x: 60000, y: 100000, z: 0 },
        { id: '7', x: 0, y: 100000, z: 60000 },
        { id: '8', x: 60000, y: 100000, z: 60000 },

        // Level 2 - 200m
        { id: '9', x: 5000, y: 200000, z: 5000 },
        { id: '10', x: 55000, y: 200000, z: 5000 },
        { id: '11', x: 5000, y: 200000, z: 55000 },
        { id: '12', x: 55000, y: 200000, z: 55000 },

        // Level 3 - 400m
        { id: '13', x: 15000, y: 400000, z: 15000 },
        { id: '14', x: 45000, y: 400000, z: 15000 },
        { id: '15', x: 15000, y: 400000, z: 45000 },
        { id: '16', x: 45000, y: 400000, z: 45000 },

        // Top - 600m
        { id: '17', x: 30000, y: 600000, z: 30000 }
    ];

    const members: Member[] = [];
    let memberId = 1;

    // Mega columns (foundation to level 1)
    const megaColSections = ['MEGA_COLUMN_1200', 'MEGA_COLUMN_1000'];
    for (let i = 0; i < 4; i++) {
        members.push({
            id: String(memberId++),
            startNodeId: String(i + 1),
            endNodeId: String(i + 5),
            sectionId: megaColSections[0],
            sectionType: 'TUBE',
            dimensions: { outerWidth: 1200, outerHeight: 1200, thickness: 50 },
            E: 200000,
            A: 228000,
            I: 393e8
        });
    }

    // Columns level 1 to level 2
    for (let i = 0; i < 4; i++) {
        members.push({
            id: String(memberId++),
            startNodeId: String(i + 5),
            endNodeId: String(i + 9),
            sectionId: megaColSections[1],
            sectionType: 'TUBE',
            dimensions: { outerWidth: 1000, outerHeight: 1000, thickness: 40 },
            E: 200000,
            A: 153600,
            I: 182e8
        });
    }

    // Columns level 2 to level 3
    for (let i = 0; i < 4; i++) {
        members.push({
            id: String(memberId++),
            startNodeId: String(i + 9),
            endNodeId: String(i + 13),
            sectionId: 'COLUMN_800',
            sectionType: 'TUBE',
            dimensions: { outerWidth: 800, outerHeight: 800, thickness: 30 },
            E: 200000,
            A: 94200,
            I: 89.3e8
        });
    }

    // Columns level 3 to top
    for (let i = 0; i < 4; i++) {
        members.push({
            id: String(memberId++),
            startNodeId: String(i + 13),
            endNodeId: '17',
            sectionId: 'COLUMN_600',
            sectionType: 'TUBE',
            dimensions: { outerWidth: 600, outerHeight: 600, thickness: 25 },
            E: 200000,
            A: 58750,
            I: 37.4e8
        });
    }

    // Outrigger beams at level 2
    const outriggerConnections = [
        ['9', '10'], ['10', '12'], ['12', '11'], ['11', '9']
    ];
    for (const [start, end] of outriggerConnections) {
        members.push({
            id: String(memberId++),
            startNodeId: start,
            endNodeId: end,
            sectionId: 'OUTRIGGER_BEAM',
            sectionType: 'I-BEAM',
            dimensions: { height: 1000, width: 400, webThickness: 20, flangeThickness: 40 },
            E: 200000,
            A: 64000,
            I: 2133e6
        });
    }

    return createStructure('Burj Khalifa Simplified', 'Simplified model of Burj Khalifa', nodes, members);
}

/**
 * Golden Gate Bridge Section - Advanced Demo
 */
function createGoldenGateDemo(): GeneratedStructure {
    const span = 1280000; // 1280m main span
    const towerHeight = 227000; // 227m
    const deckHeight = 67000; // 67m above water

    const nodes: Node[] = [];
    const members: Member[] = [];
    let nodeId = 1;
    let memberId = 1;

    // Main tower nodes
    const tower1X = 0;
    const tower2X = span;

    // Tower 1
    nodes.push(
        { id: String(nodeId++), x: tower1X, y: 0, z: 0, restraints: getSupportRestraints('FIXED') },
        { id: String(nodeId++), x: tower1X, y: deckHeight, z: 0 },
        { id: String(nodeId++), x: tower1X, y: towerHeight, z: 0 }
    );

    // Tower 2
    nodes.push(
        { id: String(nodeId++), x: tower2X, y: 0, z: 0, restraints: getSupportRestraints('FIXED') },
        { id: String(nodeId++), x: tower2X, y: deckHeight, z: 0 },
        { id: String(nodeId++), x: tower2X, y: towerHeight, z: 0 }
    );

    // Deck nodes
    const deckSegments = 32;
    const segmentLength = span / deckSegments;
    for (let i = 0; i <= deckSegments; i++) {
        nodes.push({
            id: String(nodeId++),
            x: i * segmentLength,
            y: deckHeight,
            z: 0
        });
    }

    // Tower members
    members.push(
        {
            id: String(memberId++),
            startNodeId: '1',
            endNodeId: '2',
            sectionId: 'GOLDEN_GATE_TOWER_LEG',
            sectionType: 'TUBE',
            dimensions: { outerWidth: 3000, outerHeight: 3000, thickness: 80 },
            E: 200000,
            A: 942000,
            I: 2119e8
        },
        {
            id: String(memberId++),
            startNodeId: '2',
            endNodeId: '3',
            sectionId: 'GOLDEN_GATE_TOWER_LEG',
            sectionType: 'TUBE',
            dimensions: { outerWidth: 3000, outerHeight: 3000, thickness: 80 },
            E: 200000,
            A: 942000,
            I: 2119e8
        },
        {
            id: String(memberId++),
            startNodeId: '4',
            endNodeId: '5',
            sectionId: 'GOLDEN_GATE_TOWER_LEG',
            sectionType: 'TUBE',
            dimensions: { outerWidth: 3000, outerHeight: 3000, thickness: 80 },
            E: 200000,
            A: 942000,
            I: 2119e8
        },
        {
            id: String(memberId++),
            startNodeId: '5',
            endNodeId: '6',
            sectionId: 'GOLDEN_GATE_TOWER_LEG',
            sectionType: 'TUBE',
            dimensions: { outerWidth: 3000, outerHeight: 3000, thickness: 80 },
            E: 200000,
            A: 942000,
            I: 2119e8
        }
    );

    // Deck members
    for (let i = 0; i < deckSegments; i++) {
        members.push({
            id: String(memberId++),
            startNodeId: String(7 + i),
            endNodeId: String(7 + i + 1),
            sectionId: 'GOLDEN_GATE_GIRDER',
            sectionType: 'I-BEAM',
            dimensions: { height: 7600, width: 300, webThickness: 16, flangeThickness: 32 },
            E: 200000,
            A: 15360,
            I: 74000e6
        });
    }

    return createStructure('Golden Gate Bridge Section', 'Golden Gate Bridge main span section', nodes, members);
}

/**
 * Multi-Story Building Frame - Intermediate Demo
 * 5-story building with realistic floor loads and lateral forces
 */
function createMultiStoryBuildingDemo(): GeneratedStructure {
    const bayWidth = 6000; // 6m bay width
    const bayDepth = 6000; // 6m bay depth
    const storyHeight = 3500; // 3.5m story height
    const numBaysX = 3;
    const numBaysZ = 2;
    const numStories = 5;

    const nodes: Node[] = [];
    const members: Member[] = [];
    const loads: Load[] = [];
    let nodeId = 1;
    let memberId = 1;
    let loadId = 1;

    // Create nodes for all floors
    for (let floor = 0; floor <= numStories; floor++) {
        for (let ix = 0; ix <= numBaysX; ix++) {
            for (let iz = 0; iz <= numBaysZ; iz++) {
                const isBase = floor === 0;
                nodes.push({
                    id: String(nodeId++),
                    x: ix * bayWidth,
                    y: floor * storyHeight,
                    z: iz * bayDepth,
                    restraints: isBase ? getSupportRestraints('FIXED') : undefined
                });

                // Add floor loads (5 kN/m² × tributary area)
                if (floor > 0 && ix > 0 && iz > 0) {
                    // Interior nodes: full tributary area
                    loads.push({
                        id: String(loadId++),
                        nodeId: String(nodeId - 1),
                        fy: -5 * bayWidth * bayDepth / 1e6 // Convert mm² to m², then to kN
                    });
                } else if (floor > 0 && (ix === 0 || ix === numBaysX || iz === 0 || iz === numBaysZ)) {
                    // Edge/corner nodes: partial tributary area
                    const tributaryX = (ix === 0 || ix === numBaysX) ? bayWidth / 2 : bayWidth;
                    const tributaryZ = (iz === 0 || iz === numBaysZ) ? bayDepth / 2 : bayDepth;
                    loads.push({
                        id: String(loadId++),
                        nodeId: String(nodeId - 1),
                        fy: -5 * tributaryX * tributaryZ / 1e6
                    });
                }
            }
        }
    }

    const nodesPerFloor = (numBaysX + 1) * (numBaysZ + 1);

    // Create columns (vertical members)
    for (let floor = 0; floor < numStories; floor++) {
        for (let ix = 0; ix <= numBaysX; ix++) {
            for (let iz = 0; iz <= numBaysZ; iz++) {
                const bottomNode = floor * nodesPerFloor + ix * (numBaysZ + 1) + iz + 1;
                const topNode = (floor + 1) * nodesPerFloor + ix * (numBaysZ + 1) + iz + 1;
                members.push({
                    id: String(memberId++),
                    startNodeId: String(bottomNode),
                    endNodeId: String(topNode),
                    sectionId: 'ISMB_400',
                    sectionType: 'I-BEAM',
                    dimensions: { height: 400, width: 140, webThickness: 8.9, flangeThickness: 16 },
                    E: 200000,
                    A: 7846,
                    I: 20458e4
                });
            }
        }
    }

    // Create beams in X direction
    for (let floor = 1; floor <= numStories; floor++) {
        for (let ix = 0; ix < numBaysX; ix++) {
            for (let iz = 0; iz <= numBaysZ; iz++) {
                const leftNode = floor * nodesPerFloor + ix * (numBaysZ + 1) + iz + 1;
                const rightNode = floor * nodesPerFloor + (ix + 1) * (numBaysZ + 1) + iz + 1;
                members.push({
                    id: String(memberId++),
                    startNodeId: String(leftNode),
                    endNodeId: String(rightNode),
                    sectionId: 'ISMB_300',
                    sectionType: 'I-BEAM',
                    dimensions: { height: 300, width: 140, webThickness: 7.5, flangeThickness: 12.4 },
                    E: 200000,
                    A: 5626,
                    I: 7990e4
                });
            }
        }
    }

    // Create beams in Z direction
    for (let floor = 1; floor <= numStories; floor++) {
        for (let ix = 0; ix <= numBaysX; ix++) {
            for (let iz = 0; iz < numBaysZ; iz++) {
                const frontNode = floor * nodesPerFloor + ix * (numBaysZ + 1) + iz + 1;
                const backNode = floor * nodesPerFloor + ix * (numBaysZ + 1) + iz + 2;
                members.push({
                    id: String(memberId++),
                    startNodeId: String(frontNode),
                    endNodeId: String(backNode),
                    sectionId: 'ISMB_300',
                    sectionType: 'I-BEAM',
                    dimensions: { height: 300, width: 140, webThickness: 7.5, flangeThickness: 12.4 },
                    E: 200000,
                    A: 5626,
                    I: 7990e4
                });
            }
        }
    }

    // Add lateral wind loads (0.8 kN/m² on windward face)
    const windPressure = 0.8; // kN/m²
    for (let floor = 1; floor <= numStories; floor++) {
        const storyForce = windPressure * (numBaysZ * bayDepth / 1000) * (storyHeight / 1000);
        // Distribute to edge nodes
        for (let iz = 0; iz <= numBaysZ; iz++) {
            const nodeIndex = floor * nodesPerFloor + 0 * (numBaysZ + 1) + iz + 1;
            loads.push({
                id: String(loadId++),
                nodeId: String(nodeIndex),
                fx: storyForce / (numBaysZ + 1)
            });
        }
    }

    return createStructure('Multi-Story Building', '5-story steel frame building with realistic loads', nodes, members, loads);
}

/**
 * Pratt Truss Bridge - Intermediate Demo
 */
function createPrattTrussDemo(): GeneratedStructure {
    const span = 30000; // 30m span
    const height = 4000; // 4m height
    const segments = 10; // 10 panels

    const nodes: Node[] = [];
    const members: Member[] = [];
    const loads: Load[] = [];
    let nodeId = 1;
    let memberId = 1;
    let loadId = 1;
    const segmentLength = span / segments;

    // Bottom chord nodes (support level)
    for (let i = 0; i <= segments; i++) {
        nodes.push({
            id: String(nodeId++),
            x: i * segmentLength,
            y: 0,
            z: 0,
            restraints: i === 0 ? getSupportRestraints('PIN') : (i === segments ? getSupportRestraints('ROLLER') : undefined)
        });
    }

    // Top chord nodes
    for (let i = 0; i <= segments; i++) {
        nodes.push({
            id: String(nodeId++),
            x: i * segmentLength,
            y: height,
            z: 0
        });
    }

    // Bottom chord members
    for (let i = 0; i < segments; i++) {
        members.push({
            id: String(memberId++),
            startNodeId: String(i + 1),
            endNodeId: String(i + 2),
            sectionId: 'ISA_150x150',
            sectionType: 'L-ANGLE',
            dimensions: { width: 150, height: 150, thickness: 15 },
            E: 200000,
            A: 4303,
            I: 4800e4
        });
    }

    // Top chord members
    for (let i = 0; i < segments; i++) {
        members.push({
            id: String(memberId++),
            startNodeId: String(segments + 2 + i),
            endNodeId: String(segments + 3 + i),
            sectionId: 'ISLB_250',
            sectionType: 'I-BEAM',
            dimensions: { height: 250, width: 125, webThickness: 6.1, flangeThickness: 9.7 },
            E: 200000,
            A: 3570,
            I: 3720e4
        });
    }

    // Vertical members
    for (let i = 0; i <= segments; i++) {
        members.push({
            id: String(memberId++),
            startNodeId: String(i + 1),
            endNodeId: String(segments + 2 + i),
            sectionId: 'ISA_100x100',
            sectionType: 'L-ANGLE',
            dimensions: { width: 100, height: 100, thickness: 10 },
            E: 200000,
            A: 1903,
            I: 1800e4
        });
    }

    // Diagonal members (Pratt pattern - diagonals in tension)
    for (let i = 0; i < segments; i++) {
        if (i < segments / 2) {
            // Left half - diagonals slope down to center
            members.push({
                id: String(memberId++),
                startNodeId: String(segments + 2 + i),
                endNodeId: String(i + 2),
                sectionId: 'ISA_90x90',
                sectionType: 'L-ANGLE',
                dimensions: { width: 90, height: 90, thickness: 8 },
                E: 200000,
                A: 1360,
                I: 1080e4
            });
        } else {
            // Right half - diagonals slope down from center
            members.push({
                id: String(memberId++),
                startNodeId: String(i + 1),
                endNodeId: String(segments + 3 + i),
                sectionId: 'ISA_90x90',
                sectionType: 'L-ANGLE',
                dimensions: { width: 90, height: 90, thickness: 8 },
                E: 200000,
                A: 1360,
                I: 1080e4
            });
        }
    }

    // Add loads on bottom chord (deck loads: 20 kN at each panel point)
    for (let i = 1; i < segments; i++) {
        loads.push({
            id: String(loadId++),
            nodeId: String(i + 1),
            fy: -20
        });
    }

    return createStructure('Pratt Truss Bridge', '30m span Pratt truss with deck loads', nodes, members, loads);
}

/**
 * Demo Models Library
 */
export const DEMO_MODELS: DemoModel[] = [
    {
        id: 'simple-frame',
        name: 'Simple Portal Frame',
        description: 'Basic 2D portal frame with fixed supports and wind+gravity loads. Perfect for learning beam-column analysis.',
        category: 'frames',
        difficulty: 'beginner',
        learningObjectives: [
            'Understand moment distribution in frames',
            'Learn about fixed vs. pinned supports',
            'Analyze beam-column behavior under combined loads',
            'Calculate deflections and rotations'
        ],
        structure: createSimpleFrameDemo(),
        metadata: {
            realWorldStructure: 'Industrial Warehouse Frame',
            height: 4,
            length: 8
        }
    },
    {
        id: 'warren-truss',
        name: 'Warren Truss Bridge',
        description: '20m span Warren truss with 8 panels and deck loads. Classic bridge design for truss analysis.',
        category: 'trusses',
        difficulty: 'beginner',
        learningObjectives: [
            'Analyze tension and compression in truss members',
            'Understand method of joints and sections',
            'Learn truss efficiency and optimization',
            'Calculate member forces under deck loads'
        ],
        structure: createWarrenTrussDemo(),
        metadata: {
            realWorldStructure: 'Railway Bridge',
            length: 20
        }
    },
    {
        id: 'pratt-truss',
        name: 'Pratt Truss Bridge',
        description: '30m span Pratt truss with panel point loads. Optimized for tension diagonals.',
        category: 'trusses',
        difficulty: 'intermediate',
        learningObjectives: [
            'Compare Pratt vs Warren truss behavior',
            'Understand tension/compression member optimization',
            'Calculate axial forces in all members',
            'Design for realistic deck loads'
        ],
        structure: createPrattTrussDemo(),
        metadata: {
            realWorldStructure: 'Highway Overpass',
            length: 30
        }
    },
    {
        id: 'multi-story-building',
        name: '5-Story Building Frame',
        description: '3×2 bay, 5-story steel frame with gravity and wind loads. Complete building analysis.',
        category: 'buildings',
        difficulty: 'intermediate',
        learningObjectives: [
            'Analyze multi-story frame behavior',
            'Understand lateral load distribution',
            'Calculate story drift and deflections',
            'Design for combined gravity and wind',
            'Study P-Delta effects in tall frames'
        ],
        structure: createMultiStoryBuildingDemo(),
        metadata: {
            realWorldStructure: 'Office Building',
            height: 17.5,
            length: 18
        }
    },
    {
        id: 'burj-khalifa-simplified',
        name: 'Burj Khalifa (Simplified)',
        description: 'Simplified 600m tall building with mega-columns, outriggers, and tapering form. World\'s tallest structure.',
        category: 'towers',
        difficulty: 'expert',
        learningObjectives: [
            'Analyze super-tall building behavior',
            'Understand outrigger-belt truss systems',
            'Learn about progressive collapse resistance',
            'Study wind and seismic effects on tall structures',
            'Analyze differential column shortening'
        ],
        structure: createBurjKhalifaDemo(),
        analysisConfig: {
            type: 'burj-khalifa',
            config: {
                windSpeed: 62.5,
                seismicZone: 0.15,
                temperatureDelta: 50
            }
        },
        metadata: {
            realWorldStructure: 'Burj Khalifa',
            location: 'Dubai, UAE',
            yearBuilt: 2010,
            height: 828,
            designer: 'Adrian Smith (SOM)'
        }
    },
    {
        id: 'golden-gate-simplified',
        name: 'Golden Gate Bridge (Simplified)',
        description: '1280m main span suspension bridge with 227m tall towers. Iconic American landmark.',
        category: 'bridges',
        difficulty: 'advanced',
        learningObjectives: [
            'Understand suspension bridge mechanics',
            'Analyze cable forces and geometry',
            'Study tower-deck interaction',
            'Learn about aerodynamic stability',
            'Calculate deflections under traffic loads'
        ],
        structure: createGoldenGateDemo(),
        metadata: {
            realWorldStructure: 'Golden Gate Bridge',
            location: 'San Francisco, USA',
            yearBuilt: 1937,
            length: 2737,
            designer: 'Joseph Strauss'
        }
    }
];

/**
 * Get demo model by ID
 */
export function getDemoModel(id: string): DemoModel | undefined {
    return DEMO_MODELS.find(m => m.id === id);
}

/**
 * Get demo models by category
 */
export function getDemosByCategory(category: DemoModel['category']): DemoModel[] {
    return DEMO_MODELS.filter(m => m.category === category);
}

/**
 * Get demo models by difficulty
 */
export function getDemosByDifficulty(difficulty: DemoModel['difficulty']): DemoModel[] {
    return DEMO_MODELS.filter(m => m.difficulty === difficulty);
}
