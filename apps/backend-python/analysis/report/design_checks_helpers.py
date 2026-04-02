"""Helpers for report design-check normalization and ranking."""

from typing import Any, Dict, List

from analysis.report_generator_common import (
    CHECK_CLAUSE_MAP,
    CODE_DEFAULT_CLAUSE,
    safe_float,
)


def resolve_design_code(design_checks: Dict[str, Any]) -> str:
    """Resolve code label from payload with a stable fallback."""
    raw = str(
        design_checks.get("design_code")
        or design_checks.get("code")
        or design_checks.get("designCode")
        or "IS 800:2007"
    ).strip()
    return raw or "IS 800:2007"


def resolve_clause_reference(member: Dict[str, Any], design_code: str) -> str:
    """Resolve clause reference using explicit clause first, then check-key mapping."""
    explicit_clause = str(
        member.get("clause")
        or member.get("clause_reference")
        or member.get("clauseReference")
        or ""
    ).strip()
    if explicit_clause:
        return explicit_clause

    check_key = str(
        member.get("governing_check")
        or member.get("governingCheck")
        or member.get("check_key")
        or member.get("checkType")
        or ""
    ).strip()
    if check_key and check_key in CHECK_CLAUSE_MAP:
        return CHECK_CLAUSE_MAP[check_key]

    for code_key, default_clause in CODE_DEFAULT_CLAUSE.items():
        if code_key in design_code.upper():
            return default_clause

    return "Code Clause: Refer governing design standard"


def resolve_member_status(utilization: float, member: Dict[str, Any]) -> str:
    """Resolve PASS/FAIL/WARNING status from explicit status or utilization."""
    raw_status = str(member.get("status", "")).strip().upper()
    if raw_status in {"PASS", "FAIL", "WARNING"}:
        return raw_status
    if utilization > 1.0:
        return "FAIL"
    if utilization > 0.9:
        return "WARNING"
    return "PASS"


def normalize_design_check_row(member: Dict[str, Any], design_code: str) -> List[str]:
    """Normalize mixed design-check payload shapes into a printable row."""
    utilization = safe_float(
        member.get("utilization", member.get("ratio", member.get("dcr", 0.0))),
        0.0,
    )
    governing = str(
        member.get("governing_check")
        or member.get("governingCheck")
        or member.get("check_name")
        or member.get("checkType")
        or "Strength Check"
    )
    clause = resolve_clause_reference(member, design_code)
    status = resolve_member_status(utilization, member)

    status_symbol = {
        "PASS": "✓ PASS",
        "FAIL": "✗ FAIL",
        "WARNING": "⚠ WARNING",
    }.get(status, status)

    return [
        str(member.get("id", "")),
        str(member.get("section", "N/A")),
        governing,
        clause,
        f"{utilization * 100:.1f}%",
        status_symbol,
    ]


def build_governing_members_rows(
    members_to_check: List[Dict[str, Any]],
    design_code: str,
    max_rows: int = 8,
) -> List[List[str]]:
    """Build sorted governing-member rows by highest utilization ratio."""
    ranked: List[Dict[str, Any]] = []
    for member in members_to_check:
        if not isinstance(member, dict):
            continue
        utilization = safe_float(
            member.get("utilization", member.get("ratio", member.get("dcr", 0.0))),
            0.0,
        )
        ranked.append({"member": member, "utilization": utilization})

    ranked.sort(key=lambda x: x["utilization"], reverse=True)

    rows: List[List[str]] = []
    for item in ranked[:max_rows]:
        member = item["member"]
        utilization = item["utilization"]
        clause = resolve_clause_reference(member, design_code)
        reserve = 1.0 - utilization
        rows.append([
            str(member.get("id", "")),
            str(member.get("section", "N/A")),
            clause,
            f"{utilization:.3f}",
            f"{reserve:.3f}",
        ])

    return rows


def build_critical_failure_rows(
    members_to_check: List[Dict[str, Any]],
    design_code: str,
    max_rows: int = 8,
) -> List[List[str]]:
    """Build rows for overstressed members only (D/C > 1.0), sorted by severity."""
    failing_rows = []
    ranked = build_governing_members_rows(
        members_to_check,
        design_code,
        max_rows=max(50, max_rows),
    )
    for row in ranked:
        dc_ratio = safe_float(row[3], 0.0)
        if dc_ratio > 1.0:
            failing_rows.append(row)
        if len(failing_rows) >= max_rows:
            break
    return failing_rows


__all__ = [
    "resolve_design_code",
    "normalize_design_check_row",
    "build_governing_members_rows",
    "build_critical_failure_rows",
]
