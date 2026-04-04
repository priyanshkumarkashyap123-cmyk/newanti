"""
Org-scoped report template management endpoints.
"""

from fastapi import APIRouter, HTTPException
from typing import Optional, Dict, Any, List, Literal
from datetime import datetime, timezone
from uuid import uuid4

from .reports_schemas import (
    ReportTemplateCreateRequest,
    ReportTemplateUpdateRequest,
    ReportTemplateResponse,
)

router = APIRouter(prefix="/reports", tags=["Reports"])

# In-memory store
_ORG_REPORT_TEMPLATES: Dict[str, Dict[str, Dict[str, Any]]] = {}


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
    org_bucket = _ensure_org_bucket(org_id)
    template = org_bucket.get(template_id)
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")

    if not _can_access_template(template, actor_user_id):
        raise HTTPException(status_code=403, detail="Template not visible to actor")

    return ReportTemplateResponse(**template)


@router.put("/orgs/{org_id}/templates/{template_id}", response_model=ReportTemplateResponse)
async def update_org_report_template(org_id: str, template_id: str, request: ReportTemplateUpdateRequest):
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
    org_bucket = _ensure_org_bucket(org_id)
    template = org_bucket.get(template_id)
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")

    if not _can_modify_template(template, actor_user_id, actor_role):
        raise HTTPException(status_code=403, detail="Actor cannot delete this template")

    del org_bucket[template_id]
    return {"success": True, "deleted_template_id": template_id}
