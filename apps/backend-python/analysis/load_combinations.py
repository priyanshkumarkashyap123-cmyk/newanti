"""
load_combinations.py - Automatic Load Combination Generator

Generates load combinations according to:
- IS 875 (Part 5): 2015 - Indian Standard
- ASCE 7-22 - American Standard
- Eurocode EN 1990 - European Standard

Implements:
- Dead Load (DL)
- Live Load (LL)
- Wind Load (WL)
- Seismic Load (EL)
- Snow Load (SL)

Combination methods:
- Ultimate Limit State (ULS)
- Serviceability Limit State (SLS)
"""

from dataclasses import dataclass
from typing import List, Dict, Tuple, Optional
from enum import Enum

# Shared models/enums to avoid duplication with generators
from .generators.load_combinations_shared import (
    CombinationResult,
    DesignCode,
    LoadCombination,
    LoadFactor,
    LoadType,
)
from .load_combinations_envelope import EnvelopeResult, compute_envelope
from .load_combinations_code_generators import (
    generate_asce7_combinations,
    generate_eurocode_combinations,
    generate_is875_combinations,
)
from .load_combinations_is_codes import (
    IS1893CombinationGenerator,
    IS456CombinationGenerator,
    IS800CombinationGenerator,
)


# Legacy enums kept for backward compatibility; map to shared enums if needed
class LegacyLoadType(Enum):
    DEAD = "DL"
    LIVE = "LL"
    WIND = "WL"
    SEISMIC = "EL"
    SNOW = "SL"
    TEMPERATURE = "T"
    SOIL_PRESSURE = "EP"


class LegacyDesignCode(Enum):
    IS875 = "IS 875:2015"
    ASCE7 = "ASCE 7-22"
    EUROCODE = "EN 1990"


@dataclass
class LoadCase:
    """Individual load case"""

    id: str
    name: str
    load_type: LegacyLoadType
    magnitude: float = 1.0  # Scaling factor
    direction: str = "+Y"  # Load direction

    def __str__(self):
        return f"{self.id}: {self.name} ({self.load_type.value})"


@dataclass
class LegacyLoadCombination:
    """Load combination with factors"""

    id: str
    name: str
    description: str
    factors: Dict[str, float]  # load_case_id -> factor
    limit_state: str  # "ULS" or "SLS"
    code: LegacyDesignCode

    def get_equation(self, load_cases: List[LoadCase]) -> str:
        terms = []
        for lc in load_cases:
            if lc.id in self.factors:
                factor = self.factors[lc.id]
                if factor != 0:
                    sign = "+" if factor > 0 else ""
                    terms.append(f"{sign}{factor:.2f}*{lc.load_type.value}")
        return " ".join(terms) if terms else "0"


class LoadCombinationGenerator:
    """Generates load combinations according to design codes"""
    
    def __init__(self, code: DesignCode = DesignCode.IS875):
        self.code = code
        self.load_cases: List[LoadCase] = []
        self.combinations: List[LoadCombination] = []
    
    def add_load_case(self, load_case: LoadCase):
        """Add a load case"""
        self.load_cases.append(load_case)
    
    def generate_combinations(self) -> List[LoadCombination]:
        """Generate all applicable load combinations"""
        code_value = getattr(self.code, "value", self.code)
        if self.code == LegacyDesignCode.IS875 or code_value in (DesignCode.IS875.value, "IS875"):
            return self._generate_is875_combinations()
        elif self.code == LegacyDesignCode.ASCE7 or code_value in (DesignCode.ASCE7.value, "ASCE7"):
            return self._generate_asce7_combinations()
        elif self.code == LegacyDesignCode.EUROCODE or code_value in (DesignCode.EUROCODE.value, "EUROCODE"):
            return self._generate_eurocode_combinations()
        else:
            return []
    
    def _generate_is875_combinations(self) -> List[LegacyLoadCombination]:
        combinations = generate_is875_combinations(self.load_cases)
        self.combinations = combinations
        return combinations
    
    def _generate_asce7_combinations(self) -> List[LegacyLoadCombination]:
        combinations = generate_asce7_combinations(self.load_cases)
        self.combinations = combinations
        return combinations
    
    def _generate_eurocode_combinations(self) -> List[LoadCombination]:
        combinations = generate_eurocode_combinations(self.load_cases)
        self.combinations = combinations
        return combinations

    def export_combinations(self) -> List[Dict]:
        """Export combinations as dictionaries for API"""
        return [
            {
                'id': combo.id,
                'name': combo.name,
                'description': combo.description,
                'equation': combo.get_equation(self.load_cases),
                'factors': combo.factors,
                'limit_state': combo.limit_state,
                'code': combo.code.value
            }
            for combo in self.combinations
        ]


# ============================================================
# Convenience: generate ALL combinations for a given code suite
# ============================================================

def generate_all_combinations(
    load_cases: List[LoadCase],
    code: str = "IS",
) -> List[LoadCombination]:
    """
    Generate a comprehensive set of load combinations.

    Parameters
    ----------
    load_cases : list of LoadCase
    code : str
        'IS' → IS 875 + IS 456 + IS 800 + IS 1893
        'ASCE' → ASCE 7-22
        'EC' → Eurocode

    Returns
    -------
    list of LoadCombination  (deduplicated by description)
    """
    combos: List[LoadCombination] = []

    if code.upper() in ("IS", "IS875", "INDIAN"):
        gen875 = LoadCombinationGenerator(DesignCode.IS875)
        for lc in load_cases:
            gen875.add_load_case(lc)
        combos.extend(gen875.generate_combinations())
        combos.extend(IS456CombinationGenerator(load_cases).generate())
        combos.extend(IS800CombinationGenerator(load_cases).generate())
        combos.extend(IS1893CombinationGenerator(load_cases).generate())

    elif code.upper() in ("ASCE", "ASCE7", "AMERICAN"):
        gen = LoadCombinationGenerator(DesignCode.ASCE7)
        for lc in load_cases:
            gen.add_load_case(lc)
        combos.extend(gen.generate_combinations())

    elif code.upper() in ("EC", "EUROCODE", "EN1990"):
        gen = LoadCombinationGenerator(DesignCode.EUROCODE)
        for lc in load_cases:
            gen.add_load_case(lc)
        combos.extend(gen.generate_combinations())

    # Deduplicate by (limit_state, description)
    seen: set = set()
    unique: List[LoadCombination] = []
    for c in combos:
        key = (c.limit_state, c.description)
        if key not in seen:
            seen.add(key)
            unique.append(c)
    return unique


# ============================================
# USAGE EXAMPLE
# ============================================

if __name__ == "__main__":
    # Create load cases
    cases = [
        LoadCase("DL1", "Dead Load - Self Weight", LoadType.DEAD),
        LoadCase("LL1", "Live Load - Floor", LoadType.LIVE),
        LoadCase("WL1", "Wind Load - X Direction", LoadType.WIND),
        LoadCase("EL1", "Seismic Load - X Direction", LoadType.SEISMIC),
    ]

    # ---- IS 875 only ----
    generator = LoadCombinationGenerator(code=DesignCode.IS875)
    for lc in cases:
        generator.add_load_case(lc)
    combinations = generator.generate_combinations()
    print(f"IS 875 → {len(combinations)} combinations")
    for combo in combinations:
        print(f"  {combo.id}: {combo.description}  [{combo.limit_state}]")

    # ---- All Indian Standard codes ----
    print()
    all_combos = generate_all_combinations(cases, code="IS")
    print(f"All IS codes → {len(all_combos)} unique combinations")
    for combo in all_combos:
        print(f"  {combo.id}: {combo.description}  [{combo.limit_state}]")

    # ---- ASCE 7 ----
    print()
    asce = generate_all_combinations(cases, code="ASCE")
    print(f"ASCE 7 → {len(asce)} combinations")
    for combo in asce:
        print(f"  {combo.id}: {combo.description}  [{combo.limit_state}]")
