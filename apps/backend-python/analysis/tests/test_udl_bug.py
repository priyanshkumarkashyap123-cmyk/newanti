"""Baseline beam regression checks for Python beam solver.

These tests enforce textbook statics on fundamental cases:
1) Simply supported beam with partial UDL
2) Cantilever beam with full-span UDL
"""

import os
import sys
from typing import Tuple

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from analysis.solver import BeamAnalysisInput, Load, LoadType, Support, BeamSolver


def _closest_point(values, target: float) -> Tuple[int, float]:
    idx = min(range(len(values)), key=lambda i: abs(values[i] - target))
    return idx, values[idx]


def test_ssb_partial_udl_reactions_and_moment_at_x8():
    # Simply supported beam, L=10m, UDL=10kN/m from 0m to 5m.
    # Hand-calculated references:
    # W=50kN at x=2.5m, Ra=37.5kN, Rb=12.5kN, M(8)=25kN·m
    l_m = 10.0
    w_knpm = 10.0
    start_m = 0.0
    end_m = 5.0

    beam = BeamAnalysisInput(
        length=l_m,
        loads=[Load(type=LoadType.UDL, magnitude=w_knpm, position=start_m, end_position=end_m)],
        supports=[
            Support(position=0.0, type="pinned"),
            Support(position=l_m, type="roller"),
        ],
        E=200e6,
        I=1e-4,
    )

    result = BeamSolver(beam).solve()
    assert result.success, f"Solver failed: {result.error}"

    ra = result.reactions["Ra"]
    rb = result.reactions["Rb"]

    expected_rb = w_knpm * (end_m - start_m) * (start_m + (end_m - start_m) / 2.0) / l_m
    expected_ra = w_knpm * (end_m - start_m) - expected_rb

    assert abs(rb - expected_rb) < 1e-3, f"Rb mismatch: got {rb}, expected {expected_rb}"
    assert abs(ra - expected_ra) < 1e-3, f"Ra mismatch: got {ra}, expected {expected_ra}"

    idx, x_found = _closest_point(result.diagram.x_values, 8.0)
    m_found = result.diagram.moment_values[idx]

    total_w = w_knpm * (end_m - start_m)
    centroid = start_m + (end_m - start_m) / 2.0
    expected_m = ra * x_found - total_w * (x_found - centroid)

    assert abs(m_found - expected_m) < 0.6, (
        f"Moment mismatch near x=8m: x={x_found}, got {m_found}, expected {expected_m}"
    )


def test_cantilever_udl_fixed_end_shear_and_moment():
    # Cantilever, L=4m, full UDL=12kN/m
    # Hand-calculated fixed-end actions:
    # V = wL = 48kN, M = wL²/2 = 96kN·m
    l_m = 4.0
    w_knpm = 12.0

    beam = BeamAnalysisInput(
        length=l_m,
        loads=[Load(type=LoadType.UDL, magnitude=w_knpm, position=0.0, end_position=l_m)],
        supports=[Support(position=0.0, type="fixed")],
        E=200e6,
        I=1e-4,
    )

    result = BeamSolver(beam).solve()
    assert result.success, f"Solver failed: {result.error}"

    ra = result.reactions["Ra"]
    ma = result.reactions["Ma"]

    expected_v = w_knpm * l_m
    expected_m = w_knpm * l_m * l_m / 2.0

    assert abs(ra - expected_v) < 1e-3, f"Cantilever shear mismatch: got {ra}, expected {expected_v}"
    assert abs(ma - expected_m) < 1e-3, f"Cantilever moment mismatch: got {ma}, expected {expected_m}"

    # Free-end moment should be near zero
    _, x_free = _closest_point(result.diagram.x_values, l_m)
    idx_free = result.diagram.x_values.index(x_free)
    m_free = result.diagram.moment_values[idx_free]
    assert abs(m_free) < 1.0, f"Free-end moment should be near zero, got {m_free}"
