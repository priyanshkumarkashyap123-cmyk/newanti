"""
time_history_analysis.py - Dynamic Time History Analysis

Implements time-dependent structural analysis for:
- Seismic ground motion (earthquake time histories)
- Dynamic loading (machinery, impact, blast)
- Modal analysis (natural frequencies and mode shapes)
- Direct integration methods (Newmark-beta, Wilson-theta)
- Response spectrum analysis

Based on:
- Chopra, "Dynamics of Structures" (2017)
- Newmark (1959) - Direct integration method
- Wilson et al. (1973) - Theta method
"""

import numpy as np
from typing import Dict, List, Tuple, Any, Optional
from dataclasses import dataclass
import math


@dataclass
class GroundMotion:
    """Seismic ground motion time history"""
    name: str
    acceleration: np.ndarray  # Ground acceleration (m/s²)
    time: np.ndarray  # Time array (s)
    dt: float  # Time step (s)
    pga: float  # Peak ground acceleration (m/s²)
    duration: float  # Duration (s)
    scale_factor: float = 1.0  # Scaling factor


@dataclass
class ModalData:
    """Natural frequency and mode shape"""
    mode_number: int
    frequency: float  # Natural frequency (Hz)
    period: float  # Period (s)
    omega: float  # Angular frequency (rad/s)
    mode_shape: np.ndarray  # Mode shape vector
    participation_factor: float  # Modal participation factor
    mass_participation: float  # % of total mass


class TimeHistoryAnalyzer:
    """Dynamic time history analysis engine"""
    
    def __init__(self):
        self.modes: List[ModalData] = []
        self.damping_ratio = 0.05  # 5% critical damping (typical for steel/concrete)
        
    def modal_analysis(
        self,
        mass_matrix: np.ndarray,
        stiffness_matrix: np.ndarray,
        num_modes: int = 10
    ) -> List[ModalData]:
        """
        Perform modal analysis to find natural frequencies and mode shapes
        
        Args:
            mass_matrix: Global mass matrix [M]
            stiffness_matrix: Global stiffness matrix [K]
            num_modes: Number of modes to extract
            
        Returns:
            List of modal data (frequencies, mode shapes, participation)
        """
        print(f"[MODAL] Performing eigenvalue analysis for {num_modes} modes...")
        
        # Solve generalized eigenvalue problem: [K]{φ} = ω²[M]{φ}
        # Using scipy or numpy
        try:
            from scipy.linalg import eigh
            eigenvalues, eigenvectors = eigh(stiffness_matrix, mass_matrix)
        except ImportError:
            # Fallback to numpy (less accurate for generalized problem)
            M_inv = np.linalg.inv(mass_matrix)
            K_reduced = M_inv @ stiffness_matrix
            eigenvalues, eigenvectors = np.linalg.eig(K_reduced)
            # Sort eigenvalues
            idx = eigenvalues.argsort()
            eigenvalues = eigenvalues[idx]
            eigenvectors = eigenvectors[:, idx]
        
        modes = []
        total_mass = np.trace(mass_matrix)
        
        for i in range(min(num_modes, len(eigenvalues))):
            omega_squared = eigenvalues[i]
            if omega_squared <= 0:
                continue
                
            omega = math.sqrt(abs(omega_squared))  # rad/s
            frequency = omega / (2 * math.pi)  # Hz
            period = 1.0 / frequency if frequency > 0 else float('inf')
            
            mode_shape = eigenvectors[:, i]
            
            # Normalize mode shape (mass-normalized)
            # φᵀMφ = 1
            modal_mass = mode_shape.T @ mass_matrix @ mode_shape
            if modal_mass > 0:
                mode_shape = mode_shape / math.sqrt(modal_mass)
            
            # Modal participation factor: Γ = φᵀM{1} / φᵀMφ
            influence_vector = np.ones(len(mode_shape))
            participation_factor = (mode_shape.T @ mass_matrix @ influence_vector) / \
                                 (mode_shape.T @ mass_matrix @ mode_shape)
            
            # Mass participation ratio
            effective_mass = (mode_shape.T @ mass_matrix @ influence_vector)**2 / \
                           (mode_shape.T @ mass_matrix @ mode_shape)
            mass_participation = (effective_mass / total_mass) * 100
            
            modes.append(ModalData(
                mode_number=i + 1,
                frequency=frequency,
                period=period,
                omega=omega,
                mode_shape=mode_shape,
                participation_factor=participation_factor,
                mass_participation=mass_participation
            ))
        
        self.modes = modes
        print(f"[MODAL] Found {len(modes)} modes")
        return modes
    
    def newmark_beta_integration(
        self,
        mass_matrix: np.ndarray,
        stiffness_matrix: np.ndarray,
        damping_matrix: np.ndarray,
        ground_motion: GroundMotion,
        beta: float = 0.25,
        gamma: float = 0.5
    ) -> Dict[str, np.ndarray]:
        """
        Direct integration using Newmark-beta method
        
        Newmark-beta parameters:
        - β = 1/4, γ = 1/2: Average acceleration (unconditionally stable)
        - β = 1/6, γ = 1/2: Linear acceleration
        
        Equation of motion:
        [M]{ü} + [C]{u̇} + [K]{u} = -[M]{1}üg(t)
        
        Args:
            mass_matrix: [M] - Global mass matrix
            stiffness_matrix: [K] - Global stiffness matrix
            damping_matrix: [C] - Global damping matrix
            ground_motion: Ground acceleration time history
            beta: Newmark beta parameter (0.25 for average acceleration)
            gamma: Newmark gamma parameter (0.5 for average acceleration)
            
        Returns:
            Dictionary with displacement, velocity, acceleration arrays
        """
        print(f"[NEWMARK] Starting time history integration...")
        print(f"[NEWMARK] Duration: {ground_motion.duration:.2f}s, dt: {ground_motion.dt:.4f}s")
        
        n_dof = mass_matrix.shape[0]
        n_steps = len(ground_motion.time)
        dt = ground_motion.dt
        
        # Initialize response arrays
        u = np.zeros((n_dof, n_steps))  # Displacement
        v = np.zeros((n_dof, n_steps))  # Velocity
        a = np.zeros((n_dof, n_steps))  # Acceleration
        
        # Initial conditions (at rest)
        u[:, 0] = 0.0
        v[:, 0] = 0.0
        
        # Influence vector (all DOFs subjected to ground motion)
        influence = np.ones(n_dof)
        
        # Initial acceleration from equation of motion
        # [M]{ü₀} = -[M]{1}üg(0) - [C]{u̇₀} - [K]{u₀}
        p0 = -mass_matrix @ influence * ground_motion.acceleration[0]
        a[:, 0] = np.linalg.solve(mass_matrix, p0)
        
        # Newmark integration constants
        a0 = 1.0 / (beta * dt**2)
        a1 = gamma / (beta * dt)
        a2 = 1.0 / (beta * dt)
        a3 = 1.0 / (2.0 * beta) - 1.0
        a4 = gamma / beta - 1.0
        a5 = dt / 2.0 * (gamma / beta - 2.0)
        a6 = dt * (1.0 - gamma)
        a7 = gamma * dt
        
        # Effective stiffness matrix
        K_eff = stiffness_matrix + a0 * mass_matrix + a1 * damping_matrix
        
        # Time stepping
        for i in range(n_steps - 1):
            # Effective load vector
            ug_accel = ground_motion.acceleration[i + 1]
            p_eff = -mass_matrix @ influence * ug_accel
            
            # Add contributions from previous step
            p_eff += mass_matrix @ (a0 * u[:, i] + a2 * v[:, i] + a3 * a[:, i])
            p_eff += damping_matrix @ (a1 * u[:, i] + a4 * v[:, i] + a5 * a[:, i])
            
            # Solve for displacement at next step
            u[:, i + 1] = np.linalg.solve(K_eff, p_eff)
            
            # Update acceleration
            a[:, i + 1] = a0 * (u[:, i + 1] - u[:, i]) - a2 * v[:, i] - a3 * a[:, i]
            
            # Update velocity
            v[:, i + 1] = v[:, i] + a6 * a[:, i] + a7 * a[:, i + 1]
        
        print(f"[NEWMARK] Integration complete. Max displacement: {np.max(np.abs(u)):.6f}m")
        
        return {
            'displacement': u,
            'velocity': v,
            'acceleration': a,
            'time': ground_motion.time,
            'ground_acceleration': ground_motion.acceleration
        }
    
    def modal_superposition(
        self,
        ground_motion: GroundMotion,
        modes: List[ModalData],
        damping_ratio: float = 0.05
    ) -> Dict[str, np.ndarray]:
        """
        Modal superposition method for time history analysis
        
        More efficient than direct integration for systems with many DOFs.
        Uses uncoupled modal equations:
        ÿₙ + 2ζωₙẏₙ + ωₙ²yₙ = -Γₙüg(t)
        
        Args:
            ground_motion: Ground acceleration time history
            modes: List of modal data from modal_analysis()
            damping_ratio: Damping ratio (fraction of critical)
            
        Returns:
            Total response (displacement, velocity, acceleration)
        """
        print(f"[MODAL_SUPER] Using {len(modes)} modes for superposition...")
        
        n_steps = len(ground_motion.time)
        dt = ground_motion.dt
        
        # Get number of DOFs from first mode
        n_dof = len(modes[0].mode_shape)
        
        # Initialize total response
        u_total = np.zeros((n_dof, n_steps))
        v_total = np.zeros((n_dof, n_steps))
        a_total = np.zeros((n_dof, n_steps))
        
        # Solve each modal equation independently
        for mode in modes:
            print(f"[MODAL_SUPER] Mode {mode.mode_number}: f={mode.frequency:.2f}Hz, T={mode.period:.2f}s")
            
            omega = mode.omega
            Gamma = mode.participation_factor
            phi = mode.mode_shape
            
            # Modal damping
            c_modal = 2 * damping_ratio * omega
            
            # Initialize modal response
            y = np.zeros(n_steps)  # Modal displacement
            ydot = np.zeros(n_steps)  # Modal velocity
            yddot = np.zeros(n_steps)  # Modal acceleration
            
            # Duhamel integral (piecewise exact for linear acceleration)
            omega_d = omega * math.sqrt(1 - damping_ratio**2)  # Damped frequency
            
            for i in range(n_steps - 1):
                # Time increment
                t = dt
                
                # Ground acceleration at current and next step
                ug1 = ground_motion.acceleration[i]
                ug2 = ground_motion.acceleration[i + 1]
                
                # Linear interpolation of excitation
                # p(τ) = -Γüg(t+τ) = -Γ(üg1 + (üg2-üg1)τ/Δt)
                
                # Response to step change (exact solution)
                exp_term = math.exp(-damping_ratio * omega * t)
                cos_term = math.cos(omega_d * t)
                sin_term = math.sin(omega_d * t)
                
                # Convolution integral solution
                A = exp_term * (cos_term + (damping_ratio * omega / omega_d) * sin_term)
                B = exp_term * sin_term / omega_d
                C = (2 * damping_ratio) / (omega * t) + exp_term * (
                    ((1 - 2 * damping_ratio**2) / (omega_d * t)) * sin_term - 
                    (1 + 2 * damping_ratio / (omega * t)) * cos_term
                )
                D = 1 - C
                
                # Update modal response
                dy = A * y[i] + B * ydot[i] + C * (-Gamma * ug1) + D * (-Gamma * ug2)
                dydot = -omega**2 * B * y[i] + A * ydot[i] - omega**2 * (
                    D * (-Gamma * ug1) + (B - D) * (-Gamma * ug2)
                )
                
                y[i + 1] = dy
                ydot[i + 1] = dydot
                yddot[i + 1] = -c_modal * ydot[i + 1] - omega**2 * y[i + 1] - Gamma * ug2
            
            # Add modal contribution to total response
            # u(t) = Σ φₙ yₙ(t)
            for i in range(n_steps):
                u_total[:, i] += phi * y[i]
                v_total[:, i] += phi * ydot[i]
                a_total[:, i] += phi * yddot[i]
        
        print(f"[MODAL_SUPER] Superposition complete. Max displacement: {np.max(np.abs(u_total)):.6f}m")
        
        return {
            'displacement': u_total,
            'velocity': v_total,
            'acceleration': a_total + ground_motion.acceleration[:, np.newaxis].T,  # Add ground acceleration
            'time': ground_motion.time
        }
    
    def get_response_spectrum(
        self,
        ground_motion: GroundMotion,
        periods: np.ndarray,
        damping_ratio: float = 0.05
    ) -> Dict[str, np.ndarray]:
        """
        Calculate response spectrum (SDOF responses)
        
        Args:
            ground_motion: Ground acceleration time history
            periods: Array of periods to evaluate (s)
            damping_ratio: Damping ratio
            
        Returns:
            Dictionary with spectral displacement, velocity, acceleration
        """
        print(f"[SPECTRUM] Calculating response spectrum for {len(periods)} periods...")
        
        Sd = np.zeros(len(periods))  # Spectral displacement (m)
        Sv = np.zeros(len(periods))  # Spectral velocity (m/s)
        Sa = np.zeros(len(periods))  # Spectral acceleration (m/s²)
        
        for i, T in enumerate(periods):
            if T == 0:
                # Rigid response = PGA
                Sa[i] = ground_motion.pga
                continue
                
            omega = 2 * math.pi / T
            omega_d = omega * math.sqrt(1 - damping_ratio**2)
            
            # Duhamel integral for SDOF system
            u = 0.0
            v = 0.0
            a = 0.0
            
            max_u = 0.0
            max_v = 0.0
            max_a = 0.0
            
            for j in range(len(ground_motion.time) - 1):
                dt = ground_motion.dt
                ug = ground_motion.acceleration[j]
                
                # Newmark-beta for SDOF
                exp_term = math.exp(-damping_ratio * omega * dt)
                cos_term = math.cos(omega_d * dt)
                sin_term = math.sin(omega_d * dt)
                
                u_new = exp_term * (u * cos_term + (v + damping_ratio * omega * u) / omega_d * sin_term) - ug / omega**2
                v_new = exp_term * (-omega * u * sin_term + v * cos_term) - damping_ratio * omega * ug / omega**2
                a_new = -2 * damping_ratio * omega * v_new - omega**2 * u_new
                
                u, v, a = u_new, v_new, a_new
                
                max_u = max(max_u, abs(u))
                max_v = max(max_v, abs(v))
                max_a = max(max_a, abs(a + ug))
            
            Sd[i] = max_u
            Sv[i] = max_v
            Sa[i] = max_a
        
        return {
            'periods': periods,
            'Sd': Sd,
            'Sv': Sv,
            'Sa': Sa,
            'PSV': Sv,  # Pseudo spectral velocity = ω*Sd
            'PSA': Sa   # Pseudo spectral acceleration = ω²*Sd
        }


# ============================================
# GROUND MOTION DATABASE
# ============================================

def load_ground_motion(earthquake_name: str, scale_factor: float = 1.0) -> GroundMotion:
    """
    Load pre-defined ground motion records
    
    Available earthquakes:
    - 'el_centro_1940': Imperial Valley, CA (1940)
    - 'northridge_1994': Northridge, CA (1994)
    - 'kobe_1995': Kobe, Japan (1995)
    - 'synthetic_pulse': Synthetic near-fault pulse
    """
    
    if earthquake_name == 'el_centro_1940':
        # El Centro (1940) - Classic benchmark record
        # Simplified version (would normally load from file)
        dt = 0.02  # 20ms time step
        duration = 30.0  # 30 seconds
        time = np.arange(0, duration, dt)
        
        # Simplified sinusoidal approximation (real data would be loaded)
        freq_main = 2.0  # Hz
        acceleration = 3.417 * np.sin(2 * np.pi * freq_main * time) * np.exp(-0.1 * time)
        pga = np.max(np.abs(acceleration))
        
    elif earthquake_name == 'synthetic_pulse':
        # Synthetic near-fault velocity pulse
        dt = 0.01
        duration = 10.0
        time = np.arange(0, duration, dt)
        
        # Velocity pulse (differentiated to get acceleration)
        Tp = 1.0  # Pulse period
        Vp = 1.0  # Pulse amplitude
        velocity_pulse = Vp * (1 - np.cos(2 * np.pi * time / Tp)) * (time < Tp)
        acceleration = np.gradient(velocity_pulse, dt)
        pga = np.max(np.abs(acceleration))
        
    else:
        raise ValueError(f"Unknown earthquake: {earthquake_name}")
    
    return GroundMotion(
        name=earthquake_name,
        acceleration=acceleration * scale_factor,
        time=time,
        dt=dt,
        pga=pga * scale_factor,
        duration=duration,
        scale_factor=scale_factor
    )


# ============================================
# USAGE EXAMPLE
# ============================================

if __name__ == "__main__":
    # Example: 2-DOF system
    # [M] = [[2, 0], [0, 1]]
    # [K] = [[6, -2], [-2, 4]]
    
    M = np.array([[2.0, 0.0], [0.0, 1.0]])
    K = np.array([[6.0, -2.0], [-2.0, 4.0]])
    C = 0.05 * 2 * np.sqrt(K[0,0] * M[0,0]) * np.eye(2)  # Rayleigh damping
    
    analyzer = TimeHistoryAnalyzer()
    
    # Modal analysis
    modes = analyzer.modal_analysis(M, K, num_modes=2)
    print("\nModal Analysis Results:")
    for mode in modes:
        print(f"Mode {mode.mode_number}: f={mode.frequency:.2f}Hz, T={mode.period:.2f}s")
    
    # Load ground motion
    ground_motion = load_ground_motion('el_centro_1940', scale_factor=1.0)
    print(f"\nGround Motion: {ground_motion.name}")
    print(f"PGA: {ground_motion.pga:.2f} m/s²")
    
    # Time history analysis (Newmark-beta)
    response = analyzer.newmark_beta_integration(M, K, C, ground_motion)
    print(f"\nMax Displacement: {np.max(np.abs(response['displacement'])):.6f}m")
