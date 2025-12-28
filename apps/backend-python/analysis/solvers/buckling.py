"""
buckling.py - Linear Buckling Analysis

Implements Euler buckling analysis for structural stability:
- Calculates critical buckling load factors (λ)
- Extracts buckling mode shapes
- Uses eigenvalue solution: |[Ke] + λ[Kg]| = 0

Theory:
    Linear buckling finds the load multiplier λ at which the 
    structure becomes unstable:
    
    ([Ke] + λ[Kg]){φ} = {0}
    
    The smallest positive λ is the critical buckling factor.
    If λ > 1.0, structure is safe under applied loads.
    If λ < 1.0, structure buckles before full load is reached.
"""

from dataclasses import dataclass, field
from typing import List, Dict, Optional, Tuple
import numpy as np
from numpy import linalg as LA
import math


# ============================================
# DATA STRUCTURES
# ============================================

@dataclass
class BucklingMode:
    """Single buckling mode result"""
    mode_number: int
    buckling_factor: float    # λ - load multiplier at buckling
    mode_shape: np.ndarray    # Buckling mode shape
    is_critical: bool = False # True if this is the governing mode


@dataclass
class BucklingResult:
    """Complete buckling analysis result"""
    success: bool
    critical_factor: float             # Minimum positive buckling factor
    modes: List[BucklingMode]
    is_stable: bool                    # True if λ_cr > 1.0
    safety_factor: float               # λ_cr (same as critical_factor)
    critical_members: List[str]        # Member IDs that buckle first
    error_message: Optional[str] = None


# ============================================
# BUCKLING ANALYZER
# ============================================

class BucklingAnalyzer:
    """
    Linear Buckling (Eigenvalue) Analysis
    
    Solves the generalized eigenvalue problem:
    [Ke]{φ} = -λ[Kg]{φ}
    
    Which can be rewritten as:
    [Ke]⁻¹[Kg]{φ} = (-1/λ){φ}
    
    The eigenvalues give us 1/λ, and we want the smallest positive λ.
    """
    
    def __init__(
        self,
        Ke: np.ndarray,       # Elastic stiffness matrix
        Kg: np.ndarray,       # Geometric stiffness matrix (from reference loads)
        free_dof: List[int],  # Free DOF indices
        num_modes: int = 6    # Number of buckling modes to extract
    ):
        self.Ke = Ke
        self.Kg = Kg
        self.free_dof = free_dof
        self.num_modes = min(num_modes, len(free_dof))
        
    def analyze(self) -> BucklingResult:
        """
        Perform linear buckling analysis
        
        Returns:
            BucklingResult with critical buckling factor and mode shapes
        """
        try:
            # Extract free DOF submatrices
            Ke_ff = self.Ke[np.ix_(self.free_dof, self.free_dof)]
            Kg_ff = self.Kg[np.ix_(self.free_dof, self.free_dof)]
            
            # Check if Kg has any non-zero terms
            if np.allclose(Kg_ff, 0):
                return BucklingResult(
                    success=False,
                    critical_factor=float('inf'),
                    modes=[],
                    is_stable=True,
                    safety_factor=float('inf'),
                    critical_members=[],
                    error_message="Geometric stiffness matrix is zero - no axial loads applied"
                )
            
            # Solve generalized eigenvalue problem: Ke * φ = λ * (-Kg) * φ
            # This is equivalent to finding λ where det(Ke + λ*Kg) = 0
            # We solve: [Ke]^(-1) * [Kg] * {φ} = -μ * {φ}, where μ = 1/λ
            
            try:
                # Use scipy for generalized eigenvalue problem
                from scipy.linalg import eig
                
                # Solve: Ke * v = λ * (-Kg) * v
                # Which gives us: (Kg)^(-1) * Ke * v = (-1/λ) * v
                # We want positive λ values
                
                # Standard approach: solve Ke * v = -λ * Kg * v
                eigenvalues, eigenvectors = eig(Ke_ff, -Kg_ff)
                
            except ImportError:
                # Fallback to numpy (less stable for generalized problem)
                # Convert to standard eigenvalue problem
                try:
                    Kg_inv = LA.inv(Kg_ff)
                    A = -Kg_inv @ Ke_ff  # Note: we're solving λ = eigenvalue
                    eigenvalues, eigenvectors = LA.eig(A)
                except LA.LinAlgError:
                    # Kg is singular - use pseudoinverse
                    Kg_pinv = LA.pinv(Kg_ff)
                    A = -Kg_pinv @ Ke_ff
                    eigenvalues, eigenvectors = LA.eig(A)
            
            # Take real parts (imaginary parts should be near zero)
            eigenvalues = np.real(eigenvalues)
            eigenvectors = np.real(eigenvectors)
            
            # Filter for positive eigenvalues (compression buckling)
            positive_mask = eigenvalues > 1e-6
            
            if not np.any(positive_mask):
                return BucklingResult(
                    success=True,
                    critical_factor=float('inf'),
                    modes=[],
                    is_stable=True,
                    safety_factor=float('inf'),
                    critical_members=[],
                    error_message="No positive buckling modes found - structure is stable"
                )
            
            # Sort by eigenvalue (buckling factor)
            positive_indices = np.where(positive_mask)[0]
            sorted_indices = positive_indices[np.argsort(eigenvalues[positive_indices])]
            
            # Extract modes
            modes = []
            critical_factor = float('inf')
            
            for i, idx in enumerate(sorted_indices[:self.num_modes]):
                lambda_i = eigenvalues[idx]
                phi_reduced = eigenvectors[:, idx]
                
                # Expand to full DOF
                phi = np.zeros(len(self.Ke))
                phi[self.free_dof] = phi_reduced
                
                # Normalize mode shape
                max_val = np.max(np.abs(phi))
                if max_val > 1e-10:
                    phi = phi / max_val
                
                is_critical = (i == 0)
                if is_critical:
                    critical_factor = lambda_i
                
                modes.append(BucklingMode(
                    mode_number=i + 1,
                    buckling_factor=lambda_i,
                    mode_shape=phi,
                    is_critical=is_critical
                ))
            
            # Determine stability
            is_stable = critical_factor > 1.0
            
            return BucklingResult(
                success=True,
                critical_factor=critical_factor,
                modes=modes,
                is_stable=is_stable,
                safety_factor=critical_factor,
                critical_members=[]  # Would need member mapping to identify
            )
            
        except Exception as e:
            return BucklingResult(
                success=False,
                critical_factor=0,
                modes=[],
                is_stable=False,
                safety_factor=0,
                critical_members=[],
                error_message=str(e)
            )
    
    @staticmethod
    def calculate_member_buckling_factors(
        members: List[dict],
        nodes: Dict[str, dict],
        K_factors: Dict[str, Tuple[float, float]] = None  # member_id -> (Ky, Kz)
    ) -> Dict[str, Dict[str, float]]:
        """
        Calculate individual member buckling factors (Euler buckling)
        
        P_cr = π²EI / (KL)²
        
        Args:
            members: List of member dictionaries
            nodes: Node dictionary
            K_factors: Effective length factors (default 1.0)
            
        Returns:
            Dictionary of member_id -> {P_cr_y, P_cr_z, lambda_y, lambda_z}
        """
        results = {}
        
        for member in members:
            member_id = member['id']
            start = nodes[member['start_node_id']]
            end = nodes[member['end_node_id']]
            
            # Calculate length
            dx = end['x'] - start['x']
            dy = end['y'] - start['y']
            dz = end['z'] - start['z']
            L = math.sqrt(dx*dx + dy*dy + dz*dz)
            
            if L < 1e-10:
                continue
            
            E = member.get('E', 200e9)
            Iy = member.get('Iy', 1e-4)
            Iz = member.get('Iz', 1e-4)
            A = member.get('A', 0.01)
            
            # Get effective length factors
            if K_factors and member_id in K_factors:
                Ky, Kz = K_factors[member_id]
            else:
                Ky = Kz = 1.0
            
            # Euler critical loads
            P_cr_y = (math.pi**2 * E * Iy) / (Ky * L)**2
            P_cr_z = (math.pi**2 * E * Iz) / (Kz * L)**2
            
            # Governing critical load
            P_cr = min(P_cr_y, P_cr_z)
            
            # Slenderness ratios
            ry = math.sqrt(Iy / A) if A > 0 else 0
            rz = math.sqrt(Iz / A) if A > 0 else 0
            
            lambda_y = (Ky * L) / ry if ry > 0 else float('inf')
            lambda_z = (Kz * L) / rz if rz > 0 else float('inf')
            
            results[member_id] = {
                'P_cr_y': P_cr_y / 1000,  # kN
                'P_cr_z': P_cr_z / 1000,  # kN
                'P_cr': P_cr / 1000,      # kN
                'lambda_y': lambda_y,      # Slenderness about y
                'lambda_z': lambda_z,      # Slenderness about z
                'L_eff_y': Ky * L,         # Effective length y
                'L_eff_z': Kz * L,         # Effective length z
            }
        
        return results
    
    @staticmethod
    def get_effective_length_factor(
        end_condition_start: str,
        end_condition_end: str
    ) -> float:
        """
        Get effective length factor K based on end conditions
        
        End conditions: 'fixed', 'pinned', 'free', 'guided'
        
        Returns:
            Effective length factor K
        """
        conditions = (end_condition_start, end_condition_end)
        
        # K factors from structural engineering tables
        K_table = {
            ('fixed', 'fixed'): 0.5,
            ('fixed', 'pinned'): 0.7,
            ('pinned', 'fixed'): 0.7,
            ('pinned', 'pinned'): 1.0,
            ('fixed', 'free'): 2.0,
            ('free', 'fixed'): 2.0,
            ('fixed', 'guided'): 1.0,
            ('guided', 'fixed'): 1.0,
            ('pinned', 'guided'): 2.0,
            ('guided', 'pinned'): 2.0,
        }
        
        return K_table.get(conditions, 1.0)
