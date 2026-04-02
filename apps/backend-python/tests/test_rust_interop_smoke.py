"""Smoke tests for Rust-first analysis interop.

These tests avoid legacy Python advanced-element solvers and only verify that
Rust interop entry points are importable and expose expected APIs.
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from analysis.rust_interop import (
    RustInteropClient,
    RustSolverResult,
    SolverBackend,
    analyze_with_best_backend,
    always_use_rust,
    get_rust_client,
)


def test_rust_interop_symbols_importable() -> None:
    assert RustInteropClient is not None
    assert RustSolverResult is not None
    assert SolverBackend is not None
    assert analyze_with_best_backend is not None
    assert always_use_rust is not None


def test_get_rust_client_returns_client_instance() -> None:
    client = get_rust_client()
    assert isinstance(client, RustInteropClient)


def test_backend_selection_policy() -> None:
    assert always_use_rust({}, SolverBackend.AUTO) is True
    assert always_use_rust({}, SolverBackend.RUST) is True
    assert always_use_rust({}, SolverBackend.PYTHON) is False
