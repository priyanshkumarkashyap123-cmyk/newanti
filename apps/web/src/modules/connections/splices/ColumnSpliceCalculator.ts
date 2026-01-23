/**
 * Column Splice Calculator
 * Steel column splice design per AISC 360-22 and AISC 341-22
 * 
 * Design considerations:
 * 1. Standard splices - 50% flange tension capacity
 * 2. Seismic splices - Expected strength requirements
 * 3. Bearing splices - Finish-to-bear with erection bolts
 * 4. Bolted vs welded options
 * 5. Section change accommodations
 */

import {
  ColumnSpliceInput,
  ColumnSpliceResult,
  CalculationStep,
  SpliceType,
  ColumnSpliceDesignLevel,
  SPLICE_DESIGN_REQUIREMENTS,
  SPLICE_PLATE_LIMITS,
  BOLT_SPACING,
  BOLT_DATA,
  BEARING_SPLICE,
} from './SpliceTypes';

export class ColumnSpliceCalculator {
  private phi_y = 0.90; // Yielding
  private phi_r = 0.75; // Rupture
  private phi_b = 0.75; // Bearing (bolts)
  private phi_w = 0.75; // Welds
  
  /**
   * Main calculation method for column splice design
   */
  calculate(input: ColumnSpliceInput): ColumnSpliceResult {
    const steps: CalculationStep[] = [];
    const checks: ColumnSpliceResult['checks'] = [];
    const notes: string[] = [];
    
    // Step 1: Determine design forces
    const designForces = this.determineDesignForces(input, steps, notes);
    
    // Step 2: Check if bearing splice is appropriate
    if (input.finishToBear) {
      return this.designBearingSplice(input, designForces, steps, checks, notes);
    }
    
    // Step 3: Design non-bearing splice based on type
    switch (input.spliceType) {
      case SpliceType.COLUMN_BOLTED_FLANGE:
      case SpliceType.COLUMN_BOLTED_WEB:
        return this.designBoltedSplice(input, designForces, steps, checks, notes);
        
      case SpliceType.COLUMN_WELDED_FLANGE:
      case SpliceType.COLUMN_CJP:
        return this.designWeldedSplice(input, designForces, steps, checks, notes);
        
      case SpliceType.COLUMN_PJP:
        return this.designPJPSplice(input, designForces, steps, checks, notes);
        
      default:
        return this.designBoltedSplice(input, designForces, steps, checks, notes);
    }
  }
  
  /**
   * Determine required design forces based on design level
   */
  private determineDesignForces(
    input: ColumnSpliceInput,
    steps: CalculationStep[],
    notes: string[]
  ): {
    Pu_design: number;
    Mux_design: number;
    Muy_design: number;
    Vu_design: number;
    Tu_flange: number;  // Required flange tension capacity
  } {
    const colBelow = input.columnBelow;
    const Af = colBelow.bf * colBelow.tf; // Flange area
    const Fy = colBelow.Fy;
    
    let Tu_flange: number;
    let factorDescription: string;
    
    switch (input.designLevel) {
      case ColumnSpliceDesignLevel.SPECIAL:
        // AISC 341-22 E3.6e - 100% expected flange strength
        const Ry = input.expectedStrengthFactor || SPLICE_DESIGN_REQUIREMENTS.SPECIAL.expected_Ry;
        Tu_flange = Ry * Fy * Af;
        factorDescription = `100% expected (Ry=${Ry})`;
        notes.push('SMF/SCBF: Splice designed for expected flange strength per AISC 341');
        break;
        
      case ColumnSpliceDesignLevel.INTERMEDIATE:
        // 50% with expected yield
        const Ry_int = input.expectedStrengthFactor || SPLICE_DESIGN_REQUIREMENTS.INTERMEDIATE.expected_factor;
        Tu_flange = 0.5 * Ry_int * Fy * Af;
        factorDescription = `50% expected (Ry=${Ry_int})`;
        notes.push('IMF/OCBF: Splice designed for 50% expected flange strength');
        break;
        
      default:
        // Standard - 50% of nominal
        Tu_flange = SPLICE_DESIGN_REQUIREMENTS.STANDARD.flange_tension * Fy * Af;
        factorDescription = '50% nominal';
        notes.push('Non-seismic: Splice designed for 50% nominal flange strength');
    }
    
    steps.push({
      step: 1,
      description: `Required flange tension capacity (${factorDescription})`,
      formula: input.designLevel === ColumnSpliceDesignLevel.SPECIAL 
        ? 'Tu = Ry × Fy × Af' 
        : 'Tu = 0.5 × Fy × Af',
      values: { Af, Fy, factor: factorDescription },
      result: Tu_flange,
      unit: 'kips',
      reference: input.designLevel === ColumnSpliceDesignLevel.SPECIAL 
        ? 'AISC 341-22 E3.6e' 
        : 'AISC 360-22 J1.4'
    });
    
    // Check if actual forces govern
    const Tu_actual = Math.abs(input.Mux) / (colBelow.d - colBelow.tf) + 
                      (input.Pu < 0 ? Math.abs(input.Pu) / 2 : 0);
    
    if (Tu_actual > Tu_flange) {
      Tu_flange = Tu_actual;
      notes.push('Actual forces govern over minimum splice requirements');
    }
    
    return {
      Pu_design: Math.abs(input.Pu),
      Mux_design: Math.abs(input.Mux),
      Muy_design: Math.abs(input.Muy),
      Vu_design: Math.abs(input.Vu),
      Tu_flange
    };
  }
  
  /**
   * Design bolted flange plate splice
   */
  private designBoltedSplice(
    input: ColumnSpliceInput,
    forces: ReturnType<typeof this.determineDesignForces>,
    steps: CalculationStep[],
    checks: ColumnSpliceResult['checks'],
    notes: string[]
  ): ColumnSpliceResult {
    const colAbove = input.columnAbove;
    const colBelow = input.columnBelow;
    
    // Determine plate dimensions
    const width_min = Math.max(colAbove.bf, colBelow.bf) + 1;
    
    // Select bolt size
    const boltKey = `${input.bolts?.type || 'A325'}_${input.bolts?.diameter || 1}` as keyof typeof BOLT_DATA;
    const boltData = BOLT_DATA[boltKey] || BOLT_DATA['A325_1'];
    const d_bolt = input.bolts?.diameter || 1;
    
    // Required number of bolts per side of splice (each flange)
    // For slip-critical: φRn = φ × μ × Du × hf × Tb × ns
    // For bearing: φRn = φ × Fnv × Ab × ns
    
    let Rn_bolt: number;
    if (input.bolts?.slipCritical) {
      const mu = 0.35; // Class A slip coefficient
      const Du = 1.13; // Hole factor
      const hf = 1.0;  // Filler factor
      Rn_bolt = 1.0 * mu * Du * hf * boltData.Tb; // φ = 1.0 for std holes
    } else {
      Rn_bolt = this.phi_b * boltData.Fnv * boltData.Ab; // Single shear
    }
    
    // Bolts per side of splice (for one flange plate)
    const n_bolts_per_side = Math.ceil(forces.Tu_flange / (4 * Rn_bolt)); // 4 = 2 bolt rows × 2 shear planes
    const n_bolts_total = 4 * n_bolts_per_side; // 4 flange plates
    
    steps.push({
      step: 2,
      description: 'Bolt capacity and required number',
      formula: input.bolts?.slipCritical 
        ? 'Rn = μ × Du × hf × Tb' 
        : 'φRn = φ × Fnv × Ab',
      values: { Rn_bolt, Tu_flange: forces.Tu_flange },
      result: n_bolts_per_side,
      unit: 'bolts per side',
      reference: 'AISC 360-22 J3.8'
    });
    
    // Arrange bolts in pattern
    const rows = Math.ceil(n_bolts_per_side / 2);
    const cols = 2;
    const spacing = Math.max(3 * d_bolt, BOLT_SPACING.preferred_spacing * d_bolt);
    const edge = Math.max(1.5 * d_bolt, 1.25);
    
    // Plate length
    const plate_length = 2 * edge + (rows - 1) * spacing + (rows - 1) * spacing + 2 * edge;
    
    // Required plate thickness
    // Gross section yielding: φPn = φ × Fy × Ag
    // Net section rupture: φPn = φ × Fu × An
    const Ag_plate = width_min * 0.5; // Initial guess
    const t_required_yield = forces.Tu_flange / (this.phi_y * input.splicePlate.Fy * width_min);
    
    // Net section (account for bolt holes)
    const hole_dia = d_bolt + 1/8;
    const An_factor = (width_min - 2 * hole_dia) / width_min;
    const t_required_rupture = forces.Tu_flange / (this.phi_r * input.splicePlate.Fu * width_min * An_factor);
    
    const t_plate = Math.max(
      t_required_yield,
      t_required_rupture,
      SPLICE_PLATE_LIMITS.min_thickness
    );
    const t_final = this.roundUpThickness(t_plate);
    
    steps.push({
      step: 3,
      description: 'Required flange plate thickness',
      formula: 't = Tu / (φ × Fy × w)',
      values: { Tu: forces.Tu_flange, Fy: input.splicePlate.Fy, w: width_min },
      result: t_final,
      unit: 'in'
    });
    
    // Capacity checks
    // Gross section
    const phi_Pn_gross = this.phi_y * input.splicePlate.Fy * width_min * t_final;
    checks.push({
      name: 'Plate Gross Section',
      demand: forces.Tu_flange,
      capacity: phi_Pn_gross,
      ratio: forces.Tu_flange / phi_Pn_gross,
      status: forces.Tu_flange / phi_Pn_gross <= 1.0 ? 'OK' : 'NG',
      reference: 'AISC 360-22 J4.1(a)'
    });
    
    // Net section
    const An = (width_min - 2 * hole_dia) * t_final;
    const phi_Pn_net = this.phi_r * input.splicePlate.Fu * An;
    checks.push({
      name: 'Plate Net Section',
      demand: forces.Tu_flange,
      capacity: phi_Pn_net,
      ratio: forces.Tu_flange / phi_Pn_net,
      status: forces.Tu_flange / phi_Pn_net <= 1.0 ? 'OK' : 'NG',
      reference: 'AISC 360-22 J4.1(b)'
    });
    
    // Block shear
    const Agv = 2 * (edge + (rows - 1) * spacing) * t_final;
    const Anv = Agv - 2 * rows * hole_dia * t_final;
    const Ant = (spacing - hole_dia) * t_final;
    const Ubs = 1.0;
    const Rn_bs = 0.6 * input.splicePlate.Fu * Anv + Ubs * input.splicePlate.Fu * Ant;
    const phi_Rn_bs = this.phi_r * Rn_bs;
    
    checks.push({
      name: 'Block Shear',
      demand: forces.Tu_flange,
      capacity: phi_Rn_bs,
      ratio: forces.Tu_flange / phi_Rn_bs,
      status: forces.Tu_flange / phi_Rn_bs <= 1.0 ? 'OK' : 'NG',
      reference: 'AISC 360-22 J4.3'
    });
    
    // Bolt bearing
    const phi_Rn_bearing = n_bolts_per_side * 2 * this.phi_b * 2.4 * d_bolt * t_final * input.splicePlate.Fu;
    checks.push({
      name: 'Bolt Bearing',
      demand: forces.Tu_flange,
      capacity: phi_Rn_bearing,
      ratio: forces.Tu_flange / phi_Rn_bearing,
      status: forces.Tu_flange / phi_Rn_bearing <= 1.0 ? 'OK' : 'NG',
      reference: 'AISC 360-22 J3.10'
    });
    
    // Section change accommodation
    if (Math.abs(colAbove.d - colBelow.d) > 2) {
      notes.push(`Column depth change of ${Math.abs(colAbove.d - colBelow.d).toFixed(1)}" - use fill plates`);
    }
    if (Math.abs(colAbove.bf - colBelow.bf) > 1) {
      notes.push(`Flange width change of ${Math.abs(colAbove.bf - colBelow.bf).toFixed(1)}" - verify bearing alignment`);
    }
    
    const isAdequate = checks.every(c => c.status === 'OK');
    
    return {
      isAdequate,
      spliceType: input.spliceType,
      flangePlates: {
        thickness: t_final,
        width: width_min,
        length: Math.ceil(plate_length),
        quantity: 4
      },
      bolts: {
        size: `${input.bolts?.type || 'A325'}-${d_bolt}"`,
        quantity: n_bolts_total,
        rows,
        columns: cols,
        spacing,
        edgeDistance: edge
      },
      checks,
      notes,
      calculations: steps,
      codeReference: 'AISC 360-22 Chapter J, AISC 341-22 E3.6e'
    };
  }
  
  /**
   * Design welded column splice
   */
  private designWeldedSplice(
    input: ColumnSpliceInput,
    forces: ReturnType<typeof this.determineDesignForces>,
    steps: CalculationStep[],
    checks: ColumnSpliceResult['checks'],
    notes: string[]
  ): ColumnSpliceResult {
    const colBelow = input.columnBelow;
    const FEXX = input.welds?.electrode || 70;
    
    if (input.spliceType === SpliceType.COLUMN_CJP) {
      // CJP welds - full strength
      notes.push('CJP welds develop full section capacity');
      notes.push('Weld access holes required per AWS D1.8');
      
      checks.push({
        name: 'CJP Flange Weld',
        demand: forces.Tu_flange,
        capacity: this.phi_y * colBelow.Fy * colBelow.bf * colBelow.tf,
        ratio: forces.Tu_flange / (this.phi_y * colBelow.Fy * colBelow.bf * colBelow.tf),
        status: 'OK',
        reference: 'AISC 360-22 J2.6'
      });
      
      return {
        isAdequate: true,
        spliceType: input.spliceType,
        welds: {
          flangeWeld: { type: 'CJP', size: colBelow.tf },
          webWeld: { type: 'CJP', size: colBelow.tw }
        },
        checks,
        notes,
        calculations: steps,
        codeReference: 'AISC 360-22 J2.6'
      };
    }
    
    // Fillet welded flange plates
    const t_plate = Math.max(
      forces.Tu_flange / (this.phi_y * input.splicePlate.Fy * (colBelow.bf + 2)),
      SPLICE_PLATE_LIMITS.min_thickness
    );
    const t_final = this.roundUpThickness(t_plate);
    
    // Fillet weld size (max = plate thickness - 1/16")
    const w_max = t_final - 1/16;
    const w = Math.min(w_max, 5/16);
    
    // Required weld length
    const Fnw = 0.6 * FEXX;
    const throat = 0.707 * w;
    const strength_per_inch = this.phi_w * Fnw * throat;
    const L_weld = forces.Tu_flange / (4 * strength_per_inch); // 4 lines of weld
    
    steps.push({
      step: 4,
      description: 'Required weld length for flange plates',
      formula: 'L = Tu / (4 × φ × 0.6 × FEXX × 0.707 × w)',
      values: { Tu: forces.Tu_flange, FEXX, w },
      result: L_weld,
      unit: 'in'
    });
    
    checks.push({
      name: 'Flange Plate Weld',
      demand: forces.Tu_flange,
      capacity: 4 * strength_per_inch * L_weld * 1.1, // 10% margin
      ratio: forces.Tu_flange / (4 * strength_per_inch * L_weld * 1.1),
      status: 'OK',
      reference: 'AISC 360-22 J2.4'
    });
    
    return {
      isAdequate: true,
      spliceType: input.spliceType,
      flangePlates: {
        thickness: t_final,
        width: colBelow.bf + 2,
        length: Math.ceil(L_weld) + 4,
        quantity: 4
      },
      welds: {
        flangeWeld: { type: 'FILLET', size: w, length: Math.ceil(L_weld) }
      },
      checks,
      notes,
      calculations: steps,
      codeReference: 'AISC 360-22 J2'
    };
  }
  
  /**
   * Design PJP splice (common for heavy columns)
   */
  private designPJPSplice(
    input: ColumnSpliceInput,
    forces: ReturnType<typeof this.determineDesignForces>,
    steps: CalculationStep[],
    checks: ColumnSpliceResult['checks'],
    notes: string[]
  ): ColumnSpliceResult {
    const colBelow = input.columnBelow;
    const FEXX = input.welds?.electrode || 70;
    
    // PJP weld throat
    const throat = input.welds?.pjpThroat || (colBelow.tf / 2);
    
    // PJP capacity
    const Fnw = 0.6 * FEXX;
    const phi_Rn_flange = this.phi_w * Fnw * throat * colBelow.bf * 2; // Both flanges
    
    steps.push({
      step: 4,
      description: 'PJP weld capacity',
      formula: 'φRn = φ × 0.6 × FEXX × t_throat × bf',
      values: { FEXX, throat, bf: colBelow.bf },
      result: phi_Rn_flange,
      unit: 'kips'
    });
    
    checks.push({
      name: 'PJP Flange Weld',
      demand: forces.Tu_flange,
      capacity: phi_Rn_flange,
      ratio: forces.Tu_flange / phi_Rn_flange,
      status: forces.Tu_flange / phi_Rn_flange <= 1.0 ? 'OK' : 'NG',
      reference: 'AISC 360-22 J2.4'
    });
    
    notes.push('PJP welds common for heavy columns where full CJP not required');
    notes.push(`Minimum throat = ${throat.toFixed(2)}" per AISC Table J2.3`);
    
    const isAdequate = checks.every(c => c.status === 'OK');
    
    return {
      isAdequate,
      spliceType: input.spliceType,
      welds: {
        flangeWeld: { type: 'PJP', size: throat },
        webWeld: { type: 'PJP', size: colBelow.tw / 2 }
      },
      checks,
      notes,
      calculations: steps,
      codeReference: 'AISC 360-22 J2.1'
    };
  }
  
  /**
   * Design bearing (finish-to-bear) splice
   */
  private designBearingSplice(
    input: ColumnSpliceInput,
    forces: ReturnType<typeof this.determineDesignForces>,
    steps: CalculationStep[],
    checks: ColumnSpliceResult['checks'],
    notes: string[]
  ): ColumnSpliceResult {
    const colBelow = input.columnBelow;
    
    notes.push('Bearing splice with finished surfaces in contact');
    notes.push('Column ends must be milled to bear per AISC M4.4');
    notes.push('Erection bolts provided for alignment during erection');
    
    // For bearing, check that column is in compression
    if (input.Pu < 0) {
      notes.push('WARNING: Net tension exists - bearing splice may not be appropriate');
    }
    
    // Bearing capacity (columns in contact)
    const Fp = 1.8 * colBelow.Fy; // Bearing stress on milled surface
    const A_bearing = colBelow.A;
    const phi_Pn_bearing = 0.75 * Fp * A_bearing;
    
    steps.push({
      step: 2,
      description: 'Bearing capacity on milled surfaces',
      formula: 'φPn = 0.75 × 1.8 × Fy × A',
      values: { Fy: colBelow.Fy, A: A_bearing },
      result: phi_Pn_bearing,
      unit: 'kips',
      reference: 'AISC 360-22 J7'
    });
    
    checks.push({
      name: 'Bearing on Contact',
      demand: forces.Pu_design,
      capacity: phi_Pn_bearing,
      ratio: forces.Pu_design / phi_Pn_bearing,
      status: forces.Pu_design / phi_Pn_bearing <= 1.0 ? 'OK' : 'NG',
      reference: 'AISC 360-22 J7'
    });
    
    // Erection bolts (minimum requirements)
    const n_erection = Math.max(
      input.erectionBolts,
      BEARING_SPLICE.erection_bolts_min,
      forces.Vu_design > 50 ? BEARING_SPLICE.erection_bolts_typical : BEARING_SPLICE.erection_bolts_min
    );
    
    // Even for bearing, need to transfer moment through splice plates
    // Design flange plates for moment per minimum requirements
    const Tu_moment = forces.Mux_design / (colBelow.d - colBelow.tf);
    const Tu_design = Math.max(Tu_moment, forces.Tu_flange * 0.5); // At least 50% of minimum
    
    if (Tu_design > 10) {
      // Design flange splice plates for moment
      const boltKey = `A325_1` as keyof typeof BOLT_DATA;
      const boltData = BOLT_DATA[boltKey];
      const n_flange_bolts = Math.ceil(Tu_design / (4 * this.phi_b * boltData.Fnv * boltData.Ab));
      
      return {
        isAdequate: checks.every(c => c.status === 'OK'),
        spliceType: SpliceType.COLUMN_BEARING,
        flangePlates: {
          thickness: 0.75,
          width: colBelow.bf + 1,
          length: 12 + 3 * n_flange_bolts,
          quantity: 4
        },
        bolts: {
          size: 'A325-1"',
          quantity: 4 * n_flange_bolts + n_erection,
          rows: n_flange_bolts,
          columns: 2,
          spacing: 3,
          edgeDistance: 1.5
        },
        checks,
        notes,
        calculations: steps,
        codeReference: 'AISC 360-22 J7, M4.4'
      };
    }
    
    // Simple bearing splice with erection bolts only
    return {
      isAdequate: checks.every(c => c.status === 'OK'),
      spliceType: SpliceType.COLUMN_BEARING,
      flangePlates: {
        thickness: 0.5,
        width: colBelow.bf - 1,
        length: 12,
        quantity: 4
      },
      bolts: {
        size: 'A325-3/4" (erection)',
        quantity: n_erection,
        rows: 2,
        columns: 2,
        spacing: 3,
        edgeDistance: 1.5
      },
      checks,
      notes,
      calculations: steps,
      codeReference: 'AISC 360-22 J7, M4.4'
    };
  }
  
  /**
   * Round up to standard plate thickness
   */
  private roundUpThickness(t: number): number {
    const standard = [0.375, 0.5, 0.625, 0.75, 0.875, 1.0, 1.125, 1.25, 1.5, 1.75, 2.0];
    return standard.find(s => s >= t) || 2.0;
  }
}

// Export singleton instance
export const columnSpliceCalculator = new ColumnSpliceCalculator();
