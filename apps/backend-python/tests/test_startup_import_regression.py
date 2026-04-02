"""Regression guard for backend startup imports.

This test ensures the FastAPI app entrypoint remains importable after
architecture cleanups and module moves.
"""

import os
import sys
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))


def test_main_imports_cleanly() -> None:
    import main as backend_main

    assert backend_main.app is not None


def test_rust_interop_imports_cleanly() -> None:
    from analysis import rust_interop

    assert rust_interop.get_rust_client is not None
    assert rust_interop.analyze_with_best_backend is not None
