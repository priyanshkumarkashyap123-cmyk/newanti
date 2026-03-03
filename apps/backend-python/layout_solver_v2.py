"""
Generative Architectural Layout Engine v2 — Production-Grade CSP Solver

Implements 10 constraint domains for code-compliant residential floor plan generation:

  1. Site Boundary & Regulatory Geometry  (setbacks, FSI cap)
  2. Topological Graph & Wet Wall Clustering  (plumbing, acoustic zoning)
  3. Binary Space Partitioning with Room-Type Aspect Ratios
  4. Anthropometric Hard Limits  (clearances, door-swing vectors)
  5. Structural Grid & Load Paths  (grid snapping, vertical alignment)
  6. Circulation Optimization  (A* connectivity, 15 % corridor rule)
  7. Structural Mechanics & Span Limits  (slab spans, beam depth)
  8. Vertical Circulation / Staircase Matrix
  9. Environmental Physics & Orientation Scoring  (solar, fenestration)
 10. Egress & Life Safety  (Dijkstra max travel distance)

Author: BeamLab Spatial Planning Engine
Version: 2.0
"""

from __future__ import annotations

import heapq
import math
import random
from copy import deepcopy
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Dict, List, Optional, Set, Tuple


# =====================================================================
#  ENUMERATIONS
# =====================================================================

class PartitionDirection(Enum):
    HORIZONTAL = "horizontal"
    VERTICAL = "vertical"


class RoomType(Enum):
    """Functional classification of a room node."""
    HABITABLE = "habitable"      # Bedrooms, living, dining, study
    UTILITY = "utility"          # Kitchen, laundry, store
    WET = "wet"                  # Bathrooms, toilets, powder rooms
    CIRCULATION = "circulation"  # Corridors, lobbies, foyers
    STAIRCASE = "staircase"      # Vertical circulation — fixed geometry


class AcousticZone(Enum):
    """Acoustic separation zones for residential layouts."""
    ACTIVE = "active"    # Living, dining, kitchen — noise-generating
    PASSIVE = "passive"  # Bedrooms, studies — noise-sensitive
    SERVICE = "service"  # Bathrooms, utility — moderate noise
    BUFFER = "buffer"    # Corridors, closets — noise-insulating


# =====================================================================
#  CORE GEOMETRY
# =====================================================================

@dataclass
class Rectangle:
    """Axis-aligned bounding box in 2-D Cartesian space."""
    x: float
    y: float
    width: float
    height: float

    # -- derived properties -------------------------------------------

    @property
    def area(self) -> float:
        return self.width * self.height

    @property
    def aspect_ratio(self) -> float:
        """Length / Width (always ≥ 1.0)."""
        short = min(self.width, self.height)
        if short <= 0:
            return float("inf")
        return max(self.width, self.height) / short

    @property
    def min_dim(self) -> float:
        return min(self.width, self.height)

    @property
    def max_dim(self) -> float:
        return max(self.width, self.height)

    @property
    def center(self) -> Tuple[float, float]:
        return (self.x + self.width / 2, self.y + self.height / 2)

    @property
    def bounds(self) -> Tuple[float, float, float, float]:
        """(x_min, y_min, x_max, y_max)"""
        return (self.x, self.y, self.x + self.width, self.y + self.height)

    # -- spatial queries ----------------------------------------------

    def contains_point(self, px: float, py: float) -> bool:
        x0, y0, x1, y1 = self.bounds
        return x0 <= px <= x1 and y0 <= py <= y1

    def shares_edge_with(self, boundary: Rectangle, tol: float = 0.05) -> bool:
        """True when at least one edge coincides with *boundary*."""
        bx0, by0, bx1, by1 = boundary.bounds
        x0, y0, x1, y1 = self.bounds
        return (
            abs(x0 - bx0) < tol or abs(x1 - bx1) < tol
            or abs(y0 - by0) < tol or abs(y1 - by1) < tol
        )

    def exterior_facades(self, boundary: Rectangle, tol: float = 0.05) -> List[str]:
        """Return wall names that coincide with *boundary*: left/right/bottom/top."""
        facades: List[str] = []
        bx0, by0, bx1, by1 = boundary.bounds
        x0, y0, x1, y1 = self.bounds
        if abs(x0 - bx0) < tol:
            facades.append("left")
        if abs(x1 - bx1) < tol:
            facades.append("right")
        if abs(y0 - by0) < tol:
            facades.append("bottom")
        if abs(y1 - by1) < tol:
            facades.append("top")
        return facades

    def distance_to(self, other: Rectangle) -> float:
        """Minimum edge-to-edge distance; 0 when touching/overlapping."""
        ax0, ay0, ax1, ay1 = self.bounds
        bx0, by0, bx1, by1 = other.bounds
        dx = max(0.0, max(ax0 - bx1, bx0 - ax1))
        dy = max(0.0, max(ay0 - by1, by0 - ay1))
        return math.hypot(dx, dy)


# -- free-standing geometry helpers -----------------------------------

def snap_to_grid(value: float, grid: float) -> float:
    """Snap *value* to the nearest multiple of *grid*."""
    if grid <= 0:
        return value
    return round(value / grid) * grid


def rectangles_overlap(r1: Rectangle, r2: Rectangle, tol: float = 0.01) -> bool:
    a = r1.bounds
    b = r2.bounds
    return not (
        a[2] <= b[0] + tol or b[2] <= a[0] + tol
        or a[3] <= b[1] + tol or b[3] <= a[1] + tol
    )


def rectangles_adjacent(r1: Rectangle, r2: Rectangle, tol: float = 0.3) -> bool:
    """Two rectangles share a wall (with tolerance for floating-point drift)."""
    a = r1.bounds
    b = r2.bounds
    # shared vertical edge
    if abs(a[2] - b[0]) <= tol or abs(b[2] - a[0]) <= tol:
        if not (a[3] < b[1] or b[3] < a[1]):
            return True
    # shared horizontal edge
    if abs(a[3] - b[1]) <= tol or abs(b[3] - a[1]) <= tol:
        if not (a[2] < b[0] or b[2] < a[0]):
            return True
    return False


# =====================================================================
#  DOMAIN 1 — SITE BOUNDARY & REGULATORY GEOMETRY
# =====================================================================

@dataclass
class Setbacks:
    front: float = 3.0
    rear: float = 1.5
    left: float = 1.5
    right: float = 1.5


@dataclass
class SiteConfig:
    """Master plot definition including regulatory limits."""
    width: float
    height: float
    fsi_limit: float = 1.5
    setbacks: Setbacks = field(default_factory=Setbacks)
    north_angle_deg: float = 0.0

    @property
    def plot_area(self) -> float:
        return self.width * self.height

    @property
    def max_built_area(self) -> float:
        """Maximum total covered area allowed by FSI."""
        return self.plot_area * self.fsi_limit

    def usable_boundary(self) -> Rectangle:
        """Compute the buildable polygon after inward setback offsets."""
        x = self.setbacks.left
        y = self.setbacks.front
        w = self.width - self.setbacks.left - self.setbacks.right
        h = self.height - self.setbacks.front - self.setbacks.rear
        if w <= 0 or h <= 0:
            raise ValueError(
                f"Setbacks consume entire plot: usable width={w:.2f}m, "
                f"height={h:.2f}m"
            )
        return Rectangle(x=x, y=y, width=w, height=h)


def validate_fsi(
    total_room_area: float,
    site: SiteConfig,
    num_floors: int = 1,
) -> Dict[str, Any]:
    """
    Check Floor Space Index compliance.

    FSI = Total_Covered_Area / Plot_Area
    """
    total_covered = total_room_area  # single-floor default
    fsi_actual = total_covered / site.plot_area if site.plot_area > 0 else float("inf")
    compliant = fsi_actual <= site.fsi_limit
    ub = site.usable_boundary()
    floors_needed = math.ceil(total_room_area / ub.area) if ub.area > 0 else 0
    return {
        "fsi_actual": round(fsi_actual, 4),
        "fsi_limit": site.fsi_limit,
        "compliant": compliant,
        "max_allowed_area": round(site.max_built_area, 2),
        "total_covered_area": round(total_covered, 2),
        "floors_required": max(1, floors_needed),
    }


# =====================================================================
#  DOMAIN 2 — ROOM NODES, ADJACENCY GRAPH, WET WALL CLUSTERING
# =====================================================================

# Default acoustic zone inference from room type + id keyword heuristics
_ACTIVE_KEYWORDS = {"living", "dining", "kitchen", "lounge", "family"}
_PASSIVE_KEYWORDS = {"bed", "study", "office", "library", "nursery"}
_SERVICE_KEYWORDS = {"bath", "toilet", "wc", "laundry", "utility", "powder"}


def infer_acoustic_zone(room_id: str, room_type: RoomType) -> AcousticZone:
    """Heuristically assign an acoustic zone based on id keywords and type."""
    rid = room_id.lower()
    if any(kw in rid for kw in _ACTIVE_KEYWORDS):
        return AcousticZone.ACTIVE
    if any(kw in rid for kw in _PASSIVE_KEYWORDS):
        return AcousticZone.PASSIVE
    if any(kw in rid for kw in _SERVICE_KEYWORDS):
        return AcousticZone.SERVICE
    # Fallback by type
    mapping = {
        RoomType.HABITABLE: AcousticZone.PASSIVE,
        RoomType.UTILITY: AcousticZone.ACTIVE,
        RoomType.WET: AcousticZone.SERVICE,
        RoomType.CIRCULATION: AcousticZone.BUFFER,
        RoomType.STAIRCASE: AcousticZone.BUFFER,
    }
    return mapping.get(room_type, AcousticZone.PASSIVE)


@dataclass
class RoomNode:
    """Full room definition with metadata for all 10 constraint domains."""
    id: str
    name: str = ""
    type: RoomType = RoomType.HABITABLE
    acoustic_zone: Optional[AcousticZone] = None  # inferred if None
    target_area_sqm: float = 12.0
    min_width_m: float = 2.8
    max_aspect_ratio: float = 1.5
    min_aspect_ratio: float = 1.0
    requires_exterior_wall: bool = False
    plumbing_required: bool = False
    priority: int = 1
    is_entry: bool = False
    num_doors: int = 1
    fixed_dimensions: Optional[Tuple[float, float]] = None  # locked for staircases

    def __post_init__(self) -> None:
        if not self.name:
            self.name = self.id

        # Infer acoustic zone when not given
        if self.acoustic_zone is None:
            self.acoustic_zone = infer_acoustic_zone(self.id, self.type)

        # ── Room-type hardcoded aspect-ratio limits (Domain 3) ──
        #   "For habitable rooms, the engine must enforce  1.0 ≤ L/W ≤ 1.5"
        if self.type == RoomType.HABITABLE:
            self.max_aspect_ratio = min(self.max_aspect_ratio, 1.5)
            self.min_aspect_ratio = max(self.min_aspect_ratio, 1.0)
            self.min_width_m = max(self.min_width_m, 2.8)
        elif self.type == RoomType.WET:
            self.plumbing_required = True
            self.max_aspect_ratio = min(self.max_aspect_ratio, 2.0)
        elif self.type == RoomType.UTILITY:
            self.max_aspect_ratio = min(self.max_aspect_ratio, 2.5)
        elif self.type == RoomType.CIRCULATION:
            self.max_aspect_ratio = min(self.max_aspect_ratio, 5.0)

    def __hash__(self) -> int:
        return hash(self.id)


@dataclass
class AdjacencyEdge:
    node_a: str
    node_b: str
    weight: float  # positive → attract, negative → repel


# =====================================================================
#  DOMAIN 4 — ANTHROPOMETRIC HARD LIMITS
# =====================================================================

# Minimum clear width required for each room type (meters)
MIN_CLEARANCES: Dict[RoomType, float] = {
    RoomType.HABITABLE: 2.8,    # bed (2.0 m) + walk (0.8 m)
    RoomType.UTILITY: 2.0,
    RoomType.WET: 1.8,
    RoomType.CIRCULATION: 1.2,
    RoomType.STAIRCASE: 1.0,
}

DOOR_SWING_ARC_M = 0.9  # 0.9 m × 0.9 m quarter-circle arc per door


def check_anthropometric(placement: RoomPlacement) -> List[str]:
    """Return list of human-factor violations."""
    violations: List[str] = []
    rect = placement.rectangle
    room = placement.room
    min_req = max(MIN_CLEARANCES.get(room.type, 2.0), room.min_width_m)
    if rect.min_dim < min_req:
        violations.append(
            f"{room.id}: min dimension {rect.min_dim:.2f}m < "
            f"{min_req:.2f}m required clearance"
        )
    # door-swing reservation
    door_area = room.num_doors * DOOR_SWING_ARC_M ** 2
    if rect.area < door_area + room.target_area_sqm * 0.3:
        violations.append(
            f"{room.id}: insufficient area for {room.num_doors} "
            f"door swing(s) ({door_area:.2f} m² needed)"
        )
    return violations


# =====================================================================
#  DOMAIN 7 — STRUCTURAL MECHANICS & SPAN LIMITS
# =====================================================================

def check_span_limits(
    placement: RoomPlacement,
    max_span: float,
    min_ceiling_height: float,
) -> Dict[str, Any]:
    """
    Flag rooms whose clear span exceeds the slab limit.

    Beam depth heuristic: span/10 … span/12.
    Check that remaining headroom ≥ 2.4 m.
    """
    rect = placement.rectangle
    needs_column = rect.max_dim > max_span
    beam_depth = rect.max_dim / 10.0
    clear_height = min_ceiling_height - beam_depth
    return {
        "room_id": placement.room.id,
        "max_dimension_m": round(rect.max_dim, 3),
        "max_span_limit_m": max_span,
        "needs_intermediate_column": needs_column,
        "beam_depth_estimate_m": round(beam_depth, 3),
        "clear_height_under_beam_m": round(clear_height, 3),
        "headroom_ok": clear_height >= 2.4,
    }


# =====================================================================
#  DOMAIN 8 — VERTICAL CIRCULATION (STAIRCASE MATRIX)
# =====================================================================

def calculate_staircase_footprint(
    floor_to_floor_height: float = 3.0,
    max_riser_height: float = 0.19,
    min_tread_depth: float = 0.25,
    stair_width: float = 1.0,
    num_flights: int = 2,
) -> Tuple[float, float, Dict[str, Any]]:
    """
    Calculate exact rectangular footprint for a code-compliant staircase.

    Number_of_Risers = ⌈ Floor_to_Floor_Height / Riser_Height ⌉
    Total_Run_Length = (Number_of_Risers - 1) × Tread_Depth

    Returns (footprint_width, footprint_length, metadata).
    """
    num_risers = math.ceil(floor_to_floor_height / max_riser_height)
    actual_riser = floor_to_floor_height / num_risers
    total_run = (num_risers - 1) * min_tread_depth

    if num_flights >= 2:
        risers_per_flight = num_risers // num_flights
        run_per_flight = (risers_per_flight - 1) * min_tread_depth
        landing_depth = stair_width
        fp_width = num_flights * stair_width + 0.1 * (num_flights - 1)  # 100 mm divider
        fp_length = run_per_flight + landing_depth
    else:
        fp_width = stair_width
        fp_length = total_run

    meta = {
        "num_risers": num_risers,
        "actual_riser_height_m": round(actual_riser, 4),
        "actual_tread_depth_m": min_tread_depth,
        "total_run_m": round(total_run, 3),
        "num_flights": num_flights,
        "footprint_width_m": round(fp_width, 3),
        "footprint_length_m": round(fp_length, 3),
        "footprint_area_sqm": round(fp_width * fp_length, 3),
    }
    return fp_width, fp_length, meta


# =====================================================================
#  DOMAIN 9 — ENVIRONMENTAL PHYSICS & ORIENTATION SCORING
# =====================================================================

def wall_bearing(facade: str, north_angle_deg: float) -> float:
    """
    Compute the true compass bearing a facade wall faces.

    Convention:
      • site +y → "top",  −y → "bottom",  +x → "right",  −x → "left"
      • ``north_angle_deg`` = clockwise rotation from +y to true north.
    """
    local_bearings = {"top": 0.0, "right": 90.0, "bottom": 180.0, "left": 270.0}
    local = local_bearings.get(facade, 0.0)
    return (local + north_angle_deg) % 360.0


def thermal_load_factor(bearing: float) -> float:
    """
    Score (0-1) of thermal radiation intensity by compass bearing.

    West (270°) receives peak afternoon sun → highest load.
    South-west (225°) and south (180°) are next worst.
    """

    def _proximity(target: float) -> float:
        diff = abs(bearing - target)
        return max(0.0, 1.0 - min(diff, 360.0 - diff) / 90.0)

    return max(
        _proximity(270.0) * 1.0,   # west
        _proximity(225.0) * 0.8,   # south-west
        _proximity(180.0) * 0.5,   # south
    )


def score_solar(
    placement: RoomPlacement,
    boundary: Rectangle,
    north_angle_deg: float,
) -> Dict[str, Any]:
    """Score thermal exposure of a placed room."""
    facades = placement.rectangle.exterior_facades(boundary)
    if not facades:
        return {"thermal_penalty": 0.0, "facades": [], "bearings": {}, "thermal_loads": {}}

    bearings = {f: wall_bearing(f, north_angle_deg) for f in facades}
    loads = {f: thermal_load_factor(b) for f, b in bearings.items()}
    max_load = max(loads.values()) if loads else 0.0

    # High-occupancy habitable rooms receive full penalty; others are dampened.
    is_high_occ = placement.room.type == RoomType.HABITABLE
    penalty = max_load * (1.0 if is_high_occ else 0.3)

    return {
        "thermal_penalty": round(penalty, 4),
        "facades": facades,
        "bearings": {f: round(b, 1) for f, b in bearings.items()},
        "thermal_loads": {f: round(v, 3) for f, v in loads.items()},
    }


def check_fenestration(
    placement: RoomPlacement,
    boundary: Rectangle,
    min_ratio: float = 0.10,
) -> Dict[str, Any]:
    """
    Verify Window-to-Floor Area Ratio (WFR).

    A habitable room with exterior wall access must achieve:
        Window_Area ≥ min_ratio × Floor_Area
    """
    facades = placement.rectangle.exterior_facades(boundary)
    applicable = bool(facades) and placement.room.type in (
        RoomType.HABITABLE,
        RoomType.UTILITY,
    )
    if not applicable:
        return {"applicable": False, "compliant": True}

    rect = placement.rectangle
    wall_length = 0.0
    for f in facades:
        wall_length += rect.height if f in ("left", "right") else rect.width

    # conservative estimate: max window height 1.2 m
    max_window_area = wall_length * 1.2
    required = rect.area * min_ratio
    return {
        "applicable": True,
        "floor_area_sqm": round(rect.area, 2),
        "required_window_area_sqm": round(required, 2),
        "available_wall_length_m": round(wall_length, 2),
        "max_window_area_sqm": round(max_window_area, 2),
        "compliant": max_window_area >= required,
    }


# =====================================================================
#  DOMAIN 6 & 10 — PATHFINDING  (Circulation & Egress)
# =====================================================================

def _build_room_graph(placements: List[RoomPlacement]) -> Dict[str, Set[str]]:
    """Adjacency graph where rooms sharing a wall are neighbours."""
    graph: Dict[str, Set[str]] = {p.room.id: set() for p in placements}
    for i, p1 in enumerate(placements):
        for p2 in placements[i + 1 :]:
            if rectangles_adjacent(p1.rectangle, p2.rectangle):
                graph[p1.room.id].add(p2.room.id)
                graph[p2.room.id].add(p1.room.id)
    return graph


def analyze_circulation(
    placements: List[RoomPlacement],
    usable_area: float,
    max_ratio: float = 0.15,
) -> Dict[str, Any]:
    """
    Domain 6 — Circulation budget & connectivity check.

    • corridor_area = usable_area − Σ room_area
    • 15% rule: corridor_ratio must be ≤ max_ratio
    • BFS connectivity: every room reachable from the first room
    """
    total_room_area = sum(p.rectangle.area for p in placements)
    corridor_area = max(0.0, usable_area - total_room_area)
    corridor_ratio = corridor_area / usable_area if usable_area > 0 else 0.0

    # BFS connectivity
    graph = _build_room_graph(placements)
    visited: Set[str] = set()
    if placements:
        queue = [placements[0].room.id]
        visited.add(queue[0])
        while queue:
            cur = queue.pop(0)
            for nbr in graph.get(cur, set()):
                if nbr not in visited:
                    visited.add(nbr)
                    queue.append(nbr)

    all_ids = {p.room.id for p in placements}
    disconnected = all_ids - visited

    return {
        "usable_area_sqm": round(usable_area, 2),
        "total_room_area_sqm": round(total_room_area, 2),
        "corridor_area_sqm": round(corridor_area, 2),
        "corridor_ratio": round(corridor_ratio, 4),
        "corridor_budget_ok": corridor_ratio <= max_ratio,
        "all_rooms_connected": len(disconnected) == 0,
        "disconnected_rooms": sorted(disconnected),
    }


def analyze_egress(
    placements: List[RoomPlacement],
    boundary: Rectangle,
    max_travel_m: float = 22.0,
) -> Dict[str, Any]:
    """
    Domain 10 — Life-safety egress analysis.

    Multi-source Dijkstra from every room that touches an exterior wall
    (assumed exit capability) to every other room.  Edge weight =
    centre-to-centre Euclidean distance.
    """
    if not placements:
        return {"compliant": True, "max_travel_distance_m": 0.0, "violations": []}

    graph = _build_room_graph(placements)
    pmap = {p.room.id: p for p in placements}

    # Exit rooms = those with at least one exterior facade
    exit_rooms = {
        p.room.id
        for p in placements
        if p.rectangle.exterior_facades(boundary)
    }
    if not exit_rooms:
        return {
            "compliant": False,
            "max_travel_distance_m": float("inf"),
            "violations": ["No rooms have exterior wall access — no viable exits"],
        }

    dist: Dict[str, float] = {rid: float("inf") for rid in pmap}
    heap: List[Tuple[float, str]] = []
    for eid in exit_rooms:
        dist[eid] = 0.0
        heapq.heappush(heap, (0.0, eid))

    while heap:
        d, u = heapq.heappop(heap)
        if d > dist[u]:
            continue
        for v in graph.get(u, set()):
            cu = pmap[u].rectangle.center
            cv = pmap[v].rectangle.center
            edge_cost = math.hypot(cu[0] - cv[0], cu[1] - cv[1])
            new_d = d + edge_cost
            if new_d < dist[v]:
                dist[v] = new_d
                heapq.heappush(heap, (new_d, v))

    violations: List[str] = []
    max_dist = 0.0
    for rid, d in dist.items():
        if d > max_travel_m:
            violations.append(
                f"{rid}: travel distance {d:.2f}m exceeds {max_travel_m}m limit"
            )
        max_dist = max(max_dist, d if d != float("inf") else 0.0)

    return {
        "compliant": len(violations) == 0,
        "max_travel_distance_m": round(max_dist, 2),
        "room_distances_m": {r: round(d, 2) for r, d in dist.items()},
        "violations": violations,
    }


# =====================================================================
#  GLOBAL CONSTRAINTS CONFIG
# =====================================================================

@dataclass
class GlobalConstraints:
    """Thresholds that apply across the entire layout."""
    max_unsupported_span_m: float = 5.0
    min_ceiling_height_m: float = 3.0
    structural_grid_module_m: float = 0.5
    max_riser_height_m: float = 0.19
    min_tread_depth_m: float = 0.25
    floor_to_floor_height_m: float = 3.0
    max_circulation_ratio: float = 0.15
    max_egress_distance_m: float = 22.0
    min_fenestration_ratio: float = 0.10
    door_swing_clearance_m: float = 0.9


# =====================================================================
#  ROOM PLACEMENT & SOLUTION CONTAINERS
# =====================================================================

@dataclass
class RoomPlacement:
    """A room assigned to a rectangle in the layout."""
    room: RoomNode
    rectangle: Rectangle

    @property
    def area_deviation(self) -> float:
        if self.room.target_area_sqm <= 0:
            return 0.0
        return abs(self.rectangle.area - self.room.target_area_sqm) / self.room.target_area_sqm

    @property
    def width_valid(self) -> bool:
        return self.rectangle.min_dim >= self.room.min_width_m

    @property
    def aspect_ratio_valid(self) -> bool:
        ar = self.rectangle.aspect_ratio
        return self.room.min_aspect_ratio <= ar <= self.room.max_aspect_ratio


@dataclass
class LayoutSolutionV2:
    placements: List[RoomPlacement] = field(default_factory=list)
    total_penalty: float = 0.0
    iteration: int = 0
    constraints_satisfied: Dict[str, bool] = field(default_factory=dict)
    diagnostics: Dict[str, Any] = field(default_factory=dict)

    @property
    def placement_map(self) -> Dict[str, RoomPlacement]:
        return {p.room.id: p for p in self.placements}

    def clone(self) -> LayoutSolutionV2:
        return deepcopy(self)


# =====================================================================
#  DOMAIN 3 — BSP ENGINE (grid-aware, room-type-aware)
# =====================================================================

@dataclass
class PartitionNode:
    rectangle: Rectangle
    left: Optional[PartitionNode] = None
    right: Optional[PartitionNode] = None
    split_direction: Optional[PartitionDirection] = None
    split_position: Optional[float] = None
    assigned_room: Optional[RoomNode] = None

    def is_leaf(self) -> bool:
        return self.left is None and self.right is None

    def get_leaves(self) -> List[PartitionNode]:
        if self.is_leaf():
            return [self]
        leaves: List[PartitionNode] = []
        if self.left:
            leaves.extend(self.left.get_leaves())
        if self.right:
            leaves.extend(self.right.get_leaves())
        return leaves


def partition_space_gridaware(
    rect: Rectangle,
    direction: PartitionDirection,
    ratio: float,
    grid: float = 0.0,
) -> Tuple[Rectangle, Rectangle]:
    """Partition a rectangle with optional grid-snapped cut position."""
    if direction == PartitionDirection.VERTICAL:
        raw = rect.x + rect.width * ratio
        cut = snap_to_grid(raw, grid) if grid > 0 else raw
        margin = max(grid, 0.5) if grid > 0 else 0.5
        cut = max(rect.x + margin, min(cut, rect.x + rect.width - margin))
        left = Rectangle(rect.x, rect.y, cut - rect.x, rect.height)
        right = Rectangle(cut, rect.y, rect.x + rect.width - cut, rect.height)
        return left, right
    else:
        raw = rect.y + rect.height * ratio
        cut = snap_to_grid(raw, grid) if grid > 0 else raw
        margin = max(grid, 0.5) if grid > 0 else 0.5
        cut = max(rect.y + margin, min(cut, rect.y + rect.height - margin))
        top = Rectangle(rect.x, rect.y, rect.width, cut - rect.y)
        bottom = Rectangle(rect.x, cut, rect.width, rect.y + rect.height - cut)
        return top, bottom


def build_partition_tree_v2(
    rect: Rectangle,
    rooms: List[RoomNode],
    grid: float = 0.0,
    max_depth: int = 10,
    depth: int = 0,
) -> PartitionNode:
    """Recursive BSP with grid snapping and priority-aware room ordering."""
    node = PartitionNode(rectangle=rect)
    if len(rooms) <= 1 or depth >= max_depth:
        if rooms:
            node.assigned_room = rooms[0]
        return node

    # Slice along longer axis
    direction = (
        PartitionDirection.VERTICAL
        if rect.width >= rect.height
        else PartitionDirection.HORIZONTAL
    )

    # Sort: higher priority first, then larger area
    sorted_rooms = sorted(rooms, key=lambda r: (-r.priority, -r.target_area_sqm))
    total_area = sum(r.target_area_sqm for r in sorted_rooms)

    # Area-balanced split index
    cumulative = 0.0
    split_idx = 0
    target_half = total_area / 2
    for i, room in enumerate(sorted_rooms):
        cumulative += room.target_area_sqm
        split_idx = i + 1
        if cumulative >= target_half:
            break
    split_idx = max(1, min(split_idx, len(sorted_rooms) - 1))

    left_area = sum(r.target_area_sqm for r in sorted_rooms[:split_idx])
    ratio = (left_area / total_area) if total_area > 0 else 0.5
    ratio = max(0.2, min(0.8, ratio))

    left_rect, right_rect = partition_space_gridaware(rect, direction, ratio, grid)
    node.left = build_partition_tree_v2(
        left_rect, sorted_rooms[:split_idx], grid, max_depth, depth + 1
    )
    node.right = build_partition_tree_v2(
        right_rect, sorted_rooms[split_idx:], grid, max_depth, depth + 1
    )
    node.split_direction = direction
    node.split_position = ratio
    return node


def extract_placements(node: PartitionNode) -> List[RoomPlacement]:
    out: List[RoomPlacement] = []
    for leaf in node.get_leaves():
        if leaf.assigned_room:
            out.append(RoomPlacement(room=leaf.assigned_room, rectangle=leaf.rectangle))
    return out


# =====================================================================
#  COMPREHENSIVE PENALTY CALCULATOR  (all 10 domains)
# =====================================================================

@dataclass
class PenaltyWeightsV2:
    """Per-domain penalty weights.  Higher → harder constraint."""
    # Original core
    area_deviation: float = 100.0
    min_width_violation: float = 500.0
    aspect_ratio_violation: float = 50.0
    adjacency_violation: float = 10.0
    exterior_wall_violation: float = 300.0
    overlap_collision: float = 1000.0
    # Domain 1 — FSI
    fsi_violation: float = 2000.0
    # Domain 2 — wet-wall / acoustic
    plumbing_cluster_penalty: float = 80.0
    acoustic_zone_violation: float = 100.0
    # Domain 4 — anthropometric
    clearance_violation: float = 400.0
    # Domain 5 — structural grid
    grid_snap_deviation: float = 30.0
    # Domain 6 — circulation
    circulation_excess: float = 150.0
    # Domain 7 — spans
    span_violation: float = 800.0
    beam_headroom_violation: float = 600.0
    # Domain 9 — solar / fenestration
    solar_thermal_penalty: float = 40.0
    fenestration_violation: float = 200.0
    # Domain 10 — egress
    egress_distance_violation: float = 1500.0


def calculate_penalty_v2(
    placements: List[RoomPlacement],
    boundary: Rectangle,
    site: SiteConfig,
    constraints: GlobalConstraints,
    adjacency_map: Dict[Tuple[str, str], float],
    weights: PenaltyWeightsV2,
) -> Tuple[float, Dict[str, bool], Dict[str, Any]]:
    """
    Unified penalty function covering all 10 constraint domains.

    Returns (total_penalty, constraints_satisfied, diagnostics).
    """
    total = 0.0
    sat: Dict[str, bool] = {}
    diag: Dict[str, Any] = {}

    # ── Domain 1: FSI ──
    total_room_area = sum(p.rectangle.area for p in placements)
    fsi_info = validate_fsi(total_room_area, site)
    diag["fsi"] = fsi_info
    if not fsi_info["compliant"]:
        overshoot = fsi_info["fsi_actual"] - fsi_info["fsi_limit"]
        total += overshoot * weights.fsi_violation
        sat["fsi_compliance"] = False
    else:
        sat["fsi_compliance"] = True

    # ── Per-room checks ──
    structural_checks: List[Dict] = []
    solar_scores: List[Dict] = []
    fenestration_checks: List[Dict] = []
    anthropometric_issues: List[str] = []

    for p in placements:
        rid = p.room.id

        # Area deviation
        if p.area_deviation > 0.10:
            total += p.area_deviation * weights.area_deviation * p.room.priority
            sat[f"{rid}_area"] = False
        else:
            sat[f"{rid}_area"] = True

        # Min width  (Domain 4: anthropometric)
        if not p.width_valid:
            shortfall = p.room.min_width_m - p.rectangle.min_dim
            total += shortfall ** 2 * weights.min_width_violation * p.room.priority
            sat[f"{rid}_width"] = False
        else:
            sat[f"{rid}_width"] = True

        # Anthropometric clearance
        anthro = check_anthropometric(p)
        if anthro:
            total += weights.clearance_violation * len(anthro)
            sat[f"{rid}_clearance"] = False
            anthropometric_issues.extend(anthro)
        else:
            sat[f"{rid}_clearance"] = True

        # Aspect ratio  (Domain 3)
        if not p.aspect_ratio_valid:
            ar = p.rectangle.aspect_ratio
            deviation = max(0, ar - p.room.max_aspect_ratio, p.room.min_aspect_ratio - ar)
            total += deviation * weights.aspect_ratio_violation * p.room.priority
            sat[f"{rid}_aspect"] = False
        else:
            sat[f"{rid}_aspect"] = True

        # Exterior wall
        if p.room.requires_exterior_wall:
            has_ext = p.rectangle.shares_edge_with(boundary)
            if not has_ext:
                total += weights.exterior_wall_violation * p.room.priority
                sat[f"{rid}_exterior"] = False
            else:
                sat[f"{rid}_exterior"] = True

        # Domain 7: span limits
        span_info = check_span_limits(
            p, constraints.max_unsupported_span_m, constraints.min_ceiling_height_m
        )
        structural_checks.append(span_info)
        if span_info["needs_intermediate_column"]:
            overshoot = p.rectangle.max_dim - constraints.max_unsupported_span_m
            total += overshoot * weights.span_violation
            sat[f"{rid}_span"] = False
        else:
            sat[f"{rid}_span"] = True
        if not span_info["headroom_ok"]:
            total += weights.beam_headroom_violation
            sat[f"{rid}_headroom"] = False
        else:
            sat[f"{rid}_headroom"] = True

        # Domain 9: solar thermal
        solar = score_solar(p, boundary, site.north_angle_deg)
        solar_scores.append({"room_id": rid, **solar})
        if solar["thermal_penalty"] > 0.5:
            total += solar["thermal_penalty"] * weights.solar_thermal_penalty
            sat[f"{rid}_solar"] = False
        else:
            sat[f"{rid}_solar"] = True

        # Domain 9: fenestration
        fen = check_fenestration(p, boundary, constraints.min_fenestration_ratio)
        fenestration_checks.append({"room_id": rid, **fen})
        if fen.get("applicable") and not fen.get("compliant", True):
            total += weights.fenestration_violation
            sat[f"{rid}_fenestration"] = False
        elif fen.get("applicable"):
            sat[f"{rid}_fenestration"] = True

        # Domain 5: grid snap quality
        grid = constraints.structural_grid_module_m
        if grid > 0:
            x_err = abs(p.rectangle.x - snap_to_grid(p.rectangle.x, grid))
            w_err = abs(p.rectangle.width - snap_to_grid(p.rectangle.width, grid))
            snap_err = x_err + w_err
            if snap_err > grid * 0.1:
                total += snap_err * weights.grid_snap_deviation
                sat[f"{rid}_grid"] = False
            else:
                sat[f"{rid}_grid"] = True

    # ── Overlap check ──
    for i, p1 in enumerate(placements):
        for p2 in placements[i + 1 :]:
            if rectangles_overlap(p1.rectangle, p2.rectangle):
                total += weights.overlap_collision

    # ── Adjacency & Domain 2 ──
    pmap = {p.room.id: p for p in placements}
    for (id1, id2), score in adjacency_map.items():
        if id1 not in pmap or id2 not in pmap:
            continue
        p1_r, p2_r = pmap[id1], pmap[id2]
        adj = rectangles_adjacent(p1_r.rectangle, p2_r.rectangle)
        if score > 0 and not adj:
            dist = p1_r.rectangle.distance_to(p2_r.rectangle)
            total += dist * score * weights.adjacency_violation
        elif score < 0 and adj:
            total += abs(score) * weights.adjacency_violation

    # Domain 2: plumbing clustering
    plumbing_rooms = [p for p in placements if p.room.plumbing_required]
    for i, pr1 in enumerate(plumbing_rooms):
        for pr2 in plumbing_rooms[i + 1 :]:
            key = f"plumbing_{pr1.room.id}_{pr2.room.id}"
            if not rectangles_adjacent(pr1.rectangle, pr2.rectangle):
                dist = pr1.rectangle.distance_to(pr2.rectangle)
                total += dist * weights.plumbing_cluster_penalty
                sat[key] = False
            else:
                sat[key] = True

    # Domain 2: acoustic zoning
    for i, p1 in enumerate(placements):
        for p2 in placements[i + 1 :]:
            if rectangles_adjacent(p1.rectangle, p2.rectangle):
                z1 = p1.room.acoustic_zone
                z2 = p2.room.acoustic_zone
                if {z1, z2} == {AcousticZone.ACTIVE, AcousticZone.PASSIVE}:
                    total += weights.acoustic_zone_violation
                    sat[f"acoustic_{p1.room.id}_{p2.room.id}"] = False

    # ── Domain 6: circulation ──
    circ = analyze_circulation(
        placements, boundary.area, constraints.max_circulation_ratio
    )
    diag["circulation"] = circ
    if not circ["corridor_budget_ok"]:
        excess = circ["corridor_ratio"] - constraints.max_circulation_ratio
        total += excess * weights.circulation_excess * 100
        sat["circulation_budget"] = False
    else:
        sat["circulation_budget"] = True
    if not circ["all_rooms_connected"]:
        total += weights.circulation_excess * len(circ["disconnected_rooms"])
        sat["room_connectivity"] = False
    else:
        sat["room_connectivity"] = True

    # ── Domain 10: egress ──
    egress = analyze_egress(
        placements, boundary, constraints.max_egress_distance_m
    )
    diag["egress"] = egress
    if not egress["compliant"]:
        total += weights.egress_distance_violation * len(egress["violations"])
        sat["egress_compliance"] = False
    else:
        sat["egress_compliance"] = True

    diag["structural_checks"] = structural_checks
    diag["solar_scores"] = solar_scores
    diag["fenestration_checks"] = fenestration_checks
    diag["anthropometric_issues"] = anthropometric_issues

    return total, sat, diag


# =====================================================================
#  MAIN SOLVER — LayoutSolverV2
# =====================================================================

class LayoutSolverV2:
    """
    Production-grade CSP solver with 10 architectural constraint domains.

    1.  Computes usable boundary from plot minus setbacks.
    2.  Pre-validates FSI feasibility.
    3.  Injects staircase fixed geometry (Domain 8).
    4.  Auto-adds plumbing clustering adjacencies (Domain 2).
    5.  Runs iterative BSP with grid-snapped partitions.
    6.  Evaluates full penalty function (all domains) per iteration.
    """

    def __init__(
        self,
        site: SiteConfig,
        constraints: GlobalConstraints,
        rooms: List[RoomNode],
        adjacency_edges: Optional[List[AdjacencyEdge]] = None,
        weights: Optional[PenaltyWeightsV2] = None,
        max_iterations: int = 200,
        random_seed: Optional[int] = None,
    ):
        self.site = site
        self.constraints = constraints
        self.weights = weights or PenaltyWeightsV2()
        self.max_iterations = max_iterations
        if random_seed is not None:
            random.seed(random_seed)

        # ── Domain 1: usable boundary ──
        self.usable_boundary = site.usable_boundary()

        # ── Domain 8: lock staircase geometry ──
        self.rooms = list(rooms)
        self._inject_staircase_rooms()

        # ── Domain 2: adjacency map with plumbing auto-injection ──
        self.adjacency_map = self._build_adjacency_map(adjacency_edges or [])

        # FSI pre-check (informational)
        total_target = sum(r.target_area_sqm for r in self.rooms)
        self._fsi_precheck = validate_fsi(total_target, site)

        self.best_solution: Optional[LayoutSolutionV2] = None
        self.iteration_history: List[float] = []

    # -- private helpers ----------------------------------------------

    def _inject_staircase_rooms(self) -> None:
        """Calculate and lock staircase footprint dimensions."""
        for room in self.rooms:
            if room.type == RoomType.STAIRCASE and room.fixed_dimensions is None:
                w, h, _ = calculate_staircase_footprint(
                    floor_to_floor_height=self.constraints.floor_to_floor_height_m,
                    max_riser_height=self.constraints.max_riser_height_m,
                    min_tread_depth=self.constraints.min_tread_depth_m,
                )
                room.fixed_dimensions = (w, h)
                room.target_area_sqm = w * h
                room.min_width_m = min(w, h)
                if min(w, h) > 0:
                    room.max_aspect_ratio = max(w, h) / min(w, h) + 0.01

    def _build_adjacency_map(
        self, edges: List[AdjacencyEdge]
    ) -> Dict[Tuple[str, str], float]:
        adj: Dict[Tuple[str, str], float] = {}
        valid_ids = {r.id for r in self.rooms}
        for e in edges:
            if e.node_a not in valid_ids or e.node_b not in valid_ids:
                continue
            key = tuple(sorted((e.node_a, e.node_b)))
            adj[key] = e.weight

        # Auto-inject plumbing clustering (Domain 2)
        plumbing_ids = [r.id for r in self.rooms if r.plumbing_required]
        for i, a in enumerate(plumbing_ids):
            for b in plumbing_ids[i + 1 :]:
                key = tuple(sorted((a, b)))
                if key not in adj:
                    adj[key] = 5.0  # moderate attract
        return adj

    # -- solve --------------------------------------------------------

    def solve(self) -> LayoutSolutionV2:
        """Run iterative BSP + full-domain penalty optimisation."""
        self.best_solution = None
        self.iteration_history = []

        for iteration in range(self.max_iterations):
            solution = self._generate_solution(iteration)
            solution.iteration = iteration

            penalty, sat, diag = calculate_penalty_v2(
                solution.placements,
                self.usable_boundary,
                self.site,
                self.constraints,
                self.adjacency_map,
                self.weights,
            )
            solution.total_penalty = penalty
            solution.constraints_satisfied = sat
            solution.diagnostics = diag
            self.iteration_history.append(penalty)

            if self.best_solution is None or penalty < self.best_solution.total_penalty:
                self.best_solution = solution

            # Converged
            if penalty < 1.0:
                break

        return self.best_solution or LayoutSolutionV2()

    def _generate_solution(self, iteration: int) -> LayoutSolutionV2:
        rooms = list(self.rooms)
        if iteration > 0:
            random.shuffle(rooms)

        root = build_partition_tree_v2(
            self.usable_boundary,
            rooms,
            grid=self.constraints.structural_grid_module_m,
            max_depth=8,
        )
        placements = extract_placements(root)
        self._adjust_placements(placements, iteration)
        return LayoutSolutionV2(placements=placements)

    def _adjust_placements(
        self, placements: List[RoomPlacement], iteration: int
    ) -> None:
        """Iteratively refine rectangles toward target areas / constraints."""
        passes = 5 + iteration // 20
        grid = self.constraints.structural_grid_module_m

        for _ in range(passes):
            for p in placements:
                room = p.room
                rect = p.rectangle

                # Staircase — locked geometry, skip adjustment
                if room.type == RoomType.STAIRCASE and room.fixed_dimensions:
                    rect.width, rect.height = room.fixed_dimensions
                    continue

                blend = 0.35

                # Adjust height toward target area
                if rect.width > room.min_width_m and rect.width > 0:
                    target_h = room.target_area_sqm / rect.width
                    # Clamp by aspect-ratio limits
                    min_h = min(rect.width, rect.height) / room.max_aspect_ratio
                    max_h = max(rect.width, rect.height) * room.max_aspect_ratio
                    target_h = max(min_h, min(target_h, max_h))
                    new_h = rect.height * (1 - blend) + target_h * blend
                    rect.height = snap_to_grid(new_h, grid) if grid > 0 else new_h

                # Fix under-width
                if rect.min_dim < room.min_width_m:
                    if rect.width < rect.height:
                        new_w = rect.width + (room.min_width_m - rect.width) * blend
                        rect.width = snap_to_grid(new_w, grid) if grid > 0 else new_w
                        if rect.width > 0:
                            rect.height = room.target_area_sqm / rect.width
                    else:
                        new_h = rect.height + (room.min_width_m - rect.height) * blend
                        rect.height = snap_to_grid(new_h, grid) if grid > 0 else new_h
                        if rect.height > 0:
                            rect.width = room.target_area_sqm / rect.height

    # -- reporting ----------------------------------------------------

    def get_full_report(self) -> Dict[str, Any]:
        """Comprehensive JSON-serialisable report with all domain analyses."""
        if not self.best_solution:
            return {"error": "No solution generated"}

        sol = self.best_solution
        met = sum(1 for v in sol.constraints_satisfied.values() if v)
        total_c = max(1, len(sol.constraints_satisfied))

        # Staircase info
        stair_info = None
        for r in self.rooms:
            if r.type == RoomType.STAIRCASE:
                _, _, stair_info = calculate_staircase_footprint(
                    self.constraints.floor_to_floor_height_m,
                    self.constraints.max_riser_height_m,
                    self.constraints.min_tread_depth_m,
                )
                break

        return {
            "total_penalty": round(sol.total_penalty, 4),
            "iteration_found": sol.iteration,
            "total_iterations": len(self.iteration_history),
            "constraints_met_ratio": round(met / total_c, 4),
            "constraints_detail": sol.constraints_satisfied,
            "fsi_analysis": self._fsi_precheck,
            "usable_boundary": {
                "x": round(self.usable_boundary.x, 3),
                "y": round(self.usable_boundary.y, 3),
                "width": round(self.usable_boundary.width, 3),
                "height": round(self.usable_boundary.height, 3),
                "area_sqm": round(self.usable_boundary.area, 2),
            },
            "staircase": stair_info,
            "diagnostics": sol.diagnostics,
            "placements": [
                {
                    "room_id": p.room.id,
                    "name": p.room.name,
                    "type": p.room.type.value,
                    "acoustic_zone": p.room.acoustic_zone.value
                    if p.room.acoustic_zone
                    else None,
                    "target_area_sqm": p.room.target_area_sqm,
                    "actual_area_sqm": round(p.rectangle.area, 2),
                    "area_deviation_pct": round(p.area_deviation * 100, 2),
                    "position": {
                        "x": round(p.rectangle.x, 3),
                        "y": round(p.rectangle.y, 3),
                    },
                    "dimensions": {
                        "width": round(p.rectangle.width, 3),
                        "height": round(p.rectangle.height, 3),
                    },
                    "aspect_ratio": round(p.rectangle.aspect_ratio, 3),
                    "min_dimension_m": round(p.rectangle.min_dim, 3),
                    "width_valid": p.width_valid,
                    "aspect_ratio_valid": p.aspect_ratio_valid,
                    "plumbing_required": p.room.plumbing_required,
                    "requires_exterior_wall": p.room.requires_exterior_wall,
                }
                for p in sol.placements
            ],
        }
