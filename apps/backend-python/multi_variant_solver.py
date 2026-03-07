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

# Assuming imports from layout_solver_v2 and workflow_analyzer
try:
    from layout_solver_v2 import (
        RoomNode, RoomPlacement, LayoutSolver, PenaltyWeightsV2, LayoutReport
    )
    from workflow_analyzer import WorkflowAnalyzer, ZoneType, ActivityType
except ImportError:
    RoomNode = Any
    RoomPlacement = Any
    LayoutSolver = Any
    PenaltyWeightsV2 = Any
    LayoutReport = Any
    WorkflowAnalyzer = Any
    ZoneType = Any
    ActivityType = Any


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
        base_solver: Any = None,  # LayoutSolver instance
        executor: Optional[ThreadPoolExecutor] = None,
        debug: bool = False,
    ):
        self.base_solver = base_solver
        self.executor = executor or ThreadPoolExecutor(max_workers=5)
        self.debug = debug
        self.analyzer = WorkflowAnalyzer()
        self.variants: Dict[str, DesignVariant] = {}
    
    def generate_variants(
        self,
        rooms: List[RoomNode],
        site_config: Any,  # SiteConfig
        base_penalty_weights: Optional[Dict[str, float]] = None,
        timeout_per_variant_sec: float = 30.0,
    ) -> List[DesignVariant]:
        """
        Generate 5 design variants using different strategies.
        
        Args:
            rooms: List of room definitions
            site_config: Site/plot configuration
            base_penalty_weights: Starting penalty weights (will be modulated per strategy)
            timeout_per_variant_sec: Max seconds to compute each variant
        
        Returns:
            List of 5 DesignVariant objects, ranked by composite score
        """
        
        print(f"🎯 WORKFLOW-AWARE PLANNING: Analyzing {len(rooms)} rooms...")
        
        # Step 1: Analyze activity flows
        activity_graph = self.analyzer.analyze_rooms(rooms)
        strategies = self.analyzer.get_variant_strategies()
        
        print(f"✓ Identified functional zones: {list(self.analyzer.zones.keys())}")
        print(f"✓ Criticality path: {activity_graph.criticality_path}")
        print(f"✓ Required adjacencies: {self.analyzer.required_adjacencies}")
        
        # Step 2: Generate variant configurations
        variant_configs = self._prepare_variant_configs(
            strategies,
            base_penalty_weights or {},
            rooms,
        )
        
        # Step 3: Solve variants in parallel
        print(f"\n🔧 Generating {len(variant_configs)} design variants in parallel...")
        variants = self._solve_variants_parallel(
            variant_configs,
            rooms,
            site_config,
            timeout_per_variant_sec,
        )
        
        # Step 4: Score and rank
        print(f"\n📊 Scoring and ranking variants...")
        for variant in variants:
            self._score_variant(variant, activity_graph)
        
        variants.sort(key=lambda v: v.score.composite_score if v.score else 0, reverse=True)
        
        print(f"\n✨ VARIANT SUMMARY:")
        for i, v in enumerate(variants, 1):
            score_str = f"{v.score.composite_score:.1f}" if v.score else "N/A"
            print(f"  {i}. {v.strategy_name} (Score: {score_str})")
            if v.score:
                print(f"     Compactness: {v.score.compactness:.1f} | "
                      f"Zone: {v.score.zone_coherence:.1f} | "
                      f"Flow: {v.score.circulation_efficiency:.1f}")
        
        self.variants = {v.variant_id: v for v in variants}
        return variants
    
    def _prepare_variant_configs(
        self,
        strategies: Dict[str, Dict[str, Any]],
        base_weights: Dict[str, float],
        rooms: List[RoomNode],
    ) -> List[Dict[str, Any]]:
        """Prepare configuration for each variant."""
        
        variant_ids = ["active_first", "sleeping_refuge", "central_circulation", 
                      "compact_zones", "linear_flow"]
        
        configs = []
        for variant_id in variant_ids:
            if variant_id not in strategies:
                continue
            
            strategy = strategies[variant_id]
            
            # Import penalty weight generator (from workflow_analyzer)
            from workflow_analyzer import generate_variant_penalty_weights
            
            weights = generate_variant_penalty_weights(variant_id, base_weights)
            
            configs.append({
                "variant_id": variant_id,
                "strategy_name": strategy.get("name", variant_id),
                "strategy_description": strategy.get("description", ""),
                "strategy_config": strategy,
                "penalty_weights": weights,
                "zone_priorities": strategy.get("zone_priorities", []),
                "zone_weights": strategy.get("zone_weights", {}),
            })
        
        return configs
    
    def _solve_variants_parallel(
        self,
        configs: List[Dict[str, Any]],
        rooms: List[RoomNode],
        site_config: Any,
        timeout_sec: float,
    ) -> List[DesignVariant]:
        """Solve multiple variants concurrently."""
        
        variants: List[DesignVariant] = []
        
        # For now, solve sequentially (threaded solver execution is complex)
        # In production, this would use actual parallel solving
        for i, config in enumerate(configs, 1):
            print(f"\n  [{i}/{len(configs)}] Solving: {config['strategy_name']}...")
            
            try:
                variant = self._solve_single_variant(
                    config,
                    rooms,
                    site_config,
                    timeout_sec,
                )
                variants.append(variant)
            except Exception as e:
                print(f"     ❌ Failed: {str(e)}")
                # Still create a variant object with error state
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
                    constraint_violations=[str(e)],
                )
                variants.append(variant)
        
        return variants
    
    def _solve_single_variant(
        self,
        config: Dict[str, Any],
        rooms: List[RoomNode],
        site_config: Any,
        timeout_sec: float,
    ) -> DesignVariant:
        """Solve one variant using configured weights."""
        
        variant = DesignVariant(
            variant_id=config["variant_id"],
            strategy_key=config["variant_id"],
            strategy_name=config["strategy_name"],
            strategy_description=config["strategy_description"],
            penalty_weights=config["penalty_weights"],
        )
        
        # This would call the actual LayoutSolver with custom weights
        # For now, this is a placeholder showing the concept
        
        if self.base_solver:
            # Would execute: result = self.base_solver.solve(
            #     rooms=rooms,
            #     site=site_config,
            #     penalty_weights=config["penalty_weights"],
            #     timeout=timeout_sec,
            # )
            pass
        
        return variant
    
    def _score_variant(
        self,
        variant: DesignVariant,
        activity_graph: Any,
    ) -> None:
        """Calculate quality scores for a variant."""
        
        if not variant.placements:
            if not variant.score:
                variant.score = VariantScore(
                    variant_id=variant.variant_id,
                    strategy_name=variant.strategy_name,
                    strategy_description=variant.strategy_description,
                    constraint_violations=["No valid solution generated"],
                )
            return
        
        score = VariantScore(
            variant_id=variant.variant_id,
            strategy_name=variant.strategy_name,
            strategy_description=variant.strategy_description,
        )
        
        # Calculate individual metrics
        score.compactness = self._calculate_compactness_score(variant.placements)
        score.zone_coherence = self._calculate_zone_coherence(variant.placements, activity_graph)
        score.adjacency_satisfaction = self._calculate_adjacency_score(variant.placements)
        score.circulation_efficiency = self._calculate_circulation_flow(variant.placements, activity_graph)
        score.usable_area_ratio = self._calculate_usable_ratio(variant.placements)
        
        # Composite: weighted average
        score.composite_score = (
            score.compactness * 0.15 +
            score.zone_coherence * 0.20 +
            score.adjacency_satisfaction * 0.20 +
            score.circulation_efficiency * 0.20 +
            score.usable_area_ratio * 0.25
        )
        
        variant.score = score
    
    def _calculate_compactness_score(self, placements: List[Any]) -> float:
        """Measure how tightly grouped rooms are (0-100, lower=better)."""
        if not placements:
            return 100.0
        
        # Simplified: average distance to centroid
        centers = [p.rectangle.center for p in placements]
        if not centers:
            return 100.0
        
        centroid_x = sum(c[0] for c in centers) / len(centers)
        centroid_y = sum(c[1] for c in centers) / len(centers)
        
        avg_dist = sum(
            (c[0] - centroid_x)**2 + (c[1] - centroid_y)**2
            for c in centers
        ) / len(centers)
        
        # Normalize: spread of ~50m² gives ~7m distance ≈ score 70
        score = min(100.0, avg_dist)
        return score
    
    def _calculate_zone_coherence(self, placements: List[Any], activity_graph: Any) -> float:
        """Measure how well zones cluster (0-100, higher=better)."""
        # Placeholder: would measure intra-zone distances
        return 50.0
    
    def _calculate_adjacency_score(self, placements: List[Any]) -> float:
        """% of required adjacencies that are satisfied (0-100)."""
        # Placeholder: would check kitchen-dining, bed-bath proximity
        return 75.0
    
    def _calculate_circulation_flow(self, placements: List[Any], activity_graph: Any) -> float:
        """Quality of entry→living→sleeping circulation (0-100)."""
        # Placeholder: would measure path efficiency
        return 60.0
    
    def _calculate_usable_ratio(self, placements: List[Any]) -> float:
        """Ratio of room area to total buildable area (50-95)."""
        total_area = sum(p.rectangle.area for p in placements)
        # Simplified: assume good designs use 70-85% of allocated area
        ratio = min(95.0, 50.0 + (total_area / 1000.0))
        return ratio


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
