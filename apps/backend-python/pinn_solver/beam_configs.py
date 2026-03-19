"""
beam_configs.py - Configuration dataclasses for PINN beam analysis

Defines beam geometry, material properties, load configurations,
and boundary conditions for both Euler-Bernoulli and Timoshenko beams.
"""

from dataclasses import dataclass, field
from enum import Enum
from typing import List, Optional, Callable
import warnings

# JAX is an optional dependency (heavy). Prefer jax.numpy when available
# for PINN performance; fall back to NumPy for environments without JAX
try:
    import jax.numpy as jnp  # type: ignore
    _USING_JAX = True
except Exception:  # pragma: no cover - optional fallback
    import numpy as jnp
    _USING_JAX = False
    warnings.warn(
        "jax is not installed — falling back to numpy in pinn_solver.beam_configs. "
        "Install jax for improved PINN performance (tests will run with numpy).",
        RuntimeWarning,
    )


class BoundaryCondition(str, Enum):
    """Standard boundary condition types"""
    SIMPLY_SUPPORTED = "simply_supported"  # w(0)=0, w(L)=0, M(0)=0, M(L)=0
    FIXED_FIXED = "fixed_fixed"            # w(0)=0, w(L)=0, θ(0)=0, θ(L)=0
    CANTILEVER = "cantilever"              # w(0)=0, θ(0)=0, V(L)=0, M(L)=0
    FIXED_PINNED = "fixed_pinned"          # w(0)=0, θ(0)=0, w(L)=0, M(L)=0
    PROPPED_CANTILEVER = "propped_cantilever"  # Same as fixed_pinned


class LoadType(str, Enum):
    """Load distribution types"""
    UNIFORM = "uniform"                    # Constant q along beam
    POINT = "point"                        # Concentrated load at position
    TRIANGULAR = "triangular"              # Linear from 0 to q_max
    PARABOLIC = "parabolic"                # Parabolic distribution


@dataclass
class LoadConfig:
    """Load configuration for beam analysis"""
    load_type: LoadType = LoadType.UNIFORM
    magnitude: float = -10000.0  # N/m for distributed, N for point (negative = downward)
    position: float = 0.5        # Relative position for point load (0 to 1)
    start_pos: float = 0.0       # Start position for partial loads
    end_pos: float = 1.0         # End position for partial loads
    
    def get_load_function(self, L: float) -> Callable:
        """
        Returns a JAX-compatible load function q(x).
        
        Args:
            L: Beam length
            
        Returns:
            Callable that takes x and returns load intensity
        """
        q = self.magnitude
        
        if self.load_type == LoadType.UNIFORM:
            def load_fn(x):
                in_range = (x >= self.start_pos * L) & (x <= self.end_pos * L)
                return jnp.where(in_range, q, 0.0)
            return load_fn
            
        elif self.load_type == LoadType.POINT:
            # Approximate point load as narrow Gaussian
            x0 = self.position * L
            sigma = L * 0.01  # Narrow width
            def load_fn(x):
                return q / (sigma * jnp.sqrt(2 * jnp.pi)) * jnp.exp(-0.5 * ((x - x0) / sigma) ** 2)
            return load_fn
            
        elif self.load_type == LoadType.TRIANGULAR:
            def load_fn(x):
                # Linear from 0 at x=0 to q at x=L
                return q * (x / L)
            return load_fn
            
        elif self.load_type == LoadType.PARABOLIC:
            def load_fn(x):
                # Parabolic: q * 4 * (x/L) * (1 - x/L)
                xi = x / L
                return q * 4 * xi * (1 - xi)
            return load_fn
        
        else:
            # Default uniform
            return lambda x: jnp.full_like(x, q)


@dataclass  
class BeamConfig:
    """Base beam configuration"""
    length: float = 10.0          # Beam length (m)
    E: float = 200e9              # Young's modulus (Pa)
    I: float = 1e-4               # Second moment of area (m^4)
    A: float = 0.01               # Cross-section area (m^2)
    boundary: BoundaryCondition = BoundaryCondition.SIMPLY_SUPPORTED
    load: LoadConfig = field(default_factory=LoadConfig)
    
    @property
    def EI(self) -> float:
        """Flexural rigidity"""
        return self.E * self.I


@dataclass
class EulerBernoulliConfig(BeamConfig):
    """
    Euler-Bernoulli beam configuration (slender beams).
    
    Assumes:
    - Plane sections remain plane and perpendicular to neutral axis
    - Shear deformation is negligible
    - Valid for L/h > 10 (slender beams)
    """
    theory: str = field(default="euler_bernoulli", init=False)


@dataclass
class TimoshenkoConfig(BeamConfig):
    """
    Timoshenko beam configuration (deep beams with shear).
    
    Additional parameters for shear deformation:
    - G: Shear modulus
    - kappa: Shear correction factor (depends on cross-section shape)
    
    Valid for any L/h ratio, including deep beams.
    """
    theory: str = field(default="timoshenko", init=False)
    G: float = 77e9               # Shear modulus (Pa), default for steel
    kappa: float = 5/6            # Shear correction factor (rectangular section)
    
    @property
    def GA_kappa(self) -> float:
        """Shear stiffness"""
        return self.kappa * self.G * self.A


@dataclass
class TrainedModelInfo:
    """Information about a trained PINN model"""
    model_id: str
    config: BeamConfig
    training_loss: float
    training_epochs: int
    training_time_seconds: float
    validation_error_percent: Optional[float] = None


@dataclass
class DeflectionResult:
    """Result from PINN prediction"""
    x: List[float]                # Position along beam
    deflection: List[float]       # Vertical deflection w(x)
    rotation: Optional[List[float]] = None    # Rotation θ(x)
    moment: Optional[List[float]] = None      # Bending moment M(x)
    shear: Optional[List[float]] = None       # Shear force V(x)
    max_deflection: float = 0.0
    max_deflection_position: float = 0.0
    inference_time_ms: float = 0.0
