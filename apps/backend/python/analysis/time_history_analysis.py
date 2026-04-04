"""
Time history analysis (Python) — deprecated.

Rust backend is authoritative for all dynamic analysis:
- Modal analysis: Rust solver/dynamics.rs
- Time-history integration: Rust solver/dynamics.rs
- Response spectrum: Rust solver/dynamics.rs

This stub preserves imports but raises to prevent accidental Python execution.

Rust authoritative entrypoints:
- Modal:   POST /analysis/modal
- Spectrum: POST /analysis/response-spectrum
- Time history: POST /analysis/time-history

Python endpoints should import from Rust-backed client modules instead of this file.
"""

from dataclasses import dataclass
from typing import Any

class DeprecatedDynamicAnalysisError(RuntimeError):
    pass


@dataclass
class GroundMotion:
    name: str = "deprecated"
    acceleration: Any = None
    time: Any = None
    dt: float = 0.0
    pga: float = 0.0
    duration: float = 0.0
    scale_factor: float = 1.0


class TimeHistoryAnalyzer:
    """Deprecated Python dynamic analyzer stub (use Rust)."""

    def __init__(self, *_, **__):
        self.damping_ratio: float = 0.05

    def _error(self, method: str) -> DeprecatedDynamicAnalysisError:
        return DeprecatedDynamicAnalysisError(
            f"{method} is removed. Use Rust backend via /analysis/time-history."
        )

    def modal_analysis(self, *_args, **_kwargs):
        raise self._error("modal_analysis")

    def newmark_beta_integration(self, *_args, **_kwargs):
        raise self._error("newmark_beta_integration")

    def get_response_spectrum(self, *_args, **_kwargs):
        raise self._error("get_response_spectrum")


def load_ground_motion(*_args, **_kwargs) -> GroundMotion:
    raise DeprecatedDynamicAnalysisError(
        "load_ground_motion removed. Ground motion is handled in Rust backend."
    )


__all__ = [
    "TimeHistoryAnalyzer",
    "GroundMotion",
    "load_ground_motion",
    "DeprecatedDynamicAnalysisError",
]
