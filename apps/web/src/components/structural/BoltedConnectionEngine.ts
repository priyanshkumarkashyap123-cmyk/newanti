/**
 * ============================================================================
 * STEEL CONNECTION DESIGN ENGINE
 * ============================================================================
 * 
 * Bolted and Welded Connection Design per IS 800:2007
 * Includes shear connections, moment connections, and splice plates
 * 
 * @version 1.0.0
 */

import { CalculationResult, CalculationStep, CodeCheck } from './StructuralCalculator';

// ============================================================================
// TYPES
// ============================================================================

export interface BoltedConnectionInput {
  // Connection Type
  connectionType: 'shear' | 'moment' | 'tension' | 'splice';
  
  // Loading (Factored)
  shearForce?: number;      // kN
  axialForce?: number;      // kN
  moment?: number;          // kN·m
  
  // Bolt Properties
  boltGrade: '4.6' | '8.8' | '10.9' | '12.9';
  boltDiameter: number;     // mm (16, 20, 22, 24, 27, 30)
  boltType: 'bearing' | 'friction'; // Slip-critical or bearing type
  
  // Connection Geometry
  numRows: number;
  numColumns: number;
  pitch: number;            // mm - spacing along force
  gauge: number;            // mm - spacing perpendicular
  edgeDistance: number;     // mm
  endDistance: number;      // mm
  
  // Plates/Members
  plateThickness: number;   // mm
  memberThickness: number;  // mm
  fy_plate: number;         // MPa - plate yield strength
  fu_plate: number;         // MPa - plate ultimate strength
  
  // Options
  numShearPlanes: 1 | 2;    // Single or double shear
  threadsInShearPlane: boolean;
  slotType: 'standard' | 'oversized' | 'short_slot' | 'long_slot';
}

export interface BoltedConnectionResult extends CalculationResult {
  boltStrengths: {
    shearCapacity: number;
    bearingCapacity: number;
    tensionCapacity: number;
    combinedRatio: number;
  };
  connectionCapacity: {
    shear: number;
    tension: number;
    moment: number;
  };
  pattern: {
    totalBolts: number;
    arrangement: string;
    pitch: number;
    gauge: number;
  };
}

// ============================================================================
// BOLT PROPERTIES (IS 800:2007 Table 1)
// ============================================================================

const BOLT_GRADES = {
  '4.6': { fyb: 240, fub: 400 },
  '8.8': { fyb: 640, fub: 800 },
  '10.9': { fyb: 900, fub: 1000 },
  '12.9': { fyb: 1080, fub: 1200 },
};

// Hole clearances (mm)
const HOLE_CLEARANCE = {
  standard: { 12: 1, 14: 1, 16: 2, 20: 2, 22: 2, 24: 2, 27: 3, 30: 3 },
};

// ============================================================================
// BOLTED CONNECTION DESIGN ENGINE
// ============================================================================

export class BoltedConnectionEngine {
  
  /**
   * Design bolted connection per IS 800:2007
   */
  calculate(input: BoltedConnectionInput): BoltedConnectionResult {
    const steps: CalculationStep[] = [];
    const codeChecks: CodeCheck[] = [];
    const warnings: string[] = [];
    
    const { connectionType, shearForce = 0, axialForce = 0, moment = 0, boltGrade, boltDiameter, boltType,
            numRows, numColumns, pitch, gauge, edgeDistance, endDistance, plateThickness, memberThickness,
            fy_plate, fu_plate, numShearPlanes, threadsInShearPlane, slotType } = input;
    
    const { fyb, fub } = BOLT_GRADES[boltGrade];
    const d = boltDiameter;
    const t_min = Math.min(plateThickness, memberThickness);
    const totalBolts = numRows * numColumns;
    
    // Partial safety factors (IS 800:2007)
    const gamma_mb = 1.25; // Bolts
    const gamma_m0 = 1.10; // Yielding
    const gamma_m1 = 1.25; // Ultimate
    
    // ----- STEP 1: Bolt Areas -----
    const A_nb = Math.PI * d * d / 4; // Nominal area
    const A_sb = 0.78 * A_nb; // Stress area (threads in shear plane)
    const A_effective = threadsInShearPlane ? A_sb : A_nb;
    
    // Hole diameter
    const clearance = 2; // Standard hole clearance for M16-M24
    const d0 = d + clearance;
    
    steps.push({
      title: 'Step 1: Bolt Properties',
      description: 'Calculate bolt areas and material properties',
      formula: 'A_nb = π×d²/4, A_sb = 0.78×A_nb',
      values: {
        'Bolt Grade': boltGrade,
        'Bolt Diameter': `M${d}`,
        'Nominal Area (A_nb)': `${A_nb.toFixed(1)} mm²`,
        'Stress Area (A_sb)': `${A_sb.toFixed(1)} mm²`,
        'Effective Area': `${A_effective.toFixed(1)} mm²`,
        'Bolt UTS (f_ub)': `${fub} MPa`,
        'Hole Diameter': `${d0} mm`,
      },
      reference: 'IS 800:2007 Cl. 10.3.1',
    });
    
    // ----- STEP 2: Bolt Shear Capacity -----
    // Vnsb = fub × (nn×Anb + ns×Asb) / (√3 × γmb)
    // For single bolt in single shear:
    let Vnsb: number;
    if (boltType === 'bearing') {
      Vnsb = (fub * A_effective) / (Math.sqrt(3) * gamma_mb * 1000); // kN per shear plane
      Vnsb *= numShearPlanes;
    } else {
      // Slip-critical (friction type)
      // Vsf = μ × ne × Kh × Fo
      const mu = 0.5; // Slip factor for Class A surface
      const ne = numShearPlanes;
      const Kh = slotType === 'standard' ? 1.0 : slotType === 'oversized' ? 0.85 : slotType === 'short_slot' ? 0.85 : 0.7;
      const Fo = 0.7 * fub * A_sb / (gamma_mb * 1000); // Proof load
      Vnsb = mu * ne * Kh * Fo;
    }
    
    steps.push({
      title: 'Step 2: Bolt Shear Capacity',
      description: boltType === 'bearing' ? 'Bearing type bolt shear strength' : 'Slip-critical friction capacity',
      formula: boltType === 'bearing' 
        ? 'V_nsb = f_ub × A_e / (√3 × γ_mb)'
        : 'V_sf = μ × n_e × K_h × F_o',
      values: {
        'Connection Type': boltType === 'bearing' ? 'Bearing Type' : 'Friction Type (Slip-critical)',
        'Number of Shear Planes': numShearPlanes,
        'Shear Capacity per Bolt': `${Vnsb.toFixed(2)} kN`,
      },
      reference: boltType === 'bearing' ? 'IS 800:2007 Cl. 10.3.3' : 'IS 800:2007 Cl. 10.4.3',
    });
    
    // ----- STEP 3: Bolt Bearing Capacity -----
    // Vnpb = 2.5 × kb × d × t × fu / γmb
    const e = Math.min(edgeDistance, endDistance);
    const p = pitch;
    
    // kb is minimum of: e/(3d0), p/(3d0)-0.25, fub/fu, 1.0
    const kb = Math.min(
      e / (3 * d0),
      p / (3 * d0) - 0.25,
      fub / fu_plate,
      1.0
    );
    
    const Vnpb = (2.5 * kb * d * t_min * fu_plate) / (gamma_mb * 1000); // kN
    
    steps.push({
      title: 'Step 3: Bolt Bearing Capacity',
      description: 'Calculate bearing strength of connected plates',
      formula: 'V_npb = 2.5 × k_b × d × t × f_u / γ_mb',
      values: {
        'Edge/End Distance': `${e} mm`,
        'Pitch': `${p} mm`,
        'k_b Factor': kb.toFixed(3),
        'Minimum Plate Thickness': `${t_min} mm`,
        'Bearing Capacity per Bolt': `${Vnpb.toFixed(2)} kN`,
      },
      reference: 'IS 800:2007 Cl. 10.3.4',
    });
    
    // ----- STEP 4: Bolt Tension Capacity -----
    // Tnb = 0.9 × fub × Asb / γmb
    const Tnb = (0.9 * fub * A_sb) / (gamma_mb * 1000); // kN
    
    steps.push({
      title: 'Step 4: Bolt Tension Capacity',
      description: 'Calculate tensile strength of bolt',
      formula: 'T_nb = 0.9 × f_ub × A_sb / γ_mb',
      values: {
        'Tensile Stress Area': `${A_sb.toFixed(1)} mm²`,
        'Tension Capacity per Bolt': `${Tnb.toFixed(2)} kN`,
      },
      reference: 'IS 800:2007 Cl. 10.3.5',
    });
    
    // ----- STEP 5: Connection Capacity -----
    // Governing shear capacity per bolt
    const Vgov = Math.min(Vnsb, Vnpb);
    
    // Total connection capacity
    const connectionShearCapacity = totalBolts * Vgov;
    const connectionTensionCapacity = totalBolts * Tnb;
    
    // Moment capacity (if applicable)
    let connectionMomentCapacity = 0;
    if (connectionType === 'moment') {
      // Bolts in tension-compression couple
      // Simplified: M = T × lever arm
      // For bolt group: consider bolt positions
      const leverArm = (numRows - 1) * pitch / 2 / 1000; // m
      const Tf = connectionTensionCapacity / 2; // Half bolts in tension
      connectionMomentCapacity = Tf * leverArm; // kN·m
    }
    
    steps.push({
      title: 'Step 5: Connection Capacity',
      description: 'Calculate total connection strength',
      formula: 'V_conn = n × min(V_nsb, V_npb)',
      values: {
        'Governing Bolt Shear': `${Vgov.toFixed(2)} kN`,
        'Total Bolts': `${totalBolts}`,
        'Shear Capacity': `${connectionShearCapacity.toFixed(2)} kN`,
        'Tension Capacity': `${connectionTensionCapacity.toFixed(2)} kN`,
        'Moment Capacity': connectionType === 'moment' ? `${connectionMomentCapacity.toFixed(2)} kN·m` : 'N/A',
      },
      reference: 'IS 800:2007 Cl. 10.3',
    });
    
    // ----- STEP 6: Demand vs Capacity -----
    const shearRatio = shearForce / connectionShearCapacity;
    const tensionRatio = axialForce > 0 ? axialForce / connectionTensionCapacity : 0;
    const momentRatio = moment > 0 && connectionMomentCapacity > 0 ? moment / connectionMomentCapacity : 0;
    
    // Combined check for tension and shear
    let combinedRatio = 0;
    if (shearForce > 0 && axialForce > 0) {
      // (V/Vd)² + (T/Td)² ≤ 1.0
      combinedRatio = Math.sqrt(shearRatio * shearRatio + tensionRatio * tensionRatio);
    } else {
      combinedRatio = Math.max(shearRatio, tensionRatio, momentRatio);
    }
    
    const isAdequate = combinedRatio <= 1.0;
    
    steps.push({
      title: 'Step 6: Utilization Check',
      description: 'Compare applied forces with connection capacity',
      formula: 'Combined: √[(V/V_d)² + (T/T_d)²] ≤ 1.0',
      values: {
        'Applied Shear': `${shearForce.toFixed(2)} kN`,
        'Applied Tension': `${axialForce.toFixed(2)} kN`,
        'Applied Moment': `${moment.toFixed(2)} kN·m`,
        'Shear Ratio': `${(shearRatio * 100).toFixed(1)}%`,
        'Tension Ratio': `${(tensionRatio * 100).toFixed(1)}%`,
        'Combined Ratio': `${(combinedRatio * 100).toFixed(1)}%`,
        'Status': isAdequate ? 'ADEQUATE' : 'INADEQUATE',
      },
      reference: 'IS 800:2007 Cl. 10.3.6',
    });
    
    codeChecks.push({
      clause: 'IS 800 Cl. 10.3.6',
      description: 'Combined shear and tension',
      required: '≤ 1.0',
      provided: combinedRatio.toFixed(3),
      status: isAdequate ? 'PASS' : 'FAIL',
    });
    
    // ----- STEP 7: Detailing Checks -----
    // Minimum pitch
    const pitchMin = 2.5 * d;
    const pitchOk = pitch >= pitchMin;
    
    // Maximum pitch (in compression zone)
    const pitchMax = Math.min(32 * t_min, 300);
    const pitchMaxOk = pitch <= pitchMax;
    
    // Edge distance
    const edgeMin = 1.7 * d0; // Sheared edge
    const edgeOk = edgeDistance >= edgeMin;
    
    // End distance
    const endMin = 1.7 * d0;
    const endOk = endDistance >= endMin;
    
    steps.push({
      title: 'Step 7: Detailing Checks',
      description: 'Verify spacing and edge distance requirements',
      formula: 'Pitch ≥ 2.5d, Edge ≥ 1.7d₀',
      values: {
        'Pitch': `${pitch}mm ≥ ${pitchMin.toFixed(0)}mm: ${pitchOk ? 'OK' : 'FAIL'}`,
        'Pitch Max': `${pitch}mm ≤ ${pitchMax.toFixed(0)}mm: ${pitchMaxOk ? 'OK' : 'FAIL'}`,
        'Edge Distance': `${edgeDistance}mm ≥ ${edgeMin.toFixed(0)}mm: ${edgeOk ? 'OK' : 'FAIL'}`,
        'End Distance': `${endDistance}mm ≥ ${endMin.toFixed(0)}mm: ${endOk ? 'OK' : 'FAIL'}`,
      },
      reference: 'IS 800:2007 Cl. 10.2',
    });
    
    codeChecks.push({
      clause: 'IS 800 Cl. 10.2.2',
      description: 'Minimum pitch',
      required: `≥ ${pitchMin.toFixed(0)} mm`,
      provided: `${pitch} mm`,
      status: pitchOk ? 'PASS' : 'FAIL',
    });
    
    codeChecks.push({
      clause: 'IS 800 Cl. 10.2.4',
      description: 'Minimum edge distance',
      required: `≥ ${edgeMin.toFixed(0)} mm`,
      provided: `${edgeDistance} mm`,
      status: edgeOk ? 'PASS' : 'FAIL',
    });
    
    if (!pitchOk) warnings.push('Pitch is less than minimum. Increase to 2.5d.');
    if (!edgeOk) warnings.push('Edge distance is less than minimum. Increase to 1.7d₀.');
    
    return {
      isAdequate: isAdequate && pitchOk && edgeOk,
      utilization: combinedRatio,
      capacity: connectionShearCapacity,
      demand: shearForce,
      status: isAdequate && pitchOk && edgeOk ? 'OK' : 'FAIL',
      message: isAdequate 
        ? `Connection adequate. ${totalBolts}×M${d} ${boltGrade} bolts. Utilization: ${(combinedRatio * 100).toFixed(1)}%`
        : 'Connection inadequate. Add bolts or increase size.',
      steps,
      codeChecks,
      warnings,
      boltStrengths: {
        shearCapacity: Vnsb,
        bearingCapacity: Vnpb,
        tensionCapacity: Tnb,
        combinedRatio,
      },
      connectionCapacity: {
        shear: connectionShearCapacity,
        tension: connectionTensionCapacity,
        moment: connectionMomentCapacity,
      },
      pattern: {
        totalBolts,
        arrangement: `${numRows} rows × ${numColumns} columns`,
        pitch,
        gauge,
      },
    };
  }
}

export const boltedConnectionEngine = new BoltedConnectionEngine();
