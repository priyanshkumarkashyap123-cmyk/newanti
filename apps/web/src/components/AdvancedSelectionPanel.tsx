import { FC, useState, useMemo } from 'react';
import { useModelStore } from '../store/model';
import { useUIStore } from '../store/uiStore';
import { X, ArrowRight, MousePointer2, Layers, Move3d, Ruler } from 'lucide-react';

type Tab = 'range' | 'parallel' | 'property';

export const AdvancedSelectionPanel: FC = () => {
    const selectByCoordinate = useModelStore((s) => s.selectByCoordinate);
    const selectParallel = useModelStore((s) => s.selectParallel);
    const selectByProperty = useModelStore((s) => s.selectByProperty);
    const selectedIds = useModelStore((s) => s.selectedIds);
    const members = useModelStore((s) => s.members);

    // UI Store access
    const activeTool = useUIStore((s) => s.activeTool);
    const setActiveTool = useUIStore((s) => s.setActiveTool);

    // Local state
    const [activeTab, setActiveTab] = useState<Tab>('range');
    const [axis, setAxis] = useState<'x' | 'y' | 'z'>('y');
    const [minVal, setMinVal] = useState<string>('0');
    const [maxVal, setMaxVal] = useState<string>('3');
    const [addToSelection, setAddToSelection] = useState(false);

    // Property state
    const [selectedPropValue, setSelectedPropValue] = useState<string>('');

    // Get unique properties from model (moved before early return to comply with React hooks rules)
    const uniqueSections = useMemo(() => {
        const sections = new Set<string>();
        members.forEach(m => {
            if (m.sectionId) sections.add(m.sectionId);
        });
        return Array.from(sections).sort();
    }, [members]);

    // Only show if tool is active
    if (activeTool !== 'select_range') return null;

    const handleRangeSelect = () => {
        const min = parseFloat(minVal);
        const max = parseFloat(maxVal);
        if (isNaN(min) || isNaN(max)) return;
        selectByCoordinate(axis, min, max, addToSelection);
    };

    const handleParallelSelect = (selectAxis: 'x' | 'y' | 'z') => {
        selectParallel(selectAxis, addToSelection);
    };

    const handlePropertySelect = () => {
        if (!selectedPropValue) return;
        selectByProperty('sectionId', selectedPropValue, addToSelection);
    };

    return (
        <div className="absolute top-20 left-20 z-50 w-80 bg-white/95 dark:bg-slate-900/95 backdrop-blur border border-slate-200/50 dark:border-slate-700/50 rounded-xl shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50">
                <div className="flex items-center gap-2">
                    <span className="p-1.5 rounded-lg bg-blue-500/10 text-blue-400">
                        <MousePointer2 className="w-4 h-4" />
                    </span>
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Advanced Selection</h3>
                </div>
                <button type="button"
                    onClick={() => setActiveTool(null)}
                    className="text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
                >
                    <X className="w-4 h-4" />
                </button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-slate-200 dark:border-slate-800">
                <button type="button"
                    onClick={() => setActiveTab('range')}
                    className={`flex-1 py-2 text-xs font-medium transition-colors flex items-center justify-center gap-1.5
                        ${activeTab === 'range' ? 'text-blue-400 border-b-2 border-blue-500 bg-blue-500/5' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}
                >
                    <Ruler className="w-3 h-3" />
                    Range
                </button>
                <button type="button"
                    onClick={() => setActiveTab('parallel')}
                    className={`flex-1 py-2 text-xs font-medium transition-colors flex items-center justify-center gap-1.5
                        ${activeTab === 'parallel' ? 'text-blue-400 border-b-2 border-blue-500 bg-blue-500/5' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}
                >
                    <Move3d className="w-3 h-3" />
                    Parallel
                </button>
                <button type="button"
                    onClick={() => setActiveTab('property')}
                    className={`flex-1 py-2 text-xs font-medium transition-colors flex items-center justify-center gap-1.5
                        ${activeTab === 'property' ? 'text-blue-400 border-b-2 border-blue-500 bg-blue-500/5' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}
                >
                    <Layers className="w-3 h-3" />
                    Property
                </button>
            </div>

            {/* Content */}
            <div className="p-4 space-y-4">

                {/* RANGE SELECTION */}
                {activeTab === 'range' && (
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-xs font-medium text-slate-500 dark:text-slate-400">Select Axis</label>
                            <div className="flex gap-2 p-1 bg-slate-100/50 dark:bg-slate-800/50 rounded-lg">
                                {(['x', 'y', 'z'] as const).map((a) => (
                                    <button type="button"
                                        key={a}
                                        onClick={() => setAxis(a)}
                                        className={`
                                            flex-1 py-1.5 text-xs font-medium rounded-md uppercase transition-all
                                            ${axis === a
                                                ? 'bg-blue-600 text-white shadow-lg'
                                                : 'text-slate-500 dark:text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800'
                                            }
                                        `}
                                    >
                                        {a}-Axis
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Min (m)</label>
                                <input
                                    type="number"
                                    step="0.1"
                                    value={minVal}
                                    onChange={(e) => setMinVal(e.target.value)}
                                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-blue-500 transition-colors"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Max (m)</label>
                                <input
                                    type="number"
                                    step="0.1"
                                    value={maxVal}
                                    onChange={(e) => setMaxVal(e.target.value)}
                                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-blue-500 transition-colors"
                                />
                            </div>
                        </div>

                        <button type="button"
                            onClick={handleRangeSelect}
                            className="w-full mt-2 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white py-2.5 rounded-lg text-sm font-medium transition-all shadow-lg shadow-blue-900/20 active:scale-[0.98]"
                        >
                            Select Elements
                            <ArrowRight className="w-4 h-4" />
                        </button>
                    </div>
                )}

                {/* PARALLEL SELECTION */}
                {activeTab === 'parallel' && (
                    <div className="space-y-4">
                        <p className="text-xs text-slate-500 dark:text-slate-400">Select members parallel to a global axis.</p>
                        <div className="grid grid-cols-1 gap-3">
                            {(['x', 'y', 'z'] as const).map((a) => (
                                <button type="button"
                                    key={a}
                                    onClick={() => handleParallelSelect(a)}
                                    className="flex items-center justify-between px-4 py-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-lg group transition-all"
                                >
                                    <span className="text-sm font-medium text-slate-700 dark:text-slate-200">Parallel to {a.toUpperCase()}</span>
                                    <ArrowRight className="w-4 h-4 text-slate-500 dark:text-slate-400 group-hover:text-blue-400 transition-colors" />
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* PROPERTY SELECTION */}
                {activeTab === 'property' && (
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-xs font-medium text-slate-500 dark:text-slate-400">Section Property</label>
                            {uniqueSections.length === 0 ? (
                                <div className="p-3 text-xs text-slate-500 dark:text-slate-400 bg-slate-100/50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-800">
                                    No sections defined.
                                </div>
                            ) : (
                                <select
                                    value={selectedPropValue}
                                    onChange={(e) => setSelectedPropValue(e.target.value)}
                                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-blue-500 transition-colors"
                                >
                                    <option value="">Select Section...</option>
                                    {uniqueSections.map(s => (
                                        <option key={s} value={s}>{s}</option>
                                    ))}
                                </select>
                            )}
                        </div>
                        <button type="button"
                            onClick={handlePropertySelect}
                            disabled={!selectedPropValue}
                            className="w-full mt-2 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white py-2.5 rounded-lg text-sm font-medium transition-all shadow-lg shadow-blue-900/20 active:scale-[0.98]"
                        >
                            Select by Property
                            <ArrowRight className="w-4 h-4" />
                        </button>
                    </div>
                )}

                {/* Common Options */}
                <div className="pt-3 border-t border-slate-200 dark:border-slate-800">
                    <label className="flex items-center gap-2 cursor-pointer group">
                        <input
                            type="checkbox"
                            checked={addToSelection}
                            onChange={(e) => setAddToSelection(e.target.checked)}
                            className="rounded border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-blue-500 focus:ring-0 focus:ring-offset-0"
                        />
                        <span className="text-xs text-slate-500 group-hover:text-slate-700 dark:text-slate-200 transition-colors">Add to current selection</span>
                    </label>
                </div>

                {selectedIds.size > 0 && (
                    <p className="text-center text-[10px] text-green-400/80">
                        {selectedIds.size} items currently selected
                    </p>
                )}
            </div>
        </div>
    );
};
