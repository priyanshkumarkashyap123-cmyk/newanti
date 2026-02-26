//! # Moving Load Analysis Module
//! 
//! STAAD.Pro-equivalent moving load analysis for bridge engineering.
//! Supports influence lines, vehicle loads, and code-compliant analysis.
//! 
//! ## Features
//! - **Influence Line Generation** - For any response quantity
//! - **Standard Vehicle Loads** - IRC, AASHTO, Eurocode vehicle classes
//! - **Lane-Based Positioning** - Automatic critical positioning
//! - **Load Envelope** - Max/min responses across all positions
//! - **Impact/Dynamic Factors** - Per code requirements
//! 
//! ## Supported Codes
//! - IRC 6:2017 (Indian Roads Congress)
//! - AASHTO LRFD (American)
//! - Eurocode 1 (EN 1991-2)
//! - AS 5100 (Australian)

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

// ============================================================================
// INFLUENCE LINE STRUCTURES
// ============================================================================

/// Influence line for a specific response quantity at a location
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InfluenceLine {
    /// Ordinate positions along member/span (0.0 to L)
    pub positions: Vec<f64>,
    /// Influence ordinate values at each position
    pub ordinates: Vec<f64>,
    /// Response type
    pub response_type: ResponseType,
    /// Location where response is measured
    pub response_location: f64,
    /// Member/span length
    pub span_length: f64,
}

/// Type of response quantity
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum ResponseType {
    /// Support reaction
    Reaction,
    /// Bending moment
    BendingMoment,
    /// Shear force  
    ShearForce,
    /// Deflection
    Deflection,
    /// Axial force (for trusses)
    AxialForce,
}

impl InfluenceLine {
    /// Create influence line for reaction at left support of simply supported beam
    pub fn reaction_left(span: f64, num_points: usize) -> Self {
        let dx = span / (num_points - 1) as f64;
        let positions: Vec<f64> = (0..num_points).map(|i| i as f64 * dx).collect();
        let ordinates: Vec<f64> = positions.iter()
            .map(|x| 1.0 - x / span)
            .collect();
        
        Self {
            positions,
            ordinates,
            response_type: ResponseType::Reaction,
            response_location: 0.0,
            span_length: span,
        }
    }
    
    /// Create influence line for reaction at right support of simply supported beam
    pub fn reaction_right(span: f64, num_points: usize) -> Self {
        let dx = span / (num_points - 1) as f64;
        let positions: Vec<f64> = (0..num_points).map(|i| i as f64 * dx).collect();
        let ordinates: Vec<f64> = positions.iter()
            .map(|x| x / span)
            .collect();
        
        Self {
            positions,
            ordinates,
            response_type: ResponseType::Reaction,
            response_location: span,
            span_length: span,
        }
    }
    
    /// Create influence line for bending moment at location `a` on simply supported beam
    pub fn bending_moment(span: f64, location: f64, num_points: usize) -> Self {
        let dx = span / (num_points - 1) as f64;
        let positions: Vec<f64> = (0..num_points).map(|i| i as f64 * dx).collect();
        
        let a = location;
        let b = span - location;
        
        let ordinates: Vec<f64> = positions.iter().map(|&x| {
            if x <= a {
                // Load left of section
                x * b / span
            } else {
                // Load right of section
                a * (span - x) / span
            }
        }).collect();
        
        Self {
            positions,
            ordinates,
            response_type: ResponseType::BendingMoment,
            response_location: location,
            span_length: span,
        }
    }
    
    /// Create influence line for shear at location `a` on simply supported beam
    pub fn shear_force(span: f64, location: f64, num_points: usize) -> Self {
        let dx = span / (num_points - 1) as f64;
        let positions: Vec<f64> = (0..num_points).map(|i| i as f64 * dx).collect();
        
        let a = location;
        
        let ordinates: Vec<f64> = positions.iter().map(|&x| {
            if x < a {
                // Load left of section - positive shear
                -x / span
            } else if x > a {
                // Load right of section - negative reaction contribution
                (span - x) / span
            } else {
                // At section - discontinuity (use average)
                0.5 * ((span - a) / span - a / span)
            }
        }).collect();
        
        Self {
            positions,
            ordinates,
            response_type: ResponseType::ShearForce,
            response_location: location,
            span_length: span,
        }
    }
    
    /// Create influence line for deflection at location `a` on simply supported beam
    /// Requires EI (flexural stiffness)
    pub fn deflection(span: f64, location: f64, ei: f64, num_points: usize) -> Self {
        let dx = span / (num_points - 1) as f64;
        let positions: Vec<f64> = (0..num_points).map(|i| i as f64 * dx).collect();
        
        let a = location;
        let l = span;
        
        let ordinates: Vec<f64> = positions.iter().map(|&x| {
            if x <= a {
                // Load left of section
                let b = l - a;
                x * b * (l * l - b * b - x * x) / (6.0 * ei * l)
            } else {
                // Load right of section
                let b = l - x;
                a * b * (l * l - a * a - b * b) / (6.0 * ei * l)
            }
        }).collect();
        
        Self {
            positions,
            ordinates,
            response_type: ResponseType::Deflection,
            response_location: location,
            span_length: span,
        }
    }
    
    /// Get influence ordinate at position x by interpolation
    pub fn ordinate_at(&self, x: f64) -> f64 {
        if x <= self.positions[0] {
            return self.ordinates[0];
        }
        if x >= *self.positions.last().unwrap() {
            return *self.ordinates.last().unwrap();
        }
        
        // Binary search for interval
        let mut lo = 0;
        let mut hi = self.positions.len() - 1;
        
        while hi - lo > 1 {
            let mid = (lo + hi) / 2;
            if self.positions[mid] <= x {
                lo = mid;
            } else {
                hi = mid;
            }
        }
        
        // Linear interpolation
        let t = (x - self.positions[lo]) / (self.positions[hi] - self.positions[lo]);
        self.ordinates[lo] + t * (self.ordinates[hi] - self.ordinates[lo])
    }
    
    /// Maximum positive ordinate
    pub fn max_ordinate(&self) -> f64 {
        self.ordinates.iter().copied().fold(f64::NEG_INFINITY, f64::max)
    }
    
    /// Maximum negative ordinate
    pub fn min_ordinate(&self) -> f64 {
        self.ordinates.iter().copied().fold(f64::INFINITY, f64::min)
    }
}

// ============================================================================
// VEHICLE DEFINITIONS
// ============================================================================

/// Axle load definition
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AxleLoad {
    /// Distance from front of vehicle (m)
    pub position: f64,
    /// Axle load (kN)
    pub load: f64,
    /// Axle width for transverse distribution (optional)
    pub width: Option<f64>,
}

/// Standard vehicle definition
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VehicleDefinition {
    /// Vehicle name/ID
    pub name: String,
    /// Design code reference
    pub code: DesignCode,
    /// Axle loads from front to rear
    pub axles: Vec<AxleLoad>,
    /// Total vehicle length
    pub length: f64,
    /// Uniformly distributed load (if any) - kN/m
    pub udl: Option<f64>,
    /// UDL length (if different from vehicle length)
    pub udl_length: Option<f64>,
}

/// Design code for vehicle loads
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum DesignCode {
    /// Indian Roads Congress
    IRC,
    /// AASHTO LRFD
    AASHTO,
    /// Eurocode 1991-2
    Eurocode,
    /// Australian Standard
    AS5100,
    /// Custom/Generic
    Custom,
}

impl VehicleDefinition {
    /// IRC Class AA Tracked Vehicle
    pub fn irc_class_aa_tracked() -> Self {
        Self {
            name: "IRC Class AA Tracked".to_string(),
            code: DesignCode::IRC,
            axles: vec![
                AxleLoad { position: 0.0, load: 350.0, width: Some(0.85) },
                AxleLoad { position: 3.6, load: 350.0, width: Some(0.85) },
            ],
            length: 3.6,
            udl: None,
            udl_length: None,
        }
    }
    
    /// IRC Class AA Wheeled Vehicle
    pub fn irc_class_aa_wheeled() -> Self {
        Self {
            name: "IRC Class AA Wheeled".to_string(),
            code: DesignCode::IRC,
            axles: vec![
                AxleLoad { position: 0.0, load: 200.0, width: Some(1.8) },
                AxleLoad { position: 1.2, load: 200.0, width: Some(1.8) },
                AxleLoad { position: 2.4, load: 200.0, width: Some(1.8) },
                AxleLoad { position: 3.6, load: 200.0, width: Some(1.8) },
            ],
            length: 3.6,
            udl: None,
            udl_length: None,
        }
    }
    
    /// IRC Class 70R Tracked Vehicle
    pub fn irc_class_70r_tracked() -> Self {
        Self {
            name: "IRC Class 70R Tracked".to_string(),
            code: DesignCode::IRC,
            axles: vec![
                AxleLoad { position: 0.0, load: 350.0, width: Some(0.84) },
                AxleLoad { position: 4.57, load: 350.0, width: Some(0.84) },
            ],
            length: 4.57,
            udl: None,
            udl_length: None,
        }
    }
    
    /// IRC Class 70R Wheeled Vehicle (simplified)
    pub fn irc_class_70r_wheeled() -> Self {
        Self {
            name: "IRC Class 70R Wheeled".to_string(),
            code: DesignCode::IRC,
            axles: vec![
                AxleLoad { position: 0.0, load: 80.0, width: Some(2.79) },
                AxleLoad { position: 1.37, load: 120.0, width: Some(2.79) },
                AxleLoad { position: 4.17, load: 120.0, width: Some(2.79) },
                AxleLoad { position: 5.47, load: 170.0, width: Some(2.79) },
                AxleLoad { position: 6.77, load: 170.0, width: Some(2.79) },
                AxleLoad { position: 8.07, load: 170.0, width: Some(2.79) },
                AxleLoad { position: 9.37, load: 170.0, width: Some(2.79) },
            ],
            length: 9.37,
            udl: None,
            udl_length: None,
        }
    }
    
    /// IRC Class A Train of Vehicles
    pub fn irc_class_a() -> Self {
        Self {
            name: "IRC Class A".to_string(),
            code: DesignCode::IRC,
            axles: vec![
                AxleLoad { position: 0.0, load: 27.0, width: Some(1.8) },
                AxleLoad { position: 1.1, load: 27.0, width: Some(1.8) },
                AxleLoad { position: 4.3, load: 114.0, width: Some(1.8) },
                AxleLoad { position: 7.5, load: 114.0, width: Some(1.8) },
                AxleLoad { position: 10.7, load: 68.0, width: Some(1.8) },
                AxleLoad { position: 13.9, load: 68.0, width: Some(1.8) },
                AxleLoad { position: 17.1, load: 68.0, width: Some(1.8) },
                AxleLoad { position: 20.3, load: 68.0, width: Some(1.8) },
            ],
            length: 20.3,
            udl: None,
            udl_length: None,
        }
    }
    
    /// AASHTO HL-93 Truck
    pub fn aashto_hl93_truck() -> Self {
        Self {
            name: "AASHTO HL-93 Truck".to_string(),
            code: DesignCode::AASHTO,
            axles: vec![
                // Front axle
                AxleLoad { position: 0.0, load: 35.0 * 4.448, width: Some(1.8) }, // 35 kip = 156 kN
                // Drive axle
                AxleLoad { position: 4.27, load: 145.0 * 4.448 / 2.0, width: Some(1.8) }, // 145 kip spread
                // Rear axle (variable 4.27m to 9.14m)
                AxleLoad { position: 8.54, load: 145.0 * 4.448 / 2.0, width: Some(1.8) },
            ],
            length: 8.54,
            udl: None,
            udl_length: None,
        }
    }
    
    /// AASHTO HL-93 Tandem
    pub fn aashto_hl93_tandem() -> Self {
        Self {
            name: "AASHTO HL-93 Tandem".to_string(),
            code: DesignCode::AASHTO,
            axles: vec![
                AxleLoad { position: 0.0, load: 110.0 * 4.448, width: Some(1.8) },
                AxleLoad { position: 1.2, load: 110.0 * 4.448, width: Some(1.8) },
            ],
            length: 1.2,
            udl: None,
            udl_length: None,
        }
    }
    
    /// AASHTO Lane Load
    pub fn aashto_lane_load() -> Self {
        Self {
            name: "AASHTO Lane Load".to_string(),
            code: DesignCode::AASHTO,
            axles: vec![],
            length: 0.0,
            udl: Some(9.34), // 0.64 klf = 9.34 kN/m
            udl_length: None,
        }
    }
    
    /// Eurocode LM1 Tandem System (TS) for Lane 1
    pub fn eurocode_lm1_ts_lane1() -> Self {
        Self {
            name: "Eurocode LM1 Tandem - Lane 1".to_string(),
            code: DesignCode::Eurocode,
            axles: vec![
                AxleLoad { position: 0.0, load: 300.0, width: Some(2.0) },
                AxleLoad { position: 1.2, load: 300.0, width: Some(2.0) },
            ],
            length: 1.2,
            udl: None,
            udl_length: None,
        }
    }
    
    /// Eurocode LM1 Tandem System (TS) for Lane 2
    pub fn eurocode_lm1_ts_lane2() -> Self {
        Self {
            name: "Eurocode LM1 Tandem - Lane 2".to_string(),
            code: DesignCode::Eurocode,
            axles: vec![
                AxleLoad { position: 0.0, load: 200.0, width: Some(2.0) },
                AxleLoad { position: 1.2, load: 200.0, width: Some(2.0) },
            ],
            length: 1.2,
            udl: None,
            udl_length: None,
        }
    }
    
    /// Custom vehicle
    pub fn custom(name: &str, axles: Vec<(f64, f64)>) -> Self {
        let vehicle_length = axles.iter().map(|(pos, _)| *pos).fold(0.0, f64::max);
        
        Self {
            name: name.to_string(),
            code: DesignCode::Custom,
            axles: axles.into_iter()
                .map(|(pos, load)| AxleLoad { position: pos, load, width: None })
                .collect(),
            length: vehicle_length,
            udl: None,
            udl_length: None,
        }
    }
    
    /// Total vehicle weight
    pub fn total_weight(&self) -> f64 {
        self.axles.iter().map(|a| a.load).sum()
    }
}

// ============================================================================
// IMPACT FACTORS
// ============================================================================

/// Impact/Dynamic factor calculation
#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub struct ImpactFactor {
    pub code: DesignCode,
    pub factor: f64,
}

impl ImpactFactor {
    /// Calculate IRC impact factor based on span length
    pub fn irc_tracked(span: f64) -> Self {
        // IRC 6:2017 Clause 211.2
        let factor = if span <= 5.0 {
            0.25
        } else if span >= 9.0 {
            0.10
        } else {
            0.25 - 0.15 * (span - 5.0) / 4.0
        };
        
        Self { code: DesignCode::IRC, factor }
    }
    
    /// IRC impact factor for wheeled vehicles
    pub fn irc_wheeled(span: f64) -> Self {
        // IRC 6:2017 Clause 211.1
        let factor = if span <= 3.0 {
            0.545
        } else if span <= 45.0 {
            4.5 / (6.0 + span)
        } else {
            0.088
        };
        
        Self { code: DesignCode::IRC, factor }
    }
    
    /// AASHTO IM factor (constant 33%)
    pub fn aashto() -> Self {
        Self { code: DesignCode::AASHTO, factor: 0.33 }
    }
    
    /// Eurocode dynamic factor
    pub fn eurocode(span: f64) -> Self {
        // Simplified - EN 1991-2 more complex
        let factor = if span < 10.0 {
            0.10
        } else {
            0.10 * (50.0 - span) / 40.0
        }.max(0.0);
        
        Self { code: DesignCode::Eurocode, factor }
    }
}

// ============================================================================
// MOVING LOAD ANALYSIS
// ============================================================================

/// Response envelope from moving load analysis
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ResponseEnvelope {
    /// Response type
    pub response_type: ResponseType,
    /// Location along span
    pub location: f64,
    /// Maximum response value
    pub max_value: f64,
    /// Vehicle position for max response
    pub max_position: f64,
    /// Minimum response value
    pub min_value: f64,
    /// Vehicle position for min response  
    pub min_position: f64,
}

/// Moving load analysis results
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MovingLoadResult {
    /// Vehicle used
    pub vehicle_name: String,
    /// Span length
    pub span: f64,
    /// Impact factor applied
    pub impact_factor: f64,
    /// Response envelopes at various locations
    pub envelopes: Vec<ResponseEnvelope>,
    /// Critical bending moment
    pub critical_moment: CriticalResponse,
    /// Critical shear
    pub critical_shear: CriticalResponse,
    /// Critical reaction
    pub critical_reaction: CriticalResponse,
}

/// Critical response details
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CriticalResponse {
    /// Maximum value (with impact)
    pub max_value: f64,
    /// Location where max occurs
    pub max_location: f64,
    /// Vehicle position for max
    pub vehicle_position: f64,
    /// Minimum value (with impact)
    pub min_value: f64,
    /// Location where min occurs
    pub min_location: f64,
}

/// Moving load analyzer
pub struct MovingLoadAnalyzer {
    /// Span length
    pub span: f64,
    /// Number of analysis points
    pub num_points: usize,
    /// Influence lines at various locations
    influence_lines: HashMap<String, InfluenceLine>,
}

impl MovingLoadAnalyzer {
    pub fn new(span: f64, num_points: usize) -> Self {
        Self {
            span,
            num_points,
            influence_lines: HashMap::new(),
        }
    }
    
    /// Generate all standard influence lines
    pub fn generate_influence_lines(&mut self) {
        let n = self.num_points;
        
        // Reactions
        self.influence_lines.insert(
            "R_left".to_string(),
            InfluenceLine::reaction_left(self.span, n)
        );
        self.influence_lines.insert(
            "R_right".to_string(),
            InfluenceLine::reaction_right(self.span, n)
        );
        
        // Moments at 0.1L intervals
        for i in 1..=9 {
            let loc = self.span * i as f64 / 10.0;
            let key = format!("M_{:.1}L", i as f64 / 10.0);
            self.influence_lines.insert(
                key,
                InfluenceLine::bending_moment(self.span, loc, n)
            );
        }
        
        // Shear at same locations
        for i in 1..=9 {
            let loc = self.span * i as f64 / 10.0;
            let key = format!("V_{:.1}L", i as f64 / 10.0);
            self.influence_lines.insert(
                key,
                InfluenceLine::shear_force(self.span, loc, n)
            );
        }
    }
    
    /// Analyze response for vehicle at given position
    fn response_at_position(&self, il: &InfluenceLine, vehicle: &VehicleDefinition, front_position: f64) -> f64 {
        let mut response = 0.0;
        
        // Concentrated axle loads
        for axle in &vehicle.axles {
            let load_pos = front_position + axle.position;
            if load_pos >= 0.0 && load_pos <= self.span {
                response += axle.load * il.ordinate_at(load_pos);
            }
        }
        
        // Uniformly distributed load (if any)
        if let Some(udl) = vehicle.udl {
            let udl_len = vehicle.udl_length.unwrap_or(self.span);
            let start = front_position.max(0.0);
            let end = (front_position + udl_len).min(self.span);
            
            if end > start {
                // Integrate UDL over influence line
                let num_segments = 20;
                let dx = (end - start) / num_segments as f64;
                
                for i in 0..num_segments {
                    let x = start + (i as f64 + 0.5) * dx;
                    response += udl * il.ordinate_at(x) * dx;
                }
            }
        }
        
        response
    }
    
    /// Find critical position for max/min response
    fn find_critical_positions(
        &self,
        il: &InfluenceLine,
        vehicle: &VehicleDefinition,
    ) -> (f64, f64, f64, f64) {
        let step = self.span / 100.0;
        let start = -vehicle.length;
        let end = self.span;
        
        let mut max_response = f64::NEG_INFINITY;
        let mut max_pos = 0.0;
        let mut min_response = f64::INFINITY;
        let mut min_pos = 0.0;
        
        let mut pos = start;
        while pos <= end {
            let response = self.response_at_position(il, vehicle, pos);
            
            if response > max_response {
                max_response = response;
                max_pos = pos;
            }
            if response < min_response {
                min_response = response;
                min_pos = pos;
            }
            
            pos += step;
        }
        
        (max_response, max_pos, min_response, min_pos)
    }
    
    /// Perform complete moving load analysis
    pub fn analyze(&self, vehicle: &VehicleDefinition, impact: &ImpactFactor) -> MovingLoadResult {
        let impact_mult = 1.0 + impact.factor;
        let mut envelopes = Vec::new();
        
        // Analyze at 0.1L intervals for moments
        let mut critical_moment = CriticalResponse {
            max_value: f64::NEG_INFINITY,
            max_location: 0.0,
            vehicle_position: 0.0,
            min_value: f64::INFINITY,
            min_location: 0.0,
        };
        
        for i in 1..=9 {
            let loc = self.span * i as f64 / 10.0;
            let il = InfluenceLine::bending_moment(self.span, loc, self.num_points);
            let (max_r, max_p, min_r, min_p) = self.find_critical_positions(&il, vehicle);
            
            let envelope = ResponseEnvelope {
                response_type: ResponseType::BendingMoment,
                location: loc,
                max_value: max_r * impact_mult,
                max_position: max_p,
                min_value: min_r * impact_mult,
                min_position: min_p,
            };
            
            if envelope.max_value > critical_moment.max_value {
                critical_moment.max_value = envelope.max_value;
                critical_moment.max_location = loc;
                critical_moment.vehicle_position = max_p;
            }
            if envelope.min_value < critical_moment.min_value {
                critical_moment.min_value = envelope.min_value;
                critical_moment.min_location = loc;
            }
            
            envelopes.push(envelope);
        }
        
        // Analyze shear
        let mut critical_shear = CriticalResponse {
            max_value: f64::NEG_INFINITY,
            max_location: 0.0,
            vehicle_position: 0.0,
            min_value: f64::INFINITY,
            min_location: 0.0,
        };
        
        for i in 1..=9 {
            let loc = self.span * i as f64 / 10.0;
            let il = InfluenceLine::shear_force(self.span, loc, self.num_points);
            let (max_r, max_p, min_r, min_p) = self.find_critical_positions(&il, vehicle);
            
            let envelope = ResponseEnvelope {
                response_type: ResponseType::ShearForce,
                location: loc,
                max_value: max_r * impact_mult,
                max_position: max_p,
                min_value: min_r * impact_mult,
                min_position: min_p,
            };
            
            if envelope.max_value > critical_shear.max_value {
                critical_shear.max_value = envelope.max_value;
                critical_shear.max_location = loc;
                critical_shear.vehicle_position = max_p;
            }
            if envelope.min_value < critical_shear.min_value {
                critical_shear.min_value = envelope.min_value;
                critical_shear.min_location = loc;
            }
            
            envelopes.push(envelope);
        }
        
        // Reactions
        let il_left = InfluenceLine::reaction_left(self.span, self.num_points);
        let (max_rl, max_pl, min_rl, min_pl) = self.find_critical_positions(&il_left, vehicle);
        
        let critical_reaction = CriticalResponse {
            max_value: max_rl * impact_mult,
            max_location: 0.0,
            vehicle_position: max_pl,
            min_value: min_rl * impact_mult,
            min_location: self.span,
        };
        
        envelopes.push(ResponseEnvelope {
            response_type: ResponseType::Reaction,
            location: 0.0,
            max_value: max_rl * impact_mult,
            max_position: max_pl,
            min_value: min_rl * impact_mult,
            min_position: min_pl,
        });
        
        MovingLoadResult {
            vehicle_name: vehicle.name.clone(),
            span: self.span,
            impact_factor: impact.factor,
            envelopes,
            critical_moment,
            critical_shear,
            critical_reaction,
        }
    }
    
    /// Analyze multiple vehicles and get governing envelope
    pub fn analyze_multiple(&self, vehicles: &[VehicleDefinition], impacts: &[ImpactFactor]) -> MovingLoadResult {
        let mut governing_result: Option<MovingLoadResult> = None;
        
        for (vehicle, impact) in vehicles.iter().zip(impacts.iter()) {
            let result = self.analyze(vehicle, impact);
            
            match &governing_result {
                None => governing_result = Some(result),
                Some(existing) => {
                    if result.critical_moment.max_value > existing.critical_moment.max_value {
                        governing_result = Some(result);
                    }
                }
            }
        }
        
        governing_result.expect("vehicles should not be empty")
    }
}

// ============================================================================
// LANE CONFIGURATION
// ============================================================================

/// Lane definition
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Lane {
    pub id: usize,
    pub width: f64,
    pub offset_from_edge: f64,
}

/// Multi-lane configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LaneConfiguration {
    pub lanes: Vec<Lane>,
    pub deck_width: f64,
    pub code: DesignCode,
}

impl LaneConfiguration {
    /// Create IRC lane configuration
    pub fn irc(deck_width: f64) -> Self {
        // IRC 6:2017 - Lane width 3.75m for Class A, 5.5m for Class AA/70R
        let num_lanes = (deck_width / 3.75).floor() as usize;
        let lanes: Vec<Lane> = (0..num_lanes)
            .map(|i| Lane {
                id: i + 1,
                width: 3.75,
                offset_from_edge: 0.5 + i as f64 * 3.75,
            })
            .collect();
        
        Self {
            lanes,
            deck_width,
            code: DesignCode::IRC,
        }
    }
    
    /// Create AASHTO lane configuration  
    pub fn aashto(deck_width: f64) -> Self {
        // AASHTO 3.6.1.1.1 - Lane width 3.6m (12 ft)
        let num_lanes = (deck_width / 3.6).floor() as usize;
        let lanes: Vec<Lane> = (0..num_lanes)
            .map(|i| Lane {
                id: i + 1,
                width: 3.6,
                offset_from_edge: 0.6 + i as f64 * 3.6,
            })
            .collect();
        
        Self {
            lanes,
            deck_width,
            code: DesignCode::AASHTO,
        }
    }
    
    /// AASHTO multiple presence factor
    pub fn aashto_multiple_presence_factor(&self, num_loaded_lanes: usize) -> f64 {
        match num_loaded_lanes {
            1 => 1.20,
            2 => 1.00,
            3 => 0.85,
            _ => 0.65,
        }
    }
    
    /// IRC reduction factor for multiple lanes
    pub fn irc_congestion_factor(&self, num_loaded_lanes: usize) -> f64 {
        match num_loaded_lanes {
            1 => 1.0,
            2 => 1.0,
            3 => 0.9,
            _ => 0.75,
        }
    }
}

// ============================================================================
// CONTINUOUS BEAM ANALYSIS
// ============================================================================

/// Multi-span continuous beam configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ContinuousBeam {
    /// Span lengths
    pub spans: Vec<f64>,
    /// Support conditions (true = fixed moment release)
    pub moment_releases: Vec<bool>,
}

impl ContinuousBeam {
    pub fn new(spans: Vec<f64>) -> Self {
        let n_supports = spans.len() + 1;
        Self {
            spans,
            moment_releases: vec![false; n_supports],
        }
    }
    
    /// Total length
    pub fn total_length(&self) -> f64 {
        self.spans.iter().sum()
    }
    
    /// Number of spans
    pub fn num_spans(&self) -> usize {
        self.spans.len()
    }
    
    /// Get span index and local position for global position
    pub fn locate(&self, global_pos: f64) -> (usize, f64) {
        let mut cumulative = 0.0;
        
        for (i, &span) in self.spans.iter().enumerate() {
            if global_pos <= cumulative + span {
                return (i, global_pos - cumulative);
            }
            cumulative += span;
        }
        
        // Return last span
        let last = self.spans.len() - 1;
        (last, global_pos - (self.total_length() - self.spans[last]))
    }
}

/// Influence line for continuous beam using Muller-Breslau principle
pub fn continuous_beam_influence_line(
    beam: &ContinuousBeam,
    response_type: ResponseType,
    response_span: usize,
    response_local_pos: f64,
    num_points: usize,
) -> InfluenceLine {
    let total_length = beam.total_length();
    let dx = total_length / (num_points - 1) as f64;
    
    let positions: Vec<f64> = (0..num_points)
        .map(|i| i as f64 * dx)
        .collect();
    
    // Simplified: Just use superposition of simple spans
    // Full implementation would use matrix analysis or three-moment equation
    let mut ordinates = vec![0.0; num_points];
    
    let span_start: f64 = beam.spans[..response_span].iter().sum();
    let span_length = beam.spans[response_span];
    let response_global = span_start + response_local_pos;
    
    for (i, &pos) in positions.iter().enumerate() {
        let (load_span, local_pos) = beam.locate(pos);
        
        if load_span == response_span {
            // Load in same span as response
            let il = match response_type {
                ResponseType::BendingMoment => {
                    InfluenceLine::bending_moment(span_length, response_local_pos, 2)
                }
                ResponseType::ShearForce => {
                    InfluenceLine::shear_force(span_length, response_local_pos, 2)
                }
                _ => continue,
            };
            ordinates[i] = il.ordinate_at(local_pos);
        } else {
            // Load in different span - continuity effects
            // Simplified: use reduction factor based on distance
            let _distance_factor = 1.0 / (1.0 + (load_span as i32 - response_span as i32).abs() as f64);
            ordinates[i] = 0.0; // Simplified - real implementation needs moment distribution
        }
    }
    
    InfluenceLine {
        positions,
        ordinates,
        response_type,
        response_location: response_global,
        span_length: total_length,
    }
}

// ============================================================================
// TESTS
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_influence_line_reaction() {
        let il = InfluenceLine::reaction_left(10.0, 11);
        
        assert!((il.ordinate_at(0.0) - 1.0).abs() < 1e-10);
        assert!((il.ordinate_at(10.0) - 0.0).abs() < 1e-10);
        assert!((il.ordinate_at(5.0) - 0.5).abs() < 1e-10);
    }
    
    #[test]
    fn test_influence_line_moment() {
        let span = 10.0;
        let location = 5.0; // Midspan
        let il = InfluenceLine::bending_moment(span, location, 11);
        
        // Max ordinate at midspan for unit load at midspan
        let max_ord = il.max_ordinate();
        // M = P*a*b/L = 1 * 5 * 5 / 10 = 2.5
        assert!((max_ord - 2.5).abs() < 1e-10);
        
        // Ordinate at supports should be 0
        assert!((il.ordinate_at(0.0)).abs() < 1e-10);
        assert!((il.ordinate_at(10.0)).abs() < 1e-10);
    }
    
    #[test]
    fn test_influence_line_shear() {
        let span = 10.0;
        let location = 3.0;
        let il = InfluenceLine::shear_force(span, location, 101);
        
        // Shear IL has discontinuity at section
        let max_ord = il.max_ordinate();
        let min_ord = il.min_ordinate();
        
        // At right of section: (L-a)/L = 7/10 = 0.7
        assert!((max_ord - 0.7).abs() < 0.05);
        // At left of section: -a/L = -3/10 = -0.3
        assert!((min_ord + 0.3).abs() < 0.05);
    }
    
    #[test]
    fn test_irc_vehicles() {
        let aa_tracked = VehicleDefinition::irc_class_aa_tracked();
        assert_eq!(aa_tracked.axles.len(), 2);
        assert!((aa_tracked.total_weight() - 700.0).abs() < 1e-6);
        
        let class_a = VehicleDefinition::irc_class_a();
        assert_eq!(class_a.axles.len(), 8);
    }
    
    #[test]
    fn test_aashto_vehicles() {
        let hl93_truck = VehicleDefinition::aashto_hl93_truck();
        assert_eq!(hl93_truck.axles.len(), 3);
        
        let tandem = VehicleDefinition::aashto_hl93_tandem();
        assert_eq!(tandem.axles.len(), 2);
    }
    
    #[test]
    fn test_impact_factors() {
        // IRC tracked vehicle
        let irc_5m = ImpactFactor::irc_tracked(5.0);
        assert!((irc_5m.factor - 0.25).abs() < 1e-6);
        
        let irc_9m = ImpactFactor::irc_tracked(9.0);
        assert!((irc_9m.factor - 0.10).abs() < 1e-6);
        
        // AASHTO
        let aashto = ImpactFactor::aashto();
        assert!((aashto.factor - 0.33).abs() < 1e-6);
    }
    
    #[test]
    fn test_moving_load_analysis() {
        let span = 20.0;
        let analyzer = MovingLoadAnalyzer::new(span, 101);
        
        let vehicle = VehicleDefinition::irc_class_aa_tracked();
        let impact = ImpactFactor::irc_tracked(span);
        
        let result = analyzer.analyze(&vehicle, &impact);
        
        println!("Vehicle: {}", result.vehicle_name);
        println!("Impact factor: {:.2}", result.impact_factor);
        println!("Critical moment: {:.1} kN-m at {:.2}m", 
                 result.critical_moment.max_value, 
                 result.critical_moment.max_location);
        println!("Critical shear: {:.1} kN at {:.2}m",
                 result.critical_shear.max_value,
                 result.critical_shear.max_location);
        
        // Verify reasonable values
        assert!(result.critical_moment.max_value > 0.0);
        assert!(result.critical_moment.max_location > 0.0);
        assert!(result.critical_moment.max_location < span);
    }
    
    #[test]
    fn test_lane_configuration() {
        let irc_lanes = LaneConfiguration::irc(12.0);
        assert_eq!(irc_lanes.lanes.len(), 3); // 12m / 3.75m = 3 lanes
        
        let aashto_lanes = LaneConfiguration::aashto(12.0);
        assert_eq!(aashto_lanes.lanes.len(), 3); // 12m / 3.6m = 3 lanes
        
        // Check multiple presence factors
        assert!((aashto_lanes.aashto_multiple_presence_factor(1) - 1.20).abs() < 1e-6);
        assert!((aashto_lanes.aashto_multiple_presence_factor(2) - 1.00).abs() < 1e-6);
    }
    
    #[test]
    fn test_continuous_beam() {
        let beam = ContinuousBeam::new(vec![10.0, 12.0, 10.0]);
        
        assert_eq!(beam.num_spans(), 3);
        assert!((beam.total_length() - 32.0).abs() < 1e-10);
        
        // Test locate function
        let (span, local) = beam.locate(15.0);
        assert_eq!(span, 1); // Second span
        assert!((local - 5.0).abs() < 1e-10); // 5m into second span
    }
    
    #[test]
    fn test_custom_vehicle() {
        let axles = vec![
            (0.0, 50.0),
            (3.0, 100.0),
            (6.0, 100.0),
        ];
        
        let vehicle = VehicleDefinition::custom("Test Vehicle", axles);
        
        assert_eq!(vehicle.axles.len(), 3);
        assert!((vehicle.total_weight() - 250.0).abs() < 1e-6);
        assert!((vehicle.length - 6.0).abs() < 1e-6);
    }
    
    #[test]
    fn test_eurocode_vehicles() {
        let ts1 = VehicleDefinition::eurocode_lm1_ts_lane1();
        assert_eq!(ts1.axles.len(), 2);
        assert!((ts1.total_weight() - 600.0).abs() < 1e-6);
        
        let ts2 = VehicleDefinition::eurocode_lm1_ts_lane2();
        assert!((ts2.total_weight() - 400.0).abs() < 1e-6);
    }
    
    #[test]
    fn test_influence_line_interpolation() {
        let il = InfluenceLine::reaction_left(10.0, 11);
        
        // Test interpolation at non-grid points
        let ord_25 = il.ordinate_at(2.5);
        let expected = 1.0 - 2.5 / 10.0; // 0.75
        assert!((ord_25 - expected).abs() < 1e-6);
        
        let ord_75 = il.ordinate_at(7.5);
        let expected = 1.0 - 7.5 / 10.0; // 0.25
        assert!((ord_75 - expected).abs() < 1e-6);
    }
    
    #[test]
    fn test_complete_bridge_analysis() {
        // Simulate a complete bridge analysis workflow
        let span = 30.0; // 30m span bridge
        let deck_width = 12.0; // 12m wide deck
        
        // Setup lanes
        let lanes = LaneConfiguration::irc(deck_width);
        
        // Create analyzer
        let analyzer = MovingLoadAnalyzer::new(span, 201);
        
        // Test with multiple vehicles
        let vehicles = vec![
            VehicleDefinition::irc_class_aa_tracked(),
            VehicleDefinition::irc_class_70r_tracked(),
            VehicleDefinition::irc_class_a(),
        ];
        
        let impacts = vec![
            ImpactFactor::irc_tracked(span),
            ImpactFactor::irc_tracked(span),
            ImpactFactor::irc_wheeled(span),
        ];
        
        // Analyze each vehicle and find governing
        let mut max_moment = 0.0;
        let mut governing_vehicle = String::new();
        
        for (vehicle, impact) in vehicles.iter().zip(impacts.iter()) {
            let result = analyzer.analyze(vehicle, impact);
            if result.critical_moment.max_value > max_moment {
                max_moment = result.critical_moment.max_value;
                governing_vehicle = result.vehicle_name.clone();
            }
        }
        
        println!("Governing vehicle: {}", governing_vehicle);
        println!("Max moment: {:.1} kN-m", max_moment);
        
        assert!(max_moment > 0.0);
        assert!(!governing_vehicle.is_empty());
    }
}
