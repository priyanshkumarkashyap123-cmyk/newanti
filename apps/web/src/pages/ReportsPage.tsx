/**
 * ReportsPage.tsx - Calculation Report Document Viewer
 * A4 document viewer with calculation sections and results tables
 */

import { Link } from 'react-router-dom';
import {
    Download, Printer, Share2, Calculator, TableProperties,
    Check, X, FileText, ChevronLeft, Bell, Zap
} from 'lucide-react';

// ============================================
// TYPES & DATA
// ============================================

interface ResultRow {
    member: string;
    force: string;
    capacity: string;
    ratio: number;
    status: 'PASS' | 'FAIL';
}

const sampleResults: ResultRow[] = [
    { member: 'B-101', force: '85.4 kNm', capacity: '145.0 kNm', ratio: 0.59, status: 'PASS' },
    { member: 'B-102', force: '112.1 kNm', capacity: '145.0 kNm', ratio: 0.77, status: 'PASS' },
    { member: 'B-103', force: '155.2 kNm', capacity: '145.0 kNm', ratio: 1.07, status: 'FAIL' },
    { member: 'B-104', force: '120.0 kNm', capacity: '145.0 kNm', ratio: 0.83, status: 'PASS' },
];

// ============================================
// COMPONENT
// ============================================

export const ReportsPage = () => {
    return (
        <div className="min-h-screen bg-zinc-200 dark:bg-zinc-900 flex flex-col">
            {/* Header */}
            <header className="sticky top-0 z-50 flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-900/90 backdrop-blur-md px-6 py-3">
                <div className="flex items-center gap-4">
                    <Link to="/" className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                            <Zap className="w-5 h-5 text-white" />
                        </div>
                        <h2 className="text-lg font-bold tracking-tight text-zinc-900 dark:text-white">BeamLab Ultimate</h2>
                    </Link>
                </div>
                <div className="hidden md:flex flex-1 justify-center">
                    <nav className="flex items-center gap-2 bg-zinc-100 dark:bg-zinc-800 px-4 py-1.5 rounded-full">
                        <Link to="/dashboard" className="text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white text-sm font-medium transition-colors px-3 py-1">
                            Projects
                        </Link>
                        <Link to="/app" className="text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white text-sm font-medium transition-colors px-3 py-1">
                            Design
                        </Link>
                        <span className="text-blue-600 dark:text-white text-sm font-bold bg-white dark:bg-zinc-700 shadow-sm px-3 py-1 rounded-full">
                            Reports
                        </span>
                        <Link to="/settings" className="text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white text-sm font-medium transition-colors px-3 py-1">
                            Settings
                        </Link>
                    </nav>
                </div>
                <div className="flex items-center gap-4">
                    <button className="relative text-zinc-500 dark:text-zinc-400 hover:text-blue-600 transition-colors">
                        <Bell className="w-6 h-6" />
                        <span className="absolute top-0 right-0 w-2 h-2 bg-red-500 rounded-full border-2 border-white dark:border-zinc-900" />
                    </button>
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 border-2 border-white dark:border-zinc-700 shadow-sm" />
                </div>
            </header>

            {/* Main Content */}
            <main className="flex-1 w-full flex flex-col items-center py-8 px-4 overflow-y-auto">
                {/* Breadcrumbs */}
                <div className="w-full max-w-[210mm] mb-6 flex items-center gap-2 text-sm">
                    <Link to="/dashboard" className="text-zinc-500 hover:text-blue-600 transition-colors">Projects</Link>
                    <ChevronLeft className="w-4 h-4 text-zinc-400 rotate-180" />
                    <span className="text-zinc-500">Skyline Tower</span>
                    <ChevronLeft className="w-4 h-4 text-zinc-400 rotate-180" />
                    <span className="text-zinc-900 dark:text-white font-semibold">Report #2024-12-28</span>
                </div>

                {/* A4 Document */}
                <article className="relative w-full max-w-[210mm] min-h-[297mm] bg-white dark:bg-zinc-800 shadow-2xl rounded-sm p-8 md:p-12 mb-24 transition-colors">
                    {/* Document Header */}
                    <div className="flex flex-wrap justify-between items-end border-b-2 border-zinc-100 dark:border-zinc-700 pb-6 mb-8">
                        <div className="flex flex-col gap-2">
                            <div className="flex items-center gap-2 text-blue-600 opacity-80">
                                <FileText className="w-5 h-5" />
                                <span className="text-xs font-bold uppercase tracking-widest">Structural Analysis</span>
                            </div>
                            <h1 className="text-zinc-900 dark:text-white text-3xl md:text-4xl font-black tracking-tight">
                                BeamLab Analysis Report
                            </h1>
                        </div>
                        <div className="flex flex-col items-end">
                            <p className="text-zinc-400 dark:text-zinc-500 text-sm font-medium uppercase tracking-wide">Generated on</p>
                            <p className="text-zinc-700 dark:text-zinc-300 text-lg font-bold">December 28, 2024</p>
                        </div>
                    </div>

                    {/* Summary Box */}
                    <section className="bg-zinc-50 dark:bg-zinc-900/50 rounded-lg border border-zinc-200 dark:border-zinc-700 p-6 mb-10">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="flex flex-col gap-1">
                                <span className="text-zinc-500 dark:text-zinc-400 text-xs font-semibold uppercase tracking-wider">Project Name</span>
                                <span className="text-zinc-900 dark:text-white font-bold text-lg">Skyline Tower - Level 4</span>
                            </div>
                            <div className="flex flex-col gap-1 border-l-0 md:border-l border-zinc-200 dark:border-zinc-700 md:pl-6">
                                <span className="text-zinc-500 dark:text-zinc-400 text-xs font-semibold uppercase tracking-wider">Engineer</span>
                                <div className="flex items-center gap-2">
                                    <div className="w-6 h-6 rounded-full bg-gradient-to-br from-green-400 to-blue-500" />
                                    <span className="text-zinc-900 dark:text-white font-medium">J. Doe, PE</span>
                                </div>
                            </div>
                            <div className="flex flex-col gap-1 border-l-0 md:border-l border-zinc-200 dark:border-zinc-700 md:pl-6">
                                <span className="text-zinc-500 dark:text-zinc-400 text-xs font-semibold uppercase tracking-wider">Code Standard</span>
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 w-fit">
                                    AISC 360-16 (LRFD)
                                </span>
                            </div>
                        </div>
                    </section>

                    {/* Section 1: Hand Calculations */}
                    <section className="mb-10">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="flex items-center justify-center w-8 h-8 rounded bg-blue-600/10 text-blue-600">
                                <Calculator className="w-5 h-5" />
                            </div>
                            <h2 className="text-zinc-900 dark:text-white text-xl font-bold">Section 1 - Hand Calculations</h2>
                        </div>

                        <div className="relative overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900">
                            {/* Notebook paper pattern */}
                            <div className="absolute inset-0 opacity-[0.03] dark:opacity-[0.05] pointer-events-none"
                                style={{ backgroundImage: 'linear-gradient(#000 1px, transparent 1px)', backgroundSize: '100% 2rem' }} />

                            <div className="p-6 font-mono text-sm leading-8 text-zinc-700 dark:text-zinc-300">
                                <p className="font-bold text-zinc-900 dark:text-white mb-2">// Load Case: 1.2D + 1.6L (Gravity)</p>
                                <p className="mb-1">Target Member: <span className="text-blue-600 font-semibold">B-104 (W12x26)</span></p>

                                <div className="pl-4 border-l-2 border-blue-600/20 my-4 space-y-2">
                                    <p>w_u = 1.2 * (4.5 kN/m) + 1.6 * (6.0 kN/m) = <span className="font-bold">15.0 kN/m</span></p>
                                    <p>L = 8.0 m</p>

                                    <p className="mt-4 text-zinc-500">// Bending Moment Calculation</p>
                                    <p>M_u = (w_u * L^2) / 8</p>
                                    <p>M_u = (15.0 * 8.0^2) / 8 = <span className="bg-yellow-100 dark:bg-yellow-900/30 px-1 rounded text-yellow-800 dark:text-yellow-200 font-bold">120.0 kNm</span></p>

                                    <p className="mt-4 text-zinc-500">// Shear Force Calculation</p>
                                    <p>V_u = (w_u * L) / 2</p>
                                    <p>V_u = (15.0 * 8.0) / 2 = <span className="font-bold">60.0 kN</span></p>
                                </div>

                                <p className="text-green-600 dark:text-green-400 font-bold flex items-center gap-2">
                                    <Check className="w-4 h-4" />
                                    Checks match simplified analysis.
                                </p>
                            </div>
                        </div>
                    </section>

                    {/* Section 2: Results Table */}
                    <section className="mb-4">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="flex items-center justify-center w-8 h-8 rounded bg-blue-600/10 text-blue-600">
                                <TableProperties className="w-5 h-5" />
                            </div>
                            <h2 className="text-zinc-900 dark:text-white text-xl font-bold">Section 2 - Results Table</h2>
                        </div>

                        <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 overflow-hidden">
                            <table className="w-full text-left text-sm">
                                <thead>
                                    <tr className="bg-zinc-50 dark:bg-zinc-800 border-b border-zinc-200 dark:border-zinc-700">
                                        <th className="px-6 py-3 font-bold text-zinc-900 dark:text-white">Member</th>
                                        <th className="px-6 py-3 font-bold text-zinc-900 dark:text-white">Force (M_u)</th>
                                        <th className="px-6 py-3 font-bold text-zinc-900 dark:text-white">Capacity (φ*M_n)</th>
                                        <th className="px-6 py-3 font-bold text-zinc-900 dark:text-white">Ratio</th>
                                        <th className="px-6 py-3 font-bold text-zinc-900 dark:text-white text-right">Status</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-700/50 bg-white dark:bg-zinc-900">
                                    {sampleResults.map((row, index) => (
                                        <tr
                                            key={row.member}
                                            className={`${row.status === 'FAIL'
                                                    ? 'bg-red-50 dark:bg-red-900/10 border-l-4 border-l-red-500'
                                                    : index % 2 === 1 ? 'bg-zinc-50/50 dark:bg-zinc-800/20' : ''
                                                } hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors`}
                                        >
                                            <td className={`px-6 py-3 font-medium ${row.status === 'FAIL' ? 'text-red-900 dark:text-red-200 font-bold' : 'text-zinc-900 dark:text-white'}`}>
                                                {row.member}
                                            </td>
                                            <td className={`px-6 py-3 ${row.status === 'FAIL' ? 'text-red-800 dark:text-red-300' : 'text-zinc-600 dark:text-zinc-400'}`}>
                                                {row.force}
                                            </td>
                                            <td className={`px-6 py-3 ${row.status === 'FAIL' ? 'text-red-800 dark:text-red-300' : 'text-zinc-600 dark:text-zinc-400'}`}>
                                                {row.capacity}
                                            </td>
                                            <td className={`px-6 py-3 ${row.status === 'FAIL' ? 'text-red-800 dark:text-red-300 font-bold' : 'text-zinc-600 dark:text-zinc-400'}`}>
                                                {row.ratio.toFixed(2)}
                                            </td>
                                            <td className="px-6 py-3 text-right">
                                                {row.status === 'PASS' ? (
                                                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-bold bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                                                        PASS
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-bold bg-white text-red-700 border border-red-200 dark:bg-red-950 dark:text-red-400 dark:border-red-900">
                                                        FAIL
                                                    </span>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </section>

                    {/* Footer */}
                    <div className="mt-8 pt-6 border-t border-zinc-100 dark:border-zinc-800 text-center">
                        <p className="text-zinc-400 text-xs">BeamLab Ultimate - Licensed to Skyline Engineering Ltd.</p>
                    </div>
                </article>
            </main>

            {/* Floating Action Bar */}
            <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40">
                <div className="flex items-center gap-2 p-2 rounded-xl bg-white dark:bg-zinc-800 shadow-xl border border-zinc-200 dark:border-zinc-700">
                    <button className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm transition-all shadow-md shadow-blue-500/20">
                        <Download className="w-5 h-5" />
                        Download PDF
                    </button>
                    <div className="w-px h-6 bg-zinc-200 dark:bg-zinc-700 mx-1" />
                    <button className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700 font-medium text-sm transition-colors">
                        <Printer className="w-5 h-5" />
                        Print
                    </button>
                    <button className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700 font-medium text-sm transition-colors">
                        <Share2 className="w-5 h-5" />
                        Share Link
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ReportsPage;
