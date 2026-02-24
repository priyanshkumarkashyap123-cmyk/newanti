/**
 * floorLoadDistributor.ts — Floor/Area Load → Member UDL Conversion
 *
 * Industry-standard yield-line / tributary-area method for distributing
 * floor area loads to supporting beams.
 *
 * Implements IS 456:2000 / ACI 318 / EC2 panel distribution:
 *   - One-way slab: Lz/Lx > 2 → load goes to long beams (at ends of short span)
 *   - Two-way slab: Yield-line 45° cuts → triangular on short sides,
 *     trapezoidal on long sides
 *
 * Units:  Store convention — kN, m, kN/m²
 * Output: WASM convention — N, m, N/m
 */

import type { DistributionType } from "../types/loads";

// ─── Types ────────────────────────────────────────────────────────────────────

/** Minimal floor load input — compatible with both store and types/loads FloorLoad */
export interface FloorLoadInput {
  id: string;
  pressure: number; // kN/m²
  yLevel: number; // Floor Y coordinate
  xMin: number;
  xMax: number;
  zMin: number;
  zMax: number;
  distributionOverride?: DistributionType;
  loadCase?: string;
}

export interface NodeInfo {
  id: string;
  x: number;
  y: number;
  z: number;
}

export interface MemberInfo {
  id: string;
  startNodeId: string;
  endNodeId: string;
}

/** A rectangular panel bounded by 4 beams */
export interface DetectedPanel {
  xMin: number;
  xMax: number;
  zMin: number;
  zMax: number;
  Lx: number; // Span in X direction (m)
  Lz: number; // Span in Z direction (m)
  aspectRatio: number; // max/min
  distribution: DistributionType;
  /** IDs of beams bounding this panel */
  beamIds: {
    xMinBeam?: string; // Beam at z = zMin, running along X
    xMaxBeam?: string; // Beam at z = zMax, running along X
    zMinBeam?: string; // Beam at x = xMin, running along Z
    zMaxBeam?: string; // Beam at x = xMax, running along Z
  };
}

/** Generated WASM-format member load (N/m) */
export interface GeneratedMemberLoad {
  element_id: string;
  w1: number; // Intensity at start_pos (N/m)
  w2: number; // Intensity at end_pos (N/m)
  direction: string;
  start_pos: number; // 0–1 ratio
  end_pos: number; // 0–1 ratio
  is_projected: boolean;
  _source: "floor_load"; // Tag for debugging
}

// ─── Constants ────────────────────────────────────────────────────────────────

const Y_TOLERANCE = 0.05; // 50 mm tolerance for "same Y level"
const COLLINEAR_TOL = 0.02; // 20 mm off-axis tolerance

// ─── Helpers ──────────────────────────────────────────────────────────────────

function approxEqual(a: number, b: number, tol = Y_TOLERANCE): boolean {
  return Math.abs(a - b) < tol;
}

/**
 * Determine distribution type from aspect ratio if not overridden.
 *
 * IS 456 Cl. 24.4:
 *   - Ly/Lx > 2  → one-way slab
 *   - Ly/Lx ≤ 2  → two-way slab (trapezoidal distribution)
 *   - Square slab → two-way triangular (equal distribution to all sides)
 */
function resolveDistribution(
  Lx: number,
  Lz: number,
  override?: DistributionType,
): DistributionType {
  if (override) return override;
  const ratio = Math.max(Lx, Lz) / Math.min(Lx, Lz);
  if (ratio > 2) return "one_way";
  if (ratio < 1.05) return "two_way_triangular"; // Nearly square
  return "two_way_trapezoidal";
}

// ─── Panel Detection ──────────────────────────────────────────────────────────

/**
 * Find all beams whose BOTH endpoints lie at the given Y level.
 */
function getBeamsAtLevel(
  members: MemberInfo[],
  nodeMap: Map<string, NodeInfo>,
  yLevel: number,
): MemberInfo[] {
  return members.filter((m) => {
    const n1 = nodeMap.get(m.startNodeId);
    const n2 = nodeMap.get(m.endNodeId);
    if (!n1 || !n2) return false;
    return approxEqual(n1.y, yLevel) && approxEqual(n2.y, yLevel);
  });
}

/**
 * Classify a beam as running along X or Z axis.
 * Returns { axis: 'X' | 'Z' | null, coord: number } where coord is the
 * constant coordinate (Z for X-axis beams, X for Z-axis beams).
 */
function classifyBeam(
  beam: MemberInfo,
  nodeMap: Map<string, NodeInfo>,
): { axis: "X" | "Z" | null; coord: number; min: number; max: number } {
  const n1 = nodeMap.get(beam.startNodeId)!;
  const n2 = nodeMap.get(beam.endNodeId)!;
  const dx = Math.abs(n2.x - n1.x);
  const dz = Math.abs((n2.z ?? 0) - (n1.z ?? 0));

  if (dx > COLLINEAR_TOL && dz < COLLINEAR_TOL) {
    // Runs along X — constant Z
    return {
      axis: "X",
      coord: n1.z ?? 0,
      min: Math.min(n1.x, n2.x),
      max: Math.max(n1.x, n2.x),
    };
  }
  if (dz > COLLINEAR_TOL && dx < COLLINEAR_TOL) {
    // Runs along Z — constant X
    return {
      axis: "Z",
      coord: n1.x,
      min: Math.min(n1.z ?? 0, n2.z ?? 0),
      max: Math.max(n1.z ?? 0, n2.z ?? 0),
    };
  }
  return { axis: null, coord: 0, min: 0, max: 0 }; // Diagonal — not a grid beam
}

/**
 * Auto-detect rectangular panels from beam geometry at a given Y level.
 *
 * Algorithm:
 *   1. Collect all X-axis beams (constant Z) and Z-axis beams (constant X)
 *   2. Sort X-beams by Z coordinate, Z-beams by X coordinate
 *   3. For each pair of adjacent X-beams (at Z₁ and Z₂) and pair of adjacent
 *      Z-beams (at X₁ and X₂), check if a closed rectangular panel exists
 *      by verifying beam overlap in the perpendicular direction.
 */
export function detectPanels(
  members: MemberInfo[],
  nodeMap: Map<string, NodeInfo>,
  yLevel: number,
  floorLoad: FloorLoadInput,
): DetectedPanel[] {
  const beams = getBeamsAtLevel(members, nodeMap, yLevel);
  if (beams.length < 4) return []; // Need at least 4 beams for a panel

  // Classify beams
  const xBeams: Array<{ id: string; z: number; xMin: number; xMax: number }> =
    [];
  const zBeams: Array<{ id: string; x: number; zMin: number; zMax: number }> =
    [];

  for (const b of beams) {
    const cls = classifyBeam(b, nodeMap);
    if (cls.axis === "X") {
      xBeams.push({ id: b.id, z: cls.coord, xMin: cls.min, xMax: cls.max });
    } else if (cls.axis === "Z") {
      zBeams.push({ id: b.id, x: cls.coord, zMin: cls.min, zMax: cls.max });
    }
  }

  // Deduplicate by coordinate (merge overlapping beams at same coordinate)
  const uniqueZCoords = [
    ...new Set(xBeams.map((b) => Math.round(b.z * 1000) / 1000)),
  ].sort((a, b) => a - b);
  const uniqueXCoords = [
    ...new Set(zBeams.map((b) => Math.round(b.x * 1000) / 1000)),
  ].sort((a, b) => a - b);

  const panels: DetectedPanel[] = [];

  // Check every pair of adjacent X-beams × every pair of adjacent Z-beams
  for (let iz = 0; iz < uniqueZCoords.length - 1; iz++) {
    const z1 = uniqueZCoords[iz];
    const z2 = uniqueZCoords[iz + 1];

    for (let ix = 0; ix < uniqueXCoords.length - 1; ix++) {
      const x1 = uniqueXCoords[ix];
      const x2 = uniqueXCoords[ix + 1];

      // Check floor load bounds
      if (
        x1 < floorLoad.xMin - COLLINEAR_TOL ||
        x2 > floorLoad.xMax + COLLINEAR_TOL ||
        z1 < floorLoad.zMin - COLLINEAR_TOL ||
        z2 > floorLoad.zMax + COLLINEAR_TOL
      ) {
        continue;
      }

      // Find the 4 bounding beams
      const bottomBeam = xBeams.find(
        (b) =>
          approxEqual(b.z, z1, COLLINEAR_TOL) &&
          b.xMin <= x1 + COLLINEAR_TOL &&
          b.xMax >= x2 - COLLINEAR_TOL,
      );
      const topBeam = xBeams.find(
        (b) =>
          approxEqual(b.z, z2, COLLINEAR_TOL) &&
          b.xMin <= x1 + COLLINEAR_TOL &&
          b.xMax >= x2 - COLLINEAR_TOL,
      );
      const leftBeam = zBeams.find(
        (b) =>
          approxEqual(b.x, x1, COLLINEAR_TOL) &&
          b.zMin <= z1 + COLLINEAR_TOL &&
          b.zMax >= z2 - COLLINEAR_TOL,
      );
      const rightBeam = zBeams.find(
        (b) =>
          approxEqual(b.x, x2, COLLINEAR_TOL) &&
          b.zMin <= z1 + COLLINEAR_TOL &&
          b.zMax >= z2 - COLLINEAR_TOL,
      );

      if (!bottomBeam || !topBeam || !leftBeam || !rightBeam) continue;

      const Lx = x2 - x1;
      const Lz = z2 - z1;
      if (Lx < 0.1 || Lz < 0.1) continue; // Skip degenerate panels

      panels.push({
        xMin: x1,
        xMax: x2,
        zMin: z1,
        zMax: z2,
        Lx,
        Lz,
        aspectRatio: Math.max(Lx, Lz) / Math.min(Lx, Lz),
        distribution: resolveDistribution(
          Lx,
          Lz,
          floorLoad.distributionOverride,
        ),
        beamIds: {
          xMinBeam: bottomBeam.id,
          xMaxBeam: topBeam.id,
          zMinBeam: leftBeam.id,
          zMaxBeam: rightBeam.id,
        },
      });
    }
  }

  return panels;
}

// ─── Load Distribution Engine ─────────────────────────────────────────────────

/**
 * Given a detected panel and floor pressure, generate member UDL loads
 * on the 4 bounding beams using yield-line distribution.
 *
 * Each beam load is in WASM format (N/m) with start_pos/end_pos as 0-1 ratios
 * along the beam's total length. For beams that span multiple panels, the
 * start_pos/end_pos covers only the panel extent on that beam.
 *
 * @param panel - Detected rectangular panel
 * @param pressure - Floor load pressure (kN/m²) — negative = downward
 * @param nodeMap - Node lookup
 * @param memberMap - Member lookup (to compute beam lengths for position ratios)
 */
function distributePanel(
  panel: DetectedPanel,
  pressure: number,
  nodeMap: Map<string, NodeInfo>,
  memberMap: Map<string, MemberInfo>,
): GeneratedMemberLoad[] {
  const loads: GeneratedMemberLoad[] = [];
  const { Lx, Lz, distribution, beamIds } = panel;
  const p = pressure; // kN/m² (negative = downward, which is convention)

  // Helper: compute beam length and the start_pos/end_pos ratio
  // for the panel's extent on this beam
  const getBeamRatios = (
    beamId: string,
    panelMin: number,
    panelMax: number,
    axis: "X" | "Z",
  ): { startRatio: number; endRatio: number; beamLength: number } | null => {
    const member = memberMap.get(beamId);
    if (!member) return null;
    const n1 = nodeMap.get(member.startNodeId);
    const n2 = nodeMap.get(member.endNodeId);
    if (!n1 || !n2) return null;

    const coord1 = axis === "X" ? n1.x : (n1.z ?? 0);
    const coord2 = axis === "X" ? n2.x : (n2.z ?? 0);
    const beamMin = Math.min(coord1, coord2);
    const beamMax = Math.max(coord1, coord2);
    const beamLength = beamMax - beamMin;
    if (beamLength < 1e-6) return null;

    // Panel extent as ratio of beam length
    const startRatio = Math.max(0, (panelMin - beamMin) / beamLength);
    const endRatio = Math.min(1, (panelMax - beamMin) / beamLength);

    // If beam direction is reversed (n1 > n2), flip ratios
    if (coord1 > coord2) {
      return {
        startRatio: 1 - endRatio,
        endRatio: 1 - startRatio,
        beamLength,
      };
    }

    return { startRatio, endRatio, beamLength };
  };

  // Helper: create a member load entry
  const mkLoad = (
    element_id: string,
    w1_kNm: number,
    w2_kNm: number,
    start_pos: number,
    end_pos: number,
  ): GeneratedMemberLoad => ({
    element_id,
    w1: w1_kNm * 1000, // kN/m → N/m for WASM
    w2: w2_kNm * 1000,
    direction: "global_y",
    start_pos,
    end_pos,
    is_projected: false,
    _source: "floor_load",
  });

  const Lshort = Math.min(Lx, Lz);
  const Llong = Math.max(Lx, Lz);

  // ─── ONE-WAY SLAB ──────────────────────────────────────────────────────
  // IS 456 Cl. 24.4: slab spans the SHORT direction; load transfers to the
  // two beams at the ends of the short span (i.e. the LONG beams).
  // Intensity per unit length on each long beam = p × Lshort / 2.
  if (distribution === "one_way") {
    const w = (p * Lshort) / 2; // kN/m on each long beam

    if (Lx <= Lz) {
      // Short span is X → slab spans left↔right → load on Z-direction beams (long beams)
      for (const beamId of [beamIds.zMinBeam, beamIds.zMaxBeam]) {
        if (!beamId) continue;
        const ratios = getBeamRatios(beamId, panel.zMin, panel.zMax, "Z");
        if (!ratios) continue;
        loads.push(mkLoad(beamId, w, w, ratios.startRatio, ratios.endRatio));
      }
    } else {
      // Short span is Z → slab spans bottom↔top → load on X-direction beams (long beams)
      for (const beamId of [beamIds.xMinBeam, beamIds.xMaxBeam]) {
        if (!beamId) continue;
        const ratios = getBeamRatios(beamId, panel.xMin, panel.xMax, "X");
        if (!ratios) continue;
        loads.push(mkLoad(beamId, w, w, ratios.startRatio, ratios.endRatio));
      }
    }
    return loads;
  }

  // ─── TWO-WAY TRIANGULAR (square slab) ──────────────────────────────────
  if (distribution === "two_way_triangular") {
    // All 4 beams get triangular loads: 0 at ends → peak at midspan
    // Peak = p × L_perpendicular / 2, but for square L_perp = L, so peak = p*L/2

    // X-direction beams (bottom & top): triangle along X, tributary width = Lz/2
    const peakX = (p * Lz) / 2; // kN/m at midspan of X-beam
    for (const beamId of [beamIds.xMinBeam, beamIds.xMaxBeam]) {
      if (!beamId) continue;
      const ratios = getBeamRatios(beamId, panel.xMin, panel.xMax, "X");
      if (!ratios) continue;
      const mid = (ratios.startRatio + ratios.endRatio) / 2;
      // First half: 0 → peak
      loads.push(mkLoad(beamId, 0, peakX, ratios.startRatio, mid));
      // Second half: peak → 0
      loads.push(mkLoad(beamId, peakX, 0, mid, ratios.endRatio));
    }

    // Z-direction beams (left & right): triangle along Z, tributary width = Lx/2
    const peakZ = (p * Lx) / 2; // kN/m at midspan of Z-beam
    for (const beamId of [beamIds.zMinBeam, beamIds.zMaxBeam]) {
      if (!beamId) continue;
      const ratios = getBeamRatios(beamId, panel.zMin, panel.zMax, "Z");
      if (!ratios) continue;
      const mid = (ratios.startRatio + ratios.endRatio) / 2;
      loads.push(mkLoad(beamId, 0, peakZ, ratios.startRatio, mid));
      loads.push(mkLoad(beamId, peakZ, 0, mid, ratios.endRatio));
    }

    return loads;
  }

  // ─── TWO-WAY TRAPEZOIDAL (general rectangular slab) ────────────────────
  // Short-side beams: triangular (0 → peak → 0)
  // Long-side beams: trapezoidal (0 → peak — flat — peak → 0)
  // Peak intensity = p × Lshort / 2

  const peak = (p * Lshort) / 2; // kN/m
  const halfShort = Lshort / 2; // Distance from corner to yield line

  if (Lx <= Lz) {
    // Lx is short, Lz is long
    // X-direction beams (bottom & top): SHORT SIDE → triangular
    for (const beamId of [beamIds.xMinBeam, beamIds.xMaxBeam]) {
      if (!beamId) continue;
      const ratios = getBeamRatios(beamId, panel.xMin, panel.xMax, "X");
      if (!ratios) continue;
      const mid = (ratios.startRatio + ratios.endRatio) / 2;
      loads.push(mkLoad(beamId, 0, peak, ratios.startRatio, mid));
      loads.push(mkLoad(beamId, peak, 0, mid, ratios.endRatio));
    }

    // Z-direction beams (left & right): LONG SIDE → trapezoidal
    for (const beamId of [beamIds.zMinBeam, beamIds.zMaxBeam]) {
      if (!beamId) continue;
      const ratios = getBeamRatios(beamId, panel.zMin, panel.zMax, "Z");
      if (!ratios) continue;
      const panelSpan = ratios.endRatio - ratios.startRatio;
      const riseRatio = (halfShort / Lz) * panelSpan;
      const flatStart = ratios.startRatio + riseRatio;
      const flatEnd = ratios.endRatio - riseRatio;

      // Rising segment: 0 → peak
      loads.push(mkLoad(beamId, 0, peak, ratios.startRatio, flatStart));
      // Flat segment: peak → peak (uniform)
      if (flatEnd > flatStart + 1e-6) {
        loads.push(mkLoad(beamId, peak, peak, flatStart, flatEnd));
      }
      // Falling segment: peak → 0
      loads.push(mkLoad(beamId, peak, 0, flatEnd, ratios.endRatio));
    }
  } else {
    // Lz is short, Lx is long
    // Z-direction beams (left & right): SHORT SIDE → triangular
    for (const beamId of [beamIds.zMinBeam, beamIds.zMaxBeam]) {
      if (!beamId) continue;
      const ratios = getBeamRatios(beamId, panel.zMin, panel.zMax, "Z");
      if (!ratios) continue;
      const mid = (ratios.startRatio + ratios.endRatio) / 2;
      loads.push(mkLoad(beamId, 0, peak, ratios.startRatio, mid));
      loads.push(mkLoad(beamId, peak, 0, mid, ratios.endRatio));
    }

    // X-direction beams (bottom & top): LONG SIDE → trapezoidal
    for (const beamId of [beamIds.xMinBeam, beamIds.xMaxBeam]) {
      if (!beamId) continue;
      const ratios = getBeamRatios(beamId, panel.xMin, panel.xMax, "X");
      if (!ratios) continue;
      const panelSpan = ratios.endRatio - ratios.startRatio;
      const riseRatio = (halfShort / Lx) * panelSpan;
      const flatStart = ratios.startRatio + riseRatio;
      const flatEnd = ratios.endRatio - riseRatio;

      loads.push(mkLoad(beamId, 0, peak, ratios.startRatio, flatStart));
      if (flatEnd > flatStart + 1e-6) {
        loads.push(mkLoad(beamId, peak, peak, flatStart, flatEnd));
      }
      loads.push(mkLoad(beamId, peak, 0, flatEnd, ratios.endRatio));
    }
  }

  return loads;
}

// ─── Main Entry Point ─────────────────────────────────────────────────────────

/**
 * Convert all floor loads to equivalent member UDL loads for the WASM solver.
 *
 * @param floorLoads - Array of floor/area loads from the store
 * @param nodes - All model nodes (array, will be mapped internally)
 * @param members - All model members (array, will be mapped internally)
 * @returns Array of generated member loads in WASM format (N/m)
 */
export function distributeFloorLoads(
  floorLoads: FloorLoadInput[],
  nodes: NodeInfo[],
  members: MemberInfo[],
): { loads: GeneratedMemberLoad[]; panels: DetectedPanel[] } {
  if (!floorLoads.length) return { loads: [], panels: [] };

  // Build lookup maps
  const nodeMap = new Map<string, NodeInfo>();
  for (const n of nodes) nodeMap.set(n.id, n);

  const memberMap = new Map<string, MemberInfo>();
  for (const m of members) memberMap.set(m.id, m);

  const allLoads: GeneratedMemberLoad[] = [];
  const allPanels: DetectedPanel[] = [];

  for (const fl of floorLoads) {
    const panels = detectPanels(members, nodeMap, fl.yLevel, fl);
    allPanels.push(...panels);

    for (const panel of panels) {
      const panelLoads = distributePanel(
        panel,
        fl.pressure,
        nodeMap,
        memberMap,
      );
      allLoads.push(...panelLoads);
    }

    // If no panels detected but floor load exists, attempt a simple fallback:
    // Find beams at the Y level and apply a crude UDL based on pressure × 1m tributary width
    if (panels.length === 0) {
      const beamsAtLevel = getBeamsAtLevel(members, nodeMap, fl.yLevel);
      if (beamsAtLevel.length > 0) {
        console.warn(
          `[FloorLoadDistributor] No rectangular panels detected at Y=${fl.yLevel}. ` +
            `Fallback: applying UDL with 1m tributary width to ${beamsAtLevel.length} beams.`,
        );
        const w = fl.pressure * 1.0; // kN/m (1m assumed tributary width)
        for (const beam of beamsAtLevel) {
          allLoads.push({
            element_id: beam.id,
            w1: w * 1000, // N/m
            w2: w * 1000,
            direction: "global_y",
            start_pos: 0,
            end_pos: 1,
            is_projected: false,
            _source: "floor_load",
          });
        }
      }
    }
  }

  return { loads: allLoads, panels: allPanels };
}
