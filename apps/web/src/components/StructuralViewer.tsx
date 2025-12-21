import { FC, useRef, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera, Grid } from '@react-three/drei';

interface StructuralViewerProps {
    className?: string;
}

const Scene: FC = () => {
    return (
        <>
            {/* Camera */}
            <PerspectiveCamera
                makeDefault
                position={[20, 20, 20]}
                fov={50}
                near={0.1}
                far={1000}
            />

            {/* Controls */}
            <OrbitControls
                makeDefault
                dampingFactor={0.2}
                enableDamping
                minDistance={1}
                maxDistance={500}
                maxPolarAngle={Math.PI / 2}
            />

            {/* Lighting */}
            <ambientLight intensity={0.4} />
            <directionalLight
                position={[10, 10, 5]}
                intensity={1.0}
                castShadow
                shadow-mapSize-width={2048}
                shadow-mapSize-height={2048}
                shadow-camera-far={50}
                shadow-camera-left={-10}
                shadow-camera-right={10}
                shadow-camera-top={10}
                shadow-camera-bottom={-10}
            />

            {/* Axes Reference */}
            <axesHelper args={[5]} />

            {/* Grid */}
            <Grid
                infiniteGrid
                sectionColor="#6f6f6f"
                cellColor="#444444"
                sectionSize={5}
                cellSize={1}
                fadeDistance={100}
                fadeStrength={1}
                followCamera={false}
            />
        </>
    );
};

export const StructuralViewer: FC<StructuralViewerProps> = ({ className = '' }) => {
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        // ResizeObserver for responsive canvas
        const resizeObserver = new ResizeObserver((entries) => {
            for (const entry of entries) {
                const { width, height } = entry.contentRect;
                console.log(`Canvas resized: ${width}x${height}`);
            }
        });

        resizeObserver.observe(container);

        return () => {
            resizeObserver.disconnect();
        };
    }, []);

    return (
        <div
            ref={containerRef}
            className={className}
            style={{
                width: '100%',
                height: '100%',
                position: 'relative',
                backgroundColor: '#111',
            }}
        >
            <Canvas
                shadows
                dpr={[1, 2]}
                gl={{
                    preserveDrawingBuffer: true,
                    antialias: true,
                    alpha: false,
                }}
                style={{
                    width: '100%',
                    height: '100%',
                    background: '#111',
                }}
            >
                <Scene />
            </Canvas>
        </div>
    );
};
