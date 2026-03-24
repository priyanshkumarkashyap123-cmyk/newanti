"""
Report Generation Endpoints

Profile System: Preset report configurations for different use cases
- FULL_REPORT: Complete engineering documentation
- OPTIMIZATION_SUMMARY: Compact summary for design alternatives
- SFD_BMD_ONLY: Diagram-focused minimal output for field/design review
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, List, Dict, Any, Literal
from datetime import datetime, timezone
import asyncio
import traceback
import base64
from uuid import uuid4

router = APIRouter(prefix="/reports", tags=["Reports"])


# ── In-Memory Organization Template Store (Phase 1b MVP) ──
#
# NOTE: This is intentionally in-memory for the current implementation slice.
# It can be replaced with persistent storage (Mongo/Postgres) without
# changing the API contracts below.
_ORG_REPORT_TEMPLATES: Dict[str, Dict[str, Dict[str, Any]]] = {}


# ── Request Models ──

class ReportRequest(BaseModel):
    settings: Dict[str, Any]
    analysis_data: Dict[str, Any]


class ReportCustomization(BaseModel):
    """Extended report customization with profile support.
    
    When 'profile' is specified, section toggles are applied per the preset.
    Individual section toggles can still override profile defaults.
    
    Load case context: selected_load_case_id should be the currently active
    load case from the UI (activeLoadCaseId), used for SFD/BMD rendering
    instead of forcing envelope/critical defaults.
    """
    # ── Company/Project Metadata ──
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
    
    # ── Profile Selection ──
    profile: Optional[str] = None
    
    # ── Section Toggles (extended per profile system) ──
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
    
    # ── Granular Diagram Toggles ──
    include_sfd: bool = True             # Shear Force Diagram (Vy—XY plane)
    include_bmd: bool = True             # Bending Moment Diagram (Mz—XY plane)
    include_deflection: bool = True      # Deflected shape
    include_afd: bool = True             # Axial Force Diagram (Fx)
    include_bmd_my: bool = False         # Weak-axis moment (My—XZ plane)
    include_shear_z: bool = False        # Weak-axis shear (Vz—XZ plane)
    
    # ── Load Case Context ──
    selected_load_case_id: Optional[str] = None  # Currently active LC from UI
    
    # ── Styling ──
    primary_color: List[float] = [0.0, 0.4, 0.8]
    page_size: str = "A4"
    
    # ── Metadata Minimization ──
    minimal_metadata: bool = False  # SFD_BMD_ONLY uses this for compact header


class GenerateReportRequest(BaseModel):
    analysis_data: Dict[str, Any]
    customization: Optional[ReportCustomization] = None


# ── Organization Template Models ──

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


def _ensure_org_bucket(org_id: str) -> Dict[str, Dict[str, Any]]:
    if org_id not in _ORG_REPORT_TEMPLATES:
        _ORG_REPORT_TEMPLATES[org_id] = {}
    return _ORG_REPORT_TEMPLATES[org_id]


def _can_access_template(template: Dict[str, Any], actor_user_id: Optional[str]) -> bool:
    if template["is_published"]:
        return True
    return bool(actor_user_id and template["created_by"] == actor_user_id)


def _can_modify_template(template: Dict[str, Any], actor_user_id: str, actor_role: str) -> bool:
    return actor_role == "admin" or template["created_by"] == actor_user_id


@router.post("/orgs/{org_id}/templates", response_model=ReportTemplateResponse)
async def create_org_report_template(org_id: str, request: ReportTemplateCreateRequest):
    """Create an org-scoped report template.

    Publishing is admin-only. Members can create draft templates.
    """
    if not request.template_name.strip():
        raise HTTPException(status_code=400, detail="template_name is required")

    if request.is_published and request.actor_role != "admin":
        raise HTTPException(status_code=403, detail="Only admins can create published templates")

    org_bucket = _ensure_org_bucket(org_id)
    template_id = str(uuid4())
    now = datetime.now(timezone.utc)
    template = {
        "template_id": template_id,
        "org_id": org_id,
        "template_name": request.template_name.strip(),
        "description": request.description,
        "section_toggles": request.section_toggles,
        "diagram_toggles": request.diagram_toggles,
        "ordering": request.ordering,
        "metadata_defaults": request.metadata_defaults,
        "is_published": request.is_published,
        "created_by": request.actor_user_id,
        "created_at": now,
        "updated_at": now,
    }
    org_bucket[template_id] = template
    return ReportTemplateResponse(**template)


@router.get("/orgs/{org_id}/templates", response_model=List[ReportTemplateResponse])
async def list_org_report_templates(org_id: str, actor_user_id: Optional[str] = None):
    """List visible templates for an org.

    Visibility:
    - Published templates are visible to all org users.
    - Draft templates are visible only to their creator.
    """
    org_bucket = _ensure_org_bucket(org_id)
    visible = [
        ReportTemplateResponse(**template)
        for template in org_bucket.values()
        if _can_access_template(template, actor_user_id)
    ]
    visible.sort(key=lambda t: t.updated_at, reverse=True)
    return visible


@router.get("/orgs/{org_id}/templates/{template_id}", response_model=ReportTemplateResponse)
async def get_org_report_template(org_id: str, template_id: str, actor_user_id: Optional[str] = None):
    """Get a single org template if visible to the actor."""
    org_bucket = _ensure_org_bucket(org_id)
    template = org_bucket.get(template_id)
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")

    if not _can_access_template(template, actor_user_id):
        raise HTTPException(status_code=403, detail="Template not visible to actor")

    return ReportTemplateResponse(**template)


@router.put("/orgs/{org_id}/templates/{template_id}", response_model=ReportTemplateResponse)
async def update_org_report_template(org_id: str, template_id: str, request: ReportTemplateUpdateRequest):
    """Update a template.

    Modify permissions:
    - Admin can modify any template.
    - Members can only modify templates they created.
    - Publishing is admin-only.
    """
    org_bucket = _ensure_org_bucket(org_id)
    template = org_bucket.get(template_id)
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")

    if not _can_modify_template(template, request.actor_user_id, request.actor_role):
        raise HTTPException(status_code=403, detail="Actor cannot modify this template")

    if request.is_published is True and request.actor_role != "admin":
        raise HTTPException(status_code=403, detail="Only admins can publish templates")

    if request.template_name is not None:
        if not request.template_name.strip():
            raise HTTPException(status_code=400, detail="template_name cannot be empty")
        template["template_name"] = request.template_name.strip()
    if request.description is not None:
        template["description"] = request.description
    if request.section_toggles is not None:
        template["section_toggles"] = request.section_toggles
    if request.diagram_toggles is not None:
        template["diagram_toggles"] = request.diagram_toggles
    if request.ordering is not None:
        template["ordering"] = request.ordering
    if request.metadata_defaults is not None:
        template["metadata_defaults"] = request.metadata_defaults
    if request.is_published is not None:
        template["is_published"] = request.is_published

    template["updated_at"] = datetime.now(timezone.utc)
    return ReportTemplateResponse(**template)


@router.delete("/orgs/{org_id}/templates/{template_id}")
async def delete_org_report_template(
    org_id: str,
    template_id: str,
    actor_user_id: str,
    actor_role: Literal["admin", "member"] = "member",
):
    """Delete a template with owner/admin guard."""
    org_bucket = _ensure_org_bucket(org_id)
    template = org_bucket.get(template_id)
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")

    if not _can_modify_template(template, actor_user_id, actor_role):
        raise HTTPException(status_code=403, detail="Actor cannot delete this template")

    del org_bucket[template_id]
    return {"success": True, "deleted_template_id": template_id}


# ── Profile Resolution Logic ──

def apply_profile_to_customization(customization: ReportCustomization) -> ReportCustomization:
    """
    Apply report profile presets to customize sections and diagrams.
    
    Profile-based defaults are applied first; explicit toggles in the request
    can override profile defaults (backward compatibility).
    
    Args:
        customization: ReportCustomization request with optional profile
        
    Returns:
        Modified customization with profile rules applied
    """
    if not customization.profile:
        # No profile specified; return as-is
        return customization
    
    profile_name = customization.profile.upper()
    
    # Define profile presets
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
        # Unknown profile, return as-is
        return customization
    
    profile_config = PROFILES[profile_name]
    
    # Apply section toggles from profile
    for section_key, section_value in profile_config["sections"].items():
        setattr(customization, section_key, section_value)
    
    # Apply diagram toggles from profile
    for diagram_key, diagram_value in profile_config["diagrams"].items():
        setattr(customization, diagram_key, diagram_value)
    
    # Apply metadata minimization setting
    customization.minimal_metadata = profile_config["minimal_metadata"]
    
    return customization


# ── Endpoints ──

@router.post("/generate-simple")
async def generate_report_endpoint(request: ReportRequest):
    """Generate simple PDF report using ReportLab. Returns base64 encoded PDF."""
    try:
        from analysis.report_generator import ReportGenerator, ReportSettings
        import tempfile
        import os

        settings_dict = request.settings
        settings = ReportSettings(
            company_name=settings_dict.get('company_name', 'BeamLab Ultimate'),
            project_name=settings_dict.get('project_name', 'Structural Analysis'),
            engineer_name=settings_dict.get('engineer_name', ''),
            project_number=settings_dict.get('job_number', settings_dict.get('project_number', ''))
        )

        for k, v in settings_dict.items():
            if hasattr(settings, k):
                setattr(settings, k, v)

        generator = ReportGenerator(settings)

        output_path = None
        try:
            with tempfile.NamedTemporaryFile(suffix='.pdf', delete=False) as tmp:
                output_path = tmp.name

            await asyncio.to_thread(generator.generate_report, request.analysis_data, output_path)

            with open(output_path, "rb") as f:
                pdf_bytes = f.read()
                pdf_base64 = base64.b64encode(pdf_bytes).decode('utf-8')

            return {
                "success": True,
                "pdf_base64": pdf_base64,
                "filename": f"{settings.project_name.replace(' ', '_')}_Report.pdf"
            }
        finally:
            if output_path and os.path.exists(output_path):
                os.unlink(output_path)

    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="Report generation failed")


@router.post("/generate")
async def generate_pdf_report(request: GenerateReportRequest):
    """Generate professional PDF report from analysis results.
    
    If a profile is specified, applies profile-based section and diagram toggles.
    Otherwise, uses customization toggles as-is for backward compatibility.
    """
    try:
        from analysis.report_generator import ReportGenerator, ReportSettings
        from fastapi.responses import FileResponse
        from starlette.background import BackgroundTask
        import tempfile
        import os

        customization = request.customization or ReportCustomization()
        
        # Apply profile presets if specified
        customization = apply_profile_to_customization(customization)

        settings = ReportSettings(
            company_name=customization.company_name,
            company_address=customization.company_address,
            company_phone=customization.company_phone,
            company_email=customization.company_email,
            project_name=customization.project_name,
            project_number=customization.project_number,
            project_location=customization.project_location,
            client_name=customization.client_name,
            engineer_name=customization.engineer_name,
            checked_by=customization.checked_by,
            # Section toggles
            include_cover_page=customization.include_cover_page,
            include_toc=customization.include_toc,
            include_input_summary=customization.include_input_summary,
            include_load_cases=customization.include_load_cases,
            include_load_combinations=customization.include_load_combinations,
            include_node_displacements=customization.include_node_displacements,
            include_member_forces=customization.include_member_forces,
            include_reaction_summary=customization.include_reaction_summary,
            include_analysis_results=customization.include_analysis_results,
            include_design_checks=customization.include_design_checks,
            include_diagrams=customization.include_diagrams,
            include_concrete_design=customization.include_concrete_design,
            include_foundation_design=customization.include_foundation_design,
            include_connection_design=customization.include_connection_design,
            # Granular diagram toggles
            include_sfd=customization.include_sfd,
            include_bmd=customization.include_bmd,
            include_deflection=customization.include_deflection,
            include_afd=customization.include_afd,
            include_bmd_my=customization.include_bmd_my,
            include_shear_z=customization.include_shear_z,
            # Load case context
            selected_load_case_id=customization.selected_load_case_id,
            # Metadata minimization
            minimal_metadata=customization.minimal_metadata,
            # Styling
            primary_color=tuple(customization.primary_color),
            page_size=customization.page_size
        )

        generator = ReportGenerator(settings)

        output_path = None
        try:
            with tempfile.NamedTemporaryFile(delete=False, suffix='.pdf') as tmp:
                output_path = tmp.name

            await asyncio.to_thread(generator.generate_report, request.analysis_data, output_path)

            filename = f"{customization.project_name.replace(' ', '_')}_Report_{datetime.now().strftime('%Y%m%d')}.pdf"

            return FileResponse(
                output_path,
                media_type='application/pdf',
                filename=filename,
                headers={"Content-Disposition": f"attachment; filename={filename}"},
                background=BackgroundTask(os.unlink, output_path),
            )
        except Exception:
            if output_path and os.path.exists(output_path):
                os.unlink(output_path)
            raise

    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="Report generation failed")
