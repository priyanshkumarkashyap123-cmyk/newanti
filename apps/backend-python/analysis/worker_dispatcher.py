"""Analysis job dispatch helpers for the worker pool."""

from __future__ import annotations

from typing import Dict

from .worker_models import Job
from .worker_jobs import get_job_registry


async def run_static_analysis(job: Job) -> Dict:
    from analysis.rust_interop import analyze_with_best_backend

    result = await analyze_with_best_backend(job.input_data, analysis_type="static")
    if not result.success:
        raise RuntimeError(result.error or "Analysis failed")
    return {
        "displacements": result.displacements,
        "reactions": result.reactions,
        "member_forces": result.member_forces,
        "backend_used": result.backend_used,
        "solve_time_ms": result.solve_time_ms,
    }


async def run_modal_analysis(job: Job) -> Dict:
    from analysis.rust_interop import analyze_with_best_backend

    result = await analyze_with_best_backend(job.input_data, analysis_type="modal")
    if not result.success:
        raise RuntimeError(result.error or "Modal analysis failed")
    return {
        "modes": result.modes,
        "backend_used": result.backend_used,
        "solve_time_ms": result.solve_time_ms,
    }


async def run_pdelta_analysis(job: Job) -> Dict:
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


async def run_buckling_analysis(job: Job) -> Dict:
    from analysis.rust_interop import analyze_with_best_backend

    result = await analyze_with_best_backend(job.input_data, analysis_type="buckling")
    if not result.success:
        raise RuntimeError(result.error or "Buckling analysis failed")
    return {
        "modes": result.modes,
        "backend_used": result.backend_used,
        "solve_time_ms": result.solve_time_ms,
    }


async def run_spectrum_analysis(job: Job) -> Dict:
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


async def run_batch_analysis(job: Job) -> Dict:
    from analysis.rust_interop import analyze_with_best_backend

    models = job.input_data.get("models", [])
    analysis_type = job.input_data.get("analysis_type", "static")
    results = []
    for i, model in enumerate(models):
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


def list_supported_job_types():
    """Return sorted list of supported job type strings."""
    return sorted(get_job_registry().keys())
