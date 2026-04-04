"""
Shared models for Rust backend interop.
"""

from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Dict, List, Optional


class SolverBackend(str, Enum):
    """Which backend to use for solving"""
    PYTHON = "python"
    RUST = "rust"
    AUTO = "auto"  # Auto-select based on model size


@dataclass
class RustSolverResult:
    """Result from Rust backend solver"""
    success: bool
    backend_used: str
    solve_time_ms: float
    displacements: Optional[Dict[str, List[float]]] = None
    reactions: Optional[Dict[str, List[float]]] = None
    member_forces: Optional[List[Dict]] = None
    modes: Optional[List[Dict]] = None
    error: Optional[str] = None
    metadata: Dict[str, Any] = field(default_factory=dict)
