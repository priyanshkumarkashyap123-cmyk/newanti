"""
Multi-variant generation endpoints for layout v2.
"""

from typing import Dict, List

from fastapi import APIRouter, HTTPException

from layout_solver_v2 import (
    AcousticZone,
    AdjacencyEdge,
    GlobalConstraints,
    RoomNode,
    RoomType,
    Setbacks,
    SiteConfig,
)
from routers.layout_v2_schemas import (
    LayoutVariantsRequest,
    LayoutVariantsResponse,
    VariantResponse,
    VariantScoreResponse,
    PlacementResponse,
    ComplianceItemResponse,
)
from .layout_v2_utils import validate_layout_v2_request

router = APIRouter(tags=["Layout Optimization v2"])


@router.post("/api/layout/v2/variants", response_model=LayoutVariantsResponse)
async def optimize_layout_variants(request: LayoutVariantsRequest):
    import time
    start_time = time.time()

    try:
        validate_layout_v2_request(request)

        try:
            from multi_variant_solver import MultiVariantSolver
        except ImportError:
            raise HTTPException(
                status_code=501,
                detail="Multi-variant solver not available. Install workflow_analyzer.py and multi_variant_solver.py",
            )

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

        base_weights = {}
        if request.penalty_weights:
            pw = request.penalty_weights
            base_weights = {
                "area_deviation": pw.area_deviation,
                "min_width_violation": pw.min_width_violation,
                "aspect_ratio_violation": pw.aspect_ratio_violation,
                "adjacency_violation": pw.adjacency_violation,
                "exterior_wall_violation": pw.exterior_wall_violation,
                "overlap_collision": pw.overlap_collision,
                "fsi_violation": pw.fsi_violation,
                "plumbing_cluster_penalty": pw.plumbing_cluster_penalty,
                "acoustic_zone_violation": pw.acoustic_zone_violation,
                "clearance_violation": pw.clearance_violation,
                "grid_snap_deviation": pw.grid_snap_deviation,
                "circulation_excess": pw.circulation_excess,
                "span_violation": pw.span_violation,
                "beam_headroom_violation": pw.beam_headroom_violation,
                "solar_thermal_penalty": pw.solar_thermal_penalty,
                "fenestration_violation": pw.fenestration_violation,
                "egress_distance_violation": pw.egress_distance_violation,
                "compactness_penalty": pw.compactness_penalty,
                "zone_grouping_penalty": pw.zone_grouping_penalty,
            }

        solver = MultiVariantSolver(debug=False)
        variants = solver.generate_variants(
            rooms=room_nodes,
            site_config=site_cfg,
            base_penalty_weights=base_weights,
            timeout_per_variant_sec=30.0,
            adjacency_edges=edges,
            constraints=constraints,
        )

        variant_responses: List[VariantResponse] = []
        best_variant_id = None
        best_score = -1.0

        for variant in variants:
            score_resp = None
            if variant.score:
                score_resp = VariantScoreResponse(
                    variant_id=variant.score.variant_id,
                    strategy_name=variant.score.strategy_name,
                    strategy_description=variant.score.strategy_description,
                    composite_score=variant.score.composite_score,
                    compactness=variant.score.compactness,
                    zone_coherence=variant.score.zone_coherence,
                    adjacency_satisfaction=variant.score.adjacency_satisfaction,
                    circulation_efficiency=variant.score.circulation_efficiency,
                    usable_area_ratio=variant.score.usable_area_ratio,
                )

                if variant.score.composite_score > best_score:
                    best_score = variant.score.composite_score
                    best_variant_id = variant.variant_id

            raw = variant._raw_solver_output or {}
            placement_responses = [PlacementResponse(**p) for p in raw.get("placements", [])]
            compliance_raw = raw.get("compliance_items", [])
            compliance_item_responses = []
            for ci in compliance_raw:
                try:
                    compliance_item_responses.append(ComplianceItemResponse(**ci))
                except Exception:
                    pass

            variant_responses.append(
                VariantResponse(
                    variant_id=variant.variant_id,
                    strategy_key=variant.strategy_key,
                    strategy_name=variant.strategy_name,
                    strategy_description=variant.strategy_description,
                    score=score_resp,
                    placements=placement_responses,
                    penalty_weights_used=variant.penalty_weights,
                    compliance_items=compliance_item_responses,
                )
            )

        elapsed_ms = (time.time() - start_time) * 1000.0
        recommendation = "✨ Review all variants to choose your preferred architectural approach."
        if best_variant_id:
            best = next((v for v in variant_responses if v.variant_id == best_variant_id), None)
            if best:
                recommendation = f"✨ Recommended: '{best.strategy_name}' (highest quality score)"

        return LayoutVariantsResponse(
            success=True,
            total_variants_generated=len(variant_responses),
            variants=variant_responses,
            best_variant_id=best_variant_id,
            recommendation=recommendation,
            generated_at_ms=elapsed_ms,
        )

    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Multi-variant generation failed: {exc}") from exc
