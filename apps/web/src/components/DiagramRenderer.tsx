import { FC, useMemo } from 'react';
import * as THREE from 'three';
import { Line } from '@react-three/drei';
import { useModelStore } from '../store/model';
import { MemberForcesCalculator, type ForcePoint } from '../utils/MemberForcesCalculator';
import { MatrixUtils } from '../utils/MatrixUtils';
import { calculateLocalAxes } from './results/DiagramUtils';

export type DiagramType = 'MZ' | 'FY' | 'MY' | 'FZ' | 'FX' | 'TX';

interface DiagramRendererProps {
    memberId: string;
    type: DiagramType;
    scale?: number;
    showFill?: boolean;
    showLabels?: boolean;
}

const FILL_OPACITY = 0.2;  // Figma §11.2: fill area opacity
const FILL_COLOR_MOMENT = '#3b82f6';  // Blue per Figma §11.2
const FILL_COLOR_SHEAR = '#22c55e';  // Green per Figma §11.3

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

    // Calculate diagram data - use actual PyNite data if available
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

        // Calculate 3D Orientation
        const { localY, localZ } = calculateLocalAxes(
            new THREE.Vector3(startNode.x, startNode.y, startNode.z),
            new THREE.Vector3(endNode.x, endNode.y, endNode.z),
            member.betaAngle || 0
        );

        // Check if we have actual PyNite diagram data
        const pyniteDiagram = memberForces.diagramData;
        if (pyniteDiagram && pyniteDiagram.x_values && pyniteDiagram.x_values.length > 0) {
            // Use actual PyNite diagram data
            const forcePoints: ForcePoint[] = pyniteDiagram.x_values.map((x, i) => ({
                x,
                Fx: pyniteDiagram.axial[i] || 0,
                Fy: pyniteDiagram.shear_y[i] || 0,
                Fz: pyniteDiagram.shear_z?.[i] || 0,
                My: pyniteDiagram.moment_y?.[i] || 0,
                Mz: pyniteDiagram.moment_z?.[i] || 0,
                Tx: pyniteDiagram.torsion?.[i] || 0
            }));

            return {
                forcePoints,

                L,
                dir,
                localY,
                localZ,
                startPos: new THREE.Vector3(startNode.x, startNode.y, startNode.z)
            };
        }

        // Fallback: Create simplified force points from end forces
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
            localZ,
            startPos: new THREE.Vector3(startNode.x, startNode.y, startNode.z)
        };
    }, [member, startNode, endNode, analysisResults, memberId]);

    // Generate geometry points
    const { linePoints, fillShape } = useMemo(() => {
        if (!diagramData) {
            return { linePoints: [] as THREE.Vector3[], fillShape: null };
        }

        const { forcePoints, L, dir, localY, localZ, startPos } = diagramData;
        const points: THREE.Vector3[] = [];

        // Determine correct plot vector (plane)
        let plotVector = localY.clone();
        if (type === 'MY' || type === 'FZ') {
            plotVector = localZ.clone();
        }

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

            // Offset position by value in the correct plane
            const offsetPos = basePos.clone()
                .addScaledVector(plotVector, value * scale);

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

    // Calculate rotation to align fill shape with member (moved before early return to comply with React hooks rules)
    const fillRotation = useMemo(() => {
        if (!diagramData) return new THREE.Euler();
        
        const { dir, localY, localZ } = diagramData;
        
        // Determine correct plot vector (plane)
        let plotVector = localY.clone();
        if (type === 'MY' || type === 'FZ') {
            plotVector = localZ.clone();
        }
        
        // Create a matrix that transforms from local to world coordinates
        const matrix = new THREE.Matrix4();

        // Local X = member direction
        const localX = dir.clone();
        // Local Y = diagram offset direction
        const localYDir = plotVector.clone();
        // Local Z = cross product
        const localZDir = new THREE.Vector3().crossVectors(localX, localYDir);

        matrix.makeBasis(localX, localYDir, localZDir);

        const euler = new THREE.Euler();
        euler.setFromRotationMatrix(matrix);

        return euler;
    }, [diagramData, type]);

    if (!diagramData || linePoints.length < 2) {
        return null;
    }

    const { dir, localY, localZ, startPos, L } = diagramData;

    // Determine correct plot vector (plane)
    let plotVector = localY.clone();
    if (type === 'MY' || type === 'FZ') {
        plotVector = localZ.clone();
    }

    return (
        <group>
            {/* Main diagram line with solid border */}
            <Line
                points={linePoints}
                color={type === 'MZ' || type === 'MY' ? '#ff6600' : '#0088dd'}
                lineWidth={2.5}
                segments
            />

            {/* Baseline along member */}
            <Line
                points={[
                    startPos,
                    startPos.clone().addScaledVector(dir, L)
                ]}
                color="#444444"
                lineWidth={1.5}
                segments
            />

            {/* Fill shape with light colors */}
            {showFill && fillShape && (
                <mesh
                    position={startPos}
                    rotation={fillRotation}
                >
                    <shapeGeometry args={[fillShape]} />
                    <meshBasicMaterial
                        color={type === 'MZ' || type === 'MY' ? FILL_COLOR_MOMENT : FILL_COLOR_SHEAR}
                        transparent
                        opacity={FILL_OPACITY}
                        side={THREE.DoubleSide}
                        depthWrite={false}
                    />
                </mesh>
            )}

            {/* Border outline with solid line */}
            {showFill && linePoints.length > 0 && (
                <>
                    {/* Top outline */}
                    <Line
                        points={linePoints}
                        color={type === 'MZ' || type === 'MY' ? '#cc5500' : '#0066bb'}
                        lineWidth={1.5}
                        segments
                    />
                    {/* Bottom baseline outline */}
                    <Line
                        points={[
                            startPos,
                            startPos.clone().addScaledVector(dir, L)
                        ]}
                        color="#333333"
                        lineWidth={1.5}
                        segments
                    />
                    {/* Left vertical */}
                    <Line
                        points={[
                            startPos,
                            linePoints[0]
                        ]}
                        color={type === 'MZ' || type === 'MY' ? '#cc5500' : '#0066bb'}
                        lineWidth={1.5}
                        segments
                    />
                    {/* Right vertical */}
                    {linePoints.length > 1 && (
                        <Line
                            points={[
                                startPos.clone().addScaledVector(dir, L),
                                linePoints[linePoints.length - 1]
                            ]}
                            color={type === 'MZ' || type === 'MY' ? '#cc5500' : '#0066bb'}
                            lineWidth={1.5}
                            segments
                        />
                    )}
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
