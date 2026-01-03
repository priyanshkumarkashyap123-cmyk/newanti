import { FC, useRef, useState, MutableRefObject } from 'react';
import { Canvas } from '@react-three/fiber';
import { View, OrbitControls, OrthographicCamera, PerspectiveCamera } from '@react-three/drei';
import { SharedScene } from './SharedScene';

type ViewportLayout = 'SINGLE' | 'QUAD';
type WorkingPlane = 'XZ' | 'XY' | 'YZ';

// ============================================
// WORKING PLANE CONTROLS
// ============================================
interface WorkingPlaneControlsProps {
    plane: WorkingPlane;
    elevation: number;
    onPlaneChange: (plane: WorkingPlane) => void;
    onElevationChange: (elevation: number) => void;
}

const WorkingPlaneControls: FC<WorkingPlaneControlsProps> = ({
    plane,
    elevation,
    onPlaneChange,
    onElevationChange
}) => {
    const [isMinimized, setIsMinimized] = useState(false);

    // Minimized state - just show a small expand button
    if (isMinimized) {
        return (
            <button
                onClick={() => setIsMinimized(false)}
                style={{
                    position: 'absolute',
                    bottom: 100,
                    right: 20,
                    zIndex: 50,
                    background: 'rgba(0, 0, 0, 0.85)',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
                    color: '#fff',
                    cursor: 'pointer',
                    fontSize: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                }}
                title="Expand Working Plane Controls"
            >
                📐 Plane
            </button>
        );
    }

    return (
        <div style={{
            position: 'absolute',
            bottom: 100,
            right: 20,
            zIndex: 50,
            background: 'rgba(0, 0, 0, 0.85)',
            padding: '12px',
            borderRadius: '10px',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
            minWidth: 180
        }}>
            {/* Header with minimize button */}
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '8px'
            }}>
                <div style={{ fontSize: '10px', color: '#888', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600 }}>
                    📐 Working Plane
                </div>
                <button
                    onClick={() => setIsMinimized(true)}
                    style={{
                        background: 'none',
                        border: 'none',
                        color: '#888',
                        cursor: 'pointer',
                        fontSize: '14px',
                        padding: '2px 6px',
                        borderRadius: '4px'
                    }}
                    title="Minimize"
                >
                    −
                </button>
            </div>


            {/* Plane Selection */}
            <div style={{ display: 'flex', gap: '4px', marginBottom: '10px' }}>
                {(['XZ', 'XY', 'YZ'] as WorkingPlane[]).map(p => (
                    <button
                        key={p}
                        onClick={() => onPlaneChange(p)}
                        style={{
                            flex: 1,
                            padding: '6px 10px',
                            fontSize: '11px',
                            fontWeight: 600,
                            background: plane === p ? '#007bff' : 'rgba(255,255,255,0.1)',
                            color: '#fff',
                            border: plane === p ? '1px solid #007bff' : '1px solid rgba(255,255,255,0.2)',
                            borderRadius: '4px',
                            cursor: 'pointer'
                        }}
                    >
                        {p}
                    </button>
                ))}
            </div>

            {/* Elevation Control */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '11px', color: '#ccc' }}>Elevation:</span>
                    <span style={{ fontSize: '12px', color: '#4caf50', fontWeight: 600 }}>{elevation.toFixed(1)} m</span>
                </div>
                <input
                    type="range"
                    min="-10"
                    max="30"
                    step="0.5"
                    value={elevation}
                    onChange={(e) => onElevationChange(parseFloat(e.target.value))}
                    style={{ width: '100%', cursor: 'pointer' }}
                />
                <div style={{ display: 'flex', gap: '4px' }}>
                    <button
                        onClick={() => onElevationChange(0)}
                        style={{
                            flex: 1,
                            padding: '4px 8px',
                            fontSize: '10px',
                            background: 'rgba(255,255,255,0.1)',
                            color: '#fff',
                            border: '1px solid rgba(255,255,255,0.2)',
                            borderRadius: '4px',
                            cursor: 'pointer'
                        }}
                    >
                        Ground
                    </button>
                    <button
                        onClick={() => onElevationChange(elevation + 3)}
                        style={{
                            flex: 1,
                            padding: '4px 8px',
                            fontSize: '10px',
                            background: 'rgba(255,255,255,0.1)',
                            color: '#fff',
                            border: '1px solid rgba(255,255,255,0.2)',
                            borderRadius: '4px',
                            cursor: 'pointer'
                        }}
                    >
                        +3m Floor
                    </button>
                </div>
            </div>
        </div>
    );
};

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
        zoomToCursor: true,
        panSpeed: 1.5,
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
                    <OrbitControls
                        makeDefault
                        enableDamping
                        dampingFactor={0.1}
                        zoomToCursor={true}
                        enablePan={true}
                        panSpeed={1.5}
                    />
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
    const [workingPlane, setWorkingPlane] = useState<WorkingPlane>('XZ');
    const [workingElevation, setWorkingElevation] = useState(0);

    return (
        <div style={{ width: '100%', height: '100%', position: 'relative' }}>
            {/* Viewport Layout Toggle - Top Right */}
            <div style={{
                position: 'absolute',
                top: 50,
                right: 20,
                zIndex: 50,
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

            {/* Working Plane Controls - For 3D Node Creation */}
            <WorkingPlaneControls
                plane={workingPlane}
                elevation={workingElevation}
                onPlaneChange={setWorkingPlane}
                onElevationChange={setWorkingElevation}
            />

            <ViewportContainer layout={layout} />
        </div>
    );
};
