"""ASCE 7 seismic coefficient calculation helpers."""

import numpy as np

from .asce7_seismic_types import RiskCategory


def get_fa(site: str, ss: float) -> float:
    """Short-period site coefficient Fa (ASCE 7 Table 11.4-1)."""
    fa_table = {
        "A": [0.8, 0.8, 0.8, 0.8, 0.8],
        "B": [0.9, 0.9, 0.9, 0.9, 0.9],
        "C": [1.3, 1.3, 1.2, 1.2, 1.2],
        "D": [1.6, 1.4, 1.2, 1.1, 1.0],
        "E": [2.4, 1.7, 1.3, 1.0, 0.9],
        "F": [None, None, None, None, None],
    }

    if site == "F":
        return 1.0

    ss_values = [0.25, 0.5, 0.75, 1.0, 1.25]
    fa_values = fa_table[site]

    if ss <= 0.25:
        return fa_values[0]
    if ss >= 1.25:
        return fa_values[4]
    return float(np.interp(ss, ss_values, fa_values))


def get_fv(site: str, s1: float) -> float:
    """Long-period site coefficient Fv (ASCE 7 Table 11.4-2)."""
    fv_table = {
        "A": [0.8, 0.8, 0.8, 0.8, 0.8],
        "B": [0.8, 0.8, 0.8, 0.8, 0.8],
        "C": [1.5, 1.5, 1.5, 1.5, 1.5],
        "D": [2.4, 2.2, 2.0, 1.9, 1.8],
        "E": [4.2, 3.3, 2.8, 2.4, 2.2],
        "F": [None, None, None, None, None],
    }

    if site == "F":
        return 1.5

    s1_values = [0.1, 0.2, 0.3, 0.4, 0.5]
    fv_values = fv_table[site]

    if s1 <= 0.1:
        return fv_values[0]
    if s1 >= 0.5:
        return fv_values[4]
    return float(np.interp(s1, s1_values, fv_values))


def get_importance_factor(risk_category: RiskCategory) -> float:
    """Seismic importance factor Ie (ASCE 7 Table 1.5-2)."""
    ie_values = {
        RiskCategory.I: 1.0,
        RiskCategory.II: 1.0,
        RiskCategory.III: 1.25,
        RiskCategory.IV: 1.5,
    }
    return ie_values.get(risk_category, 1.0)


__all__ = [
    "get_fa",
    "get_fv",
    "get_importance_factor",
]
