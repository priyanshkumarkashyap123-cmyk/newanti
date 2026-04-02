"""JSON-based model import/export."""

from __future__ import annotations

from dataclasses import asdict
import json

from .interop_models import LoadCase, Member, MemberLoad, NodalLoad, Node, StructuralModel


class JSONModelIO:
    """JSON-based model import/export."""

    @staticmethod
    def export_model(model: StructuralModel) -> str:
        return json.dumps(
            {
                "title": model.title,
                "units": model.units,
                "nodes": [asdict(n) for n in model.nodes],
                "members": [asdict(m) for m in model.members],
                "load_cases": [asdict(lc) for lc in model.load_cases],
                "nodal_loads": [asdict(nl) for nl in model.nodal_loads],
                "member_loads": [asdict(ml) for ml in model.member_loads],
            },
            indent=2,
        )

    @staticmethod
    def import_model(json_str: str) -> StructuralModel:
        data = json.loads(json_str)
        return StructuralModel(
            title=data.get("title", "Imported"),
            units=data.get("units", "SI"),
            nodes=[Node(**n) for n in data.get("nodes", [])],
            members=[Member(**m) for m in data.get("members", [])],
            load_cases=[LoadCase(**lc) for lc in data.get("load_cases", [])],
            nodal_loads=[NodalLoad(**nl) for nl in data.get("nodal_loads", [])],
            member_loads=[MemberLoad(**ml) for ml in data.get("member_loads", [])],
        )


__all__ = ["JSONModelIO"]
