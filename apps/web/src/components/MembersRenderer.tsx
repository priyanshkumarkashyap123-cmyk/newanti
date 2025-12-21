import { FC, useLayoutEffect, useRef, useMemo } from 'react';
import * as THREE from 'three';
import { useModelStore } from '../store/model';

export type ColorMode = 'DEFAULT' | 'UTILIZATION';

interface MembersRendererProps {
    colorMode?: ColorMode;
    utilizationMap?: Map<string, number>;  // memberId -> utilization ratio (0-1+)
}

/**
 * Get color based on utilization ratio
 * < 0.5: Green (Safe)
 * 0.5 - 0.9: Yellow (Warning)
 * 0.9 - 1.0: Orange (Critical)
 * > 1.0: Red (Failed)
 */
function getUtilizationColor(ratio: number): THREE.Color {
    if (ratio < 0.5) {
        // Green to Yellow gradient
        const t = ratio / 0.5;
        return new THREE.Color().setHSL(0.33 - t * 0.17, 1, 0.5);  // Green to Yellow-Green
    } else if (ratio < 0.9) {
        // Yellow to Orange gradient
        const t = (ratio - 0.5) / 0.4;
        return new THREE.Color().setHSL(0.16 - t * 0.08, 1, 0.5);  // Yellow to Orange
    } else if (ratio <= 1.0) {
        // Orange
        return new THREE.Color().setHSL(0.08, 1, 0.5);  // Orange
    } else {
        // Red (failed)
        return new THREE.Color(0xff0000);
    }
}

export const MembersRenderer: FC<MembersRendererProps> = ({
    colorMode = 'DEFAULT',
    utilizationMap
}) => {
    const members = useModelStore((state) => state.members);
    const nodes = useModelStore((state) => state.nodes);
    const selectedIds = useModelStore((state) => state.selectedIds);
    const select = useModelStore((state) => state.select);

    const meshRef = useRef<THREE.InstancedMesh>(null);
    const idsRef = useRef<string[]>([]); // Map instanceId -> memberId

    // Memoize colors for performance
    const memberColors = useMemo(() => {
        const colors = new Map<string, THREE.Color>();

        if (colorMode === 'UTILIZATION' && utilizationMap) {
            utilizationMap.forEach((ratio, memberId) => {
                colors.set(memberId, getUtilizationColor(ratio));
            });
        }

        return colors;
    }, [colorMode, utilizationMap]);

    useLayoutEffect(() => {
        if (!meshRef.current) return;

        // Resize mapping array
        idsRef.current = new Array(members.size);

        const dummy = new THREE.Object3D();
        const startPos = new THREE.Vector3();
        const endPos = new THREE.Vector3();
        const direction = new THREE.Vector3();
        const quaternion = new THREE.Quaternion();
        const up = new THREE.Vector3(0, 1, 0); // Default cylinder orientation is Y-up
        const color = new THREE.Color();

        let index = 0;

        for (const member of members.values()) {
            const startNode = nodes.get(member.startNodeId);
            const endNode = nodes.get(member.endNodeId);

            if (startNode && endNode) {
                startPos.set(startNode.x, startNode.y, startNode.z);
                endPos.set(endNode.x, endNode.y, endNode.z);

                // Calculate length and direction
                const length = startPos.distanceTo(endPos);
                direction.subVectors(endPos, startPos).normalize();

                // Calculate mid-point position
                dummy.position.addVectors(startPos, endPos).multiplyScalar(0.5);

                // Calculate scale (Y scale = length)
                dummy.scale.set(1, length, 1);

                // Calculate rotation to align cylinder Y-axis with member direction
                quaternion.setFromUnitVectors(up, direction);
                dummy.quaternion.copy(quaternion);

                dummy.updateMatrix();
                meshRef.current.setMatrixAt(index, dummy.matrix);

                // Color based on mode
                if (selectedIds.has(member.id)) {
                    color.set('#ff00ff'); // Selected: Hot Pink
                } else if (colorMode === 'UTILIZATION' && memberColors.has(member.id)) {
                    color.copy(memberColors.get(member.id)!);
                } else if (colorMode === 'UTILIZATION' && utilizationMap?.has(member.id)) {
                    // Direct lookup if not in memoized map
                    color.copy(getUtilizationColor(utilizationMap.get(member.id)!));
                } else {
                    color.set('#00aaff'); // Default: Cyan
                }
                meshRef.current.setColorAt(index, color);

                // Map ID
                idsRef.current[index] = member.id;

                index++;
            }
        }

        meshRef.current.instanceMatrix.needsUpdate = true;
        if (meshRef.current.instanceColor) meshRef.current.instanceColor.needsUpdate = true;

    }, [members, nodes, selectedIds, colorMode, memberColors, utilizationMap]);

    if (members.size === 0) return null;

    return (
        <instancedMesh
            ref={meshRef}
            args={[undefined, undefined, members.size]}
            onClick={(e) => {
                e.stopPropagation();
                const instanceId = e.instanceId;
                if (instanceId !== undefined) {
                    const id = idsRef.current[instanceId];
                    if (id) {
                        select(id, e.shiftKey || e.metaKey);
                    }
                }
            }}
            onPointerOver={(e) => {
                e.stopPropagation();
                document.body.style.cursor = 'pointer';
            }}
            onPointerOut={() => {
                document.body.style.cursor = 'auto';
            }}
        >
            <cylinderGeometry args={[0.1, 0.1, 1, 8]} /> {/* Height 1, scaled dynamically */}
            <meshStandardMaterial vertexColors />
        </instancedMesh>
    );
};

export default MembersRenderer;
