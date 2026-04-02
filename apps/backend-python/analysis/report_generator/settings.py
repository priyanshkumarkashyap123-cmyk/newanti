from dataclasses import dataclass
from typing import Optional


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
    """Settings for report customization
    
    Includes profile-based section toggles and granular diagram controls.
    For backward compatibility, include_diagrams gates all diagram types.
    """
    # Document settings
    page_size: str = "A4"  # "A4" or "Letter"
    orientation: str = "portrait"  # "portrait" or "landscape"
    
    # Company branding
    company_name: str = "Engineering Consultancy"
    company_logo: Optional[str] = None  # Path to logo image
    company_address: str = ""
    company_phone: str = ""
    company_email: str = ""
    
    # Project information
    project_name: str = "Structural Analysis"
    project_number: str = ""
    project_location: str = ""
    client_name: str = ""
    engineer_name: str = ""
    checked_by: str = ""
    
    # Report sections to include
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
    
    # Granular diagram controls (only evaluated if include_diagrams=True)
    include_sfd: bool = True             # Shear Force Diagram (Vy—XY plane)
    include_bmd: bool = True             # Bending Moment Diagram (Mz—XY plane)
    include_deflection: bool = True      # Deflected shape
    include_afd: bool = True             # Axial Force Diagram (Fx)
    include_bmd_my: bool = False         # Weak-axis moment (My—XZ plane)
    include_shear_z: bool = False        # Weak-axis shear (Vz—XZ plane)
    
    # Load case context
    selected_load_case_id: Optional[str] = None  # Currently active LC from UI
    
    # Metadata minimization (for SFD_BMD_ONLY)
    minimal_metadata: bool = False
    
    # Styling
    primary_color: tuple = (0, 0.4, 0.8)  # RGB (0-1)
    secondary_color: tuple = (0.2, 0.2, 0.2)
    header_footer: bool = True
    page_numbers: bool = True