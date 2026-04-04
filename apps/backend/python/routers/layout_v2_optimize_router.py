"""
Primary BSP/SA optimization endpoints for layout v2.
"""

from typing import Dict

from fastapi import APIRouter, HTTPException

from layout_solver_v2 import (
    AcousticZone,
    AdjacencyEdge,
    GlobalConstraints,
    LayoutSolverV2,
    PenaltyWeightsV2,
    RoomNode,
    RoomType,
    Setbacks,
    SimulatedAnnealingSolver,
    SiteConfig,
)
from routers.layout_v2_schemas import (
    LayoutV2Request,
    LayoutV2Response,
    ComplianceItemResponse,
    PlacementResponse,
)
from .layout_v2_utils import validate_layout_v2_request

router = APIRouter(tags=["Layout Optimization v2"])


@router.post("/api/layout/v2/optimize", response_model=LayoutV2Response)
async def optimize_layout_v2(request: LayoutV2Request):
    try:
        validate_layout_v2_request(request)

        w, h = request.site.dimensions_m
        sb = request.site.setbacks_m
        left = sb.left if sb.left is not None else (sb.sides if sb.sides is not None else 1.5)
        right = sb.right if sb.right is not None else (sb.sides if sb.sides is not None else 1.5)

        site_cfg = SiteConfig(
            width=w,
            height=h,
            fsi_limit=request.site.fsi_limit,
            setbacks=Setbacks(front=sb.front, rear=sb.rear, left=left, right=right),
            north_angle_deg=request.site.north_angle_deg,
            latitude_deg=request.site.latitude_deg,
            num_floors=request.site.num_floors,
            polygon_vertices=request.site.polygon_vertices,
        )

        gc = request.global_constraints
        constraints = GlobalConstraints(
            max_unsupported_span_m=gc.max_unsupported_span_m if gc else None,
            min_ceiling_height_m=gc.min_ceiling_height_m if gc else None,
            structural_grid_module_m=gc.structural_grid_module_m if gc else None,
            max_riser_height_m=gc.max_riser_height_m if gc else None,
            min_tread_depth_m=gc.min_tread_depth_m if gc else None,
            floor_to_floor_height_m=gc.floor_to_floor_height_m if gc else None,
            max_circulation_ratio=gc.max_circulation_ratio if gc else None,
            max_egress_distance_m=gc.max_egress_distance_m if gc else None,
            min_fenestration_ratio=gc.min_fenestration_ratio if gc else None,
        )

        room_nodes = []
        for n in request.nodes:
            room_type = RoomType(n.type)
            acoustic = AcousticZone(n.acoustic_zone) if n.acoustic_zone else None
            room_nodes.append(
                RoomNode(
                    id=n.id,
                    name=n.name or n.id,
                    type=room_type,
                    acoustic_zone=acoustic,
                    target_area_sqm=n.target_area_sqm,
                    min_width_m=n.min_width_m,
                    max_aspect_ratio=n.max_aspect_ratio,
                    min_aspect_ratio=n.min_aspect_ratio,
                    requires_exterior_wall=n.requires_exterior_wall,
                    plumbing_required=n.plumbing_required,
                    priority=n.priority,
                    is_entry=n.is_entry,
                    num_doors=n.num_doors,
                )
            )

        edges = [
            AdjacencyEdge(node_a=e.node_a, node_b=e.node_b, weight=e.weight)
            for e in request.adjacency_matrix
        ]

        weights = None
        if request.penalty_weights:
            pw = request.penalty_weights
            weights = PenaltyWeightsV2(
                area_deviation=pw.area_deviation,
                min_width_violation=pw.min_width_violation,
                aspect_ratio_violation=pw.aspect_ratio_violation,
                adjacency_violation=pw.adjacency_violation,
                exterior_wall_violation=pw.exterior_wall_violation,
                overlap_collision=pw.overlap_collision,
                fsi_violation=pw.fsi_violation,
                plumbing_cluster_penalty=pw.plumbing_cluster_penalty,
                acoustic_zone_violation=pw.acoustic_zone_violation,
                clearance_violation=pw.clearance_violation,
                grid_snap_deviation=pw.grid_snap_deviation,
                circulation_excess=pw.circulation_excess,
                span_violation=pw.span_violation,
                beam_headroom_violation=pw.beam_headroom_violation,
                solar_thermal_penalty=pw.solar_thermal_penalty,
                fenestration_violation=pw.fenestration_violation,
                egress_distance_violation=pw.egress_distance_violation,
            )

        solver = LayoutSolverV2(
            site=site_cfg,
            constraints=constraints,
            rooms=room_nodes,
            adjacency_edges=edges,
            weights=weights,
            max_iterations=request.max_iterations,
            random_seed=request.random_seed,
        )
        solver.solve()

        sa_convergence = None
        if request.sa_params and request.sa_params.enabled and solver.best_solution:
            adj_map: Dict = {}
            for e in edges:
                adj_map[(e.node_a, e.node_b)] = e.weight
                adj_map[(e.node_b, e.node_a)] = e.weight
            sa = SimulatedAnnealingSolver(
                initial_solution=solver.best_solution,
                site=site_cfg,
                constraints=constraints,
                adjacency_map=adj_map,
                weights=weights,
                initial_temp=request.sa_params.initial_temp,
                cooling_rate=request.sa_params.cooling_rate,
                min_temp=request.sa_params.min_temp,
                max_iterations=request.sa_params.max_iterations,
                stagnation_limit=request.sa_params.stagnation_limit,
                random_seed=request.random_seed,
            )
            refined = sa.solve()
            solver.best_solution = refined
            sa_convergence = sa.get_convergence_report()

        report = solver.get_full_report()
        if "error" in report:
            raise HTTPException(status_code=500, detail=report["error"])

        return LayoutV2Response(
            success=True,
            total_penalty=report["total_penalty"],
            iteration_found=report["iteration_found"],
            total_iterations=report["total_iterations"],
            constraints_met_ratio=report["constraints_met_ratio"],
            fsi_analysis=report["fsi_analysis"],
            usable_boundary=report["usable_boundary"],
            staircase=report.get("staircase"),
            circulation=report["diagnostics"].get("circulation", {}),
            egress=report["diagnostics"].get("egress", {}),
            structural_checks=report["diagnostics"].get("structural_checks", []),
            solar_scores=report["diagnostics"].get("solar_scores", []),
            fenestration_checks=report["diagnostics"].get("fenestration_checks", []),
            anthropometric_issues=report["diagnostics"].get("anthropometric_issues", []),
            constraints_detail=report["constraints_detail"],
            compliance_items=[ComplianceItemResponse(**item) for item in report.get("compliance_items", [])],
            placements=[PlacementResponse(**p) for p in report["placements"]],
            travel_distances=report.get("travel_distances"),
            acoustic_buffers=report.get("acoustic_buffers"),
            structural_grid=report.get("structural_grid"),
            sa_convergence=sa_convergence,
            space_syntax=report.get("space_syntax"),
            structural_handoff=report.get("structural_handoff"),
            mep_schedule=report.get("mep_schedule"),
        )

    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Layout v2 optimisation failed: {exc}") from exc
