/**
 * StatusBar — Industry-standard status bar (STAAD Pro / ETABS style).
 * Extracted from ModernModeler.tsx.
 */
import { FC, useState, useEffect, useMemo, useRef, useCallback, memo } from "react";
import { useModelStore } from "../../store/model";
import { useUIStore } from "../../store/uiStore";
import { useShallow } from "zustand/react/shallow";
import { useModelCounts, useDebouncedModelSelect } from "../../hooks/useDebouncedModelSelect";
import { CoordinateInputBar } from "../ui/CoordinateInputBar";
import { API_CONFIG } from "../../config/env";
import { useHealthCheck, type HealthStatus } from "../../lib/health-check";

// ============================================
// UNIT SYSTEM OPTIONS
// ============================================

const UNIT_OPTIONS: { id: NonNullable<ReturnType<typeof useUIStore.getState>['unitSystem']>; label: string }[] = [
  { id: 'kN_m',  label: 'kN, m' },
  { id: 'kN_mm', label: 'kN, mm' },
  { id: 'N_mm',  label: 'N, mm' },
  { id: 'kip_ft', label: 'kip, ft' },
  { id: 'lb_in', label: 'lb, in' },
];

// ============================================
// POPOVER HOOK — click-outside closes
// ============================================

function usePopover() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return { open, setOpen, ref };
}

// ============================================
// LOAD CASE POPOVER
// ============================================

const LoadCasePopover: FC = memo(() => {
  const { open, setOpen, ref } = usePopover();
  const loadCases = useModelStore((s) => s.loadCases);
  const activeLoadCaseId = useModelStore((s) => s.activeLoadCaseId);
  const setActiveLoadCase = useModelStore((s) => s.setActiveLoadCase);

  const activeName = useMemo(() => {
    if (!activeLoadCaseId) return loadCases.length > 0 ? loadCases[0]?.name ?? 'DL+LL' : 'DL+LL';
    return loadCases.find((lc) => lc.id === activeLoadCaseId)?.name ?? 'DL+LL';
  }, [loadCases, activeLoadCaseId]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 hover:text-blue-400 transition-colors cursor-pointer"
        title="Click to change load case"
      >
        <span className="text-slate-500 dark:text-slate-500">LC:</span>
        <span className="text-cyan-400 font-mono">{activeName}</span>
      </button>
      {open && (
        <div className="absolute bottom-full mb-1 left-0 min-w-[160px] bg-[#131b2e] border border-[#1a2333] rounded-lg shadow-xl py-1 z-50 max-h-48 overflow-y-auto">
          {loadCases.length === 0 ? (
            <div className="px-3 py-2 text-[11px] text-slate-400 italic">No load cases defined</div>
          ) : (
            loadCases.map((lc) => (
              <button
                type="button"
                key={lc.id}
                onClick={() => { setActiveLoadCase(lc.id); setOpen(false); }}
                className={`w-full text-left px-3 py-1.5 text-[11px] transition-colors ${
                  lc.id === activeLoadCaseId
                    ? 'bg-blue-500/10 text-blue-400 font-medium tracking-wide'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                }`}
              >
                {lc.name}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
});
LoadCasePopover.displayName = 'LoadCasePopover';

// ============================================
// UNITS POPOVER
// ============================================

const UnitsPopover: FC = memo(() => {
  const { open, setOpen, ref } = usePopover();
  const unitSystem = useUIStore((s) => s.unitSystem);
  const setUnitSystem = useUIStore((s) => s.setUnitSystem);

  const activeLabel = UNIT_OPTIONS.find((u) => u.id === unitSystem)?.label ?? 'kN, m';

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 hover:text-blue-400 transition-colors cursor-pointer"
        title="Click to change units"
      >
        <span className="text-slate-500 dark:text-slate-500">Units:</span>
        <span className="text-[#869ab8]">{activeLabel}</span>
      </button>
      {open && (
        <div className="absolute bottom-full mb-1 left-0 min-w-[120px] bg-[#131b2e] border border-[#1a2333] rounded-lg shadow-xl py-1 z-50">
          {UNIT_OPTIONS.map((u) => (
            <button
              type="button"
              key={u.id}
              onClick={() => { setUnitSystem(u.id); setOpen(false); }}
              className={`w-full text-left px-3 py-1.5 text-[11px] transition-colors ${
                u.id === unitSystem
                  ? 'bg-blue-500/10 text-blue-400 font-medium tracking-wide'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
              }`}
            >
              {u.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
});
UnitsPopover.displayName = 'UnitsPopover';

// ============================================
// MAIN STATUS BAR
// ============================================

export const StatusBar: FC<{ isAnalyzing: boolean; onOpenDiagnostics?: () => void }> =
  memo(({ isAnalyzing, onOpenDiagnostics }) => {
    // Debounced counts — only re-renders when count ACTUALLY changes, checked every 200ms
    const { nodeCount, memberCount, plateCount, selectedCount } = useModelCounts();
    // Debounced selectedIds for selection breakdown (200ms)
    const selectedIds = useDebouncedModelSelect((s) => s.selectedIds, 200);
    const analysisResults = useModelStore((state) => state.analysisResults);
    const { activeCategory, activeTool, showGrid, snapToGrid, gridSize, toggleSnap } = useUIStore(
      useShallow((s) => ({
        activeCategory: s.activeCategory,
        activeTool: s.activeTool,
        showGrid: s.showGrid,
        snapToGrid: s.snapToGrid,
        gridSize: s.gridSize,
        toggleSnap: s.toggleSnap,
      }))
    );

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
    const selCount = selectedCount;
    const selNodes = Array.from(selectedIds).filter(id => id.startsWith("N")).length;
    const selMembers = Array.from(selectedIds).filter(id => id.startsWith("M")).length;

    return (
      <div className="h-6 bg-slate-100 dark:bg-slate-900 border-t border-[#1a2333] flex items-center justify-between px-4 text-xs font-mono text-[#869ab8] flex-shrink-0 select-none">
        {/* Left Section — Status + Mode */}
        <div className="flex items-center gap-3">
          {/* Status Indicator */}
          <span className="flex items-center gap-1.5">
            <span
              className={`w-1.5 h-1.5 rounded-full ${isAnalyzing ? "bg-amber-400 animate-pulse" : analysisResults ? "bg-emerald-400" : "bg-emerald-400"}`}
            />
            <span className={isAnalyzing ? "text-amber-400" : analysisResults ? "text-emerald-400" : "text-[#869ab8]"}>
              {isAnalyzing ? "Analyzing..." : analysisResults ? "Results Ready" : "Ready"}
            </span>
          </span>

          <span className="h-3 w-px bg-slate-300 dark:bg-slate-700" />

          {/* Active Mode */}
          <span>
            <span className="text-slate-500 dark:text-slate-500">Mode:</span>{" "}
            <span className="text-[#869ab8]">{activeCategory}</span>
          </span>

          <span className="h-3 w-px bg-slate-300 dark:bg-slate-700" />

          {/* Active Tool */}
          <span>
            <span className="text-slate-500 dark:text-slate-500">Tool:</span>{" "}
            <span className="text-blue-400">{activeTool || "Select"}</span>
          </span>

          {/* Selection Info */}
          {selCount > 0 && (
            <>
              <span className="h-3 w-px bg-slate-300 dark:bg-slate-700" />
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

          <span className="h-3 w-px bg-slate-300 dark:bg-slate-700" />

          {/* Model Statistics — Figma §6.1 N/M/P counters */}
          <span>
            <span className="text-slate-500 dark:text-slate-500">N:</span>
            <span className="text-[#869ab8] font-mono ml-0.5">{nodeCount}</span>
          </span>
          <span>
            <span className="text-slate-500 dark:text-slate-500">M:</span>
            <span className="text-[#869ab8] font-mono ml-0.5">{memberCount}</span>
          </span>
          <span>
            <span className="text-slate-500 dark:text-slate-500">P:</span>
            <span className="text-[#869ab8] font-mono ml-0.5">{plateCount}</span>
          </span>

          <span className="h-3 w-px bg-slate-300 dark:bg-slate-700" />

          {/* Active Load Case — Figma §6.1 */}
          <LoadCasePopover />

          <span className="h-3 w-px bg-slate-300 dark:bg-slate-700" />

          {/* Units — Figma §6.1 */}
          <UnitsPopover />

          <span className="h-3 w-px bg-slate-300 dark:bg-slate-700" />

          {/* Zoom Level — Figma §6.1 zone D */}
          <span>
            <span className="text-slate-500 dark:text-slate-500">Zoom:</span>{" "}
            <span className="text-[#869ab8] font-mono">{zoomLevel}%</span>
          </span>

          <span className="h-3 w-px bg-slate-300 dark:bg-slate-700" />

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
