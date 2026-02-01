//! VTK Export Module - 3D Visualization Export
//! 
//! Exports structural models and analysis results to VTK format
//! for visualization in ParaView, VisIt, or other VTK-compatible viewers

use serde::{Deserialize, Serialize};
use std::fmt::Write;

// ============================================================================
// VTK DATA STRUCTURES
// ============================================================================

/// VTK file format type
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum VtkFormat {
    Ascii,
    Binary,
}

/// VTK dataset type
#[derive(Debug, Clone, Copy)]
pub enum VtkDatasetType {
    UnstructuredGrid,
    PolyData,
    StructuredGrid,
}

/// VTK cell types for different element types
#[derive(Debug, Clone, Copy)]
pub enum VtkCellType {
    Vertex = 1,
    Line = 3,
    Triangle = 5,
    Quad = 9,
    Tetra = 10,
    Hexahedron = 12,
    Wedge = 13,
    Pyramid = 14,
    QuadraticEdge = 21,
    QuadraticTriangle = 22,
    QuadraticQuad = 23,
    QuadraticTetra = 24,
    QuadraticHexahedron = 25,
}

/// Node data for VTK export
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VtkNode {
    pub id: usize,
    pub x: f64,
    pub y: f64,
    pub z: f64,
}

/// Element data for VTK export
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VtkElement {
    pub id: usize,
    pub cell_type: u8,
    pub node_ids: Vec<usize>,
}

/// Point data (at nodes)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VtkPointData {
    pub name: String,
    pub num_components: usize,
    pub data: Vec<f64>,
}

/// Cell data (at elements)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VtkCellData {
    pub name: String,
    pub num_components: usize,
    pub data: Vec<f64>,
}

/// Complete VTK model
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VtkModel {
    pub title: String,
    pub nodes: Vec<VtkNode>,
    pub elements: Vec<VtkElement>,
    pub point_data: Vec<VtkPointData>,
    pub cell_data: Vec<VtkCellData>,
}

impl VtkModel {
    pub fn new(title: &str) -> Self {
        Self {
            title: title.to_string(),
            nodes: Vec::new(),
            elements: Vec::new(),
            point_data: Vec::new(),
            cell_data: Vec::new(),
        }
    }

    /// Add a node
    pub fn add_node(&mut self, id: usize, x: f64, y: f64, z: f64) {
        self.nodes.push(VtkNode { id, x, y, z });
    }

    /// Add a beam/line element
    pub fn add_beam(&mut self, id: usize, node_i: usize, node_j: usize) {
        self.elements.push(VtkElement {
            id,
            cell_type: VtkCellType::Line as u8,
            node_ids: vec![node_i, node_j],
        });
    }

    /// Add a triangular element
    pub fn add_triangle(&mut self, id: usize, n1: usize, n2: usize, n3: usize) {
        self.elements.push(VtkElement {
            id,
            cell_type: VtkCellType::Triangle as u8,
            node_ids: vec![n1, n2, n3],
        });
    }

    /// Add a quad element
    pub fn add_quad(&mut self, id: usize, n1: usize, n2: usize, n3: usize, n4: usize) {
        self.elements.push(VtkElement {
            id,
            cell_type: VtkCellType::Quad as u8,
            node_ids: vec![n1, n2, n3, n4],
        });
    }

    /// Add a tetrahedral element
    pub fn add_tetra(&mut self, id: usize, n1: usize, n2: usize, n3: usize, n4: usize) {
        self.elements.push(VtkElement {
            id,
            cell_type: VtkCellType::Tetra as u8,
            node_ids: vec![n1, n2, n3, n4],
        });
    }

    /// Add a hexahedral element
    pub fn add_hex(&mut self, id: usize, nodes: &[usize; 8]) {
        self.elements.push(VtkElement {
            id,
            cell_type: VtkCellType::Hexahedron as u8,
            node_ids: nodes.to_vec(),
        });
    }

    /// Add point scalar data (e.g., displacement magnitude)
    pub fn add_point_scalar(&mut self, name: &str, data: Vec<f64>) {
        self.point_data.push(VtkPointData {
            name: name.to_string(),
            num_components: 1,
            data,
        });
    }

    /// Add point vector data (e.g., displacement vector)
    pub fn add_point_vector(&mut self, name: &str, data: Vec<f64>) {
        self.point_data.push(VtkPointData {
            name: name.to_string(),
            num_components: 3,
            data,
        });
    }

    /// Add cell scalar data (e.g., stress)
    pub fn add_cell_scalar(&mut self, name: &str, data: Vec<f64>) {
        self.cell_data.push(VtkCellData {
            name: name.to_string(),
            num_components: 1,
            data,
        });
    }

    /// Add cell tensor data (e.g., stress tensor)
    pub fn add_cell_tensor(&mut self, name: &str, data: Vec<f64>) {
        self.cell_data.push(VtkCellData {
            name: name.to_string(),
            num_components: 6, // Symmetric tensor: xx, yy, zz, xy, yz, xz
            data,
        });
    }

    /// Export to VTK legacy format (ASCII)
    pub fn to_vtk_legacy(&self) -> String {
        let mut output = String::new();
        
        // Header
        writeln!(output, "# vtk DataFile Version 3.0").unwrap();
        writeln!(output, "{}", self.title).unwrap();
        writeln!(output, "ASCII").unwrap();
        writeln!(output, "DATASET UNSTRUCTURED_GRID").unwrap();
        
        // Points
        writeln!(output, "POINTS {} double", self.nodes.len()).unwrap();
        for node in &self.nodes {
            writeln!(output, "{:.6e} {:.6e} {:.6e}", node.x, node.y, node.z).unwrap();
        }
        
        // Cells
        let total_cell_size: usize = self.elements.iter()
            .map(|e| e.node_ids.len() + 1)
            .sum();
        
        writeln!(output, "CELLS {} {}", self.elements.len(), total_cell_size).unwrap();
        
        // Build node index map (id -> index)
        let node_index: std::collections::HashMap<usize, usize> = self.nodes
            .iter()
            .enumerate()
            .map(|(i, n)| (n.id, i))
            .collect();
        
        for element in &self.elements {
            let n = element.node_ids.len();
            write!(output, "{}", n).unwrap();
            for node_id in &element.node_ids {
                let idx = node_index.get(node_id).copied().unwrap_or(0);
                write!(output, " {}", idx).unwrap();
            }
            writeln!(output).unwrap();
        }
        
        // Cell types
        writeln!(output, "CELL_TYPES {}", self.elements.len()).unwrap();
        for element in &self.elements {
            writeln!(output, "{}", element.cell_type).unwrap();
        }
        
        // Point data
        if !self.point_data.is_empty() {
            writeln!(output, "POINT_DATA {}", self.nodes.len()).unwrap();
            
            for data in &self.point_data {
                if data.num_components == 1 {
                    writeln!(output, "SCALARS {} double 1", data.name).unwrap();
                    writeln!(output, "LOOKUP_TABLE default").unwrap();
                    for val in &data.data {
                        writeln!(output, "{:.6e}", val).unwrap();
                    }
                } else if data.num_components == 3 {
                    writeln!(output, "VECTORS {} double", data.name).unwrap();
                    for chunk in data.data.chunks(3) {
                        if chunk.len() == 3 {
                            writeln!(output, "{:.6e} {:.6e} {:.6e}", chunk[0], chunk[1], chunk[2]).unwrap();
                        }
                    }
                }
            }
        }
        
        // Cell data
        if !self.cell_data.is_empty() {
            writeln!(output, "CELL_DATA {}", self.elements.len()).unwrap();
            
            for data in &self.cell_data {
                if data.num_components == 1 {
                    writeln!(output, "SCALARS {} double 1", data.name).unwrap();
                    writeln!(output, "LOOKUP_TABLE default").unwrap();
                    for val in &data.data {
                        writeln!(output, "{:.6e}", val).unwrap();
                    }
                } else if data.num_components == 6 {
                    // Tensor as 6 separate scalars for VTK legacy
                    let tensor_names = ["_xx", "_yy", "_zz", "_xy", "_yz", "_xz"];
                    for (comp, suffix) in tensor_names.iter().enumerate() {
                        writeln!(output, "SCALARS {}{} double 1", data.name, suffix).unwrap();
                        writeln!(output, "LOOKUP_TABLE default").unwrap();
                        for chunk in data.data.chunks(6) {
                            if comp < chunk.len() {
                                writeln!(output, "{:.6e}", chunk[comp]).unwrap();
                            }
                        }
                    }
                }
            }
        }
        
        output
    }

    /// Export to VTK XML format (VTU)
    pub fn to_vtu(&self) -> String {
        let mut output = String::new();
        
        writeln!(output, r#"<?xml version="1.0"?>"#).unwrap();
        writeln!(output, r#"<VTKFile type="UnstructuredGrid" version="0.1" byte_order="LittleEndian">"#).unwrap();
        writeln!(output, "  <UnstructuredGrid>").unwrap();
        writeln!(output, r#"    <Piece NumberOfPoints="{}" NumberOfCells="{}">"#, 
            self.nodes.len(), self.elements.len()).unwrap();
        
        // Points
        writeln!(output, "      <Points>").unwrap();
        writeln!(output, r#"        <DataArray type="Float64" NumberOfComponents="3" format="ascii">"#).unwrap();
        for node in &self.nodes {
            write!(output, "          {:.6e} {:.6e} {:.6e}\n", node.x, node.y, node.z).unwrap();
        }
        writeln!(output, "        </DataArray>").unwrap();
        writeln!(output, "      </Points>").unwrap();
        
        // Cells
        let node_index: std::collections::HashMap<usize, usize> = self.nodes
            .iter()
            .enumerate()
            .map(|(i, n)| (n.id, i))
            .collect();
        
        writeln!(output, "      <Cells>").unwrap();
        
        // Connectivity
        writeln!(output, r#"        <DataArray type="Int32" Name="connectivity" format="ascii">"#).unwrap();
        for element in &self.elements {
            write!(output, "          ").unwrap();
            for node_id in &element.node_ids {
                let idx = node_index.get(node_id).copied().unwrap_or(0);
                write!(output, "{} ", idx).unwrap();
            }
            writeln!(output).unwrap();
        }
        writeln!(output, "        </DataArray>").unwrap();
        
        // Offsets
        writeln!(output, r#"        <DataArray type="Int32" Name="offsets" format="ascii">"#).unwrap();
        write!(output, "          ").unwrap();
        let mut offset = 0;
        for element in &self.elements {
            offset += element.node_ids.len();
            write!(output, "{} ", offset).unwrap();
        }
        writeln!(output).unwrap();
        writeln!(output, "        </DataArray>").unwrap();
        
        // Types
        writeln!(output, r#"        <DataArray type="UInt8" Name="types" format="ascii">"#).unwrap();
        write!(output, "          ").unwrap();
        for element in &self.elements {
            write!(output, "{} ", element.cell_type).unwrap();
        }
        writeln!(output).unwrap();
        writeln!(output, "        </DataArray>").unwrap();
        
        writeln!(output, "      </Cells>").unwrap();
        
        // Point data
        if !self.point_data.is_empty() {
            writeln!(output, "      <PointData>").unwrap();
            for data in &self.point_data {
                writeln!(output, r#"        <DataArray type="Float64" Name="{}" NumberOfComponents="{}" format="ascii">"#,
                    data.name, data.num_components).unwrap();
                write!(output, "          ").unwrap();
                for (i, val) in data.data.iter().enumerate() {
                    write!(output, "{:.6e} ", val).unwrap();
                    if (i + 1) % data.num_components == 0 && i < data.data.len() - 1 {
                        write!(output, "\n          ").unwrap();
                    }
                }
                writeln!(output).unwrap();
                writeln!(output, "        </DataArray>").unwrap();
            }
            writeln!(output, "      </PointData>").unwrap();
        }
        
        // Cell data
        if !self.cell_data.is_empty() {
            writeln!(output, "      <CellData>").unwrap();
            for data in &self.cell_data {
                writeln!(output, r#"        <DataArray type="Float64" Name="{}" NumberOfComponents="{}" format="ascii">"#,
                    data.name, data.num_components).unwrap();
                write!(output, "          ").unwrap();
                for (i, val) in data.data.iter().enumerate() {
                    write!(output, "{:.6e} ", val).unwrap();
                    if (i + 1) % data.num_components == 0 && i < data.data.len() - 1 {
                        write!(output, "\n          ").unwrap();
                    }
                }
                writeln!(output).unwrap();
                writeln!(output, "        </DataArray>").unwrap();
            }
            writeln!(output, "      </CellData>").unwrap();
        }
        
        writeln!(output, "    </Piece>").unwrap();
        writeln!(output, "  </UnstructuredGrid>").unwrap();
        writeln!(output, "</VTKFile>").unwrap();
        
        output
    }
}

// ============================================================================
// DEFORMED SHAPE EXPORT
// ============================================================================

/// Export deformed shape with magnification
pub struct DeformedShapeExporter {
    pub magnification: f64,
    pub show_undeformed: bool,
}

impl Default for DeformedShapeExporter {
    fn default() -> Self {
        Self {
            magnification: 100.0,
            show_undeformed: true,
        }
    }
}

impl DeformedShapeExporter {
    pub fn new(magnification: f64) -> Self {
        Self {
            magnification,
            show_undeformed: true,
        }
    }

    /// Create VTK model from nodes, elements, and displacements
    pub fn export(
        &self,
        title: &str,
        nodes: &[(usize, f64, f64, f64)], // (id, x, y, z)
        elements: &[(usize, Vec<usize>, u8)], // (id, node_ids, vtk_type)
        displacements: &[(usize, f64, f64, f64)], // (node_id, dx, dy, dz)
    ) -> VtkModel {
        let mut model = VtkModel::new(title);
        
        // Build displacement map
        let disp_map: std::collections::HashMap<usize, (f64, f64, f64)> = displacements
            .iter()
            .map(|(id, dx, dy, dz)| (*id, (*dx, *dy, *dz)))
            .collect();
        
        // Add deformed nodes
        for (id, x, y, z) in nodes {
            let (dx, dy, dz) = disp_map.get(id).copied().unwrap_or((0.0, 0.0, 0.0));
            model.add_node(
                *id,
                x + dx * self.magnification,
                y + dy * self.magnification,
                z + dz * self.magnification,
            );
        }
        
        // Add elements
        for (id, node_ids, vtk_type) in elements {
            model.elements.push(VtkElement {
                id: *id,
                cell_type: *vtk_type,
                node_ids: node_ids.clone(),
            });
        }
        
        // Add displacement magnitude as scalar
        let mut disp_mag: Vec<f64> = Vec::with_capacity(nodes.len());
        for (id, _, _, _) in nodes {
            let (dx, dy, dz) = disp_map.get(id).copied().unwrap_or((0.0, 0.0, 0.0));
            disp_mag.push((dx * dx + dy * dy + dz * dz).sqrt());
        }
        model.add_point_scalar("Displacement_Magnitude", disp_mag);
        
        // Add displacement vector
        let mut disp_vec: Vec<f64> = Vec::with_capacity(nodes.len() * 3);
        for (id, _, _, _) in nodes {
            let (dx, dy, dz) = disp_map.get(id).copied().unwrap_or((0.0, 0.0, 0.0));
            disp_vec.push(dx);
            disp_vec.push(dy);
            disp_vec.push(dz);
        }
        model.add_point_vector("Displacement", disp_vec);
        
        model
    }
}

// ============================================================================
// STRESS CONTOUR EXPORT
// ============================================================================

/// Export stress contours on elements
pub struct StressContourExporter;

impl StressContourExporter {
    /// Create VTK model with stress data
    pub fn export(
        title: &str,
        nodes: &[(usize, f64, f64, f64)],
        elements: &[(usize, Vec<usize>, u8)],
        von_mises_stress: &[(usize, f64)], // (element_id, stress)
        stress_tensor: Option<&[(usize, [f64; 6])]>, // (element_id, [σxx, σyy, σzz, τxy, τyz, τxz])
    ) -> VtkModel {
        let mut model = VtkModel::new(title);
        
        // Add nodes
        for (id, x, y, z) in nodes {
            model.add_node(*id, *x, *y, *z);
        }
        
        // Add elements
        for (id, node_ids, vtk_type) in elements {
            model.elements.push(VtkElement {
                id: *id,
                cell_type: *vtk_type,
                node_ids: node_ids.clone(),
            });
        }
        
        // Build stress map
        let stress_map: std::collections::HashMap<usize, f64> = von_mises_stress
            .iter()
            .map(|(id, s)| (*id, *s))
            .collect();
        
        // Add von Mises stress as cell data
        let mut vm_stress: Vec<f64> = Vec::with_capacity(elements.len());
        for (id, _, _) in elements {
            vm_stress.push(stress_map.get(id).copied().unwrap_or(0.0));
        }
        model.add_cell_scalar("VonMises_Stress", vm_stress);
        
        // Add stress tensor if provided
        if let Some(tensors) = stress_tensor {
            let tensor_map: std::collections::HashMap<usize, [f64; 6]> = tensors
                .iter()
                .map(|(id, t)| (*id, *t))
                .collect();
            
            let mut tensor_data: Vec<f64> = Vec::with_capacity(elements.len() * 6);
            for (id, _, _) in elements {
                let t = tensor_map.get(id).copied().unwrap_or([0.0; 6]);
                tensor_data.extend_from_slice(&t);
            }
            model.add_cell_tensor("Stress_Tensor", tensor_data);
        }
        
        model
    }
}

// ============================================================================
// MODE SHAPE EXPORT
// ============================================================================

/// Export modal analysis results
pub struct ModeShapeExporter {
    pub magnification: f64,
}

impl Default for ModeShapeExporter {
    fn default() -> Self {
        Self { magnification: 1.0 }
    }
}

impl ModeShapeExporter {
    pub fn new(magnification: f64) -> Self {
        Self { magnification }
    }

    /// Export a single mode shape
    pub fn export_mode(
        &self,
        title: &str,
        mode_number: usize,
        frequency: f64,
        nodes: &[(usize, f64, f64, f64)],
        elements: &[(usize, Vec<usize>, u8)],
        mode_shape: &[(usize, f64, f64, f64)], // (node_id, φx, φy, φz)
    ) -> VtkModel {
        let title_with_mode = format!("{} - Mode {} (f = {:.3} Hz)", title, mode_number, frequency);
        let mut model = VtkModel::new(&title_with_mode);
        
        // Build mode shape map
        let mode_map: std::collections::HashMap<usize, (f64, f64, f64)> = mode_shape
            .iter()
            .map(|(id, x, y, z)| (*id, (*x, *y, *z)))
            .collect();
        
        // Normalize mode shape
        let max_disp = mode_shape.iter()
            .map(|(_, x, y, z)| (x * x + y * y + z * z).sqrt())
            .fold(0.0f64, f64::max);
        
        let scale = if max_disp > 1e-10 { 
            self.magnification / max_disp 
        } else { 
            self.magnification 
        };
        
        // Add deformed nodes
        for (id, x, y, z) in nodes {
            let (dx, dy, dz) = mode_map.get(id).copied().unwrap_or((0.0, 0.0, 0.0));
            model.add_node(
                *id,
                x + dx * scale,
                y + dy * scale,
                z + dz * scale,
            );
        }
        
        // Add elements
        for (id, node_ids, vtk_type) in elements {
            model.elements.push(VtkElement {
                id: *id,
                cell_type: *vtk_type,
                node_ids: node_ids.clone(),
            });
        }
        
        // Add mode shape magnitude as scalar
        let mut mode_mag: Vec<f64> = Vec::with_capacity(nodes.len());
        for (id, _, _, _) in nodes {
            let (dx, dy, dz) = mode_map.get(id).copied().unwrap_or((0.0, 0.0, 0.0));
            mode_mag.push((dx * dx + dy * dy + dz * dz).sqrt());
        }
        model.add_point_scalar("Mode_Shape_Magnitude", mode_mag);
        
        model
    }

    /// Export all modes as separate VTK files (returns vector of VTK strings)
    pub fn export_all_modes(
        &self,
        title: &str,
        nodes: &[(usize, f64, f64, f64)],
        elements: &[(usize, Vec<usize>, u8)],
        modes: &[(usize, f64, Vec<(usize, f64, f64, f64)>)], // (mode_number, frequency, mode_shape)
    ) -> Vec<(String, String)> { // (filename, vtk_content)
        let mut results = Vec::new();
        
        for (mode_num, freq, shape) in modes {
            let model = self.export_mode(title, *mode_num, *freq, nodes, elements, shape);
            let filename = format!("mode_{:03}.vtu", mode_num);
            results.push((filename, model.to_vtu()));
        }
        
        results
    }
}

// ============================================================================
// TIME HISTORY ANIMATION EXPORT
// ============================================================================

/// Export time history results as VTK series for animation
pub struct TimeHistoryExporter {
    pub magnification: f64,
}

impl Default for TimeHistoryExporter {
    fn default() -> Self {
        Self { magnification: 100.0 }
    }
}

impl TimeHistoryExporter {
    pub fn new(magnification: f64) -> Self {
        Self { magnification }
    }

    /// Export time series as PVD collection file
    pub fn export_pvd(
        &self,
        title: &str,
        times: &[f64],
    ) -> String {
        let mut output = String::new();
        
        writeln!(output, r#"<?xml version="1.0"?>"#).unwrap();
        writeln!(output, r#"<VTKFile type="Collection" version="0.1">"#).unwrap();
        writeln!(output, "  <Collection>").unwrap();
        
        for (i, time) in times.iter().enumerate() {
            writeln!(output, r#"    <DataSet timestep="{:.6}" file="{}_frame_{:06}.vtu"/>"#,
                time, title.replace(' ', "_"), i).unwrap();
        }
        
        writeln!(output, "  </Collection>").unwrap();
        writeln!(output, "</VTKFile>").unwrap();
        
        output
    }

    /// Export a single time step
    pub fn export_frame(
        &self,
        title: &str,
        time: f64,
        nodes: &[(usize, f64, f64, f64)],
        elements: &[(usize, Vec<usize>, u8)],
        displacements: &[(usize, f64, f64, f64)],
        velocities: Option<&[(usize, f64, f64, f64)]>,
        accelerations: Option<&[(usize, f64, f64, f64)]>,
    ) -> VtkModel {
        let title_with_time = format!("{} - t = {:.4} s", title, time);
        let mut model = VtkModel::new(&title_with_time);
        
        // Build displacement map
        let disp_map: std::collections::HashMap<usize, (f64, f64, f64)> = displacements
            .iter()
            .map(|(id, x, y, z)| (*id, (*x, *y, *z)))
            .collect();
        
        // Add deformed nodes
        for (id, x, y, z) in nodes {
            let (dx, dy, dz) = disp_map.get(id).copied().unwrap_or((0.0, 0.0, 0.0));
            model.add_node(
                *id,
                x + dx * self.magnification,
                y + dy * self.magnification,
                z + dz * self.magnification,
            );
        }
        
        // Add elements
        for (id, node_ids, vtk_type) in elements {
            model.elements.push(VtkElement {
                id: *id,
                cell_type: *vtk_type,
                node_ids: node_ids.clone(),
            });
        }
        
        // Add displacement magnitude
        let mut disp_mag: Vec<f64> = Vec::with_capacity(nodes.len());
        for (id, _, _, _) in nodes {
            let (dx, dy, dz) = disp_map.get(id).copied().unwrap_or((0.0, 0.0, 0.0));
            disp_mag.push((dx * dx + dy * dy + dz * dz).sqrt());
        }
        model.add_point_scalar("Displacement_Magnitude", disp_mag);
        
        // Add velocity if provided
        if let Some(vels) = velocities {
            let vel_map: std::collections::HashMap<usize, (f64, f64, f64)> = vels
                .iter()
                .map(|(id, x, y, z)| (*id, (*x, *y, *z)))
                .collect();
            
            let mut vel_mag: Vec<f64> = Vec::with_capacity(nodes.len());
            for (id, _, _, _) in nodes {
                let (vx, vy, vz) = vel_map.get(id).copied().unwrap_or((0.0, 0.0, 0.0));
                vel_mag.push((vx * vx + vy * vy + vz * vz).sqrt());
            }
            model.add_point_scalar("Velocity_Magnitude", vel_mag);
        }
        
        // Add acceleration if provided
        if let Some(accels) = accelerations {
            let accel_map: std::collections::HashMap<usize, (f64, f64, f64)> = accels
                .iter()
                .map(|(id, x, y, z)| (*id, (*x, *y, *z)))
                .collect();
            
            let mut accel_mag: Vec<f64> = Vec::with_capacity(nodes.len());
            for (id, _, _, _) in nodes {
                let (ax, ay, az) = accel_map.get(id).copied().unwrap_or((0.0, 0.0, 0.0));
                accel_mag.push((ax * ax + ay * ay + az * az).sqrt());
            }
            model.add_point_scalar("Acceleration_Magnitude", accel_mag);
        }
        
        model
    }
}

// ============================================================================
// BEAM DIAGRAM VTK EXPORT
// ============================================================================

/// Export beam diagrams (BMD, SFD) as VTK
pub struct BeamDiagramExporter {
    pub scale_factor: f64,
    pub num_points: usize,
}

impl Default for BeamDiagramExporter {
    fn default() -> Self {
        Self {
            scale_factor: 0.1,
            num_points: 21,
        }
    }
}

impl BeamDiagramExporter {
    /// Export bending moment diagram
    pub fn export_bmd(
        &self,
        beam_id: usize,
        start_node: (f64, f64, f64),
        end_node: (f64, f64, f64),
        moments: &[f64], // Moment values along beam length
    ) -> VtkModel {
        let mut model = VtkModel::new(&format!("BMD_Beam_{}", beam_id));
        
        let (x1, y1, z1) = start_node;
        let (x2, y2, z2) = end_node;
        let length = ((x2 - x1).powi(2) + (y2 - y1).powi(2) + (z2 - z1).powi(2)).sqrt();
        
        // Direction vectors
        let dx = (x2 - x1) / length;
        let dy = (y2 - y1) / length;
        let dz = (z2 - z1) / length;
        
        // Perpendicular direction for diagram (simplified: use global Y if beam is not vertical)
        let (px, py, pz) = if dy.abs() > 0.99 {
            (1.0, 0.0, 0.0) // Beam is vertical, use X for diagram
        } else {
            (0.0, 1.0, 0.0) // Use Y for diagram
        };
        
        // Create points for BMD polygon
        let n = moments.len();
        
        // Bottom edge (beam axis)
        for i in 0..n {
            let t = i as f64 / (n - 1) as f64;
            let x = x1 + dx * length * t;
            let y = y1 + dy * length * t;
            let z = z1 + dz * length * t;
            model.add_node(i + 1, x, y, z);
        }
        
        // Top edge (BMD outline)
        for i in 0..n {
            let t = i as f64 / (n - 1) as f64;
            let x = x1 + dx * length * t + px * moments[i] * self.scale_factor;
            let y = y1 + dy * length * t + py * moments[i] * self.scale_factor;
            let z = z1 + dz * length * t + pz * moments[i] * self.scale_factor;
            model.add_node(n + i + 1, x, y, z);
        }
        
        // Create quad elements for filled diagram
        for i in 0..(n - 1) {
            model.add_quad(
                i + 1,
                i + 1,           // Bottom left
                i + 2,           // Bottom right
                n + i + 2,       // Top right
                n + i + 1,       // Top left
            );
        }
        
        // Add moment values as cell data
        let mut moment_data: Vec<f64> = Vec::new();
        for i in 0..(n - 1) {
            moment_data.push((moments[i] + moments[i + 1]) / 2.0);
        }
        model.add_cell_scalar("Bending_Moment", moment_data);
        
        model
    }
}

// ============================================================================
// TESTS
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_vtk_model_basic() {
        let mut model = VtkModel::new("Test Model");
        
        model.add_node(1, 0.0, 0.0, 0.0);
        model.add_node(2, 1.0, 0.0, 0.0);
        model.add_node(3, 1.0, 1.0, 0.0);
        model.add_node(4, 0.0, 1.0, 0.0);
        
        model.add_quad(1, 1, 2, 3, 4);
        
        assert_eq!(model.nodes.len(), 4);
        assert_eq!(model.elements.len(), 1);
    }

    #[test]
    fn test_vtk_legacy_export() {
        let mut model = VtkModel::new("Test");
        
        model.add_node(1, 0.0, 0.0, 0.0);
        model.add_node(2, 1.0, 0.0, 0.0);
        model.add_beam(1, 1, 2);
        
        let vtk = model.to_vtk_legacy();
        
        assert!(vtk.contains("POINTS 2"));
        assert!(vtk.contains("CELLS 1"));
        assert!(vtk.contains("CELL_TYPES 1"));
    }

    #[test]
    fn test_vtu_export() {
        let mut model = VtkModel::new("Test");
        
        model.add_node(1, 0.0, 0.0, 0.0);
        model.add_node(2, 1.0, 0.0, 0.0);
        model.add_node(3, 0.5, 1.0, 0.0);
        model.add_triangle(1, 1, 2, 3);
        
        let vtu = model.to_vtu();
        
        assert!(vtu.contains("VTKFile"));
        assert!(vtu.contains("UnstructuredGrid"));
        assert!(vtu.contains("NumberOfPoints=\"3\""));
        assert!(vtu.contains("NumberOfCells=\"1\""));
    }

    #[test]
    fn test_point_data() {
        let mut model = VtkModel::new("Test");
        
        model.add_node(1, 0.0, 0.0, 0.0);
        model.add_node(2, 1.0, 0.0, 0.0);
        model.add_beam(1, 1, 2);
        
        model.add_point_scalar("Displacement", vec![0.0, 0.001]);
        model.add_point_vector("Velocity", vec![0.0, 0.0, 0.0, 0.1, 0.0, 0.0]);
        
        let vtk = model.to_vtk_legacy();
        
        assert!(vtk.contains("POINT_DATA 2"));
        assert!(vtk.contains("SCALARS Displacement"));
        assert!(vtk.contains("VECTORS Velocity"));
    }

    #[test]
    fn test_cell_data() {
        let mut model = VtkModel::new("Test");
        
        model.add_node(1, 0.0, 0.0, 0.0);
        model.add_node(2, 1.0, 0.0, 0.0);
        model.add_beam(1, 1, 2);
        
        model.add_cell_scalar("Stress", vec![100e6]);
        
        let vtk = model.to_vtk_legacy();
        
        assert!(vtk.contains("CELL_DATA 1"));
        assert!(vtk.contains("SCALARS Stress"));
    }

    #[test]
    fn test_deformed_shape_export() {
        let exporter = DeformedShapeExporter::new(100.0);
        
        let nodes = vec![
            (1, 0.0, 0.0, 0.0),
            (2, 5.0, 0.0, 0.0),
            (3, 10.0, 0.0, 0.0),
        ];
        
        let elements = vec![
            (1, vec![1, 2], VtkCellType::Line as u8),
            (2, vec![2, 3], VtkCellType::Line as u8),
        ];
        
        let displacements = vec![
            (1, 0.0, 0.0, 0.0),
            (2, 0.0, -0.01, 0.0),
            (3, 0.0, 0.0, 0.0),
        ];
        
        let model = exporter.export("Deformed Shape", &nodes, &elements, &displacements);
        
        // Node 2 should be displaced down by 100 * 0.01 = 1.0
        let node2 = model.nodes.iter().find(|n| n.id == 2).unwrap();
        assert!((node2.y - (-1.0)).abs() < 1e-6);
    }

    #[test]
    fn test_stress_contour_export() {
        let nodes = vec![
            (1, 0.0, 0.0, 0.0),
            (2, 1.0, 0.0, 0.0),
            (3, 1.0, 1.0, 0.0),
            (4, 0.0, 1.0, 0.0),
        ];
        
        let elements = vec![
            (1, vec![1, 2, 3, 4], VtkCellType::Quad as u8),
        ];
        
        let stresses = vec![(1, 150e6)];
        
        let model = StressContourExporter::export(
            "Stress Contour",
            &nodes,
            &elements,
            &stresses,
            None,
        );
        
        assert_eq!(model.cell_data.len(), 1);
        assert_eq!(model.cell_data[0].name, "VonMises_Stress");
    }

    #[test]
    fn test_mode_shape_export() {
        let exporter = ModeShapeExporter::new(1.0);
        
        let nodes = vec![
            (1, 0.0, 0.0, 0.0),
            (2, 0.0, 3.0, 0.0),
            (3, 0.0, 6.0, 0.0),
        ];
        
        let elements = vec![
            (1, vec![1, 2], VtkCellType::Line as u8),
            (2, vec![2, 3], VtkCellType::Line as u8),
        ];
        
        let mode_shape = vec![
            (1, 0.0, 0.0, 0.0),
            (2, 0.5, 0.0, 0.0),
            (3, 1.0, 0.0, 0.0),
        ];
        
        let model = exporter.export_mode(
            "Modal Analysis",
            1,
            2.5,
            &nodes,
            &elements,
            &mode_shape,
        );
        
        assert!(model.title.contains("Mode 1"));
        assert!(model.title.contains("2.5"));
    }

    #[test]
    fn test_time_history_pvd() {
        let exporter = TimeHistoryExporter::new(100.0);
        
        let times = vec![0.0, 0.01, 0.02, 0.03, 0.04];
        let pvd = exporter.export_pvd("Earthquake_Response", &times);
        
        assert!(pvd.contains("Collection"));
        assert!(pvd.contains("timestep=\"0.000000\""));
        assert!(pvd.contains("frame_000000.vtu"));
    }

    #[test]
    fn test_beam_diagram_export() {
        let exporter = BeamDiagramExporter {
            scale_factor: 0.001,
            num_points: 5,
        };
        
        let moments = vec![0.0, 50.0, 100.0, 50.0, 0.0];
        
        let model = exporter.export_bmd(
            1,
            (0.0, 0.0, 0.0),
            (10.0, 0.0, 0.0),
            &moments,
        );
        
        // Should have 10 nodes (5 on beam axis + 5 on BMD outline)
        assert_eq!(model.nodes.len(), 10);
        // Should have 4 quad elements
        assert_eq!(model.elements.len(), 4);
    }

    #[test]
    fn test_hex_element() {
        let mut model = VtkModel::new("Solid Test");
        
        // Create a simple cube
        model.add_node(1, 0.0, 0.0, 0.0);
        model.add_node(2, 1.0, 0.0, 0.0);
        model.add_node(3, 1.0, 1.0, 0.0);
        model.add_node(4, 0.0, 1.0, 0.0);
        model.add_node(5, 0.0, 0.0, 1.0);
        model.add_node(6, 1.0, 0.0, 1.0);
        model.add_node(7, 1.0, 1.0, 1.0);
        model.add_node(8, 0.0, 1.0, 1.0);
        
        model.add_hex(1, &[1, 2, 3, 4, 5, 6, 7, 8]);
        
        assert_eq!(model.elements[0].cell_type, VtkCellType::Hexahedron as u8);
        assert_eq!(model.elements[0].node_ids.len(), 8);
    }
}
