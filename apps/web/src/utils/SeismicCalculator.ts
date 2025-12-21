/**
 * SeismicCalculator
 * Seismic analysis calculations as per ASCE 7-16 and IS 1893:2016
 */

// ============================================
// TYPES & INTERFACES
// ============================================

export type SiteClass = 'A' | 'B' | 'C' | 'D' | 'E' | 'F';
export type IS_SoilType = 'I' | 'II' | 'III';  // Rock, Medium, Soft
export type IS_SeismicZone = 'II' | 'III' | 'IV' | 'V';

export interface FloorData {
    level: number;      // Floor number
    height: number;     // Height from base (m)
    mass: number;       // Seismic mass of floor (kN or tonnes)
}

export interface SeismicResult {
    period: number;         // Fundamental period T (seconds)
    baseShear: number;      // Base shear V (kN)
    Cs: number;             // Seismic response coefficient
    floorForces: Array<{
        level: number;
        height: number;
        mass: number;
        Cvx: number;        // Vertical distribution factor
        Fx: number;         // Lateral force at floor (kN)
    }>;
}

// ============================================
// ASCE 7-16 SEISMIC CALCULATOR
// ============================================

export class ASCE7_SeismicCalculator {

    /**
     * Site coefficients Fa and Fv as per ASCE 7-16 Tables 11.4-1 and 11.4-2
     */
    static getSiteCoefficients(siteClass: SiteClass, Ss: number, S1: number): { Fa: number; Fv: number } {
        // Fa - Short-period site coefficient (Table 11.4-1)
        const FaTable: Record<SiteClass, number[]> = {
            'A': [0.8, 0.8, 0.8, 0.8, 0.8],
            'B': [1.0, 1.0, 1.0, 1.0, 1.0],
            'C': [1.2, 1.2, 1.1, 1.0, 1.0],
            'D': [1.6, 1.4, 1.2, 1.1, 1.0],
            'E': [2.5, 1.7, 1.2, 0.9, 0.9],
            'F': [1.0, 1.0, 1.0, 1.0, 1.0], // Site-specific required
        };

        // Fv - Long-period site coefficient (Table 11.4-2)
        const FvTable: Record<SiteClass, number[]> = {
            'A': [0.8, 0.8, 0.8, 0.8, 0.8],
            'B': [1.0, 1.0, 1.0, 1.0, 1.0],
            'C': [1.7, 1.6, 1.5, 1.4, 1.3],
            'D': [2.4, 2.0, 1.8, 1.6, 1.5],
            'E': [3.5, 3.2, 2.8, 2.4, 2.4],
            'F': [1.0, 1.0, 1.0, 1.0, 1.0], // Site-specific required
        };

        // Ss breakpoints: 0.25, 0.50, 0.75, 1.00, 1.25+
        const SsBreaks = [0.25, 0.50, 0.75, 1.00, 1.25];
        // S1 breakpoints: 0.10, 0.20, 0.30, 0.40, 0.50+
        const S1Breaks = [0.10, 0.20, 0.30, 0.40, 0.50];

        const FaValues = FaTable[siteClass]!;
        const FvValues = FvTable[siteClass]!;

        // Interpolate Fa
        let Fa = FaValues[4]!;
        for (let i = 0; i < SsBreaks.length - 1; i++) {
            if (Ss <= SsBreaks[i]!) {
                Fa = FaValues[i]!;
                break;
            } else if (Ss < SsBreaks[i + 1]!) {
                const ratio = (Ss - SsBreaks[i]!) / (SsBreaks[i + 1]! - SsBreaks[i]!);
                Fa = FaValues[i]! + ratio * (FaValues[i + 1]! - FaValues[i]!);
                break;
            }
        }

        // Interpolate Fv
        let Fv = FvValues[4]!;
        for (let i = 0; i < S1Breaks.length - 1; i++) {
            if (S1 <= S1Breaks[i]!) {
                Fv = FvValues[i]!;
                break;
            } else if (S1 < S1Breaks[i + 1]!) {
                const ratio = (S1 - S1Breaks[i]!) / (S1Breaks[i + 1]! - S1Breaks[i]!);
                Fv = FvValues[i]! + ratio * (FvValues[i + 1]! - FvValues[i]!);
                break;
            }
        }

        return { Fa, Fv };
    }

    /**
     * Calculate Design Spectral Accelerations Sds and Sd1
     * As per ASCE 7-16 Section 11.4
     */
    static calculateSpectralAccelerations(
        Ss: number,      // Mapped MCE spectral acceleration at short period
        S1: number,      // Mapped MCE spectral acceleration at 1 second
        siteClass: SiteClass
    ): { Sms: number; Sm1: number; Sds: number; Sd1: number } {
        const { Fa, Fv } = this.getSiteCoefficients(siteClass, Ss, S1);

        // MCE spectral response accelerations
        const Sms = Fa * Ss;
        const Sm1 = Fv * S1;

        // Design spectral accelerations (2/3 of MCE)
        const Sds = (2 / 3) * Sms;
        const Sd1 = (2 / 3) * Sm1;

        return { Sms, Sm1, Sds, Sd1 };
    }

    /**
     * Approximate Fundamental Period Ta
     * As per ASCE 7-16 Section 12.8.2.1
     * Ta = Ct * h^x
     */
    static calculateApproximatePeriod(
        h: number,  // Structural height (ft or m)
        structureType: 'steel_moment' | 'concrete_moment' | 'steel_braced' | 'concrete_shear' | 'other'
    ): number {
        // Ct and x values from Table 12.8-2
        const coefficients: Record<string, { Ct: number; x: number }> = {
            'steel_moment': { Ct: 0.028, x: 0.8 },      // Steel moment frames
            'concrete_moment': { Ct: 0.016, x: 0.9 },   // Concrete moment frames
            'steel_braced': { Ct: 0.03, x: 0.75 },      // Steel braced frames
            'concrete_shear': { Ct: 0.02, x: 0.75 },    // Concrete shear walls
            'other': { Ct: 0.02, x: 0.75 }              // All other
        };

        const { Ct, x } = coefficients[structureType] ?? coefficients['other']!;
        return Ct * Math.pow(h, x);
    }

    /**
     * Calculate Seismic Response Coefficient Cs
     * As per ASCE 7-16 Section 12.8.1.1
     */
    static calculateCs(
        Sds: number,
        Sd1: number,
        T: number,      // Period
        R: number,      // Response modification factor
        Ie: number = 1.0,  // Importance factor
        TL: number = 4.0   // Long-period transition
    ): number {
        // Cs shall not exceed
        let Cs_max: number;
        if (T <= TL) {
            Cs_max = Sd1 / (T * (R / Ie));
        } else {
            Cs_max = (Sd1 * TL) / (T * T * (R / Ie));
        }

        // Base Cs value
        let Cs = Sds / (R / Ie);

        // Apply maximum limit
        Cs = Math.min(Cs, Cs_max);

        // Cs shall not be less than (minimum values)
        const Cs_min = Math.max(0.044 * Sds * Ie, 0.01);
        Cs = Math.max(Cs, Cs_min);

        return Cs;
    }

    /**
     * Calculate Base Shear V
     * V = Cs * W
     */
    static calculateBaseShear(Cs: number, W: number): number {
        return Cs * W;
    }

    /**
     * Vertical Distribution of Seismic Forces
     * As per ASCE 7-16 Section 12.8.3
     * Fx = Cvx * V where Cvx = (wx * hx^k) / Σ(wi * hi^k)
     */
    static calculateVerticalDistribution(
        floors: FloorData[],
        V: number,
        T: number
    ): Array<{ level: number; height: number; mass: number; Cvx: number; Fx: number }> {
        // Determine k based on period
        let k: number;
        if (T <= 0.5) {
            k = 1;
        } else if (T >= 2.5) {
            k = 2;
        } else {
            k = 1 + (T - 0.5) / 2;  // Linear interpolation
        }

        // Calculate sum of (wi * hi^k)
        const sumWiHi = floors.reduce((sum, floor) => {
            return sum + floor.mass * Math.pow(floor.height, k);
        }, 0);

        // Calculate Cvx and Fx for each floor
        return floors.map(floor => {
            const wihi_k = floor.mass * Math.pow(floor.height, k);
            const Cvx = wihi_k / sumWiHi;
            const Fx = Cvx * V;

            return {
                level: floor.level,
                height: floor.height,
                mass: floor.mass,
                Cvx,
                Fx
            };
        });
    }

    /**
     * Complete ASCE 7-16 Seismic Analysis
     */
    static analyze(
        Ss: number,
        S1: number,
        siteClass: SiteClass,
        R: number,
        Ie: number,
        W: number,
        h: number,
        structureType: 'steel_moment' | 'concrete_moment' | 'steel_braced' | 'concrete_shear' | 'other',
        floors: FloorData[]
    ): SeismicResult {
        // Step 1: Calculate spectral accelerations
        const { Sds, Sd1 } = this.calculateSpectralAccelerations(Ss, S1, siteClass);

        // Step 2: Calculate period
        const T = this.calculateApproximatePeriod(h, structureType);

        // Step 3: Calculate Cs
        const Cs = this.calculateCs(Sds, Sd1, T, R, Ie);

        // Step 4: Calculate base shear
        const V = this.calculateBaseShear(Cs, W);

        // Step 5: Distribute forces to floors
        const floorForces = this.calculateVerticalDistribution(floors, V, T);

        return {
            period: T,
            baseShear: V,
            Cs,
            floorForces
        };
    }
}

// ============================================
// IS 1893:2016 SEISMIC CALCULATOR (INDIAN STANDARD)
// ============================================

export class IS1893_SeismicCalculator {

    /**
     * Zone Factor Z as per IS 1893:2016 Table 3
     */
    static getZoneFactor(zone: IS_SeismicZone): number {
        const zones: Record<IS_SeismicZone, number> = {
            'II': 0.10,
            'III': 0.16,
            'IV': 0.24,
            'V': 0.36
        };
        return zones[zone];
    }

    /**
     * Importance Factor I as per IS 1893:2016 Table 8
     */
    static getImportanceFactor(buildingType: 'critical' | 'important' | 'ordinary'): number {
        const factors: Record<string, number> = {
            'critical': 1.5,    // Hospitals, fire stations
            'important': 1.2,   // Schools, assembly halls
            'ordinary': 1.0     // Residential, commercial
        };
        return factors[buildingType] ?? 1.0;
    }

    /**
     * Response Reduction Factor R as per IS 1893:2016 Table 9
     */
    static getResponseReductionFactor(structureType: string): number {
        const factors: Record<string, number> = {
            'SMRF': 5.0,            // Special Moment Resisting Frame
            'OMRF': 3.0,            // Ordinary MRF
            'steel_braced': 4.0,    // Steel braced frame
            'RC_shear_wall': 4.0,   // RC buildings with shear walls
            'dual_system': 5.0,     // Dual system
            'masonry': 1.5,         // Unreinforced masonry
        };
        return factors[structureType] ?? 3.0;
    }

    /**
     * Spectral Acceleration Coefficient Sa/g
     * As per IS 1893:2016 Clause 6.4.2
     */
    static getSpectralAcceleration(T: number, soilType: IS_SoilType, damping: number = 5): number {
        // Damping correction factor (for damping other than 5%)
        const dampingFactors: Record<number, number> = {
            0: 3.20, 2: 1.40, 5: 1.00, 7: 0.90, 10: 0.80, 15: 0.70, 20: 0.60, 25: 0.55, 30: 0.50
        };
        const dampingFactor = dampingFactors[damping] ?? 1.0;

        let Sa_g: number;

        if (soilType === 'I') {
            // Rock or Hard Soil
            if (T <= 0.10) Sa_g = 1.0 + 15 * T;
            else if (T <= 0.40) Sa_g = 2.5;
            else if (T <= 4.0) Sa_g = 1.0 / T;
            else Sa_g = 0.25;
        } else if (soilType === 'II') {
            // Medium Soil
            if (T <= 0.10) Sa_g = 1.0 + 15 * T;
            else if (T <= 0.55) Sa_g = 2.5;
            else if (T <= 4.0) Sa_g = 1.36 / T;
            else Sa_g = 0.34;
        } else {
            // Soft Soil (Type III)
            if (T <= 0.10) Sa_g = 1.0 + 15 * T;
            else if (T <= 0.67) Sa_g = 2.5;
            else if (T <= 4.0) Sa_g = 1.67 / T;
            else Sa_g = 0.42;
        }

        return Sa_g * dampingFactor;
    }

    /**
     * Approximate Fundamental Period T
     * As per IS 1893:2016 Clause 7.6
     */
    static calculateApproximatePeriod(
        h: number,  // Height of building (m)
        d: number,  // Base dimension in direction of vibration (m)
        frameType: 'steel_moment' | 'RC_moment' | 'RC_shear' | 'masonry'
    ): number {
        switch (frameType) {
            case 'steel_moment':
                return 0.085 * Math.pow(h, 0.75);
            case 'RC_moment':
                return 0.075 * Math.pow(h, 0.75);
            case 'RC_shear':
            case 'masonry':
                return 0.09 * h / Math.sqrt(d);
            default:
                return 0.075 * Math.pow(h, 0.75);
        }
    }

    /**
     * Design Horizontal Seismic Coefficient Ah
     * As per IS 1893:2016 Clause 6.4.2
     * Ah = (Z/2) * (I/R) * (Sa/g)
     */
    static calculateAh(
        Z: number,      // Zone factor
        I: number,      // Importance factor
        R: number,      // Response reduction factor
        Sa_g: number    // Spectral acceleration / g
    ): number {
        return (Z / 2) * (I / R) * Sa_g;
    }

    /**
     * Design Base Shear VB
     * As per IS 1893:2016 Clause 7.6.1
     * VB = Ah * W
     */
    static calculateBaseShear(Ah: number, W: number): number {
        return Ah * W;
    }

    /**
     * Vertical Distribution of Base Shear
     * As per IS 1893:2016 Clause 7.6.3
     * Qi = (VB * Wi * hi²) / Σ(Wj * hj²)
     */
    static calculateVerticalDistribution(
        floors: FloorData[],
        VB: number
    ): Array<{ level: number; height: number; mass: number; Qi: number }> {
        // Calculate sum of (Wi * hi²)
        const sumWiHi2 = floors.reduce((sum, floor) => {
            return sum + floor.mass * floor.height * floor.height;
        }, 0);

        // Calculate Qi for each floor
        return floors.map(floor => {
            const Qi = (VB * floor.mass * floor.height * floor.height) / sumWiHi2;

            return {
                level: floor.level,
                height: floor.height,
                mass: floor.mass,
                Qi
            };
        });
    }

    /**
     * Complete IS 1893:2016 Seismic Analysis
     */
    static analyze(
        zone: IS_SeismicZone,
        soilType: IS_SoilType,
        buildingType: 'critical' | 'important' | 'ordinary',
        structureType: string,
        h: number,      // Building height (m)
        d: number,      // Base dimension (m)
        W: number,      // Seismic weight (kN)
        frameType: 'steel_moment' | 'RC_moment' | 'RC_shear' | 'masonry',
        floors: FloorData[]
    ): { Z: number; I: number; R: number; T: number; Sa_g: number; Ah: number; VB: number; floorForces: Array<{ level: number; height: number; mass: number; Qi: number }> } {

        // Step 1: Get factors
        const Z = this.getZoneFactor(zone);
        const I = this.getImportanceFactor(buildingType);
        const R = this.getResponseReductionFactor(structureType);

        // Step 2: Calculate period
        const T = this.calculateApproximatePeriod(h, d, frameType);

        // Step 3: Get spectral acceleration
        const Sa_g = this.getSpectralAcceleration(T, soilType);

        // Step 4: Calculate Ah
        const Ah = this.calculateAh(Z, I, R, Sa_g);

        // Step 5: Calculate base shear
        const VB = this.calculateBaseShear(Ah, W);

        // Step 6: Distribute forces to floors
        const floorForces = this.calculateVerticalDistribution(floors, VB);

        return {
            Z,
            I,
            R,
            T,
            Sa_g,
            Ah,
            VB,
            floorForces
        };
    }
}

// Export combined
export const SeismicCalculator = {
    ASCE7: ASCE7_SeismicCalculator,
    IS1893: IS1893_SeismicCalculator
};

export default SeismicCalculator;
