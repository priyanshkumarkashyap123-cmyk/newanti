/**
 * InstancedMemberRenderer.tsx — High-performance renderer for 100s of structural members
 * 
 * Uses Three.js InstancedMesh to render identical structural members (columns, beams)
 * with a single draw call, enabling 60+ FPS even with hundreds of elements.
 * 
 * Architecture:
 * - BatchRenderer: Groups members by type and section
 * - InstancedMesh pooling: Reuse instances instead of creating/destroying
 * - Position/Rotation/Scale matrices: Computed once and batched
 * - Dirty-flag optimization: Only update changed instances
 */

import React, { useEffect, useRef, useMemo } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useDisposables, disposeGroup } from '../utils/useDisposable';
import type { Member, Node } from '../store/modelTypes';

interface InstancedMemberRendererProps {
  members: Map<string, Member>;
  nodes: Map<string, Node>;
  hoveredMemberId?: string | null;
  selectedMemberIds?: Set<string>;
  onMemberClick?: (memberId: string) => void;
}

interface MemberBatch {
  type: 'beam' | 'column' | 'brace';
  meshes: THREE.InstancedMesh[];
  instanceMap: Map<string, number>; // memberId -> instanceIndex
  count: number;
}

/**
 * High-performance member renderer using InstancedMesh
 * - Supports 100s of identical members with minimal performance impact
 * - Enables selective highlighting (hovered/selected) via custom colors
 */
export const InstancedMemberRenderer: React.FC<InstancedMemberRendererProps> = ({
  members,
  nodes,
  hoveredMemberId,
  selectedMemberIds = new Set(),
  onMemberClick,
}) => {
  const { scene } = useThree();
  const batchesRef = useRef<Map<string, MemberBatch>>(new Map());
  const instanceMatricesRef = useRef<Map<string, THREE.Matrix4>>(new Map());
  const dirtyFlagsRef = useRef<Map<string, Set<number>>>(new Map());
  const groupRef = useRef<THREE.Group>(null);

  // Pre-compute member geometries (reusable)
  const geometries = useMemo(() => ({
    column: new THREE.BoxGeometry(0.3, 4.0, 0.3),
    beam: new THREE.BoxGeometry(0.3, 0.5, 10.0),
    brace: new THREE.CylinderGeometry(0.025, 0.025, 1.0, 8),
  }), []);

  // Pre-compute materials (reusable)
  const materials = useMemo(() => ({
    column: new THREE.MeshStandardMaterial({
      color: 0x4488ff,
      metalness: 0.6,
      roughness: 0.4,
    }),
    beam: new THREE.MeshStandardMaterial({
      color: 0xff8844,
      metalness: 0.6,
      roughness: 0.4,
    }),
    brace: new THREE.MeshStandardMaterial({
      color: 0x44ff44,
      metalness: 0.5,
      roughness: 0.5,
    }),
  }), []);

  // Dispose geometries & materials on unmount
  useDisposables([
    geometries.column, geometries.beam, geometries.brace,
    materials.column, materials.beam, materials.brace,
  ]);

  // Initialize instance batches
  useEffect(() => {
    // Count members by type
    const memberCounts = { column: 0, beam: 0, brace: 0 };
    members.forEach((member) => {
      const type = (member.type || 'beam') as 'column' | 'beam' | 'brace';
      memberCounts[type]++;
    });

    // Create InstancedMesh for each type
    const batches = new Map<string, MemberBatch>();
    let groupChild = 0;

    if (groupRef.current) {
      // Clear previous instances
      while (groupRef.current.children.length > 0) {
        groupRef.current.removeChild(groupRef.current.children[0]);
      }
    }

    (['column', 'beam', 'brace'] as const).forEach((type) => {
      const count = memberCounts[type];
      if (count === 0) return;

      // Create InstancedMesh with buffer for future growth (1.5x current count)
      const bufferCount = Math.max(count * 1.5, 10);
      const mesh = new THREE.InstancedMesh(
        geometries[type],
        materials[type],
        bufferCount
      );
      mesh.castShadow = true;
      mesh.receiveShadow = true;

      if (groupRef.current) {
        groupRef.current.add(mesh);
      }

      batches.set(type, {
        type,
        meshes: [mesh],
        instanceMap: new Map(),
        count,
      });
    });

    batchesRef.current = batches;

    // Cleanup instanced meshes on unmount
    return () => {
      if (groupRef.current) {
        disposeGroup(groupRef.current);
      }
    };
  }, [members.size, geometries, materials]);

  // Update instance matrices when members change
  useEffect(() => {
    instanceMatricesRef.current.clear();
    dirtyFlagsRef.current.clear();

    const batches = batchesRef.current;
    batches.forEach((batch) => {
      batch.instanceMap.clear();
      batch.count = 0;
      dirtyFlagsRef.current.set(batch.type, new Set());
    });

    // Rebuild instance matrices
    let instanceIndex: { [key: string]: number } = { column: 0, beam: 0, brace: 0 };

    members.forEach((member) => {
      // Determine member type from section (default to beam)
      let type: 'column' | 'beam' | 'brace' = 'beam';
      if (member.sectionType) {
        // Could add logic here to infer type from section
      }
      const batch = batches.get(type);
      if (!batch) return;

      const nodeI = nodes.get(member.startNodeId);
      const nodeJ = nodes.get(member.endNodeId);
      if (!nodeI || !nodeJ) return;

      const idx = instanceIndex[type]++;
      batch.instanceMap.set(member.id, idx);
      batch.count = Math.max(batch.count, idx + 1);

      // Compute transformation matrix from nodeI to nodeJ
      const matrix = computeMemberMatrix(nodeI, nodeJ, type);
      instanceMatricesRef.current.set(member.id, matrix);

      // Mark as dirty (needs GPU update)
      dirtyFlagsRef.current.get(type)!.add(idx);
    });

    // Ensure mesh buffers are large enough
    batches.forEach((batch) => {
      batch.meshes.forEach((mesh) => {
        mesh.count = batch.count;
      });
    });
  }, [members, nodes]);

  // Update GPU with dirty instances
  useFrame(() => {
    const batches = batchesRef.current;
    const dirtyFlags = dirtyFlagsRef.current;

    batches.forEach((batch) => {
      const dirty = dirtyFlags.get(batch.type) || new Set();
      if (dirty.size === 0) return;

      batch.meshes.forEach((mesh) => {
        dirty.forEach((idx) => {
          // Build matrix from member data
          let matrix: THREE.Matrix4 | undefined;

          // Find corresponding member
          members.forEach((member) => {
            if ((member.type || 'beam') !== batch.type) return;
            if (batch.instanceMap.get(member.id) !== idx) return;

            const m = instanceMatricesRef.current.get(member.id);
            if (m) {
              matrix = m;
            }
          });

          if (matrix) {
            mesh.setMatrixAt(idx, matrix);
          }
        });

        mesh.instanceMatrix.needsUpdate = true;
      });

      dirty.clear();
    });
  });

  // Update colors only when selection/hover changes (avoids per-frame CPU work)
  useEffect(() => {
    const batches = batchesRef.current;

    batches.forEach((batch) => {
      const colors = new Float32Array(batch.count * 3);

      batch.instanceMap.forEach((idx, memberId) => {
        let color: THREE.Color;

        if (selectedMemberIds.has(memberId)) {
          color = new THREE.Color(0xffff00); // Yellow for selected
        } else if (hoveredMemberId === memberId) {
          color = new THREE.Color(0xff00ff); // Magenta for hovered
        } else {
          // Default color based on type
          switch (batch.type) {
            case 'column':
              color = new THREE.Color(0x4488ff);
              break;
            case 'beam':
              color = new THREE.Color(0xff8844);
              break;
            case 'brace':
              color = new THREE.Color(0x44ff44);
              break;
          }
        }

        colors[idx * 3] = color.r;
        colors[idx * 3 + 1] = color.g;
        colors[idx * 3 + 2] = color.b;
      });

      batch.meshes.forEach((mesh) => {
        if (!mesh.geometry.getAttribute('color')) {
          mesh.geometry.setAttribute(
            'color',
            new THREE.BufferAttribute(colors, 3)
          );
        } else {
          const colorAttr = mesh.geometry.getAttribute('color') as THREE.BufferAttribute;
          colorAttr.array.set(colors);
          colorAttr.needsUpdate = true;
        }
      });
    });
  }, [hoveredMemberId, selectedMemberIds, members, nodes]);

  return <group ref={groupRef} />;
};

/**
 * Compute transformation matrix for a structural member from node I to node J
 * Accounts for member orientation and length
 */
function computeMemberMatrix(
  nodeI: { x: number; y: number; z: number },
  nodeJ: { x: number; y: number; z: number },
  type: 'column' | 'beam' | 'brace'
): THREE.Matrix4 {
  const matrix = new THREE.Matrix4();

  // Vector from I to J
  const dx = nodeJ.x - nodeI.x;
  const dy = nodeJ.y - nodeI.y;
  const dz = nodeJ.z - nodeI.z;
  const length = Math.sqrt(dx * dx + dy * dy + dz * dz);

  // Position: midpoint of member
  const midX = (nodeI.x + nodeJ.x) / 2;
  const midY = (nodeI.y + nodeJ.y) / 2;
  const midZ = (nodeI.z + nodeJ.z) / 2;

  // Rotation: align with member axis
  const direction = new THREE.Vector3(dx, dy, dz).normalize();
  const up = new THREE.Vector3(0, 1, 0);

  // If member is vertical, use different up vector
  if (Math.abs(dy) > 0.99) {
    up.set(1, 0, 0);
  }

  const right = new THREE.Vector3().crossVectors(up, direction).normalize();
  const newUp = new THREE.Vector3().crossVectors(direction, right).normalize();

  const quaternion = new THREE.Quaternion();
  const rotationMatrix = new THREE.Matrix4();
  rotationMatrix.makeBasis(direction, newUp, right);
  quaternion.setFromRotationMatrix(rotationMatrix);

  // Scale: length of member
  const scale = new THREE.Vector3(1, length, 1);

  matrix.compose(
    new THREE.Vector3(midX, midY, midZ),
    quaternion,
    scale
  );

  return matrix;
}

export default InstancedMemberRenderer;
