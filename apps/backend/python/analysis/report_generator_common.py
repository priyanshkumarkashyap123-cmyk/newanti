"""
Shared settings, clause maps, and numeric helpers for report generation.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict, Optional

from analysis.report_config import load_report_defaults

CHECK_CLAUSE_MAP = {
    "IS800_FLEXURE": "IS 800:2007 Cl. 8.2",
    "IS800_SHEAR": "IS 800:2007 Cl. 8.4",
    "IS800_LTB": "IS 800:2007 Cl. 8.2.2",
    "IS800_COMPRESSION_FLEXURE": "IS 800:2007 Cl. 9.3.1",
    "IS800_TENSION_FLEXURE": "IS 800:2007 Cl. 9.3.2",
    "FLEXURE_MAJOR": "AISC 360-16 §F2",
    "FLEXURE_MINOR": "AISC 360-16 §F6",
    "SHEAR_CHECK": "AISC 360-16 §G2",
    "AXIAL_COMPRESSION": "AISC 360-16 §E3",
    "AXIAL_TENSION": "AISC 360-16 §D2",
    "COMPRESSION_FLEXURE_COMBINED": "AISC 360-16 §H1-1",
    "TENSION_FLEXURE_COMBINED": "AISC 360-16 §H1-2",
}

CODE_DEFAULT_CLAUSE = {
    "IS 800": "IS 800:2007 Cl. 3, Cl. 8, Cl. 9",
    "AISC": "AISC 360-16 Chapter D/E/F/G/H",
    "IS 456": "IS 456:2000 Cl. 38, Cl. 40, Cl. 41",
    "ACI": "ACI 318-19 Ch. 22",
    "EC2": "EN 1992-1-1 Cl. 6",
    "EC3": "EN 1993-1-1 Cl. 6",
}


@dataclass
class ReportSettings:
    """Settings for report customization.

    Includes profile-based section toggles and granular diagram controls.
    For backward compatibility, include_diagrams gates all diagram types.
    """

    page_size: str = "A4"
    orientation: str = "portrait"

    company_name: str = "Engineering Consultancy"
    company_logo: Optional[str] = None
    company_address: str = ""
    company_phone: str = ""
    company_email: str = ""

    project_name: str = "Structural Analysis"
    project_number: str = ""
    project_location: str = ""
    client_name: str = ""
    engineer_name: str = ""
    checked_by: str = ""

    include_cover_page: bool = True
    include_toc: bool = True
    include_input_summary: bool = True
    include_load_cases: bool = True
    include_load_combinations: bool = True
    include_node_displacements: bool = True
    include_member_forces: bool = True
    include_reaction_summary: bool = True
    include_analysis_results: bool = True
    include_design_checks: bool = True
    include_diagrams: bool = True
    include_concrete_design: bool = False
    include_foundation_design: bool = False
    include_connection_design: bool = False
    include_appendix: bool = False

    include_sfd: bool = True
    include_bmd: bool = True
    include_deflection: bool = True
    include_afd: bool = True
    include_bmd_my: bool = False
    include_shear_z: bool = False

    selected_load_case_id: Optional[str] = None
    minimal_metadata: bool = False

    primary_color: tuple = (0, 0.4, 0.8)
    secondary_color: tuple = (0.2, 0.2, 0.2)
    header_footer: bool = True
    page_numbers: bool = True

    @classmethod
    def from_env(cls) -> "ReportSettings":
        """Create ReportSettings using environment overrides."""
        cfg = load_report_defaults()
        return cls(**cfg)


def safe_float(value: Any, default: float = 0.0) -> float:
    """Safely parse a numeric value to float."""
    try:
        if value is None:
            return default
        return float(value)
    except (TypeError, ValueError):
        return default


def max_abs_values(values: Any) -> float:
    """Return max absolute value from scalar/list-like value."""
    if isinstance(values, (list, tuple)):
        if not values:
            return 0.0
        return max(abs(safe_float(v)) for v in values)
    return abs(safe_float(values))


def extract_member_force_extremes(forces: Dict[str, Any]) -> Dict[str, float]:
    """Extract robust force/moment envelopes from mixed payload shapes."""
    diagram = forces.get('diagramData', {}) if isinstance(forces.get('diagramData'), dict) else {}

    axial_max = max(
        max_abs_values(forces.get('axial')),
        max_abs_values(diagram.get('axial')),
    )

    shear_y_max = max(
        max_abs_values(forces.get('shearY')),
        max_abs_values(diagram.get('shear_y')),
        max_abs_values(forces.get('shear')),
    )

    shear_z_max = max(
        max_abs_values(forces.get('shearZ')),
        max_abs_values(diagram.get('shear_z')),
    )

    moment_y_max = max(
        max_abs_values(forces.get('momentY')),
        max_abs_values(diagram.get('moment_y')),
        max_abs_values(forces.get('moment')),
    )

    moment_z_max = max(
        max_abs_values(forces.get('momentZ')),
        max_abs_values(diagram.get('moment_z')),
    )

    torsion_max = max(
        max_abs_values(forces.get('torsion')),
        max_abs_values(diagram.get('torsion')),
    )

    return {
        'axial': axial_max,
        'shear_y': shear_y_max,
        'shear_z': shear_z_max,
        'moment_y': moment_y_max,
        'moment_z': moment_z_max,
        'torsion': torsion_max,
    }


__all__ = [
    'CHECK_CLAUSE_MAP',
    'CODE_DEFAULT_CLAUSE',
    'ReportSettings',
    'safe_float',
    'max_abs_values',
    'extract_member_force_extremes',
]
