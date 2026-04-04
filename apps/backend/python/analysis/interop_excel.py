"""Excel/CSV export functionality."""

from __future__ import annotations

from typing import Dict, List
import csv
import io

from .interop_models import Member, Node


class ExcelExporter:
    """Export results to Excel-compatible format."""

    @staticmethod
    def export_nodes(nodes: List[Node]) -> str:
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(["Node ID", "X", "Y", "Z", "Support"])
        for node in nodes:
            writer.writerow([node.id, node.x, node.y, node.z, node.support or ""])
        return output.getvalue()

    @staticmethod
    def export_members(members: List[Member]) -> str:
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(["Member ID", "Start Node", "End Node", "Section", "Material"])
        for member in members:
            writer.writerow([member.id, member.start_node, member.end_node, member.section, member.material])
        return output.getvalue()

    @staticmethod
    def export_results(results: List[Dict]) -> str:
        if not results:
            return ""
        output = io.StringIO()
        writer = csv.DictWriter(output, fieldnames=results[0].keys())
        writer.writeheader()
        writer.writerows(results)
        return output.getvalue()


__all__ = ["ExcelExporter"]
