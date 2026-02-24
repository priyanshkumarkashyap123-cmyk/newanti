"""
PINN Solver - Physics-Informed Neural Network for Beam Deflection Analysis

A JAX-based solver supporting both Euler-Bernoulli and Timoshenko beam theories.
Provides near-instant inference after initial training.

Modules:
    - network: Neural network architecture with Fourier features
    - physics_loss: PDE residual losses for beam theories
    - trainer: Training loop with Adam optimizer
    - inference: JIT-compiled prediction functions
    - beam_configs: Configuration dataclasses
"""

from .beam_configs import (
    BeamConfig,
    EulerBernoulliConfig,
    TimoshenkoConfig,
    LoadConfig,
    LoadType,
    BoundaryCondition,
)
from .network import BeamPINN, create_network
from .physics_loss import (
    euler_bernoulli_residual,
    timoshenko_residual,
    boundary_loss,
)
from .trainer import PINNTrainer, TrainingConfig
from .inference import PINNPredictor, predict_deflection

__version__ = "1.0.0"
__all__ = [
    # Configs
    "BeamConfig",
    "EulerBernoulliConfig", 
    "TimoshenkoConfig",
    "LoadConfig",
    "LoadType",
    "BoundaryCondition",
    # Network
    "BeamPINN",
    "create_network",
    # Physics
    "euler_bernoulli_residual",
    "timoshenko_residual",
    "boundary_loss",
    # Training
    "PINNTrainer",
    "TrainingConfig",
    # Inference
    "PINNPredictor",
    "predict_deflection",
]
