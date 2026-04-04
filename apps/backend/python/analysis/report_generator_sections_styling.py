"""Table styling and page layout helpers for PDF reports."""

from reportlab.lib.units import inch
from reportlab.lib import colors
from reportlab.platypus import TableStyle

from analysis.report.helpers import (
    standard_table_style,
    critical_failures_table_style,
)


class ReportGeneratorStyling:
    """Mixin for report styling and page layout."""

    def _get_table_style(self) -> TableStyle:
        """Get standard table style."""
        return standard_table_style(self.settings.primary_color)

    def _get_critical_failures_table_style(self) -> TableStyle:
        """Get table style for critical failures (red-accent for high visibility)."""
        return critical_failures_table_style()

    def _add_header_footer(self, canvas, doc):
        """Add header and footer to each page."""
        if not self.settings.header_footer:
            return

        canvas.saveState()

        canvas.setFont('Helvetica-Bold', 9)
        canvas.setFillColor(colors.Color(*self.settings.secondary_color))
        canvas.drawString(72, doc.pagesize[1] - 50, self.settings.project_name)

        canvas.setFont('Helvetica', 8)
        canvas.drawString(72, 50, self.settings.company_name)

        if self.settings.page_numbers:
            canvas.drawRightString(doc.pagesize[0] - 72, 50, f"Page {doc.page}")

        canvas.restoreState()


__all__ = ["ReportGeneratorStyling"]
