/**
 * AnalysisProgressModal - Analysis Progress Indicator
 * 
 * Shows detailed progress during structural analysis with stages:
 * 1. Validating Model
 * 2. Assembling Stiffness Matrix
 * 3. Solving Equations
 * 4. Computing Results
 */

import React from 'react';
import { FC } from 'react';
import { Check, Loader2, AlertTriangle } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from './ui/dialog';
import { Button } from './ui/button';

// ============================================
// TYPES
// ============================================

export type AnalysisStage =
    | 'validating'
    | 'assembling'
    | 'solving'
    | 'computing'
    | 'complete'
    | 'error';

interface AnalysisProgressModalProps {
    isOpen: boolean;
    stage: AnalysisStage;
    progress: number; // 0-100
    error?: string;
    onClose: () => void;
    stats?: {
        nodes: number;
        members: number;
        dof: number;
        timeMs?: number;
    };
}

// ============================================
// STAGE CONFIGURATION
// ============================================

const STAGES = [
    { id: 'validating', label: 'Validating Model', progress: 10 },
    { id: 'assembling', label: 'Assembling Stiffness Matrix', progress: 30 },
    { id: 'solving', label: 'Solving Equations', progress: 70 },
    { id: 'computing', label: 'Computing Results', progress: 90 },
    { id: 'complete', label: 'Analysis Complete', progress: 100 }
];

// ============================================
// COMPONENT
// ============================================

export const AnalysisProgressModal: FC<AnalysisProgressModalProps> = ({
    isOpen,
    stage,
    progress,
    error,
    onClose,
    stats
}) => {
    const currentStageIndex = STAGES.findIndex(s => s.id === stage);
    const isComplete = stage === 'complete';
    const isError = stage === 'error';

    // Only allow closing when complete or errored
    const handleOpenChange = (open: boolean) => {
        if (!open && (isComplete || isError)) onClose();
    };

    return (
        <Dialog open={isOpen} onOpenChange={handleOpenChange}>
            <DialogContent className="max-w-md p-0 overflow-hidden" onInteractOutside={(e) => { if (!isComplete && !isError) e.preventDefault(); }}>
                {/* Header */}
                <DialogHeader className={`
                    flex items-center justify-between px-6 py-4
                    ${isComplete
                        ? 'bg-green-600 text-white'
                        : isError
                            ? 'bg-red-600 text-white'
                            : 'bg-blue-600 text-white'
                    }
                `}>
                    <DialogTitle className="text-lg font-semibold text-white">
                        {isComplete
                            ? '✓ Analysis Complete'
                            : isError
                                ? '✗ Analysis Failed'
                                : 'Running Analysis...'}
                    </DialogTitle>
                    <DialogDescription className="sr-only">
                        {isComplete ? 'Analysis finished successfully' : isError ? 'Analysis encountered an error' : 'Analysis is in progress'}
                    </DialogDescription>
                </DialogHeader>

                {/* Content */}
                <div className="px-6 py-4">
                    {/* Progress Bar */}
                    <div className="mb-6">
                        <div className="flex justify-between text-sm mb-2">
                            <span className="text-zinc-500 dark:text-zinc-400">Progress</span>
                            <span className="font-medium text-zinc-900 dark:text-white">{Math.round(progress)}%</span>
                        </div>
                        <div className="h-3 bg-zinc-200 dark:bg-zinc-700 rounded-full overflow-hidden relative">
                            <div
                                className={`h-full transition-all duration-500 rounded-full ${isError
                                        ? 'bg-red-500'
                                        : isComplete
                                            ? 'bg-green-500'
                                            : 'bg-blue-500'
                                    }`}
                                style={{ width: `${progress}%` }}
                            />
                            {!isComplete && !isError && (
                                <div className="absolute inset-0 overflow-hidden rounded-full">
                                    <div
                                        className="h-full w-1/3 animate-[shimmer_1.5s_ease-in-out_infinite] bg-gradient-to-r from-transparent via-white/20 to-transparent"
                                        style={{ marginLeft: `${Math.max(0, progress - 30)}%` }}
                                    />
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Stage List */}
                    <div className="space-y-3">
                        {STAGES.slice(0, -1).map((stageItem, index) => {
                            const isPast = index < currentStageIndex;
                            const isCurrent = stageItem.id === stage;
                            const isErrorStage = isError && isCurrent;

                            return (
                                <div
                                    key={stageItem.id}
                                    className={`
                                        flex items-center gap-3 px-3 py-2 rounded-lg
                                        ${isCurrent && !isError
                                            ? 'bg-blue-50 dark:bg-blue-900/30'
                                            : isErrorStage
                                                ? 'bg-red-50 dark:bg-red-900/30'
                                                : ''
                                        }
                                    `}
                                >
                                    <div className={`
                                        w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0
                                        ${isPast || isComplete
                                            ? 'bg-green-100 dark:bg-green-900/50 text-green-600'
                                            : isCurrent && !isError
                                                ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-600'
                                                : isErrorStage
                                                    ? 'bg-red-100 dark:bg-red-900/50 text-red-600'
                                                    : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-400'
                                        }
                                    `}>
                                        {isPast || isComplete ? (
                                            <Check className="w-3 h-3" />
                                        ) : isCurrent && !isError ? (
                                            <Loader2 className="w-3 h-3 animate-spin" />
                                        ) : isErrorStage ? (
                                            <AlertTriangle className="w-3 h-3" />
                                        ) : (
                                            <span className="text-xs">{index + 1}</span>
                                        )}
                                    </div>
                                    <span className={`
                                        text-sm
                                        ${isPast || isComplete
                                            ? 'text-green-700 dark:text-green-400'
                                            : isCurrent
                                                ? isError
                                                    ? 'text-red-700 dark:text-red-400 font-medium'
                                                    : 'text-blue-700 dark:text-blue-400 font-medium'
                                                : 'text-zinc-400 dark:text-zinc-400'
                                        }
                                    `}>
                                        {stageItem.label}
                                    </span>
                                </div>
                            );
                        })}
                    </div>

                    {/* Error Message */}
                    {error && (
                        <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/30 rounded-lg border border-red-200 dark:border-red-800">
                            <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
                        </div>
                    )}

                    {/* Stats (shown on complete) */}
                    {isComplete && stats && (
                        <div className="mt-5 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800/50 rounded-xl">
                            <h3 className="text-sm font-semibold text-green-700 dark:text-green-400 mb-3">Analysis Summary</h3>
                            <div className="grid grid-cols-2 gap-3">
                                <div className="p-3 bg-white dark:bg-zinc-800 rounded-lg shadow-sm">
                                    <div className="text-xs text-zinc-400 dark:text-zinc-400">Nodes</div>
                                    <div className="text-xl font-bold text-zinc-900 dark:text-white">{stats.nodes}</div>
                                </div>
                                <div className="p-3 bg-white dark:bg-zinc-800 rounded-lg shadow-sm">
                                    <div className="text-xs text-zinc-400 dark:text-zinc-400">Members</div>
                                    <div className="text-xl font-bold text-zinc-900 dark:text-white">{stats.members}</div>
                                </div>
                                <div className="p-3 bg-white dark:bg-zinc-800 rounded-lg shadow-sm">
                                    <div className="text-xs text-zinc-400 dark:text-zinc-400">DOF</div>
                                    <div className="text-xl font-bold text-zinc-900 dark:text-white">{stats.dof}</div>
                                </div>
                                <div className="p-3 bg-white dark:bg-zinc-800 rounded-lg shadow-sm">
                                    <div className="text-xs text-zinc-400 dark:text-zinc-400">Time</div>
                                    <div className="text-xl font-bold text-emerald-600 dark:text-emerald-400">{stats.timeMs}ms</div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                {(isComplete || isError) && (
                    <DialogFooter className="px-6 py-4 bg-zinc-50 dark:bg-zinc-800/50 border-t border-zinc-200 dark:border-zinc-700">
                        <Button
                            onClick={onClose}
                            className={`w-full ${isComplete
                                    ? 'bg-green-600 hover:bg-green-700 text-white'
                                    : 'bg-zinc-600 hover:bg-zinc-700 text-white'
                                }`}
                        >
                            {isComplete ? 'View Results' : 'Close'}
                        </Button>
                    </DialogFooter>
                )}
            </DialogContent>
        </Dialog>
    );
};

export default AnalysisProgressModal;
