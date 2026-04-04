/**
 * SeismicResponseSpectrum.ts
 * 
 * ASCE 7-22 Seismic Response Spectrum Analysis
 * 
 * Features:
 * - Site class determination
 * - Spectral acceleration parameters
 * - Design response spectrum
 * - Equivalent lateral force procedure
 * - Vertical distribution of forces
 */

// ============================================
// TYPES
// ============================================

export type SiteClass = 'A' | 'B' | 'C' | 'D' | 'E' | 'F';
export type SeismicDesignCategory = 'A' | 'B' | 'C' | 'D' | 'E' | 'F';

export interface SiteParameters {
    Ss: number;           // Mapped MCEr spectral acceleration at short period
    S1: number;           // Mapped MCEr spectral acceleration at 1 sec
    siteClass: SiteClass;
    TL: number;           // Long-period transition period
}

export interface DesignSpectra {
    SDS: number;          // Design spectral acceleration at short period
    SD1: number;          // Design spectral acceleration at 1 sec
    T0: number;           // Period at start of constant Sa
    Ts: number;           // Period at end of constant Sa
    TL: number;           // Long-period transition
}

interface SpectrumPoint {
    T: number;            // Period (sec)
    Sa: number;           // Spectral acceleration (g)
}

export interface ELFResult {
    T: number;            // Fundamental period
    Cs: number;           // Seismic response coefficient
    V: number;            // Base shear (kips)
    storyForces: Array<{
        level: number;
        height: number;
        weight: number;
        Cvx: number;
        Fx: number;
    }>;
    overturningMoment: number;
}

// ============================================
// SITE COEFFICIENTS (Tables 11.4-1, 11.4-2)
// ============================================

const FA_VALUES: Record<SiteClass, number[]> = {
    // Ss:        0.25   0.5    0.75   1.0    1.25   1.5
    'A': [0.8, 0.8, 0.8, 0.8, 0.8, 0.8],
    'B': [0.9, 0.9, 0.9, 0.9, 0.9, 0.9],
    'C': [1.3, 1.3, 1.2, 1.2, 1.2, 1.2],
    'D': [1.6, 1.4, 1.2, 1.1, 1.0, 1.0],
    'E': [2.4, 1.7, 1.3, 1.0, 0.9, 0.9],
    'F': [0, 0, 0, 0, 0, 0] // Site-specific required
};

const FV_VALUES: Record<SiteClass, number[]> = {
    // S1:        0.1    0.2    0.3    0.4    0.5    0.6
    'A': [0.8, 0.8, 0.8, 0.8, 0.8, 0.8],
    'B': [0.8, 0.8, 0.8, 0.8, 0.8, 0.8],
    'C': [1.5, 1.5, 1.5, 1.5, 1.4, 1.3],
    'D': [2.4, 2.2, 2.0, 1.9, 1.8, 1.7],
    'E': [4.2, 3.3, 2.8, 2.4, 2.2, 2.0],
    'F': [0, 0, 0, 0, 0, 0] // Site-specific required
};

// ============================================
// SEISMIC RESPONSE SPECTRUM SERVICE
// ============================================

class SeismicResponseSpectrumClass {
    /**
     * Calculate site coefficients Fa and Fv
     */
    getSiteCoefficients(params: SiteParameters): { Fa: number; Fv: number } {
        const { Ss, S1, siteClass } = params;

        // Interpolate Fa
        const ssValues = [0.25, 0.5, 0.75, 1.0, 1.25, 1.5];
        const faValues = FA_VALUES[siteClass];
        const Fa = this.interpolate(Ss, ssValues, faValues);

        // Interpolate Fv
        const s1Values = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6];
        const fvValues = FV_VALUES[siteClass];
        const Fv = this.interpolate(S1, s1Values, fvValues);

        return { Fa, Fv };
    }

    /**
     * Calculate design spectra parameters
     */
    getDesignSpectra(params: SiteParameters): DesignSpectra {
        const { Fa, Fv } = this.getSiteCoefficients(params);
        const { Ss, S1, TL } = params;

        // MCEr spectral accelerations (11.4)
        const SMS = Fa * Ss;
        const SM1 = Fv * S1;

        // Design spectral accelerations (11.4.5)
        const SDS = (2 / 3) * SMS;
        const SD1 = (2 / 3) * SM1;

        // Characteristic periods
        const T0 = 0.2 * SD1 / SDS;
        const Ts = SD1 / SDS;

        return { SDS, SD1, T0, Ts, TL };
    }

    /**
     * Get spectral acceleration at period T
     */
    getSa(T: number, spectra: DesignSpectra): number {
        const { SDS, SD1, T0, Ts, TL } = spectra;

        if (T < T0) {
            // Ascending branch
            return SDS * (0.4 + 0.6 * T / T0);
        } else if (T <= Ts) {
            // Flat plateau
            return SDS;
        } else if (T <= TL) {
            // Descending branch (1/T region)
            return SD1 / T;
        } else {
            // Long-period descending (1/T² region)
            return SD1 * TL / (T * T);
        }
    }

    /**
     * Generate full response spectrum
     */
    generateSpectrum(
        params: SiteParameters,
        Tmax: number = 4.0,
        numPoints: number = 100
    ): SpectrumPoint[] {
        const spectra = this.getDesignSpectra(params);
        const points: SpectrumPoint[] = [];

        for (let i = 0; i <= numPoints; i++) {
            const T = (i / numPoints) * Tmax;
            points.push({
                T,
                Sa: this.getSa(T, spectra)
            });
        }

        return points;
    }

    /**
     * Determine Seismic Design Category
     */
    getSDC(
        spectra: DesignSpectra,
        riskCategory: 'I' | 'II' | 'III' | 'IV'
    ): SeismicDesignCategory {
        const { SDS, SD1 } = spectra;

        // Risk Category I or II
        if (riskCategory === 'I' || riskCategory === 'II') {
            if (SDS < 0.167 && SD1 < 0.067) return 'A';
            if (SDS < 0.33 && SD1 < 0.133) return 'B';
            if (SDS < 0.50 && SD1 < 0.20) return 'C';
            return 'D';
        }

        // Risk Category III
        if (riskCategory === 'III') {
            if (SDS < 0.167 && SD1 < 0.067) return 'A';
            if (SDS < 0.33 && SD1 < 0.133) return 'C';
            return 'D';
        }

        // Risk Category IV
        if (SDS < 0.167 && SD1 < 0.067) return 'A';
        if (SDS < 0.33 && SD1 < 0.133) return 'C';
        if (SDS >= 0.75 || SD1 >= 0.40) return 'F';
        return 'D';
    }

    /**
     * Equivalent Lateral Force Procedure (12.8)
     */
    calculateELF(
        params: SiteParameters,
        building: {
            W: number;              // Seismic weight (kips)
            storyHeights: number[]; // Heights from base (ft)
            storyWeights: number[]; // Story weights (kips)
            R: number;              // Response modification coefficient
            Ie: number;             // Importance factor
            Ct: number;             // Period coefficient
            x: number;              // Period exponent
        }
    ): ELFResult {
        const spectra = this.getDesignSpectra(params);
        const { SDS, SD1, TL } = spectra;
        const { W, storyHeights, storyWeights, R, Ie, Ct, x } = building;

        // Approximate fundamental period (12.8.2.1)
        const hn = storyHeights[storyHeights.length - 1];
        const Ta = Ct * hn ** x;
        const T = Ta; // Could use Tcomputed with Cu limit

        // Seismic response coefficient (12.8.1.1)
        let Cs = SDS / (R / Ie);

        // Check limits
        const CsMax = T <= TL
            ? SD1 / (T * R / Ie)
            : SD1 * TL / (T * T * R / Ie);
        const CsMin = Math.max(0.044 * SDS * Ie, 0.01);

        Cs = Math.min(Cs, CsMax);
        Cs = Math.max(Cs, CsMin);

        // Base shear
        const V = Cs * W;

        // Vertical distribution (12.8.3)
        const k = T <= 0.5 ? 1 : T >= 2.5 ? 2 : 1 + (T - 0.5) / 2;

        // Calculate Cvx and Fx
        let sumWh = 0;
        for (let i = 0; i < storyHeights.length; i++) {
            sumWh += storyWeights[i] * storyHeights[i] ** k;
        }

        const storyForces = storyHeights.map((h, i) => {
            const Cvx = (storyWeights[i] * h ** k) / sumWh;
            const Fx = Cvx * V;
            return {
                level: i + 1,
                height: h,
                weight: storyWeights[i],
                Cvx,
                Fx
            };
        });

        // Overturning moment
        const overturningMoment = storyForces.reduce(
            (sum, f) => sum + f.Fx * f.height, 0
        );

        return {
            T,
            Cs,
            V,
            storyForces,
            overturningMoment
        };
    }

    /**
     * Quick ELF calculation
     */
    quickELF(
        Ss: number,
        S1: number,
        siteClass: SiteClass,
        W: number,
        height: number,
        numStories: number,
        R: number
    ): { V: number; Cs: number; T: number } {
        const storyHeight = height / numStories;
        const storyHeights = Array.from({ length: numStories }, (_, i) => (i + 1) * storyHeight);
        const storyWeights = Array(numStories).fill(W / numStories);

        const result = this.calculateELF(
            { Ss, S1, siteClass, TL: 8 },
            {
                W,
                storyHeights,
                storyWeights,
                R,
                Ie: 1.0,
                Ct: 0.028, // Steel moment frame
                x: 0.8
            }
        );

        return {
            V: result.V,
            Cs: result.Cs,
            T: result.T
        };
    }

    /**
     * Linear interpolation helper
     */
    private interpolate(x: number, xs: number[], ys: number[]): number {
        if (x <= xs[0]) return ys[0];
        if (x >= xs[xs.length - 1]) return ys[ys.length - 1];

        for (let i = 0; i < xs.length - 1; i++) {
            if (x >= xs[i] && x <= xs[i + 1]) {
                const ratio = (x - xs[i]) / (xs[i + 1] - xs[i]);
                return ys[i] + ratio * (ys[i + 1] - ys[i]);
            }
        }

        return ys[ys.length - 1];
    }
}

// ============================================
// SINGLETON
// ============================================

export const seismicSpectrum = new SeismicResponseSpectrumClass();

export default SeismicResponseSpectrumClass;
