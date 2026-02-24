/**
 * Eurocode3Checker.ts
 * 
 * EN 1993-1-1:2005 Steel Design Code Implementation
 * Design of Steel Structures - General Rules
 * 
 * Unlocks EU Market ($5B+ industry)
 * 
 * Features:
 * - Section 5: Structural Analysis
 * - Section 6: Ultimate Limit States
 *   - 6.2: Cross-section resistance
 *   - 6.3: Buckling resistance
 * - Partial factors per National Annex (default γM0=1.0, γM1=1.0)
 */

import { auditTrail } from '../AuditTrailService';

// ============================================
// TYPES
// ============================================

export interface EC3Section {
    name: string;
    type: 'IPE' | 'HEA' | 'HEB' | 'HEM' | 'UB' | 'UC' | 'UPN' | 'L';
    h: number;      // Height (mm)
    b: number;      // Width (mm)
    tw: number;     // Web thickness (mm)
    tf: number;     // Flange thickness (mm)
    r: number;      // Root radius (mm)
    A: number;      // Area (cm²)
    Iy: number;     // Strong axis I (cm⁴)
    Iz: number;     // Weak axis I (cm⁴)
    Wpl_y: number;  // Plastic modulus - strong (cm³)
    Wpl_z: number;  // Plastic modulus - weak (cm³)
    Wel_y: number;  // Elastic modulus - strong (cm³)
    Wel_z: number;  // Elastic modulus - weak (cm³)
    iy: number;     // Radius of gyration - strong (cm)
    iz: number;     // Radius of gyration - weak (cm)
    It?: number;    // Torsion constant (cm⁴)
    Iw?: number;    // Warping constant (cm⁶)
}

export interface EC3Material {
    grade: 'S235' | 'S275' | 'S355' | 'S420' | 'S460';
    fy: number;     // Yield strength (N/mm²)
    fu: number;     // Ultimate strength (N/mm²)
    E: number;      // Elastic modulus (N/mm²)
    G: number;      // Shear modulus (N/mm²)
}

export interface EC3Member {
    section: EC3Section;
    material: EC3Material;
    Lcr_y: number;    // Buckling length - strong (mm)
    Lcr_z: number;    // Buckling length - weak (mm)
    L_LT?: number;    // Lateral-torsional buckling length (mm)
    C1?: number;      // Moment distribution factor
}

export interface EC3Forces {
    NEd: number;      // Design axial (kN), negative = compression
    My_Ed: number;    // Design moment - strong (kN·m)
    Mz_Ed: number;    // Design moment - weak (kN·m)
    VEd: number;      // Design shear (kN)
}

export interface EC3Check {
    clause: string;
    title: string;
    NRd?: number;     // Design axial resistance
    MRd?: number;     // Design moment resistance
    VRd?: number;     // Design shear resistance
    ratio: number;
    status: 'OK' | 'NG' | 'CHECK';
    equation?: string;
}

// ============================================
// EC3 MATERIAL DATABASE  
// ============================================

export const EC3_MATERIALS: Record<string, EC3Material> = {
    'S235': { grade: 'S235', fy: 235, fu: 360, E: 210000, G: 81000 },
    'S275': { grade: 'S275', fy: 275, fu: 430, E: 210000, G: 81000 },
    'S355': { grade: 'S355', fy: 355, fu: 510, E: 210000, G: 81000 },
    'S420': { grade: 'S420', fy: 420, fu: 520, E: 210000, G: 81000 },
    'S460': { grade: 'S460', fy: 460, fu: 540, E: 210000, G: 81000 },
};

// ============================================
// EUROPEAN I-SECTIONS DATABASE
// ============================================

export const IPE_SECTIONS: Record<string, EC3Section> = {
    'IPE200': {
        name: 'IPE200', type: 'IPE',
        h: 200, b: 100, tw: 5.6, tf: 8.5, r: 12,
        A: 28.5, Iy: 1943, Iz: 142, Wpl_y: 221, Wpl_z: 44.6,
        Wel_y: 194, Wel_z: 28.5, iy: 8.26, iz: 2.24, It: 6.98
    },
    'IPE240': {
        name: 'IPE240', type: 'IPE',
        h: 240, b: 120, tw: 6.2, tf: 9.8, r: 15,
        A: 39.1, Iy: 3892, Iz: 284, Wpl_y: 367, Wpl_z: 73.9,
        Wel_y: 324, Wel_z: 47.3, iy: 9.97, iz: 2.69, It: 12.9
    },
    'IPE300': {
        name: 'IPE300', type: 'IPE',
        h: 300, b: 150, tw: 7.1, tf: 10.7, r: 15,
        A: 53.8, Iy: 8356, Iz: 604, Wpl_y: 628, Wpl_z: 125,
        Wel_y: 557, Wel_z: 80.5, iy: 12.5, iz: 3.35, It: 20.1
    },
    'IPE360': {
        name: 'IPE360', type: 'IPE',
        h: 360, b: 170, tw: 8.0, tf: 12.7, r: 18,
        A: 72.7, Iy: 16270, Iz: 1043, Wpl_y: 1019, Wpl_z: 191,
        Wel_y: 904, Wel_z: 123, iy: 15.0, iz: 3.79, It: 37.3
    },
    'IPE400': {
        name: 'IPE400', type: 'IPE',
        h: 400, b: 180, tw: 8.6, tf: 13.5, r: 21,
        A: 84.5, Iy: 23130, Iz: 1318, Wpl_y: 1307, Wpl_z: 229,
        Wel_y: 1156, Wel_z: 146, iy: 16.5, iz: 3.95, It: 51.1
    },
    'IPE500': {
        name: 'IPE500', type: 'IPE',
        h: 500, b: 200, tw: 10.2, tf: 16.0, r: 21,
        A: 116, Iy: 48200, Iz: 2142, Wpl_y: 2194, Wpl_z: 335,
        Wel_y: 1928, Wel_z: 214, iy: 20.4, iz: 4.31, It: 89.3
    },
    'IPE600': {
        name: 'IPE600', type: 'IPE',
        h: 600, b: 220, tw: 12.0, tf: 19.0, r: 24,
        A: 156, Iy: 92080, Iz: 3387, Wpl_y: 3512, Wpl_z: 485,
        Wel_y: 3069, Wel_z: 308, iy: 24.3, iz: 4.66, It: 165
    },
};

export const HE_SECTIONS: Record<string, EC3Section> = {
    'HEA200': {
        name: 'HEA200', type: 'HEA',
        h: 190, b: 200, tw: 6.5, tf: 10, r: 18,
        A: 53.8, Iy: 3692, Iz: 1336, Wpl_y: 429, Wpl_z: 203,
        Wel_y: 389, Wel_z: 134, iy: 8.28, iz: 4.98, It: 21.0
    },
    'HEA300': {
        name: 'HEA300', type: 'HEA',
        h: 290, b: 300, tw: 8.5, tf: 14, r: 27,
        A: 112, Iy: 18260, Iz: 6310, Wpl_y: 1383, Wpl_z: 641,
        Wel_y: 1260, Wel_z: 421, iy: 12.7, iz: 7.49, It: 85.2
    },
    'HEB200': {
        name: 'HEB200', type: 'HEB',
        h: 200, b: 200, tw: 9.0, tf: 15, r: 18,
        A: 78.1, Iy: 5696, Iz: 2003, Wpl_y: 642, Wpl_z: 305,
        Wel_y: 570, Wel_z: 200, iy: 8.54, iz: 5.07, It: 59.3
    },
    'HEB300': {
        name: 'HEB300', type: 'HEB',
        h: 300, b: 300, tw: 11.0, tf: 19, r: 27,
        A: 149, Iy: 25170, Iz: 8563, Wpl_y: 1869, Wpl_z: 870,
        Wel_y: 1678, Wel_z: 571, iy: 13.0, iz: 7.58, It: 185
    },
};

// ============================================
// EUROCODE 3 CHECKER CLASS
// ============================================

export class Eurocode3Checker {
    // Partial safety factors (can be adjusted per National Annex)
    private γM0 = 1.00;  // Cross-section resistance
    private γM1 = 1.00;  // Member buckling
    private γM2 = 1.25;  // Net section in tension

    constructor(nationalAnnex?: 'UK' | 'DE' | 'FR' | 'IT') {
        // Adjust partial factors based on National Annex
        if (nationalAnnex === 'UK') {
            this.γM0 = 1.00;
            this.γM1 = 1.00;
        } else if (nationalAnnex === 'DE') {
            this.γM0 = 1.00;
            this.γM1 = 1.10;
        }
    }

    /**
     * Run all applicable checks
     */
    checkMember(member: EC3Member, forces: EC3Forces): EC3Check[] {
        const checks: EC3Check[] = [];

        // 6.2.3: Tension
        if (forces.NEd > 0) {
            checks.push(this.checkTension(member, forces.NEd));
        }

        // 6.2.4: Compression
        if (forces.NEd < 0) {
            checks.push(this.checkCompression(member, Math.abs(forces.NEd)));
            // 6.3.1: Buckling resistance
            checks.push(this.checkBuckling(member, Math.abs(forces.NEd)));
        }

        // 6.2.5: Bending 
        if (Math.abs(forces.My_Ed) > 0.01) {
            checks.push(this.checkBending(member, forces.My_Ed, 'y'));
            // 6.3.2: Lateral-torsional buckling
            checks.push(this.checkLTB(member, forces.My_Ed));
        }

        // 6.2.6: Shear
        if (Math.abs(forces.VEd) > 0.01) {
            checks.push(this.checkShear(member, forces.VEd));
        }

        // 6.2.9: Combined bending and axial
        if (Math.abs(forces.NEd) > 0.01 && Math.abs(forces.My_Ed) > 0.01) {
            checks.push(this.checkCombined(member, forces));
        }

        // Log to audit trail
        const maxRatio = Math.max(...checks.map(c => c.ratio));
        auditTrail.log('design_check', 'EC3',
            `EN 1993-1-1 check: ${member.section.name}, max ratio ${(maxRatio * 100).toFixed(1)}%`,
            { aiGenerated: false, metadata: { checks, maxRatio } }
        );

        return checks;
    }

    /**
     * 6.2.3: Tension Resistance
     */
    checkTension(member: EC3Member, NEd: number): EC3Check {
        const { section, material } = member;
        const A = section.A * 100; // cm² to mm²
        const fy = material.fy;

        // 6.2.3(2): Npl,Rd
        const Npl_Rd = (A * fy / this.γM0) / 1000; // kN

        return {
            clause: '6.2.3',
            title: 'Tension Resistance',
            NRd: Npl_Rd,
            ratio: NEd / Npl_Rd,
            status: NEd <= Npl_Rd ? 'OK' : 'NG',
            equation: 'Npl,Rd = A·fy / γM0'
        };
    }

    /**
     * 6.2.4: Compression Resistance (Cross-section)
     */
    checkCompression(member: EC3Member, NEd: number): EC3Check {
        const { section, material } = member;
        const A = section.A * 100;
        const fy = material.fy;

        // 6.2.4(2): Nc,Rd for Class 1, 2, 3
        const Nc_Rd = (A * fy / this.γM0) / 1000;

        return {
            clause: '6.2.4',
            title: 'Compression (Cross-section)',
            NRd: Nc_Rd,
            ratio: NEd / Nc_Rd,
            status: NEd <= Nc_Rd ? 'OK' : 'NG',
            equation: 'Nc,Rd = A·fy / γM0'
        };
    }

    /**
     * 6.3.1: Flexural Buckling
     */
    checkBuckling(member: EC3Member, NEd: number): EC3Check {
        const { section, material, Lcr_y, Lcr_z } = member;
        const A = section.A * 100;
        const fy = material.fy;
        const E = material.E;

        // Buckling about weak axis usually governs
        const iy = section.iy * 10; // cm to mm
        const iz = section.iz * 10;

        // 6.3.1.2: Non-dimensional slenderness
        const λ1 = Math.PI * Math.sqrt(E / fy);
        const λ_y = (Lcr_y / iy) / λ1;
        const λ_z = (Lcr_z / iz) / λ1;
        const λ_bar = Math.max(λ_y, λ_z);

        // 6.3.1.2(1): Buckling curve selection (simplified - curve 'b')
        const α = 0.34; // Curve b for rolled H-sections about weak axis

        // 6.3.1.2(1): Reduction factor χ
        const Φ = 0.5 * (1 + α * (λ_bar - 0.2) + λ_bar ** 2);
        const χ = Math.min(1.0, 1 / (Φ + Math.sqrt(Φ ** 2 - λ_bar ** 2)));

        // 6.3.1.1(3): Nb,Rd
        const Nb_Rd = (χ * A * fy / this.γM1) / 1000;

        return {
            clause: '6.3.1',
            title: 'Flexural Buckling',
            NRd: Nb_Rd,
            ratio: NEd / Nb_Rd,
            status: NEd <= Nb_Rd ? 'OK' : 'NG',
            equation: 'Nb,Rd = χ·A·fy / γM1'
        };
    }

    /**
     * 6.2.5: Bending Moment Resistance
     */
    checkBending(member: EC3Member, My_Ed: number, axis: 'y' | 'z'): EC3Check {
        const { section, material } = member;
        const fy = material.fy;

        // For Class 1 or 2 sections (plastic)
        const Wpl = axis === 'y' ? section.Wpl_y * 1000 : section.Wpl_z * 1000; // cm³ to mm³

        // 6.2.5(2): Mpl,Rd
        const Mpl_Rd = (Wpl * fy / this.γM0) / 1e6; // kN·m

        return {
            clause: '6.2.5',
            title: `Bending (${axis}-axis)`,
            MRd: Mpl_Rd,
            ratio: Math.abs(My_Ed) / Mpl_Rd,
            status: Math.abs(My_Ed) <= Mpl_Rd ? 'OK' : 'NG',
            equation: 'Mpl,Rd = Wpl·fy / γM0'
        };
    }

    /**
     * 6.3.2: Lateral-Torsional Buckling
     */
    checkLTB(member: EC3Member, My_Ed: number): EC3Check {
        const { section, material } = member;
        const fy = material.fy;
        const E = material.E;
        const G = material.G;

        // For I-sections: simplified approach (6.3.2.3)
        const Wy = section.Wpl_y * 1000; // mm³
        const Iz = section.Iz * 10000;   // mm⁴
        const It = (section.It || 1) * 10000; // mm⁴
        const L = member.L_LT || member.Lcr_z;
        const C1 = member.C1 || 1.0;

        // 6.3.2.2: Mcr - Elastic critical moment (simplified)
        const Mcr = C1 * (Math.PI ** 2 * E * Iz / (L ** 2)) *
            Math.sqrt(It / Iz + (L ** 2 * G * It) / (Math.PI ** 2 * E * Iz)) / 1e6; // kN·m

        // 6.3.2.2(1): Non-dimensional slenderness
        const λ_LT = Math.sqrt(Wy * fy / 1e6 / Mcr);

        // 6.3.2.3: Reduction factor χLT (curve 'b')
        const αLT = 0.34;
        const λLT_0 = 0.4; // Plateau length
        const β = 0.75;

        const Φ_LT = 0.5 * (1 + αLT * (λ_LT - λLT_0) + β * λ_LT ** 2);
        const χ_LT = Math.min(1.0, 1 / (Φ_LT + Math.sqrt(Φ_LT ** 2 - β * λ_LT ** 2)));

        // 6.3.2.1(3): Mb,Rd
        const Mb_Rd = (χ_LT * Wy * fy / this.γM1) / 1e6;

        return {
            clause: '6.3.2',
            title: 'Lateral-Torsional Buckling',
            MRd: Mb_Rd,
            ratio: Math.abs(My_Ed) / Mb_Rd,
            status: Math.abs(My_Ed) <= Mb_Rd ? 'OK' : 'NG',
            equation: 'Mb,Rd = χLT·Wy·fy / γM1'
        };
    }

    /**
     * 6.2.6: Shear Resistance
     */
    checkShear(member: EC3Member, VEd: number): EC3Check {
        const { section, material } = member;
        const fy = material.fy;

        // Shear area for I-sections: Av = A - 2btf + (tw + 2r)tf
        const { h, b, tw, tf, r, A } = section;
        const Av = A * 100 - 2 * b * tf + (tw + 2 * r) * tf; // mm²

        // 6.2.6(2): Vpl,Rd
        const Vpl_Rd = (Av * (fy / Math.sqrt(3)) / this.γM0) / 1000; // kN

        return {
            clause: '6.2.6',
            title: 'Shear Resistance',
            VRd: Vpl_Rd,
            ratio: Math.abs(VEd) / Vpl_Rd,
            status: Math.abs(VEd) <= Vpl_Rd ? 'OK' : 'NG',
            equation: 'Vpl,Rd = Av·(fy/√3) / γM0'
        };
    }

    /**
     * 6.2.9: Combined Bending and Axial Force
     */
    checkCombined(member: EC3Member, forces: EC3Forces): EC3Check {
        const { section, material } = member;
        const { NEd, My_Ed, Mz_Ed } = forces;
        const fy = material.fy;

        const A = section.A * 100;
        const Wpl_y = section.Wpl_y * 1000;
        const Wpl_z = section.Wpl_z * 1000;

        const Npl_Rd = (A * fy / this.γM0) / 1000;
        const Mpl_y_Rd = (Wpl_y * fy / this.γM0) / 1e6;
        const Mpl_z_Rd = (Wpl_z * fy / this.γM0) / 1e6;

        // 6.2.9.1(5): Criterion for I-sections
        const n = Math.abs(NEd) / Npl_Rd;
        const a = Math.min((A - 2 * section.b * section.tf) / A, 0.5);

        // Simplified interaction check
        const ratio = n + Math.abs(My_Ed) / Mpl_y_Rd + Math.abs(Mz_Ed || 0) / Mpl_z_Rd;

        return {
            clause: '6.2.9',
            title: 'Combined N + M',
            ratio: ratio,
            status: ratio <= 1.0 ? 'OK' : 'NG',
            equation: 'NEd/Npl + My,Ed/Mpl,y + Mz,Ed/Mpl,z ≤ 1.0'
        };
    }

    /**
     * Quick check for IPE section
     */
    quickCheck(
        sectionName: string,
        Lcr_mm: number,
        NEd_kN: number,
        My_Ed_kNm: number,
        VEd_kN: number
    ): { passed: boolean; maxRatio: number; critical: string; checks: EC3Check[] } {
        const section = IPE_SECTIONS[sectionName] || HE_SECTIONS[sectionName];
        if (!section) {
            throw new Error(`Unknown section: ${sectionName}`);
        }

        const member: EC3Member = {
            section,
            material: EC3_MATERIALS['S355'],
            Lcr_y: Lcr_mm,
            Lcr_z: Lcr_mm,
            L_LT: Lcr_mm
        };

        const forces: EC3Forces = {
            NEd: NEd_kN,
            My_Ed: My_Ed_kNm,
            Mz_Ed: 0,
            VEd: VEd_kN
        };

        const checks = this.checkMember(member, forces);
        const maxCheck = checks.reduce((max, c) => c.ratio > max.ratio ? c : max, checks[0]);

        return {
            passed: maxCheck.ratio <= 1.0,
            maxRatio: maxCheck.ratio,
            critical: maxCheck.title,
            checks
        };
    }

    /**
     * Generate report
     */
    generateReport(member: EC3Member, checks: EC3Check[]): string {
        let report = `## EN 1993-1-1 Design Check Report\n\n`;
        report += `**Section:** ${member.section.name}\n`;
        report += `**Material:** ${member.material.grade} (fy = ${member.material.fy} N/mm²)\n`;
        report += `**Buckling Length:** ${member.Lcr_y} mm\n\n`;

        report += `### Results Summary\n\n`;
        report += `| Clause | Check | Ratio | Status |\n`;
        report += `|--------|-------|-------|--------|\n`;

        for (const check of checks) {
            const statusEmoji = check.status === 'OK' ? '✅' : '❌';
            report += `| ${check.clause} | ${check.title} | ${(check.ratio * 100).toFixed(1)}% | ${statusEmoji} |\n`;
        }

        const maxRatio = Math.max(...checks.map(c => c.ratio));
        report += `\n**Maximum Utilization:** ${(maxRatio * 100).toFixed(1)}%\n`;

        return report;
    }
}

// ============================================
// SINGLETON
// ============================================

export const eurocode3 = new Eurocode3Checker();

export default Eurocode3Checker;
