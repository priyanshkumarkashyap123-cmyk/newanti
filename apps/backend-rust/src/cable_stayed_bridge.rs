// Cable-Stayed Bridge Analysis Module
// Comprehensive analysis for cable-stayed bridge structures


/// Cable-stayed bridge configuration
#[derive(Debug, Clone)]
pub struct CableStayedBridge {
    pub name: String,
    pub main_span: f64,          // m
    pub back_span: f64,          // m
    pub tower_height: f64,       // m
    pub deck_width: f64,         // m
    pub deck_depth: f64,         // m
    pub tower_type: TowerType,
    pub cable_arrangement: CableArrangement,
    pub cables: Vec<CableElement>,
    pub deck_properties: DeckProperties,
    pub tower_properties: TowerProperties,
}

/// Tower configuration types
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum TowerType {
    SinglePylon,
    HPylon,
    APylon,
    DiamondPylon,
    InvertedY,
}

/// Cable arrangement patterns
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum CableArrangement {
    Fan,
    Harp,
    SemiFan,
    Radial,
}

/// Individual cable element
#[derive(Debug, Clone)]
pub struct CableElement {
    pub id: usize,
    pub anchor_deck: (f64, f64, f64),   // x, y, z
    pub anchor_tower: (f64, f64, f64),  // x, y, z
    pub area: f64,                       // mm²
    pub e_modulus: f64,                  // GPa
    pub pretension: f64,                 // kN
    pub ultimate_strength: f64,          // MPa
}

/// Deck section properties
#[derive(Debug, Clone)]
pub struct DeckProperties {
    pub section_type: DeckSectionType,
    pub area: f64,           // m²
    pub i_xx: f64,           // m⁴
    pub i_yy: f64,           // m⁴
    pub j_torsion: f64,      // m⁴
    pub e_modulus: f64,      // GPa
    pub weight: f64,         // kN/m
}

/// Deck section types
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum DeckSectionType {
    SteelBoxGirder,
    ConcreteBoxGirder,
    CompositeBoxGirder,
    SteelTruss,
    Orthotropic,
}

/// Tower section properties
#[derive(Debug, Clone)]
pub struct TowerProperties {
    pub base_area: f64,      // m²
    pub top_area: f64,       // m²
    pub base_inertia: f64,   // m⁴
    pub top_inertia: f64,    // m⁴
    pub e_modulus: f64,      // GPa
    pub material: TowerMaterial,
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum TowerMaterial {
    ReinforcedConcrete,
    SteelHollow,
    Composite,
}

/// Cable force distribution
#[derive(Debug, Clone)]
pub struct CableForces {
    pub cable_id: usize,
    pub dead_load: f64,      // kN
    pub live_load: f64,      // kN
    pub temperature: f64,    // kN
    pub wind_load: f64,      // kN
    pub seismic: f64,        // kN
    pub total: f64,          // kN
    pub utilization: f64,    // ratio
}

/// Deck deflection results
#[derive(Debug, Clone)]
pub struct DeckDeflections {
    pub position: f64,       // m from left support
    pub vertical: f64,       // mm
    pub lateral: f64,        // mm
    pub rotation: f64,       // rad
    pub load_case: String,
}

/// Cable sag analysis
#[derive(Debug, Clone)]
pub struct CableSagAnalysis {
    pub cable_id: usize,
    pub chord_length: f64,   // m
    pub sag: f64,            // m
    pub equivalent_e: f64,   // GPa (Ernst formula)
    pub true_length: f64,    // m
    pub horizontal_force: f64, // kN
}

impl CableStayedBridge {
    /// Create a new cable-stayed bridge
    pub fn new(name: &str, main_span: f64, back_span: f64, tower_height: f64) -> Self {
        CableStayedBridge {
            name: name.to_string(),
            main_span,
            back_span,
            tower_height,
            deck_width: 20.0,
            deck_depth: 2.5,
            tower_type: TowerType::HPylon,
            cable_arrangement: CableArrangement::SemiFan,
            cables: Vec::new(),
            deck_properties: DeckProperties::default_composite(),
            tower_properties: TowerProperties::default_concrete(),
        }
    }

    /// Generate cable layout
    pub fn generate_cables(&mut self, num_cables_per_plane: usize, num_planes: usize) {
        let cable_spacing = self.main_span / (num_cables_per_plane as f64 + 1.0);
        let tower_spacing = self.tower_height / (num_cables_per_plane as f64);
        
        let mut cable_id = 0;
        for plane in 0..num_planes {
            let y_offset = match num_planes {
                1 => 0.0,
                2 => if plane == 0 { -self.deck_width / 4.0 } else { self.deck_width / 4.0 },
                _ => (plane as f64 - (num_planes - 1) as f64 / 2.0) * self.deck_width / num_planes as f64,
            };
            
            // Main span cables
            for i in 1..=num_cables_per_plane {
                let x_deck = i as f64 * cable_spacing;
                let z_tower = match self.cable_arrangement {
                    CableArrangement::Fan => self.tower_height,
                    CableArrangement::Harp => i as f64 * tower_spacing,
                    CableArrangement::SemiFan => self.tower_height * 0.8 + i as f64 * tower_spacing * 0.2,
                    CableArrangement::Radial => self.tower_height * 0.9,
                };
                
                self.cables.push(CableElement {
                    id: cable_id,
                    anchor_deck: (x_deck, y_offset, 0.0),
                    anchor_tower: (0.0, y_offset, z_tower),
                    area: 5000.0,
                    e_modulus: 190.0,
                    pretension: 2000.0,
                    ultimate_strength: 1860.0,
                });
                cable_id += 1;
            }
            
            // Back span cables
            for i in 1..=num_cables_per_plane {
                let x_deck = -(i as f64) * self.back_span / (num_cables_per_plane as f64 + 1.0);
                let z_tower = match self.cable_arrangement {
                    CableArrangement::Fan => self.tower_height,
                    CableArrangement::Harp => i as f64 * tower_spacing,
                    CableArrangement::SemiFan => self.tower_height * 0.8 + i as f64 * tower_spacing * 0.2,
                    CableArrangement::Radial => self.tower_height * 0.9,
                };
                
                self.cables.push(CableElement {
                    id: cable_id,
                    anchor_deck: (x_deck, y_offset, 0.0),
                    anchor_tower: (0.0, y_offset, z_tower),
                    area: 5000.0,
                    e_modulus: 190.0,
                    pretension: 2200.0,
                    ultimate_strength: 1860.0,
                });
                cable_id += 1;
            }
        }
    }

    /// Calculate cable geometry
    pub fn cable_geometry(&self, cable: &CableElement) -> CableGeometry {
        let dx = cable.anchor_tower.0 - cable.anchor_deck.0;
        let dy = cable.anchor_tower.1 - cable.anchor_deck.1;
        let dz = cable.anchor_tower.2 - cable.anchor_deck.2;
        
        let length = (dx * dx + dy * dy + dz * dz).sqrt();
        let horizontal = (dx * dx + dy * dy).sqrt();
        let angle = (dz / horizontal).atan().to_degrees();
        
        CableGeometry {
            length,
            horizontal_projection: horizontal,
            vertical_projection: dz,
            angle_to_horizontal: angle,
            direction_cosines: (dx / length, dy / length, dz / length),
        }
    }

    /// Ernst equivalent modulus for cable sag
    pub fn ernst_modulus(&self, cable: &CableElement, tension: f64) -> f64 {
        let geom = self.cable_geometry(cable);
        let w = cable.area * 78.5e-6; // kN/m (steel weight: area_mm² × 1e-6 m²/mm² × 78.5 kN/m³)
        let l = geom.horizontal_projection;
        
        // Ernst formula: E_eq = E / (1 + (w*L)^2 * E * A / (12 * T^3))
        // Units: w(kN/m), L(m), E(GPa), A(mm²), T(kN) → dimensionless
        let sag_factor = (w * l).powi(2) * cable.e_modulus * cable.area / (12.0 * tension.powi(3));
        cable.e_modulus / (1.0 + sag_factor)
    }

    /// Calculate cable sag
    pub fn cable_sag(&self, cable: &CableElement, tension: f64) -> CableSagAnalysis {
        let geom = self.cable_geometry(cable);
        let w = cable.area * 78.5e-6; // kN/m (area_mm² × 1e-6 m²/mm² × 78.5 kN/m³)
        let l = geom.horizontal_projection;
        
        // Parabolic approximation: sag = w * L² / (8 * H)
        let h_force = tension * geom.horizontal_projection / geom.length;
        let sag = w * l * l / (8.0 * h_force.max(1.0));
        
        // True length with sag (chord length + sag elongation)
        let chord = geom.length;
        let true_length = chord * (1.0 + 8.0 * (sag / chord).powi(2) / 3.0);
        
        CableSagAnalysis {
            cable_id: cable.id,
            chord_length: chord,
            sag,
            equivalent_e: self.ernst_modulus(cable, tension),
            true_length,
            horizontal_force: h_force,
        }
    }

    /// Initial cable pretension optimization
    pub fn optimize_pretension(&mut self) -> Vec<f64> {
        let num_cables = self.cables.len();
        let mut pretensions = vec![0.0; num_cables];
        
        // Target: Minimize deck bending moments under dead load
        // Using influence matrix method (simplified)
        
        let deck_weight = self.deck_properties.weight;
        
        for (i, cable) in self.cables.iter().enumerate() {
            let geom = self.cable_geometry(cable);
            
            // Vertical component required to support deck weight
            // in tributary area
            let tributary_length = self.main_span / (num_cables as f64 / 2.0);
            let vertical_load = deck_weight * tributary_length;
            
            // Required tension
            let sin_angle = geom.vertical_projection / geom.length;
            let required_tension = vertical_load / sin_angle;
            
            // Factor for continuity effects
            let factor = 1.1;
            pretensions[i] = required_tension * factor;
        }
        
        // Update cable pretensions
        for (i, cable) in self.cables.iter_mut().enumerate() {
            cable.pretension = pretensions[i];
        }
        
        pretensions
    }

    /// Dead load cable forces
    pub fn dead_load_forces(&self) -> Vec<CableForces> {
        let mut forces = Vec::new();
        
        for cable in &self.cables {
            let geom = self.cable_geometry(cable);
            
            // Self-weight contribution
            let cable_weight = cable.area * 78.5e-6 * geom.length;
            
            // Deck load contribution
            let tributary = self.main_span / (self.cables.len() as f64 / 4.0);
            let deck_load = self.deck_properties.weight * tributary;
            
            let vertical_load = cable_weight + deck_load;
            let sin_angle = geom.vertical_projection / geom.length;
            let tension = vertical_load / sin_angle;
            
            let capacity = cable.area * cable.ultimate_strength / 1000.0;
            
            forces.push(CableForces {
                cable_id: cable.id,
                dead_load: tension,
                live_load: 0.0,
                temperature: 0.0,
                wind_load: 0.0,
                seismic: 0.0,
                total: tension,
                utilization: tension / (capacity * 0.45), // 45% limit for fatigue
            });
        }
        
        forces
    }

    /// Live load effects on cables
    pub fn live_load_forces(&self, position: f64, load_intensity: f64) -> Vec<f64> {
        let mut delta_forces = vec![0.0; self.cables.len()];
        
        // Influence line approach (simplified)
        for (i, cable) in self.cables.iter().enumerate() {
            let cable_x = cable.anchor_deck.0;
            let distance = (position - cable_x).abs();
            
            if distance < self.main_span / 4.0 {
                let influence = 1.0 - distance / (self.main_span / 4.0);
                let geom = self.cable_geometry(cable);
                let sin_angle = geom.vertical_projection / geom.length;
                
                delta_forces[i] = load_intensity * influence / sin_angle;
            }
        }
        
        delta_forces
    }

    /// Temperature effects
    pub fn temperature_effects(&self, delta_t: f64) -> Vec<f64> {
        let alpha = 12e-6; // thermal coefficient for steel
        let mut temp_forces = vec![0.0; self.cables.len()];
        
        for (i, cable) in self.cables.iter().enumerate() {
            let _geom = self.cable_geometry(cable);
            let strain = alpha * delta_t;
            let stress = strain * cable.e_modulus * 1e3; // MPa
            let force = stress * cable.area / 1000.0; // kN
            
            temp_forces[i] = force;
        }
        
        temp_forces
    }

    /// Deck deflection analysis
    pub fn analyze_deck_deflection(&self, num_points: usize) -> Vec<DeckDeflections> {
        let mut deflections = Vec::new();
        let total_length = self.back_span + self.main_span;
        let dx = total_length / (num_points - 1) as f64;
        
        for i in 0..num_points {
            let x = -self.back_span + i as f64 * dx;
            
            // Simple beam theory with cable supports (simplified)
            let w = self.deck_properties.weight;
            let ei = self.deck_properties.e_modulus * 1e9 * self.deck_properties.i_xx;
            
            // Approximate deflection
            let l = if x < 0.0 { self.back_span } else { self.main_span };
            let x_local = if x < 0.0 { x + self.back_span } else { x };
            
            let max_deflection = 5.0 * w * l.powi(4) / (384.0 * ei);
            let shape = 16.0 * (x_local / l) * (1.0 - x_local / l) * (x_local / l);
            let vertical = max_deflection * shape * 1000.0; // mm
            
            deflections.push(DeckDeflections {
                position: x,
                vertical,
                lateral: 0.0,
                rotation: 0.0,
                load_case: "Dead Load".to_string(),
            });
        }
        
        deflections
    }

    /// Tower bending analysis
    pub fn tower_bending(&self) -> TowerBendingResults {
        let mut cable_horizontal_sum = 0.0;
        let mut moment_arm_weighted = 0.0;
        
        for cable in &self.cables {
            let geom = self.cable_geometry(cable);
            let h_force = cable.pretension * geom.horizontal_projection / geom.length;
            
            // Main span cables push tower back, back span cables push forward
            let sign = if cable.anchor_deck.0 > 0.0 { 1.0 } else { -1.0 };
            cable_horizontal_sum += sign * h_force;
            moment_arm_weighted += h_force * geom.vertical_projection;
        }
        
        let base_moment = moment_arm_weighted.abs();
        let base_shear = cable_horizontal_sum.abs();
        
        TowerBendingResults {
            base_moment,
            base_shear,
            axial_force: self.total_vertical_load(),
            top_displacement: base_shear * self.tower_height.powi(3) / 
                             (3.0 * self.tower_properties.e_modulus * 1e9 * self.tower_properties.base_inertia),
        }
    }

    /// Total vertical load on tower
    fn total_vertical_load(&self) -> f64 {
        let mut total = 0.0;
        for cable in &self.cables {
            let geom = self.cable_geometry(cable);
            total += cable.pretension * geom.vertical_projection / geom.length;
        }
        total
    }

    /// Flutter analysis (simplified)
    pub fn flutter_analysis(&self, wind_speed: f64) -> FlutterResults {
        let b = self.deck_width;
        let _d = self.deck_depth;
        let _rho = 1.225; // air density kg/m³
        
        // Deck natural frequency (approximate)
        let m = self.deck_properties.weight * 1000.0 / 9.81; // kg/m
        let k = self.deck_properties.e_modulus * 1e9 * self.deck_properties.i_xx * 
                (std::f64::consts::PI / self.main_span).powi(4);
        let omega_v = (k / m).sqrt();
        let f_v = omega_v / (2.0 * std::f64::consts::PI);
        
        // Torsional frequency
        let i_theta = m * b * b / 12.0;
        let k_theta = self.deck_properties.e_modulus * 1e9 * self.deck_properties.j_torsion *
                     (std::f64::consts::PI / self.main_span).powi(2);
        let omega_t = (k_theta / i_theta).sqrt();
        let f_t = omega_t / (2.0 * std::f64::consts::PI);
        
        // Frequency ratio
        let gamma = f_t / f_v;
        
        // Critical flutter speed (Selberg formula approximation)
        let reduced_v_cr = 0.44 * gamma.sqrt() * (1.0 - 1.0 / gamma / gamma).sqrt();
        let v_flutter = reduced_v_cr * f_v * b;
        
        FlutterResults {
            vertical_frequency: f_v,
            torsional_frequency: f_t,
            frequency_ratio: gamma,
            critical_flutter_speed: v_flutter,
            flutter_margin: v_flutter / wind_speed,
            is_adequate: v_flutter > 1.2 * wind_speed,
        }
    }

    /// Vortex shedding analysis
    pub fn vortex_shedding(&self, wind_speed: f64) -> VortexSheddingResults {
        let d = self.deck_depth;
        let st = 0.12; // Strouhal number for box girder
        
        let critical_velocity = self.vertical_frequency() * d / st;
        let shedding_freq = st * wind_speed / d;
        
        // Lock-in range
        let lock_in_low = 0.8 * critical_velocity;
        let lock_in_high = 1.2 * critical_velocity;
        
        VortexSheddingResults {
            strouhal_number: st,
            critical_velocity,
            shedding_frequency: shedding_freq,
            lock_in_range: (lock_in_low, lock_in_high),
            in_lock_in: wind_speed >= lock_in_low && wind_speed <= lock_in_high,
        }
    }

    /// Vertical frequency estimate
    fn vertical_frequency(&self) -> f64 {
        let m = self.deck_properties.weight * 1000.0 / 9.81;
        let k = self.deck_properties.e_modulus * 1e9 * self.deck_properties.i_xx * 
                (std::f64::consts::PI / self.main_span).powi(4);
        (k / m).sqrt() / (2.0 * std::f64::consts::PI)
    }

    /// Seismic analysis for cable-stayed bridge
    pub fn seismic_response(&self, pga: f64, spectrum: &ResponseSpectrum) -> SeismicResults {
        let mut results = SeismicResults {
            tower_base_moment: 0.0,
            tower_base_shear: 0.0,
            deck_displacement: 0.0,
            cable_force_range: (0.0, 0.0),
            bearing_displacement: 0.0,
        };
        
        // Tower mass and stiffness
        let tower_mass = self.tower_height * (self.tower_properties.base_area + 
                        self.tower_properties.top_area) / 2.0 * 25000.0; // kg
        let tower_k = 3.0 * self.tower_properties.e_modulus * 1e9 * 
                     self.tower_properties.base_inertia / self.tower_height.powi(3);
        
        let tower_freq = (tower_k / tower_mass).sqrt() / (2.0 * std::f64::consts::PI);
        let tower_sa = spectrum.get_acceleration(tower_freq) * pga;
        
        results.tower_base_shear = tower_mass * tower_sa;
        results.tower_base_moment = results.tower_base_shear * 0.7 * self.tower_height;
        
        // Deck response
        let deck_freq = self.vertical_frequency();
        let deck_sa = spectrum.get_acceleration(deck_freq) * pga;
        let deck_mass_per_length = self.deck_properties.weight * 1000.0 / 9.81;
        let _total_deck_mass = deck_mass_per_length * (self.main_span + self.back_span);
        
        results.deck_displacement = deck_sa / (2.0 * std::f64::consts::PI * deck_freq).powi(2) * 1000.0;
        
        // Cable force variation
        let avg_cable_force = self.cables.iter().map(|c| c.pretension).sum::<f64>() / self.cables.len() as f64;
        let seismic_variation = avg_cable_force * 0.15; // 15% variation
        
        results.cable_force_range = (avg_cable_force - seismic_variation, avg_cable_force + seismic_variation);
        results.bearing_displacement = results.deck_displacement * 0.5;
        
        results
    }

    /// Construction stage analysis
    pub fn construction_stage(&self, stage: usize, total_stages: usize) -> ConstructionStageResults {
        let cables_per_stage = self.cables.len() / total_stages;
        let active_cables = (stage * cables_per_stage).min(self.cables.len());
        
        // Cantilever length depends on stage
        let cantilever_length = (stage as f64 / total_stages as f64) * self.main_span;
        
        // Cantilever moment at tower
        let w = self.deck_properties.weight;
        let cantilever_moment = w * cantilever_length.powi(2) / 2.0;
        
        // Tower stress from unbalanced load
        let imbalance = if stage < total_stages / 2 {
            cantilever_moment
        } else {
            cantilever_moment * 0.5
        };
        
        ConstructionStageResults {
            stage_number: stage,
            active_cables,
            cantilever_length,
            cantilever_moment,
            tower_stress: imbalance / (self.tower_properties.base_inertia / 
                         (self.tower_height / 2.0)),
            deck_deflection: cantilever_length.powi(3) * w / 
                           (3.0 * self.deck_properties.e_modulus * 1e9 * self.deck_properties.i_xx) * 1000.0,
        }
    }

    /// Cable replacement analysis
    pub fn cable_replacement(&self, cable_id: usize) -> CableReplacementAnalysis {
        let cable = &self.cables[cable_id];
        let geom = self.cable_geometry(cable);
        
        // Force redistribution to adjacent cables
        let adjacent_cables: Vec<usize> = self.cables.iter()
            .enumerate()
            .filter(|(i, c)| {
                *i != cable_id && 
                (c.anchor_deck.0 - cable.anchor_deck.0).abs() < self.main_span / 4.0
            })
            .map(|(i, _)| i)
            .collect();
        
        let force_per_adjacent = cable.pretension / adjacent_cables.len() as f64;
        
        CableReplacementAnalysis {
            cable_id,
            original_force: cable.pretension,
            adjacent_cable_ids: adjacent_cables.clone(),
            force_redistribution: force_per_adjacent,
            max_deck_deflection: geom.length * 0.001 * 1000.0, // mm
            replacement_tension: cable.pretension * 1.05, // 5% higher for lift-off
        }
    }
}

/// Cable geometry results
#[derive(Debug, Clone)]
pub struct CableGeometry {
    pub length: f64,
    pub horizontal_projection: f64,
    pub vertical_projection: f64,
    pub angle_to_horizontal: f64,
    pub direction_cosines: (f64, f64, f64),
}

/// Tower bending results
#[derive(Debug, Clone)]
pub struct TowerBendingResults {
    pub base_moment: f64,     // kN·m
    pub base_shear: f64,      // kN
    pub axial_force: f64,     // kN
    pub top_displacement: f64, // m
}

/// Flutter analysis results
#[derive(Debug, Clone)]
pub struct FlutterResults {
    pub vertical_frequency: f64,
    pub torsional_frequency: f64,
    pub frequency_ratio: f64,
    pub critical_flutter_speed: f64,
    pub flutter_margin: f64,
    pub is_adequate: bool,
}

/// Vortex shedding results
#[derive(Debug, Clone)]
pub struct VortexSheddingResults {
    pub strouhal_number: f64,
    pub critical_velocity: f64,
    pub shedding_frequency: f64,
    pub lock_in_range: (f64, f64),
    pub in_lock_in: bool,
}

/// Response spectrum for seismic
#[derive(Debug, Clone)]
pub struct ResponseSpectrum {
    pub periods: Vec<f64>,
    pub accelerations: Vec<f64>,
}

impl ResponseSpectrum {
    pub fn new(periods: Vec<f64>, accelerations: Vec<f64>) -> Self {
        ResponseSpectrum { periods, accelerations }
    }
    
    pub fn get_acceleration(&self, frequency: f64) -> f64 {
        let period = 1.0 / frequency;
        
        for i in 0..self.periods.len() - 1 {
            if period >= self.periods[i] && period <= self.periods[i + 1] {
                let t = (period - self.periods[i]) / (self.periods[i + 1] - self.periods[i]);
                return self.accelerations[i] * (1.0 - t) + self.accelerations[i + 1] * t;
            }
        }
        
        *self.accelerations.last().unwrap_or(&1.0)
    }
}

/// Seismic results
#[derive(Debug, Clone)]
pub struct SeismicResults {
    pub tower_base_moment: f64,
    pub tower_base_shear: f64,
    pub deck_displacement: f64,
    pub cable_force_range: (f64, f64),
    pub bearing_displacement: f64,
}

/// Construction stage results
#[derive(Debug, Clone)]
pub struct ConstructionStageResults {
    pub stage_number: usize,
    pub active_cables: usize,
    pub cantilever_length: f64,
    pub cantilever_moment: f64,
    pub tower_stress: f64,
    pub deck_deflection: f64,
}

/// Cable replacement analysis
#[derive(Debug, Clone)]
pub struct CableReplacementAnalysis {
    pub cable_id: usize,
    pub original_force: f64,
    pub adjacent_cable_ids: Vec<usize>,
    pub force_redistribution: f64,
    pub max_deck_deflection: f64,
    pub replacement_tension: f64,
}

impl DeckProperties {
    pub fn default_composite() -> Self {
        DeckProperties {
            section_type: DeckSectionType::CompositeBoxGirder,
            area: 8.0,
            i_xx: 3.5,
            i_yy: 25.0,
            j_torsion: 5.0,
            e_modulus: 35.0,
            weight: 200.0,
        }
    }
    
    pub fn steel_box(width: f64, depth: f64) -> Self {
        DeckProperties {
            section_type: DeckSectionType::SteelBoxGirder,
            area: 0.5,
            i_xx: depth.powi(3) * width / 12.0 * 0.4,
            i_yy: width.powi(3) * depth / 12.0 * 0.4,
            j_torsion: 2.0 * (width - 0.02) * (depth - 0.02) * 0.02,
            e_modulus: 210.0,
            weight: 150.0,
        }
    }
    
    pub fn concrete_box(width: f64, depth: f64) -> Self {
        DeckProperties {
            section_type: DeckSectionType::ConcreteBoxGirder,
            area: width * depth * 0.4,
            i_xx: width * depth.powi(3) / 12.0 * 0.35,
            i_yy: depth * width.powi(3) / 12.0 * 0.35,
            j_torsion: width * depth * 0.3,
            e_modulus: 35.0,
            weight: 250.0,
        }
    }
}

impl TowerProperties {
    pub fn default_concrete() -> Self {
        TowerProperties {
            base_area: 50.0,
            top_area: 25.0,
            base_inertia: 200.0,
            top_inertia: 50.0,
            e_modulus: 35.0,
            material: TowerMaterial::ReinforcedConcrete,
        }
    }
    
    pub fn steel_hollow(width: f64, thickness: f64) -> Self {
        let area = 4.0 * width * thickness;
        let inertia = width.powi(4) / 12.0 - (width - 2.0 * thickness).powi(4) / 12.0;
        
        TowerProperties {
            base_area: area * 1.5,
            top_area: area,
            base_inertia: inertia * 1.5,
            top_inertia: inertia,
            e_modulus: 210.0,
            material: TowerMaterial::SteelHollow,
        }
    }
}

/// Cable fatigue analysis
pub struct CableFatigueAnalyzer {
    pub s_n_curve_m: f64,
    pub s_n_curve_c: f64,
    pub design_life_years: f64,
}

impl CableFatigueAnalyzer {
    pub fn new() -> Self {
        CableFatigueAnalyzer {
            s_n_curve_m: 4.0,     // S-N curve exponent for cables
            s_n_curve_c: 1e14,    // S-N curve constant
            design_life_years: 100.0,
        }
    }
    
    /// Analyze fatigue for stress range histogram
    pub fn analyze(&self, stress_ranges: &[(f64, u64)]) -> CableFatigueResult {
        let mut damage = 0.0;
        
        for (stress_range, cycles) in stress_ranges {
            let n_f = self.s_n_curve_c / stress_range.powf(self.s_n_curve_m);
            damage += *cycles as f64 / n_f;
        }
        
        let _design_cycles = 365.0 * self.design_life_years * 1e6; // traffic cycles
        
        CableFatigueResult {
            damage_index: damage,
            remaining_life: if damage > 0.0 { 1.0 / damage } else { f64::INFINITY },
            is_adequate: damage < 1.0,
            critical_stress_range: stress_ranges.iter()
                .map(|(s, _)| *s)
                .fold(0.0, f64::max),
        }
    }
}

#[derive(Debug, Clone)]
pub struct CableFatigueResult {
    pub damage_index: f64,
    pub remaining_life: f64,
    pub is_adequate: bool,
    pub critical_stress_range: f64,
}

impl Default for CableFatigueAnalyzer {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_bridge_creation() {
        let bridge = CableStayedBridge::new("Test Bridge", 400.0, 150.0, 100.0);
        assert_eq!(bridge.main_span, 400.0);
        assert_eq!(bridge.back_span, 150.0);
        assert_eq!(bridge.tower_height, 100.0);
    }
    
    #[test]
    fn test_cable_generation() {
        let mut bridge = CableStayedBridge::new("Test Bridge", 400.0, 150.0, 100.0);
        bridge.generate_cables(10, 2);
        
        // 10 cables per plane on main span + 10 on back span = 20 per plane
        // 2 planes = 40 cables total
        assert_eq!(bridge.cables.len(), 40);
    }
    
    #[test]
    fn test_cable_geometry() {
        let mut bridge = CableStayedBridge::new("Test Bridge", 400.0, 150.0, 100.0);
        bridge.generate_cables(5, 1);
        
        let geom = bridge.cable_geometry(&bridge.cables[0]);
        assert!(geom.length > 0.0);
        assert!(geom.angle_to_horizontal > 0.0);
    }
    
    #[test]
    fn test_ernst_modulus() {
        let mut bridge = CableStayedBridge::new("Test Bridge", 400.0, 150.0, 100.0);
        bridge.generate_cables(5, 1);
        
        let e_eq = bridge.ernst_modulus(&bridge.cables[0], 3000.0);
        
        // Ernst modulus should be less than cable modulus due to sag
        assert!(e_eq < bridge.cables[0].e_modulus);
        assert!(e_eq > 0.0);
    }
    
    #[test]
    fn test_cable_sag() {
        let mut bridge = CableStayedBridge::new("Test Bridge", 400.0, 150.0, 100.0);
        bridge.generate_cables(5, 1);
        
        let sag = bridge.cable_sag(&bridge.cables[0], 3000.0);
        
        assert!(sag.sag > 0.0);
        assert!(sag.true_length > sag.chord_length);
    }
    
    #[test]
    fn test_pretension_optimization() {
        let mut bridge = CableStayedBridge::new("Test Bridge", 400.0, 150.0, 100.0);
        bridge.generate_cables(5, 1);
        
        let pretensions = bridge.optimize_pretension();
        
        assert_eq!(pretensions.len(), bridge.cables.len());
        assert!(pretensions.iter().all(|&p| p > 0.0));
    }
    
    #[test]
    fn test_dead_load_forces() {
        let mut bridge = CableStayedBridge::new("Test Bridge", 400.0, 150.0, 100.0);
        bridge.generate_cables(5, 1);
        bridge.optimize_pretension();
        
        let forces = bridge.dead_load_forces();
        
        assert_eq!(forces.len(), bridge.cables.len());
        assert!(forces.iter().all(|f| f.dead_load > 0.0));
    }
    
    #[test]
    fn test_temperature_effects() {
        let mut bridge = CableStayedBridge::new("Test Bridge", 400.0, 150.0, 100.0);
        bridge.generate_cables(5, 1);
        
        let temp_forces = bridge.temperature_effects(30.0);
        
        assert_eq!(temp_forces.len(), bridge.cables.len());
    }
    
    #[test]
    fn test_deck_deflection() {
        let bridge = CableStayedBridge::new("Test Bridge", 400.0, 150.0, 100.0);
        let deflections = bridge.analyze_deck_deflection(21);
        
        assert_eq!(deflections.len(), 21);
    }
    
    #[test]
    fn test_tower_bending() {
        let mut bridge = CableStayedBridge::new("Test Bridge", 400.0, 150.0, 100.0);
        bridge.generate_cables(5, 1);
        
        let bending = bridge.tower_bending();
        
        assert!(bending.axial_force > 0.0);
    }
    
    #[test]
    fn test_flutter_analysis() {
        let bridge = CableStayedBridge::new("Test Bridge", 400.0, 150.0, 100.0);
        let flutter = bridge.flutter_analysis(40.0);
        
        assert!(flutter.vertical_frequency > 0.0);
        assert!(flutter.torsional_frequency > 0.0);
        assert!(flutter.critical_flutter_speed > 0.0);
    }
    
    #[test]
    fn test_vortex_shedding() {
        let bridge = CableStayedBridge::new("Test Bridge", 400.0, 150.0, 100.0);
        let vortex = bridge.vortex_shedding(15.0);
        
        assert!(vortex.critical_velocity > 0.0);
        assert!(vortex.lock_in_range.0 < vortex.lock_in_range.1);
    }
    
    #[test]
    fn test_construction_stage() {
        let mut bridge = CableStayedBridge::new("Test Bridge", 400.0, 150.0, 100.0);
        bridge.generate_cables(10, 1);
        
        let stage = bridge.construction_stage(5, 10);
        
        assert_eq!(stage.stage_number, 5);
        assert!(stage.cantilever_length > 0.0);
    }
    
    #[test]
    fn test_cable_replacement() {
        let mut bridge = CableStayedBridge::new("Test Bridge", 400.0, 150.0, 100.0);
        bridge.generate_cables(10, 1);
        bridge.optimize_pretension();
        
        let replacement = bridge.cable_replacement(5);
        
        assert_eq!(replacement.cable_id, 5);
        assert!(replacement.replacement_tension > replacement.original_force);
    }
    
    #[test]
    fn test_response_spectrum() {
        let spectrum = ResponseSpectrum::new(
            vec![0.0, 0.1, 0.5, 1.0, 2.0],
            vec![1.0, 2.5, 2.5, 1.5, 0.8],
        );
        
        let sa = spectrum.get_acceleration(2.0); // T = 0.5s
        assert!((sa - 2.5).abs() < 0.01);
    }
    
    #[test]
    fn test_seismic_response() {
        let mut bridge = CableStayedBridge::new("Test Bridge", 400.0, 150.0, 100.0);
        bridge.generate_cables(5, 1);
        bridge.optimize_pretension();
        
        let spectrum = ResponseSpectrum::new(
            vec![0.0, 0.1, 0.5, 1.0, 2.0],
            vec![1.0, 2.5, 2.5, 1.5, 0.8],
        );
        
        let seismic = bridge.seismic_response(0.3, &spectrum);
        
        assert!(seismic.tower_base_shear > 0.0);
        assert!(seismic.deck_displacement > 0.0);
    }
    
    #[test]
    fn test_cable_fatigue() {
        let analyzer = CableFatigueAnalyzer::new();
        
        let stress_ranges = vec![
            (50.0, 1_000_000u64),  // 50 MPa, 1M cycles
            (100.0, 100_000u64),   // 100 MPa, 100k cycles
            (150.0, 10_000u64),    // 150 MPa, 10k cycles
        ];
        
        let result = analyzer.analyze(&stress_ranges);
        
        assert!(result.damage_index > 0.0);
        assert_eq!(result.critical_stress_range, 150.0);
    }
    
    #[test]
    fn test_deck_properties() {
        let composite = DeckProperties::default_composite();
        assert_eq!(composite.section_type, DeckSectionType::CompositeBoxGirder);
        
        let steel = DeckProperties::steel_box(20.0, 3.0);
        assert_eq!(steel.section_type, DeckSectionType::SteelBoxGirder);
        assert_eq!(steel.e_modulus, 210.0);
        
        let concrete = DeckProperties::concrete_box(25.0, 4.0);
        assert_eq!(concrete.section_type, DeckSectionType::ConcreteBoxGirder);
    }
    
    #[test]
    fn test_tower_properties() {
        let concrete = TowerProperties::default_concrete();
        assert_eq!(concrete.material, TowerMaterial::ReinforcedConcrete);
        
        let steel = TowerProperties::steel_hollow(5.0, 0.05);
        assert_eq!(steel.material, TowerMaterial::SteelHollow);
        assert_eq!(steel.e_modulus, 210.0);
    }
}
