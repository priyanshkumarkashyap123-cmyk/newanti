/**
 * SolverCache.ts - Intelligent Caching for Structural Analysis
 * 
 * Features:
 * - LRU cache for stiffness matrices
 * - Model hash for change detection
 * - Partial recalculation on minor changes
 * - Memory-efficient storage
 */

// ============================================
// TYPES
// ============================================

export interface CacheEntry<T> {
    key: string;
    value: T;
    timestamp: number;
    size: number;  // Approximate memory size in bytes
}

export interface CacheStats {
    hits: number;
    misses: number;
    size: number;
    maxSize: number;
    entries: number;
}

// ============================================
// LRU CACHE IMPLEMENTATION
// ============================================

export class LRUCache<T> {
    private cache: Map<string, CacheEntry<T>>;
    private maxSize: number;  // Max memory in bytes
    private currentSize: number;
    private hits: number;
    private misses: number;

    constructor(maxSizeMB: number = 100) {
        this.cache = new Map();
        this.maxSize = maxSizeMB * 1024 * 1024;  // Convert MB to bytes
        this.currentSize = 0;
        this.hits = 0;
        this.misses = 0;
    }

    get(key: string): T | undefined {
        const entry = this.cache.get(key);
        
        if (entry) {
            // Move to end (most recently used)
            this.cache.delete(key);
            this.cache.set(key, entry);
            this.hits++;
            return entry.value;
        }
        
        this.misses++;
        return undefined;
    }

    set(key: string, value: T, size: number): void {
        // Remove if already exists
        if (this.cache.has(key)) {
            const existing = this.cache.get(key)!;
            this.currentSize -= existing.size;
            this.cache.delete(key);
        }

        // Evict entries if necessary
        while (this.currentSize + size > this.maxSize && this.cache.size > 0) {
            const oldest = this.cache.keys().next().value;
            if (oldest) {
                const entry = this.cache.get(oldest)!;
                this.currentSize -= entry.size;
                this.cache.delete(oldest);
            }
        }

        // Add new entry
        const entry: CacheEntry<T> = {
            key,
            value,
            timestamp: Date.now(),
            size
        };
        
        this.cache.set(key, entry);
        this.currentSize += size;
    }

    has(key: string): boolean {
        return this.cache.has(key);
    }

    delete(key: string): boolean {
        const entry = this.cache.get(key);
        if (entry) {
            this.currentSize -= entry.size;
            return this.cache.delete(key);
        }
        return false;
    }

    clear(): void {
        this.cache.clear();
        this.currentSize = 0;
        this.hits = 0;
        this.misses = 0;
    }

    getStats(): CacheStats {
        return {
            hits: this.hits,
            misses: this.misses,
            size: this.currentSize,
            maxSize: this.maxSize,
            entries: this.cache.size
        };
    }
}

// ============================================
// MODEL HASH UTILITIES
// ============================================

/**
 * Generate a hash for a structural model to detect changes
 */
export function generateModelHash(model: {
    nodes: Array<{ id: string; x: number; y: number; z: number; restraints?: any }>;
    members: Array<{ id: string; startNodeId: string; endNodeId: string; material?: any; section?: any }>;
    loads?: Array<{ nodeId: string; fx?: number; fy?: number; fz?: number }>;
}): string {
    // Simple hash based on model geometry
    const nodeStr = model.nodes
        .map(n => `${n.id}:${n.x.toFixed(6)},${n.y.toFixed(6)},${n.z.toFixed(6)}`)
        .sort()
        .join('|');
    
    const memberStr = model.members
        .map(m => `${m.id}:${m.startNodeId}-${m.endNodeId}`)
        .sort()
        .join('|');
    
    const restraintStr = model.nodes
        .filter(n => n.restraints)
        .map(n => {
            const r = n.restraints || {};
            return `${n.id}:${r.dx || 0},${r.dy || 0},${r.dz || 0},${r.rx || 0},${r.ry || 0},${r.rz || 0}`;
        })
        .join('|');
    
    // Simple string hash
    const combined = `${nodeStr}||${memberStr}||${restraintStr}`;
    return simpleHash(combined);
}

/**
 * Generate a hash for loads only (for incremental updates)
 */
export function generateLoadsHash(loads: Array<{
    nodeId: string;
    fx?: number;
    fy?: number;
    fz?: number;
    mx?: number;
    my?: number;
    mz?: number;
}>): string {
    const loadStr = loads
        .map(l => `${l.nodeId}:${l.fx || 0},${l.fy || 0},${l.fz || 0},${l.mx || 0},${l.my || 0},${l.mz || 0}`)
        .sort()
        .join('|');
    
    return simpleHash(loadStr);
}

/**
 * Simple string hash function (djb2)
 */
function simpleHash(str: string): string {
    let hash = 5381;
    for (let i = 0; i < str.length; i++) {
        hash = ((hash << 5) + hash) + str.charCodeAt(i);
        hash = hash & hash;  // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(16);
}

// ============================================
// SOLVER CACHE
// ============================================

interface StiffnessMatrixCache {
    K: number[][];
    freeDofs: number[];
    restrainedDofs: number[];
}

interface SolverCacheEntry {
    modelHash: string;
    stiffnessMatrix: StiffnessMatrixCache;
    factorization?: {
        L: number[][];  // Lower triangular (Cholesky)
        D: number[];    // Diagonal
    };
}

class StructuralSolverCache {
    private matrixCache: LRUCache<SolverCacheEntry>;
    private memberStiffnessCache: LRUCache<number[][]>;

    constructor(maxSizeMB: number = 200) {
        this.matrixCache = new LRUCache(maxSizeMB * 0.8);
        this.memberStiffnessCache = new LRUCache(maxSizeMB * 0.2);
    }

    /**
     * Get cached global stiffness matrix if model hasn't changed
     */
    getStiffnessMatrix(modelHash: string): StiffnessMatrixCache | undefined {
        const entry = this.matrixCache.get(`stiffness:${modelHash}`);
        return entry?.stiffnessMatrix;
    }

    /**
     * Cache global stiffness matrix
     */
    setStiffnessMatrix(modelHash: string, matrix: StiffnessMatrixCache): void {
        const entry: SolverCacheEntry = {
            modelHash,
            stiffnessMatrix: matrix
        };
        
        // Estimate size: n*n*8 bytes for matrix
        const n = matrix.K.length;
        const size = n * n * 8 + (matrix.freeDofs.length + matrix.restrainedDofs.length) * 4;
        
        this.matrixCache.set(`stiffness:${modelHash}`, entry, size);
    }

    /**
     * Get cached member stiffness matrix
     */
    getMemberStiffness(memberKey: string): number[][] | undefined {
        return this.memberStiffnessCache.get(`member:${memberKey}`);
    }

    /**
     * Cache member stiffness matrix
     */
    setMemberStiffness(memberKey: string, matrix: number[][]): void {
        // 12x12 matrix = 144 * 8 = 1152 bytes
        this.memberStiffnessCache.set(`member:${memberKey}`, matrix, 1152);
    }

    /**
     * Generate member cache key
     */
    generateMemberKey(member: {
        E: number;
        A: number;
        Iy: number;
        Iz: number;
        J: number;
        length: number;
        theory: string;
    }): string {
        return `${member.E.toFixed(0)}_${member.A.toFixed(4)}_${member.Iy.toFixed(6)}_${member.Iz.toFixed(6)}_${member.J.toFixed(6)}_${member.length.toFixed(4)}_${member.theory}`;
    }

    /**
     * Clear all caches
     */
    clear(): void {
        this.matrixCache.clear();
        this.memberStiffnessCache.clear();
    }

    /**
     * Get cache statistics
     */
    getStats(): { matrixCache: CacheStats; memberCache: CacheStats } {
        return {
            matrixCache: this.matrixCache.getStats(),
            memberCache: this.memberStiffnessCache.getStats()
        };
    }
}

// ============================================
// PARALLEL PROCESSING UTILITIES
// ============================================

/**
 * Split array into chunks for parallel processing
 */
export function chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += chunkSize) {
        chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
}

/**
 * Process items in parallel batches
 */
export async function parallelProcess<T, R>(
    items: T[],
    processor: (item: T) => Promise<R>,
    maxConcurrency: number = 4
): Promise<R[]> {
    const results: R[] = [];
    const chunks = chunkArray(items, maxConcurrency);
    
    for (const chunk of chunks) {
        const chunkResults = await Promise.all(chunk.map(processor));
        results.push(...chunkResults);
    }
    
    return results;
}

/**
 * Check if Web Workers are available
 */
export function isWebWorkerSupported(): boolean {
    return typeof globalThis !== 'undefined' && 'Worker' in globalThis;
}

/**
 * Get optimal number of workers based on hardware
 */
export function getOptimalWorkerCount(): number {
    if (typeof navigator !== 'undefined' && navigator.hardwareConcurrency) {
        // Use half of available cores to leave resources for main thread
        return Math.max(1, Math.floor(navigator.hardwareConcurrency / 2));
    }
    return 2;  // Default fallback
}

// ============================================
// MATRIX OPTIMIZATION UTILITIES
// ============================================

/**
 * Check if matrix is sparse enough to benefit from sparse storage
 */
export function getSparsity(matrix: number[][]): { sparsity: number; nnz: number } {
    const n = matrix.length;
    let nnz = 0;
    
    for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) {
            if (Math.abs(matrix[i]![j]!) > 1e-14) {
                nnz++;
            }
        }
    }
    
    return {
        nnz,
        sparsity: 1 - (nnz / (n * n))
    };
}

/**
 * Convert dense matrix to CSR format for sparse operations
 */
export function toCSR(matrix: number[][]): {
    values: number[];
    colIndices: number[];
    rowPointers: number[];
    n: number;
} {
    const n = matrix.length;
    const values: number[] = [];
    const colIndices: number[] = [];
    const rowPointers: number[] = [0];
    
    for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) {
            const val = matrix[i]![j]!;
            if (Math.abs(val) > 1e-14) {
                values.push(val);
                colIndices.push(j);
            }
        }
        rowPointers.push(values.length);
    }
    
    return { values, colIndices, rowPointers, n };
}

/**
 * Estimate memory usage for analysis
 */
export function estimateMemoryUsage(nodeCount: number, dofPerNode: number = 6): {
    denseMatrixMB: number;
    sparseEstimateMB: number;
    recommended: 'dense' | 'sparse';
} {
    const totalDofs = nodeCount * dofPerNode;
    const denseSize = totalDofs * totalDofs * 8;  // 8 bytes per double
    
    // Estimate sparse: typically 10-15 entries per row for structural matrices
    const sparseSize = totalDofs * 12 * 12;  // Approximate
    
    return {
        denseMatrixMB: denseSize / (1024 * 1024),
        sparseEstimateMB: sparseSize / (1024 * 1024),
        recommended: nodeCount > 500 ? 'sparse' : 'dense'
    };
}

// ============================================
// SINGLETON INSTANCE
// ============================================

export const solverCache = new StructuralSolverCache();

export default solverCache;
