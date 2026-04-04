import type { MasterDataGridRegistry, MasterGridConfig } from '../ui/MasterDataGrid';

export const GRID_STYLES = {
    shellClassName: 'border-zinc-800 bg-zinc-950/90 shadow-[0_10px_30px_rgba(0,0,0,0.25)]',
    headerClassName: 'bg-zinc-900/95 text-slate-300',
    rowClassName: 'bg-zinc-950/30',
    altRowClassName: 'bg-zinc-900/35',
    cellClassName: 'text-slate-200',
    selectedRowClassName: 'bg-sky-500/10',
    emptyStateClassName: 'bg-zinc-950/70 border-zinc-800',
    borderClassName: 'border-zinc-800',
} as const;

export type NodeGridRow = {
    id: string;
    x?: number;
    y?: number;
    z?: number;
    restraint?: string;
};

export type MemberGridRow = {
    id: string;
    startNodeId?: string;
    endNodeId?: string;
    sectionId?: string;
    material?: string;
};

export type LoadGridRow = {
    id: string;
    nodeId?: string;
    memberId?: string;
    type?: string;
    fx?: number;
    fy?: number;
    fz?: number;
    mx?: number;
    my?: number;
    mz?: number;
    factor?: number;
    w1?: number;
    w2?: number;
    direction?: string;
};

export const NODE_GRID_CONFIG: MasterGridConfig<NodeGridRow> = {
    id: 'report-nodes',
    density: 'compact',
    striped: true,
    hoverable: true,
    stickyHeader: true,
    selectable: false,
    columns: [
        { id: 'id', header: 'Node ID', accessor: 'id', type: 'text', sortable: true, className: 'font-mono font-bold text-slate-100' },
        { id: 'x', header: 'X (m)', accessor: 'x', type: 'engineering', unit: 'm', precision: 3, align: 'right', sortable: true },
        { id: 'y', header: 'Y (m)', accessor: 'y', type: 'engineering', unit: 'm', precision: 3, align: 'right', sortable: true },
        { id: 'z', header: 'Z (m)', accessor: 'z', type: 'engineering', unit: 'm', precision: 3, align: 'right', sortable: true },
        { id: 'restraint', header: 'Restraints', accessor: 'restraint', type: 'text', sortable: true },
    ],
    pagination: { enabled: false },
    filtering: { searchable: false },
    styles: GRID_STYLES,
    emptyState: { title: 'No nodes available' },
};

export const MEMBER_GRID_CONFIG: MasterGridConfig<MemberGridRow> = {
    id: 'report-members',
    density: 'compact',
    striped: true,
    hoverable: true,
    stickyHeader: true,
    selectable: false,
    columns: [
        { id: 'id', header: 'Member ID', accessor: 'id', type: 'text', sortable: true, className: 'font-mono font-bold text-slate-100' },
        { id: 'startNodeId', header: 'Start Node', accessor: 'startNodeId', type: 'text', sortable: true },
        { id: 'endNodeId', header: 'End Node', accessor: 'endNodeId', type: 'text', sortable: true },
        { id: 'sectionId', header: 'Section', accessor: 'sectionId', type: 'text', sortable: true },
        { id: 'material', header: 'Material', accessor: 'material', type: 'text', sortable: true },
    ],
    pagination: { enabled: false },
    filtering: { searchable: false },
    styles: GRID_STYLES,
    emptyState: { title: 'No members available' },
};

export const LOAD_GRID_CONFIG: MasterGridConfig<LoadGridRow> = {
    id: 'report-loads',
    density: 'compact',
    striped: true,
    hoverable: true,
    stickyHeader: true,
    selectable: false,
    columns: [
        { id: 'id', header: 'ID', accessor: 'id', type: 'text', sortable: true, className: 'font-mono font-bold text-slate-100' },
        { id: 'nodeId', header: 'Node', accessor: 'nodeId', type: 'text', sortable: true },
        { id: 'memberId', header: 'Member', accessor: 'memberId', type: 'text', sortable: true },
        { id: 'type', header: 'Type', accessor: 'type', type: 'status', sortable: true },
        { id: 'fx', header: 'Fx (kN)', accessor: 'fx', type: 'engineering', unit: 'kN', precision: 2, align: 'right', sortable: true },
        { id: 'fy', header: 'Fy (kN)', accessor: 'fy', type: 'engineering', unit: 'kN', precision: 2, align: 'right', sortable: true },
        { id: 'fz', header: 'Fz (kN)', accessor: 'fz', type: 'engineering', unit: 'kN', precision: 2, align: 'right', sortable: true },
        { id: 'mx', header: 'Mx (kN·m)', accessor: 'mx', type: 'engineering', unit: 'kN·m', precision: 2, align: 'right', sortable: true },
        { id: 'my', header: 'My (kN·m)', accessor: 'my', type: 'engineering', unit: 'kN·m', precision: 2, align: 'right', sortable: true },
        { id: 'mz', header: 'Mz (kN·m)', accessor: 'mz', type: 'engineering', unit: 'kN·m', precision: 2, align: 'right', sortable: true },
        { id: 'factor', header: 'Factor', accessor: 'factor', type: 'engineering', unit: '', precision: 2, align: 'right', sortable: true },
        { id: 'w1', header: 'w₁ / P', accessor: 'w1', type: 'engineering', unit: 'kN/m', precision: 2, align: 'right', sortable: true },
        { id: 'w2', header: 'w₂', accessor: 'w2', type: 'engineering', unit: 'kN/m', precision: 2, align: 'right', sortable: true },
        { id: 'direction', header: 'Direction', accessor: 'direction', type: 'text', sortable: true },
    ],
    pagination: { enabled: false },
    filtering: { searchable: false },
    styles: GRID_STYLES,
    emptyState: { title: 'No load data available' },
};

export const reportRegistry: MasterDataGridRegistry<any> = {};
