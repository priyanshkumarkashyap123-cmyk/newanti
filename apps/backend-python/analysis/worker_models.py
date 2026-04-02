"""Data models for the async analysis worker system."""

from __future__ import annotations

import time
from concurrent.futures import ProcessPoolExecutor, ThreadPoolExecutor
from dataclasses import dataclass, field
from enum import Enum, IntEnum
from typing import Dict, Optional
from uuid import uuid4


class JobPriority(IntEnum):
    """Job priority levels (lower = higher priority)."""

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
    """Progress update for a running job."""

    percent: float = 0.0
    stage: str = ""
    message: str = ""
    eta_seconds: Optional[float] = None


@dataclass
class Job:
    """Analysis job in the queue."""

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


@dataclass
class WorkerPools:
    """Process and thread pools used by the worker system."""

    process_pool: ProcessPoolExecutor
    thread_pool: ThreadPoolExecutor
