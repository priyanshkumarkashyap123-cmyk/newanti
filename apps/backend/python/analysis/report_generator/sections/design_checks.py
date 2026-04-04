from reportlab.platypus import Paragraph, Spacer, Table
from ..settings import CHECK_CLAUSE_MAP, CODE_DEFAULT_CLAUSE


def _resolve_design_code(check):
    return check.get('code') or check.get('design_code') or ""


def _resolve_clause_reference(check):
    if check.get('clause'):
        return check['clause']
    code = _resolve_design_code(check)
    key = check.get('type') or check.get('check_type') or ""
    return CHECK_CLAUSE_MAP.get(key) or CODE_DEFAULT_CLAUSE.get(code, "")


def _resolve_member_status(check):
    ratio = check.get('ratio') or check.get('utilization') or 0
    if ratio <= 1.0:
        return 'PASS'
    elif ratio <= 1.05:
        return 'WARNING'
    return 'FAIL'


def _normalize_design_check_row(check):
    code = _resolve_design_code(check)
    clause = _resolve_clause_reference(check)
    ratio = check.get('ratio') or check.get('utilization') or 0
    status = _resolve_member_status(check)
    return [
        check.get('member_id', ''),
        check.get('type', check.get('check_type', '')),
        code,
        clause,
        f"{ratio:.2f}",
        status,
    ]


def _build_governing_members_rows(design_checks):
    rows = []
    for check in design_checks:
        ratio = check.get('ratio') or check.get('utilization') or 0
        if ratio is None:
            continue
        rows.append((ratio, _normalize_design_check_row(check)))
    rows.sort(key=lambda x: x[0], reverse=True)
    return [r[1] for r in rows[:50]]


def _build_critical_failure_rows(design_checks):
    rows = []
    for check in design_checks:
        ratio = check.get('ratio') or check.get('utilization') or 0
        if ratio is None or ratio <= 1.0:
            continue
        rows.append((ratio, _normalize_design_check_row(check)))
    rows.sort(key=lambda x: x[0], reverse=True)
    return [r[1] for r in rows[:50]]


def add_design_checks(story, styles, analysis_data, settings):
    if not settings.include_design_checks:
        return
    design_checks = analysis_data.get('design_checks', [])
    if not design_checks:
        return

    story.append(Paragraph("Design Checks", styles['CustomHeading1']))
    story.append(Spacer(1, 10))

    rows = _build_governing_members_rows(design_checks)
    if rows:
        data = [["Member", "Check", "Code", "Clause", "D/C", "Status"]] + rows
        t = Table(data, repeatRows=1)
        story.append(t)
        story.append(Spacer(1, 10))

    critical_rows = _build_critical_failure_rows(design_checks)
    if critical_rows:
        data = [["Member", "Check", "Code", "Clause", "D/C", "Status"]] + critical_rows
        t = Table(data, repeatRows=1)
        story.append(Paragraph("Critical Failures", styles['CustomHeading2']))
        story.append(t)
        story.append(Spacer(1, 10))