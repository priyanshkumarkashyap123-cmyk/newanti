import os
import json
from layout_solver_v2 import SiteConfig, Setbacks, GlobalConstraints, RoomNode, RoomType, LayoutSolverV2

site_cfg = SiteConfig(width=15.0, height=20.0, fsi_limit=1.5,
                      setbacks=Setbacks(front=3.0,rear=1.5,left=1.5,right=1.5),
                      north_angle_deg=45, latitude_deg=20.0)
constraints = GlobalConstraints()
rooms = [
    RoomNode(id='master_bed', type=RoomType.HABITABLE, target_area_sqm=16.0, min_width_m=3.2, max_aspect_ratio=1.5, requires_exterior_wall=True, plumbing_required=False),
    RoomNode(id='kitchen', type=RoomType.UTILITY, target_area_sqm=10.0, min_width_m=2.5, max_aspect_ratio=2.0, requires_exterior_wall=True, plumbing_required=True),
]

solver = LayoutSolverV2(site=site_cfg, constraints=constraints, rooms=rooms, adjacency_edges=[], weights=None, max_iterations=5, random_seed=42)
best = solver.solve()
print('placements_count=', len(best.placements))
print('placement_ids=', [p.room.id for p in best.placements])
print('best_solution_has_diags=', hasattr(best, 'diagnostics'))
try:
    report = solver.get_full_report()
    print('report_keys=', list(report.keys()))
    print('fsi_analysis=', json.dumps(report.get('fsi_analysis'), indent=2))
    print('usable_boundary=', json.dumps(report.get('usable_boundary'), indent=2))
    print('diagnostics=', json.dumps(report.get('diagnostics'), indent=2))
except Exception as e:
    print('get_full_report raised:', e)
