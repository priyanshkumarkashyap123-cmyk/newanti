"""Helper utilities for model validation."""

from __future__ import annotations

import math
from typing import Dict, List, Set


class ModelValidatorUtils:
    """Shared helper methods used by model validation checks."""

    def _distance(self, n1: Dict, n2: Dict) -> float:
        """Calculate distance between two nodes."""
        from analysis.model_validator_helpers import distance_between_nodes

        return distance_between_nodes(n1, n2)

    def _has_support(self, node: Dict) -> bool:
        """Check if node has any support restraint."""
        from analysis.model_validator_helpers import node_has_support

        return node_has_support(node)

    def _count_restraints(self, node: Dict) -> int:
        """Count number of restrained DOFs at a node."""
        from analysis.model_validator_helpers import count_restraints

        return count_restraints(node)

    def _find_connected_components(self, adjacency: Dict[str, Set[str]]) -> List[Set[str]]:
        """Find connected components using BFS."""
        from analysis.model_validator_helpers import connected_components

        return connected_components(adjacency)
