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
                            <div className="text-gray-400">X</div>
                        </div>
                        <div className="text-center">
                            <div className="font-medium text-green-500">
                                {(mode.participationY * 100).toFixed(1)}%
                            </div>
                            <div className="text-gray-400">Y</div>
                        </div>
                        <div className="text-center">
                            <div className="font-medium text-blue-500">
                                {(mode.participationZ * 100).toFixed(1)}%
                            </div>
                            <div className="text-gray-400">Z</div>
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

    const [selectedMode, setSelectedMode] = useState<number>(1);
    const [animatingMode, setAnimatingMode] = useState<number | null>(null);
    const [numModes, setNumModes] = useState(6);
    const [showAdvanced, setShowAdvanced] = useState(false);

    const {
        isLoading,
        error,
        modalResult,
        runModal,
        convertModelForAdvancedAnalysis,
    } = useAdvancedAnalysis();

    // Convert modal result to display format
    const modes = useMemo<ModeInfo[]>(() => {
        if (!modalResult) return [];
        
        return modalResult.modes.map((m) => ({
            modeNumber: m.modeNumber,
            frequency: m.frequency,
            period: m.period,
            participationX: m.participationFactorX,
            participationY: m.participationFactorY,
            participationZ: m.participationFactorZ,
            effectiveMassX: m.effectiveMassX,
            effectiveMassY: m.effectiveMassY,
            effectiveMassZ: m.effectiveMassZ,
        }));
    }, [modalResult]);

    // Cumulative mass data
    const cumulativeMassData = useMemo(() => {
        if (!modalResult?.cumulativeMassX || !modalResult?.cumulativeMassY) return [];
        
        return modalResult.cumulativeMassX.map((massX, i) => ({
            mode: i + 1,
            massX,
            massY: modalResult.cumulativeMassY?.[i] || 0,
        }));
    }, [modalResult]);

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
    const handleAnimate = (modeNum: number) => {
        if (animatingMode === modeNum) {
            setAnimatingMode(null);
        } else {
            setAnimatingMode(modeNum);
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
        <div className="flex flex-col h-full">
            {/* Header */}
            <div className="p-3 border-b border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold text-sm flex items-center gap-2">
                        <Activity className="w-4 h-4" />
                        Modal Analysis
                    </h3>
                    <button
                        onClick={() => setShowAdvanced(!showAdvanced)}
                        className="text-xs text-blue-500 hover:text-blue-600"
                    >
                        {showAdvanced ? 'Simple' : 'Advanced'}
                    </button>
                </div>

                {/* Settings */}
                <div className="flex items-center gap-3 text-xs">
                    <label className="flex items-center gap-2">
                        <span className="text-gray-500">Modes:</span>
                        <input
                            type="number"
                            min={1}
                            max={50}
                            value={numModes}
                            onChange={(e) => setNumModes(parseInt(e.target.value) || 6)}
                            className="w-16 px-2 py-1 border rounded dark:bg-gray-800 dark:border-gray-600"
                        />
                    </label>
                    <button
                        onClick={handleRunAnalysis}
                        disabled={isLoading}
                        className="flex items-center gap-1 px-3 py-1 bg-blue-500 hover:bg-blue-600 disabled:bg-blue-300 text-white rounded transition-colors"
                    >
                        <RefreshCw className={`w-3 h-3 ${isLoading ? 'animate-spin' : ''}`} />
                        {isLoading ? 'Running...' : 'Run'}
                    </button>
                </div>
            </div>

            {/* Error */}
            {error && (
                <div className="p-3 bg-red-50 dark:bg-red-900/30 border-b border-red-200 dark:border-red-800 flex items-center gap-2 text-sm text-red-600 dark:text-red-400">
                    <AlertCircle className="w-4 h-4" />
                    {error}
                </div>
            )}

            {/* Content */}
            <div className="flex-1 overflow-auto p-3">
                {modes.length === 0 ? (
                    <div className="text-center text-gray-500 py-8">
                        <Zap className="w-8 h-8 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">Run modal analysis to see natural frequencies.</p>
                    </div>
                ) : (
                    <>
                        {/* Cumulative Mass Chart */}
                        {showAdvanced && cumulativeMassData.length > 0 && (
                            <div className="mb-4">
                                <div className="text-xs text-gray-500 mb-2">Cumulative Mass Participation</div>
                                <CumulativeMassChart data={cumulativeMassData} />
                            </div>
                        )}

                        {/* Summary */}
                        <div className="grid grid-cols-3 gap-2 mb-4 text-center text-xs">
                            <div className="p-2 bg-gray-50 dark:bg-gray-800 rounded">
                                <div className="text-lg font-bold">{modes[0]?.frequency.toFixed(2)}</div>
                                <div className="text-gray-500">1st Freq (Hz)</div>
                            </div>
                            <div className="p-2 bg-gray-50 dark:bg-gray-800 rounded">
                                <div className="text-lg font-bold">{modes[0]?.period.toFixed(3)}</div>
                                <div className="text-gray-500">1st Period (s)</div>
                            </div>
                            <div className="p-2 bg-gray-50 dark:bg-gray-800 rounded">
                                <div className="text-lg font-bold">{modes.length}</div>
                                <div className="text-gray-500">Modes</div>
                            </div>
                        </div>

                        {/* Mode Cards */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                            {modes.map((mode) => (
                                <ModeCard
                                    key={mode.modeNumber}
                                    mode={mode}
                                    selected={selectedMode === mode.modeNumber}
                                    onSelect={() => setSelectedMode(mode.modeNumber)}
                                    onAnimate={() => handleAnimate(mode.modeNumber)}
                                    isAnimating={animatingMode === mode.modeNumber}
                                />
                            ))}
                        </div>
                    </>
                )}
            </div>

            {/* Footer */}
            {modes.length > 0 && (
                <div className="p-3 border-t border-gray-200 dark:border-gray-700 flex justify-between">
                    <button className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700">
                        <Download className="w-4 h-4" />
                        Export Results
                    </button>
                    <div className="text-xs text-gray-400">
                        Total mass: {modalResult?.totalMass?.toFixed(1) || '—'} kg
                    </div>
                </div>
            )}
        </div>
    );
};

export default ModalAnalysisPanel;
