"""
Bar and stirrup selection helpers.
"""

from math import ceil
from typing import Tuple

from .materials import STANDARD_BAR_SIZES_MM, STANDARD_STIRRUP_SIZES_MM


def select_rebar_for_area(Ast_required: float) -> Tuple[int, int, str]:
    for size in STANDARD_BAR_SIZES_MM:
        area_single = 3.14159 * size * size / 4
        count = ceil(Ast_required / area_single)
        if count <= 50:  # arbitrary upper limit to avoid impractical counts
            desc = f"Provide {count} #\u03c6{size} (Ast={count * area_single:.1f} mm^2)"
            return size, count, desc
    # fallback to max size with computed count
    size = STANDARD_BAR_SIZES_MM[-1]
    area_single = 3.14159 * size * size / 4
    count = ceil(Ast_required / area_single)
    desc = f"Provide {count} #\u03c6{size} (Ast={count * area_single:.1f} mm^2)"
    return size, count, desc


def select_stirrups(b: float, d: float, fyv: float, tau_v: float, tau_c: float, minimum: bool) -> Tuple[int, float, str]:
    # Choose smallest stirrup size that satisfies Vs
    for size in STANDARD_STIRRUP_SIZES_MM:
        area_2leg = 2 * 3.14159 * size * size / 4
        if minimum:
            # Clause 26.5.1.6: Asv/s >= 0.4*b*0.5/fyv
            spacing = min(0.75 * d, 300)
            Asv_over_s_req = 0.4 / 100 * b
            spacing_req = area_2leg / Asv_over_s_req
            spacing = min(spacing, spacing_req)
        else:
            Vus_req = (tau_v - tau_c) * b * d
            spacing = (0.87 * fyv * area_2leg * d) / Vus_req if Vus_req > 0 else 300
            spacing = min(spacing, 0.75 * d, 300)
        spacing = max(spacing, 100)  # practical lower bound
        desc = f"Use 2-Legged \u03c6{size} @ {spacing:.0f} mm c/c"
        return size, spacing, desc
    size = STANDARD_STIRRUP_SIZES_MM[-1]
    spacing = 100.0
    desc = f"Use 2-Legged \u03c6{size} @ {spacing:.0f} mm c/c"
    return size, spacing, desc
