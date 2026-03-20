/**
 * ModeShapeRenderer.tsx - 3D Mode Shape Visualization
 * 
 * Renders animated mode shapes from modal/buckling analysis:
 * - Smooth oscillation animation
 * - Color gradient based on displacement magnitude
 * - Wireframe/solid toggle
 * - Scale factor control
 */

import { FC, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Line } from '@react-three/drei';
import * as THREE from 'three';

// ============================================
// TYPES
// ============================================

export interface ModeShapeData {
    modeNumber: number;
    frequency?: number;
    displacements: Array<{
        nodeId: string;
        dx: number;
        dy: number;
        dz: number;
    }>;
}

interface NodePosition {
    id: string;
    x: number;
    y: number;
    z: number;
}

interface MemberData {
    id: string;
    startNodeId: string;
    endNodeId: string;
}

interface ModeShapeRendererProps {
    nodes: NodePosition[];
    members: MemberData[];
    modeShape: ModeShapeData;
    scale?: number;
    animate?: boolean;
    showOriginal?: boolean;
    colorScheme?: 'displacement' | 'stress' | 'uniform';
}

// ============================================
// CONSTANTS
// ============================================

const MIN_COLOR = new THREE.Color('#3b82f6'); // Blue - min displacement
const MID_CYAN_COLOR = new THREE.Color('#06b6d4'); // Cyan
const MID_GREEN_COLOR = new THREE.Color('#22c55e'); // Green
const MID_YELLOW_COLOR = new THREE.Color('#eab308'); // Yellow
const MAX_COLOR = new THREE.Color('#ef4444'); // Red - max displacement
const ORIGINAL_COLOR = new THREE.Color('#6b7280'); // Gray - original shape
const ANIMATION_SPEED = 2.0; // Oscillations per second

// ============================================
// ANIMATED MEMBER LINE COMPONENT
// ============================================

interface AnimatedMemberProps {
    startOriginal: THREE.Vector3;
    endOriginal: THREE.Vector3;
    startDisp: THREE.Vector3;
    endDisp: THREE.Vector3;
    scale: number;
    animate: boolean;
    maxDisp: number;
}

const AnimatedMember: FC<AnimatedMemberProps> = ({
    startOriginal,
    endOriginal,
    startDisp,
    endDisp,
    scale,
    animate,
    maxDisp,
}) => {
    const ref = useRef<THREE.Group>(null);
    const phase = useRef(0);

    // Calculate color based on displacement magnitude
    const startMag = startDisp.length();
    const endMag = endDisp.length();
    const avgMag = (startMag + endMag) / 2;
    const normalizedDisp = maxDisp > 0 ? avgMag / maxDisp : 0;
    
    const color = useMemo(() => {
        // 5-stop gradient: blue → cyan → green → yellow → red per Figma §11.5
        const stops = [MIN_COLOR, MID_CYAN_COLOR, MID_GREEN_COLOR, MID_YELLOW_COLOR, MAX_COLOR];
        const t = Math.max(0, Math.min(1, normalizedDisp));
        const segment = t * (stops.length - 1);
        const i = Math.min(Math.floor(segment), stops.length - 2);
        const frac = segment - i;
        return stops[i]!.clone().lerp(stops[i + 1]!, frac);
    }, [normalizedDisp]);

    // Animation
    useFrame((_, delta) => {
        if (!animate || !ref.current) return;
        
        phase.current += delta * ANIMATION_SPEED * Math.PI * 2;
        const factor = Math.sin(phase.current) * scale;

        // Update line positions
        const line = ref.current.children[0] as THREE.Line;
        if (line?.geometry) {
            const positions = line.geometry.attributes.position as THREE.BufferAttribute;
            
            // Start point
            positions.setXYZ(
                0,
                startOriginal.x + startDisp.x * factor,
                startOriginal.y + startDisp.y * factor,
                startOriginal.z + startDisp.z * factor
            );
            
            // End point
            positions.setXYZ(
                1,
                endOriginal.x + endDisp.x * factor,
                endOriginal.y + endDisp.y * factor,
                endOriginal.z + endDisp.z * factor
            );
            
            positions.needsUpdate = true;
        }
    });

    const points = useMemo(() => [
        [startOriginal.x + startDisp.x * scale, startOriginal.y + startDisp.y * scale, startOriginal.z + startDisp.z * scale],
        [endOriginal.x + endDisp.x * scale, endOriginal.y + endDisp.y * scale, endOriginal.z + endDisp.z * scale],
    ] as [number, number, number][], [startOriginal, endOriginal, startDisp, endDisp, scale]);

    return (
        <group ref={ref}>
            <Line
                points={points}
                color={color}
                lineWidth={3}
            />
        </group>
    );
};

// ============================================
// MAIN COMPONENT
// ============================================

export const ModeShapeRenderer: FC<ModeShapeRendererProps> = ({
    nodes,
    members,
    modeShape,
    scale = 1.0,
    animate = true,
    showOriginal = true,
    colorScheme = 'displacement',
}) => {
    // Create node position map
    const nodeMap = useMemo(() => {
        const map = new Map<string, THREE.Vector3>();
        for (const node of nodes) {
            map.set(node.id, new THREE.Vector3(node.x, node.y, node.z));
        }
        return map;
    }, [nodes]);

    // Create displacement map
    const dispMap = useMemo(() => {
        const map = new Map<string, THREE.Vector3>();
        for (const d of modeShape.displacements) {
            map.set(d.nodeId, new THREE.Vector3(d.dx, d.dy, d.dz));
        }
        return map;
    }, [modeShape.displacements]);

    // Calculate max displacement for color scaling
    const maxDisplacement = useMemo(() => {
        let max = 0;
        for (const d of modeShape.displacements) {
            const mag = Math.sqrt(d.dx * d.dx + d.dy * d.dy + d.dz * d.dz);
            if (mag > max) max = mag;
        }
        return max;
    }, [modeShape.displacements]);

    // Original structure lines (wireframe)
    const originalLines = useMemo(() => {
        if (!showOriginal) return null;

        const lines: Array<[THREE.Vector3, THREE.Vector3]> = [];
        for (const member of members) {
            const start = nodeMap.get(member.startNodeId);
            const end = nodeMap.get(member.endNodeId);
            if (start && end) {
                lines.push([start.clone(), end.clone()]);
            }
        }
        return lines;
    }, [members, nodeMap, showOriginal]);

    // Deformed structure
    const deformedMembers = useMemo(() => {
        return members.map((member) => {
            const startPos = nodeMap.get(member.startNodeId) || new THREE.Vector3();
            const endPos = nodeMap.get(member.endNodeId) || new THREE.Vector3();
            const startDisp = dispMap.get(member.startNodeId) || new THREE.Vector3();
            const endDisp = dispMap.get(member.endNodeId) || new THREE.Vector3();

            return {
                id: member.id,
                startOriginal: startPos,
                endOriginal: endPos,
                startDisp,
                endDisp,
            };
        });
    }, [members, nodeMap, dispMap]);

    return (
        <group>
            {/* Original structure (wireframe) */}
            {showOriginal && originalLines && originalLines.map((line, idx) => (
                <Line
                    key={`orig-${idx}`}
                    points={[
                        [line[0].x, line[0].y, line[0].z],
                        [line[1].x, line[1].y, line[1].z],
                    ]}
                    color={ORIGINAL_COLOR}
                    lineWidth={1}
                    dashed
                    dashSize={0.1}
                    gapSize={0.05}
                />
            ))}

            {/* Deformed structure (animated) */}
            {deformedMembers.map((member) => (
                <AnimatedMember
                    key={member.id}
                    startOriginal={member.startOriginal}
                    endOriginal={member.endOriginal}
                    startDisp={member.startDisp}
                    endDisp={member.endDisp}
                    scale={scale}
                    animate={animate}
                    maxDisp={maxDisplacement}
                />
            ))}

            {/* Node markers at max displacement locations */}
            {modeShape.displacements
                .filter((d) => {
                    const mag = Math.sqrt(d.dx * d.dx + d.dy * d.dy + d.dz * d.dz);
                    return mag > maxDisplacement * 0.5; // Show nodes with >50% of max disp
                })
                .map((d) => {
                    const pos = nodeMap.get(d.nodeId);
                    if (!pos) return null;
                    const mag = Math.sqrt(d.dx * d.dx + d.dy * d.dy + d.dz * d.dz);
                    const normalizedMag = maxDisplacement > 0 ? mag / maxDisplacement : 0;
                    // 5-stop gradient: blue → cyan → green → yellow → red
                    const stops = [MIN_COLOR, MID_CYAN_COLOR, MID_GREEN_COLOR, MID_YELLOW_COLOR, MAX_COLOR];
                    const t = Math.max(0, Math.min(1, normalizedMag));
                    const seg = t * (stops.length - 1);
                    const idx = Math.min(Math.floor(seg), stops.length - 2);
                    const color = stops[idx]!.clone().lerp(stops[idx + 1]!, seg - idx);

                    return (
                        <mesh
                            key={d.nodeId}
                            position={[
                                pos.x + d.dx * scale,
                                pos.y + d.dy * scale,
                                pos.z + d.dz * scale,
                            ]}
                        >
                            <sphereGeometry args={[0.05, 16, 16]} />
                            <meshStandardMaterial color={color} />
                        </mesh>
                    );
                })}
        </group>
    );
};

// ============================================
// MODE SHAPE CONTROLS COMPONENT
// ============================================

interface ModeShapeControlsProps {
    scale: number;
    onScaleChange: (scale: number) => void;
    animate: boolean;
    onAnimateChange: (animate: boolean) => void;
    showOriginal: boolean;
    onShowOriginalChange: (show: boolean) => void;
    modeInfo?: {
        modeNumber: number;
        frequency?: number;
        period?: number;
    };
}

export const ModeShapeControls: FC<ModeShapeControlsProps> = ({
    scale,
    onScaleChange,
    animate,
    onAnimateChange,
    showOriginal,
    onShowOriginalChange,
    modeInfo,
}) => {
    return (
        <div className="absolute bottom-4 left-4 bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm rounded-lg p-3 shadow-lg">
            {/* Mode Info */}
            {modeInfo && (
                <div className="mb-3 pb-3 border-b border-[#1a2333]">
                    <div className="text-sm font-medium tracking-wide tracking-wide">Mode {modeInfo.modeNumber}</div>
                    {modeInfo.frequency !== undefined && (
                        <div className="text-xs text-slate-500">
                            f = {modeInfo.frequency.toFixed(3)} Hz
                        </div>
                    )}
                    {modeInfo.period !== undefined && (
                        <div className="text-xs text-slate-500">
                            T = {modeInfo.period.toFixed(3)} s
                        </div>
                    )}
                </div>
            )}

            {/* Scale Slider */}
            <div className="mb-3">
                <div className="flex justify-between text-xs text-slate-500 mb-1">
                    <span>Scale Factor</span>
                    <span>{scale.toFixed(1)}x</span>
                </div>
                <input
                    type="range"
                    min={0.1}
                    max={5.0}
                    step={0.1}
                    value={scale}
                    onChange={(e) => onScaleChange(parseFloat(e.target.value))}
                    className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer dark:bg-slate-700"
                />
            </div>

            {/* Toggle Buttons */}
            <div className="flex gap-2">
                <button type="button"
                    onClick={() => onAnimateChange(!animate)}
                    className={`
                        flex-1 px-2 py-1 text-xs rounded transition-colors
                        ${animate 
                            ? 'bg-blue-500 text-white' 
                            : 'bg-slate-200 dark:bg-slate-700 text-[#adc6ff]'}
                    `}
                >
                    {animate ? '⏸ Pause' : '▶ Animate'}
                </button>
                <button type="button"
                    onClick={() => onShowOriginalChange(!showOriginal)}
                    className={`
                        flex-1 px-2 py-1 text-xs rounded transition-colors
                        ${showOriginal 
                            ? 'bg-slate-500 text-[#dae2fd]' 
                            : 'bg-slate-200 dark:bg-slate-700 text-[#adc6ff]'}
                    `}
                >
                    {showOriginal ? 'Hide Original' : 'Show Original'}
                </button>
            </div>

            {/* Color Legend */}
            <div className="mt-3 pt-3 border-t border-[#1a2333]">
                <div className="text-xs text-slate-500 mb-1">Displacement</div>
                <div className="flex items-center gap-2">
                    <div className="text-xs">Min</div>
                    <div 
                        className="flex-1 h-2 rounded"
                        style={{
                            background: 'linear-gradient(to right, #3b82f6, #ef4444)',
                        }}
                    />
                    <div className="text-xs">Max</div>
                </div>
            </div>
        </div>
    );
};

export default ModeShapeRenderer;
