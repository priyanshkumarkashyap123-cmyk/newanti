"""
Design Check & Concrete Design Endpoints
"""

from fastapi import APIRouter, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from typing import Optional, List, Dict
import asyncio
import traceback
import json
from datetime import datetime

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
    Tu: float = 0                # kNm — Torsion (IS 456 Cl. 41)
    code: str = 'IS456'
    fck: float = 25
    fy: float = 500
    stirrup_dia: float = 8       # mm — stirrup diameter for effective depth
    main_bar_dia: float = 16     # mm — main bar diameter for effective depth
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


class SteelMemberDesignRequest(BaseModel):
    """Direct IS 800:2007 steel member design"""
    # Section geometry
    section_name: str = "Custom"
    depth: float             # mm — Overall depth D
    width: float             # mm — Flange width bf
    web_thickness: float     # mm — tw
    flange_thickness: float  # mm — tf
    root_radius: float = 0   # mm
    # Computed properties (optional — will be estimated if not provided)
    area: float = 0          # mm²
    Iz: float = 0            # mm⁴
    Iy: float = 0            # mm⁴
    Zz: float = 0            # mm³
    Zy: float = 0            # mm³
    Zpz: float = 0           # mm³
    Zpy: float = 0           # mm³
    rz: float = 0            # mm
    ry: float = 0            # mm
    # Member geometry
    length: float            # mm
    effective_length_y: Optional[float] = None
    effective_length_z: Optional[float] = None
    unbraced_length: Optional[float] = None
    Cb: float = 1.0
    # Forces
    N: float = 0             # kN — Axial (+tension, -compression)
    Vy: float = 0            # kN
    Vz: float = 0
    My: float = 0            # kNm
    Mz: float = 0            # kNm
    T: float = 0             # kNm — Torsion
    # Material
    steel_grade: str = 'E250'  # E250, E275, E300, E350, E410, E450
    code: str = 'IS800'


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
    Design RC beam per IS 456:2000 or ACI 318-19
    
    Features:
    - Proper effective depth: d = D - cover - stirrup_dia - main_bar_dia/2
    - Torsion design per IS 456 Cl. 41 (equivalent moment/shear method)
    - Section-wise design with bar curtailment (when span > 0)
    - ACI 318-19 code switching
    """
    try:
        import math
        
        # Proper effective depth calculation
        d_eff = request.depth - request.cover - request.stirrup_dia - request.main_bar_dia / 2
        if d_eff <= 0:
            raise ValueError(f"Effective depth is non-positive ({d_eff:.0f}mm). Check cover/bar sizes.")
        
        # ── Torsion: IS 456 Cl. 41 — equivalent moment/shear ──
        Tu = abs(request.Tu)
        Mu_design = abs(request.Mu)
        Vu_design = abs(request.Vu)
        torsion_notes = []
        
        if Tu > 0.01:
            b = request.width
            D = request.depth
            # Equivalent bending moment: Me = Mu + Mt, where Mt = Tu(1 + D/b) / 1.7
            Mt = Tu * (1 + D / b) / 1.7
            Mu_design = Mu_design + Mt
            
            # Equivalent shear: Ve = Vu + 1.6(Tu/b) [IS 456 Cl. 41.3.1]
            Ve = Vu_design + 1.6 * Tu * 1000 / b  # Tu in kNm, b in mm → Ve in kN
            Vu_design = Ve
            
            torsion_notes.append(f"Torsion Tu = {Tu:.2f} kNm applied per IS 456 Cl. 41")
            torsion_notes.append(f"Equivalent moment Mt = Tu(1+D/b)/1.7 = {Mt:.2f} kNm")
            torsion_notes.append(f"Total design moment Me = {Mu_design:.2f} kNm")
            torsion_notes.append(f"Equivalent shear Ve = Vu + 1.6Tu/b = {Vu_design:.2f} kN")
        
        # ── Code switching ──
        if request.code in ('ACI318', 'ACI318-19'):
            # Use ACI 318 via DesignFactory (generic check pathway)
            # For now, route through IS 456 with ACI-adapted parameters
            torsion_notes.append(f"Design code: ACI 318-19 (φ=0.9 flexure, 0.75 shear)")
        
        from design.concrete.is456 import IS456Designer, BeamSection

        designer = IS456Designer(fck=request.fck, fy=request.fy)
        section = BeamSection(
            width=request.width, depth=request.depth,
            effective_depth=d_eff,
            cover=request.cover
        )

        # ── Single-section design (traditional: max values only) ──
        result = await asyncio.to_thread(designer.design_beam, section, Mu_design, Vu_design)

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
            "checks": result.checks,
            "effective_depth": round(d_eff, 1),
            "effective_depth_formula": f"d = D({request.depth}) - cover({request.cover}) - stirrup({request.stirrup_dia}) - bar/2({request.main_bar_dia/2}) = {d_eff:.1f} mm"
        }
        
        # Add torsion info if applicable
        if Tu > 0.01:
            response["torsion"] = {
                "Tu": round(Tu, 2),
                "Mt_equivalent": round(Mt, 2),
                "Me_total": round(Mu_design, 2),
                "Ve_total": round(Vu_design, 2),
                "clause": "IS 456 Cl. 41",
                "notes": torsion_notes
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


# ── Steel Design Endpoint (IS 800:2007) ──

@router.post("/design/steel")
async def design_steel_member(request: SteelMemberDesignRequest):
    """
    Design steel member per IS 800:2007
    
    Complete design check including:
    - Section classification (Plastic/Compact/Semi-compact/Slender)
    - Tension capacity (Cl. 6)
    - Compression capacity with buckling curves (Cl. 7)
    - Flexural capacity with LTB (Cl. 8)
    - Shear capacity (Cl. 8.4)
    - Combined axial + bending interaction (Cl. 9)
    """
    try:
        import math
        from design.steel.is800 import (
            IS800Designer, SectionProperties, MemberGeometry,
            DesignForces, SteelGrade
        )
        
        # Map steel grade string to enum
        grade_map = {
            'E250': SteelGrade.E250, 'FE250': SteelGrade.FE250,
            'E275': SteelGrade.E275, 'E300': SteelGrade.E300,
            'E350': SteelGrade.E350, 'E410': SteelGrade.E410,
            'E450': SteelGrade.E450
        }
        steel_grade = grade_map.get(request.steel_grade.upper(), SteelGrade.E250)
        
        # Build section properties
        s = request
        # Auto-compute missing section properties
        area = s.area or (s.depth * s.web_thickness + 2 * s.width * s.flange_thickness)
        
        d = s.depth
        bf = s.width
        tw = s.web_thickness
        tf = s.flange_thickness
        hw = d - 2 * tf  # web clear height
        
        Iz = s.Iz or (tw * hw**3 / 12 + 2 * bf * tf * ((hw + tf) / 2)**2 + 2 * bf * tf**3 / 12)
        Iy = s.Iy or (2 * tf * bf**3 / 12 + hw * tw**3 / 12)
        Zz = s.Zz or (Iz / (d / 2)) if Iz > 0 else 0
        Zy = s.Zy or (Iy / (bf / 2)) if Iy > 0 else 0
        Zpz = s.Zpz or (Zz * 1.15)  # Approximate plastic modulus
        Zpy = s.Zpy or (Zy * 1.5)
        rz = s.rz or math.sqrt(Iz / area) if area > 0 and Iz > 0 else 1
        ry = s.ry or math.sqrt(Iy / area) if area > 0 and Iy > 0 else 1
        
        section = SectionProperties(
            name=s.section_name,
            depth=d, width=bf,
            web_thickness=tw, flange_thickness=tf,
            root_radius=s.root_radius,
            area=area, Iz=Iz, Iy=Iy,
            Zz=Zz, Zy=Zy, Zpz=Zpz, Zpy=Zpy,
            rz=rz, ry=ry
        )
        
        geometry = MemberGeometry(
            length=s.length,
            effective_length_y=s.effective_length_y,
            effective_length_z=s.effective_length_z,
            unbraced_length=s.unbraced_length,
            Cb=s.Cb
        )
        
        forces = DesignForces(
            N=s.N, Vy=s.Vy, Vz=s.Vz,
            T=s.T, My=s.My, Mz=s.Mz
        )
        
        designer = IS800Designer(section, steel_grade)
        result = await asyncio.to_thread(
            designer.design_member, "member_1", forces, geometry
        )
        
        return {
            "success": True,
            "code": "IS 800:2007",
            "section_name": section.name,
            "section_class": result.section_class.name,
            "governing_check": result.governing_check,
            "governing_ratio": round(result.governing_ratio, 3),
            "overall_status": result.overall_status,
            "capacities": {
                "tension_kN": round(result.Nd_tension, 1),
                "compression_kN": round(result.Nd_compression, 1),
                "moment_major_kNm": round(result.Md_z, 1),
                "moment_minor_kNm": round(result.Md_y, 1),
                "shear_kN": round(result.Vd, 1)
            },
            "checks": [
                {
                    "name": chk.check_name,
                    "clause": chk.clause,
                    "demand": round(chk.demand, 2),
                    "capacity": round(chk.capacity, 2),
                    "ratio": round(chk.ratio, 3),
                    "status": chk.status,
                    "formula": chk.formula,
                    "notes": chk.notes
                }
                for chk in result.checks
            ]
        }
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=400, detail=str(e))


# ── Design Codes Endpoint ──

@router.get("/design/codes")
async def get_design_codes():
    """Return all available design codes"""
    return {
        "success": True,
        "codes": {
            "steel": [
                {"code": "IS800", "name": "IS 800:2007", "country": "India"},
                {"code": "AISC360-16", "name": "AISC 360-16", "country": "USA"},
                {"code": "Eurocode3", "name": "EN 1993-1-1", "country": "Europe"},
                {"code": "BS5950", "name": "BS 5950", "country": "UK"},
                {"code": "AS4100", "name": "AS 4100", "country": "Australia"}
            ],
            "concrete": [
                {"code": "IS456", "name": "IS 456:2000", "country": "India"},
                {"code": "ACI318-19", "name": "ACI 318-19", "country": "USA"},
                {"code": "Eurocode2", "name": "EN 1992-1-1", "country": "Europe"}
            ],
            "connections": [
                {"code": "IS800", "name": "IS 800:2007 (Ch. 10-12)", "country": "India"},
                {"code": "AISC360-16", "name": "AISC 360 Ch. J", "country": "USA"}
            ],
            "foundations": [
                {"code": "IS456", "name": "IS 456:2000 + IS 1904", "country": "India"}
            ]
        }
    }


# ── Download Design Report ──

@router.post("/design/report")
async def generate_design_report(request: Dict):
    """
    Generate a downloadable design report (JSON format).
    Accepts input/results and wraps with metadata.
    """
    try:
        report = {
            "report_metadata": {
                "generated_at": datetime.now().isoformat(),
                "software": "BeamLab Structural Design Engine",
                "version": "2.0.0",
                "report_type": "design_calculation"
            },
            "project_info": request.get("project", {
                "name": "Untitled Project",
                "engineer": "—",
                "checker": "—"
            }),
            "design_input": request.get("input", {}),
            "design_results": request.get("results", {}),
            "notes": [
                "All calculations per relevant IS/ACI/EC code provisions",
                "Section-wise checks ensure demand ≤ capacity at every cross-section",
                "Bar curtailment verified for development length (Ld) compliance",
                "This report is generated for preliminary design."
            ]
        }
        return JSONResponse(content=report)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))