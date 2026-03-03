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
    adjacency_violation: float = Field(default=10.0, ge=0)
    exterior_wall_violation: float = Field(default=300.0, ge=0)
    overlap_collision: float = Field(default=1000.0, ge=0)
    fsi_violation: float = Field(default=2000.0, ge=0)
    plumbing_cluster_penalty: float = Field(default=80.0, ge=0)
    acoustic_zone_violation: float = Field(default=100.0, ge=0)
    clearance_violation: float = Field(default=400.0, ge=0)
    grid_snap_deviation: float = Field(default=30.0, ge=0)
    circulation_excess: float = Field(default=150.0, ge=0)
    span_violation: float = Field(default=800.0, ge=0)
    beam_headroom_violation: float = Field(default=600.0, ge=0)
    solar_thermal_penalty: float = Field(default=40.0, ge=0)
    fenestration_violation: float = Field(default=200.0, ge=0)
    egress_distance_violation: float = Field(default=1500.0, ge=0)


class LayoutV2Request(BaseModel):
    site: SiteRequest
    global_constraints: Optional[GlobalConstraintsRequest] = None
    nodes: List[RoomNodeRequest] = Field(..., min_length=1, max_length=200)
    adjacency_matrix: List[AdjacencyMatrixEntry] = Field(default_factory=list)
    penalty_weights: Optional[PenaltyWeightsRequest] = None
    max_iterations: int = Field(default=200, ge=1, le=5000)
    random_seed: Optional[int] = None


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
    placements: List[PlacementResponse]


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

        # ── Solve ──
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
            placements=[PlacementResponse(**p) for p in report["placements"]],
        )

    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=500, detail=f"Layout v2 optimisation failed: {exc}"
        ) from exc
