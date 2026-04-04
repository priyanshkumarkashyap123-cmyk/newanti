"""Compatibility shim for design code checking endpoints."""

from fastapi import APIRouter

from .design_check.router import router  # re-exported router

__all__ = ["router"]
