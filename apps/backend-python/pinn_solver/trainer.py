"""
trainer.py - Training Loop for PINN Beam Solver

Features:
- Adam optimizer with exponential learning rate decay
- Adaptive boundary condition loss weighting
- Progress callbacks for real-time monitoring
- Early stopping based on convergence
"""

import jax
import jax.numpy as jnp
from jax import jit, value_and_grad
import optax
from dataclasses import dataclass, field
from typing import Callable, Optional, Dict, Any, List, Tuple
import time

from .network import BeamPINN, create_network
from .physics_loss import total_loss
from .beam_configs import BeamConfig, EulerBernoulliConfig, TimoshenkoConfig


@dataclass
class TrainingConfig:
    """Configuration for PINN training."""
    
    # Training parameters
    num_epochs: int = 5000
    learning_rate: float = 1e-3
    lr_decay_rate: float = 0.95
    lr_decay_steps: int = 500
    
    # Collocation points
    num_interior_points: int = 100
    num_boundary_points: int = 2
    
    # Loss weights
    lambda_pde: float = 1.0
    lambda_bc: float = 100.0
    bc_weight_schedule: str = "constant"  # "constant", "increasing", "adaptive"
    
    # Early stopping
    early_stopping: bool = True
    patience: int = 500
    min_delta: float = 1e-8
    
    # Network architecture
    hidden_dims: List[int] = field(default_factory=lambda: [64, 64, 64])
    num_fourier: int = 6
    activation: str = "tanh"
    
    # Random seed
    seed: int = 42


@dataclass
class TrainingResult:
    """Result from PINN training."""
    params: Any
    final_loss: float
    loss_history: List[float]
    pde_loss_history: List[float]
    bc_loss_history: List[float]
    training_time_seconds: float
    epochs_trained: int
    converged: bool
    config: TrainingConfig


class PINNTrainer:
    """
    Trainer for Physics-Informed Neural Networks.
    
    Usage:
        config = TrainingConfig(num_epochs=5000)
        beam = EulerBernoulliConfig(length=10.0, load=LoadConfig(...))
        
        trainer = PINNTrainer(beam, config)
        result = trainer.train()
        
        # Use trained model
        x = jnp.linspace(0, 10, 100)
        w = trainer.predict(x)
    """
    
    def __init__(
        self,
        beam_config: BeamConfig,
        training_config: Optional[TrainingConfig] = None,
        progress_callback: Optional[Callable[[int, Dict], None]] = None
    ):
        """
        Initialize trainer.
        
        Args:
            beam_config: Beam configuration (Euler-Bernoulli or Timoshenko)
            training_config: Training hyperparameters
            progress_callback: Optional callback(epoch, metrics) for progress updates
        """
        self.beam_config = beam_config
        self.config = training_config or TrainingConfig()
        self.progress_callback = progress_callback
        
        # Determine beam theory
        self.theory = "timoshenko" if isinstance(beam_config, TimoshenkoConfig) else "euler_bernoulli"
        
        # Create network
        self.network = create_network(
            theory=self.theory,
            hidden_dims=self.config.hidden_dims,
            num_fourier=self.config.num_fourier,
            activation=self.config.activation
        )
        
        # Initialize parameters
        self.key = jax.random.PRNGKey(self.config.seed)
        self.params = None
        
        # Training state
        self.trained = False
        self.result: Optional[TrainingResult] = None
    
    def _create_loss_fn(self) -> Callable:
        """Create JIT-compiled loss function."""
        network = self.network
        beam_config = self.beam_config
        
        def loss_fn(params, x_interior, lambda_pde, lambda_bc):
            return total_loss(
                network_fn=lambda p, x, L: network(p, x, L),
                params=params,
                x_interior=x_interior,
                config=beam_config,
                lambda_pde=lambda_pde,
                lambda_bc=lambda_bc
            )
        
        return loss_fn
    
    def _sample_collocation_points(self, key: jax.random.PRNGKey) -> jnp.ndarray:
        """Sample interior collocation points."""
        L = self.beam_config.length
        n = self.config.num_interior_points
        
        # Uniform random sampling in (0, L)
        points = jax.random.uniform(key, (n,), minval=0.01*L, maxval=0.99*L)
        
        return points
    
    def _get_bc_weight(self, epoch: int) -> float:
        """Get boundary condition loss weight based on schedule."""
        base_weight = self.config.lambda_bc
        
        if self.config.bc_weight_schedule == "constant":
            return base_weight
            
        elif self.config.bc_weight_schedule == "increasing":
            # Linear increase from 1 to base_weight over first 1000 epochs
            progress = min(1.0, epoch / 1000)
            return 1.0 + (base_weight - 1.0) * progress
            
        elif self.config.bc_weight_schedule == "adaptive":
            # This would require tracking loss components
            return base_weight
        
        return base_weight
    
    def train(self) -> TrainingResult:
        """
        Train the PINN.
        
        Returns:
            TrainingResult with trained parameters and metrics
        """
        start_time = time.time()
        
        # Initialize parameters
        key, init_key = jax.random.split(self.key)
        self.params = self.network.init(init_key)
        
        # Create optimizer with learning rate schedule
        schedule = optax.exponential_decay(
            init_value=self.config.learning_rate,
            transition_steps=self.config.lr_decay_steps,
            decay_rate=self.config.lr_decay_rate
        )
        optimizer = optax.adam(learning_rate=schedule)
        opt_state = optimizer.init(self.params)
        
        # Create loss function
        loss_fn = self._create_loss_fn()
        
        # JIT compile training step
        @jit
        def train_step(params, opt_state, x_interior, lambda_pde, lambda_bc):
            (loss, components), grads = value_and_grad(loss_fn, has_aux=True)(
                params, x_interior, lambda_pde, lambda_bc
            )
            updates, new_opt_state = optimizer.update(grads, opt_state, params)
            new_params = optax.apply_updates(params, updates)
            return new_params, new_opt_state, loss, components
        
        # Training history
        loss_history = []
        pde_loss_history = []
        bc_loss_history = []
        
        # Early stopping state
        best_loss = float('inf')
        patience_counter = 0
        converged = False
        
        # Training loop
        for epoch in range(self.config.num_epochs):
            # Resample collocation points periodically for better coverage
            if epoch % 100 == 0:
                key, sample_key = jax.random.split(key)
                x_interior = self._sample_collocation_points(sample_key)
            
            # Get current BC weight
            lambda_bc = self._get_bc_weight(epoch)
            
            # Training step
            self.params, opt_state, loss, components = train_step(
                self.params, opt_state, x_interior,
                self.config.lambda_pde, lambda_bc
            )
            
            # Record history
            loss_val = float(loss)
            loss_history.append(loss_val)
            pde_loss_history.append(float(components['pde_loss']))
            bc_loss_history.append(float(components['bc_loss']))
            
            # Early stopping check
            if self.config.early_stopping:
                if loss_val < best_loss - self.config.min_delta:
                    best_loss = loss_val
                    patience_counter = 0
                else:
                    patience_counter += 1
                
                if patience_counter >= self.config.patience:
                    converged = True
                    if self.progress_callback:
                        self.progress_callback(epoch, {
                            'status': 'converged',
                            'loss': loss_val
                        })
                    break
            
            # Progress callback
            if self.progress_callback and epoch % 100 == 0:
                self.progress_callback(epoch, {
                    'loss': loss_val,
                    'pde_loss': components['pde_loss'],
                    'bc_loss': components['bc_loss'],
                    'progress': epoch / self.config.num_epochs
                })
        
        training_time = time.time() - start_time
        
        # Create result
        self.result = TrainingResult(
            params=self.params,
            final_loss=loss_history[-1],
            loss_history=loss_history,
            pde_loss_history=pde_loss_history,
            bc_loss_history=bc_loss_history,
            training_time_seconds=training_time,
            epochs_trained=len(loss_history),
            converged=converged,
            config=self.config
        )
        
        self.trained = True
        return self.result
    
    def predict(self, x: jnp.ndarray) -> jnp.ndarray:
        """
        Predict deflection at given positions.
        
        Args:
            x: Position array (physical coordinates)
            
        Returns:
            Predicted deflection w(x)
        """
        if not self.trained or self.params is None:
            raise RuntimeError("Model not trained. Call train() first.")
        
        L = self.beam_config.length
        return self.network(self.params, x, L)
    
    def predict_full(self, x: jnp.ndarray) -> Dict[str, jnp.ndarray]:
        """
        Predict all outputs (deflection, rotation, moment, shear).
        
        Args:
            x: Position array
            
        Returns:
            Dict with 'deflection', 'rotation', 'moment', 'shear'
        """
        if not self.trained or self.params is None:
            raise RuntimeError("Model not trained. Call train() first.")
        
        L = self.beam_config.length
        EI = self.beam_config.EI
        
        # Get deflection
        if self.theory == "timoshenko":
            w, theta = self.network(self.params, x, L)
        else:
            w = self.network(self.params, x, L)
            # Compute rotation as dw/dx for Euler-Bernoulli
            def scalar_w(xi):
                return self.network(self.params, jnp.array([xi]), L)[0]
            theta = jax.vmap(jax.grad(scalar_w))(x)
        
        # Compute moment (M = -EI * d²w/dx² for E-B, M = EI * dθ/dx for Timoshenko)
        def get_w(xi):
            if self.theory == "timoshenko":
                w_val, _ = self.network(self.params, jnp.array([xi]), L)
            else:
                w_val = self.network(self.params, jnp.array([xi]), L)
            return w_val[0]
        
        def get_theta(xi):
            if self.theory == "timoshenko":
                _, theta_val = self.network(self.params, jnp.array([xi]), L)
                return theta_val[0]
            else:
                return jax.grad(get_w)(xi)
        
        # Derivatives for moment and shear
        d2w = jax.grad(jax.grad(get_w))
        dtheta = jax.grad(get_theta)
        
        if self.theory == "timoshenko":
            moment = EI * jax.vmap(dtheta)(x)
            GA_kappa = self.beam_config.GA_kappa
            dw = jax.grad(get_w)
            shear = GA_kappa * (jax.vmap(dw)(x) - theta)
        else:
            moment = -EI * jax.vmap(d2w)(x)
            d3w = jax.grad(d2w)
            shear = -EI * jax.vmap(d3w)(x)
        
        return {
            'deflection': w,
            'rotation': theta,
            'moment': moment,
            'shear': shear
        }


def train_beam_pinn(
    beam_config: BeamConfig,
    training_config: Optional[TrainingConfig] = None,
    progress_callback: Optional[Callable] = None
) -> Tuple[Any, TrainingResult]:
    """
    Convenience function to train a PINN for beam analysis.
    
    Args:
        beam_config: Beam configuration
        training_config: Optional training config
        progress_callback: Optional progress callback
        
    Returns:
        (trained_params, training_result)
    """
    trainer = PINNTrainer(beam_config, training_config, progress_callback)
    result = trainer.train()
    return trainer.params, result
