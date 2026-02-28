/**
 * ModalAnalysisPanel.tsx - Modal Analysis Results Visualization
 * 
 * Displays eigenvalue analysis results:
 * - Natural frequencies and periods
 * - Mode shapes (animated)
 * - Modal participation factors
 * - Effective mass ratios
 */

import { FC, useState, useMemo } from 'react';
import {
    Activity,
    ChevronDown,
    ChevronUp,
    PlayCircle,
    PauseCircle,
    RefreshCw,
    Download,
    AlertCircle,
    Zap,
    Crown,
} from 'lucide-react';
import { useModelStore } from '../store/model';
import { useAdvancedAnalysis } from '../hooks/useAdvancedAnalysis';

// ============================================
// TYPES
// ============================================

interface ModeInfo {
    modeNumber: number;
    frequency: number;  // Hz
    period: number;     // seconds
    participationX: number;
    participationY: number;
    participationZ: number;
    effectiveMassX: number;
    effectiveMassY: number;
    effectiveMassZ: number;
}

interface ModalAnalysisPanelProps {
    isPro?: boolean;
}

// ============================================
// UTILITY COMPONENTS
// ============================================

const ModeCard: FC<{
    mode: ModeInfo;
    selected: boolean;
    onSelect: () => void;
    onAnimate: () => void;
    isAnimating: boolean;
}> = ({ mode, selected, onSelect, onAnimate, isAnimating }) => {
    return (
        <div
            onClick={onSelect}
            className={`
                p-3 rounded-lg border cursor-pointer transition-all
                ${selected
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30'
                    : 'border-gray-200 dark:border-gray-700 hover:border-blue-300'}
            `}
        >
            <div className="flex items-center justify-between mb-2">
                <span className="font-semibold text-sm">Mode {mode.modeNumber}</span>
                <button
                    onClick={(e) => { e.stopPropagation(); onAnimate(); }}
                    className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
                    title="Animate mode shape"
                >
                    {isAnimating ? (
                        <PauseCircle className="w-4 h-4 text-blue-500" />
                    ) : (
                        <PlayCircle className="w-4 h-4 text-gray-500 hover:text-blue-500" />
                    )}
                </button>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                    <span className="text-gray-500">Frequency:</span>
                    <div className="font-medium">{mode.frequency.toFixed(3)} Hz</div>
                </div>
                <div>
                    <span className="text-gray-500">Period:</span>
                    <div className="font-medium">{mode.period.toFixed(3)} s</div>
                </div>
            </div>

            {selected && (
                <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-600">
                    <div className="text-xs text-gray-500 mb-2">Participation Factors:</div>
                    <div className="grid grid-cols-3 gap-1 text-xs">
                        <div className="text-center">
                            <div className="font-medium text-red-500">
                                {(mode.participationX * 100).toFixed(1)}%
                            </div>
                            <div className="text-gray-500 dark:text-gray-400">X</div>
                        </div>
                        <div className="text-center">
                            <div className="font-medium text-green-500">
                                {(mode.participationY * 100).toFixed(1)}%
                            </div>
                            <div className="text-gray-500 dark:text-gray-400">Y</div>
                        </div>
                        <div className="text-center">
                            <div className="font-medium text-blue-500">
                                {(mode.participationZ * 100).toFixed(1)}%
                            </div>
                            <div className="text-gray-500 dark:text-gray-400">Z</div>
                        </div>
                    </div>

                    <div className="text-xs text-gray-500 mt-2 mb-1">Effective Mass:</div>
                    <div className="grid grid-cols-3 gap-1 text-xs">
                        <div className="text-center">
                            <div className="font-medium">{(mode.effectiveMassX * 100).toFixed(1)}%</div>
                        </div>
                        <div className="text-center">
                            <div className="font-medium">{(mode.effectiveMassY * 100).toFixed(1)}%</div>
                        </div>
                        <div className="text-center">
                            <div className="font-medium">{(mode.effectiveMassZ * 100).toFixed(1)}%</div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

// ============================================
// CUMULATIVE MASS CHART
// ============================================

const CumulativeMassChart: FC<{
    data: { mode: number; massX: number; massY: number }[];
}> = ({ data }) => {
    const maxModes = data.length;

    return (
        <div className="h-32 relative bg-gray-50 dark:bg-gray-800 rounded p-2">
            <div className="absolute inset-0 p-2">
                <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
                    {/* 90% threshold line */}
                    <line x1="0" y1="10" x2="100" y2="10" stroke="#ccc" strokeDasharray="4" />
                    <text x="2" y="8" fontSize="8" fill="#888">90%</text>

                    {/* X direction line */}
                    <polyline
                        fill="none"
                        stroke="#ef4444"
                        strokeWidth="2"
                        points={data.map((d, i) =>
                            `${(i / (maxModes - 1)) * 100},${100 - d.massX * 100}`
                        ).join(' ')}
                    />

                    {/* Y direction line */}
                    <polyline
                        fill="none"
                        stroke="#22c55e"
                        strokeWidth="2"
                        points={data.map((d, i) =>
                            `${(i / (maxModes - 1)) * 100},${100 - d.massY * 100}`
                        ).join(' ')}
                    />
                </svg>
            </div>
            <div className="absolute bottom-1 right-2 flex gap-3 text-xs">
                <span className="flex items-center gap-1">
                    <span className="w-3 h-0.5 bg-red-500" /> X
                </span>
                <span className="flex items-center gap-1">
                    <span className="w-3 h-0.5 bg-green-500" /> Y
                </span>
            </div>
        </div>
    );
};

// ============================================
// MAIN COMPONENT
// ============================================

export const ModalAnalysisPanel: FC<ModalAnalysisPanelProps> = ({ isPro = false }) => {
    const nodes = useModelStore((s) => s.nodes);
    const members = useModelStore((s) => s.members);

    // Store State
    const activeModeIndex = useModelStore((s) => s.activeModeIndex);
    const setActiveModeIndex = useModelStore((s) => s.setActiveModeIndex);
    const isAnimating = useModelStore((s) => s.isAnimating);
    const setIsAnimating = useModelStore((s) => s.setIsAnimating);
    const modalResults = useModelStore((s) => s.modalResults);

    // Local UI State
    const [numModes, setNumModes] = useState(6);
    const [showAdvanced, setShowAdvanced] = useState(false);
    const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');

    // Derive supports from nodes with restraints
    const supportsArray = useMemo(() => {
        return Array.from(nodes.values())
            .filter(n => n.restraints && (n.restraints.fx || n.restraints.fy || n.restraints.fz))
            .map(n => ({
                nodeId: n.id,
                type: n.restraints?.fx && n.restraints?.fy && n.restraints?.fz &&
                    n.restraints?.mx && n.restraints?.my && n.restraints?.mz ? 'fixed' :
                    n.restraints?.fx && n.restraints?.fy && n.restraints?.fz ? 'pinned' : 'roller'
            }));
    }, [nodes]);

    const {
        isLoading,
        error,
        runModal,
        convertModelForAdvancedAnalysis,
    } = useAdvancedAnalysis();

    // Convert modal result to display format
    const modes = useMemo<ModeInfo[]>(() => {
        if (!modalResults) return [];

        return modalResults.modes.map((m) => ({
            modeNumber: m.modeNumber,
            frequency: m.frequency,
            period: m.period,
            participationX: 0, // TODO: Extract from modal result if available (currently not in interface?)
            participationY: 0,
            participationZ: 0,
            effectiveMassX: 0,
            effectiveMassY: 0,
            effectiveMassZ: 0,
        }));
    }, [modalResults]);

    // Cumulative mass data
    const cumulativeMassData = useMemo(() => {
        // Placeholder as effective mass data might be missing in store type
        return [];
    }, [modalResults]);

    // Run modal analysis
    const handleRunAnalysis = async () => {
        const nodesArray = Array.from(nodes.values());
        const membersArray = Array.from(members.values()).map((m, idx) => ({
            id: `member-${idx}`,
            startNodeId: m.startNodeId,
            endNodeId: m.endNodeId,
            section: { E: m.E || 200000, A: m.A || 5000, I: m.I || 1e7 },
        }));

        const model = convertModelForAdvancedAnalysis(
            nodesArray.map((n) => ({ id: n.id, x: n.x, y: n.y, z: n.z })),
            membersArray,
            supportsArray as { nodeId: string; type: string }[]
        );

        await runModal({
            ...model,
            numModes,
            massType: 'lumped',
        });
    };

    // Toggle mode animation
    const handleAnimate = (modeIndex: number) => {
        if (activeModeIndex === modeIndex && isAnimating) {
            setIsAnimating(false);
        } else {
            setActiveModeIndex(modeIndex);
            setIsAnimating(true);
        }
    };

    // Helper for selecting a mode without animating
    const handleSelect = (modeIndex: number) => {
        setActiveModeIndex(modeIndex);
        if (isAnimating && activeModeIndex !== modeIndex) {
            setIsAnimating(false); // Stop animation when switching manually if desired, or keep it running?
            // Let's keep it running to allow quick browsing
        }
    };

    // ============================================
    // RENDER
    // ============================================

    if (!isPro) {
        return (
            <div className="p-4 bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20 rounded-lg border border-purple-200 dark:border-purple-800">
                <div className="flex items-center gap-2 mb-2">
                    <Crown className="w-5 h-5 text-purple-500" />
                    <h3 className="font-semibold text-purple-700 dark:text-purple-400">
                        Modal Analysis - Pro Feature
                    </h3>
                </div>
                <p className="text-sm text-purple-600 dark:text-purple-300">
                    Upgrade to Pro to access eigenvalue analysis, natural frequencies,
                    mode shapes, and modal participation factors.
                </p>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white rounded-lg overflow-hidden">
            {/* Header */}
            <div className="p-3 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
                <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold text-sm flex items-center gap-2 text-zinc-800 dark:text-zinc-100">
                        <Activity className="w-4 h-4 text-blue-400" />
                        Modal Analysis
                    </h3>
                    <div className="flex gap-2 text-xs">
                        <button
                            onClick={() => setViewMode('cards')}
                            className={`px-2 py-1 rounded ${viewMode === 'cards' ? 'bg-zinc-200 dark:bg-zinc-700 text-zinc-900 dark:text-white' : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'}`}
                        >
                            Cards
                        </button>
                        <button
                            onClick={() => setViewMode('table')}
                            className={`px-2 py-1 rounded ${viewMode === 'table' ? 'bg-zinc-200 dark:bg-zinc-700 text-zinc-900 dark:text-white' : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'}`}
                        >
                            Table
                        </button>
                    </div>
                </div>

                {/* Settings */}
                <div className="flex items-center gap-3 text-xs">
                    <label className="flex items-center gap-2">
                        <span className="text-zinc-500 dark:text-zinc-400">Modes:</span>
                        <input
                            type="number"
                            min={1}
                            max={50}
                            value={numModes}
                            onChange={(e) => setNumModes(parseInt(e.target.value) || 6)}
                            className="w-16 px-2 py-1 border border-zinc-200 dark:border-zinc-700 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white focus:outline-none focus:border-blue-500"
                        />
                    </label>
                    <button
                        onClick={handleRunAnalysis}
                        disabled={isLoading}
                        className="flex items-center gap-1 px-3 py-1 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 text-white rounded transition-colors ml-auto font-medium"
                    >
                        <RefreshCw className={`w-3 h-3 ${isLoading ? 'animate-spin' : ''}`} />
                        {isLoading ? 'Running...' : 'Run'}
                    </button>
                </div>
            </div>

            {/* Error */}
            {error && (
                <div className="p-3 bg-red-900/30 border-b border-red-800 flex items-center gap-2 text-sm text-red-400">
                    <AlertCircle className="w-4 h-4" />
                    {error}
                </div>
            )}

            {/* Content */}
            <div className="flex-1 overflow-auto p-3">
                {modes.length === 0 ? (
                    <div className="text-center text-zinc-500 dark:text-zinc-400 py-8">
                        <Zap className="w-8 h-8 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">Run modal analysis to see natural frequencies.</p>
                    </div>
                ) : (
                    <>
                        {/* Summary */}
                        <div className="grid grid-cols-3 gap-2 mb-4 text-center text-xs">
                            <div className="p-2 bg-zinc-100 dark:bg-zinc-800 rounded border border-zinc-200 dark:border-zinc-700">
                                <div className="text-lg font-bold text-blue-400">{modes[0]?.frequency.toFixed(2)}</div>
                                <div className="text-zinc-500 dark:text-zinc-400">1st Freq (Hz)</div>
                            </div>
                            <div className="p-2 bg-zinc-100 dark:bg-zinc-800 rounded border border-zinc-200 dark:border-zinc-700">
                                <div className="text-lg font-bold text-green-400">{modes[0]?.period.toFixed(3)}</div>
                                <div className="text-zinc-500 dark:text-zinc-400">1st Period (s)</div>
                            </div>
                            <div className="p-2 bg-zinc-100 dark:bg-zinc-800 rounded border border-zinc-200 dark:border-zinc-700">
                                <div className="text-lg font-bold text-zinc-700 dark:text-zinc-200">{modes.length}</div>
                                <div className="text-zinc-500 dark:text-zinc-400">Modes</div>
                            </div>
                        </div>

                        {viewMode === 'table' ? (
                            <div className="bg-zinc-100 dark:bg-zinc-800 rounded-lg overflow-hidden text-xs border border-zinc-200 dark:border-zinc-700">
                                <table className="w-full text-left">
                                    <thead className="bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300">
                                        <tr>
                                            <th className="p-2 font-medium">Mode</th>
                                            <th className="p-2 font-medium">Freq (Hz)</th>
                                            <th className="p-2 font-medium">Period (s)</th>
                                            <th className="p-2 font-medium text-center">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-zinc-200 dark:divide-zinc-700">
                                        {modes.map((mode, index) => (
                                            <tr
                                                key={mode.modeNumber}
                                                className={`hover:bg-zinc-200/50 dark:hover:bg-zinc-700/50 cursor-pointer ${activeModeIndex === index ? 'bg-blue-900/20' : ''}`}
                                                onClick={() => handleSelect(index)}
                                            >
                                                <td className="p-2">{mode.modeNumber}</td>
                                                <td className="p-2 font-mono text-zinc-600 dark:text-zinc-300">{mode.frequency.toFixed(3)}</td>
                                                <td className="p-2 font-mono text-zinc-600 dark:text-zinc-300">{mode.period.toFixed(4)}</td>
                                                <td className="p-2 text-center">
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); handleAnimate(index); }}
                                                        className="text-zinc-500 dark:text-zinc-400 hover:text-blue-400"
                                                    >
                                                        {activeModeIndex === index && isAnimating ? (
                                                            <PauseCircle className="w-4 h-4" />
                                                        ) : (
                                                            <PlayCircle className="w-4 h-4" />
                                                        )}
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            /* Mode Cards */
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                {modes.map((mode, index) => (
                                    <ModeCard
                                        key={mode.modeNumber}
                                        mode={mode}
                                        selected={activeModeIndex === index}
                                        onSelect={() => handleSelect(index)}
                                        onAnimate={() => handleAnimate(index)}
                                        isAnimating={activeModeIndex === index && isAnimating}
                                    />
                                ))}
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* Footer */}
            {modes.length > 0 && (
                <div className="p-3 border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex justify-between items-center text-xs">
                    <div className="text-zinc-500 dark:text-zinc-400">
                        {isAnimating ? `Animating Mode ${activeModeIndex + 1}...` : 'Select a mode to view shape'}
                    </div>
                    <div className="text-zinc-500 dark:text-zinc-400">
                        Total Mass: {modalResults?.totalMass?.toFixed(1) || '-'} kg
                    </div>
                </div>
            )}
        </div>
    );
};

export default ModalAnalysisPanel;
