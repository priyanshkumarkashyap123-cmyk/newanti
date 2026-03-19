import {
  FloorPlan,
  PlotDimensions,
  SiteConstraints,
  StructuralPlan,
  ColumnSpec,
  BeamSpec,
  FoundationSpec,
  PlacedRoom,
} from './types';
import { snapColumnsToRoomCorners, computeGridAlignmentScore } from './OverlapSolver';

export const STRUCTURAL_GRID = {
  COLUMN_SIZE: 0.3,    // 300mm x 300mm
  MAX_SPAN: 5.0,       // Max distance without intermediate column
  MIN_SPAN: 2.0,       // Minimum distance to bother placing a column
};

export class StructuralGridPlacer {
  public generateStructuralPlan(
    floorPlans: FloorPlan[],
    plot: PlotDimensions,
    constraints: SiteConstraints,
  ): StructuralPlan {
    const columns: ColumnSpec[] = [];
    const beams: BeamSpec[] = [];
    const foundations: FoundationSpec[] = [];

    // Collect all rooms from all floor plans for snapping / filtering
    const allRooms: PlacedRoom[] = floorPlans.flatMap((fp) => fp.rooms);

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
      }
    }

    // Step 1: Snap columns to room corners
    const snappedColumns = snapColumnsToRoomCorners(columns, allRooms);

    // Step 2: Filter out columns placed inside the clear interior of any room
    function isColumnInsideRoom(col: ColumnSpec, room: PlacedRoom): boolean {
      const halfSize = (col.width || STRUCTURAL_GRID.COLUMN_SIZE) / 2;
      return (
        col.x > room.x + halfSize &&
        col.x < room.x + room.width - halfSize &&
        col.y > room.y + halfSize &&
        col.y < room.y + room.height - halfSize
      );
    }

    let filteredColumns = snappedColumns.filter(
      (col) => !allRooms.some((room) => isColumnInsideRoom(col, room)),
    );

    // Step 3: Insert intermediate columns
    const MAX_SPAN = STRUCTURAL_GRID.MAX_SPAN;
    const GRID_ALIGN_TOLERANCE = 0.3;

    const wallXCoords = new Set<number>();
    const wallYCoords = new Set<number>();
    for (const room of allRooms) {
      wallXCoords.add(room.x);
      wallXCoords.add(room.x + room.width);
      wallYCoords.add(room.y);
      wallYCoords.add(room.y + room.height);
    }

    const gridXLines = Array.from(new Set(filteredColumns.map((c) => c.x)));
    const gridYLines = Array.from(new Set(filteredColumns.map((c) => c.y)));

    const isNearGridLine = (coord: number, gridLines: number[]): boolean =>
      gridLines.some((g) => Math.abs(coord - g) <= GRID_ALIGN_TOLERANCE);

    let extraColId = colId;
    const intermediateColumns: ColumnSpec[] = [];

    for (const wx of wallXCoords) {
      if (isNearGridLine(wx, gridXLines)) continue;
      const lower = gridXLines.filter((g) => g < wx - GRID_ALIGN_TOLERANCE).sort((a, b) => b - a)[0];
      const upper = gridXLines.filter((g) => g > wx + GRID_ALIGN_TOLERANCE).sort((a, b) => a - b)[0];
      if (lower === undefined || upper === undefined) continue;
      const span = upper - lower;
      if (span > MAX_SPAN) continue;
      for (const gy of gridYLines) {
        const midX = Math.round(((lower + upper) / 2) * 100) / 100;
        const alreadyExists = filteredColumns.some(
          (c) => Math.abs(c.x - midX) < 0.05 && Math.abs(c.y - gy) < 0.05,
        );
        if (!alreadyExists) {
          intermediateColumns.push({
            id: `CI${extraColId++}`,
            x: midX,
            y: gy,
            width: STRUCTURAL_GRID.COLUMN_SIZE,
            depth: STRUCTURAL_GRID.COLUMN_SIZE,
            type: 'rectangular',
            material: 'RCC',
            reinforcement: '4-16φ + 4-12φ, 8mm ties @ 150mm c/c',
            floor: 0,
          });
        }
      }
    }

    for (const wy of wallYCoords) {
      if (isNearGridLine(wy, gridYLines)) continue;
      const lower = gridYLines.filter((g) => g < wy - GRID_ALIGN_TOLERANCE).sort((a, b) => b - a)[0];
      const upper = gridYLines.filter((g) => g > wy + GRID_ALIGN_TOLERANCE).sort((a, b) => a - b)[0];
      if (lower === undefined || upper === undefined) continue;
      const span = upper - lower;
      if (span > MAX_SPAN) continue;
      for (const gx of gridXLines) {
        const midY = Math.round(((lower + upper) / 2) * 100) / 100;
        const alreadyExists = filteredColumns.some(
          (c) => Math.abs(c.x - gx) < 0.05 && Math.abs(c.y - midY) < 0.05,
        ) || intermediateColumns.some(
          (c) => Math.abs(c.x - gx) < 0.05 && Math.abs(c.y - midY) < 0.05,
        );
        if (!alreadyExists) {
          intermediateColumns.push({
            id: `CI${extraColId++}`,
            x: gx,
            y: midY,
            width: STRUCTURAL_GRID.COLUMN_SIZE,
            depth: STRUCTURAL_GRID.COLUMN_SIZE,
            type: 'rectangular',
            material: 'RCC',
            reinforcement: '4-16φ + 4-12φ, 8mm ties @ 150mm c/c',
            floor: 0,
          });
        }
      }
    }

    filteredColumns = [...filteredColumns, ...intermediateColumns];

    for (const col of filteredColumns) {
      foundations.push({
        id: `F${col.id}`,
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

    let beamId = 1;
    for (let i = 0; i < filteredColumns.length; i++) {
      for (let j = i + 1; j < filteredColumns.length; j++) {
        const dx = Math.abs(filteredColumns[i].x - filteredColumns[j].x);
        const dy = Math.abs(filteredColumns[i].y - filteredColumns[j].y);
        if ((dx < gridSpacingX + 0.1 && dy < 0.1) || (dy < gridSpacingY + 0.1 && dx < 0.1)) {
          beams.push({
            id: `B${beamId++}`,
            startX: filteredColumns[i].x,
            startY: filteredColumns[i].y,
            endX: filteredColumns[j].x,
            endY: filteredColumns[j].y,
            width: 0.23,
            depth: 0.45,
            type: 'main',
            material: 'RCC',
            floor: 0,
          });
        }
      }
    }

    const gridAlignmentScore = computeGridAlignmentScore(filteredColumns, allRooms);

    return {
      columns: filteredColumns,
      beams,
      foundations,
      slabType: 'two_way',
      slabThickness: 0.15,
      gridAlignmentScore,
    };
  }
}

export const structuralGridPlacer = new StructuralGridPlacer();
