"""
Multi-Variant Layout Generator — Generates 5 competing good solutions

Creates multiple floor plan alternatives by varying:
  - Zone priority orderings
  - Penalty weight profiles
  - Room placement strategies
  - Macro-zoning orientations

Returns solutions ranked by quality metrics, allowing users to choose
their preferred design philosophy rather than settling for one solution.
"""

from __future__ import annotations

import asyncio
import time
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Callable, Dict, List, Optional, Tuple

# Importing from layout_solver_v2 — use correct class names
from layout_solver_v2 import (
    AcousticZone,
    AdjacencyEdge,
    GlobalConstraints,
    LayoutSolverV2,
    LayoutSolutionV2,
    PenaltyWeightsV2,
    RoomNode,
    RoomPlacement,
    RoomType,
    Setbacks,
    SiteConfig,
)

# workflow_analyzer is optional — degrade gracefully when absent
try:
    from workflow_analyzer import WorkflowAnalyzer, ZoneType, ActivityType
    _WORKFLOW_ANALYZER_AVAILABLE = True
except ImportError:
    WorkflowAnalyzer = None  # type: ignore[assignment,misc]
    ZoneType = None          # type: ignore[assignment]
    ActivityType = None      # type: ignore[assignment]
    _WORKFLOW_ANALYZER_AVAILABLE = False


# =====================================================================
#  DESIGN VARIANT RANKING
# =====================================================================

class DesignMetric(Enum):
    """Quality dimensions for evaluating floor plans."""
    COMPACTNESS = "compactness"          # Lower=better, avoids scatter
    ZONE_COHERENCE = "zone_coherence"   # How well zones cluster
    ADJACENCY_SCORE = "adjacency_score"  # Required/preferred pairs adjacent
    CIRCULATION_FLOW = "circulation_flow"  # Entry→living→sleeping smooth
    USABLE_AREA_RATIO = "usable_ratio"  # Room area / total area (no wasted space)
    AMENITY_ACCESS = "amenity_access"   # Distance to bathrooms/utility
    NATURAL_LIGHT = "natural_light"     # Rooms with exterior walls
    COST_EFFICIENCY = "cost_efficiency"  # Layout buildability/system routing


@dataclass
class VariantScore:
    """Scoring metrics for a single design variant."""
    variant_id: str
    strategy_name: str
    strategy_description: str
    
    # Core quality metrics
    compactness: float = 0.0           # 0-100, lower = more compact
    zone_coherence: float = 0.0        # 0-100, higher = better clustering
    adjacency_satisfaction: float = 0.0  # 0-100, % of required pairs adjacent
    circulation_efficiency: float = 0.0  # 0-100, flow path score
    usable_area_ratio: float = 0.0     # 50-95, % of buildable area used
    amenity_access: float = 0.0        # 0-100, proximity score
    natural_light_score: float = 0.0   # 0-100, exterior wall access
    buildability_score: float = 0.0    # 0-100, construction feasibility
    
    # Overall composite score
    composite_score: float = 0.0       # 0-100, weighted combination
    
    # Metadata
    calculation_time_ms: float = 0.0
    solver_iterations: int = 0
    constraint_violations: List[str] = field(default_factory=list)


@dataclass
class DesignVariant:
    """Complete design solution with placements and metadata."""
    variant_id: str
    strategy_key: str
    strategy_name: str
    strategy_description: str
    placements: List[RoomPlacement] = field(default_factory=list)
    report: Optional[LayoutReport] = None
    score: Optional[VariantScore] = None
    penalty_weights: Dict[str, float] = field(default_factory=dict)
    _raw_solver_output: Optional[Dict[str, Any]] = None


# =====================================================================
#  MULTI-VARIANT SOLVER
# =====================================================================

class MultiVariantSolver:
    """
    Generates 5 competing design solutions using different optimization strategies.
    
    Dramatically improves layout quality by exploring the design space rather than
    settling on one local optimum. Each variant represents a different architectural
    philosophy (open living vs. private sleeping, etc).
    """
    
    def __init__(
        self,
        executor: Optional[ThreadPoolExecutor] = None,
        debug: bool = False,
    ):
        self.executor = executor or ThreadPoolExecutor(max_workers=5)
        self.debug = debug
        self.variants: Dict[str, DesignVariant] = {}
        if _WORKFLOW_ANALYZER_AVAILABLE:
            self.analyzer = WorkflowAnalyzer()
        else:
            self.analyzer = None
    
    def generate_variants(
        self,
        rooms: List[RoomNode],
        site_config: Any,  # SiteConfig
        base_penalty_weights: Optional[Dict[str, float]] = None,
        timeout_per_variant_sec: float = 30.0,
        adjacency_edges: Optional[List[AdjacencyEdge]] = None,
        constraints: Optional[GlobalConstraints] = None,
    ) -> List[DesignVariant]:
        """
        Generate up to 5 design variants using different weighting strategies.

        Each variant uses the same rooms/site but shifts penalty weights to
        express a different design philosophy (open-plan, private-sleeping, etc.).
        """
        print(f"🎯 Generating layout variants for {len(rooms)} rooms...")

        # Prepare variant weight profiles
        variant_configs = self._prepare_variant_configs(
            base_penalty_weights or {},
            rooms,
        )

        # Solve each variant with the production LayoutSolverV2
        variants = self._solve_variants_parallel(
            variant_configs,
            rooms,
            site_config,
            adjacency_edges or [],
            constraints or GlobalConstraints(),
            timeout_per_variant_sec,
        )

        # Score and rank
        for variant in variants:
            self._score_variant(variant)

        variants.sort(key=lambda v: v.score.composite_score if v.score else 0, reverse=True)

        if self.debug:
            for i, v in enumerate(variants, 1):
                score_str = f"{v.score.composite_score:.1f}" if v.score else "N/A"
                print(f"  {i}. {v.strategy_name} → score {score_str}")

        self.variants = {v.variant_id: v for v in variants}
        return variants
    
    def _prepare_variant_configs(
        self,
        base_weights: Dict[str, float],
        rooms: List[RoomNode],
    ) -> List[Dict[str, Any]]:
        """Prepare penalty-weight configuration for each design strategy.

        Each strategy shifts the relative importance of adjacency, solar,
        circulation, and compactness to achieve a distinct architectural intent.
        The five profiles are named following IS 3861 room-type classification:
          1. active_first     — maximise social-zone cohesion
          2. sleeping_refuge  — maximise private-zone separation
          3. central_circ     — hub-and-spoke central corridor
          4. compact_zones    — minimise footprint, maximise area efficiency
          5. linear_flow      — sequential entry→living→sleeping arrangement
        """
        _P = lambda k, default=100.0: float(base_weights.get(k, default))

        # Common base for all variants
        base = {
            "overlap_collision":          _P("overlap_collision", 1000.0),
            "fsi_violation":              _P("fsi_violation", 2000.0),
            "min_width_violation":        _P("min_width_violation", 500.0),
            "egress_distance_violation":  _P("egress_distance_violation", 1500.0),
            "exterior_wall_violation":    _P("exterior_wall_violation", 300.0),
            "span_violation":             _P("span_violation", 800.0),
            "beam_headroom_violation":    _P("beam_headroom_violation", 600.0),
            "clearance_violation":        _P("clearance_violation", 400.0),
            "grid_snap_deviation":        _P("grid_snap_deviation", 30.0),
        }

        return [
            {
                "variant_id": "active_first",
                "strategy_name": "Open Living Concept",
                "strategy_description": "Social spaces (living/dining/kitchen) are centralised and integrated. Ideal for entertaining.",
                "penalty_weights": {
                    **base,
                    "adjacency_violation":    _P("adjacency_violation", 120.0) * 2.0,
                    "area_deviation":         _P("area_deviation", 100.0) * 0.8,
                    "acoustic_zone_violation":_P("acoustic_zone_violation", 100.0) * 0.5,
                    "plumbing_cluster_penalty":_P("plumbing_cluster_penalty", 200.0) * 1.0,
                    "solar_thermal_penalty":  _P("solar_thermal_penalty", 40.0) * 1.2,
                    "circulation_excess":     _P("circulation_excess", 150.0) * 0.8,
                    "fenestration_violation": _P("fenestration_violation", 200.0) * 1.0,
                    "aspect_ratio_violation": _P("aspect_ratio_violation", 50.0) * 1.0,
                    "compactness_penalty":    _P("compactness_penalty", 80.0) * 1.5,
                    "zone_grouping_penalty":  _P("zone_grouping_penalty", 100.0) * 2.0,
                },
            },
            {
                "variant_id": "sleeping_refuge",
                "strategy_name": "Private Sleeping Wing",
                "strategy_description": "Bedrooms clustered in a quiet wing, maximum acoustic separation from active zones.",
                "penalty_weights": {
                    **base,
                    "adjacency_violation":    _P("adjacency_violation", 120.0) * 1.5,
                    "area_deviation":         _P("area_deviation", 100.0) * 1.0,
                    "acoustic_zone_violation":_P("acoustic_zone_violation", 100.0) * 3.0,
                    "plumbing_cluster_penalty":_P("plumbing_cluster_penalty", 200.0) * 1.5,
                    "solar_thermal_penalty":  _P("solar_thermal_penalty", 40.0) * 1.5,
                    "circulation_excess":     _P("circulation_excess", 150.0) * 1.2,
                    "fenestration_violation": _P("fenestration_violation", 200.0) * 1.2,
                    "aspect_ratio_violation": _P("aspect_ratio_violation", 50.0) * 1.0,
                    "compactness_penalty":    _P("compactness_penalty", 80.0) * 1.0,
                    "zone_grouping_penalty":  _P("zone_grouping_penalty", 100.0) * 1.5,
                },
            },
            {
                "variant_id": "central_circulation",
                "strategy_name": "Central Corridor Hub",
                "strategy_description": "Hub-and-spoke layout with central corridor; all rooms radiate from a shared spine.",
                "penalty_weights": {
                    **base,
                    "adjacency_violation":    _P("adjacency_violation", 120.0) * 1.0,
                    "area_deviation":         _P("area_deviation", 100.0) * 1.0,
                    "acoustic_zone_violation":_P("acoustic_zone_violation", 100.0) * 1.0,
                    "plumbing_cluster_penalty":_P("plumbing_cluster_penalty", 200.0) * 1.0,
                    "solar_thermal_penalty":  _P("solar_thermal_penalty", 40.0) * 0.8,
                    "circulation_excess":     _P("circulation_excess", 150.0) * 0.3,  # allow wider corridors
                    "fenestration_violation": _P("fenestration_violation", 200.0) * 1.0,
                    "aspect_ratio_violation": _P("aspect_ratio_violation", 50.0) * 1.5,
                    "compactness_penalty":    _P("compactness_penalty", 80.0) * 2.0,
                    "zone_grouping_penalty":  _P("zone_grouping_penalty", 100.0) * 1.0,
                },
            },
            {
                "variant_id": "compact_zones",
                "strategy_name": "Compact Efficient Zones",
                "strategy_description": "Minimise footprint, maximise usable area ratio. Best for smaller budgets.",
                "penalty_weights": {
                    **base,
                    "adjacency_violation":    _P("adjacency_violation", 120.0) * 1.2,
                    "area_deviation":         _P("area_deviation", 100.0) * 2.0,   # tight area match
                    "acoustic_zone_violation":_P("acoustic_zone_violation", 100.0) * 0.8,
                    "plumbing_cluster_penalty":_P("plumbing_cluster_penalty", 200.0) * 2.0,
                    "solar_thermal_penalty":  _P("solar_thermal_penalty", 40.0) * 0.5,
                    "circulation_excess":     _P("circulation_excess", 150.0) * 2.0,  # minimise dead space
                    "fenestration_violation": _P("fenestration_violation", 200.0) * 0.8,
                    "aspect_ratio_violation": _P("aspect_ratio_violation", 50.0) * 0.8,
                    "compactness_penalty":    _P("compactness_penalty", 80.0) * 2.5,
                    "zone_grouping_penalty":  _P("zone_grouping_penalty", 100.0) * 1.5,
                },
            },
            {
                "variant_id": "linear_flow",
                "strategy_name": "Linear Sequential Flow",
                "strategy_description": "Entry → social zone → private zone in a clear linear progression. Traditional Indian plan.",
                "penalty_weights": {
                    **base,
                    "adjacency_violation":    _P("adjacency_violation", 120.0) * 1.8,
                    "area_deviation":         _P("area_deviation", 100.0) * 0.9,
                    "acoustic_zone_violation":_P("acoustic_zone_violation", 100.0) * 1.5,
                    "plumbing_cluster_penalty":_P("plumbing_cluster_penalty", 200.0) * 1.2,
                    "solar_thermal_penalty":  _P("solar_thermal_penalty", 40.0) * 1.0,
                    "circulation_excess":     _P("circulation_excess", 150.0) * 1.0,
                    "fenestration_violation": _P("fenestration_violation", 200.0) * 1.5,
                    "aspect_ratio_violation": _P("aspect_ratio_violation", 50.0) * 1.2,
                    "compactness_penalty":    _P("compactness_penalty", 80.0) * 1.0,
                    "zone_grouping_penalty":  _P("zone_grouping_penalty", 100.0) * 1.2,
                },
            },
        ]

    def _solve_variants_parallel(
        self,
        configs: List[Dict[str, Any]],
        rooms: List[RoomNode],
        site_config: Any,
        adjacency_edges: List[AdjacencyEdge],
        constraints: GlobalConstraints,
        timeout_sec: float,
    ) -> List[DesignVariant]:
        """Solve each variant sequentially using LayoutSolverV2."""
        variants: List[DesignVariant] = []

        for i, config in enumerate(configs, 1):
            if self.debug:
                print(f"  [{i}/{len(configs)}] Solving: {config['strategy_name']}...")
            try:
                variant = self._solve_single_variant(
                    config, rooms, site_config, adjacency_edges, constraints, timeout_sec,
                )
                variants.append(variant)
            except Exception as exc:
                variant = DesignVariant(
                    variant_id=config["variant_id"],
                    strategy_key=config["variant_id"],
                    strategy_name=config["strategy_name"],
                    strategy_description=config["strategy_description"],
                )
                variant.score = VariantScore(
                    variant_id=config["variant_id"],
                    strategy_name=config["strategy_name"],
                    strategy_description=config["strategy_description"],
                    constraint_violations=[str(exc)],
                )
                variants.append(variant)

        return variants
    
    def _solve_single_variant(
        self,
        config: Dict[str, Any],
        rooms: List[RoomNode],
        site_config: SiteConfig,
        adjacency_edges: List[AdjacencyEdge],
        constraints: GlobalConstraints,
        timeout_sec: float,
    ) -> DesignVariant:
        """Solve one layout variant using LayoutSolverV2 with strategy-specific penalty weights.

        Runs the production BSP+CSP solver with the strategy's penalty weight profile.
        The seed is varied per variant to explore different BSP split orderings.
        """
        import random as _random

        variant = DesignVariant(
            variant_id=config["variant_id"],
            strategy_key=config["variant_id"],
            strategy_name=config["strategy_name"],
            strategy_description=config["strategy_description"],
            penalty_weights=config["penalty_weights"],
        )

        # Build PenaltyWeightsV2 from the strategy config dict
        pw_dict = config["penalty_weights"]
        weights = PenaltyWeightsV2(
            area_deviation=        float(pw_dict.get("area_deviation", 100.0)),
            min_width_violation=   float(pw_dict.get("min_width_violation", 500.0)),
            aspect_ratio_violation=float(pw_dict.get("aspect_ratio_violation", 50.0)),
            adjacency_violation=   float(pw_dict.get("adjacency_violation", 120.0)),
            exterior_wall_violation=float(pw_dict.get("exterior_wall_violation", 300.0)),
            overlap_collision=     float(pw_dict.get("overlap_collision", 1000.0)),
            fsi_violation=         float(pw_dict.get("fsi_violation", 2000.0)),
            plumbing_cluster_penalty=float(pw_dict.get("plumbing_cluster_penalty", 200.0)),
            acoustic_zone_violation=float(pw_dict.get("acoustic_zone_violation", 100.0)),
            clearance_violation=   float(pw_dict.get("clearance_violation", 400.0)),
            grid_snap_deviation=   float(pw_dict.get("grid_snap_deviation", 30.0)),
            circulation_excess=    float(pw_dict.get("circulation_excess", 150.0)),
            span_violation=        float(pw_dict.get("span_violation", 800.0)),
            beam_headroom_violation=float(pw_dict.get("beam_headroom_violation", 600.0)),
            solar_thermal_penalty= float(pw_dict.get("solar_thermal_penalty", 40.0)),
            fenestration_violation=float(pw_dict.get("fenestration_violation", 200.0)),
            egress_distance_violation=float(pw_dict.get("egress_distance_violation", 1500.0)),
        )

        # Use per-variant seed for BSP diversity
        _SEEDS = {
            "active_first": 1001,
            "sleeping_refuge": 2002,
            "central_circulation": 3003,
            "compact_zones": 4004,
            "linear_flow": 5005,
        }
        seed = _SEEDS.get(config["variant_id"], _random.randint(0, 99999))

        solver = LayoutSolverV2(
            site=site_config,
            constraints=constraints,
            rooms=list(rooms),
            adjacency_edges=adjacency_edges,
            weights=weights,
            max_iterations=200,
            random_seed=seed,
        )
        solver.solve()
        report = solver.get_full_report()
        variant._raw_solver_output = report

        if report and "placements" not in report.get("error", ""):
            variant.placements = solver.best_solution.placements if solver.best_solution else []

        return variant

    def _score_variant(
        self,
        variant: DesignVariant,
    ) -> None:
        """Calculate quality scores from the solver report."""
        report = variant._raw_solver_output or {}

        if not variant.placements and not report:
            variant.score = VariantScore(
                variant_id=variant.variant_id,
                strategy_name=variant.strategy_name,
                strategy_description=variant.strategy_description,
                constraint_violations=["No valid solution generated"],
            )
            return

        placements = variant.placements
        score = VariantScore(
            variant_id=variant.variant_id,
            strategy_name=variant.strategy_name,
            strategy_description=variant.strategy_description,
        )

        # ── Compactness: bounding-box utilisation (higher = more compact) ──
        if placements:
            min_x = min(p.rectangle.x for p in placements)
            min_y = min(p.rectangle.y for p in placements)
            max_x = max(p.rectangle.x + p.rectangle.width for p in placements)
            max_y = max(p.rectangle.y + p.rectangle.height for p in placements)
            bbox_area = max(1.0, (max_x - min_x) * (max_y - min_y))
            room_area = sum(p.rectangle.area for p in placements)
            score.compactness = min(100.0, round((room_area / bbox_area) * 100.0, 1))
        else:
            score.compactness = 0.0

        # ── Zone coherence: ratio of satisfied adjacency constraints from report ──
        constraints_met = report.get("constraints_met_ratio", 0.0)
        score.zone_coherence = round(constraints_met * 100.0, 1)

        # ── Adjacency satisfaction: invert penalty (lower penalty = better) ──
        total_penalty = report.get("total_penalty", 10000.0)
        score.adjacency_satisfaction = round(max(0.0, 100.0 - min(total_penalty / 100.0, 100.0)), 1)

        # ── Circulation efficiency: 1 - corridor_ratio (less corridor = better flow) ──
        circ = report.get("diagnostics", {}).get("circulation", {})
        corridor_ratio = circ.get("corridor_ratio", 0.15)
        score.circulation_efficiency = round(max(0.0, (1.0 - corridor_ratio) * 100.0), 1)

        # ── Usable area ratio ──
        usable_boundary = report.get("usable_boundary", {})
        usable_area = usable_boundary.get("area_sqm", 1.0)
        room_area_total = sum(p.rectangle.area for p in placements) if placements else 0.0
        score.usable_area_ratio = round(min(100.0, (room_area_total / max(1.0, usable_area)) * 100.0), 1)

        # ── Composite: weighted combination ──
        score.composite_score = round(
            score.compactness        * 0.15
            + score.zone_coherence   * 0.20
            + score.adjacency_satisfaction * 0.20
            + score.circulation_efficiency * 0.20
            + score.usable_area_ratio * 0.25,
            1,
        )

        variant.score = score


# =====================================================================
#  VARIANT EXPORT & COMPARISON
# =====================================================================

@dataclass
class VariantComparison:
    """Comparison matrix across all variants."""
    variants: List[DesignVariant]
    comparison_matrix: Dict[str, Dict[str, float]]  # variant_id → metric → value
    best_overall: Optional[DesignVariant] = None
    recommendation: str = ""
    user_guidance: Dict[str, str] = field(default_factory=dict)  # help text per variant


def create_variant_comparison(variants: List[DesignVariant]) -> VariantComparison:
    """Generate comparison UI data."""
    
    comparison = VariantComparison(variants=variants, comparison_matrix={})
    
    for variant in variants:
        if not variant.score:
            continue
        
        comparison.comparison_matrix[variant.variant_id] = {
            "score": variant.score.composite_score,
            "compactness": variant.score.compactness,
            "zone_coherence": variant.score.zone_coherence,
            "adjacency": variant.score.adjacency_satisfaction,
            "flow": variant.score.circulation_efficiency,
        }
    
    if variants:
        best_variant = max(variants, key=lambda v: v.score.composite_score if v.score else 0)
        comparison.best_overall = best_variant
        comparison.recommendation = (
            f"✨ Recommended: '{best_variant.strategy_name}' "
            f"(Best overall design quality for this floor plan)"
        )
        
        # User guidance
        comparison.user_guidance = {
            "active_first": "Choose if you prefer open living & kitchen visibility",
            "sleeping_refuge": "Choose if bedrooms should be quiet & isolated",
            "central_circulation": "Choose for efficient hallway layout",
            "compact_zones": "Choose to minimize overall footprint",
            "linear_flow": "Choose for traditional sequential entry flow",
        }
    
    return comparison
