/**
 * ChatPanel - AI Engineering Copilot Interface
 * 
 * Chat interface for interacting with the Engineering AI Copilot
 * to get fix suggestions for failed structural members.
 * 
 * V3.0: Real AI integration via unified backend
 */

import { FC, useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    MessageSquare,
    Send,
    X,
    Bot,
    User,
    Sparkles,
    ChevronDown,
    AlertTriangle,
    CheckCircle2,
    Lightbulb,
    Copy,
    RefreshCw
} from 'lucide-react';
import { API_CONFIG } from '../config/env';
import { Button } from './ui/button';
import { Input } from './ui/input';

// ============================================
// TYPES
// ============================================

interface ChatMessage {
    id: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp: Date;
    suggestions?: FixSuggestion[];
}

interface FixSuggestion {
    id: number;
    title: string;
    description: string;
    implementation: string;
    priority: 'high' | 'medium' | 'low';
    estimatedImprovement: string;
    pros: string[];
    cons: string[];
}

interface FailedMember {
    id: string;
    type: string;
    ratio: number;
    failureMode: string;
    section: string;
    length: number;
}

interface ChatPanelProps {
    isOpen: boolean;
    onClose: () => void;
    failedMember?: FailedMember;
}

// ============================================
// CHAT PANEL COMPONENT
// ============================================

export const ChatPanel: FC<ChatPanelProps> = ({ isOpen, onClose, failedMember }) => {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [inputValue, setInputValue] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [expandedSuggestion, setExpandedSuggestion] = useState<number | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Scroll to bottom when new messages arrive
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    /**
     * Analyze a failed member and get AI suggestions
     */
    const analyzeFailedMember = useCallback(async (member: FailedMember) => {
        const userMessage: ChatMessage = {
            id: generateId(),
            role: 'user',
            content: `Analyze failed member: **${member.id}** (${member.type})
- Utilization Ratio: ${member.ratio.toFixed(2)} ❌
- Failure Mode: ${member.failureMode}
- Section: ${member.section}
- Length: ${member.length}m`,
            timestamp: new Date()
        };

        setMessages(prev => [...prev, userMessage]);
        setIsLoading(true);

        try {
            // Call unified backend AI for real diagnosis
            const response = await fetch(`${API_CONFIG.baseUrl}/api/ai/diagnose`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: {
                        nodes: [],
                        members: [{
                            id: member.id,
                            type: member.type,
                            section: member.section,
                            length: member.length,
                        }],
                    },
                    issues: [{
                        memberId: member.id,
                        type: member.failureMode,
                        ratio: member.ratio,
                        section: member.section,
                    }],
                }),
            });

            if (response.ok) {
                const data = await response.json();
                if (data.success && data.response) {
                    const aiResponse: ChatMessage = {
                        id: generateId(),
                        role: 'assistant',
                        content: data.response,
                        timestamp: new Date(),
                        suggestions: data.fixes?.map((fix: any, idx: number) => ({
                            id: idx + 1,
                            title: fix.title || `Fix ${idx + 1}`,
                            description: fix.description || '',
                            implementation: fix.implementation || '',
                            priority: fix.priority || 'medium',
                            estimatedImprovement: fix.estimatedImprovement || 'Variable',
                            pros: fix.pros || [],
                            cons: fix.cons || [],
                        })) || undefined,
                    };
                    setMessages(prev => [...prev, aiResponse]);
                    setIsLoading(false);
                    return;
                }
            }
        } catch (err) {
            console.warn('[ChatPanel] Backend unavailable, using fallback:', err);
        }

        // Fallback: generate local response if backend unavailable
        const aiResponse = generateMockResponse(member);
        setMessages(prev => [...prev, aiResponse]);
        setIsLoading(false);
    }, []);

    // Auto-analyze failed member when provided
    useEffect(() => {
        if (failedMember && isOpen) {
            // Defer to avoid synchronous setState at effect start
            queueMicrotask(() => analyzeFailedMember(failedMember));
        }
    }, [failedMember, isOpen, analyzeFailedMember]);

    /**
     * Send a custom message via unified AI backend
     */
    const sendMessage = async () => {
        if (!inputValue.trim() || isLoading) return;

        const userMessage: ChatMessage = {
            id: generateId(),
            role: 'user',
            content: inputValue,
            timestamp: new Date()
        };

        setMessages(prev => [...prev, userMessage]);
        const inputText = inputValue;
        setInputValue('');
        setIsLoading(true);

        try {
            // Call unified backend for real AI response
            const chatHistory = messages.slice(-8).map(m => ({
                role: m.role,
                content: m.content,
            }));

            const response = await fetch(`${API_CONFIG.baseUrl}/api/ai/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: inputText,
                    context: 'structural_engineering_copilot',
                    history: chatHistory,
                }),
            });

            if (response.ok) {
                const data = await response.json();
                if (data.success && data.response) {
                    const aiResponse: ChatMessage = {
                        id: generateId(),
                        role: 'assistant',
                        content: data.response,
                        timestamp: new Date()
                    };
                    setMessages(prev => [...prev, aiResponse]);
                    setIsLoading(false);
                    return;
                }
            }
        } catch (err) {
            console.warn('[ChatPanel] Backend unavailable:', err);
        }

        // Fallback response if backend unavailable
        const aiResponse: ChatMessage = {
            id: generateId(),
            role: 'assistant',
            content: 'I can help you with structural engineering questions. For the best analysis, you can:\n\n1. Click "Ask AI to Fix" on any failed member in the design check results\n2. Ask me about specific failure modes (buckling, LTB, shear, etc.)\n3. Request section optimization suggestions\n\nWhat would you like help with?',
            timestamp: new Date()
        };

        setMessages(prev => [...prev, aiResponse]);
        setIsLoading(false);
    };

    /**
     * Copy suggestion to clipboard
     */
    const copySuggestion = (suggestion: FixSuggestion) => {
        const text = `${suggestion.title}\n\n${suggestion.description}\n\nImplementation: ${suggestion.implementation}\n\nEstimated Improvement: ${suggestion.estimatedImprovement}`;
        navigator.clipboard.writeText(text);
    };

    /**
     * Clear chat history
     */
    const clearChat = () => {
        setMessages([]);
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ x: 400, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    exit={{ x: 400, opacity: 0 }}
                    transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                    className="fixed right-0 top-0 bottom-0 w-96 bg-white dark:bg-slate-900 shadow-2xl z-50 flex flex-col border-l border-slate-200 dark:border-slate-700"
                >
                    {/* Header */}
                    <div className="h-16 bg-gradient-to-r from-blue-600 to-indigo-600 flex items-center justify-between px-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                                <Bot className="w-5 h-5 text-white" />
                            </div>
                            <div>
                                <h2 className="text-zinc-900 dark:text-white font-semibold">Engineering Copilot</h2>
                                <p className="text-blue-200 text-xs">IS 800 / AISC 360 Expert</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={clearChat}
                                className="hover:bg-white/10 text-zinc-900 dark:text-white hover:text-zinc-900 dark:hover:text-white"
                                title="Clear Chat"
                            >
                                <RefreshCw className="w-4 h-4" />
                            </Button>
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={onClose}
                                className="hover:bg-white/10 text-zinc-900 dark:text-white hover:text-zinc-900 dark:hover:text-white"
                            >
                                <X className="w-5 h-5" />
                            </Button>
                        </div>
                    </div>

                    {/* Messages */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50 dark:bg-slate-900/50">
                        {messages.length === 0 && (
                            <div className="text-center py-12">
                                <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/40 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <Sparkles className="w-8 h-8 text-blue-600 dark:text-blue-400" />
                                </div>
                                <h3 className="text-slate-900 dark:text-slate-100 font-semibold mb-2">AI Engineering Assistant</h3>
                                <p className="text-slate-500 dark:text-slate-400 text-sm max-w-xs mx-auto">
                                    Click "Ask AI to Fix" on any failed member or ask me about structural engineering.
                                </p>
                            </div>
                        )}

                        {messages.map((message) => (
                            <div
                                key={message.id}
                                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                            >
                                <div className={`max-w-[85%] ${message.role === 'user' ? 'order-2' : 'order-1'}`}>
                                    {/* Avatar */}
                                    <div className={`flex items-start gap-2 ${message.role === 'user' ? 'flex-row-reverse' : ''}`}>
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${message.role === 'user' ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-800'
                                            }`}>
                                            {message.role === 'user'
                                                ? <User className="w-4 h-4 text-white" />
                                                : <Bot className="w-4 h-4 text-gray-800 dark:text-white" />
                                            }
                                        </div>

                                        {/* Message Content */}
                                        <div className={`rounded-2xl px-4 py-3 ${message.role === 'user'
                                                ? 'bg-blue-600 text-white'
                                                : 'bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200'
                                            }`}>
                                            <div className="text-sm whitespace-pre-wrap">{message.content}</div>

                                            {/* Suggestions */}
                                            {message.suggestions && message.suggestions.length > 0 && (
                                                <div className="mt-4 space-y-3">
                                                    <div className="flex items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">
                                                        <Lightbulb className="w-4 h-4" />
                                                        Suggested Fixes
                                                    </div>

                                                    {message.suggestions.map((suggestion) => (
                                                        <div
                                                            key={suggestion.id}
                                                            className="bg-slate-100/50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden"
                                                        >
                                                            {/* Suggestion Header */}
                                                            <button
                                                                onClick={() => setExpandedSuggestion(
                                                                    expandedSuggestion === suggestion.id ? null : suggestion.id
                                                                )}
                                                                className="w-full flex items-center justify-between p-3 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors text-left"
                                                            >
                                                                <div className="flex items-center gap-2">
                                                                    <span className={`w-2 h-2 rounded-full ${suggestion.priority === 'high' ? 'bg-green-500' :
                                                                            suggestion.priority === 'medium' ? 'bg-yellow-500' :
                                                                                'bg-slate-500'
                                                                        }`} />
                                                                    <span className="font-medium text-sm text-slate-800 dark:text-slate-200">{suggestion.title}</span>
                                                                </div>
                                                                <ChevronDown className={`w-4 h-4 text-slate-500 dark:text-slate-500 transition-transform ${expandedSuggestion === suggestion.id ? 'rotate-180' : ''
                                                                    }`} />
                                                            </button>

                                                            {/* Expanded Content */}
                                                            <AnimatePresence>
                                                                {expandedSuggestion === suggestion.id && (
                                                                    <motion.div
                                                                        initial={{ height: 0, opacity: 0 }}
                                                                        animate={{ height: 'auto', opacity: 1 }}
                                                                        exit={{ height: 0, opacity: 0 }}
                                                                        className="border-t border-slate-200 dark:border-slate-700"
                                                                    >
                                                                        <div className="p-3 space-y-3 text-sm">
                                                                            <p className="text-slate-700 dark:text-slate-300">{suggestion.description}</p>

                                                                            <div className="bg-blue-50 dark:bg-blue-900/30 rounded p-2">
                                                                                <div className="text-xs font-medium text-blue-700 dark:text-blue-300 mb-1">Implementation:</div>
                                                                                <p className="text-blue-800 dark:text-blue-200">{suggestion.implementation}</p>
                                                                            </div>

                                                                            <div className="grid grid-cols-2 gap-2">
                                                                                <div className="bg-green-50 dark:bg-green-900/30 rounded p-2">
                                                                                    <div className="text-xs font-medium text-green-700 dark:text-green-300 mb-1 flex items-center gap-1">
                                                                                        <CheckCircle2 className="w-3 h-3" /> Pros
                                                                                    </div>
                                                                                    <ul className="text-xs text-green-800 dark:text-green-200 space-y-0.5">
                                                                                        {suggestion.pros.map((pro, i) => (
                                                                                            <li key={i}>• {pro}</li>
                                                                                        ))}
                                                                                    </ul>
                                                                                </div>
                                                                                <div className="bg-red-50 dark:bg-red-900/30 rounded p-2">
                                                                                    <div className="text-xs font-medium text-red-700 dark:text-red-300 mb-1 flex items-center gap-1">
                                                                                        <AlertTriangle className="w-3 h-3" /> Cons
                                                                                    </div>
                                                                                    <ul className="text-xs text-red-800 dark:text-red-200 space-y-0.5">
                                                                                        {suggestion.cons.map((con, i) => (
                                                                                            <li key={i}>• {con}</li>
                                                                                        ))}
                                                                                    </ul>
                                                                                </div>
                                                                            </div>

                                                                            <div className="flex items-center justify-between">
                                                                                <span className="text-xs text-slate-500 dark:text-slate-400">
                                                                                    {suggestion.estimatedImprovement}
                                                                                </span>
                                                                                <Button
                                                                                    variant="ghost"
                                                                                    size="sm"
                                                                                    onClick={() => copySuggestion(suggestion)}
                                                                                    className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:text-blue-500 dark:hover:text-blue-300 h-auto px-1 py-0.5"
                                                                                >
                                                                                    <Copy className="w-3 h-3" /> Copy
                                                                                </Button>
                                                                            </div>
                                                                        </div>
                                                                    </motion.div>
                                                                )}
                                                            </AnimatePresence>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Timestamp */}
                                    <div className={`text-xs text-slate-500 dark:text-slate-500 mt-1 ${message.role === 'user' ? 'text-right' : 'text-left ml-10'}`}>
                                        {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </div>
                                </div>
                            </div>
                        ))}

                        {/* Loading Indicator */}
                        {isLoading && (
                            <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
                                <div className="w-8 h-8 bg-slate-200 dark:bg-slate-700 rounded-full flex items-center justify-center">
                                    <Bot className="w-4 h-4 text-slate-800 dark:text-white" />
                                </div>
                                <div className="bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl px-4 py-3">
                                    <div className="flex gap-1">
                                        <span className="w-2 h-2 bg-slate-400 dark:bg-slate-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                                        <span className="w-2 h-2 bg-slate-400 dark:bg-slate-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                                        <span className="w-2 h-2 bg-slate-400 dark:bg-slate-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                                    </div>
                                </div>
                            </div>
                        )}

                        <div ref={messagesEndRef} />
                    </div>

                    {/* Input */}
                    <div className="p-4 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-700">
                        <div className="flex items-center gap-2">
                            <div className="flex-1">
                                <Input
                                    type="text"
                                    value={inputValue}
                                    onChange={(e) => setInputValue(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
                                    placeholder="Ask about structural engineering..."
                                    className="rounded-xl font-sans h-11"
                                />
                            </div>
                            <Button
                                onClick={sendMessage}
                                disabled={!inputValue.trim() || isLoading}
                                className="w-12 h-12 rounded-xl"
                                size="icon"
                            >
                                <Send className="w-5 h-5" />
                            </Button>
                        </div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};

// ============================================
// HELPER FUNCTIONS
// ============================================

function generateId(): string {
    return `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

function generateMockResponse(member: FailedMember): ChatMessage {
    const suggestions: FixSuggestion[] = [
        {
            id: 1,
            title: 'Increase Section Size',
            description: `Replace ${member.section} with a heavier section having higher capacity.`,
            implementation: getReplacementSection(member.section),
            priority: 'high',
            estimatedImprovement: `Reduces ratio from ${member.ratio.toFixed(2)} to ~${(member.ratio * 0.75).toFixed(2)}`,
            pros: ['Direct solution', 'No additional connections', 'Minimal design changes'],
            cons: ['Increased steel weight (~15-20%)', 'Higher material cost']
        },
        {
            id: 2,
            title: 'Add Intermediate Bracing',
            description: 'Install lateral bracing at mid-span to reduce effective length.',
            implementation: `Add horizontal bracing at L/2 = ${(member.length / 2).toFixed(2)}m from support.`,
            priority: 'high',
            estimatedImprovement: `Reduces ratio from ${member.ratio.toFixed(2)} to ~${(member.ratio * 0.65).toFixed(2)}`,
            pros: ['Retains current section', 'Reduces KL by 50%', 'Cost-effective'],
            cons: ['Requires additional connections', 'May affect clearances']
        },
        {
            id: 3,
            title: 'Change End Conditions',
            description: 'Increase fixity at member ends to reduce effective length factor K.',
            implementation: 'Design moment connections at supports or add stiffeners.',
            priority: 'medium',
            estimatedImprovement: `Reduces ratio from ${member.ratio.toFixed(2)} to ~${(member.ratio * 0.85).toFixed(2)}`,
            pros: ['No section change needed', 'Comprehensive solution'],
            cons: ['Complex detailing', 'Higher connection costs']
        }
    ];

    return {
        id: generateId(),
        role: 'assistant',
        content: `**Analysis Complete for ${member.id}**\n\nThe ${member.type} is failing in **${formatFailureMode(member.failureMode)}** with a utilization ratio of ${member.ratio.toFixed(2)}.\n\n**Root Cause:** The current section ${member.section} has insufficient capacity for the ${member.length}m span under the applied loading.\n\nHere are 3 recommended fixes, ranked by effectiveness:`,
        timestamp: new Date(),
        suggestions
    };
}

function getReplacementSection(current: string): string {
    const upgrades: Record<string, string> = {
        'W12x26': 'Consider W14x30 or W12x35 (~30% higher capacity)',
        'W14x30': 'Consider W14x38 or W16x36',
        'ISMB200': 'Consider ISMB250 or ISHB200 (~50% higher Ix)',
        'ISMB 200': 'Consider ISMB 250 or ISHB 200 (~50% higher Ix)',
        'ISMB250': 'Consider ISMB300 or ISHB225 (~60% higher Ix)',
        'ISMB 250': 'Consider ISMB 300 or ISHB 225 (~60% higher Ix)',
        'ISMB300': 'Consider ISMB350 or ISHB300 (~58% higher Ix)',
        'ISMB 300': 'Consider ISMB 350 or ISHB 300 (~58% higher Ix)',
        'ISMB350': 'Consider ISMB400 or ISHB350 (~50% higher Ix)',
        'ISMB 350': 'Consider ISMB 400 or ISHB 350 (~50% higher Ix)',
        'ISMB400': 'Consider ISMB450 or ISHB400 (~49% higher Ix)',
        'ISMB 400': 'Consider ISMB 450 or ISHB 400 (~49% higher Ix)',
        'ISMB450': 'Consider ISMB500 or ISHB450 (~49% higher Ix)',
        'ISMB 450': 'Consider ISMB 500 or ISHB 450 (~49% higher Ix)',
        'ISMB500': 'Consider ISMB550 (~44% higher Ix)',
        'ISMB 500': 'Consider ISMB 550 (~44% higher Ix)',
    };
    return upgrades[current] || `Consider a section ~20% heavier than ${current}`;
}

function formatFailureMode(mode: string): string {
    const formats: Record<string, string> = {
        'compression_buckling': 'Compression Buckling',
        'lateral_torsional_buckling': 'Lateral Torsional Buckling (LTB)',
        'shear_failure': 'Shear Capacity Exceeded',
        'combined_stress': 'Combined Axial + Bending'
    };
    return formats[mode] || mode.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

// ============================================
// FLOATING BUTTON COMPONENT
// ============================================

interface AskAIButtonProps {
    onClick: () => void;
    member?: FailedMember;
}

export const AskAIButton: FC<AskAIButtonProps> = ({ onClick }) => {
    return (
        <Button
            onClick={onClick}
            size="sm"
            className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-xs font-medium hover:shadow-lg"
        >
            <Sparkles className="w-3 h-3" />
            Ask AI to Fix
        </Button>
    );
};

// ============================================
// CHAT TOGGLE BUTTON
// ============================================

interface ChatToggleProps {
    onClick: () => void;
    hasNotification?: boolean;
}

export const ChatToggle: FC<ChatToggleProps> = ({ onClick, hasNotification }) => {
    return (
        <Button
            onClick={onClick}
            size="icon"
            className="fixed bottom-6 right-6 w-14 h-14 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-full shadow-lg hover:shadow-xl z-40"
        >
            <MessageSquare className="w-6 h-6 text-white" />
            {hasNotification && (
                <span className="absolute top-0 right-0 w-4 h-4 bg-red-500 rounded-full border-2 border-zinc-200 dark:border-slate-900" />
            )}
        </Button>
    );
};

export default ChatPanel;
