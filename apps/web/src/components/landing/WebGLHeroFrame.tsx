import { FC, useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Line, Sphere, Text } from '@react-three/drei';
import * as THREE from 'three';

// A single structural frame
const StructuralFrame: FC = () => {
    const groupRef = useRef<THREE.Group>(null);

    // Rotate slowly
    useFrame((state, delta) => {
        if (groupRef.current) {
            groupRef.current.rotation.y += delta * 0.15;
            // Add a subtle float
            groupRef.current.position.y = Math.sin(state.clock.elapsedTime) * 0.2;
        }
    });

    // Define a 3-bay, 2-story framework
    const nodes: [number, number, number][] = useMemo(() => {
        const pts: [number, number, number][] = [];
        const baysX = 3;
        const baysZ = 2;
        const width = 4;
        const depth = 4;
        const height = 3;
        const stories = 2;

        for (let x = 0; x <= baysX; x++) {
            for (let z = 0; z <= baysZ; z++) {
                for (let y = 0; y <= stories; y++) {
                    pts.push([
                        (x - baysX / 2) * width,
                        y * height - (stories * height) / 2,
                        (z - baysZ / 2) * depth,
                    ]);
                }
            }
        }
        return pts;
    }, []);

    const lines: [number, number, number][][] = useMemo(() => {
        const segs: [number, number, number][][] = [];
        const baysX = 3;
        const baysZ = 2;
        const width = 4;
        const depth = 4;
        const height = 3;
        const stories = 2;

        const getPt = (x: number, y: number, z: number): [number, number, number] => [
            (x - baysX / 2) * width,
            y * height - (stories * height) / 2,
            (z - baysZ / 2) * depth,
        ];

        for (let x = 0; x <= baysX; x++) {
            for (let z = 0; z <= baysZ; z++) {
                for (let y = 0; y <= stories; y++) {
                    const p1 = getPt(x, y, z);
                    // Column up
                    if (y < stories) segs.push([p1, getPt(x, y + 1, z)]);
                    // Beam right
                    if (x < baysX) segs.push([p1, getPt(x + 1, y, z)]);
                    // Beam deep
                    if (z < baysZ) segs.push([p1, getPt(x, y, z + 1)]);
                    
                    // Cross bracing on the outer frame logic
                    if (y < stories && (z === 0 || z === baysZ) && x < baysX) {
                        segs.push([p1, getPt(x + 1, y + 1, z)]);
                    }
                }
            }
        }
        return segs;
    }, []);

    return (
        <group ref={groupRef}>
            {/* Draw nodes */}
            {nodes.map((pos, i) => (
                <Sphere key={`node-${i}`} position={pos} args={[0.08, 8, 8]}>
                    <meshBasicMaterial color="#3b82f6" transparent opacity={0.6} />
                </Sphere>
            ))}

            {/* Draw members */}
            {lines.map((pts, i) => (
                <Line
                    key={`line-${i}`}
                    points={pts}
                    color="#4f46e5"
                    lineWidth={1.5}
                    transparent
                    opacity={0.4}
                />
            ))}

            {/* Glowing origin/center mass indicator */}
            <Sphere position={[0, 0, 0]} args={[0.4, 16, 16]}>
                <meshBasicMaterial color="#8b5cf6" transparent opacity={0.3} wireframe />
            </Sphere>
            <Text
                position={[0, 0.8, 0]}
                fontSize={0.5}
                color="#a78bfa"
                anchorX="center"
                anchorY="middle"
                opacity={0.8}
            >
                AI-Optimized Core
            </Text>
        </group>
    );
};

export const WebGLHeroFrame: FC = () => {
    return (
        <div className="absolute inset-0 z-0">
            <Canvas camera={{ position: [18, 12, 18], fov: 45 }}>
                <color attach="background" args={["transparent"]} />
                <ambientLight intensity={0.5} />
                <StructuralFrame />
                <OrbitControls 
                    enableZoom={false} 
                    enablePan={false}
                    autoRotate={true}
                    autoRotateSpeed={0.5}
                />
            </Canvas>
        </div>
    );
};
