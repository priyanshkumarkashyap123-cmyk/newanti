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

export class AdvancedAnalysisService {
  private baseUrl: string;

  constructor() {
    const base = API_CONFIG.rustUrl || API_CONFIG.baseUrl;
    this.baseUrl = `${base}/api/analysis`;
  }

  async modalAnalysis(req: ModalAnalysisRequest): Promise<ModalAnalysisResponse> {
    return postJson<ModalAnalysisResponse>(`${this.baseUrl}/modal`, req, {
      timeout: 30000 // 30 seconds for modal analysis
    });
  }

  async timeHistoryAnalysis(req: TimeHistoryRequest): Promise<TimeHistoryResponse> {
    return postJson<TimeHistoryResponse>(`${this.baseUrl}/time-history`, req, {
      timeout: 60000 // 60 seconds for time-history
    });
  }

  async seismicAnalysis(req: SeismicAnalysisRequest): Promise<SeismicAnalysisResponse> {
    return postJson<SeismicAnalysisResponse>(`${this.baseUrl}/seismic`, req, {
      timeout: 30000 // 30 seconds for seismic
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
