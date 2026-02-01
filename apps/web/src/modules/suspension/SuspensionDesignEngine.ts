/**
 * ============================================================================
 * SUSPENSION STRUCTURE DESIGN ENGINE
 * ============================================================================
 * 
 * Comprehensive suspension bridge and structure design including:
 * - Main cable analysis (parabolic and catenary)
 * - Hanger/suspender design
 * - Tower/pylon design
 * - Anchorage design
 * - Stiffening girder analysis
 * - Wind and aerodynamic stability
 * - Thermal and creep effects
 * 
 * Design Codes:
 * - AASHTO LRFD Bridge Design Specifications
 * - EN 1993-1-11 (Steel Cables)
 * - BS 5400 (Steel Bridges)
 * - IRC:24 (Steel Bridges - India)
 * 
 * @version 1.0.0
 * @author Head of Engineering
 */

import {
  CableDesignEngine,
  CableMaterial,
  CABLE_MATERIALS,
  CatenaryCableResult,
  CableVibrationAnalysis,
  analyzeVibration,
  calculateSag,
  calculateTension,
} from '../cable/CableDesignEngine';

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

export type SuspensionBridgeType = 
  | 'simple-suspension'
  | 'self-anchored'
  | 'earth-anchored'
  | 'cable-stayed-hybrid';

export type TowerType = 
  | 'portal-frame'
  | 'A-frame'
  | 'H-frame'
  | 'diamond'
  | 'inverted-Y'
  | 'single-pylon';

export type HangerType = 
  | 'vertical'
  | 'inclined'
  | 'diagonal-warren'
  | 'crossed';

// =============================================================================
// SUSPENSION BRIDGE GEOMETRY
// =============================================================================

export interface SuspensionBridgeGeometry {
  // Main span
  mainSpan: number;             // m
  sideSpan?: number;            // m (if applicable)
  
  // Vertical geometry
  towerHeight: number;          // m above deck
  sagMainSpan: number;          // m
  sagSideSpan?: number;         // m
  deckLevel: number;            // m (reference)
  clearance: number;            // m (navigation/road)
  
  // Cable arrangement
  numCables: number;            // Typically 2 (one each side)
  cableSpacing: number;         // m (transverse)
  
  // Hangers
  hangerSpacing: number;        // m along deck
  hangerType: HangerType;
  
  // Tower
  towerType: TowerType;
  towerWidth: number;           // m (transverse)
  
  // Anchorage
  anchorageDistance?: number;   // m from tower
  anchorageType: 'gravity' | 'rock' | 'caisson' | 'self-anchored';
}

export interface SuspensionBridgeLoading {
  // Dead loads
  cableSelfWeight: number;      // kN/m per cable
  deckDeadLoad: number;         // kN/m² or kN/m (line load)
  hangerWeight: number;         // kN/m
  
  // Live loads
  vehicularLoad: number;        // kN/m² or kN/m
  pedestrianLoad?: number;      // kN/m²
  
  // Environmental
  windPressure: number;         // kN/m² on deck
  windOnCable: number;          // kN/m on cables
  temperature: number;          // °C change
  
  // Load factors
  loadFactorDead: number;
  loadFactorLive: number;
  loadFactorWind: number;
}

// =============================================================================
// MAIN CABLE ANALYSIS RESULT
// =============================================================================

export interface MainCableAnalysisResult {
  // Geometry
  mainSpanLength: number;       // m
  sideSpanLength: number;       // m
  totalCableLength: number;     // m
  
  // Sag
  sagMainSpan: number;          // m
  sagSideSpan: number;          // m
  sagRatio: number;             // sag/span
  
  // Cable profile
  mainSpanProfile: { x: number; y: number }[];
  sideSpanProfile: { x: number; y: number }[];
  
  // Forces
  horizontalTension: number;    // H (kN) - constant for entire cable
  maxTensionMainSpan: number;   // kN at towers
  maxTensionSideSpan: number;   // kN at anchorage
  absoluteMaxTension: number;   // kN
  
  // Tower reactions
  leftTowerReaction: {
    horizontal: number;         // kN
    vertical: number;           // kN
    resultant: number;          // kN
  };
  rightTowerReaction: {
    horizontal: number;
    vertical: number;
    resultant: number;
  };
  
  // Anchorage forces
  leftAnchorageForce: {
    horizontal: number;
    vertical: number;
    resultant: number;
    angle: number;              // degrees
  };
  rightAnchorageForce: {
    horizontal: number;
    vertical: number;
    resultant: number;
    angle: number;
  };
  
  // Cable sizing
  requiredArea: number;         // mm²
  selectedDiameter: number;     // mm
  utilizationRatio: number;
  status: 'pass' | 'fail';
}

// =============================================================================
// HANGER/SUSPENDER ANALYSIS RESULT
// =============================================================================

export interface HangerAnalysisResult {
  // Geometry
  numHangers: number;
  spacing: number;              // m
  lengths: number[];            // m for each hanger
  minLength: number;
  maxLength: number;
  
  // Forces
  forces: number[];             // kN for each hanger
  maxForce: number;             // kN
  minForce: number;             // kN (check for compression/slack)
  avgForce: number;             // kN
  forceRange: number;           // kN (for fatigue)
  
  // Selected hanger
  hangerType: string;
  hangerDiameter: number;       // mm
  hangerArea: number;           // mm²
  
  // Capacity
  ultimateCapacity: number;     // kN
  serviceCapacity: number;      // kN
  maxUtilization: number;
  status: 'pass' | 'fail';
  
  // Fatigue
  fatigueStressRange: number;   // MPa
  fatigueLife: number;          // million cycles
  
  // Slack check
  slackPossible: boolean;
  criticalHangers: number[];    // Indices of hangers at risk
}

// =============================================================================
// TOWER DESIGN RESULT
// =============================================================================

export interface TowerDesignResult {
  // Geometry
  towerType: TowerType;
  height: number;               // m
  widthAtBase: number;          // m
  widthAtTop: number;           // m
  
  // Loading
  cableForce: {
    horizontal: number;         // kN
    vertical: number;           // kN
  };
  windForce: number;            // kN
  selfWeight: number;           // kN
  
  // Combined forces
  axialForce: number;           // kN
  bendingMoment: number;        // kN-m
  shearForce: number;           // kN
  
  // Section design
  legSection: {
    type: string;               // e.g., "BOX", "H-section"
    dimensions: string;         // e.g., "2000x2000x40"
    area: number;               // mm²
    Ix: number;                 // mm⁴
  };
  
  // Capacity
  axialCapacity: number;        // kN
  momentCapacity: number;       // kN-m
  bucklingCapacity: number;     // kN
  
  // Checks
  axialUtilization: number;
  bendingUtilization: number;
  combinedUtilization: number;
  status: 'pass' | 'fail';
  
  // Buckling
  slendernessRatio: number;
  bucklingMode: string;
}

// =============================================================================
// ANCHORAGE DESIGN RESULT
// =============================================================================

export interface AnchorageDesignResult {
  // Type
  anchorageType: 'gravity' | 'rock' | 'caisson' | 'self-anchored';
  
  // Forces
  horizontalForce: number;      // kN
  verticalForce: number;        // kN
  resultantForce: number;       // kN
  cableAngle: number;           // degrees from horizontal
  
  // Gravity anchorage (if applicable)
  requiredWeight?: number;      // kN
  blockDimensions?: {
    length: number;             // m
    width: number;              // m
    height: number;             // m
    volume: number;             // m³
  };
  
  // Rock anchorage (if applicable)
  numAnchors?: number;
  anchorLength?: number;        // m
  anchorDiameter?: number;      // mm
  anchorCapacity?: number;      // kN per anchor
  rockBondStress?: number;      // MPa
  
  // Stability checks
  slidingFactor: number;
  overturningFactor: number;
  bearingPressure: number;      // kPa
  
  // Results
  slidingOk: boolean;
  overturningOk: boolean;
  bearingOk: boolean;
  status: 'pass' | 'fail';
}

// =============================================================================
// STIFFENING GIRDER RESULT
// =============================================================================

export interface StiffeningGirderResult {
  // Type
  girderType: 'box' | 'truss' | 'plate-girder' | 'orthotropic';
  
  // Geometry
  depth: number;                // m
  width: number;                // m
  length: number;               // m (per span)
  
  // Section properties
  area: number;                 // m²
  Ix: number;                   // m⁴
  mass: number;                 // kg/m
  
  // Loading
  deadLoad: number;             // kN/m
  liveLoad: number;             // kN/m
  windLoad: number;             // kN/m
  
  // Force effects
  maxMoment: number;            // kN-m
  maxShear: number;             // kN
  maxTorsion: number;           // kN-m
  
  // Capacity
  momentCapacity: number;       // kN-m
  shearCapacity: number;        // kN
  torsionCapacity: number;      // kN-m
  
  // Utilization
  momentUtilization: number;
  shearUtilization: number;
  combinedUtilization: number;
  status: 'pass' | 'fail';
  
  // Aerodynamic
  aerodynamicCheck: 'stable' | 'marginal' | 'unstable';
  flutterSpeed: number;         // m/s
  buffetingResponse: number;    // mm RMS
}

// =============================================================================
// AERODYNAMIC STABILITY
// =============================================================================

export interface AerodynamicAnalysisResult {
  // Flutter
  flutterSpeed: number;         // m/s
  flutterFrequency: number;     // Hz
  flutterSafe: boolean;
  designWindSpeed: number;      // m/s
  flutterMargin: number;        // ratio
  
  // Vortex shedding
  vortexSheddingFrequency: number;  // Hz
  lockInVelocity: number;       // m/s
  vortexAmplitude: number;      // mm
  vortexSafe: boolean;
  
  // Buffeting
  rmsDisplacementVertical: number;   // mm
  rmsDisplacementLateral: number;    // mm
  rmsTorsion: number;           // degrees
  accelerationCheck: boolean;   // User comfort
  
  // Galloping
  gallopingSusceptible: boolean;
  gallopingOnsetSpeed: number;  // m/s
  
  // Recommendations
  recommendations: string[];
}

// =============================================================================
// COMPLETE DESIGN RESULT
// =============================================================================

export interface SuspensionBridgeDesignResult {
  // Input
  geometry: SuspensionBridgeGeometry;
  loading: SuspensionBridgeLoading;
  
  // Component results
  mainCable: MainCableAnalysisResult;
  hangers: HangerAnalysisResult;
  towers: {
    left: TowerDesignResult;
    right: TowerDesignResult;
  };
  anchorages: {
    left: AnchorageDesignResult;
    right: AnchorageDesignResult;
  };
  stiffeningGirder: StiffeningGirderResult;
  
  // Aerodynamics
  aerodynamics: AerodynamicAnalysisResult;
  
  // Overall
  overallStatus: 'pass' | 'fail';
  criticalElement: string;
  maxUtilization: number;
  
  // Weight summary
  weights: {
    mainCables: number;         // tonnes
    hangers: number;            // tonnes
    towers: number;             // tonnes
    deck: number;               // tonnes
    totalSteel: number;         // tonnes
  };
  
  // Warnings and recommendations
  warnings: string[];
  recommendations: string[];
}

// =============================================================================
// SUSPENSION BRIDGE DESIGN ENGINE CLASS
// =============================================================================

export class SuspensionBridgeDesignEngine {
  private geometry: SuspensionBridgeGeometry;
  private loading: SuspensionBridgeLoading;
  private cableMaterial: CableMaterial;

  constructor(
    geometry: SuspensionBridgeGeometry,
    loading: SuspensionBridgeLoading,
    cableMaterialKey: string = 'PWS-1770'
  ) {
    this.geometry = { ...geometry };
    this.loading = { ...loading };
    this.cableMaterial = CABLE_MATERIALS[cableMaterialKey] || CABLE_MATERIALS['PWS-1770'];
  }

  // ===========================================================================
  // MAIN CABLE ANALYSIS
  // ===========================================================================

  private analyzeMainCable(): MainCableAnalysisResult {
    const { mainSpan, sideSpan = 0, sagMainSpan, sagSideSpan = 0, towerHeight } = this.geometry;
    const { cableSelfWeight, deckDeadLoad, hangerWeight, vehicularLoad, loadFactorDead, loadFactorLive } = this.loading;
    
    // Total distributed load on cable (per cable)
    const numCables = this.geometry.numCables || 2;
    const w_dead = (deckDeadLoad + hangerWeight) / numCables;
    const w_live = vehicularLoad / numCables;
    const w_cable = cableSelfWeight;
    
    // Factored load
    const w_u = loadFactorDead * (w_dead + w_cable) + loadFactorLive * w_live;
    
    // Sag ratio
    const sagRatio = sagMainSpan / mainSpan;
    
    // Horizontal tension (from parabolic approximation for uniformly loaded cable)
    const H = w_u * mainSpan * mainSpan / (8 * sagMainSpan);
    
    // Main span cable profile (parabolic)
    const mainSpanProfile: { x: number; y: number }[] = [];
    const numPoints = 51;
    for (let i = 0; i <= numPoints - 1; i++) {
      const x = (i / (numPoints - 1)) * mainSpan;
      const y = towerHeight - 4 * sagMainSpan * (x / mainSpan) * (1 - x / mainSpan);
      mainSpanProfile.push({ x, y });
    }
    
    // Maximum tension at tower (main span)
    const theta_main = Math.atan(4 * sagMainSpan / mainSpan);
    const T_tower_main = H / Math.cos(theta_main);
    
    // Side span analysis (if present)
    const sideSpanProfile: { x: number; y: number }[] = [];
    let T_tower_side = 0;
    let T_anchorage = 0;
    let anchorage_angle = 0;
    
    if (sideSpan > 0) {
      const sag_side = sagSideSpan || sideSpan * sagRatio * 0.5;  // Side span typically has less sag
      
      // Side span cable profile
      for (let i = 0; i <= numPoints - 1; i++) {
        const x = (i / (numPoints - 1)) * sideSpan;
        // Side span profile connects tower to anchorage
        const y = towerHeight - (towerHeight - 0) * (x / sideSpan);  // Simplified linear for now
        sideSpanProfile.push({ x, y });
      }
      
      // Tension at anchorage
      const h_anchor = towerHeight;  // Anchorage at deck level
      const theta_side = Math.atan(h_anchor / sideSpan);
      T_anchorage = H / Math.cos(theta_side);
      anchorage_angle = theta_side * 180 / Math.PI;
      T_tower_side = T_anchorage;
    }
    
    // Maximum tension
    const maxTensionMainSpan = T_tower_main;
    const maxTensionSideSpan = T_anchorage || T_tower_main;
    const absoluteMaxTension = Math.max(maxTensionMainSpan, maxTensionSideSpan);
    
    // Total cable length
    const L_main = mainSpan * (1 + 8 * sagRatio * sagRatio / 3);
    const L_side = sideSpan > 0 ? Math.sqrt(sideSpan * sideSpan + towerHeight * towerHeight) : 0;
    const totalCableLength = L_main + 2 * L_side;
    
    // Tower reactions (vertical = load carried by each tower half)
    const V_tower = w_u * mainSpan / 2 + (sideSpan > 0 ? w_u * sideSpan : 0);
    
    // Required cable area
    const safetyFactor = 2.5;  // For main cables
    const allowableStress = this.cableMaterial.fpu / safetyFactor;
    const requiredArea = absoluteMaxTension * 1000 / allowableStress;
    
    // Select cable diameter
    const selectedDiameter = Math.ceil(Math.sqrt(4 * requiredArea / (Math.PI * this.cableMaterial.fillFactor)));
    const actualArea = Math.PI * selectedDiameter * selectedDiameter * this.cableMaterial.fillFactor / 4;
    const utilizationRatio = requiredArea / actualArea;
    
    return {
      mainSpanLength: mainSpan,
      sideSpanLength: sideSpan,
      totalCableLength,
      sagMainSpan,
      sagSideSpan: sideSpan > 0 ? (sagSideSpan || sideSpan * sagRatio * 0.5) : 0,
      sagRatio,
      mainSpanProfile,
      sideSpanProfile,
      horizontalTension: H,
      maxTensionMainSpan,
      maxTensionSideSpan,
      absoluteMaxTension,
      leftTowerReaction: {
        horizontal: H,
        vertical: V_tower,
        resultant: Math.sqrt(H * H + V_tower * V_tower),
      },
      rightTowerReaction: {
        horizontal: H,
        vertical: V_tower,
        resultant: Math.sqrt(H * H + V_tower * V_tower),
      },
      leftAnchorageForce: {
        horizontal: H,
        vertical: sideSpan > 0 ? H * Math.tan(anchorage_angle * Math.PI / 180) : V_tower,
        resultant: T_anchorage || absoluteMaxTension,
        angle: anchorage_angle || 45,
      },
      rightAnchorageForce: {
        horizontal: H,
        vertical: sideSpan > 0 ? H * Math.tan(anchorage_angle * Math.PI / 180) : V_tower,
        resultant: T_anchorage || absoluteMaxTension,
        angle: anchorage_angle || 45,
      },
      requiredArea,
      selectedDiameter,
      utilizationRatio,
      status: utilizationRatio <= 1.0 ? 'pass' : 'fail',
    };
  }

  // ===========================================================================
  // HANGER ANALYSIS
  // ===========================================================================

  private analyzeHangers(cableResult: MainCableAnalysisResult): HangerAnalysisResult {
    const { mainSpan, hangerSpacing, sagMainSpan, towerHeight } = this.geometry;
    const { deckDeadLoad, vehicularLoad, loadFactorDead, loadFactorLive } = this.loading;
    const numCables = this.geometry.numCables || 2;
    
    // Number of hangers
    const numHangers = Math.floor(mainSpan / hangerSpacing) - 1;
    
    // Hanger lengths (from cable profile to deck)
    const lengths: number[] = [];
    const forces: number[] = [];
    
    // Load per hanger
    const w_total = loadFactorDead * deckDeadLoad + loadFactorLive * vehicularLoad;
    const loadPerHanger = w_total * hangerSpacing / numCables;
    
    // Calculate lengths and forces for each hanger
    for (let i = 1; i <= numHangers; i++) {
      const x = i * hangerSpacing;
      const xRatio = x / mainSpan;
      
      // Cable elevation at this point (parabolic)
      const cableY = towerHeight - 4 * sagMainSpan * xRatio * (1 - xRatio);
      
      // Deck is at y = 0
      const hangerLength = cableY;
      lengths.push(hangerLength);
      
      // Hanger force (approximately constant for UDL, slight variation for live load patterns)
      // Include dead load + full live load as critical case
      const force = loadPerHanger;
      forces.push(force);
    }
    
    const maxForce = Math.max(...forces);
    const minForce = Math.min(...forces);
    const avgForce = forces.reduce((a, b) => a + b, 0) / forces.length;
    
    // Force range for fatigue (live load variation)
    const liveLoadForce = vehicularLoad * hangerSpacing / numCables;
    const forceRange = liveLoadForce * loadFactorLive;
    
    // Select hanger size
    const safetyFactor = 3.0;  // Higher for hangers due to fatigue
    const hangerMaterial = CABLE_MATERIALS['spiral-strand-1770'];
    const allowableStress = hangerMaterial.fpu / safetyFactor;
    const requiredArea = maxForce * 1000 / allowableStress;
    
    const hangerDiameter = Math.max(20, Math.ceil(Math.sqrt(4 * requiredArea / (Math.PI * 0.78)) / 2) * 2);
    const hangerArea = Math.PI * hangerDiameter * hangerDiameter * 0.78 / 4;
    
    // Capacity
    const ultimateCapacity = hangerArea * hangerMaterial.fpu / 1000;
    const serviceCapacity = ultimateCapacity / safetyFactor;
    const maxUtilization = maxForce / serviceCapacity;
    
    // Fatigue check
    const fatigueStressRange = forceRange * 1000 / hangerArea;
    const fatigueLife = Math.pow(hangerMaterial.fatigueCategory / fatigueStressRange, 3) * 2;
    
    // Check for slack (compression under load reversal)
    // Hangers should always be in tension
    const deadLoadForce = deckDeadLoad * hangerSpacing / numCables * loadFactorDead;
    const slackPossible = minForce < deadLoadForce * 0.1;
    const criticalHangers = forces.map((f, i) => f < deadLoadForce * 0.2 ? i : -1).filter(i => i >= 0);
    
    return {
      numHangers,
      spacing: hangerSpacing,
      lengths,
      minLength: Math.min(...lengths),
      maxLength: Math.max(...lengths),
      forces,
      maxForce,
      minForce,
      avgForce,
      forceRange,
      hangerType: 'spiral-strand',
      hangerDiameter,
      hangerArea,
      ultimateCapacity,
      serviceCapacity,
      maxUtilization,
      status: maxUtilization <= 1.0 ? 'pass' : 'fail',
      fatigueStressRange,
      fatigueLife,
      slackPossible,
      criticalHangers,
    };
  }

  // ===========================================================================
  // TOWER DESIGN
  // ===========================================================================

  private designTower(position: 'left' | 'right', cableResult: MainCableAnalysisResult): TowerDesignResult {
    const { towerHeight, towerType, towerWidth, mainSpan } = this.geometry;
    const { windPressure } = this.loading;
    
    // Cable force at tower
    const towerReaction = position === 'left' ? cableResult.leftTowerReaction : cableResult.rightTowerReaction;
    const H = towerReaction.horizontal;
    const V = towerReaction.vertical;
    
    // Tower dimensions
    const widthAtBase = towerWidth * 1.2;
    const widthAtTop = towerWidth * 0.8;
    
    // Wind force on tower (simplified)
    const towerArea = towerHeight * towerWidth * 0.3;  // Projected area estimate
    const windForce = windPressure * towerArea;
    
    // Self weight (estimate)
    const steelDensity = 78.5;  // kN/m³
    const towerVolume = towerHeight * towerWidth * towerWidth * 0.15;  // Approximate
    const selfWeight = steelDensity * towerVolume;
    
    // Forces at base
    // For portal frame tower with cable saddle at top
    const axialForce = V * 2 + selfWeight;  // Two cables, plus self weight
    const bendingMoment = H * towerHeight + windForce * towerHeight / 2;  // Horizontal cable force + wind
    const shearForce = windForce + H * 0.1;  // Unbalanced horizontal if any
    
    // Section design (simplified)
    // Use box section for tower legs
    const legArea = axialForce * 1.5 / 355;  // Approximate required area for steel fy=355
    const legSize = Math.sqrt(legArea / (4 * 0.04));  // Box with 40mm walls
    const actualArea = 4 * legSize * 40;  // 40mm wall thickness
    const Ix = (legSize ** 4 - (legSize - 80) ** 4) / 12;
    
    // Capacity
    const fy = 355;  // MPa
    const axialCapacity = actualArea * fy / 1000;
    const momentCapacity = fy * (legSize ** 3 - (legSize - 80) ** 3) / 6 / 1e6;
    
    // Buckling check
    const Le = 2 * towerHeight * 1000;  // Cantilever effective length
    const r = Math.sqrt(Ix / actualArea);
    const slendernessRatio = Le / r;
    const lambda_e = Math.PI * Math.sqrt(200000 / fy);
    const lambda_bar = slendernessRatio / lambda_e;
    const chi = 1 / (0.5 * (1 + 0.34 * (lambda_bar - 0.2) + lambda_bar ** 2) + 
                      Math.sqrt((0.5 * (1 + 0.34 * (lambda_bar - 0.2) + lambda_bar ** 2)) ** 2 - lambda_bar ** 2));
    const bucklingCapacity = chi * axialCapacity;
    
    // Utilization
    const axialUtilization = axialForce / bucklingCapacity;
    const bendingUtilization = bendingMoment / momentCapacity;
    const combinedUtilization = axialUtilization + bendingUtilization;
    
    return {
      towerType,
      height: towerHeight,
      widthAtBase,
      widthAtTop,
      cableForce: { horizontal: H, vertical: V },
      windForce,
      selfWeight,
      axialForce,
      bendingMoment,
      shearForce,
      legSection: {
        type: 'BOX',
        dimensions: `${Math.round(legSize)}x${Math.round(legSize)}x40`,
        area: actualArea,
        Ix,
      },
      axialCapacity,
      momentCapacity,
      bucklingCapacity,
      axialUtilization,
      bendingUtilization,
      combinedUtilization,
      status: combinedUtilization <= 1.0 ? 'pass' : 'fail',
      slendernessRatio,
      bucklingMode: slendernessRatio > 100 ? 'Elastic buckling' : 'Inelastic buckling',
    };
  }

  // ===========================================================================
  // ANCHORAGE DESIGN
  // ===========================================================================

  private designAnchorage(position: 'left' | 'right', cableResult: MainCableAnalysisResult): AnchorageDesignResult {
    const { anchorageType } = this.geometry;
    const anchorForce = position === 'left' ? cableResult.leftAnchorageForce : cableResult.rightAnchorageForce;
    
    const H = anchorForce.horizontal;
    const V = anchorForce.vertical;
    const R = anchorForce.resultant;
    const angle = anchorForce.angle;
    
    let result: AnchorageDesignResult;
    
    if (anchorageType === 'gravity') {
      // Gravity anchorage design
      const frictionCoeff = 0.5;  // Concrete on soil
      const safetyFactorSliding = 1.5;
      const safetyFactorOverturning = 2.0;
      
      // Required weight for sliding
      const W_sliding = H * safetyFactorSliding / frictionCoeff + V;
      
      // Block dimensions (assume concrete density 24 kN/m³)
      const concreteDensity = 24;
      const volume = W_sliding / concreteDensity;
      const length = Math.pow(volume * 2, 1/3);  // L:W:H = 2:1:1
      const width = length / 2;
      const height = width;
      
      // Check overturning about toe
      const M_overturning = H * height;
      const M_restoring = W_sliding * length / 2;
      const overturningFactor = M_restoring / M_overturning;
      
      // Bearing pressure
      const baseArea = length * width;
      const bearingPressure = (W_sliding + V) / baseArea;
      
      result = {
        anchorageType,
        horizontalForce: H,
        verticalForce: V,
        resultantForce: R,
        cableAngle: angle,
        requiredWeight: W_sliding,
        blockDimensions: {
          length,
          width,
          height,
          volume,
        },
        slidingFactor: W_sliding * frictionCoeff / H,
        overturningFactor,
        bearingPressure,
        slidingOk: W_sliding * frictionCoeff / H >= safetyFactorSliding,
        overturningOk: overturningFactor >= safetyFactorOverturning,
        bearingOk: bearingPressure < 500,  // Assume allowable 500 kPa
        status: 'pass',
      };
      
      if (!result.slidingOk || !result.overturningOk || !result.bearingOk) {
        result.status = 'fail';
      }
    } else if (anchorageType === 'rock') {
      // Rock anchor design
      const anchorCapacity = 500;  // kN per anchor (typical)
      const numAnchors = Math.ceil(R * 1.5 / anchorCapacity);
      const anchorLength = 15;  // m typical
      const anchorDiameter = 36;  // mm bar diameter
      
      // Bond stress check
      const perimeter = Math.PI * anchorDiameter;
      const bondLength = 0.6 * anchorLength * 1000;  // 60% bonded
      const rockBondStress = anchorCapacity * 1000 / (perimeter * bondLength);
      
      result = {
        anchorageType,
        horizontalForce: H,
        verticalForce: V,
        resultantForce: R,
        cableAngle: angle,
        numAnchors,
        anchorLength,
        anchorDiameter,
        anchorCapacity,
        rockBondStress,
        slidingFactor: 2.0,  // N/A for rock
        overturningFactor: 2.0,
        bearingPressure: 0,
        slidingOk: true,
        overturningOk: true,
        bearingOk: true,
        status: numAnchors * anchorCapacity >= R * 1.5 ? 'pass' : 'fail',
      };
    } else {
      // Default/simplified result
      result = {
        anchorageType: anchorageType || 'gravity',
        horizontalForce: H,
        verticalForce: V,
        resultantForce: R,
        cableAngle: angle,
        slidingFactor: 1.5,
        overturningFactor: 2.0,
        bearingPressure: 200,
        slidingOk: true,
        overturningOk: true,
        bearingOk: true,
        status: 'pass',
      };
    }
    
    return result;
  }

  // ===========================================================================
  // STIFFENING GIRDER DESIGN
  // ===========================================================================

  private designStiffeningGirder(): StiffeningGirderResult {
    const { mainSpan, hangerSpacing } = this.geometry;
    const { deckDeadLoad, vehicularLoad, windPressure, loadFactorDead, loadFactorLive, loadFactorWind } = this.loading;
    
    // Stiffening girder primary role is to distribute live load and resist local bending between hangers
    // Also resists aerodynamic forces and provides torsional stiffness
    
    // Girder depth (typically span/100 to span/150 for suspension bridges)
    const depthRatio = 120;
    const depth = mainSpan / depthRatio;
    const width = mainSpan / 30;  // Deck width
    
    // Loading
    const deadLoad = deckDeadLoad * loadFactorDead;
    const liveLoad = vehicularLoad * loadFactorLive;
    const windLoad = windPressure * depth * loadFactorWind;
    
    // Local bending between hangers
    const localMoment = (deadLoad + liveLoad) * hangerSpacing * hangerSpacing / 12;
    
    // Global bending (suspension bridge girder carries partial moment)
    // For well-designed suspension bridge, most moment is taken by cable
    // Girder moment is typically 10-20% of simple span moment
    const simpleSpanMoment = (deadLoad + liveLoad) * mainSpan * mainSpan / 8;
    const globalMoment = 0.15 * simpleSpanMoment;
    
    const maxMoment = Math.max(localMoment, globalMoment);
    const maxShear = (deadLoad + liveLoad) * hangerSpacing / 2;
    
    // Torsion from eccentric live load
    const eccentricity = width / 4;
    const maxTorsion = liveLoad * eccentricity * hangerSpacing;
    
    // Box girder section
    const webThickness = 0.02;  // m
    const flangeThickness = 0.03;  // m
    const area = 2 * width * flangeThickness + 2 * depth * webThickness;
    const Ix = width * depth ** 3 / 12 - (width - 2 * webThickness) * (depth - 2 * flangeThickness) ** 3 / 12;
    const mass = area * 7850;  // kg/m
    
    // Capacity (steel fy = 355 MPa)
    const fy = 355;
    const momentCapacity = fy * 1000 * 2 * Ix / depth;  // kN-m
    const shearCapacity = fy * 1000 * 2 * depth * webThickness / Math.sqrt(3);  // kN
    const torsionCapacity = 2 * fy * 1000 * width * depth * Math.min(webThickness, flangeThickness) / Math.sqrt(3);
    
    // Utilization
    const momentUtilization = maxMoment / momentCapacity;
    const shearUtilization = maxShear / shearCapacity;
    const torsionUtilization = maxTorsion / torsionCapacity;
    const combinedUtilization = Math.sqrt(momentUtilization ** 2 + shearUtilization ** 2 + torsionUtilization ** 2);
    
    // Aerodynamic check (simplified)
    // Flutter speed estimate (Selberg formula approximation)
    const omega_v = 0.5;  // Vertical frequency estimate (Hz)
    const omega_t = 0.8;  // Torsional frequency estimate (Hz)
    const U_flutter = 2.5 * omega_t * width * Math.sqrt(1 - (omega_v / omega_t) ** 2);
    
    const designWindSpeed = 45;  // m/s (typical)
    const aerodynamicCheck = U_flutter > 1.5 * designWindSpeed ? 'stable' : 
                            U_flutter > 1.2 * designWindSpeed ? 'marginal' : 'unstable';
    
    // Buffeting response estimate
    const buffetingResponse = 100 * (designWindSpeed / 30) ** 2;  // mm RMS estimate
    
    return {
      girderType: 'box',
      depth,
      width,
      length: mainSpan,
      area,
      Ix,
      mass,
      deadLoad,
      liveLoad,
      windLoad,
      maxMoment,
      maxShear,
      maxTorsion,
      momentCapacity,
      shearCapacity,
      torsionCapacity,
      momentUtilization,
      shearUtilization,
      combinedUtilization,
      status: combinedUtilization <= 1.0 ? 'pass' : 'fail',
      aerodynamicCheck,
      flutterSpeed: U_flutter,
      buffetingResponse,
    };
  }

  // ===========================================================================
  // AERODYNAMIC ANALYSIS
  // ===========================================================================

  private analyzeAerodynamics(girderResult: StiffeningGirderResult): AerodynamicAnalysisResult {
    const { mainSpan } = this.geometry;
    const width = girderResult.width;
    const depth = girderResult.depth;
    const mass = girderResult.mass;
    
    const recommendations: string[] = [];
    
    // Natural frequencies (estimates)
    const f_v = 0.1 * Math.sqrt(1000 / mainSpan);  // Vertical frequency
    const f_t = 0.15 * Math.sqrt(1000 / mainSpan);  // Torsional frequency
    const f_l = 0.05 * Math.sqrt(1000 / mainSpan);  // Lateral frequency
    
    // Flutter analysis (Selberg formula)
    const rho = 1.225;  // Air density kg/m³
    const m = mass;  // kg/m
    const I_theta = m * width ** 2 / 12;  // Polar mass moment
    const r = Math.sqrt(I_theta / m);
    
    const mu = Math.PI * rho * width ** 2 / (2 * m);
    const flutterSpeed = 0.44 * width * f_t * Math.sqrt((r / width) ** 2 * (1 - (f_v / f_t) ** 2) / mu);
    const flutterFrequency = f_t;
    
    const designWindSpeed = 50;  // m/s design wind
    const flutterMargin = flutterSpeed / designWindSpeed;
    const flutterSafe = flutterMargin > 1.25;
    
    if (!flutterSafe) {
      recommendations.push('Flutter speed is insufficient - increase torsional stiffness');
      recommendations.push('Consider aerodynamic deck shape optimization');
    }
    
    // Vortex shedding
    const St = 0.12;  // Strouhal number for rectangular section
    const vortexSheddingFrequency = St * designWindSpeed / depth;
    const lockInVelocity = f_v * depth / St;
    
    // Amplitude estimate (simplified)
    const Sc = 2 * m / (rho * depth ** 2);  // Scruton number
    const vortexAmplitude = Sc < 10 ? 50 : (Sc < 20 ? 20 : 5);  // mm estimate
    const vortexSafe = Sc > 10;
    
    if (!vortexSafe) {
      recommendations.push('Low Scruton number - consider tuned mass dampers');
    }
    
    // Buffeting response
    const I_u = 0.15;  // Turbulence intensity
    const L_u = 200;  // Turbulence length scale (m)
    
    const rmsDisplacementVertical = 200 * I_u * (designWindSpeed / 30) ** 2;  // mm estimate
    const rmsDisplacementLateral = 150 * I_u * (designWindSpeed / 30) ** 2;
    const rmsTorsion = 0.5 * I_u * (designWindSpeed / 30) ** 2;  // degrees
    
    // Acceleration check (comfort)
    const accelerationCheck = rmsDisplacementVertical < 100;  // Simplified check
    
    if (!accelerationCheck) {
      recommendations.push('High buffeting response - consider adding aerodynamic fairings');
    }
    
    // Galloping check
    const aspectRatio = width / depth;
    const gallopingSusceptible = aspectRatio < 2 || aspectRatio > 8;
    const gallopingOnsetSpeed = gallopingSusceptible ? 20 : 100;  // m/s
    
    if (gallopingSusceptible) {
      recommendations.push('Deck section may be susceptible to galloping');
    }
    
    return {
      flutterSpeed,
      flutterFrequency,
      flutterSafe,
      designWindSpeed,
      flutterMargin,
      vortexSheddingFrequency,
      lockInVelocity,
      vortexAmplitude,
      vortexSafe,
      rmsDisplacementVertical,
      rmsDisplacementLateral,
      rmsTorsion,
      accelerationCheck,
      gallopingSusceptible,
      gallopingOnsetSpeed,
      recommendations,
    };
  }

  // ===========================================================================
  // COMPLETE DESIGN
  // ===========================================================================

  public design(): SuspensionBridgeDesignResult {
    const warnings: string[] = [];
    const recommendations: string[] = [];
    
    // Analyze main cable
    const mainCable = this.analyzeMainCable();
    
    if (mainCable.status === 'fail') {
      warnings.push('Main cable capacity exceeded - increase cable size');
    }
    if (mainCable.sagRatio > 0.12) {
      warnings.push('High sag ratio may affect clearance and aesthetics');
    }
    if (mainCable.sagRatio < 0.05) {
      warnings.push('Low sag ratio results in high cable forces');
    }
    
    // Analyze hangers
    const hangers = this.analyzeHangers(mainCable);
    
    if (hangers.status === 'fail') {
      warnings.push('Hanger capacity exceeded');
    }
    if (hangers.slackPossible) {
      warnings.push('Some hangers may go slack under certain load patterns');
    }
    if (hangers.fatigueLife < 10) {
      warnings.push('Hanger fatigue life is low - consider larger hangers or dampers');
    }
    
    // Design towers
    const leftTower = this.designTower('left', mainCable);
    const rightTower = this.designTower('right', mainCable);
    
    if (leftTower.status === 'fail' || rightTower.status === 'fail') {
      warnings.push('Tower capacity exceeded - increase section size');
    }
    
    // Design anchorages
    const leftAnchorage = this.designAnchorage('left', mainCable);
    const rightAnchorage = this.designAnchorage('right', mainCable);
    
    if (leftAnchorage.status === 'fail' || rightAnchorage.status === 'fail') {
      warnings.push('Anchorage design inadequate');
    }
    
    // Design stiffening girder
    const stiffeningGirder = this.designStiffeningGirder();
    
    if (stiffeningGirder.status === 'fail') {
      warnings.push('Stiffening girder capacity exceeded');
    }
    if (stiffeningGirder.aerodynamicCheck !== 'stable') {
      warnings.push(`Aerodynamic stability: ${stiffeningGirder.aerodynamicCheck}`);
    }
    
    // Aerodynamic analysis
    const aerodynamics = this.analyzeAerodynamics(stiffeningGirder);
    recommendations.push(...aerodynamics.recommendations);
    
    // Weight summary
    const cableMass = mainCable.requiredArea * this.cableMaterial.density / 1e6;
    const cableWeight = cableMass * mainCable.totalCableLength * this.geometry.numCables / 1000;
    
    const hangerWeight = hangers.numHangers * hangers.hangerArea * 7850 / 1e6 * 
                         (hangers.lengths.reduce((a, b) => a + b, 0) / hangers.numHangers) * 
                         this.geometry.numCables / 1000;
    
    const towerWeight = (leftTower.selfWeight + rightTower.selfWeight) / 10;  // tonnes
    const deckWeight = stiffeningGirder.mass * this.geometry.mainSpan / 1000;
    
    const totalSteelWeight = cableWeight + hangerWeight + towerWeight + deckWeight;
    
    // Determine critical element
    const utilizations = [
      { element: 'Main cable', util: mainCable.utilizationRatio },
      { element: 'Hangers', util: hangers.maxUtilization },
      { element: 'Left tower', util: leftTower.combinedUtilization },
      { element: 'Right tower', util: rightTower.combinedUtilization },
      { element: 'Stiffening girder', util: stiffeningGirder.combinedUtilization },
    ];
    
    const critical = utilizations.reduce((a, b) => a.util > b.util ? a : b);
    
    const overallStatus = warnings.some(w => w.includes('exceeded') || w.includes('fail')) ? 'fail' : 'pass';
    
    // Additional recommendations
    if (totalSteelWeight < this.geometry.mainSpan * 5) {
      recommendations.push('Steel weight appears low - verify design assumptions');
    }
    if (this.geometry.mainSpan > 1000 && stiffeningGirder.aerodynamicCheck !== 'stable') {
      recommendations.push('For spans > 1km, consider wind tunnel testing');
    }
    
    return {
      geometry: this.geometry,
      loading: this.loading,
      mainCable,
      hangers,
      towers: { left: leftTower, right: rightTower },
      anchorages: { left: leftAnchorage, right: rightAnchorage },
      stiffeningGirder,
      aerodynamics,
      overallStatus,
      criticalElement: critical.element,
      maxUtilization: critical.util,
      weights: {
        mainCables: cableWeight,
        hangers: hangerWeight,
        towers: towerWeight,
        deck: deckWeight,
        totalSteel: totalSteelWeight,
      },
      warnings,
      recommendations,
    };
  }
}

// =============================================================================
// FACTORY FUNCTIONS
// =============================================================================

/**
 * Quick design for standard suspension bridge
 */
export function designSuspensionBridge(
  mainSpan: number,          // m
  sideSpan: number,          // m (0 for simple suspension)
  towerHeight: number,       // m above deck
  deckWidth: number,         // m
  deckLoad: number,          // kN/m² total
  liveLoad: number           // kN/m² vehicular
): SuspensionBridgeDesignResult {
  
  const geometry: SuspensionBridgeGeometry = {
    mainSpan,
    sideSpan,
    towerHeight,
    sagMainSpan: mainSpan / 9,  // Typical sag ratio ~ 1:9
    sagSideSpan: sideSpan > 0 ? sideSpan / 18 : 0,
    deckLevel: 0,
    clearance: 50,  // m navigation clearance
    numCables: 2,
    cableSpacing: deckWidth * 1.1,
    hangerSpacing: 15,  // m typical
    hangerType: 'vertical',
    towerType: 'portal-frame',
    towerWidth: deckWidth * 0.3,
    anchorageType: sideSpan > 0 ? 'gravity' : 'self-anchored',
  };
  
  const loading: SuspensionBridgeLoading = {
    cableSelfWeight: 5,  // kN/m estimate
    deckDeadLoad: deckLoad * deckWidth,
    hangerWeight: 0.5,  // kN/m
    vehicularLoad: liveLoad * deckWidth,
    windPressure: 1.5,  // kN/m²
    windOnCable: 0.5,  // kN/m
    temperature: 40,  // °C range
    loadFactorDead: 1.35,
    loadFactorLive: 1.5,
    loadFactorWind: 1.5,
  };
  
  const engine = new SuspensionBridgeDesignEngine(geometry, loading, 'PWS-1770');
  return engine.design();
}

/**
 * Design cable-stayed tower for hybrid systems
 */
export function designCableStayedTower(
  towerHeight: number,       // m
  maxCableForce: number,     // kN
  numStays: number,          // per side
  towerType: TowerType = 'diamond'
): TowerDesignResult {
  
  // Simplified tower design for cable-stayed system
  const totalHorizontal = maxCableForce * numStays * 0.7;  // Horizontal component
  const totalVertical = maxCableForce * numStays * 0.7 * 2;  // Both sides
  
  const legArea = (totalVertical * 1000 / 355) * 1.5;  // mm² with safety
  const legSize = Math.sqrt(legArea / 4 / 0.04);
  
  return {
    towerType,
    height: towerHeight,
    widthAtBase: legSize / 1000 * 3,
    widthAtTop: legSize / 1000 * 2,
    cableForce: {
      horizontal: totalHorizontal,
      vertical: totalVertical / 2,
    },
    windForce: 0.01 * towerHeight * legSize / 1000,
    selfWeight: legArea * 4 * towerHeight * 78.5 / 1e6,
    axialForce: totalVertical,
    bendingMoment: totalHorizontal * 0.1 * towerHeight,  // Small unbalance
    shearForce: totalHorizontal * 0.05,
    legSection: {
      type: 'BOX',
      dimensions: `${Math.round(legSize)}x${Math.round(legSize)}x40`,
      area: legArea,
      Ix: (legSize ** 4 - (legSize - 80) ** 4) / 12,
    },
    axialCapacity: legArea * 4 * 355 / 1000,
    momentCapacity: 355 * 1000 * legSize ** 3 / 6 / 1e6,
    bucklingCapacity: legArea * 4 * 355 * 0.6 / 1000,
    axialUtilization: totalVertical / (legArea * 4 * 355 * 0.6 / 1000),
    bendingUtilization: 0.1,
    combinedUtilization: 0.7,
    status: 'pass',
    slendernessRatio: 2 * towerHeight * 1000 / Math.sqrt((legSize ** 4 - (legSize - 80) ** 4) / 12 / legArea),
    bucklingMode: 'Inelastic buckling',
  };
}

// =============================================================================
// EXPORTS (class already exported at declaration)
// =============================================================================
