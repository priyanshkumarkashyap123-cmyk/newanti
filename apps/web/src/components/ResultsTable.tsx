import { FC, useState, useMemo } from 'react';
import {
    useReactTable,
    getCoreRowModel,
    getSortedRowModel,
    flexRender,
    createColumnHelper,
    type SortingState,
} from '@tanstack/react-table';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useRef, useEffect } from 'react';
import { useModelStore } from '../store/model';

type TabType = 'displacements' | 'reactions' | 'forces';

// Data types for each tab
interface DisplacementRow {
    nodeId: string;
    dx: number;
    dy: number;
    dz: number;
    rx: number;
    ry: number;
    rz: number;
}

interface ReactionRow {
    nodeId: string;
    fx: number;
    fy: number;
    fz: number;
    mx: number;
    my: number;
    mz: number;
}

interface ForceRow {
    memberId: string;
    axial: number;
    shearY: number;
    shearZ: number;
    momentY: number;
    momentZ: number;
    torsion: number;
}

// Format number to 3 decimal places
const fmt = (val: number): string => val.toFixed(3);

// Column helpers
const displacementHelper = createColumnHelper<DisplacementRow>();
const reactionHelper = createColumnHelper<ReactionRow>();
const forceHelper = createColumnHelper<ForceRow>();

// CSV Export utility
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const exportToCSV = (data: any[], filename: string) => {
    if (data.length === 0) return;

    const headers = Object.keys(data[0]);
    const csvContent = [
        headers.join(','),
        ...data.map(row => headers.map(h => row[h]).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${filename}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
};

export const ResultsTable: FC = () => {
    const analysisResults = useModelStore((state) => state.analysisResults);
    const select = useModelStore((state) => state.select);
    const nodes = useModelStore((state) => state.nodes);

    const [activeTab, setActiveTab] = useState<TabType>('displacements');
    const [sorting, setSorting] = useState<SortingState>([]);
    const parentRef = useRef<HTMLDivElement>(null);

    // Convert Map data to arrays
    const displacementData = useMemo<DisplacementRow[]>(() => {
        if (!analysisResults) return [];
        return Array.from(analysisResults.displacements.entries()).map(([nodeId, d]) => ({
            nodeId,
            dx: d.dx,
            dy: d.dy,
            dz: d.dz,
            rx: d.rx,
            ry: d.ry,
            rz: d.rz
        }));
    }, [analysisResults]);

    const reactionData = useMemo<ReactionRow[]>(() => {
        if (!analysisResults) return [];
        // Filter to only nodes with restraints (supports)
        return Array.from(analysisResults.reactions.entries())
            .filter(([nodeId]) => {
                const node = nodes.get(nodeId);
                return node?.restraints && (
                    node.restraints.fx || node.restraints.fy || node.restraints.fz ||
                    node.restraints.mx || node.restraints.my || node.restraints.mz
                );
            })
            .map(([nodeId, r]) => ({
                nodeId,
                fx: r.fx,
                fy: r.fy,
                fz: r.fz,
                mx: r.mx,
                my: r.my,
                mz: r.mz
            }));
    }, [analysisResults, nodes]);

    const forceData = useMemo<ForceRow[]>(() => {
        if (!analysisResults) return [];
        return Array.from(analysisResults.memberForces.entries()).map(([memberId, f]) => ({
            memberId,
            axial: f.axial,
            shearY: f.shearY,
            shearZ: f.shearZ,
            momentY: f.momentY,
            momentZ: f.momentZ,
            torsion: f.torsion
        }));
    }, [analysisResults]);

    // Column definitions
    const displacementColumns = useMemo(() => [
        displacementHelper.accessor('nodeId', { header: 'Node', enableSorting: true }),
        displacementHelper.accessor('dx', { header: 'Δx (m)', cell: (info) => fmt(info.getValue()), enableSorting: true }),
        displacementHelper.accessor('dy', { header: 'Δy (m)', cell: (info) => fmt(info.getValue()), enableSorting: true }),
        displacementHelper.accessor('dz', { header: 'Δz (m)', cell: (info) => fmt(info.getValue()), enableSorting: true }),
        displacementHelper.accessor('rx', { header: 'θx (rad)', cell: (info) => fmt(info.getValue()), enableSorting: true }),
        displacementHelper.accessor('ry', { header: 'θy (rad)', cell: (info) => fmt(info.getValue()), enableSorting: true }),
        displacementHelper.accessor('rz', { header: 'θz (rad)', cell: (info) => fmt(info.getValue()), enableSorting: true }),
    ], []);

    const reactionColumns = useMemo(() => [
        reactionHelper.accessor('nodeId', { header: 'Node', enableSorting: true }),
        reactionHelper.accessor('fx', { header: 'Fx (kN)', cell: (info) => fmt(info.getValue()), enableSorting: true }),
        reactionHelper.accessor('fy', { header: 'Fy (kN)', cell: (info) => fmt(info.getValue()), enableSorting: true }),
        reactionHelper.accessor('fz', { header: 'Fz (kN)', cell: (info) => fmt(info.getValue()), enableSorting: true }),
        reactionHelper.accessor('mx', { header: 'Mx (kN·m)', cell: (info) => fmt(info.getValue()), enableSorting: true }),
        reactionHelper.accessor('my', { header: 'My (kN·m)', cell: (info) => fmt(info.getValue()), enableSorting: true }),
        reactionHelper.accessor('mz', { header: 'Mz (kN·m)', cell: (info) => fmt(info.getValue()), enableSorting: true }),
    ], []);

    const forceColumns = useMemo(() => [
        forceHelper.accessor('memberId', { header: 'Member', enableSorting: true }),
        forceHelper.accessor('axial', { header: 'N (kN)', cell: (info) => fmt(info.getValue()), enableSorting: true }),
        forceHelper.accessor('shearY', { header: 'Vy (kN)', cell: (info) => fmt(info.getValue()), enableSorting: true }),
        forceHelper.accessor('shearZ', { header: 'Vz (kN)', cell: (info) => fmt(info.getValue()), enableSorting: true }),
        forceHelper.accessor('momentY', { header: 'My (kN·m)', cell: (info) => fmt(info.getValue()), enableSorting: true }),
        forceHelper.accessor('momentZ', { header: 'Mz (kN·m)', cell: (info) => fmt(info.getValue()), enableSorting: true }),
        forceHelper.accessor('torsion', { header: 'T (kN·m)', cell: (info) => fmt(info.getValue()), enableSorting: true }),
    ], []);

    // Tables
    const displacementTable = useReactTable({
        data: displacementData,
        columns: displacementColumns,
        state: { sorting },
        onSortingChange: setSorting,
        getCoreRowModel: getCoreRowModel(),
        getSortedRowModel: getSortedRowModel(),
    });

    const reactionTable = useReactTable({
        data: reactionData,
        columns: reactionColumns,
        state: { sorting },
        onSortingChange: setSorting,
        getCoreRowModel: getCoreRowModel(),
        getSortedRowModel: getSortedRowModel(),
    });

    const forceTable = useReactTable({
        data: forceData,
        columns: forceColumns,
        state: { sorting },
        onSortingChange: setSorting,
        getCoreRowModel: getCoreRowModel(),
        getSortedRowModel: getSortedRowModel(),
    });

    // Moved before early return to satisfy Rules of Hooks
    const activeTable = useMemo(() => {
        switch (activeTab) {
            case 'displacements': return displacementTable;
            case 'reactions': return reactionTable;
            case 'forces': return forceTable;
        }
    }, [activeTab, displacementTable, reactionTable, forceTable]);

    const rows = activeTable.getRowModel().rows;

    const rowVirtualizer = useVirtualizer({
        count: rows.length,
        getScrollElement: () => parentRef.current,
        estimateSize: () => 35, // approximate row height
        overscan: 10,
    });

    const handleRowClick = (id: string) => {
        select(id, false);
    };

    const handleExport = () => {
        switch (activeTab) {
            case 'displacements':
                exportToCSV(displacementData, 'node_displacements');
                break;
            case 'reactions':
                exportToCSV(reactionData, 'reactions');
                break;
            case 'forces':
                exportToCSV(forceData, 'member_forces');
                break;
        }
    };

    if (!analysisResults) {
        return (
            <div className="absolute top-16 right-4 w-80 p-6 bg-slate-900/90 backdrop-blur border border-slate-800 rounded-xl shadow-2xl flex items-center justify-center text-slate-500 z-50">
                Run analysis to see results
            </div>
        );
    }

    const renderTable = (table: any) => (
        <table className="w-full text-left border-collapse text-xs" style={{ display: 'grid' }}>
            <thead style={{ display: 'grid', position: 'sticky', top: 0, zIndex: 10 }}>
                {table.getHeaderGroups().map((headerGroup: any) => (
                    <tr key={headerGroup.id} style={{ display: 'flex', width: '100%' }}>
                        {headerGroup.headers.map((header: any) => (
                            <th
                                key={header.id}
                                onClick={header.column.getToggleSortingHandler()}
                                style={{ width: header.getSize() }}
                                className="bg-slate-900 p-3 font-semibold text-slate-300 border-b border-slate-700 cursor-pointer hover:text-white transition-colors flex-1"
                            >
                                <div className="flex items-center gap-1">
                                    {flexRender(header.column.columnDef.header, header.getContext())}
                                    {{
                                        asc: ' ▲',
                                        desc: ' ▼',
                                    }[header.column.getIsSorted() as string] ?? ''}
                                </div>
                            </th>
                        ))}
                    </tr>
                ))}
            </thead>
            <tbody
                style={{
                    display: 'grid',
                    height: `${rowVirtualizer.getTotalSize()}px`,
                    position: 'relative',
                }}
            >
                {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                    const row = rows[virtualRow.index];
                    return (
                        <tr
                            key={row.id}
                            onClick={() => {
                                const orig = row.original as DisplacementRow | ReactionRow | ForceRow;
                                const id = 'nodeId' in orig ? orig.nodeId : 'memberId' in orig ? orig.memberId : undefined;
                                if (id) handleRowClick(id);
                            }}
                            style={{
                                display: 'flex',
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                width: '100%',
                                height: `${virtualRow.size}px`,
                                transform: `translateY(${virtualRow.start}px)`,
                            }}
                            className="hover:bg-blue-600/10 cursor-pointer transition-colors border-b border-slate-800/50"
                        >
                            {row.getVisibleCells().map((cell: any) => (
                                <td key={cell.id} className="p-2.5 font-mono text-slate-200 flex-1 truncate">
                                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                </td>
                            ))}
                        </tr>
                    );
                })}
            </tbody>
        </table>
    );

    return (
        <div className="absolute top-16 right-4 w-[500px] max-h-[calc(100vh-160px)] bg-slate-900 border border-slate-800 rounded-xl shadow-2xl flex flex-col z-40 overflow-hidden ring-1 ring-white/10">
            {/* Header */}
            <div className="flex justify-between items-center px-4 py-3 bg-slate-950 border-b border-slate-800">
                <h3 className="flex items-center gap-2 font-bold text-slate-100 text-sm">
                    <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                    Analysis Results
                </h3>
                <button
                    onClick={handleExport}
                    className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-medium transition-all shadow-lg shadow-blue-500/20"
                >
                    Export CSV
                </button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-slate-800 bg-slate-900">
                {[
                    { id: 'displacements', label: 'Displacements' },
                    { id: 'reactions', label: 'Reactions' },
                    { id: 'forces', label: 'Forces' }
                ].map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as TabType)}
                        className={`
                            flex-1 py-2.5 text-xs font-medium transition-all border-b-2
                            ${activeTab === tab.id
                                ? 'border-blue-500 text-blue-400 bg-blue-500/5'
                                : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                            }
                        `}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Table Area */}
            <div ref={parentRef} className="flex-1 overflow-auto custom-scrollbar bg-slate-900">
                {activeTab === 'displacements' && renderTable(displacementTable)}
                {activeTab === 'reactions' && renderTable(reactionTable)}
                {activeTab === 'forces' && renderTable(forceTable)}
            </div>

            {/* Footer Summary */}
            <div className="px-4 py-2 bg-slate-950 border-t border-slate-800 text-xs text-slate-500 flex justify-between items-center">
                <span>
                    {activeTab === 'displacements' && `Showing ${displacementData.length} Nodes`}
                    {activeTab === 'reactions' && `Showing ${reactionData.length} Supports`}
                    {activeTab === 'forces' && `Showing ${forceData.length} Members`}
                </span>
                <span className="text-slate-600 font-mono">
                    {analysisResults.stats?.solveTimeMs ? `Solved in ${analysisResults.stats.solveTimeMs.toFixed(1)}ms` : ''}
                </span>
            </div>
        </div>
    );
};

export default ResultsTable;
