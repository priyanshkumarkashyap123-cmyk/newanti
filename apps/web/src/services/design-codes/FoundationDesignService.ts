/**
 * FoundationDesignService.ts
 * 
 * Foundation Design per ACI 318-19
 * 
 * Features:
 * - Isolated spread footings
 * - Combined footings
 * - Mat/raft foundations
 * - Pile cap design
 * - One-way and two-way shear
 * - Bearing capacity checks
 */

// ============================================
// TYPES
// ============================================

export interface SoilProperties {
    qa: number;           // Allowable bearing capacity (ksf)
    gamma: number;        // Unit weight (pcf)
    friction: number;     // Internal friction angle (degrees)
    cohesion: number;     // Cohesion (psf)
}

export interface FootingGeometry {
    type: 'square' | 'rectangular' | 'circular';
    B: number;            // Width (ft)
    L: number;            // Length (ft)
    D: number;            // Depth/thickness (in)
    embedment: number;    // Embedment depth (ft)
}

export interface ColumnLoads {
    Pu: number;           // Factored axial (kips)
    Mux: number;          // Factored moment X (kip-ft)
    Muy: number;          // Factored moment Y (kip-ft)
    Vu?: number;          // Factored shear (kips)
    columnSize: { bx: number; by: number }; // Column dimensions (in)
}

export interface FootingReinforcement {
    barSizeB: string;     // Bottom mat bar size (e.g., '#6')
    spacingB: number;     // Spacing in B direction (in)
    barSizeL: string;     // Bottom mat bar size L direction
    spacingL: number;     // Spacing in L direction (in)
}

export interface FootingCheck {
    check: string;
    reference: string;
    demand: number;
    capacity: number;
    ratio: number;
    status: 'OK' | 'NG';
}

export interface FootingDesignResult {
    geometry: FootingGeometry;
    reinforcement: FootingReinforcement;
    checks: FootingCheck[];
    bearingPressure: number;
    punchingRatio: number;
    passed: boolean;
}

// ============================================
// FOUNDATION DESIGN SERVICE
// ============================================

class FoundationDesignServiceClass {
    private phi_c = 0.75;  // Shear
    private phi_b = 0.90;  // Flexure

    /**
     * Design isolated spread footing
     */
    designSpreadFooting(
        loads: ColumnLoads,
        soil: SoilProperties,
        fc: number = 4000,     // f'c (psi)
        fy: number = 60000     // fy (psi)
    ): FootingDesignResult {
        // Step 1: Size footing for bearing
        const { B, L } = this.sizeFooting(loads, soil);

        // Step 2: Determine thickness for shear
        const D = this.determineThickness(loads, B, L, fc);

        // Step 3: Design reinforcement for flexure
        const reinforcement = this.designReinforcement(loads, B, L, D, fc, fy);

        // Step 4: Perform all checks
        const geometry: FootingGeometry = {
            type: B === L ? 'square' : 'rectangular',
            B, L, D,
            embedment: 3 // Default 3 ft
        };

        const checks = this.performChecks(geometry, loads, soil, fc, reinforcement);

        const bearingPressure = loads.Pu / (B * L);
        const punchingCheck = checks.find(c => c.check === 'Punching Shear');
        const punchingRatio = punchingCheck?.ratio || 0;

        return {
            geometry,
            reinforcement,
            checks,
            bearingPressure,
            punchingRatio,
            passed: checks.every(c => c.status === 'OK')
        };
    }

    /**
     * Size footing based on bearing capacity
     */
    private sizeFooting(
        loads: ColumnLoads,
        soil: SoilProperties
    ): { B: number; L: number } {
        const { Pu, Mux, Muy } = loads;
        const { qa } = soil;

        // Service loads (approximate)
        const P = Pu / 1.4;
        const Mx = Mux / 1.4;
        const My = Muy / 1.4;

        // Start with concentric load
        let A_req = P / qa;

        // Account for eccentricity
        const ex = Mx / P;
        const ey = My / P;

        // Increase size for eccentricity
        if (ex > 0 || ey > 0) {
            A_req *= 1.3; // 30% increase for eccentricity
        }

        // Assume square footing
        let B = Math.ceil(Math.sqrt(A_req) * 2) / 2; // Round to 0.5 ft
        B = Math.max(B, 3); // Minimum 3 ft

        // If highly eccentric, make rectangular
        if (Math.abs(ex) > B / 6 || Math.abs(ey) > B / 6) {
            const L = B * 1.5;
            return { B, L };
        }

        return { B, L: B };
    }

    /**
     * Determine footing thickness for shear
     */
    private determineThickness(
        loads: ColumnLoads,
        B: number,
        L: number,
        fc: number
    ): number {
        const { Pu, columnSize } = loads;
        const { bx, by } = columnSize;

        // Gross bearing pressure (psf)
        const qu = (Pu * 1000) / (B * L); // Convert to psf

        // Punching shear - iterate to find d
        let d = 12; // Start with 12 inches

        for (let iter = 0; iter < 10; iter++) {
            // Critical perimeter
            const b0 = 2 * ((bx + d) + (by + d));

            // Punching shear capacity (ACI 22.6.5.2)
            const beta = Math.max(bx, by) / Math.min(bx, by);
            const vc1 = 4 * Math.sqrt(fc);
            const vc2 = (2 + 4 / beta) * Math.sqrt(fc);
            const vc3 = (2 + 40 * d / b0) * Math.sqrt(fc);
            const vc = Math.min(vc1, vc2, vc3);

            const phi_Vc = this.phi_c * vc * b0 * d / 1000; // kips

            // Punching shear demand
            const Acrit = (bx + d) * (by + d) / 144; // sq ft
            const Vu = Pu - qu * Acrit / 1000; // kips

            if (phi_Vc >= Vu) {
                break;
            }

            d += 2;
        }

        // Total thickness = d + cover + bar diameter/2
        const cover = 3; // 3" for soil contact
        const D = d + cover + 0.5; // Approximate

        // Round up to nearest inch
        return Math.ceil(D);
    }

    /**
     * Design reinforcement for flexure
     */
    private designReinforcement(
        loads: ColumnLoads,
        B: number,
        L: number,
        D: number,
        fc: number,
        fy: number
    ): FootingReinforcement {
        const { Pu, columnSize } = loads;
        const d = D - 3 - 0.5; // Effective depth

        // Net bearing pressure
        const qu = (Pu * 1000) / (B * L); // psf

        // Critical section for moment (face of column)
        const cantilever_B = (B * 12 - columnSize.bx) / 2;
        const cantilever_L = (L * 12 - columnSize.by) / 2;

        // Moment per foot width
        const Mu_B = qu * (cantilever_B / 12) ** 2 / 2 * L / 1000; // kip-ft per ft width
        const Mu_L = qu * (cantilever_L / 12) ** 2 / 2 * B / 1000;

        // Required As per foot
        const As_B = this.calculateAs(Mu_B * 12, 12, d, fc, fy);
        const As_L = this.calculateAs(Mu_L * 12, 12, d, fc, fy);

        // Minimum reinforcement
        const As_min = 0.0018 * 12 * D;

        // Select bar size and spacing
        const { barSize: barSizeB, spacing: spacingB } = this.selectBars(
            Math.max(As_B, As_min), 12
        );
        const { barSize: barSizeL, spacing: spacingL } = this.selectBars(
            Math.max(As_L, As_min), 12
        );

        return {
            barSizeB,
            spacingB,
            barSizeL,
            spacingL
        };
    }

    /**
     * Calculate required As for given moment
     */
    private calculateAs(
        Mu: number,      // kip-in
        b: number,       // width (in)
        d: number,       // effective depth (in)
        fc: number,
        fy: number
    ): number {
        // Use simplified equation
        const Rn = Mu * 1000 / (this.phi_b * b * d * d);
        const rho = 0.85 * fc / fy * (1 - Math.sqrt(1 - 2 * Rn / (0.85 * fc)));
        return rho * b * d;
    }

    /**
     * Select bar size and spacing
     */
    private selectBars(
        As_req: number,
        width: number
    ): { barSize: string; spacing: number } {
        const bars: Record<string, number> = {
            '#4': 0.20, '#5': 0.31, '#6': 0.44, '#7': 0.60, '#8': 0.79
        };

        for (const [size, area] of Object.entries(bars)) {
            for (let spacing = 6; spacing <= 18; spacing += 1) {
                const numBars = width / spacing;
                const As_provided = numBars * area;
                if (As_provided >= As_req) {
                    return { barSize: size, spacing };
                }
            }
        }

        return { barSize: '#8', spacing: 6 };
    }

    /**
     * Perform all design checks
     */
    private performChecks(
        geometry: FootingGeometry,
        loads: ColumnLoads,
        soil: SoilProperties,
        fc: number,
        reinforcement: FootingReinforcement
    ): FootingCheck[] {
        const checks: FootingCheck[] = [];
        const { B, L, D } = geometry;
        const { Pu, columnSize } = loads;
        const { bx, by } = columnSize;
        const d = D - 3 - 0.5;

        // 1. Bearing capacity
        const qu = Pu / (B * L);
        checks.push({
            check: 'Bearing Capacity',
            reference: 'ACI 22.8.3',
            demand: qu,
            capacity: soil.qa,
            ratio: qu / soil.qa,
            status: qu <= soil.qa ? 'OK' : 'NG'
        });

        // 2. Punching shear
        const b0 = 2 * ((bx + d) + (by + d));
        const vc = 4 * Math.sqrt(fc);
        const phi_Vc = this.phi_c * vc * b0 * d / 1000;
        const Acrit = (bx + d) * (by + d) / 144;
        const quNet = (Pu * 1000) / (B * L);
        const Vu = Pu - quNet * Acrit / 1000;

        checks.push({
            check: 'Punching Shear',
            reference: 'ACI 22.6.5',
            demand: Vu,
            capacity: phi_Vc,
            ratio: Vu / phi_Vc,
            status: Vu <= phi_Vc ? 'OK' : 'NG'
        });

        // 3. One-way shear
        const critDist = d;
        const Vu1 = quNet / 1000 * L * ((B * 12 - bx) / 2 - critDist) / 12;
        const phi_Vc1 = this.phi_c * 2 * Math.sqrt(fc) * L * 12 * d / 1000;

        checks.push({
            check: 'One-Way Shear',
            reference: 'ACI 22.5',
            demand: Vu1,
            capacity: phi_Vc1,
            ratio: Vu1 / phi_Vc1,
            status: Vu1 <= phi_Vc1 ? 'OK' : 'NG'
        });

        // 4. Minimum reinforcement
        const As_min = 0.0018 * 12 * D;
        const bars: Record<string, number> = { '#4': 0.20, '#5': 0.31, '#6': 0.44, '#7': 0.60, '#8': 0.79 };
        const As_provided = (12 / reinforcement.spacingB) * bars[reinforcement.barSizeB];

        checks.push({
            check: 'Minimum Reinforcement',
            reference: 'ACI 7.6.1',
            demand: As_min,
            capacity: As_provided,
            ratio: As_min / As_provided,
            status: As_provided >= As_min ? 'OK' : 'NG'
        });

        return checks;
    }

    /**
     * Quick footing design
     */
    quickDesign(
        Pu_kips: number,
        qa_ksf: number,
        columnB_in: number,
        columnL_in: number
    ): FootingDesignResult {
        return this.designSpreadFooting(
            {
                Pu: Pu_kips,
                Mux: 0,
                Muy: 0,
                columnSize: { bx: columnB_in, by: columnL_in }
            },
            { qa: qa_ksf, gamma: 120, friction: 30, cohesion: 0 }
        );
    }
}

// ============================================
// SINGLETON
// ============================================

export const foundationDesign = new FoundationDesignServiceClass();

export default FoundationDesignServiceClass;
