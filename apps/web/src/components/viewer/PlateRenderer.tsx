/**
 * PlateRenderer.tsx - Render Plate/Shell Elements in 3D (Optimised)
 * 
 * Renders ALL quadrilateral plate elements with merged BufferGeometry
 * to minimise draw calls and GPU memory:
 *   - Single mesh for all plate surfaces (per-vertex colour for selection)
 *   - Single LineSegments for all edges
 *   - Optional single offset mesh for thickness visualisation
 */

import { FC, useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useModelStore, Plate, Node } from '../../store/model';
import { useShallow } from 'zustand/react/shallow';

// ============================================
// TYPES
// ============================================

interface PlateRendererProps {
    showStress?: boolean;
    stressColorScale?: 'displacement' | 'stress' | 'utilization';
}

// Colours
const COL_DEFAULT = new THREE.Color('#6366f1');
const COL_SELECTED = new THREE.Color('#a855f7');
const EDGE_DEFAULT = new THREE.Color('#818cf8');
const EDGE_SELECTED = new THREE.Color('#f472b6');
const BACK_DEFAULT = new THREE.Color('#4f46e5');
const BACK_SELECTED = new THREE.Color('#7c3aed');

// Shared materials (created once, never disposed)
const SURFACE_MAT = new THREE.MeshStandardMaterial({
    vertexColors: true,
    transparent: true,
    opacity: 0.45,
    side: THREE.DoubleSide,
});
const EDGE_MAT = new THREE.LineBasicMaterial({
    vertexColors: true,
});
const BACK_MAT = new THREE.MeshStandardMaterial({
    vertexColors: true,
    transparent: true,
    opacity: 0.2,
    side: THREE.DoubleSide,
});

// ============================================
// COMPONENT
// ============================================

export const PlateRenderer: FC<PlateRendererProps> = ({ showStress: _showStress = false }) => {
    const { nodes, plates, selectedIds } = useModelStore(
        useShallow((s) => ({
            nodes: s.nodes,
            plates: s.plates,
            selectedIds: s.selectedIds,
        }))
    );

    const surfaceRef = useRef<THREE.Mesh>(null);
    const edgesRef = useRef<THREE.LineSegments>(null);
    const backRef = useRef<THREE.Mesh>(null);

    // Build merged geometry data
    const { surfaceGeo, edgesGeo, backGeo, count } = useMemo(() => {
        // Collect valid plates
        const validPlates: Array<{
            verts: THREE.Vector3[];
            thickness: number;
            selected: boolean;
        }> = [];

        plates.forEach((plate: Plate) => {
            const verts: THREE.Vector3[] = [];
            let valid = true;
            for (const nodeId of plate.nodeIds) {
                const node: Node | undefined = nodes.get(nodeId);
                if (node) {
                    verts.push(new THREE.Vector3(node.x, node.y, node.z));
                } else {
                    valid = false;
                    break;
                }
            }
            if (valid && verts.length === 4) {
                validPlates.push({
                    verts,
                    thickness: plate.thickness,
                    selected: selectedIds.has(plate.id),
                });
            }
        });

        const n = validPlates.length;
        if (n === 0) {
            return { surfaceGeo: null, edgesGeo: null, backGeo: null, count: 0 };
        }

        // ----- Surface geometry (6 verts per plate: 2 tris) -----
        const sPositions = new Float32Array(n * 6 * 3);
        const sNormals = new Float32Array(n * 6 * 3);
        const sColors = new Float32Array(n * 6 * 3);

        // ----- Back (thickness) geometry (same topology, offset by -thickness in normal dir) -----
        const bPositions = new Float32Array(n * 6 * 3);
        const bNormals = new Float32Array(n * 6 * 3);
        const bColors = new Float32Array(n * 6 * 3);

        // ----- Edges (4 line segments per plate = 8 verts * 3) -----
        const ePositions = new Float32Array(n * 8 * 3);
        const eColors = new Float32Array(n * 8 * 3);

        const _v1 = new THREE.Vector3();
        const _v2 = new THREE.Vector3();
        const _normal = new THREE.Vector3();

        for (let i = 0; i < n; i++) {
            const plate = validPlates[i];
            if (!plate) continue;
            const { verts, thickness, selected } = plate;
            const col = selected ? COL_SELECTED : COL_DEFAULT;
            const ecol = selected ? EDGE_SELECTED : EDGE_DEFAULT;
            const bcol = selected ? BACK_SELECTED : BACK_DEFAULT;

            // Normal
            _v1.subVectors(verts[1], verts[0]);
            _v2.subVectors(verts[2], verts[0]);
            _normal.crossVectors(_v1, _v2).normalize();

            // Surface triangles (0-1-2, 0-2-3)
            const si = i * 18; // 6 verts * 3
            const triOrder = [0, 1, 2, 0, 2, 3];
            for (let t = 0; t < 6; t++) {
                const v = verts[triOrder[t]];
                sPositions[si + t * 3] = v.x;
                sPositions[si + t * 3 + 1] = v.y;
                sPositions[si + t * 3 + 2] = v.z;
                sNormals[si + t * 3] = _normal.x;
                sNormals[si + t * 3 + 1] = _normal.y;
                sNormals[si + t * 3 + 2] = _normal.z;
                sColors[si + t * 3] = col.r;
                sColors[si + t * 3 + 1] = col.g;
                sColors[si + t * 3 + 2] = col.b;

                // Back face offset along normal
                bPositions[si + t * 3] = v.x - _normal.x * thickness;
                bPositions[si + t * 3 + 1] = v.y - _normal.y * thickness;
                bPositions[si + t * 3 + 2] = v.z - _normal.z * thickness;
                bNormals[si + t * 3] = -_normal.x;
                bNormals[si + t * 3 + 1] = -_normal.y;
                bNormals[si + t * 3 + 2] = -_normal.z;
                bColors[si + t * 3] = bcol.r;
                bColors[si + t * 3 + 1] = bcol.g;
                bColors[si + t * 3 + 2] = bcol.b;
            }

            // Edges: 4 segments → (0-1, 1-2, 2-3, 3-0)
            const ei = i * 24; // 8 verts * 3
            const edgeOrder = [0, 1, 1, 2, 2, 3, 3, 0];
            for (let e = 0; e < 8; e++) {
                const v = verts[edgeOrder[e]];
                ePositions[ei + e * 3] = v.x;
                ePositions[ei + e * 3 + 1] = v.y;
                ePositions[ei + e * 3 + 2] = v.z;
                eColors[ei + e * 3] = ecol.r;
                eColors[ei + e * 3 + 1] = ecol.g;
                eColors[ei + e * 3 + 2] = ecol.b;
            }
        }

        const sg = new THREE.BufferGeometry();
        sg.setAttribute('position', new THREE.BufferAttribute(sPositions, 3));
        sg.setAttribute('normal', new THREE.BufferAttribute(sNormals, 3));
        sg.setAttribute('color', new THREE.BufferAttribute(sColors, 3));

        const eg = new THREE.BufferGeometry();
        eg.setAttribute('position', new THREE.BufferAttribute(ePositions, 3));
        eg.setAttribute('color', new THREE.BufferAttribute(eColors, 3));

        const bg = new THREE.BufferGeometry();
        bg.setAttribute('position', new THREE.BufferAttribute(bPositions, 3));
        bg.setAttribute('normal', new THREE.BufferAttribute(bNormals, 3));
        bg.setAttribute('color', new THREE.BufferAttribute(bColors, 3));

        return { surfaceGeo: sg, edgesGeo: eg, backGeo: bg, count: n };
    }, [plates, nodes, selectedIds]);

    // Dispose old geometries on unmount / re-build
    useEffect(() => {
        return () => {
            surfaceGeo?.dispose();
            edgesGeo?.dispose();
            backGeo?.dispose();
        };
    }, [surfaceGeo, edgesGeo, backGeo]);

    if (count === 0 || !surfaceGeo) return null;

    return (
        <group>
            {/* All plate surfaces – 1 draw call */}
            <mesh ref={surfaceRef} geometry={surfaceGeo} material={SURFACE_MAT} />

            {/* All edges – 1 draw call */}
            <lineSegments ref={edgesRef} geometry={edgesGeo} material={EDGE_MAT} />

            {/* Thickness offset – 1 draw call */}
            <mesh ref={backRef} geometry={backGeo} material={BACK_MAT} />
        </group>
    );
};

export default PlateRenderer;
