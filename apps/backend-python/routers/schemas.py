"""
Shared Pydantic schemas used across multiple router modules.
"""

from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any


# ── Frame/Structural Analysis Shared Models ──

class FrameNodeInput(BaseModel):
    id: str
    x: float
    y: float
    z: float
    support: Optional[str] = "none"


class FrameMemberInput(BaseModel):
    id: str
    startNodeId: str
    endNodeId: str
    E: Optional[float] = 200e6
    G: Optional[float] = 77e6
    Iy: Optional[float] = 1e-4
    Iz: Optional[float] = 1e-4
    J: Optional[float] = 1e-5
    A: Optional[float] = 0.01


class NodeLoadInput(BaseModel):
    nodeId: str
    fx: Optional[float] = 0
    fy: Optional[float] = 0
    fz: Optional[float] = 0
    mx: Optional[float] = 0
    my: Optional[float] = 0
    mz: Optional[float] = 0


class FramePlateInput(BaseModel):
    id: str
    nodeIds: List[str]
    thickness: float
    E: Optional[float] = 200e6
    nu: Optional[float] = 0.3
    pressure: Optional[float] = 0.0


class MemberDistLoadInput(BaseModel):
    """Distributed load on a frame member"""
    memberId: str
    direction: str = "Fy"  # Fx, Fy, Fz for local axes
    w1: float = 0  # Start value (kN/m)
    w2: Optional[float] = None  # End value for trapezoidal (defaults to w1)
    x1: Optional[float] = 0  # Start position (0-1 fraction)
    x2: Optional[float] = 1  # End position (0-1 fraction)
    isRatio: Optional[bool] = True
    case: str = "D"  # Load case


# ── Advanced FEM Element Inputs ──

class PlateElementInput(BaseModel):
    """Plate/shell element (Mindlin-Reissner or Kirchhoff)"""
    id: str
    nodes: List[str]  # 4 node IDs for Q4
    thickness: float = 0.2
    E: Optional[float] = 30e6
    nu: Optional[float] = 0.2
    rho: Optional[float] = 2400.0
    formulation: Optional[str] = "thick"  # "thick" | "thin"


class SolidElementInput(BaseModel):
    """8 or 20-node solid (brick) element"""
    id: str
    nodes: List[str]  # 8 or 20 node IDs
    E: Optional[float] = 200e6
    nu: Optional[float] = 0.3
    rho: Optional[float] = 7850.0
    element_type: Optional[str] = "hex8"  # "hex8" | "hex20"
    use_bbar: Optional[bool] = False


class LinkElementInput(BaseModel):
    """Non-linear link element (gap, hook, friction pendulum, etc.)"""
    id: str
    node_i: str
    node_j: str
    link_type: str = "gap"  # gap | hook | friction_pendulum | viscous_damper | multilinear
    direction: Optional[int] = 0  # 0=X, 1=Y, 2=Z
    properties: Optional[Dict[str, Any]] = {}


class DiaphragmInput(BaseModel):
    """Rigid or semi-rigid floor diaphragm constraint"""
    floor_z: float
    master_node: str
    slave_nodes: List[str]
    k_membrane: Optional[float] = None  # None = rigid
    mass: Optional[float] = 0.0
    mmoi: Optional[float] = 0.0
