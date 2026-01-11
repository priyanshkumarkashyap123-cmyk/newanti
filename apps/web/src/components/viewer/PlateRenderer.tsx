/**
 * PlateRenderer.tsx - Render Plate/Shell Elements in 3D
 * 
 * Renders quadrilateral plate elements as transparent surfaces
 * with edge highlighting and optional stress coloring.
 */

import React, { FC, useMemo } from 'react';
import { useThree } from '@react-three/fiber';
import { Line } from '@react-three/drei';
import * as THREE from 'three';
import { useModelStore, Plate, Node } from '../../store/model';

// ============================================
// TYPES
// ============================================

interface PlateRendererProps {
    showStress?: boolean;
    stressColorScale?: 'displacement' | 'stress' | 'utilization';
}

// ============================================
// COMPONENT
// ============================================

export const PlateRenderer: FC<PlateRendererProps> = ({ showStress = false }) => {
    const nodes = useModelStore((s) => s.nodes);
    const plates = useModelStore((s) => s.plates);
    const selectedIds = useModelStore((s) => s.selectedIds);

    // Convert plates to renderable geometries
    const plateGeometries = useMemo(() => {
        const geometries: Array<{
            plate: Plate;
            vertices: THREE.Vector3[];
            isSelected: boolean;
        }> = [];

        plates.forEach((plate) => {
            const verts: THREE.Vector3[] = [];
            let valid = true;

            for (const nodeId of plate.nodeIds) {
                const node = nodes.get(nodeId);
                if (node) {
                    verts.push(new THREE.Vector3(node.x, node.y, node.z));
                } else {
                    valid = false;
                    break;
                }
            }

            if (valid && verts.length === 4) {
                geometries.push({
                    plate,
                    vertices: verts,
                    isSelected: selectedIds.has(plate.id),
                });
            }
        });

        return geometries;
    }, [plates, nodes, selectedIds]);

    if (plateGeometries.length === 0) return null;

    return (
        <group>
            {plateGeometries.map(({ plate, vertices, isSelected }) => (
                <PlateElement
                    key={plate.id}
                    vertices={vertices}
                    isSelected={isSelected}
                    thickness={plate.thickness}
                />
            ))}
        </group>
    );
};

// ============================================
// INDIVIDUAL PLATE ELEMENT
// ============================================

interface PlateElementProps {
    vertices: THREE.Vector3[];
    isSelected: boolean;
    thickness: number;
}

const PlateElement: FC<PlateElementProps> = ({ vertices, isSelected, thickness }) => {
    // Create geometry from 4 vertices (2 triangles)
    const geometry = useMemo(() => {
        const geom = new THREE.BufferGeometry();

        // Vertices for 2 triangles (0-1-2, 0-2-3)
        const positions = new Float32Array([
            // Triangle 1
            vertices[0].x, vertices[0].y, vertices[0].z,
            vertices[1].x, vertices[1].y, vertices[1].z,
            vertices[2].x, vertices[2].y, vertices[2].z,
            // Triangle 2
            vertices[0].x, vertices[0].y, vertices[0].z,
            vertices[2].x, vertices[2].y, vertices[2].z,
            vertices[3].x, vertices[3].y, vertices[3].z,
        ]);

        // Calculate normal (assuming CCW winding)
        const v1 = new THREE.Vector3().subVectors(vertices[1], vertices[0]);
        const v2 = new THREE.Vector3().subVectors(vertices[2], vertices[0]);
        const normal = new THREE.Vector3().crossVectors(v1, v2).normalize();

        const normals = new Float32Array([
            normal.x, normal.y, normal.z,
            normal.x, normal.y, normal.z,
            normal.x, normal.y, normal.z,
            normal.x, normal.y, normal.z,
            normal.x, normal.y, normal.z,
            normal.x, normal.y, normal.z,
        ]);

        geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geom.setAttribute('normal', new THREE.BufferAttribute(normals, 3));

        return geom;
    }, [vertices]);

    // Edge loop for outline
    const edgePoints = useMemo(() => {
        return [...vertices, vertices[0]]; // Close the loop
    }, [vertices]);

    return (
        <group>
            {/* Plate surface */}
            <mesh geometry={geometry}>
                <meshStandardMaterial
                    color={isSelected ? '#a855f7' : '#6366f1'}
                    transparent
                    opacity={isSelected ? 0.6 : 0.4}
                    side={THREE.DoubleSide}
                />
            </mesh>

            {/* Edge outline */}
            <Line
                points={edgePoints}
                color={isSelected ? '#f472b6' : '#818cf8'}
                lineWidth={isSelected ? 3 : 2}
            />

            {/* Thickness indicator - small offset mesh on back */}
            <mesh geometry={geometry} position={[0, -thickness, 0]}>
                <meshStandardMaterial
                    color={isSelected ? '#7c3aed' : '#4f46e5'}
                    transparent
                    opacity={0.2}
                    side={THREE.DoubleSide}
                />
            </mesh>
        </group>
    );
};

export default PlateRenderer;
