/**
 * SampleStructures - Pre-defined Structure Templates
 * 
 * Provides ready-to-use structural models for quick starts:
 * - Simple Beam (simply supported with UDL)
 * - Cantilever (fixed end with point load)
 * - Portal Frame (single bay frame)
 * - Warren Truss (simple roof truss)
 */

import type { Node, Member, NodeLoad, MemberLoad } from '../store/model';

// ============================================
// TYPES
// ============================================

export interface SampleStructure {
    id: string;
    name: string;
    description: string;
    icon: string;
    nodes: Node[];
    members: Member[];
    loads: NodeLoad[];
    memberLoads: MemberLoad[];
}

// ============================================
// HELPER FUNCTIONS
// ============================================

const createNode = (id: string, x: number, y: number, z: number = 0, restraints?: Node['restraints']): Node => ({
    id,
    x,
    y,
    z,
    restraints
});

const createMember = (id: string, startNodeId: string, endNodeId: string): Member => ({
    id,
    startNodeId,
    endNodeId,
    sectionId: 'default',
    E: 200e9, // 200 GPa (Steel)
    A: 0.01,  // 0.01 m² (100 cm²)
    I: 1e-4   // 1e-4 m⁴
});

const createNodeLoad = (id: string, nodeId: string, fy: number): NodeLoad => ({
    id,
    nodeId,
    fy
});

const createMemberLoad = (
    id: string,
    memberId: string,
    w1: number,
    w2?: number
): MemberLoad => ({
    id,
    memberId,
    type: 'UDL', // Always use UDL for now - store only accepts specific types
    w1,
    w2: w2 ?? w1,
    direction: 'global_y'
});

// ============================================
// SIMPLE BEAM (Simply Supported)
// ============================================

export const simpleBeam: SampleStructure = {
    id: 'simple-beam',
    name: 'Simple Beam',
    description: 'Simply supported beam with UDL (6m span)',
    icon: '━',
    nodes: [
        createNode('N1', 0, 0, 0, { fx: true, fy: true, fz: true, mx: false, my: false, mz: false }),
        createNode('N2', 3, 0, 0),
        createNode('N3', 6, 0, 0, { fx: false, fy: true, fz: true, mx: false, my: false, mz: false })
    ],
    members: [
        createMember('M1', 'N1', 'N2'),
        createMember('M2', 'N2', 'N3')
    ],
    loads: [],
    memberLoads: [
        createMemberLoad('ML1', 'M1', -10000), // -10 kN/m
        createMemberLoad('ML2', 'M2', -10000)
    ]
};

// ============================================
// CANTILEVER BEAM
// ============================================

export const cantileverBeam: SampleStructure = {
    id: 'cantilever',
    name: 'Cantilever',
    description: 'Fixed-end cantilever with point load (4m span)',
    icon: '⌐',
    nodes: [
        createNode('N1', 0, 0, 0, { fx: true, fy: true, fz: true, mx: true, my: true, mz: true }),
        createNode('N2', 2, 0, 0),
        createNode('N3', 4, 0, 0)
    ],
    members: [
        createMember('M1', 'N1', 'N2'),
        createMember('M2', 'N2', 'N3')
    ],
    loads: [
        createNodeLoad('L1', 'N3', -20000) // -20 kN at free end
    ],
    memberLoads: []
};

// ============================================
// PORTAL FRAME
// ============================================

export const portalFrame: SampleStructure = {
    id: 'portal-frame',
    name: 'Portal Frame',
    description: 'Single bay portal frame (6m × 4m)',
    icon: '门',
    nodes: [
        createNode('N1', 0, 0, 0, { fx: true, fy: true, fz: true, mx: true, my: true, mz: true }),
        createNode('N2', 0, 4, 0),
        createNode('N3', 6, 4, 0),
        createNode('N4', 6, 0, 0, { fx: true, fy: true, fz: true, mx: true, my: true, mz: true })
    ],
    members: [
        createMember('M1', 'N1', 'N2'), // Left column
        createMember('M2', 'N2', 'N3'), // Beam
        createMember('M3', 'N3', 'N4')  // Right column
    ],
    loads: [],
    memberLoads: [
        createMemberLoad('ML1', 'M2', -15000) // -15 kN/m on beam
    ]
};

// ============================================
// PROPPED CANTILEVER
// ============================================

export const proppedCantilever: SampleStructure = {
    id: 'propped-cantilever',
    name: 'Propped Cantilever',
    description: 'Fixed end with roller support (5m span)',
    icon: '⌊',
    nodes: [
        createNode('N1', 0, 0, 0, { fx: true, fy: true, fz: true, mx: true, my: true, mz: true }),
        createNode('N2', 2.5, 0, 0),
        createNode('N3', 5, 0, 0, { fx: false, fy: true, fz: true, mx: false, my: false, mz: false })
    ],
    members: [
        createMember('M1', 'N1', 'N2'),
        createMember('M2', 'N2', 'N3')
    ],
    loads: [
        createNodeLoad('L1', 'N2', -30000) // -30 kN at center
    ],
    memberLoads: []
};

// ============================================
// CONTINUOUS BEAM
// ============================================

export const continuousBeam: SampleStructure = {
    id: 'continuous-beam',
    name: 'Continuous Beam',
    description: 'Two-span continuous beam (3m + 3m)',
    icon: '≡',
    nodes: [
        createNode('N1', 0, 0, 0, { fx: true, fy: true, fz: true, mx: false, my: false, mz: false }),
        createNode('N2', 3, 0, 0, { fx: false, fy: true, fz: true, mx: false, my: false, mz: false }),
        createNode('N3', 6, 0, 0, { fx: false, fy: true, fz: true, mx: false, my: false, mz: false })
    ],
    members: [
        createMember('M1', 'N1', 'N2'),
        createMember('M2', 'N2', 'N3')
    ],
    loads: [],
    memberLoads: [
        createMemberLoad('ML1', 'M1', -12000),
        createMemberLoad('ML2', 'M2', -12000)
    ]
};

// ============================================
// ALL SAMPLES
// ============================================

export const ALL_SAMPLES: SampleStructure[] = [
    simpleBeam,
    cantileverBeam,
    portalFrame,
    proppedCantilever,
    continuousBeam
];

export default ALL_SAMPLES;
