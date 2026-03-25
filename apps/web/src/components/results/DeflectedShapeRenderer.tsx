import { FC, memo, useMemo } from 'react';
import * as THREE from 'three';
import { Line } from '@react-three/drei';
import { useModelStore } from '../../store/model';

/**
 * DeflectedShapeRenderer — Renders the deflected shape of the structure
 * overlaid on the original geometry.
 * 
 * STAAD.Pro parity: Equivalent to the Displacements post-processing page
 * with the deflected shape animation toggle.
 */

interface DeflectedShapeProps {
    scale?: number; // Deflection magnification factor
    showOriginal?: boolean; // Show the undeformed shape
    color?: string;
    originalColor?: string;
}

function getMemberLength(a: { x: number; y: number; z: number }, b: { x: number; y: number; z: number }): number {
    const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

export const DeflectedShapeRenderer: FC<DeflectedShapeProps> = memo(({
    scale = 50,
    showOriginal = true,
    color = '#ef4444',
    originalColor = '#9ca3af',
}) => {
    const nodes = useModelStore((s: any) => s.nodes);
    const members = useModelStore((s: any) => s.members);
    const analysisResults = useModelStore((s: any) => s.analysisResults);

    const { originalLines, deflectedLines, maxDeflection } = useMemo(() => {
        if (!analysisResults) return { originalLines: [], deflectedLines: [], maxDeflection: 0 };

        const origLines: Array<[THREE.Vector3, THREE.Vector3]> = [];
        const deflLines: Array<THREE.Vector3[]> = [];
        let maxDefl = 0;

        const nodeDisplacements = analysisResults.nodeDisplacements;

        for (const [, member] of members) {
            const startNode = nodes.get(member.startNodeId);
            const endNode = nodes.get(member.endNodeId);
            if (!startNode || !endNode) continue;

            const startPos = new THREE.Vector3(startNode.x, startNode.y, startNode.z);
            const endPos = new THREE.Vector3(endNode.x, endNode.y, endNode.z);
            origLines.push([startPos, endPos]);

            // Get node displacements
            const startDisp = nodeDisplacements?.get(member.startNodeId);
            const endDisp = nodeDisplacements?.get(member.endNodeId);

            if (startDisp && endDisp) {
                // Track max deflection for display
                const startMag = Math.sqrt(
                    (startDisp.dx || 0) ** 2 + (startDisp.dy || 0) ** 2 + (startDisp.dz || 0) ** 2
                );
                const endMag = Math.sqrt(
                    (endDisp.dx || 0) ** 2 + (endDisp.dy || 0) ** 2 + (endDisp.dz || 0) ** 2
                );
                maxDefl = Math.max(maxDefl, startMag, endMag);

                // Interpolate intermediate points for smooth curves
                const numSegs = 10;
                const pts: THREE.Vector3[] = [];

                for (let i = 0; i <= numSegs; i++) {
                    const t = i / numSegs;
                    // Linear interpolation of base position
                    const baseX = startNode.x + t * (endNode.x - startNode.x);
                    const baseY = startNode.y + t * (endNode.y - startNode.y);
                    const baseZ = startNode.z + t * (endNode.z - startNode.z);

                    // Linear interpolation of displacement
                    const dx = (startDisp.dx || 0) + t * ((endDisp.dx || 0) - (startDisp.dx || 0));
                    const dy = (startDisp.dy || 0) + t * ((endDisp.dy || 0) - (startDisp.dy || 0));
                    const dz = (startDisp.dz || 0) + t * ((endDisp.dz || 0) - (startDisp.dz || 0));

                    // Check for member internal deflection data for cubic shape
                    const memberForces = analysisResults.memberForces?.get(member.id);
                    let midDeflection = 0;
                    if (memberForces?.diagramData?.deflection_y) {
                        const deflData = memberForces.diagramData.deflection_y;
                        const idx = Math.round(t * (deflData.length - 1));
                        midDeflection = deflData[idx] || 0;
                    }

                    pts.push(new THREE.Vector3(
                        baseX + dx * scale,
                        baseY + (dy + midDeflection) * scale,
                        baseZ + dz * scale,
                    ));
                }
                deflLines.push(pts);
            } else {
                // No displacement data — show undeformed
                deflLines.push([startPos.clone(), endPos.clone()]);
            }
        }

        return { originalLines: origLines, deflectedLines: deflLines, maxDeflection: maxDefl };
    }, [nodes, members, analysisResults, scale]);

    if (!analysisResults) return null;

    return (
        <group>
            {/* Original shape (dashed, gray) */}
            {showOriginal && originalLines.map(([start, end], i) => (
                <Line
                    key={`orig-${i}`}
                    points={[start, end]}
                    color={originalColor}
                    lineWidth={1}
                    dashed
                    dashSize={0.3}
                    gapSize={0.15}
                    segments
                />
            ))}

            {/* Deflected shape (solid, colored) */}
            {deflectedLines.map((pts, i) => (
                <Line
                    key={`defl-${i}`}
                    points={pts}
                    color={color}
                    lineWidth={2.5}
                    segments
                />
            ))}
        </group>
    );
});

DeflectedShapeRenderer.displayName = 'DeflectedShapeRenderer';

export default DeflectedShapeRenderer;
