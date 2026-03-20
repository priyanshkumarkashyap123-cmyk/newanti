/**
 * Overlays - HTML Overlays for 3D Canvas
 * 
 * Uses @react-three/drei Html component for DOM overlays in 3D space.
 * Features:
 * - Node labels with LOD (hide when camera far)
 * - Load value labels
 * - Support labels
 */

import { FC, useMemo } from 'react';
import { Html } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import { Vector3 } from 'three';

// ============================================
// TYPES
// ============================================

export interface NodeData {
    id: string;
    x: number;
    y: number;
    z: number;
    isSupport?: boolean;
}

export interface LoadData {
    id: string;
    nodeId: string;
    x: number;
    y: number;
    z: number;
    fx?: number;
    fy?: number;
    fz?: number;
}

export interface OverlaysProps {
    nodes: NodeData[];
    loads: LoadData[];
    showNodeLabels?: boolean;
    showLoadLabels?: boolean;
    maxLabelDistance?: number;  // LOD distance threshold
}

// ============================================
// NODE LABEL COMPONENT
// ============================================

interface NodeLabelProps {
    node: NodeData;
    maxDistance: number;
}

const NodeLabel: FC<NodeLabelProps> = ({ node, maxDistance }) => {
    const { camera } = useThree();

    // Calculate distance for LOD
    const position = useMemo(() => new Vector3(node.x, node.y, node.z), [node.x, node.y, node.z]);
    const cameraDistance = camera.position.distanceTo(position);

    // Hide if too far (LOD)
    if (cameraDistance > maxDistance) {
        return null;
    }

    // Scale opacity based on distance
    const opacity = Math.max(0.3, 1 - (cameraDistance / maxDistance) * 0.7);

    return (
        <Html
            position={[node.x, node.y, node.z]}
            center
            distanceFactor={10}
            zIndexRange={[100, 0]}
            occlude={false}
        >
            <div
                className="pointer-events-none select-none"
                style={{ opacity }}
            >
                <div className={`
                    px-1.5 py-0.5 rounded text-[10px] font-mono font-medium tracking-wide tracking-wide
                    ${node.isSupport
                        ? 'bg-green-500/90 text-[#dae2fd]'
                        : 'bg-blue-500/90 text-[#dae2fd]'
                    }
                    shadow-sm backdrop-blur-sm
                    whitespace-nowrap
                `}>
                    {node.id}
                </div>
            </div>
        </Html>
    );
};

// ============================================
// LOAD LABEL COMPONENT
// ============================================

interface LoadLabelProps {
    load: LoadData;
}

const LoadLabel: FC<LoadLabelProps> = ({ load }) => {
    // Calculate total magnitude
    const magnitude = Math.sqrt(
        (load.fx || 0) ** 2 +
        (load.fy || 0) ** 2 +
        (load.fz || 0) ** 2
    );

    if (magnitude === 0) return null;

    // Offset slightly from node position (above the load arrow)
    const offsetY = load.fy && load.fy < 0 ? -0.5 : 0.5;

    return (
        <Html
            position={[load.x, load.y + offsetY, load.z]}
            center
            distanceFactor={10}
            zIndexRange={[100, 0]}
            occlude={false}
        >
            <div className="pointer-events-none select-none">
                <div className="
                    bg-black/80 text-[#dae2fd] text-[10px] px-1 py-0.5 rounded
                    backdrop-blur-sm shadow-sm
                    font-mono whitespace-nowrap
                ">
                    {magnitude.toFixed(1)}kN
                </div>
            </div>
        </Html>
    );
};

// ============================================
// COORDINATE AXES LABELS
// ============================================

export const AxisLabels: FC = () => {
    return (
        <>
            {/* X Axis Label */}
            <Html position={[5, 0, 0]} center>
                <div className="text-red-500 font-bold text-xs pointer-events-none">X</div>
            </Html>

            {/* Y Axis Label */}
            <Html position={[0, 5, 0]} center>
                <div className="text-green-500 font-bold text-xs pointer-events-none">Y</div>
            </Html>

            {/* Z Axis Label */}
            <Html position={[0, 0, 5]} center>
                <div className="text-blue-500 font-bold text-xs pointer-events-none">Z</div>
            </Html>
        </>
    );
};

// ============================================
// MAIN OVERLAYS COMPONENT
// ============================================

export const Overlays: FC<OverlaysProps> = ({
    nodes,
    loads,
    showNodeLabels = true,
    showLoadLabels = true,
    maxLabelDistance = 50
}) => {
    return (
        <group name="overlays">
            {/* Node Labels */}
            {showNodeLabels && nodes.map((node) => (
                <NodeLabel
                    key={node.id}
                    node={node}
                    maxDistance={maxLabelDistance}
                />
            ))}

            {/* Load Labels */}
            {showLoadLabels && loads.map((load) => (
                <LoadLabel
                    key={load.id}
                    load={load}
                />
            ))}
        </group>
    );
};

export default Overlays;
