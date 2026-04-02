from __future__ import annotations

import logging
import random
from typing import Any, Callable, Dict, List, Optional, Tuple

from layout_solver_v2 import RoomType, snap_to_grid
from rules.layout_solver_defaults import (
    DEFAULT_ADJUSTMENT_BLEND,
    DEFAULT_SOLVER_CONVERGENCE_TARGET,
)

logger = logging.getLogger(__name__)


def solve_layout_iterations(
    solver: Any,
    calculate_penalty_fn: Callable[..., Tuple[float, Dict[str, bool], Dict[str, Any]]],
    solution_cls: Any,
) -> Any:
    """Run iterative BSP generation and keep the best penalized solution."""
    solver.best_solution = None
    solver.iteration_history = []

    for iteration in range(solver.max_iterations):
        solution = generate_solution(solver, iteration, solution_cls)
        solution.iteration = iteration

        logger.debug(
            "Iteration %d: generated %d placements",
            iteration,
            len(solution.placements),
        )

        penalty, sat, diag = calculate_penalty_fn(
            solution.placements,
            solver.usable_boundary,
            solver.site,
            solver.constraints,
            solver.adjacency_map,
            solver.weights,
        )
        solution.total_penalty = penalty
        solution.constraints_satisfied = sat
        solution.diagnostics = diag
        solver.iteration_history.append(penalty)

        if solver.best_solution is None or penalty < solver.best_solution.total_penalty:
            solver.best_solution = solution

        if penalty < DEFAULT_SOLVER_CONVERGENCE_TARGET:
            break

    return solver.best_solution or solution_cls()


def generate_solution(
    solver: Any,
    iteration: int,
    solution_cls: Any,
) -> Any:
    rooms = list(solver.rooms)
    if iteration > 0:
        random.shuffle(rooms)

    root = solver.build_partition_tree_fn(
        solver.usable_boundary,
        rooms,
        grid=solver.constraints.structural_grid_module_m,
        max_depth=8,
    )
    placements = solver.extract_placements_fn(root)
    adjust_placements(solver, placements, iteration)
    return solution_cls(placements=placements)


def adjust_placements(
    solver: Any,
    placements: List[Any],
    iteration: int,
) -> None:
    """Iteratively refine rectangles toward target area and minimum dimensions."""
    passes = 5 + iteration // 20
    grid = solver.constraints.structural_grid_module_m

    for _ in range(passes):
        for p in placements:
            room = p.room
            rect = p.rectangle

            if room.type == RoomType.STAIRCASE and room.fixed_dimensions:
                rect.width, rect.height = room.fixed_dimensions
                continue

            blend = DEFAULT_ADJUSTMENT_BLEND

            if rect.width > room.min_width_m and rect.width > 0:
                target_h = room.target_area_sqm / rect.width
                min_h = min(rect.width, rect.height) / room.max_aspect_ratio
                max_h = max(rect.width, rect.height) * room.max_aspect_ratio
                target_h = max(min_h, min(target_h, max_h))
                new_h = rect.height * (1 - blend) + target_h * blend
                rect.height = snap_to_grid(new_h, grid) if grid > 0 else new_h

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
