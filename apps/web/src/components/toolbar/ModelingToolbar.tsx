/**
 * ModelingToolbar.tsx - STAAD.Pro-class Modeling Toolbar
 *
 * Organized toolbar with dropdown groups for all modeling tools:
 * - Selection, Draw, Edit, Array, Transform, Generate, Measure
 * - Snap controls (grid, node, midpoint, intersection)
 * - View controls (standard views, render modes, display toggles)
 * - Coordinate display & input
 * - Utilities (renumber, geometry check, member query)
 *
 * Features:
 * - Dropdown menus for each tool group
 * - Visual icons with tooltips
 * - Keyboard shortcut display
 * - Active tool highlighting
 * - Snap mode indicator
 * - Coordinate system toggle (Global/Local)
 * - Rendering mode selector
 * - Status bar with model info
 */

import { FC, useState, useEffect, useCallback, useMemo } from "react";
import { ChevronDown, Magnet, Crosshair, Grid3x3, Minus } from "lucide-react";
import { useUIStore, CATEGORY_TOOLS } from "../../store/uiStore";
import { useModelStore } from "../../store/model";
import { useShallow } from "zustand/react/shallow";
import {
  MODELING_TOOL_GROUPS,
  TOOL_DEFINITIONS,
  KEYBOARD_SHORTCUTS,
  ToolGroup,
  ToolDefinition,
} from "../../data/ToolGroups";

// ============================================
// TYPES
// ============================================

interface ToolButtonProps {
  tool: ToolDefinition;
  isActive: boolean;
  onClick: () => void;
  showLabel?: boolean;
}

// ============================================
// TOOL BUTTON COMPONENT
// ============================================

const ToolButton: FC<ToolButtonProps> = ({
  tool,
  isActive,
  onClick,
  showLabel = true,
}) => {
  const Icon = tool.icon;

  return (
    <button type="button"
      onClick={onClick}
      className={`
        flex items-center gap-2 px-3 py-2 rounded-md text-sm
        transition-all duration-150
        ${
          isActive
            ? "bg-blue-600 text-white"
            : "text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-white"
        }
      `}
      title={`${tool.tooltip}${tool.shortcut ? ` (${tool.shortcut})` : ""}`}
      aria-label={tool.label}
      aria-pressed={isActive}
    >
      <Icon className="w-4 h-4" aria-hidden="true" />
      {showLabel && <span>{tool.label}</span>}
      {tool.shortcut && (
        <span className="text-[10px] text-slate-500 dark:text-slate-400 ml-auto" aria-hidden="true">
          {tool.shortcut}
        </span>
      )}
    </button>
  );
};

// ============================================
// TOOL GROUP DROPDOWN
// ============================================

interface ToolGroupDropdownProps {
  group: ToolGroup;
  activeTool: string | null;
  onToolSelect: (toolId: string) => void;
}

const ToolGroupDropdown: FC<ToolGroupDropdownProps> = ({
  group,
  activeTool,
  onToolSelect,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const Icon = group.icon;

  // Check if any tool in this group is active
  const hasActiveTool = group.tools.some((id) => id === activeTool);

  // Get the active tool in this group for display
  const activeToolInGroup = group.tools.find((id) => id === activeTool);
  const displayTool = activeToolInGroup
    ? TOOL_DEFINITIONS[activeToolInGroup]
    : TOOL_DEFINITIONS[group.tools[0]];
  const DisplayIcon = displayTool?.icon || Icon;

  return (
    <div className="relative">
      <button type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`
          flex items-center gap-1.5 px-2.5 py-1.5 rounded-md
          border border-slate-200 dark:border-slate-700 text-sm
          transition-all duration-150
          ${
            hasActiveTool
              ? "bg-blue-600/20 border-blue-500 text-blue-400"
              : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
          }
        `}
        aria-haspopup="true"
        aria-expanded={isOpen}
        aria-label={`${group.label} tools`}
      >
        <DisplayIcon className="w-4 h-4" aria-hidden="true" />
        <span className="hidden sm:inline">{group.label}</span>
        <ChevronDown
          className={`w-3 h-3 transition-transform ${isOpen ? "rotate-180" : ""}`}
          aria-hidden="true"
        />
      </button>

      {isOpen && (
        <>
          {/* Scoped backdrop — closes dropdown without covering full screen */}
          <div
            className="fixed inset-0 z-40 bg-transparent"
            onClick={(e) => { e.stopPropagation(); setIsOpen(false); }}
            onContextMenu={(e) => { e.preventDefault(); setIsOpen(false); }}
          />

          {/* Dropdown Menu */}
          <div
            className="absolute top-full left-0 mt-1 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 
                          rounded-lg shadow-xl z-50 min-w-[200px] py-1"
          >
            {group.tools.map((toolId) => {
              const tool = TOOL_DEFINITIONS[toolId];
              if (!tool) return null;

              return (
                <ToolButton
                  key={toolId}
                  tool={tool}
                  isActive={activeTool === toolId}
                  onClick={() => {
                    onToolSelect(toolId);
                    setIsOpen(false);
                  }}
                />
              );
            })}
          </div>
        </>
      )}
    </div>
  );
};

// ============================================
// QUICK ACCESS TOOLS
// ============================================

const QUICK_TOOLS = [
  "SELECT",
  "DRAW_NODE",
  "DRAW_BEAM",
  "DRAW_COLUMN",
  "DRAW_PLATE",
  "DELETE",
];

// ============================================
// SNAP MODE COMPONENT
// ============================================

type SnapMode = 'grid' | 'node' | 'midpoint' | 'intersection' | 'perpendicular' | 'nearest';

const SNAP_MODES: { id: SnapMode; label: string; icon: typeof Magnet }[] = [
  { id: 'grid', label: 'Grid', icon: Grid3x3 },
  { id: 'node', label: 'Node', icon: Crosshair },
  { id: 'midpoint', label: 'Mid', icon: Minus },
  { id: 'intersection', label: 'Int', icon: Crosshair },
];

const SnapBar: FC<{
  activeSnaps: Set<SnapMode>;
  onToggle: (mode: SnapMode) => void;
  gridSize: number;
  onGridSizeChange: (size: number) => void;
}> = ({ activeSnaps, onToggle, gridSize, onGridSizeChange }) => (
  <div className="flex items-center gap-1 px-2 py-1 bg-slate-100/50 dark:bg-slate-800/50 rounded-md">
    <Magnet className={`w-3.5 h-3.5 ${activeSnaps.size > 0 ? 'text-amber-500' : 'text-slate-400'}`} />
    {SNAP_MODES.map((snap) => (
      <button
        type="button"
        key={snap.id}
        onClick={() => onToggle(snap.id)}
        className={`px-1.5 py-0.5 rounded text-[10px] font-medium transition-all ${
          activeSnaps.has(snap.id)
            ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
            : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 border border-transparent'
        }`}
        title={`Snap to ${snap.label}`}
      >
        {snap.label}
      </button>
    ))}
    <div className="w-px h-4 bg-slate-300 dark:bg-slate-700 mx-1" />
    <span className="text-[10px] text-slate-500">Grid:</span>
    <input
      type="number"
      value={gridSize}
      onChange={(e) => onGridSizeChange(parseFloat(e.target.value) || 1)}
      className="w-12 px-1 py-0.5 bg-slate-200 dark:bg-slate-700 rounded text-[10px] text-slate-700 dark:text-slate-300 border-none outline-none text-center"
      step="0.5"
      min="0.1"
      max="100"
    />
    <span className="text-[10px] text-slate-500">m</span>
  </div>
);

// ============================================
// COORDINATE DISPLAY
// ============================================

const CoordinateDisplay: FC<{
  coordSystem: 'global' | 'local';
  onToggleCoordSystem: () => void;
  cursorPos: { x: number; y: number; z: number };
}> = ({ coordSystem, onToggleCoordSystem, cursorPos }) => (
  <div className="flex items-center gap-2 px-2 py-1 bg-slate-100/50 dark:bg-slate-800/50 rounded-md">
    <button
      type="button"
      onClick={onToggleCoordSystem}
      className={`px-1.5 py-0.5 rounded text-[10px] font-bold transition-all ${
        coordSystem === 'global'
          ? 'bg-blue-500/20 text-blue-400'
          : 'bg-purple-500/20 text-purple-400'
      }`}
      title={`${coordSystem === 'global' ? 'Global' : 'Local'} coordinate system`}
    >
      {coordSystem === 'global' ? 'GCS' : 'LCS'}
    </button>
    <div className="flex items-center gap-2 text-[10px] font-mono text-slate-500 dark:text-slate-400">
      <span>X: <span className="text-red-400 font-medium">{cursorPos.x.toFixed(3)}</span></span>
      <span>Y: <span className="text-emerald-400 font-medium">{cursorPos.y.toFixed(3)}</span></span>
      <span>Z: <span className="text-blue-400 font-medium">{cursorPos.z.toFixed(3)}</span></span>
    </div>
  </div>
);

// ============================================
// STATUS BAR (model statistics)
// ============================================

const ModelStatusBar: FC = () => {
  const nodes = useModelStore((s) => s.nodes);
  const members = useModelStore((s) => s.members);
  const selectedIds = useModelStore((s) => s.selectedIds);

  const nodeCount = nodes instanceof Map ? nodes.size : Object.keys(nodes || {}).length;
  const memberCount = members instanceof Map ? members.size : Object.keys(members || {}).length;
  const selCount = selectedIds?.size ?? 0;

  return (
    <div className="flex items-center gap-3 px-2 py-1 text-[10px] text-slate-500 dark:text-slate-400 font-mono">
      <span>N: <span className="text-slate-700 dark:text-slate-300 font-medium">{nodeCount}</span></span>
      <span>M: <span className="text-slate-700 dark:text-slate-300 font-medium">{memberCount}</span></span>
      {selCount > 0 && (
        <>
          <div className="w-px h-3 bg-slate-300 dark:bg-slate-600" />
          <span className="text-blue-400">Sel: {selCount}</span>
        </>
      )}
    </div>
  );
};

// ============================================
// MAIN TOOLBAR COMPONENT
// ============================================

export const ModelingToolbar: FC = () => {
  const activeTool = useUIStore((state) => state.activeTool);
  const activeCategory = useUIStore((state) => state.activeCategory);
  const setActiveTool = useUIStore((state) => state.setActiveTool);
  const setGeometryToolPreset = useUIStore((state) => state.setGeometryToolPreset);
  const openModal = useUIStore((state) => state.openModal);
  const setRenderMode3D = useUIStore((state) => state.setRenderMode3D);
  const setModelTool = useModelStore((state) => state.setTool);

  // Snap state
  const [activeSnaps, setActiveSnaps] = useState<Set<SnapMode>>(new Set(['grid', 'node']));
  const [gridSize, setGridSize] = useState(1.0);

  // Coordinate state
  const [coordSystem, setCoordSystem] = useState<'global' | 'local'>('global');
  const [cursorPos] = useState({ x: 0, y: 0, z: 0 });

  // Toggle snap mode
  const toggleSnap = useCallback((mode: SnapMode) => {
    setActiveSnaps((prev) => {
      const next = new Set(prev);
      if (next.has(mode)) next.delete(mode);
      else next.add(mode);
      return next;
    });
  }, []);

  // Helper function to set tool in both stores
  const handleToolSelect = useCallback(
    (toolId: string) => {
      setActiveTool(toolId);

      const dispatch = (name: string, detail?: Record<string, unknown>) => {
        document.dispatchEvent(new CustomEvent(name, detail ? { detail } : undefined));
      };

      switch (toolId) {
        case "SELECT":
        case "SELECT_RANGE":
        case "PAN":
        case "ZOOM_WINDOW":
          setModelTool("select" as any);
          return;
        case "DRAW_NODE":
          setModelTool("node" as any);
          return;
        case "DRAW_BEAM":
        case "DRAW_COLUMN":
        case "DRAW_CABLE":
        case "DRAW_ARCH":
        case "DRAW_RIGID_LINK":
          setModelTool("member" as any);
          return;
        case "DRAW_PLATE":
          openModal("plateDialog");
          return;
        case "DELETE":
          dispatch("trigger-delete");
          return;
        case "COPY":
          dispatch("trigger-copy");
          return;
        case "MOVE":
          dispatch("trigger-move");
          return;
        case "MIRROR":
          setGeometryToolPreset("mirror");
          openModal("geometryTools");
          return;
        case "ROTATE":
          setGeometryToolPreset("rotate");
          openModal("geometryTools");
          return;
        case "EXTRUDE":
        case "ARRAY_LINEAR":
          setGeometryToolPreset("extrude");
          openModal("geometryTools");
          return;
        case "ARRAY_POLAR":
          setGeometryToolPreset("rotate");
          openModal("geometryTools");
          return;
        case "ARRAY_3D":
          setGeometryToolPreset("extrude");
          openModal("geometryTools");
          return;
        case "DIVIDE_MEMBER":
          openModal("divideMember");
          return;
        case "MERGE_NODES":
          openModal("mergeNodes");
          return;
        case "SPLIT_MEMBER":
          dispatch("trigger-split");
          return;
        case "SNAP_GRID":
          dispatch("toggle-grid-snap");
          return;
        case "VIEW_FIT":
          dispatch("fit-view");
          return;
        case "VIEW_FRONT":
          dispatch("change-view", { view: "front" });
          return;
        case "VIEW_TOP":
          dispatch("change-view", { view: "top" });
          return;
        case "VIEW_RIGHT":
          dispatch("change-view", { view: "right" });
          return;
        case "VIEW_ISO":
          dispatch("change-view", { view: "iso" });
          return;
        case "RENDER_SOLID":
          setRenderMode3D(true);
          return;
        case "RENDER_WIREFRAME":
        case "RENDER_ANALYTICAL":
          setRenderMode3D(false);
          return;
        case "RUN_ANALYSIS":
          dispatch("trigger-analysis");
          return;
        default:
          break;
      }

      // Fallback mapping for tools that map directly to the model store.
      const toolMap: Record<string, string> = {
        SUPPORT: "support",
        LOAD: "load",
        MEMBER_LOAD: "memberLoad",
      };

      const mapped = toolMap[toolId];
      if (mapped) {
        setModelTool(mapped as any);
      }
    },
    [openModal, setActiveTool, setGeometryToolPreset, setModelTool, setRenderMode3D],
  );

  // Handle keyboard shortcuts
  useEffect(() => {
    if (activeCategory !== "MODELING") return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Skip if typing in input
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      const key = e.key.toLowerCase();
      const toolId = KEYBOARD_SHORTCUTS[key] || KEYBOARD_SHORTCUTS[e.key];

      if (toolId && CATEGORY_TOOLS.MODELING.includes(toolId)) {
        e.preventDefault();
        handleToolSelect(toolId);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleToolSelect, activeCategory]);

  // Only show modeling tools when in MODELING category
  if (activeCategory !== "MODELING") {
    return null;
  }

  return (
    <div className="flex flex-col gap-1">
      {/* Primary Toolbar: Quick Tools + Tool Groups */}
      <div className="flex items-center gap-1 p-1.5 bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm rounded-lg border border-slate-200 dark:border-slate-800 shadow-lg">
        {/* Quick Access Tools */}
        {QUICK_TOOLS.map((toolId) => {
          const tool = TOOL_DEFINITIONS[toolId];
          if (!tool) return null;

          const Icon = tool.icon;
          return (
            <button type="button"
              key={toolId}
              onClick={() => handleToolSelect(toolId)}
              className={`
                p-2 rounded-md transition-all
                ${
                  activeTool === toolId
                    ? "bg-blue-600 text-white"
                    : "text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white"
                }
              `}
              title={`${tool.tooltip}${tool.shortcut ? ` (${tool.shortcut})` : ""}`}
              aria-label={`${tool.tooltip}${tool.shortcut ? ` (${tool.shortcut})` : ""}`}
            >
              <Icon className="w-4 h-4" aria-hidden="true" />
            </button>
          );
        })}

        <div className="w-px h-6 bg-slate-200 dark:bg-slate-700 mx-1" />

        {/* Tool Groups */}
        {MODELING_TOOL_GROUPS.map((group) => (
          <ToolGroupDropdown
            key={group.id}
            group={group}
            activeTool={activeTool}
            onToolSelect={handleToolSelect}
          />
        ))}
      </div>

      {/* Secondary Toolbar: Snap + Coordinates + Status */}
      <div className="flex items-center justify-between gap-2 px-1.5 py-1 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm rounded-lg border border-slate-200 dark:border-slate-800 shadow-sm">
        <SnapBar
          activeSnaps={activeSnaps}
          onToggle={toggleSnap}
          gridSize={gridSize}
          onGridSizeChange={setGridSize}
        />
        <div className="flex items-center gap-2">
          <CoordinateDisplay
            coordSystem={coordSystem}
            onToggleCoordSystem={() => setCoordSystem((p) => p === 'global' ? 'local' : 'global')}
            cursorPos={cursorPos}
          />
          <div className="w-px h-5 bg-slate-300 dark:bg-slate-700" />
          <ModelStatusBar />
        </div>
      </div>
    </div>
  );
};

export default ModelingToolbar;
