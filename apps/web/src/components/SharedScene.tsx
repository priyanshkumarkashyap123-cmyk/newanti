import { FC, Suspense } from 'react';
import { Grid, GizmoHelper, GizmoViewport, Environment, ContactShadows } from '@react-three/drei';
import { ModelRenderer } from './ModelRenderer';
import { SelectionTransform } from './SelectionTransform';
import { InteractionManager } from './InteractionManager';
import { SupportRenderer } from './SupportRenderer';
import { LoadRenderer } from './LoadRenderer';
import { MemberLoadRenderer } from './MemberLoadRenderer';
import { AllMemberDiagrams } from './DiagramRenderer';
import { LoadPlacementLayer } from './viewer/LoadPlacementLayer';
import { AllResultsOverlay, StressColorOverlay } from './results';
import AnimatedDeflection from './results/AnimatedDeflection';
import { RemoteCursors } from './collaborators/RemoteCursors';
import { RemoteUser } from '../hooks/useMultiplayer';
import { useModelStore } from '../store/model';
import { Html } from '@react-three/drei';

export const SharedScene: FC<{ remoteUsers?: RemoteUser[] }> = ({ remoteUsers = [] }) => {
    const showSFD = useModelStore((state) => state.showSFD);
    const showBMD = useModelStore((state) => state.showBMD);
    const showAFD = useModelStore((state) => state.showAFD);
    const showStressOverlay = useModelStore((state) => state.showStressOverlay);
    const diagramScale = useModelStore((state) => state.diagramScale);
    const displacementScale = useModelStore((state) => state.displacementScale);
    const analysisResults = useModelStore((state) => state.analysisResults);
    const showDeflectedShape = useModelStore((state) => state.showDeflectedShape);
    const nodes = useModelStore((state) => state.nodes);
    const members = useModelStore((state) => state.members);

    // Check if model is empty
    const isModelEmpty = nodes.size === 0 && members.size === 0;

    // Use diagram scale from store, with fallback to displacement-based scale
    // Multiply by a factor to ensure diagrams are visible
    const legacyDiagramScale = diagramScale > 0 ? diagramScale : displacementScale * 0.01;

    // Debug logging for model state
    if (import.meta.env.DEV) {
        console.log('[SharedScene] Render - Nodes:', nodes.size, 'Members:', members.size);
    }

    return (
        <>
            {/* Enhanced Environment: HDR Lighting — wrapped in Suspense so a slow/blocked
                CDN fetch does not freeze the entire scene (falls back to plain lights) */}
            <Suspense fallback={null}>
                <Environment preset="city" blur={0.5} background={false} />
            </Suspense>

            {/* Ground Shadows for realism */}
            <ContactShadows
                position={[0, 0, 0]}
                opacity={0.4}
                scale={50}
                blur={2}
                far={10}
                resolution={512}
                color="#000000"
            />

            {/* Lighting - reduced intensity as Environment adds light */}
            <ambientLight intensity={0.2} />
            <directionalLight
                position={[10, 20, 10]}
                intensity={0.8}
                castShadow
                shadow-mapSize-width={2048}
                shadow-mapSize-height={2048}
            />
            {/* Hemisphere light removed as Environment covers it */}

            {/* Axes Helper - More visible */}
            <axesHelper args={[10]} />

            {/* Enhanced Grid - More visible colors */}
            <Grid
                infiniteGrid
                sectionColor="#888888"
                cellColor="#555555"
                sectionSize={5}
                cellSize={1}
                fadeDistance={150}
                fadeStrength={0.8}
                followCamera={false}
                side={2}
            />

            {/* Backup Grid Helper for better visibility */}
            {/* gridHelper removed — <Grid> above already handles infinite ground grid */}

            {/* Gizmo Helper for orientation - Premium Look */}
            <GizmoHelper alignment="bottom-right" margin={[80, 80]}>
                <GizmoViewport
                    axisColors={['#ff3b30', '#34c759', '#007aff']}
                    labelColor="white"
                    hideNegativeAxes={false}
                />
            </GizmoHelper>

            {/* Empty Model Indicator */}
            {isModelEmpty && (
                <Html center position={[0, 2, 0]}>
                    <div style={{
                        background: 'rgba(0, 0, 0, 0.7)',
                        color: '#888',
                        padding: '16px 24px',
                        borderRadius: '12px',
                        textAlign: 'center',
                        fontFamily: 'system-ui, sans-serif',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        backdropFilter: 'blur(8px)',
                        minWidth: '200px'
                    }}>
                        <div style={{ fontSize: '14px', marginBottom: '4px' }}>No Model Loaded</div>
                        <div style={{ fontSize: '11px', color: '#666' }}>
                            Create nodes and members, or load a demo model
                        </div>
                    </div>
                </Html>
            )}

            {/* Structural Model */}
            <ModelRenderer />

            {/* Support & Load Visualization */}
            <SupportRenderer />
            <LoadRenderer />
            <MemberLoadRenderer />

            {/* Force Diagrams - Show when toggled */}
            {showSFD && <AllMemberDiagrams type="FY" scale={legacyDiagramScale} />}
            {showBMD && <AllMemberDiagrams type="MZ" scale={legacyDiagramScale} />}
            {showAFD && <AllMemberDiagrams type="FX" scale={legacyDiagramScale} />}

            {/* Professional STAAD-like Stress Overlay */}
            {showStressOverlay && analysisResults && <StressColorOverlay />}

            {/* Deflected Shape Animation */}
            {showDeflectedShape && analysisResults && (
                <AnimatedDeflection
                    nodes={Array.from(nodes.values())}
                    members={Array.from(members.values())}
                    displacements={Array.from(analysisResults.displacements.entries()).map(([id, d]) => ({
                        nodeId: id,
                        ...d
                    }))}
                    scale={displacementScale}
                    animationSpeed={1.0}
                    showOriginal={true}
                    showLabels={false}
                    colorByMagnitude={true}
                />
            )}

            {/* Tools */}
            <SelectionTransform />
            <InteractionManager />

            {/* Interactive Load Placement */}
            <LoadPlacementLayer />

            {/* Multiplayer Remote Cursors */}
            <RemoteCursors users={remoteUsers} />
        </>
    );
};
