import { postJson } from '../utils/fetchUtils';

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
    const rustApi = (import.meta as any).env?.VITE_RUST_API_URL;
    const apiUrl = (import.meta as any).env?.VITE_API_URL;
    const base = rustApi || apiUrl || 'http://localhost:8000';
    this.baseUrl = `${base}/api/analysis`;
  }

  async modalAnalysis(req: ModalAnalysisRequest): Promise<ModalAnalysisResponse> {
    const result = await postJson<ModalAnalysisResponse>(`${this.baseUrl}/modal`, req, {
      timeout: 30000 // 30 seconds for modal analysis
    });
    
    if (!result.success) {
      throw new Error(`Modal analysis failed: ${result.error || 'Unknown error'}`);
    }
    return result.data!;
  }

  async timeHistoryAnalysis(req: TimeHistoryRequest): Promise<TimeHistoryResponse> {
    const result = await postJson<TimeHistoryResponse>(`${this.baseUrl}/time-history`, req, {
      timeout: 60000 // 60 seconds for time-history
    });
    
    if (!result.success) {
      throw new Error(`Time-history analysis failed: ${result.error || 'Unknown error'}`);
    }
    return result.data!;
  }

  async seismicAnalysis(req: SeismicAnalysisRequest): Promise<SeismicAnalysisResponse> {
    const result = await postJson<SeismicAnalysisResponse>(`${this.baseUrl}/seismic`, req, {
      timeout: 30000 // 30 seconds for seismic
    });
    
    if (!result.success) {
      throw new Error(`Seismic analysis failed: ${result.error || 'Unknown error'}`);
    }
    return result.data!;
  }
}
