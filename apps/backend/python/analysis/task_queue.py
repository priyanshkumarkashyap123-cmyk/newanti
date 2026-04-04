"""
Lightweight async task queue (in-memory) with pluggable handlers.

Use this as a baseline abstraction; can be swapped with Redis/RQ/Celery by
replacing the storage and worker loop while keeping the API stable.
"""

from __future__ import annotations

import asyncio
import uuid
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Awaitable, Callable, Dict, Optional


class TaskStatus(str, Enum):
    PENDING = "pending"
    RUNNING = "running"
    SUCCEEDED = "succeeded"
    FAILED = "failed"


@dataclass
class TaskRecord:
    job_id: str
    task_type: str
    payload: Dict[str, Any]
    status: TaskStatus = TaskStatus.PENDING
    result: Optional[Any] = None
    error: Optional[str] = None


Handler = Callable[[Dict[str, Any]], Awaitable[Any]]


class TaskQueue:
    def __init__(self) -> None:
        self._handlers: Dict[str, Handler] = {}
        self._tasks: Dict[str, TaskRecord] = {}
        self._queue: asyncio.Queue[str] = asyncio.Queue()
        self._worker: Optional[asyncio.Task] = None

    def register_handler(self, task_type: str, handler: Handler) -> None:
        self._handlers[task_type] = handler

    async def enqueue(self, task_type: str, payload: Dict[str, Any]) -> str:
        if task_type not in self._handlers:
            raise ValueError(f"No handler registered for task_type={task_type}")

        job_id = str(uuid.uuid4())
        self._tasks[job_id] = TaskRecord(job_id=job_id, task_type=task_type, payload=payload)
        await self._queue.put(job_id)
        return job_id

    def get(self, job_id: str) -> Optional[TaskRecord]:
        return self._tasks.get(job_id)

    async def _worker_loop(self) -> None:
        while True:
            job_id = await self._queue.get()
            record = self._tasks.get(job_id)
            if record is None:
                self._queue.task_done()
                continue

            handler = self._handlers.get(record.task_type)
            if handler is None:
                record.status = TaskStatus.FAILED
                record.error = "Handler missing"
                self._queue.task_done()
                continue

            record.status = TaskStatus.RUNNING
            try:
                result = await handler(record.payload)
                record.result = result
                record.status = TaskStatus.SUCCEEDED
            except Exception as exc:  # noqa: BLE001
                record.status = TaskStatus.FAILED
                record.error = str(exc)
            finally:
                self._queue.task_done()

    def start_worker(self) -> None:
        if self._worker is not None and not self._worker.done():
            return
        try:
            loop = asyncio.get_running_loop()
        except RuntimeError:
            # Import-time contexts (e.g., tests) may not have an active loop yet.
            # Worker can be started later from app lifespan or first async use.
            return
        self._worker = loop.create_task(self._worker_loop())


queue = TaskQueue()


async def example_echo(payload: Dict[str, Any]) -> Dict[str, Any]:
    await asyncio.sleep(0.1)
    return {"echo": payload}


# Register a default echo handler for smoke tests
queue.register_handler("echo", example_echo)
queue.start_worker()