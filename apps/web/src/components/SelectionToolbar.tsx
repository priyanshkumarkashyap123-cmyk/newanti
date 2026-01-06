/**
 * SelectionToolbar.tsx - Advanced Selection Tools
 * 
 * Provides professional-grade selection capabilities:
 * - Select by Node IDs (N1,N2,N5-N10)
 * - Select by Level/Story
 * - Select members parallel to X/Y/Z axes
 * - Select by Material/Section
 */

import { FC, useState } from 'react';
import { X, Hash, Layers, Ruler, Box } from 'lucide-react';
import { useModelStore } from '../store/model';

interface SelectionToolbarProps {
    open: boolean;
    onClose: () => void;
}

export const SelectionToolbar: FC<SelectionToolbarProps> = ({ open, onClose }) => {
    const nodes = useModelStore(state => state.nodes);
    const members = useModelStore(state => state.members);
    const selectMultiple = useModelStore(state => state.selectMultiple);
    const clearSelection = useModelStore(state => state.clearSelection);

    const [nodeIdInput, setNodeIdInput] = useState('');
    const [levelZ, setLevelZ] = useState(0);
    const [levelTolerance, setLevelTolerance] = useState(0.1);
    const [axisSelection, setAxisSelection] = useState<'X' | 'Y' | 'Z'>('X');
    const [axisTolerance, setAxisTolerance] = useState(0.1);

    // Parse node ID input (e.g., "N1,N2,N5-N10")
    const parseNodeIds = (input: string): string[] => {
        const ids: string[] = [];
        const parts = input.split(',').map(p => p.trim());

        for (const part of parts) {
            if (part.includes('-')) {
                // Range: N5-N10
                const [start, end] = part.split('-');
                const startNum = parseInt(start.replace('N', ''));
                const endNum = parseInt(end.replace('N', ''));
                if (!isNaN(startNum) && !isNaN(endNum)) {
                    for (let i = startNum; i <= endNum; i++) {
                        ids.push(`N${i}`);
                    }
                }
            } else {
                // Single ID
                ids.push(part);
            }
        }
        return ids;
    };

    const handleSelectByIds = () => {
        const idsToSelect = parseNodeIds(nodeIdInput);
        const validIds = idsToSelect.filter(id => nodes.has(id));
        if (validIds.length > 0) {
            clearSelection();
            selectMultiple(validIds);
            onClose();
        }
    };

    const handleSelectByLevel = () => {
        const nodesAtLevel: string[] = [];
        nodes.forEach((node, id) => {
            if (Math.abs(node.z - levelZ) <= levelTolerance) {
                nodesAtLevel.push(id);
            }
        });

        if (nodesAtLevel.length > 0) {
            clearSelection();
            selectMultiple(nodesAtLevel);
            onClose();
        }
    };

    const handleSelectByAxis = () => {
        const membersParallel: string[] = [];

        members.forEach((member, id) => {
            const startNode = nodes.get(member.startNodeId);
            const endNode = nodes.get(member.endNodeId);

            if (!startNode || !endNode) return;

            const dx = Math.abs(endNode.x - startNode.x);
            const dy = Math.abs(endNode.y - startNode.y);
            const dz = Math.abs(endNode.z - startNode.z);

            let isParallel = false;

            switch (axisSelection) {
                case 'X':
                    // Parallel to X if Y and Z differences are small
                    isParallel = dy <= axisTolerance && dz <= axisTolerance && dx > axisTolerance;
                    break;
                case 'Y':
                    // Parallel to Y if X and Z differences are small
                    isParallel = dx <= axisTolerance && dz <= axisTolerance && dy > axisTolerance;
                    break;
                case 'Z':
                    // Parallel to Z if X and Y differences are small
                    isParallel = dx <= axisTolerance && dy <= axisTolerance && dz > axisTolerance;
                    break;
            }

            if (isParallel) {
                membersParallel.push(id);
            }
        });

        if (membersParallel.length > 0) {
            clearSelection();
            selectMultiple(membersParallel);
            onClose();
        }
    };

    // Get unique levels from nodes
    const getUniqueLevels = (): number[] => {
        const levels = new Set<number>();
        nodes.forEach(node => {
            // Round to 2 decimal places to group similar levels
            levels.add(Math.round(node.z * 100) / 100);
        });
        return Array.from(levels).sort((a, b) => a - b);
    };

    const uniqueLevels = getUniqueLevels();

    if (!open) return null;

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-slate-900 rounded-xl shadow-2xl border border-slate-700 w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700 bg-gradient-to-r from-slate-800 to-slate-900">
                    <div className="flex items-center gap-3">
                        <Box className="w-6 h-6 text-purple-400" />
                        <div>
                            <h2 className="text-xl font-bold text-white">Advanced Selection</h2>
                            <p className="text-sm text-slate-400">
                                Professional selection tools for complex structures
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-slate-700 rounded-lg transition-colors text-slate-400 hover:text-white"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {/* Select by Node IDs */}
                    <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
                        <div className="flex items-center gap-2 mb-3">
                            <Hash className="w-5 h-5 text-blue-400" />
                            <h3 className="font-semibold text-white">Select by Node IDs</h3>
                        </div>
                        <p className="text-sm text-slate-400 mb-3">
                            Enter node IDs separated by commas. Use ranges like "N1-N10" for consecutive nodes.
                        </p>
                        <div className="space-y-3">
                            <input
                                type="text"
                                value={nodeIdInput}
                                onChange={(e) => setNodeIdInput(e.target.value)}
                                placeholder="e.g., N1,N2,N5-N10,N15"
                                className="w-full px-4 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none"
                            />
                            <button
                                onClick={handleSelectByIds}
                                disabled={!nodeIdInput.trim()}
                                className={`w-full py-2 rounded-lg font-medium transition-all ${nodeIdInput.trim()
                                        ? 'bg-blue-600 hover:bg-blue-700 text-white'
                                        : 'bg-slate-700 text-slate-500 cursor-not-allowed'
                                    }`}
                            >
                                Select Nodes by IDs
                            </button>
                        </div>
                    </div>

                    {/* Select by Level */}
                    <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
                        <div className="flex items-center gap-2 mb-3">
                            <Layers className="w-5 h-5 text-green-400" />
                            <h3 className="font-semibold text-white">Select by Level/Story</h3>
                        </div>
                        <p className="text-sm text-slate-400 mb-3">
                            Select all nodes at a specific elevation (Z-coordinate).
                        </p>
                        <div className="space-y-3">
                            {/* Quick level buttons */}
                            {uniqueLevels.length > 0 && (
                                <div className="flex flex-wrap gap-2">
                                    {uniqueLevels.map(level => (
                                        <button
                                            key={level}
                                            onClick={() => setLevelZ(level)}
                                            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${levelZ === level
                                                    ? 'bg-green-600 text-white'
                                                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                                                }`}
                                        >
                                            Z = {level.toFixed(2)}m
                                        </button>
                                    ))}
                                </div>
                            )}

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs text-slate-400 mb-1">Elevation (m)</label>
                                    <input
                                        type="number"
                                        step="0.5"
                                        value={levelZ}
                                        onChange={(e) => setLevelZ(parseFloat(e.target.value) || 0)}
                                        className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs text-slate-400 mb-1">Tolerance (m)</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={levelTolerance}
                                        onChange={(e) => setLevelTolerance(parseFloat(e.target.value) || 0.1)}
                                        className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white"
                                    />
                                </div>
                            </div>
                            <button
                                onClick={handleSelectByLevel}
                                className="w-full bg-green-600 hover:bg-green-700 text-white py-2 rounded-lg font-medium transition-colors"
                            >
                                Select Nodes at Level
                            </button>
                        </div>
                    </div>

                    {/* Select Members Parallel to Axis */}
                    <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
                        <div className="flex items-center gap-2 mb-3">
                            <Ruler className="w-5 h-5 text-orange-400" />
                            <h3 className="font-semibold text-white">Select Members Parallel to Axis</h3>
                        </div>
                        <p className="text-sm text-slate-400 mb-3">
                            Select beams, columns, or bracing aligned with X, Y, or Z axis.
                        </p>
                        <div className="space-y-3">
                            <div className="grid grid-cols-3 gap-2">
                                {(['X', 'Y', 'Z'] as const).map(axis => (
                                    <button
                                        key={axis}
                                        onClick={() => setAxisSelection(axis)}
                                        className={`py-3 rounded-lg font-medium transition-all ${axisSelection === axis
                                                ? 'bg-orange-600 text-white shadow-lg'
                                                : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                                            }`}
                                    >
                                        {axis}-Axis
                                        <div className="text-xs opacity-75 mt-1">
                                            {axis === 'X' ? 'Longitudinal' : axis === 'Y' ? 'Vertical' : 'Lateral'}
                                        </div>
                                    </button>
                                ))}
                            </div>
                            <div>
                                <label className="block text-xs text-slate-400 mb-1">Angle Tolerance (m)</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    value={axisTolerance}
                                    onChange={(e) => setAxisTolerance(parseFloat(e.target.value) || 0.1)}
                                    className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white"
                                />
                            </div>
                            <button
                                onClick={handleSelectByAxis}
                                className="w-full bg-orange-600 hover:bg-orange-700 text-white py-2 rounded-lg font-medium transition-colors"
                            >
                                Select Members Parallel to {axisSelection}-Axis
                            </button>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-slate-700 bg-slate-800/50 flex justify-between items-center">
                    <div className="text-sm text-slate-400">
                        {nodes.size} nodes • {members.size} members in model
                    </div>
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
};

export default SelectionToolbar;
