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
from typing import List, Dict, Tuple
from enum import Enum


class LoadType(Enum):
    """Types of loads"""
    DEAD = "DL"
    LIVE = "LL"
    WIND = "WL"
    SEISMIC = "EL"
    SNOW = "SL"
    TEMPERATURE = "T"
    SOIL_PRESSURE = "EP"


class DesignCode(Enum):
    """Design codes"""
    IS875 = "IS 875:2015"
    ASCE7 = "ASCE 7-22"
    EUROCODE = "EN 1990"


@dataclass
class LoadCase:
    """Individual load case"""
    id: str
    name: str
    load_type: LoadType
    magnitude: float = 1.0  # Scaling factor
    direction: str = "+Y"  # Load direction
    
    def __str__(self):
        return f"{self.id}: {self.name} ({self.load_type.value})"


@dataclass
class LoadCombination:
    """Load combination with factors"""
    id: str
    name: str
    description: str
    factors: Dict[str, float]  # load_case_id -> factor
    limit_state: str  # "ULS" or "SLS"
    code: DesignCode
    
    def get_equation(self, load_cases: List[LoadCase]) -> str:
        """Get combination equation as string"""
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
        if self.code == DesignCode.IS875:
            return self._generate_is875_combinations()
        elif self.code == DesignCode.ASCE7:
            return self._generate_asce7_combinations()
        elif self.code == DesignCode.EUROCODE:
            return self._generate_eurocode_combinations()
        else:
            return []
    
    def _generate_is875_combinations(self) -> List[LoadCombination]:
        """
        Generate IS 875 (Part 5): 2015 load combinations
        
        ULS Combinations:
        1. 1.5(DL + LL)
        2. 1.5(DL + WL)
        3. 1.2(DL + LL + WL)
        4. 1.5(DL ± EL)
        5. 1.2(DL + LL ± EL)
        6. 1.5(DL + SL)
        7. 1.2(DL + LL + SL)
        
        SLS Combinations:
        1. 1.0(DL + LL)
        2. 1.0(DL + WL)
        3. 1.0(DL + LL + 0.8*WL)
        """
        combinations = []
        
        # Get load case IDs by type
        dl_ids = [lc.id for lc in self.load_cases if lc.load_type == LoadType.DEAD]
        ll_ids = [lc.id for lc in self.load_cases if lc.load_type == LoadType.LIVE]
        wl_ids = [lc.id for lc in self.load_cases if lc.load_type == LoadType.WIND]
        el_ids = [lc.id for lc in self.load_cases if lc.load_type == LoadType.SEISMIC]
        sl_ids = [lc.id for lc in self.load_cases if lc.load_type == LoadType.SNOW]
        
        # ULS Combinations
        combo_num = 1
        
        # 1.5(DL + LL)
        if dl_ids and ll_ids:
            factors = {lc_id: 1.5 for lc_id in dl_ids + ll_ids}
            combinations.append(LoadCombination(
                id=f"ULS{combo_num}",
                name=f"ULS Combo {combo_num}",
                description="1.5(DL + LL)",
                factors=factors,
                limit_state="ULS",
                code=DesignCode.IS875
            ))
            combo_num += 1
        
        # 1.5(DL + WL)
        if dl_ids and wl_ids:
            factors = {lc_id: 1.5 for lc_id in dl_ids + wl_ids}
            combinations.append(LoadCombination(
                id=f"ULS{combo_num}",
                name=f"ULS Combo {combo_num}",
                description="1.5(DL + WL)",
                factors=factors,
                limit_state="ULS",
                code=DesignCode.IS875
            ))
            combo_num += 1
        
        # 1.2(DL + LL + WL)
        if dl_ids and ll_ids and wl_ids:
            factors = {lc_id: 1.2 for lc_id in dl_ids + ll_ids + wl_ids}
            combinations.append(LoadCombination(
                id=f"ULS{combo_num}",
                name=f"ULS Combo {combo_num}",
                description="1.2(DL + LL + WL)",
                factors=factors,
                limit_state="ULS",
                code=DesignCode.IS875
            ))
            combo_num += 1
        
        # 1.5(DL + EL) and 1.5(DL - EL)
        if dl_ids and el_ids:
            # Positive seismic
            factors = {**{lc_id: 1.5 for lc_id in dl_ids}, **{lc_id: 1.5 for lc_id in el_ids}}
            combinations.append(LoadCombination(
                id=f"ULS{combo_num}",
                name=f"ULS Combo {combo_num}",
                description="1.5(DL + EL)",
                factors=factors,
                limit_state="ULS",
                code=DesignCode.IS875
            ))
            combo_num += 1
            
            # Negative seismic
            factors = {**{lc_id: 1.5 for lc_id in dl_ids}, **{lc_id: -1.5 for lc_id in el_ids}}
            combinations.append(LoadCombination(
                id=f"ULS{combo_num}",
                name=f"ULS Combo {combo_num}",
                description="1.5(DL - EL)",
                factors=factors,
                limit_state="ULS",
                code=DesignCode.IS875
            ))
            combo_num += 1
        
        # 1.2(DL + LL + EL) and 1.2(DL + LL - EL)
        if dl_ids and ll_ids and el_ids:
            # Positive seismic
            factors = {**{lc_id: 1.2 for lc_id in dl_ids + ll_ids}, **{lc_id: 1.2 for lc_id in el_ids}}
            combinations.append(LoadCombination(
                id=f"ULS{combo_num}",
                name=f"ULS Combo {combo_num}",
                description="1.2(DL + LL + EL)",
                factors=factors,
                limit_state="ULS",
                code=DesignCode.IS875
            ))
            combo_num += 1
            
            # Negative seismic
            factors = {**{lc_id: 1.2 for lc_id in dl_ids + ll_ids}, **{lc_id: -1.2 for lc_id in el_ids}}
            combinations.append(LoadCombination(
                id=f"ULS{combo_num}",
                name=f"ULS Combo {combo_num}",
                description="1.2(DL + LL - EL)",
                factors=factors,
                limit_state="ULS",
                code=DesignCode.IS875
            ))
            combo_num += 1
        
        # 1.5(DL + SL)
        if dl_ids and sl_ids:
            factors = {lc_id: 1.5 for lc_id in dl_ids + sl_ids}
            combinations.append(LoadCombination(
                id=f"ULS{combo_num}",
                name=f"ULS Combo {combo_num}",
                description="1.5(DL + SL)",
                factors=factors,
                limit_state="ULS",
                code=DesignCode.IS875
            ))
            combo_num += 1
        
        # 1.2(DL + LL + SL)
        if dl_ids and ll_ids and sl_ids:
            factors = {lc_id: 1.2 for lc_id in dl_ids + ll_ids + sl_ids}
            combinations.append(LoadCombination(
                id=f"ULS{combo_num}",
                name=f"ULS Combo {combo_num}",
                description="1.2(DL + LL + SL)",
                factors=factors,
                limit_state="ULS",
                code=DesignCode.IS875
            ))
            combo_num += 1
        
        # SLS Combinations
        combo_num = 1
        
        # 1.0(DL + LL)
        if dl_ids and ll_ids:
            factors = {lc_id: 1.0 for lc_id in dl_ids + ll_ids}
            combinations.append(LoadCombination(
                id=f"SLS{combo_num}",
                name=f"SLS Combo {combo_num}",
                description="1.0(DL + LL)",
                factors=factors,
                limit_state="SLS",
                code=DesignCode.IS875
            ))
            combo_num += 1
        
        # 1.0(DL + WL)
        if dl_ids and wl_ids:
            factors = {lc_id: 1.0 for lc_id in dl_ids + wl_ids}
            combinations.append(LoadCombination(
                id=f"SLS{combo_num}",
                name=f"SLS Combo {combo_num}",
                description="1.0(DL + WL)",
                factors=factors,
                limit_state="SLS",
                code=DesignCode.IS875
            ))
            combo_num += 1
        
        # 1.0(DL + LL + 0.8*WL)
        if dl_ids and ll_ids and wl_ids:
            factors = {**{lc_id: 1.0 for lc_id in dl_ids + ll_ids}, **{lc_id: 0.8 for lc_id in wl_ids}}
            combinations.append(LoadCombination(
                id=f"SLS{combo_num}",
                name=f"SLS Combo {combo_num}",
                description="1.0(DL + LL + 0.8*WL)",
                factors=factors,
                limit_state="SLS",
                code=DesignCode.IS875
            ))
            combo_num += 1
        
        self.combinations = combinations
        return combinations
    
    def _generate_asce7_combinations(self) -> List[LoadCombination]:
        """
        Generate ASCE 7-22 load combinations
        
        Basic Combinations (Strength Design):
        1. 1.4D
        2. 1.2D + 1.6L + 0.5(Lr or S or R)
        3. 1.2D + 1.6(Lr or S or R) + (L or 0.5W)
        4. 1.2D + 1.0W + L + 0.5(Lr or S or R)
        5. 1.2D + 1.0E + L + 0.2S
        6. 0.9D + 1.0W
        7. 0.9D + 1.0E
        """
        combinations = []
        
        dl_ids = [lc.id for lc in self.load_cases if lc.load_type == LoadType.DEAD]
        ll_ids = [lc.id for lc in self.load_cases if lc.load_type == LoadType.LIVE]
        wl_ids = [lc.id for lc in self.load_cases if lc.load_type == LoadType.WIND]
        el_ids = [lc.id for lc in self.load_cases if lc.load_type == LoadType.SEISMIC]
        sl_ids = [lc.id for lc in self.load_cases if lc.load_type == LoadType.SNOW]
        
        combo_num = 1
        
        # 1.4D
        if dl_ids:
            factors = {lc_id: 1.4 for lc_id in dl_ids}
            combinations.append(LoadCombination(
                id=f"ASCE{combo_num}",
                name=f"ASCE 7-22 Combo {combo_num}",
                description="1.4D",
                factors=factors,
                limit_state="ULS",
                code=DesignCode.ASCE7
            ))
            combo_num += 1
        
        # 1.2D + 1.6L
        if dl_ids and ll_ids:
            factors = {**{lc_id: 1.2 for lc_id in dl_ids}, **{lc_id: 1.6 for lc_id in ll_ids}}
            combinations.append(LoadCombination(
                id=f"ASCE{combo_num}",
                name=f"ASCE 7-22 Combo {combo_num}",
                description="1.2D + 1.6L",
                factors=factors,
                limit_state="ULS",
                code=DesignCode.ASCE7
            ))
            combo_num += 1
        
        # 1.2D + 1.6S
        if dl_ids and sl_ids:
            factors = {**{lc_id: 1.2 for lc_id in dl_ids}, **{lc_id: 1.6 for lc_id in sl_ids}}
            combinations.append(LoadCombination(
                id=f"ASCE{combo_num}",
                name=f"ASCE 7-22 Combo {combo_num}",
                description="1.2D + 1.6S",
                factors=factors,
                limit_state="ULS",
                code=DesignCode.ASCE7
            ))
            combo_num += 1
        
        # 1.2D + 1.0W + L + 0.5S
        if dl_ids and wl_ids and ll_ids and sl_ids:
            factors = {
                **{lc_id: 1.2 for lc_id in dl_ids},
                **{lc_id: 1.0 for lc_id in wl_ids + ll_ids},
                **{lc_id: 0.5 for lc_id in sl_ids}
            }
            combinations.append(LoadCombination(
                id=f"ASCE{combo_num}",
                name=f"ASCE 7-22 Combo {combo_num}",
                description="1.2D + 1.0W + L + 0.5S",
                factors=factors,
                limit_state="ULS",
                code=DesignCode.ASCE7
            ))
            combo_num += 1
        
        # 1.2D + 1.0E + L + 0.2S
        if dl_ids and el_ids and ll_ids and sl_ids:
            factors = {
                **{lc_id: 1.2 for lc_id in dl_ids},
                **{lc_id: 1.0 for lc_id in el_ids + ll_ids},
                **{lc_id: 0.2 for lc_id in sl_ids}
            }
            combinations.append(LoadCombination(
                id=f"ASCE{combo_num}",
                name=f"ASCE 7-22 Combo {combo_num}",
                description="1.2D + 1.0E + L + 0.2S",
                factors=factors,
                limit_state="ULS",
                code=DesignCode.ASCE7
            ))
            combo_num += 1
        
        # 0.9D + 1.0W
        if dl_ids and wl_ids:
            factors = {**{lc_id: 0.9 for lc_id in dl_ids}, **{lc_id: 1.0 for lc_id in wl_ids}}
            combinations.append(LoadCombination(
                id=f"ASCE{combo_num}",
                name=f"ASCE 7-22 Combo {combo_num}",
                description="0.9D + 1.0W",
                factors=factors,
                limit_state="ULS",
                code=DesignCode.ASCE7
            ))
            combo_num += 1
        
        # 0.9D + 1.0E
        if dl_ids and el_ids:
            factors = {**{lc_id: 0.9 for lc_id in dl_ids}, **{lc_id: 1.0 for lc_id in el_ids}}
            combinations.append(LoadCombination(
                id=f"ASCE{combo_num}",
                name=f"ASCE 7-22 Combo {combo_num}",
                description="0.9D + 1.0E",
                factors=factors,
                limit_state="ULS",
                code=DesignCode.ASCE7
            ))
            combo_num += 1
        
        self.combinations = combinations
        return combinations
    
    def _generate_eurocode_combinations(self) -> List[LoadCombination]:
        """Generate Eurocode EN 1990 combinations"""
        # Similar structure to IS875 and ASCE7
        # Implement Eurocode combinations here
        return []
    
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


# ============================================
# USAGE EXAMPLE
# ============================================

if __name__ == "__main__":
    # Create load cases
    generator = LoadCombinationGenerator(code=DesignCode.IS875)
    
    generator.add_load_case(LoadCase("DL1", "Dead Load - Self Weight", LoadType.DEAD))
    generator.add_load_case(LoadCase("LL1", "Live Load - Floor", LoadType.LIVE))
    generator.add_load_case(LoadCase("WL1", "Wind Load - X Direction", LoadType.WIND))
    generator.add_load_case(LoadCase("EL1", "Seismic Load - X Direction", LoadType.SEISMIC))
    
    # Generate combinations
    combinations = generator.generate_combinations()
    
    print(f"Generated {len(combinations)} load combinations for IS 875:2015\n")
    
    for combo in combinations:
        print(f"{combo.id}: {combo.description}")
        print(f"  Equation: {combo.get_equation(generator.load_cases)}")
        print(f"  Limit State: {combo.limit_state}\n")
