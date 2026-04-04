from reportlab.platypus import Paragraph, Spacer, Table
from ..utils import max_abs_values, safe_float, extract_member_force_extremes


def _add_reaction_summary(story, styles, results):
    reactions = results.get('reactions', [])
    if not reactions:
        return
    story.append(Paragraph("Support Reactions", styles['CustomHeading2']))
    data = [["Node", "Rx (kN)", "Ry (kN)", "Rz (kN)", "Mx (kN·m)", "My (kN·m)", "Mz (kN·m)"]]
    for r in reactions[:100]:
        data.append([
            r.get('node_id', ''),
            f"{safe_float(r.get('rx', 0)):.2f}",
            f"{safe_float(r.get('ry', 0)):.2f}",
            f"{safe_float(r.get('rz', 0)):.2f}",
            f"{safe_float(r.get('mx', 0)):.2f}",
            f"{safe_float(r.get('my', 0)):.2f}",
            f"{safe_float(r.get('mz', 0)):.2f}",
        ])
    t = Table(data, repeatRows=1)
    story.append(t)
    story.append(Spacer(1, 10))


def add_analysis_results(story, styles, analysis_data, settings):
    story.append(Paragraph("Analysis Results", styles['CustomHeading1']))
    story.append(Spacer(1, 10))

    results = analysis_data.get('results', {})

    # Displacements summary
    displacements = results.get('displacements', [])
    if settings.include_node_displacements and displacements:
        story.append(Paragraph("Node Displacements (mm)", styles['CustomHeading2']))
        data = [["Node", "Ux", "Uy", "Uz", "Rx", "Ry", "Rz"]]
        for d in displacements[:100]:
            data.append([
                d.get('node_id', ''),
                f"{safe_float(d.get('ux', 0))*1000:.2f}",
                f"{safe_float(d.get('uy', 0))*1000:.2f}",
                f"{safe_float(d.get('uz', 0))*1000:.2f}",
                f"{safe_float(d.get('rx', 0)):.4f}",
                f"{safe_float(d.get('ry', 0)):.4f}",
                f"{safe_float(d.get('rz', 0)):.4f}",
            ])
        t = Table(data, repeatRows=1)
        story.append(t)
        story.append(Spacer(1, 10))

    # Member force envelopes
    member_forces = results.get('member_forces', [])
    if settings.include_member_forces and member_forces:
        story.append(Paragraph("Member Force Envelopes", styles['CustomHeading2']))
        data = [["Member", "|Vy| (kN)", "|Vz| (kN)", "|My| (kN·m)", "|Mz| (kN·m)"]]
        for mf in member_forces[:100]:
            extremes = extract_member_force_extremes(mf)
            data.append([
                mf.get('member_id', mf.get('id', '')),
                f"{extremes['shear_y']:.2f}",
                f"{extremes['shear_z']:.2f}",
                f"{extremes['moment_y']:.2f}",
                f"{extremes['moment_z']:.2f}",
            ])
        t = Table(data, repeatRows=1)
        story.append(t)
        story.append(Spacer(1, 10))

    # Reactions
    if settings.include_reaction_summary:
        _add_reaction_summary(story, styles, results)