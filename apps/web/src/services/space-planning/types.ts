/**
 * Space Planning Types - Comprehensive Data Models
 *
 * From 35+ years multi-disciplinary engineering experience:
 * Architecture, Civil, Mechanical, Electrical, Plumbing, Vastu
 */

// ============================================
// DIRECTION & ORIENTATION
// ============================================

export type CardinalDirection = 'N' | 'NE' | 'E' | 'SE' | 'S' | 'SW' | 'W' | 'NW';

export type CompassAngle = number; // 0-360 degrees, 0 = North

export interface SiteOrientation {
  northDirection: CompassAngle;
  plotFacing: CardinalDirection;
  mainEntryDirection: CardinalDirection;
  roadSide: CardinalDirection[];
}

// ============================================
// PLOT & SITE
// ============================================

export interface PlotDimensions {
  width: number; // meters
  depth: number; // meters
  area: number; // sq meters (computed)
  shape: 'rectangular' | 'L-shaped' | 'irregular' | 'triangular' | 'trapezoidal';
  irregularVertices?: { x: number; y: number }[];
  unit: 'meters' | 'feet';
}

export interface SetbackRequirements {
  front: number;
  rear: number;
  left: number;
  right: number;
}

export interface SiteConstraints {
  setbacks: SetbackRequirements;
  maxHeight: number; // meters
  maxFloors: number;
  farAllowed: number; // Floor Area Ratio
  groundCoverage: number; // percentage
  parkingRequired: number; // number of spots
  buildingType: 'residential' | 'commercial' | 'mixed' | 'industrial';
  zone: string; // local zoning code
}

// ============================================
// ROOM DEFINITIONS
// ============================================

export type RoomType =
  | 'living'
  | 'dining'
  | 'kitchen'
  | 'master_bedroom'
  | 'bedroom'
  | 'bathroom'
  | 'toilet'
  | 'pooja'
  | 'study'
  | 'home_office'
  | 'store'
  | 'utility'
  | 'laundry'
  | 'garage'
  | 'parking'
  | 'balcony'
  | 'terrace'
  | 'corridor'
  | 'staircase'
  | 'lift'
  | 'entrance_lobby'
  | 'drawing_room'
  | 'guest_room'
  | 'servants_quarter'
  | 'pantry'
  | 'gym'
  | 'home_theater'
  | 'swimming_pool'
  | 'garden'
  | 'sit_out'
  | 'verandah'
  | 'foyer'
  | 'walk_in_closet'
  | 'dressing'
  | 'childrens_room'
  | 'library'
  | 'workshop'
  | 'basement'
  | 'mechanical_room'
  | 'electrical_panel'
  | 'water_tank_room';

export interface RoomSpec {
  id: string;
  type: RoomType;
  name: string;
  minArea: number; // sq meters
  preferredArea: number; // sq meters
  maxArea: number; // sq meters
  minWidth: number; // meters
  minHeight: number; // floor-to-ceiling meters
  requiresWindow: boolean;
  requiresVentilation: boolean;
  requiresAttachedBath: boolean;
  preferredDirection?: CardinalDirection[];
  vastuDirection?: CardinalDirection;
  priority: 'essential' | 'important' | 'desirable' | 'optional';
  floor: number;
  quantity: number;
  adjacentTo?: RoomType[];
  awayFrom?: RoomType[];
}

// ============================================
// DOOR & WINDOW SPECIFICATIONS
// ============================================

export type DoorType =
  | 'main_entry'
  | 'internal'
  | 'sliding'
  | 'french'
  | 'bi_fold'
  | 'pocket'
  | 'garage'
  | 'fire_rated';
export type WindowType =
  | 'casement'
  | 'sliding'
  | 'fixed'
  | 'bay'
  | 'skylight'
  | 'clerestory'
  | 'louvered'
  | 'french';

export interface DoorSpec {
  id: string;
  type: DoorType;
  width: number; // meters
  height: number; // meters
  material: 'wood' | 'steel' | 'aluminum' | 'glass' | 'upvc';
  swing: 'left' | 'right' | 'double' | 'sliding';
  fireRating?: number; // minutes
  roomId: string;
  wallSide: 'N' | 'S' | 'E' | 'W';
  position: number; // offset from wall start
}

export interface WindowSpec {
  id: string;
  type: WindowType;
  width: number;
  height: number;
  sillHeight: number; // height from floor
  material: 'wood' | 'aluminum' | 'upvc' | 'steel';
  glazing: 'single' | 'double' | 'triple' | 'tempered' | 'laminated';
  roomId: string;
  wallSide: 'N' | 'S' | 'E' | 'W';
  position: number;
  operationType: 'fixed' | 'openable' | 'top_hung' | 'pivot';
}

// ============================================
// ARCHITECTURAL PLAN
// ============================================

export interface PlacedRoom {
  id: string;
  spec: RoomSpec;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  floor: number;
  wallThickness: number;
  doors: DoorSpec[];
  windows: WindowSpec[];
  finishFloor: string;
  finishWall: string;
  finishCeiling: string;
  ceilingHeight: number;
  color: string;
}

export interface StaircaseSpec {
  id: string;
  type: 'straight' | 'L-shaped' | 'U-shaped' | 'spiral' | 'dog_leg';
  width: number;
  riserHeight: number;
  treadDepth: number;
  numRisers: number;
  landingWidth: number;
  handrailHeight: number;
  x: number;
  y: number;
  rotation: number;
}

export interface ConstraintViolationRecord {
  type: 'boundary' | 'overlap' | 'adjacency' | 'structural';
  roomId: string;
  message: string;
  severity: 'error' | 'warning';
}

export interface FloorPlan {
  floor: number;
  label: string; // "Ground Floor", "First Floor", etc.
  rooms: PlacedRoom[];
  staircases: StaircaseSpec[];
  corridors: { x: number; y: number; width: number; height: number }[];
  floorHeight: number; // floor-to-floor height
  slabThickness: number;
  walls: WallSegment[];
  boundaryViolationCount: number;
  overlapCount: number;
  constraintViolations: ConstraintViolationRecord[];
}

export interface WallSegment {
  id: string;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  thickness: number;
  type: 'external' | 'internal' | 'partition' | 'shear';
  material: 'brick' | 'concrete' | 'block' | 'drywall' | 'stone';
}

// ============================================
// STRUCTURAL PLAN
// ============================================

export interface ColumnSpec {
  id: string;
  x: number;
  y: number;
  width: number;
  depth: number;
  type: 'rectangular' | 'circular' | 'L-shaped';
  material: 'RCC' | 'steel' | 'composite';
  reinforcement?: string;
  floor: number;
}

export interface BeamSpec {
  id: string;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  width: number;
  depth: number;
  type: 'main' | 'secondary' | 'tie' | 'plinth';
  material: 'RCC' | 'steel';
  floor: number;
}

export interface FoundationSpec {
  id: string;
  type: 'isolated' | 'combined' | 'raft' | 'pile' | 'strip';
  x: number;
  y: number;
  width: number;
  depth: number;
  thickness: number;
  bearingCapacity: number;
  columnId: string;
}

export interface StructuralPlan {
  columns: ColumnSpec[];
  beams: BeamSpec[];
  foundations: FoundationSpec[];
  slabType: 'one_way' | 'two_way' | 'flat' | 'ribbed' | 'post_tensioned';
  slabThickness: number;
  gridAlignmentScore: number; // 0–100
}

// ============================================
// MEP - ELECTRICAL PLAN
// ============================================

export type ElectricalFixtureType =
  | 'switch'
  | 'socket'
  | 'light_point'
  | 'fan_point'
  | 'ac_point'
  | 'geyser_point'
  | 'exhaust_fan'
  | 'bell_point'
  | 'tv_point'
  | 'telephone_point'
  | 'data_point'
  | 'cctv'
  | 'smoke_detector'
  | 'emergency_light'
  | 'earth_point'
  | 'mcb'
  | 'distribution_board'
  | 'meter_board'
  | 'ups_point'
  | 'inverter_point'
  | 'solar_panel_connection'
  | 'ev_charging'
  | 'motion_sensor'
  | 'dimmer';

export interface ElectricalFixture {
  id: string;
  type: ElectricalFixtureType;
  x: number;
  y: number;
  roomId: string;
  circuit: string;
  wattage: number;
  height: number; // mounting height from floor
  switchGroup?: string;
}

export interface ElectricalCircuit {
  id: string;
  name: string;
  type: 'lighting' | 'power' | 'ac' | 'kitchen' | 'geyser' | 'motor';
  mcbRating: number; // amps
  wireSize: number; // sq mm
  fixtures: string[]; // fixture IDs
  phase: 1 | 3;
}

export interface ElectricalPlan {
  fixtures: ElectricalFixture[];
  circuits: ElectricalCircuit[];
  mainLoad: number; // kW
  connectedLoad: number; // kW
  demandLoad: number; // kW (after diversity)
  meterType: 'single_phase' | 'three_phase';
  earthingType: 'plate' | 'pipe' | 'strip';
  lightningProtection: boolean;
  solarCapacity?: number; // kWp
  backupType?: 'inverter' | 'generator' | 'both';
  panels: { id: string; name: string; x: number; y: number; roomId: string; circuits: string[] }[];
}

// ============================================
// MEP - PLUMBING PLAN
// ============================================

export type PlumbingFixtureType =
  | 'wash_basin'
  | 'wc'
  | 'shower'
  | 'bathtub'
  | 'kitchen_sink'
  | 'utility_sink'
  | 'washing_machine'
  | 'dishwasher'
  | 'water_heater'
  | 'floor_trap'
  | 'nahani_trap'
  | 'gully_trap'
  | 'inspection_chamber'
  | 'septic_tank'
  | 'soak_pit'
  | 'rain_water_harvest'
  | 'sump'
  | 'overhead_tank'
  | 'pressure_pump'
  | 'bib_cock'
  | 'stop_cock'
  | 'garden_tap';

export interface PlumbingFixture {
  id: string;
  type: PlumbingFixtureType;
  x: number;
  y: number;
  roomId: string;
  waterSupply: boolean;
  drainage: boolean;
  hotWater: boolean;
  pipeSize: number; // mm
}

export interface PlumbingPipe {
  id: string;
  type: 'water_supply' | 'drainage' | 'vent' | 'rain_water' | 'hot_water' | 'recycled';
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  diameter: number; // mm
  material: 'cpvc' | 'upvc' | 'gi' | 'ppr' | 'hdpe' | 'copper' | 'ci';
  slope?: number; // for drainage
  floor: number;
}

export interface PlumbingPlan {
  fixtures: PlumbingFixture[];
  pipes: PlumbingPipe[];
  waterSupplySource: 'municipal' | 'borewell' | 'both';
  storageCapacity: number; // liters
  overheadTankCapacity: number;
  sumpCapacity: number;
  pumpHP: number;
  sewageDisposal: 'municipal' | 'septic_tank' | 'stp';
  rainwaterHarvesting: boolean;
  hotWaterSystem: 'solar' | 'electric' | 'gas' | 'heat_pump';
  recyclingSystem: boolean;
}

// ============================================
// MEP - MECHANICAL (HVAC)
// ============================================

export type HVACEquipmentType =
  | 'split_ac'
  | 'window_ac'
  | 'cassette_ac'
  | 'vrf_unit'
  | 'ahu'
  | 'exhaust_fan'
  | 'fresh_air_unit'
  | 'duct'
  | 'diffuser'
  | 'grille'
  | 'damper'
  | 'thermostat'
  | 'ceiling_fan'
  | 'chimney'
  | 'ventilator';

export interface HVACEquipment {
  id: string;
  type: HVACEquipmentType;
  x: number;
  y: number;
  roomId: string;
  capacity?: number; // tons/BTU/CFM
  powerConsumption: number; // watts
}

export interface VentilationPath {
  id: string;
  startRoomId: string;
  endRoomId?: string; // null for exhaust to outside
  type: 'natural' | 'mechanical' | 'mixed';
  airflow: number; // CFM
  direction: CardinalDirection;
}

export interface HVACPlan {
  equipment: HVACEquipment[];
  ventilationPaths: VentilationPath[];
  coolingLoad: number; // tons
  heatingLoad?: number; // kW
  ventilationRate: number; // ACH (air changes per hour)
  freshAirPercentage: number;
  ductRoutes: PlumbingPipe[]; // reuse pipe geometry for ducts
}

// ============================================
// VASTU / ASTROLOGICAL
// ============================================

export interface VastuZone {
  direction: CardinalDirection;
  element: 'earth' | 'water' | 'fire' | 'air' | 'space';
  planet: string;
  deity: string;
  recommendedRooms: RoomType[];
  avoidRooms: RoomType[];
  colors: string[];
  materials: string[];
}

export interface VastuAnalysis {
  zones: VastuZone[];
  overallScore: number; // 0-100
  violations: VastuViolation[];
  recommendations: string[];
  entranceAuspicious: boolean;
  staircaseCompliant: boolean;
  kitchenCompliant: boolean;
  masterBedCompliant: boolean;
  toiletCompliant: boolean;
  poojaCompliant: boolean;
  waterElements: { direction: CardinalDirection; compliant: boolean }[];
}

export interface VastuViolation {
  id: string;
  severity: 'critical' | 'major' | 'minor' | 'advisory';
  room: string;
  issue: string;
  recommendation: string;
  direction: CardinalDirection;
}

// ============================================
// SUNLIGHT & ENVIRONMENT ANALYSIS
// ============================================

export interface SunlightAnalysis {
  latitude: number;
  longitude: number;
  timezone: string;
  solsticeAngles: {
    summer: { altitude: number; azimuth: number };
    winter: { altitude: number; azimuth: number };
  };
  roomSunlight: {
    roomId: string;
    hoursOfDirectSun: { summer: number; winter: number };
    naturalLightFactor: number; // 0-1
    glareRisk: boolean;
    uvExposure: 'low' | 'medium' | 'high';
  }[];
  shadowPatterns: {
    hour: number;
    month: number;
    shadowPolygon: { x: number; y: number }[];
  }[];
  recommendations: string[];
}

export interface AirflowAnalysis {
  prevailingWindDirection: CardinalDirection;
  windSpeed: number; // m/s average
  crossVentilationPaths: {
    inletRoom: string;
    outletRoom: string;
    effectiveness: number; // 0-1
  }[];
  stackVentilationPotential: number; // 0-1
  roomVentilation: {
    roomId: string;
    airChangesPerHour: number;
    adequacy: 'excellent' | 'good' | 'fair' | 'poor';
    recommendation: string;
  }[];
}

// ============================================
// SECTION & ELEVATION VIEWS
// ============================================

export type ViewType =
  | 'plan'
  | 'front_elevation'
  | 'rear_elevation'
  | 'left_elevation'
  | 'right_elevation'
  | 'section_AA'
  | 'section_BB'
  | 'cross_section';

export interface SectionLine {
  id: string;
  label: string;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  direction: 'horizontal' | 'vertical';
}

export interface ElevationView {
  type: ViewType;
  elements: ElevationElement[];
  dimensions: DimensionLine[];
  labels: TextLabel[];
  scale: number;
}

export interface ElevationElement {
  type:
    | 'wall'
    | 'window'
    | 'door'
    | 'roof'
    | 'slab'
    | 'column'
    | 'beam'
    | 'railing'
    | 'plinth'
    | 'foundation'
    | 'parapet';
  points: { x: number; y: number }[];
  fill?: string;
  stroke: string;
  lineWeight: number;
  hatch?: string;
}

export interface DimensionLine {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  value: string;
  offset: number;
  type: 'linear' | 'angular' | 'radius' | 'level';
}

export interface TextLabel {
  x: number;
  y: number;
  text: string;
  fontSize: number;
  rotation: number;
  anchor: 'start' | 'middle' | 'end';
}

// ============================================
// COLOR SCHEME & MATERIAL PALETTE
// ============================================

export interface ColorScheme {
  roomType: RoomType;
  wallColor: string;
  ceilingColor: string;
  floorColor: string;
  accentColor: string;
  vastuCompatible: boolean;
  direction?: CardinalDirection;
  mood: 'calm' | 'energetic' | 'warm' | 'cool' | 'neutral';
}

// ============================================
// COMPLETE HOUSE PLAN
// ============================================

export interface HousePlanProject {
  id: string;
  name: string;
  description: string;
  createdAt: Date;
  updatedAt: Date;

  // Site
  plot: PlotDimensions;
  orientation: SiteOrientation;
  constraints: SiteConstraints;
  location: { latitude: number; longitude: number; city: string; state: string; country: string };

  // Architectural
  floorPlans: FloorPlan[];
  roomSpecs: RoomSpec[];
  colorSchemes: ColorScheme[];

  // Structural
  structural: StructuralPlan;

  // MEP
  electrical: ElectricalPlan;
  plumbing: PlumbingPlan;
  hvac: HVACPlan;

  // Analysis
  vastu: VastuAnalysis;
  sunlight: SunlightAnalysis;
  airflow: AirflowAnalysis;

  // Views
  elevations: ElevationView[];
  sections: ElevationView[];
  sectionLines: SectionLine[];

  // Metadata
  designCode: string;
  buildingCode: string;
  status: 'draft' | 'in_progress' | 'review' | 'approved' | 'final';
}

// ============================================
// USER INPUT WIZARD STEPS
// ============================================

export type WizardStep =
  | 'plot_details'
  | 'orientation'
  | 'room_program'
  | 'preferences'
  | 'vastu_settings'
  | 'mep_requirements'
  | 'review'
  | 'generate';

export interface UserPreferences {
  style: 'modern' | 'traditional' | 'contemporary' | 'minimalist' | 'classical' | 'indo_western';
  budget: 'economy' | 'standard' | 'premium' | 'luxury';
  climate: 'hot_dry' | 'hot_humid' | 'composite' | 'cold' | 'temperate';
  orientation_priority: 'vastu' | 'sunlight' | 'views' | 'street';
  parking: 'covered' | 'open' | 'basement' | 'stilt';
  roofType: 'flat' | 'sloped' | 'hip' | 'gable' | 'butterfly';
  naturalLighting: 'maximum' | 'balanced' | 'minimal';
  privacy: 'high' | 'medium' | 'low';
  greenFeatures: boolean;
  smartHome: boolean;
  accessibilityRequired: boolean;
  vastuCompliance: 'strict' | 'moderate' | 'optional' | 'none';
}

// ============================================
// SPACE-SYNTAX GRAPH ANALYSIS (Phase C)
// ============================================

export interface GraphNode {
  room_id: string;
  room_type: string;
  acoustic_zone: string | null;
  connectivity: number;
  depth: number;
  integration: number;
  control_value: number;
}

export interface GraphEdge {
  source: string;
  target: string;
  weight: number;
  is_required_adjacency: boolean;
}

export interface SpaceSyntaxResult {
  nodes: GraphNode[];
  edges: GraphEdge[];
  mean_depth: number;
  max_depth: number;
  integration_mean: number;
  integration_variance: number;
  is_planar: boolean;
  depth_histogram: Record<string, number>;
  visibility_penalties: { room_id: string; penalty: number; reason: string }[];
  circulation_depth_rooms: string[];
}

// ============================================
// GA / POPULATION OPTIMIZATION (Phase D)
// ============================================

export interface GAConfig {
  population_size: number;
  max_generations: number;
  elite_count: number;
  tournament_size: number;
  crossover_rate: number;
  mutation_rate: number;
}

export interface GAResult {
  best_fitness: number;
  fitness_history: number[];
  converged: boolean;
  pareto_front_size: number;
}

// ============================================
// STRUCTURAL HANDOFF (Phase G)
// ============================================

export interface WallSegmentHandoff {
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

export interface CantileverRoom {
  room_id: string;
  max_overhang_m: number;
  direction: string;
  action: string;
}

export interface SlabPanel {
  room_id: string;
  lx_m: number;
  ly_m: number;
  ly_lx_ratio: number;
  slab_type: 'one_way' | 'two_way';
}

export interface StructuralHandoff {
  wall_segments: WallSegmentHandoff[];
  total_shared_walls: number;
  cantilever_rooms: CantileverRoom[];
  slab_panels: SlabPanel[];
  grid_module_m: number;
}

// ============================================
// MEP SCHEDULE (Phase G)
// ============================================

export interface PlumbingSchedule {
  wet_rooms: { room_id: string; room_type: string; needs_floor_drain: boolean; needs_water_supply: boolean }[];
  plumbing_stacks: string[][];
  total_stacks: number;
}

export interface ElectricalSchedule {
  power_schedule: { room_id: string; room_type: string; estimated_power_points: number; estimated_lighting_points: number }[];
  total_power_points: number;
  total_lighting_points: number;
}

export interface HVACSchedule {
  room_loads: { room_id: string; room_type: string; area_sqm: number; estimated_tonnage_tr: number }[];
  total_tonnage_tr: number;
  recommended_system: 'split' | 'centralised';
}

export interface MEPSchedule {
  plumbing: PlumbingSchedule;
  electrical: ElectricalSchedule;
  hvac: HVACSchedule;
}

// ============================================
// COMPLIANCE ITEM (Phase E)
// ============================================

export interface ComplianceItem {
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

// ============================================
// EXTENDED LAYOUT V2 RESPONSE (unified)
// ============================================

export interface LayoutV2ApiResponse {
  success: boolean;
  total_penalty: number;
  iteration_found: number;
  total_iterations: number;
  constraints_met_ratio: number;
  fsi_analysis: Record<string, unknown>;
  usable_boundary: { x: number; y: number; width: number; height: number; area_sqm: number };
  staircase: Record<string, unknown> | null;
  circulation: Record<string, unknown>;
  egress: Record<string, unknown>;
  structural_checks: Record<string, unknown>[];
  solar_scores: Record<string, unknown>[];
  fenestration_checks: Record<string, unknown>[];
  anthropometric_issues: string[];
  constraints_detail: Record<string, boolean>;
  compliance_items: ComplianceItem[];
  placements: PlacementApiResponse[];
  travel_distances: Record<string, unknown> | null;
  acoustic_buffers: Record<string, unknown>[] | null;
  structural_grid: Record<string, unknown> | null;
  sa_convergence: Record<string, unknown> | null;
  space_syntax: SpaceSyntaxResult | null;
  structural_handoff: StructuralHandoff | null;
  mep_schedule: MEPSchedule | null;
}

export interface PlacementApiResponse {
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

// ============================================
// GA OPTIMIZATION RESPONSE
// ============================================

export interface GAOptimizeResponse {
  success: boolean;
  best_fitness: number;
  fitness_history: number[];
  converged: boolean;
  pareto_front_size: number;
  placements: PlacementApiResponse[];
  compliance_items: ComplianceItem[];
  space_syntax: SpaceSyntaxResult | null;
  structural_handoff: StructuralHandoff | null;
  mep_schedule: MEPSchedule | null;
}
