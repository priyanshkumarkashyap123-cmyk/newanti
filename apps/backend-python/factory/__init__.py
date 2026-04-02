"""
factory/__init__.py - Factory package re-export

Re-exports all generator classes to maintain backward compatibility.
The original factory.py can be kept as a backup or deprecated.
"""

from .beam_generators import BeamGenerator
from .truss_generators import TrussGenerator
from .frame_generators import FrameGenerator
from .arch_generators import ArchGenerator
from .constants import (
    # Section profiles
    SECTION_ISMB_400,
    SECTION_ISMB_350,
    SECTION_ISMB_300,
    SECTION_ISMB_250,
    SECTION_ISA_100x100x10,
    SECTION_ISA_75x75x8,
    SECTION_ISA_50x50x6,
    PROFILES,
    # Material constants
    DEFAULT_YOUNGS_MODULUS,
    DEFAULT_SHEAR_MODULUS,
    DEFAULT_CROSS_SECTION_AREA,
    DEFAULT_INERTIA,
    DEFAULT_TORSION_CONSTANT,
    # Support types
    SUPPORT_TYPES,
    # Member types
    MEMBER_TYPES,
    # Tolerance
    COORDINATE_PRECISION,
    DEFAULT_INTERMEDIATE_NODES,
)


class StructuralFactory:
    """
    Factory class for mathematically generating structural models.
    
    This class aggregates all generator types and provides a unified interface.
    All coordinates are in meters. Y-axis is vertical.
    
    Generators:
    - BeamGenerator: continuous beams, simple beams, portal frames
    - TrussGenerator: Pratt, Warren, Howe, bridge, space trusses
    - FrameGenerator: 3D frames, towers, multi-bay portals
    - ArchGenerator: parabolic and circular arches
    """

    # ============================================
    # CONTINUOUS BEAM GENERATION
    # ============================================

    @staticmethod
    def generate_continuous_beam(spans, intermediate_nodes=None):
        """Generate a continuous beam with multiple spans."""
        if intermediate_nodes is None:
            intermediate_nodes = DEFAULT_INTERMEDIATE_NODES
        return BeamGenerator.generate_continuous_beam(spans, intermediate_nodes)

    # ============================================
    # SIMPLE BEAM GENERATION
    # ============================================

    @staticmethod
    def generate_simple_beam(span, support_type="simple"):
        """Generate a simple beam with various support conditions."""
        return BeamGenerator.generate_simple_beam(span, support_type)

    # ============================================
    # PORTAL FRAME GENERATION
    # ============================================

    @staticmethod
    def generate_portal_frame(width, eave_height, roof_angle=15.0):
        """Generate a simple portal frame with pitched roof."""
        return BeamGenerator.generate_portal_frame(width, eave_height, roof_angle)

    # ============================================
    # PRATT TRUSS GENERATION
    # ============================================

    @staticmethod
    def generate_pratt_truss(span, height, bays):
        """Generate a Pratt truss with proper diagonal orientation."""
        return TrussGenerator.generate_pratt_truss(span, height, bays)

    # ============================================
    # WARREN TRUSS GENERATION
    # ============================================

    @staticmethod
    def generate_warren_truss(span, height, bays):
        """Generate a Warren truss (triangular pattern without verticals)."""
        return TrussGenerator.generate_warren_truss(span, height, bays)

    # ============================================
    # HOWE TRUSS GENERATION
    # ============================================

    @staticmethod
    def generate_howe_truss(span, height, bays):
        """Generate a Howe truss (opposite of Pratt)."""
        return TrussGenerator.generate_howe_truss(span, height, bays)

    # ============================================
    # BRIDGE TRUSS GENERATION
    # ============================================

    @staticmethod
    def generate_bridge(span, deck_width, truss_height, panels=6):
        """Generate a deck-type truss bridge with two parallel trusses."""
        return TrussGenerator.generate_bridge(span, deck_width, truss_height, panels)

    # ============================================
    # SPACE TRUSS GENERATION
    # ============================================

    @staticmethod
    def generate_space_truss(width, length, depth, bays_x=4, bays_z=4):
        """Generate a double-layer space truss (flat roof system)."""
        return TrussGenerator.generate_space_truss(width, length, depth, bays_x, bays_z)

    # ============================================
    # 3D FRAME GENERATION
    # ============================================

    @staticmethod
    def generate_3d_frame(width, length, height, stories, bays_x=2, bays_z=2):
        """Generate a 3D building frame with columns and beams."""
        return FrameGenerator.generate_3d_frame(width, length, height, stories, bays_x, bays_z)

    # ============================================
    # TRANSMISSION TOWER GENERATION
    # ============================================

    @staticmethod
    def generate_tower(base_width, top_width, height, levels=4):
        """Generate a tapered lattice tower (like transmission towers)."""
        return FrameGenerator.generate_tower(base_width, top_width, height, levels)

    # ============================================
    # MULTI-BAY PORTAL FRAME (INDUSTRIAL SHED)
    # ============================================

    @staticmethod
    def generate_multi_bay_portal(total_width, eave_height, bays=3, roof_angle=10.0, length=0, frames=1):
        """Generate a multi-bay industrial portal frame."""
        return FrameGenerator.generate_multi_bay_portal(
            total_width, eave_height, bays, roof_angle, length, frames
        )

    # ============================================
    # ARCH GENERATION
    # ============================================

    @staticmethod
    def generate_arch(span, rise, segments=10, arch_type="parabolic"):
        """Generate a parabolic or circular arch."""
        return ArchGenerator.generate_arch(span, rise, segments, arch_type)


__all__ = [
    "StructuralFactory",
    "BeamGenerator",
    "TrussGenerator",
    "FrameGenerator",
    "ArchGenerator",
    # Constants
    "SECTION_ISMB_400",
    "SECTION_ISMB_350",
    "SECTION_ISMB_300",
    "SECTION_ISMB_250",
    "SECTION_ISA_100x100x10",
    "SECTION_ISA_75x75x8",
    "SECTION_ISA_50x50x6",
    "PROFILES",
    "DEFAULT_YOUNGS_MODULUS",
    "DEFAULT_SHEAR_MODULUS",
    "DEFAULT_CROSS_SECTION_AREA",
    "DEFAULT_INERTIA",
    "DEFAULT_TORSION_CONSTANT",
    "SUPPORT_TYPES",
    "MEMBER_TYPES",
    "COORDINATE_PRECISION",
    "DEFAULT_INTERMEDIATE_NODES",
]
