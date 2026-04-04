"""
Design checks section builder.
"""

from __future__ import annotations

from typing import Any, Dict, List

from reportlab.lib.units import inch
from reportlab.platypus import Paragraph, Spacer, Table

from analysis.report.hooks.design_checks_hook import (
    build_design_checks_view,
    normalize_design_check_row,
)
from analysis.report_generator_common import safe_float


def build_design_checks(design_checks: Dict[str, Any], styles, table_style, critical_table_style) -> List:
    story = []

    members = design_checks.get('members', []) if isinstance(design_checks, dict) else []
    if not members:
        return story

    story.append(Paragraph(f"3. DESIGN CHECKS ({design_code})", styles['CustomHeading1']))
    story.append(Spacer(1, 12))

    design_code, governing_rows, critical_rows = build_design_checks_view(
        design_checks,
        members,
        max_rows=8,
    )

    table_data = [['Member', 'Section', 'Clause', 'UR', 'Reserve']]
    table_data.extend(governing_rows)

    if len(table_data) > 1:
        check_table = Table(table_data, colWidths=[1.0 * inch, 1.5 * inch, 1.5 * inch, 0.8 * inch, 0.8 * inch])
        check_table.setStyle(table_style())
        story.append(check_table)
        story.append(Spacer(1, 12))

    if critical_rows:
        story.append(Paragraph("3.1 Governing / Critical Members", styles['CustomHeading2']))
        critical_table = Table(
            [['Member', 'Section', 'Clause', 'UR', 'Reserve']] + critical_rows,
            colWidths=[1.0 * inch, 1.5 * inch, 1.5 * inch, 0.8 * inch, 0.8 * inch]
        )
        critical_table.setStyle(critical_table_style())
        story.append(critical_table)
        story.append(Spacer(1, 12))

    return story