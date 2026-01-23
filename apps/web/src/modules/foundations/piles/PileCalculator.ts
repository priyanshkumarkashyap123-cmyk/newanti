/**
 * Pile Foundation Design Calculator
 * Per AASHTO LRFD, ACI 318-19, IBC
 * 
 * Features:
 * - Axial capacity (end bearing + shaft friction)
 * - Structural capacity
 * - Lateral capacity (simplified p-y)
 * - Settlement estimation
 * - Group effects
 */

import {
  PileType,
  SoilType,
  InstallationMethod,
  PileCapacityInput,
  PileDesignResult,
  AxialCapacityResult,
  StructuralCapacityResult,
  LateralCapacityResult,
  SettlementResult,
  SoilLayer,
  CalculationStep,
  PILE_RESISTANCE_FACTORS,
  BEARING_CAPACITY_FACTORS,
  SHAFT_FRICTION_FACTORS,
} from './PileTypes';

export class PileCapacityCalculator {
  private input: PileCapacityInput;
  private calculations: CalculationStep[] = [];
  private stepCounter = 1;
  
  constructor(input: PileCapacityInput) {
    this.input = input;
  }
  
  /**
   * Main design method
   */
  public design(): PileDesignResult {
    this.calculations = [];
    this.stepCounter = 1;
    
    const { section, geometry, loads, designMethod } = this.input;
    
    // Step 1: Calculate axial capacity
    const axialCapacity = this.calculateAxialCapacity();
    
    // Step 2: Check structural capacity
    const structuralCapacity = this.checkStructuralCapacity();
    
    // Step 3: Check lateral capacity if required
    let lateralCapacity: LateralCapacityResult | undefined;
    if (this.input.checkLateral && loads.Hu) {
      lateralCapacity = this.checkLateralCapacity();
    }
    
    // Step 4: Check settlement if required
    let settlement: SettlementResult | undefined;
    if (this.input.checkSettlement && loads.P_service) {
      settlement = this.checkSettlement();
    }
    
    // Determine governing condition
    const ratios = [
      { ratio: axialCapacity.ratio, condition: 'Geotechnical axial capacity' },
      { ratio: structuralCapacity.ratio_axial, condition: 'Structural capacity' },
    ];
    
    if (lateralCapacity) {
      ratios.push({ ratio: lateralCapacity.ratio, condition: 'Lateral capacity' });
    }
    
    const governing = ratios.reduce((max, item) => 
      item.ratio > max.ratio ? item : max, ratios[0]);
    
    // Overall adequacy
    const isAdequate = 
      axialCapacity.isAdequate &&
      structuralCapacity.isAdequate &&
      (!lateralCapacity || lateralCapacity.isAdequate) &&
      (!settlement || settlement.isAdequate);
    
    // Recommendations
    const recommendations: string[] = [];
    if (!axialCapacity.isAdequate) {
      recommendations.push('Increase pile length or use larger section');
    }
    if (!structuralCapacity.isAdequate) {
      recommendations.push('Use larger pile section or higher strength material');
    }
    if (lateralCapacity && !lateralCapacity.isAdequate) {
      recommendations.push('Use battered piles or increase pile stiffness');
    }
    if (settlement && !settlement.isAdequate) {
      recommendations.push('Increase pile length to reach stiffer stratum');
    }
    
    return {
      isAdequate,
      pileType: section.pileType,
      axialCapacity,
      structuralCapacity,
      lateralCapacity,
      settlement,
      governingRatio: governing.ratio,
      governingCondition: governing.condition,
      recommendations,
      calculations: this.calculations,
      codeReference: 'AASHTO LRFD, ACI 318-19',
    };
  }
  
  /**
   * Calculate axial capacity
   */
  private calculateAxialCapacity(): AxialCapacityResult {
    const { section, geometry, soilLayers, installationMethod, loads, designMethod } = this.input;
    
    // Determine pile perimeter and tip area
    let perimeter: number;
    let tipArea: number;
    
    if (section.diameter) {
      perimeter = Math.PI * section.diameter / 12; // ft
      tipArea = Math.PI * Math.pow(section.diameter / 12 / 2, 2); // ft²
    } else if (section.width && section.depth) {
      perimeter = 2 * (section.width + section.depth) / 12; // ft
      tipArea = (section.width * section.depth) / 144; // ft²
    } else {
      perimeter = section.Ap / 12; // ft
      tipArea = section.Ag / 144; // ft²
    }
    
    // Calculate shaft friction for each layer
    let Qs = 0;
    const Qs_byLayer: { layer: number; Qs: number }[] = [];
    let cumulativeDepth = 0;
    
    for (let i = 0; i < soilLayers.length; i++) {
      const layer = soilLayers[i];
      const layerTop = layer.depth_top;
      const layerBottom = Math.min(layer.depth_bottom, geometry.length);
      
      if (layerBottom <= layerTop) continue;
      
      const layerThickness = layerBottom - layerTop;
      const midDepth = (layerTop + layerBottom) / 2;
      
      let fs: number; // Unit shaft friction, psf
      
      if (this.isCohesive(layer.soilType)) {
        // Alpha method for clay
        const Su = layer.Su || 1000; // Default Su
        const alpha = this.getAlphaFactor(Su);
        fs = alpha * Su;
        
      } else {
        // Beta method for sand
        const phi = layer.phi || 30; // Default φ
        const delta = this.getDelta(phi, section.pileType);
        
        // Effective overburden at mid-depth
        const waterDepth = this.input.waterTableDepth || geometry.length;
        let sigma_v: number;
        if (midDepth <= waterDepth) {
          sigma_v = layer.gamma * midDepth;
        } else {
          sigma_v = layer.gamma * waterDepth + 
            (layer.gamma_sub || layer.gamma - 62.4) * (midDepth - waterDepth);
        }
        
        // K factor based on installation
        let K: number;
        if (this.isDriven(installationMethod)) {
          K = SHAFT_FRICTION_FACTORS.K_driven_displacement;
        } else {
          K = SHAFT_FRICTION_FACTORS.K_drilled;
        }
        
        fs = K * sigma_v * Math.tan(delta * Math.PI / 180);
        
        // Limit fs for deep piles (critical depth concept)
        const fs_limit = 2000; // psf
        fs = Math.min(fs, fs_limit);
      }
      
      const Qs_layer = fs * perimeter * layerThickness / 1000; // kips
      Qs += Qs_layer;
      Qs_byLayer.push({ layer: i + 1, Qs: Qs_layer });
      
      this.addStep(
        `Calculate shaft friction - Layer ${i + 1}`,
        this.isCohesive(layer.soilType) ? 'fs = α × Su' : 'fs = K × σv\' × tan(δ)',
        {
          soilType: layer.soilType,
          thickness: layerThickness.toFixed(1) + ' ft',
          fs: fs.toFixed(0) + ' psf',
        },
        Qs_layer.toFixed(1),
        'kips',
        'AASHTO LRFD 10.7.3'
      );
    }
    
    // Calculate end bearing
    const bearingLayer = this.getBearingLayer();
    let qp: number; // Unit end bearing, psf
    
    if (this.isCohesive(bearingLayer.soilType)) {
      // Clay: qp = Nc × Su
      const Su = bearingLayer.Su || 2000;
      qp = BEARING_CAPACITY_FACTORS.Nc * Su;
      
      // Limit qp
      qp = Math.min(qp, BEARING_CAPACITY_FACTORS.qp_limit_clay * 1000);
      
    } else {
      // Sand: qp = σv' × Nq (limited)
      const phi = bearingLayer.phi || 35;
      const Nq = this.interpolateNq(phi);
      
      // Effective overburden at tip
      const tipDepth = geometry.length;
      const waterDepth = this.input.waterTableDepth || tipDepth;
      let sigma_v: number;
      if (tipDepth <= waterDepth) {
        sigma_v = bearingLayer.gamma * tipDepth;
      } else {
        sigma_v = bearingLayer.gamma * waterDepth + 
          (bearingLayer.gamma_sub || bearingLayer.gamma - 62.4) * (tipDepth - waterDepth);
      }
      
      qp = sigma_v * Nq;
      
      // Limit qp
      qp = Math.min(qp, BEARING_CAPACITY_FACTORS.qp_limit_sand * 1000);
    }
    
    const Qp = qp * tipArea / 1000; // kips
    
    this.addStep(
      'Calculate end bearing capacity',
      this.isCohesive(bearingLayer.soilType) ? 'qp = Nc × Su' : 'qp = σv\' × Nq',
      {
        bearingStratum: bearingLayer.soilType,
        qp: (qp / 1000).toFixed(1) + ' ksf',
        tipArea: tipArea.toFixed(2) + ' ft²',
      },
      Qp.toFixed(1),
      'kips',
      'AASHTO LRFD 10.7.3'
    );
    
    // Total nominal capacity
    const Qn = Qp + Qs;
    
    // Resistance factors
    let phi_Qp: number;
    let phi_Qs: number;
    
    if (this.isDriven(installationMethod)) {
      phi_Qp = this.isCohesive(bearingLayer.soilType) ? 
        PILE_RESISTANCE_FACTORS.driven_end_bearing_clay :
        PILE_RESISTANCE_FACTORS.driven_end_bearing_sand;
      phi_Qs = this.isCohesive(bearingLayer.soilType) ?
        PILE_RESISTANCE_FACTORS.driven_side_friction_clay :
        PILE_RESISTANCE_FACTORS.driven_side_friction_sand;
    } else {
      phi_Qp = this.isCohesive(bearingLayer.soilType) ?
        PILE_RESISTANCE_FACTORS.drilled_end_bearing_clay :
        PILE_RESISTANCE_FACTORS.drilled_end_bearing_sand;
      phi_Qs = this.isCohesive(bearingLayer.soilType) ?
        PILE_RESISTANCE_FACTORS.drilled_side_friction_clay :
        PILE_RESISTANCE_FACTORS.drilled_side_friction_sand;
    }
    
    const phi_Qn = phi_Qp * Qp + phi_Qs * Qs;
    
    // For ASD, use FS = 2.5
    const FS = 2.5;
    const capacity = designMethod === 'LRFD' ? phi_Qn : Qn / FS;
    
    const Pu = loads.Pu;
    const ratio = Pu / capacity;
    
    this.addStep(
      'Calculate total axial capacity',
      'Qn = Qp + Qs',
      {
        Qp: Qp.toFixed(1) + ' kips',
        Qs: Qs.toFixed(1) + ' kips',
        Qn: Qn.toFixed(1) + ' kips',
        phi_Qn: phi_Qn.toFixed(1) + ' kips',
      },
      `Capacity = ${capacity.toFixed(1)} kips, Ratio = ${ratio.toFixed(3)}`,
      undefined,
      'AASHTO LRFD 10.7.3'
    );
    
    return {
      Qp,
      Qs,
      Qn,
      phi_Qn,
      Pu,
      ratio,
      isAdequate: ratio <= 1.0,
      Qs_byLayer,
      qp: qp / 1000, // ksf
      fs_avg: Qs / (perimeter * geometry.length) * 1000, // psf converted to ksf
    };
  }
  
  /**
   * Check structural capacity of pile
   */
  private checkStructuralCapacity(): StructuralCapacityResult {
    const { section, loads, designMethod } = this.input;
    
    let Pn: number;
    let phi: number;
    
    if (section.Fy) {
      // Steel pile
      Pn = section.Fy * section.Ag; // kips
      phi = PILE_RESISTANCE_FACTORS.structural_compression;
      
    } else if (section.fc) {
      // Concrete pile
      // Pn = 0.80 × (0.85 fc' Ag) for tied columns
      Pn = 0.80 * 0.85 * section.fc / 1000 * section.Ag; // kips
      phi = 0.65; // Tied column
      
    } else {
      // Default assumption
      Pn = 200; // kips
      phi = 0.75;
    }
    
    const phi_Pn = phi * Pn;
    const Pu = loads.Pu;
    const ratio_axial = Pu / phi_Pn;
    
    this.addStep(
      'Check structural capacity',
      section.Fy ? 'Pn = Fy × Ag' : 'Pn = 0.80 × 0.85fc\' × Ag',
      {
        Ag: section.Ag.toFixed(1) + ' in²',
        strength: section.Fy ? section.Fy + ' ksi' : (section.fc || 0) / 1000 + ' ksi',
        Pn: Pn.toFixed(0) + ' kips',
      },
      `φPn = ${phi_Pn.toFixed(0)} kips, Ratio = ${ratio_axial.toFixed(3)}`,
      undefined,
      'ACI 318-19 / AISC 360'
    );
    
    return {
      Pn,
      phi_Pn,
      ratio_axial,
      isAdequate: ratio_axial <= 1.0,
      limitState: 'COMPRESSION',
    };
  }
  
  /**
   * Check lateral capacity (simplified)
   */
  private checkLateralCapacity(): LateralCapacityResult {
    const { section, geometry, soilLayers, loads } = this.input;
    
    // Simplified Broms method for short piles in clay
    const topLayer = soilLayers[0];
    
    // Characteristic length
    const E = section.E || (section.Fy ? 29000 : 3600); // ksi
    const I = section.Ix;
    
    // Subgrade modulus
    let ks: number; // ksf/ft
    if (this.isCohesive(topLayer.soilType)) {
      const Su = (topLayer.Su || 1500) / 1000; // ksf
      ks = 67 * Su; // Approximate for clay
    } else {
      const N60 = topLayer.N60 || 20;
      ks = N60 * 30; // Approximate for sand
    }
    
    // Stiffness parameter
    const T = Math.pow(E * I / ks, 0.2) / 12; // ft
    
    // Check if short or long pile
    const L_T = geometry.length / T;
    
    let Hn: number;
    if (L_T < 2) {
      // Short pile - soil failure governs
      if (this.isCohesive(topLayer.soilType)) {
        const Su = (topLayer.Su || 1500) / 1000; // ksf
        const d = (section.diameter || section.width || 12) / 12; // ft
        Hn = 9 * Su * d * geometry.length / 2; // Broms for clay
      } else {
        const Kp = 3; // Passive pressure coefficient (approx)
        const gamma = topLayer.gamma / 1000; // kcf
        const d = (section.diameter || section.width || 12) / 12;
        Hn = 0.5 * Kp * gamma * d * Math.pow(geometry.length, 2); // Broms for sand
      }
    } else {
      // Long pile - pile failure governs
      const Mp = section.Fy ? section.Fy * section.Sx / 12 : 
        0.85 * (section.fc || 4000) / 1000 * Math.pow(section.Sx, 0.5); // kip-ft
      
      if (this.isCohesive(topLayer.soilType)) {
        const Su = (topLayer.Su || 1500) / 1000;
        const d = (section.diameter || section.width || 12) / 12;
        Hn = 2 * Mp / (1.5 * d + 0.5 * geometry.length);
      } else {
        Hn = 2 * Mp / geometry.length;
      }
    }
    
    const phi_Hn = PILE_RESISTANCE_FACTORS.lateral * Hn;
    const Hu = loads.Hu || 0;
    const ratio = Hu / phi_Hn;
    
    // Estimate deflection
    const delta_top = Hu * Math.pow(T * 12, 3) / (E * I) * 2.4; // inches (approximate)
    const delta_allowable = geometry.length * 12 / 100; // L/100
    
    this.addStep(
      'Check lateral capacity (Broms method)',
      L_T < 2 ? 'Short pile - soil governs' : 'Long pile - pile governs',
      {
        'L/T': L_T.toFixed(2),
        T: T.toFixed(2) + ' ft',
        Hn: Hn.toFixed(1) + ' kips',
        phi_Hn: phi_Hn.toFixed(1) + ' kips',
      },
      `Ratio = ${ratio.toFixed(3)}, Deflection = ${delta_top.toFixed(2)} in`,
      undefined,
      'Broms Method'
    );
    
    // Maximum moment
    const M_max = Hu * T;
    const depthToMax = 1.5 * T;
    
    return {
      Hu_allowable: Hn / 2.5,
      phi_Hn,
      Hu,
      ratio,
      isAdequate: ratio <= 1.0 && delta_top <= delta_allowable,
      delta_top,
      delta_allowable,
      M_max,
      depthToMax,
    };
  }
  
  /**
   * Check settlement
   */
  private checkSettlement(): SettlementResult {
    const { section, geometry, loads } = this.input;
    
    const P = loads.P_service || loads.Pu / 1.5;
    const L = geometry.length * 12; // inches
    const E = section.E || (section.Fy ? 29000 : 3600);
    const A = section.Ag;
    
    // Elastic compression of pile
    const elastic = P * L / (E * A);
    
    // Tip settlement (simplified - assume 1% of diameter)
    const d = section.diameter || section.width || 12;
    const tip = 0.01 * d;
    
    // Total
    const total = elastic + tip;
    
    // Allowable (typically 1" for structures)
    const allowable = 1.0;
    
    this.addStep(
      'Check settlement',
      'δ = PL/EA + tip settlement',
      {
        P: P.toFixed(1) + ' kips',
        elastic: elastic.toFixed(3) + ' in',
        tip: tip.toFixed(3) + ' in',
      },
      total.toFixed(3),
      'in',
      'AASHTO LRFD 10.7.2'
    );
    
    return {
      elastic,
      tip,
      total,
      allowable,
      isAdequate: total <= allowable,
    };
  }
  
  /**
   * Helper methods
   */
  private isCohesive(soilType: SoilType): boolean {
    return soilType.includes('CLAY');
  }
  
  private isDriven(method: InstallationMethod): boolean {
    return method.includes('DRIVEN');
  }
  
  private getAlphaFactor(Su: number): number {
    for (const item of SHAFT_FRICTION_FACTORS.alpha) {
      if (Su <= item.Su_max) return item.alpha;
    }
    return 0.35; // Default for high strength clay
  }
  
  private getDelta(phi: number, pileType: PileType): number {
    if (pileType === PileType.STEEL_H_PILE || pileType === PileType.STEEL_PIPE_PILE) {
      return phi * SHAFT_FRICTION_FACTORS.delta_phi_steel;
    } else if (pileType === PileType.TIMBER) {
      return phi * SHAFT_FRICTION_FACTORS.delta_phi_timber;
    } else {
      return phi * SHAFT_FRICTION_FACTORS.delta_phi_concrete;
    }
  }
  
  private interpolateNq(phi: number): number {
    const Nq = BEARING_CAPACITY_FACTORS.Nq;
    const angles = Object.keys(Nq).map(Number).sort((a, b) => a - b);
    
    if (phi <= angles[0]) return Nq[angles[0]];
    if (phi >= angles[angles.length - 1]) return Nq[angles[angles.length - 1]];
    
    for (let i = 0; i < angles.length - 1; i++) {
      if (phi >= angles[i] && phi <= angles[i + 1]) {
        const ratio = (phi - angles[i]) / (angles[i + 1] - angles[i]);
        return Nq[angles[i]] + ratio * (Nq[angles[i + 1]] - Nq[angles[i]]);
      }
    }
    
    return Nq[30]; // Default
  }
  
  private getBearingLayer(): SoilLayer {
    const { geometry, soilLayers } = this.input;
    
    // Find layer at pile tip
    for (const layer of soilLayers) {
      if (geometry.length >= layer.depth_top && geometry.length <= layer.depth_bottom) {
        return layer;
      }
    }
    
    // Return last layer if pile extends beyond profile
    return soilLayers[soilLayers.length - 1];
  }
  
  /**
   * Add calculation step
   */
  private addStep(
    description: string,
    formula?: string,
    values?: Record<string, number | string>,
    result?: number | string,
    unit?: string,
    reference?: string
  ): void {
    this.calculations.push({
      step: this.stepCounter++,
      description,
      formula,
      values,
      result: result ?? '',
      unit,
      reference,
    });
  }
}

// Export convenience function
export function designPile(input: PileCapacityInput): PileDesignResult {
  const calculator = new PileCapacityCalculator(input);
  return calculator.design();
}
