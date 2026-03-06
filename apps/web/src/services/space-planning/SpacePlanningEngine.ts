/**
 * SpacePlanningEngine - Core Space Planning & Layout Generation
 *
 * Professionally engineered auto-layout algorithm:
 * - Adjacency-based room placement
 * - Vastu-aware positioning
 * - Code-compliant setbacks and clearances
 * - Structural grid alignment
 * - MEP zone planning
 * - Sunlight & ventilation optimization
 */

import {
  PlotDimensions,
  SiteOrientation,
  SiteConstraints,
  RoomSpec,
  RoomType,
  PlacedRoom,
  FloorPlan,
  WallSegment,
  DoorSpec,
  WindowSpec,
  ColumnSpec,
  BeamSpec,
  FoundationSpec,
  StructuralPlan,
  StaircaseSpec,
  UserPreferences,
  CardinalDirection,
  ElectricalPlan,
  ElectricalFixture,
  ElectricalCircuit,
  PlumbingPlan,
  PlumbingFixture,
  PlumbingPipe,
  HVACPlan,
  HVACEquipment,
  VentilationPath,
  SunlightAnalysis,
  AirflowAnalysis,
  ElevationView,
  ElevationElement,
  DimensionLine,
  TextLabel,
  SectionLine,
  HousePlanProject,
} from './types';
import { vastuEngine } from './VastuEngine';

// ============================================
// NBC 2016 / IS CODE CONSTANTS — Architectural Design Standards
// ============================================

/** Maximum aspect ratio (length:width) per NBC for habitable rooms */
const MAX_ASPECT_RATIO: Partial<Record<RoomType, number>> = {
  living: 2.0,       // NBC: habitable room ≤ 2:1
  dining: 2.0,
  kitchen: 2.5,      // Galley kitchens allowed up to 2.5:1
  master_bedroom: 2.0,
  bedroom: 2.0,
  bathroom: 2.5,     // Long narrow bathrooms OK
  toilet: 3.0,       // WC cubicles can be narrow
  study: 2.0,
  drawing_room: 2.0,
  guest_room: 2.0,
  pooja: 1.5,        // Prefer square
  home_office: 2.0,
  childrens_room: 2.0,
  entrance_lobby: 3.0,
  corridor: 10.0,    // Linear by nature
  staircase: 3.0,
};

/** Minimum internal clear dimension (meters) per NBC */
const MIN_CLEAR_DIM: Partial<Record<RoomType, { w: number; h: number }>> = {
  living: { w: 3.6, h: 3.6 },        // NBC Part 3: 3.6m min
  dining: { w: 3.0, h: 3.0 },
  kitchen: { w: 2.1, h: 2.4 },       // NBC: 2.1m clear width minimum
  master_bedroom: { w: 3.0, h: 3.6 },// NBC: ≥ 9.5m²
  bedroom: { w: 2.7, h: 3.0 },       // NBC: ≥ 7.5m²
  bathroom: { w: 1.5, h: 1.8 },      // NBC: ≥ 2.8m², 1.5m min side
  toilet: { w: 0.9, h: 1.2 },        // NBC: ≥ 1.1m², 0.9m min width
  corridor: { w: 1.0, h: 1.0 },      // NBC: 1.0m min (residential)
  staircase: { w: 0.9, h: 2.0 },     // NBC: 0.9m min width
};

/** Door clearance rules (meters) */
const DOOR_RULES = {
  MIN_CORNER_OFFSET: 0.1,       // 100mm from corner — structural column zone
  MIN_DOOR_TO_DOOR: 0.3,        // 300mm between two doors on same wall
  SWING_CLEARANCE: 0.9,         // 900mm arc clear zone for door swing
  MIN_PASSAGE_WIDTH: 0.9,       // 900mm passage behind swing door
  BATHROOM_DOOR_WIDTH: 0.75,    // 750mm for bath/toilet
  BEDROOM_DOOR_WIDTH: 0.9,      // 900mm standard internal
  MAIN_ENTRY_WIDTH: 1.05,       // 1050mm main entry (wheelchair access per NBC)
  FIRE_DOOR_WIDTH: 0.9,         // 900mm fire-rated
} as const;

/** Window-to-floor-area ratio per NBC (minimum openable area / floor area) */
const WINDOW_FLOOR_RATIO = {
  habitable: 1 / 8,   // NBC: 1/8 of floor area for habitable rooms
  kitchen: 1 / 8,
  bathroom: 1 / 20,   // Ventilator sufficient
  toilet: 0,          // Mechanical exhaust OK
  staircase: 1 / 16,
} as const;

/** Bathroom internal fixture zones — clearances per IS 2064 */
const BATHROOM_ZONES = {
  WC_CLEARANCE_FRONT: 0.6,     // 600mm clear in front of WC
  WC_CLEARANCE_SIDE: 0.3,      // 300mm side clearance
  WC_WIDTH: 0.4,               // Standard EWC width
  WC_DEPTH: 0.7,               // Standard EWC depth
  BASIN_CLEARANCE_FRONT: 0.6,  // 600mm clear in front of basin
  BASIN_WIDTH: 0.5,            // Counter-top basin width
  BASIN_DEPTH: 0.45,           // Basin depth from wall
  SHOWER_MIN_SIZE: 0.9,        // 900mm × 900mm minimum shower
  SHOWER_PREFERRED: 1.0,       // 1000mm preferred
  FLOOR_SLOPE: 1 / 100,        // 1% slope to floor trap
  DOOR_THRESHOLD_HEIGHT: 0.02, // 20mm threshold to contain water
} as const;

/** Kitchen working triangle — standard arrangement */
const KITCHEN_LAYOUT = {
  PLATFORM_DEPTH: 0.6,         // 600mm counter depth (standard modular)
  PLATFORM_HEIGHT: 0.85,       // 850mm counter height (ergonomic)
  SILL_HEIGHT: 1.05,           // Window sill above platform
  TRIANGLE_MIN: 3.6,           // Min perimeter of working triangle
  TRIANGLE_MAX: 7.9,           // Max perimeter of working triangle
  SINK_TO_STOVE_MIN: 0.6,     // 600mm between sink & stove
  STOVE_WALL_CLEARANCE: 0.15, // 150mm from stove to side wall
  FRIDGE_CLEARANCE_SIDE: 0.05,// 50mm side clearance
  EXHAUST_HEIGHT: 2.1,         // Chimney/exhaust hood height
} as const;

/** Structural grid spacing for column alignment */
const STRUCTURAL_GRID = {
  MIN_SPAN: 3.0,               // Minimum column spacing
  TYPICAL_SPAN: 3.6,           // Typical residential span (3.6m)
  MAX_SPAN: 5.0,               // Max without deep beams
  COLUMN_SIZE: 0.3,            // 300mm × 300mm typical column
} as const;

// ============================================
// DEFAULT ROOM TEMPLATES
// ============================================

const DEFAULT_ROOM_SPECS: Record<RoomType, Partial<RoomSpec>> = {
  living: {
    minArea: 15,
    preferredArea: 22,
    maxArea: 35,
    minWidth: 3.6,
    minHeight: 3.0,
    requiresWindow: true,
    requiresVentilation: true,
    requiresAttachedBath: false,
    priority: 'essential',
  },
  dining: {
    minArea: 10,
    preferredArea: 14,
    maxArea: 20,
    minWidth: 3.0,
    minHeight: 3.0,
    requiresWindow: true,
    requiresVentilation: true,
    requiresAttachedBath: false,
    priority: 'important',
  },
  kitchen: {
    minArea: 7,
    preferredArea: 10,
    maxArea: 16,
    minWidth: 2.4,
    minHeight: 3.0,
    requiresWindow: true,
    requiresVentilation: true,
    requiresAttachedBath: false,
    priority: 'essential',
  },
  master_bedroom: {
    minArea: 14,
    preferredArea: 18,
    maxArea: 25,
    minWidth: 3.6,
    minHeight: 3.0,
    requiresWindow: true,
    requiresVentilation: true,
    requiresAttachedBath: true,
    priority: 'essential',
  },
  bedroom: {
    minArea: 10,
    preferredArea: 13,
    maxArea: 18,
    minWidth: 3.0,
    minHeight: 3.0,
    requiresWindow: true,
    requiresVentilation: true,
    requiresAttachedBath: false,
    priority: 'essential',
  },
  bathroom: {
    minArea: 3.5,
    preferredArea: 5,
    maxArea: 8,
    minWidth: 1.8,
    minHeight: 3.0,
    requiresWindow: true,
    requiresVentilation: true,
    requiresAttachedBath: false,
    priority: 'essential',
  },
  toilet: {
    minArea: 1.5,
    preferredArea: 2.5,
    maxArea: 4,
    minWidth: 1.2,
    minHeight: 3.0,
    requiresWindow: false,
    requiresVentilation: true,
    requiresAttachedBath: false,
    priority: 'essential',
  },
  pooja: {
    minArea: 3,
    preferredArea: 5,
    maxArea: 8,
    minWidth: 1.5,
    minHeight: 3.0,
    requiresWindow: false,
    requiresVentilation: true,
    requiresAttachedBath: false,
    priority: 'desirable',
  },
  study: {
    minArea: 6,
    preferredArea: 9,
    maxArea: 14,
    minWidth: 2.4,
    minHeight: 3.0,
    requiresWindow: true,
    requiresVentilation: true,
    requiresAttachedBath: false,
    priority: 'desirable',
  },
  home_office: {
    minArea: 8,
    preferredArea: 12,
    maxArea: 18,
    minWidth: 2.7,
    minHeight: 3.0,
    requiresWindow: true,
    requiresVentilation: true,
    requiresAttachedBath: false,
    priority: 'desirable',
  },
  store: {
    minArea: 3,
    preferredArea: 5,
    maxArea: 8,
    minWidth: 1.5,
    minHeight: 3.0,
    requiresWindow: false,
    requiresVentilation: false,
    requiresAttachedBath: false,
    priority: 'important',
  },
  utility: {
    minArea: 3,
    preferredArea: 5,
    maxArea: 8,
    minWidth: 1.5,
    minHeight: 3.0,
    requiresWindow: false,
    requiresVentilation: true,
    requiresAttachedBath: false,
    priority: 'important',
  },
  laundry: {
    minArea: 4,
    preferredArea: 6,
    maxArea: 10,
    minWidth: 2.0,
    minHeight: 3.0,
    requiresWindow: true,
    requiresVentilation: true,
    requiresAttachedBath: false,
    priority: 'desirable',
  },
  garage: {
    minArea: 15,
    preferredArea: 20,
    maxArea: 30,
    minWidth: 3.0,
    minHeight: 2.7,
    requiresWindow: false,
    requiresVentilation: true,
    requiresAttachedBath: false,
    priority: 'desirable',
  },
  parking: {
    minArea: 12,
    preferredArea: 18,
    maxArea: 30,
    minWidth: 2.5,
    minHeight: 2.7,
    requiresWindow: false,
    requiresVentilation: true,
    requiresAttachedBath: false,
    priority: 'desirable',
  },
  balcony: {
    minArea: 3,
    preferredArea: 5,
    maxArea: 12,
    minWidth: 1.2,
    minHeight: 3.0,
    requiresWindow: false,
    requiresVentilation: true,
    requiresAttachedBath: false,
    priority: 'desirable',
  },
  terrace: {
    minArea: 10,
    preferredArea: 20,
    maxArea: 50,
    minWidth: 3.0,
    minHeight: 0,
    requiresWindow: false,
    requiresVentilation: true,
    requiresAttachedBath: false,
    priority: 'optional',
  },
  corridor: {
    minArea: 3,
    preferredArea: 4,
    maxArea: 8,
    minWidth: 1.2,
    minHeight: 3.0,
    requiresWindow: false,
    requiresVentilation: false,
    requiresAttachedBath: false,
    priority: 'essential',
  },
  staircase: {
    minArea: 6,
    preferredArea: 8,
    maxArea: 12,
    minWidth: 1.2,
    minHeight: 3.0,
    requiresWindow: false,
    requiresVentilation: true,
    requiresAttachedBath: false,
    priority: 'essential',
  },
  lift: {
    minArea: 3,
    preferredArea: 4,
    maxArea: 6,
    minWidth: 1.5,
    minHeight: 3.0,
    requiresWindow: false,
    requiresVentilation: true,
    requiresAttachedBath: false,
    priority: 'optional',
  },
  entrance_lobby: {
    minArea: 4,
    preferredArea: 6,
    maxArea: 12,
    minWidth: 1.8,
    minHeight: 3.0,
    requiresWindow: false,
    requiresVentilation: true,
    requiresAttachedBath: false,
    priority: 'important',
  },
  drawing_room: {
    minArea: 14,
    preferredArea: 20,
    maxArea: 30,
    minWidth: 3.6,
    minHeight: 3.0,
    requiresWindow: true,
    requiresVentilation: true,
    requiresAttachedBath: false,
    priority: 'desirable',
  },
  guest_room: {
    minArea: 10,
    preferredArea: 14,
    maxArea: 20,
    minWidth: 3.0,
    minHeight: 3.0,
    requiresWindow: true,
    requiresVentilation: true,
    requiresAttachedBath: true,
    priority: 'desirable',
  },
  servants_quarter: {
    minArea: 8,
    preferredArea: 10,
    maxArea: 14,
    minWidth: 2.4,
    minHeight: 2.7,
    requiresWindow: true,
    requiresVentilation: true,
    requiresAttachedBath: true,
    priority: 'optional',
  },
  pantry: {
    minArea: 3,
    preferredArea: 5,
    maxArea: 8,
    minWidth: 1.5,
    minHeight: 3.0,
    requiresWindow: false,
    requiresVentilation: true,
    requiresAttachedBath: false,
    priority: 'desirable',
  },
  gym: {
    minArea: 12,
    preferredArea: 18,
    maxArea: 30,
    minWidth: 3.0,
    minHeight: 3.0,
    requiresWindow: true,
    requiresVentilation: true,
    requiresAttachedBath: false,
    priority: 'optional',
  },
  home_theater: {
    minArea: 15,
    preferredArea: 22,
    maxArea: 35,
    minWidth: 3.6,
    minHeight: 3.0,
    requiresWindow: false,
    requiresVentilation: true,
    requiresAttachedBath: false,
    priority: 'optional',
  },
  swimming_pool: {
    minArea: 20,
    preferredArea: 35,
    maxArea: 60,
    minWidth: 4.0,
    minHeight: 0,
    requiresWindow: false,
    requiresVentilation: true,
    requiresAttachedBath: false,
    priority: 'optional',
  },
  garden: {
    minArea: 10,
    preferredArea: 25,
    maxArea: 100,
    minWidth: 3.0,
    minHeight: 0,
    requiresWindow: false,
    requiresVentilation: true,
    requiresAttachedBath: false,
    priority: 'desirable',
  },
  sit_out: {
    minArea: 4,
    preferredArea: 6,
    maxArea: 12,
    minWidth: 1.5,
    minHeight: 0,
    requiresWindow: false,
    requiresVentilation: true,
    requiresAttachedBath: false,
    priority: 'desirable',
  },
  verandah: {
    minArea: 5,
    preferredArea: 8,
    maxArea: 15,
    minWidth: 1.8,
    minHeight: 3.0,
    requiresWindow: false,
    requiresVentilation: true,
    requiresAttachedBath: false,
    priority: 'desirable',
  },
  foyer: {
    minArea: 4,
    preferredArea: 6,
    maxArea: 10,
    minWidth: 1.8,
    minHeight: 3.0,
    requiresWindow: false,
    requiresVentilation: true,
    requiresAttachedBath: false,
    priority: 'desirable',
  },
  walk_in_closet: {
    minArea: 4,
    preferredArea: 6,
    maxArea: 10,
    minWidth: 1.8,
    minHeight: 3.0,
    requiresWindow: false,
    requiresVentilation: false,
    requiresAttachedBath: false,
    priority: 'desirable',
  },
  dressing: {
    minArea: 4,
    preferredArea: 6,
    maxArea: 10,
    minWidth: 1.8,
    minHeight: 3.0,
    requiresWindow: false,
    requiresVentilation: false,
    requiresAttachedBath: false,
    priority: 'desirable',
  },
  childrens_room: {
    minArea: 10,
    preferredArea: 14,
    maxArea: 18,
    minWidth: 3.0,
    minHeight: 3.0,
    requiresWindow: true,
    requiresVentilation: true,
    requiresAttachedBath: false,
    priority: 'important',
  },
  library: {
    minArea: 8,
    preferredArea: 12,
    maxArea: 20,
    minWidth: 2.7,
    minHeight: 3.0,
    requiresWindow: true,
    requiresVentilation: true,
    requiresAttachedBath: false,
    priority: 'optional',
  },
  workshop: {
    minArea: 10,
    preferredArea: 15,
    maxArea: 25,
    minWidth: 3.0,
    minHeight: 3.0,
    requiresWindow: true,
    requiresVentilation: true,
    requiresAttachedBath: false,
    priority: 'optional',
  },
  basement: {
    minArea: 30,
    preferredArea: 50,
    maxArea: 200,
    minWidth: 5.0,
    minHeight: 2.7,
    requiresWindow: false,
    requiresVentilation: true,
    requiresAttachedBath: false,
    priority: 'optional',
  },
  mechanical_room: {
    minArea: 4,
    preferredArea: 6,
    maxArea: 10,
    minWidth: 2.0,
    minHeight: 3.0,
    requiresWindow: false,
    requiresVentilation: true,
    requiresAttachedBath: false,
    priority: 'important',
  },
  electrical_panel: {
    minArea: 1.5,
    preferredArea: 2,
    maxArea: 4,
    minWidth: 0.8,
    minHeight: 3.0,
    requiresWindow: false,
    requiresVentilation: true,
    requiresAttachedBath: false,
    priority: 'essential',
  },
  water_tank_room: {
    minArea: 3,
    preferredArea: 4,
    maxArea: 8,
    minWidth: 1.5,
    minHeight: 2.4,
    requiresWindow: false,
    requiresVentilation: true,
    requiresAttachedBath: false,
    priority: 'important',
  },
};

// ============================================
// ROOM COLORS FOR RENDERING
// ============================================

const ROOM_COLORS: Record<RoomType, string> = {
  living: '#E0F2FE',
  dining: '#FEF3C7',
  kitchen: '#FEE2E2',
  master_bedroom: '#E0E7FF',
  bedroom: '#DBEAFE',
  bathroom: '#D1FAE5',
  toilet: '#D1FAE5',
  pooja: '#FEF9C3',
  study: '#F3E8FF',
  home_office: '#E0E7FF',
  store: '#F5F5F4',
  utility: '#E5E7EB',
  laundry: '#CFFAFE',
  garage: '#D1D5DB',
  parking: '#D1D5DB',
  balcony: '#ECFDF5',
  terrace: '#F0FDF4',
  corridor: '#F9FAFB',
  staircase: '#FED7AA',
  lift: '#FED7AA',
  entrance_lobby: '#FBCFE8',
  drawing_room: '#E0F2FE',
  guest_room: '#DDD6FE',
  servants_quarter: '#E5E7EB',
  pantry: '#FEF3C7',
  gym: '#FEE2E2',
  home_theater: '#1F2937',
  swimming_pool: '#BAE6FD',
  garden: '#BBF7D0',
  sit_out: '#ECFDF5',
  verandah: '#F0FDF4',
  foyer: '#FBCFE8',
  walk_in_closet: '#F3E8FF',
  dressing: '#F3E8FF',
  childrens_room: '#FDE68A',
  library: '#E0E7FF',
  workshop: '#E5E7EB',
  basement: '#9CA3AF',
  mechanical_room: '#6B7280',
  electrical_panel: '#FCA5A5',
  water_tank_room: '#93C5FD',
};

// ============================================
// SPACE PLANNING ENGINE
// ============================================

export class SpacePlanningEngine {
  /**
   * Get default room specifications for a room type
   */
  getDefaultRoomSpec(type: RoomType, floor: number = 0): RoomSpec {
    const defaults = DEFAULT_ROOM_SPECS[type];
    const label = type.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
    return {
      id: `room-${type}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type,
      name: label,
      minArea: defaults.minArea || 6,
      preferredArea: defaults.preferredArea || 10,
      maxArea: defaults.maxArea || 20,
      minWidth: defaults.minWidth || 2.4,
      minHeight: defaults.minHeight || 3.0,
      requiresWindow: defaults.requiresWindow || false,
      requiresVentilation: defaults.requiresVentilation || false,
      requiresAttachedBath: defaults.requiresAttachedBath || false,
      preferredDirection: vastuEngine.getIdealDirection(type),
      vastuDirection: vastuEngine.getIdealDirection(type)[0],
      priority: defaults.priority || 'desirable',
      floor,
      quantity: 1,
      adjacentTo: this.getAdjacencyRules(type),
      awayFrom: this.getAvoidanceRules(type),
    };
  }

  /**
   * Get room color for rendering
   */
  getRoomColor(type: RoomType): string {
    return ROOM_COLORS[type] || '#F3F4F6';
  }

  /**
   * Generate a complete floor plan from room specifications
   *
   * ENFORCED CONSTRAINTS (Priority 5):
   * - FAR / FSI compliance: total built-up area ≤ plot_area × farAllowed
   * - Ground coverage: ground floor footprint ≤ plot_area × groundCoverage%
   * - Max floors: rooms beyond maxFloors are clamped to maxFloors-1
   * - Parking: auto-inject parking rooms if parkingRequired > 0
   * - Adjacency/avoidance: room placement uses adjacency scoring
   */
  generateFloorPlan(
    plot: PlotDimensions,
    orientation: SiteOrientation,
    constraints: SiteConstraints,
    roomSpecs: RoomSpec[],
    preferences: UserPreferences,
    floor: number = 0,
  ): FloorPlan {
    // Calculate buildable area
    const buildableWidth = plot.width - constraints.setbacks.left - constraints.setbacks.right;
    const buildableDepth = plot.depth - constraints.setbacks.front - constraints.setbacks.rear;
    const buildableArea = buildableWidth * buildableDepth;
    const plotArea = plot.width * plot.depth;

    // ── ENFORCEMENT: Ground coverage limit ──
    const maxGroundCoverage = constraints.groundCoverage > 0
      ? (constraints.groundCoverage / 100) * plotArea
      : buildableArea; // If not specified, use full buildable area

    // ── ENFORCEMENT: Floor clamp — skip rooms assigned to floors beyond maxFloors ──
    const maxFloor = constraints.maxFloors > 0 ? constraints.maxFloors - 1 : 10;
    const effectiveFloor = Math.min(floor, maxFloor);

    // ── ENFORCEMENT: FAR / FSI area budget ──
    // Total allowed built-up = plot_area × farAllowed
    // Per-floor budget = total / numFloors (approximate fair share)
    const totalFARArea = constraints.farAllowed > 0
      ? plotArea * constraints.farAllowed
      : Infinity;
    const numFloors = constraints.maxFloors > 0 ? constraints.maxFloors : 1;
    const perFloorBudget = totalFARArea / numFloors;

    // Filter rooms for this floor
    let floorRooms = roomSpecs.filter((r) => {
      const roomFloor = Math.min(r.floor, maxFloor);
      return roomFloor === effectiveFloor;
    });

    // ── ENFORCEMENT: Auto-inject parking rooms if needed on ground floor ──
    if (floor === 0 && constraints.parkingRequired > 0) {
      const existingParking = floorRooms.filter(
        (r) => r.type === 'parking' || r.type === 'garage',
      );
      const parkingSlotsNeeded = constraints.parkingRequired - existingParking.length;

      for (let i = 0; i < parkingSlotsNeeded; i++) {
        floorRooms.push({
          id: `auto_parking_${i}`,
          type: 'parking',
          name: `Parking ${existingParking.length + i + 1}`,
          minArea: 12.5, // 2.5m × 5m per NBC
          preferredArea: 15, // 3m × 5m comfortable
          maxArea: 18,
          minWidth: 2.5,
          minHeight: 2.4,
          requiresWindow: false,
          requiresVentilation: true,
          requiresAttachedBath: false,
          priority: 'important' as const,
          floor: 0,
          quantity: 1,
        });
      }
    }

    // ── ENFORCEMENT: FAR area trimming ──
    // Sort by priority, then trim from the bottom if total area exceeds budget
    const sortedRooms = this.sortRoomsByPriority(floorRooms, orientation);

    let cumulativeArea = 0;
    const fittingRooms: typeof sortedRooms = [];
    for (const room of sortedRooms) {
      const roomArea = (room.preferredArea || room.minArea) * (room.quantity || 1);
      if (cumulativeArea + roomArea <= perFloorBudget * 1.1) {
        // 10% tolerance
        fittingRooms.push(room);
        cumulativeArea += roomArea;
      } else if (room.priority === 'essential') {
        // Essential rooms always included, even if over budget
        fittingRooms.push(room);
        cumulativeArea += roomArea;
      }
      // Non-essential rooms that would bust FAR are dropped with a console warning
      else {
        console.warn(
          `[SpacePlanningEngine] FAR constraint: dropping "${room.name}" (${roomArea.toFixed(1)}m²) — ` +
          `budget ${perFloorBudget.toFixed(1)}m², cumulative ${cumulativeArea.toFixed(1)}m²`,
        );
      }
    }

    // ── ENFORCEMENT: Ground coverage — scale rooms if footprint exceeds limit ──
    const totalFootprint = fittingRooms.reduce(
      (sum, r) => sum + (r.preferredArea || r.minArea) * (r.quantity || 1),
      0,
    );
    let coverageScale = 1.0;
    if (floor === 0 && totalFootprint > maxGroundCoverage && maxGroundCoverage > 0) {
      coverageScale = maxGroundCoverage / totalFootprint;
      console.warn(
        `[SpacePlanningEngine] Ground coverage constraint: scaling rooms by ${(coverageScale * 100).toFixed(1)}% ` +
        `(${totalFootprint.toFixed(1)}m² → ${maxGroundCoverage.toFixed(1)}m² max)`,
      );
    }

    // Apply coverage scaling to room specs (temporary adjusted specs)
    const adjustedRooms = coverageScale < 1.0
      ? fittingRooms.map((r) => ({
          ...r,
          preferredArea: (r.preferredArea || r.minArea) * coverageScale,
          minArea: r.minArea * coverageScale,
          maxArea: (r.maxArea || r.preferredArea * 1.3) * coverageScale,
        }))
      : fittingRooms;

    // Place rooms using grid-based approach WITH adjacency scoring
    const placedRooms = this.placeRooms(
      adjustedRooms,
      buildableWidth,
      buildableDepth,
      constraints.setbacks,
      orientation,
      preferences,
    );

    // Generate walls
    const walls = this.generateWalls(
      placedRooms,
      buildableWidth,
      buildableDepth,
      constraints.setbacks,
    );

    // Generate doors and windows
    this.addDoorsAndWindows(placedRooms, orientation);

    // ── Furniture clearance validation + auto-adjustment ──
    const furnitureWarnings: string[] = [];
    for (const room of placedRooms) {
      const { valid, warnings } = this.validateFurnitureClearance(room);
      furnitureWarnings.push(...warnings);
      
      // Auto-adjust: expand room slightly if it fails clearance and there's space
      if (!valid) {
        const nbcMin = MIN_CLEAR_DIM[room.spec.type];
        if (nbcMin) {
          const neededW = Math.max(room.width, nbcMin.w);
          const neededH = Math.max(room.height, nbcMin.h);
          // Only expand if within buildable envelope
          if (room.x + neededW <= constraints.setbacks.left + buildableWidth) {
            room.width = this.snapToGrid(neededW);
          }
          if (room.y + neededH <= constraints.setbacks.front + buildableDepth) {
            room.height = this.snapToGrid(neededH);
          }
        }
      }
    }

    // Store warnings for potential UI display
    (this as any)._furnitureWarnings = furnitureWarnings;

    // Generate corridors
    const corridors = this.generateCorridors(placedRooms, buildableWidth, buildableDepth);

    const floorHeight = preferences.budget === 'luxury' ? 3.6 : 3.0;

    return {
      floor: effectiveFloor,
      label: effectiveFloor === 0 ? 'Ground Floor' : effectiveFloor === -1 ? 'Basement' : `Floor ${effectiveFloor}`,
      rooms: placedRooms,
      staircases: this.generateStaircases(
        placedRooms,
        buildableWidth,
        buildableDepth,
        constraints.setbacks,
      ),
      corridors,
      floorHeight,
      slabThickness: 0.15,
      walls,
    };
  }

  /**
   * Generate structural plan
   */
  generateStructuralPlan(
    floorPlans: FloorPlan[],
    plot: PlotDimensions,
    constraints: SiteConstraints,
  ): StructuralPlan {
    const columns: ColumnSpec[] = [];
    const beams: BeamSpec[] = [];
    const foundations: FoundationSpec[] = [];

    const buildableWidth = plot.width - constraints.setbacks.left - constraints.setbacks.right;
    const buildableDepth = plot.depth - constraints.setbacks.front - constraints.setbacks.rear;

    // Place columns on a structural grid (every 3-4.5m)
    const gridSpacingX = Math.min(4.5, buildableWidth / Math.ceil(buildableWidth / 4.5));
    const gridSpacingY = Math.min(4.5, buildableDepth / Math.ceil(buildableDepth / 4.5));

    let colId = 1;
    for (
      let x = constraints.setbacks.left;
      x <= plot.width - constraints.setbacks.right + 0.01;
      x += gridSpacingX
    ) {
      for (
        let y = constraints.setbacks.front;
        y <= plot.depth - constraints.setbacks.rear + 0.01;
        y += gridSpacingY
      ) {
        const col: ColumnSpec = {
          id: `C${colId++}`,
          x: Math.round(x * 100) / 100,
          y: Math.round(y * 100) / 100,
          width: 0.3,
          depth: 0.3,
          type: 'rectangular',
          material: 'RCC',
          reinforcement: '4-16φ + 4-12φ, 8mm ties @ 150mm c/c',
          floor: 0,
        };
        columns.push(col);

        // Foundation for each column
        foundations.push({
          id: `F${colId - 1}`,
          type: 'isolated',
          x: col.x - 0.6,
          y: col.y - 0.6,
          width: 1.5,
          depth: 1.5,
          thickness: 0.3,
          bearingCapacity: 150,
          columnId: col.id,
        });
      }
    }

    // Connect columns with beams
    let beamId = 1;
    for (let i = 0; i < columns.length; i++) {
      for (let j = i + 1; j < columns.length; j++) {
        const dx = Math.abs(columns[i].x - columns[j].x);
        const dy = Math.abs(columns[i].y - columns[j].y);
        // Connect only adjacent columns (along grid lines)
        if ((dx < gridSpacingX + 0.1 && dy < 0.1) || (dy < gridSpacingY + 0.1 && dx < 0.1)) {
          beams.push({
            id: `B${beamId++}`,
            startX: columns[i].x,
            startY: columns[i].y,
            endX: columns[j].x,
            endY: columns[j].y,
            width: 0.23,
            depth: 0.45,
            type: 'main',
            material: 'RCC',
            floor: 0,
          });
        }
      }
    }

    return {
      columns,
      beams,
      foundations,
      slabType: 'two_way',
      slabThickness: 0.15,
    };
  }

  /**
   * Generate electrical plan
   */
  generateElectricalPlan(floorPlans: FloorPlan[]): ElectricalPlan {
    const fixtures: ElectricalFixture[] = [];
    const circuits: ElectricalCircuit[] = [];
    const panels: ElectricalPlan['panels'] = [];
    let fixtureId = 1;
    let totalLoad = 0;

    for (const plan of floorPlans) {
      for (const room of plan.rooms) {
        const roomFixtures = this.generateElectricalFixturesForRoom(room, fixtureId);
        fixtures.push(...roomFixtures);
        fixtureId += roomFixtures.length;
        totalLoad += roomFixtures.reduce((sum, f) => sum + f.wattage, 0);

        // Life-safety and low-voltage points
        const roomArea = room.width * room.height;
        const habitable = [
          'living',
          'dining',
          'master_bedroom',
          'bedroom',
          'study',
          'drawing_room',
          'guest_room',
          'childrens_room',
          'home_office',
        ].includes(room.spec.type);

        if (habitable && roomArea > 8) {
          fixtures.push({
            id: `EF-${fixtureId++}`,
            type: 'smoke_detector',
            x: Math.round((room.x + room.width / 2) * 100) / 100,
            y: Math.round((room.y + room.height / 2) * 100) / 100,
            roomId: room.id,
            circuit: 'CKT-LIGHT',
            wattage: 3,
            height: room.ceilingHeight,
          });
        }

        if (room.spec.type === 'entrance_lobby' || room.spec.type === 'foyer') {
          fixtures.push({
            id: `EF-${fixtureId++}`,
            type: 'bell_point',
            x: Math.round((room.x + 0.3) * 100) / 100,
            y: Math.round((room.y + 0.2) * 100) / 100,
            roomId: room.id,
            circuit: 'CKT-LIGHT',
            wattage: 5,
            height: 1.4,
          });
          fixtures.push({
            id: `EF-${fixtureId++}`,
            type: 'cctv',
            x: Math.round((room.x + room.width - 0.2) * 100) / 100,
            y: Math.round((room.y + room.height - 0.2) * 100) / 100,
            roomId: room.id,
            circuit: 'CKT-POWER',
            wattage: 15,
            height: 2.7,
          });
        }

        if (room.spec.type === 'staircase' || room.spec.type === 'corridor') {
          fixtures.push({
            id: `EF-${fixtureId++}`,
            type: 'emergency_light',
            x: Math.round((room.x + room.width / 2) * 100) / 100,
            y: Math.round((room.y + room.height / 2) * 100) / 100,
            roomId: room.id,
            circuit: 'CKT-LIGHT',
            wattage: 10,
            height: 2.2,
          });
          fixtures.push({
            id: `EF-${fixtureId++}`,
            type: 'motion_sensor',
            x: Math.round((room.x + room.width / 2) * 100) / 100,
            y: Math.round((room.y + room.height - 0.2) * 100) / 100,
            roomId: room.id,
            circuit: 'CKT-LIGHT',
            wattage: 3,
            height: 2.4,
          });
        }

        if (room.spec.type === 'living' || room.spec.type === 'home_theater') {
          fixtures.push({
            id: `EF-${fixtureId++}`,
            type: 'tv_point',
            x: Math.round((room.x + room.width - 0.1) * 100) / 100,
            y: Math.round((room.y + room.height / 2) * 100) / 100,
            roomId: room.id,
            circuit: 'CKT-POWER',
            wattage: 150,
            height: 0.6,
          });
          fixtures.push({
            id: `EF-${fixtureId++}`,
            type: 'data_point',
            x: Math.round((room.x + room.width - 0.1) * 100) / 100,
            y: Math.round((room.y + room.height / 2 + 0.2) * 100) / 100,
            roomId: room.id,
            circuit: 'CKT-POWER',
            wattage: 10,
            height: 0.3,
          });
        }
      }

      // Add distribution board
      const electricalRoom =
        plan.rooms.find(
          (r) =>
            r.spec.type === 'electrical_panel' ||
            r.spec.type === 'utility' ||
            r.spec.type === 'entrance_lobby',
        ) ||
        plan.rooms[0];
      if (electricalRoom) {
        panels.push({
          id: `DB-${plan.floor}`,
          name: `Distribution Board - ${plan.label}`,
          x: electricalRoom.x + 0.3,
          y: electricalRoom.y + 0.3,
          roomId: electricalRoom.id,
          circuits: [],
        });
      }
    }

    // Group fixtures into circuits
    const lightingFixtures = fixtures.filter(
      (f) =>
        f.type === 'light_point' ||
        f.type === 'fan_point' ||
        f.type === 'emergency_light' ||
        f.type === 'smoke_detector' ||
        f.type === 'motion_sensor' ||
        f.type === 'bell_point',
    );
    const powerFixtures = fixtures.filter(
      (f) =>
        f.type === 'socket' ||
        f.type === 'tv_point' ||
        f.type === 'data_point' ||
        f.type === 'telephone_point' ||
        f.type === 'cctv',
    );
    const acFixtures = fixtures.filter((f) => f.type === 'ac_point');
    const kitchenFixtures = fixtures.filter(
      (f) =>
        f.circuit === 'CKT-KITCHEN' ||
        f.type === 'exhaust_fan' ||
        (f.roomId.includes('kitchen') && ['socket', 'geyser_point'].includes(f.type)),
    );
    const geyserFixtures = fixtures.filter((f) => f.type === 'geyser_point');
    const motorFixtures = fixtures.filter(
      (f) =>
        f.type === 'ev_charging' ||
        f.type === 'distribution_board' ||
        f.type === 'meter_board' ||
        f.type === 'inverter_point' ||
        f.type === 'ups_point',
    );

    if (lightingFixtures.length > 0) {
      circuits.push({
        id: 'CKT-LIGHT',
        name: 'Lighting Circuit',
        type: 'lighting',
        mcbRating: 10,
        wireSize: 1.5,
        fixtures: lightingFixtures.map((f) => f.id),
        phase: 1,
      });
    }

    if (powerFixtures.length > 0) {
      circuits.push({
        id: 'CKT-POWER',
        name: 'Power Circuit',
        type: 'power',
        mcbRating: 16,
        wireSize: 2.5,
        fixtures: powerFixtures.map((f) => f.id),
        phase: 1,
      });
    }

    if (acFixtures.length > 0) {
      circuits.push({
        id: 'CKT-AC',
        name: 'AC Circuit',
        type: 'ac',
        mcbRating: 20,
        wireSize: 4.0,
        fixtures: acFixtures.map((f) => f.id),
        phase: 1,
      });
    }

    if (kitchenFixtures.length > 0) {
      circuits.push({
        id: 'CKT-KITCHEN',
        name: 'Kitchen Circuit',
        type: 'kitchen',
        mcbRating: 20,
        wireSize: 4.0,
        fixtures: kitchenFixtures.map((f) => f.id),
        phase: 1,
      });
    }

    if (geyserFixtures.length > 0) {
      circuits.push({
        id: 'CKT-GEYSER',
        name: 'Water Heater Circuit',
        type: 'geyser',
        mcbRating: 20,
        wireSize: 4.0,
        fixtures: geyserFixtures.map((f) => f.id),
        phase: 1,
      });
    }

    if (motorFixtures.length > 0) {
      circuits.push({
        id: 'CKT-MOTOR',
        name: 'Motor / Utility Circuit',
        type: 'motor',
        mcbRating: 32,
        wireSize: 6.0,
        fixtures: motorFixtures.map((f) => f.id),
        phase: 3,
      });
    }

    // Main service points (entry/electrical room)
    const serviceRoom =
      floorPlans
        .flatMap((fp) => fp.rooms)
        .find(
          (r) =>
            r.spec.type === 'electrical_panel' ||
            r.spec.type === 'utility' ||
            r.spec.type === 'entrance_lobby',
        ) || floorPlans[0]?.rooms[0];

    if (serviceRoom) {
      fixtures.push(
        {
          id: `EF-${fixtureId++}`,
          type: 'distribution_board',
          x: Math.round((serviceRoom.x + 0.25) * 100) / 100,
          y: Math.round((serviceRoom.y + 0.25) * 100) / 100,
          roomId: serviceRoom.id,
          circuit: 'CKT-MOTOR',
          wattage: 0,
          height: 1.5,
        },
        {
          id: `EF-${fixtureId++}`,
          type: 'meter_board',
          x: Math.round((serviceRoom.x + 0.15) * 100) / 100,
          y: Math.round((serviceRoom.y + 0.15) * 100) / 100,
          roomId: serviceRoom.id,
          circuit: 'CKT-MOTOR',
          wattage: 0,
          height: 1.5,
        },
        {
          id: `EF-${fixtureId++}`,
          type: 'earth_point',
          x: Math.round((serviceRoom.x + 0.1) * 100) / 100,
          y: Math.round((serviceRoom.y + 0.1) * 100) / 100,
          roomId: serviceRoom.id,
          circuit: 'CKT-MOTOR',
          wattage: 0,
          height: 0,
        },
      );

      if (floorPlans.length <= 2) {
        fixtures.push({
          id: `EF-${fixtureId++}`,
          type: 'inverter_point',
          x: Math.round((serviceRoom.x + 0.4) * 100) / 100,
          y: Math.round((serviceRoom.y + 0.25) * 100) / 100,
          roomId: serviceRoom.id,
          circuit: 'CKT-MOTOR',
          wattage: 1200,
          height: 0.6,
        });
      }
    }

    // EV charging point in parking/garage
    const parkingRoom = floorPlans
      .flatMap((fp) => fp.rooms)
      .find((r) => r.spec.type === 'parking' || r.spec.type === 'garage');
    if (parkingRoom) {
      fixtures.push({
        id: `EF-${fixtureId++}`,
        type: 'ev_charging',
        x: Math.round((parkingRoom.x + 0.5) * 100) / 100,
        y: Math.round((parkingRoom.y + 0.5) * 100) / 100,
        roomId: parkingRoom.id,
        circuit: 'CKT-MOTOR',
        wattage: 7200,
        height: 1.2,
      });
    }

    // Recompute connected load including all generated service fixtures
    const connectedLoad = fixtures.reduce((sum, f) => sum + f.wattage, 0) / 1000;

    // Diversity factors (typical residential):
    // lighting 90%, power 60%, AC 80%, kitchen 70%, geyser 90%, motor 100%
    const categoryLoad = {
      lighting:
        lightingFixtures.reduce((s, f) => s + f.wattage, 0) / 1000,
      power:
        powerFixtures.reduce((s, f) => s + f.wattage, 0) / 1000,
      ac: acFixtures.reduce((s, f) => s + f.wattage, 0) / 1000,
      kitchen:
        kitchenFixtures.reduce((s, f) => s + f.wattage, 0) / 1000,
      geyser:
        geyserFixtures.reduce((s, f) => s + f.wattage, 0) / 1000,
      motor:
        (motorFixtures.reduce((s, f) => s + f.wattage, 0) +
          fixtures.filter((f) => f.type === 'ev_charging').reduce((s, f) => s + f.wattage, 0)) /
        1000,
    };

    const demandLoad =
      categoryLoad.lighting * 0.9 +
      categoryLoad.power * 0.6 +
      categoryLoad.ac * 0.8 +
      categoryLoad.kitchen * 0.7 +
      categoryLoad.geyser * 0.9 +
      categoryLoad.motor * 1.0;

    // Attach all circuits to all DB panels for now (single DB logic per floor)
    for (const panel of panels) {
      panel.circuits = circuits.map((c) => c.id);
    }

    return {
      fixtures,
      circuits,
      mainLoad: connectedLoad,
      connectedLoad,
      demandLoad,
      meterType: connectedLoad > 7.5 ? 'three_phase' : 'single_phase',
      earthingType: 'plate',
      lightningProtection: floorPlans.length > 2,
      solarCapacity: connectedLoad > 5 ? Math.round(connectedLoad * 0.6 * 10) / 10 : undefined,
      backupType: connectedLoad > 7 ? 'both' : 'inverter',
      panels,
    };
  }

  /**
   * Generate plumbing plan
   */
  generatePlumbingPlan(floorPlans: FloorPlan[]): PlumbingPlan {
    const fixtures: PlumbingFixture[] = [];
    const pipes: PlumbingPipe[] = [];
    let fixtureId = 1;

    for (const plan of floorPlans) {
      for (const room of plan.rooms) {
        const roomFixtures = this.generatePlumbingFixturesForRoom(room, fixtureId);
        fixtures.push(...roomFixtures);
        fixtureId += roomFixtures.length;
      }
    }

    // Generate pipe runs connecting fixtures to risers
    const wetRooms = floorPlans.flatMap((fp) =>
      fp.rooms.filter((r) =>
        ['bathroom', 'toilet', 'kitchen', 'laundry', 'utility'].includes(r.spec.type),
      ),
    );

    if (wetRooms.length > 0) {
      // Prefer centralized wet-core room as main stack anchor
      const mainStack = [...wetRooms].sort((a, b) => {
        const aScore = a.spec.type === 'bathroom' || a.spec.type === 'toilet' ? 0 : 1;
        const bScore = b.spec.type === 'bathroom' || b.spec.type === 'toilet' ? 0 : 1;
        return aScore - bScore;
      })[0];

      let pipeId = 1;
      for (const room of wetRooms) {
        const roomCx = room.x + room.width / 2;
        const roomCy = room.y + room.height / 2;
        const stackX = mainStack.x + mainStack.width / 2;
        const stackY = mainStack.y + mainStack.height / 2;

        pipes.push({
          id: `WS-${pipeId}`,
          type: 'water_supply',
          startX: stackX,
          startY: stackY,
          endX: roomCx,
          endY: roomCy,
          diameter: room.spec.type === 'kitchen' ? 25 : 20,
          material: 'cpvc',
          floor: room.floor,
        });
        pipes.push({
          id: `DR-${pipeId}`,
          type: 'drainage',
          startX: roomCx,
          startY: roomCy,
          endX: stackX,
          endY: stackY,
          diameter: 100,
          material: 'upvc',
          slope: 0.02,
          floor: room.floor,
        });

        // Vent stack for every wet room branch
        pipes.push({
          id: `VT-${pipeId}`,
          type: 'vent',
          startX: roomCx + 0.1,
          startY: roomCy,
          endX: roomCx + 0.1,
          endY: roomCy + 1.5,
          diameter: 75,
          material: 'upvc',
          floor: room.floor,
        });

        // Hot water line for bath/kitchen fixtures
        if (['bathroom', 'kitchen', 'utility', 'laundry'].includes(room.spec.type)) {
          pipes.push({
            id: `HW-${pipeId}`,
            type: 'hot_water',
            startX: stackX - 0.15,
            startY: stackY,
            endX: roomCx - 0.15,
            endY: roomCy,
            diameter: 20,
            material: 'cpvc',
            floor: room.floor,
          });
        }

        pipeId++;
      }

      // Site-level wastewater disposal fixture nodes
      const firstGroundRoom = floorPlans
        .flatMap((fp) => fp.rooms)
        .find((r) => r.floor === 0);

      if (firstGroundRoom) {
        fixtures.push(
          {
            id: `PF-${fixtureId++}`,
            type: 'inspection_chamber',
            x: Math.round((firstGroundRoom.x - 0.6) * 100) / 100,
            y: Math.round((firstGroundRoom.y - 0.6) * 100) / 100,
            roomId: firstGroundRoom.id,
            waterSupply: false,
            drainage: true,
            hotWater: false,
            pipeSize: 150,
          },
          {
            id: `PF-${fixtureId++}`,
            type: 'rain_water_harvest',
            x: Math.round((firstGroundRoom.x - 1.0) * 100) / 100,
            y: Math.round((firstGroundRoom.y - 1.0) * 100) / 100,
            roomId: firstGroundRoom.id,
            waterSupply: false,
            drainage: true,
            hotWater: false,
            pipeSize: 160,
          },
          {
            id: `PF-${fixtureId++}`,
            type: 'sump',
            x: Math.round((firstGroundRoom.x - 0.8) * 100) / 100,
            y: Math.round((firstGroundRoom.y + 0.2) * 100) / 100,
            roomId: firstGroundRoom.id,
            waterSupply: true,
            drainage: false,
            hotWater: false,
            pipeSize: 50,
          },
          {
            id: `PF-${fixtureId++}`,
            type: 'overhead_tank',
            x: Math.round((firstGroundRoom.x + 0.2) * 100) / 100,
            y: Math.round((firstGroundRoom.y + 0.2) * 100) / 100,
            roomId: firstGroundRoom.id,
            waterSupply: true,
            drainage: false,
            hotWater: false,
            pipeSize: 50,
          },
          {
            id: `PF-${fixtureId++}`,
            type: 'pressure_pump',
            x: Math.round((firstGroundRoom.x - 0.4) * 100) / 100,
            y: Math.round((firstGroundRoom.y + 0.1) * 100) / 100,
            roomId: firstGroundRoom.id,
            waterSupply: true,
            drainage: false,
            hotWater: false,
            pipeSize: 40,
          },
        );

        // Rainwater downpipe abstraction (roof -> harvest pit)
        pipes.push({
          id: 'RW-1',
          type: 'rain_water',
          startX: firstGroundRoom.x,
          startY: firstGroundRoom.y + 3.0,
          endX: firstGroundRoom.x - 1.0,
          endY: firstGroundRoom.y - 1.0,
          diameter: 110,
          material: 'upvc',
          slope: 0.01,
          floor: 0,
        });
      }
    }

    return {
      fixtures,
      pipes,
      waterSupplySource: 'both',
      storageCapacity: 5000,
      overheadTankCapacity: 2000,
      sumpCapacity: 3000,
      pumpHP: 1.0,
      sewageDisposal: 'municipal',
      rainwaterHarvesting: true,
      hotWaterSystem: 'solar',
      recyclingSystem: false,
    };
  }

  /**
   * Generate HVAC plan
   */
  generateHVACPlan(floorPlans: FloorPlan[], preferences: UserPreferences): HVACPlan {
    const equipment: HVACEquipment[] = [];
    const ventilationPaths: VentilationPath[] = [];
    const ductRoutes: PlumbingPipe[] = [];
    let eqId = 1;
    let totalCooling = 0;
    let ductId = 1;

    const acType: HVACEquipment['type'] =
      preferences.budget === 'luxury' || preferences.budget === 'premium' ? 'vrf_unit' : 'split_ac';

    for (const plan of floorPlans) {
      const serviceRoom =
        plan.rooms.find(
          (r) => r.spec.type === 'mechanical_room' || r.spec.type === 'utility' || r.spec.type === 'staircase',
        ) || plan.rooms[0];

      if (serviceRoom) {
        equipment.push({
          id: `FAU-${eqId++}`,
          type: 'fresh_air_unit',
          x: serviceRoom.x + 0.3,
          y: serviceRoom.y + 0.3,
          roomId: serviceRoom.id,
          capacity: 800,
          powerConsumption: 450,
        });
      }

      for (const room of plan.rooms) {
        const roomArea = room.width * room.height;

        // AC for rooms > 8 sqm (except bathrooms, corridors, etc.)
        const acEligible = [
          'living',
          'master_bedroom',
          'bedroom',
          'study',
          'home_office',
          'drawing_room',
          'guest_room',
          'childrens_room',
          'library',
          'home_theater',
          'gym',
        ].includes(room.spec.type);

        if (acEligible && roomArea > 8) {
          const tons = Math.ceil((roomArea / 12) * 10) / 10;
          totalCooling += tons;
          equipment.push({
            id: `AC-${eqId++}`,
            type: acType,
            x: room.x + room.width / 2,
            y: room.y + 0.2,
            roomId: room.id,
            capacity: tons,
            powerConsumption: tons * 1200,
          });

          // Thermostat near entry side (not directly below supply)
          equipment.push({
            id: `TH-${eqId++}`,
            type: 'thermostat',
            x: room.x + 0.25,
            y: room.y + room.height / 2,
            roomId: room.id,
            powerConsumption: 5,
          });

          // Supply diffuser and return grille points
          equipment.push(
            {
              id: `DF-${eqId++}`,
              type: 'diffuser',
              x: room.x + room.width * 0.35,
              y: room.y + room.height * 0.5,
              roomId: room.id,
              capacity: Math.round((tons * 400 + Number.EPSILON) * 100) / 100,
              powerConsumption: 0,
            },
            {
              id: `GR-${eqId++}`,
              type: 'grille',
              x: room.x + room.width * 0.7,
              y: room.y + room.height * 0.5,
              roomId: room.id,
              powerConsumption: 0,
            },
          );

          if (serviceRoom) {
            ductRoutes.push({
              id: `DUCT-${ductId++}`,
              type: 'water_supply',
              startX: serviceRoom.x + serviceRoom.width / 2,
              startY: serviceRoom.y + serviceRoom.height / 2,
              endX: room.x + room.width / 2,
              endY: room.y + room.height / 2,
              diameter: Math.max(200, Math.round(tons * 120)),
              material: 'gi',
              floor: room.floor,
            });
          }
        }

        // Ceiling fan for all rooms > 6 sqm
        if (
          roomArea > 6 &&
          !['bathroom', 'toilet', 'store', 'walk_in_closet'].includes(room.spec.type)
        ) {
          equipment.push({
            id: `FAN-${eqId++}`,
            type: 'ceiling_fan',
            x: room.x + room.width / 2,
            y: room.y + room.height / 2,
            roomId: room.id,
            powerConsumption: 75,
          });
        }

        // Exhaust fan for kitchen, bathrooms
        if (['kitchen', 'bathroom', 'toilet', 'laundry'].includes(room.spec.type)) {
          equipment.push({
            id: `EXH-${eqId++}`,
            type: 'exhaust_fan',
            x: room.x + room.width - 0.3,
            y: room.y + room.height - 0.3,
            roomId: room.id,
            powerConsumption: 40,
          });

          ventilationPaths.push({
            id: `VP-MECH-${plan.floor}-${room.id}`,
            startRoomId: room.id,
            type: 'mechanical',
            airflow: room.spec.type === 'kitchen' ? 120 : room.spec.type === 'toilet' ? 70 : 90,
            direction: 'N',
          });
        }

        // Kitchen chimney
        if (room.spec.type === 'kitchen') {
          equipment.push({
            id: `CHM-${eqId++}`,
            type: 'chimney',
            x: room.x + room.width / 2,
            y: room.y + 0.3,
            roomId: room.id,
            powerConsumption: 200,
          });
        }

        // Dedicated ventilator for toilets without windows
        if (room.spec.type === 'toilet' && room.windows.length === 0) {
          equipment.push({
            id: `VNT-${eqId++}`,
            type: 'ventilator',
            x: room.x + room.width - 0.2,
            y: room.y + room.height - 0.2,
            roomId: room.id,
            capacity: 60,
            powerConsumption: 25,
          });
        }
      }

      // Cross ventilation paths
      const mainRooms = plan.rooms.filter((r) => r.spec.requiresVentilation);
      for (let i = 0; i < mainRooms.length; i++) {
        for (let j = i + 1; j < mainRooms.length; j++) {
          if (this.areRoomsAdjacent(mainRooms[i], mainRooms[j])) {
            ventilationPaths.push({
              id: `VP-${i}-${j}`,
              startRoomId: mainRooms[i].id,
              endRoomId: mainRooms[j].id,
              type:
                mainRooms[i].windows.length > 0 && mainRooms[j].windows.length > 0
                  ? 'natural'
                  : 'mixed',
              airflow: 50 + Math.round((mainRooms[i].width * mainRooms[i].height) / 3),
              direction: 'N',
            });
          }
        }
      }
    }

    return {
      equipment,
      ventilationPaths,
      coolingLoad: totalCooling,
      ventilationRate: preferences.climate === 'hot_humid' ? 8 : 6,
      freshAirPercentage: preferences.climate === 'hot_humid' ? 30 : 20,
      ductRoutes,
    };
  }

  /**
   * Generate sunlight analysis
   */
  generateSunlightAnalysis(
    floorPlans: FloorPlan[],
    latitude: number,
    longitude: number,
  ): SunlightAnalysis {
    // Calculate solar angles based on latitude
    const summerAltitude = 90 - latitude + 23.44;
    const winterAltitude = 90 - latitude - 23.44;

    const roomSunlight = floorPlans.flatMap((fp) =>
      fp.rooms.map((room) => {
        const hasEastWindow = room.windows.some((w) => w.wallSide === 'E');
        const hasSouthWindow = room.windows.some((w) => w.wallSide === 'S');
        const hasWestWindow = room.windows.some((w) => w.wallSide === 'W');
        const hasNorthWindow = room.windows.some((w) => w.wallSide === 'N');

        const summerHours =
          (hasEastWindow ? 3 : 0) +
          (hasSouthWindow ? 2 : 0) +
          (hasWestWindow ? 3 : 0) +
          (hasNorthWindow ? 1 : 0);
        const winterHours =
          (hasEastWindow ? 2 : 0) + (hasSouthWindow ? 4 : 0) + (hasWestWindow ? 2 : 0);

        const windowArea = room.windows.reduce((sum, w) => sum + w.width * w.height, 0);
        const floorArea = room.width * room.height;
        const naturalLightFactor = Math.min(1, windowArea / (floorArea * 0.2));

        return {
          roomId: room.id,
          hoursOfDirectSun: { summer: summerHours, winter: winterHours },
          naturalLightFactor,
          glareRisk: hasWestWindow && room.spec.type === 'home_office',
          uvExposure: (hasWestWindow ? 'high' : hasEastWindow ? 'medium' : 'low') as
            | 'low'
            | 'medium'
            | 'high',
        };
      }),
    );

    return {
      latitude,
      longitude,
      timezone: 'Asia/Kolkata',
      solsticeAngles: {
        summer: { altitude: Math.min(90, summerAltitude), azimuth: 90 },
        winter: { altitude: Math.max(10, winterAltitude), azimuth: 135 },
      },
      roomSunlight,
      shadowPatterns: this.generateShadowPatterns(latitude),
      recommendations: this.generateSunlightRecommendations(roomSunlight),
    };
  }

  /**
   * Generate airflow analysis
   */
  generateAirflowAnalysis(floorPlans: FloorPlan[], orientation: SiteOrientation): AirflowAnalysis {
    const prevailingWind: CardinalDirection =
      orientation.plotFacing === 'N'
        ? 'SW'
        : orientation.plotFacing === 'S'
          ? 'NE'
          : orientation.plotFacing === 'E'
            ? 'W'
            : 'E';

    const roomVentilation = floorPlans.flatMap((fp) =>
      fp.rooms.map((room) => {
        const windowCount = room.windows.length;
        const totalOpenableArea = room.windows.reduce((sum, w) => sum + w.width * w.height, 0);
        const floorArea = room.width * room.height;
        const openingRatio = floorArea > 0 ? totalOpenableArea / floorArea : 0;

        const hasOppositeWindows =
          room.windows.some((w) => w.wallSide === 'N' || w.wallSide === 'E') &&
          room.windows.some((w) => w.wallSide === 'S' || w.wallSide === 'W');

        const corridorBonus = fp.corridors.some(
          (c) =>
            room.x + room.width > c.x &&
            room.x < c.x + c.width &&
            room.y + room.height > c.y &&
            room.y < c.y + c.height,
        )
          ? 0.5
          : 0;

        const wetMechanicalBoost = ['kitchen', 'bathroom', 'toilet', 'laundry'].includes(room.spec.type)
          ? 1.0
          : 0;

        const achBase = windowCount === 0 ? 0.6 : hasOppositeWindows ? 6.5 : windowCount >= 2 ? 4.2 : 2.6;
        const achFromOpenings = Math.min(2, openingRatio * 20);
        const ach = Math.round((achBase + achFromOpenings + corridorBonus + wetMechanicalBoost) * 10) / 10;

        return {
          roomId: room.id,
          airChangesPerHour: ach,
          adequacy: (ach >= 6 ? 'excellent' : ach >= 4 ? 'good' : ach >= 2 ? 'fair' : 'poor') as
            | 'excellent'
            | 'good'
            | 'fair'
            | 'poor',
          recommendation:
            ach < 4
              ? 'Consider adding windows on opposite walls for cross ventilation'
              : hasOppositeWindows
                ? 'Good cross ventilation and acceptable ACH'
                : 'Ventilation acceptable; opposite-wall openings can improve comfort',
        };
      }),
    );

    const crossVentilationPaths = floorPlans.flatMap((fp) => {
      const paths: AirflowAnalysis['crossVentilationPaths'] = [];
      for (const room of fp.rooms) {
        if (room.windows.length >= 2) {
          const sides = room.windows.map((w) => w.wallSide);
          if (
            (sides.includes('N') && sides.includes('S')) ||
            (sides.includes('E') && sides.includes('W'))
          ) {
            const openableArea = room.windows.reduce((sum, w) => sum + w.width * w.height, 0);
            const areaFactor = Math.min(1, openableArea / Math.max(1, room.width * room.height * 0.15));
            paths.push({
              inletRoom: room.id,
              outletRoom: room.id,
              effectiveness: Math.round((0.6 + areaFactor * 0.35) * 100) / 100,
            });
          }
        }
      }
      return paths;
    });

    const stackVentilationPotential =
      floorPlans.length > 1
        ? Math.min(0.9, 0.45 + floorPlans.length * 0.15)
        : 0.35;

    return {
      prevailingWindDirection: prevailingWind,
      windSpeed: 3.5,
      crossVentilationPaths,
      stackVentilationPotential,
      roomVentilation,
    };
  }

  /**
   * Generate elevation view
   */
  generateElevation(
    floorPlans: FloorPlan[],
    plot: PlotDimensions,
    constraints: SiteConstraints,
    viewType: 'front_elevation' | 'rear_elevation' | 'left_elevation' | 'right_elevation',
    preferences: UserPreferences,
  ): ElevationView {
    const elements: ElevationElement[] = [];
    const dimensions: DimensionLine[] = [];
    const labels: TextLabel[] = [];

    const buildableWidth =
      viewType === 'front_elevation' || viewType === 'rear_elevation'
        ? plot.width - constraints.setbacks.left - constraints.setbacks.right
        : plot.depth - constraints.setbacks.front - constraints.setbacks.rear;

    let currentHeight = 0;
    const plinthHeight = 0.6;
    const parapetHeight = 0.9;
    const foundationDepth = 1.5;

    // Foundation
    elements.push({
      type: 'foundation',
      points: [
        { x: -0.3, y: -foundationDepth },
        { x: buildableWidth + 0.3, y: -foundationDepth },
        { x: buildableWidth + 0.3, y: 0 },
        { x: -0.3, y: 0 },
      ],
      fill: '#9CA3AF',
      stroke: '#374151',
      lineWeight: 0.5,
      hatch: 'concrete',
    });

    // Plinth
    elements.push({
      type: 'plinth',
      points: [
        { x: 0, y: 0 },
        { x: buildableWidth, y: 0 },
        { x: buildableWidth, y: plinthHeight },
        { x: 0, y: plinthHeight },
      ],
      fill: '#D1D5DB',
      stroke: '#374151',
      lineWeight: 0.7,
    });
    currentHeight = plinthHeight;

    // Each floor
    for (const plan of floorPlans) {
      const floorTop = currentHeight + plan.floorHeight;

      // Wall
      elements.push({
        type: 'wall',
        points: [
          { x: 0, y: currentHeight },
          { x: buildableWidth, y: currentHeight },
          { x: buildableWidth, y: floorTop },
          { x: 0, y: floorTop },
        ],
        fill: '#FEF3C7',
        stroke: '#374151',
        lineWeight: 0.5,
      });

      // Windows on this floor's front face
      const frontRooms =
        viewType === 'front_elevation'
          ? plan.rooms.filter((r) => r.y <= constraints.setbacks.front + 0.5)
          : viewType === 'rear_elevation'
            ? plan.rooms.filter(
                (r) => r.y + r.height >= plot.depth - constraints.setbacks.rear - 0.5,
              )
            : viewType === 'left_elevation'
              ? plan.rooms.filter((r) => r.x <= constraints.setbacks.left + 0.5)
              : plan.rooms.filter(
                  (r) => r.x + r.width >= plot.width - constraints.setbacks.right - 0.5,
                );

      for (const room of frontRooms) {
        const wallSide =
          viewType === 'front_elevation'
            ? 'S'
            : viewType === 'rear_elevation'
              ? 'N'
              : viewType === 'left_elevation'
                ? 'W'
                : 'E';
        const windows = room.windows.filter((w) => w.wallSide === wallSide);
        for (const win of windows) {
          const wx =
            viewType === 'front_elevation' || viewType === 'rear_elevation'
              ? room.x + win.position - constraints.setbacks.left
              : room.y + win.position - constraints.setbacks.front;
          elements.push({
            type: 'window',
            points: [
              { x: wx, y: currentHeight + win.sillHeight },
              { x: wx + win.width, y: currentHeight + win.sillHeight },
              { x: wx + win.width, y: currentHeight + win.sillHeight + win.height },
              { x: wx, y: currentHeight + win.sillHeight + win.height },
            ],
            fill: '#BFDBFE',
            stroke: '#1E40AF',
            lineWeight: 0.3,
          });
        }

        // Doors
        const doors = room.doors.filter((d) => d.wallSide === wallSide);
        for (const door of doors) {
          const dx =
            viewType === 'front_elevation' || viewType === 'rear_elevation'
              ? room.x + door.position - constraints.setbacks.left
              : room.y + door.position - constraints.setbacks.front;
          elements.push({
            type: 'door',
            points: [
              { x: dx, y: currentHeight },
              { x: dx + door.width, y: currentHeight },
              { x: dx + door.width, y: currentHeight + door.height },
              { x: dx, y: currentHeight + door.height },
            ],
            fill: '#92400E',
            stroke: '#78350F',
            lineWeight: 0.3,
          });
        }
      }

      // Slab line
      elements.push({
        type: 'slab',
        points: [
          { x: -0.15, y: floorTop },
          { x: buildableWidth + 0.15, y: floorTop },
          { x: buildableWidth + 0.15, y: floorTop + plan.slabThickness },
          { x: -0.15, y: floorTop + plan.slabThickness },
        ],
        fill: '#6B7280',
        stroke: '#374151',
        lineWeight: 0.7,
      });

      // Floor height dimension
      dimensions.push({
        startX: buildableWidth + 0.8,
        startY: currentHeight,
        endX: buildableWidth + 0.8,
        endY: floorTop,
        value: `${plan.floorHeight.toFixed(2)}m`,
        offset: 0.5,
        type: 'linear',
      });

      labels.push({
        x: buildableWidth + 1.5,
        y: currentHeight + plan.floorHeight / 2,
        text: plan.label,
        fontSize: 10,
        rotation: 0,
        anchor: 'start',
      });

      currentHeight = floorTop + plan.slabThickness;
    }

    // Parapet
    elements.push({
      type: 'parapet',
      points: [
        { x: 0, y: currentHeight },
        { x: buildableWidth, y: currentHeight },
        { x: buildableWidth, y: currentHeight + parapetHeight },
        { x: 0, y: currentHeight + parapetHeight },
      ],
      fill: '#E5E7EB',
      stroke: '#374151',
      lineWeight: 0.5,
    });

    // Roof based on preference
    if (preferences.roofType !== 'flat') {
      const roofPeak = currentHeight + parapetHeight + 2.0;
      elements.push({
        type: 'roof',
        points: [
          { x: -0.3, y: currentHeight + parapetHeight },
          { x: buildableWidth / 2, y: roofPeak },
          { x: buildableWidth + 0.3, y: currentHeight + parapetHeight },
        ],
        fill: '#DC2626',
        stroke: '#991B1B',
        lineWeight: 0.5,
      });
    }

    // Overall width dimension
    dimensions.push({
      startX: 0,
      startY: -foundationDepth - 0.5,
      endX: buildableWidth,
      endY: -foundationDepth - 0.5,
      value: `${buildableWidth.toFixed(2)}m`,
      offset: 0.5,
      type: 'linear',
    });

    // Overall height dimension
    const totalHeight = currentHeight + parapetHeight;
    dimensions.push({
      startX: -1.2,
      startY: -foundationDepth,
      endX: -1.2,
      endY: totalHeight,
      value: `${(totalHeight + foundationDepth).toFixed(2)}m`,
      offset: 0.5,
      type: 'linear',
    });

    return {
      type: viewType,
      elements,
      dimensions,
      labels,
      scale: 100,
    };
  }

  /**
   * Generate cross-section view
   */
  generateSection(
    floorPlans: FloorPlan[],
    sectionLine: SectionLine,
    plot: PlotDimensions,
    constraints: SiteConstraints,
    structural: StructuralPlan,
  ): ElevationView {
    const elements: ElevationElement[] = [];
    const dimensions: DimensionLine[] = [];
    const labels: TextLabel[] = [];

    const buildableWidth =
      sectionLine.direction === 'horizontal'
        ? plot.width - constraints.setbacks.left - constraints.setbacks.right
        : plot.depth - constraints.setbacks.front - constraints.setbacks.rear;

    const foundationDepth = 1.5;
    const plinthHeight = 0.6;
    let currentHeight = 0;

    // Ground line
    elements.push({
      type: 'foundation',
      points: [
        { x: -1, y: 0 },
        { x: buildableWidth + 1, y: 0 },
        { x: buildableWidth + 1, y: -0.05 },
        { x: -1, y: -0.05 },
      ],
      stroke: '#374151',
      lineWeight: 1.0,
      hatch: 'ground',
    });

    // Foundation section
    for (const foundation of structural.foundations) {
      const fx = sectionLine.direction === 'horizontal' ? foundation.x : foundation.y;
      if (Math.abs(fx - sectionLine.startX) < 2 || sectionLine.direction === 'horizontal') {
        elements.push({
          type: 'foundation',
          points: [
            { x: fx - foundation.width / 2, y: -foundationDepth },
            { x: fx + foundation.width / 2, y: -foundationDepth },
            { x: fx + foundation.width / 2, y: -foundationDepth + foundation.thickness },
            { x: fx - foundation.width / 2, y: -foundationDepth + foundation.thickness },
          ],
          fill: '#9CA3AF',
          stroke: '#374151',
          lineWeight: 0.7,
          hatch: 'concrete',
        });
      }
    }

    // Plinth beam
    elements.push({
      type: 'beam',
      points: [
        { x: 0, y: 0 },
        { x: buildableWidth, y: 0 },
        { x: buildableWidth, y: plinthHeight },
        { x: 0, y: plinthHeight },
      ],
      fill: '#D1D5DB',
      stroke: '#374151',
      lineWeight: 0.7,
      hatch: 'brick',
    });

    currentHeight = plinthHeight;

    for (const plan of floorPlans) {
      const floorTop = currentHeight + plan.floorHeight;

      // Walls (cut)
      elements.push({
        type: 'wall',
        points: [
          { x: 0, y: currentHeight },
          { x: 0.23, y: currentHeight },
          { x: 0.23, y: floorTop },
          { x: 0, y: floorTop },
        ],
        fill: '#FEF3C7',
        stroke: '#374151',
        lineWeight: 0.7,
        hatch: 'brick',
      });

      elements.push({
        type: 'wall',
        points: [
          { x: buildableWidth - 0.23, y: currentHeight },
          { x: buildableWidth, y: currentHeight },
          { x: buildableWidth, y: floorTop },
          { x: buildableWidth - 0.23, y: floorTop },
        ],
        fill: '#FEF3C7',
        stroke: '#374151',
        lineWeight: 0.7,
        hatch: 'brick',
      });

      // Columns cut
      for (const col of structural.columns) {
        const cx = sectionLine.direction === 'horizontal' ? col.x : col.y;
        elements.push({
          type: 'column',
          points: [
            { x: cx - col.width / 2, y: currentHeight },
            { x: cx + col.width / 2, y: currentHeight },
            { x: cx + col.width / 2, y: floorTop },
            { x: cx - col.width / 2, y: floorTop },
          ],
          fill: '#6B7280',
          stroke: '#1F2937',
          lineWeight: 0.8,
          hatch: 'concrete',
        });
      }

      // Slab
      elements.push({
        type: 'slab',
        points: [
          { x: -0.15, y: floorTop },
          { x: buildableWidth + 0.15, y: floorTop },
          { x: buildableWidth + 0.15, y: floorTop + plan.slabThickness },
          { x: -0.15, y: floorTop + plan.slabThickness },
        ],
        fill: '#4B5563',
        stroke: '#1F2937',
        lineWeight: 0.8,
        hatch: 'concrete',
      });

      // Room labels
      const rooms =
        sectionLine.direction === 'horizontal'
          ? plan.rooms.filter(
              (r) => r.y <= sectionLine.startY && r.y + r.height >= sectionLine.startY,
            )
          : plan.rooms.filter(
              (r) => r.x <= sectionLine.startX && r.x + r.width >= sectionLine.startX,
            );

      for (const room of rooms) {
        const rx =
          sectionLine.direction === 'horizontal'
            ? room.x + room.width / 2
            : room.y + room.height / 2;
        labels.push({
          x: rx,
          y: currentHeight + plan.floorHeight / 2,
          text: room.spec.name,
          fontSize: 8,
          rotation: 0,
          anchor: 'middle',
        });
      }

      // Level label
      labels.push({
        x: buildableWidth + 1.0,
        y: currentHeight,
        text: `+${currentHeight.toFixed(2)}`,
        fontSize: 8,
        rotation: 0,
        anchor: 'start',
      });

      currentHeight = floorTop + plan.slabThickness;
    }

    return {
      type: 'section_AA',
      elements,
      dimensions,
      labels,
      scale: 50,
    };
  }

  /**
   * Generate complete house plan project
   */
  generateCompletePlan(
    plot: PlotDimensions,
    orientation: SiteOrientation,
    constraints: SiteConstraints,
    roomSpecs: RoomSpec[],
    preferences: UserPreferences,
    location: { latitude: number; longitude: number; city: string; state: string; country: string },
  ): HousePlanProject {
    // Group rooms by floor
    const floorNumbers = [...new Set(roomSpecs.map((r) => r.floor))].sort();

    // Generate floor plans
    const floorPlans = floorNumbers.map((floor) =>
      this.generateFloorPlan(plot, orientation, constraints, roomSpecs, preferences, floor),
    );

    // Generate structural plan
    const structural = this.generateStructuralPlan(floorPlans, plot, constraints);

    // Generate MEP plans
    const electrical = this.generateElectricalPlan(floorPlans);
    const plumbing = this.generatePlumbingPlan(floorPlans);
    const hvac = this.generateHVACPlan(floorPlans, preferences);

    // Vastu analysis
    const vastu = vastuEngine.analyzePlan(floorPlans, orientation);

    // Sunlight analysis
    const sunlight = this.generateSunlightAnalysis(
      floorPlans,
      location.latitude,
      location.longitude,
    );

    // Airflow analysis
    const airflow = this.generateAirflowAnalysis(floorPlans, orientation);

    // Generate elevation views
    const elevations = [
      this.generateElevation(floorPlans, plot, constraints, 'front_elevation', preferences),
      this.generateElevation(floorPlans, plot, constraints, 'rear_elevation', preferences),
      this.generateElevation(floorPlans, plot, constraints, 'left_elevation', preferences),
      this.generateElevation(floorPlans, plot, constraints, 'right_elevation', preferences),
    ];

    // Section lines
    const buildableWidth = plot.width - constraints.setbacks.left - constraints.setbacks.right;
    const buildableDepth = plot.depth - constraints.setbacks.front - constraints.setbacks.rear;
    const sectionLines: SectionLine[] = [
      {
        id: 'AA',
        label: 'A-A',
        startX: constraints.setbacks.left,
        startY: constraints.setbacks.front + buildableDepth / 2,
        endX: constraints.setbacks.left + buildableWidth,
        endY: constraints.setbacks.front + buildableDepth / 2,
        direction: 'horizontal',
      },
      {
        id: 'BB',
        label: 'B-B',
        startX: constraints.setbacks.left + buildableWidth / 2,
        startY: constraints.setbacks.front,
        endX: constraints.setbacks.left + buildableWidth / 2,
        endY: constraints.setbacks.front + buildableDepth,
        direction: 'vertical',
      },
    ];

    // Generate sections
    const sections = sectionLines.map((sl) =>
      this.generateSection(floorPlans, sl, plot, constraints, structural),
    );

    // Color schemes
    const colorSchemes = roomSpecs.map((r) => {
      const direction = vastuEngine.getIdealDirection(r.type)[0];
      return vastuEngine.getColorRecommendations(r.type, direction);
    });

    return {
      id: `project-${Date.now()}`,
      name: 'House Plan',
      description: `${roomSpecs.length} room house plan on ${plot.width}m × ${plot.depth}m plot`,
      createdAt: new Date(),
      updatedAt: new Date(),
      plot,
      orientation,
      constraints,
      location,
      floorPlans,
      roomSpecs,
      colorSchemes,
      structural,
      electrical,
      plumbing,
      hvac,
      vastu,
      sunlight,
      airflow,
      elevations,
      sections,
      sectionLines,
      designCode: 'IS 456:2000 / IS 800:2007',
      buildingCode: 'NBC 2016',
      status: 'draft',
    };
  }

  // ============================================
  // PRIVATE HELPER METHODS
  // ============================================

  private sortRoomsByPriority(rooms: RoomSpec[], orientation: SiteOrientation): RoomSpec[] {
    // Architect priority: public → private → service → utility
    const ZONE_ORDER: Record<string, number> = {
      entrance_lobby: 0, foyer: 0, living: 1, drawing_room: 1,
      dining: 2, kitchen: 3, pantry: 4, utility: 4, store: 4,
      master_bedroom: 5, bedroom: 6, childrens_room: 6, guest_room: 6,
      study: 7, home_office: 7, library: 7,
      bathroom: 8, toilet: 8, walk_in_closet: 8, dressing: 8,
      pooja: 9, staircase: 10, lift: 10, corridor: 10,
      laundry: 11, servants_quarter: 11, mechanical_room: 11,
      parking: 12, garage: 12, balcony: 13, terrace: 13,
    };
    const priorityOrder = { essential: 0, important: 1, desirable: 2, optional: 3 };
    return [...rooms].sort((a, b) => {
      // Attached baths placed immediately after their parent bedroom
      // Essential rooms first, then by zone order, then by area (larger first)
      const pa = priorityOrder[a.priority];
      const pb = priorityOrder[b.priority];
      if (pa !== pb) return pa - pb;
      const za = ZONE_ORDER[a.type] ?? 20;
      const zb = ZONE_ORDER[b.type] ?? 20;
      if (za !== zb) return za - zb;
      return (b.preferredArea || 0) - (a.preferredArea || 0);
    });
  }

  // ────────────────────────────────────────────────────────────────────────
  // ARCHITECTURAL INTELLIGENCE: Row-packing layout with shared walls
  // ────────────────────────────────────────────────────────────────────────
  //
  // STRATEGY:
  //   1. Classify rooms into PUBLIC zone (front) and PRIVATE zone (rear).
  //   2. Insert a 1.2m corridor between zones.
  //   3. Within each zone, pack rooms LEFT→RIGHT in rows that share walls.
  //   4. Attached bathrooms are placed immediately adjacent to their parent
  //      room on the shorter wall side.
  //   5. Wet rooms (bath/toilet/kitchen) are clustered to share plumbing walls.
  //   6. Rooms snap to exact wall edges — zero gaps.
  //
  // This produces a layout where:
  //   - Every room shares at least one wall with another room or the corridor
  //   - Bathrooms attach to bedrooms on the correct side
  //   - Doors face the corridor / accessible space
  //   - Toilets/bathrooms have doors opening outward or into a passage
  // ────────────────────────────────────────────────────────────────────────

  /** Which architectural zone a room belongs to */
  private getRoomZone(type: RoomType): 'public' | 'private' | 'service' | 'circulation' {
    const PUBLIC_ROOMS: RoomType[] = [
      'living', 'dining', 'drawing_room', 'entrance_lobby', 'foyer',
      'guest_room', 'pooja', 'sit_out', 'verandah',
    ];
    const SERVICE_ROOMS: RoomType[] = [
      'kitchen', 'pantry', 'utility', 'store', 'laundry',
      'servants_quarter', 'mechanical_room', 'electrical_panel',
      'water_tank_room', 'parking', 'garage',
    ];
    const CIRCULATION: RoomType[] = ['corridor', 'staircase', 'lift'];
    if (PUBLIC_ROOMS.includes(type)) return 'public';
    if (SERVICE_ROOMS.includes(type)) return 'service';
    if (CIRCULATION.includes(type)) return 'circulation';
    return 'private'; // bedrooms, bathrooms, study, etc.
  }

  /** Check if a room type is a wet room that needs plumbing clustering */
  private isWetRoom(type: RoomType): boolean {
    return ['bathroom', 'toilet', 'kitchen', 'laundry', 'utility'].includes(type);
  }

  /** Check if room is an attached bath (placed beside its parent bedroom) */
  private isAttachedBath(type: RoomType): boolean {
    return type === 'bathroom' || type === 'toilet' || type === 'walk_in_closet' || type === 'dressing';
  }

  /** Snap value to 250mm structural grid */
  private snapToGrid(v: number): number {
    return Math.round(v * 4) / 4;
  }

  /** Find which sides of a room touch the plot boundary (external walls) */
  private getExternalSides(
    room: { x: number; y: number; width: number; height: number },
    bounds: { x: number; y: number; w: number; h: number },
  ): Set<'N' | 'S' | 'E' | 'W'> {
    const sides = new Set<'N' | 'S' | 'E' | 'W'>();
    const EPS = 0.15;
    if (Math.abs(room.y - bounds.y) < EPS) sides.add('S');
    if (Math.abs(room.y + room.height - (bounds.y + bounds.h)) < EPS) sides.add('N');
    if (Math.abs(room.x - bounds.x) < EPS) sides.add('W');
    if (Math.abs(room.x + room.width - (bounds.x + bounds.w)) < EPS) sides.add('E');
    return sides;
  }

  /** Find which wall side faces another SPECIFIC room (shared wall detection) */
  private getSharedWallSide(
    room: { x: number; y: number; width: number; height: number },
    neighbor: { x: number; y: number; width: number; height: number },
  ): 'N' | 'S' | 'E' | 'W' | null {
    const EPS = 0.15;
    // Do they share a horizontal edge?
    const overlapX = Math.min(room.x + room.width, neighbor.x + neighbor.width) - Math.max(room.x, neighbor.x);
    const overlapY = Math.min(room.y + room.height, neighbor.y + neighbor.height) - Math.max(room.y, neighbor.y);

    if (overlapX > 0.5) {
      if (Math.abs(room.y - (neighbor.y + neighbor.height)) < EPS) return 'S';
      if (Math.abs(room.y + room.height - neighbor.y) < EPS) return 'N';
    }
    if (overlapY > 0.5) {
      if (Math.abs(room.x - (neighbor.x + neighbor.width)) < EPS) return 'W';
      if (Math.abs(room.x + room.width - neighbor.x) < EPS) return 'E';
    }
    return null;
  }

  /** Check if rooms share a wall edge (not just touching at a corner) */
  private sharesWall(
    a: { x: number; y: number; width: number; height: number },
    b: { x: number; y: number; width: number; height: number },
  ): boolean {
    return this.getSharedWallSide(a, b) !== null;
  }

  private placeRooms(
    rooms: RoomSpec[],
    buildableWidth: number,
    buildableDepth: number,
    setbacks: { front: number; rear: number; left: number; right: number },
    orientation: SiteOrientation,
    preferences: UserPreferences,
  ): PlacedRoom[] {
    const placed: PlacedRoom[] = [];
    const EXT_WALL = 0.23;  // 230mm external wall
    const INT_WALL = 0.115; // 115mm partition wall
    const CORRIDOR_W = 1.2; // 1.2m corridor (NBC minimum)

    // ── Buildable envelope ──
    const ox = setbacks.left;
    const oy = setbacks.front;
    const envW = buildableWidth;
    const envH = buildableDepth;
    const bounds = { x: ox, y: oy, w: envW, h: envH };

    // ── Classify rooms into front (public+service) and rear (private) zones ──
    const frontRooms: RoomSpec[] = [];
    const rearRooms: RoomSpec[] = [];
    const attachedBaths: RoomSpec[] = [];
    const circulationRooms: RoomSpec[] = [];

    // ── ENTRY SEQUENCE LOGIC ──
    // Real architectural entry: entrance → lobby/foyer → living/drawing room
    // Ensure entrance_lobby is FIRST in front zone, followed by living
    let hasLobby = false;
    let lobbyRoom: RoomSpec | null = null;
    let livingRoom: RoomSpec | null = null;

    for (const room of rooms) {
      if (room.type === 'entrance_lobby' || room.type === 'foyer') {
        hasLobby = true;
        lobbyRoom = room;
      }
      if (room.type === 'living' || room.type === 'drawing_room') {
        livingRoom = room;
      }
    }

    for (const room of rooms) {
      if (this.getRoomZone(room.type) === 'circulation') {
        circulationRooms.push(room);
      } else if (this.isAttachedBath(room.type) && room.requiresAttachedBath === false) {
        // This is an attached bath for a bedroom — defer placement
        attachedBaths.push(room);
      } else {
        const zone = this.getRoomZone(room.type);
        if (zone === 'public' || zone === 'service') {
          frontRooms.push(room);
        } else {
          rearRooms.push(room);
        }
      }
    }

    // ── Ensure entry sequence: lobby FIRST in front zone, then living/dining ──
    if (hasLobby && lobbyRoom) {
      const lobbyIdx = frontRooms.findIndex((r) => r.id === lobbyRoom!.id);
      if (lobbyIdx > 0) {
        // Move lobby to the front of the array
        frontRooms.splice(lobbyIdx, 1);
        frontRooms.unshift(lobbyRoom);
      }
    }
    // Ensure living room is right after lobby (or first if no lobby)
    if (livingRoom) {
      const livingIdx = frontRooms.findIndex((r) => r.id === livingRoom!.id);
      const targetIdx = hasLobby ? 1 : 0;
      if (livingIdx >= 0 && livingIdx !== targetIdx) {
        frontRooms.splice(livingIdx, 1);
        frontRooms.splice(targetIdx, 0, livingRoom);
      }
    }

    // If entering from south, public zone is at bottom (south), private at top (north)
    // Orient based on main entry direction
    const entryFromSouth = ['S', 'SE', 'SW'].includes(orientation.mainEntryDirection);
    const entryFromNorth = ['N', 'NE', 'NW'].includes(orientation.mainEntryDirection);

    // Decide which zone gets front (entry side) vs rear
    const publicAtBottom = entryFromSouth || (!entryFromNorth);

    // ── Calculate zone depths ──
    // Front zone gets ~45% of depth, corridor gets 1.2m, rear gets ~55% minus corridor
    const totalUsable = envH - INT_WALL * 2; // account for corridor walls
    const frontDepth = this.snapToGrid(Math.max(3.0, (totalUsable - CORRIDOR_W) * 0.45));
    const rearDepth = this.snapToGrid(totalUsable - CORRIDOR_W - frontDepth);
    const corridorY = publicAtBottom
      ? oy + frontDepth
      : oy + rearDepth;

    // Zone boundaries
    const frontZone = publicAtBottom
      ? { x: ox, y: oy, w: envW, h: frontDepth }
      : { x: ox, y: oy + rearDepth + CORRIDOR_W, w: envW, h: frontDepth };
    const rearZone = publicAtBottom
      ? { x: ox, y: oy + frontDepth + CORRIDOR_W, w: envW, h: rearDepth }
      : { x: ox, y: oy, w: envW, h: rearDepth };
    const corridorZone = { x: ox, y: corridorY, w: envW, h: CORRIDOR_W };

    // ── ROW-PACKING ALGORITHM ──
    // Packs rooms left→right within a zone. When a row is full, starts next row.
    // Adjacent rooms share walls — zero gap between them.
    const packRoomsIntoZone = (
      roomList: RoomSpec[],
      zone: { x: number; y: number; w: number; h: number },
      isPublicZone: boolean,
    ): void => {
      // Sort rooms: wet rooms together on one side, then by size
      const sorted = [...roomList].sort((a, b) => {
        // Kitchen near dining
        if (a.type === 'kitchen' && b.type === 'dining') return -1;
        if (a.type === 'dining' && b.type === 'kitchen') return 1;
        // Wet rooms cluster together
        const wetA = this.isWetRoom(a.type) ? 0 : 1;
        const wetB = this.isWetRoom(b.type) ? 0 : 1;
        if (wetA !== wetB) return wetA - wetB;
        // Larger rooms first to anchor the layout
        return (b.preferredArea || b.minArea) - (a.preferredArea || a.minArea);
      });

      let curX = zone.x;
      let curY = zone.y;
      let rowHeight = 0;

      for (const room of sorted) {
        for (let q = 0; q < (room.quantity || 1); q++) {
          const roomArea = room.preferredArea || room.minArea;

          // ── NBC minimum dimensions enforcement ──
          const nbcMin = MIN_CLEAR_DIM[room.type];
          const minW = nbcMin ? nbcMin.w : (room.minWidth || 2.4);
          const minH = nbcMin ? nbcMin.h : (room.minWidth || 2.4);

          // Calculate dimensions — try to match zone depth for a single row
          let rH = this.snapToGrid(Math.min(zone.h, Math.max(minH, zone.h)));
          let rW = this.snapToGrid(Math.max(minW, roomArea / rH));

          // ── Aspect ratio enforcement per NBC ──
          const maxAR = MAX_ASPECT_RATIO[room.type] || 2.5;
          if (rW / rH > maxAR) {
            // Too wide — constrain width, increase height
            rW = this.snapToGrid(rH * maxAR);
            if (rW * rH < roomArea * 0.85) {
              rH = this.snapToGrid(roomArea / rW);
            }
          } else if (rH / rW > maxAR) {
            // Too tall — constrain height, increase width
            rH = this.snapToGrid(rW * maxAR);
            if (rW * rH < roomArea * 0.85) {
              rW = this.snapToGrid(roomArea / rH);
            }
          }

          // Enforce absolute NBC minimum dimensions
          if (rW < minW) rW = this.snapToGrid(minW);
          if (rH < minH) rH = this.snapToGrid(minH);

          // If room would exceed zone width, try fitting with different proportions
          if (curX + rW > zone.x + zone.w) {
            // Try starting a new row
            if (rowHeight > 0) {
              curX = zone.x;
              curY += rowHeight + INT_WALL;
              rowHeight = 0;
            }
            // If still too wide, fit to remaining width
            if (curX + rW > zone.x + zone.w) {
              rW = this.snapToGrid(zone.x + zone.w - curX);
              rH = this.snapToGrid(Math.max(minH, roomArea / rW));
              // Re-check aspect ratio
              if (rH / rW > maxAR) rH = this.snapToGrid(rW * maxAR);
            }
          }

          // If room would exceed zone height, cap it
          if (curY + rH > zone.y + zone.h) {
            rH = this.snapToGrid(zone.y + zone.h - curY);
          }

          // Skip if too small to fit (use NBC minimums)
          if (rW < minW * 0.8 || rH < minH * 0.8) continue;
          if (curY >= zone.y + zone.h) continue;

          const px = curX;
          const py = curY;

          placed.push({
            id: `${room.id}-${q}`,
            spec: room,
            x: Math.round(px * 100) / 100,
            y: Math.round(py * 100) / 100,
            width: rW,
            height: rH,
            rotation: 0,
            floor: room.floor,
            wallThickness: EXT_WALL,
            doors: [],
            windows: [],
            finishFloor: this.getFloorFinish(room.type, preferences),
            finishWall: this.getWallFinish(room.type, preferences),
            finishCeiling: 'POP finish with white paint',
            ceilingHeight: room.minHeight || 3.0,
            color: ROOM_COLORS[room.type] || '#F3F4F6',
          });

          // If this is a bedroom that needs attached bath, place it now
          if (room.requiresAttachedBath) {
            const bathSpec = attachedBaths.shift() || {
              id: `attached_bath_${room.id}`,
              type: 'bathroom' as RoomType,
              name: `${room.name} Bath`,
              minArea: 3.5,
              preferredArea: 4.5,
              maxArea: 6,
              minWidth: 1.5,
              minHeight: 3.0,
              requiresWindow: true,
              requiresVentilation: true,
              requiresAttachedBath: false,
              priority: 'essential' as const,
              floor: room.floor,
              quantity: 1,
            };

            // Place bath to the RIGHT of the bedroom, sharing left wall
            const bathArea = bathSpec.preferredArea || bathSpec.minArea;
            let bathW = this.snapToGrid(Math.max(1.8, Math.min(2.5, bathArea / rH)));
            let bathH = rH; // Same height as parent room → shared wall

            if (px + rW + bathW > zone.x + zone.w) {
              // Not enough space to the right, place below
              bathW = this.snapToGrid(Math.min(rW * 0.4, 2.5));
              bathH = this.snapToGrid(bathArea / bathW);
              // Bath below bedroom sharing top wall
              if (curY + rH + bathH <= zone.y + zone.h) {
                placed.push({
                  id: `${bathSpec.id}-0`,
                  spec: bathSpec as RoomSpec,
                  x: Math.round(px * 100) / 100,
                  y: Math.round((py + rH) * 100) / 100,
                  width: bathW,
                  height: bathH,
                  rotation: 0,
                  floor: room.floor,
                  wallThickness: INT_WALL,
                  doors: [],
                  windows: [],
                  finishFloor: this.getFloorFinish('bathroom', preferences),
                  finishWall: this.getWallFinish('bathroom', preferences),
                  finishCeiling: 'POP finish with white paint',
                  ceilingHeight: 3.0,
                  color: ROOM_COLORS.bathroom,
                });
              }
            } else {
              // Bath to the right, sharing the left wall
              placed.push({
                id: `${bathSpec.id}-0`,
                spec: bathSpec as RoomSpec,
                x: Math.round((px + rW) * 100) / 100,
                y: Math.round(py * 100) / 100,
                width: bathW,
                height: bathH,
                rotation: 0,
                floor: room.floor,
                wallThickness: INT_WALL,
                doors: [],
                windows: [],
                finishFloor: this.getFloorFinish('bathroom', preferences),
                finishWall: this.getWallFinish('bathroom', preferences),
                finishCeiling: 'POP finish with white paint',
                ceilingHeight: 3.0,
                color: ROOM_COLORS.bathroom,
              });
              curX += bathW; // Advance cursor past the bath
            }
          }

          curX += rW + INT_WALL; // Advance cursor, shared wall between rooms
          rowHeight = Math.max(rowHeight, rH);
        }
      }
    };

    // ── Place rooms in zones ──
    packRoomsIntoZone(frontRooms, frontZone, true);
    packRoomsIntoZone(rearRooms, rearZone, false);

    // ── Place remaining attached baths (not yet consumed) near last bedroom ──
    for (const bath of attachedBaths) {
      for (let q = 0; q < (bath.quantity || 1); q++) {
        // Find the last bedroom that doesn't already have an adjacent bath
        const lastBedroom = [...placed]
          .reverse()
          .find((r) =>
            ['master_bedroom', 'bedroom', 'guest_room', 'childrens_room'].includes(r.spec.type),
          );
        if (lastBedroom) {
          const bathArea = bath.preferredArea || bath.minArea;
          const bathW = this.snapToGrid(Math.max(1.8, Math.min(2.5, bathArea / lastBedroom.height)));
          placed.push({
            id: `${bath.id}-${q}`,
            spec: bath,
            x: Math.round((lastBedroom.x + lastBedroom.width) * 100) / 100,
            y: Math.round(lastBedroom.y * 100) / 100,
            width: bathW,
            height: lastBedroom.height,
            rotation: 0,
            floor: bath.floor,
            wallThickness: INT_WALL,
            doors: [],
            windows: [],
            finishFloor: this.getFloorFinish('bathroom', preferences),
            finishWall: this.getWallFinish('bathroom', preferences),
            finishCeiling: 'POP finish with white paint',
            ceilingHeight: 3.0,
            color: ROOM_COLORS.bathroom,
          });
        }
      }
    }

    // ── Place circulation rooms (staircase, lift) ──
    for (const room of circulationRooms) {
      for (let q = 0; q < (room.quantity || 1); q++) {
        const area = room.preferredArea || room.minArea;
        const rW = this.snapToGrid(Math.min(3.0, Math.max(room.minWidth || 1.2, area / CORRIDOR_W)));
        const rH = this.snapToGrid(area / rW);
        // Place at end of corridor
        placed.push({
          id: `${room.id}-${q}`,
          spec: room,
          x: Math.round((ox + envW - rW) * 100) / 100,
          y: Math.round(corridorZone.y * 100) / 100,
          width: rW,
          height: Math.min(rH, CORRIDOR_W + rearDepth),
          rotation: 0,
          floor: room.floor,
          wallThickness: INT_WALL,
          doors: [],
          windows: [],
          finishFloor: this.getFloorFinish(room.type, preferences),
          finishWall: this.getWallFinish(room.type, preferences),
          finishCeiling: 'POP finish with white paint',
          ceilingHeight: room.minHeight || 3.0,
          color: ROOM_COLORS[room.type] || '#F3F4F6',
        });
      }
    }

    // ── Store corridor zone info for door placement ──
    (this as any)._corridorZone = corridorZone;
    (this as any)._bounds = bounds;

    return placed;
  }

  // ────────────────────────────────────────────────────────────────────────
  // INTELLIGENT DOOR & WINDOW PLACEMENT
  // ────────────────────────────────────────────────────────────────────────
  //
  // DOOR RULES (as an architect designs):
  //   1. Every room door opens INTO A CORRIDOR or passage, never into another room.
  //   2. Bathroom/toilet doors open OUTWARD (away from wet floor) per NBC.
  //   3. Bedroom doors open INWARD (privacy).
  //   4. Door position is on the wall that faces the corridor.
  //   5. Door swing clearance: min 0.9m clear arc on the swing side.
  //   6. No two doors within 0.3m of a corner.
  //   7. Attached bath door is on the shared wall with its parent bedroom.
  //   8. Main entry door is on the external wall facing the entry direction.
  //
  // WINDOW RULES:
  //   1. Windows are ONLY on external walls (walls touching plot boundary).
  //   2. Bathrooms get a ventilator at high level, not a full window.
  //   3. Living/bedroom get at least one window for natural light.
  //   4. Kitchen gets a window above the counter (sill at 1.05m).
  //   5. No window on shared internal walls.
  //   6. Cross-ventilation: opposite walls if room area > 12m².
  // ────────────────────────────────────────────────────────────────────────

  private addDoorsAndWindows(rooms: PlacedRoom[], orientation: SiteOrientation): void {
    const corridorZone = (this as any)._corridorZone as
      | { x: number; y: number; w: number; h: number }
      | undefined;
    const bounds = (this as any)._bounds as
      | { x: number; y: number; w: number; h: number }
      | undefined;

    if (!corridorZone || !bounds) return;

    // Pre-compute occupied positions to check door clearance
    const doorPositions: { x: number; y: number; w: number }[] = [];

    for (const room of rooms) {
      const rType = room.spec.type;
      const externalSides = this.getExternalSides(room, bounds);

      // ─── DOOR PLACEMENT ───

      // Determine which wall the door should be on:
      //  - Attached bath → door on shared wall with parent bedroom
      //  - Entrance lobby → door on external wall facing entry
      //  - All other rooms → door on wall facing the corridor

      let doorWallSide: 'N' | 'S' | 'E' | 'W' = 'S';
      let doorIsAttachedBath = false;

      if (rType === 'entrance_lobby' || rType === 'foyer') {
        // Main entry on external wall facing entry direction
        const entryDir = orientation.mainEntryDirection;
        if (entryDir === 'S' || entryDir === 'SE' || entryDir === 'SW') doorWallSide = 'S';
        else if (entryDir === 'N' || entryDir === 'NE' || entryDir === 'NW') doorWallSide = 'N';
        else if (entryDir === 'E') doorWallSide = 'E';
        else doorWallSide = 'W';
      } else if (this.isAttachedBath(rType)) {
        // Find the parent bedroom (the room that shares a wall)
        const parent = rooms.find(
          (r) =>
            ['master_bedroom', 'bedroom', 'guest_room', 'childrens_room'].includes(r.spec.type) &&
            this.sharesWall(room, r),
        );
        if (parent) {
          const sharedSide = this.getSharedWallSide(room, parent);
          if (sharedSide) {
            doorWallSide = sharedSide;
            doorIsAttachedBath = true;
          }
        }
      }
      
      if (!doorIsAttachedBath && rType !== 'entrance_lobby' && rType !== 'foyer') {
        // Room door faces the corridor
        // Corridor is a horizontal band; determine if room is above or below it
        const roomCenterY = room.y + room.height / 2;
        const corridorCenterY = corridorZone.y + corridorZone.h / 2;

        if (roomCenterY < corridorCenterY) {
          // Room is above corridor → door on south wall (facing corridor below)
          doorWallSide = 'N';
        } else {
          // Room is below corridor → door on north wall (facing corridor above)
          doorWallSide = 'S';
        }

        // If room is to the side of the corridor (not directly above/below),
        // check if east/west wall faces corridor
        const roomRight = room.x + room.width;
        const roomBottom = room.y + room.height;
        const corridorTop = corridorZone.y;
        const corridorBottom = corridorZone.y + corridorZone.h;

        // Check if room is vertically aligned with corridor at all
        const vertOverlap =
          roomBottom > corridorTop && room.y < corridorBottom;
        if (!vertOverlap) {
          // Room doesn't overlap corridor vertically; find nearest corridor-facing side
          if (room.y >= corridorBottom) doorWallSide = 'S';
          else if (roomBottom <= corridorTop) doorWallSide = 'N';
        }
      }

      // Door width per NBC
      const doorWidth =
        rType === 'entrance_lobby' || rType === 'foyer'
          ? DOOR_RULES.MAIN_ENTRY_WIDTH  // 1050mm main entry (wheelchair access)
          : rType === 'bathroom' || rType === 'toilet'
            ? DOOR_RULES.BATHROOM_DOOR_WIDTH // 750mm bath/toilet
            : rType === 'balcony' || rType === 'terrace'
              ? 1.2  // French door
              : DOOR_RULES.BEDROOM_DOOR_WIDTH; // 900mm standard

      // Door position: offset from wall start
      // NBC: minimum 100mm (one brick) from corner for structural integrity
      const wallLength = (doorWallSide === 'N' || doorWallSide === 'S') ? room.width : room.height;
      let doorPos: number = DOOR_RULES.MIN_CORNER_OFFSET; // Default: min corner offset

      // Calculate ideal door position considering:
      // 1. Corner offset rule (min 100mm from any corner)
      // 2. Door-to-door clearance (min 300mm between adjacent doors)
      // 3. Furniture zone clearance
      const maxDoorPos = wallLength - doorWidth - DOOR_RULES.MIN_CORNER_OFFSET;

      if (wallLength > doorWidth + 0.6) {
        // For bedrooms: place door closer to one corner for better furniture wall
        if (['master_bedroom', 'bedroom', 'guest_room', 'childrens_room'].includes(rType)) {
          // Door near the corridor-side corner → maximizes uninterrupted wall for bed
          doorPos = DOOR_RULES.MIN_CORNER_OFFSET + 0.2;
        } else if (rType === 'living' || rType === 'drawing_room') {
          // Center the door for symmetry in formal rooms
          doorPos = (wallLength - doorWidth) / 2;
        } else if (rType === 'kitchen') {
          // Kitchen door near service side, away from platform
          doorPos = Math.min(0.3, maxDoorPos);
        } else {
          // Default: center
          doorPos = (wallLength - doorWidth) / 2;
        }
      }

      // For attached baths, place door near the center of shared wall
      if (doorIsAttachedBath) {
        doorPos = Math.max(DOOR_RULES.MIN_CORNER_OFFSET, (wallLength - doorWidth) / 2);
      }

      // Enforce minimum corner offset
      doorPos = Math.max(DOOR_RULES.MIN_CORNER_OFFSET, Math.min(doorPos, maxDoorPos));
      doorPos = this.snapToGrid(doorPos);

      // ── Door swing clearance check ──
      // Ensure 900mm clear arc on swing side doesn't collide with other doors
      const doorAbsX = (doorWallSide === 'N' || doorWallSide === 'S')
        ? room.x + doorPos
        : (doorWallSide === 'E' ? room.x + room.width : room.x);
      const doorAbsY = (doorWallSide === 'E' || doorWallSide === 'W')
        ? room.y + doorPos
        : (doorWallSide === 'N' ? room.y + room.height : room.y);

      // Check if door swing arc collides with any previously placed door
      let swingBlocked = false;
      for (const prev of doorPositions) {
        const dx = doorAbsX - prev.x;
        const dy = doorAbsY - prev.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < DOOR_RULES.SWING_CLEARANCE) {
          swingBlocked = true;
          break;
        }
      }

      // If swing is blocked, try the other end of the wall
      if (swingBlocked && wallLength > doorWidth + DOOR_RULES.MIN_CORNER_OFFSET * 2) {
        if (doorPos < wallLength / 2) {
          doorPos = this.snapToGrid(maxDoorPos);
        } else {
          doorPos = this.snapToGrid(DOOR_RULES.MIN_CORNER_OFFSET);
        }
      }

      // Swing direction:
      //   - Bathrooms/toilets: open OUTWARD (toward corridor/bedroom) per NBC
      //   - Bedrooms: open INWARD (privacy)
      //   - Default: open into the room (inward)
      // Swing side: determined by which side has more clear space
      const isWet = rType === 'bathroom' || rType === 'toilet';
      const swing: 'left' | 'right' =
        doorPos < wallLength / 2 ? 'left' : 'right';

      const mainDoor: DoorSpec = {
        id: `door-${room.id}`,
        type: rType === 'entrance_lobby' || rType === 'foyer'
          ? 'main_entry'
          : rType === 'balcony' || rType === 'terrace'
            ? 'french'
            : 'internal',
        width: doorWidth,
        height: rType === 'entrance_lobby' ? 2.4 : 2.1,
        material:
          rType === 'entrance_lobby' ? 'wood'
            : isWet ? 'aluminum'
            : rType === 'balcony' || rType === 'terrace' ? 'aluminum'
            : 'wood',
        swing,
        roomId: room.id,
        wallSide: doorWallSide,
        position: doorPos,
      };
      room.doors.push(mainDoor);

      // Track door position for clearance checking
      doorPositions.push({ x: room.x, y: room.y, w: doorWidth });

      // ─── WINDOW PLACEMENT ───

      // Windows ONLY on external walls
      if (room.spec.requiresWindow) {
        const externalSideList = Array.from(externalSides);

        // Remove sides that have doors
        const availableSides = externalSideList.filter((s) => s !== doorWallSide);
        // If door is also on external wall, still allow other external sides
        const windowSides = availableSides.length > 0 ? availableSides : externalSideList;

        if (windowSides.length > 0) {
          // ── NBC Window-to-Floor Area Ratio ──
          // Habitable rooms: openable window area ≥ 1/8 of floor area
          // Kitchen: ≥ 1/8 of floor area
          // Bathroom: ≥ 1/20 (ventilator sufficient)
          const roomArea = room.width * room.height;
          const isHabitable = ['living', 'dining', 'master_bedroom', 'bedroom',
            'drawing_room', 'guest_room', 'childrens_room', 'study', 'home_office',
            'library'].includes(rType);
          const requiredRatio = isHabitable ? WINDOW_FLOOR_RATIO.habitable
            : rType === 'kitchen' ? WINDOW_FLOOR_RATIO.kitchen
            : rType === 'staircase' ? WINDOW_FLOOR_RATIO.staircase
            : WINDOW_FLOOR_RATIO.habitable;
          const minWindowArea = roomArea * requiredRatio;

          const primarySide = windowSides[0];
          const wallLen = (primarySide === 'N' || primarySide === 'S')
            ? room.width
            : room.height;

          // Calculate window width to meet NBC ratio, within wall constraints
          const winHeight = 1.2; // Standard window height
          let winWidth = Math.max(
            rType === 'kitchen' ? 1.2 : rType === 'living' || rType === 'master_bedroom' || rType === 'drawing_room' ? 1.5 : 1.0,
            minWindowArea / winHeight, // Ensure area ratio is met
          );
          // Cap to wall length minus clearances (0.3m from each edge)
          winWidth = Math.min(winWidth, wallLen - 0.6);
          // Snap to nearest 50mm module
          winWidth = Math.round(winWidth * 20) / 20;

          const winPos = this.snapToGrid(Math.max(0.3, (wallLen - winWidth) / 2));

          room.windows.push({
            id: `win-${room.id}-1`,
            type: rType === 'kitchen' ? 'casement' : 'casement',
            width: Math.max(0.6, winWidth),
            height: winHeight,
            sillHeight: rType === 'kitchen' ? KITCHEN_LAYOUT.SILL_HEIGHT : 0.9,
            material: 'aluminum',
            glazing: 'single',
            roomId: room.id,
            wallSide: primarySide,
            position: winPos,
            operationType: 'openable',
          });

          // Track total window area for multi-window rooms
          let totalWindowArea = Math.max(0.6, winWidth) * winHeight;

          // Cross-ventilation window on opposite wall if room is large enough
          if (roomArea > 12 && windowSides.length > 1) {
            const oppositeSide = windowSides.find((s) => {
              if (primarySide === 'N') return s === 'S';
              if (primarySide === 'S') return s === 'N';
              if (primarySide === 'E') return s === 'W';
              if (primarySide === 'W') return s === 'E';
              return false;
            }) || windowSides[1];

            const oWallLen = (oppositeSide === 'N' || oppositeSide === 'S')
              ? room.width
              : room.height;

            // Secondary window can be smaller
            const secWinWidth = Math.min(1.0, oWallLen - 0.6);

            room.windows.push({
              id: `win-${room.id}-2`,
              type: 'casement',
              width: Math.max(0.6, secWinWidth),
              height: 1.2,
              sillHeight: 0.9,
              material: 'aluminum',
              glazing: 'single',
              roomId: room.id,
              wallSide: oppositeSide,
              position: this.snapToGrid(Math.max(0.3, (oWallLen - secWinWidth) / 2)),
              operationType: 'openable',
            });

            totalWindowArea += Math.max(0.6, secWinWidth) * 1.2;
          }

          // If total window area still doesn't meet NBC ratio, add additional window
          if (totalWindowArea < minWindowArea && windowSides.length > 1) {
            const extraSide = windowSides.find((s) =>
              s !== primarySide && !room.windows.some((w) => w.wallSide === s));
            if (extraSide) {
              const eWallLen = (extraSide === 'N' || extraSide === 'S')
                ? room.width : room.height;
              const extraWidth = Math.min(
                (minWindowArea - totalWindowArea) / 1.2,
                eWallLen - 0.6,
              );
              if (extraWidth >= 0.6) {
                room.windows.push({
                  id: `win-${room.id}-3`,
                  type: 'casement',
                  width: Math.round(extraWidth * 20) / 20,
                  height: 1.2,
                  sillHeight: 0.9,
                  material: 'aluminum',
                  glazing: 'single',
                  roomId: room.id,
                  wallSide: extraSide,
                  position: this.snapToGrid(Math.max(0.3, (eWallLen - extraWidth) / 2)),
                  operationType: 'openable',
                });
              }
            }
          }
        }
      }

      // Ventilator for wet rooms — always on an external wall, high-level
      if (isWet) {
        const ventSide = Array.from(externalSides).find((s) => s !== doorWallSide);
        if (ventSide) {
          const vWallLen = (ventSide === 'N' || ventSide === 'S') ? room.width : room.height;
          room.windows.push({
            id: `vent-${room.id}`,
            type: 'louvered',
            width: 0.6,
            height: 0.6,
            sillHeight: 2.0, // High-level ventilator
            material: 'aluminum',
            glazing: 'single',
            roomId: room.id,
            wallSide: ventSide,
            position: this.snapToGrid(Math.max(0.15, vWallLen - 0.8)),
            operationType: 'openable',
          });
        }
      }
    }
  }

  // ────────────────────────────────────────────────────────────────────────
  // INTELLIGENT WALL GENERATION — Shared walls, no duplicates
  // ────────────────────────────────────────────────────────────────────────

  private generateWalls(
    rooms: PlacedRoom[],
    buildableWidth: number,
    buildableDepth: number,
    setbacks: { front: number; rear: number; left: number; right: number },
  ): WallSegment[] {
    const walls: WallSegment[] = [];
    let wallId = 1;
    const EXT_T = 0.23;
    const INT_T = 0.115;

    // External boundary walls
    const ox = setbacks.left;
    const oy = setbacks.front;
    walls.push(
      { id: `W${wallId++}`, startX: ox, startY: oy, endX: ox + buildableWidth, endY: oy, thickness: EXT_T, type: 'external', material: 'brick' },
      { id: `W${wallId++}`, startX: ox + buildableWidth, startY: oy, endX: ox + buildableWidth, endY: oy + buildableDepth, thickness: EXT_T, type: 'external', material: 'brick' },
      { id: `W${wallId++}`, startX: ox + buildableWidth, startY: oy + buildableDepth, endX: ox, endY: oy + buildableDepth, thickness: EXT_T, type: 'external', material: 'brick' },
      { id: `W${wallId++}`, startX: ox, startY: oy + buildableDepth, endX: ox, endY: oy, thickness: EXT_T, type: 'external', material: 'brick' },
    );

    // Internal walls between rooms: only generate UNIQUE wall segments.
    // Two rooms sharing a wall should produce ONE wall, not two overlapping ones.
    const bounds = { x: ox, y: oy, w: buildableWidth, h: buildableDepth };
    const EPS = 0.15;

    // Collect all wall segments, keyed to avoid duplicates
    const wallSet = new Map<string, WallSegment>();

    const addWall = (
      sx: number, sy: number, ex: number, ey: number,
      type: 'internal' | 'external',
    ) => {
      // Normalize: always left→right or top→bottom
      const [nsx, nsy, nex, ney] =
        sx < ex || (sx === ex && sy < ey)
          ? [sx, sy, ex, ey]
          : [ex, ey, sx, sy];

      const key = `${nsx.toFixed(2)}_${nsy.toFixed(2)}_${nex.toFixed(2)}_${ney.toFixed(2)}`;
      if (!wallSet.has(key)) {
        // Check if this segment lies on the building boundary → external
        const onBoundary =
          (Math.abs(nsy - oy) < EPS && Math.abs(ney - oy) < EPS) ||
          (Math.abs(nsy - (oy + buildableDepth)) < EPS && Math.abs(ney - (oy + buildableDepth)) < EPS) ||
          (Math.abs(nsx - ox) < EPS && Math.abs(nex - ox) < EPS) ||
          (Math.abs(nsx - (ox + buildableWidth)) < EPS && Math.abs(nex - (ox + buildableWidth)) < EPS);

        wallSet.set(key, {
          id: `W${wallId++}`,
          startX: nsx, startY: nsy, endX: nex, endY: ney,
          thickness: onBoundary ? EXT_T : INT_T,
          type: onBoundary ? 'external' : 'internal',
          material: 'brick',
        });
      }
    };

    for (const room of rooms) {
      const rx = room.x, ry = room.y;
      const rr = rx + room.width, rb = ry + room.height;
      addWall(rx, ry, rr, ry, 'internal');    // south
      addWall(rr, ry, rr, rb, 'internal');    // east
      addWall(rr, rb, rx, rb, 'internal');    // north
      addWall(rx, rb, rx, ry, 'internal');    // west
    }

    walls.push(...wallSet.values());
    return walls;
  }

  // ────────────────────────────────────────────────────────────────────────
  // CORRIDOR — Real accessible passage connecting all rooms
  // ────────────────────────────────────────────────────────────────────────

  private generateCorridors(rooms: PlacedRoom[], buildableWidth: number, buildableDepth: number) {
    const corridorZone = (this as any)._corridorZone as
      | { x: number; y: number; w: number; h: number }
      | undefined;
    if (corridorZone) {
      return [
        {
          x: corridorZone.x,
          y: corridorZone.y,
          width: corridorZone.w,
          height: corridorZone.h,
        },
      ];
    }
    // Fallback
    return [
      {
        x: 0,
        y: buildableDepth * 0.4,
        width: buildableWidth,
        height: 1.2,
      },
    ];
  }

  private generateStaircases(
    rooms: PlacedRoom[],
    buildableWidth: number,
    buildableDepth: number,
    setbacks: { front: number; rear: number; left: number; right: number },
  ): StaircaseSpec[] {
    const staircaseRoom = rooms.find((r) => r.spec.type === 'staircase');
    if (!staircaseRoom) return [];

    // ── NBC STAIRCASE DESIGN CALCULATION ──
    // NBC Part 4: Residential staircase requirements
    // - Min width: 900mm (individual house), 1000mm (apartment)
    // - Max riser: 190mm for residential (150mm for public buildings)
    // - Min tread: 250mm excluding nosing
    // - R + T formula: 2R + T should be 600-650mm (comfort formula)
    // - Headroom: min 2100mm (2200mm preferred)
    // - Landing at every 12 risers max

    const floorHeight = staircaseRoom.ceilingHeight || 3.0; // Total floor-to-floor height
    const slabThickness = 0.15; // 150mm RCC slab
    const totalRise = floorHeight + slabThickness; // Floor-to-floor including slab

    // Calculate optimal riser height (target 150mm, max 190mm per NBC)
    const idealRiser = 0.15; // 150mm ideal residential riser
    let numRisers = Math.round(totalRise / idealRiser);
    let riserHeight = totalRise / numRisers;

    // Ensure riser is within NBC limits
    if (riserHeight > 0.19) {
      numRisers = Math.ceil(totalRise / 0.19);
      riserHeight = totalRise / numRisers;
    }
    if (riserHeight < 0.13) {
      numRisers = Math.floor(totalRise / 0.13);
      riserHeight = totalRise / numRisers;
    }

    // Tread depth from comfort formula: 2R + T = 620mm (Blondel's rule)
    const treadDepth = Math.max(0.25, 0.62 - 2 * riserHeight);
    // Round to nearest 10mm
    const treadRounded = Math.round(treadDepth * 100) / 100;

    // Staircase width: use room width, min 1.2m
    const stairWidth = Math.max(1.2, Math.min(staircaseRoom.width, 1.5));

    // Dog-leg (half-turn) staircase: two flights with mid-landing
    // Each flight has numRisers/2 risers
    const halfRisers = Math.ceil(numRisers / 2);
    const flightLength = halfRisers * treadRounded;
    const landingWidth = stairWidth; // Landing = width of stair for 180° turn

    return [
      {
        id: 'staircase-1',
        type: 'dog_leg',
        width: Math.round(stairWidth * 100) / 100,
        riserHeight: Math.round(riserHeight * 1000) / 1000,
        treadDepth: treadRounded,
        numRisers,
        landingWidth: Math.round(landingWidth * 100) / 100,
        handrailHeight: 0.9, // 900mm handrail per NBC
        x: staircaseRoom.x,
        y: staircaseRoom.y,
        rotation: 0,
      },
    ];
  }

  private generateElectricalFixturesForRoom(
    room: PlacedRoom,
    startId: number,
  ): ElectricalFixture[] {
    const fixtures: ElectricalFixture[] = [];
    const type = room.spec.type;
    let id = startId;

    // ── Determine door wall and furniture-aware zones ──
    const doorWall = room.doors.length > 0 ? room.doors[0].wallSide : 'S';
    const doorPos = room.doors.length > 0 ? (room.doors[0].position || 0) : 0;
    const doorWidth = room.doors.length > 0 ? room.doors[0].width : 0.9;

    // Light points — center of room (ceiling-mounted)
    fixtures.push({
      id: `EF-${id++}`,
      type: 'light_point',
      x: room.x + room.width / 2,
      y: room.y + room.height / 2,
      roomId: room.id,
      circuit: 'CKT-LIGHT',
      wattage: type === 'living' || type === 'master_bedroom' ? 100 : 60,
      height: room.ceilingHeight,
    });

    // Switch near door — on latch side, 1.2m height (IS 732)
    // Switch ALWAYS on the wall where door is, 0.15m from door frame on open side
    let switchX: number, switchY: number;
    if (doorWall === 'S') {
      switchX = room.x + doorPos + doorWidth + 0.15;
      switchY = room.y + 0.05;
    } else if (doorWall === 'N') {
      switchX = room.x + doorPos + doorWidth + 0.15;
      switchY = room.y + room.height - 0.05;
    } else if (doorWall === 'E') {
      switchX = room.x + room.width - 0.05;
      switchY = room.y + doorPos + doorWidth + 0.15;
    } else {
      switchX = room.x + 0.05;
      switchY = room.y + doorPos + doorWidth + 0.15;
    }
    // Clamp to room bounds
    switchX = Math.max(room.x + 0.05, Math.min(switchX, room.x + room.width - 0.05));
    switchY = Math.max(room.y + 0.05, Math.min(switchY, room.y + room.height - 0.05));

    fixtures.push({
      id: `EF-${id++}`,
      type: 'switch',
      x: Math.round(switchX * 100) / 100,
      y: Math.round(switchY * 100) / 100,
      roomId: room.id,
      circuit: 'CKT-LIGHT',
      wattage: 0,
      height: 1.2, // IS 732: 1.2m from FFL
    });

    // ── FURNITURE-AWARE SOCKET PLACEMENT ──
    // Bedrooms: sockets on bedside wall (both sides of bed) at 0.3m height
    // Living: sockets distributed on 3 walls at 0.3m height
    // Kitchen: sockets at 1.1m (counter height) for appliances
    // Study: sockets behind desk position at 0.3m height
    const socketHeight = type === 'kitchen' ? 1.1 : 0.3;
    const socketCount =
      type === 'living' || type === 'drawing_room' ? 4
      : type === 'kitchen' ? 5
      : type === 'master_bedroom' ? 4
      : type === 'bedroom' || type === 'guest_room' ? 3
      : type === 'study' || type === 'home_office' ? 4
      : 1;

    // Distribute sockets along walls, avoiding door wall for first socket
    const walls = ['N', 'S', 'E', 'W'].filter((w) => w !== doorWall) as ('N' | 'S' | 'E' | 'W')[];
    
    for (let i = 0; i < socketCount; i++) {
      const wall = walls[i % walls.length];
      const wallLen = (wall === 'N' || wall === 'S') ? room.width : room.height;
      const pos = ((i + 1) / (Math.ceil(socketCount / walls.length) + 1)) * wallLen;

      let sx: number, sy: number;
      if (wall === 'S') { sx = room.x + pos; sy = room.y + 0.05; }
      else if (wall === 'N') { sx = room.x + pos; sy = room.y + room.height - 0.05; }
      else if (wall === 'E') { sx = room.x + room.width - 0.05; sy = room.y + pos; }
      else { sx = room.x + 0.05; sy = room.y + pos; }

      fixtures.push({
        id: `EF-${id++}`,
        type: 'socket',
        x: Math.round(sx * 100) / 100,
        y: Math.round(sy * 100) / 100,
        roomId: room.id,
        circuit: type === 'kitchen' ? 'CKT-KITCHEN' : 'CKT-POWER',
        wattage: 200,
        height: socketHeight,
      });
    }

    // Fan point for habitable rooms (ceiling center, offset from light)
    if (
      [
        'living', 'dining', 'master_bedroom', 'bedroom', 'study',
        'drawing_room', 'guest_room', 'childrens_room',
      ].includes(type)
    ) {
      fixtures.push({
        id: `EF-${id++}`,
        type: 'fan_point',
        x: room.x + room.width / 2,
        y: room.y + room.height / 2,
        roomId: room.id,
        circuit: 'CKT-LIGHT',
        wattage: 75,
        height: room.ceilingHeight,
      });
    }

    // AC point — on wall OPPOSITE to bed (for bedrooms) or longest wall
    if (
      ['living', 'master_bedroom', 'bedroom', 'study', 'home_office', 'guest_room'].includes(type)
    ) {
      // AC: on wall opposite to windows preferably, at 2.4m height
      const acWall: 'N' | 'S' | 'E' | 'W' = doorWall === 'N' ? 'S' : doorWall === 'S' ? 'N' : doorWall === 'E' ? 'W' : 'E';
      let acX: number, acY: number;
      if (acWall === 'N') { acX = room.x + room.width / 2; acY = room.y + room.height - 0.15; }
      else if (acWall === 'S') { acX = room.x + room.width / 2; acY = room.y + 0.15; }
      else if (acWall === 'E') { acX = room.x + room.width - 0.15; acY = room.y + room.height / 2; }
      else { acX = room.x + 0.15; acY = room.y + room.height / 2; }

      fixtures.push({
        id: `EF-${id++}`,
        type: 'ac_point',
        x: Math.round(acX * 100) / 100,
        y: Math.round(acY * 100) / 100,
        roomId: room.id,
        circuit: 'CKT-AC',
        wattage: 1500,
        height: 2.4,
      });
    }

    // Kitchen specifics: exhaust fan + geyser point
    if (type === 'kitchen') {
      fixtures.push({
        id: `EF-${id++}`,
        type: 'exhaust_fan',
        x: room.x + room.width - 0.3,
        y: room.y + 0.3,
        roomId: room.id,
        circuit: 'CKT-KITCHEN',
        wattage: 40,
        height: 2.4,
      });
      fixtures.push({
        id: `EF-${id++}`,
        type: 'geyser_point',
        x: room.x + 0.5,
        y: room.y + room.height - 0.3,
        roomId: room.id,
        circuit: 'CKT-KITCHEN',
        wattage: 2000,
        height: 1.8,
      });
    }

    // Bathroom specifics
    if (type === 'bathroom') {
      fixtures.push({
        id: `EF-${id++}`,
        type: 'geyser_point',
        x: room.x + 0.3,
        y: room.y + 0.3,
        roomId: room.id,
        circuit: 'CKT-POWER',
        wattage: 2000,
        height: 1.8,
      });
      fixtures.push({
        id: `EF-${id++}`,
        type: 'exhaust_fan',
        x: room.x + room.width - 0.3,
        y: room.y + room.height - 0.3,
        roomId: room.id,
        circuit: 'CKT-LIGHT',
        wattage: 25,
        height: 2.4,
      });
    }

    return fixtures;
  }

  private generatePlumbingFixturesForRoom(room: PlacedRoom, startId: number): PlumbingFixture[] {
    const fixtures: PlumbingFixture[] = [];
    const type = room.spec.type;
    let id = startId;

    // ── Helper: determine door wall ──
    const doorWall = room.doors.length > 0 ? room.doors[0].wallSide : 'S';
    // The wall opposite the door is where WC goes (farthest from entry for privacy)
    const oppositeWall = doorWall === 'N' ? 'S' : doorWall === 'S' ? 'N'
      : doorWall === 'E' ? 'W' : 'E';
    // Adjacent wet wall — plumbing fixtures cluster on one side for pipe economy
    const wetWall = doorWall === 'N' || doorWall === 'S' ? 'W' : 'S';

    if (type === 'bathroom') {
      // ── IS 2064 COMPLIANT BATHROOM LAYOUT ──
      // Layout: WC on wall opposite door, basin near door, shower diagonal from WC
      // All fixtures cluster on 1-2 walls for plumbing stack efficiency

      const rW = room.width;
      const rH = room.height;

      // WC placement: OPPOSITE wall from door, with clearances
      let wcX: number, wcY: number;
      if (oppositeWall === 'N') {
        wcX = room.x + BATHROOM_ZONES.WC_CLEARANCE_SIDE + BATHROOM_ZONES.WC_WIDTH / 2;
        wcY = room.y + rH - BATHROOM_ZONES.WC_DEPTH;
      } else if (oppositeWall === 'S') {
        wcX = room.x + BATHROOM_ZONES.WC_CLEARANCE_SIDE + BATHROOM_ZONES.WC_WIDTH / 2;
        wcY = room.y + BATHROOM_ZONES.WC_DEPTH;
      } else if (oppositeWall === 'E') {
        wcX = room.x + rW - BATHROOM_ZONES.WC_DEPTH;
        wcY = room.y + rH - BATHROOM_ZONES.WC_CLEARANCE_SIDE - BATHROOM_ZONES.WC_WIDTH / 2;
      } else {
        wcX = room.x + BATHROOM_ZONES.WC_DEPTH;
        wcY = room.y + rH - BATHROOM_ZONES.WC_CLEARANCE_SIDE - BATHROOM_ZONES.WC_WIDTH / 2;
      }

      fixtures.push({
        id: `PF-${id++}`,
        type: 'wc',
        x: Math.round(wcX * 100) / 100,
        y: Math.round(wcY * 100) / 100,
        roomId: room.id,
        waterSupply: true,
        drainage: true,
        hotWater: false,
        pipeSize: 100, // 100mm soil pipe per NBC
      });

      // Basin placement: NEAR door side, on wet wall
      let basinX: number, basinY: number;
      if (doorWall === 'N') {
        basinX = room.x + rW - BATHROOM_ZONES.BASIN_WIDTH - 0.1;
        basinY = room.y + rH - BATHROOM_ZONES.BASIN_DEPTH;
      } else if (doorWall === 'S') {
        basinX = room.x + rW - BATHROOM_ZONES.BASIN_WIDTH - 0.1;
        basinY = room.y + BATHROOM_ZONES.BASIN_DEPTH;
      } else if (doorWall === 'E') {
        basinX = room.x + rW - BATHROOM_ZONES.BASIN_DEPTH;
        basinY = room.y + 0.1;
      } else {
        basinX = room.x + BATHROOM_ZONES.BASIN_DEPTH;
        basinY = room.y + 0.1;
      }

      fixtures.push({
        id: `PF-${id++}`,
        type: 'wash_basin',
        x: Math.round(basinX * 100) / 100,
        y: Math.round(basinY * 100) / 100,
        roomId: room.id,
        waterSupply: true,
        drainage: true,
        hotWater: true,
        pipeSize: 15, // 15mm copper/CPVC
      });

      // Shower placement: corner diagonal from WC, minimum 900×900mm zone
      const showerSize = Math.min(
        BATHROOM_ZONES.SHOWER_PREFERRED,
        Math.max(BATHROOM_ZONES.SHOWER_MIN_SIZE, Math.min(rW, rH) * 0.4)
      );
      let showerX: number, showerY: number;
      // Place shower in the corner farthest from both door and WC
      if (oppositeWall === 'N') {
        showerX = room.x + rW - showerSize / 2 - 0.1;
        showerY = room.y + showerSize / 2 + 0.1;
      } else if (oppositeWall === 'S') {
        showerX = room.x + rW - showerSize / 2 - 0.1;
        showerY = room.y + rH - showerSize / 2 - 0.1;
      } else {
        showerX = room.x + rW - showerSize / 2 - 0.1;
        showerY = room.y + rH - showerSize / 2 - 0.1;
      }

      fixtures.push({
        id: `PF-${id++}`,
        type: 'shower',
        x: Math.round(showerX * 100) / 100,
        y: Math.round(showerY * 100) / 100,
        roomId: room.id,
        waterSupply: true,
        drainage: true,
        hotWater: true,
        pipeSize: 20, // 20mm for shower mixer
      });

      // Floor trap: center of room, slope 1:100 toward it
      fixtures.push({
        id: `PF-${id++}`,
        type: 'floor_trap',
        x: Math.round((room.x + rW / 2) * 100) / 100,
        y: Math.round((room.y + rH / 2) * 100) / 100,
        roomId: room.id,
        waterSupply: false,
        drainage: true,
        hotWater: false,
        pipeSize: 80, // 80mm nahni trap
      });
    }

    if (type === 'toilet') {
      // ── TOILET (WC only + optional basin) ──
      // WC on wall opposite door with 600mm front clearance
      const rW = room.width;
      const rH = room.height;

      let wcX: number, wcY: number;
      if (oppositeWall === 'N') {
        wcX = room.x + rW / 2;
        wcY = room.y + rH - BATHROOM_ZONES.WC_DEPTH;
      } else if (oppositeWall === 'S') {
        wcX = room.x + rW / 2;
        wcY = room.y + BATHROOM_ZONES.WC_DEPTH;
      } else {
        wcX = room.x + rW / 2;
        wcY = room.y + rH / 2;
      }

      fixtures.push({
        id: `PF-${id++}`,
        type: 'wc',
        x: Math.round(wcX * 100) / 100,
        y: Math.round(wcY * 100) / 100,
        roomId: room.id,
        waterSupply: true,
        drainage: true,
        hotWater: false,
        pipeSize: 100,
      });

      // Small wash basin near door if room is wide enough
      if (rW >= 1.2) {
        let basinX: number, basinY: number;
        if (doorWall === 'S') {
          basinX = room.x + rW - 0.4;
          basinY = room.y + 0.3;
        } else {
          basinX = room.x + rW - 0.4;
          basinY = room.y + rH - 0.3;
        }
        fixtures.push({
          id: `PF-${id++}`,
          type: 'wash_basin',
          x: Math.round(basinX * 100) / 100,
          y: Math.round(basinY * 100) / 100,
          roomId: room.id,
          waterSupply: true,
          drainage: true,
          hotWater: false,
          pipeSize: 15,
        });
      }

      // Floor trap
      fixtures.push({
        id: `PF-${id++}`,
        type: 'floor_trap',
        x: Math.round((room.x + rW * 0.3) * 100) / 100,
        y: Math.round((room.y + rH * 0.5) * 100) / 100,
        roomId: room.id,
        waterSupply: false,
        drainage: true,
        hotWater: false,
        pipeSize: 80,
      });
    }

    if (type === 'kitchen') {
      // ── KITCHEN WORKING TRIANGLE LAYOUT ──
      // Per ergonomic standards: sink-stove-fridge triangle
      // Platform depth: 600mm (standard modular)
      // Sink: centered under window, stove: 600mm from sink, fridge: near entry
      const rW = room.width;
      const rH = room.height;
      const platformDepth = KITCHEN_LAYOUT.PLATFORM_DEPTH;

      // Determine platform wall (wall with window, or opposite door)
      const windowWall = room.windows.length > 0 ? room.windows[0].wallSide : oppositeWall;

      // Kitchen sink: on platform wall, centered under window
      let sinkX: number, sinkY: number;
      if (windowWall === 'N') {
        sinkX = room.x + rW / 2;
        sinkY = room.y + rH - platformDepth / 2;
      } else if (windowWall === 'S') {
        sinkX = room.x + rW / 2;
        sinkY = room.y + platformDepth / 2;
      } else if (windowWall === 'E') {
        sinkX = room.x + rW - platformDepth / 2;
        sinkY = room.y + rH / 2;
      } else {
        sinkX = room.x + platformDepth / 2;
        sinkY = room.y + rH / 2;
      }

      fixtures.push({
        id: `PF-${id++}`,
        type: 'kitchen_sink',
        x: Math.round(sinkX * 100) / 100,
        y: Math.round(sinkY * 100) / 100,
        roomId: room.id,
        waterSupply: true,
        drainage: true,
        hotWater: true,
        pipeSize: 20,
      });

      // Floor trap: under sink for drainage
      fixtures.push({
        id: `PF-${id++}`,
        type: 'floor_trap',
        x: Math.round(sinkX * 100) / 100,
        y: Math.round((sinkY + 0.15) * 100) / 100,
        roomId: room.id,
        waterSupply: false,
        drainage: true,
        hotWater: false,
        pipeSize: 80,
      });
    }

    if (type === 'laundry' || type === 'utility') {
      fixtures.push(
        {
          id: `PF-${id++}`,
          type: 'utility_sink',
          x: room.x + 0.5,
          y: room.y + 0.4,
          roomId: room.id,
          waterSupply: true,
          drainage: true,
          hotWater: true,
          pipeSize: 20,
        },
        {
          id: `PF-${id++}`,
          type: 'washing_machine',
          x: room.x + room.width - 0.5,
          y: room.y + 0.5,
          roomId: room.id,
          waterSupply: true,
          drainage: true,
          hotWater: true,
          pipeSize: 20,
        },
        {
          id: `PF-${id++}`,
          type: 'floor_trap',
          x: room.x + room.width / 2,
          y: room.y + room.height / 2,
          roomId: room.id,
          waterSupply: false,
          drainage: true,
          hotWater: false,
          pipeSize: 80,
        },
      );
    }

    return fixtures;
  }

  private rectsOverlap(
    a: { x: number; y: number; w: number; h: number },
    b: { x: number; y: number; w: number; h: number },
  ): boolean {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }

  private areRoomsAdjacent(a: PlacedRoom, b: PlacedRoom): boolean {
    const gap = 0.5;
    return !(
      a.x + a.width + gap < b.x ||
      b.x + b.width + gap < a.x ||
      a.y + a.height + gap < b.y ||
      b.y + b.height + gap < a.y
    );
  }

  // ────────────────────────────────────────────────────────────────────────
  // FURNITURE CLEARANCE ZONES — Architectural minimum clearances
  // ────────────────────────────────────────────────────────────────────────
  //
  // Ensures rooms are large enough for their intended furniture:
  // - Bedroom: bed (2m×1.5m) + 0.6m clearance on 3 sides + wardrobe (0.6m deep)
  // - Living: sofa (0.9m deep) + 0.9m passage behind + TV wall 3m min
  // - Dining: table (1.2m×0.8m) + 0.75m chair pullback on each side
  // - Kitchen: 0.6m platform + 0.9m working space for L/U configurations
  // - Study: desk (1.2m×0.6m) + 0.75m chair + 0.6m movement
  //
  // Returns { valid: boolean, warnings: string[] }
  // ────────────────────────────────────────────────────────────────────────
  
  private validateFurnitureClearance(room: PlacedRoom): { valid: boolean; warnings: string[] } {
    const rType = room.spec.type;
    const rW = room.width;
    const rH = room.height;
    const warnings: string[] = [];
    let valid = true;

    // Bedroom furniture clearance
    if (['master_bedroom', 'bedroom', 'guest_room', 'childrens_room'].includes(rType)) {
      const bedW = rType === 'master_bedroom' ? 1.8 : 1.5; // King vs Queen
      const bedH = 2.0;
      const wardrobeDepth = 0.6;
      const clearance = 0.6; // Minimum passage around bed

      // Check: bed + clearance on 3 sides + wardrobe depth fits
      const minWidthNeeded = bedW + clearance * 2; // bed + clearance both sides
      const minHeightNeeded = bedH + clearance + wardrobeDepth; // bed + foot clearance + wardrobe

      if (rW < minWidthNeeded) {
        warnings.push(`${rType}: ${rW}m width too narrow for bed (${bedW}m) + clearance. Need ${minWidthNeeded}m`);
        valid = false;
      }
      if (rH < minHeightNeeded) {
        warnings.push(`${rType}: ${rH}m depth insufficient for bed + wardrobe. Need ${minHeightNeeded}m`);
        valid = false;
      }

      // Door clearance: door swing shouldn't hit bed
      const doorSide = room.doors.length > 0 ? room.doors[0].wallSide : null;
      if (doorSide === 'N' || doorSide === 'S') {
        // Door on N/S wall — bed should be away from door
        const doorPos = room.doors.length > 0 ? room.doors[0].position || 0 : 0;
        const doorWidth = room.doors.length > 0 ? room.doors[0].width : 0.9;
        // Furniture zone: bed starts at least doorWidth + 0.3m from door position
        if (doorPos + doorWidth + 0.3 > rW - clearance) {
          warnings.push(`${rType}: door swing may conflict with bed placement`);
        }
      }
    }

    // Living room furniture clearance
    if (rType === 'living' || rType === 'drawing_room') {
      const sofaDepth = 0.9;
      const coffeeTableDepth = 0.6;
      const passageBehind = 0.9; // Passage behind sofa
      const tvDistance = 2.5; // Min viewing distance to TV

      const minWidth = sofaDepth + coffeeTableDepth + tvDistance;
      if (Math.min(rW, rH) < 3.0) {
        warnings.push(`${rType}: min 3.0m clear dimension needed for sofa + TV arrangement`);
        valid = false;
      }
      if (rW * rH < 14) {
        warnings.push(`${rType}: ${(rW * rH).toFixed(1)}m² may be insufficient for living furniture`);
      }
    }

    // Dining room furniture clearance
    if (rType === 'dining') {
      // 4-seater: 1.2m × 0.8m table + 0.75m chair pullback each side
      const tableW = 1.2;
      const tableH = 0.8;
      const chairPullback = 0.75;
      const minDimNeeded = tableH + chairPullback * 2; // 2.3m for 4-seater

      if (Math.min(rW, rH) < minDimNeeded) {
        warnings.push(`Dining: ${Math.min(rW, rH).toFixed(1)}m too narrow for dining table + chairs. Need ${minDimNeeded}m`);
        valid = false;
      }
    }

    // Kitchen clearance
    if (rType === 'kitchen') {
      const platformDepth = KITCHEN_LAYOUT.PLATFORM_DEPTH;
      const workingSpace = 0.9; // Min working space in front of platform
      const minWidth = platformDepth + workingSpace; // 1.5m for single platform

      if (Math.min(rW, rH) < minWidth) {
        warnings.push(`Kitchen: ${Math.min(rW, rH).toFixed(1)}m too narrow for platform + working space. Need ${minWidth}m`);
        valid = false;
      }

      // L-shaped kitchen needs 2.1m on both sides if area > 8m²
      if (rW * rH > 8) {
        const longSide = Math.max(rW, rH);
        const shortSide = Math.min(rW, rH);
        if (shortSide < 2.1) {
          warnings.push(`Kitchen: L-shaped layout needs min 2.1m width (have ${shortSide.toFixed(1)}m)`);
        }
      }
    }

    // Study/home office clearance
    if (rType === 'study' || rType === 'home_office') {
      const deskDepth = 0.6;
      const chairSpace = 0.75;
      const bookshelfDepth = 0.3;
      const minDepth = deskDepth + chairSpace + bookshelfDepth; // 1.65m

      if (Math.min(rW, rH) < minDepth) {
        warnings.push(`${rType}: ${Math.min(rW, rH).toFixed(1)}m too narrow for desk + chair + shelf`);
        valid = false;
      }
    }

    return { valid, warnings };
  }

  private getAdjacencyRules(type: RoomType): RoomType[] {
    // Comprehensive architect-grade adjacency preferences
    const rules: Partial<Record<RoomType, RoomType[]>> = {
      living:          ['dining', 'entrance_lobby', 'foyer', 'drawing_room', 'balcony', 'verandah'],
      dining:          ['kitchen', 'living', 'pantry', 'sit_out'],
      kitchen:         ['dining', 'utility', 'pantry', 'store', 'laundry'],
      master_bedroom:  ['walk_in_closet', 'dressing', 'bathroom', 'balcony'],
      bedroom:         ['bathroom', 'balcony', 'study'],
      guest_room:      ['bathroom', 'living'],
      childrens_room:  ['bathroom', 'study'],
      study:           ['library', 'bedroom', 'home_office'],
      home_office:     ['study', 'library'],
      library:         ['study', 'home_office'],
      entrance_lobby:  ['living', 'staircase', 'foyer', 'drawing_room'],
      foyer:           ['living', 'entrance_lobby', 'staircase'],
      drawing_room:    ['living', 'entrance_lobby', 'foyer'],
      pooja:           ['living', 'entrance_lobby', 'foyer'],
      staircase:       ['entrance_lobby', 'foyer', 'corridor', 'lift'],
      lift:            ['staircase', 'corridor', 'foyer'],
      utility:         ['kitchen', 'laundry', 'store'],
      laundry:         ['utility', 'kitchen', 'bathroom'],
      store:           ['kitchen', 'utility', 'pantry'],
      pantry:          ['kitchen', 'dining', 'store'],
      walk_in_closet:  ['master_bedroom', 'dressing'],
      dressing:        ['master_bedroom', 'walk_in_closet', 'bathroom'],
      servants_quarter:['kitchen', 'utility', 'garage'],
      parking:         ['entrance_lobby', 'garage', 'staircase'],
      garage:          ['parking', 'entrance_lobby'],
      balcony:         ['living', 'bedroom', 'master_bedroom'],
      terrace:         ['staircase', 'living'],
      gym:             ['bathroom', 'balcony'],
      home_theater:    ['living'],
      swimming_pool:   ['garden', 'gym'],
      garden:          ['sit_out', 'verandah', 'swimming_pool'],
      sit_out:         ['garden', 'dining', 'verandah'],
      verandah:        ['living', 'garden', 'sit_out'],
    };
    return rules[type] || [];
  }

  private getAvoidanceRules(type: RoomType): RoomType[] {
    // Rooms that should NOT be adjacent — noise, hygiene, vastu, privacy
    const rules: Partial<Record<RoomType, RoomType[]>> = {
      kitchen:         ['toilet', 'bathroom', 'pooja', 'bedroom', 'master_bedroom'],
      pooja:           ['toilet', 'bathroom', 'kitchen', 'laundry'],
      master_bedroom:  ['kitchen', 'garage', 'parking', 'mechanical_room'],
      bedroom:         ['kitchen', 'garage', 'parking', 'mechanical_room'],
      childrens_room:  ['kitchen', 'garage', 'parking', 'mechanical_room'],
      guest_room:      ['kitchen', 'garage', 'servants_quarter'],
      dining:          ['toilet', 'bathroom', 'garage', 'parking'],
      living:          ['toilet', 'garage', 'parking', 'mechanical_room'],
      drawing_room:    ['toilet', 'kitchen', 'garage'],
      study:           ['kitchen', 'home_theater', 'gym'],
      home_theater:    ['study', 'bedroom', 'pooja'],
      swimming_pool:   ['electrical_panel', 'pooja'],
    };
    return rules[type] || [];
  }

  private getFloorFinish(type: RoomType, preferences: UserPreferences): string {
    if (preferences.budget === 'luxury') {
      switch (type) {
        case 'living':
        case 'dining':
        case 'master_bedroom':
          return 'Italian Marble';
        case 'kitchen':
          return 'Granite';
        case 'bathroom':
        case 'toilet':
          return 'Anti-skid Ceramic';
        case 'pooja':
          return 'White Marble';
        default:
          return 'Vitrified Tiles (600×600)';
      }
    }
    switch (type) {
      case 'living':
      case 'dining':
        return 'Vitrified Tiles (600×600)';
      case 'kitchen':
        return 'Ceramic Tiles (anti-skid)';
      case 'bathroom':
      case 'toilet':
        return 'Anti-skid Ceramic Tiles';
      case 'parking':
      case 'garage':
        return 'VDF Concrete Flooring';
      default:
        return 'Ceramic Tiles (600×600)';
    }
  }

  private getWallFinish(type: RoomType, preferences: UserPreferences): string {
    switch (type) {
      case 'bathroom':
      case 'toilet':
        return 'Ceramic Wall Tiles (up to 7ft)';
      case 'kitchen':
        return 'Ceramic Dado Tiles (2ft above platform)';
      case 'pooja':
        return 'Marble Cladding';
      default:
        return preferences.budget === 'luxury' ? 'Textured Paint' : 'Acrylic Emulsion Paint';
    }
  }

  private generateShadowPatterns(latitude: number) {
    const patterns = [];
    for (let month = 1; month <= 12; month += 3) {
      for (let hour = 8; hour <= 17; hour += 3) {
        const sunAltitude = 45 + (month <= 6 ? month * 3 : (12 - month) * 3) - (hour - 12) * 2;
        const shadowLength = 1 / Math.tan((sunAltitude * Math.PI) / 180);
        patterns.push({
          hour,
          month,
          shadowPolygon: [
            { x: 0, y: 0 },
            { x: shadowLength, y: 0 },
            { x: shadowLength, y: shadowLength * 0.3 },
            { x: 0, y: shadowLength * 0.3 },
          ],
        });
      }
    }
    return patterns;
  }

  private generateSunlightRecommendations(
    roomSunlight: SunlightAnalysis['roomSunlight'],
  ): string[] {
    const recs: string[] = [];
    recs.push('East-facing windows provide morning sunlight — ideal for bedrooms and kitchen.');
    recs.push('South-facing windows (in Northern Hemisphere) get maximum winter sun.');
    recs.push('West-facing openings should have shading devices to prevent afternoon glare.');
    recs.push('North-facing rooms receive consistent indirect light — ideal for studies/offices.');

    const poorlyLitRooms = roomSunlight.filter((r) => r.naturalLightFactor < 0.3);
    if (poorlyLitRooms.length > 0) {
      recs.push(
        `${poorlyLitRooms.length} room(s) have low natural light — consider adding windows or skylights.`,
      );
    }

    const glareRooms = roomSunlight.filter((r) => r.glareRisk);
    if (glareRooms.length > 0) {
      recs.push(
        `${glareRooms.length} room(s) have glare risk — add external shading or low-e glazing.`,
      );
    }

    return recs;
  }
}

export const spacePlanningEngine = new SpacePlanningEngine();
