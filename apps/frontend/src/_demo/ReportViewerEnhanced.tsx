/**
 * ReportViewerEnhanced - Professional Calculation Report Viewer
 * A4-like document layout with breadcrumbs, floating action bar, and print-ready styling
 */

import { FC, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { StatusBadge, DataTable } from '../components/ui';

// Row types for DataTable cell renderers
type ReactionRow = typeof REACTIONS_DATA[number];
type MemberForceRow = typeof MEMBER_FORCES[number];
type CellInfo<T> = { row: { original: T } };

// Sample report data
const SAMPLE_REPORT = {
    id: 'RPT-2024-001',
    projectName: 'Office Building Phase 1',
    analysisType: 'Linear Static Analysis',
    date: 'December 30, 2024',
    engineer: 'John Engineer, P.E.',
    version: '1.0',
    status: 'Final' as const,
};

const REACTIONS_DATA = [
    { node: 'N1', fx: 0.0, fy: -125.4, fz: 0.0, mx: 0.0, my: 0.0, mz: 0.0 },
    { node: 'N2', fx: 0.0, fy: -98.7, fz: 0.0, mx: 0.0, my: 0.0, mz: 0.0 },
    { node: 'N3', fx: -15.2, fy: -203.1, fz: 0.0, mx: 0.0, my: 0.0, mz: 0.0 },
    { node: 'N4', fx: 15.2, fy: -189.5, fz: 0.0, mx: 0.0, my: 0.0, mz: 0.0 },
];

const MEMBER_FORCES = [
    { member: 'M1', axial: -145.2, shear: 23.1, moment: 45.8, utilization: 0.65, status: 'pass' as const },
    { member: 'M2', axial: -132.6, shear: -18.4, moment: -38.2, utilization: 0.58, status: 'pass' as const },
    { member: 'M3', axial: -98.4, shear: 42.7, moment: 89.3, utilization: 0.92, status: 'warning' as const },
    { member: 'M4', axial: -156.8, shear: -31.5, moment: -52.3, utilization: 0.72, status: 'pass' as const },
];

export const ReportViewerEnhanced: FC = () => {
    const navigate = useNavigate();
    const { reportId } = useParams();
    const [showFloatingBar, setShowFloatingBar] = useState(true);

    const handlePrint = () => {
        window.print();
    };

    const handleDownloadPDF = () => {
        const reportText = [
            `Report ID: ${SAMPLE_REPORT.id}`,
            `Project: ${SAMPLE_REPORT.projectName}`,
            `Analysis: ${SAMPLE_REPORT.analysisType}`,
            `Date: ${SAMPLE_REPORT.date}`,
            `Engineer: ${SAMPLE_REPORT.engineer}`,
            `Version: ${SAMPLE_REPORT.version}`,
            '',
            'Support Reactions',
            ...REACTIONS_DATA.map((r) => `${r.node}: Fy=${r.fy} kN`),
            '',
            'Member Forces',
            ...MEMBER_FORCES.map((m) => `${m.member}: M=${m.moment} kN·m, Util=${(m.utilization * 100).toFixed(1)}%`),
        ].join('\n');

        const blob = new Blob([reportText], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${SAMPLE_REPORT.id}-report.txt`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const handleShare = () => {
        const shareText = `${SAMPLE_REPORT.projectName} (${SAMPLE_REPORT.id})`;
        if (navigator.share) {
            void navigator.share({
                title: 'BeamLab Structural Report',
                text: shareText,
                url: window.location.href,
            });
            return;
        }
        void navigator.clipboard?.writeText(window.location.href);
    };

    return (
        <div className="min-h-screen bg-slate-100 font-display">
            {/* Header with Breadcrumbs - Hide on print */}
            <header className="bg-white border-b border-slate-200 print:hidden sticky top-0 z-40 shadow-sm">
                <div className="max-w-7xl mx-auto px-6 py-4">
                    {/* Breadcrumbs */}
                    <nav className="flex items-center gap-2 text-sm mb-3">
                        <button type="button"
                            onClick={() => navigate('/stream')}
                            className="text-steel-blue/60 hover:text-steel-blue transition-colors"
                        >
                            Dashboard
                        </button>
                        <span className="material-symbols-outlined text-steel-blue/40 text-[16px]">chevron_right</span>
                        <button type="button"
                            onClick={() => navigate('/reports')}
                            className="text-steel-blue/60 hover:text-steel-blue transition-colors"
                        >
                            Reports
                        </button>
                        <span className="material-symbols-outlined text-steel-blue/40 text-[16px]">chevron_right</span>
                        <span className="text-steel-blue font-medium tracking-wide">{SAMPLE_REPORT.id}</span>
                    </nav>

                    {/* Title and Actions */}
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-2xl font-bold text-steel-blue">{SAMPLE_REPORT.projectName}</h1>
                            <p className="text-sm text-steel-blue/60 mt-1">
                                {SAMPLE_REPORT.analysisType} • {SAMPLE_REPORT.date}
                            </p>
                        </div>
                        <div className="flex items-center gap-2">
                            <StatusBadge variant={SAMPLE_REPORT.status === 'Final' ? 'ok' : 'draft'}>
                                {SAMPLE_REPORT.status}
                            </StatusBadge>
                        </div>
                    </div>
                </div>
            </header>

            {/* Main Content - A4 Document Style */}
            <main className="max-w-[210mm] mx-auto p-6 print:p-0">
                {/* A4 Paper Container */}
                <div className="bg-white shadow-lg print:shadow-none mb-8" style={{ minHeight: '297mm' }}>
                    {/* Document Content */}
                    <div className="p-12 print:p-16">
                        {/* Report Header */}
                        <div className="border-b-4 border-primary pb-6 mb-8">
                            <div className="flex items-start justify-between">
                                <div>
                                    <div className="flex items-center gap-3 mb-2">
                                        <div className="w-12 h-12 bg-accent rounded flex items-center justify-center">
                                            <span className="material-symbols-outlined text-steel-blue text-[28px]">description</span>
                                        </div>
                                        <div>
                                            <h1 className="text-3xl font-bold text-steel-blue">Structural Analysis Report</h1>
                                            <p className="text-sm text-steel-blue/60 font-mono">{SAMPLE_REPORT.id}</p>
                                        </div>
                                    </div>
                                </div>
                                <div className="text-right text-sm">
                                    <p className="text-steel-blue/60">Report Date</p>
                                    <p className="font-bold text-steel-blue">{SAMPLE_REPORT.date}</p>
                                </div>
                            </div>
                        </div>

                        {/* Project Information */}
                        <section className="mb-8">
                            <h2 className="text-xl font-bold text-steel-blue mb-4 flex items-center gap-2">
                                <span className="material-symbols-outlined text-primary">info</span>
                                Project Information
                            </h2>
                            <div className="grid grid-cols-2 gap-4 bg-slate-50 p-6 rounded-lg">
                                <div>
                                    <p className="text-xs text-steel-blue/60 font-semibold uppercase mb-1">Project Name</p>
                                    <p className="text-steel-blue font-medium tracking-wide">{SAMPLE_REPORT.projectName}</p>
                                </div>
                                <div>
                                    <p className="text-xs text-steel-blue/60 font-semibold uppercase mb-1">Analysis Type</p>
                                    <p className="text-steel-blue font-medium tracking-wide">{SAMPLE_REPORT.analysisType}</p>
                                </div>
                                <div>
                                    <p className="text-xs text-steel-blue/60 font-semibold uppercase mb-1">Prepared By</p>
                                    <p className="text-steel-blue font-medium tracking-wide">{SAMPLE_REPORT.engineer}</p>
                                </div>
                                <div>
                                    <p className="text-xs text-steel-blue/60 font-semibold uppercase mb-1">Report Version</p>
                                    <p className="text-steel-blue font-medium tracking-wide">{SAMPLE_REPORT.version}</p>
                                </div>
                            </div>
                        </section>

                        {/* Model Summary */}
                        <section className="mb-8">
                            <h2 className="text-xl font-bold text-steel-blue mb-4 flex items-center gap-2">
                                <span className="material-symbols-outlined text-primary">deployed_code</span>
                                Model Summary
                            </h2>
                            <div className="grid grid-cols-3 gap-4">
                                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
                                    <p className="text-3xl font-bold text-primary mb-1">48</p>
                                    <p className="text-xs text-steel-blue/70 font-semibold uppercase">Nodes</p>
                                </div>
                                <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
                                    <p className="text-3xl font-bold text-green-600 mb-1">82</p>
                                    <p className="text-xs text-steel-blue/70 font-semibold uppercase">Members</p>
                                </div>
                                <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 text-center">
                                    <p className="text-3xl font-bold text-orange-600 mb-1">3</p>
                                    <p className="text-xs text-steel-blue/70 font-semibold uppercase">Load Cases</p>
                                </div>
                            </div>
                        </section>

                        {/* Support Reactions */}
                        <section className="mb-8 page-break">
                            <h2 className="text-xl font-bold text-steel-blue mb-4 flex items-center gap-2">
                                <span className="material-symbols-outlined text-primary">support</span>
                                Support Reactions
                            </h2>
                            <div className="border border-slate-200 rounded-lg overflow-hidden">
                                <DataTable
                                    columns={[
                                        { accessor: 'node', header: 'Node' },
                                        {
                                            accessor: 'fx',
                                            header: 'FX (kN)',
                                            cell: ({ row }: CellInfo<ReactionRow>) => <span className="font-mono">{row.original.fx.toFixed(2)}</span>
                                        },
                                        {
                                            accessor: 'fy',
                                            header: 'FY (kN)',
                                            cell: ({ row }: CellInfo<ReactionRow>) => <span className="font-mono font-semibold">{row.original.fy.toFixed(2)}</span>
                                        },
                                        {
                                            accessor: 'fz',
                                            header: 'FZ (kN)',
                                            cell: ({ row }: CellInfo<ReactionRow>) => <span className="font-mono">{row.original.fz.toFixed(2)}</span>
                                        },
                                        {
                                            accessor: 'mx',
                                            header: 'MX (kN·m)',
                                            cell: ({ row }: CellInfo<ReactionRow>) => <span className="font-mono">{row.original.mx.toFixed(2)}</span>
                                        },
                                        {
                                            accessor: 'my',
                                            header: 'MY (kN·m)',
                                            cell: ({ row }: CellInfo<ReactionRow>) => <span className="font-mono">{row.original.my.toFixed(2)}</span>
                                        },
                                        {
                                            accessor: 'mz',
                                            header: 'MZ (kN·m)',
                                            cell: ({ row }: CellInfo<ReactionRow>) => <span className="font-mono">{row.original.mz.toFixed(2)}</span>
                                        },
                                    ]}
                                    data={REACTIONS_DATA}
                                    compact
                                />
                            </div>
                        </section>

                        {/* Member Forces */}
                        <section className="mb-8">
                            <h2 className="text-xl font-bold text-steel-blue mb-4 flex items-center gap-2">
                                <span className="material-symbols-outlined text-primary">analytics</span>
                                Member Forces (Maximum)
                            </h2>
                            <div className="border border-slate-200 rounded-lg overflow-hidden">
                                <DataTable
                                    columns={[
                                        { accessor: 'member', header: 'Member' },
                                        {
                                            accessor: 'axial',
                                            header: 'Axial (kN)',
                                            cell: ({ row }: CellInfo<MemberForceRow>) => (
                                                <span className={`font-mono font-semibold ${row.original.axial < 0 ? 'text-blue-600' : 'text-red-600'}`}>
                                                    {row.original.axial.toFixed(1)}
                                                </span>
                                            )
                                        },
                                        {
                                            accessor: 'shear',
                                            header: 'Shear (kN)',
                                            cell: ({ row }: CellInfo<MemberForceRow>) => <span className="font-mono">{row.original.shear.toFixed(1)}</span>
                                        },
                                        {
                                            accessor: 'moment',
                                            header: 'Moment (kN·m)',
                                            cell: ({ row }: CellInfo<MemberForceRow>) => <span className="font-mono">{row.original.moment.toFixed(1)}</span>
                                        },
                                        {
                                            accessor: 'utilization',
                                            header: 'Utilization',
                                            cell: ({ row }: CellInfo<MemberForceRow>) => (
                                                <span className={`font-mono font-bold ${row.original.utilization > 0.9 ? 'text-orange-600' :
                                                    row.original.utilization > 0.7 ? 'text-yellow-600' :
                                                        'text-green-600'
                                                    }`}>
                                                    {(row.original.utilization * 100).toFixed(0)}%
                                                </span>
                                            )
                                        },
                                        {
                                            accessor: 'status',
                                            header: 'Status',
                                            cell: ({ row }: CellInfo<MemberForceRow>) => (
                                                <StatusBadge variant={row.original.status} size="sm">
                                                    {row.original.status === 'pass' ? '✓' : '!'}
                                                </StatusBadge>
                                            )
                                        },
                                    ]}
                                    data={MEMBER_FORCES}
                                    compact
                                />
                            </div>
                        </section>

                        {/* Design Summary */}
                        <section className="mb-8">
                            <h2 className="text-xl font-bold text-steel-blue mb-4 flex items-center gap-2">
                                <span className="material-symbols-outlined text-primary">check_circle</span>
                                Design Summary
                            </h2>
                            <div className="bg-green-50 border border-green-200 rounded-lg p-6">
                                <div className="flex items-start gap-4">
                                    <div className="w-12 h-12 rounded-full bg-green-500 flex items-center justify-center shrink-0">
                                        <span className="material-symbols-outlined text-white text-[28px]">done</span>
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-bold text-green-800 mb-2">All Design Checks PASSED</h3>
                                        <p className="text-green-700 text-sm mb-3">
                                            All structural members meet the design requirements per AISC 360-16.
                                            Maximum utilization ratio: 92%.
                                        </p>
                                        <div className="flex gap-4 text-sm">
                                            <div>
                                                <p className="text-green-600 font-semibold">Tension: PASS</p>
                                            </div>
                                            <div>
                                                <p className="text-green-600 font-semibold">Compression: PASS</p>
                                            </div>
                                            <div>
                                                <p className="text-green-600 font-semibold">Flexure: PASS</p>
                                            </div>
                                            <div>
                                                <p className="text-green-600 font-semibold">Combined: PASS</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </section>

                        {/* Certification */}
                        <section className="mt-16 pt-8 border-t border-slate-300">
                            <div className="flex justify-between items-end">
                                <div>
                                    <p className="text-sm text-steel-blue/60 mb-2">Prepared by</p>
                                    <div className="border-b-2 border-steel-blue/30 pb-1 mb-2 w-64">
                                        <p className="font-bold text-steel-blue">{SAMPLE_REPORT.engineer}</p>
                                    </div>
                                    <p className="text-xs text-steel-blue/50">Professional Engineer</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-xs text-steel-blue/60 mb-1">Generated by</p>
                                    <p className="font-bold text-primary">BeamLab v4.2.0</p>
                                    <p className="text-xs text-steel-blue/50">© {new Date().getFullYear()} BeamLab Ultimate</p>
                                </div>
                            </div>
                        </section>
                    </div>
                </div>
            </main>

            {/* Floating Action Bar - Hide on print */}
            {showFloatingBar && (
                <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-steel-blue shadow-2xl rounded-full px-6 py-3 flex items-center gap-4 z-50 print:hidden">
                    <button type="button"
                        onClick={handlePrint}
                        className="flex items-center gap-2 text-[#dae2fd] hover:text-accent transition-colors"
                    >
                        <span className="material-symbols-outlined text-[20px]">print</span>
                        <span className="text-sm font-medium tracking-wide">Print</span>
                    </button>
                    <div className="w-px h-6 bg-white/20"></div>
                    <button type="button"
                        onClick={handleDownloadPDF}
                        className="flex items-center gap-2 text-[#dae2fd] hover:text-accent transition-colors"
                    >
                        <span className="material-symbols-outlined text-[20px]">download</span>
                        <span className="text-sm font-medium tracking-wide">Download PDF</span>
                    </button>
                    <div className="w-px h-6 bg-white/20"></div>
                    <button type="button"
                        onClick={handleShare}
                        className="flex items-center gap-2 text-[#dae2fd] hover:text-accent transition-colors"
                    >
                        <span className="material-symbols-outlined text-[20px]">share</span>
                        <span className="text-sm font-medium tracking-wide">Share</span>
                    </button>
                    <div className="w-px h-6 bg-white/20"></div>
                    <button type="button"
                        onClick={() => setShowFloatingBar(false)}
                        className="flex items-center justify-center w-8 h-8 text-white/60 hover:text-[#dae2fd] transition-colors"
                    >
                        <span className="material-symbols-outlined text-[20px]">close</span>
                    </button>
                </div>
            )}

            {/* Print Styles */}
            <style>{`
                @media print {
                    @page {
                        size: A4;
                        margin: 0;
                    }
                    
                    body {
                        background: white;
                        print-color-adjust: exact;
                        -webkit-print-color-adjust: exact;
                    }
                    
                    .page-break {
                        page-break-before: always;
                    }
                    
                    .print\\:hidden {
                        display: none !important;
                    }
                    
                    .print\\:shadow-none {
                        box-shadow: none !important;
                    }
                    
                    .print\\:p-0 {
                        padding: 0 !important;
                    }
                    
                    .print\\:p-16 {
                        padding: 4rem !important;
                    }
                }
            `}</style>
        </div>
    );
};

export default ReportViewerEnhanced;
