"""ASCE 7 wind calculations - coefficients, pressures, and forces."""

from __future__ import annotations

import math
from typing import TYPE_CHECKING, Dict, List

import numpy as np

from .asce7_wind_types import BuildingEnclosure, ExposureCategory, RoofType, WindForce, WindPressure

if TYPE_CHECKING:
    from .asce7_wind import ASCE7WindGenerator


class ASCE7WindCalculations:
    """Calculation methods for ASCE 7 wind analysis."""

    def get_Kd(self: ASCE7WindGenerator) -> float:
        """Wind directionality factor Kd. For buildings: Kd = 0.85"""
        self.result.Kd = 0.85
        return 0.85

    def get_Ke(self: ASCE7WindGenerator) -> float:
        """
        Ground elevation factor Ke

        Ke = e^(-0.0000362 × zg)
        where zg = ground elevation in feet
        """
        zg_ft = self.params.ground_elevation * 3.281
        Ke = math.exp(-0.0000362 * zg_ft)
        self.result.Ke = Ke
        return Ke

    def get_Kz(self: ASCE7WindGenerator, z: float) -> float:
        """
        Velocity pressure exposure coefficient Kz

        Eq. 26.10-1:
        For z >= zg: Kz = 2.01 × (z/zg)^(2/α)
        For z < 15 ft (4.57m): Kz = 2.01 × (15/zg)^(2/α)

        α and zg from Table 26.11-1
        """
        z_ft = z * 3.281

        exposure = self.params.exposure

        if exposure == ExposureCategory.B:
            alpha = 7.0
            zg = 1200.0
        elif exposure == ExposureCategory.C:
            alpha = 9.5
            zg = 1500.0
        elif exposure == ExposureCategory.D:
            alpha = 11.5
            zg = 1800.0
        else:  # A
            alpha = 5.0
            zg = 900.0

        z_use = max(z_ft, 15.0)  # Minimum 15 ft

        Kz = 2.01 * ((z_use / zg) ** (2.0 / alpha))
        return Kz

    def get_Kzt(self: ASCE7WindGenerator, z: float) -> float:
        """
        Topographic factor Kzt per Eq. 26.8-1

        For level terrain: Kzt = 1.0
        For hills/ridges: varies based on height and distance
        """
        if self.params.topography_factor is not None:
            return self.params.topography_factor

        Kzt = 1.0
        self.result.Kzt = Kzt
        return Kzt

    def calculate_qz(self: ASCE7WindGenerator, z: float) -> float:
        """
        Calculate velocity pressure qz (Eq. 26.10-1 or 27.3-1)

        qz = 0.613 × Ke × Kz × Kzt × Kd × V²  (Pa)
        where V in m/s
        """
        Ke = self.get_Ke()
        Kz = self.get_Kz(z)
        Kzt = self.get_Kzt(z)
        Kd = self.result.Kd

        V = self.params.V

        qz = 0.613 * Ke * Kz * Kzt * Kd * (V ** 2)

        return qz

    def get_GCpi(self: ASCE7WindGenerator) -> float:
        """Internal pressure coefficient GCpi (Table 26.13-1)"""
        if self.params.GCpi is not None:
            return self.params.GCpi

        if self.params.enclosure == BuildingEnclosure.ENCLOSED:
            return 0.18
        elif self.params.enclosure == BuildingEnclosure.PARTIALLY_ENCLOSED:
            return 0.55
        else:
            return 0.0

    def get_wall_Cp(self: ASCE7WindGenerator) -> Dict[str, float]:
        """External pressure coefficients for walls (Figure 27.3-1)"""
        L = self.params.length
        B = self.params.width

        L_B = L / B if B > 0 else 1.0

        Cp_windward = 0.8

        if L_B <= 1.0:
            Cp_leeward = -0.5
        elif L_B >= 4.0:
            Cp_leeward = -0.2
        else:
            Cp_leeward = -0.5 + (0.3 / 3.0) * (L_B - 1.0)

        Cp_side = -0.7

        self.result.Cp_windward = Cp_windward
        self.result.Cp_leeward = Cp_leeward
        self.result.Cp_side = Cp_side

        return {"windward": Cp_windward, "leeward": Cp_leeward, "side": Cp_side}

    def get_roof_Cp(self: ASCE7WindGenerator) -> Dict[str, float]:
        """External pressure coefficients for roof (Figure 27.3-1)"""
        theta = self.params.roof_angle
        h = self.params.height
        L = self.params.length

        h_L = h / L if L > 0 else 0.5

        if self.params.roof_type == RoofType.FLAT or theta <= 10:
            if h_L <= 0.25:
                Cp = -0.9
            elif h_L <= 0.5:
                Cp = -0.9
            elif h_L >= 1.0:
                Cp = -1.3
            else:
                Cp = -0.9 - 0.4 * (h_L - 0.5) / 0.5
        else:
            if theta <= 20:
                Cp = -0.7
            elif theta <= 27:
                Cp = -0.3
            elif theta <= 45:
                Cp = 0.2
            else:
                Cp = 0.4

        self.result.Cp_roof = Cp
        return {"roof": Cp}

    def calculate_pressures(self: ASCE7WindGenerator) -> List[WindPressure]:
        """Calculate wind pressures at various heights."""
        h = self.params.height
        GCpi = self.get_GCpi()
        self.result.GCpi = GCpi
        Cp = self.get_wall_Cp()

        num_levels = max(int(h / 3.0), 5)
        heights = np.linspace(0, h, num_levels + 1)[1:]

        pressures = []

        for z in heights:
            qz = self.calculate_qz(z)
            Kz = self.get_Kz(z)
            Kzt = self.get_Kzt(z)

            G = 0.85

            qh = self.calculate_qz(h)
            self.result.qh = qh

            p_windward = qz * G * Cp["windward"] - qh * (-GCpi)
            p_leeward = qh * G * Cp["leeward"] - qh * (+GCpi)
            p_net = p_windward - p_leeward

            pressure = WindPressure(
                height=z,
                qz=qz,
                Kz=Kz,
                Kzt=Kzt,
                p_windward=p_windward,
                p_leeward=p_leeward,
                p_net=p_net,
            )
            pressures.append(pressure)

        self.result.pressures = pressures
        self.result.Kz = self.get_Kz(h)

        return pressures

    def calculate_forces(
        self: ASCE7WindGenerator, story_heights: List[float]
    ) -> List[WindForce]:
        """Calculate wind forces at each story level."""
        pressures = self.result.pressures
        if not pressures:
            self.calculate_pressures()
            pressures = self.result.pressures

        forces = []
        B = self.params.width

        for i, z in enumerate(story_heights):
            p_net = 0
            for pressure in pressures:
                if abs(pressure.height - z) < self.params.height / len(pressures):
                    p_net = pressure.p_net
                    break

            if i == 0:
                trib_height = story_heights[0]
            else:
                trib_height = story_heights[i] - story_heights[i - 1]

            area = B * trib_height

            force = p_net * area

            forces.append(
                WindForce(
                    member_id=f"story_{i+1}",
                    height=z,
                    area=area,
                    force=force,
                    direction=self.params.direction,
                )
            )

        self.result.member_forces = forces

        self.result.total_base_shear = sum(f.force for f in forces)
        self.result.total_overturning_moment = sum(f.force * f.height for f in forces)

        return forces

    def generate_nodal_loads(
        self: ASCE7WindGenerator, nodes: Dict[str, Dict]
    ) -> List[Dict]:
        """Generate nodal loads for structural analysis."""
        pressures = self.result.pressures
        if not pressures:
            self.calculate_pressures()
            pressures = self.result.pressures

        nodal_loads = []
        direction = self.params.direction.upper()
        B = self.params.width

        height_tolerance = 0.5
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

        for i, z in enumerate(sorted_heights):
            if z == 0:
                continue

            p_net = 0
            for pressure in pressures:
                if pressure.height >= z:
                    p_net = pressure.p_net
                    break

            if i == 0:
                trib_height = z
            else:
                trib_height = z - sorted_heights[i - 1]

            area = B * trib_height
            total_force = p_net * area

            node_ids = levels[z]
            force_per_node = total_force / len(node_ids) if node_ids else 0

            for node_id in node_ids:
                load = {
                    "node_id": node_id,
                    "fx": force_per_node if direction == "X" else 0,
                    "fy": 0,
                    "fz": force_per_node if direction == "Z" else 0,
                    "source": "ASCE7_WIND",
                    "load_case": f"W{direction}",
                }
                nodal_loads.append(load)

        self.result.nodal_loads = nodal_loads
        return nodal_loads
