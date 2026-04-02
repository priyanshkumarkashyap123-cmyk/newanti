"""Shared defaults/constants for analysis router.

Centralizes numeric and string defaults to reduce hardcoded values.
"""

from typing import Dict, Any

BACKEND_AUTO = "auto"
BACKEND_PYTHON = "python"
BACKEND_RUST = "rust"
# Python backends are deprecated; keep constants for backward compatibility but restrict allowed set to rust/auto.
ALLOWED_BACKENDS = {BACKEND_AUTO, BACKEND_RUST}

DEFAULT_METHOD_AUTO = "auto"
DEFAULT_SOLVER_DIRECT = "direct"
DEFAULT_NONLINEAR_METHOD = "newton-raphson"

DEFAULT_BEAM_E = 200e6
DEFAULT_BEAM_I = 1e-4
DEFAULT_FRAME_E = 200e6
DEFAULT_FRAME_G = 77e6

DEFAULT_RUST_E = 200e9
DEFAULT_MEMBER_A = 0.01
DEFAULT_MEMBER_I = 1e-4
DEFAULT_MEMBER_J = 1e-5

DEFAULT_DEBUG_COMPARE_TOLERANCE = 1e-2
DEFAULT_PDELTA_COMPARE_TOLERANCE = 1e-4
DEFAULT_BUCKLING_COMPARE_TOLERANCE = 1e-3
DEFAULT_TOLERANCE = 1e-6
DEFAULT_MAX_ITERATIONS = 10
DEFAULT_NUM_MODES = 5

DEFAULT_NONLINEAR_MAX_ITEMS = 100_000
MAX_ANALYSIS_NODES = 100_000


def default_nonlinear_settings() -> Dict[str, Any]:
    """Return default nonlinear settings as a fresh dict."""
    return {
        "method": DEFAULT_NONLINEAR_METHOD,
        "steps": DEFAULT_MAX_ITERATIONS,
    }
