from reportlab.platypus import Paragraph, Spacer, Image
import io


def add_diagrams(story, styles, analysis_data, settings):
    if not settings.include_diagrams:
        return

    diagrams = analysis_data.get('diagrams', {})
    if not diagrams:
        return

    story.append(Paragraph("Diagrams", styles['CustomHeading1']))
    story.append(Spacer(1, 10))

    for name, img_data in diagrams.items():
        if not img_data:
            continue
        try:
            img_bytes = io.BytesIO(img_data)
            story.append(Paragraph(name, styles['CustomHeading2']))
            story.append(Image(img_bytes, width=400, height=250))
            story.append(Spacer(1, 10))
        except Exception:
            # Keep behavior lenient: skip bad images
            continue