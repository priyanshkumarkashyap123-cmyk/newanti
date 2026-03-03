"""
Architectural Layout Solver - API Reference and Implementation Guide

This module provides a complete constraint satisfaction problem (CSP) solver
for architectural space planning using hierarchical binary space partitioning.

CORE CONCEPTS
=============

1. CONSTRAINT SATISFACTION PROBLEM (CSP)
   - Variables: Room positions and dimensions (rectangles)
   - Domains: All possible positions/sizes within site boundary
   - Constraints:
     * Hard: Target area, minimum width, aspect ratio bounds
     * Soft: Adjacency preferences, exterior wall requirements
   - Objective: Minimize total penalty score

2. BINARY SPACE PARTITION (BSP)
   - Recursively divides space with axis-aligned cuts
   - Each cut creates two subspaces for room assignment
   - Leads to efficient packing and valid non-overlapping layouts

3. PENALTY FUNCTION
   - Quantifies constraint violations
   - Weighted by importance (priority)
   - Iterative refinement seeks minimum penalty

USAGE EXAMPLES
==============

Basic Usage:

    from architectural_layout_solver import (
        RoomDefinition,
        ArchitecturalLayoutSolver,
        ConstraintPenalties,
    )

    # Define rooms
    rooms = [
        RoomDefinition(
            room_id="living_room",
            name="Living Room",
            target_area=60.0,
            min_width=7.0,
            max_aspect_ratio=2.5,
            min_aspect_ratio=1.0,
            requires_exterior_wall=True,
            priority=3,
        ),
        # ... more rooms
    ]

    # Define adjacency preferences
    adjacency = {
        ("living_room", "dining_room"): 2.0,  # Should be adjacent
        ("kitchen", "bedroom"): -1.0,  # Should be separate
    }

    # Create solver
    solver = ArchitecturalLayoutSolver(
        site_width=25.0,
        site_height=20.0,
        rooms=rooms,
        adjacency_matrix=adjacency,
        max_iterations=150,
    )

    # Solve
    solution = solver.solve()

    # Access results
    for placement in solution.placements:
        print(f"{placement.room.name}: {placement.rectangle.bounds}")

CONSTRAINT SPECIFICATION
========================

1. Area Constraints
   - target_area (float): Ideal area in square units
   - Penalty applied if deviation > 10%
   - Formula: |actual_area - target_area| / target_area
   - Weight: area_deviation * priority

2. Width Constraints
   - min_width (float): Minimum width allowed
   - Penalty: (shortfall)² * min_width_violation * priority
   - Critical for room usability

3. Aspect Ratio Constraints
   - max_aspect_ratio (float): Maximum width/height ratio
   - min_aspect_ratio (float): Minimum width/height ratio
   - Prevents extremely elongated or compact rooms
   - Penalty: aspect_ratio_violation * priority if violated

4. Exterior Wall Requirements
   - requires_exterior_wall (bool): Must border site edge
   - Common for: living rooms, bedrooms, kitchens
   - Penalty: exterior_wall_violation * priority if violated
   - Checked: room.shares_edge_with_boundary()

5. Adjacency Constraints
   - Positive value: rooms should be nearby
   - Negative value: rooms should be separate
   - Penalty based on distance between rooms
   - Formula (positive): distance * score * adjacency_violation
   - Formula (negative): |score| * adjacency_violation if adjacent

ALGORITHM EXPLANATION
====================

Phase 1: Initial Partitioning
  1. Start with full site as one rectangle
  2. Choose partition direction (more common along longer dimension)
  3. Calculate split ratio using room area distribution
  4. Recursively partition until 1 room per partition

Step-by-step for 3 rooms in 25×20 space:
  - Total area needed: ~100 sqm
  - Initial cut: vertical at x=12.5
    * Left partition: 12.5×20 = 250 sqm (for ~50 sqm of rooms)
    * Right partition: 12.5×20 = 250 sqm (for ~50 sqm of rooms)
  - Continue recursively...

Phase 2: Constraint Evaluation
  1. For each placement, calculate penalties:
     - Area deviation from target
     - Width violations
     - Aspect ratio violations
     - Exterior wall satisfaction
  2. Check room-room constraints:
     - Adjacency (distance-based)
     - Overlap detection
  3. Sum all penalties with weights

Phase 3: Iterative Refinement
  - Iteration 0: Base BSP partitioning
  - Iteration 1-N:
    * Shuffle room order (random but seeded)
    * Rebuild BSP with new order
    * Adjust rectangle dimensions toward targets
    * Calculate new penalty
    * Keep if lower than best

Phase 4: Fallback & Output
  - Return solution with lowest total penalty
  - Even if constraints not perfectly satisfied
  - Include penalty breakdown for diagnostics

MATHEMATICAL FORMALIZATION
===========================

Penalty Function P(s):

  P(s) = Σ P_area + Σ P_width + Σ P_aspect + Σ P_exterior + Σ P_adjacency + Σ P_overlap

Where:
  P_area = w_area * Σ_r [|A(r) - T(r)| / T(r)] * priority(r)  if deviation > 0.1
  P_width = w_width * Σ_r [(T_w(r) - W(r))²] * priority(r)  if W(r) < T_w(r)
  P_aspect = w_aspect * Σ_r [1] * priority(r)  if AR(r) out of bounds
  P_exterior = w_exterior * Σ_r [1] * priority(r)  if exterior(r) required and not satisfied
  P_adjacency = w_adj * Σ_pairs [dist(r1, r2) * score] if score > 0 and not adjacent
  P_overlap = w_overlap * Σ_pairs [1]  for each overlapping pair

Target: Minimize P(s) over all valid partitioning and placement configurations

ADVANCED USAGE
=============

Custom Penalty Weights:

    penalties = ConstraintPenalties(
        area_deviation=80.0,        # Lighter area tolerance
        min_width_violation=800.0,  # Strict width enforcement
        aspect_ratio_violation=40.0,
        adjacency_violation=20.0,   # More adjacency preference
        exterior_wall_violation=400.0,
        overlap_collision=2000.0,   # Critical overlap penalty
    )

    solver = ArchitecturalLayoutSolver(
        ...,
        penalties=penalties,
    )

Reproducibility with Seed:

    # Exact same solution every run
    solver = ArchitecturalLayoutSolver(
        ...,
        random_seed=12345,
    )

Multi-iteration Convergence:

    solver = ArchitecturalLayoutSolver(
        ...,
        max_iterations=500,  # More time for complex layouts
    )

    solution = solver.solve()
    
    # Access convergence history
    print(solver.iteration_history)  # List of penalty scores
    print(solution.iteration)  # Iteration where best solution found

INTERPRETING RESULTS
====================

Solution Object contains:
  - placements: List[RoomPlacement] - final room positions
  - total_penalty: float - overall constraint violation score
  - iteration: int - iteration where this was best
  - constraints_satisfied: Dict[str, bool] - per-constraint status

RoomPlacement contains:
  - room: RoomDefinition - original room spec
  - rectangle: Rectangle - final bounding box

Rectangle contains:
  - x, y: bottom-left corner coordinates
  - width, height: dimensions
  - bounds: (x_min, y_min, x_max, y_max) tuple
  - area: computed area
  - aspect_ratio: computed width/height
  - center: (x_center, y_center) tuple

Diagnostic Methods:

    # Get human-readable summary
    summary = solver.get_solution_summary()
    print(summary['constraints_met'])  # % of constraints satisfied
    
    for room in summary['rooms']:
        print(f"{room['name']}: {room['area_deviation_pct']:.1f}% deviation")

COMMON PATTERNS
===============

Pattern 1: Residential Layout (bedrooms need exterior walls)

    rooms = [
        RoomDefinition(..., requires_exterior_wall=True),  # Master
        RoomDefinition(..., requires_exterior_wall=True),  # Bedroom 2
        RoomDefinition(..., requires_exterior_wall=False),  # Kitchen
    ]

Pattern 2: Adjacency-driven Office Layout

    adjacency = {
        ("reception", "open_office"): 3.0,  # Very adjacent
        ("server_room", "open_office"): -2.0,  # Very separate
    }

Pattern 3: Priority-weighted Important Rooms

    rooms = [
        RoomDefinition(..., priority=4),  # Critical room
        RoomDefinition(..., priority=2),  # Normal room
        RoomDefinition(..., priority=1),  # Non-critical
    ]

PERFORMANCE CONSIDERATIONS
===========================

Time Complexity:
  - Per iteration: O(n log n) for partition tree building
  - Penalty calculation: O(n²) for adjacency + overlap checks
  - Total: O(iterations * n²)

Space Complexity:
  - O(n) for room list and placements
  - O(log n) call stack for recursive partitioning

Optimization Tips:
  1. Start with lower max_iterations for fast prototyping
  2. Use stricter penalties for more important constraints
  3. Set appropriate min_width to reduce invalid solutions
  4. Organize adjacency_matrix sparsely (only important pairs)
  5. Seed random for reproducibility during development

Scaling:
  - Tested: up to 20-30 rooms
  - Expected: linear degradation with more iterations needed
  - Recommended: max 150 iterations for <15 rooms, 300+ for >20

VALIDATION & TESTING
====================

Unit test included in layout_examples.py demonstrates:
  1. Residential villa (6 rooms, 500 sqm)
  2. Commercial office (8 rooms, 300 sqm)
  3. Reproducibility with seed

Run:
    python layout_examples.py

Expected output: Two layouts with penalty scores < 500 and
constraint satisfaction > 70%.

TROUBLESHOOTING
===============

Issue: High penalty scores (>1000)
  Solution: Relax constraints or increase max_iterations

Issue: Rooms overlap
  Solution: Increase overlap_collision penalty weight

Issue: Consistency needed
  Solution: Set random_seed to a fixed integer

Issue: Exterior wall violations
  Solution: Increase exterior_wall_violation weight
  Or reduce number of rooms requiring exterior walls

AUTHOR NOTES
============

This implementation prioritizes:
1. Mathematical correctness over micro-optimizations
2. Configurability for diverse architectural problems
3. Interpretability of results (per-constraint diagnostics)
4. Clean, maintainable code structure

The BSP approach is effective because:
- Non-overlapping guaranteed by recursive partitioning
- Aspect ratio control via partition direction selection
- Fast computation (no complex convex hull or Voronoi)
- Intuitive visualization as tree structure
"""

# This file is documentation only. See architectural_layout_solver.py for implementation.
