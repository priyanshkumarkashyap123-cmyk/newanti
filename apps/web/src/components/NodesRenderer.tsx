import { FC, useLayoutEffect, useRef, useMemo, useEffect, memo } from 'react';
import * as THREE from 'three';
import { useModelStore, Node } from '../store/model';

// Geometry constants — created once at module level for sharing across instances.
// We register a Vite HMR disposal callback so these are cleaned up on hot-reload.
const SPHERE_GEO = new THREE.SphereGeometry(0.2, 16, 16);
const BOX_GEO = new THREE.BoxGeometry(0.3, 0.3, 0.3);
const CONE_GEO = new THREE.ConeGeometry(0.2, 0.4, 8);    // Pinned
const CYL_GEO  = new THREE.CylinderGeometry(0.2, 0.2, 0.3, 16); // Roller

// Dispose on Vite HMR so GPU buffers don’t accumulate across hot-reloads
if (import.meta.hot) {
    import.meta.hot.dispose(() => {
        SPHERE_GEO.dispose();
        BOX_GEO.dispose();
        CONE_GEO.dispose();
        CYL_GEO.dispose();
    });
}

export const NodesRenderer: FC = memo(() => {
    const nodes        = useModelStore((state) => state.nodes);
    const selectedIds  = useModelStore((state) => state.selectedIds);
    const select       = useModelStore((state) => state.select);
    const analysisResults   = useModelStore((state) => state.analysisResults);
    const displacementScale = useModelStore((state) => state.displacementScale);

    // Stable scratch objects — allocated once, reused every update to avoid GC pressure
    const tempObjectRef = useRef(new THREE.Object3D());
    const colorRef      = useRef(new THREE.Color());

    // Dispose scratch objects on unmount
    useEffect(() => {
        return () => {
            // THREE.Object3D has no dispose, but Color is pure JS — nothing to do.
            // This effect is here as a placeholder for future cleanup if needed.
        };
    }, []);

    // Group nodes by type for distinct rendering
    const { freeNodes, fixedNodes, pinnedNodes, rollerNodes } = useMemo(() => {
        const free: Node[] = [];
        const fixed: Node[] = [];
        const pinned: Node[] = [];
        const roller: Node[] = [];

        nodes.forEach(node => {
            // Skip nodes with invalid positions
            if (isNaN(node.x) || isNaN(node.y) || isNaN(node.z)) {
                console.warn(`[NodesRenderer] Node ${node.id} has invalid position (NaN)`);
                return;
            }
            
            const r = node.restraints;
            if (!r) {
                free.push(node);
                return;
            }
            if (r.fx && r.fy && r.fz && r.mx && r.my && r.mz) {
                fixed.push(node);
            } else if (r.fx && r.fy && r.fz) {
                pinned.push(node);
            } else if (r.fy) { // Check vertical restraint for roller
                roller.push(node);
            } else {
                free.push(node);
            }
        });

        return { freeNodes: free, fixedNodes: fixed, pinnedNodes: pinned, rollerNodes: roller };
    }, [nodes]);

    // Refs for meshes
    const freeRef = useRef<THREE.InstancedMesh>(null);
    const fixedRef = useRef<THREE.InstancedMesh>(null);
    const pinnedRef = useRef<THREE.InstancedMesh>(null);
    const rollerRef = useRef<THREE.InstancedMesh>(null);

    // Helper to update instance mesh
    const updateMesh = (
        mesh: THREE.InstancedMesh | null,
        nodeList: Node[],
        rotationOffset?: THREE.Euler
    ) => {
        if (!mesh) return;

        const tempObject = tempObjectRef.current;
        const color = colorRef.current;

        nodeList.forEach((node, index) => {
            const displacement = analysisResults?.displacements.get(node.id);
            const x = node.x + (displacement ? displacement.dx * displacementScale : 0);
            const y = node.y + (displacement ? displacement.dy * displacementScale : 0);
            const z = node.z + (displacement ? displacement.dz * displacementScale : 0);

            tempObject.position.set(x, y, z);
            if (rotationOffset) tempObject.setRotationFromEuler(rotationOffset);
            tempObject.updateMatrix();
            mesh.setMatrixAt(index, tempObject.matrix);

            // Color Logic
            if (selectedIds.has(node.id)) {
                color.set('#ff00ff'); // Selected
            } else if (displacement) {
                color.set('#ff4444'); // Displaced
            } else {
                // Type specific colors
                if (mesh === fixedRef.current) color.set('#4a5568'); // Dark Grey
                else if (mesh === pinnedRef.current) color.set('#48bb78'); // Green
                else if (mesh === rollerRef.current) color.set('#4299e1'); // Blue
                else color.set('#ff6b00'); // Default Orange
            }
            mesh.setColorAt(index, color);
        });

        mesh.instanceMatrix.needsUpdate = true;
        if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    };

    useLayoutEffect(() => {
        updateMesh(freeRef.current, freeNodes);
        updateMesh(fixedRef.current, fixedNodes);
        updateMesh(pinnedRef.current, pinnedNodes, new THREE.Euler(0, 0, 0)); // Cone upright
        updateMesh(rollerRef.current, rollerNodes, new THREE.Euler(Math.PI / 2, 0, 0)); // Cylinder on side
    }, [nodes, selectedIds, analysisResults, displacementScale, freeNodes, fixedNodes, pinnedNodes, rollerNodes]);

    // Interaction handler
    const makeHandler = (nodeList: Node[]) => (e: any) => {
        e.stopPropagation();
        const instanceId = e.instanceId;
        if (instanceId !== undefined && nodeList[instanceId]) {
            select(nodeList[instanceId].id, e.shiftKey || e.metaKey);
        }
    };

    return (
        <group>
            {/* FREE NODES - SPHERES */}
            {freeNodes.length > 0 && (
                <instancedMesh
                    ref={freeRef}
                    args={[undefined, undefined, freeNodes.length]}
                    onClick={makeHandler(freeNodes)}
                    onPointerOver={() => document.body.style.cursor = 'pointer'}
                    onPointerOut={() => document.body.style.cursor = 'auto'}
                >
                    <primitive object={SPHERE_GEO} />
                    <meshStandardMaterial color="#ff6b00" />
                </instancedMesh>
            )}

            {/* FIXED SUPPORTS - BOX */}
            {fixedNodes.length > 0 && (
                <instancedMesh
                    ref={fixedRef}
                    args={[undefined, undefined, fixedNodes.length]}
                    onClick={makeHandler(fixedNodes)}
                    onPointerOver={() => document.body.style.cursor = 'pointer'}
                    onPointerOut={() => document.body.style.cursor = 'auto'}
                >
                    <primitive object={BOX_GEO} />
                    <meshStandardMaterial color="#4a5568" />
                </instancedMesh>
            )}

            {/* PINNED SUPPORTS - CONE */}
            {pinnedNodes.length > 0 && (
                <instancedMesh
                    ref={pinnedRef}
                    args={[undefined, undefined, pinnedNodes.length]}
                    onClick={makeHandler(pinnedNodes)}
                    onPointerOver={() => document.body.style.cursor = 'pointer'}
                    onPointerOut={() => document.body.style.cursor = 'auto'}
                >
                    <primitive object={CONE_GEO} />
                    <meshStandardMaterial color="#48bb78" />
                </instancedMesh>
            )}

            {/* ROLLER SUPPORTS - CYLINDER */}
            {rollerNodes.length > 0 && (
                <instancedMesh
                    ref={rollerRef}
                    args={[undefined, undefined, rollerNodes.length]}
                    onClick={makeHandler(rollerNodes)}
                    onPointerOver={() => document.body.style.cursor = 'pointer'}
                    onPointerOut={() => document.body.style.cursor = 'auto'}
                >
                    <primitive object={CYL_GEO} />
                    <meshStandardMaterial color="#4299e1" />
                </instancedMesh>
            )}
        </group>
    );
});

NodesRenderer.displayName = 'NodesRenderer';
