import sys
import types
import enum

# Provide a lightweight fake 'layout_solver_v2' module so tests can import
# routers.layout_v2 without requiring heavy native deps (shapely, etc.).
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


def test_build_auto_program_nodes_basic():
    req = layout_v2_mod.MinimalAutoOptimizeRequest(
        site=layout_v2_mod.SiteRequest(dimensions_m=[10.0, 12.0]),
        bedroom_preference=3,
        include_study=False,
        include_guest_room=False,
        include_parking=False,
    )

    nodes = layout_v2_mod._build_auto_program_nodes(req)
    # Expect at least: entry, living, kitchen, dining, master, master bath + (bedrooms-1)
    ids = {n.id for n in nodes}
    assert "entry_1" in ids
    assert "living_1" in ids
    assert "kitchen_1" in ids
    assert "master_1" in ids
    # bedroom_preference=3 → master + 2 bedrooms → bed_1, bed_2 present
    assert any(n.id.startswith("bed_") for n in nodes)

