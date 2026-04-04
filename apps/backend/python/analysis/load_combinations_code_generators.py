"""Code-specific load combination generation helpers.

Extracted from load_combinations.py to keep the main module focused on orchestration.
"""

from __future__ import annotations

from typing import TYPE_CHECKING, List

from .generators.load_combinations_shared import DesignCode, LoadCombination, LoadType

if TYPE_CHECKING:
    from .load_combinations import LegacyLoadCombination, LoadCase


def _matches_load_type(load_case: "LoadCase", names: set[str], values: set[str]) -> bool:
    """Match either legacy enums or shared enums by name/value."""
    raw = load_case.load_type
    enum_name = str(getattr(raw, "name", "")).upper()
    enum_value = str(getattr(raw, "value", raw)).upper()
    return enum_name in names or enum_value in values


def _case_ids(load_cases: List["LoadCase"], names: set[str], values: set[str]) -> List[str]:
    return [lc.id for lc in load_cases if _matches_load_type(lc, names, values)]


def generate_is875_combinations(load_cases: List["LoadCase"]) -> List["LegacyLoadCombination"]:
    """Generate IS 875 (Part 5): 2015 load combinations."""
    from .load_combinations import LegacyLoadCombination

    combinations = []

    dl_ids = _case_ids(load_cases, {"DEAD", "D"}, {"DL", "D", "DEAD"})
    ll_ids = _case_ids(load_cases, {"LIVE", "L"}, {"LL", "L", "LIVE"})
    wl_ids = _case_ids(load_cases, {"WIND", "W"}, {"WL", "W", "WIND"})
    el_ids = _case_ids(load_cases, {"SEISMIC", "E"}, {"EL", "E", "SEISMIC"})
    sl_ids = _case_ids(load_cases, {"SNOW", "S"}, {"SL", "S", "SNOW"})

    combo_num = 1

    if dl_ids and ll_ids:
        factors = {lc_id: 1.5 for lc_id in dl_ids + ll_ids}
        combinations.append(LegacyLoadCombination(
            id=f"ULS{combo_num}",
            name=f"ULS Combo {combo_num}",
            description="1.5(DL + LL)",
            factors=factors,
            limit_state="ULS",
            code=DesignCode.IS875,
        ))
        combo_num += 1

    if dl_ids and wl_ids:
        factors = {lc_id: 1.5 for lc_id in dl_ids + wl_ids}
        combinations.append(LegacyLoadCombination(
            id=f"ULS{combo_num}",
            name=f"ULS Combo {combo_num}",
            description="1.5(DL + WL)",
            factors=factors,
            limit_state="ULS",
            code=DesignCode.IS875,
        ))
        combo_num += 1

    if dl_ids and ll_ids and wl_ids:
        factors = {lc_id: 1.2 for lc_id in dl_ids + ll_ids + wl_ids}
        combinations.append(LegacyLoadCombination(
            id=f"ULS{combo_num}",
            name=f"ULS Combo {combo_num}",
            description="1.2(DL + LL + WL)",
            factors=factors,
            limit_state="ULS",
            code=DesignCode.IS875,
        ))
        combo_num += 1

    if dl_ids and el_ids:
        factors = {**{lc_id: 1.5 for lc_id in dl_ids}, **{lc_id: 1.5 for lc_id in el_ids}}
        combinations.append(LegacyLoadCombination(
            id=f"ULS{combo_num}",
            name=f"ULS Combo {combo_num}",
            description="1.5(DL + EL)",
            factors=factors,
            limit_state="ULS",
            code=DesignCode.IS875,
        ))
        combo_num += 1

        factors = {**{lc_id: 1.5 for lc_id in dl_ids}, **{lc_id: -1.5 for lc_id in el_ids}}
        combinations.append(LegacyLoadCombination(
            id=f"ULS{combo_num}",
            name=f"ULS Combo {combo_num}",
            description="1.5(DL - EL)",
            factors=factors,
            limit_state="ULS",
            code=DesignCode.IS875,
        ))
        combo_num += 1

    if dl_ids and ll_ids and el_ids:
        factors = {**{lc_id: 1.2 for lc_id in dl_ids + ll_ids}, **{lc_id: 1.2 for lc_id in el_ids}}
        combinations.append(LoadCombination(
            id=f"ULS{combo_num}",
            name=f"ULS Combo {combo_num}",
            description="1.2(DL + LL + EL)",
            factors=factors,
            limit_state="ULS",
            code=DesignCode.IS875,
        ))
        combo_num += 1

        factors = {**{lc_id: 1.2 for lc_id in dl_ids + ll_ids}, **{lc_id: -1.2 for lc_id in el_ids}}
        combinations.append(LoadCombination(
            id=f"ULS{combo_num}",
            name=f"ULS Combo {combo_num}",
            description="1.2(DL + LL - EL)",
            factors=factors,
            limit_state="ULS",
            code=DesignCode.IS875,
        ))
        combo_num += 1

    if dl_ids and sl_ids:
        factors = {lc_id: 1.5 for lc_id in dl_ids + sl_ids}
        combinations.append(LoadCombination(
            id=f"ULS{combo_num}",
            name=f"ULS Combo {combo_num}",
            description="1.5(DL + SL)",
            factors=factors,
            limit_state="ULS",
            code=DesignCode.IS875,
        ))
        combo_num += 1

    if dl_ids and ll_ids and sl_ids:
        factors = {lc_id: 1.2 for lc_id in dl_ids + ll_ids + sl_ids}
        combinations.append(LoadCombination(
            id=f"ULS{combo_num}",
            name=f"ULS Combo {combo_num}",
            description="1.2(DL + LL + SL)",
            factors=factors,
            limit_state="ULS",
            code=DesignCode.IS875,
        ))
        combo_num += 1

    combo_num = 1

    if dl_ids and ll_ids:
        factors = {lc_id: 1.0 for lc_id in dl_ids + ll_ids}
        combinations.append(LoadCombination(
            id=f"SLS{combo_num}",
            name=f"SLS Combo {combo_num}",
            description="1.0(DL + LL)",
            factors=factors,
            limit_state="SLS",
            code=DesignCode.IS875,
        ))
        combo_num += 1

    if dl_ids and wl_ids:
        factors = {lc_id: 1.0 for lc_id in dl_ids + wl_ids}
        combinations.append(LoadCombination(
            id=f"SLS{combo_num}",
            name=f"SLS Combo {combo_num}",
            description="1.0(DL + WL)",
            factors=factors,
            limit_state="SLS",
            code=DesignCode.IS875,
        ))
        combo_num += 1

    if dl_ids and ll_ids and wl_ids:
        factors = {**{lc_id: 1.0 for lc_id in dl_ids + ll_ids}, **{lc_id: 0.8 for lc_id in wl_ids}}
        combinations.append(LoadCombination(
            id=f"SLS{combo_num}",
            name=f"SLS Combo {combo_num}",
            description="1.0(DL + LL + 0.8*WL)",
            factors=factors,
            limit_state="SLS",
            code=DesignCode.IS875,
        ))

    return combinations


def generate_asce7_combinations(load_cases: List["LoadCase"]) -> List["LegacyLoadCombination"]:
    """Generate ASCE 7-22 load combinations."""
    combinations = []

    dl_ids = _case_ids(load_cases, {"DEAD", "D"}, {"DL", "D", "DEAD"})
    ll_ids = _case_ids(load_cases, {"LIVE", "L"}, {"LL", "L", "LIVE"})
    wl_ids = _case_ids(load_cases, {"WIND", "W"}, {"WL", "W", "WIND"})
    el_ids = _case_ids(load_cases, {"SEISMIC", "E"}, {"EL", "E", "SEISMIC"})
    sl_ids = _case_ids(load_cases, {"SNOW", "S"}, {"SL", "S", "SNOW"})

    combo_num = 1

    if dl_ids:
        factors = {lc_id: 1.4 for lc_id in dl_ids}
        combinations.append(LoadCombination(
            id=f"ASCE{combo_num}",
            name=f"ASCE 7-22 Combo {combo_num}",
            description="1.4D",
            factors=factors,
            limit_state="ULS",
            code=DesignCode.ASCE7,
        ))
        combo_num += 1

    if dl_ids and ll_ids:
        factors = {**{lc_id: 1.2 for lc_id in dl_ids}, **{lc_id: 1.6 for lc_id in ll_ids}}
        combinations.append(LoadCombination(
            id=f"ASCE{combo_num}",
            name=f"ASCE 7-22 Combo {combo_num}",
            description="1.2D + 1.6L",
            factors=factors,
            limit_state="ULS",
            code=DesignCode.ASCE7,
        ))
        combo_num += 1

    if dl_ids and sl_ids:
        factors = {**{lc_id: 1.2 for lc_id in dl_ids}, **{lc_id: 1.6 for lc_id in sl_ids}}
        combinations.append(LoadCombination(
            id=f"ASCE{combo_num}",
            name=f"ASCE 7-22 Combo {combo_num}",
            description="1.2D + 1.6S",
            factors=factors,
            limit_state="ULS",
            code=DesignCode.ASCE7,
        ))
        combo_num += 1

    if dl_ids and wl_ids and ll_ids and sl_ids:
        factors = {
            **{lc_id: 1.2 for lc_id in dl_ids},
            **{lc_id: 1.0 for lc_id in wl_ids + ll_ids},
            **{lc_id: 0.5 for lc_id in sl_ids},
        }
        combinations.append(LoadCombination(
            id=f"ASCE{combo_num}",
            name=f"ASCE 7-22 Combo {combo_num}",
            description="1.2D + 1.0W + L + 0.5S",
            factors=factors,
            limit_state="ULS",
            code=DesignCode.ASCE7,
        ))
        combo_num += 1

    if dl_ids and el_ids and ll_ids and sl_ids:
        factors = {
            **{lc_id: 1.2 for lc_id in dl_ids},
            **{lc_id: 1.0 for lc_id in el_ids + ll_ids},
            **{lc_id: 0.2 for lc_id in sl_ids},
        }
        combinations.append(LoadCombination(
            id=f"ASCE{combo_num}",
            name=f"ASCE 7-22 Combo {combo_num}",
            description="1.2D + 1.0E + L + 0.2S",
            factors=factors,
            limit_state="ULS",
            code=DesignCode.ASCE7,
        ))
        combo_num += 1

    if dl_ids and wl_ids:
        factors = {**{lc_id: 0.9 for lc_id in dl_ids}, **{lc_id: 1.0 for lc_id in wl_ids}}
        combinations.append(LoadCombination(
            id=f"ASCE{combo_num}",
            name=f"ASCE 7-22 Combo {combo_num}",
            description="0.9D + 1.0W",
            factors=factors,
            limit_state="ULS",
            code=DesignCode.ASCE7,
        ))
        combo_num += 1

    if dl_ids and el_ids:
        factors = {**{lc_id: 0.9 for lc_id in dl_ids}, **{lc_id: 1.0 for lc_id in el_ids}}
        combinations.append(LoadCombination(
            id=f"ASCE{combo_num}",
            name=f"ASCE 7-22 Combo {combo_num}",
            description="0.9D + 1.0E",
            factors=factors,
            limit_state="ULS",
            code=DesignCode.ASCE7,
        ))

    return combinations


def generate_eurocode_combinations(load_cases: List["LoadCase"]) -> List["LegacyLoadCombination"]:
    """Generate Eurocode EN 1990 fundamental combinations."""
    from .load_combinations import LegacyLoadCombination

    combinations = []

    dl_ids = _case_ids(load_cases, {"DEAD", "D"}, {"DL", "D", "DEAD"})
    ll_ids = _case_ids(load_cases, {"LIVE", "L"}, {"LL", "L", "LIVE"})
    wl_ids = _case_ids(load_cases, {"WIND", "W"}, {"WL", "W", "WIND"})
    el_ids = _case_ids(load_cases, {"SEISMIC", "E"}, {"EL", "E", "SEISMIC"})

    combo_num = 1

    if dl_ids and ll_ids:
        factors = {**{i: 1.35 for i in dl_ids}, **{i: 1.5 for i in ll_ids}}
        combinations.append(LegacyLoadCombination(
            id=f"EC{combo_num}",
            name=f"Eurocode Combo {combo_num}",
            description="1.35G + 1.5Q",
            factors=factors,
            limit_state="ULS",
            code=DesignCode.EUROCODE,
        ))
        combo_num += 1

    if dl_ids and wl_ids:
        factors = {**{i: 1.35 for i in dl_ids}, **{i: 1.5 for i in wl_ids}}
        combinations.append(LegacyLoadCombination(
            id=f"EC{combo_num}",
            name=f"Eurocode Combo {combo_num}",
            description="1.35G + 1.5W",
            factors=factors,
            limit_state="ULS",
            code=DesignCode.EUROCODE,
        ))
        combo_num += 1

    if dl_ids and ll_ids and wl_ids:
        factors = {**{i: 1.35 for i in dl_ids}, **{i: 1.5 for i in ll_ids}, **{i: 0.9 for i in wl_ids}}
        combinations.append(LegacyLoadCombination(
            id=f"EC{combo_num}",
            name=f"Eurocode Combo {combo_num}",
            description="1.35G + 1.5Q + 0.9W",
            factors=factors,
            limit_state="ULS",
            code=DesignCode.EUROCODE,
        ))
        combo_num += 1

    if dl_ids and wl_ids:
        factors = {**{i: 1.0 for i in dl_ids}, **{i: 1.5 for i in wl_ids}}
        combinations.append(LegacyLoadCombination(
            id=f"EC{combo_num}",
            name=f"Eurocode Combo {combo_num}",
            description="1.0G + 1.5W (uplift)",
            factors=factors,
            limit_state="ULS",
            code=DesignCode.EUROCODE,
        ))
        combo_num += 1

    if dl_ids and el_ids:
        psi2 = 0.3
        factors = {**{i: 1.0 for i in dl_ids}, **{i: 1.0 for i in el_ids}}
        if ll_ids:
            factors.update({i: psi2 for i in ll_ids})
        combinations.append(LegacyLoadCombination(
            id=f"EC{combo_num}",
            name=f"Eurocode Combo {combo_num}",
            description="1.0G + 1.0E + 0.3Q",
            factors=factors,
            limit_state="ULS",
            code=DesignCode.EUROCODE,
        ))
        combo_num += 1

    if dl_ids and ll_ids:
        factors = {i: 1.0 for i in dl_ids + ll_ids}
        combinations.append(LegacyLoadCombination(
            id=f"EC_SLS{combo_num}",
            name=f"Eurocode SLS {combo_num}",
            description="1.0G + 1.0Q",
            factors=factors,
            limit_state="SLS",
            code=DesignCode.EUROCODE,
        ))

    return combinations


__all__ = [
    "generate_is875_combinations",
    "generate_asce7_combinations",
    "generate_eurocode_combinations",
]
