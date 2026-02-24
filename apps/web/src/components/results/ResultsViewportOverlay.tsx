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
import * as THREE from 'three';
import { Line, Html } from '@react-three/drei';
import { DiagramOverlay, DiagramType, DiagramData } from './DiagramOverlay';
import { useModelStore } from '../../store/model';
import StressContourRenderer, { MemberStressData, StressType, StressPoint } from './StressContourRenderer';

type DiagramDisplayType = 'SFD' | 'BMD' | 'BMD_MY' | 'SFD_VZ' | 'AFD' | 'DEFLECTION' | 'STRESS';

// Utility to map display type to specific diagram type
const mapDiagramType = (type: DiagramDisplayType): DiagramType => {
    switch (type) {
        case 'SFD': return 'SFD';
        case 'BMD': return 'BMD';
        case 'BMD_MY': return 'MomentY';
        case 'SFD_VZ': return 'ShearZ';
        case 'AFD': return 'Axial';
        case 'DEFLECTION': return 'deflection';
        default: return 'BMD';
    }
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

    if (!member || !startNode || !endNode || !analysisResults) return null;

    const memberForces = analysisResults.memberForces.get(memberId);
    if (!memberForces || !memberForces.diagramData) return null;

    const diagramData: DiagramData = {
        ...memberForces.diagramData,
        // Legacy fields for DiagramOverlay compatibility
        shear_values: memberForces.diagramData.shear_y,
        moment_values: memberForces.diagramData.moment_z,
        deflection_values: memberForces.diagramData.deflection_y
    };

    return (
        <DiagramOverlay
            startPosition={[startNode.x, startNode.y, startNode.z]}
            endPosition={[endNode.x, endNode.y, endNode.z]}
            data={diagramData}
            type={mapDiagramType(diagramType)}
            scale={scale}
            visible={true}
            offset={0}
            betaAngle={member.betaAngle || 0}
            showLabels={showLabels}
            showCriticalPoints={showCriticalPoints}
        />
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

            const area = member.A || 0.01;    // m²
            const I = member.I || 1e-4;       // m⁴
            const safeArea = area > 0 ? area : 0.01;
            const safeI = I > 0 ? I : 1e-4;

            // Estimate extreme-fibre distance c from section properties
            // r = √(I/A), empirical c ≈ 1.25 r for wide-flange sections
            const r_gyration = Math.sqrt(safeI / safeArea);
            const c = 1.25 * r_gyration;
            const S = c > 0 ? safeI / c : safeI / 0.1; // section modulus, m³

            // Yield capacity (steel S250 default)
            const fy = 250; // MPa

            // ─── Use diagram data when available for varying stress along length ───
            const diagram = forces.diagramData;
            const steps = 20;
            const stressProfile: StressPoint[] = [];
            let peakStress = 0;
            let peakLocation = 0.5;

            for (let i = 0; i <= steps; i++) {
                const t = i / steps;

                let axialVal = forces.axial;    // kN
                let shearVal = forces.shearY;   // kN
                let momentVal = forces.momentZ;  // kN·m

                if (diagram && diagram.x_values && diagram.x_values.length > 1) {
                    // Interpolate from diagram data at fractional position t
                    const maxX = diagram.x_values[diagram.x_values.length - 1] || 1;
                    const xTarget = t * maxX;
                    // Binary-search-like linear scan for bracket
                    let lo = 0;
                    for (let j = 0; j < diagram.x_values.length - 1; j++) {
                        if (diagram.x_values[j + 1]! >= xTarget) { lo = j; break; }
                        lo = j;
                    }
                    const hi = Math.min(lo + 1, diagram.x_values.length - 1);
                    const span = (diagram.x_values[hi]! - diagram.x_values[lo]!) || 1;
                    const frac = (xTarget - diagram.x_values[lo]!) / span;

                    const lerpVal = (arr: number[] | undefined) => {
                        if (!arr || arr.length === 0) return 0;
                        const a = arr[lo] ?? 0;
                        const b = arr[hi] ?? 0;
                        return a + frac * (b - a);
                    };

                    axialVal  = lerpVal(diagram.axial);
                    shearVal  = lerpVal(diagram.shear_y);
                    momentVal = lerpVal(diagram.moment_z);
                }

                // Stresses in MPa (force in kN, dimension in m → kN/m² → /1000 = MPa)
                const sigmaAxial   = (axialVal / safeArea) / 1000;
                const sigmaBending = S > 0 ? (Math.abs(momentVal) / S) / 1000 : 0;
                const tauShear     = (Math.abs(shearVal) / safeArea) / 1000; // average shear
                const combined     = Math.abs(sigmaAxial) + sigmaBending;
                // Von Mises (simplified plane stress: σ_vm = √(σ² + 3τ²))
                const sigma_total  = sigmaAxial + (momentVal >= 0 ? sigmaBending : -sigmaBending);
                const vonMises     = Math.sqrt(sigma_total * sigma_total + 3 * tauShear * tauShear);

                if (vonMises > peakStress) { peakStress = vonMises; peakLocation = t; }

                stressProfile.push({
                    position: t,
                    vonMises,
                    principal1: combined,
                    principal2: 0,
                    principal3: 0,
                    axial: sigmaAxial,
                    bending: sigmaBending,
                    shear: tauShear,
                });
            }

            const util = peakStress / fy;

            memberStressList.push({
                id: memberId,
                startNodeId: member.startNodeId,
                endNodeId: member.endNodeId,
                stressProfile,
                maxStress: peakStress,
                minStress: 0,
                criticalLocation: peakLocation,
                capacity: fy,
                utilization: util,
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

        // Interpolate from actual diagram data if available
        const lerpDiagram = (arr: number[] | undefined): number | null => {
            if (!arr || arr.length < 2) return null;
            const fIdx = position * (arr.length - 1);
            const lo = Math.floor(fIdx);
            const hi = Math.min(lo + 1, arr.length - 1);
            const frac = fIdx - lo;
            return (arr[lo] ?? 0) + frac * ((arr[hi] ?? 0) - (arr[lo] ?? 0));
        };

        let value = 0;
        let unit = '';
        const dd = forces.diagramData;

        switch (diagramType) {
            case 'SFD':
                value = (dd ? lerpDiagram(dd.shear_y) : null) ?? forces.shearY * (1 - 2 * position);
                unit = 'kN';
                break;
            case 'BMD':
                value = (dd ? lerpDiagram(dd.moment_z) : null) ?? forces.momentZ * 4 * position * (1 - position);
                unit = 'kNm';
                break;
            case 'SFD_VZ':
                value = (dd ? lerpDiagram(dd.shear_z) : null) ?? (forces.shearZ ?? 0) * (1 - 2 * position);
                unit = 'kN';
                break;
            case 'BMD_MY':
                value = (dd ? lerpDiagram(dd.moment_y) : null) ?? (forces.momentY ?? 0) * 4 * position * (1 - position);
                unit = 'kNm';
                break;
            case 'AFD':
                value = (dd ? lerpDiagram(dd.axial) : null) ?? forces.axial;
                unit = 'kN';
                break;
            case 'DEFLECTION':
                value = (dd ? lerpDiagram(dd.deflection_y) : null) ?? 0;
                unit = 'mm';
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
