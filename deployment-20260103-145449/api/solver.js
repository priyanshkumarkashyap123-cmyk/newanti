import * as math from "mathjs";
function getLocalStiffnessMatrix(E, A, I, L) {
  const EA_L = E * A / L;
  const EI_L3 = 12 * E * I / (L * L * L);
  const EI_L2 = 6 * E * I / (L * L);
  const EI_L = 4 * E * I / L;
  const EI_L_2 = 2 * E * I / L;
  return [
    [EA_L, 0, 0, -EA_L, 0, 0],
    [0, EI_L3, EI_L2, 0, -EI_L3, EI_L2],
    [0, EI_L2, EI_L, 0, -EI_L2, EI_L_2],
    [-EA_L, 0, 0, EA_L, 0, 0],
    [0, -EI_L3, -EI_L2, 0, EI_L3, -EI_L2],
    [0, EI_L2, EI_L_2, 0, -EI_L2, EI_L]
  ];
}
function getTransformationMatrix(cos, sin) {
  return [
    [cos, sin, 0, 0, 0, 0],
    [-sin, cos, 0, 0, 0, 0],
    [0, 0, 1, 0, 0, 0],
    [0, 0, 0, cos, sin, 0],
    [0, 0, 0, -sin, cos, 0],
    [0, 0, 0, 0, 0, 1]
  ];
}
function analyzeStructure(request) {
  const { nodes, members, loads } = request;
  if (nodes.length < 2) {
    return { displacements: {}, reactions: {}, memberForces: {}, success: false, message: "Need at least 2 nodes" };
  }
  if (members.length < 1) {
    return { displacements: {}, reactions: {}, memberForces: {}, success: false, message: "Need at least 1 member" };
  }
  const nodeIndexMap = /* @__PURE__ */ new Map();
  nodes.forEach((node, idx) => nodeIndexMap.set(node.id, idx));
  const numNodes = nodes.length;
  const dofsPerNode = 3;
  const totalDofs = numNodes * dofsPerNode;
  let K = Array(totalDofs).fill(null).map(() => Array(totalDofs).fill(0));
  let F = Array(totalDofs).fill(0);
  for (const member of members) {
    const startIdx = nodeIndexMap.get(member.startNodeId);
    const endIdx = nodeIndexMap.get(member.endNodeId);
    if (startIdx === void 0 || endIdx === void 0) continue;
    const startNode = nodes[startIdx];
    const endNode = nodes[endIdx];
    if (!startNode || !endNode) continue;
    const dx = endNode.x - startNode.x;
    const dy = endNode.y - startNode.y;
    const L = Math.sqrt(dx * dx + dy * dy);
    if (L < 1e-10) continue;
    const cos = dx / L;
    const sin = dy / L;
    const E = member.E ?? 2e8;
    const A = member.A ?? 0.01;
    const I = member.I ?? 1e-4;
    const kLocal = getLocalStiffnessMatrix(E, A, I, L);
    const T = getTransformationMatrix(cos, sin);
    const TT = math.transpose(T);
    const kGlobal = math.multiply(math.multiply(TT, kLocal), T);
    const dofs = [
      startIdx * 3,
      startIdx * 3 + 1,
      startIdx * 3 + 2,
      endIdx * 3,
      endIdx * 3 + 1,
      endIdx * 3 + 2
    ];
    for (let i = 0; i < 6; i++) {
      for (let j = 0; j < 6; j++) {
        const di = dofs[i];
        const dj = dofs[j];
        const kRow = kGlobal[i];
        if (di !== void 0 && dj !== void 0 && kRow !== void 0) {
          const KRow = K[di];
          const kVal = kRow[j];
          if (KRow !== void 0 && kVal !== void 0) {
            KRow[dj] = (KRow[dj] ?? 0) + kVal;
          }
        }
      }
    }
  }
  for (const load of loads) {
    const nodeIdx = nodeIndexMap.get(load.nodeId);
    if (nodeIdx === void 0) continue;
    const baseDof = nodeIdx * dofsPerNode;
    F[baseDof] += load.fx ?? 0;
    F[baseDof + 1] += load.fy ?? 0;
    F[baseDof + 2] += load.mz ?? 0;
  }
  const restrainedDofs = [];
  const freeDofs = [];
  for (let i = 0; i < numNodes; i++) {
    const node = nodes[i];
    const baseDof = i * dofsPerNode;
    if (node.restraints?.fx) restrainedDofs.push(baseDof);
    else freeDofs.push(baseDof);
    if (node.restraints?.fy) restrainedDofs.push(baseDof + 1);
    else freeDofs.push(baseDof + 1);
    if (node.restraints?.mz) restrainedDofs.push(baseDof + 2);
    else freeDofs.push(baseDof + 2);
  }
  if (restrainedDofs.length < 3) {
    return { displacements: {}, reactions: {}, memberForces: {}, success: false, message: "Structure is unstable - needs at least 3 restrained DOFs" };
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
  let Uf;
  try {
    const solution = math.lusolve(Kff, Ff);
    Uf = solution.map((row) => row[0] ?? 0);
  } catch (error) {
    return { displacements: {}, reactions: {}, memberForces: {}, success: false, message: "Matrix is singular - structure may be unstable" };
  }
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
      dx: U[baseDof],
      dy: U[baseDof + 1],
      dz: 0,
      rx: 0,
      ry: 0,
      rz: U[baseDof + 2]
    };
    if (node.restraints?.fx || node.restraints?.fy || node.restraints?.mz) {
      reactions[node.id] = {
        fx: R[baseDof],
        fy: R[baseDof + 1],
        fz: 0,
        mx: 0,
        my: 0,
        mz: R[baseDof + 2]
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
    const dx = endNode.x - startNode.x;
    const dy = endNode.y - startNode.y;
    const L = Math.sqrt(dx * dx + dy * dy);
    if (L < 1e-10) continue;
    const cos = dx / L;
    const sin = dy / L;
    const E = member.E ?? 2e8;
    const A = member.A ?? 0.01;
    const I = member.I ?? 1e-4;
    const uGlobal = [
      U[startIdx * 3],
      U[startIdx * 3 + 1],
      U[startIdx * 3 + 2],
      U[endIdx * 3],
      U[endIdx * 3 + 1],
      U[endIdx * 3 + 2]
    ];
    const T = getTransformationMatrix(cos, sin);
    const uLocal = math.multiply(T, uGlobal);
    const kLocal = getLocalStiffnessMatrix(E, A, I, L);
    const fLocal = math.multiply(kLocal, uLocal);
    memberForces[member.id] = {
      axial: -fLocal[0],
      // Tension positive
      shearY: fLocal[1],
      shearZ: 0,
      momentY: 0,
      momentZ: fLocal[2],
      torsion: 0
    };
  }
  return {
    displacements,
    reactions,
    memberForces,
    success: true,
    message: "Analysis completed successfully"
  };
}
export {
  analyzeStructure
};
//# sourceMappingURL=solver.js.map
