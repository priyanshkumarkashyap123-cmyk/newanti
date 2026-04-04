"""
Stress calculation router (delegated from stress_dynamic monolith).
"""

from fastapi import APIRouter, HTTPException
import asyncio
import time
import traceback

from logging_config import get_logger
from .stress_schemas import StressCalculateRequest

logger = get_logger(__name__)

router = APIRouter(tags=["Analysis"])


@router.post("/stress/calculate")
async def calculate_stress(request: StressCalculateRequest):
    """
    Calculate stresses for structural members.

    Migration-ready mode:
    - Python: Authoritative stress calculator (von_mises, principal, shear)
    - Rust: Optional debug comparison for validation
    """
    start_time = time.perf_counter()

    try:
        from analysis.stress_calculator import StressCalculator
        from analysis.rust_interop import analyze_with_best_backend

        print("[STRESS] Calculating stresses...")

        # ── Python Stress Solver (Authoritative) ──
        async def calculate_stress_python():
            calculator = StressCalculator()
            results = []

            for member in request.members:
                stress_points = await asyncio.to_thread(
                    lambda m=member: calculator.calculate_member_stresses(
                        member_id=m.id,
                        member_forces=m.forces.model_dump(),
                        section_properties=m.section.model_dump(),
                        member_length=m.length,
                        num_points=20
                    )
                )

                contours = await asyncio.to_thread(
                    calculator.get_stress_contours, stress_points, request.stress_type
                )
                check = await asyncio.to_thread(
                    calculator.check_stress_limits, stress_points, request.fy, request.safety_factor
                )

                results.append({
                    'member_id': member.id,
                    'stress_points': [
                        {
                            'x': p.x, 'y': p.y, 'z': p.z,
                            'sigma_x': p.sigma_x, 'sigma_y': p.sigma_y, 'sigma_z': p.sigma_z,
                            'tau_xy': p.tau_xy, 'tau_yz': p.tau_yz, 'tau_zx': p.tau_zx,
                            'von_mises': p.von_mises,
                            'principal_1': p.principal_1, 'principal_2': p.principal_2,
                            'principal_3': p.principal_3, 'max_shear': p.max_shear
                        }
                        for p in stress_points
                    ],
                    'contours': contours,
                    'check': check
                })

            return {
                'backend': 'python',
                'results': results,
                'n_members': len(results),
                'solve_time_ms': (time.perf_counter() - start_time) * 1000
            }

        # ── Rust Stress Solver (Optional validation) ──
        async def calculate_stress_rust():
            """Rust-based stress tensor computation."""
            rust_model = {
                'members': [
                    {
                        'id': m.id,
                        'forces': {
                            'axial': m.forces.axial,
                            'moment_x': m.forces.moment_x,
                            'moment_y': m.forces.moment_y,
                            'shear_y': m.forces.shear_y,
                            'shear_z': m.forces.shear_z
                        },
                        'section': m.section.model_dump(),
                        'length': m.length
                    }
                    for m in request.members
                ],
                'stress_type': request.stress_type,
                'fy': request.fy,
                'safety_factor': request.safety_factor
            }

            rust_result = await analyze_with_best_backend(
                rust_model,
                analysis_type="stress",
                force_backend="rust"
            )

            if not rust_result.success:
                raise RuntimeError(rust_result.error or "Rust stress calculator failed")

            return {
                'backend': 'rust',
                'n_members': len(request.members),
                'max_von_mises': rust_result.metadata.get('max_von_mises', 0),
                'solve_time_ms': (time.perf_counter() - start_time) * 1000
            }

        # ── Execution logic ──
        if request.stress_type and 'debug' in request.stress_type.lower():
            # Debug comparison mode
            py_result, rust_result = await asyncio.gather(
                calculate_stress_python(),
                calculate_stress_rust(),
                return_exceptions=True
            )

            py_exception = None if not isinstance(py_result, Exception) else py_result
            rust_exception = None if not isinstance(rust_result, Exception) else rust_result

            if py_exception:
                logger.error(f"Python stress calculator exception: {py_exception}")
                raise py_exception

            if rust_exception:
                logger.warning(f"Rust stress comparison failed (non-fatal): {rust_exception}")
                rust_result = None

            py_data = {
                'success': True,
                'results': py_result['results'],
                'stress_type': request.stress_type,
                'stats': {
                    'backend_used': 'python',
                    'n_members': py_result['n_members'],
                    'total_solve_time_ms': (time.perf_counter() - start_time) * 1000,
                    'python_solve_time_ms': py_result.get('solve_time_ms', 0)
                }
            }

            if rust_result is not None:
                py_data['stats']['debug_comparison'] = {
                    'enabled': True,
                    'rust_available': True,
                    'rust_solve_time_ms': rust_result.get('solve_time_ms', 0),
                    'speedup_factor': py_result.get('solve_time_ms', 1) / max(rust_result.get('solve_time_ms', 1), 0.001)
                }
            else:
                py_data['stats']['debug_comparison'] = {
                    'enabled': True,
                    'rust_available': False,
                    'reason': 'Rust stress solver unavailable'
                }

            return py_data
        else:
            # Default: Python authoritative
            py_result = await calculate_stress_python()
            return {
                'success': True,
                'results': py_result['results'],
                'stress_type': request.stress_type,
                'stats': {
                    'backend_used': 'python',
                    'n_members': py_result['n_members'],
                    'total_solve_time_ms': (time.perf_counter() - start_time) * 1000
                }
            }

    except Exception as e:
        print(f"[STRESS] Calculation error: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Stress calculation error: {str(e)}")
