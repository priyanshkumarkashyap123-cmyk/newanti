/**
 * PHASE 2 - WARREN BRIDGE DEMO GENERATOR
 * 
 * File: apps/web/src/demos/warren-bridge.ts
 * Status: Implemented
 * Use: Generates full model data for a Warren Truss Bridge
 */

import { v4 as uuidv4 } from 'uuid';

export interface Point { x: number; y: number; z: number; }

export interface ModelData {
    nodes: any[];
    members: any[];
    loads: any[];
    settings?: any;
}

/**
 * Generate Warren Truss Bridge Model
 * @param span Total span length (m)
 * @param height Truss height (m)
 * @param panels Number of panels (must be even for symmetry, typically)
 * @param loadPerNode Load applied at each bottom chord node (kN)
 */
export function generateWarrenBridge(
    span: number = 50,
    height: number = 5,
    panels: number = 10,
    loadPerNode: number = 100
): ModelData {
    const nodes: any[] = [];
    const members: any[] = [];
    const loads: any[] = [];

    const panelWidth = span / panels;

    // 1. Generate Nodes
    // Bottom Chord Nodes (Indices 0 to panels)
    for (let i = 0; i <= panels; i++) {
        nodes.push({
            id: `node_b_${i}`,
            x: i * panelWidth,
            y: 0,
            z: 0,
            isFixed: i === 0 || i === panels, // Simple supports at ends
            // For 3D stability if used in 3D solver:
            restraints: (i === 0) ? [1, 1, 1, 0, 0, 0] : (i === panels) ? [0, 1, 1, 0, 0, 0] : [0, 0, 0, 0, 0, 0]
        });
    }

    // Top Chord Nodes (Indices 0 to panels-1, offset by half panel)
    // Warren truss: triangles. Top nodes are at x = (i + 0.5) * width
    for (let i = 0; i < panels; i++) {
        nodes.push({
            id: `node_t_${i}`,
            x: (i + 0.5) * panelWidth,
            y: height,
            z: 0,
            isFixed: false,
            restraints: [0, 0, 0, 0, 0, 0]
        });
    }

    // 2. Generate Members
    // Properties (Steel)
    const E = 210e9;
    const A_chord = 0.005; // 5000 mm2
    const A_diag = 0.003;  // 3000 mm2

    // Bottom Chord
    for (let i = 0; i < panels; i++) {
        members.push({
            id: `mem_b_${i}`,
            startNodeId: `node_b_${i}`,
            endNodeId: `node_b_${i + 1}`,
            E, A: A_chord, I: 1e-5,
            type: 'truss' // Explicit Truss Type
        });
    }

    // Top Chord
    for (let i = 0; i < panels - 1; i++) {
        members.push({
            id: `mem_t_${i}`,
            startNodeId: `node_t_${i}`,
            endNodeId: `node_t_${i + 1}`,
            E, A: A_chord, I: 1e-5,
            type: 'truss'
        });
    }

    // Diagonals (Zig-Zag)
    // b0 -> t0 -> b1 -> t1 -> b2 -> ...
    for (let i = 0; i < panels; i++) {
        // b_i -> t_i
        members.push({
            id: `mem_d1_${i}`,
            startNodeId: `node_b_${i}`,
            endNodeId: `node_t_${i}`,
            E, A: A_diag, I: 1e-5,
            type: 'truss'
        });

        // t_i -> b_{i+1}
        members.push({
            id: `mem_d2_${i}`,
            startNodeId: `node_t_${i}`,
            endNodeId: `node_b_${i + 1}`,
            E, A: A_diag, I: 1e-5,
            type: 'truss'
        });
    }

    // 3. Generate Loads
    // Vertical Point Loads on Bottom Chord Nodes (except supports)
    for (let i = 1; i < panels; i++) {
        loads.push({
            id: `load_${i}`,
            nodeId: `node_b_${i}`,
            fx: 0,
            fy: -loadPerNode * 1000, // Convert to N
            fz: 0,
            mx: 0, my: 0, mz: 0
        });
    }

    return {
        nodes,
        members,
        loads
    };
}
