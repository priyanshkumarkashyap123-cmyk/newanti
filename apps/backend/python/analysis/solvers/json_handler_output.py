"""
json_handler_output.py - JSON output formatting for DSM analysis results

Converts DSM solver results back to JSON format for frontend transmission.
"""

import json
import logging
from typing import Any, Dict

from analysis.solvers.dsm_3d_frame import DirectStiffnessMethod3D, StructuralModel

logger = logging.getLogger(__name__)


class OutputFormatter:
    """Format analysis results for JSON output to frontend."""

    @staticmethod
    def format_results(dsm: DirectStiffnessMethod3D,
                      model: StructuralModel) -> Dict[str, Any]:
        """
        Format analysis results as JSON-serializable dictionary.

        Parameters
        ----------
        dsm : DirectStiffnessMethod3D
            Solved DSM system (with result populated)
        model : StructuralModel
            Structural model

        Returns
        -------
        results : dict
            Dictionary with nodes, elements, displacements, reactions, etc.
            Ready for JSON serialization and frontend transmission.

        Raises
        ------
        ValueError
            If DSM system has not been solved
        """
        if dsm.result is None or dsm.result.displacements is None:
            raise ValueError("System not solved")

        # Node index mapping
        node_list = sorted(model.nodes.keys())
        node_to_index = {nid: idx for idx, nid in enumerate(node_list)}

        # ====================================================================
        # DISPLACEMENTS
        # ====================================================================
        displacements = {}
        dof_names = ['ux', 'uy', 'uz', 'rx', 'ry', 'rz']

        for node_id, node_idx in node_to_index.items():
            base_dof = node_idx * 6
            disp = {}
            for offset, dof_name in enumerate(dof_names):
                disp[dof_name] = float(dsm.result.displacements[base_dof + offset])
            displacements[node_id] = disp

        # ====================================================================
        # REACTIONS
        # ====================================================================
        reactions = {}
        if dsm.result.reactions:
            for node_id in model.nodes.keys():
                if node_id in dsm.result.reactions:
                    reactions[node_id] = {
                        k: float(v) for k, v in dsm.result.reactions[node_id].items()
                    }

        # ====================================================================
        # BUILD OUTPUT
        # ====================================================================
        output = {
            'status': 'completed',
            'displacements': displacements,
            'reactions': reactions,
            'nodes': [
                {
                    'id': node_id,
                    'x': float(node.x),
                    'y': float(node.y),
                    'z': float(node.z),
                    'displacement': displacements.get(node_id, {}),
                    'reaction': reactions.get(node_id, {})
                }
                for node_id, node in model.nodes.items()
            ],
            'elements': [
                {
                    'id': elem_id,
                    'startNodeId': elem.node_i,
                    'endNodeId': elem.node_j,
                    'properties': {
                        'E': float(elem.E),
                        'G': float(elem.G),
                        'A': float(elem.A),
                        'Iy': float(elem.Iy),
                        'Iz': float(elem.Iz),
                        'J': float(elem.J),
                    }
                }
                for elem_id, elem in model.elements.items()
            ],
        }

        return output

    @staticmethod
    def to_json_string(results: Dict[str, Any], indent: int = 2) -> str:
        """
        Convert results dictionary to JSON string.

        Parameters
        ----------
        results : dict
            Results dictionary from format_results()
        indent : int
            JSON indentation level (default: 2 for readability)

        Returns
        -------
        json_str : str
            JSON string ready for transmission to frontend

        Notes
        -----
        Uses default=float to handle numpy float64 types seamlessly.
        """
        return json.dumps(results, indent=indent, default=float)


__all__ = [
    "OutputFormatter",
]
