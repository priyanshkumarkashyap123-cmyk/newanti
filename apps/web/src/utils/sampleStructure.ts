/**
 * Sample Structure - Creates a demo portal frame for first-time users
 */

import { useModelStore } from '../store/model';

// Unique IDs for sample structure
const sampleIds = {
    nodes: {
        n1: 'sample-n1-' + Date.now(),
        n2: 'sample-n2-' + Date.now(),
        n3: 'sample-n3-' + Date.now(),
        n4: 'sample-n4-' + Date.now(),
    },
    members: {
        m1: 'sample-m1-' + Date.now(),
        m2: 'sample-m2-' + Date.now(),
        m3: 'sample-m3-' + Date.now(),
    }
};

/**
 * Creates a sample portal frame structure
 * This gives users something to interact with immediately
 */
export function createSampleStructure(): void {
    const state = useModelStore.getState();

    // Only create if model is empty
    if (state.nodes.size > 0) return;

    const { addNode, addLoad, setNodeRestraints, addMember } = state;

    // Create a simple portal frame (2-bay, 1-story)
    // Node positions (in meters on X-Z plane, Y is up for display but our model uses Y=0)

    // For 2D frame on ground plane:
    // We use X and Z coordinates, Y = 0 (ground plane)
    // OR we can rotate: X = horizontal span, Y = 0, Z = vertical height

    // Actually in this app, the ground plane is Y=0, so:
    // X = horizontal position
    // Y = 0 (ground plane - all at same level for portal frame base)
    // Z = depth (we'll use Z=0 for 2D frame)

    // Correction: Looking at InteractionManager, it snaps to Y=0 plane
    // Let's create a simple 2D frame in the X-Y plane where:
    // - Base nodes at Y=0
    // - Top nodes at Y=4 (4m high columns)

    // Base nodes (supports)
    addNode({ id: sampleIds.nodes.n1, x: 0, y: 0, z: 0 });
    addNode({ id: sampleIds.nodes.n2, x: 6, y: 0, z: 0 });

    // Top nodes
    addNode({ id: sampleIds.nodes.n3, x: 0, y: 4, z: 0 });
    addNode({ id: sampleIds.nodes.n4, x: 6, y: 4, z: 0 });

    // Add fixed supports at base
    setNodeRestraints(sampleIds.nodes.n1, { fx: true, fy: true, fz: true, mx: true, my: true, mz: true });
    setNodeRestraints(sampleIds.nodes.n2, { fx: true, fy: true, fz: true, mx: true, my: true, mz: true });

    // Create members
    // Left column
    addMember({
        id: sampleIds.members.m1,
        startNodeId: sampleIds.nodes.n1,
        endNodeId: sampleIds.nodes.n3,
        sectionId: 'W14x30',
        E: 200e6,
        A: 0.0058,
        I: 291e-6
    });

    // Beam
    addMember({
        id: sampleIds.members.m2,
        startNodeId: sampleIds.nodes.n3,
        endNodeId: sampleIds.nodes.n4,
        sectionId: 'W16x40',
        E: 200e6,
        A: 0.0076,
        I: 518e-6
    });

    // Right column
    addMember({
        id: sampleIds.members.m3,
        startNodeId: sampleIds.nodes.n2,
        endNodeId: sampleIds.nodes.n4,
        sectionId: 'W14x30',
        E: 200e6,
        A: 0.0058,
        I: 291e-6
    });

    // Add a sample load at top left node
    addLoad({
        id: 'sample-load-' + Date.now(),
        nodeId: sampleIds.nodes.n3,
        fx: -20, // 20 kN horizontal (wind load simulation)
        fy: -50  // 50 kN vertical (gravity)
    });

    // Add another load at top right
    addLoad({
        id: 'sample-load2-' + Date.now(),
        nodeId: sampleIds.nodes.n4,
        fy: -50 // 50 kN vertical
    });

    console.log('✅ Sample portal frame created with 4 nodes, 3 members, and loads');
}
