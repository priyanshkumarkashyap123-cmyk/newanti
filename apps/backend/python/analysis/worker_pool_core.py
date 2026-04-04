"""Worker pool core logic and singleton management."""

from __future__ import annotations

import asyncio
import logging
import time
from concurrent.futures import ProcessPoolExecutor, ThreadPoolExecutor
from typing import Callable, Dict, List, Optional

from .worker_models import Job, JobPriority, JobProgress, JobStatus
from .worker_pool_cache import ResultCache
from .worker_pool_config import load_worker_pool_config
from .worker_pool_executor import JobExecutor
from .worker_housekeeping import cache_cleanup_loop, jobs_cleanup_loop

logger = logging.getLogger("beamlab.workers")


class AnalysisWorkerPool:
    """
    Background worker pool for structural analysis jobs.

    Uses ProcessPool for CPU-bound analysis and ThreadPool for IO-bound tasks.
    Maintains a priority queue with configurable concurrency.
    """

    def __init__(
        self,
        max_workers: int = 4,
        max_queue_size: int = 1000,
        enable_cache: bool = True,
        cache_ttl: int = 3600,
        job_retention_ttl: int = 1800,
        max_job_records: int = 5000,
    ):
        self.max_workers = max_workers
        self.max_queue_size = max_queue_size
        self.enable_cache = enable_cache
        self.cache_ttl = cache_ttl
        self.job_retention_ttl = job_retention_ttl
        self.max_job_records = max_job_records

        # Job storage
        self._jobs: Dict[str, Job] = {}
        self._queue: asyncio.PriorityQueue = asyncio.PriorityQueue(maxsize=max_queue_size)

        # Worker pool for CPU-bound analysis
        self._process_pool = ProcessPoolExecutor(max_workers=max(1, max_workers - 1))
        self._thread_pool = ThreadPoolExecutor(max_workers=max_workers)

        # Result cache
        self._cache = ResultCache(ttl=cache_ttl)

        # Progress callback subscribers: job_id -> list of callbacks
        self._progress_callbacks: Dict[str, List[Callable]] = {}

        # Worker tasks
        self._workers: List[asyncio.Task] = []
        self._running = False

        # Stats
        self._stats = {
            "total_submitted": 0,
            "total_completed": 0,
            "total_failed": 0,
            "cache_hits": 0,
            "total_solve_time_ms": 0.0,
        }

    async def start(self):
        """Start worker coroutines"""
        if self._running:
            return
        self._running = True

        for i in range(self.max_workers):
            task = asyncio.create_task(self._worker_loop(i))
            self._workers.append(task)

        # Start cache cleanup task
        self._workers.append(asyncio.create_task(cache_cleanup_loop(self)))
        self._workers.append(asyncio.create_task(jobs_cleanup_loop(self)))

        logger.info(f"Worker pool started with {self.max_workers} workers")

    async def shutdown(self, timeout: float = 30.0):
        """Graceful shutdown"""
        self._running = False

        # Cancel queued jobs
        while not self._queue.empty():
            try:
                self._queue.get_nowait()
            except asyncio.QueueEmpty:
                break

        # Wait for running workers
        if self._workers:
            done, pending = await asyncio.wait(self._workers, timeout=timeout)
            for task in pending:
                task.cancel()

        self._process_pool.shutdown(wait=False)
        self._thread_pool.shutdown(wait=False)
        logger.info("Worker pool shut down")

    async def submit(
        self,
        job_type: str,
        input_data: Dict,
        priority: JobPriority = JobPriority.NORMAL,
        user_id: Optional[str] = None,
    ) -> str:
        """
        Submit an analysis job to the queue.

        Returns job_id for polling status.
        """
        # Compute cache key
        cache_key = self._cache.compute_cache_key(job_type, input_data)

        # Check cache first
        if self.enable_cache:
            cached_result = self._cache.get(cache_key)
            if cached_result is not None:
                self._stats["cache_hits"] += 1
                # Create a completed job immediately
                job = Job(
                    job_type=job_type,
                    priority=priority,
                    status=JobStatus.COMPLETED,
                    user_id=user_id,
                    input_data=input_data,
                    result=cached_result,
                    completed_at=time.time(),
                    cache_key=cache_key,
                )
                job.progress = JobProgress(percent=100.0, stage="cached", message="Result from cache")
                self._jobs[job.id] = job
                self._stats["total_submitted"] += 1
                self._stats["total_completed"] += 1
                return job.id

        job = Job(
            job_type=job_type,
            priority=priority,
            user_id=user_id,
            input_data=input_data,
            cache_key=cache_key,
        )
        self._jobs[job.id] = job
        self._stats["total_submitted"] += 1

        # Priority queue entry: (priority_value, timestamp, job_id)
        await self._queue.put((priority.value, job.created_at, job.id))

        logger.info(f"Job {job.id} submitted: {job_type} (priority={priority.name})")
        return job.id

    def get_job(self, job_id: str) -> Optional[Job]:
        """Get job by ID"""
        return self._jobs.get(job_id)

    def cancel_job(self, job_id: str) -> bool:
        """Cancel a queued job (cannot cancel running jobs)"""
        job = self._jobs.get(job_id)
        if job and job.status == JobStatus.QUEUED:
            job.status = JobStatus.CANCELLED
            return True
        return False

    def get_queue_status(self) -> Dict:
        """Get queue statistics"""
        status_counts = {}
        for job in self._jobs.values():
            status_counts[job.status.value] = status_counts.get(job.status.value, 0) + 1

        return {
            "queue_size": self._queue.qsize(),
            "total_jobs": len(self._jobs),
            "status_counts": status_counts,
            "stats": self._stats.copy(),
            "workers": self.max_workers,
            "cache_entries": self._cache.get_size(),
        }

    def on_progress(self, job_id: str, callback: Callable):
        """Register a progress callback for a job"""
        if job_id not in self._progress_callbacks:
            self._progress_callbacks[job_id] = []
        self._progress_callbacks[job_id].append(callback)

    # ============================================
    # Internal worker loop
    # ============================================

    async def _worker_loop(self, worker_id: int):
        """Main worker coroutine - picks jobs from queue and executes"""
        logger.info(f"Worker {worker_id} started")

        while self._running:
            try:
                # Wait for a job with timeout (allows graceful shutdown)
                try:
                    priority, timestamp, job_id = await asyncio.wait_for(self._queue.get(), timeout=2.0)
                except asyncio.TimeoutError:
                    continue

                job = self._jobs.get(job_id)
                if not job or job.status == JobStatus.CANCELLED:
                    continue

                # Execute the job
                await JobExecutor.execute_job(job, worker_id, self)

            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Worker {worker_id} error: {e}")
                await asyncio.sleep(1)

        logger.info(f"Worker {worker_id} stopped")

    # ============================================
    # Notification & Cache helpers
    # ============================================

    async def _notify_progress(self, job: Job):
        """Send progress update to registered callbacks"""
        callbacks = self._progress_callbacks.get(job.id, [])
        for cb in callbacks:
            try:
                if asyncio.iscoroutinefunction(cb):
                    await cb(job)
                else:
                    cb(job)
            except Exception as e:
                logger.warning(f"Progress callback error: {e}")


# ============================================
# Global worker pool singleton
# ============================================

_pool: Optional[AnalysisWorkerPool] = None


async def get_worker_pool() -> AnalysisWorkerPool:
    """Get or create the global worker pool"""
    global _pool
    if _pool is None:
        cfg = load_worker_pool_config()
        _pool = AnalysisWorkerPool(**cfg)
        await _pool.start()
    return _pool


async def shutdown_worker_pool():
    """Shutdown the global worker pool"""
    global _pool
    if _pool:
        await _pool.shutdown()
        _pool = None


__all__ = ["AnalysisWorkerPool", "get_worker_pool", "shutdown_worker_pool"]