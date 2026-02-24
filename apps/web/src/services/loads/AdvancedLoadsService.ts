/**
 * AdvancedLoadsService.ts
 * 
 * Additional Load Types per Critical Audit
 * 
 * Features:
 * - Temperature loads (thermal strain)
 * - Support settlement
 * - Notional loads (imperfection)
 * - Initial strain / lack-of-fit
 * - Prestress loads
 */

// ============================================
// TYPES
// ============================================

export interface TemperatureLoad {
    id: string;
    elementId: string;
    deltaT: number;          // Temperature change (°C or °F)
    gradient?: number;       // Gradient across section (°C/m)
    coefficient: number;     // Thermal expansion coefficient (per °C)
    referenceTemp: number;   // Reference temperature
}

export interface SupportSettlement {
    id: string;
    nodeId: string;
    dx: number;              // Settlement in X (m)
    dy: number;              // Settlement in Y (m)
    dz: number;              // Settlement in Z (m)
    rx?: number;             // Rotation about X (rad)
    ry?: number;             // Rotation about Y (rad)
    rz?: number;             // Rotation about Z (rad)
}

export interface NotionalLoad {
    id: string;
    type: 'sway' | 'bow' | 'combined';
    direction: 'X' | 'Y';
    level?: number;
    nodes: string[];
    magnitude: number;       // As fraction of gravity load (0.002-0.005 typical)
}

export interface InitialStrain {
    id: string;
    elementId: string;
    strain: number;          // Initial strain (dimensionless)
    type: 'lack_of_fit' | 'fabrication_error' | 'shrinkage';
}

export interface PrestressLoad {
    id: string;
    elementId: string;
    force: number;           // Prestress force (kN)
    eccentricity?: {
        start: { ey: number; ez: number };
        end: { ey: number; ez: number };
    };
    losses?: number;         // Percentage losses
}

export interface ThermalAnalysisResult {
    elementId: string;
    axialForce: number;
    thermalStrain: number;
    thermalStress: number;
}

// ============================================
// MATERIAL THERMAL PROPERTIES
// ============================================

const THERMAL_COEFFICIENTS: Record<string, number> = {
    'steel': 12e-6,      // per °C
    'concrete': 10e-6,
    'aluminum': 23e-6,
    'wood': 5e-6,
    'stainless': 16e-6
};

// ============================================
// ADVANCED LOADS SERVICE
// ============================================

class AdvancedLoadsServiceClass {
    /**
     * Calculate thermal forces in a restrained member
     */
    calculateThermalForce(
        load: TemperatureLoad,
        memberProps: { E: number; A: number; L: number; material: string }
    ): ThermalAnalysisResult {
        const { E, A, L, material } = memberProps;
        const alpha = load.coefficient || THERMAL_COEFFICIENTS[material.toLowerCase()] || 12e-6;

        // Free thermal strain
        const thermalStrain = alpha * load.deltaT;

        // For fully restrained member, thermal stress = E * alpha * deltaT
        const thermalStress = E * thermalStrain;

        // Axial force = stress * area (compression if heating)
        const axialForce = thermalStress * A * (load.deltaT > 0 ? -1 : 1);

        return {
            elementId: load.elementId,
            axialForce,
            thermalStrain,
            thermalStress
        };
    }

    /**
     * Generate equivalent nodal forces for temperature load
     */
    getTemperatureLoadVector(
        load: TemperatureLoad,
        member: { E: number; A: number; L: number; I: number }
    ): { F: number; M_start?: number; M_end?: number } {
        const { E, A, L, I } = member;
        const alpha = load.coefficient;

        // Axial force from uniform temperature
        const F = E * A * alpha * load.deltaT;

        // Moment from temperature gradient
        let M_start = 0;
        let M_end = 0;

        if (load.gradient && load.gradient !== 0) {
            // M = E * I * alpha * gradient / d (where d is section depth)
            // Simplified - would need section depth
            M_start = E * I * alpha * load.gradient * 10; // Approximate
            M_end = -M_start;
        }

        return { F, M_start, M_end };
    }

    /**
     * Calculate notional loads per code
     */
    calculateNotionalLoads(
        gravityLoads: Array<{ nodeId: string; Fy: number }>,
        code: 'AISC' | 'IS800' | 'EC3' = 'AISC',
        numStories?: number
    ): NotionalLoad[] {
        const notionalLoads: NotionalLoad[] = [];

        // Get notional load factor based on code
        let factor: number;
        switch (code) {
            case 'AISC':
                factor = 0.002; // AISC 360 C2.2b
                break;
            case 'IS800':
                factor = 0.002; // IS 800 Cl 7.3
                break;
            case 'EC3':
                // EC3: phi = 1/(200 * sqrt(h)) but min 1/200, max 1/100
                const h = numStories || 1;
                factor = Math.min(0.01, Math.max(0.005, 1 / (200 * Math.sqrt(h))));
                break;
            default:
                factor = 0.002;
        }

        // Calculate total gravity at each level
        const levelMap = new Map<number, { nodes: string[]; totalFy: number }>();

        for (const load of gravityLoads) {
            // Group by approximate Y coordinate (level)
            const level = Math.round(load.Fy / 100); // Simplified grouping

            if (!levelMap.has(level)) {
                levelMap.set(level, { nodes: [], totalFy: 0 });
            }

            const levelData = levelMap.get(level)!;
            levelData.nodes.push(load.nodeId);
            levelData.totalFy += Math.abs(load.Fy);
        }

        // Create notional loads for each direction
        for (const [level, data] of levelMap) {
            const notionalMagnitude = data.totalFy * factor;

            // X-direction
            notionalLoads.push({
                id: `notional_X_L${level}`,
                type: 'sway',
                direction: 'X',
                level,
                nodes: data.nodes,
                magnitude: notionalMagnitude
            });

            // Y-direction (perpendicular)
            notionalLoads.push({
                id: `notional_Y_L${level}`,
                type: 'sway',
                direction: 'Y',
                level,
                nodes: data.nodes,
                magnitude: notionalMagnitude
            });
        }

        return notionalLoads;
    }

    /**
     * Convert support settlement to equivalent forces
     */
    settlementToForces(
        settlement: SupportSettlement,
        stiffness: { kx: number; ky: number; kz: number; krx?: number; kry?: number; krz?: number }
    ): { Fx: number; Fy: number; Fz: number; Mx?: number; My?: number; Mz?: number } {
        return {
            Fx: stiffness.kx * settlement.dx,
            Fy: stiffness.ky * settlement.dy,
            Fz: stiffness.kz * settlement.dz,
            Mx: (stiffness.krx || 0) * (settlement.rx || 0),
            My: (stiffness.kry || 0) * (settlement.ry || 0),
            Mz: (stiffness.krz || 0) * (settlement.rz || 0)
        };
    }

    /**
     * Calculate prestress effects
     */
    calculatePrestressEffects(
        prestress: PrestressLoad,
        memberProps: { L: number; E: number; I: number }
    ): { P: number; M_end_i: number; M_end_j: number; deformation: number } {
        const { L, E, I } = memberProps;
        const P = prestress.force * (1 - (prestress.losses || 0) / 100);

        let M_end_i = 0;
        let M_end_j = 0;

        if (prestress.eccentricity) {
            // Primary moments from eccentricity
            M_end_i = P * prestress.eccentricity.start.ey;
            M_end_j = P * prestress.eccentricity.end.ey;
        }

        // Shortening due to prestress
        const deformation = (P * L) / (E * memberProps.L); // Simplified

        return { P, M_end_i, M_end_j, deformation };
    }

    /**
     * Generate initial strain load vector
     */
    getInitialStrainForces(
        strain: InitialStrain,
        member: { E: number; A: number; L: number }
    ): { axialForce: number } {
        const { E, A, L } = member;

        // Initial strain causes equivalent force
        const axialForce = E * A * strain.strain;

        return { axialForce };
    }

    /**
     * Get thermal coefficient for material
     */
    getThermalCoefficient(material: string): number {
        return THERMAL_COEFFICIENTS[material.toLowerCase()] || 12e-6;
    }

    /**
     * Create temperature load
     */
    createTemperatureLoad(
        elementId: string,
        deltaT: number,
        material: string = 'steel',
        referenceTemp: number = 20
    ): TemperatureLoad {
        return {
            id: `temp_${Date.now()}`,
            elementId,
            deltaT,
            coefficient: this.getThermalCoefficient(material),
            referenceTemp
        };
    }

    /**
     * Create settlement load
     */
    createSettlement(
        nodeId: string,
        settlements: { dx?: number; dy?: number; dz?: number }
    ): SupportSettlement {
        return {
            id: `settle_${Date.now()}`,
            nodeId,
            dx: settlements.dx || 0,
            dy: settlements.dy || 0,
            dz: settlements.dz || 0
        };
    }
}

// ============================================
// SINGLETON
// ============================================

export const advancedLoads = new AdvancedLoadsServiceClass();

export default AdvancedLoadsServiceClass;
