// Feature: space-planning-accuracy-and-tools, Properties 5 and 6
// Property 5: Column Snap Tolerance
// Property 6: Grid Alignment Score Bounds
// Validates: Requirements 3.1, 3.5

import { describe, it, expect } from 'vitest';
import { snapColumnsToRoomCorners, computeGridAlignmentScore } from '../SpacePlanningEngine';
import type { PlacedRoom, ColumnSpec } from '../types';

function makeRoom(id: string, x: number, y: number, width: number, height: number): PlacedRoom {
  return {
    id,
    x,
    y,
    width,
    height,
    rotation: 0,
    floor: 0,
    wallThickness: 0.23,
    finishFloor: 'tiles',
    finishWall: 'paint',
    finishCeiling: 'paint',
    ceilingHeight: 2.7,
    color: '#cccccc',
    spec: { type: 'living', priority: 'essential', minArea: 10, maxArea: 30, minWidth: 3, minDepth: 3, adjacentTo: [], awayFrom: [] } as any,
    doors: [],
    windows: [],
  };
}

function makeColumn(id: string, x: number, y: number): ColumnSpec {
  return { id, x, y, width: 0.3, depth: 0.3, type: 'rectangular', material: 'RCC', floor: 0 };
}

const rooms = [
  makeRoom('r1', 0, 0, 4, 4),
  makeRoom('r2', 5, 0, 3, 4),
];

describe('snapColumnsToRoomCorners', () => {
  it('snaps column within tolerance to nearest room corner', () => {
    const columns = [makeColumn('c1', 0.1, 0.1)]; // near corner (0,0)
    const snapped = snapColumnsToRoomCorners(columns, rooms, 0.15);
    expect(snapped[0].x).toBe(0);
    expect(snapped[0].y).toBe(0);
  });

  it('does not snap column outside tolerance', () => {
    const columns = [makeColumn('c1', 2, 2)]; // far from any corner
    const snapped = snapColumnsToRoomCorners(columns, rooms, 0.15);
    expect(snapped[0].x).toBe(2);
    expect(snapped[0].y).toBe(2);
  });

  it('does not mutate input columns', () => {
    const columns = [makeColumn('c1', 0.1, 0.1)];
    const original = { ...columns[0] };
    snapColumnsToRoomCorners(columns, rooms, 0.15);
    expect(columns[0].x).toBe(original.x);
    expect(columns[0].y).toBe(original.y);
  });

  it('Property 5: every snapped column is within tolerance of at least one room corner', () => {
    const corners = rooms.flatMap(r => [
      { x: r.x, y: r.y },
      { x: r.x + r.width, y: r.y },
      { x: r.x, y: r.y + r.height },
      { x: r.x + r.width, y: r.y + r.height },
    ]);
    // Place columns near corners
    const columns = corners.map((c, i) => makeColumn(`c${i}`, c.x + 0.1, c.y + 0.1));
    const snapped = snapColumnsToRoomCorners(columns, rooms, 0.15);
    for (const col of snapped) {
      const minDist = Math.min(...corners.map(c => Math.sqrt((col.x - c.x) ** 2 + (col.y - c.y) ** 2)));
      expect(minDist).toBeLessThanOrEqual(0.15);
    }
  });
});

describe('computeGridAlignmentScore', () => {
  it('returns 100 when all corners are covered', () => {
    const corners = rooms.flatMap(r => [
      { x: r.x, y: r.y },
      { x: r.x + r.width, y: r.y },
      { x: r.x, y: r.y + r.height },
      { x: r.x + r.width, y: r.y + r.height },
    ]);
    const columns = corners.map((c, i) => makeColumn(`c${i}`, c.x, c.y));
    const score = computeGridAlignmentScore(columns, rooms, 0.15);
    expect(score).toBe(100);
  });

  it('returns 0 when no corners are covered', () => {
    const columns = [makeColumn('c1', 50, 50)]; // far from all corners
    const score = computeGridAlignmentScore(columns, rooms, 0.15);
    expect(score).toBe(0);
  });

  it('returns 100 when rooms array is empty', () => {
    const score = computeGridAlignmentScore([], [], 0.15);
    expect(score).toBe(100);
  });

  it('Property 6: score is always in [0, 100]', () => {
    const testCases = [
      { columns: [], rooms: [] },
      { columns: [makeColumn('c1', 0, 0)], rooms },
      { columns: [makeColumn('c1', 100, 100)], rooms },
    ];
    for (const { columns, rooms: r } of testCases) {
      const score = computeGridAlignmentScore(columns, r, 0.15);
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
    }
  });
});
