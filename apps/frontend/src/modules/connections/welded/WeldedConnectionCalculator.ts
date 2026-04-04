/**
 * Welded Connection Calculator
 * Comprehensive weld design per AWS D1.1, AISC 360, Eurocode 3, IS 800
 * 
 * Features:
 * - Fillet weld design (longitudinal, transverse, inclined)
 * - Complete Joint Penetration (CJP) welds
 * - Partial Joint Penetration (PJP) welds
 * - Weld group analysis (instantaneous center method)
 * - Eccentrically loaded weld groups
 * - Directional strength increase for fillet welds
 * - Fatigue considerations
 */

import {
  WeldDesignCode,
  WeldType,
  WeldPosition,
  WeldProcess,
  ElectrodeClass,
  FilletWeldOrientation,
  JointType,
  LoadDirection,
  WeldMaterial,
  FilletWeldInput,
  FilletWeldResult,
  GrooveWeldInput,
  GrooveWeldResult,
  WeldGroupInput,
  WeldGroupResult,
  ELECTRODE_STRENGTH,
  AISC_MIN_FILLET_SIZE,
  EC3_MIN_FILLET_SIZE,
  WELD_PHI_FACTORS
} from './WeldedConnectionTypes';

// ============================================================================
// AISC 360 Weld Calculator
// ============================================================================

class AISCWeldCalculator {
  /**
   * Calculate fillet weld strength per AISC 360 Section J2.4
   */
  calculateFilletWeld(input: FilletWeldInput): FilletWeldResult {
    const { weldSize, weldLength, orientation, material, appliedLoad, jointType, basePlateThickness } = input;
    
    // Effective throat thickness
    const effectiveThroat = weldSize * Math.SQRT1_2; // a = 0.707 × w
    
    // Effective length (deduct 2w for returns, if applicable)
    const effectiveLength = Math.max(weldLength - 2 * weldSize, 4 * weldSize);
    
    // Effective area
    const effectiveArea = effectiveThroat * effectiveLength;
    
    // Weld metal strength
    const FEXX = material.FEXX;
    const Fnw = 0.60 * FEXX; // Nominal stress of weld metal
    
    // Directional strength increase per AISC 360 Eq. J2-5
    let directionalFactor = 1.0;
    const loadAngle = input.loadAngle || (orientation === FilletWeldOrientation.TRANSVERSE ? 90 : 0);
    
    if (loadAngle > 0) {
      directionalFactor = 1.0 + 0.50 * Math.pow(Math.sin(loadAngle * Math.PI / 180), 1.5);
    }
    
    // Nominal strength
    const Rn = Fnw * effectiveArea * directionalFactor * (input.numberOfWelds || 1);
    
    // Design strength
    const phi = WELD_PHI_FACTORS.AISC.fillet;
    const designStrength = phi * Rn;
    
    // Check base metal capacity (shear rupture)
    const baseMetal_Rn = 0.60 * material.Fu * basePlateThickness * effectiveLength * (input.numberOfWelds || 1);
    const baseMetal_phiRn = 0.75 * baseMetal_Rn;
    
    // Governing strength
    const governingStrength = Math.min(designStrength, baseMetal_phiRn);
    
    // Utilization
    const utilizationRatio = appliedLoad / governingStrength;
    
    // Size limits
    const minSize = this.getMinimumFilletSize(basePlateThickness);
    const maxSize = this.getMaximumFilletSize(basePlateThickness, jointType);
    
    // Warnings
    const warnings: string[] = [];
    if (weldSize < minSize) {
      warnings.push(`⚠️ Weld size (${weldSize}") is less than minimum (${minSize}") per AISC Table J2.4`);
    }
    if (weldSize > maxSize) {
      warnings.push(`⚠️ Weld size (${weldSize}") exceeds maximum (${maxSize}")`);
    }
    if (effectiveLength < 4 * weldSize) {
      warnings.push('⚠️ Weld length is less than 4 times the weld size');
    }
    if (weldLength > 100 * weldSize && orientation === FilletWeldOrientation.LONGITUDINAL) {
      warnings.push('⚠️ Long weld - consider beta factor for effective length');
    }
    
    // Detailing requirements
    const detailingRequirements = [
      `Minimum length: ${(4 * weldSize).toFixed(3)}"`,
      'Weld returns at corners: 2w minimum',
      `Electrode: ${material.electrodeClass}`,
      effectiveLength > 300 * weldSize 
        ? 'Longitudinal fillet welds shall be continuous' 
        : 'Intermittent welds permitted'
    ];
    
    return {
      designCode: input.designCode,
      weldSize,
      effectiveThroat,
      effectiveLength,
      weldStrength: Rn,
      designStrength: governingStrength,
      appliedLoad,
      utilizationRatio,
      isAdequate: utilizationRatio <= 1.0 && weldSize >= minSize && weldSize <= maxSize,
      minSize,
      maxSize,
      warnings,
      detailingRequirements
    };
  }

  /**
   * Get minimum fillet weld size per AISC Table J2.4
   */
  private getMinimumFilletSize(thickness: number): number {
    if (thickness <= 0.25) return 0.125;
    if (thickness <= 0.50) return 0.1875;
    if (thickness <= 0.75) return 0.25;
    return 0.3125;
  }

  /**
   * Get maximum fillet weld size per AISC Section J2.2b
   */
  private getMaximumFilletSize(thickness: number, jointType: JointType): number {
    if (jointType === JointType.LAP) {
      // Along edges: t - 1/16" for t ≥ 1/4", else t
      return thickness >= 0.25 ? thickness - 0.0625 : thickness;
    }
    return thickness; // Other joints - practical limit
  }

  /**
   * Calculate CJP groove weld strength per AISC 360 Section J2.3
   */
  calculateCJPWeld(input: GrooveWeldInput): GrooveWeldResult {
    const { weldLength, material, appliedForces, basePlateThickness } = input;
    
    // Effective throat = base plate thickness for CJP
    const effectiveThroat = basePlateThickness;
    const effectiveArea = effectiveThroat * weldLength;
    
    // Determine governing limit state
    let phi: number;
    let nominalStress: number;
    
    if (appliedForces.tension) {
      // Tension normal to weld axis
      phi = WELD_PHI_FACTORS.AISC.CJP_tension;
      nominalStress = material.Fy; // Base metal governs for matching electrodes
    } else if (appliedForces.compression) {
      // Compression
      phi = WELD_PHI_FACTORS.AISC.CJP_compression;
      nominalStress = material.Fy;
    } else {
      // Shear
      phi = WELD_PHI_FACTORS.AISC.CJP_shear;
      nominalStress = 0.60 * material.FEXX;
    }
    
    // Nominal and design strength
    const nominalStrength = nominalStress * effectiveArea;
    const designStrength = phi * nominalStrength;
    
    // Applied force
    const appliedForce = Math.abs(appliedForces.tension || 0) + 
                         Math.abs(appliedForces.compression || 0) + 
                         Math.abs(appliedForces.shear || 0);
    
    // Applied stress
    const appliedStress = appliedForce / effectiveArea;
    
    // Utilization
    const utilizationRatio = appliedForce / designStrength;
    
    // Preheat requirements (simplified)
    const preheatRequired = basePlateThickness > 1.5 || material.Fy > 50;
    
    const warnings: string[] = [];
    if (utilizationRatio > 1.0) {
      warnings.push('❌ Weld is overstressed');
    }
    
    return {
      designCode: input.designCode,
      weldType: WeldType.COMPLETE_JOINT_PENETRATION,
      effectiveThroat,
      effectiveArea,
      nominalStrength,
      designStrength,
      appliedStress,
      utilizationRatio,
      isAdequate: utilizationRatio <= 1.0,
      preheatRequired,
      preheatTemperature: preheatRequired ? 200 : undefined, // Simplified
      warnings
    };
  }

  /**
   * Calculate PJP groove weld strength per AISC 360 Section J2.3
   */
  calculatePJPWeld(input: GrooveWeldInput): GrooveWeldResult {
    const { effectiveThroat, weldLength, material, appliedForces } = input;
    
    const effectiveArea = effectiveThroat * weldLength;
    
    // Determine governing limit state
    let phi: number;
    let Fnw: number;
    let Fnbm: number;
    
    if (appliedForces.tension) {
      phi = WELD_PHI_FACTORS.AISC.PJP_tension;
      Fnw = 0.60 * material.FEXX;
      Fnbm = material.Fu;
    } else if (appliedForces.compression) {
      phi = WELD_PHI_FACTORS.AISC.PJP_compression;
      Fnw = 0.90 * material.FEXX;
      Fnbm = material.Fy;
    } else {
      phi = WELD_PHI_FACTORS.AISC.PJP_shear;
      Fnw = 0.60 * material.FEXX;
      Fnbm = 0.60 * material.Fu;
    }
    
    // Governing nominal stress
    const nominalStress = Math.min(Fnw, Fnbm);
    
    // Strengths
    const nominalStrength = nominalStress * effectiveArea;
    const designStrength = phi * nominalStrength;
    
    // Applied force
    const appliedForce = Math.abs(appliedForces.tension || 0) + 
                         Math.abs(appliedForces.compression || 0) + 
                         Math.abs(appliedForces.shear || 0);
    
    const utilizationRatio = appliedForce / designStrength;
    
    const warnings: string[] = [];
    if (utilizationRatio > 1.0) {
      warnings.push('❌ PJP weld is overstressed');
    }
    if (effectiveThroat < 0.25 * input.basePlateThickness) {
      warnings.push('⚠️ Consider CJP weld for better fatigue performance');
    }
    
    return {
      designCode: input.designCode,
      weldType: WeldType.PARTIAL_JOINT_PENETRATION,
      effectiveThroat,
      effectiveArea,
      nominalStrength,
      designStrength,
      appliedStress: appliedForce / effectiveArea,
      utilizationRatio,
      isAdequate: utilizationRatio <= 1.0,
      preheatRequired: false,
      warnings
    };
  }

  /**
   * Analyze eccentrically loaded weld group using Instantaneous Center method
   */
  analyzeWeldGroup(input: WeldGroupInput): WeldGroupResult {
    const { welds, material, appliedForces, loadPoint } = input;
    
    // Calculate weld group centroid
    let totalLength = 0;
    let sumLx = 0;
    let sumLy = 0;
    
    for (const weld of welds) {
      totalLength += weld.length;
      sumLx += weld.length * weld.x;
      sumLy += weld.length * weld.y;
    }
    
    const centroid = {
      x: sumLx / totalLength,
      y: sumLy / totalLength
    };
    
    // Calculate polar moment of inertia
    let Ip = 0;
    for (const weld of welds) {
      const dx = weld.x - centroid.x;
      const dy = weld.y - centroid.y;
      // For line welds: Ip = L(dx² + dy²) + L³/12 for moment about perpendicular axis
      const r2 = dx * dx + dy * dy;
      Ip += weld.length * r2 + (weld.length * weld.length * weld.length) / 12;
    }
    
    // Calculate applied forces at centroid
    const Px = appliedForces.Px || 0;
    const Py = appliedForces.Py || 0;
    const ex = loadPoint.x - centroid.x;
    const ey = loadPoint.y - centroid.y;
    const M = (appliedForces.M || 0) + Px * ey - Py * ex;
    
    // Calculate stress distribution
    const effectiveThroat = welds[0].size * Math.SQRT1_2; // Assume uniform weld size
    const stressDistribution: WeldGroupResult['stressDistribution'] = [];
    
    let maxCombinedStress = 0;
    let criticalLocation = { x: 0, y: 0 };
    
    for (let i = 0; i < welds.length; i++) {
      const weld = welds[i];
      const dx = weld.x - centroid.x;
      const dy = weld.y - centroid.y;
      const r = Math.sqrt(dx * dx + dy * dy);
      
      // Direct stress (force per unit length)
      const directStressX = Px / totalLength;
      const directStressY = Py / totalLength;
      const directStress = Math.sqrt(directStressX * directStressX + directStressY * directStressY);
      
      // Torsional stress (perpendicular to radial line)
      const torsionalStress = r > 0 ? (M * r) / Ip : 0;
      
      // Combined stress (vector sum - simplified)
      const combinedStress = Math.sqrt(
        Math.pow(directStressX + torsionalStress * dy / r, 2) +
        Math.pow(directStressY - torsionalStress * dx / r, 2)
      ) || directStress;
      
      stressDistribution.push({
        weldIndex: i,
        directStress,
        torsionalStress,
        combinedStress
      });
      
      if (combinedStress > maxCombinedStress) {
        maxCombinedStress = combinedStress;
        criticalLocation = { x: weld.x, y: weld.y };
      }
    }
    
    // Design strength
    const Fnw = 0.60 * material.FEXX;
    const phi = WELD_PHI_FACTORS.AISC.fillet;
    const designStrength = phi * Fnw * effectiveThroat;
    
    // Convert stress per unit length to equivalent stress
    const maxStress = maxCombinedStress / effectiveThroat;
    
    return {
      centroid,
      polarMomentOfInertia: Ip,
      maxStress,
      designStrength,
      utilizationRatio: maxStress / designStrength,
      isAdequate: maxStress <= designStrength,
      criticalWeldLocation: criticalLocation,
      stressDistribution
    };
  }
}

// ============================================================================
// Eurocode 3 Weld Calculator
// ============================================================================

class EC3WeldCalculator {
  private readonly gamma_M2 = 1.25;
  private readonly betaW_values: Record<string, number> = {
    'S235': 0.80,
    'S275': 0.85,
    'S355': 0.90,
    'S420': 1.00,
    'S460': 1.00
  };

  /**
   * Calculate fillet weld strength per EC3 Section 4.5
   */
  calculateFilletWeld(input: FilletWeldInput): FilletWeldResult {
    const { weldSize, weldLength, orientation, material, appliedLoad, basePlateThickness } = input;
    
    // Effective throat (same as AISC for equal leg fillet)
    const effectiveThroat = weldSize * Math.SQRT1_2;
    
    // Effective length
    const effectiveLength = Math.max(weldLength - 2 * weldSize, 6 * weldSize);
    
    // Correlation factor βw
    const betaW = this.getBetaW(material.baseMetal);
    
    // Design resistance per unit length (directional method)
    // For simplified method: fw,Rd = fu / (√3 × βw × γM2)
    const fu = material.Fu; // MPa
    const fvw_d = fu / (Math.sqrt(3) * betaW * this.gamma_M2);
    
    // Nominal strength
    const Rn = fvw_d * effectiveThroat * effectiveLength * (input.numberOfWelds || 1);
    
    // Size limits
    const minSize = this.getMinimumFilletSize(basePlateThickness);
    const maxSize = Math.min(0.7 * basePlateThickness, weldSize);
    
    // Utilization
    const utilizationRatio = appliedLoad / Rn;
    
    const warnings: string[] = [];
    if (weldSize < minSize) {
      warnings.push(`⚠️ Weld size (${weldSize}mm) is less than minimum (${minSize}mm)`);
    }
    if (effectiveLength < 6 * weldSize) {
      warnings.push('⚠️ Effective length less than 6 × throat thickness');
    }
    if (effectiveLength > 150 * effectiveThroat) {
      warnings.push('⚠️ Long weld - apply reduction factor βLw');
    }
    
    return {
      designCode: input.designCode,
      weldSize,
      effectiveThroat,
      effectiveLength,
      weldStrength: Rn * this.gamma_M2, // Nominal (unfactored)
      designStrength: Rn,
      appliedLoad,
      utilizationRatio,
      isAdequate: utilizationRatio <= 1.0,
      minSize,
      maxSize,
      warnings,
      detailingRequirements: [
        `Minimum throat: ${(3).toFixed(0)}mm`,
        `Correlation factor βw = ${betaW}`,
        `Design strength fvw,d = ${fvw_d.toFixed(1)} MPa`
      ]
    };
  }

  /**
   * Get correlation factor βw for steel grade
   */
  private getBetaW(steelGrade: string): number {
    for (const [grade, beta] of Object.entries(this.betaW_values)) {
      if (steelGrade.includes(grade)) {
        return beta;
      }
    }
    return 0.90; // Default for S355
  }

  /**
   * Get minimum fillet weld size per EC3
   */
  private getMinimumFilletSize(thickness: number): number {
    // EC3 recommends a ≥ 3mm minimum
    if (thickness <= 10) return 3;
    if (thickness <= 20) return 4;
    if (thickness <= 30) return 5;
    return 6;
  }

  /**
   * Directional method for fillet weld per EC3 Section 4.5.3.2
   */
  calculateDirectionalMethod(
    sigma_perp: number,  // Normal stress perpendicular to throat
    tau_perp: number,    // Shear stress perpendicular to throat
    tau_parallel: number, // Shear stress parallel to weld axis
    fu: number,          // Ultimate tensile strength
    betaW: number
  ): { isAdequate: boolean; utilization: number } {
    // EC3 Eq. 4.1
    const lhs = Math.sqrt(sigma_perp * sigma_perp + 3 * (tau_perp * tau_perp + tau_parallel * tau_parallel));
    const rhs = fu / (betaW * this.gamma_M2);
    
    // Also check: σ⊥ ≤ 0.9 × fu / γM2
    const sigma_limit = 0.9 * fu / this.gamma_M2;
    
    const utilization = Math.max(lhs / rhs, Math.abs(sigma_perp) / sigma_limit);
    
    return {
      isAdequate: utilization <= 1.0,
      utilization
    };
  }
}

// ============================================================================
// IS 800:2007 Weld Calculator
// ============================================================================

class IS800WeldCalculator {
  private readonly gamma_mw = 1.25; // Shop welds
  private readonly gamma_mw_field = 1.50; // Field welds

  /**
   * Calculate fillet weld strength per IS 800 Section 10.5
   */
  calculateFilletWeld(input: FilletWeldInput, isFieldWeld: boolean = false): FilletWeldResult {
    const { weldSize, weldLength, orientation, material, appliedLoad, basePlateThickness } = input;
    
    // Throat thickness
    const effectiveThroat = 0.7 * weldSize; // IS 800 uses 0.7s
    
    // Effective length
    const effectiveLength = weldLength - 2 * weldSize;
    
    // Design strength of weld per IS 800 Clause 10.5.7.1.1
    // fwd = fwn / γmw where fwn = fu / √3
    const fu = material.Fu;
    const fwn = fu / Math.sqrt(3);
    const gamma = isFieldWeld ? this.gamma_mw_field : this.gamma_mw;
    const fwd = fwn / gamma;
    
    // Weld strength
    const Rn = fwd * effectiveThroat * effectiveLength * (input.numberOfWelds || 1);
    
    // Size limits per IS 800 Clause 10.5.2
    const minSize = this.getMinimumFilletSize(basePlateThickness);
    const maxSize = basePlateThickness - 1.5; // Leave 1.5mm for fusion
    
    const utilizationRatio = appliedLoad / Rn;
    
    const warnings: string[] = [];
    if (weldSize < minSize) {
      warnings.push(`⚠️ Weld size (${weldSize}mm) less than minimum (${minSize}mm)`);
    }
    if (effectiveLength < 4 * weldSize) {
      warnings.push('⚠️ Effective length less than 4 × weld size');
    }
    
    return {
      designCode: input.designCode,
      weldSize,
      effectiveThroat,
      effectiveLength,
      weldStrength: Rn * gamma,
      designStrength: Rn,
      appliedLoad,
      utilizationRatio,
      isAdequate: utilizationRatio <= 1.0,
      minSize,
      maxSize,
      warnings,
      detailingRequirements: [
        `Design weld strength fwd = ${fwd.toFixed(1)} MPa`,
        `Throat thickness = 0.7 × ${weldSize} = ${effectiveThroat.toFixed(1)} mm`,
        isFieldWeld ? 'Field weld (γmw = 1.50)' : 'Shop weld (γmw = 1.25)'
      ]
    };
  }

  /**
   * Get minimum fillet weld size per IS 800 Table 21
   */
  private getMinimumFilletSize(thickness: number): number {
    if (thickness <= 10) return 3;
    if (thickness <= 20) return 5;
    if (thickness <= 32) return 6;
    return 8; // First run for thicker plates
  }
}

// ============================================================================
// Main Welded Connection Calculator
// ============================================================================

export class WeldedConnectionCalculator {
  private aiscCalc = new AISCWeldCalculator();
  private ec3Calc = new EC3WeldCalculator();
  private is800Calc = new IS800WeldCalculator();

  /**
   * Design fillet weld for given parameters
   */
  designFilletWeld(input: FilletWeldInput): FilletWeldResult {
    switch (input.designCode) {
      case WeldDesignCode.AWS_D1_1:
      case WeldDesignCode.AISC_360:
        return this.aiscCalc.calculateFilletWeld(input);
      case WeldDesignCode.EUROCODE_3:
        return this.ec3Calc.calculateFilletWeld(input);
      case WeldDesignCode.IS_800:
        return this.is800Calc.calculateFilletWeld(input);
      default:
        return this.aiscCalc.calculateFilletWeld(input);
    }
  }

  /**
   * Design groove weld for given parameters
   */
  designGrooveWeld(input: GrooveWeldInput): GrooveWeldResult {
    if (input.weldType === WeldType.COMPLETE_JOINT_PENETRATION) {
      return this.aiscCalc.calculateCJPWeld(input);
    } else {
      return this.aiscCalc.calculatePJPWeld(input);
    }
  }

  /**
   * Analyze weld group under eccentric loading
   */
  analyzeWeldGroup(input: WeldGroupInput): WeldGroupResult {
    return this.aiscCalc.analyzeWeldGroup(input);
  }

  /**
   * Calculate required fillet weld size for given load
   */
  calculateRequiredWeldSize(
    designCode: WeldDesignCode,
    appliedLoad: number,      // kips or kN
    weldLength: number,       // in or mm
    material: WeldMaterial,
    numberOfWelds: number = 2
  ): { requiredSize: number; roundedSize: number; unit: string } {
    const FEXX = material.FEXX;
    let requiredThroat: number;
    let unit: string;
    
    if (designCode === WeldDesignCode.AISC_360 || designCode === WeldDesignCode.AWS_D1_1) {
      // AISC: φRn = φ × 0.60 × FEXX × te × L
      const phi = 0.75;
      requiredThroat = appliedLoad / (phi * 0.60 * FEXX * weldLength * numberOfWelds);
      unit = 'in';
    } else if (designCode === WeldDesignCode.EUROCODE_3) {
      // EC3: Rn = (fu / (√3 × βw × γM2)) × a × L
      const fu = material.Fu;
      const betaW = 0.9; // Assume S355
      const gamma_M2 = 1.25;
      requiredThroat = appliedLoad / ((fu / (Math.sqrt(3) * betaW * gamma_M2)) * weldLength * numberOfWelds);
      unit = 'mm';
    } else {
      // IS 800
      const fu = material.Fu;
      const fwd = fu / (Math.sqrt(3) * 1.25);
      requiredThroat = appliedLoad / (fwd * weldLength * numberOfWelds);
      unit = 'mm';
    }
    
    // Convert throat to weld size
    const requiredSize = requiredThroat / 0.707;
    
    // Round up to standard size
    let roundedSize: number;
    if (unit === 'in') {
      // Standard US sizes: 3/16", 1/4", 5/16", 3/8", 1/2", 5/8", 3/4"
      const standardSizes = [0.1875, 0.25, 0.3125, 0.375, 0.5, 0.625, 0.75];
      roundedSize = standardSizes.find(s => s >= requiredSize) || 0.75;
    } else {
      // Standard metric sizes: 3, 4, 5, 6, 8, 10, 12mm
      const standardSizes = [3, 4, 5, 6, 8, 10, 12];
      roundedSize = standardSizes.find(s => s >= requiredSize) || 12;
    }
    
    return { requiredSize, roundedSize, unit };
  }

  /**
   * Get weld symbols and notation for drawings
   */
  getWeldSymbol(weldType: WeldType, size: number, length: number): {
    symbol: string;
    arrowSideNote: string;
    otherSideNote: string;
    tailNote: string;
  } {
    let symbol: string;
    
    switch (weldType) {
      case WeldType.FILLET:
        symbol = '△'; // Fillet weld symbol (isoceles triangle)
        break;
      case WeldType.COMPLETE_JOINT_PENETRATION:
        symbol = '▽'; // Single-V groove
        break;
      case WeldType.PARTIAL_JOINT_PENETRATION:
        symbol = '◁'; // Single-bevel
        break;
      default:
        symbol = '—';
    }
    
    return {
      symbol,
      arrowSideNote: `${size} × ${length}`,
      otherSideNote: '',
      tailNote: 'AWS A2.4'
    };
  }

  /**
   * Check weld fatigue per AISC Appendix 3
   */
  checkFatigue(
    stressRange: number,    // ksi
    numberOfCycles: number,
    fatigueCategory: 'A' | 'B' | 'B\'' | 'C' | 'C\'' | 'D' | 'E' | 'E\'' | 'F'
  ): { isAdequate: boolean; allowableStressRange: number; cyclesToFailure: number } {
    // AISC Table A-3.1 constant Cf
    const Cf: Record<string, number> = {
      'A': 250e8,
      'B': 120e8,
      'B\'': 61e8,
      'C': 44e8,
      'C\'': 44e8,
      'D': 22e8,
      'E': 11e8,
      'E\'': 3.9e8,
      'F': 150e8
    };
    
    // Threshold FTH (ksi)
    const FTH: Record<string, number> = {
      'A': 24,
      'B': 16,
      'B\'': 12,
      'C': 10,
      'C\'': 12,
      'D': 7,
      'E': 4.5,
      'E\'': 2.6,
      'F': 8
    };
    
    // Allowable stress range
    const cf = Cf[fatigueCategory];
    const fth = FTH[fatigueCategory];
    const allowableStressRange = Math.max(Math.pow(cf / numberOfCycles, 1/3), fth);
    
    // Cycles to failure at given stress range
    const cyclesToFailure = cf / Math.pow(stressRange, 3);
    
    return {
      isAdequate: stressRange <= allowableStressRange,
      allowableStressRange,
      cyclesToFailure
    };
  }
}

// Export singleton instance
export const weldedConnectionCalculator = new WeldedConnectionCalculator();
