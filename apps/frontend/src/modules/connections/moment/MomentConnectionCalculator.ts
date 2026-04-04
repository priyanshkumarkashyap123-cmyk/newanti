/**
 * Moment Connection Calculator
 * AISC 358-22 Pre-qualified connections for seismic applications
 * 
 * Supports:
 * - Reduced Beam Section (RBS) "Dogbone"
 * - Bolted Flange Plate (BFP)
 * - Extended End Plate (EEP)
 * - Panel zone checks
 * - Continuity plate requirements
 */

import {
  MomentConnectionDesignCode,
  FrameType,
  RBSInput,
  RBSResult,
  BFPInput,
  BFPResult,
  EndPlateInput,
  EndPlateResult,
  WideFlangeSectionData,
  CalculationStep,
  RBS_LIMITS,
  PREQUALIFIED_LIMITS,
} from './MomentConnectionTypes';

// ============================================================================
// RBS Calculator - AISC 358-22 Chapter 5
// ============================================================================

class RBSCalculator {
  /**
   * Design RBS connection per AISC 358-22
   */
  calculate(input: RBSInput): RBSResult {
    const calculations: CalculationStep[] = [];
    const checks: RBSResult['checks'] = [];
    
    const { beam, column, beamSpan, Ry, Cpr } = input;
    const Fy = input.beamFy;
    const Fu = input.beamFu;
    
    // Step 1: Determine RBS dimensions
    // a = distance from column face to start of RBS cut
    const a_min = RBS_LIMITS.a_min_factor * beam.bf;
    const a_max = RBS_LIMITS.a_max_factor * beam.bf;
    const a = input.a || (a_min + a_max) / 2;
    
    calculations.push({
      step: 1,
      description: 'Determine distance a from column face to start of RBS cut',
      formula: '0.5bf ≤ a ≤ 0.75bf',
      values: { bf: beam.bf, a_min, a_max },
      result: a,
      unit: 'in',
      reference: 'AISC 358-22 §5.8'
    });
    
    // b = length of RBS cut
    const b_min = RBS_LIMITS.b_min_factor * beam.d;
    const b_max = RBS_LIMITS.b_max_factor * beam.d;
    const b = input.b || (b_min + b_max) / 2;
    
    calculations.push({
      step: 2,
      description: 'Determine length b of RBS cut',
      formula: '0.65d ≤ b ≤ 0.85d',
      values: { d: beam.d, b_min, b_max },
      result: b,
      unit: 'in',
      reference: 'AISC 358-22 §5.8'
    });
    
    // c = depth of cut at center (start with 20% of bf)
    const c_max = RBS_LIMITS.c_max_factor * beam.bf;
    let c = input.c || 0.20 * beam.bf;
    c = Math.min(c, c_max);
    
    calculations.push({
      step: 3,
      description: 'Determine depth c of RBS cut',
      formula: 'c ≤ 0.25bf',
      values: { bf: beam.bf, c_max },
      result: c,
      unit: 'in',
      reference: 'AISC 358-22 §5.8'
    });
    
    // Step 2: Calculate radius of cut
    const R = (4 * c * c + b * b) / (8 * c);
    
    calculations.push({
      step: 4,
      description: 'Calculate radius of RBS cut',
      formula: 'R = (4c² + b²) / 8c',
      values: { c, b },
      result: R,
      unit: 'in',
      reference: 'AISC 358-22 §5.8'
    });
    
    // Step 3: Calculate section properties at center of RBS
    const bf_RBS = beam.bf - 2 * c;
    const ZRBS = beam.Zx - 2 * c * beam.tf * (beam.d - beam.tf);
    const SRBS = ZRBS / 1.1; // Approximate
    
    calculations.push({
      step: 5,
      description: 'Calculate plastic section modulus at center of RBS',
      formula: 'ZRBS = Zx - 2c·tf·(d - tf)',
      values: { Zx: beam.Zx, c, tf: beam.tf, d: beam.d },
      result: ZRBS,
      unit: 'in³',
      reference: 'AISC 358-22 §5.8'
    });
    
    // Check ZRBS ≥ 0.7 Zx
    const ZRBS_min = RBS_LIMITS.ZRBS_min_factor * beam.Zx;
    checks.push({
      name: 'RBS Section Modulus Check',
      demand: ZRBS_min,
      capacity: ZRBS,
      ratio: ZRBS_min / ZRBS,
      status: ZRBS >= ZRBS_min ? 'OK' : 'NG',
      reference: 'AISC 358-22 §5.8'
    });
    
    // Step 4: Calculate probable maximum moment at RBS
    const Mpr = Cpr * Ry * Fy * ZRBS;
    
    calculations.push({
      step: 6,
      description: 'Calculate probable maximum moment at center of RBS',
      formula: 'Mpr = Cpr·Ry·Fy·ZRBS',
      values: { Cpr, Ry, Fy, ZRBS },
      result: Mpr,
      unit: 'kip-in',
      reference: 'AISC 358-22 Eq. 5.8-6'
    });
    
    // Step 5: Calculate shear force at center of RBS
    // Assume gravity load is small compared to seismic
    const Sh = a + b / 2;  // Distance from column face to center of RBS
    const Lh = beamSpan - 2 * Sh;  // Clear span between RBS centers
    const Vpr = 2 * Mpr / Lh;
    
    calculations.push({
      step: 7,
      description: 'Calculate probable shear at center of RBS',
      formula: 'Vpr = 2Mpr / Lh',
      values: { Mpr, Lh },
      result: Vpr,
      unit: 'kips',
      reference: 'AISC 358-22 Eq. 5.8-7'
    });
    
    // Step 6: Calculate moment at face of column
    const Mf = Mpr + Vpr * Sh;
    
    calculations.push({
      step: 8,
      description: 'Calculate moment at face of column',
      formula: 'Mf = Mpr + Vpr·Sh',
      values: { Mpr, Vpr, Sh },
      result: Mf,
      unit: 'kip-in',
      reference: 'AISC 358-22 Eq. 5.8-8'
    });
    
    // Step 7: Check beam flexural strength at face of column
    const phiMp = 0.9 * Fy * beam.Zx;
    const Mc = Mf;
    
    checks.push({
      name: 'Beam Flexure at Column Face',
      demand: Mc,
      capacity: phiMp,
      ratio: Mc / phiMp,
      status: Mc <= phiMp ? 'OK' : 'NG',
      reference: 'AISC 358-22 §5.4'
    });
    
    // Step 8: Panel zone check (if requested)
    let panelZone: RBSResult['panelZone'] | undefined;
    if (input.checkPanelZone !== false) {
      panelZone = this.checkPanelZone(column, Mf, beam.d, input.columnFy);
    }
    
    // Step 9: Check continuity plates
    const continuityPlates = this.checkContinuityPlates(beam, column, input.columnFy);
    
    // Step 10: Design web connection
    const webConnection = this.designWebConnection(beam, Vpr);
    
    // Step 11: Calculate lateral bracing requirements
    const Lb_max = 0.086 * beam.ry * 29000 / Fy;
    const lateralBracing = {
      Lb_max,
      requiredAtRBS: true  // Always required for SMF
    };
    
    calculations.push({
      step: 12,
      description: 'Maximum unbraced length for beam',
      formula: 'Lb_max = 0.086·ry·E/Fy',
      values: { ry: beam.ry, E: 29000, Fy },
      result: Lb_max,
      unit: 'in',
      reference: 'AISC 341 D1.2b'
    });
    
    // Determine overall adequacy
    const isAdequate = checks.every(c => c.status !== 'NG') &&
                       (!panelZone || panelZone.ratio <= 1.0);
    
    return {
      isAdequate,
      a,
      b,
      c,
      R,
      ZRBS,
      SRBS,
      Mpr,
      Mf,
      Vpr,
      VfColumn: Vpr,
      checks,
      panelZone,
      continuityPlates,
      webConnection,
      lateralBracing,
      calculations,
      codeReference: 'AISC 358-22 Chapter 5'
    };
  }
  
  /**
   * Check panel zone per AISC 360 J10.6
   */
  private checkPanelZone(
    column: WideFlangeSectionData,
    Mf: number,
    beamDepth: number,
    Fyc: number
  ): RBSResult['panelZone'] {
    // Panel zone shear demand
    const db = beamDepth;
    const dc = column.d;
    const tcf = column.tf;
    const tcw = column.tw;
    const bcf = column.bf;
    
    // Panel zone shear
    const Vp = Mf / (db - tcf);
    
    // Panel zone capacity (AISC 360 Eq. J10-11)
    const phi = 0.9;
    const Rv = 0.60 * Fyc * dc * tcw * (1 + (3 * bcf * tcf * tcf) / (db * dc * tcw));
    const phiRv = phi * Rv;
    
    const ratio = Vp / phiRv;
    const doublerRequired = ratio > 1.0;
    
    let doublerThickness: number | undefined;
    if (doublerRequired) {
      // Required doubler plate thickness
      doublerThickness = (Vp - phiRv) / (0.9 * 0.60 * Fyc * dc);
      doublerThickness = Math.ceil(doublerThickness * 16) / 16; // Round to 1/16"
    }
    
    return {
      Vp,
      phiRv,
      doublerRequired,
      doublerThickness,
      ratio
    };
  }
  
  /**
   * Check continuity plate requirements per AISC 360 J10
   */
  private checkContinuityPlates(
    beam: WideFlangeSectionData,
    column: WideFlangeSectionData,
    Fyc: number
  ): RBSResult['continuityPlates'] {
    const bbf = beam.bf;
    const tbf = beam.tf;
    const tcf = column.tf;
    const tcw = column.tw;
    const dc = column.d;
    const kc = column.k;
    
    // Check local flange bending (AISC 360 J10.1)
    // tcf ≥ 0.4 * sqrt(Fyb/Fyc) * bbf (simplified)
    const tcf_req_flange = 0.4 * Math.sqrt(50 / Fyc) * tbf;
    
    // Check local web yielding (AISC 360 J10.2)
    const tcf_req_web = tbf / 6;
    
    const required = tcf < tcf_req_flange || tcf < tcf_req_web;
    
    let thickness: number | undefined;
    let reason: string | undefined;
    
    if (required) {
      // Continuity plate thickness ≥ max(tbf/2, 3/8")
      thickness = Math.max(tbf / 2, 0.375);
      thickness = Math.ceil(thickness * 16) / 16;
      reason = tcf < tcf_req_flange 
        ? 'Required for local flange bending'
        : 'Required for local web yielding';
    }
    
    return { required, thickness, reason };
  }
  
  /**
   * Design web connection (single plate shear tab)
   */
  private designWebConnection(
    beam: WideFlangeSectionData,
    Vpr: number
  ): RBSResult['webConnection'] {
    // Standard shear tab design
    const phi = 0.75;
    const Fv = 54; // A325-N nominal shear (ksi)
    
    // Start with 3/8" plate, 3/4" bolts
    let numBolts = Math.ceil(Vpr / (phi * Fv * 0.4418)); // 3/4" bolt area
    numBolts = Math.max(numBolts, 3); // Minimum 3 bolts
    
    const boltDiameter = 0.75;
    const shearTabThickness = 0.375;
    const shearTabDepth = (numBolts - 1) * 3 + 3; // 3" pitch, 1.5" edge distance each end
    
    // Weld size (fillet weld to column)
    const weldSize = Math.max(shearTabThickness * 5/8, 0.25);
    
    return {
      shearTabThickness,
      shearTabDepth,
      numBolts,
      boltDiameter,
      weldSize: Math.ceil(weldSize * 16) / 16
    };
  }
}

// ============================================================================
// BFP Calculator - AISC 358-22 Chapter 7
// ============================================================================

class BFPCalculator {
  calculate(input: BFPInput): BFPResult {
    const calculations: CalculationStep[] = [];
    const checks: BFPResult['checks'] = [];
    
    const { beam, column, Ry, Cpr } = input;
    const Fyb = beam.Fy;
    const Fub = beam.Fu;
    const Fyp = input.flangeplateFy;
    const Fup = input.flangeplateFu;
    
    // Step 1: Determine probable maximum moment
    const Mpr = Cpr * Ry * Fyb * beam.Zx;
    
    calculations.push({
      step: 1,
      description: 'Calculate probable maximum moment at plastic hinge',
      formula: 'Mpr = Cpr·Ry·Fy·Zx',
      values: { Cpr, Ry, Fyb, Zx: beam.Zx },
      result: Mpr,
      unit: 'kip-in',
      reference: 'AISC 358-22 Eq. 7.6-1'
    });
    
    // Step 2: Calculate flange force
    const Ffu = Mpr / (beam.d - beam.tf);
    
    calculations.push({
      step: 2,
      description: 'Calculate flange force',
      formula: 'Ffu = Mpr / (d - tf)',
      values: { Mpr, d: beam.d, tf: beam.tf },
      result: Ffu,
      unit: 'kips',
      reference: 'AISC 358-22 §7.6'
    });
    
    // Step 3: Design flange plates
    // Gross section yielding
    const phiYield = 0.9;
    const Ag_req = Ffu / (phiYield * Fyp);
    
    // Net section rupture
    const phiRupture = 0.75;
    const An_req = Ffu / (phiRupture * Fup);
    
    // Plate width ≥ beam flange width
    const plateWidth = input.topPlateWidth || beam.bf + 1;
    
    // Calculate required thickness
    const tp_yield = Ag_req / plateWidth;
    const boltHoles = input.numBoltsPerRow * (input.boltDiameter + 0.125);
    const An_net_width = plateWidth - boltHoles;
    const tp_rupture = An_req / An_net_width;
    
    let plateThickness = Math.max(tp_yield, tp_rupture);
    plateThickness = Math.ceil(plateThickness * 16) / 16;
    plateThickness = Math.max(plateThickness, 0.5); // Minimum 1/2"
    
    calculations.push({
      step: 3,
      description: 'Design flange plate thickness',
      values: { Ag_req, An_req, plateWidth },
      result: plateThickness,
      unit: 'in',
      reference: 'AISC 358-22 §7.6'
    });
    
    // Step 4: Check bolt capacity
    const phi = 0.75;
    const numBolts = input.numBoltsPerRow * input.numRows;
    const Ab = Math.PI * Math.pow(input.boltDiameter, 2) / 4;
    
    // Tension capacity (slip-critical not required per AISC 358)
    const Fnt = 0.75 * input.boltFu;
    const phiRn_tension = phi * Fnt * Ab * numBolts;
    
    checks.push({
      name: 'Bolt Tension Capacity',
      demand: Ffu,
      capacity: phiRn_tension,
      ratio: Ffu / phiRn_tension,
      status: Ffu <= phiRn_tension ? 'OK' : 'NG',
      reference: 'AISC 360 J3.6'
    });
    
    // Step 5: Check bearing
    const phiBearing = 0.75;
    const Lc = input.boltPitch - input.boltDiameter - 0.0625;
    const Rn_bearing = Math.min(1.2 * Lc * plateThickness * Fup, 2.4 * input.boltDiameter * plateThickness * Fup);
    const phiRn_bearing = phiBearing * Rn_bearing * numBolts;
    
    checks.push({
      name: 'Bolt Bearing Capacity',
      demand: Ffu,
      capacity: phiRn_bearing,
      ratio: Ffu / phiRn_bearing,
      status: Ffu <= phiRn_bearing ? 'OK' : 'NG',
      reference: 'AISC 360 J3.10'
    });
    
    // Step 6: Plate-to-column weld
    const weldSize = input.plateToColumnWeldSize;
    const effectiveThroat = weldSize * 0.707;
    const weldLength = 2 * plateWidth; // Both sides
    const Fw = 0.60 * 70; // E70 electrode
    const phiRn_weld = 0.75 * Fw * effectiveThroat * weldLength;
    
    checks.push({
      name: 'Plate-to-Column Weld',
      demand: Ffu,
      capacity: phiRn_weld,
      ratio: Ffu / phiRn_weld,
      status: Ffu <= phiRn_weld ? 'OK' : 'NG',
      reference: 'AISC 360 J2'
    });
    
    // Calculate plate length
    const edgeDistance = 1.5 * input.boltDiameter;
    const plateLength = 2 * edgeDistance + (input.numRows - 1) * input.boltPitch + 2; // +2" to column
    
    const isAdequate = checks.every(c => c.status !== 'NG');
    
    return {
      isAdequate,
      topPlate: {
        width: plateWidth,
        thickness: plateThickness,
        length: plateLength
      },
      bottomPlate: {
        width: plateWidth,
        thickness: plateThickness,
        length: plateLength
      },
      bolts: {
        diameter: input.boltDiameter,
        numBoltsPerRow: input.numBoltsPerRow,
        numRows: input.numRows,
        totalBolts: numBolts * 2, // Top and bottom
        tensionPerBolt: Ffu / numBolts,
        shearPerBolt: 0 // Tension only
      },
      checks,
      welds: {
        plateToColumnType: input.weldType,
        plateToColumnSize: weldSize,
        plateToBeamType: 'CJP',
        plateToBeamSize: beam.tf
      },
      continuityPlates: { required: true, thickness: beam.tf },
      calculations,
      codeReference: 'AISC 358-22 Chapter 7'
    };
  }
}

// ============================================================================
// End Plate Calculator - AISC 358-22 Chapter 6
// ============================================================================

class EndPlateCalculator {
  calculate(input: EndPlateInput): EndPlateResult {
    const calculations: CalculationStep[] = [];
    const checks: EndPlateResult['checks'] = [];
    
    const { beam, column, Ry, Cpr, connectionType } = input;
    const Fyb = beam.Fy;
    const Fyp = input.endPlateFy;
    const Fup = input.endPlateFu;
    
    // Step 1: Calculate probable maximum moment
    const Mpr = Cpr * Ry * Fyb * beam.Zx;
    
    // Step 2: Calculate flange force
    const Ffu = Mpr / (beam.d - beam.tf);
    
    // Step 3: Calculate bolt tension
    const numBoltsOutside = input.numBoltsOutsideTensionFlange;
    const numBoltsInside = input.numBoltsBetweenFlanges;
    const totalTensionBolts = numBoltsOutside + numBoltsInside / 2; // Inside bolts shared
    
    const Ab = Math.PI * Math.pow(input.boltDiameter, 2) / 4;
    const Fnt = 0.75 * input.boltFu;
    const phi = 0.75;
    
    // Check bolt tension
    const TuPerBolt = Ffu / totalTensionBolts;
    const phiRn = phi * Fnt * Ab;
    
    checks.push({
      name: 'Bolt Tension',
      demand: TuPerBolt,
      capacity: phiRn,
      ratio: TuPerBolt / phiRn,
      status: TuPerBolt <= phiRn ? 'OK' : 'NG',
      reference: 'AISC 360 J3.6'
    });
    
    // Step 4: Calculate end plate thickness (yield line analysis)
    // Simplified formula for extended end plate
    const bp = input.endPlateWidth;
    const g = input.boltGageOutside;
    const pfo = input.pfo;
    const pfi = input.pfi;
    
    // Yield line parameter (simplified)
    let Yp: number;
    if (connectionType === 'BSEEP' || connectionType === 'EXT_EP') {
      // Extended end plate with stiffener
      const s = pfo;
      Yp = (bp / 2) * (1 / pfi + 1 / s) + 2 * (pfi + s);
    } else {
      // Extended end plate without stiffener
      Yp = (bp / 2) * (1 / pfi + 1 / pfo) + 2 * (pfi + pfo);
    }
    
    const tp_req = Math.sqrt(1.11 * Ffu * pfo / (0.9 * Fyp * Yp));
    
    calculations.push({
      step: 4,
      description: 'Calculate required end plate thickness',
      formula: 'tp = √(1.11·Ffu·pfo / φ·Fyp·Yp)',
      values: { Ffu, pfo, Fyp, Yp },
      result: tp_req,
      unit: 'in',
      reference: 'AISC 358-22 §6.10'
    });
    
    // Check provided thickness
    checks.push({
      name: 'End Plate Thickness',
      demand: tp_req,
      capacity: input.endPlateThickness,
      ratio: tp_req / input.endPlateThickness,
      status: tp_req <= input.endPlateThickness ? 'OK' : 'NG',
      reference: 'AISC 358-22 §6.10'
    });
    
    // Step 5: Check for prying action
    const b_prime = (g - beam.tw) / 2 - input.boltDiameter / 2;
    const a_prime = Math.min(1.25 * b_prime, pfo);
    const rho = b_prime / a_prime;
    const delta = 1 - input.boltDiameter / (g - beam.tw);
    
    const tc = Math.sqrt(4 * TuPerBolt * b_prime / (0.9 * bp * Fyp));
    const alpha = (1 / delta) * ((tc / input.endPlateThickness) ** 2 - 1);
    const Q = Math.min(alpha * delta, 1);
    
    const pryingForce = Q > 0 ? TuPerBolt * Q : 0;
    
    calculations.push({
      step: 5,
      description: 'Calculate prying force',
      values: { b_prime, a_prime, tc, alpha: Math.min(alpha, 1) },
      result: pryingForce,
      unit: 'kips',
      reference: 'AISC Manual Part 9'
    });
    
    // Step 6: Calculate plate length
    const plateLength = beam.d + 2 * pfo + numBoltsOutside * 3;
    
    // Step 7: Design stiffener if required
    let stiffener: EndPlateResult['stiffener'] | undefined;
    if (connectionType === 'BSEEP') {
      const ts = input.stiffenerThickness || beam.tw;
      const Ls = input.stiffenerLength || pfo + 2;
      stiffener = {
        thickness: ts,
        length: Ls,
        width: (bp - beam.tw) / 2 - 0.5
      };
    }
    
    const isAdequate = checks.every(c => c.status !== 'NG');
    
    return {
      isAdequate,
      endPlate: {
        width: bp,
        thickness: input.endPlateThickness,
        requiredThickness: Math.ceil(tp_req * 16) / 16,
        length: plateLength
      },
      stiffener,
      bolts: {
        numOutside: numBoltsOutside,
        numInside: numBoltsInside,
        totalBolts: numBoltsOutside + numBoltsInside,
        tensionPerBolt: TuPerBolt,
        pryingForce,
        totalTensionWithPrying: TuPerBolt + pryingForce
      },
      checks,
      welds: {
        flangeToPlateType: 'CJP',
        flangeToPlateSize: beam.tf,
        webToPlateType: 'FILLET',
        webToPlateSize: Math.max(beam.tw * 0.625, 0.25)
      },
      continuityPlates: { required: true, thickness: beam.tf },
      calculations,
      codeReference: 'AISC 358-22 Chapter 6'
    };
  }
}

// ============================================================================
// Main Moment Connection Calculator
// ============================================================================

export class MomentConnectionCalculator {
  private rbsCalc = new RBSCalculator();
  private bfpCalc = new BFPCalculator();
  private endPlateCalc = new EndPlateCalculator();
  
  calculateRBS(input: RBSInput): RBSResult {
    return this.rbsCalc.calculate(input);
  }
  
  calculateBFP(input: BFPInput): BFPResult {
    return this.bfpCalc.calculate(input);
  }
  
  calculateEndPlate(input: EndPlateInput): EndPlateResult {
    return this.endPlateCalc.calculate(input);
  }
}

export const momentConnectionCalculator = new MomentConnectionCalculator();
