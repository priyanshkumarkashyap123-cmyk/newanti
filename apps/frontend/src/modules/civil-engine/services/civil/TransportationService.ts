
export type RoadClass = 'expressway' | 'national_highway' | 'state_highway' | 'major_district' | 'other_district' | 'village';
export type TerrainType = 'plain' | 'rolling' | 'hilly' | 'steep';
export type PavementType = 'flexible' | 'rigid';

export const transportation = {
    getDesignSpeed: (roadClass: RoadClass, terrain: TerrainType): number => {
        // IRC: 73-1980 Geometric Design Standards for Rural (Non-Urban) Highways
        const speeds: Record<RoadClass, Record<TerrainType, number>> = {
            expressway: { plain: 120, rolling: 100, hilly: 80, steep: 80 },
            national_highway: { plain: 100, rolling: 80, hilly: 50, steep: 40 },
            state_highway: { plain: 80, rolling: 65, hilly: 40, steep: 30 },
            major_district: { plain: 65, rolling: 50, hilly: 30, steep: 20 },
            other_district: { plain: 50, rolling: 40, hilly: 25, steep: 20 },
            village: { plain: 40, rolling: 30, hilly: 20, steep: 20 }
        };
        return speeds[roadClass][terrain];
    },

    designHorizontalCurve: (speed: number, deflectionAngle: number) => {
        // IRC: 38-1988 Design of Horizontal Curves
        const e_max = 0.07; // Maximum superelevation (plain/rolling)
        const f_max = 0.15; // Maximum side friction coeff
        const g = 9.81;

        // V in kmph needs conversion to m/s for some formulas, but IRC uses V in kmph directly for R_min
        // R_ruling = V^2 / (127 * (e + f))
        const radius = Math.ceil((speed * speed) / (127 * (e_max + f_max)));

        // Superelevation design
        // e = V^2/225R
        let superelevation: number | undefined = (speed * speed) / (225 * radius);
        if (superelevation > e_max) superelevation = e_max;
        if (superelevation < 0.025) superelevation = undefined; // Camber usually 2.5%

        // Transition length Ls = 0.0215 * V^3 / (C * R) for plain/rolling
        // C = 80/(75+V)
        const C = 80 / (75 + speed);
        const transitionLength = Math.ceil((0.0215 * Math.pow(speed, 3)) / (C * radius));

        // Stopping Sight Distance (SSD) = vt + v^2/2gf
        // t = 2.5s, f = 0.35
        const v_ms = speed / 3.6;
        const f_long = 0.35; // longitudinal friction
        const sightDistance = Math.ceil((v_ms * 2.5) + (v_ms * v_ms) / (2 * 9.81 * f_long));

        // Extra widening (We) = n*l^2/2R + V/9.5*sqrt(R)
        // Assume n=2 lanes, l=6m wheel base
        const widenedWidth = parseFloat(((2 * 36) / (2 * radius) + speed / (9.5 * Math.sqrt(radius))).toFixed(2));

        return {
            radius,
            superelevation: superelevation ? parseFloat((superelevation * 100).toFixed(2)) : 2.5, // Return as percentage
            transitionLength,
            sightDistance,
            widenedWidth
        };
    },

    designVerticalCurve: (type: 'crest' | 'sag', g1: number, g2: number, speed: number) => {
        // IRC: SP 23
        const N = Math.abs(g1 - g2) / 100; // Algebraic difference in grade
        const A = Math.abs(g1 - g2);

        // SSD calculation
        const v_ms = speed / 3.6;
        const f_long = 0.35;
        const S = (v_ms * 2.5) + (v_ms * v_ms) / (2 * 9.81 * f_long); // Sight distance

        let length = 0;
        let K = 0;

        if (type === 'crest') {
            // L = N*S^2 / 4.4 if S < L
            // L = 2S - 4.4/N if S > L
            // Using K values from AASHTO/IRC simplified table approx
            // K values for SSD
            const k_values: Record<number, number> = { 100: 52, 80: 26, 65: 12, 50: 6, 40: 4 };
            const speed_key = Object.keys(k_values).map(Number).reduce((prev, curr) => Math.abs(curr - speed) < Math.abs(prev - speed) ? curr : prev);
            K = k_values[speed_key] || 50;
            length = K * A;
        } else {
            // Sag curve
            // L = N*S^2 / (1.5 + 0.035*S) approx for headlight distance
            // Simplified K values
            const k_values: Record<number, number> = { 100: 45, 80: 30, 65: 20, 50: 13, 40: 9 };
            const speed_key = Object.keys(k_values).map(Number).reduce((prev, curr) => Math.abs(curr - speed) < Math.abs(prev - speed) ? curr : prev);
            K = k_values[speed_key] || 40;
            length = K * A;
        }

        return {
            type,
            L: Math.ceil(Math.max(length, 30)), // Minimum 30m
            K,
            A,
            sightDistance: S
        };
    },

    designPavement: (
        traffic: { ADT?: number, AADT: number, peakHourFactor?: number, growthRate: number, truckPercentage: number, designPeriod: number },
        cbr: number,
        type: PavementType
    ) => {
        // IRC: 37-2018 for Flexible
        // N = 365 * A * [(1+r)^n - 1] / r * VDF * LDF
        // MSA calculation
        const r = traffic.growthRate / 100;
        const n = traffic.designPeriod;
        const A = traffic.AADT * 1; // Initial traffic
        // Assume VDF = 3.5 for heavy, LDF = 0.75 for 2 lane
        const VDF = 3.5;
        const LDF = 0.75;
        // Commercial vehicles/day = AADT * truck%
        const CVPD = traffic.AADT * (traffic.truckPercentage / 100);

        const N_cumulative = (365 * ((Math.pow(1 + r, n) - 1) / r) * CVPD * VDF * LDF) / 1000000;

        const trafficMSA = N_cumulative;

        // Thickness Design (Simplified IRC 37 Lookup)
        let layers: { name: string, thickness: number, material: string }[] = [];
        let totalThickness = 0;

        if (type === 'flexible') {
            // Based on MSA and CBR
            if (cbr <= 5) {
                // Heavier section
                layers = [
                    { name: 'Bituminous Concrete (BC)', thickness: 40, material: 'BC (VG-30)' },
                    { name: 'Dense Bituminous Macadam (DBM)', thickness: 75, material: 'DBM Grade II' },
                    { name: 'Wet Mix Macadam (WMM) Base', thickness: 250, material: 'WMM' },
                    { name: 'Granular Sub-base (GSB)', thickness: 200, material: 'GSB Grade I' }
                ];
            } else {
                // Lighter section
                layers = [
                    { name: 'Bituminous Concrete (BC)', thickness: 30, material: 'BC (VG-30)' },
                    { name: 'Dense Bituminous Macadam (DBM)', thickness: 50, material: 'DBM Grade II' },
                    { name: 'Wet Mix Macadam (WMM) Base', thickness: 250, material: 'WMM' },
                    { name: 'Granular Sub-base (GSB)', thickness: 150, material: 'GSB Grade I' }
                ];
            }
            // Scale based on Traffic MSA (Simple linear scaling for demo)
            const scale = Math.min(Math.max(trafficMSA / 10, 0.8), 2.0); // 10 MSA as baseline
            layers = layers.map(l => ({ ...l, thickness: Math.ceil(l.thickness * (l.name.includes('Bituminous') ? scale : 1)) }));

        } else {
            // Rigid Pavement (IRC 58)
            // PQC + DLC + GSB
            const pqcThickness = Math.max(200, 250 + (trafficMSA - 20) * 2);
            layers = [
                { name: 'Pavement Quality Concrete (PQC)', thickness: Math.min(pqcThickness, 350), material: 'M40 Concrete' },
                { name: 'Dry Lean Concrete (DLC)', thickness: 150, material: 'M10 Concrete' },
                { name: 'Granular Sub-base (GSB)', thickness: 150, material: 'GSB Drainage Layer' }
            ];
        }

        totalThickness = layers.reduce((sum, l) => sum + l.thickness, 0);

        return {
            trafficMSA,
            totalThickness,
            layers
        };
    },

    analyzeSignalizedIntersection: (
        approaches: { volume: number, lanes: number, greenTime: number }[],
        cycleTime: number
    ) => {
        // Webster's Method / HCM Simplified
        let totalCapacity = 0;
        let totalDelay = 0;
        let totalVolume = 0;
        let maxQueue = 0;

        const saturationFlowPerLane = 1800; // pcu/hr/lane

        approaches.forEach((app, i) => {
            const saturationFlow = app.lanes * saturationFlowPerLane;
            const capacity = saturationFlow * (app.greenTime / cycleTime);
            totalCapacity += capacity;

            const v_c_ratio = app.volume / capacity;

            // Delay d = 0.5*C*(1-g/C)^2 / (1 - (g/C)*min(X, 1.0))
            const g_C = app.greenTime / cycleTime;
            const X = v_c_ratio;
            const term1 = (0.5 * cycleTime * Math.pow(1 - g_C, 2)) / (1 - Math.min(X, 1.0) * g_C);
            const term2 = 900 * 0.25 * Math.pow(X - 1 + Math.sqrt(Math.pow(X - 1, 2) + 4 * X / (capacity * 0.25)), 1); // Random incremental delay approx

            // Simple Webster approximation
            const d = (cycleTime * Math.pow(1 - g_C, 2)) / (2 * (1 - g_C * X));
            const safeD = Math.min(isNaN(d) || d < 0 ? 100 : d, 120);

            totalDelay += safeD * app.volume;
            totalVolume += app.volume;

            // Queue approx Q = v * d
            const q = (app.volume / 3600) * d; // vehicles approximated
            const qLen = q * 6; // 6m per vehicle
            if (qLen > maxQueue) maxQueue = qLen;
        });

        const avgDelay = totalVolume > 0 ? totalDelay / totalVolume : 0;

        // Level of Service (HCM 2000 for Signalized Intersections)
        let los = 'F';
        if (avgDelay <= 10) los = 'A';
        else if (avgDelay <= 20) los = 'B';
        else if (avgDelay <= 35) los = 'C';
        else if (avgDelay <= 55) los = 'D';
        else if (avgDelay <= 80) los = 'E';

        return {
            los,
            delay: avgDelay,
            capacity: totalCapacity,
            queueLength: maxQueue
        };
    }
};
