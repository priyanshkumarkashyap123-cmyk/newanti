"""
report_generator.py - Professional PDF Report Generation

Main report orchestration module. Section-level legacy helpers are extracted into
`report_generator_sections_legacy.py` to keep this file focused on composition.
"""

from typing import Dict, Any

from reportlab.lib.pagesizes import A4, letter
from reportlab.platypus import SimpleDocTemplate, PageBreak

from analysis.report_generator_common import ReportSettings
from analysis.report.styles import create_styles
from analysis.report.sections.cover import build_cover
from analysis.report.sections.input_summary import build_input_summary
from analysis.report.sections.load_data import build_load_data
from analysis.report.sections.analysis_results import build_analysis_results, build_reaction_summary
from analysis.report.sections.design_checks import build_design_checks
from analysis.report.sections.diagrams import build_diagrams
from analysis.report.sections.concrete_design import build_concrete_design
from analysis.report_generator_sections_legacy import ReportGeneratorLegacySectionsMixin
from analysis.report_generator_output import build_dict_table_adapter


class ReportGenerator(ReportGeneratorLegacySectionsMixin):
    """Generates professional PDF reports for structural analysis."""

    def __init__(self, settings: ReportSettings):
        self.settings = settings
        self.story = []
        self.styles = create_styles(self.settings)

    def generate_report(
        self,
        analysis_data: Dict[str, Any],
        output_path: str
    ) -> str:
        """
        Generate complete PDF report.

        Args:
            analysis_data: Analysis results and model data
            output_path: Path to save PDF

        Returns:
            Path to generated PDF
        """
        page_size = A4 if self.settings.page_size == "A4" else letter

        doc = SimpleDocTemplate(
            output_path,
            pagesize=page_size,
            rightMargin=72,
            leftMargin=72,
            topMargin=72,
            bottomMargin=72,
        )

        self.story = []

        if self.settings.include_cover_page:
            self.story.extend(build_cover(self.settings, self.styles))
            self.story.append(PageBreak())

        if self.settings.include_input_summary:
            self.story.extend(
                build_input_summary(
                    analysis_data.get('input', {}),
                    self.styles,
                    self._get_table_style,
                )
            )
            self.story.append(PageBreak())

        if self.settings.include_load_cases or self.settings.include_load_combinations:
            self.story.extend(build_load_data(analysis_data, self.styles, self._get_table_style))
            self.story.append(PageBreak())

        if self.settings.include_analysis_results:
            self.story.extend(
                build_analysis_results(
                    analysis_data.get('results', {}),
                    self.styles,
                    self._get_table_style,
                )
            )
            if self.settings.include_reaction_summary:
                self.story.extend(
                    build_reaction_summary(
                        analysis_data.get('results', {}),
                        self.styles,
                        self._get_table_style,
                    )
                )
            self.story.append(PageBreak())

        if self.settings.include_design_checks:
            self.story.extend(
                build_design_checks(
                    analysis_data.get('design_checks', {}),
                    self.styles,
                    self._get_table_style,
                    self._get_critical_failures_table_style,
                )
            )
            self.story.append(PageBreak())

        if self.settings.include_diagrams:
            self.story.extend(build_diagrams(analysis_data.get('diagrams', {}), self.styles))
            self.story.append(PageBreak())

        if self.settings.include_concrete_design:
            dict_table = build_dict_table_adapter(self.styles)
            self.story.extend(
                build_concrete_design(
                    analysis_data.get('concrete_design', {}),
                    self.styles,
                    dict_table,
                )
            )
            self.story.append(PageBreak())

        # Avoid trailing empty page.
        if self.story and isinstance(self.story[-1], PageBreak):
            self.story.pop()

        doc.build(
            self.story,
            onFirstPage=self._add_header_footer,
            onLaterPages=self._add_header_footer,
        )

        return output_path


# Demo moved to analysis/report_generator_demo.py to keep imports clean
