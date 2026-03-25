import { FC, useRef, useMemo, useEffect, Suspense, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Line, Sphere, Text } from '@react-three/drei';
import * as THREE from 'three';
import { ErrorBoundary } from '../ErrorBoundary';

// Floating particle background for "data" feel
const DataParticles: FC = () => {
    const points = useMemo(() => {
        const pts = new Float32Array(200 * 3);
        for (let i = 0; i < 200; i++) {
            pts[i * 3] = (Math.random() - 0.5) * 30;
            pts[i * 3 + 1] = (Math.random() - 0.5) * 20;
            pts[i * 3 + 2] = (Math.random() - 0.5) * 30;
        }
        return pts;
    }, []);

    useFrame((state) => {
        // Subtle drift
    });

    return (
        <points>
            <bufferGeometry>
                <bufferAttribute
                    attach="attributes-position"
                    count={points.length / 3}
                    array={points}
                    itemSize={3}
                />
            </bufferGeometry>
            <pointsMaterial size={0.05} color="#4f46e5" transparent opacity={0.4} sizeAttenuation />
        </points>
    );
};

// A single structural frame
const StructuralFrame: FC = () => {
    const groupRef = useRef<THREE.Group>(null);
    const mouse = useRef({ x: 0, y: 0 });

    // Handle mouse move for parallax
    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            mouse.current.x = (e.clientX / window.innerWidth) * 2 - 1;
            mouse.current.y = -(e.clientY / window.innerHeight) * 2 + 1;
        };
        window.addEventListener('mousemove', handleMouseMove);
        return () => window.removeEventListener('mousemove', handleMouseMove);
    }, []);

    // Rotate slowly + Parallax
    useFrame((state, delta) => {
        if (groupRef.current) {
            // Auto-rotate base
            groupRef.current.rotation.y += delta * 0.1;
            
            // Mouse parallax (damped)
            groupRef.current.rotation.y += (mouse.current.x * 0.2 - groupRef.current.rotation.y * 0.05) * 0.05;
            groupRef.current.rotation.x += (mouse.current.y * 0.1 - groupRef.current.rotation.x * 0.05) * 0.05;
            
            // Add a subtle float
            groupRef.current.position.y = Math.sin(state.clock.elapsedTime * 0.5) * 0.3;
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
                    
                    // Cross bracing on the outer frame
                    if (y < stories && (z === 0 || z === baysZ) && x < baysX && (x + y) % 2 === 0) {
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
                <Sphere key={`node-${i}`} position={pos} args={[0.08, 16, 16]}>
                    <meshStandardMaterial 
                        color="#4f46e5" 
                        emissive="#6366f1" 
                        emissiveIntensity={2} 
                        transparent 
                        opacity={0.8} 
                    />
                </Sphere>
            ))}

            {/* Draw members */}
            {lines.map((pts, i) => (
                <Line
                    key={`line-${i}`}
                    points={pts}
                    color="#818cf8"
                    lineWidth={2}
                    transparent
                    opacity={0.3}
                />
            ))}

            {/* Glowing origin/center mass indicator */}
            <Sphere position={[0, 0, 0]} args={[0.6, 32, 32]}>
                <meshStandardMaterial 
                    color="#8b5cf6" 
                    emissive="#a78bfa" 
                    emissiveIntensity={1} 
                    transparent 
                    opacity={0.2} 
                    wireframe 
                />
            </Sphere>
            
            <Text
                position={[0, 1, 0]}
                fontSize={0.4}
                color="#dae2fd"
                anchorX="center"
                anchorY="middle"
                fillOpacity={0.9}
            >
                NL-COMPUTING ENGINE
            </Text>
            
            <DataParticles />
        </group>
    );
};

export const WebGLHeroFrame: FC = () => {
    const [hasError, setHasError] = useState(false);

    if (hasError) {
        // Fallback: simple gradient background with grid pattern
        return (
            <div className="absolute inset-0 z-0 bg-gradient-to-br from-slate-900 via-blue-900/50 to-slate-950">
                <div
                    className="absolute inset-0 opacity-[0.03]"
                    style={{
                        backgroundImage: 'linear-gradient(to right, #94a3b8 1px, transparent 1px), linear-gradient(to bottom, #94a3b8 1px, transparent 1px)',
                        backgroundSize: '60px 60px',
                    }}
                />
            </div>
        );
    }

    return (
        <ErrorBoundary onError={() => setHasError(true)}>
            <Suspense fallback={
                <div className="absolute inset-0 z-0 bg-gradient-to-br from-slate-900 via-blue-900/50 to-slate-950" />
            }>
                <div className="absolute inset-0 z-0">
                    <Canvas 
                        camera={{ position: [20, 15, 20], fov: 40 }}
                        onError={() => setHasError(true)}
                        gl={{ antialias: true, alpha: true }}
                    >
                        <color attach="background" args={["transparent"]} />
                        <ambientLight intensity={0.4} />
                        <pointLight position={[10, 10, 10]} intensity={1} color="#4f46e5" />
                        <pointLight position={[-10, -10, -10]} intensity={0.5} color="#ec4899" />
                        <StructuralFrame />
                        <OrbitControls 
                            enableZoom={false} 
                            enablePan={false}
                            autoRotate={false}
                        />
                    </Canvas>
                </div>
            </Suspense>
        </ErrorBoundary>
    );
};
