from reportlab.platypus import Paragraph


def add_header_footer(canvas, doc, settings, styles):
    if not settings.header_footer:
        return
    canvas.saveState()
    width, height = doc.pagesize
    canvas.setFont('Helvetica', 9)
    canvas.drawString(20, height - 30, settings.project_name)
    canvas.drawRightString(width - 20, height - 30, settings.company_name)
    if settings.page_numbers:
        page_num = canvas.getPageNumber()
        canvas.drawRightString(width - 20, 20, f"Page {page_num}")
    canvas.restoreState()