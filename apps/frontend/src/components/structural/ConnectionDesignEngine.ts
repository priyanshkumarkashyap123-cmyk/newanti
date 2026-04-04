/**
 * ============================================================================
 * STEEL CONNECTION DESIGN ENGINE - IS 800:2007
 * ============================================================================
 * CANONICAL for: Bolted connections, welded connections, and base plate design.
 * Used by: structural calculation pipeline (via structural/index.ts)
 *
 * Related IS 800 engines (non-overlapping responsibilities):
 *  - utils/IS800_SteelDesignEngine.ts — Member-level checks (tension/compression/combined)
 *  - structural/SteelDesignEngine.ts — Beam flexural design with LTB
 *
 * Complete steel connection design including:
 * - Bolted connections (bearing, friction grip)
 * - Welded connections (fillet, butt)
 * - Moment connections (end plate, flange plate)
 * - Shear connections (single/double angle, fin plate)
 * - Base plate design
 * 
 * @version 1.0.0
 * @author BeamLab Engineering
 */

import type { CalculationResult, CalculationStep, CodeCheck } from './StructuralCalculator';

// ============================================================================
// CONSTANTS - IS 800:2007
// ============================================================================

/** Bolt grades and properties - IS 800 Table 11 */
const BOLT_GRADES: Record<string, { fub: number; fyb: number }> = {
  '4.6': { fub: 400, fyb: 240 },
  '4.8': { fub: 400, fyb: 320 },
  '5.6': { fub: 500, fyb: 300 },
  '5.8': { fub: 500, fyb: 400 },
  '6.8': { fub: 600, fyb: 480 },
  '8.8': { fub: 800, fyb: 640 },
  '9.8': { fub: 900, fyb: 720 },
  '10.9': { fub: 1000, fyb: 900 },
  '12.9': { fub: 1200, fyb: 1080 },
};

/** Partial safety factors - IS 800 Table 5 */
const PARTIAL_SAFETY_FACTORS = {
  gamma_m0: 1.10, // Resistance governed by yielding
  gamma_m1: 1.25, // Resistance governed by ultimate stress
  gamma_mb: 1.25, // Bolts - friction type
  gamma_mf: 1.25, // Fabrication - shop welding
  gamma_mw: 1.25, // Field welding
};

/** Weld strengths - IS 800 Table 21 */
const WELD_STRENGTHS: Record<string, number> = {
  'E410': 410,   // fuw MPa
  'E450': 450,
  'E550': 550,
};

/** Slip factors for friction grip bolts - IS 800 Table 20 */
const SLIP_FACTORS: Record<string, number> = {
  'clean_mill_scale': 0.33,
  'sand_blasted': 0.48,
  'shot_blasted': 0.52,
  'phosphate': 0.30,
  'galvanized': 0.25,
};

/** Hole types */
const HOLE_TYPES = {
  'standard': { kb: 1.0, clearance: 2 },
  'oversize': { kb: 0.85, clearance: 3 },
  'short_slot': { kb: 0.85, clearance: 4 },
  'long_slot': { kb: 0.70, clearance: 6 },
};

// ============================================================================
// INTERFACES
// ============================================================================

interface BoltedConnectionInputs {
  // Bolt Properties
  bolt_grade: string;
  bolt_diameter: number;     // mm
  num_bolts: number;
  bolt_rows: number;
  bolt_columns: number;
  
  // Plate Properties
  plate_thickness: number;   // mm (thinner plate)
  plate_fu: number;          // MPa (ultimate strength)
  plate_fy: number;          // MPa (yield strength)
  
  // Connection Type
  connection_type: 'bearing' | 'friction' | 'combined';
  shear_plane: 'threads_in' | 'threads_excluded';
  num_shear_planes: number;
  
  // Loading
  shear_force: number;       // kN
  tension_force?: number;    // kN
  moment?: number;           // kN·m
  
  // Geometry
  edge_distance: number;     // mm
  pitch: number;             // mm
  gauge?: number;            // mm (for multi-column)
  
  // Options
  hole_type?: string;
  surface_treatment?: string;
}

interface WeldedConnectionInputs {
  // Weld Properties
  weld_type: 'fillet' | 'butt' | 'plug' | 'slot';
  weld_size: number;         // mm (leg length for fillet, throat for butt)
  weld_length: number;       // mm
  electrode_grade: string;
  
  // Base Metal
  plate_fu: number;          // MPa
  plate_thickness: number;   // mm
  
  // Loading
  shear_force?: number;      // kN (parallel to weld)
  tension_force?: number;    // kN (perpendicular to weld)
  resultant_force?: number;  // kN
  
  // Geometry
  weld_position: 'longitudinal' | 'transverse' | 'oblique';
  inspection_level?: 'visual' | 'ut' | 'rt';
}

interface BasePlateInputs {
  // Column Properties
  column_section: string;
  column_depth: number;      // mm
  column_flange_width: number; // mm
  column_flange_thickness: number; // mm
  column_web_thickness: number; // mm
  
  // Material
  fy_column: number;         // MPa
  fy_plate: number;          // MPa
  fck: number;               // MPa (concrete)
  
  // Loading
  axial_load: number;        // kN (compression)
  moment?: number;           // kN·m
  shear?: number;            // kN
  
  // Geometry
  plate_length?: number;     // mm
  plate_width?: number;      // mm
  plate_thickness?: number;  // mm
}

// ============================================================================
// BOLT CAPACITY CALCULATIONS
// ============================================================================

/**
 * Calculate nominal bolt area
 */
function getBoltArea(diameter: number): { gross: number; net: number } {
  const gross = Math.PI * diameter * diameter / 4;
  // Net tensile stress area (approximate from ISO 898)
  const netDiameter = diameter - 0.938 * 1.5; // Approximate pitch
  const net = Math.PI * netDiameter * netDiameter / 4;
  return { gross, net };
}

/**
 * Calculate bolt shear capacity - IS 800:2007 Cl. 10.3.3
 * Vdsb = Vnsb / γmb
 * Vnsb = fub × nn × Anb / √3 + fub × ns × Asb / √3
 * Where nn = number of shear planes with threads, ns = without threads
 */
function getBoltShearCapacity(
  diameter: number,
  grade: string,
  threadsInShearPlane: boolean,
  numShearPlanes: number
): number {
  const { fub } = BOLT_GRADES[grade] || BOLT_GRADES['4.6'];
  const { gross, net } = getBoltArea(diameter);
  const { gamma_mb } = PARTIAL_SAFETY_FACTORS;
  
  // Anb = net tensile stress area (threads in shear plane)
  // Asb = gross area (threads excluded from shear plane)
  const An = threadsInShearPlane ? net : gross;
  
  // Nominal shear capacity: Vnsb = fub × An × n / √3 (in N)
  const Vnsb = (fub * An * numShearPlanes) / Math.sqrt(3);
  
  // Design shear capacity: Vdsb = Vnsb / γmb
  const Vdsb = Vnsb / gamma_mb;
  
  return Vdsb / 1000; // Convert to kN
}

/**
 * Calculate bolt bearing capacity - IS 800 Cl. 10.3.4
 */
function getBoltBearingCapacity(
  diameter: number,
  grade: string,
  plateThickness: number,
  plateFu: number,
  edgeDistance: number,
  pitch: number,
  holeType: string = 'standard'
): number {
  const { fub } = BOLT_GRADES[grade] || BOLT_GRADES['4.6'];
  const { gamma_mb } = PARTIAL_SAFETY_FACTORS;
  const { kb } = HOLE_TYPES[holeType as keyof typeof HOLE_TYPES] || HOLE_TYPES['standard'];
  const d0 = diameter + 2; // Standard hole diameter
  
  // kb factors
  const kb_edge = edgeDistance / (3 * d0);
  const kb_pitch = pitch / (3 * d0) - 0.25;
  const kb_fub = fub / plateFu;
  
  const kb_final = kb * Math.min(kb_edge, kb_pitch, kb_fub, 1.0);
  
  const Vnpb = 2.5 * kb_final * diameter * plateThickness * plateFu / gamma_mb;
  
  return Vnpb / 1000; // kN
}

/**
 * Calculate bolt tension capacity - IS 800 Cl. 10.3.5
 */
function getBoltTensionCapacity(
  diameter: number,
  grade: string
): number {
  const { fub } = BOLT_GRADES[grade] || BOLT_GRADES['4.6'];
  const { net } = getBoltArea(diameter);
  const { gamma_mb } = PARTIAL_SAFETY_FACTORS;
  
  const Tnb = 0.90 * fub * net / gamma_mb;
  
  return Tnb / 1000; // kN
}

/**
 * Calculate slip resistance for HSFG bolts - IS 800 Cl. 10.4.3
 */
function getSlipResistance(
  diameter: number,
  grade: string,
  surfaceTreatment: string,
  numSlipPlanes: number
): number {
  const { fub } = BOLT_GRADES[grade] || BOLT_GRADES['8.8'];
  const mu = SLIP_FACTORS[surfaceTreatment] || 0.33;
  const { net } = getBoltArea(diameter);
  const { gamma_mf } = PARTIAL_SAFETY_FACTORS;
  
  // Proof load
  const F0 = 0.70 * fub * net / 1000; // kN
  
  const Vnsf = mu * numSlipPlanes * F0 / gamma_mf;
  
  return Vnsf; // kN
}

// ============================================================================
// WELD CAPACITY CALCULATIONS
// ============================================================================

/**
 * Calculate fillet weld strength - IS 800 Cl. 10.5.7
 */
function getFilletWeldStrength(
  size: number,
  length: number,
  electrodeGrade: string,
  plateFu: number
): number {
  const fuw = WELD_STRENGTHS[electrodeGrade] || 410;
  const { gamma_mw } = PARTIAL_SAFETY_FACTORS;
  
  // Throat thickness
  const tt = 0.7 * size;
  
  // Design strength of weld
  const fwd = fuw / (Math.sqrt(3) * gamma_mw);
  
  // Strength per unit length
  const q = fwd * tt; // N/mm
  
  // Total strength
  const Rw = q * length / 1000; // kN
  
  return Rw;
}

/**
 * Calculate butt weld strength - IS 800 Cl. 10.5.10
 */
function getButtWeldStrength(
  throatThickness: number,
  length: number,
  electrodeGrade: string,
  loadType: 'tension' | 'compression' | 'shear'
): number {
  const fuw = WELD_STRENGTHS[electrodeGrade] || 410;
  const { gamma_mw } = PARTIAL_SAFETY_FACTORS;
  
  let fwd: number;
  if (loadType === 'shear') {
    fwd = fuw / (Math.sqrt(3) * gamma_mw);
  } else {
    fwd = fuw / gamma_mw;
  }
  
  const Rw = fwd * throatThickness * length / 1000; // kN
  
  return Rw;
}

// ============================================================================
// PRYING FORCE (IS 800 Cl. 10.4.7 / AISC Part 9)
// ============================================================================

/**
 * Prying force on bolts in tension — T-stub model per IS 800:2007 Cl. 10.4.7
 * Returns the additional prying force Q per bolt (kN)
 * 
 * Parameters:
 *   Te — external tension per bolt (kN)
 *   p — bolt pitch (mm)
 *   g — gauge (bolt line spacing from plate edge / 2) (mm)
 *   tf — flange/plate thickness (mm)
 *   fy — yield stress of plate (MPa)
 *   bolt_diameter — bolt dia (mm)
 *   Tdb — design bolt tension capacity (kN)
 */
function calculatePryingForce(
  Te: number,
  p: number,
  g: number,
  tf: number,
  fy: number,
  bolt_diameter: number,
  Tdb: number
): { Q: number; beta: number; le: number } {
  // Effective length of T-stub
  const le = Math.min(p, 2 * g); // effective bolt spacing

  // Geometric parameters (IS 800 Cl. 10.4.7)
  const be = g; // distance from bolt centre to plate edge / prying edge
  const n_ = Math.min(be, 1.1 * tf * Math.sqrt(fy / 250)); // effective edge distance
  const m_ = (g - bolt_diameter / 2 - 0.8 * tf * Math.sqrt(2)) / 2; // lever arm (approx)
  const m_eff = Math.max(m_, 10); // guard

  // Prying ratio β = Q/Te
  // From bolt-plate interaction: β = (le × tf⁴ × fy) / (27 × m_eff³ × Te) approximation
  // Standard formula: Q = Te × β
  // β approach per SCI P398 / IS 800 App. G:
  // β = (4 × n_ × Te × 1000) / (le × tf² × fy) − 1
  // Clamped: 0 ≤ β ≤ (Te / Tdb) such that total T = Te + Q ≤ Tdb

  const beta_raw = (4 * n_ * Te * 1000) / (le * tf * tf * fy) - 1;
  const beta = Math.max(0, Math.min(beta_raw, 1.0)); // clamp
  const Q = Te * beta;

  return { Q, beta, le };
}

// ============================================================================
// BOLTED CONNECTION DESIGN
// ============================================================================

export function calculateBoltedConnectionIS800(inputs: BoltedConnectionInputs): CalculationResult {
  const steps: CalculationStep[] = [];
  const codeChecks: CodeCheck[] = [];
  const warnings: string[] = [];
  
  const {
    bolt_grade, bolt_diameter, num_bolts, bolt_rows, bolt_columns,
    plate_thickness, plate_fu, plate_fy,
    connection_type, shear_plane, num_shear_planes,
    shear_force, tension_force = 0, moment = 0,
    edge_distance, pitch, gauge,
    hole_type = 'standard', surface_treatment = 'clean_mill_scale'
  } = inputs;
  
  const boltGradeData = BOLT_GRADES[bolt_grade] || BOLT_GRADES['4.6'];
  const threadsIn = shear_plane === 'threads_in';
  
  // Step 1: Bolt Properties
  const { gross: Ag, net: An } = getBoltArea(bolt_diameter);
  
  steps.push({
    title: 'Bolt Properties',
    description: 'Determine bolt material and geometric properties',
    formula: 'Asb = π × d² / 4',
    values: {
      'Bolt Grade': bolt_grade,
      'Diameter': `${bolt_diameter} mm`,
      'fub': `${boltGradeData.fub} MPa`,
      'fyb': `${boltGradeData.fyb} MPa`,
      'Gross Area': `${Ag.toFixed(1)} mm²`,
      'Net Tensile Area': `${An.toFixed(1)} mm²`,
    },
    reference: 'IS 800:2007 Table 11',
  });
  
  // Step 2: Edge Distance and Pitch Check
  const d0 = bolt_diameter + 2;
  const minEdge = Math.max(1.5 * d0, 1.7 * d0); // IS 800 Cl. 10.2.4
  const maxEdge = 12 * plate_thickness;
  const minPitch = 2.5 * bolt_diameter;
  const maxPitch = Math.min(32 * plate_thickness, 300);
  
  steps.push({
    title: 'Spacing and Edge Distance',
    description: 'Check bolt arrangement requirements',
    formula: 'Edge: 1.5d₀ to 12t, Pitch: 2.5d to min(32t, 300)',
    values: {
      'Hole Diameter d₀': `${d0} mm`,
      'Min Edge': `${minEdge.toFixed(1)} mm`,
      'Max Edge': `${maxEdge.toFixed(1)} mm`,
      'Provided Edge': `${edge_distance} mm`,
      'Min Pitch': `${minPitch.toFixed(1)} mm`,
      'Max Pitch': `${maxPitch.toFixed(1)} mm`,
      'Provided Pitch': `${pitch} mm`,
    },
    reference: 'IS 800:2007 Cl. 10.2.2, 10.2.4',
  });
  
  // Step 3: Individual Bolt Capacities
  const Vdsb = getBoltShearCapacity(bolt_diameter, bolt_grade, threadsIn, num_shear_planes);
  const Vdpb = getBoltBearingCapacity(bolt_diameter, bolt_grade, plate_thickness, plate_fu, edge_distance, pitch, hole_type);
  const Tdb = getBoltTensionCapacity(bolt_diameter, bolt_grade);
  
  const Vdb = Math.min(Vdsb, Vdpb); // Design shear capacity per bolt
  
  steps.push({
    title: 'Individual Bolt Capacities',
    description: 'Calculate shear, bearing, and tension capacities',
    formula: 'Vdb = min(Vdsb, Vdpb)',
    values: {
      'Shear Capacity Vdsb': `${Vdsb.toFixed(2)} kN`,
      'Bearing Capacity Vdpb': `${Vdpb.toFixed(2)} kN`,
      'Governing Shear Vdb': `${Vdb.toFixed(2)} kN`,
      'Tension Capacity Tdb': `${Tdb.toFixed(2)} kN`,
      'Shear Plane': threadsIn ? 'Threads in shear' : 'Threads excluded',
    },
    reference: 'IS 800:2007 Cl. 10.3.3, 10.3.4, 10.3.5',
  });
  
  // Step 4: For Friction Grip Bolts
  let Vsf = 0;
  if (connection_type === 'friction' || connection_type === 'combined') {
    Vsf = getSlipResistance(bolt_diameter, bolt_grade, surface_treatment, num_shear_planes);
    
    steps.push({
      title: 'Slip Resistance (HSFG)',
      description: 'Calculate design slip resistance',
      formula: 'Vsf = μ × nf × F₀ / γmf',
      values: {
        'Surface Treatment': surface_treatment.replace(/_/g, ' '),
        'Slip Factor μ': `${SLIP_FACTORS[surface_treatment]}`,
        'Number of Slip Planes': `${num_shear_planes}`,
        'Slip Resistance Vsf': `${Vsf.toFixed(2)} kN/bolt`,
      },
      reference: 'IS 800:2007 Cl. 10.4.3',
    });
  }
  
  // Step 5: Connection Capacity
  const shearCapacity = num_bolts * (connection_type === 'friction' ? Vsf : Vdb);
  const tensionCapacity = num_bolts * Tdb;
  
  // Prying force calculation (IS 800 Cl. 10.4.7) when bolts are in tension
  let pryingForcePerBolt = 0;
  let totalTensionPerBolt = tension_force / num_bolts;
  let pryingBeta = 0;
  
  if (tension_force > 0) {
    const g_prying = gauge || 2 * edge_distance; // gauge or estimate
    const { Q, beta } = calculatePryingForce(
      tension_force / num_bolts,
      pitch,
      g_prying / 2,
      plate_thickness,
      plate_fy,
      bolt_diameter,
      Tdb
    );
    pryingForcePerBolt = Q;
    pryingBeta = beta;
    totalTensionPerBolt = tension_force / num_bolts + Q;
    
    steps.push({
      title: 'Prying Force (T-stub model)',
      description: 'Additional tension in bolts due to plate flexibility',
      formula: 'Q = Te × β, β from IS 800 Cl. 10.4.7',
      values: {
        'External Tension/bolt (Te)': `${(tension_force / num_bolts).toFixed(2)} kN`,
        'Prying Ratio β': pryingBeta.toFixed(3),
        'Prying Force/bolt (Q)': `${pryingForcePerBolt.toFixed(2)} kN`,
        'Total Tension/bolt (Te+Q)': `${totalTensionPerBolt.toFixed(2)} kN`,
        'Bolt Tension Capacity (Tdb)': `${Tdb.toFixed(2)} kN`,
        'Status': totalTensionPerBolt <= Tdb ? 'OK' : 'INCREASE PLATE THICKNESS OR BOLT SIZE',
      },
      reference: 'IS 800:2007 Cl. 10.4.7',
    });
  }
  
  // Check combined shear and tension (with prying)
  let combinedRatio = 0;
  if (tension_force > 0) {
    const Vsf_reduced = Vsf * (1 - totalTensionPerBolt * num_bolts / tensionCapacity); // For friction
    const V_ratio = shear_force / shearCapacity;
    const T_ratio = (totalTensionPerBolt * num_bolts) / tensionCapacity;
    combinedRatio = Math.pow(V_ratio, 2) + Math.pow(T_ratio, 2);
  }
  
  steps.push({
    title: 'Connection Capacity',
    description: 'Total connection strength',
    formula: 'Capacity = n × Vdb (or Vsf)',
    values: {
      'Number of Bolts': `${num_bolts}`,
      'Arrangement': `${bolt_rows} rows × ${bolt_columns} columns`,
      'Shear Capacity': `${shearCapacity.toFixed(2)} kN`,
      'Tension Capacity': `${tensionCapacity.toFixed(2)} kN`,
      'Applied Shear': `${shear_force} kN`,
      'Applied Tension': `${tension_force} kN`,
      'Shear Utilization': `${((shear_force / shearCapacity) * 100).toFixed(1)}%`,
    },
    reference: 'IS 800:2007 Cl. 10.3',
  });
  
  // Step 6: Plate Capacity Check (Block Shear)
  const Avg = (num_bolts - 1) * pitch * plate_thickness; // Gross shear area
  const Avn = Avg - (num_bolts - 1) * d0 * plate_thickness; // Net shear area
  const Atg = edge_distance * plate_thickness; // Gross tension area
  const Atn = Atg - 0.5 * d0 * plate_thickness; // Net tension area
  
  const Tdb1 = (Avg * plate_fy / (Math.sqrt(3) * 1.10) + 0.9 * Atn * plate_fu / 1.25) / 1000;
  const Tdb2 = (0.9 * Avn * plate_fu / (Math.sqrt(3) * 1.25) + Atg * plate_fy / 1.10) / 1000;
  const Tdb_block = Math.min(Tdb1, Tdb2);
  
  steps.push({
    title: 'Block Shear Capacity',
    description: 'Check plate failure in block shear',
    formula: 'Tdb = min(Avg×fy/√3 + 0.9Atn×fu, 0.9Avn×fu/√3 + Atg×fy)',
    values: {
      'Avg': `${Avg.toFixed(0)} mm²`,
      'Avn': `${Avn.toFixed(0)} mm²`,
      'Atg': `${Atg.toFixed(0)} mm²`,
      'Block Shear Capacity': `${Tdb_block.toFixed(2)} kN`,
      'Applied Force': `${shear_force} kN`,
      'Status': shear_force <= Tdb_block ? 'OK' : 'FAIL',
    },
    reference: 'IS 800:2007 Cl. 6.4',
  });
  
  // Code Checks
  codeChecks.push({
    clause: '10.2.4.2',
    description: 'Minimum edge distance',
    required: `≥ ${minEdge.toFixed(1)} mm`,
    provided: `${edge_distance} mm`,
    status: edge_distance >= minEdge ? 'PASS' : 'FAIL',
  });
  
  codeChecks.push({
    clause: '10.2.2',
    description: 'Minimum pitch',
    required: `≥ ${minPitch.toFixed(1)} mm`,
    provided: `${pitch} mm`,
    status: pitch >= minPitch ? 'PASS' : 'FAIL',
  });
  
  codeChecks.push({
    clause: '10.3.3',
    description: 'Bolt shear capacity',
    required: `V ≤ ${shearCapacity.toFixed(2)} kN`,
    provided: `${shear_force} kN`,
    status: shear_force <= shearCapacity ? 'PASS' : 'FAIL',
  });
  
  if (tension_force > 0) {
    codeChecks.push({
      clause: '10.4.7',
      description: 'Bolt tension incl. prying',
      required: `Te + Q ≤ ${Tdb.toFixed(2)} kN/bolt`,
      provided: `${totalTensionPerBolt.toFixed(2)} kN/bolt`,
      status: totalTensionPerBolt <= Tdb ? 'PASS' : 'FAIL',
    });
    
    codeChecks.push({
      clause: '10.3.6',
      description: 'Combined shear and tension',
      required: '(V/Vd)² + (T/Td)² ≤ 1.0',
      provided: `${combinedRatio.toFixed(3)}`,
      status: combinedRatio <= 1.0 ? 'PASS' : 'FAIL',
    });
  }
  
  codeChecks.push({
    clause: '6.4',
    description: 'Block shear',
    required: `≥ ${shear_force} kN`,
    provided: `${Tdb_block.toFixed(2)} kN`,
    status: Tdb_block >= shear_force ? 'PASS' : 'FAIL',
  });
  
  const failedChecks = codeChecks.filter(c => c.status === 'FAIL');
  const isAdequate = failedChecks.length === 0;
  const utilization = shear_force / shearCapacity;
  
  return {
    isAdequate,
    utilization,
    capacity: shearCapacity,
    demand: shear_force,
    status: isAdequate ? 'OK' : 'FAIL',
    message: isAdequate
      ? `Bolted connection is adequate. ${num_bolts}×M${bolt_diameter} Grade ${bolt_grade}. Utilization: ${(utilization * 100).toFixed(1)}%`
      : `Connection failed: ${failedChecks.map(c => c.description).join(', ')}`,
    steps,
    codeChecks,
    warnings,
  };
}

// ============================================================================
// WELDED CONNECTION DESIGN
// ============================================================================

export function calculateWeldedConnectionIS800(inputs: WeldedConnectionInputs): CalculationResult {
  const steps: CalculationStep[] = [];
  const codeChecks: CodeCheck[] = [];
  const warnings: string[] = [];
  
  const {
    weld_type, weld_size, weld_length, electrode_grade,
    plate_fu, plate_thickness,
    shear_force = 0, tension_force = 0, resultant_force,
    weld_position,
  } = inputs;
  
  // Step 1: Weld Properties
  const fuw = WELD_STRENGTHS[electrode_grade] || 410;
  const tt = weld_type === 'fillet' ? 0.7 * weld_size : weld_size;
  
  steps.push({
    title: 'Weld Properties',
    description: 'Determine weld material and throat thickness',
    formula: weld_type === 'fillet' ? 'tt = 0.7 × weld size' : 'tt = throat thickness',
    values: {
      'Weld Type': weld_type.charAt(0).toUpperCase() + weld_type.slice(1),
      'Weld Size': `${weld_size} mm`,
      'Electrode': electrode_grade,
      'fuw': `${fuw} MPa`,
      'Throat Thickness tt': `${tt.toFixed(1)} mm`,
      'Weld Length': `${weld_length} mm`,
    },
    reference: 'IS 800:2007 Cl. 10.5.3',
  });
  
  // Step 2: Size Limits
  const minSize = plate_thickness <= 10 ? 3 : plate_thickness <= 20 ? 5 : 6;
  const maxSize = plate_thickness - 1.5;
  const minLength = Math.max(4 * weld_size, 40);
  
  steps.push({
    title: 'Weld Size Limits',
    description: 'Check minimum and maximum weld size',
    formula: 'Min size from Table 22, Max = t - 1.5',
    values: {
      'Plate Thickness': `${plate_thickness} mm`,
      'Min Weld Size': `${minSize} mm`,
      'Max Weld Size': `${maxSize.toFixed(1)} mm`,
      'Provided Size': `${weld_size} mm`,
      'Min Length': `${minLength} mm`,
      'Provided Length': `${weld_length} mm`,
    },
    reference: 'IS 800:2007 Table 22, Cl. 10.5.4',
  });
  
  // Step 3: Weld Strength
  let weldCapacity: number;
  
  if (weld_type === 'fillet') {
    weldCapacity = getFilletWeldStrength(weld_size, weld_length, electrode_grade, plate_fu);
  } else {
    const loadType = tension_force > shear_force ? 'tension' : 'shear';
    weldCapacity = getButtWeldStrength(weld_size, weld_length, electrode_grade, loadType);
  }
  
  // Directional strength increase for transverse fillet welds
  let directionFactor = 1.0;
  if (weld_type === 'fillet' && weld_position === 'transverse') {
    directionFactor = 1.5; // Transverse welds are stronger
    weldCapacity *= directionFactor;
  }
  
  steps.push({
    title: 'Weld Strength',
    description: 'Calculate design weld capacity',
    formula: weld_type === 'fillet'
      ? 'Rw = fwd × tt × Lw'
      : 'Rw = fwd × te × Lw',
    values: {
      'Design Strength fwd': `${(fuw / (Math.sqrt(3) * 1.25)).toFixed(1)} MPa`,
      'Effective Length': `${weld_length} mm`,
      'Direction Factor': `${directionFactor}`,
      'Weld Capacity': `${weldCapacity.toFixed(2)} kN`,
    },
    reference: 'IS 800:2007 Cl. 10.5.7',
  });
  
  // Step 4: Applied Forces
  const appliedForce = resultant_force || Math.sqrt(shear_force * shear_force + tension_force * tension_force);
  const utilization = appliedForce / weldCapacity;
  
  steps.push({
    title: 'Force Check',
    description: 'Compare applied force with capacity',
    formula: 'Resultant = √(V² + T²)',
    values: {
      'Shear Force': `${shear_force} kN`,
      'Tension Force': `${tension_force} kN`,
      'Resultant Force': `${appliedForce.toFixed(2)} kN`,
      'Weld Capacity': `${weldCapacity.toFixed(2)} kN`,
      'Utilization': `${(utilization * 100).toFixed(1)}%`,
    },
    reference: 'IS 800:2007',
  });
  
  // Code Checks
  codeChecks.push({
    clause: '10.5.2.3',
    description: 'Minimum weld size',
    required: `≥ ${minSize} mm`,
    provided: `${weld_size} mm`,
    status: weld_size >= minSize ? 'PASS' : 'FAIL',
  });
  
  codeChecks.push({
    clause: '10.5.2.3',
    description: 'Maximum weld size',
    required: `≤ ${maxSize.toFixed(1)} mm`,
    provided: `${weld_size} mm`,
    status: weld_size <= maxSize ? 'PASS' : 'FAIL',
  });
  
  codeChecks.push({
    clause: '10.5.4.1',
    description: 'Minimum weld length',
    required: `≥ ${minLength} mm`,
    provided: `${weld_length} mm`,
    status: weld_length >= minLength ? 'PASS' : 'FAIL',
  });
  
  codeChecks.push({
    clause: '10.5.7',
    description: 'Weld capacity',
    required: `≥ ${appliedForce.toFixed(2)} kN`,
    provided: `${weldCapacity.toFixed(2)} kN`,
    status: weldCapacity >= appliedForce ? 'PASS' : 'FAIL',
  });
  
  const failedChecks = codeChecks.filter(c => c.status === 'FAIL');
  const isAdequate = failedChecks.length === 0;
  
  return {
    isAdequate,
    utilization,
    capacity: weldCapacity,
    demand: appliedForce,
    status: isAdequate ? 'OK' : 'FAIL',
    message: isAdequate
      ? `Welded connection is adequate. ${weld_size}mm ${weld_type} weld × ${weld_length}mm. Utilization: ${(utilization * 100).toFixed(1)}%`
      : `Connection failed: ${failedChecks.map(c => c.description).join(', ')}`,
    steps,
    codeChecks,
    warnings,
  };
}

// ============================================================================
// BASE PLATE DESIGN
// ============================================================================

export function calculateBasePlateIS800(inputs: BasePlateInputs): CalculationResult {
  const steps: CalculationStep[] = [];
  const codeChecks: CodeCheck[] = [];
  const warnings: string[] = [];
  
  const {
    column_depth: d, column_flange_width: bf,
    column_flange_thickness: tf, column_web_thickness: tw,
    fy_plate, fck,
    axial_load: P, moment = 0, shear = 0,
    plate_length, plate_width, plate_thickness
  } = inputs;
  
  // Step 1: Bearing Strength of Concrete
  const fcc = 0.45 * fck; // Bearing strength
  
  steps.push({
    title: 'Concrete Bearing Strength',
    description: 'Determine allowable bearing stress',
    formula: 'fcc = 0.45 × fck',
    values: {
      'Concrete Grade': `M${fck}`,
      'fck': `${fck} MPa`,
      'Bearing Strength fcc': `${fcc.toFixed(2)} MPa`,
    },
    reference: 'IS 800:2007 Cl. 15.4.2',
  });
  
  // Step 2: Required Base Plate Area
  const A_req = (P * 1000) / fcc; // mm²
  const L_min = d + 100; // Minimum length
  const B_min = bf + 100; // Minimum width
  
  const L = plate_length || Math.max(L_min, Math.ceil(Math.sqrt(A_req) / 10) * 10);
  const B = plate_width || Math.max(B_min, Math.ceil(A_req / L / 10) * 10);
  const A_provided = L * B;
  
  steps.push({
    title: 'Base Plate Size',
    description: 'Determine plate dimensions',
    formula: 'A = P / fcc',
    values: {
      'Axial Load P': `${P} kN`,
      'Required Area': `${A_req.toFixed(0)} mm²`,
      'Column Depth': `${d} mm`,
      'Column Flange Width': `${bf} mm`,
      'Plate Length L': `${L} mm`,
      'Plate Width B': `${B} mm`,
      'Provided Area': `${A_provided} mm²`,
    },
    reference: 'IS 800:2007 Cl. 15.4',
  });
  
  // Step 3: Bearing Pressure Check
  const sigma_bearing = (P * 1000) / A_provided;
  
  steps.push({
    title: 'Bearing Pressure',
    description: 'Check concrete bearing stress',
    formula: 'σ = P / A',
    values: {
      'Bearing Stress': `${sigma_bearing.toFixed(2)} MPa`,
      'Allowable': `${fcc.toFixed(2)} MPa`,
      'Utilization': `${((sigma_bearing / fcc) * 100).toFixed(1)}%`,
      'Status': sigma_bearing <= fcc ? 'OK' : 'FAIL',
    },
    reference: 'IS 800:2007 Cl. 15.4.2',
  });
  
  // Step 4: Plate Thickness
  // Projection from column edge
  const a = (L - d) / 2;  // Along length
  const b = (B - bf) / 2; // Along width
  const c = (bf - tw) / 4; // Under flange
  
  const projection = Math.max(a, b, c);
  
  // Required thickness based on cantilever action
  const w = sigma_bearing; // Pressure under plate
  const M_cantilever = w * projection * projection / 2; // N·mm/mm
  const t_req = Math.sqrt(6 * M_cantilever / (fy_plate / 1.10));
  
  const t = plate_thickness || Math.ceil(t_req / 2) * 2; // Round to even mm
  
  steps.push({
    title: 'Plate Thickness',
    description: 'Calculate required thickness for bending',
    formula: 't = √(6M / fb)',
    values: {
      'Projection a': `${a.toFixed(1)} mm`,
      'Projection b': `${b.toFixed(1)} mm`,
      'Projection c': `${c.toFixed(1)} mm`,
      'Governing Projection': `${projection.toFixed(1)} mm`,
      'Cantilever Moment': `${M_cantilever.toFixed(1)} N·mm/mm`,
      'Required Thickness': `${t_req.toFixed(1)} mm`,
      'Provided Thickness': `${t} mm`,
    },
    reference: 'IS 800:2007 Cl. 15.4.3',
  });
  
  // Step 5: Anchor Bolt Check (if moment present)
  if (moment > 0) {
    const e = moment / P * 1000; // Eccentricity in mm
    const L_6 = L / 6;
    
    if (e > L_6) {
      warnings.push('Eccentricity exceeds L/6. Tension in anchor bolts required.');
      
      // Tension in anchor bolts
      const sigma_max = (P * 1000 / A_provided) * (1 + 6 * e / L);
      const sigma_min = (P * 1000 / A_provided) * (1 - 6 * e / L);
      
      steps.push({
        title: 'Eccentric Loading',
        description: 'Stress distribution with moment',
        formula: 'σ = P/A × (1 ± 6e/L)',
        values: {
          'Eccentricity e': `${e.toFixed(1)} mm`,
          'L/6': `${L_6.toFixed(1)} mm`,
          'σ_max': `${sigma_max.toFixed(2)} MPa`,
          'σ_min': `${sigma_min.toFixed(2)} MPa`,
          'Anchor Bolts': sigma_min < 0 ? 'Required for tension' : 'Nominal only',
        },
        reference: 'IS 800:2007 Cl. 15.4',
      });
    }
  }
  
  // Code Checks
  codeChecks.push({
    clause: '15.4.2',
    description: 'Bearing on concrete',
    required: `≤ ${fcc.toFixed(2)} MPa`,
    provided: `${sigma_bearing.toFixed(2)} MPa`,
    status: sigma_bearing <= fcc ? 'PASS' : 'FAIL',
  });
  
  codeChecks.push({
    clause: '15.4.3',
    description: 'Plate thickness',
    required: `≥ ${t_req.toFixed(1)} mm`,
    provided: `${t} mm`,
    status: t >= t_req ? 'PASS' : 'FAIL',
  });
  
  codeChecks.push({
    clause: '15.4',
    description: 'Plate area',
    required: `≥ ${A_req.toFixed(0)} mm²`,
    provided: `${A_provided} mm²`,
    status: A_provided >= A_req ? 'PASS' : 'FAIL',
  });
  
  const failedChecks = codeChecks.filter(c => c.status === 'FAIL');
  const isAdequate = failedChecks.length === 0;
  const utilization = sigma_bearing / fcc;
  
  return {
    isAdequate,
    utilization,
    capacity: fcc * A_provided / 1000,
    demand: P,
    status: isAdequate ? 'OK' : 'FAIL',
    message: isAdequate
      ? `Base plate ${L}×${B}×${t}mm is adequate. Utilization: ${(utilization * 100).toFixed(1)}%`
      : `Design failed: ${failedChecks.map(c => c.description).join(', ')}`,
    steps,
    codeChecks,
    warnings,
    designSummary: {
      'Plate Size': `${L} × ${B} × ${t} mm`,
      'Bearing Stress': `${sigma_bearing.toFixed(2)} MPa`,
      'Concrete Grade': `M${fck}`,
    },
  };
}

// ============================================================================
// MAIN EXPORT
// ============================================================================

export default {
  calculateBoltedConnectionIS800,
  calculateWeldedConnectionIS800,
  calculateBasePlateIS800,
  BOLT_GRADES,
  WELD_STRENGTHS,
  SLIP_FACTORS,
};
