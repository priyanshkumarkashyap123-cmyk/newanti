"""
inference.py - Fast Inference API for Trained PINN Models

Features:
- JIT-compiled prediction functions for sub-millisecond inference
- Model serialization/deserialization
- Batch prediction capabilities
"""

import jax
import jax.numpy as jnp
from jax import jit
import json
import pickle
from pathlib import Path
from dataclasses import dataclass, asdict
from typing import Optional, Dict, Any, List, Tuple
import time

from .network import BeamPINN, create_network, TimoshenkoBeamPINN
from .beam_configs import (
    BeamConfig,
    EulerBernoulliConfig,
    TimoshenkoConfig,
    DeflectionResult,
)


@dataclass
class SavedModel:
    """Container for saved PINN model."""
    params: Any
    config: Dict[str, Any]
    theory: str
    network_config: Dict[str, Any]
    training_loss: float
    training_epochs: int


class PINNPredictor:
    """
    Fast inference engine for trained PINN models.
    
    Usage:
        # After training
        predictor = PINNPredictor(trainer.params, beam_config, trainer.network)
        
        # Fast predictions
        x = jnp.linspace(0, 10, 100)
        result = predictor.predict(x)
        print(f"Max deflection: {result.max_deflection}")
        print(f"Inference time: {result.inference_time_ms} ms")
    """
    
    def __init__(
        self,
        params: Any,
        config: BeamConfig,
        network: Optional[BeamPINN] = None,
        network_config: Optional[Dict] = None
    ):
        """
        Initialize predictor with trained parameters.
        
        Args:
            params: Trained network parameters
            config: Beam configuration
            network: Optional pre-initialized network
            network_config: Optional network configuration dict
        """
        self.params = params
        self.config = config
        self.L = config.length
        
        # Determine theory
        self.theory = "timoshenko" if isinstance(config, TimoshenkoConfig) else "euler_bernoulli"
        
        # Create or use network
        if network is not None:
            self.network = network
        else:
            nc = network_config or {'hidden_dims': [64, 64, 64], 'num_fourier': 6, 'activation': 'tanh'}
            self.network = create_network(
                theory=self.theory,
                hidden_dims=nc.get('hidden_dims', [64, 64, 64]),
                num_fourier=nc.get('num_fourier', 6),
                activation=nc.get('activation', 'tanh')
            )
        
        # JIT compile prediction function
        self._predict_fn = self._create_predict_fn()
    
    def _create_predict_fn(self):
        """Create JIT-compiled prediction function."""
        network = self.network
        params = self.params
        L = self.L
        
        @jit
        def predict_jit(x):
            return network(params, x, L)
        
        return predict_jit
    
    def predict(self, x: jnp.ndarray) -> DeflectionResult:
        """
        Predict deflection at given positions.
        
        Args:
            x: Position array (physical coordinates, 0 to L)
            
        Returns:
            DeflectionResult with deflection, timing, and statistics
        """
        x = jnp.atleast_1d(jnp.asarray(x))
        
        # Timed inference
        start_time = time.perf_counter()
        output = self._predict_fn(x)
        inference_time = (time.perf_counter() - start_time) * 1000  # ms
        
        # Extract outputs
        if self.theory == "timoshenko":
            w, theta = output
            rotation = theta.tolist()
        else:
            w = output
            rotation = None
        
        # Find max deflection
        w_array = jnp.asarray(w)
        max_idx = jnp.argmax(jnp.abs(w_array))
        max_deflection = float(w_array[max_idx])
        max_position = float(x[max_idx])
        
        return DeflectionResult(
            x=x.tolist(),
            deflection=w.tolist(),
            rotation=rotation,
            max_deflection=max_deflection,
            max_deflection_position=max_position,
            inference_time_ms=inference_time
        )
    
    def predict_full(self, x: jnp.ndarray) -> DeflectionResult:
        """
        Predict full response (deflection, rotation, moment, shear).
        
        Args:
            x: Position array
            
        Returns:
            DeflectionResult with all response quantities
        """
        x = jnp.atleast_1d(jnp.asarray(x))
        
        start_time = time.perf_counter()
        
        # Get basic output
        output = self._predict_fn(x)
        
        if self.theory == "timoshenko":
            w, theta = output
            EI = self.config.EI
            GA_kappa = self.config.GA_kappa
            
            # Compute derivatives for moment and shear
            def get_theta(xi):
                _, th = self.network(self.params, jnp.array([xi]), self.L)
                return th[0]
            
            def get_w(xi):
                wv, _ = self.network(self.params, jnp.array([xi]), self.L)
                return wv[0]
            
            dtheta = jax.grad(get_theta)
            dw = jax.grad(get_w)
            
            moment = EI * jax.vmap(dtheta)(x)
            shear = GA_kappa * (jax.vmap(dw)(x) - theta)
            
        else:
            w = output
            EI = self.config.EI
            
            def scalar_w(xi):
                return self.network(self.params, jnp.array([xi]), self.L)[0]
            
            dw = jax.grad(scalar_w)
            d2w = jax.grad(dw)
            d3w = jax.grad(d2w)
            
            theta = jax.vmap(dw)(x)
            moment = -EI * jax.vmap(d2w)(x)
            shear = -EI * jax.vmap(d3w)(x)
        
        inference_time = (time.perf_counter() - start_time) * 1000
        
        w_array = jnp.asarray(w)
        max_idx = jnp.argmax(jnp.abs(w_array))
        
        return DeflectionResult(
            x=x.tolist(),
            deflection=w.tolist(),
            rotation=theta.tolist(),
            moment=moment.tolist(),
            shear=shear.tolist(),
            max_deflection=float(w_array[max_idx]),
            max_deflection_position=float(x[max_idx]),
            inference_time_ms=inference_time
        )
    
    def save(self, path: str, training_loss: float = 0.0, training_epochs: int = 0):
        """
        Save model to disk.
        
        Args:
            path: File path for saving
            training_loss: Final training loss
            training_epochs: Number of training epochs
        """
        # Convert config to dict
        config_dict = {
            'length': self.config.length,
            'E': self.config.E,
            'I': self.config.I,
            'A': self.config.A,
            'boundary': self.config.boundary.value,
            'load': {
                'load_type': self.config.load.load_type.value,
                'magnitude': self.config.load.magnitude,
                'position': self.config.load.position,
            }
        }
        
        if isinstance(self.config, TimoshenkoConfig):
            config_dict['G'] = self.config.G
            config_dict['kappa'] = self.config.kappa
        
        network_config = {
            'hidden_dims': self.network.hidden_dims,
            'num_fourier': self.network.num_fourier,
            'activation': self.network.activation,
        }
        
        saved = SavedModel(
            params=self.params,
            config=config_dict,
            theory=self.theory,
            network_config=network_config,
            training_loss=training_loss,
            training_epochs=training_epochs
        )
        
        with open(path, 'wb') as f:
            pickle.dump(saved, f)
    
    @classmethod
    def load(cls, path: str) -> 'PINNPredictor':
        """
        Load model from disk.
        
        Args:
            path: File path to load from
            
        Returns:
            PINNPredictor instance
        """
        with open(path, 'rb') as f:
            saved: SavedModel = pickle.load(f)
        
        # Reconstruct config
        from .beam_configs import LoadConfig, LoadType, BoundaryCondition
        
        load_config = LoadConfig(
            load_type=LoadType(saved.config['load']['load_type']),
            magnitude=saved.config['load']['magnitude'],
            position=saved.config['load']['position'],
        )
        
        if saved.theory == "timoshenko":
            config = TimoshenkoConfig(
                length=saved.config['length'],
                E=saved.config['E'],
                I=saved.config['I'],
                A=saved.config['A'],
                boundary=BoundaryCondition(saved.config['boundary']),
                load=load_config,
                G=saved.config.get('G', 77e9),
                kappa=saved.config.get('kappa', 5/6),
            )
        else:
            config = EulerBernoulliConfig(
                length=saved.config['length'],
                E=saved.config['E'],
                I=saved.config['I'],
                A=saved.config['A'],
                boundary=BoundaryCondition(saved.config['boundary']),
                load=load_config,
            )
        
        return cls(
            params=saved.params,
            config=config,
            network_config=saved.network_config
        )


def predict_deflection(
    params: Any,
    x: jnp.ndarray,
    config: BeamConfig,
    network: Optional[BeamPINN] = None
) -> DeflectionResult:
    """
    Convenience function for quick predictions.
    
    Args:
        params: Trained parameters
        x: Position array
        config: Beam configuration
        network: Optional network instance
        
    Returns:
        DeflectionResult
    """
    predictor = PINNPredictor(params, config, network)
    return predictor.predict(x)


def analytical_simply_supported_udl(
    x: jnp.ndarray,
    L: float,
    q: float,
    EI: float
) -> jnp.ndarray:
    """
    Analytical deflection for simply supported beam with UDL.
    
    w(x) = (q*x)/(24*EI) * (L³ - 2*L*x² + x³)
    
    Args:
        x: Position array
        L: Beam length
        q: Load intensity (negative = downward)
        EI: Flexural rigidity
        
    Returns:
        Deflection array
    """
    return (q * x) / (24 * EI) * (L**3 - 2*L*x**2 + x**3)


def compare_with_analytical(
    predictor: PINNPredictor,
    n_points: int = 100
) -> Dict[str, Any]:
    """
    Compare PINN predictions with analytical solution.
    
    Only works for simply supported beam with uniform load.
    
    Args:
        predictor: Trained PINNPredictor
        n_points: Number of comparison points
        
    Returns:
        Dict with comparison metrics
    """
    L = predictor.config.length
    x = jnp.linspace(0, L, n_points)
    
    # PINN prediction
    result = predictor.predict(x)
    w_pinn = jnp.array(result.deflection)
    
    # Analytical (for simply supported + UDL only)
    q = predictor.config.load.magnitude
    EI = predictor.config.EI
    w_analytical = analytical_simply_supported_udl(x, L, q, EI)
    
    # Error metrics
    abs_error = jnp.abs(w_pinn - w_analytical)
    max_error = float(jnp.max(abs_error))
    mean_error = float(jnp.mean(abs_error))
    
    # Relative error (avoid division by zero)
    w_max = float(jnp.max(jnp.abs(w_analytical)))
    relative_error_percent = (max_error / w_max) * 100 if w_max > 0 else 0.0
    
    return {
        'max_absolute_error': max_error,
        'mean_absolute_error': mean_error,
        'max_relative_error_percent': relative_error_percent,
        'w_pinn': w_pinn.tolist(),
        'w_analytical': w_analytical.tolist(),
        'x': x.tolist(),
        'inference_time_ms': result.inference_time_ms
    }
