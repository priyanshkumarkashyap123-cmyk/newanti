"""Core validation types and thresholds for model validation."""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from typing import List, Optional

from analysis.model_validator_config import load_validator_config


class IssueSeverity(Enum):
    """Severity levels for validation issues."""

    ERROR = "error"
    WARNING = "warning"
    INFO = "info"


class IssueType(Enum):
    """Types of validation issues."""

    # Stability issues
    NO_SUPPORTS = "no_supports"
    INSUFFICIENT_SUPPORTS = "insufficient_supports"
    MECHANISM_DETECTED = "mechanism_detected"
    RIGID_BODY_MOTION = "rigid_body_motion"

    # Geometry issues
    ZERO_LENGTH_MEMBER = "zero_length_member"
    OVERLAPPING_NODES = "overlapping_nodes"
    INVALID_MEMBER_REFERENCE = "invalid_member_reference"

    # Connectivity issues
    DISCONNECTED_NODES = "disconnected_nodes"
    DISCONNECTED_STRUCTURE = "disconnected_structure"
    FLOATING_NODE = "floating_node"

    # Stiffness issues
    EXTREME_STIFFNESS_RATIO = "extreme_stiffness_ratio"
    VERY_SLENDER_MEMBER = "very_slender_member"
    VERY_SHORT_MEMBER = "very_short_member"

    # Loading issues
    NO_LOADS = "no_loads"
    UNSUPPORTED_LOAD_NODE = "unsupported_load_node"
    LOAD_ON_MISSING_MEMBER = "load_on_missing_member"

    # Best practices
    MISSING_LATERAL_RESTRAINT = "missing_lateral_restrain" 
    ASYMMETRIC_SUPPORTS = "asymmetric_supports"


@dataclass
class ValidationIssue:
    """A single validation issue."""

    issue_type: IssueType
    severity: IssueSeverity
    message: str
    affected_elements: List[str] = field(default_factory=list)
    suggested_fix: Optional[str] = None
    auto_fixable: bool = False


@dataclass
class ValidationResult:
    """Complete validation result."""

    is_valid: bool
    issues: List[ValidationIssue] = field(default_factory=list)
    summary: str = ""
    error_count: int = 0
    warning_count: int = 0
    info_count: int = 0
    node_count: int = 0
    member_count: int = 0
    support_count: int = 0
    load_count: int = 0


# Thresholds (can be overridden via environment)
_cfg = load_validator_config()
MIN_NODE_DISTANCE = _cfg["MIN_NODE_DISTANCE"]
MAX_STIFFNESS_RATIO = _cfg["MAX_STIFFNESS_RATIO"]
MIN_MEMBER_LENGTH = _cfg["MIN_MEMBER_LENGTH"]
MIN_SUPPORTS_2D = _cfg["MIN_SUPPORTS_2D"]
MIN_SUPPORTS_3D = _cfg["MIN_SUPPORTS_3D"]
