from reportlab.platypus import Paragraph, Spacer, Image
from datetime import datetime


def add_cover_page(story, styles, settings):
    story.append(Paragraph(settings.project_name, styles['CustomTitle']))
    story.append(Spacer(1, 20))

    # Project info
    project_info = [
        f"Project Number: {settings.project_number}",
        f"Project Location: {settings.project_location}",
        f"Client: {settings.client_name}",
        f"Engineer: {settings.engineer_name}",
        f"Checked By: {settings.checked_by}",
        f"Date: {datetime.now().strftime('%d %b %Y')}",
    ]

    for info in project_info:
        story.append(Paragraph(info, styles['CustomBody']))
    story.append(Spacer(1, 30))

    # Company info
    story.append(Paragraph(settings.company_name, styles['CustomHeading2']))
    if settings.company_logo:
        try:
            story.append(Image(settings.company_logo, width=200, height=60))
            story.append(Spacer(1, 10))
        except Exception:
            pass  # Ignore logo load errors to keep behavior lenient

    company_details = [
        settings.company_address,
        settings.company_phone,
        settings.company_email,
    ]
    for line in company_details:
        if line:
            story.append(Paragraph(line, styles['CustomBody']))

    story.append(Spacer(1, 40))

    story.append(Paragraph(
        "Structural Analysis Report",
        styles['CustomHeading1']
    ))
    story.append(Paragraph(
        "Comprehensive analysis of the structural model including loads, displacements, member forces, and design checks.",
        styles['CustomBody']
    ))
    story.append(Spacer(1, 20))