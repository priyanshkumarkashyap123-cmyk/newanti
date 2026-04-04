"""
Shared Pydantic schemas for stress calculation and time-history analysis.
"""

from typing import List, Optional, Literal
from pydantic import BaseModel, Field


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
    backend: Optional[str] = "rust"  # "python", "rust", "auto" — Rust is authoritative
    debug_compare: Optional[bool] = False
    debug_compare_tolerance: Optional[float] = 1e-2
