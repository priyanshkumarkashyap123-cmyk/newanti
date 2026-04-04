import { FC, useMemo } from 'react';
import * as THREE from 'three';
import { Member, Node } from '../store/model';

interface MemberViewProps {
    member: Member;
    startNode: Node;
    endNode: Node;
}

export const MemberView: FC<MemberViewProps> = ({ startNode, endNode }) => {
    // Calculate orientation and length
    const { position, rotation, length } = useMemo(() => {
        const start = new THREE.Vector3(startNode.x, startNode.y, startNode.z);
        const end = new THREE.Vector3(endNode.x, endNode.y, endNode.z);

        const length = start.distanceTo(end);
        const position = start.clone().add(end).multiplyScalar(0.5); // Midpoint

        // Create matrix to look at end from start
        const up = new THREE.Vector3(0, 1, 0);
        const direction = end.clone().sub(start).normalize();
        const quaternion = new THREE.Quaternion().setFromUnitVectors(up, direction);
        const rotation = new THREE.Euler().setFromQuaternion(quaternion);

        return { position, rotation, length };
    }, [startNode.x, startNode.y, startNode.z, endNode.x, endNode.y, endNode.z]);

    return (
        <mesh position={position} rotation={rotation}>
            <cylinderGeometry args={[0.1, 0.1, length, 8]} />
            <meshStandardMaterial color="#3b82f6" />
        </mesh>
    );
};
