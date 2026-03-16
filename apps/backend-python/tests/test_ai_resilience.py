"""Deterministic tests for AI LLM resilience guard."""

from __future__ import annotations

import time

from ai_resilience import LLMResilienceGuard


def test_llm_guard_retries_then_succeeds() -> None:
    attempts = {"count": 0}

    def flaky_call() -> str:
        attempts["count"] += 1
        if attempts["count"] < 2:
            raise RuntimeError("transient error")
        return "ok"

    guard = LLMResilienceGuard(
        key="test_retry_success_unique",
        timeout_seconds=1.0,
        max_retries=2,
        retry_backoff_seconds=0.01,
        circuit_failure_threshold=5,
        circuit_reset_seconds=1.0,
    )

    result = guard.execute(flaky_call)

    assert result.success is True
    assert result.value == "ok"
    assert result.attempts == 2
    assert attempts["count"] == 2


def test_llm_guard_timeout_marks_failed() -> None:
    def slow_call() -> str:
        time.sleep(0.12)
        return "too late"

    guard = LLMResilienceGuard(
        key="test_timeout_unique",
        timeout_seconds=0.02,
        max_retries=0,
        retry_backoff_seconds=0.0,
        circuit_failure_threshold=5,
        circuit_reset_seconds=1.0,
    )

    result = guard.execute(slow_call)

    assert result.success is False
    assert result.timed_out is True
    assert result.error == "timeout"


def test_llm_guard_circuit_opens_after_threshold() -> None:
    def always_fail() -> str:
        raise RuntimeError("hard failure")

    guard = LLMResilienceGuard(
        key="test_circuit_open_unique",
        timeout_seconds=0.2,
        max_retries=0,
        retry_backoff_seconds=0.0,
        circuit_failure_threshold=1,
        circuit_reset_seconds=100.0,
    )

    first = guard.execute(always_fail)
    second = guard.execute(always_fail)

    assert first.success is False
    assert second.success is False
    assert second.circuit_open is True
    assert second.attempts == 0
