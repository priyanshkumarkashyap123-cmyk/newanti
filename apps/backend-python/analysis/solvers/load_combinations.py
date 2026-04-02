"""
load_combinations.py - IS code load combination rules and enveloping

Implements load factoring per:
- IS 875:1987 (Wind loads)
- IS 1893:2016 (Seismic loads)
- IS 456:2000 (Concrete code - DL + LL combinations)
"""

import logging
from dataclasses import dataclass
from typing import Dict, Iterable, List, Sequence

import numpy as np
from numpy import float64, ndarray

# Shared models (preferred) and legacy fallbacks
from ..generators.load_combinations_shared import LoadCombination, LoadFactor, LoadType, DesignCode

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class LoadCombinationTemplate:
    """Template to generate a LoadCombination without duplicating boilerplate."""

    id: str
    name: str
    code: str
    factors: Sequence[LoadFactor]
    description: str


@dataclass
class LoadCase:
    """A load case with load type and scaling factors."""

    name: str  # e.g., 'DL', 'LL', 'WL', 'EQ'
    description: str
    load_vector: ndarray
    load_type: str  # 'permanent' or 'temporary'


@dataclass
class LegacyLoadCombination:
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
    def _build_combinations(templates: Iterable[LoadCombinationTemplate]) -> List[LoadCombination]:
        """Helper to convert templates into LoadCombination instances."""
        return [
            LoadCombination(
                id=tpl.id,
                name=tpl.name,
                code=tpl.code,
                factors=list(tpl.factors),
                description=tpl.description,
            )
            for tpl in templates
        ]

    @staticmethod
    def is456_ultimate_combinations() -> List[LoadCombination]:
        """
        IS 456/IS 875/IS 1893 typical LSM set.

        Note:
        - Wind and earthquake are not combined in one combination.
        - Combination IDs align with project convention LC1..LC7.
        """
        templates = [
            LoadCombinationTemplate(
                id="LC1",
                name="1.5*DL + 1.5*LL",
                code=DesignCode.IS456.value,
                factors=(LoadFactor("DL", 1.5), LoadFactor("LL", 1.5)),
                description="IS456 ULS",
            ),
            LoadCombinationTemplate(
                id="LC2",
                name="1.5*DL + 1.5*WL",
                code=DesignCode.IS456.value,
                factors=(LoadFactor("DL", 1.5), LoadFactor("WL", 1.5)),
                description="IS456 ULS",
            ),
            LoadCombinationTemplate(
                id="LC3",
                name="1.2*DL + 1.2*LL + 1.2*WL",
                code=DesignCode.IS456.value,
                factors=(LoadFactor("DL", 1.2), LoadFactor("LL", 1.2), LoadFactor("WL", 1.2)),
                description="IS456 ULS",
            ),
            LoadCombinationTemplate(
                id="LC4",
                name="1.5*DL + 1.5*EQ",
                code=DesignCode.IS456.value,
                factors=(LoadFactor("DL", 1.5), LoadFactor("EQ", 1.5)),
                description="IS456 ULS",
            ),
            LoadCombinationTemplate(
                id="LC5",
                name="1.2*DL + 1.2*LL + 1.2*EQ",
                code=DesignCode.IS456.value,
                factors=(LoadFactor("DL", 1.2), LoadFactor("LL", 1.2), LoadFactor("EQ", 1.2)),
                description="IS456 ULS",
            ),
            LoadCombinationTemplate(
                id="LC6",
                name="0.9*DL + 1.5*WL",
                code=DesignCode.IS456.value,
                factors=(LoadFactor("DL", 0.9), LoadFactor("WL", 1.5)),
                description="IS456 ULS",
            ),
            LoadCombinationTemplate(
                id="LC7",
                name="0.9*DL + 1.5*EQ",
                code=DesignCode.IS456.value,
                factors=(LoadFactor("DL", 0.9), LoadFactor("EQ", 1.5)),
                description="IS456 ULS",
            ),
        ]
        return LoadCombinator._build_combinations(templates)

    @staticmethod
    def is456_serviceability_combinations() -> List[LoadCombination]:
        """Serviceability combinations for deflection/crack checks."""
        templates = [
            LoadCombinationTemplate(
                id="SLC1",
                name="DL + LL",
                code=DesignCode.IS456.value,
                factors=(LoadFactor("DL", 1.0), LoadFactor("LL", 1.0)),
                description="IS456 SLS",
            ),
            LoadCombinationTemplate(
                id="SLC2",
                name="DL + 0.8*LL",
                code=DesignCode.IS456.value,
                factors=(LoadFactor("DL", 1.0), LoadFactor("LL", 0.8)),
                description="IS456 SLS",
            ),
            LoadCombinationTemplate(
                id="SLC3",
                name="DL",
                code=DesignCode.IS456.value,
                factors=(LoadFactor("DL", 1.0),),
                description="IS456 SLS",
            ),
        ]
        return LoadCombinator._build_combinations(templates)

    @staticmethod
    def is800_ultimate_combinations() -> List[LoadCombination]:
        """IS 800:2007 Clause 6.3 - Ultimate combinations for steel."""
        templates = [
            LoadCombinationTemplate(
                id="LC1",
                name="1.5*DL + 1.5*LL",
                code=DesignCode.IS800_LSM.value,
                factors=(LoadFactor("DL", 1.5), LoadFactor("LL", 1.5)),
                description="IS800 ULS",
            ),
            LoadCombinationTemplate(
                id="LC2",
                name="1.05*DL + 1.5*LL + 0.9*WL (WL assists)",
                code=DesignCode.IS800_LSM.value,
                factors=(LoadFactor("DL", 1.05), LoadFactor("LL", 1.5), LoadFactor("WL", 0.9)),
                description="IS800 ULS",
            ),
            LoadCombinationTemplate(
                id="LC3",
                name="1.5*DL + 0.9*LL + 1.5*WL (WL opposes)",
                code=DesignCode.IS800_LSM.value,
                factors=(LoadFactor("DL", 1.5), LoadFactor("LL", 0.9), LoadFactor("WL", 1.5)),
                description="IS800 ULS",
            ),
            LoadCombinationTemplate(
                id="LC4",
                name="0.9*DL + 1.5*WL (Uplift)",
                code=DesignCode.IS800_LSM.value,
                factors=(LoadFactor("DL", 0.9), LoadFactor("WL", 1.5)),
                description="IS800 ULS",
            ),
        ]
        return LoadCombinator._build_combinations(templates)

    @staticmethod
    def is800_serviceability_combinations() -> List[LoadCombination]:
        """IS 800 serviceability combinations."""
        templates = [
            LoadCombinationTemplate(
                id="SLC1",
                name="DL + LL",
                code=DesignCode.IS800_LSM.value,
                factors=(LoadFactor("DL", 1.0), LoadFactor("LL", 1.0)),
                description="IS800 SLS",
            ),
            LoadCombinationTemplate(
                id="SLC2",
                name="DL + WL",
                code=DesignCode.IS800_LSM.value,
                factors=(LoadFactor("DL", 1.0), LoadFactor("WL", 1.0)),
                description="IS800 SLS",
            ),
        ]
        return LoadCombinator._build_combinations(templates)

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
            factor_map = {f.load_type: f.factor for f in combo.factors}

            # Hard guard: do not combine WL + EQ in one combo.
            if "WL" in factor_map and "EQ" in factor_map:
                logger.error(
                    "Skipping invalid combination %s: WL and EQ cannot be combined",
                    combo.name,
                )
                continue

            # Require all cases to avoid unconservative partial combinations.
            missing = [name for name in factor_map if name not in load_cases]
            if missing:
                logger.warning("Skipping %s: missing load cases %s", combo.name, missing)
                continue

            n_dofs = len(next(iter(load_cases.values())).load_vector)
            f_combined = np.zeros(n_dofs, dtype=float64)
            for lc_name, factor in factor_map.items():
                f_combined += factor * load_cases[lc_name].load_vector

            combined_loads[combo.id] = {
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
