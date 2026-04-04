import sys
import asyncio
from pathlib import Path

import pytest

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from routers import layout_v2 as layout_v2_mod


class StubSolver:
    def __init__(self, *args, **kwargs):
        self.best_solution = None

    def solve(self):
        # no-op solve
        return None

    def get_full_report(self):
        return {
            "total_penalty": 0.0,
            "iteration_found": 1,
            "total_iterations": 1,
            "constraints_met_ratio": 1.0,
            "fsi_analysis": {},
            "usable_boundary": {},
            "diagnostics": {
                "circulation": {},
                "egress": {},
                "structural_checks": [],
                "solar_scores": [],
                "fenestration_checks": [],
                "anthropometric_issues": [],
            },
            "constraints_detail": {},
            "compliance_items": [],
            "placements": [
                {
                    "room_id": "entry_1",
                    "name": "Entrance Lobby",
                    "type": "circulation",
                    "acoustic_zone": "buffer",
                    "target_area_sqm": 6.0,
                    "actual_area_sqm": 6.0,
                    "area_deviation_pct": 0.0,
                    "position": {"x": 0.0, "y": 0.0},
                    "dimensions": {"width": 2.0, "height": 3.0},
                    "aspect_ratio": 1.5,
                    "min_dimension_m": 1.8,
                    "width_valid": True,
                    "aspect_ratio_valid": True,
                    "plumbing_required": False,
                    "requires_exterior_wall": True,
                }
            ],
        }


def test_auto_optimize_endpoint_monkeypatched(monkeypatch: pytest.MonkeyPatch):
    # Patch the heavy LayoutSolverV2 with a lightweight stub and call the async endpoint directly
    monkeypatch.setattr(layout_v2_mod, "LayoutSolverV2", StubSolver)

    payload = {
        "site": {"dimensions_m": [10.0, 12.0], "fsi_limit": 1.5, "setbacks_m": {"front": 3.0, "rear": 1.5}},
        "main_entry_direction": "N",
        "road_sides": ["N"],
        "bedroom_preference": 2,
        "include_study": False,
        "include_guest_room": False,
        "include_parking": False,
        "max_iterations": 10,
        "random_seed": 42,
    }

    req_obj = layout_v2_mod.MinimalAutoOptimizeRequest(**payload)

    result = asyncio.run(layout_v2_mod.optimize_layout_v2_auto(req_obj))
    assert result.success is True
    assert isinstance(result.placements, list)
    assert len(result.placements) >= 1
