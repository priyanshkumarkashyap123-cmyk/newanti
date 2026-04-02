"""Report generator API facade.

This package preserves the import path ``analysis.report_generator`` while
loading the legacy orchestrator module at ``analysis/report_generator.py``.
"""

from importlib.util import module_from_spec, spec_from_file_location
from pathlib import Path

_legacy_path = Path(__file__).resolve().parents[1] / "report_generator.py"
_legacy_spec = spec_from_file_location("analysis._legacy_report_generator", _legacy_path)
if _legacy_spec is None or _legacy_spec.loader is None:
    raise ImportError(f"Unable to load report generator from {_legacy_path}")

_legacy_module = module_from_spec(_legacy_spec)
_legacy_spec.loader.exec_module(_legacy_module)

ReportGenerator = _legacy_module.ReportGenerator
ReportSettings = _legacy_module.ReportSettings
CHECK_CLAUSE_MAP = _legacy_module.CHECK_CLAUSE_MAP
CODE_DEFAULT_CLAUSE = _legacy_module.CODE_DEFAULT_CLAUSE

__all__ = ["ReportGenerator", "ReportSettings", "CHECK_CLAUSE_MAP", "CODE_DEFAULT_CLAUSE"]