import { FC, useMemo } from 'react';
import * as THREE from 'three';
import { Line } from '@react-three/drei';
import { useModelStore } from '../store/model';
import { MemberForcesCalculator, type ForcePoint } from '../utils/MemberForcesCalculator';
import { MatrixUtils } from '../utils/MatrixUtils';

export type DiagramType = 'MZ' | 'FY' | 'MY' | 'FZ' | 'FX' | 'TX';

interface DiagramRendererProps {
    memberId: string;
    type: DiagramType;
    scale?: number;
    showFill?: boolean;
    showLabels?: boolean;
}

const FILL_OPACITY = 0.3;

export const DiagramRenderer: FC<DiagramRendererProps> = ({
    memberId,
    type,
    scale = 0.1,
    showFill = true,
}) => {
    const members = useModelStore((state) => state.members);
    const nodes = useModelStore((state) => state.nodes);
    const analysisResults = useModelStore((state) => state.analysisResults);

    const member = members.get(memberId);
    const startNode = member ? nodes.get(member.startNodeId) : null;
    const endNode = member ? nodes.get(member.endNodeId) : null;

    // Calculate diagram data
    const diagramData = useMemo(() => {
        if (!member || !startNode || !endNode || !analysisResults) {
            return null;
        }

        const memberForces = analysisResults.memberForces.get(memberId);
        if (!memberForces) return null;

        // Get member length and direction
        const L = MatrixUtils.getMemberLength(startNode, endNode);
        if (L < 1e-10) return null;

        // Direction vector (normalized)
        const dir = new THREE.Vector3(
            endNode.x - startNode.x,
            endNode.y - startNode.y,
            endNode.z - startNode.z
        ).normalize();

        // Perpendicular vector for diagram offset (in local Y)
        // Cross with global Z to get local Y, or use global Y if parallel
        const globalZ = new THREE.Vector3(0, 0, 1);
        let localY = new THREE.Vector3().crossVectors(dir, globalZ);

        if (localY.length() < 0.01) {
            // Member is nearly vertical along Z, use global Y instead
            localY = new THREE.Vector3(0, 1, 0);
        } else {
            localY.normalize();
        }

        // Create simplified force points for the diagram
        // Using linear interpolation from end forces
        const endForces = {
            N1: -memberForces.axial,
            Vy1: memberForces.shearY,
            Vz1: memberForces.shearZ,
            Tx1: memberForces.torsion,
            My1: memberForces.momentY,
            Mz1: memberForces.momentZ,
            N2: memberForces.axial,
            Vy2: -memberForces.shearY,
            Vz2: -memberForces.shearZ,
            Tx2: -memberForces.torsion,
            My2: -memberForces.momentY,
            Mz2: -memberForces.momentZ
        };

        const forcePoints = MemberForcesCalculator.calculateInternalForces(L, endForces);

        return {
            forcePoints,
            L,
            dir,
            localY,
            startPos: new THREE.Vector3(startNode.x, startNode.y, startNode.z)
        };
    }, [member, startNode, endNode, analysisResults, memberId]);

    // Generate geometry points
    const { linePoints, fillShape } = useMemo(() => {
        if (!diagramData) {
            return { linePoints: [] as THREE.Vector3[], fillShape: null };
        }

        const { forcePoints, L, dir, localY, startPos } = diagramData;
        const points: THREE.Vector3[] = [];

        // Get value based on diagram type
        const getValue = (p: ForcePoint): number => {
            switch (type) {
                case 'MZ': return p.Mz;
                case 'FY': return p.Fy;
                case 'MY': return p.My ?? 0;
                case 'FZ': return p.Fz ?? 0;
                case 'FX': return p.Fx ?? 0;
                case 'TX': return p.Tx ?? 0;
                default: return 0;
            }
        };

        // Build points along member
        for (const fp of forcePoints) {
            const value = getValue(fp);

            // Base position on member axis
            const basePos = new THREE.Vector3()
                .copy(startPos)
                .addScaledVector(dir, fp.x);

            // Offset position by value
            const offsetPos = basePos.clone()
                .addScaledVector(localY, value * scale);

            points.push(offsetPos);
        }

        // Create fill shape geometry
        let fillShape: THREE.Shape | null = null;
        if (showFill && points.length >= 2) {
            // Create 2D shape in local coordinates for fill
            fillShape = new THREE.Shape();

            // Start at base
            fillShape.moveTo(0, 0);

            // Draw along diagram
            for (let i = 0; i < forcePoints.length; i++) {
                const fp = forcePoints[i];
                if (fp) {
                    const value = getValue(fp);
                    fillShape.lineTo(fp.x, value * scale);
                }
            }

            // Close back to base
            fillShape.lineTo(L, 0);
            fillShape.lineTo(0, 0);
        }

        return { linePoints: points, fillShape };
    }, [diagramData, type, scale, showFill]);

    if (!diagramData || linePoints.length < 2) {
        return null;
    }

    const { dir, localY, startPos, L } = diagramData;

    // Calculate rotation to align fill shape with member
    const fillRotation = useMemo(() => {
        // Create a matrix that transforms from local to world coordinates
        const matrix = new THREE.Matrix4();

        // Local X = member direction
        const localX = dir.clone();
        // Local Y = perpendicular (diagram offset direction)
        const localYDir = localY.clone();
        // Local Z = cross product
        const localZDir = new THREE.Vector3().crossVectors(localX, localYDir);

        matrix.makeBasis(localX, localYDir, localZDir);

        const euler = new THREE.Euler();
        euler.setFromRotationMatrix(matrix);

        return euler;
    }, [dir, localY]);

    return (
        <group>
            {/* Main diagram line */}
            <Line
                points={linePoints}
                color={type === 'MZ' || type === 'MY' ? '#ff8800' : '#00aaff'}
                lineWidth={2}
                segments
            />

            {/* Baseline along member */}
            <Line
                points={[
                    startPos,
                    startPos.clone().addScaledVector(dir, L)
                ]}
                color="#666666"
                lineWidth={1}
                dashed
                dashSize={0.1}
                gapSize={0.05}
            />

            {/* Fill shape */}
            {showFill && fillShape && (
                <mesh
                    position={startPos}
                    rotation={fillRotation}
                >
                    <shapeGeometry args={[fillShape]} />
                    <meshBasicMaterial
                        color={type === 'MZ' || type === 'MY' ? '#ff8800' : '#00aaff'}
                        transparent
                        opacity={FILL_OPACITY}
                        side={THREE.DoubleSide}
                        depthWrite={false}
                    />
                </mesh>
            )}

            {/* Vertical lines at key points (start, end, extremes) */}
            {linePoints.length > 0 && (
                <>
                    {/* Start vertical */}
                    <Line
                        points={[
                            startPos,
                            linePoints[0]!
                        ]}
                        color="#888888"
                        lineWidth={1}
                    />
                    {/* End vertical */}
                    <Line
                        points={[
                            startPos.clone().addScaledVector(dir, L),
                            linePoints[linePoints.length - 1]!
                        ]}
                        color="#888888"
                        lineWidth={1}
                    />
                </>
            )}
        </group>
    );
};

/**
 * Renders all member diagrams for a specific type
 */
export const AllMemberDiagrams: FC<{
    type: DiagramType;
    scale?: number;
    showFill?: boolean;
}> = ({ type, scale = 0.1, showFill = true }) => {
    const members = useModelStore((state) => state.members);
    const analysisResults = useModelStore((state) => state.analysisResults);

    if (!analysisResults) return null;

    const memberIds = Array.from(members.keys());

    return (
        <group>
            {memberIds.map((memberId) => (
                <DiagramRenderer
                    key={memberId}
                    memberId={memberId}
                    type={type}
                    scale={scale}
                    showFill={showFill}
                />
            ))}
        </group>
    );
};

export default DiagramRenderer;
