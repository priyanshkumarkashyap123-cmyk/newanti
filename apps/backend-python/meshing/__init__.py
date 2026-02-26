"""
Meshing Module for BeamLab FEA

Provides advanced mesh generation capabilities:
- Quad meshing with hard point constraints
- Constrained Delaunay Triangulation with holes
- Brick element meshing for solids
- Super elements for shear walls
"""

from .mesh_generator import (
    Point2D,
    Point3D,
    ElementType,
    PlateElement,
    TriElement,
    BrickElement,
    SuperElement,
    QuadMesher,
    ConstrainedDelaunay,
    BrickMesher,
    SuperElementGenerator,
    MeshQuality,
    mesh_plate,
    triangulate_with_holes
)

__all__ = [
    'Point2D',
    'Point3D',
    'ElementType',
    'PlateElement',
    'TriElement',
    'BrickElement',
    'SuperElement',
    'QuadMesher',
    'ConstrainedDelaunay',
    'BrickMesher',
    'SuperElementGenerator',
    'MeshQuality',
    'mesh_plate',
    'triangulate_with_holes'
]
