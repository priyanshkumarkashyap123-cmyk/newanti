/**
 * centerOfRigidity.ts — Center of Rigidity Computation
 *
 * STAAD.Pro parity: Computes the center of rigidity (CR) for each rigid
 * diaphragm after analysis. The CR is the point about which the floor
 * rotates under lateral load.
 *
 * For a rigid diaphragm, the CR is computed as the stiffness-weighted
 * centroid of the lateral-force-resisting elements at that floor level.
 */

import type { DiaphragmSpec } from '../store/modelTypes';
import type { Node, Member } from '../store/model';

export interface CenterOfRigidityResult {
  diaphragmId: string;
  x: number;
  z: number;
  y: number; // elevation
}

/**
 * Computes the center of rigidity for a rigid diaphragm.
 *
 * Simplified approach: The CR is approximated as the centroid of the
 * nodes in the diaphragm, weighted by the lateral stiffness of the
 * columns/walls connected to those nodes.
 *
 * For a more accurate computation, the full stiffness matrix would be
 * needed (requires solver integration).
 */
export function computeCenterOfRigidity(
  diaphragm: DiaphragmSpec,
  nodes: Map<string, Node>,
  members: Map<string, Member>,
): CenterOfRigidityResult {
  // Get diaphragm nodes
  const diaphragmNodes = diaphragm.nodeIds
    .map((id) => nodes.get(id))
    .filter(Boolean) as Node[];

  if (diaphragmNodes.length === 0) {
    return { diaphragmId: diaphragm.id, x: 0, z: 0, y: 0 };
  }

  // Compute stiffness-weighted centroid
  // For each node, estimate lateral stiffness as sum of (EI/L³) of connected vertical members
  let totalKx = 0;
  let totalKz = 0;
  let sumKxX = 0;
  let sumKzZ = 0;
  const y = diaphragmNodes[0].y;

  for (const node of diaphragmNodes) {
    // Find vertical members connected to this node
    let kx = 0;
    let kz = 0;

    for (const member of members.values()) {
      if (member.startNodeId !== node.id && member.endNodeId !== node.id) continue;
      const otherNodeId = member.startNodeId === node.id ? member.endNodeId : member.startNodeId;
      const otherNode = nodes.get(otherNodeId);
      if (!otherNode) continue;

      // Check if member is approximately vertical
      const dx = otherNode.x - node.x;
      const dy = otherNode.y - node.y;
      const dz = otherNode.z - node.z;
      const L = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (L < 1e-6) continue;

      const isVertical = Math.abs(dy) / L > 0.7; // > 70% vertical
      if (!isVertical) continue;

      // Lateral stiffness: k = 12EI/L³
      const E = member.E ?? 200e6;
      const I = member.I ?? 1e-4;
      const k = (12 * E * I) / Math.pow(L, 3);
      kx += k;
      kz += k;
    }

    // If no vertical members, use unit stiffness
    if (kx === 0) kx = 1;
    if (kz === 0) kz = 1;

    totalKx += kx;
    totalKz += kz;
    sumKxX += kx * node.x;
    sumKzZ += kz * node.z;
  }

  const crX = totalKx > 0 ? sumKxX / totalKx : diaphragmNodes.reduce((s, n) => s + n.x, 0) / diaphragmNodes.length;
  const crZ = totalKz > 0 ? sumKzZ / totalKz : diaphragmNodes.reduce((s, n) => s + n.z, 0) / diaphragmNodes.length;

  return { diaphragmId: diaphragm.id, x: crX, z: crZ, y };
}

/**
 * Computes center of rigidity for all rigid diaphragms.
 */
export function computeAllCentersOfRigidity(
  diaphragms: DiaphragmSpec[],
  nodes: Map<string, Node>,
  members: Map<string, Member>,
): Map<string, { x: number; z: number; y: number }> {
  const result = new Map<string, { x: number; z: number; y: number }>();
  for (const d of diaphragms) {
    if (d.type !== 'rigid') continue;
    const cr = computeCenterOfRigidity(d, nodes, members);
    result.set(d.id, { x: cr.x, z: cr.z, y: cr.y });
  }
  return result;
}
