/**
 * KnowledgeGraphService.ts
 * 
 * Structural Engineering Knowledge Graph for AI Memory
 * 
 * Features:
 * - Design pattern storage
 * - Code clause relationships
 * - Material property graph
 * - Problem-solution mappings
 * - Semantic search
 */

// ============================================
// TYPES
// ============================================

export interface KnowledgeNode {
    id: string;
    type: 'concept' | 'code_clause' | 'material' | 'section' | 'pattern' | 'problem' | 'solution';
    name: string;
    description: string;
    properties: Record<string, any>;
    embeddings?: number[];
    createdAt: Date;
    usageCount: number;
}

export interface KnowledgeEdge {
    id: string;
    from: string;
    to: string;
    type: 'related_to' | 'part_of' | 'requires' | 'solves' | 'references' | 'supersedes';
    weight: number;
    metadata?: Record<string, any>;
}

export interface QueryResult {
    node: KnowledgeNode;
    score: number;
    path?: KnowledgeNode[];
}

// ============================================
// KNOWLEDGE GRAPH SERVICE
// ============================================

class KnowledgeGraphServiceClass {
    private nodes: Map<string, KnowledgeNode> = new Map();
    private edges: Map<string, KnowledgeEdge> = new Map();
    private adjacencyList: Map<string, Set<string>> = new Map();

    constructor() {
        this.initializeBaseKnowledge();
    }

    /**
     * Initialize with structural engineering knowledge
     */
    private initializeBaseKnowledge(): void {
        // Design code nodes
        this.addNode({
            id: 'code:is800',
            type: 'code_clause',
            name: 'IS 800:2007',
            description: 'Indian Standard for General Construction in Steel',
            properties: { region: 'India', material: 'steel', year: 2007 }
        });

        this.addNode({
            id: 'code:aisc360',
            type: 'code_clause',
            name: 'AISC 360-22',
            description: 'Specification for Structural Steel Buildings',
            properties: { region: 'USA', material: 'steel', year: 2022 }
        });

        this.addNode({
            id: 'code:ec3',
            type: 'code_clause',
            name: 'EN 1993-1-1',
            description: 'Eurocode 3: Design of Steel Structures',
            properties: { region: 'Europe', material: 'steel' }
        });

        this.addNode({
            id: 'code:aci318',
            type: 'code_clause',
            name: 'ACI 318-19',
            description: 'Building Code Requirements for Structural Concrete',
            properties: { region: 'USA', material: 'concrete', year: 2019 }
        });

        // Common concepts
        this.addNode({
            id: 'concept:ltb',
            type: 'concept',
            name: 'Lateral-Torsional Buckling',
            description: 'Buckling mode involving lateral displacement and twisting of I-shaped beams',
            properties: { applicableTo: ['beam', 'column'], criticalFor: 'flexure' }
        });

        this.addNode({
            id: 'concept:moment_magnification',
            type: 'concept',
            name: 'Moment Magnification',
            description: 'Second-order effects in slender columns',
            properties: { applicableTo: ['column'], criticalFor: 'compression' }
        });

        // Design patterns
        this.addNode({
            id: 'pattern:portal_frame',
            type: 'pattern',
            name: 'Portal Frame',
            description: 'Moment-resisting frame with rigid beam-column joints',
            properties: { uses: ['industrial', 'warehouse'], spans: '15-30m' }
        });

        this.addNode({
            id: 'pattern:braced_frame',
            type: 'pattern',
            name: 'Braced Frame',
            description: 'Frame with diagonal bracing for lateral stability',
            properties: { uses: ['high-rise', 'industrial'], bracingTypes: ['X', 'V', 'K'] }
        });

        // Add relationships
        this.addEdge({ from: 'concept:ltb', to: 'code:is800', type: 'references', weight: 1.0 });
        this.addEdge({ from: 'concept:ltb', to: 'code:aisc360', type: 'references', weight: 1.0 });
        this.addEdge({ from: 'concept:ltb', to: 'code:ec3', type: 'references', weight: 1.0 });
        this.addEdge({ from: 'concept:moment_magnification', to: 'code:aci318', type: 'references', weight: 1.0 });
    }

    /**
     * Add a knowledge node
     */
    addNode(node: Omit<KnowledgeNode, 'createdAt' | 'usageCount'>): KnowledgeNode {
        const fullNode: KnowledgeNode = {
            ...node,
            createdAt: new Date(),
            usageCount: 0
        };
        this.nodes.set(node.id, fullNode);
        this.adjacencyList.set(node.id, new Set());
        return fullNode;
    }

    /**
     * Add an edge between nodes
     */
    addEdge(edge: Omit<KnowledgeEdge, 'id'>): KnowledgeEdge {
        const id = `edge:${edge.from}:${edge.to}:${edge.type}`;
        const fullEdge: KnowledgeEdge = { ...edge, id };
        this.edges.set(id, fullEdge);

        // Update adjacency list
        if (!this.adjacencyList.has(edge.from)) {
            this.adjacencyList.set(edge.from, new Set());
        }
        this.adjacencyList.get(edge.from)!.add(edge.to);

        return fullEdge;
    }

    /**
     * Query knowledge graph by semantic similarity
     */
    query(queryText: string, limit: number = 5): QueryResult[] {
        const queryLower = queryText.toLowerCase();
        const results: QueryResult[] = [];

        for (const node of this.nodes.values()) {
            let score = 0;

            // Simple text matching (would use embeddings in production)
            if (node.name.toLowerCase().includes(queryLower)) score += 0.5;
            if (node.description.toLowerCase().includes(queryLower)) score += 0.3;

            // Property matching
            for (const [key, value] of Object.entries(node.properties)) {
                if (String(value).toLowerCase().includes(queryLower)) {
                    score += 0.2;
                }
            }

            if (score > 0) {
                results.push({ node, score });
            }
        }

        return results
            .sort((a, b) => b.score - a.score)
            .slice(0, limit);
    }

    /**
     * Find related nodes
     */
    getRelated(nodeId: string, depth: number = 1): KnowledgeNode[] {
        const visited = new Set<string>();
        const result: KnowledgeNode[] = [];

        const bfs = (currentId: string, currentDepth: number) => {
            if (currentDepth > depth || visited.has(currentId)) return;
            visited.add(currentId);

            const neighbors = this.adjacencyList.get(currentId);
            if (!neighbors) return;

            for (const neighborId of neighbors) {
                const neighbor = this.nodes.get(neighborId);
                if (neighbor && !visited.has(neighborId)) {
                    result.push(neighbor);
                    bfs(neighborId, currentDepth + 1);
                }
            }
        };

        bfs(nodeId, 0);
        return result;
    }

    /**
     * Find path between two nodes
     */
    findPath(fromId: string, toId: string): KnowledgeNode[] | null {
        const queue: Array<{ id: string; path: string[] }> = [{ id: fromId, path: [fromId] }];
        const visited = new Set<string>();

        while (queue.length > 0) {
            const { id, path } = queue.shift()!;

            if (id === toId) {
                return path.map(p => this.nodes.get(p)!).filter(Boolean);
            }

            if (visited.has(id)) continue;
            visited.add(id);

            const neighbors = this.adjacencyList.get(id);
            if (neighbors) {
                for (const neighbor of neighbors) {
                    if (!visited.has(neighbor)) {
                        queue.push({ id: neighbor, path: [...path, neighbor] });
                    }
                }
            }
        }

        return null;
    }

    /**
     * Learn from problem-solution pair
     */
    learn(problem: string, solution: string, feature: string): void {
        const problemNode = this.addNode({
            id: `problem:${Date.now()}`,
            type: 'problem',
            name: problem.substring(0, 50),
            description: problem,
            properties: { feature, learned: true }
        });

        const solutionNode = this.addNode({
            id: `solution:${Date.now()}`,
            type: 'solution',
            name: solution.substring(0, 50),
            description: solution,
            properties: { feature, learned: true }
        });

        this.addEdge({
            from: problemNode.id,
            to: solutionNode.id,
            type: 'solves',
            weight: 1.0
        });

        console.log(`[KnowledgeGraph] Learned: ${problem.substring(0, 30)}...`);
    }

    /**
     * Get node by ID
     */
    getNode(id: string): KnowledgeNode | undefined {
        return this.nodes.get(id);
    }

    /**
     * Get all nodes of a type
     */
    getNodesByType(type: KnowledgeNode['type']): KnowledgeNode[] {
        return Array.from(this.nodes.values()).filter(n => n.type === type);
    }

    /**
     * Export graph as JSON
     */
    export(): { nodes: KnowledgeNode[]; edges: KnowledgeEdge[] } {
        return {
            nodes: Array.from(this.nodes.values()),
            edges: Array.from(this.edges.values())
        };
    }

    /**
     * Import graph from JSON
     */
    import(data: { nodes: KnowledgeNode[]; edges: KnowledgeEdge[] }): void {
        for (const node of data.nodes) {
            this.nodes.set(node.id, node);
            this.adjacencyList.set(node.id, new Set());
        }
        for (const edge of data.edges) {
            this.edges.set(edge.id, edge);
            this.adjacencyList.get(edge.from)?.add(edge.to);
        }
    }

    /**
     * Get statistics
     */
    getStats(): { nodeCount: number; edgeCount: number; byType: Record<string, number> } {
        const byType: Record<string, number> = {};
        for (const node of this.nodes.values()) {
            byType[node.type] = (byType[node.type] || 0) + 1;
        }

        return {
            nodeCount: this.nodes.size,
            edgeCount: this.edges.size,
            byType
        };
    }
}

// ============================================
// SINGLETON
// ============================================

export const knowledgeGraph = new KnowledgeGraphServiceClass();

export default KnowledgeGraphServiceClass;
