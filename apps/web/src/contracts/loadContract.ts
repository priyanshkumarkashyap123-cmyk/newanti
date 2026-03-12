/**
 * contracts/loadContract.ts — Canonical load vector array contract.
 *
 * Defines all structural load primitives, load case/combination schemas,
 * seismic/wind profile types, and the FEF translator payload that bridges
 * frontend load definitions to solver fixed-end-force vectors.
 *
 * This is the single source of truth for how loads flow from the UI
 * through the Node API into the Rust/Python solvers.
 */

// ─── Load Direction ─────────────────────────────────────────────────────────

export type LoadDirection =
  | 'local_x' | 'local_y' | 'local_z'
  | 'global_x' | 'global_y' | 'global_z';

// ─── Canonical Load Primitives ──────────────────────────────────────────────

/** Nodal force/moment at a specific node */
export interface NodalLoadPrimitive {
  kind: 'nodal';
  nodeId: string;
  fx_kN: number;
  fy_kN: number;
  fz_kN: number;
  mx_kNm: number;
  my_kNm: number;
  mz_kNm: number;
}

/** Uniform distributed load (full or partial span) */
export interface UDLPrimitive {
  kind: 'udl';
  memberId: string;
  w_kN_m: number;        // Intensity (positive = in load direction)
  direction: LoadDirection;
  startRatio: number;     // 0–1 along member
  endRatio: number;       // 0–1 along member
  isProjected: boolean;   // For inclined members: project load onto horizontal
}

/** Uniformly varying load (trapezoidal / triangular) */
export interface UVLPrimitive {
  kind: 'uvl';
  memberId: string;
  w1_kN_m: number;       // Intensity at start
  w2_kN_m: number;       // Intensity at end
  direction: LoadDirection;
  startRatio: number;
  endRatio: number;
  isProjected: boolean;
}

/** Point load on a member at a specified position */
export interface PointLoadPrimitive {
  kind: 'point';
  memberId: string;
  P_kN: number;
  positionRatio: number;  // 0–1 along member
  direction: LoadDirection;
}

/** Concentrated moment on a member */
export interface MomentLoadPrimitive {
  kind: 'moment';
  memberId: string;
  M_kNm: number;
  positionRatio: number;
  aboutAxis: 'x' | 'y' | 'z'; // Local axis
}

/** Floor / area load — distributed to beams at analysis time via yield-line */
export interface FloorLoadPrimitive {
  kind: 'floor';
  pressure_kN_m2: number;
  yLevel_m: number;
  bounds: { xMin: number; xMax: number; zMin: number; zMax: number };
  distribution: 'auto' | 'one_way' | 'two_way_triangular' | 'two_way_trapezoidal';
}

/** Temperature load on a member */
export interface TemperatureLoadPrimitive {
  kind: 'temperature';
  memberId: string;
  deltaT_C: number;               // Uniform temperature change
  gradientT_C?: number;           // Gradient across section depth
  alpha_per_C: number;            // Coefficient of thermal expansion
  sectionDepth_m?: number;        // Required when gradientT is specified
}

/** Settlement / prescribed displacement at a support node */
export interface SettlementLoadPrimitive {
  kind: 'settlement';
  nodeId: string;
  dx_m?: number;
  dy_m?: number;
  dz_m?: number;
  rx_rad?: number;
  ry_rad?: number;
  rz_rad?: number;
}

/** Prestress load — parabolic cable in a member */
export interface PrestressLoadPrimitive {
  kind: 'prestress';
  memberId: string;
  P_kN: number;                  // Prestress force
  eStart_m: number;              // Eccentricity at start (from centroid, +ve below NA)
  eMid_m: number;                // Eccentricity at mid-span
  eEnd_m: number;                // Eccentricity at end
}

/** Self-weight generation directive */
export interface SelfWeightDirective {
  kind: 'self_weight';
  direction: 'global_y';          // Always gravity = −Y
  factor: number;                  // Typically 1.0
  excludeMemberIds?: string[];     // Members to exclude from self-weight
}

/** Union of all canonical load primitives */
export type LoadPrimitive =
  | NodalLoadPrimitive
  | UDLPrimitive
  | UVLPrimitive
  | PointLoadPrimitive
  | MomentLoadPrimitive
  | FloorLoadPrimitive
  | TemperatureLoadPrimitive
  | SettlementLoadPrimitive
  | PrestressLoadPrimitive
  | SelfWeightDirective;

// ─── Load Case ──────────────────────────────────────────────────────────────

export type LoadCaseCategory =
  | 'dead' | 'live' | 'wind' | 'seismic' | 'snow'
  | 'temperature' | 'settlement' | 'prestress' | 'self_weight'
  | 'pattern' | 'construction' | 'custom';

export interface CanonicalLoadCase {
  id: string;
  name: string;
  category: LoadCaseCategory;
  primitives: LoadPrimitive[];
}

// ─── Load Combination ───────────────────────────────────────────────────────

export type CombinationMethod = 'algebraic' | 'srss' | 'cqc' | 'abs_sum';

export interface CanonicalLoadCombination {
  id: string;
  name: string;
  code: string;                // 'IS 875:5', 'ASCE 7-22', 'EN 1990', 'custom'
  method: CombinationMethod;   // How results are combined (algebraic for static, SRSS/CQC for modal)
  factors: Array<{
    loadCaseId: string;
    factor: number;
  }>;
  isServiceability: boolean;
}

// ─── IS 875 Part 5 / IS 1893 Standard Load Combinations ────────────────────

/**
 * IS 875 Part 5 + IS 1893 standard load combinations.
 * Wind and seismic never appear simultaneously per IS 1893 Cl. 6.3.2.
 */
export const IS_STANDARD_COMBINATIONS: Omit<CanonicalLoadCombination, 'factors'>[] = [
  { id: 'LC1',  name: '1.5(DL + LL)',      code: 'IS 875:5', method: 'algebraic', isServiceability: false },
  { id: 'LC2',  name: '1.5(DL + WL)',      code: 'IS 875:5', method: 'algebraic', isServiceability: false },
  { id: 'LC3',  name: '1.2(DL + LL + WL)', code: 'IS 875:5', method: 'algebraic', isServiceability: false },
  { id: 'LC4',  name: '1.5(DL + EQ)',      code: 'IS 1893',  method: 'algebraic', isServiceability: false },
  { id: 'LC5',  name: '1.2(DL + LL + EQ)', code: 'IS 1893',  method: 'algebraic', isServiceability: false },
  { id: 'LC6',  name: '0.9DL + 1.5WL',    code: 'IS 875:5', method: 'algebraic', isServiceability: false },
  { id: 'LC7',  name: '0.9DL + 1.5EQ',    code: 'IS 1893',  method: 'algebraic', isServiceability: false },
  { id: 'SVC1', name: 'DL + LL',           code: 'IS 875:5', method: 'algebraic', isServiceability: true },
  { id: 'SVC2', name: 'DL + 0.8LL',       code: 'IS 875:5', method: 'algebraic', isServiceability: true },
];

/**
 * Validate that a combination does not mix wind and seismic.
 * Returns true if valid, false if it violates IS 1893 Cl. 6.3.2.
 */
export function validateWindSeismicExclusion(
  combo: CanonicalLoadCombination,
  loadCases: CanonicalLoadCase[],
): boolean {
  const caseMap = new Map(loadCases.map((lc) => [lc.id, lc.category]));
  const categories = combo.factors.map((f) => caseMap.get(f.loadCaseId));
  const hasWind = categories.includes('wind');
  const hasSeismic = categories.includes('seismic');
  return !(hasWind && hasSeismic);
}

// ─── Seismic Profile ────────────────────────────────────────────────────────

export type SeismicZone = 'II' | 'III' | 'IV' | 'V';
export type SoilType = 'hard' | 'medium' | 'soft';
export type BuildingType = 'rc_frame' | 'steel_frame' | 'masonry' | 'infill';

export interface SeismicProfile {
  code: 'IS_1893' | 'ASCE_7' | 'EC8';
  zone: SeismicZone;
  soilType: SoilType;
  importanceFactor: number;     // I
  responseReduction: number;    // R
  buildingHeight_m: number;
  buildingType: BuildingType;
  baseDimension_m?: number;     // d — for infill/masonry period formula
  /** Per-storey weight/height for vertical distribution */
  storyWeights: Array<{
    storyId: string;
    height_m: number;           // Height from base
    weight_kN: number;          // Seismic weight at this storey
  }>;
}

/** IS 1893 zone factor lookup (Cl. 6.3.1, Table 2) */
export const IS1893_ZONE_FACTOR: Record<SeismicZone, number> = {
  'II': 0.10,
  'III': 0.16,
  'IV': 0.24,
  'V': 0.36,
};

// ─── Wind Profile ───────────────────────────────────────────────────────────

export interface WindProfile {
  code: 'IS_875_3' | 'ASCE_7' | 'EC1';
  basicWindSpeed_m_s: number;   // Vb (m/s)
  terrainCategory: 1 | 2 | 3 | 4;
  buildingClass: 'A' | 'B' | 'C';
  topography: 'flat' | 'hill' | 'ridge' | 'cliff';
  riskCoefficient: number;      // k1 per IS 875:3 Table 1
  /** Height-wise design wind pressure (computed or user-override) */
  heightPressures: Array<{
    height_m: number;
    pressure_kN_m2: number;
  }>;
}

// ─── Fixed-End-Force Translation Payload ────────────────────────────────────

/**
 * After the load translator converts all member loads into fixed-end-force
 * vectors, this is the payload shape sent to the solver core.
 *
 * Each entry maps a member to its 12-element FEF vector in local coordinates:
 *   [Fx_s, Fy_s, Fz_s, Mx_s, My_s, Mz_s, Fx_e, Fy_e, Fz_e, Mx_e, My_e, Mz_e]
 *
 * The solver subtracts these from global forces before assembly:
 *   F_member = K_local × U_local − FEF_local
 */
export interface FEFTranslationPayload {
  /** Member-level fixed-end-forces in LOCAL coordinates */
  memberFEFs: Record<string, [
    number, number, number, number, number, number,  // start node
    number, number, number, number, number, number,  // end node
  ]>;
  /** Equivalent joint loads in GLOBAL coordinates (for solver right-hand side) */
  equivalentJointLoads: Record<string, [number, number, number, number, number, number]>;
}

// ─── Barrel Export ───────────────────────────────────────────────────────────
// Self-contained — no barrel needed; consumers import directly.
