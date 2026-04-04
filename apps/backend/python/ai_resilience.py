"""LLM resilience utilities for timeout/retry/circuit-breaker protection.

This module centralizes resilience behavior for external LLM calls so all
AI pathways fail safely and consistently under transient dependency issues.
"""

from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor, TimeoutError as FutureTimeoutError
from dataclasses import dataclass
from threading import Lock
from time import monotonic, sleep
from typing import Callable, Optional, TypeVar, Generic, Dict, Any


T = TypeVar("T")


@dataclass
class LLMExecutionResult(Generic[T]):
    """Outcome of a resilient LLM call execution."""

    success: bool
    value: Optional[T] = None
    error: Optional[str] = None
    attempts: int = 0
    timed_out: bool = False
    circuit_open: bool = False
    duration_ms: float = 0.0


class LLMResilienceGuard:
    """Timeout + retry + circuit-breaker wrapper for LLM calls."""

    _state_lock = Lock()
    _circuit_state: Dict[str, Dict[str, Any]] = {}

    def __init__(
        self,
        key: str,
        timeout_seconds: float = 12.0,
        max_retries: int = 2,
        retry_backoff_seconds: float = 0.35,
        circuit_failure_threshold: int = 3,
        circuit_reset_seconds: float = 45.0,
    ) -> None:
        self.key = key
        self.timeout_seconds = timeout_seconds
        self.max_retries = max_retries
        self.retry_backoff_seconds = retry_backoff_seconds
        self.circuit_failure_threshold = circuit_failure_threshold
        self.circuit_reset_seconds = circuit_reset_seconds

    def execute(self, fn: Callable[[], T]) -> LLMExecutionResult[T]:
        start = monotonic()
        if self._is_circuit_open():
            return LLMExecutionResult(
                success=False,
                error="circuit_open",
                attempts=0,
                circuit_open=True,
                duration_ms=(monotonic() - start) * 1000.0,
            )

        last_error = "unknown_error"
        timed_out = False
        attempts = self.max_retries + 1

        for attempt in range(1, attempts + 1):
            try:
                value = self._run_with_timeout(fn, self.timeout_seconds)
                self._record_success()
                return LLMExecutionResult(
                    success=True,
                    value=value,
                    attempts=attempt,
                    duration_ms=(monotonic() - start) * 1000.0,
                )
            except FutureTimeoutError:
                last_error = "timeout"
                timed_out = True
                self._record_failure()
            except Exception as exc:  # noqa: BLE001
                last_error = str(exc)
                self._record_failure()

            if attempt < attempts:
                sleep(self.retry_backoff_seconds * attempt)

        return LLMExecutionResult(
            success=False,
            error=last_error,
            attempts=attempts,
            timed_out=timed_out,
            duration_ms=(monotonic() - start) * 1000.0,
        )

    def _run_with_timeout(self, fn: Callable[[], T], timeout_seconds: float) -> T:
        with ThreadPoolExecutor(max_workers=1) as executor:
            future = executor.submit(fn)
            return future.result(timeout=timeout_seconds)

    def _is_circuit_open(self) -> bool:
        now = monotonic()
        with self._state_lock:
            state = self._circuit_state.setdefault(
                self.key,
                {"failures": 0, "opened_at": None},
            )
            opened_at = state.get("opened_at")

            if opened_at is None:
                return False

            if (now - opened_at) >= self.circuit_reset_seconds:
                # Half-open style reset: allow new attempts after cooldown.
                state["opened_at"] = None
                state["failures"] = 0
                return False

            return True

    def _record_success(self) -> None:
        with self._state_lock:
            state = self._circuit_state.setdefault(
                self.key,
                {"failures": 0, "opened_at": None},
            )
            state["failures"] = 0
            state["opened_at"] = None

    def _record_failure(self) -> None:
        with self._state_lock:
            state = self._circuit_state.setdefault(
                self.key,
                {"failures": 0, "opened_at": None},
            )
            state["failures"] += 1
            if state["failures"] >= self.circuit_failure_threshold:
                state["opened_at"] = monotonic()
