"""Compatibility shim for section optimization endpoints."""

from .optimize.router import router  # re-exported router

__all__ = ["router"]