import pytest

from analysis.report.hooks.design_checks_hook import build_design_checks_view, normalize_design_check_row


def test_build_design_checks_view_ranks_and_filters():
    design_checks = {"design_code": "IS 800:2007"}
    members = [
        {"id": "M1", "section": "ISMB300", "utilization": 0.85, "governing_check": "bending"},
        {"id": "M2", "section": "ISMB350", "utilization": 1.12, "governing_check": "shear"},
        {"id": "M3", "section": "ISMB400", "utilization": 0.95, "governing_check": "bending"},
    ]

    design_code, governing_rows, critical_rows = build_design_checks_view(design_checks, members, max_rows=5)

    assert design_code == "IS 800:2007"
    # Sorted by utilization desc
    assert governing_rows[0][0] == "M2"  # highest D/C first
    assert governing_rows[1][0] == "M3"
    assert governing_rows[2][0] == "M1"
    # Critical rows only include overstressed
    assert [row[0] for row in critical_rows] == ["M2"]


def test_normalize_design_check_row_status_and_clause_fallback():
    member = {"id": "C1", "section": "ISMC150", "utilization": 1.05, "governingCheck": "default"}
    row = normalize_design_check_row(member, "IS 800:2007")

    assert row[0] == "C1"
    assert row[1] == "ISMC150"
    assert row[5].startswith("✗ FAIL")


if __name__ == "__main__":
    pytest.main([__file__])
