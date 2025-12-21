import { FC, useLayoutEffect, useRef } from 'react';
import * as THREE from 'three';
import { useModelStore } from '../store/model';

export const NodesRenderer: FC = () => {
    const nodes = useModelStore((state) => state.nodes);
    const selectedIds = useModelStore((state) => state.selectedIds);
    const select = useModelStore((state) => state.select);
    const analysisResults = useModelStore((state) => state.analysisResults);
    const displacementScale = useModelStore((state) => state.displacementScale);

    const meshRef = useRef<THREE.InstancedMesh>(null);
    const idsRef = useRef<string[]>([]); // Map instanceId -> nodeId

    useLayoutEffect(() => {
        if (!meshRef.current) return;

        // Resize ids array to match
        idsRef.current = new Array(nodes.size);

        const tempObject = new THREE.Object3D();
        const color = new THREE.Color();
        let index = 0;

        // Update instance matrix and color for each node
        for (const node of nodes.values()) {
            // Get displacement if available
            const displacement = analysisResults?.displacements.get(node.id);

            // 1. Position (with displacement if analysis results exist)
            const x = node.x + (displacement ? displacement.dx * displacementScale : 0);
            const y = node.y + (displacement ? displacement.dy * displacementScale : 0);
            const z = node.z + (displacement ? displacement.dz * displacementScale : 0);

            tempObject.position.set(x, y, z);
            tempObject.updateMatrix();
            meshRef.current.setMatrixAt(index, tempObject.matrix);

            // 2. Color (Selection vs Analysis vs Default)
            if (selectedIds.has(node.id)) {
                color.set('#ff00ff'); // Selected: Hot Pink
            } else if (displacement) {
                color.set('#ff4444'); // Displaced: Red
            } else {
                color.set('#ff6b00'); // Default: Orange
            }
            meshRef.current.setColorAt(index, color);

            // 3. Map Index
            idsRef.current[index] = node.id;

            index++;
        }

        meshRef.current.instanceMatrix.needsUpdate = true;
        if (meshRef.current.instanceColor) meshRef.current.instanceColor.needsUpdate = true;

    }, [nodes, selectedIds, analysisResults, displacementScale]);

    if (nodes.size === 0) return null;

    return (
        <instancedMesh
            ref={meshRef}
            args={[undefined, undefined, nodes.size]}
            onClick={(e) => {
                e.stopPropagation();
                const instanceId = e.instanceId;
                if (instanceId !== undefined) {
                    const id = idsRef.current[instanceId];
                    if (id) {
                        select(id, e.shiftKey || e.metaKey); // Multi-select support
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
            <sphereGeometry args={[0.2, 16, 16]} />
            <meshStandardMaterial color="#ff6b00" />
        </instancedMesh>
    );
};
