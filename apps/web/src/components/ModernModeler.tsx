/**
 * ModernModeler.tsx - Unified Modeler Component
 * 
 * Integrates all modern components:
 * - Flex-based layout with collapsible panels
 * - SmartSidebar for context-aware tools
 * - 3D visualization via ViewportManager
 * - uiStore for category/tool state
 */

import { FC, useState } from 'react';
import {
    Box,
    Layers,
    Download,
    BarChart3,
    Ruler,
    ChevronLeft,
    ChevronRight,
    PanelLeftClose,
    PanelLeftOpen
} from 'lucide-react';
import { useUIStore, Category } from '../store/uiStore';
import { useModelStore } from '../store/model';
import { SmartSidebar } from './layout/SmartSidebar';
import { ViewportManager } from './ViewportManager';
import { Toolbar } from './Toolbar';
import { PropertiesPanel } from './PropertiesPanel';
import { ResultsTable } from './ResultsTable';

// ============================================
// TYPES
// ============================================

interface TabConfig {
    id: Category;
    label: string;
    icon: React.ReactNode;
}

// ============================================
// CATEGORY TABS CONFIGURATION
// ============================================

const CATEGORY_TABS: TabConfig[] = [
    { id: 'MODELING', label: 'Modeling', icon: <Box className="w-4 h-4" /> },
    { id: 'PROPERTIES', label: 'Properties', icon: <Layers className="w-4 h-4" /> },
    { id: 'LOADING', label: 'Loading', icon: <Download className="w-4 h-4" /> },
    { id: 'ANALYSIS', label: 'Analysis', icon: <BarChart3 className="w-4 h-4" /> },
    { id: 'DESIGN', label: 'Design', icon: <Ruler className="w-4 h-4" /> }
];

// ============================================
// CATEGORY SWITCHER
// ============================================

const CategorySwitcher: FC = () => {
    const { activeCategory, setCategory, notification, hideNotification } = useUIStore();

    return (
        <>
            <div className="flex items-center gap-1 px-2">
                {CATEGORY_TABS.map((tab) => {
                    const isActive = activeCategory === tab.id;
                    return (
                        <button
                            key={tab.id}
                            onClick={() => setCategory(tab.id)}
                            className={`
                                flex items-center gap-2 px-4 py-2 rounded-lg
                                text-sm font-medium transition-all duration-200
                                ${isActive
                                    ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30'
                                    : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
                                }
                            `}
                        >
                            {tab.icon}
                            <span className="hidden lg:inline">{tab.label}</span>
                        </button>
                    );
                })}
            </div>

            {/* Notification Toast */}
            {notification?.show && (
                <div className={`
                    fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg
                    flex items-center gap-3 max-w-md
                    ${notification.type === 'error' ? 'bg-red-600' : ''}
                    ${notification.type === 'warning' ? 'bg-yellow-600' : ''}
                    ${notification.type === 'success' ? 'bg-green-600' : ''}
                    ${notification.type === 'info' ? 'bg-blue-600' : ''}
                `}>
                    <span className="text-white text-sm">{notification.message}</span>
                    <button
                        onClick={hideNotification}
                        className="text-white/70 hover:text-white"
                    >
                        ×
                    </button>
                </div>
            )}
        </>
    );
};

// ============================================
// INSPECTOR PANEL
// ============================================

const InspectorPanel: FC<{ collapsed: boolean; onToggle: () => void }> = ({ collapsed, onToggle }) => {
    const selectedIds = useModelStore((state) => state.selectedIds);

    if (collapsed) {
        return (
            <div className="w-10 h-full bg-zinc-900 border-l border-zinc-800 flex flex-col items-center py-2">
                <button
                    onClick={onToggle}
                    className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg"
                    title="Show Properties"
                >
                    <ChevronLeft className="w-4 h-4" />
                </button>
            </div>
        );
    }

    return (
        <div className="w-72 h-full bg-zinc-900 border-l border-zinc-800 flex flex-col flex-shrink-0">
            <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-800">
                <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
                    Properties
                </h3>
                <button
                    onClick={onToggle}
                    className="p-1 text-zinc-500 hover:text-white hover:bg-zinc-800 rounded"
                    title="Hide Properties"
                >
                    <ChevronRight className="w-4 h-4" />
                </button>
            </div>
            <div className="flex-1 overflow-y-auto">
                <PropertiesPanel />
            </div>
            <div className="p-3 border-t border-zinc-800">
                <p className="text-[10px] text-zinc-500 text-center">
                    {selectedIds.size === 0
                        ? 'Select an element to view properties'
                        : `${selectedIds.size} item(s) selected`
                    }
                </p>
            </div>
        </div>
    );
};

// ============================================
// STATUS BAR
// ============================================

const StatusBar: FC = () => {
    const nodes = useModelStore((state) => state.nodes);
    const members = useModelStore((state) => state.members);
    const { activeCategory, activeTool } = useUIStore();

    return (
        <div className="h-7 bg-zinc-950 border-t border-zinc-800 flex items-center justify-between px-4 text-xs text-zinc-500 flex-shrink-0">
            <div className="flex items-center gap-4">
                <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                    Ready
                </span>
                <span>Mode: {activeCategory}</span>
                <span>Tool: {activeTool || 'None'}</span>
            </div>
            <div className="flex items-center gap-4">
                <span>Nodes: {nodes.size}</span>
                <span>Members: {members.size}</span>
                <span>Units: kN, m</span>
            </div>
        </div>
    );
};

// ============================================
// MAIN MODERN MODELER COMPONENT
// ============================================

export const ModernModeler: FC = () => {
    const showResults = useModelStore((state) => state.showResults);
    const nodes = useModelStore((state) => state.nodes);
    const members = useModelStore((state) => state.members);
    const loads = useModelStore((state) => state.loads);

    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    const [inspectorCollapsed, setInspectorCollapsed] = useState(false);

    return (
        <div className="h-screen w-screen flex flex-col bg-zinc-950 text-white overflow-hidden">
            {/* Top Bar - Header + Category Switcher */}
            <header className="h-12 bg-zinc-900 border-b border-zinc-800 flex items-center justify-between px-4 flex-shrink-0">
                {/* Logo */}
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                        <span className="text-2xl">⬡</span>
                        <span className="font-bold text-lg">BeamLab</span>
                        <span className="text-[10px] font-bold px-1.5 py-0.5 bg-gradient-to-r from-blue-600 to-purple-600 rounded">
                            ULTIMATE
                        </span>
                    </div>
                </div>

                {/* Category Tabs */}
                <CategorySwitcher />

                {/* Right actions */}
                <div className="flex items-center gap-2">
                    <div className="flex items-center gap-3 text-xs text-zinc-500">
                        <span>● {nodes.size} nodes</span>
                        <span>━ {members.size} members</span>
                        <span>↓ {loads.length} loads</span>
                    </div>
                    <button className="px-3 py-1.5 text-xs bg-blue-600 hover:bg-blue-500 rounded text-white transition-colors">
                        ⚡ Upgrade
                    </button>
                </div>
            </header>

            {/* Main Content Area */}
            <div className="flex-1 flex overflow-hidden">
                {/* Left Panel - Smart Sidebar */}
                {sidebarCollapsed ? (
                    <div className="w-10 bg-zinc-900 border-r border-zinc-800 flex flex-col items-center py-2 flex-shrink-0">
                        <button
                            onClick={() => setSidebarCollapsed(false)}
                            className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg"
                            title="Show Sidebar"
                        >
                            <PanelLeftOpen className="w-4 h-4" />
                        </button>
                    </div>
                ) : (
                    <div className="w-64 flex-shrink-0 flex flex-col bg-zinc-900 border-r border-zinc-800">
                        <div className="flex items-center justify-between px-2 py-2 border-b border-zinc-800">
                            <span className="text-xs font-bold text-zinc-400 uppercase px-1">Tools</span>
                            <button
                                onClick={() => setSidebarCollapsed(true)}
                                className="p-1 text-zinc-500 hover:text-white hover:bg-zinc-800 rounded"
                                title="Hide Sidebar"
                            >
                                <PanelLeftClose className="w-4 h-4" />
                            </button>
                        </div>
                        <div className="flex-1 overflow-hidden">
                            <SmartSidebar />
                        </div>
                    </div>
                )}

                {/* Center - 3D Canvas */}
                <div className="flex-1 bg-zinc-950 relative">
                    <ViewportManager />
                    <Toolbar />
                </div>

                {/* Right Panel - Inspector */}
                <InspectorPanel
                    collapsed={inspectorCollapsed}
                    onToggle={() => setInspectorCollapsed(!inspectorCollapsed)}
                />
            </div>

            {/* Results Table - conditional */}
            {showResults && <ResultsTable />}

            {/* Bottom Bar - Status */}
            <StatusBar />
        </div>
    );
};

export default ModernModeler;
