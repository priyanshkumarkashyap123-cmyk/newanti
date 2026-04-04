"""Design checks and diagrams section builders for PDF reports."""

from typing import Any, Dict

from reportlab.lib.units import inch
from reportlab.platypus import Paragraph, Spacer, Table, PageBreak, Image

from analysis.report.design_checks_helpers import (
    resolve_design_code,
    normalize_design_check_row,
    build_governing_members_rows,
    build_critical_failure_rows,
)


class ReportGeneratorDesignSection:
    """Mixin for design checks and diagrams section generation."""

    def _add_design_checks(self, design_checks: Dict[str, Any]):
        """Add design check section (IS 800 compliance)."""
        design_code = resolve_design_code(design_checks)
        self.story.append(Paragraph(
            f"3. DESIGN CHECKS ({design_code})",
            self.styles['CustomHeading1']
        ))
        self.story.append(Spacer(1, 12))

        safety_factor_text = (
            "• Partial Safety Factors: γm0 = 1.10, γm1 = 1.25 (IS 800)<br/>"
            if "IS 800" in design_code.upper()
            else "• Partial Safety Factors: As per selected code provisions<br/>"
        )

        checks_text = (
            "<b>Code Compliance:</b><br/>"
            f"• Design Code: {design_code}<br/>"
            "• Material: As provided in member section metadata<br/>"
            f"{safety_factor_text}"
            "• Load Combinations: As per active project load set<br/>"
            "• Status Basis: Utilization = Demand / Capacity (D/C)"
        )

        self.story.append(Paragraph(checks_text, self.styles['CustomBody']))
        self.story.append(Spacer(1, 12))

        check_data = [['Member', 'Section', 'Governing Check', 'Clause Reference', 'Utilization', 'Status']]

        members_to_check = design_checks.get('members', [])
        if isinstance(members_to_check, list):
            for member in members_to_check[:20]:
                if not isinstance(member, dict):
                    continue
                check_data.append(normalize_design_check_row(member, design_code))

        if len(check_data) > 1:
            check_table = Table(
                check_data,
                colWidths=[0.8*inch, 1.1*inch, 1.6*inch, 2.2*inch, 0.8*inch, 0.9*inch]
            )
            check_table.setStyle(self._get_table_style())
            self.story.append(check_table)

            governing_rows = build_governing_members_rows(members_to_check, design_code)
            if governing_rows:
                self.story.append(Spacer(1, 12))
                self.story.append(Paragraph(
                    "3.1 Governing Members (Highest D/C)",
                    self.styles['CustomHeading2']
                ))
                self.story.append(Paragraph(
                    (
                        "Top members are ranked by utilization (Demand/Capacity). "
                        "Negative reserve ratio indicates overstress and requires redesign."
                    ),
                    self.styles['CustomBody']
                ))

                governing_table_data = [[
                    'Member',
                    'Section',
                    'Controlling Clause',
                    'D/C Ratio',
                    'Reserve Ratio (1-D/C)'
                ]] + governing_rows

                governing_table = Table(
                    governing_table_data,
                    colWidths=[0.9*inch, 1.1*inch, 2.2*inch, 0.8*inch, 1.5*inch],
                )
                governing_table.setStyle(self._get_table_style())
                self.story.append(governing_table)

                critical_rows = build_critical_failure_rows(members_to_check, design_code)
                if critical_rows:
                    self.story.append(Spacer(1, 12))
                    self.story.append(Paragraph(
                        "3.2 Critical Failures (D/C > 1.00)",
                        self.styles['CustomHeading2']
                    ))
                    self.story.append(Paragraph(
                        (
                            "These members exceed capacity under at least one governing check and "
                            "require immediate redesign or section upgrade."
                        ),
                        self.styles['CustomBody']
                    ))

                    critical_table_data = [[
                        'Member',
                        'Section',
                        'Controlling Clause',
                        'D/C Ratio',
                        'Reserve Ratio (1-D/C)'
                    ]] + critical_rows

                    critical_table = Table(
                        critical_table_data,
                        colWidths=[0.9*inch, 1.1*inch, 2.2*inch, 0.8*inch, 1.5*inch],
                    )
                    critical_table.setStyle(self._get_critical_failures_table_style())
                    self.story.append(critical_table)

    def _add_diagrams(self, diagrams: Dict[str, Any]):
        """Add diagrams section with generated images."""
        self.story.append(PageBreak())
        self.story.append(Paragraph(
            "4. DIAGRAMS",
            self.styles['CustomHeading1']
        ))
        self.story.append(Spacer(1, 12))

        try:
            import matplotlib.pyplot as plt
            from io import BytesIO

            nodes = diagrams.get('nodes', [])
            members = diagrams.get('members', [])

            if nodes:
                plt.figure(figsize=(6, 4), dpi=300)

                for member in members:
                    start = next((n for n in nodes if n['id'] == member['startNodeId']), None)
                    end = next((n for n in nodes if n['id'] == member['endNodeId']), None)
                    if start and end:
                        plt.plot([start['x'], end['x']], [start['y'], end['y']], 'k-', linewidth=1.5)

                x_coords = [n['x'] for n in nodes]
                y_coords = [n['y'] for n in nodes]
                plt.plot(x_coords, y_coords, 'bo', markersize=4)

                for n in nodes:
                    plt.annotate(
                        n['id'],
                        (n['x'], n['y']),
                        xytext=(5, 5), textcoords='offset points',
                        fontsize=8,
                        color='blue'
                    )

                plt.title("Structural Model (XY View)", fontsize=10, fontweight='bold')
                plt.xlabel("X (m)", fontsize=8)
                plt.ylabel("Y (m)", fontsize=8)
                plt.grid(True, linestyle='--', alpha=0.5)
                plt.axis('equal')

                img_buffer = BytesIO()
                plt.savefig(img_buffer, format='png', bbox_inches='tight')
                img_buffer.seek(0)
                plt.close()

                img = Image(img_buffer, width=5*inch, height=3.5*inch)
                self.story.append(img)
                self.story.append(Paragraph("Figure 4.1: Structural Geometry", self.styles['CustomBody']))
                self.story.append(Spacer(1, 20))

        except Exception as e:
            self.story.append(Paragraph(f"Could not generate diagrams: {str(e)}", self.styles['CustomBody']))


__all__ = ["ReportGeneratorDesignSection"]
