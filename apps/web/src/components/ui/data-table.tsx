/**
 * DataTable - Virtualized Engineering Data Table
 * 
 * Uses @tanstack/react-table for column management
 * and @tanstack/react-virtual for virtualization (handles 10,000+ rows).
 * 
 * Features:
 * - Sticky header
 * - Striped rows
 * - Bordered cells
 * - Virtual scrolling
 */

import {
    useReactTable,
    getCoreRowModel,
    getSortedRowModel,
    getFilteredRowModel,
    flexRender,
    ColumnDef,
    SortingState,
    ColumnFiltersState,
    Row
} from '@tanstack/react-table';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useRef, useState, useMemo, useCallback } from 'react';
import { cn } from '../../lib/utils';
import { ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react';

// ============================================
// TYPES
// ============================================

export interface DataTableProps<TData> {
    data: TData[];
    columns: ColumnDef<TData, any>[];
    rowHeight?: number;
    enableSorting?: boolean;
    enableFiltering?: boolean;
    onRowClick?: (row: TData) => void;
    onRowDoubleClick?: (row: TData) => void;
    selectedRowId?: string;
    getRowId?: (row: TData) => string;
    className?: string;
    emptyMessage?: string;
    compact?: boolean;
    highlightRow?: (row: TData) => string | false;
}

// ============================================
// DATA TABLE COMPONENT
// ============================================

export function DataTable<TData>({
    data,
    columns,
    rowHeight = 28,
    enableSorting = true,
    enableFiltering = false,
    onRowClick,
    onRowDoubleClick,
    selectedRowId,
    getRowId,
    className,
    emptyMessage = 'No data',
    compact = false,
    highlightRow
}: DataTableProps<TData>) {
    const parentRef = useRef<HTMLDivElement>(null);

    // Table state
    const [sorting, setSorting] = useState<SortingState>([]);
    const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
    const [rowSelection, setRowSelection] = useState({});

    // Create table instance
    const table = useReactTable({
        data,
        columns,
        state: {
            sorting,
            columnFilters,
            rowSelection
        },
        onSortingChange: setSorting,
        onColumnFiltersChange: setColumnFilters,
        onRowSelectionChange: setRowSelection,
        getCoreRowModel: getCoreRowModel(),
        getSortedRowModel: enableSorting ? getSortedRowModel() : undefined,
        getFilteredRowModel: enableFiltering ? getFilteredRowModel() : undefined,
        getRowId: getRowId
    });

    const { rows } = table.getRowModel();

    // Virtual row rendering
    const rowVirtualizer = useVirtualizer({
        count: rows.length,
        getScrollElement: () => parentRef.current,
        estimateSize: () => rowHeight,
        overscan: 10
    });

    const virtualRows = rowVirtualizer.getVirtualItems();
    const totalSize = rowVirtualizer.getTotalSize();

    // Calculate padding for virtual scrolling
    const paddingTop = virtualRows.length > 0 ? virtualRows[0]?.start || 0 : 0;
    const paddingBottom = virtualRows.length > 0
        ? totalSize - (virtualRows[virtualRows.length - 1]?.end || 0)
        : 0;

    // Row click handler
    const handleRowClick = useCallback((row: Row<TData>) => {
        onRowClick?.(row.original);
    }, [onRowClick]);

    const handleRowDoubleClick = useCallback((row: Row<TData>) => {
        onRowDoubleClick?.(row.original);
    }, [onRowDoubleClick]);

    return (
        <div className={cn('flex flex-col h-full', className)}>
            {/* Scrollable Container */}
            <div
                ref={parentRef}
                className="flex-1 overflow-auto"
            >
                <table className="w-full text-xs border-collapse">
                    {/* Sticky Header */}
                    <thead className="sticky top-0 z-10 bg-[#0b1326] border-b border-[#1a2333]">
                        {table.getHeaderGroups().map((headerGroup) => (
                            <tr key={headerGroup.id}>
                                {headerGroup.headers.map((header) => {
                                    const canSort = header.column.getCanSort();
                                    const sorted = header.column.getIsSorted();

                                    return (
                                        <th
                                            key={header.id}
                                            className={cn(
                                                'px-3 py-2 text-left font-semibold text-[#869ab8]',
                                                'border-r border-slate-100 dark:border-slate-800 last:border-r-0',
                                                'bg-[#131b2e]',
                                                canSort && 'cursor-pointer select-none hover:bg-slate-100 dark:hover:bg-slate-700'
                                            )}
                                            style={{ width: header.getSize() }}
                                            onClick={header.column.getToggleSortingHandler()}
                                        >
                                            <div className="flex items-center gap-1">
                                                {header.isPlaceholder
                                                    ? null
                                                    : flexRender(
                                                        header.column.columnDef.header,
                                                        header.getContext()
                                                    )}
                                                {canSort && (
                                                    <span className="text-[#869ab8]">
                                                        {sorted === 'asc' ? (
                                                            <ChevronUp className="w-3 h-3" />
                                                        ) : sorted === 'desc' ? (
                                                            <ChevronDown className="w-3 h-3" />
                                                        ) : (
                                                            <ChevronsUpDown className="w-3 h-3 opacity-50" />
                                                        )}
                                                    </span>
                                                )}
                                            </div>
                                        </th>
                                    );
                                })}
                            </tr>
                        ))}
                    </thead>

                    {/* Virtual Body */}
                    <tbody>
                        {/* Top padding for virtualization */}
                        {paddingTop > 0 && (
                            <tr>
                                <td style={{ height: `${paddingTop}px` }} />
                            </tr>
                        )}

                        {/* Virtual Rows */}
                        {virtualRows.map((virtualRow) => {
                            const row = rows[virtualRow.index];
                            const isSelected = getRowId
                                ? getRowId(row.original) === selectedRowId
                                : false;

                            return (
                                <tr
                                    key={row.id}
                                    data-index={virtualRow.index}
                                    onClick={() => handleRowClick(row)}
                                    onDoubleClick={() => handleRowDoubleClick(row)}
                                    className={cn(
                                        'transition-colors',
                                        // Striped rows
                                        virtualRow.index % 2 === 0
                                            ? 'bg-[#0b1326]'
                                            : 'bg-[#131b2e]',
                                        // Hover
                                        'hover:bg-blue-50 dark:hover:bg-blue-900/20',
                                        // Selected
                                        isSelected && 'bg-blue-100 dark:bg-blue-900/40',
                                        // Clickable
                                        (onRowClick || onRowDoubleClick) && 'cursor-pointer',
                                        // Custom Highlight
                                        highlightRow ? highlightRow(row.original) : false
                                    )}
                                    style={{ height: rowHeight }}
                                >
                                    {row.getVisibleCells().map((cell) => (
                                        <td
                                            key={cell.id}
                                            className={cn(
                                                compact ? 'px-2 py-0.5' : 'px-3 py-1',
                                                'border-r border-slate-100 dark:border-slate-800 last:border-r-0',
                                                'text-[#adc6ff]'
                                            )}
                                        >
                                            {flexRender(
                                                cell.column.columnDef.cell,
                                                cell.getContext()
                                            )}
                                        </td>
                                    ))}
                                </tr>
                            );
                        })}

                        {/* Bottom padding for virtualization */}
                        {paddingBottom > 0 && (
                            <tr>
                                <td style={{ height: `${paddingBottom}px` }} />
                            </tr>
                        )}
                    </tbody>
                </table>

                {/* Empty State */}
                {rows.length === 0 && (
                    <div className="flex items-center justify-center h-32 text-[#869ab8]">
                        {emptyMessage}
                    </div>
                )}
            </div>

            {/* Footer with row count */}
            <div className="flex items-center justify-between px-3 py-1.5 border-t border-[#1a2333] bg-[#131b2e] text-[11px] text-[#869ab8]">
                <span>
                    {rows.length.toLocaleString()} rows
                </span>
                {selectedRowId && (
                    <span className="text-blue-500">
                        1 selected
                    </span>
                )}
            </div>
        </div>
    );
}

// ============================================
// COLUMN HELPER UTILITIES
// ============================================

export function createNumberColumn<TData>(
    accessorKey: keyof TData,
    header: string,
    unit?: string,
    precision: number = 3
): ColumnDef<TData, number> {
    return {
        accessorKey: accessorKey as string,
        header,
        cell: ({ getValue }) => {
            const value = getValue();
            return (
                <span className="font-mono tabular-nums">
                    {typeof value === 'number' ? value.toFixed(precision) : '-'}
                    {unit && <span className="text-[#869ab8] ml-0.5">{unit}</span>}
                </span>
            );
        },
        size: 100
    };
}

export function createIdColumn<TData>(accessorKey: keyof TData): ColumnDef<TData, string> {
    return {
        accessorKey: accessorKey as string,
        header: 'ID',
        cell: ({ getValue }) => (
            <span className="font-mono font-medium tracking-wide text-slate-900 dark:text-slate-100">
                {getValue()}
            </span>
        ),
        size: 80
    };
}

export default DataTable;
