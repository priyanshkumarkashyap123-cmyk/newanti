import { FC, useState, useMemo } from 'react';
import {
    useReactTable,
    getCoreRowModel,
    getSortedRowModel,
    flexRender,
    createColumnHelper,
    type SortingState,
} from '@tanstack/react-table';
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
            <div style={containerStyle}>
                <div style={emptyStyle}>
                    Run analysis to see results
                </div>
            </div>
        );
    }

    return (
        <div style={containerStyle}>
            {/* Header */}
            <div style={headerStyle}>
                <h3 style={{ margin: 0, color: 'white' }}>📊 Analysis Results</h3>
                <button onClick={handleExport} style={exportBtnStyle}>
                    📥 Export CSV
                </button>
            </div>

            {/* Tabs */}
            <div style={tabsStyle}>
                <button
                    onClick={() => setActiveTab('displacements')}
                    style={activeTab === 'displacements' ? activeTabStyle : tabStyle}
                >
                    Node Displacements
                </button>
                <button
                    onClick={() => setActiveTab('reactions')}
                    style={activeTab === 'reactions' ? activeTabStyle : tabStyle}
                >
                    Reactions
                </button>
                <button
                    onClick={() => setActiveTab('forces')}
                    style={activeTab === 'forces' ? activeTabStyle : tabStyle}
                >
                    Beam Forces
                </button>
            </div>

            {/* Table */}
            <div style={tableContainerStyle}>
                {activeTab === 'displacements' && (
                    <table style={tableStyle}>
                        <thead>
                            {displacementTable.getHeaderGroups().map(headerGroup => (
                                <tr key={headerGroup.id}>
                                    {headerGroup.headers.map(header => (
                                        <th
                                            key={header.id}
                                            onClick={header.column.getToggleSortingHandler()}
                                            style={{
                                                ...thStyle,
                                                cursor: header.column.getCanSort() ? 'pointer' : 'default'
                                            }}
                                        >
                                            {flexRender(header.column.columnDef.header, header.getContext())}
                                            {{
                                                asc: ' 🔼',
                                                desc: ' 🔽',
                                            }[header.column.getIsSorted() as string] ?? ''}
                                        </th>
                                    ))}
                                </tr>
                            ))}
                        </thead>
                        <tbody>
                            {displacementTable.getRowModel().rows.map(row => (
                                <tr
                                    key={row.id}
                                    onClick={() => handleRowClick(row.original.nodeId)}
                                    style={rowStyle}
                                >
                                    {row.getVisibleCells().map(cell => (
                                        <td key={cell.id} style={tdStyle}>
                                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}

                {activeTab === 'reactions' && (
                    <table style={tableStyle}>
                        <thead>
                            {reactionTable.getHeaderGroups().map(headerGroup => (
                                <tr key={headerGroup.id}>
                                    {headerGroup.headers.map(header => (
                                        <th
                                            key={header.id}
                                            onClick={header.column.getToggleSortingHandler()}
                                            style={{
                                                ...thStyle,
                                                cursor: header.column.getCanSort() ? 'pointer' : 'default'
                                            }}
                                        >
                                            {flexRender(header.column.columnDef.header, header.getContext())}
                                            {{
                                                asc: ' 🔼',
                                                desc: ' 🔽',
                                            }[header.column.getIsSorted() as string] ?? ''}
                                        </th>
                                    ))}
                                </tr>
                            ))}
                        </thead>
                        <tbody>
                            {reactionTable.getRowModel().rows.map(row => (
                                <tr
                                    key={row.id}
                                    onClick={() => handleRowClick(row.original.nodeId)}
                                    style={rowStyle}
                                >
                                    {row.getVisibleCells().map(cell => (
                                        <td key={cell.id} style={tdStyle}>
                                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}

                {activeTab === 'forces' && (
                    <table style={tableStyle}>
                        <thead>
                            {forceTable.getHeaderGroups().map(headerGroup => (
                                <tr key={headerGroup.id}>
                                    {headerGroup.headers.map(header => (
                                        <th
                                            key={header.id}
                                            onClick={header.column.getToggleSortingHandler()}
                                            style={{
                                                ...thStyle,
                                                cursor: header.column.getCanSort() ? 'pointer' : 'default'
                                            }}
                                        >
                                            {flexRender(header.column.columnDef.header, header.getContext())}
                                            {{
                                                asc: ' 🔼',
                                                desc: ' 🔽',
                                            }[header.column.getIsSorted() as string] ?? ''}
                                        </th>
                                    ))}
                                </tr>
                            ))}
                        </thead>
                        <tbody>
                            {forceTable.getRowModel().rows.map(row => (
                                <tr
                                    key={row.id}
                                    onClick={() => handleRowClick(row.original.memberId)}
                                    style={rowStyle}
                                >
                                    {row.getVisibleCells().map(cell => (
                                        <td key={cell.id} style={tdStyle}>
                                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {/* Summary */}
            <div style={summaryStyle}>
                {activeTab === 'displacements' && (
                    <span>📍 {displacementData.length} nodes</span>
                )}
                {activeTab === 'reactions' && (
                    <span>🔒 {reactionData.length} supports</span>
                )}
                {activeTab === 'forces' && (
                    <span>📐 {forceData.length} members</span>
                )}
            </div>
        </div>
    );
};

// Styles
const containerStyle: React.CSSProperties = {
    position: 'absolute',
    top: 60,
    right: 10,
    width: 450,
    maxHeight: 'calc(100vh - 150px)',
    background: 'rgba(20, 20, 25, 0.95)',
    borderRadius: '8px',
    border: '1px solid rgba(255,255,255,0.1)',
    display: 'flex',
    flexDirection: 'column',
    zIndex: 150,
    overflow: 'hidden'
};

const headerStyle: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px 16px',
    borderBottom: '1px solid rgba(255,255,255,0.1)',
    background: 'rgba(0,0,0,0.3)'
};

const exportBtnStyle: React.CSSProperties = {
    background: '#2563eb',
    color: 'white',
    border: 'none',
    padding: '6px 12px',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '12px'
};

const tabsStyle: React.CSSProperties = {
    display: 'flex',
    borderBottom: '1px solid rgba(255,255,255,0.1)'
};

const tabStyle: React.CSSProperties = {
    flex: 1,
    padding: '10px',
    background: 'transparent',
    border: 'none',
    color: 'rgba(255,255,255,0.6)',
    cursor: 'pointer',
    fontSize: '12px',
    transition: 'all 0.2s'
};

const activeTabStyle: React.CSSProperties = {
    ...tabStyle,
    color: 'white',
    background: 'rgba(37, 99, 235, 0.3)',
    borderBottom: '2px solid #2563eb'
};

const tableContainerStyle: React.CSSProperties = {
    flex: 1,
    overflow: 'auto',
    maxHeight: '400px'
};

const tableStyle: React.CSSProperties = {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '11px'
};

const thStyle: React.CSSProperties = {
    padding: '8px 6px',
    textAlign: 'left',
    background: 'rgba(0,0,0,0.4)',
    color: 'rgba(255,255,255,0.8)',
    fontWeight: 600,
    position: 'sticky',
    top: 0,
    borderBottom: '1px solid rgba(255,255,255,0.1)'
};

const tdStyle: React.CSSProperties = {
    padding: '6px',
    color: 'rgba(255,255,255,0.9)',
    borderBottom: '1px solid rgba(255,255,255,0.05)',
    fontFamily: 'monospace'
};

const rowStyle: React.CSSProperties = {
    cursor: 'pointer',
    transition: 'background 0.15s'
};

const summaryStyle: React.CSSProperties = {
    padding: '8px 16px',
    borderTop: '1px solid rgba(255,255,255,0.1)',
    color: 'rgba(255,255,255,0.5)',
    fontSize: '11px'
};

const emptyStyle: React.CSSProperties = {
    padding: '40px',
    textAlign: 'center',
    color: 'rgba(255,255,255,0.5)'
};

export default ResultsTable;
