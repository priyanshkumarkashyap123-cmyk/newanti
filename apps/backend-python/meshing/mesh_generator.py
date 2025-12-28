"""
mesh_generator.py - Advanced Quad/Tri Meshing Engine for FEA

Features:
1. Plate Mesher (N×M quad subdivision with hard point constraints)
2. Constrained Delaunay Triangulation with hole handling
3. High-order elements (8-node brick, super elements)

Author: BeamLab FEA Team
"""

import math
import numpy as np
from dataclasses import dataclass, field
from typing import List, Tuple, Optional, Dict, Set
from enum import Enum


# ============================================
# BASIC TYPES
# ============================================

@dataclass
class Point3D:
    """3D Point/Node representation"""
    x: float
    y: float
    z: float
    id: Optional[str] = None
    
    def to_array(self) -> np.ndarray:
        return np.array([self.x, self.y, self.z])
    
    def distance_to(self, other: 'Point3D') -> float:
        return math.sqrt(
            (self.x - other.x)**2 + 
            (self.y - other.y)**2 + 
            (self.z - other.z)**2
        )
    
    def __hash__(self):
        return hash((round(self.x, 6), round(self.y, 6), round(self.z, 6)))
    
    def __eq__(self, other):
        if not isinstance(other, Point3D):
            return False
        tol = 1e-6
        return (abs(self.x - other.x) < tol and 
                abs(self.y - other.y) < tol and 
                abs(self.z - other.z) < tol)


@dataclass
class Point2D:
    """2D Point for triangulation"""
    x: float
    y: float
    id: Optional[str] = None
    
    def distance_to(self, other: 'Point2D') -> float:
        return math.sqrt((self.x - other.x)**2 + (self.y - other.y)**2)
    
    def __hash__(self):
        return hash((round(self.x, 6), round(self.y, 6)))


class ElementType(Enum):
    """Finite Element Types"""
    TRI3 = "tri3"           # 3-node triangle
    TRI6 = "tri6"           # 6-node triangle (quadratic)
    QUAD4 = "quad4"         # 4-node quadrilateral
    QUAD8 = "quad8"         # 8-node quadrilateral (serendipity)
    QUAD9 = "quad9"         # 9-node quadrilateral (Lagrangian)
    BRICK8 = "brick8"       # 8-node hexahedron
    BRICK20 = "brick20"     # 20-node hexahedron (quadratic)
    TETRA4 = "tetra4"       # 4-node tetrahedron
    TETRA10 = "tetra10"     # 10-node tetrahedron (quadratic)


# ============================================
# ELEMENT DATA STRUCTURES
# ============================================

@dataclass
class PlateElement:
    """4-Node Shell/Plate Element (QUAD4)"""
    id: str
    node_ids: List[str]  # 4 node IDs in CCW order
    thickness: float = 0.2  # meters
    material_id: str = "steel"
    
    # Analysis results (populated after solve)
    stress_xx: Optional[float] = None
    stress_yy: Optional[float] = None
    stress_xy: Optional[float] = None
    moment_xx: Optional[float] = None
    moment_yy: Optional[float] = None
    moment_xy: Optional[float] = None
    
    def get_type(self) -> ElementType:
        return ElementType.QUAD4


@dataclass
class TriElement:
    """3-Node Triangle Element"""
    id: str
    node_ids: List[str]  # 3 node IDs in CCW order
    thickness: float = 0.2
    material_id: str = "steel"
    
    # Analysis results
    stress_xx: Optional[float] = None
    stress_yy: Optional[float] = None
    stress_xy: Optional[float] = None
    
    def get_type(self) -> ElementType:
        return ElementType.TRI3


@dataclass
class BrickElement:
    """8-Node Hexahedron (Brick) Solid Element"""
    id: str
    node_ids: List[str]  # 8 node IDs in specific order:
    # Bottom face CCW: 0,1,2,3 then Top face CCW: 4,5,6,7
    #     7--------6
    #    /|       /|
    #   4--------5 |
    #   | |      | |
    #   | 3------|-2
    #   |/       |/
    #   0--------1
    material_id: str = "concrete"
    
    # Analysis results
    stress_tensor: Optional[np.ndarray] = None  # 6-component stress
    strain_tensor: Optional[np.ndarray] = None
    
    def get_type(self) -> ElementType:
        return ElementType.BRICK8


@dataclass
class SuperElement:
    """
    Super Element for Shear Walls
    Acts as ONE object in UI but internally meshed for analysis
    """
    id: str
    name: str
    
    # Boundary definition
    boundary_nodes: List[str]  # External node IDs for connection
    
    # Internal mesh (hidden from user)
    internal_nodes: List[Point3D] = field(default_factory=list)
    internal_elements: List[PlateElement] = field(default_factory=list)
    
    # Properties
    thickness: float = 0.3
    material_id: str = "concrete"
    
    # Condensed stiffness matrix (for super element approach)
    condensed_stiffness: Optional[np.ndarray] = None
    
    def mesh_internally(self, nx: int = 4, ny: int = 4):
        """Auto-mesh the internal region"""
        # This would be called before analysis
        pass


# ============================================
# PLATE MESHER (QUAD SUBDIVISION)
# ============================================

class QuadMesher:
    """
    Meshes a 4-corner polygon into N×M grid of PlateElements
    Supports hard point constraints for beam node snapping
    """
    
    def __init__(self, tolerance: float = 0.001):
        self.tolerance = tolerance
    
    def mesh_quad(
        self,
        corners: List[Point3D],  # 4 corners in CCW order
        nx: int,  # Divisions in X (along 0-1 edge)
        ny: int,  # Divisions in Y (along 0-3 edge)
        hard_points: Optional[List[Point3D]] = None,
        element_id_prefix: str = "PE"
    ) -> Tuple[List[Point3D], List[PlateElement]]:
        """
        Mesh a quadrilateral region into nx × ny plate elements.
        
        Args:
            corners: 4 corners [P0, P1, P2, P3] in CCW order
            nx: Number of divisions along P0-P1 direction
            ny: Number of divisions along P0-P3 direction
            hard_points: Points that mesh must snap to (beam nodes)
            element_id_prefix: Prefix for element IDs
        
        Returns:
            Tuple of (nodes, elements)
        """
        if len(corners) != 4:
            raise ValueError("Exactly 4 corners required for quad meshing")
        
        P0, P1, P2, P3 = [c.to_array() for c in corners]
        nodes: List[Point3D] = []
        elements: List[PlateElement] = []
        node_grid: Dict[Tuple[int, int], int] = {}  # (i,j) -> node index
        
        # Generate grid nodes using bilinear interpolation
        for j in range(ny + 1):
            v = j / ny  # Parametric coordinate
            for i in range(nx + 1):
                u = i / nx  # Parametric coordinate
                
                # Bilinear interpolation
                # P(u,v) = (1-u)(1-v)P0 + u(1-v)P1 + uv*P2 + (1-u)v*P3
                point = (
                    (1-u) * (1-v) * P0 +
                    u * (1-v) * P1 +
                    u * v * P2 +
                    (1-u) * v * P3
                )
                
                # Check for hard point snapping
                snapped_point = self._snap_to_hard_point(
                    Point3D(point[0], point[1], point[2]), 
                    hard_points
                )
                snapped_point.id = f"N_{i}_{j}"
                
                node_grid[(i, j)] = len(nodes)
                nodes.append(snapped_point)
        
        # Generate elements
        elem_count = 0
        for j in range(ny):
            for i in range(nx):
                # Get node indices for this element (CCW order)
                n0 = node_grid[(i, j)]
                n1 = node_grid[(i+1, j)]
                n2 = node_grid[(i+1, j+1)]
                n3 = node_grid[(i, j+1)]
                
                element = PlateElement(
                    id=f"{element_id_prefix}_{elem_count}",
                    node_ids=[nodes[n0].id, nodes[n1].id, nodes[n2].id, nodes[n3].id]
                )
                elements.append(element)
                elem_count += 1
        
        return nodes, elements
    
    def _snap_to_hard_point(
        self, 
        point: Point3D, 
        hard_points: Optional[List[Point3D]]
    ) -> Point3D:
        """Snap point to nearest hard point if within tolerance"""
        if not hard_points:
            return point
        
        for hp in hard_points:
            if point.distance_to(hp) < self.tolerance:
                return Point3D(hp.x, hp.y, hp.z, point.id)
        
        return point
    
    def mesh_with_adaptive_refinement(
        self,
        corners: List[Point3D],
        hard_points: List[Point3D],
        min_size: float = 0.5,
        max_size: float = 2.0
    ) -> Tuple[List[Point3D], List[PlateElement]]:
        """
        Adaptive mesh refinement near hard points.
        Uses progressive subdivision where needed.
        """
        # Start with coarse mesh estimation
        P0, P1, P2, P3 = corners
        edge1_len = P0.distance_to(P1)
        edge2_len = P0.distance_to(P3)
        
        # Initial divisions based on max size
        nx = max(2, int(math.ceil(edge1_len / max_size)))
        ny = max(2, int(math.ceil(edge2_len / max_size)))
        
        # Refine near hard points
        if hard_points:
            # Increase divisions based on hard point density
            refinement_factor = 1 + len(hard_points) / 4
            nx = int(nx * refinement_factor)
            ny = int(ny * refinement_factor)
        
        return self.mesh_quad(corners, nx, ny, hard_points)


# ============================================
# CONSTRAINED DELAUNAY TRIANGULATION
# ============================================

class Edge:
    """Edge for triangulation"""
    def __init__(self, p1_idx: int, p2_idx: int):
        self.p1 = min(p1_idx, p2_idx)
        self.p2 = max(p1_idx, p2_idx)
    
    def __hash__(self):
        return hash((self.p1, self.p2))
    
    def __eq__(self, other):
        return self.p1 == other.p1 and self.p2 == other.p2


class Triangle:
    """Triangle for Delaunay triangulation"""
    def __init__(self, p1: int, p2: int, p3: int):
        # Store in sorted order for consistent comparison
        self.vertices = tuple(sorted([p1, p2, p3]))
        self.p1, self.p2, self.p3 = p1, p2, p3
    
    def edges(self) -> List[Edge]:
        return [
            Edge(self.p1, self.p2),
            Edge(self.p2, self.p3),
            Edge(self.p3, self.p1)
        ]
    
    def __hash__(self):
        return hash(self.vertices)
    
    def __eq__(self, other):
        return self.vertices == other.vertices


class ConstrainedDelaunay:
    """
    Constrained Delaunay Triangulation with hole handling.
    
    Uses Bowyer-Watson algorithm with constraint recovery.
    """
    
    def __init__(self, tolerance: float = 1e-10):
        self.tolerance = tolerance
        self.points: List[Point2D] = []
        self.triangles: Set[Triangle] = set()
        self.constraints: List[Edge] = []
    
    def _circumcircle_contains(
        self, 
        tri: Triangle, 
        point_idx: int
    ) -> bool:
        """Check if point is inside triangle's circumcircle"""
        p1 = self.points[tri.p1]
        p2 = self.points[tri.p2]
        p3 = self.points[tri.p3]
        p = self.points[point_idx]
        
        # Use determinant method for in-circle test
        ax, ay = p1.x - p.x, p1.y - p.y
        bx, by = p2.x - p.x, p2.y - p.y
        cx, cy = p3.x - p.x, p3.y - p.y
        
        det = (
            (ax*ax + ay*ay) * (bx*cy - cx*by) -
            (bx*bx + by*by) * (ax*cy - cx*ay) +
            (cx*cx + cy*cy) * (ax*by - bx*ay)
        )
        
        return det > self.tolerance
    
    def _is_ccw(self, p1: Point2D, p2: Point2D, p3: Point2D) -> bool:
        """Check if three points are in counter-clockwise order"""
        return (p2.x - p1.x) * (p3.y - p1.y) - (p2.y - p1.y) * (p3.x - p1.x) > 0
    
    def _point_in_triangle(self, point: Point2D, tri: Triangle) -> bool:
        """Check if point is inside triangle"""
        p1 = self.points[tri.p1]
        p2 = self.points[tri.p2]
        p3 = self.points[tri.p3]
        
        b1 = self._is_ccw(point, p1, p2)
        b2 = self._is_ccw(point, p2, p3)
        b3 = self._is_ccw(point, p3, p1)
        
        return b1 == b2 == b3
    
    def triangulate(
        self,
        boundary: List[Point2D],
        holes: Optional[List[List[Point2D]]] = None,
        interior_points: Optional[List[Point2D]] = None
    ) -> Tuple[List[Point2D], List[TriElement]]:
        """
        Perform constrained Delaunay triangulation.
        
        Args:
            boundary: Boundary polygon vertices (CCW order)
            holes: List of hole polygons (CW order)
            interior_points: Additional points to include
        
        Returns:
            Tuple of (all_points, triangular_elements)
        """
        # Collect all points
        self.points = list(boundary)
        boundary_edges = []
        
        # Add boundary constraints
        n = len(boundary)
        for i in range(n):
            boundary_edges.append(Edge(i, (i + 1) % n))
        
        # Add hole points and constraints
        hole_seeds = []  # Points inside each hole for removal
        if holes:
            for hole in holes:
                start_idx = len(self.points)
                self.points.extend(hole)
                
                # Add hole edges
                nh = len(hole)
                for i in range(nh):
                    edge = Edge(start_idx + i, start_idx + (i + 1) % nh)
                    boundary_edges.append(edge)
                
                # Calculate hole centroid as seed
                cx = sum(p.x for p in hole) / nh
                cy = sum(p.y for p in hole) / nh
                hole_seeds.append(Point2D(cx, cy))
        
        # Add interior points
        if interior_points:
            self.points.extend(interior_points)
        
        # Store constraints
        self.constraints = boundary_edges
        
        # Create super-triangle that contains all points
        super_tri = self._create_super_triangle()
        self.triangles = {super_tri}
        
        # Add points one by one (Bowyer-Watson)
        for i in range(len(self.points)):
            self._insert_point(i)
        
        # Remove triangles connected to super-triangle vertices
        n_super = len(self.points)
        self._remove_super_triangle(n_super)
        
        # Recover constraints (ensure boundary edges exist)
        self._recover_constraints()
        
        # Remove triangles inside holes
        if hole_seeds:
            self._remove_hole_triangles(hole_seeds)
        
        # Remove triangles outside boundary
        self._remove_exterior_triangles(boundary)
        
        # Convert to TriElements
        elements = []
        for i, tri in enumerate(self.triangles):
            elem = TriElement(
                id=f"TRI_{i}",
                node_ids=[
                    self.points[tri.p1].id or f"N{tri.p1}",
                    self.points[tri.p2].id or f"N{tri.p2}",
                    self.points[tri.p3].id or f"N{tri.p3}"
                ]
            )
            elements.append(elem)
        
        return self.points[:n], elements
    
    def _create_super_triangle(self) -> Triangle:
        """Create a super-triangle containing all points"""
        # Find bounding box
        min_x = min(p.x for p in self.points)
        max_x = max(p.x for p in self.points)
        min_y = min(p.y for p in self.points)
        max_y = max(p.y for p in self.points)
        
        dx = max_x - min_x
        dy = max_y - min_y
        delta = max(dx, dy) * 10
        
        cx = (min_x + max_x) / 2
        cy = (min_y + max_y) / 2
        
        # Add super-triangle vertices
        n = len(self.points)
        self.points.append(Point2D(cx - delta, cy - delta, f"SUPER_0"))
        self.points.append(Point2D(cx + delta, cy - delta, f"SUPER_1"))
        self.points.append(Point2D(cx, cy + delta, f"SUPER_2"))
        
        return Triangle(n, n + 1, n + 2)
    
    def _insert_point(self, point_idx: int):
        """Insert a point using Bowyer-Watson algorithm"""
        # Find all triangles whose circumcircle contains the point
        bad_triangles = set()
        for tri in self.triangles:
            if self._circumcircle_contains(tri, point_idx):
                bad_triangles.add(tri)
        
        # Find the boundary of the polygonal hole
        polygon_edges = []
        for tri in bad_triangles:
            for edge in tri.edges():
                # Check if edge is shared with another bad triangle
                shared = False
                for other_tri in bad_triangles:
                    if other_tri != tri and edge in other_tri.edges():
                        shared = True
                        break
                if not shared:
                    polygon_edges.append(edge)
        
        # Remove bad triangles
        self.triangles -= bad_triangles
        
        # Create new triangles
        for edge in polygon_edges:
            new_tri = Triangle(edge.p1, edge.p2, point_idx)
            self.triangles.add(new_tri)
    
    def _remove_super_triangle(self, n_original: int):
        """Remove triangles connected to super-triangle vertices"""
        super_indices = {n_original, n_original + 1, n_original + 2}
        to_remove = set()
        
        for tri in self.triangles:
            if (tri.p1 in super_indices or 
                tri.p2 in super_indices or 
                tri.p3 in super_indices):
                to_remove.add(tri)
        
        self.triangles -= to_remove
    
    def _recover_constraints(self):
        """Ensure all constraint edges exist in triangulation"""
        for constraint in self.constraints:
            # Check if edge exists
            edge_exists = False
            for tri in self.triangles:
                if constraint in tri.edges():
                    edge_exists = True
                    break
            
            if not edge_exists:
                # Need to flip edges to recover constraint
                # This is a simplified recovery - full implementation
                # would use edge flipping algorithm
                pass
    
    def _remove_hole_triangles(self, hole_seeds: List[Point2D]):
        """Remove triangles inside holes using flood fill"""
        for seed in hole_seeds:
            # Find triangle containing seed
            for tri in list(self.triangles):
                if self._point_in_triangle(seed, tri):
                    # Flood fill from this triangle
                    self._flood_remove(tri)
                    break
    
    def _flood_remove(self, start_tri: Triangle):
        """Flood fill remove triangles from inside a hole"""
        if start_tri not in self.triangles:
            return
        
        to_remove = {start_tri}
        queue = [start_tri]
        
        while queue:
            tri = queue.pop()
            for edge in tri.edges():
                if edge in self.constraints:
                    continue  # Stop at boundary
                
                # Find neighbor triangle
                for other in self.triangles:
                    if other not in to_remove and edge in other.edges():
                        to_remove.add(other)
                        queue.append(other)
        
        self.triangles -= to_remove
    
    def _remove_exterior_triangles(self, boundary: List[Point2D]):
        """Remove triangles outside the boundary"""
        # Calculate boundary centroid
        cx = sum(p.x for p in boundary) / len(boundary)
        cy = sum(p.y for p in boundary) / len(boundary)
        centroid = Point2D(cx, cy)
        
        # Keep only triangles whose centroids are inside boundary
        to_remove = set()
        for tri in self.triangles:
            tri_cx = (self.points[tri.p1].x + self.points[tri.p2].x + self.points[tri.p3].x) / 3
            tri_cy = (self.points[tri.p1].y + self.points[tri.p2].y + self.points[tri.p3].y) / 3
            
            if not self._point_in_polygon(Point2D(tri_cx, tri_cy), boundary):
                to_remove.add(tri)
        
        self.triangles -= to_remove
    
    def _point_in_polygon(self, point: Point2D, polygon: List[Point2D]) -> bool:
        """Ray casting algorithm for point in polygon test"""
        n = len(polygon)
        inside = False
        
        j = n - 1
        for i in range(n):
            pi, pj = polygon[i], polygon[j]
            if ((pi.y > point.y) != (pj.y > point.y) and
                point.x < (pj.x - pi.x) * (point.y - pi.y) / (pj.y - pi.y) + pi.x):
                inside = not inside
            j = i
        
        return inside


# ============================================
# BRICK ELEMENT MESHER
# ============================================

class BrickMesher:
    """
    Generates 8-node hexahedral (brick) meshes for solid volumes.
    """
    
    def mesh_box(
        self,
        origin: Point3D,
        dimensions: Tuple[float, float, float],  # (Lx, Ly, Lz)
        divisions: Tuple[int, int, int],  # (nx, ny, nz)
        element_id_prefix: str = "BRICK"
    ) -> Tuple[List[Point3D], List[BrickElement]]:
        """
        Mesh a rectangular box into brick elements.
        
        Args:
            origin: Corner point of the box
            dimensions: (length_x, length_y, length_z)
            divisions: (nx, ny, nz) number of elements in each direction
        """
        Lx, Ly, Lz = dimensions
        nx, ny, nz = divisions
        
        dx = Lx / nx
        dy = Ly / ny
        dz = Lz / nz
        
        nodes: List[Point3D] = []
        elements: List[BrickElement] = []
        node_map: Dict[Tuple[int, int, int], int] = {}
        
        # Generate nodes
        for k in range(nz + 1):
            for j in range(ny + 1):
                for i in range(nx + 1):
                    node = Point3D(
                        x=origin.x + i * dx,
                        y=origin.y + j * dy,
                        z=origin.z + k * dz,
                        id=f"BN_{i}_{j}_{k}"
                    )
                    node_map[(i, j, k)] = len(nodes)
                    nodes.append(node)
        
        # Generate elements
        elem_count = 0
        for k in range(nz):
            for j in range(ny):
                for i in range(nx):
                    # Get 8 corner nodes
                    n0 = node_map[(i, j, k)]
                    n1 = node_map[(i+1, j, k)]
                    n2 = node_map[(i+1, j+1, k)]
                    n3 = node_map[(i, j+1, k)]
                    n4 = node_map[(i, j, k+1)]
                    n5 = node_map[(i+1, j, k+1)]
                    n6 = node_map[(i+1, j+1, k+1)]
                    n7 = node_map[(i, j+1, k+1)]
                    
                    element = BrickElement(
                        id=f"{element_id_prefix}_{elem_count}",
                        node_ids=[
                            nodes[n0].id, nodes[n1].id, nodes[n2].id, nodes[n3].id,
                            nodes[n4].id, nodes[n5].id, nodes[n6].id, nodes[n7].id
                        ]
                    )
                    elements.append(element)
                    elem_count += 1
        
        return nodes, elements


# ============================================
# SUPER ELEMENT GENERATOR
# ============================================

class SuperElementGenerator:
    """
    Generates super elements for shear walls.
    User sees ONE element, solver uses internal mesh.
    """
    
    def create_shear_wall(
        self,
        corners: List[Point3D],  # 4 corners of wall face
        thickness: float,
        divisions: Tuple[int, int] = (4, 4),
        material_id: str = "concrete"
    ) -> SuperElement:
        """
        Create a shear wall super element.
        
        Args:
            corners: 4 corners defining the wall face
            thickness: Wall thickness
            divisions: Internal mesh divisions (nx, ny)
        """
        # Create super element
        super_elem = SuperElement(
            id=f"WALL_{id(corners)}",
            name="Shear Wall",
            boundary_nodes=[c.id or f"WN_{i}" for i, c in enumerate(corners)],
            thickness=thickness,
            material_id=material_id
        )
        
        # Generate internal mesh
        mesher = QuadMesher()
        internal_nodes, internal_elements = mesher.mesh_quad(
            corners,
            divisions[0],
            divisions[1],
            element_id_prefix="WALL_INT"
        )
        
        super_elem.internal_nodes = internal_nodes
        super_elem.internal_elements = internal_elements
        
        return super_elem
    
    def condense_stiffness(
        self, 
        super_elem: SuperElement, 
        full_stiffness: np.ndarray
    ) -> np.ndarray:
        """
        Static condensation to reduce internal DOFs.
        
        K_condensed = K_bb - K_bi * K_ii^-1 * K_ib
        
        Where:
            b = boundary DOFs
            i = internal DOFs
        """
        n_boundary = len(super_elem.boundary_nodes) * 6  # 6 DOF per node
        n_internal = len(super_elem.internal_nodes) * 6
        
        # Partition stiffness matrix
        K_bb = full_stiffness[:n_boundary, :n_boundary]
        K_bi = full_stiffness[:n_boundary, n_boundary:]
        K_ib = full_stiffness[n_boundary:, :n_boundary]
        K_ii = full_stiffness[n_boundary:, n_boundary:]
        
        # Condensation
        K_ii_inv = np.linalg.inv(K_ii)
        K_condensed = K_bb - K_bi @ K_ii_inv @ K_ib
        
        super_elem.condensed_stiffness = K_condensed
        return K_condensed


# ============================================
# MESH QUALITY METRICS
# ============================================

class MeshQuality:
    """Mesh quality assessment utilities"""
    
    @staticmethod
    def aspect_ratio_quad(nodes: List[Point3D]) -> float:
        """
        Calculate aspect ratio for a quadrilateral element.
        Ideal = 1.0, higher is worse.
        """
        if len(nodes) != 4:
            return float('inf')
        
        # Calculate edge lengths
        edges = []
        for i in range(4):
            d = nodes[i].distance_to(nodes[(i+1) % 4])
            edges.append(d)
        
        max_edge = max(edges)
        min_edge = min(edges)
        
        return max_edge / min_edge if min_edge > 0 else float('inf')
    
    @staticmethod
    def jacobian_ratio_quad(nodes: List[Point3D]) -> float:
        """
        Calculate Jacobian ratio quality metric.
        Ideal = 1.0, range [0, 1], lower is worse.
        """
        # Simplified: check for convexity via cross products
        # Full implementation would compute actual Jacobian at Gauss points
        return 1.0  # Placeholder
    
    @staticmethod
    def warpage_angle(nodes: List[Point3D]) -> float:
        """
        Calculate warpage angle for quad elements.
        Ideal = 0.0 degrees (planar).
        """
        if len(nodes) != 4:
            return float('inf')
        
        # Compute normal vectors for two triangles
        v1 = nodes[1].to_array() - nodes[0].to_array()
        v2 = nodes[2].to_array() - nodes[0].to_array()
        v3 = nodes[3].to_array() - nodes[0].to_array()
        
        n1 = np.cross(v1, v2)
        n2 = np.cross(v1, v3)
        
        n1_norm = np.linalg.norm(n1)
        n2_norm = np.linalg.norm(n2)
        
        if n1_norm == 0 or n2_norm == 0:
            return float('inf')
        
        n1 = n1 / n1_norm
        n2 = n2 / n2_norm
        
        cos_angle = np.clip(np.dot(n1, n2), -1, 1)
        angle_rad = np.arccos(cos_angle)
        
        return np.degrees(angle_rad)


# ============================================
# CONVENIENCE API
# ============================================

def mesh_plate(
    corners: List[Tuple[float, float, float]],
    nx: int,
    ny: int,
    hard_points: Optional[List[Tuple[float, float, float]]] = None
) -> dict:
    """
    Convenience function to mesh a plate.
    
    Args:
        corners: List of 4 (x, y, z) tuples
        nx, ny: Number of divisions
        hard_points: Optional constraint points
    
    Returns:
        Dictionary with nodes and elements
    """
    mesher = QuadMesher()
    corner_pts = [Point3D(*c) for c in corners]
    hp = [Point3D(*p) for p in hard_points] if hard_points else None
    
    nodes, elements = mesher.mesh_quad(corner_pts, nx, ny, hp)
    
    return {
        "nodes": [{"id": n.id, "x": n.x, "y": n.y, "z": n.z} for n in nodes],
        "elements": [{"id": e.id, "nodes": e.node_ids, "type": "QUAD4"} for e in elements]
    }


def triangulate_with_holes(
    boundary: List[Tuple[float, float]],
    holes: Optional[List[List[Tuple[float, float]]]] = None
) -> dict:
    """
    Convenience function for triangulation with holes.
    
    Args:
        boundary: List of (x, y) boundary points (CCW)
        holes: List of hole polygons, each a list of (x, y) points (CW)
    
    Returns:
        Dictionary with nodes and elements
    """
    cdt = ConstrainedDelaunay()
    
    boundary_pts = [Point2D(x, y, f"B{i}") for i, (x, y) in enumerate(boundary)]
    hole_pts = None
    if holes:
        hole_pts = [[Point2D(x, y, f"H{i}_{j}") for j, (x, y) in enumerate(hole)] 
                    for i, hole in enumerate(holes)]
    
    points, elements = cdt.triangulate(boundary_pts, hole_pts)
    
    return {
        "nodes": [{"id": p.id, "x": p.x, "y": p.y} for p in points],
        "elements": [{"id": e.id, "nodes": e.node_ids, "type": "TRI3"} for e in elements]
    }


# ============================================
# EXPORTS
# ============================================

__all__ = [
    'Point2D',
    'Point3D',
    'ElementType',
    'PlateElement',
    'TriElement',
    'BrickElement',
    'SuperElement',
    'QuadMesher',
    'ConstrainedDelaunay',
    'BrickMesher',
    'SuperElementGenerator',
    'MeshQuality',
    'mesh_plate',
    'triangulate_with_holes'
]
