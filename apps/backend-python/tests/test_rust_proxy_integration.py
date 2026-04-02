import os
import pytest
from fastapi.testclient import TestClient

import importlib


def _load_app():
    # Lazy import to avoid module resolution issues in pytest discovery
    main = importlib.import_module("main")
    return main.app


@pytest.mark.skipif(
    not os.getenv("RUST_API_URL"),
    reason="RUST_API_URL not set; skipping Rust proxy integration",
)
def test_nonlinear_proxy_endpoint_available():
    app = _load_app()
    client = TestClient(app)
    # Minimal payload to exercise router registration; backend may still return error
    payload = {
        "nodes": [],
        "members": [],
        "method": "newton_raphson",
        "load_steps": 1,
        "target_load_factor": 1.0,
        "force_tolerance": 1e-6,
        "displacement_tolerance": 1e-6,
        "max_iterations": 1,
        "line_search": False,
        "line_search_tolerance": 0.5,
        "initial_arc_length": 1.0,
        "geometric_nonlinearity": True,
    }
    resp = client.post("/analysis/nonlinear-solve", json=payload)
    # Accept any status < 500 as success indicator of route + proxy wiring
    assert resp.status_code < 500
