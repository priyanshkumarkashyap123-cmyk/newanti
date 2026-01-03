import * as math from "mathjs";
let lastPerformanceMetrics = {
  assemblyTimeMs: 0,
  solveTimeMs: 0,
  postProcessTimeMs: 0,
  totalTimeMs: 0,
  matrixSize: 0,
  sparsity: 0,
  cacheHits: 0,
  cacheMisses: 0
};
function getLastPerformanceMetrics() {
  return { ...lastPerformanceMetrics };
}
const memberStiffnessCache = /* @__PURE__ */ new Map();
const MAX_CACHE_SIZE = 1e3;
function getCachedMemberStiffness(key) {
  const cached = memberStiffnessCache.get(key);
  if (cached) {
    lastPerformanceMetrics.cacheHits++;
    return cached;
  }
  lastPerformanceMetrics.cacheMisses++;
  return void 0;
}
function setCachedMemberStiffness(key, matrix) {
  if (memberStiffnessCache.size >= MAX_CACHE_SIZE) {
    const firstKey = memberStiffnessCache.keys().next().value;
    if (firstKey) memberStiffnessCache.delete(firstKey);
  }
  memberStiffnessCache.set(key, matrix);
}
function generateMemberCacheKey(material, section, L, theory) {
  return `${material.E.toFixed(0)}_${section.A.toFixed(6)}_${section.Iy.toFixed(8)}_${section.Iz.toFixed(8)}_${section.J.toFixed(8)}_${L.toFixed(6)}_${theory}`;
}
function clearSolverCache() {
  memberStiffnessCache.clear();
}
function getSolverCacheStats() {
  return { size: memberStiffnessCache.size, maxSize: MAX_CACHE_SIZE };
}
var BeamTheory = /* @__PURE__ */ ((BeamTheory2) => {
  BeamTheory2["EULER_BERNOULLI"] = "euler_bernoulli";
  BeamTheory2["TIMOSHENKO"] = "timoshenko";
  return BeamTheory2;
})(BeamTheory || {});
function getShearModulus(E, nu = 0.3) {
  return E / (2 * (1 + nu));
}
function getMemberLength(startNode, endNode) {
  const dx = endNode.x - startNode.x;
  const dy = endNode.y - startNode.y;
  const dz = endNode.z - startNode.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}
function getShearFlexibility(E, I, G, kappa, A, L, theory) {
  if (theory === "euler_bernoulli" /* EULER_BERNOULLI */) return 0;
  const As = kappa * A;
  if (G * As * L * L < 1e-20) return 0;
  return 12 * E * I / (G * As * L * L);
}
function getLocalStiffnessMatrix3D(material, section, L, theory) {
  const E = material.E;
  const G = material.G ?? getShearModulus(E, material.nu ?? 0.3);
  const A = section.A;
  const Iy = section.Iy;
  const Iz = section.Iz;
  const J = section.J;
  const kappaY = section.kappaY ?? 5 / 6;
  const kappaZ = section.kappaZ ?? 5 / 6;
  const PhiY = getShearFlexibility(E, Iz, G, kappaY, A, L, theory);
  const PhiZ = getShearFlexibility(E, Iy, G, kappaZ, A, L, theory);
  const EA_L = E * A / L;
  const GJ_L = G * J / L;
  const denomY = 1 + PhiY;
  const a1 = 12 * E * Iz / (L * L * L * denomY);
  const a2 = 6 * E * Iz / (L * L * denomY);
  const a3 = (4 + PhiY) * E * Iz / (L * denomY);
  const a4 = (2 - PhiY) * E * Iz / (L * denomY);
  const denomZ = 1 + PhiZ;
  const b1 = 12 * E * Iy / (L * L * L * denomZ);
  const b2 = 6 * E * Iy / (L * L * denomZ);
  const b3 = (4 + PhiZ) * E * Iy / (L * denomZ);
  const b4 = (2 - PhiZ) * E * Iy / (L * denomZ);
  const K = Array(12).fill(null).map(() => Array(12).fill(0));
  K[0][0] = EA_L;
  K[0][6] = -EA_L;
  K[6][0] = -EA_L;
  K[6][6] = EA_L;
  K[1][1] = a1;
  K[1][5] = a2;
  K[1][7] = -a1;
  K[1][11] = a2;
  K[5][1] = a2;
  K[5][5] = a3;
  K[5][7] = -a2;
  K[5][11] = a4;
  K[7][1] = -a1;
  K[7][5] = -a2;
  K[7][7] = a1;
  K[7][11] = -a2;
  K[11][1] = a2;
  K[11][5] = a4;
  K[11][7] = -a2;
  K[11][11] = a3;
  K[2][2] = b1;
  K[2][4] = -b2;
  K[2][8] = -b1;
  K[2][10] = -b2;
  K[4][2] = -b2;
  K[4][4] = b3;
  K[4][8] = b2;
  K[4][10] = b4;
  K[8][2] = -b1;
  K[8][4] = b2;
  K[8][8] = b1;
  K[8][10] = b2;
  K[10][2] = -b2;
  K[10][4] = b4;
  K[10][8] = b2;
  K[10][10] = b3;
  K[3][3] = GJ_L;
  K[3][9] = -GJ_L;
  K[9][3] = -GJ_L;
  K[9][9] = GJ_L;
  return K;
}
function getTransformationMatrix3D(startNode, endNode) {
  const dx = endNode.x - startNode.x;
  const dy = endNode.y - startNode.y;
  const dz = endNode.z - startNode.z;
  const L = Math.sqrt(dx * dx + dy * dy + dz * dz);
  if (L < 1e-10) {
    return Array(12).fill(null).map(
      (_, i) => Array(12).fill(0).map((_2, j) => i === j ? 1 : 0)
    );
  }
  const localX = [dx / L, dy / L, dz / L];
  let ref;
  if (Math.abs(localX[1]) > 0.999) {
    ref = [1, 0, 0];
  } else {
    ref = [0, 1, 0];
  }
  let localZ = [
    localX[1] * ref[2] - localX[2] * ref[1],
    localX[2] * ref[0] - localX[0] * ref[2],
    localX[0] * ref[1] - localX[1] * ref[0]
  ];
  const normZ = Math.sqrt(localZ[0] ** 2 + localZ[1] ** 2 + localZ[2] ** 2);
  localZ = localZ.map((v) => v / normZ);
  const localY = [
    localZ[1] * localX[2] - localZ[2] * localX[1],
    localZ[2] * localX[0] - localZ[0] * localX[2],
    localZ[0] * localX[1] - localZ[1] * localX[0]
  ];
  const R = [localX, localY, localZ];
  const T = Array(12).fill(null).map(() => Array(12).fill(0));
  for (let block = 0; block < 4; block++) {
    const offset = block * 3;
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        T[offset + i][offset + j] = R[i][j];
      }
    }
  }
  return T;
}
function analyzeStructure3D(request) {
  const startTime = performance.now();
  const { nodes, members, loads, options } = request;
  const defaultTheory = options?.defaultTheory ?? "euler_bernoulli" /* EULER_BERNOULLI */;
  const warnings = [];
  lastPerformanceMetrics = {
    assemblyTimeMs: 0,
    solveTimeMs: 0,
    postProcessTimeMs: 0,
    totalTimeMs: 0,
    matrixSize: 0,
    sparsity: 0,
    cacheHits: 0,
    cacheMisses: 0
  };
  if (nodes.length < 2) {
    return {
      displacements: {},
      reactions: {},
      memberForces: {},
      warnings: [],
      success: false,
      message: "Need at least 2 nodes"
    };
  }
  if (members.length < 1) {
    return {
      displacements: {},
      reactions: {},
      memberForces: {},
      warnings: [],
      success: false,
      message: "Need at least 1 member"
    };
  }
  const nodeIndexMap = /* @__PURE__ */ new Map();
  nodes.forEach((node, idx) => nodeIndexMap.set(node.id, idx));
  const numNodes = nodes.length;
  const dofsPerNode = 6;
  const totalDofs = numNodes * dofsPerNode;
  lastPerformanceMetrics.matrixSize = totalDofs;
  const assemblyStart = performance.now();
  let K = Array(totalDofs).fill(null).map(() => Array(totalDofs).fill(0));
  let F = Array(totalDofs).fill(0);
  for (const member of members) {
    const startIdx = nodeIndexMap.get(member.startNodeId);
    const endIdx = nodeIndexMap.get(member.endNodeId);
    if (startIdx === void 0 || endIdx === void 0) {
      warnings.push(`Member ${member.id}: Node not found`);
      continue;
    }
    const startNode = nodes[startIdx];
    const endNode = nodes[endIdx];
    if (!startNode || !endNode) continue;
    const L = getMemberLength(startNode, endNode);
    if (L < 1e-10) {
      warnings.push(`Member ${member.id}: Zero length`);
      continue;
    }
    const theory = member.theory ?? defaultTheory;
    const effectiveDepth = Math.sqrt(12 * member.section.Iz / member.section.A);
    const LoverD = L / effectiveDepth;
    if (theory === "euler_bernoulli" /* EULER_BERNOULLI */ && LoverD < 10) {
      warnings.push(
        `Member ${member.id}: L/d = ${LoverD.toFixed(1)} < 10. Consider using Timoshenko theory for better accuracy.`
      );
    }
    const cacheKey = generateMemberCacheKey(member.material, member.section, L, theory);
    let kLocal = getCachedMemberStiffness(cacheKey);
    if (!kLocal) {
      kLocal = getLocalStiffnessMatrix3D(member.material, member.section, L, theory);
      setCachedMemberStiffness(cacheKey, kLocal);
    }
    const T = getTransformationMatrix3D(startNode, endNode);
    const TT = math.transpose(T);
    const kGlobal = math.multiply(math.multiply(TT, kLocal), T);
    const dofs = [];
    for (let i = 0; i < 6; i++) dofs.push(startIdx * 6 + i);
    for (let i = 0; i < 6; i++) dofs.push(endIdx * 6 + i);
    for (let i = 0; i < 12; i++) {
      for (let j = 0; j < 12; j++) {
        const di = dofs[i];
        const dj = dofs[j];
        if (di !== void 0 && dj !== void 0) {
          K[di][dj] += kGlobal[i][j];
        }
      }
    }
  }
  lastPerformanceMetrics.assemblyTimeMs = performance.now() - assemblyStart;
  for (const load of loads) {
    const nodeIdx = nodeIndexMap.get(load.nodeId);
    if (nodeIdx === void 0) continue;
    const baseDof = nodeIdx * dofsPerNode;
    F[baseDof + 0] += load.fx ?? 0;
    F[baseDof + 1] += load.fy ?? 0;
    F[baseDof + 2] += load.fz ?? 0;
    F[baseDof + 3] += load.mx ?? 0;
    F[baseDof + 4] += load.my ?? 0;
    F[baseDof + 5] += load.mz ?? 0;
  }
  const restrainedDofs = [];
  const freeDofs = [];
  for (let i = 0; i < numNodes; i++) {
    const node = nodes[i];
    const baseDof = i * dofsPerNode;
    const r = node.restraints ?? { dx: false, dy: false, dz: false, rx: false, ry: false, rz: false };
    if (r.dx) restrainedDofs.push(baseDof + 0);
    else freeDofs.push(baseDof + 0);
    if (r.dy) restrainedDofs.push(baseDof + 1);
    else freeDofs.push(baseDof + 1);
    if (r.dz) restrainedDofs.push(baseDof + 2);
    else freeDofs.push(baseDof + 2);
    if (r.rx) restrainedDofs.push(baseDof + 3);
    else freeDofs.push(baseDof + 3);
    if (r.ry) restrainedDofs.push(baseDof + 4);
    else freeDofs.push(baseDof + 4);
    if (r.rz) restrainedDofs.push(baseDof + 5);
    else freeDofs.push(baseDof + 5);
  }
  if (restrainedDofs.length < 6) {
    return {
      displacements: {},
      reactions: {},
      memberForces: {},
      warnings,
      success: false,
      message: "Structure unstable: need at least 6 restrained DOFs for 3D"
    };
  }
  const nFree = freeDofs.length;
  const Kff = Array(nFree).fill(null).map(() => Array(nFree).fill(0));
  const Ff = Array(nFree).fill(0);
  for (let i = 0; i < nFree; i++) {
    Ff[i] = F[freeDofs[i]];
    for (let j = 0; j < nFree; j++) {
      Kff[i][j] = K[freeDofs[i]][freeDofs[j]];
    }
  }
  let nnz = 0;
  for (let i = 0; i < nFree; i++) {
    for (let j = 0; j < nFree; j++) {
      if (Math.abs(Kff[i][j]) > 1e-14) nnz++;
    }
  }
  lastPerformanceMetrics.sparsity = 1 - nnz / (nFree * nFree);
  const solveStart = performance.now();
  let Uf;
  try {
    const solution = math.lusolve(Kff, Ff);
    Uf = solution.map((row) => row[0] ?? 0);
  } catch {
    return {
      displacements: {},
      reactions: {},
      memberForces: {},
      warnings,
      success: false,
      message: "Matrix singular - structure may be unstable or mechanism"
    };
  }
  lastPerformanceMetrics.solveTimeMs = performance.now() - solveStart;
  const postProcessStart = performance.now();
  const U = Array(totalDofs).fill(0);
  for (let i = 0; i < freeDofs.length; i++) {
    U[freeDofs[i]] = Uf[i];
  }
  const R = math.subtract(math.multiply(K, U), F);
  const displacements = {};
  const reactions = {};
  for (const node of nodes) {
    const idx = nodeIndexMap.get(node.id);
    const baseDof = idx * dofsPerNode;
    displacements[node.id] = {
      dx: U[baseDof + 0],
      dy: U[baseDof + 1],
      dz: U[baseDof + 2],
      rx: U[baseDof + 3],
      ry: U[baseDof + 4],
      rz: U[baseDof + 5]
    };
    const r = node.restraints;
    if (r?.dx || r?.dy || r?.dz || r?.rx || r?.ry || r?.rz) {
      reactions[node.id] = {
        fx: R[baseDof + 0],
        fy: R[baseDof + 1],
        fz: R[baseDof + 2],
        mx: R[baseDof + 3],
        my: R[baseDof + 4],
        mz: R[baseDof + 5]
      };
    }
  }
  const memberForces = {};
  for (const member of members) {
    const startIdx = nodeIndexMap.get(member.startNodeId);
    const endIdx = nodeIndexMap.get(member.endNodeId);
    if (startIdx === void 0 || endIdx === void 0) continue;
    const startNode = nodes[startIdx];
    const endNode = nodes[endIdx];
    const L = getMemberLength(startNode, endNode);
    if (L < 1e-10) continue;
    const theory = member.theory ?? defaultTheory;
    const uGlobal = [];
    for (let i = 0; i < 6; i++) uGlobal.push(U[startIdx * 6 + i]);
    for (let i = 0; i < 6; i++) uGlobal.push(U[endIdx * 6 + i]);
    const T = getTransformationMatrix3D(startNode, endNode);
    const uLocal = math.multiply(T, uGlobal);
    const kLocal = getLocalStiffnessMatrix3D(member.material, member.section, L, theory);
    const fLocal = math.multiply(kLocal, uLocal);
    memberForces[member.id] = {
      axialStart: -fLocal[0],
      // Tension positive
      shearYStart: fLocal[1],
      shearZStart: fLocal[2],
      torsionStart: fLocal[3],
      momentYStart: fLocal[4],
      momentZStart: fLocal[5],
      axialEnd: fLocal[6],
      shearYEnd: fLocal[7],
      shearZEnd: fLocal[8],
      torsionEnd: fLocal[9],
      momentYEnd: fLocal[10],
      momentZEnd: fLocal[11]
    };
  }
  lastPerformanceMetrics.postProcessTimeMs = performance.now() - postProcessStart;
  lastPerformanceMetrics.totalTimeMs = performance.now() - startTime;
  return {
    displacements,
    reactions,
    memberForces,
    warnings,
    success: true,
    message: `Analysis completed: ${nodes.length} nodes, ${members.length} members, ${freeDofs.length} DOFs`,
    performanceMetrics: lastPerformanceMetrics
  };
}
import { analyzeStructure } from "./solver";
export {
  BeamTheory,
  analyzeStructure,
  analyzeStructure3D,
  clearSolverCache,
  getLastPerformanceMetrics,
  getSolverCacheStats
};
//# sourceMappingURL=solver3d.js.map
