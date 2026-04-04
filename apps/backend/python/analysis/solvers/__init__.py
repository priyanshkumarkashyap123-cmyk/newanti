"""
solvers - Advanced Analysis Solvers for BeamLab Ultimate

Modules:
- nonlinear: P-Delta and Geometric Stiffness Analysis
- dynamics: Modal Extraction and Response Spectrum Analysis
- buckling: Linear Buckling Analysis
- cable: Tension/Compression Only and Cable Elements
- rc_limit_state_design: Reinforced Concrete LSD Design per IS 456:2000
- lsd_integration: Integration with structural analysis results

Note:
- Legacy advanced solver modules were removed in favor of Rust-first analysis.
- Keep these exports only for active compatibility paths still used by API routes.
"""

"""
solvers - Python solver exports (deprecated: Rust-first).

Only keep LSD (RC design) helpers here; advanced solvers are Rust-only.
"""

from .rc_lsd import (
    LimitingMomentCalculator,
    BeamSection,
    ConcreteProperties,
    RebarProperties,
    ConcreteGrade,
    RebarGrade,
    LimitingMomentResult,
    BendingDesignResult,
    ShearDesignResult,
    LSDDesignResult,
    BendingDesigner,
    ShearDesigner,
)

from .rc_limit_state_design import LimitStateDesignBeam

from .lsd_integration import (
    design_rc_beam,
    RCBeamDesigner,
    DesignInput,
    LoadFactoring,
)

# NOTE: advanced_solver and nonlinear/buckling/cable Python solvers removed — use Rust backend.

__all__ = [
    'LimitStateDesignBeam',
    'LimitingMomentCalculator',
    'BeamSection',
    'ConcreteProperties',
    'RebarProperties',
    'ConcreteGrade',
    'RebarGrade',
    'LimitingMomentResult',
    'BendingDesignResult',
    'LSDDesignResult',
    'BendingDesigner',
    'ShearDesigner',
    'design_rc_beam',
    'RCBeamDesigner',
    'DesignInput',
    'LoadFactoring',
]
