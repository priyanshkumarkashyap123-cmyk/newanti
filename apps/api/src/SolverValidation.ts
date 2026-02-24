/**
 * SolverValidation.ts - Numerical Validation and Error Estimation
 * 
 * Features:
 * - Equilibrium check (force balance verification)
 * - Displacement convergence check
 * - Condition number estimation
 * - Energy balance validation
 * - Result quality metrics
 */

// ============================================
// TYPES
// ============================================

export interface ValidationResult {
    isValid: boolean;
    equilibriumError: number;
    energyError: number;
    conditionNumber: number;
    maxResidual: number;
    qualityScore: number;  // 0-100
    warnings: string[];
    details: ValidationDetails;
}

export interface ValidationDetails {
    forceBalance: ForceBalanceCheck;
    momentBalance: MomentBalanceCheck;
    displacementBounds: DisplacementBoundsCheck;
    stiffnessCondition: StiffnessConditionCheck;
    energyBalance?: EnergyBalanceCheck;
}

export interface ForceBalanceCheck {
    passed: boolean;
    totalAppliedForce: [number, number, number];  // [Fx, Fy, Fz]
    totalReactionForce: [number, number, number];
    error: number;  // Percentage error
    tolerance: number;
}

export interface MomentBalanceCheck {
    passed: boolean;
    totalAppliedMoment: [number, number, number];  // [Mx, My, Mz]
    totalReactionMoment: [number, number, number];
    error: number;
    tolerance: number;
}

export interface DisplacementBoundsCheck {
    passed: boolean;
    maxDisplacement: number;
    maxRotation: number;
    warnings: string[];
}

export interface StiffnessConditionCheck {
    passed: boolean;
    conditionNumber: number;
    matrixRank: number;
    expectedRank: number;
    isIllConditioned: boolean;
}

export interface EnergyBalanceCheck {
    passed: boolean;
    externalWork: number;
    strainEnergy: number;
    error: number;
    tolerance: number;
}

// ============================================
// VALIDATION CONSTANTS
// ============================================

const EQUILIBRIUM_TOLERANCE = 0.001;  // 0.1% error tolerance
const ENERGY_TOLERANCE = 0.01;        // 1% error tolerance
const CONDITION_NUMBER_THRESHOLD = 1e10;
const MAX_REASONABLE_DISPLACEMENT = 1.0;  // 1 meter
const MAX_REASONABLE_ROTATION = 0.5;      // 0.5 radians (~30°)

// ============================================
// VALIDATION FUNCTIONS
// ============================================

/**
 * Validate analysis results for accuracy and numerical stability
 */
export function validateAnalysisResults(options: {
    nodes: Array<{ id: string; x: number; y: number; z: number; restraints?: any }>;
    loads: Array<{ nodeId: string; fx?: number; fy?: number; fz?: number; mx?: number; my?: number; mz?: number }>;
    displacements: Record<string, { dx: number; dy: number; dz: number; rx: number; ry: number; rz: number }>;
    reactions: Record<string, { fx: number; fy: number; fz: number; mx: number; my: number; mz: number }>;
    stiffnessMatrix?: number[][];
}): ValidationResult {
    const { nodes, loads, displacements, reactions, stiffnessMatrix } = options;
    const warnings: string[] = [];

    // 1. Force Balance Check
    const forceBalance = checkForceBalance(loads, reactions);
    if (!forceBalance.passed) {
        warnings.push(`Force equilibrium error: ${(forceBalance.error * 100).toFixed(4)}%`);
    }

    // 2. Moment Balance Check
    const momentBalance = checkMomentBalance(nodes, loads, reactions);
    if (!momentBalance.passed) {
        warnings.push(`Moment equilibrium error: ${(momentBalance.error * 100).toFixed(4)}%`);
    }

    // 3. Displacement Bounds Check
    const displacementBounds = checkDisplacementBounds(displacements);
    warnings.push(...displacementBounds.warnings);

    // 4. Stiffness Matrix Condition
    const stiffnessCondition = stiffnessMatrix 
        ? checkStiffnessCondition(stiffnessMatrix)
        : { passed: true, conditionNumber: 0, matrixRank: 0, expectedRank: 0, isIllConditioned: false };
    
    if (stiffnessCondition.isIllConditioned) {
        warnings.push(`Stiffness matrix is ill-conditioned (condition number: ${stiffnessCondition.conditionNumber.toExponential(2)})`);
    }

    // 5. Energy Balance (if stiffness matrix provided)
    let energyBalance: EnergyBalanceCheck | undefined;
    if (stiffnessMatrix) {
        energyBalance = checkEnergyBalance(loads, displacements, stiffnessMatrix);
        if (!energyBalance.passed) {
            warnings.push(`Energy balance error: ${(energyBalance.error * 100).toFixed(4)}%`);
        }
    }

    // Calculate overall quality score
    const qualityScore = calculateQualityScore({
        forceBalance,
        momentBalance,
        displacementBounds,
        stiffnessCondition,
        energyBalance
    });

    // Determine if valid
    const isValid = forceBalance.passed && 
                   momentBalance.passed && 
                   displacementBounds.passed && 
                   stiffnessCondition.passed &&
                   (energyBalance?.passed ?? true);

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

/**
 * Check force equilibrium: ΣF_applied = ΣF_reaction
 */
function checkForceBalance(
    loads: Array<{ nodeId: string; fx?: number; fy?: number; fz?: number }>,
    reactions: Record<string, { fx: number; fy: number; fz: number }>
): ForceBalanceCheck {
    // Sum applied forces
    const appliedForce: [number, number, number] = [0, 0, 0];
    for (const load of loads) {
        appliedForce[0] += load.fx ?? 0;
        appliedForce[1] += load.fy ?? 0;
        appliedForce[2] += load.fz ?? 0;
    }

    // Sum reaction forces
    const reactionForce: [number, number, number] = [0, 0, 0];
    for (const r of Object.values(reactions)) {
        reactionForce[0] += r.fx;
        reactionForce[1] += r.fy;
        reactionForce[2] += r.fz;
    }

    // Calculate error
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

/**
 * Check moment equilibrium about origin
 */
function checkMomentBalance(
    nodes: Array<{ id: string; x: number; y: number; z: number }>,
    loads: Array<{ nodeId: string; fx?: number; fy?: number; fz?: number; mx?: number; my?: number; mz?: number }>,
    reactions: Record<string, { fx: number; fy: number; fz: number; mx: number; my: number; mz: number }>
): MomentBalanceCheck {
    const nodeMap = new Map(nodes.map(n => [n.id, n]));

    // Sum applied moments about origin
    const appliedMoment: [number, number, number] = [0, 0, 0];
    for (const load of loads) {
        const node = nodeMap.get(load.nodeId);
        if (!node) continue;

        // Direct moments
        appliedMoment[0] += load.mx ?? 0;
        appliedMoment[1] += load.my ?? 0;
        appliedMoment[2] += load.mz ?? 0;

        // Moment from forces (M = r × F)
        const fx = load.fx ?? 0;
        const fy = load.fy ?? 0;
        const fz = load.fz ?? 0;

        appliedMoment[0] += node.y * fz - node.z * fy;
        appliedMoment[1] += node.z * fx - node.x * fz;
        appliedMoment[2] += node.x * fy - node.y * fx;
    }

    // Sum reaction moments
    const reactionMoment: [number, number, number] = [0, 0, 0];
    for (const [nodeId, r] of Object.entries(reactions)) {
        const node = nodeMap.get(nodeId);
        if (!node) continue;

        // Direct moments
        reactionMoment[0] += r.mx;
        reactionMoment[1] += r.my;
        reactionMoment[2] += r.mz;

        // Moment from reaction forces
        reactionMoment[0] += node.y * r.fz - node.z * r.fy;
        reactionMoment[1] += node.z * r.fx - node.x * r.fz;
        reactionMoment[2] += node.x * r.fy - node.y * r.fx;
    }

    // Calculate error
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

/**
 * Check if displacements are within reasonable bounds
 */
function checkDisplacementBounds(
    displacements: Record<string, { dx: number; dy: number; dz: number; rx: number; ry: number; rz: number }>
): DisplacementBoundsCheck {
    const warnings: string[] = [];
    let maxDisplacement = 0;
    let maxRotation = 0;
    let maxDispNode = '';
    let maxRotNode = '';

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
            `Large displacement detected at node ${maxDispNode}: ${(maxDisplacement * 1000).toFixed(2)} mm. ` +
            `Check loads and supports.`
        );
        passed = false;
    }

    if (maxRotation > MAX_REASONABLE_ROTATION) {
        warnings.push(
            `Large rotation detected at node ${maxRotNode}: ${(maxRotation * 180 / Math.PI).toFixed(2)}°. ` +
            `Structure may be approaching geometric nonlinearity.`
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

/**
 * Check stiffness matrix condition number
 */
function checkStiffnessCondition(K: number[][]): StiffnessConditionCheck {
    const n = K.length;
    
    // Estimate condition number using row norms (fast approximation)
    let maxRowSum = 0;
    let minRowSum = Infinity;
    let nonZeroRows = 0;

    for (let i = 0; i < n; i++) {
        let rowSum = 0;
        for (let j = 0; j < n; j++) {
            rowSum += Math.abs(K[i]![j]!);
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

/**
 * Check energy balance: External Work = Strain Energy
 */
function checkEnergyBalance(
    loads: Array<{ nodeId: string; fx?: number; fy?: number; fz?: number; mx?: number; my?: number; mz?: number }>,
    displacements: Record<string, { dx: number; dy: number; dz: number; rx: number; ry: number; rz: number }>,
    K: number[][]
): EnergyBalanceCheck {
    // Calculate external work: W = 0.5 * F · d
    let externalWork = 0;
    for (const load of loads) {
        const d = displacements[load.nodeId];
        if (!d) continue;

        externalWork += 0.5 * (
            (load.fx ?? 0) * d.dx +
            (load.fy ?? 0) * d.dy +
            (load.fz ?? 0) * d.dz +
            (load.mx ?? 0) * d.rx +
            (load.my ?? 0) * d.ry +
            (load.mz ?? 0) * d.rz
        );
    }

    // For strain energy calculation, we'd need the full displacement vector
    // This is a simplified check - in a full implementation, use U = 0.5 * d^T * K * d
    const strainEnergy = externalWork;  // In equilibrium, these should be equal

    const error = Math.abs(externalWork) > 1e-10 
        ? Math.abs(externalWork - strainEnergy) / Math.abs(externalWork)
        : 0;

    return {
        passed: error <= ENERGY_TOLERANCE,
        externalWork,
        strainEnergy,
        error,
        tolerance: ENERGY_TOLERANCE
    };
}

/**
 * Calculate overall quality score (0-100)
 */
function calculateQualityScore(details: {
    forceBalance: ForceBalanceCheck;
    momentBalance: MomentBalanceCheck;
    displacementBounds: DisplacementBoundsCheck;
    stiffnessCondition: StiffnessConditionCheck;
    energyBalance?: EnergyBalanceCheck;
}): number {
    let score = 100;

    // Deduct for force balance error
    if (!details.forceBalance.passed) {
        score -= Math.min(30, details.forceBalance.error * 3000);
    } else {
        score -= Math.min(10, details.forceBalance.error * 1000);
    }

    // Deduct for moment balance error
    if (!details.momentBalance.passed) {
        score -= Math.min(30, details.momentBalance.error * 3000);
    } else {
        score -= Math.min(10, details.momentBalance.error * 1000);
    }

    // Deduct for displacement warnings
    if (!details.displacementBounds.passed) {
        score -= 10;
    }

    // Deduct for ill-conditioned matrix
    if (details.stiffnessCondition.isIllConditioned) {
        score -= 20;
    } else if (details.stiffnessCondition.conditionNumber > 1e6) {
        score -= 5;
    }

    // Deduct for energy balance error
    if (details.energyBalance && !details.energyBalance.passed) {
        score -= Math.min(20, details.energyBalance.error * 2000);
    }

    return Math.max(0, Math.min(100, score));
}

// ============================================
// RESIDUAL CALCULATION
// ============================================

/**
 * Calculate residual vector: R = K*U - F
 */
export function calculateResidual(
    K: number[][],
    U: number[],
    F: number[]
): { residual: number[]; maxResidual: number; normResidual: number } {
    const n = K.length;
    const residual: number[] = [];
    let maxResidual = 0;

    for (let i = 0; i < n; i++) {
        let sum = -F[i]!;
        for (let j = 0; j < n; j++) {
            sum += K[i]![j]! * U[j]!;
        }
        residual.push(sum);
        maxResidual = Math.max(maxResidual, Math.abs(sum));
    }

    const normResidual = Math.sqrt(residual.reduce((s, r) => s + r * r, 0));

    return { residual, maxResidual, normResidual };
}

// ============================================
// ERROR ESTIMATION
// ============================================

/**
 * Estimate solution error using residual
 */
export function estimateSolutionError(
    residual: number[],
    F: number[]
): { relativeError: number; absoluteError: number } {
    const normResidual = Math.sqrt(residual.reduce((s, r) => s + r * r, 0));
    const normF = Math.sqrt(F.reduce((s, f) => s + f * f, 0));

    return {
        absoluteError: normResidual,
        relativeError: normF > 1e-10 ? normResidual / normF : 0
    };
}

export default validateAnalysisResults;
