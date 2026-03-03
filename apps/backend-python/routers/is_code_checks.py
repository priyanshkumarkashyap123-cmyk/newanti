"""
IS Code Design Checks & Model Validation Endpoints
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
import asyncio

router = APIRouter(tags=["IS Codes Design"])


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


class ValidateModelRequest(BaseModel):
    """Constrained model for structural validation requests."""
    nodes: List[Dict[str, Any]] = Field(..., max_length=50000)
    members: List[Dict[str, Any]] = Field(default=[], max_length=50000)
    loads: List[Dict[str, Any]] = Field(default=[], max_length=50000)
    node_loads: List[Dict[str, Any]] = Field(default=[], max_length=50000)
    distributed_loads: List[Dict[str, Any]] = Field(default=[], max_length=50000)
    supports: List[Dict[str, Any]] = Field(default=[], max_length=50000)

    class Config:
        extra = "allow"


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
    """Check steel member capacity per IS 800:2007."""
    try:
        from is_codes import check_member_is800
        return await asyncio.to_thread(lambda: check_member_is800(
            section_name=request.section, steel_grade=request.grade,
            Pu=request.Pu, Mux=request.Mux, Muy=request.Muy,
            Lx=request.Lx, Ly=request.Ly, Lb=request.Lb
        ))
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/design/loads/floor")
async def generate_floor_loads(request: FloorLoadRequest):
    """Calculate floor loads per IS 875 Part 1 & 2."""
    try:
        from is_codes import calculate_floor_loads
        return await asyncio.to_thread(lambda: calculate_floor_loads(
            occupancy=request.occupancy, slab_thickness_mm=request.slabThickness,
            floor_finish=request.floorFinish, tributary_area=request.area,
            num_floors=request.floors
        ))
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/design/loads/wind")
async def generate_wind_loads(request: WindLoadRequest):
    """Calculate wind loads per IS 875 Part 3."""
    try:
        from is_codes import calculate_wind_pressure, TerrainCategory
        terrain_map = {
            1: TerrainCategory.CATEGORY_1, 2: TerrainCategory.CATEGORY_2,
            3: TerrainCategory.CATEGORY_3, 4: TerrainCategory.CATEGORY_4
        }
        return await asyncio.to_thread(lambda: calculate_wind_pressure(
            Vb=request.windSpeed, height=request.height,
            terrain=terrain_map.get(request.terrainCategory, TerrainCategory.CATEGORY_2)
        ))
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/design/concrete/beam")
async def design_concrete_beam(request: ConcreteDesignRequest):
    """Design concrete beam reinforcement per IS 456:2000."""
    try:
        from is_codes import design_beam_flexure
        return await asyncio.to_thread(lambda: design_beam_flexure(
            b=request.b, D=request.D, cover=request.cover,
            fck=request.fck, fy=request.fy, Mu=request.Mu
        ))
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/design/loads/seismic")
async def calculate_seismic_loads(request: SeismicLoadRequest):
    """Calculate seismic base shear per IS 1893:2016."""
    try:
        from is_codes import SeismicZone, SoilType, calculate_period_approx, calculate_base_shear

        T = await asyncio.to_thread(calculate_period_approx, request.height)

        zone_map = {"II": SeismicZone.II, "III": SeismicZone.III, "IV": SeismicZone.IV, "V": SeismicZone.V}
        soil_map = {1: SoilType.HARD, 2: SoilType.MEDIUM, 3: SoilType.SOFT}

        return await asyncio.to_thread(lambda: calculate_base_shear(
            W=request.weight, T=T,
            zone=zone_map.get(request.zone, SeismicZone.III),
            soil_type=soil_map.get(request.soilType, SoilType.MEDIUM)
        ))
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
