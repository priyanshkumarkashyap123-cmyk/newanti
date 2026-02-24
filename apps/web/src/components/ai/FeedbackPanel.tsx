/**
 * FeedbackPanel.tsx
 * 
 * UI component for collecting user feedback on AI outputs
 * Enables continuous learning through corrections and ratings
 */

import React, { useState } from 'react';
import { feedbackService, FeedbackEntry } from '../../services/FeedbackService';

// ============================================
// QUICK RATING COMPONENT
// ============================================

interface QuickRatingProps {
    feature: FeedbackEntry['feature'];
    input: string;
    output: any;
    onComplete?: (rating: number) => void;
    compact?: boolean;
}

export const QuickRating: React.FC<QuickRatingProps> = ({
    feature,
    input,
    output,
    onComplete,
    compact = false
}) => {
    const [rating, setRating] = useState<number | null>(null);
    const [submitted, setSubmitted] = useState(false);

    const handleRate = (value: number) => {
        setRating(value);
        feedbackService.logRating(feature, input, output, value as 1 | 2 | 3 | 4 | 5);
        setSubmitted(true);
        onComplete?.(value);

        // Reset after animation
        setTimeout(() => {
            setSubmitted(false);
            setRating(null);
        }, 2000);
    };

    if (submitted) {
        return (
            <div className={`flex items-center gap-2 ${compact ? '' : 'p-2 bg-green-500/10 rounded-lg'}`}>
                <svg className="w-5 h-5 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <span className="text-green-400 text-sm">Thanks for the feedback!</span>
            </div>
        );
    }

    return (
        <div className={`flex items-center gap-2 ${compact ? '' : 'p-2'}`}>
            <span className="text-gray-400 text-sm">{compact ? '' : 'Rate this:'}</span>
            <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map(value => (
                    <button
                        key={value}
                        onClick={() => handleRate(value)}
                        className={`w-7 h-7 rounded-lg font-medium text-sm transition-all ${rating === value
                                ? 'bg-yellow-500 text-black'
                                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                            }`}
                    >
                        {value}
                    </button>
                ))}
            </div>
        </div>
    );
};

// ============================================
// CORRECTION BUTTON
// ============================================

interface CorrectionButtonProps {
    feature: FeedbackEntry['feature'];
    input: string;
    output: any;
    onCorrect?: () => void;
}

export const CorrectionButton: React.FC<CorrectionButtonProps> = ({
    feature,
    input,
    output,
    onCorrect
}) => {
    const [showDialog, setShowDialog] = useState(false);
    const [correction, setCorrection] = useState('');

    const handleSubmit = () => {
        if (correction.trim()) {
            feedbackService.logCorrection(feature, input, output, correction);
            setShowDialog(false);
            setCorrection('');
            onCorrect?.();
        }
    };

    return (
        <>
            <button
                onClick={() => setShowDialog(true)}
                className="text-xs text-gray-400 hover:text-white flex items-center gap-1"
            >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                    />
                </svg>
                Correct
            </button>

            {showDialog && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-gray-800 rounded-xl p-6 w-96 border border-gray-700">
                        <h3 className="text-white font-semibold mb-4">Submit Correction</h3>

                        <div className="mb-4">
                            <label className="text-gray-400 text-sm block mb-1">Original Output</label>
                            <div className="bg-gray-900 rounded-lg p-3 text-sm text-gray-300 max-h-32 overflow-auto">
                                {typeof output === 'string' ? output : JSON.stringify(output, null, 2)}
                            </div>
                        </div>

                        <div className="mb-4">
                            <label className="text-gray-400 text-sm block mb-1">Your Correction</label>
                            <textarea
                                value={correction}
                                onChange={e => setCorrection(e.target.value)}
                                placeholder="What should the correct output be?"
                                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white h-24 resize-none"
                            />
                        </div>

                        <div className="flex gap-2">
                            <button
                                onClick={() => setShowDialog(false)}
                                className="flex-1 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSubmit}
                                disabled={!correction.trim()}
                                className="flex-1 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500 disabled:opacity-50"
                            >
                                Submit
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

// ============================================
// FEEDBACK STATS BADGE
// ============================================

export const FeedbackStatsBadge: React.FC = () => {
    const stats = feedbackService.getStats();

    if (stats.totalFeedback === 0) return null;

    return (
        <div className="flex items-center gap-2 px-2 py-1 bg-blue-500/10 rounded-lg">
            <span className="text-blue-400 text-xs">
                {stats.totalFeedback} feedback |
                {stats.averageRating > 0 && ` ${stats.averageRating.toFixed(1)}★`}
            </span>
        </div>
    );
};

// ============================================
// INLINE FEEDBACK WIDGET
// ============================================

interface InlineFeedbackProps {
    feature: FeedbackEntry['feature'];
    input: string;
    output: any;
}

export const InlineFeedback: React.FC<InlineFeedbackProps> = ({
    feature,
    input,
    output
}) => {
    return (
        <div className="flex items-center gap-4 pt-2 border-t border-gray-700 mt-2">
            <QuickRating feature={feature} input={input} output={output} compact />
            <CorrectionButton feature={feature} input={input} output={output} />
        </div>
    );
};

// ============================================
// FULL FEEDBACK PANEL
// ============================================

interface FeedbackPanelProps {
    onClose?: () => void;
}

export const FeedbackPanel: React.FC<FeedbackPanelProps> = ({ onClose }) => {
    const [view, setView] = useState<'recent' | 'stats'>('recent');
    const stats = feedbackService.getStats();
    const recent = feedbackService.getRecent(20);

    const handleExport = () => {
        const data = feedbackService.exportAsJSON();
        const blob = new Blob([data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `feedback_export_${new Date().toISOString().split('T')[0]}.json`;
        link.click();
        URL.revokeObjectURL(url);
    };

    return (
        <div className="bg-gray-900 rounded-xl border border-gray-700 overflow-hidden">
            {/* Header */}
            <div className="px-4 py-3 bg-gray-800 border-b border-gray-700 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <svg className="w-5 h-5 text-pink-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                            d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
                        />
                    </svg>
                    <h3 className="font-semibold text-white">User Feedback</h3>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={handleExport}
                        className="px-3 py-1 text-sm bg-gray-700 text-white rounded-lg hover:bg-gray-600"
                    >
                        Export
                    </button>
                    {onClose && (
                        <button onClick={onClose} className="text-gray-400 hover:text-white">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    )}
                </div>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-gray-700">
                <button
                    onClick={() => setView('recent')}
                    className={`flex-1 py-2 text-sm font-medium ${view === 'recent' ? 'text-white border-b-2 border-pink-500' : 'text-gray-400'
                        }`}
                >
                    Recent
                </button>
                <button
                    onClick={() => setView('stats')}
                    className={`flex-1 py-2 text-sm font-medium ${view === 'stats' ? 'text-white border-b-2 border-pink-500' : 'text-gray-400'
                        }`}
                >
                    Statistics
                </button>
            </div>

            {/* Content */}
            <div className="p-4 max-h-80 overflow-y-auto">
                {view === 'recent' && (
                    <>
                        {recent.length === 0 ? (
                            <div className="text-center py-8 text-gray-400">
                                <p>No feedback collected yet</p>
                                <p className="text-sm mt-2">Rate AI outputs to help improve the system</p>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {recent.map(entry => (
                                    <div key={entry.id} className="p-3 bg-gray-800 rounded-lg">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="text-xs bg-gray-700 px-2 py-0.5 rounded text-gray-300">
                                                {entry.type}
                                            </span>
                                            {entry.rating && (
                                                <span className="text-yellow-400 text-sm">
                                                    {'★'.repeat(entry.rating)}{'☆'.repeat(5 - entry.rating)}
                                                </span>
                                            )}
                                        </div>
                                        <div className="text-sm text-gray-300 truncate">
                                            {entry.originalInput.slice(0, 100)}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </>
                )}

                {view === 'stats' && (
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="bg-gray-800 rounded-lg p-4 text-center">
                                <div className="text-3xl font-bold text-white">{stats.totalFeedback}</div>
                                <div className="text-gray-400 text-sm">Total Feedback</div>
                            </div>
                            <div className="bg-gray-800 rounded-lg p-4 text-center">
                                <div className="text-3xl font-bold text-yellow-400">
                                    {stats.averageRating > 0 ? stats.averageRating.toFixed(1) : '-'}
                                </div>
                                <div className="text-gray-400 text-sm">Avg Rating</div>
                            </div>
                        </div>

                        <div className="bg-gray-800 rounded-lg p-4">
                            <h4 className="text-white font-medium mb-2">By Feature</h4>
                            {Object.entries(stats.byFeature).map(([feature, count]) => (
                                <div key={feature} className="flex justify-between text-sm py-1">
                                    <span className="text-gray-400">{feature.replace('_', ' ')}</span>
                                    <span className="text-white">{count}</span>
                                </div>
                            ))}
                        </div>

                        <div className="bg-gray-800 rounded-lg p-4">
                            <h4 className="text-white font-medium mb-2">By Type</h4>
                            {Object.entries(stats.byType).map(([type, count]) => (
                                <div key={type} className="flex justify-between text-sm py-1">
                                    <span className="text-gray-400">{type}</span>
                                    <span className="text-white">{count}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default FeedbackPanel;
