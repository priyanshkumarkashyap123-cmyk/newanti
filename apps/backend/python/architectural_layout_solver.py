"""
Generative Architectural Layout Engine - Core CSP Solver

A constraint satisfaction problem (CSP) solver using hierarchical Binary Space Partition (BSP)
optimization to pack rooms into a site boundary while respecting spatial, dimensional, and
adjacency constraints.

Author: BeamLab Spatial Planning Engine
Version: 1.0
"""

from dataclasses import dataclass, field
from typing import List, Dict, Tuple, Optional, Set
from copy import deepcopy
import random
from enum import Enum


# ============================================
# DATA MODELS
# ============================================

class PartitionDirection(Enum):
    """Direction of spatial partition (horizontal or vertical cut)."""
    HORIZONTAL = "horizontal"
    VERTICAL = "vertical"


@dataclass
class Rectangle:
    """Represents a rectangular bounding box in 2D space."""
    x: float
    y: float
    width: float
    height: float

    @property
    def area(self) -> float:
        """Calculate rectangle area."""
        return self.width * self.height

    @property
    def aspect_ratio(self) -> float:
        """Calculate width to height ratio."""
        if self.height == 0:
            return float('inf')
        return self.width / self.height

    @property
    def center(self) -> Tuple[float, float]:
        """Return center coordinates."""
        return (self.x + self.width / 2, self.y + self.height / 2)

    @property
    def bounds(self) -> Tuple[float, float, float, float]:
        """Return (x_min, y_min, x_max, y_max)."""
        return (self.x, self.y, self.x + self.width, self.y + self.height)

    def contains_point(self, x: float, y: float) -> bool:
        """Check if point is inside rectangle."""
        x_min, y_min, x_max, y_max = self.bounds
        return x_min <= x <= x_max and y_min <= y <= y_max

    def shares_edge_with_boundary(self, site_width: float, site_height: float) -> bool:
        """Check if rectangle shares an edge with site boundary."""
        x_min, y_min, x_max, y_max = self.bounds
        return (x_min <= 0.01 or x_max >= site_width - 0.01 or
                y_min <= 0.01 or y_max >= site_height - 0.01)

    def distance_to(self, other: 'Rectangle') -> float:
        """Calculate minimum distance between two rectangles."""
        x1_min, y1_min, x1_max, y1_max = self.bounds
        x2_min, y2_min, x2_max, y2_max = other.bounds

        # Calculate closest points
        closest_x = max(x1_min, min(x1_max, x2_min)) if x1_max < x2_min else min(x2_max, max(x2_min, x1_min))
        closest_y = max(y1_min, min(y1_max, y2_min)) if y1_max < y2_min else min(y2_max, max(y2_min, y1_min))

        # Distance between closest points
        dx = abs(closest_x - max(x1_min, min(x1_max, x2_min)))
        dy = abs(closest_y - max(y1_min, min(y1_max, y2_min)))
        return (dx**2 + dy**2)**0.5


@dataclass
class RoomDefinition:
    """Defines constraints and requirements for a single room."""
    room_id: str
    name: str
    target_area: float  # Square units
    min_width: float  # Minimum width constraint
    max_aspect_ratio: float = 3.0  # Maximum width/height ratio
    min_aspect_ratio: float = 0.5  # Minimum width/height ratio
    requires_exterior_wall: bool = False
    priority: int = 1  # Higher = more important to satisfy

    def __hash__(self):
        return hash(self.room_id)


@dataclass
class RoomPlacement:
    """Represents a room's placement in the layout."""
    room: RoomDefinition
    rectangle: Rectangle

    @property
    def area_deviation(self) -> float:
        """Percentage deviation from target area (0-1)."""
        if self.room.target_area == 0:
            return 0
        return abs(self.rectangle.area - self.room.target_area) / self.room.target_area

    @property
    def width_valid(self) -> bool:
        """Check if width meets minimum requirement."""
        return self.rectangle.width >= self.room.min_width

    @property
    def aspect_ratio_valid(self) -> bool:
        """Check if aspect ratio is within bounds."""
        ar = self.rectangle.aspect_ratio
        return self.room.min_aspect_ratio <= ar <= self.room.max_aspect_ratio


@dataclass
class LayoutSolution:
    """Complete layout solution with all room placements."""
    placements: List[RoomPlacement] = field(default_factory=list)
    total_penalty: float = 0.0
    iteration: int = 0
    constraints_satisfied: Dict[str, bool] = field(default_factory=dict)

    @property
    def placement_map(self) -> Dict[str, RoomPlacement]:
        """Map of room_id to RoomPlacement for easy lookup."""
        return {p.room.room_id: p for p in self.placements}

    def clone(self) -> 'LayoutSolution':
        """Create deep copy of solution."""
        return deepcopy(self)


# ============================================
# PENALTY CALCULATION
# ============================================

@dataclass
class ConstraintPenalties:
    """Weights for different constraint violations."""
    area_deviation: float = 100.0  # Weight for target area mismatch
    min_width_violation: float = 500.0  # Heavy penalty for width violation
    aspect_ratio_violation: float = 50.0  # Weight for aspect ratio out of bounds
    adjacency_violation: float = 10.0  # Weight for adjacency constraint violation
    exterior_wall_violation: float = 300.0  # Heavy penalty for missing exterior wall
    overlap_collision: float = 1000.0  # Critical penalty for room overlap


def calculate_penalty(
    solution: LayoutSolution,
    site_width: float,
    site_height: float,
    adjacency_matrix: Dict[Tuple[str, str], float],
    penalties: ConstraintPenalties,
) -> float:
    """
    Calculate total penalty score for a layout solution.

    Penalty components:
    1. Area deviation: Penalize if actual area deviates >10% from target
    2. Width violations: Penalize rooms narrower than min_width
    3. Aspect ratio violations: Penalize rooms outside aspect ratio bounds
    4. Adjacency violations: Penalize non-adjacent rooms that should be adjacent
    5. Exterior wall: Penalize rooms requiring exterior wall that don't have it
    6. Overlaps: Critical penalty for room overlaps

    Args:
        solution: Current layout solution
        site_width: Site boundary width
        site_height: Site boundary height
        adjacency_matrix: Dict[(room_id1, room_id2)] = proximity_score (-inf to +inf)
        penalties: Constraint penalty weights

    Returns:
        Total penalty score (lower is better)
    """
    total_penalty = 0.0
    constraints_satisfied = {}

    # Check area deviations
    for placement in solution.placements:
        if placement.area_deviation > 0.1:  # >10% deviation
            penalty = placement.area_deviation * penalties.area_deviation * placement.room.priority
            total_penalty += penalty
            constraints_satisfied[f"{placement.room.room_id}_area"] = False
        else:
            constraints_satisfied[f"{placement.room.room_id}_area"] = True

        # Check minimum width
        if not placement.width_valid:
            shortfall = placement.room.min_width - placement.rectangle.width
            penalty = (shortfall ** 2) * penalties.min_width_violation * placement.room.priority
            total_penalty += penalty
            constraints_satisfied[f"{placement.room.room_id}_width"] = False
        else:
            constraints_satisfied[f"{placement.room.room_id}_width"] = True

        # Check aspect ratio
        if not placement.aspect_ratio_valid:
            penalty = penalties.aspect_ratio_violation * placement.room.priority
            total_penalty += penalty
            constraints_satisfied[f"{placement.room.room_id}_aspect"] = False
        else:
            constraints_satisfied[f"{placement.room.room_id}_aspect"] = True

        # Check exterior wall requirement
        if placement.room.requires_exterior_wall:
            if not placement.rectangle.shares_edge_with_boundary(site_width, site_height):
                penalty = penalties.exterior_wall_violation * placement.room.priority
                total_penalty += penalty
                constraints_satisfied[f"{placement.room.room_id}_exterior"] = False
            else:
                constraints_satisfied[f"{placement.room.room_id}_exterior"] = True

    # Check for overlaps
    for i, p1 in enumerate(solution.placements):
        for p2 in solution.placements[i + 1:]:
            if rectangles_overlap(p1.rectangle, p2.rectangle):
                penalty = penalties.overlap_collision
                total_penalty += penalty

    # Check adjacency constraints
    placement_map = solution.placement_map
    for (room_id1, room_id2), adjacency_score in adjacency_matrix.items():
        if room_id1 not in placement_map or room_id2 not in placement_map:
            continue

        p1 = placement_map[room_id1]
        p2 = placement_map[room_id2]

        # For positive scores: penalize if not adjacent
        # For negative scores: penalize if adjacent
        are_adjacent = rectangles_adjacent(p1.rectangle, p2.rectangle)

        if adjacency_score > 0 and not are_adjacent:
            # Should be adjacent but aren't
            distance = p1.rectangle.distance_to(p2.rectangle)
            penalty = distance * adjacency_score * penalties.adjacency_violation
            total_penalty += penalty
        elif adjacency_score < 0 and are_adjacent:
            # Should NOT be adjacent but are
            penalty = abs(adjacency_score) * penalties.adjacency_violation
            total_penalty += penalty

    solution.constraints_satisfied = constraints_satisfied
    return total_penalty


def rectangles_overlap(rect1: Rectangle, rect2: Rectangle) -> bool:
    """Check if two rectangles overlap (intersect)."""
    x1_min, y1_min, x1_max, y1_max = rect1.bounds
    x2_min, y2_min, x2_max, y2_max = rect2.bounds

    return not (x1_max < x2_min or x2_max < x1_min or
                y1_max < y2_min or y2_max < y1_min)


def rectangles_adjacent(rect1: Rectangle, rect2: Rectangle, tolerance: float = 0.5) -> bool:
    """Check if two rectangles share an edge or corner."""
    x1_min, y1_min, x1_max, y1_max = rect1.bounds
    x2_min, y2_min, x2_max, y2_max = rect2.bounds

    # Check for shared vertical edge (adjacent left-right)
    if abs(x1_max - x2_min) <= tolerance or abs(x2_max - x1_min) <= tolerance:
        # Check if edges overlap on y-axis
        if not (y1_max < y2_min or y2_max < y1_min):
            return True

    # Check for shared horizontal edge (adjacent top-bottom)
    if abs(y1_max - y2_min) <= tolerance or abs(y2_max - y1_min) <= tolerance:
        # Check if edges overlap on x-axis
        if not (x1_max < x2_min or x2_max < x1_min):
            return True

    return False


# ============================================
# SPATIAL PARTITIONING (BSP)
# ============================================

@dataclass
class PartitionNode:
    """Node in binary space partition tree."""
    rectangle: Rectangle
    left: Optional['PartitionNode'] = None
    right: Optional['PartitionNode'] = None
    split_direction: Optional[PartitionDirection] = None
    split_position: Optional[float] = None
    assigned_room: Optional[RoomDefinition] = None  # For leaf nodes

    def is_leaf(self) -> bool:
        """Check if this is a leaf node."""
        return self.left is None and self.right is None

    def get_leaves(self) -> List['PartitionNode']:
        """Get all leaf nodes in subtree."""
        if self.is_leaf():
            return [self]
        leaves = []
        if self.left:
            leaves.extend(self.left.get_leaves())
        if self.right:
            leaves.extend(self.right.get_leaves())
        return leaves


def partition_space(
    rectangle: Rectangle,
    direction: PartitionDirection,
    ratio: float,
) -> Tuple[Rectangle, Rectangle]:
    """
    Partition a rectangle into two sub-rectangles.

    Args:
        rectangle: Rectangle to partition
        direction: HORIZONTAL or VERTICAL cut
        ratio: Position of cut as ratio of dimension (0-1)

    Returns:
        Tuple of (left/top rectangle, right/bottom rectangle)
    """
    if direction == PartitionDirection.VERTICAL:
        split_x = rectangle.x + rectangle.width * ratio
        left = Rectangle(
            x=rectangle.x,
            y=rectangle.y,
            width=split_x - rectangle.x,
            height=rectangle.height,
        )
        right = Rectangle(
            x=split_x,
            y=rectangle.y,
            width=rectangle.x + rectangle.width - split_x,
            height=rectangle.height,
        )
        return left, right
    else:  # HORIZONTAL
        split_y = rectangle.y + rectangle.height * ratio
        top = Rectangle(
            x=rectangle.x,
            y=rectangle.y,
            width=rectangle.width,
            height=split_y - rectangle.y,
        )
        bottom = Rectangle(
            x=rectangle.x,
            y=split_y,
            width=rectangle.width,
            height=rectangle.y + rectangle.height - split_y,
        )
        return top, bottom


def build_partition_tree(
    rectangle: Rectangle,
    rooms: List[RoomDefinition],
    max_depth: int = 10,
    depth: int = 0,
) -> PartitionNode:
    """
    Recursively build a binary space partition tree for room layout.

    Uses an area-balanced strategy: partition so that each side gets
    approximately equal amount of target area (not just count).

    Args:
        rectangle: The space to partition
        rooms: Rooms to assign to partitions
        max_depth: Maximum recursion depth
        depth: Current recursion depth

    Returns:
        Root PartitionNode of the tree
    """
    node = PartitionNode(rectangle=rectangle)

    # Base case: single room or max depth
    if len(rooms) <= 1 or depth >= max_depth:
        if len(rooms) == 1:
            node.assigned_room = rooms[0]
        return node

    # Choose partition direction based on rectangle aspect ratio
    # Prefer to partition along the longer dimension
    if rectangle.aspect_ratio > 1:
        direction = PartitionDirection.VERTICAL
    else:
        direction = PartitionDirection.HORIZONTAL

    # Sort rooms by target area (descending) for better packing
    sorted_rooms = sorted(rooms, key=lambda r: r.target_area, reverse=True)

    # Calculate partition ratio using area-balanced approach
    # For best fit, each partition should get space proportional to room areas
    total_area = sum(r.target_area for r in rooms)
    
    # Use a greedy approach: accumulate rooms until area is ~half
    cumulative_area = 0
    split_index = 0
    target_half_area = total_area / 2
    
    for i, room in enumerate(sorted_rooms):
        cumulative_area += room.target_area
        split_index = i + 1
        if cumulative_area >= target_half_area:
            break
    
    # Ensure at least 1 room per side
    split_index = max(1, min(split_index, len(sorted_rooms) - 1))
    
    # Calculate actual ratio
    left_area = sum(r.target_area for r in sorted_rooms[:split_index])
    if total_area > 0:
        ratio = left_area / total_area
    else:
        ratio = 0.5
    
    # Clamp ratio to avoid degenerate partitions (keep some margin)
    ratio = max(0.25, min(0.75, ratio))

    # Partition space
    left_rect, right_rect = partition_space(rectangle, direction, ratio)

    # Recursively build subtrees
    node.left = build_partition_tree(left_rect, sorted_rooms[:split_index], max_depth, depth + 1)
    node.right = build_partition_tree(right_rect, sorted_rooms[split_index:], max_depth, depth + 1)
    node.split_direction = direction
    node.split_position = ratio

    return node


def node_tree_to_placements(node: PartitionNode) -> List[RoomPlacement]:
    """Extract room placements from partition tree leaves."""
    placements = []
    for leaf in node.get_leaves():
        if leaf.assigned_room:
            placement = RoomPlacement(
                room=leaf.assigned_room,
                rectangle=leaf.rectangle,
            )
            placements.append(placement)
    return placements


# ============================================
# MAIN SOLVER
# ============================================

class ArchitecturalLayoutSolver:
    """
    Core constraint satisfaction problem solver for architectural layouts.

    Uses hierarchical binary space partitioning with iterative refinement
    to pack rooms into a site while respecting spatial constraints.
    """

    def __init__(
        self,
        site_width: float,
        site_height: float,
        rooms: List[RoomDefinition],
        adjacency_matrix: Optional[Dict[Tuple[str, str], float]] = None,
        penalties: Optional[ConstraintPenalties] = None,
        max_iterations: int = 100,
        random_seed: Optional[int] = None,
    ):
        """
        Initialize the layout solver.

        Args:
            site_width: Width of the site boundary
            site_height: Height of the site boundary
            rooms: List of room definitions
            adjacency_matrix: Dict[(id1, id2)] = proximity_score
            penalties: Constraint penalty weights
            max_iterations: Maximum optimization iterations
            random_seed: Seed for reproducibility
        """
        self.site_width = site_width
        self.site_height = site_height
        self.rooms = rooms
        self.adjacency_matrix = adjacency_matrix or {}
        self.penalties = penalties or ConstraintPenalties()
        self.max_iterations = max_iterations
        self.random_seed = random_seed

        if random_seed is not None:
            random.seed(random_seed)

        self.best_solution: Optional[LayoutSolution] = None
        self.iteration_history: List[float] = []

    def solve(self) -> LayoutSolution:
        """
        Solve the layout problem using iterative BSP refinement.

        Returns:
            Best LayoutSolution found (with lowest penalty score)
        """
        self.best_solution = None
        self.iteration_history = []

        for iteration in range(self.max_iterations):
            # Generate solution using BSP partitioning
            solution = self._generate_solution(iteration)
            solution.iteration = iteration

            # Calculate penalty
            penalty = calculate_penalty(
                solution,
                self.site_width,
                self.site_height,
                self.adjacency_matrix,
                self.penalties,
            )
            solution.total_penalty = penalty
            self.iteration_history.append(penalty)

            # Update best solution
            if self.best_solution is None or penalty < self.best_solution.total_penalty:
                self.best_solution = solution

            # Early exit if penalty is near-zero (all constraints satisfied)
            if penalty < 1.0:
                print(f"✓ Converged at iteration {iteration} (penalty: {penalty:.2f})")
                break

        return self.best_solution or LayoutSolution()

    def _generate_solution(self, iteration: int) -> LayoutSolution:
        """
        Generate a single candidate solution.

        Uses BSP tree with randomized variations for exploration.
        """
        # Randomize room order for exploration
        rooms = list(self.rooms)
        if iteration > 0:
            random.shuffle(rooms)

        # Build partition tree
        site_rect = Rectangle(x=0, y=0, width=self.site_width, height=self.site_height)
        root = build_partition_tree(site_rect, rooms, max_depth=8)

        # Extract placements
        placements = node_tree_to_placements(root)

        # Attempt to adjust rectangles to better fit constraints
        self._adjust_placements(placements, iteration)

        solution = LayoutSolution(placements=placements)
        return solution

    def _adjust_placements(self, placements: List[RoomPlacement], iteration: int) -> None:
        """
        Adjust room rectangles to better satisfy constraints.

        Iteratively refines dimensions to approach target areas and handle
        aspect ratio violations while maintaining min_width requirements.
        """
        # More aggressive adjustment in later iterations
        num_passes = 5 + iteration // 20
        
        for pass_num in range(num_passes):
            for placement in placements:
                room = placement.room
                rect = placement.rectangle
                blend_factor = 0.4 if pass_num < 3 else 0.2  # Aggressive then fine-tune

                # Strategy 1: Adjust height to approach target area
                if rect.width > room.min_width:
                    target_area = room.target_area
                    target_height = target_area / rect.width if rect.width > 0 else rect.height
                    
                    # Ensure height respects aspect ratio bounds
                    min_height_from_ar = rect.width / room.max_aspect_ratio
                    max_height_from_ar = rect.width / room.min_aspect_ratio
                    
                    target_height = max(
                        min_height_from_ar,
                        min(target_height, max_height_from_ar)
                    )
                    
                    # Blend adjustment
                    new_height = rect.height * (1 - blend_factor) + target_height * blend_factor
                    
                    # Ensure minimum area constraint from width
                    min_height = room.target_area / room.max_aspect_ratio
                    new_height = max(new_height, min_height)
                    
                    placement.rectangle.height = new_height

                # Strategy 2: If width is too small, prioritize meeting min_width
                if rect.width < room.min_width:
                    # Adjust width to min_width, then height to maintain area
                    new_width = rect.width + (room.min_width - rect.width) * blend_factor
                    new_height = room.target_area / new_width if new_width > 0 else rect.height
                    
                    placement.rectangle.width = new_width
                    placement.rectangle.height = new_height

    def get_solution_summary(self) -> Dict:
        """Get human-readable summary of best solution."""
        if not self.best_solution:
            return {}

        summary = {
            "total_penalty": self.best_solution.total_penalty,
            "iterations_to_best": self.best_solution.iteration,
            "total_iterations": len(self.iteration_history),
            "rooms": [],
            "constraints_met": sum(
                1 for v in self.best_solution.constraints_satisfied.values() if v
            ) / max(1, len(self.best_solution.constraints_satisfied)),
        }

        for placement in self.best_solution.placements:
            room_summary = {
                "id": placement.room.room_id,
                "name": placement.room.name,
                "target_area": placement.room.target_area,
                "actual_area": placement.rectangle.area,
                "area_deviation_pct": placement.area_deviation * 100,
                "position": (placement.rectangle.x, placement.rectangle.y),
                "dimensions": (placement.rectangle.width, placement.rectangle.height),
                "aspect_ratio": placement.rectangle.aspect_ratio,
                "width_valid": placement.width_valid,
                "aspect_ratio_valid": placement.aspect_ratio_valid,
            }
            summary["rooms"].append(room_summary)

        return summary
