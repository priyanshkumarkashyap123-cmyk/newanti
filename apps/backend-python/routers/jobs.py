"""
Job Queue API Endpoints
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, Dict

router = APIRouter(prefix="/api/jobs", tags=["Jobs"])


class JobSubmitRequest(BaseModel):
    job_type: str  # "static", "modal", "pdelta", "buckling", "spectrum"
    priority: Optional[str] = "normal"
    user_id: Optional[str] = None
    input: Dict


@router.post("/submit")
async def submit_analysis_job(req: JobSubmitRequest):
    """Submit a long-running analysis job to the worker pool"""
    try:
        from analysis.worker_pool import get_worker_pool, JobPriority
        pool = await get_worker_pool()
        priority_map = {
            "urgent": JobPriority.URGENT,
            "high": JobPriority.HIGH,
            "normal": JobPriority.NORMAL,
            "low": JobPriority.LOW,
            "batch": JobPriority.BATCH,
        }
        priority = priority_map.get(req.priority or "normal", JobPriority.NORMAL)
        job_id = await pool.submit(req.job_type, req.input, priority, req.user_id)
        return {"success": True, "job_id": job_id, "message": f"Job queued as {req.priority}"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{job_id}")
async def get_job_status(job_id: str):
    """Get status of an analysis job"""
    try:
        from analysis.worker_pool import get_worker_pool
        pool = await get_worker_pool()
        job = pool.get_job(job_id)
        if not job:
            raise HTTPException(status_code=404, detail="Job not found")
        return {
            "job_id": job.id,
            "status": job.status.value,
            "job_type": job.job_type,
            "progress": {
                "percent": job.progress.percent,
                "stage": job.progress.stage,
                "message": job.progress.message,
            },
            "result": job.result,
            "error": job.error,
            "created_at": job.created_at,
            "started_at": job.started_at,
            "completed_at": job.completed_at,
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{job_id}")
async def cancel_analysis_job(job_id: str):
    """Cancel a queued analysis job"""
    try:
        from analysis.worker_pool import get_worker_pool
        pool = await get_worker_pool()
        cancelled = pool.cancel_job(job_id)
        return {"success": cancelled, "job_id": job_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/queue/status")
async def get_queue_status():
    """Get worker queue statistics"""
    try:
        from analysis.worker_pool import get_worker_pool
        pool = await get_worker_pool()
        return pool.get_queue_status()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
