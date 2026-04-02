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
  clampToEnvelope,
  detectOverlaps,
  resolveOverlaps,
  computeAdjacencyScore,
  snapColumnsToRoomCorners,
  computeGridAlignmentScore,
} from './OverlapSolver';
import { structuralGridPlacer } from './StructuralGridPlacer';
import { codeComplianceValidator } from './CodeComplianceValidator';
import { generateElectricalPlanUtil } from './ElectricalPlanGenerator';
import { generatePlumbingPlanUtil } from './PlumbingPlanGenerator';
import { generateHVACPlanUtil } from './HVACPlanGenerator';
import { generateSunlightAnalysisUtil, generateAirflowAnalysisUtil } from './EnvironmentalAnalysisUtils';
import {
  addDoorsAndWindows as addDoorsAndWindowsUtil,
  generateWalls as generateWallsUtil,
  generateCorridors as generateCorridorsUtil,
  generateStaircases as generateStaircasesUtil,
} from './ArchitecturalElementsGenerator';
import {
  generateElectricalFixturesForRoom as generateElectricalFixturesForRoomUtil,
  generatePlumbingFixturesForRoom as generatePlumbingFixturesForRoomUtil,
} from './MEPSignatureGenerator';
import {
  areRoomsAdjacent,
  validateFurnitureClearance,
} from './GeometryValidationUtils';
import {
  buildCirculationSpine as buildCirculationSpineUtil,
  placePublicZone as placePublicZoneUtil,
  placeWetAreas as placeWetAreasUtil,
  placePrivateZone as placePrivateZoneUtil,
  autoInjectMandatoryRooms as autoInjectMandatoryRoomsUtil,
  validateEntranceSequence as validateEntranceSequenceUtil,
  architecturalPlacement as architecturalPlacementUtil,
} from './RoomPlacementEngine';

import {
  buildFrontElevation,
  buildRearElevation,
  buildLeftElevation,
  buildRightElevation,
  buildSectionAA,
  buildSectionBB,
} from './ElevationBuilder';

import {
  PlotDimensions,
  SiteOrientation,
  SiteConstraints,
  RoomSpec,
  RoomType,
  PlacedRoom,
  FloorPlan,
  ConstraintViolationRecord,
  WallSegment,
  StructuralPlan,
  StaircaseSpec,
  UserPreferences,
  ElectricalPlan,
  ElectricalFixture,
  PlumbingPlan,
  PlumbingFixture,
  HVACPlan,
  SunlightAnalysis,
  AirflowAnalysis,
  ElevationView,
  ElevationElement,
  DimensionLine,
  TextLabel,
  SectionLine,
  HousePlanProject,
} from './types';
import {
  MIN_CLEAR_DIM,
  NBC_MIN_DIMS,
} from './constants';
import { vastuEngine } from './VastuEngine';
import { snap_to_grid } from './geometry';
import { DEFAULT_ROOM_SPECS, ROOM_COLORS } from './roomPresets';
import type { PlacementContext } from './placement';
import { enforceNBCMinDimensions } from './sizing';

// ============================================
// SPACE PLANNING ENGINE
// ============================================

export class SpacePlanningEngine {
  private defaultRoomCounter = 0;
  private corridorZoneState?: { x: number; y: number; w: number; h: number };
  private boundsState?: { x: number; y: number; w: number; h: number };
  private entranceSequenceValidState = true;
  private furnitureWarningsState: string[] = [];

  // Per-floor budget = total / numFloors (approximate fair share)
  private computePerFloorBudget(plotArea: number, constraints: SiteConstraints) {
    const totalFARArea = constraints.farAllowed > 0
      ? plotArea * constraints.farAllowed
      : Infinity;
    const numFloors = constraints.maxFloors > 0 ? constraints.maxFloors : 1;
    return totalFARArea / numFloors;
  }

  // Backward-compatible helper used by existing UI/tests.
  getDefaultRoomSpec(type: RoomType, floor: number = 0): RoomSpec {
    const fallback = DEFAULT_ROOM_SPECS.living;
    const base = (DEFAULT_ROOM_SPECS[type] || fallback) as Partial<RoomSpec>;
    const id = `${type}_${floor}_${++this.defaultRoomCounter}`;
    const name = type
      .split('_')
      .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
      .join(' ');

    return {
      id,
      type,
      name,
      minArea: base.minArea ?? 6,
      preferredArea: base.preferredArea ?? base.minArea ?? 8,
      maxArea: base.maxArea ?? Math.max((base.preferredArea ?? 8) * 1.5, base.minArea ?? 6),
      minWidth: base.minWidth ?? 2.4,
      minHeight: base.minHeight ?? 3.0,
      requiresWindow: base.requiresWindow ?? true,
      requiresVentilation: base.requiresVentilation ?? true,
      requiresAttachedBath: base.requiresAttachedBath ?? false,
      preferredDirection: base.preferredDirection,
      vastuDirection: base.vastuDirection,
      priority: base.priority ?? 'important',
      floor,
      quantity: base.quantity ?? 1,
      adjacentTo: base.adjacentTo,
      awayFrom: base.awayFrom,
    };
  }

  // Main entry point for generating a floor plan
  generateFloorPlan(
    plot: PlotDimensions,
    orientation: SiteOrientation,
    constraints: SiteConstraints,
    roomSpecs: RoomSpec[],
    preferences: UserPreferences,
    floor: number,
  ): FloorPlan;

  generateFloorPlan(
    plotArea: number,
    buildableWidth: number,
    buildableDepth: number,
    effectiveSetbacks: { front: number; rear: number; left: number; right: number },
    roomSpecs: RoomSpec[],
    orientation: SiteOrientation,
    preferences: UserPreferences,
    constraints: SiteConstraints,
    floor: number,
    maxFloor: number,
    maxGroundCoverage: number,
  ): FloorPlan;

  generateFloorPlan(
    ...args:
      | [
          PlotDimensions,
          SiteOrientation,
          SiteConstraints,
          RoomSpec[],
          UserPreferences,
          number,
        ]
      | [
          number,
          number,
          number,
          { front: number; rear: number; left: number; right: number },
          RoomSpec[],
          SiteOrientation,
          UserPreferences,
          SiteConstraints,
          number,
          number,
          number,
        ]
  ): FloorPlan {
    let plotArea: number;
    let buildableWidth: number;
    let buildableDepth: number;
    let effectiveSetbacks: { front: number; rear: number; left: number; right: number };
    let roomSpecs: RoomSpec[];
    let orientation: SiteOrientation;
    let preferences: UserPreferences;
    let constraints: SiteConstraints;
    let floor: number;
    let maxFloor: number;
    let maxGroundCoverage: number;

    if (typeof args[0] === 'number') {
      [
        plotArea,
        buildableWidth,
        buildableDepth,
        effectiveSetbacks,
        roomSpecs,
        orientation,
        preferences,
        constraints,
        floor,
        maxFloor,
        maxGroundCoverage,
      ] = args as [
        number,
        number,
        number,
        { front: number; rear: number; left: number; right: number },
        RoomSpec[],
        SiteOrientation,
        UserPreferences,
        SiteConstraints,
        number,
        number,
        number,
      ];
    } else {
      const [plot, o, c, r, p, f] = args as [
        PlotDimensions,
        SiteOrientation,
        SiteConstraints,
        RoomSpec[],
        UserPreferences,
        number,
      ];
      orientation = o;
      constraints = c;
      roomSpecs = r;
      preferences = p;
      floor = f;

      plotArea = plot.area || plot.width * plot.depth;
      effectiveSetbacks = constraints.setbacks;
      buildableWidth = Math.max(0, plot.width - effectiveSetbacks.left - effectiveSetbacks.right);
      buildableDepth = Math.max(0, plot.depth - effectiveSetbacks.front - effectiveSetbacks.rear);
      maxFloor = Math.max(0, (constraints.maxFloors || 1) - 1);
      maxGroundCoverage = plotArea * ((constraints.groundCoverage || 100) / 100);
    }

    const effectiveFloor = Math.min(floor, maxFloor);
    const perFloorBudget = this.computePerFloorBudget(plotArea, constraints);

    // Filter rooms for this floor
    const floorRooms = roomSpecs.filter((r) => {
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

    // Auto-inject NBC-mandatory rooms if missing (only on ground floor, only for multi-room plans)
    const constraintViolations: FloorPlan['constraintViolations'] = [];
    const isMultiRoomPlan = adjustedRooms.length >= 2;
    const roomsWithMandatory = (effectiveFloor === 0 && isMultiRoomPlan)
      ? this.autoInjectMandatoryRooms(adjustedRooms, constraintViolations)
      : adjustedRooms;

    // ── ENFORCEMENT: Narrow plot — detect < 6 m buildable width ──
    // NBC Part 4: plots narrower than 6 m require a single-loaded corridor layout.
    const NARROW_PLOT_THRESHOLD = 6.0;
    const isNarrowPlot = buildableWidth < NARROW_PLOT_THRESHOLD;
    if (isNarrowPlot) {
      const narrowPlotViolation: ConstraintViolationRecord = {
        type: 'adjacency',
        message: `NBC Part 4: Plot buildable width ${buildableWidth.toFixed(2)} m < ${NARROW_PLOT_THRESHOLD} m — single-loaded corridor layout applied`,
        severity: 'warning',
        roomId: '',
      };
      constraintViolations.push({
        ...narrowPlotViolation,
      });
    }

    // Use architectural placement pipeline for multi-room plans (≥2 rooms),
    // fall back to legacy placeRooms for single-room plans (preserves existing tests)
    const placedRooms = roomsWithMandatory.length >= 2
      ? this.architecturalPlacement(
          roomsWithMandatory,
          buildableWidth,
          buildableDepth,
          effectiveSetbacks,
          orientation,
          preferences,
          effectiveFloor,
          isNarrowPlot,
        )
      : this.placeRooms(
          roomsWithMandatory,
          buildableWidth,
          buildableDepth,
          effectiveSetbacks,
          orientation,
          preferences,
        );

    // Generate walls
    const walls = this.generateWalls(
      placedRooms,
      buildableWidth,
      buildableDepth,
      effectiveSetbacks,
    );

    // Generate doors and windows
    this.addDoorsAndWindows(placedRooms, orientation);

    // ── Furniture clearance validation + auto-adjustment ──
    const furnitureWarnings: string[] = [];
    for (const room of placedRooms) {
      const { valid, warnings } = validateFurnitureClearance(room);
      furnitureWarnings.push(...warnings);
      
      // Auto-adjust: expand room slightly if it fails clearance and there's space
      if (!valid) {
        const nbcMin = MIN_CLEAR_DIM[room.spec.type];
        if (nbcMin) {
          const neededW = Math.max(room.width, nbcMin.w);
          const neededH = Math.max(room.height, nbcMin.h);
          // Only expand if within buildable envelope
          if (room.x + neededW <= effectiveSetbacks.left + buildableWidth) {
            room.width = this.snapToGrid(neededW);
          }
          if (room.y + neededH <= effectiveSetbacks.front + buildableDepth) {
            room.height = this.snapToGrid(neededH);
          }
        }
      }
    }

    // Store warnings for potential UI display
    this.furnitureWarningsState = furnitureWarnings;

    // Generate corridors
    const corridors = this.generateCorridors(placedRooms, buildableWidth, buildableDepth);

    const floorHeight = preferences.budget === 'luxury' ? 3.6 : 3.0;

    const basePlan: FloorPlan = {
      floor: effectiveFloor,
      label: effectiveFloor === 0 ? 'Ground Floor' : effectiveFloor === -1 ? 'Basement' : `Floor ${effectiveFloor}`,
      rooms: placedRooms,
      staircases: this.generateStaircases(
        placedRooms,
        buildableWidth,
        buildableDepth,
        effectiveSetbacks,
      ),
      corridors,
      floorHeight,
      slabThickness: 0.15,
      walls,
      boundaryViolationCount: 0,
      overlapCount: 0,
      constraintViolations,
    };

    return basePlan;
  }

  /**
   * Generate structural plan
   */
  generateStructuralPlan(
    floorPlans: FloorPlan[],
    plot: PlotDimensions,
    constraints: SiteConstraints,
  ): StructuralPlan {
    return structuralGridPlacer.generateStructuralPlan(floorPlans, plot, constraints);
  }
  /**
   * Generate electrical plan
   */
  generateElectricalPlan(floorPlans: FloorPlan[]): ElectricalPlan {
    return generateElectricalPlanUtil(
      floorPlans,
      (room, startId) => this.generateElectricalFixturesForRoom(room, startId),
    );
  }

  /**
   * Generate plumbing plan
   */
  generatePlumbingPlan(floorPlans: FloorPlan[]): PlumbingPlan {
    return generatePlumbingPlanUtil(
      floorPlans,
      (room, startId) => this.generatePlumbingFixturesForRoom(room, startId),
    );
  }

  /**
   * Generate HVAC plan
   */
  generateHVACPlan(floorPlans: FloorPlan[], preferences: UserPreferences): HVACPlan {
    return generateHVACPlanUtil(
      floorPlans,
      preferences,
      (a, b) => areRoomsAdjacent(a, b),
    );
  }

  /**
   * Generate sunlight analysis
   */
  generateSunlightAnalysis(
    floorPlans: FloorPlan[],
    latitude: number,
    longitude: number,
  ): SunlightAnalysis {
    return generateSunlightAnalysisUtil(floorPlans, latitude, longitude);
  }

  /**
   * Generate airflow analysis
   */
  generateAirflowAnalysis(floorPlans: FloorPlan[], orientation: SiteOrientation): AirflowAnalysis {
    return generateAirflowAnalysisUtil(floorPlans, orientation);
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

    const buildableWidth = plot.width - constraints.setbacks.left - constraints.setbacks.right;
    const buildableDepth = plot.depth - constraints.setbacks.front - constraints.setbacks.rear;
    const effectiveSetbacks = constraints.setbacks;
    const maxFloor = constraints.maxFloors > 0 ? constraints.maxFloors : Math.max(...floorNumbers, 0);
    const maxGroundCoverage = constraints.groundCoverage > 0
      ? (constraints.groundCoverage / 100) * plot.area
      : Infinity;

    // Generate floor plans
    const floorPlans = floorNumbers.map((floor) =>
      this.generateFloorPlan(
        plot.area,
        buildableWidth,
        buildableDepth,
        effectiveSetbacks,
        roomSpecs,
        orientation,
        preferences,
        constraints,
        floor,
        maxFloor,
        maxGroundCoverage,
      ),
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
      buildFrontElevation(floorPlans, structural, plot, constraints.setbacks),
      buildRearElevation(floorPlans, structural, plot, constraints.setbacks),
      buildLeftElevation(floorPlans, structural, plot, constraints.setbacks),
      buildRightElevation(floorPlans, structural, plot, constraints.setbacks),
    ];

    // Section lines
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
    const sections = [
      buildSectionAA(floorPlans, structural, sectionLines[0], plot),
      buildSectionBB(floorPlans, structural, sectionLines[1], plot),
    ];

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

  private sortRoomsByPriority(rooms: RoomSpec[], _orientation: SiteOrientation): RoomSpec[] {
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

  /** Snap value to 250mm structural grid */
  private snapToGrid(v: number): number {
    return snap_to_grid(v, 0.25);
  }

  // ────────────────────────────────────────────────────────────────────────
  // ARCHITECTURAL PLACEMENT PIPELINE (Tasks 3.4–3.10)
  // ────────────────────────────────────────────────────────────────────────

  /**
   * 3.4 Build the circulation spine — a corridor running along the central axis.
   * For N/S entry: corridor runs horizontally; for E/W entry: vertically.
   */
  private buildCirculationSpine(
    ox: number,
    oy: number,
    envW: number,
    envH: number,
    entranceSide: 'N' | 'S' | 'E' | 'W',
    preferences: UserPreferences,
    floor: number = 0,
    isNarrowPlot: boolean = false,
  ): { corridorZone: { x: number; y: number; w: number; h: number }; corridorRoom: PlacedRoom } {
    return buildCirculationSpineUtil(
      ox,
      oy,
      envW,
      envH,
      entranceSide,
      preferences,
      floor,
      isNarrowPlot,
      { snapToGrid: (v: number) => this.snapToGrid(v) },
      {
        getFloorFinish: (type: RoomType, prefs: UserPreferences) => this.getFloorFinish(type, prefs),
        getWallFinish: (type: RoomType, prefs: UserPreferences) => this.getWallFinish(type, prefs),
      },
    );
  }

  /**
   * 3.5 Place PUBLIC zone rooms (living, dining, foyer, drawing_room, study, etc.)
   * in the entrance-side half of the buildable envelope.
   */
  private placePublicZone(
    specs: RoomSpec[],
    corridorZone: { x: number; y: number; w: number; h: number },
    entranceSide: 'N' | 'S' | 'E' | 'W',
    context: PlacementContext,
    preferences: UserPreferences,
    ox: number,
    oy: number,
    envW: number,
    envH: number,
    isNarrowPlot: boolean = false,
  ): PlacedRoom[] {
    return placePublicZoneUtil(
      specs,
      corridorZone,
      entranceSide,
      context,
      preferences,
      ox,
      oy,
      envW,
      envH,
      isNarrowPlot,
      { snapToGrid: (v: number) => this.snapToGrid(v) },
      {
        getFloorFinish: (type: RoomType, prefs: UserPreferences) => this.getFloorFinish(type, prefs),
        getWallFinish: (type: RoomType, prefs: UserPreferences) => this.getWallFinish(type, prefs),
      },
    );
  }

  /**
   * 3.6 Place wet areas (kitchen, bathroom, toilet, utility, laundry) on a shared plumbing wall.
   */
  private placeWetAreas(
    specs: RoomSpec[],
    corridorZone: { x: number; y: number; w: number; h: number },
    entranceSide: 'N' | 'S' | 'E' | 'W',
    context: PlacementContext,
    preferences: UserPreferences,
    ox: number,
    oy: number,
    envW: number,
    envH: number,
  ): PlacedRoom[] {
    return placeWetAreasUtil(
      specs,
      corridorZone,
      entranceSide,
      context,
      preferences,
      ox,
      oy,
      envW,
      envH,
      { snapToGrid: (v: number) => this.snapToGrid(v) },
      {
        getFloorFinish: (type: RoomType, prefs: UserPreferences) => this.getFloorFinish(type, prefs),
        getWallFinish: (type: RoomType, prefs: UserPreferences) => this.getWallFinish(type, prefs),
      },
    );
  }

  /**
   * 3.7 Place PRIVATE zone rooms (bedrooms, dressing, walk-in-closet) in the rear half.
   */
  private placePrivateZone(
    specs: RoomSpec[],
    corridorZone: { x: number; y: number; w: number; h: number },
    wetPlaced: PlacedRoom[],
    entranceSide: 'N' | 'S' | 'E' | 'W',
    context: PlacementContext,
    preferences: UserPreferences,
    ox: number,
    oy: number,
    envW: number,
    envH: number,
  ): PlacedRoom[] {
    return placePrivateZoneUtil(
      specs,
      corridorZone,
      wetPlaced,
      entranceSide,
      context,
      preferences,
      ox,
      oy,
      envW,
      envH,
      { snapToGrid: (v: number) => this.snapToGrid(v) },
      {
        getFloorFinish: (type: RoomType, prefs: UserPreferences) => this.getFloorFinish(type, prefs),
        getWallFinish: (type: RoomType, prefs: UserPreferences) => this.getWallFinish(type, prefs),
      },
    );
  }

  /**
   * 3.8 Auto-inject NBC-mandatory rooms if missing (habitable room, kitchen, toilet).
   */
  private autoInjectMandatoryRooms(
    specs: RoomSpec[],
    violations: FloorPlan['constraintViolations'],
  ): RoomSpec[] {
    return autoInjectMandatoryRoomsUtil(specs, violations);
  }

  /**
   * 3.9 Validate entrance sequence: foyer → living → corridor → bedrooms.
   */
  private validateEntranceSequence(
    rooms: PlacedRoom[],
    entranceSide: 'N' | 'S' | 'E' | 'W',
  ): boolean {
    return validateEntranceSequenceUtil(rooms, entranceSide);
  }

  /**
   * 3.10 Orchestrate the full architectural placement pipeline.
   */
  private architecturalPlacement(
    rooms: RoomSpec[],
    buildableWidth: number,
    buildableDepth: number,
    setbacks: { front: number; rear: number; left: number; right: number },
    orientation: SiteOrientation,
    preferences: UserPreferences,
    floor: number = 0,
    isNarrowPlot: boolean = false,
  ): PlacedRoom[] {
    const envelopeW = setbacks.left + buildableWidth + setbacks.right;
    const envelopeD = setbacks.front + buildableDepth + setbacks.rear;
    const plotForPlacement: PlotDimensions = {
      width: envelopeW,
      depth: envelopeD,
      area: envelopeW * envelopeD,
      shape: 'rectangular',
      unit: 'meters',
    };

    const { rooms: placedRooms, context, entranceSequenceValid } = architecturalPlacementUtil(
      rooms,
      buildableWidth,
      buildableDepth,
      setbacks,
      orientation,
      preferences,
      plotForPlacement,
      floor,
      isNarrowPlot,
      { snapToGrid: (v: number) => this.snapToGrid(v) },
      {
        getFloorFinish: (type: RoomType, prefs: UserPreferences) => this.getFloorFinish(type, prefs),
        getWallFinish: (type: RoomType, prefs: UserPreferences) => this.getWallFinish(type, prefs),
      },
    );

    this.corridorZoneState = context.corridorZone;
    this.boundsState = {
      x: setbacks.left,
      y: setbacks.front,
      w: buildableWidth,
      h: buildableDepth,
    };
    this.entranceSequenceValidState = entranceSequenceValid;

    return placedRooms;
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
    const INT_WALL = 0.115;
    const ox = setbacks.left;
    const oy = setbacks.front;
    const envW = buildableWidth;
    const envH = buildableDepth;

    let curX = ox;
    let curY = oy;
    let rowH = 0;

    for (const room of rooms) {
      for (let q = 0; q < (room.quantity || 1); q++) {
        const area = room.preferredArea || room.minArea;
        const minW = NBC_MIN_DIMS[room.type]?.w ?? room.minWidth ?? 2.4;
        const minH = NBC_MIN_DIMS[room.type]?.h ?? 2.4;

        let rW = this.snapToGrid(Math.max(minW, Math.sqrt(area)));
        let rH = this.snapToGrid(Math.max(minH, area / rW));
        const dims = enforceNBCMinDimensions(room.type, rW, rH, area, (v) => this.snapToGrid(v));
        rW = dims.w;
        rH = dims.h;

        if (curX + rW > ox + envW) {
          curX = ox;
          curY += rowH + INT_WALL;
          rowH = 0;
        }

        if (curY + rH > oy + envH) continue;

        placed.push({
          id: `${room.id}-${q}`,
          spec: room,
          x: Math.round(curX * 100) / 100,
          y: Math.round(curY * 100) / 100,
          width: rW,
          height: rH,
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

        curX += rW + INT_WALL;
        rowH = Math.max(rowH, rH);
      }
    }

    this.corridorZoneState = undefined;
    this.boundsState = { x: ox, y: oy, w: envW, h: envH };
    this.entranceSequenceValidState = true;
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
    const corridorZone = this.corridorZoneState;
    const bounds = this.boundsState;
    addDoorsAndWindowsUtil(rooms, orientation, corridorZone, bounds, {
      snapToGrid: (v) => this.snapToGrid(v),
    });
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
    return generateWallsUtil(rooms, buildableWidth, buildableDepth, setbacks);
  }

  // ────────────────────────────────────────────────────────────────────────
  // CORRIDOR — Real accessible passage connecting all rooms
  // ────────────────────────────────────────────────────────────────────────

  private generateCorridors(rooms: PlacedRoom[], buildableWidth: number, buildableDepth: number) {
    const corridorZone = this.corridorZoneState;
    return generateCorridorsUtil(buildableWidth, buildableDepth, corridorZone);
  }

  private generateStaircases(
    rooms: PlacedRoom[],
    _buildableWidth: number,
    _buildableDepth: number,
    _setbacks: { front: number; rear: number; left: number; right: number },
  ): StaircaseSpec[] {
    return generateStaircasesUtil(rooms);
  }

  private generateElectricalFixturesForRoom(
    room: PlacedRoom,
    startId: number,
  ): ElectricalFixture[] {
    return generateElectricalFixturesForRoomUtil(room, startId);
  }

  private generatePlumbingFixturesForRoom(room: PlacedRoom, startId: number): PlumbingFixture[] {
    return generatePlumbingFixturesForRoomUtil(room, startId);
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
    return codeComplianceValidator.validateFurnitureClearance(room);
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

}

export const spacePlanningEngine = new SpacePlanningEngine();
export { computeAdjacencyScore };
export {
  buildFrontElevation,
  buildRearElevation,
  buildLeftElevation,
  buildRightElevation,
  clampToEnvelope,
  detectOverlaps,
  resolveOverlaps,
  snapColumnsToRoomCorners,
  computeGridAlignmentScore,
};

/**
 * Regenerates electrical, plumbing, and HVAC plans using the updated
 * room positions in mergedFloorPlan. Called after solver merge.
 */
export function recomputeMEPAfterMerge(
  project: HousePlanProject,
  mergedFloorPlan: FloorPlan
): { electrical: ElectricalPlan; plumbing: PlumbingPlan; hvac: HVACPlan } {
  const engine = new SpacePlanningEngine();
  const electrical = engine.generateElectricalPlan([mergedFloorPlan]);
  const plumbing = engine.generatePlumbingPlan([mergedFloorPlan]);
  const hvac = engine.generateHVACPlan([mergedFloorPlan], project.constraints as unknown as UserPreferences ?? {
    style: 'modern', budget: 'standard', climate: 'composite', orientation_priority: 'sunlight',
    parking: 'open', roofType: 'flat', naturalLighting: 'balanced', privacy: 'medium',
    greenFeatures: false, smartHome: false, accessibilityRequired: false, vastuCompliance: 'optional'
  });

  // Validate MEP containment
  for (const fixture of electrical.fixtures) {
    const room = mergedFloorPlan.rooms.find(r => r.id === fixture.roomId);
    if (room) {
      if (fixture.x < room.x || fixture.x > room.x + room.width || fixture.y < room.y || fixture.y > room.y + room.height) {
        console.warn(`[recomputeMEPAfterMerge] Electrical fixture ${fixture.id} outside room ${room.id}`);
      }
    }
  }
  for (const fixture of plumbing.fixtures) {
    const room = mergedFloorPlan.rooms.find(r => r.id === fixture.roomId);
    if (room) {
      if (fixture.x < room.x || fixture.x > room.x + room.width || fixture.y < room.y || fixture.y > room.y + room.height) {
        console.warn(`[recomputeMEPAfterMerge] Plumbing fixture ${fixture.id} outside room ${room.id}`);
      }
    }
  }
  for (const equip of hvac.equipment) {
    const room = mergedFloorPlan.rooms.find(r => r.id === equip.roomId);
    if (room) {
      if (equip.x < room.x || equip.x > room.x + room.width || equip.y < room.y || equip.y > room.y + room.height) {
        console.warn(`[recomputeMEPAfterMerge] HVAC equipment ${equip.id} outside room ${room.id}`);
      }
    }
  }

  return { electrical, plumbing, hvac };
}

/**
 * Builds a front elevation ElevationView from actual floor plan data.
 */
