"""
model_validator.py - Pre-Analysis Model Validation

Validates structural models BEFORE analysis to prevent failures.
Catches common issues that cause solver failures:
- Missing supports (rigid body motion)
- Disconnected nodes/members
- Zero-length members
- Extreme stiffness ratios (ill-conditioning)
- Mechanism detection

This is the KEY layer for preventing analysis failures.
"""

from __future__ import annotations

from typing import Any, Dict, List

from analysis.model_validator_checks import ModelValidatorChecks
from analysis.model_validator_modular_bridge import enrich_with_modular_validators
from analysis.model_validator_report import build_summary, result_to_dict
from analysis.model_validator_utils import ModelValidatorUtils
from analysis.validation.model_validator_core import (
    IssueSeverity,
    IssueType,
    ValidationIssue,
    ValidationResult,
    MIN_NODE_DISTANCE,
)


# ============================================
# MODEL VALIDATOR CLASS
# ============================================

class ModelValidator(ModelValidatorChecks, ModelValidatorUtils):
    """
    Validates structural models before analysis.

    Usage:
        validator = ModelValidator()
        result = validator.validate(model_data)

        if not result.is_valid:
            # Handle errors before running analysis
            for issue in result.issues:
                print(f"{issue.severity}: {issue.message}")
    """

    def __init__(self, tolerance: float = MIN_NODE_DISTANCE):
        self.tolerance = tolerance
        self.nodes: Dict[str, Dict[str, Any]] = {}
        self.members: Dict[str, Dict[str, Any]] = {}
        self.issues: List[ValidationIssue] = []

    def validate(self, model_data: Dict[str, Any]) -> ValidationResult:
        """
        Validate a structural model.

        Args:
            model_data: Dict with 'nodes', 'members', 'loads' keys

        Returns:
            ValidationResult with all detected issues
        """
        self.issues = []

        # Parse model data
        nodes_list = model_data.get('nodes', [])
        members_list = model_data.get('members', [])
        loads = model_data.get('loads', [])
        node_loads = model_data.get('node_loads', [])
        member_loads = model_data.get('member_loads', []) or model_data.get('point_loads', [])
        distributed_loads = model_data.get('distributed_loads', [])

        # Build lookup dictionaries
        self.nodes = {n.get('id', str(i)): n for i, n in enumerate(nodes_list)}
        self.members = {m.get('id', str(i)): m for i, m in enumerate(members_list)}

        # Run all validation checks
        self._check_minimum_elements()
        self._check_node_geometry()
        self._check_member_validity()
        self._check_supports()
        self._check_connectivity()
        self._check_stiffness_ratios()
        self._check_loads(loads + node_loads, member_loads + distributed_loads)
        self._check_stability()

        # Calculate statistics
        error_count = sum(1 for i in self.issues if i.severity == IssueSeverity.ERROR)
        warning_count = sum(1 for i in self.issues if i.severity == IssueSeverity.WARNING)
        info_count = sum(1 for i in self.issues if i.severity == IssueSeverity.INFO)

        # Count supports
        support_count = sum(1 for n in nodes_list if self._has_support(n))

        # Count loads
        load_count = len(loads) + len(node_loads) + len(member_loads) + len(distributed_loads)

        # Build summary
        is_valid, summary = build_summary(error_count, warning_count)

        return ValidationResult(
            is_valid=is_valid,
            issues=self.issues,
            summary=summary,
            error_count=error_count,
            warning_count=warning_count,
            info_count=info_count,
            node_count=len(nodes_list),
            member_count=len(members_list),
            support_count=support_count,
            load_count=load_count,
        )


# ============================================
# CONVENIENCE FUNCTION
# ============================================

def validate_model(model_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Validate a structural model and return results as dict.
    Uses both legacy validator and new modular validators for comprehensive checking.

    Args:
        model_data: Model with nodes, members, loads

    Returns:
        Validation result as JSON-serializable dict
    """
    # Run legacy validator
    validator = ModelValidator()
    result = validator.validate(model_data)

    # Run optional modular validators and merge into result.
    result = enrich_with_modular_validators(model_data, result)

    return result_to_dict(result)


# ============================================
# EXAMPLE USAGE
# ============================================

if __name__ == "__main__":
    # Test with invalid model
    test_model = {
        "nodes": [
            {"id": "N1", "x": 0, "y": 0, "z": 0},  # No support!
            {"id": "N2", "x": 5, "y": 0, "z": 0},
        ],
        "members": [
            {"id": "M1", "startNodeId": "N1", "endNodeId": "N2"}
        ],
        "loads": [],
    }

    result = validate_model(test_model)
    print(f"Valid: {result['is_valid']}")
    print(f"Summary: {result['summary']}")
    for issue in result['issues']:
        print(f"  [{issue['severity']}] {issue['message']}")
