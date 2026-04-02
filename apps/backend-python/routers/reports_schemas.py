"""
Shared Pydantic schemas for report endpoints.
"""

from typing import Optional, List, Dict, Any, Literal
from pydantic import BaseModel
from datetime import datetime


class ReportRequest(BaseModel):
    settings: Dict[str, Any]
    analysis_data: Dict[str, Any]


class ReportCustomization(BaseModel):
    company_name: str = "Engineering Consultancy"
    company_address: str = ""
    company_phone: str = ""
    company_email: str = ""
    project_name: str = "Structural Analysis"
    project_number: str = ""
    project_location: str = ""
    client_name: str = ""
    engineer_name: str = ""
    checked_by: str = ""
    profile: Optional[str] = None
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
    include_sfd: bool = True
    include_bmd: bool = True
    include_deflection: bool = True
    include_afd: bool = True
    include_bmd_my: bool = False
    include_shear_z: bool = False
    selected_load_case_id: Optional[str] = None
    primary_color: List[float] = [0.0, 0.4, 0.8]
    page_size: str = "A4"
    minimal_metadata: bool = False


class GenerateReportRequest(BaseModel):
    analysis_data: Dict[str, Any]
    customization: Optional[ReportCustomization] = None


class ReportTemplateCreateRequest(BaseModel):
    template_name: str
    description: str = ""
    section_toggles: Dict[str, bool] = {}
    diagram_toggles: Dict[str, bool] = {}
    ordering: List[str] = []
    metadata_defaults: Dict[str, Any] = {}
    is_published: bool = False
    actor_user_id: str
    actor_role: Literal["admin", "member"] = "member"


class ReportTemplateUpdateRequest(BaseModel):
    template_name: Optional[str] = None
    description: Optional[str] = None
    section_toggles: Optional[Dict[str, bool]] = None
    diagram_toggles: Optional[Dict[str, bool]] = None
    ordering: Optional[List[str]] = None
    metadata_defaults: Optional[Dict[str, Any]] = None
    is_published: Optional[bool] = None
    actor_user_id: str
    actor_role: Literal["admin", "member"] = "member"


class ReportTemplateResponse(BaseModel):
    template_id: str
    org_id: str
    template_name: str
    description: str
    section_toggles: Dict[str, bool]
    diagram_toggles: Dict[str, bool]
    ordering: List[str]
    metadata_defaults: Dict[str, Any]
    is_published: bool
    created_by: str
    created_at: datetime
    updated_at: datetime
