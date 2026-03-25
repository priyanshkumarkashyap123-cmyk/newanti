"""
load_combinations.py - IS code load combination rules and enveloping

Implements load factoring per:
- IS 875:1987 (Wind loads)
- IS 1893:2016 (Seismic loads)
- IS 456:2000 (Concrete code - DL + LL combinations)
"""

import logging
from dataclasses import dataclass
from typing import Dict, List

import numpy as np
from numpy import float64, ndarray

logger = logging.getLogger(__name__)


@dataclass
class LoadCase:
    """A load case with load type and scaling factors."""

    name: str  # e.g., 'DL', 'LL', 'WL', 'EQ'
    description: str
    load_vector: ndarray
    load_type: str  # 'permanent' or 'temporary'


@dataclass
class LoadCombination:
    """A load combination with factors and constituent cases."""

    name: str
    description: str
    factors: Dict[str, float64]
    envelope_type: str  # 'ultimate' or 'serviceability'


class LoadCombinator:
    """
    Generate and manage load combinations per Indian Standards.

    Standards covered:
    - IS 875:1987 (Wind loads)
    - IS 1893:2016 (Seismic)
    - IS 456:2000 (Concrete, LSM combinations)
    """

    @staticmethod
    def is456_ultimate_combinations() -> List[LoadCombination]:
        """
        IS 456/IS 875/IS 1893 typical LSM set.

        Note:
        - Wind and earthquake are not combined in one combination.
        - Combination IDs align with project convention LC1..LC7.
        """
        return [
            LoadCombination(
                name="LC1",
                description="1.5*DL + 1.5*LL",
                factors={"DL": float64(1.5), "LL": float64(1.5)},
                envelope_type="ultimate",
            ),
            LoadCombination(
                name="LC2",
                description="1.5*DL + 1.5*WL",
                factors={"DL": float64(1.5), "WL": float64(1.5)},
                envelope_type="ultimate",
            ),
            LoadCombination(
                name="LC3",
                description="1.2*DL + 1.2*LL + 1.2*WL",
                factors={"DL": float64(1.2), "LL": float64(1.2), "WL": float64(1.2)},
                envelope_type="ultimate",
            ),
            LoadCombination(
                name="LC4",
                description="1.5*DL + 1.5*EQ",
                factors={"DL": float64(1.5), "EQ": float64(1.5)},
                envelope_type="ultimate",
            ),
            LoadCombination(
                name="LC5",
                description="1.2*DL + 1.2*LL + 1.2*EQ",
                factors={"DL": float64(1.2), "LL": float64(1.2), "EQ": float64(1.2)},
                envelope_type="ultimate",
            ),
            LoadCombination(
                name="LC6",
                description="0.9*DL + 1.5*WL",
                factors={"DL": float64(0.9), "WL": float64(1.5)},
                envelope_type="ultimate",
            ),
            LoadCombination(
                name="LC7",
                description="0.9*DL + 1.5*EQ",
                factors={"DL": float64(0.9), "EQ": float64(1.5)},
                envelope_type="ultimate",
            ),
        ]

    @staticmethod
    def is456_serviceability_combinations() -> List[LoadCombination]:
        """Serviceability combinations for deflection/crack checks."""
        return [
            LoadCombination(
                name="SLC1",
                description="DL + LL",
                factors={"DL": float64(1.0), "LL": float64(1.0)},
                envelope_type="serviceability",
            ),
            LoadCombination(
                name="SLC2",
                description="DL + 0.8*LL",
                factors={"DL": float64(1.0), "LL": float64(0.8)},
                envelope_type="serviceability",
            ),
            LoadCombination(
                name="SLC3",
                description="DL",
                factors={"DL": float64(1.0)},
                envelope_type="serviceability",
            ),
        ]

    @staticmethod
    def is800_ultimate_combinations() -> List[LoadCombination]:
        """IS 800:2007 Clause 6.3 - Ultimate combinations for steel."""
        return [
            LoadCombination(
                name="LC1",
                description="1.5*DL + 1.5*LL",
                factors={"DL": float64(1.5), "LL": float64(1.5)},
                envelope_type="ultimate",
            ),
            LoadCombination(
                name="LC2",
                description="1.05*DL + 1.5*LL + 0.9*WL (WL assists)",
                factors={"DL": float64(1.05), "LL": float64(1.5), "WL": float64(0.9)},
                envelope_type="ultimate",
            ),
            LoadCombination(
                name="LC3",
                description="1.5*DL + 0.9*LL + 1.5*WL (WL opposes)",
                factors={"DL": float64(1.5), "LL": float64(0.9), "WL": float64(1.5)},
                envelope_type="ultimate",
            ),
            LoadCombination(
                name="LC4",
                description="0.9*DL + 1.5*WL (Uplift)",
                factors={"DL": float64(0.9), "WL": float64(1.5)},
                envelope_type="ultimate",
            ),
        ]

    @staticmethod
    def is800_serviceability_combinations() -> List[LoadCombination]:
        """IS 800 serviceability combinations."""
        return [
            LoadCombination(
                name="SLC1",
                description="DL + LL",
                factors={"DL": float64(1.0), "LL": float64(1.0)},
                envelope_type="serviceability",
            ),
            LoadCombination(
                name="SLC2",
                description="DL + WL",
                factors={"DL": float64(1.0), "WL": float64(1.0)},
                envelope_type="serviceability",
            ),
        ]

    @staticmethod
    def generate_combinations(
        load_cases: Dict[str, LoadCase],
        code: str = "is456",
        envelope_type: str = "ultimate",
    ) -> Dict[str, ndarray]:
        """Generate combined load vectors for selected design code."""
        code_l = code.lower()
        if code_l == "is456":
            combos = (
                LoadCombinator.is456_ultimate_combinations()
                if envelope_type == "ultimate"
                else LoadCombinator.is456_serviceability_combinations()
            )
        elif code_l == "is800":
            combos = (
                LoadCombinator.is800_ultimate_combinations()
                if envelope_type == "ultimate"
                else LoadCombinator.is800_serviceability_combinations()
            )
        else:
            raise ValueError(f"Unknown code: {code}")

        combined_loads: Dict[str, dict] = {}

        for combo in combos:
            # Hard guard: do not combine WL + EQ in one combo.
            if "WL" in combo.factors and "EQ" in combo.factors:
                logger.error(
                    "Skipping invalid combination %s: WL and EQ cannot be combined",
                    combo.name,
                )
                continue

            # Require all cases to avoid unconservative partial combinations.
            missing = [name for name in combo.factors if name not in load_cases]
            if missing:
                logger.warning("Skipping %s: missing load cases %s", combo.name, missing)
                continue

            n_dofs = len(next(iter(load_cases.values())).load_vector)
            f_combined = np.zeros(n_dofs, dtype=float64)
            for lc_name, factor in combo.factors.items():
                f_combined += factor * load_cases[lc_name].load_vector

            combined_loads[combo.name] = {
                "description": combo.description,
                "load_vector": f_combined,
                "envelope_type": envelope_type,
            }

        logger.info("Generated %d combinations for %s", len(combined_loads), code)
        return combined_loads

    @staticmethod
    def envelope_analysis(results: Dict[str, Dict]) -> Dict[str, Dict]:
        """Find max/min envelope across numerical scalar result keys."""
        if not results:
            return {"max": {}, "min": {}}

        first_result = next(iter(results.values()))
        envelope = {"max": {}, "min": {}, "combinations": list(results.keys())}

        sample_keys = []
        if isinstance(first_result, dict):
            for key, value in first_result.items():
                if isinstance(value, (int, float, float64, dict)):
                    sample_keys.append(key)

        for key in sample_keys:
            values = []
            for lc_name, lc_result in results.items():
                if key not in lc_result:
                    continue
                value = lc_result[key]
                if isinstance(value, dict):
                    for _, sub_value in value.items():
                        if isinstance(sub_value, (int, float, float64)):
                            values.append((lc_name, float64(sub_value)))
                else:
                    values.append((lc_name, float64(value)))

            if values:
                max_combo = max(values, key=lambda x: x[1])
                min_combo = min(values, key=lambda x: x[1])
                envelope["max"][key] = {
                    "value": float64(max_combo[1]),
                    "from_combination": max_combo[0],
                }
                envelope["min"][key] = {
                    "value": float64(min_combo[1]),
                    "from_combination": min_combo[0],
                }

        logger.info("Envelope analysis complete: %d quantities", len(envelope["max"]))
        return envelope


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    combos = LoadCombinator.is456_ultimate_combinations()
    print(f"IS 456 combinations: {len(combos)}")
    for combo in combos:
        print(f"  {combo.name}: {combo.description}")
