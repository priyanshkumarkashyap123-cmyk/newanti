import React, { useRef, memo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Text, Html } from '@react-three/drei';
import * as THREE from 'three';
import { RemoteUser } from '../../hooks/useMultiplayer';

interface RemoteCursorsProps {
    users: RemoteUser[];
}

const Cursor: React.FC<{ user: RemoteUser }> = ({ user }) => {
    const meshRef = useRef<THREE.Group>(null);
    const targetPos = useRef(new THREE.Vector3(0, 0, 0));

    // Smooth interpolation
    useFrame((state, delta) => {
        if (user.cursor) {
            targetPos.current.set(user.cursor.x, user.cursor.y, user.cursor.z);
        }
        if (meshRef.current) {
            meshRef.current.position.lerp(targetPos.current, delta * 10);
        }
    });

    if (!user.cursor) return null;

    return (
        <group ref={meshRef}>
            {/* 3D Cursor Representation (Cone) */}
            <mesh rotation={[Math.PI, 0, 0]} position={[0, 0, 0]}>
                <coneGeometry args={[0.2, 0.6, 8]} />
                <meshStandardMaterial color={user.color} />
            </mesh>

            {/* Name Tag */}
            <Html position={[0, -0.3, 0]} center>
                <div
                    style={{
                        backgroundColor: user.color,
                        padding: '2px 6px',
                        borderRadius: '4px',
                        color: 'white',
                        fontSize: '12px',
                        fontWeight: 'bold',
                        whiteSpace: 'nowrap',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                    }}
                >
                    {user.name}
                </div>
            </Html>
        </group>
    );
};

export const RemoteCursors: React.FC<RemoteCursorsProps> = memo(({ users }) => {
    return (
        <group>
            {users.map(user => (
                <Cursor key={user.id} user={user} />
            ))}
        </group>
    );
});
