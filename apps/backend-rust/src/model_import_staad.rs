use std::collections::HashMap;
use std::io::{BufRead, BufReader, Read};

use crate::model_import::{
    CombinationType, EndReleases, ForceUnit, ImportFormat, ImportedElement, ImportedElementType,
    ImportedLoad, ImportedLoadCase, ImportedLoadCombination, ImportedMaterial, ImportedModel,
    ImportedNode, ImportedSection, ImportedSupport, LengthUnit, LoadCaseType, LoadDirection,
    MaterialType, SectionType, UnitSystem,
};
use crate::model_import_types::{ImportError, ImportWarning};

/// STAAD.Pro text input file parser
pub struct StaadParser {
    units: UnitSystem,
    nodes: HashMap<usize, ImportedNode>,
    elements: Vec<ImportedElement>,
    materials: Vec<ImportedMaterial>,
    sections: Vec<ImportedSection>,
    supports: Vec<ImportedSupport>,
    load_cases: Vec<ImportedLoadCase>,
    combinations: Vec<ImportedLoadCombination>,
    warnings: Vec<ImportWarning>,
    errors: Vec<ImportError>,
    current_load_case: Option<usize>,
    line_number: usize,
}

impl StaadParser {
    pub fn new() -> Self {
        Self {
            units: UnitSystem::default(),
            nodes: HashMap::new(),
            elements: Vec::new(),
            materials: Vec::new(),
            sections: Vec::new(),
            supports: Vec::new(),
            load_cases: Vec::new(),
            combinations: Vec::new(),
            warnings: Vec::new(),
            errors: Vec::new(),
            current_load_case: None,
            line_number: 0,
        }
    }

    /// Parse STAAD text input
    pub fn parse<R: Read>(&mut self, reader: R) -> Result<ImportedModel, String> {
        let buf_reader = BufReader::new(reader);
        
        for line in buf_reader.lines() {
            self.line_number += 1;
            if let Ok(content) = line {
                self.parse_line(&content);
            }
        }
        
        Ok(self.build_model())
    }

    fn parse_line(&mut self, line: &str) {
        let line = line.trim();
        if line.is_empty() || line.starts_with('*') || line.starts_with(';') {
            return; // Skip comments and empty lines
        }

        let upper = line.to_uppercase();
        let tokens: Vec<&str> = upper.split_whitespace().collect();
        
        if tokens.is_empty() {
            return;
        }

        // Handle multi-word commands first
        if tokens[0] == "MEMBER" && tokens.len() > 1 {
            if tokens[1] == "PROPERTY" {
                self.parse_member_property(line);
                return;
            } else if tokens[1] == "LOAD" {
                self.parse_member_load(line);
                return;
            }
        }
        
        if tokens[0] == "JOINT" && tokens.len() > 1 && tokens[1] == "LOAD" {
            self.parse_joint_load(line);
            return;
        }
        
        if tokens[0] == "LOAD" && tokens.len() > 1 && tokens[1] == "COMBINATION" {
            self.parse_load_combination(line);
            return;
        }

        match tokens[0] {
            "STAAD" => self.parse_staad_header(&tokens),
            "UNIT" => self.parse_units(&tokens),
            "JOINT" => self.parse_joint_coordinates(line),
            "MEMBER" => self.parse_member_incidences(line),
            "ELEMENT" => self.parse_element_incidences(line),
            "DEFINE" => self.parse_define(&tokens),
            "CONSTANTS" => self.parse_constants(line),
            "SUPPORTS" => self.parse_supports(line),
            "LOAD" => self.parse_load_case(&tokens, line),
            "SELFWEIGHT" => self.parse_selfweight(&tokens),
            "PERFORM" | "ANALYSIS" | "PRINT" | "FINISH" => {
                // Commands we acknowledge but don't process
            }
            _ => {
                // Try to parse as continuation of previous command
                self.parse_continuation(line);
            }
        }
    }

    fn parse_staad_header(&mut self, tokens: &[&str]) {
        // STAAD SPACE / STAAD PLANE / STAAD FLOOR
        if tokens.len() > 1 {
            match tokens[1] {
                "SPACE" => { /* 3D analysis */ }
                "PLANE" => { /* 2D frame analysis */ }
                "FLOOR" => { /* Floor analysis */ }
                _ => {}
            }
        }
    }

    fn parse_units(&mut self, tokens: &[&str]) {
        // UNIT METER KN / UNIT FT KIP / etc.
        for token in tokens.iter().skip(1) {
            match *token {
                "METER" | "MET" | "M" => self.units.length = LengthUnit::Meter,
                "MM" | "MILLIMETER" => self.units.length = LengthUnit::Millimeter,
                "CM" | "CENTIMETER" => self.units.length = LengthUnit::Centimeter,
                "FT" | "FEET" | "FOOT" => self.units.length = LengthUnit::Feet,
                "IN" | "INCH" => self.units.length = LengthUnit::Inch,
                "KN" | "KILONEWTON" => self.units.force = ForceUnit::KiloNewton,
                "N" | "NEWTON" => self.units.force = ForceUnit::Newton,
                "KIP" => self.units.force = ForceUnit::Kip,
                "LB" | "POUND" => self.units.force = ForceUnit::Pound,
                "KG" | "KILOGRAM" => self.units.force = ForceUnit::Kilogram,
                _ => {}
            }
        }
    }

    fn parse_joint_coordinates(&mut self, line: &str) {
        // JOINT COORDINATES
        // 1 0 0 0; 2 5 0 0; 3 10 0 0
        // or: 1 0 0 0  2 5 0 0  3 10 0 0
        
        let parts: Vec<&str> = line.split(|c| c == ';' || c == '\t')
            .map(|s| s.trim())
            .filter(|s| !s.is_empty() && !s.to_uppercase().starts_with("JOINT"))
            .collect();

        for part in parts {
            let tokens: Vec<&str> = part.split_whitespace().collect();
            if tokens.len() >= 4 {
                if let (Ok(id), Ok(x), Ok(y), Ok(z)) = (
                    tokens[0].parse::<usize>(),
                    tokens[1].parse::<f64>(),
                    tokens[2].parse::<f64>(),
                    tokens[3].parse::<f64>(),
                ) {
                    let x_conv = self.convert_length(x);
                    let y_conv = self.convert_length(y);
                    let z_conv = self.convert_length(z);
                    
                    self.nodes.insert(id, ImportedNode {
                        id,
                        original_id: tokens[0].to_string(),
                        x: x_conv,
                        y: y_conv,
                        z: z_conv,
                    });
                }
            }
        }
    }

    fn parse_member_incidences(&mut self, line: &str) {
        // MEMBER INCIDENCES
        // 1 1 2; 2 2 3; 3 3 4
        
        let parts: Vec<&str> = line.split(';')
            .map(|s| s.trim())
            .filter(|s| !s.is_empty() && !s.to_uppercase().contains("MEMBER") && !s.to_uppercase().contains("INCIDENCE"))
            .collect();

        for part in parts {
            let tokens: Vec<&str> = part.split_whitespace().collect();
            if tokens.len() >= 3 {
                if let (Ok(id), Ok(n1), Ok(n2)) = (
                    tokens[0].parse::<usize>(),
                    tokens[1].parse::<usize>(),
                    tokens[2].parse::<usize>(),
                ) {
                    self.elements.push(ImportedElement {
                        id,
                        original_id: tokens[0].to_string(),
                        element_type: ImportedElementType::Beam,
                        node_ids: vec![n1, n2],
                        material_id: None,
                        section_id: None,
                        releases: None,
                        orientation_angle: 0.0,
                    });
                }
            }
        }
    }

    fn parse_element_incidences(&mut self, line: &str) {
        // ELEMENT INCIDENCES SHELL
        // 1 1 2 5 4; 2 2 3 6 5
        
        let parts: Vec<&str> = line.split(';')
            .map(|s| s.trim())
            .filter(|s| !s.is_empty() && !s.to_uppercase().contains("ELEMENT") && !s.to_uppercase().contains("INCIDENCE"))
            .collect();

        for part in parts {
            let tokens: Vec<&str> = part.split_whitespace().collect();
            if tokens.len() >= 4 {
                if let Ok(_id) = tokens[0].parse::<usize>() {
                    let node_ids: Vec<usize> = tokens[1..]
                        .iter()
                        .filter_map(|t| t.parse().ok())
                        .collect();
                    
                    let element_type = match node_ids.len() {
                        3 => ImportedElementType::Plate3,
                        4 => ImportedElementType::Plate4,
                        8 => ImportedElementType::Solid8,
                        _ => ImportedElementType::Plate4,
                    };
                    
                    self.elements.push(ImportedElement {
                        id: self.elements.len() + 1,
                        original_id: tokens[0].to_string(),
                        element_type,
                        node_ids,
                        material_id: None,
                        section_id: None,
                        releases: None,
                        orientation_angle: 0.0,
                    });
                }
            }
        }
    }

    fn parse_define(&mut self, tokens: &[&str]) {
        // DEFINE MATERIAL START
        if tokens.len() > 1 && tokens[1] == "MATERIAL" {
            // Material definition starts
        }
    }

    fn parse_constants(&mut self, line: &str) {
        // CONSTANTS
        // E 2.1E11 ALL
        // POISSON 0.3 ALL
        // DENSITY 7850 ALL
        
        let upper = line.to_uppercase();
        let tokens: Vec<&str> = upper.split_whitespace().collect();
        
        if tokens.len() >= 3 {
            let value: f64 = tokens[1].parse().unwrap_or(0.0);
            
            // Create or update default material
            if self.materials.is_empty() {
                self.materials.push(ImportedMaterial {
                    id: 1,
                    name: "STEEL".to_string(),
                    material_type: MaterialType::Steel,
                    e: 2.1e11,
                    nu: 0.3,
                    density: 7850.0,
                    fy: Some(250e6),
                    fu: Some(410e6),
                    fck: None,
                    alpha: 12e-6,
                });
            }
            
            match tokens[0] {
                "E" => self.materials[0].e = value,
                "POISSON" => self.materials[0].nu = value,
                "DENSITY" => self.materials[0].density = value,
                _ => {}
            }
        }
    }

    fn parse_member_property(&mut self, line: &str) {
        // MEMBER PROPERTY AMERICAN
        // 1 TO 10 TABLE ST W12X26
        // 11 12 PRIS YD 0.5 ZD 0.3
        
        let upper = line.to_uppercase();
        
        if upper.contains("TABLE") {
            // Standard section
            if let Some(idx) = upper.find("TABLE") {
                let section_part = &upper[idx..];
                let tokens: Vec<&str> = section_part.split_whitespace().collect();
                if tokens.len() >= 3 {
                    let section_name = format!("{} {}", tokens[1], tokens[2]);
                    self.add_section(&section_name);
                }
            }
        } else if upper.contains("PRIS") {
            // Prismatic section
            self.parse_prismatic_section(&upper);
        }
    }

    fn parse_prismatic_section(&mut self, line: &str) {
        // PRIS YD 0.5 ZD 0.3  or  PRIS AX 0.01 IX 0.001 IY 0.0005 IZ 0.0005
        let tokens: Vec<&str> = line.split_whitespace().collect();
        
        let mut area = 0.01;
        let mut ixx = 0.001;
        let mut iyy = 0.0005;
        let mut izz = 0.0005;
        let mut depth = 0.5;
        let mut width = 0.3;
        
        let mut i = 0;
        while i < tokens.len() - 1 {
            match tokens[i] {
                "AX" => area = tokens[i + 1].parse().unwrap_or(area),
                "IX" => ixx = tokens[i + 1].parse().unwrap_or(ixx),
                "IY" => iyy = tokens[i + 1].parse().unwrap_or(iyy),
                "IZ" => izz = tokens[i + 1].parse().unwrap_or(izz),
                "YD" => depth = tokens[i + 1].parse().unwrap_or(depth),
                "ZD" => width = tokens[i + 1].parse().unwrap_or(width),
                _ => {}
            }
            i += 1;
        }
        
        self.sections.push(ImportedSection {
            id: self.sections.len() + 1,
            name: format!("PRIS_{}", self.sections.len() + 1),
            section_type: SectionType::Rectangle,
            area: self.convert_area(area),
            ixx: self.convert_inertia(ixx),
            iyy: self.convert_inertia(iyy),
            izz: self.convert_inertia(izz),
            j: self.convert_inertia(ixx + iyy),
            depth: Some(self.convert_length(depth)),
            width: Some(self.convert_length(width)),
            tw: None,
            tf: None,
        });
    }

    fn add_section(&mut self, name: &str) {
        // Lookup standard section from database
        let (area, ixx, iyy, depth, width) = self.lookup_section(name);
        
        self.sections.push(ImportedSection {
            id: self.sections.len() + 1,
            name: name.to_string(),
            section_type: if name.contains('W') || name.contains("ISMB") {
                SectionType::ISection
            } else if name.contains('C') || name.contains("ISMC") {
                SectionType::Channel
            } else {
                SectionType::Custom
            },
            area,
            ixx,
            iyy,
            izz: iyy,
            j: ixx + iyy,
            depth: Some(depth),
            width: Some(width),
            tw: None,
            tf: None,
        });
    }

    fn lookup_section(&self, name: &str) -> (f64, f64, f64, f64, f64) {
        // Common section database (area m², Ixx m⁴, Iyy m⁴, depth m, width m)
        match name.trim() {
            "ST W12X26" | "W12X26" => (4.94e-3, 1.04e-4, 1.70e-5, 0.310, 0.165),
            "ST W14X30" | "W14X30" => (5.68e-3, 1.58e-4, 2.15e-5, 0.352, 0.171),
            "ST W16X36" | "W16X36" => (6.84e-3, 2.48e-4, 2.45e-5, 0.406, 0.178),
            "ST W18X50" | "W18X50" => (9.48e-3, 4.00e-4, 3.37e-5, 0.457, 0.190),
            "ST W21X62" | "W21X62" => (1.18e-2, 5.54e-4, 4.12e-5, 0.533, 0.210),
            "ISMB 300" => (5.87e-3, 8.60e-5, 4.54e-6, 0.300, 0.140),
            "ISMB 400" => (7.84e-3, 2.04e-4, 6.22e-6, 0.400, 0.140),
            "ISMB 500" => (1.10e-2, 4.52e-4, 1.37e-5, 0.500, 0.180),
            _ => (1.0e-2, 1.0e-4, 1.0e-5, 0.300, 0.150), // Default
        }
    }

    fn parse_supports(&mut self, line: &str) {
        // SUPPORTS
        // 1 4 FIXED
        // 2 3 PINNED
        // 5 FIXED BUT MZ
        
        let upper = line.to_uppercase();
        let tokens: Vec<&str> = upper.split_whitespace().collect();
        
        if tokens.len() < 2 {
            return;
        }
        
        // Find support type
        let is_fixed = upper.contains("FIXED");
        let is_pinned = upper.contains("PINNED");
        let has_but = upper.contains("BUT");
        
        // Parse node IDs (before FIXED/PINNED keyword)
        let mut node_ids: Vec<usize> = Vec::new();
        for token in &tokens {
            if let Ok(id) = token.parse::<usize>() {
                node_ids.push(id);
            } else if *token == "FIXED" || *token == "PINNED" || *token == "BUT" {
                break;
            } else if *token == "TO" {
                // Handle range: 1 TO 5
                continue;
            }
        }
        
        // Parse releases after BUT
        let mut releases = [false; 6]; // FX, FY, FZ, MX, MY, MZ
        if has_but {
            if upper.contains("FX") { releases[0] = true; }
            if upper.contains("FY") { releases[1] = true; }
            if upper.contains("FZ") { releases[2] = true; }
            if upper.contains("MX") { releases[3] = true; }
            if upper.contains("MY") { releases[4] = true; }
            if upper.contains("MZ") { releases[5] = true; }
        }
        
        // Create supports
        for node_id in node_ids {
            let (fx, fy, fz, mx, my, mz) = if is_fixed {
                (!releases[0], !releases[1], !releases[2], 
                 !releases[3], !releases[4], !releases[5])
            } else if is_pinned {
                (true, true, true, false, false, false)
            } else {
                (true, true, true, true, true, true)
            };
            
            self.supports.push(ImportedSupport {
                node_id,
                fx, fy, fz, mx, my, mz,
                spring_stiffness: None,
            });
        }
    }

    fn parse_load_case(&mut self, tokens: &[&str], line: &str) {
        // LOAD 1 DEAD LOAD
        // LOAD 2 LIVE LOAD
        
        if tokens.len() >= 2 {
            if let Ok(id) = tokens[1].parse::<usize>() {
                let name = if tokens.len() > 2 {
                    tokens[2..].join(" ")
                } else {
                    format!("LOAD {}", id)
                };
                
                let load_type = if line.to_uppercase().contains("DEAD") {
                    LoadCaseType::Dead
                } else if line.to_uppercase().contains("LIVE") {
                    LoadCaseType::Live
                } else if line.to_uppercase().contains("WIND") {
                    LoadCaseType::Wind
                } else if line.to_uppercase().contains("SEISMIC") || line.to_uppercase().contains("EQ") {
                    LoadCaseType::Seismic
                } else {
                    LoadCaseType::Other
                };
                
                self.load_cases.push(ImportedLoadCase {
                    id,
                    name,
                    load_type,
                    loads: Vec::new(),
                });
                self.current_load_case = Some(self.load_cases.len() - 1);
            }
        }
    }

    fn parse_member_load(&mut self, line: &str) {
        // MEMBER LOAD
        // 1 TO 10 UNI GY -25
        // 5 CON GY -50 2.5
        
        let upper = line.to_uppercase();
        let tokens: Vec<&str> = upper.split_whitespace().collect();
        
        if let Some(lc_idx) = self.current_load_case {
            // Find load type position
            let uni_pos = tokens.iter().position(|&t| t == "UNI" || t == "UNIFORM");
            let con_pos = tokens.iter().position(|&t| t == "CON" || t == "CONCENTRATED");
            
            // Parse member IDs (before load type)
            let end_pos = uni_pos.or(con_pos).unwrap_or(tokens.len());
            let mut member_ids: Vec<usize> = Vec::new();
            let mut i = 0;
            while i < end_pos {
                if tokens[i] == "MEMBER" || tokens[i] == "LOAD" {
                    i += 1;
                    continue;
                }
                if let Ok(id) = tokens[i].parse::<usize>() {
                    member_ids.push(id);
                    // Handle TO ranges
                    if i + 2 < end_pos && tokens[i + 1] == "TO" {
                        if let Ok(end_id) = tokens[i + 2].parse::<usize>() {
                            for mid in (id + 1)..=end_id {
                                member_ids.push(mid);
                            }
                            i += 2;
                        }
                    }
                }
                i += 1;
            }
            
            // Parse load values
            if let Some(pos) = uni_pos {
                // UNI GY -25
                if pos + 2 < tokens.len() {
                    let direction = tokens[pos + 1];
                    let value: f64 = tokens[pos + 2].parse().unwrap_or(0.0);
                    let value_conv = self.convert_force_per_length(value);
                    
                    let (wx, wy, wz) = match direction {
                        "GX" => (value_conv, 0.0, 0.0),
                        "GY" => (0.0, value_conv, 0.0),
                        "GZ" => (0.0, 0.0, value_conv),
                        "X" => (value_conv, 0.0, 0.0),
                        "Y" => (0.0, value_conv, 0.0),
                        "Z" => (0.0, 0.0, value_conv),
                        _ => (0.0, value_conv, 0.0),
                    };
                    
                    for member_id in &member_ids {
                        self.load_cases[lc_idx].loads.push(ImportedLoad::MemberUniform {
                            element_id: *member_id,
                            wx, wy, wz,
                            direction: if direction.starts_with('G') { 
                                LoadDirection::Global 
                            } else { 
                                LoadDirection::Local 
                            },
                        });
                    }
                }
            }
            
            if let Some(pos) = con_pos {
                // CON GY -50 2.5
                if pos + 3 < tokens.len() {
                    let direction = tokens[pos + 1];
                    let value: f64 = tokens[pos + 2].parse().unwrap_or(0.0);
                    let distance: f64 = tokens[pos + 3].parse().unwrap_or(0.0);
                    let value_conv = self.convert_force(value);
                    let dist_conv = self.convert_length(distance);
                    
                    let (fx, fy, fz) = match direction {
                        "GX" | "X" => (value_conv, 0.0, 0.0),
                        "GY" | "Y" => (0.0, value_conv, 0.0),
                        "GZ" | "Z" => (0.0, 0.0, value_conv),
                        _ => (0.0, value_conv, 0.0),
                    };
                    
                    for member_id in &member_ids {
                        self.load_cases[lc_idx].loads.push(ImportedLoad::MemberPoint {
                            element_id: *member_id,
                            distance: dist_conv,
                            fx, fy, fz,
                            direction: LoadDirection::Global,
                        });
                    }
                }
            }
        }
    }

    fn parse_joint_load(&mut self, line: &str) {
        // JOINT LOAD
        // 5 FY -100 MZ 50
        
        let upper = line.to_uppercase();
        let tokens: Vec<&str> = upper.split_whitespace().collect();
        
        if let Some(lc_idx) = self.current_load_case {
            let mut node_ids: Vec<usize> = Vec::new();
            let mut fx = 0.0;
            let mut fy = 0.0;
            let mut fz = 0.0;
            let mut mx = 0.0;
            let mut my = 0.0;
            let mut mz = 0.0;
            
            let mut i = 0;
            while i < tokens.len() {
                if tokens[i] == "JOINT" || tokens[i] == "LOAD" {
                    i += 1;
                    continue;
                }
                
                if let Ok(id) = tokens[i].parse::<usize>() {
                    node_ids.push(id);
                } else if i + 1 < tokens.len() {
                    let val: f64 = tokens[i + 1].parse().unwrap_or(0.0);
                    match tokens[i] {
                        "FX" => fx = self.convert_force(val),
                        "FY" => fy = self.convert_force(val),
                        "FZ" => fz = self.convert_force(val),
                        "MX" => mx = self.convert_moment(val),
                        "MY" => my = self.convert_moment(val),
                        "MZ" => mz = self.convert_moment(val),
                        _ => {}
                    }
                    i += 1;
                }
                i += 1;
            }
            
            for node_id in node_ids {
                self.load_cases[lc_idx].loads.push(ImportedLoad::NodalForce {
                    node_id,
                    fx, fy, fz, mx, my, mz,
                });
            }
        }
    }

    fn parse_selfweight(&mut self, tokens: &[&str]) {
        // SELFWEIGHT Y -1
        
        if let Some(lc_idx) = self.current_load_case {
            let mut factor_x = 0.0;
            let mut factor_y = 0.0;
            let mut factor_z = 0.0;
            
            if tokens.len() >= 3 {
                let factor: f64 = tokens[2].parse().unwrap_or(-1.0);
                match tokens[1] {
                    "X" => factor_x = factor,
                    "Y" => factor_y = factor,
                    "Z" => factor_z = factor,
                    _ => factor_y = -1.0,
                }
            } else {
                factor_y = -1.0;
            }
            
            self.load_cases[lc_idx].loads.push(ImportedLoad::SelfWeight {
                factor_x, factor_y, factor_z,
            });
        }
    }

    fn parse_load_combination(&mut self, line: &str) {
        // LOAD COMBINATION 10
        // 1 1.5 2 1.5 3 0.9
        
        let upper = line.to_uppercase();
        let tokens: Vec<&str> = upper.split_whitespace().collect();
        
        // Find combination ID
        if let Some(pos) = tokens.iter().position(|&t| t == "COMBINATION") {
            if pos + 1 < tokens.len() {
                if let Ok(id) = tokens[pos + 1].parse::<usize>() {
                    self.combinations.push(ImportedLoadCombination {
                        id,
                        name: format!("COMBINATION {}", id),
                        combination_type: CombinationType::Linear,
                        factors: Vec::new(),
                    });
                }
            }
        }
    }

    fn parse_continuation(&mut self, line: &str) {
        // Parse continuation lines (e.g., joint coordinates, combination factors)
        // Handle semicolon-separated entries like "1 0 0 0; 2 5 0 0; 3 10 0 0"
        let upper = line.to_uppercase();
        let _tokens: Vec<&str> = upper.split_whitespace().collect();
        
        // Handle section table assignments: "1 TABLE ST W12X26" or "1 TO 10 TABLE ST W12X26"
        if upper.contains("TABLE") {
            if let Some(idx) = upper.find("TABLE") {
                let section_part = &upper[idx..];
                let section_tokens: Vec<&str> = section_part.split_whitespace().collect();
                if section_tokens.len() >= 3 {
                    let section_name = format!("{} {}", section_tokens[1], section_tokens[2]);
                    self.add_section(&section_name);
                }
            }
            return;
        }
        
        // Handle prismatic sections: "1 PRIS YD 0.5 ZD 0.3"
        if upper.contains("PRIS") {
            self.parse_prismatic_section(&upper);
            return;
        }
        
        // Handle supports: "1 FIXED" or "3 PINNED" or "5 FIXED BUT MZ"
        if upper.contains("FIXED") || upper.contains("PINNED") {
            self.parse_supports(line);
            return;
        }
        
        // Handle joint loads: "2 FY -100" or "5 FX 10 FY -50 MZ 25"
        // But NOT if it contains FIXED/PINNED (those are support definitions)
        if (upper.contains("FX") || upper.contains("FY") || upper.contains("FZ") 
            || upper.contains("MX") || upper.contains("MY") || upper.contains("MZ"))
            && !upper.contains("FIXED") && !upper.contains("PINNED") {
            self.parse_joint_load(line);
            return;
        }
        
        // Handle member loads: "1 UNI GY -20" or "1 2 UNI GY -10"
        if upper.contains("UNI") || upper.contains("CON") || upper.contains("TRAP") 
            || upper.contains("CMOM") || upper.contains("PMOM") {
            self.parse_member_load(line);
            return;
        }
        
        let parts: Vec<&str> = line.split(';')
            .map(|s| s.trim())
            .filter(|s| !s.is_empty())
            .collect();
        
        for part in parts {
            let part_tokens: Vec<&str> = part.split_whitespace().collect();
            
            // Try to parse as joint coordinates
            if part_tokens.len() >= 4 {
                if let (Ok(id), Ok(x), Ok(y), Ok(z)) = (
                    part_tokens[0].parse::<usize>(),
                    part_tokens[1].parse::<f64>(),
                    part_tokens[2].parse::<f64>(),
                    part_tokens[3].parse::<f64>(),
                ) {
                    let x_conv = self.convert_length(x);
                    let y_conv = self.convert_length(y);
                    let z_conv = self.convert_length(z);
                    
                    self.nodes.insert(id, ImportedNode {
                        id,
                        original_id: part_tokens[0].to_string(),
                        x: x_conv,
                        y: y_conv,
                        z: z_conv,
                    });
                    continue;
                }
            }
            
            // Try to parse as member incidences
            if part_tokens.len() >= 3 {
                if let (Ok(id), Ok(n1), Ok(n2)) = (
                    part_tokens[0].parse::<usize>(),
                    part_tokens[1].parse::<usize>(),
                    part_tokens[2].parse::<usize>(),
                ) {
                    // Only add if it looks like member incidence (all integers)
                    // and not already existing
                    if !self.elements.iter().any(|e| e.id == id) {
                        self.elements.push(ImportedElement {
                            id,
                            original_id: part_tokens[0].to_string(),
                            element_type: ImportedElementType::Beam,
                            node_ids: vec![n1, n2],
                            material_id: None,
                            section_id: None,
                            releases: None,
                            orientation_angle: 0.0,
                        });
                        continue;
                    }
                }
            }
            
            // Try to parse as combination factors
            if !self.combinations.is_empty() {
                let comb_idx = self.combinations.len() - 1;
                let mut i = 0;
                while i + 1 < part_tokens.len() {
                    if let (Ok(lc_id), Ok(factor)) = (
                        part_tokens[i].parse::<usize>(),
                        part_tokens[i + 1].parse::<f64>(),
                    ) {
                        self.combinations[comb_idx].factors.push((lc_id, factor));
                    }
                    i += 2;
                }
            }
        }
    }

    // Unit conversion functions
    fn convert_length(&self, value: f64) -> f64 {
        match self.units.length {
            LengthUnit::Meter => value,
            LengthUnit::Millimeter => value / 1000.0,
            LengthUnit::Centimeter => value / 100.0,
            LengthUnit::Feet => value * 0.3048,
            LengthUnit::Inch => value * 0.0254,
        }
    }

    fn convert_area(&self, value: f64) -> f64 {
        let factor = match self.units.length {
            LengthUnit::Meter => 1.0,
            LengthUnit::Millimeter => 1e-6,
            LengthUnit::Centimeter => 1e-4,
            LengthUnit::Feet => 0.3048 * 0.3048,
            LengthUnit::Inch => 0.0254 * 0.0254,
        };
        value * factor
    }

    fn convert_inertia(&self, value: f64) -> f64 {
        let factor = match self.units.length {
            LengthUnit::Meter => 1.0,
            LengthUnit::Millimeter => 1e-12,
            LengthUnit::Centimeter => 1e-8,
            LengthUnit::Feet => 0.3048_f64.powi(4),
            LengthUnit::Inch => 0.0254_f64.powi(4),
        };
        value * factor
    }

    fn convert_force(&self, value: f64) -> f64 {
        match self.units.force {
            ForceUnit::Newton => value,
            ForceUnit::KiloNewton => value * 1000.0,
            ForceUnit::MegaNewton => value * 1e6,
            ForceUnit::Kilogram => value * 9.81,
            ForceUnit::Pound => value * 4.448,
            ForceUnit::Kip => value * 4448.0,
        }
    }

    fn convert_force_per_length(&self, value: f64) -> f64 {
        let force = self.convert_force(value);
        let length_factor = match self.units.length {
            LengthUnit::Meter => 1.0,
            LengthUnit::Millimeter => 1000.0,
            LengthUnit::Centimeter => 100.0,
            LengthUnit::Feet => 1.0 / 0.3048,
            LengthUnit::Inch => 1.0 / 0.0254,
        };
        force * length_factor
    }

    fn convert_moment(&self, value: f64) -> f64 {
        let force = self.convert_force(value);
        let length = match self.units.length {
            LengthUnit::Meter => 1.0,
            LengthUnit::Millimeter => 0.001,
            LengthUnit::Centimeter => 0.01,
            LengthUnit::Feet => 0.3048,
            LengthUnit::Inch => 0.0254,
        };
        force * length
    }

    fn build_model(&self) -> ImportedModel {
        let mut nodes: Vec<ImportedNode> = self.nodes.values().cloned().collect();
        nodes.sort_by_key(|n| n.id);
        
        ImportedModel {
            name: "STAAD Import".to_string(),
            source_format: ImportFormat::StaadTxt,
            units: UnitSystem::default(), // Converted to SI
            nodes,
            elements: self.elements.clone(),
            materials: self.materials.clone(),
            sections: self.sections.clone(),
            supports: self.supports.clone(),
            load_cases: self.load_cases.clone(),
            load_combinations: self.combinations.clone(),
            warnings: self.warnings.clone(),
            errors: self.errors.clone(),
        }
    }
}

// ============================================================================
