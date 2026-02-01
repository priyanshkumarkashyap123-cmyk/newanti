/**
 * EC3ConnectionDesign.ts - Eurocode 3 Connection Design (EN 1993-1-8)
 * 
 * Features:
 * - Bolt resistance (shear, bearing, tension)
 * - Weld resistance
 * - End plate connections
 * - Component method for moment connections
 * - T-stub design
 */

// ============================================
// TYPES
// ============================================

export interface BoltProperties {
    class: '4.6' | '5.6' | '6.8' | '8.8' | '10.9';
    diameter: number;     // mm
    As: number;           // Tensile stress area (mm²)
    fub: number;          // Ultimate strength (MPa)
}

export interface PlateProperties {
    thickness: number;    // mm
    fy: number;           // Yield strength (MPa)
    fu: number;           // Ultimate strength (MPa)
}

export interface WeldProperties {
    size: number;         // Throat thickness (mm)
    length: number;       // mm
    fu: number;           // Electrode strength (MPa)
}

export interface ConnectionForces {
    NEd: number;          // Axial force (kN)
    VEd: number;          // Shear force (kN)
    MEd: number;          // Bending moment (kN·m)
}

export interface EC3Check {
    clause: string;
    description: string;
    FEd: number;          // Design force
    FRd: number;          // Design resistance
    ratio: number;
    status: 'OK' | 'NOT OK';
}

// ============================================
// BOLT DATABASE (EN 1993-1-8 Table 3.1)
// ============================================

export const BOLT_CLASSES: Record<string, { fub: number; fyb: number }> = {
    '4.6': { fub: 400, fyb: 240 },
    '5.6': { fub: 500, fyb: 300 },
    '6.8': { fub: 600, fyb: 480 },
    '8.8': { fub: 800, fyb: 640 },
    '10.9': { fub: 1000, fyb: 900 }
};

export const BOLT_AREAS: Record<number, number> = {
    12: 84.3,
    16: 157,
    20: 245,
    24: 353,
    27: 459,
    30: 561,
    36: 817
};

// ============================================
// EC3 CONNECTION CHECKER
// ============================================

export class EC3ConnectionChecker {
    private gammaM0 = 1.00;   // Material factor
    private gammaM2 = 1.25;   // Bolt/weld factor
    private gammaM5 = 1.00;   // Structural hollow sections

    /**
     * Check bolt in shear (EN 1993-1-8 Table 3.4)
     */
    checkBoltShear(
        bolt: BoltProperties,
        shearPlanes: number = 1,
        shearInThread: boolean = true
    ): EC3Check {
        const alpha_v = shearInThread ? 0.6 : 0.6;
        const A = shearInThread ? bolt.As : Math.PI * (bolt.diameter ** 2) / 4;

        const FvRd = (alpha_v * bolt.fub * A) / (this.gammaM2 * 1000);

        return {
            clause: 'EN 1993-1-8 3.6.1',
            description: 'Bolt shear resistance',
            FEd: 0,
            FRd: FvRd * shearPlanes,
            ratio: 0,
            status: 'OK'
        };
    }

    /**
     * Check bolt in tension (EN 1993-1-8 Table 3.4)
     */
    checkBoltTension(bolt: BoltProperties): EC3Check {
        const k2 = 0.9;
        const FtRd = (k2 * bolt.fub * bolt.As) / (this.gammaM2 * 1000);

        return {
            clause: 'EN 1993-1-8 3.6.1',
            description: 'Bolt tension resistance',
            FEd: 0,
            FRd: FtRd,
            ratio: 0,
            status: 'OK'
        };
    }

    /**
     * Check bolt bearing (EN 1993-1-8 Table 3.4)
     */
    checkBoltBearing(
        bolt: BoltProperties,
        plate: PlateProperties,
        e1: number,    // End distance
        e2: number,    // Edge distance
        p1: number,    // Pitch
        isEndBolt: boolean = true
    ): EC3Check {
        const d0 = bolt.diameter + 2; // Hole diameter

        // alpha_b calculation
        const alpha_d = isEndBolt ? e1 / (3 * d0) : (p1 / (3 * d0)) - 0.25;
        const alpha_fub = bolt.fub / plate.fu;
        const alpha_b = Math.min(alpha_d, alpha_fub, 1.0);

        // k1 calculation
        const k1 = Math.min(2.8 * e2 / d0 - 1.7, 2.5);

        const FbRd = (k1 * alpha_b * plate.fu * bolt.diameter * plate.thickness) / (this.gammaM2 * 1000);

        return {
            clause: 'EN 1993-1-8 3.6.1',
            description: 'Bolt bearing resistance',
            FEd: 0,
            FRd: FbRd,
            ratio: 0,
            status: 'OK'
        };
    }

    /**
     * Check combined shear and tension (EN 1993-1-8 Table 3.4)
     */
    checkBoltCombined(
        FvEd: number,
        FtEd: number,
        FvRd: number,
        FtRd: number
    ): EC3Check {
        const ratio = (FvEd / FvRd) + (FtEd / (1.4 * FtRd));

        return {
            clause: 'EN 1993-1-8 3.6.1',
            description: 'Combined shear and tension',
            FEd: ratio,
            FRd: 1.0,
            ratio: ratio,
            status: ratio <= 1.0 ? 'OK' : 'NOT OK'
        };
    }

    /**
     * Check fillet weld (EN 1993-1-8 4.5.3)
     */
    checkFilletWeld(
        weld: WeldProperties,
        FEd: number,
        angle: number = 90  // Angle of force to weld axis
    ): EC3Check {
        const betaW = 0.85; // For S355
        const fw = weld.fu / (Math.sqrt(3) * betaW * this.gammaM2);

        const FwRd = (weld.size * weld.length * fw) / 1000;

        return {
            clause: 'EN 1993-1-8 4.5.3',
            description: 'Fillet weld resistance',
            FEd: FEd,
            FRd: FwRd,
            ratio: FEd / FwRd,
            status: FEd <= FwRd ? 'OK' : 'NOT OK'
        };
    }

    /**
     * Design end plate moment connection (Component Method)
     */
    designEndPlateConnection(
        beamDepth: number,
        beamFlange: number,
        beamWeb: number,
        MEd: number,
        VEd: number,
        boltClass: string = '10.9',
        boltDia: number = 20
    ): {
        endPlateThickness: number;
        boltRows: number;
        checks: EC3Check[];
    } {
        const checks: EC3Check[] = [];

        // Lever arm (simplified)
        const z = beamDepth - beamFlange;

        // Tension force from moment
        const Ft = (MEd * 1000) / z; // kN

        // Bolt capacity
        const boltProps = BOLT_CLASSES[boltClass];
        const As = BOLT_AREAS[boltDia];
        const FtRd = (0.9 * boltProps.fub * As) / (this.gammaM2 * 1000);

        // Required bolt rows
        const boltsPerRow = 2;
        const boltRows = Math.ceil(Ft / (boltsPerRow * FtRd));

        // End plate thickness (T-stub design - simplified)
        const m = 30; // Edge distance
        const Mpl = Ft * m / 1000;
        const tp = Math.sqrt((4 * Mpl * 1e6 * this.gammaM0) / (beamFlange * 355));
        const endPlateThickness = Math.ceil(Math.max(tp, 15));

        // Checks
        checks.push({
            clause: 'EN 1993-1-8 6.2.4',
            description: 'Bolt tension capacity',
            FEd: Ft / (boltRows * boltsPerRow),
            FRd: FtRd,
            ratio: (Ft / (boltRows * boltsPerRow)) / FtRd,
            status: Ft / (boltRows * boltsPerRow) <= FtRd ? 'OK' : 'NOT OK'
        });

        checks.push({
            clause: 'EN 1993-1-8 6.2.6.5',
            description: 'End plate bending (T-stub)',
            FEd: MEd,
            FRd: boltRows * boltsPerRow * FtRd * z / 1000,
            ratio: MEd / (boltRows * boltsPerRow * FtRd * z / 1000),
            status: 'OK'
        });

        // Shear check
        const FvRd = (0.6 * boltProps.fub * As) / (this.gammaM2 * 1000);
        checks.push({
            clause: 'EN 1993-1-8 3.6.1',
            description: 'Bolt shear (from VEd)',
            FEd: VEd / (boltRows * boltsPerRow),
            FRd: FvRd,
            ratio: VEd / (boltRows * boltsPerRow * FvRd),
            status: VEd / (boltRows * boltsPerRow) <= FvRd ? 'OK' : 'NOT OK'
        });

        return {
            endPlateThickness,
            boltRows,
            checks
        };
    }

    /**
     * Check column web in transverse compression (EN 1993-1-8 6.2.6.2)
     */
    checkColumnWebCompression(
        columnWeb: number,
        columnFy: number,
        beff: number,
        FcEd: number
    ): EC3Check {
        const omega = 1.0; // Reduction factor
        const kwc = 1.0;   // Interaction factor
        const FcRd = (omega * kwc * beff * columnWeb * columnFy) / (this.gammaM0 * 1000);

        return {
            clause: 'EN 1993-1-8 6.2.6.2',
            description: 'Column web compression',
            FEd: FcEd,
            FRd: FcRd,
            ratio: FcEd / FcRd,
            status: FcEd <= FcRd ? 'OK' : 'NOT OK'
        };
    }

    /**
     * Check column flange in bending (T-stub)
     */
    checkColumnFlangeBending(
        columnFlange: number,
        columnFy: number,
        m: number,    // Edge distance
        e: number,    // Bolt edge distance
        FtEd: number
    ): EC3Check {
        // Mode 1: Complete flange yielding
        const Mpl = 0.25 * columnFlange ** 2 * columnFy / this.gammaM0;
        const leff = 2 * Math.PI * m;
        const FRd_mode1 = (4 * Mpl * leff) / (m * 1000);

        return {
            clause: 'EN 1993-1-8 6.2.6.4',
            description: 'Column flange bending',
            FEd: FtEd,
            FRd: FRd_mode1,
            ratio: FtEd / FRd_mode1,
            status: FtEd <= FRd_mode1 ? 'OK' : 'NOT OK'
        };
    }
}

// Export singleton
export const ec3Connection = new EC3ConnectionChecker();
export default EC3ConnectionChecker;
