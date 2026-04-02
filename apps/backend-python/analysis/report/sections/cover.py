"""
Cover page section builder.
"""

from __future__ import annotations

from datetime import datetime
from typing import List

from reportlab.lib.units import inch
from reportlab.platypus import Image, Paragraph, Spacer

from analysis.report_generator_common import ReportSettings


def build_cover(settings: ReportSettings, styles) -> List:
    story = []

    if settings.company_logo:
        try:
            img = Image(settings.company_logo, width=2 * inch, height=1 * inch)
            story.append(img)
            story.append(Spacer(1, 20))
        except Exception:
            # Ignore logo failures to keep report generation resilient
            pass

    story.append(Paragraph(settings.company_name, styles['CustomTitle']))
    story.append(Spacer(1, 30))

    story.append(Paragraph("STRUCTURAL ANALYSIS REPORT", styles['CustomHeading1']))
    story.append(Spacer(1, 50))

    project_data = [
        ['Project Name:', settings.project_name],
        ['Project Number:', settings.project_number or 'N/A'],
        ['Location:', settings.project_location or 'N/A'],
        ['Client:', settings.client_name or 'N/A'],
        ['Engineer:', settings.engineer_name or 'N/A'],
        ['Checked By:', settings.checked_by or 'N/A'],
        ['Date:', datetime.now().strftime('%B %d, %Y')],
    ]

    from reportlab.platypus import Table, TableStyle
    from reportlab import colors

    project_table = Table(project_data, colWidths=[2 * inch, 4 * inch])
    project_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (0, -1), colors.Color(*settings.primary_color, alpha=0.1)),
        ('TEXTCOLOR', (0, 0), (-1, -1), colors.black),
        ('ALIGN', (0, 0), (0, -1), 'RIGHT'),
        ('ALIGN', (1, 0), (1, -1), 'LEFT'),
        ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
        ('FONTNAME', (1, 0), (1, -1), 'Helvetica'),
        ('FONTSIZE', (0, 0), (-1, -1), 11),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 12),
        ('TOPPADDING', (0, 0), (-1, -1), 12),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
    ]))

    story.append(project_table)
    story.append(Spacer(1, 50))

    contact_text = []
    if settings.company_address:
        contact_text.append(settings.company_address)
    if settings.company_phone:
        contact_text.append(f"Phone: {settings.company_phone}")
    if settings.company_email:
        contact_text.append(f"Email: {settings.company_email}")

    if contact_text:
        story.append(Paragraph('<br/>'.join(contact_text), styles['Normal']))

    return story