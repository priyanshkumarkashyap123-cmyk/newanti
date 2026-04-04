import { FC, memo, useMemo } from "react";
import { Grid, GizmoHelper, GizmoViewport } from "@react-three/drei";
import { ModelRenderer } from "./ModelRenderer";
import { SelectionTransform } from "./SelectionTransform";
import { InteractionManager } from "./InteractionManager";
import { SupportRenderer } from "./SupportRenderer";
import { LoadRenderer } from "./LoadRenderer";
import { MemberLoadRenderer } from "./MemberLoadRenderer";
import { AllMemberDiagrams } from "./DiagramRenderer";
import { LoadPlacementLayer } from "./viewer/LoadPlacementLayer";
import PlateRenderer from "./viewer/PlateRenderer";
import { ModelLabelsOverlay } from "./viewer/ModelLabelsOverlay";
import { StressColorOverlay } from "./results";
import AnimatedDeflection from "./results/AnimatedDeflection";
import { RemoteCursors } from "./collaboration/RemoteCursors";
import { RemoteUser } from "../hooks/useMultiplayer";
import { useModelStore } from "../store/model";
import { useShallow } from "zustand/react/shallow";
import { Html } from "@react-three/drei";

const SharedSceneInner: FC<{ remoteUsers?: RemoteUser[] }> = ({
  remoteUsers = [],
}) => {
  const {
    showSFD,
    showBMD,
    showAFD,
    showBMDMy,
    showShearZ,
    showStressOverlay,
    diagramScale,
    displacementScale,
    analysisResults,
    showDeflectedShape,
    nodes,
    members,
    plates,
  } = useModelStore(
    useShallow((state) => ({
      showSFD: state.showSFD,
      showBMD: state.showBMD,
      showAFD: state.showAFD,
      showBMDMy: state.showBMDMy,
      showShearZ: state.showShearZ,
      showStressOverlay: state.showStressOverlay,
      diagramScale: state.diagramScale,
      displacementScale: state.displacementScale,
      analysisResults: state.analysisResults,
      showDeflectedShape: state.showDeflectedShape,
      nodes: state.nodes,
      members: state.members,
      plates: state.plates,
    }))
  );

  // Check if model is empty
  const isModelEmpty =
    nodes.size === 0 && members.size === 0 && plates.size === 0;

  // Use diagram scale from store, with fallback to displacement-based scale
  // Multiply by a factor to ensure diagrams are visible
  const legacyDiagramScale =
    diagramScale > 0 ? diagramScale : displacementScale * 0.01;

  return (
    <>
      {/* Engineering-grade lighting — no remote HDR dependencies.
                Matches the STAAD-Pro / SkyCiv default scene setup:
                - hemisphereLight:  sky/ground tint for ambient occlusion feel
                - directionalLight: primary sun (cast shadow for depth cues)
                - ambientLight:     low base fill so shadowed faces aren't black
                This replaces <Environment preset="city"> which fetched
                potsdamer_platz_1k.hdr from storage.googleapis.com and was
                blocked by the site's CSP, crashing the CanvasErrorBoundary. */}
      <hemisphereLight args={[0x8fb0d8, 0x404040, 0.6]} />
      <ambientLight intensity={0.25} />
      <directionalLight
        position={[10, 20, 10]}
        intensity={1.2}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-camera-near={0.1}
        shadow-camera-far={200}
        shadow-camera-left={-50}
        shadow-camera-right={50}
        shadow-camera-top={50}
        shadow-camera-bottom={-50}
      />
      {/* Fill light from opposite side — softens harsh shadows on members */}
      <directionalLight position={[-8, 10, -10]} intensity={0.3} />

      {/* Axes Helper removed — GizmoHelper orientation cube at bottom-right provides the same info without cluttering the viewport */}

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
          axisColors={["#ff3b30", "#34c759", "#007aff"]}
          labelColor="white"
          hideNegativeAxes={false}
        />
      </GizmoHelper>

      {/* Empty Model Indicator */}
      {isModelEmpty && (
        <Html center position={[0, 2, 0]} zIndexRange={[1, 0]} style={{ pointerEvents: "none" }}>
          <div
            style={{
              background: "rgba(0, 0, 0, 0.55)",
              color: "#999",
              padding: "12px 20px",
              borderRadius: "10px",
              textAlign: "center",
              fontFamily: "system-ui, sans-serif",
              border: "1px solid rgba(255, 255, 255, 0.08)",
              backdropFilter: "blur(6px)",
              minWidth: "180px",
              pointerEvents: "none",
              userSelect: "none",
              opacity: 0.85,
            }}
          >
            <div
              style={{ fontSize: "13px", marginBottom: "3px", fontWeight: 500 }}
            >
              No Model Loaded
            </div>
            <div style={{ fontSize: "10px", color: "#777" }}>
              Create nodes and members, or load a demo
            </div>
          </div>
        </Html>
      )}

      {/* Structural Model */}
      <ModelRenderer />

      {/* Plate/Shell Elements */}
      <PlateRenderer />

      {/* Support & Load Visualization */}
      <SupportRenderer />
      <LoadRenderer />
      <MemberLoadRenderer />
      <ModelLabelsOverlay />

      {/* Force Diagrams - Show when toggled */}
      {showSFD && <AllMemberDiagrams type="FY" scale={legacyDiagramScale} />}
      {showBMD && <AllMemberDiagrams type="MZ" scale={legacyDiagramScale} />}
      {showAFD && <AllMemberDiagrams type="FX" scale={legacyDiagramScale} />}
      {showBMDMy && <AllMemberDiagrams type="MY" scale={legacyDiagramScale} />}
      {showShearZ && <AllMemberDiagrams type="FZ" scale={legacyDiagramScale} />}

      {/* Professional STAAD-like Stress Overlay */}
      {showStressOverlay && analysisResults && <StressColorOverlay />}

      {/* Deflected Shape Animation */}
      {showDeflectedShape && analysisResults && (
        <MemoizedDeflection
          nodes={nodes}
          members={members}
          analysisResults={analysisResults}
          displacementScale={displacementScale}
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

/**
 * Memoized wrapper for AnimatedDeflection — avoids re-creating
 * Array.from() arrays on every render by moving them into useMemo.
 */
const MemoizedDeflection: FC<{
  nodes: Map<string, any>;
  members: Map<string, any>;
  analysisResults: any;
  displacementScale: number;
}> = memo(({ nodes, members, analysisResults, displacementScale }) => {
  const nodesList = useMemo(() => Array.from(nodes.values()), [nodes]);
  const membersList = useMemo(() => Array.from(members.values()), [members]);
  const displacements = useMemo(
    () => {
      const entries: [string, any][] = Array.from(analysisResults.displacements.entries());
      return entries.map(([id, d]) => ({ nodeId: id, ...d }));
    },
    [analysisResults.displacements]
  );

  return (
    <AnimatedDeflection
      nodes={nodesList}
      members={membersList}
      displacements={displacements}
      scale={displacementScale}
      animationSpeed={1.0}
      showOriginal={true}
      showLabels={false}
      colorByMagnitude={true}
    />
  );
});

/** SharedScene wrapped in React.memo — prevents re-render when parent
 *  (ViewportManager) re-renders but props haven't changed. Critical in
 *  QUAD layout where 4 instances exist. */
export const SharedScene = memo(SharedSceneInner);
