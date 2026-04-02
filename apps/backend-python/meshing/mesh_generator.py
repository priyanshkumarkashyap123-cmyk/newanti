"""Deprecated meshing module.

Meshing is handled by other services. This stub remains only for import
compatibility and will raise if invoked.
"""


class MeshGeneratorDeprecated(Exception):
    """Raised when deprecated meshing APIs are called."""


def mesh_quad(*args, **kwargs):
    raise MeshGeneratorDeprecated("mesh_generator is deprecated; no Python mesher available")


def mesh_tri(*args, **kwargs):
    raise MeshGeneratorDeprecated("mesh_generator is deprecated; no Python mesher available")


def mesh_brick(*args, **kwargs):
    raise MeshGeneratorDeprecated("mesh_generator is deprecated; no Python mesher available")


__all__ = [
    "mesh_quad",
    "mesh_tri",
    "mesh_brick",
    "MeshGeneratorDeprecated",
]
