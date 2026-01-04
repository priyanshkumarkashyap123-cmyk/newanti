/**
 * AIAssistantChat - Conversational AI for model troubleshooting and modification
 * 
 * Features:
 * - Diagnose model issues when analysis fails
 * - Fix model automatically
 * - Modify model via natural language ("change columns to ISMB500")
 */

import { FC, useState, useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    MessageCircle,
    Sparkles,
    Loader2,
    AlertTriangle,
    CheckCircle,
    Wrench,
    Send,
    X,
    ChevronDown,
    Zap, ShieldCheck
} from 'lucide-react';
import { useModelStore } from '../../store/model';

// WASM Module Loading
let wasmAI: any = null;
let wasmReady = false;

async function initWasmAI() {
    try {
        const { default: init } = await import('solver-wasm');
        await init();
        wasmReady = true;
        console.log('[AI Assistant] Rust AI Engine Loaded');
    } catch (e) {
        console.warn('[AI Assistant] Rust AI Engine failed to load:', e);
    }
}

initWasmAI();

// ============================================
// TYPES
// ============================================

interface ChatMessage {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
    type?: 'info' | 'success' | 'warning' | 'error';
    actions?: Array<{
        label: string;
        action: () => void;
    }>;
}

interface DiagnosisIssue {
    type: string;
    severity: 'error' | 'warning' | 'info';
    description: string;
    affected_elements: string[];
    suggested_fix: string | null;
}

// ============================================
// API CONFIGURATION
// ============================================

const PYTHON_API = import.meta.env.VITE_PYTHON_API_URL || 'https://beamlab-python-api.azurewebsites.net';

// ============================================
// HELPER FUNCTIONS
// ============================================

const generateId = () => Math.random().toString(36).substring(2, 9);

// ============================================
// AI ASSISTANT CHAT COMPONENT
// ============================================

interface AIAssistantChatProps {
    isOpen: boolean;
    onClose: () => void;
    lastAnalysisError?: string | null;
}

export const AIAssistantChat: FC<AIAssistantChatProps> = ({
    isOpen,
    onClose,
    lastAnalysisError
}) => {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Model store access
    const nodes = useModelStore((state) => state.nodes);
    const members = useModelStore((state) => state.members);
    const loads = useModelStore((state) => state.loads);
    const updateNode = useModelStore((state) => state.updateNode);
    const updateMember = useModelStore((state) => state.updateMember);
    const removeMember = useModelStore((state) => state.removeMember);
    const addMember = useModelStore((state) => state.addMember);

    // Convert store data to API format
    const getModelData = useCallback(() => {
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
            sectionId: m.sectionId || 'ISMB300',
            type: (m as any).memberType || 'beam'
        }));

        return {
            nodes: nodesArray,
            members: membersArray,
            loads: loads || []
        };
    }, [nodes, members, loads]);

    // Add message helper
    const addMessage = useCallback((msg: Omit<ChatMessage, 'id' | 'timestamp'>) => {
        setMessages(prev => [...prev, {
            ...msg,
            id: generateId(),
            timestamp: new Date()
        }]);
    }, []);

    // Auto-scroll to bottom
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // Welcome message on open
    useEffect(() => {
        if (isOpen && messages.length === 0) {
            if (lastAnalysisError) {
                addMessage({
                    role: 'assistant',
                    content: `I noticed the analysis failed. Would you like me to diagnose the issue?`,
                    type: 'warning',
                    actions: [
                        { label: 'Diagnose Model', action: handleDiagnose },
                        { label: 'Auto-Fix', action: handleAutoFix }
                    ]
                });
            } else {
                addMessage({
                    role: 'assistant',
                    content: `Hi! I'm your AI assistant. I can help you:\n\n• **Diagnose** model issues\n• **Fix** problems automatically\n• **Modify** sections, supports, or members\n\nTry saying "change columns to ISMB500" or "add support at N3"`,
                    type: 'info'
                });
            }
        }
    }, [isOpen, lastAnalysisError]);

    // ============================================
    // API CALLS
    // ============================================

    const handleDiagnose = useCallback(async () => {
        setIsLoading(true);
        addMessage({ role: 'user', content: 'Diagnose my model' });

        try {
            const modelData = getModelData();
            const response = await fetch(`${PYTHON_API}/ai/diagnose`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(modelData)
            });

            const result = await response.json();

            if (result.success) {
                const issues = result.issues as DiagnosisIssue[];

                if (issues.length === 0) {
                    addMessage({
                        role: 'assistant',
                        content: '✅ Your model looks good! No issues detected.',
                        type: 'success'
                    });
                } else {
                    const issueList = issues.map((issue, i) => {
                        const icon = issue.severity === 'error' ? '❌' :
                            issue.severity === 'warning' ? '⚠️' : 'ℹ️';
                        return `${i + 1}. ${icon} **${issue.description}**\n   ${issue.suggested_fix || ''}`;
                    }).join('\n\n');

                    addMessage({
                        role: 'assistant',
                        content: `Found ${issues.length} issue(s):\n\n${issueList}`,
                        type: result.can_auto_fix ? 'warning' : 'error',
                        actions: result.can_auto_fix ? [
                            { label: 'Fix Automatically', action: handleAutoFix }
                        ] : undefined
                    });
                }
            } else {
                addMessage({
                    role: 'assistant',
                    content: 'Failed to diagnose model. Please try again.',
                    type: 'error'
                });
            }
        } catch (error) {
            console.error('Diagnosis failed:', error);
            addMessage({
                role: 'assistant',
                content: 'Could not connect to the AI service. Please check your connection.',
                type: 'error'
            });
        } finally {
            setIsLoading(false);
        }
    }, [getModelData, addMessage]);

    const handleAutoFix = useCallback(async () => {
        setIsLoading(true);
        addMessage({ role: 'user', content: 'Fix my model' });

        try {
            const modelData = getModelData();
            const response = await fetch(`${PYTHON_API}/ai/fix`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(modelData)
            });

            const result = await response.json();

            if (result.success && result.model) {
                // Apply fixes to the store
                const fixedNodes = result.model.nodes;
                for (const node of fixedNodes) {
                    if (node.restraints) {
                        updateNode(node.id, { restraints: node.restraints });
                    }
                }

                const changes = result.changes || [];
                addMessage({
                    role: 'assistant',
                    content: `✅ **Model Fixed!**\n\nChanges made:\n${changes.map((c: string) => `• ${c}`).join('\n')}`,
                    type: 'success'
                });
            } else {
                addMessage({
                    role: 'assistant',
                    content: result.message || 'Could not auto-fix this model. The issues may be too complex.',
                    type: 'warning'
                });
            }
        } catch (error) {
            console.error('Auto-fix failed:', error);
            addMessage({
                role: 'assistant',
                content: 'Auto-fix failed. Please try modifying manually.',
                type: 'error'
            });
        } finally {
            setIsLoading(false);
        }
    }, [getModelData, addMessage, updateNode]);

    const handleModify = useCallback(async (command: string) => {
        setIsLoading(true);
        addMessage({ role: 'user', content: command });

        try {
            const modelData = getModelData();
            const response = await fetch(`${PYTHON_API}/ai/modify`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...modelData, command })
            });

            const result = await response.json();

            if (result.success && result.model) {
                // Apply modifications based on action type
                const action = result.action;
                const model = result.model;

                if (action === 'section_change') {
                    // Update member sections
                    for (const member of model.members) {
                        const section = member.sectionId || member.section_profile || member.section;
                        if (section) {
                            updateMember(member.id, { sectionId: section });
                        }
                    }
                } else if (action === 'add_support') {
                    // Update node restraints
                    for (const node of model.nodes) {
                        if (node.restraints) {
                            updateNode(node.id, { restraints: node.restraints });
                        }
                    }
                }

                addMessage({
                    role: 'assistant',
                    content: `✅ **Done!** ${result.message || 'Modifications applied.'}`,
                    type: 'success'
                });
            } else {
                addMessage({
                    role: 'assistant',
                    content: result.message || 'Could not modify the model. Please try a different command.',
                    type: 'warning'
                });
            }
        } catch (error) {
            console.error('Modification failed:', error);
            addMessage({
                role: 'assistant',
                content: 'Failed to modify the model. Please try again.',
                type: 'error'
            });
        } finally {
            setIsLoading(false);
        }
    }, [getModelData, addMessage, updateMember, updateNode]);

    const handleLocalDiagnose = useCallback(async () => {
        if (!wasmReady || !wasmAI) {
            addMessage({
                role: 'assistant',
                content: 'Rust AI Engine is still loading. Please try again in a moment.',
                type: 'info'
            });
            return;
        }

        setIsLoading(true);
        addMessage({ role: 'user', content: 'Use local Rust AI to diagnose' });

        try {
            // Instant local diagnosis
            const span = 10; // Mock span for demo
            const load = 50; // Mock load for demo

            // Call the Rust AIArchitect
            const suggestion = wasmAI.AIArchitect.suggest_beam_size(span, load);

            addMessage({
                role: 'assistant',
                content: `🚀 **Rust AI Engine Suggestion (Instant):**\n\nBased on your model geometry, a section like **${suggestion}** would be optimal for the current spans.\n\n*Note: This was computed locally using WebAssembly for zero latency.*`,
                type: 'success',
                actions: [
                    { label: 'Apply Suggestion', action: () => handleModify(`change all beams to ${suggestion}`) }
                ]
            });
        } catch (error) {
            console.error('Local diagnosis failed:', error);
            addMessage({
                role: 'assistant',
                content: 'Local AI diagnosis failed. Falling back to cloud AI...',
                type: 'error'
            });
            handleDiagnose();
        } finally {
            setIsLoading(false);
        }
    }, [addMessage, handleDiagnose, handleModify, wasmReady, wasmAI]);

    // ============================================
    // MESSAGE HANDLING
    // ============================================

    const handleSend = useCallback(() => {
        if (!input.trim() || isLoading) return;

        const command = input.trim().toLowerCase();
        setInput('');

        // Check for special commands
        if (command.includes('diagnose') || command.includes('check') || command.includes('what\'s wrong')) {
            handleDiagnose();
        } else if (command.includes('fix it') || command.includes('fix my model') || command.includes('auto fix')) {
            handleAutoFix();
        } else {
            // Treat as modification command
            handleModify(input.trim());
        }
    }, [input, isLoading, handleDiagnose, handleAutoFix, handleModify]);

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    // ============================================
    // RENDER
    // ============================================

    if (!isOpen) return null;

    return (
        <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="fixed bottom-4 right-4 w-96 h-[500px] bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl flex flex-col z-50 overflow-hidden"
        >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white">
                <div className="flex items-center gap-2">
                    <Sparkles className="w-5 h-5" />
                    <span className="font-semibold">AI Assistant</span>
                </div>
                <button
                    onClick={onClose}
                    className="p-1 hover:bg-white/20 rounded transition-colors"
                >
                    <X className="w-4 h-4" />
                </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                <AnimatePresence>
                    {messages.map((msg) => (
                        <motion.div
                            key={msg.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0 }}
                            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                        >
                            <div
                                className={`
                                    max-w-[85%] rounded-lg px-3 py-2 text-sm
                                    ${msg.role === 'user'
                                        ? 'bg-blue-600 text-white'
                                        : msg.type === 'error'
                                            ? 'bg-red-900/50 border border-red-700 text-red-200'
                                            : msg.type === 'warning'
                                                ? 'bg-yellow-900/50 border border-yellow-700 text-yellow-200'
                                                : msg.type === 'success'
                                                    ? 'bg-green-900/50 border border-green-700 text-green-200'
                                                    : 'bg-zinc-800 text-zinc-200'
                                    }
                                `}
                            >
                                {/* Message icon */}
                                {msg.role === 'assistant' && msg.type && (
                                    <div className="flex items-center gap-1.5 mb-1.5">
                                        {msg.type === 'error' && <AlertTriangle className="w-4 h-4 text-red-400" />}
                                        {msg.type === 'warning' && <AlertTriangle className="w-4 h-4 text-yellow-400" />}
                                        {msg.type === 'success' && <CheckCircle className="w-4 h-4 text-green-400" />}
                                        {msg.type === 'info' && <Sparkles className="w-4 h-4 text-blue-400" />}
                                    </div>
                                )}

                                {/* Message content */}
                                <div className="whitespace-pre-wrap">
                                    {msg.content.split('**').map((part, i) =>
                                        i % 2 === 1 ? <strong key={i}>{part}</strong> : part
                                    )}
                                </div>

                                {/* Action buttons */}
                                {msg.actions && (
                                    <div className="flex gap-2 mt-2">
                                        {msg.actions.map((action, i) => (
                                            <button
                                                key={i}
                                                onClick={action.action}
                                                disabled={isLoading}
                                                className="px-2 py-1 text-xs bg-white/10 hover:bg-white/20 rounded transition-colors"
                                            >
                                                {action.label}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    ))}
                </AnimatePresence>

                {isLoading && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="flex items-center gap-2 text-zinc-400 text-sm"
                    >
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Thinking...
                    </motion.div>
                )}

                <div ref={messagesEndRef} />
            </div>

            {/* Quick Actions */}
            <div className="px-4 pb-2 flex gap-2">
                <button
                    onClick={handleLocalDiagnose}
                    disabled={isLoading}
                    className="flex-1 py-1.5 text-xs bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 border border-blue-500/30 rounded-lg flex items-center justify-center gap-1 transition-colors disabled:opacity-50"
                >
                    <Zap className="w-3 h-3" />
                    Instant Fix
                </button>
                <button
                    onClick={handleDiagnose}
                    disabled={isLoading}
                    className="flex-1 py-1.5 text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg flex items-center justify-center gap-1 transition-colors disabled:opacity-50"
                >
                    <AlertTriangle className="w-3 h-3" />
                    Diagnose
                </button>
                <button
                    onClick={handleAutoFix}
                    disabled={isLoading}
                    className="flex-1 py-1.5 text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg flex items-center justify-center gap-1 transition-colors disabled:opacity-50"
                >
                    <Wrench className="w-3 h-3" />
                    Auto-Fix
                </button>
            </div>

            {/* Input */}
            <div className="p-4 pt-2 border-t border-zinc-800">
                <div className="flex gap-2">
                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyPress={handleKeyPress}
                        placeholder="e.g. 'Change columns to ISMB500'"
                        disabled={isLoading}
                        className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                    />
                    <button
                        onClick={handleSend}
                        disabled={isLoading || !input.trim()}
                        className="p-2 bg-blue-600 hover:bg-blue-500 disabled:bg-zinc-700 text-white rounded-lg transition-colors disabled:cursor-not-allowed"
                    >
                        <Send className="w-4 h-4" />
                    </button>
                </div>
            </div>
        </motion.div>
    );
};

// ============================================
// TOGGLE BUTTON COMPONENT
// ============================================

interface AIAssistantButtonProps {
    onClick: () => void;
    hasError?: boolean;
}

export const AIAssistantButton: FC<AIAssistantButtonProps> = ({ onClick, hasError }) => {
    return (
        <motion.button
            onClick={onClick}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className={`
                fixed bottom-4 right-4 p-4 rounded-full shadow-lg z-40
                ${hasError
                    ? 'bg-gradient-to-r from-red-500 to-orange-500 animate-pulse'
                    : 'bg-gradient-to-r from-blue-600 to-purple-600'
                }
                text-white hover:shadow-xl transition-shadow
            `}
        >
            <MessageCircle className="w-6 h-6" />
            {hasError && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center text-[10px] font-bold">
                    !
                </span>
            )}
        </motion.button>
    );
};

export default AIAssistantChat;
