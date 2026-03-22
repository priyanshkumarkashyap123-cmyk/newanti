"""
models.py - Pydantic Data Schemas for Structural Models

Strict schemas to ensure valid JSON output for structural analysis.
"""

from typing import List, Optional, Dict
from enum import Enum
from pydantic import BaseModel, Field, field_validator, model_validator


# ============================================
# ENUMS
# ============================================

class SupportType(str, Enum):
    """Support boundary condition types."""
    PINNED = "PINNED"
    FIXED = "FIXED"
    ROLLER = "ROLLER"
    NONE = "NONE"


class MemberType(str, Enum):
    """Member category for visualization."""
    BEAM = "BEAM"
    COLUMN = "COLUMN"
    BRACE = "BRACE"
    CHORD = "CHORD"
    DIAGONAL = "DIAGONAL"
    VERTICAL = "VERTICAL"


# ============================================
# NODE SCHEMA
# ============================================

MAX_COORDINATE_M = 10_000.0  # ±10,000 m per Requirement 17.5
MAX_LOAD_KN = 1e9             # 1×10⁹ kN per Requirement 17.5


class Node(BaseModel):
    """
    Represents a structural node (joint/point) in 3D space.
    """
    id: str = Field(..., description="Unique node identifier")
    x: float = Field(..., description="X-coordinate in meters")
    y: float = Field(..., description="Y-coordinate in meters (vertical)")
    z: float = Field(default=0.0, description="Z-coordinate in meters")
    support: Optional[SupportType] = Field(default=SupportType.NONE, description="Support type")

    @field_validator('x', 'y', 'z')
    @classmethod
    def validate_coordinate(cls, v: float, info) -> float:
        """Reject coordinates exceeding ±10,000 m. Requirement 17.5."""
        if abs(v) > MAX_COORDINATE_M:
            raise ValueError(
                f"Node coordinate {info.field_name}={v} exceeds ±{MAX_COORDINATE_M} m limit"
            )
        return v

    class Config:
        json_schema_extra = {
            "example": {
                "id": "N1",
                "x": 0.0,
                "y": 0.0,
                "z": 0.0,
                "support": "PINNED"
            }
        }


# ============================================
# LOAD SCHEMA
# ============================================

class NodeLoad(BaseModel):
    """Nodal load applied to a node."""
    node_id: str = Field(..., description="Target node ID")
    fx: float = Field(default=0.0, description="Force in X direction (kN)")
    fy: float = Field(default=0.0, description="Force in Y direction (kN)")
    fz: float = Field(default=0.0, description="Force in Z direction (kN)")
    mx: float = Field(default=0.0, description="Moment about X axis (kN·m)")
    my: float = Field(default=0.0, description="Moment about Y axis (kN·m)")
    mz: float = Field(default=0.0, description="Moment about Z axis (kN·m)")

    @field_validator('fx', 'fy', 'fz', 'mx', 'my', 'mz')
    @classmethod
    def validate_load_magnitude(cls, v: float, info) -> float:
        """Reject load magnitudes exceeding 1×10⁹ kN. Requirement 17.5."""
        if abs(v) > MAX_LOAD_KN:
            raise ValueError(
                f"Load component {info.field_name}={v} exceeds ±{MAX_LOAD_KN} kN limit"
            )
        return v


# ============================================
# MEMBER SCHEMA
# ============================================

class Member(BaseModel):
    """
    Represents a structural member connecting two nodes.
    """
    id: str = Field(..., description="Unique member identifier")
    start_node: str = Field(..., description="Start node ID")
    end_node: str = Field(..., description="End node ID")
    section_profile: str = Field(default="ISMB300", description="Section designation")
    member_type: Optional[MemberType] = Field(default=MemberType.BEAM, description="Member category")

    class Config:
        json_schema_extra = {
            "example": {
                "id": "M1",
                "start_node": "N1",
                "end_node": "N2",
                "section_profile": "ISMB300",
                "member_type": "BEAM"
            }
        }


# ============================================
# STRUCTURAL MODEL SCHEMA
# ============================================

class StructuralModel(BaseModel):
    """
    Complete structural model containing nodes and members.
    """
    nodes: List[Node] = Field(default_factory=list, description="List of nodes")
    members: List[Member] = Field(default_factory=list, description="List of members")
    loads: List[NodeLoad] = Field(default_factory=list, description="List of nodal loads")
    metadata: Dict[str, str] = Field(default_factory=dict, description="Model metadata")

    @model_validator(mode='after')
    def validate_member_node_references(self) -> 'StructuralModel':
        """
        Reject members referencing non-existent node IDs. Requirement 17.5.
        """
        node_ids = {n.id for n in self.nodes}
        errors = []
        for member in self.members:
            if member.start_node not in node_ids:
                errors.append(
                    f"Member '{member.id}' references non-existent start_node '{member.start_node}'"
                )
            if member.end_node not in node_ids:
                errors.append(
                    f"Member '{member.id}' references non-existent end_node '{member.end_node}'"
                )
        if errors:
            raise ValueError("; ".join(errors))
        return self

    @model_validator(mode='after')
    def validate_load_node_references(self) -> 'StructuralModel':
        """
        Reject loads referencing non-existent node IDs. Requirement 17.5.
        """
        node_ids = {n.id for n in self.nodes}
        errors = []
        for load in self.loads:
            if load.node_id not in node_ids:
                errors.append(
                    f"Load references non-existent node_id '{load.node_id}'"
                )
        if errors:
            raise ValueError("; ".join(errors))
        return self

    class Config:
        json_schema_extra = {
            "example": {
                "nodes": [
                    {"id": "N1", "x": 0, "y": 0, "z": 0, "support": "PINNED"},
                    {"id": "N2", "x": 6, "y": 0, "z": 0, "support": "ROLLER"}
                ],
                "members": [
                    {"id": "M1", "start_node": "N1", "end_node": "N2", "section_profile": "ISMB300"}
                ],
                "metadata": {"name": "Simple Beam", "units": "kN, m"}
            }
        }


# ============================================
# REQUEST SCHEMAS
# ============================================

class ContinuousBeamRequest(BaseModel):
    """Request for continuous beam generation."""
    spans: List[float] = Field(..., description="List of span lengths in meters")
    intermediate_nodes: int = Field(default=10, description="Nodes per span for smooth rendering")


class TrussRequest(BaseModel):
    """Request for truss generation."""
    span: float = Field(..., description="Total span in meters")
    height: float = Field(..., description="Truss height in meters")
    bays: int = Field(..., description="Number of bays/panels")


class FrameRequest(BaseModel):
    """Request for 3D frame generation."""
    width: float = Field(..., description="Frame width (X) in meters")
    length: float = Field(..., description="Frame length (Z) in meters")
    height: float = Field(..., description="Story height in meters")
    stories: int = Field(..., description="Number of stories")
    bays_x: int = Field(default=2, description="Bays in X direction")
    bays_z: int = Field(default=2, description="Bays in Z direction")


class GenerateResponse(BaseModel):
    """Response wrapper for generation endpoints."""
    success: bool = True
    model: Optional[StructuralModel] = None
    error: Optional[str] = None
