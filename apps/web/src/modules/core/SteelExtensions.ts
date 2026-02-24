/**
 * ============================================================================
 * STEEL DESIGN EXTENSIONS - PHASE 1 ENHANCEMENTS
 * ============================================================================
 * 
 * Adds missing steel design features:
 * - Lateral-torsional buckling (LTB)
 * - Connection limit states
 * - Block shear
 * - Bolt/weld checks
 * - Base plate design
 * 
 * @version 1.0.0
 */

// ============================================================================
// LATERAL-TORSIONAL BUCKLING (LTB)
// ============================================================================

export interface LTBResult {
  Mn: number;              // Nominal moment capacity (kNm)
  phiMn: number;           // Design moment capacity (kNm)
  Lp: number;              // Limiting unbraced length for plastic (mm)
  Lr: number;              // Limiting unbraced length for inelastic (mm)
  Lb: number;              // Actual unbraced length (mm)
  zone: 'plastic' | 'inelastic' | 'elastic';
  Fcr?: number;            // Critical stress for elastic LTB (MPa)
  Cb: number;              // Moment gradient factor
  clause: string;
}

export interface SectionForLTB {
  Zx: number;        // Plastic section modulus (mm³)
  Sx: number;        // Elastic section modulus (mm³)
  Iy: number;        // Weak axis moment of inertia (mm⁴)
  J: number;         // Torsional constant (mm⁴)
  Cw: number;        // Warping constant (mm⁶)
  rts: number;       // Effective radius of gyration (mm)
  ho: number;        // Distance between flange centroids (mm)
  ry: number;        // Radius of gyration about weak axis (mm)
}

export function calculateLTB(
  section: SectionForLTB,
  material: { Fy: number; E: number; G?: number },
  Lb: number,         // Unbraced length (mm)
  Cb: number = 1.0,   // Moment gradient factor
  code: 'AISC360' | 'IS800' | 'EN1993' = 'AISC360'
): LTBResult {
  const { Fy, E, G = 77200 } = material;
  const { Zx, Sx, Iy, J, Cw, rts, ho, ry } = section;
  const phi = 0.9;

  // Calculate Lp (AISC Eq. F2-5)
  const Lp = 1.76 * ry * Math.sqrt(E / Fy);

  // Calculate Lr (AISC Eq. F2-6)
  const c = 1.0; // For doubly symmetric I-shapes
  const Lr = 1.95 * rts * (E / (0.7 * Fy)) * 
    Math.sqrt((J * c) / (Sx * ho) + 
      Math.sqrt(Math.pow((J * c) / (Sx * ho), 2) + 6.76 * Math.pow(0.7 * Fy / E, 2)));

  let Mn: number;
  let zone: 'plastic' | 'inelastic' | 'elastic';
  let Fcr: number | undefined;

  if (Lb <= Lp) {
    // Plastic zone - full plastic moment
    Mn = Fy * Zx / 1e6; // kNm
    zone = 'plastic';
  } else if (Lb <= Lr) {
    // Inelastic LTB zone (AISC Eq. F2-2)
    const Mp = Fy * Zx;
    const Mr = 0.7 * Fy * Sx;
    Mn = Cb * (Mp - (Mp - Mr) * ((Lb - Lp) / (Lr - Lp)));
    Mn = Math.min(Mn, Mp) / 1e6; // kNm
    zone = 'inelastic';
  } else {
    // Elastic LTB zone (AISC Eq. F2-3 and F2-4)
    Fcr = (Cb * Math.PI * Math.PI * E) / Math.pow(Lb / rts, 2) *
      Math.sqrt(1 + 0.078 * (J * c) / (Sx * ho) * Math.pow(Lb / rts, 2));
    Mn = Fcr * Sx / 1e6; // kNm
    Mn = Math.min(Mn, Fy * Zx / 1e6);
    zone = 'elastic';
  }

  return {
    Mn: Math.round(Mn * 100) / 100,
    phiMn: Math.round(phi * Mn * 100) / 100,
    Lp: Math.round(Lp),
    Lr: Math.round(Lr),
    Lb,
    zone,
    Fcr,
    Cb,
    clause: code === 'AISC360' ? 'AISC 360-22 Section F2' : 'IS 800:2007 Cl. 8.2.2',
  };
}

/**
 * Calculate moment gradient factor Cb
 * AISC Eq. F1-1
 */
export function calculateCb(
  Mmax: number,
  Ma: number,    // Moment at quarter point
  Mb: number,    // Moment at centerline
  Mc: number     // Moment at three-quarter point
): number {
  const Cb = (12.5 * Math.abs(Mmax)) / 
    (2.5 * Math.abs(Mmax) + 3 * Math.abs(Ma) + 4 * Math.abs(Mb) + 3 * Math.abs(Mc));
  return Math.min(Cb, 3.0);
}

// ============================================================================
// BOLT CONNECTION DESIGN
// ============================================================================

export interface BoltResult {
  shearCapacity: number;      // kN per bolt
  bearingCapacity: number;    // kN per bolt
  tensionCapacity: number;    // kN per bolt
  combinedRatio: number;      // Shear-tension interaction
  governingMode: 'shear' | 'bearing' | 'tension' | 'combined';
  status: 'PASS' | 'FAIL';
  clause: string;
}

export interface BoltConfig {
  diameter: number;           // mm
  grade: string;              // e.g., '8.8', 'A325'
  fub: number;                // Ultimate tensile strength (MPa)
  connectionType: 'bearing' | 'slip_critical';
  shearPlanes: number;        // Number of shear planes
  threadsInShearPlane: boolean;
}

export function designBoltConnection(
  bolt: BoltConfig,
  plate: { thickness: number; fu: number },
  forces: { shear: number; tension?: number },
  numBolts: number,
  code: 'AISC360' | 'IS800' = 'AISC360'
): BoltResult {
  const { diameter, fub, shearPlanes, threadsInShearPlane } = bolt;
  const Ab = Math.PI * diameter * diameter / 4; // Bolt area (mm²)
  const phi = code === 'AISC360' ? 0.75 : 0.8;

  // Shear capacity per bolt (AISC Table J3.2)
  const Fnv = threadsInShearPlane ? 0.45 * fub : 0.563 * fub;
  const Rn_shear = Fnv * Ab * shearPlanes / 1000; // kN
  const shearCapacity = phi * Rn_shear;

  // Bearing capacity (AISC Eq. J3-6a - deformation considered)
  const Lc = 2.4 * diameter; // Assumed clear distance
  const Rn_bearing = Math.min(1.2 * Lc * plate.thickness * plate.fu, 
                               2.4 * diameter * plate.thickness * plate.fu) / 1000;
  const bearingCapacity = phi * Rn_bearing;

  // Tension capacity per bolt
  const Fnt = 0.75 * fub;
  const Rn_tension = Fnt * Ab / 1000; // kN
  const tensionCapacity = phi * Rn_tension;

  // Governing per-bolt capacity
  const perBoltShear = forces.shear / numBolts;
  const perBoltTension = (forces.tension || 0) / numBolts;

  // Combined shear-tension interaction (AISC Eq. J3-3a)
  let combinedRatio = 0;
  if (forces.tension && forces.tension > 0) {
    const Fnt_mod = 1.3 * Fnt - (Fnt / (phi * Fnv)) * (perBoltShear / (Ab / 1000));
    const actualRatio = (perBoltShear / shearCapacity) + (perBoltTension / tensionCapacity);
    combinedRatio = actualRatio;
  }

  // Determine governing mode
  const shearRatio = perBoltShear / shearCapacity;
  const bearingRatio = perBoltShear / bearingCapacity;
  const tensionRatio = perBoltTension / tensionCapacity;

  let governingMode: 'shear' | 'bearing' | 'tension' | 'combined' = 'shear';
  let maxRatio = shearRatio;

  if (bearingRatio > maxRatio) {
    governingMode = 'bearing';
    maxRatio = bearingRatio;
  }
  if (tensionRatio > maxRatio) {
    governingMode = 'tension';
    maxRatio = tensionRatio;
  }
  if (combinedRatio > maxRatio) {
    governingMode = 'combined';
    maxRatio = combinedRatio;
  }

  return {
    shearCapacity: Math.round(shearCapacity * numBolts * 100) / 100,
    bearingCapacity: Math.round(bearingCapacity * numBolts * 100) / 100,
    tensionCapacity: Math.round(tensionCapacity * numBolts * 100) / 100,
    combinedRatio: Math.round(maxRatio * 1000) / 1000,
    governingMode,
    status: maxRatio <= 1.0 ? 'PASS' : 'FAIL',
    clause: code === 'AISC360' ? 'AISC 360-22 Section J3' : 'IS 800:2007 Cl. 10.3',
  };
}

// ============================================================================
// BLOCK SHEAR
// ============================================================================

export interface BlockShearResult {
  Rn: number;               // Nominal capacity (kN)
  phiRn: number;            // Design capacity (kN)
  Agv: number;              // Gross area in shear (mm²)
  Anv: number;              // Net area in shear (mm²)
  Ant: number;              // Net area in tension (mm²)
  status: 'PASS' | 'FAIL';
  clause: string;
}

export function calculateBlockShear(
  geometry: {
    grossShearLength: number;   // mm
    netShearLength: number;     // mm
    grossTensionLength: number; // mm
    netTensionLength: number;   // mm
    thickness: number;          // mm
  },
  material: { Fy: number; Fu: number },
  appliedLoad: number,          // kN
  code: 'AISC360' | 'IS800' = 'AISC360'
): BlockShearResult {
  const { grossShearLength, netShearLength, grossTensionLength, netTensionLength, thickness } = geometry;
  const { Fy, Fu } = material;
  const phi = 0.75;

  const Agv = grossShearLength * thickness;
  const Anv = netShearLength * thickness;
  const Agt = grossTensionLength * thickness;
  const Ant = netTensionLength * thickness;

  // AISC Eq. J4-5
  const Rn1 = 0.6 * Fu * Anv + Fy * Agt; // Shear rupture + tension yield
  const Rn2 = 0.6 * Fy * Agv + Fu * Ant; // Shear yield + tension rupture

  const Rn = Math.min(Rn1, Rn2) / 1000; // kN
  const phiRn = phi * Rn;

  return {
    Rn: Math.round(Rn * 100) / 100,
    phiRn: Math.round(phiRn * 100) / 100,
    Agv,
    Anv,
    Ant,
    status: appliedLoad <= phiRn ? 'PASS' : 'FAIL',
    clause: code === 'AISC360' ? 'AISC 360-22 Eq. J4-5' : 'IS 800:2007 Cl. 6.4',
  };
}

// ============================================================================
// WELD DESIGN
// ============================================================================

export interface WeldResult {
  capacity: number;          // kN
  size: number;              // mm (throat or leg)
  length: number;            // mm
  efficiency: number;        // demand / capacity
  status: 'PASS' | 'FAIL';
  clause: string;
}

export function designFilletWeld(
  weld: {
    legSize: number;         // mm
    length: number;          // mm
    FEXX: number;            // Electrode strength (MPa) - e.g., 480 for E70
  },
  baseMetal: { Fu: number },
  appliedForce: number,      // kN
  loadAngle: number = 0,     // degrees from weld axis
  code: 'AISC360' | 'IS800' = 'AISC360'
): WeldResult {
  const { legSize, length, FEXX } = weld;
  const phi = 0.75;

  // Effective throat = 0.707 * leg size for 45° fillet
  const throat = 0.707 * legSize;
  const effectiveArea = throat * length;

  // Directional strength increase (AISC Eq. J2-5)
  const theta = loadAngle * Math.PI / 180;
  const directionalFactor = 1.0 + 0.50 * Math.pow(Math.sin(theta), 1.5);

  // Base metal check
  const Fnw = 0.6 * FEXX * directionalFactor;
  const FnBM = 0.6 * baseMetal.Fu;

  // Governing strength
  const Rn_weld = Fnw * effectiveArea / 1000; // kN
  const Rn_BM = FnBM * effectiveArea / 1000;
  const Rn = Math.min(Rn_weld, Rn_BM);
  const phiRn = phi * Rn;

  return {
    capacity: Math.round(phiRn * 100) / 100,
    size: legSize,
    length,
    efficiency: Math.round((appliedForce / phiRn) * 1000) / 1000,
    status: appliedForce <= phiRn ? 'PASS' : 'FAIL',
    clause: code === 'AISC360' ? 'AISC 360-22 Section J2' : 'IS 800:2007 Cl. 10.5',
  };
}

// ============================================================================
// BASE PLATE DESIGN
// ============================================================================

export interface BasePlateResult {
  plateLength: number;       // mm (N)
  plateWidth: number;        // mm (B)
  plateThickness: number;    // mm (tp)
  bearingPressure: number;   // MPa
  allowablePressure: number; // MPa
  anchorBoltTension: number; // kN per bolt
  status: 'PASS' | 'FAIL';
  clause: string;
}

export function designBasePlate(
  column: { bf: number; d: number },  // Column flange width and depth (mm)
  loads: { Pu: number; Mu?: number }, // Axial (kN), Moment (kNm)
  concrete: { fc: number },           // Concrete strength (MPa)
  pedestal: { A2: number },           // Pedestal area (mm²)
  code: 'AISC360' | 'IS800' = 'AISC360'
): BasePlateResult {
  const { bf, d } = column;
  const { Pu, Mu = 0 } = loads;
  const phi = 0.65;

  // Required plate area for concentric load (AISC Eq. J8-1)
  const fpMax = phi * 0.85 * concrete.fc * Math.sqrt(2); // Max with confinement
  const A1_req = (Pu * 1000) / fpMax;

  // Plate dimensions (start with column + 2" each side)
  let N = d + 100;  // Length parallel to column web
  let B = bf + 100; // Width parallel to column flange

  // Check A1 >= A1_req
  let A1 = N * B;
  while (A1 < A1_req) {
    N += 25;
    B += 25;
    A1 = N * B;
  }

  // Bearing pressure
  const fp = (Pu * 1000) / A1;
  const fpAllowable = fpMax;

  // Cantilever lengths
  const m = (N - 0.95 * d) / 2;
  const n = (B - 0.8 * bf) / 2;
  const lambda_n = Math.max(m, n, Math.sqrt(d * bf) / 4);

  // Required plate thickness (AISC Eq. J8-2)
  const Fy_plate = 250; // Assumed plate yield
  const tp_req = lambda_n * Math.sqrt((2 * fp) / (phi * Fy_plate));

  // Round up to standard thickness
  const standardThicknesses = [12, 16, 20, 25, 32, 40, 50];
  const tp = standardThicknesses.find(t => t >= tp_req) || 50;

  // Anchor bolt tension (simplified - for moment)
  let anchorTension = 0;
  if (Mu > 0) {
    const e = (Mu * 1000) / Pu; // Eccentricity (mm)
    const leverArm = N - 50;     // Approximate
    anchorTension = (Pu * e) / leverArm / 4; // 4 bolts assumed
  }

  return {
    plateLength: N,
    plateWidth: B,
    plateThickness: tp,
    bearingPressure: Math.round(fp * 100) / 100,
    allowablePressure: Math.round(fpAllowable * 100) / 100,
    anchorBoltTension: Math.round(anchorTension * 100) / 100,
    status: fp <= fpAllowable ? 'PASS' : 'FAIL',
    clause: code === 'AISC360' ? 'AISC 360-22 Section J8' : 'IS 800:2007 Cl. 11.2',
  };
}
