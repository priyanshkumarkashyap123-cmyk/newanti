import { postJson } from '../utils/fetchUtils';
import { API_CONFIG } from '../config/env';

export interface ModalAnalysisRequest {
  stiffness_matrix: number[];
  mass_matrix: number[];
  dimension: number;
  num_modes?: number;
  mass_type?: 'Consistent' | 'Lumped';
  normalize_modes?: boolean;
  compute_participation?: boolean;
}

export interface ModalAnalysisResponse {
  success: boolean;
  frequencies_hz: number[];
  frequencies_rad_s: number[];
  periods_s: number[];
  mode_shapes: number[][];
  modal_masses: number[];
  participation_factors?: number[];
  cumulative_participation?: number[];
  performance_ms: number;
}

export interface DampingConfig {
  type: 'none' | 'rayleigh' | 'modal';
  alpha?: number;
  beta?: number;
  ratios?: number[];
}

export interface TimeHistoryRequest {
  stiffness_matrix: number[];
  mass_matrix: number[];
  dimension: number;
  force_history: number[][];
  dt: number;
  initial_displacement?: number[] | null;
  initial_velocity?: number[] | null;
  integration_method?: 'newmark' | 'central_difference' | 'wilson';
  damping?: DampingConfig;
  output_interval?: number;
}

export interface TimeHistoryResponse {
  success: boolean;
  time: number[];
  displacement_history: number[][];
  velocity_history: number[][];
  acceleration_history: number[][];
  max_displacement: number;
  max_velocity: number;
  max_acceleration: number;
  performance_ms: number;
}

export interface SeismicAnalysisRequest {
  frequencies_rad_s: number[];
  mode_shapes: number[][];
  modal_masses: number[];
  participation_factors: number[];
  seismic_code: 'IS1893' | 'ASCE7' | 'EC8';
  zone: string;
  soil_type: string;
  importance: string;
  response_reduction: string;
  damping_ratio?: number;
  combination_method?: 'SRSS' | 'CQC' | 'ABS';
  story_heights?: number[];
  story_masses?: number[];
}

export interface StoryForceResult {
  level: number;
  height_m: number;
  lateral_force_kn: number;
  cumulative_shear_kn: number;
}

export interface SeismicAnalysisResponse {
  success: boolean;
  periods_s: number[];
  spectral_accelerations_g: number[];
  modal_displacements_m: number[];
  modal_base_shears_kn: number[];
  max_displacement_m: number;
  max_base_shear_kn: number;
  code_base_shear_kn: number;
  story_forces?: StoryForceResult[];
  combination_method: 'SRSS' | 'CQC' | 'ABS';
  performance_ms: number;
}

// ── Advanced FEM Element Input Types ──

export interface PlateElementInput {
  id: string;
  nodes: string[];          // 4 node IDs (Q4)
  thickness?: number;       // default 0.2 m
  E?: number;               // Young's modulus, default 30e6 kPa
  nu?: number;              // Poisson's ratio, default 0.2
  rho?: number;             // density kg/m³, default 2400
  formulation?: 'thick' | 'thin';  // Mindlin-Reissner or Kirchhoff
}

export interface SolidElementInput {
  id: string;
  nodes: string[];          // 8 or 20 node IDs
  E?: number;               // default 200e6 kPa
  nu?: number;              // default 0.3
  rho?: number;             // default 7850 kg/m³
  element_type?: 'hex8' | 'hex20';
  use_bbar?: boolean;       // B-bar formulation for volumetric locking
}

export interface LinkElementInput {
  id: string;
  node_i: string;
  node_j: string;
  link_type: 'gap' | 'hook' | 'friction_pendulum' | 'viscous_damper' | 'multilinear';
  direction?: number;       // 0=X, 1=Y, 2=Z
  properties?: Record<string, unknown>;
}

export interface DiaphragmInput {
  floor_z: number;
  master_node: string;
  slave_nodes: string[];
  k_membrane?: number | null;  // null = rigid
  mass?: number;
  mmoi?: number;
}

export interface FrameNodeInput {
  id: string;
  x: number;
  y: number;
  z: number;
  support?: string;  // 'fixed' | 'pinned' | 'roller' | 'none'
}

export interface FrameMemberInput {
  id: string;
  startNodeId: string;
  endNodeId: string;
  E?: number;
  G?: number;
  A?: number;
  Iy?: number;
  Iz?: number;
  J?: number;
}

export interface NodeLoadInput {
  nodeId: string;
  fx?: number;
  fy?: number;
  fz?: number;
  mx?: number;
  my?: number;
  mz?: number;
}

export interface MemberDistLoadInput {
  memberId: string;
  w1: number;
  w2?: number;
  direction?: string;
}

export interface AdvancedFEMRequest {
  nodes: FrameNodeInput[];
  members?: FrameMemberInput[];
  node_loads?: NodeLoadInput[];
  distributed_loads?: MemberDistLoadInput[];

  // Advanced element types
  plate_elements?: PlateElementInput[];
  solid_elements?: SolidElementInput[];
  link_elements?: LinkElementInput[];
  diaphragms?: DiaphragmInput[];

  // Tension/compression-only member IDs
  tension_only?: string[];
  compression_only?: string[];

  include_self_weight?: boolean;
  solver?: 'direct' | 'iterative';
}

export interface AdvancedFEMResponse {
  success: boolean;
  displacements?: Record<string, { ux: number; uy: number; uz: number; rx: number; ry: number; rz: number }>;
  reactions?: Record<string, { fx: number; fy: number; fz: number; mx: number; my: number; mz: number }>;
  member_forces?: Record<string, { axial: number; shear_y: number; shear_z: number; torsion: number; moment_y: number; moment_z: number }>;
  n_dofs?: number;
  max_displacement?: number;
  solve_time_ms?: number;
  stats?: {
    backend_used: string;
    total_ms: number;
    solve_ms: number;
  };
  error?: string;
}

export class AdvancedAnalysisService {
  private baseUrl: string;
  private analyzeUrl: string;

  constructor() {
    const base = API_CONFIG.rustUrl || API_CONFIG.baseUrl;
    this.baseUrl = `${base}/api/analysis`;
    this.analyzeUrl = `${API_CONFIG.baseUrl}/api/analyze`;
  }

  private getAuthHeaders(): Record<string, string> {
    const headers: Record<string, string> = {};
    const token = typeof window !== 'undefined'
      ? window.localStorage?.getItem('auth_token')
      : null;
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
  }

  async modalAnalysis(req: ModalAnalysisRequest): Promise<ModalAnalysisResponse> {
    return postJson<ModalAnalysisResponse>(`${this.baseUrl}/modal`, req, {
      timeout: 30000,
      headers: this.getAuthHeaders(),
    });
  }

  async timeHistoryAnalysis(req: TimeHistoryRequest): Promise<TimeHistoryResponse> {
    return postJson<TimeHistoryResponse>(`${this.baseUrl}/time-history`, req, {
      timeout: 60000,
      headers: this.getAuthHeaders(),
    });
  }

  async seismicAnalysis(req: SeismicAnalysisRequest): Promise<SeismicAnalysisResponse> {
    return postJson<SeismicAnalysisResponse>(`${this.baseUrl}/seismic`, req, {
      timeout: 30000,
      headers: this.getAuthHeaders(),
    });
  }

  /**
   * Advanced FEM analysis: plates, solids, links, diaphragms,
   * tension/compression-only members, auto-meshing.
   * Calls Python backend POST /analyze/advanced
   */
  async advancedFEMAnalysis(req: AdvancedFEMRequest): Promise<AdvancedFEMResponse> {
    return postJson<AdvancedFEMResponse>(`${this.analyzeUrl}/advanced`, req, {
      timeout: 120000,
      headers: this.getAuthHeaders(),
    });
  }
}

// =============================================================================
// PHASE 53/54 WASM-BASED ADVANCED ANALYSIS
// =============================================================================

// Types for WASM API responses
export interface SeismicDriftResult {
  success: boolean;
  code: string;
  importance_factor: number;
  all_stories_pass: boolean;
  story_results: StoryDriftCheck[];
  error?: string;
}

export interface StoryDriftCheck {
  story: number;
  height: number;
  displacement: number;
  drift_ratio: number;
  limit: number;
  passes: boolean;
}

export interface FoundationSpringsResult {
  success: boolean;
  method: string;
  foundation: {
    length_m: number;
    width_m: number;
    area_m2: number;
  };
  soil: {
    modulus_kPa: number;
    poisson_ratio: number;
    shear_modulus_kPa: number;
  };
  stiffness: {
    vertical_kN_m: number;
    horizontal_x_kN_m: number;
    horizontal_y_kN_m: number;
    rotational_x_kNm_rad: number;
    rotational_y_kNm_rad: number;
    torsional_kNm_rad: number;
  };
  error?: string;
}

export interface NotionalLoadsResult {
  success: boolean;
  method: string;
  notional_factor: number;
  first_order_drift: number;
  total_notional_load_kN: number;
  story_results: StoryNotionalLoad[];
  error?: string;
}

export interface StoryNotionalLoad {
  story: number;
  gravity_load_kN: number;
  notional_load_kN: number;
  height_m: number;
  b2_factor: number;
}

export interface VonMisesResult {
  success: boolean;
  von_mises_stress: number;
  tresca_stress: number;
  invariants: {
    I1: number;
    I2: number;
    I3: number;
  };
  hydrostatic_stress: number;
  deviatoric_stress: number;
  octahedral_shear: number;
  error?: string;
}

export interface IS13920BeamCheck {
  success: boolean;
  code: string;
  element: string;
  dimensions: {
    width_mm: number;
    depth_mm: number;
    span_mm: number;
  };
  overall_pass: boolean;
  checks: IS13920CheckItem[];
  error?: string;
}

export interface IS13920CheckItem {
  clause: string;
  check: string;
  required: string;
  provided: string;
  pass: boolean;
}

export interface PlatformInfo {
  name: string;
  version: string;
  rust_modules: number;
  test_coverage: number;
  wasm_exports: number;
  features: string[];
  codes_supported: string[];
}

// WASM module interface
interface WasmModule {
  check_seismic_drift: (heights: string, displacements: string, code: string, importance: number) => string;
  calculate_foundation_springs: (length: number, width: number, modulus: number, poisson: number) => string;
  calculate_notional_loads: (gravity: string, heights: string, drift: number) => string;
  calculate_von_mises: (sxx: number, syy: number, szz: number, txy: number, tyz: number, txz: number) => string;
  check_is13920_beam_ductility: (w: number, d: number, span: number, top: number, bot: number, stirDia: number, stirSpacing: number, fck: number, fy: number) => string;
  get_platform_info: () => string;
}

let wasmModule: WasmModule | null = null;
let wasmReady = false;
let initPromise: Promise<boolean> | null = null;

/**
 * Initialize WASM module for advanced analysis
 */
export async function initWasmAnalysis(): Promise<boolean> {
  if (wasmReady) return true;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      const response = await fetch('/solver_wasm_bg.wasm');
      if (!response.ok) throw new Error(`WASM fetch failed: ${response.status}`);
      
      const wasmBytes = await response.arrayBuffer();
      const wasm = await import('../libs/solver_wasm');
      await wasm.default(wasmBytes);
      
      wasmModule = wasm as unknown as WasmModule;
      wasmReady = true;
      console.log('[AdvancedAnalysis] WASM initialized successfully');
      return true;
    } catch (error) {
      console.error('[AdvancedAnalysis] WASM initialization failed:', error);
      return false;
    }
  })();

  return initPromise;
}

/**
 * Check seismic story drift per ASCE 7-22, IS 1893:2016, or Eurocode 8
 */
export async function checkSeismicDrift(
  storyHeights: number[],
  storyDisplacements: number[],
  code: 'ASCE7' | 'IS1893' | 'EC8' = 'ASCE7',
  importanceFactor: number = 1.0
): Promise<SeismicDriftResult> {
  await initWasmAnalysis();
  
  if (!wasmModule) {
    return { success: false, error: 'WASM not available' } as SeismicDriftResult;
  }

  try {
    const result = wasmModule.check_seismic_drift(
      JSON.stringify(storyHeights),
      JSON.stringify(storyDisplacements),
      code,
      importanceFactor
    );
    return JSON.parse(result);
  } catch (error) {
    return { success: false, error: String(error) } as SeismicDriftResult;
  }
}

/**
 * Calculate foundation spring stiffnesses using Gazetas method
 */
export async function calculateFoundationSprings(
  length: number,
  width: number,
  soilModulusKpa: number,
  poissonRatio: number = 0.3
): Promise<FoundationSpringsResult> {
  await initWasmAnalysis();
  
  if (!wasmModule) {
    return { success: false, error: 'WASM not available' } as FoundationSpringsResult;
  }

  try {
    const result = wasmModule.calculate_foundation_springs(
      length, width, soilModulusKpa, poissonRatio
    );
    return JSON.parse(result);
  } catch (error) {
    return { success: false, error: String(error) } as FoundationSpringsResult;
  }
}

/**
 * Calculate AISC 360-22 Direct Analysis Method notional loads
 */
export async function calculateNotionalLoads(
  storyGravityLoads: number[],
  storyHeights: number[],
  firstOrderDriftRatio: number = 0.01
): Promise<NotionalLoadsResult> {
  await initWasmAnalysis();
  
  if (!wasmModule) {
    return { success: false, error: 'WASM not available' } as NotionalLoadsResult;
  }

  try {
    const result = wasmModule.calculate_notional_loads(
      JSON.stringify(storyGravityLoads),
      JSON.stringify(storyHeights),
      firstOrderDriftRatio
    );
    return JSON.parse(result);
  } catch (error) {
    return { success: false, error: String(error) } as NotionalLoadsResult;
  }
}

/**
 * Calculate von Mises stress from full 3D stress tensor
 */
export async function calculateVonMises(
  sigmaXX: number,
  sigmaYY: number,
  sigmaZZ: number,
  tauXY: number = 0,
  tauYZ: number = 0,
  tauXZ: number = 0
): Promise<VonMisesResult> {
  await initWasmAnalysis();
  
  if (!wasmModule) {
    return { success: false, error: 'WASM not available' } as VonMisesResult;
  }

  try {
    const result = wasmModule.calculate_von_mises(
      sigmaXX, sigmaYY, sigmaZZ, tauXY, tauYZ, tauXZ
    );
    return JSON.parse(result);
  } catch (error) {
    return { success: false, error: String(error) } as VonMisesResult;
  }
}

/**
 * Check IS 13920:2016 ductile detailing requirements for beams
 */
export async function checkIS13920BeamDuctility(
  widthMm: number,
  depthMm: number,
  clearSpanMm: number,
  topSteelMm2: number,
  bottomSteelMm2: number,
  stirrupDiaMm: number,
  stirrupSpacingMm: number,
  fckMpa: number = 25,
  fyMpa: number = 415
): Promise<IS13920BeamCheck> {
  await initWasmAnalysis();
  
  if (!wasmModule) {
    return { success: false, error: 'WASM not available' } as IS13920BeamCheck;
  }

  try {
    const result = wasmModule.check_is13920_beam_ductility(
      widthMm, depthMm, clearSpanMm,
      topSteelMm2, bottomSteelMm2,
      stirrupDiaMm, stirrupSpacingMm,
      fckMpa, fyMpa
    );
    return JSON.parse(result);
  } catch (error) {
    return { success: false, error: String(error) } as IS13920BeamCheck;
  }
}

/**
 * Get platform capabilities and version info
 */
export async function getPlatformInfo(): Promise<PlatformInfo | null> {
  await initWasmAnalysis();
  
  if (!wasmModule) return null;

  try {
    const result = wasmModule.get_platform_info();
    return JSON.parse(result);
  } catch {
    return null;
  }
}

// Export convenience object for WASM-based analysis
export const WasmAnalysis = {
  init: initWasmAnalysis,
  checkSeismicDrift,
  calculateFoundationSprings,
  calculateNotionalLoads,
  calculateVonMises,
  checkIS13920BeamDuctility,
  getPlatformInfo,
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  RIGOROUS SOLVER MECHANICS — Rust-backed endpoints
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// ── 1. Staged Construction Analysis ──

export interface StageDefinition {
  stage_id: string;
  label: string;
  activate_elements: string[];
  remove_elements?: string[];
  loads?: Record<string, number>;
  boundary_changes?: Record<string, string>;
  duration_days?: number;
  concrete_age_days?: number;
}

export interface ConcreteTimeConfig {
  fc28: number;
  ec28: number;
  cement_type?: number;
  creep_ultimate?: number;
  shrinkage_ultimate?: number;
  humidity?: number;
  vs_ratio?: number;
}

export interface StagedConstructionRequest {
  nodes: { id: string; x: number; y: number; z: number; [k: string]: unknown }[];
  members: { id: string; start_node_id: string; end_node_id: string; [k: string]: unknown }[];
  supports?: unknown[];
  loads?: unknown[];
  stages: StageDefinition[];
  concrete_config?: ConcreteTimeConfig;
  time_dependent?: boolean;
}

export interface StageResultData {
  stage_id: string;
  label: string;
  active_elements: number;
  displacements: { node_id: string; dx: number; dy: number; dz: number }[];
  max_displacement_mm: number;
  cumulative_displacements: { node_id: string; dx: number; dy: number; dz: number }[];
  max_cumulative_mm: number;
  concrete_strength_mpa?: number;
  concrete_modulus_mpa?: number;
  creep_coefficient?: number;
  shrinkage_strain?: number;
}

export interface StagedConstructionResponse {
  success: boolean;
  num_stages: number;
  stage_results: StageResultData[];
  final_displacements: { node_id: string; dx: number; dy: number; dz: number }[];
  max_final_displacement_mm: number;
  performance_ms: number;
}

export async function runStagedConstruction(
  req: StagedConstructionRequest,
): Promise<StagedConstructionResponse> {
  return postJson(`${API_CONFIG.rustUrl}/api/advanced/staged-construction`, req);
}

// ── 2. Direct Analysis Method (DAM) — AISC 360 ──

export interface DAMLevel {
  height: number;
  gravity_load: number;
}

export interface DAMMember {
  member_id: string;
  length: number;
  e: number;
  i: number;
  a: number;
  fy: number;
  pr: number;
  k: number;
  cm: number;
  sway?: boolean;
}

export interface DAMRequest {
  nodes: { id: string; x: number; y: number; z: number; [k: string]: unknown }[];
  members: { id: string; start_node_id: string; end_node_id: string; [k: string]: unknown }[];
  supports?: unknown[];
  loads?: unknown[];
  levels: DAMLevel[];
  dam_members: DAMMember[];
  alpha?: number;
  run_pdelta?: boolean;
  pdelta_tolerance?: number;
  pdelta_max_iter?: number;
}

export interface DAMResponse {
  success: boolean;
  notional_loads: { level_index: number; height: number; gravity_yi: number; notional_ni: number }[];
  member_results: { member_id: string; tau_b: number; ei_star: number; b1: number; b2: number; capacity_check: string }[];
  load_cases: { name: string; gravity_factor: number; notional_direction: string; description: string }[];
  pdelta_converged?: boolean;
  pdelta_iterations?: number;
  b2_max: number;
  dam_applicable: boolean;
  dam_requirements_met: boolean;
  performance_ms: number;
}

export async function runDAM(req: DAMRequest): Promise<DAMResponse> {
  return postJson(`${API_CONFIG.rustUrl}/api/advanced/dam`, req);
}

// ── 3. Newton-Raphson / Arc-Length Nonlinear Solve ──

export type NonlinearMethod =
  | 'newton_raphson'
  | 'modified_newton_raphson'
  | 'arc_length'
  | 'displacement_control';

export interface NonlinearSolveRequest {
  nodes: { id: string; x: number; y: number; z: number; [k: string]: unknown }[];
  members: { id: string; start_node_id: string; end_node_id: string; [k: string]: unknown }[];
  supports?: unknown[];
  loads?: unknown[];
  method?: NonlinearMethod;
  load_steps?: number;
  target_load_factor?: number;
  force_tolerance?: number;
  displacement_tolerance?: number;
  max_iterations?: number;
  line_search?: boolean;
  line_search_tolerance?: number;
  initial_arc_length?: number;
  geometric_nonlinearity?: boolean;
  control_dof?: number;
  control_increment?: number;
}

export interface LoadStepResult {
  step: number;
  load_factor: number;
  iterations: number;
  converged: boolean;
  force_residual: number;
  displacement_norm: number;
  max_displacement: { node_id: string; dx: number; dy: number; dz: number };
}

export interface NonlinearSolveResponse {
  success: boolean;
  method: string;
  total_steps_completed: number;
  fully_converged: boolean;
  final_load_factor: number;
  step_results: LoadStepResult[];
  load_displacement_curve: { load_factor: number; displacement: number }[];
  final_displacements: { node_id: string; dx: number; dy: number; dz: number }[];
  performance_ms: number;
}

export async function runNonlinearSolve(
  req: NonlinearSolveRequest,
): Promise<NonlinearSolveResponse> {
  return postJson(`${API_CONFIG.rustUrl}/api/advanced/nonlinear`, req);
}

// ── 4. Mass Source Definition ──

export interface MassContribution {
  case_id: string;
  factor: number;
}

export interface NodalGravityLoad {
  node_id: string;
  force_kn: number;
}

export interface MassSourceRequest {
  contributions: MassContribution[];
  load_cases: Record<string, NodalGravityLoad[]>;
  include_self_weight?: boolean;
  self_weight_factor?: number;
  element_masses?: Record<string, number>;
  additional_masses?: Record<string, number>;
  mass_type?: 'lumped' | 'consistent';
  gravity?: number;
  dofs_per_node?: number;
  code_preset?: 'is1893' | 'asce7' | 'eurocode8';
  ll_fraction?: number;
}

export interface MassSourceResponse {
  success: boolean;
  mass_diagonal: number[];
  nodal_masses: Record<string, number>;
  total_mass_kg: number;
  total_weight_kn: number;
  contributions: { case_id: string; factor: number; total_weight_kn: number; total_mass_kg: number }[];
  mass_type: string;
  performance_ms: number;
}

export async function buildMassSource(
  req: MassSourceRequest,
): Promise<MassSourceResponse> {
  return postJson(`${API_CONFIG.rustUrl}/api/advanced/mass-source`, req);
}

// ============================================================================
// Dynamic & Advanced Loading Engines
// ============================================================================

// ── 5. Wind Tunnel / CFD Pressure Profile ──

export interface WindTunnelTap {
  tap_id: string;
  x: number;
  y: number;
  z: number;
  face: string;
  tributary_area: number;
  normal: [number, number, number];
}

export interface CpTimeSeries {
  wind_direction_deg: number;
  q_ref: number;
  sampling_rate: number;
  cp_values: number[];
}

export interface TapToNodeMapping {
  tap_id: string;
  node_id: string;
  tributary_area: number;
  normal: [number, number, number];
}

export interface WindTunnelRequest {
  building_id: string;
  geometric_scale: number;
  velocity_scale: number;
  reference_height?: number;
  taps: WindTunnelTap[];
  cp_data: Record<string, CpTimeSeries[]>;
  mappings: TapToNodeMapping[];
  q_design: number;
  peak_factor?: number;
  compute_psd?: boolean;
}

export interface CpStats {
  tap_id: string;
  wind_direction_deg: number;
  mean: number;
  rms: number;
  peak_positive: number;
  peak_negative: number;
  std_dev: number;
}

export interface NodalForce {
  node_id: string;
  fx_kn: number;
  fy_kn: number;
  fz_kn: number;
}

export interface DirectionScan {
  critical_direction_deg: number;
  max_base_shear_x_kn: number;
  max_base_shear_y_kn: number;
  max_overturning_moment_knm: number;
  n_directions: number;
}

export interface WindTunnelResponse {
  success: boolean;
  statistics: CpStats[];
  equivalent_static_loads: NodalForce[];
  force_timesteps: number;
  direction_scan: DirectionScan | null;
  performance_ms: number;
}

export async function runWindTunnel(
  req: WindTunnelRequest,
): Promise<WindTunnelResponse> {
  return postJson(`${API_CONFIG.rustUrl}/api/advanced/wind-tunnel`, req);
}

// ── 6. Influence Surface (2-D Bridge Deck) ──

export interface InfluenceSurfaceRequest {
  span: number;
  width: number;
  thickness: number;
  elastic_modulus?: number;
  poisson_ratio?: number;
  output_x: number;
  output_y: number;
  grid_nx?: number;
  grid_ny?: number;
  scan_step_x?: number;
  scan_step_y?: number;
  vehicles: string[];
  response_type?: 'deflection' | 'moment_mx' | 'moment_my';
}

export interface VehicleScanResult {
  vehicle_label: string;
  max_response: number;
  min_response: number;
  impact_factor: number;
  critical_x: number;
  critical_y: number;
  n_positions_evaluated: number;
}

export interface InfluenceSurfaceResponse {
  success: boolean;
  span: number;
  width: number;
  scan_results: VehicleScanResult[];
  governing_max_response: number;
  governing_min_response: number;
  governing_vehicle: string;
  performance_ms: number;
}

export async function runInfluenceSurface(
  req: InfluenceSurfaceRequest,
): Promise<InfluenceSurfaceResponse> {
  return postJson(
    `${API_CONFIG.rustUrl}/api/advanced/influence-surface`,
    req,
  );
}

// ── 7. Enhanced Spectrum Directional Combination ──

export type CombinationMethod = 'SRSS' | 'CQC' | 'ABS' | 'CQC_GROUPED';
export type DirectionalRule = 'single' | '100_30' | '100_30_30' | 'srss';

export interface DirectionalSpectrumInput {
  direction: string;
  spectrum_ordinates: [number, number][];
  scale_factor?: number;
}

export interface ModalPropertiesInput {
  n_modes: number;
  periods: number[];
  damping_ratios: number[];
  participation_factors: [number, number, number][];
  effective_masses: [number, number, number][];
  mode_shapes: number[][];
  total_weight: number;
  n_dofs: number;
}

export interface IS1893Params {
  zone_factor: number;
  importance_factor: number;
  response_reduction: number;
  soil_type?: 'I' | 'II' | 'III';
}

export interface ASCE7Params {
  sds: number;
  sd1: number;
  tl: number;
}

export interface SpectrumDirectionalRequest {
  combination_method?: CombinationMethod;
  directional_rule?: DirectionalRule;
  spectra: DirectionalSpectrumInput[];
  modal: ModalPropertiesInput;
  closely_spaced_threshold?: number;
  missing_mass_correction?: boolean;
  code?: 'is1893' | 'asce7' | 'ec8';
  is1893_params?: IS1893Params;
  asce7_params?: ASCE7Params;
}

export interface CloselySpacedPair {
  mode_i: number;
  mode_j: number;
  freq_i_hz: number;
  freq_j_hz: number;
  ratio: number;
}

export interface NodeDisplacementResult {
  node_id: number;
  disp_x: number;
  disp_y: number;
  disp_z: number;
  disp_magnitude: number;
}

export interface ModalSummary {
  mode: number;
  period_s: number;
  frequency_hz: number;
  effective_mass_x: number;
  effective_mass_y: number;
  sa_x: number;
  sa_y: number;
  is_closely_spaced: boolean;
}

export interface SpectrumDirectionalResponse {
  success: boolean;
  combination_method: string;
  directional_rule: string;
  modes_used: number;
  closely_spaced_pairs: CloselySpacedPair[];
  missing_mass_fractions: [number, number, number];
  node_results: NodeDisplacementResult[];
  base_shear_per_direction: number[];
  combined_base_shear: number;
  modal_summary: ModalSummary[];
  performance_ms: number;
}

export async function runSpectrumDirectional(
  req: SpectrumDirectionalRequest,
): Promise<SpectrumDirectionalResponse> {
  return postJson(
    `${API_CONFIG.rustUrl}/api/advanced/spectrum-directional`,
    req,
  );
}

// Re-export convenience bundles
export const RigorousSolvers = {
  runStagedConstruction,
  runDAM,
  runNonlinearSolve,
  buildMassSource,
};

export const DynamicLoadingEngines = {
  runWindTunnel,
  runInfluenceSurface,
  runSpectrumDirectional,
};