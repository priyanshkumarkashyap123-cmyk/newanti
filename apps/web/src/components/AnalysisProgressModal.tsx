/**
 * AnalysisProgressModal - Analysis Progress Indicator
 * 
 * Shows detailed progress during structural analysis with stages:
 * 1. Validating Model
 * 2. Assembling Stiffness Matrix
 * 3. Solving Equations
 * 4. Computing Results
 */

import { FC } from 'react';
import { Check, Loader2, X, AlertTriangle } from 'lucide-react';

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
    if (!isOpen) return null;

    const currentStageIndex = STAGES.findIndex(s => s.id === stage);
    const isComplete = stage === 'complete';
    const isError = stage === 'error';

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="w-full max-w-md bg-white dark:bg-zinc-900 rounded-xl shadow-2xl overflow-hidden">
                {/* Header */}
                <div className={`
                    flex items-center justify-between px-6 py-4
                    ${isComplete
                        ? 'bg-green-600 text-white'
                        : isError
                            ? 'bg-red-600 text-white'
                            : 'bg-blue-600 text-white'
                    }
                `}>
                    <h2 className="text-lg font-semibold">
                        {isComplete
                            ? '✓ Analysis Complete'
                            : isError
                                ? '✗ Analysis Failed'
                                : 'Running Analysis...'}
                    </h2>
                    {(isComplete || isError) && (
                        <button
                            onClick={onClose}
                            className="p-1 rounded hover:bg-white/20 transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    )}
                </div>

                {/* Content */}
                <div className="px-6 py-4">
                    {/* Progress Bar */}
                    <div className="mb-6">
                        <div className="flex justify-between text-sm mb-2">
                            <span className="text-zinc-500 dark:text-zinc-400">Progress</span>
                            <span className="font-medium text-zinc-900 dark:text-white">{Math.round(progress)}%</span>
                        </div>
                        <div className="h-3 bg-zinc-200 dark:bg-zinc-700 rounded-full overflow-hidden">
                            <div
                                className={`h-full transition-all duration-500 rounded-full ${isError
                                        ? 'bg-red-500'
                                        : isComplete
                                            ? 'bg-green-500'
                                            : 'bg-blue-500'
                                    }`}
                                style={{ width: `${progress}%` }}
                            />
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
                        <div className="mt-4 grid grid-cols-2 gap-3">
                            <div className="p-3 bg-zinc-50 dark:bg-zinc-800 rounded-lg">
                                <div className="text-xs text-zinc-400 dark:text-zinc-400">Nodes</div>
                                <div className="text-lg font-bold text-zinc-900 dark:text-white">{stats.nodes}</div>
                            </div>
                            <div className="p-3 bg-zinc-50 dark:bg-zinc-800 rounded-lg">
                                <div className="text-xs text-zinc-400 dark:text-zinc-400">Members</div>
                                <div className="text-lg font-bold text-zinc-900 dark:text-white">{stats.members}</div>
                            </div>
                            <div className="p-3 bg-zinc-50 dark:bg-zinc-800 rounded-lg">
                                <div className="text-xs text-zinc-400 dark:text-zinc-400">DOF</div>
                                <div className="text-lg font-bold text-zinc-900 dark:text-white">{stats.dof}</div>
                            </div>
                            <div className="p-3 bg-zinc-50 dark:bg-zinc-800 rounded-lg">
                                <div className="text-xs text-zinc-400 dark:text-zinc-400">Time</div>
                                <div className="text-lg font-bold text-zinc-900 dark:text-white">{stats.timeMs}ms</div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                {(isComplete || isError) && (
                    <div className="px-6 py-4 bg-zinc-50 dark:bg-zinc-800/50 border-t border-zinc-200 dark:border-zinc-700">
                        <button
                            onClick={onClose}
                            className={`
                                w-full py-2 rounded-lg font-medium transition-colors
                                ${isComplete
                                    ? 'bg-green-600 hover:bg-green-700 text-white'
                                    : 'bg-zinc-600 hover:bg-zinc-700 text-white'
                                }
                            `}
                        >
                            {isComplete ? 'View Results' : 'Close'}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default AnalysisProgressModal;
