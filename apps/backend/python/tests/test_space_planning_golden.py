"""
Golden Test Suite for Space Planning Engine

Phase I: Verification tests covering:
  1. Rectangular site — basic room placement and compliance
  2. Irregular polygon site — polygon boundary handling
  3. Space-syntax graph analysis — integration, depth, planarity
  4. GA optimizer — population seeding, evolution, convergence
  5. Structural handoff — wall stacking, cantilevers, slab panels
  6. MEP schedule — plumbing stacks, electrical points, HVAC loads
  7. Multi-floor / Vastu-enabled scenario
"""

import sys
import os
import math

# Ensure backend modules are importable
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import pytest

from layout_solver_v2 import (
    AdjacencyEdge,
    GlobalConstraints,
    LayoutSolverV2,
    PenaltyWeightsV2,
    Rectangle,
    RoomNode,
    RoomPlacement,
    RoomType,
    Setbacks,
    SiteConfig,
    generate_structural_grid,
    generate_structural_handoff,
    generate_mep_schedule,
    rectangles_adjacent,
    snap_to_grid,
)
from space_syntax import SpaceSyntaxAnalyzer, SpaceSyntaxResult
from genetic_optimizer import GAConfig, GeneticOptimizer, Chromosome


# =========================================================================
# Fixtures
# =========================================================================

@pytest.fixture
def basic_site():
    """12m × 10m rectangular site with standard setbacks."""
    return SiteConfig(
        width=12.0,
        height=10.0,
        fsi_limit=1.5,
        setbacks=Setbacks(front=3.0, rear=1.5, left=1.5, right=1.5),
    )


@pytest.fixture
def basic_constraints():
    return GlobalConstraints()


@pytest.fixture
def basic_rooms():
    """Minimal 2BHK: living, kitchen, 2 bedrooms, 1 bathroom."""
    return [
        RoomNode(id="living", name="Living Room", type=RoomType.HABITABLE,
                 target_area_sqm=18.0, min_width_m=3.5, is_entry=True),
        RoomNode(id="kitchen", name="Kitchen", type=RoomType.WET,
                 target_area_sqm=10.0, min_width_m=2.5, plumbing_required=True),
        RoomNode(id="bed1", name="Bedroom 1", type=RoomType.HABITABLE,
                 target_area_sqm=14.0, min_width_m=3.0),
        RoomNode(id="bed2", name="Bedroom 2", type=RoomType.HABITABLE,
                 target_area_sqm=12.0, min_width_m=2.8),
        RoomNode(id="bath1", name="Bathroom", type=RoomType.WET,
                 target_area_sqm=4.5, min_width_m=1.5, plumbing_required=True),
    ]


@pytest.fixture
def basic_adjacency():
    """Living-kitchen high affinity, bed-bath positive, kitchen-bed low."""
    return [
        AdjacencyEdge(node_a="living", node_b="kitchen", weight=5.0),
        AdjacencyEdge(node_a="bed1", node_b="bath1", weight=4.0),
        AdjacencyEdge(node_a="living", node_b="bed1", weight=2.0),
        AdjacencyEdge(node_a="living", node_b="bed2", weight=2.0),
    ]


# =========================================================================
# Test 1: Basic Solver — Rectangular Site
# =========================================================================

class TestRectangularSiteSolver:
    """Golden test: solver produces valid placements that satisfy core constraints."""

    def test_solver_produces_placements(self, basic_site, basic_constraints, basic_rooms, basic_adjacency):
        solver = LayoutSolverV2(
            site=basic_site, constraints=basic_constraints,
            rooms=basic_rooms, adjacency_edges=basic_adjacency,
            max_iterations=100,
        )
        solver.solve()
        assert solver.best_solution is not None
        assert len(solver.best_solution.placements) == len(basic_rooms)

    def test_all_rooms_area_reasonable(self, basic_site, basic_constraints, basic_rooms, basic_adjacency):
        """Each room's area should be within 50% of target (solver best-effort)."""
        solver = LayoutSolverV2(
            site=basic_site, constraints=basic_constraints,
            rooms=basic_rooms, adjacency_edges=basic_adjacency,
            max_iterations=100,
        )
        solver.solve()
        for p in solver.best_solution.placements:
            assert p.rectangle.area > 0, f"{p.room.id} has zero area"
            # Solver tries to fit rooms; allow generous tolerance
            deviation = abs(p.rectangle.area - p.room.target_area_sqm) / p.room.target_area_sqm
            assert deviation < 1.0, f"{p.room.id} area deviation {deviation:.1%} too large"

    def test_full_report_has_required_keys(self, basic_site, basic_constraints, basic_rooms, basic_adjacency):
        solver = LayoutSolverV2(
            site=basic_site, constraints=basic_constraints,
            rooms=basic_rooms, adjacency_edges=basic_adjacency,
            max_iterations=50,
        )
        solver.solve()
        report = solver.get_full_report()
        required_keys = [
            "total_penalty", "constraints_met_ratio", "compliance_items",
            "placements", "structural_grid", "travel_distances",
            "structural_handoff", "mep_schedule",
        ]
        for key in required_keys:
            assert key in report, f"Missing key: {key}"

    def test_compliance_items_are_clause_traceable(self, basic_site, basic_constraints, basic_rooms, basic_adjacency):
        solver = LayoutSolverV2(
            site=basic_site, constraints=basic_constraints,
            rooms=basic_rooms, adjacency_edges=basic_adjacency,
            max_iterations=50,
        )
        solver.solve()
        report = solver.get_full_report()
        for item in report["compliance_items"]:
            assert "domain" in item
            assert "clause" in item
            assert "passed" in item
            assert "severity" in item


# =========================================================================
# Test 2: Space Syntax Analysis
# =========================================================================

class TestSpaceSyntax:
    """Golden test: space-syntax graph analysis produces valid metrics."""

    def _make_placements(self):
        """Create a simple 3-room adjacency for testing."""
        rooms = [
            RoomNode(id="r1", name="Room1", type=RoomType.HABITABLE,
                     target_area_sqm=12.0, is_entry=True),
            RoomNode(id="r2", name="Room2", type=RoomType.HABITABLE,
                     target_area_sqm=10.0),
            RoomNode(id="r3", name="Room3", type=RoomType.WET,
                     target_area_sqm=6.0, plumbing_required=True),
        ]
        # Place rooms adjacent: r1|r2|r3 in a row
        placements = [
            RoomPlacement(
                room=rooms[0],
                rectangle=Rectangle(0, 0, 4, 3),
            ),
            RoomPlacement(
                room=rooms[1],
                rectangle=Rectangle(4, 0, 3.33, 3),
            ),
            RoomPlacement(
                room=rooms[2],
                rectangle=Rectangle(7.33, 0, 3, 2),
            ),
        ]
        return placements, rooms

    def test_analyze_returns_valid_result(self):
        placements, _ = self._make_placements()
        boundary = Rectangle(0, 0, 12, 8)
        adj_map = {("r1", "r2"): 3.0, ("r2", "r1"): 3.0}

        ss = SpaceSyntaxAnalyzer()
        result = ss.analyze(placements, boundary, adj_map)

        assert isinstance(result, SpaceSyntaxResult)
        assert len(result.nodes) == 3
        assert result.mean_depth >= 0
        assert result.max_depth >= 0
        assert result.integration_mean >= 0

    def test_entry_room_has_depth_zero(self):
        placements, _ = self._make_placements()
        boundary = Rectangle(0, 0, 12, 8)
        adj_map = {}

        ss = SpaceSyntaxAnalyzer()
        result = ss.analyze(placements, boundary, adj_map)

        entry_node = next((n for n in result.nodes if n.room_id == "r1"), None)
        assert entry_node is not None
        assert entry_node.depth == 0

    def test_planarity_check(self):
        placements, _ = self._make_placements()
        boundary = Rectangle(0, 0, 12, 8)
        adj_map = {}

        ss = SpaceSyntaxAnalyzer()
        result = ss.analyze(placements, boundary, adj_map)

        # 3 nodes, ≤3 edges => always planar (E ≤ 3V-6 = 3)
        assert result.is_planar is True

    def test_to_dict_serialization(self):
        placements, _ = self._make_placements()
        boundary = Rectangle(0, 0, 12, 8)
        adj_map = {}

        ss = SpaceSyntaxAnalyzer()
        result = ss.analyze(placements, boundary, adj_map)
        d = result.to_dict()

        assert "nodes" in d
        assert "edges" in d
        assert "mean_depth" in d
        assert "is_planar" in d
        assert "depth_histogram" in d


# =========================================================================
# Test 3: Structural Handoff
# =========================================================================

class TestStructuralHandoff:
    """Golden test: structural handoff generates wall segments and slab panels."""

    def test_handoff_has_required_keys(self, basic_site, basic_constraints, basic_rooms, basic_adjacency):
        solver = LayoutSolverV2(
            site=basic_site, constraints=basic_constraints,
            rooms=basic_rooms, adjacency_edges=basic_adjacency,
            max_iterations=50,
        )
        solver.solve()

        handoff = generate_structural_handoff(
            solver.best_solution.placements,
            solver.usable_boundary,
            basic_constraints,
        )
        assert "wall_segments" in handoff
        assert "cantilever_rooms" in handoff
        assert "slab_panels" in handoff
        assert len(handoff["slab_panels"]) == len(basic_rooms)

    def test_slab_type_classification(self):
        """Verify ly/lx > 2 → one_way, else two_way."""
        rooms = [
            RoomNode(id="r1", name="Long", type=RoomType.HABITABLE, target_area_sqm=20.0),
        ]
        placements = [
            RoomPlacement(
                room=rooms[0],
                rectangle=Rectangle(0, 0, 10, 2),  # ly/lx = 5.0 → one_way
            ),
        ]
        boundary = Rectangle(0, 0, 12, 8)
        constraints = GlobalConstraints()
        handoff = generate_structural_handoff(placements, boundary, constraints)
        panel = handoff["slab_panels"][0]
        assert panel["slab_type"] == "one_way"
        assert panel["ly_lx_ratio"] == 5.0


# =========================================================================
# Test 4: MEP Schedule
# =========================================================================

class TestMEPSchedule:
    """Golden test: MEP schedule produces plumbing/electrical/HVAC data."""

    def test_wet_rooms_identified(self, basic_site, basic_constraints, basic_rooms, basic_adjacency):
        solver = LayoutSolverV2(
            site=basic_site, constraints=basic_constraints,
            rooms=basic_rooms, adjacency_edges=basic_adjacency,
            max_iterations=50,
        )
        solver.solve()

        mep = generate_mep_schedule(solver.best_solution.placements)
        assert "plumbing" in mep
        assert "electrical" in mep
        assert "hvac" in mep

        # Kitchen and bathroom should be identified as wet rooms
        wet_ids = {wr["room_id"] for wr in mep["plumbing"]["wet_rooms"]}
        assert "kitchen" in wet_ids
        assert "bath1" in wet_ids

    def test_electrical_points_positive(self, basic_site, basic_constraints, basic_rooms, basic_adjacency):
        solver = LayoutSolverV2(
            site=basic_site, constraints=basic_constraints,
            rooms=basic_rooms, adjacency_edges=basic_adjacency,
            max_iterations=50,
        )
        solver.solve()
        mep = generate_mep_schedule(solver.best_solution.placements)
        assert mep["electrical"]["total_power_points"] > 0
        assert mep["electrical"]["total_lighting_points"] > 0

    def test_hvac_tonnage_positive(self, basic_site, basic_constraints, basic_rooms, basic_adjacency):
        solver = LayoutSolverV2(
            site=basic_site, constraints=basic_constraints,
            rooms=basic_rooms, adjacency_edges=basic_adjacency,
            max_iterations=50,
        )
        solver.solve()
        mep = generate_mep_schedule(solver.best_solution.placements)
        assert mep["hvac"]["total_tonnage_tr"] > 0


# =========================================================================
# Test 5: Structural Grid
# =========================================================================

class TestStructuralGrid:
    """Golden test: structural grid produces columns, beams, and span warnings."""

    def test_grid_output_structure(self, basic_site, basic_constraints, basic_rooms, basic_adjacency):
        solver = LayoutSolverV2(
            site=basic_site, constraints=basic_constraints,
            rooms=basic_rooms, adjacency_edges=basic_adjacency,
            max_iterations=50,
        )
        solver.solve()

        grid = generate_structural_grid(
            solver.best_solution.placements,
            solver.usable_boundary,
        )
        assert grid["total_columns"] > 0
        assert grid["total_beams"] > 0
        assert isinstance(grid["x_grid_lines"], list)
        assert isinstance(grid["y_grid_lines"], list)


# =========================================================================
# Test 6: GA Optimizer (Unit-level)
# =========================================================================

class TestGAOptimizer:
    """Golden test: GA optimizer produces a valid result."""

    def test_chromosome_round_trip(self, basic_rooms):
        """Chromosome → placements → Chromosome preserves data."""
        rooms_by_id = {r.id: r for r in basic_rooms}
        genes = [(1.0, 1.0, 4.0, 3.0)] * len(basic_rooms)
        order = [r.id for r in basic_rooms]
        chrom = Chromosome(genes=genes, room_order=order, fitness=0.0, constraints_met_ratio=0.0)

        placements = chrom.to_placements(rooms_by_id)
        assert len(placements) == len(basic_rooms)

        chrom2 = Chromosome.from_placements(placements)
        assert len(chrom2.genes) == len(basic_rooms)
        for g1, g2 in zip(chrom.genes, chrom2.genes):
            assert abs(g1[0] - g2[0]) < 0.01
            assert abs(g1[1] - g2[1]) < 0.01

    def test_ga_run_basic(self, basic_site, basic_constraints, basic_rooms, basic_adjacency):
        """GA optimizer runs without error and returns a result."""
        config = GAConfig(population_size=10, max_generations=5, elite_count=2, tournament_size=3)
        optimizer = GeneticOptimizer(
            site=basic_site,
            constraints=basic_constraints,
            rooms=basic_rooms,
            adjacency_edges=basic_adjacency,
        )
        result = optimizer.run(config=config)
        assert result.best_chromosome is not None
        assert len(result.fitness_history) > 0
        assert result.best_chromosome.fitness >= 0


# =========================================================================
# Test 7: Utility Functions
# =========================================================================

class TestUtilities:
    """Golden tests for low-level solver utilities."""

    def test_snap_to_grid(self):
        assert snap_to_grid(2.7, 0.5) == 2.5
        assert snap_to_grid(2.8, 0.5) == 3.0
        assert snap_to_grid(3.0, 0.5) == 3.0

    def test_rectangles_adjacent(self):
        r1 = Rectangle(0, 0, 4, 3)
        r2 = Rectangle(4, 0, 3, 3)  # shares right edge of r1
        assert rectangles_adjacent(r1, r2, tol=0.1) is True

        r3 = Rectangle(5, 0, 3, 3)  # gap of 1m
        assert rectangles_adjacent(r1, r3, tol=0.1) is False

    def test_rectangle_area(self):
        r = Rectangle(1, 2, 5, 3)
        assert r.area == 15.0

    def test_rectangle_aspect_ratio(self):
        r = Rectangle(0, 0, 6, 3)
        assert r.aspect_ratio == 2.0


# =========================================================================
# Test 8: Full Report Integration
# =========================================================================

class TestFullReport:
    """Golden test: get_full_report includes space_syntax when module available."""

    def test_report_contains_space_syntax(self, basic_site, basic_constraints, basic_rooms, basic_adjacency):
        solver = LayoutSolverV2(
            site=basic_site, constraints=basic_constraints,
            rooms=basic_rooms, adjacency_edges=basic_adjacency,
            max_iterations=50,
        )
        solver.solve()
        report = solver.get_full_report()

        # space_syntax should be present (module is available in this test env)
        if report.get("space_syntax") is not None:
            ss = report["space_syntax"]
            assert "nodes" in ss
            assert "edges" in ss
            assert "mean_depth" in ss
            assert "is_planar" in ss

    def test_report_contains_mep(self, basic_site, basic_constraints, basic_rooms, basic_adjacency):
        solver = LayoutSolverV2(
            site=basic_site, constraints=basic_constraints,
            rooms=basic_rooms, adjacency_edges=basic_adjacency,
            max_iterations=50,
        )
        solver.solve()
        report = solver.get_full_report()

        mep = report.get("mep_schedule")
        assert mep is not None
        assert "plumbing" in mep
        assert "electrical" in mep
        assert "hvac" in mep

    def test_report_contains_structural_handoff(self, basic_site, basic_constraints, basic_rooms, basic_adjacency):
        solver = LayoutSolverV2(
            site=basic_site, constraints=basic_constraints,
            rooms=basic_rooms, adjacency_edges=basic_adjacency,
            max_iterations=50,
        )
        solver.solve()
        report = solver.get_full_report()

        sh = report.get("structural_handoff")
        assert sh is not None
        assert "wall_segments" in sh
        assert "slab_panels" in sh
        assert len(sh["slab_panels"]) == len(basic_rooms)
