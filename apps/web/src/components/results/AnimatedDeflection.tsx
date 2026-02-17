/**
 * AnimatedDeflection.tsx - Smooth Animated Deflection Visualization
 * 
 * Features:
 * - Smooth oscillating animation between original and deflected shapes
 * - Customizable animation speed and amplitude
 * - Gradient coloring based on displacement magnitude
 * - Cubic spline interpolation for curved deflection shapes
 * - Ghost original structure overlay
 * - Displacement magnitude labels
 */

import { FC, useMemo, useRef, useEffect, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Line, Html, Text } from '@react-three/drei';
import * as THREE from 'three';

// ============================================
// TYPES
// ============================================

export interface NodeDisplacement {
    nodeId: string;
    dx: number;  // meters
    dy: number;
    dz: number;
    rx?: number;
    ry?: number;
    rz?: number;
    magnitude?: number;
}

export interface MemberGeometry {
    id: string;
    startNodeId: string;
    endNodeId: string;
    intermediatePoints?: Array<{
        position: number;  // 0-1 along member
        displacement: [number, number, number];
    }>;
}

export interface NodePosition {
    id: string;
    x: number;
    y: number;
    z: number;
}

export interface AnimatedDeflectionProps {
    nodes: NodePosition[];
    members: MemberGeometry[];
    displacements: NodeDisplacement[];
    scale?: number;
    animationSpeed?: number;
    showOriginal?: boolean;
    showLabels?: boolean;
    showMagnitudeLabels?: boolean;
    colorByMagnitude?: boolean;
    maxDisplacementLimit?: number;
    onNodeClick?: (nodeId: string) => void;
}

// ============================================
// CONSTANTS
// ============================================

const COLOR_MIN = new THREE.Color('#3b82f6');      // Blue - low displacement
const COLOR_MID = new THREE.Color('#22c55e');      // Green - medium
const COLOR_HIGH = new THREE.Color('#ef4444');     // Red - high displacement
const ORIGINAL_COLOR = new THREE.Color('#6b7280'); // Gray - original shape
const DEFAULT_ANIMATION_SPEED = 1.5;
const INTERPOLATION_SEGMENTS = 20;

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Get color based on normalized displacement (0-1)
 */
function getDisplacementColor(normalized: number): THREE.Color {
    const clamped = Math.max(0, Math.min(1, normalized));

    if (clamped <= 0.5) {
        const t = clamped * 2;
        return COLOR_MIN.clone().lerp(COLOR_MID, t);
    } else {
        const t = (clamped - 0.5) * 2;
        return COLOR_MID.clone().lerp(COLOR_HIGH, t);
    }
}

/**
 * Cubic Hermite spline interpolation for smooth curves
 */
function hermiteInterpolate(
    p0: THREE.Vector3,
    p1: THREE.Vector3,
    m0: THREE.Vector3,
    m1: THREE.Vector3,
    t: number
): THREE.Vector3 {
    const t2 = t * t;
    const t3 = t2 * t;

    const h00 = 2 * t3 - 3 * t2 + 1;
    const h10 = t3 - 2 * t2 + t;
    const h01 = -2 * t3 + 3 * t2;
    const h11 = t3 - t2;

    return new THREE.Vector3()
        .addScaledVector(p0, h00)
        .addScaledVector(m0, h10)
        .addScaledVector(p1, h01)
        .addScaledVector(m1, h11);
}

/**
 * Calculate displacement magnitude
 */
function getDisplacementMagnitude(d: NodeDisplacement): number {
    return Math.sqrt(d.dx * d.dx + d.dy * d.dy + d.dz * d.dz);
}

// ============================================
// ANIMATED MEMBER COMPONENT
// ============================================

interface AnimatedMemberLineProps {
    startOriginal: THREE.Vector3;
    endOriginal: THREE.Vector3;
    startDisp: THREE.Vector3;
    endDisp: THREE.Vector3;
    scale: number;
    animationSpeed: number;
    maxMagnitude: number;
    colorByMagnitude: boolean;
    showOriginal: boolean;
    segments?: number;
}

const AnimatedMemberLine: FC<AnimatedMemberLineProps> = ({
    startOriginal,
    endOriginal,
    startDisp,
    endDisp,
    scale,
    animationSpeed,
    maxMagnitude,
    colorByMagnitude,
    showOriginal,
    segments = INTERPOLATION_SEGMENTS
}) => {
    const lineRef = useRef<THREE.Line>(null);
    const phaseRef = useRef(0);

    // Pre-calculate spline control points
    const controlPoints = useMemo(() => {
        const points: THREE.Vector3[] = [];
        const colors: THREE.Color[] = [];

        // Generate interpolated points
        for (let i = 0; i <= segments; i++) {
            const t = i / segments;

            // Original position (linear interpolation)
            const original = new THREE.Vector3().lerpVectors(startOriginal, endOriginal, t);

            // Displacement (linear interpolation for now)
            const disp = new THREE.Vector3().lerpVectors(startDisp, endDisp, t);

            points.push(original);

            // Color based on displacement magnitude at this point
            if (colorByMagnitude) {
                const mag = disp.length();
                const normalized = maxMagnitude > 0 ? mag / maxMagnitude : 0;
                colors.push(getDisplacementColor(normalized));
            } else {
                colors.push(new THREE.Color('#f97316')); // Orange
            }
        }

        return { points, colors };
    }, [startOriginal, endOriginal, startDisp, endDisp, segments, colorByMagnitude, maxMagnitude]);

    // Animation loop
    useFrame((_, delta) => {
        if (!lineRef.current) return;

        phaseRef.current += delta * animationSpeed * Math.PI * 2;
        const animFactor = Math.sin(phaseRef.current) * scale;

        const positions = lineRef.current.geometry.attributes.position as THREE.BufferAttribute;

        for (let i = 0; i <= segments; i++) {
            const t = i / segments;

            // Original position
            const original = new THREE.Vector3().lerpVectors(startOriginal, endOriginal, t);

            // Displacement
            const disp = new THREE.Vector3().lerpVectors(startDisp, endDisp, t);

            // Apply animated displacement
            positions.setXYZ(
                i,
                original.x + disp.x * animFactor,
                original.y + disp.y * animFactor,
                original.z + disp.z * animFactor
            );
        }

        positions.needsUpdate = true;
    });

    // Create geometry with initial positions
    const geometry = useMemo(() => {
        const geo = new THREE.BufferGeometry();

        const positions = new Float32Array((segments + 1) * 3);
        const colors = new Float32Array((segments + 1) * 3);

        for (let i = 0; i <= segments; i++) {
            const point = controlPoints.points[i]!;
            const color = controlPoints.colors[i]!;

            positions[i * 3] = point.x;
            positions[i * 3 + 1] = point.y;
            positions[i * 3 + 2] = point.z;

            colors[i * 3] = color.r;
            colors[i * 3 + 1] = color.g;
            colors[i * 3 + 2] = color.b;
        }

        geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

        return geo;
    }, [controlPoints, segments]);

    return (
        <group>
            {/* Original shape (ghost) */}
            {showOriginal && (
                <Line
                    points={[
                        [startOriginal.x, startOriginal.y, startOriginal.z],
                        [endOriginal.x, endOriginal.y, endOriginal.z]
                    ]}
                    color={ORIGINAL_COLOR}
                    lineWidth={1}
                    dashed
                    dashSize={0.1}
                    gapSize={0.05}
                    opacity={0.5}
                    transparent
                />
            )}

            {/* Animated deflected shape */}
            {/* @ts-ignore */}
            <line ref={lineRef} geometry={geometry}>
                <lineBasicMaterial vertexColors linewidth={3} />
            </line>
        </group>
    );
};

// ============================================
// ANIMATED NODE COMPONENT
// ============================================

interface AnimatedNodeProps {
    originalPos: THREE.Vector3;
    displacement: THREE.Vector3;
    scale: number;
    animationSpeed: number;
    magnitude: number;
    maxMagnitude: number;
    showLabel: boolean;
    nodeId: string;
    onClick?: () => void;
}

const AnimatedNode: FC<AnimatedNodeProps> = ({
    originalPos,
    displacement,
    scale,
    animationSpeed,
    magnitude,
    maxMagnitude,
    showLabel,
    nodeId,
    onClick
}) => {
    const meshRef = useRef<THREE.Mesh>(null);
    const phaseRef = useRef(0);
    const [hovered, setHovered] = useState(false);

    const color = useMemo(() => {
        const normalized = maxMagnitude > 0 ? magnitude / maxMagnitude : 0;
        return getDisplacementColor(normalized);
    }, [magnitude, maxMagnitude]);

    useFrame((_, delta) => {
        if (!meshRef.current) return;

        phaseRef.current += delta * animationSpeed * Math.PI * 2;
        const animFactor = Math.sin(phaseRef.current) * scale;

        meshRef.current.position.set(
            originalPos.x + displacement.x * animFactor,
            originalPos.y + displacement.y * animFactor,
            originalPos.z + displacement.z * animFactor
        );
    });

    return (
        <group>
            <mesh
                ref={meshRef}
                onClick={onClick}
                onPointerEnter={() => setHovered(true)}
                onPointerLeave={() => setHovered(false)}
            >
                <sphereGeometry args={[hovered ? 0.08 : 0.05, 16, 16]} />
                <meshStandardMaterial
                    color={color}
                    emissive={color}
                    emissiveIntensity={hovered ? 0.5 : 0.2}
                />
            </mesh>

            {/* Displacement label */}
            {showLabel && magnitude > 0.001 && (
                <Html
                    position={[
                        originalPos.x + displacement.x * scale + 0.1,
                        originalPos.y + displacement.y * scale + 0.1,
                        originalPos.z + displacement.z * scale
                    ]}
                    center
                    style={{ pointerEvents: 'none' }}
                >
                    <div className="bg-black/80 text-white text-xs px-1.5 py-0.5 rounded whitespace-nowrap">
                        {(magnitude * 1000).toFixed(2)} mm
                    </div>
                </Html>
            )}
        </group>
    );
};

// ============================================
// MAIN COMPONENT
// ============================================

export const AnimatedDeflection: FC<AnimatedDeflectionProps> = ({
    nodes,
    members,
    displacements,
    scale = 50,
    animationSpeed = DEFAULT_ANIMATION_SPEED,
    showOriginal = true,
    showLabels = false,
    showMagnitudeLabels = false,
    colorByMagnitude = true,
    maxDisplacementLimit,
    onNodeClick
}) => {
    // Create node position map
    const nodeMap = useMemo(() => {
        const map = new Map<string, THREE.Vector3>();
        for (const node of nodes) {
            map.set(node.id, new THREE.Vector3(node.x, node.y, node.z));
        }
        return map;
    }, [nodes]);

    // Create displacement map with magnitudes
    const dispMap = useMemo(() => {
        const map = new Map<string, { vec: THREE.Vector3; magnitude: number }>();
        for (const d of displacements) {
            const vec = new THREE.Vector3(d.dx, d.dy, d.dz);
            const magnitude = d.magnitude ?? getDisplacementMagnitude(d);
            map.set(d.nodeId, { vec, magnitude });
        }
        return map;
    }, [displacements]);

    // Calculate max displacement for normalization
    const maxMagnitude = useMemo(() => {
        if (maxDisplacementLimit) return maxDisplacementLimit;

        let max = 0;
        for (const d of displacements) {
            const mag = d.magnitude ?? getDisplacementMagnitude(d);
            if (mag > max) max = mag;
        }
        return max;
    }, [displacements, maxDisplacementLimit]);

    // Prepare member data
    const memberData = useMemo(() => {
        return members.map((member) => {
            const startPos = nodeMap.get(member.startNodeId) || new THREE.Vector3();
            const endPos = nodeMap.get(member.endNodeId) || new THREE.Vector3();
            const startDispData = dispMap.get(member.startNodeId);
            const endDispData = dispMap.get(member.endNodeId);

            return {
                id: member.id,
                startOriginal: startPos,
                endOriginal: endPos,
                startDisp: startDispData?.vec || new THREE.Vector3(),
                endDisp: endDispData?.vec || new THREE.Vector3()
            };
        });
    }, [members, nodeMap, dispMap]);

    // Filter significant displacement nodes for markers
    const significantNodes = useMemo(() => {
        const threshold = maxMagnitude * 0.3; // Show nodes with >30% of max displacement

        return displacements
            .filter(d => {
                const mag = d.magnitude ?? getDisplacementMagnitude(d);
                return mag > threshold;
            })
            .map(d => ({
                ...d,
                magnitude: d.magnitude ?? getDisplacementMagnitude(d),
                originalPos: nodeMap.get(d.nodeId) || new THREE.Vector3(),
                dispVec: dispMap.get(d.nodeId)?.vec || new THREE.Vector3()
            }));
    }, [displacements, maxMagnitude, nodeMap, dispMap]);

    return (
        <group name="animated-deflection">
            {/* Animated members */}
            {memberData.map((member) => (
                <AnimatedMemberLine
                    key={member.id}
                    startOriginal={member.startOriginal}
                    endOriginal={member.endOriginal}
                    startDisp={member.startDisp}
                    endDisp={member.endDisp}
                    scale={scale}
                    animationSpeed={animationSpeed}
                    maxMagnitude={maxMagnitude}
                    colorByMagnitude={colorByMagnitude}
                    showOriginal={showOriginal}
                />
            ))}

            {/* Animated node markers */}
            {significantNodes.map((node) => (
                <AnimatedNode
                    key={node.nodeId}
                    originalPos={node.originalPos}
                    displacement={node.dispVec}
                    scale={scale}
                    animationSpeed={animationSpeed}
                    magnitude={node.magnitude}
                    maxMagnitude={maxMagnitude}
                    showLabel={showMagnitudeLabels}
                    nodeId={node.nodeId}
                    onClick={() => onNodeClick?.(node.nodeId)}
                />
            ))}
        </group>
    );
};

// ============================================
// DEFLECTION CONTROLS COMPONENT
// ============================================

interface DeflectionControlsProps {
    scale: number;
    onScaleChange: (scale: number) => void;
    speed: number;
    onSpeedChange: (speed: number) => void;
    showOriginal: boolean;
    onShowOriginalChange: (show: boolean) => void;
    showLabels: boolean;
    onShowLabelsChange: (show: boolean) => void;
    maxDisplacement: number;
}

export const DeflectionControls: FC<DeflectionControlsProps> = ({
    scale,
    onScaleChange,
    speed,
    onSpeedChange,
    showOriginal,
    onShowOriginalChange,
    showLabels,
    onShowLabelsChange,
    maxDisplacement
}) => {
    return (
        <div className="bg-slate-800/90 backdrop-blur rounded-lg p-4 space-y-4">
            <h4 className="text-sm font-semibold text-white mb-3">Deflection Animation</h4>

            {/* Scale control */}
            <div>
                <label className="flex items-center justify-between text-xs text-slate-400 mb-1">
                    <span>Scale Factor</span>
                    <span className="font-mono text-slate-300">{scale}x</span>
                </label>
                <input
                    type="range"
                    min="1"
                    max="200"
                    value={scale}
                    onChange={(e) => onScaleChange(Number(e.target.value))}
                    className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer"
                />
            </div>

            {/* Speed control */}
            <div>
                <label className="flex items-center justify-between text-xs text-slate-400 mb-1">
                    <span>Animation Speed</span>
                    <span className="font-mono text-slate-300">{speed.toFixed(1)}x</span>
                </label>
                <input
                    type="range"
                    min="0.1"
                    max="3"
                    step="0.1"
                    value={speed}
                    onChange={(e) => onSpeedChange(Number(e.target.value))}
                    className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer"
                />
            </div>

            {/* Toggle options */}
            <div className="flex flex-col gap-2">
                <label className="flex items-center gap-2 text-xs text-slate-400 cursor-pointer">
                    <input
                        type="checkbox"
                        checked={showOriginal}
                        onChange={(e) => onShowOriginalChange(e.target.checked)}
                        className="rounded bg-slate-700 border-slate-600"
                    />
                    Show Original Shape
                </label>

                <label className="flex items-center gap-2 text-xs text-slate-400 cursor-pointer">
                    <input
                        type="checkbox"
                        checked={showLabels}
                        onChange={(e) => onShowLabelsChange(e.target.checked)}
                        className="rounded bg-slate-700 border-slate-600"
                    />
                    Show Displacement Labels
                </label>
            </div>

            {/* Max displacement info */}
            <div className="pt-2 border-t border-slate-700">
                <div className="text-xs text-slate-400">
                    Max Displacement: <span className="text-cyan-400 font-mono">{(maxDisplacement * 1000).toFixed(4)} mm</span>
                </div>
            </div>
        </div>
    );
};

export default AnimatedDeflection;
