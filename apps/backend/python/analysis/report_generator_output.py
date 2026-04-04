"""Helpers for report generator output formatting and dict/table adapters."""

from __future__ import annotations

from typing import Any, Dict, Callable, List

from analysis.report.sections.utils import add_dict_as_table


def build_dict_table_adapter(styles) -> Callable[[str, Dict[str, Any]], List[Any]]:
    """Return a closure that adds a dict as a styled table using existing utils."""
    return lambda title, data: add_dict_as_table(title, data, styles)


__all__ = ["build_dict_table_adapter"]