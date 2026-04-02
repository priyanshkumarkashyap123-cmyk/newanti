"""Simple demo script for generating a sample PDF report."""

from __future__ import annotations

from analysis.report_generator import ReportGenerator
from analysis.report_generator_common import ReportSettings


def run_demo(output_path: str = "test_report.pdf") -> str:
    settings = ReportSettings(
        company_name="BeamLab ULTIMATE",
        project_name="Multi-Story Frame Analysis",
        engineer_name="John Doe, P.E.",
        project_number="2026-001",
    )

    generator = ReportGenerator(settings)

    analysis_data = {
        "input": {
            "nodes": [
                {"id": "N1", "x": 0, "y": 0, "z": 0, "support": "Fixed"},
                {"id": "N2", "x": 5, "y": 0, "z": 0, "support": "Free"},
            ],
            "members": [
                {"id": "M1", "startNodeId": "N1", "endNodeId": "N2", "section": "ISMB 300"}
            ],
            "loads": [],
        },
        "results": {
            "success": True,
            "max_displacement": 12.5,
            "max_moment": 45.2,
            "max_shear": 25.0,
            "max_axial": 150.0,
            "displacements": {
                "N1": {"dx": 0, "dy": 0, "dz": 0},
                "N2": {"dx": 0.002, "dy": -0.0125, "dz": 0},
            },
            "memberForces": {
                "M1": {"moment": [0, 45.2], "shear": [25, -25], "axial": 150}
            },
        },
        "design_checks": {
            "members": [
                {"id": "M1", "section": "ISMB 300", "utilization": 0.75}
            ]
        },
    }

    return generator.generate_report(analysis_data, output_path)


if __name__ == "__main__":
    output = run_demo()
    print(f"Report generated: {output}")
