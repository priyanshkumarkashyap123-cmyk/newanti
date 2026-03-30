import pytest
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

# Minimal design member payload for beam
sample_member = {
    "id": "test_beam",
    "type": "beam",
    "width": 300,
    "depth": 500,
    "length": 4000,
    "effective_length_factor": 1.0,
    "forces": {"axial": 0, "shearY": 0, "shearZ": 0, "torsion": 0, "momentY": 0, "momentZ": 0},
    "fck": 25,
    "fy": 500,
    "cover": 25
}

@pytest.mark.parametrize("version", [None, "V2025Sandbox"])
def test_concrete_check_version_variants(version):
    payload = {"members": [sample_member]}
    if version:
        payload["version"] = version
    response = client.post("/concrete/check", json=payload)
    assert response.status_code == 200
    result = response.json()
    # Expect a list with one MemberResult and ratio numeric
    assert isinstance(result, list) and len(result) == 1
    member = result[0]
    assert member["memberId"] == "test_beam"
    assert "overallRatio" in member and isinstance(member["overallRatio"], (int, float))
    assert "checks" in member and isinstance(member["checks"], list)
