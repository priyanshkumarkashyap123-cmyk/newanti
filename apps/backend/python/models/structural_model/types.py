from __future__ import annotations
from typing import List, Optional, Dict, Any, Set
from pydantic import BaseModel, Field, validator, root_validator

MAX_COORDINATE = 10_000.0  # ±10,000 m
MAX_LOAD_MAGNITUDE = 1e9   # 1×10⁹ kN
MAX_NODES = 5_000
MAX_MEMBERS = 10_000


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

    @validator('load_type')
    def validate_load_type(cls, v):
        allowed = {'point', 'udl', 'moment', 'temperature', 'seismic'}
        if v not in allowed:
            raise ValueError(f"load_type '{v}' is invalid; allowed: {sorted(allowed)}")
        return v

    @validator('direction')
    def validate_direction(cls, v):
        if v is None:
            return v
        allowed = {'x', 'y', 'z', 'mx', 'my', 'mz'}
        if v not in allowed:
            raise ValueError(f"direction '{v}' is invalid; allowed: {sorted(allowed)}")
        return v

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
        from .sections import VALID_SECTIONS  # local import to avoid circulars
        if VALID_SECTIONS and v not in VALID_SECTIONS:
            raise ValueError(
                f"Unknown section profile '{v}'. "
                f"Use a valid IS, AISC, or European section designation."
            )
        return v

    @validator('end_node')
    def validate_not_self_connected(cls, end_node, values):
        start_node = values.get('start_node')
        if start_node is not None and end_node == start_node:
            raise ValueError("Member start_node and end_node cannot be identical")
        return end_node


class StructuralModel(BaseModel):
    """Complete structural model with full input validation."""
    nodes: List[NodeModel] = Field(default_factory=list)
    members: List[MemberModel] = Field(default_factory=list)
    loads: List[LoadModel] = Field(default_factory=list)
    metadata: Dict[str, Any] = Field(default_factory=dict)

    @root_validator
    def validate_member_node_references(cls, values):
        nodes = values.get('nodes', [])
        members = values.get('members', [])
        loads = values.get('loads', [])

        if len(nodes) > MAX_NODES:
            raise ValueError(f"Node count {len(nodes)} exceeds limit {MAX_NODES}")
        if len(members) > MAX_MEMBERS:
            raise ValueError(f"Member count {len(members)} exceeds limit {MAX_MEMBERS}")

        node_ids = {n.id for n in nodes}

        if len(node_ids) != len(nodes):
            raise ValueError("Duplicate node ids detected")

        for member in members:
            if member.start_node not in node_ids:
                raise ValueError(
                    f"Member '{member.id}' references non-existent start_node '{member.start_node}'"
                )
            if member.end_node not in node_ids:
                raise ValueError(
                    f"Member '{member.id}' references non-existent end_node '{member.end_node}'"
                )

        member_ids = {m.id for m in members}
        if len(member_ids) != len(members):
            raise ValueError("Duplicate member ids detected")

        for load in loads:
            if load.node_id and load.node_id not in node_ids:
                raise ValueError(f"Load targets missing node_id '{load.node_id}'")
            if load.member_id and load.member_id not in member_ids:
                raise ValueError(f"Load targets missing member_id '{load.member_id}'")
            if not load.node_id and not load.member_id:
                raise ValueError("Load must target a node_id or member_id")

        return values


__all__ = [
    "NodeModel",
    "MemberModel",
    "LoadModel",
    "StructuralModel",
    "MAX_COORDINATE",
    "MAX_LOAD_MAGNITUDE",
]
