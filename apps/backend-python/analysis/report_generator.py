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


@dataclass
class ReportSettings:
    """Settings for report customization"""
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
    include_input_summary: bool = True
    include_analysis_results: bool = True
    include_design_checks: bool = True
    include_diagrams: bool = True
    include_appendix: bool = False
    
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
        
        if self.settings.include_analysis_results:
            self._add_analysis_results(analysis_data.get('results', {}))
            self.story.append(PageBreak())
        
        if self.settings.include_design_checks:
            self._add_design_checks(analysis_data.get('design_checks', {}))
        
        if self.settings.include_diagrams:
            self._add_diagrams(analysis_data.get('diagrams', {}))
        
        # Build PDF
        doc.build(self.story, onFirstPage=self._add_header_footer,
                  onLaterPages=self._add_header_footer)
        
        return output_path
    
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
    
    def _add_analysis_results(self, results: Dict[str, Any]):
        """Add analysis results section"""
        self.story.append(Paragraph(
            "2. ANALYSIS RESULTS",
            self.styles['CustomHeading1']
        ))
        self.story.append(Spacer(1, 12))
        
        # Summary
        max_displacement = results.get('max_displacement', 0)
        max_moment = results.get('max_moment', 0)
        max_shear = results.get('max_shear', 0)
        max_axial = results.get('max_axial', 0)
        
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
        displacements = results.get('displacements', {})
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
        member_forces = results.get('memberForces', {})
        if member_forces:
            self.story.append(Paragraph(
                "2.2 Member Forces",
                self.styles['CustomHeading2']
            ))
            
            force_data = [['Member', 'Moment Mz (kN·m)', 'Shear V (kN)', 'Axial P (kN)']]
            for member_id, forces in list(member_forces.items())[:15]:
                max_m = max(abs(forces.get('moment', [])), default=0) if isinstance(forces.get('moment'), list) else 0
                max_v = max(abs(forces.get('shear', [])), default=0) if isinstance(forces.get('shear'), list) else 0
                axial = forces.get('axial', 0)
                
                force_data.append([
                    str(member_id),
                    f"{max_m:.2f}",
                    f"{max_v:.2f}",
                    f"{axial:.2f}"
                ])
            
            force_table = Table(force_data, colWidths=[1.5*inch, 1.5*inch, 1.5*inch, 1.5*inch])
            force_table.setStyle(self._get_table_style())
            self.story.append(force_table)
    
    def _add_design_checks(self, design_checks: Dict[str, Any]):
        """Add design check section (IS 800 compliance)"""
        self.story.append(Paragraph(
            "3. DESIGN CHECKS (IS 800:2007)",
            self.styles['CustomHeading1']
        ))
        self.story.append(Spacer(1, 12))
        
        checks_text = """
        <b>Code Compliance:</b><br/>
        • Design Code: IS 800:2007 (Indian Standard)<br/>
        • Material: IS 2062 Fe 410 (fy = 250 MPa)<br/>
        • Partial Safety Factor: γm0 = 1.10<br/>
        • Load Combinations: As per IS 875 (Part 5)<br/>
        """
        
        self.story.append(Paragraph(checks_text, self.styles['CustomBody']))
        self.story.append(Spacer(1, 12))
        
        # Design check results table
        check_data = [['Member', 'Section', 'Utilization', 'Status']]
        
        # Example checks (would come from actual design calculations)
        members_to_check = design_checks.get('members', [])
        for member in members_to_check[:15]:
            check_data.append([
                member.get('id', ''),
                member.get('section', 'ISMB 300'),
                f"{member.get('utilization', 0.75)*100:.1f}%",
                '✓ PASS' if member.get('utilization', 0) < 1.0 else '✗ FAIL'
            ])
        
        if check_data:
            check_table = Table(check_data, colWidths=[1.5*inch, 1.5*inch, 1.5*inch, 1.5*inch])
            check_table.setStyle(self._get_table_style())
            self.story.append(check_table)
    
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
