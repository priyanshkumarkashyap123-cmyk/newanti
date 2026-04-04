"""Configuration loader for report generation defaults."""

from __future__ import annotations

import os
from typing import Any, Dict


def _parse_bool(value: str, default: bool) -> bool:
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "y", "on"}


def _parse_color(value: str, default: tuple) -> tuple:
    if not value:
        return default
    parts = value.split(",")
    if len(parts) != 3:
        return default
    try:
        return tuple(float(p.strip()) for p in parts)
    except ValueError:
        return default


def load_report_defaults() -> Dict[str, Any]:
    """Load report defaults with environment overrides."""
    return {
        "page_size": os.getenv("REPORT_PAGE_SIZE", "A4"),
        "orientation": os.getenv("REPORT_ORIENTATION", "portrait"),
        "company_name": os.getenv("REPORT_COMPANY_NAME", "Engineering Consultancy"),
        "company_logo": os.getenv("REPORT_COMPANY_LOGO"),
        "company_address": os.getenv("REPORT_COMPANY_ADDRESS", ""),
        "company_phone": os.getenv("REPORT_COMPANY_PHONE", ""),
        "company_email": os.getenv("REPORT_COMPANY_EMAIL", ""),
        "project_name": os.getenv("REPORT_PROJECT_NAME", "Structural Analysis"),
        "project_number": os.getenv("REPORT_PROJECT_NUMBER", ""),
        "project_location": os.getenv("REPORT_PROJECT_LOCATION", ""),
        "client_name": os.getenv("REPORT_CLIENT_NAME", ""),
        "engineer_name": os.getenv("REPORT_ENGINEER_NAME", ""),
        "checked_by": os.getenv("REPORT_CHECKED_BY", ""),
        "include_cover_page": _parse_bool(os.getenv("REPORT_INCLUDE_COVER_PAGE"), True),
        "include_toc": _parse_bool(os.getenv("REPORT_INCLUDE_TOC"), True),
        "include_input_summary": _parse_bool(os.getenv("REPORT_INCLUDE_INPUT_SUMMARY"), True),
        "include_load_cases": _parse_bool(os.getenv("REPORT_INCLUDE_LOAD_CASES"), True),
        "include_load_combinations": _parse_bool(os.getenv("REPORT_INCLUDE_LOAD_COMBINATIONS"), True),
        "include_node_displacements": _parse_bool(os.getenv("REPORT_INCLUDE_NODE_DISPLACEMENTS"), True),
        "include_member_forces": _parse_bool(os.getenv("REPORT_INCLUDE_MEMBER_FORCES"), True),
        "include_reaction_summary": _parse_bool(os.getenv("REPORT_INCLUDE_REACTION_SUMMARY"), True),
        "include_analysis_results": _parse_bool(os.getenv("REPORT_INCLUDE_ANALYSIS_RESULTS"), True),
        "include_design_checks": _parse_bool(os.getenv("REPORT_INCLUDE_DESIGN_CHECKS"), True),
        "include_diagrams": _parse_bool(os.getenv("REPORT_INCLUDE_DIAGRAMS"), True),
        "include_concrete_design": _parse_bool(os.getenv("REPORT_INCLUDE_CONCRETE_DESIGN"), False),
        "include_foundation_design": _parse_bool(os.getenv("REPORT_INCLUDE_FOUNDATION_DESIGN"), False),
        "include_connection_design": _parse_bool(os.getenv("REPORT_INCLUDE_CONNECTION_DESIGN"), False),
        "include_appendix": _parse_bool(os.getenv("REPORT_INCLUDE_APPENDIX"), False),
        "include_sfd": _parse_bool(os.getenv("REPORT_INCLUDE_SFD"), True),
        "include_bmd": _parse_bool(os.getenv("REPORT_INCLUDE_BMD"), True),
        "include_deflection": _parse_bool(os.getenv("REPORT_INCLUDE_DEFLECTION"), True),
        "include_afd": _parse_bool(os.getenv("REPORT_INCLUDE_AFD"), True),
        "include_bmd_my": _parse_bool(os.getenv("REPORT_INCLUDE_BMD_MY"), False),
        "include_shear_z": _parse_bool(os.getenv("REPORT_INCLUDE_SHEAR_Z"), False),
        "selected_load_case_id": os.getenv("REPORT_SELECTED_LOAD_CASE_ID"),
        "minimal_metadata": _parse_bool(os.getenv("REPORT_MINIMAL_METADATA"), False),
        "primary_color": _parse_color(os.getenv("REPORT_PRIMARY_COLOR"), (0, 0.4, 0.8)),
        "secondary_color": _parse_color(os.getenv("REPORT_SECONDARY_COLOR"), (0.2, 0.2, 0.2)),
        "header_footer": _parse_bool(os.getenv("REPORT_HEADER_FOOTER"), True),
        "page_numbers": _parse_bool(os.getenv("REPORT_PAGE_NUMBERS"), True),
    }


__all__ = ["load_report_defaults"]