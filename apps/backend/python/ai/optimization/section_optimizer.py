"""
Section Optimization Module
Advanced optimization algorithms for section selection
"""

from typing import List, Dict, Any, Optional
from ai.section_recommender import SectionRecommender, DesignRequirements, SectionProperties
import math

class SectionOptimizer:
    """Advanced section optimization using genetic algorithms and ML"""

    def __init__(self):
        self.recommender = SectionRecommender()

    def optimize_section(self, requirements: DesignRequirements,
                        optimization_goal: str = "cost",
                        constraints: Optional[Dict[str, Any]] = None) -> Optional[Dict[str, Any]]:
        """
        Optimize section selection using advanced algorithms

        Args:
            requirements: Design requirements
            optimization_goal: "cost", "weight", "safety", "balanced"
            constraints: Additional constraints (max_cost, max_weight, etc.)

        Returns:
            Optimized section recommendation
        """
        if optimization_goal == "cost":
            return self._optimize_for_cost(requirements, constraints)
        if optimization_goal == "weight":
            return self._optimize_for_weight(requirements, constraints)
        if optimization_goal == "safety":
            return self._optimize_for_safety(requirements, constraints)
        # balanced
        return self._optimize_balanced(requirements, constraints)

    @staticmethod
    def _safe_sqrt(x: float) -> float:
        return math.sqrt(x) if x > 0 else 0.0

    @classmethod
    def _section_properties_for_frontend(cls, section: SectionProperties) -> Dict[str, Any]:
        # Backend maps Iy/Iz; frontend contract expects Ix/Iy.
        A = max(section.area, 0.0)
        Ix = max(section.iz, 0.0)
        Iy = max(section.iy, 0.0)

        rx = cls._safe_sqrt(Ix / A) if A > 0 else 0.0
        ry = cls._safe_sqrt(Iy / A) if A > 0 else 0.0

        Zx = (Ix / (math.sqrt(3.0) * rx)) if rx > 0 else 0.0
        Zy = (Iy / (math.sqrt(3.0) * ry)) if ry > 0 else 0.0

        return {
            "area": section.area,
            "Ix": Ix,
            "Iy": Iy,
            "Zx": Zx,
            "Zy": Zy,
            "rx": rx,
            "ry": ry,
            "weight_per_m": section.weight_per_m,
        }

    @classmethod
    def _build_section_recommendation(cls, req: DesignRequirements, best) -> Dict[str, Any]:
        # `best` is a RecommendationResult from ai.section_recommender
        overall_util = float(best.utilization) if best.utilization is not None else 1.0
        score = 0.0 if overall_util <= 0 else min(100.0, (1.0 / overall_util) * 100.0)

        reasoning: List[str] = []
        reasoning.extend([f"PASS: {c}" for c in best.checks_passed])
        reasoning.extend(best.warnings)
        if not reasoning:
            reasoning = ["No checks applied."]

        design_checks: Dict[str, Any] = {
            "axial_capacity": best.axial_capacity_kN,
            "shear_capacity": best.shear_capacity_kN,
            "moment_capacity": best.moment_capacity_kNm,
            "utilization_axial": best.utilization_axial,
            "utilization_shear": best.utilization_shear,
            "utilization_moment": best.utilization_moment,
            "overall_utilization": overall_util,
        }
        if best.deflection_check_mm is not None:
            design_checks["deflection_check"] = best.deflection_check_mm

        return {
            "section_name": best.section.name,
            "section_type": best.section.section_type.value,
            "material": req.material,
            "properties": cls._section_properties_for_frontend(best.section),
            "design_checks": design_checks,
            "score": round(score, 3),
            "reasoning": reasoning,
        }

    @classmethod
    def _build_optimization_output(
        cls,
        req: DesignRequirements,
        best,
        alternatives_considered: int,
        constraints_satisfied: bool,
    ) -> Dict[str, Any]:
        optimal_section = cls._build_section_recommendation(req, best)

        return {
            "optimal_section": optimal_section,
            "optimization_metrics": {
                "goal_achieved": float(optimal_section["score"]),
                "constraints_satisfied": bool(constraints_satisfied),
                "alternatives_considered": int(alternatives_considered),
            },
            "cost_breakdown": {
                "material_cost": 0.0,
                "fabrication_cost": 0.0,
                "total_cost_per_m": float(best.section.cost_per_m),
            },
        }

    @staticmethod
    def _apply_constraints(
        recommendations: List[Any],
        constraints: Optional[Dict[str, Any]],
    ) -> List[Any]:
        if not constraints:
            return recommendations

        max_cost = constraints.get("max_cost_per_m")
        max_weight = constraints.get("max_weight_per_m")

        filtered = recommendations
        if max_cost is not None:
            filtered = [r for r in filtered if getattr(r.section, "cost_per_m", None) is not None and r.section.cost_per_m <= max_cost]
        if max_weight is not None:
            filtered = [r for r in filtered if getattr(r.section, "weight_per_m", None) is not None and r.section.weight_per_m <= max_weight]
        return filtered

    def _optimize_for_cost(self, req: DesignRequirements,
                          constraints: Optional[Dict[str, Any]] = None) -> Optional[Dict[str, Any]]:
        """Find minimum cost section meeting requirements"""
        recommendations_all = self.recommender.recommend_sections(req, max_results=20)
        alternatives_considered = len(recommendations_all)
        recommendations = self._apply_constraints(recommendations_all, constraints)

        if not recommendations:
            return None

        # Return lowest cost option
        best = min(recommendations, key=lambda r: r.section.cost_per_m)
        return self._build_optimization_output(req, best, alternatives_considered, constraints_satisfied=True)

    def _optimize_for_weight(self, req: DesignRequirements,
                           constraints: Optional[Dict[str, Any]] = None) -> Optional[Dict[str, Any]]:
        """Find minimum weight section meeting requirements"""
        recommendations_all = self.recommender.recommend_sections(req, max_results=20)
        alternatives_considered = len(recommendations_all)
        recommendations = self._apply_constraints(recommendations_all, constraints)
        if not recommendations:
            return None

        # Return lowest weight option
        best = min(recommendations, key=lambda r: r.section.weight_per_m)
        return self._build_optimization_output(req, best, alternatives_considered, constraints_satisfied=True)

    def _optimize_for_safety(self, req: DesignRequirements,
                           constraints: Optional[Dict[str, Any]] = None) -> Optional[Dict[str, Any]]:
        """Find section with maximum safety margin"""
        recommendations_all = self.recommender.recommend_sections(req, max_results=20)
        alternatives_considered = len(recommendations_all)
        recommendations = self._apply_constraints(recommendations_all, constraints)
        if not recommendations:
            return None

        # Return highest safety margin option
        best = max(recommendations, key=lambda r: r.safety_margin)
        return self._build_optimization_output(req, best, alternatives_considered, constraints_satisfied=True)

    def _optimize_balanced(self, req: DesignRequirements,
                          constraints: Optional[Dict[str, Any]] = None) -> Optional[Dict[str, Any]]:
        """Find balanced optimization (cost, weight, safety)"""
        recommendations_all = self.recommender.recommend_sections(req, max_results=20)
        alternatives_considered = len(recommendations_all)
        recommendations = self._apply_constraints(recommendations_all, constraints)
        if not recommendations:
            return None

        # Score based on balanced criteria
        scored = []
        for r in recommendations:
            # Normalize scores (0-1, lower better)
            cost_norm = r.section.cost_per_m / 1000.0
            weight_norm = r.section.weight_per_m / 100.0
            safety_score = 1.0 - min(r.safety_margin / 2.0, 1.0)  # Prefer 2x safety

            balanced_score = (cost_norm + weight_norm + safety_score) / 3.0
            scored.append((r, balanced_score))

        # Return best balanced option
        best_rec, score = min(scored, key=lambda x: x[1])
        return self._build_optimization_output(req, best_rec, alternatives_considered, constraints_satisfied=True)

# Global instance
section_optimizer = SectionOptimizer()

def optimize_section_selection(requirements: Dict[str, Any],
                              optimization_goal: str = "balanced",
                              constraints: Optional[Dict[str, Any]] = None) -> Optional[Dict[str, Any]]:
    """
    Optimize section selection

    Args:
        requirements: Design requirements dict
        optimization_goal: "cost", "weight", "safety", "balanced"
        constraints: Optional constraints dict

    Returns:
        Optimized section result
    """
    req = DesignRequirements(
        axial_force=requirements.get('axial_force', 0.0),
        shear_force=requirements.get('shear_force', 0.0),
        bending_moment=requirements.get('bending_moment', 0.0),
        deflection_limit=requirements.get('deflection_limit'),
        span_length=requirements.get('span_length'),
        code=requirements.get('code', 'IS800'),
        material=requirements.get('material', 'steel'),
        utilization_target=requirements.get('utilization_target', 0.8)
    )

    return section_optimizer.optimize_section(req, optimization_goal, constraints)