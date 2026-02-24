/**
 * FrameRepeaterNode - Repeat Geometry in a Pattern
 * 
 * Takes a set of points and repeats them to create frame structures.
 */

import { FC, memo, useCallback } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { HANDLE_STYLES, NODE_COLORS, FrameRepeaterData } from './nodeTypes';

const FrameRepeaterNode: FC<NodeProps<FrameRepeaterData>> = ({ data, isConnectable }) => {
    const handleChange = useCallback((field: string, value: any) => {
        data.onChange?.({ [field]: value });
    }, [data]);

    return (
        <div
            className="rounded-lg shadow-lg min-w-[200px] overflow-hidden"
            style={{ backgroundColor: '#1E293B' }}
        >
            {/* Header */}
            <div
                className="px-3 py-2 text-white text-sm font-medium flex items-center gap-2"
                style={{ backgroundColor: NODE_COLORS.transform }}
            >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="3" width="6" height="6" />
                    <rect x="9" y="9" width="6" height="6" />
                    <rect x="15" y="15" width="6" height="6" />
                </svg>
                {data.label || 'Frame Repeater'}
            </div>

            {/* Input Handle */}
            <Handle
                type="target"
                position={Position.Left}
                id="points"
                style={{ ...HANDLE_STYLES.input, top: '30%' }}
                isConnectable={isConnectable}
            />

            {/* Body */}
            <div className="p-3 space-y-3">
                {/* Input indicator */}
                <div className="flex items-center gap-2">
                    <span className="text-gray-400 text-xs">Input</span>
                    <div className="flex-1 px-2 py-1 bg-slate-700/50 text-gray-500 text-xs rounded text-center">
                        {data.basePoints?.length ? `${data.basePoints.length} points` : 'Connect points'}
                    </div>
                </div>

                {/* Count */}
                <div className="flex items-center gap-2">
                    <label className="text-gray-400 text-xs w-16">Count</label>
                    <input
                        type="number"
                        value={data.repeatCount ?? 3}
                        min={1}
                        max={50}
                        onChange={(e) => handleChange('repeatCount', parseInt(e.target.value) || 1)}
                        className="flex-1 px-2 py-1 bg-slate-700 text-white text-sm rounded border border-slate-600 focus:border-orange-500 focus:outline-none"
                    />
                </div>

                {/* Spacing */}
                <div className="flex items-center gap-2">
                    <label className="text-gray-400 text-xs w-16">Spacing</label>
                    <input
                        type="number"
                        value={data.spacing ?? 4}
                        min={0.1}
                        step={0.5}
                        onChange={(e) => handleChange('spacing', parseFloat(e.target.value) || 1)}
                        className="flex-1 px-2 py-1 bg-slate-700 text-white text-sm rounded border border-slate-600 focus:border-orange-500 focus:outline-none"
                    />
                    <span className="text-gray-500 text-xs">m</span>
                </div>

                {/* Direction */}
                <div className="flex items-center gap-2">
                    <label className="text-gray-400 text-xs w-16">Direction</label>
                    <div className="flex-1 flex gap-1">
                        {['x', 'y', 'z'].map((dir) => (
                            <button
                                key={dir}
                                onClick={() => handleChange('direction', dir)}
                                className={`flex-1 px-2 py-1 text-xs font-bold rounded transition-colors ${data.direction === dir
                                        ? 'bg-orange-500 text-white'
                                        : 'bg-slate-700 text-gray-400 hover:bg-slate-600'
                                    }`}
                            >
                                {dir.toUpperCase()}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Preview stats */}
                <div className="pt-2 border-t border-slate-600 text-center">
                    <span className="text-gray-500 text-xs">
                        Will generate: {(data.basePoints?.length || 0) * (data.repeatCount || 1)} nodes
                    </span>
                </div>
            </div>

            {/* Output Handles */}
            <Handle
                type="source"
                position={Position.Right}
                id="nodes"
                style={{ ...HANDLE_STYLES.output, top: '40%' }}
                isConnectable={isConnectable}
            />
            <Handle
                type="source"
                position={Position.Right}
                id="members"
                style={{ ...HANDLE_STYLES.output, top: '60%' }}
                isConnectable={isConnectable}
            />

            {/* Output Labels */}
            <div className="absolute right-4 text-gray-400 text-[10px]" style={{ top: '38%' }}>Nodes</div>
            <div className="absolute right-4 text-gray-400 text-[10px]" style={{ top: '58%' }}>Members</div>
        </div>
    );
};

export default memo(FrameRepeaterNode);
