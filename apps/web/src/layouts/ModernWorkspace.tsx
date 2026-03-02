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
import { FC, ReactNode, lazy, Suspense, memo } from 'react';
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
    Car
} from 'lucide-react';
import { useUIStore, Category } from '../store/uiStore';
const beamLabLogo = '/branding/beamlab_icon_colored.svg';

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
    blue:   'bg-blue-600/20 text-blue-400 border border-blue-500/30',
    purple: 'bg-purple-600/20 text-purple-400 border border-purple-500/30',
    orange: 'bg-orange-600/20 text-orange-400 border border-orange-500/30',
    green:  'bg-green-600/20 text-green-400 border border-green-500/30',
    red:    'bg-red-600/20 text-red-400 border border-red-500/30',
    yellow: 'bg-yellow-600/20 text-yellow-400 border border-yellow-500/30',
};

interface SidebarItem {
    id: string;
    label: string;
    icon: React.ReactNode;
    action?: () => void;
}

interface ModernWorkspaceProps {
    children: ReactNode;
}

const UMBRELLA_TABS: TabConfig[] = [
    { id: 'MODELING', label: 'Modeling', icon: <Box className="w-4 h-4" />, color: 'blue' },
    { id: 'PROPERTIES', label: 'Properties', icon: <Layers className="w-4 h-4" />, color: 'purple' },
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
        { id: 'draw_member', label: 'Draw Member', icon: <PenTool className="w-4 h-4" /> },
        { id: 'grid_tool', label: 'Grid Generator', icon: <Grid3X3 className="w-4 h-4" /> },
        { id: 'dxf_import', label: 'DXF Import', icon: <FileInput className="w-4 h-4" /> }
    ],
    PROPERTIES: [
        { id: 'sections', label: 'Section Library', icon: <Layers className="w-4 h-4" /> },
        { id: 'materials', label: 'Material Library', icon: <Box className="w-4 h-4" /> },
        { id: 'releases', label: 'Member Releases', icon: <Settings className="w-4 h-4" /> },
        { id: 'offsets', label: 'Member Offsets', icon: <Ruler className="w-4 h-4" /> }
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
    const { activeCategory, setCategory } = useUIStore();

    return (
        <div className="flex items-center gap-1 px-2" role="tablist" aria-label="Workspace categories">
            {UMBRELLA_TABS.map((tab) => {
                const isActive = activeCategory === tab.id;
                return (
                    <button type="button"
                        key={tab.id}
                        role="tab"
                        aria-selected={isActive}
                        onClick={() => setCategory(tab.id)}
                        className={`
                            flex items-center gap-2 px-4 py-2 rounded-lg
                            text-sm font-medium transition-all duration-200
                            ${isActive
                                ? TAB_ACTIVE_STYLES[tab.color]
                                : 'text-slate-500 hover:text-slate-900 dark:text-white hover:bg-slate-200 dark:hover:bg-slate-800 border border-transparent'
                            }
                        `}
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
    const { activeCategory, activeTool, setActiveTool, sidebarMode, toggleSidebar } = useUIStore();
    const items = SIDEBAR_CONTENT[activeCategory];
    const isExpanded = sidebarMode === 'EXPANDED';

    if (!isExpanded) {
        return (
            <div className="w-10 h-full bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col items-center py-2">
                <button type="button"
                    onClick={toggleSidebar}
                    className="p-2 text-slate-500 hover:text-slate-900 dark:text-white hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg"
                    aria-label="Expand sidebar"
                >
                    <ChevronRight className="w-4 h-4" aria-hidden="true" />
                </button>
            </div>
        );
    }

    return (
        <div className="h-full bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-3 py-2 border-b border-slate-200 dark:border-slate-800">
                <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    {activeCategory}
                </h3>
                <button type="button"
                    onClick={toggleSidebar}
                    className="p-1 text-slate-500 hover:text-slate-900 dark:text-white hover:bg-slate-200 dark:hover:bg-slate-800 rounded"
                    aria-label="Collapse sidebar"
                >
                    <ChevronLeft className="w-4 h-4" aria-hidden="true" />
                </button>
            </div>

            {/* Items */}
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
                {items.map((item) => {
                    const isActive = activeTool === item.id;
                    return (
                        <button type="button"
                            key={item.id}
                            onClick={() => {
                                setActiveTool(item.id);
                                item.action?.();
                            }}
                            className={`
                                w-full flex items-center gap-3 px-3 py-2.5 rounded-lg
                                text-sm transition-all duration-150
                                ${isActive
                                    ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30'
                                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 hover:text-white'
                                }
                            `}
                        >
                            <span className={isActive ? 'text-blue-400' : 'text-slate-500 dark:text-slate-400'}>
                                {item.icon}
                            </span>
                            {item.label}
                        </button>
                    );
                })}
            </div>

            {/* Category-specific footer */}
            {activeCategory === 'MODELING' && (
                <div className="p-3 border-t border-slate-200 dark:border-slate-800">
                    <button type="button" className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white text-sm font-medium rounded-lg hover:from-purple-500 hover:to-blue-500 transition-all">
                        <Zap className="w-4 h-4" />
                        AI Generate
                    </button>
                </div>
            )}

            {activeCategory === 'ANALYSIS' && (
                <div className="p-3 border-t border-slate-200 dark:border-slate-800">
                    <button type="button" className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-500 transition-all">
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
}

const InspectorPanel: FC<InspectorPanelProps> = ({ collapsed, onToggle }) => {
    if (collapsed) {
        return (
            <div className="w-10 h-full bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 flex flex-col items-center py-2">
                <button type="button"
                    onClick={onToggle}
                    className="p-2 text-slate-500 hover:text-slate-900 dark:text-white hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg"
                    aria-label="Expand inspector panel"
                >
                    <ChevronLeft className="w-4 h-4" aria-hidden="true" />
                </button>
            </div>
        );
    }

    return (
        <div className="h-full bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-3 py-2 border-b border-slate-200 dark:border-slate-800">
                <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Inspector
                </h3>
                <button type="button"
                    onClick={onToggle}
                    className="p-1 text-slate-500 hover:text-slate-900 dark:text-white hover:bg-slate-200 dark:hover:bg-slate-800 rounded"
                    aria-label="Collapse inspector panel"
                >
                    <ChevronRight className="w-4 h-4" aria-hidden="true" />
                </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-3">
                <div className="text-sm text-slate-500 dark:text-slate-400 text-center py-8">
                    Select an element to view properties
                </div>
            </div>
        </div>
    );
};

// ============================================
// STATUS BAR COMPONENT
// ============================================

const StatusBar: FC = memo(() => {
    const { showGrid, snapToGrid, gridSize } = useUIStore();

    return (
        <div className="h-7 bg-white dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between px-4 text-xs text-slate-500 dark:text-slate-400">
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
                bg-slate-100 dark:bg-slate-800 hover:bg-blue-500/50
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
    const { propertiesPanelOpen, togglePropertiesPanel, activeCategory } = useUIStore();

    return (
        <div className="h-screen w-screen flex flex-col bg-white dark:bg-slate-950 text-slate-900 dark:text-white overflow-hidden">
            {/* Top Bar - Umbrella Switcher */}
            <header className="h-12 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-4 flex-shrink-0">
                {/* Logo */}
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                        <img src={beamLabLogo} alt="BeamLab Logo" className="w-8 h-8 object-contain" />
                        <span className="font-bold text-lg">BeamLab</span>
                        <span className="text-[10px] font-bold px-1.5 py-0.5 bg-gradient-to-r from-blue-600 to-purple-600 rounded">
                            PRO
                        </span>
                    </div>
                </div>

                {/* Umbrella Tabs */}
                <UmbrellaSwitcher />

                {/* Right actions */}
                <div className="flex items-center gap-2">
                    <button type="button" className="px-3 py-1.5 text-xs text-slate-500 hover:text-slate-900 dark:text-white transition-colors">
                        Settings
                    </button>
                </div>
            </header>

            {/* Main Content Area */}
            <div className="flex-1 flex overflow-hidden">
                <PanelGroup direction="horizontal" className="flex-1">
                    {/* Left Panel - Context Sidebar */}
                    <Panel
                        defaultSize={18}
                        minSize={12}
                        maxSize={30}
                        collapsible
                    >
                        <ContextSidebar />
                    </Panel>

                    <ResizeHandle direction="horizontal" />

                    {/* Center - 3D Canvas */}
                    <Panel minSize={40}>
                        <div className="h-full bg-white dark:bg-slate-950 relative">
                            {children}
                        </div>
                    </Panel>

                    <ResizeHandle direction="horizontal" />

                    {/* Right Panel - Inspector */}
                    <Panel
                        defaultSize={20}
                        minSize={15}
                        maxSize={35}
                        collapsible
                    >
                        {activeCategory === 'CIVIL' ? (
                            <Suspense fallback={<div className="h-full bg-white dark:bg-slate-900 flex items-center justify-center">Loading...</div>}>
                                <div className="h-full bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800">
                                    <CivilPanel />
                                </div>
                            </Suspense>
                        ) : (
                            <InspectorPanel
                                collapsed={!propertiesPanelOpen}
                                onToggle={togglePropertiesPanel}
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
