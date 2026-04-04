"""Load distribution helpers for floor area loads."""

from __future__ import annotations

from typing import Dict, List

from .load_types import LoadDirection
from .load_models_distributed_types import TrapezoidalLoad


class FloorLoadDistributionMixin:
    """Distribution routines for one-way/two-way slab load transfer."""

    def distribute_to_beams(
        self,
        panels: List[Dict],
        beams: List[Dict],
        nodes: Dict[str, Dict],
    ) -> List[TrapezoidalLoad]:
        """Distribute floor load to beams using yield line method."""
        distributed_loads = []

        for panel in panels:
            lx = panel['Lx']
            lz = panel['Lz']
            ratio = panel['aspect_ratio']
            panel_beams = self._get_panel_beams(panel, beams, nodes)

            if ratio >= 2.0:
                distributed_loads.extend(self._one_way_distribution(panel_beams, lx, lz))
            else:
                distributed_loads.extend(self._two_way_distribution(panel_beams, lx, lz))

        return distributed_loads

    def _get_panel_beams(
        self,
        panel: Dict,
        beams: List[Dict],
        nodes: Dict[str, Dict],
    ) -> Dict[str, List[Dict]]:
        """Identify beams on each edge of the panel."""
        tol = 0.1
        edges = {'bottom': [], 'top': [], 'left': [], 'right': []}

        for beam in beams:
            start = nodes.get(beam['start_node_id'])
            end = nodes.get(beam['end_node_id'])
            if not start or not end:
                continue

            x1, x2 = sorted([start['x'], end['x']])
            z1, z2 = sorted([start['z'], end['z']])

            if abs(z1 - z2) < tol:
                z_pos = (z1 + z2) / 2
                if abs(z_pos - panel['z_min']) < tol:
                    edges['bottom'].append(beam)
                elif abs(z_pos - panel['z_max']) < tol:
                    edges['top'].append(beam)

            if abs(x1 - x2) < tol:
                x_pos = (x1 + x2) / 2
                if abs(x_pos - panel['x_min']) < tol:
                    edges['left'].append(beam)
                elif abs(x_pos - panel['x_max']) < tol:
                    edges['right'].append(beam)

        return edges

    def _one_way_distribution(
        self,
        panel_beams: Dict[str, List[Dict]],
        lx: float,
        lz: float,
    ) -> List[TrapezoidalLoad]:
        """One-way slab distribution (aspect ratio >= 2)."""
        loads = []

        if lx > lz:
            tributary_width = lz / 2
            target_beams = panel_beams['bottom'] + panel_beams['top']
        else:
            tributary_width = lx / 2
            target_beams = panel_beams['left'] + panel_beams['right']

        w = self.pressure * tributary_width

        for beam in target_beams:
            loads.append(
                TrapezoidalLoad(
                    id=f"floor_{self.id}_{beam['id']}",
                    member_id=beam['id'],
                    w1=w,
                    w2=w,
                    direction=LoadDirection.GLOBAL_Y,
                    load_case=self.load_case,
                )
            )

        return loads

    def _two_way_distribution(
        self,
        panel_beams: Dict[str, List[Dict]],
        lx: float,
        lz: float,
    ) -> List[TrapezoidalLoad]:
        """Two-way slab distribution using yield line pattern."""
        loads = []
        l_short = min(lx, lz)
        l_long = max(lx, lz)
        w_max = self.pressure * l_short / 2
        tri_length = l_short / 2

        if lx <= lz:
            for beam in panel_beams['left'] + panel_beams['right']:
                loads.append(
                    TrapezoidalLoad(
                        id=f"floor_{self.id}_{beam['id']}",
                        member_id=beam['id'],
                        w1=0,
                        w2=w_max,
                        direction=LoadDirection.GLOBAL_Y,
                        start_pos=0.0,
                        end_pos=0.5,
                        load_case=self.load_case,
                    )
                )
                loads.append(
                    TrapezoidalLoad(
                        id=f"floor_{self.id}_{beam['id']}_2",
                        member_id=beam['id'],
                        w1=w_max,
                        w2=0,
                        direction=LoadDirection.GLOBAL_Y,
                        start_pos=0.5,
                        end_pos=1.0,
                        load_case=self.load_case,
                    )
                )

            trap_ratio = tri_length / l_long if l_long > 0 else 0.5
            for beam in panel_beams['bottom'] + panel_beams['top']:
                loads.append(
                    TrapezoidalLoad(
                        id=f"floor_{self.id}_{beam['id']}",
                        member_id=beam['id'],
                        w1=0,
                        w2=w_max,
                        direction=LoadDirection.GLOBAL_Y,
                        start_pos=0.0,
                        end_pos=trap_ratio,
                        load_case=self.load_case,
                    )
                )
                loads.append(
                    TrapezoidalLoad(
                        id=f"floor_{self.id}_{beam['id']}_mid",
                        member_id=beam['id'],
                        w1=w_max,
                        w2=w_max,
                        direction=LoadDirection.GLOBAL_Y,
                        start_pos=trap_ratio,
                        end_pos=1 - trap_ratio,
                        load_case=self.load_case,
                    )
                )
                loads.append(
                    TrapezoidalLoad(
                        id=f"floor_{self.id}_{beam['id']}_end",
                        member_id=beam['id'],
                        w1=w_max,
                        w2=0,
                        direction=LoadDirection.GLOBAL_Y,
                        start_pos=1 - trap_ratio,
                        end_pos=1.0,
                        load_case=self.load_case,
                    )
                )
        else:
            for beam in panel_beams['bottom'] + panel_beams['top']:
                loads.append(
                    TrapezoidalLoad(
                        id=f"floor_{self.id}_{beam['id']}",
                        member_id=beam['id'],
                        w1=0,
                        w2=w_max,
                        direction=LoadDirection.GLOBAL_Y,
                        start_pos=0.0,
                        end_pos=0.5,
                        load_case=self.load_case,
                    )
                )
                loads.append(
                    TrapezoidalLoad(
                        id=f"floor_{self.id}_{beam['id']}_2",
                        member_id=beam['id'],
                        w1=w_max,
                        w2=0,
                        direction=LoadDirection.GLOBAL_Y,
                        start_pos=0.5,
                        end_pos=1.0,
                        load_case=self.load_case,
                    )
                )

            trap_ratio = tri_length / l_long if l_long > 0 else 0.5
            for beam in panel_beams['left'] + panel_beams['right']:
                loads.append(
                    TrapezoidalLoad(
                        id=f"floor_{self.id}_{beam['id']}",
                        member_id=beam['id'],
                        w1=0,
                        w2=w_max,
                        direction=LoadDirection.GLOBAL_Y,
                        start_pos=0.0,
                        end_pos=trap_ratio,
                        load_case=self.load_case,
                    )
                )
                loads.append(
                    TrapezoidalLoad(
                        id=f"floor_{self.id}_{beam['id']}_mid",
                        member_id=beam['id'],
                        w1=w_max,
                        w2=w_max,
                        direction=LoadDirection.GLOBAL_Y,
                        start_pos=trap_ratio,
                        end_pos=1 - trap_ratio,
                        load_case=self.load_case,
                    )
                )
                loads.append(
                    TrapezoidalLoad(
                        id=f"floor_{self.id}_{beam['id']}_end",
                        member_id=beam['id'],
                        w1=w_max,
                        w2=0,
                        direction=LoadDirection.GLOBAL_Y,
                        start_pos=1 - trap_ratio,
                        end_pos=1.0,
                        load_case=self.load_case,
                    )
                )

        return loads


__all__ = ["FloorLoadDistributionMixin"]
