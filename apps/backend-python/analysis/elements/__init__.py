"""
Structural Element Library

NOTE: Element implementations have been moved to Rust backend (apps/rust-api/src/solver/elements.rs).
This module is deprecated. Use Rust API for:
- TimoshenkoBeam: Beam with shear deformation (thick beams)
- PlateShellElement: 2D plate and shell elements (4-node, Mindlin-Reissner)
- Advanced elements: Links, solids, diaphragms, tension/compression-only
"""

# All element classes deleted — use Rust backend via rust_interop
__all__ = []

