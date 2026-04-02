"""Shared interoperability data models."""

from __future__ import annotations

from dataclasses import dataclass
from typing import List, Optional


@dataclass
class Node:
    """Node in structural model."""

    id: int
    x: float
    y: float
    z: float = 0
    support: Optional[str] = None


@dataclass
class Member:
    """Member connecting two nodes."""

    id: int
    start_node: int
    end_node: int
    section: str
    material: str = "Steel"
    releases: Optional[str] = None


@dataclass
class LoadCase:
    """Load case definition."""

    name: str
    type: str
    factor: float = 1.0


@dataclass
class NodalLoad:
    """Load applied at a node."""

    node_id: int
    load_case: str
    Fx: float = 0
    Fy: float = 0
    Fz: float = 0
    Mx: float = 0
    My: float = 0
    Mz: float = 0


@dataclass
class MemberLoad:
    """Distributed or point load on member."""

    member_id: int
    load_case: str
    load_type: str
    direction: str
    values: List[float]
    start_pos: float = 0
    end_pos: float = 1


@dataclass
class StructuralModel:
    """Complete structural model."""

    title: str
    nodes: List[Node]
    members: List[Member]
    load_cases: List[LoadCase]
    nodal_loads: List[NodalLoad]
    member_loads: List[MemberLoad]
    units: str = "SI"


__all__ = [
    "Node",
    "Member",
    "LoadCase",
    "NodalLoad",
    "MemberLoad",
    "StructuralModel",
]