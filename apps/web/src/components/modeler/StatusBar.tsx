/**
 * StatusBar — Industry-standard status bar (STAAD Pro / ETABS style).
 * Extracted from ModernModeler.tsx.
 */
import { FC, useState, useEffect, useMemo, memo } from "react";
import { useModelStore } from "../../store/model";
import { useUIStore } from "../../store/uiStore";
import { CoordinateInputBar } from "../ui/CoordinateInputBar";
import { API_CONFIG } from "../../config/env";
import { useHealthCheck, type HealthStatus } from "../../lib/health-check";

export const StatusBar: FC<{ isAnalyzing: boolean; onOpenDiagnostics?: () => void }> =
  memo(({ isAnalyzing, onOpenDiagnostics }) => {
    const nodes = useModelStore((state) => state.nodes);
    const members = useModelStore((state) => state.members);
    const plates = useModelStore((state) => state.plates);
    const selectedIds = useModelStore((state) => state.selectedIds);
    const analysisResults = useModelStore((state) => state.analysisResults);
    const { activeCategory, activeTool, showGrid, snapToGrid, gridSize, toggleSnap } = useUIStore();

    // Zoom level display — listens to camera zoom events (Figma §6.1 zone D)
    const [zoomLevel, setZoomLevel] = useState(100);
    useEffect(() => {
      const onZoomChange = (e: Event) => {
        const detail = (e as CustomEvent).detail;
        if (detail?.zoom != null) setZoomLevel(Math.round(detail.zoom));
      };
      document.addEventListener('zoom-changed', onZoomChange);
      return () => document.removeEventListener('zoom-changed', onZoomChange);
    }, []);

    const backendHealthConfigs = useMemo(
      () => [
        { name: "Node", url: `${API_CONFIG.baseUrl}/health`, timeout: 3500 },
        {
          name: "Python",
          url: `${API_CONFIG.pythonUrl}/health`,
          timeout: 3500,
        },
        { name: "Rust", url: `${API_CONFIG.rustUrl}/health`, timeout: 3500 },
      ],
      [],
    );

    const { health } = useHealthCheck({
      configs: backendHealthConfigs,
      interval: 30000,
      enabled: true,
    });

    const statusDotClass = (status: HealthStatus): string => {
      if (status === "healthy") return "bg-emerald-400";
      if (status === "degraded") return "bg-amber-400";
      if (status === "unhealthy") return "bg-red-400";
      return "bg-slate-500";
    };

    const checkByName = new Map(
      (health?.checks || []).map((c) => [c.name, c.status]),
    );

    // Selection info
    const selCount = selectedIds.size;
    const selNodes = Array.from(selectedIds).filter(id => id.startsWith("N")).length;
    const selMembers = Array.from(selectedIds).filter(id => id.startsWith("M")).length;

    return (
      <div className="h-6 bg-white/95 dark:bg-slate-900 backdrop-blur-sm border-t border-slate-800/60 flex items-center justify-between px-3 text-[11px] font-mono text-slate-500 flex-shrink-0 select-none font-medium">
        {/* Left Section — Status + Mode */}
        <div className="flex items-center gap-3">
          {/* Status Indicator */}
          <span className="flex items-center gap-1.5">
            <span
              className={`w-1.5 h-1.5 rounded-full ${isAnalyzing ? "bg-amber-400 animate-pulse" : analysisResults ? "bg-emerald-400" : "bg-emerald-400"}`}
            />
            <span className={isAnalyzing ? "text-amber-400" : analysisResults ? "text-emerald-400" : "text-slate-500 dark:text-slate-400"}>
              {isAnalyzing ? "Analyzing..." : analysisResults ? "Results Ready" : "Ready"}
            </span>
          </span>

          <span className="h-3 w-px bg-slate-100 dark:bg-slate-800" />

          {/* Active Mode */}
          <span>
            <span className="text-slate-600">Mode:</span>{" "}
            <span className="text-slate-500 dark:text-slate-400">{activeCategory}</span>
          </span>

          <span className="h-3 w-px bg-slate-100 dark:bg-slate-800" />

          {/* Active Tool */}
          <span>
            <span className="text-slate-600">Tool:</span>{" "}
            <span className="text-blue-400">{activeTool || "Select"}</span>
          </span>

          {/* Selection Info */}
          {selCount > 0 && (
            <>
              <span className="h-3 w-px bg-slate-100 dark:bg-slate-800" />
              <span className="text-cyan-400">
                Selected: {selCount}
                {selNodes > 0 && ` (${selNodes}N`}
                {selMembers > 0 && ` ${selMembers}M`}
                {(selNodes > 0 || selMembers > 0) && ")"}
              </span>
            </>
          )}
        </div>

        {/* Center — Coordinate Input (Live Component) */}
        <CoordinateInputBar
          snapActive={snapToGrid}
          gridSize={gridSize}
          onCoordinateSubmit={(x: number, y: number, z: number) => {
            // When user submits coordinates, add a node at that position
            const store = useModelStore.getState();
            if (store.activeTool === 'node') {
              const id = `N${store.nodes.size + 1}`;
              store.addNode({ id, x, y, z });
            }
          }}
        />

        {/* Right Section — Model Info + Backend Status */}
        <div className="flex items-center gap-3">
          {/* Grid/Snap Info */}
          <button type="button"
            onClick={() => toggleSnap()}
            className="flex items-center gap-1.5 hover:bg-slate-200/40 dark:hover:bg-slate-800/40 rounded px-1.5 py-0.5 -my-0.5 transition cursor-pointer"
            title="Click to toggle grid snap"
          >
            <span className={`w-1.5 h-1.5 rounded-full ${snapToGrid ? "bg-blue-400" : "bg-slate-600"}`} />
            <span className={snapToGrid ? "text-blue-400" : "text-slate-500"}>
              Snap {snapToGrid ? "ON" : "OFF"}
            </span>
          </button>

          <span className="h-3 w-px bg-slate-100 dark:bg-slate-800" />

          {/* Model Statistics — Figma §6.1 N/M/P counters */}
          <span>
            <span className="text-slate-600">N:</span>
            <span className="text-slate-500 dark:text-slate-400 font-mono ml-0.5">{nodes.size}</span>
          </span>
          <span>
            <span className="text-slate-600">M:</span>
            <span className="text-slate-500 dark:text-slate-400 font-mono ml-0.5">{members.size}</span>
          </span>
          <span>
            <span className="text-slate-600">P:</span>
            <span className="text-slate-500 dark:text-slate-400 font-mono ml-0.5">{plates.size}</span>
          </span>

          <span className="h-3 w-px bg-slate-100 dark:bg-slate-800" />

          {/* Active Load Case — Figma §6.1 */}
          <span className="cursor-pointer hover:text-blue-400 transition-colors" title="Click to change load case">
            <span className="text-slate-600">LC:</span>{" "}
            <span className="text-cyan-400 font-mono">DL+LL</span>
          </span>

          <span className="h-3 w-px bg-slate-100 dark:bg-slate-800" />

          {/* Units — Figma §6.1 */}
          <span className="cursor-pointer hover:text-blue-400 transition-colors" title="Click to change units">
            <span className="text-slate-600">Units:</span>{" "}
            <span className="text-slate-500 dark:text-slate-400">kN, m</span>
          </span>

          <span className="h-3 w-px bg-slate-100 dark:bg-slate-800" />

          {/* Zoom Level — Figma §6.1 zone D */}
          <span>
            <span className="text-slate-600">Zoom:</span>{" "}
            <span className="text-slate-500 dark:text-slate-400 font-mono">{zoomLevel}%</span>
          </span>

          <span className="h-3 w-px bg-slate-100 dark:bg-slate-800" />

          {/* Backend Health */}
          <button type="button"
            onClick={onOpenDiagnostics}
            className="flex items-center gap-1.5 hover:bg-slate-200/40 dark:hover:bg-slate-800/40 rounded px-1.5 py-0.5 -my-0.5 transition cursor-pointer"
            title="Click for integration diagnostics"
          >
            {(["Node", "Python", "Rust"] as const).map((name) => {
              const status = checkByName.get(name) || "unknown";
              return (
                <span
                  key={name}
                  className="flex items-center gap-0.5"
                  title={`${name}: ${status}`}
                >
                  <span className={`w-1 h-1 rounded-full ${statusDotClass(status)}`} />
                  <span className="text-slate-500">{name}</span>
                </span>
              );
            })}
          </button>
        </div>
      </div>
    );
  });
StatusBar.displayName = "StatusBar";
