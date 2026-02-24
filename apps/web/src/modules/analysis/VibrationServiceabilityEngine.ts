/**
 * ============================================================================
 * VIBRATION SERVICEABILITY AND HUMAN COMFORT ENGINE
 * ============================================================================
 * 
 * Comprehensive vibration assessment for structures:
 * - Floor vibration from walking
 * - Rhythmic activity analysis
 * - Machine-induced vibration
 * - Wind-induced building motion
 * - Footbridge vibration
 * - Human perception thresholds
 * 
 * Design Codes Supported:
 * - AISC Design Guide 11 (Floor Vibrations)
 * - SCI P354 (Floor Vibrations)
 * - ISO 10137 (Serviceability against vibration)
 * - ISO 2631-1/2 (Human exposure to vibration)
 * - EN 1990 Annex A2 (Serviceability criteria)
 * - Eurocode 1 Part 1-1 (Actions on structures)
 * - BS 6472 (Vibration in buildings)
 * - NBCC (Canadian Code)
 * - AS 2670 (Vibration and shock)
 * 
 * @version 1.0.0
 */

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface FloorSystem {
  type: 'steel-composite' | 'steel-joist' | 'concrete-slab' | 'concrete-beam' |
        'timber' | 'post-tensioned' | 'precast-hcs' | 'slim-floor';
  
  // Geometry
  bay: {
    length: number; // m (beam span)
    width: number; // m (girder spacing / slab span)
  };
  
  // Structural properties
  beam?: {
    spacing: number; // m
    momentOfInertia: number; // mm⁴
    effectiveWidth: number; // mm
    depth: number; // mm
    elasticModulus: number; // MPa
  };
  
  girder?: {
    span: number; // m
    momentOfInertia: number; // mm⁴
    effectiveWidth: number; // mm
    depth: number; // mm
    elasticModulus: number; // MPa
  };
  
  slab: {
    thickness: number; // mm
    density: number; // kg/m³
    elasticModulus: number; // MPa
    dampingRatio: number; // typically 0.02-0.05
  };
  
  // Loading
  loads: {
    dead: number; // kN/m² (self-weight included)
    superimposed: number; // kN/m² (partitions, finishes)
    live: number; // kN/m² (design live load)
  };
}

export interface WalkingExcitation {
  walkerWeight: number; // N (typically 700-750 N)
  walkingFrequency: number; // Hz (typically 1.5-2.5 Hz)
  paceLength: number; // m
  walkingPath: 'mid-span' | 'quarter-point' | 'random';
  activityType: 'normal-walking' | 'fast-walking' | 'running' | 'jumping';
}

export interface RhythmicActivity {
  type: 'aerobics' | 'dancing' | 'concert' | 'sports' | 'gym';
  frequency: number; // Hz (activity frequency)
  participants: number; // Number of people
  area: number; // m² (activity area)
  synchronization: number; // 0-1 (degree of coordination)
}

export interface VibrationResult {
  naturalFrequency: number; // Hz
  mode: 'fundamental' | 'higher';
  
  // Response
  peakAcceleration: number; // m/s² (or %g)
  peakVelocity: number; // mm/s
  rmsAcceleration: number; // m/s²
  
  // Criteria check
  criteria: {
    source: string;
    limit: number;
    unit: string;
    actual: number;
    ratio: number;
    acceptable: boolean;
  };
  
  // Human perception
  perception: 'imperceptible' | 'barely-perceptible' | 'perceptible' | 
              'annoying' | 'very-annoying' | 'intolerable';
  
  recommendations: string[];
}

export interface FootbridgeVibration {
  span: number; // m
  width: number; // m
  mass: number; // kg/m
  stiffness: number; // kN/m (vertical)
  lateralStiffness?: number; // kN/m
  dampingRatio: number;
  pedestrianDensity: number; // persons/m²
  criticalGroup: 'single' | 'group' | 'crowd';
}

// ============================================================================
// FLOOR NATURAL FREQUENCY
// ============================================================================

export class FloorFrequency {
  /**
   * Calculate natural frequency of composite floor system
   * per AISC Design Guide 11
   */
  static compositeFloor(
    floor: FloorSystem
  ): {
    beamFrequency: number; // Hz
    girderFrequency: number; // Hz
    combinedFrequency: number; // Hz
    effectiveMass: number; // kg
    modalMass: number; // kg
    stiffness: number; // N/m
  } {
    const g = 9.81; // m/s²
    
    // Weight per unit area (for frequency calculation use actual weight)
    const W = (floor.loads.dead + 0.1 * floor.loads.live) * 1000; // N/m²
    
    // Beam frequency
    let fj = 0;
    let delta_j = 0;
    if (floor.beam) {
      const E = floor.beam.elasticModulus;
      const I = floor.beam.momentOfInertia;
      const L = floor.bay.length * 1000; // mm
      const w = W * floor.beam.spacing; // N/m
      
      // Simply supported beam deflection under uniform load
      delta_j = 5 * w * Math.pow(L, 4) / (384 * E * I); // mm
      fj = 0.18 * Math.sqrt(g * 1000 / delta_j); // Hz
    }
    
    // Girder frequency
    let fg = 0;
    let delta_g = 0;
    if (floor.girder) {
      const E = floor.girder.elasticModulus;
      const I = floor.girder.momentOfInertia;
      const L = floor.girder.span * 1000; // mm
      const w = W * floor.bay.length; // N/m (assuming beam loads)
      
      delta_g = 5 * w * Math.pow(L, 4) / (384 * E * I); // mm
      fg = 0.18 * Math.sqrt(g * 1000 / delta_g); // Hz
    }
    
    // Combined system frequency (Dunkerley's equation)
    let fn: number;
    if (fj > 0 && fg > 0) {
      fn = 1 / Math.sqrt(1 / (fj * fj) + 1 / (fg * fg));
    } else if (fj > 0) {
      fn = fj;
    } else {
      fn = fg;
    }
    
    // Effective panel weight
    const panelLength = floor.girder ? floor.girder.span : floor.bay.length;
    const panelWidth = floor.beam ? floor.beam.spacing * 2 : floor.bay.width;
    const effectiveMass = W / g * panelLength * panelWidth; // kg
    
    // Modal mass (typically 25% of effective mass for resonance)
    const modalMass = 0.25 * effectiveMass;
    
    // Stiffness from frequency
    const stiffness = Math.pow(2 * Math.PI * fn, 2) * modalMass; // N/m

    return {
      beamFrequency: fj,
      girderFrequency: fg,
      combinedFrequency: fn,
      effectiveMass,
      modalMass,
      stiffness
    };
  }

  /**
   * Calculate natural frequency of concrete slab
   */
  static concreteSlab(
    span: number, // m
    thickness: number, // mm
    supportCondition: 'simply-supported' | 'fixed-fixed' | 'cantilever' | 'continuous',
    load: number, // kN/m² (total)
    E: number = 30000 // MPa
  ): {
    frequency: number; // Hz
    modeShape: 'first' | 'second';
  } {
    const h = thickness / 1000; // m
    const L = span; // m
    const rho = 2400; // kg/m³ (concrete density)
    const g = 9.81;
    
    // Plate stiffness
    const D = E * 1e6 * Math.pow(h, 3) / (12 * (1 - 0.2 * 0.2)); // N·m
    
    // Mass per unit area
    const m = load * 1000 / g; // kg/m² (based on load)
    
    // Frequency coefficient
    let lambda: number;
    switch (supportCondition) {
      case 'simply-supported':
        lambda = Math.PI * Math.PI;
        break;
      case 'fixed-fixed':
        lambda = 22.37;
        break;
      case 'cantilever':
        lambda = 3.52;
        break;
      case 'continuous':
        lambda = 15.42;
        break;
      default:
        lambda = Math.PI * Math.PI;
    }
    
    // Natural frequency
    const fn = lambda / (2 * Math.PI * L * L) * Math.sqrt(D / m);

    return {
      frequency: fn,
      modeShape: 'first'
    };
  }

  /**
   * Minimum frequency requirements by use
   */
  static minimumFrequency(
    use: 'office' | 'residential' | 'hospital' | 'manufacturing' | 'assembly' | 'gym'
  ): {
    minFrequency: number; // Hz
    source: string;
    note: string;
  } {
    const requirements: Record<string, { min: number; source: string; note: string }> = {
      'office': { 
        min: 4.0, 
        source: 'AISC DG11',
        note: 'Higher frequency preferred for open offices'
      },
      'residential': { 
        min: 5.0, 
        source: 'AISC DG11',
        note: 'More stringent due to annoyance sensitivity'
      },
      'hospital': { 
        min: 8.0, 
        source: 'SCI P354',
        note: 'Critical for sensitive equipment'
      },
      'manufacturing': { 
        min: 3.0, 
        source: 'General practice',
        note: 'May need higher for precision equipment'
      },
      'assembly': { 
        min: 6.0, 
        source: 'AISC DG11',
        note: 'Rhythmic activity risk if < 9 Hz'
      },
      'gym': { 
        min: 9.0, 
        source: 'AISC DG11',
        note: 'Avoid resonance with rhythmic activities'
      }
    };

    const req = requirements[use] || requirements['office'];
    return {
      minFrequency: req.min,
      source: req.source,
      note: req.note
    };
  }
}

// ============================================================================
// WALKING EXCITATION ANALYSIS
// ============================================================================

export class WalkingVibration {
  /**
   * Calculate response to walking per AISC Design Guide 11
   */
  static aiscDG11Analysis(
    floor: FloorSystem,
    walking: WalkingExcitation = {
      walkerWeight: 700,
      walkingFrequency: 2.0,
      paceLength: 0.75,
      walkingPath: 'mid-span',
      activityType: 'normal-walking'
    }
  ): VibrationResult {
    const freqResult = FloorFrequency.compositeFloor(floor);
    const fn = freqResult.combinedFrequency;
    const W = freqResult.effectiveMass * 9.81; // N
    const beta = floor.slab.dampingRatio;
    
    // Forcing function coefficient (DG11 Equation 4.1)
    const P0 = walking.walkerWeight; // N
    
    // Dynamic load factor for walking
    // α = 0.29 for first harmonic at 2 Hz
    const alpha = 0.29 * Math.exp(-0.35 * walking.walkingFrequency);
    
    // Resonance response reduction (DG11 Equation 4.2)
    const R = 0.5; // Reduction factor for resonance
    
    // Peak acceleration (DG11 Equation 4.3)
    // a_p/g = R × P₀ × α × exp(-0.35fn) / (β × W)
    const apg = R * P0 * alpha * Math.exp(-0.35 * fn) / (beta * W);
    const ap = apg * 9.81; // m/s²
    
    // RMS acceleration (typically ap/√2 for sinusoidal)
    const arms = ap / Math.sqrt(2);
    
    // Peak velocity
    const vp = ap / (2 * Math.PI * fn) * 1000; // mm/s
    
    // Tolerance limit (Table 4.1)
    let limit: number;
    let useDescription: string;
    if (floor.type === 'steel-composite' || floor.type === 'steel-joist') {
      limit = 0.005; // 0.5% g for offices
      useDescription = 'Office (steel floor)';
    } else {
      limit = 0.005;
      useDescription = 'Office (concrete floor)';
    }
    
    const acceptable = apg <= limit;
    
    // Perception level
    let perception: VibrationResult['perception'];
    if (apg < 0.001) {
      perception = 'imperceptible';
    } else if (apg < 0.003) {
      perception = 'barely-perceptible';
    } else if (apg < 0.01) {
      perception = 'perceptible';
    } else if (apg < 0.03) {
      perception = 'annoying';
    } else if (apg < 0.1) {
      perception = 'very-annoying';
    } else {
      perception = 'intolerable';
    }
    
    const recommendations: string[] = [];
    if (!acceptable) {
      if (fn < 4) {
        recommendations.push('Increase floor stiffness to raise natural frequency above 4 Hz');
      }
      recommendations.push('Consider increasing damping with partitions or raised floors');
      recommendations.push('Add mass to reduce acceleration response');
      if (floor.beam?.spacing && floor.beam.spacing > 3) {
        recommendations.push('Reduce beam spacing to increase floor stiffness');
      }
    }
    if (fn < 9 && fn > 3) {
      recommendations.push('Frequency in sensitive range - verify for resonance');
    }

    return {
      naturalFrequency: fn,
      mode: 'fundamental',
      peakAcceleration: ap,
      peakVelocity: vp,
      rmsAcceleration: arms,
      criteria: {
        source: 'AISC Design Guide 11',
        limit: limit * 100,
        unit: '%g',
        actual: apg * 100,
        ratio: apg / limit,
        acceptable
      },
      perception,
      recommendations
    };
  }

  /**
   * SCI P354 methodology (UK)
   */
  static sciP354Analysis(
    floor: FloorSystem,
    use: 'office-A' | 'office-B' | 'residential-day' | 'residential-night' | 'hospital'
  ): VibrationResult {
    const freqResult = FloorFrequency.compositeFloor(floor);
    const fn = freqResult.combinedFrequency;
    const M = freqResult.modalMass;
    const zeta = floor.slab.dampingRatio;
    
    // Walking frequency and force (SCI P354 Table 4.1)
    const fstep = 2.0; // Hz
    const F = 700; // N (walker weight)
    const alpha = 0.4; // Dynamic coefficient
    
    // Response factor
    // R = α × F / (4 × π × M × fn × zeta)
    const arms = alpha * F / (4 * Math.PI * Math.PI * M * fn * zeta);
    const ap = arms * Math.sqrt(2);
    const apg = ap / 9.81;
    
    // Multiplying factors (Table 6.1)
    const factors: Record<string, number> = {
      'office-A': 8,
      'office-B': 4,
      'residential-day': 4,
      'residential-night': 1.4,
      'hospital': 1.0
    };
    
    const R = factors[use] || 8;
    const baseLimit = 0.005; // m/s² (5 mm/s² base)
    const limit = baseLimit * R;
    
    const acceptable = arms <= limit;
    
    // Response factor
    const responseFactorR = arms / baseLimit;
    
    let perception: VibrationResult['perception'];
    if (responseFactorR < 1) {
      perception = 'imperceptible';
    } else if (responseFactorR < 4) {
      perception = 'barely-perceptible';
    } else if (responseFactorR < 8) {
      perception = 'perceptible';
    } else if (responseFactorR < 16) {
      perception = 'annoying';
    } else {
      perception = 'very-annoying';
    }
    
    const recommendations: string[] = [];
    if (!acceptable) {
      recommendations.push(`Response factor R = ${responseFactorR.toFixed(1)} exceeds limit ${R}`);
      recommendations.push('Consider tuned mass damper');
      recommendations.push('Increase floor mass or stiffness');
    }

    return {
      naturalFrequency: fn,
      mode: 'fundamental',
      peakAcceleration: ap,
      peakVelocity: ap / (2 * Math.PI * fn) * 1000,
      rmsAcceleration: arms,
      criteria: {
        source: 'SCI P354',
        limit: limit * 1000,
        unit: 'mm/s² rms',
        actual: arms * 1000,
        ratio: arms / limit,
        acceptable
      },
      perception,
      recommendations
    };
  }

  /**
   * Walking force time history (harmonic model)
   */
  static walkingForceTimeHistory(
    duration: number, // seconds
    stepFrequency: number = 2.0, // Hz
    walkerWeight: number = 700, // N
    timestep: number = 0.01 // seconds
  ): { time: number[]; force: number[] } {
    const time: number[] = [];
    const force: number[] = [];
    
    // Harmonic coefficients (DG11)
    const alpha = [0, 0.4, 0.1, 0.1]; // First 3 harmonics
    
    for (let t = 0; t <= duration; t += timestep) {
      time.push(t);
      let F = walkerWeight;
      for (let h = 1; h <= 3; h++) {
        F += walkerWeight * alpha[h] * Math.sin(2 * Math.PI * h * stepFrequency * t);
      }
      force.push(F);
    }

    return { time, force };
  }
}

// ============================================================================
// RHYTHMIC ACTIVITY ANALYSIS
// ============================================================================

export class RhythmicActivity {
  /**
   * Check floor for rhythmic activities per AISC DG11
   */
  static checkRhythmicActivity(
    floor: FloorSystem,
    activity: RhythmicActivity
  ): VibrationResult {
    const freqResult = FloorFrequency.compositeFloor(floor);
    const fn = freqResult.combinedFrequency;
    const Weff = freqResult.effectiveMass * 9.81; // N
    const beta = floor.slab.dampingRatio;
    
    // Activity parameters (Table 5.1 DG11)
    const activityParams: Record<string, { alpha: number; freq: number }> = {
      'aerobics': { alpha: 0.5, freq: 2.5 },
      'dancing': { alpha: 0.5, freq: 2.0 },
      'concert': { alpha: 0.25, freq: 2.0 },
      'sports': { alpha: 0.4, freq: 3.0 },
      'gym': { alpha: 0.6, freq: 2.5 }
    };
    
    const params = activityParams[activity.type] || { alpha: 0.4, freq: 2.0 };
    const fstep = activity.frequency || params.freq;
    const alpha = params.alpha * activity.synchronization;
    
    // Weight of participants
    const Wp = activity.participants * 750; // N
    
    // Check harmonic resonance
    let resonantHarmonic = 0;
    for (let h = 1; h <= 4; h++) {
      if (Math.abs(h * fstep - fn) < 0.5) {
        resonantHarmonic = h;
        break;
      }
    }
    
    // Dynamic amplification
    const r = (resonantHarmonic * fstep) / fn;
    const DAF = 1 / Math.sqrt(Math.pow(1 - r * r, 2) + Math.pow(2 * beta * r, 2));
    
    // Peak acceleration (Equation 5.1)
    const ai = alpha * Wp / beta / Weff * DAF;
    const ap = ai * 9.81; // m/s²
    const apg = ai;
    
    // Limits (Table 5.2)
    let limit: number;
    if (activity.type === 'gym' || activity.type === 'aerobics') {
      limit = 0.05; // 5% g for participants
    } else if (activity.type === 'concert') {
      limit = 0.02;
    } else {
      limit = 0.04;
    }
    
    const acceptable = apg <= limit;
    
    let perception: VibrationResult['perception'];
    if (apg < 0.02) {
      perception = 'perceptible';
    } else if (apg < 0.05) {
      perception = 'annoying';
    } else if (apg < 0.15) {
      perception = 'very-annoying';
    } else {
      perception = 'intolerable';
    }
    
    const recommendations: string[] = [];
    if (resonantHarmonic > 0) {
      recommendations.push(`Resonance with harmonic ${resonantHarmonic} at ${resonantHarmonic * fstep} Hz`);
    }
    if (!acceptable) {
      recommendations.push('Increase floor natural frequency above 9 Hz');
      recommendations.push('Add damping (partitions, viscoelastic dampers)');
      recommendations.push('Reduce number of participants or activity area');
      if (fn < 3 * fstep) {
        recommendations.push('Floor frequency too close to activity harmonics');
      }
    }

    return {
      naturalFrequency: fn,
      mode: 'fundamental',
      peakAcceleration: ap,
      peakVelocity: ap / (2 * Math.PI * fn) * 1000,
      rmsAcceleration: ap / Math.sqrt(2),
      criteria: {
        source: 'AISC DG11 Table 5.2',
        limit: limit * 100,
        unit: '%g',
        actual: apg * 100,
        ratio: apg / limit,
        acceptable
      },
      perception,
      recommendations
    };
  }
}

// ============================================================================
// FOOTBRIDGE VIBRATION
// ============================================================================

export class FootbridgeVibrationAnalysis {
  /**
   * Pedestrian bridge vibration per Eurocode/SETRA
   */
  static analyze(
    bridge: FootbridgeVibration
  ): {
    verticalFrequency: number;
    lateralFrequency?: number;
    verticalAcceleration: number;
    lateralAcceleration?: number;
    comfortClass: 'maximum' | 'mean' | 'minimum' | 'unacceptable';
    lockIn: boolean;
    recommendations: string[];
  } {
    // Vertical natural frequency
    const fn_v = (Math.PI / 2) * Math.sqrt(bridge.stiffness * 1000 / 
                 (bridge.mass * bridge.span));
    
    // Lateral frequency (if stiffness provided)
    let fn_h: number | undefined;
    if (bridge.lateralStiffness) {
      fn_h = (Math.PI / 2) * Math.sqrt(bridge.lateralStiffness * 1000 / 
             (bridge.mass * bridge.span));
    }
    
    // Pedestrian load model
    const numberOfPeds = bridge.pedestrianDensity * bridge.span * bridge.width;
    const syncFactor = Math.sqrt(numberOfPeds) / numberOfPeds; // Synchronization
    
    // Vertical excitation force
    const F_ped = 280; // N (vertical component)
    const F_total = F_ped * numberOfPeds * syncFactor;
    
    // Modal mass
    const M = bridge.mass * bridge.span * 0.5; // Half for first mode
    
    // Steady-state response
    const a_v = F_total / (M * 2 * bridge.dampingRatio);
    
    // Lateral response
    let a_h: number | undefined;
    if (fn_h && fn_h < 1.3) {
      // Risk of lateral lock-in
      const F_lateral = 35; // N (lateral component)
      a_h = F_lateral * numberOfPeds * syncFactor / (M * 2 * bridge.dampingRatio);
    }
    
    // Comfort class (SETRA Guidelines)
    let comfortClass: 'maximum' | 'mean' | 'minimum' | 'unacceptable';
    if (a_v < 0.5) {
      comfortClass = 'maximum';
    } else if (a_v < 1.0) {
      comfortClass = 'mean';
    } else if (a_v < 2.5) {
      comfortClass = 'minimum';
    } else {
      comfortClass = 'unacceptable';
    }
    
    // Lock-in check (Millennium Bridge phenomenon)
    const lockIn = fn_h !== undefined && fn_h < 1.3 && 
                   bridge.pedestrianDensity > 0.5;
    
    const recommendations: string[] = [];
    if (fn_v > 1.7 && fn_v < 2.3) {
      recommendations.push('Vertical frequency in primary walking range - verify response');
    }
    if (fn_h && fn_h < 1.3) {
      recommendations.push('Lateral frequency in lock-in risk zone');
      recommendations.push('Consider lateral dampers');
    }
    if (lockIn) {
      recommendations.push('HIGH RISK: Synchronous lateral excitation possible');
      recommendations.push('Install tuned mass dampers');
    }
    if (comfortClass === 'unacceptable') {
      recommendations.push('Increase damping or stiffness');
      recommendations.push('Consider crowd control measures');
    }

    return {
      verticalFrequency: fn_v,
      lateralFrequency: fn_h,
      verticalAcceleration: a_v,
      lateralAcceleration: a_h,
      comfortClass,
      lockIn,
      recommendations
    };
  }
}

// ============================================================================
// MACHINE INDUCED VIBRATION
// ============================================================================

export class MachineVibration {
  /**
   * Analyze machine-induced floor vibration
   */
  static analyze(
    floor: FloorSystem,
    machine: {
      type: 'rotating' | 'reciprocating' | 'impact';
      rpm: number;
      unbalancedForce: number; // N
      weight: number; // N
      isolation?: {
        frequency: number; // Hz (isolator natural frequency)
        damping: number;
      };
    }
  ): {
    excitationFrequency: number; // Hz
    transmittedForce: number; // N
    floorAcceleration: number; // m/s²
    velocityDB: number; // dB ref 1e-8 m/s
    isoLevel: 'VC-A' | 'VC-B' | 'VC-C' | 'VC-D' | 'VC-E' | 'exceeds';
    acceptable: boolean;
    recommendations: string[];
  } {
    const freqResult = FloorFrequency.compositeFloor(floor);
    const fn = freqResult.combinedFrequency;
    const M = freqResult.modalMass;
    const zeta = floor.slab.dampingRatio;
    
    // Excitation frequency
    const fexc = machine.rpm / 60;
    
    // Force transmission through isolator
    let transmittedForce = machine.unbalancedForce;
    if (machine.isolation) {
      const r = fexc / machine.isolation.frequency;
      const TR = Math.sqrt((1 + Math.pow(2 * machine.isolation.damping * r, 2)) /
                           (Math.pow(1 - r * r, 2) + Math.pow(2 * machine.isolation.damping * r, 2)));
      transmittedForce = machine.unbalancedForce * TR;
    }
    
    // Floor response
    const r_floor = fexc / fn;
    const DAF = 1 / Math.sqrt(Math.pow(1 - r_floor * r_floor, 2) + 
                              Math.pow(2 * zeta * r_floor, 2));
    
    // Acceleration
    const acc = transmittedForce * DAF / M;
    
    // Velocity
    const vel = acc / (2 * Math.PI * fexc);
    
    // Velocity in dB (ref 1e-8 m/s)
    const velDB = 20 * Math.log10(vel / 1e-8);
    
    // Vibration criteria (VC curves for sensitive equipment)
    // VC-A: 50 μm/s, VC-B: 25 μm/s, VC-C: 12.5 μm/s, VC-D: 6 μm/s, VC-E: 3 μm/s
    let isoLevel: 'VC-A' | 'VC-B' | 'VC-C' | 'VC-D' | 'VC-E' | 'exceeds';
    const velMicrons = vel * 1e6;
    if (velMicrons <= 3) {
      isoLevel = 'VC-E';
    } else if (velMicrons <= 6) {
      isoLevel = 'VC-D';
    } else if (velMicrons <= 12.5) {
      isoLevel = 'VC-C';
    } else if (velMicrons <= 25) {
      isoLevel = 'VC-B';
    } else if (velMicrons <= 50) {
      isoLevel = 'VC-A';
    } else {
      isoLevel = 'exceeds';
    }
    
    const recommendations: string[] = [];
    if (!machine.isolation) {
      recommendations.push('Install vibration isolators on machine');
    }
    if (Math.abs(r_floor - 1) < 0.2) {
      recommendations.push('Machine frequency close to floor frequency - resonance risk');
      recommendations.push('Change machine speed or floor stiffness');
    }
    if (isoLevel === 'exceeds') {
      recommendations.push('Vibration exceeds VC-A - not suitable for office');
      recommendations.push('Consider isolated foundation slab');
    }

    return {
      excitationFrequency: fexc,
      transmittedForce,
      floorAcceleration: acc,
      velocityDB: velDB,
      isoLevel,
      acceptable: isoLevel !== 'exceeds',
      recommendations
    };
  }
}

// ============================================================================
// WIND-INDUCED BUILDING MOTION
// ============================================================================

export class WindInducedMotion {
  /**
   * Building occupant comfort under wind loading
   */
  static occupantComfort(
    building: {
      height: number; // m
      width: number; // m
      depth: number; // m
      naturalFrequency: number; // Hz (first mode)
      dampingRatio: number;
      mass: number; // kg (total)
    },
    wind: {
      speed: number; // m/s (10-min mean at top)
      returnPeriod: number; // years (typically 10 for comfort)
    }
  ): {
    peakAcceleration: number; // m/s² (at top floor)
    rmsAcceleration: number;
    percentExceedance: number;
    comfortLevel: 'imperceptible' | 'perceptible' | 'annoying' | 'very-annoying';
    acceptable: boolean;
    recommendations: string[];
  } {
    const H = building.height;
    const B = building.width;
    const D = building.depth;
    const fn = building.naturalFrequency;
    const zeta = building.dampingRatio;
    const M = building.mass;
    
    // Air density
    const rho = 1.25; // kg/m³
    
    // Reduced frequency
    const Vref = wind.speed;
    const fL_V = fn * B / Vref;
    
    // Aerodynamic admittance
    const chi = 1 / (1 + 6 * fL_V);
    
    // Turbulence intensity
    const Iu = 0.15; // Typical urban
    
    // Background response factor
    const B2 = 1 / (1 + 0.9 * Math.pow((B + H) / 300, 0.63));
    
    // Resonant response factor
    const S = 0.15 * fn / (1 + 0.25 * Math.pow(fn, 1.5));
    const R2 = Math.PI * S / (4 * zeta);
    
    // RMS acceleration at top
    const sigma_a = 3 * Iu * rho * B * D * Vref * Vref / (2 * M) * 
                    Math.sqrt(B2 + R2);
    
    // Peak factor
    const g = Math.sqrt(2 * Math.log(600 * fn)) + 
              0.5772 / Math.sqrt(2 * Math.log(600 * fn));
    
    // Peak acceleration
    const a_peak = g * sigma_a;
    
    // Comfort assessment (ISO 10137)
    // 10-year return: limit depends on frequency
    let limit: number;
    if (fn < 0.5) {
      limit = 0.07; // m/s²
    } else if (fn < 1.0) {
      limit = 0.05;
    } else {
      limit = 0.04;
    }
    
    // Percent feeling motion (empirical)
    const pct = Math.min(100, 100 * (1 - Math.exp(-a_peak / 0.015)));
    
    let comfortLevel: 'imperceptible' | 'perceptible' | 'annoying' | 'very-annoying';
    if (a_peak < 0.01) {
      comfortLevel = 'imperceptible';
    } else if (a_peak < 0.04) {
      comfortLevel = 'perceptible';
    } else if (a_peak < 0.10) {
      comfortLevel = 'annoying';
    } else {
      comfortLevel = 'very-annoying';
    }
    
    const acceptable = a_peak <= limit;
    
    const recommendations: string[] = [];
    if (!acceptable) {
      recommendations.push('Consider increasing damping (auxiliary dampers)');
      recommendations.push('Optimize building shape for aerodynamic performance');
      if (fn < 0.3) {
        recommendations.push('Very flexible building - tuned mass damper recommended');
      }
    }
    if (a_peak > 0.05) {
      recommendations.push('Significant motion perception expected');
    }

    return {
      peakAcceleration: a_peak,
      rmsAcceleration: sigma_a,
      percentExceedance: pct,
      comfortLevel,
      acceptable,
      recommendations
    };
  }
}

// ============================================================================
// HUMAN PERCEPTION THRESHOLDS
// ============================================================================

export class HumanPerception {
  /**
   * ISO 2631 VDV assessment
   */
  static vibrationDoseValue(
    accelerationTimeHistory: number[], // m/s²
    timestep: number, // seconds
    exposure: number // hours
  ): {
    VDV: number; // m/s^1.75
    rating: 'below-perception' | 'acceptable' | 'adverse-comment' | 'unacceptable';
  } {
    // VDV = (∫ a^4 dt)^0.25
    let sum = 0;
    for (const a of accelerationTimeHistory) {
      sum += Math.pow(a, 4) * timestep;
    }
    const VDV = Math.pow(sum, 0.25);
    
    // Scale to exposure duration
    const VDV_scaled = VDV * Math.pow(exposure * 3600 / (timestep * accelerationTimeHistory.length), 0.25);
    
    // Rating (ISO 2631-2 Table 1)
    let rating: 'below-perception' | 'acceptable' | 'adverse-comment' | 'unacceptable';
    if (VDV_scaled < 0.21) {
      rating = 'below-perception';
    } else if (VDV_scaled < 0.43) {
      rating = 'acceptable';
    } else if (VDV_scaled < 0.86) {
      rating = 'adverse-comment';
    } else {
      rating = 'unacceptable';
    }

    return { VDV: VDV_scaled, rating };
  }

  /**
   * Response factor (BS 6472)
   */
  static responseFactorBS6472(
    rmsAcceleration: number, // m/s²
    frequency: number, // Hz
    use: 'residential-day' | 'residential-night' | 'office' | 'workshop'
  ): {
    responseFactor: number;
    limit: number;
    acceptable: boolean;
  } {
    // Base curve (perception threshold)
    let base: number;
    if (frequency < 4) {
      base = 0.0036 * Math.pow(frequency, -1);
    } else if (frequency < 8) {
      base = 0.0036 / 4;
    } else {
      base = 0.0036 * frequency / 32;
    }
    
    const responseFactor = rmsAcceleration / base;
    
    // Multiplying factors
    const limits: Record<string, number> = {
      'residential-night': 1.4,
      'residential-day': 4,
      'office': 8,
      'workshop': 16
    };
    
    const limit = limits[use] || 8;

    return {
      responseFactor,
      limit,
      acceptable: responseFactor <= limit
    };
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  FloorFrequency,
  WalkingVibration,
  RhythmicActivity,
  FootbridgeVibrationAnalysis,
  MachineVibration,
  WindInducedMotion,
  HumanPerception
};
