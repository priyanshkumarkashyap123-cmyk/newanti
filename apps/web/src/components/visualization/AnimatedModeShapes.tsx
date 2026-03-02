/**
 * AnimatedModeShapes.tsx
 *
 * Animated Visualization of Modal Analysis Results
 *
 * Features:
 * - WebGL-based animation
 * - Multiple mode display
 * - Amplitude control
 * - Speed control
 * - Export to video/GIF
 */

import React, {
  useRef,
  useEffect,
  useState,
  useCallback,
  useMemo,
} from "react";

// ============================================
// TYPES
// ============================================

export interface ModeShape {
  modeNumber: number;
  frequency: number; // Hz
  period: number; // seconds
  participationFactor: number;
  direction: "X" | "Y" | "Z" | "RX" | "RY" | "RZ";
  displacements: Array<{
    nodeId: string;
    x: number;
    y: number;
    z: number;
    rx?: number;
    ry?: number;
    rz?: number;
  }>;
}

export interface NodePosition {
  id: string;
  x: number;
  y: number;
  z: number;
}

export interface AnimationSettings {
  amplitudeScale: number;
  speed: number;
  showUndeformed: boolean;
  colorScale: "displacement" | "stress" | "none";
}

// ============================================
// ANIMATED MODE SHAPES COMPONENT
// ============================================

export const AnimatedModeShapes: React.FC<{
  nodes: NodePosition[];
  members: Array<{ id: string; startNode: string; endNode: string }>;
  modeShapes: ModeShape[];
  width?: number;
  height?: number;
}> = ({ nodes, members, modeShapes, width = 800, height = 600 }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();
  const [selectedMode, setSelectedMode] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [settings, setSettings] = useState<AnimationSettings>({
    amplitudeScale: 10,
    speed: 1,
    showUndeformed: true,
    colorScale: "displacement",
  });

  // Get current mode shape
  const currentMode = modeShapes[selectedMode];

  // ── Precomputed lookup maps (O(1) instead of O(n) per hit) ──
  const nodeMap = useMemo(() => {
    const m = new Map<string, NodePosition>();
    for (const n of nodes) m.set(n.id, n);
    return m;
  }, [nodes]);

  const displacementMap = useMemo(() => {
    const m = new Map<string, ModeShape["displacements"][number]>();
    if (currentMode) {
      for (const d of currentMode.displacements) m.set(d.nodeId, d);
    }
    return m;
  }, [currentMode]);

  const maxDisplacementMag = useMemo(() => {
    if (!currentMode) return 1;
    let max = 0;
    for (const d of currentMode.displacements) {
      const mag = Math.sqrt(d.x ** 2 + d.y ** 2 + d.z ** 2);
      if (mag > max) max = mag;
    }
    return max || 1;
  }, [currentMode]);

  /**
   * Calculate deformed position at time t
   */
  const getDeformedPosition = useCallback(
    (nodeId: string, t: number): NodePosition | null => {
      if (!currentMode) return null;

      const originalNode = nodeMap.get(nodeId);
      const displacement = displacementMap.get(nodeId);

      if (!originalNode || !displacement) return null;

      const omega = 2 * Math.PI * currentMode.frequency * settings.speed;
      const phase = Math.sin(omega * t);
      const scale = settings.amplitudeScale;

      return {
        id: nodeId,
        x: originalNode.x + displacement.x * phase * scale,
        y: originalNode.y + displacement.y * phase * scale,
        z: originalNode.z + displacement.z * phase * scale,
      };
    },
    [
      currentMode,
      nodeMap,
      displacementMap,
      settings.amplitudeScale,
      settings.speed,
    ],
  );

  /**
   * Get color based on displacement magnitude
   */
  const getDisplacementColor = useCallback(
    (displacement: { x: number; y: number; z: number }): string => {
      const mag = Math.sqrt(
        displacement.x ** 2 + displacement.y ** 2 + displacement.z ** 2,
      );
      const ratio = mag / maxDisplacementMag;

      // Blue -> Green -> Yellow -> Red
      const r = Math.floor(255 * Math.min(1, ratio * 2));
      const g = Math.floor(255 * (ratio < 0.5 ? ratio * 2 : 2 - ratio * 2));
      const b = Math.floor(255 * Math.max(0, 1 - ratio * 2));

      return `rgb(${r}, ${g}, ${b})`;
    },
    [maxDisplacementMag],
  );

  /**
   * Draw the structure
   */
  const draw = useCallback(
    (t: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      ctx.clearRect(0, 0, width, height);

      // Transform world to screen coordinates
      const scale = Math.min(width, height) / 20; // Assuming 20m max dimension
      const offsetX = width / 2;
      const offsetY = height / 2;

      const worldToScreen = (pos: { x: number; y: number; z: number }) => ({
        x: offsetX + pos.x * scale,
        y: offsetY - pos.y * scale, // Flip Y for screen coordinates
      });

      // Draw undeformed structure
      if (settings.showUndeformed) {
        ctx.strokeStyle = "rgba(100, 100, 100, 0.3)";
        ctx.lineWidth = 1;

        for (const member of members) {
          const startNode = nodeMap.get(member.startNode);
          const endNode = nodeMap.get(member.endNode);
          if (!startNode || !endNode) continue;

          const start = worldToScreen(startNode);
          const end = worldToScreen(endNode);

          ctx.beginPath();
          ctx.moveTo(start.x, start.y);
          ctx.lineTo(end.x, end.y);
          ctx.stroke();
        }
      }

      // Draw deformed structure
      if (currentMode) {
        ctx.lineWidth = 3;

        for (const member of members) {
          const startDef = getDeformedPosition(member.startNode, t);
          const endDef = getDeformedPosition(member.endNode, t);
          if (!startDef || !endDef) continue;

          const start = worldToScreen(startDef);
          const end = worldToScreen(endDef);

          // Get color from displacement
          const disp = displacementMap.get(member.startNode);
          if (settings.colorScale === "displacement" && disp) {
            ctx.strokeStyle = getDisplacementColor(disp);
          } else {
            ctx.strokeStyle = "#4ade80"; // Green
          }

          ctx.beginPath();
          ctx.moveTo(start.x, start.y);
          ctx.lineTo(end.x, end.y);
          ctx.stroke();
        }

        // Draw nodes
        for (const node of nodes) {
          const defNode = getDeformedPosition(node.id, t);
          if (!defNode) continue;

          const pos = worldToScreen(defNode);
          const disp = displacementMap.get(node.id);

          if (settings.colorScale === "displacement" && disp) {
            ctx.fillStyle = getDisplacementColor(disp);
          } else {
            ctx.fillStyle = "#4ade80";
          }

          ctx.beginPath();
          ctx.arc(pos.x, pos.y, 4, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Draw info text
      ctx.fillStyle = "#fff";
      ctx.font = "14px monospace";
      if (currentMode) {
        ctx.fillText(
          `Mode ${currentMode.modeNumber}: f = ${currentMode.frequency.toFixed(2)} Hz (T = ${currentMode.period.toFixed(3)} s)`,
          10,
          20,
        );
        ctx.fillText(
          `Direction: ${currentMode.direction}, Participation: ${(currentMode.participationFactor * 100).toFixed(1)}%`,
          10,
          40,
        );
      }
    },
    [
      currentMode,
      members,
      nodes,
      width,
      height,
      settings,
      getDeformedPosition,
      getDisplacementColor,
      nodeMap,
      displacementMap,
    ],
  );

  /**
   * Animation loop
   */
  useEffect(() => {
    let startTime: number;

    const animate = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const elapsed = (timestamp - startTime) / 1000;

      if (isPlaying) {
        draw(elapsed);
      }

      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [draw, isPlaying]);

  /**
   * Export current frame as image
   */
  const exportImage = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const link = document.createElement("a");
    link.download = `mode_shape_${currentMode?.modeNumber || 1}.png`;
    link.href = canvas.toDataURL();
    link.click();
  };

  return (
    <div className="bg-slate-50 dark:bg-slate-900 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 bg-slate-100 dark:bg-slate-800 border-b border-slate-700 flex items-center justify-between">
        <h3 className="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
          <span>🎬</span>
          Animated Mode Shapes
        </h3>
        <div className="flex items-center gap-2">
          <button type="button"
            onClick={() => setIsPlaying(!isPlaying)}
            className={`px-3 py-1 rounded text-sm font-medium ${
              isPlaying ? "bg-yellow-500 text-black" : "bg-green-500 text-white"
            }`}
          >
            {isPlaying ? "⏸ Pause" : "▶ Play"}
          </button>
          <button type="button"
            onClick={exportImage}
            className="px-3 py-1 bg-slate-700 text-slate-900 dark:text-white rounded text-sm hover:bg-slate-600"
          >
            📷 Export
          </button>
        </div>
      </div>

      {/* Canvas */}
      <div className="relative">
        <canvas
          ref={canvasRef}
          width={width}
          height={height}
          className="bg-slate-950"
        />
      </div>

      {/* Controls */}
      <div className="p-4 bg-slate-100 dark:bg-slate-800 border-t border-slate-700 space-y-3">
        {/* Mode Selection */}
        <div className="flex items-center gap-4">
          <label className="text-slate-500 dark:text-slate-400 text-sm">Mode:</label>
          <div className="flex gap-1">
            {modeShapes.slice(0, 10).map((mode, i) => (
              <button type="button"
                key={i}
                onClick={() => setSelectedMode(i)}
                className={`w-8 h-8 rounded text-sm font-medium ${
                  selectedMode === i
                    ? "bg-blue-500 text-white"
                    : "bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-600"
                }`}
              >
                {mode.modeNumber}
              </button>
            ))}
          </div>
        </div>

        {/* Amplitude */}
        <div className="flex items-center gap-4">
          <label className="text-slate-500 dark:text-slate-400 text-sm w-20">Amplitude:</label>
          <input
            type="range"
            min="1"
            max="50"
            value={settings.amplitudeScale}
            onChange={(e) =>
              setSettings((s) => ({
                ...s,
                amplitudeScale: Number(e.target.value),
              }))
            }
            className="flex-1"
          />
          <span className="text-slate-900 dark:text-white text-sm w-10">
            {settings.amplitudeScale}x
          </span>
        </div>

        {/* Speed */}
        <div className="flex items-center gap-4">
          <label className="text-slate-500 dark:text-slate-400 text-sm w-20">Speed:</label>
          <input
            type="range"
            min="0.1"
            max="3"
            step="0.1"
            value={settings.speed}
            onChange={(e) =>
              setSettings((s) => ({ ...s, speed: Number(e.target.value) }))
            }
            className="flex-1"
          />
          <span className="text-slate-900 dark:text-white text-sm w-10">{settings.speed}x</span>
        </div>

        {/* Options */}
        <div className="flex items-center gap-6">
          <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
            <input
              type="checkbox"
              checked={settings.showUndeformed}
              onChange={(e) =>
                setSettings((s) => ({ ...s, showUndeformed: e.target.checked }))
              }
              className="rounded"
            />
            Show undeformed
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
            <select
              value={settings.colorScale}
              onChange={(e) =>
                setSettings((s) => ({
                  ...s,
                  colorScale: e.target.value as any,
                }))
              }
              className="bg-slate-700 rounded px-2 py-1 text-sm"
            >
              <option value="displacement">Color by displacement</option>
              <option value="none">Uniform color</option>
            </select>
          </label>
        </div>
      </div>
    </div>
  );
};

export default AnimatedModeShapes;
