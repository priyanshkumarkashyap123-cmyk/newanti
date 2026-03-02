/**
 * VoiceInputButton.tsx
 * 
 * Voice input toggle button with visual feedback
 */

import React, { useState, useEffect } from 'react';
import { voiceInput, VoiceCommand, VoiceInputState } from '../../services/voice/VoiceInputService';

interface VoiceInputButtonProps {
    onCommand?: (command: VoiceCommand) => void;
    className?: string;
}

export const VoiceInputButton: React.FC<VoiceInputButtonProps> = ({
    onCommand,
    className = ''
}) => {
    const [state, setState] = useState<VoiceInputState>({ isListening: false, isProcessing: false });
    const [lastCommand, setLastCommand] = useState<string | null>(null);
    const [showFeedback, setShowFeedback] = useState(false);

    useEffect(() => {
        const unsubState = voiceInput.onStateChange(setState);
        const unsubCommand = voiceInput.onCommand((cmd) => {
            setLastCommand(cmd.transcript);
            setShowFeedback(true);
            setTimeout(() => setShowFeedback(false), 3000);
            onCommand?.(cmd);
        });

        // Keyboard shortcut: Ctrl+Shift+Space per Figma §14.5
        const handleKeydown = (e: KeyboardEvent) => {
            if (e.ctrlKey && e.shiftKey && e.code === 'Space') {
                e.preventDefault();
                voiceInput.toggleListening();
            }
        };
        window.addEventListener('keydown', handleKeydown);

        return () => {
            unsubState();
            unsubCommand();
            window.removeEventListener('keydown', handleKeydown);
        };
    }, [onCommand]);

    if (!voiceInput.isVoiceSupported()) {
        return null; // Don't show if not supported
    }

    return (
        <div className="relative">
            <button type="button"
                onClick={() => voiceInput.toggleListening()}
                className={`relative p-3 rounded-full transition-all ${state.isListening
                    ? 'bg-red-500 text-white animate-pulse'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-white'
                    } ${className}`}
                title={state.isListening ? 'Stop listening' : 'Start voice input'}
                aria-label={state.isListening ? 'Stop listening' : 'Start voice input'}
                aria-pressed={state.isListening}
            >
                {/* Microphone Icon */}
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
                    />
                </svg>

                {/* Listening animation */}
                {state.isListening && (
                    <span className="absolute inset-0 rounded-full animate-ping bg-red-500 opacity-25" aria-hidden="true" />
                )}
            </button>

            {/* Processing indicator */}
            {state.isProcessing && (
                <div role="status" aria-label="Processing" className="absolute -top-1 -right-1 w-3 h-3 bg-yellow-500 rounded-full animate-bounce" />
            )}

            {/* Command feedback */}
            {showFeedback && lastCommand && (
                <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 whitespace-nowrap bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white text-sm px-3 py-1 rounded-lg shadow-lg">
                    "{lastCommand}"
                </div>
            )}
        </div>
    );
};

/**
 * Voice Command Panel - Shows command history and status
 */
export const VoiceCommandPanel: React.FC<{
    onExecute?: (command: VoiceCommand) => void;
}> = ({ onExecute }) => {
    const [state, setState] = useState<VoiceInputState>({ isListening: false, isProcessing: false });
    const [history, setHistory] = useState<VoiceCommand[]>([]);

    useEffect(() => {
        const unsubState = voiceInput.onStateChange(setState);
        const unsubCommand = voiceInput.onCommand((cmd) => {
            setHistory(voiceInput.getHistory(10));
            if (cmd.intent && cmd.processed) {
                onExecute?.(cmd);
            }
        });

        queueMicrotask(() => setHistory(voiceInput.getHistory(10)));

        return () => {
            unsubState();
            unsubCommand();
        };
    }, [onExecute]);

    if (!voiceInput.isVoiceSupported()) {
        return (
            <div className="bg-slate-100 dark:bg-slate-800 rounded-lg p-4 text-center text-slate-500 dark:text-slate-400">
                Voice input not supported in this browser
            </div>
        );
    }

    return (
        <div className="bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-700 overflow-hidden">
            <div className="px-4 py-3 bg-slate-100 dark:bg-slate-800 border-b border-slate-700 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                            d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
                        />
                    </svg>
                    <span className="font-semibold text-slate-900 dark:text-white">Voice Commands</span>
                    {state.isListening && (
                        <span className="text-xs bg-red-500 text-white px-2 py-0.5 rounded animate-pulse">
                            Listening...
                        </span>
                    )}
                </div>
                <button type="button"
                    onClick={() => voiceInput.toggleListening()}
                    className={`px-3 py-1 rounded text-sm font-medium ${state.isListening
                        ? 'bg-red-500 text-white'
                        : 'bg-blue-500 text-white'
                        }`}
                >
                    {state.isListening ? 'Stop' : 'Start'}
                </button>
            </div>

            <div className="p-4">
                {/* Quick commands */}
                <div className="mb-4">
                    <h4 className="text-slate-500 dark:text-slate-400 text-sm mb-2">Try saying:</h4>
                    <div className="flex flex-wrap gap-2">
                        {[
                            'Add a 6 meter beam',
                            'Add a fixed support',
                            'Apply 10 kN load',
                            'Run analysis',
                            'Check design'
                        ].map((cmd, i) => (
                            <span key={i} className="text-xs bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-2 py-1 rounded">
                                "{cmd}"
                            </span>
                        ))}
                    </div>
                </div>

                {/* Command history */}
                <div>
                    <h4 className="text-slate-500 dark:text-slate-400 text-sm mb-2">Recent Commands</h4>
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                        {history.length === 0 ? (
                            <p className="text-slate-500 text-sm">No commands yet</p>
                        ) : (
                            history.slice().reverse().map(cmd => (
                                <div key={cmd.id} className="flex items-start gap-2 py-2 border-b border-slate-800 last:border-0">
                                    <span className={`mt-1 w-2 h-2 rounded-full ${cmd.processed ? 'bg-green-500' : 'bg-yellow-500'}`} />
                                    <div className="flex-1">
                                        <p className="text-white text-sm">"{cmd.transcript}"</p>
                                        {cmd.intent && (
                                            <p className="text-slate-500 text-xs">
                                                Action: {cmd.intent.action} → {cmd.intent.target}
                                                {Object.keys(cmd.intent.parameters).length > 0 && (
                                                    <span className="ml-1">
                                                        ({Object.entries(cmd.intent.parameters).map(([k, v]) => `${k}: ${v}`).join(', ')})
                                                    </span>
                                                )}
                                            </p>
                                        )}
                                    </div>
                                    <span className="text-slate-500 text-xs">
                                        {(cmd.confidence * 100).toFixed(0)}%
                                    </span>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default VoiceInputButton;
