/**
 * Beam-Column Joint Calculator
 * Design per ACI 352R-02 and ACI 318-19 Chapter 18
 * 
 * Key design requirements:
 * 1. Joint shear strength - γ√f'c criterion
 * 2. Confinement - Transverse reinforcement through joint
 * 3. Anchorage - Beam bar development within joint
 * 4. Strong column - Weak beam hierarchy
 * 5. Bond requirements for beam bars
 */

import {
  BeamColumnJointInput,
  BeamColumnJointResult,
  JointShearResult,
  JointConfinementResult,
  AnchorageResult,
  CalculationStep,
  JointType,
  JointClassification,
  JOINT_SHEAR_COEFFICIENTS,
  CONFINEMENT_LIMITS,
  DEVELOPMENT_FACTORS,
  SCWB_RATIO,
} from './BeamColumnJointTypes';

export class BeamColumnJointCalculator {
  private phi = 0.85; // Resistance factor for shear
  
  /**
   * Main calculation method for beam-column joint design
   */
  calculate(input: BeamColumnJointInput): BeamColumnJointResult {
    const steps: CalculationStep[] = [];
    
    // Step 1: Calculate effective joint dimensions
    const { bj, hj, Aj } = this.calculateEffectiveJointDimensions(input);
    
    steps.push({
      step: 1,
      description: 'Effective joint width (ACI 352R)',
      formula: 'bj = min(bb + hc, bb + 2x, bc)',
      values: {
        bb: input.beam_primary.b,
        hc: input.column.h,
        bc: input.column.b
      },
      result: bj,
      unit: 'in',
      reference: 'ACI 352R-02 4.3.1'
    });
    
    steps.push({
      step: 2,
      description: 'Effective joint area',
      formula: 'Aj = bj × hc',
      values: { bj, hc: hj },
      result: Aj,
      unit: 'in²'
    });
    
    // Step 2: Calculate joint shear demand
    const jointShear = this.calculateJointShear(input, bj, hj, Aj, steps);
    
    // Step 3: Determine confinement requirements
    const confinement = this.calculateConfinement(input, bj, steps);
    
    // Step 4: Check beam bar anchorage
    const anchorage = this.checkAnchorage(input, steps);
    
    // Step 5: Strong column - weak beam check (for Type 2)
    let strongColumnWeakBeam;
    if (input.classification === JointClassification.TYPE_2) {
      strongColumnWeakBeam = this.checkStrongColumnWeakBeam(input, steps);
    }
    
    // Step 6: Bond requirement check
    const bondRequirement = this.checkBondRequirement(input, steps);
    
    // Overall adequacy
    const isAdequate = 
      jointShear.isAdequate &&
      confinement.isAdequate &&
      anchorage.beam_bars_top.isAdequate &&
      anchorage.beam_bars_bot.isAdequate &&
      (!strongColumnWeakBeam || strongColumnWeakBeam.isAdequate) &&
      bondRequirement.isAdequate;
    
    return {
      isAdequate,
      jointType: input.jointType,
      classification: input.classification,
      effectiveJointWidth: bj,
      effectiveJointDepth: hj,
      effectiveJointArea: Aj,
      jointShear,
      confinement,
      anchorage,
      strongColumnWeakBeam,
      bondRequirement,
      calculations: steps,
      codeReference: input.designCode === 'ACI_318_19' 
        ? 'ACI 318-19 Chapter 18'
        : 'ACI 352R-02'
    };
  }
  
  /**
   * Calculate effective joint dimensions per ACI 352R
   */
  private calculateEffectiveJointDimensions(input: BeamColumnJointInput): {
    bj: number;
    hj: number;
    Aj: number;
  } {
    const bb = input.beam_primary.b;
    const bc = input.column.b;
    const hc = input.column.h;
    
    // Distance from beam edge to column edge
    const x = (bc - bb) / 2;
    
    // Effective joint width (ACI 352R 4.3.1)
    // bj = smaller of:
    // - bb + hc (beam width plus column depth)
    // - bb + 2x (beam width plus twice the extension)
    // - bc (column width)
    
    let bj: number;
    if (input.jointType === JointType.INTERIOR) {
      bj = Math.min(bb + hc, bb + 2 * Math.max(x, 0), bc);
    } else {
      // For exterior/corner, beam typically aligns with column edge
      bj = Math.min(bb + hc / 2, bc);
    }
    
    // Joint depth = column depth in direction of joint shear
    const hj = hc;
    
    // Effective joint area
    const Aj = bj * hj;
    
    return { bj, hj, Aj };
  }
  
  /**
   * Calculate joint shear demand and capacity
   */
  private calculateJointShear(
    input: BeamColumnJointInput,
    bj: number,
    hj: number,
    Aj: number,
    steps: CalculationStep[]
  ): JointShearResult {
    const beam = input.beam_primary;
    const fc = input.column.fc;
    const fy = beam.fy;
    
    // Calculate probable moment strengths if seismic
    const alpha = input.useProbableStrengths ? 1.25 : 1.0;
    
    // Beam tension forces at joint faces
    // T = As × α × fy
    const T_top_left = beam.As_top * alpha * fy;
    const T_bot_left = beam.As_bot * alpha * fy;
    
    // For interior joint with beams on both sides
    let Vj: number;
    if (input.jointType === JointType.INTERIOR) {
      // Both beams contributing (moments in opposite directions)
      Vj = T_top_left + T_bot_left - Math.min(input.forces.Vu_col_above, input.forces.Vu_col_below);
    } else if (input.jointType === JointType.EXTERIOR) {
      // Single beam
      Vj = T_top_left - input.forces.Vu_col_above;
    } else {
      // Corner or knee
      Vj = Math.max(T_top_left, T_bot_left) - input.forces.Vu_col_above;
    }
    
    Vj = Math.abs(Vj) / 1000; // Convert to kips
    
    steps.push({
      step: 3,
      description: 'Joint shear demand',
      formula: 'Vj = ΣT - Vcol',
      values: { 
        T_beams: (T_top_left + T_bot_left) / 1000,
        Vcol: input.forces.Vu_col_above / 1000
      },
      result: Vj,
      unit: 'kips',
      reference: 'ACI 352R-02 4.3.3'
    });
    
    // Joint shear coefficient (gamma)
    let gamma: number;
    const jointTypeKey = input.jointType.includes('ROOF') 
      ? input.jointType.replace('ROOF_', '') as keyof typeof JOINT_SHEAR_COEFFICIENTS.TYPE_1
      : input.jointType as keyof typeof JOINT_SHEAR_COEFFICIENTS.TYPE_1;
    
    if (input.classification === JointClassification.TYPE_2) {
      gamma = JOINT_SHEAR_COEFFICIENTS.TYPE_2[jointTypeKey] || 15;
    } else {
      gamma = JOINT_SHEAR_COEFFICIENTS.TYPE_1[jointTypeKey] || 20;
    }
    
    // Nominal joint shear strength
    // Vn = γ × √f'c × Aj
    const Vn = gamma * Math.sqrt(fc) * Aj / 1000; // kips
    const phi_Vn = this.phi * Vn;
    
    steps.push({
      step: 4,
      description: 'Joint shear capacity',
      formula: 'φVn = φ × γ × √f\'c × Aj',
      values: { phi: this.phi, gamma, fc, Aj },
      result: phi_Vn,
      unit: 'kips',
      reference: 'ACI 352R-02 4.3.1'
    });
    
    const ratio = Vj / phi_Vn;
    
    return {
      Vj,
      Vn,
      phi_Vn,
      ratio,
      isAdequate: ratio <= 1.0,
      gamma
    };
  }
  
  /**
   * Calculate transverse reinforcement requirements
   */
  private calculateConfinement(
    input: BeamColumnJointInput,
    bj: number,
    steps: CalculationStep[]
  ): JointConfinementResult {
    const fc = input.column.fc;
    const fyt = 60000; // Assuming Grade 60 ties
    const bc = input.column.b;
    const hc = input.column.h;
    const cover = input.column.cover;
    
    // Core dimension
    const hc_core = hc - 2 * cover;
    const bc_core = bc - 2 * cover;
    
    // Determine if confinement is required
    let required = false;
    let Ash_required = 0;
    let s_max: number;
    
    if (input.classification === JointClassification.TYPE_2) {
      required = true;
      
      // ACI 318-19 18.8.3.1 - Transverse reinforcement through joint
      // May be reduced if joint is confined by beams on all sides
      const beamOnAllSides = input.jointType === JointType.INTERIOR && 
        input.beam_secondary !== undefined &&
        input.beam_primary.b >= 0.75 * bc &&
        (input.beam_secondary?.b || 0) >= 0.75 * hc;
      
      if (beamOnAllSides) {
        // 50% reduction allowed
        s_max = Math.min(6, hc / 4);
        Ash_required = 0.5 * CONFINEMENT_LIMITS.ash_factor_type2 * s_max * hc_core * fc / fyt;
      } else {
        s_max = Math.min(CONFINEMENT_LIMITS.s_max_type2, hc / 4, 6 * input.column.db_long);
        Ash_required = CONFINEMENT_LIMITS.ash_factor_type2 * s_max * hc_core * fc / fyt;
      }
      
      steps.push({
        step: 5,
        description: 'Required joint confinement (Type 2)',
        formula: 'Ash = 0.09 × s × hc × f\'c / fyt',
        values: { s: s_max, hc: hc_core, fc, fyt },
        result: Ash_required,
        unit: 'in²',
        reference: 'ACI 318-19 18.8.3.1'
      });
    } else {
      // Type 1 - Less stringent
      s_max = Math.min(CONFINEMENT_LIMITS.s_max_type1, hc / 4);
      Ash_required = 0.04 * s_max * hc_core * fc / fyt;
    }
    
    // Design ties
    const ties = this.designTies(Ash_required, s_max, bc_core, hc_core, input.classification);
    
    steps.push({
      step: 6,
      description: 'Joint tie design',
      values: {
        size: ties.size,
        legs: ties.legs,
        spacing: ties.spacing
      },
      result: ties.Ash_provided,
      unit: 'in²'
    });
    
    return {
      required,
      Ash_required,
      s_max,
      ties,
      isAdequate: ties.Ash_provided >= Ash_required
    };
  }
  
  /**
   * Design transverse ties
   */
  private designTies(
    Ash_required: number,
    s_max: number,
    bc_core: number,
    hc_core: number,
    classification: JointClassification
  ): JointConfinementResult['ties'] {
    // Standard tie bar areas
    const tieAreas: Record<string, number> = {
      '#3': 0.11,
      '#4': 0.20,
      '#5': 0.31,
    };
    
    // Minimum tie size for Type 2
    const minSize = classification === JointClassification.TYPE_2 ? '#4' : '#3';
    
    // Determine number of legs needed
    // For typical rectangular column, use 4 legs minimum
    const minLegs = 4;
    
    // Try different tie sizes
    for (const [size, area] of Object.entries(tieAreas)) {
      if (size < minSize) continue;
      
      for (let legs = minLegs; legs <= 8; legs += 2) {
        const Ash_provided = legs * area;
        if (Ash_provided >= Ash_required) {
          // Find suitable spacing
          const s = Math.min(s_max, Ash_provided / (Ash_required / s_max));
          
          return {
            size,
            legs,
            spacing: Math.floor(s * 4) / 4, // Round to 1/4"
            Ash_provided
          };
        }
      }
    }
    
    // Default if no suitable combination found
    return {
      size: '#5',
      legs: 8,
      spacing: Math.floor(s_max * 4) / 4,
      Ash_provided: 8 * tieAreas['#5']
    };
  }
  
  /**
   * Check beam bar anchorage within joint
   */
  private checkAnchorage(
    input: BeamColumnJointInput,
    steps: CalculationStep[]
  ): AnchorageResult {
    const beam = input.beam_primary;
    const hc = input.column.h;
    const fc = input.column.fc;
    const fy = beam.fy;
    const cover = input.column.cover;
    
    // Available anchorage length (hook into joint)
    const ldh_available = hc - cover - 2; // Account for cover and clearance
    
    // Required development length for hooked bar (ACI 318-19 Table 25.4.3.1)
    // ldh = (0.02 × ψe × fy / λ × √f'c) × db
    const psi_e = DEVELOPMENT_FACTORS.psi_e;
    const lambda = 1.0; // Normal weight concrete
    
    // Top bars
    const ldh_top = (0.02 * psi_e * fy / (lambda * Math.sqrt(fc))) * beam.db_top;
    
    // Bottom bars (may have modification for cover)
    const ldh_bot = (0.02 * psi_e * fy / (lambda * Math.sqrt(fc))) * beam.db_bot;
    
    steps.push({
      step: 7,
      description: 'Beam bar anchorage - Top bars',
      formula: 'ldh = (0.02 × ψe × fy / √f\'c) × db',
      values: { db: beam.db_top, fy, fc },
      result: ldh_top,
      unit: 'in',
      reference: 'ACI 318-19 25.4.3.1'
    });
    
    steps.push({
      step: 8,
      description: 'Beam bar anchorage - Bottom bars',
      formula: 'ldh = (0.02 × ψe × fy / √f\'c) × db',
      values: { db: beam.db_bot, fy, fc },
      result: ldh_bot,
      unit: 'in'
    });
    
    return {
      beam_bars_top: {
        db: beam.db_top,
        ldh_required: ldh_top,
        ldh_available,
        isAdequate: ldh_available >= ldh_top
      },
      beam_bars_bot: {
        db: beam.db_bot,
        ldh_required: ldh_bot,
        ldh_available,
        isAdequate: ldh_available >= ldh_bot
      },
      column_bars: {
        continuity: 'CONTINUOUS',
        splice_class: undefined
      }
    };
  }
  
  /**
   * Check strong column - weak beam requirement
   */
  private checkStrongColumnWeakBeam(
    input: BeamColumnJointInput,
    steps: CalculationStep[]
  ): {
    sum_Mnc: number;
    sum_Mnb: number;
    ratio: number;
    isAdequate: boolean;
  } {
    const column = input.column;
    const beam = input.beam_primary;
    
    // Simplified moment capacity calculations
    // For full accuracy, should use proper section analysis
    
    // Column moment capacity (approximate)
    // Mnc ≈ 0.25 × Ag × d × fy × (1 - Pu/(φ × Ag × f'c))
    const Pu = input.forces.Pu_col;
    const fc = column.fc;
    const Ag = column.Ag;
    const d_col = column.h - column.cover - column.db_long / 2;
    const rho = column.rho_g;
    
    // Interaction approximation
    const Pb = 0.85 * fc * column.b * 0.65 * d_col + column.Ast * column.fy;
    const e_bal = 0.003 / (0.003 + column.fy / 29000000) * d_col;
    
    let Mnc: number;
    if (Pu > 0.4 * Pb) {
      Mnc = 0.8 * (column.Ast * column.fy * (column.h / 2 - column.cover));
    } else {
      Mnc = column.Ast * column.fy * (d_col - column.cover);
    }
    
    // Sum of column capacities (above and below joint)
    const sum_Mnc = 2 * Mnc / 1000 / 12; // kip-ft
    
    // Beam moment capacity
    // Mnb = As × fy × (d - a/2)
    const As = Math.max(beam.As_top, beam.As_bot);
    const a = As * beam.fy / (0.85 * beam.fc * beam.b);
    const Mnb = As * beam.fy * (beam.d - a / 2) / 1000 / 12; // kip-ft
    
    // Sum of beam capacities (typically 2 beams for interior joint)
    const n_beams = input.jointType === JointType.INTERIOR ? 2 : 1;
    const sum_Mnb = n_beams * Mnb;
    
    const ratio = sum_Mnc / sum_Mnb;
    const required_ratio = SCWB_RATIO.TYPE_2;
    
    steps.push({
      step: 9,
      description: 'Strong column - weak beam check',
      formula: 'ΣMnc / ΣMnb ≥ 1.2',
      values: { sum_Mnc, sum_Mnb, required_ratio },
      result: ratio,
      reference: 'ACI 318-19 18.7.3.2'
    });
    
    return {
      sum_Mnc,
      sum_Mnb,
      ratio,
      isAdequate: ratio >= required_ratio
    };
  }
  
  /**
   * Check column dimension for bond (beam bar development)
   */
  private checkBondRequirement(
    input: BeamColumnJointInput,
    steps: CalculationStep[]
  ): {
    hc_min: number;
    hc_provided: number;
    ratio: number;
    isAdequate: boolean;
  } {
    const beam = input.beam_primary;
    const hc = input.column.h;
    const db = Math.max(beam.db_top, beam.db_bot);
    const fy = beam.fy;
    const fc = input.column.fc;
    
    // Minimum column depth for bond (ACI 352R)
    // For Type 2 joints: hc ≥ 20 × db (for Grade 60 bars)
    // Alternatively: hc ≥ fy × db / (65 × √f'c)
    
    let hc_min: number;
    if (input.classification === JointClassification.TYPE_2) {
      hc_min = Math.max(20 * db, fy * db / (65 * Math.sqrt(fc)));
    } else {
      hc_min = Math.max(16 * db, fy * db / (80 * Math.sqrt(fc)));
    }
    
    steps.push({
      step: 10,
      description: 'Minimum column depth for bond',
      formula: 'hc ≥ 20 × db (Type 2)',
      values: { db, fy, fc },
      result: hc_min,
      unit: 'in',
      reference: 'ACI 352R-02 4.5.2'
    });
    
    return {
      hc_min,
      hc_provided: hc,
      ratio: hc / hc_min,
      isAdequate: hc >= hc_min
    };
  }
}

// Export singleton instance
export const beamColumnJointCalculator = new BeamColumnJointCalculator();
