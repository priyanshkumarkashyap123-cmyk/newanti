/**
 * RCBeamDesigner - Reinforced Concrete Beam Design
 * ACI 318-19 / IS 456:2000 compliant design
 */

// ============================================
// TYPES & INTERFACES
// ============================================

export interface BeamInputs {
    Mu: number;         // Factored moment (kN·m or kip·ft)
    Vu: number;         // Factored shear (kN or kip)
    b: number;          // Beam width (mm or in)
    d: number;          // Effective depth (mm or in)
    fc: number;         // Concrete compressive strength (MPa or psi)
    fy: number;         // Steel yield strength (MPa or psi)
    cover?: number;     // Clear cover (mm or in)
    units?: 'SI' | 'US';
}

export interface FlexureResult {
    As_required: number;        // Required steel area (mm² or in²)
    As_min: number;             // Minimum steel area
    As_max: number;             // Maximum steel area
    As_provided: number;        // Provided steel area
    numBars: number;            // Number of bars
    barSize: string;            // Bar designation
    rho: number;                // Steel ratio
    a: number;                  // Depth of compression block
    c: number;                  // Neutral axis depth
    Mn: number;                 // Nominal moment capacity
    phi_Mn: number;             // Design moment capacity
    status: 'OK' | 'COMPRESSION_CONTROLLED' | 'OVER_REINFORCED';
}

export interface ShearResult {
    Vu: number;                 // Applied shear
    phi_Vc: number;             // Concrete shear capacity
    Vs_required: number;        // Required steel shear
    Av_s_required: number;      // Av/s ratio required
    stirrupSize: string;        // Stirrup bar size
    spacing: number;            // Stirrup spacing
    maxSpacing: number;         // Maximum allowed spacing
    numLegs: number;            // Number of stirrup legs
    status: 'OK' | 'INCREASE_SECTION' | 'MIN_STIRRUPS';
}

export interface BeamDesignResult {
    flexure: FlexureResult;
    shear: ShearResult;
    reinforcementString: string;
    summaryIS: string;          // IS 456 notation
    summaryACI: string;         // ACI notation
}

// ============================================
// REBAR DATA
// ============================================

const REBAR_US = {
    '#3': { diameter: 0.375, area: 0.11 },
    '#4': { diameter: 0.5, area: 0.20 },
    '#5': { diameter: 0.625, area: 0.31 },
    '#6': { diameter: 0.75, area: 0.44 },
    '#7': { diameter: 0.875, area: 0.60 },
    '#8': { diameter: 1.0, area: 0.79 },
    '#9': { diameter: 1.128, area: 1.00 },
    '#10': { diameter: 1.27, area: 1.27 },
    '#11': { diameter: 1.41, area: 1.56 },
};

const REBAR_SI = {
    '8mm': { diameter: 8, area: 50.3 },
    '10mm': { diameter: 10, area: 78.5 },
    '12mm': { diameter: 12, area: 113.1 },
    '16mm': { diameter: 16, area: 201.1 },
    '20mm': { diameter: 20, area: 314.2 },
    '25mm': { diameter: 25, area: 490.9 },
    '32mm': { diameter: 32, area: 804.2 },
};

// ============================================
// RC BEAM DESIGNER
// ================================== ==========

export class RCBeamDesigner {
    // ACI 318-19 factors
    static readonly phi_flexure = 0.90;     // Tension-controlled
    static readonly phi_shear = 0.75;
    static readonly beta1_fc_limit = 28;    // MPa (4000 psi)

    /**
     * Main design function
     */
    static design(inputs: BeamInputs): BeamDesignResult {
        const units = inputs.units ?? 'SI';

        const flexure = this.designFlexure(inputs);
        const shear = this.designShear(inputs);

        // Generate reinforcement string
        const reinforcementString = this.formatReinforcement(flexure, shear, units);

        return {
            flexure,
            shear,
            reinforcementString,
            summaryIS: this.formatIS456(flexure, shear),
            summaryACI: this.formatACI(flexure, shear)
        };
    }

    // ============================================
    // FLEXURE DESIGN
    // ============================================

    static designFlexure(inputs: BeamInputs): FlexureResult {
        const { Mu, b, d, fc, fy } = inputs;
        const units = inputs.units ?? 'SI';

        // Convert moment to consistent units
        const Mu_design = units === 'SI' ? Mu * 1e6 : Mu * 12000;  // N·mm or lb·in

        // Beta1 factor (ACI 318-19 §22.2.2.4.3)
        const fc_ref = units === 'SI' ? 28 : 4000;
        let beta1 = 0.85;
        if (fc > fc_ref) {
            beta1 = Math.max(0.65, 0.85 - 0.05 * (fc - fc_ref) / (units === 'SI' ? 7 : 1000));
        }

        // Initial estimate: As = Mu / (0.9 * fy * 0.9d)
        let As = Mu_design / (0.9 * fy * 0.9 * d);

        // Iterate for exact 'a'
        let a = 0;
        for (let iter = 0; iter < 10; iter++) {
            a = (As * fy) / (0.85 * fc * b);
            const jd = d - a / 2;
            const As_new = Mu_design / (this.phi_flexure * fy * jd);

            if (Math.abs(As_new - As) < 0.01 * As) break;
            As = As_new;
        }

        // Neutral axis depth
        const c = a / beta1;

        // Check strain (tension-controlled if εt > 0.005)
        const epsilon_t = 0.003 * (d - c) / c;
        let status: FlexureResult['status'] = 'OK';

        if (epsilon_t < 0.005) {
            status = epsilon_t < 0.002 ? 'OVER_REINFORCED' : 'COMPRESSION_CONTROLLED';
        }

        // Minimum steel (ACI 318-19 §9.6.1.2)
        const As_min1 = (3 * Math.sqrt(fc) * b * d) / fy;
        const As_min2 = (200 * b * d) / fy;  // For US units adjust
        const As_min = Math.max(As_min1, As_min2);

        // Maximum steel (balanced condition)
        const rho_max = (0.85 * beta1 * fc / fy) * (0.003 / (0.003 + 0.004));
        const As_max = rho_max * b * d;

        // Select bars
        const As_required = Math.max(As, As_min);
        const { numBars, barSize, As_provided } = this.selectBars(As_required, units);

        // Steel ratio
        const rho = As_provided / (b * d);

        // Nominal moment capacity
        const a_provided = (As_provided * fy) / (0.85 * fc * b);
        const Mn = As_provided * fy * (d - a_provided / 2);
        const phi_Mn = this.phi_flexure * Mn;

        return {
            As_required,
            As_min,
            As_max,
            As_provided,
            numBars,
            barSize,
            rho,
            a: a_provided,
            c: a_provided / beta1,
            Mn: units === 'SI' ? Mn / 1e6 : Mn / 12000,
            phi_Mn: units === 'SI' ? phi_Mn / 1e6 : phi_Mn / 12000,
            status
        };
    }

    // ============================================
    // SHEAR DESIGN
    // ============================================

    static designShear(inputs: BeamInputs): ShearResult {
        const { Vu, b, d, fc, fy } = inputs;
        const units = inputs.units ?? 'SI';

        // Concrete shear capacity (ACI 318-19 §22.5.5.1)
        // Vc = 2 * sqrt(fc) * b * d (US) or 0.17 * sqrt(fc) * b * d (SI)
        const Vc = units === 'SI'
            ? 0.17 * Math.sqrt(fc) * b * d / 1000  // kN
            : 2 * Math.sqrt(fc) * b * d / 1000;   // kip

        const phi_Vc = this.phi_shear * Vc;

        // Required steel shear
        const Vs_required = Math.max(0, (Vu / this.phi_shear) - Vc);

        // Check maximum shear
        const Vs_max = units === 'SI'
            ? 0.66 * Math.sqrt(fc) * b * d / 1000
            : 8 * Math.sqrt(fc) * b * d / 1000;

        let status: ShearResult['status'] = 'OK';
        if (Vs_required > Vs_max) {
            status = 'INCREASE_SECTION';
        }

        // Av/s required
        const Av_s_required = Vs_required > 0
            ? (Vs_required * 1000) / (fy * d)  // mm²/mm or in²/in
            : 0;

        // Minimum shear reinforcement (ACI 318-19 §9.6.3.3)
        const Av_s_min = units === 'SI'
            ? Math.max(0.062 * Math.sqrt(fc) * b / fy, 0.35 * b / fy)
            : Math.max(0.75 * Math.sqrt(fc) * b / fy, 50 * b / fy);

        // Select stirrups
        const { stirrupSize, spacing, numLegs, Av } = this.selectStirrups(
            Math.max(Av_s_required, Av_s_min),
            d,
            units
        );

        // Maximum spacing (ACI 318-19 §9.7.6.2.2)
        let maxSpacing = Math.min(d / 2, units === 'SI' ? 600 : 24);
        if (Vs_required > Vc / 2) {
            maxSpacing = Math.min(d / 4, units === 'SI' ? 300 : 12);
        }

        if (Vs_required <= 0 && Vu > phi_Vc / 2) {
            status = 'MIN_STIRRUPS';
        }

        return {
            Vu,
            phi_Vc,
            Vs_required,
            Av_s_required,
            stirrupSize,
            spacing: Math.min(spacing, maxSpacing),
            maxSpacing,
            numLegs,
            status
        };
    }

    // ============================================
    // BAR SELECTION
    // ============================================

    private static selectBars(
        As_required: number,
        units: 'SI' | 'US'
    ): { numBars: number; barSize: string; As_provided: number } {
        type BarData = { diameter: number; area: number };
        const rebarData: Record<string, BarData> = units === 'SI' ? REBAR_SI : REBAR_US;
        const barSizes = Object.keys(rebarData);

        // Try common bar sizes from larger to smaller
        const preferredBars = units === 'SI'
            ? ['20mm', '16mm', '25mm', '12mm']
            : ['#8', '#7', '#6', '#9', '#5'];

        for (const barSize of preferredBars) {
            const bar = rebarData[barSize];
            if (!bar) continue;

            const numBars = Math.ceil(As_required / bar.area);

            if (numBars >= 2 && numBars <= 6) {
                return {
                    numBars,
                    barSize,
                    As_provided: numBars * bar.area
                };
            }
        }

        // Fallback: use any bar that works
        for (const barSize of barSizes.reverse()) {
            const bar = rebarData[barSize];
            if (!bar) continue;

            const numBars = Math.ceil(As_required / bar.area);
            if (numBars >= 2) {
                return {
                    numBars: Math.min(numBars, 8),
                    barSize,
                    As_provided: Math.min(numBars, 8) * bar.area
                };
            }
        }

        return { numBars: 2, barSize: units === 'SI' ? '16mm' : '#6', As_provided: 0 };
    }

    private static selectStirrups(
        Av_s_required: number,
        d: number,
        units: 'SI' | 'US'
    ): { stirrupSize: string; spacing: number; numLegs: number; Av: number } {
        const stirrupBars = units === 'SI'
            ? { '8mm': 50.3, '10mm': 78.5, '12mm': 113.1 }
            : { '#3': 0.11, '#4': 0.20, '#5': 0.31 };

        const numLegs = 2;  // Standard 2-leg stirrup

        for (const [size, area] of Object.entries(stirrupBars)) {
            const Av = numLegs * area;
            const spacing = Av / Av_s_required;

            if (spacing >= (units === 'SI' ? 75 : 3) && spacing <= (units === 'SI' ? 300 : 12)) {
                return {
                    stirrupSize: size,
                    spacing: Math.floor(spacing / (units === 'SI' ? 25 : 1)) * (units === 'SI' ? 25 : 1),
                    numLegs,
                    Av
                };
            }
        }

        // Default to minimum spacing
        const defaultSize = units === 'SI' ? '8mm' : '#3';
        const Av = numLegs * (units === 'SI' ? 50.3 : 0.11);

        return {
            stirrupSize: defaultSize,
            spacing: units === 'SI' ? 150 : 6,
            numLegs,
            Av
        };
    }

    // ============================================
    // FORMATTING
    // ============================================

    private static formatReinforcement(
        flexure: FlexureResult,
        shear: ShearResult,
        units: 'SI' | 'US'
    ): string {
        const mainBars = `${flexure.numBars}-${flexure.barSize} Bot`;
        const stirrups = units === 'SI'
            ? `${shear.stirrupSize}@${shear.spacing}mm c/c`
            : `${shear.stirrupSize}@${shear.spacing}in`;

        return `${mainBars}, ${stirrups} Stirrups`;
    }

    private static formatIS456(flexure: FlexureResult, shear: ShearResult): string {
        return `Ast = ${flexure.As_provided.toFixed(0)} mm², ` +
            `${flexure.numBars}T${flexure.barSize.replace('mm', '')} Bot, ` +
            `2L${shear.stirrupSize.replace('mm', '')}@${shear.spacing} c/c`;
    }

    private static formatACI(flexure: FlexureResult, shear: ShearResult): string {
        return `As = ${flexure.As_provided.toFixed(2)} in², ` +
            `${flexure.numBars}-${flexure.barSize} Bot, ` +
            `${shear.stirrupSize}@${shear.spacing}" Stirrups`;
    }

    /**
     * Get design summary
     */
    static getSummary(result: BeamDesignResult): string {
        const { flexure, shear } = result;

        return [
            `=== RC Beam Design Summary ===`,
            ``,
            `FLEXURE:`,
            `  As required: ${flexure.As_required.toFixed(1)}`,
            `  As provided: ${flexure.As_provided.toFixed(1)} (${flexure.numBars}-${flexure.barSize})`,
            `  Steel ratio ρ: ${(flexure.rho * 100).toFixed(2)}%`,
            `  Status: ${flexure.status}`,
            ``,
            `SHEAR:`,
            `  φVc: ${shear.phi_Vc.toFixed(2)}`,
            `  Vs required: ${shear.Vs_required.toFixed(2)}`,
            `  Stirrups: ${shear.stirrupSize}@${shear.spacing}`,
            `  Status: ${shear.status}`,
            ``,
            `REINFORCEMENT: ${result.reinforcementString}`
        ].join('\n');
    }
}

export default RCBeamDesigner;
