"""
Input summary section builder.
"""

from __future__ import annotations

from typing import Any, Dict, List

from reportlab.lib.units import inch
from reportlab.platypus import Paragraph, Spacer, Table


def build_input_summary(input_data: Dict[str, Any], styles, table_style) -> List:
    story = []

    story.append(Paragraph("1. INPUT SUMMARY", styles['CustomHeading1']))
    story.append(Spacer(1, 12))

    nodes = input_data.get('nodes', [])
    members = input_data.get('members', [])
    loads = input_data.get('loads', [])

    stats_text = f"""
    <b>Model Statistics:</b><br/>
    • Total Nodes: {len(nodes)}<br/>
    • Total Members: {len(members)}<br/>
    • Total Loads: {len(loads)}<br/>
    • Analysis Type: 3D Frame Analysis<br/>
    """

    story.append(Paragraph(stats_text, styles['CustomBody']))
    story.append(Spacer(1, 12))

    if nodes:
        story.append(Paragraph("1.1 Node Coordinates", styles['CustomHeading2']))
        node_data = [['Node ID', 'X (m)', 'Y (m)', 'Z (m)', 'Support']]
        for node in nodes[:20]:
            node_data.append([
                str(node.get('id', '')),
                f"{node.get('x', 0):.3f}",
                f"{node.get('y', 0):.3f}",
                f"{node.get('z', 0):.3f}",
                node.get('support', 'Free')
            ])
        if len(nodes) > 20:
            node_data.append(['...', '...', '...', '...', '...'])

        node_table = Table(node_data, colWidths=[1.2 * inch, 1 * inch, 1 * inch, 1 * inch, 1.5 * inch])
        node_table.setStyle(table_style())
        story.append(node_table)
        story.append(Spacer(1, 12))

    if members:
        story.append(Paragraph("1.2 Members", styles['CustomHeading2']))
        member_data = [['Member ID', 'Start Node', 'End Node', 'Section']]
        for member in members[:30]:
            member_data.append([
                str(member.get('id', '')),
                str(member.get('startNodeId', member.get('start_node_id', ''))),
                str(member.get('endNodeId', member.get('end_node_id', ''))),
                str(member.get('section', '')),
            ])
        if len(members) > 30:
            member_data.append(['...', '...', '...', '...'])

        member_table = Table(member_data, colWidths=[1.2 * inch, 1.2 * inch, 1.2 * inch, 2.0 * inch])
        member_table.setStyle(table_style())
        story.append(member_table)
        story.append(Spacer(1, 12))

    return story