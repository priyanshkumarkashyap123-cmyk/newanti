"""Regression tests for load combination consolidation."""

from __future__ import annotations

import sys
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from analysis.load_combinations import IS456CombinationGenerator, LoadCase, LoadType  # noqa: E402


def test_is456_generator_maps_symbolic_factors_to_case_ids() -> None:
    cases = [
        LoadCase("DL1", "Dead 1", LoadType.DEAD),
        LoadCase("LL1", "Live 1", LoadType.LIVE),
        LoadCase("WL1", "Wind 1", LoadType.WIND),
        LoadCase("EL1", "Seismic 1", LoadType.SEISMIC),
    ]

    combos = IS456CombinationGenerator(cases).generate()

    assert combos
    target = next((c for c in combos if c.name == "1.5(DL + LL)"), None)
    assert target is not None
    assert target.factors["DL1"] == 1.5
    assert target.factors["LL1"] == 1.5


def test_is456_generator_skips_unmapped_load_types_safely() -> None:
    cases = [
        LoadCase("DL1", "Dead 1", LoadType.DEAD),
        LoadCase("EP1", "Soil", LoadType.SOIL_PRESSURE),
    ]

    combos = IS456CombinationGenerator(cases).generate()

    assert combos
    assert all("EP1" not in combo.factors for combo in combos)
