/**
 * StressOverlay.tsx - Analysis Results Visualization on 3D Model
 * 
 * Features:
 * - Heatmap coloring (blue → green → red)
 * - Floating moment/shear diagrams
 * - Deflected shape ghost structure
 * - Scale factor slider for deflection
 */

import { FC, useMemo, useState, useCallback, useEffect } from 'react';
import { Line, Html } from '@react-three/drei';
import * as THREE from 'three';

// ============================================
// TYPES
// ============================================

export interface NodeDisplacement {
    nodeId: string;
    dx: number;  // mm
    dy: number;  // mm
    dz: number;  // mm
    rx?: number;
    ry?: number;
    rz?: number;
}

export interface MemberForces {
    memberId: string;
    length: number;
    x_values: number[];
    shear_y: number[];
    shear_z: number[];
    moment_y: number[];
    moment_z: number[];
    axial: number[];
    deflection_y: number[];
    deflection_z: number[];
    max_moment_z: number;
    max_shear_y: number;
}

export interface NodePosition {
    id: string;
    x: number;
    y: number;
    z: number;
}

export interface MemberGeometry {
    id: string;
    startNodeId: string;
    endNodeId: string;
}

export type VisualizationMode = 'none' | 'stress' | 'diagram_moment' | 'diagram_shear' | 'deflected';

// ============================================
// CONSTANTS
// ============================================

const COLOR_LOW = new THREE.Color('#3b82f6');    // Blue - Low stress
const COLOR_MID = new THREE.Color('#22c55e');    // Green - Medium stress
const COLOR_HIGH = new THREE.Color('#ef4444');   // Red - High stress
const DEFLECTED_COLOR = '#f97316';               // Orange for deflected shape
const DIAGRAM_POSITIVE = '#ef4444';              // Red for positive moment
const DIAGRAM_NEGATIVE = '#3b82f6';              // Blue for negative moment

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Get stress color based on normalized value (0-1)
 * 0 = Blue, 0.5 = Green, 1.0 = Red
 */
export function getStressColor(value: number, maxStress: number): THREE.Color {
    const normalized = Math.min(Math.abs(value) / Math.max(maxStress, 0.001), 1);

    if (normalized <= 0.5) {
        // Blue to Green (0 to 0.5)
        const t = normalized * 2;
        return COLOR_LOW.clone().lerp(COLOR_MID, t);
    } else {
        // Green to Red (0.5 to 1.0)
        const t = (normalized - 0.5) * 2;
        return COLOR_MID.clone().lerp(COLOR_HIGH, t);
    }
}

/**
 * Get color as hex string
 */
export function getStressColorHex(value: number, maxStress: number): string {
    return '#' + getStressColor(value, maxStress).getHexString();
}

/**
 * Interpolate between two points
 */
function lerp(a: number, b: number, t: number): number {
    return a + (b - a) * t;
}

// ============================================
// MOMENT DIAGRAM COMPONENT
// ============================================

interface MomentDiagramProps {
    startPos: [number, number, number];
    endPos: [number, number, number];
    xValues: number[];
    momentValues: number[];
    scale: number;
    maxMoment: number;
    type: 'moment' | 'shear';
}

const ForcesDiagram: FC<MomentDiagramProps> = ({
    startPos,
    endPos,
    xValues,
    momentValues,
    scale,
    maxMoment,
    type
}) => {
    const { points, colors } = useMemo(() => {
        const start = new THREE.Vector3(...startPos);
        const end = new THREE.Vector3(...endPos);
        const memberLength = start.distanceTo(end);
        const direction = new THREE.Vector3().subVectors(end, start).normalize();

        // Perpendicular up direction for diagram
        const up = new THREE.Vector3(0, 1, 0);

        const pts: THREE.Vector3[] = [];
        const cols: THREE.Color[] = [];

        // Create diagram points
        for (let i = 0; i < xValues.length; i++) {
            const x = xValues[i];
            const value = momentValues[i];
            const t = x / memberLength;

            // Base point on member
            const basePoint = new THREE.Vector3().lerpVectors(start, end, t);

            // Offset by moment value (perpendicular to member)
            const diagramPoint = basePoint.clone();
            diagramPoint.y += value * scale;

            pts.push(diagramPoint);

            // Color based on stress
            cols.push(getStressColor(value, maxMoment));
        }

        return { points: pts, colors: cols };
    }, [startPos, endPos, xValues, momentValues, scale, maxMoment]);

    // Create filled shape between baseline and diagram
    const filledGeometry = useMemo(() => {
        if (points.length < 2) return null;

        const start = new THREE.Vector3(...startPos);
        const end = new THREE.Vector3(...endPos);
        const memberLength = start.distanceTo(end);

        const vertices: number[] = [];
        const vertexColors: number[] = [];
        const indices: number[] = [];

        for (let i = 0; i < points.length; i++) {
            const t = xValues[i] / memberLength;
            const basePoint = new THREE.Vector3().lerpVectors(start, end, t);
            const color = colors[i];

            // Base vertex
            vertices.push(basePoint.x, basePoint.y, basePoint.z);
            vertexColors.push(color.r, color.g, color.b);

            // Diagram vertex
            vertices.push(points[i].x, points[i].y, points[i].z);
            vertexColors.push(color.r, color.g, color.b);
        }

        // Create triangles
        for (let i = 0; i < points.length - 1; i++) {
            const baseIdx = i * 2;
            indices.push(baseIdx, baseIdx + 1, baseIdx + 2);
            indices.push(baseIdx + 2, baseIdx + 1, baseIdx + 3);
        }

        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
        geometry.setAttribute('color', new THREE.Float32BufferAttribute(vertexColors, 3));
        geometry.setIndex(indices);

        return geometry;
    }, [points, colors, startPos, endPos, xValues]);

    // Dispose geometry on change/unmount to prevent GPU memory leaks
    useEffect(() => {
        return () => {
            if (filledGeometry) filledGeometry.dispose();
        };
    }, [filledGeometry]);

    if (!filledGeometry) return null;

    return (
        <group name={`${type}-diagram`}>
            {/* Filled diagram */}
            <mesh geometry={filledGeometry}>
                <meshBasicMaterial
                    vertexColors
                    transparent
                    opacity={0.5}
                    side={THREE.DoubleSide}
                    depthWrite={false}
                />
            </mesh>

            {/* Outline */}
            <Line
                points={points}
                color="#ffffff"
                lineWidth={1}
            />
        </group>
    );
};

// ============================================
// DEFLECTED SHAPE COMPONENT
// ============================================

interface DeflectedMemberProps {
    startPos: [number, number, number];
    endPos: [number, number, number];
    startDisplacement: NodeDisplacement;
    endDisplacement: NodeDisplacement;
    scaleFactor: number;
}

const DeflectedMember: FC<DeflectedMemberProps> = ({
    startPos,
    endPos,
    startDisplacement,
    endDisplacement,
    scaleFactor
}) => {
    const points = useMemo(() => {
        // Apply scaled displacements (convert mm to m)
        const scale = scaleFactor / 1000; // mm to m, then apply user scale

        const start = new THREE.Vector3(
            startPos[0] + startDisplacement.dx * scale,
            startPos[1] + startDisplacement.dy * scale,
            startPos[2] + startDisplacement.dz * scale
        );

        const end = new THREE.Vector3(
            endPos[0] + endDisplacement.dx * scale,
            endPos[1] + endDisplacement.dy * scale,
            endPos[2] + endDisplacement.dz * scale
        );

        return [start, end];
    }, [startPos, endPos, startDisplacement, endDisplacement, scaleFactor]);

    return (
        <Line
            points={points}
            color={DEFLECTED_COLOR}
            lineWidth={3}
            transparent
            opacity={0.7}
            dashed
            dashSize={0.2}
            gapSize={0.1}
        />
    );
};

// ============================================
// DEFLECTED NODE COMPONENT
// ============================================

interface DeflectedNodeProps {
    originalPos: [number, number, number];
    displacement: NodeDisplacement;
    scaleFactor: number;
}

const DeflectedNode: FC<DeflectedNodeProps> = ({
    originalPos,
    displacement,
    scaleFactor
}) => {
    const position = useMemo(() => {
        const scale = scaleFactor / 1000;
        return [
            originalPos[0] + displacement.dx * scale,
            originalPos[1] + displacement.dy * scale,
            originalPos[2] + displacement.dz * scale
        ] as [number, number, number];
    }, [originalPos, displacement, scaleFactor]);

    return (
        <mesh position={position}>
            <sphereGeometry args={[0.05, 16, 16]} />
            <meshStandardMaterial
                color={DEFLECTED_COLOR}
                transparent
                opacity={0.8}
                emissive={DEFLECTED_COLOR}
                emissiveIntensity={0.3}
            />
        </mesh>
    );
};

// ============================================
// SCALE FACTOR SLIDER COMPONENT
// ============================================

interface ScaleSliderProps {
    value: number;
    onChange: (value: number) => void;
    min?: number;
    max?: number;
}

const ScaleSlider: FC<ScaleSliderProps> = ({
    value,
    onChange,
    min = 1,
    max = 100
}) => {
    return (
        <Html position={[0, 0, 0]} center style={{ pointerEvents: 'none' }}>
            <div style={{
                position: 'fixed',
                bottom: '80px',
                left: '50%',
                transform: 'translateX(-50%)',
                background: 'rgba(0,0,0,0.8)',
                padding: '12px 20px',
                borderRadius: '8px',
                color: 'white',
                fontFamily: 'monospace',
                fontSize: '12px',
                pointerEvents: 'auto',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
            }}>
                <span>Scale: {value.toFixed(0)}x</span>
                <input
                    type="range"
                    min={min}
                    max={max}
                    value={value}
                    onChange={(e) => onChange(parseFloat(e.target.value))}
                    style={{
                        width: '150px',
                        accentColor: DEFLECTED_COLOR
                    }}
                />
            </div>
        </Html>
    );
};

// ============================================
// STRESS COLOR BAR (LEGEND)
// ============================================

interface ColorBarProps {
    maxValue: number;
    label: string;
    unit: string;
}

const ColorBar: FC<ColorBarProps> = ({ maxValue, label, unit }) => {
    return (
        <Html position={[0, 0, 0]} center style={{ pointerEvents: 'none' }}>
            <div style={{
                position: 'fixed',
                right: '20px',
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'rgba(0,0,0,0.8)',
                padding: '12px',
                borderRadius: '8px',
                color: 'white',
                fontFamily: 'monospace',
                fontSize: '11px',
            }}>
                <div style={{ marginBottom: '8px', fontWeight: 'bold' }}>{label}</div>
                <div style={{
                    width: '20px',
                    height: '150px',
                    background: 'linear-gradient(to bottom, #ef4444, #22c55e, #3b82f6)',
                    borderRadius: '4px',
                    marginBottom: '8px'
                }} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <span>{maxValue.toFixed(1)} {unit}</span>
                    <span style={{ color: '#888' }}>↓</span>
                    <span>0 {unit}</span>
                </div>
            </div>
        </Html>
    );
};

// ============================================
// MAIN STRESS OVERLAY COMPONENT
// ============================================

interface StressOverlayProps {
    mode: VisualizationMode;
    nodes: NodePosition[];
    members: MemberGeometry[];
    nodeDisplacements?: NodeDisplacement[];
    memberForces?: MemberForces[];
    diagramScale?: number;
    onScaleChange?: (scale: number) => void;
}

export const StressOverlay: FC<StressOverlayProps> = ({
    mode,
    nodes,
    members,
    nodeDisplacements = [],
    memberForces = [],
    diagramScale = 0.01,
    onScaleChange
}) => {
    // Local state for deflection scale
    const [deflectionScale, setDeflectionScale] = useState(10);

    // Create node lookup
    const nodeMap = useMemo(() => {
        const map = new Map<string, NodePosition>();
        nodes.forEach(n => map.set(n.id, n));
        return map;
    }, [nodes]);

    // Create displacement lookup
    const displacementMap = useMemo(() => {
        const map = new Map<string, NodeDisplacement>();
        nodeDisplacements.forEach(d => map.set(d.nodeId, d));
        return map;
    }, [nodeDisplacements]);

    // Create forces lookup
    const forcesMap = useMemo(() => {
        const map = new Map<string, MemberForces>();
        memberForces.forEach(f => map.set(f.memberId, f));
        return map;
    }, [memberForces]);

    // Calculate max values for color scaling
    const maxValues = useMemo(() => {
        let maxMoment = 0;
        let maxShear = 0;

        memberForces.forEach(mf => {
            maxMoment = Math.max(maxMoment, mf.max_moment_z);
            maxShear = Math.max(maxShear, mf.max_shear_y);
        });

        return { maxMoment, maxShear };
    }, [memberForces]);

    const handleScaleChange = useCallback((value: number) => {
        setDeflectionScale(value);
        onScaleChange?.(value);
    }, [onScaleChange]);

    // Render nothing if no mode
    if (mode === 'none') return null;

    return (
        <group name="stress-overlay">
            {/* DIAGRAM MODE: Moment */}
            {mode === 'diagram_moment' && members.map(member => {
                const startNode = nodeMap.get(member.startNodeId);
                const endNode = nodeMap.get(member.endNodeId);
                const forces = forcesMap.get(member.id);

                if (!startNode || !endNode || !forces) return null;

                return (
                    <ForcesDiagram
                        key={`moment-${member.id}`}
                        startPos={[startNode.x, startNode.y, startNode.z]}
                        endPos={[endNode.x, endNode.y, endNode.z]}
                        xValues={forces.x_values}
                        momentValues={forces.moment_z}
                        scale={diagramScale}
                        maxMoment={maxValues.maxMoment}
                        type="moment"
                    />
                );
            })}

            {/* DIAGRAM MODE: Shear */}
            {mode === 'diagram_shear' && members.map(member => {
                const startNode = nodeMap.get(member.startNodeId);
                const endNode = nodeMap.get(member.endNodeId);
                const forces = forcesMap.get(member.id);

                if (!startNode || !endNode || !forces) return null;

                return (
                    <ForcesDiagram
                        key={`shear-${member.id}`}
                        startPos={[startNode.x, startNode.y, startNode.z]}
                        endPos={[endNode.x, endNode.y, endNode.z]}
                        xValues={forces.x_values}
                        momentValues={forces.shear_y}
                        scale={diagramScale * 2}
                        maxMoment={maxValues.maxShear}
                        type="shear"
                    />
                );
            })}

            {/* Color bar for diagrams */}
            {(mode === 'diagram_moment' || mode === 'diagram_shear') && (
                <ColorBar
                    maxValue={mode === 'diagram_moment' ? maxValues.maxMoment : maxValues.maxShear}
                    label={mode === 'diagram_moment' ? 'Moment' : 'Shear'}
                    unit={mode === 'diagram_moment' ? 'kN·m' : 'kN'}
                />
            )}

            {/* DEFLECTED SHAPE MODE */}
            {mode === 'deflected' && (
                <>
                    {/* Deflected members */}
                    {members.map(member => {
                        const startNode = nodeMap.get(member.startNodeId);
                        const endNode = nodeMap.get(member.endNodeId);
                        const startDisp = displacementMap.get(member.startNodeId);
                        const endDisp = displacementMap.get(member.endNodeId);

                        if (!startNode || !endNode || !startDisp || !endDisp) return null;

                        return (
                            <DeflectedMember
                                key={`deflected-${member.id}`}
                                startPos={[startNode.x, startNode.y, startNode.z]}
                                endPos={[endNode.x, endNode.y, endNode.z]}
                                startDisplacement={startDisp}
                                endDisplacement={endDisp}
                                scaleFactor={deflectionScale}
                            />
                        );
                    })}

                    {/* Deflected nodes */}
                    {nodes.map(node => {
                        const disp = displacementMap.get(node.id);
                        if (!disp) return null;

                        return (
                            <DeflectedNode
                                key={`deflected-node-${node.id}`}
                                originalPos={[node.x, node.y, node.z]}
                                displacement={disp}
                                scaleFactor={deflectionScale}
                            />
                        );
                    })}

                    {/* Scale slider */}
                    <ScaleSlider
                        value={deflectionScale}
                        onChange={handleScaleChange}
                        min={1}
                        max={100}
                    />
                </>
            )}
        </group>
    );
};

export default StressOverlay;
