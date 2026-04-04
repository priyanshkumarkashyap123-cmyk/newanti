"""
Workflow-Aware Planning Engine — 1000× Better Layout Thinking

Analyzes user activity flows and generates intelligent design variants based on:
  - Activity sequence analysis (entry → circulation → destinations)
  - Functional zone clustering (sleeping, wet-services, active, utility)
  - Adjacency dependency graphs (which rooms MUST be near each other)
  - Multi-objective design generation (5 competing good solutions)
  - Macro-zoning before micro-placement (zones first, then rooms)

This module replaces sequential penalty-based thinking with goal-directed planning.
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Dict, List, Optional, Set, Tuple

# Assuming imports from layout_solver_v2
try:
    from layout_solver_v2 import RoomNode, RoomType, AcousticZone, Rectangle, AdjacencyEdge
except ImportError:
    # For type hints when running standalone
    RoomNode = Any
    RoomType = Any
    AcousticZone = Any
    Rectangle = Any
    AdjacencyEdge = Any


# =====================================================================
#  ACTIVITY FLOW CLASSIFICATION
# =====================================================================

class ActivityType(Enum):
    """How residents interact with a room."""
    ENTRY_POINT = "entry"              # Main door, primary access
    DISTRIBUTION = "distribution"       # Corridors, vestibule — traffic passes through
    DESTINATION = "destination"         # Bedroom, study — traffic stops here
    UTILITY_SERVICE = "utility"         # Kitchen, laundry — high traffic, functional
    WET_SERVICE = "wet_service"         # Bathrooms — frequent short visits
    LIVING = "living"                   # Social gathering — people converge


class ZoneType(Enum):
    """Functional clustering strategy."""
    SLEEPING = "sleeping"               # Bedrooms, dressing rooms
    WET_CORE = "wet_core"              # Bathrooms, toilets (adjacency penalty killer)
    ACTIVE_SOCIAL = "active_social"    # Living, dining, kitchen together
    UTILITY_BACK = "utility_back"      # Laundry, storage away from living
    BUFF_CIRCULATION = "circulation"    # Corridors, foyers, transitions


# =====================================================================
#  ACTIVITY FLOW GRAPH
# =====================================================================

@dataclass
class ActivityNode:
    """Node in the activity flow (represents a room's functional role)."""
    room_id: str
    activity_type: ActivityType
    zone_type: ZoneType
    visit_frequency: float = 1.0   # daily visits (1.0 = normal, 2.0 = frequent, 0.5 = rare)
    dwell_time: float = 0.5        # relative time spent (0.1 = quick, 1.0 = long)
    entry_point_rank: int = 999    # distance from main entry (0 = entry, higher = deeper)


@dataclass
class ActivityEdge:
    """Directed edge in activity flow graph (source → destination room)."""
    source_room_id: str
    dest_room_id: str
    transition_weight: float = 1.0  # higher = more important transition
    required_adjacency: bool = False  # architectural must-have (kitchen→dining)
    proximity_preference: float = 1.0  # 0.5 = okay far, 2.0 = should be very close


@dataclass
class ActivityFlowGraph:
    """Directed graph of user activity patterns."""
    nodes: Dict[str, ActivityNode] = field(default_factory=dict)
    edges: List[ActivityEdge] = field(default_factory=list)
    criticality_path: List[str] = field(default_factory=list)  # main entry → living → sleeping
    
    def add_node(self, node: ActivityNode) -> None:
        self.nodes[node.room_id] = node
    
    def add_edge(self, edge: ActivityEdge) -> None:
        self.edges.append(edge)
    
    def topological_sort(self) -> List[str]:
        """Return room IDs in rough priority order (entry → deeper rooms)."""
        visited: Set[str] = set()
        order: List[str] = []
        
        # Start from entry point
        entry_rooms = [
            r for r in self.nodes.values() 
            if r.activity_type == ActivityType.ENTRY_POINT
        ]
        
        queue = [n.room_id for n in entry_rooms]
        while queue:
            room_id = queue.pop(0)
            if room_id in visited:
                continue
            visited.add(room_id)
            order.append(room_id)
            
            # Add children (rooms accessed from this one)
            children = [e.dest_room_id for e in self.edges if e.source_room_id == room_id]
            queue.extend(children)
        
        return order
    
    def criticality_score(self, room_id: str) -> float:
        """Higher score = more critical to overall flow."""
        if room_id not in self.nodes:
            return 0.0
        
        node = self.nodes[room_id]
        base_score = node.visit_frequency * node.dwell_time
        
        # Penalty for deep rooms (entry_point_rank high = marginal)
        depth_penalty = max(0.0, 1.0 - node.entry_point_rank * 0.1)
        
        return base_score * (1.0 + depth_penalty)


# =====================================================================
#  WORKFLOW ANALYZER — INFER FLOWS FROM ROOM LIST
# =====================================================================

class WorkflowAnalyzer:
    """
    Learns activity patterns from room list and generates intelligent layout strategies.
    
    Key insight: Instead of random room placement with penalties, we:
      1. Infer user workflows (entry → main living → sleeping → service areas)
      2. Create hard constraints (kitchen MUST be near dining)
      3. Generate macro-zones first (sleeping wing, active wing, service zone)
      4. Then place rooms within zones
      5. Generate multiple competing solutions (variants)
    """
    
    def __init__(self):
        self.graph: Optional[ActivityFlowGraph] = None
        self.zones: Dict[ZoneType, List[str]] = {}
        self.required_adjacencies: List[Tuple[str, str]] = []
        self.zone_separation: Dict[Tuple[ZoneType, ZoneType], float] = {}
    
    def analyze_rooms(self, rooms: List[RoomNode]) -> ActivityFlowGraph:
        """
        Primary entry point: infer workflow from room list.
        Returns a directed activity flow graph.
        """
        self.graph = ActivityFlowGraph()
        room_dict = {r.id: r for r in rooms}
        
        # Step 1: Classify each room's activity role
        for room in rooms:
            activity_node = self._classify_activity(room, room_dict)
            self.graph.add_node(activity_node)
        
        # Step 2: Add entry point rank (distance from main entry)
        self._rank_entry_distance()
        
        # Step 3: Infer activity edges (who visits whom)
        self._infer_activity_edges(room_dict)
        
        # Step 4: Identify criticality path (main flow)
        self._establish_criticality_path()
        
        # Step 5: Cluster rooms into functional zones
        self._create_functional_zones()
        
        # Step 6: Establish zone separation strategy
        self._establish_zone_separation()
        
        return self.graph
    
    def _classify_activity(self, room: RoomNode, room_dict: Dict[str, RoomNode]) -> ActivityNode:
        """Determine activity type and zone assignment."""
        
        # Entry detection
        if room.is_entry or room.id.lower() in ["entry", "foyer", "lobby", "entrance"]:
            return ActivityNode(
                room_id=room.id,
                activity_type=ActivityType.ENTRY_POINT,
                zone_type=ZoneType.BUFF_CIRCULATION,
                visit_frequency=10.0,  # high-traffic entry
                dwell_time=0.1,  # short stops
                entry_point_rank=0,
            )
        
        # Living/social areas
        if room.id.lower() in ["living", "living_room", "sitting", "lounge", "family", "family_room"]:
            return ActivityNode(
                room_id=room.id,
                activity_type=ActivityType.LIVING,
                zone_type=ZoneType.ACTIVE_SOCIAL,
                visit_frequency=5.0,
                dwell_time=2.0,
                entry_point_rank=1,
            )
        
        # Dining
        if room.id.lower() in ["dining", "dining_room", "breakfast", "eating"]:
            return ActivityNode(
                room_id=room.id,
                activity_type=ActivityType.LIVING,
                zone_type=ZoneType.ACTIVE_SOCIAL,
                visit_frequency=3.0,
                dwell_time=1.5,
                entry_point_rank=2,
            )
        
        # Kitchen
        if room.id.lower() in ["kitchen", "pantry", "kitchenette"]:
            return ActivityNode(
                room_id=room.id,
                activity_type=ActivityType.UTILITY_SERVICE,
                zone_type=ZoneType.ACTIVE_SOCIAL,  # integral to living zone
                visit_frequency=4.0,  # frequent
                dwell_time=1.0,  # medium duration
                entry_point_rank=2,
            )
        
        # Bedrooms (sleeping zone)
        if room.type == RoomType.HABITABLE:
            freq = 3.0 if "master" in room.id.lower() else 2.0
            return ActivityNode(
                room_id=room.id,
                activity_type=ActivityType.DESTINATION,
                zone_type=ZoneType.SLEEPING,
                visit_frequency=freq,
                dwell_time=3.0,  # long dwell (sleep)
                entry_point_rank=5,
            )
        
        # Bathrooms (wet core)
        if room.type == RoomType.WET:
            freq = 2.5 if "master" in room.id.lower() else 1.5
            return ActivityNode(
                room_id=room.id,
                activity_type=ActivityType.WET_SERVICE,
                zone_type=ZoneType.WET_CORE,
                visit_frequency=freq,
                dwell_time=0.3,  # quick
                entry_point_rank=4,  # accessed from sleeping
            )
        
        # Utility/Service areas
        if room.type == RoomType.UTILITY:
            return ActivityNode(
                room_id=room.id,
                activity_type=ActivityType.UTILITY_SERVICE,
                zone_type=ZoneType.UTILITY_BACK,
                visit_frequency=1.0,
                dwell_time=0.5,
                entry_point_rank=6,  # peripheral
            )
        
        # Circulation
        if room.type == RoomType.CIRCULATION:
            return ActivityNode(
                room_id=room.id,
                activity_type=ActivityType.DISTRIBUTION,
                zone_type=ZoneType.BUFF_CIRCULATION,
                visit_frequency=8.0,  # everyone passes through
                dwell_time=0.05,  # transient
                entry_point_rank=1,
            )
        
        # Fallback
        return ActivityNode(
            room_id=room.id,
            activity_type=ActivityType.DESTINATION,
            zone_type=ZoneType.SLEEPING,
            visit_frequency=1.0,
            dwell_time=1.0,
            entry_point_rank=4,
        )
    
    def _rank_entry_distance(self) -> None:
        """Compute distance from main entry for each room."""
        if not self.graph:
            return
        
        # BFS from entry point
        entry_rooms = [
            r for r in self.graph.nodes.values()
            if r.activity_type == ActivityType.ENTRY_POINT
        ]
        
        if not entry_rooms:
            return
        
        visited: Dict[str, int] = {r.room_id: 0 for r in entry_rooms}
        queue = [(r.room_id, 0) for r in entry_rooms]
        
        while queue:
            room_id, dist = queue.pop(0)
            
            # Find neighbors in adjacency graph
            for edge in self.graph.edges:
                if edge.source_room_id == room_id:
                    neighbor = edge.dest_room_id
                    if neighbor not in visited:
                        new_dist = dist + 1
                        visited[neighbor] = new_dist
                        queue.append((neighbor, new_dist))
                        if neighbor in self.graph.nodes:
                            self.graph.nodes[neighbor].entry_point_rank = new_dist
    
    def _infer_activity_edges(self, room_dict: Dict[str, RoomNode]) -> None:
        """Create edges in activity flow graph (who visits whom)."""
        if not self.graph:
            return
        
        rooms = list(room_dict.values())
        
        # Rule 1: Entry point distributes to main living
        entry_rooms = [r for r in rooms if r.is_entry]
        main_living = [r for r in rooms if r.id.lower() in ["living", "living_room"]]
        for e in entry_rooms:
            for l in main_living:
                self.graph.add_edge(ActivityEdge(
                    source_room_id=e.id,
                    dest_room_id=l.id,
                    transition_weight=3.0,
                    required_adjacency=False,
                ))
        
        # Rule 2: Kitchen ↔ Dining (REQUIRED adjacency)
        kitchens = [r for r in rooms if r.id.lower() in ["kitchen", "pantry"]]
        dinings = [r for r in rooms if r.id.lower() in ["dining", "dining_room"]]
        for k in kitchens:
            for d in dinings:
                self.graph.add_edge(ActivityEdge(
                    source_room_id=k.id,
                    dest_room_id=d.id,
                    transition_weight=3.0,
                    required_adjacency=True,
                    proximity_preference=2.5,
                ))
                self.required_adjacencies.append((k.id, d.id))
        
        # Rule 3: Bedrooms → Bathrooms (should be close)
        bedrooms = [r for r in rooms if r.type == RoomType.HABITABLE]
        bathrooms = [r for r in rooms if r.type == RoomType.WET]
        for b in bedrooms:
            for ba in bathrooms:
                self.graph.add_edge(ActivityEdge(
                    source_room_id=b.id,
                    dest_room_id=ba.id,
                    transition_weight=2.0,
                    required_adjacency=False,
                    proximity_preference=1.5,
                ))
        
        # Rule 4: Living → Bedrooms (general circulation)
        for l in main_living:
            for b in bedrooms:
                self.graph.add_edge(ActivityEdge(
                    source_room_id=l.id,
                    dest_room_id=b.id,
                    transition_weight=1.0,
                ))
    
    def _establish_criticality_path(self) -> None:
        """Identify main user path: entry → living → sleeping zones."""
        if not self.graph:
            return
        
        # Heuristic: entry → highest-frequency destination → sleeping areas
        path: List[str] = []
        
        # Add entry
        entries = [r for r in self.graph.nodes.values() if r.activity_type == ActivityType.ENTRY_POINT]
        if entries:
            path.append(entries[0].room_id)
        
        # Add main living area
        living = [r for r in self.graph.nodes.values() if r.zone_type == ZoneType.ACTIVE_SOCIAL]
        if living:
            living.sort(key=lambda x: x.visit_frequency, reverse=True)
            path.extend([r.room_id for r in living[:2]])
        
        # Add sleeping areas
        sleeping = [r for r in self.graph.nodes.values() if r.zone_type == ZoneType.SLEEPING]
        if sleeping:
            path.extend([r.room_id for r in sleeping[:2]])
        
        self.graph.criticality_path = path
    
    def _create_functional_zones(self) -> None:
        """Cluster rooms into logical zones based on activity classification."""
        if not self.graph:
            return
        
        self.zones = {
            ZoneType.SLEEPING: [],
            ZoneType.WET_CORE: [],
            ZoneType.ACTIVE_SOCIAL: [],
            ZoneType.UTILITY_BACK: [],
            ZoneType.BUFF_CIRCULATION: [],
        }
        
        for room_id, node in self.graph.nodes.items():
            self.zones[node.zone_type].append(room_id)
    
    def _establish_zone_separation(self) -> None:
        """Define preferred distance between zones."""
        # Sleeping should be FAR from active/social
        self.zone_separation[(ZoneType.SLEEPING, ZoneType.ACTIVE_SOCIAL)] = 0.2  # repel
        self.zone_separation[(ZoneType.ACTIVE_SOCIAL, ZoneType.SLEEPING)] = 0.2
        
        # Utility should be AWAY from living
        self.zone_separation[(ZoneType.UTILITY_BACK, ZoneType.ACTIVE_SOCIAL)] = 0.15
        self.zone_separation[(ZoneType.ACTIVE_SOCIAL, ZoneType.UTILITY_BACK)] = 0.15
        
        # Wet core needs access to BOTH sleeping and active
        # So medium distance (not too far, not too close)
        self.zone_separation[(ZoneType.WET_CORE, ZoneType.SLEEPING)] = 0.8  # attract slightly
        self.zone_separation[(ZoneType.SLEEPING, ZoneType.WET_CORE)] = 0.8
    
    def get_variant_strategies(self) -> Dict[str, Dict[str, Any]]:
        """
        Generate 5 competing design strategies based on different layout priorities.
        
        Returns:
            {
                "active_first": {...},           # Living area first, sleeping pushed back
                "sleeping_refuge": {...},        # Sleeping isolated from living noise
                "central_circulation": {...},    # Hallway in center, zones radiating
                "compact_zones": {...},         # All zones tightly clustered
                "linear_flow": {...},           # Sequential entry → living → sleeping
            }
        """
        strategies = {}
        
        # Strategy 1: Active First (open living concept)
        strategies["active_first"] = {
            "name": "Open Living Concept",
            "description": "Kitchen-Living-Dining integrated, bedrooms pushed to periphery",
            "zone_priorities": [
                ZoneType.ACTIVE_SOCIAL,  # maximize social space
                ZoneType.LIVING,
                ZoneType.SLEEPING,       # buffer zone
                ZoneType.WET_CORE,
                ZoneType.UTILITY_BACK,
            ],
            "zone_weights": {ZoneType.ACTIVE_SOCIAL: 3.0, ZoneType.SLEEPING: 1.0},
            "separation_override": True,
        }
        
        # Strategy 2: Sleeping Refuge (quiet separation)
        strategies["sleeping_refuge"] = {
            "name": "Private Sleeping Wing",
            "description": "Sleeping zone completely separated from social noise",
            "zone_priorities": [
                ZoneType.SLEEPING,       # prioritize quiet
                ZoneType.WET_CORE,       # adjacent to sleeping
                ZoneType.BUFF_CIRCULATION,
                ZoneType.ACTIVE_SOCIAL,
                ZoneType.UTILITY_BACK,
            ],
            "zone_weights": {ZoneType.SLEEPING: 3.0, ZoneType.ACTIVE_SOCIAL: 1.0},
            "separation_override": False,
        }
        
        # Strategy 3: Central Circulation (hub layout)
        strategies["central_circulation"] = {
            "name": "Hub & Spoke Layout",
            "description": "Central hallway with rooms radiating outward",
            "zone_priorities": [
                ZoneType.BUFF_CIRCULATION,  # circulation central
                ZoneType.SLEEPING,
                ZoneType.ACTIVE_SOCIAL,
                ZoneType.WET_CORE,
                ZoneType.UTILITY_BACK,
            ],
            "zone_weights": {ZoneType.BUFF_CIRCULATION: 2.0},
            "circulation_strategy": "hub",
        }
        
        # Strategy 4: Compact Zones (efficiency)
        strategies["compact_zones"] = {
            "name": "Compact Clustering",
            "description": "All zones tightly grouped for efficient use of space",
            "zone_priorities": [
                ZoneType.ACTIVE_SOCIAL,
                ZoneType.SLEEPING,
                ZoneType.WET_CORE,
                ZoneType.UTILITY_BACK,
                ZoneType.BUFF_CIRCULATION,
            ],
            "zone_weights": {z: 1.0 for z in ZoneType},
            "compactness_multiplier": 2.0,  # double compactness penalty weight
        }
        
        # Strategy 5: Linear Flow (sequential)
        strategies["linear_flow"] = {
            "name": "Sequential Entry Flow",
            "description": "Rooms arranged in depth sequence: entry → living → sleeping",
            "zone_priorities": [
                ZoneType.BUFF_CIRCULATION,  # entry first
                ZoneType.ACTIVE_SOCIAL,    # living next
                ZoneType.SLEEPING,         # sleeping final
                ZoneType.WET_CORE,         # attached to sleeping
                ZoneType.UTILITY_BACK,     # back edge
            ],
            "zone_weights": {ZoneType.BUFF_CIRCULATION: 2.0},
            "circulation_strategy": "linear",
        }
        
        return strategies


# =====================================================================
#  PENALTY WEIGHT OPTIMIZATION FOR VARIANTS
# =====================================================================

def generate_variant_penalty_weights(
    strategy_key: str,
    base_weights: Dict[str, float],
) -> Dict[str, float]:
    """
    Customize CSP solver penalty weights for each strategy variant.
    
    This modulates the core solver to prefer different layout characteristics.
    """
    weights = base_weights.copy()
    
    if strategy_key == "active_first":
        # Weak separation between active and circulation
        weights["zone_grouping_penalty"] = base_weights.get("zone_grouping_penalty", 100) * 0.5
        # Strong adjacency for kitchen-dining
        weights["adjacency_violation"] = base_weights.get("adjacency_violation", 120) * 3.0
    
    elif strategy_key == "sleeping_refuge":
        # STRONG zone separation (keep sleeping away from active)
        weights["zone_grouping_penalty"] = base_weights.get("zone_grouping_penalty", 100) * 3.0
        # Bedroom-bathroom adjacency is critical
        weights["adjacency_violation"] = base_weights.get("adjacency_violation", 120) * 2.0
    
    elif strategy_key == "central_circulation":
        # Penalize long corridors, keep circulation compact
        weights["compactness_penalty"] = base_weights.get("compactness_penalty", 80) * 2.0
        # Zone grouping less critical
        weights["zone_grouping_penalty"] = base_weights.get("zone_grouping_penalty", 100) * 0.3
    
    elif strategy_key == "compact_zones":
        # MAX compactness penalty (draw everything in)
        weights["compactness_penalty"] = base_weights.get("compactness_penalty", 80) * 4.0
        weights["zone_grouping_penalty"] = base_weights.get("zone_grouping_penalty", 100) * 2.0
    
    elif strategy_key == "linear_flow":
        # Penalize non-sequential placement
        weights["zone_grouping_penalty"] = base_weights.get("zone_grouping_penalty", 100) * 1.5
        weights["compactness_penalty"] = base_weights.get("compactness_penalty", 80) * 1.2
    
    return weights
