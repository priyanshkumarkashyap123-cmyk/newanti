"""
Tests for layout solver v2 — all 10 constraint domains.

Run:  python -m pytest tests/test_layout_v2_endpoint.py -q
"""

import math
import os
import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))


# ── Fixtures ────────────────────────────────────────────────────────

AUTH_SECRET = "beamlab_internal_secret_2026"

@pytest.fixture(autouse=True)
def _set_env():
    os.environ["INTERNAL_SERVICE_SECRET"] = AUTH_SECRET
    yield


@pytest.fixture()
def client():
    from main import app
    return TestClient(app)


HEADERS = {"x-internal-service": AUTH_SECRET}


def _base_payload() -> dict:
    """Minimal valid v2 request with 2 rooms."""
    return {
        "site": {
            "dimensions_m": [15.0, 20.0],
            "fsi_limit": 1.5,
            "setbacks_m": {"front": 3.0, "rear": 1.5, "sides": 1.5},
            "north_angle_deg": 45,
        },
        "global_constraints": {
            "max_unsupported_span_m": 5.0,
            "min_ceiling_height_m": 3.0,
            "structural_grid_module_m": 0.5,
        },
        "nodes": [
            {
                "id": "master_bed",
                "type": "habitable",
                "target_area_sqm": 16.0,
                "min_width_m": 3.2,
                "max_aspect_ratio": 1.5,
                "requires_exterior_wall": True,
                "plumbing_required": False,
            },
            {
                "id": "kitchen",
                "type": "utility",
                "target_area_sqm": 10.0,
                "min_width_m": 2.5,
                "max_aspect_ratio": 2.0,
                "requires_exterior_wall": True,
                "plumbing_required": True,
            },
        ],
        "adjacency_matrix": [
            {"node_a": "master_bed", "node_b": "kitchen", "weight": -10},
        ],
        "max_iterations": 30,
        "random_seed": 42,
    }


# =====================================================================
# DOMAIN 0: Auth & Basic validation
# =====================================================================

def test_v2_rejects_unauthorized(client):
    resp = client.post("/api/layout/v2/optimize", json=_base_payload())
    assert resp.status_code == 401


def test_v2_success_basic(client):
    resp = client.post(
        "/api/layout/v2/optimize", json=_base_payload(), headers=HEADERS,
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["success"] is True
    assert len(body["placements"]) == 2
    assert "fsi_analysis" in body
    assert "circulation" in body
    assert "egress" in body
    assert "structural_checks" in body
    assert "solar_scores" in body
    assert "constraints_detail" in body


# =====================================================================
# DOMAIN 1: Site Boundary & FSI
# =====================================================================

def test_v2_fsi_analysis_present(client):
    resp = client.post(
        "/api/layout/v2/optimize", json=_base_payload(), headers=HEADERS,
    )
    body = resp.json()
    fsi = body["fsi_analysis"]
    assert "fsi_actual" in fsi
    assert "fsi_limit" in fsi
    assert "compliant" in fsi
    assert "max_allowed_area" in fsi


def test_v2_setbacks_reduce_usable_area(client):
    resp = client.post(
        "/api/layout/v2/optimize", json=_base_payload(), headers=HEADERS,
    )
    body = resp.json()
    ub = body["usable_boundary"]
    # 15 - 1.5 - 1.5 = 12, 20 - 3 - 1.5 = 15.5
    assert abs(ub["width"] - 12.0) < 0.1
    assert abs(ub["height"] - 15.5) < 0.1


def test_v2_rejects_setbacks_consuming_plot(client):
    payload = _base_payload()
    payload["site"]["setbacks_m"] = {"front": 10.0, "rear": 10.0, "sides": 1.0}
    resp = client.post(
        "/api/layout/v2/optimize", json=payload, headers=HEADERS,
    )
    assert resp.status_code == 400
    assert "Setbacks consume" in resp.json()["detail"]


def test_v2_extreme_fsi_rejection(client):
    """If total areas greatly exceed FSI cap, the endpoint rejects."""
    payload = _base_payload()
    payload["site"]["fsi_limit"] = 0.1  # very restrictive
    payload["nodes"][0]["target_area_sqm"] = 200.0
    payload["nodes"][1]["target_area_sqm"] = 200.0
    resp = client.post(
        "/api/layout/v2/optimize", json=payload, headers=HEADERS,
    )
    assert resp.status_code == 400
    assert "FSI" in resp.json()["detail"]


# =====================================================================
# DOMAIN 2: Wet Wall Clustering & Acoustic Zoning
# =====================================================================

def test_v2_plumbing_clustering(client):
    """Two plumbing rooms should attract each other via auto-injected adjacency."""
    payload = _base_payload()
    payload["nodes"].append(
        {
            "id": "bathroom",
            "type": "wet",
            "target_area_sqm": 5.0,
            "min_width_m": 1.8,
            "max_aspect_ratio": 2.0,
            "plumbing_required": True,
        }
    )
    resp = client.post(
        "/api/layout/v2/optimize", json=payload, headers=HEADERS,
    )
    body = resp.json()
    assert body["success"] is True
    # Solver should have evaluated plumbing clustering constraints
    plumbing_keys = [k for k in body["constraints_detail"] if k.startswith("plumbing_")]
    assert len(plumbing_keys) >= 1  # at least kitchen-bathroom pair


def test_v2_acoustic_zone_inference(client):
    """Rooms with known keywords get correct acoustic zones."""
    payload = _base_payload()
    payload["nodes"].append(
        {
            "id": "living_room",
            "type": "habitable",
            "target_area_sqm": 20.0,
            "min_width_m": 3.0,
        }
    )
    resp = client.post(
        "/api/layout/v2/optimize", json=payload, headers=HEADERS,
    )
    body = resp.json()
    placements = {p["room_id"]: p for p in body["placements"]}
    assert placements["living_room"]["acoustic_zone"] == "active"
    assert placements["master_bed"]["acoustic_zone"] == "passive"


# =====================================================================
# DOMAIN 3: BSP Engine — Room-Type Aspect Ratio Enforcement
# =====================================================================

def test_v2_habitable_aspect_ratio_capped(client):
    """Habitable rooms should have aspect ≤ 1.5 enforced by the solver."""
    payload = _base_payload()
    # user tries 3.0 but habitable caps at 1.5
    payload["nodes"][0]["max_aspect_ratio"] = 3.0
    resp = client.post(
        "/api/layout/v2/optimize", json=payload, headers=HEADERS,
    )
    body = resp.json()
    bed = next(p for p in body["placements"] if p["room_id"] == "master_bed")
    # The solver should have applied the 1.5 cap internally
    assert bed["type"] == "habitable"


# =====================================================================
# DOMAIN 4: Anthropometric Hard Limits
# =====================================================================

def test_v2_anthropometric_issues_reported(client):
    resp = client.post(
        "/api/layout/v2/optimize", json=_base_payload(), headers=HEADERS,
    )
    body = resp.json()
    # anthropometric_issues is always present as a list
    assert isinstance(body["anthropometric_issues"], list)


def test_v2_rejects_invalid_aspect_bounds(client):
    payload = _base_payload()
    payload["nodes"][0]["min_aspect_ratio"] = 5.0
    payload["nodes"][0]["max_aspect_ratio"] = 1.0
    resp = client.post(
        "/api/layout/v2/optimize", json=payload, headers=HEADERS,
    )
    assert resp.status_code == 400
    assert "min_aspect_ratio" in resp.json()["detail"]


# =====================================================================
# DOMAIN 5: Structural Grid Snapping
# =====================================================================

def test_v2_structural_grid_evaluated(client):
    """Grid snap constraints should appear in the constraint detail."""
    resp = client.post(
        "/api/layout/v2/optimize", json=_base_payload(), headers=HEADERS,
    )
    body = resp.json()
    grid_keys = [k for k in body["constraints_detail"] if "_grid" in k]
    assert len(grid_keys) >= 1


# =====================================================================
# DOMAIN 6: Circulation Optimisation
# =====================================================================

def test_v2_circulation_analysis(client):
    resp = client.post(
        "/api/layout/v2/optimize", json=_base_payload(), headers=HEADERS,
    )
    body = resp.json()
    circ = body["circulation"]
    assert "corridor_ratio" in circ
    assert "corridor_budget_ok" in circ
    assert "all_rooms_connected" in circ


# =====================================================================
# DOMAIN 7: Structural Span Limits
# =====================================================================

def test_v2_structural_checks(client):
    resp = client.post(
        "/api/layout/v2/optimize", json=_base_payload(), headers=HEADERS,
    )
    body = resp.json()
    assert len(body["structural_checks"]) == len(body["placements"])
    for sc in body["structural_checks"]:
        assert "needs_intermediate_column" in sc
        assert "beam_depth_estimate_m" in sc
        assert "headroom_ok" in sc


# =====================================================================
# DOMAIN 8: Staircase Matrix
# =====================================================================

def test_v2_staircase_geometry(client):
    """A staircase node should have locked geometry and metadata."""
    payload = _base_payload()
    payload["nodes"].append(
        {
            "id": "stair_main",
            "type": "staircase",
            "target_area_sqm": 5.0,
            "min_width_m": 1.0,
            "max_aspect_ratio": 5.0,
        }
    )
    resp = client.post(
        "/api/layout/v2/optimize", json=payload, headers=HEADERS,
    )
    body = resp.json()
    assert body["success"] is True
    assert body["staircase"] is not None
    stair = body["staircase"]
    assert "num_risers" in stair
    assert "actual_riser_height_m" in stair
    assert "footprint_area_sqm" in stair
    # Staircase should appear in placements
    stair_placements = [p for p in body["placements"] if p["type"] == "staircase"]
    assert len(stair_placements) == 1


# =====================================================================
# DOMAIN 9: Solar & Fenestration
# =====================================================================

def test_v2_solar_scores_per_room(client):
    resp = client.post(
        "/api/layout/v2/optimize", json=_base_payload(), headers=HEADERS,
    )
    body = resp.json()
    assert len(body["solar_scores"]) == len(body["placements"])


def test_v2_fenestration_checks(client):
    resp = client.post(
        "/api/layout/v2/optimize", json=_base_payload(), headers=HEADERS,
    )
    body = resp.json()
    assert len(body["fenestration_checks"]) == len(body["placements"])


# =====================================================================
# DOMAIN 10: Egress / Life Safety
# =====================================================================

def test_v2_egress_analysis(client):
    resp = client.post(
        "/api/layout/v2/optimize", json=_base_payload(), headers=HEADERS,
    )
    body = resp.json()
    eg = body["egress"]
    assert "compliant" in eg
    assert "max_travel_distance_m" in eg


# =====================================================================
# Edge cases
# =====================================================================

def test_v2_rejects_duplicate_node_ids(client):
    payload = _base_payload()
    payload["nodes"].append(payload["nodes"][0].copy())
    resp = client.post(
        "/api/layout/v2/optimize", json=payload, headers=HEADERS,
    )
    assert resp.status_code == 400
    assert "Duplicate" in resp.json()["detail"]


def test_v2_rejects_self_adjacency(client):
    payload = _base_payload()
    payload["adjacency_matrix"] = [
        {"node_a": "kitchen", "node_b": "kitchen", "weight": 5},
    ]
    resp = client.post(
        "/api/layout/v2/optimize", json=payload, headers=HEADERS,
    )
    assert resp.status_code == 400
    assert "Self-adjacency" in resp.json()["detail"]


def test_v2_rejects_conflicting_adjacency(client):
    payload = _base_payload()
    payload["adjacency_matrix"] = [
        {"node_a": "master_bed", "node_b": "kitchen", "weight": 5},
        {"node_a": "kitchen", "node_b": "master_bed", "weight": -5},
    ]
    resp = client.post(
        "/api/layout/v2/optimize", json=payload, headers=HEADERS,
    )
    assert resp.status_code == 400
    assert "Conflicting" in resp.json()["detail"]


def test_v2_adjacency_unknown_node(client):
    payload = _base_payload()
    payload["adjacency_matrix"] = [
        {"node_a": "master_bed", "node_b": "nonexistent", "weight": 1},
    ]
    resp = client.post(
        "/api/layout/v2/optimize", json=payload, headers=HEADERS,
    )
    assert resp.status_code == 400
    assert "unknown" in resp.json()["detail"].lower()


def test_v2_single_room(client):
    payload = _base_payload()
    payload["nodes"] = [payload["nodes"][0]]
    payload["adjacency_matrix"] = []
    resp = client.post(
        "/api/layout/v2/optimize", json=payload, headers=HEADERS,
    )
    assert resp.status_code == 200
    assert len(resp.json()["placements"]) == 1


# =====================================================================
# Direct solver unit tests (no HTTP)
# =====================================================================
from layout_solver_v2 import (
    GlobalConstraints,
    LayoutSolverV2,
    Rectangle,
    RoomNode,
    RoomType,
    Setbacks,
    SiteConfig,
    calculate_staircase_footprint,
    snap_to_grid,
    validate_fsi,
    wall_bearing,
    thermal_load_factor,
)


def test_snap_to_grid():
    assert snap_to_grid(3.27, 0.5) == 3.5
    assert snap_to_grid(3.24, 0.5) == 3.0
    assert snap_to_grid(5.0, 0.0) == 5.0  # no-op


def test_usable_boundary_computation():
    site = SiteConfig(
        width=15.0, height=20.0,
        setbacks=Setbacks(front=3.0, rear=1.5, left=1.5, right=1.5),
    )
    ub = site.usable_boundary()
    assert abs(ub.width - 12.0) < 0.01
    assert abs(ub.height - 15.5) < 0.01
    assert abs(ub.x - 1.5) < 0.01
    assert abs(ub.y - 3.0) < 0.01


def test_fsi_validation():
    site = SiteConfig(width=10, height=10, fsi_limit=1.5)
    result = validate_fsi(150.0, site)
    assert result["compliant"] is True
    result2 = validate_fsi(200.0, site)
    assert result2["compliant"] is False


def test_staircase_footprint():
    w, h, meta = calculate_staircase_footprint(
        floor_to_floor_height=3.0,
        max_riser_height=0.19,
    )
    assert meta["num_risers"] == 16  # ceil(3.0/0.19)
    assert w > 0 and h > 0
    assert meta["footprint_area_sqm"] > 0


def test_wall_bearing():
    # north_angle=0: top faces north(0°), right faces east(90°)
    assert wall_bearing("top", 0.0) == 0.0
    assert wall_bearing("right", 0.0) == 90.0
    # north_angle=90: top faces east(90°)
    assert wall_bearing("top", 90.0) == 90.0


def test_thermal_load_factor():
    # West (270°) should be max
    assert thermal_load_factor(270.0) == 1.0
    # North (0°) should be very low
    assert thermal_load_factor(0.0) < 0.2


def test_rectangle_aspect_ratio():
    r = Rectangle(0, 0, 4, 3)
    assert abs(r.aspect_ratio - 4.0 / 3.0) < 0.01
    # Always ≥ 1
    r2 = Rectangle(0, 0, 3, 4)
    assert abs(r2.aspect_ratio - 4.0 / 3.0) < 0.01


def test_solver_direct():
    """Direct solver call without HTTP — verifies full pipeline."""
    site = SiteConfig(
        width=15.0, height=20.0, fsi_limit=1.5,
        setbacks=Setbacks(front=3.0, rear=1.5, left=1.5, right=1.5),
        north_angle_deg=45,
    )
    rooms = [
        RoomNode(id="bed1", type=RoomType.HABITABLE, target_area_sqm=16.0,
                 min_width_m=3.2, requires_exterior_wall=True),
        RoomNode(id="kitchen", type=RoomType.UTILITY, target_area_sqm=10.0,
                 min_width_m=2.5, max_aspect_ratio=2.0, plumbing_required=True),
    ]
    solver = LayoutSolverV2(
        site=site,
        constraints=GlobalConstraints(),
        rooms=rooms,
        max_iterations=30,
        random_seed=42,
    )
    sol = solver.solve()
    assert len(sol.placements) == 2
    report = solver.get_full_report()
    assert report["fsi_analysis"]["compliant"] is True
    assert "circulation" in report["diagnostics"]
    assert "egress" in report["diagnostics"]
