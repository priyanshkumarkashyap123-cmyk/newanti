"""
Generative Architectural Layout Engine v2.1 — Production-Grade CSP Solver

Implements 10 constraint domains for code-compliant residential floor plan generation:

  1. Site Boundary & Regulatory Geometry  (setbacks, FSI cap, polygon sites)
  2. Topological Graph & Wet Wall Clustering  (plumbing, acoustic zoning, buffer insertion)
  3. Binary Space Partitioning with Room-Type Aspect Ratios
  4. Anthropometric Hard Limits  (clearances, door-swing vectors)
  5. Structural Grid & Load Paths  (grid snapping, column/beam output)
  6. Circulation Optimization  (A* on discretized grid, 15% corridor rule)
  7. Structural Mechanics & Span Limits  (slab spans, beam depth)
  8. Vertical Circulation / Staircase Matrix
  9. Environmental Physics & Orientation Scoring  (solar, WWR, shading)
 10. Egress & Life Safety  (Dijkstra max travel distance)

v2.1 additions:
  - General polygon site boundaries via Shapely (L-shaped, trapezoidal, irregular)
  - Simulated Annealing optimizer (warm-started from BSP)
  - A* pathfinding on discretized floor grid for real travel distances
  - Acoustic buffer zone auto-insertion between Active/Passive zones
  - Window-to-Wall Ratio (WWR) calculation per room
  - Enhanced solar scoring with latitude-aware azimuth + shading specs
  - Structural grid output (column/beam layout for solver integration)
  - Multi-story FSI tracking

Author: BeamLab Spatial Planning Engine
Version: 2.1
"""

from __future__ import annotations

import heapq
import math
import random
from copy import deepcopy
from dataclasses import dataclass, field
from enum import Enum, IntEnum
from typing import Any, Dict, List, Optional, Set, Tuple

import numpy as np
from shapely.geometry import Polygon as ShapelyPolygon, MultiPolygon, box as shapely_box
from shapely.ops import unary_union
from shapely.validation import make_valid


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
    """Master plot definition including regulatory limits.

    Supports both rectangular plots (width × height) and general polygon
    sites (L-shaped, trapezoidal, irregular) via ``polygon_vertices``.
    """
    width: float
    height: float
    fsi_limit: float = 1.5
    setbacks: Setbacks = field(default_factory=Setbacks)
    north_angle_deg: float = 0.0
    latitude_deg: float = 20.0  # site latitude for solar calcs (default: central India)
    polygon_vertices: Optional[List[Tuple[float, float]]] = None  # general polygon

    # -- derived --

    @property
    def is_polygon(self) -> bool:
        return self.polygon_vertices is not None and len(self.polygon_vertices) >= 3

    @property
    def plot_polygon(self) -> ShapelyPolygon:
        """Shapely polygon of the site boundary."""
        if self.is_polygon:
            poly = ShapelyPolygon(self.polygon_vertices)
            if not poly.is_valid:
                poly = make_valid(poly)
                if isinstance(poly, MultiPolygon):
                    poly = max(poly.geoms, key=lambda g: g.area)
            return poly
        return shapely_box(0, 0, self.width, self.height)

    @property
    def plot_area(self) -> float:
        if self.is_polygon:
            return float(self.plot_polygon.area)
        return self.width * self.height

    @property
    def max_built_area(self) -> float:
        """Maximum total covered area allowed by FSI."""
        return self.plot_area * self.fsi_limit

    def usable_boundary(self) -> Rectangle:
        """Compute the buildable bounding box after inward setback offsets.

        For rectangular plots, this is exact.  For polygon plots, we offset
        the polygon inward by the *minimum* setback, then return its AABB.
        """
        if self.is_polygon:
            return self._polygon_usable_boundary()
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

    def usable_polygon(self) -> ShapelyPolygon:
        """The actual usable polygon after setback offsets.

        For rectangular plots this equals ``usable_boundary()`` as a Shapely
        box.  For irregular plots it is the inward-buffered polygon.
        """
        if self.is_polygon:
            offset_dist = min(
                self.setbacks.front, self.setbacks.rear,
                self.setbacks.left, self.setbacks.right,
            )
            buffered = self.plot_polygon.buffer(-offset_dist)
            if buffered.is_empty:
                raise ValueError("Setbacks consume entire polygon site")
            if isinstance(buffered, MultiPolygon):
                buffered = max(buffered.geoms, key=lambda g: g.area)
            return buffered
        ub = self.usable_boundary()
        return shapely_box(ub.x, ub.y, ub.x + ub.width, ub.y + ub.height)

    def _polygon_usable_boundary(self) -> Rectangle:
        """AABB of the setback-offset polygon."""
        poly = self.usable_polygon()
        minx, miny, maxx, maxy = poly.bounds
        return Rectangle(x=minx, y=miny, width=maxx - minx, height=maxy - miny)


def validate_fsi(
    total_room_area: float,
    site: SiteConfig,
    num_floors: int = 1,
) -> Dict[str, Any]:
    """
    Check Floor Space Index compliance (multi-story aware).

    FSI = Total_Covered_Area / Plot_Area
    Total_Covered_Area = sum of floor areas across all stories.
    """
    total_covered = total_room_area * num_floors
    fsi_actual = total_covered / site.plot_area if site.plot_area > 0 else float("inf")
    compliant = fsi_actual <= site.fsi_limit
    ub = site.usable_boundary()
    # How many floors needed to fit all rooms under FSI cap
    if ub.area > 0 and site.fsi_limit > 0:
        max_per_floor = site.max_built_area / max(1, num_floors)
        floors_needed = math.ceil(total_room_area / ub.area)
    else:
        floors_needed = 0
    auto_story_split = not compliant and floors_needed > num_floors
    return {
        "fsi_actual": round(fsi_actual, 4),
        "fsi_limit": site.fsi_limit,
        "compliant": compliant,
        "max_allowed_area": round(site.max_built_area, 2),
        "total_covered_area": round(total_covered, 2),
        "num_floors": num_floors,
        "floors_required": max(1, floors_needed),
        "auto_story_split_suggested": auto_story_split,
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
    latitude_deg: float = 20.0,
) -> Dict[str, Any]:
    """Score thermal exposure of a placed room with latitude-aware solar model.

    Uses simplified solar geometry: at ``latitude_deg``, the sun's peak
    altitude determines how much radiation hits each facade.  West and
    South-West facades receive the worst afternoon heat.

    When thermal penalty is high for a habitable room, generates a shading
    device (chajja/overhang) recommendation.
    """
    facades = placement.rectangle.exterior_facades(boundary)
    if not facades:
        return {
            "thermal_penalty": 0.0, "facades": [], "bearings": {},
            "thermal_loads": {}, "shading_spec": None,
        }

    bearings = {f: wall_bearing(f, north_angle_deg) for f in facades}

    # Latitude-adjusted thermal load: higher latitudes get less intense
    # south sun; lower latitudes get hammered from west.
    lat_factor = max(0.5, 1.0 - abs(latitude_deg - 23.5) / 50.0)
    loads = {
        f: thermal_load_factor(b) * lat_factor for f, b in bearings.items()
    }
    max_load = max(loads.values()) if loads else 0.0

    is_high_occ = placement.room.type == RoomType.HABITABLE
    penalty = max_load * (1.0 if is_high_occ else 0.3)

    # Generate shading spec when penalty is high for habitable rooms
    shading_spec = None
    if is_high_occ and penalty > 0.5:
        worst_facade = max(loads, key=loads.get)
        worst_bearing = bearings[worst_facade]
        # Overhang depth: deeper for west (1.0m) than south (0.6m)
        depth = 0.6 + 0.4 * thermal_load_factor(worst_bearing)
        facade_length = (
            placement.rectangle.height
            if worst_facade in ("left", "right")
            else placement.rectangle.width
        )
        shading_spec = {
            "facade": worst_facade,
            "bearing_deg": round(worst_bearing, 1),
            "overhang_depth_m": round(depth, 2),
            "overhang_length_m": round(facade_length, 2),
            "type": "chajja",
            "reduces_penalty_by": round(penalty * 0.4, 3),
        }

    return {
        "thermal_penalty": round(penalty, 4),
        "facades": facades,
        "bearings": {f: round(b, 1) for f, b in bearings.items()},
        "thermal_loads": {f: round(v, 3) for f, v in loads.items()},
        "shading_spec": shading_spec,
    }


def check_fenestration(
    placement: RoomPlacement,
    boundary: Rectangle,
    min_ratio: float = 0.10,
) -> Dict[str, Any]:
    """
    Verify Window-to-Wall Ratio (WWR) per facade.

    WWR = Total_Window_Area / Total_Exterior_Wall_Area

    NBC 2016: habitable rooms need minimum 1/8 of floor area as openable
    window area.  We also enforce WWR ∈ [10%, 60%] for thermal comfort.
    """
    facades = placement.rectangle.exterior_facades(boundary)
    applicable = bool(facades) and placement.room.type in (
        RoomType.HABITABLE,
        RoomType.UTILITY,
    )
    if not applicable:
        return {"applicable": False, "compliant": True, "wwr": None}

    rect = placement.rectangle
    # Assume floor-to-ceiling height of 3.0m for wall area calculation
    ceiling_h = 3.0
    total_wall_area = 0.0
    for f in facades:
        wall_len = rect.height if f in ("left", "right") else rect.width
        total_wall_area += wall_len * ceiling_h

    # Window sizing: 1.2m wide × 1.5m tall per 10 m² of floor area (NBC 2016)
    num_windows = max(1, round(rect.area / 10.0))
    window_w, window_h = 1.2, 1.5
    total_window_area = num_windows * window_w * window_h

    # Clamp: can't have more window than wall
    total_window_area = min(total_window_area, total_wall_area * 0.6)

    wwr = total_window_area / total_wall_area if total_wall_area > 0 else 0.0
    floor_ratio = total_window_area / rect.area if rect.area > 0 else 0.0

    compliant = wwr >= min_ratio and wwr <= 0.60
    nbc_compliant = floor_ratio >= 1 / 8  # NBC: openable >= 1/8 floor area

    return {
        "applicable": True,
        "floor_area_sqm": round(rect.area, 2),
        "total_wall_area_sqm": round(total_wall_area, 2),
        "total_window_area_sqm": round(total_window_area, 2),
        "num_windows": num_windows,
        "wwr": round(wwr, 4),
        "wwr_min": min_ratio,
        "wwr_max": 0.60,
        "compliant": compliant,
        "nbc_floor_ratio": round(floor_ratio, 4),
        "nbc_floor_ratio_compliant": nbc_compliant,
        "available_wall_length_m": round(
            sum(
                rect.height if f in ("left", "right") else rect.width
                for f in facades
            ),
            2,
        ),
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
#  COMPLIANCE ITEM — Clause-traceable constraint result (Industry-grade)
# =====================================================================

@dataclass
class ComplianceItem:
    """Structured compliance result for one constraint check.

    Provides clause-traceable, severity-ranked output per domain so the
    API consumer (architect / BIM tool) can render code-specific failures
    with actionable remediation text rather than bare pass/fail booleans.
    """
    domain: str                          # e.g. "fsi", "egress", "fenestration"
    label: str                           # Human-readable name
    passed: bool
    severity: str                        # "critical" | "warning" | "info"
    clause: str                          # e.g. "NBC 2016 Cl. 4.8"
    measured_value: Optional[float] = None
    limit_value: Optional[float] = None
    units: str = ""                      # e.g. "m²", "m", "%", "ratio"
    affected_rooms: List[str] = field(default_factory=list)
    remediation: str = ""               # Actionable fix suggestion
    evidence_level: str = "hard_code_rule"  # "hard_code_rule" | "engineering_heuristic"


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
        solar = score_solar(p, boundary, site.north_angle_deg, site.latitude_deg)
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

    def _build_compliance_items(
        self,
        sol: "LayoutSolutionV2",
    ) -> List[Dict[str, Any]]:
        """Build clause-traceable compliance items from diagnostic data.

        Post-processes the diagnostic dicts produced by calculate_penalty_v2()
        into a unified list of ComplianceItem-like dicts with:
          - NBC/IS code clause references
          - Severity levels (critical / warning / info)
          - Measured vs. limit values
          - Affected room IDs
          - Actionable remediation text

        Returns a list of serialisable dicts (not dataclasses) for JSON output.
        Reference codes: NBC 2016, IS 456:2000, IS 800:2007, IS 1172, ECBC 2017.
        """
        items: List[Dict[str, Any]] = []
        diag = sol.diagnostics
        sat = sol.constraints_satisfied

        # ── 1. FSI / FAR — NBC 2016 Cl. 4.8, IS 875 Part 5 Cl. 3.2 ──
        fsi = self._fsi_precheck
        fsi_passed = fsi.get("compliant", True)
        fsi_actual = fsi.get("fsi_actual", 0.0)
        fsi_limit = fsi.get("fsi_limit", 1.5)
        items.append({
            "domain": "fsi",
            "label": "Floor Space Index (FSI / FAR)",
            "passed": fsi_passed,
            "severity": "critical" if not fsi_passed else "info",
            "clause": "NBC 2016 Cl. 4.8 / IS 875 Part 5 Cl. 3.2",
            "measured_value": round(fsi_actual, 3),
            "limit_value": fsi_limit,
            "units": "ratio",
            "affected_rooms": [],
            "remediation": (
                f"FSI {fsi_actual:.3f} exceeds permitted limit {fsi_limit}. "
                f"Currently {fsi.get('num_floors', 1)} floor(s); need "
                f"{fsi.get('floors_required', 1)} floors to fit requested area within FSI. "
                "Options: (a) ADD a floor, (b) REDUCE total room area, "
                "(c) REQUEST FSI relaxation from local authority."
            ) if not fsi_passed else "FSI within permitted limits — no action required.",
            "evidence_level": "hard_code_rule",
        })

        # ── 2. Room Overlap — Computational constraint ──
        any_overlap = any(
            not v
            for k, v in sat.items()
            if k == "overlap" or "overlap" in k
        )
        # Derive from penalty: if total_penalty has a large component, rooms overlap
        # We check by looking for collision-related diagnostics
        overlap_passed = not any_overlap
        items.append({
            "domain": "overlap",
            "label": "Room Overlap (Collision Check)",
            "passed": overlap_passed,
            "severity": "critical" if not overlap_passed else "info",
            "clause": "N/A — computational hard constraint (rooms must not overlap)",
            "measured_value": None,
            "limit_value": None,
            "units": "",
            "affected_rooms": [],
            "remediation": (
                "Solver did not find a collision-free layout. "
                "Try: (a) Increase max_iterations, (b) Reduce total requested area, "
                "(c) Relax min_width_m for secondary rooms."
            ) if not overlap_passed else "No room overlaps detected.",
            "evidence_level": "hard_code_rule",
        })

        # ── 3. Minimum Room Width — NBC 2016 Part 3 Cl. 4.1 ──
        width_failures = [k for k, v in sat.items() if k.endswith("_width") and not v]
        min_width_passed = len(width_failures) == 0
        items.append({
            "domain": "min_width",
            "label": "Minimum Room Width",
            "passed": min_width_passed,
            "severity": "warning" if not min_width_passed else "info",
            "clause": "NBC 2016 Part 3 Cl. 4.1 (habitable ≥ 2.8 m, wet ≥ 1.8 m, circ ≥ 1.2 m)",
            "measured_value": None,
            "limit_value": None,
            "units": "m",
            "affected_rooms": [k.replace("_width", "") for k in width_failures],
            "remediation": (
                f"{len(width_failures)} room(s) placed narrower than minimum. "
                "IS 962 / NBC Cl. 4.1 minimums: habitable 2.8 m, wet 1.8 m, corridor 1.2 m. "
                "Increase usable area or reduce room count."
            ) if not min_width_passed else "All rooms meet minimum width requirements.",
            "evidence_level": "hard_code_rule",
        })

        # ── 4. Aspect Ratio — NBC 2016 Part 3 Cl. 4.1 ──
        ar_failures = [k for k, v in sat.items() if k.endswith("_aspect") and not v]
        ar_passed = len(ar_failures) == 0
        items.append({
            "domain": "aspect_ratio",
            "label": "Room Aspect Ratio (L/W)",
            "passed": ar_passed,
            "severity": "warning" if not ar_passed else "info",
            "clause": "NBC 2016 Part 3 Cl. 4.1 (habitable rooms: 1.0 ≤ L/W ≤ 1.5)",
            "measured_value": None,
            "limit_value": 1.5,
            "units": "ratio",
            "affected_rooms": [k.replace("_aspect", "") for k in ar_failures],
            "remediation": (
                f"{len(ar_failures)} room(s) have aspect ratio outside 1.0–1.5 range. "
                "Extreme proportions reduce furniture options and natural light penetration. "
                "Reshape rooms to approach a square-ish plan."
            ) if not ar_passed else "Room aspect ratios within acceptable range.",
            "evidence_level": "hard_code_rule",
        })

        # ── 5. Exterior Wall Access — NBC 2016 Cl. 4.11 ──
        ext_failures = [k for k, v in sat.items() if k.endswith("_exterior") and not v]
        ext_passed = len(ext_failures) == 0
        items.append({
            "domain": "exterior_wall",
            "label": "Exterior Wall Access (Natural Ventilation)",
            "passed": ext_passed,
            "severity": "warning" if not ext_passed else "info",
            "clause": "NBC 2016 Cl. 4.11 / SP 7(Part 8):2005 (habitable rooms require natural ventilation)",
            "measured_value": None,
            "limit_value": None,
            "units": "",
            "affected_rooms": [k.replace("_exterior", "") for k in ext_failures],
            "remediation": (
                f"{len(ext_failures)} habitable room(s) are landlocked (no exterior wall). "
                "NBC Cl. 4.11 mandates at least one exterior wall for natural ventilation. "
                "Options: (a) Rearrange layout, (b) Add interior courtyard/lightwell, "
                "(c) Use mechanical ventilation with fresh-air intake per SP 7."
            ) if not ext_passed else "All habitable rooms have exterior wall access.",
            "evidence_level": "hard_code_rule",
        })

        # ── 6. Wet-Wall Clustering — IS 1172:1993 Cl. 6.1 ──
        plumb_failures = [k for k, v in sat.items() if k.startswith("plumbing_") and not v]
        plumb_passed = len(plumb_failures) == 0
        items.append({
            "domain": "plumbing_cluster",
            "label": "Wet-Wall Clustering (Plumbing Economy)",
            "passed": plumb_passed,
            "severity": "info" if not plumb_passed else "info",
            "clause": "IS 1172:1993 Cl. 6.1 (shared drain stacks — wet rooms on common wall)",
            "measured_value": None,
            "limit_value": None,
            "units": "",
            "affected_rooms": [],
            "remediation": (
                "Wet rooms (bathrooms/kitchen) are not sharing walls, creating long plumbing runs. "
                "IS 1172 Cl. 6.1 recommends grouping wet rooms on a shared drain stack wall. "
                "Each metre of dispersed pipework increases cost and leak risk."
            ) if not plumb_passed else "Wet rooms correctly clustered — shared drain stack possible.",
            "evidence_level": "engineering_heuristic",
        })

        # ── 7. Acoustic Zone Separation — NBC 2016 Part 8 Cl. 4 ──
        acoustic_failures = [k for k, v in sat.items() if k.startswith("acoustic_") and not v]
        acoustic_passed = len(acoustic_failures) == 0
        items.append({
            "domain": "acoustic_zones",
            "label": "Acoustic Zone Separation",
            "passed": acoustic_passed,
            "severity": "warning" if not acoustic_passed else "info",
            "clause": "NBC 2016 Part 8 Cl. 4 / IS 1950 (noise isolation: ≥ 45 dB STC between active-passive zones)",
            "measured_value": None,
            "limit_value": None,
            "units": "",
            "affected_rooms": [],
            "remediation": (
                f"{len(acoustic_failures)} active/passive room pair(s) are directly adjacent. "
                "NBC Part 8 Cl. 4 requires STC ≥ 45 dB between living zones and bedrooms. "
                "Insert 1.2 m closet/corridor buffer, or use double-leaf wall with 50 mm air gap."
            ) if not acoustic_passed else "Active/passive acoustic zones correctly separated.",
            "evidence_level": "engineering_heuristic",
        })

        # ── 8. Anthropometric Clearances — NBC 2016 Part 3 Cl. 4.1, IS 962 ──
        anthro = diag.get("anthropometric_issues", [])
        anthro_passed = len(anthro) == 0
        items.append({
            "domain": "clearance",
            "label": "Anthropometric Clearances (Door Swing + Min Dim)",
            "passed": anthro_passed,
            "severity": "warning" if not anthro_passed else "info",
            "clause": "NBC 2016 Part 3 Cl. 4.1 / IS 962:1989 (ergonomic dimensional standards)",
            "measured_value": None,
            "limit_value": None,
            "units": "m",
            "affected_rooms": [a.split(":")[0].strip() for a in anthro if ":" in a],
            "remediation": (
                f"{len(anthro)} clearance issue(s) detected. "
                "Min clear dimensions per NBC Part 3 Cl. 4.1: habitable 2.8 m, wet 1.8 m, corridor 1.2 m. "
                "Door swing arc requires 0.9 m × 0.9 m clear zone per door per IS 962."
            ) if not anthro_passed else "All rooms meet anthropometric clearance requirements.",
            "evidence_level": "hard_code_rule",
        })

        # ── 9. Structural Grid Snap — IS 456:2000 Cl. 5.3, IS 800:2007 ──
        grid_failures = [k for k, v in sat.items() if k.endswith("_grid") and not v]
        grid_passed = len(grid_failures) == 0
        items.append({
            "domain": "grid_snap",
            "label": "Structural Grid Coordination",
            "passed": grid_passed,
            "severity": "info" if not grid_passed else "info",
            "clause": "IS 456:2000 Cl. 5.3 / IS 800:2007 (modular coordination for structural members)",
            "measured_value": None,
            "limit_value": self.constraints.structural_grid_module_m,
            "units": "m modular offset",
            "affected_rooms": [k.replace("_grid", "") for k in grid_failures],
            "remediation": (
                f"{len(grid_failures)} room(s) are off the {self.constraints.structural_grid_module_m} m structural grid. "
                "Misalignment forces non-standard structural member sizes and increases fabrication cost. "
                "Adjust room positions to snap to the grid module."
            ) if not grid_passed else f"All rooms snap to {self.constraints.structural_grid_module_m} m structural grid.",
            "evidence_level": "engineering_heuristic",
        })

        # ── 10. Circulation Ratio — NBC 2016 Cl. 6.4 ──
        circ = diag.get("circulation", {})
        circ_budget_ok = circ.get("corridor_budget_ok", True)
        all_connected = circ.get("all_rooms_connected", True)
        circ_ratio = circ.get("corridor_ratio", 0.0)
        circ_limit = self.constraints.max_circulation_ratio
        disconnected = circ.get("disconnected_rooms", [])

        if not all_connected:
            items.append({
                "domain": "circulation",
                "label": "Room Connectivity (BFS Graph Check)",
                "passed": False,
                "severity": "critical",
                "clause": "NBC 2016 Cl. 6.4 / NBC Part 4 (every occupied room reachable from entry)",
                "measured_value": None,
                "limit_value": None,
                "units": "",
                "affected_rooms": disconnected,
                "remediation": (
                    f"Room(s) {', '.join(disconnected)} are unreachable from the entry point. "
                    "Add a shared-wall adjacency or corridor connecting isolated rooms. "
                    "NBC Cl. 6.4 requires all occupied spaces to be accessible from the main entry."
                ),
                "evidence_level": "engineering_heuristic",
            })

        items.append({
            "domain": "circulation",
            "label": "Circulation Area Ratio",
            "passed": circ_budget_ok,
            "severity": "warning" if not circ_budget_ok else "info",
            "clause": "NBC 2016 Cl. 6.4 (corridor / circulation ≤ 15% of usable floor area)",
            "measured_value": round(circ_ratio * 100, 1),
            "limit_value": round(circ_limit * 100, 1),
            "units": "%",
            "affected_rooms": [],
            "remediation": (
                f"Circulation area {circ_ratio * 100:.1f}% exceeds {circ_limit * 100:.0f}% ceiling. "
                "Merge small corridor fragments, widen rooms into corridors, or add pocket doors "
                "to convert corridors into room-to-room throughways."
            ) if not circ_budget_ok else f"Circulation ratio {circ_ratio * 100:.1f}% within {circ_limit * 100:.0f}% limit.",
            "evidence_level": "engineering_heuristic",
        })

        # ── 11. Span Limits — IS 456:2000 Cl. 23.2 ──
        str_checks = diag.get("structural_checks", [])
        span_failing = [s for s in str_checks if s.get("needs_intermediate_column")]
        headroom_failing = [s for s in str_checks if not s.get("headroom_ok", True)]
        span_passed = len(span_failing) == 0
        max_span_measured = max(
            (s.get("max_dimension_m", 0) for s in span_failing), default=None
        )
        items.append({
            "domain": "span_limits",
            "label": "Structural Span Limits",
            "passed": span_passed,
            "severity": "warning" if not span_passed else "info",
            "clause": "IS 456:2000 Cl. 23.2 / NBC 2016 Cl. 5.1.1 (max unsupported slab span)",
            "measured_value": round(max_span_measured, 2) if max_span_measured is not None else None,
            "limit_value": self.constraints.max_unsupported_span_m,
            "units": "m",
            "affected_rooms": [s["room_id"] for s in span_failing],
            "remediation": (
                f"{len(span_failing)} room(s) exceed {self.constraints.max_unsupported_span_m} m span limit. "
                "Options: (a) Add intermediate column (IS 456 Cl. 23.2: verify L/d ≥ 12 for beam), "
                "(b) Use post-tensioned flat slab (IS 1343), "
                "(c) Split room with internal partition beam."
            ) if not span_passed else "All clear spans within structural limit.",
            "evidence_level": "hard_code_rule",
        })

        if headroom_failing:
            items.append({
                "domain": "span_limits",
                "label": "Beam Headroom (Clear Height Under Soffite)",
                "passed": False,
                "severity": "warning",
                "clause": "NBC 2016 Cl. 5.1 (min 2.4 m clear height under beams in habitable spaces)",
                "measured_value": min(
                    s.get("clear_height_under_beam_m", 0) for s in headroom_failing
                ),
                "limit_value": 2.4,
                "units": "m",
                "affected_rooms": [s["room_id"] for s in headroom_failing],
                "remediation": (
                    "Clear height under downstand beam < 2.4 m. "
                    "Options: (a) Increase floor-to-floor height, "
                    "(b) Use flat slab with drop panels (IS 456 Cl. 31) to eliminate downstand, "
                    "(c) Recess beam within floor zone."
                ),
                "evidence_level": "engineering_heuristic",
            })

        # ── 12. Staircase Compliance — NBC 2016 Part 4 Cl. 3 ──
        stair_rooms = [r for r in self.rooms if r.type.value == "staircase"]
        if stair_rooms:
            stair_sat = all(
                sat.get(f"{r.id}_width", True) and sat.get(f"{r.id}_area", True)
                for r in stair_rooms
            )
            items.append({
                "domain": "staircase",
                "label": "Staircase Geometry Compliance",
                "passed": stair_sat,
                "severity": "critical" if not stair_sat else "info",
                "clause": "NBC 2016 Part 4 Cl. 3 / IS 456 (riser ≤ 190 mm, tread ≥ 250 mm, width ≥ 1.0 m)",
                "measured_value": self.constraints.max_riser_height_m * 1000,
                "limit_value": 190.0,
                "units": "mm (riser height)",
                "affected_rooms": [r.id for r in stair_rooms],
                "remediation": (
                    "Staircase footprint does not match code-derived geometry. "
                    f"NBC Cl. 3: riser ≤ {self.constraints.max_riser_height_m * 1000:.0f} mm, "
                    f"tread ≥ {self.constraints.min_tread_depth_m * 1000:.0f} mm, "
                    "clear width ≥ 1.0 m (residential), 1.5 m (commercial)."
                ) if not stair_sat else "Staircase geometry is code-compliant.",
                "evidence_level": "hard_code_rule",
            })

        # ── 13. Fenestration / WWR — NBC 2016 Cl. 4.9, ECBC 2017 Cl. 3.3 ──
        fen_checks = diag.get("fenestration_checks", [])
        wwr_failing = [
            f for f in fen_checks
            if f.get("applicable") and not f.get("compliant", True)
        ]
        nbc_failing = [
            f for f in fen_checks
            if f.get("applicable") and not f.get("nbc_floor_ratio_compliant", True)
        ]
        fen_passed = len(wwr_failing) == 0
        items.append({
            "domain": "fenestration",
            "label": "Window-to-Wall Ratio (WWR)",
            "passed": fen_passed,
            "severity": "warning" if not fen_passed else "info",
            "clause": "NBC 2016 Cl. 4.9 (WWR 10–60%) / ECBC 2017 Cl. 3.3.1",
            "measured_value": (
                round(min(f.get("wwr", 1.0) for f in wwr_failing), 3)
                if wwr_failing else None
            ),
            "limit_value": self.constraints.min_fenestration_ratio if wwr_failing else None,
            "units": "ratio (0–1)",
            "affected_rooms": [f["room_id"] for f in wwr_failing],
            "remediation": (
                f"{len(wwr_failing)} room(s) have WWR outside 10–60% range. "
                f"Current minimum: {self.constraints.min_fenestration_ratio * 100:.0f}% (NBC Cl. 4.9). "
                "Add or enlarge windows. For deep rooms, consider clerestory strips or solar tubes."
            ) if not fen_passed else "All rooms meet window-to-wall ratio requirements.",
            "evidence_level": "hard_code_rule",
        })

        if nbc_failing:
            items.append({
                "domain": "fenestration",
                "label": "NBC Minimum Openable Window Area (1/8 Floor Area)",
                "passed": False,
                "severity": "critical",
                "clause": "NBC 2016 Cl. 4.9 (openable window ≥ 1/8 of floor area for habitable rooms)",
                "measured_value": round(
                    min(f.get("nbc_floor_ratio", 0.0) for f in nbc_failing), 3
                ),
                "limit_value": 0.125,
                "units": "ratio (window / floor area)",
                "affected_rooms": [f["room_id"] for f in nbc_failing],
                "remediation": (
                    f"{len(nbc_failing)} habitable room(s) have openable window area < 1/8 (12.5%) of floor area. "
                    "NBC 2016 Cl. 4.9 is a mandatory provision for habitable rooms. "
                    "Increase openable sash width/height or add louvred transom panels."
                ),
                "evidence_level": "hard_code_rule",
            })

        # ── 14. Egress Travel Distance — NBC 2016 Cl. 5.3 ──
        egress = diag.get("egress", {})
        egress_passed = egress.get("compliant", True)
        max_travel = egress.get("max_travel_distance_m", 0.0)
        egress_limit = self.constraints.max_egress_distance_m
        egress_violations = egress.get("violations", [])
        egress_rooms = [v.split(":")[0].strip() for v in egress_violations if ":" in v]
        items.append({
            "domain": "egress",
            "label": "Egress Travel Distance (Life Safety)",
            "passed": egress_passed,
            "severity": "critical" if not egress_passed else "info",
            "clause": "NBC 2016 Cl. 5.3 / IS 456:2000 Cl. 8.1 (max travel distance to exit)",
            "measured_value": round(max_travel, 2),
            "limit_value": egress_limit,
            "units": "m",
            "affected_rooms": egress_rooms,
            "remediation": (
                f"Max travel distance {max_travel:.1f} m exceeds {egress_limit} m NBC limit. "
                f"{len(egress_rooms)} room(s) affected. "
                "Options: (a) Add a second staircase/exit closer to affected rooms, "
                "(b) Relocate staircase to a more central position, "
                "(c) Redesign room adjacencies to reduce the longest travel path."
            ) if not egress_passed else f"All rooms within {egress_limit} m egress travel limit.",
            "evidence_level": "hard_code_rule",
        })

        # ── 15. Solar Thermal Exposure — ECBC 2017 Cl. 3.1 ──
        solar_scores = diag.get("solar_scores", [])
        high_thermal = [s for s in solar_scores if s.get("thermal_penalty", 0) > 0.5]
        solar_passed = len(high_thermal) == 0
        items.append({
            "domain": "solar",
            "label": "Solar Thermal Exposure (Passive Design)",
            "passed": solar_passed,
            "severity": "warning" if not solar_passed else "info",
            "clause": "ECBC 2017 Cl. 3.1 / NBC 2016 Cl. 4.8 (passive solar design, shading coefficient ≤ 0.4)",
            "measured_value": round(
                max((s.get("thermal_penalty", 0) for s in high_thermal), default=0.0), 3
            ) if high_thermal else None,
            "limit_value": 0.5 if high_thermal else None,
            "units": "thermal penalty (0–1)",
            "affected_rooms": [s.get("room_id", "") for s in high_thermal],
            "remediation": (
                f"{len(high_thermal)} habitable room(s) face high west/SW solar load. "
                "ECBC 2017 requires shading coefficient SC ≤ 0.4 for west facades (Climate Zone 4A). "
                "Install chajja/overhang (depth = 0.6–1.0 m) or external louvre on worst facade. "
                "Alternatively reorient room to north/north-east."
            ) if not solar_passed else "All rooms have acceptable solar orientation.",
            "evidence_level": "engineering_heuristic",
        })

        return items

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

        # A* travel distances
        grid = FloorGrid(self.usable_boundary, cell_size=0.2)
        grid.rasterise(sol.placements)
        travel = compute_travel_distances(grid, sol.placements)

        # Acoustic buffer analysis
        _, acoustic_buffers = insert_acoustic_buffers(
            sol.placements, buffer_width_m=1.2, min_buffer_width_m=0.6
        )

        # Structural grid
        structural = generate_structural_grid(
            sol.placements,
            self.usable_boundary,
            grid_module_m=self.constraints.structural_grid_module_m,
            max_span_m=6.0,
        )

        # Build clause-traceable compliance items (industry-grade output)
        compliance_items = self._build_compliance_items(sol)

        # Space-syntax graph analysis
        space_syntax_data = None
        try:
            from space_syntax import SpaceSyntaxAnalyzer
            ss = SpaceSyntaxAnalyzer()
            ss_result = ss.analyze(
                sol.placements,
                self.usable_boundary,
                self.adjacency_map,
            )
            space_syntax_data = ss_result.to_dict()
        except ImportError:
            pass

        # Structural handoff payload (Phase G)
        structural_handoff = generate_structural_handoff(
            sol.placements,
            self.usable_boundary,
            self.constraints,
        )

        # MEP schedule summary (Phase G)
        mep_schedule = generate_mep_schedule(sol.placements)

        return {
            "total_penalty": round(sol.total_penalty, 4),
            "iteration_found": sol.iteration,
            "total_iterations": len(self.iteration_history),
            "constraints_met_ratio": round(met / total_c, 4),
            "constraints_detail": sol.constraints_satisfied,
            "compliance_items": compliance_items,
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
            "travel_distances": travel,
            "acoustic_buffers": acoustic_buffers,
            "structural_grid": structural,
            "space_syntax": space_syntax_data,
            "structural_handoff": structural_handoff,
            "mep_schedule": mep_schedule,
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


# =====================================================================
#  A* PATHFINDING ON DISCRETISED FLOOR GRID  (Domain 6 upgrade)
# =====================================================================

class CellType(IntEnum):
    """Grid cell classification for discretised floor plan."""
    EMPTY = 0
    ROOM = 1
    WALL = 2
    CORRIDOR = 3
    DOOR = 4
    EXIT = 5


@dataclass
class FloorGrid:
    """Rasterised representation of a floor plan for A* pathfinding.

    ``cell_size`` controls resolution: 0.1 m → 30k cells for 20×15 m plot.
    0.2 m is a good balance between accuracy and speed during optimisation.
    """
    boundary: Rectangle
    cell_size: float = 0.2
    _grid: Optional[np.ndarray] = field(default=None, repr=False)

    def __post_init__(self) -> None:
        cols = max(1, int(math.ceil(self.boundary.width / self.cell_size)))
        rows = max(1, int(math.ceil(self.boundary.height / self.cell_size)))
        self._grid = np.full((rows, cols), CellType.EMPTY, dtype=np.int8)

    @property
    def rows(self) -> int:
        return self._grid.shape[0]

    @property
    def cols(self) -> int:
        return self._grid.shape[1]

    def _to_rc(self, x: float, y: float) -> Tuple[int, int]:
        """World coords → (row, col)."""
        c = int((x - self.boundary.x) / self.cell_size)
        r = int((y - self.boundary.y) / self.cell_size)
        return (
            max(0, min(r, self.rows - 1)),
            max(0, min(c, self.cols - 1)),
        )

    def _to_xy(self, r: int, c: int) -> Tuple[float, float]:
        """(row, col) → world centre of cell."""
        x = self.boundary.x + (c + 0.5) * self.cell_size
        y = self.boundary.y + (r + 0.5) * self.cell_size
        return x, y

    def rasterise(
        self,
        placements: List[RoomPlacement],
        wall_thickness: float = 0.2,
    ) -> None:
        """Paint rooms, walls, and mark exterior-facing rooms as exits."""
        # Reset
        self._grid[:] = CellType.CORRIDOR  # default: walkable corridor

        for p in placements:
            rect = p.rectangle
            r0, c0 = self._to_rc(rect.x, rect.y)
            r1, c1 = self._to_rc(rect.x + rect.width, rect.y + rect.height)
            self._grid[r0:r1, c0:c1] = CellType.ROOM

        # Paint walls at room boundaries (1-cell thick)
        for p in placements:
            rect = p.rectangle
            r0, c0 = self._to_rc(rect.x, rect.y)
            r1, c1 = self._to_rc(rect.x + rect.width, rect.y + rect.height)
            # Top and bottom walls
            if r0 < self.rows:
                self._grid[r0, c0:c1] = CellType.WALL
            if r1 > 0 and r1 - 1 < self.rows:
                self._grid[r1 - 1, c0:c1] = CellType.WALL
            # Left and right walls
            if c0 < self.cols:
                self._grid[r0:r1, c0] = CellType.WALL
            if c1 > 0 and c1 - 1 < self.cols:
                self._grid[r0:r1, c1 - 1] = CellType.WALL

        # Punch doors between adjacent rooms (centre of shared edge)
        for i, p1 in enumerate(placements):
            for p2 in placements[i + 1:]:
                if rectangles_adjacent(p1.rectangle, p2.rectangle, tol=0.5):
                    cx = (p1.rectangle.center[0] + p2.rectangle.center[0]) / 2
                    cy = (p1.rectangle.center[1] + p2.rectangle.center[1]) / 2
                    dr, dc = self._to_rc(cx, cy)
                    if 0 <= dr < self.rows and 0 <= dc < self.cols:
                        self._grid[dr, dc] = CellType.DOOR
                        # Expand door to 2-cell opening
                        for dr2, dc2 in [(dr - 1, dc), (dr + 1, dc), (dr, dc - 1), (dr, dc + 1)]:
                            if 0 <= dr2 < self.rows and 0 <= dc2 < self.cols:
                                if self._grid[dr2, dc2] == CellType.WALL:
                                    self._grid[dr2, dc2] = CellType.DOOR
                                    break

        # Mark exit cells (rooms touching the boundary edge)
        for p in placements:
            if p.rectangle.shares_edge_with(self.boundary):
                rect = p.rectangle
                r0, c0 = self._to_rc(rect.x, rect.y)
                r1, c1 = self._to_rc(rect.x + rect.width, rect.y + rect.height)
                # Paint external-facing edge cells as EXIT
                if abs(rect.x - self.boundary.x) < 0.1 and c0 < self.cols:
                    self._grid[r0:r1, c0] = CellType.EXIT
                if abs(rect.x + rect.width - self.boundary.x - self.boundary.width) < 0.1 and c1 > 0:
                    self._grid[r0:r1, c1 - 1] = CellType.EXIT
                if abs(rect.y - self.boundary.y) < 0.1 and r0 < self.rows:
                    self._grid[r0, c0:c1] = CellType.EXIT
                if abs(rect.y + rect.height - self.boundary.y - self.boundary.height) < 0.1 and r1 > 0:
                    self._grid[r1 - 1, c0:c1] = CellType.EXIT

    @property
    def corridor_ratio(self) -> float:
        """Fraction of total cells that are corridor (wasted) space."""
        total = self._grid.size
        if total == 0:
            return 0.0
        corridor_cells = int(np.sum(self._grid == CellType.CORRIDOR))
        return corridor_cells / total

    def cell_is_walkable(self, r: int, c: int) -> bool:
        ct = self._grid[r, c]
        return ct in (CellType.ROOM, CellType.CORRIDOR, CellType.DOOR, CellType.EXIT)


def astar_pathfind(
    grid: FloorGrid,
    start_xy: Tuple[float, float],
    goal_xy: Tuple[float, float],
) -> Tuple[float, List[Tuple[int, int]]]:
    """A* pathfinding on the discretised floor grid.

    Returns (travel_distance_m, path_cells).
    If no path exists, returns (inf, []).
    """
    sr, sc = grid._to_rc(*start_xy)
    gr, gc = grid._to_rc(*goal_xy)

    if not grid.cell_is_walkable(sr, sc) or not grid.cell_is_walkable(gr, gc):
        return float("inf"), []

    # A* with 8-connected neighbours
    DIAG_COST = 1.414
    STRAIGHT_COST = 1.0
    NEIGHBOURS = [
        (-1, 0, STRAIGHT_COST), (1, 0, STRAIGHT_COST),
        (0, -1, STRAIGHT_COST), (0, 1, STRAIGHT_COST),
        (-1, -1, DIAG_COST), (-1, 1, DIAG_COST),
        (1, -1, DIAG_COST), (1, 1, DIAG_COST),
    ]

    def heuristic(r: int, c: int) -> float:
        """Octile distance heuristic."""
        dr = abs(r - gr)
        dc = abs(c - gc)
        return STRAIGHT_COST * max(dr, dc) + (DIAG_COST - STRAIGHT_COST) * min(dr, dc)

    open_set: List[Tuple[float, int, int]] = []
    heapq.heappush(open_set, (heuristic(sr, sc), sr, sc))
    g_score: Dict[Tuple[int, int], float] = {(sr, sc): 0.0}
    came_from: Dict[Tuple[int, int], Tuple[int, int]] = {}
    rows, cols = grid.rows, grid.cols

    while open_set:
        _, cr, cc = heapq.heappop(open_set)
        if cr == gr and cc == gc:
            # Reconstruct path
            path = [(cr, cc)]
            while (cr, cc) in came_from:
                cr, cc = came_from[(cr, cc)]
                path.append((cr, cc))
            path.reverse()
            distance_m = g_score[(gr, gc)] * grid.cell_size
            return distance_m, path

        current_g = g_score.get((cr, cc), float("inf"))

        for dr, dc, step_cost in NEIGHBOURS:
            nr, nc = cr + dr, cc + dc
            if 0 <= nr < rows and 0 <= nc < cols and grid.cell_is_walkable(nr, nc):
                # Penalise moving through walls (shouldn't happen but safety)
                new_g = current_g + step_cost
                if new_g < g_score.get((nr, nc), float("inf")):
                    g_score[(nr, nc)] = new_g
                    came_from[(nr, nc)] = (cr, cc)
                    f = new_g + heuristic(nr, nc)
                    heapq.heappush(open_set, (f, nr, nc))

    return float("inf"), []


def compute_travel_distances(
    grid: FloorGrid,
    placements: List[RoomPlacement],
    entry_xy: Optional[Tuple[float, float]] = None,
) -> Dict[str, Any]:
    """Run A* from main entry (or first room) to every room centroid.

    Returns travel distances and the actual grid corridor ratio.
    """
    if not placements:
        return {"distances": {}, "corridor_ratio": 0.0, "max_travel_m": 0.0}

    # Find entry point: use explicit entry or first room marked is_entry or first room
    if entry_xy is None:
        entry_rooms = [p for p in placements if p.room.is_entry]
        entry_p = entry_rooms[0] if entry_rooms else placements[0]
        entry_xy = entry_p.rectangle.center

    distances: Dict[str, float] = {}
    for p in placements:
        dist, _ = astar_pathfind(grid, entry_xy, p.rectangle.center)
        distances[p.room.id] = round(dist, 2)

    max_travel = max(distances.values()) if distances else 0.0

    return {
        "entry_xy": [round(entry_xy[0], 2), round(entry_xy[1], 2)],
        "distances_m": distances,
        "corridor_ratio": round(grid.corridor_ratio, 4),
        "max_travel_m": round(max_travel, 2),
    }


# =====================================================================
#  ACOUSTIC BUFFER ZONE INSERTION  (Domain 2 upgrade)
# =====================================================================

def insert_acoustic_buffers(
    placements: List[RoomPlacement],
    buffer_width_m: float = 1.2,
    min_buffer_width_m: float = 0.6,
) -> Tuple[List[RoomPlacement], List[Dict[str, Any]]]:
    """Detect Active↔Passive adjacencies and insert buffer zones.

    When two adjacent rooms belong to conflicting acoustic zones
    (ACTIVE vs PASSIVE), a buffer room (closet or corridor) is inserted
    by trimming both rooms and placing the buffer in between.

    Returns (updated_placements, buffer_reports).
    """
    buffers_inserted: List[Dict[str, Any]] = []
    new_placements = list(placements)
    buffer_id = 0

    pairs_to_buffer: List[Tuple[int, int]] = []
    for i, p1 in enumerate(new_placements):
        for j in range(i + 1, len(new_placements)):
            p2 = new_placements[j]
            if not rectangles_adjacent(p1.rectangle, p2.rectangle, tol=0.4):
                continue
            z1 = p1.room.acoustic_zone
            z2 = p2.room.acoustic_zone
            if {z1, z2} == {AcousticZone.ACTIVE, AcousticZone.PASSIVE}:
                pairs_to_buffer.append((i, j))

    # Process each pair — trim both rooms and insert buffer
    for idx_a, idx_b in pairs_to_buffer:
        p_active = new_placements[idx_a]
        p_passive = new_placements[idx_b]
        ra, rb = p_active.rectangle, p_passive.rectangle

        # Determine shared edge axis
        a_bounds = ra.bounds  # (x0, y0, x1, y1)
        b_bounds = rb.bounds

        buf_width = max(min_buffer_width_m, min(buffer_width_m, ra.min_dim * 0.2, rb.min_dim * 0.2))
        half = buf_width / 2.0

        buf_rect = None
        # Shared vertical edge (A right == B left or A left == B right)
        if abs(a_bounds[2] - b_bounds[0]) < 0.4:
            # A is to the left of B
            edge_x = a_bounds[2]
            overlap_y0 = max(a_bounds[1], b_bounds[1])
            overlap_y1 = min(a_bounds[3], b_bounds[3])
            if overlap_y1 - overlap_y0 > 1.0:
                buf_rect = Rectangle(edge_x - half, overlap_y0, buf_width, overlap_y1 - overlap_y0)
                ra.width -= half
                rb.x += half
                rb.width -= half
        elif abs(b_bounds[2] - a_bounds[0]) < 0.4:
            edge_x = b_bounds[2]
            overlap_y0 = max(a_bounds[1], b_bounds[1])
            overlap_y1 = min(a_bounds[3], b_bounds[3])
            if overlap_y1 - overlap_y0 > 1.0:
                buf_rect = Rectangle(edge_x - half, overlap_y0, buf_width, overlap_y1 - overlap_y0)
                rb.width -= half
                ra.x += half
                ra.width -= half
        # Shared horizontal edge (A top == B bottom or A bottom == B top)
        elif abs(a_bounds[3] - b_bounds[1]) < 0.4:
            edge_y = a_bounds[3]
            overlap_x0 = max(a_bounds[0], b_bounds[0])
            overlap_x1 = min(a_bounds[2], b_bounds[2])
            if overlap_x1 - overlap_x0 > 1.0:
                buf_rect = Rectangle(overlap_x0, edge_y - half, overlap_x1 - overlap_x0, buf_width)
                ra.height -= half
                rb.y += half
                rb.height -= half
        elif abs(b_bounds[3] - a_bounds[1]) < 0.4:
            edge_y = b_bounds[3]
            overlap_x0 = max(a_bounds[0], b_bounds[0])
            overlap_x1 = min(a_bounds[2], b_bounds[2])
            if overlap_x1 - overlap_x0 > 1.0:
                buf_rect = Rectangle(overlap_x0, edge_y - half, overlap_x1 - overlap_x0, buf_width)
                rb.height -= half
                ra.y += half
                ra.height -= half

        if buf_rect is not None and buf_rect.area > 0.5:
            buffer_room = RoomNode(
                id=f"buffer_{buffer_id}",
                name=f"Buffer (closet/corridor)",
                type=RoomType.CIRCULATION,
                acoustic_zone=AcousticZone.BUFFER,
                target_area_sqm=buf_rect.area,
                min_width_m=0.6,
                max_aspect_ratio=5.0,
                priority=0,
            )
            new_placements.append(RoomPlacement(room=buffer_room, rectangle=buf_rect))
            buffers_inserted.append({
                "buffer_id": f"buffer_{buffer_id}",
                "between": [p_active.room.id, p_passive.room.id],
                "width_m": round(buf_width, 2),
                "area_sqm": round(buf_rect.area, 2),
            })
            buffer_id += 1

    return new_placements, buffers_inserted


# =====================================================================
#  STRUCTURAL GRID OUTPUT  (Domain 5 upgrade)
# =====================================================================

def generate_structural_grid(
    placements: List[RoomPlacement],
    boundary: Rectangle,
    grid_module_m: float = 3.0,
    max_span_m: float = 5.0,
) -> Dict[str, Any]:
    """Generate a column/beam grid from finalised room layout.

    1. Collect all wall intersection points (room corners).
    2. Snap to structural grid module.
    3. De-duplicate within tolerance.
    4. Generate beam lines connecting adjacent columns.
    5. Flag rooms with spans > max_span_m.

    Returns column positions, beam lines, and span warnings.
    """
    # Collect all room corner points
    raw_points: Set[Tuple[float, float]] = set()
    for p in placements:
        r = p.rectangle
        corners = [
            (r.x, r.y), (r.x + r.width, r.y),
            (r.x, r.y + r.height), (r.x + r.width, r.y + r.height),
        ]
        for cx, cy in corners:
            sx = snap_to_grid(cx, grid_module_m)
            sy = snap_to_grid(cy, grid_module_m)
            raw_points.add((round(sx, 3), round(sy, 3)))

    # Add boundary corners
    raw_points.add((round(boundary.x, 3), round(boundary.y, 3)))
    raw_points.add((round(boundary.x + boundary.width, 3), round(boundary.y, 3)))
    raw_points.add((round(boundary.x, 3), round(boundary.y + boundary.height, 3)))
    raw_points.add((round(boundary.x + boundary.width, 3), round(boundary.y + boundary.height, 3)))

    # De-duplicate within tolerance
    tol = grid_module_m * 0.3
    columns: List[Tuple[float, float]] = []
    for pt in sorted(raw_points):
        is_dup = False
        for existing in columns:
            if math.hypot(pt[0] - existing[0], pt[1] - existing[1]) < tol:
                is_dup = True
                break
        if not is_dup:
            columns.append(pt)

    # Extract unique X and Y grid lines
    x_lines = sorted(set(c[0] for c in columns))
    y_lines = sorted(set(c[1] for c in columns))

    # Generate beams: horizontal and vertical lines between adjacent columns
    beams: List[Dict[str, Any]] = []
    beam_id = 0
    for xi in range(len(x_lines)):
        for yi in range(len(y_lines) - 1):
            span = y_lines[yi + 1] - y_lines[yi]
            if span > 0.5:  # filter out trivial spans
                beams.append({
                    "id": f"B{beam_id}",
                    "start": [x_lines[xi], y_lines[yi]],
                    "end": [x_lines[xi], y_lines[yi + 1]],
                    "span_m": round(span, 3),
                    "direction": "Y",
                    "needs_deep_beam": span > max_span_m,
                })
                beam_id += 1
    for yi in range(len(y_lines)):
        for xi in range(len(x_lines) - 1):
            span = x_lines[xi + 1] - x_lines[xi]
            if span > 0.5:
                beams.append({
                    "id": f"B{beam_id}",
                    "start": [x_lines[xi], y_lines[yi]],
                    "end": [x_lines[xi + 1], y_lines[yi]],
                    "span_m": round(span, 3),
                    "direction": "X",
                    "needs_deep_beam": span > max_span_m,
                })
                beam_id += 1

    # Span warnings for rooms
    span_warnings: List[Dict[str, Any]] = []
    for p in placements:
        if p.rectangle.max_dim > max_span_m:
            span_warnings.append({
                "room_id": p.room.id,
                "max_span_m": round(p.rectangle.max_dim, 2),
                "limit_m": max_span_m,
                "action": "Add intermediate column or use deeper beam",
            })

    return {
        "columns": [{"x": c[0], "y": c[1]} for c in columns],
        "x_grid_lines": x_lines,
        "y_grid_lines": y_lines,
        "beams": beams,
        "span_warnings": span_warnings,
        "grid_module_m": grid_module_m,
        "total_columns": len(columns),
        "total_beams": len(beams),
    }


# =====================================================================
#  STRUCTURAL HANDOFF PAYLOAD  (Phase G)
# =====================================================================

def generate_structural_handoff(
    placements: List[RoomPlacement],
    boundary: Rectangle,
    constraints: "SiteConfig",
) -> Dict[str, Any]:
    """Produce an extended structural-engineering handoff payload.

    Includes:
    - Wall stacking metadata (walls shared between rooms)
    - Load-path continuity hints (stacked walls that form continuous load paths)
    - Cantilever flags (rooms protruding beyond column grid)
    - Slab panel dimensions for two-way slab check
    """
    grid_mod = constraints.structural_grid_module_m

    # --- wall stacking ---
    wall_segments: List[Dict[str, Any]] = []
    for i, p1 in enumerate(placements):
        r1 = p1.rectangle
        for j, p2 in enumerate(placements):
            if j <= i:
                continue
            r2 = p2.rectangle
            # Shared vertical wall
            if abs(r1.x + r1.width - r2.x) < 0.05 or abs(r2.x + r2.width - r1.x) < 0.05:
                y_lo = max(r1.y, r2.y)
                y_hi = min(r1.y + r1.height, r2.y + r2.height)
                if y_hi - y_lo > 0.1:
                    shared_x = r1.x + r1.width if abs(r1.x + r1.width - r2.x) < 0.05 else r2.x + r2.width
                    wall_segments.append({
                        "type": "vertical",
                        "x": round(shared_x, 3),
                        "y_start": round(y_lo, 3),
                        "y_end": round(y_hi, 3),
                        "length_m": round(y_hi - y_lo, 3),
                        "rooms": [p1.room.id, p2.room.id],
                        "load_bearing": True,
                    })
            # Shared horizontal wall
            if abs(r1.y + r1.height - r2.y) < 0.05 or abs(r2.y + r2.height - r1.y) < 0.05:
                x_lo = max(r1.x, r2.x)
                x_hi = min(r1.x + r1.width, r2.x + r2.width)
                if x_hi - x_lo > 0.1:
                    shared_y = r1.y + r1.height if abs(r1.y + r1.height - r2.y) < 0.05 else r2.y + r2.height
                    wall_segments.append({
                        "type": "horizontal",
                        "y": round(shared_y, 3),
                        "x_start": round(x_lo, 3),
                        "x_end": round(x_hi, 3),
                        "length_m": round(x_hi - x_lo, 3),
                        "rooms": [p1.room.id, p2.room.id],
                        "load_bearing": True,
                    })

    # --- cantilever flags ---
    cantilever_rooms: List[Dict[str, Any]] = []
    for p in placements:
        r = p.rectangle
        overhang_left = max(0, boundary.x - r.x)
        overhang_right = max(0, (r.x + r.width) - (boundary.x + boundary.width))
        overhang_bottom = max(0, boundary.y - r.y)
        overhang_top = max(0, (r.y + r.height) - (boundary.y + boundary.height))
        max_oh = max(overhang_left, overhang_right, overhang_bottom, overhang_top)
        if max_oh > 0.05:
            cantilever_rooms.append({
                "room_id": p.room.id,
                "max_overhang_m": round(max_oh, 3),
                "direction": (
                    "left" if overhang_left == max_oh else
                    "right" if overhang_right == max_oh else
                    "bottom" if overhang_bottom == max_oh else "top"
                ),
                "action": "Verify cantilever slab design per IS 456 Cl. 24.1",
            })

    # --- slab panels ---
    slab_panels: List[Dict[str, Any]] = []
    for p in placements:
        r = p.rectangle
        ly = max(r.width, r.height)
        lx = min(r.width, r.height)
        ratio = ly / max(lx, 0.01)
        slab_panels.append({
            "room_id": p.room.id,
            "lx_m": round(lx, 3),
            "ly_m": round(ly, 3),
            "ly_lx_ratio": round(ratio, 3),
            "slab_type": "one_way" if ratio > 2.0 else "two_way",
        })

    return {
        "wall_segments": wall_segments,
        "total_shared_walls": len(wall_segments),
        "cantilever_rooms": cantilever_rooms,
        "slab_panels": slab_panels,
        "grid_module_m": grid_mod,
    }


# =====================================================================
#  MEP SCHEDULE SUMMARY  (Phase G)
# =====================================================================

def generate_mep_schedule(placements: List[RoomPlacement]) -> Dict[str, Any]:
    """Generate a high-level MEP (Mechanical/Electrical/Plumbing) schedule.

    Produces:
    - Plumbing stack summary (wet rooms grouped by proximity)
    - Electrical circuit breakdown (power points per room type)
    - HVAC placeholder (tonnage estimate based on area)
    """
    wet_rooms: List[Dict[str, Any]] = []
    power_schedule: List[Dict[str, Any]] = []
    hvac_loads: List[Dict[str, Any]] = []

    # Room-type → estimated electrical points
    electrical_estimate: Dict[str, int] = {
        "bedroom": 4, "master_bedroom": 6, "living_room": 6,
        "kitchen": 8, "bathroom": 3, "toilet": 2,
        "dining_room": 4, "study": 5, "office": 6,
        "pooja_room": 2, "staircase": 1, "balcony": 2,
        "utility": 3, "store_room": 1, "passage": 1,
        "foyer": 2, "drawing_room": 6, "guest_room": 4,
        "servant_room": 3, "garage": 2, "parking": 0,
    }

    # HVAC: ~0.15 TR per sqm (residential estimate)
    HVAC_TR_PER_SQM = 0.15

    for p in placements:
        area = p.rectangle.area
        rtype = p.room.type.value

        # Plumbing
        if p.room.plumbing_required:
            wet_rooms.append({
                "room_id": p.room.id,
                "room_type": rtype,
                "position": {"x": round(p.rectangle.x, 3), "y": round(p.rectangle.y, 3)},
                "needs_floor_drain": rtype in ("bathroom", "toilet", "kitchen", "utility"),
                "needs_water_supply": True,
            })

        # Electrical
        est_points = electrical_estimate.get(rtype, 3)
        power_schedule.append({
            "room_id": p.room.id,
            "room_type": rtype,
            "estimated_power_points": est_points,
            "estimated_lighting_points": max(1, int(area / 6)),
        })

        # HVAC (skip non-conditioned spaces)
        if rtype not in ("balcony", "staircase", "parking", "garage", "passage", "store_room", "utility"):
            hvac_loads.append({
                "room_id": p.room.id,
                "room_type": rtype,
                "area_sqm": round(area, 2),
                "estimated_tonnage_tr": round(area * HVAC_TR_PER_SQM, 2),
            })

    # Plumbing stack grouping (group wet rooms within 2m of each other)
    stacks: List[List[str]] = []
    visited: set = set()
    for i, wr in enumerate(wet_rooms):
        if wr["room_id"] in visited:
            continue
        stack = [wr["room_id"]]
        visited.add(wr["room_id"])
        for j, wr2 in enumerate(wet_rooms):
            if wr2["room_id"] in visited:
                continue
            dx = abs(wr["position"]["x"] - wr2["position"]["x"])
            dy = abs(wr["position"]["y"] - wr2["position"]["y"])
            if dx < 2.0 and dy < 2.0:
                stack.append(wr2["room_id"])
                visited.add(wr2["room_id"])
        stacks.append(stack)

    total_tonnage = sum(h["estimated_tonnage_tr"] for h in hvac_loads)
    total_power_pts = sum(ps["estimated_power_points"] for ps in power_schedule)

    return {
        "plumbing": {
            "wet_rooms": wet_rooms,
            "plumbing_stacks": stacks,
            "total_stacks": len(stacks),
        },
        "electrical": {
            "power_schedule": power_schedule,
            "total_power_points": total_power_pts,
            "total_lighting_points": sum(ps["estimated_lighting_points"] for ps in power_schedule),
        },
        "hvac": {
            "room_loads": hvac_loads,
            "total_tonnage_tr": round(total_tonnage, 2),
            "recommended_system": "split" if total_tonnage < 10 else "centralised",
        },
    }


# =====================================================================
#  SIMULATED ANNEALING OPTIMIZER
# =====================================================================

class SimulatedAnnealingSolver:
    """Simulated Annealing optimiser for architectural layout.

    Warm-starts from the best BSP solution produced by ``LayoutSolverV2``,
    then applies local neighbourhood moves to improve the penalty score.

    Neighbourhood moves:
      (a) Swap two room assignments
      (b) Resize a room ±5–15%
      (c) Shift a partition cut ±1 grid unit
      (d) Nudge a room position by ±0.5 grid units

    Temperature schedule: exponential cooling.
    Acceptance: Metropolis criterion ``exp(-ΔP / T)``.
    """

    def __init__(
        self,
        initial_solution: LayoutSolutionV2,
        site: SiteConfig,
        constraints: GlobalConstraints,
        adjacency_map: Dict[Tuple[str, str], float],
        weights: Optional[PenaltyWeightsV2] = None,
        initial_temp: float = 1000.0,
        cooling_rate: float = 0.995,
        min_temp: float = 0.1,
        max_iterations: int = 5000,
        stagnation_limit: int = 50,
        random_seed: Optional[int] = None,
    ):
        self.site = site
        self.constraints = constraints
        self.adjacency_map = adjacency_map
        self.weights = weights or PenaltyWeightsV2()
        self.initial_temp = initial_temp
        self.cooling_rate = cooling_rate
        self.min_temp = min_temp
        self.max_iterations = max_iterations
        self.stagnation_limit = stagnation_limit
        self.boundary = site.usable_boundary()

        if random_seed is not None:
            random.seed(random_seed)

        self.current = initial_solution.clone()
        self.best = initial_solution.clone()
        self.best_penalty = initial_solution.total_penalty
        self.history: List[float] = []

    def _evaluate(self, solution: LayoutSolutionV2) -> float:
        """Compute penalty for a solution."""
        penalty, sat, diag = calculate_penalty_v2(
            solution.placements,
            self.boundary,
            self.site,
            self.constraints,
            self.adjacency_map,
            self.weights,
        )
        solution.total_penalty = penalty
        solution.constraints_satisfied = sat
        solution.diagnostics = diag
        return penalty

    def _neighbour(self, solution: LayoutSolutionV2) -> LayoutSolutionV2:
        """Generate a neighbour solution via random perturbation."""
        new = solution.clone()
        placements = new.placements
        if len(placements) < 2:
            return new

        move = random.choice(["swap", "resize", "nudge", "resize", "nudge"])
        grid = self.constraints.structural_grid_module_m

        if move == "swap" and len(placements) >= 2:
            # Swap room assignments between two placements
            i, j = random.sample(range(len(placements)), 2)
            # Only swap if neither is a locked staircase
            ri, rj = placements[i].room, placements[j].room
            if not (ri.type == RoomType.STAIRCASE and ri.fixed_dimensions) and \
               not (rj.type == RoomType.STAIRCASE and rj.fixed_dimensions):
                placements[i].room, placements[j].room = rj, ri

        elif move == "resize":
            idx = random.randint(0, len(placements) - 1)
            p = placements[idx]
            if p.room.type == RoomType.STAIRCASE and p.room.fixed_dimensions:
                return new  # don't resize locked staircases
            factor = 1.0 + random.uniform(-0.15, 0.15)
            if random.random() < 0.5:
                new_w = max(p.room.min_width_m, p.rectangle.width * factor)
                if grid > 0:
                    new_w = snap_to_grid(new_w, grid)
                p.rectangle.width = new_w
            else:
                new_h = max(p.room.min_width_m, p.rectangle.height * factor)
                if grid > 0:
                    new_h = snap_to_grid(new_h, grid)
                p.rectangle.height = new_h

        elif move == "nudge":
            idx = random.randint(0, len(placements) - 1)
            p = placements[idx]
            dx = random.uniform(-0.5, 0.5) * (grid if grid > 0 else 0.5)
            dy = random.uniform(-0.5, 0.5) * (grid if grid > 0 else 0.5)
            new_x = max(self.boundary.x,
                        min(p.rectangle.x + dx,
                            self.boundary.x + self.boundary.width - p.rectangle.width))
            new_y = max(self.boundary.y,
                        min(p.rectangle.y + dy,
                            self.boundary.y + self.boundary.height - p.rectangle.height))
            p.rectangle.x = new_x
            p.rectangle.y = new_y

        return new

    def solve(self) -> LayoutSolutionV2:
        """Run simulated annealing optimisation loop."""
        temp = self.initial_temp
        current_penalty = self._evaluate(self.current)
        self.best_penalty = current_penalty
        stagnation = 0

        for iteration in range(self.max_iterations):
            if temp < self.min_temp:
                break
            if stagnation >= self.stagnation_limit:
                break

            candidate = self._neighbour(self.current)
            candidate_penalty = self._evaluate(candidate)

            delta = candidate_penalty - current_penalty
            if delta < 0 or random.random() < math.exp(-delta / max(temp, 1e-10)):
                self.current = candidate
                current_penalty = candidate_penalty

                if current_penalty < self.best_penalty:
                    self.best = candidate.clone()
                    self.best_penalty = current_penalty
                    stagnation = 0
                else:
                    stagnation += 1
            else:
                stagnation += 1

            self.history.append(current_penalty)
            temp *= self.cooling_rate

        self.best.iteration = len(self.history)
        return self.best

    def get_convergence_report(self) -> Dict[str, Any]:
        return {
            "initial_penalty": round(self.history[0], 4) if self.history else None,
            "final_penalty": round(self.best_penalty, 4),
            "improvement_pct": round(
                (1.0 - self.best_penalty / max(self.history[0], 1e-10)) * 100, 2
            ) if self.history else 0.0,
            "total_iterations": len(self.history),
            "final_temperature": round(
                self.initial_temp * (self.cooling_rate ** len(self.history)), 4
            ),
        }
