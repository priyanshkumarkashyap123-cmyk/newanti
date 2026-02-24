/**
 * AIArchitectPanel.tsx - AI-Powered Structure Generation
 * 
 * Allows users to describe a structure in natural language
 * and generates it using the Python AI backend with Google Gemini.
 * 
 * V2.0: 1000x Enhanced with smart model modifications
 */

import { FC, useState, useCallback, useEffect, useRef } from 'react';
import { Sparkles, Loader2, AlertCircle, CheckCircle, Zap, MessageCircle, Send, Bot, User, Wand2, Edit3, Settings2, Lightbulb, Clock, History, Plus, BookOpen } from 'lucide-react';
import { useModelStore } from '../../store/model';
import { aiLogger } from '../../utils/logger';
import { API_CONFIG } from '../../config/env';
import { useAISessionStore } from '../../store/aiSessionStore';
import { aiArchitect } from '../../ai/EnhancedAIArchitect';
import { AISessionHistoryPanel } from './AISessionHistoryPanel';

// ============================================
// CONFIGURATION
// ============================================

const PYTHON_API = API_CONFIG.pythonUrl;

// ============================================
// TYPES
// ============================================

interface GenerateResponse {
    success: boolean;
    model?: {
        nodes: Array<{
            id: string;
            x: number;
            y: number;
            z: number;
            support?: string;
        }>;
        members: Array<{
            id: string;
            start_node: string;
            end_node: string;
            section_profile: string;
        }>;
        metadata?: Record<string, string>;
    };
    error?: string;
    details?: string;
    hint?: string;
}

interface ChatMessage {
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
    isModification?: boolean;
    changes?: string[];
}

interface AIStatus {
    gemini_configured: boolean;
    mock_mode: boolean;
    model: string;
    capabilities: string[];
    version?: string;
}

interface ModifyResponse {
    success: boolean;
    message: string;
    model?: any;
    changes?: string[];
    parsed?: {
        intent: string;
        confidence: number;
        entities: Record<string, any>;
    };
    suggestions?: string[];
}

// ============================================
// EXAMPLE PROMPTS
// ============================================

const EXAMPLE_PROMPTS = [
    "Create a simply supported beam of 8m span with 20 kN/m UDL",
    "Design a 3-story building frame, 5m bays, 3.5m height",
    "Generate a 20m warehouse portal frame with dead load 5 kN/m",
    "Create a 12m span Pratt truss with 6 panels",
    "Make a cantilever beam 5m with 10kN point load at free end",
    "Design a 3-bay portal frame 30m wide, 8m eave height",
    "Create a continuous beam with 3 spans of 6m each with UDL 15 kN/m",
    "Generate a Warren truss bridge 30m span 5m depth",
];

// Modification examples for smart modify
const MODIFY_EXAMPLES = [
    "Change columns to ISMB400",
    "Add UDL of 20 kN/m on beam B1",
    "Add fixed support at N1",
    "Remove member M5",
    "Set span to 15m",
    "Add a new story on top",
    "Make beams heavier",
    "Add wind load 1.5 kN/m on all members"
];

const CHAT_SUGGESTIONS = [
    "What is a Pratt truss?",
    "Explain moment of inertia",
    "How to reduce deflection?",
    "IS 800 steel design basics",
    "How does UDL differ from point load?",
    "Explain P-Delta analysis"
];

// ============================================
// MAIN COMPONENT
// ============================================

export const AIArchitectPanel: FC = () => {
    const [prompt, setPrompt] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    // Chat state
    const [activeTab, setActiveTab] = useState<'generate' | 'modify' | 'chat'>('generate');
    const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
    const [chatInput, setChatInput] = useState('');
    const [isChatting, setIsChatting] = useState(false);
    const [aiStatus, setAIStatus] = useState<AIStatus | null>(null);
    const chatEndRef = useRef<HTMLDivElement>(null);
    
    // Session history state
    const [showHistory, setShowHistory] = useState(false);

    // Modify state
    const [modifyCommand, setModifyCommand] = useState('');
    const [isModifying, setIsModifying] = useState(false);
    const [modifyHistory, setModifyHistory] = useState<{ command: string; result: string; success: boolean }[]>([]);

    // Session store
    const { createSession, addMessage, activeSessionId, setActiveSession, getActiveSession, sessions } = useAISessionStore();

    // Store actions
    const clearModel = useModelStore((state) => state.clearModel);
    const addNode = useModelStore((state) => state.addNode);
    const addMember = useModelStore((state) => state.addMember);
    const addMemberLoad = useModelStore((state) => state.addMemberLoad);
    const addNodeLoad = useModelStore((state) => state.addLoad);
    const updateNode = useModelStore((state) => state.updateNode);
    const updateMember = useModelStore((state) => state.updateMember);
    const removeNode = useModelStore((state) => state.removeNode);
    const removeMember = useModelStore((state) => state.removeMember);
    const nodes = useModelStore((state) => state.nodes);
    const members = useModelStore((state) => state.members);

    // Ensure we have an active session
    const ensureSession = useCallback(() => {
        if (!activeSessionId) {
            return createSession();
        }
        return activeSessionId;
    }, [activeSessionId, createSession]);

    // Check AI status on mount
    useEffect(() => {
        fetch(`${PYTHON_API}/ai/status`)
            .then(res => res.json())
            .then(data => setAIStatus(data))
            .catch(() => setAIStatus(null));
    }, []);

    // Auto-scroll chat
    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [chatMessages]);

    // ========================================
    // HELPER: Convert store to API model format
    // ========================================
    const getModelForAPI = useCallback(() => {
        const nodesArray = Array.from(nodes.values()).map(n => ({
            id: n.id,
            x: n.x,
            y: n.y,
            z: n.z,
            restraints: n.restraints || {}
        }));

        const membersArray = Array.from(members.values()).map(m => ({
            id: m.id,
            startNodeId: m.startNodeId,
            endNodeId: m.endNodeId,
            sectionId: m.sectionId
        }));

        return { nodes: nodesArray, members: membersArray, loads: [] };
    }, [nodes, members]);

    // ========================================
    // HELPER: Apply model changes from API response
    // ========================================
    const applyModelChanges = useCallback((model: any) => {
        // Clear and rebuild model
        clearModel();

        // Add nodes
        if (model.nodes) {
            for (const node of model.nodes) {
                addNode({
                    id: node.id,
                    x: node.x,
                    y: node.y,
                    z: node.z || 0,
                    restraints: node.restraints
                });
            }
        }

        // Add members
        if (model.members) {
            for (const member of model.members) {
                addMember({
                    id: member.id,
                    startNodeId: member.startNodeId || member.start_node,
                    endNodeId: member.endNodeId || member.end_node,
                    sectionId: member.sectionId || member.section_profile || member.section || 'ISMB300'
                });
            }
        }
    }, [clearModel, addNode, addMember]);

    // ========================================
    // SMART MODIFY HANDLER (with session tracking)
    // ========================================
    const handleSmartModify = useCallback(async () => {
        if (!modifyCommand.trim()) {
            setError('Please enter a modification command');
            return;
        }

        if (nodes.size === 0) {
            setError('No model to modify. Generate a structure first!');
            return;
        }

        setError(null);
        setSuccess(null);
        setIsModifying(true);

        // Track in session
        const sessionId = ensureSession();
        addMessage(sessionId, { role: 'user', content: modifyCommand, type: 'modify' });

        aiLogger.debug("Smart modify:", modifyCommand);

        try {
            const model = getModelForAPI();

            const response = await fetch(`${PYTHON_API}/ai/smart-modify`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model,
                    command: modifyCommand
                })
            });

            const data: ModifyResponse = await response.json();
            aiLogger.debug("Response:", data);

            if (data.success && data.model) {
                // Apply the modified model to the store
                applyModelChanges(data.model);

                setSuccess(data.message);
                setModifyHistory(prev => [...prev, {
                    command: modifyCommand,
                    result: data.message,
                    success: true
                }]);
                addMessage(sessionId, { role: 'assistant', content: data.message, type: 'modify' });
                setModifyCommand('');
            } else {
                const errorMsg = data.message || 'Modification failed';
                setError(errorMsg);

                // Show suggestions if available
                if (data.suggestions && data.suggestions.length > 0) {
                    setError(`${errorMsg}\n\nTry: ${data.suggestions[0]}`);
                }

                setModifyHistory(prev => [...prev, {
                    command: modifyCommand,
                    result: errorMsg,
                    success: false
                }]);
                addMessage(sessionId, { role: 'assistant', content: errorMsg, type: 'error' });
            }

        } catch (err) {
            console.error("[AI Brain] Error:", err);
            const errMsg = err instanceof Error ? err.message : 'Connection error';
            setError(errMsg);
            addMessage(sessionId, { role: 'assistant', content: errMsg, type: 'error' });
        } finally {
            setIsModifying(false);
        }
    }, [modifyCommand, nodes.size, getModelForAPI, applyModelChanges, ensureSession, addMessage]);

    // ========================================
    // GENERATE HANDLER (with fallback + session tracking)
    // ========================================
    const handleGenerate = useCallback(async () => {
        if (!prompt.trim()) {
            setError('Please enter a description');
            return;
        }

        // Clear previous states
        setError(null);
        setSuccess(null);
        setIsGenerating(true);

        // Track in session
        const sessionId = ensureSession();
        addMessage(sessionId, { role: 'user', content: prompt, type: 'generate' });

        console.log("[AIArchitect] Sending prompt:", prompt);

        let generatedViaBackend = false;

        try {
            // Try Python backend first
            const response = await fetch(`${PYTHON_API}/generate/ai`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ prompt })
            });

            console.log("[AIArchitect] Response status:", response.status);

            const data: GenerateResponse = await response.json();
            console.log("[AIArchitect] Response data:", data);

            if (!data.success) {
                const errorMsg = data.error || 'Generation failed';
                const details = data.details ? ` - ${data.details}` : '';
                const hint = data.hint ? ` (${data.hint})` : '';
                throw new Error(`${errorMsg}${details}${hint}`);
            }

            if (!data.model) {
                throw new Error('No model data returned');
            }

            // Success! Populate the model
            clearModel();

            // Add nodes with support conditions from AI
            for (const node of data.model.nodes) {
                const restraints: any = {};
                const support = (node.support || '').toUpperCase();
                if (support === 'FIXED') {
                    restraints.fx = true; restraints.fy = true; restraints.fz = true;
                    restraints.mx = true; restraints.my = true; restraints.mz = true;
                } else if (support === 'PINNED') {
                    restraints.fx = true; restraints.fy = true; restraints.fz = true;
                } else if (support === 'ROLLER') {
                    restraints.fy = true;
                }
                addNode({
                    id: node.id,
                    x: node.x,
                    y: node.y,
                    z: node.z || 0,
                    restraints: Object.keys(restraints).length > 0 ? restraints : undefined,
                });
            }

            // Add members
            for (const member of data.model.members) {
                addMember({
                    id: member.id,
                    startNodeId: member.start_node,
                    endNodeId: member.end_node,
                    sectionId: member.section_profile || 'ISMB300'
                });
            }

            generatedViaBackend = true;
            const modelName = data.model.metadata?.['name'] || 'AI Generated';
            const successMsg = `✓ Generated "${modelName}" (${data.model.nodes.length} nodes, ${data.model.members.length} members)`;
            setSuccess(successMsg);
            
            addMessage(sessionId, {
                role: 'assistant',
                content: successMsg,
                type: 'generate',
                metadata: {
                    structureType: modelName,
                    nodesGenerated: data.model.nodes.length,
                    membersGenerated: data.model.members.length
                }
            });
            setPrompt('');

        } catch (err) {
            console.warn("[AIArchitect] Backend failed, trying local EnhancedAIArchitect:", err);

            // FALLBACK: Use local EnhancedAIArchitect
            try {
                const localResponse = await aiArchitect.processRequest({ message: prompt });
                
                if (localResponse.structureData) {
                    clearModel();
                    const sd = localResponse.structureData;

                    for (const node of sd.nodes) {
                        addNode({
                            id: node.id,
                            x: node.x,
                            y: node.y,
                            z: node.z || 0,
                            restraints: node.restraints || undefined,
                        });
                    }

                    for (const member of sd.members) {
                        addMember({
                            id: member.id,
                            startNodeId: member.startNodeId,
                            endNodeId: member.endNodeId,
                            sectionId: member.section || 'ISMB300'
                        });
                    }

                    // Apply supports from structure data
                    if (sd.supports) {
                        for (const sup of sd.supports) {
                            const restraints: any = {};
                            if (sup.type === 'fixed') {
                                restraints.fx = true; restraints.fy = true; restraints.fz = true;
                                restraints.mx = true; restraints.my = true; restraints.mz = true;
                            } else if (sup.type === 'pinned') {
                                restraints.fx = true; restraints.fy = true; restraints.fz = true;
                            } else if (sup.type === 'roller') {
                                restraints.fy = true;
                            }
                            if (Object.keys(restraints).length > 0) {
                                updateNode(sup.nodeId, { restraints });
                            }
                        }
                    }

                    // Apply loads from structure data
                    if (sd.loads) {
                        for (const load of sd.loads) {
                            if (load.type === 'member_distributed' && load.memberId) {
                                try {
                                    addMemberLoad({
                                        id: load.id || `ML-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                                        memberId: load.memberId,
                                        type: 'UDL',
                                        w1: load.values?.[0] || -10,
                                        direction: 'global_y',
                                    });
                                } catch (e) { console.warn('Failed to add member load:', e); }
                            } else if (load.type === 'node_force' && load.nodeId) {
                                try {
                                    addNodeLoad({
                                        id: load.id || `NL-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                                        nodeId: load.nodeId,
                                        fx: load.values?.[0] || 0,
                                        fy: load.values?.[1] || 0,
                                        fz: load.values?.[2] || 0,
                                    });
                                } catch (e) { console.warn('Failed to add node load:', e); }
                            }
                        }
                    }

                    generatedViaBackend = true;
                    const name = sd.metadata?.name || localResponse.type || 'Local AI Generated';
                    const successMsg = `✓ Generated "${name}" (${sd.nodes.length} nodes, ${sd.members.length} members) [Local AI]`;
                    setSuccess(successMsg);
                    addMessage(sessionId, {
                        role: 'assistant',
                        content: successMsg,
                        type: 'generate',
                        metadata: {
                            structureType: name,
                            nodesGenerated: sd.nodes.length,
                            membersGenerated: sd.members.length,
                        }
                    });
                    setPrompt('');
                } else {
                    // Show AI explanation if no structure was generated
                    const aiMsg = localResponse.message || 'I understood your request but could not generate a structure. Please try being more specific.';
                    setError(aiMsg);
                    addMessage(sessionId, { role: 'assistant', content: aiMsg, type: 'error' });
                }
            } catch (localErr) {
                console.error("[AIArchitect] Both backends failed:", localErr);
                const errorMsg = err instanceof TypeError && (err as TypeError).message.includes('fetch')
                    ? 'Cannot connect to AI Server. Using local fallback also failed. Please check your connection.'
                    : (err instanceof Error ? err.message : 'Unknown error occurred');
                setError(errorMsg);
                addMessage(sessionId, { role: 'assistant', content: errorMsg, type: 'error' });
            }
        } finally {
            setIsGenerating(false);
        }
    }, [prompt, clearModel, addNode, addMember, addMemberLoad, addNodeLoad, updateNode, ensureSession, addMessage]);

    // ========================================
    // CHAT HANDLER (with session tracking + local fallback)
    // ========================================
    const handleChat = useCallback(async () => {
        if (!chatInput.trim()) return;

        const userMessage: ChatMessage = {
            role: 'user',
            content: chatInput,
            timestamp: new Date()
        };

        setChatMessages(prev => [...prev, userMessage]);

        // Track in session
        const sessionId = ensureSession();
        addMessage(sessionId, { role: 'user', content: chatInput, type: 'chat' });

        setChatInput('');
        setIsChatting(true);

        try {
            // Build context from current model
            let context = '';
            if (nodes.size > 0 || members.size > 0) {
                context = `Current model has ${nodes.size} nodes and ${members.size} members.`;
            }

            const response = await fetch(`${PYTHON_API}/ai/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: chatInput,
                    context,
                    history: chatMessages.slice(-10).map(m => ({
                        role: m.role,
                        content: m.content
                    }))
                })
            });

            const data = await response.json();

            const responseText = data.success ? data.response : 'Sorry, I encountered an error. Please try again.';
            const assistantMessage: ChatMessage = {
                role: 'assistant',
                content: responseText,
                timestamp: new Date()
            };

            setChatMessages(prev => [...prev, assistantMessage]);
            addMessage(sessionId, { role: 'assistant', content: responseText, type: 'chat' });

        } catch (err) {
            // Fallback to local AI
            let fallbackResponse: string;
            try {
                const localResponse = await aiArchitect.processRequest({ message: chatInput });
                fallbackResponse = localResponse.message || 'I can help with structural engineering questions. Please try rephrasing your question.';
            } catch {
                fallbackResponse = 'Unable to connect to the AI service. Please check if the backend is running.';
            }

            const errorMessage: ChatMessage = {
                role: 'assistant',
                content: fallbackResponse,
                timestamp: new Date()
            };
            setChatMessages(prev => [...prev, errorMessage]);
            addMessage(sessionId, { role: 'assistant', content: fallbackResponse, type: 'chat' });
        } finally {
            setIsChatting(false);
        }
    }, [chatInput, chatMessages, nodes.size, members.size, ensureSession, addMessage]);

    // ========================================
    // HANDLE EXAMPLE CLICK
    // ========================================
    const handleExampleClick = (example: string) => {
        setPrompt(example);
        setError(null);
        setSuccess(null);
    };

    const handleChatSuggestion = (suggestion: string) => {
        setChatInput(suggestion);
    };

    // Resume a session from history
    const handleResumeSession = useCallback((sessionId: string) => {
        setActiveSession(sessionId);
        const session = sessions.find(s => s.id === sessionId);
        if (session) {
            // Restore chat messages from session
            const restored: ChatMessage[] = session.messages.map(m => ({
                role: m.role as 'user' | 'assistant',
                content: m.content,
                timestamp: new Date(m.timestamp),
            }));
            setChatMessages(restored);
            
            // Switch to the most relevant tab
            const hasGenerate = session.messages.some(m => m.type === 'generate');
            const hasModify = session.messages.some(m => m.type === 'modify');
            const hasChat = session.messages.some(m => m.type === 'chat');
            if (hasChat) setActiveTab('chat');
            else if (hasModify) setActiveTab('modify');
            else if (hasGenerate) setActiveTab('generate');
        }
        setShowHistory(false);
    }, [sessions, setActiveSession]);

    // Start new session
    const handleNewSession = useCallback(() => {
        const id = createSession();
        setChatMessages([]);
        setModifyHistory([]);
        setPrompt('');
        setModifyCommand('');
        setError(null);
        setSuccess(null);
    }, [createSession]);

    // If showing history, render the history panel
    if (showHistory) {
        return (
            <AISessionHistoryPanel
                onResumeSession={handleResumeSession}
                onClose={() => setShowHistory(false)}
            />
        );
    }

    return (
        <div className="h-full flex flex-col bg-zinc-900">
            {/* Header with Gemini branding */}
            <div className="px-3 py-3 border-b border-zinc-800">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="p-1.5 bg-gradient-to-br from-blue-500/20 to-purple-500/20 rounded-lg">
                            <Sparkles className="w-4 h-4 text-blue-400" />
                        </div>
                        <div>
                            <h3 className="text-sm font-semibold text-white">AI Architect</h3>
                            <p className="text-[10px] text-zinc-400 flex items-center gap-1">
                                Powered by
                                <span className="bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent font-medium">
                                    Google Gemini
                                </span>
                                {aiStatus?.gemini_configured && (
                                    <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
                                )}
                            </p>
                        </div>
                    </div>
                    {/* Session controls */}
                    <div className="flex items-center gap-1">
                        <button
                            onClick={handleNewSession}
                            className="p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-700/50 rounded-lg transition-colors"
                            title="New Session"
                        >
                            <Plus className="w-3.5 h-3.5" />
                        </button>
                        <button
                            onClick={() => setShowHistory(true)}
                            className="p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-700/50 rounded-lg transition-colors relative"
                            title="Session History"
                        >
                            <History className="w-3.5 h-3.5" />
                            {sessions.length > 0 && (
                                <span className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-blue-500 rounded-full text-[8px] text-white flex items-center justify-center">
                                    {sessions.length > 9 ? '9+' : sessions.length}
                                </span>
                            )}
                        </button>
                    </div>
                </div>

                {/* Tab Switcher */}
                <div className="flex gap-1 mt-3 p-0.5 bg-zinc-800/50 rounded-lg">
                    <button
                        onClick={() => setActiveTab('generate')}
                        className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-md text-xs font-medium transition-all ${activeTab === 'generate'
                            ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white shadow-sm'
                            : 'text-zinc-400 hover:text-white'
                            }`}
                    >
                        <Wand2 className="w-3.5 h-3.5" />
                        Generate
                    </button>
                    <button
                        onClick={() => setActiveTab('modify')}
                        className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-md text-xs font-medium transition-all ${activeTab === 'modify'
                            ? 'bg-gradient-to-r from-green-600 to-emerald-600 text-white shadow-sm'
                            : 'text-zinc-400 hover:text-white'
                            }`}
                    >
                        <Edit3 className="w-3.5 h-3.5" />
                        Modify
                    </button>
                    <button
                        onClick={() => setActiveTab('chat')}
                        className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-md text-xs font-medium transition-all ${activeTab === 'chat'
                            ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white shadow-sm'
                            : 'text-zinc-400 hover:text-white'
                            }`}
                    >
                        <MessageCircle className="w-3.5 h-3.5" />
                        Chat
                    </button>
                </div>
            </div>

            {/* Main Content - Generate Tab */}
            {activeTab === 'generate' && (
                <div className="flex-1 p-3 space-y-3 overflow-y-auto">
                    {/* Prompt Input */}
                    <div>
                        <label className="block text-xs text-zinc-400 mb-1">
                            Describe your structure
                        </label>
                        <textarea
                            value={prompt}
                            onChange={(e) => setPrompt(e.target.value)}
                            placeholder="e.g., Create a 15m span Pratt truss..."
                            disabled={isGenerating}
                            className="
                                w-full h-24 px-3 py-2
                                bg-zinc-800 border border-zinc-700 rounded-lg
                                text-sm text-zinc-200 placeholder-zinc-600
                                focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500
                                resize-none
                                disabled:opacity-50 disabled:cursor-not-allowed
                            "
                        />
                    </div>

                    {/* Example Prompts */}
                    <div>
                        <label className="block text-xs text-zinc-400 mb-1.5">
                            Try an example
                        </label>
                        <div className="flex flex-wrap gap-1.5">
                            {EXAMPLE_PROMPTS.slice(0, 5).map((example, i) => (
                                <button
                                    key={i}
                                    onClick={() => handleExampleClick(example)}
                                    disabled={isGenerating}
                                    className="
                                        px-2 py-1 text-[10px]
                                        bg-zinc-800/50 border border-zinc-700
                                        text-zinc-400 rounded
                                        hover:bg-zinc-700/50 hover:text-white
                                        transition-colors
                                        disabled:opacity-50
                                    "
                                >
                                    {example.slice(0, 35)}...
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Generate Button */}
                    <button
                        onClick={handleGenerate}
                        disabled={isGenerating || !prompt.trim()}
                        className={`
                            w-full flex items-center justify-center gap-2
                            py-3 rounded-lg font-medium text-sm
                            transition-all duration-200
                            ${isGenerating
                                ? 'bg-purple-600/20 text-purple-300 cursor-wait'
                                : 'bg-gradient-to-r from-purple-600 to-blue-600 text-white hover:from-purple-500 hover:to-blue-500 shadow-lg shadow-purple-600/20'
                            }
                            disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none
                        `}
                    >
                        {isGenerating ? (
                            <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Gemini is thinking...
                            </>
                        ) : (
                            <>
                                <Zap className="w-4 h-4" />
                                Generate Structure
                            </>
                        )}
                    </button>

                    {/* Error Message */}
                    {error && (
                        <div className="flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                            <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                            <p className="text-xs text-red-400">{error}</p>
                        </div>
                    )}

                    {/* Success Message */}
                    {success && (
                        <div className="flex items-start gap-2 p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
                            <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />
                            <p className="text-xs text-green-400">{success}</p>
                        </div>
                    )}
                </div>
            )}

            {/* Main Content - Modify Tab (1000x Enhanced AI) */}
            {activeTab === 'modify' && (
                <div className="flex-1 p-3 space-y-3 overflow-y-auto">
                    {/* Model Status */}
                    <div className={`flex items-center gap-2 p-2 rounded-lg ${nodes.size > 0 ? 'bg-green-500/10 border border-green-500/30' : 'bg-yellow-500/10 border border-yellow-500/30'}`}>
                        <Settings2 className={`w-4 h-4 ${nodes.size > 0 ? 'text-green-400' : 'text-yellow-400'}`} />
                        <span className={`text-xs ${nodes.size > 0 ? 'text-green-400' : 'text-yellow-400'}`}>
                            {nodes.size > 0
                                ? `Model: ${nodes.size} nodes, ${members.size} members`
                                : 'No model loaded - Generate one first!'}
                        </span>
                    </div>

                    {/* Command Input */}
                    <div>
                        <label className="block text-xs text-zinc-400 mb-1">
                            Tell me what to change
                        </label>
                        <textarea
                            value={modifyCommand}
                            onChange={(e) => setModifyCommand(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSmartModify()}
                            placeholder="e.g., Change columns to ISMB400, Add support at N3..."
                            disabled={isModifying || nodes.size === 0}
                            className="
                                w-full h-20 px-3 py-2
                                bg-zinc-800 border border-zinc-700 rounded-lg
                                text-sm text-zinc-200 placeholder-zinc-600
                                focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500
                                resize-none
                                disabled:opacity-50 disabled:cursor-not-allowed
                            "
                        />
                    </div>

                    {/* Quick Modify Examples */}
                    <div>
                        <label className="block text-xs text-zinc-400 mb-1.5 flex items-center gap-1">
                            <Lightbulb className="w-3 h-3" />
                            Quick commands
                        </label>
                        <div className="flex flex-wrap gap-1.5">
                            {MODIFY_EXAMPLES.slice(0, 4).map((example, i) => (
                                <button
                                    key={i}
                                    onClick={() => setModifyCommand(example)}
                                    disabled={isModifying || nodes.size === 0}
                                    className="
                                        px-2 py-1 text-[10px]
                                        bg-zinc-800/50 border border-zinc-700
                                        text-zinc-400 rounded
                                        hover:bg-green-600/20 hover:border-green-600/50 hover:text-green-300
                                        transition-colors
                                        disabled:opacity-50
                                    "
                                >
                                    {example}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Apply Button */}
                    <button
                        onClick={handleSmartModify}
                        disabled={isModifying || !modifyCommand.trim() || nodes.size === 0}
                        className={`
                            w-full flex items-center justify-center gap-2
                            py-3 rounded-lg font-medium text-sm
                            transition-all duration-200
                            ${isModifying
                                ? 'bg-green-600/20 text-green-300 cursor-wait'
                                : 'bg-gradient-to-r from-green-600 to-emerald-600 text-white hover:from-green-500 hover:to-emerald-500 shadow-lg shadow-green-600/20'
                            }
                            disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none
                        `}
                    >
                        {isModifying ? (
                            <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                AI is modifying...
                            </>
                        ) : (
                            <>
                                <Edit3 className="w-4 h-4" />
                                Apply Changes
                            </>
                        )}
                    </button>

                    {/* Error Message */}
                    {error && activeTab === 'modify' && (
                        <div className="flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                            <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                            <p className="text-xs text-red-400 whitespace-pre-line">{error}</p>
                        </div>
                    )}

                    {/* Success Message */}
                    {success && activeTab === 'modify' && (
                        <div className="flex items-start gap-2 p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
                            <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />
                            <p className="text-xs text-green-400">{success}</p>
                        </div>
                    )}

                    {/* Modification History */}
                    {modifyHistory.length > 0 && (
                        <div className="mt-2">
                            <label className="block text-xs text-zinc-400 mb-1.5">Recent changes</label>
                            <div className="space-y-1 max-h-32 overflow-y-auto">
                                {modifyHistory.slice(-5).reverse().map((item, i) => (
                                    <div
                                        key={i}
                                        className={`text-[10px] p-1.5 rounded ${item.success
                                            ? 'bg-green-500/10 text-green-400'
                                            : 'bg-red-500/10 text-red-400'
                                            }`}
                                    >
                                        <span className="font-medium">{item.command}</span>
                                        <span className="opacity-70"> → {item.result}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Main Content - Chat Tab */}
            {activeTab === 'chat' && (
                <div className="flex-1 flex flex-col overflow-hidden">
                    {/* Chat Messages */}
                    <div className="flex-1 overflow-y-auto p-3 space-y-3">
                        {chatMessages.length === 0 ? (
                            <div className="text-center py-8">
                                <Bot className="w-10 h-10 text-zinc-500 mx-auto mb-3" />
                                <p className="text-sm text-zinc-400 mb-4">
                                    Ask me anything about structural engineering!
                                </p>
                                <div className="flex flex-wrap gap-1.5 justify-center">
                                    {CHAT_SUGGESTIONS.map((suggestion, i) => (
                                        <button
                                            key={i}
                                            onClick={() => handleChatSuggestion(suggestion)}
                                            className="px-2 py-1 text-[10px] bg-zinc-800/50 border border-zinc-700 text-zinc-400 rounded hover:bg-zinc-700/50 hover:text-white transition-colors"
                                        >
                                            {suggestion}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        ) : (
                            chatMessages.map((msg, i) => (
                                <div
                                    key={i}
                                    className={`flex gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                                >
                                    {msg.role === 'assistant' && (
                                        <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center flex-shrink-0">
                                            <Bot className="w-3.5 h-3.5 text-blue-400" />
                                        </div>
                                    )}
                                    <div
                                        className={`max-w-[80%] px-3 py-2 rounded-lg text-xs ${msg.role === 'user'
                                            ? 'bg-purple-600 text-white'
                                            : 'bg-zinc-800 text-zinc-200 border border-zinc-700'
                                            }`}
                                    >
                                        {msg.content}
                                    </div>
                                    {msg.role === 'user' && (
                                        <div className="w-6 h-6 rounded-full bg-purple-600/20 flex items-center justify-center flex-shrink-0">
                                            <User className="w-3.5 h-3.5 text-purple-400" />
                                        </div>
                                    )}
                                </div>
                            ))
                        )}
                        {isChatting && (
                            <div className="flex gap-2 justify-start">
                                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center flex-shrink-0">
                                    <Bot className="w-3.5 h-3.5 text-blue-400" />
                                </div>
                                <div className="px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700">
                                    <Loader2 className="w-4 h-4 text-zinc-400 animate-spin" />
                                </div>
                            </div>
                        )}
                        <div ref={chatEndRef} />
                    </div>

                    {/* Chat Input */}
                    <div className="p-3 border-t border-zinc-800">
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={chatInput}
                                onChange={(e) => setChatInput(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleChat()}
                                placeholder="Ask about structural engineering..."
                                disabled={isChatting}
                                className="flex-1 px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-200 placeholder-zinc-600 focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500 disabled:opacity-50"
                            />
                            <button
                                onClick={handleChat}
                                disabled={isChatting || !chatInput.trim()}
                                className="p-2 bg-gradient-to-r from-purple-600 to-blue-600 rounded-lg text-white hover:from-purple-500 hover:to-blue-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <Send className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Footer */}
            <div className="px-3 py-2 border-t border-zinc-800">
                <p className="text-[10px] text-zinc-500 text-center flex items-center justify-center gap-1">
                    {aiStatus?.gemini_configured ? (
                        <>
                            <span className="w-1.5 h-1.5 bg-green-400 rounded-full" />
                            Gemini AI Connected
                        </>
                    ) : (
                        <>
                            <span className="w-1.5 h-1.5 bg-yellow-400 rounded-full" />
                            Demo Mode · Add GEMINI_API_KEY for full AI
                        </>
                    )}
                </p>
            </div>
        </div>
    );
};

export default AIArchitectPanel;
