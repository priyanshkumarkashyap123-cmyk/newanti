"""
Concrete design section builder.
"""

from __future__ import annotations

from typing import Any, Dict, List

from reportlab.platypus import Paragraph, Spacer, Table, TableStyle
from reportlab.lib import colors


def build_concrete_design(concrete_design: Dict[str, Any], styles, add_dict_as_table) -> List:
    story = []

    story.append(Paragraph("4. CONCRETE DESIGN (RC LSD)", styles['CustomHeading1']))
    story.append(Spacer(1, 12))

    if not concrete_design:
        story.append(Paragraph("No concrete design data provided.", styles['CustomBody']))
        story.append(Spacer(1, 12))
        return story

    rebar_summary = concrete_design.get('rebar_summary', '')
    design_status = concrete_design.get('design_status', '')
    design_ratio = concrete_design.get('design_ratio', '')

    beam = concrete_design.get('beam_section', {})
    concrete = concrete_design.get('concrete', {})
    rebar = concrete_design.get('rebar', {})
    bending = concrete_design.get('bending', {})
    shear = concrete_design.get('shear', {})

    summary_rows = [
        ['Summary', 'Value'],
        ['Rebar Layout', rebar_summary or '—'],
        ['Design Status', design_status or '—'],
        ['Design Ratio', f"{design_ratio:.3f}" if isinstance(design_ratio, (int, float)) else str(design_ratio)],
    ]
    summary_table = Table(summary_rows, hAlign='LEFT')
    summary_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.lightgrey),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
        ('ALIGN', (1, 1), (-1, -1), 'RIGHT'),
    ]))
    story.append(summary_table)
    story.append(Spacer(1, 10))

    story.extend(add_dict_as_table("Beam Section", beam))
    story.extend(add_dict_as_table("Concrete", concrete))
    story.extend(add_dict_as_table("Rebar", rebar))
    story.extend(add_dict_as_table("Bending Design", bending))
    story.extend(add_dict_as_table("Shear Design", shear))

    story.append(Spacer(1, 12))

    return story