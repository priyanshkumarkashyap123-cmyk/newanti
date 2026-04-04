/**
 * Gusset Plate Calculator
 * Design per AISC 341-22 and AISC 360-22
 * 
 * Key design concepts:
 * 1. Whitmore Section - effective width for tension/compression
 * 2. Block Shear - rupture along shear planes
 * 3. Uniform Force Method (UFM) - interface force distribution
 * 4. Clearance zones - for ductile folding (SCBF)
 * 5. Compact section limits - for expected strength
 */

import {
  GussetPlateInput,
  GussetPlateResult,
  CalculationStep,
  BracingSystemType,
  BraceToGussetConnection,
  SCBF_LIMITS,
} from './BracingConnectionTypes';

export class GussetPlateCalculator {
  private E = 29000; // ksi - Steel modulus
  private phi_y = 0.90; // Resistance factor for yielding
  private phi_r = 0.75; // Resistance factor for rupture
  private phi_w = 0.75; // Resistance factor for welds
  
  /**
   * Main calculation method for gusset plate design
   */
  calculate(input: GussetPlateInput): GussetPlateResult {
    const steps: CalculationStep[] = [];
    const checks: GussetPlateResult['checks'] = [];
    
    // Step 1: Calculate expected brace strengths (for SCBF capacity design)
    const { Ry, Rt, Fy, Fu, A, Ag } = input.braceSection;
    const An = input.braceSection.An || Ag * 0.85;
    
    const Py_expected = Ry * Fy * Ag;
    const Pn_expected_tension = Rt * Fu * An;
    const Pn_expected_compression = this.calculateExpectedCompression(input);
    
    steps.push({
      step: 1,
      description: 'Expected brace tension strength (AISC 341 F2.3)',
      formula: 'Pn = Ry × Fy × Ag',
      values: { Ry, Fy, Ag },
      result: Py_expected,
      unit: 'kips',
      reference: 'AISC 341-22 F2.3'
    });
    
    steps.push({
      step: 2,
      description: 'Expected brace compression strength',
      formula: 'Pn_comp = 1.14 × Fcre × Ag',
      values: { Fcre: Pn_expected_compression / Ag / 1.14, Ag },
      result: Pn_expected_compression,
      unit: 'kips',
      reference: 'AISC 341-22 F2.3'
    });
    
    // Step 2: Determine design forces
    // For SCBF, must design for expected strength
    let designTension: number;
    let designCompression: number;
    
    if (input.systemType === BracingSystemType.SCBF) {
      designTension = Py_expected;
      designCompression = Math.max(Pn_expected_compression, 1.14 * Pn_expected_compression);
    } else {
      designTension = input.Pu_tension;
      designCompression = input.Pu_compression;
    }
    
    steps.push({
      step: 3,
      description: 'Connection design forces',
      values: { 
        designTension,
        designCompression,
        systemType: input.systemType
      },
      result: Math.max(designTension, designCompression),
      unit: 'kips'
    });
    
    // Step 3: Whitmore section width
    const angle_rad = input.braceAngle * Math.PI / 180;
    const whitmore_angle_rad = SCBF_LIMITS.whitmore_angle * Math.PI / 180;
    
    // Connection length (estimate based on brace size)
    const Lc = this.estimateConnectionLength(input);
    const whitmore_width = input.braceSection.A / 0.5 + 2 * Lc * Math.tan(whitmore_angle_rad);
    
    steps.push({
      step: 4,
      description: 'Whitmore effective width',
      formula: 'Ww = Wb + 2 × Lc × tan(30°)',
      values: { Wb: input.braceSection.A / 0.5, Lc, angle: 30 },
      result: whitmore_width,
      unit: 'in',
      reference: 'AISC Manual Part 9'
    });
    
    // Step 4: Required gusset thickness
    // Based on Whitmore section yielding
    const t_required_tension = designTension / (this.phi_y * whitmore_width * input.gussetFy);
    
    // Based on buckling (Thornton method)
    const { t_required_buckling, L_avg } = this.calculateBucklingThickness(
      input, whitmore_width, designCompression
    );
    
    const t_min = Math.max(t_required_tension, t_required_buckling, 0.5);
    const t_gusset = input.gussetThickness || this.roundUpThickness(t_min);
    
    steps.push({
      step: 5,
      description: 'Required gusset thickness for tension',
      formula: 't = Pu / (φ × Ww × Fy)',
      values: { Pu: designTension, Ww: whitmore_width, Fy: input.gussetFy },
      result: t_required_tension,
      unit: 'in'
    });
    
    steps.push({
      step: 6,
      description: 'Required gusset thickness for buckling',
      formula: 'Thornton method with L_avg',
      values: { L_avg, t_required_buckling },
      result: t_required_buckling,
      unit: 'in'
    });
    
    // Step 5: Clearance zone (for SCBF ductile folding)
    let clearanceDimension: number;
    let clearanceType: 'LINEAR' | 'ELLIPTICAL';
    
    if (input.elliptical_clearance) {
      clearanceType = 'ELLIPTICAL';
      clearanceDimension = SCBF_LIMITS.ellipse_factor * t_gusset;
    } else {
      clearanceType = 'LINEAR';
      clearanceDimension = input.linear_clearance || (SCBF_LIMITS.clearance_factor * t_gusset);
    }
    
    steps.push({
      step: 7,
      description: 'Clearance zone for ductile folding',
      formula: clearanceType === 'LINEAR' ? 'c = 2t' : 'c = 8t (elliptical)',
      values: { t: t_gusset },
      result: clearanceDimension,
      unit: 'in',
      reference: 'AISC 341-22 F2.6c.4'
    });
    
    // Step 6: Gusset plate geometry
    const gusset = this.calculateGussetGeometry(input, t_gusset, whitmore_width, clearanceDimension);
    
    steps.push({
      step: 8,
      description: 'Gusset plate geometry',
      values: gusset,
      result: `${gusset.length_beam}" × ${gusset.length_column}" × ${t_gusset}"`
    });
    
    // Step 7: Capacity checks
    // Whitmore section tension
    const phi_Pn_tension = this.phi_y * whitmore_width * t_gusset * input.gussetFy;
    checks.push({
      name: 'Whitmore Section Tension',
      demand: designTension,
      capacity: phi_Pn_tension,
      ratio: designTension / phi_Pn_tension,
      status: designTension / phi_Pn_tension <= 1.0 ? 'OK' : 'NG',
      reference: 'AISC 360-22 J4.1'
    });
    
    // Whitmore section compression (Thornton)
    const phi_Pn_compression = this.calculateThorntonCapacity(
      whitmore_width, t_gusset, L_avg, input.gussetFy
    );
    checks.push({
      name: 'Whitmore Section Compression',
      demand: designCompression,
      capacity: phi_Pn_compression,
      ratio: designCompression / phi_Pn_compression,
      status: designCompression / phi_Pn_compression <= 1.0 ? 'OK' : 'NG',
      reference: 'AISC 360-22 J4.4'
    });
    
    // Step 8: Block shear (brace to gusset)
    const { phi_Rn_bs, Agv, Anv, Ant } = this.calculateBlockShear(input, t_gusset);
    checks.push({
      name: 'Block Shear at Brace',
      demand: designTension,
      capacity: phi_Rn_bs,
      ratio: designTension / phi_Rn_bs,
      status: designTension / phi_Rn_bs <= 1.0 ? 'OK' : 'NG',
      reference: 'AISC 360-22 J4.3'
    });
    
    steps.push({
      step: 9,
      description: 'Block shear capacity',
      formula: 'φRn = φ(0.6FuAnv + UbsFuAnt) ≤ φ(0.6FyAgv + UbsFuAnt)',
      values: { Agv, Anv, Ant, Fy: input.gussetFy, Fu: input.gussetFu },
      result: phi_Rn_bs,
      unit: 'kips'
    });
    
    // Step 9: Interface forces using Uniform Force Method (UFM)
    const interfaces = this.calculateUFMForces(input, gusset, designTension, designCompression);
    
    steps.push({
      step: 10,
      description: 'Interface forces (Uniform Force Method)',
      values: {
        H_beam: interfaces.beam.horizontal,
        V_beam: interfaces.beam.vertical,
        H_column: interfaces.column.horizontal,
        V_column: interfaces.column.vertical
      },
      result: 'See interface design',
      reference: 'AISC Manual Part 13'
    });
    
    // Step 10: Weld design
    const weldDesign = this.designInterfaceWelds(input, interfaces, t_gusset);
    
    // Check beam interface welds
    if (interfaces.beam.resultant > 0) {
      checks.push({
        name: 'Beam Interface Weld',
        demand: interfaces.beam.resultant,
        capacity: weldDesign.beam.capacity,
        ratio: interfaces.beam.resultant / weldDesign.beam.capacity,
        status: interfaces.beam.resultant / weldDesign.beam.capacity <= 1.0 ? 'OK' : 'NG',
        reference: 'AISC 360-22 J2.4'
      });
    }
    
    // Check column interface welds
    if (interfaces.column.resultant > 0) {
      checks.push({
        name: 'Column Interface Weld',
        demand: interfaces.column.resultant,
        capacity: weldDesign.column.capacity,
        ratio: interfaces.column.resultant / weldDesign.column.capacity,
        status: interfaces.column.resultant / weldDesign.column.capacity <= 1.0 ? 'OK' : 'NG',
        reference: 'AISC 360-22 J2.4'
      });
    }
    
    // Step 11: Brace-to-gusset connection design
    const braceConnection = this.designBraceConnection(input, t_gusset, designTension);
    
    steps.push({
      step: 11,
      description: 'Brace-to-gusset connection',
      values: {
        type: input.braceToGusset,
        weldSize: braceConnection.weldSize ?? 0,
        weldLength: braceConnection.weldLength ?? 0
      },
      result: 'See brace connection'
    });
    
    // SCBF-specific requirements
    let scbfRequirements: GussetPlateResult['scbfRequirements'];
    if (input.systemType === BracingSystemType.SCBF) {
      scbfRequirements = {
        ductileLimit: t_gusset >= t_required_tension && t_gusset >= t_required_buckling,
        clearanceProvided: clearanceDimension >= 2 * t_gusset,
        yielding_section: this.determineYieldingSection(input, t_gusset, whitmore_width)
      };
      
      steps.push({
        step: 12,
        description: 'SCBF requirements check',
        values: {
          ductileLimit: scbfRequirements.ductileLimit ? 1 : 0,
          clearanceProvided: scbfRequirements.clearanceProvided ? 1 : 0,
          yieldingSection: scbfRequirements.yielding_section
        },
        result: scbfRequirements.ductileLimit ? 'Compliant' : 'Non-compliant',
        reference: 'AISC 341-22 F2.6c'
      });
    }
    
    // Overall adequacy
    const isAdequate = checks.every(c => c.status === 'OK');
    
    return {
      isAdequate,
      gusset: {
        thickness: t_gusset,
        length_beam: gusset.length_beam,
        length_column: gusset.length_column,
        length_brace: gusset.length_brace,
        whitmore_width: whitmore_width,
        area_whitmore: whitmore_width * t_gusset
      },
      clearance: {
        type: clearanceType,
        dimension: clearanceDimension
      },
      checks,
      beamInterface: weldDesign.beam.capacity > 0 ? {
        weldSize: weldDesign.beam.size,
        weldLength: weldDesign.beam.length,
        forceHorizontal: interfaces.beam.horizontal,
        forceVertical: interfaces.beam.vertical
      } : undefined,
      columnInterface: weldDesign.column.capacity > 0 ? {
        weldSize: weldDesign.column.size,
        weldLength: weldDesign.column.length,
        forceHorizontal: interfaces.column.horizontal,
        forceVertical: interfaces.column.vertical
      } : undefined,
      braceConnection,
      scbfRequirements,
      calculations: steps,
      codeReference: 'AISC 341-22 Chapter F, AISC 360-22 Chapter J'
    };
  }
  
  /**
   * Calculate expected compression strength including buckling
   */
  private calculateExpectedCompression(input: GussetPlateInput): number {
    const { Fy, Ag, r_min, Ry } = input.braceSection;
    const KL = 1.0 * input.braceLength; // K=1.0 for pin-ended
    const slenderness = KL / r_min;
    
    // Expected critical stress
    const Fe = Math.PI * Math.PI * this.E / (slenderness * slenderness);
    const Fy_expected = Ry * Fy;
    
    let Fcre: number;
    if (Fy_expected / Fe <= 2.25) {
      // Inelastic buckling
      Fcre = 0.658 ** (Fy_expected / Fe) * Fy_expected;
    } else {
      // Elastic buckling
      Fcre = 0.877 * Fe;
    }
    
    return 1.14 * Fcre * Ag;
  }
  
  /**
   * Calculate required thickness for buckling (Thornton method)
   */
  private calculateBucklingThickness(
    input: GussetPlateInput,
    Ww: number,
    Pu: number
  ): { t_required_buckling: number; L_avg: number } {
    const angle_rad = input.braceAngle * Math.PI / 180;
    
    // Average buckling length (simplified)
    // More accurate methods use finite element or detailed geometry
    const L1 = Ww / (2 * Math.cos(angle_rad)); // Approximate unbraced length
    const L2 = Ww / (2 * Math.sin(angle_rad));
    const L3 = Ww / 2;
    const L_avg = (L1 + L2 + L3) / 3;
    
    // Required thickness for KL/r = 25 target
    const r_target = L_avg / 25;
    const t_required = r_target * Math.sqrt(12);
    
    // Verify capacity
    const Ag_gusset = Ww * t_required;
    const Fe = Math.PI * Math.PI * this.E / (25 * 25);
    
    let Fcr: number;
    if (input.gussetFy / Fe <= 2.25) {
      Fcr = 0.658 ** (input.gussetFy / Fe) * input.gussetFy;
    } else {
      Fcr = 0.877 * Fe;
    }
    
    const phi_Pn = 0.9 * Fcr * Ag_gusset;
    
    // Adjust if needed
    const scale = Pu > phi_Pn ? Math.sqrt(Pu / phi_Pn) : 1.0;
    
    return {
      t_required_buckling: t_required * scale,
      L_avg
    };
  }
  
  /**
   * Thornton compression capacity
   */
  private calculateThorntonCapacity(
    Ww: number,
    t: number,
    L_avg: number,
    Fy: number
  ): number {
    const r = t / Math.sqrt(12);
    const KL_r = Math.min(L_avg / r, 200);
    
    const Fe = Math.PI * Math.PI * this.E / (KL_r * KL_r);
    
    let Fcr: number;
    if (Fy / Fe <= 2.25) {
      Fcr = 0.658 ** (Fy / Fe) * Fy;
    } else {
      Fcr = 0.877 * Fe;
    }
    
    return 0.9 * Fcr * Ww * t;
  }
  
  /**
   * Calculate gusset geometry
   */
  private calculateGussetGeometry(
    input: GussetPlateInput,
    t: number,
    Ww: number,
    clearance: number
  ): {
    length_beam: number;
    length_column: number;
    length_brace: number;
  } {
    const angle_rad = input.braceAngle * Math.PI / 180;
    const Lc = this.estimateConnectionLength(input);
    
    // Work point setback
    const setback = clearance + Lc / 2;
    
    // Gusset edges
    const length_brace = Lc + 2 * clearance;
    const length_beam = setback / Math.cos(angle_rad) + Ww / 2;
    const length_column = setback / Math.sin(angle_rad) + Ww / 2;
    
    return {
      length_beam: Math.ceil(length_beam),
      length_column: Math.ceil(length_column),
      length_brace: Math.ceil(length_brace)
    };
  }
  
  /**
   * Calculate block shear capacity
   */
  private calculateBlockShear(
    input: GussetPlateInput,
    t: number
  ): { phi_Rn_bs: number; Agv: number; Anv: number; Ant: number } {
    const Lc = this.estimateConnectionLength(input);
    
    // Shear planes (both sides of slotted connection)
    const Agv = 2 * Lc * t;
    const Anv = Agv; // No holes in welded connection
    
    // Tension plane
    const Ant = input.braceSection.A / input.braceSection.Fy * 50; // Estimate
    
    const Ubs = 1.0; // Uniform stress
    const Fy = input.gussetFy;
    const Fu = input.gussetFu;
    
    // AISC 360 J4.3
    const Rn1 = 0.6 * Fu * Anv + Ubs * Fu * Ant;
    const Rn2 = 0.6 * Fy * Agv + Ubs * Fu * Ant;
    
    return {
      phi_Rn_bs: this.phi_r * Math.min(Rn1, Rn2),
      Agv,
      Anv,
      Ant
    };
  }
  
  /**
   * Calculate interface forces using Uniform Force Method
   */
  private calculateUFMForces(
    input: GussetPlateInput,
    gusset: { length_beam: number; length_column: number },
    Pt: number,
    Pc: number
  ): {
    beam: { horizontal: number; vertical: number; resultant: number };
    column: { horizontal: number; vertical: number; resultant: number };
  } {
    const alpha = input.braceAngle * Math.PI / 180;
    const P = Math.max(Pt, Pc);
    
    // Centroid locations (simplified)
    const eb = gusset.length_beam / 2;
    const ec = gusset.length_column / 2;
    
    // UFM parameters
    const r = Math.sqrt(eb * eb + ec * ec);
    const beta = Math.atan(eb / ec);
    
    // Interface forces
    const Hb = P * Math.cos(alpha) * ec / r;
    const Vb = P * Math.sin(alpha) * ec / r;
    const Hc = P * Math.cos(alpha) * eb / r;
    const Vc = P * Math.sin(alpha) * eb / r;
    
    return {
      beam: {
        horizontal: Math.abs(Hb),
        vertical: Math.abs(Vb),
        resultant: Math.sqrt(Hb * Hb + Vb * Vb)
      },
      column: {
        horizontal: Math.abs(Hc),
        vertical: Math.abs(Vc),
        resultant: Math.sqrt(Hc * Hc + Vc * Vc)
      }
    };
  }
  
  /**
   * Design interface welds
   */
  private designInterfaceWelds(
    input: GussetPlateInput,
    interfaces: {
      beam: { horizontal: number; vertical: number; resultant: number };
      column: { horizontal: number; vertical: number; resultant: number };
    },
    t_gusset: number
  ): {
    beam: { size: number; length: number; capacity: number };
    column: { size: number; length: number; capacity: number };
  } {
    const FEXX = input.weldElectrode;
    const Fnw = 0.6 * FEXX; // Weld metal strength
    
    // Design for both interfaces
    const designWeld = (force: number, maxLength: number): { size: number; length: number; capacity: number } => {
      if (force <= 0) return { size: 0, length: 0, capacity: 0 };
      
      // Start with 5/16" fillet
      let w = 5/16;
      const throat = 0.707 * w;
      const strength_per_inch = this.phi_w * Fnw * throat;
      
      // Required length
      let L = force / strength_per_inch;
      
      // Minimum 4 x weld size
      L = Math.max(L, 4 * w);
      
      // If length exceeds available, increase weld size
      if (L > maxLength * 0.9) {
        L = maxLength * 0.9;
        const throat_required = force / (this.phi_w * Fnw * L);
        w = throat_required / 0.707;
        w = this.roundUpWeld(w);
      }
      
      // Max weld = gusset thickness - 1/16"
      w = Math.min(w, t_gusset - 1/16);
      
      const capacity = this.phi_w * Fnw * 0.707 * w * L;
      
      return {
        size: w,
        length: Math.ceil(L),
        capacity
      };
    };
    
    // Available weld lengths (estimate)
    const beam_weld_length = input.beam ? input.beam.bf - 1 : 12;
    const column_weld_length = input.column ? input.column.d - 2 * input.column.tf : 12;
    
    return {
      beam: designWeld(interfaces.beam.resultant, beam_weld_length * 2), // Both sides
      column: designWeld(interfaces.column.resultant, column_weld_length * 2)
    };
  }
  
  /**
   * Design brace-to-gusset connection
   */
  private designBraceConnection(
    input: GussetPlateInput,
    t_gusset: number,
    designForce: number
  ): GussetPlateResult['braceConnection'] {
    const FEXX = input.weldElectrode;
    const Fnw = 0.6 * FEXX;
    
    if (input.braceToGusset === BraceToGussetConnection.SLOTTED_HSS) {
      // Slotted HSS connection
      const slot_length = 1.2 * designForce / (2 * this.phi_w * Fnw * 0.707 * (5/16));
      const weld_size = Math.min(5/16, t_gusset - 1/16);
      const weld_length = Math.ceil(slot_length);
      
      return {
        type: input.braceToGusset,
        weldSize: weld_size,
        weldLength: weld_length,
        slotLength: weld_length + 1,
        blockShearCapacity: this.phi_r * 0.6 * input.gussetFu * 2 * weld_length * t_gusset
      };
    }
    
    // Default welded connection
    const weld_length = designForce / (this.phi_w * Fnw * 0.707 * (5/16) * 4); // 4 lines of weld
    
    return {
      type: input.braceToGusset,
      weldSize: 5/16,
      weldLength: Math.ceil(weld_length)
    };
  }
  
  /**
   * Estimate connection length based on brace size
   */
  private estimateConnectionLength(input: GussetPlateInput): number {
    // Based on typical brace-to-gusset weld requirements
    const P_design = Math.max(input.Pu_tension, input.Pu_compression);
    const FEXX = input.weldElectrode;
    const w = 5/16; // Assume 5/16" fillet
    const strength_per_inch = this.phi_w * 0.6 * FEXX * 0.707 * w;
    
    // Two lines of weld (both sides of gusset)
    const L = P_design / (2 * strength_per_inch);
    
    return Math.max(L, 6); // Minimum 6"
  }
  
  /**
   * Round up to standard plate thickness
   */
  private roundUpThickness(t: number): number {
    const standard = [0.375, 0.5, 0.625, 0.75, 0.875, 1.0, 1.125, 1.25, 1.375, 1.5, 1.75, 2.0];
    return standard.find(s => s >= t) || 2.0;
  }
  
  /**
   * Round up to standard weld size
   */
  private roundUpWeld(w: number): number {
    const standard = [3/16, 1/4, 5/16, 3/8, 7/16, 1/2, 5/8, 3/4];
    return standard.find(s => s >= w) || 3/4;
  }
  
  /**
   * Determine which element yields first (for SCBF)
   */
  private determineYieldingSection(
    input: GussetPlateInput,
    t: number,
    Ww: number
  ): 'BRACE' | 'GUSSET' | 'CONNECTION' {
    const { Ry, Fy, Ag } = input.braceSection;
    
    const brace_yield = Ry * Fy * Ag;
    const gusset_yield = 1.1 * input.gussetFy * Ww * t; // 1.1 is Ry for plates
    
    if (brace_yield < gusset_yield * 0.9) {
      return 'BRACE';
    } else if (gusset_yield < brace_yield * 0.9) {
      return 'GUSSET';
    }
    return 'CONNECTION';
  }
}

/**
 * Chevron (Inverted-V) Brace Calculator
 * Special considerations for beam-brace interaction
 */
export class ChevronBraceCalculator {
  /**
   * Calculate unbalanced force on beam at chevron intersection
   */
  calculateUnbalancedForce(
    Pn_tension: number,
    Pn_compression: number,
    braceAngle: number,
    Ry: number
  ): {
    verticalForce: number;
    horizontalForce: number;
    beamMoment: number;
    beamShear: number;
  } {
    const angle_rad = braceAngle * Math.PI / 180;
    
    // Post-buckling compression (30% of expected)
    const Pn_post_buckling = 0.3 * Pn_compression;
    
    // Vertical components
    const V_tension = Ry * Pn_tension * Math.sin(angle_rad);
    const V_compression = Pn_post_buckling * Math.sin(angle_rad);
    
    // Unbalanced vertical force
    const V_unbalanced = V_tension - V_compression;
    
    // Horizontal components (should balance if symmetric)
    const H_tension = Ry * Pn_tension * Math.cos(angle_rad);
    const H_compression = Pn_post_buckling * Math.cos(angle_rad);
    const H_unbalanced = H_tension + H_compression;
    
    return {
      verticalForce: V_unbalanced,
      horizontalForce: H_unbalanced,
      beamMoment: 0, // Depends on span
      beamShear: V_unbalanced
    };
  }
}

// Export singleton instances
export const gussetPlateCalculator = new GussetPlateCalculator();
export const chevronBraceCalculator = new ChevronBraceCalculator();
