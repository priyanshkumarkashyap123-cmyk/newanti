/**
 * WorkspaceLayout - Resizable IDE Layout
 * 
 * Uses react-resizable-panels for a professional IDE-like interface.
 * 
 * Layout:
 * ┌────────────────────────────────────────────┐
 * │                  Ribbon (64px)             │
 * ├──────┬────────────────────────┬────────────┤
 * │      │                        │            │
 * │ Side │      3D Canvas         │ Properties │
 * │ bar  │       (flex)           │  (300px)   │
 * │ 250  │                        │            │
 * ├──────┴────────────────────────┴────────────┤
 * │              Data Tables (200px)           │
 * └────────────────────────────────────────────┘
 */

import { FC, ReactNode, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Panel,
    Group as PanelGroup,
    Separator as PanelResizeHandle
} from 'react-resizable-panels';
import { useModelStore } from '../store/model';

// Layout Components
import { WorkflowSidebar } from '../components/layout/WorkflowSidebar';
import { Ribbon } from '../components/layout/Ribbon';
import { CanvasWrapper } from '../components/layout/CanvasWrapper';
import { RightPropertiesPanel } from '../components/layout/RightPropertiesPanel';
import { DataTablesPanel } from '../components/layout/DataTablesPanel';

// Icons
import {
    Home,
    MessageSquare,
    PanelLeftClose,
    PanelLeftOpen
} from 'lucide-react';

// ============================================
// TYPES
// ============================================

interface WorkspaceLayoutProps {
    children: ReactNode;
}

// ============================================
// RESIZE HANDLE COMPONENT
// ============================================

interface ResizeHandleProps {
    direction: 'horizontal' | 'vertical';
}

const ResizeHandle: FC<ResizeHandleProps> = ({ direction }) => {
    const isHorizontal = direction === 'horizontal';

    return (
        <PanelResizeHandle
            className={`
                group relative flex items-center justify-center
                ${isHorizontal
                    ? 'w-1.5 hover:w-2 cursor-col-resize'
                    : 'h-1.5 hover:h-2 cursor-row-resize'
                }
                bg-zinc-200 dark:bg-zinc-800
                hover:bg-blue-400 dark:hover:bg-blue-600
                transition-all duration-150
            `}
        >
            <div
                className={`
                    rounded-full bg-zinc-400 dark:bg-zinc-600
                    group-hover:bg-white
                    transition-colors
                    ${isHorizontal ? 'w-0.5 h-8' : 'w-8 h-0.5'}
                `}
            />
        </PanelResizeHandle>
    );
};

// ============================================
// WORKSPACE LAYOUT COMPONENT
// ============================================

export const WorkspaceLayout: FC<WorkspaceLayoutProps> = ({ children }) => {
    const navigate = useNavigate();
    const nodes = useModelStore((state) => state.nodes);
    const members = useModelStore((state) => state.members);

    // State
    const [activeWorkflow, setActiveWorkflow] = useState('geometry');
    const [activeTool, setActiveTool] = useState('select');
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
    const [isDataTableCollapsed, setIsDataTableCollapsed] = useState(false);
    const [isChatOpen, setIsChatOpen] = useState(false);

    // Handlers
    const handleToolSelect = (toolId: string) => {
        setActiveTool(toolId);
        console.log('Tool selected:', toolId);
    };

    const handleGoHome = () => {
        navigate('/dashboard');
    };

    // Prepare nodes/members for data tables (nodes & members are Maps)
    const nodeData = Array.from(nodes.entries()).map(([id, node]) => ({
        id,
        x: node.x,
        y: node.y,
        z: node.z
    }));

    const memberData = Array.from(members.entries()).map(([id, member]) => ({
        id,
        startNode: member.startNodeId,
        endNode: member.endNodeId
    }));

    return (
        <div className="h-screen w-screen overflow-hidden bg-zinc-50 dark:bg-zinc-900 flex flex-col">
            {/* Header Bar */}
            <header className="h-10 flex items-center justify-between px-4 bg-zinc-100 dark:bg-zinc-950 border-b border-zinc-200 dark:border-zinc-800">
                {/* Left: Logo & Navigation */}
                <div className="flex items-center gap-3">
                    <button
                        onClick={handleGoHome}
                        className="flex items-center gap-2 text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors"
                    >
                        <Home className="w-4 h-4" />
                        <span className="text-sm font-medium">BeamLab</span>
                    </button>
                    <span className="text-zinc-300 dark:text-zinc-700">/</span>
                    <span className="text-sm text-zinc-700 dark:text-zinc-300">Untitled Project</span>
                </div>

                {/* Right: Actions */}
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setIsChatOpen(!isChatOpen)}
                        className={`p-1.5 rounded transition-colors ${isChatOpen
                            ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-600'
                            : 'text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300'
                            }`}
                    >
                        <MessageSquare className="w-4 h-4" />
                    </button>
                    <button
                        onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                        className="p-1.5 rounded text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors"
                    >
                        {isSidebarCollapsed ? (
                            <PanelLeftOpen className="w-4 h-4" />
                        ) : (
                            <PanelLeftClose className="w-4 h-4" />
                        )}
                    </button>
                </div>
            </header>

            {/* Main Content with Panels */}
            <div className="flex-1 flex flex-col overflow-hidden">
                {/* Ribbon */}
                <Ribbon
                    activeWorkflow={activeWorkflow}
                    activeTool={activeTool}
                    onToolSelect={handleToolSelect}
                />

                {/* Main Panel Group */}
                <PanelGroup direction="vertical" className="flex-1">
                    {/* Top: Horizontal panels */}
                    <Panel defaultSize={75} minSize={40}>
                        <PanelGroup direction="horizontal">
                            {/* Left Sidebar */}
                            {!isSidebarCollapsed && (
                                <>
                                    <Panel
                                        defaultSize={15}
                                        minSize={10}
                                        maxSize={25}
                                        collapsible
                                    >
                                        <WorkflowSidebar
                                            activeCategory={activeWorkflow as any}
                                            onCategoryChange={(cat) => setActiveWorkflow(cat)}
                                        />
                                    </Panel>
                                    <ResizeHandle direction="horizontal" />
                                </>
                            )}

                            {/* Center: Canvas */}
                            <Panel minSize={30}>
                                <CanvasWrapper>
                                    {children}
                                </CanvasWrapper>
                            </Panel>

                            {/* Right: Properties Panel */}
                            <ResizeHandle direction="horizontal" />
                            <Panel
                                defaultSize={20}
                                minSize={15}
                                maxSize={35}
                                collapsible
                            >
                                <RightPropertiesPanel />
                            </Panel>
                        </PanelGroup>
                    </Panel>

                    {/* Bottom: Data Tables */}
                    {!isDataTableCollapsed && (
                        <>
                            <ResizeHandle direction="vertical" />
                            <Panel
                                defaultSize={25}
                                minSize={10}
                                maxSize={50}
                                collapsible
                            >
                                <DataTablesPanel
                                    isCollapsed={false}
                                    onToggleCollapse={() => setIsDataTableCollapsed(true)}
                                    nodes={nodeData}
                                    members={memberData}
                                />
                            </Panel>
                        </>
                    )}
                </PanelGroup>

                {/* Collapsed Data Tables Bar */}
                {isDataTableCollapsed && (
                    <DataTablesPanel
                        isCollapsed={true}
                        onToggleCollapse={() => setIsDataTableCollapsed(false)}
                        nodes={nodeData}
                        members={memberData}
                    />
                )}
            </div>
        </div>
    );
};

export default WorkspaceLayout;
