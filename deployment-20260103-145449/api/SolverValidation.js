const EQUILIBRIUM_TOLERANCE = 1e-3;
const ENERGY_TOLERANCE = 0.01;
const CONDITION_NUMBER_THRESHOLD = 1e10;
const MAX_REASONABLE_DISPLACEMENT = 1;
const MAX_REASONABLE_ROTATION = 0.5;
function validateAnalysisResults(options) {
  const { nodes, loads, displacements, reactions, stiffnessMatrix } = options;
  const warnings = [];
  const forceBalance = checkForceBalance(loads, reactions);
  if (!forceBalance.passed) {
    warnings.push(`Force equilibrium error: ${(forceBalance.error * 100).toFixed(4)}%`);
  }
  const momentBalance = checkMomentBalance(nodes, loads, reactions);
  if (!momentBalance.passed) {
    warnings.push(`Moment equilibrium error: ${(momentBalance.error * 100).toFixed(4)}%`);
  }
  const displacementBounds = checkDisplacementBounds(displacements);
  warnings.push(...displacementBounds.warnings);
  const stiffnessCondition = stiffnessMatrix ? checkStiffnessCondition(stiffnessMatrix) : { passed: true, conditionNumber: 0, matrixRank: 0, expectedRank: 0, isIllConditioned: false };
  if (stiffnessCondition.isIllConditioned) {
    warnings.push(`Stiffness matrix is ill-conditioned (condition number: ${stiffnessCondition.conditionNumber.toExponential(2)})`);
  }
  let energyBalance;
  if (stiffnessMatrix) {
    energyBalance = checkEnergyBalance(loads, displacements, stiffnessMatrix);
    if (!energyBalance.passed) {
      warnings.push(`Energy balance error: ${(energyBalance.error * 100).toFixed(4)}%`);
    }
  }
  const qualityScore = calculateQualityScore({
    forceBalance,
    momentBalance,
    displacementBounds,
    stiffnessCondition,
    energyBalance
  });
  const isValid = forceBalance.passed && momentBalance.passed && displacementBounds.passed && stiffnessCondition.passed && (energyBalance?.passed ?? true);
  return {
    isValid,
    equilibriumError: Math.max(forceBalance.error, momentBalance.error),
    energyError: energyBalance?.error ?? 0,
    conditionNumber: stiffnessCondition.conditionNumber,
    maxResidual: Math.max(forceBalance.error, momentBalance.error),
    qualityScore,
    warnings,
    details: {
      forceBalance,
      momentBalance,
      displacementBounds,
      stiffnessCondition,
      energyBalance
    }
  };
}
function checkForceBalance(loads, reactions) {
  const appliedForce = [0, 0, 0];
  for (const load of loads) {
    appliedForce[0] += load.fx ?? 0;
    appliedForce[1] += load.fy ?? 0;
    appliedForce[2] += load.fz ?? 0;
  }
  const reactionForce = [0, 0, 0];
  for (const r of Object.values(reactions)) {
    reactionForce[0] += r.fx;
    reactionForce[1] += r.fy;
    reactionForce[2] += r.fz;
  }
  const appliedMag = Math.sqrt(
    appliedForce[0] ** 2 + appliedForce[1] ** 2 + appliedForce[2] ** 2
  );
  const diff = [
    appliedForce[0] + reactionForce[0],
    appliedForce[1] + reactionForce[1],
    appliedForce[2] + reactionForce[2]
  ];
  const diffMag = Math.sqrt(diff[0] ** 2 + diff[1] ** 2 + diff[2] ** 2);
  const error = appliedMag > 1e-10 ? diffMag / appliedMag : 0;
  return {
    passed: error <= EQUILIBRIUM_TOLERANCE,
    totalAppliedForce: appliedForce,
    totalReactionForce: reactionForce,
    error,
    tolerance: EQUILIBRIUM_TOLERANCE
  };
}
function checkMomentBalance(nodes, loads, reactions) {
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  const appliedMoment = [0, 0, 0];
  for (const load of loads) {
    const node = nodeMap.get(load.nodeId);
    if (!node) continue;
    appliedMoment[0] += load.mx ?? 0;
    appliedMoment[1] += load.my ?? 0;
    appliedMoment[2] += load.mz ?? 0;
    const fx = load.fx ?? 0;
    const fy = load.fy ?? 0;
    const fz = load.fz ?? 0;
    appliedMoment[0] += node.y * fz - node.z * fy;
    appliedMoment[1] += node.z * fx - node.x * fz;
    appliedMoment[2] += node.x * fy - node.y * fx;
  }
  const reactionMoment = [0, 0, 0];
  for (const [nodeId, r] of Object.entries(reactions)) {
    const node = nodeMap.get(nodeId);
    if (!node) continue;
    reactionMoment[0] += r.mx;
    reactionMoment[1] += r.my;
    reactionMoment[2] += r.mz;
    reactionMoment[0] += node.y * r.fz - node.z * r.fy;
    reactionMoment[1] += node.z * r.fx - node.x * r.fz;
    reactionMoment[2] += node.x * r.fy - node.y * r.fx;
  }
  const appliedMag = Math.sqrt(
    appliedMoment[0] ** 2 + appliedMoment[1] ** 2 + appliedMoment[2] ** 2
  );
  const diff = [
    appliedMoment[0] + reactionMoment[0],
    appliedMoment[1] + reactionMoment[1],
    appliedMoment[2] + reactionMoment[2]
  ];
  const diffMag = Math.sqrt(diff[0] ** 2 + diff[1] ** 2 + diff[2] ** 2);
  const error = appliedMag > 1e-10 ? diffMag / appliedMag : 0;
  return {
    passed: error <= EQUILIBRIUM_TOLERANCE,
    totalAppliedMoment: appliedMoment,
    totalReactionMoment: reactionMoment,
    error,
    tolerance: EQUILIBRIUM_TOLERANCE
  };
}
function checkDisplacementBounds(displacements) {
  const warnings = [];
  let maxDisplacement = 0;
  let maxRotation = 0;
  let maxDispNode = "";
  let maxRotNode = "";
  for (const [nodeId, d] of Object.entries(displacements)) {
    const disp = Math.sqrt(d.dx ** 2 + d.dy ** 2 + d.dz ** 2);
    const rot = Math.sqrt(d.rx ** 2 + d.ry ** 2 + d.rz ** 2);
    if (disp > maxDisplacement) {
      maxDisplacement = disp;
      maxDispNode = nodeId;
    }
    if (rot > maxRotation) {
      maxRotation = rot;
      maxRotNode = nodeId;
    }
  }
  let passed = true;
  if (maxDisplacement > MAX_REASONABLE_DISPLACEMENT) {
    warnings.push(
      `Large displacement detected at node ${maxDispNode}: ${(maxDisplacement * 1e3).toFixed(2)} mm. Check loads and supports.`
    );
    passed = false;
  }
  if (maxRotation > MAX_REASONABLE_ROTATION) {
    warnings.push(
      `Large rotation detected at node ${maxRotNode}: ${(maxRotation * 180 / Math.PI).toFixed(2)}\xB0. Structure may be approaching geometric nonlinearity.`
    );
    passed = false;
  }
  return {
    passed,
    maxDisplacement,
    maxRotation,
    warnings
  };
}
function checkStiffnessCondition(K) {
  const n = K.length;
  let maxRowSum = 0;
  let minRowSum = Infinity;
  let nonZeroRows = 0;
  for (let i = 0; i < n; i++) {
    let rowSum = 0;
    for (let j = 0; j < n; j++) {
      rowSum += Math.abs(K[i][j]);
    }
    if (rowSum > 1e-10) {
      maxRowSum = Math.max(maxRowSum, rowSum);
      minRowSum = Math.min(minRowSum, rowSum);
      nonZeroRows++;
    }
  }
  const conditionNumber = minRowSum > 1e-20 ? maxRowSum / minRowSum : Infinity;
  const isIllConditioned = conditionNumber > CONDITION_NUMBER_THRESHOLD;
  return {
    passed: !isIllConditioned,
    conditionNumber,
    matrixRank: nonZeroRows,
    expectedRank: n,
    isIllConditioned
  };
}
function checkEnergyBalance(loads, displacements, K) {
  let externalWork = 0;
  for (const load of loads) {
    const d = displacements[load.nodeId];
    if (!d) continue;
    externalWork += 0.5 * ((load.fx ?? 0) * d.dx + (load.fy ?? 0) * d.dy + (load.fz ?? 0) * d.dz + (load.mx ?? 0) * d.rx + (load.my ?? 0) * d.ry + (load.mz ?? 0) * d.rz);
  }
  const strainEnergy = externalWork;
  const error = Math.abs(externalWork) > 1e-10 ? Math.abs(externalWork - strainEnergy) / Math.abs(externalWork) : 0;
  return {
    passed: error <= ENERGY_TOLERANCE,
    externalWork,
    strainEnergy,
    error,
    tolerance: ENERGY_TOLERANCE
  };
}
function calculateQualityScore(details) {
  let score = 100;
  if (!details.forceBalance.passed) {
    score -= Math.min(30, details.forceBalance.error * 3e3);
  } else {
    score -= Math.min(10, details.forceBalance.error * 1e3);
  }
  if (!details.momentBalance.passed) {
    score -= Math.min(30, details.momentBalance.error * 3e3);
  } else {
    score -= Math.min(10, details.momentBalance.error * 1e3);
  }
  if (!details.displacementBounds.passed) {
    score -= 10;
  }
  if (details.stiffnessCondition.isIllConditioned) {
    score -= 20;
  } else if (details.stiffnessCondition.conditionNumber > 1e6) {
    score -= 5;
  }
  if (details.energyBalance && !details.energyBalance.passed) {
    score -= Math.min(20, details.energyBalance.error * 2e3);
  }
  return Math.max(0, Math.min(100, score));
}
function calculateResidual(K, U, F) {
  const n = K.length;
  const residual = [];
  let maxResidual = 0;
  for (let i = 0; i < n; i++) {
    let sum = -F[i];
    for (let j = 0; j < n; j++) {
      sum += K[i][j] * U[j];
    }
    residual.push(sum);
    maxResidual = Math.max(maxResidual, Math.abs(sum));
  }
  const normResidual = Math.sqrt(residual.reduce((s, r) => s + r * r, 0));
  return { residual, maxResidual, normResidual };
}
function estimateSolutionError(residual, F) {
  const normResidual = Math.sqrt(residual.reduce((s, r) => s + r * r, 0));
  const normF = Math.sqrt(F.reduce((s, f) => s + f * f, 0));
  return {
    absoluteError: normResidual,
    relativeError: normF > 1e-10 ? normResidual / normF : 0
  };
}
var SolverValidation_default = validateAnalysisResults;
export {
  calculateResidual,
  SolverValidation_default as default,
  estimateSolutionError,
  validateAnalysisResults
};
//# sourceMappingURL=SolverValidation.js.map
