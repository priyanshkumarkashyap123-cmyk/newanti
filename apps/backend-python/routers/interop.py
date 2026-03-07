"""
Interop Router - STAAD/DXF/JSON Import/Export Endpoints

Wires the analysis/interop.py classes (STAADImporter, STAADExporter,
DXFImporter, JSONModelIO, ExcelExporter) to REST endpoints that the
Node.js API proxy forwards to.

Node proxy paths → Python paths:
  POST /interop/staad/import  → parse .std content → JSON model
  POST /interop/staad/export  → JSON model → .std content
  POST /interop/dxf/import    → parse DXF content → JSON model
  POST /interop/json/import   → parse JSON content → validated model
  POST /interop/json/export   → model → formatted JSON string
  POST /interop/csv/export    → model → CSV content (nodes + members)
  GET  /interop/formats       → supported format list
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, Dict, Any, List
from dataclasses import asdict
import traceback

from analysis.interop import (
    STAADImporter,
    STAADExporter,
    DXFImporter,
    JSONModelIO,
    ExcelExporter,
    StructuralModel,
    Node,
    Member,
    LoadCase,
    NodalLoad,
    MemberLoad,
    ReportDataGenerator,
)

router = APIRouter(prefix="/interop", tags=["Interop"])


# ── Request / Response Models ──

class STAADImportRequest(BaseModel):
    content: str  # Raw .std file content


class STAADExportRequest(BaseModel):
    model: Dict[str, Any]  # JSON model dict


class DXFImportRequest(BaseModel):
    content: str  # Raw DXF file content


class JSONImportRequest(BaseModel):
    content: str  # JSON string of a model


class CSVExportRequest(BaseModel):
    model: Dict[str, Any]


# ── Helpers ──

def _dict_to_model(d: Dict[str, Any]) -> StructuralModel:
    """Convert a raw dict (from JSON body) into a StructuralModel dataclass."""
    return StructuralModel(
        title=d.get("title", "Untitled"),
        units=d.get("units", "SI"),
        nodes=[Node(**n) for n in d.get("nodes", [])],
        members=[Member(**m) for m in d.get("members", [])],
        load_cases=[LoadCase(**lc) for lc in d.get("load_cases", [])],
        nodal_loads=[NodalLoad(**nl) for nl in d.get("nodal_loads", [])],
        member_loads=[MemberLoad(**ml) for ml in d.get("member_loads", [])],
    )


def _model_to_dict(model: StructuralModel) -> Dict[str, Any]:
    """Serialize a StructuralModel to a plain dict."""
    return {
        "title": model.title,
        "units": model.units,
        "nodes": [asdict(n) for n in model.nodes],
        "members": [asdict(m) for m in model.members],
        "load_cases": [asdict(lc) for lc in model.load_cases],
        "nodal_loads": [asdict(nl) for nl in model.nodal_loads],
        "member_loads": [asdict(ml) for ml in model.member_loads],
    }


# ============================================
# POST /interop/staad/import
# ============================================

@router.post("/staad/import")
async def staad_import(req: STAADImportRequest):
    """Parse a STAAD.Pro .std file and return the model as JSON."""
    try:
        importer = STAADImporter()
        model = importer.parse(req.content)
        model_dict = _model_to_dict(model)

        # Attach geometry summary for convenience
        summary = ReportDataGenerator.generate_geometry_summary(model)

        return {
            "success": True,
            "model": model_dict,
            "summary": summary,
            "format": "staad",
        }
    except Exception as exc:
        raise HTTPException(
            status_code=422,
            detail=f"Failed to parse STAAD file: {str(exc)}",
        )


# ============================================
# POST /interop/staad/export
# ============================================

@router.post("/staad/export")
async def staad_export(req: STAADExportRequest):
    """Convert a JSON model to STAAD.Pro .std format string."""
    try:
        model = _dict_to_model(req.model)
        exporter = STAADExporter()
        std_content = exporter.export(model)

        return {
            "success": True,
            "content": std_content,
            "format": "staad",
            "lines": std_content.count("\n") + 1,
        }
    except Exception as exc:
        raise HTTPException(
            status_code=422,
            detail=f"Failed to export STAAD file: {str(exc)}",
        )


# ============================================
# POST /interop/dxf/import
# ============================================

@router.post("/dxf/import")
async def dxf_import(req: DXFImportRequest):
    """Parse a DXF file and return extracted nodes/members."""
    try:
        importer = DXFImporter()
        nodes, members = importer.parse(req.content)

        return {
            "success": True,
            "model": {
                "title": "DXF Import",
                "units": "SI",
                "nodes": [asdict(n) for n in nodes],
                "members": [asdict(m) for m in members],
                "load_cases": [],
                "nodal_loads": [],
                "member_loads": [],
            },
            "summary": {
                "node_count": len(nodes),
                "member_count": len(members),
            },
            "format": "dxf",
        }
    except Exception as exc:
        raise HTTPException(
            status_code=422,
            detail=f"Failed to parse DXF file: {str(exc)}",
        )


# ============================================
# POST /interop/json/import
# ============================================

@router.post("/json/import")
async def json_import(req: JSONImportRequest):
    """Import and validate a JSON model string."""
    try:
        model = JSONModelIO.import_model(req.content)
        model_dict = _model_to_dict(model)
        summary = ReportDataGenerator.generate_geometry_summary(model)

        return {
            "success": True,
            "model": model_dict,
            "summary": summary,
            "format": "json",
        }
    except Exception as exc:
        raise HTTPException(
            status_code=422,
            detail=f"Failed to parse JSON model: {str(exc)}",
        )


# ============================================
# POST /interop/json/export
# ============================================

@router.post("/json/export")
async def json_export(req: STAADExportRequest):
    """Export model to formatted JSON string."""
    try:
        model = _dict_to_model(req.model)
        json_content = JSONModelIO.export_model(model)

        return {
            "success": True,
            "content": json_content,
            "format": "json",
        }
    except Exception as exc:
        raise HTTPException(
            status_code=422,
            detail=f"Failed to export JSON: {str(exc)}",
        )


# ============================================
# POST /interop/csv/export
# ============================================

@router.post("/csv/export")
async def csv_export(req: CSVExportRequest):
    """Export model nodes and members as CSV."""
    try:
        model = _dict_to_model(req.model)

        nodes_csv = ExcelExporter.export_nodes(model.nodes)
        members_csv = ExcelExporter.export_members(model.members)

        return {
            "success": True,
            "nodes_csv": nodes_csv,
            "members_csv": members_csv,
            "format": "csv",
        }
    except Exception as exc:
        raise HTTPException(
            status_code=422,
            detail=f"Failed to export CSV: {str(exc)}",
        )


# ============================================
# GET /interop/formats
# ============================================

@router.get("/formats")
async def supported_formats():
    """Return the list of supported import/export formats."""
    return {
        "import": [
            {"id": "json", "name": "JSON Model", "extension": ".json", "description": "BeamLab native format"},
            {"id": "std", "name": "STAAD.Pro", "extension": ".std", "description": "STAAD.Pro input file"},
            {"id": "dxf", "name": "AutoCAD DXF", "extension": ".dxf", "description": "DXF geometry (LINE entities)"},
        ],
        "export": [
            {"id": "json", "name": "JSON Model", "extension": ".json", "description": "BeamLab native format"},
            {"id": "std", "name": "STAAD.Pro", "extension": ".std", "description": "STAAD.Pro input file"},
            {"id": "csv", "name": "CSV", "extension": ".csv", "description": "Comma-separated values"},
            {"id": "pdf", "name": "PDF Report", "extension": ".pdf", "description": "Analysis report (via /reports)"},
        ],
    }
