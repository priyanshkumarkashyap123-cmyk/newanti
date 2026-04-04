"""
Genetic / Population-Based Optimiser for Architectural Floor Plans

Layers GA-style population search on top of BeamLab's existing
CSP/BSP/SA solver stack.  Does NOT replace the deterministic solver —
instead it uses LayoutSolverV2 as the *fitness evaluator* and the
BSP warm-start as initial population seeds.

Chromosome: ordered list of room placement rects (x, y, w, h per room).
Crossover:  uniform crossover on room-level slices.
Mutation:   nudge, resize, swap, or re-partition a random room.
Selection:  tournament selection with elitism.
Fitness:    multi-objective: area fit + adjacency + overlap + circulation
            + solar + structural + acoustic penalties.

Produces Pareto-ranked alternatives piped through the existing
/api/layout/v2/variants pathway.
"""

from __future__ import annotations

import math
import random
from copy import deepcopy
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Tuple

try:
    from layout_solver_v2 import (
        AdjacencyEdge,
        GlobalConstraints,
        LayoutSolverV2,
        LayoutSolutionV2,
        PenaltyWeightsV2,
        Rectangle,
        RoomNode,
        RoomPlacement,
        RoomType,
        SiteConfig,
        calculate_penalty_v2,
        snap_to_grid,
    )
except ImportError:
    pass  # type stubs for IDE


# =====================================================================
#  DATA MODELS
# =====================================================================

@dataclass
class Chromosome:
    """A chromosome encodes one complete floor plan layout."""
    genes: List[Tuple[float, float, float, float]]  # (x, y, w, h) per room
    room_order: List[str]  # room IDs in gene order
    fitness: float = float("inf")
    penalty_breakdown: Dict[str, float] = field(default_factory=dict)
    constraints_met_ratio: float = 0.0
    rank: int = 0  # Pareto rank (0 = best front)

    def to_placements(self, rooms_by_id: Dict[str, RoomNode]) -> List[RoomPlacement]:
        """Decode chromosome genes into RoomPlacement list."""
        placements = []
        for i, rid in enumerate(self.room_order):
            if rid not in rooms_by_id:
                continue
            x, y, w, h = self.genes[i]
            placements.append(RoomPlacement(
                room=rooms_by_id[rid],
                rectangle=Rectangle(x=x, y=y, width=max(w, 0.5), height=max(h, 0.5)),
            ))
        return placements

    @staticmethod
    def from_placements(
        placements: List[RoomPlacement],
    ) -> "Chromosome":
        """Encode RoomPlacement list into a chromosome."""
        genes = []
        order = []
        for p in placements:
            genes.append((p.rectangle.x, p.rectangle.y, p.rectangle.width, p.rectangle.height))
            order.append(p.room.id)
        return Chromosome(genes=genes, room_order=order)


@dataclass
class GAConfig:
    """Configuration for the genetic algorithm."""
    population_size: int = 30
    max_generations: int = 50
    elite_count: int = 3
    tournament_size: int = 4
    crossover_rate: float = 0.8
    mutation_rate: float = 0.3
    mutation_strength: float = 0.15  # max fractional change for resize/nudge
    convergence_threshold: float = 5.0  # stop if best fitness unchanged for N gens
    convergence_generations: int = 8
    random_seed: Optional[int] = None


@dataclass
class GAResult:
    """Result of a GA optimization run."""
    best_chromosome: Optional[Chromosome] = None
    best_fitness: float = float("inf")
    generations_run: int = 0
    population_size: int = 0
    fitness_history: List[float] = field(default_factory=list)
    pareto_front: List[Chromosome] = field(default_factory=list)
    converged: bool = False

    def to_dict(self) -> Dict[str, Any]:
        return {
            "best_fitness": round(self.best_fitness, 4),
            "generations_run": self.generations_run,
            "population_size": self.population_size,
            "fitness_history": [round(f, 4) for f in self.fitness_history],
            "pareto_front_size": len(self.pareto_front),
            "converged": self.converged,
        }


# =====================================================================
#  GENETIC OPTIMIZER
# =====================================================================

class GeneticOptimizer:
    """Population-based optimizer layered on top of LayoutSolverV2.

    Usage:
        optimizer = GeneticOptimizer(site, constraints, rooms, adjacency, weights)
        result = optimizer.run(config)
        best_placements = result.best_chromosome.to_placements(rooms_by_id)
    """

    def __init__(
        self,
        site: SiteConfig,
        constraints: GlobalConstraints,
        rooms: List[RoomNode],
        adjacency_edges: List[AdjacencyEdge],
        weights: Optional[PenaltyWeightsV2] = None,
    ):
        self.site = site
        self.constraints = constraints
        self.rooms = list(rooms)
        self.rooms_by_id = {r.id: r for r in rooms}
        self.weights = weights or PenaltyWeightsV2()
        self.boundary = site.usable_boundary()

        # Build adjacency map
        self.adjacency_map: Dict[Tuple[str, str], float] = {}
        valid_ids = {r.id for r in rooms}
        for e in adjacency_edges:
            if e.node_a in valid_ids and e.node_b in valid_ids:
                key = tuple(sorted((e.node_a, e.node_b)))
                self.adjacency_map[key] = e.weight

    def run(self, config: Optional[GAConfig] = None) -> GAResult:
        """Execute the genetic algorithm."""
        cfg = config or GAConfig()
        if cfg.random_seed is not None:
            random.seed(cfg.random_seed)

        result = GAResult(population_size=cfg.population_size)

        # 1. Generate initial population from BSP solver runs
        population = self._seed_population(cfg.population_size)

        # 2. Evaluate initial fitness
        for chrom in population:
            self._evaluate(chrom)

        # 3. Evolution loop
        stagnation = 0
        prev_best = float("inf")

        for gen in range(cfg.max_generations):
            # Sort by fitness (lower = better)
            population.sort(key=lambda c: c.fitness)

            best_fitness = population[0].fitness
            result.fitness_history.append(best_fitness)

            # Convergence check
            if abs(best_fitness - prev_best) < 1.0:
                stagnation += 1
            else:
                stagnation = 0
            prev_best = best_fitness

            if stagnation >= cfg.convergence_generations:
                result.converged = True
                break

            # Elitism: carry top individuals unchanged
            next_gen = population[:cfg.elite_count]

            # Fill rest of population
            while len(next_gen) < cfg.population_size:
                # Tournament selection
                parent_a = self._tournament_select(population, cfg.tournament_size)
                parent_b = self._tournament_select(population, cfg.tournament_size)

                # Crossover
                if random.random() < cfg.crossover_rate:
                    child = self._crossover(parent_a, parent_b)
                else:
                    child = deepcopy(parent_a)

                # Mutation
                if random.random() < cfg.mutation_rate:
                    self._mutate(child, cfg.mutation_strength)

                # Clamp to boundary
                self._clamp_to_boundary(child)

                # Evaluate
                self._evaluate(child)
                next_gen.append(child)

            population = next_gen
            result.generations_run = gen + 1

        # Final sort and extract best
        population.sort(key=lambda c: c.fitness)
        result.best_chromosome = population[0] if population else None
        result.best_fitness = population[0].fitness if population else float("inf")

        # Pareto front (non-dominated solutions)
        result.pareto_front = self._extract_pareto_front(population[:10])

        return result

    # -- population seeding -------------------------------------------

    def _seed_population(self, size: int) -> List[Chromosome]:
        """Generate initial population from BSP solver with varied seeds."""
        population: List[Chromosome] = []

        for i in range(size):
            solver = LayoutSolverV2(
                site=self.site,
                constraints=self.constraints,
                rooms=list(self.rooms),
                adjacency_edges=[
                    AdjacencyEdge(node_a=k[0], node_b=k[1], weight=v)
                    for k, v in self.adjacency_map.items()
                ],
                weights=self.weights,
                max_iterations=max(20, 50 - i),  # faster iterations for diversity
                random_seed=i * 1000 + 42,
            )
            sol = solver.solve()
            if sol and sol.placements:
                chrom = Chromosome.from_placements(sol.placements)
                population.append(chrom)
            else:
                # Fallback: random placement within boundary
                chrom = self._random_chromosome()
                population.append(chrom)

        return population

    def _random_chromosome(self) -> Chromosome:
        """Generate a random chromosome as fallback."""
        genes = []
        order = []
        bx, by = self.boundary.x, self.boundary.y
        bw, bh = self.boundary.width, self.boundary.height

        for room in self.rooms:
            w = max(room.min_width_m, math.sqrt(room.target_area_sqm))
            h = room.target_area_sqm / max(w, 0.5)
            x = bx + random.uniform(0, max(0.1, bw - w))
            y = by + random.uniform(0, max(0.1, bh - h))
            genes.append((x, y, w, h))
            order.append(room.id)

        return Chromosome(genes=genes, room_order=order)

    # -- fitness evaluation -------------------------------------------

    def _evaluate(self, chrom: Chromosome) -> None:
        """Evaluate chromosome fitness using the full penalty function."""
        placements = chrom.to_placements(self.rooms_by_id)
        penalty, sat, diag = calculate_penalty_v2(
            placements,
            self.boundary,
            self.site,
            self.constraints,
            self.adjacency_map,
            self.weights,
        )
        chrom.fitness = penalty
        met = sum(1 for v in sat.values() if v)
        total = max(1, len(sat))
        chrom.constraints_met_ratio = met / total

    # -- selection ----------------------------------------------------

    @staticmethod
    def _tournament_select(
        population: List[Chromosome], k: int
    ) -> Chromosome:
        """Tournament selection: pick k random individuals, return best."""
        participants = random.sample(population, min(k, len(population)))
        return min(participants, key=lambda c: c.fitness)

    # -- crossover ----------------------------------------------------

    def _crossover(
        self, parent_a: Chromosome, parent_b: Chromosome
    ) -> Chromosome:
        """Uniform crossover: for each room gene, pick from A or B."""
        if len(parent_a.genes) != len(parent_b.genes):
            return deepcopy(parent_a)

        genes = []
        for i in range(len(parent_a.genes)):
            if random.random() < 0.5:
                genes.append(parent_a.genes[i])
            else:
                genes.append(parent_b.genes[i])

        return Chromosome(genes=genes, room_order=list(parent_a.room_order))

    # -- mutation -----------------------------------------------------

    def _mutate(self, chrom: Chromosome, strength: float) -> None:
        """Apply one random mutation to the chromosome."""
        if not chrom.genes:
            return

        idx = random.randint(0, len(chrom.genes) - 1)
        x, y, w, h = chrom.genes[idx]
        grid = self.constraints.structural_grid_module_m

        move = random.choice(["nudge", "resize", "swap"])

        if move == "nudge":
            dx = random.uniform(-strength, strength) * self.boundary.width
            dy = random.uniform(-strength, strength) * self.boundary.height
            x += dx
            y += dy
            if grid > 0:
                x = snap_to_grid(x, grid)
                y = snap_to_grid(y, grid)

        elif move == "resize":
            factor = 1.0 + random.uniform(-strength, strength)
            if random.random() < 0.5:
                w *= factor
            else:
                h *= factor
            w = max(0.5, w)
            h = max(0.5, h)
            if grid > 0:
                w = snap_to_grid(w, grid)
                h = snap_to_grid(h, grid)

        elif move == "swap" and len(chrom.genes) >= 2:
            j = random.randint(0, len(chrom.genes) - 1)
            while j == idx:
                j = random.randint(0, len(chrom.genes) - 1)
            # Check neither is a locked staircase
            rid_i = chrom.room_order[idx]
            rid_j = chrom.room_order[j]
            room_i = self.rooms_by_id.get(rid_i)
            room_j = self.rooms_by_id.get(rid_j)
            if room_i and room_j:
                is_stair_i = room_i.type == RoomType.STAIRCASE and room_i.fixed_dimensions
                is_stair_j = room_j.type == RoomType.STAIRCASE and room_j.fixed_dimensions
                if not is_stair_i and not is_stair_j:
                    chrom.genes[idx], chrom.genes[j] = chrom.genes[j], chrom.genes[idx]
            return  # swap doesn't modify x/y/w/h

        chrom.genes[idx] = (x, y, w, h)

    # -- boundary clamping --------------------------------------------

    def _clamp_to_boundary(self, chrom: Chromosome) -> None:
        """Clamp all room genes to stay within the usable boundary."""
        bx, by = self.boundary.x, self.boundary.y
        bw, bh = self.boundary.width, self.boundary.height

        for i in range(len(chrom.genes)):
            x, y, w, h = chrom.genes[i]
            w = max(0.5, min(w, bw))
            h = max(0.5, min(h, bh))
            x = max(bx, min(x, bx + bw - w))
            y = max(by, min(y, by + bh - h))
            chrom.genes[i] = (x, y, w, h)

    # -- Pareto front -------------------------------------------------

    @staticmethod
    def _extract_pareto_front(
        candidates: List[Chromosome],
    ) -> List[Chromosome]:
        """Extract non-dominated solutions (simplified: single-objective rank)."""
        if not candidates:
            return []
        # For now, use single-objective ranking; multi-objective with
        # area_fit, adjacency, overlap, solar can be added later.
        sorted_c = sorted(candidates, key=lambda c: c.fitness)
        front: List[Chromosome] = []
        for c in sorted_c:
            front.append(c)
            if len(front) >= 5:
                break
        for i, c in enumerate(front):
            c.rank = i
        return front
