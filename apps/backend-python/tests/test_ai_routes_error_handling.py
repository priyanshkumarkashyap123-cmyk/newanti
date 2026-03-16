"""Tests for hardened AI route error handling."""

from __future__ import annotations

import asyncio
import sys
from pathlib import Path

import pytest
from fastapi import HTTPException

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from ai_routes import DiagnoseRequest, ModifyRequest, diagnose_model, modify_model  # noqa: E402


class _ValueErrorAssistant:
    def modify(self, model, command):
        raise ValueError("bad modify request")


class _OkAssistant:
    def diagnose(self, model):
        return {"is_valid": True, "summary": "ok", "issues": []}


def test_modify_maps_value_error_to_400() -> None:
    request = ModifyRequest(model={"nodes": [], "members": []}, command="anything")
    with pytest.raises(HTTPException) as exc:
        asyncio.run(modify_model(request, assistant=_ValueErrorAssistant()))

    assert exc.value.status_code == 400
    assert "bad modify request" in str(exc.value.detail)


def test_diagnose_still_returns_200_on_success() -> None:
    request = DiagnoseRequest(model={"nodes": [], "members": []})
    body = asyncio.run(diagnose_model(request, assistant=_OkAssistant()))
    assert body["is_valid"] is True
