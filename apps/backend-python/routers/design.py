"""
Design Check & Concrete Design Endpoints
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import Optional, List, Dict
import asyncio
import traceback

router = APIRouter(tags=["Design"])


# ── Request Models ──

class DesignCheckMemberInput(BaseModel):
    member_id: str = Field(max_length=128)
    section_name: str = Field(default="Unknown", max_length=128)
    section_properties: Dict = Field(default_factory=dict)
    length: float = Field(default=0.0, ge=0)
    material: Dict = Field(default_factory=dict)
    forces: Dict = Field(default_factory=dict)
    unbraced_length_major: Optional[float] = None
    unbraced_length_minor: Optional[float] = None
    unbraced_length_ltb: Optional[float] = None
    Kx: float = Field(default=1.0, ge=0, le=10)
    Ky: float = Field(default=1.0, ge=0, le=10)
    Cb: float = Field(default=1.0, ge=0, le=10)


class DesignCheckRequest(BaseModel):
    code: str = Field(default="AISC360-16", max_length=64)
    method: str = Field(default="LRFD", max_length=32)
    members: List[DesignCheckMemberInput] = Field(default_factory=list, max_length=10_000)


class BeamDesignRequest(BaseModel):
    width: float
    depth: float
    cover: float = 40
    Mu: float
    Vu: float
    fck: float = 25
    fy: float = 500


class ColumnDesignRequest(BaseModel):
    width: float
    depth: float
    cover: float = 40
    Pu: float
    Mux: float = 0
    Muy: float = 0
    unsupported_length: float
    effective_length_factor: float = 1.0
    fck: float = 25
    fy: float = 500


class SlabDesignRequest(BaseModel):
    lx: float
    ly: float = 0
    live_load: float
    floor_finish: float = 1.0
    support_type: str = 'simple'
    edge_conditions: str = 'all_simple'
    fck: float = 25
    fy: float = 500


# ── Endpoints ──

@router.post("/design/check")
async def check_design(request: DesignCheckRequest):
    """Perform code checking (AISC, Eurocode, etc.) on structure."""
    try:
        from design import DesignFactory, DesignMember

        code = DesignFactory.get_code(request.code)
        if not code:
            raise HTTPException(status_code=400, detail=f"Design code '{request.code}' not supported")

        results = {}
        for m_data in request.members:
            try:
                member = DesignMember(
                    id=m_data.member_id, section_name=m_data.section_name,
                    section_properties=m_data.section_properties, length=m_data.length,
                    material=m_data.material, forces=m_data.forces,
                    unbraced_length_major=m_data.unbraced_length_major if m_data.unbraced_length_major is not None else m_data.length,
                    unbraced_length_minor=m_data.unbraced_length_minor if m_data.unbraced_length_minor is not None else m_data.length,
                    unbraced_length_ltb=m_data.unbraced_length_ltb if m_data.unbraced_length_ltb is not None else m_data.length,
                    effective_length_factor_major=m_data.Kx,
                    effective_length_factor_minor=m_data.Ky,
                    cb=m_data.Cb
                )

                res = await asyncio.to_thread(code.check_member, member)
                results[member.id] = {
                    "ratio": res.ratio, "status": res.status,
                    "governing": res.governing_check, "capacity": res.capacity,
                    "log": res.calculation_log
                }
            except Exception as item_err:
                results[m_data.member_id] = {"error": str(item_err), "status": "ERROR"}

        return {"success": True, "code": code.code_name, "results": results}

    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/design/beam")
async def design_beam(request: BeamDesignRequest):
    """Design RC beam per IS 456:2000"""
    try:
        from design.concrete.is456 import IS456Designer, BeamSection

        designer = IS456Designer(fck=request.fck, fy=request.fy)
        section = BeamSection(
            width=request.width, depth=request.depth,
            effective_depth=request.depth - request.cover - 10,
            cover=request.cover
        )

        result = await asyncio.to_thread(designer.design_beam, section, request.Mu, request.Vu)

        return {
            "success": True,
            "tension_steel": {
                "diameter": result.tension_steel.diameter,
                "count": result.tension_steel.count,
                "area": round(result.tension_steel.area, 1)
            },
            "compression_steel": {
                "diameter": result.compression_steel.diameter,
                "count": result.compression_steel.count,
                "area": round(result.compression_steel.area, 1)
            } if result.compression_steel else None,
            "stirrups": {
                "diameter": result.stirrups.diameter,
                "legs": result.stirrups.count,
                "spacing": result.stirrups.spacing
            },
            "Mu_capacity": round(result.Mu_capacity, 2),
            "Vu_capacity": round(result.Vu_capacity, 2),
            "status": result.status,
            "checks": result.checks
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/design/column")
async def design_column(request: ColumnDesignRequest):
    """Design RC column per IS 456:2000"""
    try:
        from design.concrete.is456 import IS456Designer, ColumnSection

        designer = IS456Designer(fck=request.fck, fy=request.fy)
        section = ColumnSection(
            width=request.width, depth=request.depth, cover=request.cover
        )

        result = await asyncio.to_thread(lambda: designer.design_column(
            section, Pu=request.Pu, Mux=request.Mux, Muy=request.Muy,
            unsupported_length=request.unsupported_length,
            effective_length_factor=request.effective_length_factor
        ))

        return {
            "success": True,
            "longitudinal_steel": [
                {"diameter": bar.diameter, "count": bar.count, "area": round(bar.area, 1)}
                for bar in result.longitudinal_steel
            ],
            "ties": {"diameter": result.ties.diameter, "spacing": result.ties.spacing},
            "Pu_capacity": round(result.Pu_capacity, 2),
            "Mux_capacity": round(result.Mux_capacity, 2),
            "Muy_capacity": round(result.Muy_capacity, 2),
            "interaction_ratio": round(result.interaction_ratio, 3),
            "status": result.status,
            "checks": result.checks
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/design/slab")
async def design_slab(request: SlabDesignRequest):
    """Design RC slab per IS 456:2000"""
    try:
        from design.concrete.slab import (
            design_simply_supported_slab, design_two_way_floor_slab
        )

        if request.ly == 0 or request.ly / request.lx > 2:
            result = await asyncio.to_thread(lambda: design_simply_supported_slab(
                span=request.lx, live_load=request.live_load,
                fck=request.fck, fy=request.fy, floor_finish=request.floor_finish
            ))
        else:
            result = await asyncio.to_thread(lambda: design_two_way_floor_slab(
                lx=request.lx, ly=request.ly, live_load=request.live_load,
                edge_conditions=request.edge_conditions,
                fck=request.fck, fy=request.fy
            ))

        return {
            "success": True,
            "thickness": result.thickness,
            "main_reinforcement": {
                "diameter": result.main_reinforcement.diameter,
                "spacing": result.main_reinforcement.spacing,
                "area_per_m": round(result.main_reinforcement.area_per_m, 1),
                "direction": result.main_reinforcement.direction
            },
            "distribution_reinforcement": {
                "diameter": result.distribution_reinforcement.diameter,
                "spacing": result.distribution_reinforcement.spacing,
                "area_per_m": round(result.distribution_reinforcement.area_per_m, 1),
                "direction": result.distribution_reinforcement.direction
            },
            "top_reinforcement": {
                "diameter": result.top_reinforcement.diameter,
                "spacing": result.top_reinforcement.spacing,
                "area_per_m": round(result.top_reinforcement.area_per_m, 1)
            } if result.top_reinforcement else None,
            "Mu_capacity": round(result.Mu_capacity, 2),
            "Mu_demand": round(result.Mu_demand, 2),
            "deflection_check": round(result.deflection_check, 1),
            "deflection_limit": round(result.deflection_limit, 1),
            "status": result.status,
            "checks": result.checks
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
