import { FC, useMemo, memo } from 'react';
import * as THREE from 'three';
import { useModelStore } from '../store/model';

// ============================================
// LOAD RENDERER
// ============================================
// Renders visual indicators for applied loads:
// - Point Load: Arrow pointing in force direction
// - Arrow length scaled proportionally to structure size
// - 100 kN load = structure reference length (e.g., 1m beam = 1m arrow)

const ARROW_HEAD_RATIO = 0.2;  // Head length as ratio of arrow length
const ARROW_HEAD_WIDTH = 0.15;
const MIN_ARROW_LENGTH = 0.1;
const REFERENCE_LOAD = 100;    // 100 kN as reference magnitude

export const LoadRenderer: FC = memo(() => {
    const nodes = useModelStore((state) => state.nodes);
    const loads = useModelStore((state) => state.loads);
    const members = useModelStore((state) => state.members);

    // Calculate structure bounding box and reference scale
    const { referenceLength, maxLoadMagnitude } = useMemo(() => {
        // Get all node positions
        const positions: THREE.Vector3[] = [];
        nodes.forEach((node) => {
            positions.push(new THREE.Vector3(node.x, node.y, node.z));
        });

        if (positions.length < 2) {
            return { referenceLength: 1, maxLoadMagnitude: 100 };
        }

        // Calculate bounding box
        const box = new THREE.Box3();
        positions.forEach(p => box.expandByPoint(p));
        const size = new THREE.Vector3();
        box.getSize(size);

        // Reference length = max dimension of structure
        const refLen = Math.max(size.x, size.y, size.z, 1);

        // Find max load magnitude
        let maxMag = REFERENCE_LOAD;
        loads.forEach((load) => {
            const fx = load.fx ?? 0;
            const fy = load.fy ?? 0;
            const fz = load.fz ?? 0;
            const mag = Math.sqrt(fx * fx + fy * fy + fz * fz);
            if (mag > maxMag) maxMag = mag;
        });

        return { referenceLength: refLen, maxLoadMagnitude: maxMag };
    }, [nodes, loads, members]);

    // Calculate arrow data for each load
    const arrows = useMemo(() => {
        // Scale factor: referenceLength per REFERENCE_LOAD kN
        // So 100 kN load = referenceLength arrow, smaller loads = proportionally smaller
        const scaleFactor = referenceLength / maxLoadMagnitude;

        return loads.map((load) => {
            const node = nodes.get(load.nodeId);
            if (!node) return null;

            // Force vector components
            const fx = load.fx ?? 0;
            const fy = load.fy ?? 0;
            const fz = load.fz ?? 0;

            // Calculate magnitude
            const magnitude = Math.sqrt(fx * fx + fy * fy + fz * fz);
            if (magnitude < 0.001) return null;

            // Direction vector (normalized)
            const direction = new THREE.Vector3(fx, fy, fz).normalize();

            // Arrow length scaled to structure size
            // If structure is 5m and max load is 100kN, 100kN arrow = 5m
            const arrowLength = Math.max(magnitude * scaleFactor, MIN_ARROW_LENGTH);

            // Clamp arrow length to reasonable bounds (10% to 100% of reference)
            const clampedLength = Math.min(arrowLength, referenceLength);

            // Origin: offset from node in opposite direction of force
            const origin = new THREE.Vector3(
                node.x - direction.x * clampedLength,
                node.y - direction.y * clampedLength,
                node.z - direction.z * clampedLength
            );

            // Dynamic head size based on arrow length
            const headLength = Math.min(clampedLength * ARROW_HEAD_RATIO, 0.3);
            const headWidth = Math.min(headLength * 0.8, ARROW_HEAD_WIDTH);

            return {
                id: load.id,
                origin,
                direction,
                length: clampedLength,
                headLength,
                headWidth,
                magnitude,
                fx, fy, fz
            };
        }).filter(Boolean);
    }, [nodes, loads, referenceLength, maxLoadMagnitude]);

    return (
        <group name="loads">
            {arrows.map((arrow) => (
                arrow && (
                    <group key={arrow.id}>
                        {/* Arrow Helper */}
                        <arrowHelper
                            args={[
                                arrow.direction,
                                arrow.origin,
                                arrow.length,
                                '#ff4444', // Red color for loads
                                arrow.headLength,
                                arrow.headWidth
                            ]}
                        />

                        {/* Load label (magnitude) */}
                        <mesh position={[
                            arrow.origin.x + arrow.direction.x * arrow.length / 2,
                            arrow.origin.y + arrow.direction.y * arrow.length / 2 + 0.2,
                            arrow.origin.z + arrow.direction.z * arrow.length / 2
                        ]}>
                            <planeGeometry args={[0.6, 0.25]} />
                            <meshBasicMaterial color="#ff4444" transparent opacity={0.8} />
                        </mesh>
                    </group>
                )
            ))}
        </group>
    );
});

LoadRenderer.displayName = 'LoadRenderer';

