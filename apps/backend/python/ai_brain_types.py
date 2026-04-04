"""Shared types for EnhancedAIBrain."""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Dict, List


class UserIntent(Enum):
    GENERATE_STRUCTURE = "generate_structure"
    GENERATE_FROM_TEMPLATE = "generate_from_template"
    MODIFY_SECTION = "modify_section"
    MODIFY_SUPPORT = "modify_support"
    MODIFY_LOAD = "modify_load"
    MODIFY_NODE = "modify_node"
    MODIFY_MEMBER = "modify_member"
    ADD_ELEMENT = "add_element"
    REMOVE_ELEMENT = "remove_element"
    SCALE_MODEL = "scale_model"
    ROTATE_MODEL = "rotate_model"
    MIRROR_MODEL = "mirror_model"
    EXTEND_MODEL = "extend_model"
    RUN_ANALYSIS = "run_analysis"
    CHECK_STABILITY = "check_stability"
    OPTIMIZE_DESIGN = "optimize_design"
    EXPLAIN_CONCEPT = "explain_concept"
    QUERY_MODEL = "query_model"
    QUERY_RESULTS = "query_results"
    GET_HELP = "get_help"
    UNKNOWN = "unknown"


@dataclass
class ParsedCommand:
    intent: UserIntent
    confidence: float
    entities: Dict[str, Any] = field(default_factory=dict)
    raw_text: str = ""
    suggestions: List[str] = field(default_factory=list)
