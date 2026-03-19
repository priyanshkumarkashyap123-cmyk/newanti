"""
nonlinear.py - P-Delta & Geometric Stiffness Solver

Implements second-order (geometric non-linear) analysis:
- Geometric Stiffness Matrix [Kg] construction
- Iterative P-Delta solution with convergence check
- Large Delta (sway) and Small Delta (member) effects

Theory:
    P-Delta accounts for the destabilizing effect of axial loads on 
    lateral stiffness. The equilibrium equation becomes:
    
    ([Ke] + [Kg]) * {d} = {F}
    
    Where [Kg] is the geometric stiffness matrix that depends on 
    the current axial forces in members.
"""

from dataclasses import dataclass, field
from typing import List, Dict, Optional, Tuple, Callable
from enum import Enum
import numpy as np
from scipy import sparse
from scipy.sparse import linalg as sparse_linalg
import math


# ============================================
# DATA STRUCTURES
# ============================================

@dataclass
class Node:
    """Node with 6 DOF per node"""
    id: str
    x: float
    y: float
    z: float
    # DOF indices (assigned during assembly)
    dof_indices: Optional[List[int]] = None
    # Support constraints (True = restrained)
    supports: Optional[List[bool]] = None  # [dx, dy, dz, rx, ry, rz]


@dataclass
class Member:
    """
    Beam-column member with 12 DOF (6 per node)
    
    Supports both Euler-Bernoulli (default) and Timoshenko beam theory.
    For Timoshenko, provide shear areas Asy and Asz.
    """
    id: str
    start_node_id: str
    end_node_id: str
    # Material properties
    E: float = 200e9      # Young's modulus (Pa)
    G: float = 77e9       # Shear modulus (Pa)
    # Section properties
    A: float = 0.01       # Area (m²)
    Iy: float = 1e-4      # Moment of inertia about local y (m⁴)
    Iz: float = 1e-4      # Moment of inertia about local z (m⁴)
    J: float = 1e-5       # Torsional constant (m⁴)
    # Shear areas for Timoshenko beam theory (optional)
    # If None, Euler-Bernoulli (no shear deformation) is used
    Asy: Optional[float] = None  # Shear area in y-direction (m²)
    Asz: Optional[float] = None  # Shear area in z-direction (m²)
    # Current axial force (updated during P-Delta iteration)
    axial_force: float = 0.0  # Compression positive
    
    # Shear correction factors (default for rectangles ≈ 5/6)
    kappa_y: float = 5.0/6.0  # Shear correction factor y
    kappa_z: float = 5.0/6.0  # Shear correction factor z
    
    def get_effective_shear_area_y(self) -> float:
        """Get effective shear area for y-direction, with correction factor"""
        # If Asy is provided, assume it is the effective shear area (already
        # includes the shear correction factor). Otherwise return None so
        # callers can detect absence of shear area and treat this as
        # Euler-Bernoulli (no shear deformation).
        if self.Asy is not None:
            return self.Asy
        return None
    
    def get_effective_shear_area_z(self) -> float:
        """Get effective shear area for z-direction, with correction factor"""
        # If Asz is provided, assume it is the effective shear area (already
        # includes the shear correction factor). Otherwise return None.
        if self.Asz is not None:
            return self.Asz
        return None


@dataclass
class ConvergenceResult:
    """Convergence check result"""
    converged: bool
    iterations: int
    max_displacement_change: float
    residual_norm: float


@dataclass
class PDeltaResult:
    """Complete P-Delta analysis result"""
    success: bool
    convergence: ConvergenceResult
    displacements: Dict[str, Dict[str, float]]  # node_id -> {dx, dy, dz, rx, ry, rz}
    member_forces: Dict[str, Dict[str, float]]  # member_id -> {P, Vy, Vz, T, My, Mz}
    reactions: Dict[str, Dict[str, float]]      # node_id -> reaction forces
    amplification_factors: Dict[str, float]     # member_id -> P-delta amplification
    error_message: Optional[str] = None


# ============================================
# GEOMETRIC STIFFNESS MATRIX
# ============================================

class GeometricStiffnessMatrix:
    """
    Constructs the Geometric Stiffness Matrix [Kg] for beam-column elements.
    
    The geometric stiffness matrix accounts for the effect of axial force
    on the lateral stiffness of the member. For a compression member,
    the axial force reduces the effective lateral stiffness.
    
    Reference: Matrix Analysis of Structures, Kassimali
    """
    
    @staticmethod
    def get_member_Kg_local(length: float, axial_force: float) -> np.ndarray:
        """
        Compute 12x12 geometric stiffness matrix in local coordinates.
        
        The geometric stiffness matrix for a beam-column element is:
        [Kg] = (P/L) * [...]
        
        Where P is the axial force (compression positive).
        
        Args:
            length: Member length (m)
            axial_force: Axial force (N), compression positive
            
        Returns:
            12x12 geometric stiffness matrix in local coordinates
        """
        P = axial_force
        L = length
        
        if abs(L) < 1e-10:
            return np.zeros((12, 12))
        
        # Coefficients
        c1 = P / L
        c2 = P / 10
        c3 = P * L / 30
        c4 = 6 * P / (5 * L)
        c5 = P / 10
        c6 = 2 * P * L / 15
        c7 = -P * L / 30
        
        # 12x12 geometric stiffness matrix
        # DOF order: [dx1, dy1, dz1, rx1, ry1, rz1, dx2, dy2, dz2, rx2, ry2, rz2]
        Kg = np.zeros((12, 12))
        
        # Lateral y-direction (bending about z-axis)
        # Row 2 (dy1)
        Kg[1, 1] = c4
        Kg[1, 5] = c5
        Kg[1, 7] = -c4
        Kg[1, 11] = c5
        
        # Row 6 (rz1)
        Kg[5, 1] = c5
        Kg[5, 5] = c6
        Kg[5, 7] = -c5
        Kg[5, 11] = c7
        
        # Row 8 (dy2)
        Kg[7, 1] = -c4
        Kg[7, 5] = -c5
        Kg[7, 7] = c4
        Kg[7, 11] = -c5
        
        # Row 12 (rz2)
        Kg[11, 1] = c5
        Kg[11, 5] = c7
        Kg[11, 7] = -c5
        Kg[11, 11] = c6
        
        # Lateral z-direction (bending about y-axis)
        # Row 3 (dz1)
        Kg[2, 2] = c4
        Kg[2, 4] = -c5
        Kg[2, 8] = -c4
        Kg[2, 10] = -c5
        
        # Row 5 (ry1)
        Kg[4, 2] = -c5
        Kg[4, 4] = c6
        Kg[4, 8] = c5
        Kg[4, 10] = c7
        
        # Row 9 (dz2)
        Kg[8, 2] = -c4
        Kg[8, 4] = c5
        Kg[8, 8] = c4
        Kg[8, 10] = c5
        
        # Row 11 (ry2)
        Kg[10, 2] = -c5
        Kg[10, 4] = c7
        Kg[10, 8] = c5
        Kg[10, 10] = c6
        
        return Kg
    
    @staticmethod
    def get_transformation_matrix(
        start: Tuple[float, float, float],
        end: Tuple[float, float, float]
    ) -> np.ndarray:
        """
        Compute 12x12 transformation matrix from local to global coordinates.
        
        Args:
            start: Start node coordinates (x, y, z)
            end: End node coordinates (x, y, z)
            
        Returns:
            12x12 transformation matrix [T]
        """
        dx = end[0] - start[0]
        dy = end[1] - start[1]
        dz = end[2] - start[2]
        L = math.sqrt(dx*dx + dy*dy + dz*dz)
        
        if L < 1e-10:
            return np.eye(12)
        
        # Direction cosines for local x-axis (along member)
        cx = dx / L
        cy = dy / L
        cz = dz / L
        
        # Local y and z axes (using a reference vector)
        # If member is vertical, use global X as reference
        if abs(cy) > 0.999:
            # Nearly vertical member
            ref = np.array([1.0, 0.0, 0.0])
        else:
            # Use global Y as reference
            ref = np.array([0.0, 1.0, 0.0])
        
        local_x = np.array([cx, cy, cz])
        local_z = np.cross(local_x, ref)
        local_z = local_z / np.linalg.norm(local_z)
        local_y = np.cross(local_z, local_x)
        
        # 3x3 rotation matrix
        R = np.array([local_x, local_y, local_z])
        
        # Build 12x12 transformation matrix
        T = np.zeros((12, 12))
        T[0:3, 0:3] = R
        T[3:6, 3:6] = R
        T[6:9, 6:9] = R
        T[9:12, 9:12] = R
        
        return T
    
    @staticmethod
    def get_member_Kg_global(
        length: float,
        axial_force: float,
        start: Tuple[float, float, float],
        end: Tuple[float, float, float]
    ) -> np.ndarray:
        """
        Compute 12x12 geometric stiffness matrix in global coordinates.
        
        [Kg_global] = [T]^T * [Kg_local] * [T]
        """
        Kg_local = GeometricStiffnessMatrix.get_member_Kg_local(length, axial_force)
        T = GeometricStiffnessMatrix.get_transformation_matrix(start, end)
        
        return T.T @ Kg_local @ T


# ============================================
# P-DELTA ANALYZER
# ============================================

class PDeltaAnalyzer:
    """
    Iterative P-Delta Analysis Solver
    
    Algorithm:
    1. Solve linear system: [Ke] * {d0} = {F}
    2. Extract axial forces from d0
    3. Build [Kg] from axial forces
    4. Solve: ([Ke] + [Kg]) * {d1} = {F}
    5. Check convergence (|d1 - d0| / |d1|)
    6. If not converged, update axial forces and repeat from step 3
    """
    
    def __init__(
        self,
        nodes: List[Node],
        members: List[Member],
        max_iterations: int = 15,
        tolerance: float = 1e-4
    ):
        self.nodes = {n.id: n for n in nodes}
        self.members = {m.id: m for m in members}
        self.max_iterations = max_iterations
        self.tolerance = tolerance
        
        # DOF numbering
        self.n_dof = 0
        self.free_dof: List[int] = []
        self.fixed_dof: List[int] = []
        
        self._assign_dof()
    
    def _assign_dof(self) -> None:
        """Assign DOF indices to nodes"""
        dof_counter = 0
        
        for node in self.nodes.values():
            node.dof_indices = list(range(dof_counter, dof_counter + 6))
            dof_counter += 6
            
            # Classify DOF as free or fixed
            supports = node.supports or [False] * 6
            for i, is_fixed in enumerate(supports):
                if is_fixed:
                    self.fixed_dof.append(node.dof_indices[i])
                else:
                    self.free_dof.append(node.dof_indices[i])
        
        self.n_dof = dof_counter
    
    def _get_member_length(self, member: Member) -> float:
        """Calculate member length"""
        start = self.nodes[member.start_node_id]
        end = self.nodes[member.end_node_id]
        return math.sqrt(
            (end.x - start.x)**2 +
            (end.y - start.y)**2 +
            (end.z - start.z)**2
        )
    
    def _get_elastic_stiffness_matrix(self) -> np.ndarray:
        """Assemble global elastic stiffness matrix [Ke]"""
        K = np.zeros((self.n_dof, self.n_dof))
        
        for member in self.members.values():
            Ke_global = self._get_member_Ke_global(member)
            
            # Assembly
            start_node = self.nodes[member.start_node_id]
            end_node = self.nodes[member.end_node_id]
            dofs = start_node.dof_indices + end_node.dof_indices
            
            for i, gi in enumerate(dofs):
                for j, gj in enumerate(dofs):
                    K[gi, gj] += Ke_global[i, j]
        
        return K
    
    def _get_member_Ke_local(self, member: Member) -> np.ndarray:
        """
        Build 12x12 elastic stiffness matrix in local coordinates.
        
        Supports:
        - Euler-Bernoulli beam theory (default, no shear deformation)
        - Timoshenko beam theory (with shear deformation)
        
        For Timoshenko, shear areas Asy/Asz must be provided.
        The shear deformation parameter φ modifies the bending stiffness.
        """
        E = member.E
        G = member.G
        A = member.A
        Iy = member.Iy
        Iz = member.Iz
        J = member.J
        L = self._get_member_length(member)
        
        if L < 1e-10:
            return np.zeros((12, 12))
        
        # ============================================
        # Calculate shear deformation factors
        # φ = 12*E*I / (G*As*L²)
        # When φ = 0, this reduces to Euler-Bernoulli
        # ============================================
        
        # Shear deformation parameter for bending about z (shear in y)
        Asy = member.get_effective_shear_area_y() if hasattr(member, 'get_effective_shear_area_y') else None
        if Asy is None:
            Asy = member.Asy
        
        if Asy is not None and Asy > 0 and G > 0:
            phi_z = 12 * E * Iz / (G * Asy * L**2)
        else:
            phi_z = 0.0  # Euler-Bernoulli (no shear deformation)
        
        # Shear deformation parameter for bending about y (shear in z)
        Asz = member.get_effective_shear_area_z() if hasattr(member, 'get_effective_shear_area_z') else None
        if Asz is None:
            Asz = member.Asz
            
        if Asz is not None and Asz > 0 and G > 0:
            phi_y = 12 * E * Iy / (G * Asz * L**2)
        else:
            phi_y = 0.0  # Euler-Bernoulli (no shear deformation)
        
        # ============================================
        # Stiffness coefficients (Timoshenko beam)
        # Reference: Przemieniecki, Theory of Matrix Structural Analysis
        # ============================================
        
        # Axial
        k1 = E * A / L
        
        # Torsion
        k10 = G * J / L
        
        # Bending about z-axis (shear in y-direction)
        # Modified for shear deformation with factor (1 + φ_z)
        denom_z = (1 + phi_z)
        k2 = 12 * E * Iz / (L**3 * denom_z)   # Shear
        k3 = 6 * E * Iz / (L**2 * denom_z)    # Shear-rotation coupling
        k4 = (4 + phi_z) * E * Iz / (L * denom_z)  # Rotation
        k5 = (2 - phi_z) * E * Iz / (L * denom_z)  # Cross-rotation
        
        # Bending about y-axis (shear in z-direction)
        denom_y = (1 + phi_y)
        k6 = 12 * E * Iy / (L**3 * denom_y)   # Shear
        k7 = 6 * E * Iy / (L**2 * denom_y)    # Shear-rotation coupling
        k8 = (4 + phi_y) * E * Iy / (L * denom_y)  # Rotation
        k9 = (2 - phi_y) * E * Iy / (L * denom_y)  # Cross-rotation
        
        Ke = np.zeros((12, 12))
        
        # Axial stiffness
        Ke[0, 0] = k1
        Ke[0, 6] = -k1
        Ke[6, 0] = -k1
        Ke[6, 6] = k1
        
        # Bending about z (in y direction) - with Timoshenko modification
        Ke[1, 1] = k2
        Ke[1, 5] = k3
        Ke[1, 7] = -k2
        Ke[1, 11] = k3
        
        Ke[5, 1] = k3
        Ke[5, 5] = k4
        Ke[5, 7] = -k3
        Ke[5, 11] = k5
        
        Ke[7, 1] = -k2
        Ke[7, 5] = -k3
        Ke[7, 7] = k2
        Ke[7, 11] = -k3
        
        Ke[11, 1] = k3
        Ke[11, 5] = k5
        Ke[11, 7] = -k3
        Ke[11, 11] = k4
        
        # Bending about y (in z direction) - with Timoshenko modification
        Ke[2, 2] = k6
        Ke[2, 4] = -k7
        Ke[2, 8] = -k6
        Ke[2, 10] = -k7
        
        Ke[4, 2] = -k7
        Ke[4, 4] = k8
        Ke[4, 8] = k7
        Ke[4, 10] = k9
        
        Ke[8, 2] = -k6
        Ke[8, 4] = k7
        Ke[8, 8] = k6
        Ke[8, 10] = k7
        
        Ke[10, 2] = -k7
        Ke[10, 4] = k9
        Ke[10, 8] = k7
        Ke[10, 10] = k8
        
        # Torsion
        Ke[3, 3] = k10
        Ke[3, 9] = -k10
        Ke[9, 3] = -k10
        Ke[9, 9] = k10
        
        return Ke
    
    def _get_member_Ke_global(self, member: Member) -> np.ndarray:
        """Transform elastic stiffness to global coordinates"""
        start = self.nodes[member.start_node_id]
        end = self.nodes[member.end_node_id]
        
        Ke_local = self._get_member_Ke_local(member)
        T = GeometricStiffnessMatrix.get_transformation_matrix(
            (start.x, start.y, start.z),
            (end.x, end.y, end.z)
        )
        
        return T.T @ Ke_local @ T
    
    def _get_geometric_stiffness_matrix(self) -> np.ndarray:
        """Assemble global geometric stiffness matrix [Kg]"""
        Kg = np.zeros((self.n_dof, self.n_dof))
        
        for member in self.members.values():
            start = self.nodes[member.start_node_id]
            end = self.nodes[member.end_node_id]
            length = self._get_member_length(member)
            
            Kg_global = GeometricStiffnessMatrix.get_member_Kg_global(
                length,
                member.axial_force,
                (start.x, start.y, start.z),
                (end.x, end.y, end.z)
            )
            
            # Assembly
            dofs = start.dof_indices + end.dof_indices
            
            for i, gi in enumerate(dofs):
                for j, gj in enumerate(dofs):
                    Kg[gi, gj] += Kg_global[i, j]
        
        return Kg
    
    def _extract_submatrix(self, K: np.ndarray) -> np.ndarray:
        """Extract free DOF submatrix"""
        return K[np.ix_(self.free_dof, self.free_dof)]
    
    def _extract_axial_forces(self, displacements: np.ndarray) -> None:
        """Update member axial forces from displacements"""
        for member in self.members.values():
            start = self.nodes[member.start_node_id]
            end = self.nodes[member.end_node_id]
            L = self._get_member_length(member)
            
            if L < 1e-10:
                continue
            
            # Get nodal displacements
            d_start = displacements[start.dof_indices]
            d_end = displacements[end.dof_indices]
            d_member = np.concatenate([d_start, d_end])
            
            # Transform to local coordinates
            T = GeometricStiffnessMatrix.get_transformation_matrix(
                (start.x, start.y, start.z),
                (end.x, end.y, end.z)
            )
            d_local = T @ d_member
            
            # Axial deformation = (u2 - u1)
            axial_strain = (d_local[6] - d_local[0]) / L
            member.axial_force = member.E * member.A * axial_strain
    
    def analyze(
        self,
        force_vector: np.ndarray,
        include_small_delta: bool = True,
        include_large_delta: bool = True
    ) -> PDeltaResult:
        """
        Perform iterative P-Delta analysis.
        
        Args:
            force_vector: Global force vector (length = n_dof)
            include_small_delta: Include member P-small-delta effects
            include_large_delta: Include structure P-large-delta effects
            
        Returns:
            PDeltaResult with converged displacements and forces
        """
        if not include_small_delta and not include_large_delta:
            # Linear analysis only
            return self._linear_analysis(force_vector)
        
        # Get elastic stiffness matrix
        Ke = self._get_elastic_stiffness_matrix()
        
        # Initial linear solution
        Ke_ff = self._extract_submatrix(Ke)
        F_f = force_vector[self.free_dof]
        
        try:
            d_f = np.linalg.solve(Ke_ff, F_f)
        except np.linalg.LinAlgError:
            return PDeltaResult(
                success=False,
                convergence=ConvergenceResult(False, 0, 0, 0),
                displacements={},
                member_forces={},
                reactions={},
                amplification_factors={},
                error_message="Initial linear solve failed - structure may be unstable"
            )
        
        # Full displacement vector
        d = np.zeros(self.n_dof)
        d[self.free_dof] = d_f
        
        # Extract initial axial forces
        self._extract_axial_forces(d)
        
        # Store initial displacements for amplification factor
        d_initial = d.copy()
        
        # Iterative P-Delta loop
        converged = False
        iteration = 0
        d_prev = d.copy()
        
        while iteration < self.max_iterations:
            iteration += 1
            
            # Build geometric stiffness matrix
            Kg = self._get_geometric_stiffness_matrix()
            
            # Combined stiffness: [Ke] + [Kg]
            K_combined = Ke + Kg
            
            # Solve reduced system
            K_ff = self._extract_submatrix(K_combined)
            
            try:
                d_f = np.linalg.solve(K_ff, F_f)
            except np.linalg.LinAlgError:
                return PDeltaResult(
                    success=False,
                    convergence=ConvergenceResult(False, iteration, 0, 0),
                    displacements={},
                    member_forces={},
                    reactions={},
                    amplification_factors={},
                    error_message=f"P-Delta solve failed at iteration {iteration} - structure may be buckling"
                )
            
            d = np.zeros(self.n_dof)
            d[self.free_dof] = d_f
            
            # Update axial forces
            self._extract_axial_forces(d)
            
            # Convergence check
            displacement_change = np.linalg.norm(d - d_prev)
            displacement_norm = np.linalg.norm(d)
            
            if displacement_norm > 1e-10:
                relative_change = displacement_change / displacement_norm
            else:
                relative_change = displacement_change
            
            if relative_change < self.tolerance:
                converged = True
                break
            
            d_prev = d.copy()
        
        # Calculate reactions
        reactions = self._calculate_reactions(Ke + Kg, d, force_vector)
        
        # Calculate member forces
        member_forces = self._calculate_member_forces(d)
        
        # Calculate amplification factors
        amplification = self._calculate_amplification_factors(d, d_initial)
        
        # Build displacement dictionary
        displacements = {}
        for node in self.nodes.values():
            idx = node.dof_indices
            displacements[node.id] = {
                'dx': d[idx[0]],
                'dy': d[idx[1]],
                'dz': d[idx[2]],
                'rx': d[idx[3]],
                'ry': d[idx[4]],
                'rz': d[idx[5]],
            }
        
        convergence = ConvergenceResult(
            converged=converged,
            iterations=iteration,
            max_displacement_change=displacement_change if iteration > 0 else 0,
            residual_norm=relative_change if iteration > 0 else 0
        )
        
        return PDeltaResult(
            success=converged,
            convergence=convergence,
            displacements=displacements,
            member_forces=member_forces,
            reactions=reactions,
            amplification_factors=amplification
        )
    
    def _linear_analysis(self, force_vector: np.ndarray) -> PDeltaResult:
        """Perform simple linear analysis without P-Delta"""
        Ke = self._get_elastic_stiffness_matrix()
        Ke_ff = self._extract_submatrix(Ke)
        F_f = force_vector[self.free_dof]
        
        try:
            d_f = np.linalg.solve(Ke_ff, F_f)
        except np.linalg.LinAlgError:
            return PDeltaResult(
                success=False,
                convergence=ConvergenceResult(False, 0, 0, 0),
                displacements={},
                member_forces={},
                reactions={},
                amplification_factors={},
                error_message="Linear solve failed - structure may be unstable"
            )
        
        d = np.zeros(self.n_dof)
        d[self.free_dof] = d_f
        
        # Extract forces and build result
        reactions = self._calculate_reactions(Ke, d, force_vector)
        member_forces = self._calculate_member_forces(d)
        
        displacements = {}
        for node in self.nodes.values():
            idx = node.dof_indices
            displacements[node.id] = {
                'dx': d[idx[0]], 'dy': d[idx[1]], 'dz': d[idx[2]],
                'rx': d[idx[3]], 'ry': d[idx[4]], 'rz': d[idx[5]],
            }
        
        return PDeltaResult(
            success=True,
            convergence=ConvergenceResult(True, 1, 0, 0),
            displacements=displacements,
            member_forces=member_forces,
            reactions=reactions,
            amplification_factors={m: 1.0 for m in self.members}
        )
    
    def _calculate_reactions(
        self,
        K: np.ndarray,
        d: np.ndarray,
        F: np.ndarray
    ) -> Dict[str, Dict[str, float]]:
        """Calculate support reactions"""
        reactions = {}
        R = K @ d - F
        
        for node in self.nodes.values():
            if node.supports and any(node.supports):
                idx = node.dof_indices
                reactions[node.id] = {
                    'fx': R[idx[0]] if node.supports[0] else 0,
                    'fy': R[idx[1]] if node.supports[1] else 0,
                    'fz': R[idx[2]] if node.supports[2] else 0,
                    'mx': R[idx[3]] if node.supports[3] else 0,
                    'my': R[idx[4]] if node.supports[4] else 0,
                    'mz': R[idx[5]] if node.supports[5] else 0,
                }
        
        return reactions
    
    def _calculate_member_forces(
        self,
        d: np.ndarray
    ) -> Dict[str, Dict[str, float]]:
        """Calculate member end forces"""
        forces = {}
        
        for member in self.members.values():
            start = self.nodes[member.start_node_id]
            end = self.nodes[member.end_node_id]
            L = self._get_member_length(member)
            
            # Get nodal displacements
            d_start = d[start.dof_indices]
            d_end = d[end.dof_indices]
            d_member = np.concatenate([d_start, d_end])
            
            # Transform to local
            T = GeometricStiffnessMatrix.get_transformation_matrix(
                (start.x, start.y, start.z),
                (end.x, end.y, end.z)
            )
            d_local = T @ d_member
            
            # Get local stiffness and calculate forces
            Ke_local = self._get_member_Ke_local(member)
            F_local = Ke_local @ d_local
            
            forces[member.id] = {
                'P': F_local[0],           # Axial (start)
                'Vy': F_local[1],          # Shear y (start)
                'Vz': F_local[2],          # Shear z (start)
                'T': F_local[3],           # Torsion (start)
                'My': F_local[4],          # Moment y (start)
                'Mz': F_local[5],          # Moment z (start)
            }
        
        return forces
    
    def _calculate_amplification_factors(
        self,
        d_final: np.ndarray,
        d_initial: np.ndarray
    ) -> Dict[str, float]:
        """Calculate P-Delta amplification factors for each member"""
        amplification = {}
        
        for member in self.members.values():
            start = self.nodes[member.start_node_id]
            end = self.nodes[member.end_node_id]
            
            # Lateral displacement at ends
            dy1_init = d_initial[start.dof_indices[1]]
            dy1_final = d_final[start.dof_indices[1]]
            dy2_init = d_initial[end.dof_indices[1]]
            dy2_final = d_final[end.dof_indices[1]]
            
            # Average amplification
            delta_init = abs(dy2_init - dy1_init)
            delta_final = abs(dy2_final - dy1_final)
            
            if delta_init > 1e-10:
                amplification[member.id] = delta_final / delta_init
            else:
                amplification[member.id] = 1.0
        
        return amplification
