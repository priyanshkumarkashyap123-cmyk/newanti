"""
Material enums and design constants for RC limit state design (IS 456:2000).
"""

from enum import Enum
from typing import Callable


class ConcreteGrade(Enum):
    M20 = 20
    M25 = 25
    M30 = 30
    M35 = 35
    M40 = 40
    M45 = 45
    M50 = 50


class RebarGrade(Enum):
    Fe415 = 415
    Fe500 = 500
    Fe500S = 500


# IS 456:2000 Design Constants
def _tau_c_lookup(fck: float, pt: float) -> float:
    """Simplified τc lookup based on Table 19 (pt in %)."""
    pt_clamped = max(0.15, min(pt, 3.0))
    # Empirical fit from earlier implementation
    beta = max(0.8 * fck / (6.89 * pt_clamped), 1.0)
    tau_c = 0.85 * (0.8 * fck) ** 0.5 * (((1 + 5 * beta) ** 0.5) - 1) / (6 * beta)
    return tau_c


def _tau_c_max_lookup(fck: float) -> float:
    table = {20: 2.8, 25: 3.1, 30: 3.5, 35: 3.7, 40: 4.0, 45: 4.0, 50: 4.0}
    fck_key = min(int(5 * round(fck / 5)), 50)
    fck_key = max(fck_key, 20)
    return table.get(fck_key, 4.0)


LIMIT_STATE_DESIGN_CONSTANTS = {
    # Partial Safety Factors
    "gamma_m_concrete": 1.5,  # Cl. 36.4.2
    "gamma_m_steel": 1.15,  # Cl. 36.4.2

    # Material Stress Reduction
    "fcd_factor": 0.67,  # fcd = 0.67 * fck (Cl. 36.4.2)
    "fyd_factor": 0.87,  # fyd = 0.87 * fy (Cl. 36.4.2)

    # Limit State Parameters
    "xu_max_factor": 0.48,  # xu/d for M20-M40 (Table 2, Cl. 38.1)
    "lever_arm_factor": 0.95,  # z/d minimum (Cl. 38.1)

    # Shear Design (Cl. 40.1)
    "tau_c_lookup": _tau_c_lookup,
    "tau_c_max_lookup": _tau_c_max_lookup,

    # Rebar Spacing Limits
    "min_stirrup_dia": 8,  # mm (Cl. 26.5.1.5)
    "max_stirrup_spacing": 300,  # mm (Cl. 40.4)
    "min_stirrup_spacing": 100,  # mm (Cl. 40.4)
}


# Standard bar diameters (mm)
STANDARD_BAR_SIZES_MM = [8, 10, 12, 16, 20, 25, 28, 32]

# Standard stirrup diameters (mm)
STANDARD_STIRRUP_SIZES_MM = [6, 8, 10, 12]
