from __future__ import annotations
import logging
import random
from typing import Any, Dict, List, Optional, Tuple

from layout_solver_v2_core import (
    AcousticZone,
    AdjacencyEdge,
    PartitionDirection,
    Rectangle,
    RoomNode,
    RoomType,
    Setbacks,
    SiteConfig,
    infer_acoustic_zone,
    rectangles_overlap,
    validate_fsi,
)
from layout_solver_v2 import (
     AcousticZone,
     AdjacencyEdge,
     PartitionDirection,
     Rectangle,
     RoomNode,
     RoomType,
     Setbacks,
     SiteConfig,
     infer_acoustic_zone,
     rectangles_overlap,
     validate_fsi,
)
from layout_solver_v2_engine import (
    solve_layout_iterations as _solve_layout_iterations_impl,
    generate_solution as _generate_solution_impl,
    adjust_placements as _adjust_placements_impl,
)
from layout_solver_v2_optimizer import SimulatedAnnealingSolver as _BaseSimulatedAnnealingSolver
from .constraints import (
    analyze_circulation,
    analyze_egress,
    calculate_penalty_v2,
    calculate_staircase_footprint,
)
from .bsp import build_partition_tree_v2, extract_placements
from .helpers import (
    generate_mep_schedule,
    generate_structural_grid,
    generate_structural_handoff,
    insert_acoustic_buffers,
)
from .reporting import (
    build_compliance_items as _build_compliance_items_impl,
    build_full_report as _build_full_report_impl,
)
from .types import GlobalConstraints, LayoutSolutionV2, PenaltyWeightsV2, RoomPlacement

logger = logging.getLogger(__name__)

__all__ = [
  "LayoutSolverV2",
]


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

        logger.info("LayoutSolverV2 initialized: rooms=%d, max_iterations=%d", len(rooms), self.max_iterations)

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
                    adj[key] = 1.0  # moderate attract (DEFAULT_PLUMBING_ADJ_WEIGHT)
        return adj

    # -- solve --------------------------------------------------------

    def solve(self) -> LayoutSolutionV2:
        """Run iterative BSP + full-domain penalty optimisation."""
        self.build_partition_tree_fn = build_partition_tree_v2
        self.extract_placements_fn = extract_placements
        return _solve_layout_iterations_impl(self, calculate_penalty_v2, LayoutSolutionV2)

    def _generate_solution(self, iteration: int) -> LayoutSolutionV2:
        self.build_partition_tree_fn = build_partition_tree_v2
        self.extract_placements_fn = extract_placements
        return _generate_solution_impl(self, iteration, LayoutSolutionV2)

    def _adjust_placements(
        self, placements: List[RoomPlacement], iteration: int
    ) -> None:
        _adjust_placements_impl(self, placements, iteration)

    # -- reporting ----------------------------------------------------

    def _build_compliance_items(
        self,
        sol: "LayoutSolutionV2",
    ) -> List[Dict[str, Any]]:
        return _build_compliance_items_impl(self, sol)

    def get_full_report(self) -> Dict[str, Any]:
        return _build_full_report_impl(self, calculate_staircase_footprint)


class SimulatedAnnealingSolver(_BaseSimulatedAnnealingSolver):
    """Backward-compatible SA solver wrapper with local penalty binding."""

    def __init__(
        self,
        initial_solution: LayoutSolutionV2,
        site: SiteConfig,
        constraints: GlobalConstraints,
        adjacency_map: Dict[Tuple[str, str], float],
        weights: Optional[PenaltyWeightsV2] = None,
        initial_temp: float = 1.0,
        cooling_rate: float = 0.95,
        min_temp: float = 0.01,
        max_iterations: int = 500,
        stagnation_limit: int = 30,
        random_seed: Optional[int] = None,
    ):
        super().__init__(
            initial_solution=initial_solution,
            site=site,
            constraints=constraints,
            adjacency_map=adjacency_map,
            weights=weights or PenaltyWeightsV2(),
            initial_temp=initial_temp,
            cooling_rate=cooling_rate,
            min_temp=min_temp,
            max_iterations=max_iterations,
            stagnation_limit=stagnation_limit,
            random_seed=random_seed,
            penalty_fn=calculate_penalty_v2,
        )


__all__ += ["SimulatedAnnealingSolver"]
