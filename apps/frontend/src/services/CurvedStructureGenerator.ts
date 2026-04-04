/**
 * CurvedStructureGenerator.ts — Parametric Curved & Circular Geometry Engine
 *
 * Generates structural models for curved/circular shapes that industry-standard
 * software (STAAD Pro, SAP2000, ETABS, Robot) supports but we were missing:
 *
 *   1. Geodesic Dome (Schwedler / Kiewitt dome)
 *   2. Ribbed Dome (with meridional ribs + ring beams)
 *   3. Barrel Vault (cylindrical shell approximated by frame)
 *   4. Arch (parabolic / circular / catenary)
 *   5. Tunnel (horseshoe / circular / D-shape section)
 *   6. Sphere / Hemisphere mesh
 *   7. Cylindrical Tank / Silo
 *   8. Hyperbolic Paraboloid (hypar) shell
 *   9. Cooling Tower (hyperboloid of revolution)
 *  10. Helical / Spiral Staircase
 *
 * All generators produce standard {nodes, members, supports, loads} arrays
 * compatible with the existing Zustand store and solver pipeline.
 */

import type { Node, Member } from "../store/model";

// ──────────────────────────────────────────────────────────────────────────
// SHARED TYPES
// ──────────────────────────────────────────────────────────────────────────

export interface CurvedSupport {
  nodeId: string;
  type: "fixed" | "pinned" | "roller";
  restraints: {
    fx: boolean;
    fy: boolean;
    fz: boolean;
    mx: boolean;
    my: boolean;
    mz: boolean;
  };
}

export interface CurvedLoad {
  id: string;
  nodeId: string;
  fx?: number;
  fy?: number;
  fz?: number;
}

export interface CurvedStructure {
  name: string;
  description: string;
  nodes: Node[];
  members: Member[];
  supports: CurvedSupport[];
  loads: CurvedLoad[];
  metadata: {
    type: string;
    params: Record<string, number | string | boolean>;
    nodeCount: number;
    memberCount: number;
  };
}

// ──────────────────────────────────────────────────────────────────────────
// HELPERS
// ──────────────────────────────────────────────────────────────────────────

let _gid = 0;
function uid(prefix: string): string {
  return `${prefix}_${++_gid}`;
}
function resetIds() {
  _gid = 0;
}

function makeNode(id: string, x: number, y: number, z: number): Node {
  return { id, x: +x.toFixed(6), y: +y.toFixed(6), z: +z.toFixed(6) };
}

function makeMember(
  id: string,
  startNodeId: string,
  endNodeId: string,
  overrides?: Partial<Member>,
): Member {
  return {
    id,
    startNodeId,
    endNodeId,
    E: 200e6, // kN/m², steel default
    A: 0.01,
    I: 8.33e-6,
    Iy: 8.33e-6,
    Iz: 8.33e-6,
    J: 1.41e-5,
    G: 80e6,
    sectionType: "CIRCLE",
    dimensions: { diameter: 0.1143 }, // 114.3 mm pipe
    ...overrides,
  };
}

function fixedSupport(nodeId: string): CurvedSupport {
  return {
    nodeId,
    type: "fixed",
    restraints: { fx: true, fy: true, fz: true, mx: true, my: true, mz: true },
  };
}

function pinnedSupport(nodeId: string): CurvedSupport {
  return {
    nodeId,
    type: "pinned",
    restraints: {
      fx: true,
      fy: true,
      fz: true,
      mx: false,
      my: false,
      mz: false,
    },
  };
}

// ──────────────────────────────────────────────────────────────────────────
// 1. GEODESIC DOME (Schwedler type)
// ──────────────────────────────────────────────────────────────────────────

export interface DomeParams {
  radius: number; // m, base radius
  riseRatio: number; // rise/span (0.2–0.5 typical, 0.5 = hemisphere)
  rings: number; // number of horizontal ring levels (4–12)
  segments: number; // divisions per ring (8–36)
  sectionArea: number; // m² — member cross-section area
  sectionI: number; // m⁴ — moment of inertia
  gravityLoad: number; // kN per node (self-weight + cladding)
}

const DEFAULT_DOME: DomeParams = {
  radius: 20,
  riseRatio: 0.4,
  rings: 6,
  segments: 16,
  sectionArea: 0.005,
  sectionI: 2e-5,
  gravityLoad: -5,
};

export function generateGeodesicDome(
  params?: Partial<DomeParams>,
): CurvedStructure {
  resetIds();
  const p = { ...DEFAULT_DOME, ...params };
  const R = p.radius;
  const rise = R * 2 * p.riseRatio; // height of dome
  const nodes: Node[] = [];
  const members: Member[] = [];
  const supports: CurvedSupport[] = [];
  const loads: CurvedLoad[] = [];

  // Sphere center is at y = -(Rsphere - rise) so that base is at y=0 and crown at y=rise.
  // Rsphere satisfies: Rsphere² = R² + (Rsphere - rise)²
  //                    → Rsphere = (R² + rise²) / (2 * rise)
  const Rsphere = (R * R + rise * rise) / (2 * rise);
  const yCenter = -(Rsphere - rise);

  // Angle from pole: base ring at θ_base = asin(R / Rsphere)
  const thetaBase = Math.asin(Math.min(R / Rsphere, 1));

  // Crown node (apex)
  const crownId = uid("N");
  nodes.push(makeNode(crownId, 0, rise, 0));
  loads.push({ id: uid("L"), nodeId: crownId, fy: p.gravityLoad });

  // Ring nodes
  const ringNodes: string[][] = [];
  for (let r = 1; r <= p.rings; r++) {
    const theta = (r / p.rings) * thetaBase;
    const yRing = yCenter + Rsphere * Math.cos(theta);
    const rRing = Rsphere * Math.sin(theta);
    const ring: string[] = [];
    for (let s = 0; s < p.segments; s++) {
      const phi = (2 * Math.PI * s) / p.segments;
      const nid = uid("N");
      nodes.push(
        makeNode(nid, rRing * Math.cos(phi), yRing, rRing * Math.sin(phi)),
      );
      ring.push(nid);
      loads.push({ id: uid("L"), nodeId: nid, fy: p.gravityLoad });
    }
    ringNodes.push(ring);
  }

  const memberOverrides: Partial<Member> = {
    A: p.sectionArea,
    I: p.sectionI,
    Iy: p.sectionI,
    Iz: p.sectionI,
    sectionType: "TUBE",
    dimensions: { outerWidth: 0.15, outerHeight: 0.15, thickness: 0.008 },
  };

  // Meridional members: crown → first ring
  for (let s = 0; s < p.segments; s++) {
    members.push(
      makeMember(uid("M"), crownId, ringNodes[0][s], memberOverrides),
    );
  }

  // Meridional members: ring-to-ring
  for (let r = 0; r < p.rings - 1; r++) {
    for (let s = 0; s < p.segments; s++) {
      members.push(
        makeMember(
          uid("M"),
          ringNodes[r][s],
          ringNodes[r + 1][s],
          memberOverrides,
        ),
      );
    }
  }

  // Ring (hoop) members
  for (let r = 0; r < p.rings; r++) {
    for (let s = 0; s < p.segments; s++) {
      const next = (s + 1) % p.segments;
      members.push(
        makeMember(
          uid("M"),
          ringNodes[r][s],
          ringNodes[r][next],
          memberOverrides,
        ),
      );
    }
  }

  // Diagonal bracing
  for (let r = 0; r < p.rings - 1; r++) {
    for (let s = 0; s < p.segments; s++) {
      const next = (s + 1) % p.segments;
      members.push(
        makeMember(
          uid("M"),
          ringNodes[r][s],
          ringNodes[r + 1][next],
          memberOverrides,
        ),
      );
    }
  }

  // Base ring supports (pinned)
  const baseRing = ringNodes[p.rings - 1];
  for (const nid of baseRing) {
    supports.push(pinnedSupport(nid));
  }

  return {
    name: "Geodesic Dome",
    description: `Schwedler dome — R=${R}m, rise=${rise.toFixed(1)}m, ${p.rings} rings × ${p.segments} segments`,
    nodes,
    members,
    supports,
    loads,
    metadata: {
      type: "geodesic_dome",
      params: p as unknown as Record<string, number | string | boolean>,
      nodeCount: nodes.length,
      memberCount: members.length,
    },
  };
}

// ──────────────────────────────────────────────────────────────────────────
// 2. RIBBED DOME
// ──────────────────────────────────────────────────────────────────────────

export interface RibbedDomeParams {
  radius: number;
  rise: number;
  ribs: number; // meridional ribs (8–32)
  ringLevels: number; // horizontal rings (3–10)
  ribSectionArea: number;
  ringSectionArea: number;
  gravityLoad: number;
}

const DEFAULT_RIBBED_DOME: RibbedDomeParams = {
  radius: 15,
  rise: 8,
  ribs: 12,
  ringLevels: 5,
  ribSectionArea: 0.008,
  ringSectionArea: 0.005,
  gravityLoad: -4,
};

export function generateRibbedDome(
  params?: Partial<RibbedDomeParams>,
): CurvedStructure {
  resetIds();
  const p = { ...DEFAULT_RIBBED_DOME, ...params };
  const nodes: Node[] = [];
  const members: Member[] = [];
  const supports: CurvedSupport[] = [];
  const loads: CurvedLoad[] = [];

  const Rsphere = (p.radius ** 2 + p.rise ** 2) / (2 * p.rise);
  const yCenter = -(Rsphere - p.rise);
  const thetaBase = Math.asin(Math.min(p.radius / Rsphere, 1));

  // Crown
  const crownId = uid("N");
  nodes.push(makeNode(crownId, 0, p.rise, 0));
  loads.push({ id: uid("L"), nodeId: crownId, fy: p.gravityLoad });

  const ringNodes: string[][] = [];
  for (let r = 1; r <= p.ringLevels; r++) {
    const theta = (r / p.ringLevels) * thetaBase;
    const yRing = yCenter + Rsphere * Math.cos(theta);
    const rRing = Rsphere * Math.sin(theta);
    const ring: string[] = [];
    for (let s = 0; s < p.ribs; s++) {
      const phi = (2 * Math.PI * s) / p.ribs;
      const nid = uid("N");
      nodes.push(
        makeNode(nid, rRing * Math.cos(phi), yRing, rRing * Math.sin(phi)),
      );
      ring.push(nid);
      loads.push({ id: uid("L"), nodeId: nid, fy: p.gravityLoad });
    }
    ringNodes.push(ring);
  }

  // Ribs (meridional)
  const ribOv: Partial<Member> = {
    A: p.ribSectionArea,
    I: 5e-5,
    sectionType: "I-BEAM",
    dimensions: {
      height: 0.3,
      width: 0.15,
      webThickness: 0.008,
      flangeThickness: 0.012,
    },
  };
  for (let s = 0; s < p.ribs; s++) {
    members.push(makeMember(uid("M"), crownId, ringNodes[0][s], ribOv));
    for (let r = 0; r < p.ringLevels - 1; r++) {
      members.push(
        makeMember(uid("M"), ringNodes[r][s], ringNodes[r + 1][s], ribOv),
      );
    }
  }

  // Ring beams
  const ringOv: Partial<Member> = {
    A: p.ringSectionArea,
    I: 2e-5,
    sectionType: "RECTANGLE",
    dimensions: { rectWidth: 0.2, rectHeight: 0.15 },
  };
  for (let r = 0; r < p.ringLevels; r++) {
    for (let s = 0; s < p.ribs; s++) {
      members.push(
        makeMember(
          uid("M"),
          ringNodes[r][s],
          ringNodes[r][(s + 1) % p.ribs],
          ringOv,
        ),
      );
    }
  }

  // Supports
  for (const nid of ringNodes[p.ringLevels - 1])
    supports.push(pinnedSupport(nid));

  return {
    name: "Ribbed Dome",
    description: `Ribbed dome — R=${p.radius}m, rise=${p.rise}m, ${p.ribs} ribs × ${p.ringLevels} rings`,
    nodes,
    members,
    supports,
    loads,
    metadata: {
      type: "ribbed_dome",
      params: p as unknown as Record<string, number | string | boolean>,
      nodeCount: nodes.length,
      memberCount: members.length,
    },
  };
}

// ──────────────────────────────────────────────────────────────────────────
// 3. BARREL VAULT
// ──────────────────────────────────────────────────────────────────────────

export interface BarrelVaultParams {
  span: number; // width (chord) of the vault
  length: number; // depth along the vault axis
  riseRatio: number; // rise / span
  archSegments: number; // divisions along the arch
  lengthBays: number; // divisions along the length
  gravityLoad: number;
}

const DEFAULT_BARREL_VAULT: BarrelVaultParams = {
  span: 20,
  length: 40,
  riseRatio: 0.3,
  archSegments: 12,
  lengthBays: 10,
  gravityLoad: -3,
};

export function generateBarrelVault(
  params?: Partial<BarrelVaultParams>,
): CurvedStructure {
  resetIds();
  const p = { ...DEFAULT_BARREL_VAULT, ...params };
  const nodes: Node[] = [];
  const members: Member[] = [];
  const supports: CurvedSupport[] = [];
  const loads: CurvedLoad[] = [];

  const rise = p.span * p.riseRatio;
  // Circular arch: R = (span²/4 + rise²) / (2*rise)
  const R = (p.span ** 2 / 4 + rise ** 2) / (2 * rise);
  const thetaHalf = Math.asin(p.span / (2 * R));
  const yOffset = -(R - rise);

  // Grid of nodes: arch direction (i) × length direction (j)
  const grid: string[][] = [];
  for (let i = 0; i <= p.archSegments; i++) {
    const theta = -thetaHalf + (2 * thetaHalf * i) / p.archSegments;
    const x = R * Math.sin(theta);
    const y = yOffset + R * Math.cos(theta);
    const row: string[] = [];
    for (let j = 0; j <= p.lengthBays; j++) {
      const z = (p.length * j) / p.lengthBays;
      const nid = uid("N");
      nodes.push(makeNode(nid, x, y, z));
      row.push(nid);
      loads.push({ id: uid("L"), nodeId: nid, fy: p.gravityLoad });
    }
    grid.push(row);
  }

  const archOv: Partial<Member> = {
    sectionType: "TUBE",
    dimensions: { outerWidth: 0.2, outerHeight: 0.2, thickness: 0.01 },
    A: 0.006,
    I: 3e-5,
  };
  const longOv: Partial<Member> = {
    sectionType: "RECTANGLE",
    dimensions: { rectWidth: 0.15, rectHeight: 0.15 },
    A: 0.0225,
    I: 4.2e-5,
  };

  // Arch members (along i)
  for (let i = 0; i < p.archSegments; i++) {
    for (let j = 0; j <= p.lengthBays; j++) {
      members.push(makeMember(uid("M"), grid[i][j], grid[i + 1][j], archOv));
    }
  }

  // Longitudinal members (along j)
  for (let i = 0; i <= p.archSegments; i++) {
    for (let j = 0; j < p.lengthBays; j++) {
      members.push(makeMember(uid("M"), grid[i][j], grid[i][j + 1], longOv));
    }
  }

  // Supports: pin both base edges (i=0 and i=archSegments)
  for (let j = 0; j <= p.lengthBays; j++) {
    supports.push(pinnedSupport(grid[0][j]));
    supports.push(pinnedSupport(grid[p.archSegments][j]));
  }

  return {
    name: "Barrel Vault",
    description: `Barrel vault — span=${p.span}m, length=${p.length}m, rise=${rise.toFixed(1)}m`,
    nodes,
    members,
    supports,
    loads,
    metadata: {
      type: "barrel_vault",
      params: p as unknown as Record<string, number | string | boolean>,
      nodeCount: nodes.length,
      memberCount: members.length,
    },
  };
}

// ──────────────────────────────────────────────────────────────────────────
// 4. ARCH (2D or 3D single arch)
// ──────────────────────────────────────────────────────────────────────────

export type ArchProfile = "parabolic" | "circular" | "catenary";

export interface ArchParams {
  span: number;
  rise: number;
  profile: ArchProfile;
  segments: number;
  supportType: "fixed" | "pinned" | "three-hinged";
  gravityLoad: number;
  lateralLoad: number;
  sectionType: "I-BEAM" | "TUBE" | "RECTANGLE";
}

const DEFAULT_ARCH: ArchParams = {
  span: 30,
  rise: 10,
  profile: "parabolic",
  segments: 20,
  supportType: "fixed",
  gravityLoad: -10,
  lateralLoad: 0,
  sectionType: "I-BEAM",
};

function archY(
  profile: ArchProfile,
  x: number,
  span: number,
  rise: number,
): number {
  const xNorm = x / (span / 2); // -1 to +1
  switch (profile) {
    case "parabolic":
      return rise * (1 - xNorm ** 2);
    case "circular": {
      const R = (span ** 2 / 4 + rise ** 2) / (2 * rise);
      const yc = -(R - rise);
      const dx = x;
      const val = R ** 2 - dx ** 2;
      return yc + Math.sqrt(Math.max(val, 0));
    }
    case "catenary": {
      // y = rise * (cosh(a) - cosh(a*xNorm)) / (cosh(a) - 1)
      const a = 2.0; // catenary parameter
      return (
        (rise * (Math.cosh(a) - Math.cosh(a * xNorm))) / (Math.cosh(a) - 1)
      );
    }
  }
}

export function generateArch(params?: Partial<ArchParams>): CurvedStructure {
  resetIds();
  const p = { ...DEFAULT_ARCH, ...params };
  const nodes: Node[] = [];
  const members: Member[] = [];
  const supports: CurvedSupport[] = [];
  const loads: CurvedLoad[] = [];

  const half = p.span / 2;
  const nodeIds: string[] = [];

  for (let i = 0; i <= p.segments; i++) {
    const x = -half + (p.span * i) / p.segments;
    const y = archY(p.profile, x, p.span, p.rise);
    const nid = uid("N");
    nodes.push(makeNode(nid, x, y, 0));
    nodeIds.push(nid);
    loads.push({
      id: uid("L"),
      nodeId: nid,
      fy: p.gravityLoad,
      fx: p.lateralLoad,
    });
  }

  const sectionOv: Partial<Member> =
    p.sectionType === "I-BEAM"
      ? {
          sectionType: "I-BEAM",
          dimensions: {
            height: 0.5,
            width: 0.25,
            webThickness: 0.012,
            flangeThickness: 0.02,
          },
          A: 0.015,
          I: 4e-4,
        }
      : p.sectionType === "TUBE"
        ? {
            sectionType: "TUBE",
            dimensions: { outerWidth: 0.4, outerHeight: 0.4, thickness: 0.02 },
            A: 0.024,
            I: 5e-4,
          }
        : {
            sectionType: "RECTANGLE",
            dimensions: { rectWidth: 0.4, rectHeight: 0.6 },
            A: 0.24,
            I: 7.2e-3,
          };

  for (let i = 0; i < p.segments; i++) {
    members.push(makeMember(uid("M"), nodeIds[i], nodeIds[i + 1], sectionOv));
  }

  // Supports
  if (p.supportType === "fixed") {
    supports.push(fixedSupport(nodeIds[0]));
    supports.push(fixedSupport(nodeIds[p.segments]));
  } else if (p.supportType === "pinned") {
    supports.push(pinnedSupport(nodeIds[0]));
    supports.push(pinnedSupport(nodeIds[p.segments]));
  } else {
    // Three-hinged: pinned base + moment release at crown (midpoint)
    supports.push(pinnedSupport(nodeIds[0]));
    supports.push(pinnedSupport(nodeIds[p.segments]));
    // Crown hinge via member releases (handled by caller or we mark the crown member)
  }

  return {
    name: `${p.profile.charAt(0).toUpperCase() + p.profile.slice(1)} Arch`,
    description: `${p.profile} arch — span=${p.span}m, rise=${p.rise}m, ${p.segments} segments, ${p.supportType} supports`,
    nodes,
    members,
    supports,
    loads,
    metadata: {
      type: "arch",
      params: p as unknown as Record<string, number | string | boolean>,
      nodeCount: nodes.length,
      memberCount: members.length,
    },
  };
}

// ──────────────────────────────────────────────────────────────────────────
// 5. TUNNEL (horseshoe / circular / D-shape cross-section, extruded)
// ──────────────────────────────────────────────────────────────────────────

export type TunnelProfile = "circular" | "horseshoe" | "D-shape";

export interface TunnelParams {
  diameter: number; // inner diameter / width
  length: number;
  profile: TunnelProfile;
  circumSegments: number;
  lengthBays: number;
  liningThickness: number; // m
  gravityLoad: number;
}

const DEFAULT_TUNNEL: TunnelParams = {
  diameter: 10,
  length: 50,
  profile: "circular",
  circumSegments: 16,
  lengthBays: 12,
  liningThickness: 0.3,
  gravityLoad: -20,
};

export function generateTunnel(
  params?: Partial<TunnelParams>,
): CurvedStructure {
  resetIds();
  const p = { ...DEFAULT_TUNNEL, ...params };
  const nodes: Node[] = [];
  const members: Member[] = [];
  const supports: CurvedSupport[] = [];
  const loads: CurvedLoad[] = [];

  const R = p.diameter / 2;

  // Angle range depends on profile
  let angleStart: number, angleEnd: number;
  switch (p.profile) {
    case "circular":
      angleStart = 0;
      angleEnd = 2 * Math.PI;
      break;
    case "horseshoe":
      // Semicircle top + vertical walls
      angleStart = 0;
      angleEnd = Math.PI;
      break;
    case "D-shape":
      angleStart = 0;
      angleEnd = Math.PI;
      break;
    default:
      angleStart = 0;
      angleEnd = 2 * Math.PI;
  }

  const liningA = p.liningThickness * 1.0; // per-meter strip area
  const liningI = (1.0 * p.liningThickness ** 3) / 12;
  const concreteOv: Partial<Member> = {
    E: 25e6,
    G: 10.4e6,
    A: liningA,
    I: liningI,
    Iy: liningI,
    Iz: liningI,
    sectionType: "RECTANGLE",
    dimensions: { rectWidth: 1.0, rectHeight: p.liningThickness },
  };

  // Generate cross-section rings along the tunnel length
  const rings: string[][] = [];
  for (let j = 0; j <= p.lengthBays; j++) {
    const z = (p.length * j) / p.lengthBays;
    const ring: string[] = [];

    if (p.profile === "circular") {
      // Full circle
      for (let i = 0; i < p.circumSegments; i++) {
        const theta =
          angleStart + ((angleEnd - angleStart) * i) / p.circumSegments;
        const x = R * Math.cos(theta);
        const y = R * Math.sin(theta);
        const nid = uid("N");
        nodes.push(makeNode(nid, x, y, z));
        ring.push(nid);
        loads.push({ id: uid("L"), nodeId: nid, fy: p.gravityLoad });
      }
    } else {
      // Horseshoe / D-shape: semicircle + walls
      const arcSegments = Math.ceil(p.circumSegments * 0.6);
      const wallSegments = Math.floor((p.circumSegments - arcSegments) / 2);

      // Left wall (bottom to spring point)
      for (let w = 0; w < wallSegments; w++) {
        const y = (-R * w) / wallSegments;
        const nid = uid("N");
        nodes.push(makeNode(nid, -R, y, z));
        ring.push(nid);
        loads.push({ id: uid("L"), nodeId: nid, fy: p.gravityLoad });
      }

      // Arc (semicircle from left to right)
      for (let i = 0; i <= arcSegments; i++) {
        const theta = Math.PI - (Math.PI * i) / arcSegments;
        const x = R * Math.cos(theta);
        const y = R * Math.sin(theta);
        const nid = uid("N");
        nodes.push(makeNode(nid, x, y, z));
        ring.push(nid);
        loads.push({ id: uid("L"), nodeId: nid, fy: p.gravityLoad });
      }

      // Right wall (spring point to bottom)
      for (let w = 1; w <= wallSegments; w++) {
        const y = (-R * w) / wallSegments;
        const nid = uid("N");
        nodes.push(makeNode(nid, R, y, z));
        ring.push(nid);
        loads.push({ id: uid("L"), nodeId: nid, fy: p.gravityLoad });
      }
    }
    rings.push(ring);
  }

  // Circumferential members (within each ring)
  for (const ring of rings) {
    for (let i = 0; i < ring.length - 1; i++) {
      members.push(makeMember(uid("M"), ring[i], ring[i + 1], concreteOv));
    }
    if (p.profile === "circular") {
      // Close the ring
      members.push(
        makeMember(uid("M"), ring[ring.length - 1], ring[0], concreteOv),
      );
    }
  }

  // Longitudinal members (ring to ring)
  for (let j = 0; j < rings.length - 1; j++) {
    const segCount = Math.min(rings[j].length, rings[j + 1].length);
    for (let i = 0; i < segCount; i++) {
      members.push(
        makeMember(uid("M"), rings[j][i], rings[j + 1][i], concreteOv),
      );
    }
  }

  // Supports: fix invert (bottom) nodes of first and last rings
  for (const j of [0, rings.length - 1]) {
    const ring = rings[j];
    if (p.profile === "circular") {
      // Fix bottom quarter of the ring
      const quarter = Math.floor(ring.length / 4);
      for (let i = ring.length - quarter; i < ring.length; i++) {
        supports.push(fixedSupport(ring[i]));
      }
      for (let i = 0; i <= quarter; i++) {
        supports.push(fixedSupport(ring[i]));
      }
    } else {
      // Fix bottom nodes (walls)
      supports.push(fixedSupport(ring[0]));
      supports.push(fixedSupport(ring[ring.length - 1]));
    }
  }

  return {
    name: `${p.profile.charAt(0).toUpperCase() + p.profile.slice(1)} Tunnel`,
    description: `${p.profile} tunnel — Ø${p.diameter}m, length=${p.length}m, lining=${p.liningThickness}m`,
    nodes,
    members,
    supports,
    loads,
    metadata: {
      type: "tunnel",
      params: p as unknown as Record<string, number | string | boolean>,
      nodeCount: nodes.length,
      memberCount: members.length,
    },
  };
}

// ──────────────────────────────────────────────────────────────────────────
// 6. SPHERE / HEMISPHERE MESH
// ──────────────────────────────────────────────────────────────────────────

export interface SphereParams {
  radius: number;
  latDivisions: number; // latitude (pole to pole)
  lonDivisions: number; // longitude
  hemisphere: boolean; // true = only upper half
  gravityLoad: number;
}

const DEFAULT_SPHERE: SphereParams = {
  radius: 10,
  latDivisions: 8,
  lonDivisions: 16,
  hemisphere: true,
  gravityLoad: -3,
};

export function generateSphere(
  params?: Partial<SphereParams>,
): CurvedStructure {
  resetIds();
  const p = { ...DEFAULT_SPHERE, ...params };
  const nodes: Node[] = [];
  const members: Member[] = [];
  const supports: CurvedSupport[] = [];
  const loads: CurvedLoad[] = [];

  const latStart = p.hemisphere ? 0 : -Math.PI / 2;
  const latEnd = Math.PI / 2;
  const latSteps = p.hemisphere ? p.latDivisions : p.latDivisions * 2;

  // North pole
  const northId = uid("N");
  nodes.push(makeNode(northId, 0, p.radius, 0));
  loads.push({ id: uid("L"), nodeId: northId, fy: p.gravityLoad });

  const latRings: string[][] = [];
  for (let lat = 1; lat <= latSteps; lat++) {
    const phi = latEnd - ((latEnd - latStart) * lat) / latSteps;
    const y = p.radius * Math.sin(phi);
    const rRing = p.radius * Math.cos(phi);
    const ring: string[] = [];
    for (let lon = 0; lon < p.lonDivisions; lon++) {
      const theta = (2 * Math.PI * lon) / p.lonDivisions;
      const nid = uid("N");
      nodes.push(
        makeNode(nid, rRing * Math.cos(theta), y, rRing * Math.sin(theta)),
      );
      ring.push(nid);
      loads.push({ id: uid("L"), nodeId: nid, fy: p.gravityLoad });
    }
    latRings.push(ring);
  }

  const ov: Partial<Member> = {
    sectionType: "TUBE",
    dimensions: { outerWidth: 0.15, outerHeight: 0.15, thickness: 0.008 },
    A: 0.004,
    I: 1e-5,
  };

  // North pole → first ring
  for (let lon = 0; lon < p.lonDivisions; lon++) {
    members.push(makeMember(uid("M"), northId, latRings[0][lon], ov));
  }

  // Meridional
  for (let lat = 0; lat < latRings.length - 1; lat++) {
    for (let lon = 0; lon < p.lonDivisions; lon++) {
      members.push(
        makeMember(uid("M"), latRings[lat][lon], latRings[lat + 1][lon], ov),
      );
    }
  }

  // Ring (hoop)
  for (const ring of latRings) {
    for (let lon = 0; lon < p.lonDivisions; lon++) {
      members.push(
        makeMember(uid("M"), ring[lon], ring[(lon + 1) % p.lonDivisions], ov),
      );
    }
  }

  // Supports: equator/base ring
  const baseRing = latRings[latRings.length - 1];
  for (const nid of baseRing) supports.push(pinnedSupport(nid));

  return {
    name: p.hemisphere ? "Hemisphere" : "Sphere",
    description: `${p.hemisphere ? "Hemisphere" : "Sphere"} — R=${p.radius}m, ${latSteps} lat × ${p.lonDivisions} lon`,
    nodes,
    members,
    supports,
    loads,
    metadata: {
      type: "sphere",
      params: p as unknown as Record<string, number | string | boolean>,
      nodeCount: nodes.length,
      memberCount: members.length,
    },
  };
}

// ──────────────────────────────────────────────────────────────────────────
// 7. CYLINDRICAL TANK / SILO
// ──────────────────────────────────────────────────────────────────────────

export interface CylinderParams {
  radius: number;
  height: number;
  circumSegments: number;
  heightLevels: number;
  wallThickness: number;
  hasConicalRoof: boolean;
  roofAngle: number; // degrees from horizontal
  gravityLoad: number;
}

const DEFAULT_CYLINDER: CylinderParams = {
  radius: 8,
  height: 15,
  circumSegments: 16,
  heightLevels: 8,
  wallThickness: 0.25,
  hasConicalRoof: true,
  roofAngle: 15,
  gravityLoad: -5,
};

export function generateCylinder(
  params?: Partial<CylinderParams>,
): CurvedStructure {
  resetIds();
  const p = { ...DEFAULT_CYLINDER, ...params };
  const nodes: Node[] = [];
  const members: Member[] = [];
  const supports: CurvedSupport[] = [];
  const loads: CurvedLoad[] = [];

  const concreteOv: Partial<Member> = {
    E: 25e6,
    G: 10.4e6,
    A: p.wallThickness * 1.0,
    I: (1.0 * p.wallThickness ** 3) / 12,
    sectionType: "RECTANGLE",
    dimensions: { rectWidth: 1.0, rectHeight: p.wallThickness },
  };

  // Wall rings
  const rings: string[][] = [];
  for (let h = 0; h <= p.heightLevels; h++) {
    const y = (p.height * h) / p.heightLevels;
    const ring: string[] = [];
    for (let s = 0; s < p.circumSegments; s++) {
      const theta = (2 * Math.PI * s) / p.circumSegments;
      const nid = uid("N");
      nodes.push(
        makeNode(
          nid,
          p.radius * Math.cos(theta),
          y,
          p.radius * Math.sin(theta),
        ),
      );
      ring.push(nid);
      loads.push({ id: uid("L"), nodeId: nid, fy: p.gravityLoad });
    }
    rings.push(ring);
  }

  // Hoop members
  for (const ring of rings) {
    for (let s = 0; s < p.circumSegments; s++) {
      members.push(
        makeMember(
          uid("M"),
          ring[s],
          ring[(s + 1) % p.circumSegments],
          concreteOv,
        ),
      );
    }
  }

  // Vertical members
  for (let h = 0; h < p.heightLevels; h++) {
    for (let s = 0; s < p.circumSegments; s++) {
      members.push(
        makeMember(uid("M"), rings[h][s], rings[h + 1][s], concreteOv),
      );
    }
  }

  // Conical roof
  if (p.hasConicalRoof) {
    const roofRise = p.radius * Math.tan((p.roofAngle * Math.PI) / 180);
    const apexId = uid("N");
    nodes.push(makeNode(apexId, 0, p.height + roofRise, 0));
    loads.push({ id: uid("L"), nodeId: apexId, fy: p.gravityLoad });

    const topRing = rings[p.heightLevels];
    for (let s = 0; s < p.circumSegments; s++) {
      members.push(
        makeMember(uid("M"), topRing[s], apexId, {
          ...concreteOv,
          sectionType: "TUBE",
          dimensions: { outerWidth: 0.15, outerHeight: 0.15, thickness: 0.008 },
          A: 0.004,
          I: 1e-5,
        }),
      );
    }
  }

  // Base ring fixed
  for (const nid of rings[0]) supports.push(fixedSupport(nid));

  return {
    name: "Cylindrical Tank",
    description: `Cylindrical tank — R=${p.radius}m, H=${p.height}m${p.hasConicalRoof ? ", conical roof" : ""}`,
    nodes,
    members,
    supports,
    loads,
    metadata: {
      type: "cylinder",
      params: p as unknown as Record<string, number | string | boolean>,
      nodeCount: nodes.length,
      memberCount: members.length,
    },
  };
}

// ──────────────────────────────────────────────────────────────────────────
// 8. COOLING TOWER (hyperboloid of revolution)
// ──────────────────────────────────────────────────────────────────────────

export interface CoolingTowerParams {
  baseRadius: number;
  throatRadius: number;
  topRadius: number;
  totalHeight: number;
  throatHeight: number; // height of throat (minimum radius)
  circumSegments: number;
  heightLevels: number;
  shellThickness: number;
  gravityLoad: number;
}

const DEFAULT_COOLING_TOWER: CoolingTowerParams = {
  baseRadius: 35,
  throatRadius: 25,
  topRadius: 28,
  totalHeight: 100,
  throatHeight: 70,
  circumSegments: 24,
  heightLevels: 15,
  shellThickness: 0.2,
  gravityLoad: -8,
};

export function generateCoolingTower(
  params?: Partial<CoolingTowerParams>,
): CurvedStructure {
  resetIds();
  const p = { ...DEFAULT_COOLING_TOWER, ...params };
  const nodes: Node[] = [];
  const members: Member[] = [];
  const supports: CurvedSupport[] = [];
  const loads: CurvedLoad[] = [];

  // Hyperboloid profile: r(y) interpolated as smooth curve through base → throat → top
  function radiusAtHeight(y: number): number {
    if (y <= p.throatHeight) {
      // Below throat: hyperbolic from base to throat
      const t = y / p.throatHeight;
      // Cosine interpolation for smooth curve
      const blend = 0.5 * (1 - Math.cos(Math.PI * t));
      return p.baseRadius + (p.throatRadius - p.baseRadius) * blend;
    } else {
      // Above throat: flare out to top
      const t = (y - p.throatHeight) / (p.totalHeight - p.throatHeight);
      const blend = 0.5 * (1 - Math.cos(Math.PI * t));
      return p.throatRadius + (p.topRadius - p.throatRadius) * blend;
    }
  }

  const shellOv: Partial<Member> = {
    E: 30e6,
    G: 12.5e6,
    A: p.shellThickness * 1.0,
    I: (1.0 * p.shellThickness ** 3) / 12,
    sectionType: "RECTANGLE",
    dimensions: { rectWidth: 1.0, rectHeight: p.shellThickness },
  };

  const rings: string[][] = [];
  for (let h = 0; h <= p.heightLevels; h++) {
    const y = (p.totalHeight * h) / p.heightLevels;
    const r = radiusAtHeight(y);
    const ring: string[] = [];
    for (let s = 0; s < p.circumSegments; s++) {
      const theta = (2 * Math.PI * s) / p.circumSegments;
      const nid = uid("N");
      nodes.push(makeNode(nid, r * Math.cos(theta), y, r * Math.sin(theta)));
      ring.push(nid);
      loads.push({ id: uid("L"), nodeId: nid, fy: p.gravityLoad });
    }
    rings.push(ring);
  }

  // Hoop + vertical + diagonal members
  for (let h = 0; h <= p.heightLevels; h++) {
    for (let s = 0; s < p.circumSegments; s++) {
      // Hoop
      members.push(
        makeMember(
          uid("M"),
          rings[h][s],
          rings[h][(s + 1) % p.circumSegments],
          shellOv,
        ),
      );
      // Vertical
      if (h < p.heightLevels) {
        members.push(
          makeMember(uid("M"), rings[h][s], rings[h + 1][s], shellOv),
        );
        // Diagonal bracing
        members.push(
          makeMember(
            uid("M"),
            rings[h][s],
            rings[h + 1][(s + 1) % p.circumSegments],
            {
              ...shellOv,
              A: shellOv.A! * 0.5,
              I: shellOv.I! * 0.3,
            },
          ),
        );
      }
    }
  }

  // Base ring on columns (V-supports) — simplified as fixed
  for (const nid of rings[0]) supports.push(fixedSupport(nid));

  return {
    name: "Cooling Tower",
    description: `Hyperboloid cooling tower — H=${p.totalHeight}m, base R=${p.baseRadius}m, throat R=${p.throatRadius}m`,
    nodes,
    members,
    supports,
    loads,
    metadata: {
      type: "cooling_tower",
      params: p as unknown as Record<string, number | string | boolean>,
      nodeCount: nodes.length,
      memberCount: members.length,
    },
  };
}

// ──────────────────────────────────────────────────────────────────────────
// 9. HELICAL / SPIRAL STAIRCASE
// ──────────────────────────────────────────────────────────────────────────

export interface HelicalParams {
  innerRadius: number; // central column radius
  outerRadius: number; // stair outer edge
  totalHeight: number;
  turns: number; // number of full revolutions
  stepsPerTurn: number; // typically 12–20
  gravityLoad: number;
}

const DEFAULT_HELICAL: HelicalParams = {
  innerRadius: 0.5,
  outerRadius: 2.5,
  totalHeight: 9,
  turns: 3,
  stepsPerTurn: 16,
  gravityLoad: -5,
};

export function generateHelicalStaircase(
  params?: Partial<HelicalParams>,
): CurvedStructure {
  resetIds();
  const p = { ...DEFAULT_HELICAL, ...params };
  const nodes: Node[] = [];
  const members: Member[] = [];
  const supports: CurvedSupport[] = [];
  const loads: CurvedLoad[] = [];

  const totalSteps = Math.round(p.turns * p.stepsPerTurn);
  const stepHeight = p.totalHeight / totalSteps;
  const deltaTheta = (2 * Math.PI) / p.stepsPerTurn;

  // Inner (central column) and outer edge nodes
  const innerNodes: string[] = [];
  const outerNodes: string[] = [];

  for (let i = 0; i <= totalSteps; i++) {
    const theta = i * deltaTheta;
    const y = i * stepHeight;
    const inId = uid("N");
    const outId = uid("N");
    nodes.push(
      makeNode(
        inId,
        p.innerRadius * Math.cos(theta),
        y,
        p.innerRadius * Math.sin(theta),
      ),
    );
    nodes.push(
      makeNode(
        outId,
        p.outerRadius * Math.cos(theta),
        y,
        p.outerRadius * Math.sin(theta),
      ),
    );
    innerNodes.push(inId);
    outerNodes.push(outId);
    loads.push({ id: uid("L"), nodeId: inId, fy: p.gravityLoad * 0.3 });
    loads.push({ id: uid("L"), nodeId: outId, fy: p.gravityLoad * 0.7 });
  }

  const stringerOv: Partial<Member> = {
    sectionType: "C-CHANNEL",
    dimensions: {
      channelHeight: 0.25,
      channelWidth: 0.1,
      channelThickness: 0.01,
    },
    A: 0.004,
    I: 2e-5,
  };
  const treadOv: Partial<Member> = {
    sectionType: "RECTANGLE",
    dimensions: { rectWidth: 0.3, rectHeight: 0.02 },
    A: 0.006,
    I: 2e-8,
  };

  // Inner stringer, outer stringer, treads
  for (let i = 0; i < totalSteps; i++) {
    members.push(
      makeMember(uid("M"), innerNodes[i], innerNodes[i + 1], stringerOv),
    );
    members.push(
      makeMember(uid("M"), outerNodes[i], outerNodes[i + 1], stringerOv),
    );
    members.push(makeMember(uid("M"), innerNodes[i], outerNodes[i], treadOv));
  }
  // Last tread
  members.push(
    makeMember(
      uid("M"),
      innerNodes[totalSteps],
      outerNodes[totalSteps],
      treadOv,
    ),
  );

  // Fix base and top
  supports.push(fixedSupport(innerNodes[0]));
  supports.push(fixedSupport(outerNodes[0]));
  supports.push(pinnedSupport(innerNodes[totalSteps]));
  supports.push(pinnedSupport(outerNodes[totalSteps]));

  // Intermediate pinned supports at each floor (full turn)
  for (let t = 1; t < p.turns; t++) {
    const idx = t * p.stepsPerTurn;
    if (idx < totalSteps) {
      supports.push(pinnedSupport(innerNodes[idx]));
    }
  }

  return {
    name: "Helical Staircase",
    description: `Spiral stair — R_i=${p.innerRadius}m, R_o=${p.outerRadius}m, H=${p.totalHeight}m, ${p.turns} turns`,
    nodes,
    members,
    supports,
    loads,
    metadata: {
      type: "helical_staircase",
      params: p as unknown as Record<string, number | string | boolean>,
      nodeCount: nodes.length,
      memberCount: members.length,
    },
  };
}

// ──────────────────────────────────────────────────────────────────────────
// 10. HYPERBOLIC PARABOLOID (Hypar) SHELL
// ──────────────────────────────────────────────────────────────────────────

export interface HyparParams {
  sideLength: number; // plan dimension (square)
  rise: number; // max height difference
  gridDivisions: number; // divisions per side
  gravityLoad: number;
}

const DEFAULT_HYPAR: HyparParams = {
  sideLength: 20,
  rise: 5,
  gridDivisions: 10,
  gravityLoad: -3,
};

export function generateHypar(params?: Partial<HyparParams>): CurvedStructure {
  resetIds();
  const p = { ...DEFAULT_HYPAR, ...params };
  const nodes: Node[] = [];
  const members: Member[] = [];
  const supports: CurvedSupport[] = [];
  const loads: CurvedLoad[] = [];

  const half = p.sideLength / 2;
  const grid: string[][] = [];

  // z = (rise / (half²)) * x * y   (saddle surface)
  for (let i = 0; i <= p.gridDivisions; i++) {
    const row: string[] = [];
    const xVal = -half + (p.sideLength * i) / p.gridDivisions;
    for (let j = 0; j <= p.gridDivisions; j++) {
      const zVal = -half + (p.sideLength * j) / p.gridDivisions;
      const yVal = (p.rise / half ** 2) * xVal * zVal;
      const nid = uid("N");
      nodes.push(makeNode(nid, xVal, yVal, zVal));
      row.push(nid);
      loads.push({ id: uid("L"), nodeId: nid, fy: p.gravityLoad });
    }
    grid.push(row);
  }

  const shellOv: Partial<Member> = {
    sectionType: "TUBE",
    dimensions: { outerWidth: 0.12, outerHeight: 0.12, thickness: 0.006 },
    A: 0.002,
    I: 5e-6,
  };

  // Grid members (both directions + diagonals)
  for (let i = 0; i <= p.gridDivisions; i++) {
    for (let j = 0; j <= p.gridDivisions; j++) {
      if (i < p.gridDivisions)
        members.push(makeMember(uid("M"), grid[i][j], grid[i + 1][j], shellOv));
      if (j < p.gridDivisions)
        members.push(makeMember(uid("M"), grid[i][j], grid[i][j + 1], shellOv));
      if (i < p.gridDivisions && j < p.gridDivisions) {
        members.push(
          makeMember(uid("M"), grid[i][j], grid[i + 1][j + 1], shellOv),
        );
      }
    }
  }

  // Support corner columns (typical for hypar roofs)
  const n = p.gridDivisions;
  supports.push(pinnedSupport(grid[0][0]));
  supports.push(pinnedSupport(grid[0][n]));
  supports.push(pinnedSupport(grid[n][0]));
  supports.push(pinnedSupport(grid[n][n]));

  return {
    name: "Hyperbolic Paraboloid",
    description: `Hypar shell — ${p.sideLength}m × ${p.sideLength}m, rise=${p.rise}m`,
    nodes,
    members,
    supports,
    loads,
    metadata: {
      type: "hypar",
      params: p as unknown as Record<string, number | string | boolean>,
      nodeCount: nodes.length,
      memberCount: members.length,
    },
  };
}

// ──────────────────────────────────────────────────────────────────────────
// MASTER TEMPLATE INDEX
// ──────────────────────────────────────────────────────────────────────────

export interface CurvedTemplate {
  id: string;
  name: string;
  category: "dome" | "vault" | "arch" | "tunnel" | "surface" | "tower" | "misc";
  description: string;
  generator: (params?: Record<string, unknown>) => CurvedStructure;
   
  defaultParams: Record<string, any>;
  icon: string; // lucide icon name
}

export const CURVED_TEMPLATES: CurvedTemplate[] = [
  {
    id: "geodesic_dome",
    name: "Geodesic Dome",
    category: "dome",
    description:
      "Schwedler-type dome with meridional ribs, ring beams, and diagonal bracing",
    generator: generateGeodesicDome,
    defaultParams: DEFAULT_DOME,
    icon: "Globe",
  },
  {
    id: "ribbed_dome",
    name: "Ribbed Dome",
    category: "dome",
    description:
      "Traditional ribbed dome with meridional I-beam ribs and ring beams",
    generator: generateRibbedDome,
    defaultParams: DEFAULT_RIBBED_DOME,
    icon: "CircleDot",
  },
  {
    id: "barrel_vault",
    name: "Barrel Vault",
    category: "vault",
    description: "Cylindrical shell vault approximated by frame grid",
    generator: generateBarrelVault,
    defaultParams: DEFAULT_BARREL_VAULT,
    icon: "ArrowUpFromLine",
  },
  {
    id: "parabolic_arch",
    name: "Parabolic Arch",
    category: "arch",
    description:
      "Parabolic arch with configurable supports (fixed/pinned/3-hinged)",
    generator: (p?: Record<string, unknown>) => generateArch({ ...p, profile: "parabolic" } as Partial<ArchParams>),
    defaultParams: { ...DEFAULT_ARCH, profile: "parabolic" },
    icon: "MountainSnow",
  },
  {
    id: "circular_arch",
    name: "Circular Arch",
    category: "arch",
    description: "Circular arc arch with constant radius of curvature",
    generator: (p?: Record<string, unknown>) => generateArch({ ...p, profile: "circular" } as Partial<ArchParams>),
    defaultParams: { ...DEFAULT_ARCH, profile: "circular" },
    icon: "Rainbow",
  },
  {
    id: "catenary_arch",
    name: "Catenary Arch",
    category: "arch",
    description:
      "Catenary (ideal arch) — carries uniform load in pure compression",
    generator: (p?: Record<string, unknown>) => generateArch({ ...p, profile: "catenary" } as Partial<ArchParams>),
    defaultParams: { ...DEFAULT_ARCH, profile: "catenary" },
    icon: "Spline",
  },
  {
    id: "circular_tunnel",
    name: "Circular Tunnel",
    category: "tunnel",
    description: "Full-circle tunnel lining with longitudinal members",
    generator: (p?: Record<string, unknown>) => generateTunnel({ ...p, profile: "circular" } as Partial<TunnelParams>),
    defaultParams: { ...DEFAULT_TUNNEL, profile: "circular" },
    icon: "Circle",
  },
  {
    id: "horseshoe_tunnel",
    name: "Horseshoe Tunnel",
    category: "tunnel",
    description: "Horseshoe profile tunnel (semicircle + vertical walls)",
    generator: (p?: Record<string, unknown>) => generateTunnel({ ...p, profile: "horseshoe" } as Partial<TunnelParams>),
    defaultParams: { ...DEFAULT_TUNNEL, profile: "horseshoe" },
    icon: "Disc3",
  },
  {
    id: "hemisphere",
    name: "Hemisphere",
    category: "dome",
    description: "Hemisphere mesh with meridional and ring members",
    generator: (p?: Record<string, unknown>) => generateSphere({ ...p, hemisphere: true } as Partial<SphereParams>),
    defaultParams: { ...DEFAULT_SPHERE, hemisphere: true },
    icon: "Cloudy",
  },
  {
    id: "full_sphere",
    name: "Full Sphere",
    category: "surface",
    description: "Complete spherical frame mesh (tank, pressure vessel)",
    generator: (p?: Record<string, unknown>) => generateSphere({ ...p, hemisphere: false } as Partial<SphereParams>),
    defaultParams: { ...DEFAULT_SPHERE, hemisphere: false },
    icon: "Globe2",
  },
  {
    id: "cylindrical_tank",
    name: "Cylindrical Tank / Silo",
    category: "tower",
    description: "Cylindrical shell with optional conical roof for silos/tanks",
    generator: generateCylinder,
    defaultParams: DEFAULT_CYLINDER,
    icon: "Container",
  },
  {
    id: "cooling_tower",
    name: "Cooling Tower",
    category: "tower",
    description:
      "Hyperboloid of revolution shell (natural-draft cooling tower)",
    generator: generateCoolingTower,
    defaultParams: DEFAULT_COOLING_TOWER,
    icon: "Factory",
  },
  {
    id: "helical_staircase",
    name: "Helical Staircase",
    category: "misc",
    description: "Spiral staircase with inner/outer stringers and treads",
    generator: generateHelicalStaircase,
    defaultParams: DEFAULT_HELICAL,
    icon: "IterationCw",
  },
  {
    id: "hypar_shell",
    name: "Hyperbolic Paraboloid",
    category: "surface",
    description: "Saddle-surface (hypar) roof shell with corner supports",
    generator: generateHypar,
    defaultParams: DEFAULT_HYPAR,
    icon: "Waves",
  },
];

/** Get a curved structure template by ID */
export function getCurvedTemplate(id: string): CurvedTemplate | undefined {
  return CURVED_TEMPLATES.find((t) => t.id === id);
}

/** Generate a curved structure by template ID with optional parameter overrides */
export function generateCurvedStructure(
  templateId: string,
  params?: Record<string, unknown>,
): CurvedStructure | null {
  const tpl = getCurvedTemplate(templateId);
  if (!tpl) return null;
  return tpl.generator(params);
}
