/**
 * MemberLoadRenderer - Visualizes distributed and point loads on members
 * Renders UDL, UVL, and point loads in 3D
 */

import { FC, useMemo } from 'react';
import * as THREE from 'three';
import { Line } from '@react-three/drei';
import { useModelStore, MemberLoad } from '../store/model';

const LOAD_COLOR = '#ff6600';  // Orange for loads
const ARROW_COLOR = '#ff3333'; // Red for arrows

interface MemberLoadVisualizerProps {
    load: MemberLoad;
}

const MemberLoadVisualizer: FC<MemberLoadVisualizerProps> = ({ load }) => {
    const nodes = useModelStore((state) => state.nodes);
    const members = useModelStore((state) => state.members);

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
                loadDir = localY.clone().negate(); // Downward in local coords
                break;
            case 'local_z':
                loadDir = localZ.clone();
                break;
            case 'global_x':
                loadDir = new THREE.Vector3(1, 0, 0);
                break;
            case 'global_y':
                loadDir = new THREE.Vector3(0, -1, 0); // Gravity direction
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
                startPos, endPos
            );
        } else if (load.type === 'point') {
            return createPointLoadGeometry(
                start, direction, length, loadDir,
                load.P ?? 0, load.a ?? 0.5
            );
        } else if (load.type === 'moment') {
            return createMomentGeometry(
                start, direction, length, localY,
                load.M ?? 0, load.a ?? 0.5
            );
        }

        return null;
    }, [load, nodes, members]);

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
};

// Helper: Create distributed load visualization
function createDistributedLoadGeometry(
    start: THREE.Vector3,
    end: THREE.Vector3,
    _length: number,
    loadDir: THREE.Vector3,
    w1: number,
    w2: number,
    startRatio: number,
    endRatio: number
) {
    const numArrows = 5;
    const scale = 0.1; // Scale factor for visualization
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

// Helper: Create point load visualization
function createPointLoadGeometry(
    start: THREE.Vector3,
    direction: THREE.Vector3,
    length: number,
    loadDir: THREE.Vector3,
    P: number,
    aRatio: number
) {
    const scale = 0.15;
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
export const MemberLoadRenderer: FC = () => {
    const memberLoads = useModelStore((state) => state.memberLoads);

    return (
        <group name="member-loads">
            {memberLoads.map((load) => (
                <MemberLoadVisualizer key={load.id} load={load} />
            ))}
        </group>
    );
};

export default MemberLoadRenderer;
