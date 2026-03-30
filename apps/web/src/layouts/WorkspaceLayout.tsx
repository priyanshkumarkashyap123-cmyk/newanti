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

import { FC, ReactNode, useEffect, useMemo, useState, useCallback, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Panel,
    Group as PanelGroup,
    Separator as PanelResizeHandle
} from 'react-resizable-panels';
import { useModelStore } from '../store/model';
import { useAuthStore } from '../store/authStore';
import { useAISessionStore } from '../store/aiSessionStore';
import { API_CONFIG } from '../config/env';

// Layout Components
import { WorkflowSidebar } from '../components/layout/WorkflowSidebar';
import { Ribbon } from '../components/layout/Ribbon';
import { CanvasWrapper } from '../components/layout/CanvasWrapper';
import { RightPropertiesPanel } from '../components/layout/RightPropertiesPanel';
import { DataTablesPanel } from '../components/layout/DataTablesPanel';
import { Logo } from '../components/branding';

// Icons
import {
    Home,
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
            role="separator"
            aria-orientation={isHorizontal ? 'vertical' : 'horizontal'}
            tabIndex={0}
            aria-label={isHorizontal ? 'Resize sidebar and canvas' : 'Resize canvas and data tables'}
            className={`
                group relative flex items-center justify-center focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-400 focus-visible:outline-offset-2
                ${isHorizontal
                    ? 'w-1.5 hover:w-2 cursor-col-resize'
                    : 'h-1.5 hover:h-2 cursor-row-resize'
                }
                bg-slate-200 dark:bg-slate-800
                hover:bg-blue-400 dark:hover:bg-blue-600
                transition-all duration-150
            `}
        >
            <div
                className={`
                    rounded-full bg-slate-400 dark:bg-slate-600
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
    const loads = useModelStore((state) => state.loads || []);
    const { tokens } = useAuthStore();
    const {
        sessions,
        activeSessionId,
        createSession,
        setActiveSession,
        addMessage,
        setCloudId,
    } = useAISessionStore();

    const activeSession = useMemo(() => sessions.find(s => s.id === activeSessionId) || null, [sessions, activeSessionId]);

    // State
    const [activeWorkflow, setActiveWorkflow] = useState<'MODELING' | 'PROPERTIES' | 'SUPPORTS' | 'LOADING' | 'ANALYSIS' | 'DESIGN' | 'CIVIL'>(() => {
        const stored = localStorage.getItem('workspace:activeWorkflow');
        if (stored === 'MODELING' || stored === 'PROPERTIES' || stored === 'SUPPORTS' || stored === 'LOADING' || stored === 'ANALYSIS' || stored === 'DESIGN' || stored === 'CIVIL') {
            return stored;
        }
        return 'MODELING';
    });
    const [activeTool, setActiveTool] = useState('select');
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(() => localStorage.getItem('workspace:isSidebarCollapsed') === 'true');
    const [isDataTableCollapsed, setIsDataTableCollapsed] = useState<boolean>(() => localStorage.getItem('workspace:isDataTableCollapsed') === 'true');
    const [isChatOpen, setIsChatOpen] = useState<boolean>(false);
    const [chatInput, setChatInput] = useState<string>('');
    const [isChatSending, setIsChatSending] = useState<boolean>(false);
    const [chatError, setChatError] = useState<string | null>(null);

    // Ensure there's an active chat session when opening chat
    useEffect(() => {
        if (isChatOpen && !activeSession) {
            const sessionId = createSession('Chat session');
            setActiveSession(sessionId);
        }
    }, [isChatOpen, activeSession, createSession, setActiveSession]);

    // Persist layout prefs
    useEffect(() => {
        localStorage.setItem('workspace:isSidebarCollapsed', String(isSidebarCollapsed));
    }, [isSidebarCollapsed]);

    useEffect(() => {
        localStorage.setItem('workspace:isDataTableCollapsed', String(isDataTableCollapsed));
    }, [isDataTableCollapsed]);

    useEffect(() => {
        localStorage.setItem('workspace:activeWorkflow', activeWorkflow);
    }, [activeWorkflow]);

    const handleSyncHistory = async () => {
        if (!tokens?.accessToken) return;
        await useAISessionStore.getState().syncToCloud(tokens.accessToken);
    };

    const handleLoadHistory = async () => {
        if (!tokens?.accessToken) return;
        await useAISessionStore.getState().loadFromCloud(tokens.accessToken);
    };

    // Handlers
    const handleToolSelect = (toolId: string) => {
        setActiveTool(toolId);
    };

    const handleGoHome = () => {
        navigate('/stream');
    };

    const handleSendChat = useCallback(async (e?: FormEvent) => {
        if (e) e.preventDefault();
        const message = chatInput.trim();
        if (!message || isChatSending) return;
        if (!tokens?.accessToken) {
            setChatError('Please sign in to chat.');
            return;
        }
        if (!activeSession) {
            setChatError('No active session.');
            return;
        }

        setChatError(null);
        setIsChatSending(true);

        // Optimistically add user message
        addMessage(activeSession.id, { role: 'user', content: message, type: 'chat' });
        setChatInput('');

        try {
            const response = await fetch(`${API_CONFIG.baseUrl}/api/ai-sessions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${tokens.accessToken}`,
                },
                body: JSON.stringify({
                    name: activeSession.name || 'Chat session',
                    type: 'chat',
                    messages: [
                        ...activeSession.messages.map(m => ({
                            role: m.role === 'system' ? 'assistant' : m.role,
                            content: m.content,
                            timestamp: m.timestamp,
                            metadata: m.metadata,
                        })),
                        { role: 'user', content: message, timestamp: new Date().toISOString() },
                    ],
                }),
            });

            if (!response.ok) {
                throw new Error(`Chat send failed (${response.status})`);
            }

            const raw = await response.json();
            const data = raw?.data ?? raw;
            const cloudId = data?.session?._id;
            const assistantMessage = data?.session?.messages?.[data.session.messages.length - 1];

            if (cloudId) {
                setCloudId(activeSession.id, cloudId);
            }

            if (assistantMessage?.role === 'assistant' && assistantMessage.content) {
                addMessage(activeSession.id, {
                    role: 'assistant',
                    content: assistantMessage.content,
                    type: 'chat',
                    metadata: assistantMessage.metadata,
                });
            }
        } catch (err) {
            setChatError(err instanceof Error ? err.message : 'Failed to send message');
        } finally {
            setIsChatSending(false);
        }
    }, [chatInput, isChatSending, tokens?.accessToken, activeSession, addMessage, setCloudId]);

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

    const loadData = Array.isArray(loads)
        ? loads.map((load: any, idx: number) => ({
            id: load?.id ?? `L${idx + 1}`,
            nodeId: load?.nodeId ?? load?.node_id ?? load?.node ?? '-',
            fx: load?.fx ?? load?.fx_kn ?? load?.forceX ?? load?.fx_kN ?? 0,
            fy: load?.fy ?? load?.fy_kn ?? load?.forceY ?? load?.fy_kN ?? 0,
        }))
        : [];

    return (
        <div className="h-screen w-screen overflow-hidden bg-slate-50 dark:bg-slate-950 flex flex-col">
            {/* Header Bar */}
            <header className="h-14 flex items-center justify-between px-8 bg-slate-100 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
                {/* Left: Logo & Navigation */}
                <div className="flex items-center gap-3">
                    <Logo size="xs" showLabel href="/" />
                    <button type="button"
                        onClick={handleGoHome}
                        className="flex items-center gap-2 text-slate-500 hover:text-[#dae2fd] dark:hover:text-slate-200 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-400 focus-visible:outline-offset-2"
                        aria-label="Go to stream home"
                        title="Stream"
                    >
                        <Home className="w-4 h-4" />
                        <span className="text-sm font-medium tracking-wide">Home</span>
                    </button>
                    <span className="text-slate-600 dark:text-slate-700" aria-hidden="true">/</span>
                    <span className="text-sm text-[#adc6ff]" aria-label="Project name">Untitled Project</span>
                </div>

                {/* Right: Actions */}
                <div className="flex items-center gap-3">
                    <button
                        type="button"
                        onClick={() => setIsChatOpen(!isChatOpen)}
                            className={`h-10 px-3 flex items-center gap-2 rounded transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-400 focus-visible:outline-offset-2 ${isChatOpen
                                ? 'bg-blue-500/15 text-blue-200 border border-blue-500/30'
                                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 border border-transparent'
                                }`}
                        aria-pressed={isChatOpen}
                        aria-label={isChatOpen ? 'Close chat' : 'Open chat'}
                        title="Chat"
                    >
                        <span className="text-[11px] font-semibold">Chat</span>
                    </button>
                    <button
                        type="button"
                        onClick={handleLoadHistory}
                        className="h-10 px-3 flex items-center gap-2 rounded text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 border border-transparent transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-400 focus-visible:outline-offset-2"
                        title="Load AI history"
                        aria-label="Load AI history"
                    >
                        <span className="text-[11px] font-semibold">Load</span>
                    </button>
                    <button
                        type="button"
                        onClick={handleSyncHistory}
                        className="h-10 px-3 flex items-center gap-2 rounded text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 border border-transparent transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-400 focus-visible:outline-offset-2"
                        title="Sync AI history"
                        aria-label="Sync AI history"
                    >
                        <span className="text-[11px] font-semibold">Sync</span>
                    </button>
                    <button type="button"
                        onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                        className="h-10 w-10 flex items-center justify-center rounded text-[#a9bcde] hover:text-[#dae2fd] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-400 focus-visible:outline-offset-2"
                        aria-pressed={isSidebarCollapsed}
                        aria-label={isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
                        title={isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
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
            <div className="flex-1 flex flex-col overflow-hidden gap-5">
                {/* Ribbon */}
                <div className="px-6 py-4">
                    <Ribbon
                        activeWorkflow={activeWorkflow}
                        activeTool={activeTool}
                        onToolSelect={handleToolSelect}
                    />
                </div>

                {/* Main Panel Group */}
                <PanelGroup direction="vertical" className="flex-1 min-h-0">
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
                                            activeCategory={activeWorkflow}
                                            onCategoryChange={(cat) => setActiveWorkflow(cat as typeof activeWorkflow)}
                                            collapsed={isSidebarCollapsed}
                                            onCollapseToggle={setIsSidebarCollapsed}
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
                                    loads={loadData}
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
                        loads={loadData}
                    />
                )}
            </div>

            {/* Chat Drawer */}
            {isChatOpen && (
                <div
                    className="absolute right-4 bottom-4 w-96 max-w-md bg-slate-900 border border-slate-800 shadow-2xl rounded-xl overflow-hidden flex flex-col"
                    role="dialog"
                    aria-modal="true"
                    aria-label="Chat panel"
                >
                    <div className="flex items-center justify-between px-3 py-2 bg-slate-800 border-b border-slate-700">
                        <div className="flex flex-col">
                            <span className="text-sm font-semibold text-slate-100">Chat</span>
                            <span className="text-[11px] text-slate-400">Ask quick questions</span>
                        </div>
                        <button
                            type="button"
                            onClick={() => setIsChatOpen(false)}
                            className="text-slate-300 hover:text-white p-1 rounded hover:bg-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-400 focus-visible:outline-offset-2"
                            aria-label="Close chat"
                        >
                            ×
                        </button>
                    </div>

                    <div className="flex-1 px-3 py-2 space-y-3 text-sm text-slate-200 overflow-y-auto">
                        {activeSession && activeSession.messages.length > 0 ? (
                            activeSession.messages.map((msg) => (
                                <div key={msg.id} className="flex flex-col gap-1">
                                    <div className="flex items-center gap-2 text-[11px] text-slate-500">
                                        <span className="font-semibold text-slate-300">{msg.role === 'user' ? 'You' : 'AI'}</span>
                                        <span aria-hidden="true">•</span>
                                        <span>{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                    </div>
                                    <div className={`rounded-lg px-3 py-2 whitespace-pre-wrap ${msg.role === 'user' ? 'bg-slate-800 border border-slate-700' : 'bg-blue-900/40 border border-blue-800'}`}>
                                        {msg.content}
                                    </div>
                                </div>
                            ))
                        ) : (
                            <p className="text-slate-300">Start the conversation to get help with your model.</p>
                        )}

                        {chatError && (
                            <div className="text-xs text-red-300 bg-red-900/30 border border-red-800 rounded-md px-3 py-2">
                                {chatError}
                            </div>
                        )}
                    </div>

                    <form onSubmit={handleSendChat} className="px-3 py-2 border-t border-slate-700 space-y-2">
                        <div className="flex gap-2">
                            <input
                                type="text"
                                className="w-full rounded-md bg-slate-800 border border-slate-700 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="Type a message..."
                                aria-label="Chat input"
                                value={chatInput}
                                onChange={(e) => setChatInput(e.target.value)}
                                disabled={isChatSending}
                            />
                            <button
                                type="submit"
                                className="px-3 py-2 text-sm font-semibold rounded-md bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-60 disabled:cursor-not-allowed"
                                disabled={isChatSending || !chatInput.trim()}
                                aria-label="Send message"
                            >
                                {isChatSending ? 'Sending…' : 'Send'}
                            </button>
                        </div>
                        {!tokens?.accessToken && (
                            <p className="text-[11px] text-amber-300">Sign in to enable chat.</p>
                        )}
                    </form>
                </div>
            )}
        </div>
    );
};

export default WorkspaceLayout;
