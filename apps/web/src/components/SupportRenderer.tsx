import { FC, useMemo, useEffect, memo } from 'react';
import * as THREE from 'three';
import { useModelStore } from '../store/model';

// ============================================
// SUPPORT RENDERER
// ============================================
// Renders visual indicators for support conditions:
// - Fixed: Cube at node position (all DOFs restrained)
// - Pinned: Pyramid/Tetrahedron at node position (translations restrained)
// - Roller: Triangle/Roller at node position (partial restraint)

export const SupportRenderer: FC = memo(() => {
    const nodes = useModelStore((state) => state.nodes);

    // Categorize nodes by support type
    const { fixedNodes, pinnedNodes, rollerNodes } = useMemo(() => {
        const fixed: { id: string; x: number; y: number; z: number }[] = [];
        const pinned: { id: string; x: number; y: number; z: number }[] = [];
        const roller: { id: string; x: number; y: number; z: number }[] = [];

        for (const node of nodes.values()) {
            if (!node.restraints) continue;
            const r = node.restraints;

            // Fixed: All 3 translations + rotation restrained
            if (r.fx && r.fy && r.mz) {
                fixed.push({ id: node.id, x: node.x, y: node.y, z: node.z });
            }
            // Pinned: X and Y translations restrained (no moment)
            else if (r.fx && r.fy && !r.mz) {
                pinned.push({ id: node.id, x: node.x, y: node.y, z: node.z });
            }
            // Roller: Only Y translation restrained
            else if (r.fy && !r.fx) {
                roller.push({ id: node.id, x: node.x, y: node.y, z: node.z });
            }
        }

        return { fixedNodes: fixed, pinnedNodes: pinned, rollerNodes: roller };
    }, [nodes]);

    // Pre-create geometries
    const cubeGeometry = useMemo(() => new THREE.BoxGeometry(0.5, 0.5, 0.5), []);
    const tetraGeometry = useMemo(() => new THREE.TetrahedronGeometry(0.35), []);
    const rollerGeometry = useMemo(() => new THREE.ConeGeometry(0.3, 0.4, 3), []);

    // Materials
    const fixedMaterial = useMemo(() => new THREE.MeshStandardMaterial({
        color: '#00ff88',
        roughness: 0.3,
        metalness: 0.5
    }), []);

    const pinnedMaterial = useMemo(() => new THREE.MeshStandardMaterial({
        color: '#00bbff',
        roughness: 0.3,
        metalness: 0.5
    }), []);

    const rollerMaterial = useMemo(() => new THREE.MeshStandardMaterial({
        color: '#ffaa00',
        roughness: 0.3,
        metalness: 0.5
    }), []);

    // Dispose GPU resources on unmount
    useEffect(() => {
        return () => {
            cubeGeometry.dispose();
            tetraGeometry.dispose();
            rollerGeometry.dispose();
            fixedMaterial.dispose();
            pinnedMaterial.dispose();
            rollerMaterial.dispose();
        };
    }, [cubeGeometry, tetraGeometry, rollerGeometry, fixedMaterial, pinnedMaterial, rollerMaterial]);

    return (
        <group name="supports">
            {/* Fixed Supports - Green Cubes */}
            {fixedNodes.map((node) => (
                <mesh
                    key={`fixed-${node.id}`}
                    geometry={cubeGeometry}
                    material={fixedMaterial}
                    position={[node.x, node.y - 0.35, node.z]}
                />
            ))}

            {/* Pinned Supports - Blue Tetrahedrons (rotated to point up) */}
            {pinnedNodes.map((node) => (
                <mesh
                    key={`pinned-${node.id}`}
                    geometry={tetraGeometry}
                    material={pinnedMaterial}
                    position={[node.x, node.y - 0.3, node.z]}
                    rotation={[Math.PI, 0, 0]}
                />
            ))}

            {/* Roller Supports - Orange Cones */}
            {rollerNodes.map((node) => (
                <mesh
                    key={`roller-${node.id}`}
                    geometry={rollerGeometry}
                    material={rollerMaterial}
                    position={[node.x, node.y - 0.35, node.z]}
                    rotation={[Math.PI, 0, 0]}
                />
            ))}
        </group>
    );
});

SupportRenderer.displayName = 'SupportRenderer';
