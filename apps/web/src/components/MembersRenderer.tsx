import { FC, useLayoutEffect, useRef, useMemo } from 'react';
import * as THREE from 'three';
import { Line } from '@react-three/drei';
import { useModelStore } from '../store/model';

export type ColorMode = 'DEFAULT' | 'UTILIZATION';
export type DisplayMode = 'AUTO' | 'LINE' | 'SECTION';

interface MembersRendererProps {
    colorMode?: ColorMode;
    utilizationMap?: Map<string, number>;  // memberId -> utilization ratio (0-1+)
    displayMode?: DisplayMode;  // How to display members: AUTO (line if no section), LINE (always lines), SECTION (always cylinders)
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
    utilizationMap,
    displayMode = 'AUTO'
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

    // Separate members into line-display and section-display groups
    const { lineMembers, sectionMembers } = useMemo(() => {
        const lines: { id: string; startPos: THREE.Vector3; endPos: THREE.Vector3; color: string }[] = [];
        const sections: string[] = [];

        for (const member of members.values()) {
            const startNode = nodes.get(member.startNodeId);
            const endNode = nodes.get(member.endNodeId);
            if (!startNode || !endNode) continue;

            const shouldRenderAsLine = displayMode === 'LINE' || 
                (displayMode === 'AUTO' && (!member.sectionId || member.sectionId === '' || member.sectionId === 'default'));

            if (shouldRenderAsLine) {
                let color = '#00aaff'; // Default: Cyan
                if (selectedIds.has(member.id)) {
                    color = '#ff00ff'; // Selected: Hot Pink
                } else if (colorMode === 'UTILIZATION' && utilizationMap?.has(member.id)) {
                    const ratio = utilizationMap.get(member.id)!;
                    color = getUtilizationColor(ratio).getHexString();
                    color = '#' + color;
                }

                lines.push({
                    id: member.id,
                    startPos: new THREE.Vector3(startNode.x, startNode.y, startNode.z),
                    endPos: new THREE.Vector3(endNode.x, endNode.y, endNode.z),
                    color
                });
            } else {
                sections.push(member.id);
            }
        }

        return { lineMembers: lines, sectionMembers: sections };
    }, [members, nodes, selectedIds, displayMode, colorMode, utilizationMap]);

    // Update instanced mesh for section members only
    useLayoutEffect(() => {
        if (!meshRef.current || sectionMembers.length === 0) return;

        // Resize mapping array
        idsRef.current = new Array(sectionMembers.length);

        const dummy = new THREE.Object3D();
        const startPos = new THREE.Vector3();
        const endPos = new THREE.Vector3();
        const direction = new THREE.Vector3();
        const quaternion = new THREE.Quaternion();
        const up = new THREE.Vector3(0, 1, 0); // Default cylinder orientation is Y-up
        const color = new THREE.Color();

        let index = 0;

        for (const memberId of sectionMembers) {
            const member = members.get(memberId);
            if (!member) continue;

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

    }, [members, nodes, selectedIds, colorMode, memberColors, utilizationMap, sectionMembers]);

    if (members.size === 0) return null;

    return (
        <group>
            {/* Render line members as simple 3D lines */}
            {lineMembers.map(({ id, startPos, endPos, color }) => (
                <Line
                    key={id}
                    points={[startPos, endPos]}
                    color={color}
                    lineWidth={3}
                    onClick={(e) => {
                        e.stopPropagation();
                        select(id, e.shiftKey || e.metaKey);
                    }}
                    onPointerOver={(e) => {
                        e.stopPropagation();
                        document.body.style.cursor = 'pointer';
                    }}
                    onPointerOut={() => {
                        document.body.style.cursor = 'auto';
                    }}
                />
            ))}

            {/* Render section members as 3D cylinders */}
            {sectionMembers.length > 0 && (
                <instancedMesh
                    ref={meshRef}
                    args={[undefined, undefined, sectionMembers.length]}
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
            )}
        </group>
    );
};

export default MembersRenderer;
