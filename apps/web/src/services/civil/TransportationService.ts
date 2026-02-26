/**
 * TransportationService.ts
 * 
 * Complete Transportation Engineering Module
 * 
 * Features:
 * - Highway geometric design
 * - Pavement design (flexible & rigid)
 * - Traffic analysis
 * - Intersection design
 * - Drainage design
 */

// ============================================
// TYPES
// ============================================

export type RoadClass = 'expressway' | 'national_highway' | 'state_highway' | 'major_district' | 'other_district' | 'village';
export type TerrainType = 'plain' | 'rolling' | 'hilly' | 'steep';
export type PavementType = 'flexible' | 'rigid';

export interface DesignSpeed {
    roadClass: RoadClass;
    terrain: TerrainType;
    speed: number;  // km/h
}

export interface HorizontalCurve {
    radius: number;           // m
    designSpeed: number;      // km/h
    superelevation: number;   // % (max 7%)
    sightDistance: number;    // m
    transitionLength: number; // m (spiral)
    widenedWidth?: number;    // m
}

export interface VerticalCurve {
    type: 'crest' | 'sag';
    G1: number;               // Grade 1 (%)
    G2: number;               // Grade 2 (%)
    A: number;                // Algebraic difference
    L: number;                // Curve length (m)
    K: number;                // Rate of vertical curvature
    sightDistance: number;    // m
}

export interface CrossSection {
    carriageway: number;      // m
    shoulders: number;        // m each side
    median?: number;          // m
    camber: number;           // %
    slope: number;            // side slope ratio (1:n)
}

export interface PavementDesign {
    type: PavementType;
    totalThickness: number;   // mm
    layers: PavementLayer[];
    designLife: number;       // years
    trafficMSA: number;       // million standard axles
}

export interface PavementLayer {
    name: string;
    material: string;
    thickness: number;        // mm
    CBR?: number;
    modulus?: number;         // MPa
}

export interface TrafficData {
    ADT: number;              // Average Daily Traffic
    AADT: number;             // Annual Average Daily Traffic
    peakHourFactor: number;
    growthRate: number;       // %
    truckPercentage: number;  // %
    designPeriod: number;     // years
}

export interface LevelOfService {
    los: 'A' | 'B' | 'C' | 'D' | 'E' | 'F';
    vOverC: number;           // Volume to capacity ratio
    density: number;          // pc/km/lane
    speed: number;            // km/h
    description: string;
}

export interface IntersectionAnalysis {
    type: 'signalized' | 'unsignalized' | 'roundabout';
    capacity: number;         // veh/hr
    delay: number;            // sec/veh
    queueLength: number;      // m
    los: LevelOfService['los'];
    cycleTime?: number;       // sec
}

// ============================================
// DESIGN SPEED TABLE
// ============================================

const DESIGN_SPEEDS: Record<RoadClass, Record<TerrainType, number>> = {
    'expressway': { 'plain': 120, 'rolling': 100, 'hilly': 80, 'steep': 60 },
    'national_highway': { 'plain': 100, 'rolling': 80, 'hilly': 50, 'steep': 40 },
    'state_highway': { 'plain': 80, 'rolling': 65, 'hilly': 40, 'steep': 30 },
    'major_district': { 'plain': 65, 'rolling': 50, 'hilly': 30, 'steep': 25 },
    'other_district': { 'plain': 50, 'rolling': 40, 'hilly': 25, 'steep': 20 },
    'village': { 'plain': 40, 'rolling': 35, 'hilly': 25, 'steep': 20 }
};

// ============================================
// TRANSPORTATION SERVICE
// ============================================

class TransportationServiceClass {
    /**
     * Get design speed for road class and terrain
     */
    getDesignSpeed(roadClass: RoadClass, terrain: TerrainType): number {
        return DESIGN_SPEEDS[roadClass][terrain];
    }

    /**
     * Design horizontal curve
     */
    designHorizontalCurve(
        designSpeed: number,   // km/h
        deflectionAngle: number, // degrees
        maxSuper: number = 7   // %
    ): HorizontalCurve {
        const V = designSpeed;

        // Minimum radius based on e_max and f (friction)
        const f = 0.15; // Side friction factor
        const e = maxSuper / 100;
        const Rmin = V * V / (127 * (e + f));

        // Use larger radius for comfort
        const R = Math.max(Rmin * 1.2, this.getMinRadius(V));

        // Superelevation for chosen radius
        const superE = ((V * V) / (127 * R)) - f;
        const actualSuper = Math.max(2, Math.min(maxSuper, superE * 100));

        // Transition length
        const pavement = this.getStandardWidth(V);
        const Ls = 0.0215 * V * V * V / (R * actualSuper);

        // Sight distance
        const SSD = this.calculateSSD(V);

        // Extra widening on curves
        const n = 2; // Number of lanes
        const L_vehicle = 6.1; // Design vehicle length (m)
        const We = (n * L_vehicle * L_vehicle) / (2 * R) + 0.1 * V / Math.sqrt(R);

        return {
            radius: Math.round(R),
            designSpeed: V,
            superelevation: Math.round(actualSuper * 10) / 10,
            sightDistance: Math.round(SSD),
            transitionLength: Math.round(Ls),
            widenedWidth: Math.round(We * 100) / 100
        };
    }

    /**
     * Get minimum radius for speed
     */
    private getMinRadius(V: number): number {
        if (V <= 30) return 15;
        if (V <= 40) return 30;
        if (V <= 50) return 50;
        if (V <= 65) return 90;
        if (V <= 80) return 150;
        if (V <= 100) return 260;
        return 450;
    }

    /**
     * Get standard pavement width
     */
    private getStandardWidth(V: number): number {
        if (V <= 50) return 3.5 * 2;
        if (V <= 80) return 3.5 * 2;
        return 3.75 * 2;
    }

    /**
     * Calculate Stopping Sight Distance (SSD)
     */
    calculateSSD(V: number, grade: number = 0): number {
        const t = 2.5; // Perception-reaction time (sec)
        const g = 9.81;
        const f = 0.35; // Longitudinal friction

        // Brake reaction distance
        const d1 = V * t / 3.6;

        // Braking distance
        const d2 = (V * V) / (254 * (f + grade / 100));

        return d1 + d2;
    }

    /**
     * Calculate Overtaking Sight Distance (OSD)
     */
    calculateOSD(V: number): number {
        // IRC formula
        const t = 2; // Reaction time
        const a = 0.99 + 0.0067 * V; // Acceleration (m/s²)
        const S = 0.2 * V + 6; // Spacing (m)

        const d1 = 0.278 * V * t; // Preliminary
        const d2 = 0.278 * t * (V - 16) + (2 * S / a); // Overtaking
        const d3 = S; // Safety margin
        const d4 = 0.278 * (V + 16) * 2 * t; // Opposite vehicle

        return d1 + d2 + d3 + d4;
    }

    /**
     * Design vertical curve
     */
    designVerticalCurve(
        type: 'crest' | 'sag',
        G1: number,            // %
        G2: number,            // %
        designSpeed: number
    ): VerticalCurve {
        const A = Math.abs(G1 - G2); // Algebraic difference
        const S = type === 'crest' ? this.calculateSSD(designSpeed) : this.calculateSSD(designSpeed);

        let L: number;

        if (type === 'crest') {
            // For SSD
            const h1 = 1.2; // Driver eye height (m)
            const h2 = 0.15; // Object height (m)
            const term = Math.pow(Math.sqrt(h1) + Math.sqrt(h2), 2);

            // L > S (general case)
            L = (A * S * S) / (200 * term);

            if (L < S) {
                // L < S
                L = 2 * S - (200 * term) / A;
            }
        } else {
            // Sag curve - headlight sight distance
            const h = 0.75; // Headlight height (m)
            const alpha = 1; // Beam angle (degrees)

            L = (A * S * S) / (200 * (h + S * Math.tan(alpha * Math.PI / 180)));

            if (L < S) {
                L = 2 * S - (200 * (h + S * Math.tan(alpha * Math.PI / 180))) / A;
            }
        }

        const K = L / A;

        return {
            type,
            G1,
            G2,
            A,
            L: Math.ceil(L / 10) * 10, // Round up to nearest 10m
            K: Math.round(K * 10) / 10,
            sightDistance: S
        };
    }

    /**
     * Design pavement (IRC method)
     */
    designPavement(
        traffic: TrafficData,
        subgradeCBR: number,
        pavementType: PavementType = 'flexible'
    ): PavementDesign {
        // Calculate design traffic in MSA
        const A = traffic.AADT;
        const r = traffic.growthRate / 100;
        const n = traffic.designPeriod;
        const VDF = 4.0; // Vehicle damage factor for standard traffic
        const LDF = 0.75; // Lane distribution factor
        const cumulative = ((Math.pow(1 + r, n) - 1) / r) * 365 * A * VDF * LDF * (traffic.truckPercentage / 100);
        const MSA = cumulative / 1e6;

        if (pavementType === 'flexible') {
            return this.designFlexiblePavement(MSA, subgradeCBR, traffic.designPeriod);
        } else {
            return this.designRigidPavement(MSA, subgradeCBR, traffic.designPeriod);
        }
    }

    /**
     * Design flexible pavement (IRC 37)
     */
    private designFlexiblePavement(MSA: number, CBR: number, designLife: number): PavementDesign {
        // Effective modulus of subgrade
        const MR_subgrade = 10 * CBR; // MPa (approximate)

        const layers: PavementLayer[] = [];
        let totalThickness = 0;

        // Granular sub-base (GSB)
        const t_gsb = Math.max(150, 200 + 10 * (10 - CBR));
        layers.push({ name: 'Granular Sub-base', material: 'Aggregate', thickness: t_gsb, CBR: 30 });
        totalThickness += t_gsb;

        // Granular base (WMM or WBM)
        const t_base = MSA < 5 ? 200 : MSA < 20 ? 250 : 300;
        layers.push({ name: 'Granular Base (WMM)', material: 'Wet Mix Macadam', thickness: t_base, modulus: 450 });
        totalThickness += t_base;

        // Bituminous base (DBM)
        const t_dbm = MSA < 5 ? 0 : MSA < 20 ? 50 : MSA < 50 ? 75 : 100;
        if (t_dbm > 0) {
            layers.push({ name: 'Dense Bituminous Macadam', material: 'DBM', thickness: t_dbm, modulus: 1700 });
            totalThickness += t_dbm;
        }

        // Binder course (BC)
        const t_bc = MSA < 5 ? 30 : MSA < 20 ? 50 : 50;
        layers.push({ name: 'Bituminous Concrete (BC)', material: 'BC', thickness: t_bc, modulus: 2000 });
        totalThickness += t_bc;

        // Wearing course
        const t_surf = 40;
        layers.push({ name: 'Surface Course', material: 'BC/SMA', thickness: t_surf, modulus: 3000 });
        totalThickness += t_surf;

        return {
            type: 'flexible',
            totalThickness,
            layers: layers.reverse(),
            designLife,
            trafficMSA: MSA
        };
    }

    /**
     * Design rigid pavement (IRC 58)
     */
    private designRigidPavement(MSA: number, CBR: number, designLife: number): PavementDesign {
        // Modulus of subgrade reaction
        const k = 2.55 + 52.5 * Math.log10(CBR); // MPa/m

        // Concrete slab thickness (based on IRC 58 charts)
        let slabThickness: number;
        if (MSA < 50) slabThickness = 200;
        else if (MSA < 150) slabThickness = 250;
        else if (MSA < 450) slabThickness = 300;
        else slabThickness = 350;

        const layers: PavementLayer[] = [
            { name: 'CC Slab', material: 'PQC (M40)', thickness: slabThickness, modulus: 30000 },
            { name: 'DLC Base', material: 'Dry Lean Concrete', thickness: 150, modulus: 10000 },
            { name: 'Granular Sub-base', material: 'GSB', thickness: 150, CBR: 30 }
        ];

        return {
            type: 'rigid',
            totalThickness: slabThickness + 300,
            layers,
            designLife,
            trafficMSA: MSA
        };
    }

    /**
     * Calculate Level of Service (HCM 2010)
     */
    calculateLOS(
        volume: number,        // veh/hr
        capacity: number,      // veh/hr
        freeFlowSpeed: number  // km/h
    ): LevelOfService {
        const vC = volume / capacity;
        const density = volume / (freeFlowSpeed * 0.9); // Approximate

        let los: LevelOfService['los'];
        let description: string;

        if (vC <= 0.3) {
            los = 'A';
            description = 'Free flow, minimal delays';
        } else if (vC <= 0.5) {
            los = 'B';
            description = 'Stable flow, slight delays';
        } else if (vC <= 0.7) {
            los = 'C';
            description = 'Stable flow, acceptable delays';
        } else if (vC <= 0.85) {
            los = 'D';
            description = 'Approaching unstable flow';
        } else if (vC <= 1.0) {
            los = 'E';
            description = 'Unstable flow, near capacity';
        } else {
            los = 'F';
            description = 'Forced flow, breakdown';
        }

        return {
            los,
            vOverC: vC,
            density,
            speed: freeFlowSpeed * (1 - 0.5 * vC),
            description
        };
    }

    /**
     * Analyze signalized intersection
     */
    analyzeSignalizedIntersection(
        approaches: Array<{ volume: number; lanes: number; greenTime: number }>,
        cycleTime: number
    ): IntersectionAnalysis {
        let totalDelay = 0;
        let totalVolume = 0;
        let totalCapacity = 0;

        for (const approach of approaches) {
            const satFlow = 1800 * approach.lanes; // veh/hr/lane
            const gC = approach.greenTime / cycleTime;
            const capacity = satFlow * gC;
            const x = approach.volume / capacity; // Degree of saturation

            // Webster's delay formula
            const d1 = (cycleTime * (1 - gC) ** 2) / (2 * (1 - Math.min(gC * x, 0.99)));
            const d2 = x ** 2 / (2 * approach.volume * (1 - x));
            const delay = d1 + d2;

            totalDelay += delay * approach.volume;
            totalVolume += approach.volume;
            totalCapacity += capacity;
        }

        const avgDelay = totalDelay / totalVolume;
        const los = this.getIntersectionLOS(avgDelay);

        return {
            type: 'signalized',
            capacity: totalCapacity,
            delay: avgDelay,
            queueLength: avgDelay * 0.5, // Rough estimate
            los,
            cycleTime
        };
    }

    /**
     * Get intersection LOS from delay
     */
    private getIntersectionLOS(delay: number): LevelOfService['los'] {
        if (delay <= 10) return 'A';
        if (delay <= 20) return 'B';
        if (delay <= 35) return 'C';
        if (delay <= 55) return 'D';
        if (delay <= 80) return 'E';
        return 'F';
    }
}

// ============================================
// SINGLETON
// ============================================

export const transportation = new TransportationServiceClass();

export default TransportationServiceClass;
