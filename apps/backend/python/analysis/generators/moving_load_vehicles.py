"""
Standard vehicle definitions for moving load analysis

Includes vehicle definitions from:
- IRC 6: 2017 (Indian Road Standard)
- AASHTO LRFD (American Association of State Highway and Transportation Officials)
- Eurocode 1 (European Standard)
"""

from dataclasses import dataclass
from typing import List, Tuple


@dataclass
class Axle:
    """Single axle definition"""
    load: float          # Axle load (kN)
    spacing: float       # Distance from previous axle (m), 0 for first axle
    width: float = 1.8   # Transverse width (m)


@dataclass
class Vehicle:
    """
    Vehicle definition with axle loads and spacings.
    
    The vehicle is defined as a train of axles with:
    - Axle loads in kN
    - Spacing between consecutive axles in m
    - Optional transverse load width for lane distribution
    """
    name: str
    axles: List[Axle]
    total_length: float = 0.0  # Auto-calculated
    total_load: float = 0.0    # Auto-calculated
    impact_factor: float = 1.0  # Dynamic amplification
    lane_factor: float = 1.0    # Multi-lane reduction
    
    def __post_init__(self):
        """Calculate total length and load"""
        self.total_length = sum(a.spacing for a in self.axles)
        self.total_load = sum(a.load for a in self.axles)
    
    def get_axle_positions(self, front_position: float = 0.0) -> List[Tuple[float, float]]:
        """
        Get positions of all axles given front axle position.
        
        Returns:
            List of (position, load) tuples
        """
        positions = []
        current_pos = front_position
        
        for axle in self.axles:
            current_pos += axle.spacing
            positions.append((current_pos, axle.load))
        
        # Adjust so first axle is at front_position
        if positions:
            offset = positions[0][0] - front_position
            positions = [(p - offset, load) for p, load in positions]
        
        return positions


# IRC Class A Loading (IRC 6:2017)
IRC_CLASS_A = Vehicle(
    name="IRC Class A",
    axles=[
        Axle(load=27, spacing=0.0),     # Front axle
        Axle(load=27, spacing=1.1),     # 
        Axle(load=114, spacing=3.2),    # First bogie
        Axle(load=114, spacing=1.2),    #
        Axle(load=68, spacing=4.3),     # Second bogie
        Axle(load=68, spacing=1.2),     #
        Axle(load=68, spacing=3.0),     # Third bogie
        Axle(load=68, spacing=1.2),     #
    ],
    impact_factor=1.0  # Calculated separately based on span
)

# IRC Class AA Loading (Tracked Vehicle) - IRC 6:2017
IRC_CLASS_AA = Vehicle(
    name="IRC Class AA (Tracked)",
    axles=[
        Axle(load=350, spacing=0.0, width=0.85),   # Track 1 (700kN total, 2 tracks)
        Axle(load=350, spacing=3.6, width=0.85),   # Track 2
    ],
    impact_factor=1.10  # 10% impact for tracked
)

# IRC 70R Loading (Wheeled) - IRC 6:2017
IRC_70R = Vehicle(
    name="IRC 70R (Wheeled)",
    axles=[
        Axle(load=80, spacing=0.0),
        Axle(load=120, spacing=1.37),
        Axle(load=120, spacing=2.13),
        Axle(load=170, spacing=1.52),
        Axle(load=170, spacing=3.05),
        Axle(load=170, spacing=1.52),
        Axle(load=170, spacing=1.52),
    ],
    impact_factor=1.0
)

# AASHTO HL-93 Design Truck
AASHTO_HL93 = Vehicle(
    name="AASHTO HL-93 Truck",
    axles=[
        Axle(load=35, spacing=0.0),     # 8 kips = 35 kN
        Axle(load=145, spacing=4.3),    # 32 kips = 145 kN
        Axle(load=145, spacing=4.3),    # 32 kips = 145 kN (variable 4.3-9.0m)
    ],
    impact_factor=1.33  # IM = 33%
)

# Eurocode LM1 Tandem System
EC_LM1_TANDEM = Vehicle(
    name="Eurocode LM1 Tandem",
    axles=[
        Axle(load=300, spacing=0.0),    # αQ × 300 kN per lane
        Axle(load=300, spacing=1.2),
    ],
    impact_factor=1.0  # Already factored in load
)

# Standard Vehicles Dictionary
STANDARD_VEHICLES = {
    'IRC_CLASS_A': IRC_CLASS_A,
    'IRC_CLASS_AA': IRC_CLASS_AA,
    'IRC_70R': IRC_70R,
    'AASHTO_HL93': AASHTO_HL93,
    'EC_LM1': EC_LM1_TANDEM
}


__all__ = [
    "Axle",
    "Vehicle",
    "IRC_CLASS_A",
    "IRC_CLASS_AA",
    "IRC_70R",
    "AASHTO_HL93",
    "EC_LM1_TANDEM",
    "STANDARD_VEHICLES",
]
