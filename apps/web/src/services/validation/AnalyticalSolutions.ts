/**
 * AnalyticalSolutions.ts - Canonical Structural Solutions
 * 
 * Provides closed-form analytical solutions for benchmark validation.
 * These are verified against textbook formulas for accuracy testing.
 */

// ============================================
// TYPES
// ============================================

export interface BeamDeflection {
    x: number[];          // Position along span
    w: number[];          // Deflection at each x
    maxDeflection: number;
    maxDeflectionPosition: number;
}

export interface BeamMoment {
    x: number[];
    M: number[];
    maxMoment: number;
    maxMomentPosition: number;
}

export interface BeamShear {
    x: number[];
    V: number[];
}

// ============================================
// SIMPLY SUPPORTED BEAM - UDL
// ============================================

/**
 * Simply supported beam with uniformly distributed load
 * 
 * w(x) = (q * x / 24EI) * (L³ - 2Lx² + x³)
 * M(x) = (q * x / 2) * (L - x)
 * V(x) = q * (L/2 - x)
 * 
 * @param L Span length (m)
 * @param q Load intensity (N/m, positive downward)
 * @param E Young's Modulus (Pa)
 * @param I Moment of Inertia (m^4)
 * @param numPoints Number of points for output
 */
export function simplySupported_UDL(
    L: number,
    q: number,
    E: number,
    I: number,
    numPoints = 100
): { deflection: BeamDeflection; moment: BeamMoment; shear: BeamShear } {
    const EI = E * I;
    const x: number[] = [];
    const w: number[] = [];
    const M: number[] = [];
    const V: number[] = [];

    for (let i = 0; i <= numPoints; i++) {
        const xi = (i / numPoints) * L;
        x.push(xi);

        // Deflection: w(x) = (q * x / 24EI) * (L³ - 2Lx² + x³)
        const deflection = (q * xi / (24 * EI)) * (L ** 3 - 2 * L * xi ** 2 + xi ** 3);
        w.push(deflection);

        // Moment: M(x) = (q * x / 2) * (L - x)
        const moment = (q * xi / 2) * (L - xi);
        M.push(moment);

        // Shear: V(x) = q * (L/2 - x)
        const shear = q * (L / 2 - xi);
        V.push(shear);
    }

    // Max deflection at midspan: w_max = 5qL⁴ / 384EI
    const maxDeflection = (5 * q * L ** 4) / (384 * EI);

    // Max moment at midspan: M_max = qL² / 8
    const maxMoment = (q * L ** 2) / 8;

    return {
        deflection: { x, w, maxDeflection, maxDeflectionPosition: L / 2 },
        moment: { x, M, maxMoment, maxMomentPosition: L / 2 },
        shear: { x, V }
    };
}

// ============================================
// CANTILEVER BEAM - POINT LOAD AT TIP
// ============================================

/**
 * Cantilever beam with point load at free end
 * 
 * w(x) = (P * x² / 6EI) * (3L - x)
 * M(x) = -P * (L - x)
 * V(x) = -P
 * 
 * @param L Span length (m)
 * @param P Point load at tip (N, positive downward)
 * @param E Young's Modulus (Pa)
 * @param I Moment of Inertia (m^4)
 */
export function cantilever_PointLoad(
    L: number,
    P: number,
    E: number,
    I: number,
    numPoints = 100
): { deflection: BeamDeflection; moment: BeamMoment; shear: BeamShear } {
    const EI = E * I;
    const x: number[] = [];
    const w: number[] = [];
    const M: number[] = [];
    const V: number[] = [];

    for (let i = 0; i <= numPoints; i++) {
        const xi = (i / numPoints) * L;
        x.push(xi);

        // Deflection: w(x) = (P * x² / 6EI) * (3L - x)
        const deflection = (P * xi ** 2 / (6 * EI)) * (3 * L - xi);
        w.push(deflection);

        // Moment: M(x) = -P * (L - x)
        const moment = -P * (L - xi);
        M.push(moment);

        // Shear: V(x) = -P (constant)
        V.push(-P);
    }

    // Max deflection at tip: w_max = PL³ / 3EI
    const maxDeflection = (P * L ** 3) / (3 * EI);

    // Max moment at fixed end: M_max = -PL
    const maxMoment = -P * L;

    return {
        deflection: { x, w, maxDeflection, maxDeflectionPosition: L },
        moment: { x, M, maxMoment, maxMomentPosition: 0 },
        shear: { x, V }
    };
}

// ============================================
// CANTILEVER BEAM - UDL
// ============================================

/**
 * Cantilever beam with uniformly distributed load
 * 
 * w(x) = (q * x² / 24EI) * (6L² - 4Lx + x²)
 * M(x) = -(q/2) * (L - x)²
 * V(x) = -q * (L - x)
 */
export function cantilever_UDL(
    L: number,
    q: number,
    E: number,
    I: number,
    numPoints = 100
): { deflection: BeamDeflection; moment: BeamMoment; shear: BeamShear } {
    const EI = E * I;
    const x: number[] = [];
    const w: number[] = [];
    const M: number[] = [];
    const V: number[] = [];

    for (let i = 0; i <= numPoints; i++) {
        const xi = (i / numPoints) * L;
        x.push(xi);

        // Deflection
        const deflection = (q * xi ** 2 / (24 * EI)) * (6 * L ** 2 - 4 * L * xi + xi ** 2);
        w.push(deflection);

        // Moment
        const moment = -(q / 2) * (L - xi) ** 2;
        M.push(moment);

        // Shear
        const shear = -q * (L - xi);
        V.push(shear);
    }

    // Max deflection at tip: w_max = qL⁴ / 8EI
    const maxDeflection = (q * L ** 4) / (8 * EI);

    // Max moment at fixed end: M_max = -qL²/2
    const maxMoment = -(q * L ** 2) / 2;

    return {
        deflection: { x, w, maxDeflection, maxDeflectionPosition: L },
        moment: { x, M, maxMoment, maxMomentPosition: 0 },
        shear: { x, V }
    };
}

// ============================================
// EULER BUCKLING
// ============================================

/**
 * Euler buckling load for pin-ended column
 * 
 * P_cr = π²EI / L²
 */
export function eulerBucklingLoad(
    L: number,
    E: number,
    I: number,
    k: number = 1.0  // Effective length factor (1.0 for pin-pin)
): number {
    const Le = k * L;  // Effective length
    return (Math.PI ** 2 * E * I) / (Le ** 2);
}

// ============================================
// TERZAGHI BEARING CAPACITY
// ============================================

/**
 * Terzaghi's bearing capacity for strip footing
 * 
 * q_ult = c*Nc + γ*Df*Nq + 0.5*γ*B*Nγ
 */
export function terzaghiBearingCapacity(
    c: number,      // Cohesion (kPa)
    phi: number,    // Friction angle (degrees)
    gamma: number,  // Unit weight (kN/m³)
    B: number,      // Width (m)
    Df: number      // Depth (m)
): { qult: number; Nc: number; Nq: number; Ngamma: number } {
    const phiRad = phi * Math.PI / 180;

    // Terzaghi factors
    const Nq = Math.exp(Math.PI * Math.tan(phiRad)) * Math.tan(Math.PI / 4 + phiRad / 2) ** 2;
    const Nc = phi > 0 ? (Nq - 1) / Math.tan(phiRad) : 5.14;
    const Ngamma = 2 * (Nq + 1) * Math.tan(phiRad);

    const qult = c * Nc + gamma * Df * Nq + 0.5 * gamma * B * Ngamma;

    return { qult, Nc, Nq, Ngamma };
}
