"""
Report helper utilities for tables and formatting.
"""

from __future__ import annotations

from reportlab.lib import colors
from reportlab.platypus import TableStyle

from typing import Any


def standard_table_style(primary_color) -> TableStyle:
    """Standard table style used across report tables."""
    return TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.Color(*primary_color)),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 10),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
        ('BACKGROUND', (0, 1), (-1, -1), colors.white),
        ('TEXTCOLOR', (0, 1), (-1, -1), colors.black),
        ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
        ('FONTSIZE', (0, 1), (-1, -1), 9),
        ('GRID', (0, 0), (-1, -1), 1, colors.grey),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.Color(0.95, 0.95, 0.95)]),
    ])


def critical_failures_table_style() -> TableStyle:
    """Table style for critical failures (red-accent)."""
    return TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.Color(0.8, 0.2, 0.2)),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 10),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
        ('BACKGROUND', (0, 1), (-1, -1), colors.white),
        ('TEXTCOLOR', (0, 1), (-1, -1), colors.black),
        ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
        ('FONTSIZE', (0, 1), (-1, -1), 9),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.Color(1.0, 0.95, 0.95)]),
        ('GRID', (0, 0), (-1, -1), 1, colors.Color(0.8, 0.2, 0.2, alpha=0.5)),
    ])


def fmt(value: Any, default: str = "N/A") -> Any:
    """Pass-through to safe formatting; caller can supply safe_float if needed."""
    try:
        return value if value is not None else default
    except Exception:
        return default
