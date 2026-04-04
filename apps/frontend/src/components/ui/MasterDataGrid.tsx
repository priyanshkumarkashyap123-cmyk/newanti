import React, { ReactNode, useMemo, useState } from 'react';
import { ChevronDown, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Search, X } from 'lucide-react';
import { cn } from '../../lib/utils';
import { Button } from './button';

export type MasterGridDensity = 'compact' | 'comfortable' | 'spacious';
export type MasterGridAlign = 'left' | 'center' | 'right';
export type MasterGridColumnType = 'text' | 'number' | 'currency' | 'percent' | 'engineering' | 'status' | 'badge' | 'boolean' | 'custom';

export interface MasterGridValidationRule {
  required?: boolean;
  min?: number;
  max?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  message?: string;
  validate?: string;
}

export interface MasterGridStyleTokens {
  shellClassName?: string;
  headerClassName?: string;
  rowClassName?: string;
  altRowClassName?: string;
  cellClassName?: string;
  selectedRowClassName?: string;
  emptyStateClassName?: string;
  borderClassName?: string;
}

export interface MasterGridColumnConfig<T> {
  id: string;
  header: string;
  accessor: keyof T | string;
  type?: MasterGridColumnType;
  align?: MasterGridAlign;
  width?: string;
  sortable?: boolean;
  editable?: boolean;
  hidden?: boolean;
  frozen?: boolean;
  unit?: string;
  precision?: number;
  validation?: MasterGridValidationRule;
  format?: string;
  placeholder?: string;
  options?: Array<{ label: string; value: string | number | boolean }>;
  className?: string;
  headerClassName?: string;
  cellClassName?: string;
  render?: string;
}

export interface MasterGridActionConfig {
  id: string;
  label: string;
  icon?: string;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  confirm?: boolean;
  onClick: string;
}

export interface MasterGridPaginationConfig {
  enabled?: boolean;
  pageSize?: number;
  pageSizeOptions?: number[];
}

export interface MasterGridSortingConfig {
  enabled?: boolean;
  defaultColumnId?: string;
  defaultDirection?: 'asc' | 'desc';
}

export interface MasterGridFilteringConfig {
  searchable?: boolean;
  searchPlaceholder?: string;
  fields?: string[];
}

export interface MasterGridConfig<T> {
  id?: string;
  title?: string;
  description?: string;
  density?: MasterGridDensity;
  striped?: boolean;
  hoverable?: boolean;
  stickyHeader?: boolean;
  selectable?: boolean;
  columns: Array<MasterGridColumnConfig<T>>;
  actions?: MasterGridActionConfig[];
  pagination?: MasterGridPaginationConfig;
  sorting?: MasterGridSortingConfig;
  filtering?: MasterGridFilteringConfig;
  styles?: MasterGridStyleTokens;
  emptyState?: {
    title?: string;
    description?: string;
    actionLabel?: string;
    actionId?: string;
  };
  validationMode?: 'none' | 'cell' | 'row' | 'submit';
}

export interface MasterDataGridRegistry<T> {
  onClickHandlers?: Record<string, (row: T) => void>;
  renderers?: Record<string, React.ComponentType<{ value: unknown; row: T; column: MasterGridColumnConfig<T>; rowIndex: number }>>;
}

export interface MasterDataGridProps<T extends Record<string, unknown>> {
  data: T[];
  config: MasterGridConfig<T>;
  registry?: MasterDataGridRegistry<T>;
  keyField?: keyof T;
  className?: string;
  loading?: boolean;
  onCellEdit?: (args: { row: T; rowIndex: number; column: MasterGridColumnConfig<T>; value: unknown; isValid: boolean; error?: string | null }) => void;
}

type SortDirection = 'asc' | 'desc' | null;

interface ValidationResult {
  isValid: boolean;
  error: string | null;
}

const densityMap: Record<MasterGridDensity, { header: string; cell: string; gap: string }> = {
  compact: { header: 'py-2', cell: 'py-1.5', gap: 'gap-2' },
  comfortable: { header: 'py-3', cell: 'py-2.5', gap: 'gap-2.5' },
  spacious: { header: 'py-4', cell: 'py-3.5', gap: 'gap-3' },
};

function MasterDataGrid<T extends Record<string, unknown>,>({
  data,
  config,
  registry,
  keyField = 'id' as keyof T,
  className,
  loading = false,
  onCellEdit,
}: MasterDataGridProps<T>) {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortColumnId, setSortColumnId] = useState<string | null>(config.sorting?.defaultColumnId ?? null);
  const [sortDirection, setSortDirection] = useState<SortDirection>(config.sorting?.defaultDirection ?? null);
  const [editingCell, setEditingCell] = useState<{ rowIndex: number; columnId: string } | null>(null);
  const [draftValues, setDraftValues] = useState<Record<string, unknown>>({});
  const [cellErrors, setCellErrors] = useState<Record<string, string | null>>({});

  const density = densityMap[config.density ?? 'comfortable'];

  const visibleColumns = useMemo(() => config.columns.filter((column) => !column.hidden), [config.columns]);

  const getRowKey = (row: T, index: number) => {
    const value = row[keyField];
    return value == null ? index : String(value);
  };

  const getValue = (row: T, accessor: keyof T | string): unknown => {
    if (typeof accessor === 'string' && accessor in (row as object)) return row[accessor as keyof T];
    if (typeof accessor !== 'string') return row[accessor];
    return undefined;
  };

  const formatEngineeringValue = (value: unknown, unit?: string, precision = 2) => {
    if (value == null || value === '') return '—';
    const numeric = Number(value);
    if (Number.isNaN(numeric)) return String(value);
    const formatted = numeric.toFixed(precision);
    return unit ? `${formatted} ${unit}` : formatted;
  };

  const validateValue = (column: MasterGridColumnConfig<T>, value: unknown): ValidationResult => {
    const rules = column.validation;
    if (!rules) return { isValid: true, error: null };

    const valueString = value == null ? '' : String(value);
    const numericValue = Number(value);

    if (rules.required && valueString.trim().length === 0) {
      return { isValid: false, error: rules.message ?? `${column.header} is required.` };
    }
    if (rules.minLength != null && valueString.length < rules.minLength) {
      return { isValid: false, error: rules.message ?? `${column.header} must be at least ${rules.minLength} characters.` };
    }
    if (rules.maxLength != null && valueString.length > rules.maxLength) {
      return { isValid: false, error: rules.message ?? `${column.header} must be at most ${rules.maxLength} characters.` };
    }
    if (rules.pattern) {
      const regex = new RegExp(rules.pattern);
      if (!regex.test(valueString)) return { isValid: false, error: rules.message ?? `${column.header} is invalid.` };
    }
    if (!Number.isNaN(numericValue)) {
      if (rules.min != null && numericValue < rules.min) return { isValid: false, error: rules.message ?? `${column.header} must be ≥ ${rules.min}.` };
      if (rules.max != null && numericValue > rules.max) return { isValid: false, error: rules.message ?? `${column.header} must be ≤ ${rules.max}.` };
    }

    return { isValid: true, error: null };
  };

  const filteredData = useMemo(() => {
    if (!searchQuery || !config.filtering?.searchable) return data;
    const query = searchQuery.toLowerCase();
    const fields = config.filtering?.fields?.length ? config.filtering.fields : visibleColumns.map((column) => String(column.accessor));
    return data.filter((row) => fields.some((field) => String(getValue(row, field)).toLowerCase().includes(query)));
  }, [data, searchQuery, config.filtering, visibleColumns]);

  const sortedData = useMemo(() => {
    if (!sortColumnId || !sortDirection || config.sorting?.enabled === false) return filteredData;
    const column = visibleColumns.find((c) => c.id === sortColumnId);
    if (!column) return filteredData;

    const sorted = [...filteredData].sort((a, b) => {
      const aValue = getValue(a, column.accessor);
      const bValue = getValue(b, column.accessor);
      if (aValue == null) return 1;
      if (bValue == null) return -1;
      const aNum = Number(aValue);
      const bNum = Number(bValue);
      if (!Number.isNaN(aNum) && !Number.isNaN(bNum)) {
        return sortDirection === 'asc' ? aNum - bNum : bNum - aNum;
      }
      const aStr = String(aValue).toLowerCase();
      const bStr = String(bValue).toLowerCase();
      return sortDirection === 'asc' ? aStr.localeCompare(bStr) : bStr.localeCompare(aStr);
    });
    return sorted;
  }, [filteredData, sortColumnId, sortDirection, visibleColumns, config.sorting?.enabled]);

  const handleSort = (columnId: string) => {
    if (sortColumnId === columnId) {
      setSortDirection((current) => (current === 'asc' ? 'desc' : current === 'desc' ? null : 'asc'));
      if (sortDirection === 'desc') setSortColumnId(null);
    } else {
      setSortColumnId(columnId);
      setSortDirection('asc');
    }
  };

  const handleCellClick = (rowIndex: number, column: MasterGridColumnConfig<T>) => {
    if (!column.editable) return;
    setEditingCell({ rowIndex, columnId: column.id });
    const row = sortedData[rowIndex];
    setDraftValues((prev) => ({ ...prev, [`${rowIndex}:${column.id}`]: getValue(row, column.accessor) ?? '' }));
  };

  const commitCell = (rowIndex: number, column: MasterGridColumnConfig<T>, rawValue: unknown) => {
    const result = validateValue(column, rawValue);
    const key = `${rowIndex}:${column.id}`;
    setCellErrors((prev) => ({ ...prev, [key]: result.error }));
    onCellEdit?.({ row: sortedData[rowIndex], rowIndex, column, value: rawValue, isValid: result.isValid, error: result.error });
    if (result.isValid) setEditingCell(null);
  };

  const totalPages = 1;
  const pageData = sortedData;

  if (!loading && pageData.length === 0) {
    return (
      <div className={cn('w-full', className)}>
        {config.filtering?.searchable && (
          <div className="mb-4 flex items-center gap-3">
            <div className="relative w-full max-w-sm">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={config.filtering?.searchPlaceholder ?? 'Search...'}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-950/70 py-2 pl-9 pr-9 text-sm text-slate-100 placeholder:text-slate-500 focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-500/20"
              />
              {searchQuery ? (
                <button type="button" onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-200">
                  <X className="h-4 w-4" />
                </button>
              ) : null}
            </div>
          </div>
        )}
        <div className={cn('rounded-xl border border-zinc-800 bg-zinc-950/70 p-6 text-center text-sm text-slate-400', config.styles?.emptyStateClassName)}>
          <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full border border-slate-700 bg-slate-900/80 text-slate-300">
            <ChevronDown className="h-4 w-4 rotate-180" />
          </div>
          <div className="font-medium text-slate-200">{config.emptyState?.title ?? 'No data available'}</div>
          {config.emptyState?.description ? <div className="mt-1 text-slate-400">{config.emptyState.description}</div> : null}
          {config.emptyState?.actionLabel ? (
            <div className="mt-4">
              <Button variant="outline">{config.emptyState.actionLabel}</Button>
            </div>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className={cn('w-full space-y-4', className)}>
      {config.filtering?.searchable ? (
        <div className="flex items-center gap-3">
          <div className="relative w-full max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={config.filtering?.searchPlaceholder ?? 'Search...'}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-950/70 py-2 pl-9 pr-9 text-sm text-slate-100 placeholder:text-slate-500 focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-500/20"
            />
            {searchQuery ? (
              <button type="button" onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-200">
                <X className="h-4 w-4" />
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className={cn('overflow-hidden rounded-xl border bg-zinc-950/80 shadow-[0_0_0_1px_rgba(255,255,255,0.02)]', config.styles?.borderClassName, config.styles?.shellClassName)}>
        <div className="overflow-x-auto">
          <table className="min-w-full border-separate border-spacing-0 text-left">
            <thead className={cn('bg-zinc-900/95 text-xs uppercase tracking-wide text-slate-400', config.stickyHeader ? 'sticky top-0 z-10' : '', config.styles?.headerClassName)}>
              <tr>
                {visibleColumns.map((column) => (
                  <th
                    key={column.id}
                    onClick={() => column.sortable && handleSort(column.id)}
                    className={cn(
                      'border-b border-zinc-800 px-4 font-semibold text-slate-300',
                      density.header,
                      column.sortable ? 'cursor-pointer select-none hover:bg-zinc-800/70' : '',
                      column.align === 'center' && 'text-center',
                      column.align === 'right' && 'text-right',
                      column.headerClassName
                    )}
                    style={{ width: column.width }}
                  >
                    <span className="inline-flex items-center gap-2">
                      {column.header}
                      {column.sortable ? <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', sortColumnId === column.id && sortDirection === 'asc' && 'rotate-180')} /> : null}
                    </span>
                  </th>
                ))}
                {config.actions?.length ? <th className={cn('border-b border-zinc-800 px-4 font-semibold text-slate-300', density.header)}>Actions</th> : null}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/80">
              {pageData.map((row, rowIndex) => {
                const rowKey = getRowKey(row, rowIndex);
                return (
                  <tr
                    key={rowKey}
                    className={cn(
                      'transition-colors',
                      config.striped !== false && rowIndex % 2 === 1 ? 'bg-zinc-900/35' : 'bg-zinc-950/30',
                      config.hoverable !== false ? 'hover:bg-slate-900/80' : '',
                      config.styles?.rowClassName
                    )}
                  >
                    {visibleColumns.map((column) => {
                      const cellKey = `${rowIndex}:${column.id}`;
                      const isEditing = editingCell?.rowIndex === rowIndex && editingCell?.columnId === column.id;
                      const value = getValue(row, column.accessor);
                      const renderer = column.render && registry?.renderers?.[column.render];
                      const displayValue = column.type === 'engineering'
                        ? formatEngineeringValue(value, column.unit, column.precision ?? 2)
                        : value;
                      const validation = cellErrors[cellKey];

                      return (
                        <td
                          key={column.id}
                          onClick={() => handleCellClick(rowIndex, column)}
                          className={cn(
                            'border-b border-zinc-800/70 px-4 text-sm text-slate-200',
                            density.cell,
                            column.editable ? 'cursor-text' : '',
                            column.align === 'center' && 'text-center',
                            column.align === 'right' && 'text-right',
                            column.className,
                            column.cellClassName,
                            config.styles?.cellClassName
                          )}
                        >
                          {isEditing && column.editable ? (
                            <div className="space-y-1">
                              {column.type === 'boolean' ? (
                                <select
                                  autoFocus
                                  className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1 text-slate-100 outline-none focus:border-slate-500"
                                  value={String(draftValues[cellKey] ?? value ?? false)}
                                  onChange={(e) => {
                                    const next = e.target.value === 'true';
                                    setDraftValues((prev) => ({ ...prev, [cellKey]: next }));
                                    commitCell(rowIndex, column, next);
                                  }}
                                >
                                  <option value="true">True</option>
                                  <option value="false">False</option>
                                </select>
                              ) : column.options?.length ? (
                                <select
                                  autoFocus
                                  className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1 text-slate-100 outline-none focus:border-slate-500"
                                  value={String(draftValues[cellKey] ?? value ?? '')}
                                  onChange={(e) => {
                                    const next = e.target.value;
                                    setDraftValues((prev) => ({ ...prev, [cellKey]: next }));
                                    commitCell(rowIndex, column, next);
                                  }}
                                >
                                  <option value="">Select…</option>
                                  {column.options.map((option) => (
                                    <option key={String(option.value)} value={String(option.value)}>{option.label}</option>
                                  ))}
                                </select>
                              ) : (
                                <input
                                  autoFocus
                                  type={column.type === 'number' || column.type === 'engineering' || column.type === 'currency' || column.type === 'percent' ? 'number' : 'text'}
                                  value={String(draftValues[cellKey] ?? value ?? '')}
                                  placeholder={column.placeholder}
                                  onChange={(e) => {
                                    const next: unknown = column.type === 'number' || column.type === 'engineering' || column.type === 'currency' || column.type === 'percent'
                                      ? e.target.value === '' ? '' : Number(e.target.value)
                                      : e.target.value;
                                    setDraftValues((prev) => ({ ...prev, [cellKey]: next }));
                                    commitCell(rowIndex, column, next);
                                  }}
                                  className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1 text-slate-100 outline-none focus:border-slate-500"
                                />
                              )}
                              {validation ? <p className="text-[11px] text-rose-400">{validation}</p> : null}
                            </div>
                          ) : renderer ? (
                            React.createElement(renderer, { value, row, column, rowIndex })
                          ) : column.type === 'custom' ? (
                            <span>{String(value ?? '—')}</span>
                          ) : column.type === 'engineering' ? (
                            <span className="font-mono tabular-nums text-slate-100">{displayValue as ReactNode}</span>
                          ) : column.type === 'boolean' ? (
                            <span className={cn('inline-flex rounded-full px-2 py-0.5 text-xs font-medium', value ? 'bg-emerald-500/10 text-emerald-300' : 'bg-slate-700/60 text-slate-300')}>
                              {value ? 'Yes' : 'No'}
                            </span>
                          ) : column.type === 'badge' || column.type === 'status' ? (
                            <span className="inline-flex rounded-full border border-zinc-700 bg-zinc-900 px-2 py-0.5 text-xs font-medium text-slate-300">
                              {String(displayValue ?? '—')}
                            </span>
                          ) : column.type === 'number' || column.type === 'currency' || column.type === 'percent' ? (
                            <span className="font-mono tabular-nums text-slate-100">{String(displayValue ?? '—')}</span>
                          ) : (
                            <span>{String(displayValue ?? '—')}</span>
                          )}
                        </td>
                      );
                    })}
                    {config.actions?.length ? (
                      <td className={cn('border-b border-zinc-800/70 px-4', density.cell)}>
                        <div className="flex items-center gap-2">
                          {config.actions.map((action) => {
                            const handler = registry?.onClickHandlers?.[action.onClick];
                            return (
                              <Button
                                key={action.id}
                                size="sm"
                                variant={action.variant === 'danger' ? 'destructive' : action.variant === 'ghost' ? 'ghost' : 'outline'}
                                onClick={() => handler?.(row)}
                                className="h-8 rounded-md"
                              >
                                {action.label}
                              </Button>
                            );
                          })}
                        </div>
                      </td>
                    ) : null}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {config.pagination?.enabled !== false ? (
        <div className="flex items-center justify-between gap-4 text-sm text-slate-400">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2">
              {pageData.length} row(s)
            </span>
            <span className="inline-flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2">
              Page 1 of {totalPages}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" className="h-9 w-9 p-0"><ChevronsLeft className="h-4 w-4" /></Button>
            <Button variant="ghost" size="sm" className="h-9 w-9 p-0"><ChevronLeft className="h-4 w-4" /></Button>
            <Button variant="ghost" size="sm" className="h-9 w-9 p-0"><ChevronRight className="h-4 w-4" /></Button>
            <Button variant="ghost" size="sm" className="h-9 w-9 p-0"><ChevronsRight className="h-4 w-4" /></Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default MasterDataGrid;
