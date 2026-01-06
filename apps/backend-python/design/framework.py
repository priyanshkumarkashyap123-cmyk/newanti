from dataclasses import dataclass
from typing import Dict, List, Optional, Any
from abc import ABC, abstractmethod

@dataclass
class DesignMember:
    """Represents a member to be designed/checked"""
    id: str | int
    section_name: str
    section_properties: Dict[str, float]  # Area, Ixx, Iyy, Zxx, Zyy, etc.
    length: float
    material: Dict[str, float]  # Fy, E, etc.
    forces: Dict[str, float]  # P, Vx, Vy, Mz, My (Governance load case)
    
    # Design specific parameters
    unbraced_length_major: float  # Lb_major (Lx)
    unbraced_length_minor: float  # Lb_minor (Ly) for flexural buckling
    unbraced_length_ltb: float    # Lb_ltb for lateral-torsional buckling
    effective_length_factor_major: float = 1.0  # Kx
    effective_length_factor_minor: float = 1.0  # Ky
    cb: float = 1.0  # LTB modification factor

@dataclass
class DesignResult:
    """Result of a code check"""
    member_id: str | int
    ratio: float
    status: str  # "PASS" | "FAIL" | "WARNING"
    governing_check: str  # e.g. "Compression (Major Axis) - AISC E3"
    calculation_log: List[str]  # Steps for reporting
    capacity: Dict[str, float]  # Calculated capacities {Pn, Mn, Vn...}
    demand: Dict[str, float]    # Demands {Pu, Mu, Vu...}

class DesignCode(ABC):
    """Abstract base class for all design codes"""
    
    @abstractmethod
    def check_member(self, member: DesignMember) -> DesignResult:
        """Perform code check on a single member"""
        pass
    
    @property
    @abstractmethod
    def code_name(self) -> str:
        pass

class DesignFactory:
    """Factory to get the appropriate design code implementation"""
    _codes: Dict[str, Any] = {}
    
    @classmethod
    def register(cls, name: str, implementation_class: Any):
        cls._codes[name.upper()] = implementation_class
        
    @classmethod
    def get_code(cls, name: str) -> Optional[DesignCode]:
        code_class = cls._codes.get(name.upper())
        if code_class:
            return code_class()
        return None
