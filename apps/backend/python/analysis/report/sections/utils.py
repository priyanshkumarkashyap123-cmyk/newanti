"""
Section helper utilities.
"""

from __future__ import annotations

from typing import Any, Dict, List

from reportlab.platypus import Paragraph, Spacer, Table, TableStyle
from reportlab.lib import colors


def add_dict_as_table(title: str, data: Dict[str, Any], styles) -> List:
    story = []
    story.append(Paragraph(title, styles['CustomHeading2']))
    story.append(Spacer(1, 4))
    if not data:
        story.append(Paragraph("No data.", styles['CustomBody']))
        story.append(Spacer(1, 6))
        return story

    rows = [['Field', 'Value']]
    for k, v in data.items():
        rows.append([str(k), str(v)])
    table = Table(rows, hAlign='LEFT')
    table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.whitesmoke),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
        ('ALIGN', (1, 1), (-1, -1), 'LEFT'),
    ]))
    story.append(table)
    story.append(Spacer(1, 8))
    return story