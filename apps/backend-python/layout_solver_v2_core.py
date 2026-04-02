from __future__ import annotations

import math
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Dict, List, Optional, Tuple

from shapely.geometry import Polygon as ShapelyPolygon, MultiPolygon, box as shapely_box
from shapely.validation import make_valid

try:
    from rules.compliance_schemas import (
        ACTIVE_KEYWORDS,
        PASSIVE_KEYWORDS,
        ROOM_ASPECT_LIMITS,
        ROOM_TYPE_TO_ACOUSTIC_ZONE,
        SERVICE_KEYWORDS,
    )
    from rules.layout_solver_defaults import (
        DEFAULT_EDGE_TOL_M,
        DEFAULT_FSI_LIMIT,
        DEFAULT_NUM_FLOORS,
        DEFAULT_RECT_ADJACENCY_TOL_M,
        DEFAULT_SETBACK_FRONT_M,
        DEFAULT_SETBACK_SIDE_M,
        DEFAULT_SITE_LATITUDE_DEG,
        DEFAULT_SITE_NORTH_ANGLE_DEG,
    )
except ImportError:
    # Fallback: Define minimal defaults if rules module not available
    ACTIVE_KEYWORDS = {}
    PASSIVE_KEYWORDS = {}
    ROOM_ASPECT_LIMITS = {}
    ROOM_TYPE_TO_ACOUSTIC_ZONE = {}
    SERVICE_KEYWORDS = {}
    DEFAULT_EDGE_TOL_M = 0.01
    DEFAULT_FSI_LIMIT = 2.0
    DEFAULT_NUM_FLOORS = 5
    DEFAULT_RECT_ADJACENCY_TOL_M = 0.1
    DEFAULT_SETBACK_FRONT_M = 3.0
    DEFAULT_SETBACK_SIDE_M = 2.0
    DEFAULT_SITE_LATITUDE_DEG = 28.0
    DEFAULT_SITE_NORTH_ANGLE_DEG = 0.0


class PartitionDirection(Enum):
    HORIZONTAL = "horizontal"
    VERTICAL = "vertical"


class RoomType(Enum):
    """Functional classification of a room node."""

    HABITABLE = "habitable"
    UTILITY = "utility"
    WET = "wet"
    CIRCULATION = "circulation"
    STAIRCASE = "staircase"


class AcousticZone(Enum):
    """Acoustic separation zones for residential layouts."""

    ACTIVE = "active"
    PASSIVE = "passive"
    SERVICE = "service"
    BUFFER = "buffer"


@dataclass
class Rectangle:
    """Axis-aligned bounding box in 2-D Cartesian space."""

    x: float
    y: float
    width: float
    height: float

    @property
    def area(self) -> float:
        return self.width * self.height

    @property
    def aspect_ratio(self) -> float:
        """Length / Width (always >= 1.0)."""
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
        return (self.x, self.y, self.x + self.width, self.y + self.height)

    def contains_point(self, px: float, py: float) -> bool:
        x0, y0, x1, y1 = self.bounds
        return x0 <= px <= x1 and y0 <= py <= y1

    def shares_edge_with(self, boundary: "Rectangle", tol: float = DEFAULT_EDGE_TOL_M) -> bool:
        """True when at least one edge coincides with boundary."""
        bx0, by0, bx1, by1 = boundary.bounds
        x0, y0, x1, y1 = self.bounds
        return (
            abs(x0 - bx0) < tol
            or abs(x1 - bx1) < tol
            or abs(y0 - by0) < tol
            or abs(y1 - by1) < tol
        )

    def exterior_facades(self, boundary: "Rectangle", tol: float = DEFAULT_EDGE_TOL_M) -> List[str]:
        """Return wall names that coincide with boundary: left/right/bottom/top."""
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

    def distance_to(self, other: "Rectangle") -> float:
        """Minimum edge-to-edge distance; 0 when touching/overlapping."""
        ax0, ay0, ax1, ay1 = self.bounds
        bx0, by0, bx1, by1 = other.bounds
        dx = max(0.0, max(ax0 - bx1, bx0 - ax1))
        dy = max(0.0, max(ay0 - by1, by0 - ay1))
        return math.hypot(dx, dy)


def snap_to_grid(value: float, grid: float) -> float:
    """Snap value to the nearest multiple of grid."""
    if grid <= 0:
        return value
    return round(value / grid) * grid


def rectangles_overlap(r1: Rectangle, r2: Rectangle, tol: float = 0.01) -> bool:
    a = r1.bounds
    b = r2.bounds
    return not (
        a[2] <= b[0] + tol
        or b[2] <= a[0] + tol
        or a[3] <= b[1] + tol
        or b[3] <= a[1] + tol
    )


def rectangles_adjacent(r1: Rectangle, r2: Rectangle, tol: float = DEFAULT_RECT_ADJACENCY_TOL_M) -> bool:
    """Two rectangles share a wall (with tolerance for floating-point drift)."""
    a = r1.bounds
    b = r2.bounds
    if abs(a[2] - b[0]) <= tol or abs(b[2] - a[0]) <= tol:
        if not (a[3] < b[1] or b[3] < a[1]):
            return True
    if abs(a[3] - b[1]) <= tol or abs(b[3] - a[1]) <= tol:
        if not (a[2] < b[0] or b[2] < a[0]):
            return True
    return False


@dataclass
class Setbacks:
    front: float = DEFAULT_SETBACK_FRONT_M
    rear: float = DEFAULT_SETBACK_SIDE_M
    left: float = DEFAULT_SETBACK_SIDE_M
    right: float = DEFAULT_SETBACK_SIDE_M


@dataclass
class SiteConfig:
    width: float
    height: float
    fsi_limit: float = DEFAULT_FSI_LIMIT
    setbacks: Setbacks = field(default_factory=Setbacks)
    north_angle_deg: float = DEFAULT_SITE_NORTH_ANGLE_DEG
    latitude_deg: float = DEFAULT_SITE_LATITUDE_DEG
    num_floors: int = DEFAULT_NUM_FLOORS
    polygon_vertices: Optional[List[Tuple[float, float]]] = None

    @property
    def is_polygon(self) -> bool:
        return self.polygon_vertices is not None and len(self.polygon_vertices) >= 3

    @property
    def plot_polygon(self) -> ShapelyPolygon:
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
        return self.plot_area * self.fsi_limit

    def usable_boundary(self) -> Rectangle:
        if self.is_polygon:
            return self._polygon_usable_boundary()
        x = self.setbacks.left
        y = self.setbacks.front
        w = self.width - self.setbacks.left - self.setbacks.right
        h = self.height - self.setbacks.front - self.setbacks.rear
        if w <= 0 or h <= 0:
            raise ValueError(
                f"Setbacks consume entire plot: usable width={w:.2f}m, height={h:.2f}m"
            )
        return Rectangle(x=x, y=y, width=w, height=h)

    def usable_polygon(self) -> ShapelyPolygon:
        if self.is_polygon:
            offset_dist = min(
                self.setbacks.front,
                self.setbacks.rear,
                self.setbacks.left,
                self.setbacks.right,
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
        poly = self.usable_polygon()
        minx, miny, maxx, maxy = poly.bounds
        return Rectangle(x=minx, y=miny, width=maxx - minx, height=maxy - miny)


def validate_fsi(total_room_area: float, site: SiteConfig, num_floors: int = 1) -> Dict[str, Any]:
    total_covered = total_room_area * num_floors
    fsi_actual = total_covered / site.plot_area if site.plot_area > 0 else float("inf")
    compliant = fsi_actual <= site.fsi_limit
    ub = site.usable_boundary()
    if ub.area > 0 and site.fsi_limit > 0:
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


def infer_acoustic_zone(room_id: str, room_type: RoomType) -> AcousticZone:
    rid = room_id.lower()
    if any(kw in rid for kw in ACTIVE_KEYWORDS):
        return AcousticZone.ACTIVE
    if any(kw in rid for kw in PASSIVE_KEYWORDS):
        return AcousticZone.PASSIVE
    if any(kw in rid for kw in SERVICE_KEYWORDS):
        return AcousticZone.SERVICE
    return ROOM_TYPE_TO_ACOUSTIC_ZONE.get(room_type, AcousticZone.PASSIVE)


@dataclass
class RoomNode:
    id: str
    name: str = ""
    type: RoomType = RoomType.HABITABLE
    acoustic_zone: Optional[AcousticZone] = None
    target_area_sqm: float = 12.0
    min_width_m: float = 2.8
    max_aspect_ratio: float = 1.5
    min_aspect_ratio: float = 1.0
    requires_exterior_wall: bool = False
    plumbing_required: bool = False
    priority: int = 1
    is_entry: bool = False
    num_doors: int = 1
    fixed_dimensions: Optional[Tuple[float, float]] = None

    def __post_init__(self) -> None:
        if not self.name:
            self.name = self.id

        if self.acoustic_zone is None:
            self.acoustic_zone = infer_acoustic_zone(self.id, self.type)

        min_width, min_ar, max_ar = ROOM_ASPECT_LIMITS.get(
            self.type,
            (0.0, self.min_aspect_ratio, self.max_aspect_ratio),
        )
        if min_width:
            self.min_width_m = max(self.min_width_m, min_width)
        self.min_aspect_ratio = max(self.min_aspect_ratio, min_ar)
        self.max_aspect_ratio = min(self.max_aspect_ratio, max_ar)
        if self.type == RoomType.WET:
            self.plumbing_required = True

    def __hash__(self) -> int:
        return hash(self.id)


@dataclass
class AdjacencyEdge:
    node_a: str
    node_b: str
    weight: float
