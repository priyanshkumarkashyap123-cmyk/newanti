"""
Genetic Algorithm optimization endpoint for layout v2.
"""

from typing import Dict, List

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
    SiteConfig,
)
from routers.layout_v2_schemas import (
    GAOptimizeRequest,
    GAOptimizeResponse,
    ComplianceItemResponse,
    PlacementResponse,
)
from .layout_v2_utils import validate_layout_v2_request

router = APIRouter(tags=["Layout Optimization v2"])


@router.post("/api/layout/v2/ga-optimize", response_model=GAOptimizeResponse)
async def ga_optimize_layout(request: GAOptimizeRequest):
    try:
        validate_layout_v2_request(request)

        from genetic_optimizer import GAConfig, GeneticOptimizer
        from layout_solver_v2 import BestSolution, calculate_penalty_v2

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
            max_unsupported_span_m=gc.max_unsupported_span_m if gc else 5.0,
            min_ceiling_height_m=gc.min_ceiling_height_m if gc else 3.0,
            structural_grid_module_m=gc.structural_grid_module_m if gc else 0.5,
            max_riser_height_m=gc.max_riser_height_m if gc else 0.19,
            min_tread_depth_m=gc.min_tread_depth_m if gc else 0.25,
            floor_to_floor_height_m=gc.floor_to_floor_height_m if gc else 3.0,
            max_circulation_ratio=gc.max_circulation_ratio if gc else 0.15,
            max_egress_distance_m=gc.max_egress_distance_m if gc else 22.0,
            min_fenestration_ratio=gc.min_fenestration_ratio if gc else 0.10,
        )

        room_nodes = [
            RoomNode(
                id=n.id,
                name=n.name or n.id,
                type=RoomType(n.type),
                acoustic_zone=AcousticZone(n.acoustic_zone) if n.acoustic_zone else None,
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
            for n in request.nodes
        ]

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

        ga_p = request.ga_params
        ga_config = GAConfig(
            population_size=ga_p.population_size,
            max_generations=ga_p.max_generations,
            elite_count=ga_p.elite_count,
            tournament_size=ga_p.tournament_size,
            crossover_rate=ga_p.crossover_rate,
            mutation_rate=ga_p.mutation_rate,
        )

        optimizer = GeneticOptimizer(
            site=site_cfg,
            constraints=constraints,
            rooms=room_nodes,
            adjacency_edges=edges,
            weights=weights,
        )

        result = optimizer.run(config=ga_config)

        rooms_by_id = {r.id: r for r in room_nodes}
        best_placements = result.best_chromosome.to_placements(rooms_by_id)

        adj_map: Dict = {}
        for e in edges:
            adj_map[(e.node_a, e.node_b)] = e.weight
            adj_map[(e.node_b, e.node_a)] = e.weight

        solver = LayoutSolverV2(
            site=site_cfg,
            constraints=constraints,
            rooms=room_nodes,
            adjacency_edges=edges,
            weights=weights,
            max_iterations=1,
        )

        penalty, constraints_sat, diag = calculate_penalty_v2(
            best_placements, solver.usable_boundary, constraints, adj_map, weights,
        )
        solver.best_solution = BestSolution(
            placements=best_placements,
            total_penalty=penalty,
            constraints_satisfied=constraints_sat,
            iteration=0,
            diagnostics=diag,
        )

        report = solver.get_full_report()
        placement_list = report.get("placements", [])
        compliance = [ComplianceItemResponse(**ci) for ci in report.get("compliance_items", [])]

        return GAOptimizeResponse(
            success=True,
            best_fitness=result.best_chromosome.fitness,
            fitness_history=result.fitness_history,
            converged=result.converged,
            pareto_front_size=len(result.pareto_front),
            placements=[PlacementResponse(**p) for p in placement_list],
            compliance_items=compliance,
            space_syntax=report.get("space_syntax"),
            structural_handoff=report.get("structural_handoff"),
            mep_schedule=report.get("mep_schedule"),
        )

    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"GA optimization failed: {exc}") from exc
