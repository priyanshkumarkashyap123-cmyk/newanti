/**
 * LineConnectorNode - Create Lines Between Points
 * 
 * Connects two points and optionally divides the line into segments.
 */

import React from 'react';
import { FC, memo, useCallback } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { HANDLE_STYLES, NODE_COLORS, LineConnectorData } from './nodeTypes';

const LineConnectorNode: FC<NodeProps<LineConnectorData>> = ({ data, isConnectable }) => {
    const handleDivisionsChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const value = Math.max(1, parseInt(e.target.value) || 1);
        data.onChange?.({ divisions: value });
    }, [data]);

    return (
        <div
            className="rounded-lg shadow-lg min-w-[180px] overflow-hidden"
            style={{ backgroundColor: '#1E293B' }}
        >
            {/* Header */}
            <div
                className="px-3 py-2 text-[#dae2fd] text-sm font-medium tracking-wide tracking-wide"
                style={{ backgroundColor: NODE_COLORS.geometry }}
            >
                {data.label || 'Line Connector'}
            </div>

            {/* Input Handles */}
            <Handle
                type="target"
                position={Position.Left}
                id="start"
                style={{ ...HANDLE_STYLES.input, top: '35%' }}
                isConnectable={isConnectable}
            />
            <Handle
                type="target"
                position={Position.Left}
                id="end"
                style={{ ...HANDLE_STYLES.input, top: '55%' }}
                isConnectable={isConnectable}
            />

            {/* Body */}
            <div className="p-3 space-y-2">
                <div className="flex items-center gap-2">
                    <span className="text-[#869ab8] text-xs">Start</span>
                    <div className="flex-1 px-2 py-1 bg-slate-200/50 dark:bg-slate-700/50 text-slate-500 text-xs rounded text-center">
                        {data.startPoint ? `(${data.startPoint.x}, ${data.startPoint.y}, ${data.startPoint.z})` : 'Connect input'}
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-[#869ab8] text-xs">End</span>
                    <div className="flex-1 px-2 py-1 bg-slate-200/50 dark:bg-slate-700/50 text-slate-500 text-xs rounded text-center">
                        {data.endPoint ? `(${data.endPoint.x}, ${data.endPoint.y}, ${data.endPoint.z})` : 'Connect input'}
                    </div>
                </div>
                <div className="flex items-center gap-2 pt-1 border-t border-slate-600">
                    <label className="text-[#869ab8] text-xs">Divisions</label>
                    <input
                        type="number"
                        value={data.divisions ?? 1}
                        min={1}
                        max={50}
                        onChange={handleDivisionsChange}
                        className="flex-1 px-2 py-1 bg-slate-200 dark:bg-slate-700 text-[#dae2fd] text-sm rounded border border-slate-600 focus:border-purple-500 focus:outline-none"
                    />
                </div>
            </div>

            {/* Output Handles */}
            <Handle
                type="source"
                position={Position.Right}
                id="points"
                style={{ ...HANDLE_STYLES.output, top: '40%' }}
                isConnectable={isConnectable}
            />
            <Handle
                type="source"
                position={Position.Right}
                id="lines"
                style={{ ...HANDLE_STYLES.output, top: '60%' }}
                isConnectable={isConnectable}
            />

            {/* Output Labels */}
            <div className="absolute right-4 text-[#869ab8] text-[10px]" style={{ top: '38%' }}>Points</div>
            <div className="absolute right-4 text-[#869ab8] text-[10px]" style={{ top: '58%' }}>Lines</div>
        </div>
    );
};

export default memo(LineConnectorNode);
