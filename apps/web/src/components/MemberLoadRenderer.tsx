/**
 * MemberLoadRenderer - Visualizes distributed and point loads on members
 * Renders UDL, UVL, and point loads in 3D
 * 
 * Performance optimizations:
 * - maxLoadMagnitude calculated once in parent, passed as prop
 * - Reduces cross-component dependency recalculations
 * @see bottleneck_report.md - GPU Buffer Transfer Lock fix
 */

import { FC, useMemo, memo } from 'react';
import * as THREE from 'three';
import { Line } from '@react-three/drei';
import { useModelStore, MemberLoad } from '../store/model';
import { useNodes, useMembers } from '../store/selectors';

const LOAD_COLOR = '#ff6600';  // Orange for loads
const ARROW_COLOR = '#ff3333'; // Red for arrows

interface MemberLoadVisualizerProps {
    load: MemberLoad;
    maxLoadMagnitude: number;  // Passed from parent to prevent recalculation
}

// Reference constants for scaling
const REFERENCE_LOAD = 100;  // 100 kN reference

// Memoized component to prevent unnecessary re-renders
const MemberLoadVisualizer: FC<MemberLoadVisualizerProps> = memo(({ load, maxLoadMagnitude }) => {
    // Use optimized selectors
    const nodes = useNodes();
    const members = useMembers();

    const geometry = useMemo(() => {
        const member = members.get(load.memberId);
        if (!member) return null;

        const startNode = nodes.get(member.startNodeId);
        const endNode = nodes.get(member.endNodeId);
        if (!startNode || !endNode) return null;

        const start = new THREE.Vector3(startNode.x, startNode.y, startNode.z);
        const end = new THREE.Vector3(endNode.x, endNode.y, endNode.z);
        const length = start.distanceTo(end);
        const direction = new THREE.Vector3().subVectors(end, start).normalize();

        // Dynamic scale based on member length: max load = 50% of member length
        const dynamicScale = (length * 0.5) / maxLoadMagnitude;

        // Calculate local axes
        const memberDir = direction.clone();
        let up = new THREE.Vector3(0, 1, 0);

        // Handle vertical members
        if (Math.abs(memberDir.dot(up)) > 0.99) {
            up = new THREE.Vector3(1, 0, 0);
        }

        const localZ = new THREE.Vector3().crossVectors(memberDir, up).normalize();
        const localY = new THREE.Vector3().crossVectors(localZ, memberDir).normalize();

        // Get load direction vector
        let loadDir: THREE.Vector3;
        switch (load.direction) {
            case 'local_y':
                loadDir = localY.clone().negate();
                break;
            case 'local_z':
                loadDir = localZ.clone();
                break;
            case 'global_x':
                loadDir = new THREE.Vector3(1, 0, 0);
                break;
            case 'global_y':
                loadDir = new THREE.Vector3(0, -1, 0);
                break;
            case 'global_z':
                loadDir = new THREE.Vector3(0, 0, 1);
                break;
            case 'axial':
                loadDir = memberDir.clone();
                break;
            default:
                loadDir = new THREE.Vector3(0, -1, 0);
        }

        const startPos = load.startPos ?? 0;
        const endPos = load.endPos ?? 1;

        if (load.type === 'UDL' || load.type === 'UVL') {
            return createDistributedLoadGeometry(
                start, end, length, loadDir,
                load.w1 ?? 0, load.w2 ?? load.w1 ?? 0,
                startPos, endPos,
                dynamicScale
            );
        } else if (load.type === 'point') {
            return createPointLoadGeometry(
                start, direction, length, loadDir,
                load.P ?? 0, load.a ?? 0.5,
                dynamicScale
            );
        } else if (load.type === 'moment') {
            return createMomentGeometry(
                start, direction, length, localY,
                load.M ?? 0, load.a ?? 0.5
            );
        }

        return null;
    }, [load, nodes, members, maxLoadMagnitude]);

    if (!geometry) return null;

    return (
        <group>
            {/* Load outline */}
            {geometry.outline && (
                <Line
                    points={geometry.outline}
                    color={LOAD_COLOR}
                    lineWidth={2}
                />
            )}
            {/* Arrows */}
            {geometry.arrows?.map((arrow, i) => (
                <group key={i}>
                    <Line
                        points={arrow.line}
                        color={ARROW_COLOR}
                        lineWidth={1.5}
                    />
                    <mesh position={arrow.headPos} rotation={arrow.headRot}>
                        <coneGeometry args={[0.08, 0.2, 8]} />
                        <meshBasicMaterial color={ARROW_COLOR} />
                    </mesh>
                </group>
            ))}
        </group>
    );
});

// Helper: Create distributed load visualization with dynamic scale
function createDistributedLoadGeometry(
    start: THREE.Vector3,
    end: THREE.Vector3,
    _length: number,
    loadDir: THREE.Vector3,
    w1: number,
    w2: number,
    startRatio: number,
    endRatio: number,
    scale: number = 0.1
) {
    const numArrows = 5;
    const arrows: Array<{
        line: THREE.Vector3[];
        headPos: THREE.Vector3;
        headRot: THREE.Euler;
    }> = [];
    const outline: THREE.Vector3[] = [];

    const loadStart = start.clone().lerp(end, startRatio);
    const loadEnd = start.clone().lerp(end, endRatio);

    // Top line (along member)
    outline.push(loadStart.clone());
    outline.push(loadEnd.clone());

    // Create arrows and load intensity line
    for (let i = 0; i <= numArrows; i++) {
        const t = i / numArrows;
        const pos = loadStart.clone().lerp(loadEnd, t);
        const intensity = w1 + (w2 - w1) * t;
        const arrowLength = Math.abs(intensity) * scale;

        const tipPos = pos.clone().add(loadDir.clone().multiplyScalar(arrowLength));

        if (i === 0) {
            outline.push(tipPos.clone());
        }
        outline.push(tipPos.clone());
        if (i === numArrows) {
            outline.push(loadStart.clone());
        }

        // Arrow shaft
        arrows.push({
            line: [pos.clone(), tipPos.clone()],
            headPos: tipPos.clone(),
            headRot: new THREE.Euler().setFromQuaternion(
                new THREE.Quaternion().setFromUnitVectors(
                    new THREE.Vector3(0, 1, 0),
                    loadDir.clone().negate()
                )
            )
        });
    }

    return { outline, arrows };
}

// Helper: Create point load visualization with dynamic scale
function createPointLoadGeometry(
    start: THREE.Vector3,
    direction: THREE.Vector3,
    length: number,
    loadDir: THREE.Vector3,
    P: number,
    aRatio: number,
    scale: number = 0.15
) {
    const arrowLength = Math.abs(P) * scale;
    const pos = start.clone().add(direction.clone().multiplyScalar(length * aRatio));
    const tipPos = pos.clone().add(loadDir.clone().multiplyScalar(arrowLength));

    const arrows = [{
        line: [pos.clone(), tipPos.clone()],
        headPos: tipPos.clone(),
        headRot: new THREE.Euler().setFromQuaternion(
            new THREE.Quaternion().setFromUnitVectors(
                new THREE.Vector3(0, 1, 0),
                loadDir.clone().negate()
            )
        )
    }];

    return { arrows, outline: null };
}

// Helper: Create moment visualization (curved arrow)
function createMomentGeometry(
    start: THREE.Vector3,
    direction: THREE.Vector3,
    length: number,
    _localY: THREE.Vector3,
    M: number,
    aRatio: number
) {
    const radius = 0.3;
    const segments = 16;
    const pos = start.clone().add(direction.clone().multiplyScalar(length * aRatio));

    const outline: THREE.Vector3[] = [];
    const sign = M >= 0 ? 1 : -1;

    // Create arc for moment visualization
    for (let i = 0; i <= segments; i++) {
        const angle = (i / segments) * Math.PI * 1.5 * sign;
        const offset = new THREE.Vector3(
            Math.cos(angle) * radius,
            Math.sin(angle) * radius,
            0
        );
        outline.push(pos.clone().add(offset));
    }

    return { outline, arrows: [] };
}

// Main component that renders all member loads
// Calculates maxLoadMagnitude ONCE and passes to children
export const MemberLoadRenderer: FC = memo(() => {
    const memberLoads = useModelStore((state) => state.memberLoads);

    // Calculate maxLoadMagnitude once in parent - prevents N recalculations in children
    const maxLoadMagnitude = useMemo(() => {
        let maxMag = REFERENCE_LOAD;
        for (const ml of memberLoads) {
            const w1 = Math.abs(ml.w1 ?? 0);
            const w2 = Math.abs(ml.w2 ?? ml.w1 ?? 0);
            const P = Math.abs(ml.P ?? 0);
            maxMag = Math.max(maxMag, w1, w2, P);
        }
        return maxMag;
    }, [memberLoads]); // Recalculate when loads change

    return (
        <group name="member-loads">
            {memberLoads.map((load) => (
                <MemberLoadVisualizer
                    key={load.id}
                    load={load}
                    maxLoadMagnitude={maxLoadMagnitude}
                />
            ))}
        </group>
    );
});

export default MemberLoadRenderer;
