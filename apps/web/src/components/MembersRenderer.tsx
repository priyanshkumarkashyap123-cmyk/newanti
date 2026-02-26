import { FC, useLayoutEffect, useRef, useMemo, useEffect, memo } from 'react';
import * as THREE from 'three';
import { Line } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import { useModelStore } from '../store/model';
import { useUIStore } from '../store/uiStore';
import { StructuralMember, type MemberData, type NodeData } from './viewer/StructuralMesh';
import { getSectionDataForRendering } from '../services/SectionLookup';

export type ColorMode = 'DEFAULT' | 'UTILIZATION';
export type DisplayMode = 'AUTO' | 'LINE' | 'SECTION' | 'SOLID_3D';

interface MembersRendererProps {
    colorMode?: ColorMode;
    utilizationMap?: Map<string, number>;  // memberId -> utilization ratio (0-1+)
    displayMode?: DisplayMode;  // How to display members
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
        const t = ratio / 0.5;
        return new THREE.Color().setHSL(0.33 - t * 0.17, 1, 0.5);
    } else if (ratio < 0.9) {
        const t = (ratio - 0.5) / 0.4;
        return new THREE.Color().setHSL(0.16 - t * 0.08, 1, 0.5);
    } else if (ratio <= 1.0) {
        return new THREE.Color().setHSL(0.08, 1, 0.5);
    } else {
        return new THREE.Color(0xff0000);
    }
}

export const MembersRenderer: FC<MembersRendererProps> = memo(({
    colorMode = 'DEFAULT',
    utilizationMap,
    displayMode = 'AUTO'
}) => {
    const members = useModelStore((state) => state.members);
    const nodes = useModelStore((state) => state.nodes);
    const selectedIds = useModelStore((state) => state.selectedIds);
    const select = useModelStore((state) => state.select);
    const renderMode3D = useUIStore((state) => state.renderMode3D);

    const meshRef = useRef<THREE.InstancedMesh>(null);
    const idsRef = useRef<string[]>([]);
    // Stable scratch objects — created once, reused every layout effect run
    const dummyRef = useRef(new THREE.Object3D());
    const startPosRef = useRef(new THREE.Vector3());
    const endPosRef = useRef(new THREE.Vector3());
    const directionRef = useRef(new THREE.Vector3());
    const quaternionRef = useRef(new THREE.Quaternion());
    const upRef = useRef(new THREE.Vector3(0, 1, 0));
    const colorRef = useRef(new THREE.Color());

    // Get camera for LOD calculations
    const { camera } = useThree();

    // Calculate structure center for distance-based LOD
    const structureCenter = useMemo(() => {
        if (nodes.size === 0) return new THREE.Vector3();

        let sumX = 0, sumY = 0, sumZ = 0;
        for (const node of nodes.values()) {
            sumX += node.x;
            sumY += node.y;
            sumZ += node.z;
        }
        const count = nodes.size;
        return new THREE.Vector3(sumX / count, sumY / count, sumZ / count);
    }, [nodes]);

    // Dynamic LOD: Adjust geometry detail based on camera distance
    // This is THE key optimization for large structures (1000+ members)
    const geometryDetail = useMemo(() => {
        const distance = camera.position.distanceTo(structureCenter);

        // Adaptive segment count based on distance
        if (distance > 100) return 4;   // Very far view: minimal detail
        if (distance > 50) return 5;    // Far view: low detail
        if (distance > 20) return 6;    // Medium view: standard detail
        return 8;                        // Close-up: high detail
    }, [camera.position, structureCenter]);

    // Cached geometry - reuse instead of creating new instances
    // useEffect cleanup disposes the geometry when it changes or the component unmounts,
    // preventing GPU memory leaks across hot-reloads and re-mounts.
    const cylinderGeometry = useMemo(() =>
        new THREE.CylinderGeometry(0.1, 0.1, 1, geometryDetail),
        [geometryDetail]);

    useEffect(() => {
        return () => {
            cylinderGeometry.dispose();
        };
    }, [cylinderGeometry]);

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

    // Determine effective display mode based on renderMode3D toggle
    const effectiveDisplayMode = useMemo(() => {
        if (renderMode3D) return 'SOLID_3D';
        return displayMode;
    }, [renderMode3D, displayMode]);

    // Prepare 3D solid members data when in SOLID_3D mode
    const solid3DMembers = useMemo<MemberData[]>(() => {
        if (effectiveDisplayMode !== 'SOLID_3D') return [];

        const memberDatas: MemberData[] = [];

        for (const member of members.values()) {
            const startNode = nodes.get(member.startNodeId);
            const endNode = nodes.get(member.endNodeId);
            
            // Warn about missing node references for debugging
            if (!startNode || !endNode) {
                console.warn(`[MembersRenderer] Member ${member.id} references missing node(s): start=${member.startNodeId} (${startNode ? 'found' : 'MISSING'}), end=${member.endNodeId} (${endNode ? 'found' : 'MISSING'})`);
                continue;
            }
            
            // Check for zero-length members
            const dx = endNode.x - startNode.x;
            const dy = endNode.y - startNode.y;
            const dz = endNode.z - startNode.z;
            const memberLength = Math.sqrt(dx * dx + dy * dy + dz * dz);
            if (memberLength < 0.001) {
                console.warn(`[MembersRenderer] Zero-length member ${member.id} at (${startNode.x}, ${startNode.y}, ${startNode.z})`);
                continue;
            }

            // Get section dimensions from lookup
            const sectionData = getSectionDataForRendering(member.sectionId || 'Default');

            // Create node data for StructuralMember
            const startNodeData: NodeData = {
                id: startNode.id,
                position: [startNode.x, startNode.y, startNode.z],
                support: startNode.restraints ?
                    (startNode.restraints.fx && startNode.restraints.fy && startNode.restraints.fz &&
                        startNode.restraints.mx && startNode.restraints.my && startNode.restraints.mz ? 'fixed' :
                        startNode.restraints.fx && startNode.restraints.fy && startNode.restraints.fz ? 'pinned' :
                            startNode.restraints.fy ? 'roller' : 'none') : 'none'
            };

            const endNodeData: NodeData = {
                id: endNode.id,
                position: [endNode.x, endNode.y, endNode.z],
                support: 'none'
            };

            // Determine color
            let color = '#b8b8b8'; // Steel gray default
            if (selectedIds.has(member.id)) {
                color = '#3b82f6'; // Blue for selected
            } else if (colorMode === 'UTILIZATION' && utilizationMap?.has(member.id)) {
                color = '#' + getUtilizationColor(utilizationMap.get(member.id) ?? 0).getHexString();
            }

            memberDatas.push({
                id: member.id,
                startNode: startNodeData,
                endNode: endNodeData,
                sectionType: sectionData.sectionType,
                dimensions: sectionData.dimensions,
                color,
                betaAngle: member.betaAngle
            });
        }

        return memberDatas;
    }, [members, nodes, selectedIds, effectiveDisplayMode, colorMode, utilizationMap]);

    // Separate members into line-display and section-display groups (for non-3D modes)
    const { lineMembers, sectionMembers } = useMemo(() => {
        if (effectiveDisplayMode === 'SOLID_3D') {
            return { lineMembers: [], sectionMembers: [] };
        }

        const lines: { id: string; startPos: THREE.Vector3; endPos: THREE.Vector3; color: string }[] = [];
        const sections: string[] = [];

        for (const member of members.values()) {
            const startNode = nodes.get(member.startNodeId);
            const endNode = nodes.get(member.endNodeId);
            
            // Skip members with missing node references
            if (!startNode || !endNode) {
                console.warn(`[MembersRenderer] Line member ${member.id} has missing nodes`);
                continue;
            }
            
            // Skip zero-length members
            const dx = endNode.x - startNode.x;
            const dy = endNode.y - startNode.y;
            const dz = endNode.z - startNode.z;
            if (dx * dx + dy * dy + dz * dz < 0.000001) {
                continue;
            }

            const shouldRenderAsLine = effectiveDisplayMode === 'LINE' ||
                (effectiveDisplayMode === 'AUTO' && (!member.sectionId || member.sectionId === '' || member.sectionId.toLowerCase() === 'default'));

            if (shouldRenderAsLine) {
                let color = '#00aaff';
                if (selectedIds.has(member.id)) {
                    color = '#ff00ff';
                } else if (colorMode === 'UTILIZATION' && utilizationMap?.has(member.id)) {
                    color = '#' + getUtilizationColor(utilizationMap.get(member.id) ?? 0).getHexString();
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
    }, [members, nodes, selectedIds, effectiveDisplayMode, colorMode, utilizationMap]);

    // Update instanced mesh for simple cylinder section members
    useLayoutEffect(() => {
        if (!meshRef.current || sectionMembers.length === 0) return;

        idsRef.current = new Array(sectionMembers.length);

        // Reuse stable scratch objects — no heap allocation per render
        const dummy = dummyRef.current;
        const startPos = startPosRef.current;
        const endPos = endPosRef.current;
        const direction = directionRef.current;
        const quaternion = quaternionRef.current;
        const up = upRef.current;
        const color = colorRef.current;

        let index = 0;

        for (const memberId of sectionMembers) {
            const member = members.get(memberId);
            if (!member) continue;

            const startNode = nodes.get(member.startNodeId);
            const endNode = nodes.get(member.endNodeId);

            if (startNode && endNode) {
                startPos.set(startNode.x, startNode.y, startNode.z);
                endPos.set(endNode.x, endNode.y, endNode.z);

                const length = startPos.distanceTo(endPos);
                direction.subVectors(endPos, startPos).normalize();

                dummy.position.addVectors(startPos, endPos).multiplyScalar(0.5);
                dummy.scale.set(1, length, 1);
                quaternion.setFromUnitVectors(up, direction);
                dummy.quaternion.copy(quaternion);

                dummy.updateMatrix();
                meshRef.current.setMatrixAt(index, dummy.matrix);

                if (selectedIds.has(member.id)) {
                    color.set('#ff00ff');
                } else if (colorMode === 'UTILIZATION' && memberColors.has(member.id)) {
                    color.copy(memberColors.get(member.id)!);
                } else {
                    color.set('#00aaff');
                }
                meshRef.current.setColorAt(index, color);

                idsRef.current[index] = member.id;
                index++;
            }
        }

        meshRef.current.instanceMatrix.needsUpdate = true;
        if (meshRef.current.instanceColor) meshRef.current.instanceColor.needsUpdate = true;

    }, [members, nodes, selectedIds, colorMode, memberColors, utilizationMap, sectionMembers]);

    if (members.size === 0) return null;

    // SOLID_3D mode: Render using StructuralMember with true cross-sections
    if (effectiveDisplayMode === 'SOLID_3D') {
        return (
            <group name="members-solid-3d">
                {solid3DMembers.map((memberData) => (
                    <StructuralMember
                        key={memberData.id}
                        member={memberData}
                        selected={selectedIds.has(memberData.id)}
                        onSelect={(id) => select(id, false)}
                    />
                ))}
            </group>
        );
    }

    // Wireframe/cylinder modes
    return (
        <group>
            {/* Render line members as simple 3D lines */}
            {lineMembers.map(({ id, startPos, endPos, color }) => (
                <Line
                    key={id}
                    points={[startPos, endPos]}
                    color={color}
                    lineWidth={2} // Reduced from 3 for better performance
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
                    key={`instanced-mesh-${sectionMembers.length}`}
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
                    <primitive object={cylinderGeometry} />
                    <meshStandardMaterial
                        vertexColors
                        flatShading={geometryDetail <= 5} // Flat shading for low-detail models
                    />
                </instancedMesh>
            )}
        </group>
    );
});

MembersRenderer.displayName = 'MembersRenderer';

export default MembersRenderer;

