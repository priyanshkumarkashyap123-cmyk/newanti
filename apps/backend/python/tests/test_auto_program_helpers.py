import sys
import types
import enum
import importlib.util
from pathlib import Path

# Ensure backend package root is importable regardless of where pytest is invoked from.
BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

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

_orig_layout = sys.modules.get("layout_solver_v2")
try:
    sys.modules["layout_solver_v2"] = fake

    # Load routers/layout_v2.py in an isolated module namespace so this test
    # does not poison `routers.layout_v2` in sys.modules for later tests.
    layout_v2_path = BACKEND_ROOT / "routers" / "layout_v2.py"
    spec = importlib.util.spec_from_file_location("_isolated_layout_v2_test_mod", layout_v2_path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Unable to load layout_v2 module from {layout_v2_path}")
    layout_v2_mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(layout_v2_mod)
finally:
    # restore any original module to avoid polluting later tests
    if _orig_layout is not None:
        sys.modules["layout_solver_v2"] = _orig_layout
    else:
        del sys.modules["layout_solver_v2"]


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


def test_auto_program_small_plot_excludes_optional_rooms_even_if_requested():
    req = layout_v2_mod.MinimalAutoOptimizeRequest(
        site=layout_v2_mod.SiteRequest(dimensions_m=[8.0, 8.0]),  # 64 sqm
        bedroom_preference=2,
        include_study=True,
        include_guest_room=True,
        include_parking=True,
    )

    nodes = layout_v2_mod._build_auto_program_nodes(req)
    ids = {n.id for n in nodes}
    assert "guest_1" not in ids
    assert "study_1" not in ids
    assert "parking_1" not in ids


def test_auto_program_medium_plot_includes_parking_but_not_study_or_guest():
    req = layout_v2_mod.MinimalAutoOptimizeRequest(
        site=layout_v2_mod.SiteRequest(dimensions_m=[10.0, 12.0]),  # 120 sqm
        bedroom_preference=2,
        include_study=True,
        include_guest_room=True,
        include_parking=True,
    )

    nodes = layout_v2_mod._build_auto_program_nodes(req)
    ids = {n.id for n in nodes}
    assert "parking_1" in ids
    # guest requires >=140, study requires >=170 by current heuristics
    assert "guest_1" not in ids
    assert "study_1" not in ids


def test_auto_program_large_plot_includes_stair_guest_study_and_common_bath():
    req = layout_v2_mod.MinimalAutoOptimizeRequest(
        site=layout_v2_mod.SiteRequest(dimensions_m=[15.0, 12.0], num_floors=2),  # 180 sqm
        bedroom_preference=4,
        include_study=True,
        include_guest_room=True,
        include_parking=True,
    )

    nodes = layout_v2_mod._build_auto_program_nodes(req)
    ids = {n.id for n in nodes}

    assert "stair_1" in ids
    assert "guest_1" in ids
    assert "study_1" in ids
    assert "parking_1" in ids
    assert "bath_common_1" in ids
    bedroom_ids = [n.id for n in nodes if n.id.startswith("bed_")]
    assert len(bedroom_ids) == 3  # bedroom_preference=4 => master + 3 additional


def test_auto_program_adjacency_has_valid_room_ids_and_no_self_loops():
    req = layout_v2_mod.MinimalAutoOptimizeRequest(
        site=layout_v2_mod.SiteRequest(dimensions_m=[15.0, 12.0], num_floors=2),
        bedroom_preference=4,
        include_study=True,
        include_guest_room=True,
        include_parking=True,
    )

    nodes = layout_v2_mod._build_auto_program_nodes(req)
    ids = {n.id for n in nodes}
    edges = layout_v2_mod._build_auto_program_adjacency(nodes)

    assert len(edges) > 0
    for e in edges:
        assert e.node_a in ids
        assert e.node_b in ids
        assert e.node_a != e.node_b

    pair_set = {(e.node_a, e.node_b) for e in edges}
    assert ("entry_1", "living_1") in pair_set
    assert ("dining_1", "kitchen_1") in pair_set

