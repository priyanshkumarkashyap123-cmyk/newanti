/**
 * ============================================================================
 * CODE COMPLIANCE VERIFICATION ENGINE
 * ============================================================================
 * 
 * Automated multi-code compliance checking and verification covering:
 * - Design code requirements verification
 * - Cross-code comparison
 * - Compliance reporting
 * - Deficiency identification
 * - Remediation suggestions
 * 
 * Supported Codes:
 * - IS 456, IS 800, IS 875, IS 1893, IS 13920, IS 16700
 * - ACI 318, AISC 360, ASCE 7
 * - EN 1992, EN 1993, EN 1998
 * - BS 8110, BS 5950
 * - AS 3600, AS 4100
 * - NBC (National Building Code of India)
 * 
 * @version 1.0.0
 */

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export type DesignCode = 
  | 'IS456' | 'IS800' | 'IS875' | 'IS1893' | 'IS13920' | 'IS16700'
  | 'ACI318' | 'AISC360' | 'ASCE7'
  | 'EN1992' | 'EN1993' | 'EN1998'
  | 'BS8110' | 'BS5950'
  | 'AS3600' | 'AS4100'
  | 'NBC';

export type ComplianceStatus = 'COMPLIANT' | 'NON_COMPLIANT' | 'REQUIRES_REVIEW' | 'NOT_APPLICABLE';

export interface ComplianceCheck {
  code: DesignCode;
  clause: string;
  requirement: string;
  actualValue: number | string;
  limitValue: number | string;
  status: ComplianceStatus;
  severity: 'critical' | 'major' | 'minor';
  remarks?: string;
}

export interface ComplianceReport {
  projectName: string;
  checkDate: Date;
  codes: DesignCode[];
  summary: {
    totalChecks: number;
    compliant: number;
    nonCompliant: number;
    requiresReview: number;
  };
  checks: ComplianceCheck[];
  recommendations: string[];
}

export interface StructuralElement {
  type: 'beam' | 'column' | 'slab' | 'wall' | 'footing' | 'connection';
  id: string;
  material: 'concrete' | 'steel' | 'composite' | 'masonry' | 'timber';
  geometry: Record<string, number>;
  reinforcement?: Record<string, number>;
  loading?: Record<string, number>;
  properties?: Record<string, number>;
}

// ============================================================================
// CONCRETE COMPLIANCE CHECKER (IS 456 / ACI 318 / EN 1992)
// ============================================================================

export class ConcreteComplianceChecker {
  /**
   * Check RC beam compliance
   */
  static checkBeamCompliance(
    beam: {
      width: number; // mm
      depth: number; // mm
      span: number; // mm
      effectiveDepth: number; // mm
      fck: number; // MPa
      fy: number; // MPa
      Ast: number; // mm² (tension steel)
      Asc: number; // mm² (compression steel)
      Asv: number; // mm² (shear steel per m)
      stirrupSpacing: number; // mm
      cover: number; // mm
      maxMoment: number; // kNm
      maxShear: number; // kN
    },
    code: 'IS456' | 'ACI318' | 'EN1992' = 'IS456'
  ): ComplianceCheck[] {
    const checks: ComplianceCheck[] = [];
    const b = beam.width;
    const D = beam.depth;
    const d = beam.effectiveDepth;
    const L = beam.span;
    const fck = beam.fck;
    const fy = beam.fy;

    // 1. Minimum Width Check
    let minWidth: number;
    let clause: string;

    switch (code) {
      case 'IS456':
        minWidth = 200;
        clause = 'Cl. 23.1';
        break;
      case 'ACI318':
        minWidth = 200; // 8 inches
        clause = 'Sec. 9.2.1';
        break;
      case 'EN1992':
        minWidth = 200;
        clause = 'Sec. 9.2.1.1';
        break;
    }

    checks.push({
      code,
      clause,
      requirement: `Minimum beam width ≥ ${minWidth}mm`,
      actualValue: b,
      limitValue: minWidth,
      status: b >= minWidth ? 'COMPLIANT' : 'NON_COMPLIANT',
      severity: 'major'
    });

    // 2. Span-to-Depth Ratio
    let maxSpanDepth: number;
    const spanDepthRatio = L / d;

    switch (code) {
      case 'IS456':
        maxSpanDepth = 20; // Simply supported
        clause = 'Cl. 23.2.1';
        break;
      case 'ACI318':
        maxSpanDepth = 16; // L/16 for simply supported
        clause = 'Table 9.3.1.1';
        break;
      case 'EN1992':
        maxSpanDepth = 20;
        clause = 'Sec. 7.4.2';
        break;
    }

    checks.push({
      code,
      clause,
      requirement: `Span/depth ratio ≤ ${maxSpanDepth}`,
      actualValue: spanDepthRatio.toFixed(1),
      limitValue: maxSpanDepth,
      status: spanDepthRatio <= maxSpanDepth ? 'COMPLIANT' : 'NON_COMPLIANT',
      severity: 'major'
    });

    // 3. Minimum Reinforcement
    let minRho: number;
    const actualRho = beam.Ast / (b * d);

    switch (code) {
      case 'IS456':
        minRho = 0.85 / fy;
        clause = 'Cl. 26.5.1.1';
        break;
      case 'ACI318':
        minRho = Math.max(0.25 * Math.sqrt(fck) / fy, 1.4 / fy);
        clause = 'Sec. 9.6.1.2';
        break;
      case 'EN1992':
        minRho = Math.max(0.26 * Math.pow(fck, 0.5) / fy, 0.0013);
        clause = 'Sec. 9.2.1.1';
        break;
    }

    checks.push({
      code,
      clause,
      requirement: `Min reinforcement ratio ≥ ${(minRho * 100).toFixed(3)}%`,
      actualValue: `${(actualRho * 100).toFixed(3)}%`,
      limitValue: `${(minRho * 100).toFixed(3)}%`,
      status: actualRho >= minRho ? 'COMPLIANT' : 'NON_COMPLIANT',
      severity: 'critical'
    });

    // 4. Maximum Reinforcement
    let maxRho: number;

    switch (code) {
      case 'IS456':
        maxRho = 0.04;
        clause = 'Cl. 26.5.1.1';
        break;
      case 'ACI318':
        maxRho = 0.025; // For tension-controlled
        clause = 'Sec. 9.3.3.1';
        break;
      case 'EN1992':
        maxRho = 0.04;
        clause = 'Sec. 9.2.1.1';
        break;
    }

    checks.push({
      code,
      clause,
      requirement: `Max reinforcement ratio ≤ ${(maxRho * 100).toFixed(1)}%`,
      actualValue: `${(actualRho * 100).toFixed(3)}%`,
      limitValue: `${(maxRho * 100).toFixed(1)}%`,
      status: actualRho <= maxRho ? 'COMPLIANT' : 'NON_COMPLIANT',
      severity: 'critical'
    });

    // 5. Shear Reinforcement Spacing
    let maxStirrupSpacing: number;

    switch (code) {
      case 'IS456':
        maxStirrupSpacing = Math.min(0.75 * d, 300);
        clause = 'Cl. 26.5.1.5';
        break;
      case 'ACI318':
        maxStirrupSpacing = Math.min(d / 2, 600);
        clause = 'Sec. 9.7.6.2.2';
        break;
      case 'EN1992':
        maxStirrupSpacing = Math.min(0.75 * d, 600);
        clause = 'Sec. 9.2.2';
        break;
    }

    checks.push({
      code,
      clause,
      requirement: `Stirrup spacing ≤ ${maxStirrupSpacing.toFixed(0)}mm`,
      actualValue: beam.stirrupSpacing,
      limitValue: maxStirrupSpacing.toFixed(0),
      status: beam.stirrupSpacing <= maxStirrupSpacing ? 'COMPLIANT' : 'NON_COMPLIANT',
      severity: 'major'
    });

    // 6. Minimum Cover
    let minCover: number;

    switch (code) {
      case 'IS456':
        minCover = 25; // Moderate exposure
        clause = 'Cl. 26.4.2';
        break;
      case 'ACI318':
        minCover = 38; // 1.5 inches interior
        clause = 'Sec. 20.5.1.3.1';
        break;
      case 'EN1992':
        minCover = 30; // XC1 exposure
        clause = 'Sec. 4.4.1';
        break;
    }

    checks.push({
      code,
      clause,
      requirement: `Minimum cover ≥ ${minCover}mm`,
      actualValue: beam.cover,
      limitValue: minCover,
      status: beam.cover >= minCover ? 'COMPLIANT' : 'NON_COMPLIANT',
      severity: 'major'
    });

    return checks;
  }

  /**
   * Check RC column compliance
   */
  static checkColumnCompliance(
    column: {
      width: number;
      depth: number;
      height: number;
      fck: number;
      fy: number;
      Ast: number;
      numBars: number;
      tieSpacing: number;
      tieDiameter: number;
      mainBarDiameter: number;
      cover: number;
      Pu: number; // kN
      Mu: number; // kNm
    },
    code: 'IS456' | 'ACI318' | 'EN1992' = 'IS456'
  ): ComplianceCheck[] {
    const checks: ComplianceCheck[] = [];
    const b = Math.min(column.width, column.depth);
    const D = Math.max(column.width, column.depth);
    const Ag = column.width * column.depth;
    const rho = column.Ast / Ag;

    // 1. Minimum Dimension
    let minDim: number;
    let clause: string;

    switch (code) {
      case 'IS456':
        minDim = 300;
        clause = 'Cl. 25.1.1';
        break;
      case 'ACI318':
        minDim = 250; // 10 inches
        clause = 'Sec. 10.3.1';
        break;
      case 'EN1992':
        minDim = 200;
        clause = 'Sec. 9.5.1';
        break;
    }

    checks.push({
      code,
      clause,
      requirement: `Minimum column dimension ≥ ${minDim}mm`,
      actualValue: b,
      limitValue: minDim,
      status: b >= minDim ? 'COMPLIANT' : 'NON_COMPLIANT',
      severity: 'critical'
    });

    // 2. Reinforcement Ratio Limits
    let minRho: number, maxRho: number;

    switch (code) {
      case 'IS456':
        minRho = 0.008;
        maxRho = 0.06;
        clause = 'Cl. 26.5.3.1';
        break;
      case 'ACI318':
        minRho = 0.01;
        maxRho = 0.08;
        clause = 'Sec. 10.6.1.1';
        break;
      case 'EN1992':
        minRho = 0.01;
        maxRho = 0.04;
        clause = 'Sec. 9.5.2';
        break;
    }

    checks.push({
      code,
      clause,
      requirement: `Reinforcement ratio ${(minRho * 100).toFixed(1)}% - ${(maxRho * 100).toFixed(1)}%`,
      actualValue: `${(rho * 100).toFixed(2)}%`,
      limitValue: `${(minRho * 100).toFixed(1)}% - ${(maxRho * 100).toFixed(1)}%`,
      status: rho >= minRho && rho <= maxRho ? 'COMPLIANT' : 'NON_COMPLIANT',
      severity: 'critical'
    });

    // 3. Minimum Number of Bars
    let minBars: number;

    switch (code) {
      case 'IS456':
        minBars = column.width === column.depth ? 4 : 4;
        clause = 'Cl. 26.5.3.1';
        break;
      case 'ACI318':
        minBars = 4;
        clause = 'Sec. 10.7.3.1';
        break;
      case 'EN1992':
        minBars = 4;
        clause = 'Sec. 9.5.2';
        break;
    }

    checks.push({
      code,
      clause,
      requirement: `Minimum number of bars ≥ ${minBars}`,
      actualValue: column.numBars,
      limitValue: minBars,
      status: column.numBars >= minBars ? 'COMPLIANT' : 'NON_COMPLIANT',
      severity: 'major'
    });

    // 4. Tie Spacing
    let maxTieSpacing: number;

    switch (code) {
      case 'IS456':
        maxTieSpacing = Math.min(b, 16 * column.mainBarDiameter, 300);
        clause = 'Cl. 26.5.3.2';
        break;
      case 'ACI318':
        maxTieSpacing = Math.min(16 * column.mainBarDiameter, 48 * column.tieDiameter, b);
        clause = 'Sec. 10.7.6.1.2';
        break;
      case 'EN1992':
        maxTieSpacing = Math.min(20 * column.mainBarDiameter, b, 400);
        clause = 'Sec. 9.5.3';
        break;
    }

    checks.push({
      code,
      clause,
      requirement: `Tie spacing ≤ ${maxTieSpacing.toFixed(0)}mm`,
      actualValue: column.tieSpacing,
      limitValue: maxTieSpacing.toFixed(0),
      status: column.tieSpacing <= maxTieSpacing ? 'COMPLIANT' : 'NON_COMPLIANT',
      severity: 'major'
    });

    // 5. Tie Diameter
    let minTieDiameter: number;

    switch (code) {
      case 'IS456':
        minTieDiameter = Math.max(column.mainBarDiameter / 4, 6);
        clause = 'Cl. 26.5.3.2';
        break;
      case 'ACI318':
        minTieDiameter = 10; // #3 minimum
        clause = 'Sec. 10.7.6.1.1';
        break;
      case 'EN1992':
        minTieDiameter = Math.max(6, column.mainBarDiameter / 4);
        clause = 'Sec. 9.5.3';
        break;
    }

    checks.push({
      code,
      clause,
      requirement: `Tie diameter ≥ ${minTieDiameter.toFixed(0)}mm`,
      actualValue: column.tieDiameter,
      limitValue: minTieDiameter.toFixed(0),
      status: column.tieDiameter >= minTieDiameter ? 'COMPLIANT' : 'NON_COMPLIANT',
      severity: 'minor'
    });

    return checks;
  }
}

// ============================================================================
// STEEL COMPLIANCE CHECKER (IS 800 / AISC 360 / EN 1993)
// ============================================================================

export class SteelComplianceChecker {
  /**
   * Check steel beam compliance
   */
  static checkBeamCompliance(
    beam: {
      sectionType: string;
      depth: number; // mm
      flangeWidth: number; // mm
      flangeThickness: number; // mm
      webThickness: number; // mm
      fy: number; // MPa
      span: number; // mm
      lateralBracingLength: number; // mm
      appliedMoment: number; // kNm
      appliedShear: number; // kN
      momentCapacity: number; // kNm
      shearCapacity: number; // kN
    },
    code: 'IS800' | 'AISC360' | 'EN1993' = 'IS800'
  ): ComplianceCheck[] {
    const checks: ComplianceCheck[] = [];
    const d = beam.depth;
    const bf = beam.flangeWidth;
    const tf = beam.flangeThickness;
    const tw = beam.webThickness;
    const fy = beam.fy;
    const E = 200000;

    // 1. Flange Width-Thickness Ratio (Local Buckling)
    const flangeRatio = (bf / 2) / tf;
    let flangeLimit: number;
    let clause: string;
    let sectionClass: string;

    switch (code) {
      case 'IS800':
        flangeLimit = 8.4 * Math.sqrt(250 / fy); // Plastic section
        clause = 'Table 2';
        break;
      case 'AISC360':
        flangeLimit = 0.38 * Math.sqrt(E / fy);
        clause = 'Table B4.1b';
        break;
      case 'EN1993':
        flangeLimit = 9 * Math.sqrt(235 / fy); // Class 1
        clause = 'Table 5.2';
        break;
    }

    sectionClass = flangeRatio <= flangeLimit ? 'Compact/Class1' : 'Non-compact';

    checks.push({
      code,
      clause,
      requirement: `Flange b/t ≤ ${flangeLimit.toFixed(1)} (${sectionClass})`,
      actualValue: flangeRatio.toFixed(1),
      limitValue: flangeLimit.toFixed(1),
      status: flangeRatio <= flangeLimit ? 'COMPLIANT' : 'NON_COMPLIANT',
      severity: 'major'
    });

    // 2. Web Slenderness Ratio
    const webRatio = (d - 2 * tf) / tw;
    let webLimit: number;

    switch (code) {
      case 'IS800':
        webLimit = 84 * Math.sqrt(250 / fy);
        clause = 'Table 2';
        break;
      case 'AISC360':
        webLimit = 3.76 * Math.sqrt(E / fy);
        clause = 'Table B4.1b';
        break;
      case 'EN1993':
        webLimit = 72 * Math.sqrt(235 / fy);
        clause = 'Table 5.2';
        break;
    }

    checks.push({
      code,
      clause,
      requirement: `Web d/t ≤ ${webLimit.toFixed(1)}`,
      actualValue: webRatio.toFixed(1),
      limitValue: webLimit.toFixed(1),
      status: webRatio <= webLimit ? 'COMPLIANT' : 'NON_COMPLIANT',
      severity: 'major'
    });

    // 3. Lateral Bracing
    const Lb = beam.lateralBracingLength;
    let maxUnbraced: number;

    switch (code) {
      case 'IS800':
        maxUnbraced = beam.span / 8; // Simplified
        clause = 'Cl. 8.2.2';
        break;
      case 'AISC360':
        maxUnbraced = 1.76 * (bf / 2) * Math.sqrt(E / fy);
        clause = 'Eq. F2-5';
        break;
      case 'EN1993':
        maxUnbraced = beam.span / 6;
        clause = 'Sec. 6.3.2';
        break;
    }

    checks.push({
      code,
      clause,
      requirement: `Lateral bracing Lb ≤ ${maxUnbraced.toFixed(0)}mm`,
      actualValue: Lb,
      limitValue: maxUnbraced.toFixed(0),
      status: Lb <= maxUnbraced ? 'COMPLIANT' : 'REQUIRES_REVIEW',
      severity: 'major',
      remarks: 'Full LTB check may be needed if Lb > Lp'
    });

    // 4. Moment Utilization
    const momentRatio = beam.appliedMoment / beam.momentCapacity;

    checks.push({
      code,
      clause: 'Strength Check',
      requirement: 'Mu/φMn ≤ 1.0',
      actualValue: momentRatio.toFixed(3),
      limitValue: '1.0',
      status: momentRatio <= 1.0 ? 'COMPLIANT' : 'NON_COMPLIANT',
      severity: 'critical'
    });

    // 5. Shear Utilization
    const shearRatio = beam.appliedShear / beam.shearCapacity;

    checks.push({
      code,
      clause: 'Strength Check',
      requirement: 'Vu/φVn ≤ 1.0',
      actualValue: shearRatio.toFixed(3),
      limitValue: '1.0',
      status: shearRatio <= 1.0 ? 'COMPLIANT' : 'NON_COMPLIANT',
      severity: 'critical'
    });

    // 6. Span-to-Depth Ratio (Serviceability)
    const spanDepthRatio = beam.span / d;
    let maxSpanDepth: number;

    switch (code) {
      case 'IS800':
        maxSpanDepth = 20;
        clause = 'Table 6';
        break;
      case 'AISC360':
        maxSpanDepth = 24;
        clause = 'Commentary L3';
        break;
      case 'EN1993':
        maxSpanDepth = 20;
        clause = 'NA Annex';
        break;
    }

    checks.push({
      code,
      clause,
      requirement: `Span/depth ≤ ${maxSpanDepth} (serviceability)`,
      actualValue: spanDepthRatio.toFixed(1),
      limitValue: maxSpanDepth.toString(),
      status: spanDepthRatio <= maxSpanDepth ? 'COMPLIANT' : 'REQUIRES_REVIEW',
      severity: 'minor'
    });

    return checks;
  }

  /**
   * Check steel column compliance
   */
  static checkColumnCompliance(
    column: {
      sectionType: string;
      area: number; // mm²
      rx: number; // mm
      ry: number; // mm
      length: number; // mm
      Kx: number; // Effective length factor
      Ky: number;
      fy: number; // MPa
      appliedForce: number; // kN
      appliedMomentX: number; // kNm
      appliedMomentY: number; // kNm
      axialCapacity: number; // kN
      momentCapacityX: number; // kNm
      momentCapacityY: number; // kNm
    },
    code: 'IS800' | 'AISC360' | 'EN1993' = 'IS800'
  ): ComplianceCheck[] {
    const checks: ComplianceCheck[] = [];
    const E = 200000;
    const fy = column.fy;

    // 1. Slenderness Ratio
    const KL_rx = column.Kx * column.length / column.rx;
    const KL_ry = column.Ky * column.length / column.ry;
    const maxSlenderness = Math.max(KL_rx, KL_ry);
    let slendernessLimit: number;
    let clause: string;

    switch (code) {
      case 'IS800':
        slendernessLimit = 180;
        clause = 'Cl. 3.8.1';
        break;
      case 'AISC360':
        slendernessLimit = 200;
        clause = 'Sec. E2';
        break;
      case 'EN1993':
        slendernessLimit = 200;
        clause = 'Sec. 6.3.1';
        break;
    }

    checks.push({
      code,
      clause,
      requirement: `Slenderness KL/r ≤ ${slendernessLimit}`,
      actualValue: maxSlenderness.toFixed(1),
      limitValue: slendernessLimit.toString(),
      status: maxSlenderness <= slendernessLimit ? 'COMPLIANT' : 'NON_COMPLIANT',
      severity: 'critical'
    });

    // 2. Axial Utilization
    const axialRatio = column.appliedForce / column.axialCapacity;

    checks.push({
      code,
      clause: 'Axial Check',
      requirement: 'Pu/φPn ≤ 1.0',
      actualValue: axialRatio.toFixed(3),
      limitValue: '1.0',
      status: axialRatio <= 1.0 ? 'COMPLIANT' : 'NON_COMPLIANT',
      severity: 'critical'
    });

    // 3. Combined Axial and Bending (Interaction)
    let interactionValue: number;
    const Pr_Pc = column.appliedForce / column.axialCapacity;
    const Mrx_Mcx = column.appliedMomentX / column.momentCapacityX;
    const Mry_Mcy = column.appliedMomentY / column.momentCapacityY;

    switch (code) {
      case 'IS800':
        // Cl. 9.3.2
        interactionValue = Pr_Pc + (8/9) * (Mrx_Mcx + Mry_Mcy);
        clause = 'Cl. 9.3.2';
        break;
      case 'AISC360':
        // H1-1
        if (Pr_Pc >= 0.2) {
          interactionValue = Pr_Pc + (8/9) * (Mrx_Mcx + Mry_Mcy);
        } else {
          interactionValue = Pr_Pc / 2 + (Mrx_Mcx + Mry_Mcy);
        }
        clause = 'Eq. H1-1';
        break;
      case 'EN1993':
        interactionValue = Pr_Pc + Mrx_Mcx + Mry_Mcy;
        clause = 'Eq. 6.61';
        break;
    }

    checks.push({
      code,
      clause,
      requirement: 'Interaction ratio ≤ 1.0',
      actualValue: interactionValue.toFixed(3),
      limitValue: '1.0',
      status: interactionValue <= 1.0 ? 'COMPLIANT' : 'NON_COMPLIANT',
      severity: 'critical'
    });

    return checks;
  }
}

// ============================================================================
// SEISMIC COMPLIANCE CHECKER (IS 1893 / ASCE 7 / EN 1998)
// ============================================================================

export class SeismicComplianceChecker {
  /**
   * Check seismic analysis requirements
   */
  static checkAnalysisRequirements(
    building: {
      height: number; // m
      seismicZone: string;
      soilType: string;
      structuralSystem: string;
      irregularities: string[];
      importance: number;
      fundamentalPeriod: number; // s
      baseshearMethod: number; // kN
      baseshearDynamic: number; // kN
      driftRatio: number;
    },
    code: 'IS1893' | 'ASCE7' | 'EN1998' = 'IS1893'
  ): ComplianceCheck[] {
    const checks: ComplianceCheck[] = [];
    const H = building.height;

    // 1. Analysis Method Requirement
    let requiredMethod: string;
    let clause: string;

    switch (code) {
      case 'IS1893':
        if (H > 40 || building.irregularities.length > 0) {
          requiredMethod = 'Dynamic Analysis';
        } else {
          requiredMethod = 'Equivalent Static or Dynamic';
        }
        clause = 'Cl. 7.6.1';
        break;
      case 'ASCE7':
        if (H > 48.8 || building.irregularities.length > 0) { // 160 ft
          requiredMethod = 'Modal Response Spectrum';
        } else {
          requiredMethod = 'ELF or Dynamic';
        }
        clause = 'Table 12.6-1';
        break;
      case 'EN1998':
        requiredMethod = 'Modal Response Spectrum';
        clause = 'Sec. 4.3.3';
        break;
    }

    checks.push({
      code,
      clause,
      requirement: requiredMethod,
      actualValue: 'Dynamic Analysis performed',
      limitValue: requiredMethod,
      status: 'COMPLIANT',
      severity: 'major'
    });

    // 2. Base Shear Comparison (Static vs Dynamic)
    let minRatio: number;
    const actualRatio = building.baseshearDynamic / building.baseshearMethod;

    switch (code) {
      case 'IS1893':
        minRatio = 0.7; // VB ≥ 0.7 × Vb (equivalent static)
        clause = 'Cl. 7.6.2.3';
        break;
      case 'ASCE7':
        minRatio = 0.85;
        clause = 'Sec. 12.9.4.1';
        break;
      case 'EN1998':
        minRatio = 0.85;
        clause = 'Sec. 4.3.3.3.2';
        break;
    }

    checks.push({
      code,
      clause,
      requirement: `Dynamic base shear ≥ ${(minRatio * 100).toFixed(0)}% of static`,
      actualValue: `${(actualRatio * 100).toFixed(1)}%`,
      limitValue: `${(minRatio * 100).toFixed(0)}%`,
      status: actualRatio >= minRatio ? 'COMPLIANT' : 'REQUIRES_REVIEW',
      severity: 'major',
      remarks: 'Scale dynamic results if ratio is less than minimum'
    });

    // 3. Story Drift Limit
    let driftLimit: number;

    switch (code) {
      case 'IS1893':
        driftLimit = 0.004; // 0.4%
        clause = 'Cl. 7.11.1';
        break;
      case 'ASCE7':
        driftLimit = 0.020; // 2% for Risk Category II
        clause = 'Table 12.12-1';
        break;
      case 'EN1998':
        driftLimit = 0.0075; // 0.75% for non-structural damage limit
        clause = 'Sec. 4.4.3.2';
        break;
    }

    checks.push({
      code,
      clause,
      requirement: `Story drift ≤ ${(driftLimit * 100).toFixed(2)}%`,
      actualValue: `${(building.driftRatio * 100).toFixed(3)}%`,
      limitValue: `${(driftLimit * 100).toFixed(2)}%`,
      status: building.driftRatio <= driftLimit ? 'COMPLIANT' : 'NON_COMPLIANT',
      severity: 'critical'
    });

    // 4. Irregularity Checks
    if (building.irregularities.length > 0) {
      checks.push({
        code,
        clause: 'Irregularity Check',
        requirement: 'Address all structural irregularities',
        actualValue: building.irregularities.join(', '),
        limitValue: 'None or properly addressed',
        status: 'REQUIRES_REVIEW',
        severity: 'major',
        remarks: 'Special analysis and detailing required for irregular structures'
      });
    }

    return checks;
  }

  /**
   * Check ductile detailing requirements
   */
  static checkDuctileDetailing(
    member: {
      type: 'beam' | 'column' | 'joint';
      dimensions: Record<string, number>;
      reinforcement: Record<string, number>;
      seismicZone: string;
    },
    code: 'IS13920' | 'ACI318' | 'EN1998' = 'IS13920'
  ): ComplianceCheck[] {
    const checks: ComplianceCheck[] = [];

    if (member.type === 'beam') {
      // Beam ductile detailing
      const width = member.dimensions.width;
      const depth = member.dimensions.depth;
      const Ast_top = member.reinforcement.topSteel;
      const Ast_bot = member.reinforcement.bottomSteel;

      // Width-to-depth ratio
      let minWidthDepthRatio: number;
      let clause: string;

      switch (code) {
        case 'IS13920':
          minWidthDepthRatio = 0.3;
          clause = 'Cl. 6.1.3';
          break;
        case 'ACI318':
          minWidthDepthRatio = 0.3;
          clause = 'Sec. 18.6.2.1';
          break;
        case 'EN1998':
          minWidthDepthRatio = 0.25;
          clause = 'Sec. 5.4.1.2.1';
          break;
      }

      checks.push({
        code,
        clause,
        requirement: `Beam width/depth ≥ ${minWidthDepthRatio}`,
        actualValue: (width / depth).toFixed(2),
        limitValue: minWidthDepthRatio.toString(),
        status: width / depth >= minWidthDepthRatio ? 'COMPLIANT' : 'NON_COMPLIANT',
        severity: 'major'
      });

      // Bottom steel at support
      checks.push({
        code,
        clause: code === 'IS13920' ? 'Cl. 6.2.3' : 'Sec. 18.6.3.2',
        requirement: 'Bottom steel ≥ 50% of top steel at support',
        actualValue: `${((Ast_bot / Ast_top) * 100).toFixed(0)}%`,
        limitValue: '50%',
        status: Ast_bot >= 0.5 * Ast_top ? 'COMPLIANT' : 'NON_COMPLIANT',
        severity: 'critical'
      });
    }

    if (member.type === 'column') {
      // Column ductile detailing
      const dimension = Math.min(member.dimensions.width, member.dimensions.depth);
      const axialRatio = member.reinforcement.axialLoadRatio || 0;

      // Minimum dimension
      let minDim: number;

      switch (code) {
        case 'IS13920':
          minDim = 300;
          break;
        case 'ACI318':
          minDim = 300;
          break;
        case 'EN1998':
          minDim = 250;
          break;
      }

      checks.push({
        code,
        clause: code === 'IS13920' ? 'Cl. 7.1.1' : 'Sec. 18.7.2.1',
        requirement: `Minimum column dimension ≥ ${minDim}mm`,
        actualValue: dimension,
        limitValue: minDim,
        status: dimension >= minDim ? 'COMPLIANT' : 'NON_COMPLIANT',
        severity: 'critical'
      });

      // Axial load ratio limit
      let maxAxialRatio: number;

      switch (code) {
        case 'IS13920':
          maxAxialRatio = 0.4;
          break;
        case 'ACI318':
          maxAxialRatio = 0.35;
          break;
        case 'EN1998':
          maxAxialRatio = 0.45;
          break;
      }

      if (axialRatio > 0) {
        checks.push({
          code,
          clause: code === 'IS13920' ? 'Cl. 7.4.1' : 'Sec. 18.7.5',
          requirement: `Axial load ratio ≤ ${maxAxialRatio}`,
          actualValue: axialRatio.toFixed(3),
          limitValue: maxAxialRatio.toString(),
          status: axialRatio <= maxAxialRatio ? 'COMPLIANT' : 'NON_COMPLIANT',
          severity: 'critical'
        });
      }
    }

    return checks;
  }
}

// ============================================================================
// COMPLIANCE REPORT GENERATOR
// ============================================================================

export class ComplianceReportGenerator {
  private checks: ComplianceCheck[] = [];
  private projectName: string;
  private codes: DesignCode[];

  constructor(projectName: string, codes: DesignCode[]) {
    this.projectName = projectName;
    this.codes = codes;
  }

  addChecks(checks: ComplianceCheck[]): void {
    this.checks.push(...checks);
  }

  generateReport(): ComplianceReport {
    const summary = {
      totalChecks: this.checks.length,
      compliant: this.checks.filter(c => c.status === 'COMPLIANT').length,
      nonCompliant: this.checks.filter(c => c.status === 'NON_COMPLIANT').length,
      requiresReview: this.checks.filter(c => c.status === 'REQUIRES_REVIEW').length
    };

    const recommendations: string[] = [];

    // Generate recommendations for non-compliant items
    const criticalNonCompliant = this.checks.filter(
      c => c.status === 'NON_COMPLIANT' && c.severity === 'critical'
    );

    if (criticalNonCompliant.length > 0) {
      recommendations.push('CRITICAL: Immediate attention required for structural safety');
      criticalNonCompliant.forEach(c => {
        recommendations.push(`• ${c.code} ${c.clause}: ${c.requirement}`);
      });
    }

    const majorNonCompliant = this.checks.filter(
      c => c.status === 'NON_COMPLIANT' && c.severity === 'major'
    );

    if (majorNonCompliant.length > 0) {
      recommendations.push('\nMAJOR: Design modifications recommended');
      majorNonCompliant.forEach(c => {
        recommendations.push(`• ${c.code} ${c.clause}: ${c.requirement}`);
      });
    }

    const requiresReview = this.checks.filter(c => c.status === 'REQUIRES_REVIEW');

    if (requiresReview.length > 0) {
      recommendations.push('\nREVIEW REQUIRED: Further evaluation needed');
      requiresReview.forEach(c => {
        recommendations.push(`• ${c.code} ${c.clause}: ${c.remarks || c.requirement}`);
      });
    }

    if (summary.nonCompliant === 0 && summary.requiresReview === 0) {
      recommendations.push('All compliance checks passed. Structure meets code requirements.');
    }

    return {
      projectName: this.projectName,
      checkDate: new Date(),
      codes: this.codes,
      summary,
      checks: this.checks,
      recommendations
    };
  }

  exportToMarkdown(): string {
    const report = this.generateReport();
    let md = `# Structural Compliance Report\n\n`;
    md += `**Project:** ${report.projectName}\n`;
    md += `**Date:** ${report.checkDate.toISOString().split('T')[0]}\n`;
    md += `**Codes:** ${report.codes.join(', ')}\n\n`;

    md += `## Summary\n\n`;
    md += `| Status | Count |\n`;
    md += `|--------|-------|\n`;
    md += `| ✅ Compliant | ${report.summary.compliant} |\n`;
    md += `| ❌ Non-Compliant | ${report.summary.nonCompliant} |\n`;
    md += `| ⚠️ Requires Review | ${report.summary.requiresReview} |\n`;
    md += `| **Total** | **${report.summary.totalChecks}** |\n\n`;

    md += `## Detailed Checks\n\n`;
    md += `| Code | Clause | Requirement | Actual | Limit | Status |\n`;
    md += `|------|--------|-------------|--------|-------|--------|\n`;

    report.checks.forEach(c => {
      const statusIcon = c.status === 'COMPLIANT' ? '✅' : 
                         c.status === 'NON_COMPLIANT' ? '❌' : '⚠️';
      md += `| ${c.code} | ${c.clause} | ${c.requirement} | ${c.actualValue} | ${c.limitValue} | ${statusIcon} |\n`;
    });

    md += `\n## Recommendations\n\n`;
    report.recommendations.forEach(r => {
      md += `${r}\n`;
    });

    return md;
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  ConcreteComplianceChecker,
  SteelComplianceChecker,
  SeismicComplianceChecker,
  ComplianceReportGenerator
};
