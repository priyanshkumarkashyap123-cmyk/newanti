"""
Async-ish report job manager for offloading PDF generation to background threads.

This keeps a minimal in-memory registry — suitable for the current deploy model
where workers are sticky. For multi-instance, move state to Redis and run via
Celery/RQ (drop-in swap: replace the spawn and registry accessors).
"""

from __future__ import annotations

import asyncio
import tempfile
import os
import uuid
from datetime import datetime
from typing import TYPE_CHECKING, Any, Dict, Optional, TypedDict, Literal

from analysis.solvers.rc_lsd.serializer import lsd_result_to_dict
from routers.reports_utils import apply_profile_to_customization
from routers.reports_schemas import ReportCustomization

if TYPE_CHECKING:
    from analysis.report_generator import ReportGenerator, ReportSettings


JobStatus = Literal["pending", "running", "succeeded", "failed"]


class ReportJobState(TypedDict, total=False):
    status: JobStatus
    progress: int
    error: Optional[str]
    output_path: Optional[str]
    filename: Optional[str]


_jobs: Dict[str, ReportJobState] = {}
_lock = asyncio.Lock()


def _build_settings(customization: ReportCustomization) -> ReportSettings:
    from analysis.report_generator import ReportSettings

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
        include_sfd=customization.include_sfd,
        include_bmd=customization.include_bmd,
        include_deflection=customization.include_deflection,
        include_afd=customization.include_afd,
        include_bmd_my=customization.include_bmd_my,
        include_shear_z=customization.include_shear_z,
        selected_load_case_id=customization.selected_load_case_id,
        minimal_metadata=customization.minimal_metadata,
        primary_color=tuple(customization.primary_color),
        page_size=customization.page_size,
    )
    return settings


async def _run_job(job_id: str, analysis_data: Dict[str, Any], customization: ReportCustomization) -> None:
    try:
        async with _lock:
            _jobs[job_id]["status"] = "running"
            _jobs[job_id]["progress"] = 5

        customization = apply_profile_to_customization(customization)
        settings = _build_settings(customization)
        from analysis.report_generator import ReportGenerator
        generator = ReportGenerator(settings)

        # Normalize concrete_design if an LSDDesignResult instance is provided
        concrete_payload = analysis_data.get("concrete_design")
        if concrete_payload and hasattr(concrete_payload, "__class__"):
            # Accept LSDDesignResult directly
            try:
                from analysis.solvers.rc_lsd.models import LSDDesignResult  # local import to avoid import cycle

                if isinstance(concrete_payload, LSDDesignResult):
                    analysis_data = dict(analysis_data)  # shallow copy
                    analysis_data["concrete_design"] = lsd_result_to_dict(concrete_payload)
            except Exception:
                # If any issue, leave payload as-is; rendering will show missing data
                pass

        with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
            output_path = tmp.name

        filename = f"{customization.project_name.replace(' ', '_')}_Report_{datetime.now().strftime('%Y%m%d')}.pdf"

        await asyncio.to_thread(generator.generate_report, analysis_data, output_path)

        async with _lock:
            _jobs[job_id].update(
                status="succeeded",
                progress=100,
                output_path=output_path,
                filename=filename,
            )
    except Exception as exc:  # noqa: BLE001
        async with _lock:
            _jobs[job_id]["status"] = "failed"
            _jobs[job_id]["error"] = str(exc)
            _jobs[job_id]["progress"] = 100


async def enqueue_report_job(analysis_data: Dict[str, Any], customization: Optional[ReportCustomization] = None) -> str:
    job_id = str(uuid.uuid4())
    async with _lock:
        _jobs[job_id] = {
            "status": "pending",
            "progress": 0,
            "error": None,
            "output_path": None,
            "filename": None,
        }

    customization = customization or ReportCustomization()
    asyncio.create_task(_run_job(job_id, analysis_data, customization))
    return job_id


async def get_job_state(job_id: str) -> Optional[ReportJobState]:
    async with _lock:
        return _jobs.get(job_id)


async def cleanup_job(job_id: str) -> None:
    async with _lock:
        state = _jobs.pop(job_id, None)
    if state and state.get("output_path"):
        try:
            os.unlink(state["output_path"])
        except OSError:
            pass