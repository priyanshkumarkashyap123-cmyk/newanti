"""
Load cases and combinations section builder.
"""

from __future__ import annotations

from typing import Any, Dict, List

from reportlab.lib.units import inch
from reportlab.platypus import Paragraph, Spacer, Table


def build_load_data(analysis_data: Dict[str, Any], styles, table_style) -> List:
    story = []

    story.append(Paragraph("2. LOADS & COMBINATIONS", styles['CustomHeading1']))
    story.append(Spacer(1, 12))

    input_data = analysis_data.get('input', {})
    raw_loads = input_data.get('loads', [])
    load_cases = analysis_data.get('load_cases', analysis_data.get('loadCases', []))
    load_combinations = analysis_data.get('load_combinations', analysis_data.get('loadCombinations', []))

    derived_case_count = 1 if raw_loads else 0
    case_count = len(load_cases) if isinstance(load_cases, list) else derived_case_count
    combination_count = len(load_combinations) if isinstance(load_combinations, list) else 0

    overview_text = (
        "<b>Load Methodology Overview:</b><br/>"
        "This analysis applies individual load cases (e.g., Dead Load, Live Load, Wind, Seismic) "
        "and their factored combinations per the governing code. Each member capacity check evaluates "
        "the most critical combination, and governing checks are identified by highest utilization ratio."
    )
    story.append(Paragraph(overview_text, styles['CustomBody']))
    story.append(Spacer(1, 8))

    story.append(Paragraph(
        (
            f"<b>Load Summary:</b><br/>"
            f"• Load Cases: {case_count}<br/>"
            f"• Load Combinations: {combination_count}<br/>"
            f"• Raw Load Entries: {len(raw_loads) if isinstance(raw_loads, list) else 0}<br/>"
            "• Units: Force = kN, Moment = kN·m"
        ),
        styles['CustomBody']
    ))
    story.append(Spacer(1, 12))

    if isinstance(load_cases, list) and load_cases:
        story.append(Paragraph("2.1 Load Cases", styles['CustomHeading2']))
        story.append(Paragraph(
            "Individual load cases are applied to the model independently and contribute to design load combinations.",
            styles['CustomBody']
        ))
        story.append(Spacer(1, 8))
        lc_rows = [['ID', 'Name', 'Type', 'Category']]
        for case in load_cases[:20]:
            if isinstance(case, dict):
                lc_rows.append([
                    str(case.get('id', '')),
                    str(case.get('name', case.get('title', ''))),
                    str(case.get('type', case.get('category', ''))),
                    str(case.get('category', case.get('subtype', 'Standard'))),
                ])

        if len(lc_rows) > 1:
            lc_table = Table(lc_rows, colWidths=[1.0 * inch, 2.0 * inch, 1.5 * inch, 1.5 * inch])
            lc_table.setStyle(table_style())
            story.append(lc_table)
            story.append(Spacer(1, 12))

    if isinstance(load_combinations, list) and load_combinations:
        story.append(Paragraph("2.2 Load Combinations", styles['CustomHeading2']))
        story.append(Paragraph(
            "Factored load combinations per IS 875-Part 5 (LSM) or equivalent code. "
            "Each combination is evaluated for member strength checks; the combination producing "
            "the highest utilization ratio governs the design.",
            styles['CustomBody']
        ))
        story.append(Spacer(1, 8))
        combo_rows = [['ID', 'Name', 'Expression', 'Safety Class']]
        for combo in load_combinations[:20]:
            if isinstance(combo, dict):
                safety_class = str(combo.get('safety_class', combo.get('limit_state', 'ULS')))
                combo_rows.append([
                    str(combo.get('id', '')),
                    str(combo.get('name', combo.get('title', ''))),
                    str(combo.get('expression', combo.get('formula', ''))),
                    safety_class,
                ])

        if len(combo_rows) > 1:
            combo_table = Table(combo_rows, colWidths=[1.0 * inch, 1.5 * inch, 2.5 * inch, 1.0 * inch])
            combo_table.setStyle(table_style())
            story.append(combo_table)
            story.append(Spacer(1, 12))

    return story