"""OpenBeam REST API adapter."""

from __future__ import annotations

from typing import Dict

from .interop_models import LoadCase, Member, Node, StructuralModel


class OpenBeamAPI:
    """Wrapper for OpenBeam REST API integration."""

    def __init__(self, base_url: str = "http://localhost:8080"):
        self.base_url = base_url

    def model_to_openbeam(self, model: StructuralModel) -> Dict:
        """Convert StructuralModel to OpenBeam format."""
        openbeam_model = {
            "nodes": {},
            "elements": {},
            "constraints": [],
            "loads": [],
        }

        for node in model.nodes:
            openbeam_model["nodes"][str(node.id)] = {"coordinates": [node.x, node.y, node.z]}

            if node.support:
                constraint = {"node": str(node.id)}
                if node.support == "FIXED":
                    constraint["dofs"] = [True, True, True, True, True, True]
                elif node.support == "PINNED":
                    constraint["dofs"] = [True, True, True, False, False, False]
                openbeam_model["constraints"].append(constraint)

        for member in model.members:
            openbeam_model["elements"][str(member.id)] = {
                "nodes": [str(member.start_node), str(member.end_node)],
                "section": member.section,
                "material": member.material,
            }

        for nl in model.nodal_loads:
            openbeam_model["loads"].append(
                {
                    "type": "nodal",
                    "node": str(nl.node_id),
                    "case": nl.load_case,
                    "values": [nl.Fx, nl.Fy, nl.Fz, nl.Mx, nl.My, nl.Mz],
                }
            )

        for ml in model.member_loads:
            openbeam_model["loads"].append(
                {
                    "type": "member",
                    "element": str(ml.member_id),
                    "case": ml.load_case,
                    "load_type": ml.load_type,
                    "direction": ml.direction,
                    "values": ml.values,
                }
            )

        return openbeam_model

    def openbeam_to_model(self, openbeam_data: Dict) -> StructuralModel:
        """Convert OpenBeam format to StructuralModel."""
        nodes = []
        members = []
        nodal_loads = []
        member_loads = []

        for node_id, node_data in openbeam_data.get("nodes", {}).items():
            coords = node_data.get("coordinates", [0, 0, 0])
            nodes.append(Node(id=int(node_id), x=coords[0], y=coords[1] if len(coords) > 1 else 0, z=coords[2] if len(coords) > 2 else 0))

        for elem_id, elem_data in openbeam_data.get("elements", {}).items():
            node_ids = elem_data.get("nodes", [])
            members.append(
                Member(
                    id=int(elem_id),
                    start_node=int(node_ids[0]) if node_ids else 0,
                    end_node=int(node_ids[1]) if len(node_ids) > 1 else 0,
                    section=elem_data.get("section", "DEFAULT"),
                    material=elem_data.get("material", "Steel"),
                )
            )

        for constraint in openbeam_data.get("constraints", []):
            node_id = int(constraint.get("node", 0))
            for node in nodes:
                if node.id == node_id:
                    dofs = constraint.get("dofs", [])
                    if all(dofs):
                        node.support = "FIXED"
                    elif dofs[:3] == [True, True, True]:
                        node.support = "PINNED"

        return StructuralModel(
            title="OpenBeam Import",
            nodes=nodes,
            members=members,
            load_cases=[LoadCase(name="LC1", type="DEAD")],
            nodal_loads=nodal_loads,
            member_loads=member_loads,
        )


__all__ = ["OpenBeamAPI"]
