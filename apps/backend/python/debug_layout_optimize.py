import os
os.environ["INTERNAL_SERVICE_SECRET"] = "beamlab_internal_secret_2026"
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

payload = {
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
        {"room_id_1": "living", "room_id_2": "kitchen", "score": 1.0},
        {"room_id_1": "kitchen", "room_id_2": "living", "score": 2.0},
    ],
    "max_iterations": 20,
    "random_seed": 42,
}
headers = {"x-internal-service": "beamlab_internal_secret_2026"}

resp = client.post('/api/layout/optimize', json=payload, headers=headers)
print('status', resp.status_code)
try:
    print('json:', resp.json())
except Exception as e:
    print('text:', resp.text)
    print('exception parsing json:', e)
