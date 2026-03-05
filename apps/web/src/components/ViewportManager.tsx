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
import { useShallow } from "zustand/react/shallow";
import { useMultiplayerContextSafe } from "./collaborators/MultiplayerContext";
import { Cpu, Zap, Box, GitBranch, Square, Rotate3d } from "lucide-react";

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
    className="w-full h-full text-[#e5e7eb] flex items-center justify-center p-8"
    style={{
      background:
        "radial-gradient(circle at 20% 20%, rgba(34,197,94,0.08), rgba(10,10,10,0.95))",
    }}
  >
    <div
      className="max-w-[640px] w-full bg-[#0b1120] border border-[rgba(255,255,255,0.08)] rounded-2xl p-6 shadow-[0_10px_50px_rgba(0,0,0,0.35)]"
    >
      <div
        className="flex items-center gap-3 mb-3"
      >
        <div
          className="w-9 h-9 rounded-[10px] bg-[rgba(239,68,68,0.1)] flex items-center justify-center text-[#f87171]"
        >
          ⚠️
        </div>
        <div>
          <div className="text-lg font-bold">
            3D Viewer needs WebGL
          </div>
          <div className="text-[13px] text-[#94a3b8]">
            Your browser/device couldn’t create a WebGL context. The workspace
            is disabled to avoid crashes.
          </div>
        </div>
      </div>
      <div
        className="text-[13px] text-[#cbd5e1] leading-[1.6] mb-3"
      >
        Try these quick fixes, then refresh:
      </div>
      <ul
        className="text-[13px] text-[#cbd5e1] leading-[1.6] pl-[18px] mb-3.5"
      >
        <li>Enable hardware acceleration in your browser settings</li>
        <li>Close GPU-intensive tabs/apps and reload</li>
        <li>Update your browser or switch to Chrome/Edge latest</li>
        <li>Ensure WebGL is not blocked by extensions or corporate policy</li>
      </ul>
      {error && (
        <div
          className="text-xs text-[#94a3b8] bg-[rgba(255,255,255,0.04)] p-3 rounded-[10px] border border-[rgba(255,255,255,0.05)] mb-3.5"
        >
          <div className="font-semibold mb-1">
            Technical details
          </div>
          <div className="whitespace-pre-wrap">{error}</div>
        </div>
      )}
      <div className="flex gap-3 flex-wrap">
        <button type="button"
          onClick={() => window.location.reload()}
          className="py-2.5 px-3.5 bg-[#22c55e] text-[#0b1120] border-none rounded-[10px] font-bold cursor-pointer"
        >
          Reload after enabling WebGL
        </button>
        <a
          href="https://get.webgl.org/"
          target="_blank"
          rel="noreferrer"
          className="py-2.5 px-3 border border-[rgba(255,255,255,0.15)] rounded-[10px] text-[#e5e7eb] no-underline"
        >
          Check WebGL support →
        </a>
      </div>
    </div>
  </div>
);

const WebglChecking: FC = () => (
  <div
    className="w-full h-full flex items-center justify-center bg-[#0b1120] text-[#cbd5e1]"
  >
    <div className="text-center">
      <div className="mb-3 font-bold text-base">
        Checking graphics compatibility…
      </div>
      <div className="text-[13px] text-[#94a3b8]">
        Preparing the 3D workspace
      </div>
    </div>
  </div>
);

const ViewportContainer: FC<{
  className?: string;
  layout: ViewportLayout;
  useWebGpu: boolean;
  viewMode: '2D' | '3D';
}> = ({ className, layout, useWebGpu, viewMode }) => {
  const mainRef = useRef<HTMLDivElement>(null);
  const topRef = useRef<HTMLDivElement>(null);
  const frontRef = useRef<HTMLDivElement>(null);
  const rightRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

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

  // Robust single-view path: avoid View/track composition for the default mode.
  // This prevents blank viewport regressions when track-based views fail to mount.
  if (layout === "SINGLE") {
    return (
      <div
        ref={containerRef}
        className="w-full h-full relative touch-none"
      >
        <div
          className="absolute top-2 left-2 text-white z-10 text-[11px] opacity-80 font-medium"
        >
          {viewMode === '2D' ? '2D View' : 'Perspective'}
        </div>

        <Canvas
          className="absolute top-0 left-0 w-full h-full"
          eventSource={containerRef as MutableRefObject<HTMLElement>}
          shadows
          dpr={[1, 1.5]}
          gl={{
            preserveDrawingBuffer: true,
            antialias: true,
            alpha: false,
            powerPreference: "high-performance",
            failIfMajorPerformanceCaveat: false,
          }}
          camera={{ position: [20, 20, 20], fov: 50 }}
          onCreated={(state) => {
            const canvas = state.gl.domElement;
            canvasRef.current = canvas;
            const handleContextLost = (e: Event) => {
              e.preventDefault();
              console.warn(
                "[ViewportManager] WebGL context lost — will attempt restore",
              );
            };
            const handleContextRestored = () => {
              // Context restored successfully
            };
            canvas.addEventListener("webglcontextlost", handleContextLost);
            canvas.addEventListener("webglcontextrestored", handleContextRestored);
          }}
        >
          <color attach="background" args={["#1a1a1a"]} />

          {viewMode === '3D' ? (
            <>
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
            </>
          ) : (
            <>
              <OrthographicCamera
                makeDefault
                position={[0, 50, 0.001]}
                zoom={15}
                up={[0, 0, -1]}
              />
              <OrbitControls
                makeDefault
                enableRotate={false}
                enableZoom={true}
                enablePan={true}
                zoomToCursor={true}
                panSpeed={1.5}
                mouseButtons={{ LEFT: 2, MIDDLE: 2, RIGHT: 2 }}
              />
            </>
          )}

          <CameraFitController />
          <Suspense fallback={null}>
            <SharedScene remoteUsers={remoteUsers} />
          </Suspense>
          <BoxSelector />
        </Canvas>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="w-full h-full relative touch-none"
    >
      {/* CSS Grid Layout for Viewports */}
      <div
        className="grid w-full h-full gap-[2px] bg-[#222]"
        style={{
          gridTemplateColumns: "1fr 1fr",
          gridTemplateRows: "1fr 1fr",
        }}
      >
        {/* Main 3D Perspective View */}
        <div
          ref={mainRef}
          className="relative bg-[#1a1a1a] overflow-hidden"
        >
          <div
            className="absolute top-2 left-2 text-white z-10 text-[11px] opacity-80 font-medium"
          >
            {viewMode === '2D' ? '2D View' : 'Perspective'}
          </div>
        </div>

        {layout === "QUAD" && (
          <>
            <div
              ref={topRef}
              className="relative bg-[#1a1a1a] overflow-hidden"
            >
              <div
                className="absolute top-2 left-2 text-white z-10 text-[11px] opacity-80 font-medium"
              >
                Top
              </div>
            </div>
            <div
              ref={frontRef}
              className="relative bg-[#1a1a1a] overflow-hidden"
            >
              <div
                className="absolute top-2 left-2 text-white z-10 text-[11px] opacity-80 font-medium"
              >
                Front
              </div>
            </div>
            <div
              ref={rightRef}
              className="relative bg-[#1a1a1a] overflow-hidden"
            >
              <div
                className="absolute top-2 left-2 text-white z-10 text-[11px] opacity-80 font-medium"
              >
                Right
              </div>
            </div>
          </>
        )}
      </div>

      {/* Single Canvas with Views */}
      <Canvas
        className="absolute top-0 left-0 w-full h-full"
        eventSource={containerRef as MutableRefObject<HTMLElement>}
        shadows
        dpr={[1, 1.5]}
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
        {/* Perspective / 2D View */}
        <View track={mainRef as MutableRefObject<HTMLElement>}>
          <color attach="background" args={["#1a1a1a"]} />
          {viewMode === '3D' ? (
            <>
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
            </>
          ) : (
            <>
              <OrthographicCamera
                makeDefault
                position={[0, 50, 0.001]}
                zoom={15}
                up={[0, 0, -1]}
              />
              <OrbitControls
                makeDefault
                enableRotate={false}
                enableZoom={true}
                enablePan={true}
                zoomToCursor={true}
                panSpeed={1.5}
                mouseButtons={{ LEFT: 2, MIDDLE: 2, RIGHT: 2 }}
              />
            </>
          )}
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
  const [layout, setLayout] = useState<ViewportLayout>("SINGLE");
  const [isGEMinimized, setIsGEMinimized] = useState(true);
  const [webGpuNoticeDismissed, setWebGpuNoticeDismissed] = useState(() => {
    try { return localStorage.getItem('beamlab-webgpu-notice-dismissed') === 'true'; } catch { return false; }
  });
  const [webglStatus, setWebglStatus] = useState<
    "pending" | "ok" | "unsupported"
  >("ok");
  const [webglError, setWebglError] = useState<string | null>(null);
  const {
    useWebGpu, setUseWebGpu,
    renderMode3D, setRenderMode3D,
    viewMode, setViewMode,
  } = useUIStore(
    useShallow((state) => ({
      useWebGpu: state.useWebGpu,
      setUseWebGpu: state.setUseWebGpu,
      renderMode3D: state.renderMode3D,
      setRenderMode3D: state.setRenderMode3D,
      viewMode: state.viewMode,
      setViewMode: state.setViewMode,
    }))
  );

  useEffect(() => {
    // Check WebGL support with a small delay to avoid racing with other canvas initializations
    const timer = setTimeout(() => {
      const result = checkWebglSupport();
      if (!result.supported) {
        // Retry once after a short delay — some browsers need a moment
        // after a context was lost/restored from another tab
        setTimeout(() => {
          const retry = checkWebglSupport();
          if (!retry.supported) {
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

  // WebGPU renderer is intentionally disabled in this build.
  // If a persisted setting turns it on, force WebGL so viewport remains visible.
  useEffect(() => {
    if (useWebGpu) {
      console.warn("[ViewportManager] WebGPU is unavailable in this build. Falling back to WebGL.");
      setUseWebGpu(false);
    }
  }, [useWebGpu, setUseWebGpu]);

  // Show warning banner but still render canvas (non-blocking fallback)
  const showWebglWarning = webglStatus === "unsupported";

  return (
    <div
      className="w-full h-full relative touch-none"
    >
      {/* Compact Controls Cluster - Top Right */}
      <div
        className="absolute top-2.5 right-2.5 z-50 flex flex-col gap-1.5 items-end"
      >
        {showWebglWarning && (
          <div className="max-w-[320px] bg-red-900/90 border border-red-500/50 rounded-lg px-3 py-2 text-[11px] text-white shadow-lg">
            <div className="font-semibold mb-1">⚠️ WebGL Detection Issue</div>
            <div className="text-red-100">{webglError || "WebGL may not be available"}</div>
            <div className="text-red-200 mt-1 text-[10px]">
              Attempting to render anyway. If you see a blank canvas, try updating your browser.
            </div>
          </div>
        )}
        {!webGpuNoticeDismissed && (
          <div className="max-w-[280px] bg-[rgba(0,0,0,0.85)] border border-[rgba(255,255,255,0.12)] rounded-lg px-3 py-2 text-[11px] text-[#d1d5db] shadow-[0_4px_12px_rgba(0,0,0,0.35)]">
            <div className="flex items-start justify-between gap-2">
              <span>
                WebGPU is temporarily unavailable. Using WebGL for reliable 2D/3D rendering.
              </span>
              <button
                type="button"
                onClick={() => {
                  setWebGpuNoticeDismissed(true);
                  try { localStorage.setItem('beamlab-webgpu-notice-dismissed', 'true'); } catch {}
                }}
                className="text-[#9ca3af] hover:text-white"
                aria-label="Dismiss WebGPU notice"
              >
                ×
              </button>
            </div>
          </div>
        )}

        {/* Graphics Engine Toggle - Collapsible */}
        {isGEMinimized ? (
          <button type="button"
            onClick={() => setIsGEMinimized(false)}
            className="bg-[rgba(0,0,0,0.85)] py-1.5 px-2.5 rounded-lg border border-[rgba(255,255,255,0.15)] shadow-[0_2px_8px_rgba(0,0,0,0.3)] text-white cursor-pointer text-[11px] flex items-center gap-1.5"
            title="Expand Graphics Engine Settings"
          >
            ⚙️ Display
          </button>
        ) : (
          <div
            className="bg-[rgba(0,0,0,0.85)] p-2.5 rounded-[10px] border border-[rgba(255,255,255,0.15)] shadow-[0_4px_12px_rgba(0,0,0,0.4)] min-w-[120px]"
          >
            {/* Header with minimize */}
            <div
              className="flex justify-between items-center mb-2"
            >
              <div
                className="text-[10px] text-[#888] uppercase tracking-[0.5px] font-semibold"
              >
                Graphics Engine
              </div>
              <button type="button"
                onClick={() => setIsGEMinimized(true)}
                className="bg-transparent border-none text-[#888] cursor-pointer text-sm py-0.5 px-1.5 rounded"
                title="Minimize"
              >
                −
              </button>
            </div>
            <div className="flex gap-1 mb-2">
              <button type="button"
                onClick={() => setUseWebGpu(false)}
                className="flex-1 text-white border border-[rgba(255,255,255,0.1)] rounded-md p-1.5 cursor-pointer flex flex-col items-center gap-1"
                style={{
                  background: !useWebGpu ? "#444" : "transparent",
                }}
              >
                <Cpu className="w-4 h-4" />
                <span className="text-[10px]">WebGL</span>
              </button>
              <button type="button"
                onClick={() => setUseWebGpu(false)}
                disabled
                className="flex-1 rounded-md p-1.5 cursor-pointer flex flex-col items-center gap-1"
                style={{
                  color: "#6b7280",
                  background: "transparent",
                  border: "1px solid rgba(255, 255, 255, 0.1)",
                  opacity: 0.6,
                }}
                title="WebGPU renderer is temporarily unavailable"
              >
                <Zap className="w-4 h-4" />
                <span className="text-[10px]">WebGPU</span>
              </button>
            </div>

            {/* Member Display Mode Toggle */}
            <div
              className="text-[10px] text-[#888] mb-1 uppercase tracking-[0.5px] font-semibold"
            >
              Member Display
            </div>
            <div className="flex gap-1 mb-2">
              <button type="button"
                onClick={() => setRenderMode3D(false)}
                className="flex-1 text-white border border-[rgba(255,255,255,0.1)] rounded-md p-1.5 cursor-pointer flex flex-col items-center gap-1"
                style={{
                  background: !renderMode3D ? "#444" : "transparent",
                }}
                title="Wireframe mode - fast rendering"
              >
                <GitBranch className="w-4 h-4" />
                <span className="text-[10px]">Wire</span>
              </button>
              <button type="button"
                onClick={() => setRenderMode3D(true)}
                className="flex-1 rounded-md p-1.5 cursor-pointer flex flex-col items-center gap-1"
                style={{
                  color: renderMode3D ? "#f59e0b" : "#fff",
                  background: renderMode3D
                    ? "rgba(245, 158, 11, 0.2)"
                    : "transparent",
                  border: renderMode3D
                    ? "1px solid #f59e0b"
                    : "1px solid rgba(255, 255, 255, 0.1)",
                }}
                title="Solid 3D mode - realistic beam cross-sections"
              >
                <Box className="w-4 h-4" />
                <span className="text-[10px]">Solid</span>
              </button>
            </div>

            <div
              className="text-[10px] text-[#888] mb-1 uppercase tracking-[0.5px] font-semibold"
            >
              View Mode
            </div>
            <div className="flex gap-1 mb-2">
              <button type="button"
                onClick={() => setViewMode('2D')}
                className="flex-1 rounded-md p-1.5 cursor-pointer flex flex-col items-center gap-1"
                style={{
                  color: viewMode === '2D' ? '#3b82f6' : '#fff',
                  background: viewMode === '2D' ? 'rgba(59, 130, 246, 0.2)' : 'transparent',
                  border: viewMode === '2D' ? '1px solid #3b82f6' : '1px solid rgba(255, 255, 255, 0.1)',
                }}
                title="2D orthographic view — no rotation"
              >
                <Square className="w-4 h-4" />
                <span className="text-[10px]">2D</span>
              </button>
              <button type="button"
                onClick={() => setViewMode('3D')}
                className="flex-1 rounded-md p-1.5 cursor-pointer flex flex-col items-center gap-1"
                style={{
                  color: viewMode === '3D' ? '#f59e0b' : '#fff',
                  background: viewMode === '3D' ? 'rgba(245, 158, 11, 0.2)' : 'transparent',
                  border: viewMode === '3D' ? '1px solid #f59e0b' : '1px solid rgba(255, 255, 255, 0.1)',
                }}
                title="3D perspective view — full orbit rotation"
              >
                <Rotate3d className="w-4 h-4" />
                <span className="text-[10px]">3D</span>
              </button>
            </div>

            <div
              className="text-[10px] text-[#888] mb-1 uppercase tracking-[0.5px] font-semibold"
            >
              Layout
            </div>
            <div className="flex gap-1">
              <button type="button"
                onClick={() => setLayout("SINGLE")}
                className="flex-1 text-white rounded p-1.5 cursor-pointer text-[11px] font-medium"
                style={{
                  background:
                    layout === "SINGLE"
                      ? "#007bff"
                      : "rgba(255, 255, 255, 0.1)",
                  border:
                    layout === "SINGLE"
                      ? "1px solid #007bff"
                      : "1px solid rgba(255, 255, 255, 0.2)",
                }}
              >
                Single
              </button>
              <button type="button"
                onClick={() => setLayout("QUAD")}
                className="flex-1 text-white rounded p-1.5 cursor-pointer text-[11px] font-medium"
                style={{
                  background:
                    layout === "QUAD" ? "#007bff" : "rgba(255, 255, 255, 0.1)",
                  border:
                    layout === "QUAD"
                      ? "1px solid #007bff"
                      : "1px solid rgba(255, 255, 255, 0.2)",
                }}
              >
                Quad
              </button>
            </div>
          </div>
        )}
      </div>

      <SafeCanvasWrapper>
        <ViewportContainer layout={layout} useWebGpu={useWebGpu} viewMode={viewMode} />
      </SafeCanvasWrapper>
    </div>
  );
};
