/**
 * ============================================================================
 * CIVIL ENGINEERING MODULE - TYPE DEFINITIONS
 * ============================================================================
 * 
 * Comprehensive type definitions for all civil engineering modules
 * 
 * @version 1.0.0
 */

// =============================================================================
// COMMON TYPES
// =============================================================================

export type UnitSystem = 'SI' | 'Imperial';

export interface Material {
  name: string;
  E: number; // Young's modulus (Pa)
  G?: number; // Shear modulus (Pa)
  nu?: number; // Poisson's ratio
  density: number; // kg/m³
  fy?: number; // Yield strength (Pa)
  fu?: number; // Ultimate strength (Pa)
  fck?: number; // Characteristic compressive strength (Pa)
}

export interface Point2D {
  x: number;
  y: number;
}

export interface Point3D {
  x: number;
  y: number;
  z: number;
}

// =============================================================================
// STRUCTURAL ANALYSIS TYPES
// =============================================================================

export interface Node2D {
  id: number;
  x: number;
  y: number;
  constraints?: {
    dx: boolean;
    dy: boolean;
    rz: boolean;
  };
}

export interface Node3D {
  id: number;
  x: number;
  y: number;
  z: number;
  constraints?: {
    dx: boolean;
    dy: boolean;
    dz: boolean;
    rx: boolean;
    ry: boolean;
    rz: boolean;
  };
}

export interface Member2D {
  id: number;
  startNode: number;
  endNode: number;
  E: number; // Young's modulus (Pa)
  A: number; // Cross-sectional area (m²)
  I: number; // Moment of inertia (m⁴)
  releases?: {
    startMoment: boolean;
    endMoment: boolean;
  };
}

export interface TrussMember {
  id: number;
  startNode: number;
  endNode: number;
  E: number; // Young's modulus (Pa)
  A: number; // Cross-sectional area (m²)
}

export type SupportType = 'fixed' | 'pinned' | 'roller-x' | 'roller-y' | 'spring' | 'free';

export interface Support {
  nodeId: number;
  type: SupportType;
  springStiffness?: {
    kx?: number;
    ky?: number;
    krz?: number;
  };
}

export type LoadType = 'point' | 'distributed' | 'moment' | 'temperature';

export interface Load {
  type: LoadType;
  nodeId?: number;
  memberId?: number;
  value: number;
  direction?: 'x' | 'y' | 'z';
  position?: number; // For member loads (0 to 1)
}

export interface PointLoad {
  nodeId: number;
  fx: number;
  fy: number;
  mz?: number;
}

export interface DistributedLoad {
  memberId: number;
  w: number; // Load intensity (N/m or kN/m)
  type: 'uniform' | 'triangular' | 'trapezoidal';
  wEnd?: number; // End value for trapezoidal
}

export interface FrameAnalysisResult {
  displacements: number[];
  reactions: {
    nodeId: number;
    Rx: number;
    Ry: number;
    Mz?: number;
  }[];
  memberForces: {
    memberId: number;
    axialForce: number;
    shearForceStart: number;
    shearForceEnd: number;
    bendingMomentStart: number;
    bendingMomentEnd: number;
  }[];
}

export interface TrussAnalysisResult {
  displacements: number[];
  reactions: {
    nodeId: number;
    Rx: number;
    Ry: number;
  }[];
  memberForces: {
    memberId: number;
    axialForce: number;
    stress: number;
    type: 'tension' | 'compression' | 'zero';
  }[];
}

// =============================================================================
// GEOTECHNICAL TYPES
// =============================================================================

export interface SoilProperties {
  name: string;
  type: 'sand' | 'clay' | 'silt' | 'gravel' | 'rock' | 'organic' | 'mixed';
  unitWeight: number; // kN/m³
  saturatedUnitWeight: number; // kN/m³
  cohesion: number; // kPa
  frictionAngle: number; // degrees
  E: number; // Young's modulus (kPa)
  nu: number; // Poisson's ratio
  Cc?: number; // Compression index
  Cs?: number; // Swelling index
  e0?: number; // Initial void ratio
  OCR?: number; // Over-consolidation ratio
  permeability?: number; // m/s
  Gs?: number; // Specific gravity
  LL?: number; // Liquid limit (%)
  PL?: number; // Plastic limit (%)
}

export interface SoilLayer extends SoilProperties {
  id: number;
  depth: number; // Top of layer (m from surface)
  thickness: number; // m
}

export interface FoundationGeometry {
  type: 'strip' | 'square' | 'rectangular' | 'circular';
  width: number; // B (m)
  length?: number; // L (m) - for rectangular
  depth: number; // Df (m)
  embedmentDepth?: number;
}

export type BearingCapacityMethod = 'terzaghi' | 'meyerhof' | 'hansen' | 'vesic';

export interface BearingCapacityResult {
  method: BearingCapacityMethod;
  Nc: number;
  Nq: number;
  Ny: number;
  shapeFactors: { sc: number; sq: number; sy: number };
  depthFactors: { dc: number; dq: number; dy: number };
  inclinationFactors?: { ic: number; iq: number; iy: number };
  ultimateBearingCapacity: number; // kPa
  allowableBearingCapacity: number; // kPa
  factorOfSafety: number;
}

export interface SettlementResult {
  immediateSettlement: number; // mm
  consolidationSettlement: number; // mm
  secondarySettlement: number; // mm
  totalSettlement: number; // mm
  timeFor50Percent?: number; // days
  timeFor90Percent?: number; // days
}

export type SlopeStabilityMethod = 'infinite' | 'culmann' | 'fellenius' | 'bishop' | 'spencer';

export interface SlopeStabilityResult {
  method: SlopeStabilityMethod;
  factorOfSafety: number;
  criticalSlipSurface?: {
    type: 'planar' | 'circular' | 'non-circular';
    center?: Point2D;
    radius?: number;
    points?: Point2D[];
  };
  sliceData?: {
    weight: number;
    normalForce: number;
    shearForce: number;
    alpha: number;
  }[];
}

export interface EarthPressureResult {
  Ka: number; // Active coefficient
  Kp: number; // Passive coefficient
  K0: number; // At-rest coefficient
  activePressure: number[]; // kPa at different depths
  passivePressure: number[]; // kPa at different depths
  totalActiveForce: number; // kN/m
  totalPassiveForce: number; // kN/m
  pointOfApplication: number; // m from base
}

// =============================================================================
// HYDRAULICS TYPES
// =============================================================================

export type ChannelSectionType = 'rectangular' | 'trapezoidal' | 'triangular' | 'circular' | 'parabolic' | 'natural';

export interface ChannelSection {
  type: ChannelSectionType;
  bottomWidth?: number; // m
  sideSlope?: number; // horizontal:vertical
  diameter?: number; // m (for circular)
  topWidth?: number; // m (for parabolic)
}

export interface FlowParameters {
  discharge: number; // m³/s
  velocity?: number; // m/s
  depth?: number; // m
  slope: number; // m/m
  manningN: number;
}

export interface ChannelFlowResult {
  normalDepth: number; // m
  criticalDepth: number; // m
  velocity: number; // m/s
  froudeNumber: number;
  flowRegime: 'subcritical' | 'critical' | 'supercritical';
  area: number; // m²
  wettedPerimeter: number; // m
  hydraulicRadius: number; // m
  topWidth: number; // m
  hydraulicDepth: number; // m
  specificEnergy: number; // m
  specificForce: number; // m³
}

export interface PipeFlowResult {
  headLoss: number; // m
  velocity: number; // m/s
  reynoldsNumber: number;
  frictionFactor: number;
  flowRegime: 'laminar' | 'transitional' | 'turbulent';
  shearStress: number; // Pa
  discharge: number; // m³/s
}

export interface HydrologicResult {
  peakDischarge: number; // m³/s
  runoffVolume: number; // m³
  timeToPeak: number; // hours
  baseDuration: number; // hours
  unitHydrograph?: number[]; // ordinates
}

// =============================================================================
// TRANSPORTATION TYPES
// =============================================================================

export interface HighwayDesignParameters {
  designSpeed: number; // km/h
  terrain: 'level' | 'rolling' | 'mountainous';
  lanWidth: number; // m
  shoulderWidth: number; // m
  superelevation: number; // %
  grade: number; // %
}

export interface GeometricDesignResult {
  stoppingDistance: number; // m
  passingDistance: number; // m
  decisionDistance: number; // m
  minimumRadius: number; // m
  superelevationRunoff: number; // m
  spiralLength: number; // m
  kVertical: number;
}

export interface PavementDesignParameters {
  trafficCategory: 'low' | 'medium' | 'high' | 'very-high';
  designLife: number; // years
  cumulativeESALs: number;
  subgradeCBR: number; // %
  reliability: number; // %
}

export interface PavementDesignResult {
  totalThickness: number; // mm
  surfaceThickness: number; // mm
  baseThickness: number; // mm
  subbaseThickness: number; // mm
  structuralNumber?: number; // AASHTO
  designMethod: string;
}

export interface TrafficFlowParameters {
  volume: number; // vph
  density: number; // veh/km
  speed: number; // km/h
  capacity: number; // vph
}

export interface TrafficFlowResult {
  flowRate: number; // vph
  density: number; // veh/km
  speed: number; // km/h
  levelOfService: 'A' | 'B' | 'C' | 'D' | 'E' | 'F';
  volumeToCapacityRatio: number;
  delay?: number; // s/veh
}

// =============================================================================
// SURVEYING TYPES
// =============================================================================

export interface Coordinate {
  x: number; // Easting (m)
  y: number; // Northing (m)
  z?: number; // Elevation (m)
}

export interface GeographicCoordinate {
  latitude: number; // degrees
  longitude: number; // degrees
  height?: number; // m (ellipsoidal)
}

export interface TraverseStation {
  id: string;
  coordinates?: Coordinate;
  backsightAngle?: number; // degrees
  foresightAngle?: number; // degrees
  horizontalDistance?: number; // m
  elevationDifference?: number; // m
}

export interface TraverseResult {
  stations: (TraverseStation & { coordinates: Coordinate })[];
  linearMisclosure: number; // m
  angularMisclosure: number; // degrees or seconds
  precision: string; // e.g., "1:5000"
  area?: number; // m²
  adjustmentMethod: 'bowditch' | 'transit' | 'crandall';
}

export interface LevelingObservation {
  stationId: string;
  backsight?: number; // m
  foresight?: number; // m
  intermediateReading?: number; // m
  elevation?: number; // m
  description?: string;
}

export interface LevelingResult {
  stations: {
    id: string;
    elevation: number;
    heightOfInstrument?: number;
    rise?: number;
    fall?: number;
  }[];
  totalRise: number; // m
  totalFall: number; // m
  misclosure: number; // m
  adjustedMisclosure: number; // m
}

export interface CurveData {
  type: 'circular' | 'transition' | 'vertical';
  // Horizontal circular curve
  radius?: number; // m
  deflectionAngle?: number; // degrees
  tangentLength?: number; // m
  curveLength?: number; // m
  externalDistance?: number; // m
  middleOrdinate?: number; // m
  // Vertical curve
  g1?: number; // Entry grade (%)
  g2?: number; // Exit grade (%)
  length?: number; // m
  kValue?: number;
  highLowPoint?: number; // Station of high/low point
}

export interface EarthworkVolume {
  stationStart: number;
  stationEnd: number;
  cutVolume: number; // m³
  fillVolume: number; // m³
  netVolume: number; // m³ (positive = cut, negative = fill)
}

// =============================================================================
// VISUALIZATION TYPES
// =============================================================================

export interface DrawingStyle {
  stroke: string;
  strokeWidth: number;
  fill?: string;
  dashArray?: string;
  opacity?: number;
}

export interface DrawingElement {
  type: 'line' | 'polyline' | 'polygon' | 'circle' | 'arc' | 'text' | 'path';
  points?: Point2D[];
  center?: Point2D;
  radius?: number;
  text?: string;
  style: DrawingStyle;
}

export interface DiagramData {
  type: 'bmd' | 'sfd' | 'afd' | 'deflected' | 'influence';
  values: { x: number; value: number }[];
  maxValue: number;
  minValue: number;
  scale: number;
}

export interface VisualizationConfig {
  width: number;
  height: number;
  scale: number;
  offset: Point2D;
  showGrid: boolean;
  showDimensions: boolean;
  showLabels: boolean;
  theme: 'light' | 'dark';
}
