/**
 * MobileAIPanel.tsx
 * 
 * Mobile-Responsive AI Interface
 * 
 * Features:
 * - Touch-optimized controls
 * - Collapsible panels
 * - Voice-first interactions
 * - Gesture support
 * - Offline capability indicators
 */

import React, { useState, useEffect, useRef } from 'react';
import { voiceInput, VoiceCommand } from '../../services/voice/VoiceInputService';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../ui/dialog';

interface MobileAIPanelProps {
    onCommand?: (command: VoiceCommand) => void;
    onQuery?: (query: string) => void;
    isAnalyzing?: boolean;
}

export const MobileAIPanel: React.FC<MobileAIPanelProps> = ({
    onCommand,
    onQuery,
    isAnalyzing = false
}) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const [isListening, setIsListening] = useState(false);
    const [query, setQuery] = useState('');
    const [messages, setMessages] = useState<Array<{ role: 'user' | 'ai'; text: string }>>([]);
    const [isOnline, setIsOnline] = useState(true);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const handleOnline = () => setIsOnline(true);
        const handleOffline = () => setIsOnline(false);

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);
        queueMicrotask(() => {
            setIsOnline(navigator.onLine);
        });

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    useEffect(() => {
        const unsub = voiceInput.onStateChange((state) => {
            queueMicrotask(() => {
                setIsListening(state.isListening);
            });
        });

        const unsubCmd = voiceInput.onCommand((cmd) => {
            queueMicrotask(() => {
                setMessages(prev => [...prev, { role: 'user', text: `🎤 "${cmd.transcript}"` }]);
            });
            onCommand?.(cmd);
        });

        return () => {
            unsub();
            unsubCmd();
        };
    }, [onCommand]);

    const handleSubmit = () => {
        if (!query.trim()) return;

        setMessages(prev => [...prev, { role: 'user', text: query }]);
        onQuery?.(query);
        setQuery('');
    };

    const handleVoiceToggle = () => {
        voiceInput.toggleListening();
    };

    const quickActions = [
        { icon: '📊', label: 'Analyze', action: () => onQuery?.('Run analysis') },
        { icon: '✅', label: 'Check', action: () => onQuery?.('Check design codes') },
        { icon: '⚡', label: 'Optimize', action: () => onQuery?.('Optimize structure') },
        { icon: '📐', label: 'Section', action: () => onQuery?.('Select optimal section') },
    ];

    return (
        <>
            {/* Floating Action Button */}
            <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="fixed bottom-4 right-4 z-50 w-14 h-14 bg-gradient-to-r from-blue-500 to-purple-600 
                   rounded-full shadow-lg flex items-center justify-center text-white
                   active:scale-95 transition-transform touch-manipulation"
                style={{ WebkitTapHighlightColor: 'transparent' }}
            >
                {isExpanded ? (
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                ) : (
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                            d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                        />
                    </svg>
                )}

                {/* Pulse indicator when analyzing */}
                {isAnalyzing && (
                    <span className="absolute inset-0 rounded-full bg-blue-400 animate-ping opacity-50" />
                )}
            </button>

            {/* AI Panel Dialog */}
            <Dialog open={isExpanded} onOpenChange={setIsExpanded}>
                <DialogContent className="max-w-sm sm:max-w-[380px] h-[85vh] p-0 flex flex-col gap-0">
                    <DialogHeader className="p-4 border-b border-zinc-300 dark:border-zinc-700">
                        <div className="flex items-center gap-2">
                            <span className="text-xl">🤖</span>
                            <DialogTitle>AI Assistant</DialogTitle>
                            <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-green-400' : 'bg-red-400'}`} />
                        </div>
                        <DialogDescription>Ask questions, run analysis, or optimize your structure.</DialogDescription>
                    </DialogHeader>

                {/* Quick Actions */}
                <div className="p-3 border-b border-zinc-300 dark:border-zinc-700">
                    <div className="grid grid-cols-4 gap-2">
                        {quickActions.map((action, i) => (
                            <button
                                key={i}
                                onClick={action.action}
                                className="flex flex-col items-center p-2 bg-zinc-100 dark:bg-zinc-800 rounded-lg 
                           active:bg-zinc-200 dark:active:bg-zinc-700 transition-colors touch-manipulation"
                            >
                                <span className="text-2xl mb-1">{action.icon}</span>
                                <span className="text-xs text-zinc-500 dark:text-zinc-400">{action.label}</span>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                    {messages.length === 0 ? (
                        <div className="text-center text-zinc-500 dark:text-zinc-500 py-8">
                            <p>👋 Hi! How can I help?</p>
                            <p className="text-sm mt-2">Tap the mic or type a question</p>
                        </div>
                    ) : (
                        messages.map((msg, i) => (
                            <div
                                key={i}
                                className={`p-3 rounded-lg ${msg.role === 'user'
                                        ? 'bg-blue-600 ml-8 text-white'
                                        : 'bg-zinc-100 dark:bg-zinc-800 mr-8 text-zinc-700 dark:text-zinc-200'
                                    }`}
                            >
                                {msg.text}
                            </div>
                        ))
                    )}

                    {isAnalyzing && (
                        <div className="bg-zinc-100 dark:bg-zinc-800 p-3 rounded-lg mr-8 flex items-center gap-2">
                            <span className="animate-spin">⚙️</span>
                            <span className="text-zinc-500 dark:text-zinc-400">Analyzing...</span>
                        </div>
                    )}
                </div>

                {/* Input Area */}
                <div className="p-3 bg-zinc-100 dark:bg-zinc-800 border-t border-zinc-300 dark:border-zinc-700">
                    <div className="flex items-center gap-2">
                        {/* Voice Button */}
                        <button
                            onClick={handleVoiceToggle}
                            className={`p-3 rounded-full transition-colors touch-manipulation ${isListening
                                    ? 'bg-red-500 text-white animate-pulse'
                                    : 'bg-zinc-200 dark:bg-zinc-700 text-zinc-500 dark:text-zinc-400'
                                }`}
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                    d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
                                />
                            </svg>
                        </button>

                        {/* Text Input */}
                        <input
                            ref={inputRef}
                            type="text"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                            placeholder="Ask anything..."
                            className="flex-1 bg-zinc-200 dark:bg-zinc-700 text-zinc-900 dark:text-white rounded-full px-4 py-2 
                         focus:outline-none focus:ring-2 focus:ring-blue-500
                         text-base"
                            style={{ fontSize: '16px' }}
                        />

                        {/* Send Button */}
                        <button
                            onClick={handleSubmit}
                            className="p-3 bg-blue-500 text-white rounded-full 
                         active:bg-blue-600 transition-colors touch-manipulation"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                    d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                                />
                            </svg>
                        </button>
                    </div>
                </div>
                </DialogContent>
            </Dialog>
        </>
    );
};

/**
 * Mobile-optimized model viewer controls
 */
export const MobileViewerControls: React.FC<{
    onZoomIn?: () => void;
    onZoomOut?: () => void;
    onReset?: () => void;
    onToggleMode?: () => void;
}> = ({ onZoomIn, onZoomOut, onReset, onToggleMode }) => {
    return (
        <div className="fixed left-4 bottom-20 z-40 flex flex-col gap-2">
            <button
                onClick={onZoomIn}
                className="w-12 h-12 bg-zinc-100/90 dark:bg-zinc-800/90 backdrop-blur rounded-lg flex items-center justify-center
                   text-zinc-900 dark:text-white text-xl active:bg-zinc-200 dark:active:bg-zinc-700 touch-manipulation shadow-lg"
            >
                +
            </button>
            <button
                onClick={onZoomOut}
                className="w-12 h-12 bg-zinc-100/90 dark:bg-zinc-800/90 backdrop-blur rounded-lg flex items-center justify-center
                   text-zinc-900 dark:text-white text-xl active:bg-zinc-200 dark:active:bg-zinc-700 touch-manipulation shadow-lg"
            >
                −
            </button>
            <button
                onClick={onReset}
                className="w-12 h-12 bg-zinc-100/90 dark:bg-zinc-800/90 backdrop-blur rounded-lg flex items-center justify-center
                   text-zinc-900 dark:text-white active:bg-zinc-200 dark:active:bg-zinc-700 touch-manipulation shadow-lg"
            >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                    />
                </svg>
            </button>
            <button
                onClick={onToggleMode}
                className="w-12 h-12 bg-zinc-100/90 dark:bg-zinc-800/90 backdrop-blur rounded-lg flex items-center justify-center
                   text-zinc-900 dark:text-white active:bg-zinc-200 dark:active:bg-zinc-700 touch-manipulation shadow-lg"
            >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M14 10l-2 1m0 0l-2-1m2 1v2.5M20 7l-2 1m2-1l-2-1m2 1v2.5M14 4l-2-1-2 1M4 7l2-1M4 7l2 1M4 7v2.5M12 21l-2-1m2 1l2-1m-2 1v-2.5M6 18l-2-1v-2.5M18 18l2-1v-2.5"
                    />
                </svg>
            </button>
        </div>
    );
};

export default MobileAIPanel;
