/**
 * StructureFactory.ts - Parametric Structure Generator
 * 
 * Generates accurate structural models for famous engineering structures:
 * - Burj Khalifa (Y-core high-rise)
 * - Chenab Bridge (Steel arch)
 * - Bandra-Worli Sea Link (Cable-stayed)
 * - Howrah Bridge (Cantilever truss)
 * - Golden Gate Bridge (Suspension)
 * - Delhi Signature Bridge (Asymmetric cable-stayed)
 * - Delhi Metro Viaduct (Box girder)
 * - Multi-Level Stack Interchange
 * - Railway Warren Truss Bridge
 * - Continuous Box Girder Bridge
 */

import type { Node, Member, Support, Load } from '../store/model';

// ============================================
// STRUCTURE PARAMETER INTERFACES
// ============================================

export interface HighRiseParams {
    name: string;
    totalFloors: number;
    floorHeight: number;        // meters
    coreType: 'rectangular' | 'y-shaped' | 'circular';
    baySpacing: number;         // meters
    numberOfBaysX: number;
    numberOfBaysY: number;
    wingLength?: number;        // for Y-shaped cores
    wingAngle?: number;         // degrees between wings (typically 120°)
}

export interface ArchBridgeParams {
    name: string;
    totalLength: number;        // meters
    archSpan: number;           // meters
    archRise: number;           // meters (height of arch crown)
    deckHeight: number;         // height of deck above supports
    archSegments: number;       // number of segments in arch
    hangerSpacing: number;      // meters
    deckWidth: number;          // meters
}

export interface CableStayedParams {
    name: string;
    totalLength: number;        // meters
    mainSpan: number;           // meters
    sideSpan: number;           // meters
    towerHeight: number;        // meters
    deckWidth: number;          // meters
    cableSpacing: number;       // meters along deck
    cableArrangement: 'fan' | 'harp' | 'semi-harp';
    towerShape: 'A' | 'H' | 'Y' | 'inverted-Y' | 'single-pylon';
    towerInclination?: number;  // degrees from vertical (for asymmetric)
}

export interface SuspensionParams {
    name: string;
    totalLength: number;
    mainSpan: number;
    sideSpan: number;
    towerHeight: number;
    sagRatio: number;           // typically 1/9 to 1/12 of main span
    hangerSpacing: number;
    deckWidth: number;
}

export interface TrussParams {
    name: string;
    span: number;
    trussDepth: number;
    panelWidth: number;
    trussType: 'warren' | 'pratt' | 'howe' | 'k-truss' | 'cantilever';
    deckWidth: number;
    numberOfPanels?: number;
}

export interface ViaductParams {
    name: string;
    spans: number[];            // array of span lengths
    pierHeight: number;         // typical pier height
    girderDepth: number;
    deckWidth: number;
    girderType: 'box' | 'T-beam' | 'I-girder' | 'U-girder';
}

export interface InterchangeParams {
    name: string;
    levels: number;
    rampRadius: number;
    spanLength: number;
    deckWidth: number;
    pierSpacing: number;
    interchangeType: 'cloverleaf' | 'stack' | 'turbine' | 'trumpet';
}

export interface GeneratedStructure {
    name: string;
    description: string;
    nodes: Node[];
    members: Member[];
    supports: Support[];
    loads: Load[];
    metadata: {
        structureType: string;
        totalNodes: number;
        totalMembers: number;
        dimensions: {
            length: number;
            width: number;
            height: number;
        };
        source: string;       // Engineering reference
    };
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

let nodeIdCounter = 0;
let memberIdCounter = 0;

function resetCounters(): void {
    nodeIdCounter = 0;
    memberIdCounter = 0;
}

function createNode(x: number, y: number, z: number): Node {
    nodeIdCounter++;
    return {
        id: `N${nodeIdCounter}`,
        x,
        y,
        z,
        restraints: { fx: false, fy: false, fz: false, mx: false, my: false, mz: false }
    };
}

function createMember(startNode: Node, endNode: Node, sectionId: string = 'default'): Member {
    memberIdCounter++;
    return {
        id: `M${memberIdCounter}`,
        startNodeId: startNode.id,
        endNodeId: endNode.id,
        sectionId,
        materialId: 'steel-fe415',
        releases: { startMx: false, startMy: false, startMz: false, endMx: false, endMy: false, endMz: false }
    };
}

function createPinnedSupport(node: Node): Support {
    return {
        nodeId: node.id,
        type: 'pinned',
        restraints: { fx: true, fy: true, fz: true, mx: false, my: false, mz: false }
    };
}

function createFixedSupport(node: Node): Support {
    return {
        nodeId: node.id,
        type: 'fixed',
        restraints: { fx: true, fy: true, fz: true, mx: true, my: true, mz: true }
    };
}

function createRollerSupport(node: Node, direction: 'x' | 'z' = 'x'): Support {
    return {
        nodeId: node.id,
        type: 'roller',
        restraints: {
            fx: direction !== 'x',
            fy: true,
            fz: direction !== 'z',
            mx: false, my: false, mz: false
        }
    };
}

// ============================================
// STRUCTURE GENERATORS
// ============================================

/**
 * Generate Burj Khalifa-style Y-Core High-Rise Structure
 * Based on: 828m height, 163 floors, Y-shaped buttressed core
 */
export function generateBurjKhalifa(params?: Partial<HighRiseParams>): GeneratedStructure {
    resetCounters();

    const config: HighRiseParams = {
        name: 'Burj Khalifa',
        totalFloors: 50,          // Simplified representation
        floorHeight: 4.2,         // Actual floor height
        coreType: 'y-shaped',
        baySpacing: 6,
        numberOfBaysX: 2,
        numberOfBaysY: 2,
        wingLength: 25,           // meters from core to wing tip
        wingAngle: 120,           // degrees between wings
        ...params
    };

    const nodes: Node[] = [];
    const members: Member[] = [];
    const supports: Support[] = [];
    const loads: Load[] = [];

    // Generate Y-shaped floor plan at each level
    const wingAngles = [0, 120, 240].map(a => (a * Math.PI) / 180);

    // Core hexagon radius
    const coreRadius = 8;

    for (let floor = 0; floor <= config.totalFloors; floor++) {
        const y = floor * config.floorHeight;

        // Setback reduction as building rises (tapering)
        const setbackFactor = Math.max(0.4, 1 - floor / (config.totalFloors * 1.5));
        const currentWingLength = config.wingLength! * setbackFactor;
        const currentCoreRadius = coreRadius * setbackFactor;

        // Create hexagonal core nodes (6 nodes per floor)
        const coreNodes: Node[] = [];
        for (let i = 0; i < 6; i++) {
            const angle = (i * 60 * Math.PI) / 180;
            const x = currentCoreRadius * Math.cos(angle);
            const z = currentCoreRadius * Math.sin(angle);
            const node = createNode(x, y, z);
            coreNodes.push(node);
            nodes.push(node);
        }

        // Create wing tip nodes (3 wings)
        const wingNodes: Node[] = [];
        for (let w = 0; w < 3; w++) {
            const x = currentWingLength * Math.cos(wingAngles[w]);
            const z = currentWingLength * Math.sin(wingAngles[w]);
            const node = createNode(x, y, z);
            wingNodes.push(node);
            nodes.push(node);
        }

        // Create horizontal members (floor beams)
        // Core perimeter
        for (let i = 0; i < 6; i++) {
            members.push(createMember(coreNodes[i], coreNodes[(i + 1) % 6], 'ISMB400'));
        }

        // Wing connections (core to wing tip)
        for (let w = 0; w < 3; w++) {
            const coreIndex = w * 2;  // Connect to even-numbered core nodes
            members.push(createMember(coreNodes[coreIndex], wingNodes[w], 'ISMB300'));
        }

        // Vertical members (columns)
        if (floor > 0) {
            const prevFloorStartIdx = (floor - 1) * 9;  // 6 core + 3 wing nodes per floor

            // Core columns
            for (let i = 0; i < 6; i++) {
                const prevNode = nodes[prevFloorStartIdx + i];
                members.push(createMember(prevNode, coreNodes[i], 'ISMB500'));
            }

            // Wing columns
            for (let w = 0; w < 3; w++) {
                const prevWingNode = nodes[prevFloorStartIdx + 6 + w];
                members.push(createMember(prevWingNode, wingNodes[w], 'ISMB400'));
            }
        }

        // Add supports at ground floor
        if (floor === 0) {
            coreNodes.forEach(n => supports.push(createFixedSupport(n)));
            wingNodes.forEach(n => supports.push(createFixedSupport(n)));
        }
    }

    // Add wind loads at top floors
    const topFloorNodes = nodes.slice(-9);
    topFloorNodes.forEach(n => {
        loads.push({
            id: `WL${n.id}`,
            type: 'nodal',
            nodeId: n.id,
            fx: -50,  // Wind from +X direction (kN)
            fy: 0,
            fz: 0
        });
    });

    return {
        name: config.name,
        description: 'Burj Khalifa Y-Core High-Rise - Simplified 50-story model with Y-shaped buttressed core structure',
        nodes,
        members,
        supports,
        loads,
        metadata: {
            structureType: 'high-rise',
            totalNodes: nodes.length,
            totalMembers: members.length,
            dimensions: {
                length: config.wingLength! * 2,
                width: config.wingLength! * 2,
                height: config.totalFloors * config.floorHeight
            },
            source: 'Based on Burj Khalifa - 828m, Y-shaped buttressed core by SOM'
        }
    };
}

/**
 * Generate Chenab Bridge-style Steel Arch Structure
 * Based on: 1315m total, 467m arch span, 359m height above river
 */
export function generateChenabBridge(params?: Partial<ArchBridgeParams>): GeneratedStructure {
    resetCounters();

    const config: ArchBridgeParams = {
        name: 'Chenab Bridge',
        totalLength: 200,         // Scaled for demo
        archSpan: 120,            // Main arch span
        archRise: 40,             // Rise of arch
        deckHeight: 45,           // Deck above arch crown
        archSegments: 16,         // Segments in arch
        hangerSpacing: 7.5,       // Hanger spacing
        deckWidth: 13.5,          // Actual width
        ...params
    };

    const nodes: Node[] = [];
    const members: Member[] = [];
    const supports: Support[] = [];
    const loads: Load[] = [];

    // Arch dimensions
    const archHalfSpan = config.archSpan / 2;

    // Create parabolic arch
    const archNodesLeft: Node[] = [];
    const archNodesRight: Node[] = [];

    for (let i = 0; i <= config.archSegments; i++) {
        const t = i / config.archSegments;
        const x = -archHalfSpan + t * config.archSpan;

        // Parabolic profile: y = 4h(x/L)(1 - x/L)
        const normalizedX = (x + archHalfSpan) / config.archSpan;
        const y = 4 * config.archRise * normalizedX * (1 - normalizedX);

        // Create nodes for both sides of arch (twin ribs)
        const nodeLeft = createNode(x, y, -config.deckWidth / 4);
        const nodeRight = createNode(x, y, config.deckWidth / 4);

        archNodesLeft.push(nodeLeft);
        archNodesRight.push(nodeRight);
        nodes.push(nodeLeft, nodeRight);

        // Create arch members
        if (i > 0) {
            members.push(createMember(archNodesLeft[i - 1], archNodesLeft[i], 'ISMB500'));
            members.push(createMember(archNodesRight[i - 1], archNodesRight[i], 'ISMB500'));

            // Cross bracing between arch ribs
            members.push(createMember(archNodesLeft[i], archNodesRight[i], 'ISMB250'));
        }
    }

    // Create deck
    const deckY = config.archRise + 5;  // Deck above arch crown
    const deckNodes: Node[] = [];
    const numDeckNodes = Math.ceil(config.archSpan / config.hangerSpacing) + 1;

    for (let i = 0; i < numDeckNodes; i++) {
        const x = -archHalfSpan + i * config.hangerSpacing;
        if (x > archHalfSpan) break;

        const node = createNode(x, deckY, 0);
        deckNodes.push(node);
        nodes.push(node);

        // Create deck beams
        if (i > 0) {
            members.push(createMember(deckNodes[i - 1], deckNodes[i], 'ISMB400'));
        }

        // Create hangers from deck to arch
        // Find closest arch node
        const archIdx = Math.round((x + archHalfSpan) / config.archSpan * config.archSegments);
        if (archIdx >= 0 && archIdx < archNodesLeft.length) {
            const archHeight = archNodesLeft[archIdx].y;
            if (deckY > archHeight) {
                members.push(createMember(node, archNodesLeft[archIdx], 'ISMB150'));
                members.push(createMember(node, archNodesRight[archIdx], 'ISMB150'));
            }
        }
    }

    // Add supports at arch ends
    supports.push(createFixedSupport(archNodesLeft[0]));
    supports.push(createFixedSupport(archNodesRight[0]));
    supports.push(createFixedSupport(archNodesLeft[config.archSegments]));
    supports.push(createFixedSupport(archNodesRight[config.archSegments]));

    // Add dead load on deck
    deckNodes.forEach((n, i) => {
        if (i > 0 && i < deckNodes.length - 1) {
            loads.push({
                id: `DL${n.id}`,
                type: 'nodal',
                nodeId: n.id,
                fx: 0,
                fy: -100,  // Deck dead load (kN)
                fz: 0
            });
        }
    });

    return {
        name: config.name,
        description: 'Chenab Bridge Steel Arch - Twin-rib parabolic arch with suspended deck',
        nodes,
        members,
        supports,
        loads,
        metadata: {
            structureType: 'arch-bridge',
            totalNodes: nodes.length,
            totalMembers: members.length,
            dimensions: {
                length: config.archSpan,
                width: config.deckWidth,
                height: config.deckHeight
            },
            source: 'Based on Chenab Bridge - 1315m total, 467m arch span, 359m above river'
        }
    };
}

/**
 * Generate Bandra-Worli Sea Link Cable-Stayed Bridge
 * Based on: 5.6km total, 250m main spans, 128m towers
 */
export function generateBandraWorliSeaLink(params?: Partial<CableStayedParams>): GeneratedStructure {
    resetCounters();

    const config: CableStayedParams = {
        name: 'Bandra-Worli Sea Link',
        totalLength: 300,         // Simplified
        mainSpan: 100,            // Main span
        sideSpan: 50,
        towerHeight: 50,          // Tower height above deck
        deckWidth: 20,
        cableSpacing: 12.5,       // 6m actual / scaled
        cableArrangement: 'semi-harp',
        towerShape: 'inverted-Y',
        ...params
    };

    const nodes: Node[] = [];
    const members: Member[] = [];
    const supports: Support[] = [];
    const loads: Load[] = [];

    const deckY = 0;

    // Create deck nodes
    const startX = -config.sideSpan - config.mainSpan / 2;
    const endX = config.sideSpan + config.mainSpan / 2;
    const deckNodes: Node[] = [];

    for (let x = startX; x <= endX; x += config.cableSpacing) {
        const node = createNode(x, deckY, 0);
        deckNodes.push(node);
        nodes.push(node);
    }

    // Create deck members
    for (let i = 1; i < deckNodes.length; i++) {
        members.push(createMember(deckNodes[i - 1], deckNodes[i], 'ISMB450'));
    }

    // Create towers (inverted Y shape)
    const towerPositions = [-config.mainSpan / 2, config.mainSpan / 2];
    const towerTopNodes: Node[] = [];

    towerPositions.forEach(towerX => {
        // Tower base nodes (deck level)
        const baseLeft = createNode(towerX, deckY, -5);
        const baseRight = createNode(towerX, deckY, 5);
        nodes.push(baseLeft, baseRight);

        // Tower top (single node)
        const topNode = createNode(towerX, config.towerHeight, 0);
        nodes.push(topNode);
        towerTopNodes.push(topNode);

        // Tower legs
        members.push(createMember(baseLeft, topNode, 'ISMB600'));
        members.push(createMember(baseRight, topNode, 'ISMB600'));

        // Add supports at tower bases
        supports.push(createFixedSupport(baseLeft));
        supports.push(createFixedSupport(baseRight));
    });

    // Create cables (semi-harp arrangement)
    deckNodes.forEach((deckNode, i) => {
        const x = deckNode.x;

        // Connect to nearest tower
        if (x < 0 && x > startX) {
            // Connect to left tower
            members.push(createMember(deckNode, towerTopNodes[0], 'ISMC150'));
        } else if (x > 0 && x < endX) {
            // Connect to right tower
            members.push(createMember(deckNode, towerTopNodes[1], 'ISMC150'));
        }
    });

    // Add end supports
    supports.push(createPinnedSupport(deckNodes[0]));
    supports.push(createRollerSupport(deckNodes[deckNodes.length - 1]));

    // Add live loads
    deckNodes.forEach(n => {
        loads.push({
            id: `LL${n.id}`,
            type: 'nodal',
            nodeId: n.id,
            fx: 0,
            fy: -80,
            fz: 0
        });
    });

    return {
        name: config.name,
        description: 'Bandra-Worli Sea Link Cable-Stayed Bridge with inverted Y towers',
        nodes,
        members,
        supports,
        loads,
        metadata: {
            structureType: 'cable-stayed',
            totalNodes: nodes.length,
            totalMembers: members.length,
            dimensions: {
                length: config.totalLength,
                width: config.deckWidth,
                height: config.towerHeight
            },
            source: 'Based on Bandra-Worli Sea Link - 5.6km, 250m spans, 128m towers'
        }
    };
}

/**
 * Generate Howrah Bridge Cantilever Truss Structure
 * Based on: 705m total, 457m main span, riveted steel
 */
export function generateHowrahBridge(params?: Partial<TrussParams>): GeneratedStructure {
    resetCounters();

    const config: TrussParams = {
        name: 'Howrah Bridge',
        span: 150,                // Main span (scaled)
        trussDepth: 25,           // Depth of main truss
        panelWidth: 12.5,         // Panel width
        trussType: 'cantilever',
        deckWidth: 21.6,          // Actual width
        numberOfPanels: 12,
        ...params
    };

    const nodes: Node[] = [];
    const members: Member[] = [];
    const supports: Support[] = [];
    const loads: Load[] = [];

    const numPanels = config.numberOfPanels!;
    const panelWidth = config.span / numPanels;
    const halfSpan = config.span / 2;

    // Create top and bottom chord nodes
    const topNodes: Node[] = [];
    const bottomNodes: Node[] = [];

    for (let i = 0; i <= numPanels; i++) {
        const x = -halfSpan + i * panelWidth;

        // Top chord with parabolic profile (higher at towers)
        const normalizedX = Math.abs(x) / halfSpan;
        const topY = config.trussDepth * (0.3 + 0.7 * normalizedX);

        const topNode = createNode(x, topY, 0);
        const bottomNode = createNode(x, 0, 0);

        topNodes.push(topNode);
        bottomNodes.push(bottomNode);
        nodes.push(topNode, bottomNode);

        // Vertical members
        members.push(createMember(bottomNode, topNode, 'ISMB350'));

        // Chord members
        if (i > 0) {
            members.push(createMember(topNodes[i - 1], topNodes[i], 'ISMB500'));
            members.push(createMember(bottomNodes[i - 1], bottomNodes[i], 'ISMB500'));

            // Diagonals (K-truss pattern for cantilever)
            if (i % 2 === 1) {
                members.push(createMember(bottomNodes[i - 1], topNodes[i], 'ISMB300'));
                members.push(createMember(topNodes[i - 1], bottomNodes[i], 'ISMB300'));
            }
        }
    }

    // Supports at tower positions (1/4 and 3/4 of span)
    const quarterIdx = Math.floor(numPanels / 4);
    const threeQuarterIdx = Math.floor(3 * numPanels / 4);

    supports.push(createFixedSupport(bottomNodes[quarterIdx]));
    supports.push(createFixedSupport(bottomNodes[threeQuarterIdx]));
    supports.push(createRollerSupport(bottomNodes[0]));
    supports.push(createRollerSupport(bottomNodes[numPanels]));

    // Add deck loads
    bottomNodes.forEach(n => {
        loads.push({
            id: `DL${n.id}`,
            type: 'nodal',
            nodeId: n.id,
            fx: 0,
            fy: -150,
            fz: 0
        });
    });

    return {
        name: config.name,
        description: 'Howrah Bridge - Balanced cantilever truss with K-type configuration',
        nodes,
        members,
        supports,
        loads,
        metadata: {
            structureType: 'cantilever-truss',
            totalNodes: nodes.length,
            totalMembers: members.length,
            dimensions: {
                length: config.span,
                width: config.deckWidth,
                height: config.trussDepth
            },
            source: 'Based on Howrah Bridge - 705m total, 457m main span, 26,500 tons steel'
        }
    };
}

/**
 * Generate Golden Gate Bridge Suspension Structure
 * Based on: 2737m total, 1280m main span, 227m towers
 */
export function generateGoldenGateBridge(params?: Partial<SuspensionParams>): GeneratedStructure {
    resetCounters();

    const config: SuspensionParams = {
        name: 'Golden Gate Bridge',
        totalLength: 400,
        mainSpan: 250,
        sideSpan: 75,
        towerHeight: 80,
        sagRatio: 0.1,            // 1/10 of span
        hangerSpacing: 15,
        deckWidth: 27,
        ...params
    };

    const nodes: Node[] = [];
    const members: Member[] = [];
    const supports: Support[] = [];
    const loads: Load[] = [];

    const sagDepth = config.mainSpan * config.sagRatio;

    // Create tower nodes
    const leftTowerBase = createNode(-config.mainSpan / 2, 0, 0);
    const leftTowerTop = createNode(-config.mainSpan / 2, config.towerHeight, 0);
    const rightTowerBase = createNode(config.mainSpan / 2, 0, 0);
    const rightTowerTop = createNode(config.mainSpan / 2, config.towerHeight, 0);

    nodes.push(leftTowerBase, leftTowerTop, rightTowerBase, rightTowerTop);

    // Tower members
    members.push(createMember(leftTowerBase, leftTowerTop, 'ISMB600'));
    members.push(createMember(rightTowerBase, rightTowerTop, 'ISMB600'));

    // Tower supports
    supports.push(createFixedSupport(leftTowerBase));
    supports.push(createFixedSupport(rightTowerBase));

    // Create main cable (catenary shape)
    const cableNodes: Node[] = [];
    const numCableSegments = Math.ceil(config.mainSpan / config.hangerSpacing);

    for (let i = 0; i <= numCableSegments; i++) {
        const t = i / numCableSegments;
        const x = -config.mainSpan / 2 + t * config.mainSpan;

        // Catenary approximation: y = sag * cosh(x/a) where a = span/2/acosh(towerH/sag)
        // Simplified parabola: y = 4*sag*(x/L)*(1 - x/L)
        const normalizedX = (x + config.mainSpan / 2) / config.mainSpan;
        const cableY = config.towerHeight - 4 * sagDepth * normalizedX * (1 - normalizedX);

        const cableNode = createNode(x, cableY, 0);
        cableNodes.push(cableNode);
        nodes.push(cableNode);

        if (i > 0) {
            members.push(createMember(cableNodes[i - 1], cableNodes[i], 'ISMC200'));
        }
    }

    // Connect cable to towers
    members.push(createMember(leftTowerTop, cableNodes[0], 'ISMC150'));
    members.push(createMember(rightTowerTop, cableNodes[numCableSegments], 'ISMC150'));

    // Create deck nodes and hangers
    const deckY = 10;  // Deck elevation
    const deckNodes: Node[] = [];

    for (let i = 0; i <= numCableSegments; i++) {
        const x = -config.mainSpan / 2 + i * config.hangerSpacing;
        if (x > config.mainSpan / 2) break;

        const deckNode = createNode(x, deckY, 0);
        deckNodes.push(deckNode);
        nodes.push(deckNode);

        // Deck members
        if (i > 0) {
            members.push(createMember(deckNodes[i - 1], deckNodes[i], 'ISMB400'));
        }

        // Hangers (vertical cables)
        if (i < cableNodes.length) {
            members.push(createMember(deckNode, cableNodes[i], 'ISMC100'));
        }
    }

    // End supports on deck
    if (deckNodes.length > 0) {
        supports.push(createRollerSupport(deckNodes[0]));
        supports.push(createRollerSupport(deckNodes[deckNodes.length - 1]));
    }

    // Cable anchorage points
    const leftAnchor = createNode(-config.mainSpan / 2 - config.sideSpan, 0, 0);
    const rightAnchor = createNode(config.mainSpan / 2 + config.sideSpan, 0, 0);
    nodes.push(leftAnchor, rightAnchor);

    members.push(createMember(leftAnchor, cableNodes[0], 'ISMC200'));
    members.push(createMember(rightAnchor, cableNodes[numCableSegments], 'ISMC200'));

    supports.push(createFixedSupport(leftAnchor));
    supports.push(createFixedSupport(rightAnchor));

    return {
        name: config.name,
        description: 'Golden Gate Bridge - Suspension bridge with parabolic main cables',
        nodes,
        members,
        supports,
        loads,
        metadata: {
            structureType: 'suspension',
            totalNodes: nodes.length,
            totalMembers: members.length,
            dimensions: {
                length: config.totalLength,
                width: config.deckWidth,
                height: config.towerHeight
            },
            source: 'Based on Golden Gate Bridge - 2737m total, 1280m main span, 227m towers'
        }
    };
}

/**
 * Generate Delhi Signature Bridge - Asymmetric Cable-Stayed
 * Based on: 675m total, 251m main span, 154m inclined pylon
 */
export function generateSignatureBridge(params?: Partial<CableStayedParams>): GeneratedStructure {
    resetCounters();

    const config: CableStayedParams = {
        name: 'Delhi Signature Bridge',
        totalLength: 200,
        mainSpan: 125,
        sideSpan: 50,
        towerHeight: 60,
        deckWidth: 35.2,
        cableSpacing: 13.5,
        cableArrangement: 'fan',
        towerShape: 'single-pylon',
        towerInclination: 30,     // 60° from ground = 30° from vertical
        ...params
    };

    const nodes: Node[] = [];
    const members: Member[] = [];
    const supports: Support[] = [];
    const loads: Load[] = [];

    const deckY = 0;
    const pylonX = -config.sideSpan;  // Pylon on east side

    // Calculate inclined pylon top position
    const inclinationRad = (config.towerInclination! * Math.PI) / 180;
    const pylonTopX = pylonX + config.towerHeight * Math.sin(inclinationRad);
    const pylonTopY = config.towerHeight * Math.cos(inclinationRad);

    // Create pylon
    const pylonBase = createNode(pylonX, deckY, 0);
    const pylonTop = createNode(pylonTopX, pylonTopY, 0);
    nodes.push(pylonBase, pylonTop);

    members.push(createMember(pylonBase, pylonTop, 'ISMB600'));
    supports.push(createFixedSupport(pylonBase));

    // Create deck
    const deckNodes: Node[] = [];
    const startX = -config.sideSpan - 25;
    const endX = config.mainSpan + 25;

    for (let x = startX; x <= endX; x += config.cableSpacing) {
        const node = createNode(x, deckY, 0);
        deckNodes.push(node);
        nodes.push(node);
    }

    // Deck members
    for (let i = 1; i < deckNodes.length; i++) {
        members.push(createMember(deckNodes[i - 1], deckNodes[i], 'ISMB450'));
    }

    // Cables (fan arrangement from single pylon)
    deckNodes.forEach((deckNode) => {
        if (deckNode.x > pylonX - 10 && deckNode.x < endX - 10) {
            members.push(createMember(deckNode, pylonTop, 'ISMC150'));
        }
    });

    // Backstay cables
    const backstayAnchor = createNode(pylonX - 50, deckY, 0);
    nodes.push(backstayAnchor);
    members.push(createMember(pylonTop, backstayAnchor, 'ISMC200'));
    supports.push(createFixedSupport(backstayAnchor));

    // Deck supports
    supports.push(createPinnedSupport(deckNodes[0]));
    supports.push(createRollerSupport(deckNodes[deckNodes.length - 1]));

    return {
        name: config.name,
        description: 'Delhi Signature Bridge - Asymmetric cable-stayed with inclined single pylon',
        nodes,
        members,
        supports,
        loads,
        metadata: {
            structureType: 'cable-stayed-asymmetric',
            totalNodes: nodes.length,
            totalMembers: members.length,
            dimensions: {
                length: config.totalLength,
                width: config.deckWidth,
                height: config.towerHeight
            },
            source: 'Based on Delhi Signature Bridge - 675m, 251m span, 154m inclined pylon'
        }
    };
}

/**
 * Generate Delhi Metro Elevated Viaduct
 * Box girder on circular piers
 */
export function generateMetroViaduct(params?: Partial<ViaductParams>): GeneratedStructure {
    resetCounters();

    const config: ViaductParams = {
        name: 'Delhi Metro Viaduct',
        spans: [25, 30, 30, 30, 25],  // 5 spans
        pierHeight: 12,
        girderDepth: 3,
        deckWidth: 10,
        girderType: 'box',
        ...params
    };

    const nodes: Node[] = [];
    const members: Member[] = [];
    const supports: Support[] = [];
    const loads: Load[] = [];

    const deckY = config.pierHeight + config.girderDepth;
    let currentX = 0;

    const deckNodes: Node[] = [];
    const pierTopNodes: Node[] = [];

    // Create deck and pier nodes
    config.spans.forEach((span, spanIndex) => {
        // Start of span
        const startNode = createNode(currentX, deckY, 0);
        deckNodes.push(startNode);
        nodes.push(startNode);

        // Create pier at span start (except first span)
        if (spanIndex > 0) {
            const pierBase = createNode(currentX, 0, 0);
            const pierTop = createNode(currentX, config.pierHeight, 0);
            nodes.push(pierBase, pierTop);

            members.push(createMember(pierBase, pierTop, 'ISMC350'));
            supports.push(createFixedSupport(pierBase));
            pierTopNodes.push(pierTop);

            // Connect deck to pier top
            members.push(createMember(pierTop, startNode, 'ISMB200'));
        }

        // Mid-span nodes
        const midNode = createNode(currentX + span / 2, deckY, 0);
        deckNodes.push(midNode);
        nodes.push(midNode);

        currentX += span;

        // End of last span
        if (spanIndex === config.spans.length - 1) {
            const endNode = createNode(currentX, deckY, 0);
            deckNodes.push(endNode);
            nodes.push(endNode);
        }
    });

    // Create deck members
    for (let i = 1; i < deckNodes.length; i++) {
        members.push(createMember(deckNodes[i - 1], deckNodes[i], 'ISMB500'));
    }

    // End supports
    const firstPierBase = createNode(0, 0, 0);
    nodes.push(firstPierBase);
    supports.push(createPinnedSupport(firstPierBase));

    const lastPierBase = createNode(currentX, 0, 0);
    nodes.push(lastPierBase);
    supports.push(createRollerSupport(lastPierBase));

    // Add metro train loads
    deckNodes.forEach((n, i) => {
        if (i > 0 && i < deckNodes.length - 1) {
            loads.push({
                id: `TL${n.id}`,
                type: 'nodal',
                nodeId: n.id,
                fx: 0,
                fy: -200,  // Train load
                fz: 0
            });
        }
    });

    return {
        name: config.name,
        description: 'Delhi Metro Elevated Viaduct - Continuous box girder on circular piers',
        nodes,
        members,
        supports,
        loads,
        metadata: {
            structureType: 'viaduct',
            totalNodes: nodes.length,
            totalMembers: members.length,
            dimensions: {
                length: currentX,
                width: config.deckWidth,
                height: deckY
            },
            source: 'Based on Delhi Metro - 25-30m spans, 1.8-2m dia piers, box girder'
        }
    };
}

/**
 * Generate Warren Truss Railway Bridge
 */
export function generateWarrenTruss(params?: Partial<TrussParams>): GeneratedStructure {
    resetCounters();

    const config: TrussParams = {
        name: 'Warren Truss Railway Bridge',
        span: 60,
        trussDepth: 8,
        panelWidth: 6,
        trussType: 'warren',
        deckWidth: 5,
        ...params
    };

    const nodes: Node[] = [];
    const members: Member[] = [];
    const supports: Support[] = [];
    const loads: Load[] = [];

    const numPanels = Math.ceil(config.span / config.panelWidth);
    const actualPanelWidth = config.span / numPanels;

    const topNodes: Node[] = [];
    const bottomNodes: Node[] = [];

    for (let i = 0; i <= numPanels; i++) {
        const x = i * actualPanelWidth;

        const topNode = createNode(x, config.trussDepth, 0);
        const bottomNode = createNode(x, 0, 0);

        topNodes.push(topNode);
        bottomNodes.push(bottomNode);
        nodes.push(topNode, bottomNode);

        // Verticals at ends only
        if (i === 0 || i === numPanels) {
            members.push(createMember(bottomNode, topNode, 'ISMB250'));
        }

        // Chord members
        if (i > 0) {
            members.push(createMember(topNodes[i - 1], topNodes[i], 'ISMB350'));
            members.push(createMember(bottomNodes[i - 1], bottomNodes[i], 'ISMB350'));

            // Warren diagonals (alternating)
            if (i % 2 === 1) {
                members.push(createMember(bottomNodes[i - 1], topNodes[i], 'ISMB200'));
            } else {
                members.push(createMember(topNodes[i - 1], bottomNodes[i], 'ISMB200'));
            }
        }
    }

    // Supports
    supports.push(createPinnedSupport(bottomNodes[0]));
    supports.push(createRollerSupport(bottomNodes[numPanels]));

    // Railway loading (IRS loading)
    bottomNodes.forEach((n, i) => {
        if (i > 0 && i < bottomNodes.length - 1) {
            loads.push({
                id: `RL${n.id}`,
                type: 'nodal',
                nodeId: n.id,
                fx: 0,
                fy: -300,
                fz: 0
            });
        }
    });

    return {
        name: config.name,
        description: 'Warren Truss Railway Bridge - For IRS MBG loading',
        nodes,
        members,
        supports,
        loads,
        metadata: {
            structureType: 'warren-truss',
            totalNodes: nodes.length,
            totalMembers: members.length,
            dimensions: {
                length: config.span,
                width: config.deckWidth,
                height: config.trussDepth
            },
            source: 'Indian Railways Standard Warren Truss - 60m span'
        }
    };
}

/**
 * Generate Multi-Level Stack Interchange
 */
export function generateStackInterchange(params?: Partial<InterchangeParams>): GeneratedStructure {
    resetCounters();

    const config: InterchangeParams = {
        name: 'Multi-Level Stack Interchange',
        levels: 4,
        rampRadius: 80,
        spanLength: 30,
        deckWidth: 10,
        pierSpacing: 25,
        interchangeType: 'stack',
        ...params
    };

    const nodes: Node[] = [];
    const members: Member[] = [];
    const supports: Support[] = [];
    const loads: Load[] = [];

    const levelHeight = 6;  // 6m between levels

    // Create 4 level stack with crossing roads
    for (let level = 0; level < config.levels; level++) {
        const y = level * levelHeight;
        const isNS = level % 2 === 0;  // North-South on even levels

        // Create roadway nodes
        const roadLength = 150;
        const numSpans = Math.ceil(roadLength / config.spanLength);

        for (let i = 0; i <= numSpans; i++) {
            const progress = i / numSpans;

            let x, z;
            if (isNS) {
                x = 0;
                z = -roadLength / 2 + progress * roadLength;
            } else {
                x = -roadLength / 2 + progress * roadLength;
                z = 0;
            }

            const deckNode = createNode(x, y, z);
            nodes.push(deckNode);

            // Create pier at each node except ends
            if (i > 0 && i < numSpans) {
                const pierBase = createNode(x, 0, z);
                nodes.push(pierBase);
                members.push(createMember(pierBase, deckNode, 'ISMC400'));
                supports.push(createFixedSupport(pierBase));
            }

            // Deck members
            if (i > 0) {
                const prevIdx = nodes.length - (i > 0 && i < numSpans ? 3 : 2);
                if (prevIdx >= 0) {
                    members.push(createMember(nodes[prevIdx], deckNode, 'ISMB450'));
                }
            }
        }
    }

    // Add loads
    nodes.filter(n => n.y > 0).forEach(n => {
        loads.push({
            id: `TL${n.id}`,
            type: 'nodal',
            nodeId: n.id,
            fx: 0,
            fy: -100,
            fz: 0
        });
    });

    return {
        name: config.name,
        description: '4-Level Stack Interchange with crossing roadways',
        nodes,
        members,
        supports,
        loads,
        metadata: {
            structureType: 'interchange',
            totalNodes: nodes.length,
            totalMembers: members.length,
            dimensions: {
                length: 150,
                width: 150,
                height: config.levels * levelHeight
            },
            source: 'Multi-level flyover interchange per IRC:92'
        }
    };
}

/**
 * Generate Continuous Box Girder Bridge
 */
export function generateContinuousBoxGirder(params?: Partial<ViaductParams>): GeneratedStructure {
    resetCounters();

    const config: ViaductParams = {
        name: 'Continuous Box Girder Bridge',
        spans: [50, 80, 80, 80, 50],  // 5 spans, longer in middle
        pierHeight: 20,
        girderDepth: 4,
        deckWidth: 12,
        girderType: 'box',
        ...params
    };

    const nodes: Node[] = [];
    const members: Member[] = [];
    const supports: Support[] = [];
    const loads: Load[] = [];

    let currentX = 0;
    const deckY = config.pierHeight + config.girderDepth;

    config.spans.forEach((span, idx) => {
        // Start node
        const startNode = createNode(currentX, deckY, 0);
        nodes.push(startNode);

        // Quarter span node
        const q1Node = createNode(currentX + span * 0.25, deckY, 0);
        nodes.push(q1Node);

        // Mid span node
        const midNode = createNode(currentX + span * 0.5, deckY, 0);
        nodes.push(midNode);

        // 3/4 span node
        const q3Node = createNode(currentX + span * 0.75, deckY, 0);
        nodes.push(q3Node);

        // End node (only for last span)
        if (idx === config.spans.length - 1) {
            const endNode = createNode(currentX + span, deckY, 0);
            nodes.push(endNode);
        }

        // Pier at span start (except first)
        if (idx > 0) {
            const pierBase = createNode(currentX, 0, 0);
            const pierTop = createNode(currentX, config.pierHeight, 0);
            nodes.push(pierBase, pierTop);
            members.push(createMember(pierBase, pierTop, 'ISMC400'));
            members.push(createMember(pierTop, startNode, 'ISMB200'));
            supports.push(createFixedSupport(pierBase));
        }

        currentX += span;
    });

    // Create deck members
    const deckNodes = nodes.filter(n => n.y === deckY);
    for (let i = 1; i < deckNodes.length; i++) {
        members.push(createMember(deckNodes[i - 1], deckNodes[i], 'ISMB550'));
    }

    // End supports
    const firstDeckNode = deckNodes[0];
    const lastDeckNode = deckNodes[deckNodes.length - 1];
    supports.push(createPinnedSupport(firstDeckNode));
    supports.push(createRollerSupport(lastDeckNode));

    // Add loads
    deckNodes.forEach(n => {
        loads.push({
            id: `DL${n.id}`,
            type: 'nodal',
            nodeId: n.id,
            fx: 0,
            fy: -150,
            fz: 0
        });
    });

    return {
        name: config.name,
        description: 'Continuous Box Girder Bridge - 5 spans, post-tensioned',
        nodes,
        members,
        supports,
        loads,
        metadata: {
            structureType: 'box-girder',
            totalNodes: nodes.length,
            totalMembers: members.length,
            dimensions: {
                length: currentX,
                width: config.deckWidth,
                height: deckY
            },
            source: 'Continuous prestressed box girder per IS 1343'
        }
    };
}

// ============================================
// TEMPLATE REGISTRY
// ============================================

export interface TemplateInfo {
    id: string;
    name: string;
    category: 'high-rise' | 'arch' | 'cable-stayed' | 'suspension' | 'truss' | 'viaduct' | 'interchange';
    description: string;
    thumbnail?: string;
    generator: () => GeneratedStructure;
}

export const FAMOUS_STRUCTURES_TEMPLATES: TemplateInfo[] = [
    {
        id: 'burj-khalifa',
        name: 'Burj Khalifa',
        category: 'high-rise',
        description: 'Y-shaped buttressed core high-rise (828m, 163 floors)',
        generator: () => generateBurjKhalifa()
    },
    {
        id: 'chenab-bridge',
        name: 'Chenab Bridge',
        category: 'arch',
        description: 'Steel arch railway bridge (467m span, 359m height)',
        generator: () => generateChenabBridge()
    },
    {
        id: 'bandra-worli',
        name: 'Bandra-Worli Sea Link',
        category: 'cable-stayed',
        description: 'Cable-stayed bridge with inverted Y towers (5.6km)',
        generator: () => generateBandraWorliSeaLink()
    },
    {
        id: 'howrah-bridge',
        name: 'Howrah Bridge',
        category: 'truss',
        description: 'Balanced cantilever truss (457m main span)',
        generator: () => generateHowrahBridge()
    },
    {
        id: 'golden-gate',
        name: 'Golden Gate Bridge',
        category: 'suspension',
        description: 'Suspension bridge (1280m main span)',
        generator: () => generateGoldenGateBridge()
    },
    {
        id: 'signature-bridge',
        name: 'Delhi Signature Bridge',
        category: 'cable-stayed',
        description: 'Asymmetric cable-stayed with inclined pylon (154m)',
        generator: () => generateSignatureBridge()
    },
    {
        id: 'metro-viaduct',
        name: 'Delhi Metro Viaduct',
        category: 'viaduct',
        description: 'Box girder on circular piers',
        generator: () => generateMetroViaduct()
    },
    {
        id: 'warren-truss',
        name: 'Railway Truss Bridge',
        category: 'truss',
        description: 'Warren truss for railway (60m span)',
        generator: () => generateWarrenTruss()
    },
    {
        id: 'stack-interchange',
        name: 'Stack Interchange',
        category: 'interchange',
        description: '4-level multi-level flyover',
        generator: () => generateStackInterchange()
    },
    {
        id: 'box-girder',
        name: 'Continuous Box Girder',
        category: 'viaduct',
        description: '5-span continuous prestressed bridge',
        generator: () => generateContinuousBoxGirder()
    }
];

/**
 * Get template by ID
 */
export function getTemplateById(id: string): TemplateInfo | undefined {
    return FAMOUS_STRUCTURES_TEMPLATES.find(t => t.id === id);
}

/**
 * Get templates by category
 */
export function getTemplatesByCategory(category: TemplateInfo['category']): TemplateInfo[] {
    return FAMOUS_STRUCTURES_TEMPLATES.filter(t => t.category === category);
}

/**
 * Generate structure from template ID
 */
export function generateFromTemplate(templateId: string): GeneratedStructure | null {
    const template = getTemplateById(templateId);
    if (!template) return null;
    return template.generator();
}

export default {
    generateBurjKhalifa,
    generateChenabBridge,
    generateBandraWorliSeaLink,
    generateHowrahBridge,
    generateGoldenGateBridge,
    generateSignatureBridge,
    generateMetroViaduct,
    generateWarrenTruss,
    generateStackInterchange,
    generateContinuousBoxGirder,
    FAMOUS_STRUCTURES_TEMPLATES,
    getTemplateById,
    getTemplatesByCategory,
    generateFromTemplate
};
