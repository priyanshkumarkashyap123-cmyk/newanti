class LRUCache {
  cache;
  maxSize;
  // Max memory in bytes
  currentSize;
  hits;
  misses;
  constructor(maxSizeMB = 100) {
    this.cache = /* @__PURE__ */ new Map();
    this.maxSize = maxSizeMB * 1024 * 1024;
    this.currentSize = 0;
    this.hits = 0;
    this.misses = 0;
  }
  get(key) {
    const entry = this.cache.get(key);
    if (entry) {
      this.cache.delete(key);
      this.cache.set(key, entry);
      this.hits++;
      return entry.value;
    }
    this.misses++;
    return void 0;
  }
  set(key, value, size) {
    if (this.cache.has(key)) {
      const existing = this.cache.get(key);
      this.currentSize -= existing.size;
      this.cache.delete(key);
    }
    while (this.currentSize + size > this.maxSize && this.cache.size > 0) {
      const oldest = this.cache.keys().next().value;
      if (oldest) {
        const entry2 = this.cache.get(oldest);
        this.currentSize -= entry2.size;
        this.cache.delete(oldest);
      }
    }
    const entry = {
      key,
      value,
      timestamp: Date.now(),
      size
    };
    this.cache.set(key, entry);
    this.currentSize += size;
  }
  has(key) {
    return this.cache.has(key);
  }
  delete(key) {
    const entry = this.cache.get(key);
    if (entry) {
      this.currentSize -= entry.size;
      return this.cache.delete(key);
    }
    return false;
  }
  clear() {
    this.cache.clear();
    this.currentSize = 0;
    this.hits = 0;
    this.misses = 0;
  }
  getStats() {
    return {
      hits: this.hits,
      misses: this.misses,
      size: this.currentSize,
      maxSize: this.maxSize,
      entries: this.cache.size
    };
  }
}
function generateModelHash(model) {
  const nodeStr = model.nodes.map((n) => `${n.id}:${n.x.toFixed(6)},${n.y.toFixed(6)},${n.z.toFixed(6)}`).sort().join("|");
  const memberStr = model.members.map((m) => `${m.id}:${m.startNodeId}-${m.endNodeId}`).sort().join("|");
  const restraintStr = model.nodes.filter((n) => n.restraints).map((n) => {
    const r = n.restraints || {};
    return `${n.id}:${r.dx || 0},${r.dy || 0},${r.dz || 0},${r.rx || 0},${r.ry || 0},${r.rz || 0}`;
  }).join("|");
  const combined = `${nodeStr}||${memberStr}||${restraintStr}`;
  return simpleHash(combined);
}
function generateLoadsHash(loads) {
  const loadStr = loads.map((l) => `${l.nodeId}:${l.fx || 0},${l.fy || 0},${l.fz || 0},${l.mx || 0},${l.my || 0},${l.mz || 0}`).sort().join("|");
  return simpleHash(loadStr);
}
function simpleHash(str) {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) + hash + str.charCodeAt(i);
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16);
}
class StructuralSolverCache {
  matrixCache;
  memberStiffnessCache;
  constructor(maxSizeMB = 200) {
    this.matrixCache = new LRUCache(maxSizeMB * 0.8);
    this.memberStiffnessCache = new LRUCache(maxSizeMB * 0.2);
  }
  /**
   * Get cached global stiffness matrix if model hasn't changed
   */
  getStiffnessMatrix(modelHash) {
    const entry = this.matrixCache.get(`stiffness:${modelHash}`);
    return entry?.stiffnessMatrix;
  }
  /**
   * Cache global stiffness matrix
   */
  setStiffnessMatrix(modelHash, matrix) {
    const entry = {
      modelHash,
      stiffnessMatrix: matrix
    };
    const n = matrix.K.length;
    const size = n * n * 8 + (matrix.freeDofs.length + matrix.restrainedDofs.length) * 4;
    this.matrixCache.set(`stiffness:${modelHash}`, entry, size);
  }
  /**
   * Get cached member stiffness matrix
   */
  getMemberStiffness(memberKey) {
    return this.memberStiffnessCache.get(`member:${memberKey}`);
  }
  /**
   * Cache member stiffness matrix
   */
  setMemberStiffness(memberKey, matrix) {
    this.memberStiffnessCache.set(`member:${memberKey}`, matrix, 1152);
  }
  /**
   * Generate member cache key
   */
  generateMemberKey(member) {
    return `${member.E.toFixed(0)}_${member.A.toFixed(4)}_${member.Iy.toFixed(6)}_${member.Iz.toFixed(6)}_${member.J.toFixed(6)}_${member.length.toFixed(4)}_${member.theory}`;
  }
  /**
   * Clear all caches
   */
  clear() {
    this.matrixCache.clear();
    this.memberStiffnessCache.clear();
  }
  /**
   * Get cache statistics
   */
  getStats() {
    return {
      matrixCache: this.matrixCache.getStats(),
      memberCache: this.memberStiffnessCache.getStats()
    };
  }
}
function chunkArray(array, chunkSize) {
  const chunks = [];
  for (let i = 0; i < array.length; i += chunkSize) {
    chunks.push(array.slice(i, i + chunkSize));
  }
  return chunks;
}
async function parallelProcess(items, processor, maxConcurrency = 4) {
  const results = [];
  const chunks = chunkArray(items, maxConcurrency);
  for (const chunk of chunks) {
    const chunkResults = await Promise.all(chunk.map(processor));
    results.push(...chunkResults);
  }
  return results;
}
function isWebWorkerSupported() {
  return typeof globalThis !== "undefined" && "Worker" in globalThis;
}
function getOptimalWorkerCount() {
  if (typeof navigator !== "undefined" && navigator.hardwareConcurrency) {
    return Math.max(1, Math.floor(navigator.hardwareConcurrency / 2));
  }
  return 2;
}
function getSparsity(matrix) {
  const n = matrix.length;
  let nnz = 0;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (Math.abs(matrix[i][j]) > 1e-14) {
        nnz++;
      }
    }
  }
  return {
    nnz,
    sparsity: 1 - nnz / (n * n)
  };
}
function toCSR(matrix) {
  const n = matrix.length;
  const values = [];
  const colIndices = [];
  const rowPointers = [0];
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const val = matrix[i][j];
      if (Math.abs(val) > 1e-14) {
        values.push(val);
        colIndices.push(j);
      }
    }
    rowPointers.push(values.length);
  }
  return { values, colIndices, rowPointers, n };
}
function estimateMemoryUsage(nodeCount, dofPerNode = 6) {
  const totalDofs = nodeCount * dofPerNode;
  const denseSize = totalDofs * totalDofs * 8;
  const sparseSize = totalDofs * 12 * 12;
  return {
    denseMatrixMB: denseSize / (1024 * 1024),
    sparseEstimateMB: sparseSize / (1024 * 1024),
    recommended: nodeCount > 500 ? "sparse" : "dense"
  };
}
const solverCache = new StructuralSolverCache();
var SolverCache_default = solverCache;
export {
  LRUCache,
  chunkArray,
  SolverCache_default as default,
  estimateMemoryUsage,
  generateLoadsHash,
  generateModelHash,
  getOptimalWorkerCount,
  getSparsity,
  isWebWorkerSupported,
  parallelProcess,
  solverCache,
  toCSR
};
//# sourceMappingURL=SolverCache.js.map
