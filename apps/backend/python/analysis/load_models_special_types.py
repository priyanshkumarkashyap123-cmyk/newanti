"""Specialized load dataclasses (temperature and prestress)."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Optional


@dataclass
class TemperatureLoad:
    """
    Temperature change load on member.

    Uniform: Causes axial strain/force
    Gradient: Causes bending (differential temperature across section)
    """

    id: str
    member_id: str
    delta_T: float  # Temperature change (deg C)
    alpha: float = 12e-6  # Thermal expansion coefficient (1/deg C)
    gradient_T: Optional[float] = None  # Temperature gradient across depth (deg C)
    section_depth: Optional[float] = None  # Section depth for gradient (m)
    load_case: str = "TEMPERATURE"

    def get_thermal_strain(self) -> float:
        """Calculate thermal strain epsilon = alpha * delta_T."""

        return self.alpha * self.delta_T

    def get_thermal_force(self, E: float, A: float) -> float:
        """Calculate axial force from restrained thermal strain: F = E * A * alpha * delta_T."""

        return E * A * self.get_thermal_strain()

    def get_thermal_moment(self, E: float, I: float) -> float:
        """Calculate moment due to temperature gradient: M = E * I * alpha * (delta_T_grad / h)."""

        if self.gradient_T is None or self.section_depth is None or self.section_depth <= 0:
            return 0.0

        curvature = self.alpha * self.gradient_T / self.section_depth
        return E * I * curvature


@dataclass
class PrestressLoad:
    """Prestressing force with eccentricity profile."""

    id: str
    member_id: str
    P: float  # Prestress force (kN)
    e_start: float  # Eccentricity at start (m)
    e_mid: float  # Eccentricity at mid-span (m)
    e_end: float  # Eccentricity at end (m)
    load_case: str = "PRESTRESS"

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "member_id": self.member_id,
            "P": self.P,
            "e_start": self.e_start,
            "e_mid": self.e_mid,
            "e_end": self.e_end,
            "load_case": self.load_case,
        }


__all__ = [
    "TemperatureLoad",
    "PrestressLoad",
]
