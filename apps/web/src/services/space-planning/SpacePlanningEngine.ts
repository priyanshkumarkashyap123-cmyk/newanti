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
    minWidth: 0.9,
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
    minWidth: 1.0,
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
    minWidth: 0.6,
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
      }

      // Add distribution board
      const electricalRoom =
        plan.rooms.find((r) => r.spec.type === 'utility' || r.spec.type === 'entrance_lobby') ||
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
      (f) => f.type === 'light_point' || f.type === 'fan_point',
    );
    const powerFixtures = fixtures.filter(
      (f) => f.type === 'socket' || f.type === 'tv_point' || f.type === 'data_point',
    );
    const acFixtures = fixtures.filter((f) => f.type === 'ac_point');
    const kitchenFixtures = fixtures.filter((f) => f.roomId.includes('kitchen'));

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

    const connectedLoad = totalLoad / 1000;
    const demandLoad = connectedLoad * 0.7;

    return {
      fixtures,
      circuits,
      mainLoad: connectedLoad,
      connectedLoad,
      demandLoad,
      meterType: connectedLoad > 5 ? 'three_phase' : 'single_phase',
      earthingType: 'plate',
      lightningProtection: floorPlans.length > 2,
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
      // Main stack pipe
      const mainStack = wetRooms[0];
      let pipeId = 1;
      for (const room of wetRooms) {
        pipes.push({
          id: `WS-${pipeId}`,
          type: 'water_supply',
          startX: mainStack.x + mainStack.width / 2,
          startY: mainStack.y,
          endX: room.x + room.width / 2,
          endY: room.y + room.height / 2,
          diameter: 20,
          material: 'cpvc',
          floor: room.floor,
        });
        pipes.push({
          id: `DR-${pipeId}`,
          type: 'drainage',
          startX: room.x + room.width / 2,
          startY: room.y + room.height / 2,
          endX: mainStack.x + mainStack.width / 2,
          endY: mainStack.y + mainStack.height,
          diameter: 100,
          material: 'upvc',
          slope: 0.02,
          floor: room.floor,
        });
        pipeId++;
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
    let eqId = 1;
    let totalCooling = 0;

    for (const plan of floorPlans) {
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
            type: 'split_ac',
            x: room.x + room.width / 2,
            y: room.y + 0.2,
            roomId: room.id,
            capacity: tons,
            powerConsumption: tons * 1200,
          });
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
              type: 'natural',
              airflow: 50,
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
      ventilationRate: 6,
      freshAirPercentage: 20,
      ductRoutes: [],
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
    const prevailingWind: CardinalDirection = orientation.plotFacing === 'N' ? 'SW' : 'NE';

    const roomVentilation = floorPlans.flatMap((fp) =>
      fp.rooms.map((room) => {
        const windowCount = room.windows.length;
        const hasOppositeWindows =
          room.windows.some((w) => w.wallSide === 'N' || w.wallSide === 'E') &&
          room.windows.some((w) => w.wallSide === 'S' || w.wallSide === 'W');

        const ach = windowCount === 0 ? 0.5 : hasOppositeWindows ? 8 : windowCount >= 2 ? 4 : 2;

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
              : 'Good ventilation with current window placement',
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
            paths.push({
              inletRoom: room.id,
              outletRoom: room.id,
              effectiveness: 0.85,
            });
          }
        }
      }
      return paths;
    });

    return {
      prevailingWindDirection: prevailingWind,
      windSpeed: 3.5,
      crossVentilationPaths,
      stackVentilationPotential: floorPlans.length > 1 ? 0.7 : 0.3,
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
    const priorityOrder = { essential: 0, important: 1, desirable: 2, optional: 3 };
    return [...rooms].sort((a, b) => {
      const pa = priorityOrder[a.priority];
      const pb = priorityOrder[b.priority];
      if (pa !== pb) return pa - pb;
      return (b.preferredArea || 0) - (a.preferredArea || 0);
    });
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
    const wallThickness = 0.23; // 230mm brick wall

    // Available area grid
    const startX = setbacks.left;
    const startY = setbacks.front;

    // Divide plot into 8 Vastu zones
    const midX = startX + buildableWidth / 2;
    const midY = startY + buildableDepth / 2;

    // Zone mapping: direction -> approximate zone rectangle
    const zones: Record<CardinalDirection, { x: number; y: number; w: number; h: number }> = {
      NE: { x: midX, y: startY, w: buildableWidth / 2, h: buildableDepth / 2 },
      N: { x: midX - buildableWidth / 4, y: startY, w: buildableWidth / 2, h: buildableDepth / 3 },
      NW: { x: startX, y: startY, w: buildableWidth / 2, h: buildableDepth / 2 },
      E: { x: midX, y: midY - buildableDepth / 4, w: buildableWidth / 2, h: buildableDepth / 2 },
      W: { x: startX, y: midY - buildableDepth / 4, w: buildableWidth / 2, h: buildableDepth / 2 },
      SE: { x: midX, y: midY, w: buildableWidth / 2, h: buildableDepth / 2 },
      S: { x: midX - buildableWidth / 4, y: midY, w: buildableWidth / 2, h: buildableDepth / 3 },
      SW: { x: startX, y: midY, w: buildableWidth / 2, h: buildableDepth / 2 },
    };

    // Track occupied cells
    const occupiedCells: { x: number; y: number; w: number; h: number }[] = [];

    /**
     * ADJACENCY SCORING — Priority 5 enforcement
     *
     * When multiple placement positions are valid (non-overlapping),
     * score each candidate by:
     *   +points for being adjacent to rooms that should be nearby
     *   -points for being adjacent to rooms that should be separated
     *
     * This replaces the previous "first-fit" approach with "best-fit".
     */
    const scoreAdjacency = (
      candidateRect: { x: number; y: number; w: number; h: number },
      roomType: RoomType,
    ): number => {
      let score = 0;
      const adjacentTypes = this.getAdjacencyRules(roomType);
      const avoidTypes = this.getAvoidanceRules(roomType);

      // Also check spec-defined adjacentTo / awayFrom for the current room
      const currentSpec = rooms.find((r) => r.type === roomType);
      const specAdjacentTo = currentSpec?.adjacentTo || [];
      const specAwayFrom = currentSpec?.awayFrom || [];

      for (const placedRoom of placed) {
        const gap = 0.5; // adjacency threshold
        const isNearby =
          candidateRect.x < placedRoom.x + placedRoom.width + gap &&
          candidateRect.x + candidateRect.w > placedRoom.x - gap &&
          candidateRect.y < placedRoom.y + placedRoom.height + gap &&
          candidateRect.y + candidateRect.h > placedRoom.y - gap;

        if (isNearby) {
          // Rule-based adjacency
          if (adjacentTypes.includes(placedRoom.spec.type)) {
            score += 5; // Reward proximity to desired neighbors
          }
          if (avoidTypes.includes(placedRoom.spec.type)) {
            score -= 8; // Penalize proximity to undesired neighbors
          }
          // Spec-defined adjacency
          if (specAdjacentTo.includes(placedRoom.spec.type)) {
            score += 6;
          }
          if (specAwayFrom.includes(placedRoom.spec.type)) {
            score -= 7;
          }
        }
      }

      return score;
    };

    for (const room of rooms) {
      for (let q = 0; q < room.quantity; q++) {
        // Determine target zone based on Vastu or preference
        const targetDir =
          preferences.vastuCompliance !== 'none' && room.vastuDirection
            ? room.vastuDirection
            : room.preferredDirection?.[0] || 'N';

        const zone = zones[targetDir];
        const roomArea = room.preferredArea;

        // Calculate room dimensions
        let roomWidth = Math.max(room.minWidth, Math.sqrt(roomArea * 1.2));
        let roomHeight = roomArea / roomWidth;

        // Ensure minimum width
        if (roomWidth < room.minWidth) {
          roomWidth = room.minWidth;
          roomHeight = roomArea / roomWidth;
        }

        // Round to grid
        roomWidth = Math.round(roomWidth * 4) / 4; // 250mm grid
        roomHeight = Math.round(roomHeight * 4) / 4;

        // Cap to available zone
        roomWidth = Math.min(roomWidth, zone.w - wallThickness * 2);
        roomHeight = Math.min(roomHeight, zone.h - wallThickness * 2);

        // ── ENHANCED PLACEMENT: Score all valid positions, pick best ──
        let bestScore = -Infinity;
        let bestX = zone.x;
        let bestY = zone.y;
        let found = false;

        // Scan target zone first
        for (let tryY = zone.y; tryY + roomHeight <= zone.y + zone.h; tryY += 0.25) {
          for (let tryX = zone.x; tryX + roomWidth <= zone.x + zone.w; tryX += 0.25) {
            const candidate = { x: tryX, y: tryY, w: roomWidth, h: roomHeight };
            const overlaps = occupiedCells.some((oc) => this.rectsOverlap(candidate, oc));
            if (!overlaps) {
              const adjScore = scoreAdjacency(candidate, room.type);
              if (!found || adjScore > bestScore) {
                bestScore = adjScore;
                bestX = tryX;
                bestY = tryY;
                found = true;
              }
            }
          }
        }

        // If no space in target zone, try any available space
        if (!found) {
          for (
            let tryY = startY;
            tryY + roomHeight <= startY + buildableDepth && !found;
            tryY += 0.25
          ) {
            for (
              let tryX = startX;
              tryX + roomWidth <= startX + buildableWidth && !found;
              tryX += 0.25
            ) {
              const candidate = { x: tryX, y: tryY, w: roomWidth, h: roomHeight };
              const overlaps = occupiedCells.some((oc) => this.rectsOverlap(candidate, oc));
              if (!overlaps) {
                const adjScore = scoreAdjacency(candidate, room.type);
                if (!found || adjScore > bestScore) {
                  bestScore = adjScore;
                  bestX = tryX;
                  bestY = tryY;
                  found = true;
                }
              }
            }
          }
        }

        const px = bestX;
        const py = bestY;

        occupiedCells.push({ x: px, y: py, w: roomWidth, h: roomHeight });

        placed.push({
          id: `${room.id}-${q}`,
          spec: room,
          x: Math.round(px * 100) / 100,
          y: Math.round(py * 100) / 100,
          width: roomWidth,
          height: roomHeight,
          rotation: 0,
          floor: room.floor,
          wallThickness,
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

    return placed;
  }

  private addDoorsAndWindows(rooms: PlacedRoom[], orientation: SiteOrientation): void {
    for (const room of rooms) {
      // Add doors
      const mainDoor: DoorSpec = {
        id: `door-${room.id}`,
        type: room.spec.type === 'entrance_lobby' ? 'main_entry' : 'internal',
        width:
          room.spec.type === 'entrance_lobby'
            ? 1.2
            : room.spec.type === 'bathroom' || room.spec.type === 'toilet'
              ? 0.75
              : 0.9,
        height: room.spec.type === 'entrance_lobby' ? 2.4 : 2.1,
        material:
          room.spec.type === 'entrance_lobby'
            ? 'wood'
            : room.spec.type === 'bathroom'
              ? 'aluminum'
              : 'wood',
        swing: 'left',
        roomId: room.id,
        wallSide: 'S',
        position: room.width / 2 - 0.45,
      };
      room.doors.push(mainDoor);

      // Add windows based on room type
      if (room.spec.requiresWindow) {
        const windowSides: ('N' | 'S' | 'E' | 'W')[] = [];

        // Prefer windows on external walls (based on room position)
        if (room.x <= 2) windowSides.push('W');
        if (room.y <= 2) windowSides.push('S');
        windowSides.push('E', 'N');

        const primarySide = windowSides[0] || 'N';
        const winWidth =
          room.spec.type === 'kitchen'
            ? 1.2
            : room.spec.type === 'living' || room.spec.type === 'master_bedroom'
              ? 1.5
              : 1.0;

        const window: WindowSpec = {
          id: `win-${room.id}-1`,
          type: 'casement',
          width: winWidth,
          height: 1.2,
          sillHeight: 0.9,
          material: 'aluminum',
          glazing: 'single',
          roomId: room.id,
          wallSide: primarySide,
          position: room.width / 2 - winWidth / 2,
          operationType: 'openable',
        };
        room.windows.push(window);

        // Add second window for cross ventilation in large rooms
        if (room.width * room.height > 12) {
          const secondSide = windowSides.find((s) => s !== primarySide) || 'E';
          room.windows.push({
            ...window,
            id: `win-${room.id}-2`,
            wallSide: secondSide,
            width: 1.0,
            position: room.width / 2 - 0.5,
          });
        }
      }

      // Ventilator for bathrooms and toilets
      if (room.spec.type === 'bathroom' || room.spec.type === 'toilet') {
        room.windows.push({
          id: `vent-${room.id}`,
          type: 'louvered',
          width: 0.6,
          height: 0.6,
          sillHeight: 2.0,
          material: 'aluminum',
          glazing: 'single',
          roomId: room.id,
          wallSide: 'E',
          position: room.width - 0.8,
          operationType: 'openable',
        });
      }
    }
  }

  private generateWalls(
    rooms: PlacedRoom[],
    buildableWidth: number,
    buildableDepth: number,
    setbacks: { front: number; rear: number; left: number; right: number },
  ): WallSegment[] {
    const walls: WallSegment[] = [];
    let wallId = 1;

    // External walls
    const ox = setbacks.left;
    const oy = setbacks.front;
    const thickness = 0.23;

    walls.push({
      id: `W${wallId++}`,
      startX: ox,
      startY: oy,
      endX: ox + buildableWidth,
      endY: oy,
      thickness,
      type: 'external',
      material: 'brick',
    });
    walls.push({
      id: `W${wallId++}`,
      startX: ox + buildableWidth,
      startY: oy,
      endX: ox + buildableWidth,
      endY: oy + buildableDepth,
      thickness,
      type: 'external',
      material: 'brick',
    });
    walls.push({
      id: `W${wallId++}`,
      startX: ox + buildableWidth,
      startY: oy + buildableDepth,
      endX: ox,
      endY: oy + buildableDepth,
      thickness,
      type: 'external',
      material: 'brick',
    });
    walls.push({
      id: `W${wallId++}`,
      startX: ox,
      startY: oy + buildableDepth,
      endX: ox,
      endY: oy,
      thickness,
      type: 'external',
      material: 'brick',
    });

    // Internal walls between rooms
    for (const room of rooms) {
      walls.push({
        id: `W${wallId++}`,
        startX: room.x,
        startY: room.y,
        endX: room.x + room.width,
        endY: room.y,
        thickness: 0.115,
        type: 'internal',
        material: 'brick',
      });
      walls.push({
        id: `W${wallId++}`,
        startX: room.x + room.width,
        startY: room.y,
        endX: room.x + room.width,
        endY: room.y + room.height,
        thickness: 0.115,
        type: 'internal',
        material: 'brick',
      });
      walls.push({
        id: `W${wallId++}`,
        startX: room.x + room.width,
        startY: room.y + room.height,
        endX: room.x,
        endY: room.y + room.height,
        thickness: 0.115,
        type: 'internal',
        material: 'brick',
      });
      walls.push({
        id: `W${wallId++}`,
        startX: room.x,
        startY: room.y + room.height,
        endX: room.x,
        endY: room.y,
        thickness: 0.115,
        type: 'internal',
        material: 'brick',
      });
    }

    return walls;
  }

  private generateCorridors(rooms: PlacedRoom[], buildableWidth: number, buildableDepth: number) {
    // Simple central corridor layout
    return [
      {
        x: buildableWidth * 0.4,
        y: 0,
        width: 1.2,
        height: buildableDepth,
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

    return [
      {
        id: 'staircase-1',
        type: 'dog_leg',
        width: 1.2,
        riserHeight: 0.15,
        treadDepth: 0.25,
        numRisers: 20,
        landingWidth: 1.2,
        handrailHeight: 0.9,
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

    // Light points - center of room
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

    // Switch near door
    fixtures.push({
      id: `EF-${id++}`,
      type: 'switch',
      x: room.x + (room.doors[0]?.position || room.width / 2) + 0.15,
      y: room.y + 0.1,
      roomId: room.id,
      circuit: 'CKT-LIGHT',
      wattage: 0,
      height: 1.2,
    });

    // Sockets based on room type
    const socketCount =
      type === 'living'
        ? 4
        : type === 'kitchen'
          ? 4
          : type === 'master_bedroom' || type === 'bedroom'
            ? 3
            : type === 'study' || type === 'home_office'
              ? 4
              : 1;

    for (let i = 0; i < socketCount; i++) {
      fixtures.push({
        id: `EF-${id++}`,
        type: 'socket',
        x: room.x + ((i + 1) * room.width) / (socketCount + 1),
        y: room.y + (i % 2 === 0 ? 0.1 : room.height - 0.1),
        roomId: room.id,
        circuit: 'CKT-POWER',
        wattage: 200,
        height: 0.3,
      });
    }

    // Fan point for habitable rooms
    if (
      [
        'living',
        'dining',
        'master_bedroom',
        'bedroom',
        'study',
        'drawing_room',
        'guest_room',
        'childrens_room',
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

    // AC point for AC-eligible rooms
    if (
      ['living', 'master_bedroom', 'bedroom', 'study', 'home_office', 'guest_room'].includes(type)
    ) {
      fixtures.push({
        id: `EF-${id++}`,
        type: 'ac_point',
        x: room.x + room.width / 2,
        y: room.y + 0.3,
        roomId: room.id,
        circuit: 'CKT-AC',
        wattage: 1500,
        height: 2.4,
      });
    }

    // Kitchen specifics
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

    if (type === 'bathroom') {
      fixtures.push(
        {
          id: `PF-${id++}`,
          type: 'wash_basin',
          x: room.x + 0.5,
          y: room.y + 0.4,
          roomId: room.id,
          waterSupply: true,
          drainage: true,
          hotWater: true,
          pipeSize: 15,
        },
        {
          id: `PF-${id++}`,
          type: 'wc',
          x: room.x + 0.4,
          y: room.y + room.height - 0.6,
          roomId: room.id,
          waterSupply: true,
          drainage: true,
          hotWater: false,
          pipeSize: 100,
        },
        {
          id: `PF-${id++}`,
          type: 'shower',
          x: room.x + room.width - 0.5,
          y: room.y + room.height - 0.5,
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

    if (type === 'toilet') {
      fixtures.push(
        {
          id: `PF-${id++}`,
          type: 'wc',
          x: room.x + 0.4,
          y: room.y + room.height - 0.5,
          roomId: room.id,
          waterSupply: true,
          drainage: true,
          hotWater: false,
          pipeSize: 100,
        },
        {
          id: `PF-${id++}`,
          type: 'wash_basin',
          x: room.x + room.width - 0.5,
          y: room.y + 0.4,
          roomId: room.id,
          waterSupply: true,
          drainage: true,
          hotWater: false,
          pipeSize: 15,
        },
      );
    }

    if (type === 'kitchen') {
      fixtures.push(
        {
          id: `PF-${id++}`,
          type: 'kitchen_sink',
          x: room.x + room.width / 2,
          y: room.y + 0.3,
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
          y: room.y + room.height - 0.3,
          roomId: room.id,
          waterSupply: false,
          drainage: true,
          hotWater: false,
          pipeSize: 80,
        },
      );
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

  private getAdjacencyRules(type: RoomType): RoomType[] {
    switch (type) {
      case 'kitchen':
        return ['dining', 'utility', 'pantry', 'store'];
      case 'dining':
        return ['kitchen', 'living'];
      case 'master_bedroom':
        return ['walk_in_closet', 'dressing', 'bathroom'];
      case 'living':
        return ['dining', 'entrance_lobby', 'foyer'];
      case 'entrance_lobby':
        return ['living', 'staircase'];
      case 'pooja':
        return ['living', 'entrance_lobby'];
      default:
        return [];
    }
  }

  private getAvoidanceRules(type: RoomType): RoomType[] {
    switch (type) {
      case 'kitchen':
        return ['toilet', 'bathroom'];
      case 'pooja':
        return ['toilet', 'bathroom', 'kitchen'];
      case 'master_bedroom':
        return ['kitchen', 'garage'];
      case 'dining':
        return ['toilet', 'bathroom'];
      default:
        return [];
    }
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
