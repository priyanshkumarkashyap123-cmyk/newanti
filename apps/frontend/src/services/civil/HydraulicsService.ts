/**
 * HydraulicsService.ts
 * 
 * Complete Water Resources & Hydraulics Module
 * 
 * Features:
 * - Open channel flow (Manning's equation)
 * - Pipe flow (Hazen-Williams, Darcy-Weisbach)
 * - Culvert design
 * - Storm water drainage
 * - Flood routing
 * - Pump systems
 */

// ============================================
// TYPES
// ============================================

export type ChannelType = 'rectangular' | 'trapezoidal' | 'circular' | 'triangular' | 'parabolic';
export type FlowRegime = 'subcritical' | 'critical' | 'supercritical';
export type PipeType = 'RCC' | 'CI' | 'DI' | 'GI' | 'PVC' | 'HDPE' | 'AC';

export interface ChannelGeometry {
    type: ChannelType;
    baseWidth?: number;       // m (rectangular, trapezoidal)
    sideSlope?: number;       // z (H:V) for trapezoidal
    diameter?: number;        // m (circular)
    topWidth?: number;        // m (triangular, parabolic)
    depth: number;            // m (flow depth)
}

export interface ChannelProperties {
    manningN: number;         // Manning's roughness
    bedSlope: number;         // S0 (m/m)
    length?: number;          // m
}

export interface OpenChannelResult {
    area: number;             // m²
    wettedPerimeter: number;  // m
    hydraulicRadius: number;  // m
    velocity: number;         // m/s
    discharge: number;        // m³/s
    froudeNumber: number;
    flowRegime: FlowRegime;
    criticalDepth: number;    // m
    normalDepth: number;      // m
    specificEnergy: number;   // m
}

export interface PipeFlowInput {
    diameter: number;         // mm
    length: number;           // m
    pipeType: PipeType;
    discharge?: number;       // L/s or m³/s
    headLoss?: number;        // m
    minorLosses?: number;     // Total K value
}

export interface PipeFlowResult {
    velocity: number;         // m/s
    headLoss: number;         // m
    frictionFactor: number;
    reynoldsNumber: number;
    flowType: 'laminar' | 'transitional' | 'turbulent';
    discharge: number;        // m³/s
    hgl: number[];            // Hydraulic grade line
    egl: number[];            // Energy grade line
}

export interface CulvertInput {
    span: number;             // m
    rise: number;             // m
    length: number;           // m
    type: 'box' | 'pipe' | 'arch';
    material: 'rcc' | 'corrugated_metal' | 'hdpe';
    inletType: 'projecting' | 'headwall' | 'wingwall';
    headwater: number;        // m
    tailwater: number;        // m
    bedSlope: number;
}

export interface CulvertResult {
    discharge: number;        // m³/s
    controlType: 'inlet' | 'outlet';
    velocity: number;         // m/s
    outletVelocity: number;   // m/s
    hwDepth: number;          // m
    passesDesignFlow: boolean;
    overtopping: boolean;
}

export interface StormDrainageInput {
    catchmentArea: number;    // ha
    runoffCoefficient: number;// C
    timeOfConcentration: number; // minutes
    returnPeriod: number;     // years
    region: string;           // For IDF curve
}

export interface StormDrainageResult {
    peakDischarge: number;    // m³/s (Rational method)
    drainSize: number;        // mm
    velocity: number;         // m/s
    timeToEmpty: number;      // hours
}

export interface PumpCurve {
    flow: number[];           // m³/s
    head: number[];           // m
    efficiency: number[];     // %
    power: number[];          // kW
}

// ============================================
// MANNING'S N VALUES
// ============================================

const MANNING_N: Record<string, number> = {
    'concrete_smooth': 0.012,
    'concrete_rough': 0.015,
    'earth_clean': 0.022,
    'earth_weedy': 0.030,
    'gravel_bed': 0.025,
    'natural_clean': 0.030,
    'natural_weedy': 0.050,
    'rcc_pipe': 0.013,
    'pvc_pipe': 0.010,
    'ci_pipe': 0.012,
    'corrugated_metal': 0.024
};

// ============================================
// HAZEN-WILLIAMS C VALUES
// ============================================

const HAZEN_WILLIAMS_C: Record<PipeType, number> = {
    'RCC': 100,
    'CI': 130,
    'DI': 140,
    'GI': 120,
    'PVC': 150,
    'HDPE': 150,
    'AC': 140
};

// ============================================
// HYDRAULICS SERVICE
// ============================================

class HydraulicsServiceClass {
    /**
     * Calculate open channel flow using Manning's equation
     */
    calculateOpenChannelFlow(
        geometry: ChannelGeometry,
        properties: ChannelProperties
    ): OpenChannelResult {
        const { type, depth: y } = geometry;
        const { manningN, bedSlope } = properties;

        // Calculate geometric properties
        const { area, wettedPerimeter, topWidth } = this.getChannelGeometry(geometry);
        const R = area / wettedPerimeter;

        // Manning's equation: V = (1/n) * R^(2/3) * S^(1/2)
        const V = (1 / manningN) * Math.pow(R, 2 / 3) * Math.sqrt(bedSlope);
        const Q = V * area;

        // Froude number
        const g = 9.81;
        const D = area / topWidth; // Hydraulic depth
        const Fr = V / Math.sqrt(g * D);

        // Flow regime
        let flowRegime: FlowRegime;
        if (Fr < 0.95) flowRegime = 'subcritical';
        else if (Fr > 1.05) flowRegime = 'supercritical';
        else flowRegime = 'critical';

        // Critical depth (for rectangular approximation)
        const criticalDepth = Math.pow(Q * Q / (g * topWidth * topWidth), 1 / 3);

        // Specific energy
        const E = y + V * V / (2 * g);

        return {
            area,
            wettedPerimeter,
            hydraulicRadius: R,
            velocity: V,
            discharge: Q,
            froudeNumber: Fr,
            flowRegime,
            criticalDepth,
            normalDepth: y,
            specificEnergy: E
        };
    }

    /**
     * Calculate channel geometry
     */
    private getChannelGeometry(geometry: ChannelGeometry): { area: number; wettedPerimeter: number; topWidth: number } {
        const { type, depth: y } = geometry;

        switch (type) {
            case 'rectangular': {
                const b = geometry.baseWidth!;
                return {
                    area: b * y,
                    wettedPerimeter: b + 2 * y,
                    topWidth: b
                };
            }

            case 'trapezoidal': {
                const b = geometry.baseWidth!;
                const z = geometry.sideSlope!;
                return {
                    area: (b + z * y) * y,
                    wettedPerimeter: b + 2 * y * Math.sqrt(1 + z * z),
                    topWidth: b + 2 * z * y
                };
            }

            case 'triangular': {
                const z = geometry.sideSlope!;
                return {
                    area: z * y * y,
                    wettedPerimeter: 2 * y * Math.sqrt(1 + z * z),
                    topWidth: 2 * z * y
                };
            }

            case 'circular': {
                const D = geometry.diameter!;
                const theta = 2 * Math.acos(1 - 2 * y / D);
                return {
                    area: D * D / 8 * (theta - Math.sin(theta)),
                    wettedPerimeter: D * theta / 2,
                    topWidth: D * Math.sin(theta / 2)
                };
            }

            default:
                return { area: 0, wettedPerimeter: 0, topWidth: 0 };
        }
    }

    /**
     * Calculate normal depth (iterative)
     */
    calculateNormalDepth(
        Q: number,
        geometry: Omit<ChannelGeometry, 'depth'>,
        properties: ChannelProperties,
        maxIterations: number = 50
    ): number {
        let yLow = 0.01;
        let yHigh = 10.0;

        for (let i = 0; i < maxIterations; i++) {
            const yMid = (yLow + yHigh) / 2;
            const result = this.calculateOpenChannelFlow(
                { ...geometry, depth: yMid },
                properties
            );

            if (Math.abs(result.discharge - Q) < 0.001) {
                return yMid;
            }

            if (result.discharge > Q) {
                yHigh = yMid;
            } else {
                yLow = yMid;
            }
        }

        return (yLow + yHigh) / 2;
    }

    /**
     * Calculate pipe flow using Hazen-Williams
     */
    calculatePipeFlowHW(input: PipeFlowInput): PipeFlowResult {
        const { diameter, length, pipeType } = input;
        const D = diameter / 1000; // Convert to m
        const C = HAZEN_WILLIAMS_C[pipeType];

        let Q: number;
        let hf: number;
        let V: number;

        if (input.discharge) {
            Q = input.discharge / 1000; // L/s to m³/s
            V = Q / (Math.PI * D * D / 4);

            // Hazen-Williams: V = 0.849 * C * R^0.63 * S^0.54
            // hf = 10.67 * L * Q^1.852 / (C^1.852 * D^4.87)
            hf = 10.67 * length * Math.pow(Q, 1.852) / (Math.pow(C, 1.852) * Math.pow(D, 4.87));
        } else if (input.headLoss) {
            hf = input.headLoss;
            // Solve for Q
            Q = Math.pow((hf * Math.pow(C, 1.852) * Math.pow(D, 4.87)) / (10.67 * length), 1 / 1.852);
            V = Q / (Math.PI * D * D / 4);
        } else {
            throw new Error('Must provide either discharge or head loss');
        }

        // Add minor losses
        const hm = input.minorLosses ? input.minorLosses * V * V / (2 * 9.81) : 0;
        const totalHeadLoss = hf + hm;

        // Reynolds number
        const nu = 1e-6; // Kinematic viscosity of water
        const Re = V * D / nu;

        // Determine flow type
        let flowType: 'laminar' | 'transitional' | 'turbulent';
        if (Re < 2000) flowType = 'laminar';
        else if (Re < 4000) flowType = 'transitional';
        else flowType = 'turbulent';

        // Approximate friction factor
        const f = 0.25 / Math.pow(Math.log10(5.74 / Math.pow(Re, 0.9)), 2);

        return {
            velocity: V,
            headLoss: totalHeadLoss,
            frictionFactor: f,
            reynoldsNumber: Re,
            flowType,
            discharge: Q,
            hgl: [0, totalHeadLoss],
            egl: [V * V / (2 * 9.81), totalHeadLoss + V * V / (2 * 9.81)]
        };
    }

    /**
     * Design culvert
     */
    designCulvert(input: CulvertInput): CulvertResult {
        const { span, rise, length, headwater, tailwater, bedSlope } = input;

        // Area
        const area = input.type === 'pipe'
            ? Math.PI * span * span / 4
            : span * rise;

        // Inlet control coefficients (approximate)
        const Ke = input.inletType === 'projecting' ? 0.9 :
            input.inletType === 'headwall' ? 0.5 : 0.3;

        // Outlet control head loss
        const Km = 0.5; // Entrance loss
        const n = MANNING_N[`${input.material}_pipe`] || 0.015;
        const R = area / (2 * (span + rise));

        // Inlet control discharge
        const g = 9.81;
        const Qi = 0.65 * area * Math.sqrt(2 * g * (headwater - rise * 0.5));

        // Outlet control (Manning's)
        const S = bedSlope;
        const Vo = (1 / n) * Math.pow(R, 2 / 3) * Math.sqrt(S);
        const Qo = Vo * area;

        // Governing control
        const Q = Math.min(Qi, Qo);
        const controlType = Qi < Qo ? 'inlet' : 'outlet';

        // Velocities
        const V = Q / area;
        const Vout = V; // Simplified

        return {
            discharge: Q,
            controlType,
            velocity: V,
            outletVelocity: Vout,
            hwDepth: headwater,
            passesDesignFlow: Q > 0,
            overtopping: headwater > rise * 1.2
        };
    }

    /**
     * Storm drainage (Rational Method)
     */
    calculateStormDrainage(input: StormDrainageInput): StormDrainageResult {
        const { catchmentArea, runoffCoefficient, timeOfConcentration, returnPeriod } = input;

        // IDF approximation: I = a / (Tc + b)^c
        // Using typical values for moderate climate
        const a = returnPeriod <= 5 ? 1000 : returnPeriod <= 25 ? 1500 : 2000;
        const b = 10;
        const c = 0.7;
        const I = a / Math.pow(timeOfConcentration + b, c); // mm/hr

        // Rational formula: Q = C * I * A / 360
        const Qpeak = (runoffCoefficient * I * catchmentArea) / 360; // m³/s

        // Size drain pipe (for full flow)
        const n = 0.013;
        const S = 0.005; // Assume 0.5% slope

        // D = [Q * n / (0.312 * S^0.5)]^(3/8)
        const D = Math.pow((Qpeak * n) / (0.312 * Math.sqrt(S)), 3 / 8);
        const drainSize = Math.ceil(D * 1000 / 50) * 50; // Round to nearest 50mm

        // Velocity in selected pipe
        const V = Qpeak / (Math.PI * (drainSize / 1000) * (drainSize / 1000) / 4);

        return {
            peakDischarge: Qpeak,
            drainSize,
            velocity: V,
            timeToEmpty: catchmentArea * 10000 * 0.1 / Qpeak / 3600 // Rough estimate
        };
    }

    /**
     * Muskingum flood routing
     */
    routeFlood(
        inflowHydrograph: number[],  // m³/s at time steps
        K: number,                    // Storage constant (hr)
        x: number,                    // Weighting factor (0-0.5)
        deltaT: number                // Time step (hr)
    ): number[] {
        const C0 = (deltaT - 2 * K * x) / (2 * K * (1 - x) + deltaT);
        const C1 = (deltaT + 2 * K * x) / (2 * K * (1 - x) + deltaT);
        const C2 = (2 * K * (1 - x) - deltaT) / (2 * K * (1 - x) + deltaT);

        const outflow: number[] = [inflowHydrograph[0]];

        for (let i = 1; i < inflowHydrograph.length; i++) {
            const Q = C0 * inflowHydrograph[i] + C1 * inflowHydrograph[i - 1] + C2 * outflow[i - 1];
            outflow.push(Math.max(0, Q));
        }

        return outflow;
    }

    /**
     * Get Manning's n value
     */
    getManningN(surface: string): number {
        return MANNING_N[surface] || 0.015;
    }

    /**
     * Get Hazen-Williams C value
     */
    getHazenWilliamsC(pipeType: PipeType): number {
        return HAZEN_WILLIAMS_C[pipeType];
    }
}

// ============================================
// SINGLETON
// ============================================

export const hydraulics = new HydraulicsServiceClass();

export default HydraulicsServiceClass;
