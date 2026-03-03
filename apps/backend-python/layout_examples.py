"""
Example Usage and Test Cases for Architectural Layout Solver

Demonstrates the CSP solver with realistic residential and commercial layouts.
"""

from architectural_layout_solver import (
    RoomDefinition,
    ArchitecturalLayoutSolver,
    ConstraintPenalties,
)
from typing import Dict, Tuple


# ============================================
# EXAMPLE 1: RESIDENTIAL VILLA (500 sqm plot)
# ============================================

def create_residential_villa_example() -> Tuple[ArchitecturalLayoutSolver, Dict]:
    """
    Example: 500 sqm residential villa with 6 rooms.

    Plot: 25m x 20m (500 sqm)

    Rooms:
    - Living Room: 60 sqm (main focal point)
    - Master Bedroom: 40 sqm (corner, requires exterior wall)
    - Bedroom 2: 30 sqm (requires exterior wall)
    - Kitchen: 20 sqm (central, needs good adjacency to living room)
    - Bathrooms: 12 sqm (2 units @ 6 sqm each)
    - Dining Room: 25 sqm (adjacent to kitchen)
    """

    site_width = 25.0
    site_height = 20.0

    rooms = [
        RoomDefinition(
            room_id="living_room",
            name="Living Room",
            target_area=60.0,
            min_width=7.0,
            max_aspect_ratio=2.5,
            min_aspect_ratio=1.0,
            requires_exterior_wall=True,
            priority=3,  # High priority
        ),
        RoomDefinition(
            room_id="master_bedroom",
            name="Master Bedroom",
            target_area=40.0,
            min_width=6.0,
            max_aspect_ratio=2.0,
            min_aspect_ratio=1.0,
            requires_exterior_wall=True,
            priority=3,
        ),
        RoomDefinition(
            room_id="bedroom_2",
            name="Bedroom 2",
            target_area=30.0,
            min_width=5.0,
            max_aspect_ratio=2.0,
            min_aspect_ratio=1.0,
            requires_exterior_wall=True,
            priority=2,
        ),
        RoomDefinition(
            room_id="kitchen",
            name="Kitchen",
            target_area=20.0,
            min_width=4.0,
            max_aspect_ratio=2.5,
            min_aspect_ratio=0.8,
            requires_exterior_wall=False,
            priority=2,
        ),
        RoomDefinition(
            room_id="dining_room",
            name="Dining Room",
            target_area=25.0,
            min_width=5.0,
            max_aspect_ratio=2.5,
            min_aspect_ratio=1.0,
            requires_exterior_wall=False,
            priority=2,
        ),
        RoomDefinition(
            room_id="bathroom",
            name="Bathroom",
            target_area=12.0,
            min_width=2.5,
            max_aspect_ratio=3.0,
            min_aspect_ratio=0.7,
            requires_exterior_wall=False,
            priority=1,
        ),
    ]

    # Adjacency matrix: positive = should be near, negative = should be far
    adjacency_matrix: Dict[Tuple[str, str], float] = {
        ("living_room", "dining_room"): 2.0,  # Should be adjacent
        ("dining_room", "kitchen"): 3.0,  # Should be very adjacent
        ("living_room", "kitchen"): 1.5,  # Preferably adjacent
        ("master_bedroom", "bathroom"): 2.0,  # Bedroom near bathroom
        ("master_bedroom", "living_room"): -1.0,  # Should be separate
        ("kitchen", "bedroom_2"): -1.0,  # Keep separate
    }

    solver = ArchitecturalLayoutSolver(
        site_width=site_width,
        site_height=site_height,
        rooms=rooms,
        adjacency_matrix=adjacency_matrix,
        penalties=ConstraintPenalties(
            area_deviation=100.0,
            min_width_violation=500.0,
            aspect_ratio_violation=50.0,
            adjacency_violation=10.0,
            exterior_wall_violation=300.0,
            overlap_collision=1000.0,
        ),
        max_iterations=150,
        random_seed=42,
    )

    metadata = {
        "name": "Residential Villa",
        "description": "500 sqm plot with 6 rooms (bedrooms, living, dining, kitchen, bath)",
        "plot_area": site_width * site_height,
        "total_room_area": sum(r.target_area for r in rooms),
    }

    return solver, metadata


# ============================================
# EXAMPLE 2: SMALL COMMERCIAL OFFICE (300 sqm)
# ============================================

def create_commercial_office_example() -> Tuple[ArchitecturalLayoutSolver, Dict]:
    """
    Example: 300 sqm commercial office space.

    Plot: 20m x 15m (300 sqm)

    Rooms:
    - Open Office Space: 120 sqm (main work area)
    - Meeting Room: 30 sqm (requires exterior window for natural light)
    - Manager Office: 25 sqm (private, corner preferred)
    - Reception: 20 sqm (entry point, exterior wall required)
    - Server Room: 15 sqm (interior, away from main traffic)
    - Bathrooms: 10 sqm (central location)
    - Break Room: 20 sqm (central)
    - Stairwell: 20 sqm (perimeter)
    """

    site_width = 20.0
    site_height = 15.0

    rooms = [
        RoomDefinition(
            room_id="open_office",
            name="Open Office",
            target_area=120.0,
            min_width=10.0,
            max_aspect_ratio=2.0,
            min_aspect_ratio=1.0,
            requires_exterior_wall=True,
            priority=4,
        ),
        RoomDefinition(
            room_id="meeting_room",
            name="Meeting Room",
            target_area=30.0,
            min_width=5.0,
            max_aspect_ratio=2.0,
            min_aspect_ratio=1.0,
            requires_exterior_wall=True,
            priority=3,
        ),
        RoomDefinition(
            room_id="manager_office",
            name="Manager Office",
            target_area=25.0,
            min_width=5.0,
            max_aspect_ratio=2.0,
            min_aspect_ratio=1.0,
            requires_exterior_wall=False,
            priority=2,
        ),
        RoomDefinition(
            room_id="reception",
            name="Reception",
            target_area=20.0,
            min_width=4.0,
            max_aspect_ratio=2.5,
            min_aspect_ratio=0.8,
            requires_exterior_wall=True,
            priority=3,
        ),
        RoomDefinition(
            room_id="server_room",
            name="Server Room",
            target_area=15.0,
            min_width=3.0,
            max_aspect_ratio=2.0,
            min_aspect_ratio=0.8,
            requires_exterior_wall=False,
            priority=1,
        ),
        RoomDefinition(
            room_id="bathrooms",
            name="Bathrooms",
            target_area=10.0,
            min_width=2.5,
            max_aspect_ratio=2.5,
            min_aspect_ratio=0.7,
            requires_exterior_wall=False,
            priority=2,
        ),
        RoomDefinition(
            room_id="break_room",
            name="Break Room",
            target_area=20.0,
            min_width=4.0,
            max_aspect_ratio=2.5,
            min_aspect_ratio=1.0,
            requires_exterior_wall=False,
            priority=1,
        ),
        RoomDefinition(
            room_id="stairwell",
            name="Stairwell",
            target_area=20.0,
            min_width=3.5,
            max_aspect_ratio=2.0,
            min_aspect_ratio=0.9,
            requires_exterior_wall=True,
            priority=2,
        ),
    ]

    adjacency_matrix: Dict[Tuple[str, str], float] = {
        ("reception", "open_office"): 2.0,  # Entry to main office
        ("open_office", "meeting_room"): 1.5,  # Adjacent work areas
        ("manager_office", "open_office"): 1.0,  # Manager overlooks office
        ("break_room", "open_office"): 1.0,  # Convenient to office
        ("server_room", "bathrooms"): -2.0,  # Keep separate
        ("stairwell", "reception"): 2.0,  # Stairwell near entry
        ("meeting_room", "manager_office"): 1.5,  # Meeting space near manager
    }

    solver = ArchitecturalLayoutSolver(
        site_width=site_width,
        site_height=site_height,
        rooms=rooms,
        adjacency_matrix=adjacency_matrix,
        penalties=ConstraintPenalties(
            area_deviation=100.0,
            min_width_violation=600.0,  # Stricter for commercial
            aspect_ratio_violation=75.0,
            adjacency_violation=15.0,
            exterior_wall_violation=250.0,
            overlap_collision=1000.0,
        ),
        max_iterations=200,
        random_seed=42,
    )

    metadata = {
        "name": "Commercial Office",
        "description": "300 sqm office with open plan, meeting rooms, and support spaces",
        "plot_area": site_width * site_height,
        "total_room_area": sum(r.target_area for r in rooms),
    }

    return solver, metadata


# ============================================
# RUNNER FUNCTION
# ============================================

def run_example(
    example_name: str,
    solver: ArchitecturalLayoutSolver,
    metadata: Dict,
) -> None:
    """Execute solver and display results."""
    print(f"\n{'=' * 70}")
    print(f"  {example_name.upper()}")
    print(f"{'=' * 70}\n")

    print(f"Project: {metadata['name']}")
    print(f"Description: {metadata['description']}")
    print(f"Plot Area: {metadata['plot_area']:.1f} sqm")
    print(f"Total Room Target Area: {metadata['total_room_area']:.1f} sqm")
    print(f"Space Utilization: {(metadata['total_room_area'] / metadata['plot_area'] * 100):.1f}%\n")

    print("Solving layout optimization problem...")
    solution = solver.solve()

    print("\nResults:")
    print(f"  Best penalty score: {solution.total_penalty:.2f}")
    print(f"  Converged at iteration: {solution.iteration}/{solver.max_iterations}")
    print(f"  Constraints satisfied: {len([c for c in solution.constraints_satisfied.values() if c])}/{len(solution.constraints_satisfied)}\n")

    print("Room Placements:")
    print(f"{'Room':<20} {'Area (sqm)':<15} {'Deviation':<15} {'Position (x,y)':<20} {'Dimensions (W×H)':<20}")
    print("-" * 90)

    for placement in solution.placements:
        room = placement.room
        rect = placement.rectangle
        area_dev = placement.area_deviation * 100
        pos_str = f"({rect.x:.1f}, {rect.y:.1f})"
        dim_str = f"{rect.width:.1f}×{rect.height:.1f}"
        area_str = f"{rect.area:.1f}"

        deviation_indicator = "✓" if area_dev < 10 else "⚠" if area_dev < 20 else "✗"
        print(f"{room.name:<20} {area_str:<15} {deviation_indicator} {area_dev:>5.1f}%     {pos_str:<20} {dim_str:<20}")

    # Summary
    summary = solver.get_solution_summary()
    print(f"\n{'=' * 70}")
    print(f"Constraint Satisfaction: {summary['constraints_met']*100:.1f}%")
    print(f"{'=' * 70}\n")


# ============================================
# MAIN EXECUTION
# ============================================

if __name__ == "__main__":
    # Run residential villa example
    residential_solver, residential_meta = create_residential_villa_example()
    run_example("Residential Villa Layout", residential_solver, residential_meta)

    # Run commercial office example
    commercial_solver, commercial_meta = create_commercial_office_example()
    run_example("Commercial Office Layout", commercial_solver, commercial_meta)

    # Demonstrate reproducibility with same seed
    print("\n" + "=" * 70)
    print("REPRODUCIBILITY VERIFICATION")
    print("=" * 70)
    print("\nResolving residential villa with same seed...")
    villa_v2, _ = create_residential_villa_example()
    solution_v2 = villa_v2.solve()
    print(f"Penalty score: {solution_v2.total_penalty:.2f} (should match iteration 0 above)")
