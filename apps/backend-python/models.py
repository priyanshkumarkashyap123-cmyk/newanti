"""
models.py - Pydantic Data Schemas for Structural Models

Strict schemas to ensure valid JSON output for structural analysis.
"""

from typing import List, Optional, Dict
from enum import Enum
from pydantic import BaseModel, Field


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

class Node(BaseModel):
    """
    Represents a structural node (joint/point) in 3D space.
    """
    id: str = Field(..., description="Unique node identifier")
    x: float = Field(..., description="X-coordinate in meters")
    y: float = Field(..., description="Y-coordinate in meters (vertical)")
    z: float = Field(default=0.0, description="Z-coordinate in meters")
    support: Optional[SupportType] = Field(default=SupportType.NONE, description="Support type")

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
    metadata: Dict[str, str] = Field(default_factory=dict, description="Model metadata")

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
