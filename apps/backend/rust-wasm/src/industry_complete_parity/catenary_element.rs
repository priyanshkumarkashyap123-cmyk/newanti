use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CatenaryValidationResult {
    pub passed: bool,
    pub utilization: f64,
    pub message: String,
    pub clause: String,
}

/// True Catenary Cable Element with Ernst Modulus
/// Industry standard: MIDAS Civil, CSiBridge, SAP2000
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CatenaryElement {
    pub id: usize,
    pub node_i: usize,
    pub node_j: usize,
    pub e: f64,              // Young's modulus
    pub a: f64,              // Cross-sectional area
    pub weight_per_length: f64,  // Self-weight w (N/m)
    pub prestress: f64,      // Initial tension
    pub unstressed_length: f64,
    pub coord_i: [f64; 3],
    pub coord_j: [f64; 3],
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CableShape {
    pub points: Vec<[f64; 3]>,
    pub tensions: Vec<f64>,
    pub sag: f64,
    pub horizontal_tension: f64,
    pub cable_length: f64,
}

impl CatenaryElement {
    /// Catenary input precheck for cable geometry and properties.
    pub fn validate_inputs(&self) -> CatenaryValidationResult {
        let valid_e = self.e > 0.0;
        let valid_a = self.a > 0.0;
        let valid_length = self.unstressed_length > 0.0;
        let passed = valid_e && valid_a && valid_length;
        let invalid_count = [valid_e, valid_a, valid_length].iter().filter(|&&v| !v).count();
        CatenaryValidationResult {
            passed,
            utilization: invalid_count as f64 / 3.0,
            message: if passed {
                "Catenary inputs are valid".to_string()
            } else {
                "Catenary inputs invalid (E>0, A>0, unstressed_length>0 required)".to_string()
            },
            clause: "MIDAS Civil / CSiBridge catenary pre-analysis checks".to_string(),
        }
    }

    /// Calculate catenary shape
    pub fn catenary_shape(&self, num_points: usize) -> CableShape {
        if num_points < 2 {
            return CableShape {
                points: vec![self.coord_i],
                tensions: vec![self.prestress.max(0.0)],
                sag: 0.0,
                horizontal_tension: self.prestress.max(0.0),
                cable_length: 0.0,
            };
        }

        let dx = self.coord_j[0] - self.coord_i[0];
        let dy = self.coord_j[1] - self.coord_i[1];
        let dz = self.coord_j[2] - self.coord_i[2];
        
        let l_horizontal = (dx * dx + dz * dz).sqrt();
        let l_vertical = dy;
        let chord_length = (l_horizontal * l_horizontal + l_vertical * l_vertical).sqrt();
        
        // Solve for horizontal tension using catenary equations
        // This is a nonlinear equation: sinh(wL/2H) / (wL/2H) = L_cable / L_chord
        
        let w = self.weight_per_length;
        let h = self.find_horizontal_tension(chord_length, l_horizontal, l_vertical);
        
        // Calculate cable length
        let cable_length = if w.abs() > 1e-10 && h.abs() > 1e-10 {
            let param = w * l_horizontal / (2.0 * h);
            l_horizontal * (param.sinh() / param)
        } else {
            chord_length
        };
        
        // Compute sag
        let sag = if w.abs() > 1e-10 && h.abs() > 1e-10 {
            h / w * ((w * l_horizontal / (2.0 * h)).cosh() - 1.0)
        } else {
            0.0
        };
        
        // Generate shape points
        let mut points = Vec::with_capacity(num_points);
        let mut tensions = Vec::with_capacity(num_points);
        
        for i in 0..num_points {
            let t = i as f64 / (num_points - 1) as f64;
            let x = self.coord_i[0] + t * dx;
            let z = self.coord_i[2] + t * dz;
            
            // Y-coordinate from catenary equation
            let x_rel = t * l_horizontal - l_horizontal / 2.0;
            let y_sag = if w.abs() > 1e-10 && h.abs() > 1e-10 {
                h / w * ((w * x_rel / h).cosh() - (w * l_horizontal / (2.0 * h)).cosh())
            } else {
                0.0
            };
            
            let y = self.coord_i[1] + t * l_vertical + y_sag;
            points.push([x, y, z]);
            
            // Tension at this point
            let tension = if w.abs() > 1e-10 {
                h * (1.0 + (w * x_rel / h).sinh().powi(2)).sqrt()
            } else {
                h
            };
            tensions.push(tension);
        }
        
        CableShape {
            points,
            tensions,
            sag,
            horizontal_tension: h,
            cable_length,
        }
    }
    
    fn find_horizontal_tension(&self, chord: f64, l_h: f64, l_v: f64) -> f64 {
        let w = self.weight_per_length;
        
        if w.abs() < 1e-10 {
            // No weight - straight cable
            return self.prestress;
        }
        
        // Initial guess
        let mut h = if self.prestress > 1e-10 {
            self.prestress
        } else {
            w * chord.powi(2) / (8.0 * 0.02 * chord)  // Assume 2% sag
        };
        
        // Newton-Raphson to solve catenary equation
        for _ in 0..50 {
            let param = w * l_h / (2.0 * h);
            let sinh_val = param.sinh();
            let cosh_val = param.cosh();
            
            // Cable length function
            let l_cable = l_h * sinh_val / param;
            
            // Account for vertical difference
            let projected_sq = (self.unstressed_length.powi(2) - l_v.powi(2)).max(0.0);
            let target = projected_sq.sqrt().max(l_h);
            let f = l_cable - target;
            
            // Derivative
            let df = -l_h * w / (2.0 * h.powi(2)) * (cosh_val - sinh_val / param);
            
            if df.abs() < 1e-14 {
                break;
            }
            
            let dh = -f / df;
            h += dh;
            h = h.max(1e-10);
            
            if dh.abs() < 1e-8 * h {
                break;
            }
        }
        
        h
    }
    
    /// Ernst equivalent modulus (accounts for sag stiffening)
    pub fn ernst_modulus(&self, tension: f64) -> f64 {
        let e = self.e;
        let a = self.a;
        let w = self.weight_per_length;
        
        let dx = self.coord_j[0] - self.coord_i[0];
        let dz = self.coord_j[2] - self.coord_i[2];
        let l = (dx * dx + dz * dz).sqrt();
        
        if tension.abs() < 1e-10 || w.abs() < 1e-10 {
            return e;
        }
        
        // Ernst formula: E_eq = E / (1 + (wL)²EA / (12T³))
        let factor = (w * l).powi(2) * e * a / (12.0 * tension.powi(3));
        e / (1.0 + factor)
    }
    
    /// Tangent stiffness matrix (geometric + material)
    pub fn stiffness_matrix(&self) -> [[f64; 6]; 6] {
        let shape = self.catenary_shape(2);
        let t = shape.horizontal_tension;
        let e_ernst = self.ernst_modulus(t);
        
        let dx = self.coord_j[0] - self.coord_i[0];
        let dy = self.coord_j[1] - self.coord_i[1];
        let dz = self.coord_j[2] - self.coord_i[2];
        let l = (dx * dx + dy * dy + dz * dz).sqrt();
        
        if l < 1e-10 {
            return [[0.0; 6]; 6];
        }
        
        // Direction cosines
        let cx = dx / l;
        let cy = dy / l;
        let cz = dz / l;
        
        // Elastic stiffness coefficient
        if shape.cable_length.abs() <= f64::EPSILON {
            return [[0.0; 6]; 6];
        }
        let ke = e_ernst * self.a / shape.cable_length;
        
        // Geometric stiffness coefficient  
        let kg = t / shape.cable_length;
        
        let mut k = [[0.0; 6]; 6];
        
        // Build stiffness matrix
        let dirs = [(cx, 0), (cy, 1), (cz, 2)];
        
        for (i, &(ci, _)) in dirs.iter().enumerate() {
            for (j, &(cj, _)) in dirs.iter().enumerate() {
                // Elastic contribution (axial)
                let elastic = ke * ci * cj;
                // Geometric contribution (tension stiffening)
                let geometric = if i == j { kg } else { 0.0 };
                
                k[i][j] = elastic + geometric;
                k[i + 3][j + 3] = elastic + geometric;
                k[i][j + 3] = -elastic - geometric;
                k[i + 3][j] = -elastic - geometric;
            }
        }
        
        k
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sample_cable() -> CatenaryElement {
        CatenaryElement {
            id: 1,
            node_i: 1,
            node_j: 2,
            e: 200_000.0,
            a: 1200.0,
            weight_per_length: 1.0,
            prestress: 100.0,
            unstressed_length: 10.0,
            coord_i: [0.0, 0.0, 0.0],
            coord_j: [10.0, 0.0, 0.0],
        }
    }

    #[test]
    fn validate_inputs_accepts_positive_properties() {
        let c = sample_cable();
        let out = c.validate_inputs();
        assert!(out.passed);
        assert_eq!(out.utilization, 0.0);
    }

    #[test]
    fn catenary_shape_handles_single_point_request() {
        let c = sample_cable();
        let shape = c.catenary_shape(1);
        assert_eq!(shape.points.len(), 1);
        assert_eq!(shape.cable_length, 0.0);
    }
}

