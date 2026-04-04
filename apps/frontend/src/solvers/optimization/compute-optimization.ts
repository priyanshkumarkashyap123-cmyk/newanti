
// ============================================
// TOPOLOGY OPTIMIZATION (SIMP METHOD)
// ============================================

/**
 * Computes Sensitivity of Compliance w.r.t Density.
 * dc/drho = -p * rho^(p-1) * u^T * K0 * u
 * 
 * @param rho Element density (0 to 1)
 * @param p Penalization factor (usually 3)
 * @param strainEnergy Element strain energy (u^T * K0 * u) using base stiffness K0
 */
export function computeSensitivity(rho: number, p: number, strainEnergy: number): number {
    // dc/drho = -p * rho^(p-1) * Se
    return -p * Math.pow(rho, p - 1) * strainEnergy;
}

/**
 * Optimality Criteria (OC) Update Scheme.
 * Updates densities to minimize compliance subject to Volume Constraint.
 * 
 * @param densities Current densities
 * @param sensitivities dc/drho (should be negative)
 * @param volumes Element volumes (usually Length*Area or 1.0 for simplification)
 * @param targetVolume Total target volume limit
 * @param moveLimit limits step size (e.g. 0.2)
 * @param damping Damping factor for stability (0.5)
 * @returns New densities array
 */
export function updateDensitiesOC(
    densities: number[],
    sensities: number[],
    volumes: number[],
    targetVolume: number,
    moveLimit: number = 0.2,
    damping: number = 0.5
): number[] {
    let l1 = 0;
    let l2 = 1e9; // Lagrangian multiplier range
    const newDensities = new Float64Array(densities.length);

    // Bisection search for Lagrange multiplier (lambda)
    while ((l2 - l1) / (l1 + l2) > 1e-3 && l2 > 1e-40) { // Safety check
        const lmid = 0.5 * (l2 + l1);
        let currentVol = 0;

        for (let i = 0; i < densities.length; i++) {
            const x = densities[i];
            const dc = sensities[i]; // Negative value
            const v = volumes[i];

            // Be = (-dc / (lambda * v))
            // We want Be to match 1.
            // B_e = (-dc / (lmid * v))

            // Update rule:
            // if x * Be^eta <= max(0.001, x-move), x_new = max
            // if x * Be^eta >= min(1, x+move), x_new = min
            // else x_new = x * Be^eta

            // Note: Use damping eta = damping (usually 0.5)
            // Be = (-dc/dv) / lambda
            const Be = (-dc / v) / lmid;

            let x_new = x * Math.pow(Be, damping);

            // Apply limits
            x_new = Math.max(0.001, Math.max(x - moveLimit, Math.min(1.0, Math.min(x + moveLimit, x_new))));

            newDensities[i] = x_new;
            currentVol += x_new * v;
        }

        if (currentVol > targetVolume) {
            l1 = lmid;
        } else {
            l2 = lmid;
        }
    }

    return Array.from(newDensities);
}

/**
 * Filter Sensitivities (Mesh Independence - simple neighbor average).
 * Not strictly required for truss/frame structures (discrete), but useful for continuum.
 * For this implementation (Frame/Truss), we skip spatial filtering as connectivity is graph-based not grid-based.
 * We rely on the discrete nature of elements.
 */
export function filterSensitivities(sens: number[]): number[] {
    return sens; // Pass through for now
}
