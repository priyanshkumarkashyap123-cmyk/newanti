"""
physics_loss.py - Physics-Informed Loss Functions for Beam Analysis

Implements PDE residual losses for:
1. Euler-Bernoulli beam theory (4th order ODE)
2. Timoshenko beam theory (coupled 2nd order system)

The physics loss ensures the neural network output satisfies
the governing differential equations of beam mechanics.
"""

import jax
import jax.numpy as jnp
from jax import grad, vmap, jit
from typing import Callable, Tuple, Dict, Any
from functools import partial

from .beam_configs import (
    BeamConfig,
    EulerBernoulliConfig,
    TimoshenkoConfig,
    BoundaryCondition,
    LoadConfig,
)


# ============================================
# EULER-BERNOULLI BEAM THEORY
# ============================================

def euler_bernoulli_residual(
    network_fn: Callable,
    params: Any,
    x: jnp.ndarray,
    config: EulerBernoulliConfig
) -> jnp.ndarray:
    """
    Compute Euler-Bernoulli PDE residual.
    
    Governing equation:
        EI * d⁴w/dx⁴ = q(x)
    
    Where:
        w = deflection (positive upward)
        E = Young's modulus
        I = Second moment of area
        q = distributed load (positive upward)
    
    Args:
        network_fn: Function (params, x, L) -> w
        params: Network parameters
        x: Collocation points (N,)
        config: Euler-Bernoulli beam configuration
        
    Returns:
        PDE residual at each collocation point (N,)
    """
    L = config.length
    EI = config.EI
    load_fn = config.load.get_load_function(L)
    
    def scalar_network(xi):
        """Network output at single point."""
        return network_fn(params, jnp.array([xi]), L)[0]
    
    # Compute 4th derivative using automatic differentiation
    dw_dx = grad(scalar_network)
    d2w_dx2 = grad(dw_dx)
    d3w_dx3 = grad(d2w_dx2)
    d4w_dx4 = grad(d3w_dx3)
    
    # Vectorize over all collocation points
    d4w_dx4_vec = vmap(d4w_dx4)(x)
    
    # Load at collocation points
    q = load_fn(x)
    
    # PDE residual: EI * w'''' - q = 0
    residual = EI * d4w_dx4_vec - q
    
    return residual


@partial(jit, static_argnums=(0,))
def euler_bernoulli_loss(
    network_fn: Callable,
    params: Any,
    x_interior: jnp.ndarray,
    config_dict: Dict
) -> jnp.ndarray:
    """
    JIT-compiled Euler-Bernoulli physics loss (MSE of residual).
    
    Args:
        network_fn: Network function
        params: Network parameters
        x_interior: Interior collocation points
        config_dict: Configuration as dict (for JIT compatibility)
        
    Returns:
        Mean squared PDE residual
    """
    L = config_dict['length']
    EI = config_dict['E'] * config_dict['I']
    q_mag = config_dict['load_magnitude']
    
    def scalar_network(xi):
        return network_fn(params, jnp.array([xi]), L)[0]
    
    # Chain rule for 4th derivative
    d1 = grad(scalar_network)
    d2 = grad(d1)
    d3 = grad(d2)
    d4 = grad(d3)
    
    # Compute residual at each point
    def residual_at_point(xi):
        w4 = d4(xi)
        # Assuming uniform load for JIT
        q = q_mag
        return EI * w4 - q
    
    residuals = vmap(residual_at_point)(x_interior)
    
    return jnp.mean(residuals ** 2)


# ============================================
# TIMOSHENKO BEAM THEORY
# ============================================

def timoshenko_residual(
    network_fn: Callable,
    params: Any,
    x: jnp.ndarray,
    config: TimoshenkoConfig
) -> Tuple[jnp.ndarray, jnp.ndarray]:
    """
    Compute Timoshenko beam PDE residuals.
    
    Governing equations:
        dθ/dx = M / EI                    (bending curvature)
        dw/dx = θ - V / (κAG)            (shear slope)
        dV/dx = -q(x)                     (shear equilibrium)
        dM/dx = V                         (moment equilibrium)
    
    Combined form for w and θ:
        κAG * (dw/dx - θ) + EI * d²θ/dx² = 0   (equilibrium)
        κAG * (d²w/dx² - dθ/dx) = q(x)         (load balance)
    
    Args:
        network_fn: Function (params, x, L) -> (w, θ)
        params: Network parameters
        x: Collocation points
        config: Timoshenko beam configuration
        
    Returns:
        (residual_1, residual_2) tuple of residual arrays
    """
    L = config.length
    EI = config.EI
    GA_kappa = config.GA_kappa
    load_fn = config.load.get_load_function(L)
    
    def scalar_outputs(xi):
        """Get w and theta at single point."""
        w, theta = network_fn(params, jnp.array([xi]), L)
        return w[0], theta[0]
    
    def get_w(xi):
        w, _ = scalar_outputs(xi)
        return w
    
    def get_theta(xi):
        _, theta = scalar_outputs(xi)
        return theta
    
    # Derivatives
    dw_dx = grad(get_w)
    d2w_dx2 = grad(dw_dx)
    dtheta_dx = grad(get_theta)
    d2theta_dx2 = grad(dtheta_dx)
    
    def compute_residuals(xi):
        w, theta = scalar_outputs(xi)
        
        # First derivatives
        w_prime = dw_dx(xi)
        theta_prime = dtheta_dx(xi)
        
        # Second derivatives
        theta_double_prime = d2theta_dx2(xi)
        
        # Load
        q = load_fn(jnp.array([xi]))[0]
        
        # Residual 1: Bending equation
        # EI * θ'' + κAG * (w' - θ) = 0
        res1 = EI * theta_double_prime + GA_kappa * (w_prime - theta)
        
        # Residual 2: Shear equation
        # κAG * (w' - θ)' = q  =>  κAG * (w'' - θ') = q
        w_double_prime = d2w_dx2(xi)
        res2 = GA_kappa * (w_double_prime - theta_prime) - q
        
        return res1, res2
    
    # Vectorize over collocation points
    residuals = vmap(compute_residuals)(x)
    
    return residuals[0], residuals[1]


# ============================================
# BOUNDARY CONDITION LOSSES
# ============================================

def boundary_loss_euler_bernoulli(
    network_fn: Callable,
    params: Any,
    config: EulerBernoulliConfig
) -> jnp.ndarray:
    """
    Compute boundary condition loss for Euler-Bernoulli beam.
    
    Args:
        network_fn: Network function
        params: Network parameters
        config: Beam configuration with boundary conditions
        
    Returns:
        Sum of squared boundary condition violations
    """
    L = config.length
    bc = config.boundary
    
    def scalar_network(xi):
        return network_fn(params, jnp.array([xi]), L)[0]
    
    # Derivatives
    dw = grad(scalar_network)
    d2w = grad(dw)
    d3w = grad(d2w)
    
    # Boundary points
    x0 = 0.0
    xL = L
    
    # Get values at boundaries
    w_0 = scalar_network(x0)
    w_L = scalar_network(xL)
    dw_0 = dw(x0)
    dw_L = dw(xL)
    d2w_0 = d2w(x0)  # Proportional to moment
    d2w_L = d2w(xL)
    d3w_0 = d3w(x0)  # Proportional to shear
    d3w_L = d3w(xL)
    
    bc_loss = 0.0
    
    if bc == BoundaryCondition.SIMPLY_SUPPORTED:
        # w(0) = 0, w(L) = 0, M(0) = 0, M(L) = 0
        bc_loss = w_0**2 + w_L**2 + d2w_0**2 + d2w_L**2
        
    elif bc == BoundaryCondition.FIXED_FIXED:
        # w(0) = 0, w(L) = 0, θ(0) = 0, θ(L) = 0
        bc_loss = w_0**2 + w_L**2 + dw_0**2 + dw_L**2
        
    elif bc == BoundaryCondition.CANTILEVER:
        # w(0) = 0, θ(0) = 0, V(L) = 0, M(L) = 0
        bc_loss = w_0**2 + dw_0**2 + d3w_L**2 + d2w_L**2
        
    elif bc == BoundaryCondition.FIXED_PINNED:
        # w(0) = 0, θ(0) = 0, w(L) = 0, M(L) = 0
        bc_loss = w_0**2 + dw_0**2 + w_L**2 + d2w_L**2
    
    else:
        # Default: simply supported
        bc_loss = w_0**2 + w_L**2 + d2w_0**2 + d2w_L**2
    
    return bc_loss


def boundary_loss_timoshenko(
    network_fn: Callable,
    params: Any,
    config: TimoshenkoConfig
) -> jnp.ndarray:
    """
    Compute boundary condition loss for Timoshenko beam.
    
    Args:
        network_fn: Network function returning (w, θ)
        params: Network parameters
        config: Timoshenko beam configuration
        
    Returns:
        Sum of squared boundary condition violations
    """
    L = config.length
    bc = config.boundary
    EI = config.EI
    GA_kappa = config.GA_kappa
    
    def get_outputs(xi):
        w, theta = network_fn(params, jnp.array([xi]), L)
        return w[0], theta[0]
    
    def get_w(xi):
        w, _ = get_outputs(xi)
        return w
    
    def get_theta(xi):
        _, theta = get_outputs(xi)
        return theta
    
    # Derivatives
    dw = grad(get_w)
    dtheta = grad(get_theta)
    
    # Boundary values
    x0 = 0.0
    xL = L
    
    w_0, theta_0 = get_outputs(x0)
    w_L, theta_L = get_outputs(xL)
    dtheta_0 = dtheta(x0)  # Curvature ~ moment
    dtheta_L = dtheta(xL)
    dw_0 = dw(x0)
    dw_L = dw(xL)
    
    # Shear: V = κAG * (dw/dx - θ)
    V_0 = GA_kappa * (dw_0 - theta_0)
    V_L = GA_kappa * (dw_L - theta_L)
    
    bc_loss = 0.0
    
    if bc == BoundaryCondition.SIMPLY_SUPPORTED:
        # w(0) = 0, w(L) = 0, M(0) = 0, M(L) = 0
        bc_loss = w_0**2 + w_L**2 + dtheta_0**2 + dtheta_L**2
        
    elif bc == BoundaryCondition.FIXED_FIXED:
        # w(0) = 0, w(L) = 0, θ(0) = 0, θ(L) = 0
        bc_loss = w_0**2 + w_L**2 + theta_0**2 + theta_L**2
        
    elif bc == BoundaryCondition.CANTILEVER:
        # w(0) = 0, θ(0) = 0, V(L) = 0, M(L) = 0
        bc_loss = w_0**2 + theta_0**2 + V_L**2 + dtheta_L**2
        
    elif bc == BoundaryCondition.FIXED_PINNED:
        # w(0) = 0, θ(0) = 0, w(L) = 0, M(L) = 0
        bc_loss = w_0**2 + theta_0**2 + w_L**2 + dtheta_L**2
    
    else:
        bc_loss = w_0**2 + w_L**2 + dtheta_0**2 + dtheta_L**2
    
    return bc_loss


def boundary_loss(
    network_fn: Callable,
    params: Any,
    config: BeamConfig
) -> jnp.ndarray:
    """
    Unified boundary loss function.
    
    Automatically dispatches to correct theory.
    
    Args:
        network_fn: Network function
        params: Network parameters
        config: Beam configuration
        
    Returns:
        Boundary condition loss
    """
    if isinstance(config, TimoshenkoConfig):
        return boundary_loss_timoshenko(network_fn, params, config)
    else:
        return boundary_loss_euler_bernoulli(network_fn, params, config)


# ============================================
# COMBINED LOSS FUNCTION
# ============================================

def total_loss(
    network_fn: Callable,
    params: Any,
    x_interior: jnp.ndarray,
    config: BeamConfig,
    lambda_pde: float = 1.0,
    lambda_bc: float = 100.0
) -> Tuple[jnp.ndarray, Dict[str, jnp.ndarray]]:
    """
    Compute total PINN loss: PDE residual + boundary conditions.
    
    Loss = λ_pde * MSE(PDE residual) + λ_bc * BC_loss
    
    Args:
        network_fn: Network function
        params: Network parameters
        x_interior: Interior collocation points
        config: Beam configuration
        lambda_pde: Weight for PDE loss
        lambda_bc: Weight for boundary loss
        
    Returns:
        (total_loss, loss_components_dict)
    """
    # PDE residual loss
    if isinstance(config, TimoshenkoConfig):
        res1, res2 = timoshenko_residual(network_fn, params, x_interior, config)
        pde_loss = jnp.mean(res1**2) + jnp.mean(res2**2)
    else:
        residual = euler_bernoulli_residual(network_fn, params, x_interior, config)
        pde_loss = jnp.mean(residual**2)
    
    # Boundary condition loss
    bc_loss = boundary_loss(network_fn, params, config)
    
    # Total weighted loss
    total = lambda_pde * pde_loss + lambda_bc * bc_loss
    
    components = {
        'pde_loss': pde_loss,
        'bc_loss': bc_loss,
        'total_loss': total
    }
    
    return total, components
