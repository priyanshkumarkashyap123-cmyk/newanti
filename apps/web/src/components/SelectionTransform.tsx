import { FC, memo, useEffect, useRef } from 'react';
import * as THREE from 'three';
import { TransformControls } from '@react-three/drei';
import { useModelStore } from '../store/model';
import { useShallow } from 'zustand/react/shallow';

export const SelectionTransform: FC = memo(() => {
    const { selectedIds, updateNodePosition, nodes } = useModelStore(
        useShallow((state) => ({
            selectedIds: state.selectedIds,
            updateNodePosition: state.updateNodePosition,
            nodes: state.nodes,
        }))
    );

    // For now, we only support transforming a single selected node
    const selectedId = selectedIds.size === 1 ? Array.from(selectedIds)[0] : null;

    // Use a proxy object to attach the controls to (InstancedMesh pattern)
    // Initialize with null! to satisfy MutableRefObject type for TransformControls
    const proxyRef = useRef<THREE.Mesh>(null!);

    // Find the selected node
    const node = selectedId ? nodes.get(selectedId) : null;

    useEffect(() => {
        if (proxyRef.current && node) {
            proxyRef.current.position.set(node.x, node.y, node.z);
        }
    }, [node, selectedId]);

    if (!selectedId || !node) return null;

    return (
        <>
            {/* Invisible proxy object that the Controls attach to */}
            <mesh ref={proxyRef} visible={false}>
                <boxGeometry args={[0.1, 0.1, 0.1]} />
            </mesh>

            <TransformControls
                object={proxyRef}
                mode="translate"
                makeDefault // This automatically disables OrbitControls when dragging
                onObjectChange={() => {
                    if (proxyRef.current) {
                        const { x, y, z } = proxyRef.current.position;
                        // Sync back to store (which updates InstancedMesh)
                        updateNodePosition(selectedId, { x, y, z });
                    }
                }}
            />
        </>
    );
});
