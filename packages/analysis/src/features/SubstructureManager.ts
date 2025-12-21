/**
 * SubstructureManager - Static Condensation & Super Elements
 * 
 * Condenses groups of members into single "super elements" to dramatically
 * reduce problem size. A 10,000 node truss can become a 100 node problem.
 * 
 * Uses Guyan Reduction (Static Condensation):
 * K_reduced = K_bb - K_bi * K_ii^-1 * K_ib
 * 
 * Where:
 * - K_bb = boundary-boundary stiffness
 * - K_ii = internal-internal stiffness  
 * - K_bi = boundary-internal coupling
 */

// ============================================
// TYPES
// ============================================

export interface Node {
    id: string;
    x: number;
    y: number;
    z: number;
}

export interface Member {
    id: string;
    startNodeId: string;
    endNodeId: string;
    E: number;
    A: number;
    I?: number;
}

export interface Substructure {
    id: string;
    name: string;
    /** Original nodes in substructure */
    nodes: Node[];
    /** Original members in substructure */
    members: Member[];
    /** Boundary nodes (retained in global model) */
    boundaryNodeIds: string[];
    /** Internal nodes (condensed out) */
    internalNodeIds: string[];
    /** Condensed stiffness matrix */
    condensedK: number[][];
    /** DOF per node */
    dofPerNode: number;
    /** Stats */
    stats: SubstructureStats;
}

export interface SubstructureStats {
    originalNodes: number;
    originalMembers: number;
    boundaryNodes: number;
    internalNodes: number;
    originalDof: number;
    condensedDof: number;
    reductionRatio: number;
    condensationTimeMs: number;
}

export interface SuperElement {
    id: string;
    substructureId: string;
    name: string;
    /** Boundary node IDs (interface with global model) */
    boundaryNodeIds: string[];
    /** Condensed stiffness matrix (size: boundaryDof x boundaryDof) */
    stiffnessMatrix: number[][];
    /** DOF per boundary node */
    dofPerNode: number;
    /** Total DOF of super element */
    totalDof: number;
}

// ============================================
// SUBSTRUCTURE MANAGER
// ============================================

export class SubstructureManager {
    private substructures: Map<string, Substructure> = new Map();
    private superElements: Map<string, SuperElement> = new Map();
    private dofPerNode: number;

    constructor(dofPerNode: number = 6) {
        this.dofPerNode = dofPerNode;
    }

    // ========================================
    // SUBSTRUCTURE CREATION
    // ========================================

    /**
     * Create a substructure from selected members
     * 
     * @param members - Selected members to form substructure
     * @param allNodes - All nodes in model
     * @param boundaryNodeIds - Node IDs that connect to rest of model
     * @param name - User-friendly name (e.g., "Roof Truss 1")
     */
    createSubstructure(
        members: Member[],
        allNodes: Node[],
        boundaryNodeIds: string[],
        name: string = 'Substructure'
    ): Substructure {
        const startTime = performance.now();

        // Collect all nodes used by members
        const nodeIdSet = new Set<string>();
        for (const member of members) {
            nodeIdSet.add(member.startNodeId);
            nodeIdSet.add(member.endNodeId);
        }

        // Create node map for quick lookup
        const nodeMap = new Map<string, Node>();
        for (const node of allNodes) {
            if (nodeIdSet.has(node.id)) {
                nodeMap.set(node.id, node);
            }
        }

        const nodes = Array.from(nodeMap.values());

        // Separate boundary and internal nodes
        const boundarySet = new Set(boundaryNodeIds);
        const internalNodeIds: string[] = [];

        for (const nodeId of nodeIdSet) {
            if (!boundarySet.has(nodeId)) {
                internalNodeIds.push(nodeId);
            }
        }

        // Perform static condensation
        const condensedK = this.staticCondensation(
            nodes,
            members,
            boundaryNodeIds,
            internalNodeIds
        );

        const originalDof = nodes.length * this.dofPerNode;
        const condensedDof = boundaryNodeIds.length * this.dofPerNode;

        const substructure: Substructure = {
            id: `sub_${Date.now()}`,
            name,
            nodes,
            members,
            boundaryNodeIds,
            internalNodeIds,
            condensedK,
            dofPerNode: this.dofPerNode,
            stats: {
                originalNodes: nodes.length,
                originalMembers: members.length,
                boundaryNodes: boundaryNodeIds.length,
                internalNodes: internalNodeIds.length,
                originalDof,
                condensedDof,
                reductionRatio: originalDof / condensedDof,
                condensationTimeMs: performance.now() - startTime
            }
        };

        this.substructures.set(substructure.id, substructure);

        // Create super element
        const superElement = this.createSuperElement(substructure);
        this.superElements.set(superElement.id, superElement);

        return substructure;
    }

    /**
     * Create super element from substructure
     */
    private createSuperElement(substructure: Substructure): SuperElement {
        return {
            id: `se_${substructure.id}`,
            substructureId: substructure.id,
            name: `${substructure.name} (Super Element)`,
            boundaryNodeIds: substructure.boundaryNodeIds,
            stiffnessMatrix: substructure.condensedK,
            dofPerNode: substructure.dofPerNode,
            totalDof: substructure.boundaryNodeIds.length * substructure.dofPerNode
        };
    }

    // ========================================
    // STATIC CONDENSATION (GUYAN REDUCTION)
    // ========================================

    /**
     * Perform static condensation to eliminate internal DOFs
     * 
     * K_reduced = K_bb - K_bi * K_ii^-1 * K_ib
     */
    private staticCondensation(
        nodes: Node[],
        members: Member[],
        boundaryNodeIds: string[],
        internalNodeIds: string[]
    ): number[][] {
        const n = nodes.length * this.dofPerNode;
        const nB = boundaryNodeIds.length * this.dofPerNode;
        const nI = internalNodeIds.length * this.dofPerNode;

        // Create node index maps
        const nodeOrder = [...boundaryNodeIds, ...internalNodeIds];
        const nodeIndexMap = new Map<string, number>();
        nodeOrder.forEach((id, i) => nodeIndexMap.set(id, i));

        // Assemble full stiffness matrix with boundary nodes first
        const K = this.assembleStiffnessMatrix(nodes, members, nodeIndexMap);

        // Partition K into [K_bb K_bi; K_ib K_ii]
        const K_bb = this.extractSubmatrix(K, 0, 0, nB, nB);
        const K_bi = this.extractSubmatrix(K, 0, nB, nB, nI);
        const K_ib = this.extractSubmatrix(K, nB, 0, nI, nB);
        const K_ii = this.extractSubmatrix(K, nB, nB, nI, nI);

        // Invert K_ii
        const K_ii_inv = this.invertMatrix(K_ii);

        // K_bi * K_ii^-1
        const temp = this.multiplyMatrices(K_bi, K_ii_inv);

        // K_bi * K_ii^-1 * K_ib
        const correction = this.multiplyMatrices(temp, K_ib);

        // K_reduced = K_bb - correction
        const K_reduced: number[][] = [];
        for (let i = 0; i < nB; i++) {
            K_reduced[i] = [];
            for (let j = 0; j < nB; j++) {
                K_reduced[i][j] = K_bb[i][j] - correction[i][j];
            }
        }

        return K_reduced;
    }

    /**
     * Assemble stiffness matrix for substructure
     */
    private assembleStiffnessMatrix(
        nodes: Node[],
        members: Member[],
        nodeIndexMap: Map<string, number>
    ): number[][] {
        const n = nodes.length * this.dofPerNode;
        const K: number[][] = Array.from({ length: n }, () => Array(n).fill(0));

        const nodeArray = Array.from(nodeIndexMap.keys()).map(id =>
            nodes.find(node => node.id === id)!
        );

        for (const member of members) {
            const startIdx = nodeIndexMap.get(member.startNodeId);
            const endIdx = nodeIndexMap.get(member.endNodeId);
            if (startIdx === undefined || endIdx === undefined) continue;

            const startNode = nodeArray[startIdx];
            const endNode = nodeArray[endIdx];

            // Element geometry
            const dx = endNode.x - startNode.x;
            const dy = endNode.y - startNode.y;
            const dz = endNode.z - startNode.z;
            const L = Math.sqrt(dx * dx + dy * dy + dz * dz);

            const cx = dx / L, cy = dy / L, cz = dz / L;
            const k = (member.E * member.A) / L;

            // 3D truss element stiffness
            const ke = this.compute3DTrussStiffness(k, cx, cy, cz);

            // DOF mapping
            const dofMap: number[] = [];
            for (let i = 0; i < this.dofPerNode; i++) {
                dofMap.push(startIdx * this.dofPerNode + i);
            }
            for (let i = 0; i < this.dofPerNode; i++) {
                dofMap.push(endIdx * this.dofPerNode + i);
            }

            // Add to global matrix
            for (let i = 0; i < ke.length; i++) {
                for (let j = 0; j < ke.length; j++) {
                    K[dofMap[i]][dofMap[j]] += ke[i][j];
                }
            }
        }

        return K;
    }

    private compute3DTrussStiffness(k: number, cx: number, cy: number, cz: number): number[][] {
        if (this.dofPerNode === 3) {
            return [
                [k * cx * cx, k * cx * cy, k * cx * cz, -k * cx * cx, -k * cx * cy, -k * cx * cz],
                [k * cy * cx, k * cy * cy, k * cy * cz, -k * cy * cx, -k * cy * cy, -k * cy * cz],
                [k * cz * cx, k * cz * cy, k * cz * cz, -k * cz * cx, -k * cz * cy, -k * cz * cz],
                [-k * cx * cx, -k * cx * cy, -k * cx * cz, k * cx * cx, k * cx * cy, k * cx * cz],
                [-k * cy * cx, -k * cy * cy, -k * cy * cz, k * cy * cx, k * cy * cy, k * cy * cz],
                [-k * cz * cx, -k * cz * cy, -k * cz * cz, k * cz * cx, k * cz * cy, k * cz * cz]
            ];
        } else {
            // 6 DOF per node (frame) - simplified axial only
            const size = this.dofPerNode * 2;
            const ke: number[][] = Array.from({ length: size }, () => Array(size).fill(0));

            // Axial terms only
            ke[0][0] = k * cx * cx; ke[0][6] = -k * cx * cx;
            ke[6][0] = -k * cx * cx; ke[6][6] = k * cx * cx;

            return ke;
        }
    }

    // ========================================
    // MATRIX OPERATIONS
    // ========================================

    private extractSubmatrix(
        M: number[][],
        startRow: number,
        startCol: number,
        numRows: number,
        numCols: number
    ): number[][] {
        const sub: number[][] = [];
        for (let i = 0; i < numRows; i++) {
            sub[i] = [];
            for (let j = 0; j < numCols; j++) {
                sub[i][j] = M[startRow + i][startCol + j];
            }
        }
        return sub;
    }

    private multiplyMatrices(A: number[][], B: number[][]): number[][] {
        const m = A.length;
        const n = B[0].length;
        const p = B.length;

        const C: number[][] = Array.from({ length: m }, () => Array(n).fill(0));

        for (let i = 0; i < m; i++) {
            for (let j = 0; j < n; j++) {
                for (let k = 0; k < p; k++) {
                    C[i][j] += A[i][k] * B[k][j];
                }
            }
        }

        return C;
    }

    private invertMatrix(M: number[][]): number[][] {
        const n = M.length;

        // Create augmented matrix [M | I]
        const aug: number[][] = [];
        for (let i = 0; i < n; i++) {
            aug[i] = [...M[i]];
            for (let j = 0; j < n; j++) {
                aug[i].push(i === j ? 1 : 0);
            }
        }

        // Gauss-Jordan elimination
        for (let i = 0; i < n; i++) {
            // Find pivot
            let maxRow = i;
            for (let k = i + 1; k < n; k++) {
                if (Math.abs(aug[k][i]) > Math.abs(aug[maxRow][i])) {
                    maxRow = k;
                }
            }
            [aug[i], aug[maxRow]] = [aug[maxRow], aug[i]];

            // Check for singular matrix
            if (Math.abs(aug[i][i]) < 1e-12) {
                throw new Error('Matrix is singular, cannot invert');
            }

            // Scale pivot row
            const pivot = aug[i][i];
            for (let j = 0; j < 2 * n; j++) {
                aug[i][j] /= pivot;
            }

            // Eliminate column
            for (let k = 0; k < n; k++) {
                if (k !== i) {
                    const factor = aug[k][i];
                    for (let j = 0; j < 2 * n; j++) {
                        aug[k][j] -= factor * aug[i][j];
                    }
                }
            }
        }

        // Extract inverse
        const inv: number[][] = [];
        for (let i = 0; i < n; i++) {
            inv[i] = aug[i].slice(n);
        }

        return inv;
    }

    // ========================================
    // GETTERS
    // ========================================

    getSubstructure(id: string): Substructure | undefined {
        return this.substructures.get(id);
    }

    getSuperElement(id: string): SuperElement | undefined {
        return this.superElements.get(id);
    }

    getAllSubstructures(): Substructure[] {
        return Array.from(this.substructures.values());
    }

    getAllSuperElements(): SuperElement[] {
        return Array.from(this.superElements.values());
    }

    /**
     * Get combined statistics
     */
    getReductionStats(): {
        totalOriginalDof: number;
        totalCondensedDof: number;
        overallReduction: number;
    } {
        let totalOriginal = 0;
        let totalCondensed = 0;

        for (const sub of this.substructures.values()) {
            totalOriginal += sub.stats.originalDof;
            totalCondensed += sub.stats.condensedDof;
        }

        return {
            totalOriginalDof: totalOriginal,
            totalCondensedDof: totalCondensed,
            overallReduction: totalOriginal / totalCondensed
        };
    }

    // ========================================
    // GLOBAL MODEL INTEGRATION
    // ========================================

    /**
     * Add super element contribution to global stiffness matrix
     */
    addSuperElementToGlobal(
        superElement: SuperElement,
        globalK: number[][],
        globalDofMap: Map<string, number>
    ): void {
        const { boundaryNodeIds, stiffnessMatrix, dofPerNode } = superElement;

        // Map super element DOFs to global DOFs
        const seToGlobal: number[] = [];
        for (const nodeId of boundaryNodeIds) {
            const globalNodeIndex = globalDofMap.get(nodeId);
            if (globalNodeIndex === undefined) {
                throw new Error(`Boundary node ${nodeId} not found in global model`);
            }
            for (let d = 0; d < dofPerNode; d++) {
                seToGlobal.push(globalNodeIndex * dofPerNode + d);
            }
        }

        // Add condensed stiffness to global
        const seDof = stiffnessMatrix.length;
        for (let i = 0; i < seDof; i++) {
            for (let j = 0; j < seDof; j++) {
                globalK[seToGlobal[i]][seToGlobal[j]] += stiffnessMatrix[i][j];
            }
        }
    }

    /**
     * Delete substructure
     */
    deleteSubstructure(id: string): boolean {
        const sub = this.substructures.get(id);
        if (!sub) return false;

        this.superElements.delete(`se_${id}`);
        return this.substructures.delete(id);
    }

    /**
     * Clear all
     */
    clear(): void {
        this.substructures.clear();
        this.superElements.clear();
    }
}

export default SubstructureManager;
