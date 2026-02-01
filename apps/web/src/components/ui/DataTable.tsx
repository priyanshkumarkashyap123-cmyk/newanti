/**
 * DataTable Component
 * 
 * A comprehensive, flexible data table component with:
 * - Sorting
 * - Pagination
 * - Row selection
 * - Search/filtering
 * - Empty states
 * - Loading states
 * - Responsive design
 * - Keyboard navigation
 */

'use client';

import React, { useState, useMemo, useCallback, ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Search,
  X,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { Button } from './button';
import { EmptyState } from './EmptyStates';
import { Spinner, Skeleton } from './LoadingSpinner';
import { Checkbox } from './FormInputs';

// ============================================================================
// TYPES
// ============================================================================

export type SortDirection = 'asc' | 'desc' | null;

export interface Column<T> {
  id?: string;  // Optional - will use accessor as string or generate from accessor function
  header: string | ReactNode;
  accessor: keyof T | ((row: T) => ReactNode);
  sortable?: boolean;
  width?: string;
  align?: 'left' | 'center' | 'right';
  className?: string;
  headerClassName?: string;
  render?: (value: unknown, row: T, index: number) => ReactNode;
  cell?: (info: { row: { original: T } }) => ReactNode;  // TanStack Table v8 compatibility
}

export interface DataTableProps<T extends Record<string, unknown>> {
  data: T[];
  columns: Column<T>[];
  keyField?: keyof T;  // Field to use as row key, defaults to 'id'
  loading?: boolean;
  emptyMessage?: string;
  emptyAction?: {
    label: string;
    onClick: () => void;
  };
  // Selection
  selectable?: boolean;
  selectedRows?: (string | number)[];
  onSelectionChange?: (selected: (string | number)[]) => void;
  // Pagination
  pagination?: boolean;
  pageSize?: number;
  pageSizeOptions?: number[];
  // Search
  searchable?: boolean;
  searchPlaceholder?: string;
  searchFields?: (keyof T)[];
  // Sorting
  defaultSort?: { column: string; direction: SortDirection };
  // Styling
  className?: string;
  striped?: boolean;
  hoverable?: boolean;
  compact?: boolean;
  stickyHeader?: boolean;
  // Actions
  onRowClick?: (row: T) => void;
  rowActions?: (row: T) => ReactNode;
}

// ============================================================================
// HELPER COMPONENTS
// ============================================================================

const SortIcon: React.FC<{ direction: SortDirection; active: boolean }> = ({
  direction,
  active,
}) => {
  if (!active || !direction) {
    return <ChevronsUpDown className="w-4 h-4 text-slate-500" />;
  }
  return direction === 'asc' ? (
    <ChevronUp className="w-4 h-4 text-blue-400" />
  ) : (
    <ChevronDown className="w-4 h-4 text-blue-400" />
  );
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function DataTable<T extends Record<string, unknown>>({
  data,
  columns,
  keyField = 'id' as keyof T,
  loading = false,
  emptyMessage = 'No data available',
  emptyAction,
  selectable = false,
  selectedRows = [],
  onSelectionChange,
  pagination = true,
  pageSize: initialPageSize = 10,
  pageSizeOptions = [5, 10, 25, 50],
  searchable = false,
  searchPlaceholder = 'Search...',
  searchFields,
  defaultSort,
  className,
  striped = true,
  hoverable = true,
  compact = false,
  stickyHeader = false,
  onRowClick,
  rowActions,
}: DataTableProps<T>) {
  // State
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialPageSize);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortColumn, setSortColumn] = useState<string | null>(defaultSort?.column || null);
  const [sortDirection, setSortDirection] = useState<SortDirection>(
    defaultSort?.direction || null
  );

  // Helper to get row key
  const getRowKey = useCallback((row: T, index: number): string | number => {
    const keyValue = row[keyField];
    if (keyValue !== undefined && keyValue !== null) {
      return String(keyValue);
    }
    return index;
  }, [keyField]);

  // Get value from accessor
  const getValue = useCallback(
    (row: T, accessor: Column<T>['accessor']): unknown => {
      if (typeof accessor === 'function') {
        return accessor(row);
      }
      return row[accessor as keyof T];
    },
    []
  );

  // Get column ID
  const getColumnId = useCallback((column: Column<T>, index: number): string => {
    if (column.id) return column.id;
    if (typeof column.accessor === 'string') return column.accessor as string;
    return `col-${index}`;
  }, []);

  // Search filtering
  const filteredData = useMemo(() => {
    if (!searchQuery || !searchable) return data;

    const query = searchQuery.toLowerCase();
    const fields = searchFields || (columns.map((c) => c.accessor).filter(
      (a): a is keyof T => typeof a !== 'function'
    ));

    return data.filter((row) =>
      fields.some((field) => {
        const value = row[field];
        if (value == null) return false;
        return String(value).toLowerCase().includes(query);
      })
    );
  }, [data, searchQuery, searchable, searchFields, columns]);

  // Sorting
  const sortedData = useMemo(() => {
    if (!sortColumn || !sortDirection) return filteredData;

    const column = columns.find((c) => c.id === sortColumn);
    if (!column) return filteredData;

    return [...filteredData].sort((a, b) => {
      const aValue = getValue(a, column.accessor);
      const bValue = getValue(b, column.accessor);

      if (aValue == null) return sortDirection === 'asc' ? 1 : -1;
      if (bValue == null) return sortDirection === 'asc' ? -1 : 1;

      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return sortDirection === 'asc' ? aValue - bValue : bValue - aValue;
      }

      const aStr = String(aValue).toLowerCase();
      const bStr = String(bValue).toLowerCase();
      return sortDirection === 'asc'
        ? aStr.localeCompare(bStr)
        : bStr.localeCompare(aStr);
    });
  }, [filteredData, sortColumn, sortDirection, columns, getValue]);

  // Pagination
  const totalPages = Math.ceil(sortedData.length / pageSize);
  const paginatedData = useMemo(() => {
    if (!pagination) return sortedData;
    const start = (currentPage - 1) * pageSize;
    return sortedData.slice(start, start + pageSize);
  }, [sortedData, currentPage, pageSize, pagination]);

  // Handlers
  const handleSort = useCallback((columnId: string) => {
    if (sortColumn === columnId) {
      if (sortDirection === 'asc') {
        setSortDirection('desc');
      } else if (sortDirection === 'desc') {
        setSortColumn(null);
        setSortDirection(null);
      }
    } else {
      setSortColumn(columnId);
      setSortDirection('asc');
    }
  }, [sortColumn, sortDirection]);

  const handleSelectAll = useCallback(
    (checked: boolean) => {
      if (checked) {
        onSelectionChange?.(paginatedData.map((row, index) => getRowKey(row, index)));
      } else {
        onSelectionChange?.([]);
      }
    },
    [paginatedData, onSelectionChange, getRowKey]
  );

  const handleSelectRow = useCallback(
    (rowId: string | number, checked: boolean) => {
      if (checked) {
        onSelectionChange?.([...selectedRows, rowId]);
      } else {
        onSelectionChange?.(selectedRows.filter((id) => id !== rowId));
      }
    },
    [selectedRows, onSelectionChange]
  );

  const allSelected = paginatedData.length > 0 && paginatedData.every((row, idx) => selectedRows.includes(getRowKey(row, idx)));
  const someSelected = paginatedData.some((row, idx) => selectedRows.includes(getRowKey(row, idx)));

  // Reset page on search or page size change
  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, pageSize]);

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <div className={cn('w-full', className)}>
      {/* Search Bar */}
      {searchable && (
        <div className="mb-4 flex items-center gap-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={searchPlaceholder}
              className={cn(
                'w-full pl-9 pr-9 py-2 bg-slate-800 border border-slate-600 rounded-lg',
                'text-sm text-white placeholder:text-slate-500',
                'focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500'
              )}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          {selectedRows.length > 0 && (
            <span className="text-sm text-slate-400">
              {selectedRows.length} selected
            </span>
          )}
        </div>
      )}

      {/* Table Container */}
      <div className="relative overflow-x-auto rounded-lg border border-slate-700">
        <table className="w-full text-left">
          {/* Header */}
          <thead
            className={cn(
              'bg-slate-800/80 text-xs uppercase text-slate-400 border-b border-slate-700',
              stickyHeader && 'sticky top-0 z-10'
            )}
          >
            <tr>
              {selectable && (
                <th className="w-12 px-4 py-3">
                  <Checkbox
                    label=""
                    checked={allSelected}
                    onChange={handleSelectAll}
                    // indeterminate={someSelected && !allSelected}
                  />
                </th>
              )}
              {columns.map((column, colIndex) => {
                const columnId = getColumnId(column, colIndex);
                return (
                <th
                  key={columnId}
                  className={cn(
                    'px-4',
                    compact ? 'py-2' : 'py-3',
                    column.sortable && 'cursor-pointer hover:bg-slate-700/50',
                    column.width && `w-[${column.width}]`,
                    column.headerClassName
                  )}
                  style={{ width: column.width }}
                  onClick={() => column.sortable && handleSort(columnId)}
                >
                  <div
                    className={cn(
                      'flex items-center gap-2',
                      column.align === 'center' && 'justify-center',
                      column.align === 'right' && 'justify-end'
                    )}
                  >
                    <span>{column.header}</span>
                    {column.sortable && (
                      <SortIcon
                        direction={sortColumn === columnId ? sortDirection : null}
                        active={sortColumn === columnId}
                      />
                    )}
                  </div>
                </th>
              );
              })}
              {rowActions && <th className="w-20 px-4 py-3">Actions</th>}
            </tr>
          </thead>

          {/* Body */}
          <tbody className="divide-y divide-slate-700">
            <AnimatePresence mode="popLayout">
              {loading ? (
                // Loading skeleton
                Array.from({ length: pageSize }).map((_, i) => (
                  <tr key={`skeleton-${i}`} className="bg-slate-900">
                    {selectable && (
                      <td className="px-4 py-3">
                        <Skeleton className="w-5 h-5" />
                      </td>
                    )}
                    {columns.map((column) => (
                      <td key={column.id} className={cn('px-4', compact ? 'py-2' : 'py-3')}>
                        <Skeleton className="h-4 w-3/4" />
                      </td>
                    ))}
                    {rowActions && (
                      <td className="px-4 py-3">
                        <Skeleton className="w-8 h-8" />
                      </td>
                    )}
                  </tr>
                ))
              ) : paginatedData.length === 0 ? (
                // Empty state
                <tr>
                  <td
                    colSpan={columns.length + (selectable ? 1 : 0) + (rowActions ? 1 : 0)}
                    className="py-12"
                  >
                    <EmptyState
                      title={emptyMessage}
                      action={emptyAction}
                      size="sm"
                    />
                  </td>
                </tr>
              ) : (
                // Data rows
                paginatedData.map((row, rowIndex) => {
                  const rowKey = getRowKey(row, rowIndex);
                  return (
                  <motion.tr
                    key={rowKey}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className={cn(
                      striped && rowIndex % 2 === 1 && 'bg-slate-800/30',
                      hoverable && 'hover:bg-slate-800/50',
                      onRowClick && 'cursor-pointer',
                      selectedRows.includes(rowKey) && 'bg-blue-500/10'
                    )}
                    onClick={() => onRowClick?.(row)}
                  >
                    {selectable && (
                      <td
                        className="px-4 py-3"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Checkbox
                          label=""
                          checked={selectedRows.includes(rowKey)}
                          onChange={(checked) => handleSelectRow(rowKey, checked)}
                        />
                      </td>
                    )}
                    {columns.map((column, colIdx) => {
                      const colId = getColumnId(column, colIdx);
                      // Support both cell (v8 style) and render (custom)
                      let displayValue: ReactNode;
                      if (column.cell) {
                        displayValue = column.cell({ row: { original: row } });
                      } else {
                        const value = getValue(row, column.accessor);
                        displayValue = column.render
                          ? column.render(value, row, rowIndex)
                          : (value as ReactNode);
                      }

                      return (
                        <td
                          key={colId}
                          className={cn(
                            'px-4 text-sm text-slate-300',
                            compact ? 'py-2' : 'py-3',
                            column.align === 'center' && 'text-center',
                            column.align === 'right' && 'text-right',
                            column.className
                          )}
                        >
                          {displayValue}
                        </td>
                      );
                    })}
                    {rowActions && (
                      <td
                        className="px-4 py-3"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {rowActions(row)}
                      </td>
                    )}
                  </motion.tr>
                );
              })
            )}
          </AnimatePresence>
        </tbody>
      </table>
      </div>

      {/* Pagination */}
      {pagination && !loading && sortedData.length > 0 && (
        <div className="mt-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-sm text-slate-400">
            <span>Show</span>
            <select
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
              className="bg-slate-800 border border-slate-600 rounded px-2 py-1 text-white"
            >
              {pageSizeOptions.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
            <span>of {sortedData.length} results</span>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setCurrentPage(1)}
              disabled={currentPage === 1}
              className="p-2"
            >
              <ChevronsLeft className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="p-2"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="px-4 text-sm text-slate-400">
              Page {currentPage} of {totalPages}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="p-2"
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setCurrentPage(totalPages)}
              disabled={currentPage === totalPages}
              className="p-2"
            >
              <ChevronsRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default DataTable;
