"""Report data generation helpers."""

from __future__ import annotations

from typing import Dict

from .interop_models import StructuralModel


class ReportDataGenerator:
    """Generate structured data for reports."""

    @staticmethod
    def generate_geometry_summary(model: StructuralModel) -> Dict:
        """Generate geometry summary for reports."""
        return {
            "title": model.title,
            "units": model.units,
            "node_count": len(model.nodes),
            "member_count": len(model.members),
            "load_case_count": len(model.load_cases),
            "x_range": (min(n.x for n in model.nodes), max(n.x for n in model.nodes)),
            "y_range": (min(n.y for n in model.nodes), max(n.y for n in model.nodes)),
            "z_range": (min(n.z for n in model.nodes), max(n.z for n in model.nodes)),
            "support_count": len([n for n in model.nodes if n.support]),
            "sections_used": list(set(m.section for m in model.members)),
        }

    @staticmethod
    def generate_load_summary(model: StructuralModel) -> Dict:
        """Generate load summary for reports."""
        summary = {}

        for lc in model.load_cases:
            nodal = [nl for nl in model.nodal_loads if nl.load_case == lc.name]
            member = [ml for ml in model.member_loads if ml.load_case == lc.name]

            summary[lc.name] = {
                "type": lc.type,
                "factor": lc.factor,
                "nodal_load_count": len(nodal),
                "member_load_count": len(member),
                "total_vertical": sum(nl.Fy for nl in nodal),
            }

        return summary


__all__ = ["ReportDataGenerator"]
