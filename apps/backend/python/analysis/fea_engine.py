"""Compatibility FEA engine facade.

This module preserves the legacy Python FEA API surface so existing imports
continue to work during the Rust-first migration.
"""

from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Dict, List, Optional


@dataclass
class AnalysisOptions:
    """Analysis options retained for backward-compatible request schemas."""

    direct_analysis: bool = False
    stiffness_reduction_factor: float = 0.8
    tau_b_enabled: bool = True
    apply_notional_loads: bool = False
    notional_load_factor: float = 0.002
    include_p_delta: bool = False
    p_delta_tolerance: float = 0.01
    p_delta_max_iterations: int = 10
    include_geometric_nonlinearity: bool = False


class SupportType(Enum):
    NONE = "none"
    FIXED = "fixed"
    PINNED = "pinned"
    ROLLER = "roller"
    ROLLER_X = "roller_x"
    ROLLER_Z = "roller_z"


class LoadType(Enum):
    POINT = "point"
    DISTRIBUTED = "distributed"
    MOMENT = "moment"


@dataclass
class NodeInput:
    id: str
    x: float
    y: float
    z: float
    support: str = "none"


@dataclass
class MemberInput:
    id: str
    start_node_id: str
    end_node_id: str
    E: float = 200e6
    G: float = 77e6
    Iy: float = 1e-4
    Iz: float = 1e-4
    J: float = 1e-5
    A: float = 0.01
    section_name: Optional[str] = None
    material_name: Optional[str] = None


@dataclass
class PointLoadInput:
    member_id: str
    direction: str
    magnitude: float
    position: float = 0.5
    is_ratio: bool = True


@dataclass
class DistributedLoadInput:
    member_id: str
    direction: str
    w1: float
    w2: float
    start_pos: float = 0.0
    end_pos: float = 1.0
    is_ratio: bool = True


@dataclass
class NodeLoadInput:
    node_id: str
    fx: float = 0.0
    fy: float = 0.0
    fz: float = 0.0
    mx: float = 0.0
    my: float = 0.0
    mz: float = 0.0


@dataclass
class SettingsInput:
    self_weight: bool = True


@dataclass
class ModelInput:
    nodes: List[NodeInput]
    members: List[MemberInput]
    node_loads: List[NodeLoadInput] = field(default_factory=list)
    point_loads: List[PointLoadInput] = field(default_factory=list)
    distributed_loads: List[DistributedLoadInput] = field(default_factory=list)
    load_case: str = "LC1"
    settings: SettingsInput = field(default_factory=SettingsInput)


@dataclass
class MemberResults:
    member_id: str
    length: float
    x_values: List[float] = field(default_factory=list)
    shear_y: List[float] = field(default_factory=list)
    shear_z: List[float] = field(default_factory=list)
    moment_y: List[float] = field(default_factory=list)
    moment_z: List[float] = field(default_factory=list)
    axial: List[float] = field(default_factory=list)
    torsion: List[float] = field(default_factory=list)
    deflection_y: List[float] = field(default_factory=list)
    deflection_z: List[float] = field(default_factory=list)
    max_shear_y: float = 0.0
    max_shear_z: float = 0.0
    max_moment_y: float = 0.0
    max_moment_z: float = 0.0
    max_deflection: float = 0.0


@dataclass
class NodeResults:
    node_id: str
    displacement: Dict[str, float] = field(default_factory=dict)
    reaction: Optional[Dict[str, float]] = None


@dataclass
class AnalysisOutput:
    success: bool
    error: Optional[str] = None
    nodes: List[NodeResults] = field(default_factory=list)
    members: List[MemberResults] = field(default_factory=list)
    max_displacement: float = 0.0
    max_moment: float = 0.0
    max_shear: float = 0.0


class FEAEngine:
    """Compatibility stub for legacy callers.

    Python FEA solving has been superseded by the Rust backend.
    """

    def __init__(self, *args: Any, **kwargs: Any) -> None:
        self.options = kwargs.get("options")

    def build_model(self, payload: Dict[str, Any]) -> None:
        _ = payload

    def analyze(self, *args: Any, **kwargs: Any) -> AnalysisOutput:
        _ = args, kwargs
        return AnalysisOutput(
            success=False,
            error="Python FEA solver removed; use Rust backend endpoint instead",
        )


def analyze_frame(model_dict: Dict[str, Any]) -> Dict[str, Any]:
    """Legacy helper preserved for callers that still import this symbol."""

    _ = model_dict
    return {
        "success": False,
        "error": "Python FEA solver removed; use Rust backend endpoint instead",
        "nodes": [],
        "members": [],
        "max_displacement": 0.0,
        "max_moment": 0.0,
        "max_shear": 0.0,
    }


__all__ = [
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
    "AnalysisOptions",
]
