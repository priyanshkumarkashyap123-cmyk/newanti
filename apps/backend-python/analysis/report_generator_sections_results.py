"""Analysis results and reactions section builders for PDF reports."""

import math
from typing import Any, Dict

from reportlab.lib.units import inch
from reportlab.platypus import Paragraph, Spacer, Table

from analysis.report_generator_common import extract_member_force_extremes, safe_float


class ReportGeneratorResultsSection:
    """Mixin for analysis results section generation."""

    def _add_analysis_results(self, results: Dict[str, Any]):
        """Add analysis results section."""
        self.story.append(Paragraph(
            "2. ANALYSIS RESULTS",
            self.styles['CustomHeading1']
        ))
        self.story.append(Spacer(1, 12))

        displacements = results.get('displacements', {})
        member_forces = results.get('memberForces', results.get('member_forces', {}))

        max_displacement = safe_float(results.get('max_displacement', 0))
        max_moment = safe_float(results.get('max_moment', 0))
        max_shear = safe_float(results.get('max_shear', 0))
        max_axial = safe_float(results.get('max_axial', 0))

        if isinstance(displacements, dict):
            for disp in displacements.values():
                if not isinstance(disp, dict):
                    continue
                dx_m = safe_float(disp.get('dx', 0))
                dy_m = safe_float(disp.get('dy', 0))
                dz_m = safe_float(disp.get('dz', 0))
                total_mm = math.sqrt(dx_m * dx_m + dy_m * dy_m + dz_m * dz_m) * 1000.0
                max_displacement = max(max_displacement, total_mm)

        if isinstance(member_forces, dict):
            for forces in member_forces.values():
                if not isinstance(forces, dict):
                    continue
                extrema = extract_member_force_extremes(forces)
                max_moment = max(max_moment, extrema['moment_y'], extrema['moment_z'])
                max_shear = max(max_shear, extrema['shear_y'], extrema['shear_z'])
                max_axial = max(max_axial, extrema['axial'])

        summary_text = f"""
        <b>Analysis Summary:</b><br/>
        • Max. Displacement (&delta;<sub>max</sub>): {max_displacement:.2f} mm<br/>
        • Max. Bending Moment (M<sub>z,max</sub>): {max_moment:.2f} kN·m<br/>
        • Max. Shear Force (V<sub>max</sub>): {max_shear:.2f} kN<br/>
        • Max. Axial Force (P<sub>max</sub>): {max_axial:.2f} kN<br/>
        • Analysis Status: {'✓ SUCCESSFUL' if results.get('success') else '✗ FAILED'}<br/>
        """

        self.story.append(Paragraph(summary_text, self.styles['CustomBody']))
        self.story.append(Spacer(1, 12))

        if displacements:
            self.story.append(Paragraph(
                "2.1 Node Displacements",
                self.styles['CustomHeading2']
            ))

            disp_data = [['Node', '&delta;x (mm)', '&delta;y (mm)', '&delta;z (mm)', '&delta;total (mm)']]
            for node_id, disp in list(displacements.items())[:15]:
                dx = disp.get('dx', 0) * 1000
                dy = disp.get('dy', 0) * 1000
                dz = disp.get('dz', 0) * 1000
                total = (dx**2 + dy**2 + dz**2)**0.5

                disp_data.append([
                    str(node_id),
                    f"{dx:.2f}",
                    f"{dy:.2f}",
                    f"{dz:.2f}",
                    f"{total:.2f}"
                ])

            disp_table = Table(disp_data, colWidths=[1.2*inch, 1.2*inch, 1.2*inch, 1.2*inch, 1.2*inch])
            disp_table.setStyle(self._get_table_style())
            self.story.append(disp_table)
            self.story.append(Spacer(1, 12))

        if member_forces:
            self.story.append(Paragraph(
                "2.2 Member Forces",
                self.styles['CustomHeading2']
            ))

            force_data = [[
                'Member',
                'Moment My,max (kN·m)',
                'Moment Mz,max (kN·m)',
                'Shear Vy,max (kN)',
                'Axial N,max (kN)'
            ]]
            for member_id, forces in list(member_forces.items())[:15]:
                if not isinstance(forces, dict):
                    continue
                extrema = extract_member_force_extremes(forces)

                force_data.append([
                    str(member_id),
                    f"{extrema['moment_y']:.2f}",
                    f"{extrema['moment_z']:.2f}",
                    f"{extrema['shear_y']:.2f}",
                    f"{extrema['axial']:.2f}"
                ])

            force_table = Table(force_data, colWidths=[1.2*inch, 1.3*inch, 1.3*inch, 1.3*inch, 1.3*inch])
            force_table.setStyle(self._get_table_style())
            self.story.append(force_table)

    def _add_reaction_summary(self, results: Dict[str, Any]):
        """Add support reactions table with signed values and SI units."""
        reactions = results.get('reactions', {})
        if not isinstance(reactions, dict) or not reactions:
            return

        self.story.append(Spacer(1, 12))
        self.story.append(Paragraph(
            "2.3 Support Reactions",
            self.styles['CustomHeading2']
        ))

        reaction_rows = [['Node', 'Fx (kN)', 'Fy (kN)', 'Fz (kN)', 'Mx (kN·m)', 'My (kN·m)', 'Mz (kN·m)']]
        for node_id, rxn in list(reactions.items())[:20]:
            if not isinstance(rxn, dict):
                continue
            reaction_rows.append([
                str(node_id),
                f"{safe_float(rxn.get('fx', 0)):.2f}",
                f"{safe_float(rxn.get('fy', 0)):.2f}",
                f"{safe_float(rxn.get('fz', 0)):.2f}",
                f"{safe_float(rxn.get('mx', 0)):.2f}",
                f"{safe_float(rxn.get('my', 0)):.2f}",
                f"{safe_float(rxn.get('mz', 0)):.2f}",
            ])

        if len(reaction_rows) > 1:
            table = Table(
                reaction_rows,
                colWidths=[0.9*inch, 0.85*inch, 0.85*inch, 0.85*inch, 1.0*inch, 1.0*inch, 1.0*inch]
            )
            table.setStyle(self._get_table_style())
            self.story.append(table)


__all__ = ["ReportGeneratorResultsSection"]
