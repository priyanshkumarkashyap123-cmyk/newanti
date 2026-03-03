"""
Layout Optimization API Router

Exposes CSP-based architectural layout optimization endpoint.
"""

from typing import Dict, List, Optional, Tuple

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from architectural_layout_solver import (
    ArchitecturalLayoutSolver,
    ConstraintPenalties,
    RoomDefinition,
)

router = APIRouter(tags=["Layout Optimization"])


class RoomSpecRequest(BaseModel):
    room_id: str = Field(..., min_length=1, max_length=128)
    name: str = Field(..., min_length=1, max_length=256)
    target_area: float = Field(..., gt=0)
    min_width: float = Field(..., gt=0)
    max_aspect_ratio: float = Field(default=3.0, gt=0)
    min_aspect_ratio: float = Field(default=0.5, gt=0)
    requires_exterior_wall: bool = False
    priority: int = Field(default=1, ge=1, le=4)


class AdjacencyPreferenceRequest(BaseModel):
    room_id_1: str = Field(..., min_length=1, max_length=128)
    room_id_2: str = Field(..., min_length=1, max_length=128)
    score: float = Field(..., ge=-10.0, le=10.0)


class PenaltyWeightsRequest(BaseModel):
    area_deviation: float = Field(default=100.0, ge=0)
    min_width_violation: float = Field(default=500.0, ge=0)
    aspect_ratio_violation: float = Field(default=50.0, ge=0)
    adjacency_violation: float = Field(default=10.0, ge=0)
    exterior_wall_violation: float = Field(default=300.0, ge=0)
    overlap_collision: float = Field(default=1000.0, ge=0)


class LayoutOptimizeRequest(BaseModel):
    site_width: float = Field(..., gt=0)
    site_height: float = Field(..., gt=0)
    rooms: List[RoomSpecRequest] = Field(..., min_length=1, max_length=200)
    adjacency_preferences: List[AdjacencyPreferenceRequest] = Field(default_factory=list)
    penalty_weights: Optional[PenaltyWeightsRequest] = None
    max_iterations: int = Field(default=120, ge=1, le=2000)
    random_seed: Optional[int] = None


class RoomPlacementResponse(BaseModel):
    room_id: str
    name: str
    target_area: float
    actual_area: float
    area_deviation_pct: float
    position: Dict[str, float]
    dimensions: Dict[str, float]
    aspect_ratio: float
    width_valid: bool
    aspect_ratio_valid: bool


class LayoutOptimizeResponse(BaseModel):
    success: bool
    total_penalty: float
    iteration_found: int
    total_iterations: int
    constraints_met_ratio: float
    placements: List[RoomPlacementResponse]


def _build_adjacency_map(
    pairs: List[AdjacencyPreferenceRequest],
    valid_room_ids: set[str],
) -> Dict[Tuple[str, str], float]:
    adjacency: Dict[Tuple[str, str], float] = {}
    for pair in pairs:
        if pair.room_id_1 not in valid_room_ids or pair.room_id_2 not in valid_room_ids:
            raise HTTPException(
                status_code=400,
                detail=(
                    "Adjacency references unknown room id(s): "
                    f"{pair.room_id_1}, {pair.room_id_2}"
                ),
            )
        if pair.room_id_1 == pair.room_id_2:
            raise HTTPException(
                status_code=400,
                detail=f"Adjacency pair cannot reference the same room: {pair.room_id_1}",
            )

        # Normalize as undirected pair so (a,b) and (b,a) are treated the same.
        key = tuple(sorted((pair.room_id_1, pair.room_id_2)))
        if key in adjacency and adjacency[key] != pair.score:
            raise HTTPException(
                status_code=400,
                detail=(
                    "Conflicting adjacency scores provided for pair "
                    f"{key[0]}-{key[1]}"
                ),
            )
        adjacency[key] = pair.score
    return adjacency


def _validate_request_constraints(request: LayoutOptimizeRequest) -> None:
    """Validate request-level feasibility and consistency checks."""
    site_area = request.site_width * request.site_height
    total_target_area = sum(room.target_area for room in request.rooms)

    # Soft-feasibility guardrail: reject clearly infeasible area requests.
    if total_target_area > site_area * 1.2:
        raise HTTPException(
            status_code=400,
            detail=(
                "Total target room area exceeds feasible site capacity: "
                f"{total_target_area:.2f} > {site_area * 1.2:.2f} (120% of site area)"
            ),
        )

    for room in request.rooms:
        if room.min_aspect_ratio > room.max_aspect_ratio:
            raise HTTPException(
                status_code=400,
                detail=(
                    f"Invalid aspect ratio bounds for room '{room.room_id}': "
                    f"min_aspect_ratio ({room.min_aspect_ratio}) cannot exceed "
                    f"max_aspect_ratio ({room.max_aspect_ratio})"
                ),
            )

        if room.min_width > request.site_width and room.min_width > request.site_height:
            raise HTTPException(
                status_code=400,
                detail=(
                    f"Room '{room.room_id}' min_width ({room.min_width}) exceeds both site dimensions "
                    f"({request.site_width}, {request.site_height})"
                ),
            )


@router.post("/api/layout/optimize", response_model=LayoutOptimizeResponse)
async def optimize_layout(request: LayoutOptimizeRequest):
    """Generate optimized room layout using BSP+CSP solver."""
    try:
        _validate_request_constraints(request)

        room_ids = [room.room_id for room in request.rooms]
        if len(room_ids) != len(set(room_ids)):
            raise HTTPException(status_code=400, detail="Duplicate room_id values are not allowed")

        room_defs = [
            RoomDefinition(
                room_id=room.room_id,
                name=room.name,
                target_area=room.target_area,
                min_width=room.min_width,
                max_aspect_ratio=room.max_aspect_ratio,
                min_aspect_ratio=room.min_aspect_ratio,
                requires_exterior_wall=room.requires_exterior_wall,
                priority=room.priority,
            )
            for room in request.rooms
        ]

        adjacency_map = _build_adjacency_map(request.adjacency_preferences, set(room_ids))

        if request.penalty_weights:
            payload = (
                request.penalty_weights.model_dump()
                if hasattr(request.penalty_weights, "model_dump")
                else request.penalty_weights.dict()
            )
            penalties = ConstraintPenalties(**payload)
        else:
            penalties = ConstraintPenalties()

        solver = ArchitecturalLayoutSolver(
            site_width=request.site_width,
            site_height=request.site_height,
            rooms=room_defs,
            adjacency_matrix=adjacency_map,
            penalties=penalties,
            max_iterations=request.max_iterations,
            random_seed=request.random_seed,
        )

        solution = solver.solve()

        placements = [
            RoomPlacementResponse(
                room_id=placement.room.room_id,
                name=placement.room.name,
                target_area=placement.room.target_area,
                actual_area=placement.rectangle.area,
                area_deviation_pct=placement.area_deviation * 100.0,
                position={
                    "x": placement.rectangle.x,
                    "y": placement.rectangle.y,
                },
                dimensions={
                    "width": placement.rectangle.width,
                    "height": placement.rectangle.height,
                },
                aspect_ratio=placement.rectangle.aspect_ratio,
                width_valid=placement.width_valid,
                aspect_ratio_valid=placement.aspect_ratio_valid,
            )
            for placement in solution.placements
        ]

        constraints_total = max(1, len(solution.constraints_satisfied))
        constraints_met = sum(1 for met in solution.constraints_satisfied.values() if met)

        return LayoutOptimizeResponse(
            success=True,
            total_penalty=solution.total_penalty,
            iteration_found=solution.iteration,
            total_iterations=len(solver.iteration_history),
            constraints_met_ratio=constraints_met / constraints_total,
            placements=placements,
        )
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Layout optimization failed: {exc}") from exc
