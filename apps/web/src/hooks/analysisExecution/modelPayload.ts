import type { Member, MemberLoad, Node, NodeLoad, Plate } from "../../store/model";
import { buildRotation3x3 } from "../../utils/memberLoadFEF";

export interface AnalysisNodePayload {
  id: string;
  x: number;
  y: number;
  z: number;
  restraints?: Node["restraints"];
  support: "fixed" | "pinned" | "roller_x" | "none";
}

export interface AnalysisMemberPayload {
  id: string;
  startNodeId: string;
  endNodeId: string;
  E: number;
  G: number;
  A: number;
  Iy: number;
  Iz: number;
  J: number;
  I: number;
  betaAngle: number;
  rho: number;
  releases?: Member["releases"];
}

export interface EquivalentNodalLoad {
  node_id: string;
  fx: number;
  fy: number;
  fz: number;
  mx: number;
  my: number;
  mz: number;
}

function deriveSupportType(node: Node): AnalysisNodePayload["support"] {
  const r = node.restraints;
  if (!r) return "none";

  if (r.fx && r.fy && r.fz && r.mx && r.my && r.mz) {
    return "fixed";
  }

  if (r.fx && r.fy && r.fz) {
    return "pinned";
  }

  if (r.fy) {
    return "roller_x";
  }

  return "none";
}

export function buildAnalysisNodePayload(nodes: Map<string, Node>): AnalysisNodePayload[] {
  return Array.from(nodes.values()).map((node) => ({
    id: node.id,
    x: node.x,
    y: node.y,
    z: node.z,
    restraints: node.restraints,
    support: deriveSupportType(node),
  }));
}

export function buildAnalysisMemberPayload(members: Map<string, Member>): AnalysisMemberPayload[] {
  return Array.from(members.values()).map((member) => {
    const E = member.E ?? 200e6;
    const G = member.G ?? E / (2 * (1 + 0.3));
    const I = member.I ?? 1e-4;
    const Iy = member.Iy ?? I;
    const Iz = member.Iz ?? I;
    const J = member.J ?? Iy + Iz;

    return {
      id: member.id,
      startNodeId: member.startNodeId,
      endNodeId: member.endNodeId,
      E,
      G,
      A: member.A ?? 0.01,
      Iy,
      Iz,
      J,
      I,
      betaAngle: member.betaAngle ?? 0,
      rho: member.rho ?? 7850,
      releases: member.releases,
    };
  });
}

export function buildEquivalentNodalLoadsFromMemberPointLoads(
  memberPointLoads: MemberLoad[],
  membersArray: AnalysisMemberPayload[],
  nodesArray: AnalysisNodePayload[],
): EquivalentNodalLoad[] {
  const equivalentNodalFromMemberPt: EquivalentNodalLoad[] = [];

  for (const mpl of memberPointLoads) {
    const mInfo = membersArray.find((m) => m.id === mpl.memberId);
    if (!mInfo) continue;
    const nd1 = nodesArray.find((n) => n.id === mInfo.startNodeId);
    const nd2 = nodesArray.find((n) => n.id === mInfo.endNodeId);
    if (!nd1 || !nd2) continue;
    const dx = nd2.x - nd1.x;
    const dy = nd2.y - nd1.y;
    const dz = (nd2.z ?? 0) - (nd1.z ?? 0);
    const L = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (L < 1e-12) continue;
    const aRaw = mpl.a ?? 0.5;
    const a = aRaw <= 1.0 ? aRaw * L : aRaw;
    const b = L - a;
    if (mpl.type === "point" && mpl.P) {
      const P = mpl.P * 1000;
      const R1 = (P * b * b * (3 * a + b)) / (L * L * L);
      const R2 = (P * a * a * (a + 3 * b)) / (L * L * L);
      const M1 = (P * a * b * b) / (L * L);
      const M2 = (-P * a * a * b) / (L * L);
      const dir = mpl.direction || "global_y";

      if (dir === "local_y" || dir === "local_z") {
        const T = buildRotation3x3(
          { x: nd1.x, y: nd1.y, z: nd1.z ?? 0 },
          { x: nd2.x, y: nd2.y, z: nd2.z ?? 0 },
        );
        let locF1: number[], locF2: number[], locM1: number[], locM2: number[];
        if (dir === "local_y") {
          locF1 = [0, R1, 0];
          locF2 = [0, R2, 0];
          locM1 = [0, 0, M1];
          locM2 = [0, 0, M2];
        } else {
          locF1 = [0, 0, R1];
          locF2 = [0, 0, R2];
          locM1 = [0, -M1, 0];
          locM2 = [0, -M2, 0];
        }
        const toGlobal = (v: number[]) => [
          T[0][0] * v[0] + T[1][0] * v[1] + T[2][0] * v[2],
          T[0][1] * v[0] + T[1][1] * v[1] + T[2][1] * v[2],
          T[0][2] * v[0] + T[1][2] * v[1] + T[2][2] * v[2],
        ];
        const gF1 = toGlobal(locF1), gF2 = toGlobal(locF2);
        const gM1 = toGlobal(locM1), gM2 = toGlobal(locM2);
        equivalentNodalFromMemberPt.push(
          { node_id: mInfo.startNodeId, fx: gF1[0], fy: gF1[1], fz: gF1[2], mx: gM1[0], my: gM1[1], mz: gM1[2] },
          { node_id: mInfo.endNodeId, fx: gF2[0], fy: gF2[1], fz: gF2[2], mx: gM2[0], my: gM2[1], mz: gM2[2] },
        );
      } else if (dir === "global_y") {
        equivalentNodalFromMemberPt.push(
          { node_id: mInfo.startNodeId, fx: 0, fy: R1, fz: 0, mx: 0, my: 0, mz: M1 },
          { node_id: mInfo.endNodeId, fx: 0, fy: R2, fz: 0, mx: 0, my: 0, mz: M2 },
        );
      } else if (dir === "global_z") {
        equivalentNodalFromMemberPt.push(
          { node_id: mInfo.startNodeId, fx: 0, fy: 0, fz: R1, mx: 0, my: -M1, mz: 0 },
          { node_id: mInfo.endNodeId, fx: 0, fy: 0, fz: R2, mx: 0, my: -M2, mz: 0 },
        );
      } else if (dir === "global_x" || dir === "axial") {
        const R1x = (P * b) / L;
        const R2x = (P * a) / L;
        equivalentNodalFromMemberPt.push(
          { node_id: mInfo.startNodeId, fx: R1x, fy: 0, fz: 0, mx: 0, my: 0, mz: 0 },
          { node_id: mInfo.endNodeId, fx: R2x, fy: 0, fz: 0, mx: 0, my: 0, mz: 0 },
        );
      }
    } else if (mpl.type === "moment" && mpl.M) {
      const Mo = mpl.M * 1000;
      const R1 = (6 * Mo * a * b) / (L * L * L);
      const R2 = -R1;
      const M1 = (Mo * b * (2 * a - b)) / (L * L);
      const M2 = (Mo * a * (2 * b - a)) / (L * L);
      const dir = mpl.direction || "global_z";

      if (dir === "local_y" || dir === "local_z" || dir.includes("local")) {
        const T = buildRotation3x3(
          { x: nd1.x, y: nd1.y, z: nd1.z ?? 0 },
          { x: nd2.x, y: nd2.y, z: nd2.z ?? 0 },
        );
        let locF1: number[], locF2: number[], locM1: number[], locM2: number[];
        if (dir === "local_y") {
          locF1 = [0, 0, R1];
          locF2 = [0, 0, R2];
          locM1 = [0, M1, 0];
          locM2 = [0, M2, 0];
        } else {
          locF1 = [0, R1, 0];
          locF2 = [0, R2, 0];
          locM1 = [0, 0, M1];
          locM2 = [0, 0, M2];
        }
        const toGlobal = (v: number[]) => [
          T[0][0] * v[0] + T[1][0] * v[1] + T[2][0] * v[2],
          T[0][1] * v[0] + T[1][1] * v[1] + T[2][1] * v[2],
          T[0][2] * v[0] + T[1][2] * v[1] + T[2][2] * v[2],
        ];
        const gF1 = toGlobal(locF1), gF2 = toGlobal(locF2);
        const gM1 = toGlobal(locM1), gM2 = toGlobal(locM2);
        equivalentNodalFromMemberPt.push(
          { node_id: mInfo.startNodeId, fx: gF1[0], fy: gF1[1], fz: gF1[2], mx: gM1[0], my: gM1[1], mz: gM1[2] },
          { node_id: mInfo.endNodeId, fx: gF2[0], fy: gF2[1], fz: gF2[2], mx: gM2[0], my: gM2[1], mz: gM2[2] },
        );
      } else if (dir === "global_y") {
        equivalentNodalFromMemberPt.push(
          { node_id: mInfo.startNodeId, fx: 0, fy: 0, fz: R1, mx: 0, my: M1, mz: 0 },
          { node_id: mInfo.endNodeId, fx: 0, fy: 0, fz: R2, mx: 0, my: M2, mz: 0 },
        );
      } else if (dir === "global_x") {
        const Mx1 = (Mo * b) / L;
        const Mx2 = (Mo * a) / L;
        equivalentNodalFromMemberPt.push(
          { node_id: mInfo.startNodeId, fx: 0, fy: 0, fz: 0, mx: Mx1, my: 0, mz: 0 },
          { node_id: mInfo.endNodeId, fx: 0, fy: 0, fz: 0, mx: Mx2, my: 0, mz: 0 },
        );
      } else {
        equivalentNodalFromMemberPt.push(
          { node_id: mInfo.startNodeId, fx: 0, fy: R1, fz: 0, mx: 0, my: 0, mz: M1 },
          { node_id: mInfo.endNodeId, fx: 0, fy: R2, fz: 0, mx: 0, my: 0, mz: M2 },
        );
      }
    }
  }

  return equivalentNodalFromMemberPt;
}

export function buildWasmPointLoads(
  loads: NodeLoad[],
  equivalentNodalFromMemberPt: EquivalentNodalLoad[],
): EquivalentNodalLoad[] {
  return [
    ...loads.map((load) => ({
      node_id: load.nodeId,
      fx: (load.fx ?? 0) * 1000,
      fy: (load.fy ?? 0) * 1000,
      fz: (load.fz ?? 0) * 1000,
      mx: (load.mx ?? 0) * 1000,
      my: (load.my ?? 0) * 1000,
      mz: (load.mz ?? 0) * 1000,
    })),
    ...equivalentNodalFromMemberPt,
  ];
}

export function buildPlatePressureEquivalentNodalLoads(
  platesArray: Plate[],
  nodesArray: AnalysisNodePayload[],
): EquivalentNodalLoad[] {
  const plateLoads: EquivalentNodalLoad[] = [];

  for (const plate of platesArray) {
    if (!plate.pressure || Math.abs(plate.pressure) <= 1e-12) continue;

    const pNodes = plate.nodeIds
      .map((nodeId) => nodesArray.find((node) => node.id === nodeId))
      .filter(Boolean) as AnalysisNodePayload[];

    if (pNodes.length !== 4) continue;

    const dx13 = pNodes[2].x - pNodes[0].x;
    const dy13 = pNodes[2].y - pNodes[0].y;
    const dz13 = (pNodes[2].z ?? 0) - (pNodes[0].z ?? 0);
    const dx24 = pNodes[3].x - pNodes[1].x;
    const dy24 = pNodes[3].y - pNodes[1].y;
    const dz24 = (pNodes[3].z ?? 0) - (pNodes[1].z ?? 0);

    const cx = dy13 * dz24 - dz13 * dy24;
    const cy = dz13 * dx24 - dx13 * dz24;
    const cz = dx13 * dy24 - dy13 * dx24;
    const area = 0.5 * Math.sqrt(cx * cx + cy * cy + cz * cz);
    const forcePerNode = (plate.pressure * 1000 * area) / 4;

    for (const node of pNodes) {
      plateLoads.push({
        node_id: node.id,
        fx: 0,
        fy: -forcePerNode,
        fz: 0,
        mx: 0,
        my: 0,
        mz: 0,
      });
    }
  }

  return plateLoads;
}
