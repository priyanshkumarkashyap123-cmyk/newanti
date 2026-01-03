import { FC, useState } from 'react';
import { useModelStore } from '../store/model';
import { useUIStore } from '../store/uiStore';
import { X, ArrowRight, MousePointer2 } from 'lucide-react';

export const AdvancedSelectionPanel: FC = () => {
    const selectByCoordinate = useModelStore((s) => s.selectByCoordinate);
    const selectedIds = useModelStore((s) => s.selectedIds);
    const { activeTool, setActiveTool } = useUIStore();

    // Local state for inputs
    const [axis, setAxis] = useState<'x' | 'y' | 'z'>('y');
    const [minVal, setMinVal] = useState<string>('0');
    const [maxVal, setMaxVal] = useState<string>('3');
    const [addToSelection, setAddToSelection] = useState(false);

    // Only show if tool is active
    if (activeTool !== 'select_range') return null;

    const handleSelect = () => {
        const min = parseFloat(minVal);
        const max = parseFloat(maxVal);

        if (isNaN(min) || isNaN(max)) return;

        selectByCoordinate(axis, min, max, addToSelection);
    };

    return (
        <div className="absolute top-20 left-20 z-50 w-72 bg-surface-dark border border-border-dark rounded-xl shadow-2xl overflow-hidden glass-panel">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border-dark bg-zinc-900/50">
                <div className="flex items-center gap-2">
                    <span className="p-1.5 rounded-lg bg-blue-500/10 text-blue-400">
                        <MousePointer2 className="w-4 h-4" />
                    </span>
                    <h3 className="text-sm font-semibold text-white">Range Selection</h3>
                </div>
                <button
                    onClick={() => setActiveTool(null)}
                    className="text-zinc-500 hover:text-white transition-colors"
                >
                    <X className="w-4 h-4" />
                </button>
            </div>

            {/* Content */}
            <div className="p-4 space-y-4">
                {/* Axis Selection */}
                <div className="space-y-2">
                    <label className="text-xs font-medium text-zinc-400">Select Axis</label>
                    <div className="flex gap-2 p-1 bg-zinc-900/50 rounded-lg">
                        {(['x', 'y', 'z'] as const).map((a) => (
                            <button
                                key={a}
                                onClick={() => setAxis(a)}
                                className={`
                                    flex-1 py-1.5 text-xs font-medium rounded-md uppercase transition-all
                                    ${axis === a
                                        ? 'bg-blue-600 text-white shadow-lg'
                                        : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800'
                                    }
                                `}
                            >
                                {a}-Axis
                            </button>
                        ))}
                    </div>
                </div>

                {/* Range Inputs */}
                <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-medium text-zinc-500 uppercase tracking-wider">Min (m)</label>
                        <input
                            type="number"
                            step="0.1"
                            value={minVal}
                            onChange={(e) => setMinVal(e.target.value)}
                            className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500 transition-colors"
                        />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-medium text-zinc-500 uppercase tracking-wider">Max (m)</label>
                        <input
                            type="number"
                            step="0.1"
                            value={maxVal}
                            onChange={(e) => setMaxVal(e.target.value)}
                            className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500 transition-colors"
                        />
                    </div>
                </div>

                {/* Options */}
                <label className="flex items-center gap-2 cursor-pointer group">
                    <input
                        type="checkbox"
                        checked={addToSelection}
                        onChange={(e) => setAddToSelection(e.target.checked)}
                        className="rounded border-zinc-700 bg-zinc-900 text-blue-500 focus:ring-0 focus:ring-offset-0"
                    />
                    <span className="text-xs text-zinc-400 group-hover:text-zinc-200 transition-colors">Add to current selection</span>
                </label>

                {/* Action Button */}
                <button
                    onClick={handleSelect}
                    className="w-full mt-2 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white py-2.5 rounded-lg text-sm font-medium transition-all shadow-lg shadow-blue-900/20 active:scale-[0.98]"
                >
                    Select Elements
                    <ArrowRight className="w-4 h-4" />
                </button>

                {selectedIds.size > 0 && (
                    <p className="text-center text-[10px] text-green-400/80">
                        {selectedIds.size} items currently selected
                    </p>
                )}
            </div>
        </div>
    );
};
