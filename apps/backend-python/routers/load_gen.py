"""
Load Generation Endpoints — ASCE 7, IS 1893, Load Combinations
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, List, Dict
import asyncio

router = APIRouter(tags=["Load Generation"])


# ── Request Models ──

class ASCE7SeismicRequest(BaseModel):
    Ss: float = 1.0
    S1: float = 0.4
    site_class: str = "D"
    risk_category: int = 2
    structural_system: str = "SMF_S"
    height: float = 30.0
    direction: str = "X"
    nodes: Optional[Dict[str, Dict]] = None
    dead_loads: Optional[Dict[str, float]] = None
    live_loads: Optional[Dict[str, float]] = None


class ASCE7WindRequest(BaseModel):
    V: float = 115.0
    exposure: str = "C"
    height: float = 30.0
    width: float = 20.0
    length: float = 30.0
    direction: str = "X"
    nodes: Optional[Dict[str, Dict]] = None


class IS1893SeismicRequest(BaseModel):
    zone: int = 3
    soil_type: str = "MEDIUM"
    building_type: str = "SMRF"
    importance: str = "ORDINARY"
    height: float = 30.0
    direction: str = "X"
    nodes: Optional[Dict[str, Dict]] = None
    dead_loads: Optional[Dict[str, float]] = None
    live_loads: Optional[Dict[str, float]] = None


class LoadCombinationRequest(BaseModel):
    codes: List[str] = ["ASCE7_LRFD", "IS456_LSM"]
    custom_combinations: Optional[List[Dict]] = None


# ── Endpoints ──

@router.post("/load-generation/asce7-seismic")
async def generate_asce7_seismic_loads(request: ASCE7SeismicRequest):
    """Generate seismic loads per ASCE 7-22 Equivalent Lateral Force procedure."""
    try:
        from analysis.generators.asce7_seismic import (
            ASCE7SeismicGenerator, ASCE7SeismicParams,
            SiteClass, RiskCategory, StructuralSystem
        )

        params = ASCE7SeismicParams(
            Ss=request.Ss, S1=request.S1,
            site_class=SiteClass(request.site_class),
            risk_category=RiskCategory(request.risk_category),
            structural_system=StructuralSystem(request.structural_system),
            height=request.height, direction=request.direction
        )

        generator = ASCE7SeismicGenerator(params)
        result = await asyncio.to_thread(
            generator.analyze,
            request.nodes or {}, request.dead_loads or {}, request.live_loads or {}
        )

        return {
            "success": result.success,
            "code": "ASCE 7-22",
            "method": "Equivalent Lateral Force",
            "parameters": {
                "Ss": request.Ss, "S1": request.S1,
                "Fa": round(result.Fa, 3), "Fv": round(result.Fv, 3),
                "SDS": round(result.SDS, 3), "SD1": round(result.SD1, 3),
            },
            "period": {
                "Ta": round(result.Ta, 3),
                "T_used": round(result.T, 3),
                "Cu": round(result.Cu, 2)
            },
            "design": {
                "SDC": result.SDC, "R": result.R,
                "Ie": result.Ie, "Cs": round(result.Cs, 4)
            },
            "forces": {
                "W": round(result.W, 2), "V": round(result.V, 2),
                "V_percent_W": round(result.Cs * 100, 2)
            },
            "story_forces": [
                {
                    "level": s.level, "height": round(s.height, 2),
                    "weight": round(s.seismic_weight, 2),
                    "force": round(s.lateral_force, 2),
                    "shear": round(s.shear, 2)
                }
                for s in result.story_forces
            ],
            "nodal_loads": result.nodal_loads
        }

    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/load-generation/asce7-wind")
async def generate_asce7_wind_loads(request: ASCE7WindRequest):
    """Generate wind loads per ASCE 7-22 Directional Procedure."""
    try:
        from analysis.generators.asce7_wind import (
            ASCE7WindGenerator, ASCE7WindParams, ExposureCategory
        )

        params = ASCE7WindParams(
            V=request.V, exposure=ExposureCategory(request.exposure),
            height=request.height, width=request.width,
            length=request.length, direction=request.direction
        )

        generator = ASCE7WindGenerator(params)
        result = await asyncio.to_thread(generator.analyze, request.nodes or {})

        return {
            "success": result.success,
            "code": "ASCE 7-22",
            "method": "Directional Procedure",
            "parameters": {
                "V": request.V, "exposure": request.exposure,
                "Kd": round(result.Kd, 2), "Ke": round(result.Ke, 3),
                "Kz": round(result.Kz, 3), "Kzt": round(result.Kzt, 3)
            },
            "pressures": {
                "qh": round(result.qh, 3), "GCpi": round(result.GCpi, 2),
                "Cp_windward": result.Cp_windward, "Cp_leeward": result.Cp_leeward,
                "Cp_side": result.Cp_side, "Cp_roof": result.Cp_roof
            },
            "forces": {
                "base_shear_kN": round(result.total_base_shear, 2),
                "overturning_moment_kNm": round(result.total_overturning_moment, 2)
            },
            "pressure_at_heights": [
                {
                    "height": round(p.height, 2), "qz": round(p.qz, 3),
                    "Kz": round(p.Kz, 3), "p_windward": round(p.p_windward, 3),
                    "p_leeward": round(p.p_leeward, 3), "p_net": round(p.p_net, 3)
                }
                for p in result.pressures
            ],
            "nodal_loads": result.nodal_loads
        }

    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/load-generation/is1893-seismic")
async def generate_is1893_seismic_loads(request: IS1893SeismicRequest):
    """Generate seismic loads per IS 1893:2016 Static Method."""
    try:
        from analysis.generators.auto_loads import (
            SeismicLoadGenerator, SeismicParameters,
            SeismicZone, SoilType, BuildingType, ImportanceCategory
        )

        zone_map = {2: SeismicZone.II, 3: SeismicZone.III, 4: SeismicZone.IV, 5: SeismicZone.V}
        soil_map = {"ROCK": SoilType.ROCK, "MEDIUM": SoilType.MEDIUM, "SOFT": SoilType.SOFT}
        building_map = {
            "OMRF": BuildingType.ORDINARY_RC_MRF, "SMRF": BuildingType.SPECIAL_RC_MRF,
            "OSMRF": BuildingType.ORDINARY_STEEL_MRF, "SSMRF": BuildingType.SPECIAL_STEEL_MRF,
            "BF": BuildingType.BRACED_FRAME, "SW": BuildingType.SHEAR_WALL,
            "DUAL": BuildingType.DUAL_SYSTEM
        }
        importance_map = {
            "ORDINARY": ImportanceCategory.ORDINARY,
            "IMPORTANT": ImportanceCategory.IMPORTANT,
            "CRITICAL": ImportanceCategory.CRITICAL
        }

        params = SeismicParameters(
            zone=zone_map.get(request.zone, SeismicZone.III),
            soil_type=soil_map.get(request.soil_type.upper(), SoilType.MEDIUM),
            building_type=building_map.get(request.building_type.upper(), BuildingType.SPECIAL_RC_MRF),
            importance=importance_map.get(request.importance.upper(), ImportanceCategory.ORDINARY),
            height=request.height, direction=request.direction
        )

        generator = SeismicLoadGenerator(params)
        nodes = request.nodes or {}
        dead_loads = request.dead_loads or {}
        live_loads = request.live_loads or {}

        if nodes and dead_loads:
            def _compute_is1893():
                generator.compute_floor_masses(nodes, dead_loads, live_loads)
                generator.calculate_base_shear()
                generator.distribute_lateral_forces()
                generator.generate_nodal_loads()
            await asyncio.to_thread(_compute_is1893)

        return {
            "success": True,
            "code": "IS 1893:2016",
            "method": "Equivalent Static Method",
            "parameters": {
                "zone": f"Zone {request.zone}",
                "Z": round(params.zone.factor(), 2),
                "soil_type": request.soil_type,
                "I": round(params.importance.factor(), 2),
                "R": round(params.building_type.R(), 2)
            },
            "analysis": {
                "Ta": round(generator.calculate_period(), 3),
                "Sa_g": round(generator.calculate_Sa_g(generator.calculate_period()), 3),
                "Ah": round(generator.calculate_Ah(), 4)
            },
            "forces": {
                "W": round(generator.total_weight, 2) if hasattr(generator, 'total_weight') else 0,
                "Vb": round(generator.base_shear, 2) if hasattr(generator, 'base_shear') else 0
            },
            "story_forces": generator.get_summary() if hasattr(generator, 'get_summary') else {},
            "nodal_loads": generator.nodal_loads if hasattr(generator, 'nodal_loads') else []
        }

    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/load-combinations/generate")
async def generate_load_combinations(request: LoadCombinationRequest):
    """Generate load combinations per specified design codes."""
    try:
        from analysis.generators.load_combinations import (
            LoadCombinationsManager, DesignCode
        )

        manager = LoadCombinationsManager()
        code_map = {
            "ASCE7_LRFD": DesignCode.ASCE7_LRFD,
            "ASCE7_ASD": DesignCode.ASCE7_ASD,
            "IS456_LSM": DesignCode.IS456_LSM,
            "ACI318": DesignCode.ACI318
        }

        for code_name in request.codes:
            code = code_map.get(code_name.upper())
            if code:
                manager.load_predefined(code)

        if request.custom_combinations:
            for custom in request.custom_combinations:
                manager.add_user_combination(
                    name=custom.get("name", "Custom"),
                    factors=custom.get("factors", {}),
                    description=custom.get("description", "")
                )

        summary = manager.get_summary()
        return {
            "success": True,
            "total_combinations": summary["total_combinations"],
            "active_combinations": summary["active_combinations"],
            "user_defined": summary["user_defined"],
            "codes_included": list(set(request.codes)),
            "combinations": [
                {
                    "id": c.id, "name": c.name, "code": c.code,
                    "expression": c.format_expression(),
                    "factors": [{"type": f.load_type, "factor": f.factor} for f in c.factors],
                    "is_user_defined": c.is_user_defined
                }
                for c in manager.combinations
            ]
        }

    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/load-combinations/available")
async def get_available_combinations():
    """Get all available predefined load combinations organized by code."""
    try:
        from analysis.generators.load_combinations import get_all_available_combinations

        all_combos = get_all_available_combinations()
        return {
            "codes": list(all_combos.keys()),
            "combinations": {
                code: [{"id": c.id, "name": c.name, "expression": c.format_expression()} for c in combos]
                for code, combos in all_combos.items()
            }
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
