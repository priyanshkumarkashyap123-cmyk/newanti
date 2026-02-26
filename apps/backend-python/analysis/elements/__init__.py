"""
Structural Element Library

Contains specialized element formulations:
- TimoshenkoBeam: Beam with shear deformation (thick beams)
- PlateElements: 2D plate and shell elements (future)
"""

from .timoshenko import TimoshenkoBeam, ElementType, BeamTheory
from .plate import MindlinPlate, PlateSection

__all__ = [
    'TimoshenkoBeam', 
    'ElementType', 
    'BeamTheory',
    'MindlinPlate',
    'PlateSection'
]
