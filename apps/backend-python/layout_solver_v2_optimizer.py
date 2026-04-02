from __future__ import annotations

import math
import random
from typing import Any, Callable, Dict, List, Optional, Tuple

from layout_solver_v2 import RoomType, snap_to_grid
from rules.layout_solver_defaults import (
    DEFAULT_SA_COOLING_RATE,
    DEFAULT_SA_INITIAL_TEMP,
    DEFAULT_SA_MAX_ITERATIONS,
    DEFAULT_SA_MIN_TEMP,
    DEFAULT_SA_NUDGE_FACTOR,
    DEFAULT_SA_RESIZE_DELTA,
    DEFAULT_SA_STAGNATION_LIMIT,
)


class SimulatedAnnealingSolver:
    """Simulated Annealing optimiser for architectural layout."""

    def __init__(
        self,
        initial_solution: Any,
        site: Any,
        constraints: Any,
        adjacency_map: Dict[Tuple[str, str], float],
        weights: Optional[Any] = None,
        initial_temp: float = DEFAULT_SA_INITIAL_TEMP,
        cooling_rate: float = DEFAULT_SA_COOLING_RATE,
        min_temp: float = DEFAULT_SA_MIN_TEMP,
        max_iterations: int = DEFAULT_SA_MAX_ITERATIONS,
        stagnation_limit: int = DEFAULT_SA_STAGNATION_LIMIT,
        random_seed: Optional[int] = None,
        penalty_fn: Optional[Callable[..., Any]] = None,
    ):
        self.site = site
        self.constraints = constraints
        self.adjacency_map = adjacency_map
        self.weights = weights
        self.initial_temp = initial_temp
        self.cooling_rate = cooling_rate
        self.min_temp = min_temp
        self.max_iterations = max_iterations
        self.stagnation_limit = stagnation_limit
        self.boundary = site.usable_boundary()
        self.penalty_fn = penalty_fn

        if random_seed is not None:
            random.seed(random_seed)

        self.current = initial_solution.clone()
        self.best = initial_solution.clone()
        self.best_penalty = initial_solution.total_penalty
        self.history: List[float] = []

    def _evaluate(self, solution: Any) -> float:
        """Compute penalty for a solution."""
        if self.penalty_fn is None:
            raise ValueError("penalty_fn must be provided for SimulatedAnnealingSolver")

        penalty, sat, diag = self.penalty_fn(
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

    def _neighbour(self, solution: Any) -> Any:
        """Generate a neighbour solution via random perturbation."""
        new = solution.clone()
        placements = new.placements
        if len(placements) < 2:
            return new

        move = random.choice(["swap", "resize", "nudge", "resize", "nudge"])
        grid = self.constraints.structural_grid_module_m

        if move == "swap" and len(placements) >= 2:
            i, j = random.sample(range(len(placements)), 2)
            ri, rj = placements[i].room, placements[j].room
            if not (ri.type == RoomType.STAIRCASE and ri.fixed_dimensions) and not (
                rj.type == RoomType.STAIRCASE and rj.fixed_dimensions
            ):
                placements[i].room, placements[j].room = rj, ri

        elif move == "resize":
            idx = random.randint(0, len(placements) - 1)
            p = placements[idx]
            if p.room.type == RoomType.STAIRCASE and p.room.fixed_dimensions:
                return new
            factor = 1.0 + random.uniform(-DEFAULT_SA_RESIZE_DELTA, DEFAULT_SA_RESIZE_DELTA)
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
            dx = random.uniform(-DEFAULT_SA_NUDGE_FACTOR, DEFAULT_SA_NUDGE_FACTOR) * (
                grid if grid > 0 else DEFAULT_SA_NUDGE_FACTOR
            )
            dy = random.uniform(-DEFAULT_SA_NUDGE_FACTOR, DEFAULT_SA_NUDGE_FACTOR) * (
                grid if grid > 0 else DEFAULT_SA_NUDGE_FACTOR
            )
            new_x = max(
                self.boundary.x,
                min(
                    p.rectangle.x + dx,
                    self.boundary.x + self.boundary.width - p.rectangle.width,
                ),
            )
            new_y = max(
                self.boundary.y,
                min(
                    p.rectangle.y + dy,
                    self.boundary.y + self.boundary.height - p.rectangle.height,
                ),
            )
            p.rectangle.x = new_x
            p.rectangle.y = new_y

        return new

    def solve(self) -> Any:
        """Run simulated annealing optimisation loop."""
        temp = self.initial_temp
        current_penalty = self._evaluate(self.current)
        self.best_penalty = current_penalty
        stagnation = 0

        for _ in range(self.max_iterations):
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
                (1.0 - self.best_penalty / max(self.history[0], 1e-10)) * 100,
                2,
            ) if self.history else 0.0,
            "total_iterations": len(self.history),
            "final_temperature": round(
                self.initial_temp * (self.cooling_rate ** len(self.history)),
                4,
            ),
        }
