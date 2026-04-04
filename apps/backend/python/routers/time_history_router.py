"""
Time-history dynamic analysis router (modal, Newmark, spectrum).
"""

from fastapi import APIRouter, HTTPException
import asyncio
import time
import traceback

from logging_config import get_logger
from .stress_schemas import TimeHistoryRequest, TimeHistoryGroundMotion

logger = get_logger(__name__)

router = APIRouter(tags=["Analysis"])


@router.post("/analysis/time-history")
async def time_history_analysis(request: TimeHistoryRequest):
    """
    Perform dynamic time history analysis (Modal, Newmark, Spectrum).

    Rust Backend Authoritative:
    - All analysis types (Modal, Newmark, Spectrum) now use Rust solver exclusively.
    - Python fallback is removed. debug_compare now runs Rust twice (noop) and is retained for API compatibility.
    """
    start_time = time.perf_counter()

    try:
        from analysis.rust_interop import analyze_with_best_backend
        import numpy as np

        print("[TIME-HISTORY] Starting dynamic analysis (rust-only)...")

        analysis_type = request.analysis_type
        damping_ratio = request.damping_ratio

        M = np.array(request.mass_matrix)
        K = np.array(request.stiffness_matrix)

        if M.size == 0 or K.size == 0:
            raise ValueError("Mass and stiffness matrices are required")

        # Force Rust backend only
        results = {}

        if analysis_type == 'modal':
            num_modes = request.num_modes

            # Route modal to Rust (only)
            async def solve_modal_rust():
                rust_model = {
                    "stiffness_matrix": K.tolist() if isinstance(K, np.ndarray) else K,
                    "mass_matrix": M.tolist() if isinstance(M, np.ndarray) else M,
                    "dimension": K.shape[0],
                    "num_modes": num_modes,
                    "mass_type": "consistent",
                    "normalize_modes": True,
                    "compute_participation": True
                }

                rust_result = await analyze_with_best_backend(
                    rust_model,
                    analysis_type="modal",
                    force_backend="rust"
                )

                if not rust_result.success:
                    raise RuntimeError(rust_result.error or "Rust modal analysis failed")

                return {
                    'backend': 'rust',
                    'frequencies_hz': rust_result.metadata.get('frequencies_hz', []),
                    'periods_s': rust_result.metadata.get('periods_s', []),
                    'modal_masses': rust_result.metadata.get('modal_masses', []),
                    'solve_time_ms': (time.perf_counter() - start_time) * 1000
                }

            rust_result = await solve_modal_rust()
            results = {
                'success': True,
                'analysis_type': 'modal',
                'backend_used': 'rust',
                'frequencies_hz': rust_result.get('frequencies_hz', []),
                'periods_s': rust_result.get('periods_s', []),
                'modal_masses': rust_result.get('modal_masses', []),
                'stats': {
                    'backend_used': 'rust',
                    'total_solve_time_ms': (time.perf_counter() - start_time) * 1000,
                    'rust_solve_time_ms': rust_result.get('solve_time_ms', 0)
                }
            }

        elif analysis_type == 'newmark':
            """Time-domain integration using Newmark-beta method (Rust only)."""
            gm_config = request.ground_motion or TimeHistoryGroundMotion()

            rust_model = {
                "mass_matrix": M.tolist() if isinstance(M, np.ndarray) else M,
                "stiffness_matrix": K.tolist() if isinstance(K, np.ndarray) else K,
                "damping_ratio": damping_ratio,
                "ground_motion": {
                    "name": gm_config.name,
                    "scale_factor": gm_config.scale_factor,
                }
            }

            rust_result = await analyze_with_best_backend(
                rust_model,
                analysis_type="time_history",
                force_backend="rust"
            )

            if not rust_result.success:
                raise RuntimeError(rust_result.error or "Rust Newmark solver failed")

            results = {
                'success': True,
                'analysis_type': 'newmark',
                'backend_used': 'rust',
                'max_displacement': rust_result.metadata.get('max_displacement', 0),
                'max_velocity': rust_result.metadata.get('max_velocity', 0),
                'max_acceleration': rust_result.metadata.get('max_acceleration', 0),
                'stats': {
                    'backend_used': 'rust',
                    'total_solve_time_ms': (time.perf_counter() - start_time) * 1000,
                    'rust_solve_time_ms': rust_result.get('solve_time_ms', 0)
                }
            }

        elif analysis_type == 'spectrum':
            """Response spectrum analysis (Rust only)."""
            gm_config = request.ground_motion or TimeHistoryGroundMotion()
            periods = np.array(request.periods if request.periods else np.linspace(0.1, 4.0, 40))

            rust_model = {
                "ground_motion": {
                    "name": gm_config.name,
                    "scale_factor": gm_config.scale_factor,
                },
                "periods": periods.tolist(),
                "damping_ratio": damping_ratio
            }

            rust_result = await analyze_with_best_backend(
                rust_model,
                analysis_type="spectrum",
                force_backend="rust"
            )

            if not rust_result.success:
                raise RuntimeError(rust_result.error or "Rust spectrum solver failed")

            results = {
                'success': True,
                'analysis_type': 'spectrum',
                'backend_used': 'rust',
                'periods': rust_result.metadata.get('periods', []),
                'Sa': rust_result.metadata.get('Sa', []),
                'max_Sa': max(rust_result.metadata.get('Sa', [0])) if rust_result.metadata.get('Sa') else 0,
                'stats': {
                    'backend_used': 'rust',
                    'total_solve_time_ms': (time.perf_counter() - start_time) * 1000,
                    'rust_solve_time_ms': rust_result.get('solve_time_ms', 0)
                }
            }

        print(f"[TIME-HISTORY] {analysis_type} analysis complete (rust-only)")
        return results

    except Exception as e:
        print(f"[TIME-HISTORY] Error: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Time history analysis error: {str(e)}")
