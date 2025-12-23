/**
 * DiagramOverlay.tsx - 3D BMD/SFD Diagram Visualization
 * 
 * Features:
 * - Filled curves following beam path with moment/shear values
 * - Color gradient: Red (positive/sagging) → Blue (negative/hogging)
 * - Semi-transparent (0.6 opacity)
 * - Interactive scanner tool with floating tooltip
 * - Vertical cursor line following mouse
 */

import { FC, useMemo, useState, useCallback, useRef } from 'react';
import { useThree, useFrame, ThreeEvent } from '@react-three/fiber';
import { Html, Line } from '@react-three/drei';
import * as THREE from 'three';

// ============================================
// TYPES
// ============================================

export interface DiagramPoint {
    x: number;
    value: number;
}

export interface DiagramData {
    x_values: number[];
    shear_values: number[];
    moment_values: number[];
    deflection_values?: number[];
}

export type DiagramType = 'BMD' | 'SFD' | 'deflection';

interface DiagramOverlayProps {
    /** Member start position [x, y, z] */
    startPosition: [number, number, number];
    /** Member end position [x, y, z] */
    endPosition: [number, number, number];
    /** Diagram data from backend (100 points) */
    data: DiagramData;
    /** Which diagram to display */
    type: DiagramType;
    /** Scale factor for diagram height */
    scale?: number;
    /** Show the diagram */
    visible?: boolean;
    /** Offset perpendicular to beam (for multiple diagrams) */
    offset?: number;
}

// ============================================
// CONSTANTS
// ============================================

const POSITIVE_COLOR = new THREE.Color('#ef4444'); // Red - Sagging
const NEGATIVE_COLOR = new THREE.Color('#3b82f6'); // Blue - Hogging
const NEUTRAL_COLOR = new THREE.Color('#888888');  // Gray - Zero
const DIAGRAM_OPACITY = 0.6;
const SCANNER_LINE_COLOR = '#ffffff';
const TOOLTIP_BG = 'rgba(0, 0, 0, 0.85)';

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Get color based on value (red for positive, blue for negative)
 */
const getValueColor = (value: number, maxAbsValue: number): THREE.Color => {
    if (maxAbsValue === 0) return NEUTRAL_COLOR;

    const normalized = value / maxAbsValue; // -1 to 1

    if (normalized > 0) {
        // Positive: interpolate from neutral to red
        return NEUTRAL_COLOR.clone().lerp(POSITIVE_COLOR, normalized);
    } else {
        // Negative: interpolate from neutral to blue
        return NEUTRAL_COLOR.clone().lerp(NEGATIVE_COLOR, -normalized);
    }
};

/**
 * Create a BufferGeometry for the filled diagram
 */
const createDiagramGeometry = (
    startPos: THREE.Vector3,
    endPos: THREE.Vector3,
    values: number[],
    xValues: number[],
    scale: number,
    offset: number
): { geometry: THREE.BufferGeometry; colors: Float32Array } => {
    const beamLength = startPos.distanceTo(endPos);
    const beamDirection = new THREE.Vector3().subVectors(endPos, startPos).normalize();

    // Perpendicular direction (for diagram offset)
    const up = new THREE.Vector3(0, 1, 0);
    const perpendicular = new THREE.Vector3().crossVectors(beamDirection, up).normalize();

    // If beam is vertical, use different perpendicular
    if (perpendicular.length() < 0.01) {
        perpendicular.set(1, 0, 0);
    }

    const numPoints = values.length;
    const vertices: number[] = [];
    const colors: number[] = [];
    const indices: number[] = [];

    // Find max absolute value for color normalization
    const maxAbsValue = Math.max(...values.map(Math.abs), 0.001);

    // Create vertices for each point (two per point: base and top)
    for (let i = 0; i < numPoints; i++) {
        const t = xValues[i] / beamLength; // 0 to 1 along beam
        const value = values[i];
        const scaledValue = value * scale;

        // Base point (on beam line)
        const basePoint = new THREE.Vector3()
            .addVectors(startPos, beamDirection.clone().multiplyScalar(xValues[i]))
            .add(perpendicular.clone().multiplyScalar(offset));

        // Top point (offset by diagram value in Y direction)
        const topPoint = basePoint.clone();
        topPoint.y += scaledValue;

        // Get color for this value
        const color = getValueColor(value, maxAbsValue);

        // Add base vertex
        vertices.push(basePoint.x, basePoint.y, basePoint.z);
        colors.push(color.r, color.g, color.b);

        // Add top vertex
        vertices.push(topPoint.x, topPoint.y, topPoint.z);
        colors.push(color.r, color.g, color.b);
    }

    // Create triangles (two per segment)
    for (let i = 0; i < numPoints - 1; i++) {
        const baseIndex = i * 2;

        // Triangle 1: base[i], top[i], base[i+1]
        indices.push(baseIndex, baseIndex + 1, baseIndex + 2);

        // Triangle 2: base[i+1], top[i], top[i+1]
        indices.push(baseIndex + 2, baseIndex + 1, baseIndex + 3);
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();

    return { geometry, colors: new Float32Array(colors) };
};

// ============================================
// SCANNER LINE COMPONENT
// ============================================

interface ScannerLineProps {
    position: THREE.Vector3;
    height: number;
}

const ScannerLine: FC<ScannerLineProps> = ({ position, height }) => {
    const points = useMemo(() => [
        new THREE.Vector3(position.x, position.y - 0.5, position.z),
        new THREE.Vector3(position.x, position.y + height + 0.5, position.z)
    ], [position, height]);

    return (
        <Line
            points={points}
            color={SCANNER_LINE_COLOR}
            lineWidth={2}
            dashed
            dashSize={0.1}
            gapSize={0.05}
        />
    );
};

// ============================================
// TOOLTIP COMPONENT
// ============================================

interface TooltipProps {
    x: number;
    value: number;
    type: DiagramType;
    position: THREE.Vector3;
}

const Tooltip: FC<TooltipProps> = ({ x, value, type, position }) => {
    const unit = type === 'BMD' ? 'kN·m' : type === 'SFD' ? 'kN' : 'mm';
    const label = type === 'BMD' ? 'Moment' : type === 'SFD' ? 'Shear' : 'Deflection';

    return (
        <Html
            position={[position.x, position.y + 0.3, position.z]}
            center
            style={{
                pointerEvents: 'none',
                userSelect: 'none'
            }}
        >
            <div
                style={{
                    background: TOOLTIP_BG,
                    color: 'white',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    fontSize: '12px',
                    fontFamily: 'monospace',
                    whiteSpace: 'nowrap',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                    border: '1px solid rgba(255,255,255,0.2)'
                }}
            >
                <div style={{ color: '#aaa', marginBottom: '4px' }}>
                    x: <span style={{ color: '#fff' }}>{x.toFixed(2)}m</span>
                </div>
                <div style={{ color: value >= 0 ? '#ef4444' : '#3b82f6' }}>
                    {label}: <span style={{ fontWeight: 'bold' }}>{value.toFixed(2)} {unit}</span>
                </div>
            </div>
        </Html>
    );
};

// ============================================
// MAIN DIAGRAM OVERLAY COMPONENT
// ============================================

export const DiagramOverlay: FC<DiagramOverlayProps> = ({
    startPosition,
    endPosition,
    data,
    type,
    scale = 0.05,
    visible = true,
    offset = 0
}) => {
    const meshRef = useRef<THREE.Mesh>(null);
    const [hoverInfo, setHoverInfo] = useState<{
        x: number;
        value: number;
        position: THREE.Vector3;
    } | null>(null);

    const { raycaster, pointer, camera } = useThree();

    // Get values based on diagram type
    const values = useMemo(() => {
        switch (type) {
            case 'BMD': return data.moment_values;
            case 'SFD': return data.shear_values;
            case 'deflection': return data.deflection_values || [];
            default: return data.moment_values;
        }
    }, [data, type]);

    const startPos = useMemo(() => new THREE.Vector3(...startPosition), [startPosition]);
    const endPos = useMemo(() => new THREE.Vector3(...endPosition), [endPosition]);

    // Create diagram geometry
    const { geometry } = useMemo(() => {
        if (!values.length || !data.x_values.length) {
            return { geometry: new THREE.BufferGeometry(), colors: new Float32Array() };
        }
        return createDiagramGeometry(startPos, endPos, values, data.x_values, scale, offset);
    }, [startPos, endPos, values, data.x_values, scale, offset]);

    // Calculate max height for scanner line
    const maxHeight = useMemo(() => {
        return Math.max(...values.map(Math.abs)) * scale + 0.5;
    }, [values, scale]);

    // Handle pointer move for scanner
    const handlePointerMove = useCallback((event: ThreeEvent<PointerEvent>) => {
        if (!meshRef.current) return;

        // Get intersection point
        const point = event.point;

        // Calculate position along beam
        const beamLength = startPos.distanceTo(endPos);
        const beamDirection = new THREE.Vector3().subVectors(endPos, startPos).normalize();

        // Project point onto beam line
        const toPoint = new THREE.Vector3().subVectors(point, startPos);
        const projectionLength = toPoint.dot(beamDirection);
        const x = Math.max(0, Math.min(beamLength, projectionLength));

        // Find closest data point
        const closestIndex = data.x_values.reduce((closest, xVal, i) => {
            return Math.abs(xVal - x) < Math.abs(data.x_values[closest] - x) ? i : closest;
        }, 0);

        const value = values[closestIndex];
        const xValue = data.x_values[closestIndex];

        // Position for tooltip/scanner
        const scannerPos = startPos.clone().add(beamDirection.clone().multiplyScalar(xValue));
        scannerPos.y += value * scale;

        setHoverInfo({
            x: xValue,
            value,
            position: scannerPos
        });
    }, [startPos, endPos, data.x_values, values, scale]);

    const handlePointerLeave = useCallback(() => {
        setHoverInfo(null);
    }, []);

    if (!visible || values.length === 0) return null;

    return (
        <group name={`diagram-${type}`}>
            {/* Filled Diagram Mesh */}
            <mesh
                ref={meshRef}
                geometry={geometry}
                onPointerMove={handlePointerMove}
                onPointerLeave={handlePointerLeave}
            >
                <meshStandardMaterial
                    vertexColors
                    transparent
                    opacity={DIAGRAM_OPACITY}
                    side={THREE.DoubleSide}
                    depthWrite={false}
                />
            </mesh>

            {/* Outline for better visibility */}
            <lineSegments geometry={geometry}>
                <lineBasicMaterial
                    color="#ffffff"
                    transparent
                    opacity={0.3}
                />
            </lineSegments>

            {/* Scanner Line & Tooltip */}
            {hoverInfo && (
                <>
                    <ScannerLine
                        position={new THREE.Vector3(
                            hoverInfo.position.x,
                            startPosition[1],
                            hoverInfo.position.z
                        )}
                        height={maxHeight}
                    />
                    <Tooltip
                        x={hoverInfo.x}
                        value={hoverInfo.value}
                        type={type}
                        position={hoverInfo.position}
                    />
                </>
            )}
        </group>
    );
};

// ============================================
// MULTI-DIAGRAM WRAPPER
// ============================================

interface DiagramOverlayGroupProps {
    startPosition: [number, number, number];
    endPosition: [number, number, number];
    data: DiagramData;
    showBMD?: boolean;
    showSFD?: boolean;
    showDeflection?: boolean;
    bmdScale?: number;
    sfdScale?: number;
    deflectionScale?: number;
}

export const DiagramOverlayGroup: FC<DiagramOverlayGroupProps> = ({
    startPosition,
    endPosition,
    data,
    showBMD = true,
    showSFD = false,
    showDeflection = false,
    bmdScale = 0.05,
    sfdScale = 0.03,
    deflectionScale = 0.1
}) => {
    return (
        <group name="diagram-overlays">
            {showBMD && (
                <DiagramOverlay
                    startPosition={startPosition}
                    endPosition={endPosition}
                    data={data}
                    type="BMD"
                    scale={bmdScale}
                    offset={0}
                />
            )}
            {showSFD && (
                <DiagramOverlay
                    startPosition={startPosition}
                    endPosition={endPosition}
                    data={data}
                    type="SFD"
                    scale={sfdScale}
                    offset={0.3}
                />
            )}
            {showDeflection && data.deflection_values && (
                <DiagramOverlay
                    startPosition={startPosition}
                    endPosition={endPosition}
                    data={data}
                    type="deflection"
                    scale={deflectionScale}
                    offset={-0.3}
                />
            )}
        </group>
    );
};

export default DiagramOverlay;
