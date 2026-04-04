"""Focused tests for browser-origin validation middleware."""

from fastapi import FastAPI
from fastapi.testclient import TestClient

from security_middleware import OriginValidationMiddleware


app = FastAPI()
app.add_middleware(
    OriginValidationMiddleware,
    allowed_origins=[
        "https://beamlabultimate.tech",
        "https://www.beamlabultimate.tech",
    ],
)


@app.post("/mutate")
async def mutate():
    return {"ok": True}


@app.get("/health")
async def health():
    return {"status": "ok"}


client = TestClient(app)


def test_allowed_origin_passes():
    response = client.post(
        "/mutate",
        headers={"Origin": "https://beamlabultimate.tech"},
    )
    assert response.status_code == 200
    assert response.json() == {"ok": True}


def test_bad_origin_is_blocked():
    response = client.post(
        "/mutate",
        headers={"Origin": "https://evil.example.com"},
    )
    assert response.status_code == 403
    assert response.json()["error"] == "Origin not allowed"


def test_get_requests_are_not_blocked():
    response = client.get(
        "/health",
        headers={"Origin": "https://evil.example.com"},
    )
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
