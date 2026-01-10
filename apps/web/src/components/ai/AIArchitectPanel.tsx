/**
 * AIArchitectPanel.tsx - AI-Powered Structure Generation
 * 
 * Allows users to describe a structure in natural language
 * and generates it using the Python AI backend with Google Gemini.
 * 
 * V2.0: 1000x Enhanced with smart model modifications
 */

import { FC, useState, useCallback, useEffect, useRef } from 'react';
import { Sparkles, Loader2, AlertCircle, CheckCircle, Zap, MessageCircle, Send, Bot, User, Wand2, Edit3, Settings2, Lightbulb } from 'lucide-react';
import { useModelStore } from '../../store/model';
import { aiLogger } from '../../utils/logger';

// ============================================
// CONFIGURATION
// ============================================

const PYTHON_API = import.meta.env['VITE_PYTHON_API_URL'] || "http://localhost:8081";

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
    "Create a 12m span bridge truss with 6 panels",
    "Design a 3-story building frame, 5m bays",
    "Generate a 20m warehouse portal frame",
    "Make a simple beam, 8m span with fixed supports"
];

// Modification examples for smart modify
const MODIFY_EXAMPLES = [
    "Change columns to ISMB400",
    "Add fixed support at N1",
    "Remove member M5",
    "Set span to 15m",
    "Add a new story on top",
    "Make beams heavier"
];

const CHAT_SUGGESTIONS = [
    "What is a Pratt truss?",
    "Explain moment of inertia",
    "How to reduce deflection?",
    "IS 800 steel design basics"
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
    
    // Modify state
    const [modifyCommand, setModifyCommand] = useState('');
    const [isModifying, setIsModifying] = useState(false);
    const [modifyHistory, setModifyHistory] = useState<{command: string; result: string; success: boolean}[]>([]);

    // Store actions
    const clearModel = useModelStore((state) => state.clearModel);
    const addNode = useModelStore((state) => state.addNode);
    const addMember = useModelStore((state) => state.addMember);
    const updateNode = useModelStore((state) => state.updateNode);
    const updateMember = useModelStore((state) => state.updateMember);
    const removeNode = useModelStore((state) => state.removeNode);
    const removeMember = useModelStore((state) => state.removeMember);
    const nodes = useModelStore((state) => state.nodes);
    const members = useModelStore((state) => state.members);

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
    // SMART MODIFY HANDLER
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
            }

        } catch (err) {
            console.error("[AI Brain] Error:", err);
            setError(err instanceof Error ? err.message : 'Connection error');
        } finally {
            setIsModifying(false);
        }
    }, [modifyCommand, nodes.size, getModelForAPI, applyModelChanges]);

    // ========================================
    // GENERATE HANDLER
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

        console.log("[AIArchitect] Sending prompt:", prompt);

        try {
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
                // Handle backend error with details
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

            // Add nodes
            for (const node of data.model.nodes) {
                addNode({
                    id: node.id,
                    x: node.x,
                    y: node.y,
                    z: node.z || 0
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

            const modelName = data.model.metadata?.['name'] || 'AI Generated';
            setSuccess(`✓ Generated "${modelName}" (${data.model.nodes.length} nodes, ${data.model.members.length} members)`);
            setPrompt('');

        } catch (err) {
            console.error("[AIArchitect] Error:", err);

            // Check for network/connection errors
            if (err instanceof TypeError && err.message.includes('fetch')) {
                setError('Cannot connect to Python Server. Is it running on port 8081?');
            } else {
                setError(err instanceof Error ? err.message : 'Unknown error occurred');
            }
        } finally {
            setIsGenerating(false);
        }
    }, [prompt, clearModel, addNode, addMember]);

    // ========================================
    // CHAT HANDLER
    // ========================================
    const handleChat = useCallback(async () => {
        if (!chatInput.trim()) return;

        const userMessage: ChatMessage = {
            role: 'user',
            content: chatInput,
            timestamp: new Date()
        };

        setChatMessages(prev => [...prev, userMessage]);
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

            const assistantMessage: ChatMessage = {
                role: 'assistant',
                content: data.success ? data.response : 'Sorry, I encountered an error. Please try again.',
                timestamp: new Date()
            };

            setChatMessages(prev => [...prev, assistantMessage]);

        } catch (err) {
            const errorMessage: ChatMessage = {
                role: 'assistant',
                content: 'Unable to connect to the AI service. Please check if the backend is running.',
                timestamp: new Date()
            };
            setChatMessages(prev => [...prev, errorMessage]);
        } finally {
            setIsChatting(false);
        }
    }, [chatInput, chatMessages, nodes.size, members.size]);

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
                            <p className="text-[10px] text-zinc-500 flex items-center gap-1">
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
                        <label className="block text-xs text-zinc-500 mb-1">
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
                        <label className="block text-xs text-zinc-500 mb-1.5">
                            Try an example
                        </label>
                        <div className="flex flex-wrap gap-1.5">
                            {EXAMPLE_PROMPTS.slice(0, 3).map((example, i) => (
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
                                    {example.slice(0, 25)}...
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
                        <label className="block text-xs text-zinc-500 mb-1">
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
                        <label className="block text-xs text-zinc-500 mb-1.5 flex items-center gap-1">
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
                            <label className="block text-xs text-zinc-500 mb-1.5">Recent changes</label>
                            <div className="space-y-1 max-h-32 overflow-y-auto">
                                {modifyHistory.slice(-5).reverse().map((item, i) => (
                                    <div 
                                        key={i} 
                                        className={`text-[10px] p-1.5 rounded ${
                                            item.success 
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
                                <Bot className="w-10 h-10 text-zinc-600 mx-auto mb-3" />
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
                <p className="text-[10px] text-zinc-600 text-center flex items-center justify-center gap-1">
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
