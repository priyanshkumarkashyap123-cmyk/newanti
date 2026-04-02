from __future__ import annotations

# Wrapper module to expose reporting helpers inside the package path
# while retaining the legacy flat-module implementation.

from layout_solver_v2_reporting import build_full_report, build_compliance_items

__all__ = ["build_full_report", "build_compliance_items"]
