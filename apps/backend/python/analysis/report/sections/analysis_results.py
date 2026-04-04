"""
Analysis results and reaction summary section builders.
"""

from __future__ import annotations

import math
from typing import Any, Dict, List

from reportlab.lib.units import inch
from reportlab.platypus import Paragraph, Spacer, Table

from analysis.report_generator_common import extract_member_force_extremes, safe_float


def build_analysis_results(results: Dict[str, Any], styles, table_style) -> List:
    story = []

    story.append(Paragraph("2. ANALYSIS RESULTS", styles['CustomHeading1']))
    story.append(Spacer(1, 12))

    displacements = results.get('displacements', {})
    member_forces = results.get('memberForces', results.get('member_forces', {}))

    max_displacement = safe_float(results.get('max_displacement', 0))
    max_moment = safe_float(results.get('max_moment', 0))
    max_shear = safe_float(results.get('max_shear', 0))
    max_axial = safe_float(results.get('max_axial', 0))

    if isinstance(displacements, dict):
        for disp in displacements.values():
            if not isinstance(disp, dict):
                continue
            dx_m = safe_float(disp.get('dx', 0))
            dy_m = safe_float(disp.get('dy', 0))
            dz_m = safe_float(disp.get('dz', 0))
            total_mm = math.sqrt(dx_m * dx_m + dy_m * dy_m + dz_m * dz_m) * 1000.0
            max_displacement = max(max_displacement, total_mm)

    if isinstance(member_forces, dict):
        for forces in member_forces.values():
            if not isinstance(forces, dict):
                continue
            extrema = extract_member_force_extremes(forces)
            max_moment = max(max_moment, extrema['moment_y'], extrema['moment_z'])
            max_shear = max(max_shear, extrema['shear_y'], extrema['shear_z'])
            max_axial = max(max_axial, extrema['axial'])

    summary_text = f"""
    <b>Analysis Summary:</b><br/>
    • Max. Displacement (&delta;<sub>max</sub>): {max_displacement:.2f} mm<br/>
    • Max. Bending Moment (M<sub>z,max</sub>): {max_moment:.2f} kN·m<br/>
    • Max. Shear Force (V<sub>max</sub>): {max_shear:.2f} kN<br/>
    • Max. Axial Force (P<sub>max</sub>): {max_axial:.2f} kN<br/>
    • Analysis Status: {'✓ SUCCESSFUL' if results.get('success') else '✗ FAILED'}<br/>
    """

    story.append(Paragraph(summary_text, styles['CustomBody']))
    story.append(Spacer(1, 12))

    if displacements:
        story.append(Paragraph("2.1 Node Displacements", styles['CustomHeading2']))
        disp_data = [['Node', '&delta;x (mm)', '&delta;y (mm)', '&delta;z (mm)', '&delta;total (mm)']]
        for node_id, disp in list(displacements.items())[:15]:
            dx = disp.get('dx', 0) * 1000
            dy = disp.get('dy', 0) * 1000
            dz = disp.get('dz', 0) * 1000
            total = (dx**2 + dy**2 + dz**2) ** 0.5
            disp_data.append([str(node_id), f"{dx:.2f}", f"{dy:.2f}", f"{dz:.2f}", f"{total:.2f}"])

        disp_table = Table(disp_data, colWidths=[1.2 * inch, 1.2 * inch, 1.2 * inch, 1.2 * inch, 1.2 * inch])
        disp_table.setStyle(table_style())
        story.append(disp_table)
        story.append(Spacer(1, 12))

    if member_forces:
        story.append(Paragraph("2.2 Member End Forces", styles['CustomHeading2']))
        force_data = [['Member', 'My (kN·m)', 'Mz (kN·m)', 'Vy (kN)', 'Vz (kN)', 'Axial (kN)']]
        for member_id, forces in list(member_forces.items())[:15]:
            extrema = extract_member_force_extremes(forces)
            force_data.append([
                str(member_id),
                f"{extrema['moment_y']:.2f}",
                f"{extrema['moment_z']:.2f}",
                f"{extrema['shear_y']:.2f}",
                f"{extrema['shear_z']:.2f}",
                f"{extrema['axial']:.2f}",
            ])

        force_table = Table(force_data, colWidths=[1.2 * inch, 1.2 * inch, 1.2 * inch, 1.0 * inch, 1.0 * inch, 1.0 * inch])
        force_table.setStyle(table_style())
        story.append(force_table)
        story.append(Spacer(1, 12))

    return story


def build_reaction_summary(results: Dict[str, Any], styles, table_style) -> List:
    story = []

    reactions = results.get('reactions', {}) if isinstance(results, dict) else {}
    if not reactions:
        return story

    story.append(Paragraph("2.3 Support Reactions", styles['CustomHeading2']))

    reaction_data = [['Support', 'Rx (kN)', 'Ry (kN)', 'Rz (kN)', 'Mx (kN·m)', 'My (kN·m)', 'Mz (kN·m)']]
    for support_id, reaction in list(reactions.items())[:15]:
        reaction_data.append([
            str(support_id),
            f"{safe_float(reaction.get('rx', 0)):.2f}",
            f"{safe_float(reaction.get('ry', 0)):.2f}",
            f"{safe_float(reaction.get('rz', 0)):.2f}",
            f"{safe_float(reaction.get('mx', 0)):.2f}",
            f"{safe_float(reaction.get('my', 0)):.2f}",
            f"{safe_float(reaction.get('mz', 0)):.2f}",
        ])

    reaction_table = Table(reaction_data, colWidths=[1.2 * inch, 1.0 * inch, 1.0 * inch, 1.0 * inch, 1.0 * inch, 1.0 * inch, 1.0 * inch])
    reaction_table.setStyle(table_style())
    story.append(reaction_table)
    story.append(Spacer(1, 12))

    return story