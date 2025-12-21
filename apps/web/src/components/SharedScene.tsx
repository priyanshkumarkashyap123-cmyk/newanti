import { FC } from 'react';
import { Grid, GizmoHelper, GizmoViewport } from '@react-three/drei';
import { ModelRenderer } from './ModelRenderer';
import { SelectionTransform } from './SelectionTransform';
import { InteractionManager } from './InteractionManager';
import { SupportRenderer } from './SupportRenderer';
import { LoadRenderer } from './LoadRenderer';
import { MemberLoadRenderer } from './MemberLoadRenderer';
import { AllMemberDiagrams } from './DiagramRenderer';
import { useModelStore } from '../store/model';

export const SharedScene: FC = () => {
    const showSFD = useModelStore((state) => state.showSFD);
    const showBMD = useModelStore((state) => state.showBMD);
    const displacementScale = useModelStore((state) => state.displacementScale);

    // Use displacement scale to derive diagram scale (smaller)
    const diagramScale = displacementScale * 0.001;

    return (
        <>
            {/* Lighting */}
            <ambientLight intensity={0.6} />
            <directionalLight
                position={[10, 20, 10]}
                intensity={1.2}
                castShadow
                shadow-mapSize-width={2048}
                shadow-mapSize-height={2048}
            />
            <hemisphereLight intensity={0.3} groundColor="#080820" />

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
            <gridHelper args={[100, 100, '#444444', '#333333']} />

            {/* Gizmo Helper for orientation */}
            <GizmoHelper alignment="bottom-left" margin={[80, 80]}>
                <GizmoViewport labelColor="white" axisHeadScale={1} />
            </GizmoHelper>

            {/* Structural Model */}
            <ModelRenderer />

            {/* Support & Load Visualization */}
            <SupportRenderer />
            <LoadRenderer />
            <MemberLoadRenderer />

            {/* Force Diagrams - Show when toggled */}
            {showSFD && <AllMemberDiagrams type="FY" scale={diagramScale} />}
            {showBMD && <AllMemberDiagrams type="MZ" scale={diagramScale} />}

            {/* Tools */}
            <SelectionTransform />
            <InteractionManager />
        </>
    );
};
