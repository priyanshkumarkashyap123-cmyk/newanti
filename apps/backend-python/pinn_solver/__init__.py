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
__version__ = "1.0.0"

# Expose light-weight, JAX-free configuration dataclasses always.
# Import heavy JAX-dependent modules conditionally so importing the
# package does not fail when JAX is not installed (e.g. CI or lightweight
# test runs).

# Publicly available configs
__all__ = [
    # Configs
    "BeamConfig",
    "EulerBernoulliConfig",
    "TimoshenkoConfig",
    "LoadConfig",
    "LoadType",
    "BoundaryCondition",
]

# Always import configs (they are pure dataclasses / numpy-friendly)
from .beam_configs import (
    BeamConfig,
    EulerBernoulliConfig,
    TimoshenkoConfig,
    LoadConfig,
    LoadType,
    BoundaryCondition,
)

# Try to import JAX and JAX-dependent modules. If unavailable, provide
# benign placeholders and avoid raising during package import.
__jax_available__ = False

def _make_missing(name: str):
    def _proxy(*_args, **_kwargs):
        raise ImportError(
            f"{name} requires JAX and the optional PINN dependencies. "
            "Install jax and related packages to use this functionality."
        )
    return _proxy

try:
    # Importing these modules will raise if JAX isn't installed; guard it.
    import jax  # type: ignore

    from .network import BeamPINN, create_network  # type: ignore
    from .physics_loss import (
        euler_bernoulli_residual,
        timoshenko_residual,
        boundary_loss,
    )  # type: ignore
    from .trainer import PINNTrainer, TrainingConfig  # type: ignore
    from .inference import PINNPredictor, predict_deflection  # type: ignore

    __jax_available__ = True

    # Extend public API to include JAX-backed features when available
    __all__.extend([
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
    ])
except Exception:
    # Provide helpful fallback proxies so import-time access is safe; any
    # attempt to *use* the missing features will raise a clear error.
    BeamPINN = None
    create_network = _make_missing("create_network")
    euler_bernoulli_residual = _make_missing("euler_bernoulli_residual")
    timoshenko_residual = _make_missing("timoshenko_residual")
    boundary_loss = _make_missing("boundary_loss")
    PINNTrainer = _make_missing("PINNTrainer")
    TrainingConfig = None
    PINNPredictor = None
    predict_deflection = _make_missing("predict_deflection")

