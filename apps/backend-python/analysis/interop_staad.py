"""STAAD.Pro import/export functionality."""

from __future__ import annotations

from typing import List

from .interop_models import LoadCase, Member, MemberLoad, NodalLoad, Node, StructuralModel


class STAADImporter:
    """Import STAAD.Pro input files (.std)."""

    def __init__(self):
        self.model = None
        self.current_load_case = None

    def parse(self, content: str) -> StructuralModel:
        """Parse STAAD input file content."""
        lines = content.strip().split("\n")

        nodes = []
        members = []
        load_cases = []
        nodal_loads = []
        member_loads = []
        title = "Imported Model"

        i = 0
        while i < len(lines):
            line = lines[i].strip().upper()

            if line.startswith("STAAD"):
                title = line
            elif "JOINT COORDINATES" in line:
                i += 1
                while i < len(lines) and not lines[i].strip().upper().startswith(("MEMBER", "END", "CONSTANTS")):
                    parts = lines[i].strip().split()
                    if len(parts) >= 4 and parts[0].isdigit():
                        nodes.append(Node(id=int(parts[0]), x=float(parts[1]), y=float(parts[2]), z=float(parts[3]) if len(parts) > 3 else 0))
                    i += 1
                continue
            elif "MEMBER INCIDENCES" in line:
                i += 1
                while i < len(lines) and not lines[i].strip().upper().startswith(("MEMBER PROPERTY", "CONSTANTS", "SUPPORTS", "LOAD")):
                    parts = lines[i].strip().split()
                    if len(parts) >= 3 and parts[0].isdigit():
                        members.append(Member(id=int(parts[0]), start_node=int(parts[1]), end_node=int(parts[2]), section="DEFAULT"))
                    i += 1
                continue
            elif line.startswith("SUPPORTS"):
                i += 1
                while i < len(lines) and not lines[i].strip().upper().startswith(("LOAD", "MEMBER", "PERFORM")):
                    parts = lines[i].strip().split()
                    if len(parts) >= 2:
                        node_ids = self._parse_node_list(parts[0])
                        support_type = parts[1] if len(parts) > 1 else "FIXED"
                        for node_id in node_ids:
                            for node in nodes:
                                if node.id == node_id:
                                    node.support = support_type
                    i += 1
                continue
            elif line.startswith("LOAD") and "LOADTYPE" in line:
                parts = line.split()
                case_num = parts[1] if len(parts) > 1 else "1"
                case_name = f"LC{case_num}"
                load_cases.append(LoadCase(name=case_name, type="DEAD"))
                self.current_load_case = case_name
            elif "JOINT LOAD" in line:
                i += 1
                while i < len(lines):
                    jl = lines[i].strip()
                    if jl.upper().startswith(("MEMBER LOAD", "LOAD", "PERFORM", "FINISH")):
                        break
                    parts = jl.split()
                    if len(parts) >= 3 and parts[0].isdigit():
                        node_id = int(parts[0])
                        fx = fy = fz = mx = my = mz = 0
                        j = 1
                        while j < len(parts) - 1:
                            direction = parts[j].upper()
                            value = float(parts[j + 1])
                            if direction == "FX":
                                fx = value
                            elif direction == "FY":
                                fy = value
                            elif direction == "FZ":
                                fz = value
                            j += 2
                        nodal_loads.append(NodalLoad(node_id=node_id, load_case=self.current_load_case or "LC1", Fx=fx, Fy=fy, Fz=fz))
                    i += 1
                continue
            elif "MEMBER LOAD" in line:
                i += 1
                while i < len(lines):
                    ml = lines[i].strip()
                    if ml.upper().startswith(("JOINT LOAD", "LOAD", "PERFORM", "FINISH")):
                        break
                    parts = ml.split()
                    if len(parts) >= 3:
                        member_ids = self._parse_member_list(parts[0])
                        load_type = "UDL"
                        direction = "GY"
                        values = []

                        for part in parts[1:]:
                            if part.upper() in ["UNI", "UDL"]:
                                load_type = "UDL"
                            elif part.upper() == "CON":
                                load_type = "POINT"
                            elif part.upper() in ["GX", "GY", "GZ", "LX", "LY", "LZ"]:
                                direction = part.upper()
                            else:
                                try:
                                    values.append(float(part))
                                except ValueError:
                                    pass

                        for member_id in member_ids:
                            member_loads.append(MemberLoad(member_id=member_id, load_case=self.current_load_case or "LC1", load_type=load_type, direction=direction, values=values))
                    i += 1
                continue

            i += 1

        if not load_cases:
            load_cases.append(LoadCase(name="LC1", type="DEAD"))

        self.model = StructuralModel(title=title, nodes=nodes, members=members, load_cases=load_cases, nodal_loads=nodal_loads, member_loads=member_loads)
        return self.model

    def _parse_node_list(self, s: str) -> List[int]:
        result = []
        if "TO" in s.upper():
            parts = s.upper().split("TO")
            start = int(parts[0].strip())
            end = int(parts[1].strip())
            result = list(range(start, end + 1))
        else:
            for part in s.split():
                if part.isdigit():
                    result.append(int(part))
        return result

    def _parse_member_list(self, s: str) -> List[int]:
        return self._parse_node_list(s)


class STAADExporter:
    """Export model data to STAAD.Pro input format."""

    def export(self, model: StructuralModel) -> str:
        lines = [
            "STAAD SPACE",
            f"* {model.title}",
            "START JOB INFORMATION",
            "END JOB INFORMATION",
            "INPUT WIDTH 79",
            f"UNIT {'METER KN' if model.units == 'SI' else 'FEET KIP'}",
            "",
        ]

        lines.append("JOINT COORDINATES")
        for node in model.nodes:
            lines.append(f"{node.id} {node.x:.4f} {node.y:.4f} {node.z:.4f}")
        lines.append("")

        lines.append("MEMBER INCIDENCES")
        for member in model.members:
            lines.append(f"{member.id} {member.start_node} {member.end_node}")
        lines.append("")

        lines.append("MEMBER PROPERTY AMERICAN")
        sections = set(m.section for m in model.members)
        for section in sections:
            member_ids = [m.id for m in model.members if m.section == section]
            lines.append(f"{' '.join(map(str, member_ids))} PRIS YD 0.3 ZD 0.3")
        lines.append("")

        lines.append("CONSTANTS")
        lines.append("E 2.1e8 ALL")
        lines.append("POISSON 0.3 ALL")
        lines.append("DENSITY 78.5 ALL")
        lines.append("")

        lines.append("SUPPORTS")
        supported_nodes = [n for n in model.nodes if n.support]
        for node in supported_nodes:
            lines.append(f"{node.id} {node.support or 'FIXED'}")
        lines.append("")

        for lc in model.load_cases:
            lines.append(f"LOAD {lc.name} LOADTYPE {lc.type}")
            lines.append("SELFWEIGHT Y -1.0")

            case_nodal = [nl for nl in model.nodal_loads if nl.load_case == lc.name]
            if case_nodal:
                lines.append("JOINT LOAD")
                for nl in case_nodal:
                    load_str = f"{nl.node_id}"
                    if nl.Fx != 0:
                        load_str += f" FX {nl.Fx}"
                    if nl.Fy != 0:
                        load_str += f" FY {nl.Fy}"
                    if nl.Fz != 0:
                        load_str += f" FZ {nl.Fz}"
                    lines.append(load_str)

            case_member = [ml for ml in model.member_loads if ml.load_case == lc.name]
            if case_member:
                lines.append("MEMBER LOAD")
                for ml in case_member:
                    if ml.load_type == "UDL":
                        lines.append(f"{ml.member_id} UNI {ml.direction} {ml.values[0] if ml.values else -10}")
                    elif ml.load_type == "POINT":
                        lines.append(f"{ml.member_id} CON {ml.direction} {ml.values[0] if ml.values else -10}")

            lines.append("")

        lines.append("PERFORM ANALYSIS PRINT STATICS CHECK")
        lines.append("FINISH")
        return "\n".join(lines)


__all__ = ["STAADImporter", "STAADExporter"]
