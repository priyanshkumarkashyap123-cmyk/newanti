"""
Stress Calculation & Time-History Dynamic Analysis Endpoints
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import Optional, List, Literal
import asyncio
import traceback

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


# ── Endpoints ──

@router.post("/stress/calculate")
async def calculate_stress(request: StressCalculateRequest):
    """Calculate stresses for structural members"""
    try:
        from analysis.stress_calculator import StressCalculator

        print("[STRESS] Calculating stresses...")

        calculator = StressCalculator()
        results = []

        for member in request.members:
            stress_points = await asyncio.to_thread(lambda m=member: calculator.calculate_member_stresses(
                member_id=m.id,
                member_forces=m.forces.model_dump(),
                section_properties=m.section.model_dump(),
                member_length=m.length,
                num_points=20
            ))

            contours = await asyncio.to_thread(calculator.get_stress_contours, stress_points, request.stress_type)
            check = await asyncio.to_thread(calculator.check_stress_limits, stress_points, request.fy, request.safety_factor)

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

        print(f"[STRESS] Calculated stresses for {len(results)} members")
        return {'success': True, 'results': results, 'stress_type': request.stress_type}

    except Exception as e:
        print(f"[STRESS] Calculation error: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Stress calculation error: {str(e)}")


@router.post("/analysis/time-history")
async def time_history_analysis(request: TimeHistoryRequest):
    """Perform dynamic time history analysis"""
    try:
        from analysis.time_history_analysis import TimeHistoryAnalyzer, load_ground_motion
        import numpy as np

        print("[TIME-HISTORY] Starting dynamic analysis...")

        analysis_type = request.analysis_type
        damping_ratio = request.damping_ratio

        M = np.array(request.mass_matrix)
        K = np.array(request.stiffness_matrix)

        if M.size == 0 or K.size == 0:
            raise ValueError("Mass and stiffness matrices are required")

        analyzer = TimeHistoryAnalyzer()
        analyzer.damping_ratio = damping_ratio

        results = {}

        if analysis_type == 'modal':
            num_modes = request.num_modes
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
                'total_mass_participation': sum(m.mass_participation for m in modes)
            }

        elif analysis_type == 'newmark':
            gm_config = request.ground_motion or TimeHistoryGroundMotion()
            ground_motion = load_ground_motion(gm_config.name, gm_config.scale_factor)

            omega1 = 2 * np.pi * 1.0
            omega2 = 2 * np.pi * 10.0
            alpha = damping_ratio * 2 * omega1 * omega2 / (omega1 + omega2)
            beta = damping_ratio * 2 / (omega1 + omega2)
            C = alpha * M + beta * K

            response = await asyncio.to_thread(analyzer.newmark_beta_integration, M, K, C, ground_motion)

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
                'max_acceleration': float(np.max(np.abs(response['acceleration'])))
            }

        elif analysis_type == 'spectrum':
            gm_config = request.ground_motion or TimeHistoryGroundMotion()
            ground_motion = load_ground_motion(gm_config.name, gm_config.scale_factor)

            periods = np.array(request.periods if request.periods else np.linspace(0.1, 4.0, 40))
            spectrum = await asyncio.to_thread(analyzer.get_response_spectrum, ground_motion, periods, damping_ratio)

            results = {
                'success': True,
                'analysis_type': 'spectrum',
                'ground_motion': {
                    'name': ground_motion.name,
                    'pga': float(ground_motion.pga)
                },
                'periods': spectrum['periods'].tolist(),
                'Sd': spectrum['Sd'].tolist(),
                'Sv': spectrum['Sv'].tolist(),
                'Sa': spectrum['Sa'].tolist(),
                'max_Sa': float(np.max(spectrum['Sa']))
            }

        print(f"[TIME-HISTORY] {analysis_type} analysis complete")
        return results

    except Exception as e:
        print(f"[TIME-HISTORY] Error: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Time history analysis error: {str(e)}")
