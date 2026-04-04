"""
Legacy section builders and styling helpers for PDF report generation.

This module keeps backwards-compatible ReportGenerator helper methods while
allowing `report_generator.py` to stay focused on orchestration.
"""

from .report_generator_sections_loads import ReportGeneratorLoadsSection
from .report_generator_sections_results import ReportGeneratorResultsSection
from .report_generator_sections_design import ReportGeneratorDesignSection
from .report_generator_sections_styling import ReportGeneratorStyling


class ReportGeneratorLegacySectionsMixin(
    ReportGeneratorLoadsSection,
    ReportGeneratorResultsSection,
    ReportGeneratorDesignSection,
    ReportGeneratorStyling,
):
    """
    Legacy section methods preserved for compatibility and reuse.
    
    Delegates to specialized mixins:
    - ReportGeneratorLoadsSection: load data sections
    - ReportGeneratorResultsSection: analysis results and reactions
    - ReportGeneratorDesignSection: design checks and diagrams
    - ReportGeneratorStyling: table styles and page layout
    """
    pass


__all__ = [
    "ReportGeneratorLegacySectionsMixin",
]
