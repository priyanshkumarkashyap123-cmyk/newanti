/**
 * GeotechnicalService.ts
 * 
 * Complete Geotechnical Engineering Module
 * 
 * Features:
 * - Soil classification (USCS/AASHTO)
 * - Bearing capacity calculations
 * - Settlement analysis
 * - Slope stability
 * - Earth pressure
 * - Pile capacity
 * - Liquefaction analysis
 */

// ============================================
// TYPES
// ============================================

export type SoilType =
    | 'GW' | 'GP' | 'GM' | 'GC'    // Gravels
    | 'SW' | 'SP' | 'SM' | 'SC'    // Sands
    | 'ML' | 'CL' | 'OL'           // Low plasticity
    | 'MH' | 'CH' | 'OH'           // High plasticity
    | 'PT';                         // Peat

export interface SoilLayer {
    id: string;
    depth: number;           // Top depth (m)
    thickness: number;       // Layer thickness (m)
    soilType: SoilType;
    description: string;
    properties: SoilProperties;
}

export interface SoilProperties {
    unitWeight: number;      // kN/m³
    saturatedWeight: number; // kN/m³
    cohesion: number;        // kPa
    frictionAngle: number;   // degrees
    elasticModulus: number;  // kPa
    poissonRatio: number;
    SPT_N?: number;          // Standard Penetration Test
    waterContent?: number;   // %
    liquidLimit?: number;    // %
    plasticLimit?: number;   // %
    compressionIndex?: number; // Cc
    recompressionIndex?: number; // Cr
    voidRatio?: number;
    permeability?: number;   // m/s
}

export interface FoundationInput {
    type: 'spread' | 'strip' | 'mat' | 'pile';
    width: number;           // B (m)
    length: number;          // L (m)
    depth: number;           // Df (m)
    load: number;            // kN
    moment?: number;         // kN-m
}

export interface BearingCapacityResult {
    qult: number;            // Ultimate bearing capacity (kPa)
    qall: number;            // Allowable bearing capacity (kPa)
    factorOfSafety: number;
    Nc: number;
    Nq: number;
    Ngamma: number;
    failureMode: 'general' | 'local' | 'punching';
}

export interface SettlementResult {
    immediate: number;       // mm
    consolidation: number;   // mm
    secondary: number;       // mm
    total: number;           // mm
    timeToComplete: number;  // days
}

export interface SlopeStabilityResult {
    factorOfSafety: number;
    criticalSlipSurface: { x: number; y: number }[];
    method: 'Bishop' | 'Janbu' | 'Spencer' | 'Ordinary';
    status: 'stable' | 'marginally_stable' | 'unstable';
}

export interface EarthPressure {
    Ka: number;              // Active coefficient
    Kp: number;              // Passive coefficient
    K0: number;              // At-rest coefficient
    activeForce: number;     // kN/m
    passiveForce: number;    // kN/m
    pointOfApplication: number; // m from base
}

export interface PileCapacity {
    Qp: number;              // End bearing (kN)
    Qs: number;              // Skin friction (kN)
    Qult: number;            // Ultimate capacity (kN)
    Qall: number;            // Allowable capacity (kN)
    settlement: number;      // mm at working load
}

// ============================================
// GEOTECHNICAL SERVICE
// ============================================

class GeotechnicalServiceClass {
    /**
     * Classify soil using USCS
     */
    classifySoil(
        gravel: number,        // % > 4.75mm
        sand: number,          // % 0.075-4.75mm
        fines: number,         // % < 0.075mm
        LL?: number,           // Liquid limit
        PI?: number            // Plasticity index
    ): { type: SoilType; description: string } {

        if (fines < 50) {
            // Coarse-grained soils
            if (gravel > sand) {
                // Gravels
                if (fines < 5) {
                    // Clean gravels - check gradation
                    return { type: 'GW', description: 'Well-graded gravel' };
                } else if (fines < 12) {
                    return { type: 'GM', description: 'Silty gravel' };
                } else {
                    if (PI && PI > 7) {
                        return { type: 'GC', description: 'Clayey gravel' };
                    }
                    return { type: 'GM', description: 'Silty gravel' };
                }
            } else {
                // Sands
                if (fines < 5) {
                    return { type: 'SW', description: 'Well-graded sand' };
                } else if (fines < 12) {
                    return { type: 'SM', description: 'Silty sand' };
                } else {
                    if (PI && PI > 7) {
                        return { type: 'SC', description: 'Clayey sand' };
                    }
                    return { type: 'SM', description: 'Silty sand' };
                }
            }
        } else {
            // Fine-grained soils
            if (LL && LL < 50) {
                if (PI && PI > 7) {
                    return { type: 'CL', description: 'Lean clay' };
                }
                return { type: 'ML', description: 'Silt' };
            } else {
                if (PI && PI > 7) {
                    return { type: 'CH', description: 'Fat clay' };
                }
                return { type: 'MH', description: 'Elastic silt' };
            }
        }
    }

    /**
     * Calculate bearing capacity (Terzaghi/Meyerhof)
     */
    calculateBearingCapacity(
        foundation: FoundationInput,
        soil: SoilProperties,
        waterTableDepth?: number
    ): BearingCapacityResult {
        const { width: B, length: L, depth: Df } = foundation;
        const { cohesion: c, frictionAngle: phi, unitWeight: gamma } = soil;
        const phiRad = phi * Math.PI / 180;

        // Bearing capacity factors (Meyerhof)
        const Nq = Math.exp(Math.PI * Math.tan(phiRad)) * Math.pow(Math.tan(Math.PI / 4 + phiRad / 2), 2);
        const Nc = (Nq - 1) / Math.tan(phiRad);
        const Ngamma = 2 * (Nq + 1) * Math.tan(phiRad);

        // Shape factors
        const sc = 1 + 0.2 * (B / L);
        const sq = 1 + 0.1 * (B / L) * Math.pow(Math.tan(Math.PI / 4 + phiRad / 2), 2);
        const sgamma = sq;

        // Depth factors
        const dc = 1 + 0.2 * (Df / B);
        const dq = 1 + 0.1 * (Df / B) * Math.tan(Math.PI / 4 + phiRad / 2);
        const dgamma = dq;

        // Effective unit weight (considering water table)
        let gammaEff = gamma;
        if (waterTableDepth !== undefined && waterTableDepth < Df + B) {
            const gammaSub = soil.saturatedWeight - 9.81;
            if (waterTableDepth <= Df) {
                gammaEff = gammaSub;
            } else {
                gammaEff = gamma - (Df + B - waterTableDepth) / B * (gamma - gammaSub);
            }
        }

        // Ultimate bearing capacity
        const qult = c * Nc * sc * dc +
            gamma * Df * Nq * sq * dq +
            0.5 * gammaEff * B * Ngamma * sgamma * dgamma;

        // Determine failure mode
        const Dr = soil.SPT_N ? Math.min(1, soil.SPT_N / 50) : 0.5;
        let failureMode: 'general' | 'local' | 'punching' = 'general';
        if (Dr < 0.35) failureMode = 'punching';
        else if (Dr < 0.65) failureMode = 'local';

        // Factor of safety
        const FS = failureMode === 'general' ? 3.0 : failureMode === 'local' ? 2.5 : 2.0;

        return {
            qult,
            qall: qult / FS,
            factorOfSafety: FS,
            Nc, Nq, Ngamma,
            failureMode
        };
    }

    /**
     * Calculate foundation settlement
     */
    calculateSettlement(
        foundation: FoundationInput,
        layers: SoilLayer[],
        appliedPressure: number
    ): SettlementResult {
        const { width: B, length: L, depth: Df } = foundation;

        let immediate = 0;
        let consolidation = 0;
        let secondary = 0;

        // Influence depth (typically 1.5B to 2B)
        const influenceDepth = 2 * B;

        for (const layer of layers) {
            if (layer.depth > Df + influenceDepth) break;
            if (layer.depth + layer.thickness < Df) continue;

            const props = layer.properties;
            const H = layer.thickness;
            const E = props.elasticModulus;
            const mu = props.poissonRatio;

            // Stress at layer midpoint (Boussinesq)
            const z = layer.depth + H / 2 - Df;
            const m = L / B;
            const n = z / (B / 2);
            const I = this.influenceFactor(m, n);
            const deltaSigma = appliedPressure * I;

            // Immediate settlement (elastic)
            const Se = (deltaSigma * H * (1 - mu * mu)) / E;
            immediate += Se * 1000; // Convert to mm

            // Consolidation settlement (clays)
            if (layer.soilType.startsWith('C') || layer.soilType.startsWith('M')) {
                const Cc = props.compressionIndex || 0.009 * ((props.liquidLimit || 40) - 10);
                const e0 = props.voidRatio || 0.8;
                const sigma0 = props.unitWeight * (layer.depth + H / 2);

                const Sc = (Cc * H / (1 + e0)) * Math.log10((sigma0 + deltaSigma) / sigma0);
                consolidation += Sc * 1000;
            }
        }

        // Secondary compression (typically 5-15% of primary for clays)
        secondary = consolidation * 0.1;

        return {
            immediate,
            consolidation,
            secondary,
            total: immediate + consolidation + secondary,
            timeToComplete: consolidation > 0 ? 365 : 30 // Rough estimate
        };
    }

    /**
     * Boussinesq influence factor
     */
    private influenceFactor(m: number, n: number): number {
        const sqrt = Math.sqrt(1 + m * m + n * n);
        const term1 = (2 * m * n * sqrt) / (1 + m * m + n * n + m * m * n * n);
        const term2 = Math.atan((2 * m * n * sqrt) / (1 + m * m + n * n - m * m * n * n));
        return (1 / (4 * Math.PI)) * (term1 + term2);
    }

    /**
     * Calculate earth pressure coefficients
     */
    calculateEarthPressure(
        phi: number,           // Friction angle (degrees)
        wallHeight: number,    // H (m)
        backfillWeight: number,// kN/m³
        beta?: number,         // Backfill slope (degrees)
        delta?: number         // Wall friction (degrees)
    ): EarthPressure {
        const phiRad = (phi * Math.PI) / 180;
        const betaRad = ((beta || 0) * Math.PI) / 180;
        const deltaRad = ((delta || phi * 0.67) * Math.PI) / 180;

        // At-rest coefficient (Jaky)
        const K0 = 1 - Math.sin(phiRad);

        // Active coefficient (Rankine or Coulomb)
        let Ka: number;
        if (!beta && !delta) {
            // Rankine
            Ka = Math.pow(Math.tan(Math.PI / 4 - phiRad / 2), 2);
        } else {
            // Coulomb
            const num = Math.pow(Math.cos(phiRad - deltaRad), 2);
            const denom = Math.pow(Math.cos(deltaRad), 2) *
                Math.pow(1 + Math.sqrt((Math.sin(phiRad + deltaRad) * Math.sin(phiRad - betaRad)) /
                    (Math.cos(deltaRad) * Math.cos(betaRad))), 2);
            Ka = num / denom;
        }

        // Passive coefficient
        const Kp = Math.pow(Math.tan(Math.PI / 4 + phiRad / 2), 2);

        // Forces
        const H = wallHeight;
        const gamma = backfillWeight;
        const activeForce = 0.5 * Ka * gamma * H * H;
        const passiveForce = 0.5 * Kp * gamma * H * H;
        const pointOfApplication = H / 3;

        return {
            Ka, Kp, K0,
            activeForce,
            passiveForce,
            pointOfApplication
        };
    }

    /**
     * Slope stability (simplified Bishop)
     */
    analyzeSlope(
        slopeHeight: number,
        slopeAngle: number,   // degrees
        soil: SoilProperties,
        waterTable?: number
    ): SlopeStabilityResult {
        const c = soil.cohesion;
        const phi = soil.frictionAngle * Math.PI / 180;
        const gamma = soil.unitWeight;
        const H = slopeHeight;
        const beta = slopeAngle * Math.PI / 180;

        // Simplified Taylor's stability chart approach
        const Ns = (gamma * H) / c; // Stability number

        // Critical height for infinite slope
        const Hc = (4 * c * Math.sin(beta) * Math.cos(phi)) /
            (gamma * (1 - Math.cos(beta - phi)));

        // Factor of safety (simplified)
        let FS: number;
        if (c > 0 && phi > 0) {
            // c-phi soil
            FS = (c / (gamma * H * Math.sin(beta) * Math.cos(beta))) +
                (Math.tan(phi) / Math.tan(beta));
        } else if (c > 0) {
            // Cohesive soil
            FS = Hc / H;
        } else {
            // Granular soil
            FS = Math.tan(phi) / Math.tan(beta);
        }

        // Adjust for water table
        if (waterTable !== undefined && waterTable < H) {
            const ru = (waterTable / H) * 0.5;
            FS = FS * (1 - ru);
        }

        let status: 'stable' | 'marginally_stable' | 'unstable';
        if (FS >= 1.5) status = 'stable';
        else if (FS >= 1.0) status = 'marginally_stable';
        else status = 'unstable';

        return {
            factorOfSafety: FS,
            criticalSlipSurface: [], // Would be calculated in detailed analysis
            method: 'Bishop',
            status
        };
    }

    /**
     * Calculate pile capacity
     */
    calculatePileCapacity(
        pileType: 'driven' | 'bored',
        diameter: number,      // m
        length: number,        // m
        layers: SoilLayer[]
    ): PileCapacity {
        const Ap = Math.PI * (diameter / 2) ** 2;  // Pile tip area
        const perimeter = Math.PI * diameter;

        let Qp = 0;  // End bearing
        let Qs = 0;  // Skin friction

        // Find tip layer
        const tipDepth = length;
        for (const layer of layers) {
            if (layer.depth <= tipDepth && layer.depth + layer.thickness >= tipDepth) {
                const props = layer.properties;

                if (props.SPT_N) {
                    // Based on SPT-N
                    if (layer.soilType.startsWith('S') || layer.soilType.startsWith('G')) {
                        // Granular soil
                        Qp = 40 * props.SPT_N * Ap; // kN
                    } else {
                        // Cohesive soil
                        Qp = 9 * props.cohesion * Ap;
                    }
                } else {
                    // Based on c-phi
                    const Nc = 9;
                    const Nq = Math.exp(Math.PI * Math.tan(props.frictionAngle * Math.PI / 180));
                    Qp = (props.cohesion * Nc + props.unitWeight * tipDepth * Nq) * Ap;
                }
            }
        }

        // Skin friction along pile
        for (const layer of layers) {
            if (layer.depth >= tipDepth) break;

            const props = layer.properties;
            const H = Math.min(layer.thickness, tipDepth - layer.depth);

            if (layer.soilType.startsWith('S') || layer.soilType.startsWith('G')) {
                // Granular soil
                const Ks = pileType === 'driven' ? 1.0 : 0.7;
                const delta = props.frictionAngle * 0.75;
                const sigma_v = props.unitWeight * (layer.depth + H / 2);
                const fs = Ks * sigma_v * Math.tan(delta * Math.PI / 180);
                Qs += fs * perimeter * H;
            } else {
                // Cohesive soil
                const alpha = 0.5; // Adhesion factor
                const fs = alpha * props.cohesion;
                Qs += fs * perimeter * H;
            }
        }

        const Qult = Qp + Qs;
        const FS = 2.5;

        return {
            Qp,
            Qs,
            Qult,
            Qall: Qult / FS,
            settlement: (Qult / FS) / (1000 * Ap) // Approximate
        };
    }

    /**
     * Liquefaction potential (simplified)
     */
    checkLiquefaction(
        sptN: number,
        depth: number,
        waterTableDepth: number,
        magnitude: number,      // Earthquake magnitude
        pga: number            // Peak ground acceleration (g)
    ): { susceptible: boolean; factorOfSafety: number; CSR: number; CRR: number } {
        // Cyclic Stress Ratio
        const sigma_v = 18 * depth; // Assume 18 kN/m³
        const sigma_v_eff = sigma_v - 9.81 * Math.max(0, depth - waterTableDepth);
        const rd = 1 - 0.015 * depth; // Stress reduction factor
        const CSR = 0.65 * (pga) * (sigma_v / sigma_v_eff) * rd;

        // Corrected SPT
        const CN = Math.min(2, Math.sqrt(100 / sigma_v_eff));
        const N1_60 = sptN * CN * 0.6; // Assume 60% efficiency

        // Cyclic Resistance Ratio
        let CRR: number;
        if (N1_60 < 30) {
            CRR = (1 / (34 - N1_60)) + (N1_60 / 135) + 50 / (10 * N1_60 + 45) ** 2 - 1 / 200;
        } else {
            CRR = 2.0; // Very dense, not susceptible
        }

        // Magnitude scaling factor
        const MSF = 10 ** (2.24) / magnitude ** (2.56);
        CRR = CRR * MSF;

        const FS = CRR / CSR;

        return {
            susceptible: FS < 1.0,
            factorOfSafety: FS,
            CSR,
            CRR
        };
    }
}

// ============================================
// SINGLETON
// ============================================

export const geotechnical = new GeotechnicalServiceClass();

export default GeotechnicalServiceClass;
