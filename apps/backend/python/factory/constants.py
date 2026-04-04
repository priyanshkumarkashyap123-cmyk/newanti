"""
constants.py - Hardcoded section profiles and structural constants

Centralized definitions for:
- Section profiles (ISM, ISA, etc.)
- Material constants
- Default member properties
"""

# ============================================
# SECTION PROFILES
# ============================================

# I-Beam sections (Indian Standard)
SECTION_ISMB_400 = "ISMB400"
SECTION_ISMB_350 = "ISMB350"
SECTION_ISMB_300 = "ISMB300"
SECTION_ISMB_250 = "ISMB250"

# Angle sections (Indian Standard, equal leg)
SECTION_ISA_100x100x10 = "ISA100x100x10"
SECTION_ISA_75x75x8 = "ISA75x75x8"
SECTION_ISA_50x50x6 = "ISA50x50x6"

# Common profiles by role
PROFILES = {
    "chord": SECTION_ISA_100x100x10,
    "vertical": SECTION_ISA_75x75x8,
    "diagonal": SECTION_ISA_75x75x8,
    "brace": SECTION_ISA_50x50x6,
    "column_large": SECTION_ISMB_400,
    "column_medium": SECTION_ISMB_350,
    "column_small": SECTION_ISMB_300,
    "beam_primary": SECTION_ISMB_300,
    "beam_secondary": SECTION_ISMB_300,
    "rafter": SECTION_ISMB_300,
    "arch": SECTION_ISMB_400,
    "deck": SECTION_ISMB_350,
    "floor_beam": SECTION_ISMB_350,
}

# ============================================
# MATERIAL CONSTANTS
# ============================================

# Default Young's modulus (kN/m²)
DEFAULT_YOUNGS_MODULUS = 200e6

# Default shear modulus (kN/m²)
DEFAULT_SHEAR_MODULUS = 77e6

# Default cross-sectional area (m²)
DEFAULT_CROSS_SECTION_AREA = 0.01

# Default moment of inertia (m⁴)
DEFAULT_INERTIA = 1e-4

# Default torsional constant (m⁴)
DEFAULT_TORSION_CONSTANT = 1e-5

# ============================================
# SUPPORT TYPE DEFAULTS
# ============================================

SUPPORT_TYPES = {
    "fixed": "fixed",
    "pinned": "pinned",
    "pin": "pinned",
    "roller": "roller",
    "none": "none",
}

# ============================================
# MEMBER TYPE DEFAULTS
# ============================================

MEMBER_TYPES = {
    "beam": "beam",
    "column": "column",
    "chord": "chord",
    "vertical": "vertical",
    "diagonal": "diagonal",
    "brace": "brace",
}

# ============================================
# TOLERANCE AND ROUNDING
# ============================================

# Precision for coordinate rounding (4 decimal places = 0.1 mm)
COORDINATE_PRECISION = 4

# Default intermediate nodes per span for smooth curves
DEFAULT_INTERMEDIATE_NODES = 10
