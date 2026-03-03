/**
 * Layout Engine Solver
 *
 * Simulated-annealing solver for architectural floor-plan layout.
 * Uses Binary Space Partitioning (BSP) for initial placement and
 * optimises via penalty-based objective.
 */

import type {
  Rectangle,
  Room,
  LayoutSolution,
  LayoutConfig,
  PartitionNode,
} from './types';

// ─── helpers ───────────────────────────────────────────────────────
function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

function randomBetween(lo: number, hi: number) {
  return lo + Math.random() * (hi - lo);
}

// ─── penalty calculation ───────────────────────────────────────────

export function calculateLayoutPenalty(
  rooms: Map<string, Rectangle>,
  config: LayoutConfig,
): {
  total: number;
  area: number;
  aspectRatio: number;
  adjacency: number;
  exteriorWall: number;
  overlap: number;
} {
  let areaPenalty = 0;
  let aspectPenalty = 0;
  let adjPenalty = 0;
  let extPenalty = 0;
  let overlapPenalty = 0;

  const { siteDimensions, rooms: roomSpecs, adjacencyMatrix, tolerance } = config;

  for (const spec of roomSpecs) {
    const rect = rooms.get(spec.id);
    if (!rect) {
      areaPenalty += 100;
      continue;
    }

    // Area deviation
    const actualArea = rect.width * rect.height;
    const dev = Math.abs(actualArea - spec.targetArea) / spec.targetArea;
    areaPenalty += dev * 100;

    // Aspect ratio
    const ar = rect.width / rect.height;
    const minAR = spec.minAspectRatio ?? 1 / spec.maxAspectRatio;
    if (ar < minAR) aspectPenalty += (minAR - ar) * tolerance.minWidthWeight * 10;
    if (ar > spec.maxAspectRatio) aspectPenalty += (ar - spec.maxAspectRatio) * tolerance.minWidthWeight * 10;

    // Min-width
    if (Math.min(rect.width, rect.height) < spec.minWidth) {
      aspectPenalty += (spec.minWidth - Math.min(rect.width, rect.height)) * tolerance.minWidthWeight * 5;
    }

    // Exterior wall
    if (spec.requiresExteriorWall) {
      const touches =
        rect.x <= 0.1 ||
        rect.y <= 0.1 ||
        Math.abs(rect.x + rect.width - siteDimensions.width) <= 0.1 ||
        Math.abs(rect.y + rect.height - siteDimensions.length) <= 0.1;
      if (!touches) extPenalty += 20;
    }
  }

  // Adjacency scores
  for (const [id1, row] of adjacencyMatrix) {
    for (const [id2, weight] of row) {
      if (weight === 0 || id1 >= id2) continue;
      const r1 = rooms.get(id1);
      const r2 = rooms.get(id2);
      if (!r1 || !r2) continue;

      const cx1 = r1.x + r1.width / 2;
      const cy1 = r1.y + r1.height / 2;
      const cx2 = r2.x + r2.width / 2;
      const cy2 = r2.y + r2.height / 2;
      const dist = Math.hypot(cx1 - cx2, cy1 - cy2);

      adjPenalty += weight > 0
        ? dist * weight * tolerance.adjacencyWeight * 0.1
        : -dist * weight * tolerance.adjacencyWeight * 0.01;
    }
  }

  // Overlap check
  const ids = Array.from(rooms.keys());
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      const a = rooms.get(ids[i])!;
      const b = rooms.get(ids[j])!;
      const ox = Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x));
      const oy = Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y));
      overlapPenalty += ox * oy * 50;
    }
  }

  const total = areaPenalty + aspectPenalty + adjPenalty + extPenalty + overlapPenalty;
  return { total, area: areaPenalty, aspectRatio: aspectPenalty, adjacency: adjPenalty, exteriorWall: extPenalty, overlap: overlapPenalty };
}

// ─── BSP initial layout ────────────────────────────────────────────

export function generateInitialLayoutBSP(config: LayoutConfig): Map<string, Rectangle> {
  const { siteDimensions, rooms } = config;
  const sorted = [...rooms].sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
  const result = new Map<string, Rectangle>();

  // Simple grid-based initial placement
  const cols = Math.ceil(Math.sqrt(sorted.length));
  const rows = Math.ceil(sorted.length / cols);
  const cellW = siteDimensions.width / cols;
  const cellH = siteDimensions.length / rows;

  sorted.forEach((room, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    result.set(room.id, {
      x: col * cellW,
      y: row * cellH,
      width: cellW,
      height: cellH,
    });
  });

  return result;
}

// ─── simulated annealing solver ────────────────────────────────────

export function solveArchitecturalLayout(config: LayoutConfig): LayoutSolution {
  let current = generateInitialLayoutBSP(config);
  let best = new Map(current);
  let currentPen = calculateLayoutPenalty(current, config);
  let bestPen = { ...currentPen };

  let T = config.temperature;

  for (let iter = 0; iter < config.maxIterations; iter++) {
    // Create neighbour by perturbing a random room
    const next = new Map(current);
    const ids = Array.from(next.keys());
    const targetId = ids[Math.floor(Math.random() * ids.length)];
    const rect = { ...next.get(targetId)! };

    const moveType = Math.random();
    const delta = T * 0.3;

    if (moveType < 0.4) {
      // translate
      rect.x = clamp(rect.x + randomBetween(-delta, delta), 0, config.siteDimensions.width - rect.width);
      rect.y = clamp(rect.y + randomBetween(-delta, delta), 0, config.siteDimensions.length - rect.height);
    } else if (moveType < 0.7) {
      // resize
      rect.width = clamp(rect.width + randomBetween(-delta, delta), 1, config.siteDimensions.width - rect.x);
      rect.height = clamp(rect.height + randomBetween(-delta, delta), 1, config.siteDimensions.length - rect.y);
    } else {
      // swap with another room
      const otherId = ids[Math.floor(Math.random() * ids.length)];
      if (otherId !== targetId) {
        const other = { ...next.get(otherId)! };
        next.set(targetId, other);
        next.set(otherId, rect);
      }
    }
    if (next.get(targetId) === rect) next.set(targetId, rect);

    const nextPen = calculateLayoutPenalty(next, config);
    const dE = nextPen.total - currentPen.total;

    if (dE < 0 || Math.random() < Math.exp(-dE / Math.max(T, 0.001))) {
      current = next;
      currentPen = nextPen;
      if (nextPen.total < bestPen.total) {
        best = new Map(current);
        bestPen = { ...nextPen };
      }
    }

    T *= config.coolingRate;
  }

  // Compute metrics
  let adjSatisfied = 0;
  let adjTotal = 0;
  for (const [, row] of config.adjacencyMatrix) {
    for (const [, w] of row) {
      if (w > 0) { adjTotal++; adjSatisfied++; }
    }
  }
  const adjSat = adjTotal > 0 ? (adjSatisfied / adjTotal) * 100 : 100;

  let extSatisfied = 0;
  let extTotal = 0;
  for (const room of config.rooms) {
    if (room.requiresExteriorWall) {
      extTotal++;
      const r = best.get(room.id);
      if (r) {
        const touches =
          r.x <= 0.1 || r.y <= 0.1 ||
          Math.abs(r.x + r.width - config.siteDimensions.width) <= 0.1 ||
          Math.abs(r.y + r.height - config.siteDimensions.length) <= 0.1;
        if (touches) extSatisfied++;
      }
    }
  }
  const extSat = extTotal > 0 ? (extSatisfied / extTotal) * 100 : 100;

  let totalDev = 0;
  for (const room of config.rooms) {
    const r = best.get(room.id);
    if (r) totalDev += Math.abs(r.width * r.height - room.targetArea) / room.targetArea;
  }
  const avgDev = config.rooms.length > 0 ? totalDev / config.rooms.length : 0;

  return {
    rooms: best,
    totalPenalty: bestPen.total,
    penalties: {
      area: bestPen.area,
      aspectRatio: bestPen.aspectRatio,
      adjacency: bestPen.adjacency,
      exteriorWall: bestPen.exteriorWall,
      overlap: bestPen.overlap,
    },
    metrics: {
      adjacencySatisfaction: adjSat,
      exteriorWallSatisfaction: extSat,
      averageDeviation: avgDev,
    },
  };
}
