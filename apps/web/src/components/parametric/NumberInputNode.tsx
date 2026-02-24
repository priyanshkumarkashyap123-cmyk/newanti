/**
 * NumberInputNode - Numeric Value Input
 * 
 * Provides a single numeric value output for parametric modeling.
 */

import { FC, memo, useCallback } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { HANDLE_STYLES, NODE_COLORS, NumberInputData } from './nodeTypes';

const NumberInputNode: FC<NodeProps<NumberInputData>> = ({ data, isConnectable }) => {
    const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const value = parseFloat(e.target.value) || 0;
        data.onChange?.(value);
    }, [data]);

    return (
        <div
            className="rounded-lg shadow-lg min-w-[160px] overflow-hidden"
            style={{ backgroundColor: '#1E293B' }}
        >
            {/* Header */}
            <div
                className="px-3 py-2 text-white text-sm font-medium"
                style={{ backgroundColor: NODE_COLORS.input }}
            >
                {data.label || 'Number'}
            </div>

            {/* Body */}
            <div className="p-3">
                <input
                    type="number"
                    value={data.value ?? 0}
                    min={data.min}
                    max={data.max}
                    step={data.step ?? 0.1}
                    onChange={handleChange}
                    className="w-full px-2 py-1.5 bg-slate-700 text-white text-sm rounded border border-slate-600 focus:border-blue-500 focus:outline-none"
                />
            </div>

            {/* Output Handle */}
            <Handle
                type="source"
                position={Position.Right}
                id="value"
                style={{ ...HANDLE_STYLES.output, top: '50%' }}
                isConnectable={isConnectable}
            />
        </div>
    );
};

export default memo(NumberInputNode);
