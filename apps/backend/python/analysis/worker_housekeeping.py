"""Cache and retention helpers for the async worker pool."""

from __future__ import annotations

import asyncio
import time
from typing import Dict, List

from .worker_models import JobStatus


async def cache_cleanup_loop(pool) -> None:
    while pool._running:
        try:
            await asyncio.sleep(300)
            now = time.time()
            expired = [k for k, (_, ts) in pool._cache.items() if now - ts > pool.cache_ttl]
            for k in expired:
                del pool._cache[k]
            if expired:
                pool.logger.info("Cache cleanup: removed %s expired entries", len(expired))
        except asyncio.CancelledError:
            break
        except Exception:
            pass


async def jobs_cleanup_loop(pool) -> None:
    terminal_statuses = {JobStatus.COMPLETED, JobStatus.FAILED, JobStatus.CANCELLED}
    while pool._running:
        try:
            await asyncio.sleep(300)
            now = time.time()
            removable: List[str] = []
            for job_id, job in pool._jobs.items():
                if job.status in terminal_statuses:
                    completed_at = job.completed_at or job.created_at
                    if now - completed_at > pool.job_retention_ttl:
                        removable.append(job_id)
            if len(pool._jobs) - len(removable) > pool.max_job_records:
                overflow = (len(pool._jobs) - len(removable)) - pool.max_job_records
                terminal_jobs = [
                    (job_id, pool._jobs[job_id])
                    for job_id in pool._jobs
                    if pool._jobs[job_id].status in terminal_statuses and job_id not in removable
                ]
                terminal_jobs.sort(key=lambda item: item[1].completed_at or item[1].created_at)
                removable.extend([job_id for job_id, _ in terminal_jobs[:overflow]])
            if removable:
                for job_id in removable:
                    pool._jobs.pop(job_id, None)
                    pool._progress_callbacks.pop(job_id, None)
                pool.logger.info("Jobs cleanup: removed %s old terminal job records", len(removable))
        except asyncio.CancelledError:
            break
        except Exception as e:
            pool.logger.warning("Jobs cleanup loop error: %s", e)
