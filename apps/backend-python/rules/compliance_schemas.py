"""Shared compliance schemas and constants for layout solver reporting.

This module centralizes hardcoded rule tables and report metadata that were
previously embedded inside ``layout_solver_v2.py``.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, List, Tuple

from ..layout_solver_v2 import AcousticZone, RoomType


ACTIVE_KEYWORDS = {"living", "dining", "kitchen", "lounge", "family"}
PASSIVE_KEYWORDS = {"bed", "study", "office", "library", "nursery"}
SERVICE_KEYWORDS = {"bath", "toilet", "wc", "laundry", "utility", "powder"}

MIN_CLEARANCES: Dict[RoomType, float] = {
    RoomType.HABITABLE: 2.8,
    RoomType.UTILITY: 2.0,
    RoomType.WET: 1.8,
    RoomType.CIRCULATION: 1.2,
    RoomType.STAIRCASE: 1.0,
}

DOOR_SWING_ARC_M = 0.9

ROOM_ASPECT_LIMITS: Dict[RoomType, Tuple[float, float, float]] = {
    RoomType.HABITABLE: (2.8, 1.0, 1.5),
    RoomType.WET: (0.0, 1.0, 2.0),
    RoomType.UTILITY: (0.0, 1.0, 2.5),
    RoomType.CIRCULATION: (0.0, 1.0, 5.0),
    RoomType.STAIRCASE: (0.0, 1.0, 5.0),
}

ELECTRICAL_POINT_ESTIMATES: Dict[str, int] = {
    "bedroom": 4,
    "master_bedroom": 6,
    "living_room": 6,
    "kitchen": 8,
    "bathroom": 3,
    "toilet": 2,
    "dining_room": 4,
    "study": 5,
    "office": 6,
    "pooja_room": 2,
    "staircase": 1,
    "balcony": 2,
    "utility": 3,
    "store_room": 1,
    "passage": 1,
    "foyer": 2,
    "drawing_room": 6,
    "guest_room": 4,
    "servant_room": 3,
    "garage": 2,
    "parking": 0,
}

DEFAULT_ROOM_AIRFLOW_HEIGHT_M = 3.0
DEFAULT_WINDOW_WIDTH_M = 1.2
DEFAULT_WINDOW_HEIGHT_M = 1.5
DEFAULT_HVAC_TR_PER_SQM = 0.15


@dataclass(frozen=True)
class ComplianceRuleText:
    domain: str
    label: str
    clause: str
    remediation: str


COMPLIANCE_RULE_TEXTS: List[ComplianceRuleText] = [
    ComplianceRuleText("fsi", "Floor Space Index (FSI / FAR)", "NBC 2016 Cl. 4.8 / IS 875 Part 5 Cl. 3.2", "Reduce area, add floor, or request relaxation."),
    ComplianceRuleText("overlap", "Room Overlap (Collision Check)", "N/A — computational hard constraint (rooms must not overlap)", "Increase max_iterations or reduce total area."),
    ComplianceRuleText("min_width", "Minimum Room Width", "NBC 2016 Part 3 Cl. 4.1", "Increase usable area or reduce room count."),
    ComplianceRuleText("aspect_ratio", "Room Aspect Ratio (L/W)", "NBC 2016 Part 3 Cl. 4.1", "Reshape rooms toward more compact proportions."),
    ComplianceRuleText("exterior_wall", "Exterior Wall Access (Natural Ventilation)", "NBC 2016 Cl. 4.11 / SP 7(Part 8):2005", "Rearrange layout or add a courtyard/lightwell."),
    ComplianceRuleText("plumbing_cluster", "Wet-Wall Clustering (Plumbing Economy)", "IS 1172:1993 Cl. 6.1", "Group wet rooms on a shared drain stack wall."),
    ComplianceRuleText("acoustic_zones", "Acoustic Zone Separation", "NBC 2016 Part 8 Cl. 4 / IS 1950", "Insert a buffer zone between active and passive rooms."),
    ComplianceRuleText("clearance", "Anthropometric Clearances", "NBC 2016 Part 3 Cl. 4.1 / IS 962:1989", "Increase minimum clear dimensions and door swing clearance."),
    ComplianceRuleText("grid_snap", "Structural Grid Coordination", "IS 456:2000 Cl. 5.3 / IS 800:2007", "Snap rooms back to the structural module grid."),
    ComplianceRuleText("circulation", "Circulation Area Ratio", "NBC 2016 Cl. 6.4", "Reduce corridor fragments or consolidate circulation."),
    ComplianceRuleText("span_limits", "Structural Span Limits", "IS 456:2000 Cl. 23.2 / NBC 2016 Cl. 5.1.1", "Add intermediate supports or split spans."),
    ComplianceRuleText("staircase", "Staircase Geometry Compliance", "NBC 2016 Part 4 Cl. 3 / IS 456", "Recompute staircase footprint from code limits."),
    ComplianceRuleText("fenestration", "Window-to-Wall Ratio (WWR)", "NBC 2016 Cl. 4.9 / ECBC 2017 Cl. 3.3.1", "Add or enlarge windows."),
    ComplianceRuleText("egress", "Egress Travel Distance (Life Safety)", "NBC 2016 Cl. 5.3 / IS 456:2000 Cl. 8.1", "Add an exit or move the staircase centrally."),
    ComplianceRuleText("solar", "Solar Thermal Exposure (Passive Design)", "ECBC 2017 Cl. 3.1 / NBC 2016 Cl. 4.8", "Add shading or reorient the room."),
]

ROOM_TYPE_TO_ACOUSTIC_ZONE: Dict[RoomType, AcousticZone] = {
    RoomType.HABITABLE: AcousticZone.PASSIVE,
    RoomType.UTILITY: AcousticZone.ACTIVE,
    RoomType.WET: AcousticZone.SERVICE,
    RoomType.CIRCULATION: AcousticZone.BUFFER,
    RoomType.STAIRCASE: AcousticZone.BUFFER,
}
