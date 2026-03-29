/**
 * ModernWorkspace.tsx - Main Layout with Resizable Panels
 * 
 * Features:
 * - Umbrella Switcher (5 category tabs)
 * - Context-sensitive left sidebar
 * - Resizable panels using react-resizable-panels
 * - Collapsible inspector panel
 * - Dark theme with Tailwind CSS
 */

import React from 'react';
import { FC, ReactNode, lazy, Suspense, memo, useEffect, useMemo } from 'react';
import {
    Panel,
    Group as PanelGroup,
    Separator as PanelResizeHandle
} from 'react-resizable-panels';
import {
    Box,
    Layers,
    Download,
    BarChart3,
    Ruler,
    PenTool,
    Wind,
    Zap,
    Target,
    Settings,
    FileText,
    Calculator,
    ChevronLeft,
    ChevronRight,
    Grid3X3,
    FileInput,
    ScanLine,
    MousePointer2,
    HardHat,
    Waves,
    TreePine,
    Mountain,
    Car,
    Maximize2,
    Minimize2
} from 'lucide-react';
import { useUIStore, Category } from '../store/uiStore';
import { useShallow } from 'zustand/react/shallow';
import { useSetAtom } from 'jotai';
import { showAIArchitectAtom } from '../store/uiAtoms';
import { Logo } from '../components/branding';
import { LoadInspectorPanel } from '../components/panels/LoadInspectorPanel';
import { PropertiesInspectorPanel } from '../components/panels/PropertiesInspectorPanel';
import { BoundaryConditionsInspectorPanel } from '../components/panels/BoundaryConditionsInspectorPanel';
import { ResultsInspectorPanel } from '../components/panels/ResultsInspectorPanel';
import { PropertiesPanel } from '../components/PropertiesPanel';

// Lazy load heavy components
const CivilPanel = lazy(() => import('../components/civil/CivilPanel'));
const LearningAssistant = lazy(() => import('../components/learning/LearningAssistant'));

// Types
interface TabConfig {
    id: Category;
    label: string;
    icon: React.ReactNode;
    color: string;
}

// Static color maps for Tailwind JIT (dynamic class names like `bg-${color}-600/20` don't work)
const TAB_ACTIVE_STYLES: Record<string, string> = {
    blue: 'bg-blue-600/20 text-blue-400 border border-blue-500/30',
    purple: 'bg-purple-600/20 text-purple-400 border border-purple-500/30',
    orange: 'bg-orange-600/20 text-orange-400 border border-orange-500/30',
    green: 'bg-green-600/20 text-green-400 border border-green-500/30',
    red: 'bg-red-600/20 text-red-400 border border-red-500/30',
    yellow: 'bg-yellow-600/20 text-yellow-400 border border-yellow-500/30',
};

// Canvas focus presets (inspired by STAAD / SkyCiv):
// - default: generous center pane
// - expanded: collapse both sidebars for maximum canvas
const CANVAS_DEFAULT = { left: 16, right: 18, centerMin: 55 };
const CANVAS_EXPANDED = { left: 0, right: 0, centerMin: 90 };

interface SidebarItem {
    id: string;
    label: string;
    icon: React.ReactNode;
    action?: () => void;
}

interface ModernWorkspaceProps {
    children: ReactNode;
}

import {
    Anchor,
    Lock as LockIcon,
} from 'lucide-react';

const UMBRELLA_TABS: TabConfig[] = [
    { id: 'MODELING', label: 'Modeling', icon: <Box className="w-4 h-4" />, color: 'blue' },
    { id: 'PROPERTIES', label: 'Properties', icon: <Layers className="w-4 h-4" />, color: 'purple' },
    { id: 'SUPPORTS', label: 'Supports', icon: <Anchor className="w-4 h-4" />, color: 'blue' },
    { id: 'LOADING', label: 'Loading', icon: <Download className="w-4 h-4" />, color: 'orange' },
    { id: 'ANALYSIS', label: 'Analysis', icon: <BarChart3 className="w-4 h-4" />, color: 'green' },
    { id: 'DESIGN', label: 'Design', icon: <Ruler className="w-4 h-4" />, color: 'red' },
    { id: 'CIVIL', label: 'Civil', icon: <HardHat className="w-4 h-4" />, color: 'yellow' }
];

// Sidebar content per category
const SIDEBAR_CONTENT: Record<Category, SidebarItem[]> = {
    MODELING: [
        { id: 'select', label: 'Select', icon: <MousePointer2 className="w-4 h-4" /> },
        { id: 'select_range', label: 'Range Select', icon: <ScanLine className="w-4 h-4" /> },
        { id: 'templates', label: 'Template Bank', icon: <Grid3X3 className="w-4 h-4" /> },
        { id: 'member', label: 'Draw Member', icon: <PenTool className="w-4 h-4" /> },
        { id: 'grid_tool', label: 'Grid Generator', icon: <Grid3X3 className="w-4 h-4" /> },
        { id: 'dxf_import', label: 'DXF Import', icon: <FileInput className="w-4 h-4" /> }
    ],
    PROPERTIES: [
        { id: 'sections', label: 'Section Library', icon: <Layers className="w-4 h-4" /> },
        { id: 'materials', label: 'Material Library', icon: <Box className="w-4 h-4" /> },
        { id: 'releases', label: 'Member Releases', icon: <Settings className="w-4 h-4" /> },
        { id: 'offsets', label: 'Member Offsets', icon: <Ruler className="w-4 h-4" /> }
    ],
    SUPPORTS: [
        { id: 'fixed', label: 'Fixed Support', icon: <LockIcon className="w-4 h-4" /> },
        { id: 'pinned', label: 'Pinned Support', icon: <Anchor className="w-4 h-4" /> },
        { id: 'roller', label: 'Roller Support', icon: <Target className="w-4 h-4" /> },
        { id: 'custom', label: 'Custom DOF', icon: <Settings className="w-4 h-4" /> },
        { id: 'spring', label: 'Spring Support', icon: <Zap className="w-4 h-4" /> },
        { id: 'boundary', label: 'Boundary Conditions', icon: <Anchor className="w-4 h-4" /> }
    ],
    LOADING: [
        { id: 'wind_load', label: 'Wind Load Generator', icon: <Wind className="w-4 h-4" /> },
        { id: 'seismic', label: 'Seismic Load', icon: <Zap className="w-4 h-4" /> },
        { id: 'point_load', label: 'Add Point Load', icon: <Target className="w-4 h-4" /> },
        { id: 'udl', label: 'Add UDL', icon: <Download className="w-4 h-4" /> },
        { id: 'load_combo', label: 'Load Combinations', icon: <Layers className="w-4 h-4" /> }
    ],
    ANALYSIS: [
        { id: 'run', label: 'Run Analysis', icon: <BarChart3 className="w-4 h-4" /> },
        { id: 'results', label: 'View Results', icon: <FileText className="w-4 h-4" /> },
        { id: 'deformed', label: 'Deformed Shape', icon: <Box className="w-4 h-4" /> },
        { id: 'reactions', label: 'Support Reactions', icon: <Target className="w-4 h-4" /> },
        { id: 'diagrams', label: 'Member Diagrams', icon: <BarChart3 className="w-4 h-4" /> }
    ],
    DESIGN: [
        { id: 'steel', label: 'Steel Code Check', icon: <Ruler className="w-4 h-4" /> },
        { id: 'concrete', label: 'Concrete Rebar Calc', icon: <Calculator className="w-4 h-4" /> },
        { id: 'connection', label: 'Connection Design', icon: <Settings className="w-4 h-4" /> },
        { id: 'foundation', label: 'Foundation Design', icon: <Box className="w-4 h-4" /> },
        { id: 'report', label: 'Generate Report', icon: <FileText className="w-4 h-4" /> }
    ],
    CIVIL: [
        { id: 'geotech', label: 'Geotechnical', icon: <Mountain className="w-4 h-4" /> },
        { id: 'transport', label: 'Transportation', icon: <Car className="w-4 h-4" /> },
        { id: 'hydraulics', label: 'Hydraulics', icon: <Waves className="w-4 h-4" /> },
        { id: 'enviro', label: 'Environmental', icon: <TreePine className="w-4 h-4" /> },
        { id: 'const', label: 'Construction', icon: <HardHat className="w-4 h-4" /> },
        { id: 'survey', label: 'Surveying', icon: <Ruler className="w-4 h-4" /> }
    ]
};

// ============================================
// UMBRELLA SWITCHER COMPONENT
// ============================================

const UmbrellaSwitcher: FC = memo(() => {
    const { activeCategory, setCategory } = useUIStore(
        useShallow((s) => ({ activeCategory: s.activeCategory, setCategory: s.setCategory }))
    );

    return (
        <div className="flex items-center gap-2 px-6" role="tablist" aria-label="Workspace categories">
            {UMBRELLA_TABS.map((tab) => {
                const isActive = activeCategory === tab.id;
                return (
                    <button
                        type="button"
                        key={tab.id}
                        role="tab"
                        aria-selected={isActive}
                        onClick={() => setCategory(tab.id)}
                        className={`
                            flex items-center gap-2 px-4 py-3 rounded-lg
                            text-sm font-medium tracking-wide transition-all duration-200
                            ${isActive
                                ? TAB_ACTIVE_STYLES[tab.color]
                                : 'text-[#a9bcde] hover:text-[#dae2fd] hover:bg-[#131b2e] border border-transparent'
                            }
                            focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-400 focus-visible:outline-offset-2
                        `}
                        title={tab.label}
                    >
                        {tab.icon}
                        <span className="hidden lg:inline">{tab.label}</span>
                    </button>
                );
            })}
        </div>
    );
});
UmbrellaSwitcher.displayName = 'UmbrellaSwitcher';

// ============================================
// CONTEXT SIDEBAR COMPONENT
// ============================================

const ContextSidebar: FC = memo(() => {
    const { activeCategory, activeTool, setActiveTool, sidebarMode, toggleSidebar } = useUIStore(
        useShallow((s) => ({
            activeCategory: s.activeCategory,
            activeTool: s.activeTool,
            setActiveTool: s.setActiveTool,
            sidebarMode: s.sidebarMode,
            toggleSidebar: s.toggleSidebar,
        }))
    );
    const setShowAIArchitect = useSetAtom(showAIArchitectAtom);
    const items = SIDEBAR_CONTENT[activeCategory];
    const isExpanded = sidebarMode === 'EXPANDED';

    if (!isExpanded) {
        return (
            <div className="w-10 h-full bg-canvas border-r border-token flex flex-col items-center py-2">
                <button
                    type="button"
                    onClick={toggleSidebar}
                    className="p-2 text-slate-500 hover:text-[#dae2fd] hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-400 focus-visible:outline-offset-2"
                    aria-label="Expand sidebar"
                    title="Expand sidebar"
                >
                    <ChevronRight className="w-4 h-4" aria-hidden="true" />
                </button>
            </div>
        );
    }

    return (
        <div className="h-full bg-canvas border-r border-token flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-4 border-b border-token">
                <h3 className="text-xs font-bold text-dim uppercase tracking-widest">
                    {activeCategory}
                </h3>
                <button
                    type="button"
                    onClick={toggleSidebar}
                    className="p-2 text-slate-500 hover:text-[#dae2fd] hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-400 focus-visible:outline-offset-2"
                    aria-label="Collapse sidebar"
                    title="Collapse sidebar"
                >
                    <ChevronLeft className="w-4 h-4" aria-hidden="true" />
                </button>
            </div>

            {/* Items */}
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
                {items.map((item) => {
                    const isActive = activeTool === item.id;
                    return (
                        <button
                            type="button"
                            key={item.id}
                            onClick={() => {
                                setActiveTool(item.id);
                                item.action?.();
                            }}
                            className={`
                                w-full flex items-center gap-3 px-4 py-3 rounded-lg
                                text-sm font-medium tracking-wide transition-all duration-200
                                ${isActive
                                    ? 'bg-[#4d8eff]/20 text-[#adc6ff] border border-[#4d8eff]/50 shadow-[0_0_12px_rgba(77,142,255,0.15)]'
                                    : 'text-[#a9bcde] hover:text-[#dae2fd] hover:bg-[#4d8eff]/10 border border-transparent'
                                }
                                focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-400 focus-visible:outline-offset-2
                            `}
                            title={item.label}
                        >
                            <span className="w-4 h-4 flex items-center justify-center">
                                {item.icon}
                            </span>
                            <span>{item.label}</span>
                        </button>
                    );
                })}
            </div>

            {/* Category-specific footer */}
            {activeCategory === 'MODELING' && (
                <div className="p-3 border-t border-token">
                    <button
                        type="button"
                        onClick={() => setShowAIArchitect(true)}
                        className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white text-sm font-medium tracking-wide rounded-lg hover:from-purple-500 hover:to-blue-500 transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-200 focus-visible:outline-offset-2"
                        aria-label="Open AI Generate"
                        title="AI Generate"
                    >
                        <Zap className="w-4 h-4" />
                        AI Generate
                    </button>
                </div>
            )}

            {activeCategory === 'ANALYSIS' && (
                <div className="p-3 border-t border-token">
                    <button
                        type="button"
                        className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-green-600 text-white text-sm font-medium tracking-wide rounded-lg hover:bg-green-500 transition-all focus-visible:outline focus-visible:outline-emerald-200 focus-visible:outline-offset-2"
                        aria-label="Run Analysis"
                        title="Run Analysis"
                    >
                        <BarChart3 className="w-4 h-4" />
                        Run Analysis
                    </button>
                </div>
            )}
        </div>
    );
});
ContextSidebar.displayName = 'ContextSidebar';

// ============================================
// INSPECTOR PANEL COMPONENT
// ============================================

interface InspectorPanelProps {
    collapsed: boolean;
    onToggle: () => void;
    activeCategory: Category;
}

const InspectorPanel: FC<InspectorPanelProps> = ({ collapsed, onToggle, activeCategory }) => {
    if (collapsed) {
        return (
            <div className="w-10 h-full bg-canvas border-l border-token flex flex-col items-center py-2">
                <button
                    type="button"
                    onClick={onToggle}
                    className="p-2 text-slate-500 hover:text-[#dae2fd] hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-400 focus-visible:outline-offset-2"
                    aria-label="Expand inspector panel"
                    title="Expand inspector panel"
                >
                    <ChevronLeft className="w-4 h-4" aria-hidden="true" />
                </button>
            </div>
        );
    }

    return (
        <div className="h-full bg-canvas border-l border-token flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-3 py-2 border-b border-token shrink-0">
                <h3 className="text-xs font-bold text-dim uppercase tracking-wider">
                    {activeCategory} Inspector
                </h3>
                <button
                    type="button"
                    onClick={onToggle}
                    className="p-1 text-slate-500 hover:text-[#dae2fd] hover:bg-slate-200 dark:hover:bg-slate-800 rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-400 focus-visible:outline-offset-2"
                    aria-label="Collapse inspector panel"
                    title="Collapse inspector panel"
                >
                    <ChevronRight className="w-4 h-4" aria-hidden="true" />
                </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto">
                {activeCategory === 'LOADING' ? <LoadInspectorPanel /> :
                 activeCategory === 'PROPERTIES' ? <PropertiesInspectorPanel /> :
                 activeCategory === 'SUPPORTS' ? <BoundaryConditionsInspectorPanel /> :
                 activeCategory === 'ANALYSIS' ? <ResultsInspectorPanel /> :
                 <PropertiesPanel />}
            </div>
        </div>
    );
};

// ============================================
// STATUS BAR COMPONENT
// ============================================

const StatusBar: FC = memo(() => {
    const { showGrid, snapToGrid, gridSize } = useUIStore(
        useShallow((s) => ({ showGrid: s.showGrid, snapToGrid: s.snapToGrid, gridSize: s.gridSize }))
    );

    return (
        <div className="h-7 bg-canvas border-t border-token flex items-center justify-between px-4 text-xs text-dim">
            <div className="flex items-center gap-4">
                <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 bg-green-500 rounded-full" />
                    Ready
                </span>
                <span>Units: kN, m</span>
                <span>Grid: {gridSize}m {snapToGrid && '(Snap ON)'}</span>
            </div>
            <div className="flex items-center gap-4">
                <span>Code: IS 800:2007</span>
                <span>View: 3D Perspective</span>
            </div>
        </div>
    );
});
StatusBar.displayName = 'StatusBar';

// ============================================
// RESIZE HANDLE COMPONENT
// ============================================

const ResizeHandle: FC<{ direction: 'horizontal' | 'vertical' }> = ({ direction }) => {
    const isHorizontal = direction === 'horizontal';

    return (
        <PanelResizeHandle
            className={`
                group relative flex items-center justify-center
                ${isHorizontal ? 'w-1 hover:w-1.5' : 'h-1 hover:h-1.5'}
                bg-[#131b2e] hover:bg-blue-500/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-400
                transition-all duration-150
            `}
        >
            <div
                className={`
                    rounded-full bg-slate-600 group-hover:bg-blue-400
                    transition-colors
                    ${isHorizontal ? 'w-0.5 h-6' : 'w-6 h-0.5'}
                `}
            />
        </PanelResizeHandle>
    );
};

// ============================================
// MAIN MODERN WORKSPACE COMPONENT
// ============================================

export const ModernWorkspace: FC<ModernWorkspaceProps> = ({ children }) => {
    const { propertiesPanelOpen, togglePropertiesPanel, activeCategory, sidebarMode, toggleSidebar } = useUIStore(
        useShallow((s) => ({
            propertiesPanelOpen: s.propertiesPanelOpen,
            togglePropertiesPanel: s.togglePropertiesPanel,
            activeCategory: s.activeCategory,
            sidebarMode: s.sidebarMode,
            toggleSidebar: s.toggleSidebar,
        }))
    );

    const canvasPreset = useMemo(() => {
        const leftCollapsed = sidebarMode !== 'EXPANDED';
        const rightCollapsed = !propertiesPanelOpen;
        const isExpanded = leftCollapsed && rightCollapsed;
        return isExpanded ? CANVAS_EXPANDED : CANVAS_DEFAULT;
    }, [propertiesPanelOpen, sidebarMode]);

    const expandCanvas = () => {
        if (sidebarMode === 'EXPANDED') toggleSidebar();
        if (propertiesPanelOpen) togglePropertiesPanel();
    };

    const restorePanels = () => {
        if (sidebarMode !== 'EXPANDED') toggleSidebar();
        if (!propertiesPanelOpen) togglePropertiesPanel();
    };

    const toggleFullCanvas = () => {
        const leftCollapsed = sidebarMode !== 'EXPANDED';
        const rightCollapsed = !propertiesPanelOpen;
        const shouldExpand = !(leftCollapsed && rightCollapsed);
        if (shouldExpand) {
            expandCanvas();
        } else {
            restorePanels();
        }
    };

    // Auto-collapse side panels on smaller viewports and bind keyboard shortcut for canvas focus
    useEffect(() => {
        const mql = window.matchMedia('(max-width: 1280px)');

        const handleViewport = (e: MediaQueryListEvent | MediaQueryList) => {
            if (e.matches) {
                // Small screens: collapse both for canvas focus
                if (sidebarMode === 'EXPANDED') toggleSidebar();
                if (propertiesPanelOpen) togglePropertiesPanel();
            }
        };

        // initial
        handleViewport(mql);
        mql.addEventListener('change', handleViewport);

        const handleKey = (ev: KeyboardEvent) => {
            const tag = (ev.target as HTMLElement)?.tagName?.toLowerCase();
            if (tag === 'input' || tag === 'textarea' || (ev.target as HTMLElement)?.isContentEditable) return;
            if (ev.key.toLowerCase() === 'f' && ev.shiftKey) {
                ev.preventDefault();
                toggleFullCanvas();
            }
        };

        window.addEventListener('keydown', handleKey);
        return () => {
            mql.removeEventListener('change', handleViewport);
            window.removeEventListener('keydown', handleKey);
        };
    }, [propertiesPanelOpen, sidebarMode, togglePropertiesPanel, toggleSidebar, toggleFullCanvas]);

    return (
        <div className="min-h-[100dvh] w-full flex flex-col bg-canvas text-token overflow-hidden">
            {/* Top Bar - Umbrella Switcher */}
            <header className="h-16 bg-canvas border-b border-token flex items-center justify-between px-8 flex-shrink-0">
                {/* Logo */}
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                        <Logo size="sm" variant="full" href="/" />
                        <span className="text-[10px] font-bold px-1.5 py-0.5 bg-gradient-to-r from-blue-600 to-purple-600 rounded">
                            PRO
                        </span>
                    </div>
                </div>

                {/* Umbrella Tabs */}
                <UmbrellaSwitcher />

                {/* Right actions */}
                <div className="flex items-center gap-3">
                    <div className="hidden sm:flex rounded-lg border border-token bg-surface/60 divide-x divide-token overflow-hidden text-xs text-soft">
                            <button
                                type="button"
                                onClick={expandCanvas}
                                className="px-4 py-2 hover:text-[var(--color-text)] hover:bg-[#1a2333] flex items-center gap-2"
                                aria-label="Expand canvas (collapse side panels)"
                                title="Expand canvas (Shift+F)"
                            >
                                <Maximize2 className="w-3.5 h-3.5" /> Canvas
                            </button>
                            <button
                                type="button"
                                onClick={restorePanels}
                                className="px-4 py-2 hover:text-[var(--color-text)] hover:bg-[#1a2333] flex items-center gap-2"
                                aria-label="Restore side panels"
                            >
                                <Minimize2 className="w-3.5 h-3.5" /> Panels
                            </button>
                    </div>
                    <button type="button" className="px-4 py-2 text-xs text-[#a9bcde] hover:text-[#dae2fd] transition-colors">
                        Settings
                    </button>
                </div>
            </header>

            {/* Main Content Area */}
            <div className="flex-1 flex overflow-hidden">
                <PanelGroup direction="horizontal" className="flex-1">
                    {/* Left Panel - Context Sidebar */}
                    <Panel
                        defaultSize={canvasPreset.left}
                        minSize={canvasPreset.left === 0 ? 0 : 10}
                        maxSize={30}
                        collapsedSize={0}
                        collapsible
                        className="min-w-[44px]"
                    >
                        <ContextSidebar />
                    </Panel>

                    <ResizeHandle direction="horizontal" />

                    {/* Center - 3D Canvas */}
                    <Panel minSize={canvasPreset.centerMin}>
                        <div className="h-full bg-canvas relative">
                            {children}
                        </div>
                    </Panel>

                    <ResizeHandle direction="horizontal" />

                    {/* Right Panel - Inspector */}
                    <Panel
                        defaultSize={canvasPreset.right}
                        minSize={canvasPreset.right === 0 ? 0 : 12}
                        maxSize={35}
                        collapsedSize={0}
                        collapsible
                        className="min-w-[44px]"
                    >
                        {activeCategory === 'CIVIL' ? (
                            <Suspense fallback={<div className="h-full bg-canvas flex items-center justify-center" role="status" aria-live="polite"><svg className="animate-spin h-6 w-6 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg><span className="sr-only">Loading panel…</span></div>}>
                                <div className="h-full bg-canvas border-l border-token">
                                    <CivilPanel />
                                </div>
                            </Suspense>
                        ) : (
                            <InspectorPanel
                                collapsed={!propertiesPanelOpen}
                                onToggle={togglePropertiesPanel}
                                activeCategory={activeCategory}
                            />
                        )}
                    </Panel>
                </PanelGroup>
            </div>

            {/* Bottom Bar - Status */}
            <StatusBar />

            {/* AI Learning Assistant Overlay */}
            <Suspense fallback={null}>
                <LearningAssistant />
            </Suspense>
        </div>
    );
};


export default ModernWorkspace;
