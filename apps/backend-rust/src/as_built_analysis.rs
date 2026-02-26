// ============================================================================
// AS-BUILT ANALYSIS - Phase 22
// Geometric imperfections, tolerance analysis, as-built verification
// Standards: ISO 2768, EN 1090, ACI 117, AISC 303
// ============================================================================

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

// ============================================================================
// TOLERANCE CLASSES
// ============================================================================

/// Tolerance class
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum ToleranceClass {
    // Concrete (ACI 117)
    ConcreteClassA,  // Normal tolerance
    ConcreteClassB,  // Standard tolerance
    ConcreteClassC,  // Precision tolerance
    
    // Steel (EN 1090 / AISC 303)
    SteelEXC1,       // Execution Class 1
    SteelEXC2,       // Execution Class 2
    SteelEXC3,       // Execution Class 3
    SteelEXC4,       // Execution Class 4
    
    // General (ISO 2768)
    ISOFine,
    ISOMedium,
    ISOCoarse,
    ISOVeryCoarse,
}

impl ToleranceClass {
    /// Linear tolerance for dimension
    pub fn linear_tolerance(&self, dimension: f64) -> f64 {
        match self {
            // Concrete tolerances per ACI 117
            ToleranceClass::ConcreteClassA => {
                if dimension <= 300.0 { 6.0 }
                else if dimension <= 900.0 { 9.0 }
                else if dimension <= 3000.0 { 13.0 }
                else { 19.0 }
            }
            ToleranceClass::ConcreteClassB => {
                if dimension <= 300.0 { 9.0 }
                else if dimension <= 900.0 { 13.0 }
                else if dimension <= 3000.0 { 19.0 }
                else { 25.0 }
            }
            ToleranceClass::ConcreteClassC => {
                if dimension <= 300.0 { 3.0 }
                else if dimension <= 900.0 { 6.0 }
                else if dimension <= 3000.0 { 9.0 }
                else { 13.0 }
            }
            
            // Steel tolerances per EN 1090-2
            ToleranceClass::SteelEXC1 => dimension / 500.0,
            ToleranceClass::SteelEXC2 => dimension / 750.0,
            ToleranceClass::SteelEXC3 => dimension / 1000.0,
            ToleranceClass::SteelEXC4 => dimension / 1500.0,
            
            // ISO 2768 general tolerances
            ToleranceClass::ISOFine => {
                if dimension <= 30.0 { 0.1 }
                else if dimension <= 120.0 { 0.15 }
                else if dimension <= 400.0 { 0.2 }
                else if dimension <= 1000.0 { 0.3 }
                else { 0.5 }
            }
            ToleranceClass::ISOMedium => {
                if dimension <= 30.0 { 0.2 }
                else if dimension <= 120.0 { 0.3 }
                else if dimension <= 400.0 { 0.5 }
                else if dimension <= 1000.0 { 0.8 }
                else { 1.2 }
            }
            ToleranceClass::ISOCoarse => {
                if dimension <= 30.0 { 0.5 }
                else if dimension <= 120.0 { 0.8 }
                else if dimension <= 400.0 { 1.2 }
                else if dimension <= 1000.0 { 2.0 }
                else { 3.0 }
            }
            ToleranceClass::ISOVeryCoarse => {
                if dimension <= 30.0 { 1.0 }
                else if dimension <= 120.0 { 1.5 }
                else if dimension <= 400.0 { 2.5 }
                else if dimension <= 1000.0 { 4.0 }
                else { 6.0 }
            }
        }
    }
    
    /// Angular tolerance (degrees)
    pub fn angular_tolerance(&self) -> f64 {
        match self {
            ToleranceClass::ConcreteClassA => 0.5,
            ToleranceClass::ConcreteClassB => 0.75,
            ToleranceClass::ConcreteClassC => 0.25,
            ToleranceClass::SteelEXC1 => 0.5,
            ToleranceClass::SteelEXC2 => 0.25,
            ToleranceClass::SteelEXC3 => 0.1,
            ToleranceClass::SteelEXC4 => 0.05,
            ToleranceClass::ISOFine => 0.1,
            ToleranceClass::ISOMedium => 0.25,
            ToleranceClass::ISOCoarse => 0.5,
            ToleranceClass::ISOVeryCoarse => 1.0,
        }
    }
}

// ============================================================================
// AS-BUILT MEASUREMENTS
// ============================================================================

/// Measurement point
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MeasurementPoint {
    /// Point ID
    pub id: String,
    /// X coordinate (mm)
    pub x: f64,
    /// Y coordinate (mm)
    pub y: f64,
    /// Z coordinate (mm)
    pub z: f64,
    /// Measurement accuracy (mm)
    pub accuracy: f64,
    /// Timestamp
    pub timestamp: String,
}

impl MeasurementPoint {
    pub fn new(id: &str, x: f64, y: f64, z: f64) -> Self {
        Self {
            id: id.to_string(),
            x, y, z,
            accuracy: 1.0,
            timestamp: String::new(),
        }
    }
    
    /// Distance to another point
    pub fn distance_to(&self, other: &MeasurementPoint) -> f64 {
        ((self.x - other.x).powi(2) + 
         (self.y - other.y).powi(2) + 
         (self.z - other.z).powi(2)).sqrt()
    }
    
    /// Deviation from design point
    pub fn deviation_from(&self, design_x: f64, design_y: f64, design_z: f64) -> (f64, f64, f64, f64) {
        let dx = self.x - design_x;
        let dy = self.y - design_y;
        let dz = self.z - design_z;
        let total = (dx.powi(2) + dy.powi(2) + dz.powi(2)).sqrt();
        
        (dx, dy, dz, total)
    }
}

/// Measured dimension
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MeasuredDimension {
    /// Dimension name
    pub name: String,
    /// Design value (mm)
    pub design_value: f64,
    /// Measured value (mm)
    pub measured_value: f64,
    /// Tolerance class
    pub tolerance_class: ToleranceClass,
}

impl MeasuredDimension {
    pub fn new(name: &str, design: f64, measured: f64, tolerance: ToleranceClass) -> Self {
        Self {
            name: name.to_string(),
            design_value: design,
            measured_value: measured,
            tolerance_class: tolerance,
        }
    }
    
    /// Deviation (mm)
    pub fn deviation(&self) -> f64 {
        self.measured_value - self.design_value
    }
    
    /// Allowable tolerance (mm)
    pub fn allowable_tolerance(&self) -> f64 {
        self.tolerance_class.linear_tolerance(self.design_value)
    }
    
    /// Is within tolerance?
    pub fn is_within_tolerance(&self) -> bool {
        self.deviation().abs() <= self.allowable_tolerance()
    }
    
    /// Utilization ratio
    pub fn utilization(&self) -> f64 {
        self.deviation().abs() / self.allowable_tolerance()
    }
}

// ============================================================================
// AS-BUILT ELEMENT
// ============================================================================

/// As-built element status
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum AsBuiltStatus {
    WithinTolerance,
    MarginallyOutside,  // Within 1.2x tolerance
    OutOfTolerance,
    NotMeasured,
}

/// As-built element data
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AsBuiltElement {
    /// Element ID
    pub element_id: String,
    /// Element type
    pub element_type: String,
    /// Tolerance class
    pub tolerance_class: ToleranceClass,
    /// Measured dimensions
    pub dimensions: Vec<MeasuredDimension>,
    /// Measured points
    pub points: Vec<MeasurementPoint>,
    /// Design points for comparison
    pub design_points: Vec<(f64, f64, f64)>,
    /// Overall status
    pub status: AsBuiltStatus,
    /// Notes
    pub notes: Vec<String>,
}

impl AsBuiltElement {
    pub fn new(element_id: &str, element_type: &str, tolerance_class: ToleranceClass) -> Self {
        Self {
            element_id: element_id.to_string(),
            element_type: element_type.to_string(),
            tolerance_class,
            dimensions: Vec::new(),
            points: Vec::new(),
            design_points: Vec::new(),
            status: AsBuiltStatus::NotMeasured,
            notes: Vec::new(),
        }
    }
    
    /// Add measured dimension
    pub fn add_dimension(&mut self, dim: MeasuredDimension) {
        self.dimensions.push(dim);
    }
    
    /// Add measurement point
    pub fn add_point(&mut self, point: MeasurementPoint) {
        self.points.push(point);
    }
    
    /// Add design point
    pub fn add_design_point(&mut self, x: f64, y: f64, z: f64) {
        self.design_points.push((x, y, z));
    }
    
    /// Add note
    pub fn add_note(&mut self, note: &str) {
        self.notes.push(note.to_string());
    }
    
    /// Evaluate status
    pub fn evaluate(&mut self) {
        if self.dimensions.is_empty() && self.points.is_empty() {
            self.status = AsBuiltStatus::NotMeasured;
            return;
        }
        
        let mut max_util = 0.0;
        
        // Check dimensions
        for dim in &self.dimensions {
            let util = dim.utilization();
            if util > max_util {
                max_util = util;
            }
        }
        
        // Check point deviations
        for (i, point) in self.points.iter().enumerate() {
            if let Some(&(dx, dy, dz)) = self.design_points.get(i) {
                let (_, _, _, total_dev) = point.deviation_from(dx, dy, dz);
                let tolerance = self.tolerance_class.linear_tolerance(total_dev);
                let util = total_dev / tolerance;
                if util > max_util {
                    max_util = util;
                }
            }
        }
        
        self.status = if max_util <= 1.0 {
            AsBuiltStatus::WithinTolerance
        } else if max_util <= 1.2 {
            AsBuiltStatus::MarginallyOutside
        } else {
            AsBuiltStatus::OutOfTolerance
        };
    }
    
    /// Get summary of deviations
    pub fn deviation_summary(&self) -> DeviationSummary {
        let mut summary = DeviationSummary::default();
        
        for dim in &self.dimensions {
            let dev = dim.deviation().abs();
            summary.add_deviation(dev);
        }
        
        summary
    }
}

/// Deviation statistics summary
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct DeviationSummary {
    pub count: usize,
    pub min: f64,
    pub max: f64,
    pub mean: f64,
    pub std_dev: f64,
    values: Vec<f64>,
}

impl DeviationSummary {
    /// Add deviation value
    pub fn add_deviation(&mut self, value: f64) {
        self.count += 1;
        self.values.push(value);
        
        if self.count == 1 {
            self.min = value;
            self.max = value;
        } else {
            if value < self.min { self.min = value; }
            if value > self.max { self.max = value; }
        }
        
        self.mean = self.values.iter().sum::<f64>() / self.count as f64;
        
        if self.count > 1 {
            let variance = self.values.iter()
                .map(|v| (v - self.mean).powi(2))
                .sum::<f64>() / self.count as f64;
            self.std_dev = variance.sqrt();
        }
    }
}

// ============================================================================
// GEOMETRIC IMPERFECTIONS
// ============================================================================

/// Column imperfection data
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ColumnImperfection {
    /// Column ID
    pub column_id: String,
    /// Column height (mm)
    pub height: f64,
    /// Out-of-plumb at top (mm)
    pub out_of_plumb: f64,
    /// Out-of-plumb direction (degrees from N)
    pub direction: f64,
    /// Bow imperfection at mid-height (mm)
    pub bow: f64,
}

impl ColumnImperfection {
    pub fn new(column_id: &str, height: f64) -> Self {
        Self {
            column_id: column_id.to_string(),
            height,
            out_of_plumb: 0.0,
            direction: 0.0,
            bow: 0.0,
        }
    }
    
    /// Set imperfections from measurements
    pub fn from_measurements(
        column_id: &str,
        height: f64,
        top_x: f64, top_y: f64,
        base_x: f64, base_y: f64,
        mid_x: f64, mid_y: f64,
    ) -> Self {
        let dx = top_x - base_x;
        let dy = top_y - base_y;
        let out_of_plumb = (dx.powi(2) + dy.powi(2)).sqrt();
        let direction = dy.atan2(dx).to_degrees();
        
        // Bow = deviation from straight line at mid-height
        let mid_expected_x = (top_x + base_x) / 2.0;
        let mid_expected_y = (top_y + base_y) / 2.0;
        let bow = ((mid_x - mid_expected_x).powi(2) + (mid_y - mid_expected_y).powi(2)).sqrt();
        
        Self {
            column_id: column_id.to_string(),
            height,
            out_of_plumb,
            direction,
            bow,
        }
    }
    
    /// Out-of-plumb ratio
    pub fn plumb_ratio(&self) -> f64 {
        self.out_of_plumb / self.height
    }
    
    /// Bow ratio
    pub fn bow_ratio(&self) -> f64 {
        self.bow / self.height
    }
    
    /// Check against code limits
    pub fn check_en1090(&self) -> (bool, bool) {
        // EN 1090-2 tolerances
        let plumb_limit = (self.height / 300.0).max(5.0);
        let bow_limit = self.height / 750.0;
        
        (
            self.out_of_plumb <= plumb_limit,
            self.bow <= bow_limit,
        )
    }
    
    /// Equivalent imperfection for analysis
    pub fn equivalent_imperfection(&self) -> f64 {
        // Combined effect for buckling analysis
        // e0 = L/300 typical
        let e_plumb = self.out_of_plumb / 2.0; // Half at mid-height
        let e_bow = self.bow;
        
        // SRSS combination
        (e_plumb.powi(2) + e_bow.powi(2)).sqrt()
    }
}

/// Beam imperfection data
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BeamImperfection {
    /// Beam ID
    pub beam_id: String,
    /// Span length (mm)
    pub span: f64,
    /// Vertical deviation at midspan (mm)
    pub vertical_dev: f64,
    /// Lateral deviation at midspan (mm)
    pub lateral_dev: f64,
    /// Twist at support (degrees)
    pub twist: f64,
}

impl BeamImperfection {
    pub fn new(beam_id: &str, span: f64) -> Self {
        Self {
            beam_id: beam_id.to_string(),
            span,
            vertical_dev: 0.0,
            lateral_dev: 0.0,
            twist: 0.0,
        }
    }
    
    /// Set deviations
    pub fn with_deviations(mut self, vertical: f64, lateral: f64, twist: f64) -> Self {
        self.vertical_dev = vertical;
        self.lateral_dev = lateral;
        self.twist = twist;
        self
    }
    
    /// Camber ratio
    pub fn camber_ratio(&self) -> f64 {
        self.vertical_dev / self.span
    }
    
    /// Sweep ratio
    pub fn sweep_ratio(&self) -> f64 {
        self.lateral_dev / self.span
    }
    
    /// Check against code limits
    pub fn check_aisc_303(&self) -> (bool, bool, bool) {
        // AISC 303 tolerances
        let camber_limit = self.span / 960.0;
        let sweep_limit = (self.span / 960.0).max(6.0);
        let twist_limit = 1.0; // degrees
        
        (
            self.vertical_dev.abs() <= camber_limit,
            self.lateral_dev.abs() <= sweep_limit,
            self.twist.abs() <= twist_limit,
        )
    }
}

// ============================================================================
// AS-BUILT MODEL
// ============================================================================

/// Complete as-built model
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AsBuiltModel {
    /// Project name
    pub project_name: String,
    /// Survey date
    pub survey_date: String,
    /// Surveyor
    pub surveyor: String,
    /// Elements
    pub elements: HashMap<String, AsBuiltElement>,
    /// Column imperfections
    pub column_imperfections: Vec<ColumnImperfection>,
    /// Beam imperfections
    pub beam_imperfections: Vec<BeamImperfection>,
}

impl AsBuiltModel {
    pub fn new(project_name: &str) -> Self {
        Self {
            project_name: project_name.to_string(),
            survey_date: String::new(),
            surveyor: String::new(),
            elements: HashMap::new(),
            column_imperfections: Vec::new(),
            beam_imperfections: Vec::new(),
        }
    }
    
    /// Add element
    pub fn add_element(&mut self, element: AsBuiltElement) {
        self.elements.insert(element.element_id.clone(), element);
    }
    
    /// Add column imperfection
    pub fn add_column_imperfection(&mut self, imp: ColumnImperfection) {
        self.column_imperfections.push(imp);
    }
    
    /// Add beam imperfection
    pub fn add_beam_imperfection(&mut self, imp: BeamImperfection) {
        self.beam_imperfections.push(imp);
    }
    
    /// Overall statistics
    pub fn statistics(&self) -> AsBuiltStatistics {
        let total = self.elements.len();
        let mut within = 0;
        let mut marginal = 0;
        let mut outside = 0;
        
        for elem in self.elements.values() {
            match elem.status {
                AsBuiltStatus::WithinTolerance => within += 1,
                AsBuiltStatus::MarginallyOutside => marginal += 1,
                AsBuiltStatus::OutOfTolerance => outside += 1,
                AsBuiltStatus::NotMeasured => {}
            }
        }
        
        AsBuiltStatistics {
            total_elements: total,
            within_tolerance: within,
            marginally_outside: marginal,
            out_of_tolerance: outside,
            compliance_rate: if total > 0 { within as f64 / total as f64 * 100.0 } else { 0.0 },
        }
    }
    
    /// Get elements requiring action
    pub fn elements_requiring_action(&self) -> Vec<&AsBuiltElement> {
        self.elements.values()
            .filter(|e| matches!(e.status, AsBuiltStatus::MarginallyOutside | AsBuiltStatus::OutOfTolerance))
            .collect()
    }
}

/// As-built statistics
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct AsBuiltStatistics {
    pub total_elements: usize,
    pub within_tolerance: usize,
    pub marginally_outside: usize,
    pub out_of_tolerance: usize,
    pub compliance_rate: f64,
}

// ============================================================================
// TESTS
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_tolerance_class() {
        let tol = ToleranceClass::ConcreteClassA;
        let linear = tol.linear_tolerance(500.0);
        assert!((linear - 9.0).abs() < 0.1);
    }

    #[test]
    fn test_steel_tolerance() {
        let tol = ToleranceClass::SteelEXC2;
        let linear = tol.linear_tolerance(3000.0);
        assert!((linear - 4.0).abs() < 0.1);
    }

    #[test]
    fn test_measurement_point() {
        let p1 = MeasurementPoint::new("P1", 0.0, 0.0, 0.0);
        let p2 = MeasurementPoint::new("P2", 3.0, 4.0, 0.0);
        
        let dist = p1.distance_to(&p2);
        assert!((dist - 5.0).abs() < 0.001);
    }

    #[test]
    fn test_measured_dimension() {
        let dim = MeasuredDimension::new("Width", 300.0, 303.0, ToleranceClass::ConcreteClassA);
        
        assert!((dim.deviation() - 3.0).abs() < 0.1);
        assert!(dim.is_within_tolerance());
    }

    #[test]
    fn test_out_of_tolerance() {
        let dim = MeasuredDimension::new("Width", 300.0, 320.0, ToleranceClass::ConcreteClassA);
        
        assert!(!dim.is_within_tolerance());
    }

    #[test]
    fn test_as_built_element() {
        let mut elem = AsBuiltElement::new("C1", "Column", ToleranceClass::ConcreteClassA);
        
        elem.add_dimension(MeasuredDimension::new("Width", 400.0, 402.0, ToleranceClass::ConcreteClassA));
        elem.add_dimension(MeasuredDimension::new("Depth", 400.0, 399.0, ToleranceClass::ConcreteClassA));
        
        elem.evaluate();
        
        assert_eq!(elem.status, AsBuiltStatus::WithinTolerance);
    }

    #[test]
    fn test_column_imperfection() {
        let col = ColumnImperfection::from_measurements(
            "C1", 3000.0,
            5.0, 3.0,   // Top
            0.0, 0.0,   // Base
            2.0, 1.0,   // Mid
        );
        
        assert!(col.out_of_plumb > 5.0);
        assert!(col.plumb_ratio() < 0.01);
    }

    #[test]
    fn test_column_limits() {
        let mut col = ColumnImperfection::new("C1", 3000.0);
        col.out_of_plumb = 8.0;
        col.bow = 3.0;
        
        let (plumb_ok, bow_ok) = col.check_en1090();
        assert!(plumb_ok);
        assert!(bow_ok);
    }

    #[test]
    fn test_beam_imperfection() {
        let beam = BeamImperfection::new("B1", 6000.0)
            .with_deviations(-5.0, 3.0, 0.5);
        
        let (camber, sweep, twist) = beam.check_aisc_303();
        assert!(camber);
        assert!(sweep);
        assert!(twist);
    }

    #[test]
    fn test_as_built_model() {
        let mut model = AsBuiltModel::new("Test Project");
        
        let mut elem1 = AsBuiltElement::new("C1", "Column", ToleranceClass::ConcreteClassA);
        elem1.status = AsBuiltStatus::WithinTolerance;
        
        let mut elem2 = AsBuiltElement::new("C2", "Column", ToleranceClass::ConcreteClassA);
        elem2.status = AsBuiltStatus::OutOfTolerance;
        
        model.add_element(elem1);
        model.add_element(elem2);
        
        let stats = model.statistics();
        assert_eq!(stats.total_elements, 2);
        assert_eq!(stats.within_tolerance, 1);
        assert_eq!(stats.out_of_tolerance, 1);
    }

    #[test]
    fn test_deviation_summary() {
        let mut summary = DeviationSummary::default();
        summary.add_deviation(2.0);
        summary.add_deviation(4.0);
        summary.add_deviation(6.0);
        
        assert_eq!(summary.count, 3);
        assert!((summary.mean - 4.0).abs() < 0.1);
        assert!((summary.min - 2.0).abs() < 0.1);
        assert!((summary.max - 6.0).abs() < 0.1);
    }

    #[test]
    fn test_elements_requiring_action() {
        let mut model = AsBuiltModel::new("Test");
        
        let mut elem1 = AsBuiltElement::new("E1", "Beam", ToleranceClass::SteelEXC2);
        elem1.status = AsBuiltStatus::WithinTolerance;
        
        let mut elem2 = AsBuiltElement::new("E2", "Beam", ToleranceClass::SteelEXC2);
        elem2.status = AsBuiltStatus::OutOfTolerance;
        
        model.add_element(elem1);
        model.add_element(elem2);
        
        let action_required = model.elements_requiring_action();
        assert_eq!(action_required.len(), 1);
    }
}
