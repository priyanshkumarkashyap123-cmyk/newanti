"""Shared task request/response helpers."""

from typing import Any, Dict, Optional


def normalize_task_payload(body: Dict[str, Any]) -> tuple[Optional[str], Dict[str, Any]]:
    """Extract the task type and payload from a request body."""
    task_type = body.get("task_type")
    payload = body.get("payload") or {}
    return task_type, payload
