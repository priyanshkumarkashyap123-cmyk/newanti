/**
 * EnvironmentalService.ts
 * 
 * Environmental Engineering Module
 * 
 * Features:
 * - Water treatment design
 * - Wastewater treatment
 * - Air quality analysis
 * - Solid waste management
 * - Noise pollution
 */

// ============================================
// TYPES
// ============================================

export interface WaterQuality {
    pH: number;
    turbidity: number;          // NTU
    TSS: number;                // mg/L (Total Suspended Solids)
    TDS: number;                // mg/L (Total Dissolved Solids)
    BOD: number;                // mg/L (Biochemical Oxygen Demand)
    COD: number;                // mg/L (Chemical Oxygen Demand)
    ammonia: number;            // mg/L (NH3-N)
    nitrate: number;            // mg/L (NO3-N)
    phosphate: number;          // mg/L (PO4)
    coliform: number;           // MPN/100mL
    hardness?: number;          // mg/L as CaCO3
    alkalinity?: number;        // mg/L as CaCO3
    chloride?: number;          // mg/L
    fluoride?: number;          // mg/L
    arsenic?: number;           // mg/L
    iron?: number;              // mg/L
}

export interface TreatmentUnit {
    name: string;
    type: string;
    removalEfficiency: Record<string, number>; // Parameter -> % removal
    detentionTime?: number;     // hours
    surfaceLoadingRate?: number; // m³/m²/day
    dimensions?: { length: number; width: number; depth: number };
    power?: number;             // kW
}

export interface WTPDesign {
    capacity: number;           // MLD (Million Liters/Day)
    units: TreatmentUnit[];
    sludgeProduction: number;   // kg/day
    chemicalDosage: Record<string, number>; // Chemical -> mg/L
    treatedWaterQuality: WaterQuality;
}

export interface STPDesign {
    capacity: number;           // MLD
    units: TreatmentUnit[];
    sludgeProduction: number;   // kg/day
    biogas?: number;            // m³/day
    effluentQuality: WaterQuality;
}

export interface AirQuality {
    PM2_5: number;              // μg/m³
    PM10: number;               // μg/m³
    SO2: number;                // μg/m³
    NO2: number;                // μg/m³
    CO: number;                 // mg/m³
    O3: number;                 // μg/m³
    Pb?: number;                // μg/m³
    AQI?: number;               // Air Quality Index
}

export interface SolidWaste {
    totalQuantity: number;      // tonnes/day
    composition: {
        organic: number;          // %
        paper: number;            // %
        plastic: number;          // %
        glass: number;            // %
        metal: number;            // %
        inert: number;            // %
    };
    moisture: number;           // %
    density: number;            // kg/m³
    calorificValue: number;     // kcal/kg
}

export interface NoisePollution {
    sourceLevel: number;        // dB(A)
    distance: number;           // m
    barriers?: { height: number; distance: number }[];
    receivedLevel: number;      // dB(A)
    compliance: boolean;
}

// ============================================
// DRINKING WATER STANDARDS
// ============================================

const DRINKING_WATER_STANDARDS: Record<string, { acceptable: number; permissible: number }> = {
    'pH': { acceptable: 7.5, permissible: 8.5 },
    'turbidity': { acceptable: 1, permissible: 5 },
    'TDS': { acceptable: 500, permissible: 2000 },
    'hardness': { acceptable: 200, permissible: 600 },
    'chloride': { acceptable: 250, permissible: 1000 },
    'fluoride': { acceptable: 1.0, permissible: 1.5 },
    'iron': { acceptable: 0.3, permissible: 1.0 },
    'arsenic': { acceptable: 0.01, permissible: 0.05 }
};

// ============================================
// ENVIRONMENTAL SERVICE
// ============================================

class EnvironmentalServiceClass {
    /**
     * Design Water Treatment Plant
     */
    designWTP(
        capacity: number,          // MLD
        rawWaterQuality: WaterQuality,
        targetQuality?: Partial<WaterQuality>
    ): WTPDesign {
        const units: TreatmentUnit[] = [];
        const chemicals: Record<string, number> = {};
        const Q = capacity * 1000 / 24; // m³/hr

        // 1. Intake & Screening
        units.push({
            name: 'Intake',
            type: 'Screen',
            removalEfficiency: { 'TSS': 10, 'debris': 90 }
        });

        // 2. Aeration (if iron present)
        if (rawWaterQuality.iron && rawWaterQuality.iron > 0.3) {
            units.push({
                name: 'Aerator',
                type: 'Cascade',
                removalEfficiency: { 'iron': 70, 'CO2': 50 },
                dimensions: { length: 5, width: 3, depth: 2 }
            });
        }

        // 3. Coagulation
        const turbidity = rawWaterQuality.turbidity;
        const alumDose = turbidity < 10 ? 10 : turbidity < 50 ? 20 : 40; // mg/L
        chemicals['alum'] = alumDose;
        units.push({
            name: 'Flash Mixer',
            type: 'Mechanical',
            removalEfficiency: {},
            detentionTime: 0.5 / 60, // 30 seconds
            power: Q * 0.05
        });

        // 4. Flocculation
        units.push({
            name: 'Flocculator',
            type: 'Mechanical/Hydraulic',
            removalEfficiency: {},
            detentionTime: 0.5, // 30 min
            dimensions: { length: 10, width: 6, depth: 4 }
        });

        // 5. Sedimentation
        const SLR = turbidity > 50 ? 20 : 30; // m³/m²/day
        const area = (capacity * 1000) / SLR;
        units.push({
            name: 'Clarifier',
            type: 'Rectangular/Circular',
            removalEfficiency: { 'TSS': 85, 'turbidity': 80 },
            detentionTime: 3,
            surfaceLoadingRate: SLR,
            dimensions: {
                length: Math.sqrt(area * 2),
                width: Math.sqrt(area / 2),
                depth: 4
            }
        });

        // 6. Filtration
        const filterRate = 6; // m³/m²/hr (rapid sand filter)
        const filterArea = Q / filterRate;
        units.push({
            name: 'Rapid Sand Filter',
            type: 'Gravity',
            removalEfficiency: { 'TSS': 95, 'turbidity': 90, 'coliform': 95 },
            surfaceLoadingRate: filterRate * 24,
            dimensions: {
                length: Math.sqrt(filterArea * 1.5),
                width: Math.sqrt(filterArea / 1.5),
                depth: 3.5
            }
        });

        // 7. Disinfection
        chemicals['chlorine'] = 2; // mg/L
        units.push({
            name: 'Chlorination',
            type: 'Gas/Liquid',
            removalEfficiency: { 'coliform': 99.99 },
            detentionTime: 0.5
        });

        // Calculate final quality
        const treatedQuality: WaterQuality = {
            pH: 7.2,
            turbidity: rawWaterQuality.turbidity * 0.01,
            TSS: rawWaterQuality.TSS * 0.02,
            TDS: rawWaterQuality.TDS * 0.95,
            BOD: rawWaterQuality.BOD * 0.3,
            COD: rawWaterQuality.COD * 0.4,
            ammonia: rawWaterQuality.ammonia * 0.7,
            nitrate: rawWaterQuality.nitrate * 0.9,
            phosphate: rawWaterQuality.phosphate * 0.5,
            coliform: 0
        };

        // Sludge production (approx 0.5-2% of flow as dry solids)
        const sludgeProduction = capacity * 1000 * 0.01 * (rawWaterQuality.TSS / 1000);

        return {
            capacity,
            units,
            sludgeProduction,
            chemicalDosage: chemicals,
            treatedWaterQuality: treatedQuality
        };
    }

    /**
     * Design Sewage Treatment Plant (Activated Sludge)
     */
    designSTP(
        capacity: number,          // MLD
        influentQuality: WaterQuality,
        targetBOD: number = 30     // mg/L
    ): STPDesign {
        const units: TreatmentUnit[] = [];
        const Q = capacity * 1000; // m³/day

        // 1. Screening
        units.push({
            name: 'Screen',
            type: 'Mechanical Bar Screen',
            removalEfficiency: { 'TSS': 5, 'grit': 0 }
        });

        // 2. Grit Chamber
        units.push({
            name: 'Grit Chamber',
            type: 'Aerated',
            removalEfficiency: { 'grit': 95 },
            detentionTime: 0.05, // 3 min
            dimensions: { length: 10, width: 3, depth: 3 }
        });

        // 3. Primary Clarifier
        const primarySLR = 40; // m³/m²/day
        const primaryArea = Q / primarySLR;
        units.push({
            name: 'Primary Clarifier',
            type: 'Circular',
            removalEfficiency: { 'BOD': 35, 'TSS': 60 },
            detentionTime: 2,
            surfaceLoadingRate: primarySLR,
            dimensions: {
                length: Math.sqrt(primaryArea),
                width: Math.sqrt(primaryArea),
                depth: 3.5
            }
        });

        // 4. Aeration Tank
        const BOD_load = influentQuality.BOD * 0.65 * Q / 1000; // kg/day after primary
        const MLSS = 3000; // mg/L
        const FM = 0.2; // F/M ratio
        const aerationVolume = BOD_load / (FM * MLSS / 1000);
        const HRT = aerationVolume / (Q / 24);

        units.push({
            name: 'Aeration Tank',
            type: 'Activated Sludge',
            removalEfficiency: { 'BOD': 90, 'COD': 85, 'ammonia': 80 },
            detentionTime: HRT,
            dimensions: {
                length: Math.cbrt(aerationVolume * 4),
                width: Math.cbrt(aerationVolume * 4) / 2,
                depth: 4
            },
            power: aerationVolume * 0.03 // kW (approx 30W/m³ for fine bubble)
        });

        // 5. Secondary Clarifier
        const secondarySLR = 20; // m³/m²/day
        const secondaryArea = Q / secondarySLR;
        units.push({
            name: 'Secondary Clarifier',
            type: 'Circular',
            removalEfficiency: { 'TSS': 95 },
            detentionTime: 3,
            surfaceLoadingRate: secondarySLR,
            dimensions: {
                length: Math.sqrt(secondaryArea),
                width: Math.sqrt(secondaryArea),
                depth: 4
            }
        });

        // 6. Tertiary Treatment (if needed)
        if (targetBOD < 20) {
            units.push({
                name: 'Sand Filter',
                type: 'Tertiary',
                removalEfficiency: { 'TSS': 80, 'BOD': 50 },
                surfaceLoadingRate: 200
            });
        }

        // 7. Disinfection
        units.push({
            name: 'UV Disinfection',
            type: 'UV',
            removalEfficiency: { 'coliform': 99.9 },
            power: Q / 1000 * 20 // Approx 20 W per MLD
        });

        // Effluent quality
        const effluentQuality: WaterQuality = {
            pH: 7.0,
            turbidity: 5,
            TSS: 20,
            TDS: influentQuality.TDS * 0.9,
            BOD: influentQuality.BOD * 0.05,
            COD: influentQuality.COD * 0.1,
            ammonia: influentQuality.ammonia * 0.1,
            nitrate: influentQuality.nitrate + influentQuality.ammonia * 0.8,
            phosphate: influentQuality.phosphate * 0.5,
            coliform: 100
        };

        // Sludge production
        const sludgeProduction = BOD_load * 0.5; // kg dry solids/day

        // Biogas (if anaerobic digester used)
        const biogas = sludgeProduction * 0.8; // m³/kg VS destroyed (approx)

        return {
            capacity,
            units,
            sludgeProduction,
            biogas,
            effluentQuality
        };
    }

    /**
     * Calculate Air Quality Index
     */
    calculateAQI(airQuality: AirQuality): number {
        const subIndices: number[] = [];

        // PM2.5 sub-index (simplified EPA breakpoints)
        const pm25 = airQuality.PM2_5;
        if (pm25 <= 12) subIndices.push(pm25 * 50 / 12);
        else if (pm25 <= 35.4) subIndices.push(50 + (pm25 - 12) * 50 / 23.4);
        else if (pm25 <= 55.4) subIndices.push(100 + (pm25 - 35.4) * 50 / 20);
        else if (pm25 <= 150.4) subIndices.push(150 + (pm25 - 55.4) * 50 / 95);
        else subIndices.push(200 + (pm25 - 150.4) * 100 / 100);

        // PM10 sub-index
        const pm10 = airQuality.PM10;
        if (pm10 <= 50) subIndices.push(pm10);
        else if (pm10 <= 100) subIndices.push(pm10);
        else if (pm10 <= 250) subIndices.push(100 + (pm10 - 100) * 100 / 150);
        else subIndices.push(200 + (pm10 - 250) * 100 / 150);

        // Overall AQI is max of sub-indices
        return Math.max(...subIndices);
    }

    /**
     * Design landfill
     */
    designLandfill(
        waste: SolidWaste,
        designLife: number,        // years
        compactionRatio: number = 2.5
    ): {
        totalVolume: number;
        area: number;
        depth: number;
        leachateQuantity: number;
        gasProduction: number;
        phases: number;
    } {
        // Total waste over design life (with 3% growth)
        const totalWaste = waste.totalQuantity * 365 *
            ((Math.pow(1.03, designLife) - 1) / 0.03);

        // Volume after compaction
        const compactedDensity = waste.density * compactionRatio;
        const wasteVolume = totalWaste * 1000 / compactedDensity; // m³

        // Add 20% for cover material
        const totalVolume = wasteVolume * 1.2;

        // Typical depth 15-20m
        const depth = 15;
        const area = totalVolume / depth;

        // Leachate (assume 200mm/year precipitation, 30% collection)
        const leachateQuantity = area * 0.2 * 0.3; // m³/year

        // Gas production (assume 150 m³/tonne organic)
        const organicWaste = totalWaste * waste.composition.organic / 100;
        const gasProduction = organicWaste * 150 / designLife; // m³/year

        // Phased development
        const phases = Math.ceil(designLife / 5);

        return {
            totalVolume: Math.round(totalVolume),
            area: Math.round(area),
            depth,
            leachateQuantity: Math.round(leachateQuantity),
            gasProduction: Math.round(gasProduction),
            phases
        };
    }

    /**
     * Calculate noise attenuation
     */
    calculateNoiseLevel(
        sourceLevel: number,       // dB(A)
        distance: number,          // m from source
        barriers?: Array<{ height: number; distanceFromSource: number }>
    ): NoisePollution {
        // Distance attenuation (point source): L = L0 - 20*log(r/r0)
        const r0 = 1; // Reference distance 1m
        let attenuation = 20 * Math.log10(distance / r0);

        // Air absorption (approx 0.005 dB/m at 1kHz)
        attenuation += distance * 0.005;

        // Barrier attenuation (simplified Maekawa)
        if (barriers) {
            for (const barrier of barriers) {
                const pathDiff = this.calculatePathDifference(
                    barrier.height,
                    barrier.distanceFromSource,
                    distance
                );
                const N = 2 * pathDiff / 0.343; // Fresnel number at 1kHz
                const barrierAtt = N > 0 ? 10 * Math.log10(3 + 20 * N) : 0;
                attenuation += barrierAtt;
            }
        }

        const receivedLevel = sourceLevel - attenuation;

        // Check compliance (typical residential limit: 55 dB day, 45 dB night)
        const compliance = receivedLevel <= 55;

        return {
            sourceLevel,
            distance,
            barriers: barriers?.map(b => ({ height: b.height, distance: b.distanceFromSource })),
            receivedLevel: Math.round(receivedLevel * 10) / 10,
            compliance
        };
    }

    private calculatePathDifference(
        barrierHeight: number,
        barrierDistance: number,
        totalDistance: number
    ): number {
        const sourceHeight = 1.5; // m
        const receiverHeight = 1.5; // m
        const receiverDistance = totalDistance - barrierDistance;

        // Path over barrier
        const A = Math.sqrt(barrierDistance ** 2 + (barrierHeight - sourceHeight) ** 2);
        const B = Math.sqrt(receiverDistance ** 2 + (barrierHeight - receiverHeight) ** 2);

        // Direct path
        const D = totalDistance;

        return A + B - D;
    }

    /**
     * Check drinking water standards
     */
    checkWaterQuality(quality: WaterQuality): {
        parameter: string;
        value: number;
        acceptable: number;
        permissible: number;
        status: 'acceptable' | 'within_limit' | 'exceeds';
    }[] {
        const results: any[] = [];

        const params: Array<{ key: keyof WaterQuality; name: string }> = [
            { key: 'pH', name: 'pH' },
            { key: 'turbidity', name: 'turbidity' },
            { key: 'TDS', name: 'TDS' }
        ];

        for (const param of params) {
            const value = quality[param.key] as number;
            const std = DRINKING_WATER_STANDARDS[param.name];

            if (std) {
                let status: 'acceptable' | 'within_limit' | 'exceeds';
                if (value <= std.acceptable) status = 'acceptable';
                else if (value <= std.permissible) status = 'within_limit';
                else status = 'exceeds';

                results.push({
                    parameter: param.name,
                    value,
                    acceptable: std.acceptable,
                    permissible: std.permissible,
                    status
                });
            }
        }

        return results;
    }
}

// ============================================
// SINGLETON
// ============================================

export const environmental = new EnvironmentalServiceClass();

export default EnvironmentalServiceClass;
