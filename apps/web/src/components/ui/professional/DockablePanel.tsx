/**
 * DockablePanel.tsx - Professional Dockable Panel System
 * 
 * STAAD.Pro/SkyCiv style dockable panels with:
 * - Drag-to-dock functionality
 * - Resizable panels with min/max constraints
 * - Collapsible/expandable headers
 * - Tab groups for multiple panels in same dock
 * - Floating/pinned modes
 * - Auto-hide behavior
 * - Persistent layout state
 */

import React from 'react';
import {
  FC,
  ReactNode,
  useState,
  useRef,
  useCallback,
  createContext,
  useContext,
  useEffect
} from 'react';
import { motion, AnimatePresence, useDragControls } from 'framer-motion';
import {
  GripVertical,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  ChevronUp,
  X,
  Minimize2,
  Maximize2,
  Pin,
  PinOff,
  MoreVertical,
  Columns,
  Rows,
  Grid3X3,
  Square,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  Settings
} from 'lucide-react';

// ============================================
// TYPES
// ============================================

export type DockPosition = 'left' | 'right' | 'bottom' | 'floating' | 'center';

export interface PanelConfig {
  id: string;
  title: string;
  icon?: React.ElementType;
  defaultDock?: DockPosition;
  minWidth?: number;
  minHeight?: number;
  maxWidth?: number;
  maxHeight?: number;
  defaultWidth?: number;
  defaultHeight?: number;
  closable?: boolean;
  floatable?: boolean;
  collapsible?: boolean;
  resizable?: boolean;
  autoHide?: boolean;
  priority?: number;
}

export interface PanelState {
  id: string;
  dock: DockPosition;
  width: number;
  height: number;
  collapsed: boolean;
  pinned: boolean;
  visible: boolean;
  tabIndex?: number;
  floatingPosition?: { x: number; y: number };
}

export interface DockState {
  left: string[];
  right: string[];
  bottom: string[];
  floating: string[];
  leftWidth: number;
  rightWidth: number;
  bottomHeight: number;
  leftCollapsed: boolean;
  rightCollapsed: boolean;
  bottomCollapsed: boolean;
}

interface DockContextValue {
  panels: Map<string, PanelState>;
  configs: Map<string, PanelConfig>;
  dockState: DockState;
  registerPanel: (config: PanelConfig) => void;
  unregisterPanel: (id: string) => void;
  movePanel: (id: string, dock: DockPosition) => void;
  togglePanel: (id: string) => void;
  collapsePanel: (id: string, collapsed: boolean) => void;
  pinPanel: (id: string, pinned: boolean) => void;
  resizePanel: (id: string, width?: number, height?: number) => void;
  resizeDock: (dock: 'left' | 'right' | 'bottom', size: number) => void;
  collapseDock: (dock: 'left' | 'right' | 'bottom', collapsed: boolean) => void;
  setFloatingPosition: (id: string, x: number, y: number) => void;
  activePanel: string | null;
  setActivePanel: (id: string | null) => void;
}

// ============================================
// CONTEXT
// ============================================

const DockContext = createContext<DockContextValue | null>(null);

export const useDockContext = () => {
  const context = useContext(DockContext);
  if (!context) {
    throw new Error('useDockContext must be used within DockProvider');
  }
  return context;
};

// ============================================
// DOCK PROVIDER
// ============================================

interface DockProviderProps {
  children: ReactNode;
  initialLayout?: Partial<DockState>;
  onLayoutChange?: (state: DockState) => void;
}

export const DockProvider: FC<DockProviderProps> = ({
  children,
  initialLayout,
  onLayoutChange
}) => {
  const [panels, setPanels] = useState<Map<string, PanelState>>(new Map());
  const [configs, setConfigs] = useState<Map<string, PanelConfig>>(new Map());
  const [activePanel, setActivePanel] = useState<string | null>(null);
  const [dockState, setDockState] = useState<DockState>({
    left: [],
    right: [],
    bottom: [],
    floating: [],
    leftWidth: initialLayout?.leftWidth ?? 280,
    rightWidth: initialLayout?.rightWidth ?? 320,
    bottomHeight: initialLayout?.bottomHeight ?? 200,
    leftCollapsed: initialLayout?.leftCollapsed ?? false,
    rightCollapsed: initialLayout?.rightCollapsed ?? false,
    bottomCollapsed: initialLayout?.bottomCollapsed ?? true,
    ...initialLayout
  });

  const registerPanel = useCallback((config: PanelConfig) => {
    setConfigs((prev) => new Map(prev).set(config.id, config));
    setPanels((prev) => {
      if (prev.has(config.id)) return prev;
      const newPanels = new Map(prev);
      newPanels.set(config.id, {
        id: config.id,
        dock: config.defaultDock ?? 'right',
        width: config.defaultWidth ?? 280,
        height: config.defaultHeight ?? 300,
        collapsed: false,
        pinned: true,
        visible: true
      });
      return newPanels;
    });
    setDockState((prev) => {
      const dock = config.defaultDock ?? 'right';
      if (dock === 'floating') {
        return { ...prev, floating: [...prev.floating, config.id] };
      }
      const dockKey = dock as 'left' | 'right' | 'bottom';
      if (!prev[dockKey].includes(config.id)) {
        return { ...prev, [dockKey]: [...prev[dockKey], config.id] };
      }
      return prev;
    });
  }, []);

  const unregisterPanel = useCallback((id: string) => {
    setConfigs((prev) => {
      const newConfigs = new Map(prev);
      newConfigs.delete(id);
      return newConfigs;
    });
    setPanels((prev) => {
      const newPanels = new Map(prev);
      newPanels.delete(id);
      return newPanels;
    });
    setDockState((prev) => ({
      ...prev,
      left: prev.left.filter((p) => p !== id),
      right: prev.right.filter((p) => p !== id),
      bottom: prev.bottom.filter((p) => p !== id),
      floating: prev.floating.filter((p) => p !== id)
    }));
  }, []);

  const movePanel = useCallback((id: string, dock: DockPosition) => {
    setPanels((prev) => {
      const panel = prev.get(id);
      if (!panel) return prev;
      const newPanels = new Map(prev);
      newPanels.set(id, { ...panel, dock });
      return newPanels;
    });
    setDockState((prev) => {
      // Remove from all docks
      const newState = {
        ...prev,
        left: prev.left.filter((p) => p !== id),
        right: prev.right.filter((p) => p !== id),
        bottom: prev.bottom.filter((p) => p !== id),
        floating: prev.floating.filter((p) => p !== id)
      };
      // Add to new dock
      if (dock !== 'center') {
        const dockKey = dock as 'left' | 'right' | 'bottom' | 'floating';
        newState[dockKey] = [...newState[dockKey], id];
      }
      return newState;
    });
  }, []);

  const togglePanel = useCallback((id: string) => {
    setPanels((prev) => {
      const panel = prev.get(id);
      if (!panel) return prev;
      const newPanels = new Map(prev);
      newPanels.set(id, { ...panel, visible: !panel.visible });
      return newPanels;
    });
  }, []);

  const collapsePanel = useCallback((id: string, collapsed: boolean) => {
    setPanels((prev) => {
      const panel = prev.get(id);
      if (!panel) return prev;
      const newPanels = new Map(prev);
      newPanels.set(id, { ...panel, collapsed });
      return newPanels;
    });
  }, []);

  const pinPanel = useCallback((id: string, pinned: boolean) => {
    setPanels((prev) => {
      const panel = prev.get(id);
      if (!panel) return prev;
      const newPanels = new Map(prev);
      newPanels.set(id, { ...panel, pinned });
      return newPanels;
    });
  }, []);

  const resizePanel = useCallback((id: string, width?: number, height?: number) => {
    setPanels((prev) => {
      const panel = prev.get(id);
      if (!panel) return prev;
      const newPanels = new Map(prev);
      newPanels.set(id, {
        ...panel,
        width: width ?? panel.width,
        height: height ?? panel.height
      });
      return newPanels;
    });
  }, []);

  const resizeDock = useCallback((dock: 'left' | 'right' | 'bottom', size: number) => {
    setDockState((prev) => {
      const key = dock === 'bottom' ? 'bottomHeight' : `${dock}Width`;
      return { ...prev, [key]: size };
    });
  }, []);

  const collapseDock = useCallback((dock: 'left' | 'right' | 'bottom', collapsed: boolean) => {
    setDockState((prev) => ({
      ...prev,
      [`${dock}Collapsed`]: collapsed
    }));
  }, []);

  const setFloatingPosition = useCallback((id: string, x: number, y: number) => {
    setPanels((prev) => {
      const panel = prev.get(id);
      if (!panel) return prev;
      const newPanels = new Map(prev);
      newPanels.set(id, { ...panel, floatingPosition: { x, y } });
      return newPanels;
    });
  }, []);

  // Notify parent of layout changes
  useEffect(() => {
    onLayoutChange?.(dockState);
  }, [dockState, onLayoutChange]);

  return (
    <DockContext.Provider
      value={{
        panels,
        configs,
        dockState,
        registerPanel,
        unregisterPanel,
        movePanel,
        togglePanel,
        collapsePanel,
        pinPanel,
        resizePanel,
        resizeDock,
        collapseDock,
        setFloatingPosition,
        activePanel,
        setActivePanel
      }}
    >
      {children}
    </DockContext.Provider>
  );
};

// ============================================
// RESIZE HANDLE
// ============================================

interface ResizeHandleProps {
  direction: 'horizontal' | 'vertical';
  onResize: (delta: number) => void;
  onResizeEnd?: () => void;
}

const ResizeHandle: FC<ResizeHandleProps> = ({ direction, onResize, onResizeEnd }) => {
  const isHorizontal = direction === 'horizontal';
  const handleRef = useRef<HTMLDivElement>(null);
  const startPosRef = useRef(0);
  const isDraggingRef = useRef(false);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    isDraggingRef.current = true;
    startPosRef.current = isHorizontal ? e.clientX : e.clientY;
    document.body.style.cursor = isHorizontal ? 'col-resize' : 'row-resize';
    document.body.style.userSelect = 'none';

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!isDraggingRef.current) return;
      const currentPos = isHorizontal ? moveEvent.clientX : moveEvent.clientY;
      const delta = currentPos - startPosRef.current;
      startPosRef.current = currentPos;
      onResize(delta);
    };

    const handleMouseUp = () => {
      isDraggingRef.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      onResizeEnd?.();
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  return (
    <div
      ref={handleRef}
      onMouseDown={handleMouseDown}
      className={`
        group flex items-center justify-center
        ${isHorizontal
          ? 'w-1 cursor-col-resize hover:w-1.5'
          : 'h-1 cursor-row-resize hover:h-1.5'
        }
        bg-slate-200/30 dark:bg-slate-700/30 hover:bg-blue-500/50
        transition-all duration-150
      `}
    >
      <div
        className={`
          ${isHorizontal ? 'w-0.5 h-8' : 'w-8 h-0.5'}
          rounded-full bg-slate-600 group-hover:bg-blue-400
          transition-colors
        `}
      />
    </div>
  );
};

// ============================================
// PANEL HEADER
// ============================================

interface PanelHeaderProps {
  config: PanelConfig;
  state: PanelState;
  isActive: boolean;
  onClose?: () => void;
  onCollapse?: () => void;
  onPin?: () => void;
  onFloat?: () => void;
  onDragStart?: (e: React.PointerEvent | React.MouseEvent) => void;
}

const PanelHeader: FC<PanelHeaderProps> = ({
  config,
  state,
  isActive,
  onClose,
  onCollapse,
  onPin,
  onFloat,
  onDragStart
}) => {
  const Icon = config.icon;
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div
      className={`
        flex items-center h-8 px-2 gap-2
        ${isActive 
          ? 'bg-slate-700/80 border-b border-blue-500/50' 
          : 'bg-slate-100/80 dark:bg-slate-800/80 border-b border-slate-200/50 dark:border-slate-700/50'}
        cursor-grab active:cursor-grabbing
        select-none transition-colors
      `}
      onMouseDown={onDragStart}
    >
      {/* Drag Handle */}
      <GripVertical className="w-3 h-3 text-slate-500 dark:text-slate-400" />

      {/* Icon & Title */}
      {Icon && <Icon className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />}
      <span className="flex-1 text-xs font-medium text-slate-700 dark:text-slate-200 truncate">
        {config.title}
      </span>

      {/* Actions */}
      <div className="flex items-center gap-0.5">
        {config.collapsible && (
          <button
            onClick={onCollapse}
            className="p-1 rounded hover:bg-slate-600/50 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
            title={state.collapsed ? 'Expand' : 'Collapse'}
          >
            {state.collapsed ? (
              <ChevronDown className="w-3 h-3" />
            ) : (
              <ChevronUp className="w-3 h-3" />
            )}
          </button>
        )}

        {/* Pin Button */}
        <button
          onClick={onPin}
          className={`
            p-1 rounded hover:bg-slate-600/50 transition-colors
            ${state.pinned ? 'text-blue-400' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}
          `}
          title={state.pinned ? 'Unpin (Auto-hide)' : 'Pin'}
        >
          {state.pinned ? (
            <Pin className="w-3 h-3" />
          ) : (
            <PinOff className="w-3 h-3" />
          )}
        </button>

        {/* More Menu */}
        <div className="relative">
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="p-1 rounded hover:bg-slate-600/50 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
          >
            <MoreVertical className="w-3 h-3" />
          </button>

          <AnimatePresence>
            {menuOpen && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="absolute right-0 top-full mt-1 w-40 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl z-50 py-1"
              >
                {config.floatable && (
                  <button
                    onClick={() => { onFloat?.(); setMenuOpen(false); }}
                    className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
                  >
                    <Square className="w-3 h-3" />
                    Float Window
                  </button>
                )}
                <button
                  onClick={() => setMenuOpen(false)}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
                >
                  <Columns className="w-3 h-3" />
                  Dock Left
                </button>
                <button
                  onClick={() => setMenuOpen(false)}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
                >
                  <Columns className="w-3 h-3" />
                  Dock Right
                </button>
                <button
                  onClick={() => setMenuOpen(false)}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
                >
                  <Rows className="w-3 h-3" />
                  Dock Bottom
                </button>
                {config.closable && (
                  <>
                    <div className="h-px bg-slate-200 dark:bg-slate-700 my-1" />
                    <button
                      onClick={() => { onClose?.(); setMenuOpen(false); }}
                      className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-red-400 hover:bg-slate-200 dark:hover:bg-slate-700"
                    >
                      <X className="w-3 h-3" />
                      Close
                    </button>
                  </>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Close Button */}
        {config.closable && (
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-red-600/30 text-slate-500 dark:text-slate-400 hover:text-red-400 transition-colors"
            title="Close"
          >
            <X className="w-3 h-3" />
          </button>
        )}
      </div>
    </div>
  );
};

// ============================================
// DOCKABLE PANEL COMPONENT
// ============================================

interface DockablePanelProps {
  id: string;
  title: string;
  icon?: React.ElementType;
  defaultDock?: DockPosition;
  children: ReactNode;
  minWidth?: number;
  minHeight?: number;
  closable?: boolean;
  floatable?: boolean;
  collapsible?: boolean;
  resizable?: boolean;
}

export const DockablePanel: FC<DockablePanelProps> = ({
  id,
  title,
  icon,
  defaultDock = 'right',
  children,
  minWidth = 200,
  minHeight = 100,
  closable = true,
  floatable = true,
  collapsible = true,
  resizable = true
}) => {
  const {
    panels,
    configs,
    registerPanel,
    unregisterPanel,
    togglePanel,
    collapsePanel,
    pinPanel,
    movePanel,
    activePanel,
    setActivePanel
  } = useDockContext();

  // Register panel on mount
  useEffect(() => {
    registerPanel({
      id,
      title,
      icon,
      defaultDock,
      minWidth,
      minHeight,
      closable,
      floatable,
      collapsible,
      resizable
    });
    return () => unregisterPanel(id);
  }, [id]);

  const config = configs.get(id);
  const state = panels.get(id);

  if (!config || !state || !state.visible) {
    return null;
  }

  const isActive = activePanel === id;

  return (
    <div
      className="flex flex-col h-full bg-white dark:bg-slate-900 overflow-hidden"
      onClick={() => setActivePanel(id)}
    >
      <PanelHeader
        config={config}
        state={state}
        isActive={isActive}
        onClose={() => togglePanel(id)}
        onCollapse={() => collapsePanel(id, !state.collapsed)}
        onPin={() => pinPanel(id, !state.pinned)}
        onFloat={() => movePanel(id, 'floating')}
      />

      <AnimatePresence>
        {!state.collapsed && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: 'auto' }}
            exit={{ height: 0 }}
            className="flex-1 overflow-auto"
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ============================================
// DOCK CONTAINER
// ============================================

interface DockContainerProps {
  position: 'left' | 'right' | 'bottom';
  children: ReactNode;
}

export const DockContainer: FC<DockContainerProps> = ({ position, children }) => {
  const { dockState, resizeDock, collapseDock } = useDockContext();

  const isHorizontal = position === 'bottom';
  const sizeKey = position === 'bottom' ? 'bottomHeight' : `${position}Width`;
  const collapsedKey = `${position}Collapsed` as keyof DockState;
  const size = dockState[sizeKey as keyof DockState] as number;
  const collapsed = dockState[collapsedKey] as boolean;

  const handleResize = (delta: number) => {
    const multiplier = position === 'left' || position === 'bottom' ? 1 : -1;
    const newSize = Math.max(200, Math.min(600, size + delta * multiplier));
    resizeDock(position, newSize);
  };

  const CollapseIcon = {
    left: collapsed ? PanelLeftOpen : PanelLeftClose,
    right: collapsed ? PanelRightOpen : PanelRightClose,
    bottom: collapsed ? ChevronUp : ChevronDown
  }[position];

  return (
    <div
      className={`
        flex bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800
        ${isHorizontal 
          ? `flex-col w-full border-t ${collapsed ? 'h-8' : ''}` 
          : `flex-row h-full ${position === 'left' ? 'border-r' : 'border-l'} ${collapsed ? 'w-8' : ''}`}
      `}
      style={collapsed ? {} : isHorizontal ? { height: size } : { width: size }}
    >
      {/* Collapse Bar */}
      <div
        className={`
          flex items-center justify-center
          ${isHorizontal ? 'h-8 w-full border-b border-slate-200 dark:border-slate-800' : 'w-8 h-full border-r border-slate-200 dark:border-slate-800'}
          bg-slate-850 cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-800
        `}
        onClick={() => collapseDock(position, !collapsed)}
      >
        <CollapseIcon className="w-4 h-4 text-slate-500 dark:text-slate-400" />
      </div>

      {/* Content */}
      {!collapsed && (
        <>
          {/* Resize Handle */}
          {position === 'left' && (
            <div className="flex-1 flex flex-col overflow-hidden">
              {children}
            </div>
          )}

          <ResizeHandle
            direction={isHorizontal ? 'vertical' : 'horizontal'}
            onResize={handleResize}
          />

          {position !== 'left' && (
            <div className="flex-1 flex flex-col overflow-hidden">
              {children}
            </div>
          )}
        </>
      )}
    </div>
  );
};

// ============================================
// PANEL TAB BAR
// ============================================

interface PanelTabBarProps {
  panels: string[];
  activePanel: string | null;
  onSelect: (id: string) => void;
  configs: Map<string, PanelConfig>;
}

export const PanelTabBar: FC<PanelTabBarProps> = ({
  panels,
  activePanel,
  onSelect,
  configs
}) => {
  return (
    <div className="flex items-center h-8 bg-slate-100 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 overflow-x-auto">
      {panels.map((id) => {
        const config = configs.get(id);
        if (!config) return null;
        const Icon = config.icon;
        const isActive = activePanel === id;

        return (
          <button
            key={id}
            onClick={() => onSelect(id)}
            className={`
              flex items-center gap-1.5 px-3 h-full
              border-r border-slate-200 dark:border-slate-700
              transition-colors text-xs
              ${isActive
                ? 'bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-white border-b-2 border-blue-500'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/50 dark:hover:bg-slate-700/50'}
            `}
          >
            {Icon && <Icon className="w-3.5 h-3.5" />}
            {config.title}
          </button>
        );
      })}
    </div>
  );
};

// ============================================
// FLOATING PANEL
// ============================================

interface FloatingPanelProps {
  id: string;
  children: ReactNode;
}

export const FloatingPanel: FC<FloatingPanelProps> = ({ id, children }) => {
  const {
    panels,
    configs,
    togglePanel,
    collapsePanel,
    pinPanel,
    movePanel,
    setFloatingPosition,
    activePanel,
    setActivePanel
  } = useDockContext();
  
  const dragControls = useDragControls();
  const state = panels.get(id);
  const config = configs.get(id);

  if (!state || !config || state.dock !== 'floating' || !state.visible) {
    return null;
  }

  const isActive = activePanel === id;

  return (
    <motion.div
      drag
      dragControls={dragControls}
      dragMomentum={false}
      dragElastic={0}
      initial={state.floatingPosition || { x: 100, y: 100 }}
      onDragEnd={(_, info) => {
        setFloatingPosition(id, info.point.x, info.point.y);
      }}
      onClick={() => setActivePanel(id)}
      className={`
        fixed z-50 bg-white dark:bg-slate-900 border rounded-lg shadow-2xl overflow-hidden
        ${isActive ? 'border-blue-500/50' : 'border-slate-200 dark:border-slate-700'}
      `}
      style={{ width: state.width, minHeight: 100 }}
    >
      <PanelHeader
        config={config}
        state={state}
        isActive={isActive}
        onClose={() => togglePanel(id)}
        onCollapse={() => collapsePanel(id, !state.collapsed)}
        onPin={() => pinPanel(id, !state.pinned)}
        onFloat={() => movePanel(id, 'right')}
        onDragStart={(e: any) => dragControls.start(e)}
      />

      <AnimatePresence>
        {!state.collapsed && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: state.height - 32 }}
            exit={{ height: 0 }}
            className="overflow-auto"
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default DockablePanel;
