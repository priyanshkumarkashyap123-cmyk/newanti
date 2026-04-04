import React from 'react';

export type MasterDataGridDensity = 'compact' | 'comfortable' | 'spacious';
export type MasterDataGridTheme = 'industrial-premium' | 'dark-steel' | 'light-panel';
export type MasterDataGridFieldType = 'text' | 'number' | 'select' | 'multiselect' | 'checkbox' | 'textarea' | 'date' | 'toggle' | 'custom';

export interface MasterDataGridOption {
  label: string;
  value: string | number | boolean;
  disabled?: boolean;
}

export interface MasterDataGridValidationRule {
  required?: boolean;
  min?: number;
  max?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  message?: string;
  custom?: string;
}

export interface MasterDataGridColumnConfig {
  key: string;
  header: string;
  type: MasterDataGridFieldType;
  width?: string;
  minWidth?: string;
  hidden?: boolean;
  readonly?: boolean;
  sortable?: boolean;
  searchable?: boolean;
  filterable?: boolean;
  align?: 'left' | 'center' | 'right';
  placeholder?: string;
  helperText?: string;
  options?: MasterDataGridOption[];
  validation?: MasterDataGridValidationRule;
  className?: string;
  headerClassName?: string;
  cellClassName?: string;
  inputClassName?: string;
  render?: string;
}

export interface MasterDataGridActionConfig {
  id: string;
  label: string;
  icon?: string;
  variant?: 'primary' | 'secondary' | 'ghost' | 'destructive';
  confirm?: boolean;
  confirmMessage?: string;
  hidden?: boolean;
  action: string;
}

export interface MasterDataGridEmptyStateConfig {
  title?: string;
  description?: string;
  ctaLabel?: string;
  ctaAction?: string;
}

export interface MasterDataGridFormSectionConfig {
  id: string;
  title?: string;
  description?: string;
  columns: number;
  fields: string[];
  className?: string;
}

export interface MasterDataGridConfig {
  id: string;
  title?: string;
  description?: string;
  theme?: MasterDataGridTheme;
  density?: MasterDataGridDensity;
  columns: MasterDataGridColumnConfig[];
  data: Record<string, unknown>[];
  rowKey: string;
  editable?: boolean;
  addable?: boolean;
  deletable?: boolean;
  selectable?: boolean;
  search?: boolean;
  pagination?: boolean;
  pageSize?: number;
  stickyHeader?: boolean;
  virtualized?: boolean;
  actions?: MasterDataGridActionConfig[];
  formSections?: MasterDataGridFormSectionConfig[];
  validationMode?: 'onChange' | 'onBlur' | 'onSubmit';
  emptyState?: MasterDataGridEmptyStateConfig;
  className?: string;
  tableClassName?: string;
  panelClassName?: string;
  toolbarClassName?: string;
  rowClassName?: string;
}

interface MasterDataGridProps {
  config: MasterDataGridConfig;
  onChange?: (rows: Record<string, unknown>[]) => void;
}

const densityClasses: Record<MasterDataGridDensity, string> = {
  compact: 'text-xs',
  comfortable: 'text-sm',
  spacious: 'text-base',
};

const inputBaseClass =
  'w-full rounded-md border border-slate-700 bg-slate-950/70 px-2.5 py-1.5 text-slate-100 outline-none transition focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/40';

function readCellValue(row: Record<string, unknown>, key: string): string {
  const value = row[key];
  return value === null || value === undefined ? '' : String(value);
}

function MasterDataGridRow({
  row,
  columns,
  rowIndex,
  rowClassName,
  density,
  editable,
  onCellChange,
}: {
  row: Record<string, unknown>;
  columns: MasterDataGridColumnConfig[];
  rowIndex: number;
  rowClassName?: string;
  density: MasterDataGridDensity;
  editable?: boolean;
  onCellChange: (rowIndex: number, key: string, value: string) => void;
}) {
  return (
    <tr className={`border-b border-slate-800/80 hover:bg-slate-900/60 ${rowClassName ?? ''}`}>
      {columns.filter((column) => !column.hidden).map((column) => {
        const value = readCellValue(row, column.key);
        return (
          <td
            key={column.key}
            className={`px-3 py-2 align-middle text-slate-200 ${column.cellClassName ?? ''}`}
            style={{ width: column.width, minWidth: column.minWidth, textAlign: column.align ?? 'left' }}
          >
            {editable && !column.readonly && (column.type === 'text' || column.type === 'number') ? (
              <input
                value={value}
                type={column.type}
                placeholder={column.placeholder}
                onChange={(e) => onCellChange(rowIndex, column.key, e.target.value)}
                className={`${inputBaseClass} ${density === 'compact' ? 'h-8' : 'h-9'} ${column.inputClassName ?? ''}`}
              />
            ) : (
              <div className={`${densityClasses[density]} ${column.className ?? ''}`}>{value}</div>
            )}
          </td>
        );
      })}
    </tr>
  );
}

export function MasterDataGrid({ config, onChange }: MasterDataGridProps) {
  const visibleColumns = config.columns.filter((column) => !column.hidden);

  const handleCellChange = (rowIndex: number, key: string, value: string) => {
    const nextRows = config.data.map((row, index) => {
      if (index !== rowIndex) return row;
      return { ...row, [key]: config.columns.find((column) => column.key === key)?.type === 'number' ? Number(value) : value };
    });
    onChange?.(nextRows);
  };

  return (
    <section className={`rounded-2xl border border-slate-800 bg-slate-950/95 shadow-[0_0_0_1px_rgba(148,163,184,0.06)] ${config.panelClassName ?? ''}`}>
      <div className={`border-b border-slate-800 px-4 py-3 ${config.toolbarClassName ?? ''}`}>
        {config.title && <h3 className="text-sm font-semibold tracking-wide text-slate-100">{config.title}</h3>}
        {config.description && <p className="mt-1 text-xs text-slate-400">{config.description}</p>}
        {/* TODO: search/filter toolbar */}
      </div>

      <div className={`overflow-x-auto ${config.className ?? ''}`}>
        <table className={`min-w-full border-separate border-spacing-0 ${config.tableClassName ?? ''}`}>
          <thead className="sticky top-0 z-10 bg-slate-950/95">
            <tr>
              {visibleColumns.map((column) => (
                <th
                  key={column.key}
                  className={`border-b border-slate-800 px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400 ${column.headerClassName ?? ''}`}
                  style={{ width: column.width, minWidth: column.minWidth, textAlign: column.align ?? 'left' }}
                >
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className={densityClasses[config.density ?? 'comfortable']}>
            {config.data.length > 0 ? (
              config.data.map((row, rowIndex) => (
                <MasterDataGridRow
                  key={String(row[config.rowKey] ?? rowIndex)}
                  row={row}
                  columns={config.columns}
                  rowIndex={rowIndex}
                  rowClassName={config.rowClassName}
                  density={config.density ?? 'comfortable'}
                  editable={config.editable}
                  onCellChange={handleCellChange}
                />
              ))
            ) : (
              <tr>
                <td colSpan={visibleColumns.length} className="px-4 py-10 text-center text-sm text-slate-400">
                  {config.emptyState?.title ?? 'No data available'}
                  {config.emptyState?.description ? <div className="mt-1 text-xs text-slate-500">{config.emptyState.description}</div> : null}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* TODO: pagination */}
      {/* TODO: virtualization */}
      {/* TODO: complex form sections */}
    </section>
  );
}

export default MasterDataGrid;
