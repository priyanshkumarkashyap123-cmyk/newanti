"""
Tests for layout_solver_v2 new features:
  - A* Pathfinding on discretised floor grid
  - Simulated Annealing optimiser
  - Acoustic buffer insertion
  - Structural grid generation
  - Polygon site support
  - Multi-story FSI
  - WWR (Window-to-Wall Ratio) calculation

Run:  python -m pytest test_layout_v2_features.py -v
"""

import math
import pytest
from layout_solver_v2 import (
    AcousticZone,
    AdjacencyEdge,
    CellType,
    FloorGrid,
    GlobalConstraints,
    LayoutSolverV2,
    PenaltyWeightsV2,
    Rectangle,
    RoomNode,
    RoomPlacement,
    RoomType,
    Setbacks,
    SimulatedAnnealingSolver,
    SiteConfig,
    astar_pathfind,
    check_fenestration,
    compute_travel_distances,
    generate_structural_grid,
    insert_acoustic_buffers,
    validate_fsi,
)


# =====================================================================
#  FLOOR GRID TESTS
# =====================================================================

class TestFloorGrid:
    def _make_grid(self, w=20.0, h=15.0, cell_size=0.5):
        boundary = Rectangle(0, 0, w, h)
        return FloorGrid(boundary=boundary, cell_size=cell_size)

    def test_grid_dimensions(self):
        grid = self._make_grid(20, 15, 0.5)
        assert grid.rows == 30
        assert grid.cols == 40

    def test_rasterise_marks_rooms(self):
        boundary = Rectangle(0, 0, 10, 10)
        grid = FloorGrid(boundary=boundary, cell_size=1.0)
        room = RoomNode(
            id="r1", name="Room 1", type=RoomType.HABITABLE,
            target_area_sqm=25, min_width_m=2.0,
        )
        rect = Rectangle(2, 2, 5, 5)
        p = RoomPlacement(room=room, rectangle=rect)
        grid.rasterise([p])
        # Centre of room should be ROOM
        r, c = grid._to_rc(4.5, 4.5)
        assert grid._grid[r, c] == CellType.ROOM

    def test_corridor_ratio_all_corridor(self):
        boundary = Rectangle(0, 0, 10, 10)
        grid = FloorGrid(boundary=boundary, cell_size=1.0)
        grid.rasterise([])  # No rooms → entire grid is corridor
        assert grid.corridor_ratio == 1.0

    def test_walkable_cells(self):
        boundary = Rectangle(0, 0, 10, 10)
        grid = FloorGrid(boundary=boundary, cell_size=1.0)
        grid._grid[0, 0] = CellType.CORRIDOR
        grid._grid[1, 1] = CellType.WALL
        assert grid.cell_is_walkable(0, 0) is True
        assert grid.cell_is_walkable(1, 1) is False


# =====================================================================
#  A* PATHFINDING TESTS
# =====================================================================

class TestAStarPathfinding:
    def test_straight_path(self):
        """A* on an empty grid should find a straight-ish path."""
        boundary = Rectangle(0, 0, 10, 10)
        grid = FloorGrid(boundary=boundary, cell_size=0.5)
        grid.rasterise([])  # All corridor
        dist, path = astar_pathfind(grid, (1.0, 1.0), (9.0, 9.0))
        assert dist < 15.0  # Diagonal of 10x10 is ~11.3m
        assert dist > 10.0  # Must be at least Euclidean distance
        assert len(path) > 0

    def test_no_path_through_wall(self):
        """Path should return inf if start is walled off."""
        boundary = Rectangle(0, 0, 10, 10)
        grid = FloorGrid(boundary=boundary, cell_size=0.5)
        grid.rasterise([])
        # Block a wall across the grid
        for c in range(grid.cols):
            grid._grid[10, c] = CellType.WALL
        dist, path = astar_pathfind(grid, (1.0, 1.0), (1.0, 9.0))
        assert dist == float("inf")

    def test_start_equals_goal(self):
        boundary = Rectangle(0, 0, 10, 10)
        grid = FloorGrid(boundary=boundary, cell_size=0.5)
        grid.rasterise([])
        dist, path = astar_pathfind(grid, (5.0, 5.0), (5.0, 5.0))
        assert dist == 0.0
        assert len(path) == 1

    def test_compute_travel_distances(self):
        boundary = Rectangle(0, 0, 10, 10)
        grid = FloorGrid(boundary=boundary, cell_size=0.5)
        room = RoomNode(
            id="living", name="Living", type=RoomType.HABITABLE,
            target_area_sqm=20, min_width_m=3.0, is_entry=True,
        )
        rect = Rectangle(1, 1, 5, 4)
        placements = [RoomPlacement(room=room, rectangle=rect)]
        grid.rasterise(placements)
        result = compute_travel_distances(grid, placements)
        assert "distances_m" in result
        assert "corridor_ratio" in result
        assert result["max_travel_m"] >= 0


# =====================================================================
#  ACOUSTIC BUFFER TESTS
# =====================================================================

class TestAcousticBuffers:
    def test_buffer_inserted_between_active_passive(self):
        """Buffer should be inserted between ACTIVE and PASSIVE adjacent rooms."""
        active_room = RoomNode(
            id="kitchen", name="Kitchen", type=RoomType.UTILITY,
            acoustic_zone=AcousticZone.ACTIVE,
            target_area_sqm=12, min_width_m=2.5,
        )
        passive_room = RoomNode(
            id="bedroom", name="Bedroom", type=RoomType.HABITABLE,
            acoustic_zone=AcousticZone.PASSIVE,
            target_area_sqm=15, min_width_m=3.0,
        )
        # Side by side
        r1 = Rectangle(0, 0, 4, 4)
        r2 = Rectangle(4, 0, 4, 4)
        placements = [
            RoomPlacement(room=active_room, rectangle=r1),
            RoomPlacement(room=passive_room, rectangle=r2),
        ]
        updated, buffers = insert_acoustic_buffers(placements)
        assert len(buffers) == 1
        assert buffers[0]["between"] == ["kitchen", "bedroom"]
        assert buffers[0]["width_m"] > 0

    def test_no_buffer_for_same_zone(self):
        """No buffer needed between rooms of the same zone."""
        r1_node = RoomNode(
            id="bed1", name="Bed1", type=RoomType.HABITABLE,
            acoustic_zone=AcousticZone.PASSIVE,
            target_area_sqm=12, min_width_m=3.0,
        )
        r2_node = RoomNode(
            id="bed2", name="Bed2", type=RoomType.HABITABLE,
            acoustic_zone=AcousticZone.PASSIVE,
            target_area_sqm=12, min_width_m=3.0,
        )
        r1 = Rectangle(0, 0, 4, 3)
        r2 = Rectangle(4, 0, 4, 3)
        placements = [
            RoomPlacement(room=r1_node, rectangle=r1),
            RoomPlacement(room=r2_node, rectangle=r2),
        ]
        _, buffers = insert_acoustic_buffers(placements)
        assert len(buffers) == 0


# =====================================================================
#  STRUCTURAL GRID TESTS
# =====================================================================

class TestStructuralGrid:
    def test_basic_grid_generation(self):
        boundary = Rectangle(0, 0, 12, 9)
        room = RoomNode(
            id="hall", name="Hall", type=RoomType.HABITABLE,
            target_area_sqm=40, min_width_m=4.0,
        )
        rect = Rectangle(1, 1, 10, 7)
        placements = [RoomPlacement(room=room, rectangle=rect)]
        result = generate_structural_grid(placements, boundary, grid_module_m=3.0)
        assert result["total_columns"] > 0
        assert result["total_beams"] > 0
        assert result["grid_module_m"] == 3.0

    def test_span_warning_for_large_room(self):
        boundary = Rectangle(0, 0, 20, 15)
        room = RoomNode(
            id="hall", name="Hall", type=RoomType.HABITABLE,
            target_area_sqm=100, min_width_m=5.0,
        )
        # 12m span exceeds default 5m limit
        rect = Rectangle(2, 2, 12, 8)
        placements = [RoomPlacement(room=room, rectangle=rect)]
        result = generate_structural_grid(placements, boundary, max_span_m=5.0)
        assert len(result["span_warnings"]) > 0
        assert result["span_warnings"][0]["room_id"] == "hall"

    def test_columns_include_boundary_corners(self):
        boundary = Rectangle(0, 0, 9, 6)
        result = generate_structural_grid([], boundary, grid_module_m=3.0)
        xs = set(c["x"] for c in result["columns"])
        ys = set(c["y"] for c in result["columns"])
        assert 0.0 in xs
        assert 9.0 in xs
        assert 0.0 in ys
        assert 6.0 in ys


# =====================================================================
#  SIMULATED ANNEALING TESTS
# =====================================================================

class TestSimulatedAnnealing:
    def _make_initial_solution(self):
        """Create a simple solved BSP layout to warm-start SA."""
        site = SiteConfig(
            width=15, height=12, fsi_limit=1.5,
            setbacks=Setbacks(front=1.5, rear=1.0, left=1.0, right=1.0),
        )
        constraints = GlobalConstraints()
        rooms = [
            RoomNode(id="living", name="Living", type=RoomType.HABITABLE,
                     target_area_sqm=20, min_width_m=3.5, is_entry=True, priority=1),
            RoomNode(id="bed1", name="Bedroom", type=RoomType.HABITABLE,
                     target_area_sqm=12, min_width_m=3.0, priority=2),
            RoomNode(id="kitchen", name="Kitchen", type=RoomType.WET,
                     target_area_sqm=10, min_width_m=2.5, plumbing_required=True, priority=3),
        ]
        edges = [
            AdjacencyEdge(node_a="living", node_b="kitchen", weight=8),
            AdjacencyEdge(node_a="living", node_b="bed1", weight=5),
        ]
        solver = LayoutSolverV2(
            site=site, constraints=constraints, rooms=rooms,
            adjacency_edges=edges, max_iterations=30, random_seed=42,
        )
        solver.solve()
        return solver, site, constraints, edges

    def test_sa_improves_or_maintains_penalty(self):
        solver, site, constraints, edges = self._make_initial_solution()
        initial_penalty = solver.best_solution.total_penalty
        adj_map = {}
        for e in edges:
            adj_map[(e.node_a, e.node_b)] = e.weight
            adj_map[(e.node_b, e.node_a)] = e.weight

        sa = SimulatedAnnealingSolver(
            initial_solution=solver.best_solution,
            site=site,
            constraints=constraints,
            adjacency_map=adj_map,
            initial_temp=500.0,
            cooling_rate=0.99,
            max_iterations=200,
            stagnation_limit=30,
            random_seed=42,
        )
        result = sa.solve()
        # SA should not make things worse (best is tracked)
        assert result.total_penalty <= initial_penalty + 1e-6

    def test_sa_convergence_report(self):
        solver, site, constraints, edges = self._make_initial_solution()
        adj_map = {
            (e.node_a, e.node_b): e.weight for e in edges
        }
        adj_map.update({(e.node_b, e.node_a): e.weight for e in edges})
        sa = SimulatedAnnealingSolver(
            initial_solution=solver.best_solution,
            site=site, constraints=constraints, adjacency_map=adj_map,
            max_iterations=100, random_seed=42,
        )
        sa.solve()
        report = sa.get_convergence_report()
        assert "initial_penalty" in report
        assert "final_penalty" in report
        assert "improvement_pct" in report
        assert report["total_iterations"] > 0


# =====================================================================
#  POLYGON SITE SUPPORT
# =====================================================================

class TestPolygonSite:
    def test_rectangular_site_is_not_polygon(self):
        site = SiteConfig(
            width=15, height=12, fsi_limit=1.5,
            setbacks=Setbacks(front=1.5, rear=1.0, left=1.0, right=1.0),
        )
        assert site.is_polygon is False

    def test_polygon_site_is_polygon(self):
        site = SiteConfig(
            width=15, height=12, fsi_limit=1.5,
            setbacks=Setbacks(front=1.5, rear=1.0, left=1.0, right=1.0),
            polygon_vertices=[(0, 0), (15, 0), (15, 12), (7, 14), (0, 12)],
        )
        assert site.is_polygon is True

    def test_polygon_usable_boundary(self):
        site = SiteConfig(
            width=15, height=12, fsi_limit=1.5,
            setbacks=Setbacks(front=1.5, rear=1.0, left=1.0, right=1.0),
            polygon_vertices=[(0, 0), (15, 0), (15, 12), (0, 12)],
        )
        boundary = site.usable_boundary()
        assert boundary.width > 0
        assert boundary.height > 0
        assert boundary.width < 15
        assert boundary.height < 12


# =====================================================================
#  MULTI-STORY FSI
# =====================================================================

class TestMultiStoryFSI:
    def test_single_floor_fsi(self):
        site = SiteConfig(
            width=20, height=15, fsi_limit=1.5,
            setbacks=Setbacks(front=3, rear=1.5, left=1.5, right=1.5),
        )
        boundary = site.usable_boundary()
        rooms = [
            RoomNode(id="r1", name="R1", type=RoomType.HABITABLE,
                     target_area_sqm=100, min_width_m=3.0),
        ]
        placements = [RoomPlacement(room=rooms[0], rectangle=Rectangle(3, 3, 10, 10))]
        total_area = sum(p.rectangle.area for p in placements)
        result = validate_fsi(total_area, site, num_floors=1)
        assert result["num_floors"] == 1
        assert result["total_covered_area"] == 100.0

    def test_multi_floor_fsi(self):
        site = SiteConfig(
            width=20, height=15, fsi_limit=2.0,
            setbacks=Setbacks(front=3, rear=1.5, left=1.5, right=1.5),
        )
        boundary = site.usable_boundary()
        rooms = [
            RoomNode(id="r1", name="R1", type=RoomType.HABITABLE,
                     target_area_sqm=80, min_width_m=3.0),
        ]
        placements = [RoomPlacement(room=rooms[0], rectangle=Rectangle(3, 3, 10, 8))]
        total_area = sum(p.rectangle.area for p in placements)
        result = validate_fsi(total_area, site, num_floors=3)
        assert result["num_floors"] == 3
        assert result["total_covered_area"] == total_area * 3


# =====================================================================
#  WWR (WINDOW-TO-WALL RATIO)
# =====================================================================

class TestWWR:
    def test_fenestration_returns_wwr(self):
        room = RoomNode(
            id="living", name="Living", type=RoomType.HABITABLE,
            target_area_sqm=20, min_width_m=3.5,
            requires_exterior_wall=True,
        )
        rect = Rectangle(0, 0, 5, 4)
        boundary = Rectangle(0, 0, 20, 15)
        placement = RoomPlacement(room=room, rectangle=rect)
        result = check_fenestration(placement, boundary)
        assert "wwr" in result
        assert "wwr_min" in result
        assert result["wwr"] >= 0
        assert result["total_wall_area_sqm"] > 0


# =====================================================================
#  INTEGRATION: FULL REPORT WITH NEW FEATURES
# =====================================================================

class TestFullReport:
    def test_report_contains_new_fields(self):
        site = SiteConfig(
            width=15, height=12, fsi_limit=1.5,
            setbacks=Setbacks(front=1.5, rear=1.0, left=1.0, right=1.0),
        )
        rooms = [
            RoomNode(id="living", name="Living", type=RoomType.HABITABLE,
                     target_area_sqm=20, min_width_m=3.5, is_entry=True),
            RoomNode(id="bed1", name="Bedroom", type=RoomType.HABITABLE,
                     target_area_sqm=12, min_width_m=3.0),
            RoomNode(id="kitchen", name="Kitchen", type=RoomType.WET,
                     target_area_sqm=10, min_width_m=2.5, plumbing_required=True),
        ]
        edges = [
            AdjacencyEdge(node_a="living", node_b="kitchen", weight=8),
        ]
        solver = LayoutSolverV2(
            site=site,
            constraints=GlobalConstraints(),
            rooms=rooms,
            adjacency_edges=edges,
            max_iterations=30,
            random_seed=42,
        )
        solver.solve()
        report = solver.get_full_report()

        assert "travel_distances" in report
        assert "acoustic_buffers" in report
        assert "structural_grid" in report
        assert report["structural_grid"]["total_columns"] > 0
        assert isinstance(report["acoustic_buffers"], list)
        assert report["travel_distances"]["max_travel_m"] >= 0


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
