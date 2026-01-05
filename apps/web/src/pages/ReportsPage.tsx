/**
 * ReportsPage.tsx - Calculation Report Document Viewer
 * A4 document viewer with calculation sections and results tables
 * 
 * Redesigned for Navy/Slate Theme & Real Data Integration
 */

import { Link } from 'react-router-dom';
import {
    Download, Printer, Share2, Calculator, TableProperties,
    Check, X, FileText, ChevronLeft, Bell, Zap, Cpu, Building2, Calendar
} from 'lucide-react';
import { useModelStore } from '../store/model';
import { useAuth } from '../providers/AuthProvider';

export const ReportsPage = () => {
    // Connect to real data store
    const { user } = useAuth();
    const nodes = useModelStore((state) => state.nodes);
    const members = useModelStore((state) => state.members);
    const analysisResults = useModelStore((state) => state.analysisResults);

    const userName = user?.firstName || 'Engineer';
    const currentDate = new Date().toLocaleDateString('en-US', {
        year: 'numeric', month: 'long', day: 'numeric',
        hour: '2-digit', minute: '2-digit'
    });

    const handlePrint = () => {
        window.print();
    };

    return (
        <div className="min-h-screen bg-slate-100 dark:bg-slate-950 flex flex-col font-sans selection:bg-blue-500/30 print:bg-white">
            {/* Header - Hidden in Print */}
            <header className="sticky top-0 z-50 flex items-center justify-between border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-950/90 backdrop-blur-md px-6 py-3 print:hidden">
                <div className="flex items-center gap-4">
                    <Link to="/" className="flex items-center gap-3 group">
                        <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-purple-600 rounded-lg flex items-center justify-center shadow-lg group-hover:shadow-blue-500/25 transition-all">
                            <Cpu className="w-5 h-5 text-white" />
                        </div>
                        <h2 className="text-lg font-bold tracking-tight text-slate-900 dark:text-white">BeamLab Ultimate</h2>
                    </Link>
                </div>
                <div className="hidden md:flex flex-1 justify-center">
                    <nav className="flex items-center gap-1 bg-slate-100 dark:bg-slate-900 px-2 py-1 rounded-full border border-slate-200 dark:border-slate-800">
                        <Link to="/stream" className="text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white text-sm font-medium transition-colors px-4 py-1.5 rounded-full hover:bg-white dark:hover:bg-slate-800">
                            Projects
                        </Link>
                        <Link to="/app" className="text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white text-sm font-medium transition-colors px-4 py-1.5 rounded-full hover:bg-white dark:hover:bg-slate-800">
                            Design
                        </Link>
                        <span className="text-blue-600 dark:text-white text-sm font-bold bg-white dark:bg-slate-800 shadow-sm px-4 py-1.5 rounded-full border border-slate-200 dark:border-slate-700">
                            Reports
                        </span>
                        <Link to="/settings" className="text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white text-sm font-medium transition-colors px-4 py-1.5 rounded-full hover:bg-white dark:hover:bg-slate-800">
                            Settings
                        </Link>
                    </nav>
                </div>
                <div className="flex items-center gap-4">
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 border-2 border-white dark:border-slate-800 shadow-sm flex items-center justify-center text-white font-bold text-sm">
                        {userName.charAt(0)}
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="flex-1 w-full flex flex-col items-center py-8 px-4 overflow-y-auto print:p-0 print:overflow-visible">
                {/* Breadcrumbs - Hidden in Print */}
                <div className="w-full max-w-[210mm] mb-6 flex items-center gap-2 text-sm print:hidden">
                    <Link to="/stream" className="text-slate-500 hover:text-blue-600 transition-colors">Projects</Link>
                    <ChevronLeft className="w-4 h-4 text-slate-400 rotate-180" />
                    <span className="text-slate-500">Current Project</span>
                    <ChevronLeft className="w-4 h-4 text-slate-400 rotate-180" />
                    <span className="text-slate-900 dark:text-white font-semibold">Report View</span>
                </div>

                {/* A4 Document Wrapper */}
                <article className="relative w-full max-w-[210mm] min-h-[297mm] bg-white text-slate-900 shadow-2xl rounded-sm p-8 md:p-12 mb-24 print:mb-0 print:shadow-none print:w-full print:max-w-none print:h-auto">

                    {/* Document Header */}
                    <div className="flex flex-wrap justify-between items-start border-b-2 border-slate-100 pb-8 mb-8">
                        <div className="flex flex-col gap-4">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-slate-900 rounded-lg flex items-center justify-center print:border print:border-slate-300">
                                    <Cpu className="w-6 h-6 text-white" />
                                </div>
                                <div>
                                    <h1 className="text-3xl font-black tracking-tight text-slate-900 leading-none">BeamLab</h1>
                                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-0.5">Ultimate</p>
                                </div>
                            </div>
                            <div className="mt-2">
                                <h2 className="text-xl font-bold text-slate-800">Structural Analysis Report</h2>
                                <p className="text-sm text-slate-500 font-medium mt-1">Ref: BL-{Math.floor(Math.random() * 10000)}</p>
                            </div>
                        </div>
                        <div className="text-right">
                            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Generated Date</p>
                            <p className="text-slate-900 font-bold mb-4">{currentDate}</p>

                            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Prepared For</p>
                            <p className="text-slate-900 font-bold">Internal Review</p>
                        </div>
                    </div>

                    {/* Project Summary Grid */}
                    <section className="bg-slate-50 rounded-lg border border-slate-200 p-6 mb-10 print:border print:bg-white print:border-slate-300">
                        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 border-b border-slate-200 pb-2">Project Summary</h3>
                        <div className="grid grid-cols-3 gap-8">
                            <div>
                                <p className="text-xs text-slate-500 font-medium mb-1">Total Nodes</p>
                                <p className="text-xl font-bold text-slate-900">{nodes.size}</p>
                            </div>
                            <div>
                                <p className="text-xs text-slate-500 font-medium mb-1">Total Members</p>
                                <p className="text-xl font-bold text-slate-900">{members.size}</p>
                            </div>
                            <div>
                                <p className="text-xs text-slate-500 font-medium mb-1">Analysis Status</p>
                                <div className="flex items-center gap-2">
                                    <div className={`w-2 h-2 rounded-full ${analysisResults ? 'bg-green-500' : 'bg-amber-500'}`} />
                                    <p className="font-bold text-slate-900">{analysisResults ? 'Completed' : 'Pending'}</p>
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* Member Forces Table (Empty State or Real Data) */}
                    <section className="mb-10">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="flex items-center justify-center w-8 h-8 rounded bg-blue-50 text-blue-600">
                                <TableProperties className="w-5 h-5" />
                            </div>
                            <h2 className="text-xl font-bold text-slate-900">Member Forces</h2>
                        </div>

                        {analysisResults && analysisResults.memberForces.size > 0 ? (
                            <div className="rounded-lg border border-slate-200 overflow-hidden print:border-slate-300">
                                <table className="w-full text-left text-sm">
                                    <thead>
                                        <tr className="bg-slate-50 border-b border-slate-200 print:bg-slate-100">
                                            <th className="px-4 py-3 font-bold text-slate-700">Member ID</th>
                                            <th className="px-4 py-3 font-bold text-slate-700 text-right">Fx (kN)</th>
                                            <th className="px-4 py-3 font-bold text-slate-700 text-right">Fy (kN)</th>
                                            <th className="px-4 py-3 font-bold text-slate-700 text-right">Fz (kN)</th>
                                            <th className="px-4 py-3 font-bold text-slate-700 text-right">Mz (kNm)</th>
                                            <th className="px-4 py-3 font-bold text-slate-700 text-right">My (kNm)</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {Array.from(analysisResults.memberForces.entries()).slice(0, 15).map(([id, forces]) => (
                                            <tr key={id} className="hover:bg-slate-50/50">
                                                <td className="px-4 py-2 font-medium text-slate-900">{id}</td>
                                                <td className="px-4 py-2 text-slate-600 text-right font-mono">{(forces[0] || 0).toFixed(2)}</td>
                                                <td className="px-4 py-2 text-slate-600 text-right font-mono">{(forces[1] || 0).toFixed(2)}</td>
                                                <td className="px-4 py-2 text-slate-600 text-right font-mono">{(forces[2] || 0).toFixed(2)}</td>
                                                <td className="px-4 py-2 text-slate-600 text-right font-mono">{(forces[5] || 0).toFixed(2)}</td>
                                                <td className="px-4 py-2 text-slate-600 text-right font-mono">{(forces[4] || 0).toFixed(2)}</td>
                                            </tr>
                                        ))}
                                        {analysisResults.memberForces.size > 15 && (
                                            <tr>
                                                <td colSpan={6} className="px-4 py-3 text-center text-slate-400 italic bg-slate-50/30">
                                                    ... {analysisResults.memberForces.size - 15} more members not shown ...
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <div className="p-8 rounded-lg border-2 border-dashed border-slate-200 text-center">
                                <p className="text-slate-400 font-medium">No analysis results available yet. Run analysis to populate this table.</p>
                            </div>
                        )}
                    </section>

                    {/* Nodes Table */}
                    <section className="mb-8 print:break-inside-avoid">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="flex items-center justify-center w-8 h-8 rounded bg-emerald-50 text-emerald-600">
                                <Building2 className="w-5 h-5" />
                            </div>
                            <h2 className="text-xl font-bold text-slate-900">Node Coordinates</h2>
                        </div>

                        <div className="rounded-lg border border-slate-200 overflow-hidden print:border-slate-300">
                            <table className="w-full text-left text-sm">
                                <thead>
                                    <tr className="bg-slate-50 border-b border-slate-200 print:bg-slate-100">
                                        <th className="px-6 py-3 font-bold text-slate-700">Node ID</th>
                                        <th className="px-6 py-3 font-bold text-slate-700 text-right">X (m)</th>
                                        <th className="px-6 py-3 font-bold text-slate-700 text-right">Y (m)</th>
                                        <th className="px-6 py-3 font-bold text-slate-700 text-right">Z (m)</th>
                                        <th className="px-6 py-3 font-bold text-slate-700 text-center">Supports</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {Array.from(nodes.values()).slice(0, 10).map((node) => (
                                        <tr key={node.id} className="hover:bg-slate-50/50">
                                            <td className="px-6 py-2 font-medium text-slate-900">{node.id}</td>
                                            <td className="px-6 py-2 text-slate-600 text-right font-mono">{node.x.toFixed(3)}</td>
                                            <td className="px-6 py-2 text-slate-600 text-right font-mono">{node.y.toFixed(3)}</td>
                                            <td className="px-6 py-2 text-slate-600 text-right font-mono">{node.z.toFixed(3)}</td>
                                            <td className="px-6 py-2 text-slate-600 text-center text-xs">
                                                {Object.values(node.restraints || {}).some(Boolean) ? (
                                                    <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded border border-slate-200">
                                                        Fixed
                                                    </span>
                                                ) : '-'}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </section>

                    {/* Footer */}
                    <div className="mt-12 pt-6 border-t border-slate-200 text-center print:fixed print:bottom-0 print:left-0 print:w-full print:bg-white print:pb-4">
                        <p className="text-slate-400 text-xs font-medium">Generated by BeamLab Ultimate • {currentDate}</p>
                    </div>
                </article>
            </main>

            {/* Floating Action Bar - Hidden in Print */}
            <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 print:hidden">
                <div className="flex items-center gap-2 p-2 rounded-xl bg-white dark:bg-slate-800 shadow-xl border border-slate-200 dark:border-slate-700">
                    <button
                        onClick={handlePrint}
                        className="flex items-center gap-2 px-6 py-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm transition-all shadow-lg shadow-blue-500/20"
                    >
                        <Download className="w-5 h-5" />
                        Download PDF
                    </button>
                    <div className="w-px h-6 bg-slate-200 dark:bg-slate-700 mx-1" />
                    <button
                        onClick={handlePrint}
                        className="flex items-center gap-2 px-6 py-3 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 font-medium text-sm transition-colors"
                    >
                        <Printer className="w-5 h-5" />
                        Print
                    </button>
                    <button className="flex items-center gap-2 px-6 py-3 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 font-medium text-sm transition-colors">
                        <Share2 className="w-5 h-5" />
                        Share
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ReportsPage;
