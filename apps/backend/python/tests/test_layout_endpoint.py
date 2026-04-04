"""Tests for /api/layout/optimize endpoint integration and validation."""

import os
import sys
from pathlib import Path

from fastapi.testclient import TestClient


BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))


def _build_valid_payload() -> dict:
    return {
        "site_width": 20.0,
        "site_height": 15.0,
        "rooms": [
            {
                "room_id": "living",
                "name": "Living Room",
                "target_area": 40.0,
                "min_width": 4.0,
                "max_aspect_ratio": 3.0,
                "min_aspect_ratio": 0.6,
                "requires_exterior_wall": True,
                "priority": 3,
            },
            {
                "room_id": "kitchen",
                "name": "Kitchen",
                "target_area": 20.0,
                "min_width": 3.0,
                "max_aspect_ratio": 2.5,
                "min_aspect_ratio": 0.7,
                "requires_exterior_wall": False,
                "priority": 2,
            },
        ],
        "adjacency_preferences": [
            {"room_id_1": "living", "room_id_2": "kitchen", "score": 2.0}
        ],
        "max_iterations": 20,
        "random_seed": 42,
    }


def _client_with_internal_auth() -> TestClient:
    # Must be >=16 chars per auth middleware policy.
    os.environ["INTERNAL_SERVICE_SECRET"] = "beamlab_internal_secret_2026"
    from main import app

    return TestClient(app)


def test_layout_optimize_rejects_unauthorized() -> None:
    from main import app

    client = TestClient(app)
    response = client.post("/api/layout/optimize", json=_build_valid_payload())

    assert response.status_code == 401


def test_layout_optimize_success_with_internal_header() -> None:
    client = _client_with_internal_auth()

    response = client.post(
        "/api/layout/optimize",
        json=_build_valid_payload(),
        headers={"x-internal-service": "beamlab_internal_secret_2026"},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["success"] is True
    assert len(body["placements"]) == 2
    assert "total_penalty" in body


def test_layout_optimize_rejects_conflicting_adjacency_pairs() -> None:
    client = _client_with_internal_auth()
    payload = _build_valid_payload()
    payload["adjacency_preferences"] = [
        {"room_id_1": "living", "room_id_2": "kitchen", "score": 1.0},
        {"room_id_1": "kitchen", "room_id_2": "living", "score": 2.0},
    ]

    response = client.post(
        "/api/layout/optimize",
        json=payload,
        headers={"x-internal-service": "beamlab_internal_secret_2026"},
    )

    assert response.status_code == 400
    assert "Conflicting adjacency scores" in response.json()["detail"]


def test_layout_optimize_rejects_invalid_aspect_bounds() -> None:
    client = _client_with_internal_auth()
    payload = _build_valid_payload()
    payload["rooms"][0]["min_aspect_ratio"] = 3.5
    payload["rooms"][0]["max_aspect_ratio"] = 1.5

    response = client.post(
        "/api/layout/optimize",
        json=payload,
        headers={"x-internal-service": "beamlab_internal_secret_2026"},
    )

    assert response.status_code == 400
    assert "Invalid aspect ratio bounds" in response.json()["detail"]
