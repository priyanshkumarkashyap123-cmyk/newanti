"""
Reinforced concrete design endpoints (beam, column, slab).
"""

from fastapi import APIRouter, HTTPException
import asyncio

from .design_schemas import BeamDesignRequest, ColumnDesignRequest, SlabDesignRequest

router = APIRouter(tags=["Design"])


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
        from design.concrete.is456 import IS456Designer, BeamSection

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
            Mt = Tu * (1 + D / b) / 1.7
            Mu_design = Mu_design + Mt

            Ve = Vu_design + 1.6 * Tu * 1000 / b
            Vu_design = Ve

            torsion_notes.append(f"Torsion Tu = {Tu:.2f} kNm applied per IS 456 Cl. 41")
            torsion_notes.append(f"Equivalent moment Mt = Tu(1+D/b)/1.7 = {Mt:.2f} kNm")
            torsion_notes.append(f"Total design moment Me = {Mu_design:.2f} kNm")
            torsion_notes.append(f"Equivalent shear Ve = Vu + 1.6Tu/b = {Vu_design:.2f} kN")

        if request.code in ('ACI318', 'ACI318-19'):
            torsion_notes.append("Design code: ACI 318-19 (φ=0.9 flexure, 0.75 shear)")

        designer = IS456Designer(fck=request.fck, fy=request.fy)
        section = BeamSection(
            width=request.width, depth=request.depth,
            effective_depth=d_eff,
            cover=request.cover
        )

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

        if Tu > 0.01:
            response["torsion"] = {
                "Tu": round(Tu, 2),
                "Mt_equivalent": round(Mt, 2),
                "Me_total": round(Mu_design, 2),
                "Ve_total": round(Vu_design, 2),
                "clause": "IS 456 Cl. 41",
                "notes": torsion_notes
            }

        if request.span > 0 and (request.w_factored > 0 or request.section_forces):
            from design.concrete.section_wise_design import (
                SectionWiseDesigner,
                generate_simply_supported_demands,
                generate_continuous_beam_demands,
                generate_demands_from_forces
            )

            sw_designer = SectionWiseDesigner(fck=request.fck, fy=request.fy, code=request.code)

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
