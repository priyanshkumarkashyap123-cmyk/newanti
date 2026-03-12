/**
 * ============================================================================
 * LAYOUT OPTIMIZATION API SERVICE (v2)
 * ============================================================================
 *
 * Connects the frontend Space Planning page to the production-grade
 * Python backend CSP solver with 10 constraint domains:
 *
 *   1. Site boundary & FSI compliance
 *   2. Wet-wall clustering (plumbing)
 *   3. BSP room partitioning
 *   4. Anthropometric limits (clearances, door swing, min widths)
 *   5. Structural grid snap
 *   6. Circulation pathfinding (corridor ratio)
 *   7. Span limit enforcement
 *   8. Staircase matrix (riser/tread compliance)
 *   9. Solar / fenestration scoring
 *  10. Egress life-safety analysis
 *
 * Maps WizardConfig → LayoutV2Request → POST /api/layout/v2/optimize
 * Maps LayoutV2Response → ConstraintReport + PlacementResult[]
 *
 * @version 2.0.0
 */

import { ApiClient } from '../../lib/api/client';
import { API_CONFIG } from '../../config/env';
import type { WizardConfig } from '../../components/space-planning/RoomConfigWizard';
import type { RoomSpec, RoomType, SiteConstraints } from './types';

// ============================================================================
// API CLIENT (uses Node API gateway URL)
// ============================================================================

const layoutApiClient = new ApiClient({
  baseUrl: API_CONFIG.baseUrl,
  timeout: 60000, // Layout solving can take time for complex plans
  retries: 2,
  retryDelay: 2000,
  cache: false, // Each solve is unique
});

// ============================================================================
// REQUEST TYPES — Match backend Pydantic models exactly
// ============================================================================

export interface SetbacksRequest {
  front: number;
  rear: number;
  left: number;
  right: number;
}

export interface SiteRequest {
  dimensions_m: [number, number];
  fsi_limit: number;
  setbacks_m: SetbacksRequest;
  north_angle_deg: number;
  latitude_deg?: number;
  num_floors?: number;
  polygon_vertices?: [number, number][];
}

export interface GlobalConstraintsRequest {
  max_unsupported_span_m: number;
  min_ceiling_height_m: number;
  structural_grid_module_m: number;
  max_riser_height_m: number;
  min_tread_depth_m: number;
  floor_to_floor_height_m: number;
  max_circulation_ratio: number;
  max_egress_distance_m: number;
  min_fenestration_ratio: number;
}

/** Maps frontend RoomType → backend solver room type */
type SolverRoomType = 'habitable' | 'utility' | 'wet' | 'circulation' | 'staircase';

/** Maps frontend acoustic zone hint */
type SolverAcousticZone = 'active' | 'passive' | 'service' | 'buffer';

export interface RoomNodeRequest {
  id: string;
  name: string;
  type: SolverRoomType;
  acoustic_zone?: SolverAcousticZone;
  target_area_sqm: number;
  min_width_m: number;
  max_aspect_ratio: number;
  min_aspect_ratio: number;
  requires_exterior_wall: boolean;
  plumbing_required: boolean;
  priority: number;
  is_entry: boolean;
  num_doors: number;
}

export interface AdjacencyMatrixEntry {
  node_a: string;
  node_b: string;
  weight: number;
}

export interface PenaltyWeightsRequest {
  area_deviation?: number;
  min_width_violation?: number;
  aspect_ratio_violation?: number;
  adjacency_violation?: number;
  exterior_wall_violation?: number;
  overlap_collision?: number;
  fsi_violation?: number;
  plumbing_cluster_penalty?: number;
  acoustic_zone_violation?: number;
  clearance_violation?: number;
  grid_snap_deviation?: number;
  circulation_excess?: number;
  span_violation?: number;
  beam_headroom_violation?: number;
  solar_thermal_penalty?: number;
  fenestration_violation?: number;
  egress_distance_violation?: number;
}

export interface SAParamsRequest {
  enabled: boolean;
  initial_temp?: number;
  cooling_rate?: number;
  min_temp?: number;
  max_iterations?: number;
  stagnation_limit?: number;
}

export interface LayoutV2Request {
  site: SiteRequest;
  global_constraints?: GlobalConstraintsRequest;
  nodes: RoomNodeRequest[];
  adjacency_matrix: AdjacencyMatrixEntry[];
  penalty_weights?: PenaltyWeightsRequest;
  max_iterations: number;
  random_seed?: number;
  sa_params?: SAParamsRequest;
}

function buildDeterministicSeed(config: WizardConfig): number {
  const basis = {
    plot: {
      width: config.plot.width,
      depth: config.plot.depth,
      area: config.plot.area,
      shape: config.plot.shape,
      unit: config.plot.unit,
    },
    orientation: {
      northDirection: config.orientation.northDirection,
      plotFacing: config.orientation.plotFacing,
      mainEntryDirection: config.orientation.mainEntryDirection,
      roadSide: [...config.orientation.roadSide].sort(),
    },
    constraints: {
      maxFloors: config.constraints.maxFloors,
      farAllowed: config.constraints.farAllowed,
      buildingType: config.constraints.buildingType,
    },
    rooms: config.roomSpecs
      .map((r) => ({
        type: r.type,
        floor: r.floor,
        minArea: r.minArea,
        preferredArea: r.preferredArea,
        priority: r.priority,
      }))
      .sort((a, b) => `${a.type}-${a.floor}`.localeCompare(`${b.type}-${b.floor}`)),
  };

  const text = JSON.stringify(basis);
  let hash = 2166136261 >>> 0; // FNV-1a 32-bit offset
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  // Keep positive int for backend random seed handling
  return (hash >>> 1) || 1;
}

// ============================================================================
// VARIANT GENERATION REQUEST/RESPONSE TYPES (NEW)
// ============================================================================

export interface VariantScoreResponse {
  variant_id: string;
  strategy_name: string;
  strategy_description: string;
  composite_score: number;
  compactness: number;
  zone_coherence: number;
  adjacency_satisfaction: number;
  circulation_efficiency: number;
  usable_area_ratio: number;
}

export interface VariantResponse {
  variant_id: string;
  strategy_key: string;
  strategy_name: string;
  strategy_description: string;
  score: VariantScoreResponse | null;
  placements: PlacementResponse[];
  penalty_weights_used: Record<string, number>;
  /** Clause-traceable compliance items from the per-variant solver run. */
  compliance_items?: ComplianceItemApi[];
}

export interface LayoutVariantsRequest extends LayoutV2Request {
  max_iterations_per_variant?: number;
  strategies_to_generate?: string[];
}

export interface LayoutVariantsResponse {
  success: boolean;
  total_variants_generated: number;
  variants: VariantResponse[];
  best_variant_id: string | null;
  recommendation: string;
  generated_at_ms: number;
}

// ============================================================================
// RESPONSE TYPES — Match backend Pydantic response exactly
// ============================================================================

export interface PlacementResponse {
  room_id: string;
  name: string;
  type: string;
  acoustic_zone: string | null;
  target_area_sqm: number;
  actual_area_sqm: number;
  area_deviation_pct: number;
  position: { x: number; y: number };
  dimensions: { width: number; height: number };
  aspect_ratio: number;
  min_dimension_m: number;
  width_valid: boolean;
  aspect_ratio_valid: boolean;
  plumbing_required: boolean;
  requires_exterior_wall: boolean;
}

export interface FSIAnalysis {
  status?: 'coming_soon';
  message?: string;
  plot_area_sqm: number;
  fsi_limit: number;
  max_allowed_sqm: number;
  total_placed_sqm: number;
  fsi_used: number;
  fsi_compliant: boolean;
}

export interface CirculationReport {
  status?: 'coming_soon';
  message?: string;
  total_area_sqm: number;
  circulation_area_sqm: number;
  circulation_ratio: number;
  max_ratio: number;
  compliant: boolean;
}

export interface EgressReport {
  status?: 'coming_soon';
  message?: string;
  max_travel_distance_m: number;
  limit_m: number;
  compliant: boolean;
  rooms_beyond_limit: string[];
}

export interface StructuralCheck {
  room_id: string;
  span_m: number;
  max_span_m: number;
  compliant: boolean;
}

export interface SolarScore {
  room_id: string;
  solar_score: number;
  direction: string;
}

export interface FenestrationCheck {
  room_id: string;
  wall_area_sqm: number;
  window_area_sqm: number;
  ratio: number;
  min_ratio: number;
  compliant: boolean;
}

export interface UsableBoundary {
  x: number;
  y: number;
  width: number;
  height: number;
  area_sqm: number;
}

export interface StaircaseReport {
  width_m: number;
  length_m: number;
  num_risers: number;
  riser_height_m: number;
  tread_depth_m: number;
  compliant: boolean;
}

export interface ConstraintsDetail {
  fsi: boolean;
  overlap: boolean;
  min_width: boolean;
  aspect_ratio: boolean;
  exterior_wall: boolean;
  plumbing_cluster: boolean;
  acoustic_zones: boolean;
  clearance: boolean;
  grid_snap: boolean;
  circulation: boolean;
  span_limits: boolean;
  staircase: boolean;
  fenestration: boolean;
  egress: boolean;
  solar: boolean;
  [key: string]: boolean;
}

export interface TravelDistances {
  entry_xy: [number, number];
  distances_m: Record<string, number>;
  corridor_ratio: number;
  max_travel_m: number;
}

export interface AcousticBufferReport {
  buffer_id: string;
  between: [string, string];
  width_m: number;
  area_sqm: number;
}

export interface StructuralGridReport {
  columns: { x: number; y: number }[];
  x_grid_lines: number[];
  y_grid_lines: number[];
  beams: {
    id: string;
    start: [number, number];
    end: [number, number];
    span_m: number;
    direction: 'X' | 'Y';
    needs_deep_beam: boolean;
  }[];
  span_warnings: {
    room_id: string;
    max_span_m: number;
    limit_m: number;
    action: string;
  }[];
  grid_module_m: number;
  total_columns: number;
  total_beams: number;
}

export interface SAConvergenceReport {
  initial_penalty: number | null;
  final_penalty: number;
  improvement_pct: number;
  total_iterations: number;
  final_temperature: number;
}

// ============================================================================
// SPACE-SYNTAX, STRUCTURAL HANDOFF & MEP DATA (Phase C/G)
// ============================================================================

export interface SpaceSyntaxNode {
  room_id: string;
  room_type: string;
  acoustic_zone: string | null;
  connectivity: number;
  depth: number;
  integration: number;
  control_value: number;
}

export interface SpaceSyntaxEdge {
  source: string;
  target: string;
  weight: number;
  is_required_adjacency: boolean;
}

export interface SpaceSyntaxData {
  nodes: SpaceSyntaxNode[];
  edges: SpaceSyntaxEdge[];
  mean_depth: number;
  max_depth: number;
  integration_mean: number;
  integration_variance: number;
  is_planar: boolean;
  depth_histogram: Record<string, number>;
  visibility_penalties: { room_id: string; penalty: number; reason: string }[];
  circulation_depth_rooms: string[];
}

export interface WallSegmentData {
  type: 'vertical' | 'horizontal';
  x?: number;
  y?: number;
  x_start?: number;
  x_end?: number;
  y_start?: number;
  y_end?: number;
  length_m: number;
  rooms: string[];
  load_bearing: boolean;
}

export interface StructuralHandoffData {
  wall_segments: WallSegmentData[];
  total_shared_walls: number;
  cantilever_rooms: {
    room_id: string;
    max_overhang_m: number;
    direction: string;
    action: string;
  }[];
  slab_panels: {
    room_id: string;
    lx_m: number;
    ly_m: number;
    ly_lx_ratio: number;
    slab_type: 'one_way' | 'two_way';
  }[];
  grid_module_m: number;
}

export interface MEPScheduleData {
  plumbing: {
    wet_rooms: { room_id: string; room_type: string; needs_floor_drain: boolean; needs_water_supply: boolean }[];
    plumbing_stacks: string[][];
    total_stacks: number;
  };
  electrical: {
    power_schedule: { room_id: string; room_type: string; estimated_power_points: number; estimated_lighting_points: number }[];
    total_power_points: number;
    total_lighting_points: number;
  };
  hvac: {
    room_loads: { room_id: string; room_type: string; area_sqm: number; estimated_tonnage_tr: number }[];
    total_tonnage_tr: number;
    recommended_system: 'split' | 'centralised';
  };
}

export interface LayoutV2Response {
  success: boolean;
  total_penalty: number;
  iteration_found: number;
  total_iterations: number;
  constraints_met_ratio: number;
  fsi_analysis: FSIAnalysis;
  usable_boundary: UsableBoundary;
  staircase: StaircaseReport | null;
  circulation: CirculationReport;
  egress: EgressReport;
  structural_checks: StructuralCheck[];
  solar_scores: SolarScore[];
  fenestration_checks: FenestrationCheck[];
  anthropometric_issues: string[];
  constraints_detail: ConstraintsDetail;
  placements: PlacementResponse[];
  /** Clause-traceable compliance items (replaces legacy boolean constraints_detail). */
  compliance_items?: ComplianceItemApi[];
  travel_distances?: TravelDistances;
  acoustic_buffers?: AcousticBufferReport[];
  structural_grid?: StructuralGridReport;
  sa_convergence?: SAConvergenceReport;
  /** Space-syntax graph analysis: integration, depth, planarity */
  space_syntax?: SpaceSyntaxData | null;
  /** Structural engineering handoff: wall stacking, cantilevers, slab panels */
  structural_handoff?: StructuralHandoffData | null;
  /** MEP schedule: plumbing stacks, electrical circuits, HVAC loads */
  mep_schedule?: MEPScheduleData | null;
}

export interface MinimalAutoOptimizeRequest {
  site: SiteRequest;
  global_constraints?: GlobalConstraintsRequest;
  main_entry_direction?: string;
  road_sides?: string[];
  bedroom_preference?: number;
  include_study?: boolean;
  include_guest_room?: boolean;
  include_parking?: boolean;
  max_iterations?: number;
  random_seed?: number;
}

// ============================================================================
// CONSTRAINT REPORT — Architect-friendly summary for UI
// ============================================================================

export type ConstraintDomain =
  | 'fsi'
  | 'overlap'
  | 'min_width'
  | 'aspect_ratio'
  | 'exterior_wall'
  | 'plumbing_cluster'
  | 'acoustic_zones'
  | 'clearance'
  | 'grid_snap'
  | 'circulation'
  | 'span_limits'
  | 'staircase'
  | 'fenestration'
  | 'egress'
  | 'solar';

/** Clause-traceable compliance item returned by the backend compliance engine. */
export interface ComplianceItemApi {
  domain: string;
  label: string;
  passed: boolean;
  severity: 'critical' | 'warning' | 'info';
  clause: string;
  measured_value: number | null;
  limit_value: number | null;
  units: string;
  affected_rooms: string[];
  remediation: string;
  evidence_level: 'hard_code_rule' | 'engineering_heuristic';
}

export interface ConstraintViolation {
  domain: ConstraintDomain;
  label: string;
  passed: boolean;
  severity: 'critical' | 'warning' | 'info';
  message: string;
  roomIds?: string[];
  value?: number;
  limit?: number;
  /** NBC/IS code clause reference, e.g. "NBC 2016 Cl. 4.9" */
  clause?: string;
  /** Actionable fix recommendation */
  remediation?: string;
  /** Whether the check is a mandatory code rule or engineering best practice */
  evidenceLevel?: 'hard_code_rule' | 'engineering_heuristic';
}

export interface ConstraintReport {
  score: number; // 0-100
  totalPenalty: number;
  constraintsMet: number;
  constraintsTotal: number;
  constraintsMetRatio: number;
  iterationFound: number;
  totalIterations: number;
  violations: ConstraintViolation[];
  fsi: FSIAnalysis;
  circulation: CirculationReport;
  egress: EgressReport;
  structuralChecks: StructuralCheck[];
  solarScores: SolarScore[];
  fenestrationChecks: FenestrationCheck[];
  anthropometricIssues: string[];
  staircaseReport: StaircaseReport | null;
  constraintsDetail: ConstraintsDetail;
  travelDistances?: TravelDistances;
  acousticBuffers?: AcousticBufferReport[];
  structuralGrid?: StructuralGridReport;
  saConvergence?: SAConvergenceReport;
  spaceSyntax?: SpaceSyntaxData;
  structuralHandoff?: StructuralHandoffData;
  mepSchedule?: MEPScheduleData;
}

/** Full result of a single solver candidate */
export interface SolverCandidate {
  id: string;
  label: string;
  placements: PlacementResponse[];
  report: ConstraintReport;
  usableBoundary: UsableBoundary;
  timestamp: number;
}

/** Multi-candidate result for comparison UI */
export interface MultiCandidateResult {
  candidates: SolverCandidate[];
  bestCandidateId: string;
  config: WizardConfig;
}

/** Solver backend health status returned to UI for diagnostics */
export interface SolverBackendHealth {
  ok: boolean;
  status: number;
  message: string;
  url: string;
  details?: unknown;
}

// ============================================================================
// ROOM TYPE MAPPING — Frontend RoomType → Backend SolverRoomType
// ============================================================================

const ROOM_TYPE_MAP: Record<RoomType, SolverRoomType> = {
  living: 'habitable',
  dining: 'habitable',
  kitchen: 'habitable',
  master_bedroom: 'habitable',
  bedroom: 'habitable',
  bathroom: 'wet',
  toilet: 'wet',
  pooja: 'habitable',
  study: 'habitable',
  home_office: 'habitable',
  store: 'utility',
  utility: 'utility',
  laundry: 'wet',
  garage: 'utility',
  parking: 'utility',
  balcony: 'habitable',
  terrace: 'habitable',
  corridor: 'circulation',
  staircase: 'staircase',
  lift: 'circulation',
  entrance_lobby: 'circulation',
  drawing_room: 'habitable',
  guest_room: 'habitable',
  servants_quarter: 'habitable',
  pantry: 'wet',
  gym: 'habitable',
  home_theater: 'habitable',
  swimming_pool: 'wet',
  garden: 'habitable',
  sit_out: 'habitable',
  verandah: 'habitable',
  foyer: 'circulation',
  walk_in_closet: 'utility',
  dressing: 'habitable',
  childrens_room: 'habitable',
  library: 'habitable',
  workshop: 'utility',
  basement: 'utility',
  mechanical_room: 'utility',
  electrical_panel: 'utility',
  water_tank_room: 'wet',
};

/** Map frontend acoustic context from room type */
const ACOUSTIC_MAP: Partial<Record<RoomType, SolverAcousticZone>> = {
  master_bedroom: 'passive',
  bedroom: 'passive',
  childrens_room: 'passive',
  guest_room: 'passive',
  study: 'passive',
  library: 'passive',
  living: 'active',
  dining: 'active',
  kitchen: 'active',
  home_theater: 'passive',
  gym: 'active',
  bathroom: 'service',
  toilet: 'service',
  laundry: 'service',
  utility: 'service',
  store: 'service',
  mechanical_room: 'service',
  electrical_panel: 'service',
  water_tank_room: 'service',
  corridor: 'buffer',
  staircase: 'buffer',
  entrance_lobby: 'buffer',
  foyer: 'buffer',
  lift: 'buffer',
};

/** Rooms that need plumbing */
const PLUMBING_ROOMS: Set<RoomType> = new Set([
  'bathroom',
  'toilet',
  'kitchen',
  'laundry',
  'pantry',
  'swimming_pool',
  'water_tank_room',
]);

/** Rooms that require exterior wall access (windows, ventilation) */
const EXTERIOR_WALL_ROOMS: Set<RoomType> = new Set([
  'living',
  'dining',
  'kitchen',
  'master_bedroom',
  'bedroom',
  'childrens_room',
  'guest_room',
  'study',
  'home_office',
  'drawing_room',
  'library',
  'gym',
  'pooja',
]);

/** Frontend priority string → solver integer priority (1=highest) */
const PRIORITY_MAP: Record<string, number> = {
  essential: 1,
  important: 2,
  desirable: 3,
  optional: 4,
};

// ============================================================================
// ADJACENCY RULE ENGINE — Generate structured adjacency matrix
// ============================================================================

interface AdjacencyRule {
  from: RoomType[];
  to: RoomType[];
  weight: number; // positive = place close, negative = separate
  reason: string;
}

/** Architect-grade adjacency rules based on Indian residential standards */
const ADJACENCY_RULES: AdjacencyRule[] = [
  // Functional clustering
  { from: ['kitchen'], to: ['dining'], weight: 10, reason: 'Service flow' },
  { from: ['dining'], to: ['living'], weight: 8, reason: 'Social zone continuity' },
  { from: ['kitchen'], to: ['pantry'], weight: 9, reason: 'Storage adjacency' },
  { from: ['kitchen'], to: ['utility', 'laundry'], weight: 7, reason: 'Service zone' },
  { from: ['master_bedroom'], to: ['bathroom', 'walk_in_closet', 'dressing'], weight: 9, reason: 'En-suite grouping' },
  { from: ['bedroom', 'childrens_room', 'guest_room'], to: ['bathroom', 'toilet'], weight: 6, reason: 'Bathroom access' },
  { from: ['entrance_lobby', 'foyer'], to: ['living', 'drawing_room'], weight: 8, reason: 'Entry-to-social flow' },
  { from: ['pooja'], to: ['kitchen', 'living'], weight: 5, reason: 'Traditional placement' },
  { from: ['servants_quarter'], to: ['kitchen', 'utility'], weight: 7, reason: 'Service access' },

  // Wet-wall clustering (plumbing economy)
  { from: ['kitchen'], to: ['bathroom', 'toilet', 'laundry'], weight: 5, reason: 'Wet-wall clustering' },
  { from: ['bathroom'], to: ['toilet', 'laundry'], weight: 6, reason: 'Shared drain stacks' },

  // Separation rules (negative weight = keep apart)
  { from: ['master_bedroom', 'bedroom', 'childrens_room'], to: ['kitchen', 'utility', 'mechanical_room'], weight: -5, reason: 'Noise separation' },
  { from: ['bedroom', 'master_bedroom'], to: ['gym'], weight: -4, reason: 'Noise isolation' },
  { from: ['pooja'], to: ['toilet', 'bathroom'], weight: -6, reason: 'Cultural separation' },
  { from: ['living', 'drawing_room'], to: ['servants_quarter', 'mechanical_room'], weight: -3, reason: 'Privacy zones' },
  { from: ['home_theater'], to: ['kitchen', 'utility', 'mechanical_room'], weight: -7, reason: 'Acoustic isolation' },
  { from: ['study', 'library', 'home_office'], to: ['kitchen', 'utility', 'gym'], weight: -4, reason: 'Quiet zone' },
];

/**
 * Build adjacency matrix from room specs using architectural rules.
 * Only emits entries for room pairs that actually exist in the spec list.
 */
function buildAdjacencyMatrix(roomSpecs: RoomSpec[]): AdjacencyMatrixEntry[] {
  const entries: AdjacencyMatrixEntry[] = [];
  const seen = new Set<string>();

  for (const rule of ADJACENCY_RULES) {
    for (const spec of roomSpecs) {
      if (!rule.from.includes(spec.type)) continue;

      for (const targetSpec of roomSpecs) {
        if (spec.id === targetSpec.id) continue;
        if (!rule.to.includes(targetSpec.type)) continue;

        const key = [spec.id, targetSpec.id].sort().join('|');
        if (seen.has(key)) continue;
        seen.add(key);

        entries.push({
          node_a: spec.id,
          node_b: targetSpec.id,
          weight: rule.weight,
        });
      }
    }
  }

  // Also respect user-defined adjacentTo / awayFrom from RoomSpec
  for (const spec of roomSpecs) {
    if (spec.adjacentTo) {
      for (const adjType of spec.adjacentTo) {
        const targets = roomSpecs.filter((s) => s.type === adjType && s.id !== spec.id);
        for (const target of targets) {
          const key = [spec.id, target.id].sort().join('|');
          if (!seen.has(key)) {
            seen.add(key);
            entries.push({ node_a: spec.id, node_b: target.id, weight: 8 });
          }
        }
      }
    }

    if (spec.awayFrom) {
      for (const awayType of spec.awayFrom) {
        const targets = roomSpecs.filter((s) => s.type === awayType && s.id !== spec.id);
        for (const target of targets) {
          const key = [spec.id, target.id].sort().join('|');
          if (!seen.has(key)) {
            seen.add(key);
            entries.push({ node_a: spec.id, node_b: target.id, weight: -6 });
          }
        }
      }
    }
  }

  return entries;
}

// ============================================================================
// CONFIG MAPPING — WizardConfig → LayoutV2Request
// ============================================================================

/**
 * Convert frontend WizardConfig + SiteConstraints → LayoutV2Request (backend schema).
 *
 * This is the critical bridge between the wizard UI and the CSP solver.
 * It translates:
 *   - Plot dimensions → site.dimensions_m
 *   - Setbacks → site.setbacks_m
 *   - FAR → site.fsi_limit
 *   - Orientation → site.north_angle_deg
 *   - RoomSpec[] → nodes[]
 *   - Adjacency/avoidance rules → adjacency_matrix[]
 *   - SiteConstraints → global_constraints
 */
export function wizardConfigToRequest(
  config: WizardConfig,
  options?: {
    maxIterations?: number;
    randomSeed?: number;
    penaltyWeights?: PenaltyWeightsRequest;
  },
): LayoutV2Request {
  const { plot, orientation, constraints, roomSpecs } = config;

  // Convert plot units if in feet
  const widthM = plot.unit === 'feet' ? plot.width * 0.3048 : plot.width;
  const depthM = plot.unit === 'feet' ? plot.depth * 0.3048 : plot.depth;

  // Build site configuration
  const site: SiteRequest = {
    dimensions_m: [widthM, depthM],
    fsi_limit: constraints.farAllowed || 1.5,
    setbacks_m: {
      front: constraints.setbacks.front,
      rear: constraints.setbacks.rear,
      left: constraints.setbacks.left,
      right: constraints.setbacks.right,
    },
    north_angle_deg: orientation.northDirection || 0,
    num_floors: constraints.maxFloors || 1,
  };

  // Build global constraints from site + engineering defaults
  const globalConstraints: GlobalConstraintsRequest = {
    max_unsupported_span_m: 5.0,
    min_ceiling_height_m: constraints.maxHeight
      ? Math.min(constraints.maxHeight / Math.max(constraints.maxFloors, 1), 4.0)
      : 3.0,
    structural_grid_module_m: 0.5,
    max_riser_height_m: 0.19, // NBC India
    min_tread_depth_m: 0.25,
    floor_to_floor_height_m: constraints.maxHeight
      ? constraints.maxHeight / Math.max(constraints.maxFloors, 1)
      : 3.0,
    max_circulation_ratio: 0.15,
    max_egress_distance_m: constraints.buildingType === 'commercial' ? 30.0 : 22.0,
    min_fenestration_ratio: 0.10,
  };

  // Build room nodes (flatten quantity > 1 into separate nodes)
  const nodes: RoomNodeRequest[] = [];
  for (const spec of roomSpecs) {
    const qty = spec.quantity || 1;
    for (let i = 0; i < qty; i++) {
      const suffix = qty > 1 ? `_${i + 1}` : '';
      const nodeId = `${spec.id}${suffix}`;

      nodes.push({
        id: nodeId,
        name: `${spec.name}${suffix ? ` ${i + 1}` : ''}`,
        type: ROOM_TYPE_MAP[spec.type] || 'habitable',
        acoustic_zone: ACOUSTIC_MAP[spec.type],
        target_area_sqm: spec.preferredArea || spec.minArea || 12,
        min_width_m: spec.minWidth || 2.8,
        max_aspect_ratio: 2.0, // Reasonable default
        min_aspect_ratio: 1.0,
        requires_exterior_wall: EXTERIOR_WALL_ROOMS.has(spec.type) || spec.requiresWindow || false,
        plumbing_required: PLUMBING_ROOMS.has(spec.type),
        priority: PRIORITY_MAP[spec.priority] || 2,
        is_entry: spec.type === 'entrance_lobby' || spec.type === 'foyer',
        num_doors: spec.type === 'entrance_lobby' ? 2 : 1,
      });
    }
  }

  // Build adjacency matrix
  const adjacencyMatrix = buildAdjacencyMatrix(roomSpecs);

  // Remap adjacency IDs to expanded node IDs
  const nodeIds = new Set(nodes.map((n) => n.id));
  const validAdjacency = adjacencyMatrix.filter(
    (e) => nodeIds.has(e.node_a) && nodeIds.has(e.node_b),
  );

  return {
    site,
    global_constraints: globalConstraints,
    nodes,
    adjacency_matrix: validAdjacency,
    penalty_weights: options?.penaltyWeights,
    max_iterations: options?.maxIterations || 300,
    random_seed: options?.randomSeed ?? buildDeterministicSeed(config),
  };
}

// ============================================================================
// RESPONSE MAPPING — LayoutV2Response → ConstraintReport
// ============================================================================

const DOMAIN_LABELS: Record<ConstraintDomain, string> = {
  fsi: 'FSI / FAR Compliance',
  overlap: 'Room Overlap',
  min_width: 'Minimum Width',
  aspect_ratio: 'Aspect Ratio',
  exterior_wall: 'Exterior Wall Access',
  plumbing_cluster: 'Wet-Wall Clustering',
  acoustic_zones: 'Acoustic Zoning',
  clearance: 'Anthropometric Clearances',
  grid_snap: 'Structural Grid Snap',
  circulation: 'Circulation Ratio',
  span_limits: 'Span Limits',
  staircase: 'Staircase Compliance',
  fenestration: 'Fenestration Ratio',
  egress: 'Egress Distance',
  solar: 'Solar Orientation',
};

const DOMAIN_SEVERITY: Record<ConstraintDomain, 'critical' | 'warning' | 'info'> = {
  fsi: 'critical',
  overlap: 'critical',
  egress: 'critical',
  span_limits: 'critical',
  min_width: 'warning',
  aspect_ratio: 'warning',
  exterior_wall: 'warning',
  plumbing_cluster: 'warning',
  clearance: 'warning',
  fenestration: 'warning',
  staircase: 'warning',
  circulation: 'warning',
  acoustic_zones: 'info',
  grid_snap: 'info',
  solar: 'info',
};

/**
 * Transform the raw backend response into an architect-friendly constraint report.
 *
 * When the backend provides `compliance_items` (new compliance engine), those are
 * used directly for rich clause-traceable display. The legacy `constraints_detail`
 * boolean dict is used as a fallback for older API versions.
 */
export function buildConstraintReport(response: LayoutV2Response): ConstraintReport {
  const violations: ConstraintViolation[] = [];

  if (response.compliance_items && response.compliance_items.length > 0) {
    // ── New compliance engine path: use structured clause-traceable items ──
    let met = 0;
    const total = response.compliance_items.length;

    for (const item of response.compliance_items) {
      if (item.passed) met++;

      // Build a human message from measured/limit values when available
      let message = item.remediation || (item.passed ? `${item.label} — PASS` : `${item.label} — FAIL`);
      if (!item.passed && item.measured_value != null && item.limit_value != null) {
        message = `${item.label}: ${item.measured_value.toFixed(2)} ${item.units} (limit ${item.limit_value.toFixed(2)} ${item.units}). ${item.remediation}`;
      }

      violations.push({
        domain: item.domain as ConstraintDomain,
        label: item.label,
        passed: item.passed,
        severity: item.passed ? 'info' : item.severity,
        message,
        roomIds: item.affected_rooms.length > 0 ? item.affected_rooms : undefined,
        value: item.measured_value ?? undefined,
        limit: item.limit_value ?? undefined,
        clause: item.clause,
        remediation: item.remediation || undefined,
        evidenceLevel: item.evidence_level,
      });
    }

    // Sort: critical failures first, then warnings, then passed
    const severityOrder = { critical: 0, warning: 1, info: 2 };
    violations.sort((a, b) => {
      if (a.passed !== b.passed) return a.passed ? 1 : -1;
      return severityOrder[a.severity] - severityOrder[b.severity];
    });

    // Augment with travel distance, acoustic buffers, and structural grid extras
    if (response.travel_distances) {
      const td = response.travel_distances;
      const travelPass = td.max_travel_m <= 22.0;
      violations.push({
        domain: 'travel_distance' as ConstraintDomain,
        label: 'A* Pathfinding Travel Distance',
        passed: travelPass,
        severity: travelPass ? 'info' : 'warning',
        message: travelPass
          ? `Max travel ${td.max_travel_m.toFixed(1)} m (A*) — within 22 m egress limit; corridor ratio ${(td.corridor_ratio * 100).toFixed(1)}%`
          : `Max travel ${td.max_travel_m.toFixed(1)} m exceeds 22 m NBC egress limit (A* pathfinding)`,
        value: td.max_travel_m,
        limit: 22.0,
        clause: 'NBC 2016 Cl. 5.3 (A* graph search)',
        remediation: travelPass ? undefined : 'Add escape staircase closer to furthest rooms or redesign connectivity.',
      });
    }

    if (response.acoustic_buffers && response.acoustic_buffers.length > 0) {
      violations.push({
        domain: 'acoustic_buffers' as ConstraintDomain,
        label: 'Acoustic Buffer Zones',
        passed: true,
        severity: 'info',
        message: `${response.acoustic_buffers.length} acoustic buffer(s) auto-inserted between conflicting active/passive zones`,
        clause: 'NBC 2016 Part 8 Cl. 4',
      });
    }

    if (response.structural_grid) {
      const sg = response.structural_grid;
      const hasWarnings = sg.span_warnings.length > 0;
      violations.push({
        domain: 'structural_grid' as ConstraintDomain,
        label: 'Structural Grid Layout',
        passed: !hasWarnings,
        severity: hasWarnings ? 'warning' : 'info',
        message: hasWarnings
          ? `${sg.total_columns} columns, ${sg.total_beams} beams — ${sg.span_warnings.length} span warning(s)`
          : `${sg.total_columns} columns, ${sg.total_beams} beams on ${sg.grid_module_m} m module`,
        clause: 'IS 456:2000 Cl. 5.3 / IS 800:2007',
        remediation: hasWarnings ? sg.span_warnings.map((w) => `${w.room_id}: span ${w.max_span_m}m — ${w.action}`).join('; ') : undefined,
      });
    }

    // ── Space-syntax graph analysis (Phase C) ──
    if (response.space_syntax) {
      const ss = response.space_syntax;
      // Planarity check
      violations.push({
        domain: 'space_syntax' as ConstraintDomain,
        label: 'Layout Planarity (Graph Theory)',
        passed: ss.is_planar,
        severity: ss.is_planar ? 'info' : 'warning',
        message: ss.is_planar
          ? `Layout graph is planar (${ss.nodes.length} nodes, ${ss.edges.length} edges) — no crossing corridors`
          : `Layout graph is NON-PLANAR — indicates crossing circulation paths in plan`,
        clause: 'Euler planarity: E ≤ 3V − 6',
      });
      // Deep rooms (>3 steps from entry)
      if (ss.circulation_depth_rooms.length > 0) {
        violations.push({
          domain: 'space_syntax' as ConstraintDomain,
          label: 'Circulation Depth (Space Syntax)',
          passed: false,
          severity: 'warning',
          message: `${ss.circulation_depth_rooms.length} room(s) are >3 steps from entry: ${ss.circulation_depth_rooms.join(', ')}`,
          roomIds: ss.circulation_depth_rooms,
          clause: 'Hillier & Hanson integration analysis',
          remediation: 'Add direct corridor link or reposition rooms closer to entry circulation.',
        });
      }
      // Integration mean
      violations.push({
        domain: 'space_syntax' as ConstraintDomain,
        label: 'Mean Integration (Space Syntax)',
        passed: true,
        severity: 'info',
        message: `Mean integration: ${ss.integration_mean.toFixed(3)}, variance: ${ss.integration_variance.toFixed(4)}, mean depth: ${ss.mean_depth.toFixed(2)}`,
        value: ss.integration_mean,
        clause: 'Hillier & Hanson Relative Asymmetry',
      });
    }

    // ── Structural handoff (Phase G) ──
    if (response.structural_handoff) {
      const sh = response.structural_handoff;
      if (sh.cantilever_rooms.length > 0) {
        violations.push({
          domain: 'structural_handoff' as ConstraintDomain,
          label: 'Cantilever Check',
          passed: false,
          severity: 'warning',
          message: `${sh.cantilever_rooms.length} room(s) extend beyond site boundary`,
          roomIds: sh.cantilever_rooms.map(c => c.room_id),
          clause: 'IS 456 Cl. 24.1',
          remediation: sh.cantilever_rooms.map(c => `${c.room_id}: ${c.max_overhang_m}m ${c.direction} — ${c.action}`).join('; '),
        });
      }
      violations.push({
        domain: 'structural_handoff' as ConstraintDomain,
        label: 'Shared Load-Bearing Walls',
        passed: true,
        severity: 'info',
        message: `${sh.total_shared_walls} shared wall segment(s) identified for load-path continuity`,
        clause: 'Structural handoff analysis',
      });
    }

    // ── MEP schedule summary (Phase G) ──
    if (response.mep_schedule) {
      const mep = response.mep_schedule;
      violations.push({
        domain: 'mep_schedule' as ConstraintDomain,
        label: 'MEP Schedule Summary',
        passed: true,
        severity: 'info',
        message: `Plumbing: ${mep.plumbing.total_stacks} stack(s), Electrical: ${mep.electrical.total_power_points} points, HVAC: ${mep.hvac.total_tonnage_tr} TR (${mep.hvac.recommended_system})`,
        clause: 'MEP estimation schedule',
      });
    }

    const score = total > 0 ? Math.round((met / total) * 100) : 0;

    return {
      score,
      totalPenalty: response.total_penalty,
      constraintsMet: met,
      constraintsTotal: total,
      constraintsMetRatio: response.constraints_met_ratio,
      iterationFound: response.iteration_found,
      totalIterations: response.total_iterations,
      violations,
      fsi: response.fsi_analysis,
      circulation: response.circulation,
      egress: response.egress,
      structuralChecks: response.structural_checks,
      solarScores: response.solar_scores,
      fenestrationChecks: response.fenestration_checks,
      anthropometricIssues: response.anthropometric_issues,
      staircaseReport: response.staircase,
      constraintsDetail: response.constraints_detail,
      travelDistances: response.travel_distances,
      acousticBuffers: response.acoustic_buffers,
      structuralGrid: response.structural_grid,
      saConvergence: response.sa_convergence,
      spaceSyntax: response.space_syntax ?? undefined,
      structuralHandoff: response.structural_handoff ?? undefined,
      mepSchedule: response.mep_schedule ?? undefined,
    };
  }

  // ── Legacy fallback path: build from boolean constraints_detail ──
  const domains = Object.keys(response.constraints_detail) as ConstraintDomain[];
  let met = 0;
  const total = domains.length;

  for (const domain of domains) {
    const passed = response.constraints_detail[domain];
    if (passed) met++;

    let message = passed
      ? `${DOMAIN_LABELS[domain] || domain} — PASS`
      : `${DOMAIN_LABELS[domain] || domain} — FAIL`;

    let roomIds: string[] | undefined;
    let value: number | undefined;
    let limit: number | undefined;

    // Domain-specific detail enrichment
    switch (domain) {
      case 'fsi': {
        const fsi = response.fsi_analysis;
        value = fsi.fsi_used;
        limit = fsi.fsi_limit;
        message = passed
          ? `FSI ${fsi.fsi_used?.toFixed(2)} within limit ${fsi.fsi_limit}`
          : `FSI ${fsi.fsi_used?.toFixed(2)} exceeds limit ${fsi.fsi_limit} (placed ${fsi.total_placed_sqm?.toFixed(1)}m² / max ${fsi.max_allowed_sqm?.toFixed(1)}m²)`;
        break;
      }
      case 'circulation': {
        const circ = response.circulation;
        value = circ.circulation_ratio;
        limit = circ.max_ratio;
        message = passed
          ? `Circulation ratio ${(circ.circulation_ratio * 100)?.toFixed(1)}% within ${(circ.max_ratio * 100)?.toFixed(1)}%`
          : `Circulation ratio ${(circ.circulation_ratio * 100)?.toFixed(1)}% exceeds ${(circ.max_ratio * 100)?.toFixed(1)}%`;
        break;
      }
      case 'egress': {
        const eg = response.egress;
        value = eg.max_travel_distance_m;
        limit = eg.limit_m;
        roomIds = eg.rooms_beyond_limit;
        message = passed
          ? `Max travel distance ${eg.max_travel_distance_m?.toFixed(1)}m within ${eg.limit_m}m limit`
          : `Egress FAIL: ${eg.rooms_beyond_limit?.length} room(s) beyond ${eg.limit_m}m limit (max ${eg.max_travel_distance_m?.toFixed(1)}m)`;
        break;
      }
      case 'span_limits': {
        const failedSpans = response.structural_checks?.filter((s) => !s.compliant) || [];
        roomIds = failedSpans.map((s) => s.room_id);
        message = passed
          ? `All spans within ${response.structural_checks?.[0]?.max_span_m || 5}m limit`
          : `${failedSpans.length} room(s) exceed span limit: ${failedSpans.map((s) => `${s.room_id}(${s.span_m?.toFixed(1)}m)`).join(', ')}`;
        break;
      }
      case 'fenestration': {
        const failedFen = response.fenestration_checks?.filter((f) => !f.compliant) || [];
        roomIds = failedFen.map((f) => f.room_id);
        message = passed
          ? 'All habitable rooms meet fenestration ratio'
          : `${failedFen.length} room(s) below min window-to-wall ratio: ${failedFen.map((f) => `${f.room_id}(${(f.ratio * 100)?.toFixed(0)}%)`).join(', ')}`;
        break;
      }
      case 'clearance': {
        const issues = response.anthropometric_issues || [];
        message = passed
          ? 'All door clearances and min dimensions satisfied'
          : `${issues.length} anthropometric issue(s): ${issues.slice(0, 3).join('; ')}`;
        break;
      }
      default:
        break;
    }

    violations.push({
      domain,
      label: DOMAIN_LABELS[domain] || domain,
      passed,
      severity: passed ? 'info' : (DOMAIN_SEVERITY[domain] || 'warning'),
      message,
      roomIds,
      value,
      limit,
    });
  }

  // Sort: critical failures first, then warnings, then info
  const severityOrder = { critical: 0, warning: 1, info: 2 };
  violations.sort((a, b) => {
    if (a.passed !== b.passed) return a.passed ? 1 : -1;
    return severityOrder[a.severity] - severityOrder[b.severity];
  });

  const score = total > 0 ? Math.round((met / total) * 100) : 0;

  // Append new domain reports when present in response
  if (response.travel_distances) {
    const td = response.travel_distances;
    const travelPass = td.max_travel_m <= 22.0;
    violations.push({
      domain: 'travel_distance' as ConstraintDomain,
      label: 'A* Travel Distance',
      passed: travelPass,
      severity: travelPass ? 'info' : 'warning',
      message: travelPass
        ? `Max travel ${td.max_travel_m.toFixed(1)}m (A*), corridor ratio ${(td.corridor_ratio * 100).toFixed(1)}%`
        : `Max travel ${td.max_travel_m.toFixed(1)}m exceeds 22m egress limit`,
      value: td.max_travel_m,
      limit: 22.0,
    });
  }

  if (response.acoustic_buffers && response.acoustic_buffers.length > 0) {
    violations.push({
      domain: 'acoustic_buffers' as ConstraintDomain,
      label: 'Acoustic Buffers',
      passed: true,
      severity: 'info',
      message: `${response.acoustic_buffers.length} acoustic buffer(s) inserted between conflicting zones`,
    });
  }

  if (response.structural_grid) {
    const sg = response.structural_grid;
    const hasWarnings = sg.span_warnings.length > 0;
    violations.push({
      domain: 'structural_grid' as ConstraintDomain,
      label: 'Structural Grid',
      passed: !hasWarnings,
      severity: hasWarnings ? 'warning' : 'info',
      message: hasWarnings
        ? `${sg.total_columns} columns, ${sg.total_beams} beams — ${sg.span_warnings.length} span warning(s)`
        : `${sg.total_columns} columns, ${sg.total_beams} beams on ${sg.grid_module_m}m module`,
    });
  }

  return {
    score,
    totalPenalty: response.total_penalty,
    constraintsMet: met,
    constraintsTotal: total,
    constraintsMetRatio: response.constraints_met_ratio,
    iterationFound: response.iteration_found,
    totalIterations: response.total_iterations,
    violations,
    fsi: response.fsi_analysis,
    circulation: response.circulation,
    egress: response.egress,
    structuralChecks: response.structural_checks,
    solarScores: response.solar_scores,
    fenestrationChecks: response.fenestration_checks,
    anthropometricIssues: response.anthropometric_issues,
    staircaseReport: response.staircase,
    constraintsDetail: response.constraints_detail,
    travelDistances: response.travel_distances,
    acousticBuffers: response.acoustic_buffers,
    structuralGrid: response.structural_grid,
    saConvergence: response.sa_convergence,
  };
}

/**
 * Build a ConstraintReport from a VariantResponse.
 *
 * When the variant includes `compliance_items` (from the backend compliance
 * engine), those are used to build rich clause-traceable violations.
 * Falls back to a score-only stub when compliance items are absent.
 */
export function buildConstraintReportFromVariant(variant: VariantResponse): ConstraintReport {
  const complianceItems = variant.compliance_items ?? [];
  const compositeScore = variant.score?.composite_score ?? 0;

  // Empty stub FSI/circulation/egress — real data not returned per-variant
  const stubFsi: FSIAnalysis = { status: 'coming_soon' as const, message: 'This feature is under development. Results shown are placeholders.', plot_area_sqm: 0, fsi_limit: 0, max_allowed_sqm: 0, total_placed_sqm: 0, fsi_used: 0, fsi_compliant: true };
  const stubCirc: CirculationReport = { status: 'coming_soon' as const, message: 'This feature is under development. Results shown are placeholders.', total_area_sqm: 0, circulation_area_sqm: 0, circulation_ratio: 0, max_ratio: 0.15, compliant: true };
  const stubEgress: EgressReport = { status: 'coming_soon' as const, message: 'This feature is under development. Results shown are placeholders.', max_travel_distance_m: 0, limit_m: 22, compliant: true, rooms_beyond_limit: [] };
  const stubConstraintsDetail: ConstraintsDetail = { fsi: true, overlap: true, min_width: true, aspect_ratio: true, exterior_wall: true, plumbing_cluster: true, acoustic_zones: true, clearance: true, grid_snap: true, circulation: true, span_limits: true, staircase: true, fenestration: true, egress: true, solar: true };

  if (complianceItems.length === 0) {
    return {
      score: Math.round(compositeScore),
      totalPenalty: Math.round((100 - compositeScore) * 10),
      constraintsMet: 0,
      constraintsTotal: 0,
      constraintsMetRatio: compositeScore / 100,
      iterationFound: 0,
      totalIterations: 200,
      violations: [],
      fsi: stubFsi,
      circulation: stubCirc,
      egress: stubEgress,
      structuralChecks: [],
      solarScores: [],
      fenestrationChecks: [],
      anthropometricIssues: [],
      staircaseReport: null,
      constraintsDetail: stubConstraintsDetail,
    };
  }

  // Build violations from compliance_items (mirrors new path in buildConstraintReport)
  const violations: ConstraintViolation[] = [];
  let met = 0;
  const total = complianceItems.length;

  for (const item of complianceItems) {
    if (item.passed) met++;
    let message = item.remediation || (item.passed ? `${item.label} — PASS` : `${item.label} — FAIL`);
    if (!item.passed && item.measured_value != null && item.limit_value != null) {
      message = `${item.label}: ${item.measured_value.toFixed(2)} ${item.units} (limit ${item.limit_value.toFixed(2)} ${item.units}). ${item.remediation}`;
    }
    violations.push({
      domain: item.domain as ConstraintDomain,
      label: item.label,
      passed: item.passed,
      severity: item.passed ? 'info' : item.severity,
      message,
      roomIds: item.affected_rooms.length > 0 ? item.affected_rooms : undefined,
      value: item.measured_value ?? undefined,
      limit: item.limit_value ?? undefined,
      clause: item.clause,
      remediation: item.remediation || undefined,
      evidenceLevel: item.evidence_level,
    });
  }

  const severityOrder = { critical: 0, warning: 1, info: 2 };
  violations.sort((a, b) => {
    if (a.passed !== b.passed) return a.passed ? 1 : -1;
    return severityOrder[a.severity] - severityOrder[b.severity];
  });

  // Extract FSI values from compliance items when available
  const fsiItem = complianceItems.find((i) => i.domain === 'fsi');
  const fsi: FSIAnalysis = {
    plot_area_sqm: 0,
    fsi_limit: fsiItem?.limit_value ?? 0,
    max_allowed_sqm: 0,
    total_placed_sqm: fsiItem?.measured_value ?? 0,
    fsi_used: fsiItem?.measured_value ?? 0,
    fsi_compliant: fsiItem?.passed ?? true,
  };

  // Derive actual score from compliance ratio (overrides composite when we have real data)
  const constraintScore = total > 0 ? Math.round((met / total) * 100) : Math.round(compositeScore);

  return {
    score: constraintScore,
    totalPenalty: Math.round((100 - compositeScore) * 10),
    constraintsMet: met,
    constraintsTotal: total,
    constraintsMetRatio: total > 0 ? met / total : compositeScore / 100,
    iterationFound: 0,
    totalIterations: 200,
    violations,
    fsi,
    circulation: stubCirc,
    egress: stubEgress,
    structuralChecks: [],
    solarScores: complianceItems
      .filter((i) => i.domain === 'solar')
      .flatMap((i) =>
        i.affected_rooms.map((rid) => ({ room_id: rid, solar_score: i.passed ? 0.7 : 0.3, direction: 'N' })),
      ),
    fenestrationChecks: [],
    anthropometricIssues: complianceItems
      .filter((i) => i.domain === 'clearance' && !i.passed)
      .map((i) => i.remediation)
      .filter(Boolean),
    staircaseReport: null,
    constraintsDetail: stubConstraintsDetail,
  };
}

// ============================================================================
// API CALL FUNCTIONS
// ============================================================================

/**
 * Probe optimizer health endpoint via Node gateway.
 * Used by UI when optimization appears unavailable so users can diagnose quickly.
 */
export async function checkSolverBackendHealth(): Promise<SolverBackendHealth> {
  const url = '/api/layout/v2/health';

  try {
    const { data, status } = await layoutApiClient.get<{
      ok?: boolean;
      status?: number;
      message?: string;
      details?: unknown;
    }>(url, { cache: false });

    if (!data?.ok) {
      return {
        ok: false,
        status,
        message: data?.message || `Optimization service responded with HTTP ${status}`,
        url,
        details: data,
      };
    }

    return {
      ok: true,
      status,
      message: data?.message || 'Optimization service health check successful',
      url,
      details: data?.details,
    };
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : 'Network error while checking optimization service';

    return {
      ok: false,
      status: 0,
      message,
      url,
      details: error,
    };
  }
}

/**
 * Call the v2 layout optimizer endpoint.
 * Returns the raw LayoutV2Response from the backend.
 */
export async function optimizeLayoutV2(request: LayoutV2Request): Promise<LayoutV2Response> {
  const { data } = await layoutApiClient.post<LayoutV2Response>(
    '/api/layout/v2/optimize',
    request,
  );
  return data;
}

/**
 * High-level function: takes WizardConfig, calls the solver, returns
 * placements + constraint report.
 */
export async function solveLayout(
  config: WizardConfig,
  options?: {
    maxIterations?: number;
    randomSeed?: number;
    penaltyWeights?: PenaltyWeightsRequest;
  },
): Promise<{ placements: PlacementResponse[]; report: ConstraintReport; response: LayoutV2Response }> {
  const request = wizardConfigToRequest(config, options);
  const response = await optimizeLayoutV2(request);
  const report = buildConstraintReport(response);
  return { placements: response.placements, report, response };
}

/**
 * Minimal-input solve path:
 * Backend auto-generates a robust room program from plot size + entry/road directions,
 * then runs the v2 optimizer.
 */
export async function solveLayoutFromMinimal(
  config: WizardConfig,
  options?: {
    maxIterations?: number;
    randomSeed?: number;
  },
): Promise<{ placements: PlacementResponse[]; report: ConstraintReport; response: LayoutV2Response }> {
  const base = wizardConfigToRequest(config, options);
  const areaSqm = config.plot.unit === 'feet' ? config.plot.area * 0.092903 : config.plot.area;
  const bedroomPref = areaSqm < 85 ? 1 : areaSqm < 145 ? 2 : areaSqm < 230 ? 3 : 4;

  const request: MinimalAutoOptimizeRequest = {
    site: base.site,
    global_constraints: base.global_constraints,
    main_entry_direction: config.orientation.mainEntryDirection,
    road_sides: config.orientation.roadSide,
    bedroom_preference: bedroomPref,
    include_study: areaSqm >= 210,
    include_guest_room: areaSqm >= 155,
    include_parking: areaSqm >= 95 || (config.constraints.parkingRequired ?? 0) > 0,
    max_iterations: options?.maxIterations || 300,
    random_seed: options?.randomSeed ?? base.random_seed,
  };

  const { data } = await layoutApiClient.post<LayoutV2Response>(
    '/api/layout/v2/auto-optimize',
    request,
  );

  const report = buildConstraintReport(data);
  return { placements: data.placements, report, response: data };
}

/**
 * Generate multiple solver candidates with different random seeds.
 * Enables multi-candidate comparison for the architect to pick the best option.
 *
 * @param config - The wizard configuration
 * @param numCandidates - Number of alternative layouts to generate (default: 3)
 * @param maxIterations - Max solver iterations per candidate
 * @returns MultiCandidateResult with all candidates sorted by score
 */
export async function solveMultipleCandidates(
  config: WizardConfig,
  numCandidates: number = 3,
  maxIterations: number = 300,
): Promise<MultiCandidateResult> {
  const baseSeed = Date.now();
  const labels = ['Alpha', 'Beta', 'Gamma', 'Delta', 'Epsilon', 'Zeta'];

  const promises = Array.from({ length: numCandidates }, (_, i) =>
    solveLayout(config, {
      maxIterations,
      randomSeed: baseSeed + i * 1000,
    }).then((result) => ({
      id: `candidate_${i}`,
      label: `Option ${labels[i] || String.fromCharCode(65 + i)}`,
      placements: result.placements,
      report: result.report,
      usableBoundary: result.response.usable_boundary,
      timestamp: Date.now(),
    })),
  );

  const candidates = await Promise.all(promises);

  // Sort by score descending (highest = best)
  candidates.sort((a, b) => b.report.score - a.report.score);

  return {
    candidates,
    bestCandidateId: candidates[0].id,
    config,
  };
}

/**
 * 🎯 WORKFLOW-AWARE MULTI-VARIANT GENERATION (NEW)
 * 
 * Generate 5 competing design solutions using different architectural philosophies:
 *   1. active_first: Open living concept
 *   2. sleeping_refuge: Private sleeping wing
 *   3. central_circulation: Hub & spoke layout
 *   4. compact_zones: Efficient clustering
 *   5. linear_flow: Sequential entry flow
 * 
 * Each variant explores a different layout strategy with optimized penalty weights.
 * Returns solutions ranked by composite quality score (0-100).
 * 
 * @param config - The wizard configuration
 * @param options - Optional generation parameters
 * @returns LayoutVariantsResponse with 5 ranked variants
 */
export async function generateLayoutVariants(
  config: WizardConfig,
  options?: {
    maxIterationsPerVariant?: number;
    strategiesToGenerate?: string[];
    penaltyWeights?: PenaltyWeightsRequest;
  },
): Promise<LayoutVariantsResponse> {
  const request: LayoutVariantsRequest = {
    ...wizardConfigToRequest(config, {
      maxIterations: options?.maxIterationsPerVariant || 150,
      penaltyWeights: options?.penaltyWeights,
    }),
    max_iterations_per_variant: options?.maxIterationsPerVariant || 150,
    strategies_to_generate: options?.strategiesToGenerate || [
      'active_first',
      'sleeping_refuge',
      'central_circulation',
      'compact_zones',
      'linear_flow',
    ],
  };

  const { data } = await layoutApiClient.post<LayoutVariantsResponse>(
    '/api/layout/v2/variants',
    request,
    { timeout: 180000 }, // 3 min timeout for 5 variants
  );

  return data;
}

// ============================================================================
// PLACEMENT → FRONTEND TYPE CONVERSION
// ============================================================================

/**
 * Convert backend PlacementResponse[] into the frontend PlacedRoom[] format
 * that FloorPlanRenderer expects. This bridges the solver output back to the
 * existing UI rendering pipeline.
 */
export function placementsToPlacedRooms(
  placements: PlacementResponse[],
  originalSpecs: RoomSpec[],
): import('./types').PlacedRoom[] {
  return placements.map((p) => {
    // Find the matching original spec
    const baseId = p.room_id.replace(/_\d+$/, '');
    const spec = originalSpecs.find((s) => s.id === baseId || s.id === p.room_id) || {
      id: p.room_id,
      type: mapBackendTypeToFrontend(p.type),
      name: p.name,
      minArea: p.target_area_sqm * 0.8,
      preferredArea: p.target_area_sqm,
      maxArea: p.target_area_sqm * 1.3,
      minWidth: p.min_dimension_m,
      minHeight: 2.8,
      requiresWindow: p.requires_exterior_wall,
      requiresVentilation: true,
      requiresAttachedBath: false,
      priority: 'important' as const,
      floor: 0,
      quantity: 1,
    };

    return {
      id: p.room_id,
      spec: { ...spec, id: p.room_id, name: p.name },
      x: p.position.x,
      y: p.position.y,
      width: p.dimensions.width,
      height: p.dimensions.height,
      rotation: 0,
      floor: 0,
      wallThickness: 0.23, // 230mm standard brick+plaster
      doors: [], // Will be populated by SpacePlanningEngine.addDoorsAndWindows
      windows: [],
      finishFloor: 'vitrified_tile',
      finishWall: 'paint',
      finishCeiling: 'POP',
      ceilingHeight: 3.0,
      color: getRoomColor(spec.type || mapBackendTypeToFrontend(p.type)),
    };
  });
}

/** Map backend solver type back to frontend RoomType */
function mapBackendTypeToFrontend(backendType: string): RoomType {
  // Reverse lookup - find first frontend type that maps to this backend type
  for (const [frontType, solverType] of Object.entries(ROOM_TYPE_MAP)) {
    if (solverType === backendType) return frontType as RoomType;
  }
  return 'utility' as RoomType;
}

/** Color palette matching SpacePlanningEngine.getRoomColor */
function getRoomColor(type: RoomType): string {
  const COLORS: Partial<Record<RoomType, string>> = {
    living: '#E8F5E9',
    dining: '#FFF3E0',
    kitchen: '#FFF9C4',
    master_bedroom: '#E3F2FD',
    bedroom: '#E8EAF6',
    bathroom: '#E0F7FA',
    toilet: '#F3E5F5',
    pooja: '#FFF8E1',
    study: '#F1F8E9',
    home_office: '#E0F2F1',
    store: '#EFEBE9',
    utility: '#F5F5F5',
    laundry: '#E1F5FE',
    garage: '#ECEFF1',
    parking: '#CFD8DC',
    balcony: '#C8E6C9',
    terrace: '#DCEDC8',
    corridor: '#F5F5F5',
    staircase: '#FFE0B2',
    lift: '#FFE0B2',
    entrance_lobby: '#FFF3E0',
    drawing_room: '#E8F5E9',
    guest_room: '#E8EAF6',
    servants_quarter: '#EFEBE9',
    pantry: '#FFF9C4',
    gym: '#FCE4EC',
    home_theater: '#EDE7F6',
    swimming_pool: '#B3E5FC',
    garden: '#A5D6A7',
    sit_out: '#C8E6C9',
    verandah: '#C8E6C9',
    foyer: '#FFF3E0',
    walk_in_closet: '#F3E5F5',
    dressing: '#F3E5F5',
    childrens_room: '#FCE4EC',
    library: '#F1F8E9',
    workshop: '#EFEBE9',
    basement: '#ECEFF1',
    mechanical_room: '#CFD8DC',
    electrical_panel: '#CFD8DC',
    water_tank_room: '#B3E5FC',
  };
  return COLORS[type] || '#F5F5F5';
}

// ============================================================================
// CANONICAL EXPORT SERIALIZATION  (Phase H)
// ============================================================================

/**
 * Produce a canonical JSON payload suitable for archival, sharing, or re-import.
 * Includes all solver domains: placements, compliance, space-syntax, structural
 * handoff, MEP schedule, travel distances, acoustic buffers, and structural grid.
 */
export function serializeCanonicalReport(
  response: LayoutV2Response,
  report: ConstraintReport,
): Record<string, unknown> {
  return {
    _schema_version: '2.0.0',
    _generated_at: new Date().toISOString(),
    summary: {
      score: report.score,
      total_penalty: report.totalPenalty,
      constraints_met: report.constraintsMet,
      constraints_total: report.constraintsTotal,
      constraints_met_ratio: report.constraintsMetRatio,
      iteration_found: report.iterationFound,
      total_iterations: report.totalIterations,
    },
    fsi_analysis: response.fsi_analysis,
    usable_boundary: response.usable_boundary,
    placements: response.placements,
    compliance_items: response.compliance_items ?? [],
    constraints_detail: response.constraints_detail,
    circulation: response.circulation,
    egress: response.egress,
    structural_checks: response.structural_checks,
    solar_scores: response.solar_scores,
    fenestration_checks: response.fenestration_checks,
    anthropometric_issues: response.anthropometric_issues,
    staircase: response.staircase,
    travel_distances: response.travel_distances ?? null,
    acoustic_buffers: response.acoustic_buffers ?? null,
    structural_grid: response.structural_grid ?? null,
    sa_convergence: response.sa_convergence ?? null,
    space_syntax: response.space_syntax ?? null,
    structural_handoff: response.structural_handoff ?? null,
    mep_schedule: response.mep_schedule ?? null,
  };
}

/**
 * Download a canonical JSON report as a file.
 */
export function downloadCanonicalReport(
  response: LayoutV2Response,
  report: ConstraintReport,
  filename = 'beamlab-layout-report.json',
): void {
  const canonical = serializeCanonicalReport(response, report);
  const json = JSON.stringify(canonical, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ============================================================================
// EXPORTS
// ============================================================================

export {
  layoutApiClient,
  buildAdjacencyMatrix,
  ROOM_TYPE_MAP,
  ACOUSTIC_MAP,
  PLUMBING_ROOMS,
  EXTERIOR_WALL_ROOMS,
  ADJACENCY_RULES,
};
