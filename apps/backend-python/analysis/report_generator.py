"""
report_generator.py - Professional PDF Report Generation

Creates customizable analysis reports with:
- Cover page with project details
- Input summary (geometry, loads, supports)
- Analysis results (displacements, forces, stresses)
- Design checks (IS 800 compliance)
- Charts and diagrams
- Company branding

Uses ReportLab for PDF generation.
"""

from reportlab.lib.pagesizes import A4, letter
from reportlab.lib.units import mm, inch
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_RIGHT, TA_JUSTIFY
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    PageBreak, Image, KeepTogether
)
from reportlab.pdfgen import canvas
from reportlab.graphics.shapes import Drawing
from reportlab.graphics.charts.linecharts import HorizontalLineChart
from reportlab.graphics.charts.barcharts import VerticalBarChart

from datetime import datetime
from typing import Dict, List, Any, Optional
from dataclasses import dataclass
import io
import math


CHECK_CLAUSE_MAP = {
    "IS800_FLEXURE": "IS 800:2007 Cl. 8.2",
    "IS800_SHEAR": "IS 800:2007 Cl. 8.4",
    "IS800_LTB": "IS 800:2007 Cl. 8.2.2",
    "IS800_COMPRESSION_FLEXURE": "IS 800:2007 Cl. 9.3.1",
    "IS800_TENSION_FLEXURE": "IS 800:2007 Cl. 9.3.2",
    "FLEXURE_MAJOR": "AISC 360-16 §F2",
    "FLEXURE_MINOR": "AISC 360-16 §F6",
    "SHEAR_CHECK": "AISC 360-16 §G2",
    "AXIAL_COMPRESSION": "AISC 360-16 §E3",
    "AXIAL_TENSION": "AISC 360-16 §D2",
    "COMPRESSION_FLEXURE_COMBINED": "AISC 360-16 §H1-1",
    "TENSION_FLEXURE_COMBINED": "AISC 360-16 §H1-2",
}


CODE_DEFAULT_CLAUSE = {
    "IS 800": "IS 800:2007 Cl. 3, Cl. 8, Cl. 9",
    "AISC": "AISC 360-16 Chapter D/E/F/G/H",
    "IS 456": "IS 456:2000 Cl. 38, Cl. 40, Cl. 41",
    "ACI": "ACI 318-19 Ch. 22",
    "EC2": "EN 1992-1-1 Cl. 6",
    "EC3": "EN 1993-1-1 Cl. 6",
}


@dataclass
class ReportSettings:
    """Settings for report customization
    
    Includes profile-based section toggles and granular diagram controls.
    For backward compatibility, include_diagrams gates all diagram types.
    """
    # Document settings
    page_size: str = "A4"  # "A4" or "Letter"
    orientation: str = "portrait"  # "portrait" or "landscape"
    
    # Company branding
    company_name: str = "Engineering Consultancy"
    company_logo: Optional[str] = None  # Path to logo image
    company_address: str = ""
    company_phone: str = ""
    company_email: str = ""
    
    # Project information
    project_name: str = "Structural Analysis"
    project_number: str = ""
    project_location: str = ""
    client_name: str = ""
    engineer_name: str = ""
    checked_by: str = ""
    
    # Report sections to include
    include_cover_page: bool = True
    include_toc: bool = True
    include_input_summary: bool = True
    include_load_cases: bool = True
    include_load_combinations: bool = True
    include_node_displacements: bool = True
    include_member_forces: bool = True
    include_reaction_summary: bool = True
    include_analysis_results: bool = True
    include_design_checks: bool = True
    include_diagrams: bool = True
    include_concrete_design: bool = False
    include_foundation_design: bool = False
    include_connection_design: bool = False
    include_appendix: bool = False
    
    # Granular diagram controls (only evaluated if include_diagrams=True)
    include_sfd: bool = True             # Shear Force Diagram (Vy—XY plane)
    include_bmd: bool = True             # Bending Moment Diagram (Mz—XY plane)
    include_deflection: bool = True      # Deflected shape
    include_afd: bool = True             # Axial Force Diagram (Fx)
    include_bmd_my: bool = False         # Weak-axis moment (My—XZ plane)
    include_shear_z: bool = False        # Weak-axis shear (Vz—XZ plane)
    
    # Load case context
    selected_load_case_id: Optional[str] = None  # Currently active LC from UI
    
    # Metadata minimization (for SFD_BMD_ONLY)
    minimal_metadata: bool = False
    
    # Styling
    primary_color: tuple = (0, 0.4, 0.8)  # RGB (0-1)
    secondary_color: tuple = (0.2, 0.2, 0.2)
    header_footer: bool = True
    page_numbers: bool = True


class ReportGenerator:
    """Generates professional PDF reports for structural analysis"""
    
    def __init__(self, settings: ReportSettings):
        self.settings = settings
        self.story = []  # ReportLab story (list of flowables)
        self.styles = self._create_styles()
        
    def _create_styles(self) -> Dict[str, ParagraphStyle]:
        """Create custom paragraph styles"""
        styles = getSampleStyleSheet()
        
        # Title style
        styles.add(ParagraphStyle(
            name='CustomTitle',
            parent=styles['Heading1'],
            fontSize=24,
            textColor=colors.Color(*self.settings.primary_color),
            spaceAfter=30,
            alignment=TA_CENTER,
            fontName='Helvetica-Bold'
        ))
        
        # Heading styles
        styles.add(ParagraphStyle(
            name='CustomHeading1',
            parent=styles['Heading1'],
            fontSize=16,
            textColor=colors.Color(*self.settings.primary_color),
            spaceAfter=12,
            spaceBefore=12,
            fontName='Helvetica-Bold'
        ))
        
        styles.add(ParagraphStyle(
            name='CustomHeading2',
            parent=styles['Heading2'],
            fontSize=14,
            textColor=colors.Color(*self.settings.secondary_color),
            spaceAfter=10,
            spaceBefore=10,
            fontName='Helvetica-Bold'
        ))
        
        styles.add(ParagraphStyle(
            name='CustomHeading3',
            parent=styles['Heading3'],
            fontSize=12,
            spaceAfter=8,
            spaceBefore=8,
            fontName='Helvetica-Bold'
        ))
        
        # Body text
        styles.add(ParagraphStyle(
            name='CustomBody',
            parent=styles['BodyText'],
            fontSize=10,
            alignment=TA_JUSTIFY,
            spaceAfter=6
        ))
        
        # Code/data style
        styles.add(ParagraphStyle(
            name='CodeStyle',
            parent=styles['Code'],
            fontSize=9,
            fontName='Courier',
            leftIndent=20
        ))
        
        return styles
    
    def generate_report(
        self,
        analysis_data: Dict[str, Any],
        output_path: str
    ) -> str:
        """
        Generate complete PDF report
        
        Args:
            analysis_data: Analysis results and model data
            output_path: Path to save PDF
            
        Returns:
            Path to generated PDF
        """
        # Create PDF document
        page_size = A4 if self.settings.page_size == "A4" else letter
        
        doc = SimpleDocTemplate(
            output_path,
            pagesize=page_size,
            rightMargin=72,
            leftMargin=72,
            topMargin=72,
            bottomMargin=72
        )
        
        # Build story
        self.story = []
        
        if self.settings.include_cover_page:
            self._add_cover_page()
            self.story.append(PageBreak())
        
        if self.settings.include_input_summary:
            self._add_input_summary(analysis_data.get('input', {}))
            self.story.append(PageBreak())

        if self.settings.include_load_cases or self.settings.include_load_combinations:
            self._add_load_data(analysis_data)
            self.story.append(PageBreak())
        
        if self.settings.include_analysis_results:
            self._add_analysis_results(analysis_data.get('results', {}))
            if self.settings.include_reaction_summary:
                self._add_reaction_summary(analysis_data.get('results', {}))
            self.story.append(PageBreak())
        
        if self.settings.include_design_checks:
            self._add_design_checks(analysis_data.get('design_checks', {}))
        
        if self.settings.include_diagrams:
            self._add_diagrams(analysis_data.get('diagrams', {}))
        
        # Build PDF
        doc.build(self.story, onFirstPage=self._add_header_footer,
                  onLaterPages=self._add_header_footer)
        
        return output_path

    @staticmethod
    def _safe_float(value: Any, default: float = 0.0) -> float:
        """Safely parse a numeric value to float."""
        try:
            if value is None:
                return default
            return float(value)
        except (TypeError, ValueError):
            return default

    @staticmethod
    def _max_abs_values(values: Any) -> float:
        """Return max absolute value from scalar/list-like value."""
        if isinstance(values, (list, tuple)):
            if not values:
                return 0.0
            return max(abs(ReportGenerator._safe_float(v)) for v in values)
        return abs(ReportGenerator._safe_float(values))

    def _extract_member_force_extremes(self, forces: Dict[str, Any]) -> Dict[str, float]:
        """Extract robust force/moment envelopes from mixed payload shapes.

        Supports both frontend map styles:
        - scalar fields: axial, shearY, shearZ, momentY, momentZ, torsion
        - array fields: moment, shear, axial
        - distributed diagram arrays: diagramData.{moment_y, moment_z, shear_y, shear_z, axial, torsion}
        """
        diagram = forces.get('diagramData', {}) if isinstance(forces.get('diagramData'), dict) else {}

        axial_max = max(
            self._max_abs_values(forces.get('axial')),
            self._max_abs_values(diagram.get('axial')),
        )

        shear_y_max = max(
            self._max_abs_values(forces.get('shearY')),
            self._max_abs_values(diagram.get('shear_y')),
            self._max_abs_values(forces.get('shear')),
        )

        shear_z_max = max(
            self._max_abs_values(forces.get('shearZ')),
            self._max_abs_values(diagram.get('shear_z')),
        )

        moment_y_max = max(
            self._max_abs_values(forces.get('momentY')),
            self._max_abs_values(diagram.get('moment_y')),
            self._max_abs_values(forces.get('moment')),
        )

        moment_z_max = max(
            self._max_abs_values(forces.get('momentZ')),
            self._max_abs_values(diagram.get('moment_z')),
        )

        torsion_max = max(
            self._max_abs_values(forces.get('torsion')),
            self._max_abs_values(diagram.get('torsion')),
        )

        return {
            'axial': axial_max,
            'shear_y': shear_y_max,
            'shear_z': shear_z_max,
            'moment_y': moment_y_max,
            'moment_z': moment_z_max,
            'torsion': torsion_max,
        }
    
    def _add_cover_page(self):
        """Add cover page to report"""
        # Logo (if provided)
        if self.settings.company_logo:
            try:
                img = Image(self.settings.company_logo, width=2*inch, height=1*inch)
                self.story.append(img)
                self.story.append(Spacer(1, 20))
            except:
                pass
        
        # Company name
        self.story.append(Paragraph(
            self.settings.company_name,
            self.styles['CustomTitle']
        ))
        self.story.append(Spacer(1, 30))
        
        # Report title
        self.story.append(Paragraph(
            "STRUCTURAL ANALYSIS REPORT",
            self.styles['CustomHeading1']
        ))
        self.story.append(Spacer(1, 50))
        
        # Project details table
        project_data = [
            ['Project Name:', self.settings.project_name],
            ['Project Number:', self.settings.project_number or 'N/A'],
            ['Location:', self.settings.project_location or 'N/A'],
            ['Client:', self.settings.client_name or 'N/A'],
            ['Engineer:', self.settings.engineer_name or 'N/A'],
            ['Checked By:', self.settings.checked_by or 'N/A'],
            ['Date:', datetime.now().strftime('%B %d, %Y')],
        ]
        
        project_table = Table(project_data, colWidths=[2*inch, 4*inch])
        project_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (0, -1), colors.Color(*self.settings.primary_color, alpha=0.1)),
            ('TEXTCOLOR', (0, 0), (-1, -1), colors.black),
            ('ALIGN', (0, 0), (0, -1), 'RIGHT'),
            ('ALIGN', (1, 0), (1, -1), 'LEFT'),
            ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
            ('FONTNAME', (1, 0), (1, -1), 'Helvetica'),
            ('FONTSIZE', (0, 0), (-1, -1), 11),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 12),
            ('TOPPADDING', (0, 0), (-1, -1), 12),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
        ]))
        
        self.story.append(project_table)
        self.story.append(Spacer(1, 50))
        
        # Company contact info
        if self.settings.company_address or self.settings.company_phone:
            contact_text = []
            if self.settings.company_address:
                contact_text.append(self.settings.company_address)
            if self.settings.company_phone:
                contact_text.append(f"Phone: {self.settings.company_phone}")
            if self.settings.company_email:
                contact_text.append(f"Email: {self.settings.company_email}")
            
            contact_para = Paragraph(
                '<br/>'.join(contact_text),
                self.styles['Normal']
            )
            self.story.append(contact_para)
    
    def _add_input_summary(self, input_data: Dict[str, Any]):
        """Add input data summary section"""
        self.story.append(Paragraph(
            "1. INPUT SUMMARY",
            self.styles['CustomHeading1']
        ))
        self.story.append(Spacer(1, 12))
        
        # Model statistics
        nodes = input_data.get('nodes', [])
        members = input_data.get('members', [])
        loads = input_data.get('loads', [])
        
        stats_text = f"""
        <b>Model Statistics:</b><br/>
        • Total Nodes: {len(nodes)}<br/>
        • Total Members: {len(members)}<br/>
        • Total Loads: {len(loads)}<br/>
        • Analysis Type: 3D Frame Analysis<br/>
        """
        
        self.story.append(Paragraph(stats_text, self.styles['CustomBody']))
        self.story.append(Spacer(1, 12))
        
        # Nodes table
        if nodes and len(nodes) > 0:
            self.story.append(Paragraph(
                "1.1 Node Coordinates",
                self.styles['CustomHeading2']
            ))
            
            node_data = [['Node ID', 'X (m)', 'Y (m)', 'Z (m)', 'Support']]
            for node in nodes[:20]:  # Limit to first 20
                node_data.append([
                    str(node.get('id', '')),
                    f"{node.get('x', 0):.3f}",
                    f"{node.get('y', 0):.3f}",
                    f"{node.get('z', 0):.3f}",
                    node.get('support', 'Free')
                ])
            
            if len(nodes) > 20:
                node_data.append(['...', '...', '...', '...', '...'])
            
            node_table = Table(node_data, colWidths=[1.2*inch, 1*inch, 1*inch, 1*inch, 1.5*inch])
            node_table.setStyle(self._get_table_style())
            self.story.append(node_table)
            self.story.append(Spacer(1, 12))
        
        # Members table
        if members and len(members) > 0:
            self.story.append(Paragraph(
                "1.2 Members",
                self.styles['CustomHeading2']
            ))
            
            member_data = [['Member ID', 'Start Node', 'End Node', 'Section', 'Material']]
            for member in members[:20]:
                member_data.append([
                    str(member.get('id', '')),
                    str(member.get('startNodeId', '')),
                    str(member.get('endNodeId', '')),
                    member.get('section', 'ISMB 300'),
                    'IS 2062 Fe 410'
                ])
            
            if len(members) > 20:
                member_data.append(['...', '...', '...', '...', '...'])
            
            member_table = Table(member_data, colWidths=[1.2*inch, 1.2*inch, 1.2*inch, 1.5*inch, 1.5*inch])
            member_table.setStyle(self._get_table_style())
            self.story.append(member_table)

    def _add_load_data(self, analysis_data: Dict[str, Any]):
        """Add load case/combination summary based on available payload data."""
        self.story.append(Paragraph(
            "2. LOADS & COMBINATIONS",
            self.styles['CustomHeading1']
        ))
        self.story.append(Spacer(1, 12))

        input_data = analysis_data.get('input', {})
        raw_loads = input_data.get('loads', [])
        load_cases = analysis_data.get('load_cases', analysis_data.get('loadCases', []))
        load_combinations = analysis_data.get(
            'load_combinations',
            analysis_data.get('loadCombinations', [])
        )

        # Derive lightweight load case summary from raw load list if explicit load cases are absent.
        derived_case_count = 1 if raw_loads else 0
        case_count = len(load_cases) if isinstance(load_cases, list) else derived_case_count
        combination_count = len(load_combinations) if isinstance(load_combinations, list) else 0

        overview_text = (
            "<b>Load Methodology Overview:</b><br/>"
            "This analysis applies individual load cases (e.g., Dead Load, Live Load, Wind, Seismic) "
            "and their factored combinations per the governing code. Each member capacity check evaluates "
            "the most critical combination, and governing checks are identified by highest utilization ratio."
        )
        self.story.append(Paragraph(overview_text, self.styles['CustomBody']))
        self.story.append(Spacer(1, 8))

        self.story.append(Paragraph(
            (
                f"<b>Load Summary:</b><br/>"
                f"• Load Cases: {case_count}<br/>"
                f"• Load Combinations: {combination_count}<br/>"
                f"• Raw Load Entries: {len(raw_loads) if isinstance(raw_loads, list) else 0}<br/>"
                "• Units: Force = kN, Moment = kN·m"
            ),
            self.styles['CustomBody']
        ))
        self.story.append(Spacer(1, 12))

        if self.settings.include_load_cases and isinstance(load_cases, list) and load_cases:
            self.story.append(Paragraph("2.1 Load Cases", self.styles['CustomHeading2']))
            self.story.append(Paragraph(
                "Individual load cases are applied to the model independently and contribute to design load combinations.",
                self.styles['CustomBody']
            ))
            self.story.append(Spacer(1, 8))
            lc_rows = [['ID', 'Name', 'Type', 'Category']]
            for case in load_cases[:20]:
                if isinstance(case, dict):
                    lc_rows.append([
                        str(case.get('id', '')),
                        str(case.get('name', case.get('title', ''))),
                        str(case.get('type', case.get('category', ''))),
                        str(case.get('category', case.get('subtype', 'Standard'))),
                    ])

            if len(lc_rows) > 1:
                lc_table = Table(lc_rows, colWidths=[1.0*inch, 2.0*inch, 1.5*inch, 1.5*inch])
                lc_table.setStyle(self._get_table_style())
                self.story.append(lc_table)
                self.story.append(Spacer(1, 12))

        if self.settings.include_load_combinations and isinstance(load_combinations, list) and load_combinations:
            self.story.append(Paragraph("2.2 Load Combinations", self.styles['CustomHeading2']))
            self.story.append(Paragraph(
                "Factored load combinations per IS 875-Part 5 (LSM) or equivalent code. "
                "Each combination is evaluated for member strength checks; the combination producing "
                "the highest utilization ratio governs the design.",
                self.styles['CustomBody']
            ))
            self.story.append(Spacer(1, 8))
            combo_rows = [['ID', 'Name', 'Expression', 'Safety Class']]
            for combo in load_combinations[:20]:
                if isinstance(combo, dict):
                    safety_class = str(combo.get('safety_class', combo.get('limit_state', 'ULS')))
                    combo_rows.append([
                        str(combo.get('id', '')),
                        str(combo.get('name', combo.get('title', ''))),
                        str(combo.get('expression', combo.get('formula', ''))),
                        safety_class,
                    ])

            if len(combo_rows) > 1:
                combo_table = Table(combo_rows, colWidths=[1.0*inch, 1.5*inch, 2.5*inch, 1.0*inch])
                combo_table.setStyle(self._get_table_style())
                self.story.append(combo_table)
                self.story.append(Spacer(1, 12))
    
    def _add_analysis_results(self, results: Dict[str, Any]):
        """Add analysis results section"""
        self.story.append(Paragraph(
            "2. ANALYSIS RESULTS",
            self.styles['CustomHeading1']
        ))
        self.story.append(Spacer(1, 12))
        
        # Summary
        displacements = results.get('displacements', {})
        member_forces = results.get('memberForces', results.get('member_forces', {}))

        max_displacement = self._safe_float(results.get('max_displacement', 0))
        max_moment = self._safe_float(results.get('max_moment', 0))
        max_shear = self._safe_float(results.get('max_shear', 0))
        max_axial = self._safe_float(results.get('max_axial', 0))

        # Recompute envelopes from detailed fields when summary fields are absent/zero.
        if isinstance(displacements, dict):
            for disp in displacements.values():
                if not isinstance(disp, dict):
                    continue
                dx_m = self._safe_float(disp.get('dx', 0))
                dy_m = self._safe_float(disp.get('dy', 0))
                dz_m = self._safe_float(disp.get('dz', 0))
                total_mm = math.sqrt(dx_m * dx_m + dy_m * dy_m + dz_m * dz_m) * 1000.0
                max_displacement = max(max_displacement, total_mm)

        if isinstance(member_forces, dict):
            for forces in member_forces.values():
                if not isinstance(forces, dict):
                    continue
                extrema = self._extract_member_force_extremes(forces)
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
        
        # Node displacements
        if displacements:
            self.story.append(Paragraph(
                "2.1 Node Displacements",
                self.styles['CustomHeading2']
            ))
            
            disp_data = [['Node', '&delta;x (mm)', '&delta;y (mm)', '&delta;z (mm)', '&delta;total (mm)']]
            for node_id, disp in list(displacements.items())[:15]:
                dx = disp.get('dx', 0) * 1000  # Convert to mm
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
        
        # Member forces
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
                extrema = self._extract_member_force_extremes(forces)
                
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
                f"{self._safe_float(rxn.get('fx', 0)):.2f}",
                f"{self._safe_float(rxn.get('fy', 0)):.2f}",
                f"{self._safe_float(rxn.get('fz', 0)):.2f}",
                f"{self._safe_float(rxn.get('mx', 0)):.2f}",
                f"{self._safe_float(rxn.get('my', 0)):.2f}",
                f"{self._safe_float(rxn.get('mz', 0)):.2f}",
            ])

        if len(reaction_rows) > 1:
            table = Table(
                reaction_rows,
                colWidths=[0.9*inch, 0.85*inch, 0.85*inch, 0.85*inch, 1.0*inch, 1.0*inch, 1.0*inch]
            )
            table.setStyle(self._get_table_style())
            self.story.append(table)

    def _resolve_design_code(self, design_checks: Dict[str, Any]) -> str:
        """Resolve code label from payload with a stable fallback."""
        raw = str(
            design_checks.get('design_code')
            or design_checks.get('code')
            or design_checks.get('designCode')
            or 'IS 800:2007'
        ).strip()
        return raw or 'IS 800:2007'

    def _resolve_clause_reference(self, member: Dict[str, Any], design_code: str) -> str:
        """Resolve clause reference using explicit clause first, then check-key mapping."""
        explicit_clause = str(
            member.get('clause')
            or member.get('clause_reference')
            or member.get('clauseReference')
            or ''
        ).strip()
        if explicit_clause:
            return explicit_clause

        check_key = str(
            member.get('governing_check')
            or member.get('governingCheck')
            or member.get('check_key')
            or member.get('checkType')
            or ''
        ).strip()
        if check_key and check_key in CHECK_CLAUSE_MAP:
            return CHECK_CLAUSE_MAP[check_key]

        for code_key, default_clause in CODE_DEFAULT_CLAUSE.items():
            if code_key in design_code.upper():
                return default_clause

        return 'Code Clause: Refer governing design standard'

    def _resolve_member_status(self, utilization: float, member: Dict[str, Any]) -> str:
        """Resolve PASS/FAIL/WARNING status from explicit status or utilization."""
        raw_status = str(member.get('status', '')).strip().upper()
        if raw_status in {'PASS', 'FAIL', 'WARNING'}:
            return raw_status
        if utilization > 1.0:
            return 'FAIL'
        if utilization > 0.9:
            return 'WARNING'
        return 'PASS'

    def _normalize_design_check_row(self, member: Dict[str, Any], design_code: str) -> List[str]:
        """Normalize mixed design-check payload shapes into a printable row."""
        utilization = self._safe_float(
            member.get('utilization', member.get('ratio', member.get('dcr', 0.0))),
            0.0,
        )
        governing = str(
            member.get('governing_check')
            or member.get('governingCheck')
            or member.get('check_name')
            or member.get('checkType')
            or 'Strength Check'
        )
        clause = self._resolve_clause_reference(member, design_code)
        status = self._resolve_member_status(utilization, member)

        status_symbol = {
            'PASS': '✓ PASS',
            'FAIL': '✗ FAIL',
            'WARNING': '⚠ WARNING',
        }.get(status, status)

        return [
            str(member.get('id', '')),
            str(member.get('section', 'N/A')),
            governing,
            clause,
            f"{utilization * 100:.1f}%",
            status_symbol,
        ]

    def _build_governing_members_rows(
        self,
        members_to_check: List[Dict[str, Any]],
        design_code: str,
        max_rows: int = 8,
    ) -> List[List[str]]:
        """Build sorted governing-member rows by highest utilization ratio."""
        ranked: List[Dict[str, Any]] = []
        for member in members_to_check:
            if not isinstance(member, dict):
                continue
            utilization = self._safe_float(
                member.get('utilization', member.get('ratio', member.get('dcr', 0.0))),
                0.0,
            )
            ranked.append({"member": member, "utilization": utilization})

        ranked.sort(key=lambda x: x['utilization'], reverse=True)

        rows: List[List[str]] = []
        for item in ranked[:max_rows]:
            member = item['member']
            utilization = item['utilization']
            clause = self._resolve_clause_reference(member, design_code)
            reserve = 1.0 - utilization
            rows.append([
                str(member.get('id', '')),
                str(member.get('section', 'N/A')),
                clause,
                f"{utilization:.3f}",
                f"{reserve:.3f}",
            ])

        return rows

    def _build_critical_failure_rows(
        self,
        members_to_check: List[Dict[str, Any]],
        design_code: str,
        max_rows: int = 8,
    ) -> List[List[str]]:
        """Build rows for overstressed members only (D/C > 1.0), sorted by severity."""
        failing_rows = []
        ranked = self._build_governing_members_rows(
            members_to_check,
            design_code,
            max_rows=max(50, max_rows),
        )
        for row in ranked:
            dc_ratio = self._safe_float(row[3], 0.0)
            if dc_ratio > 1.0:
                failing_rows.append(row)
            if len(failing_rows) >= max_rows:
                break
        return failing_rows
    
    def _add_design_checks(self, design_checks: Dict[str, Any]):
        """Add design check section (IS 800 compliance)"""
        design_code = self._resolve_design_code(design_checks)
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
        
        # Design check results table
        check_data = [['Member', 'Section', 'Governing Check', 'Clause Reference', 'Utilization', 'Status']]
        
        # Member-level checks from payload
        members_to_check = design_checks.get('members', [])
        if isinstance(members_to_check, list):
            for member in members_to_check[:20]:
                if not isinstance(member, dict):
                    continue
                check_data.append(self._normalize_design_check_row(member, design_code))
        
        if len(check_data) > 1:
            check_table = Table(
                check_data,
                colWidths=[0.8*inch, 1.1*inch, 1.6*inch, 2.2*inch, 0.8*inch, 0.9*inch]
            )
            check_table.setStyle(self._get_table_style())
            self.story.append(check_table)

            # Governing members summary (highest utilization first)
            governing_rows = self._build_governing_members_rows(members_to_check, design_code)
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

                critical_rows = self._build_critical_failure_rows(members_to_check, design_code)
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
        """Add diagrams section with generated images"""
        self.story.append(PageBreak())
        self.story.append(Paragraph(
            "4. DIAGRAMS",
            self.styles['CustomHeading1']
        ))
        self.story.append(Spacer(1, 12))
        
        # We will generate simplified diagrams using matplotlib
        # In a real app, you might pass base64 images from frontend
        # but here we generate them from analysis data for better quality
        try:
            import matplotlib.pyplot as plt
            import numpy as np
            from io import BytesIO
            
            # Simple 3D Model View (XY Projection)
            nodes = diagrams.get('nodes', [])
            members = diagrams.get('members', [])
            
            if nodes:
                plt.figure(figsize=(6, 4), dpi=300) # High DPI for clarity
                
                # Plot members
                for member in members:
                    start = next((n for n in nodes if n['id'] == member['startNodeId']), None)
                    end = next((n for n in nodes if n['id'] == member['endNodeId']), None)
                    if start and end:
                        plt.plot([start['x'], end['x']], [start['y'], end['y']], 'k-', linewidth=1.5)
                
                # Plot nodes
                x_coords = [n['x'] for n in nodes]
                y_coords = [n['y'] for n in nodes]
                plt.plot(x_coords, y_coords, 'bo', markersize=4)
                
                # Add node labels with readable font
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
                
                # Save to buffer
                img_buffer = BytesIO()
                plt.savefig(img_buffer, format='png', bbox_inches='tight')
                img_buffer.seek(0)
                plt.close()
                
                # Add to report
                img = Image(img_buffer, width=5*inch, height=3.5*inch)
                self.story.append(img)
                self.story.append(Paragraph("Figure 4.1: Structural Geometry", self.styles['CustomBody']))
                self.story.append(Spacer(1, 20))

        except Exception as e:
            self.story.append(Paragraph(f"Could not generate diagrams: {str(e)}", self.styles['CustomBody']))

    
    def _get_table_style(self) -> TableStyle:
        """Get standard table style"""
        return TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.Color(*self.settings.primary_color)),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 10),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
            ('BACKGROUND', (0, 1), (-1, -1), colors.white),
            ('TEXTCOLOR', (0, 1), (-1, -1), colors.black),
            ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
            ('FONTSIZE', (0, 1), (-1, -1), 9),
            ('GRID', (0, 0), (-1, -1), 1, colors.grey),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.Color(0.95, 0.95, 0.95)]),
        ])
    
    def _get_critical_failures_table_style(self) -> TableStyle:
        """Get table style for critical failures (red-accent for high visibility)"""
        return TableStyle([
            # Red header for warning emphasis
            ('BACKGROUND', (0, 0), (-1, 0), colors.Color(0.8, 0.2, 0.2)),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 10),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
            # Light red row backgrounds for data rows
            ('BACKGROUND', (0, 1), (-1, -1), colors.white),
            ('TEXTCOLOR', (0, 1), (-1, -1), colors.black),
            ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
            ('FONTSIZE', (0, 1), (-1, -1), 9),
            # Alternating rows with light pink tint
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [
                colors.white,
                colors.Color(1.0, 0.95, 0.95)  # Very light red
            ]),
            ('GRID', (0, 0), (-1, -1), 1, colors.Color(0.8, 0.2, 0.2, alpha=0.5)),  # Red grid
        ])
    
    def _add_header_footer(self, canvas, doc):
        """Add header and footer to each page"""
        if not self.settings.header_footer:
            return
        
        canvas.saveState()
        
        # Header
        canvas.setFont('Helvetica-Bold', 9)
        canvas.setFillColor(colors.Color(*self.settings.secondary_color))
        canvas.drawString(72, A4[1] - 50, self.settings.project_name)
        
        # Footer
        canvas.setFont('Helvetica', 8)
        canvas.drawString(72, 50, self.settings.company_name)
        
        if self.settings.page_numbers:
            canvas.drawRightString(A4[0] - 72, 50, f"Page {doc.page}")
        
        canvas.restoreState()


# ============================================
# USAGE EXAMPLE
# ============================================

if __name__ == "__main__":
    # Example usage
    settings = ReportSettings(
        company_name="BeamLab ULTIMATE",
        project_name="Multi-Story Frame Analysis",
        engineer_name="John Doe, P.E.",
        project_number="2026-001"
    )
    
    generator = ReportGenerator(settings)
    
    # Sample analysis data
    analysis_data = {
        'input': {
            'nodes': [
                {'id': 'N1', 'x': 0, 'y': 0, 'z': 0, 'support': 'Fixed'},
                {'id': 'N2', 'x': 5, 'y': 0, 'z': 0, 'support': 'Free'},
            ],
            'members': [
                {'id': 'M1', 'startNodeId': 'N1', 'endNodeId': 'N2', 'section': 'ISMB 300'}
            ],
            'loads': []
        },
        'results': {
            'success': True,
            'max_displacement': 12.5,
            'max_moment': 45.2,
            'max_shear': 25.0,
            'max_axial': 150.0,
            'displacements': {
                'N1': {'dx': 0, 'dy': 0, 'dz': 0},
                'N2': {'dx': 0.002, 'dy': -0.0125, 'dz': 0}
            },
            'memberForces': {
                'M1': {'moment': [0, 45.2], 'shear': [25, -25], 'axial': 150}
            }
        },
        'design_checks': {
            'members': [
                {'id': 'M1', 'section': 'ISMB 300', 'utilization': 0.75}
            ]
        }
    }
    
    output = generator.generate_report(analysis_data, "test_report.pdf")
    print(f"Report generated: {output}")
