//! 3D Modeling and Rendering Module
//! 
//! Comprehensive 3D model generation, mesh operations, and visualization
//! for structural engineering applications with WASM compatibility.

use std::f64::consts::PI;

/// 3D Point
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct Point3D {
    pub x: f64,
    pub y: f64,
    pub z: f64,
}

impl Point3D {
    pub fn new(x: f64, y: f64, z: f64) -> Self {
        Point3D { x, y, z }
    }

    pub fn origin() -> Self {
        Point3D { x: 0.0, y: 0.0, z: 0.0 }
    }

    pub fn distance_to(&self, other: &Point3D) -> f64 {
        ((self.x - other.x).powi(2) +
         (self.y - other.y).powi(2) +
         (self.z - other.z).powi(2)).sqrt()
    }

    pub fn add(&self, other: &Point3D) -> Point3D {
        Point3D::new(self.x + other.x, self.y + other.y, self.z + other.z)
    }

    pub fn subtract(&self, other: &Point3D) -> Point3D {
        Point3D::new(self.x - other.x, self.y - other.y, self.z - other.z)
    }

    pub fn scale(&self, factor: f64) -> Point3D {
        Point3D::new(self.x * factor, self.y * factor, self.z * factor)
    }

    pub fn normalize(&self) -> Point3D {
        let mag = (self.x.powi(2) + self.y.powi(2) + self.z.powi(2)).sqrt();
        if mag > 1e-10 {
            self.scale(1.0 / mag)
        } else {
            Point3D::origin()
        }
    }

    pub fn cross(&self, other: &Point3D) -> Point3D {
        Point3D::new(
            self.y * other.z - self.z * other.y,
            self.z * other.x - self.x * other.z,
            self.x * other.y - self.y * other.x,
        )
    }

    pub fn dot(&self, other: &Point3D) -> f64 {
        self.x * other.x + self.y * other.y + self.z * other.z
    }
}

/// 3D Vector (alias for Point3D semantics)
pub type Vector3D = Point3D;

/// 4x4 Transformation matrix
#[derive(Debug, Clone)]
pub struct Matrix4x4 {
    pub data: [[f64; 4]; 4],
}

impl Matrix4x4 {
    pub fn identity() -> Self {
        Matrix4x4 {
            data: [
                [1.0, 0.0, 0.0, 0.0],
                [0.0, 1.0, 0.0, 0.0],
                [0.0, 0.0, 1.0, 0.0],
                [0.0, 0.0, 0.0, 1.0],
            ],
        }
    }

    pub fn translation(dx: f64, dy: f64, dz: f64) -> Self {
        let mut m = Self::identity();
        m.data[0][3] = dx;
        m.data[1][3] = dy;
        m.data[2][3] = dz;
        m
    }

    pub fn scale(sx: f64, sy: f64, sz: f64) -> Self {
        let mut m = Self::identity();
        m.data[0][0] = sx;
        m.data[1][1] = sy;
        m.data[2][2] = sz;
        m
    }

    pub fn rotation_x(angle: f64) -> Self {
        let c = angle.cos();
        let s = angle.sin();
        let mut m = Self::identity();
        m.data[1][1] = c;
        m.data[1][2] = -s;
        m.data[2][1] = s;
        m.data[2][2] = c;
        m
    }

    pub fn rotation_y(angle: f64) -> Self {
        let c = angle.cos();
        let s = angle.sin();
        let mut m = Self::identity();
        m.data[0][0] = c;
        m.data[0][2] = s;
        m.data[2][0] = -s;
        m.data[2][2] = c;
        m
    }

    pub fn rotation_z(angle: f64) -> Self {
        let c = angle.cos();
        let s = angle.sin();
        let mut m = Self::identity();
        m.data[0][0] = c;
        m.data[0][1] = -s;
        m.data[1][0] = s;
        m.data[1][1] = c;
        m
    }

    pub fn multiply(&self, other: &Matrix4x4) -> Matrix4x4 {
        let mut result = [[0.0; 4]; 4];
        for i in 0..4 {
            for j in 0..4 {
                for k in 0..4 {
                    result[i][j] += self.data[i][k] * other.data[k][j];
                }
            }
        }
        Matrix4x4 { data: result }
    }

    pub fn transform_point(&self, p: &Point3D) -> Point3D {
        Point3D::new(
            self.data[0][0] * p.x + self.data[0][1] * p.y + self.data[0][2] * p.z + self.data[0][3],
            self.data[1][0] * p.x + self.data[1][1] * p.y + self.data[1][2] * p.z + self.data[1][3],
            self.data[2][0] * p.x + self.data[2][1] * p.y + self.data[2][2] * p.z + self.data[2][3],
        )
    }
}

/// Triangle mesh face
#[derive(Debug, Clone)]
pub struct Face {
    pub indices: [usize; 3],
    pub normal: Option<Vector3D>,
}

impl Face {
    pub fn new(i0: usize, i1: usize, i2: usize) -> Self {
        Face {
            indices: [i0, i1, i2],
            normal: None,
        }
    }

    pub fn compute_normal(&mut self, vertices: &[Point3D]) {
        let v0 = vertices[self.indices[0]];
        let v1 = vertices[self.indices[1]];
        let v2 = vertices[self.indices[2]];

        let edge1 = v1.subtract(&v0);
        let edge2 = v2.subtract(&v0);
        self.normal = Some(edge1.cross(&edge2).normalize());
    }
}

/// 3D Mesh structure
#[derive(Debug, Clone)]
pub struct Mesh {
    pub vertices: Vec<Point3D>,
    pub faces: Vec<Face>,
    pub normals: Vec<Vector3D>,
    pub uvs: Vec<(f64, f64)>,
    pub name: String,
}

impl Mesh {
    pub fn new(name: &str) -> Self {
        Mesh {
            vertices: Vec::new(),
            faces: Vec::new(),
            normals: Vec::new(),
            uvs: Vec::new(),
            name: name.to_string(),
        }
    }

    pub fn add_vertex(&mut self, p: Point3D) -> usize {
        self.vertices.push(p);
        self.vertices.len() - 1
    }

    pub fn add_face(&mut self, i0: usize, i1: usize, i2: usize) {
        let mut face = Face::new(i0, i1, i2);
        face.compute_normal(&self.vertices);
        self.faces.push(face);
    }

    pub fn compute_normals(&mut self) {
        self.normals = vec![Vector3D::origin(); self.vertices.len()];

        for face in &self.faces {
            if let Some(n) = &face.normal {
                for &idx in &face.indices {
                    self.normals[idx] = self.normals[idx].add(n);
                }
            }
        }

        for normal in &mut self.normals {
            *normal = normal.normalize();
        }
    }

    pub fn transform(&mut self, matrix: &Matrix4x4) {
        for vertex in &mut self.vertices {
            *vertex = matrix.transform_point(vertex);
        }
        self.compute_normals();
    }

    pub fn bounding_box(&self) -> BoundingBox {
        if self.vertices.is_empty() {
            return BoundingBox::empty();
        }

        let mut min = self.vertices[0];
        let mut max = self.vertices[0];

        for v in &self.vertices {
            min.x = min.x.min(v.x);
            min.y = min.y.min(v.y);
            min.z = min.z.min(v.z);
            max.x = max.x.max(v.x);
            max.y = max.y.max(v.y);
            max.z = max.z.max(v.z);
        }

        BoundingBox { min, max }
    }

    pub fn vertex_count(&self) -> usize {
        self.vertices.len()
    }

    pub fn face_count(&self) -> usize {
        self.faces.len()
    }

    /// Merge another mesh into this one
    pub fn merge(&mut self, other: &Mesh) {
        let offset = self.vertices.len();
        self.vertices.extend(other.vertices.clone());
        self.normals.extend(other.normals.clone());
        self.uvs.extend(other.uvs.clone());

        for face in &other.faces {
            let mut new_face = face.clone();
            new_face.indices[0] += offset;
            new_face.indices[1] += offset;
            new_face.indices[2] += offset;
            self.faces.push(new_face);
        }
    }

    /// Export to OBJ format string
    pub fn to_obj(&self) -> String {
        let mut obj = format!("# {}\n", self.name);
        obj.push_str(&format!("# Vertices: {}, Faces: {}\n\n", self.vertex_count(), self.face_count()));

        for v in &self.vertices {
            obj.push_str(&format!("v {:.6} {:.6} {:.6}\n", v.x, v.y, v.z));
        }

        obj.push('\n');

        for n in &self.normals {
            obj.push_str(&format!("vn {:.6} {:.6} {:.6}\n", n.x, n.y, n.z));
        }

        obj.push('\n');

        for face in &self.faces {
            let [i0, i1, i2] = face.indices;
            obj.push_str(&format!("f {}//{} {}//{} {}//{}\n",
                i0 + 1, i0 + 1,
                i1 + 1, i1 + 1,
                i2 + 1, i2 + 1
            ));
        }

        obj
    }
}

/// Bounding box
#[derive(Debug, Clone)]
pub struct BoundingBox {
    pub min: Point3D,
    pub max: Point3D,
}

impl BoundingBox {
    pub fn empty() -> Self {
        BoundingBox {
            min: Point3D::origin(),
            max: Point3D::origin(),
        }
    }

    pub fn center(&self) -> Point3D {
        Point3D::new(
            (self.min.x + self.max.x) / 2.0,
            (self.min.y + self.max.y) / 2.0,
            (self.min.z + self.max.z) / 2.0,
        )
    }

    pub fn size(&self) -> Vector3D {
        self.max.subtract(&self.min)
    }

    pub fn diagonal(&self) -> f64 {
        self.min.distance_to(&self.max)
    }

    pub fn contains(&self, p: &Point3D) -> bool {
        p.x >= self.min.x && p.x <= self.max.x &&
        p.y >= self.min.y && p.y <= self.max.y &&
        p.z >= self.min.z && p.z <= self.max.z
    }

    pub fn expand(&mut self, p: &Point3D) {
        self.min.x = self.min.x.min(p.x);
        self.min.y = self.min.y.min(p.y);
        self.min.z = self.min.z.min(p.z);
        self.max.x = self.max.x.max(p.x);
        self.max.y = self.max.y.max(p.y);
        self.max.z = self.max.z.max(p.z);
    }
}

/// Mesh generator for structural elements
pub struct MeshGenerator;

impl MeshGenerator {
    /// Generate box mesh
    pub fn box_mesh(width: f64, height: f64, depth: f64) -> Mesh {
        let mut mesh = Mesh::new("Box");
        let hw = width / 2.0;
        let hh = height / 2.0;
        let hd = depth / 2.0;

        // 8 vertices
        let v0 = mesh.add_vertex(Point3D::new(-hw, -hh, -hd));
        let v1 = mesh.add_vertex(Point3D::new(hw, -hh, -hd));
        let v2 = mesh.add_vertex(Point3D::new(hw, hh, -hd));
        let v3 = mesh.add_vertex(Point3D::new(-hw, hh, -hd));
        let v4 = mesh.add_vertex(Point3D::new(-hw, -hh, hd));
        let v5 = mesh.add_vertex(Point3D::new(hw, -hh, hd));
        let v6 = mesh.add_vertex(Point3D::new(hw, hh, hd));
        let v7 = mesh.add_vertex(Point3D::new(-hw, hh, hd));

        // 12 triangular faces (2 per side)
        mesh.add_face(v0, v1, v2); mesh.add_face(v0, v2, v3); // Front
        mesh.add_face(v5, v4, v7); mesh.add_face(v5, v7, v6); // Back
        mesh.add_face(v4, v0, v3); mesh.add_face(v4, v3, v7); // Left
        mesh.add_face(v1, v5, v6); mesh.add_face(v1, v6, v2); // Right
        mesh.add_face(v3, v2, v6); mesh.add_face(v3, v6, v7); // Top
        mesh.add_face(v4, v5, v1); mesh.add_face(v4, v1, v0); // Bottom

        mesh.compute_normals();
        mesh
    }

    /// Generate cylinder mesh
    pub fn cylinder(radius: f64, height: f64, segments: usize) -> Mesh {
        let mut mesh = Mesh::new("Cylinder");
        let segments = segments.max(8);
        let half_h = height / 2.0;

        // Bottom center
        let bottom_center = mesh.add_vertex(Point3D::new(0.0, -half_h, 0.0));
        // Top center
        let top_center = mesh.add_vertex(Point3D::new(0.0, half_h, 0.0));

        // Generate ring vertices
        let mut bottom_ring = Vec::new();
        let mut top_ring = Vec::new();

        for i in 0..segments {
            let angle = 2.0 * PI * i as f64 / segments as f64;
            let x = radius * angle.cos();
            let z = radius * angle.sin();

            bottom_ring.push(mesh.add_vertex(Point3D::new(x, -half_h, z)));
            top_ring.push(mesh.add_vertex(Point3D::new(x, half_h, z)));
        }

        // Bottom cap
        for i in 0..segments {
            let next = (i + 1) % segments;
            mesh.add_face(bottom_center, bottom_ring[next], bottom_ring[i]);
        }

        // Top cap
        for i in 0..segments {
            let next = (i + 1) % segments;
            mesh.add_face(top_center, top_ring[i], top_ring[next]);
        }

        // Side faces
        for i in 0..segments {
            let next = (i + 1) % segments;
            mesh.add_face(bottom_ring[i], bottom_ring[next], top_ring[next]);
            mesh.add_face(bottom_ring[i], top_ring[next], top_ring[i]);
        }

        mesh.compute_normals();
        mesh
    }

    /// Generate I-beam mesh
    pub fn i_beam(depth: f64, width: f64, tf: f64, tw: f64, length: f64) -> Mesh {
        let mut mesh = Mesh::new("I-Beam");
        let half_l = length / 2.0;

        // Profile points (clockwise from bottom-left)
        let profile = [
            (-width / 2.0, -depth / 2.0),
            (width / 2.0, -depth / 2.0),
            (width / 2.0, -depth / 2.0 + tf),
            (tw / 2.0, -depth / 2.0 + tf),
            (tw / 2.0, depth / 2.0 - tf),
            (width / 2.0, depth / 2.0 - tf),
            (width / 2.0, depth / 2.0),
            (-width / 2.0, depth / 2.0),
            (-width / 2.0, depth / 2.0 - tf),
            (-tw / 2.0, depth / 2.0 - tf),
            (-tw / 2.0, -depth / 2.0 + tf),
            (-width / 2.0, -depth / 2.0 + tf),
        ];

        // Front face vertices
        let mut front = Vec::new();
        for &(x, y) in &profile {
            front.push(mesh.add_vertex(Point3D::new(x, y, -half_l)));
        }

        // Back face vertices
        let mut back = Vec::new();
        for &(x, y) in &profile {
            back.push(mesh.add_vertex(Point3D::new(x, y, half_l)));
        }

        // Front face (triangulated)
        mesh.add_face(front[0], front[1], front[11]);
        mesh.add_face(front[1], front[2], front[11]);
        mesh.add_face(front[2], front[3], front[11]);
        mesh.add_face(front[3], front[10], front[11]);
        mesh.add_face(front[3], front[4], front[10]);
        mesh.add_face(front[4], front[9], front[10]);
        mesh.add_face(front[4], front[5], front[9]);
        mesh.add_face(front[5], front[8], front[9]);
        mesh.add_face(front[5], front[6], front[8]);
        mesh.add_face(front[6], front[7], front[8]);

        // Back face (reversed winding)
        mesh.add_face(back[0], back[11], back[1]);
        mesh.add_face(back[1], back[11], back[2]);
        mesh.add_face(back[2], back[11], back[3]);
        mesh.add_face(back[3], back[11], back[10]);
        mesh.add_face(back[3], back[10], back[4]);
        mesh.add_face(back[4], back[10], back[9]);
        mesh.add_face(back[4], back[9], back[5]);
        mesh.add_face(back[5], back[9], back[8]);
        mesh.add_face(back[5], back[8], back[6]);
        mesh.add_face(back[6], back[8], back[7]);

        // Side faces
        let n = profile.len();
        for i in 0..n {
            let next = (i + 1) % n;
            mesh.add_face(front[i], back[i], back[next]);
            mesh.add_face(front[i], back[next], front[next]);
        }

        mesh.compute_normals();
        mesh
    }

    /// Generate hollow tube (rectangular HSS)
    pub fn tube(width: f64, height: f64, thickness: f64, length: f64) -> Mesh {
        let mut mesh = Mesh::new("HSS Tube");
        let half_l = length / 2.0;

        let wo = width / 2.0;
        let ho = height / 2.0;
        let wi = wo - thickness;
        let hi = ho - thickness;

        // Outer profile
        let outer = [
            (-wo, -ho), (wo, -ho), (wo, ho), (-wo, ho)
        ];

        // Inner profile
        let inner = [
            (-wi, -hi), (wi, -hi), (wi, hi), (-wi, hi)
        ];

        // Front outer vertices
        let mut front_o = Vec::new();
        for &(x, y) in &outer {
            front_o.push(mesh.add_vertex(Point3D::new(x, y, -half_l)));
        }

        // Front inner vertices
        let mut front_i = Vec::new();
        for &(x, y) in &inner {
            front_i.push(mesh.add_vertex(Point3D::new(x, y, -half_l)));
        }

        // Back outer vertices
        let mut back_o = Vec::new();
        for &(x, y) in &outer {
            back_o.push(mesh.add_vertex(Point3D::new(x, y, half_l)));
        }

        // Back inner vertices
        let mut back_i = Vec::new();
        for &(x, y) in &inner {
            back_i.push(mesh.add_vertex(Point3D::new(x, y, half_l)));
        }

        // Front face (ring)
        for i in 0..4 {
            let next = (i + 1) % 4;
            mesh.add_face(front_o[i], front_o[next], front_i[next]);
            mesh.add_face(front_o[i], front_i[next], front_i[i]);
        }

        // Back face (ring, reversed)
        for i in 0..4 {
            let next = (i + 1) % 4;
            mesh.add_face(back_o[i], back_i[next], back_o[next]);
            mesh.add_face(back_o[i], back_i[i], back_i[next]);
        }

        // Outer side faces
        for i in 0..4 {
            let next = (i + 1) % 4;
            mesh.add_face(front_o[i], back_o[i], back_o[next]);
            mesh.add_face(front_o[i], back_o[next], front_o[next]);
        }

        // Inner side faces (reversed winding)
        for i in 0..4 {
            let next = (i + 1) % 4;
            mesh.add_face(front_i[i], back_i[next], back_i[i]);
            mesh.add_face(front_i[i], front_i[next], back_i[next]);
        }

        mesh.compute_normals();
        mesh
    }

    /// Generate sphere mesh
    pub fn sphere(radius: f64, lat_segments: usize, lon_segments: usize) -> Mesh {
        let mut mesh = Mesh::new("Sphere");
        let lat = lat_segments.max(4);
        let lon = lon_segments.max(4);

        // Generate vertices
        for i in 0..=lat {
            let theta = PI * i as f64 / lat as f64;
            let sin_theta = theta.sin();
            let cos_theta = theta.cos();

            for j in 0..=lon {
                let phi = 2.0 * PI * j as f64 / lon as f64;
                let x = radius * sin_theta * phi.cos();
                let y = radius * cos_theta;
                let z = radius * sin_theta * phi.sin();
                mesh.add_vertex(Point3D::new(x, y, z));
            }
        }

        // Generate faces
        for i in 0..lat {
            for j in 0..lon {
                let v0 = i * (lon + 1) + j;
                let v1 = v0 + 1;
                let v2 = v0 + lon + 1;
                let v3 = v2 + 1;

                if i > 0 {
                    mesh.add_face(v0, v2, v1);
                }
                if i < lat - 1 {
                    mesh.add_face(v1, v2, v3);
                }
            }
        }

        mesh.compute_normals();
        mesh
    }

    /// Generate cone mesh
    pub fn cone(radius: f64, height: f64, segments: usize) -> Mesh {
        let mut mesh = Mesh::new("Cone");
        let segments = segments.max(8);

        // Apex
        let apex = mesh.add_vertex(Point3D::new(0.0, height, 0.0));
        // Base center
        let base_center = mesh.add_vertex(Point3D::new(0.0, 0.0, 0.0));

        // Base ring
        let mut base_ring = Vec::new();
        for i in 0..segments {
            let angle = 2.0 * PI * i as f64 / segments as f64;
            let x = radius * angle.cos();
            let z = radius * angle.sin();
            base_ring.push(mesh.add_vertex(Point3D::new(x, 0.0, z)));
        }

        // Side faces
        for i in 0..segments {
            let next = (i + 1) % segments;
            mesh.add_face(base_ring[i], base_ring[next], apex);
        }

        // Base cap
        for i in 0..segments {
            let next = (i + 1) % segments;
            mesh.add_face(base_center, base_ring[next], base_ring[i]);
        }

        mesh.compute_normals();
        mesh
    }
}

/// Color with alpha
#[derive(Debug, Clone, Copy)]
pub struct Color {
    pub r: f64,
    pub g: f64,
    pub b: f64,
    pub a: f64,
}

impl Color {
    pub fn rgb(r: f64, g: f64, b: f64) -> Self {
        Color { r, g, b, a: 1.0 }
    }

    pub fn rgba(r: f64, g: f64, b: f64, a: f64) -> Self {
        Color { r, g, b, a }
    }

    pub fn from_hex(hex: u32) -> Self {
        Color {
            r: ((hex >> 16) & 0xFF) as f64 / 255.0,
            g: ((hex >> 8) & 0xFF) as f64 / 255.0,
            b: (hex & 0xFF) as f64 / 255.0,
            a: 1.0,
        }
    }

    pub fn to_hex(&self) -> u32 {
        let r = (self.r * 255.0).round() as u32;
        let g = (self.g * 255.0).round() as u32;
        let b = (self.b * 255.0).round() as u32;
        (r << 16) | (g << 8) | b
    }

    pub fn lerp(&self, other: &Color, t: f64) -> Color {
        Color {
            r: self.r + (other.r - self.r) * t,
            g: self.g + (other.g - self.g) * t,
            b: self.b + (other.b - self.b) * t,
            a: self.a + (other.a - self.a) * t,
        }
    }

    // Predefined colors
    pub fn red() -> Self { Color::rgb(1.0, 0.0, 0.0) }
    pub fn green() -> Self { Color::rgb(0.0, 1.0, 0.0) }
    pub fn blue() -> Self { Color::rgb(0.0, 0.0, 1.0) }
    pub fn white() -> Self { Color::rgb(1.0, 1.0, 1.0) }
    pub fn black() -> Self { Color::rgb(0.0, 0.0, 0.0) }
    pub fn gray() -> Self { Color::rgb(0.5, 0.5, 0.5) }
    pub fn steel() -> Self { Color::rgb(0.6, 0.6, 0.7) }
    pub fn concrete() -> Self { Color::rgb(0.7, 0.7, 0.65) }
}

/// Stress coloring schemes
#[derive(Debug, Clone)]
pub struct ColorMap {
    pub colors: Vec<(f64, Color)>,
    pub name: String,
}

impl ColorMap {
    /// Rainbow colormap (blue-cyan-green-yellow-red)
    pub fn rainbow() -> Self {
        ColorMap {
            name: "Rainbow".to_string(),
            colors: vec![
                (0.0, Color::rgb(0.0, 0.0, 1.0)),   // Blue
                (0.25, Color::rgb(0.0, 1.0, 1.0)),  // Cyan
                (0.5, Color::rgb(0.0, 1.0, 0.0)),   // Green
                (0.75, Color::rgb(1.0, 1.0, 0.0)),  // Yellow
                (1.0, Color::rgb(1.0, 0.0, 0.0)),   // Red
            ],
        }
    }

    /// Engineering stress colormap (blue-white-red)
    pub fn stress() -> Self {
        ColorMap {
            name: "Stress".to_string(),
            colors: vec![
                (0.0, Color::rgb(0.0, 0.0, 1.0)),   // Blue (compression)
                (0.5, Color::rgb(1.0, 1.0, 1.0)),   // White (neutral)
                (1.0, Color::rgb(1.0, 0.0, 0.0)),   // Red (tension)
            ],
        }
    }

    /// Temperature colormap
    pub fn thermal() -> Self {
        ColorMap {
            name: "Thermal".to_string(),
            colors: vec![
                (0.0, Color::rgb(0.0, 0.0, 0.5)),   // Dark blue
                (0.25, Color::rgb(0.0, 0.5, 1.0)),  // Light blue
                (0.5, Color::rgb(1.0, 1.0, 0.0)),   // Yellow
                (0.75, Color::rgb(1.0, 0.5, 0.0)),  // Orange
                (1.0, Color::rgb(0.5, 0.0, 0.0)),   // Dark red
            ],
        }
    }

    /// Map value [0, 1] to color
    pub fn map(&self, value: f64) -> Color {
        let v = value.clamp(0.0, 1.0);

        for i in 0..self.colors.len() - 1 {
            let (t0, c0) = &self.colors[i];
            let (t1, c1) = &self.colors[i + 1];

            if v >= *t0 && v <= *t1 {
                let t = (v - t0) / (t1 - t0);
                return c0.lerp(c1, t);
            }
        }

        self.colors.last().map(|(_, c)| *c).unwrap_or(Color::white())
    }
}

/// Result visualization data
#[derive(Debug, Clone)]
pub struct ResultContour {
    pub mesh: Mesh,
    pub values: Vec<f64>,
    pub colors: Vec<Color>,
    pub min_value: f64,
    pub max_value: f64,
    pub name: String,
}

impl ResultContour {
    pub fn new(mesh: Mesh, values: Vec<f64>, name: &str) -> Self {
        let min_val = values.iter().cloned().fold(f64::INFINITY, f64::min);
        let max_val = values.iter().cloned().fold(f64::NEG_INFINITY, f64::max);

        let colormap = ColorMap::rainbow();
        let range = max_val - min_val;

        let colors: Vec<Color> = values.iter()
            .map(|v| {
                let normalized = if range > 1e-10 { (v - min_val) / range } else { 0.5 };
                colormap.map(normalized)
            })
            .collect();

        ResultContour {
            mesh,
            values,
            colors,
            min_value: min_val,
            max_value: max_val,
            name: name.to_string(),
        }
    }

    pub fn apply_colormap(&mut self, colormap: &ColorMap) {
        let range = self.max_value - self.min_value;
        self.colors = self.values.iter()
            .map(|v| {
                let normalized = if range > 1e-10 { (v - self.min_value) / range } else { 0.5 };
                colormap.map(normalized)
            })
            .collect();
    }
}

/// Deformation visualization
#[derive(Debug, Clone)]
pub struct DeformationView {
    pub original_mesh: Mesh,
    pub deformed_mesh: Mesh,
    pub displacements: Vec<Vector3D>,
    pub scale_factor: f64,
}

impl DeformationView {
    pub fn new(mesh: Mesh, displacements: Vec<Vector3D>, scale: f64) -> Self {
        let mut deformed = mesh.clone();
        deformed.name = format!("{}_deformed", mesh.name);

        for (i, v) in deformed.vertices.iter_mut().enumerate() {
            if i < displacements.len() {
                let d = &displacements[i];
                v.x += d.x * scale;
                v.y += d.y * scale;
                v.z += d.z * scale;
            }
        }
        deformed.compute_normals();

        DeformationView {
            original_mesh: mesh,
            deformed_mesh: deformed,
            displacements,
            scale_factor: scale,
        }
    }

    pub fn update_scale(&mut self, scale: f64) {
        self.scale_factor = scale;
        self.deformed_mesh.vertices = self.original_mesh.vertices.clone();

        for (i, v) in self.deformed_mesh.vertices.iter_mut().enumerate() {
            if i < self.displacements.len() {
                let d = &self.displacements[i];
                v.x += d.x * scale;
                v.y += d.y * scale;
                v.z += d.z * scale;
            }
        }
        self.deformed_mesh.compute_normals();
    }

    pub fn max_displacement(&self) -> f64 {
        self.displacements.iter()
            .map(|d| (d.x.powi(2) + d.y.powi(2) + d.z.powi(2)).sqrt())
            .fold(0.0, f64::max)
    }
}

/// Scene graph node
#[derive(Debug, Clone)]
pub struct SceneNode {
    pub name: String,
    pub mesh: Option<Mesh>,
    pub transform: Matrix4x4,
    pub visible: bool,
    pub children: Vec<SceneNode>,
    pub material: Material,
}

impl SceneNode {
    pub fn new(name: &str) -> Self {
        SceneNode {
            name: name.to_string(),
            mesh: None,
            transform: Matrix4x4::identity(),
            visible: true,
            children: Vec::new(),
            material: Material::default(),
        }
    }

    pub fn with_mesh(name: &str, mesh: Mesh) -> Self {
        let mut node = SceneNode::new(name);
        node.mesh = Some(mesh);
        node
    }

    pub fn add_child(&mut self, child: SceneNode) {
        self.children.push(child);
    }

    pub fn set_transform(&mut self, transform: Matrix4x4) {
        self.transform = transform;
    }

    pub fn total_vertex_count(&self) -> usize {
        let own = self.mesh.as_ref().map(|m| m.vertex_count()).unwrap_or(0);
        let children: usize = self.children.iter().map(|c| c.total_vertex_count()).sum();
        own + children
    }

    pub fn total_face_count(&self) -> usize {
        let own = self.mesh.as_ref().map(|m| m.face_count()).unwrap_or(0);
        let children: usize = self.children.iter().map(|c| c.total_face_count()).sum();
        own + children
    }
}

/// Material properties
#[derive(Debug, Clone)]
pub struct Material {
    pub color: Color,
    pub ambient: f64,
    pub diffuse: f64,
    pub specular: f64,
    pub shininess: f64,
    pub opacity: f64,
    pub wireframe: bool,
}

impl Default for Material {
    fn default() -> Self {
        Material {
            color: Color::gray(),
            ambient: 0.2,
            diffuse: 0.8,
            specular: 0.3,
            shininess: 32.0,
            opacity: 1.0,
            wireframe: false,
        }
    }
}

impl Material {
    pub fn steel() -> Self {
        Material {
            color: Color::steel(),
            ambient: 0.2,
            diffuse: 0.6,
            specular: 0.8,
            shininess: 64.0,
            opacity: 1.0,
            wireframe: false,
        }
    }

    pub fn concrete() -> Self {
        Material {
            color: Color::concrete(),
            ambient: 0.3,
            diffuse: 0.7,
            specular: 0.1,
            shininess: 8.0,
            opacity: 1.0,
            wireframe: false,
        }
    }

    pub fn glass() -> Self {
        Material {
            color: Color::rgba(0.8, 0.9, 1.0, 0.3),
            ambient: 0.1,
            diffuse: 0.3,
            specular: 0.9,
            shininess: 128.0,
            opacity: 0.3,
            wireframe: false,
        }
    }
}

/// Camera for 3D viewing
#[derive(Debug, Clone)]
pub struct Camera {
    pub position: Point3D,
    pub target: Point3D,
    pub up: Vector3D,
    pub fov: f64,            // degrees
    pub near: f64,
    pub far: f64,
    pub aspect_ratio: f64,
}

impl Camera {
    pub fn new() -> Self {
        Camera {
            position: Point3D::new(10.0, 10.0, 10.0),
            target: Point3D::origin(),
            up: Vector3D::new(0.0, 1.0, 0.0),
            fov: 45.0,
            near: 0.1,
            far: 1000.0,
            aspect_ratio: 16.0 / 9.0,
        }
    }

    pub fn look_at(&mut self, target: Point3D) {
        self.target = target;
    }

    pub fn set_position(&mut self, position: Point3D) {
        self.position = position;
    }

    pub fn orbit(&mut self, delta_theta: f64, delta_phi: f64) {
        let dir = self.position.subtract(&self.target);
        let r = (dir.x.powi(2) + dir.y.powi(2) + dir.z.powi(2)).sqrt();

        let theta = dir.z.atan2(dir.x) + delta_theta;
        let phi = (dir.y / r).acos() + delta_phi;
        let phi = phi.clamp(0.01, PI - 0.01);

        self.position = Point3D::new(
            self.target.x + r * phi.sin() * theta.cos(),
            self.target.y + r * phi.cos(),
            self.target.z + r * phi.sin() * theta.sin(),
        );
    }

    pub fn zoom(&mut self, factor: f64) {
        let dir = self.position.subtract(&self.target);
        let new_dir = dir.scale(factor);
        self.position = self.target.add(&new_dir);
    }

    pub fn view_matrix(&self) -> Matrix4x4 {
        let f = self.target.subtract(&self.position).normalize();
        let r = f.cross(&self.up).normalize();
        let u = r.cross(&f);

        let mut m = Matrix4x4::identity();
        m.data[0][0] = r.x; m.data[0][1] = r.y; m.data[0][2] = r.z;
        m.data[1][0] = u.x; m.data[1][1] = u.y; m.data[1][2] = u.z;
        m.data[2][0] = -f.x; m.data[2][1] = -f.y; m.data[2][2] = -f.z;
        m.data[0][3] = -r.dot(&self.position);
        m.data[1][3] = -u.dot(&self.position);
        m.data[2][3] = f.dot(&self.position);
        m
    }

    pub fn projection_matrix(&self) -> Matrix4x4 {
        let fov_rad = self.fov * PI / 180.0;
        let f = 1.0 / (fov_rad / 2.0).tan();

        let mut m = Matrix4x4::identity();
        m.data[0][0] = f / self.aspect_ratio;
        m.data[1][1] = f;
        m.data[2][2] = (self.far + self.near) / (self.near - self.far);
        m.data[2][3] = 2.0 * self.far * self.near / (self.near - self.far);
        m.data[3][2] = -1.0;
        m.data[3][3] = 0.0;
        m
    }
}

impl Default for Camera {
    fn default() -> Self {
        Camera::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_point3d_operations() {
        let p1 = Point3D::new(1.0, 2.0, 3.0);
        let p2 = Point3D::new(4.0, 5.0, 6.0);

        let sum = p1.add(&p2);
        assert!((sum.x - 5.0).abs() < 1e-10);

        let diff = p2.subtract(&p1);
        assert!((diff.x - 3.0).abs() < 1e-10);
    }

    #[test]
    fn test_point3d_normalize() {
        let p = Point3D::new(3.0, 4.0, 0.0);
        let n = p.normalize();
        let mag = (n.x.powi(2) + n.y.powi(2) + n.z.powi(2)).sqrt();
        assert!((mag - 1.0).abs() < 1e-10);
    }

    #[test]
    fn test_cross_product() {
        let x = Vector3D::new(1.0, 0.0, 0.0);
        let y = Vector3D::new(0.0, 1.0, 0.0);
        let z = x.cross(&y);
        assert!((z.z - 1.0).abs() < 1e-10);
    }

    #[test]
    fn test_matrix_identity() {
        let m = Matrix4x4::identity();
        let p = Point3D::new(1.0, 2.0, 3.0);
        let t = m.transform_point(&p);
        assert!((t.x - p.x).abs() < 1e-10);
    }

    #[test]
    fn test_matrix_translation() {
        let m = Matrix4x4::translation(10.0, 20.0, 30.0);
        let p = Point3D::origin();
        let t = m.transform_point(&p);
        assert!((t.x - 10.0).abs() < 1e-10);
        assert!((t.y - 20.0).abs() < 1e-10);
    }

    #[test]
    fn test_box_mesh() {
        let mesh = MeshGenerator::box_mesh(2.0, 2.0, 2.0);
        assert_eq!(mesh.vertex_count(), 8);
        assert_eq!(mesh.face_count(), 12);
    }

    #[test]
    fn test_cylinder_mesh() {
        let mesh = MeshGenerator::cylinder(1.0, 2.0, 16);
        assert!(mesh.vertex_count() > 0);
        assert!(mesh.face_count() > 0);
    }

    #[test]
    fn test_i_beam_mesh() {
        let mesh = MeshGenerator::i_beam(300.0, 150.0, 15.0, 10.0, 1000.0);
        assert!(mesh.vertex_count() > 0);
        assert!(mesh.face_count() > 0);
    }

    #[test]
    fn test_sphere_mesh() {
        let mesh = MeshGenerator::sphere(1.0, 8, 16);
        assert!(mesh.vertex_count() > 0);
        assert!(mesh.face_count() > 0);
    }

    #[test]
    fn test_mesh_bounding_box() {
        let mesh = MeshGenerator::box_mesh(4.0, 6.0, 8.0);
        let bb = mesh.bounding_box();
        assert!((bb.size().x - 4.0).abs() < 1e-10);
        assert!((bb.size().y - 6.0).abs() < 1e-10);
    }

    #[test]
    fn test_mesh_merge() {
        let mut m1 = MeshGenerator::box_mesh(1.0, 1.0, 1.0);
        let m2 = MeshGenerator::box_mesh(1.0, 1.0, 1.0);
        let v1 = m1.vertex_count();
        m1.merge(&m2);
        assert_eq!(m1.vertex_count(), v1 * 2);
    }

    #[test]
    fn test_obj_export() {
        let mesh = MeshGenerator::box_mesh(1.0, 1.0, 1.0);
        let obj = mesh.to_obj();
        assert!(obj.contains("v "));
        assert!(obj.contains("f "));
    }

    #[test]
    fn test_color_operations() {
        let red = Color::red();
        let blue = Color::blue();
        let purple = red.lerp(&blue, 0.5);
        assert!((purple.r - 0.5).abs() < 1e-10);
        assert!((purple.b - 0.5).abs() < 1e-10);
    }

    #[test]
    fn test_color_hex() {
        let color = Color::from_hex(0xFF8000);
        assert!((color.r - 1.0).abs() < 0.01);
        assert!((color.g - 0.5).abs() < 0.01);
        assert!((color.b - 0.0).abs() < 0.01);
    }

    #[test]
    fn test_colormap_rainbow() {
        let cmap = ColorMap::rainbow();
        let c0 = cmap.map(0.0);
        let c1 = cmap.map(1.0);
        assert!((c0.b - 1.0).abs() < 1e-10); // Blue
        assert!((c1.r - 1.0).abs() < 1e-10); // Red
    }

    #[test]
    fn test_result_contour() {
        let mesh = MeshGenerator::box_mesh(1.0, 1.0, 1.0);
        let values: Vec<f64> = (0..mesh.vertex_count()).map(|i| i as f64).collect();
        let contour = ResultContour::new(mesh, values, "Test");
        assert!(!contour.colors.is_empty());
    }

    #[test]
    fn test_deformation_view() {
        let mesh = MeshGenerator::box_mesh(1.0, 1.0, 1.0);
        let disp = vec![Vector3D::new(0.1, 0.0, 0.0); mesh.vertex_count()];
        let view = DeformationView::new(mesh, disp, 10.0);
        assert!(view.max_displacement() > 0.0);
    }

    #[test]
    fn test_scene_node() {
        let mesh = MeshGenerator::box_mesh(1.0, 1.0, 1.0);
        let mut root = SceneNode::new("Root");
        let child = SceneNode::with_mesh("Child", mesh);
        root.add_child(child);
        assert_eq!(root.children.len(), 1);
    }

    #[test]
    fn test_camera() {
        let mut camera = Camera::new();
        camera.orbit(0.1, 0.0);
        assert!(camera.position.x != 10.0 || camera.position.z != 10.0);
    }

    #[test]
    fn test_camera_zoom() {
        let mut camera = Camera::new();
        let dist_before = camera.position.distance_to(&camera.target);
        camera.zoom(0.5);
        let dist_after = camera.position.distance_to(&camera.target);
        assert!((dist_after - dist_before * 0.5).abs() < 1e-10);
    }

    #[test]
    fn test_material() {
        let steel = Material::steel();
        assert!(steel.specular > 0.5);

        let concrete = Material::concrete();
        assert!(concrete.specular < 0.5);
    }
}
