"""
json_handler.py - JSON Input/Output for DSM Solver

Handles conversion between JSON topology (from React frontend) and
Python structural model objects.

Input JSON format (from frontend):
{
  "nodes": [{"id": "N1", "x": 0, "y": 0, "z": 0}, ...],
  "elements": [{"id": "M1", "startNodeId": "N1", "endNodeId": "N2"}, ...],
  "restraints": [{"nodeId": "N1", "ux": true, "uy": true, ...}, ...],
  "loads": [{"nodeId": "N2", "Px": 100, "Py": -50, ...}, ...],
  "memberLoads": [{"memberId": "M1", "type": "UDL", "w": 10, ...}, ...],
  "loadCases": [...],
  "code": "IS 456:2000"
}
"""

import json
import logging
from typing import Any, Dict

from .dsm_3d_frame import StructuralModel, DirectStiffnessMethod3D
from .json_handler_parsing import JSONHandler
from .json_handler_output import OutputFormatter

logger = logging.getLogger(__name__)

# ============================================================================
# IMPORTED EXTRACTED CLASSES
# ============================================================================
#
# Classes JSONHandler and OutputFormatter are imported from:
#   - json_handler_parsing.py   (JSONHandler)
#   - json_handler_output.py    (OutputFormatter)
#
# ============================================================================
# MODULE EXAMPLE AND EXPORTS
# ============================================================================


__all__ = [
    "JSONHandler",
    "OutputFormatter",
]


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)

    # Test with simple example
    test_json = {
        "nodes": [
            {"id": "N1", "x": 0, "y": 0, "z": 0},
            {"id": "N2", "x": 5, "y": 0, "z": 0},
        ],
        "elements": [
            {"id": "M1", "startNodeId": "N1", "endNodeId": "N2"},
        ],
        "restraints": [
            {"nodeId": "N1", "ux": True, "uy": True, "uz": True,
             "rx": True, "ry": True, "rz": True},
        ],
        "loads": [
            {"nodeId": "N2", "Py": -50},
        ],
    }

    handler = JSONHandler()
    model = handler.parse_topology_json(test_json)
    print(f"Model: {len(model.nodes)} nodes, {len(model.elements)} elements")

    F = handler.parse_loads_json(test_json)
    print(f"Load vector: {F}")
