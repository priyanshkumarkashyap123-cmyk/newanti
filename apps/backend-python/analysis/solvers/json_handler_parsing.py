"""
json_handler_parsing.py - JSON topology and load parsing for DSM solver

Converts JSON input from frontend to Python structural model objects.

Input JSON format (from React frontend):
{
  "nodes": [{"id": "N1", "x": 0, "y": 0, "z": 0}, ...],
  "elements": [{"id": "M1", "startNodeId": "N1", "endNodeId": "N2"}, ...],
  "restraints": [{"nodeId": "N1", "ux": true, "uy": true, ...}, ...],
  "loads": [{"nodeId": "N2", "Px": 100, "Py": -50, ...}, ...],
  "memberLoads": [{"memberId": "M1", "type": "UDL", "w": 10, ...}, ...],
}
"""

import logging
from typing import Any, Dict

import numpy as np
from numpy import float64

from analysis.solvers.dsm_3d_frame import Node3D, Element3D, StructuralModel

logger = logging.getLogger(__name__)


class JSONHandler:
    """Parse JSON topology and loads; create DSM model objects."""

    @staticmethod
    def parse_topology_json(json_data: Dict[str, Any]) -> StructuralModel:
        """
        Parse JSON topology and create StructuralModel.

        Parameters
        ----------
        json_data : dict
            JSON with keys: nodes, elements, restraints (optional)

        Returns
        -------
        model : StructuralModel
            Structural model ready for analysis

        Raises
        ------
        ValueError
            If JSON format is invalid
        """
        nodes_dict = {}
        elements_dict = {}

        # ====================================================================
        # PARSE NODES
        # ====================================================================
        try:
            nodes_data = json_data.get('nodes', [])
            if not nodes_data:
                raise ValueError("No nodes in JSON")

            for node_data in nodes_data:
                node_id = node_data['id']
                x = float64(node_data['x'])
                y = float64(node_data['y'])
                z = float64(node_data['z'])

                # Initialize empty restraints dict
                restraints = {
                    'ux': False, 'uy': False, 'uz': False,
                    'rx': False, 'ry': False, 'rz': False
                }

                node = Node3D(
                    id=node_id,
                    x=x,
                    y=y,
                    z=z,
                    restraints=restraints
                )
                nodes_dict[node_id] = node

            logger.info(f"Parsed {len(nodes_dict)} nodes")

        except KeyError as e:
            raise ValueError(f"Missing required node key: {e}") from e

        # ====================================================================
        # PARSE RESTRAINTS
        # ====================================================================
        try:
            restraints_data = json_data.get('restraints', [])
            for restr in restraints_data:
                node_id = restr['nodeId']
                if node_id not in nodes_dict:
                    logger.warning(f"Restraint on non-existent node {node_id}")
                    continue

                # Update node restraint dictionary
                for dof_name in ['ux', 'uy', 'uz', 'rx', 'ry', 'rz']:
                    nodes_dict[node_id].restraints[dof_name] = bool(
                        restr.get(dof_name, False)
                    )

            logger.info(f"Applied restraints to {len(restraints_data)} nodes")

        except KeyError as e:
            logger.warning(f"Error parsing restraints: {e}")

        # ====================================================================
        # PARSE ELEMENTS
        # ====================================================================
        try:
            elements_data = json_data.get('elements', [])
            if not elements_data:
                raise ValueError("No elements in JSON")

            for elem_data in elements_data:
                elem_id = elem_data['id']
                node_i = elem_data['startNodeId']
                node_j = elem_data['endNodeId']

                if node_i not in nodes_dict or node_j not in nodes_dict:
                    logger.warning(
                        f"Element {elem_id} references non-existent nodes"
                    )
                    continue

                # Material properties (with defaults for steel)
                E = float64(elem_data.get('E', 210000))  # MPa (steel)
                G = float64(elem_data.get('G', 80000))   # MPa (steel)

                # Section properties
                A = float64(elem_data.get('A', 1000))    # mm²
                Iy = float64(elem_data.get('Iy', 100000))  # mm⁴
                Iz = float64(elem_data.get('Iz', 50000))   # mm⁴
                J = float64(elem_data.get('J', 100000))    # mm⁴

                # Member releases (as boolean dict)
                releases = {
                    'Myi': bool(elem_data.get('releaseMyi', False)),
                    'Mzi': bool(elem_data.get('releaseMzi', False)),
                    'Myj': bool(elem_data.get('releaseMyi', False)),
                    'Mzj': bool(elem_data.get('releaseMzi', False)),
                }

                element = Element3D(
                    id=elem_id,
                    node_i=node_i,
                    node_j=node_j,
                    E=E,
                    G=G,
                    A=A,
                    Iy=Iy,
                    Iz=Iz,
                    J=J,
                    releases=releases
                )
                elements_dict[elem_id] = element

            logger.info(f"Parsed {len(elements_dict)} elements")

        except KeyError as e:
            raise ValueError(f"Missing required element key: {e}") from e

        # Create model
        model = StructuralModel(
            nodes=nodes_dict,
            elements=elements_dict,
            n_dofs=len(nodes_dict) * 6
        )

        return model

    @staticmethod
    def parse_loads_json(json_data: Dict[str, Any]) -> np.ndarray:
        """
        Parse nodal and member loads from JSON.

        Returns global load vector F for system [K]{U} = {F}.

        Parameters
        ----------
        json_data : dict
            JSON with keys: nodes (for node count), loads, memberLoads

        Returns
        -------
        F : ndarray (n_dofs,)
            Global load vector in kN and kN·m
        """
        n_nodes = len(json_data.get('nodes', []))
        n_dofs = n_nodes * 6
        F = np.zeros(n_dofs, dtype=float64)

        # Node index mapping
        nodes_data = json_data.get('nodes', [])
        node_list = sorted([n['id'] for n in nodes_data])
        node_to_index = {nid: idx for idx, nid in enumerate(node_list)}

        # ====================================================================
        # PARSE NODAL LOADS
        # ====================================================================
        loads_data = json_data.get('loads', [])
        for load in loads_data:
            node_id = load['nodeId']
            if node_id not in node_to_index:
                logger.warning(f"Load on non-existent node {node_id}")
                continue

            node_idx = node_to_index[node_id]
            base_dof = node_idx * 6

            # Force components (kN)
            Px = float64(load.get('Px', 0))
            Py = float64(load.get('Py', 0))
            Pz = float64(load.get('Pz', 0))

            # Moment components (kN·m)
            Mx = float64(load.get('Mx', 0))
            My = float64(load.get('My', 0))
            Mz = float64(load.get('Mz', 0))

            F[base_dof] += Px
            F[base_dof + 1] += Py
            F[base_dof + 2] += Pz
            F[base_dof + 3] += Mx
            F[base_dof + 4] += My
            F[base_dof + 5] += Mz

        logger.info(f"Applied {len(loads_data)} nodal loads")

        # ====================================================================
        # PARSE MEMBER LOADS (distributed loads → equivalent nodal forces)
        # Fixed-End Force method per standard structural analysis
        # ====================================================================
        member_loads_data = json_data.get('memberLoads', [])
        elements_data = json_data.get('elements', [])

        # Build element lookup: {id: {startNodeId, endNodeId, ...}}
        elem_lookup = {}
        for el in elements_data:
            elem_lookup[el['id']] = el

        # Build node coordinate lookup
        node_coords = {}
        for n in nodes_data:
            node_coords[n['id']] = (float64(n['x']), float64(n['y']), float64(n['z']))

        for mload in member_loads_data:
            member_id = mload.get('memberId')
            if member_id not in elem_lookup:
                logger.warning(f"Member load on non-existent element {member_id}")
                continue

            elem = elem_lookup[member_id]
            ni_id = elem['startNodeId']
            nj_id = elem['endNodeId']

            if ni_id not in node_to_index or nj_id not in node_to_index:
                logger.warning(f"Member {member_id} references unknown nodes")
                continue

            # Element geometry
            xi, yi, zi = node_coords[ni_id]
            xj, yj, zj = node_coords[nj_id]
            dx, dy, dz = xj - xi, yj - yi, zj - zi
            L = float64(np.sqrt(dx*dx + dy*dy + dz*dz))
            if L < 1e-12:
                logger.warning(f"Zero-length member {member_id}")
                continue

            load_type = mload.get('type', 'UDL').upper()
            direction = mload.get('direction', 'Y').upper()

            # Compute Fixed-End Forces in local coordinates (12-element vector)
            fef_local = np.zeros(12, dtype=float64)

            if load_type == 'UDL':
                w = float64(mload.get('w1', mload.get('w', 0)))
                # Standard FEF for UDL on beam element
                if direction == 'Y':
                    fef_local[1] = w * L / 2.0
                    fef_local[5] = w * L * L / 12.0
                    fef_local[7] = w * L / 2.0
                    fef_local[11] = -w * L * L / 12.0
                elif direction == 'Z':
                    fef_local[2] = w * L / 2.0
                    fef_local[4] = -w * L * L / 12.0
                    fef_local[8] = w * L / 2.0
                    fef_local[10] = w * L * L / 12.0
                elif direction == 'X':
                    fef_local[0] = w * L / 2.0
                    fef_local[6] = w * L / 2.0

            elif load_type == 'POINT':
                P = float64(mload.get('P', mload.get('p', 0)))
                a_frac = float64(mload.get('a', 0.5))
                a = a_frac * L
                b = L - a
                if direction == 'Y':
                    fef_local[1] = P * b * b * (3 * a + b) / (L * L * L)
                    fef_local[5] = P * a * b * b / (L * L)
                    fef_local[7] = P * a * a * (a + 3 * b) / (L * L * L)
                    fef_local[11] = -P * a * a * b / (L * L)
                elif direction == 'Z':
                    fef_local[2] = P * b * b * (3 * a + b) / (L * L * L)
                    fef_local[4] = -P * a * b * b / (L * L)
                    fef_local[8] = P * a * a * (a + 3 * b) / (L * L * L)
                    fef_local[10] = P * a * a * b / (L * L)
                elif direction == 'X':
                    fef_local[0] = P * b / L
                    fef_local[6] = P * a / L

            elif load_type == 'MOMENT':
                M = float64(mload.get('M', mload.get('m', 0)))
                a_frac = float64(mload.get('a', 0.5))
                a = a_frac * L
                b = L - a
                if direction == 'Z':
                    fef_local[1] = 6 * M * a * b / (L * L * L)
                    fef_local[5] = M * b * (2 * a - b) / (L * L)
                    fef_local[7] = -6 * M * a * b / (L * L * L)
                    fef_local[11] = M * a * (2 * b - a) / (L * L)

            elif load_type in ('UVL', 'TRAPEZ', 'TRAPEZOIDAL'):
                w1 = float64(mload.get('w1', 0))
                w2 = float64(mload.get('w2', 0))
                # Decompose into uniform (w1) + triangular (w2 - w1)
                # Uniform part
                if direction == 'Y':
                    fef_local[1] = w1 * L / 2.0
                    fef_local[5] = w1 * L * L / 12.0
                    fef_local[7] = w1 * L / 2.0
                    fef_local[11] = -w1 * L * L / 12.0
                elif direction == 'Z':
                    fef_local[2] = w1 * L / 2.0
                    fef_local[4] = -w1 * L * L / 12.0
                    fef_local[8] = w1 * L / 2.0
                    fef_local[10] = w1 * L * L / 12.0

                # Triangular part (0 at start, wt at end)
                wt = w2 - w1
                if abs(wt) > 1e-12:
                    if direction == 'Y':
                        fef_local[1] += 3 * wt * L / 20.0
                        fef_local[5] += wt * L * L / 30.0
                        fef_local[7] += 7 * wt * L / 20.0
                        fef_local[11] += -wt * L * L / 20.0
                    elif direction == 'Z':
                        fef_local[2] += 3 * wt * L / 20.0
                        fef_local[4] += -wt * L * L / 30.0
                        fef_local[8] += 7 * wt * L / 20.0
                        fef_local[10] += wt * L * L / 20.0

            else:
                logger.warning(f"Unknown member load type '{load_type}' on {member_id}")
                continue

            # Build 12x12 transformation matrix (local → global)
            cx, cy, cz = dx / L, dy / L, dz / L

            # Direction cosine matrix (3x3)
            if abs(cx) < 1e-10 and abs(cz) < 1e-10:
                # Vertical member → use global X as reference
                if cy > 0:
                    lam = np.array([
                        [0, 1, 0],
                        [-1, 0, 0],
                        [0, 0, 1]
                    ], dtype=float64)
                else:
                    lam = np.array([
                        [0, -1, 0],
                        [1, 0, 0],
                        [0, 0, 1]
                    ], dtype=float64)
            else:
                # General member
                r = np.sqrt(cx * cx + cz * cz)
                lam = np.array([
                    [cx, cy, cz],
                    [-cx * cy / r, r, -cy * cz / r],
                    [-cz / r, 0, cx / r]
                ], dtype=float64)

            # Expand 3x3 to 12x12 block diagonal
            T = np.zeros((12, 12), dtype=float64)
            for blk in range(4):
                T[blk*3:blk*3+3, blk*3:blk*3+3] = lam

            # Transform FEF to global: fef_global = T^T @ fef_local
            fef_global = T.T @ fef_local

            # Assemble into global force vector
            si = node_to_index[ni_id]
            ei = node_to_index[nj_id]
            for i in range(6):
                F[si * 6 + i] += fef_global[i]
                F[ei * 6 + i] += fef_global[i + 6]

            logger.info(f"Applied {load_type} member load on {member_id} "
                       f"(direction={direction})")

        return F


__all__ = [
    "JSONHandler",
]
