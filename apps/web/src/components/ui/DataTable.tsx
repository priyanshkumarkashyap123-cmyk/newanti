/**
 * DataTable - Professional data table for engineering results
 * Used for reactions, forces, member results, and design checks
 */

import { FC, ReactNode } from 'react';

export interface DataTableColumn<T> {
    key: string;
    header: string;
    align?: 'left' | 'center' | 'right';
    width?: string;
    render?: (row: T) => ReactNode;
}

export interface DataTableProps<T> {
    columns: DataTableColumn<T>[];
    data: T[];
    onRowClick?: (row: T) => void;
    highlightRow?: (row: T) => boolean | string; // Returns true or CSS class
    emptyMessage?: string;
    compact?: boolean;
}

export function DataTable<T extends Record<string, any>>({
    columns,
    data,
    onRowClick,
    highlightRow,
    emptyMessage = 'No data available',
    compact = false,
}: DataTableProps<T>) {
    return (
        <div className="overflow-auto flex-1">
            <table className="w-full text-left border-collapse">
                <thead className="bg-zinc-900 sticky top-0 z-10">
                    <tr>
                        {columns.map((col) => (
                            <th
                                key={col.key}
                                className={`
                                    ${compact ? 'p-2' : 'p-3'}
                                    text-xs font-bold text-zinc-400 uppercase tracking-wider 
                                    border-b border-zinc-700
                                    ${col.align === 'right' ? 'text-right' : ''}
                                    ${col.align === 'center' ? 'text-center' : ''}
                                `}
                                style={{ width: col.width }}
                            >
                                {col.header}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody className="text-sm divide-y divide-zinc-700">
                    {data.length === 0 ? (
                        <tr>
                            <td
                                colSpan={columns.length}
                                className="p-8 text-center text-zinc-500"
                            >
                                {emptyMessage}
                            </td>
                        </tr>
                    ) : (
                        data.map((row, rowIndex) => {
                            const highlight = highlightRow?.(row);
                            const highlightClass = typeof highlight === 'string'
                                ? highlight
                                : highlight
                                    ? 'bg-zinc-800'
                                    : '';

                            return (
                                <tr
                                    key={rowIndex}
                                    onClick={() => onRowClick?.(row)}
                                    className={`
                                        hover:bg-zinc-800/50 transition-colors
                                        ${onRowClick ? 'cursor-pointer' : ''}
                                        ${highlightClass}
                                    `}
                                >
                                    {columns.map((col) => (
                                        <td
                                            key={col.key}
                                            className={`
                                                ${compact ? 'p-2' : 'p-3'}
                                                text-zinc-300
                                                ${col.align === 'right' ? 'text-right' : ''}
                                                ${col.align === 'center' ? 'text-center' : ''}
                                            `}
                                        >
                                            {col.render ? col.render(row) : row[col.key]}
                                        </td>
                                    ))}
                                </tr>
                            );
                        })
                    )}
                </tbody>
            </table>
        </div>
    );
}

export default DataTable;
