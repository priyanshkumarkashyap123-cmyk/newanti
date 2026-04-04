"""Formatting helpers for load solver analysis results."""

from __future__ import annotations

from typing import Dict

from numpy import ndarray

from dsm_3d_frame import StructuralModel


class AnalysisResultFormatter:
    """Format analysis results as JSON-serializable dicts."""

    @staticmethod
    def format_complete_results(
        model: StructuralModel,
        displacements: ndarray,
        member_forces: Dict[str, Dict],
        diagrams: Dict[str, Dict],
        execution_time: float,
        job_id: str = "default",
    ) -> Dict:
        node_list = sorted(model.nodes.keys())

        displacements_formatted = {}
        for i, node_id in enumerate(node_list):
            dof_base = i * 6
            displacements_formatted[node_id] = {
                "ux_mm": float(displacements[dof_base + 0] * 1000),
                "uy_mm": float(displacements[dof_base + 1] * 1000),
                "uz_mm": float(displacements[dof_base + 2] * 1000),
                "rx_rad": float(displacements[dof_base + 3]),
                "ry_rad": float(displacements[dof_base + 4]),
                "rz_rad": float(displacements[dof_base + 5]),
            }

        member_forces_formatted = {}
        for melem_id, forces in member_forces.items():
            member_forces_formatted[melem_id] = {
                "node_i": {
                    "axial_kn": float(forces["axial_i"]),
                    "shear_y_kn": float(forces["shear_y_i"]),
                    "shear_z_kn": float(forces["shear_z_i"]),
                    "torsion_knm": float(forces["moment_x_i"]),
                    "moment_y_knm": float(forces["moment_y_i"]),
                    "moment_z_knm": float(forces["moment_z_i"]),
                },
                "node_j": {
                    "axial_kn": float(forces["axial_j"]),
                    "shear_y_kn": float(forces["shear_y_j"]),
                    "shear_z_kn": float(forces["shear_z_j"]),
                    "torsion_knm": float(forces["moment_x_j"]),
                    "moment_y_knm": float(forces["moment_y_j"]),
                    "moment_z_knm": float(forces["moment_z_j"]),
                },
            }

        return {
            "status": "success",
            "execution_time_seconds": float(execution_time),
            "job_id": job_id,
            "model": {
                "n_nodes": model.n_nodes,
                "n_elements": model.n_elements,
                "n_dofs": model.n_dofs,
            },
            "displacements": displacements_formatted,
            "member_forces": member_forces_formatted,
            "diagrams": diagrams,
        }
