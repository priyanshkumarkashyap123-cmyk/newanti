"""Regression tests for EnhancedAIBrain refactor safety."""

from __future__ import annotations

import ast
import inspect
import sys
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from enhanced_ai_brain import EnhancedAIBrain  # noqa: E402


def test_enhanced_ai_brain_has_single_add_bay_definition() -> None:
    """Prevent accidental duplicate method overrides inside the class body."""
    source = inspect.getsource(EnhancedAIBrain)
    tree = ast.parse(source)
    class_def = next(
        node for node in tree.body if isinstance(node, ast.ClassDef) and node.name == "EnhancedAIBrain"
    )
    add_bay_defs = [
        node
        for node in class_def.body
        if isinstance(node, ast.FunctionDef) and node.name == "_add_bay"
    ]
    assert len(add_bay_defs) == 1


def test_add_bay_extends_simple_frame() -> None:
    """Ensure bay extension uses the implemented method and mutates model as expected."""
    brain = EnhancedAIBrain()
    model = {
        "nodes": [
            {"id": "N1", "x": 0.0, "y": 0.0, "z": 0.0, "restraints": {"fx": True, "fy": True, "fz": True}},
            {"id": "N2", "x": 0.0, "y": 3.0, "z": 0.0},
        ],
        "members": [],
    }

    result = brain._add_bay(model, "right")

    assert result["success"] is True
    assert "Added bay" in result["message"]
    assert len(result["model"]["nodes"]) == 4
    assert len(result["model"]["members"]) == 3
