/**
 * Member Design Service
 * 
 * Provides comprehensive structural member design according to:
 * - IS 456:2000 (Indian Standard for Reinforced Concrete)
 * - IS 800:2007 (Indian Standard for Structural Steel)
 * - Eurocode 2 (EN 1992-1-1) for Concrete
 * - Eurocode 3 (EN 1993-1-1) for Steel
 * - ACI 318 (American Concrete Institute)
 * - AISC 360 (American Institute of Steel Construction)
 */

// ============================================
// TYPES
// ============================================

export interface MaterialProperties {
    type: 'concrete' | 'steel' | 'timber';
    grade: string;
    // Concrete
    fck?: number;    // Characteristic compressive strength (MPa)
    fcd?: number;    // Design compressive strength (MPa)
    Ec?: number;     // Modulus of elasticity (GPa)
    // Steel
    fy?: number;     // Yield strength (MPa)
    fu?: number;     // Ultimate strength (MPa)
    Es?: number;     // Modulus of elasticity (GPa)
    // Timber
    fb?: number;     // Bending strength (MPa)
    fc0?: number;    // Compression parallel to grain (MPa)
}

export interface SectionProperties {
    type: 'rectangular' | 'circular' | 'I-section' | 'hollow' | 'T-section';
    // Dimensions (mm)
    width?: number;      // b
    depth?: number;      // d or h
    flangeWidth?: number;
    flangeThickness?: number;
    webThickness?: number;
    diameter?: number;
    wallThickness?: number;
    // Computed properties
    area?: number;       // mm²
    Ix?: number;         // mm⁴
    Iy?: number;         // mm⁴
    Zx?: number;         // mm³ (elastic section modulus)
    Zy?: number;
    Sx?: number;         // mm³ (plastic section modulus)
    Sy?: number;
    rx?: number;         // mm (radius of gyration)
    ry?: number;
}

export interface MemberForces {
    axial: number;       // kN (+ tension, - compression)
    shearY: number;      // kN
    shearZ: number;      // kN
    momentY: number;     // kN·m
    momentZ: number;     // kN·m
    torsion: number;     // kN·m
}

export interface MemberGeometry {
    length: number;      // m
    effectiveLength?: number; // m (for buckling)
    kFactor?: number;    // Effective length factor (0.5 to 2.0)
    laterallyBraced?: boolean;
}

export interface DesignInput {
    memberId: string;
    memberType: 'beam' | 'column' | 'beam-column' | 'brace';
    material: MaterialProperties;
    section: SectionProperties;
    forces: MemberForces;
    geometry: MemberGeometry;
    code: 'IS456' | 'IS800' | 'EC2' | 'EC3' | 'ACI318' | 'AISC360';
}

export interface DesignCheck {
    name: string;
    description: string;
    demand: number;
    capacity: number;
    utilization: number;
    status: 'PASS' | 'FAIL' | 'WARNING';
    formula?: string;
    details?: string;
}

export interface DesignResult {
    memberId: string;
    overallStatus: 'PASS' | 'FAIL' | 'WARNING';
    overallUtilization: number;
    checks: DesignCheck[];
    recommendations?: string[];
    reinforcement?: ReinforcementDesign;
    warnings?: string[];
}

export interface ReinforcementDesign {
    // Longitudinal reinforcement
    mainBars: {
        diameter: number;      // mm
        count: number;
        area: number;         // mm²
        ratio: number;        // percentage
    };
    // Transverse reinforcement
    stirrups: {
        diameter: number;
        spacing: number;      // mm
        legs: number;
    };
    // Additional
    skinReinforcement?: {
        diameter: number;
        spacing: number;
    };
}

// ============================================
// DESIGN CONSTANTS
// ============================================

const PARTIAL_SAFETY_FACTORS = {
    IS456: { concrete: 1.5, steel: 1.15 },
    IS800: { steel: 1.10 },
    EC2: { concrete: 1.5, steel: 1.15 },
    EC3: { steel: 1.0 },
    ACI318: { concrete: 0.65, steel: 0.9 },  // Phi factors
    AISC360: { steel: 0.9 },
};

const MATERIAL_DEFAULTS = {
    concrete: {
        M20: { fck: 20, Ec: 22.4 },
        M25: { fck: 25, Ec: 25.0 },
        M30: { fck: 30, Ec: 27.4 },
        M35: { fck: 35, Ec: 29.6 },
        M40: { fck: 40, Ec: 31.6 },
        M45: { fck: 45, Ec: 33.5 },
        M50: { fck: 50, Ec: 35.4 },
    },
    steel: {
        Fe250: { fy: 250, fu: 410, Es: 200 },
        Fe415: { fy: 415, fu: 485, Es: 200 },
        Fe500: { fy: 500, fu: 545, Es: 200 },
        Fe550: { fy: 550, fu: 600, Es: 200 },
        S235: { fy: 235, fu: 360, Es: 210 },
        S275: { fy: 275, fu: 430, Es: 210 },
        S355: { fy: 355, fu: 510, Es: 210 },
        A36: { fy: 250, fu: 400, Es: 200 },
        A992: { fy: 345, fu: 450, Es: 200 },
    },
};

// ============================================
// MEMBER DESIGN SERVICE
// ============================================

export class MemberDesignService {
    
    /**
     * Design a structural member
     */
    static design(input: DesignInput): DesignResult {
        const checks: DesignCheck[] = [];
        const warnings: string[] = [];
        const recommendations: string[] = [];
        
        // Validate input
        if (!input.section.area) {
            input.section = this.computeSectionProperties(input.section);
        }
        
        // Perform checks based on member type
        switch (input.memberType) {
            case 'beam':
                checks.push(...this.designBeam(input));
                break;
            case 'column':
                checks.push(...this.designColumn(input));
                break;
            case 'beam-column':
                checks.push(...this.designBeamColumn(input));
                break;
            case 'brace':
                checks.push(...this.designBrace(input));
                break;
        }
        
        // Calculate overall utilization
        const overallUtilization = Math.max(...checks.map(c => c.utilization));
        const failedChecks = checks.filter(c => c.status === 'FAIL');
        const warningChecks = checks.filter(c => c.status === 'WARNING');
        
        let overallStatus: 'PASS' | 'FAIL' | 'WARNING' = 'PASS';
        if (failedChecks.length > 0) {
            overallStatus = 'FAIL';
        } else if (warningChecks.length > 0) {
            overallStatus = 'WARNING';
        }
        
        // Generate recommendations
        if (overallUtilization > 0.95) {
            recommendations.push('Consider increasing section size for better safety margin');
        }
        if (overallUtilization < 0.5) {
            recommendations.push('Section may be optimized for economy');
        }
        
        // Add reinforcement design for concrete
        let reinforcement: ReinforcementDesign | undefined;
        if (input.material.type === 'concrete') {
            reinforcement = this.designReinforcement(input);
        }
        
        return {
            memberId: input.memberId,
            overallStatus,
            overallUtilization,
            checks,
            recommendations,
            reinforcement,
            warnings,
        };
    }
    
    /**
     * Design beam member
     */
    private static designBeam(input: DesignInput): DesignCheck[] {
        const checks: DesignCheck[] = [];
        const { forces, section, material, geometry, code } = input;
        
        if (material.type === 'steel') {
            // Steel beam design
            checks.push(this.checkFlexuralStrength(input));
            checks.push(this.checkShearStrength(input));
            checks.push(this.checkDeflection(input));
            if (code === 'IS800' || code === 'EC3' || code === 'AISC360') {
                checks.push(this.checkLateralTorsionalBuckling(input));
            }
        } else if (material.type === 'concrete') {
            // Concrete beam design
            checks.push(this.checkFlexuralStrengthRC(input));
            checks.push(this.checkShearStrengthRC(input));
            checks.push(this.checkDeflectionRC(input));
            checks.push(this.checkCrackWidth(input));
        }
        
        return checks;
    }
    
    /**
     * Design column member
     */
    private static designColumn(input: DesignInput): DesignCheck[] {
        const checks: DesignCheck[] = [];
        const { forces, section, material, geometry, code } = input;
        
        if (material.type === 'steel') {
            checks.push(this.checkAxialCompression(input));
            checks.push(this.checkSlenderness(input));
            if (Math.abs(forces.momentY) > 0.01 || Math.abs(forces.momentZ) > 0.01) {
                checks.push(this.checkCombinedStresses(input));
            }
        } else if (material.type === 'concrete') {
            checks.push(this.checkAxialCapacityRC(input));
            checks.push(this.checkSlendernessRC(input));
            if (Math.abs(forces.momentY) > 0.01 || Math.abs(forces.momentZ) > 0.01) {
                checks.push(this.checkBiaxialBending(input));
            }
        }
        
        return checks;
    }
    
    /**
     * Design beam-column member
     */
    private static designBeamColumn(input: DesignInput): DesignCheck[] {
        const checks: DesignCheck[] = [];
        
        // Combine beam and column checks
        checks.push(...this.designBeam(input));
        checks.push(...this.designColumn(input));
        
        // Add interaction check
        checks.push(this.checkInteraction(input));
        
        return checks;
    }
    
    /**
     * Design brace member
     */
    private static designBrace(input: DesignInput): DesignCheck[] {
        const checks: DesignCheck[] = [];
        
        if (input.forces.axial > 0) {
            // Tension brace
            checks.push(this.checkTensionCapacity(input));
        } else {
            // Compression brace
            checks.push(this.checkAxialCompression(input));
        }
        
        checks.push(this.checkSlenderness(input));
        
        return checks;
    }
    
    // ============================================
    // STEEL DESIGN CHECKS
    // ============================================
    
    private static checkFlexuralStrength(input: DesignInput): DesignCheck {
        const { forces, section, material, code } = input;
        const M = Math.max(Math.abs(forces.momentY), Math.abs(forces.momentZ)) * 1e6; // N·mm
        const fy = material.fy || 250;
        const gamma = PARTIAL_SAFETY_FACTORS[code]?.steel || 1.1;
        
        // Plastic moment capacity
        const Sx = section.Sx || (section.width! * section.depth! * section.depth! / 4);
        const Mp = (fy / gamma) * Sx; // N·mm
        
        const utilization = M / Mp;
        
        return {
            name: 'Flexural Strength',
            description: 'Check bending moment capacity',
            demand: forces.momentZ,
            capacity: Mp / 1e6,
            utilization,
            status: utilization > 1.0 ? 'FAIL' : utilization > 0.9 ? 'WARNING' : 'PASS',
            formula: `M_d = f_y × S_x / γ_m = ${(fy).toFixed(0)} × ${(Sx/1e3).toFixed(0)} / ${gamma} = ${(Mp/1e6).toFixed(2)} kN·m`,
            details: `Applied moment: ${forces.momentZ.toFixed(2)} kN·m, Capacity: ${(Mp/1e6).toFixed(2)} kN·m`,
        };
    }
    
    private static checkShearStrength(input: DesignInput): DesignCheck {
        const { forces, section, material, code } = input;
        const V = Math.max(Math.abs(forces.shearY), Math.abs(forces.shearZ)) * 1e3; // N
        const fy = material.fy || 250;
        const gamma = PARTIAL_SAFETY_FACTORS[code]?.steel || 1.1;
        
        // Shear area (approximate for I-section: depth × web thickness)
        const Av = section.type === 'I-section' 
            ? section.depth! * (section.webThickness || section.width! * 0.1)
            : section.area! * 0.6;
        
        const Vp = (fy / (Math.sqrt(3) * gamma)) * Av; // N
        
        const utilization = V / Vp;
        
        return {
            name: 'Shear Strength',
            description: 'Check shear force capacity',
            demand: Math.max(Math.abs(forces.shearY), Math.abs(forces.shearZ)),
            capacity: Vp / 1e3,
            utilization,
            status: utilization > 1.0 ? 'FAIL' : utilization > 0.9 ? 'WARNING' : 'PASS',
            formula: `V_d = f_y × A_v / (√3 × γ_m)`,
        };
    }
    
    private static checkDeflection(input: DesignInput): DesignCheck {
        const { geometry, section, forces, material } = input;
        const L = geometry.length * 1000; // mm
        const limit = L / 360; // Typical limit for steel beams (L/360 for live load)
        
        // Calculate deflection using elastic beam theory
        // For uniform load approximation from max moment: w = 8*M/L²
        // δ_max = 5wL⁴/(384EI) = 5ML²/(48EI)
        const E = (material.Es || material.Ec || 200) * 1e3; // MPa
        const I = section.Ix || section.Iy || (section.depth! * Math.pow(section.width || section.depth!, 3) / 12);
        const M = Math.max(Math.abs(forces.momentY), Math.abs(forces.momentZ)) * 1e6; // N·mm
        const V = Math.max(Math.abs(forces.shearY), Math.abs(forces.shearZ)) * 1e3; // N
        
        let estimatedDeflection: number;
        if (M > 0 && I > 0) {
            // Equivalent uniform load from max moment: M = wL²/8, so w = 8M/L²
            // δ = 5wL⁴/(384EI) = 5ML²/(48EI)
            estimatedDeflection = (5 * M * L * L) / (48 * E * I);
        } else if (V > 0 && I > 0) {
            // From shear: w = 2V/L, δ = 5wL⁴/(384EI)
            const w = (2 * V) / L;
            estimatedDeflection = (5 * w * Math.pow(L, 4)) / (384 * E * I);
        } else {
            // Self-weight estimate: assume 1 kN/m distributed
            const w = 1.0; // N/mm
            estimatedDeflection = (5 * w * Math.pow(L, 4)) / (384 * E * I);
        }
        
        const utilization = estimatedDeflection / limit;
        
        return {
            name: 'Deflection Check',
            description: 'Check serviceability deflection limit',
            demand: estimatedDeflection,
            capacity: limit,
            utilization,
            status: utilization > 1.0 ? 'FAIL' : utilization > 0.9 ? 'WARNING' : 'PASS',
            formula: `δ = 5ML²/(48EI) = ${estimatedDeflection.toFixed(2)} mm ≤ L/360 = ${limit.toFixed(1)} mm`,
        };
    }
    
    private static checkLateralTorsionalBuckling(input: DesignInput): DesignCheck {
        const { forces, section, material, geometry, code } = input;
        const M = Math.abs(forces.momentZ) * 1e6;
        const fy = material.fy || 250;
        const E = (material.Es || 200) * 1e3; // MPa
        const L = geometry.length * 1000;
        
        // Simplified LTB check
        const Iy = section.Iy || (section.depth! * Math.pow(section.width!, 3) / 12);
        const ry = section.ry || Math.sqrt(Iy / section.area!);
        
        const lambdaLT = L / ry;
        const lambdaLT_limit = 0.4 * Math.sqrt(E / fy);
        
        let Mcr: number;
        if (geometry.laterallyBraced) {
            Mcr = (fy / 1.1) * (section.Sx || section.width! * section.depth! * section.depth! / 4);
        } else {
            // Elastic critical moment (simplified)
            Mcr = Math.PI * Math.PI * E * Iy / (L * L) * section.depth!;
        }
        
        const utilization = M / Mcr;
        
        return {
            name: 'Lateral Torsional Buckling',
            description: 'Check against lateral-torsional buckling',
            demand: forces.momentZ,
            capacity: Mcr / 1e6,
            utilization,
            status: utilization > 1.0 ? 'FAIL' : utilization > 0.9 ? 'WARNING' : 'PASS',
            formula: `λ_LT = ${lambdaLT.toFixed(1)} ${lambdaLT > lambdaLT_limit ? '> limit' : '< limit'}`,
        };
    }
    
    private static checkAxialCompression(input: DesignInput): DesignCheck {
        const { forces, section, material, geometry, code } = input;
        const P = Math.abs(forces.axial) * 1e3; // N
        const fy = material.fy || 250;
        const E = (material.Es || 200) * 1e3;
        const gamma = PARTIAL_SAFETY_FACTORS[code]?.steel || 1.1;
        
        const A = section.area!;
        const L = (geometry.effectiveLength || geometry.length * (geometry.kFactor || 1.0)) * 1000;
        const r = Math.min(section.rx || 50, section.ry || 50);
        
        // Slenderness ratio
        const lambda = L / r;
        
        // Euler buckling load
        const Pe = Math.PI * Math.PI * E * A / (lambda * lambda);
        
        // Design compression capacity (simplified)
        const alpha = 0.34; // Buckling curve 'b'
        const lambdaBar = lambda * Math.sqrt(fy / (Math.PI * Math.PI * E));
        const phi = 0.5 * (1 + alpha * (lambdaBar - 0.2) + lambdaBar * lambdaBar);
        const chi = 1 / (phi + Math.sqrt(phi * phi - lambdaBar * lambdaBar));
        
        const Pd = chi * fy * A / gamma; // N
        
        const utilization = P / Pd;
        
        return {
            name: 'Axial Compression',
            description: 'Check compression capacity with buckling',
            demand: Math.abs(forces.axial),
            capacity: Pd / 1e3,
            utilization,
            status: utilization > 1.0 ? 'FAIL' : utilization > 0.9 ? 'WARNING' : 'PASS',
            formula: `λ = ${lambda.toFixed(1)}, χ = ${chi.toFixed(3)}, P_d = ${(Pd/1e3).toFixed(1)} kN`,
        };
    }
    
    private static checkSlenderness(input: DesignInput): DesignCheck {
        const { section, geometry, memberType } = input;
        const L = (geometry.effectiveLength || geometry.length * (geometry.kFactor || 1.0)) * 1000;
        const r = Math.min(section.rx || 50, section.ry || 50);
        
        const lambda = L / r;
        
        // Slenderness limits
        let limit: number;
        switch (memberType) {
            case 'column':
                limit = 180;
                break;
            case 'brace':
                limit = 200;
                break;
            default:
                limit = 300;
        }
        
        const utilization = lambda / limit;
        
        return {
            name: 'Slenderness Check',
            description: 'Check member slenderness ratio',
            demand: lambda,
            capacity: limit,
            utilization,
            status: utilization > 1.0 ? 'FAIL' : utilization > 0.9 ? 'WARNING' : 'PASS',
            formula: `λ = L_eff / r_min = ${L.toFixed(0)} / ${r.toFixed(0)} = ${lambda.toFixed(1)} ≤ ${limit}`,
        };
    }
    
    private static checkTensionCapacity(input: DesignInput): DesignCheck {
        const { forces, section, material, code } = input;
        const T = forces.axial * 1e3; // N (positive = tension)
        const fy = material.fy || 250;
        const fu = material.fu || 400;
        const gamma = PARTIAL_SAFETY_FACTORS[code]?.steel || 1.1;
        
        const Ag = section.area!;
        const An = Ag * 0.85; // Net area (approximate with holes)
        
        // Tension capacity
        const Td1 = fy * Ag / gamma; // Yielding of gross section
        const Td2 = 0.9 * fu * An / gamma; // Rupture of net section
        const Td = Math.min(Td1, Td2);
        
        const utilization = T / Td;
        
        return {
            name: 'Tension Capacity',
            description: 'Check tension member capacity',
            demand: forces.axial,
            capacity: Td / 1e3,
            utilization,
            status: utilization > 1.0 ? 'FAIL' : utilization > 0.9 ? 'WARNING' : 'PASS',
            formula: `T_d = min(f_y×A_g, 0.9×f_u×A_n) / γ_m = ${(Td/1e3).toFixed(1)} kN`,
        };
    }
    
    private static checkCombinedStresses(input: DesignInput): DesignCheck {
        const { forces, section, material, geometry, code } = input;
        const P = Math.abs(forces.axial) * 1e3;
        const Mx = Math.abs(forces.momentY) * 1e6;
        const My = Math.abs(forces.momentZ) * 1e6;
        
        const fy = material.fy || 250;
        const gamma = PARTIAL_SAFETY_FACTORS[code]?.steel || 1.1;
        
        const A = section.area!;
        const Zx = section.Zx || section.width! * section.depth! * section.depth! / 6;
        const Zy = section.Zy || section.depth! * section.width! * section.width! / 6;
        
        // Combined stress check (simplified interaction)
        const fa = P / A;
        const fbx = Mx / Zx;
        const fby = My / Zy;
        const fd = fy / gamma;
        
        const interaction = fa/fd + fbx/fd + fby/fd;
        
        return {
            name: 'Combined Stress Check',
            description: 'Axial + biaxial bending interaction',
            demand: interaction,
            capacity: 1.0,
            utilization: interaction,
            status: interaction > 1.0 ? 'FAIL' : interaction > 0.9 ? 'WARNING' : 'PASS',
            formula: `P/P_d + M_x/M_dx + M_y/M_dy = ${interaction.toFixed(3)} ≤ 1.0`,
        };
    }
    
    private static checkInteraction(input: DesignInput): DesignCheck {
        // Same as combined stresses for now
        return this.checkCombinedStresses(input);
    }
    
    // ============================================
    // REINFORCED CONCRETE DESIGN CHECKS
    // ============================================
    
    private static checkFlexuralStrengthRC(input: DesignInput): DesignCheck {
        const { forces, section, material, code } = input;
        const Mu = Math.abs(forces.momentZ) * 1e6; // N·mm
        const fck = material.fck || 25;
        const fy = material.fy || 415; // Reinforcement
        
        const b = section.width!;
        const d = section.depth! - 50; // Effective depth (cover = 50mm)
        
        // Limiting moment capacity (balanced section)
        const xumax_d = code === 'IS456' ? 0.48 : 0.45; // Neutral axis limit
        const Mulim = 0.36 * fck * b * xumax_d * d * d * (1 - 0.42 * xumax_d);
        
        const utilization = Mu / Mulim;
        
        return {
            name: 'Flexural Strength (RC)',
            description: 'Check moment capacity of RC section',
            demand: forces.momentZ,
            capacity: Mulim / 1e6,
            utilization,
            status: utilization > 1.0 ? 'FAIL' : utilization > 0.9 ? 'WARNING' : 'PASS',
            formula: `M_ulim = 0.36×f_ck×b×x_umax×d×(1-0.42×x_umax/d) = ${(Mulim/1e6).toFixed(2)} kN·m`,
            details: Mu > Mulim ? 'Section requires compression reinforcement' : 'Singly reinforced section adequate',
        };
    }
    
    private static checkShearStrengthRC(input: DesignInput): DesignCheck {
        const { forces, section, material, code } = input;
        const Vu = Math.abs(forces.shearY) * 1e3; // N
        const fck = material.fck || 25;
        
        const b = section.width!;
        const d = section.depth! - 50;
        
        // Concrete shear capacity (assuming 0.5% steel)
        const tau_c = 0.25 * Math.sqrt(fck); // Simplified
        const Vc = tau_c * b * d;
        
        // Maximum shear capacity
        const tau_cmax = 0.62 * Math.sqrt(fck);
        const Vcmax = tau_cmax * b * d;
        
        const utilization = Vu / Vc;
        
        return {
            name: 'Shear Strength (RC)',
            description: 'Check shear capacity of RC section',
            demand: forces.shearY,
            capacity: Vc / 1e3,
            utilization,
            status: Vu > Vcmax ? 'FAIL' : utilization > 1.0 ? 'WARNING' : 'PASS',
            formula: `τ_c = ${tau_c.toFixed(2)} MPa, V_c = ${(Vc/1e3).toFixed(1)} kN`,
            details: Vu > Vc ? 'Shear reinforcement required' : 'Minimum shear reinforcement required',
        };
    }
    
    private static checkDeflectionRC(input: DesignInput): DesignCheck {
        const { geometry, section, material } = input;
        const L = geometry.length * 1000;
        const d = section.depth! - 50;
        
        // Span/depth ratio check (IS 456)
        const basicRatio = 20; // For simply supported beam
        const modificationFactor = 1.2; // Assumed for tension steel
        const allowableLD = basicRatio * modificationFactor;
        
        const actualLD = L / d;
        const utilization = actualLD / allowableLD;
        
        return {
            name: 'Deflection Check (RC)',
            description: 'Check span/depth ratio for deflection control',
            demand: actualLD,
            capacity: allowableLD,
            utilization,
            status: utilization > 1.0 ? 'FAIL' : utilization > 0.9 ? 'WARNING' : 'PASS',
            formula: `L/d = ${actualLD.toFixed(1)} ≤ ${allowableLD.toFixed(1)}`,
        };
    }
    
    private static checkCrackWidth(input: DesignInput): DesignCheck {
        const { forces, section, material, geometry } = input;
        // Crack width calculation per IS 456:2000 Annex F / EC2 Section 7.3
        // w_k = S_r,max × (ε_sm - ε_cm)
        
        // Exposure-based limits
        const limit = 0.3; // mm for normal exposure (moderate: 0.3, severe: 0.2)
        
        const fck = material.fck || 25; // MPa
        const fy = material.fy || 415; // MPa
        const Es = (material.Es || 200) * 1e3; // MPa
        const Ec = (material.Ec || (5000 * Math.sqrt(fck))) ; // MPa (IS 456 clause 6.2.3.1)
        const d = section.depth || 500; // mm
        const b = section.width || 300; // mm
        
        // Effective depth & reinforcement estimate
        const cover = 40; // mm nominal cover
        const d_eff = d - cover - 10; // effective depth (assuming 20mm bars)
        const barDia = 16; // mm assumed bar diameter
        
        // Moment at section
        const M = Math.max(Math.abs(forces.momentY), Math.abs(forces.momentZ)) * 1e6; // N·mm
        
        // Estimate steel area from equilibrium: As ≈ M / (0.87 × fy × 0.9 × d)
        const As_est = M > 0 ? M / (0.87 * fy * 0.9 * d_eff) : (0.8 / 100) * b * d_eff; // min steel
        
        // Steel stress under service loads (approximately 0.58 × fy for factored → service)
        const fs = M > 0 ? Math.min(M / (As_est * 0.9 * d_eff), 0.8 * fy) : 0.58 * fy;
        
        // Strain in steel
        const epsilon_s = fs / Es;
        
        // Mean strain accounting for tension stiffening (EC2 7.3.4)
        const rho_eff = As_est / (b * Math.min(2.5 * (d - d_eff + cover + barDia / 2), d / 2));
        const fct_eff = 0.7 * Math.sqrt(fck); // Mean tensile strength approximation
        const kt = 0.4; // Long-term loading factor
        const epsilon_sm_minus_cm = Math.max(
            epsilon_s - kt * (fct_eff / (rho_eff * Es)) * (1 + Es / Ec * rho_eff),
            0.6 * epsilon_s
        );
        
        // Maximum crack spacing (IS 456 / EC2)
        // S_r,max = 3.4c + 0.425 × k1 × k2 × φ / ρ_eff
        const k1 = 0.8; // High bond bars
        const k2 = 0.5; // Bending
        const Sr_max = 3.4 * cover + 0.425 * k1 * k2 * barDia / rho_eff;
        
        // Crack width
        const estimated = Sr_max * epsilon_sm_minus_cm;
        
        const utilization = estimated / limit;
        
        return {
            name: 'Crack Width Check',
            description: 'Check serviceability crack width (IS 456 Annex F / EC2 7.3)',
            demand: Math.round(estimated * 1000) / 1000,
            capacity: limit,
            utilization,
            status: utilization > 1.0 ? 'FAIL' : utilization > 0.9 ? 'WARNING' : 'PASS',
            formula: `w_k = S_r,max × (ε_sm - ε_cm) = ${estimated.toFixed(3)} mm ≤ ${limit} mm`,
        };
    }
    
    private static checkAxialCapacityRC(input: DesignInput): DesignCheck {
        const { forces, section, material, code } = input;
        const Pu = Math.abs(forces.axial) * 1e3;
        const fck = material.fck || 25;
        const fy = material.fy || 415;
        
        const Ag = section.area!;
        const pMin = 0.8 / 100; // 0.8% minimum
        const Asc = pMin * Ag;
        const Ac = Ag - Asc;
        
        // Axial capacity with minimum eccentricity
        const Puz = 0.45 * fck * Ac + 0.75 * fy * Asc;
        
        // Reduced capacity for accidental eccentricity
        const Pd = 0.8 * Puz;
        
        const utilization = Pu / Pd;
        
        return {
            name: 'Axial Capacity (RC)',
            description: 'Check axial load capacity of RC column',
            demand: Math.abs(forces.axial),
            capacity: Pd / 1e3,
            utilization,
            status: utilization > 1.0 ? 'FAIL' : utilization > 0.9 ? 'WARNING' : 'PASS',
            formula: `P_uz = 0.45×f_ck×A_c + 0.75×f_y×A_sc = ${(Puz/1e3).toFixed(1)} kN`,
        };
    }
    
    private static checkSlendernessRC(input: DesignInput): DesignCheck {
        const { geometry, section } = input;
        const L = geometry.effectiveLength || geometry.length * (geometry.kFactor || 1.0);
        const D = Math.min(section.width!, section.depth!);
        
        const lambda = L * 1000 / D;
        const limit = 12; // Short column limit
        
        const utilization = lambda / 60; // Max slenderness = 60
        
        return {
            name: 'Slenderness (RC)',
            description: 'Check column slenderness ratio',
            demand: lambda,
            capacity: limit,
            utilization,
            status: lambda > 60 ? 'FAIL' : lambda > limit ? 'WARNING' : 'PASS',
            formula: `λ = L_eff/D = ${lambda.toFixed(1)} ${lambda <= 12 ? '(Short column)' : '(Slender column)'}`,
            details: lambda > 12 ? 'Additional moment due to slenderness required' : 'Short column - no slenderness effects',
        };
    }
    
    private static checkBiaxialBending(input: DesignInput): DesignCheck {
        const { forces, section, material } = input;
        const Pu = Math.abs(forces.axial) * 1e3;
        const Mux = Math.abs(forces.momentY) * 1e6;
        const Muy = Math.abs(forces.momentZ) * 1e6;
        const fck = material.fck || 25;
        const fy = material.fy || 415;
        
        // Simplified interaction (Bresler equation)
        const b = section.width!;
        const D = section.depth!;
        const d = D - 50;
        
        // Uniaxial capacities (approximate)
        const Mux1 = 0.87 * fy * 0.02 * b * D * 0.9 * d;
        const Muy1 = 0.87 * fy * 0.02 * b * D * 0.9 * (b - 50);
        const Puz = 0.45 * fck * b * D * 0.98 + 0.75 * fy * 0.02 * b * D;
        
        const ratio = Pu / Puz;
        const alphan = ratio > 0.2 ? 1 + (ratio - 0.2) / 0.6 : 1.0;
        
        const interaction = Math.pow(Mux / Mux1, alphan) + Math.pow(Muy / Muy1, alphan);
        
        return {
            name: 'Biaxial Bending',
            description: 'Check biaxial bending interaction',
            demand: interaction,
            capacity: 1.0,
            utilization: interaction,
            status: interaction > 1.0 ? 'FAIL' : interaction > 0.9 ? 'WARNING' : 'PASS',
            formula: `(M_ux/M_ux1)^α_n + (M_uy/M_uy1)^α_n = ${interaction.toFixed(3)} ≤ 1.0`,
        };
    }
    
    // ============================================
    // REINFORCEMENT DESIGN
    // ============================================
    
    private static designReinforcement(input: DesignInput): ReinforcementDesign {
        const { forces, section, material, memberType } = input;
        const fck = material.fck || 25;
        const fy = material.fy || 415;
        
        const b = section.width!;
        const D = section.depth!;
        const d = D - 50; // Effective depth
        
        let mainBars: ReinforcementDesign['mainBars'];
        let stirrups: ReinforcementDesign['stirrups'];
        
        if (memberType === 'beam') {
            // Beam reinforcement
            const Mu = Math.abs(forces.momentZ) * 1e6;
            
            // Required area of tension steel
            const R = Mu / (b * d * d);
            const pt = 50 * (1 - Math.sqrt(1 - 4.6 * R / fck)) * fck / fy;
            const Ast = Math.max(pt * b * d / 100, 0.85 * b * d / fy * 100); // Minimum steel
            
            // Select bars
            const barDia = Ast > 1500 ? 20 : Ast > 800 ? 16 : 12;
            const barArea = Math.PI * barDia * barDia / 4;
            const numBars = Math.ceil(Ast / barArea);
            
            mainBars = {
                diameter: barDia,
                count: numBars,
                area: numBars * barArea,
                ratio: (numBars * barArea) / (b * d) * 100,
            };
            
            // Stirrup design
            const Vu = Math.abs(forces.shearY) * 1e3;
            const tau_c = 0.25 * Math.sqrt(fck);
            const Vc = tau_c * b * d;
            const Vus = Math.max(Vu - Vc, 0);
            
            const stirrupDia = 8;
            const legs = 2;
            const Asv = legs * Math.PI * stirrupDia * stirrupDia / 4;
            const spacing = Vus > 0 
                ? Math.min(0.87 * fy * Asv * d / Vus, 0.75 * d, 300)
                : Math.min(0.75 * d, 300);
            
            stirrups = {
                diameter: stirrupDia,
                spacing: Math.round(spacing / 25) * 25, // Round to 25mm
                legs,
            };
            
        } else {
            // Column reinforcement
            const pMin = 0.8; // 0.8% minimum
            const Asc = pMin * b * D / 100;
            
            const barDia = Asc > 2000 ? 20 : 16;
            const barArea = Math.PI * barDia * barDia / 4;
            const numBars = Math.max(Math.ceil(Asc / barArea), 4); // Minimum 4 bars
            
            mainBars = {
                diameter: barDia,
                count: numBars,
                area: numBars * barArea,
                ratio: (numBars * barArea) / (b * D) * 100,
            };
            
            // Ties
            const tieDia = Math.max(barDia / 4, 6);
            const tieSpacing = Math.min(16 * barDia, b, 300);
            
            stirrups = {
                diameter: Math.round(tieDia),
                spacing: Math.round(tieSpacing / 25) * 25,
                legs: 2,
            };
        }
        
        return { mainBars, stirrups };
    }
    
    // ============================================
    // SECTION PROPERTIES
    // ============================================
    
    private static computeSectionProperties(section: SectionProperties): SectionProperties {
        const computed = { ...section };
        
        switch (section.type) {
            case 'rectangular':
                const b = section.width!;
                const h = section.depth!;
                computed.area = b * h;
                computed.Ix = b * h * h * h / 12;
                computed.Iy = h * b * b * b / 12;
                computed.Zx = b * h * h / 6;
                computed.Zy = h * b * b / 6;
                computed.Sx = b * h * h / 4;
                computed.Sy = h * b * b / 4;
                computed.rx = h / Math.sqrt(12);
                computed.ry = b / Math.sqrt(12);
                break;
                
            case 'circular':
                const d = section.diameter!;
                const r = d / 2;
                computed.area = Math.PI * r * r;
                computed.Ix = Math.PI * r * r * r * r / 4;
                computed.Iy = computed.Ix;
                computed.Zx = Math.PI * r * r * r / 4;
                computed.Zy = computed.Zx;
                computed.Sx = d * d * d / 6;
                computed.Sy = computed.Sx;
                computed.rx = r / 2;
                computed.ry = computed.rx;
                break;
                
            case 'I-section':
                // Approximate for standard I-sections
                const bf = section.flangeWidth || section.width!;
                const tf = section.flangeThickness || section.width! * 0.15;
                const tw = section.webThickness || section.width! * 0.1;
                const hw = section.depth! - 2 * tf;
                
                computed.area = 2 * bf * tf + hw * tw;
                computed.Ix = 2 * (bf * tf * tf * tf / 12 + bf * tf * Math.pow(hw/2 + tf/2, 2)) + tw * hw * hw * hw / 12;
                computed.Iy = 2 * tf * bf * bf * bf / 12 + hw * tw * tw * tw / 12;
                computed.Zx = computed.Ix / (section.depth! / 2);
                computed.Zy = computed.Iy / (bf / 2);
                computed.rx = Math.sqrt(computed.Ix / computed.area);
                computed.ry = Math.sqrt(computed.Iy / computed.area);
                break;
                
            case 'hollow':
                const D = section.diameter!;
                const t = section.wallThickness!;
                const Di = D - 2 * t;
                computed.area = Math.PI * (D * D - Di * Di) / 4;
                computed.Ix = Math.PI * (Math.pow(D, 4) - Math.pow(Di, 4)) / 64;
                computed.Iy = computed.Ix;
                computed.rx = Math.sqrt(computed.Ix / computed.area);
                computed.ry = computed.rx;
                break;
        }
        
        return computed;
    }
}

export default MemberDesignService;
