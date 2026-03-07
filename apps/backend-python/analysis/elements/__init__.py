"""
Structural Element Library

Contains specialized element formulations:
- TimoshenkoBeam: Beam with shear deformation (thick beams)
- PlateElements: 2D plate and shell elements
- AdvancedElements: Links, solids, diaphragms, tension/compression-only
"""

from .timoshenko import TimoshenkoBeam, ElementType, BeamTheory
from .plate import MindlinPlate, PlateSection
from .advanced_elements import (
    GapElement,
    HookElement,
    FrictionPendulumElement,
    ViscousDamperElement,
    MultiLinearSpring,
    TensionOnlyMember,
    CompressionOnlyMember,
    Hex8Element,
    Hex20Element,
    KirchhoffPlate,
    DiaphragmConstraint,
    PhysicalToAnalyticalMesher,
    PhysicalMember,
    SolidMaterial,
    ELEMENT_REGISTRY,
)

__all__ = [
    'TimoshenkoBeam',
    'ElementType',
    'BeamTheory',
    'MindlinPlate',
    'PlateSection',
    # Advanced elements
    'GapElement',
    'HookElement',
    'FrictionPendulumElement',
    'ViscousDamperElement',
    'MultiLinearSpring',
    'TensionOnlyMember',
    'CompressionOnlyMember',
    'Hex8Element',
    'Hex20Element',
    'KirchhoffPlate',
    'DiaphragmConstraint',
    'PhysicalToAnalyticalMesher',
    'PhysicalMember',
    'SolidMaterial',
    'ELEMENT_REGISTRY',
]
