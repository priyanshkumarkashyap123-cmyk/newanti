import {
  FC,
  useRef,
  useState,
  MutableRefObject,
  useEffect,
  Suspense,
} from "react";
import { Canvas } from "@react-three/fiber";
import {
  View,
  OrbitControls,
  OrthographicCamera,
  PerspectiveCamera,
} from "@react-three/drei";
import { SharedScene } from "./SharedScene";
import { BoxSelector } from "./BoxSelector";
import { WgpuCanvas } from "./viewer/WgpuCanvas";
import { SafeCanvasWrapper } from "./viewer/SafeCanvasWrapper";
import { CameraFitController } from "./viewer/CameraFitController";
import { useUIStore } from "../store/uiStore";
import { useMultiplayerContextSafe } from "./collaborators/MultiplayerContext";
import { Cpu, Zap, Box, GitBranch } from "lucide-react";

type ViewportLayout = "SINGLE" | "QUAD";

// ============================================
// WEBGL SUPPORT CHECK
// ============================================

const checkWebglSupport = (): { supported: boolean; reason?: string } => {
  if (typeof document === "undefined") {
    return { supported: true };
  }

  try {
    const testCanvas = document.createElement("canvas");
    // Try WebGL2 first, then WebGL1
    // Use failIfMajorPerformanceCaveat: false to avoid rejecting software renderers
    const gl =
      testCanvas.getContext("webgl2", {
        failIfMajorPerformanceCaveat: false,
      }) ||
      testCanvas.getContext("webgl", { failIfMajorPerformanceCaveat: false });

    if (!gl) {
      return {
        supported: false,
        reason:
          "WebGL context creation returned null. WebGL may be disabled in browser settings or blocked by a browser extension.",
      };
    }

    // Verify the context is actually functional by checking a basic parameter
    const debugInfo = gl.getExtension("WEBGL_debug_renderer_info");
    if (debugInfo) {
      const renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
// console.log("[WebGL] GPU Renderer:", renderer);
    }

    // Do NOT call loseContext() here — it can poison the WebGL state
    // and cause subsequent context creation (by R3F Canvas) to fail.
    // The test canvas will be garbage-collected naturally.
    // Just null out the reference to help GC.
    testCanvas.width = 0;
    testCanvas.height = 0;

    return { supported: true };
  } catch (error) {
    return {
      supported: false,
      reason: error instanceof Error ? error.message : String(error),
    };
  }
};

const WebglFallback: FC<{ error?: string }> = ({ error }) => (
  <div
    style={{
      width: "100%",
      height: "100%",
      background:
        "radial-gradient(circle at 20% 20%, rgba(34,197,94,0.08), rgba(10,10,10,0.95))",
      color: "#e5e7eb",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "32px",
    }}
  >
    <div
      style={{
        maxWidth: 640,
        width: "100%",
        background: "#0b1120",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 16,
        padding: 24,
        boxShadow: "0 10px 50px rgba(0,0,0,0.35)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          marginBottom: 12,
        }}
      >
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            background: "rgba(239,68,68,0.1)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#f87171",
          }}
        >
          ⚠️
        </div>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700 }}>
            3D Viewer needs WebGL
          </div>
          <div style={{ fontSize: 13, color: "#94a3b8" }}>
            Your browser/device couldn’t create a WebGL context. The workspace
            is disabled to avoid crashes.
          </div>
        </div>
      </div>
      <div
        style={{
          fontSize: 13,
          color: "#cbd5e1",
          lineHeight: 1.6,
          marginBottom: 12,
        }}
      >
        Try these quick fixes, then refresh:
      </div>
      <ul
        style={{
          fontSize: 13,
          color: "#cbd5e1",
          lineHeight: 1.6,
          paddingLeft: 18,
          marginBottom: 14,
        }}
      >
        <li>Enable hardware acceleration in your browser settings</li>
        <li>Close GPU-intensive tabs/apps and reload</li>
        <li>Update your browser or switch to Chrome/Edge latest</li>
        <li>Ensure WebGL is not blocked by extensions or corporate policy</li>
      </ul>
      {error && (
        <div
          style={{
            fontSize: 12,
            color: "#94a3b8",
            background: "rgba(255,255,255,0.04)",
            padding: 12,
            borderRadius: 10,
            border: "1px solid rgba(255,255,255,0.05)",
            marginBottom: 14,
          }}
        >
          <div style={{ fontWeight: 600, marginBottom: 4 }}>
            Technical details
          </div>
          <div style={{ whiteSpace: "pre-wrap" }}>{error}</div>
        </div>
      )}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <button
          onClick={() => window.location.reload()}
          style={{
            padding: "10px 14px",
            background: "#22c55e",
            color: "#0b1120",
            border: "none",
            borderRadius: 10,
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          Reload after enabling WebGL
        </button>
        <a
          href="https://get.webgl.org/"
          target="_blank"
          rel="noreferrer"
          style={{
            padding: "10px 12px",
            border: "1px solid rgba(255,255,255,0.15)",
            borderRadius: 10,
            color: "#e5e7eb",
            textDecoration: "none",
          }}
        >
          Check WebGL support →
        </a>
      </div>
    </div>
  </div>
);

const WebglChecking: FC = () => (
  <div
    style={{
      width: "100%",
      height: "100%",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "#0b1120",
      color: "#cbd5e1",
    }}
  >
    <div style={{ textAlign: "center" }}>
      <div style={{ marginBottom: 12, fontWeight: 700, fontSize: 16 }}>
        Checking graphics compatibility…
      </div>
      <div style={{ fontSize: 13, color: "#94a3b8" }}>
        Preparing the 3D workspace
      </div>
    </div>
  </div>
);

const ViewportContainer: FC<{
  className?: string;
  layout: ViewportLayout;
  useWebGpu: boolean;
}> = ({ className, layout, useWebGpu }) => {
  const mainRef = useRef<HTMLDivElement>(null);
  const topRef = useRef<HTMLDivElement>(null);
  const frontRef = useRef<HTMLDivElement>(null);
  const rightRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Get multiplayer users safely (null if outside provider)
  const mp = useMultiplayerContextSafe();
  const remoteUsers = mp?.remoteUsers || [];

  const orthoControlProps = {
    enableRotate: false,
    enableZoom: true,
    enablePan: true,
    zoomToCursor: true,
    panSpeed: 1.5,
    mouseButtons: { LEFT: 2, MIDDLE: 2, RIGHT: 2 },
  };

  if (useWebGpu) {
    return <WgpuCanvas className={className} />;
  }

  return (
    <div
      ref={containerRef}
      style={{
        width: "100%",
        height: "100%",
        position: "relative",
        touchAction: "none",
      }}
    >
      {/* CSS Grid Layout for Viewports */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: layout === "SINGLE" ? "1fr" : "1fr 1fr",
          gridTemplateRows: layout === "SINGLE" ? "1fr" : "1fr 1fr",
          width: "100%",
          height: "100%",
          gap: "2px",
          backgroundColor: "#222",
        }}
      >
        {/* Main 3D Perspective View */}
        <div
          ref={mainRef}
          style={{
            position: "relative",
            background: "#1a1a1a",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              position: "absolute",
              top: 8,
              left: 8,
              color: "#fff",
              zIndex: 10,
              fontSize: "11px",
              opacity: 0.8,
              fontWeight: 500,
            }}
          >
            Perspective
          </div>
        </div>

        {layout === "QUAD" && (
          <>
            <div
              ref={topRef}
              style={{
                position: "relative",
                background: "#1a1a1a",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  top: 8,
                  left: 8,
                  color: "#fff",
                  zIndex: 10,
                  fontSize: "11px",
                  opacity: 0.8,
                  fontWeight: 500,
                }}
              >
                Top
              </div>
            </div>
            <div
              ref={frontRef}
              style={{
                position: "relative",
                background: "#1a1a1a",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  top: 8,
                  left: 8,
                  color: "#fff",
                  zIndex: 10,
                  fontSize: "11px",
                  opacity: 0.8,
                  fontWeight: 500,
                }}
              >
                Front
              </div>
            </div>
            <div
              ref={rightRef}
              style={{
                position: "relative",
                background: "#1a1a1a",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  top: 8,
                  left: 8,
                  color: "#fff",
                  zIndex: 10,
                  fontSize: "11px",
                  opacity: 0.8,
                  fontWeight: 500,
                }}
              >
                Right
              </div>
            </div>
          </>
        )}
      </div>

      {/* Single Canvas with Views */}
      <Canvas
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
        }}
        eventSource={containerRef as MutableRefObject<HTMLElement>}
        shadows
        dpr={[1, 2]}
        gl={{
          preserveDrawingBuffer: true,
          antialias: true,
          alpha: false,
          powerPreference: "high-performance",
          failIfMajorPerformanceCaveat: false, // Don't fail on software renderers
        }}
        camera={{ position: [20, 20, 20], fov: 50 }}
        onCreated={(state) => {
          // Listen for WebGL context loss to handle it gracefully
          const canvas = state.gl.domElement;
          canvas.addEventListener("webglcontextlost", (e) => {
            e.preventDefault(); // Prevent default behavior
            console.warn(
              "[ViewportManager] WebGL context lost — will attempt restore",
            );
          });
          canvas.addEventListener("webglcontextrestored", () => {
// console.log("[ViewportManager] WebGL context restored");
          });
        }}
      >
        {/* Perspective View */}
        <View track={mainRef as MutableRefObject<HTMLElement>}>
          <color attach="background" args={["#1a1a1a"]} />
          <PerspectiveCamera makeDefault position={[15, 15, 15]} fov={50} />
          <OrbitControls
            makeDefault
            enableDamping
            dampingFactor={0.1}
            zoomToCursor={true}
            enablePan={true}
            panSpeed={1.5}
            maxDistance={5000}
            minDistance={0.1}
          />
          <CameraFitController />
          <Suspense fallback={null}>
            <SharedScene remoteUsers={remoteUsers} />
          </Suspense>
          <BoxSelector />
        </View>

        {layout === "QUAD" && (
          <>
            {/* Top View */}
            <View track={topRef as MutableRefObject<HTMLElement>}>
              <color attach="background" args={["#1a1a1a"]} />
              <OrthographicCamera
                makeDefault
                position={[0, 50, 0]}
                zoom={15}
                up={[0, 0, -1]}
              />
              <OrbitControls makeDefault {...orthoControlProps} />
              <CameraFitController />
              <Suspense fallback={null}>
                <SharedScene remoteUsers={remoteUsers} />
              </Suspense>
              <BoxSelector />
            </View>

            {/* Front View */}
            <View track={frontRef as MutableRefObject<HTMLElement>}>
              <color attach="background" args={["#1a1a1a"]} />
              <OrthographicCamera makeDefault position={[0, 0, 50]} zoom={15} />
              <OrbitControls makeDefault {...orthoControlProps} />
              <CameraFitController />
              <Suspense fallback={null}>
                <SharedScene remoteUsers={remoteUsers} />
              </Suspense>
              <BoxSelector />
            </View>

            {/* Right View */}
            <View track={rightRef as MutableRefObject<HTMLElement>}>
              <color attach="background" args={["#1a1a1a"]} />
              <OrthographicCamera makeDefault position={[50, 0, 0]} zoom={15} />
              <OrbitControls makeDefault {...orthoControlProps} />
              <CameraFitController />
              <Suspense fallback={null}>
                <SharedScene remoteUsers={remoteUsers} />
              </Suspense>
              <BoxSelector />
            </View>
          </>
        )}

        {/* Required by @react-three/drei v9: renders all tracked Views into the Canvas */}
        <View.Port />
      </Canvas>
    </div>
  );
};

export const ViewportManager: FC = () => {
  const [layout, setLayout] = useState<ViewportLayout>("QUAD");
  const [isGEMinimized, setIsGEMinimized] = useState(true);
  const [webglStatus, setWebglStatus] = useState<
    "pending" | "ok" | "unsupported"
  >("pending");
  const [webglError, setWebglError] = useState<string | null>(null);
  const useWebGpu = useUIStore((state) => state.useWebGpu);
  const setUseWebGpu = useUIStore((state) => state.setUseWebGpu);
  const renderMode3D = useUIStore((state) => state.renderMode3D);
  const setRenderMode3D = useUIStore((state) => state.setRenderMode3D);

  useEffect(() => {
    // Check WebGL support with a small delay to avoid racing with other canvas initializations
    const timer = setTimeout(() => {
      const result = checkWebglSupport();
      if (result.supported) {
        setWebglStatus("ok");
      } else {
        // Retry once after a short delay — some browsers need a moment
        // after a context was lost/restored from another tab
        setTimeout(() => {
          const retry = checkWebglSupport();
          if (retry.supported) {
            setWebglStatus("ok");
          } else {
            setWebglStatus("unsupported");
            setWebglError(
              retry.reason || "WebGL is unavailable on this device.",
            );
            setUseWebGpu(false);
          }
        }, 500);
      }
    }, 50);

    return () => clearTimeout(timer);
  }, [setUseWebGpu]);

  if (webglStatus === "pending") {
    return <WebglChecking />;
  }

  if (webglStatus === "unsupported") {
    return <WebglFallback error={webglError ?? undefined} />;
  }

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        position: "relative",
        touchAction: "none",
      }}
    >
      {/* Compact Controls Cluster - Top Right */}
      <div
        style={{
          position: "absolute",
          top: 10,
          right: 10,
          zIndex: 50,
          display: "flex",
          flexDirection: "column",
          gap: "6px",
          alignItems: "flex-end",
        }}
      >
        {/* Graphics Engine Toggle - Collapsible */}
        {isGEMinimized ? (
          <button
            onClick={() => setIsGEMinimized(false)}
            style={{
              background: "rgba(0, 0, 0, 0.85)",
              padding: "6px 10px",
              borderRadius: "8px",
              border: "1px solid rgba(255, 255, 255, 0.15)",
              boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
              color: "#fff",
              cursor: "pointer",
              fontSize: "11px",
              display: "flex",
              alignItems: "center",
              gap: "6px",
            }}
            title="Expand Graphics Engine Settings"
          >
            ⚙️ Display
          </button>
        ) : (
          <div
            style={{
              background: "rgba(0, 0, 0, 0.85)",
              padding: "10px",
              borderRadius: "10px",
              border: "1px solid rgba(255, 255, 255, 0.15)",
              boxShadow: "0 4px 12px rgba(0,0,0,0.4)",
              minWidth: "120px",
            }}
          >
            {/* Header with minimize */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "8px",
              }}
            >
              <div
                style={{
                  fontSize: "10px",
                  color: "#888",
                  textTransform: "uppercase",
                  letterSpacing: "0.5px",
                  fontWeight: 600,
                }}
              >
                Graphics Engine
              </div>
              <button
                onClick={() => setIsGEMinimized(true)}
                style={{
                  background: "none",
                  border: "none",
                  color: "#888",
                  cursor: "pointer",
                  fontSize: "14px",
                  padding: "2px 6px",
                  borderRadius: "4px",
                }}
                title="Minimize"
              >
                −
              </button>
            </div>
            <div style={{ display: "flex", gap: "4px", marginBottom: "8px" }}>
              <button
                onClick={() => setUseWebGpu(false)}
                style={{
                  flex: 1,
                  color: "#fff",
                  background: !useWebGpu ? "#444" : "transparent",
                  border: "1px solid rgba(255, 255, 255, 0.1)",
                  borderRadius: "6px",
                  padding: "6px",
                  cursor: "pointer",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: "4px",
                }}
              >
                <Cpu className="w-4 h-4" />
                <span style={{ fontSize: "10px" }}>WebGL</span>
              </button>
              <button
                onClick={() => setUseWebGpu(true)}
                style={{
                  flex: 1,
                  color: useWebGpu ? "#10b981" : "#fff",
                  background: useWebGpu
                    ? "rgba(16, 185, 129, 0.2)"
                    : "transparent",
                  border: useWebGpu
                    ? "1px solid #10b981"
                    : "1px solid rgba(255, 255, 255, 0.1)",
                  borderRadius: "6px",
                  padding: "6px",
                  cursor: "pointer",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: "4px",
                }}
              >
                <Zap className="w-4 h-4" />
                <span style={{ fontSize: "10px" }}>WebGPU</span>
              </button>
            </div>

            {/* Member Display Mode Toggle */}
            <div
              style={{
                fontSize: "10px",
                color: "#888",
                marginBottom: "4px",
                textTransform: "uppercase",
                letterSpacing: "0.5px",
                fontWeight: 600,
              }}
            >
              Member Display
            </div>
            <div style={{ display: "flex", gap: "4px", marginBottom: "8px" }}>
              <button
                onClick={() => setRenderMode3D(false)}
                style={{
                  flex: 1,
                  color: "#fff",
                  background: !renderMode3D ? "#444" : "transparent",
                  border: "1px solid rgba(255, 255, 255, 0.1)",
                  borderRadius: "6px",
                  padding: "6px",
                  cursor: "pointer",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: "4px",
                }}
                title="Wireframe mode - fast rendering"
              >
                <GitBranch className="w-4 h-4" />
                <span style={{ fontSize: "10px" }}>Wire</span>
              </button>
              <button
                onClick={() => setRenderMode3D(true)}
                style={{
                  flex: 1,
                  color: renderMode3D ? "#f59e0b" : "#fff",
                  background: renderMode3D
                    ? "rgba(245, 158, 11, 0.2)"
                    : "transparent",
                  border: renderMode3D
                    ? "1px solid #f59e0b"
                    : "1px solid rgba(255, 255, 255, 0.1)",
                  borderRadius: "6px",
                  padding: "6px",
                  cursor: "pointer",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: "4px",
                }}
                title="Solid 3D mode - realistic beam cross-sections"
              >
                <Box className="w-4 h-4" />
                <span style={{ fontSize: "10px" }}>Solid</span>
              </button>
            </div>

            <div
              style={{
                fontSize: "10px",
                color: "#888",
                marginBottom: "4px",
                textTransform: "uppercase",
                letterSpacing: "0.5px",
                fontWeight: 600,
              }}
            >
              Layout
            </div>
            <div style={{ display: "flex", gap: "4px" }}>
              <button
                onClick={() => setLayout("SINGLE")}
                style={{
                  flex: 1,
                  color: "#fff",
                  background:
                    layout === "SINGLE"
                      ? "#007bff"
                      : "rgba(255, 255, 255, 0.1)",
                  border:
                    layout === "SINGLE"
                      ? "1px solid #007bff"
                      : "1px solid rgba(255, 255, 255, 0.2)",
                  borderRadius: "4px",
                  padding: "6px",
                  cursor: "pointer",
                  fontSize: "11px",
                  fontWeight: 500,
                }}
              >
                Single
              </button>
              <button
                onClick={() => setLayout("QUAD")}
                style={{
                  flex: 1,
                  color: "#fff",
                  background:
                    layout === "QUAD" ? "#007bff" : "rgba(255, 255, 255, 0.1)",
                  border:
                    layout === "QUAD"
                      ? "1px solid #007bff"
                      : "1px solid rgba(255, 255, 255, 0.2)",
                  borderRadius: "4px",
                  padding: "6px",
                  cursor: "pointer",
                  fontSize: "11px",
                  fontWeight: 500,
                }}
              >
                Quad
              </button>
            </div>
          </div>
        )}
      </div>

      <SafeCanvasWrapper>
        <ViewportContainer layout={layout} useWebGpu={useWebGpu} />
      </SafeCanvasWrapper>
    </div>
  );
};
