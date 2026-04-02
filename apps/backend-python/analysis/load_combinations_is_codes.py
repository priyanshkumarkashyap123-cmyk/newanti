"""IS 456, IS 800, and IS 1893 load-combination generators."""

from __future__ import annotations

from typing import Dict, List, Tuple, TYPE_CHECKING

from .generators.load_combinations_shared import DesignCode, LoadCombination, LoadType

if TYPE_CHECKING:
    from .load_combinations import LoadCase


class IS456CombinationGenerator:
    """
    IS 456:2000 Table 18 load combinations for reinforced concrete design.

    ULS:
      1.5 DL + 1.5 LL
      1.5 DL + 1.5 WL/EL
      1.2 DL + 1.2 LL + 1.2 WL/EL
      0.9 DL + 1.5 WL/EL
      1.5 DL + 1.5 T
      1.2 DL + 1.2 LL + 1.2 T

    SLS:
      1.0 DL + 1.0 LL
      1.0 DL + 1.0 WL
      1.0 DL + 0.8 LL + 0.8 WL
      1.0 DL + 1.0 T
    """

    def __init__(self, load_cases: List["LoadCase"]):
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
        lateral_groups: List[Tuple[str, List[str]]] = []
        if wl:
            lateral_groups.append(("WL", wl))
        if el:
            lateral_groups.append(("EL", el))

        n = 1
        if dl and ll:
            combos.append(self._combo(f"IS456_U{n}", "1.5(DL + LL)", {i: 1.5 for i in dl + ll}, "ULS"))
            n += 1
        elif dl:
            combos.append(self._combo(f"IS456_U{n}", "1.5(DL)", {i: 1.5 for i in dl}, "ULS"))
            n += 1

        for sign_label, sign in [("+", 1.5), ("-", -1.5)]:
            for lateral_name, lateral_ids in lateral_groups:
                if dl and lateral_ids:
                    f = {**{i: 1.5 for i in dl}, **{i: sign for i in lateral_ids}}
                    combos.append(self._combo(f"IS456_U{n}", f"1.5DL {sign_label}1.5{lateral_name}", f, "ULS"))
                    n += 1

        for sign_label, sign in [("+", 1.2), ("-", -1.2)]:
            for lateral_name, lateral_ids in lateral_groups:
                if dl and ll and lateral_ids:
                    f = {**{i: 1.2 for i in dl + ll}, **{i: sign for i in lateral_ids}}
                    combos.append(self._combo(f"IS456_U{n}", f"1.2DL + 1.2LL {sign_label}1.2{lateral_name}", f, "ULS"))
                    n += 1

        for sign_label, sign in [("+", 1.5), ("-", -1.5)]:
            for lateral_name, lateral_ids in lateral_groups:
                if dl and lateral_ids:
                    f = {**{i: 0.9 for i in dl}, **{i: sign for i in lateral_ids}}
                    combos.append(self._combo(f"IS456_U{n}", f"0.9DL {sign_label}1.5{lateral_name}", f, "ULS"))
                    n += 1

        if dl and tl:
            combos.append(
                self._combo(
                    f"IS456_U{n}",
                    "1.5DL + 1.5T",
                    {**{i: 1.5 for i in dl}, **{i: 1.5 for i in tl}},
                    "ULS",
                )
            )
            n += 1
        if dl and ll and tl:
            combos.append(self._combo(f"IS456_U{n}", "1.2DL + 1.2LL + 1.2T", {i: 1.2 for i in dl + ll + tl}, "ULS"))
            n += 1

        m = 1
        if dl and ll:
            combos.append(self._combo(f"IS456_S{m}", "1.0DL + 1.0LL", {i: 1.0 for i in dl + ll}, "SLS"))
            m += 1
        for lateral_name, lateral_ids in lateral_groups:
            if dl and lateral_ids:
                combos.append(self._combo(f"IS456_S{m}", f"1.0DL + 1.0{lateral_name}", {i: 1.0 for i in dl + lateral_ids}, "SLS"))
                m += 1
            if dl and ll and lateral_ids:
                f = {**{i: 1.0 for i in dl}, **{i: 0.8 for i in ll + lateral_ids}}
                combos.append(self._combo(f"IS456_S{m}", f"1.0DL + 0.8LL + 0.8{lateral_name}", f, "SLS"))
                m += 1
        if dl and tl:
            combos.append(self._combo(f"IS456_S{m}", "1.0DL + 1.0T", {i: 1.0 for i in dl + tl}, "SLS"))

        return combos

    def _combo(self, cid: str, desc: str, factors: Dict[str, float], ls: str) -> LoadCombination:
        return LoadCombination(id=cid, name=desc, description=desc, factors=factors, limit_state=ls, code=DesignCode.IS875)


class IS800CombinationGenerator:
    """IS 800:2007 Table 4 load combinations for steel design."""

    def __init__(self, load_cases: List["LoadCase"]):
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

        if dl and ll:
            combos.append(self._c(f"IS800_U{n}", "1.5DL + 1.5LL", {i: 1.5 for i in dl + ll}, "ULS"))
            n += 1

        for s, v in [("+", 1.5), ("-", -1.5)]:
            if dl and wl:
                combos.append(self._c(f"IS800_U{n}", f"1.5DL {s}1.5WL", {**{i: 1.5 for i in dl}, **{i: v for i in wl}}, "ULS"))
                n += 1

        for s, v in [("+", 1.2), ("-", -1.2)]:
            if dl and ll and wl:
                combos.append(self._c(f"IS800_U{n}", f"1.2(DL+LL) {s}1.2WL", {**{i: 1.2 for i in dl + ll}, **{i: v for i in wl}}, "ULS"))
                n += 1

        for s, v in [("+", 1.5), ("-", -1.5)]:
            if dl and el:
                combos.append(self._c(f"IS800_U{n}", f"1.5DL {s}1.5EL", {**{i: 1.5 for i in dl}, **{i: v for i in el}}, "ULS"))
                n += 1

        for s, v in [("+", 1.2), ("-", -1.2)]:
            if dl and ll and el:
                combos.append(self._c(f"IS800_U{n}", f"1.2(DL+LL) {s}1.2EL", {**{i: 1.2 for i in dl + ll}, **{i: v for i in el}}, "ULS"))
                n += 1

        for s, v in [("+", 1.5), ("-", -1.5)]:
            if dl and wl:
                combos.append(self._c(f"IS800_U{n}", f"0.9DL {s}1.5WL", {**{i: 0.9 for i in dl}, **{i: v for i in wl}}, "ULS"))
                n += 1

        for s, v in [("+", 1.5), ("-", -1.5)]:
            if dl and el:
                combos.append(self._c(f"IS800_U{n}", f"0.9DL {s}1.5EL", {**{i: 0.9 for i in dl}, **{i: v for i in el}}, "ULS"))
                n += 1

        m = 1
        if dl and ll:
            combos.append(self._c(f"IS800_S{m}", "1.0DL + 1.0LL", {i: 1.0 for i in dl + ll}, "SLS"))
            m += 1
        if dl and wl:
            combos.append(self._c(f"IS800_S{m}", "1.0DL + 1.0WL", {i: 1.0 for i in dl + wl}, "SLS"))
            m += 1
        if dl and ll and wl:
            f = {**{i: 1.0 for i in dl + ll}, **{i: 0.8 for i in wl}}
            combos.append(self._c(f"IS800_S{m}", "1.0DL + 1.0LL + 0.8WL", f, "SLS"))

        return combos

    def _c(self, cid, desc, factors, ls):
        return LoadCombination(id=cid, name=desc, description=desc, factors=factors, limit_state=ls, code=DesignCode.IS875)


class IS1893CombinationGenerator:
    """IS 1893:2016 Clause 6.3.1 seismic load combinations."""

    def __init__(self, load_cases: List["LoadCase"]):
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

        sign_perms = [(+1.0,), (-1.0,)]
        n = 1

        for signs in sign_perms:
            f = {**{i: 1.5 for i in dl}}
            for idx, eid in enumerate(el):
                s = signs[idx % len(signs)]
                f[eid] = 1.5 * s
            combos.append(self._c(f"IS1893_U{n}", f"1.5DL {'+' if signs[0] > 0 else '-'}1.5EL", f, "ULS"))
            n += 1

        if ll:
            for signs in sign_perms:
                f = {**{i: 1.2 for i in dl + ll}}
                for idx, eid in enumerate(el):
                    s = signs[idx % len(signs)]
                    f[eid] = 1.2 * s
                combos.append(self._c(f"IS1893_U{n}", f"1.2(DL+LL) {'+' if signs[0] > 0 else '-'}1.2EL", f, "ULS"))
                n += 1

        for signs in sign_perms:
            f = {**{i: 0.9 for i in dl}}
            for idx, eid in enumerate(el):
                s = signs[idx % len(signs)]
                f[eid] = 1.5 * s
            combos.append(self._c(f"IS1893_U{n}", f"0.9DL {'+' if signs[0] > 0 else '-'}1.5EL", f, "ULS"))
            n += 1

        return combos

    def _c(self, cid, desc, factors, ls):
        return LoadCombination(id=cid, name=desc, description=desc, factors=factors, limit_state=ls, code=DesignCode.IS875)


__all__ = [
    "IS456CombinationGenerator",
    "IS800CombinationGenerator",
    "IS1893CombinationGenerator",
]
