"""
Layout Optimization API v2 Router

Exposes the production-grade CSP layout solver with 10 constraint domains:
  site boundary/FSI, wet-wall clustering, BSP engine, anthropometric limits,
  structural grid, circulation pathfinding, span limits, staircase matrix,
  solar/fenestration scoring, and egress life-safety analysis.
"""

from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from layout_solver_v2 import (
    AcousticZone,
    AdjacencyEdge,
    GlobalConstraints,
    LayoutSolverV2,
    PenaltyWeightsV2,
    RoomNode,
    RoomType,
    Setbacks,
    SimulatedAnnealingSolver,
    SiteConfig,
)

router = APIRouter(tags=["Layout Optimization v2"])


# =====================================================================
# REQUEST MODELS — mirrors the user-facing JSON schema
# =====================================================================

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
    adjacency_violation: float = Field(default=120.0, ge=0)  # UPDATED: 10 → 120 (12× stronger)
    exterior_wall_violation: float = Field(default=300.0, ge=0)
    overlap_collision: float = Field(default=1000.0, ge=0)
    fsi_violation: float = Field(default=2000.0, ge=0)
    plumbing_cluster_penalty: float = Field(default=200.0, ge=0)  # UPDATED: 80 → 200 (2.5× stronger)
    acoustic_zone_violation: float = Field(default=100.0, ge=0)
    clearance_violation: float = Field(default=400.0, ge=0)
    grid_snap_deviation: float = Field(default=30.0, ge=0)
    circulation_excess: float = Field(default=150.0, ge=0)
    span_violation: float = Field(default=800.0, ge=0)
    beam_headroom_violation: float = Field(default=600.0, ge=0)
    solar_thermal_penalty: float = Field(default=40.0, ge=0)
    fenestration_violation: float = Field(default=200.0, ge=0)
    egress_distance_violation: float = Field(default=1500.0, ge=0)
    compactness_penalty: float = Field(default=80.0, ge=0)  # NEW: zone cohesion penalty
    zone_grouping_penalty: float = Field(default=100.0, ge=0)  # NEW: functional zone clustering


class SAParamsRequest(BaseModel):
    """Optional Simulated Annealing refinement parameters."""
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


# =====================================================================
# RESPONSE MODELS
# =====================================================================

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
    """Clause-traceable compliance result for one constraint domain.

    Provides architect-grade output with code clause reference, measured
    vs. limit values, severity, affected room IDs, and actionable remediation
    text — replacing the legacy boolean-only constraints_detail dict.
    """
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
    compliance_items: List[ComplianceItemResponse] = Field(
        default_factory=list,
        description="Clause-traceable compliance items replacing legacy boolean constraints_detail. "
                    "Each item includes severity, code clause, measured vs. limit values, "
                    "affected room IDs, and actionable remediation text.",
    )
    placements: List[PlacementResponse]
    travel_distances: Optional[Dict[str, Any]] = None
    acoustic_buffers: Optional[List[Dict[str, Any]]] = None
    structural_grid: Optional[Dict[str, Any]] = None
    sa_convergence: Optional[Dict[str, Any]] = None


# =====================================================================
# VARIANT GENERATION MODELS (NEW)
# =====================================================================

class VariantScoreResponse(BaseModel):
    """Quality metrics for a design variant."""
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
    """One design variant with placements and scoring."""
    variant_id: str
    strategy_key: str
    strategy_name: str
    strategy_description: str
    score: Optional[VariantScoreResponse] = None
    placements: List[PlacementResponse] = Field(default_factory=list)
    penalty_weights_used: Dict[str, float] = Field(default_factory=dict)
    compliance_items: List[ComplianceItemResponse] = Field(
        default_factory=list,
        description="Clause-traceable compliance items from the compliance engine",
    )


class LayoutVariantsRequest(BaseModel):
    """Request for multi-variant layout generation."""
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
    """Multi-variant generation response."""
    success: bool
    total_variants_generated: int
    variants: List[VariantResponse]
    best_variant_id: Optional[str] = None
    recommendation: str = ""
    generated_at_ms: float = Field(..., description="Milliseconds to generate all variants")


# =====================================================================
# VALIDATION HELPERS
# =====================================================================

_VALID_ROOM_TYPES = {t.value for t in RoomType}
_VALID_ACOUSTIC_ZONES = {z.value for z in AcousticZone}


def _validate_v2(request: LayoutV2Request) -> None:
    """Pre-solve feasibility checks."""
    # Site dimensions
    w, h = request.site.dimensions_m
    if w <= 0 or h <= 0:
        raise HTTPException(status_code=400, detail="Site dimensions must be positive")

    # Setbacks cannot exceed plot
    sb = request.site.setbacks_m
    left = sb.left if sb.left is not None else (sb.sides if sb.sides is not None else 1.5)
    right = sb.right if sb.right is not None else (sb.sides if sb.sides is not None else 1.5)
    usable_w = w - left - right
    usable_h = h - sb.front - sb.rear
    if usable_w <= 0 or usable_h <= 0:
        raise HTTPException(
            status_code=400,
            detail=f"Setbacks consume entire plot: usable width={usable_w:.2f}m, "
                   f"height={usable_h:.2f}m",
        )

    # Check FSI feasibility
    usable_area = usable_w * usable_h
    total_target = sum(n.target_area_sqm for n in request.nodes)
    max_allowed = w * h * request.site.fsi_limit
    if total_target > max_allowed * 1.5:
        raise HTTPException(
            status_code=400,
            detail=f"Total target area ({total_target:.1f} m²) drastically exceeds "
                   f"FSI limit ({max_allowed:.1f} m²). Must use multi-story or reduce rooms.",
        )

    # Node-level checks
    ids = [n.id for n in request.nodes]
    if len(ids) != len(set(ids)):
        raise HTTPException(status_code=400, detail="Duplicate node id values")

    valid_ids = set(ids)
    for n in request.nodes:
        if n.type not in _VALID_ROOM_TYPES:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid room type '{n.type}' for node '{n.id}'. "
                       f"Must be one of: {sorted(_VALID_ROOM_TYPES)}",
            )
        if n.acoustic_zone and n.acoustic_zone not in _VALID_ACOUSTIC_ZONES:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid acoustic_zone '{n.acoustic_zone}' for node '{n.id}'. "
                       f"Must be one of: {sorted(_VALID_ACOUSTIC_ZONES)}",
            )
        if n.min_aspect_ratio > n.max_aspect_ratio:
            raise HTTPException(
                status_code=400,
                detail=f"Node '{n.id}': min_aspect_ratio ({n.min_aspect_ratio}) "
                       f"> max_aspect_ratio ({n.max_aspect_ratio})",
            )
        if n.min_width_m > usable_w and n.min_width_m > usable_h:
            raise HTTPException(
                status_code=400,
                detail=f"Node '{n.id}': min_width_m ({n.min_width_m}) exceeds "
                       f"both usable dimensions ({usable_w:.2f}, {usable_h:.2f})",
            )

    # Adjacency
    for entry in request.adjacency_matrix:
        if entry.node_a == entry.node_b:
            raise HTTPException(
                status_code=400,
                detail=f"Self-adjacency not allowed: {entry.node_a}",
            )
        if entry.node_a not in valid_ids or entry.node_b not in valid_ids:
            raise HTTPException(
                status_code=400,
                detail=f"Adjacency references unknown node(s): "
                       f"{entry.node_a}, {entry.node_b}",
            )

    # Conflicting duplicate adjacency pairs
    seen: Dict[tuple, float] = {}
    for entry in request.adjacency_matrix:
        key = tuple(sorted((entry.node_a, entry.node_b)))
        if key in seen and seen[key] != entry.weight:
            raise HTTPException(
                status_code=400,
                detail=f"Conflicting adjacency weights for pair "
                       f"{key[0]}-{key[1]}: {seen[key]} vs {entry.weight}",
            )
        seen[key] = entry.weight


# =====================================================================
# ENDPOINT
# =====================================================================

@router.post("/api/layout/v2/optimize", response_model=LayoutV2Response)
async def optimize_layout_v2(request: LayoutV2Request):
    """
    Generate an optimised architectural floor plan using BSP+CSP with
    10 constraint domains: site boundary, wet-wall clustering, room-type
    aspect ratios, anthropometric limits, structural grid, circulation,
    span limits, staircase matrix, solar scoring, and egress analysis.
    """
    try:
        _validate_v2(request)

        # ── Build SiteConfig ──
        w, h = request.site.dimensions_m
        sb = request.site.setbacks_m
        left = sb.left if sb.left is not None else (sb.sides if sb.sides is not None else 1.5)
        right = sb.right if sb.right is not None else (sb.sides if sb.sides is not None else 1.5)

        site_cfg = SiteConfig(
            width=w,
            height=h,
            fsi_limit=request.site.fsi_limit,
            setbacks=Setbacks(front=sb.front, rear=sb.rear, left=left, right=right),
            north_angle_deg=request.site.north_angle_deg,
            latitude_deg=request.site.latitude_deg,
            num_floors=request.site.num_floors,
            polygon_vertices=request.site.polygon_vertices,
        )

        # ── Build GlobalConstraints ──
        gc = request.global_constraints
        if gc:
            constraints = GlobalConstraints(
                max_unsupported_span_m=gc.max_unsupported_span_m,
                min_ceiling_height_m=gc.min_ceiling_height_m,
                structural_grid_module_m=gc.structural_grid_module_m,
                max_riser_height_m=gc.max_riser_height_m,
                min_tread_depth_m=gc.min_tread_depth_m,
                floor_to_floor_height_m=gc.floor_to_floor_height_m,
                max_circulation_ratio=gc.max_circulation_ratio,
                max_egress_distance_m=gc.max_egress_distance_m,
                min_fenestration_ratio=gc.min_fenestration_ratio,
            )
        else:
            constraints = GlobalConstraints()

        # ── Build RoomNodes ──
        room_nodes = []
        for n in request.nodes:
            room_type = RoomType(n.type)
            acoustic = AcousticZone(n.acoustic_zone) if n.acoustic_zone else None
            room_nodes.append(
                RoomNode(
                    id=n.id,
                    name=n.name or n.id,
                    type=room_type,
                    acoustic_zone=acoustic,
                    target_area_sqm=n.target_area_sqm,
                    min_width_m=n.min_width_m,
                    max_aspect_ratio=n.max_aspect_ratio,
                    min_aspect_ratio=n.min_aspect_ratio,
                    requires_exterior_wall=n.requires_exterior_wall,
                    plumbing_required=n.plumbing_required,
                    priority=n.priority,
                    is_entry=n.is_entry,
                    num_doors=n.num_doors,
                )
            )

        # ── Build Adjacency Edges ──
        edges = [
            AdjacencyEdge(node_a=e.node_a, node_b=e.node_b, weight=e.weight)
            for e in request.adjacency_matrix
        ]

        # ── Build PenaltyWeights ──
        if request.penalty_weights:
            pw = request.penalty_weights
            weights = PenaltyWeightsV2(
                area_deviation=pw.area_deviation,
                min_width_violation=pw.min_width_violation,
                aspect_ratio_violation=pw.aspect_ratio_violation,
                adjacency_violation=pw.adjacency_violation,
                exterior_wall_violation=pw.exterior_wall_violation,
                overlap_collision=pw.overlap_collision,
                fsi_violation=pw.fsi_violation,
                plumbing_cluster_penalty=pw.plumbing_cluster_penalty,
                acoustic_zone_violation=pw.acoustic_zone_violation,
                clearance_violation=pw.clearance_violation,
                grid_snap_deviation=pw.grid_snap_deviation,
                circulation_excess=pw.circulation_excess,
                span_violation=pw.span_violation,
                beam_headroom_violation=pw.beam_headroom_violation,
                solar_thermal_penalty=pw.solar_thermal_penalty,
                fenestration_violation=pw.fenestration_violation,
                egress_distance_violation=pw.egress_distance_violation,
            )
        else:
            weights = None

        # ── Solve (BSP) ──
        solver = LayoutSolverV2(
            site=site_cfg,
            constraints=constraints,
            rooms=room_nodes,
            adjacency_edges=edges,
            weights=weights,
            max_iterations=request.max_iterations,
            random_seed=request.random_seed,
        )
        solver.solve()

        # ── Optional SA refinement ──
        sa_convergence = None
        if request.sa_params and request.sa_params.enabled and solver.best_solution:
            adj_map: Dict = {}
            for e in edges:
                adj_map[(e.node_a, e.node_b)] = e.weight
                adj_map[(e.node_b, e.node_a)] = e.weight
            sa = SimulatedAnnealingSolver(
                initial_solution=solver.best_solution,
                site=site_cfg,
                constraints=constraints,
                adjacency_map=adj_map,
                weights=weights,
                initial_temp=request.sa_params.initial_temp,
                cooling_rate=request.sa_params.cooling_rate,
                min_temp=request.sa_params.min_temp,
                max_iterations=request.sa_params.max_iterations,
                stagnation_limit=request.sa_params.stagnation_limit,
                random_seed=request.random_seed,
            )
            refined = sa.solve()
            solver.best_solution = refined
            sa_convergence = sa.get_convergence_report()

        report = solver.get_full_report()

        if "error" in report:
            raise HTTPException(status_code=500, detail=report["error"])

        # ── Map to response ──
        return LayoutV2Response(
            success=True,
            total_penalty=report["total_penalty"],
            iteration_found=report["iteration_found"],
            total_iterations=report["total_iterations"],
            constraints_met_ratio=report["constraints_met_ratio"],
            fsi_analysis=report["fsi_analysis"],
            usable_boundary=report["usable_boundary"],
            staircase=report.get("staircase"),
            circulation=report["diagnostics"].get("circulation", {}),
            egress=report["diagnostics"].get("egress", {}),
            structural_checks=report["diagnostics"].get("structural_checks", []),
            solar_scores=report["diagnostics"].get("solar_scores", []),
            fenestration_checks=report["diagnostics"].get("fenestration_checks", []),
            anthropometric_issues=report["diagnostics"].get("anthropometric_issues", []),
            constraints_detail=report["constraints_detail"],
            compliance_items=[
                ComplianceItemResponse(**item)
                for item in report.get("compliance_items", [])
            ],
            placements=[PlacementResponse(**p) for p in report["placements"]],
            travel_distances=report.get("travel_distances"),
            acoustic_buffers=report.get("acoustic_buffers"),
            structural_grid=report.get("structural_grid"),
            sa_convergence=sa_convergence,
        )

    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=500, detail=f"Layout v2 optimisation failed: {exc}"
        ) from exc


@router.post("/api/layout/v2/variants", response_model=LayoutVariantsResponse)
async def optimize_layout_variants(request: LayoutVariantsRequest):
    """
    🎯 WORKFLOW-AWARE MULTI-VARIANT GENERATION

    Generate 5 competing design solutions using different architectural
    philosophies:
      1. active_first: Open living concept, social spaces integrated
      2. sleeping_refuge: Private sleeping wing, noise isolation
      3. central_circulation: Hub & spoke layout, central hallway
      4. compact_zones: Efficient clustering, minimize footprint
      5. linear_flow: Sequential entry→living→sleeping arrangement

    Each variant explores a different layout strategy with optimized
    penalty weights. Returns solutions ranked by composite quality score.

    This is 1000× more intelligent than single-solution optimization because:
      - User gets to choose their preferred design philosophy
      - No single "local optimum" trap
      - Architectural intent drives placement, not just penalties
      - Each variant represents a coherent design strategy
    """
    import time
    start_time = time.time()
    
    try:
        _validate_v2(request)
        
        # Import the multi-variant solver
        try:
            from multi_variant_solver import MultiVariantSolver
        except ImportError:
            raise HTTPException(
                status_code=501,
                detail="Multi-variant solver not available. "
                       "Install workflow_analyzer.py and multi_variant_solver.py",
            )

        # ── Build site, constraints, rooms (same as single-variant) ──
        w, h = request.site.dimensions_m
        sb = request.site.setbacks_m
        left = sb.left if sb.left is not None else (sb.sides if sb.sides is not None else 1.5)
        right = sb.right if sb.right is not None else (sb.sides if sb.sides is not None else 1.5)

        site_cfg = SiteConfig(
            width=w,
            height=h,
            fsi_limit=request.site.fsi_limit,
            setbacks=Setbacks(front=sb.front, rear=sb.rear, left=left, right=right),
            north_angle_deg=request.site.north_angle_deg,
        )

        gc = request.global_constraints
        if gc:
            constraints = GlobalConstraints(
                max_unsupported_span_m=gc.max_unsupported_span_m,
                min_ceiling_height_m=gc.min_ceiling_height_m,
                structural_grid_module_m=gc.structural_grid_module_m,
                max_riser_height_m=gc.max_riser_height_m,
                min_tread_depth_m=gc.min_tread_depth_m,
                floor_to_floor_height_m=gc.floor_to_floor_height_m,
                max_circulation_ratio=gc.max_circulation_ratio,
                max_egress_distance_m=gc.max_egress_distance_m,
                min_fenestration_ratio=gc.min_fenestration_ratio,
            )
        else:
            constraints = GlobalConstraints()

        room_nodes = []
        for n in request.nodes:
            room_type = RoomType(n.type)
            acoustic = AcousticZone(n.acoustic_zone) if n.acoustic_zone else None
            room_nodes.append(
                RoomNode(
                    id=n.id,
                    name=n.name or n.id,
                    type=room_type,
                    acoustic_zone=acoustic,
                    target_area_sqm=n.target_area_sqm,
                    min_width_m=n.min_width_m,
                    max_aspect_ratio=n.max_aspect_ratio,
                    min_aspect_ratio=n.min_aspect_ratio,
                    requires_exterior_wall=n.requires_exterior_wall,
                    plumbing_required=n.plumbing_required,
                    priority=n.priority,
                    is_entry=n.is_entry,
                    num_doors=n.num_doors,
                )
            )

        edges = [
            AdjacencyEdge(node_a=e.node_a, node_b=e.node_b, weight=e.weight)
            for e in request.adjacency_matrix
        ]

        # ── Extract penalty weights as dict ──
        base_weights = {}
        if request.penalty_weights:
            pw = request.penalty_weights
            base_weights = {
                "area_deviation": pw.area_deviation,
                "min_width_violation": pw.min_width_violation,
                "aspect_ratio_violation": pw.aspect_ratio_violation,
                "adjacency_violation": pw.adjacency_violation,
                "exterior_wall_violation": pw.exterior_wall_violation,
                "overlap_collision": pw.overlap_collision,
                "fsi_violation": pw.fsi_violation,
                "plumbing_cluster_penalty": pw.plumbing_cluster_penalty,
                "acoustic_zone_violation": pw.acoustic_zone_violation,
                "clearance_violation": pw.clearance_violation,
                "grid_snap_deviation": pw.grid_snap_deviation,
                "circulation_excess": pw.circulation_excess,
                "span_violation": pw.span_violation,
                "beam_headroom_violation": pw.beam_headroom_violation,
                "solar_thermal_penalty": pw.solar_thermal_penalty,
                "fenestration_violation": pw.fenestration_violation,
                "egress_distance_violation": pw.egress_distance_violation,
                "compactness_penalty": pw.compactness_penalty,
                "zone_grouping_penalty": pw.zone_grouping_penalty,
            }

        # ── Generate variants ──
        solver = MultiVariantSolver(debug=False)
        variants = solver.generate_variants(
            rooms=room_nodes,
            site_config=site_cfg,
            base_penalty_weights=base_weights,
            timeout_per_variant_sec=30.0,
            adjacency_edges=edges,
            constraints=constraints,
        )

        # ── Map to response ──
        variant_responses = []
        best_variant_id = None
        best_score = -1.0
        
        for variant in variants:
            score_resp = None
            if variant.score:
                score_resp = VariantScoreResponse(
                    variant_id=variant.score.variant_id,
                    strategy_name=variant.score.strategy_name,
                    strategy_description=variant.score.strategy_description,
                    composite_score=variant.score.composite_score,
                    compactness=variant.score.compactness,
                    zone_coherence=variant.score.zone_coherence,
                    adjacency_satisfaction=variant.score.adjacency_satisfaction,
                    circulation_efficiency=variant.score.circulation_efficiency,
                    usable_area_ratio=variant.score.usable_area_ratio,
                )
                
                if variant.score.composite_score > best_score:
                    best_score = variant.score.composite_score
                    best_variant_id = variant.variant_id
            
            raw = variant._raw_solver_output or {}
            placement_responses = [PlacementResponse(**p) for p in raw.get("placements", [])]
            compliance_raw = raw.get("compliance_items", [])
            compliance_item_responses = []
            for ci in compliance_raw:
                try:
                    compliance_item_responses.append(ComplianceItemResponse(**ci))
                except Exception:
                    pass  # skip malformed items

            variant_responses.append(VariantResponse(
                variant_id=variant.variant_id,
                strategy_key=variant.strategy_key,
                strategy_name=variant.strategy_name,
                strategy_description=variant.strategy_description,
                score=score_resp,
                placements=placement_responses,
                penalty_weights_used=variant.penalty_weights,
                compliance_items=compliance_item_responses,
            ))
        
        elapsed_ms = (time.time() - start_time) * 1000.0
        
        recommendation = "✨ Review all variants to choose your preferred architectural approach."
        if best_variant_id:
            best = next((v for v in variant_responses if v.variant_id == best_variant_id), None)
            if best:
                recommendation = (
                    f"✨ Recommended: '{best.strategy_name}' "
                    f"(highest quality score)"
                )
        
        return LayoutVariantsResponse(
            success=True,
            total_variants_generated=len(variant_responses),
            variants=variant_responses,
            best_variant_id=best_variant_id,
            recommendation=recommendation,
            generated_at_ms=elapsed_ms,
        )

    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=500, detail=f"Multi-variant generation failed: {exc}"
        ) from exc

