/**
 * Isolated Footing Calculator
 * Design per ACI 318-19 Chapter 13
 * 
 * Design sequence:
 * 1. Size footing for soil pressure (service loads)
 * 2. Check one-way (beam) shear
 * 3. Check two-way (punching) shear
 * 4. Design flexural reinforcement
 * 5. Check development length
 * 6. Design column dowels
 */

import {
  IsolatedFootingInput,
  IsolatedFootingResult,
  FootingDimensions,
  SoilPressureResult,
  ShearResult,
  FlexuralResult,
  DevelopmentResult,
  CalculationStep,
  ACI_FOOTING_REQUIREMENTS,
  REBAR_DATA,
  DOWEL_REQUIREMENTS,
} from './FoundationTypes';

export class IsolatedFootingCalculator {
  private phi_shear = 0.75;
  private phi_flexure = 0.90;
  
  /**
   * Main calculation method for isolated spread footing
   */
  calculate(input: IsolatedFootingInput): IsolatedFootingResult {
    const steps: CalculationStep[] = [];
    
    // Step 1: Determine footing plan dimensions for soil pressure
    const { L, B, area } = this.sizeFootingForSoilPressure(input, steps);
    
    // Step 2: Determine footing depth for shear
    const { h, d } = this.determineFootingDepth(input, L, B, steps);
    
    // Create dimensions object
    const dimensions: FootingDimensions = {
      L,
      B,
      h,
      d,
      area: (L * B) / 144, // sf
      volume: (L * B * h) / 46656, // cy (27 cf/cy)
    };
    
    // Step 3: Calculate soil pressure distribution
    const soilPressure = this.calculateSoilPressure(input, L, B, steps);
    
    // Step 4: Check shear
    const shear = this.checkShear(input, dimensions, steps);
    
    // Step 5: Design flexural reinforcement
    const flexure_x = this.designFlexure(input, dimensions, 'X', steps);
    const flexure_y = this.designFlexure(input, dimensions, 'Y', steps);
    
    // Step 6: Check development length - use larger bar size
    const barSizeX = parseInt(flexure_x.bars.size.replace('#', ''));
    const barSizeY = parseInt(flexure_y.bars.size.replace('#', ''));
    const largerBarSize = barSizeX >= barSizeY ? flexure_x.bars.size : flexure_y.bars.size;
    const development = this.checkDevelopment(input, dimensions, largerBarSize, steps);
    
    // Step 7: Design dowels
    const dowels = this.designDowels(input, steps);
    
    // Calculate quantities
    const quantities = this.calculateQuantities(dimensions, flexure_x, flexure_y, dowels, input);
    
    // Overall adequacy
    const isAdequate = 
      soilPressure.isAdequate &&
      shear.oneWay.isAdequate &&
      shear.twoWay.isAdequate &&
      flexure_x.isAdequate &&
      flexure_y.isAdequate &&
      development.isAdequate;
    
    return {
      isAdequate,
      dimensions,
      soilPressure,
      shear,
      flexure: { x: flexure_x, y: flexure_y },
      development,
      reinforcement: {
        bottom: {
          x: flexure_x.bars,
          y: flexure_y.bars,
        },
        dowels,
      },
      quantities,
      calculations: steps,
      codeReference: 'ACI 318-19 Chapter 13'
    };
  }
  
  /**
   * Size footing for allowable soil pressure
   */
  private sizeFootingForSoilPressure(
    input: IsolatedFootingInput,
    steps: CalculationStep[]
  ): { L: number; B: number; area: number } {
    const { P_service, Mx_service, My_service } = input.loads;
    const qa = input.soil.qa; // ksf
    
    // Account for weight of footing and soil above (estimate)
    const depth_ft = input.depthOfFooting;
    const soil_weight = input.soil.gamma * depth_ft / 1000; // ksf
    const concrete_weight = 150 * 1.5 / 1000; // Assume 18" footing, ksf
    const surcharge = soil_weight + concrete_weight;
    
    // Net allowable pressure
    const qa_net = qa - surcharge;
    
    steps.push({
      step: 1,
      description: 'Net allowable soil pressure',
      formula: 'qa_net = qa - γ_soil × D - γ_conc × h',
      values: { qa, surcharge: surcharge.toFixed(2) },
      result: qa_net,
      unit: 'ksf',
      reference: 'ACI 318-19 13.3.1'
    });
    
    // Required area for concentric load
    const A_required = P_service / qa_net; // sf
    
    // Check for eccentricity
    const ex = (My_service * 12) / P_service; // in
    const ey = (Mx_service * 12) / P_service; // in
    
    // Initial size (square footing)
    let B_initial = Math.sqrt(A_required) * 12; // in
    let L_initial = B_initial;
    
    // Adjust for eccentricity if significant
    if (Math.abs(ex) > B_initial / 12 || Math.abs(ey) > L_initial / 12) {
      // Eccentric loading - need larger footing
      B_initial *= 1.3;
      L_initial *= 1.3;
    }
    
    // Apply length/width ratio constraint
    const maxRatio = input.constraints?.lengthWidthRatio || 2.0;
    if (L_initial / B_initial > maxRatio) {
      B_initial = Math.sqrt(L_initial * L_initial / maxRatio);
      L_initial = B_initial * maxRatio;
    }
    
    // Round up to nearest 3"
    const B = Math.ceil(B_initial / 3) * 3;
    const L = Math.ceil(L_initial / 3) * 3;
    
    steps.push({
      step: 2,
      description: 'Required footing area and dimensions',
      formula: 'A = P_service / qa_net',
      values: { P_service, qa_net, A_required: A_required.toFixed(1) },
      result: `${L}" × ${B}"`,
      unit: 'in × in'
    });
    
    return { L, B, area: (L * B) / 144 };
  }
  
  /**
   * Determine footing depth for shear
   */
  private determineFootingDepth(
    input: IsolatedFootingInput,
    L: number,
    B: number,
    steps: CalculationStep[]
  ): { h: number; d: number } {
    const { Pu } = input.loads;
    const fc = input.materials.fc;
    const cover = input.materials.cover || ACI_FOOTING_REQUIREMENTS.cover_cast_against_earth;
    const col_b = input.column.b;
    const col_h = input.column.h;
    
    // Estimate factored soil pressure
    const qu = Pu / ((L * B) / 144); // ksf
    
    // Critical perimeter for punching shear (estimate d)
    // Start with minimum depth
    let d_trial = Math.max(
      input.constraints?.minDepth || 10,
      ACI_FOOTING_REQUIREMENTS.min_depth_above_rebar
    ) - cover - 0.5; // Assume #8 bar
    
    // Iterate to find required d for punching shear
    for (let iter = 0; iter < 10; iter++) {
      const bo = 2 * (col_b + d_trial) + 2 * (col_h + d_trial);
      const Vu_punch = Pu - qu * ((col_b + d_trial) * (col_h + d_trial)) / 144;
      
      // Punching shear capacity (ACI 318 Table 22.6.5.2)
      const beta = Math.max(col_h / col_b, col_b / col_h);
      const Vc_1 = (2 + 4 / beta) * Math.sqrt(fc) * bo * d_trial / 1000;
      const alpha_s = ACI_FOOTING_REQUIREMENTS.punching_alpha_s.interior;
      const Vc_2 = (alpha_s * d_trial / bo + 2) * Math.sqrt(fc) * bo * d_trial / 1000;
      const Vc_3 = 4 * Math.sqrt(fc) * bo * d_trial / 1000;
      const Vc = Math.min(Vc_1, Vc_2, Vc_3);
      const phi_Vc = this.phi_shear * Vc;
      
      if (Vu_punch <= phi_Vc) {
        break;
      }
      d_trial += 1;
    }
    
    // Also check one-way shear
    const critical_x = (L - col_h) / 2 - d_trial;
    const Vu_beam = qu * B * critical_x / 144; // kips
    const Vc_beam = 2 * Math.sqrt(fc) * B * d_trial / 1000;
    const phi_Vc_beam = this.phi_shear * Vc_beam;
    
    if (Vu_beam > phi_Vc_beam) {
      // Increase d for one-way shear
      d_trial = Vu_beam / (this.phi_shear * 2 * Math.sqrt(fc) * B / 1000);
    }
    
    // Calculate total depth
    const db = 0.75; // Assume #6 bar
    const h = Math.ceil((d_trial + cover + db) / 3) * 3; // Round to 3"
    const d = h - cover - db / 2;
    
    steps.push({
      step: 3,
      description: 'Required footing depth for shear',
      formula: 'd governed by max(one-way, two-way shear)',
      values: { d_trial: d_trial.toFixed(1), cover },
      result: h,
      unit: 'in',
      reference: 'ACI 318-19 22.5, 22.6'
    });
    
    return { h, d };
  }
  
  /**
   * Calculate soil pressure distribution
   */
  private calculateSoilPressure(
    input: IsolatedFootingInput,
    L: number,
    B: number,
    steps: CalculationStep[]
  ): SoilPressureResult {
    const { P_service, Mx_service, My_service } = input.loads;
    const qa = input.soil.qa;
    
    // Section properties
    const A = (L * B) / 144; // sf
    const Sx = (B * L * L / 6) / 1728; // ft³
    const Sy = (L * B * B / 6) / 1728; // ft³
    
    // Eccentricity
    const ex = P_service > 0 ? (My_service * 12) / P_service : 0; // in
    const ey = P_service > 0 ? (Mx_service * 12) / P_service : 0; // in
    
    // Check kern limits (middle third rule)
    const ex_limit = B / 6;
    const ey_limit = L / 6;
    const isWithinKern = Math.abs(ex) <= ex_limit && Math.abs(ey) <= ey_limit;
    
    // Soil pressure (q = P/A ± M/S)
    let q_max: number;
    let q_min: number;
    
    if (isWithinKern) {
      // Full bearing - linear distribution
      q_max = P_service / A + Math.abs(Mx_service) / Sx + Math.abs(My_service) / Sy;
      q_min = P_service / A - Math.abs(Mx_service) / Sx - Math.abs(My_service) / Sy;
    } else {
      // Partial bearing - triangular distribution
      // Simplified: assume maximum increases
      q_max = 2 * P_service / A;
      q_min = 0;
    }
    
    const q_avg = P_service / A;
    
    steps.push({
      step: 4,
      description: 'Soil pressure distribution',
      formula: 'q = P/A ± M/S',
      values: { P_service, A: A.toFixed(1), ex: ex.toFixed(1), ey: ey.toFixed(1) },
      result: `q_max = ${q_max.toFixed(2)} ksf, q_min = ${q_min.toFixed(2)} ksf`,
      reference: 'ACI 318-19 13.3'
    });
    
    return {
      q_max,
      q_min,
      q_avg,
      q_allowable: qa,
      ratio: q_max / qa,
      isAdequate: q_max <= qa && q_min >= 0,
      eccentricity: {
        ex,
        ey,
        isWithinKern,
      }
    };
  }
  
  /**
   * Check one-way and two-way shear
   */
  private checkShear(
    input: IsolatedFootingInput,
    dim: FootingDimensions,
    steps: CalculationStep[]
  ): ShearResult {
    const { Pu } = input.loads;
    const fc = input.materials.fc;
    const { L, B, d } = dim;
    const col_b = input.column.b;
    const col_h = input.column.h;
    
    // Factored soil pressure (for shear)
    const qu = Pu / ((L * B) / 144); // ksf
    
    // === One-way shear ===
    // Critical section at d from column face
    const x_crit_1way = (L - col_h) / 2 - d;
    const Vu_1way = qu * B * Math.max(x_crit_1way, 0) / 144;
    const Vc_1way = 2 * Math.sqrt(fc) * B * d / 1000;
    const phi_Vc_1way = this.phi_shear * Vc_1way;
    
    steps.push({
      step: 5,
      description: 'One-way (beam) shear check',
      formula: 'φVc = φ × 2 × √f\'c × b × d',
      values: { Vu: Vu_1way.toFixed(1), phi_Vc: phi_Vc_1way.toFixed(1) },
      result: Vu_1way / phi_Vc_1way,
      reference: 'ACI 318-19 22.5'
    });
    
    // === Two-way shear ===
    // Critical section at d/2 from column face
    const bo = 2 * (col_b + d) + 2 * (col_h + d);
    const A_punch = (col_b + d) * (col_h + d) / 144; // sf
    const Vu_2way = Pu - qu * A_punch;
    
    // Three criteria for Vc
    const beta = Math.max(col_h / col_b, col_b / col_h);
    const Vc_2way_1 = (2 + 4 / beta) * Math.sqrt(fc) * bo * d / 1000;
    const alpha_s = ACI_FOOTING_REQUIREMENTS.punching_alpha_s.interior;
    const Vc_2way_2 = (alpha_s * d / bo + 2) * Math.sqrt(fc) * bo * d / 1000;
    const Vc_2way_3 = 4 * Math.sqrt(fc) * bo * d / 1000;
    const Vc_2way = Math.min(Vc_2way_1, Vc_2way_2, Vc_2way_3);
    const phi_Vc_2way = this.phi_shear * Vc_2way;
    
    steps.push({
      step: 6,
      description: 'Two-way (punching) shear check',
      formula: 'φVc = φ × min[(2+4/β), (αs×d/bo+2), 4] × √f\'c × bo × d',
      values: { 
        Vu: Vu_2way.toFixed(1), 
        phi_Vc: phi_Vc_2way.toFixed(1),
        bo,
        beta: beta.toFixed(2)
      },
      result: Vu_2way / phi_Vc_2way,
      reference: 'ACI 318-19 22.6.5.2'
    });
    
    return {
      oneWay: {
        Vu: Vu_1way,
        phi_Vc: phi_Vc_1way,
        ratio: Vu_1way / phi_Vc_1way,
        isAdequate: Vu_1way <= phi_Vc_1way,
        criticalSection: d
      },
      twoWay: {
        Vu: Vu_2way,
        phi_Vc: phi_Vc_2way,
        ratio: Vu_2way / phi_Vc_2way,
        isAdequate: Vu_2way <= phi_Vc_2way,
        bo,
        criticalSection: d / 2
      }
    };
  }
  
  /**
   * Design flexural reinforcement
   */
  private designFlexure(
    input: IsolatedFootingInput,
    dim: FootingDimensions,
    direction: 'X' | 'Y',
    steps: CalculationStep[]
  ): FlexuralResult {
    const { Pu } = input.loads;
    const fc = input.materials.fc;
    const fy = input.materials.fy;
    const { L, B, d, h } = dim;
    const col_b = input.column.b;
    const col_h = input.column.h;
    
    // Factored soil pressure
    const qu = Pu / ((L * B) / 144); // ksf
    
    // Critical section at face of column
    let cantilever: number;
    let width: number;
    
    if (direction === 'X') {
      cantilever = (L - col_h) / 2;
      width = B;
    } else {
      cantilever = (B - col_b) / 2;
      width = L;
    }
    
    // Moment at face of column
    // Mu = qu × b × L_cant² / 2
    const Mu = qu * width * (cantilever / 12) * (cantilever / 12) / 2; // kip-ft
    
    // Required steel area
    // Mu = φ × As × fy × (d - a/2)
    // Approximate a for initial calculation
    const a_approx = 0.1 * d;
    const As_required = (Mu * 12) / (this.phi_flexure * fy * (d - a_approx / 2) / 1000);
    
    // Minimum steel (ACI 318 7.6.1.1)
    const As_min = ACI_FOOTING_REQUIREMENTS.rho_min * width * h;
    
    const As_design = Math.max(As_required, As_min);
    
    // Select bars
    const bars = this.selectBars(As_design, width, input.materials.barSize);
    
    // Calculate provided capacity
    const a = bars.quantity * REBAR_DATA[bars.size].Ab * fy / (0.85 * fc * width);
    const phi_Mn = this.phi_flexure * bars.quantity * REBAR_DATA[bars.size].Ab * fy * (d - a / 2) / 12000;
    
    const stepNum = direction === 'X' ? 7 : 8;
    steps.push({
      step: stepNum,
      description: `Flexural design - ${direction} direction`,
      formula: 'Mu = qu × b × L² / 2',
      values: { 
        cantilever,
        Mu: Mu.toFixed(1),
        As_required: As_required.toFixed(2),
        As_min: As_min.toFixed(2)
      },
      result: `${bars.quantity}-${bars.size} @ ${bars.spacing}" c/c`,
      reference: 'ACI 318-19 13.2.7'
    });
    
    return {
      direction,
      Mu,
      phi_Mn,
      ratio: Mu / phi_Mn,
      isAdequate: Mu <= phi_Mn,
      As_required,
      As_min,
      As_provided: bars.quantity * REBAR_DATA[bars.size].Ab,
      bars
    };
  }
  
  /**
   * Select reinforcement bars
   */
  private selectBars(
    As_required: number,
    width: number,
    preferredSize?: string
  ): { size: string; quantity: number; spacing: number } {
    const sizes = preferredSize ? [preferredSize] : ['#5', '#6', '#7', '#8'];
    
    for (const size of sizes) {
      const Ab = REBAR_DATA[size].Ab;
      const n_required = Math.ceil(As_required / Ab);
      const spacing = (width - 6) / (n_required - 1); // 3" edge distance each side
      
      if (spacing >= 6 && spacing <= ACI_FOOTING_REQUIREMENTS.max_spacing) {
        return {
          size,
          quantity: n_required,
          spacing: Math.floor(spacing * 4) / 4 // Round to 1/4"
        };
      }
    }
    
    // Default: use more of smaller bars
    const size = '#5';
    const n = Math.ceil(As_required / REBAR_DATA[size].Ab);
    return {
      size,
      quantity: n,
      spacing: Math.floor(((width - 6) / (n - 1)) * 4) / 4
    };
  }
  
  /**
   * Check development length
   */
  private checkDevelopment(
    input: IsolatedFootingInput,
    dim: FootingDimensions,
    barSize: string,
    steps: CalculationStep[]
  ): DevelopmentResult {
    const fc = input.materials.fc;
    const fy = input.materials.fy;
    const cover = input.materials.cover || ACI_FOOTING_REQUIREMENTS.cover_cast_against_earth;
    const col_h = input.column.h;
    
    const db = REBAR_DATA[barSize].db;
    
    // Development length (ACI 318 Table 25.4.2.2)
    // ld = (fy × ψt × ψe / (25 × λ × √f'c)) × db
    const psi_t = 1.0; // Bottom bars
    const psi_e = 1.0; // Uncoated
    const lambda = 1.0; // Normal weight
    
    const ld = (fy * psi_t * psi_e / (25 * lambda * Math.sqrt(fc))) * db;
    const ld_min = Math.max(ld, 12); // Minimum 12"
    
    // Available length
    const cantilever = (dim.L - col_h) / 2;
    const ld_available = cantilever - cover;
    
    const useHook = ld_available < ld_min;
    
    steps.push({
      step: 9,
      description: 'Development length check',
      formula: 'ld = (fy × ψt × ψe / 25λ√f\'c) × db',
      values: { db, ld_required: ld_min.toFixed(1), ld_available: ld_available.toFixed(1) },
      result: ld_available >= ld_min ? 'OK' : `Use ${useHook ? 'hooked bars' : 'longer footing'}`,
      reference: 'ACI 318-19 25.4.2.2'
    });
    
    return {
      ld_required: ld_min,
      ld_available,
      ratio: ld_min / ld_available,
      isAdequate: ld_available >= ld_min || useHook,
      useHook
    };
  }
  
  /**
   * Design column dowels
   */
  private designDowels(
    input: IsolatedFootingInput,
    steps: CalculationStep[]
  ): IsolatedFootingResult['reinforcement']['dowels'] {
    const col_b = input.column.b;
    const col_h = input.column.h;
    const perimeter = 2 * (col_b + col_h);
    
    // Minimum number of dowels
    const n_min = DOWEL_REQUIREMENTS.min_dowels;
    const n_perimeter = Math.ceil(perimeter / DOWEL_REQUIREMENTS.max_spacing);
    const n_dowels = Math.max(n_min, n_perimeter);
    
    // Dowel size (typically match column bars or one size smaller)
    const size = '#6';
    const db = REBAR_DATA[size].db;
    
    // Embedment into footing
    const embedment = Math.max(
      DOWEL_REQUIREMENTS.min_embedment_factor * db,
      DOWEL_REQUIREMENTS.compression_lap_factor * db
    );
    
    // Projection into column
    const projection = DOWEL_REQUIREMENTS.compression_lap_factor * db;
    
    steps.push({
      step: 10,
      description: 'Column dowel design',
      values: { n_dowels, size, embedment: embedment.toFixed(1) },
      result: `${n_dowels}-${size} dowels`,
      reference: 'ACI 318-19 16.3.5'
    });
    
    return {
      size,
      quantity: n_dowels,
      embedment: Math.ceil(embedment),
      projection: Math.ceil(projection)
    };
  }
  
  /**
   * Calculate material quantities
   */
  private calculateQuantities(
    dim: FootingDimensions,
    flexure_x: FlexuralResult,
    flexure_y: FlexuralResult,
    dowels: IsolatedFootingResult['reinforcement']['dowels'],
    input: IsolatedFootingInput
  ): IsolatedFootingResult['quantities'] {
    // Concrete
    const concrete_cy = dim.volume;
    
    // Rebar weight
    const bar_x = REBAR_DATA[flexure_x.bars.size];
    const bar_y = REBAR_DATA[flexure_y.bars.size];
    const bar_dowel = REBAR_DATA[dowels.size];
    
    const length_x = dim.L - 6; // 3" cover each end
    const length_y = dim.B - 6;
    
    const weight_x = flexure_x.bars.quantity * length_x / 12 * bar_x.weight;
    const weight_y = flexure_y.bars.quantity * length_y / 12 * bar_y.weight;
    const weight_dowels = dowels.quantity * (dowels.embedment + dowels.projection) / 12 * bar_dowel.weight;
    
    const rebar_lbs = weight_x + weight_y + weight_dowels;
    
    // Formwork (sides only)
    const formwork_sf = 2 * (dim.L + dim.B) * dim.h / 144;
    
    // Excavation (assume 1' larger each side, 6" deeper)
    const exc_L = (dim.L + 24) / 12;
    const exc_B = (dim.B + 24) / 12;
    const exc_h = input.depthOfFooting + 0.5;
    const excavation_cy = exc_L * exc_B * exc_h / 27;
    
    return {
      concrete_cy: Math.ceil(concrete_cy * 10) / 10,
      rebar_lbs: Math.ceil(rebar_lbs),
      formwork_sf: Math.ceil(formwork_sf),
      excavation_cy: Math.ceil(excavation_cy * 10) / 10
    };
  }
}

// Export singleton instance
export const isolatedFootingCalculator = new IsolatedFootingCalculator();
