"""Job type registry and routing table for the worker dispatcher."""

from __future__ import annotations

from typing import Callable, Dict

from analysis.worker_models import Job

# Route name -> coroutine function(Job) -> Dict
JobHandler = Callable[[Job], Dict]


def get_job_registry() -> Dict[str, JobHandler]:
    """Return the mapping of job types to handler functions."""
    from analysis.worker_dispatcher import (
        run_static_analysis,
        run_modal_analysis,
        run_pdelta_analysis,
        run_buckling_analysis,
        run_spectrum_analysis,
        run_batch_analysis,
    )

    return {
        "static": run_static_analysis,
        "static_analysis": run_static_analysis,
        "modal": run_modal_analysis,
        "modal_analysis": run_modal_analysis,
        "pdelta": run_pdelta_analysis,
        "pdelta_analysis": run_pdelta_analysis,
        "buckling": run_buckling_analysis,
        "buckling_analysis": run_buckling_analysis,
        "spectrum": run_spectrum_analysis,
        "response_spectrum": run_spectrum_analysis,
        "batch_static": run_batch_analysis,
        "batch_analysis": run_batch_analysis,
    }


__all__ = ["get_job_registry", "JobHandler"]