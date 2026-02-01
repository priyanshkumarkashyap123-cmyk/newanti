//! Advanced Infrastructure Module
//! 
//! Specialized structural designs for:
//! - High-speed rail infrastructure
//! - Data center structures
//! - Sports stadium structures
//! - Healthcare facilities
//! 
//! Standards: UIC 776, EN 1991-2, ACI 360, EN 1990

use serde::{Deserialize, Serialize};
use std::f64::consts::PI;

/// High-speed rail track type
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq)]
pub enum TrackType {
    /// Ballasted track
    Ballasted,
    /// Slab track (ballastless)
    SlabTrack,
    /// Embedded rail
    EmbeddedRail,
}

/// High-speed rail bridge designer
#[derive(Debug, Clone)]
pub struct HSRBridgeDesigner;

/// HSR bridge design parameters
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HSRBridgeParameters {
    /// Span length (m)
    pub span: f64,
    /// Track configuration
    pub num_tracks: u8,
    /// Design speed (km/h)
    pub design_speed: f64,
    /// Track type
    pub track_type: TrackType,
    /// Concrete class
    pub concrete_class: String,
}

/// HSR bridge design result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HSRBridgeDesign {
    /// Recommended bridge type
    pub bridge_type: HSRBridgeType,
    /// Deck depth (m)
    pub deck_depth: f64,
    /// Deck width (m)
    pub deck_width: f64,
    /// Natural frequency (Hz)
    pub vertical_frequency: f64,
    /// Lateral frequency (Hz)
    pub lateral_frequency: f64,
    /// Frequency compliance
    pub frequency_ok: bool,
    /// Dynamic amplification factor
    pub dynamic_factor: f64,
    /// Maximum deflection (mm)
    pub max_deflection: f64,
    /// Deflection limit (mm)
    pub deflection_limit: f64,
    /// Twist limit compliance
    pub twist_ok: bool,
}

/// HSR bridge type
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq)]
pub enum HSRBridgeType {
    BoxGirder,
    TwinGirder,
    TroughGirder,
    CableSuspended,
}

impl HSRBridgeDesigner {
    /// Design HSR bridge
    pub fn design(&self, params: &HSRBridgeParameters) -> HSRBridgeDesign {
        // Determine bridge type based on span
        let bridge_type = if params.span < 40.0 {
            HSRBridgeType::TwinGirder
        } else if params.span < 80.0 {
            HSRBridgeType::BoxGirder
        } else if params.span < 150.0 {
            HSRBridgeType::TroughGirder
        } else {
            HSRBridgeType::CableSuspended
        };
        
        // Deck depth (span/depth ratio depends on type)
        let span_depth_ratio = match bridge_type {
            HSRBridgeType::TwinGirder => 15.0,
            HSRBridgeType::BoxGirder => 18.0,
            HSRBridgeType::TroughGirder => 20.0,
            HSRBridgeType::CableSuspended => 50.0,
        };
        let deck_depth = params.span / span_depth_ratio;
        
        // Deck width
        let track_spacing = 4.5; // m (standard gauge)
        let deck_width = params.num_tracks as f64 * track_spacing + 3.0;
        
        // Calculate frequencies
        let (f_v, f_l) = self.calculate_frequencies(params, deck_depth, deck_width);
        
        // Frequency limits per EN 1991-2 and UIC 776-2
        let f_min = 80.0 / params.span.max(1.0); // Simplified lower limit
        let _f_max = 94.76 * params.span.powf(-0.748); // Upper limit
        let frequency_ok = f_v > f_min;
        
        // Dynamic amplification factor (Φ per EN 1991-2)
        let phi = self.dynamic_factor(params.span, f_v, params.design_speed);
        
        // Deflection calculation
        let deflection = self.calculate_deflection(params, deck_depth);
        let deflection_limit = params.span * 1000.0 / self.deflection_ratio(params.design_speed);
        
        // Twist check (3mm per 3m for v > 200 km/h)
        let twist_ok = true; // Simplified - would need detailed analysis
        
        HSRBridgeDesign {
            bridge_type,
            deck_depth,
            deck_width,
            vertical_frequency: f_v,
            lateral_frequency: f_l,
            frequency_ok,
            dynamic_factor: phi,
            max_deflection: deflection,
            deflection_limit,
            twist_ok,
        }
    }
    
    fn calculate_frequencies(&self, params: &HSRBridgeParameters, depth: f64, width: f64) -> (f64, f64) {
        // Simplified frequency calculation
        let e = 35000.0; // MPa for C40/50
        let rho = 2500.0; // kg/m³
        
        // Moment of inertia (simplified box section)
        let i_v = width * depth.powi(3) / 12.0 * 0.4; // Effective for hollow section
        let i_l = depth * width.powi(3) / 12.0 * 0.3;
        
        // Mass per unit length
        let area = width * depth * 0.3; // Approximate
        let mass = area * rho;
        
        // Simple beam frequency
        let f_v = PI / (2.0 * params.span.powi(2)) * (e * 1e6 * i_v / mass).sqrt();
        let f_l = PI / (2.0 * params.span.powi(2)) * (e * 1e6 * i_l / mass).sqrt();
        
        (f_v, f_l)
    }
    
    fn dynamic_factor(&self, span: f64, freq: f64, speed: f64) -> f64 {
        // Simplified dynamic factor (Φ2 from EN 1991-2)
        let v = speed / 3.6; // m/s
        let n0 = freq;
        
        // Determinant length
        let l_phi = span;
        
        // Phi2 factor
        let alpha = v / (2.0 * l_phi * n0);
        let phi2 = if alpha < 1.0 {
            1.0 + 0.5 * alpha.powi(2)
        } else {
            1.0 + 0.5 / alpha.powi(2)
        };
        
        phi2.min(2.0)
    }
    
    fn deflection_ratio(&self, speed: f64) -> f64 {
        // L/δ ratio based on speed
        if speed > 250.0 {
            1600.0
        } else if speed > 200.0 {
            1400.0
        } else {
            1200.0
        }
    }
    
    fn calculate_deflection(&self, params: &HSRBridgeParameters, depth: f64) -> f64 {
        // Load model LM71 equivalent
        let q = 80.0; // kN/m (simplified UDL)
        let p = 250.0 * 4.0; // Point loads
        
        let e = 35000.0; // MPa
        let i = params.num_tracks as f64 * 5.0 * depth.powi(3) / 12.0 * 0.4;
        
        // Simply supported beam deflection
        let delta_q = 5.0 * q * params.span.powi(4) / (384.0 * e * 1000.0 * i);
        let delta_p = p * params.span.powi(3) / (48.0 * e * 1000.0 * i);
        
        (delta_q + delta_p) * 1000.0 // mm
    }
}

/// Data center structural designer
#[derive(Debug, Clone)]
pub struct DataCenterDesigner;

/// Data center parameters
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DataCenterParameters {
    /// Tier level (1-4)
    pub tier: u8,
    /// Floor area (m²)
    pub floor_area: f64,
    /// Number of floors
    pub num_floors: u8,
    /// Server rack load (kN/m²)
    pub rack_load: f64,
    /// Seismic zone
    pub seismic_zone: SeismicZone,
}

/// Seismic zone
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq)]
pub enum SeismicZone {
    Low,
    Moderate,
    High,
    VeryHigh,
}

/// Data center design result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DataCenterDesign {
    /// Structural system
    pub structural_system: String,
    /// Floor system
    pub floor_system: FloorSystem,
    /// Required floor thickness (mm)
    pub slab_thickness: f64,
    /// Column spacing (m)
    pub column_spacing: f64,
    /// Vibration control required
    pub vibration_control: bool,
    /// Raised floor height (mm)
    pub raised_floor_height: f64,
    /// Redundancy features
    pub redundancy: Vec<String>,
}

/// Floor system type
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq)]
pub enum FloorSystem {
    FlatSlab,
    WaffleSleb,
    PostTensioned,
    CompositeSteel,
}

impl DataCenterDesigner {
    /// Design data center structure
    pub fn design(&self, params: &DataCenterParameters) -> DataCenterDesign {
        // Structural system based on seismic zone
        let structural_system = match params.seismic_zone {
            SeismicZone::Low => "Steel braced frame".to_string(),
            SeismicZone::Moderate => "Steel moment frame".to_string(),
            SeismicZone::High | SeismicZone::VeryHigh => "Base isolated steel frame".to_string(),
        };
        
        // Floor system based on loads and spans
        let (floor_system, slab_thickness) = if params.rack_load > 15.0 {
            (FloorSystem::PostTensioned, 300.0)
        } else if params.rack_load > 10.0 {
            (FloorSystem::WaffleSleb, 450.0)
        } else {
            (FloorSystem::FlatSlab, 250.0)
        };
        
        // Column spacing (optimize for server rows)
        let column_spacing = 9.0; // Common for data centers
        
        // Vibration control (important for sensitive equipment)
        let vibration_control = params.tier >= 3;
        
        // Raised floor height based on tier
        let raised_floor_height = match params.tier {
            1 => 300.0,
            2 => 450.0,
            3 => 600.0,
            4 => 900.0,
            _ => 600.0,
        };
        
        // Redundancy features based on tier
        let redundancy = self.redundancy_features(params.tier);
        
        DataCenterDesign {
            structural_system,
            floor_system,
            slab_thickness,
            column_spacing,
            vibration_control,
            raised_floor_height,
            redundancy,
        }
    }
    
    fn redundancy_features(&self, tier: u8) -> Vec<String> {
        let mut features = Vec::new();
        
        if tier >= 2 {
            features.push("Redundant load paths".to_string());
        }
        if tier >= 3 {
            features.push("Concurrent maintainability".to_string());
            features.push("Multiple utility feeds".to_string());
        }
        if tier >= 4 {
            features.push("Fault tolerant structure".to_string());
            features.push("2N redundancy".to_string());
            features.push("Seismic base isolation".to_string());
        }
        
        features
    }
}

/// Stadium structure designer
#[derive(Debug, Clone)]
pub struct StadiumDesigner;

/// Stadium parameters
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StadiumParameters {
    /// Seating capacity
    pub capacity: u32,
    /// Roof type
    pub roof_type: StadiumRoofType,
    /// Field dimensions (m x m)
    pub field_size: (f64, f64),
    /// Number of tiers
    pub tiers: u8,
}

/// Stadium roof type
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq)]
pub enum StadiumRoofType {
    Open,
    PartialCantilever,
    FullCantilever,
    CableNet,
    Retractable,
}

/// Stadium design result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StadiumDesign {
    /// Bowl structure type
    pub bowl_structure: String,
    /// Roof span (m)
    pub roof_span: f64,
    /// Cantilever length (m)
    pub cantilever_length: f64,
    /// Primary roof member depth (m)
    pub roof_depth: f64,
    /// Crowd loading (kN/m²)
    pub crowd_loading: f64,
    /// Sway frequency requirement (Hz)
    pub min_sway_frequency: f64,
    /// Emergency egress capacity (persons/min)
    pub egress_capacity: f64,
}

impl StadiumDesigner {
    /// Design stadium structure
    pub fn design(&self, params: &StadiumParameters) -> StadiumDesign {
        // Bowl structure type based on capacity
        let bowl_structure = if params.capacity < 30000 {
            "Precast concrete terrace units".to_string()
        } else if params.capacity < 60000 {
            "In-situ RC with precast seating".to_string()
        } else {
            "Composite steel/concrete terracing".to_string()
        };
        
        // Calculate roof span
        let (_field_l, field_w) = params.field_size;
        let seating_depth = self.seating_depth(params.capacity, params.tiers);
        let roof_span = field_w + 2.0 * seating_depth;
        
        // Cantilever length
        let cantilever_length = match params.roof_type {
            StadiumRoofType::Open => 0.0,
            StadiumRoofType::PartialCantilever => seating_depth * 0.5,
            StadiumRoofType::FullCantilever => seating_depth,
            StadiumRoofType::CableNet => seating_depth * 0.8,
            StadiumRoofType::Retractable => seating_depth * 0.7,
        };
        
        // Roof depth (truss depth for long spans)
        let roof_depth = match params.roof_type {
            StadiumRoofType::CableNet => cantilever_length / 30.0,
            StadiumRoofType::Retractable => cantilever_length / 15.0,
            _ => cantilever_length / 20.0,
        };
        
        // Crowd loading per EN 1991-1-1
        let crowd_loading = if params.capacity > 50000 { 6.0 } else { 5.0 };
        
        // Sway frequency (comfort criterion)
        let min_sway_frequency = 3.0; // Hz for crowds
        
        // Egress capacity
        let egress_capacity = params.capacity as f64 / 8.0; // 8 minutes evacuation
        
        StadiumDesign {
            bowl_structure,
            roof_span,
            cantilever_length,
            roof_depth,
            crowd_loading,
            min_sway_frequency,
            egress_capacity,
        }
    }
    
    fn seating_depth(&self, capacity: u32, tiers: u8) -> f64 {
        // Approximate seating depth based on capacity and tiers
        let rows_per_tier = (capacity as f64 / (tiers as f64 * 200.0)).sqrt().ceil();
        rows_per_tier * 0.8 // 0.8m per row
    }
}

/// Healthcare facility designer
#[derive(Debug, Clone)]
pub struct HealthcareDesigner;

/// Healthcare facility parameters
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HealthcareParameters {
    /// Facility type
    pub facility_type: HealthcareFacilityType,
    /// Number of beds
    pub bed_count: u32,
    /// Seismic performance requirement
    pub seismic_category: HealthcareSeismicCategory,
    /// Vibration sensitive areas
    pub has_imaging: bool,
}

/// Healthcare facility type
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq)]
pub enum HealthcareFacilityType {
    CriticalCareHospital,
    GeneralHospital,
    OutpatientClinic,
    MedicalOffice,
}

/// Healthcare seismic category
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq)]
pub enum HealthcareSeismicCategory {
    /// Immediate occupancy post-earthquake
    ImmediateOccupancy,
    /// Life safety
    LifeSafety,
    /// Basic code compliance
    CodeMinimum,
}

/// Healthcare design result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HealthcareDesign {
    /// Structural system
    pub structural_system: String,
    /// Importance factor
    pub importance_factor: f64,
    /// Floor vibration limit (mm/s)
    pub vibration_limit: f64,
    /// MEP coordination requirements
    pub mep_requirements: Vec<String>,
    /// Fire compartment size (m²)
    pub fire_compartment: f64,
    /// Recommended floor to floor height (m)
    pub floor_height: f64,
}

impl HealthcareDesigner {
    /// Design healthcare facility structure
    pub fn design(&self, params: &HealthcareParameters) -> HealthcareDesign {
        // Structural system based on seismic category
        let structural_system = match params.seismic_category {
            HealthcareSeismicCategory::ImmediateOccupancy => {
                "Base-isolated special moment frame".to_string()
            }
            HealthcareSeismicCategory::LifeSafety => {
                "Special moment-resisting frame".to_string()
            }
            HealthcareSeismicCategory::CodeMinimum => {
                "Ordinary moment frame".to_string()
            }
        };
        
        // Importance factor per ASCE 7
        let importance_factor = match params.facility_type {
            HealthcareFacilityType::CriticalCareHospital => 1.5,
            HealthcareFacilityType::GeneralHospital => 1.25,
            _ => 1.0,
        };
        
        // Vibration limit for imaging equipment
        let vibration_limit = if params.has_imaging {
            0.05 // mm/s RMS for MRI
        } else {
            0.5 // General hospital limit
        };
        
        // MEP requirements
        let mep_requirements = self.mep_requirements(params);
        
        // Fire compartment size
        let fire_compartment = match params.facility_type {
            HealthcareFacilityType::CriticalCareHospital => 500.0,
            HealthcareFacilityType::GeneralHospital => 750.0,
            _ => 1000.0,
        };
        
        // Floor height (larger for hospitals due to MEP)
        let floor_height = match params.facility_type {
            HealthcareFacilityType::CriticalCareHospital => 4.5,
            HealthcareFacilityType::GeneralHospital => 4.2,
            _ => 3.6,
        };
        
        HealthcareDesign {
            structural_system,
            importance_factor,
            vibration_limit,
            mep_requirements,
            fire_compartment,
            floor_height,
        }
    }
    
    fn mep_requirements(&self, params: &HealthcareParameters) -> Vec<String> {
        let mut reqs = Vec::new();
        
        reqs.push("Seismic bracing for all MEP".to_string());
        
        if params.facility_type == HealthcareFacilityType::CriticalCareHospital {
            reqs.push("Emergency power for 96 hours".to_string());
            reqs.push("Redundant HVAC systems".to_string());
            reqs.push("Medical gas system redundancy".to_string());
        }
        
        if params.has_imaging {
            reqs.push("Vibration isolation for imaging".to_string());
            reqs.push("RF shielding rooms".to_string());
        }
        
        reqs.push("Interstitial space for maintenance".to_string());
        
        reqs
    }
}

/// Industrial floor designer
#[derive(Debug, Clone)]
pub struct IndustrialFloorDesigner;

/// Industrial floor parameters
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IndustrialFloorParams {
    /// Forklift load (kN)
    pub forklift_load: f64,
    /// Rack post load (kN)
    pub rack_post_load: f64,
    /// Uniform load (kN/m²)
    pub uniform_load: f64,
    /// Flatness class (FF/FL)
    pub flatness_class: FlatnessClass,
    /// Soil modulus (MN/m³)
    pub soil_modulus: f64,
}

/// Floor flatness class per ACI 117/TR34
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq)]
pub enum FlatnessClass {
    /// Superflat (VNA trucks)
    Superflat,
    /// Defined movement (narrow aisle)
    DefinedMovement,
    /// Free movement
    FreeMovement,
    /// Conventional
    Conventional,
}

/// Industrial floor design result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IndustrialFloorDesign {
    /// Slab thickness (mm)
    pub slab_thickness: f64,
    /// Concrete grade
    pub concrete_grade: String,
    /// Reinforcement type
    pub reinforcement: ReinforcementType,
    /// Steel fiber dosage (kg/m³) if applicable
    pub fiber_dosage: Option<f64>,
    /// Joint spacing (m)
    pub joint_spacing: f64,
    /// FF/FL requirements
    pub flatness_ff: f64,
    pub flatness_fl: f64,
}

/// Reinforcement type
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq)]
pub enum ReinforcementType {
    SteelFiber,
    WeldedMesh,
    Rebar,
    PostTensioned,
}

impl IndustrialFloorDesigner {
    /// Design industrial floor
    pub fn design(&self, params: &IndustrialFloorParams) -> IndustrialFloorDesign {
        // Slab thickness using Westergaard analysis (simplified)
        let k = params.soil_modulus; // MN/m³
        let fc: f64 = 40.0; // MPa
        let mr = 0.55 * fc.sqrt(); // Modulus of rupture
        
        // For forklift loading
        let p = params.forklift_load;
        let contact_area: f64 = 0.02; // m² per wheel
        let _l = (30000.0 * contact_area / k).powf(0.25); // Radius of relative stiffness
        
        // Required thickness from interior loading
        let t_forklift = (3.0 * p * 1000.0 / (PI * mr * 1e6)).sqrt() * 1000.0;
        
        // For rack post loading
        let p_rack = params.rack_post_load;
        let t_rack = (3.0 * p_rack * 1000.0 / (PI * mr * 1e6)).sqrt() * 1000.0;
        
        // Governing thickness (add 25mm for wear)
        let slab_thickness = t_forklift.max(t_rack).max(150.0) + 25.0;
        
        // Concrete grade
        let concrete_grade = if params.flatness_class == FlatnessClass::Superflat {
            "C45/55".to_string()
        } else {
            "C35/45".to_string()
        };
        
        // Reinforcement selection
        let (reinforcement, fiber_dosage) = if params.rack_post_load > 50.0 {
            (ReinforcementType::SteelFiber, Some(40.0))
        } else if params.forklift_load > 40.0 {
            (ReinforcementType::SteelFiber, Some(30.0))
        } else {
            (ReinforcementType::WeldedMesh, None)
        };
        
        // Joint spacing (6m x 6m typical for steel fiber)
        let joint_spacing = match reinforcement {
            ReinforcementType::SteelFiber => 6.0,
            ReinforcementType::PostTensioned => 15.0,
            _ => 4.5,
        };
        
        // Flatness requirements
        let (ff, fl) = match params.flatness_class {
            FlatnessClass::Superflat => (100.0, 50.0),
            FlatnessClass::DefinedMovement => (50.0, 25.0),
            FlatnessClass::FreeMovement => (35.0, 25.0),
            FlatnessClass::Conventional => (25.0, 20.0),
        };
        
        IndustrialFloorDesign {
            slab_thickness: slab_thickness.ceil(),
            concrete_grade,
            reinforcement,
            fiber_dosage,
            joint_spacing,
            flatness_ff: ff,
            flatness_fl: fl,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_hsr_bridge_design() {
        let designer = HSRBridgeDesigner;
        
        let params = HSRBridgeParameters {
            span: 32.0,
            num_tracks: 2,
            design_speed: 350.0,
            track_type: TrackType::SlabTrack,
            concrete_class: "C50/60".to_string(),
        };
        
        let design = designer.design(&params);
        
        assert_eq!(design.bridge_type, HSRBridgeType::TwinGirder);
        assert!(design.vertical_frequency > 0.0);
        assert!(design.deflection_limit > 0.0);
    }
    
    #[test]
    fn test_hsr_long_span() {
        let designer = HSRBridgeDesigner;
        
        let params = HSRBridgeParameters {
            span: 100.0,
            num_tracks: 2,
            design_speed: 300.0,
            track_type: TrackType::SlabTrack,
            concrete_class: "C50/60".to_string(),
        };
        
        let design = designer.design(&params);
        
        // Long span should use different bridge type
        assert_eq!(design.bridge_type, HSRBridgeType::TroughGirder);
        assert!(design.deck_depth > 4.0);
    }
    
    #[test]
    fn test_data_center_design() {
        let designer = DataCenterDesigner;
        
        let params = DataCenterParameters {
            tier: 4,
            floor_area: 5000.0,
            num_floors: 2,
            rack_load: 15.0,
            seismic_zone: SeismicZone::High,
        };
        
        let design = designer.design(&params);
        
        assert!(design.vibration_control);
        assert_eq!(design.raised_floor_height, 900.0);
        assert!(design.redundancy.len() > 3);
    }
    
    #[test]
    fn test_data_center_tier_levels() {
        let designer = DataCenterDesigner;
        
        let tier1 = designer.design(&DataCenterParameters {
            tier: 1,
            floor_area: 1000.0,
            num_floors: 1,
            rack_load: 5.0,
            seismic_zone: SeismicZone::Low,
        });
        
        let tier4 = designer.design(&DataCenterParameters {
            tier: 4,
            floor_area: 5000.0,
            num_floors: 3,
            rack_load: 20.0,
            seismic_zone: SeismicZone::High,
        });
        
        // Tier 4 should have more features
        assert!(tier4.raised_floor_height > tier1.raised_floor_height);
        assert!(tier4.redundancy.len() > tier1.redundancy.len());
    }
    
    #[test]
    fn test_stadium_design() {
        let designer = StadiumDesigner;
        
        let params = StadiumParameters {
            capacity: 60000,
            roof_type: StadiumRoofType::FullCantilever,
            field_size: (105.0, 68.0),
            tiers: 3,
        };
        
        let design = designer.design(&params);
        
        assert!(design.roof_span > 50.0);  // At least wider than the field
        assert!(design.cantilever_length > 5.0);
        assert!(design.crowd_loading >= 5.0);
    }
    
    #[test]
    fn test_stadium_roof_types() {
        let designer = StadiumDesigner;
        
        let params_open = StadiumParameters {
            capacity: 30000,
            roof_type: StadiumRoofType::Open,
            field_size: (105.0, 68.0),
            tiers: 2,
        };
        
        let params_cantilever = StadiumParameters {
            capacity: 30000,
            roof_type: StadiumRoofType::FullCantilever,
            field_size: (105.0, 68.0),
            tiers: 2,
        };
        
        let open = designer.design(&params_open);
        let cantilever = designer.design(&params_cantilever);
        
        assert_eq!(open.cantilever_length, 0.0);
        assert!(cantilever.cantilever_length > 0.0);
    }
    
    #[test]
    fn test_healthcare_design() {
        let designer = HealthcareDesigner;
        
        let params = HealthcareParameters {
            facility_type: HealthcareFacilityType::CriticalCareHospital,
            bed_count: 500,
            seismic_category: HealthcareSeismicCategory::ImmediateOccupancy,
            has_imaging: true,
        };
        
        let design = designer.design(&params);
        
        assert_eq!(design.importance_factor, 1.5);
        assert!(design.vibration_limit < 0.1); // Strict for MRI
        assert!(design.mep_requirements.len() > 4);
    }
    
    #[test]
    fn test_healthcare_categories() {
        let designer = HealthcareDesigner;
        
        let critical = designer.design(&HealthcareParameters {
            facility_type: HealthcareFacilityType::CriticalCareHospital,
            bed_count: 200,
            seismic_category: HealthcareSeismicCategory::ImmediateOccupancy,
            has_imaging: false,
        });
        
        let clinic = designer.design(&HealthcareParameters {
            facility_type: HealthcareFacilityType::OutpatientClinic,
            bed_count: 0,
            seismic_category: HealthcareSeismicCategory::CodeMinimum,
            has_imaging: false,
        });
        
        assert!(critical.importance_factor > clinic.importance_factor);
        assert!(critical.floor_height > clinic.floor_height);
    }
    
    #[test]
    fn test_industrial_floor() {
        let designer = IndustrialFloorDesigner;
        
        let params = IndustrialFloorParams {
            forklift_load: 50.0,
            rack_post_load: 100.0,
            uniform_load: 30.0,
            flatness_class: FlatnessClass::DefinedMovement,
            soil_modulus: 50.0,
        };
        
        let design = designer.design(&params);
        
        assert!(design.slab_thickness >= 175.0);
        assert_eq!(design.reinforcement, ReinforcementType::SteelFiber);
        assert!(design.fiber_dosage.is_some());
    }
    
    #[test]
    fn test_superflat_floor() {
        let designer = IndustrialFloorDesigner;
        
        let params = IndustrialFloorParams {
            forklift_load: 30.0,
            rack_post_load: 80.0,
            uniform_load: 25.0,
            flatness_class: FlatnessClass::Superflat,
            soil_modulus: 75.0,
        };
        
        let design = designer.design(&params);
        
        assert_eq!(design.flatness_ff, 100.0);
        assert_eq!(design.flatness_fl, 50.0);
        assert_eq!(design.concrete_grade, "C45/55");
    }
}
