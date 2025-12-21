/**
 * useVibration Hook
 * Animates mode shapes for dynamic visualization
 */

import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { useModelStore } from '../store/model';
import * as THREE from 'three';

export interface VibrationState {
    time: number;
    phase: number;
    positions: Map<string, THREE.Vector3>;
}

export function useVibration() {
    const nodes = useModelStore((state) => state.nodes);
    const modalResults = useModelStore((state) => state.modalResults);
    const activeModeIndex = useModelStore((state) => state.activeModeIndex);
    const modeAmplitude = useModelStore((state) => state.modeAmplitude);
    const isAnimating = useModelStore((state) => state.isAnimating);
    const displacementScale = useModelStore((state) => state.displacementScale);

    const timeRef = useRef(0);

    // Get active mode
    const activeMode = useMemo(() => {
        if (!modalResults || !modalResults.modes.length) return null;
        const modeIdx = Math.min(activeModeIndex, modalResults.modes.length - 1);
        return modalResults.modes[modeIdx] ?? null;
    }, [modalResults, activeModeIndex]);

    // Calculate animated positions
    const getAnimatedPositions = useMemo(() => {
        return (elapsedTime: number): Map<string, THREE.Vector3> => {
            const positions = new Map<string, THREE.Vector3>();

            if (!activeMode || !isAnimating) {
                // Return original positions
                nodes.forEach((node, id) => {
                    positions.set(id, new THREE.Vector3(node.x, node.y, node.z));
                });
                return positions;
            }

            // Calculate sine wave phase
            const omega = activeMode.angularFrequency;
            const sine = Math.sin(omega * elapsedTime);
            const scale = modeAmplitude * displacementScale * 0.01;

            // Apply mode shape to each node
            nodes.forEach((node, nodeId) => {
                const modeShape = activeMode.shape.get(nodeId);
                if (modeShape && modeShape.length >= 3) {
                    const dx = (modeShape[0] ?? 0) * sine * scale;
                    const dy = (modeShape[1] ?? 0) * sine * scale;
                    const dz = (modeShape[2] ?? 0) * sine * scale;
                    positions.set(nodeId, new THREE.Vector3(
                        node.x + dx,
                        node.y + dy,
                        node.z + dz
                    ));
                } else {
                    positions.set(nodeId, new THREE.Vector3(node.x, node.y, node.z));
                }
            });

            return positions;
        };
    }, [nodes, activeMode, isAnimating, modeAmplitude, displacementScale]);

    return {
        activeMode,
        isAnimating,
        timeRef,
        getAnimatedPositions,
        frequency: activeMode?.frequency ?? 0,
        period: activeMode?.period ?? 0,
        modeNumber: activeMode?.modeNumber ?? 0
    };
}

/**
 * ModalAnimator Component
 * Updates node positions each frame for vibration animation
 */
export function useFrameVibration(
    meshRefs: Map<string, THREE.Mesh>,
    lineRefs?: Map<string, { start: string; end: string }>
) {
    const { getAnimatedPositions, isAnimating, activeMode } = useVibration();

    useFrame((state) => {
        if (!isAnimating || !activeMode) return;

        const positions = getAnimatedPositions(state.clock.elapsedTime);

        // Update mesh positions
        meshRefs.forEach((mesh, nodeId) => {
            const pos = positions.get(nodeId);
            if (pos && mesh) {
                mesh.position.copy(pos);
            }
        });

        // Update line positions if provided
        if (lineRefs) {
            lineRefs.forEach((endpoints, _lineId) => {
                const startPos = positions.get(endpoints.start);
                const endPos = positions.get(endpoints.end);
                // Line updates would need BufferGeometry updates
                // This is handled separately in the MemberRenderer
            });
        }
    });
}

export default useVibration;
