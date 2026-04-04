/**
 * Indian Standard Code Design Utilities
 * Comprehensive design checks and parameters as per IS codes
 */

// ============================================
// IS 456:2000 - CONCRETE DESIGN
// ============================================

export interface IS456_ConcreteGrade {
    grade: string;
    fck: number;  // Characteristic compressive strength (N/mm²)
    fcd: number;  // Design strength = 0.67 * fck / γm (N/mm²) where γm = 1.5
    Ecm: number;  // Modulus of elasticity (N/mm²)
    fctm: number; // Mean tensile strength (N/mm²)
}

export const IS456_CONCRETE_GRADES: IS456_ConcreteGrade[] = [
    { grade: 'M15', fck: 15, fcd: 6.7, Ecm: 26000, fctm: 1.6 },
    { grade: 'M20', fck: 20, fcd: 8.9, Ecm: 28000, fctm: 2.2 },
    { grade: 'M25', fck: 25, fcd: 11.2, Ecm: 30000, fctm: 2.6 },
    { grade: 'M30', fck: 30, fcd: 13.4, Ecm: 31600, fctm: 2.9 },
    { grade: 'M35', fck: 35, fcd: 15.6, Ecm: 33000, fctm: 3.2 },
    { grade: 'M40', fck: 40, fcd: 17.9, Ecm: 34000, fctm: 3.5 },
    { grade: 'M45', fck: 45, fcd: 20.0, Ecm: 35000, fctm: 3.7 },
    { grade: 'M50', fck: 50, fcd: 22.3, Ecm: 36000, fctm: 4.0 },
    { grade: 'M55', fck: 55, fcd: 24.5, Ecm: 37000, fctm: 4.2 },
    { grade: 'M60', fck: 60, fcd: 26.8, Ecm: 38000, fctm: 4.4 },
];

export interface IS456_RebarGrade {
    grade: string;
    fy: number;   // Characteristic yield strength (N/mm²)
    fyd: number;  // Design yield strength = fy / γs (N/mm²) where γs = 1.15
    Es: number;   // Modulus of elasticity (N/mm²)
}

export const IS456_REBAR_GRADES: IS456_RebarGrade[] = [
    { grade: 'Fe250', fy: 250, fyd: 217, Es: 200000 },
    { grade: 'Fe415', fy: 415, fyd: 361, Es: 200000 },
    { grade: 'Fe500', fy: 500, fyd: 435, Es: 200000 },
    { grade: 'Fe550', fy: 550, fyd: 478, Es: 200000 },
    { grade: 'Fe600', fy: 600, fyd: 522, Es: 200000 },
];

export class IS456_Design {
    /**
     * Calculate limiting moment of resistance for singly reinforced beam
     * Mu,lim = 0.36 * fck * b * xu,max * (d - 0.42 * xu,max)
     */
    static limitingMoment(fck: number, b: number, d: number, fy: number): number {
        const xuMax = this.neutralAxisLimitingDepth(fy, d);
        return 0.36 * fck * b * xuMax * (d - 0.42 * xuMax);
    }

    /**
     * Neutral axis limiting depth xu,max/d as per IS 456 Clause 38.1
     */
    static neutralAxisLimitingDepth(fy: number, d: number): number {
        let ratio: number;
        if (fy === 250) ratio = 0.53;
        else if (fy === 415) ratio = 0.48;
        else if (fy === 500) ratio = 0.46;
        else if (fy === 550) ratio = 0.44;
        else ratio = 0.42; // Fe600 or higher
        return ratio * d;
    }

    /**
     * Minimum tension reinforcement As,min as per IS 456 Clause 26.5.1.1
     * As,min = 0.85 * b * d / fy
     */
    static minTensionReinforcement(b: number, d: number, fy: number): number {
        return (0.85 * b * d) / fy;
    }

    /**
     * Maximum reinforcement = 4% of gross area
     */
    static maxReinforcement(b: number, D: number): number {
        return 0.04 * b * D;
    }

    /**
     * Shear strength of concrete τc (N/mm²) as per IS 456 Table 19
     */
    static shearStrengthConcrete(fck: number, percentSteel: number): number {
        // Simplified interpolation from IS 456 Table 19
        const pt = Math.min(percentSteel, 3.0);

        // Base values for fck = 25 N/mm²
        const baseValues: Record<number, number> = {
            0.15: 0.29,
            0.25: 0.36,
            0.50: 0.49,
            0.75: 0.57,
            1.00: 0.64,
            1.25: 0.70,
            1.50: 0.75,
            1.75: 0.79,
            2.00: 0.82,
            2.25: 0.85,
            2.50: 0.88,
            2.75: 0.90,
            3.00: 0.92
        };

        // Find nearest values and interpolate
        const keys = Object.keys(baseValues).map(Number).sort((a, b) => a - b);
        let tau = 0.29; // default minimum

        for (let i = 0; i < keys.length - 1; i++) {
            const key = keys[i]!;
            const nextKey = keys[i + 1]!;
            if (pt >= key && pt <= nextKey) {
                const lower = baseValues[key]!;
                const upper = baseValues[nextKey]!;
                tau = lower + (upper - lower) * (pt - key) / (nextKey - key);
                break;
            }
            if (pt > key) tau = baseValues[key]!;
        }

        // Adjust for concrete grade
        const factor = Math.min(1.0, Math.sqrt(fck / 25));
        return tau * (fck >= 25 ? 1.0 : factor);
    }

    /**
     * Development length Ld as per IS 456 Clause 26.2.1
     * Ld = φ * σs / (4 * τbd)
     */
    static developmentLength(phi: number, fy: number, fck: number, inTension: boolean = true): number {
        const sigmaSt = 0.87 * fy;
        const tauBd = this.bondStress(fck, inTension);
        return (phi * sigmaSt) / (4 * tauBd);
    }

    /**
     * Design bond stress τbd as per IS 456 Table 17
     */
    static bondStress(fck: number, inTension: boolean): number {
        // Values for deformed bars in tension
        const baseStress: Record<number, number> = {
            15: 1.0,
            20: 1.2,
            25: 1.4,
            30: 1.5,
            35: 1.7,
            40: 1.9,
        };

        const fckKey = Math.min(40, Math.max(15, Math.round(fck / 5) * 5));
        let tau = baseStress[fckKey] ?? 1.0;

        // Increase by 25% for compression
        if (!inTension) tau *= 1.25;

        return tau;
    }

    /**
     * Clear cover requirements as per IS 456 Table 16
     */
    static clearCover(exposureCondition: 'mild' | 'moderate' | 'severe' | 'very_severe' | 'extreme'): number {
        const covers: Record<string, number> = {
            'mild': 20,
            'moderate': 30,
            'severe': 45,
            'very_severe': 50,
            'extreme': 75
        };
        return covers[exposureCondition] ?? 40;
    }

    /**
     * Effective depth check for deflection as per IS 456 Clause 23.2.1
     * l/d basic values
     */
    static spanDepthRatio(supportType: 'cantilever' | 'simply_supported' | 'continuous'): number {
        const ratios: Record<string, number> = {
            'cantilever': 7,
            'simply_supported': 20,
            'continuous': 26
        };
        return ratios[supportType] ?? 20;
    }
}

// ============================================
// IS 800:2007 - STEEL DESIGN
// ============================================

export interface IS800_SteelGrade {
    grade: string;
    fy: number;   // Yield strength (N/mm²)
    fu: number;   // Ultimate tensile strength (N/mm²)
    E: number;    // Modulus of elasticity (N/mm²)
}

export const IS800_STEEL_GRADES: IS800_SteelGrade[] = [
    { grade: 'E250 (Fe410W)', fy: 250, fu: 410, E: 200000 },
    { grade: 'E300 (Fe440)', fy: 300, fu: 440, E: 200000 },
    { grade: 'E350 (Fe490)', fy: 350, fu: 490, E: 200000 },
    { grade: 'E410 (Fe540)', fy: 410, fu: 540, E: 200000 },
    { grade: 'E450 (Fe570)', fy: 450, fu: 570, E: 200000 },
];

export class IS800_Design {
    // Partial safety factors as per IS 800:2007
    static readonly γm0 = 1.10;  // For yielding
    static readonly γm1 = 1.25;  // For ultimate stress
    static readonly γmw = 1.25;  // For welds
    static readonly γmb = 1.25;  // For bolts

    /**
     * Design strength in tension as per IS 800 Clause 6
     * Td = (Ag * fy) / γm0
     */
    static tensionCapacity(Ag: number, fy: number): number {
        return (Ag * fy) / this.γm0;
    }

    /**
     * Net section rupture capacity
     * Tdn = 0.9 * An * fu / γm1
     */
    static netSectionRupture(An: number, fu: number): number {
        return (0.9 * An * fu) / this.γm1;
    }

    /**
     * Block shear capacity as per IS 800 Clause 6.4
     */
    static blockShearCapacity(Avg: number, Avn: number, Atg: number, Atn: number, fy: number, fu: number): number {
        const Tdb1 = (Avg * fy) / (Math.sqrt(3) * this.γm0) + (0.9 * Atn * fu) / this.γm1;
        const Tdb2 = (0.9 * Avn * fu) / (Math.sqrt(3) * this.γm1) + (Atg * fy) / this.γm0;
        return Math.min(Tdb1, Tdb2);
    }

    /**
     * Compression capacity - Buckling class for rolled I/H sections
     * as per IS 800 Table 10
     */
    static getBucklingClass(sectionType: 'rolled_I' | 'welded_I' | 'hollow',
        axis: 'major' | 'minor',
        hb_ratio: number): string {
        if (sectionType === 'hollow') return 'a';

        if (sectionType === 'rolled_I') {
            if (axis === 'major') {
                return hb_ratio <= 1.2 ? 'a' : 'b';
            } else {
                return hb_ratio <= 1.2 ? 'b' : 'c';
            }
        }

        // Welded I
        if (axis === 'major') {
            return hb_ratio <= 1.2 ? 'b' : 'c';
        } else {
            return hb_ratio <= 1.2 ? 'c' : 'd';
        }
    }

    /**
     * Imperfection factor α as per IS 800 Table 7
     */
    static getImperfectionFactor(bucklingClass: string): number {
        const factors: Record<string, number> = {
            'a': 0.21,
            'b': 0.34,
            'c': 0.49,
            'd': 0.76
        };
        return factors[bucklingClass] ?? 0.49;
    }

    /**
     * Design compressive strength as per IS 800 Clause 7.1.2
     */
    static compressionCapacity(Ag: number, fy: number, λ: number, bucklingClass: string): number {
        const fcc = (Math.PI * Math.PI * 200000) / (λ * λ);  // Euler buckling stress
        const λ_bar = Math.sqrt(fy / fcc);  // Non-dimensional slenderness

        const α = this.getImperfectionFactor(bucklingClass);
        const φ = 0.5 * (1 + α * (λ_bar - 0.2) + λ_bar * λ_bar);
        const χ = 1 / (φ + Math.sqrt(φ * φ - λ_bar * λ_bar));

        const fcd = (χ * fy) / this.γm0;
        return Ag * fcd;
    }

    /**
     * Plastic moment capacity as per IS 800 Clause 8.2.1.2
     * Md = βb * Zp * fy / γm0
     */
    static plasticMomentCapacity(Zp: number, fy: number, βb: number = 1.0): number {
        return (βb * Zp * fy) / this.γm0;
    }

    /**
     * Shear capacity as per IS 800 Clause 8.4
     * Vd = (Av * fy) / (√3 * γm0)
     */
    static shearCapacity(Av: number, fy: number): number {
        return (Av * fy) / (Math.sqrt(3) * this.γm0);
    }

    /**
     * Bolt shear capacity as per IS 800 Clause 10.3.3
     */
    static boltShearCapacity(Asb: number, fub: number, nn: number = 1, ns: number = 0): number {
        const Vnsb = (fub / Math.sqrt(3)) * (nn * 0.78 * Asb + ns * Asb);
        return Vnsb / this.γmb;
    }

    /**
     * Bolt bearing capacity as per IS 800 Clause 10.3.4
     */
    static boltBearingCapacity(d: number, t: number, fu: number, e: number, p: number, fub: number): number {
        const kb = Math.min(e / (3 * d), p / (3 * d) - 0.25, fub / fu, 1.0);
        const Vnpb = 2.5 * kb * d * t * fu;
        return Vnpb / this.γmb;
    }

    /**
     * Weld strength as per IS 800 Clause 10.5
     * Design strength = 0.7 * s * Lw * fu / (√3 * γmw)
     */
    static filletWeldCapacity(s: number, Lw: number, fu: number): number {
        return (0.7 * s * Lw * fu) / (Math.sqrt(3) * this.γmw);
    }

    /**
     * Slenderness limits as per IS 800 Table 3
     */
    static slendernessLimit(memberType: 'main_compression' | 'main_tension' | 'bracing'): number {
        const limits: Record<string, number> = {
            'main_compression': 180,
            'main_tension': 400,
            'bracing': 250
        };
        return limits[memberType] ?? 180;
    }

    /**
     * Width-to-thickness ratio limits for plastic sections
     * as per IS 800 Table 2
     */
    static compactSectionLimit(element: 'outstand_flange' | 'internal_flange' | 'web', ε: number): number {
        const limits: Record<string, number> = {
            'outstand_flange': 9.4 * ε,
            'internal_flange': 29.3 * ε,
            'web': 84 * ε
        };
        return limits[element] ?? 10 * ε;
    }
}

// ============================================
// IS 1893:2016 - SEISMIC DESIGN
// ============================================

export interface SeismicZone {
    zone: string;
    Z: number;  // Zone factor
}

export const IS1893_ZONES: SeismicZone[] = [
    { zone: 'II', Z: 0.10 },
    { zone: 'III', Z: 0.16 },
    { zone: 'IV', Z: 0.24 },
    { zone: 'V', Z: 0.36 },
];

export class IS1893_Seismic {
    /**
     * Design horizontal seismic coefficient Ah
     * Ah = (Z/2) * (I/R) * (Sa/g)
     */
    static designSeismicCoefficient(Z: number, I: number, R: number, Sa_g: number): number {
        return (Z / 2) * (I / R) * Sa_g;
    }

    /**
     * Spectral acceleration coefficient Sa/g as per IS 1893 Clause 6.4
     * For medium soil (Type II)
     */
    static spectralAcceleration(T: number, soilType: 'rock' | 'medium' | 'soft'): number {
        if (soilType === 'rock') {
            if (T <= 0.10) return 1.0 + 15 * T;
            else if (T <= 0.40) return 2.5;
            else return 1.0 / T;
        } else if (soilType === 'medium') {
            if (T <= 0.10) return 1.0 + 15 * T;
            else if (T <= 0.55) return 2.5;
            else return 1.36 / T;
        } else {
            // Soft soil
            if (T <= 0.10) return 1.0 + 15 * T;
            else if (T <= 0.67) return 2.5;
            else return 1.67 / T;
        }
    }

    /**
     * Importance Factor I as per IS 1893 Table 8
     */
    static importanceFactor(buildingType: 'critical' | 'important' | 'ordinary'): number {
        const factors: Record<string, number> = {
            'critical': 1.5,    // Hospitals, fire stations
            'important': 1.2,   // Schools, assembly halls
            'ordinary': 1.0     // Residential, commercial
        };
        return factors[buildingType] ?? 1.0;
    }

    /**
     * Response Reduction Factor R as per IS 1893 Table 9
     */
    static responseReductionFactor(structureType: string): number {
        const factors: Record<string, number> = {
            'SMRF': 5.0,        // Special Moment Resisting Frame
            'OMRF': 3.0,        // Ordinary MRF
            'braced': 4.0,      // Braced frame
            'shear_wall': 4.0,  // Buildings with shear walls
            'masonry': 1.5,     // Unreinforced masonry
        };
        return factors[structureType] ?? 3.0;
    }

    /**
     * Approximate fundamental natural period T as per IS 1893 Clause 7.6
     */
    static approximatePeriod(h: number, d: number, frameType: 'steel' | 'rc' | 'masonry'): number {
        if (frameType === 'steel') {
            return 0.085 * Math.pow(h, 0.75);
        } else if (frameType === 'rc') {
            return 0.075 * Math.pow(h, 0.75);
        } else {
            // Masonry or other
            return 0.09 * h / Math.sqrt(d);
        }
    }

    /**
     * Design base shear VB = Ah * W
     */
    static designBaseShear(Ah: number, W: number): number {
        return Ah * W;
    }
}

export default {
    IS456_CONCRETE_GRADES,
    IS456_REBAR_GRADES,
    IS456_Design,
    IS800_STEEL_GRADES,
    IS800_Design,
    IS1893_ZONES,
    IS1893_Seismic
};
