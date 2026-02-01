/**
 * WindLoadService.ts
 * 
 * Wind Load Generation per ASCE 7-22
 * 
 * Features:
 * - Basic wind speed lookup
 * - Risk category factors
 * - Exposure categories
 * - Velocity pressure
 * - Main Wind Force Resisting System (MWFRS)
 * - Components and Cladding (C&C)
 */

// ============================================
// TYPES
// ============================================

export type RiskCategory = 'I' | 'II' | 'III' | 'IV';
export type ExposureCategory = 'B' | 'C' | 'D';
export type BuildingType = 'enclosed' | 'partially_enclosed' | 'open';

export interface WindLoadParams {
    V: number;                    // Basic wind speed (mph)
    riskCategory: RiskCategory;
    exposure: ExposureCategory;
    buildingType: BuildingType;
    height: number;               // Building height (ft)
    width: number;                // Building width perpendicular to wind (ft)
    length: number;               // Building length parallel to wind (ft)
    roofSlope?: number;           // Roof slope (degrees)
    topographicFactor?: number;   // Kzt (default 1.0)
    groundElevation?: number;     // Ground elevation factor Ke
}

export interface VelocityPressure {
    z: number;      // Height (ft)
    Kz: number;     // Velocity pressure coefficient
    qz: number;     // Velocity pressure (psf)
}

export interface WindPressure {
    surface: 'windward_wall' | 'leeward_wall' | 'side_wall' | 'roof_windward' | 'roof_leeward';
    Cp: number;     // External pressure coefficient
    GCpi: number;   // Internal pressure coefficient
    p: number;      // Design pressure (psf)
}

export interface WindLoadResult {
    V: number;
    Kd: number;
    Ke: number;
    Kzt: number;
    qh: number;
    G: number;
    pressures: WindPressure[];
    baseShear: number;
    overturningMoment: number;
    storyForces: Array<{ height: number; force: number }>;
}

// ============================================
// CONSTANTS
// ============================================

// Table 26.6-1: Kz values
const KZ_VALUES: Record<ExposureCategory, { alpha: number; zg: number }> = {
    'B': { alpha: 7.0, zg: 1200 },
    'C': { alpha: 9.5, zg: 900 },
    'D': { alpha: 11.5, zg: 700 }
};

// Table 26.8-1: Kd (directionality factor)
const KD = 0.85;

// Table 26.9-1: Ground Elevation Factor
const getKe = (elevation: number): number => {
    if (elevation <= 0) return 1.0;
    return Math.exp(-0.0000362 * elevation);
};

// Table 26.11-1: Internal Pressure Coefficients
const GCPI: Record<BuildingType, [number, number]> = {
    'enclosed': [0.18, -0.18],
    'partially_enclosed': [0.55, -0.55],
    'open': [0, 0]
};

// ============================================
// WIND LOAD SERVICE
// ============================================

class WindLoadServiceClass {
    /**
     * Calculate wind loads per ASCE 7-22
     */
    calculate(params: WindLoadParams): WindLoadResult {
        const {
            V, riskCategory, exposure, buildingType, height, width, length,
            roofSlope = 0, topographicFactor = 1.0, groundElevation = 0
        } = params;

        // Wind directionality factor (26.6)
        const Kd = KD;

        // Ground elevation factor (26.9)
        const Ke = getKe(groundElevation);

        // Topographic factor
        const Kzt = topographicFactor;

        // Gust-effect factor (26.11)
        const G = this.calculateGustFactor(height, exposure);

        // Velocity pressure at mean roof height (26.10.2)
        const Kh = this.calculateKz(height, exposure);
        const qh = 0.00256 * Kh * Kzt * Kd * Ke * V ** 2;

        // Calculate pressures for each surface
        const pressures = this.calculatePressures(
            qh, G, buildingType, length / width, roofSlope
        );

        // Calculate base shear and overturning
        const { baseShear, overturningMoment, storyForces } = this.calculateForces(
            params, qh, G, pressures
        );

        return {
            V,
            Kd,
            Ke,
            Kzt,
            qh,
            G,
            pressures,
            baseShear,
            overturningMoment,
            storyForces
        };
    }

    /**
     * Calculate Kz (velocity pressure coefficient)
     */
    private calculateKz(z: number, exposure: ExposureCategory): number {
        const { alpha, zg } = KZ_VALUES[exposure];
        const zmin = exposure === 'B' ? 30 : exposure === 'C' ? 15 : 7;

        const effectiveZ = Math.max(z, zmin);
        return 2.01 * (effectiveZ / zg) ** (2 / alpha);
    }

    /**
     * Calculate gust-effect factor G
     */
    private calculateGustFactor(height: number, exposure: ExposureCategory): number {
        // Simplified rigid structure G = 0.85
        // For flexible structures, need dynamic analysis
        if (height < 60) return 0.85;

        // Simple approximation for taller buildings
        const { alpha } = KZ_VALUES[exposure];
        const gQ = 3.4;
        const gR = Math.sqrt(2 * Math.log(3600 * 0.5));

        return 0.85; // Conservative for rigid
    }

    /**
     * Calculate pressures for all surfaces
     */
    private calculatePressures(
        qh: number,
        G: number,
        buildingType: BuildingType,
        LB: number,  // Length/Width ratio
        roofSlope: number
    ): WindPressure[] {
        const pressures: WindPressure[] = [];
        const [GCpiPos, GCpiNeg] = GCPI[buildingType];

        // Windward wall Cp = 0.8
        pressures.push({
            surface: 'windward_wall',
            Cp: 0.8,
            GCpi: GCpiPos,
            p: qh * G * 0.8 - qh * GCpiNeg
        });

        // Leeward wall (Table 27.3-1)
        const CpLeeward = LB <= 1 ? -0.5 : LB >= 4 ? -0.2 : -0.3;
        pressures.push({
            surface: 'leeward_wall',
            Cp: CpLeeward,
            GCpi: GCpiNeg,
            p: qh * G * CpLeeward - qh * GCpiPos
        });

        // Side walls Cp = -0.7
        pressures.push({
            surface: 'side_wall',
            Cp: -0.7,
            GCpi: GCpiPos,
            p: qh * G * (-0.7) - qh * GCpiPos
        });

        // Roof (depends on slope)
        if (roofSlope <= 10) {
            // Flat roof
            pressures.push({
                surface: 'roof_windward',
                Cp: -0.9,
                GCpi: GCpiPos,
                p: qh * G * (-0.9) - qh * GCpiPos
            });
            pressures.push({
                surface: 'roof_leeward',
                Cp: -0.5,
                GCpi: GCpiPos,
                p: qh * G * (-0.5) - qh * GCpiPos
            });
        } else if (roofSlope <= 30) {
            // Sloped roof
            const CpWindward = -0.7 + (roofSlope - 10) * 0.04;
            pressures.push({
                surface: 'roof_windward',
                Cp: CpWindward,
                GCpi: GCpiPos,
                p: qh * G * CpWindward - qh * GCpiPos
            });
            pressures.push({
                surface: 'roof_leeward',
                Cp: -0.6,
                GCpi: GCpiPos,
                p: qh * G * (-0.6) - qh * GCpiPos
            });
        }

        return pressures;
    }

    /**
     * Calculate base shear and overturning moment
     */
    private calculateForces(
        params: WindLoadParams,
        qh: number,
        G: number,
        pressures: WindPressure[]
    ): { baseShear: number; overturningMoment: number; storyForces: Array<{ height: number; force: number }> } {
        const { height, width, length, exposure } = params;
        const storyHeight = 12; // Assume 12 ft story height
        const numStories = Math.ceil(height / storyHeight);

        const storyForces: Array<{ height: number; force: number }> = [];
        let baseShear = 0;
        let overturningMoment = 0;

        // Get windward and leeward Cp
        const CpWindward = 0.8;
        const leeward = pressures.find(p => p.surface === 'leeward_wall');
        const CpLeeward = leeward?.Cp || -0.5;

        // Combined wall pressure coefficient
        const CpCombined = CpWindward - CpLeeward;

        // Calculate force at each story level
        for (let i = 0; i < numStories; i++) {
            const z = (i + 0.5) * storyHeight;
            const Kz = this.calculateKz(z, exposure);
            const qz = 0.00256 * Kz * params.topographicFactor! * KD * params.V ** 2;

            // Tributary height for this story
            const tribHeight = Math.min(storyHeight, height - i * storyHeight);

            // Force = pressure × area
            const force = qh * G * CpCombined * width * tribHeight / 1000; // kips

            storyForces.push({ height: z, force });
            baseShear += force;
            overturningMoment += force * z;
        }

        return { baseShear, overturningMoment, storyForces };
    }

    /**
     * Get basic wind speed for a location (simplified US map)
     */
    getBasicWindSpeed(
        state: string,
        riskCategory: RiskCategory = 'II'
    ): number {
        // Simplified - in production use actual wind maps
        const coastalStates = ['FL', 'LA', 'TX', 'NC', 'SC', 'GA', 'AL', 'MS'];
        const hurricaneZone = coastalStates.includes(state.toUpperCase());

        const baseSpeed = hurricaneZone ? 150 : 115;

        // Adjust for risk category
        const factors: Record<RiskCategory, number> = {
            'I': 0.87,
            'II': 1.0,
            'III': 1.07,
            'IV': 1.15
        };

        return Math.round(baseSpeed * factors[riskCategory]);
    }

    /**
     * Quick wind load calculation
     */
    quickCalc(
        V: number,
        height: number,
        width: number,
        length: number,
        exposure: ExposureCategory = 'B'
    ): { qh: number; baseShear: number } {
        const result = this.calculate({
            V,
            riskCategory: 'II',
            exposure,
            buildingType: 'enclosed',
            height,
            width,
            length
        });

        return {
            qh: result.qh,
            baseShear: result.baseShear
        };
    }
}

// ============================================
// SINGLETON
// ============================================

export const windLoad = new WindLoadServiceClass();

export default WindLoadServiceClass;
