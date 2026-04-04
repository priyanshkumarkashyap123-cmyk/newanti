// ============================================================================
// SECTION DATABASE MANAGER
// ============================================================================

use std::collections::HashMap;

use crate::section_data_aisc::*;
use crate::section_data_european::*;
use crate::section_data_indian::*;
use crate::section_types::*;

/// Unified section database with query capabilities
pub struct SectionDatabase {
    sections: HashMap<String, SteelSection>,
    by_standard: HashMap<SectionStandard, Vec<String>>,
    by_shape: HashMap<SectionShape, Vec<String>>,
}

impl SectionDatabase {
    /// Create a new section database with all standard sections
    pub fn new() -> Self {
        let mut db = SectionDatabase {
            sections: HashMap::new(),
            by_standard: HashMap::new(),
            by_shape: HashMap::new(),
        };
        
        // Load all sections
        for section in get_ismb_sections() {
            db.add_section(section);
        }
        for section in get_ismc_sections() {
            db.add_section(section);
        }
        for section in get_isa_sections() {
            db.add_section(section);
        }
        for section in get_aisc_w_sections() {
            db.add_section(section);
        }
        for section in get_aisc_hss_sections() {
            db.add_section(section);
        }
        for section in get_aisc_pipe_sections() {
            db.add_section(section);
        }
        for section in get_european_ipe_sections() {
            db.add_section(section);
        }
        for section in get_european_hea_sections() {
            db.add_section(section);
        }
        
        db
    }
    
    /// Add a section to the database
    pub fn add_section(&mut self, section: SteelSection) {
        let name = section.designation.clone();
        let standard = section.standard;
        let shape = section.shape;
        
        self.sections.insert(name.clone(), section);
        
        self.by_standard
            .entry(standard)
            .or_insert_with(Vec::new)
            .push(name.clone());
        
        self.by_shape
            .entry(shape)
            .or_insert_with(Vec::new)
            .push(name);
    }
    
    /// Get a section by designation
    pub fn get(&self, designation: &str) -> Option<&SteelSection> {
        self.sections.get(designation)
    }
    
    /// Get all sections by standard
    pub fn get_by_standard(&self, standard: SectionStandard) -> Vec<&SteelSection> {
        self.by_standard
            .get(&standard)
            .map(|names| {
                names.iter()
                    .filter_map(|n| self.sections.get(n))
                    .collect()
            })
            .unwrap_or_default()
    }
    
    /// Get all sections by shape
    pub fn get_by_shape(&self, shape: SectionShape) -> Vec<&SteelSection> {
        self.by_shape
            .get(&shape)
            .map(|names| {
                names.iter()
                    .filter_map(|n| self.sections.get(n))
                    .collect()
            })
            .unwrap_or_default()
    }
    
    /// Find sections with sufficient moment capacity
    pub fn find_by_moment_capacity(&self, required_zxx: f64, standard: Option<SectionStandard>) -> Vec<&SteelSection> {
        self.sections.values()
            .filter(|s| {
                s.zxx >= required_zxx && 
                standard.map_or(true, |std| s.standard == std)
            })
            .collect()
    }
    
    /// Find the most economical section for given requirements
    pub fn select_optimal(
        &self,
        required_zxx: f64,
        max_depth: Option<f64>,
        standard: Option<SectionStandard>,
        shape: Option<SectionShape>,
    ) -> Option<&SteelSection> {
        self.sections.values()
            .filter(|s| {
                s.zxx >= required_zxx &&
                max_depth.map_or(true, |d| s.d <= d) &&
                standard.map_or(true, |std| s.standard == std) &&
                shape.map_or(true, |sh| s.shape == sh)
            })
            .min_by(|a, b| {
                a.mass_per_m.partial_cmp(&b.mass_per_m).unwrap_or(std::cmp::Ordering::Equal)
            })
    }
    
    /// Get total section count
    pub fn count(&self) -> usize {
        self.sections.len()
    }
    
    /// List all section designations
    pub fn list_all(&self) -> Vec<&str> {
        self.sections.keys().map(|s| s.as_str()).collect()
    }
}

impl Default for SectionDatabase {
    fn default() -> Self {
        Self::new()
    }
}

// ============================================================================
// TESTS
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_section_database_creation() {
        let db = SectionDatabase::new();
        assert!(db.count() > 100, "Should have 100+ sections");
        println!("Total sections in database: {}", db.count());
    }
    
    #[test]
    fn test_get_ismb_section() {
        let db = SectionDatabase::new();
        let ismb300 = db.get("ISMB 300").expect("ISMB 300 should exist");
        assert_eq!(ismb300.d, 300.0);
        assert_eq!(ismb300.standard, SectionStandard::Indian);
        println!("ISMB 300: Area={} mm², Ixx={:.2e} mm⁴", ismb300.area, ismb300.ixx);
    }
    
    #[test]
    fn test_get_aisc_section() {
        let db = SectionDatabase::new();
        let w14 = db.get("W14X22").expect("W14X22 should exist");
        assert_eq!(w14.standard, SectionStandard::AISC);
        println!("W14X22: Area={} mm², Zxx={:.2e} mm³", w14.area, w14.zxx);
    }
    
    #[test]
    fn test_get_ipe_section() {
        let db = SectionDatabase::new();
        let ipe300 = db.get("IPE 300").expect("IPE 300 should exist");
        assert_eq!(ipe300.d, 300.0);
        assert_eq!(ipe300.standard, SectionStandard::European);
        println!("IPE 300: Area={} mm², Ixx={:.2e} mm⁴", ipe300.area, ipe300.ixx);
    }
    
    #[test]
    fn test_sections_by_standard() {
        let db = SectionDatabase::new();
        
        let indian = db.get_by_standard(SectionStandard::Indian);
        let aisc = db.get_by_standard(SectionStandard::AISC);
        let european = db.get_by_standard(SectionStandard::European);
        
        println!("Indian sections: {}", indian.len());
        println!("AISC sections: {}", aisc.len());
        println!("European sections: {}", european.len());
        
        assert!(indian.len() > 50, "Should have 50+ Indian sections");
        assert!(aisc.len() > 30, "Should have 30+ AISC sections");
        assert!(european.len() > 20, "Should have 20+ European sections");
    }
    
    #[test]
    fn test_optimal_section_selection() {
        let db = SectionDatabase::new();
        
        // Need Zxx >= 500e3 mm³ for a beam
        let required_zxx = 500e3;
        
        let optimal = db.select_optimal(
            required_zxx,
            Some(400.0),  // Max depth 400mm
            Some(SectionStandard::Indian),
            Some(SectionShape::IBeam),
        );
        
        if let Some(section) = optimal {
            println!("Optimal section: {} (Zxx={:.0e}, mass={:.1} kg/m)", 
                     section.designation, section.zxx, section.mass_per_m);
            assert!(section.zxx >= required_zxx);
            assert!(section.d <= 400.0);
        }
    }
    
    #[test]
    fn test_hss_section() {
        let db = SectionDatabase::new();
        let hss = db.get("HSS6X6X3/8").expect("HSS6X6X3/8 should exist");
        assert_eq!(hss.shape, SectionShape::HSSSquare);
        println!("HSS6X6X3/8: Area={:.0} mm², J={:.2e} mm⁴", hss.area, hss.j);
    }
    
    #[test]
    fn test_pipe_section() {
        let db = SectionDatabase::new();
        let pipe = db.get("PIPE6STD").expect("PIPE6STD should exist");
        assert_eq!(pipe.shape, SectionShape::Pipe);
        println!("PIPE6STD: OD={:.1} mm, t={:.2} mm", pipe.d, pipe.t);
    }
    
    #[test]
    fn test_angle_section() {
        let db = SectionDatabase::new();
        let angle = db.get("ISA 100x100x10").expect("ISA 100x100x10 should exist");
        assert_eq!(angle.shape, SectionShape::Angle);
        println!("ISA 100x100x10: Area={:.0} mm², rxx={:.1} mm", angle.area, angle.rxx);
    }
}
