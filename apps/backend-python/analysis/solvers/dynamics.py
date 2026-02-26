"""
dynamics.py - Modal & Response Spectrum Analysis

Implements dynamic analysis capabilities:
- Mass matrix generation (lumped and consistent)
- Modal extraction (eigenvalue analysis)
- Response Spectrum Analysis (CQC/SRSS combination)

Theory:
    Natural frequencies and mode shapes are found by solving:
    ([K] - ω²[M]){φ} = {0}
    
    For Response Spectrum, modal responses are combined using:
    - SRSS: √(Σr_i²)  
    - CQC: √(ΣΣ ρ_ij * r_i * r_j)
"""

from dataclasses import dataclass, field
from typing import List, Dict, Optional, Tuple, Callable
from enum import Enum
import numpy as np
from numpy import linalg as LA
import math


# ============================================
# DATA STRUCTURES
# ============================================

@dataclass
class SpectrumCurve:
    """Response Spectrum Curve (Period vs Sa/g)"""
    periods: List[float]      # Time periods (s)
    accelerations: List[float] # Sa/g values
    
    def get_acceleration(self, T: float) -> float:
        """Interpolate acceleration for given period"""
        if T <= self.periods[0]:
            return self.accelerations[0]
        if T >= self.periods[-1]:
            return self.accelerations[-1]
        
        # Linear interpolation
        for i in range(len(self.periods) - 1):
            if self.periods[i] <= T <= self.periods[i + 1]:
                t = (T - self.periods[i]) / (self.periods[i + 1] - self.periods[i])
                return self.accelerations[i] + t * (self.accelerations[i + 1] - self.accelerations[i])
        
        return self.accelerations[-1]


@dataclass
class ModeShape:
    """Single mode shape result"""
    mode_number: int
    frequency: float          # Natural frequency (Hz)
    period: float            # Period (s)
    omega: float             # Angular frequency (rad/s)
    shape: np.ndarray        # Mode shape vector (normalized)
    participation_factor_x: float = 0  # Modal participation X
    participation_factor_y: float = 0  # Modal participation Y
    participation_factor_z: float = 0  # Modal participation Z
    effective_mass_x: float = 0  # Effective modal mass X
    effective_mass_y: float = 0  # Effective modal mass Y
    effective_mass_z: float = 0  # Effective modal mass Z


@dataclass
class ModalResult:
    """Complete modal analysis result"""
    success: bool
    modes: List[ModeShape]
    total_mass: float
    cumulative_mass_x: List[float]  # Cumulative mass participation X
    cumulative_mass_y: List[float]  # Cumulative mass participation Y
    cumulative_mass_z: List[float]  # Cumulative mass participation Z
    error_message: Optional[str] = None


@dataclass
class ResponseSpectrumResult:
    """Response Spectrum Analysis result"""
    success: bool
    # Nodal results (combined from all modes)
    displacements: Dict[str, Dict[str, float]]
    velocities: Dict[str, Dict[str, float]]
    accelerations: Dict[str, Dict[str, float]]
    # Member forces (combined)
    member_forces: Dict[str, Dict[str, float]]
    # Base shear
    base_shear_x: float
    base_shear_y: float
    base_shear_z: float
    # Modal contributions
    modal_contributions: List[Dict[str, float]]
    combination_method: str  # 'CQC' or 'SRSS'
    error_message: Optional[str] = None


# ============================================
# IS 1893:2016 SPECTRUM CURVES
# ============================================

def get_is1893_spectrum(
    zone: str,
    soil_type: str,
    importance_factor: float = 1.0,
    response_reduction: float = 5.0,
    damping: float = 0.05
) -> SpectrumCurve:
    """
    Generate IS 1893:2016 design response spectrum
    
    Args:
        zone: Seismic zone ('II', 'III', 'IV', 'V')
        soil_type: Soil type ('I', 'II', 'III')
        importance_factor: Importance factor I
        response_reduction: Response reduction factor R
        damping: Damping ratio (default 5%)
    """
    # Zone factors
    Z_factors = {'II': 0.10, 'III': 0.16, 'IV': 0.24, 'V': 0.36}
    Z = Z_factors.get(zone, 0.16)
    
    # Damping correction
    if damping != 0.05:
        beta = math.sqrt(10 / (5 + 100 * damping))
    else:
        beta = 1.0
    
    # Spectral acceleration coefficient
    # Sa/g = 1 + 15T for T < 0.1s (Type I)
    # Sa/g = 2.5 for 0.1 <= T <= Tc
    # Sa/g = 2.5 * (Tc/T) for T > Tc (descending)
    
    # Tc values based on soil type
    Tc_values = {'I': 0.4, 'II': 0.55, 'III': 0.67}
    Tc = Tc_values.get(soil_type, 0.55)
    Td = 4.0  # End of spectrum
    
    periods = []
    accelerations = []
    
    # Generate spectrum points
    T_values = [0.0, 0.05, 0.1] + list(np.linspace(0.1, Tc, 10)[1:]) + \
               list(np.linspace(Tc, Td, 30)[1:])
    
    for T in T_values:
        if T <= 0.1:
            Sa_g = 1.0 + 15 * T
        elif T <= Tc:
            Sa_g = 2.5
        else:
            Sa_g = 2.5 * (Tc / T)
        
        # Apply design factors
        Ah = (Z / 2) * (importance_factor / response_reduction) * Sa_g * beta
        
        periods.append(T)
        accelerations.append(Ah)
    
    return SpectrumCurve(periods=periods, accelerations=accelerations)


# ============================================
# MASS MATRIX BUILDER
# ============================================

class MassMatrixBuilder:
    """
    Builds lumped and consistent mass matrices
    """
    
    @staticmethod
    def build_lumped_mass_matrix(
        nodes: Dict[str, dict],
        nodal_masses: Dict[str, float],
        dof_per_node: int = 6
    ) -> np.ndarray:
        """
        Build lumped mass matrix from nodal masses
        
        Args:
            nodes: Node dictionary with DOF indices
            nodal_masses: Mass at each node (node_id -> mass in kg)
            dof_per_node: DOFs per node (default 6)
        """
        n_dof = len(nodes) * dof_per_node
        M = np.zeros((n_dof, n_dof))
        
        for node_id, node in nodes.items():
            mass = nodal_masses.get(node_id, 0)
            dof_indices = node.get('dof_indices', [])
            
            if len(dof_indices) >= 3:
                # Translational mass
                M[dof_indices[0], dof_indices[0]] = mass
                M[dof_indices[1], dof_indices[1]] = mass
                M[dof_indices[2], dof_indices[2]] = mass
            
            if len(dof_indices) >= 6:
                # Rotational inertia (approximate as small fraction of mass)
                rot_inertia = mass * 0.01  # Approximate
                M[dof_indices[3], dof_indices[3]] = rot_inertia
                M[dof_indices[4], dof_indices[4]] = rot_inertia
                M[dof_indices[5], dof_indices[5]] = rot_inertia
        
        return M
    
    @staticmethod
    def build_consistent_mass_matrix(
        members: List[dict],
        nodes: Dict[str, dict],
        density: float = 7850  # Steel kg/m³
    ) -> np.ndarray:
        """
        Build consistent mass matrix from member properties
        
        Args:
            members: List of member dictionaries
            nodes: Node dictionary
            density: Material density (kg/m³)
        """
        n_nodes = len(nodes)
        n_dof = n_nodes * 6
        M = np.zeros((n_dof, n_dof))
        
        for member in members:
            start = nodes[member['start_node_id']]
            end = nodes[member['end_node_id']]
            
            # Calculate length
            dx = end['x'] - start['x']
            dy = end['y'] - start['y']
            dz = end['z'] - start['z']
            L = math.sqrt(dx*dx + dy*dy + dz*dz)
            
            A = member.get('A', 0.01)
            m_total = density * A * L  # Total member mass
            m = m_total / 2  # Mass per node (simplified)
            
            # Add to diagonal (lumped approach for simplicity)
            for node_data in [start, end]:
                dof = node_data.get('dof_indices', [])
                if len(dof) >= 3:
                    M[dof[0], dof[0]] += m
                    M[dof[1], dof[1]] += m
                    M[dof[2], dof[2]] += m
        
        return M
    
    @staticmethod
    def add_mass_source(
        M: np.ndarray,
        load_factor: float,
        loads: List[dict],
        nodes: Dict[str, dict],
        g: float = 9.81
    ) -> np.ndarray:
        """
        Add mass from loads (dead + live load percentage)
        
        Args:
            M: Existing mass matrix
            load_factor: Factor to apply (1.0 for DL, 0.25-0.5 for LL)
            loads: List of nodal loads
            nodes: Node dictionary
            g: Gravity acceleration
        """
        for load in loads:
            node_id = load.get('node_id')
            fy = abs(load.get('fy', 0))  # Vertical load
            
            if node_id in nodes and fy > 0:
                mass = (fy * load_factor) / g
                dof = nodes[node_id].get('dof_indices', [])
                
                if len(dof) >= 3:
                    M[dof[0], dof[0]] += mass
                    M[dof[1], dof[1]] += mass
                    M[dof[2], dof[2]] += mass
        
        return M


# ============================================
# MODAL ANALYZER
# ============================================

class ModalAnalyzer:
    """
    Eigenvalue analysis for natural frequencies and mode shapes
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


# ============================================
# RESPONSE SPECTRUM ANALYZER
# ============================================

class ResponseSpectrumAnalyzer:
    """
    Response Spectrum Analysis with CQC/SRSS modal combination
    """
    
    def __init__(
        self,
        modal_result: ModalResult,
        spectrum_x: Optional[SpectrumCurve] = None,
        spectrum_y: Optional[SpectrumCurve] = None,
        spectrum_z: Optional[SpectrumCurve] = None,
        damping: float = 0.05,
        combination_method: str = 'CQC'
    ):
        self.modal_result = modal_result
        self.spectrum_x = spectrum_x
        self.spectrum_y = spectrum_y
        self.spectrum_z = spectrum_z
        self.damping = damping
        self.combination_method = combination_method
    
    def _get_cqc_correlation(self, omega_i: float, omega_j: float) -> float:
        """
        Calculate CQC correlation coefficient ρ_ij
        
        ρ_ij = 8ξ²(1 + r)r^(3/2) / [(1 - r²)² + 4ξ²r(1 + r)²]
        
        where r = ω_j / ω_i
        """
        xi = self.damping
        
        if omega_i < 1e-10 or omega_j < 1e-10:
            return 0 if omega_i != omega_j else 1
        
        r = omega_j / omega_i
        
        if abs(1 - r) < 1e-10:
            return 1.0
        
        numerator = 8 * xi**2 * (1 + r) * r**1.5
        denominator = (1 - r**2)**2 + 4 * xi**2 * r * (1 + r)**2
        
        if denominator < 1e-20:
            return 0
        
        return numerator / denominator
    
    def analyze(
        self,
        direction: str = 'X',
        K: Optional[np.ndarray] = None,
        free_dof: Optional[List[int]] = None
    ) -> ResponseSpectrumResult:
        """
        Perform Response Spectrum Analysis
        
        Args:
            direction: Excitation direction ('X', 'Y', or 'Z')
            K: Stiffness matrix (for force calculation)
            free_dof: Free DOF indices
        """
        try:
            if not self.modal_result.success:
                return ResponseSpectrumResult(
                    success=False,
                    displacements={},
                    velocities={},
                    accelerations={},
                    member_forces={},
                    base_shear_x=0,
                    base_shear_y=0,
                    base_shear_z=0,
                    modal_contributions=[],
                    combination_method=self.combination_method,
                    error_message="Modal analysis failed"
                )
            
            # Select spectrum based on direction
            if direction == 'X':
                spectrum = self.spectrum_x
                gamma_key = 'participation_factor_x'
            elif direction == 'Y':
                spectrum = self.spectrum_y
                gamma_key = 'participation_factor_y'
            else:
                spectrum = self.spectrum_z
                gamma_key = 'participation_factor_z'
            
            if spectrum is None:
                return ResponseSpectrumResult(
                    success=False,
                    displacements={},
                    velocities={},
                    accelerations={},
                    member_forces={},
                    base_shear_x=0,
                    base_shear_y=0,
                    base_shear_z=0,
                    modal_contributions=[],
                    combination_method=self.combination_method,
                    error_message=f"No spectrum defined for direction {direction}"
                )
            
            modes = self.modal_result.modes
            num_modes = len(modes)
            n_dof = len(modes[0].shape) if modes else 0
            
            # Calculate modal responses
            modal_displacements = []
            modal_velocities = []
            modal_accelerations = []
            modal_base_shears = []
            
            g = 9.81  # m/s²
            
            for mode in modes:
                T = mode.period
                omega = mode.omega
                gamma = getattr(mode, gamma_key, 0)
                phi = mode.shape
                
                # Get spectral acceleration
                Sa_g = spectrum.get_acceleration(T)
                Sa = Sa_g * g  # Convert to m/s²
                
                # Modal displacement: u_i = Γ_i * φ_i * (Sa / ω²)
                if omega > 1e-10:
                    Sd = Sa / (omega**2)  # Spectral displacement
                else:
                    Sd = 0
                
                u_modal = gamma * phi * Sd
                v_modal = gamma * phi * Sa / omega if omega > 1e-10 else np.zeros(n_dof)
                a_modal = gamma * phi * Sa
                
                modal_displacements.append(u_modal)
                modal_velocities.append(v_modal)
                modal_accelerations.append(a_modal)
                
                # Modal base shear
                Vb = abs(gamma) * mode.effective_mass_x * Sa if direction == 'X' else \
                     abs(gamma) * mode.effective_mass_y * Sa if direction == 'Y' else \
                     abs(gamma) * mode.effective_mass_z * Sa
                modal_base_shears.append(Vb)
            
            # Modal combination
            if self.combination_method == 'CQC':
                # Build correlation matrix
                rho = np.zeros((num_modes, num_modes))
                for i in range(num_modes):
                    for j in range(num_modes):
                        rho[i, j] = self._get_cqc_correlation(
                            modes[i].omega,
                            modes[j].omega
                        )
                
                # Combined response
                combined_disp = np.zeros(n_dof)
                for k in range(n_dof):
                    sum_sq = 0
                    for i in range(num_modes):
                        for j in range(num_modes):
                            sum_sq += rho[i, j] * modal_displacements[i][k] * modal_displacements[j][k]
                    combined_disp[k] = math.sqrt(abs(sum_sq))
                
                combined_vel = np.zeros(n_dof)
                combined_acc = np.zeros(n_dof)
                for k in range(n_dof):
                    sum_sq_v = 0
                    sum_sq_a = 0
                    for i in range(num_modes):
                        for j in range(num_modes):
                            sum_sq_v += rho[i, j] * modal_velocities[i][k] * modal_velocities[j][k]
                            sum_sq_a += rho[i, j] * modal_accelerations[i][k] * modal_accelerations[j][k]
                    combined_vel[k] = math.sqrt(abs(sum_sq_v))
                    combined_acc[k] = math.sqrt(abs(sum_sq_a))
                
                # Combined base shear
                sum_sq = 0
                for i in range(num_modes):
                    for j in range(num_modes):
                        sum_sq += rho[i, j] * modal_base_shears[i] * modal_base_shears[j]
                combined_base_shear = math.sqrt(abs(sum_sq))
                
            else:  # SRSS
                combined_disp = np.sqrt(sum(u**2 for u in modal_displacements))
                combined_vel = np.sqrt(sum(v**2 for v in modal_velocities))
                combined_acc = np.sqrt(sum(a**2 for a in modal_accelerations))
                combined_base_shear = math.sqrt(sum(V**2 for V in modal_base_shears))
            
            # Convert to dictionaries
            displacements = {}
            velocities = {}
            accelerations = {}
            
            # Assuming 6 DOF per node
            n_nodes = n_dof // 6
            for i in range(n_nodes):
                node_id = f"N{i+1}"
                base = i * 6
                displacements[node_id] = {
                    'dx': combined_disp[base] * 1000,  # Convert to mm
                    'dy': combined_disp[base + 1] * 1000,
                    'dz': combined_disp[base + 2] * 1000,
                    'rx': combined_disp[base + 3],
                    'ry': combined_disp[base + 4],
                    'rz': combined_disp[base + 5],
                }
                velocities[node_id] = {
                    'vx': combined_vel[base],
                    'vy': combined_vel[base + 1],
                    'vz': combined_vel[base + 2],
                }
                accelerations[node_id] = {
                    'ax': combined_acc[base],
                    'ay': combined_acc[base + 1],
                    'az': combined_acc[base + 2],
                }
            
            # Modal contributions
            modal_contributions = []
            for i, mode in enumerate(modes):
                modal_contributions.append({
                    'mode': mode.mode_number,
                    'period': mode.period,
                    'base_shear': modal_base_shears[i] / 1000,  # kN
                    'contribution_pct': (modal_base_shears[i] / combined_base_shear * 100) if combined_base_shear > 0 else 0
                })
            
            return ResponseSpectrumResult(
                success=True,
                displacements=displacements,
                velocities=velocities,
                accelerations=accelerations,
                member_forces={},  # Would need K matrix to calculate
                base_shear_x=combined_base_shear / 1000 if direction == 'X' else 0,
                base_shear_y=combined_base_shear / 1000 if direction == 'Y' else 0,
                base_shear_z=combined_base_shear / 1000 if direction == 'Z' else 0,
                modal_contributions=modal_contributions,
                combination_method=self.combination_method
            )
            
        except Exception as e:
            return ResponseSpectrumResult(
                success=False,
                displacements={},
                velocities={},
                accelerations={},
                member_forces={},
                base_shear_x=0,
                base_shear_y=0,
                base_shear_z=0,
                modal_contributions=[],
                combination_method=self.combination_method,
                error_message=str(e)
            )
