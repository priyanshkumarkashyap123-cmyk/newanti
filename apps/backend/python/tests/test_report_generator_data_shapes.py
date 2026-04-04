"""Regression tests for backend report data-shape handling."""

import sys
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from analysis.report_generator import ReportGenerator, ReportSettings
from reportlab.platypus import Table


def _generator() -> ReportGenerator:
    return ReportGenerator(ReportSettings())


def test_extract_member_force_extremes_scalar_shape() -> None:
    generator = _generator()

    extrema = generator._extract_member_force_extremes(
        {
            "axial": -180.0,
            "shearY": 45.0,
            "shearZ": -22.0,
            "momentY": 12.5,
            "momentZ": -33.25,
            "torsion": 4.0,
        }
    )

    assert extrema["axial"] == 180.0
    assert extrema["shear_y"] == 45.0
    assert extrema["shear_z"] == 22.0
    assert extrema["moment_y"] == 12.5
    assert extrema["moment_z"] == 33.25
    assert extrema["torsion"] == 4.0


def test_extract_member_force_extremes_array_and_diagram_shape() -> None:
    generator = _generator()

    extrema = generator._extract_member_force_extremes(
        {
            "moment": [0.0, -60.0, 48.0],
            "shear": [12.0, -14.0],
            "diagramData": {
                "moment_z": [10.0, -80.0, 20.0],
                "shear_y": [2.0, -22.0],
                "axial": [90.0, -110.0],
            },
        }
    )

    assert extrema["moment_y"] == 60.0
    assert extrema["moment_z"] == 80.0
    assert extrema["shear_y"] == 22.0
    assert extrema["axial"] == 110.0


def test_add_analysis_results_handles_list_forces_without_crash() -> None:
    generator = _generator()

    generator._add_analysis_results(
        {
            "success": True,
            "displacements": {
                "N1": {"dx": 0.0, "dy": 0.0, "dz": 0.0},
                "N2": {"dx": 0.001, "dy": -0.002, "dz": 0.0},
            },
            "memberForces": {
                "M1": {
                    "moment": [0.0, 25.0, -30.0],
                    "shear": [10.0, -12.0],
                    "axial": -75.0,
                }
            },
        }
    )

    assert len(generator.story) > 0


def test_add_design_checks_renders_clause_reference_table() -> None:
    generator = _generator()

    generator._add_design_checks(
        {
            "design_code": "IS 800:2007",
            "members": [
                {
                    "id": "M1",
                    "section": "ISMB 300",
                    "governing_check": "IS800_FLEXURE",
                    "utilization": 0.82,
                }
            ],
        }
    )

    tables = [item for item in generator.story if isinstance(item, Table)]
    assert tables, "Expected at least one table in design checks section"

    target_table = next(
        table for table in tables if "Clause Reference" in table._cellvalues[0]
    )
    header = target_table._cellvalues[0]
    row_1 = target_table._cellvalues[1]

    assert "Clause Reference" in header
    assert row_1[0] == "M1"
    assert row_1[3] == "IS 800:2007 Cl. 8.2"
    assert row_1[5] == "✓ PASS"


def test_design_check_status_uses_utilization_thresholds() -> None:
    generator = _generator()

    fail_row = generator._normalize_design_check_row(
        {
            "id": "M_FAIL",
            "section": "ISMB 200",
            "governing_check": "IS800_SHEAR",
            "utilization": 1.08,
        },
        "IS 800:2007",
    )
    warn_row = generator._normalize_design_check_row(
        {
            "id": "M_WARN",
            "section": "ISMB 200",
            "governing_check": "IS800_SHEAR",
            "utilization": 0.94,
        },
        "IS 800:2007",
    )

    assert fail_row[-1] == "✗ FAIL"
    assert warn_row[-1] == "⚠ WARNING"


def test_governing_members_rows_are_sorted_by_highest_utilization() -> None:
    generator = _generator()

    rows = generator._build_governing_members_rows(
        [
            {"id": "M1", "section": "ISMB 250", "governing_check": "IS800_FLEXURE", "utilization": 0.91},
            {"id": "M2", "section": "ISMB 300", "governing_check": "IS800_SHEAR", "utilization": 1.12},
            {"id": "M3", "section": "ISMB 350", "governing_check": "IS800_LTB", "utilization": 0.84},
        ],
        "IS 800:2007",
    )

    assert rows[0][0] == "M2"
    assert rows[1][0] == "M1"
    assert rows[2][0] == "M3"
    assert rows[0][2] == "IS 800:2007 Cl. 8.4"
    assert rows[0][3] == "1.120"
    assert rows[0][4] == "-0.120"


def test_design_checks_adds_governing_members_summary_table() -> None:
    generator = _generator()

    generator._add_design_checks(
        {
            "design_code": "IS 800:2007",
            "members": [
                {"id": "M1", "section": "ISMB 300", "governing_check": "IS800_FLEXURE", "utilization": 0.82},
                {"id": "M2", "section": "ISMB 350", "governing_check": "IS800_SHEAR", "utilization": 1.05},
            ],
        }
    )

    tables = [item for item in generator.story if isinstance(item, Table)]
    assert len(tables) >= 2

    governing_table = tables[-1]
    header = governing_table._cellvalues[0]
    first_row = governing_table._cellvalues[1]

    assert "D/C Ratio" in header
    assert first_row[0] == "M2"
    assert first_row[3] == "1.050"


def test_critical_failure_rows_include_only_dc_gt_1() -> None:
    generator = _generator()

    rows = generator._build_critical_failure_rows(
        [
            {"id": "M1", "section": "ISMB 250", "governing_check": "IS800_FLEXURE", "utilization": 0.98},
            {"id": "M2", "section": "ISMB 300", "governing_check": "IS800_SHEAR", "utilization": 1.02},
            {"id": "M3", "section": "ISMB 350", "governing_check": "IS800_LTB", "utilization": 1.19},
        ],
        "IS 800:2007",
    )

    assert len(rows) == 2
    assert rows[0][0] == "M3"
    assert rows[1][0] == "M2"
    assert rows[0][3] == "1.190"
    assert rows[0][4] == "-0.190"


def test_design_checks_adds_critical_failures_table_when_present() -> None:
    generator = _generator()

    generator._add_design_checks(
        {
            "design_code": "IS 800:2007",
            "members": [
                {"id": "M_OK", "section": "ISMB 300", "governing_check": "IS800_FLEXURE", "utilization": 0.82},
                {"id": "M_FAIL", "section": "ISMB 350", "governing_check": "IS800_SHEAR", "utilization": 1.05},
            ],
        }
    )

    tables = [item for item in generator.story if isinstance(item, Table)]
    assert len(tables) >= 3

    critical_table = tables[-1]
    header = critical_table._cellvalues[0]
    first_row = critical_table._cellvalues[1]

    assert "Reserve Ratio (1-D/C)" in header
    assert first_row[0] == "M_FAIL"
    assert first_row[3] == "1.050"
