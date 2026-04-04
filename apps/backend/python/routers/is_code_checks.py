"""
IS Code Design Checks & Model Validation Endpoints
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, ConfigDict, Field
from typing import Optional, List, Dict, Any
import asyncio
import os
import httpx

router = APIRouter(tags=["IS Codes Design"])

RUST_API_URL = os.getenv("RUST_API_URL", "http://localhost:3002").rstrip("/")
RUST_API_TIMEOUT = float(os.getenv("RUST_API_TIMEOUT", "120"))


async def _rust_post(path: str, payload: Dict[str, Any]) -> Dict[str, Any]:
    """Forward request to Rust API and return JSON response."""
    url = f"{RUST_API_URL}{path}"
    try:
        async with httpx.AsyncClient(timeout=RUST_API_TIMEOUT) as client:
            resp = await client.post(url, json=payload)
        if resp.status_code >= 400:
            detail = resp.text[:1000]
            raise HTTPException(
                status_code=resp.status_code,
                detail=f"Rust API error at {path}: {detail}",
            )
        return resp.json()
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Rust API unavailable: {e}")


# ── Request Models ──

class SteelDesignRequest(BaseModel):
    section: str = "ISMB300"
    grade: str = "E250"
    Pu: float = 0
    Mux: float = 0
    Muy: float = 0
    Lx: float = 3000
    Ly: float = 3000
    Lb: float = 3000


class FloorLoadRequest(BaseModel):
    occupancy: str = "residential"
    slabThickness: float = 150
    floorFinish: str = "tiles"
    area: float = 20
    floors: int = 1


class WindLoadRequest(BaseModel):
    city: str = "Mumbai"
    windSpeed: float = 44
    height: float = 10
    terrainCategory: int = 2


class ConcreteDesignRequest(BaseModel):
    b: float = 230
    D: float = 450
    cover: float = 25
    fck: str = "M20"
    fy: str = "Fe415"
    Mu: float = 50


class SeismicLoadRequest(BaseModel):
    weight: float = 1000
    height: float = 12
    zone: str = "III"
    soilType: int = 2


class ColumnBiaxialRequest(BaseModel):
    b: float = 300
    D: float = 400
    fck: str = "M25"
    fy: str = "Fe415"
    Pu: float = 800
    Mux: float = 60
    Muy: float = 40
    Ast: float = 2400
    d_dash: float = 40
    Leff_x: float = 0
    Leff_y: float = 0


class BoltDesignRequest(BaseModel):
    bolt_dia: float = 20
    bolt_grade: str = "4.6"
    plate_fu: float = 410
    plate_thk: float = 10
    n_bolts: int = 4
    n_shear_planes: int = 1
    edge_dist: float = 40
    pitch: float = 60


class WeldDesignRequest(BaseModel):
    weld_size: float = 6
    weld_length: float = 200
    weld_fu: float = 410
    load_kN: float = 80


class AutoSelectRequest(BaseModel):
    steel_grade: str = "E250"
    Pu: float = 0
    Mux: float = 0
    Muy: float = 0
    Vu: float = 0
    Lx: float = 3000
    Ly: float = 3000
    Lb: float = 3000


class EQForceRequest(BaseModel):
    node_weights: List[Dict[str, Any]]  # [{node_id, weight_kN, height_m}]
    zone: str = "III"
    soilType: int = 2
    importance_factor: float = 1.2
    response_reduction: float = 5.0
    building_type: str = "rc_frame"
    direction: str = "X"


class WindPerStoreyRequest(BaseModel):
    windSpeed: float = 47
    storey_heights: List[float]  # [3.5, 7.0, 10.5, ...]
    tributary_width: float = 15
    terrainCategory: int = 2
    Cf: float = 1.3


class ServiceabilityCheckRequest(BaseModel):
    checks: List[Dict[str, Any]]  # each dict needs 'type': deflection|vibration|crack|drift


class ValidateModelRequest(BaseModel):
    """Constrained model for structural validation requests."""
    nodes: List[Dict[str, Any]] = Field(..., max_length=50000)
    members: List[Dict[str, Any]] = Field(default=[], max_length=50000)
    loads: List[Dict[str, Any]] = Field(default=[], max_length=50000)
    node_loads: List[Dict[str, Any]] = Field(default=[], max_length=50000)
    distributed_loads: List[Dict[str, Any]] = Field(default=[], max_length=50000)
    supports: List[Dict[str, Any]] = Field(default=[], max_length=50000)

    model_config = ConfigDict(extra="allow")


# ── Endpoints ──

@router.post("/analyze/validate", tags=["Advanced Analysis"])
async def validate_structure_model(request: ValidateModelRequest):
    """Validate structural model before analysis."""
    try:
        from analysis.model_validator import validate_model
        return await asyncio.to_thread(validate_model, request.model_dump())
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/design/steel/check")
async def check_steel_member(request: SteelDesignRequest):
    """Check steel member via Rust auto-select/capacity path (IS 800)."""
    fy = 250.0
    if "350" in request.grade.upper():
        fy = 350.0
    elif "410" in request.grade.upper():
        fy = 410.0

    return await _rust_post("/api/design/is800/auto-select", {
        "fy": fy,
        "pu_kn": request.Pu,
        "mux_knm": request.Mux,
        "muy_knm": request.Muy,
        "vu_kn": 0.0,
        "lx_mm": request.Lx,
        "ly_mm": request.Ly,
    })


@router.post("/design/loads/floor")
async def generate_floor_loads(request: FloorLoadRequest):
    """Calculate floor live load and reduction via Rust IS 875 APIs."""
    live = await _rust_post("/api/design/is875/live-load", {
        "occupancy": request.occupancy,
    })
    reduction = await _rust_post("/api/design/is875/live-load-reduction", {
        "tributary_area": request.area,
        "num_floors": request.floors,
    })
    return {
        "occupancy": request.occupancy,
        "live_load_kN_m2": live.get("live_load_kN_m2"),
        "reduction_factor": reduction.get("reduction_factor"),
    }


@router.post("/design/loads/wind")
async def generate_wind_loads(request: WindLoadRequest):
    """Calculate wind loads via Rust IS 875 storey force API."""
    terrain = str(request.terrainCategory)
    return await _rust_post("/api/design/is875/wind-per-storey", {
        "vb": request.windSpeed,
        "storey_heights": [request.height],
        "tributary_width": 1.0,
        "terrain": terrain,
        "cf": 1.3,
        "k1": 1.0,
        "k3": 1.0,
    })


@router.post("/design/concrete/beam")
async def design_concrete_beam(request: ConcreteDesignRequest):
    """Concrete beam flexural capacity check via Rust IS 456 API."""
    fck_val = float(request.fck.upper().replace("M", "")) if isinstance(request.fck, str) else float(request.fck)
    fy_val = float(request.fy.upper().replace("FE", "")) if isinstance(request.fy, str) else float(request.fy)
    d_eff = request.D - request.cover
    # estimate tension steel from demand so Rust can evaluate capacity path
    ast_est = max((request.Mu * 1e6) / (0.87 * fy_val * 0.9 * d_eff), 1.0)
    return await _rust_post("/api/design/is456/flexural-capacity", {
        "b": request.b,
        "d": d_eff,
        "fck": fck_val,
        "fy": fy_val,
        "ast": ast_est,
    })


@router.post("/design/loads/seismic")
async def calculate_seismic_loads(request: SeismicLoadRequest):
    """Calculate seismic base shear via Rust IS 1893 API."""
    soil_map = {1: "hard", 2: "medium", 3: "soft"}
    # RC moment frame approximation (IS 1893): Ta ≈ 0.075 h^0.75
    period = max(0.1, 0.075 * (request.height ** 0.75))
    return await _rust_post("/api/design/is1893/base-shear", {
        "zone": request.zone,
        "soil": soil_map.get(request.soilType, "medium"),
        "importance": 1.0,
        "response_reduction": 5.0,
        "period": period,
        "seismic_weight_kn": request.weight,
    })


# ── New Enhanced Endpoints ──

@router.post("/design/concrete/column-biaxial")
async def check_biaxial_column(request: ColumnBiaxialRequest):
    """Biaxial column check per IS 456 Cl. 39.6 (Bresler)."""
    fck_val = float(request.fck.upper().replace("M", "")) if isinstance(request.fck, str) else float(request.fck)
    fy_val = float(request.fy.upper().replace("FE", "")) if isinstance(request.fy, str) else float(request.fy)
    return await _rust_post("/api/design/is456/biaxial-column", {
        "b": request.b,
        "d": request.D,
        "fck": fck_val,
        "fy": fy_val,
        "pu_kn": request.Pu,
        "mux_knm": request.Mux,
        "muy_knm": request.Muy,
        "ast_total": request.Ast,
        "d_dash": request.d_dash,
        "leff_x": request.Leff_x,
        "leff_y": request.Leff_y,
    })


@router.post("/design/steel/bolt")
async def design_bolt_connection(request: BoltDesignRequest):
    """Bearing bolt design per IS 800 Cl. 10.3."""
    return await _rust_post("/api/design/is800/bolt-bearing", {
        "bolt_dia": request.bolt_dia,
        "grade": request.bolt_grade,
        "plate_fu": request.plate_fu,
        "plate_thk": request.plate_thk,
        "n_bolts": request.n_bolts,
        "n_shear_planes": request.n_shear_planes,
        "edge_dist": request.edge_dist,
        "pitch": request.pitch,
    })


@router.post("/design/steel/weld")
async def design_weld_connection(request: WeldDesignRequest):
    """Fillet weld design per IS 800 Cl. 10.5."""
    return await _rust_post("/api/design/is800/fillet-weld", {
        "weld_size": request.weld_size,
        "weld_length": request.weld_length,
        "weld_fu": request.weld_fu,
        "load_kn": request.load_kN,
    })


@router.post("/design/steel/auto-select")
async def auto_select_steel_section(request: AutoSelectRequest):
    """Auto-select lightest ISMB section per IS 800."""
    fy = 250.0
    if "350" in request.steel_grade.upper():
        fy = 350.0
    elif "410" in request.steel_grade.upper():
        fy = 410.0
    return await _rust_post("/api/design/is800/auto-select", {
        "fy": fy,
        "pu_kn": request.Pu,
        "mux_knm": request.Mux,
        "muy_knm": request.Muy,
        "vu_kn": request.Vu,
        "lx_mm": request.Lx,
        "ly_mm": request.Ly,
    })


@router.post("/design/loads/seismic/forces")
async def generate_seismic_forces(request: EQForceRequest):
    """Generate equivalent lateral forces per IS 1893."""
    soil_map = {1: "hard", 2: "medium", 3: "soft"}
    base_dim = 10.0
    if request.node_weights:
        h_max = max(float(n.get("height_m", 0.0)) for n in request.node_weights)
        base_dim = max(h_max / 3.0, 5.0)
    return await _rust_post("/api/design/is1893/eq-forces", {
        "node_weights": request.node_weights,
        "zone": request.zone,
        "soil": soil_map.get(request.soilType, "medium"),
        "importance": request.importance_factor,
        "response_reduction": request.response_reduction,
        "building_type": request.building_type,
        "base_dimension": base_dim,
        "direction": request.direction.lower(),
    })


@router.post("/design/loads/wind/storey")
async def generate_wind_per_storey(request: WindPerStoreyRequest):
    """Generate wind force per storey per IS 875 Part 3."""
    terrain = str(request.terrainCategory)
    result = await _rust_post("/api/design/is875/wind-per-storey", {
        "vb": request.windSpeed,
        "storey_heights": request.storey_heights,
        "tributary_width": request.tributary_width,
        "terrain": terrain,
        "cf": request.Cf,
        "k1": 1.0,
        "k3": 1.0,
    })
    if isinstance(result, list):
        total = sum(float(f.get("force_kn", 0.0)) for f in result)
        return {"forces": result, "total_base_shear_kN": round(total, 2)}
    return result


@router.post("/design/serviceability")
async def run_serviceability_checks(request: ServiceabilityCheckRequest):
    """Run batch serviceability checks (deflection, vibration, crack, drift)."""
    results = []
    for chk in request.checks:
        ctype = str(chk.get("type", "")).lower()
        if ctype == "deflection":
            out = await _rust_post("/api/design/serviceability/deflection", {
                "material": chk.get("material", "steel"),
                "span_mm": chk.get("span_mm", 0.0),
                "actual_deflection_mm": chk.get("actual_deflection_mm", 0.0),
                "member_type": chk.get("member_type", "beam"),
                "load_type": chk.get("load_type", "live"),
                "support_condition": chk.get("support_condition", "simply_supported"),
            })
        elif ctype == "vibration":
            out = await _rust_post("/api/design/serviceability/vibration", {
                "frequency_hz": chk.get("frequency_hz", 0.0),
                "occupancy": chk.get("occupancy", "office"),
            })
        elif ctype in {"crack", "crack_width"}:
            out = await _rust_post("/api/design/serviceability/crack-width", {
                "b": chk.get("b", 0.0),
                "d": chk.get("d", 0.0),
                "big_d": chk.get("big_d", 0.0),
                "cover": chk.get("cover", 0.0),
                "bar_dia": chk.get("bar_dia", 0.0),
                "bar_spacing": chk.get("bar_spacing", 0.0),
                "fs": chk.get("fs", 0.0),
                "exposure": chk.get("exposure", "moderate"),
            })
        elif ctype == "drift":
            out = await _rust_post("/api/design/is1893/drift", {
                "storey_height_mm": chk.get("storey_height_mm", 0.0),
                "elastic_drift_mm": chk.get("elastic_drift_mm", 0.0),
                "response_reduction": chk.get("response_reduction", 1.0),
                "storey_number": chk.get("storey_number", 1),
            })
        else:
            raise HTTPException(status_code=400, detail=f"Unknown serviceability check type: {ctype}")
        results.append(out)

    return {
        "results": results,
        "all_passed": all(bool(r.get("passed", False)) for r in results),
    }


@router.post("/analyze/dsm3d")
async def analyze_dsm_3d(request: Dict[str, Any]):
    """
    Full DSM 3D frame analysis endpoint.

    Accepts JSON body with nodes, elements, supports, nodal_loads,
    optionally member_loads, include_self_weight.
    Returns displacements, reactions, element_forces.
    """
    payload = {
        "nodes": request.get("nodes", []),
        "members": request.get("elements", []),
        "supports": request.get("supports", []),
        "loads": request.get("loads", request.get("nodal_loads", [])),
    }
    return await _rust_post("/api/analyze", payload)
