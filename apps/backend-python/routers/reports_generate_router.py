"""
Report generation endpoints (simple + advanced) with profile application.
"""

from fastapi import APIRouter, HTTPException
from typing import Any
import asyncio
import traceback
import base64
from datetime import datetime

from .reports_schemas import ReportRequest, GenerateReportRequest, ReportCustomization
from .reports_utils import apply_profile_to_customization

router = APIRouter(prefix="/reports", tags=["Reports"])


@router.post("/generate-simple")
async def generate_report_endpoint(request: ReportRequest):
    """Generate simple PDF report using ReportLab. Returns base64 encoded PDF."""
    try:
        from analysis.report_generator import ReportGenerator, ReportSettings
        import tempfile
        import os

        settings_dict = request.settings
        settings = ReportSettings(
            company_name=settings_dict.get('company_name', 'BeamLab Ultimate'),
            project_name=settings_dict.get('project_name', 'Structural Analysis'),
            engineer_name=settings_dict.get('engineer_name', ''),
            project_number=settings_dict.get('job_number', settings_dict.get('project_number', ''))
        )

        for k, v in settings_dict.items():
            if hasattr(settings, k):
                setattr(settings, k, v)

        generator = ReportGenerator(settings)

        output_path = None
        try:
            with tempfile.NamedTemporaryFile(suffix='.pdf', delete=False) as tmp:
                output_path = tmp.name

            await asyncio.to_thread(generator.generate_report, request.analysis_data, output_path)

            with open(output_path, "rb") as f:
                pdf_bytes = f.read()
                pdf_base64 = base64.b64encode(pdf_bytes).decode('utf-8')

            return {
                "success": True,
                "pdf_base64": pdf_base64,
                "filename": f"{settings.project_name.replace(' ', '_')}_Report.pdf"
            }
        finally:
            if output_path and os.path.exists(output_path):
                os.unlink(output_path)

    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="Report generation failed")


@router.post("/generate")
async def generate_pdf_report(request: GenerateReportRequest):
    """Generate professional PDF report from analysis results.

    If a profile is specified, applies profile-based section and diagram toggles.
    Otherwise, uses customization toggles as-is for backward compatibility.
    """
    try:
        from analysis.report_generator import ReportGenerator, ReportSettings
        from fastapi.responses import FileResponse
        from starlette.background import BackgroundTask
        import tempfile
        import os

        customization = request.customization or ReportCustomization()

        customization = apply_profile_to_customization(customization)

        settings = ReportSettings(
            company_name=customization.company_name,
            company_address=customization.company_address,
            company_phone=customization.company_phone,
            company_email=customization.company_email,
            project_name=customization.project_name,
            project_number=customization.project_number,
            project_location=customization.project_location,
            client_name=customization.client_name,
            engineer_name=customization.engineer_name,
            checked_by=customization.checked_by,
            include_cover_page=customization.include_cover_page,
            include_toc=customization.include_toc,
            include_input_summary=customization.include_input_summary,
            include_load_cases=customization.include_load_cases,
            include_load_combinations=customization.include_load_combinations,
            include_node_displacements=customization.include_node_displacements,
            include_member_forces=customization.include_member_forces,
            include_reaction_summary=customization.include_reaction_summary,
            include_analysis_results=customization.include_analysis_results,
            include_design_checks=customization.include_design_checks,
            include_diagrams=customization.include_diagrams,
            include_concrete_design=customization.include_concrete_design,
            include_foundation_design=customization.include_foundation_design,
            include_connection_design=customization.include_connection_design,
            include_sfd=customization.include_sfd,
            include_bmd=customization.include_bmd,
            include_deflection=customization.include_deflection,
            include_afd=customization.include_afd,
            include_bmd_my=customization.include_bmd_my,
            include_shear_z=customization.include_shear_z,
            selected_load_case_id=customization.selected_load_case_id,
            minimal_metadata=customization.minimal_metadata,
            primary_color=tuple(customization.primary_color),
            page_size=customization.page_size
        )

        generator = ReportGenerator(settings)

        output_path = None
        try:
            with tempfile.NamedTemporaryFile(delete=False, suffix='.pdf') as tmp:
                output_path = tmp.name

            await asyncio.to_thread(generator.generate_report, request.analysis_data, output_path)

            filename = f"{customization.project_name.replace(' ', '_')}_Report_{datetime.now().strftime('%Y%m%d')}.pdf"

            return FileResponse(
                output_path,
                media_type='application/pdf',
                filename=filename,
                headers={"Content-Disposition": f"attachment; filename={filename}"},
                background=BackgroundTask(os.unlink, output_path),
            )
        except Exception:
            if output_path and os.path.exists(output_path):
                os.unlink(output_path)
            raise

    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="Report generation failed")
