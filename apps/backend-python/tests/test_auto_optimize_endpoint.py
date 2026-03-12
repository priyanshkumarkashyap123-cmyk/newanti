import sys
import types
import enum
import asyncio

# Fake layout_solver_v2 to avoid heavy native deps during unit tests
fake = types.ModuleType("layout_solver_v2")

class _RoomType(enum.Enum):
    habitable = "habitable"
    utility = "utility"
    wet = "wet"
    circulation = "circulation"
    staircase = "staircase"

class _AcousticZone(enum.Enum):
    active = "active"
    passive = "passive"
    service = "service"
    buffer = "buffer"

class _Simple:
    def __init__(self, *args, **kwargs):
        pass

fake.RoomType = _RoomType
fake.AcousticZone = _AcousticZone
fake.AdjacencyEdge = _Simple
fake.GlobalConstraints = _Simple
fake.LayoutSolverV2 = _Simple
fake.PenaltyWeightsV2 = _Simple
fake.RoomNode = _Simple
fake.Setbacks = _Simple
fake.SimulatedAnnealingSolver = _Simple
fake.SiteConfig = _Simple

sys.modules["layout_solver_v2"] = fake

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
                    "dimensions": {"w": 2.0, "h": 3.0},
                    "aspect_ratio": 1.5,
                    "min_dimension_m": 1.8,
                    "width_valid": True,
                    "aspect_ratio_valid": True,
                    "plumbing_required": False,
                    "requires_exterior_wall": True,
                }
            ],
        }


def test_auto_optimize_endpoint_monkeypatched():
    # Patch the heavy LayoutSolverV2 with a lightweight stub and call the async endpoint directly
    layout_v2_mod.LayoutSolverV2 = StubSolver

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
