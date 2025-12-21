import { FC, useRef, useState, MutableRefObject } from 'react';
import { Canvas } from '@react-three/fiber';
import { View, OrbitControls, OrthographicCamera, PerspectiveCamera } from '@react-three/drei';
import { SharedScene } from './SharedScene';

type ViewportLayout = 'SINGLE' | 'QUAD';

const ViewportContainer: FC<{ className?: string; layout: ViewportLayout }> = ({ className, layout }) => {
    const mainRef = useRef<HTMLDivElement>(null);
    const topRef = useRef<HTMLDivElement>(null);
    const frontRef = useRef<HTMLDivElement>(null);
    const rightRef = useRef<HTMLDivElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    const orthoControlProps = {
        enableRotate: false,
        enableZoom: true,
        enablePan: true,
        mouseButtons: { LEFT: 2, MIDDLE: 2, RIGHT: 2 }
    };

    return (
        <div ref={containerRef} style={{ width: '100%', height: '100%', position: 'relative' }}>
            {/* CSS Grid Layout for Viewports */}
            <div
                style={{
                    display: 'grid',
                    gridTemplateColumns: layout === 'SINGLE' ? '1fr' : '1fr 1fr',
                    gridTemplateRows: layout === 'SINGLE' ? '1fr' : '1fr 1fr',
                    width: '100%',
                    height: '100%',
                    gap: '2px',
                    backgroundColor: '#222'
                }}
            >
                {/* Main 3D Perspective View */}
                <div ref={mainRef} style={{ position: 'relative', background: '#1a1a1a', overflow: 'hidden' }}>
                    <div style={{ position: 'absolute', top: 8, left: 8, color: '#fff', zIndex: 10, fontSize: '11px', opacity: 0.8, fontWeight: 500 }}>Perspective</div>
                </div>

                {layout === 'QUAD' && (
                    <>
                        <div ref={topRef} style={{ position: 'relative', background: '#1a1a1a', overflow: 'hidden' }}>
                            <div style={{ position: 'absolute', top: 8, left: 8, color: '#fff', zIndex: 10, fontSize: '11px', opacity: 0.8, fontWeight: 500 }}>Top</div>
                        </div>
                        <div ref={frontRef} style={{ position: 'relative', background: '#1a1a1a', overflow: 'hidden' }}>
                            <div style={{ position: 'absolute', top: 8, left: 8, color: '#fff', zIndex: 10, fontSize: '11px', opacity: 0.8, fontWeight: 500 }}>Front</div>
                        </div>
                        <div ref={rightRef} style={{ position: 'relative', background: '#1a1a1a', overflow: 'hidden' }}>
                            <div style={{ position: 'absolute', top: 8, left: 8, color: '#fff', zIndex: 10, fontSize: '11px', opacity: 0.8, fontWeight: 500 }}>Right</div>
                        </div>
                    </>
                )}
            </div>

            {/* Single Canvas with Views */}
            <Canvas
                style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}
                eventSource={containerRef as MutableRefObject<HTMLElement>}
                shadows
                dpr={[1, 2]}
                gl={{ preserveDrawingBuffer: true, antialias: true, alpha: false }}
                camera={{ position: [20, 20, 20], fov: 50 }}
            >
                {/* Perspective View */}
                <View track={mainRef as MutableRefObject<HTMLElement>}>
                    <color attach="background" args={['#1a1a1a']} />
                    <PerspectiveCamera makeDefault position={[15, 15, 15]} fov={50} />
                    <OrbitControls makeDefault enableDamping dampingFactor={0.1} />
                    <SharedScene />
                </View>

                {layout === 'QUAD' && (
                    <>
                        {/* Top View */}
                        <View track={topRef as MutableRefObject<HTMLElement>}>
                            <color attach="background" args={['#1a1a1a']} />
                            <OrthographicCamera makeDefault position={[0, 50, 0]} zoom={15} up={[0, 0, -1]} />
                            <OrbitControls makeDefault {...orthoControlProps} />
                            <SharedScene />
                        </View>

                        {/* Front View */}
                        <View track={frontRef as MutableRefObject<HTMLElement>}>
                            <color attach="background" args={['#1a1a1a']} />
                            <OrthographicCamera makeDefault position={[0, 0, 50]} zoom={15} />
                            <OrbitControls makeDefault {...orthoControlProps} />
                            <SharedScene />
                        </View>

                        {/* Right View */}
                        <View track={rightRef as MutableRefObject<HTMLElement>}>
                            <color attach="background" args={['#1a1a1a']} />
                            <OrthographicCamera makeDefault position={[50, 0, 0]} zoom={15} />
                            <OrbitControls makeDefault {...orthoControlProps} />
                            <SharedScene />
                        </View>
                    </>
                )}
            </Canvas>
        </div>
    );
};

export const ViewportManager: FC = () => {
    const [layout, setLayout] = useState<ViewportLayout>('QUAD');

    return (
        <div style={{ width: '100%', height: '100%', position: 'relative' }}>
            {/* Viewport Layout Toggle - Top Left */}
            <div style={{
                position: 'absolute',
                top: 50,
                left: 20,
                zIndex: 300,
                display: 'flex',
                flexDirection: 'column',
                gap: '4px',
                background: 'rgba(0, 0, 0, 0.8)',
                padding: '8px',
                borderRadius: '8px',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                boxShadow: '0 2px 8px rgba(0,0,0,0.3)'
            }}>
                <div style={{ fontSize: '10px', color: '#888', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Layout
                </div>
                <button
                    onClick={() => setLayout('SINGLE')}
                    style={{
                        color: '#fff',
                        background: layout === 'SINGLE' ? '#007bff' : 'rgba(255, 255, 255, 0.1)',
                        border: layout === 'SINGLE' ? '1px solid #007bff' : '1px solid rgba(255, 255, 255, 0.2)',
                        borderRadius: '4px',
                        padding: '6px 12px',
                        cursor: 'pointer',
                        fontSize: '12px',
                        fontWeight: 500,
                        width: '100%',
                        textAlign: 'left'
                    }}
                >
                    ⬜ Single
                </button>
                <button
                    onClick={() => setLayout('QUAD')}
                    style={{
                        color: '#fff',
                        background: layout === 'QUAD' ? '#007bff' : 'rgba(255, 255, 255, 0.1)',
                        border: layout === 'QUAD' ? '1px solid #007bff' : '1px solid rgba(255, 255, 255, 0.2)',
                        borderRadius: '4px',
                        padding: '6px 12px',
                        cursor: 'pointer',
                        fontSize: '12px',
                        fontWeight: 500,
                        width: '100%',
                        textAlign: 'left'
                    }}
                >
                    ⊞ Quad
                </button>
            </div>

            <ViewportContainer layout={layout} />
        </div>
    );
};
