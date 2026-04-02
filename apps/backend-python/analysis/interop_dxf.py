"""DXF file import functionality."""

from __future__ import annotations

from typing import List, Tuple

from .interop_models import Member, Node


class DXFImporter:
    """Import geometry from DXF files (simplified)."""

    def __init__(self):
        self.nodes = []
        self.members = []
        self.node_id_counter = 1
        self.member_id_counter = 1
        self.node_tolerance = 0.001

    def parse(self, content: str) -> Tuple[List[Node], List[Member]]:
        lines = content.split("\n")
        entities = []
        i = 0

        while i < len(lines):
            line = lines[i].strip()
            if line == "LINE":
                x1 = y1 = z1 = 0
                x2 = y2 = z2 = 0
                i += 1
                while i < len(lines) and lines[i].strip() != "0":
                    code = lines[i].strip()
                    i += 1
                    if i >= len(lines):
                        break
                    value = lines[i].strip()
                    try:
                        if code == "10":
                            x1 = float(value)
                        elif code == "20":
                            y1 = float(value)
                        elif code == "30":
                            z1 = float(value)
                        elif code == "11":
                            x2 = float(value)
                        elif code == "21":
                            y2 = float(value)
                        elif code == "31":
                            z2 = float(value)
                    except ValueError:
                        pass
                    i += 1
                entities.append(((x1, y1, z1), (x2, y2, z2)))
                continue
            i += 1

        for start, end in entities:
            start_node = self._get_or_create_node(*start)
            end_node = self._get_or_create_node(*end)
            self.members.append(Member(id=self.member_id_counter, start_node=start_node, end_node=end_node, section="DEFAULT"))
            self.member_id_counter += 1

        return self.nodes, self.members

    def _get_or_create_node(self, x: float, y: float, z: float) -> int:
        for node in self.nodes:
            if abs(node.x - x) < self.node_tolerance and abs(node.y - y) < self.node_tolerance and abs(node.z - z) < self.node_tolerance:
                return node.id

        node = Node(id=self.node_id_counter, x=x, y=y, z=z)
        self.nodes.append(node)
        self.node_id_counter += 1
        return node.id


__all__ = ["DXFImporter"]
