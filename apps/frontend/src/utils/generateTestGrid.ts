/**
 * generateTestGrid.ts
 * 
 * Utility function to generate large grid structures for performance testing.
 * Supports testing GPU instanced rendering with 10k, 25k, 50k+ element models.
 * 
 * Usage:
 * - From browser console: window.generateTestGrid(100, 100)
 * - From code: import { generateTestGrid } from './utils/generateTestGrid'
 */

import { useModelStore } from '../store/model';
import { logger } from '../lib/logging/logger';

export interface GridConfig {
    rows: number;
    cols: number;
    stories?: number;
    spacing?: number;
    height?: number;
}

/**
 * Generate a grid structure for performance testing
 * 
 * @param rows - Number of rows (X direction)
 * @param cols - Number of columns (Z direction)
 * @param stories - Number of vertical stories (Y direction), default 1
 * @param spacing - Grid spacing in meters, default 5
 * @param height - Story height in meters, default 3
 * @returns Object with node count, member count, and generation time
 */
export function generateTestGrid(
    rows: number,
    cols: number,
    stories: number = 1,
    spacing: number = 5,
    height: number = 3
): { nodes: number; members: number; time: number } {
    const startTime = performance.now();

    const store = useModelStore.getState();

    // Clear existing model
    store.nodes.clear();
    store.members.clear();
    store.loads = [];
    store.memberLoads = [];
    store.selectedIds.clear();

    logger.info(`Generating ${rows}×${cols}×${stories} grid...`);

    const nodes: Map<string, any> = new Map();
    const members: Map<string, any> = new Map();

    let nodeId = 1;
    let memberId = 1;

    // Generate nodes
    for (let story = 0; story <= stories; story++) {
        for (let row = 0; row <= rows; row++) {
            for (let col = 0; col <= cols; col++) {
                const id = `N${nodeId}`;

                nodes.set(id, {
                    id,
                    x: row * spacing,
                    y: story * height,
                    z: col * spacing,
                    // Add fixed supports at ground level corners
                    restraints: (story === 0 && (
                        (row === 0 && col === 0) ||
                        (row === rows && col === 0) ||
                        (row === 0 && col === cols) ||
                        (row === rows && col === cols)
                    )) ? {
                        fx: true,
                        fy: true,
                        fz: true,
                        mx: true,
                        my: true,
                        mz: true
                    } : undefined
                });

                nodeId++;
            }
        }
    }

    // Helper to get node ID from grid coordinates
    const getNodeId = (story: number, row: number, col: number): string => {
        const nodesPerStory = (rows + 1) * (cols + 1);
        const nodesPerRow = (cols + 1);
        const index = story * nodesPerStory + row * nodesPerRow + col + 1;
        return `N${index}`;
    };

    // Generate members
    for (let story = 0; story <= stories; story++) {
        for (let row = 0; row <= rows; row++) {
            for (let col = 0; col <= cols; col++) {
                const currentNode = getNodeId(story, row, col);

                // Horizontal members in X direction (rows)
                if (row < rows) {
                    const id = `M${memberId}`;
                    const endNode = getNodeId(story, row + 1, col);

                    members.set(id, {
                        id,
                        startNodeId: currentNode,
                        endNodeId: endNode,
                        sectionId: 'W10x49',
                        E: 200000000, // 200 GPa (steel)
                        A: 0.0093, // m²
                        I: 0.0001, // m⁴
                    });

                    memberId++;
                }

                // Horizontal members in Z direction (cols)
                if (col < cols) {
                    const id = `M${memberId}`;
                    const endNode = getNodeId(story, row, col + 1);

                    members.set(id, {
                        id,
                        startNodeId: currentNode,
                        endNodeId: endNode,
                        sectionId: 'W10x49',
                        E: 200000000,
                        A: 0.0093,
                        I: 0.0001,
                    });

                    memberId++;
                }

                // Vertical members (columns)
                if (story < stories) {
                    const id = `M${memberId}`;
                    const endNode = getNodeId(story + 1, row, col);

                    members.set(id, {
                        id,
                        startNodeId: currentNode,
                        endNodeId: endNode,
                        sectionId: 'W12x65',
                        E: 200000000,
                        A: 0.0123,
                        I: 0.00015,
                    });

                    memberId++;
                }
            }
        }
    }

    // Update store
    store.nodes = nodes;
    store.members = members;
    store.nextNodeNumber = nodeId;
    store.nextMemberNumber = memberId;

    const endTime = performance.now();
    const generationTime = endTime - startTime;

    const result = {
        nodes: nodes.size,
        members: members.size,
        time: generationTime
    };

    logger.info('Grid generated successfully', {
        nodes: result.nodes,
        members: result.members,
        timeMs: result.time.toFixed(2)
    });

    return result;
}

/**
 * Predefined test configurations
 */
export const TEST_CONFIGURATIONS = {
    SMALL: { rows: 10, cols: 10, stories: 1, label: '121 nodes, 220 members' },
    MEDIUM: { rows: 50, cols: 50, stories: 1, label: '2,601 nodes, 5,100 members' },
    LARGE_10K: { rows: 100, cols: 100, stories: 1, label: '10,201 nodes, 20,200 members' },
    LARGE_25K: { rows: 158, cols: 158, stories: 1, label: '25,281 nodes, 50,086 members' },
    LARGE_50K: { rows: 223, cols: 223, stories: 1, label: '50,176 nodes, 99,552 members' },
    STRESS_100K: { rows: 316, cols: 316, stories: 1, label: '100,489 nodes, 199,856 members' },
};

/**
 * Generate predefined test model
 */
export function generateTestModel(configName: keyof typeof TEST_CONFIGURATIONS): void {
    const config = TEST_CONFIGURATIONS[configName];
    logger.info(`Generating ${configName} test model: ${config.label}`);
    generateTestGrid(config.rows, config.cols, config.stories);
}

// Export to window for console access
if (typeof window !== 'undefined') {
    (window as any).generateTestGrid = generateTestGrid;
    (window as any).generateTestModel = generateTestModel;
    (window as any).TEST_CONFIGURATIONS = TEST_CONFIGURATIONS;

    logger.info('Test grid generator loaded. Usage: generateTestModel("LARGE_10K") or generateTestGrid(rows, cols, stories)');
}
