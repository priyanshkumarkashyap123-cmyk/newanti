"""
Async Worker System for Long-Running Analysis

Production-grade background task infrastructure:
- Priority-based job queue (urgent, high, normal, low)
- Configurable worker pool (CPU-bound via ProcessPool, IO-bound via ThreadPool)
- Progress tracking with WebSocket broadcast
- Automatic retry on transient failures
- Result caching with TTL
- Graceful shutdown

Architecture:
    FastAPI endpoint -> submit_job() -> Queue -> Worker picks up -> 
    -> Solver runs (Python or Rust) -> Progress updates via WS -> 
    -> Result cached -> Client polls or receives via WS
"""

import asyncio
import hashlib
import json
import logging
import time
import traceback
from concurrent.futures import ProcessPoolExecutor, ThreadPoolExecutor
from dataclasses import dataclass, field
from enum import Enum, IntEnum
from typing import Any, Callable, Coroutine, Dict, List, Optional
from uuid import uuid4

logger = logging.getLogger("beamlab.workers")


class JobPriority(IntEnum):
    """Job priority levels (lower = higher priority)"""
    URGENT = 0
    HIGH = 1
    NORMAL = 2
    LOW = 3
    BATCH = 4


class JobStatus(str, Enum):
    QUEUED = "queued"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"
    RETRYING = "retrying"


@dataclass
class JobProgress:
    """Progress update for a running job"""
    percent: float = 0.0
    stage: str = ""
    message: str = ""
    eta_seconds: Optional[float] = None


@dataclass
class Job:
    """Analysis job in the queue"""
    id: str = field(default_factory=lambda: str(uuid4()))
    job_type: str = ""
    priority: JobPriority = JobPriority.NORMAL
    status: JobStatus = JobStatus.QUEUED
    user_id: Optional[str] = None
    input_data: Dict = field(default_factory=dict)
    result: Optional[Dict] = None
    error: Optional[str] = None
    progress: JobProgress = field(default_factory=JobProgress)
    created_at: float = field(default_factory=time.time)
    started_at: Optional[float] = None
    completed_at: Optional[float] = None
    retries: int = 0
    max_retries: int = 2
    cache_key: Optional[str] = None


class AnalysisWorkerPool:
    """
    Background worker pool for structural analysis jobs.
    
    Uses ProcessPool for CPU-bound analysis and ThreadPool for IO-bound tasks.
    Maintains a priority queue with configurable concurrency.
    
    Usage:
        pool = AnalysisWorkerPool(max_workers=4)
        await pool.start()
        job_id = await pool.submit("static_analysis", model_data, priority=JobPriority.HIGH)
        status = pool.get_job(job_id)
        await pool.shutdown()
    """
    
    def __init__(
        self,
        max_workers: int = 4,
        max_queue_size: int = 1000,
        enable_cache: bool = True,
        cache_ttl: int = 3600,
    ):
        self.max_workers = max_workers
        self.max_queue_size = max_queue_size
        self.enable_cache = enable_cache
        self.cache_ttl = cache_ttl
        
        # Job storage
        self._jobs: Dict[str, Job] = {}
        self._queue: asyncio.PriorityQueue = asyncio.PriorityQueue(maxsize=max_queue_size)
        
        # Worker pool for CPU-bound analysis
        self._process_pool = ProcessPoolExecutor(max_workers=max(1, max_workers - 1))
        self._thread_pool = ThreadPoolExecutor(max_workers=max_workers)
        
        # Result cache: hash -> (result, timestamp)
        self._cache: Dict[str, tuple] = {}
        
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
        self._workers.append(asyncio.create_task(self._cache_cleanup_loop()))
        
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
            done, pending = await asyncio.wait(
                self._workers, timeout=timeout
            )
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
        # Check cache first
        cache_key = self._compute_cache_key(job_type, input_data)
        if self.enable_cache and cache_key in self._cache:
            cached_result, cached_time = self._cache[cache_key]
            if time.time() - cached_time < self.cache_ttl:
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
            "cache_entries": len(self._cache),
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
                    priority, timestamp, job_id = await asyncio.wait_for(
                        self._queue.get(), timeout=2.0
                    )
                except asyncio.TimeoutError:
                    continue
                
                job = self._jobs.get(job_id)
                if not job or job.status == JobStatus.CANCELLED:
                    continue
                
                # Execute the job
                await self._execute_job(job, worker_id)
                
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Worker {worker_id} error: {e}")
                await asyncio.sleep(1)
        
        logger.info(f"Worker {worker_id} stopped")
    
    async def _execute_job(self, job: Job, worker_id: int):
        """Execute a single analysis job"""
        job.status = JobStatus.RUNNING
        job.started_at = time.time()
        job.progress = JobProgress(percent=0.0, stage="starting", message="Initializing solver")
        await self._notify_progress(job)
        
        try:
            # Route to appropriate solver
            if job.job_type in ("static", "static_analysis"):
                result = await self._run_static_analysis(job)
            elif job.job_type in ("modal", "modal_analysis"):
                result = await self._run_modal_analysis(job)
            elif job.job_type in ("pdelta", "pdelta_analysis"):
                result = await self._run_pdelta_analysis(job)
            elif job.job_type in ("buckling", "buckling_analysis"):
                result = await self._run_buckling_analysis(job)
            elif job.job_type in ("spectrum", "response_spectrum"):
                result = await self._run_spectrum_analysis(job)
            elif job.job_type in ("batch_static", "batch_analysis"):
                result = await self._run_batch_analysis(job)
            else:
                raise ValueError(f"Unknown job type: {job.job_type}")
            
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
            self._stats["total_completed"] += 1
            self._stats["total_solve_time_ms"] += solve_time
            
            # Cache the result
            if self.enable_cache and job.cache_key:
                self._cache[job.cache_key] = (result, time.time())
            
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
                await self._notify_progress(job)
                
                # Re-queue with slight delay
                await asyncio.sleep(2 ** job.retries)
                job.status = JobStatus.QUEUED
                await self._queue.put((job.priority.value, job.created_at, job.id))
                logger.warning(f"Job {job.id} retrying ({job.retries}/{job.max_retries})")
            else:
                job.status = JobStatus.FAILED
                job.error = str(e)
                job.completed_at = time.time()
                job.progress = JobProgress(
                    stage="failed",
                    message=f"Analysis failed: {str(e)[:200]}",
                )
                self._stats["total_failed"] += 1
                logger.error(f"Job {job.id} failed: {e}\n{traceback.format_exc()}")
        
        await self._notify_progress(job)
    
    # ============================================
    # Analysis Solvers
    # ============================================
    
    async def _run_static_analysis(self, job: Job) -> Dict:
        """Run static analysis with progress updates"""
        from analysis.rust_interop import analyze_with_best_backend
        
        job.progress = JobProgress(percent=10.0, stage="assembling", message="Building stiffness matrix")
        await self._notify_progress(job)
        
        result = await analyze_with_best_backend(
            job.input_data, analysis_type="static"
        )
        
        job.progress = JobProgress(percent=90.0, stage="post_processing", message="Computing member forces")
        await self._notify_progress(job)
        
        if not result.success:
            raise RuntimeError(result.error or "Analysis failed")
        
        return {
            "displacements": result.displacements,
            "reactions": result.reactions,
            "member_forces": result.member_forces,
            "backend_used": result.backend_used,
            "solve_time_ms": result.solve_time_ms,
        }
    
    async def _run_modal_analysis(self, job: Job) -> Dict:
        """Run modal (eigenvalue) analysis"""
        from analysis.rust_interop import analyze_with_best_backend
        
        n_modes = job.input_data.get("options", {}).get("n_modes", 10)
        
        job.progress = JobProgress(percent=10.0, stage="assembling", message="Building mass matrix")
        await self._notify_progress(job)
        
        result = await analyze_with_best_backend(
            job.input_data, analysis_type="modal",
        )
        
        if not result.success:
            raise RuntimeError(result.error or "Modal analysis failed")
        
        return {
            "modes": result.modes,
            "backend_used": result.backend_used,
            "solve_time_ms": result.solve_time_ms,
        }
    
    async def _run_pdelta_analysis(self, job: Job) -> Dict:
        """Run P-Delta analysis"""
        from analysis.rust_interop import get_rust_client
        
        client = get_rust_client()
        result = await client.run_pdelta(
            job.input_data,
            max_iterations=job.input_data.get("max_iterations", 10),
            tolerance=job.input_data.get("tolerance", 1e-4),
        )
        
        if not result.success:
            raise RuntimeError(result.error or "P-Delta analysis failed")
        
        return {
            "displacements": result.displacements,
            "reactions": result.reactions,
            "member_forces": result.member_forces,
            "backend_used": result.backend_used,
            "solve_time_ms": result.solve_time_ms,
        }
    
    async def _run_buckling_analysis(self, job: Job) -> Dict:
        """Run buckling analysis"""
        from analysis.rust_interop import analyze_with_best_backend
        
        result = await analyze_with_best_backend(
            job.input_data, analysis_type="buckling"
        )
        
        if not result.success:
            raise RuntimeError(result.error or "Buckling analysis failed")
        
        return {
            "modes": result.modes,
            "backend_used": result.backend_used,
            "solve_time_ms": result.solve_time_ms,
        }
    
    async def _run_spectrum_analysis(self, job: Job) -> Dict:
        """Run response spectrum analysis"""
        from analysis.rust_interop import get_rust_client
        
        client = get_rust_client()
        options = job.input_data.get("options", {})
        
        result = await client.run_response_spectrum(
            job.input_data,
            spectrum_data=options.get("spectrum", []),
            zone_factor=options.get("zone_factor", 0.16),
            importance_factor=options.get("importance_factor", 1.0),
            response_reduction=options.get("response_reduction", 5.0),
            soil_type=options.get("soil_type", "medium"),
            combination_method=options.get("combination_method", "CQC"),
        )
        
        if not result.success:
            raise RuntimeError(result.error or "Spectrum analysis failed")
        
        return {
            "displacements": result.displacements,
            "member_forces": result.member_forces,
            "modes": result.modes,
            "backend_used": result.backend_used,
            "solve_time_ms": result.solve_time_ms,
        }
    
    async def _run_batch_analysis(self, job: Job) -> Dict:
        """Run batch analysis for multiple models"""
        models = job.input_data.get("models", [])
        analysis_type = job.input_data.get("analysis_type", "static")
        results = []
        
        for i, model in enumerate(models):
            job.progress = JobProgress(
                percent=(i / len(models)) * 100,
                stage="batch",
                message=f"Analyzing model {i + 1}/{len(models)}",
            )
            await self._notify_progress(job)
            
            from analysis.rust_interop import analyze_with_best_backend
            result = await analyze_with_best_backend(model, analysis_type)
            results.append({
                "model_index": i,
                "success": result.success,
                "backend_used": result.backend_used,
                "solve_time_ms": result.solve_time_ms,
                "displacements": result.displacements,
                "reactions": result.reactions,
                "error": result.error,
            })
        
        return {
            "batch_results": results,
            "total_models": len(models),
            "successful": sum(1 for r in results if r["success"]),
        }
    
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
    
    async def _cache_cleanup_loop(self):
        """Periodically remove expired cache entries"""
        while self._running:
            try:
                await asyncio.sleep(300)  # Every 5 minutes
                now = time.time()
                expired = [
                    k for k, (_, ts) in self._cache.items()
                    if now - ts > self.cache_ttl
                ]
                for k in expired:
                    del self._cache[k]
                if expired:
                    logger.info(f"Cache cleanup: removed {len(expired)} expired entries")
            except asyncio.CancelledError:
                break
            except Exception:
                pass
    
    def _compute_cache_key(self, job_type: str, input_data: Dict) -> str:
        """Deterministic hash for caching results"""
        canonical = json.dumps(
            {"type": job_type, "input": input_data},
            sort_keys=True,
            default=str,
        )
        return hashlib.sha256(canonical.encode()).hexdigest()[:16]


# ============================================
# Global worker pool singleton
# ============================================

_pool: Optional[AnalysisWorkerPool] = None


async def get_worker_pool() -> AnalysisWorkerPool:
    """Get or create the global worker pool"""
    global _pool
    if _pool is None:
        import os
        max_workers = int(os.getenv("ANALYSIS_WORKERS", "4"))
        _pool = AnalysisWorkerPool(max_workers=max_workers)
        await _pool.start()
    return _pool


async def shutdown_worker_pool():
    """Shutdown the global worker pool"""
    global _pool
    if _pool:
        await _pool.shutdown()
        _pool = None
