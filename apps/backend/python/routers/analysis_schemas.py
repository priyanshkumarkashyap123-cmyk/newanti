"""Request schemas extracted from routers.analysis for modularity."""

from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field

from routers.analysis_defaults import (
    BACKEND_AUTO,
    BACKEND_PYTHON,
    BACKEND_RUST,
    DEFAULT_BEAM_E,
    DEFAULT_BEAM_I,
    DEFAULT_BUCKLING_COMPARE_TOLERANCE,
    DEFAULT_DEBUG_COMPARE_TOLERANCE,
    DEFAULT_FRAME_E,
    DEFAULT_FRAME_G,
    DEFAULT_MAX_ITERATIONS,
    DEFAULT_MEMBER_A,
    DEFAULT_MEMBER_I,
    DEFAULT_MEMBER_J,
    DEFAULT_METHOD_AUTO,
    DEFAULT_NONLINEAR_MAX_ITEMS,
    DEFAULT_NUM_MODES,
    DEFAULT_PDELTA_COMPARE_TOLERANCE,
    DEFAULT_TOLERANCE,
    default_nonlinear_settings,
)
from routers.schemas import (
    DiaphragmInput,
    FrameMemberInput,
    FrameNodeInput,
    FramePlateInput,
    LinkElementInput,
    MemberDistLoadInput,
    NodeLoadInput,
    PlateElementInput,
    SolidElementInput,
)


class BeamLoadInput(BaseModel):
    type: str
    magnitude: float
    position: float
    end_position: Optional[float] = None
    end_magnitude: Optional[float] = None


class BeamAnalysisRequest(BaseModel):
    length: float
    loads: List[BeamLoadInput]
    E: Optional[float] = DEFAULT_BEAM_E
    I: Optional[float] = DEFAULT_BEAM_I
    backend: Optional[str] = BACKEND_PYTHON
    debug_compare: Optional[bool] = False
    debug_compare_tolerance: Optional[float] = DEFAULT_DEBUG_COMPARE_TOLERANCE


class FrameAnalysisRequest(BaseModel):
    nodes: List[FrameNodeInput]
    members: List[FrameMemberInput]
    plates: Optional[List[FramePlateInput]] = []
    node_loads: Optional[List[NodeLoadInput]] = []
    distributed_loads: Optional[List[MemberDistLoadInput]] = []
    backend: Optional[str] = BACKEND_PYTHON
    debug_compare: Optional[bool] = False
    debug_compare_tolerance: Optional[float] = DEFAULT_DEBUG_COMPARE_TOLERANCE


class LargeFrameAnalysisRequest(BaseModel):
    nodes: List[FrameNodeInput]
    members: List[FrameMemberInput]
    node_loads: Optional[List[NodeLoadInput]] = []
    method: Optional[str] = DEFAULT_METHOD_AUTO
    backend: Optional[str] = BACKEND_AUTO
    debug_compare: Optional[bool] = False
    debug_compare_tolerance: Optional[float] = DEFAULT_DEBUG_COMPARE_TOLERANCE


class NonlinearAnalysisRequest(BaseModel):
    nodes: List[Dict] = Field(default_factory=list, max_length=DEFAULT_NONLINEAR_MAX_ITEMS)
    members: List[Dict] = Field(default_factory=list, max_length=DEFAULT_NONLINEAR_MAX_ITEMS)
    node_loads: List[Dict] = Field(default_factory=list, max_length=DEFAULT_NONLINEAR_MAX_ITEMS)
    settings: Dict = Field(default_factory=default_nonlinear_settings)
    backend: Optional[str] = BACKEND_PYTHON
    debug_compare: Optional[bool] = False
    debug_compare_tolerance: Optional[float] = DEFAULT_DEBUG_COMPARE_TOLERANCE


class PDeltaAnalysisRequest(BaseModel):
    nodes: List[FrameNodeInput]
    members: List[FrameMemberInput]
    node_loads: Optional[List[NodeLoadInput]] = []
    max_iterations: Optional[int] = DEFAULT_MAX_ITERATIONS
    tolerance: Optional[float] = DEFAULT_TOLERANCE
    backend: Optional[str] = BACKEND_PYTHON
    debug_compare: Optional[bool] = False
    debug_compare_tolerance: Optional[float] = DEFAULT_PDELTA_COMPARE_TOLERANCE


class BucklingAnalysisRequest(BaseModel):
    nodes: List[FrameNodeInput]
    members: List[FrameMemberInput]
    node_loads: Optional[List[NodeLoadInput]] = []
    num_modes: Optional[int] = DEFAULT_NUM_MODES
    backend: Optional[str] = BACKEND_RUST
    debug_compare: Optional[bool] = False
    debug_compare_tolerance: Optional[float] = DEFAULT_BUCKLING_COMPARE_TOLERANCE


class AdvancedAnalysisRequest(BaseModel):
    """Deprecated: advanced analysis is Rust-only."""
    nodes: List[FrameNodeInput]
    members: Optional[List[FrameMemberInput]] = []
    node_loads: Optional[List[NodeLoadInput]] = []
    distributed_loads: Optional[List[MemberDistLoadInput]] = []
    plate_elements: Optional[List[PlateElementInput]] = []
    solid_elements: Optional[List[SolidElementInput]] = []
    link_elements: Optional[List[LinkElementInput]] = []
    diaphragms: Optional[List[DiaphragmInput]] = []
    tension_only: Optional[List[str]] = []
    compression_only: Optional[List[str]] = []
    include_self_weight: Optional[bool] = False
    solver: Optional[str] = "rust"


class StageInput(BaseModel):
    stage_id: str
    label: str
    activate_elements: List[str] = []
    remove_elements: List[str] = []
    loads: Dict[str, float] = {}
    boundary_changes: Dict[str, str] = {}
    duration_days: float = 28.0
    concrete_age_days: Optional[float] = None


class ConcreteTimeInput(BaseModel):
    fc28: float
    ec28: float
    cement_type: int = 1
    creep_ultimate: float = 2.35
    shrinkage_ultimate: float = 780e-6
    humidity: float = 60.0
    vs_ratio: float = 38.0


class StagedConstructionRequest(BaseModel):
    nodes: List[FrameNodeInput]
    members: List[FrameMemberInput]
    stages: List[StageInput]
    concrete_config: Optional[ConcreteTimeInput] = None
    time_dependent: bool = False
    node_loads: Optional[List[NodeLoadInput]] = []


class DAMLevelInput(BaseModel):
    height: float
    gravity_load: float


class DAMMemberInput(BaseModel):
    member_id: str
    length: float
    e: float
    i: float
    a: float
    fy: float
    pr: float
    k: float
    cm: float
    sway: bool = False


class DAMAnalysisRequest(BaseModel):
    nodes: List[FrameNodeInput]
    members: List[FrameMemberInput]
    levels: List[DAMLevelInput]
    dam_members: List[DAMMemberInput]
    alpha: float = 0.002
    run_pdelta: bool = True
    pdelta_tolerance: float = 1e-6
    pdelta_max_iter: int = 10
    node_loads: Optional[List[NodeLoadInput]] = []


class NonlinearSolveRequest(BaseModel):
    nodes: List[FrameNodeInput]
    members: List[FrameMemberInput]
    method: str = "newton_raphson"
    load_steps: int = 10
    target_load_factor: float = 1.0
    force_tolerance: float = 1e-6
    displacement_tolerance: float = 1e-6
    max_iterations: int = 10
    line_search: bool = False
    line_search_tolerance: float = 0.5
    initial_arc_length: float = 1.0
    geometric_nonlinearity: bool = True
    control_dof: Optional[int] = None
    control_increment: Optional[float] = None
    node_loads: Optional[List[NodeLoadInput]] = []


class MassContributionInput(BaseModel):
    case_id: str
    factor: float


class NodalGravityInput(BaseModel):
    node_id: str
    force_kn: float


class MassSourceRequest(BaseModel):
    contributions: List[MassContributionInput]
    load_cases: Dict[str, List[NodalGravityInput]]
    include_self_weight: bool = True
    self_weight_factor: float = 1.0
    element_masses: Dict[str, float] = {}
    additional_masses: Dict[str, float] = {}
    mass_type: str = "lumped"
    gravity: float = 9.80665
    dofs_per_node: int = 6
    code_preset: Optional[str] = None
    ll_fraction: Optional[float] = None


class WindTunnelTapInput(BaseModel):
    tap_id: str
    x: float
    y: float
    z: float
    face: str
    tributary_area: float
    normal: List[float]


class CpSeriesInput(BaseModel):
    wind_direction_deg: float
    q_ref: float
    sampling_rate: float
    cp_values: List[float]


class TapNodeMappingInput(BaseModel):
    tap_id: str
    node_id: str
    tributary_area: float
    normal: List[float]


class WindTunnelRequest(BaseModel):
    building_id: str
    geometric_scale: float
    velocity_scale: float
    reference_height: float = 10.0
    taps: List[WindTunnelTapInput]
    cp_data: Dict[str, List[CpSeriesInput]]
    mappings: List[TapNodeMappingInput]
    q_design: float
    peak_factor: float = 3.5
    compute_psd: bool = False


class InfluenceSurfaceRequest(BaseModel):
    span: float
    width: float
    thickness: float
    elastic_modulus: float = 30000.0
    poisson_ratio: float = 0.2
    output_x: float
    output_y: float
    grid_nx: int = 20
    grid_ny: int = 20
    scan_step_x: float = 0.5
    scan_step_y: float = 0.5
    vehicles: List[str]
    response_type: str = "deflection"


class DirectionalSpectrumInput(BaseModel):
    direction: str
    spectrum_ordinates: List[List[float]]
    scale_factor: float = 1.0


class ModalPropertiesInput(BaseModel):
    n_modes: int
    periods: List[float]
    damping_ratios: List[float]
    participation_factors: List[List[float]]
    effective_masses: List[List[float]]
    mode_shapes: List[List[float]]
    total_weight: float
    n_dofs: int


class IS1893ParamsInput(BaseModel):
    zone_factor: float
    importance_factor: float
    response_reduction: float
    soil_type: str = "II"


class ASCE7ParamsInput(BaseModel):
    sds: float
    sd1: float
    tl: float


class SpectrumDirectionalRequest(BaseModel):
    combination_method: str = "CQC"
    directional_rule: str = "100_30"
    spectra: List[DirectionalSpectrumInput]
    modal: ModalPropertiesInput
    closely_spaced_threshold: float = 0.10
    missing_mass_correction: bool = True
    code: Optional[str] = None
    is1893_params: Optional[IS1893ParamsInput] = None
    asce7_params: Optional[ASCE7ParamsInput] = None
