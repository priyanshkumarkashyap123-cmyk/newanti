from reportlab.platypus import Paragraph, Spacer, Table


def add_load_data(story, styles, analysis_data):
    story.append(Paragraph("Load Data", styles['CustomHeading1']))
    story.append(Spacer(1, 10))

    input_data = analysis_data.get('input', {})
    load_cases = input_data.get('load_cases') or input_data.get('loadCases') or []
    load_combos = input_data.get('load_combinations') or input_data.get('loadCombinations') or []

    if load_cases:
        data = [["Name", "Type", "Description"]]
        for lc in load_cases:
            data.append([
                lc.get('name', ''),
                lc.get('type', ''),
                lc.get('description', ''),
            ])
        t = Table(data, repeatRows=1)
        story.append(Paragraph("Load Cases", styles['CustomHeading2']))
        story.append(t)
        story.append(Spacer(1, 10))

    if load_combos:
        data = [["Name", "Description", "Factors"]]
        for lc in load_combos:
            data.append([
                lc.get('name', ''),
                lc.get('description', ''),
                ", ".join([f"{k}:{v}" for k, v in (lc.get('factors') or {}).items()]),
            ])
        t = Table(data, repeatRows=1)
        story.append(Paragraph("Load Combinations", styles['CustomHeading2']))
        story.append(t)
        story.append(Spacer(1, 10))