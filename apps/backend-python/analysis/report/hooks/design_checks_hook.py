"""Hook wrapper for design-check normalization and ranking.

Exposes a single entrypoint to prepare design check tables for reports while
reusing the existing helper functions.
"""
from typing import Any, Dict, List, Tuple

from analysis.report.design_checks_helpers import (
    resolve_design_code,
    normalize_design_check_row,
    build_governing_members_rows,
    build_critical_failure_rows,
)


def build_design_checks_view(
    design_checks: Dict[str, Any],
    members_to_check: List[Dict[str, Any]],
    max_rows: int = 8,
) -> Tuple[str, List[List[str]], List[List[str]]]:
    """
    Build design-check view data for reports.

    Returns a tuple of (design_code, governing_rows, critical_rows).
    - design_code: resolved string label for the governing code
    - governing_rows: ranked rows (utilization-desc) with clause/reserve
    - critical_rows: overstressed rows (D/C > 1.0) up to max_rows
    """
    design_code = resolve_design_code(design_checks)
    governing_rows = build_governing_members_rows(members_to_check, design_code, max_rows=max_rows)
    critical_rows = build_critical_failure_rows(members_to_check, design_code, max_rows=max_rows)
    return design_code, governing_rows, critical_rows


__all__ = [
    "build_design_checks_view",
    "resolve_design_code",
    "normalize_design_check_row",
    "build_governing_members_rows",
    "build_critical_failure_rows",
]
