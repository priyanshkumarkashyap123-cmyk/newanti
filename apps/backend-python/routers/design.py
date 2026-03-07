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
    code: str = 'IS456'
    fck: float = 25
    fy: float = 500
    # Section-wise design parameters
    span: float = 0              # mm — if > 0, enables section-wise design
    w_factored: float = 0        # kN/m — factored UDL for demand envelope
    support_condition: str = 'simple'  # 'simple', 'fixed-fixed', 'propped', 'cantilever'
    n_sections: int = 11          # Number of sections to check along span
    section_forces: Optional[List[Dict]] = None  # User-supplied force arrays [{x, Mu, Vu}]


class ColumnDesignRequest(BaseModel):
    width: float
    depth: float
    cover: float = 40
    Pu: float
    Mux: float = 0
    Muy: float = 0
    unsupported_length: float
    effective_length_factor: float = 1.0
    code: str = 'IS456'
    fck: float = 25
    fy: float = 500
    # Section-wise column checking
    Mux_top: Optional[float] = None   # Top moment about x-axis (kNm)
    Mux_bottom: Optional[float] = None # Bottom moment about x-axis (kNm)
    Muy_top: Optional[float] = None
    Muy_bottom: Optional[float] = None
    n_sections: int = 5


class SlabDesignRequest(BaseModel):
    lx: float
    ly: float = 0
    live_load: float
    floor_finish: float = 1.0
    support_type: str = 'simple'
    edge_conditions: str = 'all_simple'
    code: str = 'IS456'
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
    """
    Design RC beam per IS 456:2000
    
    If span > 0 and w_factored > 0 (or section_forces provided),
    performs SECTION-WISE design — checks every section, provides
    curtailment schedule, and ensures demand ≤ capacity everywhere.
    
    Otherwise, designs for the single maximum section (traditional).
    """
    try:
        from design.concrete.is456 import IS456Designer, BeamSection

        designer = IS456Designer(fck=request.fck, fy=request.fy)
        section = BeamSection(
            width=request.width, depth=request.depth,
            effective_depth=request.depth - request.cover - 10,
            cover=request.cover
        )

        # ── Single-section design (traditional: max values only) ──
        result = await asyncio.to_thread(designer.design_beam, section, abs(request.Mu), abs(request.Vu))

        response = {
            "success": True,
            "design_approach": "single_section",
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

        # ── Section-wise design (if span & loads provided) ──
        if request.span > 0 and (request.w_factored > 0 or request.section_forces):
            from design.concrete.section_wise_design import (
                SectionWiseDesigner,
                generate_simply_supported_demands,
                generate_continuous_beam_demands,
                generate_demands_from_forces
            )
            
            sw_designer = SectionWiseDesigner(fck=request.fck, fy=request.fy, code=request.code)
            
            # Generate demand envelope
            if request.section_forces:
                demands = generate_demands_from_forces(
                    L=request.span,
                    section_forces=request.section_forces,
                    n_sections=request.n_sections
                )
            elif request.support_condition == 'simple':
                demands = generate_simply_supported_demands(
                    L=request.span, w=request.w_factored, n_sections=request.n_sections
                )
            else:
                demands = generate_continuous_beam_demands(
                    L=request.span, w=request.w_factored,
                    end_condition=request.support_condition,
                    n_sections=request.n_sections
                )
            
            sw_result = await asyncio.to_thread(
                sw_designer.design_member_sectionwise,
                width=request.width, depth=request.depth,
                cover=request.cover, span=request.span,
                demands=demands, n_sections=request.n_sections
            )
            
            response["design_approach"] = "section_wise"
            response["section_wise"] = {
                "n_sections": sw_result.n_sections,
                "is_safe_everywhere": sw_result.is_safe_everywhere,
                "economy_ratio": sw_result.economy_ratio,
                "summary": sw_result.summary,
                "engineering_notes": sw_result.engineering_notes,
                "section_checks": [
                    {
                        "location": sc.location.label,
                        "x_ratio": sc.location.x_ratio,
                        "Mu_capacity": sc.Mu_capacity,
                        "Vu_capacity": sc.Vu_capacity,
                        "Ast_bottom": sc.Ast_bottom,
                        "Ast_top": sc.Ast_top,
                        "stirrup_spacing": sc.stirrup_spacing,
                        "utilization_M": sc.utilization_M,
                        "utilization_V": sc.utilization_V,
                        "status": sc.status
                    }
                    for sc in sw_result.section_checks
                ],
                "rebar_zones": [
                    {
                        "x_start": z.x_start,
                        "x_end": z.x_end,
                        "bottom_bars": z.bottom_bars,
                        "top_bars": z.top_bars,
                        "stirrup_spec": z.stirrup_spec,
                        "Ast_bottom": z.Ast_bottom,
                        "note": z.note
                    }
                    for z in sw_result.rebar_zones
                ],
                "curtailment_points": [
                    {
                        "x": cp.x,
                        "description": cp.bar_description,
                        "Ld_required": cp.Ld_required,
                        "Ld_available": cp.Ld_available,
                        "is_valid": cp.is_valid,
                        "clause": cp.clause
                    }
                    for cp in sw_result.curtailment_points
                ],
                "critical_section": {
                    "location": sw_result.max_section.location.label,
                    "utilization_M": sw_result.max_section.utilization_M,
                    "utilization_V": sw_result.max_section.utilization_V,
                    "Ast_bottom": sw_result.max_section.Ast_bottom
                }
            }
            response["checks"] = sw_result.checks

        return response
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/design/column")
async def design_column(request: ColumnDesignRequest):
    """
    Design RC column per IS 456:2000
    
    If Mux_top and Mux_bottom are provided, performs section-wise checking
    along column height — moments interpolated + P-delta effects.
    """
    try:
        from design.concrete.is456 import IS456Designer, ColumnSection

        designer = IS456Designer(fck=request.fck, fy=request.fy)
        section = ColumnSection(
            width=request.width, depth=request.depth, cover=request.cover
        )

        result = await asyncio.to_thread(lambda: designer.design_column(
            section, Pu=request.Pu, Mux=abs(request.Mux), Muy=abs(request.Muy),
            unsupported_length=request.unsupported_length,
            effective_length_factor=request.effective_length_factor
        ))

        response = {
            "success": True,
            "design_approach": "single_section",
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

        # ── Section-wise column check (if end moments provided) ──
        if request.Mux_top is not None and request.Mux_bottom is not None:
            from design.concrete.section_wise_design import check_column_at_sections
            
            col_sw = await asyncio.to_thread(
                check_column_at_sections,
                width=request.width, depth=request.depth, cover=request.cover,
                height=request.unsupported_length,
                Pu=request.Pu,
                Mux_top=request.Mux_top, Mux_bottom=request.Mux_bottom,
                Muy_top=request.Muy_top or 0, Muy_bottom=request.Muy_bottom or 0,
                fck=request.fck, fy=request.fy,
                n_sections=request.n_sections
            )
            
            response["design_approach"] = "section_wise"
            response["section_wise"] = col_sw

        return response
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
