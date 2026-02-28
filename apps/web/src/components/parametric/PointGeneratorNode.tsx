/**
 * PointGeneratorNode - Create 3D Points
 * 
 * Generates single points or arrays of points for geometry creation.
 */

import { FC, memo, useCallback } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { HANDLE_STYLES, NODE_COLORS, PointGeneratorData } from './nodeTypes';

const PointGeneratorNode: FC<NodeProps<PointGeneratorData>> = ({ data, isConnectable }) => {
    const handleCoordChange = useCallback((coord: 'x' | 'y' | 'z', value: string) => {
        const numValue = parseFloat(value) || 0;
        data.onChange?.({
            ...data.point,
            [coord]: numValue
        });
    }, [data]);

    return (
        <div
            className="rounded-lg shadow-lg min-w-[180px] overflow-hidden"
            style={{ backgroundColor: '#1E293B' }}
        >
            {/* Header */}
            <div
                className="px-3 py-2 text-zinc-900 dark:text-white text-sm font-medium"
                style={{ backgroundColor: NODE_COLORS.geometry }}
            >
                {data.label || 'Point'}
            </div>

            {/* Input Handles */}
            <Handle
                type="target"
                position={Position.Left}
                id="x"
                style={{ ...HANDLE_STYLES.input, top: '40%' }}
                isConnectable={isConnectable}
            />
            <Handle
                type="target"
                position={Position.Left}
                id="y"
                style={{ ...HANDLE_STYLES.input, top: '55%' }}
                isConnectable={isConnectable}
            />
            <Handle
                type="target"
                position={Position.Left}
                id="z"
                style={{ ...HANDLE_STYLES.input, top: '70%' }}
                isConnectable={isConnectable}
            />

            {/* Body */}
            <div className="p-3 space-y-2">
                {['x', 'y', 'z'].map((coord) => (
                    <div key={coord} className="flex items-center gap-2">
                        <label className="text-gray-500 dark:text-gray-400 text-xs uppercase w-4">{coord}</label>
                        <input
                            type="number"
                            value={data.point?.[coord as 'x' | 'y' | 'z'] ?? 0}
                            onChange={(e) => handleCoordChange(coord as 'x' | 'y' | 'z', e.target.value)}
                            step={0.1}
                            className="flex-1 px-2 py-1 bg-slate-200 dark:bg-slate-700 text-zinc-900 dark:text-white text-sm rounded border border-slate-600 focus:border-purple-500 focus:outline-none"
                        />
                    </div>
                ))}
            </div>

            {/* Output Handle */}
            <Handle
                type="source"
                position={Position.Right}
                id="point"
                style={{ ...HANDLE_STYLES.output, top: '50%' }}
                isConnectable={isConnectable}
            />
        </div>
    );
};

export default memo(PointGeneratorNode);
