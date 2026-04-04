"""
Job execution engine for worker pool.

Handles routing jobs to appropriate solvers and managing execution.
"""

from __future__ import annotations

import asyncio
import logging
import time
import traceback
from typing import TYPE_CHECKING

from .worker_models import JobProgress, JobStatus
from .worker_jobs import get_job_registry

if TYPE_CHECKING:
    from .worker_pool import AnalysisWorkerPool
    from .worker_models import Job

logger = logging.getLogger("beamlab.workers")


class JobExecutor:
    """Execute analysis jobs and route to appropriate solvers"""
    
    @staticmethod
    async def execute_job(
        job: Job,
        worker_id: int,
        worker_pool: AnalysisWorkerPool,
    ):
        """Execute a single analysis job"""
        job.status = JobStatus.RUNNING
        job.started_at = time.time()
        job.progress = JobProgress(percent=0.0, stage="starting", message="Initializing solver")
        await worker_pool._notify_progress(job)
        
        try:
            # Route to appropriate solver
            result = await JobExecutor._route_job(job)
            
            # Success
            job.status = JobStatus.COMPLETED
            job.result = result
            job.completed_at = time.time()
            job.progress = JobProgress(
                percent=100.0,
                stage="complete",
                message="Analysis completed successfully",
            )
            
            solve_time = (job.completed_at - job.started_at) * 1000
            worker_pool._stats["total_completed"] += 1
            worker_pool._stats["total_solve_time_ms"] += solve_time
            
            # Cache the result
            if worker_pool.enable_cache and job.cache_key:
                worker_pool._cache[job.cache_key] = (result, time.time())
            
            logger.info(f"Job {job.id} completed in {solve_time:.0f}ms")
            
        except Exception as e:
            # Retry logic
            if job.retries < job.max_retries:
                job.retries += 1
                job.status = JobStatus.RETRYING
                job.progress = JobProgress(
                    stage="retrying",
                    message=f"Retry {job.retries}/{job.max_retries}: {str(e)[:100]}",
                )
                await worker_pool._notify_progress(job)
                
                # Re-queue with slight delay
                await asyncio.sleep(2 ** job.retries)
                job.status = JobStatus.QUEUED
                await worker_pool._queue.put((job.priority.value, job.created_at, job.id))
                logger.warning(f"Job {job.id} retrying ({job.retries}/{job.max_retries})")
            else:
                job.status = JobStatus.FAILED
                job.error = str(e)
                job.completed_at = time.time()
                job.progress = JobProgress(
                    stage="failed",
                    message=f"Analysis failed: {str(e)[:200]}",
                )
                worker_pool._stats["total_failed"] += 1
                logger.error(f"Job {job.id} failed: {e}\n{traceback.format_exc()}")
        
        await worker_pool._notify_progress(job)
    
    @staticmethod
    async def _route_job(job: Job):
        """Route job to appropriate solver based on type using registry."""
        registry = get_job_registry()
        handler = registry.get(job.job_type)
        if handler is None:
            raise ValueError(f"Unknown job type: {job.job_type}")
        return await handler(job)


__all__ = ["JobExecutor"]
