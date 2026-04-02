"""
Utilities for report customization and profiles.
"""

from .reports_schemas import ReportCustomization


def apply_profile_to_customization(customization: ReportCustomization) -> ReportCustomization:
    if not customization.profile:
        return customization

    profile_name = customization.profile.upper()

    PROFILES = {
        "FULL_REPORT": {
            "sections": {
                "include_cover_page": True,
                "include_toc": True,
                "include_input_summary": True,
                "include_load_cases": True,
                "include_load_combinations": True,
                "include_node_displacements": True,
                "include_member_forces": True,
                "include_reaction_summary": True,
                "include_analysis_results": True,
                "include_design_checks": True,
                "include_diagrams": True,
                "include_concrete_design": True,
                "include_foundation_design": True,
                "include_connection_design": True,
            },
            "diagrams": {
                "include_sfd": True,
                "include_bmd": True,
                "include_deflection": True,
                "include_afd": True,
                "include_bmd_my": True,
                "include_shear_z": True,
            },
            "minimal_metadata": False,
        },
        "OPTIMIZATION_SUMMARY": {
            "sections": {
                "include_cover_page": True,
                "include_toc": False,
                "include_input_summary": True,
                "include_load_cases": False,
                "include_load_combinations": False,
                "include_node_displacements": False,
                "include_member_forces": False,
                "include_reaction_summary": False,
                "include_analysis_results": False,
                "include_design_checks": True,
                "include_diagrams": True,
                "include_concrete_design": False,
                "include_foundation_design": False,
                "include_connection_design": False,
            },
            "diagrams": {
                "include_sfd": True,
                "include_bmd": True,
                "include_deflection": True,
                "include_afd": False,
                "include_bmd_my": False,
                "include_shear_z": False,
            },
            "minimal_metadata": False,
        },
        "SFD_BMD_ONLY": {
            "sections": {
                "include_cover_page": True,
                "include_toc": False,
                "include_input_summary": False,
                "include_load_cases": False,
                "include_load_combinations": False,
                "include_node_displacements": False,
                "include_member_forces": False,
                "include_reaction_summary": False,
                "include_analysis_results": False,
                "include_design_checks": False,
                "include_diagrams": True,
                "include_concrete_design": False,
                "include_foundation_design": False,
                "include_connection_design": False,
            },
            "diagrams": {
                "include_sfd": True,
                "include_bmd": True,
                "include_deflection": False,
                "include_afd": False,
                "include_bmd_my": False,
                "include_shear_z": False,
            },
            "minimal_metadata": True,
        },
    }

    if profile_name not in PROFILES:
        return customization

    profile_config = PROFILES[profile_name]

    for section_key, section_value in profile_config["sections"].items():
        setattr(customization, section_key, section_value)

    for diagram_key, diagram_value in profile_config["diagrams"].items():
        setattr(customization, diagram_key, diagram_value)

    customization.minimal_metadata = profile_config["minimal_metadata"]

    return customization
