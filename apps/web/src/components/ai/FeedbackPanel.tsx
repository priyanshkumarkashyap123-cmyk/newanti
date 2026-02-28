/**
 * FeedbackPanel.tsx
 * 
 * UI component for collecting user feedback on AI outputs
 * Enables continuous learning through corrections and ratings
 */

import React, { useState } from 'react';
import { feedbackService, FeedbackEntry } from '../../services/FeedbackService';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../ui/dialog';
import { Button } from '../ui/button';
import { Label } from '../ui/label';

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
            <span className="text-zinc-500 dark:text-zinc-400 text-sm">{compact ? '' : 'Rate this:'}</span>
            <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map(value => (
                    <button
                        key={value}
                        onClick={() => handleRate(value)}
                        className={`w-7 h-7 rounded-lg font-medium text-sm transition-all ${rating === value
                                ? 'bg-yellow-500 text-black'
                                : 'bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-600'
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
                className="text-xs text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:text-white flex items-center gap-1"
            >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                    />
                </svg>
                Correct
            </button>

            <Dialog open={showDialog} onOpenChange={(open) => !open && setShowDialog(false)}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>Submit Correction</DialogTitle>
                        <DialogDescription>Provide the correct output to help improve the system.</DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4">
                        <div>
                            <Label className="text-zinc-500 dark:text-zinc-400 text-sm block mb-1">Original Output</Label>
                            <div className="bg-white dark:bg-zinc-900 rounded-lg p-3 text-sm text-zinc-700 dark:text-zinc-300 max-h-32 overflow-auto border border-zinc-200 dark:border-zinc-800">
                                {typeof output === 'string' ? output : JSON.stringify(output, null, 2)}
                            </div>
                        </div>

                        <div>
                            <Label className="text-zinc-500 dark:text-zinc-400 text-sm block mb-1">Your Correction</Label>
                            <textarea
                                value={correction}
                                onChange={e => setCorrection(e.target.value)}
                                placeholder="What should the correct output be?"
                                className="w-full bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-lg px-3 py-2 text-zinc-900 dark:text-white h-24 resize-none"
                            />
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowDialog(false)}>Cancel</Button>
                        <Button onClick={handleSubmit} disabled={!correction.trim()}>Submit</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
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
        <div className="flex items-center gap-4 pt-2 border-t border-zinc-300 dark:border-zinc-700 mt-2">
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
        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-300 dark:border-zinc-700 overflow-hidden">
            {/* Header */}
            <div className="px-4 py-3 bg-zinc-100 dark:bg-zinc-800 border-b border-zinc-300 dark:border-zinc-700 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <svg className="w-5 h-5 text-pink-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                            d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
                        />
                    </svg>
                    <h3 className="font-semibold text-zinc-900 dark:text-white">User Feedback</h3>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={handleExport}
                        className="px-3 py-1 text-sm bg-zinc-200 dark:bg-zinc-700 text-zinc-900 dark:text-white rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-600"
                    >
                        Export
                    </button>
                    {onClose && (
                        <button onClick={onClose} className="text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:text-white">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    )}
                </div>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-zinc-300 dark:border-zinc-700">
                <button
                    onClick={() => setView('recent')}
                    className={`flex-1 py-2 text-sm font-medium ${view === 'recent' ? 'text-zinc-900 dark:text-white border-b-2 border-pink-500' : 'text-zinc-500 dark:text-zinc-400'
                        }`}
                >
                    Recent
                </button>
                <button
                    onClick={() => setView('stats')}
                    className={`flex-1 py-2 text-sm font-medium ${view === 'stats' ? 'text-zinc-900 dark:text-white border-b-2 border-pink-500' : 'text-zinc-500 dark:text-zinc-400'
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
                            <div className="text-center py-8 text-zinc-500 dark:text-zinc-400">
                                <p>No feedback collected yet</p>
                                <p className="text-sm mt-2">Rate AI outputs to help improve the system</p>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {recent.map(entry => (
                                    <div key={entry.id} className="p-3 bg-zinc-100 dark:bg-zinc-800 rounded-lg">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="text-xs bg-zinc-200 dark:bg-zinc-700 px-2 py-0.5 rounded text-zinc-700 dark:text-zinc-300">
                                                {entry.type}
                                            </span>
                                            {entry.rating && (
                                                <span className="text-yellow-400 text-sm">
                                                    {'★'.repeat(entry.rating)}{'☆'.repeat(5 - entry.rating)}
                                                </span>
                                            )}
                                        </div>
                                        <div className="text-sm text-zinc-700 dark:text-zinc-300 truncate">
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
                            <div className="bg-zinc-100 dark:bg-zinc-800 rounded-lg p-4 text-center">
                                <div className="text-3xl font-bold text-zinc-900 dark:text-white">{stats.totalFeedback}</div>
                                <div className="text-zinc-500 dark:text-zinc-400 text-sm">Total Feedback</div>
                            </div>
                            <div className="bg-zinc-100 dark:bg-zinc-800 rounded-lg p-4 text-center">
                                <div className="text-3xl font-bold text-yellow-400">
                                    {stats.averageRating > 0 ? stats.averageRating.toFixed(1) : '-'}
                                </div>
                                <div className="text-zinc-500 dark:text-zinc-400 text-sm">Avg Rating</div>
                            </div>
                        </div>

                        <div className="bg-zinc-100 dark:bg-zinc-800 rounded-lg p-4">
                            <h4 className="text-zinc-900 dark:text-white font-medium mb-2">By Feature</h4>
                            {Object.entries(stats.byFeature).map(([feature, count]) => (
                                <div key={feature} className="flex justify-between text-sm py-1">
                                    <span className="text-zinc-500 dark:text-zinc-400">{feature.replace('_', ' ')}</span>
                                    <span className="text-zinc-900 dark:text-white">{count}</span>
                                </div>
                            ))}
                        </div>

                        <div className="bg-zinc-100 dark:bg-zinc-800 rounded-lg p-4">
                            <h4 className="text-zinc-900 dark:text-white font-medium mb-2">By Type</h4>
                            {Object.entries(stats.byType).map(([type, count]) => (
                                <div key={type} className="flex justify-between text-sm py-1">
                                    <span className="text-zinc-500 dark:text-zinc-400">{type}</span>
                                    <span className="text-zinc-900 dark:text-white">{count}</span>
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
