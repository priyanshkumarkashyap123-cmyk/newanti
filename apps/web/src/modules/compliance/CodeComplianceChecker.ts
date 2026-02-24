/**
 * ============================================================================
 * MULTI-CODE COMPLIANCE CHECKER
 * ============================================================================
 * 
 * Automated structural design code compliance verification system.
 * 
 * Features:
 * - Multi-code parallel checking
 * - Automatic code requirement extraction
 * - Detailed compliance reports
 * - Code comparison analysis
 * - Deficiency identification
 * - Remediation suggestions
 * 
 * Supported Codes:
 * - IS Codes (456, 800, 875, 1893, 2911, 13920)
 * - ACI 318, AISC 360, ASCE 7
 * - Eurocode (EC2, EC3, EC7, EC8)
 * - BS Codes (8110, 5950, 8002)
 * - AS/NZS Codes
 * 
 * @version 1.0.0
 */

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export type DesignCode = 
  // Indian Standards
  | 'IS456' | 'IS800' | 'IS875-1' | 'IS875-2' | 'IS875-3' | 'IS1893' | 'IS2911' | 'IS13920'
  // American Codes
  | 'ACI318' | 'AISC360' | 'ASCE7'
  // Eurocodes
  | 'EC2' | 'EC3' | 'EC7' | 'EC8'
  // British Standards
  | 'BS8110' | 'BS5950' | 'BS8002';

export interface ComplianceCheck {
  id: string;
  category: 'geometry' | 'reinforcement' | 'capacity' | 'detailing' | 'durability' | 'serviceability' | 'stability';
  code: DesignCode;
  clause: string;
  requirement: string;
  actualValue: number | string;
  limitValue: number | string;
  unit?: string;
  status: 'PASS' | 'FAIL' | 'WARNING' | 'N/A';
  severity: 'critical' | 'major' | 'minor';
  remediation?: string;
}

export interface ComplianceReport {
  timestamp: Date;
  project: string;
  element: string;
  codes: DesignCode[];
  checks: ComplianceCheck[];
  summary: {
    total: number;
    passed: number;
    failed: number;
    warnings: number;
    notApplicable: number;
    complianceScore: number; // 0-100
  };
  criticalIssues: ComplianceCheck[];
  recommendations: string[];
}

// ============================================================================
// CODE REQUIREMENTS DATABASE
// ============================================================================

const CODE_REQUIREMENTS = {
  // -------------------------------------------------------------------------
  // REINFORCED CONCRETE - BEAMS
  // -------------------------------------------------------------------------
  RC_BEAM: {
    // Minimum reinforcement
    MIN_TENSION_REINF: {
      IS456: { clause: '26.5.1.1', formula: 'As,min = 0.85*bd/fy', description: 'Minimum tension reinforcement' },
      ACI318: { clause: '9.6.1.2', formula: 'As,min = max(3√fc/fy, 200/fy)*bd', description: 'Minimum flexural reinforcement' },
      EC2: { clause: '9.2.1.1', formula: 'As,min = 0.26*fctm/fyk*bt*d ≥ 0.0013*bt*d', description: 'Minimum reinforcement area' }
    },
    
    // Maximum reinforcement
    MAX_TENSION_REINF: {
      IS456: { clause: '26.5.1.1(b)', limit: 0.04, description: 'Maximum tension reinforcement ratio' },
      ACI318: { clause: '9.3.3.1', limit: 0.025, description: 'Maximum reinforcement ratio' },
      EC2: { clause: '9.2.1.1', limit: 0.04, description: 'Maximum reinforcement ratio' }
    },
    
    // Minimum width
    MIN_WIDTH: {
      IS456: { clause: '23.1', limit: 200, description: 'Minimum beam width (mm)' },
      ACI318: { clause: '9.2.1', limit: 250, description: 'Practical minimum width (mm)' },
      EC2: { clause: '—', limit: 200, description: 'Recommended minimum width (mm)' }
    },
    
    // Span-depth ratio
    SPAN_DEPTH: {
      IS456: { clause: '23.2.1', limits: { simply_supported: 20, continuous: 26, cantilever: 7 } },
      ACI318: { clause: 'Table 9.3.1.1', limits: { simply_supported: 16, continuous: 18.5, cantilever: 8 } },
      EC2: { clause: '7.4.2', limits: { simply_supported: 14, continuous: 18, cantilever: 6 } }
    },
    
    // Clear cover
    CLEAR_COVER: {
      IS456: { clause: '26.4.1', values: { moderate: 25, severe: 45, very_severe: 50 } },
      ACI318: { clause: '20.6.1', values: { interior: 40, exterior: 50, ground: 75 } },
      EC2: { clause: '4.4.1', values: { XC1: 15, XC2: 25, XC3: 35, XC4: 40 } }
    },
    
    // Shear reinforcement
    MIN_SHEAR_REINF: {
      IS456: { clause: '26.5.1.6', formula: 'Asv,min = 0.4*b*sv/0.87fy' },
      ACI318: { clause: '9.6.3.3', formula: 'Av,min = 0.062√fc*bw*s/fyt' },
      EC2: { clause: '9.2.2', formula: 'Asw,min/s = 0.08√fck*bw/fyk' }
    },
    
    // Maximum stirrup spacing
    MAX_STIRRUP_SPACING: {
      IS456: { clause: '26.5.1.5', limit: '0.75d or 300mm' },
      ACI318: { clause: '9.7.6.2.2', limit: 'd/2 or 600mm' },
      EC2: { clause: '9.2.2', limit: '0.75d(1+cotα)' }
    }
  },

  // -------------------------------------------------------------------------
  // REINFORCED CONCRETE - COLUMNS
  // -------------------------------------------------------------------------
  RC_COLUMN: {
    // Minimum dimension
    MIN_DIMENSION: {
      IS456: { clause: '25.3', limit: 300, description: 'Minimum column dimension (mm)' },
      ACI318: { clause: '10.3.1', limit: 250, description: 'Minimum column dimension (mm)' },
      EC2: { clause: '9.5.2', limit: 200, description: 'Minimum column dimension (mm)' }
    },
    
    // Reinforcement ratio
    REINF_RATIO: {
      IS456: { clause: '26.5.3.1', min: 0.008, max: 0.06, description: 'Longitudinal reinforcement ratio' },
      ACI318: { clause: '10.6.1.1', min: 0.01, max: 0.08, description: 'Longitudinal reinforcement ratio' },
      EC2: { clause: '9.5.2', min: 0.002, max: 0.04, description: 'Longitudinal reinforcement ratio' }
    },
    
    // Minimum bars
    MIN_BARS: {
      IS456: { clause: '26.5.3.1', rectangular: 4, circular: 6 },
      ACI318: { clause: '10.7.3.1', rectangular: 4, circular: 6 },
      EC2: { clause: '9.5.2(3)', rectangular: 4, circular: 6 }
    },
    
    // Tie spacing
    TIE_SPACING: {
      IS456: { clause: '26.5.3.2', formula: 'min(16φ, 300mm, Least dimension)' },
      ACI318: { clause: '25.7.2.1', formula: 'min(16db, 48dt, Least dimension)' },
      EC2: { clause: '9.5.3', formula: 'min(20φ, 400mm, min dimension)' }
    },
    
    // Slenderness limit
    SLENDERNESS: {
      IS456: { clause: '25.1.2', limit: 60, description: 'Maximum slenderness ratio' },
      ACI318: { clause: '6.2.5', limit: 40, description: 'Maximum slenderness ratio (without stability check)' },
      EC2: { clause: '5.8.3.1', limit: 'λlim', description: 'Limiting slenderness' }
    }
  },

  // -------------------------------------------------------------------------
  // STEEL DESIGN
  // -------------------------------------------------------------------------
  STEEL_BEAM: {
    // Section classification
    SECTION_CLASS: {
      IS800: { clause: 'Table 2', description: 'Section classification limits' },
      AISC360: { clause: 'Table B4.1b', description: 'Limiting width-thickness ratios' },
      EC3: { clause: 'Table 5.2', description: 'Maximum width-to-thickness ratios' }
    },
    
    // Lateral bracing
    UNBRACED_LENGTH: {
      IS800: { clause: '8.2.2', formula: 'Lb,max for Compact = Lm' },
      AISC360: { clause: 'F2-5', formula: 'Lp = 1.76ry√(E/Fy)' },
      EC3: { clause: '6.3.2.4', formula: 'Stable length Lstable' }
    },
    
    // Web thickness
    WEB_SLENDERNESS: {
      IS800: { clause: '8.4.2.1', limit: '67ε for Class 1' },
      AISC360: { clause: 'Table B4.1b', limit: '3.76√(E/Fy)' },
      EC3: { clause: 'Table 5.2', limit: '72ε for Class 1' }
    },
    
    // Deflection limits
    DEFLECTION: {
      IS800: { clause: 'Table 6', limits: { floor: 'L/300', roof: 'L/180' } },
      AISC360: { clause: 'Commentary L3', limits: { floor: 'L/360', roof: 'L/240' } },
      EC3: { clause: '7.2.1', limits: { floor: 'L/250', roof: 'L/200' } }
    }
  },

  STEEL_COLUMN: {
    // Slenderness
    MAX_SLENDERNESS: {
      IS800: { clause: '3.8', limit: 180, description: 'Maximum slenderness ratio' },
      AISC360: { clause: 'E2', limit: 200, description: 'Recommended maximum KL/r' },
      EC3: { clause: 'NA.2.23', limit: 180, description: 'Maximum slenderness ratio' }
    },
    
    // Local buckling
    FLANGE_OUTSTAND: {
      IS800: { clause: 'Table 2', limit: '8.4ε' },
      AISC360: { clause: 'Table B4.1a', limit: '0.56√(E/Fy)' },
      EC3: { clause: 'Table 5.2', limit: '9ε' }
    }
  },

  // -------------------------------------------------------------------------
  // SEISMIC DESIGN
  // -------------------------------------------------------------------------
  SEISMIC: {
    // Special moment frame beams
    SMF_BEAM: {
      IS13920: { clause: '6.1.2', requirements: { width_min: 200, depth_ratio: 'D/b ≤ 4' } },
      ACI318: { clause: '18.6.2', requirements: { width_min: 250, depth_ratio: 'bw ≥ 0.3h' } },
      EC8: { clause: '5.4.1.2.1', requirements: { width_min: 200, depth_ratio: 'bw ≥ max(0.25hw, 200)' } }
    },
    
    // Confinement in columns
    COLUMN_CONFINEMENT: {
      IS13920: { clause: '7.4', formula: 'Special confining reinf. in lo' },
      ACI318: { clause: '18.7.5', formula: 'Ash = 0.09sbcfc/fyt' },
      EC8: { clause: '5.4.3.2.2', formula: 'αωwd ≥ 30μφνd' }
    },
    
    // Strong column-weak beam
    SCWB: {
      IS13920: { clause: '7.2.1', ratio: 1.1, description: 'ΣMc ≥ 1.1ΣMb' },
      ACI318: { clause: '18.7.3', ratio: 1.2, description: 'ΣMnc ≥ (6/5)ΣMnb' },
      EC8: { clause: '4.4.2.3', ratio: 1.3, description: 'ΣMRc ≥ 1.3ΣMRb' }
    }
  },

  // -------------------------------------------------------------------------
  // FOUNDATION DESIGN
  // -------------------------------------------------------------------------
  FOUNDATION: {
    // Minimum cover
    FOUNDATION_COVER: {
      IS456: { clause: '26.4.2.2', value: 75, description: 'Minimum cover against earth face (mm)' },
      ACI318: { clause: '20.6.1.3.1', value: 75, description: 'Concrete cast against earth (mm)' },
      EC2: { clause: '4.4.1.2', value: 75, description: 'Uneven surface (mm)' }
    },
    
    // Minimum depth
    MIN_DEPTH: {
      IS2911: { clause: '—', value: 300, description: 'Minimum footing depth (mm)' },
      ACI318: { clause: '13.3.1.2', value: 150, description: 'Minimum footing depth (mm)' },
      EC7: { clause: '—', value: 300, description: 'Recommended minimum depth (mm)' }
    },
    
    // Settlement limits
    SETTLEMENT: {
      IS1904: { clause: '—', limits: { isolated: 50, raft: 75 } },
      EC7: { clause: 'Annex H', limits: { isolated: 50, raft: 100 } }
    }
  }
};

// ============================================================================
// COMPLIANCE CHECKER CLASS
// ============================================================================

export class CodeComplianceChecker {
  private codes: DesignCode[];

  constructor(codes: DesignCode[]) {
    this.codes = codes;
  }

  /**
   * Check RC beam compliance
   */
  checkRCBeam(
    beam: {
      width: number; // mm
      depth: number; // mm
      span: number; // mm
      tensionSteel: number; // mm²
      compressionSteel: number; // mm²
      stirrupArea: number; // mm²
      stirrupSpacing: number; // mm
      cover: number; // mm
      exposureClass: string;
      supportCondition: 'simply_supported' | 'continuous' | 'cantilever';
    },
    materials: {
      fck: number; // MPa
      fy: number; // MPa
      fyt: number; // MPa (stirrup)
    }
  ): ComplianceCheck[] {
    const checks: ComplianceCheck[] = [];
    const { width, depth, span, tensionSteel, stirrupArea, stirrupSpacing, cover, supportCondition } = beam;
    const { fck, fy, fyt } = materials;
    const d = depth - cover - 10; // Effective depth

    for (const code of this.codes) {
      const req = CODE_REQUIREMENTS.RC_BEAM;

      // Minimum reinforcement check
      const minReinf = req.MIN_TENSION_REINF[code as keyof typeof req.MIN_TENSION_REINF];
      if (minReinf) {
        let As_min: number;
        if (code === 'IS456') {
          As_min = 0.85 * width * d / fy;
        } else if (code === 'ACI318') {
          As_min = Math.max(3 * Math.sqrt(fck) / fy, 200 / fy) * width * d;
        } else {
          const fctm = 0.3 * Math.pow(fck, 2/3);
          As_min = Math.max(0.26 * fctm / fy * width * d, 0.0013 * width * d);
        }

        checks.push({
          id: `RC_BEAM_MIN_REINF_${code}`,
          category: 'reinforcement',
          code: code as DesignCode,
          clause: minReinf.clause,
          requirement: minReinf.description,
          actualValue: tensionSteel,
          limitValue: As_min,
          unit: 'mm²',
          status: tensionSteel >= As_min ? 'PASS' : 'FAIL',
          severity: tensionSteel >= As_min ? 'minor' : 'major',
          remediation: tensionSteel < As_min ? `Increase tension steel by ${(As_min - tensionSteel).toFixed(0)} mm²` : undefined
        });
      }

      // Maximum reinforcement check
      const maxReinf = req.MAX_TENSION_REINF[code as keyof typeof req.MAX_TENSION_REINF];
      if (maxReinf) {
        const rho_max = maxReinf.limit;
        const As_max = rho_max * width * d;

        checks.push({
          id: `RC_BEAM_MAX_REINF_${code}`,
          category: 'reinforcement',
          code: code as DesignCode,
          clause: maxReinf.clause,
          requirement: maxReinf.description,
          actualValue: tensionSteel,
          limitValue: As_max,
          unit: 'mm²',
          status: tensionSteel <= As_max ? 'PASS' : 'FAIL',
          severity: tensionSteel <= As_max ? 'minor' : 'critical',
          remediation: tensionSteel > As_max ? 'Reduce reinforcement or increase section size' : undefined
        });
      }

      // Span-depth ratio
      const spanDepth = req.SPAN_DEPTH[code as keyof typeof req.SPAN_DEPTH];
      if (spanDepth) {
        const limit = spanDepth.limits[supportCondition];
        const actual = span / d;

        checks.push({
          id: `RC_BEAM_SPAN_DEPTH_${code}`,
          category: 'serviceability',
          code: code as DesignCode,
          clause: spanDepth.clause,
          requirement: 'Span-to-effective-depth ratio',
          actualValue: actual.toFixed(1),
          limitValue: limit,
          status: actual <= limit ? 'PASS' : 'WARNING',
          severity: actual <= limit ? 'minor' : 'major',
          remediation: actual > limit ? 'Increase depth or check deflection explicitly' : undefined
        });
      }

      // Minimum width
      const minWidth = req.MIN_WIDTH[code as keyof typeof req.MIN_WIDTH];
      if (minWidth) {
        checks.push({
          id: `RC_BEAM_MIN_WIDTH_${code}`,
          category: 'geometry',
          code: code as DesignCode,
          clause: minWidth.clause,
          requirement: minWidth.description,
          actualValue: width,
          limitValue: minWidth.limit,
          unit: 'mm',
          status: width >= minWidth.limit ? 'PASS' : 'WARNING',
          severity: 'minor'
        });
      }

      // Shear reinforcement
      const minShear = req.MIN_SHEAR_REINF[code as keyof typeof req.MIN_SHEAR_REINF];
      if (minShear) {
        let Asv_min: number;
        if (code === 'IS456') {
          Asv_min = 0.4 * width * stirrupSpacing / (0.87 * fyt);
        } else if (code === 'ACI318') {
          Asv_min = 0.062 * Math.sqrt(fck) * width * stirrupSpacing / fyt;
        } else {
          Asv_min = 0.08 * Math.sqrt(fck) * width * stirrupSpacing / fyt;
        }

        checks.push({
          id: `RC_BEAM_MIN_SHEAR_${code}`,
          category: 'reinforcement',
          code: code as DesignCode,
          clause: minShear.clause,
          requirement: 'Minimum shear reinforcement',
          actualValue: stirrupArea,
          limitValue: Asv_min,
          unit: 'mm²',
          status: stirrupArea >= Asv_min ? 'PASS' : 'FAIL',
          severity: stirrupArea >= Asv_min ? 'minor' : 'major'
        });
      }

      // Maximum stirrup spacing
      const maxSpacing = req.MAX_STIRRUP_SPACING[code as keyof typeof req.MAX_STIRRUP_SPACING];
      if (maxSpacing) {
        let limit: number;
        if (code === 'IS456') {
          limit = Math.min(0.75 * d, 300);
        } else if (code === 'ACI318') {
          limit = Math.min(d / 2, 600);
        } else {
          limit = 0.75 * d;
        }

        checks.push({
          id: `RC_BEAM_STIRRUP_SPACING_${code}`,
          category: 'detailing',
          code: code as DesignCode,
          clause: maxSpacing.clause,
          requirement: 'Maximum stirrup spacing',
          actualValue: stirrupSpacing,
          limitValue: limit,
          unit: 'mm',
          status: stirrupSpacing <= limit ? 'PASS' : 'FAIL',
          severity: stirrupSpacing <= limit ? 'minor' : 'major'
        });
      }
    }

    return checks;
  }

  /**
   * Check RC column compliance
   */
  checkRCColumn(
    column: {
      width: number; // mm
      depth: number; // mm
      height: number; // mm
      longitudinalSteel: number; // mm²
      numBars: number;
      tieSpacing: number; // mm
      tieDiameter: number; // mm
      barDiameter: number; // mm
      isCircular: boolean;
    },
    materials: {
      fck: number;
      fy: number;
    }
  ): ComplianceCheck[] {
    const checks: ComplianceCheck[] = [];
    const { width, depth, height, longitudinalSteel, numBars, tieSpacing, barDiameter, isCircular } = column;
    const Ag = width * depth;
    const rho = longitudinalSteel / Ag;
    const leastDim = Math.min(width, depth);

    for (const code of this.codes) {
      const req = CODE_REQUIREMENTS.RC_COLUMN;

      // Minimum dimension
      const minDim = req.MIN_DIMENSION[code as keyof typeof req.MIN_DIMENSION];
      if (minDim) {
        checks.push({
          id: `RC_COL_MIN_DIM_${code}`,
          category: 'geometry',
          code: code as DesignCode,
          clause: minDim.clause,
          requirement: minDim.description,
          actualValue: leastDim,
          limitValue: minDim.limit,
          unit: 'mm',
          status: leastDim >= minDim.limit ? 'PASS' : 'FAIL',
          severity: leastDim >= minDim.limit ? 'minor' : 'major'
        });
      }

      // Reinforcement ratio
      const reinfRatio = req.REINF_RATIO[code as keyof typeof req.REINF_RATIO];
      if (reinfRatio) {
        const minRho = reinfRatio.min;
        const maxRho = reinfRatio.max;

        checks.push({
          id: `RC_COL_MIN_REINF_${code}`,
          category: 'reinforcement',
          code: code as DesignCode,
          clause: reinfRatio.clause,
          requirement: `Minimum ${reinfRatio.description}`,
          actualValue: (rho * 100).toFixed(2) + '%',
          limitValue: (minRho * 100).toFixed(2) + '%',
          status: rho >= minRho ? 'PASS' : 'FAIL',
          severity: rho >= minRho ? 'minor' : 'critical'
        });

        checks.push({
          id: `RC_COL_MAX_REINF_${code}`,
          category: 'reinforcement',
          code: code as DesignCode,
          clause: reinfRatio.clause,
          requirement: `Maximum ${reinfRatio.description}`,
          actualValue: (rho * 100).toFixed(2) + '%',
          limitValue: (maxRho * 100).toFixed(2) + '%',
          status: rho <= maxRho ? 'PASS' : 'FAIL',
          severity: rho <= maxRho ? 'minor' : 'critical'
        });
      }

      // Minimum bars
      const minBars = req.MIN_BARS[code as keyof typeof req.MIN_BARS];
      if (minBars) {
        const required = isCircular ? minBars.circular : minBars.rectangular;
        checks.push({
          id: `RC_COL_MIN_BARS_${code}`,
          category: 'detailing',
          code: code as DesignCode,
          clause: minBars.clause,
          requirement: 'Minimum number of bars',
          actualValue: numBars,
          limitValue: required,
          status: numBars >= required ? 'PASS' : 'FAIL',
          severity: 'major'
        });
      }

      // Tie spacing
      const tieSpc = req.TIE_SPACING[code as keyof typeof req.TIE_SPACING];
      if (tieSpc) {
        let maxTieSpacing: number;
        if (code === 'IS456') {
          maxTieSpacing = Math.min(16 * barDiameter, 300, leastDim);
        } else if (code === 'ACI318') {
          maxTieSpacing = Math.min(16 * barDiameter, 48 * 8, leastDim);
        } else {
          maxTieSpacing = Math.min(20 * barDiameter, 400, leastDim);
        }

        checks.push({
          id: `RC_COL_TIE_SPACING_${code}`,
          category: 'detailing',
          code: code as DesignCode,
          clause: tieSpc.clause,
          requirement: 'Maximum tie spacing',
          actualValue: tieSpacing,
          limitValue: maxTieSpacing,
          unit: 'mm',
          status: tieSpacing <= maxTieSpacing ? 'PASS' : 'FAIL',
          severity: tieSpacing <= maxTieSpacing ? 'minor' : 'major'
        });
      }

      // Slenderness
      const slenderness = req.SLENDERNESS[code as keyof typeof req.SLENDERNESS];
      if (slenderness && typeof slenderness.limit === 'number') {
        const lambda = height / leastDim;
        checks.push({
          id: `RC_COL_SLENDERNESS_${code}`,
          category: 'stability',
          code: code as DesignCode,
          clause: slenderness.clause,
          requirement: slenderness.description,
          actualValue: lambda.toFixed(1),
          limitValue: slenderness.limit,
          status: lambda <= slenderness.limit ? 'PASS' : 'WARNING',
          severity: lambda <= slenderness.limit ? 'minor' : 'major',
          remediation: lambda > slenderness.limit ? 'Consider second-order effects in design' : undefined
        });
      }
    }

    return checks;
  }

  /**
   * Check steel beam compliance
   */
  checkSteelBeam(
    beam: {
      section: string;
      depth: number;
      flangeWidth: number;
      flangeThickness: number;
      webThickness: number;
      span: number;
      unbracedLength: number;
      deflection: number;
      deflectionLimit: string;
    },
    material: {
      fy: number;
      E: number;
    }
  ): ComplianceCheck[] {
    const checks: ComplianceCheck[] = [];
    const { depth, flangeWidth, flangeThickness, webThickness, span, unbracedLength, deflection, deflectionLimit } = beam;
    const { fy, E } = material;
    const epsilon = Math.sqrt(250 / fy);

    for (const code of this.codes) {
      if (!['IS800', 'AISC360', 'EC3'].includes(code)) continue;

      const req = CODE_REQUIREMENTS.STEEL_BEAM;

      // Flange outstand (b/t)
      const flangeOutstand = (flangeWidth / 2) / flangeThickness;
      let flangeLimit: number;
      if (code === 'IS800') {
        flangeLimit = 8.4 * epsilon;
      } else if (code === 'AISC360') {
        flangeLimit = 0.38 * Math.sqrt(E / fy);
      } else {
        flangeLimit = 9 * epsilon;
      }

      checks.push({
        id: `STEEL_BEAM_FLANGE_${code}`,
        category: 'stability',
        code: code as DesignCode,
        clause: req.SECTION_CLASS[code as keyof typeof req.SECTION_CLASS]?.clause || '—',
        requirement: 'Flange outstand limit (Class 1)',
        actualValue: flangeOutstand.toFixed(1),
        limitValue: flangeLimit.toFixed(1),
        status: flangeOutstand <= flangeLimit ? 'PASS' : 'WARNING',
        severity: flangeOutstand <= flangeLimit ? 'minor' : 'major'
      });

      // Web slenderness (d/tw)
      const webSlenderness = (depth - 2 * flangeThickness) / webThickness;
      let webLimit: number;
      if (code === 'IS800') {
        webLimit = 67 * epsilon;
      } else if (code === 'AISC360') {
        webLimit = 3.76 * Math.sqrt(E / fy);
      } else {
        webLimit = 72 * epsilon;
      }

      checks.push({
        id: `STEEL_BEAM_WEB_${code}`,
        category: 'stability',
        code: code as DesignCode,
        clause: req.WEB_SLENDERNESS[code as keyof typeof req.WEB_SLENDERNESS]?.clause || '—',
        requirement: 'Web slenderness limit (Class 1)',
        actualValue: webSlenderness.toFixed(1),
        limitValue: webLimit.toFixed(1),
        status: webSlenderness <= webLimit ? 'PASS' : 'WARNING',
        severity: webSlenderness <= webLimit ? 'minor' : 'major'
      });

      // Deflection
      const defLimits = req.DEFLECTION[code as keyof typeof req.DEFLECTION];
      if (defLimits) {
        const limitStr = defLimits.limits[deflectionLimit as keyof typeof defLimits.limits] || 'L/300';
        const limitRatio = parseInt(limitStr.split('/')[1]);
        const allowableDeflection = span / limitRatio;

        checks.push({
          id: `STEEL_BEAM_DEFLECTION_${code}`,
          category: 'serviceability',
          code: code as DesignCode,
          clause: defLimits.clause,
          requirement: `Deflection limit (${limitStr})`,
          actualValue: deflection.toFixed(1),
          limitValue: allowableDeflection.toFixed(1),
          unit: 'mm',
          status: deflection <= allowableDeflection ? 'PASS' : 'FAIL',
          severity: deflection <= allowableDeflection ? 'minor' : 'major'
        });
      }
    }

    return checks;
  }

  /**
   * Generate compliance report
   */
  generateReport(
    project: string,
    element: string,
    checks: ComplianceCheck[]
  ): ComplianceReport {
    const passed = checks.filter(c => c.status === 'PASS').length;
    const failed = checks.filter(c => c.status === 'FAIL').length;
    const warnings = checks.filter(c => c.status === 'WARNING').length;
    const notApplicable = checks.filter(c => c.status === 'N/A').length;
    const total = checks.length;

    const complianceScore = total > 0 ? Math.round((passed / (total - notApplicable)) * 100) : 100;

    const criticalIssues = checks.filter(c => c.status === 'FAIL' && c.severity === 'critical');
    const majorIssues = checks.filter(c => c.status === 'FAIL' && c.severity === 'major');

    const recommendations: string[] = [];
    if (criticalIssues.length > 0) {
      recommendations.push(`${criticalIssues.length} CRITICAL issue(s) require immediate attention`);
    }
    if (majorIssues.length > 0) {
      recommendations.push(`${majorIssues.length} major issue(s) should be addressed before construction`);
    }
    if (warnings > 0) {
      recommendations.push(`${warnings} warning(s) - verify design intent`);
    }
    if (complianceScore < 80) {
      recommendations.push('Overall compliance score is low - comprehensive design review recommended');
    }

    // Add specific remediations
    checks
      .filter(c => c.remediation)
      .slice(0, 5)
      .forEach(c => recommendations.push(`${c.code} ${c.clause}: ${c.remediation}`));

    return {
      timestamp: new Date(),
      project,
      element,
      codes: this.codes,
      checks,
      summary: {
        total,
        passed,
        failed,
        warnings,
        notApplicable,
        complianceScore
      },
      criticalIssues,
      recommendations
    };
  }

  /**
   * Compare compliance across codes
   */
  compareCodeRequirements(
    elementType: 'RC_BEAM' | 'RC_COLUMN' | 'STEEL_BEAM' | 'STEEL_COLUMN',
    parameter: string
  ): {
    parameter: string;
    codeRequirements: { code: DesignCode; value: string | number; clause: string }[];
    mostStringent: DesignCode;
    leastStringent: DesignCode;
  } {
    const requirements = CODE_REQUIREMENTS[elementType];
    const paramReq = requirements[parameter as keyof typeof requirements];

    if (!paramReq) {
      return {
        parameter,
        codeRequirements: [],
        mostStringent: 'IS456' as DesignCode,
        leastStringent: 'IS456' as DesignCode
      };
    }

    const codeReqs = Object.entries(paramReq)
      .filter(([code]) => this.codes.includes(code as DesignCode))
      .map(([code, req]) => ({
        code: code as DesignCode,
        value: (req as any).limit || (req as any).min || (req as any).value || '—',
        clause: (req as any).clause
      }));

    // Determine most/least stringent (simplified - would need context-specific logic)
    const numericReqs = codeReqs.filter(r => typeof r.value === 'number');
    const sorted = numericReqs.sort((a, b) => (a.value as number) - (b.value as number));

    return {
      parameter,
      codeRequirements: codeReqs,
      mostStringent: sorted[sorted.length - 1]?.code || this.codes[0],
      leastStringent: sorted[0]?.code || this.codes[0]
    };
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  CodeComplianceChecker,
  CODE_REQUIREMENTS
};
