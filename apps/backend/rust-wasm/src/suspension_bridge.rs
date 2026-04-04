// Suspension Bridge Analysis Module
// Comprehensive analysis for suspension bridge structures

use std::f64::consts::PI;

/// Main suspension bridge structure
#[derive(Debug, Clone)]
pub struct SuspensionBridge {
    pub name: String,
    pub main_span: f64,           // m
    pub side_span: f64,           // m
    pub tower_height: f64,        // m
    pub sag: f64,                 // m at mid-span
    pub deck_width: f64,          // m
    pub deck_elevation: f64,      // m above water
    pub main_cable: CableProperties,
    pub suspenders: SuspenderConfig,
    pub deck: DeckProperties,
    pub towers: TowerConfig,
    pub anchorage: AnchorageConfig,
}

/// Main cable properties
#[derive(Debug, Clone)]
pub struct CableProperties {
    pub diameter: f64,            // mm
    pub area: f64,                // mm²
    pub e_modulus: f64,           // GPa
    pub ultimate_strength: f64,   // MPa
    pub weight_per_length: f64,   // kN/m
    pub cable_type: CableType,
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum CableType {
    ParallelWire,
    LockedCoil,
    SpiralStrand,
}

/// Suspender configuration
#[derive(Debug, Clone)]
pub struct SuspenderConfig {
    pub spacing: f64,             // m
    pub diameter: f64,            // mm
    pub material: SuspenderMaterial,
    pub connection_type: SuspenderConnection,
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum SuspenderMaterial {
    SteelRope,
    SteelRod,
    CFRP,
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum SuspenderConnection {
    PinConnection,
    SocketConnection,
    ClampConnection,
}

/// Deck properties
#[derive(Debug, Clone)]
pub struct DeckProperties {
    pub section_type: DeckSectionType,
    pub weight: f64,              // kN/m
    pub area: f64,                // m²
    pub i_vertical: f64,          // m⁴
    pub i_lateral: f64,           // m⁴
    pub i_torsion: f64,           // m⁴
    pub e_modulus: f64,           // GPa
    pub g_modulus: f64,           // GPa
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum DeckSectionType {
    SteelTruss,
    SteelBoxGirder,
    Orthotropic,
    CompositeBox,
}

/// Tower configuration
#[derive(Debug, Clone)]
pub struct TowerConfig {
    pub tower_type: TowerType,
    pub base_width: f64,          // m
    pub top_width: f64,           // m
    pub leg_dimension: f64,       // m
    pub material: TowerMaterial,
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum TowerType {
    PortalFrame,
    DiamondShape,
    AFrame,
    HFrame,
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum TowerMaterial {
    ReinforcedConcrete,
    Steel,
    Composite,
}

/// Anchorage configuration
#[derive(Debug, Clone)]
pub struct AnchorageConfig {
    pub anchorage_type: AnchorageType,
    pub length: f64,              // m
    pub width: f64,               // m
    pub depth: f64,               // m
    pub soil_bearing: f64,        // kPa
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum AnchorageType {
    GravityAnchor,
    TunnelAnchor,
    GroundAnchor,
}

/// Cable shape analysis results
#[derive(Debug, Clone)]
pub struct CableShapeResults {
    pub positions: Vec<(f64, f64)>,  // (x, y) pairs
    pub horizontal_tension: f64,      // kN
    pub max_tension: f64,             // kN at tower
    pub cable_length: f64,            // m
    pub sag_ratio: f64,              // sag / span
}

/// Suspender forces
#[derive(Debug, Clone)]
pub struct SuspenderForces {
    pub position: f64,           // m from tower
    pub dead_load: f64,          // kN
    pub live_load: f64,          // kN
    pub wind_load: f64,          // kN
    pub total: f64,              // kN
    pub utilization: f64,        // ratio
}

/// Deflection theory results
#[derive(Debug, Clone)]
pub struct DeflectionTheoryResults {
    pub positions: Vec<f64>,
    pub deflections: Vec<f64>,
    pub additional_tensions: Vec<f64>,
    pub max_deflection: f64,
    pub max_cable_stress: f64,
}

/// Aerodynamic analysis results
#[derive(Debug, Clone)]
pub struct AerodynamicResults {
    pub flutter_speed: f64,
    pub vertical_frequency: f64,
    pub torsional_frequency: f64,
    pub lateral_frequency: f64,
    pub critical_wind_speed: f64,
    pub buffeting_response: f64,
    pub vortex_amplitude: f64,
    pub is_flutter_safe: bool,
}

impl SuspensionBridge {
    /// Create new suspension bridge
    pub fn new(name: &str, main_span: f64, side_span: f64, tower_height: f64) -> Self {
        let sag = main_span / 9.0; // Typical sag ratio 1/9
        
        SuspensionBridge {
            name: name.to_string(),
            main_span,
            side_span,
            tower_height,
            sag,
            deck_width: 30.0,
            deck_elevation: 50.0,
            main_cable: CableProperties::default_parallel_wire(main_span),
            suspenders: SuspenderConfig::default(),
            deck: DeckProperties::default_box_girder(),
            towers: TowerConfig::default_concrete(),
            anchorage: AnchorageConfig::default_gravity(),
        }
    }

    /// Parabolic cable equation: y = 4f * x * (L - x) / L²
    pub fn cable_ordinate(&self, x: f64) -> f64 {
        4.0 * self.sag * x * (self.main_span - x) / self.main_span.powi(2)
    }

    /// Cable slope at any point
    pub fn cable_slope(&self, x: f64) -> f64 {
        4.0 * self.sag * (self.main_span - 2.0 * x) / self.main_span.powi(2)
    }

    /// Horizontal cable tension under dead load
    pub fn horizontal_tension(&self) -> f64 {
        let w = self.total_weight_per_length();
        w * self.main_span.powi(2) / (8.0 * self.sag)
    }

    /// Total weight per unit length
    pub fn total_weight_per_length(&self) -> f64 {
        self.deck.weight + 2.0 * self.main_cable.weight_per_length
    }

    /// Maximum cable tension at towers
    pub fn max_cable_tension(&self) -> f64 {
        let h = self.horizontal_tension();
        let slope = self.cable_slope(0.0); // dy/dx = tan(θ)
        // T = H / cos(θ) = H * √(1 + tan²θ)
        h * (1.0 + slope.powi(2)).sqrt()
    }

    /// Cable length calculation
    pub fn cable_length(&self) -> f64 {
        let l = self.main_span;
        let f = self.sag;
        
        // Accurate parabolic length formula
        let _a = 4.0 * f / l;
        let length_main = l * (1.0 + 8.0 * (f / l).powi(2) / 3.0 - 
                          32.0 * (f / l).powi(4) / 5.0);
        
        // Side span cables (assuming straight for simplicity)
        let side_cable_length = (self.side_span.powi(2) + 
                                (self.tower_height - self.sag).powi(2)).sqrt();
        
        length_main + 2.0 * side_cable_length
    }

    /// Analyze cable shape under dead load
    pub fn analyze_cable_shape(&self, num_points: usize) -> CableShapeResults {
        let mut positions = Vec::with_capacity(num_points);
        let dx = self.main_span / (num_points - 1) as f64;
        
        for i in 0..num_points {
            let x = i as f64 * dx;
            let y = self.cable_ordinate(x);
            positions.push((x, y));
        }
        
        CableShapeResults {
            positions,
            horizontal_tension: self.horizontal_tension(),
            max_tension: self.max_cable_tension(),
            cable_length: self.cable_length(),
            sag_ratio: self.sag / self.main_span,
        }
    }

    /// Calculate suspender forces
    pub fn suspender_forces(&self) -> Vec<SuspenderForces> {
        let num_suspenders = (self.main_span / self.suspenders.spacing) as usize;
        let mut forces = Vec::with_capacity(num_suspenders);
        
        for i in 1..num_suspenders {
            let x = i as f64 * self.suspenders.spacing;
            
            // Dead load - proportional to tributary length
            let tributary = self.suspenders.spacing;
            let dead = self.deck.weight * tributary;
            
            // Live load - influence line approach
            let live = 20.0 * tributary; // Typical live load
            
            // Wind load on suspender
            let wind = 0.5 * 1.225 * 30.0_f64.powi(2) * 0.001 * 
                      (self.cable_ordinate(x) + self.deck_elevation);
            
            let total = dead + live + wind;
            let capacity = self.suspender_capacity();
            
            forces.push(SuspenderForces {
                position: x,
                dead_load: dead,
                live_load: live,
                wind_load: wind,
                total,
                utilization: total / (capacity * 0.5), // 50% limit
            });
        }
        
        forces
    }

    /// Suspender capacity
    fn suspender_capacity(&self) -> f64 {
        let area = PI * (self.suspenders.diameter / 2.0).powi(2);
        let strength = match self.suspenders.material {
            SuspenderMaterial::SteelRope => 1570.0,
            SuspenderMaterial::SteelRod => 1080.0,
            SuspenderMaterial::CFRP => 2400.0,
        };
        area * strength / 1000.0 // kN
    }

    /// Elastic theory (linear) deflection analysis
    pub fn elastic_theory_deflection(&self, load_position: f64, load: f64) -> Vec<f64> {
        let num_points = 101;
        let dx = self.main_span / (num_points - 1) as f64;
        let mut deflections = vec![0.0; num_points];
        
        let h = self.horizontal_tension();
        let l = self.main_span;
        let f = self.sag;
        
        // Influence coefficient method
        for i in 0..num_points {
            let x = i as f64 * dx;
            
            // Influence ordinate for concentrated load
            let eta = if x <= load_position {
                x * (l - load_position) / l
            } else {
                load_position * (l - x) / l
            };
            
            // Cable deflection
            let delta_cable = load * eta * l.powi(2) / (8.0 * h * f);
            
            // Deck bending contribution
            let ei = self.deck.e_modulus * 1e9 * self.deck.i_vertical;
            let delta_deck = load * x * (l - x) * (l - load_position) * load_position / 
                            (6.0 * ei * l);
            
            deflections[i] = delta_cable + delta_deck;
        }
        
        deflections
    }

    /// Deflection theory (nonlinear) analysis
    pub fn deflection_theory(&self, loads: &[(f64, f64)]) -> DeflectionTheoryResults {
        let num_points = 51;
        let dx = self.main_span / (num_points - 1) as f64;
        
        let mut positions = vec![0.0; num_points];
        let mut deflections = vec![0.0; num_points];
        let mut additional_tensions = vec![0.0; num_points];
        
        let h = self.horizontal_tension();
        let w = self.total_weight_per_length();
        let l = self.main_span;
        let f = self.sag;
        let ac = self.main_cable.area;
        let ec = self.main_cable.e_modulus * 1e3;
        
        // Cable extensibility parameter
        let lambda = (w * l / h) * (ec * ac / (h * l));
        
        // Iterative solution
        let mut delta_h: f64 = 0.0;
        
        for _iteration in 0..10 {
            let mut sum_p_eta = 0.0;
            
            for (pos, load) in loads {
                let x = *pos;
                let p = *load;
                let eta = 4.0 * x * (l - x) / l.powi(2);
                sum_p_eta += p * eta;
            }
            
            // Additional horizontal tension
            let new_delta_h = sum_p_eta * l / (8.0 * f * (1.0 + lambda / 2.0));
            
            if (new_delta_h - delta_h).abs() < 0.1 {
                break;
            }
            delta_h = new_delta_h;
        }
        
        // Calculate deflections with converged delta_h
        for i in 0..num_points {
            let x = i as f64 * dx;
            positions[i] = x;
            
            // Cable profile change
            let y_orig = self.cable_ordinate(x);
            let delta_y = -delta_h * y_orig / h;
            
            // Load deflection contribution
            let mut load_deflection: f64 = 0.0;
            for (pos, load) in loads {
                let eta = if x <= *pos {
                    x * (l - *pos) / l
                } else {
                    *pos * (l - x) / l
                };
                load_deflection += load * eta * l / (8.0 * (h + delta_h) * f / l);
            }
            
            deflections[i] = delta_y + load_deflection;
            additional_tensions[i] = delta_h;
        }
        
        let max_deflection = deflections.iter().fold(0.0_f64, |a, &b| a.max(b.abs()));
        let max_stress = (h + delta_h) / ac * 1000.0; // MPa
        
        DeflectionTheoryResults {
            positions,
            deflections,
            additional_tensions,
            max_deflection,
            max_cable_stress: max_stress,
        }
    }

    /// Natural frequencies of the bridge
    pub fn natural_frequencies(&self) -> BridgeFrequencies {
        let m = (self.deck.weight + 2.0 * self.main_cable.weight_per_length) * 1000.0 / 9.81; // kg/m
        let l = self.main_span;
        let h = self.horizontal_tension() * 1000.0; // N
        let ei = self.deck.e_modulus * 1e9 * self.deck.i_vertical;
        let gj = self.deck.g_modulus * 1e9 * self.deck.i_torsion;
        
        // First vertical mode (asymmetric)
        let omega_v1 = PI / l * (h / m).sqrt();
        let f_v1 = omega_v1 / (2.0 * PI);
        
        // First vertical mode (symmetric)
        let le = 0.8 * l; // Effective length for symmetric mode
        let omega_v2 = PI / le * ((h + PI.powi(2) * ei / le.powi(2)) / m).sqrt();
        let f_v2 = omega_v2 / (2.0 * PI);
        
        // First lateral mode
        let ei_lateral = self.deck.e_modulus * 1e9 * self.deck.i_lateral;
        let omega_l = (PI / l).powi(2) * (ei_lateral / m).sqrt();
        let f_l = omega_l / (2.0 * PI);
        
        // First torsional mode
        let i_theta = m * self.deck_width.powi(2) / 12.0;
        let cable_torsional_stiffness = h * self.deck_width.powi(2) / (2.0 * l.powi(2));
        let omega_t = (PI / l) * ((gj + cable_torsional_stiffness) / i_theta).sqrt();
        let f_t = omega_t / (2.0 * PI);
        
        BridgeFrequencies {
            vertical_antisym: f_v1,
            vertical_sym: f_v2,
            lateral: f_l,
            torsional: f_t,
            frequency_ratio: f_t / f_v1,
        }
    }

    /// Aerodynamic stability analysis
    pub fn aerodynamic_analysis(&self, design_wind_speed: f64) -> AerodynamicResults {
        let freq = self.natural_frequencies();
        let b = self.deck_width;
        let d = 3.0; // Deck depth estimate
        
        // Selberg formula for flutter speed
        let gamma = freq.frequency_ratio;
        let m = self.deck.weight * 1000.0 / 9.81;
        let _r = (m * b.powi(2) / 12.0).sqrt();
        let mu = m / (PI * 1.225 * b.powi(2));
        
        let v_flutter = if gamma > 1.0 {
            let k_f = (1.0 - 1.0 / gamma.powi(2)).sqrt() * gamma.sqrt();
            0.44 * k_f * freq.vertical_antisym * b * mu.sqrt()
        } else {
            0.0
        };
        
        // Critical wind speed for vortex shedding
        let st = 0.12; // Strouhal number
        let v_crit = freq.vertical_antisym * d / st;
        
        // Buffeting response (simplified)
        let i_u = 0.2; // Turbulence intensity
        let buffeting = design_wind_speed * i_u * b * 0.001;
        
        // Vortex-induced amplitude
        let sc = 2.0 * m * 0.02 / (1.225 * d.powi(2)); // Scruton number
        let vortex_amp = if sc > 10.0 {
            d * 0.1 / sc
        } else {
            d * 0.01
        };
        
        AerodynamicResults {
            flutter_speed: v_flutter,
            vertical_frequency: freq.vertical_antisym,
            torsional_frequency: freq.torsional,
            lateral_frequency: freq.lateral,
            critical_wind_speed: v_crit,
            buffeting_response: buffeting,
            vortex_amplitude: vortex_amp,
            is_flutter_safe: v_flutter > 1.5 * design_wind_speed,
        }
    }

    /// Tower forces analysis
    pub fn tower_forces(&self) -> TowerForceResults {
        let h = self.horizontal_tension();
        let t_max = self.max_cable_tension();
        
        // Vertical force from cables
        // V = T * sin(θ) = H * tan(θ) = H * slope
        let slope_at_tower = self.cable_slope(0.0);
        let v_main = 2.0 * h * slope_at_tower.abs();
        let v_side = self.side_span_tension() * 
                    (self.tower_height / (self.tower_height.powi(2) + 
                     self.side_span.powi(2)).sqrt());
        
        let total_vertical = v_main + v_side + self.tower_self_weight();
        
        // Horizontal force difference
        let h_main = h;
        let h_side = self.side_span_tension() * 
                    self.side_span / (self.tower_height.powi(2) + 
                    self.side_span.powi(2)).sqrt();
        
        let net_horizontal = (h_main - h_side).abs();
        
        // Wind load on tower
        let wind_pressure = 0.5 * 1.225 * 40.0_f64.powi(2) * 1.3;
        let exposed_area = self.tower_height * self.towers.leg_dimension * 2.0;
        let wind_force = wind_pressure * exposed_area / 1000.0;
        
        TowerForceResults {
            axial_compression: total_vertical,
            longitudinal_moment: net_horizontal * self.tower_height * 0.5,
            transverse_moment: wind_force * self.tower_height * 0.5,
            base_shear_x: net_horizontal,
            base_shear_y: wind_force,
            saddle_force: t_max,
        }
    }

    /// Side span cable tension
    fn side_span_tension(&self) -> f64 {
        let w = self.total_weight_per_length();
        let l = self.side_span;
        let h_diff = self.tower_height - self.sag;
        
        let length = (l.powi(2) + h_diff.powi(2)).sqrt();
        w * l.powi(2) / (8.0 * (length - l) * 0.1_f64.max(h_diff / length))
    }

    /// Tower self-weight
    fn tower_self_weight(&self) -> f64 {
        let avg_area = (self.towers.base_width * self.towers.leg_dimension +
                       self.towers.top_width * self.towers.leg_dimension) / 2.0;
        let density = match self.towers.material {
            TowerMaterial::ReinforcedConcrete => 25.0,
            TowerMaterial::Steel => 78.5,
            TowerMaterial::Composite => 35.0,
        };
        2.0 * avg_area * self.tower_height * density
    }

    /// Anchorage forces
    pub fn anchorage_forces(&self) -> AnchorageForceResults {
        let t_max = self.max_cable_tension() * 2.0; // Both cables
        
        let anchor_angle = (self.tower_height / self.side_span).atan();
        let horizontal = t_max * anchor_angle.cos();
        let vertical = t_max * anchor_angle.sin();
        
        // Required weight for gravity anchor
        let friction = 0.6; // Soil friction coefficient
        let required_weight = horizontal / friction + vertical;
        
        // Actual anchor weight
        let density = 24.0; // kN/m³ for concrete
        let actual_weight = self.anchorage.length * self.anchorage.width * 
                           self.anchorage.depth * density;
        
        // Bearing pressure
        let bearing_area = self.anchorage.length * self.anchorage.width;
        let bearing_pressure = (actual_weight + vertical) / bearing_area;
        
        AnchorageForceResults {
            cable_horizontal: horizontal,
            cable_vertical: vertical,
            required_weight,
            actual_weight,
            safety_factor: actual_weight / required_weight,
            bearing_pressure,
            bearing_adequate: bearing_pressure < self.anchorage.soil_bearing,
        }
    }

    /// Construction sequence analysis
    pub fn construction_sequence(&self, method: ConstructionMethod) -> Vec<ConstructionStage> {
        let mut stages = Vec::new();
        
        match method {
            ConstructionMethod::AerialSpinning => {
                stages.push(ConstructionStage {
                    name: "Tower Construction".to_string(),
                    duration_days: 365,
                    critical_loads: vec![
                        ("Tower self-weight".to_string(), self.tower_self_weight()),
                    ],
                    temporary_works: vec!["Climbing formwork".to_string()],
                });
                
                stages.push(ConstructionStage {
                    name: "Cable Spinning".to_string(),
                    duration_days: 180,
                    critical_loads: vec![
                        ("Spinning wheel".to_string(), 100.0),
                        ("Wire bundle".to_string(), 50.0),
                    ],
                    temporary_works: vec!["Catwalks".to_string(), "Spinning wheels".to_string()],
                });
                
                stages.push(ConstructionStage {
                    name: "Cable Compaction".to_string(),
                    duration_days: 90,
                    critical_loads: vec![
                        ("Compaction machine".to_string(), 80.0),
                    ],
                    temporary_works: vec!["Compaction equipment".to_string()],
                });
                
                stages.push(ConstructionStage {
                    name: "Suspender Installation".to_string(),
                    duration_days: 120,
                    critical_loads: vec![
                        ("Suspender loads".to_string(), 200.0),
                    ],
                    temporary_works: vec!["Working platforms".to_string()],
                });
                
                stages.push(ConstructionStage {
                    name: "Deck Erection".to_string(),
                    duration_days: 240,
                    critical_loads: vec![
                        ("Deck segment".to_string(), self.deck.weight * 20.0),
                    ],
                    temporary_works: vec!["Lifting equipment".to_string()],
                });
            },
            
            ConstructionMethod::PrefabricatedStrand => {
                stages.push(ConstructionStage {
                    name: "Tower Construction".to_string(),
                    duration_days: 365,
                    critical_loads: vec![
                        ("Tower self-weight".to_string(), self.tower_self_weight()),
                    ],
                    temporary_works: vec!["Climbing formwork".to_string()],
                });
                
                stages.push(ConstructionStage {
                    name: "PPWS Installation".to_string(),
                    duration_days: 120,
                    critical_loads: vec![
                        ("Strand bundle".to_string(), 200.0),
                        ("Hauling equipment".to_string(), 150.0),
                    ],
                    temporary_works: vec!["Catwalks".to_string(), "Hauling system".to_string()],
                });
                
                stages.push(ConstructionStage {
                    name: "Deck Installation".to_string(),
                    duration_days: 200,
                    critical_loads: vec![
                        ("Deck panel".to_string(), self.deck.weight * 15.0),
                    ],
                    temporary_works: vec!["Erection gantry".to_string()],
                });
            },
        }
        
        stages
    }

    /// Load combination analysis
    pub fn load_combinations(&self) -> Vec<LoadCombinationResult> {
        let mut results = Vec::new();
        
        let dead = self.horizontal_tension();
        let live = dead * 0.15; // Approximate live load effect
        let wind = dead * 0.20; // Approximate wind effect
        let temp = dead * 0.05; // Temperature effect
        let seismic = dead * 0.25; // Seismic effect
        
        // Strength I (gravity)
        results.push(LoadCombinationResult {
            name: "Strength I".to_string(),
            cable_tension: 1.25 * dead + 1.75 * live,
            factors: vec![1.25, 1.75, 0.0, 0.0],
            utilization: (1.25 * dead + 1.75 * live) / 
                        (self.main_cable.area * self.main_cable.ultimate_strength / 1000.0 * 0.65),
        });
        
        // Strength III (wind)
        results.push(LoadCombinationResult {
            name: "Strength III".to_string(),
            cable_tension: 1.25 * dead + 1.4 * wind,
            factors: vec![1.25, 0.0, 1.4, 0.0],
            utilization: (1.25 * dead + 1.4 * wind) / 
                        (self.main_cable.area * self.main_cable.ultimate_strength / 1000.0 * 0.65),
        });
        
        // Extreme Event I (seismic)
        results.push(LoadCombinationResult {
            name: "Extreme Event I".to_string(),
            cable_tension: 1.25 * dead + 0.5 * live + seismic,
            factors: vec![1.25, 0.5, 0.0, 1.0],
            utilization: (1.25 * dead + 0.5 * live + seismic) / 
                        (self.main_cable.area * self.main_cable.ultimate_strength / 1000.0 * 0.80),
        });
        
        // Service I
        results.push(LoadCombinationResult {
            name: "Service I".to_string(),
            cable_tension: dead + live + 0.3 * wind + temp,
            factors: vec![1.0, 1.0, 0.3, 1.0],
            utilization: (dead + live + 0.3 * wind + temp) / 
                        (self.main_cable.area * self.main_cable.ultimate_strength / 1000.0 * 0.45),
        });
        
        results
    }

    /// Inspection planning
    pub fn inspection_plan(&self) -> InspectionPlan {
        let num_suspenders = (self.main_span / self.suspenders.spacing) as usize;
        
        InspectionPlan {
            main_cable_inspection: InspectionTask {
                component: "Main Cables".to_string(),
                frequency_years: 2,
                method: "Visual + acoustic monitoring".to_string(),
                access: "Catwalk or rope access".to_string(),
                critical_items: vec![
                    "Wire breaks".to_string(),
                    "Corrosion".to_string(),
                    "Wrapping condition".to_string(),
                ],
            },
            suspender_inspection: InspectionTask {
                component: "Suspenders".to_string(),
                frequency_years: 5,
                method: "Visual + tension measurement".to_string(),
                access: "MEWP or rope access".to_string(),
                critical_items: vec![
                    "Socket condition".to_string(),
                    "Wire rope condition".to_string(),
                    "Connection pins".to_string(),
                ],
            },
            tower_inspection: InspectionTask {
                component: "Towers".to_string(),
                frequency_years: 6,
                method: "Visual + NDT".to_string(),
                access: "Internal access + rope access".to_string(),
                critical_items: vec![
                    "Concrete cracking".to_string(),
                    "Steel corrosion".to_string(),
                    "Saddle condition".to_string(),
                ],
            },
            deck_inspection: InspectionTask {
                component: "Deck".to_string(),
                frequency_years: 2,
                method: "Visual + fatigue monitoring".to_string(),
                access: "Underbridge unit".to_string(),
                critical_items: vec![
                    "Fatigue cracks".to_string(),
                    "Connection condition".to_string(),
                    "Corrosion".to_string(),
                ],
            },
            total_suspenders: num_suspenders,
            estimated_days: num_suspenders / 10 + 30, // 10 suspenders/day + other work
        }
    }
}

/// Bridge frequencies
#[derive(Debug, Clone)]
pub struct BridgeFrequencies {
    pub vertical_antisym: f64,
    pub vertical_sym: f64,
    pub lateral: f64,
    pub torsional: f64,
    pub frequency_ratio: f64,
}

/// Tower force results
#[derive(Debug, Clone)]
pub struct TowerForceResults {
    pub axial_compression: f64,
    pub longitudinal_moment: f64,
    pub transverse_moment: f64,
    pub base_shear_x: f64,
    pub base_shear_y: f64,
    pub saddle_force: f64,
}

/// Anchorage force results
#[derive(Debug, Clone)]
pub struct AnchorageForceResults {
    pub cable_horizontal: f64,
    pub cable_vertical: f64,
    pub required_weight: f64,
    pub actual_weight: f64,
    pub safety_factor: f64,
    pub bearing_pressure: f64,
    pub bearing_adequate: bool,
}

/// Construction method
#[derive(Debug, Clone, Copy)]
pub enum ConstructionMethod {
    AerialSpinning,
    PrefabricatedStrand,
}

/// Construction stage
#[derive(Debug, Clone)]
pub struct ConstructionStage {
    pub name: String,
    pub duration_days: u32,
    pub critical_loads: Vec<(String, f64)>,
    pub temporary_works: Vec<String>,
}

/// Load combination result
#[derive(Debug, Clone)]
pub struct LoadCombinationResult {
    pub name: String,
    pub cable_tension: f64,
    pub factors: Vec<f64>,
    pub utilization: f64,
}

/// Inspection plan
#[derive(Debug, Clone)]
pub struct InspectionPlan {
    pub main_cable_inspection: InspectionTask,
    pub suspender_inspection: InspectionTask,
    pub tower_inspection: InspectionTask,
    pub deck_inspection: InspectionTask,
    pub total_suspenders: usize,
    pub estimated_days: usize,
}

/// Inspection task
#[derive(Debug, Clone)]
pub struct InspectionTask {
    pub component: String,
    pub frequency_years: u32,
    pub method: String,
    pub access: String,
    pub critical_items: Vec<String>,
}

impl CableProperties {
    pub fn default_parallel_wire(span: f64) -> Self {
        // Size cable based on span
        let area = span * 50.0; // Rough sizing
        let diameter = (4.0 * area / PI).sqrt();
        
        CableProperties {
            diameter,
            area,
            e_modulus: 200.0,
            ultimate_strength: 1770.0,
            weight_per_length: area * 78.5e-6, // kN/m
            cable_type: CableType::ParallelWire,
        }
    }
    
    pub fn locked_coil(diameter: f64) -> Self {
        let area = PI * (diameter / 2.0).powi(2) * 0.85; // Fill factor
        
        CableProperties {
            diameter,
            area,
            e_modulus: 160.0,
            ultimate_strength: 1570.0,
            weight_per_length: area * 78.5e-6,
            cable_type: CableType::LockedCoil,
        }
    }
}

impl SuspenderConfig {
    pub fn default() -> Self {
        SuspenderConfig {
            spacing: 15.0,
            diameter: 80.0,
            material: SuspenderMaterial::SteelRope,
            connection_type: SuspenderConnection::SocketConnection,
        }
    }
}

impl DeckProperties {
    pub fn default_box_girder() -> Self {
        DeckProperties {
            section_type: DeckSectionType::SteelBoxGirder,
            weight: 200.0,
            area: 5.0,
            i_vertical: 2.0,
            i_lateral: 100.0,
            i_torsion: 5.0,
            e_modulus: 210.0,
            g_modulus: 81.0,
        }
    }
    
    pub fn orthotropic(width: f64) -> Self {
        DeckProperties {
            section_type: DeckSectionType::Orthotropic,
            weight: 180.0,
            area: 3.0,
            i_vertical: 1.5,
            i_lateral: width.powi(3) * 0.02,
            i_torsion: 3.0,
            e_modulus: 210.0,
            g_modulus: 81.0,
        }
    }
}

impl TowerConfig {
    pub fn default_concrete() -> Self {
        TowerConfig {
            tower_type: TowerType::PortalFrame,
            base_width: 30.0,
            top_width: 15.0,
            leg_dimension: 10.0,
            material: TowerMaterial::ReinforcedConcrete,
        }
    }
    
    pub fn steel_tower(height: f64) -> Self {
        TowerConfig {
            tower_type: TowerType::AFrame,
            base_width: height * 0.25,
            top_width: height * 0.1,
            leg_dimension: height * 0.05,
            material: TowerMaterial::Steel,
        }
    }
}

impl AnchorageConfig {
    pub fn default_gravity() -> Self {
        AnchorageConfig {
            anchorage_type: AnchorageType::GravityAnchor,
            length: 60.0,
            width: 40.0,
            depth: 30.0,
            soil_bearing: 500.0,
        }
    }
    
    pub fn tunnel_anchor(rock_strength: f64) -> Self {
        AnchorageConfig {
            anchorage_type: AnchorageType::TunnelAnchor,
            length: 80.0,
            width: 20.0,
            depth: 15.0,
            soil_bearing: rock_strength,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_bridge_creation() {
        let bridge = SuspensionBridge::new("Test Bridge", 1000.0, 300.0, 200.0);
        assert_eq!(bridge.main_span, 1000.0);
        assert_eq!(bridge.side_span, 300.0);
        assert!((bridge.sag - 1000.0 / 9.0).abs() < 0.1);
    }
    
    #[test]
    fn test_cable_ordinate() {
        let bridge = SuspensionBridge::new("Test", 1000.0, 300.0, 200.0);
        
        // At supports, y = 0
        assert!((bridge.cable_ordinate(0.0)).abs() < 0.001);
        assert!((bridge.cable_ordinate(1000.0)).abs() < 0.001);
        
        // At mid-span, y = sag
        assert!((bridge.cable_ordinate(500.0) - bridge.sag).abs() < 0.1);
    }
    
    #[test]
    fn test_horizontal_tension() {
        let bridge = SuspensionBridge::new("Test", 1000.0, 300.0, 200.0);
        let h = bridge.horizontal_tension();
        
        // Should be positive and significant
        assert!(h > 10000.0);
        
        // H = wL² / 8f
        let expected = bridge.total_weight_per_length() * 1000.0_f64.powi(2) / 
                      (8.0 * bridge.sag);
        assert!((h - expected).abs() < 1.0);
    }
    
    #[test]
    fn test_cable_length() {
        let bridge = SuspensionBridge::new("Test", 1000.0, 300.0, 200.0);
        let length = bridge.cable_length();
        
        // Cable length should be greater than span
        assert!(length > bridge.main_span + 2.0 * bridge.side_span);
    }
    
    #[test]
    fn test_cable_shape() {
        let bridge = SuspensionBridge::new("Test", 1000.0, 300.0, 200.0);
        let shape = bridge.analyze_cable_shape(21);
        
        assert_eq!(shape.positions.len(), 21);
        assert!(shape.horizontal_tension > 0.0);
        assert!(shape.max_tension > shape.horizontal_tension);
    }
    
    #[test]
    fn test_suspender_forces() {
        let bridge = SuspensionBridge::new("Test", 1000.0, 300.0, 200.0);
        let forces = bridge.suspender_forces();
        
        assert!(!forces.is_empty());
        assert!(forces.iter().all(|f| f.dead_load > 0.0));
    }
    
    #[test]
    fn test_elastic_deflection() {
        let bridge = SuspensionBridge::new("Test", 1000.0, 300.0, 200.0);
        let deflections = bridge.elastic_theory_deflection(500.0, 1000.0);
        
        assert_eq!(deflections.len(), 101);
        // Maximum should be near load position
        let max_idx = deflections.iter()
            .enumerate()
            .max_by(|(_, a), (_, b)| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal))
            .map(|(i, _)| i)
            .unwrap();
        assert!((max_idx as f64 - 50.0).abs() < 10.0);
    }
    
    #[test]
    fn test_deflection_theory() {
        let bridge = SuspensionBridge::new("Test", 1000.0, 300.0, 200.0);
        let loads = vec![(500.0, 1000.0)];
        let results = bridge.deflection_theory(&loads);
        
        assert_eq!(results.positions.len(), 51);
        assert!(results.max_deflection > 0.0);
        assert!(results.max_cable_stress > 0.0);
    }
    
    #[test]
    fn test_natural_frequencies() {
        let bridge = SuspensionBridge::new("Test", 1000.0, 300.0, 200.0);
        let freq = bridge.natural_frequencies();
        
        assert!(freq.vertical_antisym > 0.0);
        assert!(freq.torsional > 0.0);
        assert!(freq.frequency_ratio > 0.0);
    }
    
    #[test]
    fn test_aerodynamic_analysis() {
        let bridge = SuspensionBridge::new("Test", 1000.0, 300.0, 200.0);
        let aero = bridge.aerodynamic_analysis(40.0);
        
        assert!(aero.vertical_frequency > 0.0);
        assert!(aero.flutter_speed > 0.0 || !aero.is_flutter_safe);
    }
    
    #[test]
    fn test_tower_forces() {
        let bridge = SuspensionBridge::new("Test", 1000.0, 300.0, 200.0);
        let forces = bridge.tower_forces();
        
        assert!(forces.axial_compression > 0.0);
        assert!(forces.saddle_force > 0.0);
    }
    
    #[test]
    fn test_anchorage_forces() {
        let bridge = SuspensionBridge::new("Test", 1000.0, 300.0, 200.0);
        let forces = bridge.anchorage_forces();
        
        assert!(forces.cable_horizontal > 0.0);
        assert!(forces.safety_factor > 0.0);
    }
    
    #[test]
    fn test_construction_sequence() {
        let bridge = SuspensionBridge::new("Test", 1000.0, 300.0, 200.0);
        let stages = bridge.construction_sequence(ConstructionMethod::AerialSpinning);
        
        assert!(!stages.is_empty());
        assert!(stages.iter().any(|s| s.name.contains("Cable")));
    }
    
    #[test]
    fn test_load_combinations() {
        let bridge = SuspensionBridge::new("Test", 1000.0, 300.0, 200.0);
        let combos = bridge.load_combinations();
        
        assert!(!combos.is_empty());
        assert!(combos.iter().any(|c| c.name.contains("Strength")));
    }
    
    #[test]
    fn test_inspection_plan() {
        let bridge = SuspensionBridge::new("Test", 1000.0, 300.0, 200.0);
        let plan = bridge.inspection_plan();
        
        assert!(plan.total_suspenders > 0);
        assert!(plan.estimated_days > 0);
    }
    
    #[test]
    fn test_cable_properties() {
        let pw = CableProperties::default_parallel_wire(1000.0);
        assert_eq!(pw.cable_type, CableType::ParallelWire);
        assert!(pw.area > 0.0);
        
        let lc = CableProperties::locked_coil(150.0);
        assert_eq!(lc.cable_type, CableType::LockedCoil);
    }
    
    #[test]
    fn test_deck_properties() {
        let box_girder = DeckProperties::default_box_girder();
        assert_eq!(box_girder.section_type, DeckSectionType::SteelBoxGirder);
        
        let ortho = DeckProperties::orthotropic(30.0);
        assert_eq!(ortho.section_type, DeckSectionType::Orthotropic);
    }
    
    #[test]
    fn test_tower_config() {
        let concrete = TowerConfig::default_concrete();
        assert_eq!(concrete.material, TowerMaterial::ReinforcedConcrete);
        
        let steel = TowerConfig::steel_tower(200.0);
        assert_eq!(steel.material, TowerMaterial::Steel);
    }
    
    #[test]
    fn test_anchorage_config() {
        let gravity = AnchorageConfig::default_gravity();
        assert_eq!(gravity.anchorage_type, AnchorageType::GravityAnchor);
        
        let tunnel = AnchorageConfig::tunnel_anchor(50000.0);
        assert_eq!(tunnel.anchorage_type, AnchorageType::TunnelAnchor);
    }
}
