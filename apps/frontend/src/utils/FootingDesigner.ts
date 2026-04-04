/**
 * FootingDesigner - Isolated Footing Design
 * As per IS 456:2000 and IS 1904:1986
 */

// ============================================
// TYPES & INTERFACES
// ============================================

export interface FootingInputs {
    P: number;              // Axial load (kN)
    M: number;              // Moment (kN·m)
    V?: number;             // Shear if any (kN)
    columnWidth: number;    // Column width (mm)
    columnDepth: number;    // Column depth (mm)
    SBC: number;            // Safe Bearing Capacity (kN/m²)
    fck: number;            // Concrete grade (MPa)
    fy: number;             // Steel grade (MPa)
    cover?: number;         // Clear cover (mm)
    soilDepth?: number;     // Depth of foundation (mm)
}

export interface FootingDesignResult {
    // Dimensions
    L: number;              // Length (mm)
    B: number;              // Width (mm)
    D: number;              // Overall depth (mm)
    d: number;              // Effective depth (mm)

    // Checks
    eccentricity: EccentricityCheck;
    bearingPressure: BearingCheck;
    oneWayShear: ShearCheck;
    punchingShear: ShearCheck;
    flexure: FlexureCheck;

    // Reinforcement
    Ast_L: number;          // Steel in L direction (mm²)
    Ast_B: number;          // Steel in B direction (mm²)
    barSize_L: string;
    barSize_B: string;
    spacing_L: number;
    spacing_B: number;

    // Summary
    status: 'OK' | 'REVISE_SIZE' | 'REVISE_DEPTH';
    summary: string;
}

interface EccentricityCheck {
    e: number;              // Eccentricity (mm)
    e_limit: number;        // L/6 limit (mm)
    withinKern: boolean;
}

interface BearingCheck {
    q_max: number;          // Maximum pressure (kN/m²)
    q_min: number;          // Minimum pressure (kN/m²)
    q_avg: number;          // Average pressure (kN/m²)
    ratio: number;          // q_max / SBC
    status: 'OK' | 'EXCEEDS_SBC';
}

interface ShearCheck {
    Vu: number;             // Applied shear (kN)
    Vc: number;             // Shear capacity (kN)
    ratio: number;
    status: 'OK' | 'INCREASE_DEPTH';
}

interface FlexureCheck {
    Mu_L: number;           // Moment in L direction (kN·m)
    Mu_B: number;           // Moment in B direction (kN·m)
    Ast_req_L: number;
    Ast_req_B: number;
}

// ============================================
// FOOTING DESIGNER
// ============================================

export class FootingDesigner {
    // IS 456:2000 constants
    static readonly gamma_c = 1.5;
    static readonly gamma_s = 1.15;
    static readonly MIN_DEPTH = 300;  // mm - Minimum depth as per IS 1904

    /**
     * Main design function
     */
    static design(inputs: FootingInputs): FootingDesignResult {
        const { P, M, columnWidth, columnDepth, SBC, fck, fy } = inputs;
        const cover = inputs.cover ?? 50;

        // Step 1: Initial sizing
        const { L, B } = this.calculateSize(P, M, SBC);

        // Step 2: Check eccentricity
        const eccentricity = this.checkEccentricity(P, M, L);

        // Step 3: Calculate bearing pressure
        const bearingPressure = this.calculateBearingPressure(P, M, L, B, SBC);

        // Step 4: Determine depth (iterative)
        let D = this.estimateDepth(L, B, columnWidth, columnDepth, bearingPressure.q_max, fck);
        let d = D - cover - 10;  // Assuming 20mm bars

        // Step 5: One-way shear check
        let oneWayShear = this.checkOneWayShear(
            L, B, d, columnWidth, columnDepth, bearingPressure.q_max, fck
        );

        // Increase depth if needed
        while (oneWayShear.status === 'INCREASE_DEPTH' && D < 1500) {
            D += 50;
            d = D - cover - 10;
            oneWayShear = this.checkOneWayShear(
                L, B, d, columnWidth, columnDepth, bearingPressure.q_max, fck
            );
        }

        // Step 6: Punching shear check
        let punchingShear = this.checkPunchingShear(
            P, L, B, d, columnWidth, columnDepth, fck
        );

        while (punchingShear.status === 'INCREASE_DEPTH' && D < 1500) {
            D += 50;
            d = D - cover - 10;
            punchingShear = this.checkPunchingShear(
                P, L, B, d, columnWidth, columnDepth, fck
            );
        }

        // Step 7: Flexure design
        const flexure = this.designFlexure(L, B, d, columnWidth, columnDepth, bearingPressure.q_max, fy);

        // Step 8: Reinforcement detailing
        const reinfL = this.selectReinforcement(flexure.Ast_req_L, B);
        const reinfB = this.selectReinforcement(flexure.Ast_req_B, L);

        const barSize_L = reinfL.barSize;
        const spacing_L = reinfL.spacing;
        const Ast_L = reinfL.Ast;
        const barSize_B = reinfB.barSize;
        const spacing_B = reinfB.spacing;
        const Ast_B = reinfB.Ast;

        // Determine status
        let status: FootingDesignResult['status'] = 'OK';
        if (bearingPressure.status === 'EXCEEDS_SBC') status = 'REVISE_SIZE';
        if (oneWayShear.status === 'INCREASE_DEPTH' || punchingShear.status === 'INCREASE_DEPTH') {
            status = 'REVISE_DEPTH';
        }

        const summary = this.generateSummary({
            L, B, D, d,
            eccentricity, bearingPressure, oneWayShear, punchingShear,
            barSize_L, spacing_L, barSize_B, spacing_B
        });

        return {
            L, B, D, d,
            eccentricity,
            bearingPressure,
            oneWayShear,
            punchingShear,
            flexure,
            Ast_L, Ast_B,
            barSize_L, barSize_B,
            spacing_L, spacing_B,
            status,
            summary
        };
    }

    // ============================================
    // SIZING
    // ============================================

    private static calculateSize(P: number, M: number, SBC: number): { L: number; B: number } {
        // Required area
        const A_req = (P / SBC) * 1e6;  // mm²

        // Eccentricity
        const e = M > 0 ? (M / P) * 1000 : 0;  // mm

        // For square footing with eccentricity, increase size
        let L = Math.sqrt(A_req);
        let B = L;

        // If eccentric, make rectangular (L in direction of moment)
        if (e > 0) {
            // Ensure e < L/6 (kern condition)
            const L_min = 6 * e;
            L = Math.max(L, L_min);
            B = A_req / L;

            // Round up to nearest 100mm
            L = Math.ceil(L / 100) * 100;
            B = Math.ceil(B / 100) * 100;

            // Ensure minimum size
            L = Math.max(L, 1000);
            B = Math.max(B, 1000);
        } else {
            // Square footing
            L = Math.ceil(Math.sqrt(A_req) / 100) * 100;
            B = L;
            L = Math.max(L, 1000);
            B = Math.max(B, 1000);
        }

        return { L, B };
    }

    private static estimateDepth(
        L: number, B: number,
        colW: number, colD: number,
        q_max: number, fck: number
    ): number {
        // Cantilever length (critical for one-way shear)
        const cantL = (L - colW) / 2;
        const cantB = (B - colD) / 2;
        const cant_max = Math.max(cantL, cantB);

        // Approximate depth from shear considerations
        // τc ≈ 0.25√fck for M25 concrete (conservative)
        const tau_c = 0.25 * Math.sqrt(fck);  // MPa = N/mm²

        // Vu = q * B * (cant - d)
        // Vc = τc * B * d
        // Set Vu = Vc and solve for d
        const q = q_max / 1e6;  // kN/mm² to N/mm²

        // d ≈ q * cant / (tau_c + q)
        const d_shear = (q * cant_max) / (tau_c + q);

        // Minimum depth from IS 1904
        const d_min = this.MIN_DEPTH - 60;

        let d = Math.max(d_shear, d_min);
        d = Math.ceil(d / 25) * 25;  // Round to 25mm

        const D = d + 60;  // Cover + half bar
        return Math.max(D, this.MIN_DEPTH);
    }

    // ============================================
    // ECCENTRICITY CHECK
    // ============================================

    private static checkEccentricity(P: number, M: number, L: number): EccentricityCheck {
        const e = M > 0 ? (M / P) * 1000 : 0;  // mm
        const e_limit = L / 6;
        const withinKern = e <= e_limit;

        return { e, e_limit, withinKern };
    }

    // ============================================
    // BEARING PRESSURE
    // ============================================

    private static calculateBearingPressure(
        P: number, M: number, L: number, B: number, SBC: number
    ): BearingCheck {
        const A = (L * B) / 1e6;  // m²
        const Z = (B * L * L) / (6 * 1e9);  // m³ (section modulus)

        // q = P/A ± M/Z
        const q_avg = P / A;
        const q_moment = M / Z;

        const q_max = q_avg + q_moment;
        const q_min = q_avg - q_moment;

        const ratio = q_max / SBC;
        const status: BearingCheck['status'] = ratio <= 1.0 ? 'OK' : 'EXCEEDS_SBC';

        return { q_max, q_min, q_avg, ratio, status };
    }

    // ============================================
    // ONE-WAY SHEAR (IS 456 Clause 34.2.4.1)
    // ============================================

    private static checkOneWayShear(
        L: number, B: number, d: number,
        colW: number, colD: number,
        q_max: number, fck: number
    ): ShearCheck {
        // Critical section at d from column face
        const cantL = (L - colW) / 2 - d;
        const cantB = (B - colD) / 2 - d;

        // Shear force (consider larger cantilever)
        const Vu_L = (q_max * B * cantL) / 1e6;  // kN
        const Vu_B = (q_max * L * cantB) / 1e6;  // kN
        const Vu = Math.max(Vu_L, Vu_B, 0);

        // Shear capacity (IS 456 Table 19, assuming pt = 0.25%)
        const tau_c = 0.36 * Math.pow(fck, 0.5) * 0.8;  // Simplified
        const Vc = (tau_c * Math.max(B, L) * d) / 1000;  // kN

        const ratio = Vu / (Vc > 0 ? Vc : 1);
        const status: ShearCheck['status'] = ratio <= 1.0 ? 'OK' : 'INCREASE_DEPTH';

        return { Vu, Vc, ratio, status };
    }

    // ============================================
    // PUNCHING SHEAR (IS 456 Clause 31.6.3)
    // ============================================

    private static checkPunchingShear(
        P: number, L: number, B: number, d: number,
        colW: number, colD: number, fck: number
    ): ShearCheck {
        // Critical section at d/2 from column face
        const b0 = 2 * ((colW + d) + (colD + d));  // Perimeter (mm)

        // Punching shear force
        const A_punch = (colW + d) * (colD + d) / 1e6;  // m²
        const A_total = (L * B) / 1e6;  // m²
        const Vu = P * (1 - A_punch / A_total);  // kN

        // Punching shear capacity (IS 456 Clause 31.6.3.1)
        // ks = 0.5 + βc (≤ 1.0), βc = short/long side of column
        const beta_c = Math.min(colW, colD) / Math.max(colW, colD);
        const ks = Math.min(0.5 + beta_c, 1.0);

        const tau_c = ks * 0.25 * Math.sqrt(fck);  // MPa
        const Vc = (tau_c * b0 * d) / 1000;  // kN

        const ratio = Vu / (Vc > 0 ? Vc : 1);
        const status: ShearCheck['status'] = ratio <= 1.0 ? 'OK' : 'INCREASE_DEPTH';

        return { Vu, Vc, ratio, status };
    }

    // ============================================
    // FLEXURE DESIGN
    // ============================================

    private static designFlexure(
        L: number, B: number, d: number,
        colW: number, colD: number,
        q_max: number, fy: number
    ): FlexureCheck {
        // Cantilever moments
        const cantL = (L - colW) / 2;
        const cantB = (B - colD) / 2;

        // Mu = q * width * cant²/2
        const Mu_L = (q_max * B * cantL * cantL) / (2 * 1e9);  // kN·m
        const Mu_B = (q_max * L * cantB * cantB) / (2 * 1e9);  // kN·m

        // As = Mu / (0.87 * fy * 0.9 * d)
        const fyd = 0.87 * fy;
        const Ast_req_L = (Mu_L * 1e6) / (fyd * 0.9 * d);  // mm²
        const Ast_req_B = (Mu_B * 1e6) / (fyd * 0.9 * d);  // mm²

        // Minimum steel (0.12% for HYSD bars, IS 456 Clause 26.5.2.1)
        const Ast_min = 0.0012 * B * d;

        return {
            Mu_L,
            Mu_B,
            Ast_req_L: Math.max(Ast_req_L, Ast_min),
            Ast_req_B: Math.max(Ast_req_B, Ast_min)
        };
    }

    // ============================================
    // REINFORCEMENT SELECTION
    // ============================================

    private static selectReinforcement(
        Ast_req: number, width: number
    ): { barSize: string; spacing: number; Ast: number } {
        const bars = [
            { size: '12mm', area: 113.1 },
            { size: '16mm', area: 201.1 },
            { size: '20mm', area: 314.2 },
        ];

        for (const bar of bars) {
            const numBars = Math.ceil(Ast_req / bar.area);
            const spacing = Math.floor(width / numBars);

            if (spacing >= 100 && spacing <= 300) {
                // Round spacing to nearest 25mm
                const roundedSpacing = Math.floor(spacing / 25) * 25;
                const actualBars = Math.ceil(width / roundedSpacing);

                return {
                    barSize: bar.size,
                    spacing: roundedSpacing,
                    Ast: actualBars * bar.area
                };
            }
        }

        // Fallback
        return {
            barSize: '16mm',
            spacing: 150,
            Ast: Math.ceil(width / 150) * 201.1
        };
    }

    // ============================================
    // SUMMARY
    // ============================================

    private static generateSummary(data: {
        L: number; B: number; D: number; d: number;
        eccentricity: EccentricityCheck;
        bearingPressure: BearingCheck;
        oneWayShear: ShearCheck;
        punchingShear: ShearCheck;
        barSize_L: string; spacing_L: number;
        barSize_B: string; spacing_B: number;
    }): string {
        const { L, B, D, eccentricity, bearingPressure, oneWayShear, punchingShear } = data;

        return [
            `=== Isolated Footing Design (IS 456:2000) ===`,
            ``,
            `Dimensions: ${L}mm × ${B}mm × ${D}mm`,
            ``,
            `Eccentricity: e = ${eccentricity.e.toFixed(0)}mm (limit: ${eccentricity.e_limit.toFixed(0)}mm) ${eccentricity.withinKern ? '✓' : '✗'}`,
            `Bearing: q_max = ${bearingPressure.q_max.toFixed(1)} kN/m² (${(bearingPressure.ratio * 100).toFixed(0)}% SBC) ${bearingPressure.status === 'OK' ? '✓' : '✗'}`,
            `One-way Shear: ${(oneWayShear.ratio * 100).toFixed(0)}% ${oneWayShear.status === 'OK' ? '✓' : '✗'}`,
            `Punching Shear: ${(punchingShear.ratio * 100).toFixed(0)}% ${punchingShear.status === 'OK' ? '✓' : '✗'}`,
            ``,
            `Reinforcement:`,
            `  Bottom L-dir: ${data.barSize_L}@${data.spacing_L}mm c/c`,
            `  Bottom B-dir: ${data.barSize_B}@${data.spacing_B}mm c/c`
        ].join('\n');
    }
}

export default FootingDesigner;
