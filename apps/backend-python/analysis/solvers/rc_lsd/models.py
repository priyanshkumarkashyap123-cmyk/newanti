"""
Data models for RC limit state design.
"""

from dataclasses import dataclass
from typing import List
import numpy as np

from .materials import ConcreteGrade, RebarGrade, LIMIT_STATE_DESIGN_CONSTANTS


@dataclass
class BeamSection:
    b: float  # Width (mm)
    d: float  # Effective depth (mm)
    d_prime: float  # Depth to compression steel (mm)

    def __post_init__(self):
        if self.b <= 0 or self.d <= 0:
            raise ValueError("Width and depth must be positive")
        if self.d_prime is None:
            self.d_prime = 50


@dataclass
class ConcreteProperties:
    grade: ConcreteGrade
    fck: float  # Characteristic compressive strength (N/mm²)

    @property
    def fcd(self) -> float:
        return (
            self.fck
            * LIMIT_STATE_DESIGN_CONSTANTS["fcd_factor"]
            / LIMIT_STATE_DESIGN_CONSTANTS["gamma_m_concrete"]
        )

    @property
    def Ec(self) -> float:
        return 5000 * np.sqrt(self.fck)


@dataclass
class RebarProperties:
    grade: RebarGrade
    fy: float  # Characteristic yield strength (N/mm²)

    @property
    def fyd(self) -> float:
        return (
            self.fy
            * LIMIT_STATE_DESIGN_CONSTANTS["fyd_factor"]
            / LIMIT_STATE_DESIGN_CONSTANTS["gamma_m_steel"]
        )

    @property
    def Es(self) -> float:
        return 200000  # N/mm²

    @property
    def fyv(self) -> float:
        """Design shear reinforcement yield (use characteristic fy)."""
        return self.fy


@dataclass
class LimitingMomentResult:
    Mu_lim: float
    xu_lim: float
    z_lim: float
    r_lim: float
    is_ductile: bool


@dataclass
class BendingDesignResult:
    design_type: str  # 'singly_reinforced' or 'doubly_reinforced'
    Ast_required: float
    Asc_required: float
    xu: float
    z: float
    Mu_provided: float
    pt: float

    main_rebar_size: int
    main_rebar_count: int
    main_rebar_desc: str

    comp_rebar_size: int
    comp_rebar_count: int
    comp_rebar_desc: str

    pt_balance: float
    mu_ratio: float


@dataclass
class ShearDesignResult:
    status: str
    tau_v: float
    tau_c: float
    tau_cmax: float

    stirrup_size: int
    stirrup_spacing: float
    stirrup_desc: str

    Vus: float
    Vu_c: float


@dataclass
class LSDDesignResult:
    beam_section: BeamSection
    concrete: ConcreteProperties
    rebar: RebarProperties

    Mu: float
    Vu: float

    limiting_moment: LimitingMomentResult
    bending: BendingDesignResult
    shear: ShearDesignResult

    rebar_summary: str
    design_status: str
    design_ratio: float
    messages: List[str]
