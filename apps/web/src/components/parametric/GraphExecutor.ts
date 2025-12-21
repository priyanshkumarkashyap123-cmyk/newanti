/**
 * GraphExecutor - Topological Sort Execution Engine
 * 
 * Executes the visual scripting graph from inputs to outputs
 * and generates structural model data.
 */

import { Node, Edge } from 'reactflow';
import {
    GeneratedModel,
    GeneratedNode,
    GeneratedMember,
    PointData
} from './nodeTypes';

// ============================================
// TYPES
// ============================================

interface NodeValue {
    [outputId: string]: any;
}

interface ExecutionContext {
    nodeValues: Map<string, NodeValue>;
    errors: string[];
}

// ============================================
// TOPOLOGICAL SORT
// ============================================

/**
 * Perform topological sort on the graph
 * Returns nodes in execution order (inputs first, outputs last)
 */
export function topologicalSort(nodes: Node[], edges: Edge[]): Node[] {
    // Build adjacency list and in-degree map
    const adjacency = new Map<string, string[]>();
    const inDegree = new Map<string, number>();

    // Initialize
    for (const node of nodes) {
        adjacency.set(node.id, []);
        inDegree.set(node.id, 0);
    }

    // Build graph
    for (const edge of edges) {
        const targets = adjacency.get(edge.source) || [];
        targets.push(edge.target);
        adjacency.set(edge.source, targets);
        inDegree.set(edge.target, (inDegree.get(edge.target) || 0) + 1);
    }

    // Kahn's algorithm
    const queue: string[] = [];
    const result: Node[] = [];

    // Find all nodes with no incoming edges
    for (const [nodeId, degree] of inDegree) {
        if (degree === 0) {
            queue.push(nodeId);
        }
    }

    while (queue.length > 0) {
        const nodeId = queue.shift()!;
        const node = nodes.find(n => n.id === nodeId);
        if (node) {
            result.push(node);
        }

        // Reduce in-degree of neighbors
        for (const neighbor of adjacency.get(nodeId) || []) {
            const newDegree = (inDegree.get(neighbor) || 0) - 1;
            inDegree.set(neighbor, newDegree);
            if (newDegree === 0) {
                queue.push(neighbor);
            }
        }
    }

    // Check for cycles
    if (result.length !== nodes.length) {
        console.warn('Graph contains a cycle!');
    }

    return result;
}

// ============================================
// GRAPH EXECUTOR
// ============================================

/**
 * Execute the graph and generate structural model
 */
export function executeGraph(nodes: Node[], edges: Edge[]): GeneratedModel {
    const context: ExecutionContext = {
        nodeValues: new Map(),
        errors: []
    };

    // Sort nodes in execution order
    const sortedNodes = topologicalSort(nodes, edges);

    // Execute each node
    for (const node of sortedNodes) {
        try {
            const inputs = getNodeInputs(node.id, edges, context);
            const outputs = executeNode(node, inputs);
            context.nodeValues.set(node.id, outputs);
        } catch (error) {
            context.errors.push(`Error in node ${node.id}: ${error}`);
        }
    }

    // Collect final output
    return collectModelOutput(sortedNodes, context);
}

/**
 * Get input values for a node from connected sources
 */
function getNodeInputs(
    nodeId: string,
    edges: Edge[],
    context: ExecutionContext
): Record<string, any> {
    const inputs: Record<string, any> = {};

    for (const edge of edges) {
        if (edge.target === nodeId) {
            const sourceValues = context.nodeValues.get(edge.source);
            if (sourceValues && edge.sourceHandle) {
                const inputHandle = edge.targetHandle || 'default';
                inputs[inputHandle] = sourceValues[edge.sourceHandle];
            }
        }
    }

    return inputs;
}

/**
 * Execute a single node and return its outputs
 */
function executeNode(node: Node, inputs: Record<string, any>): NodeValue {
    const data = node.data;

    switch (node.type) {
        case 'numberInput':
            return { value: data.value ?? 0 };

        case 'pointGenerator':
            return {
                point: {
                    x: inputs.x ?? data.point?.x ?? 0,
                    y: inputs.y ?? data.point?.y ?? 0,
                    z: inputs.z ?? data.point?.z ?? 0
                }
            };

        case 'pointArray':
            return executePointArray(data, inputs);

        case 'lineConnector':
            return executeLineConnector(data, inputs);

        case 'frameRepeater':
            return executeFrameRepeater(data, inputs);

        case 'gridGenerator':
            return executeGridGenerator(data, inputs);

        case 'modelOutput':
            return {
                nodes: inputs.nodes || [],
                members: inputs.members || []
            };

        default:
            return {};
    }
}

// ============================================
// NODE EXECUTION FUNCTIONS
// ============================================

function executePointArray(
    data: any,
    inputs: Record<string, any>
): NodeValue {
    const start = inputs.start || { x: 0, y: 0, z: 0 };
    const count = inputs.count ?? data.count ?? 5;
    const spacing = inputs.spacing ?? data.spacing ?? 1;
    const direction = inputs.direction ?? data.direction ?? 'x';

    const points: PointData[] = [];

    for (let i = 0; i < count; i++) {
        const offset = i * spacing;
        points.push({
            x: start.x + (direction === 'x' ? offset : 0),
            y: start.y + (direction === 'y' ? offset : 0),
            z: start.z + (direction === 'z' ? offset : 0)
        });
    }

    return { points };
}

function executeLineConnector(
    data: any,
    inputs: Record<string, any>
): NodeValue {
    const start = inputs.start || data.startPoint || { x: 0, y: 0, z: 0 };
    const end = inputs.end || data.endPoint || { x: 1, y: 0, z: 0 };
    const divisions = inputs.divisions ?? data.divisions ?? 1;

    const points: PointData[] = [];
    const lines: { start: number; end: number }[] = [];

    // Generate intermediate points
    for (let i = 0; i <= divisions; i++) {
        const t = i / divisions;
        points.push({
            x: start.x + t * (end.x - start.x),
            y: start.y + t * (end.y - start.y),
            z: start.z + t * (end.z - start.z)
        });

        if (i > 0) {
            lines.push({ start: i - 1, end: i });
        }
    }

    return { points, lines };
}

function executeFrameRepeater(
    data: any,
    inputs: Record<string, any>
): NodeValue {
    const basePoints: PointData[] = inputs.points || data.basePoints || [];
    const count = inputs.count ?? data.repeatCount ?? 3;
    const spacing = inputs.spacing ?? data.spacing ?? 4;
    const direction = inputs.direction ?? data.direction ?? 'x';

    const nodes: GeneratedNode[] = [];
    const members: GeneratedMember[] = [];
    let nodeIndex = 0;
    const nodeIdMap: Map<string, string> = new Map();

    // Generate nodes for each frame
    for (let frame = 0; frame < count; frame++) {
        const offset = frame * spacing;
        const frameNodes: string[] = [];

        for (let i = 0; i < basePoints.length; i++) {
            const point = basePoints[i];
            const nodeId = `node_${nodeIndex++}`;

            nodes.push({
                id: nodeId,
                x: point.x + (direction === 'x' ? offset : 0),
                y: point.y + (direction === 'y' ? offset : 0),
                z: point.z + (direction === 'z' ? offset : 0)
            });

            frameNodes.push(nodeId);
            nodeIdMap.set(`${frame}_${i}`, nodeId);
        }

        // Connect nodes within the same frame
        for (let i = 0; i < frameNodes.length - 1; i++) {
            members.push({
                id: `member_${members.length}`,
                startNodeId: frameNodes[i],
                endNodeId: frameNodes[i + 1]
            });
        }

        // Connect to previous frame
        if (frame > 0) {
            for (let i = 0; i < basePoints.length; i++) {
                const prevNodeId = nodeIdMap.get(`${frame - 1}_${i}`);
                const currNodeId = nodeIdMap.get(`${frame}_${i}`);
                if (prevNodeId && currNodeId) {
                    members.push({
                        id: `member_${members.length}`,
                        startNodeId: prevNodeId,
                        endNodeId: currNodeId
                    });
                }
            }
        }
    }

    return { nodes, members };
}

function executeGridGenerator(
    data: any,
    inputs: Record<string, any>
): NodeValue {
    const xCount = inputs.xCount ?? data.xCount ?? 4;
    const yCount = inputs.yCount ?? data.yCount ?? 3;
    const xSpacing = inputs.xSpacing ?? data.xSpacing ?? 6;
    const ySpacing = inputs.ySpacing ?? data.ySpacing ?? 4;

    const points: PointData[] = [];

    for (let j = 0; j < yCount; j++) {
        for (let i = 0; i < xCount; i++) {
            points.push({
                x: i * xSpacing,
                y: j * ySpacing,
                z: 0
            });
        }
    }

    return { points };
}

// ============================================
// OUTPUT COLLECTION
// ============================================

function collectModelOutput(
    nodes: Node[],
    context: ExecutionContext
): GeneratedModel {
    // Find model output nodes
    const outputNodes = nodes.filter(n => n.type === 'modelOutput');

    if (outputNodes.length === 0) {
        // If no explicit output, collect from all frame repeaters
        const allNodes: GeneratedNode[] = [];
        const allMembers: GeneratedMember[] = [];

        for (const [nodeId, values] of context.nodeValues) {
            if (values.nodes) allNodes.push(...values.nodes);
            if (values.members) allMembers.push(...values.members);
        }

        return { nodes: allNodes, members: allMembers };
    }

    // Collect from output nodes
    const allNodes: GeneratedNode[] = [];
    const allMembers: GeneratedMember[] = [];

    for (const outputNode of outputNodes) {
        const values = context.nodeValues.get(outputNode.id);
        if (values) {
            if (values.nodes) allNodes.push(...values.nodes);
            if (values.members) allMembers.push(...values.members);
        }
    }

    return { nodes: allNodes, members: allMembers };
}

export default executeGraph;
