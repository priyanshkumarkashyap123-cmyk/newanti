//! # Lightweight Data Formats
//!
//! Ultra-compact data serialization for minimal memory and bandwidth usage.
//! Optimized for civil engineering structures with predictable data patterns.

use serde::{Deserialize, Serialize};
use wasm_bindgen::prelude::*;
use std::io::{Read, Write};

// ============================================================================
// COMPACT BINARY FORMAT
// ============================================================================

/// Header for compact binary format
#[repr(C, packed)]
#[derive(Clone, Copy, Debug)]
pub struct CompactHeader {
    pub magic: [u8; 4],      // "CENG"
    pub version: u8,         // Format version
    pub flags: u8,           // Compression flags
    pub reserved: u16,       // Alignment padding
    pub node_count: u32,
    pub member_count: u32,
    pub load_count: u32,
}

impl CompactHeader {
    pub const MAGIC: [u8; 4] = [b'C', b'E', b'N', b'G'];
    pub const VERSION: u8 = 1;

    pub fn new(nodes: u32, members: u32, loads: u32) -> Self {
        Self {
            magic: Self::MAGIC,
            version: Self::VERSION,
            flags: 0,
            reserved: 0,
            node_count: nodes,
            member_count: members,
            load_count: loads,
        }
    }

    pub fn to_bytes(&self) -> Vec<u8> {
        let mut bytes = Vec::with_capacity(20);
        bytes.extend_from_slice(&self.magic);
        bytes.push(self.version);
        bytes.push(self.flags);
        bytes.extend_from_slice(&self.reserved.to_le_bytes());
        bytes.extend_from_slice(&self.node_count.to_le_bytes());
        bytes.extend_from_slice(&self.member_count.to_le_bytes());
        bytes.extend_from_slice(&self.load_count.to_le_bytes());
        bytes
    }

    pub fn from_bytes(bytes: &[u8]) -> Option<Self> {
        if bytes.len() < 20 {
            return None;
        }
        let magic = [bytes[0], bytes[1], bytes[2], bytes[3]];
        if magic != Self::MAGIC {
            return None;
        }
        Some(Self {
            magic,
            version: bytes[4],
            flags: bytes[5],
            reserved: u16::from_le_bytes([bytes[6], bytes[7]]),
            node_count: u32::from_le_bytes([bytes[8], bytes[9], bytes[10], bytes[11]]),
            member_count: u32::from_le_bytes([bytes[12], bytes[13], bytes[14], bytes[15]]),
            load_count: u32::from_le_bytes([bytes[16], bytes[17], bytes[18], bytes[19]]),
        })
    }
}

// ============================================================================
// QUANTIZED NODE FORMAT (12 bytes vs 24 bytes for full floats)
// ============================================================================

/// Compact node with 16-bit quantized coordinates
#[repr(C, packed)]
#[derive(Clone, Copy, Debug)]
pub struct CompactNode {
    pub x: i16,  // Quantized X (millimeters, ±32m range)
    pub y: i16,  // Quantized Y
    pub z: i16,  // Quantized Z
    pub id: u16, // Node ID (max 65535 nodes)
}

impl CompactNode {
    /// Scale factor: 1 unit = 1mm, range ±32.767m
    pub const SCALE: f32 = 1000.0;

    pub fn from_float(x: f32, y: f32, z: f32, id: u16) -> Self {
        Self {
            x: (x * Self::SCALE).clamp(-32767.0, 32767.0) as i16,
            y: (y * Self::SCALE).clamp(-32767.0, 32767.0) as i16,
            z: (z * Self::SCALE).clamp(-32767.0, 32767.0) as i16,
            id,
        }
    }

    pub fn to_float(&self) -> (f32, f32, f32) {
        (
            self.x as f32 / Self::SCALE,
            self.y as f32 / Self::SCALE,
            self.z as f32 / Self::SCALE,
        )
    }

    pub fn to_bytes(&self) -> [u8; 8] {
        let mut bytes = [0u8; 8];
        bytes[0..2].copy_from_slice(&self.x.to_le_bytes());
        bytes[2..4].copy_from_slice(&self.y.to_le_bytes());
        bytes[4..6].copy_from_slice(&self.z.to_le_bytes());
        bytes[6..8].copy_from_slice(&self.id.to_le_bytes());
        bytes
    }

    pub fn from_bytes(bytes: &[u8; 8]) -> Self {
        Self {
            x: i16::from_le_bytes([bytes[0], bytes[1]]),
            y: i16::from_le_bytes([bytes[2], bytes[3]]),
            z: i16::from_le_bytes([bytes[4], bytes[5]]),
            id: u16::from_le_bytes([bytes[6], bytes[7]]),
        }
    }
}

// ============================================================================
// COMPACT MEMBER FORMAT (16 bytes vs 40+ bytes)
// ============================================================================

/// Compact member with indexed properties
#[repr(C, packed)]
#[derive(Clone, Copy, Debug)]
pub struct CompactMember {
    pub start_node: u16,
    pub end_node: u16,
    pub section_id: u8,    // Index into section table (max 256 sections)
    pub material_id: u8,   // Index into material table (max 256 materials)
    pub flags: u8,         // Member type, releases, etc.
    pub reserved: u8,
}

impl CompactMember {
    pub const FLAG_TRUSS: u8 = 0x01;      // Axial only (pinned ends)
    pub const FLAG_RELEASE_START: u8 = 0x02;
    pub const FLAG_RELEASE_END: u8 = 0x04;

    pub fn new(start: u16, end: u16, section: u8, material: u8) -> Self {
        Self {
            start_node: start,
            end_node: end,
            section_id: section,
            material_id: material,
            flags: 0,
            reserved: 0,
        }
    }

    pub fn is_truss(&self) -> bool {
        self.flags & Self::FLAG_TRUSS != 0
    }

    pub fn set_truss(&mut self, is_truss: bool) {
        if is_truss {
            self.flags |= Self::FLAG_TRUSS;
        } else {
            self.flags &= !Self::FLAG_TRUSS;
        }
    }

    pub fn to_bytes(&self) -> [u8; 8] {
        let mut bytes = [0u8; 8];
        bytes[0..2].copy_from_slice(&self.start_node.to_le_bytes());
        bytes[2..4].copy_from_slice(&self.end_node.to_le_bytes());
        bytes[4] = self.section_id;
        bytes[5] = self.material_id;
        bytes[6] = self.flags;
        bytes[7] = self.reserved;
        bytes
    }

    pub fn from_bytes(bytes: &[u8; 8]) -> Self {
        Self {
            start_node: u16::from_le_bytes([bytes[0], bytes[1]]),
            end_node: u16::from_le_bytes([bytes[2], bytes[3]]),
            section_id: bytes[4],
            material_id: bytes[5],
            flags: bytes[6],
            reserved: bytes[7],
        }
    }
}

// ============================================================================
// COMPACT LOAD FORMAT (12 bytes)
// ============================================================================

/// Compact load with half-precision forces
#[repr(C, packed)]
#[derive(Clone, Copy, Debug)]
pub struct CompactLoad {
    pub node_id: u16,
    pub load_type: u8,    // Point, moment, etc.
    pub direction: u8,    // X, Y, Z, or combination
    pub magnitude: f32,   // Force/moment magnitude
    pub position: u16,    // For distributed loads: position along member (0-65535 = 0-100%)
    pub reserved: u16,
}

impl CompactLoad {
    pub const TYPE_POINT_FORCE: u8 = 0;
    pub const TYPE_MOMENT: u8 = 1;
    pub const TYPE_DISTRIBUTED: u8 = 2;

    pub const DIR_X: u8 = 0x01;
    pub const DIR_Y: u8 = 0x02;
    pub const DIR_Z: u8 = 0x04;
    pub const DIR_GLOBAL: u8 = 0x10;

    pub fn point_force(node: u16, direction: u8, magnitude: f32) -> Self {
        Self {
            node_id: node,
            load_type: Self::TYPE_POINT_FORCE,
            direction,
            magnitude,
            position: 0,
            reserved: 0,
        }
    }

    pub fn to_bytes(&self) -> [u8; 12] {
        let mut bytes = [0u8; 12];
        bytes[0..2].copy_from_slice(&self.node_id.to_le_bytes());
        bytes[2] = self.load_type;
        bytes[3] = self.direction;
        bytes[4..8].copy_from_slice(&self.magnitude.to_le_bytes());
        bytes[8..10].copy_from_slice(&self.position.to_le_bytes());
        bytes[10..12].copy_from_slice(&self.reserved.to_le_bytes());
        bytes
    }

    pub fn from_bytes(bytes: &[u8; 12]) -> Self {
        Self {
            node_id: u16::from_le_bytes([bytes[0], bytes[1]]),
            load_type: bytes[2],
            direction: bytes[3],
            magnitude: f32::from_le_bytes([bytes[4], bytes[5], bytes[6], bytes[7]]),
            position: u16::from_le_bytes([bytes[8], bytes[9]]),
            reserved: u16::from_le_bytes([bytes[10], bytes[11]]),
        }
    }
}

// ============================================================================
// SECTION PROPERTIES TABLE
// ============================================================================

/// Compact section properties (indexed by members)
#[repr(C, packed)]
#[derive(Clone, Copy, Debug)]
pub struct CompactSection {
    pub area: f32,          // Cross-sectional area (m²)
    pub inertia_y: f32,     // Moment of inertia about Y (m⁴)
    pub inertia_z: f32,     // Moment of inertia about Z (m⁴)
    pub section_type: u8,   // IPE, HEA, circular, etc.
    pub reserved: [u8; 3],
}

impl CompactSection {
    pub const TYPE_RECT: u8 = 0;
    pub const TYPE_CIRCULAR: u8 = 1;
    pub const TYPE_I_BEAM: u8 = 2;
    pub const TYPE_CHANNEL: u8 = 3;
    pub const TYPE_ANGLE: u8 = 4;
    pub const TYPE_TUBE: u8 = 5;

    pub fn rectangular(width: f32, height: f32) -> Self {
        Self {
            area: width * height,
            inertia_y: width * height.powi(3) / 12.0,
            inertia_z: height * width.powi(3) / 12.0,
            section_type: Self::TYPE_RECT,
            reserved: [0; 3],
        }
    }

    pub fn circular(diameter: f32) -> Self {
        let r = diameter / 2.0;
        let area = std::f32::consts::PI * r * r;
        let inertia = std::f32::consts::PI * r.powi(4) / 4.0;
        Self {
            area,
            inertia_y: inertia,
            inertia_z: inertia,
            section_type: Self::TYPE_CIRCULAR,
            reserved: [0; 3],
        }
    }

    pub fn to_bytes(&self) -> [u8; 16] {
        let mut bytes = [0u8; 16];
        bytes[0..4].copy_from_slice(&self.area.to_le_bytes());
        bytes[4..8].copy_from_slice(&self.inertia_y.to_le_bytes());
        bytes[8..12].copy_from_slice(&self.inertia_z.to_le_bytes());
        bytes[12] = self.section_type;
        bytes[13..16].copy_from_slice(&self.reserved);
        bytes
    }
}

// ============================================================================
// MATERIAL PROPERTIES TABLE
// ============================================================================

/// Compact material properties (indexed by members)
#[repr(C, packed)]
#[derive(Clone, Copy, Debug)]
pub struct CompactMaterial {
    pub youngs_modulus: f32,  // E (Pa)
    pub yield_strength: f32,  // σ_y (Pa)
    pub density: f32,         // ρ (kg/m³)
    pub material_type: u8,    // Steel, concrete, etc.
    pub reserved: [u8; 3],
}

impl CompactMaterial {
    pub const TYPE_STEEL: u8 = 0;
    pub const TYPE_CONCRETE: u8 = 1;
    pub const TYPE_ALUMINUM: u8 = 2;
    pub const TYPE_TIMBER: u8 = 3;

    pub fn steel() -> Self {
        Self {
            youngs_modulus: 200e9,
            yield_strength: 250e6,
            density: 7850.0,
            material_type: Self::TYPE_STEEL,
            reserved: [0; 3],
        }
    }

    pub fn concrete(fc: f32) -> Self {
        Self {
            youngs_modulus: 4700.0 * fc.sqrt() * 1e6, // ACI formula
            yield_strength: fc * 1e6,
            density: 2400.0,
            material_type: Self::TYPE_CONCRETE,
            reserved: [0; 3],
        }
    }

    pub fn to_bytes(&self) -> [u8; 16] {
        let mut bytes = [0u8; 16];
        bytes[0..4].copy_from_slice(&self.youngs_modulus.to_le_bytes());
        bytes[4..8].copy_from_slice(&self.yield_strength.to_le_bytes());
        bytes[8..12].copy_from_slice(&self.density.to_le_bytes());
        bytes[12] = self.material_type;
        bytes[13..16].copy_from_slice(&self.reserved);
        bytes
    }
}

// ============================================================================
// WASM SERIALIZER
// ============================================================================

#[wasm_bindgen]
pub struct CompactStructureEncoder {
    header: CompactHeader,
    nodes: Vec<CompactNode>,
    members: Vec<CompactMember>,
    loads: Vec<CompactLoad>,
    sections: Vec<CompactSection>,
    materials: Vec<CompactMaterial>,
}

#[wasm_bindgen]
impl CompactStructureEncoder {
    #[wasm_bindgen(constructor)]
    pub fn new() -> Self {
        Self {
            header: CompactHeader::new(0, 0, 0),
            nodes: Vec::new(),
            members: Vec::new(),
            loads: Vec::new(),
            sections: Vec::new(),
            materials: Vec::new(),
        }
    }

    pub fn add_node(&mut self, x: f32, y: f32, z: f32) -> u16 {
        let id = self.nodes.len() as u16;
        self.nodes.push(CompactNode::from_float(x, y, z, id));
        id
    }

    pub fn add_section_rectangular(&mut self, width: f32, height: f32) -> u8 {
        let id = self.sections.len() as u8;
        self.sections.push(CompactSection::rectangular(width, height));
        id
    }

    pub fn add_section_circular(&mut self, diameter: f32) -> u8 {
        let id = self.sections.len() as u8;
        self.sections.push(CompactSection::circular(diameter));
        id
    }

    pub fn add_material_steel(&mut self) -> u8 {
        let id = self.materials.len() as u8;
        self.materials.push(CompactMaterial::steel());
        id
    }

    pub fn add_material_concrete(&mut self, fc: f32) -> u8 {
        let id = self.materials.len() as u8;
        self.materials.push(CompactMaterial::concrete(fc));
        id
    }

    pub fn add_member(&mut self, start: u16, end: u16, section: u8, material: u8) -> u16 {
        let id = self.members.len() as u16;
        self.members.push(CompactMember::new(start, end, section, material));
        id
    }

    pub fn add_point_load(&mut self, node: u16, fx: f32, fy: f32, fz: f32) {
        if fx.abs() > 0.001 {
            self.loads.push(CompactLoad::point_force(node, CompactLoad::DIR_X, fx));
        }
        if fy.abs() > 0.001 {
            self.loads.push(CompactLoad::point_force(node, CompactLoad::DIR_Y, fy));
        }
        if fz.abs() > 0.001 {
            self.loads.push(CompactLoad::point_force(node, CompactLoad::DIR_Z, fz));
        }
    }

    /// Encode to compact binary format
    pub fn encode(&self) -> Vec<u8> {
        let mut data = Vec::new();

        // Update header
        let header = CompactHeader::new(
            self.nodes.len() as u32,
            self.members.len() as u32,
            self.loads.len() as u32,
        );
        data.extend_from_slice(&header.to_bytes());

        // Section count and material count
        data.extend_from_slice(&(self.sections.len() as u16).to_le_bytes());
        data.extend_from_slice(&(self.materials.len() as u16).to_le_bytes());

        // Encode sections
        for section in &self.sections {
            data.extend_from_slice(&section.to_bytes());
        }

        // Encode materials
        for material in &self.materials {
            data.extend_from_slice(&material.to_bytes());
        }

        // Encode nodes
        for node in &self.nodes {
            data.extend_from_slice(&node.to_bytes());
        }

        // Encode members
        for member in &self.members {
            data.extend_from_slice(&member.to_bytes());
        }

        // Encode loads
        for load in &self.loads {
            data.extend_from_slice(&load.to_bytes());
        }

        data
    }

    /// Get estimated size in bytes
    pub fn estimated_size(&self) -> u32 {
        (20 + // Header
         4 +  // Section/material counts
         self.sections.len() * 16 +
         self.materials.len() * 16 +
         self.nodes.len() * 8 +
         self.members.len() * 8 +
         self.loads.len() * 12) as u32
    }

    /// Memory savings compared to JSON
    pub fn compression_ratio(&self) -> f32 {
        // Estimate JSON size (very rough)
        let json_node_size = 40; // {"x":0.0,"y":0.0,"z":0.0}
        let json_member_size = 80;
        let json_load_size = 50;
        
        let json_size = self.nodes.len() * json_node_size +
                        self.members.len() * json_member_size +
                        self.loads.len() * json_load_size;
        
        let binary_size = self.estimated_size() as usize;
        
        if binary_size > 0 {
            json_size as f32 / binary_size as f32
        } else {
            1.0
        }
    }
}

// ============================================================================
// COMPACT RESULTS FORMAT
// ============================================================================

/// Compact displacement result (8 bytes per node vs 32+ in JSON)
#[repr(C, packed)]
#[derive(Clone, Copy, Debug)]
pub struct CompactDisplacement {
    pub dx: f32,  // X displacement (m)
    pub dy: f32,  // Y displacement (m)
}

/// Compact member force result
#[repr(C, packed)]
#[derive(Clone, Copy, Debug)]
pub struct CompactMemberForce {
    pub axial: f32,       // Axial force (N)
    pub shear: f32,       // Shear force (N)
    pub moment_start: f32, // Moment at start (N·m)
    pub moment_end: f32,   // Moment at end (N·m)
}

#[wasm_bindgen]
pub struct CompactResultsEncoder {
    displacements: Vec<CompactDisplacement>,
    forces: Vec<CompactMemberForce>,
    reactions: Vec<f32>,
}

#[wasm_bindgen]
impl CompactResultsEncoder {
    #[wasm_bindgen(constructor)]
    pub fn new(node_count: u32, member_count: u32) -> Self {
        Self {
            displacements: vec![CompactDisplacement { dx: 0.0, dy: 0.0 }; node_count as usize],
            forces: vec![CompactMemberForce {
                axial: 0.0,
                shear: 0.0,
                moment_start: 0.0,
                moment_end: 0.0,
            }; member_count as usize],
            reactions: Vec::new(),
        }
    }

    pub fn set_displacement(&mut self, node_idx: u32, dx: f32, dy: f32) {
        if (node_idx as usize) < self.displacements.len() {
            self.displacements[node_idx as usize] = CompactDisplacement { dx, dy };
        }
    }

    pub fn set_member_force(&mut self, member_idx: u32, axial: f32, shear: f32, m_start: f32, m_end: f32) {
        if (member_idx as usize) < self.forces.len() {
            self.forces[member_idx as usize] = CompactMemberForce {
                axial,
                shear,
                moment_start: m_start,
                moment_end: m_end,
            };
        }
    }

    pub fn add_reaction(&mut self, fx: f32, fy: f32, mz: f32) {
        self.reactions.extend_from_slice(&[fx, fy, mz]);
    }

    pub fn encode(&self) -> Vec<u8> {
        let mut data = Vec::new();

        // Counts
        data.extend_from_slice(&(self.displacements.len() as u32).to_le_bytes());
        data.extend_from_slice(&(self.forces.len() as u32).to_le_bytes());
        data.extend_from_slice(&((self.reactions.len() / 3) as u32).to_le_bytes());

        // Displacements
        for d in &self.displacements {
            data.extend_from_slice(&d.dx.to_le_bytes());
            data.extend_from_slice(&d.dy.to_le_bytes());
        }

        // Forces
        for f in &self.forces {
            data.extend_from_slice(&f.axial.to_le_bytes());
            data.extend_from_slice(&f.shear.to_le_bytes());
            data.extend_from_slice(&f.moment_start.to_le_bytes());
            data.extend_from_slice(&f.moment_end.to_le_bytes());
        }

        // Reactions
        for r in &self.reactions {
            data.extend_from_slice(&r.to_le_bytes());
        }

        data
    }

    pub fn byte_size(&self) -> u32 {
        (12 + // Header
         self.displacements.len() * 8 +
         self.forces.len() * 16 +
         self.reactions.len() * 4) as u32
    }
}

// ============================================================================
// DELTA ENCODING FOR MESH DATA
// ============================================================================

/// Delta-encode a sequence of values for better compression
#[wasm_bindgen]
pub fn delta_encode_i16(values: Vec<i16>) -> Vec<i16> {
    if values.is_empty() {
        return vec![];
    }

    let mut result = Vec::with_capacity(values.len());
    result.push(values[0]);

    for i in 1..values.len() {
        result.push(values[i].wrapping_sub(values[i - 1]));
    }

    result
}

/// Delta-decode a sequence of values
#[wasm_bindgen]
pub fn delta_decode_i16(deltas: Vec<i16>) -> Vec<i16> {
    if deltas.is_empty() {
        return vec![];
    }

    let mut result = Vec::with_capacity(deltas.len());
    result.push(deltas[0]);

    for i in 1..deltas.len() {
        result.push(result[i - 1].wrapping_add(deltas[i]));
    }

    result
}

/// Run-length encode for sparse data
#[wasm_bindgen]
pub fn rle_encode_u8(data: Vec<u8>) -> Vec<u8> {
    if data.is_empty() {
        return vec![];
    }

    let mut result = Vec::new();
    let mut i = 0;

    while i < data.len() {
        let value = data[i];
        let mut count = 1u8;

        while i + (count as usize) < data.len()
            && data[i + count as usize] == value
            && count < 255
        {
            count += 1;
        }

        result.push(count);
        result.push(value);
        i += count as usize;
    }

    result
}

/// Run-length decode
#[wasm_bindgen]
pub fn rle_decode_u8(encoded: Vec<u8>) -> Vec<u8> {
    let mut result = Vec::new();
    let mut i = 0;

    while i + 1 < encoded.len() {
        let count = encoded[i];
        let value = encoded[i + 1];

        for _ in 0..count {
            result.push(value);
        }
        i += 2;
    }

    result
}

// ============================================================================
// ZIGZAG ENCODING FOR SIGNED INTEGERS
// ============================================================================

/// ZigZag encode signed to unsigned (better for compression)
#[wasm_bindgen]
pub fn zigzag_encode_i32(value: i32) -> u32 {
    ((value << 1) ^ (value >> 31)) as u32
}

/// ZigZag decode unsigned to signed
#[wasm_bindgen]
pub fn zigzag_decode_i32(value: u32) -> i32 {
    ((value >> 1) as i32) ^ -((value & 1) as i32)
}

/// Batch zigzag encode
#[wasm_bindgen]
pub fn zigzag_encode_batch(values: Vec<i32>) -> Vec<u32> {
    values.iter().map(|&v| zigzag_encode_i32(v)).collect()
}

// ============================================================================
// VARINT ENCODING FOR COMPACT INTEGERS
// ============================================================================

/// Encode u32 as variable-length integer (1-5 bytes)
pub fn varint_encode_u32(value: u32, output: &mut Vec<u8>) {
    let mut v = value;
    while v >= 0x80 {
        output.push((v as u8) | 0x80);
        v >>= 7;
    }
    output.push(v as u8);
}

/// Decode variable-length integer
pub fn varint_decode_u32(input: &[u8], pos: &mut usize) -> Option<u32> {
    let mut result = 0u32;
    let mut shift = 0;

    loop {
        if *pos >= input.len() {
            return None;
        }

        let byte = input[*pos];
        *pos += 1;

        result |= ((byte & 0x7F) as u32) << shift;

        if byte & 0x80 == 0 {
            return Some(result);
        }

        shift += 7;
        if shift >= 35 {
            return None; // Overflow
        }
    }
}

// ============================================================================
// TESTS
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_compact_node() {
        let node = CompactNode::from_float(1.234, -5.678, 10.0, 42);
        let (x, y, z) = node.to_float();

        // Check within 1mm precision
        assert!((x - 1.234).abs() < 0.001);
        assert!((y - (-5.678)).abs() < 0.001);
        assert!((z - 10.0).abs() < 0.001);
    }

    #[test]
    fn test_delta_encoding() {
        let values = vec![100i16, 102, 105, 103, 110];
        let encoded = delta_encode_i16(values.clone());
        let decoded = delta_decode_i16(encoded);
        assert_eq!(values, decoded);
    }

    #[test]
    fn test_zigzag_encoding() {
        assert_eq!(zigzag_encode_i32(0), 0);
        assert_eq!(zigzag_encode_i32(-1), 1);
        assert_eq!(zigzag_encode_i32(1), 2);
        assert_eq!(zigzag_encode_i32(-2), 3);

        for v in [-1000, -1, 0, 1, 1000, i32::MIN, i32::MAX] {
            let encoded = zigzag_encode_i32(v);
            let decoded = zigzag_decode_i32(encoded);
            assert_eq!(v, decoded);
        }
    }

    #[test]
    fn test_rle_encoding() {
        let data = vec![5, 5, 5, 5, 3, 3, 7, 7, 7, 7, 7];
        let encoded = rle_encode_u8(data.clone());
        let decoded = rle_decode_u8(encoded);
        assert_eq!(data, decoded);
    }

    #[test]
    fn test_varint_encoding() {
        let mut buf = Vec::new();
        varint_encode_u32(300, &mut buf);
        
        let mut pos = 0;
        let decoded = varint_decode_u32(&buf, &mut pos).unwrap();
        assert_eq!(decoded, 300);
    }

    #[test]
    fn test_structure_encoder() {
        let mut encoder = CompactStructureEncoder::new();
        
        // Add materials and sections
        let steel = encoder.add_material_steel();
        let section = encoder.add_section_rectangular(0.3, 0.5);
        
        // Add nodes
        let n1 = encoder.add_node(0.0, 0.0, 0.0);
        let n2 = encoder.add_node(6.0, 0.0, 0.0);
        
        // Add member
        encoder.add_member(n1, n2, section, steel);
        
        // Add load
        encoder.add_point_load(n2, 0.0, -10000.0, 0.0);
        
        let encoded = encoder.encode();
        assert!(encoded.len() < 200); // Should be very compact
        
        let ratio = encoder.compression_ratio();
        assert!(ratio > 2.0); // Should be at least 2x smaller than JSON
    }
}
