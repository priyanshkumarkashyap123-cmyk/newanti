"""
Shared Pydantic schemas for design endpoints.
"""

from typing import Optional, List, Dict
from pydantic import BaseModel, Field


class DesignCheckMemberInput(BaseModel):
    member_id: str = Field(max_length=128)
    section_name: str = Field(default="Unknown", max_length=128)
    section_properties: Dict = Field(default_factory=dict)
    length: float = Field(default=0.0, ge=0)
    material: Dict = Field(default_factory=dict)
    forces: Dict = Field(default_factory=dict)
    unbraced_length_major: Optional[float] = None
    unbraced_length_minor: Optional[float] = None
    unbraced_length_ltb: Optional[float] = None
    Kx: float = Field(default=1.0, ge=0, le=10)
    Ky: float = Field(default=1.0, ge=0, le=10)
    Cb: float = Field(default=1.0, ge=0, le=10)


class DesignCheckRequest(BaseModel):
    code: str = Field(default="AISC360-16", max_length=64)
    method: str = Field(default="LRFD", max_length=32)
    members: List[DesignCheckMemberInput] = Field(default_factory=list, max_length=10_000)


class BeamDesignRequest(BaseModel):
    width: float
    depth: float
    cover: float = 40
    Mu: float
    Vu: float
    Tu: float = 0
    code: str = 'IS456'
    fck: float = 25
    fy: float = 500
    stirrup_dia: float = 8
    main_bar_dia: float = 16
    span: float = 0
    w_factored: float = 0
    support_condition: str = 'simple'
    n_sections: int = 11
    section_forces: Optional[List[Dict]] = None


class ColumnDesignRequest(BaseModel):
    width: float
    depth: float
    cover: float = 40
    Pu: float
    Mux: float = 0
    Muy: float = 0
    unsupported_length: float
    effective_length_factor: float = 1.0
    code: str = 'IS456'
    fck: float = 25
    fy: float = 500
    Mux_top: Optional[float] = None
    Mux_bottom: Optional[float] = None
    Muy_top: Optional[float] = None
    Muy_bottom: Optional[float] = None
    n_sections: int = 5


class SlabDesignRequest(BaseModel):
    lx: float
    ly: float = 0
    live_load: float
    floor_finish: float = 1.0
    support_type: str = 'simple'
    edge_conditions: str = 'all_simple'
    code: str = 'IS456'
    fck: float = 25
    fy: float = 500


class SteelMemberDesignRequest(BaseModel):
    """Direct IS 800:2007 steel member design"""
    section_name: str = "Custom"
    depth: float
    width: float
    web_thickness: float
    flange_thickness: float
    root_radius: float = 0
    area: float = 0
    Iz: float = 0
    Iy: float = 0
    Zz: float = 0
    Zy: float = 0
    Zpz: float = 0
    Zpy: float = 0
    rz: float = 0
    ry: float = 0
    length: float
    effective_length_y: Optional[float] = None
    effective_length_z: Optional[float] = None
    unbraced_length: Optional[float] = None
    Cb: float = 1.0
    N: float = 0
    Vy: float = 0
    Vz: float = 0
    My: float = 0
    Mz: float = 0
    T: float = 0
    steel_grade: str = 'E250'
    code: str = 'IS800'
