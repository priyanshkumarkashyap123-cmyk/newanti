"""
Shared helpers for layout_v2 endpoints: validation and auto program builders.
"""

from typing import Any, Dict, List, Set

from fastapi import HTTPException

from layout_solver_v2 import AcousticZone, RoomType
from routers.layout_v2_schemas import (
    AdjacencyMatrixEntry,
    LayoutV2Request,
    MinimalAutoOptimizeRequest,
    RoomNodeRequest,
)

_VALID_ROOM_TYPES: Set[str] = {t.value for t in RoomType}
_VALID_ACOUSTIC_ZONES: Set[str] = {z.value for z in AcousticZone}


def validate_layout_v2_request(request: LayoutV2Request) -> None:
    """Pre-solve feasibility checks for layout v2 endpoints."""
    w, h = request.site.dimensions_m
    if w <= 0 or h <= 0:
        raise HTTPException(status_code=400, detail="Site dimensions must be positive")

    sb = request.site.setbacks_m
    left = sb.left if sb.left is not None else (sb.sides if sb.sides is not None else 1.5)
    right = sb.right if sb.right is not None else (sb.sides if sb.sides is not None else 1.5)
    usable_w = w - left - right
    usable_h = h - sb.front - sb.rear
    if usable_w <= 0 or usable_h <= 0:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Setbacks consume entire plot: usable width={usable_w:.2f}m, "
                f"height={usable_h:.2f}m"
            ),
        )

    usable_area = usable_w * usable_h
    total_target = sum(n.target_area_sqm for n in request.nodes)
    max_allowed = w * h * request.site.fsi_limit
    if total_target > max_allowed * 1.5:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Total target area ({total_target:.1f} m²) drastically exceeds "
                f"FSI limit ({max_allowed:.1f} m²). Must use multi-story or reduce rooms."
            ),
        )

    ids = [n.id for n in request.nodes]
    if len(ids) != len(set(ids)):
        raise HTTPException(status_code=400, detail="Duplicate node id values")

    valid_ids = set(ids)
    for n in request.nodes:
        if n.type not in _VALID_ROOM_TYPES:
            raise HTTPException(
                status_code=400,
                detail=(
                    f"Invalid room type '{n.type}' for node '{n.id}'. "
                    f"Must be one of: {sorted(_VALID_ROOM_TYPES)}"
                ),
            )
        if n.acoustic_zone and n.acoustic_zone not in _VALID_ACOUSTIC_ZONES:
            raise HTTPException(
                status_code=400,
                detail=(
                    f"Invalid acoustic_zone '{n.acoustic_zone}' for node '{n.id}'. "
                    f"Must be one of: {sorted(_VALID_ACOUSTIC_ZONES)}"
                ),
            )
        if n.min_aspect_ratio > n.max_aspect_ratio:
            raise HTTPException(
                status_code=400,
                detail=(
                    f"Node '{n.id}': min_aspect_ratio ({n.min_aspect_ratio}) "
                    f"> max_aspect_ratio ({n.max_aspect_ratio})"
                ),
            )
        if n.min_width_m > usable_w and n.min_width_m > usable_h:
            raise HTTPException(
                status_code=400,
                detail=(
                    f"Node '{n.id}': min_width_m ({n.min_width_m}) exceeds "
                    f"both usable dimensions ({usable_w:.2f}, {usable_h:.2f})"
                ),
            )

    for entry in request.adjacency_matrix:
        if entry.node_a == entry.node_b:
            raise HTTPException(status_code=400, detail=f"Self-adjacency not allowed: {entry.node_a}")
        if entry.node_a not in valid_ids or entry.node_b not in valid_ids:
            raise HTTPException(
                status_code=400,
                detail=f"Adjacency references unknown node(s): {entry.node_a}, {entry.node_b}",
            )

    seen: Dict[tuple, float] = {}
    for entry in request.adjacency_matrix:
        key = tuple(sorted((entry.node_a, entry.node_b)))
        if key in seen and seen[key] != entry.weight:
            raise HTTPException(
                status_code=400,
                detail=(
                    f"Conflicting adjacency weights for pair {key[0]}-{key[1]}: "
                    f"{seen[key]} vs {entry.weight}"
                ),
            )
        seen[key] = entry.weight


def build_auto_program_nodes(request: MinimalAutoOptimizeRequest) -> List[RoomNodeRequest]:
    """Generate a default residential room program from plot area and preferences."""
    w, h = request.site.dimensions_m
    area_sqm = w * h
    floors = max(1, request.site.num_floors)
    bedrooms = max(1, min(5, request.bedroom_preference))

    nodes: List[RoomNodeRequest] = [
        RoomNodeRequest(
            id="entry_1",
            name="Entrance Lobby",
            type="circulation",
            acoustic_zone="buffer",
            target_area_sqm=6.0,
            min_width_m=1.8,
            max_aspect_ratio=2.5,
            min_aspect_ratio=1.0,
            requires_exterior_wall=True,
            plumbing_required=False,
            priority=1,
            is_entry=True,
            num_doors=2,
        ),
        RoomNodeRequest(
            id="living_1",
            name="Living",
            type="habitable",
            acoustic_zone="active",
            target_area_sqm=20.0 if area_sqm >= 120 else 16.0,
            min_width_m=3.2,
            max_aspect_ratio=2.0,
            min_aspect_ratio=1.0,
            requires_exterior_wall=True,
            plumbing_required=False,
            priority=1,
            is_entry=False,
            num_doors=2,
        ),
        RoomNodeRequest(
            id="kitchen_1",
            name="Kitchen",
            type="wet",
            acoustic_zone="service",
            target_area_sqm=10.0,
            min_width_m=2.4,
            max_aspect_ratio=2.5,
            min_aspect_ratio=1.0,
            requires_exterior_wall=True,
            plumbing_required=True,
            priority=1,
            is_entry=False,
            num_doors=1,
        ),
        RoomNodeRequest(
            id="dining_1",
            name="Dining",
            type="habitable",
            acoustic_zone="active",
            target_area_sqm=12.0 if area_sqm >= 90 else 9.0,
            min_width_m=2.8,
            max_aspect_ratio=2.0,
            min_aspect_ratio=1.0,
            requires_exterior_wall=True,
            plumbing_required=False,
            priority=2,
            is_entry=False,
            num_doors=1,
        ),
        RoomNodeRequest(
            id="toilet_gf",
            name="Common Toilet",
            type="wet",
            acoustic_zone="service",
            target_area_sqm=2.2,
            min_width_m=1.0,
            max_aspect_ratio=3.0,
            min_aspect_ratio=1.0,
            requires_exterior_wall=False,
            plumbing_required=True,
            priority=1,
            is_entry=False,
            num_doors=1,
        ),
    ]

    if floors > 1:
        nodes.append(
            RoomNodeRequest(
                id="stair_1",
                name="Staircase",
                type="staircase",
                acoustic_zone="buffer",
                target_area_sqm=7.0,
                min_width_m=1.0,
                max_aspect_ratio=3.0,
                min_aspect_ratio=1.0,
                requires_exterior_wall=False,
                plumbing_required=False,
                priority=1,
                is_entry=False,
                num_doors=1,
            )
        )

    nodes.append(
        RoomNodeRequest(
            id="master_1",
            name="Master Bedroom",
            type="habitable",
            acoustic_zone="passive",
            target_area_sqm=15.0,
            min_width_m=3.0,
            max_aspect_ratio=2.0,
            min_aspect_ratio=1.0,
            requires_exterior_wall=True,
            plumbing_required=False,
            priority=1,
            is_entry=False,
            num_doors=1,
        )
    )
    nodes.append(
        RoomNodeRequest(
            id="bath_master_1",
            name="Master Bath",
            type="wet",
            acoustic_zone="service",
            target_area_sqm=4.2,
            min_width_m=1.6,
            max_aspect_ratio=2.5,
            min_aspect_ratio=1.0,
            requires_exterior_wall=False,
            plumbing_required=True,
            priority=1,
            is_entry=False,
            num_doors=1,
        )
    )

    for i in range(max(0, bedrooms - 1)):
        nodes.append(
            RoomNodeRequest(
                id=f"bed_{i+1}",
                name=f"Bedroom {i+1}",
                type="habitable",
                acoustic_zone="passive",
                target_area_sqm=11.0,
                min_width_m=2.8,
                max_aspect_ratio=2.0,
                min_aspect_ratio=1.0,
                requires_exterior_wall=True,
                plumbing_required=False,
                priority=2,
                is_entry=False,
                num_doors=1,
            )
        )

    if bedrooms >= 3:
        nodes.append(
            RoomNodeRequest(
                id="bath_common_1",
                name="Common Bath",
                type="wet",
                acoustic_zone="service",
                target_area_sqm=3.5,
                min_width_m=1.5,
                max_aspect_ratio=2.5,
                min_aspect_ratio=1.0,
                requires_exterior_wall=False,
                plumbing_required=True,
                priority=2,
                is_entry=False,
                num_doors=1,
            )
        )

    if request.include_guest_room and area_sqm >= 140:
        nodes.append(
            RoomNodeRequest(
                id="guest_1",
                name="Guest Room",
                type="habitable",
                acoustic_zone="passive",
                target_area_sqm=11.0,
                min_width_m=2.8,
                max_aspect_ratio=2.0,
                min_aspect_ratio=1.0,
                requires_exterior_wall=True,
                plumbing_required=False,
                priority=3,
                is_entry=False,
                num_doors=1,
            )
        )

    if request.include_study and area_sqm >= 170:
        nodes.append(
            RoomNodeRequest(
                id="study_1",
                name="Study",
                type="habitable",
                acoustic_zone="passive",
                target_area_sqm=8.0,
                min_width_m=2.4,
                max_aspect_ratio=2.0,
                min_aspect_ratio=1.0,
                requires_exterior_wall=True,
                plumbing_required=False,
                priority=3,
                is_entry=False,
                num_doors=1,
            )
        )

    if request.include_parking and area_sqm >= 90:
        nodes.append(
            RoomNodeRequest(
                id="parking_1",
                name="Parking",
                type="utility",
                acoustic_zone="buffer",
                target_area_sqm=14.0,
                min_width_m=2.5,
                max_aspect_ratio=2.5,
                min_aspect_ratio=1.0,
                requires_exterior_wall=True,
                plumbing_required=False,
                priority=2,
                is_entry=False,
                num_doors=1,
            )
        )

    return nodes


def build_auto_program_adjacency(nodes: List[RoomNodeRequest]) -> List[AdjacencyMatrixEntry]:
    """Build practical adjacency weights for autogenerated room program."""
    ids = {n.id for n in nodes}
    edges: List[AdjacencyMatrixEntry] = []

    def add(a: str, b: str, w: float) -> None:
        if a in ids and b in ids and a != b:
            edges.append(AdjacencyMatrixEntry(node_a=a, node_b=b, weight=w))

    add("entry_1", "living_1", 10)
    add("entry_1", "dining_1", 7)
    add("living_1", "dining_1", 8)
    add("dining_1", "kitchen_1", 9)
    add("kitchen_1", "toilet_gf", -4)
    add("master_1", "bath_master_1", 10)

    for n in nodes:
        if n.id.startswith("bed_"):
            add("living_1", n.id, 4)
            add("kitchen_1", n.id, -4)
            add(n.id, "bath_common_1", 8)

    add("guest_1", "toilet_gf", 6)
    add("study_1", "living_1", 3)
    add("parking_1", "entry_1", 8)
    add("stair_1", "living_1", 6)

    return edges
