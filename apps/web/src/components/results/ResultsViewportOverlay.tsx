/**
 * ResultsViewportOverlay.tsx - Professional STAAD-like Results Overlay
 * 
 * Renders analysis results directly in the 3D viewport:
 * - Value labels on diagrams (like STAAD.Pro)
 * - Critical point markers
 * - Section scanner with tooltip
 * - Color-coded stress visualization
 * - Member utilization indicators
 * 
 * Inspired by STAAD.Pro, SAP2000, and ETABS viewport features
 */

import React, { FC, useState, useMemo, useCallback } from 'react';
import { Html, Line, Text } from '@react-three/drei';
import * as THREE from 'three';
import { useModelStore } from '../../store/model';
import StressContourRenderer, { MemberStressData, StressType } from './StressContourRenderer';

// ============================================
// TYPES
// ============================================

interface CriticalPoint {
    x: number;
    y: number;
    z: number;
    value: number;
    type: 'max' | 'min' | 'zero';
    label: string;
}

interface DiagramValueLabel {
    position: THREE.Vector3;
    value: number;
    unit: string;
    color: string;
}

type DiagramDisplayType = 'SFD' | 'BMD' | 'AFD' | 'DEFLECTION' | 'STRESS';

// ============================================
// COLOR UTILITIES
// ============================================

const getValueColor = (value: number, maxAbs: number): string => {
    if (maxAbs === 0) return '#808080';
    const ratio = value / maxAbs;

    // Blue (negative) -> White (zero) -> Red (positive)
    if (ratio >= 0) {
        const intensity = Math.min(1, ratio);
        const r = 255;
        const g = Math.round(255 * (1 - intensity));
        const b = Math.round(255 * (1 - intensity));
        return `rgb(${r}, ${g}, ${b})`;
    } else {
        const intensity = Math.min(1, -ratio);
        const r = Math.round(255 * (1 - intensity));
        const g = Math.round(255 * (1 - intensity));
        const b = 255;
        return `rgb(${r}, ${g}, ${b})`;
    }
};

const getStressColor = (utilization: number): string => {
    if (utilization <= 0.5) {
        // Green to Yellow
        const t = utilization / 0.5;
        return `rgb(${Math.round(t * 255)}, 255, 0)`;
    } else if (utilization <= 0.8) {
        // Yellow to Orange
        const t = (utilization - 0.5) / 0.3;
        return `rgb(255, ${Math.round(255 - t * 100)}, 0)`;
    } else if (utilization <= 1.0) {
        // Orange to Red
        const t = (utilization - 0.8) / 0.2;
        return `rgb(255, ${Math.round(155 - t * 155)}, 0)`;
    } else {
        // Over capacity - Magenta
        return '#ff00ff';
    }
};

// ============================================
// VALUE LABEL COMPONENT (3D)
// ============================================

interface ValueLabel3DProps {
    position: [number, number, number];
    value: number;
    unit: string;
    color?: string;
    size?: number;
}

const ValueLabel3D: FC<ValueLabel3DProps> = ({
    position,
    value,
    unit,
    color = '#ffffff',
    size = 0.12
}) => {
    const displayValue = Math.abs(value) < 0.01 ? '0' : value.toFixed(2);
    const text = `${displayValue} ${unit}`;

    return (
        <Text
            position={position}
            fontSize={size}
            color={color}
            anchorX="center"
            anchorY="middle"
            outlineWidth={0.02}
            outlineColor="#000000"
        >
            {text}
        </Text>
    );
};

// ============================================
// CRITICAL POINT MARKER
// ============================================

interface CriticalPointMarkerProps {
    point: CriticalPoint;
    scale?: number;
}

const CriticalPointMarker: FC<CriticalPointMarkerProps> = ({ point, scale = 1 }) => {
    const color = point.type === 'max' ? '#ff4444' :
        point.type === 'min' ? '#4444ff' : '#44ff44';

    return (
        <group position={[point.x, point.y, point.z]}>
            {/* Diamond marker */}
            <mesh rotation={[0, 0, Math.PI / 4]} scale={0.08 * scale}>
                <boxGeometry args={[1, 1, 0.2]} />
                <meshBasicMaterial color={color} />
            </mesh>

            {/* Value label */}
            <Html
                position={[0, 0.2, 0]}
                center
                style={{
                    background: 'rgba(0, 0, 0, 0.8)',
                    color: color,
                    padding: '2px 6px',
                    borderRadius: '3px',
                    fontSize: '10px',
                    fontWeight: 'bold',
                    fontFamily: 'monospace',
                    whiteSpace: 'nowrap',
                    border: `1px solid ${color}`,
                    pointerEvents: 'none'
                }}
            >
                {point.label}
            </Html>
        </group>
    );
};

// ============================================
// MEMBER DIAGRAM WITH LABELS (STAAD-style)
// ============================================

interface MemberDiagramOverlayProps {
    memberId: string;
    diagramType: DiagramDisplayType;
    scale: number;
    showLabels?: boolean;
    showCriticalPoints?: boolean;
    showFill?: boolean;
}

export const MemberDiagramOverlay: FC<MemberDiagramOverlayProps> = ({
    memberId,
    diagramType,
    scale = 0.1,
    showLabels = true,
    showCriticalPoints = true,
    showFill = true
}) => {
    const members = useModelStore((state) => state.members);
    const nodes = useModelStore((state) => state.nodes);
    const analysisResults = useModelStore((state) => state.analysisResults);

    const member = members.get(memberId);
    const startNode = member ? nodes.get(member.startNodeId) : null;
    const endNode = member ? nodes.get(member.endNodeId) : null;

    // Calculate diagram geometry and labels
    const diagramData = useMemo(() => {
        if (!member || !startNode || !endNode || !analysisResults) {
            return null;
        }

        const memberForces = analysisResults.memberForces.get(memberId);
        if (!memberForces) return null;

        // Calculate member geometry
        const start = new THREE.Vector3(startNode.x, startNode.y, startNode.z);
        const end = new THREE.Vector3(endNode.x, endNode.y, endNode.z);
        const length = start.distanceTo(end);

        if (length < 0.001) return null;

        const direction = end.clone().sub(start).normalize();

        // Perpendicular direction for diagram offset
        const up = new THREE.Vector3(0, 1, 0);
        let perpendicular = new THREE.Vector3().crossVectors(direction, up);
        if (perpendicular.length() < 0.01) {
            perpendicular = new THREE.Vector3(1, 0, 0);
        }
        perpendicular.normalize();

        // Get values based on diagram type
        let startValue = 0, endValue = 0;
        let unit = '';

        switch (diagramType) {
            case 'SFD':
                startValue = memberForces.shearY;
                endValue = -memberForces.shearY; // Linear for UDL
                unit = 'kN';
                break;
            case 'BMD':
                startValue = memberForces.momentZ;
                endValue = -memberForces.momentZ;
                unit = 'kNm';
                break;
            case 'AFD':
                startValue = memberForces.axial;
                endValue = memberForces.axial;
                unit = 'kN';
                break;
            default:
                return null;
        }

        // Generate diagram points (parabolic for BMD with UDL)
        const numPoints = 21;
        const points: THREE.Vector3[] = [];
        const values: number[] = [];
        const maxAbs = Math.max(Math.abs(startValue), Math.abs(endValue)) || 1;

        for (let i = 0; i <= numPoints - 1; i++) {
            const t = i / (numPoints - 1);
            const pos = start.clone().lerp(end, t);

            // Interpolate value (parabolic for BMD, linear for SFD)
            let value: number;
            if (diagramType === 'BMD') {
                // Parabolic shape for UDL
                value = startValue + (endValue - startValue) * t +
                    4 * (startValue + endValue) / 2 * t * (1 - t);
            } else {
                // Linear for SFD
                value = startValue + (endValue - startValue) * t;
            }

            values.push(value);

            // Offset position by value
            const offsetPos = pos.clone().addScaledVector(perpendicular, value * scale);
            points.push(offsetPos);
        }

        // Find critical points
        const criticalPoints: CriticalPoint[] = [];
        let maxVal = values[0], minVal = values[0], maxIdx = 0, minIdx = 0;

        for (let i = 0; i < values.length; i++) {
            if (values[i] > maxVal) { maxVal = values[i]; maxIdx = i; }
            if (values[i] < minVal) { minVal = values[i]; minIdx = i; }
        }

        if (Math.abs(maxVal) > 0.01) {
            criticalPoints.push({
                x: points[maxIdx].x,
                y: points[maxIdx].y,
                z: points[maxIdx].z,
                value: maxVal,
                type: 'max',
                label: `${maxVal.toFixed(2)} ${unit}`
            });
        }

        if (Math.abs(minVal) > 0.01 && minIdx !== maxIdx) {
            criticalPoints.push({
                x: points[minIdx].x,
                y: points[minIdx].y,
                z: points[minIdx].z,
                value: minVal,
                type: 'min',
                label: `${minVal.toFixed(2)} ${unit}`
            });
        }

        // Generate fill vertices (for colored fill)
        const fillVertices: number[] = [];
        const fillColors: number[] = [];

        for (let i = 0; i < points.length - 1; i++) {
            const p1 = points[i];
            const p2 = points[i + 1];
            const b1 = start.clone().lerp(end, i / (numPoints - 1));
            const b2 = start.clone().lerp(end, (i + 1) / (numPoints - 1));

            // Triangle 1
            fillVertices.push(b1.x, b1.y, b1.z);
            fillVertices.push(p1.x, p1.y, p1.z);
            fillVertices.push(p2.x, p2.y, p2.z);

            // Triangle 2
            fillVertices.push(b1.x, b1.y, b1.z);
            fillVertices.push(p2.x, p2.y, p2.z);
            fillVertices.push(b2.x, b2.y, b2.z);

            // Colors based on value
            const color1 = new THREE.Color(getValueColor(values[i], maxAbs));
            const color2 = new THREE.Color(getValueColor(values[i + 1], maxAbs));

            for (let j = 0; j < 3; j++) {
                fillColors.push(color1.r, color1.g, color1.b);
            }
            for (let j = 0; j < 3; j++) {
                fillColors.push(color2.r, color2.g, color2.b);
            }
        }

        return {
            points,
            values,
            criticalPoints,
            fillVertices: new Float32Array(fillVertices),
            fillColors: new Float32Array(fillColors),
            start,
            end,
            unit,
            maxAbs
        };
    }, [member, startNode, endNode, analysisResults, memberId, diagramType, scale]);

    if (!diagramData) return null;

    const { points, criticalPoints, fillVertices, fillColors, start, end, unit } = diagramData;
    const lineColor = diagramType === 'BMD' ? '#ff8800' :
        diagramType === 'SFD' ? '#00aaff' : '#00ff00';

    return (
        <group>
            {/* Baseline */}
            <Line
                points={[start.toArray() as [number, number, number], end.toArray() as [number, number, number]]}
                color="#666666"
                lineWidth={1}
                dashed
                dashSize={0.1}
                gapSize={0.1}
            />

            {/* Filled diagram */}
            {showFill && fillVertices.length > 0 && (
                <mesh>
                    <bufferGeometry>
                        <bufferAttribute
                            attach="attributes-position"
                            count={fillVertices.length / 3}
                            array={fillVertices}
                            itemSize={3}
                        />
                        <bufferAttribute
                            attach="attributes-color"
                            count={fillColors.length / 3}
                            array={fillColors}
                            itemSize={3}
                        />
                    </bufferGeometry>
                    <meshBasicMaterial
                        vertexColors
                        transparent
                        opacity={0.4}
                        side={THREE.DoubleSide}
                    />
                </mesh>
            )}

            {/* Diagram outline */}
            <Line
                points={points.map(p => p.toArray() as [number, number, number])}
                color={lineColor}
                lineWidth={2}
            />

            {/* Critical point markers */}
            {showCriticalPoints && criticalPoints.map((cp, idx) => (
                <CriticalPointMarker key={idx} point={cp} />
            ))}

            {/* End value labels */}
            {showLabels && diagramData.values.length > 0 && (
                <>
                    <ValueLabel3D
                        position={[start.x, start.y + 0.15, start.z]}
                        value={diagramData.values[0]}
                        unit={unit}
                        color={lineColor}
                        size={0.1}
                    />
                    <ValueLabel3D
                        position={[end.x, end.y + 0.15, end.z]}
                        value={diagramData.values[diagramData.values.length - 1]}
                        unit={unit}
                        color={lineColor}
                        size={0.1}
                    />
                </>
            )}
        </group>
    );
};

// ============================================
// STRESS COLOR OVERLAY FOR MEMBERS
// ============================================



interface StressColorOverlayProps {
    showUtilization?: boolean;
    showAxial?: boolean;
}

export const StressColorOverlay: FC<StressColorOverlayProps> = ({
    showUtilization = true
}) => {
    const members = useModelStore((state) => state.members);
    const nodes = useModelStore((state) => state.nodes);
    const analysisResults = useModelStore((state) => state.analysisResults);
    const [stressType, setStressType] = useState<StressType>('utilization');

    // Convert model data to StressContour format
    const stressData = useMemo(() => {
        if (!analysisResults) return { nodes: [], memberStress: [] };

        const nodeList = Array.from(nodes.values()).map(n => ({
            id: n.id, x: n.x, y: n.y, z: n.z
        }));

        const memberStressList: MemberStressData[] = [];

        members.forEach((member, memberId) => {
            const forces = analysisResults.memberForces.get(memberId);
            if (!forces) return;

            // Simple stress simplification for demo
            // In a real app, we would calculate this at multiple points
            // Here we interpolate linearly between start and end
            const stressProfile = [];
            const steps = 10;

            // Calculate approximate stress values (MPa)
            // Assuming simplified section properties if not available
            const area = member.A || 0.01; // m2
            const modulus = (member.I || 1e-4) * 1e6; // cm4 approx

            // Max stress calculation (very simplified for visualization)
            // sigma = P/A + M/S
            const axialStress = (forces.axial / area) / 1000; // MPa
            const momentStressStart = (Math.max(Math.abs(forces.momentY), Math.abs(forces.momentZ)) / (modulus * 1e-6)) / 1000;
            const momentStressEnd = momentStressStart; // Simplified

            for (let i = 0; i <= steps; i++) {
                const position = i / steps;
                stressProfile.push({
                    position,
                    vonMises: Math.abs(axialStress) + momentStressStart, // Mock
                    principal1: Math.abs(axialStress) + momentStressStart,
                    principal2: 0,
                    principal3: 0,
                    axial: axialStress,
                    bending: momentStressStart,
                    shear: forces.shearY / 1000
                });
            }

            memberStressList.push({
                id: memberId,
                startNodeId: member.startNodeId,
                endNodeId: member.endNodeId,
                stressProfile,
                maxStress: Math.abs(axialStress) + momentStressStart,
                minStress: 0,
                criticalLocation: 0.5,
                capacity: 250, // MPa yield
                utilization: (Math.abs(axialStress) + momentStressStart) / 250
            });
        });

        return { nodes: nodeList, memberStress: memberStressList };
    }, [members, nodes, analysisResults]);

    if (!analysisResults) return null;

    return (
        <StressContourRenderer
            nodes={stressData.nodes}
            memberStress={stressData.memberStress}
            stressType={stressType}
            onStressTypeChange={setStressType}
            showContourLines={true}
            contourIntervals={12}
            highlightCritical={true}
        />
    );
};

// ============================================
// SECTION SCANNER (Interactive)
// ============================================

interface SectionScannerProps {
    memberId: string;
    position: number; // 0-1 along member
    diagramType: DiagramDisplayType;
}

export const SectionScanner: FC<SectionScannerProps> = ({
    memberId,
    position,
    diagramType
}) => {
    const members = useModelStore((state) => state.members);
    const nodes = useModelStore((state) => state.nodes);
    const analysisResults = useModelStore((state) => state.analysisResults);

    const member = members.get(memberId);
    const startNode = member ? nodes.get(member.startNodeId) : null;
    const endNode = member ? nodes.get(member.endNodeId) : null;

    const scannerData = useMemo(() => {
        if (!member || !startNode || !endNode || !analysisResults) return null;

        const start = new THREE.Vector3(startNode.x, startNode.y, startNode.z);
        const end = new THREE.Vector3(endNode.x, endNode.y, endNode.z);
        const scanPos = start.clone().lerp(end, position);

        const forces = analysisResults.memberForces.get(memberId);
        if (!forces) return null;

        // Calculate value at position (linear interpolation)
        let value = 0;
        let unit = '';

        switch (diagramType) {
            case 'SFD':
                value = forces.shearY * (1 - 2 * position);
                unit = 'kN';
                break;
            case 'BMD':
                // Parabolic for UDL
                value = forces.momentZ * 4 * position * (1 - position);
                unit = 'kNm';
                break;
            case 'AFD':
                value = forces.axial;
                unit = 'kN';
                break;
        }

        return { scanPos, value, unit };
    }, [member, startNode, endNode, analysisResults, memberId, position, diagramType]);

    if (!scannerData) return null;

    const { scanPos, value, unit } = scannerData;

    return (
        <group position={[scanPos.x, scanPos.y, scanPos.z]}>
            {/* Vertical line */}
            <Line
                points={[[0, -1, 0], [0, 1, 0]]}
                color="#ffff00"
                lineWidth={2}
                dashed
            />

            {/* Value tooltip */}
            <Html
                position={[0, 0.5, 0]}
                center
                style={{
                    background: 'rgba(0, 0, 0, 0.9)',
                    color: '#ffff00',
                    padding: '4px 8px',
                    borderRadius: '4px',
                    fontSize: '11px',
                    fontWeight: 'bold',
                    fontFamily: 'monospace',
                    border: '1px solid #ffff00',
                    whiteSpace: 'nowrap',
                    pointerEvents: 'none'
                }}
            >
                <div>x = {(position * 100).toFixed(0)}%</div>
                <div>{diagramType}: {value.toFixed(2)} {unit}</div>
            </Html>
        </group>
    );
};

// ============================================
// MAIN EXPORT: ALL RESULTS OVERLAYS
// ============================================

interface AllResultsOverlayProps {
    diagramType: DiagramDisplayType;
    scale?: number;
    showLabels?: boolean;
    showCriticalPoints?: boolean;
    showFill?: boolean;
    showStressColors?: boolean;
}

export const AllResultsOverlay: FC<AllResultsOverlayProps> = ({
    diagramType,
    scale = 0.05,
    showLabels = true,
    showCriticalPoints = true,
    showFill = true,
    showStressColors = false
}) => {
    const members = useModelStore((state) => state.members);
    const analysisResults = useModelStore((state) => state.analysisResults);

    if (!analysisResults) return null;

    const memberIds = Array.from(members.keys());

    return (
        <group>
            {/* Stress color overlay */}
            {showStressColors && <StressColorOverlay />}

            {/* Diagram overlays for each member */}
            {!showStressColors && memberIds.map(memberId => (
                <MemberDiagramOverlay
                    key={memberId}
                    memberId={memberId}
                    diagramType={diagramType}
                    scale={scale}
                    showLabels={showLabels}
                    showCriticalPoints={showCriticalPoints}
                    showFill={showFill}
                />
            ))}
        </group>
    );
};

export default AllResultsOverlay;
