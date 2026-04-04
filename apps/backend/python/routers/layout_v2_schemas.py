"""Pydantic request/response schemas for layout_v2 router."""

from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


class SetbacksRequest(BaseModel):
    front: float = Field(default=3.0, ge=0)
    rear: float = Field(default=1.5, ge=0)
    sides: Optional[float] = Field(default=None, ge=0, description="Symmetric left+right setback")
    left: Optional[float] = Field(default=None, ge=0)
    right: Optional[float] = Field(default=None, ge=0)


class SiteRequest(BaseModel):
    dimensions_m: List[float] = Field(
        ..., min_length=2, max_length=2,
        description="[width, height] of the plot in metres",
    )
    fsi_limit: float = Field(default=1.5, gt=0)
    setbacks_m: SetbacksRequest = Field(default_factory=SetbacksRequest)
    north_angle_deg: float = Field(default=0.0, ge=0, lt=360)
    latitude_deg: float = Field(default=28.6, description="Site latitude for solar analysis")
    num_floors: int = Field(default=1, ge=1, le=20, description="Number of storeys")
    polygon_vertices: Optional[List[List[float]]] = Field(
        default=None,
        description="General polygon site boundary as [[x,y], ...] in metres. "
                    "If omitted, rectangular dimensions_m is used.",
    )


class GlobalConstraintsRequest(BaseModel):
    max_unsupported_span_m: float = Field(default=5.0, gt=0)
    min_ceiling_height_m: float = Field(default=3.0, gt=0)
    structural_grid_module_m: float = Field(default=0.5, gt=0)
    max_riser_height_m: float = Field(default=0.19, gt=0)
    min_tread_depth_m: float = Field(default=0.25, gt=0)
    floor_to_floor_height_m: float = Field(default=3.0, gt=0)
    max_circulation_ratio: float = Field(default=0.15, gt=0, le=1.0)
    max_egress_distance_m: float = Field(default=22.0, gt=0)
    min_fenestration_ratio: float = Field(default=0.10, ge=0, le=1.0)


class RoomNodeRequest(BaseModel):
    id: str = Field(..., min_length=1, max_length=128)
    name: Optional[str] = Field(default=None, max_length=256)
    type: str = Field(
        default="habitable",
        description="One of: habitable, utility, wet, circulation, staircase",
    )
    acoustic_zone: Optional[str] = Field(
        default=None,
        description="One of: active, passive, service, buffer (auto-inferred if omitted)",
    )
    target_area_sqm: float = Field(..., gt=0)
    min_width_m: float = Field(default=2.8, gt=0)
    max_aspect_ratio: float = Field(default=1.5, gt=0)
    min_aspect_ratio: float = Field(default=1.0, gt=0)
    requires_exterior_wall: bool = False
    plumbing_required: bool = False
    priority: int = Field(default=1, ge=1, le=5)
    is_entry: bool = False
    num_doors: int = Field(default=1, ge=0, le=10)


class AdjacencyMatrixEntry(BaseModel):
    node_a: str = Field(..., min_length=1, max_length=128)
    node_b: str = Field(..., min_length=1, max_length=128)
    weight: float = Field(..., ge=-100, le=100)


class PenaltyWeightsRequest(BaseModel):
    area_deviation: float = Field(default=100.0, ge=0)
    min_width_violation: float = Field(default=500.0, ge=0)
    aspect_ratio_violation: float = Field(default=50.0, ge=0)
    adjacency_violation: float = Field(default=120.0, ge=0)
    exterior_wall_violation: float = Field(default=300.0, ge=0)
    overlap_collision: float = Field(default=1000.0, ge=0)
    fsi_violation: float = Field(default=2000.0, ge=0)
    plumbing_cluster_penalty: float = Field(default=200.0, ge=0)
    acoustic_zone_violation: float = Field(default=100.0, ge=0)
    clearance_violation: float = Field(default=400.0, ge=0)
    grid_snap_deviation: float = Field(default=30.0, ge=0)
    circulation_excess: float = Field(default=150.0, ge=0)
    span_violation: float = Field(default=800.0, ge=0)
    beam_headroom_violation: float = Field(default=600.0, ge=0)
    solar_thermal_penalty: float = Field(default=40.0, ge=0)
    fenestration_violation: float = Field(default=200.0, ge=0)
    egress_distance_violation: float = Field(default=1500.0, ge=0)
    compactness_penalty: float = Field(default=80.0, ge=0)
    zone_grouping_penalty: float = Field(default=100.0, ge=0)


class SAParamsRequest(BaseModel):
    enabled: bool = Field(default=False, description="Run SA refinement after BSP")
    initial_temp: float = Field(default=1000.0, gt=0)
    cooling_rate: float = Field(default=0.995, gt=0, lt=1)
    min_temp: float = Field(default=0.1, ge=0)
    max_iterations: int = Field(default=5000, ge=100, le=50000)
    stagnation_limit: int = Field(default=50, ge=10, le=500)


class LayoutV2Request(BaseModel):
    site: SiteRequest
    global_constraints: Optional[GlobalConstraintsRequest] = None
    nodes: List[RoomNodeRequest] = Field(..., min_length=1, max_length=200)
    adjacency_matrix: List[AdjacencyMatrixEntry] = Field(default_factory=list)
    penalty_weights: Optional[PenaltyWeightsRequest] = None
    max_iterations: int = Field(default=200, ge=1, le=5000)
    random_seed: Optional[int] = None
    sa_params: Optional[SAParamsRequest] = Field(
        default=None,
        description="Simulated Annealing refinement. Warm-starts from BSP result.",
    )


class MinimalAutoOptimizeRequest(BaseModel):
    site: SiteRequest
    global_constraints: Optional[GlobalConstraintsRequest] = None
    main_entry_direction: str = Field(default="N", description="Primary entry direction")
    road_sides: List[str] = Field(default_factory=lambda: ["N"])
    bedroom_preference: int = Field(default=2, ge=1, le=5)
    include_study: bool = False
    include_guest_room: bool = False
    include_parking: bool = True
    max_iterations: int = Field(default=300, ge=1, le=5000)
    random_seed: Optional[int] = None


class PlacementResponse(BaseModel):
    room_id: str
    name: str
    type: str
    acoustic_zone: Optional[str]
    target_area_sqm: float
    actual_area_sqm: float
    area_deviation_pct: float
    position: Dict[str, float]
    dimensions: Dict[str, float]
    aspect_ratio: float
    min_dimension_m: float
    width_valid: bool
    aspect_ratio_valid: bool
    plumbing_required: bool
    requires_exterior_wall: bool


class ComplianceItemResponse(BaseModel):
    domain: str = Field(..., description="Constraint domain key, e.g. 'fsi', 'egress'")
    label: str = Field(..., description="Human-readable constraint name")
    passed: bool
    severity: str = Field(..., description="One of: critical, warning, info")
    clause: str = Field(..., description="Code clause reference, e.g. 'NBC 2016 Cl. 4.8'")
    measured_value: Optional[float] = Field(None, description="Actual measured value")
    limit_value: Optional[float] = Field(None, description="Code-prescribed limit")
    units: str = Field(default="", description="Units for measured/limit values")
    affected_rooms: List[str] = Field(default_factory=list, description="Room IDs that trigger this violation")
    remediation: str = Field(default="", description="Actionable fix recommendation")
    evidence_level: str = Field(
        default="hard_code_rule",
        description="'hard_code_rule' = mandatory code provision; 'engineering_heuristic' = best-practice guidance",
    )


class LayoutV2Response(BaseModel):
    success: bool
    total_penalty: float
    iteration_found: int
    total_iterations: int
    constraints_met_ratio: float
    fsi_analysis: Dict[str, Any]
    usable_boundary: Dict[str, Any]
    staircase: Optional[Dict[str, Any]]
    circulation: Dict[str, Any]
    egress: Dict[str, Any]
    structural_checks: List[Dict[str, Any]]
    solar_scores: List[Dict[str, Any]]
    fenestration_checks: List[Dict[str, Any]]
    anthropometric_issues: List[str]
    constraints_detail: Dict[str, bool]
    compliance_items: List[ComplianceItemResponse] = Field(default_factory=list)
    placements: List[PlacementResponse]
    travel_distances: Optional[Dict[str, Any]] = None
    acoustic_buffers: Optional[List[Dict[str, Any]]] = None
    structural_grid: Optional[Dict[str, Any]] = None
    sa_convergence: Optional[Dict[str, Any]] = None
    space_syntax: Optional[Dict[str, Any]] = None
    structural_handoff: Optional[Dict[str, Any]] = None
    mep_schedule: Optional[Dict[str, Any]] = None


class VariantScoreResponse(BaseModel):
    variant_id: str
    strategy_name: str
    strategy_description: str
    composite_score: float = Field(..., ge=0, le=100, description="Overall quality 0-100")
    compactness: float = Field(..., ge=0, le=100)
    zone_coherence: float = Field(..., ge=0, le=100)
    adjacency_satisfaction: float = Field(..., ge=0, le=100)
    circulation_efficiency: float = Field(..., ge=0, le=100)
    usable_area_ratio: float = Field(..., ge=0, le=100)


class VariantResponse(BaseModel):
    variant_id: str
    strategy_key: str
    strategy_name: str
    strategy_description: str
    score: Optional[VariantScoreResponse] = None
    placements: List[PlacementResponse] = Field(default_factory=list)
    penalty_weights_used: Dict[str, float] = Field(default_factory=dict)
    compliance_items: List[ComplianceItemResponse] = Field(default_factory=list)


class LayoutVariantsRequest(BaseModel):
    site: SiteRequest
    global_constraints: Optional[GlobalConstraintsRequest] = None
    nodes: List[RoomNodeRequest] = Field(..., min_length=1, max_length=200)
    adjacency_matrix: List[AdjacencyMatrixEntry] = Field(default_factory=list)
    penalty_weights: Optional[PenaltyWeightsRequest] = None
    max_iterations_per_variant: int = Field(default=150, ge=1, le=5000)
    random_seed: Optional[int] = None
    strategies_to_generate: List[str] = Field(
        default_factory=lambda: ["active_first", "sleeping_refuge", "central_circulation", "compact_zones", "linear_flow"],
        description="Which variants to generate: active_first, sleeping_refuge, central_circulation, compact_zones, linear_flow",
    )


class LayoutVariantsResponse(BaseModel):
    success: bool
    total_variants_generated: int
    variants: List[VariantResponse]
    best_variant_id: Optional[str] = None
    recommendation: str = ""
    generated_at_ms: float = Field(..., description="Milliseconds to generate all variants")


class GAParamsRequest(BaseModel):
    population_size: int = Field(default=30, ge=10, le=200)
    max_generations: int = Field(default=50, ge=5, le=500)
    elite_count: int = Field(default=3, ge=1, le=20)
    tournament_size: int = Field(default=4, ge=2, le=20)
    crossover_rate: float = Field(default=0.8, ge=0.1, le=1.0)
    mutation_rate: float = Field(default=0.3, ge=0.01, le=1.0)


class GAOptimizeRequest(BaseModel):
    site: SiteRequest
    global_constraints: Optional[GlobalConstraintsRequest] = None
    nodes: List[RoomNodeRequest] = Field(..., min_length=1, max_length=200)
    adjacency_matrix: List[AdjacencyMatrixEntry] = Field(default_factory=list)
    penalty_weights: Optional[PenaltyWeightsRequest] = None
    max_iterations: int = Field(default=100, ge=1, le=5000)
    random_seed: Optional[int] = None
    ga_params: GAParamsRequest = Field(default_factory=GAParamsRequest)


class GAOptimizeResponse(BaseModel):
    success: bool
    best_fitness: float
    fitness_history: List[float]
    converged: bool
    pareto_front_size: int
    placements: List[PlacementResponse]
    compliance_items: List[ComplianceItemResponse] = Field(default_factory=list)
    space_syntax: Optional[Dict[str, Any]] = None
    structural_handoff: Optional[Dict[str, Any]] = None
    mep_schedule: Optional[Dict[str, Any]] = None
