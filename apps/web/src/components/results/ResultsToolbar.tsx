/**
 * ResultsToolbar - Post-Analysis Results Controls
 * 
 * Floating toolbar after analysis:
 * - Toggle buttons for Deflected Shape, BMD, SFD, Reactions
 * - Scale slider for diagram visualization
 * - Animation controls for deflected shape
 */

import { FC, useState } from 'react';
import {
    TrendingDown,
    BarChart2,
    Activity,
    ArrowDownToLine,
    Play,
    Pause,
    RotateCcw,
    SlidersHorizontal,
    X,
    Maximize2,
    Minimize2
} from 'lucide-react';
import { useModelStore, type AnalysisResults } from '../../store/model';

// ============================================
// TYPES
// ============================================

interface ResultsToolbarProps {
    onClose?: () => void;
}

type DiagramType = 'deflection' | 'bmd' | 'sfd' | 'reactions' | 'axial';

// ============================================
// COMPONENT
// ============================================

export const ResultsToolbar: FC<ResultsToolbarProps> = ({ onClose }) => {
    const analysisResults = useModelStore((s) => s.analysisResults) as AnalysisResults | null;
    const displacementScale = useModelStore((s) => s.displacementScale) as number;

    // Local state
    const [isExpanded, setIsExpanded] = useState(true);
    const [isAnimating, setIsAnimating] = useState(false);
    const [activeDiagram, setActiveDiagram] = useState<DiagramType | null>('deflection');
    const [scale, setScale] = useState(displacementScale ?? 50);

    // Store doesn't have these - we'll use local state
    const [_showReactions, _setShowReactions] = useState(true);
    const [_showAxial, _setShowAxial] = useState(false);

    if (!analysisResults) return null;

    const diagrams: { id: DiagramType; label: string; icon: React.ElementType; color: string }[] = [
        { id: 'deflection', label: 'Deflected', icon: TrendingDown, color: 'text-blue-500' },
        { id: 'bmd', label: 'BMD', icon: BarChart2, color: 'text-green-500' },
        { id: 'sfd', label: 'SFD', icon: Activity, color: 'text-orange-500' },
        { id: 'reactions', label: 'Reactions', icon: ArrowDownToLine, color: 'text-purple-500' },
        { id: 'axial', label: 'Axial', icon: SlidersHorizontal, color: 'text-red-500' }
    ];

    const handleDiagramToggle = (type: DiagramType) => {
        setActiveDiagram(activeDiagram === type ? null : type);
    };

    const handleScaleChange = (newScale: number) => {
        setScale(newScale);
    };

    const toggleAnimation = () => {
        setIsAnimating(!isAnimating);
    };

    const resetView = () => {
        setScale(50);
        setActiveDiagram('deflection');
        setIsAnimating(false);
    };

    // Calculate max values safely
    const getMaxDisplacement = (): string => {
        if (!analysisResults.displacements || analysisResults.displacements.size === 0) return '-';
        const values = Array.from(analysisResults.displacements.values());
        const max = Math.max(...values.map(d => Math.abs(d.dy)));
        return `${max.toFixed(4)} m`;
    };

    const getMaxReaction = (): string => {
        if (!analysisResults.reactions || analysisResults.reactions.size === 0) return '-';
        const values = Array.from(analysisResults.reactions.values());
        const max = Math.max(...values.map(r => Math.abs(r.fy) / 1000));
        return `${max.toFixed(2)} kN`;
    };

    if (!isExpanded) {
        return (
            <div className="fixed bottom-4 right-4 z-40">
                <button
                    onClick={() => setIsExpanded(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-zinc-900 text-white rounded-lg shadow-lg hover:bg-zinc-800 transition-colors"
                >
                    <BarChart2 className="w-4 h-4" />
                    <span className="text-sm font-medium">Results</span>
                    <Maximize2 className="w-3 h-3" />
                </button>
            </div>
        );
    }

    return (
        <div className="fixed bottom-4 right-4 z-40 w-80 bg-white dark:bg-zinc-900 rounded-xl shadow-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white">
                <div className="flex items-center gap-2">
                    <BarChart2 className="w-4 h-4" />
                    <span className="font-medium">Analysis Results</span>
                </div>
                <div className="flex items-center gap-1">
                    <button
                        onClick={() => setIsExpanded(false)}
                        className="p-1 rounded hover:bg-white/20 transition-colors"
                        title="Minimize"
                    >
                        <Minimize2 className="w-4 h-4" />
                    </button>
                    {onClose && (
                        <button
                            onClick={onClose}
                            className="p-1 rounded hover:bg-white/20 transition-colors"
                            title="Close"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    )}
                </div>
            </div>

            {/* Diagram Toggles */}
            <div className="px-4 py-3 border-b border-zinc-200 dark:border-zinc-800">
                <h4 className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-2 uppercase tracking-wider">
                    Diagrams
                </h4>
                <div className="grid grid-cols-5 gap-1">
                    {diagrams.map((diagram) => {
                        const Icon = diagram.icon;
                        const isActive = activeDiagram === diagram.id;

                        return (
                            <button
                                key={diagram.id}
                                onClick={() => handleDiagramToggle(diagram.id)}
                                className={`
                                    flex flex-col items-center gap-1 p-2 rounded-lg transition-all
                                    ${isActive
                                        ? 'bg-zinc-100 dark:bg-zinc-800'
                                        : 'hover:bg-zinc-50 dark:hover:bg-zinc-800/50'
                                    }
                                `}
                                title={diagram.label}
                            >
                                <Icon className={`w-4 h-4 ${isActive ? diagram.color : 'text-zinc-400'}`} />
                                <span className={`text-[9px] ${isActive ? 'text-zinc-900 dark:text-white' : 'text-zinc-400'}`}>
                                    {diagram.label}
                                </span>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Scale Slider */}
            <div className="px-4 py-3 border-b border-zinc-200 dark:border-zinc-800">
                <div className="flex items-center justify-between mb-2">
                    <h4 className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                        Scale
                    </h4>
                    <span className="text-xs font-mono text-zinc-600 dark:text-zinc-400">
                        {scale}x
                    </span>
                </div>
                <input
                    type="range"
                    min="1"
                    max="200"
                    value={scale}
                    onChange={(e) => handleScaleChange(Number(e.target.value))}
                    className="w-full h-2 bg-zinc-200 dark:bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-blue-600"
                />
                <div className="flex justify-between text-[10px] text-zinc-400 mt-1">
                    <span>1x</span>
                    <span>100x</span>
                    <span>200x</span>
                </div>
            </div>

            {/* Animation Controls */}
            <div className="px-4 py-3 border-b border-zinc-200 dark:border-zinc-800">
                <h4 className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-2 uppercase tracking-wider">
                    Animation
                </h4>
                <div className="flex items-center gap-2">
                    <button
                        onClick={toggleAnimation}
                        className={`
                            flex items-center gap-2 px-3 py-2 rounded-lg transition-colors flex-1
                            ${isAnimating
                                ? 'bg-red-100 dark:bg-red-900/30 text-red-600'
                                : 'bg-blue-100 dark:bg-blue-900/30 text-blue-600'
                            }
                        `}
                    >
                        {isAnimating ? (
                            <>
                                <Pause className="w-4 h-4" />
                                <span className="text-sm font-medium">Stop</span>
                            </>
                        ) : (
                            <>
                                <Play className="w-4 h-4" />
                                <span className="text-sm font-medium">Animate</span>
                            </>
                        )}
                    </button>
                    <button
                        onClick={resetView}
                        className="p-2 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
                        title="Reset View"
                    >
                        <RotateCcw className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* Quick Stats */}
            <div className="px-4 py-3">
                <h4 className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-2 uppercase tracking-wider">
                    Max Values
                </h4>
                <div className="grid grid-cols-2 gap-2">
                    <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                        <div className="text-[10px] text-blue-600 dark:text-blue-400">Max Displacement</div>
                        <div className="text-sm font-bold text-blue-700 dark:text-blue-300">
                            {getMaxDisplacement()}
                        </div>
                    </div>
                    <div className="p-2 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                        <div className="text-[10px] text-purple-600 dark:text-purple-400">Max Reaction</div>
                        <div className="text-sm font-bold text-purple-700 dark:text-purple-300">
                            {getMaxReaction()}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ResultsToolbar;
