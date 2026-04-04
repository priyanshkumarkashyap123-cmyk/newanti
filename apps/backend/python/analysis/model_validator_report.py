"""Helpers for model validator reporting and serialization."""

from __future__ import annotations

from typing import Any, Dict, Tuple

from analysis.validation.model_validator_core import ValidationIssue, ValidationResult


def build_summary(error_count: int, warning_count: int) -> Tuple[bool, str]:
    """Derive is_valid flag and summary text from issue counts."""
    if error_count > 0:
        return False, f"Found {error_count} critical errors - analysis will fail"
    if warning_count > 0:
        return True, f"Model is valid with {warning_count} warnings"
    return True, "Model is valid and ready for analysis"


def issue_to_dict(issue: ValidationIssue) -> Dict[str, Any]:
    """Serialize a ValidationIssue to a JSON-friendly dict."""
    issue_type = issue.issue_type.value if hasattr(issue.issue_type, "value") else str(issue.issue_type)
    return {
        "type": issue_type,
        "severity": issue.severity.value,
        "message": issue.message,
        "affected_elements": issue.affected_elements,
        "suggested_fix": issue.suggested_fix,
        "auto_fixable": issue.auto_fixable,
    }


def result_to_dict(result: ValidationResult) -> Dict[str, Any]:
    """Serialize ValidationResult to JSON-friendly dict with issues expanded."""
    return {
        "is_valid": result.is_valid,
        "summary": result.summary,
        "error_count": result.error_count,
        "warning_count": result.warning_count,
        "info_count": result.info_count,
        "node_count": result.node_count,
        "member_count": result.member_count,
        "support_count": result.support_count,
        "load_count": result.load_count,
        "issues": [issue_to_dict(issue) for issue in result.issues],
    }


__all__ = ["build_summary", "issue_to_dict", "result_to_dict"]