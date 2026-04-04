"""
Analysis Module - Structural Analysis Tools

NOTE: This module has been refactored to enforce Rust-first architecture.
- Simple beam solver deleted (use Rust backend via rust_interop)
- Element classes deleted (use Rust backend via rust_interop)
- All computational logic delegated to Rust for speed and correctness
- Python layer now serves as orchestration and API gateway

Compatibility policy:
- Re-exports below are maintained for active API compatibility only.
- New solver integrations should use analysis.rust_interop and Rust endpoints.
"""

# NOTE: SimpleBeamSolver module deleted — use Rust backend for beam analysis
# from .solver import (...)  # DELETED - Rust is authoritative

from .fea_engine import (
    FEAEngine,
    analyze_frame,
    ModelInput,
    NodeInput,
    MemberInput,
    NodeLoadInput,
    PointLoadInput,
    DistributedLoadInput,
    AnalysisOutput,
    MemberResults,
    NodeResults,
    AnalysisOptions  # AISC 360-16 Direct Analysis support
)

from .load_engine import (
    LoadEngine,
    LoadCase,
    LoadCombination,
    NodalLoad,
    UniformLoad,
    TrapezoidalLoad,
    PointLoadOnMember,
    MomentOnMember,
    FloorLoad,
    TemperatureLoad,
    PrestressLoad,
    LoadDirection,
    create_self_weight_loads
)

# Advanced Solvers removed (Rust-only). Kept LSD below.

# Limit State Design (LSD) - RC Beam Design per IS 456:2000
from .solvers.rc_lsd import (
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

from .solvers.rc_limit_state_design import LimitStateDesignBeam

from .solvers.lsd_integration import (
    design_rc_beam,
    RCBeamDesigner,
    DesignInput,
    LoadFactoring
)

# NOTE: PostProcessor module deleted — use Rust backend for result processing
# Interoperability
from .interop import (
    STAADImporter,
    STAADExporter,
    JSONModelIO,
    ExcelExporter,
    DXFImporter,
    OpenBeamAPI,
    ReportDataGenerator,
    StructuralModel,
    Node,
    Member
)

# NOTE: Element classes deleted — use Rust backend via rust_interop
# from .elements import (...)  # DELETED - Rust is authoritative for element formulations


__all__ = [
    # NOTE: BeamSolver components deleted (use Rust backend)
    # Beam Solver: BeamSolver, BeamAnalysisInput, BeamAnalysisResult, Load, LoadType, Support, DiagramData
    
    # FEA Engine
    "FEAEngine",
    "analyze_frame",
    "ModelInput",
    "NodeInput",
    "MemberInput",
    "NodeLoadInput",
    "PointLoadInput",
    "DistributedLoadInput",
    "AnalysisOutput",
    "MemberResults",
    "NodeResults",
    "AnalysisOptions",  # AISC 360-16 Direct Analysis
    # Load Engine
    "LoadEngine",
    "LoadCase",
    "LoadCombination",
    "NodalLoad",
    "UniformLoad",
    "TrapezoidalLoad",
    "PointLoadOnMember",
    "MomentOnMember",
    "FloorLoad",
    "TemperatureLoad",
    "PrestressLoad",
    "LoadDirection",
    "create_self_weight_loads",
    # Advanced Solvers removed (use Rust backend)
    # Limit State Design (IS 456:2000 RC Beam Design)
    "LimitStateDesignBeam",
    "LimitingMomentCalculator",
    "BeamSection",
    "ConcreteProperties",
    "RebarProperties",
    "ConcreteGrade",
    "RebarGrade",
    "LimitingMomentResult",
    "BendingDesignResult",
    "ShearDesignResult",
    "LSDDesignResult",
    "BendingDesigner",
    "ShearDesigner",
    "design_rc_beam",
    "RCBeamDesigner",
    "DesignInput",
    "LoadFactoring",
    # NOTE: PostProcessor classes removed (use Rust backend)
    # NOTE: Element classes removed (use Rust backend)
    # Advanced Element Formulations moved to Rust backend (plates, solids, advanced beam theories)
    # Interoperability
    "STAADImporter",
    "STAADExporter",
    "JSONModelIO",
    "ExcelExporter",
    "DXFImporter",
    "OpenBeamAPI",
    "ReportDataGenerator",
    "StructuralModel",
    "Node",
    "Member",
]

