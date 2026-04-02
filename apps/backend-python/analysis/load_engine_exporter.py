"""Load export helpers for LoadEngine."""

from typing import Dict, List

from .load_models import (
    TrapezoidalLoad,
    UniformLoad,
    PointLoadOnMember,
    TemperatureLoad,
    PrestressLoad,
)
from .load_case import LoadCase, LoadCombination


def export_for_solver(
    combinations: Dict[str, LoadCombination],
    load_cases: Dict[str, LoadCase],
    combination_name: str,
    floor_member_loads: Dict[str, List[TrapezoidalLoad]],
) -> Dict:
    """Export all loads for a combination in solver-ready format."""
    combo = combinations.get(combination_name)
    if not combo:
        return {"error": f"Combination '{combination_name}' not found"}

    result = {
        "combination": combination_name,
        "nodal_loads": [],
        "member_loads": [],
        "temperature_loads": [],
        "prestress_loads": [],
    }

    for case_name, factor in combo.factors.items():
        case = load_cases.get(case_name)
        if not case:
            continue

        # Nodal loads
        for nl in case.nodal_loads:
            result["nodal_loads"].append({
                "node_id": nl.node_id,
                "fx": nl.fx * factor,
                "fy": nl.fy * factor,
                "fz": nl.fz * factor,
                "mx": nl.mx * factor,
                "my": nl.my * factor,
                "mz": nl.mz * factor,
            })

        # Member loads
        for ml in case.member_loads:
            if isinstance(ml, TrapezoidalLoad):
                result["member_loads"].append({
                    "type": "trapezoidal",
                    "member_id": ml.member_id,
                    "w1": ml.w1 * factor,
                    "w2": ml.w2 * factor,
                    "start_pos": ml.start_pos,
                    "end_pos": ml.end_pos,
                    "direction": ml.direction.value,
                })
            elif isinstance(ml, UniformLoad):
                result["member_loads"].append({
                    "type": "uniform",
                    "member_id": ml.member_id,
                    "w": ml.w * factor,
                    "start_pos": ml.start_pos,
                    "end_pos": ml.end_pos,
                    "direction": ml.direction.value,
                })
            elif isinstance(ml, PointLoadOnMember):
                result["member_loads"].append({
                    "type": "point",
                    "member_id": ml.member_id,
                    "P": ml.P * factor,
                    "a": ml.a,
                    "direction": ml.direction.value,
                })

        # Add floor loads converted to member loads
        if case_name in floor_member_loads:
            for fl in floor_member_loads[case_name]:
                result["member_loads"].append({
                    "type": "trapezoidal",
                    "member_id": fl.member_id,
                    "w1": fl.w1 * factor,
                    "w2": fl.w2 * factor,
                    "start_pos": fl.start_pos,
                    "end_pos": fl.end_pos,
                    "direction": fl.direction.value,
                })

        # Temperature loads
        for tl in case.temperature_loads:
            result["temperature_loads"].append({
                "member_id": tl.member_id,
                "delta_T": tl.delta_T * factor,
                "alpha": tl.alpha,
                "gradient_T": tl.gradient_T * factor if tl.gradient_T else None,
                "section_depth": tl.section_depth,
            })

        # Prestress loads
        for pl in case.prestress_loads:
            result["prestress_loads"].append({
                "member_id": pl.member_id,
                "P": pl.P * factor,
                "e_start": pl.e_start,
                "e_mid": pl.e_mid,
                "e_end": pl.e_end,
            })

    return result


__all__ = ["export_for_solver"]
