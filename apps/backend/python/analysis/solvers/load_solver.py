"""
load_solver.py - Load application and solver execution module (shim)

Keeps the original public API by re-exporting split submodules:
- load_solver_types: LoadType, PointLoad, UniformLoad, TrapezoidalLoad
- load_solver_converters: LoadConverter
- load_solver_assembler: LoadAssembler
- load_solver_solver: SolverExecutor
- load_solver_back_substitution: BackSubstitution
"""

from __future__ import annotations

import logging

from load_results_formatter import AnalysisResultFormatter

from .load_solver_types import LoadType, PointLoad, TrapezoidalLoad, UniformLoad
from .load_solver_converters import LoadConverter
from .load_solver_assembler import LoadAssembler
from .load_solver_solver import SolverExecutor
from .load_solver_back_substitution import BackSubstitution

logger = logging.getLogger(__name__)

__all__ = [
    "LoadType",
    "PointLoad",
    "TrapezoidalLoad",
    "UniformLoad",
    "LoadConverter",
    "LoadAssembler",
    "SolverExecutor",
    "BackSubstitution",
    "AnalysisResultFormatter",
]


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    print("load_solver module imported successfully (shim)")
