"""
structural_model.py — Pydantic StructuralModel with input validation.

Validators reject:
- Node coordinates outside ±10,000 m
- Load magnitudes > 1×10⁹ kN
- Members referencing non-existent node IDs
- Unknown section profile names

All validators return HTTP 422 with field-level error details.

Requirements: 20.1, 20.2, 20.3, 20.4, 20.5
"""

from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field, validator, root_validator
import sys
import os

# Import section database for profile validation
try:
    sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    from data import section_database
    KNOWN_SECTIONS = set(section_database.SECTION_DATABASE.keys()) if hasattr(section_database, 'SECTION_DATABASE') else set()
except Exception:
    KNOWN_SECTIONS = set()

# Fallback: common IS sections
FALLBACK_SECTIONS = {
    'ISMB100', 'ISMB150', 'ISMB200', 'ISMB250', 'ISMB300', 'ISMB350',
    'ISMB400', 'ISMB450', 'ISMB500', 'ISMB550', 'ISMB600',
    'ISMC75', 'ISMC100', 'ISMC125', 'ISMC150', 'ISMC175', 'ISMC200',
    'ISMC225', 'ISMC250', 'ISMC300', 'ISMC350', 'ISMC400',
    'ISA50x50x5', 'ISA65x65x6', 'ISA75x75x6', 'ISA100x100x8',
    'W8X31', 'W10X49', 'W12X65', 'W14X82', 'W16X100', 'W18X119',
    'HEA100', 'HEA120', 'HEA140', 'HEA160', 'HEA180', 'HEA200',
    'IPE100', 'IPE120', 'IPE140', 'IPE160', 'IPE180', 'IPE200',
}

VALID_SECTIONS = KNOWN_SECTIONS | FALLBACK_SECTIONS

MAX_COORDINATE = 10_000.0  # ±10,000 m
MAX_LOAD_MAGNITUDE = 1e9   # 1×10⁹ kN


class NodeModel(BaseModel):
    """Structural node with coordinate validation."""
    id: str = Field(..., description="Unique node identifier")
    x: float = Field(..., description="X-coordinate in meters")
    y: float = Field(..., description="Y-coordinate in meters")
    z: float = Field(default=0.0, description="Z-coordinate in meters")
    support: Optional[str] = Field(default=None)

    @validator('x', 'y', 'z')
    def validate_coordinate(cls, v, field):
        if abs(v) > MAX_COORDINATE:
            raise ValueError(
                f"Node coordinate {field.name}={v} exceeds ±{MAX_COORDINATE} m limit"
            )
        return v


class LoadModel(BaseModel):
    """Structural load with magnitude validation."""
    node_id: Optional[str] = None
    member_id: Optional[str] = None
    load_type: str = Field(default='point')
    values: List[float] = Field(default_factory=list)
    direction: Optional[str] = None

    @validator('values', each_item=True)
    def validate_load_magnitude(cls, v):
        if abs(v) > MAX_LOAD_MAGNITUDE:
            raise ValueError(
                f"Load magnitude {v} exceeds ±{MAX_LOAD_MAGNITUDE} kN limit"
            )
        return v


class MemberModel(BaseModel):
    """Structural member with section profile validation."""
    id: str = Field(..., description="Unique member identifier")
    start_node: str = Field(..., description="Start node ID")
    end_node: str = Field(..., description="End node ID")
    section_profile: str = Field(default='ISMB300', description="Section designation")
    member_type: Optional[str] = Field(default='BEAM')

    @validator('section_profile')
    def validate_section_profile(cls, v):
        if VALID_SECTIONS and v not in VALID_SECTIONS:
            raise ValueError(
                f"Unknown section profile '{v}'. "
                f"Use a valid IS, AISC, or European section designation."
            )
        return v


class StructuralModel(BaseModel):
    """
    Complete structural model with full input validation.

    Validates:
    - Node coordinates within ±10,000 m
    - Load magnitudes ≤ 1×10⁹ kN
    - Members reference existing node IDs
    - Section profiles are known
    """
    nodes: List[NodeModel] = Field(default_factory=list)
    members: List[MemberModel] = Field(default_factory=list)
    loads: List[LoadModel] = Field(default_factory=list)
    metadata: Dict[str, Any] = Field(default_factory=dict)

    @root_validator
    def validate_member_node_references(cls, values):
        nodes = values.get('nodes', [])
        members = values.get('members', [])

        node_ids = {n.id for n in nodes}

        for member in members:
            if member.start_node not in node_ids:
                raise ValueError(
                    f"Member '{member.id}' references non-existent start_node '{member.start_node}'"
                )
            if member.end_node not in node_ids:
                raise ValueError(
                    f"Member '{member.id}' references non-existent end_node '{member.end_node}'"
                )

        return values
