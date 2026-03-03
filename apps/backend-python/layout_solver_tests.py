"""
Comprehensive Test Suite for Architectural Layout Solver

Tests core functionality, constraint validation, and edge cases.
Run: python -m pytest layout_solver_tests.py -v
Or:  python layout_solver_tests.py
"""

import sys
from architectural_layout_solver import (
    Rectangle,
    RoomDefinition,
    RoomPlacement,
    LayoutSolution,
    PartitionDirection,
    ArchitecturalLayoutSolver,
    ConstraintPenalties,
    calculate_penalty,
    partition_space,
    rectangles_overlap,
    rectangles_adjacent,
)
from typing import List, Tuple, Dict


# ============================================
# GEOMETRY TESTS
# ============================================

def test_rectangle_area():
    """Test rectangle area calculation."""
    rect = Rectangle(x=0, y=0, width=10, height=5)
    assert rect.area == 50, f"Expected 50, got {rect.area}"
    print("✓ Rectangle area calculation")


def test_rectangle_aspect_ratio():
    """Test aspect ratio calculation."""
    rect = Rectangle(x=0, y=0, width=10, height=5)
    assert abs(rect.aspect_ratio - 2.0) < 0.01, f"Expected 2.0, got {rect.aspect_ratio}"
    print("✓ Rectangle aspect ratio calculation")


def test_rectangle_bounds():
    """Test bounds calculation."""
    rect = Rectangle(x=5, y=10, width=20, height=15)
    bounds = rect.bounds
    assert bounds == (5, 10, 25, 25), f"Expected (5, 10, 25, 25), got {bounds}"
    print("✓ Rectangle bounds calculation")


def test_rectangle_center():
    """Test center point calculation."""
    rect = Rectangle(x=0, y=0, width=10, height=10)
    center = rect.center
    assert center == (5, 5), f"Expected (5, 5), got {center}"
    print("✓ Rectangle center calculation")


def test_rectangles_overlap_true():
    """Test overlap detection - overlapping rectangles."""
    rect1 = Rectangle(x=0, y=0, width=10, height=10)
    rect2 = Rectangle(x=5, y=5, width=10, height=10)
    assert rectangles_overlap(rect1, rect2), "Should detect overlap"
    print("✓ Rectangles overlap detection (positive)")


def test_rectangles_overlap_false():
    """Test overlap detection - non-overlapping rectangles."""
    rect1 = Rectangle(x=0, y=0, width=10, height=10)
    rect2 = Rectangle(x=15, y=15, width=10, height=10)
    assert not rectangles_overlap(rect1, rect2), "Should not detect overlap"
    print("✓ Rectangles overlap detection (negative)")


def test_rectangles_adjacent_true():
    """Test adjacency detection - adjacent rectangles."""
    rect1 = Rectangle(x=0, y=0, width=10, height=10)
    rect2 = Rectangle(x=10, y=0, width=10, height=10)
    assert rectangles_adjacent(rect1, rect2), "Should detect adjacency"
    print("✓ Rectangles adjacency detection (positive)")


def test_rectangles_adjacent_false():
    """Test adjacency detection - non-adjacent rectangles."""
    rect1 = Rectangle(x=0, y=0, width=10, height=10)
    rect2 = Rectangle(x=15, y=0, width=10, height=10)
    assert not rectangles_adjacent(rect1, rect2), "Should not detect adjacency"
    print("✓ Rectangles adjacency detection (negative)")


def test_rectangle_shares_edge_with_boundary_true():
    """Test boundary edge detection - sharing edge."""
    site_width, site_height = 100, 100
    rect = Rectangle(x=0, y=20, width=20, height=20)  # Left edge at x=0
    assert rect.shares_edge_with_boundary(site_width, site_height), "Should detect boundary edge"
    print("✓ Rectangle boundary edge detection (positive)")


def test_rectangle_shares_edge_with_boundary_false():
    """Test boundary edge detection - not sharing edge."""
    site_width, site_height = 100, 100
    rect = Rectangle(x=20, y=20, width=20, height=20)  # Not at boundary
    assert not rect.shares_edge_with_boundary(site_width, site_height), "Should not detect boundary edge"
    print("✓ Rectangle boundary edge detection (negative)")


# ============================================
# PARTITIONING TESTS
# ============================================

def test_partition_space_vertical():
    """Test vertical space partitioning."""
    rect = Rectangle(x=0, y=0, width=100, height=50)
    left, right = partition_space(rect, PartitionDirection.VERTICAL, 0.5)
    
    assert left.width == 50, f"Expected left width 50, got {left.width}"
    assert right.width == 50, f"Expected right width 50, got {right.width}"
    assert left.height == 50, f"Expected height 50, got {left.height}"
    print("✓ Vertical space partitioning")


def test_partition_space_horizontal():
    """Test horizontal space partitioning."""
    rect = Rectangle(x=0, y=0, width=100, height=100)
    top, bottom = partition_space(rect, PartitionDirection.HORIZONTAL, 0.6)
    
    assert top.height == 60, f"Expected top height 60, got {top.height}"
    assert bottom.height == 40, f"Expected bottom height 40, got {bottom.height}"
    assert top.width == 100, f"Expected width 100, got {top.width}"
    print("✓ Horizontal space partitioning")


# ============================================
# CONSTRAINT TESTS
# ============================================

def test_room_placement_area_deviation():
    """Test area deviation calculation."""
    room = RoomDefinition(
        room_id="test",
        name="Test Room",
        target_area=100.0,
        min_width=5.0,
    )
    rect = Rectangle(x=0, y=0, width=10, height=12)  # area = 120
    placement = RoomPlacement(room=room, rectangle=rect)
    
    expected_deviation = (120 - 100) / 100  # = 0.2
    assert abs(placement.area_deviation - expected_deviation) < 0.01, \
        f"Expected {expected_deviation}, got {placement.area_deviation}"
    print("✓ Room placement area deviation")


def test_room_placement_width_valid():
    """Test width validity check."""
    room = RoomDefinition(
        room_id="test",
        name="Test Room",
        target_area=100.0,
        min_width=5.0,
    )
    rect = Rectangle(x=0, y=0, width=6, height=20)
    placement = RoomPlacement(room=room, rectangle=rect)
    
    assert placement.width_valid, "Should be width valid"
    print("✓ Room placement width validity (positive)")


def test_room_placement_width_invalid():
    """Test width invalidity check."""
    room = RoomDefinition(
        room_id="test",
        name="Test Room",
        target_area=100.0,
        min_width=5.0,
    )
    rect = Rectangle(x=0, y=0, width=3, height=20)  # width < min_width
    placement = RoomPlacement(room=room, rectangle=rect)
    
    assert not placement.width_valid, "Should be width invalid"
    print("✓ Room placement width validity (negative)")


def test_room_placement_aspect_ratio_valid():
    """Test aspect ratio validity check."""
    room = RoomDefinition(
        room_id="test",
        name="Test Room",
        target_area=100.0,
        min_width=5.0,
        max_aspect_ratio=3.0,
        min_aspect_ratio=0.5,
    )
    rect = Rectangle(x=0, y=0, width=10, height=5)  # AR = 2.0
    placement = RoomPlacement(room=room, rectangle=rect)
    
    assert placement.aspect_ratio_valid, "Should be aspect ratio valid"
    print("✓ Room placement aspect ratio validity (positive)")


def test_room_placement_aspect_ratio_invalid():
    """Test aspect ratio invalidity check."""
    room = RoomDefinition(
        room_id="test",
        name="Test Room",
        target_area=100.0,
        min_width=5.0,
        max_aspect_ratio=2.0,
        min_aspect_ratio=0.5,
    )
    rect = Rectangle(x=0, y=0, width=10, height=2)  # AR = 5.0 (too high)
    placement = RoomPlacement(room=room, rectangle=rect)
    
    assert not placement.aspect_ratio_valid, "Should be aspect ratio invalid"
    print("✓ Room placement aspect ratio validity (negative)")


# ============================================
# PENALTY CALCULATION TESTS
# ============================================

def test_penalty_calculation_area_violation():
    """Test penalty for area deviation."""
    room = RoomDefinition(
        room_id="test",
        name="Test Room",
        target_area=100.0,
        min_width=5.0,
        priority=1,
    )
    rect = Rectangle(x=0, y=0, width=10, height=20)  # area = 200 (100% deviation)
    placement = RoomPlacement(room=room, rectangle=rect)
    solution = LayoutSolution(placements=[placement])
    
    penalty = calculate_penalty(
        solution,
        site_width=50,
        site_height=50,
        adjacency_matrix={},
        penalties=ConstraintPenalties(),
    )
    
    assert penalty > 0, "Penalty should be > 0 for area violation"
    print("✓ Penalty calculation for area violation")


def test_penalty_calculation_width_violation():
    """Test penalty for width violation."""
    room = RoomDefinition(
        room_id="test",
        name="Test Room",
        target_area=100.0,
        min_width=10.0,
        priority=1,
    )
    rect = Rectangle(x=0, y=0, width=5, height=20)  # width < min_width
    placement = RoomPlacement(room=room, rectangle=rect)
    solution = LayoutSolution(placements=[placement])
    
    penalty = calculate_penalty(
        solution,
        site_width=50,
        site_height=50,
        adjacency_matrix={},
        penalties=ConstraintPenalties(),
    )
    
    assert penalty > 0, "Penalty should be > 0 for width violation"
    print("✓ Penalty calculation for width violation")


def test_penalty_calculation_overlap_violation():
    """Test penalty for overlapping rooms."""
    room1 = RoomDefinition(
        room_id="room1",
        name="Room 1",
        target_area=50.0,
        min_width=5.0,
        priority=1,
    )
    room2 = RoomDefinition(
        room_id="room2",
        name="Room 2",
        target_area=50.0,
        min_width=5.0,
        priority=1,
    )
    
    rect1 = Rectangle(x=0, y=0, width=10, height=10)
    rect2 = Rectangle(x=5, y=5, width=10, height=10)  # Overlaps with rect1
    
    placement1 = RoomPlacement(room=room1, rectangle=rect1)
    placement2 = RoomPlacement(room=room2, rectangle=rect2)
    solution = LayoutSolution(placements=[placement1, placement2])
    
    penalty = calculate_penalty(
        solution,
        site_width=50,
        site_height=50,
        adjacency_matrix={},
        penalties=ConstraintPenalties(),
    )
    
    assert penalty > 0, "Penalty should be > 0 for overlap"
    print("✓ Penalty calculation for room overlap")


def test_penalty_calculation_exterior_wall_violation():
    """Test penalty for missing exterior wall requirement."""
    room = RoomDefinition(
        room_id="test",
        name="Test Room",
        target_area=100.0,
        min_width=5.0,
        requires_exterior_wall=True,
        priority=1,
    )
    rect = Rectangle(x=20, y=20, width=10, height=10)  # Not at boundary
    placement = RoomPlacement(room=room, rectangle=rect)
    solution = LayoutSolution(placements=[placement])
    
    penalty = calculate_penalty(
        solution,
        site_width=50,
        site_height=50,
        adjacency_matrix={},
        penalties=ConstraintPenalties(),
    )
    
    assert penalty > 0, "Penalty should be > 0 for exterior wall violation"
    print("✓ Penalty calculation for exterior wall violation")


def test_penalty_calculation_no_violations():
    """Test penalty for perfect placement."""
    room = RoomDefinition(
        room_id="test",
        name="Test Room",
        target_area=100.0,
        min_width=5.0,
        max_aspect_ratio=3.0,
        min_aspect_ratio=0.5,
        requires_exterior_wall=False,
        priority=1,
    )
    rect = Rectangle(x=0, y=0, width=10, height=10)  # Perfect placement
    placement = RoomPlacement(room=room, rectangle=rect)
    solution = LayoutSolution(placements=[placement])
    
    penalty = calculate_penalty(
        solution,
        site_width=50,
        site_height=50,
        adjacency_matrix={},
        penalties=ConstraintPenalties(),
    )
    
    assert penalty < 10, f"Penalty should be minimal, got {penalty}"
    print("✓ Penalty calculation for perfect placement")


# ============================================
# SOLVER TESTS
# ============================================

def test_solver_initialization():
    """Test solver initialization."""
    rooms = [
        RoomDefinition(
            room_id="living",
            name="Living Room",
            target_area=50.0,
            min_width=5.0,
        ),
    ]
    
    solver = ArchitecturalLayoutSolver(
        site_width=25.0,
        site_height=20.0,
        rooms=rooms,
    )
    
    assert solver.site_width == 25.0, "Site width not set"
    assert solver.site_height == 20.0, "Site height not set"
    assert len(solver.rooms) == 1, "Rooms not set"
    print("✓ Solver initialization")


def test_solver_basic_layout():
    """Test solver produces valid layout."""
    rooms = [
        RoomDefinition(
            room_id="room1",
            name="Room 1",
            target_area=50.0,
            min_width=5.0,
            priority=2,
        ),
        RoomDefinition(
            room_id="room2",
            name="Room 2",
            target_area=50.0,
            min_width=5.0,
            priority=2,
        ),
    ]
    
    solver = ArchitecturalLayoutSolver(
        site_width=20.0,
        site_height=20.0,
        rooms=rooms,
        max_iterations=50,
        random_seed=42,
    )
    
    solution = solver.solve()
    
    assert solution is not None, "Solution should not be None"
    assert len(solution.placements) == 2, "Should have 2 placements"
    assert solution.total_penalty >= 0, "Penalty should be non-negative"
    print("✓ Solver produces valid layout")


def test_solver_no_overlaps():
    """Test that solver produces non-overlapping layout."""
    rooms = [
        RoomDefinition(
            room_id=f"room{i}",
            name=f"Room {i}",
            target_area=30.0,
            min_width=4.0,
            priority=1,
        )
        for i in range(4)
    ]
    
    solver = ArchitecturalLayoutSolver(
        site_width=25.0,
        site_height=20.0,
        rooms=rooms,
        max_iterations=100,
        random_seed=42,
    )
    
    solution = solver.solve()
    
    # Check for overlaps
    for i, p1 in enumerate(solution.placements):
        for p2 in solution.placements[i + 1:]:
            assert not rectangles_overlap(p1.rectangle, p2.rectangle), \
                f"Rooms {p1.room.name} and {p2.room.name} should not overlap"
    
    print("✓ Solver produces non-overlapping layout")


def test_solver_reproducibility():
    """Test that same seed produces same result."""
    rooms = [
        RoomDefinition(
            room_id="room1",
            name="Room 1",
            target_area=50.0,
            min_width=5.0,
        ),
        RoomDefinition(
            room_id="room2",
            name="Room 2",
            target_area=50.0,
            min_width=5.0,
        ),
    ]
    
    # First solution
    solver1 = ArchitecturalLayoutSolver(
        site_width=20.0,
        site_height=20.0,
        rooms=rooms,
        max_iterations=50,
        random_seed=999,
    )
    solution1 = solver1.solve()
    
    # Second solution with same seed
    solver2 = ArchitecturalLayoutSolver(
        site_width=20.0,
        site_height=20.0,
        rooms=rooms,
        max_iterations=50,
        random_seed=999,
    )
    solution2 = solver2.solve()
    
    # Compare penalties (should be identical)
    assert abs(solution1.total_penalty - solution2.total_penalty) < 0.01, \
        "Same seed should produce same penalty"
    
    print("✓ Solver reproducibility with seed")


def test_solver_convergence():
    """Test that penalty decreases over iterations."""
    rooms = [
        RoomDefinition(
            room_id=f"room{i}",
            name=f"Room {i}",
            target_area=30.0,
            min_width=4.0,
            priority=2,
        )
        for i in range(3)
    ]
    
    solver = ArchitecturalLayoutSolver(
        site_width=25.0,
        site_height=20.0,
        rooms=rooms,
        max_iterations=100,
        random_seed=42,
    )
    
    solution = solver.solve()
    
    # Penalty should generally decrease (allowing some variance)
    assert len(solver.iteration_history) > 0, "Should have iteration history"
    assert solver.iteration_history[0] > 0, "Initial penalty should be > 0"
    
    # Final penalty should be less than or equal to initial
    final_penalty = solver.iteration_history[-1]
    assert final_penalty <= solver.iteration_history[0] + 1, \
        "Final penalty should not be worse than initial"
    
    print("✓ Solver convergence over iterations")


# ============================================
# INTEGRATION TESTS
# ============================================

def test_integration_residential_villa():
    """Integration test: residential villa layout."""
    rooms = [
        RoomDefinition(
            room_id="living",
            name="Living Room",
            target_area=60.0,
            min_width=7.0,
            requires_exterior_wall=True,
            priority=3,
        ),
        RoomDefinition(
            room_id="master_bed",
            name="Master Bedroom",
            target_area=40.0,
            min_width=6.0,
            requires_exterior_wall=True,
            priority=3,
        ),
        RoomDefinition(
            room_id="kitchen",
            name="Kitchen",
            target_area=20.0,
            min_width=4.0,
            requires_exterior_wall=False,
            priority=2,
        ),
    ]
    
    adjacency = {
        ("living", "kitchen"): 2.0,
        ("master_bed", "kitchen"): -1.0,
    }
    
    solver = ArchitecturalLayoutSolver(
        site_width=25.0,
        site_height=20.0,
        rooms=rooms,
        adjacency_matrix=adjacency,
        max_iterations=100,
        random_seed=42,
    )
    
    solution = solver.solve()
    
    # Verify solution properties
    assert len(solution.placements) == 3, "Should have 3 rooms"
    assert solution.total_penalty < 1000, "Penalty should be reasonable"
    
    # Verify no overlaps
    for i, p1 in enumerate(solution.placements):
        for p2 in solution.placements[i + 1:]:
            assert not rectangles_overlap(p1.rectangle, p2.rectangle), \
                "Rooms should not overlap"
    
    # Verify exterior walls
    for placement in solution.placements:
        if placement.room.requires_exterior_wall:
            assert placement.rectangle.shares_edge_with_boundary(25.0, 20.0), \
                f"{placement.room.name} should border exterior"
    
    print("✓ Integration test: residential villa")


def test_solution_summary():
    """Test solution summary generation."""
    rooms = [
        RoomDefinition(
            room_id="test",
            name="Test Room",
            target_area=50.0,
            min_width=5.0,
        ),
    ]
    
    solver = ArchitecturalLayoutSolver(
        site_width=20.0,
        site_height=20.0,
        rooms=rooms,
        max_iterations=50,
        random_seed=42,
    )
    
    solution = solver.solve()
    summary = solver.get_solution_summary()
    
    assert "total_penalty" in summary, "Summary should have penalty"
    assert "rooms" in summary, "Summary should have rooms"
    assert len(summary["rooms"]) == 1, "Summary should list all rooms"
    assert "constraints_met" in summary, "Summary should have constraint satisfaction"
    
    print("✓ Solution summary generation")


# ============================================
# MAIN TEST RUNNER
# ============================================

def run_all_tests():
    """Run all tests and report results."""
    tests = [
        # Geometry tests
        test_rectangle_area,
        test_rectangle_aspect_ratio,
        test_rectangle_bounds,
        test_rectangle_center,
        test_rectangles_overlap_true,
        test_rectangles_overlap_false,
        test_rectangles_adjacent_true,
        test_rectangles_adjacent_false,
        test_rectangle_shares_edge_with_boundary_true,
        test_rectangle_shares_edge_with_boundary_false,
        # Partitioning tests
        test_partition_space_vertical,
        test_partition_space_horizontal,
        # Constraint tests
        test_room_placement_area_deviation,
        test_room_placement_width_valid,
        test_room_placement_width_invalid,
        test_room_placement_aspect_ratio_valid,
        test_room_placement_aspect_ratio_invalid,
        # Penalty tests
        test_penalty_calculation_area_violation,
        test_penalty_calculation_width_violation,
        test_penalty_calculation_overlap_violation,
        test_penalty_calculation_exterior_wall_violation,
        test_penalty_calculation_no_violations,
        # Solver tests
        test_solver_initialization,
        test_solver_basic_layout,
        test_solver_no_overlaps,
        test_solver_reproducibility,
        test_solver_convergence,
        # Integration tests
        test_integration_residential_villa,
        test_solution_summary,
    ]
    
    print("\n" + "=" * 70)
    print("  ARCHITECTURAL LAYOUT SOLVER - TEST SUITE")
    print("=" * 70 + "\n")
    
    passed = 0
    failed = 0
    
    for test in tests:
        try:
            test()
            passed += 1
        except AssertionError as e:
            print(f"✗ {test.__name__}")
            print(f"  Error: {e}")
            failed += 1
        except Exception as e:
            print(f"✗ {test.__name__}")
            print(f"  Exception: {e}")
            failed += 1
    
    print("\n" + "=" * 70)
    print(f"Results: {passed} passed, {failed} failed")
    print("=" * 70 + "\n")
    
    return failed == 0


if __name__ == "__main__":
    success = run_all_tests()
    sys.exit(0 if success else 1)
