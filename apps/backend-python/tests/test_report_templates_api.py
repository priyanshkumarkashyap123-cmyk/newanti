"""Tests for org-scoped report template CRUD endpoints."""

import os
import sys
from pathlib import Path

from fastapi.testclient import TestClient

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

AUTH_SECRET = "beamlab_internal_secret_2026"


def _client() -> TestClient:
    os.environ["INTERNAL_SERVICE_SECRET"] = AUTH_SECRET
    from main import app

    return TestClient(app)


def _headers() -> dict:
    return {"x-internal-service": AUTH_SECRET}


def _create_payload(actor_user_id: str, actor_role: str = "member", is_published: bool = False) -> dict:
    return {
        "template_name": "Seismic Template",
        "description": "IS 1893 report preset",
        "section_toggles": {
            "include_cover_page": True,
            "include_analysis_results": True,
            "include_design_checks": True,
        },
        "diagram_toggles": {
            "include_sfd": True,
            "include_bmd": True,
            "include_deflection": False,
        },
        "ordering": ["cover", "summary", "analysis", "codeCheck"],
        "metadata_defaults": {"designCodes": "IS 456:2000, IS 1893:2016"},
        "is_published": is_published,
        "actor_user_id": actor_user_id,
        "actor_role": actor_role,
    }


def test_create_draft_template_as_member() -> None:
    client = _client()

    response = client.post(
        "/reports/orgs/org-1/templates",
        json=_create_payload("user-a", "member", False),
        headers=_headers(),
    )

    assert response.status_code == 200
    body = response.json()
    assert body["org_id"] == "org-1"
    assert body["template_name"] == "Seismic Template"
    assert body["is_published"] is False
    assert body["created_by"] == "user-a"


def test_member_cannot_create_published_template() -> None:
    client = _client()

    response = client.post(
        "/reports/orgs/org-2/templates",
        json=_create_payload("user-a", "member", True),
        headers=_headers(),
    )

    assert response.status_code == 403
    assert "Only admins" in response.json()["detail"]


def test_admin_can_create_published_template() -> None:
    client = _client()

    response = client.post(
        "/reports/orgs/org-2/templates",
        json=_create_payload("admin-a", "admin", True),
        headers=_headers(),
    )

    assert response.status_code == 200
    assert response.json()["is_published"] is True


def test_list_shows_published_and_own_drafts_only() -> None:
    client = _client()

    # Draft by user-a
    client.post(
        "/reports/orgs/org-3/templates",
        json=_create_payload("user-a", "member", False),
        headers=_headers(),
    )
    # Published by admin
    client.post(
        "/reports/orgs/org-3/templates",
        json=_create_payload("admin-a", "admin", True),
        headers=_headers(),
    )

    # user-b should only see published template
    response_user_b = client.get(
        "/reports/orgs/org-3/templates",
        params={"actor_user_id": "user-b"},
        headers=_headers(),
    )
    assert response_user_b.status_code == 200
    templates_user_b = response_user_b.json()
    assert len(templates_user_b) == 1
    assert templates_user_b[0]["is_published"] is True

    # user-a should see own draft + published
    response_user_a = client.get(
        "/reports/orgs/org-3/templates",
        params={"actor_user_id": "user-a"},
        headers=_headers(),
    )
    assert response_user_a.status_code == 200
    templates_user_a = response_user_a.json()
    assert len(templates_user_a) == 2


def test_owner_can_update_draft_template() -> None:
    client = _client()

    created = client.post(
        "/reports/orgs/org-4/templates",
        json=_create_payload("user-a", "member", False),
        headers=_headers(),
    ).json()
    template_id = created["template_id"]

    response = client.put(
        f"/reports/orgs/org-4/templates/{template_id}",
        json={
            "template_name": "Updated Template",
            "actor_user_id": "user-a",
            "actor_role": "member",
        },
        headers=_headers(),
    )

    assert response.status_code == 200
    assert response.json()["template_name"] == "Updated Template"


def test_non_owner_member_cannot_update_template() -> None:
    client = _client()

    created = client.post(
        "/reports/orgs/org-5/templates",
        json=_create_payload("user-a", "member", False),
        headers=_headers(),
    ).json()
    template_id = created["template_id"]

    response = client.put(
        f"/reports/orgs/org-5/templates/{template_id}",
        json={
            "template_name": "Illicit Update",
            "actor_user_id": "user-b",
            "actor_role": "member",
        },
        headers=_headers(),
    )

    assert response.status_code == 403


def test_member_cannot_publish_on_update() -> None:
    client = _client()

    created = client.post(
        "/reports/orgs/org-6/templates",
        json=_create_payload("user-a", "member", False),
        headers=_headers(),
    ).json()
    template_id = created["template_id"]

    response = client.put(
        f"/reports/orgs/org-6/templates/{template_id}",
        json={
            "is_published": True,
            "actor_user_id": "user-a",
            "actor_role": "member",
        },
        headers=_headers(),
    )

    assert response.status_code == 403


def test_admin_can_delete_any_template() -> None:
    client = _client()

    created = client.post(
        "/reports/orgs/org-7/templates",
        json=_create_payload("user-a", "member", False),
        headers=_headers(),
    ).json()
    template_id = created["template_id"]

    response = client.delete(
        f"/reports/orgs/org-7/templates/{template_id}",
        params={"actor_user_id": "admin-a", "actor_role": "admin"},
        headers=_headers(),
    )

    assert response.status_code == 200
    assert response.json()["success"] is True


def test_owner_can_delete_own_template() -> None:
    client = _client()

    created = client.post(
        "/reports/orgs/org-8/templates",
        json=_create_payload("user-a", "member", False),
        headers=_headers(),
    ).json()
    template_id = created["template_id"]

    response = client.delete(
        f"/reports/orgs/org-8/templates/{template_id}",
        params={"actor_user_id": "user-a", "actor_role": "member"},
        headers=_headers(),
    )

    assert response.status_code == 200


def test_non_owner_member_cannot_delete_template() -> None:
    client = _client()

    created = client.post(
        "/reports/orgs/org-9/templates",
        json=_create_payload("user-a", "member", False),
        headers=_headers(),
    ).json()
    template_id = created["template_id"]

    response = client.delete(
        f"/reports/orgs/org-9/templates/{template_id}",
        params={"actor_user_id": "user-b", "actor_role": "member"},
        headers=_headers(),
    )

    assert response.status_code == 403
