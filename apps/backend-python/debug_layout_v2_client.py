import os
os.environ["INTERNAL_SERVICE_SECRET"] = "beamlab_internal_secret_2026"
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

payload = {
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

headers = {"x-internal-service": "beamlab_internal_secret_2026"}

resp = client.post('/api/layout/v2/optimize', json=payload, headers=headers)
print('status', resp.status_code)
print('content-type', resp.headers.get('content-type'))
try:
    print('json:', resp.json())
except Exception as e:
    print('text:', resp.text)
    print('exception parsing json:', e)
