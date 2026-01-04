/**
 * LoadApplication.ts - Apply Realistic Loads to Structures
 * 
 * Converts realistic load definitions to node/member loads
 */

import type { Node, Load, MemberLoad } from '../store/model';
import { getRealisticLoads, type LoadDefinition } from './RealisticLoads';

/**
 * Apply realistic dead and live loads to structure nodes
 * Based on tributary area concept
 */
export function applyRealisticLoadsToStructure(
    structureId: string,
    nodes: Node[],
    useFactoredLoads: boolean = false
): { nodeLoads: Load[]; memberLoads: MemberLoad[] } {
    const loadDef = getRealisticLoads(structureId);
    if (!loadDef) {
        console.warn(`No realistic loads defined for structure: ${structureId}`);
        return { nodeLoads: [], memberLoads: [] };
    }

    const nodeLoads: Load[] = [];
    const memberLoads: MemberLoad[] = [];

    // Calculate total gravity load (dead + live)
    const totalFloorLoad = calculateTotalGravityLoad(loadDef);

    // Apply loads based on structure type
    if (structureId === 'burj-khalifa') {
        // High-rise: Apply floor loads at each level
        // Assuming nodes at floor levels carry tributary area
        const floorNodes = identifyFloorNodes(nodes);
        floorNodes.forEach((node, index) => {
            const tributaryArea = 25; // m² per node (approximate)
            const totalLoad = totalFloorLoad * tributaryArea;

            nodeLoads.push({
                id: `load-floor-${index}`,
                nodeId: node.id,
                fy: -totalLoad // Gravity (downward)
            });
        });
    } else if (structureId.includes('bridge') || structureId.includes('viaduct')) {
        // Bridge: Apply deck loads as UDL on girders
        const deckLoad = loadDef.deadLoad.deck || 0;
        const liveLoad = loadDef.liveLoad.intensity || 0;
        const totalUDL = (deckLoad + liveLoad) * (loadDef.windLoad?.basicSpeed ? 1 : 0); // Consider wind

        // Apply as uniform distributed load on deck members
        // (This would need member identification logic)
    }

    return { nodeLoads, memberLoads };
}

/**
 * Calculate total gravity load (DL + LL)
 */
function calculateTotalGravityLoad(loadDef: LoadDefinition): number {
    const DL = (loadDef.deadLoad.floor || 0) +
        (loadDef.deadLoad.facade || 0) +
        (loadDef.deadLoad.mechanical || 0);
    const LL = loadDef.liveLoad.office || loadDef.liveLoad.residential || 0;

    // Unfactored loads
    return DL + LL;
}

/**
 * Identify floor nodes (nodes at regular z-intervals)
 */
function identifyFloorNodes(nodes: Node[]): Node[] {
    // Group nodes by z-coordinate (floor levels)
    const floorLevels = new Map<number, Node[]>();
    const tolerance = 0.1; // meters

    nodes.forEach(node => {
        let foundLevel = false;
        floorLevels.forEach((levelNodes, z) => {
            if (Math.abs(node.z - z) < tolerance) {
                levelNodes.push(node);
                foundLevel = true;
            }
        });

        if (!foundLevel) {
            floorLevels.set(node.z, [node]);
        }
    });

    // Return interior nodes (not edge columns)
    const floorNodes: Node[] = [];
    floorLevels.forEach(levelNodes => {
        // Simple heuristic: nodes not at extreme x or y are floor nodes
        floorNodes.push(...levelNodes);
    });

    return floorNodes;
}

/**
 * Get load factor per building code
 */
export function getLoadFactor(loadType: 'dead' | 'live' | 'wind' | 'seismic', code: 'IS' | 'ASCE' | 'EN' = 'IS'): number {
    const factors = {
        IS: {
            dead: 1.5,
            live: 1.5,
            wind: 1.5,
            seismic: 1.0
        },
        ASCE: {
            dead: 1.2,
            live: 1.6,
            wind: 1.0,
            seismic: 1.0
        },
        EN: {
            dead: 1.35,
            live: 1.5,
            wind: 1.5,
            seismic: 1.0
        }
    };

    return factors[code][loadType];
}

export default {
    applyRealisticLoadsToStructure,
    getLoadFactor
};
