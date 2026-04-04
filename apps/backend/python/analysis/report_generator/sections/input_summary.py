from reportlab.platypus import Paragraph, Spacer, Table


def add_input_summary(story, styles, analysis_data):
    story.append(Paragraph("Input Summary", styles['CustomHeading1']))
    story.append(Spacer(1, 10))

    input_data = analysis_data.get('input', {})
    nodes = input_data.get('nodes', [])
    members = input_data.get('members', [])

    story.append(Paragraph(f"Total Nodes: {len(nodes)}", styles['CustomBody']))
    story.append(Paragraph(f"Total Members: {len(members)}", styles['CustomBody']))
    story.append(Spacer(1, 10))

    # Nodes table
    if nodes:
        data = [["ID", "X (m)", "Y (m)", "Z (m)"]]
        for n in nodes[:50]:  # limit rows to avoid huge PDFs
            data.append([
                n.get('id', ''),
                f"{n.get('x', 0):.3f}",
                f"{n.get('y', 0):.3f}",
                f"{n.get('z', 0):.3f}",
            ])
        t = Table(data, repeatRows=1)
        story.append(t)
        story.append(Spacer(1, 10))

    # Members table
    if members:
        data = [["ID", "Start", "End", "Section"]]
        for m in members[:50]:
            data.append([
                m.get('id', ''),
                m.get('start_node_id', ''),
                m.get('end_node_id', ''),
                m.get('section', ''),
            ])
        t = Table(data, repeatRows=1)
        story.append(t)
        story.append(Spacer(1, 10))