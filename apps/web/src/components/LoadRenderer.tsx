import { FC, useMemo } from 'react';
import * as THREE from 'three';
import { useModelStore } from '../store/model';

// ============================================
// LOAD RENDERER
// ============================================
// Renders visual indicators for applied loads:
// - Point Load: Arrow pointing in force direction
// - Arrow length scaled by magnitude

const ARROW_SCALE = 0.1; // Scale factor: 1 kN = 0.1 units
const MIN_ARROW_LENGTH = 0.5;
const ARROW_HEAD_LENGTH = 0.2;
const ARROW_HEAD_WIDTH = 0.15;

export const LoadRenderer: FC = () => {
    const nodes = useModelStore((state) => state.nodes);
    const loads = useModelStore((state) => state.loads);

    // Calculate arrow data for each load
    const arrows = useMemo(() => {
        return loads.map((load) => {
            const node = nodes.get(load.nodeId);
            if (!node) return null;

            // Force vector components (default to 0 if not specified)
            const fx = load.fx ?? 0;
            const fy = load.fy ?? 0;
            const fz = load.fz ?? 0;

            // Calculate magnitude
            const magnitude = Math.sqrt(fx * fx + fy * fy + fz * fz);
            if (magnitude < 0.001) return null;

            // Direction vector (normalized)
            const direction = new THREE.Vector3(fx, fy, fz).normalize();

            // Arrow length (scaled by magnitude, with minimum)
            const arrowLength = Math.max(magnitude * ARROW_SCALE, MIN_ARROW_LENGTH);

            // Origin: offset from node in opposite direction of force
            const origin = new THREE.Vector3(
                node.x - direction.x * arrowLength,
                node.y - direction.y * arrowLength,
                node.z - direction.z * arrowLength
            );

            return {
                id: load.id,
                origin,
                direction,
                length: arrowLength,
                magnitude,
                fx, fy, fz
            };
        }).filter(Boolean);
    }, [nodes, loads]);

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
                                ARROW_HEAD_LENGTH,
                                ARROW_HEAD_WIDTH
                            ]}
                        />

                        {/* Load label (magnitude) */}
                        <mesh position={[
                            arrow.origin.x + arrow.direction.x * arrow.length / 2,
                            arrow.origin.y + arrow.direction.y * arrow.length / 2 + 0.3,
                            arrow.origin.z + arrow.direction.z * arrow.length / 2
                        ]}>
                            <planeGeometry args={[0.8, 0.3]} />
                            <meshBasicMaterial color="#ff4444" transparent opacity={0.8} />
                        </mesh>
                    </group>
                )
            ))}
        </group>
    );
};
