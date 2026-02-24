"""
network.py - JAX Neural Network Architecture for Beam PINN

Implements a Multi-Layer Perceptron (MLP) with:
- Fourier feature positional encoding for smooth deflection curves
- Residual connections for training stability
- Flexible activation functions
"""

import jax
import jax.numpy as jnp
from jax import random
from typing import List, Tuple, Callable, Optional
from functools import partial


def init_mlp_params(
    key: jax.random.PRNGKey,
    layer_sizes: List[int],
    scale: float = 0.1
) -> List[Tuple[jnp.ndarray, jnp.ndarray]]:
    """
    Initialize MLP parameters using Xavier/Glorot initialization.
    
    Args:
        key: JAX random key
        layer_sizes: List of layer sizes [input, hidden1, hidden2, ..., output]
        scale: Scaling factor for initialization
        
    Returns:
        List of (weight, bias) tuples for each layer
    """
    params = []
    keys = random.split(key, len(layer_sizes) - 1)
    
    for i, (key_i, n_in, n_out) in enumerate(zip(keys, layer_sizes[:-1], layer_sizes[1:])):
        # Xavier initialization
        w_scale = scale * jnp.sqrt(2.0 / (n_in + n_out))
        w = random.normal(key_i, (n_in, n_out)) * w_scale
        b = jnp.zeros(n_out)
        params.append((w, b))
    
    return params


def fourier_encoding(x: jnp.ndarray, num_frequencies: int = 6) -> jnp.ndarray:
    """
    Apply Fourier feature encoding to input.
    
    Maps x to [x, sin(πx), cos(πx), sin(2πx), cos(2πx), ...]
    
    This helps the network learn high-frequency variations in deflection.
    
    Args:
        x: Input positions, shape (N, 1) normalized to [0, 1]
        num_frequencies: Number of frequency components
        
    Returns:
        Encoded features, shape (N, 1 + 2*num_frequencies)
    """
    # Ensure 2D shape
    x = x.reshape(-1, 1)
    
    # Frequency bands: [1, 2, 3, ..., num_frequencies]
    frequencies = jnp.arange(1, num_frequencies + 1).astype(jnp.float32)
    
    # Compute sin and cos for each frequency
    x_scaled = jnp.pi * x * frequencies  # (N, num_frequencies)
    
    encoded = jnp.concatenate([
        x,                          # Original normalized position
        jnp.sin(x_scaled),          # Sin components
        jnp.cos(x_scaled),          # Cos components
    ], axis=-1)
    
    return encoded


@partial(jax.jit, static_argnums=(3, 4))
def mlp_forward(
    params: List[Tuple[jnp.ndarray, jnp.ndarray]],
    x: jnp.ndarray,
    L: float,
    activation: str = "tanh",
    num_fourier: int = 6
) -> jnp.ndarray:
    """
    Forward pass through the PINN network.
    
    Args:
        params: Network parameters [(W1, b1), (W2, b2), ...]
        x: Input positions (physical coordinates)
        L: Beam length for normalization
        activation: Activation function ('tanh', 'sin', 'gelu')
        num_fourier: Number of Fourier features
        
    Returns:
        Predicted deflection w(x)
    """
    # Normalize input to [0, 1]
    x_norm = x / L
    
    # Apply Fourier encoding
    h = fourier_encoding(x_norm, num_fourier)
    
    # Select activation function
    if activation == "tanh":
        act_fn = jnp.tanh
    elif activation == "sin":
        act_fn = jnp.sin
    elif activation == "gelu":
        act_fn = jax.nn.gelu
    else:
        act_fn = jnp.tanh
    
    # Hidden layers with activation
    for w, b in params[:-1]:
        h = act_fn(h @ w + b)
    
    # Output layer (no activation - deflection can be any real value)
    w_out, b_out = params[-1]
    output = h @ w_out + b_out
    
    # Only squeeze if single output dimension
    if output.shape[-1] == 1:
        return output.squeeze(-1)
    return output


class BeamPINN:
    """
    Physics-Informed Neural Network for beam deflection.
    
    Attributes:
        hidden_dims: List of hidden layer dimensions
        num_fourier: Number of Fourier encoding frequencies
        activation: Activation function name
    """
    
    def __init__(
        self,
        hidden_dims: List[int] = [64, 64, 64],
        num_fourier: int = 6,
        activation: str = "tanh",
        output_dim: int = 1
    ):
        """
        Initialize PINN architecture.
        
        Args:
            hidden_dims: Hidden layer dimensions
            num_fourier: Fourier encoding frequencies
            activation: Activation function ('tanh', 'sin', 'gelu')
            output_dim: Output dimension (1 for Euler-Bernoulli, 2 for Timoshenko)
        """
        self.hidden_dims = hidden_dims
        self.num_fourier = num_fourier
        self.activation = activation
        self.output_dim = output_dim
        
        # Input dimension after Fourier encoding
        self.input_dim = 1 + 2 * num_fourier
        
        # Full layer sizes
        self.layer_sizes = [self.input_dim] + hidden_dims + [output_dim]
    
    def init(self, key: jax.random.PRNGKey) -> List[Tuple[jnp.ndarray, jnp.ndarray]]:
        """
        Initialize network parameters.
        
        Args:
            key: JAX random key
            
        Returns:
            Initialized parameters
        """
        return init_mlp_params(key, self.layer_sizes)
    
    def apply(
        self,
        params: List[Tuple[jnp.ndarray, jnp.ndarray]],
        x: jnp.ndarray,
        L: float
    ) -> jnp.ndarray:
        """
        Forward pass (alias for __call__).
        
        Args:
            params: Network parameters
            x: Input positions
            L: Beam length
            
        Returns:
            Predicted deflection
        """
        return mlp_forward(params, x, L, self.activation, self.num_fourier)
    
    def __call__(
        self,
        params: List[Tuple[jnp.ndarray, jnp.ndarray]],
        x: jnp.ndarray,
        L: float
    ) -> jnp.ndarray:
        """
        Forward pass through network.
        
        Args:
            params: Network parameters
            x: Input positions (can be scalar, 1D, or 2D)
            L: Beam length for normalization
            
        Returns:
            Predicted deflection w(x)
        """
        return self.apply(params, x, L)


class TimoshenkoBeamPINN(BeamPINN):
    """
    PINN for Timoshenko beam theory.
    
    Outputs both deflection w(x) and rotation θ(x).
    """
    
    def __init__(
        self,
        hidden_dims: List[int] = [64, 64, 64],
        num_fourier: int = 6,
        activation: str = "tanh"
    ):
        super().__init__(
            hidden_dims=hidden_dims,
            num_fourier=num_fourier,
            activation=activation,
            output_dim=2  # w and θ
        )
    
    def apply(
        self,
        params: List[Tuple[jnp.ndarray, jnp.ndarray]],
        x: jnp.ndarray,
        L: float
    ) -> Tuple[jnp.ndarray, jnp.ndarray]:
        """
        Forward pass returning both deflection and rotation.
        
        Args:
            params: Network parameters
            x: Input positions
            L: Beam length
            
        Returns:
            (w, theta) deflection and rotation
        """
        output = mlp_forward(params, x, L, self.activation, self.num_fourier)
        
        # Split output into w and theta
        if output.ndim == 1:
            # Single output (batch size 1)
            w = output[..., 0] if output.shape[-1] > 1 else output
            theta = output[..., 1] if output.shape[-1] > 1 else jnp.zeros_like(output)
        else:
            w = output[:, 0]
            theta = output[:, 1]
        
        return w, theta


def create_network(
    theory: str = "euler_bernoulli",
    hidden_dims: List[int] = [64, 64, 64],
    num_fourier: int = 6,
    activation: str = "tanh"
) -> BeamPINN:
    """
    Factory function to create appropriate PINN for beam theory.
    
    Args:
        theory: 'euler_bernoulli' or 'timoshenko'
        hidden_dims: Hidden layer dimensions
        num_fourier: Fourier encoding frequencies
        activation: Activation function
        
    Returns:
        Appropriate BeamPINN instance
    """
    if theory.lower() == "timoshenko":
        return TimoshenkoBeamPINN(
            hidden_dims=hidden_dims,
            num_fourier=num_fourier,
            activation=activation
        )
    else:
        return BeamPINN(
            hidden_dims=hidden_dims,
            num_fourier=num_fourier,
            activation=activation,
            output_dim=1
        )
