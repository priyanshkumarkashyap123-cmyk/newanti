"""
Meshing module deprecated. No Python mesher available.
"""

from .mesh_generator import MeshGeneratorDeprecated, mesh_quad, mesh_tri, mesh_brick  # noqa: F401

__all__ = [
    "MeshGeneratorDeprecated",
    "mesh_quad",
    "mesh_tri",
    "mesh_brick",
]
