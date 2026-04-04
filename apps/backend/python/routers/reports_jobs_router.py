"""
Async report job endpoints: create job, poll status, download artifact.

Notes:
- In-memory registry; for multi-instance deploy, move to Redis + Celery/RQ.
- Download endpoint streams the generated PDF if ready.
"""

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
from starlette.background import BackgroundTask
from typing import Any

from routers.reports_schemas import ReportCustomization
from analysis.report_jobs import enqueue_report_job, get_job_state, cleanup_job

router = APIRouter(prefix="/reports/jobs", tags=["Reports"])


@router.post("", status_code=202)
async def create_report_job(body: dict[str, Any]):
    analysis_data = body.get("analysis_data")
    customization_raw = body.get("customization")

    if analysis_data is None:
        raise HTTPException(status_code=400, detail="analysis_data is required")

    customization = None
    if customization_raw is not None:
        customization = ReportCustomization(**customization_raw)

    job_id = await enqueue_report_job(analysis_data, customization)
    return {"job_id": job_id, "status": "pending"}


@router.get("/{job_id}")
async def get_report_job(job_id: str):
    state = await get_job_state(job_id)
    if state is None:
        raise HTTPException(status_code=404, detail="job not found")
    return {
        "job_id": job_id,
        "status": state.get("status"),
        "progress": state.get("progress", 0),
        "error": state.get("error"),
        "filename": state.get("filename"),
        "download_ready": bool(state.get("output_path")) and state.get("status") == "succeeded",
    }


@router.get("/{job_id}/download")
async def download_report(job_id: str):
    state = await get_job_state(job_id)
    if state is None:
        raise HTTPException(status_code=404, detail="job not found")
    if state.get("status") != "succeeded" or not state.get("output_path"):
        raise HTTPException(status_code=409, detail="report not ready")

    output_path = state["output_path"]
    filename = state.get("filename") or "report.pdf"

    return FileResponse(
        output_path,
        media_type="application/pdf",
        filename=filename,
        background=BackgroundTask(cleanup_job, job_id),
    )