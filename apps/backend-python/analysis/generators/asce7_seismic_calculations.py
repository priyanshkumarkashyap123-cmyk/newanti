"""ASCE 7 seismic response calculations - period, Cs, shear distribution."""

from __future__ import annotations

from typing import TYPE_CHECKING, Dict, List, Tuple

from .asce7_seismic_types import StoryMass

if TYPE_CHECKING:
    from .asce7_seismic import ASCE7SeismicGenerator


class ASCE7SeismicCalculations:
    """Calculation methods for ASCE 7 seismic analysis."""

    def calculate_period(self: ASCE7SeismicGenerator) -> float:
        """
        Calculate approximate fundamental period Ta (Eq. 12.8-7)

        Ta = Ct × hn^x

        Ct and x values from Table 12.8-2:
        - Steel moment frames: Ct=0.0724, x=0.8
        - RC moment frames: Ct=0.0466, x=0.9
        - Steel eccentrically braced: Ct=0.0731, x=0.75
        - All other: Ct=0.0488, x=0.75
        """
        hn = self.params.height
        hn_ft = hn * 3.281

        system = self.params.structural_system.value

        if system in ["SMF_S", "OMF_S"]:
            Ct, x = 0.0724, 0.8
        elif system in ["SMF_RC", "OMF_RC", "IMF"]:
            Ct, x = 0.0466, 0.9
        elif system in ["SCBF"]:
            Ct, x = 0.0731, 0.75
        else:
            Ct, x = 0.0488, 0.75

        Ta = Ct * (hn_ft ** x)
        self.result.Ta = Ta

        # Upper limit coefficient Cu (Table 12.8-1)
        SD1 = self.result.SD1
        if SD1 >= 0.4:
            Cu = 1.4
        elif SD1 >= 0.3:
            Cu = 1.4
        elif SD1 >= 0.2:
            Cu = 1.5
        elif SD1 >= 0.15:
            Cu = 1.6
        else:
            Cu = 1.7

        self.result.Cu = Cu

        if self.params.user_period is not None:
            T = self.params.user_period
            if self.params.use_Cu_limit:
                T = min(T, Cu * Ta)
        else:
            T = Ta

        self.result.T = T
        return T

    def calculate_Cs(self: ASCE7SeismicGenerator) -> float:
        """
        Calculate seismic response coefficient Cs

        Eq. 12.8-2: Cs = SDS / (R/Ie)
        Eq. 12.8-3: Cs_max = SD1 / (T × (R/Ie))  for T <= TL
        Eq. 12.8-4: Cs_max = SD1 × TL / (T² × (R/Ie))  for T > TL
        Eq. 12.8-5: Cs_min = 0.044 × SDS × Ie >= 0.01
        Eq. 12.8-6: Cs_min = 0.5 × S1 / (R/Ie)  for S1 >= 0.6g
        """
        SDS = self.result.SDS
        SD1 = self.result.SD1
        Ie = self.result.Ie
        R = self.params.structural_system.get_R()
        T = self.result.T
        TL = self.params.TL
        S1 = self.params.S1

        self.result.R = R

        Cs = SDS / (R / Ie)

        if T <= TL:
            Cs_max = SD1 / (T * (R / Ie))
        else:
            Cs_max = SD1 * TL / (T * T * (R / Ie))

        Cs = min(Cs, Cs_max)

        Cs_min = max(0.044 * SDS * Ie, 0.01)

        if S1 >= 0.6:
            Cs_min = max(Cs_min, 0.5 * S1 / (R / Ie))

        Cs = max(Cs, Cs_min)

        self.result.Cs = Cs
        return Cs

    def compute_story_masses(
        self: ASCE7SeismicGenerator,
        nodes: Dict[str, Dict],
        dead_loads: Dict[str, float],
        live_loads: Dict[str, float],
        live_load_factor: float = 0.0,
    ) -> List[StoryMass]:
        """
        Group loads by story level and calculate seismic weights.

        Per ASCE 7 Section 12.7.2:
        W includes total dead load + applicable portion of other loads

        Args:
            nodes: Node dictionary {id: {x, y, z, ...}}
            dead_loads: Dead loads at nodes (kN)
            live_loads: Live loads at nodes (kN)
            live_load_factor: Factor for live load (0.25 for storage, 0 typically)
        """
        height_tolerance = 0.1
        levels: Dict[float, List[str]] = {}

        for node_id, node in nodes.items():
            y = node.get('y', node.get('z', 0))
            matched = False
            for level_y in levels:
                if abs(y - level_y) < height_tolerance:
                    levels[level_y].append(node_id)
                    matched = True
                    break
            if not matched:
                levels[y] = [node_id]

        sorted_heights = sorted(levels.keys())

        story_masses = []
        prev_height = 0.0

        for i, y in enumerate(sorted_heights):
            node_ids = levels[y]

            dl = sum(dead_loads.get(nid, 0) for nid in node_ids)
            ll = sum(live_loads.get(nid, 0) for nid in node_ids)

            W = dl + live_load_factor * ll

            story = StoryMass(
                level=i + 1,
                height=y,
                story_height=y - prev_height,
                dead_load=dl,
                live_load=ll,
                seismic_weight=W,
                node_ids=list(node_ids),
            )
            story_masses.append(story)
            prev_height = y

        self.result.story_forces = story_masses
        return story_masses

    def calculate_base_shear(self: ASCE7SeismicGenerator) -> float:
        """
        Calculate design base shear V (Eq. 12.8-1)

        V = Cs × W
        """
        W = sum(story.seismic_weight for story in self.result.story_forces)
        Cs = self.result.Cs

        V = Cs * W

        self.result.W = W
        self.result.V = V
        return V

    def distribute_lateral_forces(self: ASCE7SeismicGenerator) -> None:
        """
        Distribute base shear over height (Eq. 12.8-11, 12.8-12)

        Fx = Cvx × V
        Cvx = (wx × hx^k) / Σ(wi × hi^k)

        k = 1 for T <= 0.5s
        k = 2 for T >= 2.5s
        k = interpolated for 0.5 < T < 2.5
        """
        T = self.result.T
        V = self.result.V
        stories = self.result.story_forces

        if not stories:
            return

        if T <= 0.5:
            k = 1.0
        elif T >= 2.5:
            k = 2.0
        else:
            k = 1.0 + (T - 0.5) / 2.0

        denominator = sum(s.seismic_weight * (s.height ** k) for s in stories)

        if denominator == 0:
            return

        cumulative_shear = 0.0

        for i in range(len(stories) - 1, -1, -1):
            story = stories[i]

            Cvx = (story.seismic_weight * (story.height ** k)) / denominator

            Fx = Cvx * V
            story.lateral_force = Fx

            cumulative_shear += Fx
            story.shear = cumulative_shear

        for story in stories:
            story.moment = sum(
                s.lateral_force * (s.height - story.height)
                for s in stories
                if s.height >= story.height
            )

    def generate_nodal_loads(self: ASCE7SeismicGenerator) -> List[Dict]:
        """
        Generate nodal load list for solver.

        Returns list of {node_id, fx, fy, fz} dicts.
        """
        nodal_loads = []
        direction = self.params.direction.upper()

        for story in self.result.story_forces:
            if not story.node_ids:
                continue

            force_per_node = story.lateral_force / len(story.node_ids)

            for node_id in story.node_ids:
                load = {
                    "node_id": node_id,
                    "fx": force_per_node if direction == "X" else 0,
                    "fy": 0,
                    "fz": force_per_node if direction == "Z" or direction == "Y" else 0,
                    "source": "ASCE7_ELF",
                    "load_case": f"EQ{direction}",
                }
                nodal_loads.append(load)

        self.result.nodal_loads = nodal_loads
        return nodal_loads
