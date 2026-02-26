"""
Foundation Design Package

Implements foundation design:
- Isolated footings
- Combined footings
- Mat/Raft foundations
"""

from .footing import (
    SoilType,
    IsolatedFooting,
    CombinedFooting,
    MatFoundation,
    FoundationDesigner
)

__all__ = [
    'SoilType',
    'IsolatedFooting',
    'CombinedFooting',
    'MatFoundation',
    'FoundationDesigner'
]
