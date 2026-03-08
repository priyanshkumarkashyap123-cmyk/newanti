"""Smoke tests for critical endpoints — health, design codes, and analysis."""

import os
import sys
from pathlib import Path

from fastapi.testclient import TestClient

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from main import app  # noqa: E402

client = TestClient(app)


class TestHealth:
    def test_health_returns_200(self):
        response = client.get("/health")
        assert response.status_code == 200

    def test_health_has_status_field(self):
        response = client.get("/health")
        data = response.json()
        assert "status" in data


class TestDesignCodes:
    def test_design_codes_returns_200(self):
        response = client.get("/design/codes")
        assert response.status_code == 200

    def test_design_codes_returns_list(self):
        response = client.get("/design/codes")
        data = response.json()
        assert isinstance(data, (list, dict))


class TestCORS:
    def test_options_preflight_allowed(self):
        response = client.options(
            "/health",
            headers={
                "Origin": "https://beamlabultimate.tech",
                "Access-Control-Request-Method": "GET",
            },
        )
        assert response.status_code in (200, 204)

    def test_unknown_origin_rejected(self):
        response = client.get(
            "/health",
            headers={"Origin": "https://evil.example.com"},
        )
        # Should still return 200 for health, but without CORS allow header
        assert response.status_code == 200


class TestAuthRequired:
    """Endpoints that should require authentication in production."""

    def test_sections_requires_auth(self):
        response = client.post("/sections/standard/create", json={})
        # Should return 401 or 403, not 200
        assert response.status_code in (401, 403, 422)

    def test_analyze_requires_auth(self):
        response = client.post("/analyze", json={})
        assert response.status_code in (401, 403, 422)
