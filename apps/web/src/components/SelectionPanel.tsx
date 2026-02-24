/**
 * SelectionPanel - Shows selected nodes/members and provides analysis actions
 * Displays when items are selected and provides context-specific actions
 */

import { FC, useMemo } from 'react';
import { useModelStore } from '../store/model';

interface SelectionPanelProps {
    onRunAnalysis?: () => void;
    onApplyLoad?: () => void;
    onApplySupport?: () => void;
    onDelete?: () => void;
}

export const SelectionPanel: FC<SelectionPanelProps> = ({
    onRunAnalysis,
    onApplyLoad,
    onApplySupport,
    onDelete,
}) => {
    const selectedIds = useModelStore((s) => s.selectedIds);
    const nodes = useModelStore((s) => s.nodes);
    const members = useModelStore((s) => s.members);
    const clearSelection = useModelStore((s) => s.clearSelection);

    // Categorize selections
    const { selectedNodes, selectedMembers } = useMemo(() => {
        const selectedNodes: string[] = [];
        const selectedMembers: string[] = [];

        selectedIds.forEach((id) => {
            if (nodes.has(id)) {
                selectedNodes.push(id);
            } else if (members.has(id)) {
                selectedMembers.push(id);
            }
        });

        return { selectedNodes, selectedMembers };
    }, [selectedIds, nodes, members]);

    // If nothing selected, don't show
    if (selectedIds.size === 0) return null;

    const totalSelected = selectedIds.size;
    const hasNodes = selectedNodes.length > 0;
    const hasMembers = selectedMembers.length > 0;

    return (
        <div className="absolute bottom-20 left-1/2 -translate-x-1/2 z-40">
            <div className="bg-surface-dark border border-border-dark rounded-xl shadow-2xl p-4 min-w-[300px] max-w-md">
                {/* Header */}
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-primary text-[20px]">
                            check_box
                        </span>
                        <span className="text-white font-bold text-sm">
                            {totalSelected} item{totalSelected !== 1 ? 's' : ''} selected
                        </span>
                    </div>
                    <button
                        onClick={clearSelection}
                        className="text-text-muted hover:text-white transition-colors p-1"
                        title="Clear Selection"
                    >
                        <span className="material-symbols-outlined text-[18px]">close</span>
                    </button>
                </div>

                {/* Selection Summary */}
                <div className="flex gap-3 mb-4 text-xs">
                    {hasNodes && (
                        <div className="flex items-center gap-1.5 bg-green-500/10 text-green-400 px-2 py-1 rounded">
                            <span className="material-symbols-outlined text-[14px]">radio_button_checked</span>
                            <span>{selectedNodes.length} node{selectedNodes.length !== 1 ? 's' : ''}</span>
                        </div>
                    )}
                    {hasMembers && (
                        <div className="flex items-center gap-1.5 bg-blue-500/10 text-blue-400 px-2 py-1 rounded">
                            <span className="material-symbols-outlined text-[14px]">horizontal_rule</span>
                            <span>{selectedMembers.length} member{selectedMembers.length !== 1 ? 's' : ''}</span>
                        </div>
                    )}
                </div>

                {/* Selected IDs List (scrollable) */}
                <div className="bg-zinc-900/50 rounded-lg p-2 mb-3 max-h-24 overflow-y-auto">
                    <div className="flex flex-wrap gap-1.5">
                        {selectedNodes.map((id) => (
                            <span key={id} className="text-[10px] font-mono bg-green-500/20 text-green-400 px-1.5 py-0.5 rounded">
                                N:{id}
                            </span>
                        ))}
                        {selectedMembers.map((id) => (
                            <span key={id} className="text-[10px] font-mono bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded">
                                M:{id}
                            </span>
                        ))}
                    </div>
                </div>

                {/* Quick Actions */}
                <div className="flex flex-wrap gap-2">
                    {hasNodes && onApplySupport && (
                        <button
                            onClick={onApplySupport}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-orange-500/20 text-orange-400 hover:bg-orange-500/30 transition-colors"
                        >
                            <span className="material-symbols-outlined text-[14px]">push_pin</span>
                            Apply Support
                        </button>
                    )}
                    {hasNodes && onApplyLoad && (
                        <button
                            onClick={onApplyLoad}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors"
                        >
                            <span className="material-symbols-outlined text-[14px]">arrow_downward</span>
                            Apply Load
                        </button>
                    )}
                    {hasMembers && onApplyLoad && (
                        <button
                            onClick={onApplyLoad}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-purple-500/20 text-purple-400 hover:bg-purple-500/30 transition-colors"
                        >
                            <span className="material-symbols-outlined text-[14px]">stacked_line_chart</span>
                            Member Load
                        </button>
                    )}
                    {onRunAnalysis && (
                        <button
                            onClick={onRunAnalysis}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-primary/20 text-primary hover:bg-primary/30 transition-colors"
                        >
                            <span className="material-symbols-outlined text-[14px]">play_arrow</span>
                            Analyze
                        </button>
                    )}
                    {onDelete && (
                        <button
                            onClick={onDelete}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-zinc-700/50 text-zinc-400 hover:bg-red-500/20 hover:text-red-400 transition-colors ml-auto"
                        >
                            <span className="material-symbols-outlined text-[14px]">delete</span>
                            Delete
                        </button>
                    )}
                </div>

                {/* Multi-select hint */}
                <div className="mt-3 pt-2 border-t border-border-dark">
                    <p className="text-[10px] text-text-muted text-center">
                        <span className="font-medium">Tip:</span> Hold <kbd className="bg-zinc-700 px-1 rounded">Shift</kbd> or <kbd className="bg-zinc-700 px-1 rounded">Ctrl</kbd> to multi-select
                    </p>
                </div>
            </div>
        </div>
    );
};

export default SelectionPanel;
