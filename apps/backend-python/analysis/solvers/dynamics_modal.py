"""
Modal Analysis

Eigenvalue analysis for natural frequencies and mode shapes via generalized eigenvalue problem.

Unit conventions:
    Stiffness matrix K: consistent units (kN/m, kN·m/rad)
    Mass: kg
    Frequencies: Hz (ω in rad/s)
    Periods: seconds
"""
import logging
import math
from typing import List, Optional
import numpy as np
from numpy import linalg as LA

from .dynamics_models import ModeShape, ModalResult

logger = logging.getLogger(__name__)


class ModalAnalyzer:
    """
    Eigenvalue analysis for natural frequencies and mode shapes
    
    Solves the generalized eigenvalue problem:
        [K]{φ} = ω²[M]{φ}
    """
    
    def __init__(
        self,
        K: np.ndarray,
        M: np.ndarray,
        free_dof: List[int],
        num_modes: int = 10
    ):
        """
        Args:
            K: Global stiffness matrix
            M: Global mass matrix
            free_dof: List of free (unconstrained) DOF indices
            num_modes: Number of modes to extract
        """
        self.K = K
        self.M = M
        self.free_dof = free_dof
        self.num_modes = min(num_modes, len(free_dof))
    
    def analyze(self) -> ModalResult:
        """
        Perform eigenvalue analysis to extract natural frequencies and mode shapes
        
        Returns:
            ModalResult with extracted modes and mass participation
        """
        try:
            # Extract free DOF submatrices
            K_ff = self.K[np.ix_(self.free_dof, self.free_dof)]
            M_ff = self.M[np.ix_(self.free_dof, self.free_dof)]
            
            # Add small regularization to M if needed
            M_diag = np.diag(M_ff)
            min_mass = np.min(M_diag[M_diag > 0]) if np.any(M_diag > 0) else 1.0
            M_ff = M_ff + np.eye(len(self.free_dof)) * min_mass * 1e-10
            
            # Solve generalized eigenvalue problem
            # [K]{φ} = ω²[M]{φ}
            # Using scipy's eigh for symmetric matrices
            try:
                from scipy.linalg import eigh
                eigenvalues, eigenvectors = eigh(K_ff, M_ff)
            except ImportError:
                # Fallback: convert to standard eigenvalue problem
                M_inv = LA.inv(M_ff)
                A = M_inv @ K_ff
                eigenvalues, eigenvectors = LA.eig(A)
                eigenvalues = np.real(eigenvalues)
                eigenvectors = np.real(eigenvectors)
            
            # Sort by eigenvalue (smallest first)
            idx = np.argsort(eigenvalues)
            eigenvalues = eigenvalues[idx]
            eigenvectors = eigenvectors[:, idx]
            
            # Extract requested number of modes
            modes = []
            total_mass = np.sum(np.diag(M_ff))
            cumulative_x = []
            cumulative_y = []
            cumulative_z = []
            cum_x = 0
            cum_y = 0
            cum_z = 0
            
            for i in range(self.num_modes):
                omega_sq = eigenvalues[i]
                
                # Skip negative eigenvalues (numerical errors or rigid body modes)
                if omega_sq < 0:
                    omega_sq = abs(omega_sq)
                
                omega = math.sqrt(omega_sq)
                frequency = omega / (2 * math.pi)
                period = 1 / frequency if frequency > 1e-10 else 0
                
                # Mode shape (expand to full DOF)
                phi_reduced = eigenvectors[:, i]
                phi = np.zeros(len(self.K))
                phi[self.free_dof] = phi_reduced
                
                # Normalize mode shape (mass normalized)
                gen_mass = phi_reduced.T @ M_ff @ phi_reduced
                if gen_mass > 0:
                    phi = phi / math.sqrt(abs(gen_mass))
                    phi_reduced = phi[self.free_dof]
                
                # Calculate modal participation factors
                # Γ_x = {φ}ᵀ[M]{r_x} / {φ}ᵀ[M]{φ}
                # where {r_x} = [1,0,0,0,0,0, 1,0,0,0,0,0, ...]
                
                n_nodes = len(self.free_dof) // 6 if len(self.free_dof) % 6 == 0 else len(self.free_dof) // 3
                
                # Influence vectors (unit displacement in each direction)
                r_x = np.zeros(len(self.free_dof))
                r_y = np.zeros(len(self.free_dof))
                r_z = np.zeros(len(self.free_dof))
                
                for j in range(0, len(self.free_dof), 6 if len(self.free_dof) > 6 else 3):
                    if j < len(r_x): r_x[j] = 1
                    if j + 1 < len(r_y): r_y[j + 1] = 1
                    if j + 2 < len(r_z): r_z[j + 2] = 1
                
                gen_mass = phi_reduced.T @ M_ff @ phi_reduced
                if abs(gen_mass) > 1e-20:
                    gamma_x = (phi_reduced.T @ M_ff @ r_x) / gen_mass
                    gamma_y = (phi_reduced.T @ M_ff @ r_y) / gen_mass
                    gamma_z = (phi_reduced.T @ M_ff @ r_z) / gen_mass
                else:
                    gamma_x = gamma_y = gamma_z = 0
                
                # Effective modal mass
                M_eff_x = gamma_x**2 * gen_mass if gen_mass > 0 else 0
                M_eff_y = gamma_y**2 * gen_mass if gen_mass > 0 else 0
                M_eff_z = gamma_z**2 * gen_mass if gen_mass > 0 else 0
                
                cum_x += abs(M_eff_x) / total_mass * 100 if total_mass > 0 else 0
                cum_y += abs(M_eff_y) / total_mass * 100 if total_mass > 0 else 0
                cum_z += abs(M_eff_z) / total_mass * 100 if total_mass > 0 else 0
                
                modes.append(ModeShape(
                    mode_number=i + 1,
                    frequency=frequency,
                    period=period,
                    omega=omega,
                    shape=phi,
                    participation_factor_x=gamma_x,
                    participation_factor_y=gamma_y,
                    participation_factor_z=gamma_z,
                    effective_mass_x=M_eff_x,
                    effective_mass_y=M_eff_y,
                    effective_mass_z=M_eff_z
                ))
                
                cumulative_x.append(min(cum_x, 100))
                cumulative_y.append(min(cum_y, 100))
                cumulative_z.append(min(cum_z, 100))
            
            return ModalResult(
                success=True,
                modes=modes,
                total_mass=total_mass,
                cumulative_mass_x=cumulative_x,
                cumulative_mass_y=cumulative_y,
                cumulative_mass_z=cumulative_z
            )
            
        except Exception as e:
            return ModalResult(
                success=False,
                modes=[],
                total_mass=0,
                cumulative_mass_x=[],
                cumulative_mass_y=[],
                cumulative_mass_z=[],
                error_message=str(e)
            )


__all__ = [
    "ModalAnalyzer",
]
