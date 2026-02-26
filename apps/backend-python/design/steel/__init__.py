"""
Steel Design Module
"""
from .is800 import (
    SectionClass,
    BucklingClass,
    SteelGrade,
    SectionProperties,
    MemberGeometry,
    DesignForces,
    DesignCheck,
    SteelDesignResult,
    IS800Designer,
    GAMMA_M0,
    GAMMA_M1,
    GAMMA_M2,
)

from .aisc360 import AISC360Designer

# Eurocode 3 imports (aliased where necessary to avoid conflicts)
from .eurocode3 import (
    Eurocode3Designer,
    EC3SectionClass,
    SectionProperties as EC3SectionProperties,
    DesignForces as EC3DesignForces
)

__all__ = [
    # IS 800 (Primary/Shared data structures)
    'SectionClass',
    'BucklingClass',
    'SteelGrade',
    'SectionProperties',
    'MemberGeometry',
    'DesignForces',
    'DesignCheck',
    'SteelDesignResult',
    'IS800Designer',
    'GAMMA_M0',
    'GAMMA_M1',
    'GAMMA_M2',
    
    # AISC 360
    'AISC360Designer',
    
    # Eurocode 3
    'Eurocode3Designer',
    'EC3SectionClass',
    'EC3SectionProperties',
    'EC3DesignForces'
]
