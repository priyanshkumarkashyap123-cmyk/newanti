"""
Response Spectrum Analysis (RSA)

Combines modal analysis results with response spectra using CQC/SRSS modal combination.

Unit conventions:
    Displacements: mm
    Velocities: m/s
    Accelerations: m/s²
    Base shear: kN
"""
import logging
import math
from typing import Optional, List, Dict
import numpy as np

from .dynamics_models import ModalResult, ResponseSpectrumResult, SpectrumCurve

logger = logging.getLogger(__name__)


class ResponseSpectrumAnalyzer:
    """
    Response Spectrum Analysis with CQC/SRSS modal combination
    
    Combines modal responses per IS 1893:2016 Cl. 6.4.2
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
        """
        Args:
            modal_result: Results from modal analysis
            spectrum_x: Response spectrum for X direction
            spectrum_y: Response spectrum for Y direction
            spectrum_z: Response spectrum for Z direction
            damping: Damping ratio (default 5%)
            combination_method: 'CQC' or 'SRSS' modal combination
        """
        self.modal_result = modal_result
        self.spectrum_x = spectrum_x
        self.spectrum_y = spectrum_y
        self.spectrum_z = spectrum_z
        self.damping = damping
        self.combination_method = combination_method
    
    def _get_cqc_correlation(self, omega_i: float, omega_j: float) -> float:
        """
        Calculate CQC correlation coefficient ρ_ij per IS 1893
        
        ρ_ij = 8ξ²(1 + r)r^(3/2) / [(1 - r²)² + 4ξ²r(1 + r)²]
        
        where r = ω_j / ω_i
        
        Args:
            omega_i: Frequency of mode i (rad/s)
            omega_j: Frequency of mode j (rad/s)
        
        Returns:
            Correlation coefficient
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
            K: Stiffness matrix (for force calculation, optional)
            free_dof: Free DOF indices (optional)
        
        Returns:
            ResponseSpectrumResult with combined nodal responses
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


__all__ = [
    "ResponseSpectrumAnalyzer",
]
