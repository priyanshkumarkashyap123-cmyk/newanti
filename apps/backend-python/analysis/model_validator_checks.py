"""Validation check mixin for structural model validation."""

from __future__ import annotations

from typing import Dict, List, Set

from analysis.validation.model_validator_core import (
    IssueSeverity,
    IssueType,
    ValidationIssue,
    MAX_STIFFNESS_RATIO,
    MIN_MEMBER_LENGTH,
    MIN_NODE_DISTANCE,
)


class ModelValidatorChecks:
    """Validation checks split out from the main model validator facade."""

    def _check_minimum_elements(self) -> None:
        """Check that model has minimum required elements."""
        if len(self.nodes) < 2:
            self.issues.append(ValidationIssue(
                issue_type=IssueType.DISCONNECTED_STRUCTURE,
                severity=IssueSeverity.ERROR,
                message="Model needs at least 2 nodes to form a structure",
                suggested_fix="Add more nodes to define the geometry",
                auto_fixable=False
            ))

        if len(self.members) < 1:
            self.issues.append(ValidationIssue(
                issue_type=IssueType.DISCONNECTED_STRUCTURE,
                severity=IssueSeverity.ERROR,
                message="Model has no members - nothing to analyze",
                suggested_fix="Add members to connect the nodes",
                auto_fixable=False
            ))

    def _check_node_geometry(self) -> None:
        """Check for overlapping nodes and invalid coordinates."""
        node_list = list(self.nodes.values())
        overlapping = []

        for i, n1 in enumerate(node_list):
            for n2 in node_list[i + 1:]:
                dist = self._distance(n1, n2)
                if dist < self.tolerance:
                    overlapping.append((n1.get('id'), n2.get('id')))

        for pair in overlapping:
            self.issues.append(ValidationIssue(
                issue_type=IssueType.OVERLAPPING_NODES,
                severity=IssueSeverity.ERROR,
                message=f"Nodes {pair[0]} and {pair[1]} are at the same location",
                affected_elements=list(pair),
                suggested_fix="Merge nodes or adjust coordinates",
                auto_fixable=True
            ))

    def _check_member_validity(self) -> None:
        """Check member references and geometry."""
        for member_id, member in self.members.items():
            start_id = member.get('startNodeId') or member.get('start_node') or member.get('s')
            end_id = member.get('endNodeId') or member.get('end_node') or member.get('e')

            if start_id not in self.nodes:
                self.issues.append(ValidationIssue(
                    issue_type=IssueType.INVALID_MEMBER_REFERENCE,
                    severity=IssueSeverity.ERROR,
                    message=f"Member {member_id} references non-existent start node '{start_id}'",
                    affected_elements=[member_id],
                    suggested_fix="Fix the member's node reference"
                ))
                continue

            if end_id not in self.nodes:
                self.issues.append(ValidationIssue(
                    issue_type=IssueType.INVALID_MEMBER_REFERENCE,
                    severity=IssueSeverity.ERROR,
                    message=f"Member {member_id} references non-existent end node '{end_id}'",
                    affected_elements=[member_id],
                    suggested_fix="Fix the member's node reference"
                ))
                continue

            n1 = self.nodes[start_id]
            n2 = self.nodes[end_id]
            length = self._distance(n1, n2)

            if length < MIN_NODE_DISTANCE:
                self.issues.append(ValidationIssue(
                    issue_type=IssueType.ZERO_LENGTH_MEMBER,
                    severity=IssueSeverity.ERROR,
                    message=f"Member {member_id} has zero or near-zero length ({length:.6f}m)",
                    affected_elements=[member_id],
                    suggested_fix="Remove duplicate nodes or adjust coordinates",
                    auto_fixable=True
                ))
            elif length < MIN_MEMBER_LENGTH:
                self.issues.append(ValidationIssue(
                    issue_type=IssueType.VERY_SHORT_MEMBER,
                    severity=IssueSeverity.WARNING,
                    message=f"Member {member_id} is very short ({length:.4f}m) - may cause numerical issues",
                    affected_elements=[member_id],
                    suggested_fix="Consider merging with adjacent members"
                ))

    def _check_supports(self) -> None:
        """Check for adequate supports."""
        supported_nodes = []
        total_restraints = 0

        for node_id, node in self.nodes.items():
            if self._has_support(node):
                supported_nodes.append(node_id)
                total_restraints += self._count_restraints(node)

        if len(supported_nodes) == 0:
            self.issues.append(ValidationIssue(
                issue_type=IssueType.NO_SUPPORTS,
                severity=IssueSeverity.ERROR,
                message="Model has no supports - will have rigid body motion",
                affected_elements=list(self.nodes.keys()),
                suggested_fix="Add pinned or fixed supports at base nodes",
                auto_fixable=True
            ))
        elif total_restraints < 6:
            if total_restraints >= 3:
                self.issues.append(ValidationIssue(
                    issue_type=IssueType.INSUFFICIENT_SUPPORTS,
                    severity=IssueSeverity.WARNING,
                    message=f"Model has only {total_restraints} DOF restraints - might be unstable in 3D (needs 6). OK for 2D.",
                    affected_elements=supported_nodes,
                    suggested_fix="For full 3D stability, ensure at least 6 DOF are restrained total. For 2D, 3 is sufficient.",
                    auto_fixable=True
                ))
            else:
                self.issues.append(ValidationIssue(
                    issue_type=IssueType.INSUFFICIENT_SUPPORTS,
                    severity=IssueSeverity.ERROR,
                    message=f"Model has only {total_restraints} DOF restraints - needs at least 3 for 2D stability (6 for 3D)",
                    affected_elements=supported_nodes,
                    suggested_fix="Add more supports or fix existing supports",
                    auto_fixable=True
                ))
        elif len(supported_nodes) == 1 and len(self.nodes) > 2:
            self.issues.append(ValidationIssue(
                issue_type=IssueType.INSUFFICIENT_SUPPORTS,
                severity=IssueSeverity.WARNING,
                message="Only one support found - structure may be unstable for lateral loads",
                affected_elements=supported_nodes,
                suggested_fix="Consider adding a second support point",
                auto_fixable=True
            ))

    def _check_connectivity(self) -> None:
        """Check that all nodes are connected and structure is continuous."""
        if len(self.members) == 0:
            return

        connected_nodes: Set[str] = set()
        adjacency: Dict[str, Set[str]] = {nid: set() for nid in self.nodes}

        for member in self.members.values():
            start_id = member.get('startNodeId') or member.get('start_node') or member.get('s')
            end_id = member.get('endNodeId') or member.get('end_node') or member.get('e')

            if start_id and start_id in self.nodes:
                connected_nodes.add(start_id)
                if end_id in adjacency:
                    adjacency[start_id].add(end_id)

            if end_id and end_id in self.nodes:
                connected_nodes.add(end_id)
                if start_id in adjacency:
                    adjacency[end_id].add(start_id)

        disconnected = set(self.nodes.keys()) - connected_nodes
        if disconnected:
            self.issues.append(ValidationIssue(
                issue_type=IssueType.DISCONNECTED_NODES,
                severity=IssueSeverity.WARNING,
                message=f"{len(disconnected)} nodes are not connected to any member",
                affected_elements=list(disconnected),
                suggested_fix="Connect these nodes to members or remove them",
                auto_fixable=True
            ))

        if connected_nodes:
            components = self._find_connected_components(adjacency)
            if len(components) > 1:
                self.issues.append(ValidationIssue(
                    issue_type=IssueType.DISCONNECTED_STRUCTURE,
                    severity=IssueSeverity.ERROR,
                    message=f"Structure has {len(components)} disconnected parts",
                    affected_elements=[str(c) for c in components],
                    suggested_fix="Connect the separate parts with members"
                ))

    def _check_stiffness_ratios(self) -> None:
        """Check for extreme stiffness ratios that cause ill-conditioning."""
        if len(self.members) < 2:
            return

        stiffnesses = []
        for member_id, member in self.members.items():
            E = member.get('E', 200e6)
            A = member.get('A', 0.01)
            I = member.get('Iz', member.get('Iy', 1e-4))

            EA = E * A
            EI = E * I

            stiffnesses.append({
                'id': member_id,
                'EA': EA,
                'EI': EI
            })

        max_EA = max(s['EA'] for s in stiffnesses)
        min_EA = min(s['EA'] for s in stiffnesses)
        max_EI = max(s['EI'] for s in stiffnesses)
        min_EI = min(s['EI'] for s in stiffnesses)

        if min_EA > 0 and max_EA / min_EA > MAX_STIFFNESS_RATIO:
            self.issues.append(ValidationIssue(
                issue_type=IssueType.EXTREME_STIFFNESS_RATIO,
                severity=IssueSeverity.WARNING,
                message=f"Extreme axial stiffness ratio ({max_EA / min_EA:.2e}) - may cause numerical instability",
                suggested_fix="Check member properties or use rigid constraints"
            ))

        if min_EI > 0 and max_EI / min_EI > MAX_STIFFNESS_RATIO:
            self.issues.append(ValidationIssue(
                issue_type=IssueType.EXTREME_STIFFNESS_RATIO,
                severity=IssueSeverity.WARNING,
                message=f"Extreme flexural stiffness ratio ({max_EI / min_EI:.2e}) - may cause numerical instability",
                suggested_fix="Check member section properties"
            ))

    def _check_loads(self, node_loads: List, member_loads: List) -> None:
        """Check for valid load definitions."""
        total_loads = len(node_loads) + len(member_loads)

        if total_loads == 0:
            self.issues.append(ValidationIssue(
                issue_type=IssueType.NO_LOADS,
                severity=IssueSeverity.INFO,
                message="No loads applied - analysis will show zero results",
                suggested_fix="Apply point loads or distributed loads"
            ))

        for load in node_loads:
            node_id = load.get('nodeId') or load.get('node_id')
            if node_id and node_id not in self.nodes:
                self.issues.append(ValidationIssue(
                    issue_type=IssueType.UNSUPPORTED_LOAD_NODE,
                    severity=IssueSeverity.WARNING,
                    message=f"Load references non-existent node '{node_id}'",
                    affected_elements=[node_id],
                    suggested_fix="Fix the load's node reference"
                ))

        for load in member_loads:
            member_id = load.get('memberId') or load.get('member_id')
            if member_id and member_id not in self.members:
                self.issues.append(ValidationIssue(
                    issue_type=IssueType.LOAD_ON_MISSING_MEMBER,
                    severity=IssueSeverity.WARNING,
                    message=f"Load references non-existent member '{member_id}'",
                    affected_elements=[member_id],
                    suggested_fix="Fix the load's member reference"
                ))

    def _check_stability(self) -> None:
        """Advanced stability check using simple degree of freedom analysis."""
        n_nodes = len(self.nodes)
        n_members = len(self.members)

        if n_nodes < 2 or n_members < 1:
            return

        restrained_dofs = 0
        for node in self.nodes.values():
            restrained_dofs += self._count_restraints(node)

        if restrained_dofs < 6:
            return

        if n_members < n_nodes - 1:
            self.issues.append(ValidationIssue(
                issue_type=IssueType.MECHANISM_DETECTED,
                severity=IssueSeverity.WARNING,
                message=f"Structure may be a mechanism ({n_members} members, {n_nodes} nodes) - add bracing",
                suggested_fix="Add diagonal bracing or additional members"
            ))
