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
import { DiagramOverlay, DiagramType, DiagramData } from './DiagramOverlay';
import { useModelStore } from '../../store/model';
import StressContourRenderer, { MemberStressData, StressType } from './StressContourRenderer';

type DiagramDisplayType = 'SFD' | 'BMD' | 'AFD' | 'DEFLECTION' | 'STRESS';

// Utility to map display type to specific diagram type
const mapDiagramType = (type: DiagramDisplayType): DiagramType => {
    switch (type) {
        case 'SFD': return 'SFD';
        case 'BMD': return 'BMD';
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

            // Simple stress simplification for demo
            // In a real app, we would calculate this at multiple points
            // Here we interpolate linearly between start and end
            const stressProfile = [];
            const steps = 10;

            // Calculate approximate stress values (MPa)
            // Assuming simplified section properties if not available
            // Improved stress calculation
            // Calculate approximate Section Modulus (S) assuming I-beam shape
            // radius of gyration r = sqrt(I/A)
            // Depth d approx 2.5 * r (empirical for wide flange)
            // c = d/2 = 1.25 * r
            // S = I / c

            const area = member.A || 0.01; // m²
            const I = member.I || 1e-4;   // m⁴

            // Avoid division by zero
            const safeArea = area > 0 ? area : 0.01;
            const safeI = I > 0 ? I : 1e-4;

            const r = Math.sqrt(safeI / safeArea);
            const c = 1.25 * r;
            const S = c > 0 ? safeI / c : safeI / 0.1; // m³

            // Calculate stresses (MPa)
            // Axial Stress: P/A (kN/m² = kPa) -> /1000 = MPa
            const axialStress = (forces.axial / safeArea) / 1000;

            // Bending Stress: M/S (kNm/m³ = kPa) -> /1000 = MPa
            const momentMag = Math.sqrt(forces.momentY ** 2 + forces.momentZ ** 2);
            const bendingStress = (momentMag / S) / 1000;

            const totalStress = Math.abs(axialStress) + bendingStress;

            // Generate profile
            for (let i = 0; i <= steps; i++) {
                const position = i / steps;

                // Interpolate forces if needed (here we assume max for simplicity or linear if we had start/end)
                // For a more accurate profile, we should interpolate M over the member length
                // But simplified: assume parabolic max at center for beams, or linear for columns
                // Using max moment for conservative display

                stressProfile.push({
                    position,
                    vonMises: totalStress, // Simplified Von Mises equivalent
                    principal1: totalStress,
                    principal2: 0,
                    principal3: 0,
                    axial: axialStress,
                    bending: bendingStress,
                    shear: (forces.shearY / 1000) // Very rough shear stress in MPa (V/A approx)
                });
            }

            memberStressList.push({
                id: memberId,
                startNodeId: member.startNodeId,
                endNodeId: member.endNodeId,
                stressProfile,
                maxStress: totalStress,
                minStress: 0,
                criticalLocation: 0.5,
                capacity: 250, // MPa yield (Steel S275 approx)
                utilization: totalStress / 250
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
