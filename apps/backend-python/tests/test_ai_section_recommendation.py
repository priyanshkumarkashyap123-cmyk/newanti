"""
Test AI Section Recommendation endpoints
"""

import os
from unittest.mock import patch

from fastapi.testclient import TestClient

INTERNAL_SECRET = "test-internal-secret-for-testing-only-1234567890123456"

# Keep INTERNAL_SERVICE_SECRET set for the duration of the tests.
os.environ["INTERNAL_SERVICE_SECRET"] = INTERNAL_SECRET

from main import app

client = TestClient(app)
internal_headers = {"X-Internal-Service": INTERNAL_SECRET}


def test_section_recommendation_endpoint():
    """AI section recommendation returns a valid payload."""
    request_data = {
        "axial_force": 100.0,  # kN
        "shear_force": 50.0,  # kN
        "bending_moment": 25.0,  # kN·m
        "deflection_limit": 10.0,  # mm
        "span_length": 5.0,  # m
        "code": "IS800",
        "material": "steel",
        "utilization_target": 0.8,
        "max_results": 3,
    }

    response = client.post(
        "/ai/section-recommend",
        json=request_data,
        headers=internal_headers,
    )
    assert response.status_code == 200

    data = response.json()
    assert data["success"] in (True, False)
    assert "recommendations" in data
    assert "count" in data

    if data["success"]:
        assert isinstance(data["recommendations"], list)
        assert data["count"] == len(data["recommendations"])
        assert data["count"] <= request_data["max_results"]

        if data["recommendations"]:
            rec = data["recommendations"][0]
            required_fields = [
                "section_name",
                "section_type",
                "properties",
                "design_checks",
                "score",
                "reasoning",
            ]
            for field in required_fields:
                assert field in rec


def test_section_optimization_endpoint():
    """AI section optimization returns an optimal section when possible."""
    request_data = {
        "axial_force": 200.0,
        "shear_force": 75.0,
        "bending_moment": 50.0,
        "deflection_limit": 15.0,
        "span_length": 6.0,
        "code": "IS800",
        "material": "steel",
        "utilization_target": 0.8,
        "optimization_goal": "balanced",
        "constraints": {
            "max_cost_per_m": 5000,
            "max_weight_per_m": 50,
        },
    }

    response = client.post(
        "/ai/section-optimize",
        json=request_data,
        headers=internal_headers,
    )
    assert response.status_code == 200

    data = response.json()
    assert data["success"] in (True, False)
    assert "optimization" in data

    if data["success"] and data["optimization"]:
        opt = data["optimization"]
        assert "optimal_section" in opt
        assert "optimization_metrics" in opt

        section = opt["optimal_section"]
        required_fields = ["section_name", "section_type", "properties", "design_checks", "score"]
        for field in required_fields:
            assert field in section


def test_section_recommendation_invalid_input():
    """Invalid numeric input should fail request validation."""
    request_data = {
        "axial_force": "invalid",  # Should be number
        "shear_force": 50.0,
        "bending_moment": 25.0,
        "code": "INVALID_CODE",
        "material": "steel",
        "utilization_target": 0.8,
        "max_results": 3,
    }

    response = client.post(
        "/ai/section-recommend",
        json=request_data,
        headers=internal_headers,
    )

    assert response.status_code == 422
    data = response.json()
    assert data["success"] is False


def test_section_optimization_edge_cases():
    """Optimization should degrade gracefully across load extremes."""
    request_data = {
        "axial_force": 0,
        "shear_force": 0,
        "bending_moment": 0,
        "code": "IS800",
        "material": "steel",
        "utilization_target": 0.8,
        "optimization_goal": "cost",
    }

    response = client.post(
        "/ai/section-optimize",
        json=request_data,
        headers=internal_headers,
    )
    assert response.status_code == 200

    request_data_high = {
        "axial_force": 10000,  # Very high axial load
        "shear_force": 1000,
        "bending_moment": 1000,
        "code": "IS800",
        "material": "steel",
        "utilization_target": 0.8,
        "optimization_goal": "safety",
    }

    response_high = client.post(
        "/ai/section-optimize",
        json=request_data_high,
        headers=internal_headers,
    )
    assert response_high.status_code == 200

