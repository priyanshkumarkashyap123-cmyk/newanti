/**
 * TwoWaySlabDesign.ts - Flat Slab and Two-Way Slab Design
 * 
 * Design methods:
 * - Direct Design Method (DDM)
 * - Equivalent Frame Method
 * - Punching shear checks
 * - Deflection verification
 * 
 * Codes: ACI 318-19, IS 456:2000
 */

// ============================================
// TYPES
// ============================================

export interface SlabGeometry {
    Lx: number;          // Span in x-direction (m)
    Ly: number;          // Span in y-direction (m)
    thickness: number;   // Slab thickness (mm)
    cover: number;       // Clear cover (mm)
    dx: number;          // Effective depth x (mm)
    dy: number;          // Effective depth y (mm)
}

export interface SlabLoading {
    deadLoad: number;    // kN/m²
    liveLoad: number;    // kN/m²
    factored: number;    // Factored total (kN/m²)
}

export interface SlabMaterial {
    fc: number;          // Concrete strength (MPa)
    fy: number;          // Steel yield (MPa)
}

export interface ColumnDimensions {
    c1: number;          // Column dimension parallel to L1 (mm)
    c2: number;          // Column dimension parallel to L2 (mm)
}

export interface SlabMoments {
    totalMoment: number; // kN·m/m
    negativeMoment: number;
    positiveMoment: number;
    columnStrip: {
        negative: number;
        positive: number;
    };
    middleStrip: {
        negative: number;
        positive: number;
    };
}

export interface PunchingCheck {
    Vu: number;          // Factored shear (kN)
    Vc: number;          // Concrete shear capacity (kN)
    ratio: number;
    status: 'PASS' | 'FAIL' | 'NEEDS_REINFORCEMENT';
    shearReinforcement?: {
        required: boolean;
        Av: number;      // mm²
        spacing: number; // mm
    };
}

export interface SlabReinforcement {
    direction: 'x' | 'y';
    location: 'top' | 'bottom';
    strip: 'column' | 'middle';
    As: number;          // mm²/m
    barDia: number;      // mm
    spacing: number;     // mm
}

// ============================================
// TWO-WAY SLAB DESIGNER
// ============================================

export class TwoWaySlabDesigner {
    private phi_flexure = 0.90;
    private phi_shear = 0.75;

    /**
     * Design slab using Direct Design Method (ACI 318-19 Chapter 8)
     */
    designDirectMethod(
        geometry: SlabGeometry,
        loading: SlabLoading,
        material: SlabMaterial,
        column: ColumnDimensions,
        isInterior: boolean = true
    ): {
        moments: SlabMoments;
        reinforcement: SlabReinforcement[];
        punchingCheck: PunchingCheck;
        deflectionOK: boolean;
    } {
        // Check DDM applicability
        const ratio = geometry.Ly / geometry.Lx;
        if (ratio > 2 || ratio < 0.5) {
            throw new Error('DDM not applicable: span ratio > 2');
        }

        // Calculate total static moment (Mo)
        const ln = geometry.Lx - column.c1 / 1000; // Clear span
        const Mo = (loading.factored * geometry.Ly * ln ** 2) / 8;

        // Distribute moments (ACI Table 8.10.4.2)
        const negFactor = isInterior ? 0.65 : 0.70;
        const posFactor = isInterior ? 0.35 : 0.57;

        const negativeMoment = negFactor * Mo;
        const positiveMoment = posFactor * Mo;

        // Column/middle strip distribution
        const l2l1 = geometry.Ly / geometry.Lx;
        const alphaF = 0; // No edge beams for flat slab

        const colStripNegPercent = this.getColumnStripPercent(l2l1, alphaF, true);
        const colStripPosPercent = this.getColumnStripPercent(l2l1, alphaF, false);

        const moments: SlabMoments = {
            totalMoment: Mo,
            negativeMoment,
            positiveMoment,
            columnStrip: {
                negative: negativeMoment * colStripNegPercent,
                positive: positiveMoment * colStripPosPercent
            },
            middleStrip: {
                negative: negativeMoment * (1 - colStripNegPercent),
                positive: positiveMoment * (1 - colStripPosPercent)
            }
        };

        // Design reinforcement
        const reinforcement = this.designReinforcement(geometry, moments, material);

        // Punching shear check
        const punchingCheck = this.checkPunchingShear(
            geometry, loading, material, column, isInterior
        );

        // Deflection check (span/depth)
        const deflectionOK = this.checkDeflection(geometry, loading, material);

        return { moments, reinforcement, punchingCheck, deflectionOK };
    }

    /**
     * Check punching shear (ACI 318-19 22.6)
     */
    checkPunchingShear(
        geometry: SlabGeometry,
        loading: SlabLoading,
        material: SlabMaterial,
        column: ColumnDimensions,
        isInterior: boolean
    ): PunchingCheck {
        const d = (geometry.dx + geometry.dy) / 2;

        // Critical perimeter at d/2 from column face
        const b0 = isInterior
            ? 2 * (column.c1 + d) + 2 * (column.c2 + d)
            : (column.c1 + d) + 2 * (column.c2 + d / 2);

        // Factored shear
        const tributaryArea = geometry.Lx * geometry.Ly;
        const Vu = loading.factored * tributaryArea;

        // Concrete shear capacity (ACI 22.6.5)
        const beta = Math.max(column.c1, column.c2) / Math.min(column.c1, column.c2);
        const alphaS = isInterior ? 40 : 30;

        const vc1 = 0.33 * Math.sqrt(material.fc);
        const vc2 = (0.17 * (1 + 2 / beta)) * Math.sqrt(material.fc);
        const vc3 = (0.083 * (alphaS * d / b0 + 2)) * Math.sqrt(material.fc);

        const vc = Math.min(vc1, vc2, vc3);
        const Vc = this.phi_shear * vc * b0 * d / 1000;

        const ratio = Vu / Vc;
        let status: PunchingCheck['status'] = 'PASS';
        let shearReinforcement;

        if (ratio > 1.0) {
            if (ratio > 1.5) {
                status = 'FAIL';
            } else {
                status = 'NEEDS_REINFORCEMENT';
                // Calculate shear reinforcement
                const Vs = Vu - Vc;
                const Av = (Vs * 1000) / (0.87 * 500 * d); // per mm
                shearReinforcement = {
                    required: true,
                    Av: Av * 100, // per 100mm
                    spacing: 100
                };
            }
        }

        return { Vu, Vc, ratio, status, shearReinforcement };
    }

    /**
     * Design reinforcement for each strip
     */
    private designReinforcement(
        geometry: SlabGeometry,
        moments: SlabMoments,
        material: SlabMaterial
    ): SlabReinforcement[] {
        const reinforcement: SlabReinforcement[] = [];

        // Column strip - negative (top)
        reinforcement.push(this.calcReinforcement(
            moments.columnStrip.negative,
            geometry.dx,
            material,
            'x', 'top', 'column',
            geometry.Ly / 4
        ));

        // Column strip - positive (bottom)
        reinforcement.push(this.calcReinforcement(
            moments.columnStrip.positive,
            geometry.dx,
            material,
            'x', 'bottom', 'column',
            geometry.Ly / 4
        ));

        // Middle strip - negative
        reinforcement.push(this.calcReinforcement(
            moments.middleStrip.negative,
            geometry.dy,
            material,
            'y', 'top', 'middle',
            geometry.Ly / 2
        ));

        // Middle strip - positive
        reinforcement.push(this.calcReinforcement(
            moments.middleStrip.positive,
            geometry.dy,
            material,
            'y', 'bottom', 'middle',
            geometry.Ly / 2
        ));

        return reinforcement;
    }

    private calcReinforcement(
        Mu: number,
        d: number,
        material: SlabMaterial,
        direction: 'x' | 'y',
        location: 'top' | 'bottom',
        strip: 'column' | 'middle',
        stripWidth: number
    ): SlabReinforcement {
        const b = stripWidth * 1000; // mm
        const fc = material.fc;
        const fy = material.fy;

        // Calculate As required
        const Rn = (Mu * 1e6) / (this.phi_flexure * b * d ** 2);
        const rho = (0.85 * fc / fy) * (1 - Math.sqrt(1 - 2 * Rn / (0.85 * fc)));

        // Minimum reinforcement
        const rhoMin = Math.max(0.0018, 1.4 / fy);
        const rhoDesign = Math.max(rho, rhoMin);

        const As = rhoDesign * b * d; // total mm²
        const AsPerMeter = As / stripWidth; // mm²/m

        // Select bar and spacing
        const barDia = AsPerMeter > 500 ? 12 : 10;
        const barArea = Math.PI * barDia ** 2 / 4;
        const spacing = Math.min(200, Math.floor(1000 * barArea / AsPerMeter));

        return {
            direction,
            location,
            strip,
            As: AsPerMeter,
            barDia,
            spacing
        };
    }

    private getColumnStripPercent(l2l1: number, alphaF: number, isNegative: boolean): number {
        // Simplified from ACI Table 8.10.5.2
        if (isNegative) {
            return l2l1 >= 1 ? 0.75 : 0.60 + 0.15 * l2l1;
        } else {
            return l2l1 >= 1 ? 0.60 : 0.50 + 0.10 * l2l1;
        }
    }

    private checkDeflection(
        geometry: SlabGeometry,
        loading: SlabLoading,
        material: SlabMaterial
    ): boolean {
        // Simplified check using span/depth ratio
        const lnMin = Math.min(geometry.Lx, geometry.Ly) * 1000;
        const requiredD = lnMin / 30; // For flat slabs without edge beams

        return geometry.thickness >= requiredD;
    }

    /**
     * IS 456:2000 Coefficient Method for Two-Way Slabs
     */
    designIS456CoefficientMethod(
        Lx: number,    // Short span (m)
        Ly: number,    // Long span (m)
        w: number,     // Total factored load (kN/m²)
        edgeConditions: 'all_simply_supported' | 'one_edge_continuous' | 'two_edges_continuous' | 'all_edges_continuous',
        material: SlabMaterial
    ): {
        Mx: number;    // Moment in short span direction
        My: number;    // Moment in long span direction
        d: number;     // Required effective depth
    } {
        const ratio = Ly / Lx;

        // Bending moment coefficients (IS 456 Table 26)
        const coefficients = this.getIS456Coefficients(ratio, edgeConditions);

        const Mx = coefficients.alphaX * w * Lx ** 2;
        const My = coefficients.alphaY * w * Lx ** 2;

        // Required depth from moment
        const Mu_max = Math.max(Mx, My);
        const d = Math.sqrt((Mu_max * 1e6) / (0.138 * material.fc * 1000));

        return { Mx, My, d };
    }

    private getIS456Coefficients(
        ratio: number,
        edge: string
    ): { alphaX: number; alphaY: number } {
        // Simplified coefficients
        const r = Math.min(ratio, 2.0);

        if (edge === 'all_simply_supported') {
            return {
                alphaX: 0.045 + 0.005 * r,
                alphaY: 0.035 + 0.004 * r
            };
        }
        // All edges continuous (more typical)
        return {
            alphaX: 0.032 + 0.003 * r,
            alphaY: 0.024 + 0.002 * r
        };
    }
}

// Export singleton
export const twoWaySlab = new TwoWaySlabDesigner();
export default TwoWaySlabDesigner;
