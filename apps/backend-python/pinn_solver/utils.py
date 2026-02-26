"""
utils.py - Utility functions for PINN solver

Includes:
- Automatic differentiation helpers
- Fourier feature encoding
- Normalization utilities
"""

import jax
import jax.numpy as jnp
from jax import vmap, grad
from functools import partial
from typing import Callable, Tuple


def fourier_features(x: jnp.ndarray, num_frequencies: int = 10, scale: float = 1.0) -> jnp.ndarray:
    """
    Compute Fourier feature encoding for input positions.
    
    Helps neural networks learn high-frequency functions by mapping
    inputs to a higher-dimensional space using sinusoidal functions.
    
    Args:
        x: Input positions of shape (N,) or (N, 1)
        num_frequencies: Number of frequency components
        scale: Scaling factor for frequencies
        
    Returns:
        Encoded features of shape (N, 2 * num_frequencies + 1)
    """
    x = jnp.atleast_1d(x).reshape(-1, 1)
    
    # Frequency bands (exponentially spaced)
    frequencies = scale * (2.0 ** jnp.arange(num_frequencies))
    
    # Compute sin and cos features
    x_freq = x * frequencies  # (N, num_frequencies)
    features = jnp.concatenate([
        x,                      # Original input
        jnp.sin(x_freq),        # Sin features
        jnp.cos(x_freq),        # Cos features
    ], axis=-1)
    
    return features


def normalize_input(x: jnp.ndarray, L: float) -> jnp.ndarray:
    """
    Normalize position to [0, 1] range.
    
    Args:
        x: Position along beam
        L: Beam length
        
    Returns:
        Normalized position x/L
    """
    return x / L


def denormalize_output(w_normalized: jnp.ndarray, scale: float) -> jnp.ndarray:
    """
    Denormalize deflection from network output.
    
    Args:
        w_normalized: Normalized deflection from network
        scale: Scaling factor (typically max expected deflection)
        
    Returns:
        Physical deflection
    """
    return w_normalized * scale


def compute_derivative(fn: Callable, x: jnp.ndarray, order: int = 1) -> jnp.ndarray:
    """
    Compute nth-order derivative of a function using JAX autodiff.
    
    Args:
        fn: Function to differentiate (takes x, returns scalar)
        x: Points at which to evaluate derivative
        order: Order of derivative (1, 2, 3, or 4)
        
    Returns:
        Derivative values at x
    """
    df = fn
    for _ in range(order):
        df = grad(df)
    
    return vmap(df)(x)


def compute_derivatives_batch(
    network_fn: Callable,
    params: dict,
    x: jnp.ndarray,
    max_order: int = 4
) -> Tuple[jnp.ndarray, ...]:
    """
    Efficiently compute multiple derivatives of network output.
    
    Uses forward-mode AD for efficiency when computing many derivatives.
    
    Args:
        network_fn: Network function (params, x) -> w
        params: Network parameters
        x: Input positions (N,)
        max_order: Maximum derivative order to compute
        
    Returns:
        Tuple of (w, dw/dx, d²w/dx², d³w/dx³, d⁴w/dx⁴) up to max_order
    """
    # Create scalar function for a single x value
    def scalar_fn(xi):
        return network_fn(params, xi.reshape(1))[0]
    
    # Compute derivatives using forward mode
    results = []
    
    def compute_at_point(xi):
        derivs = [scalar_fn(xi)]  # w
        
        fn = scalar_fn
        for _ in range(max_order):
            fn = grad(fn)
            derivs.append(fn(xi))
        
        return jnp.array(derivs[:max_order + 1])
    
    # Vectorize over all x points
    all_derivs = vmap(compute_at_point)(x)
    
    # Unpack into separate arrays
    return tuple(all_derivs[:, i] for i in range(max_order + 1))


@partial(jax.jit, static_argnums=(0,))
def compute_pde_derivatives(
    network_fn: Callable,
    params: dict,
    x: jnp.ndarray
) -> Tuple[jnp.ndarray, jnp.ndarray, jnp.ndarray, jnp.ndarray, jnp.ndarray]:
    """
    JIT-compiled derivative computation for PDE residuals.
    
    Computes w, w', w'', w''', w'''' efficiently.
    
    Args:
        network_fn: Network forward function
        params: Network parameters
        x: Collocation points
        
    Returns:
        (w, dw_dx, d2w_dx2, d3w_dx3, d4w_dx4)
    """
    def single_point_fn(xi):
        return network_fn(params, xi.reshape(1, 1))[0, 0]
    
    # First derivative
    dw = grad(single_point_fn)
    # Second derivative
    d2w = grad(dw)
    # Third derivative
    d3w = grad(d2w)
    # Fourth derivative
    d4w = grad(d3w)
    
    # Vectorize
    w = vmap(single_point_fn)(x)
    dw_dx = vmap(dw)(x)
    d2w_dx2 = vmap(d2w)(x)
    d3w_dx3 = vmap(d3w)(x)
    d4w_dx4 = vmap(d4w)(x)
    
    return w, dw_dx, d2w_dx2, d3w_dx3, d4w_dx4


def estimate_deflection_scale(config) -> float:
    """
    Estimate maximum deflection for normalization.
    
    Uses analytical formula for simply supported beam with UDL.
    
    Args:
        config: BeamConfig instance
        
    Returns:
        Estimated maximum deflection magnitude
    """
    L = config.length
    EI = config.EI
    q = abs(config.load.magnitude)
    
    # Simply supported beam with UDL: w_max = 5qL⁴/(384EI)
    w_max = 5 * q * L**4 / (384 * EI)
    
    # Add safety factor
    return w_max * 2.0


def sample_collocation_points(
    n_interior: int,
    n_boundary: int,
    L: float,
    key: jax.random.PRNGKey
) -> Tuple[jnp.ndarray, jnp.ndarray]:
    """
    Sample collocation points for PINN training.
    
    Args:
        n_interior: Number of interior collocation points
        n_boundary: Number of boundary points (per boundary)
        L: Beam length
        key: JAX random key
        
    Returns:
        (interior_points, boundary_points)
    """
    key1, key2 = jax.random.split(key)
    
    # Interior points: uniform random in (0, L)
    interior = jax.random.uniform(key1, (n_interior,), minval=0.01*L, maxval=0.99*L)
    
    # Boundary points: exactly at x=0 and x=L
    boundary = jnp.array([0.0, L])
    
    return interior, boundary
