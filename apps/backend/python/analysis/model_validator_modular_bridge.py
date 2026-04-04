"""Bridge for optional modular validation integration.

Keeps model_validator.py focused on legacy/core orchestration while this module
handles optional integration with analysis.validation package validators.
"""

from __future__ import annotations

from typing import Any, Dict

from analysis.validation.model_validator_core import (
    IssueSeverity,
    IssueType,
    ValidationIssue,
    ValidationResult,
)


def enrich_with_modular_validators(
    model_data: Dict[str, Any],
    result: ValidationResult,
) -> ValidationResult:
    """Run optional modular validators and merge messages into ValidationResult.

    If modular validators are unavailable or fail, this function returns the
    original result unchanged.
    """
    try:
        from analysis.validation import ValidationSeverity
        from analysis.validation.geometry_validator import GeometryValidator
        from analysis.validation.load_validator import LoadValidator
        from analysis.validation.support_validator import SupportValidator
    except ImportError:
        return result

    try:
        nodes = model_data.get('nodes', [])
        members = model_data.get('members', [])
        node_loads = model_data.get('node_loads', model_data.get('loads', []))
        distributed_loads = model_data.get('distributed_loads', [])

        geo_validator = GeometryValidator(nodes, members)
        geo_validator.validate_all()
        geo_result = geo_validator.get_result()

        support_validator = SupportValidator(nodes, members)
        support_validator.validate_all()
        support_result = support_validator.get_result()

        load_validator = LoadValidator(nodes, members, node_loads, distributed_loads)
        load_validator.validate_all()
        load_result = load_validator.get_result()

        severity_map = {
            ValidationSeverity.ERROR: IssueSeverity.ERROR,
            ValidationSeverity.WARNING: IssueSeverity.WARNING,
            ValidationSeverity.INFO: IssueSeverity.INFO,
        }

        for modular_result in (geo_result, support_result, load_result):
            for msg in modular_result.messages:
                issue = ValidationIssue(
                    issue_type=IssueType.NO_SUPPORTS,
                    severity=severity_map.get(msg.severity, IssueSeverity.WARNING),
                    message=f"[{msg.code}] {msg.message}",
                    affected_elements=msg.affected_elements,
                    suggested_fix=msg.suggestion,
                    auto_fixable=False,
                )
                result.issues.append(issue)

                if msg.severity == ValidationSeverity.ERROR:
                    result.error_count += 1
                    result.is_valid = False
                elif msg.severity == ValidationSeverity.WARNING:
                    result.warning_count += 1
                else:
                    result.info_count += 1

        if not result.is_valid:
            result.summary = (
                f"Model validation failed with {result.error_count} critical errors. "
                "See details below."
            )

    except Exception as e:  # pragma: no cover - defensive integration boundary
        # Keep legacy validation path resilient even if modular validators fail.
        print(f"Warning: Modular validators failed: {e}")

    return result


__all__ = ["enrich_with_modular_validators"]
