"""
Task queue endpoints (baseline, in-memory). Swap backend storage to Redis/RQ/Celery
by replacing task_queue implementation while keeping this API stable.
"""

from fastapi import APIRouter, HTTPException

from analysis.task_queue import queue, TaskStatus
from routers.task_schemas import normalize_task_payload

router = APIRouter(prefix="/tasks", tags=["Tasks"])


@router.post("", status_code=202)
async def enqueue_task(body: dict):
    task_type, payload = normalize_task_payload(body)
    if not task_type:
        raise HTTPException(status_code=400, detail="task_type is required")

    job_id = await queue.enqueue(task_type, payload)
    return {"job_id": job_id, "status": TaskStatus.PENDING}


@router.get("/{job_id}")
async def get_task(job_id: str):
    record = queue.get(job_id)
    if record is None:
        raise HTTPException(status_code=404, detail="job not found")
    return {
        "job_id": record.job_id,
        "task_type": record.task_type,
        "status": record.status,
        "result": record.result,
        "error": record.error,
    }