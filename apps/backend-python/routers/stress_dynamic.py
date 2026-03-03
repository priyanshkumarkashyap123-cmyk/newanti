"""
Stress Calculation & Time-History Dynamic Analysis Endpoints
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import Optional, List, Literal, Dict, Any
import asyncio
import traceback
import time

from logging_config import get_logger

logger = get_logger(__name__)

router = APIRouter(tags=["Analysis"])


# ── Stress Models ──

class StressMemberForces(BaseModel):
    axial: List[float] = Field(default_factory=list, max_length=10_000)
    moment_x: List[float] = Field(default_factory=list, max_length=10_000)
    moment_y: List[float] = Field(default_factory=list, max_length=10_000)
    shear_y: List[float] = Field(default_factory=list, max_length=10_000)
    shear_z: List[float] = Field(default_factory=list, max_length=10_000)


class StressMemberSection(BaseModel):
    area: float = Field(gt=0, le=1e6)
    Ixx: float = Field(gt=0, le=1e6)
    Iyy: float = Field(gt=0, le=1e6)
    depth: float = Field(gt=0, le=1e4)
    width: float = Field(gt=0, le=1e4)


class StressMemberInput(BaseModel):
    id: str = Field(max_length=128)
    forces: StressMemberForces = Field(default_factory=StressMemberForces)
    section: StressMemberSection
    length: float = Field(default=1.0, gt=0, le=1e6)


class StressCalculateRequest(BaseModel):
    members: List[StressMemberInput] = Field(default_factory=list, max_length=10_000)
    stress_type: str = Field(default="von_mises", max_length=32)
    fy: float = Field(default=250.0, gt=0, le=5000)
    safety_factor: float = Field(default=1.5, gt=0, le=10)


# ── Time-History Models ──

class TimeHistoryGroundMotion(BaseModel):
    name: str = Field(default="el_centro_1940", max_length=128)
    scale_factor: float = Field(default=1.0, ge=0, le=100)


class TimeHistoryRequest(BaseModel):
    mass_matrix: List[List[float]] = Field(max_length=1000)
    stiffness_matrix: List[List[float]] = Field(max_length=1000)
    damping_ratio: float = Field(default=0.05, ge=0.0, le=1.0)
    analysis_type: Literal["modal", "newmark", "spectrum"] = Field(default="modal")
    ground_motion: Optional[TimeHistoryGroundMotion] = None
    num_modes: int = Field(default=10, ge=1, le=200)
    periods: List[float] = Field(default_factory=list, max_length=1000)
    backend: Optional[str] = "python"  # "python", "rust", "auto"
    debug_compare: Optional[bool] = False
    debug_compare_tolerance: Optional[float] = 1e-2


# ── Endpoints ──

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


@router.post("/analysis/time-history")
async def time_history_analysis(request: TimeHistoryRequest):
    """
    Perform dynamic time history analysis (Modal, Newmark, Spectrum).
    
    Migration-ready mode for Modal:
    - Python remains authoritative (rich mode shape vectors).
    - Rust can run in parallel debug_compare mode for validation.
    - Returns frequencies, periods, mode shapes, modal masses, participation factors.
    """
    start_time = time.perf_counter()
    
    try:
        from analysis.time_history_analysis import TimeHistoryAnalyzer, load_ground_motion
        from analysis.rust_interop import analyze_with_best_backend
        import numpy as np

        print("[TIME-HISTORY] Starting dynamic analysis...")

        analysis_type = request.analysis_type
        damping_ratio = request.damping_ratio

        M = np.array(request.mass_matrix)
        K = np.array(request.stiffness_matrix)

        if M.size == 0 or K.size == 0:
            raise ValueError("Mass and stiffness matrices are required")

        forced_backend = (request.backend or "python").lower()
        if forced_backend not in {"auto", "rust", "python"}:
            raise HTTPException(status_code=400, detail="backend must be one of: auto, rust, python")

        analyzer = TimeHistoryAnalyzer()
        analyzer.damping_ratio = damping_ratio

        results = {}

        if analysis_type == 'modal':
            num_modes = request.num_modes
            
            # ── Python Solver (Authoritative) ──
            async def solve_modal_python():
                modes = await asyncio.to_thread(analyzer.modal_analysis, M, K, num_modes)
                return {
                    'success': True,
                    'analysis_type': 'modal',
                    'modes': [
                        {
                            'mode_number': m.mode_number,
                            'frequency': m.frequency,
                            'period': m.period,
                            'omega': m.omega,
                            'participation_factor': m.participation_factor,
                            'mass_participation': m.mass_participation,
                            'mode_shape': m.mode_shape.tolist()
                        }
                        for m in modes
                    ],
                    'total_mass_participation': sum(m.mass_participation for m in modes),
                    'solve_time_ms': (time.perf_counter() - start_time) * 1000
                }
            
            # ── Rust Solver (Optional debug mode) ──
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
            
            # ── Execution logic ──
            if request.debug_compare:
                py_result, rust_result = await asyncio.gather(
                    solve_modal_python(),
                    solve_modal_rust(),
                    return_exceptions=True
                )
                
                py_exception = None if not isinstance(py_result, Exception) else py_result
                rust_exception = None if not isinstance(rust_result, Exception) else rust_result
                
                if py_exception:
                    logger.error(f"Python modal solver exception: {py_exception}")
                    raise py_exception
                
                if rust_exception:
                    logger.warning(f"Rust modal comparison failed (non-fatal): {rust_exception}")
                    rust_result = None
                
                # Return Python result with comparison
                py_result['stats'] = {
                    'backend_used': 'python',
                    'total_solve_time_ms': (time.perf_counter() - start_time) * 1000,
                    'python_solve_time_ms': py_result.get('solve_time_ms', 0)
                }
                
                if rust_result is not None:
                    freq_delta = max([
                        abs(pf - rf) for pf, rf in zip(
                            py_result['modes'][0]['frequency'] if py_result['modes'] else [],
                            rust_result.get('frequencies_hz', [])[0] if rust_result.get('frequencies_hz') else 0
                        )
                    ]) if py_result.get('modes') and rust_result.get('frequencies_hz') else 0
                    
                    py_result['stats']['debug_comparison'] = {
                        'enabled': True,
                        'rust_available': True,
                        'freq_delta_hz': freq_delta,
                        'within_tolerance': freq_delta <= (request.debug_compare_tolerance or 1e-2),
                        'rust_solve_time_ms': rust_result.get('solve_time_ms', 0)
                    }
                else:
                    py_result['stats']['debug_comparison'] = {
                        'enabled': True,
                        'rust_available': False,
                        'reason': 'Rust modal solver unavailable'
                    }
                
                results = py_result
            else:
                # Default: Python authoritative
                modes = await asyncio.to_thread(analyzer.modal_analysis, M, K, num_modes)
                results = {
                    'success': True,
                    'analysis_type': 'modal',
                    'modes': [
                        {
                            'mode_number': m.mode_number,
                            'frequency': m.frequency,
                            'period': m.period,
                            'omega': m.omega,
                            'participation_factor': m.participation_factor,
                            'mass_participation': m.mass_participation,
                            'mode_shape': m.mode_shape.tolist()
                        }
                        for m in modes
                    ],
                    'total_mass_participation': sum(m.mass_participation for m in modes),
                    'stats': {
                        'backend_used': 'python',
                        'total_solve_time_ms': (time.perf_counter() - start_time) * 1000
                    }
                }

        elif analysis_type == 'newmark':
            """Time-domain integration using Newmark-beta method."""
            gm_config = request.ground_motion or TimeHistoryGroundMotion()
            ground_motion = load_ground_motion(gm_config.name, gm_config.scale_factor)

            omega1 = 2 * np.pi * 1.0
            omega2 = 2 * np.pi * 10.0
            alpha = damping_ratio * 2 * omega1 * omega2 / (omega1 + omega2)
            beta = damping_ratio * 2 / (omega1 + omega2)
            C = alpha * M + beta * K
            
            # ── Python Newmark Solver ──
            async def solve_newmark_python():
                response = await asyncio.to_thread(
                    analyzer.newmark_beta_integration, M, K, C, ground_motion
                )
                return {
                    'backend': 'python',
                    'time': response['time'].tolist(),
                    'displacement': response['displacement'].tolist(),
                    'velocity': response['velocity'].tolist(),
                    'acceleration': response['acceleration'].tolist(),
                    'max_displacement': float(np.max(np.abs(response['displacement']))),
                    'max_velocity': float(np.max(np.abs(response['velocity']))),
                    'max_acceleration': float(np.max(np.abs(response['acceleration']))),
                    'solve_time_ms': (time.perf_counter() - start_time) * 1000
                }
            
            # ── Rust TimeHistorySolver ──
            async def solve_newmark_rust():
                rust_model = {
                    "mass_matrix": M.tolist() if isinstance(M, np.ndarray) else M,
                    "stiffness_matrix": K.tolist() if isinstance(K, np.ndarray) else K,
                    "damping_type": "rayleigh",
                    "damping_parameters": {"alpha": alpha, "beta": beta},
                    "ground_motion": {
                        "name": gm_config.name,
                        "acceleration_values": ground_motion.acceleration.tolist() if hasattr(ground_motion, 'acceleration') else []
                    }
                }
                
                rust_result = await analyze_with_best_backend(
                    rust_model,
                    analysis_type="time_history",
                    force_backend="rust"
                )
                
                if not rust_result.success:
                    raise RuntimeError(rust_result.error or "Rust Newmark solver failed")
                
                return {
                    'backend': 'rust',
                    'max_displacement': rust_result.metadata.get('max_displacement', 0),
                    'max_velocity': rust_result.metadata.get('max_velocity', 0),
                    'max_acceleration': rust_result.metadata.get('max_acceleration', 0),
                    'solve_time_ms': (time.perf_counter() - start_time) * 1000
                }
            
            # ── Execution logic ──
            if request.debug_compare:
                py_result, rust_result = await asyncio.gather(
                    solve_newmark_python(),
                    solve_newmark_rust(),
                    return_exceptions=True
                )
                
                py_exception = None if not isinstance(py_result, Exception) else py_result
                rust_exception = None if not isinstance(rust_result, Exception) else rust_result
                
                if py_exception:
                    logger.error(f"Python Newmark solver exception: {py_exception}")
                    raise py_exception
                
                if rust_exception:
                    logger.warning(f"Rust Newmark comparison failed (non-fatal): {rust_exception}")
                    rust_result = None
                
                results = {
                    'success': True,
                    'analysis_type': 'newmark',
                    'ground_motion': {
                        'name': ground_motion.name,
                        'pga': float(ground_motion.pga),
                        'duration': float(ground_motion.duration),
                        'dt': float(ground_motion.dt)
                    },
                    'time': py_result['time'],
                    'displacement': py_result['displacement'],
                    'velocity': py_result['velocity'],
                    'acceleration': py_result['acceleration'],
                    'max_displacement': py_result['max_displacement'],
                    'max_velocity': py_result['max_velocity'],
                    'max_acceleration': py_result['max_acceleration'],
                    'stats': {
                        'backend_used': 'python',
                        'total_solve_time_ms': (time.perf_counter() - start_time) * 1000,
                        'python_solve_time_ms': py_result.get('solve_time_ms', 0)
                    }
                }
                
                if rust_result is not None:
                    disp_delta = abs(py_result['max_displacement'] - rust_result.get('max_displacement', 0))
                    results['stats']['debug_comparison'] = {
                        'enabled': True,
                        'rust_available': True,
                        'max_displacement_delta': disp_delta,
                        'within_tolerance': disp_delta <= (request.debug_compare_tolerance or 1e-2),
                        'rust_solve_time_ms': rust_result.get('solve_time_ms', 0)
                    }
                else:
                    results['stats']['debug_comparison'] = {
                        'enabled': True,
                        'rust_available': False,
                        'reason': 'Rust Newmark solver unavailable'
                    }
            else:
                response = await asyncio.to_thread(
                    analyzer.newmark_beta_integration, M, K, C, ground_motion
                )
                results = {
                    'success': True,
                    'analysis_type': 'newmark',
                    'ground_motion': {
                        'name': ground_motion.name,
                        'pga': float(ground_motion.pga),
                        'duration': float(ground_motion.duration),
                        'dt': float(ground_motion.dt)
                    },
                    'time': response['time'].tolist(),
                    'displacement': response['displacement'].tolist(),
                    'velocity': response['velocity'].tolist(),
                    'acceleration': response['acceleration'].tolist(),
                    'max_displacement': float(np.max(np.abs(response['displacement']))),
                    'max_velocity': float(np.max(np.abs(response['velocity']))),
                    'max_acceleration': float(np.max(np.abs(response['acceleration']))),
                    'stats': {
                        'backend_used': 'python',
                        'total_solve_time_ms': (time.perf_counter() - start_time) * 1000
                    }
                }

        elif analysis_type == 'spectrum':
            """Response spectrum analysis."""
            gm_config = request.ground_motion or TimeHistoryGroundMotion()
            ground_motion = load_ground_motion(gm_config.name, gm_config.scale_factor)
            
            # ── Python Spectrum Solver ──
            async def solve_spectrum_python():
                periods = np.array(request.periods if request.periods else np.linspace(0.1, 4.0, 40))
                spectrum = await asyncio.to_thread(
                    analyzer.get_response_spectrum, ground_motion, periods, damping_ratio
                )
                return {
                    'backend': 'python',
                    'periods': spectrum['periods'].tolist(),
                    'Sd': spectrum['Sd'].tolist(),
                    'Sv': spectrum['Sv'].tolist(),
                    'Sa': spectrum['Sa'].tolist(),
                    'max_Sa': float(np.max(spectrum['Sa'])),
                    'solve_time_ms': (time.perf_counter() - start_time) * 1000
                }
            
            # ── Rust Spectrum Solver ──
            async def solve_spectrum_rust():
                periods = np.array(request.periods if request.periods else np.linspace(0.1, 4.0, 40))
                rust_model = {
                    "ground_motion": {
                        "name": gm_config.name,
                        "acceleration_values": ground_motion.acceleration.tolist() if hasattr(ground_motion, 'acceleration') else [],
                        "dt": float(ground_motion.dt) if hasattr(ground_motion, 'dt') else 0.01
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
                
                return {
                    'backend': 'rust',
                    'periods': rust_result.metadata.get('periods', []),
                    'Sa': rust_result.metadata.get('Sa', []),
                    'max_Sa': max(rust_result.metadata.get('Sa', [0])) if rust_result.metadata.get('Sa') else 0,
                    'solve_time_ms': (time.perf_counter() - start_time) * 1000
                }
            
            # ── Execution logic ──
            if request.debug_compare:
                py_result, rust_result = await asyncio.gather(
                    solve_spectrum_python(),
                    solve_spectrum_rust(),
                    return_exceptions=True
                )
                
                py_exception = None if not isinstance(py_result, Exception) else py_result
                rust_exception = None if not isinstance(rust_result, Exception) else rust_result
                
                if py_exception:
                    logger.error(f"Python spectrum solver exception: {py_exception}")
                    raise py_exception
                
                if rust_exception:
                    logger.warning(f"Rust spectrum comparison failed (non-fatal): {rust_exception}")
                    rust_result = None
                
                results = {
                    'success': True,
                    'analysis_type': 'spectrum',
                    'ground_motion': {
                        'name': ground_motion.name,
                        'pga': float(ground_motion.pga) if hasattr(ground_motion, 'pga') else 0
                    },
                    'periods': py_result['periods'],
                    'Sd': py_result['Sd'],
                    'Sv': py_result['Sv'],
                    'Sa': py_result['Sa'],
                    'max_Sa': py_result['max_Sa'],
                    'stats': {
                        'backend_used': 'python',
                        'total_solve_time_ms': (time.perf_counter() - start_time) * 1000,
                        'python_solve_time_ms': py_result.get('solve_time_ms', 0)
                    }
                }
                
                if rust_result is not None:
                    sa_deltas = [abs(p - r) for p, r in zip(py_result['Sa'], rust_result.get('Sa', []))]
                    max_sa_delta = max(sa_deltas) if sa_deltas else 0
                    
                    results['stats']['debug_comparison'] = {
                        'enabled': True,
                        'rust_available': True,
                        'max_Sa_delta': max_sa_delta,
                        'within_tolerance': max_sa_delta <= (request.debug_compare_tolerance or 1e-2),
                        'rust_solve_time_ms': rust_result.get('solve_time_ms', 0)
                    }
                else:
                    results['stats']['debug_comparison'] = {
                        'enabled': True,
                        'rust_available': False,
                        'reason': 'Rust spectrum solver unavailable'
                    }
            else:
                periods = np.array(request.periods if request.periods else np.linspace(0.1, 4.0, 40))
                spectrum = await asyncio.to_thread(
                    analyzer.get_response_spectrum, ground_motion, periods, damping_ratio
                )
                results = {
                    'success': True,
                    'analysis_type': 'spectrum',
                    'ground_motion': {
                        'name': ground_motion.name,
                        'pga': float(ground_motion.pga) if hasattr(ground_motion, 'pga') else 0
                    },
                    'periods': spectrum['periods'].tolist(),
                    'Sd': spectrum['Sd'].tolist(),
                    'Sv': spectrum['Sv'].tolist(),
                    'Sa': spectrum['Sa'].tolist(),
                    'max_Sa': float(np.max(spectrum['Sa'])),
                    'stats': {
                        'backend_used': 'python',
                        'total_solve_time_ms': (time.perf_counter() - start_time) * 1000
                    }
                }

        print(f"[TIME-HISTORY] {analysis_type} analysis complete")
        return results

    except Exception as e:
        print(f"[TIME-HISTORY] Error: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Time history analysis error: {str(e)}")
