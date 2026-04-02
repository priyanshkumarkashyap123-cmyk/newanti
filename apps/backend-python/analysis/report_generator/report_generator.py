"""Modular report generator orchestrator."""

from typing import Any, Dict

from reportlab.lib.pagesizes import A4, letter
from reportlab.platypus import PageBreak, Paragraph, SimpleDocTemplate, Spacer

from .sections.analysis_results import add_analysis_results
from .sections.cover import add_cover_page
from .sections.design_checks import add_design_checks
from .sections.diagrams import add_diagrams
from .sections.input_summary import add_input_summary
from .sections.loads import add_load_data
from .sections.page import add_header_footer
from .settings import ReportSettings
from .styles import create_styles


class ReportGenerator:
    """Generates PDF reports via modular section builders."""

    def __init__(self, settings: ReportSettings):
        self.settings = settings
        self.story = []
        self.styles = create_styles(settings)

    def generate_report(self, analysis_data: Dict[str, Any], output_path: str) -> None:
        page_size = A4 if self.settings.page_size.upper() == "A4" else letter
        if self.settings.orientation == "landscape":
            page_size = (page_size[1], page_size[0])

        doc = SimpleDocTemplate(
            output_path,
            pagesize=page_size,
            rightMargin=20,
            leftMargin=20,
            topMargin=30,
            bottomMargin=20,
        )

        self.story.clear()

        if self.settings.include_cover_page:
            add_cover_page(self.story, self.styles, self.settings)
            self.story.append(PageBreak())

        if self.settings.include_toc:
            self.story.append(Paragraph("Table of Contents", self.styles["CustomHeading1"]))
            self.story.append(Spacer(1, 10))
            for entry in [
                "1. Input Summary",
                "2. Load Data",
                "3. Analysis Results",
                "4. Design Checks",
                "5. Diagrams",
            ]:
                self.story.append(Paragraph(entry, self.styles["CustomBody"]))
            self.story.append(PageBreak())

        if self.settings.include_input_summary:
            add_input_summary(self.story, self.styles, analysis_data)
            self.story.append(PageBreak())

        if self.settings.include_load_cases or self.settings.include_load_combinations:
            add_load_data(self.story, self.styles, analysis_data)
            self.story.append(PageBreak())

        if self.settings.include_analysis_results:
            add_analysis_results(self.story, self.styles, analysis_data, self.settings)
            self.story.append(PageBreak())

        if self.settings.include_design_checks:
            add_design_checks(self.story, self.styles, analysis_data, self.settings)
            self.story.append(PageBreak())

        if self.settings.include_diagrams:
            add_diagrams(self.story, self.styles, analysis_data, self.settings)
            self.story.append(PageBreak())

        doc.build(
            self.story,
            onFirstPage=lambda canvas, d: add_header_footer(canvas, d, self.settings, self.styles),
            onLaterPages=lambda canvas, d: add_header_footer(canvas, d, self.settings, self.styles),
        )
