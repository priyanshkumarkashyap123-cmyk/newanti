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
        """
        Generate Eurocode EN 1990 combinations (fundamental)

        6.10a: 1.35*Gk + 1.5*Qk,1 + 1.5*psi0*Qk,i
        6.10b (simplified):
          1. 1.35G + 1.5Q
          2. 1.35G + 1.5W
          3. 1.35G + 1.5Q + 0.9W
          4. 1.0G + 1.5W  (uplift)
        """
        combinations: List[LoadCombination] = []

        dl_ids = [lc.id for lc in self.load_cases if lc.load_type == LoadType.DEAD]
        ll_ids = [lc.id for lc in self.load_cases if lc.load_type == LoadType.LIVE]
        wl_ids = [lc.id for lc in self.load_cases if lc.load_type == LoadType.WIND]
        el_ids = [lc.id for lc in self.load_cases if lc.load_type == LoadType.SEISMIC]

        combo_num = 1

        # 1.35G + 1.5Q
        if dl_ids and ll_ids:
            factors = {**{i: 1.35 for i in dl_ids}, **{i: 1.5 for i in ll_ids}}
            combinations.append(LoadCombination(
                id=f"EC{combo_num}", name=f"Eurocode Combo {combo_num}",
                description="1.35G + 1.5Q", factors=factors,
                limit_state="ULS", code=DesignCode.EUROCODE))
            combo_num += 1

        # 1.35G + 1.5W
        if dl_ids and wl_ids:
            factors = {**{i: 1.35 for i in dl_ids}, **{i: 1.5 for i in wl_ids}}
            combinations.append(LoadCombination(
                id=f"EC{combo_num}", name=f"Eurocode Combo {combo_num}",
                description="1.35G + 1.5W", factors=factors,
                limit_state="ULS", code=DesignCode.EUROCODE))
            combo_num += 1

        # 1.35G + 1.5Q + 0.9W
        if dl_ids and ll_ids and wl_ids:
            factors = {**{i: 1.35 for i in dl_ids}, **{i: 1.5 for i in ll_ids},
                       **{i: 0.9 for i in wl_ids}}
            combinations.append(LoadCombination(
                id=f"EC{combo_num}", name=f"Eurocode Combo {combo_num}",
                description="1.35G + 1.5Q + 0.9W", factors=factors,
                limit_state="ULS", code=DesignCode.EUROCODE))
            combo_num += 1

        # 1.0G + 1.5W (favourable dead, uplift)
        if dl_ids and wl_ids:
            factors = {**{i: 1.0 for i in dl_ids}, **{i: 1.5 for i in wl_ids}}
            combinations.append(LoadCombination(
                id=f"EC{combo_num}", name=f"Eurocode Combo {combo_num}",
                description="1.0G + 1.5W (uplift)", factors=factors,
                limit_state="ULS", code=DesignCode.EUROCODE))
            combo_num += 1

        # Seismic: 1.0G + 1.0E + 0.3Q
        if dl_ids and el_ids:
            psi2 = 0.3
            factors = {**{i: 1.0 for i in dl_ids}, **{i: 1.0 for i in el_ids}}
            if ll_ids:
                factors.update({i: psi2 for i in ll_ids})
            combinations.append(LoadCombination(
                id=f"EC{combo_num}", name=f"Eurocode Combo {combo_num}",
                description="1.0G + 1.0E + 0.3Q", factors=factors,
                limit_state="ULS", code=DesignCode.EUROCODE))
            combo_num += 1

        # SLS: 1.0G + 1.0Q
        if dl_ids and ll_ids:
            factors = {i: 1.0 for i in dl_ids + ll_ids}
            combinations.append(LoadCombination(
                id=f"EC_SLS{combo_num}", name=f"Eurocode SLS {combo_num}",
                description="1.0G + 1.0Q", factors=factors,
                limit_state="SLS", code=DesignCode.EUROCODE))
            combo_num += 1

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
# IS 456:2000 — Table 18  (RC design specific combinations)
# ============================================================

class IS456CombinationGenerator:
    """
    IS 456:2000 Table 18 load combinations for reinforced concrete design.

    ULS (Limit State of Collapse):
      1.  1.5 DL + 1.5 LL
      2.  1.5 DL + 1.5 WL (or EL)
      3.  1.2 DL + 1.2 LL + 1.2 WL (or EL)
      4.  0.9 DL + 1.5 WL (or EL)   — uplift / overturning
      5.  1.5 DL + 1.5 T            — temperature
      6.  1.2 DL + 1.2 LL + 1.2 T

    SLS (Limit State of Serviceability):
      1.  1.0 DL + 1.0 LL
      2.  1.0 DL + 1.0 WL
      3.  1.0 DL + 0.8 LL + 0.8 WL
      4.  1.0 DL + 1.0 T
    """

    def __init__(self, load_cases: List[LoadCase]):
        self.load_cases = load_cases

    def _ids(self, lt: LoadType) -> List[str]:
        return [lc.id for lc in self.load_cases if lc.load_type == lt]

    def generate(self) -> List[LoadCombination]:
        combos: List[LoadCombination] = []
        dl = self._ids(LoadType.DEAD)
        ll = self._ids(LoadType.LIVE)
        wl = self._ids(LoadType.WIND)
        el = self._ids(LoadType.SEISMIC)
        tl = self._ids(LoadType.TEMPERATURE)
        lat = wl + el  # lateral loads (wind or seismic treated identically)

        n = 1
        # ---------- ULS ----------
        # 1.5(DL + LL)
        if dl and ll:
            combos.append(self._combo(f"IS456_U{n}", "1.5DL + 1.5LL",
                                       {i: 1.5 for i in dl + ll}, "ULS"))
            n += 1

        # 1.5(DL ± LAT)
        for sign_label, sign in [("+", 1.5), ("-", -1.5)]:
            if dl and lat:
                f = {**{i: 1.5 for i in dl}, **{i: sign for i in lat}}
                combos.append(self._combo(f"IS456_U{n}",
                    f"1.5DL {sign_label}1.5(WL/EL)", f, "ULS"))
                n += 1

        # 1.2(DL + LL ± LAT)
        for sign_label, sign in [("+", 1.2), ("-", -1.2)]:
            if dl and ll and lat:
                f = {**{i: 1.2 for i in dl + ll}, **{i: sign for i in lat}}
                combos.append(self._combo(f"IS456_U{n}",
                    f"1.2DL + 1.2LL {sign_label}1.2(WL/EL)", f, "ULS"))
                n += 1

        # 0.9 DL ± 1.5 LAT (overturning / uplift)
        for sign_label, sign in [("+", 1.5), ("-", -1.5)]:
            if dl and lat:
                f = {**{i: 0.9 for i in dl}, **{i: sign for i in lat}}
                combos.append(self._combo(f"IS456_U{n}",
                    f"0.9DL {sign_label}1.5(WL/EL)", f, "ULS"))
                n += 1

        # Temperature ULS
        if dl and tl:
            combos.append(self._combo(f"IS456_U{n}", "1.5DL + 1.5T",
                                       {**{i: 1.5 for i in dl}, **{i: 1.5 for i in tl}}, "ULS"))
            n += 1
        if dl and ll and tl:
            combos.append(self._combo(f"IS456_U{n}", "1.2DL + 1.2LL + 1.2T",
                                       {i: 1.2 for i in dl + ll + tl}, "ULS"))
            n += 1

        # ---------- SLS ----------
        m = 1
        if dl and ll:
            combos.append(self._combo(f"IS456_S{m}", "1.0DL + 1.0LL",
                                       {i: 1.0 for i in dl + ll}, "SLS"))
            m += 1
        if dl and lat:
            combos.append(self._combo(f"IS456_S{m}", "1.0DL + 1.0(WL/EL)",
                                       {i: 1.0 for i in dl + lat}, "SLS"))
            m += 1
        if dl and ll and lat:
            f = {**{i: 1.0 for i in dl}, **{i: 0.8 for i in ll + lat}}
            combos.append(self._combo(f"IS456_S{m}", "1.0DL + 0.8LL + 0.8(WL/EL)",
                                       f, "SLS"))
            m += 1
        if dl and tl:
            combos.append(self._combo(f"IS456_S{m}", "1.0DL + 1.0T",
                                       {i: 1.0 for i in dl + tl}, "SLS"))
            m += 1

        return combos

    def _combo(self, cid: str, desc: str, factors: Dict[str, float],
               ls: str) -> LoadCombination:
        return LoadCombination(id=cid, name=desc, description=desc,
                               factors=factors, limit_state=ls,
                               code=DesignCode.IS875)


# ============================================================
# IS 800:2007 — Table 4  (Steel design combinations)
# ============================================================

class IS800CombinationGenerator:
    """
    IS 800:2007 Table 4 load combinations for steel design.

    Partial safety factors for loads:
      DL:  γ = 1.5 (leading), 1.2 (accompanying), 0.9 (favourable)
      LL:  γ = 1.5 (leading), 1.2 (accompanying)
      WL:  γ = 1.5 (leading), 1.2 (accompanying)
      EL:  γ = 1.5 (leading), 1.2 (accompanying)
      AL:  γ = 1.0 (accidental)
    """

    def __init__(self, load_cases: List[LoadCase]):
        self.load_cases = load_cases

    def _ids(self, lt: LoadType) -> List[str]:
        return [lc.id for lc in self.load_cases if lc.load_type == lt]

    def generate(self) -> List[LoadCombination]:
        combos: List[LoadCombination] = []
        dl = self._ids(LoadType.DEAD)
        ll = self._ids(LoadType.LIVE)
        wl = self._ids(LoadType.WIND)
        el = self._ids(LoadType.SEISMIC)
        n = 1

        # 1. 1.5DL + 1.5LL
        if dl and ll:
            combos.append(self._c(f"IS800_U{n}", "1.5DL + 1.5LL",
                                   {i: 1.5 for i in dl + ll}, "ULS")); n += 1

        # 2. 1.5DL ± 1.5WL
        for s, v in [("+", 1.5), ("-", -1.5)]:
            if dl and wl:
                combos.append(self._c(f"IS800_U{n}", f"1.5DL {s}1.5WL",
                    {**{i: 1.5 for i in dl}, **{i: v for i in wl}}, "ULS")); n += 1

        # 3. 1.2DL + 1.2LL ± 1.2WL
        for s, v in [("+", 1.2), ("-", -1.2)]:
            if dl and ll and wl:
                combos.append(self._c(f"IS800_U{n}", f"1.2(DL+LL) {s}1.2WL",
                    {**{i: 1.2 for i in dl + ll}, **{i: v for i in wl}}, "ULS")); n += 1

        # 4. 1.5DL ± 1.5EL
        for s, v in [("+", 1.5), ("-", -1.5)]:
            if dl and el:
                combos.append(self._c(f"IS800_U{n}", f"1.5DL {s}1.5EL",
                    {**{i: 1.5 for i in dl}, **{i: v for i in el}}, "ULS")); n += 1

        # 5. 1.2DL + 1.2LL ± 1.2EL
        for s, v in [("+", 1.2), ("-", -1.2)]:
            if dl and ll and el:
                combos.append(self._c(f"IS800_U{n}", f"1.2(DL+LL) {s}1.2EL",
                    {**{i: 1.2 for i in dl + ll}, **{i: v for i in el}}, "ULS")); n += 1

        # 6. 0.9DL ± 1.5WL  (stability / uplift)
        for s, v in [("+", 1.5), ("-", -1.5)]:
            if dl and wl:
                combos.append(self._c(f"IS800_U{n}", f"0.9DL {s}1.5WL",
                    {**{i: 0.9 for i in dl}, **{i: v for i in wl}}, "ULS")); n += 1

        # 7. 0.9DL ± 1.5EL
        for s, v in [("+", 1.5), ("-", -1.5)]:
            if dl and el:
                combos.append(self._c(f"IS800_U{n}", f"0.9DL {s}1.5EL",
                    {**{i: 0.9 for i in dl}, **{i: v for i in el}}, "ULS")); n += 1

        # SLS — unfactored
        m = 1
        if dl and ll:
            combos.append(self._c(f"IS800_S{m}", "1.0DL + 1.0LL",
                                   {i: 1.0 for i in dl + ll}, "SLS")); m += 1
        if dl and wl:
            combos.append(self._c(f"IS800_S{m}", "1.0DL + 1.0WL",
                                   {i: 1.0 for i in dl + wl}, "SLS")); m += 1
        if dl and ll and wl:
            f = {**{i: 1.0 for i in dl + ll}, **{i: 0.8 for i in wl}}
            combos.append(self._c(f"IS800_S{m}", "1.0DL + 1.0LL + 0.8WL",
                                   f, "SLS")); m += 1

        return combos

    def _c(self, cid, desc, factors, ls):
        return LoadCombination(id=cid, name=desc, description=desc,
                               factors=factors, limit_state=ls,
                               code=DesignCode.IS875)


# ============================================================
# IS 1893:2016 Clause 6.3.1  (Seismic specific combinations)
# ============================================================

class IS1893CombinationGenerator:
    """
    IS 1893(Part 1):2016 — Clause 6.3.1  seismic load combinations.

    Bidirectional earthquake (±EX, ±EZ) → 4 sign permutations.
    100%–30% rule (Clause 6.3.2.2):  EL = ±1.0*EX ± 0.3*EZ  (and vice-versa)

    Combinations per IS 1893 Cl. 6.3.1:
      (i)   1.5(DL + EL)
      (ii)  1.2(DL + LL + EL)
      (iii) 0.9 DL + 1.5 EL
    where EL expands to ±EX ± 0.3*EZ and ±0.3*EX ± EZ.
    """

    def __init__(self, load_cases: List[LoadCase]):
        self.load_cases = load_cases

    def _ids(self, lt: LoadType) -> List[str]:
        return [lc.id for lc in self.load_cases if lc.load_type == lt]

    def generate(self, include_100_30_rule: bool = True) -> List[LoadCombination]:
        combos: List[LoadCombination] = []
        dl = self._ids(LoadType.DEAD)
        ll = self._ids(LoadType.LIVE)
        el = self._ids(LoadType.SEISMIC)

        if not dl or not el:
            return combos

        # Build EL sign permutations
        # Simple case: treat all seismic load cases as one direction
        sign_perms = [(+1.0,), (-1.0,)]
        n = 1

        # (i) 1.5 DL ± 1.5 EL
        for signs in sign_perms:
            f = {**{i: 1.5 for i in dl}}
            for idx, eid in enumerate(el):
                s = signs[idx % len(signs)]
                f[eid] = 1.5 * s
            combos.append(self._c(f"IS1893_U{n}",
                f"1.5DL {'+'if signs[0]>0 else '-'}1.5EL", f, "ULS"))
            n += 1

        # (ii) 1.2(DL + LL ± EL)
        if ll:
            for signs in sign_perms:
                f = {**{i: 1.2 for i in dl + ll}}
                for idx, eid in enumerate(el):
                    s = signs[idx % len(signs)]
                    f[eid] = 1.2 * s
                combos.append(self._c(f"IS1893_U{n}",
                    f"1.2(DL+LL) {'+'if signs[0]>0 else '-'}1.2EL", f, "ULS"))
                n += 1

        # (iii) 0.9 DL ± 1.5 EL
        for signs in sign_perms:
            f = {**{i: 0.9 for i in dl}}
            for idx, eid in enumerate(el):
                s = signs[idx % len(signs)]
                f[eid] = 1.5 * s
            combos.append(self._c(f"IS1893_U{n}",
                f"0.9DL {'+'if signs[0]>0 else '-'}1.5EL", f, "ULS"))
            n += 1

        return combos

    def _c(self, cid, desc, factors, ls):
        return LoadCombination(id=cid, name=desc, description=desc,
                               factors=factors, limit_state=ls,
                               code=DesignCode.IS875)


# ============================================================
# Envelope Computation  (governing combo per member force)
# ============================================================

@dataclass
class EnvelopeResult:
    """Stores max/min of each force component with governing combo ID."""
    element_id: str
    station: float  # 0.0 – 1.0 along element length
    max_forces: Dict[str, float]     # e.g. {"Fx": 120.5, "Vy": 45.0, ...}
    min_forces: Dict[str, float]
    governing_max: Dict[str, str]    # force_component -> combo_id
    governing_min: Dict[str, str]


def compute_envelope(
    combo_results: Dict[str, Dict[str, List[Dict[str, float]]]],
    element_ids: Optional[List[str]] = None,
) -> Dict[str, List[EnvelopeResult]]:
    """
    Compute force envelope across all load combinations.

    Parameters
    ----------
    combo_results : dict
        {combo_id: {element_id: [{"station": 0.0, "Fx": ..., "Vy": ...}, ...]}}
    element_ids : list, optional
        Limit envelope to these elements. None = all elements.

    Returns
    -------
    dict  {element_id: [EnvelopeResult per station]}
    """
    import math

    FORCE_KEYS = ("Fx", "Vy", "Vz", "Mx", "My", "Mz")

    # Collect all element IDs
    all_eids: set = set()
    for combo_data in combo_results.values():
        all_eids.update(combo_data.keys())
    if element_ids is not None:
        all_eids &= set(element_ids)

    envelope: Dict[str, List[EnvelopeResult]] = {}

    for eid in sorted(all_eids):
        # Determine station count from first combo that has this element
        stations = None
        for combo_data in combo_results.values():
            if eid in combo_data:
                stations = combo_data[eid]
                break
        if stations is None:
            continue

        n_stations = len(stations)
        env_list: List[EnvelopeResult] = []

        for si in range(n_stations):
            max_f = {k: -math.inf for k in FORCE_KEYS}
            min_f = {k: math.inf for k in FORCE_KEYS}
            gov_max = {k: "" for k in FORCE_KEYS}
            gov_min = {k: "" for k in FORCE_KEYS}
            station_val = 0.0

            for combo_id, combo_data in combo_results.items():
                if eid not in combo_data:
                    continue
                if si >= len(combo_data[eid]):
                    continue
                pt = combo_data[eid][si]
                station_val = pt.get("station", si / max(n_stations - 1, 1))

                for k in FORCE_KEYS:
                    val = pt.get(k, 0.0)
                    if val > max_f[k]:
                        max_f[k] = val
                        gov_max[k] = combo_id
                    if val < min_f[k]:
                        min_f[k] = val
                        gov_min[k] = combo_id

            # Replace inf with 0 if no data
            for k in FORCE_KEYS:
                if max_f[k] == -math.inf:
                    max_f[k] = 0.0
                if min_f[k] == math.inf:
                    min_f[k] = 0.0

            env_list.append(EnvelopeResult(
                element_id=eid,
                station=station_val,
                max_forces=max_f,
                min_forces=min_f,
                governing_max=gov_max,
                governing_min=gov_min,
            ))

        envelope[eid] = env_list

    return envelope


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
